#!/usr/bin/env node
// 手触りの試し打ち：人の指の動きを真似た自動の操作に、指の操作（src/lib/touchpad.ts）で課題をやらせ、設定ごとの成績を比べる。
// テスト版を組み立てて、テスト用モードで、claude.ai のアプリの中で測った本物の大きさ（750×312）のスマホの真似で走らせる。CI には入れない。
// 出る数は「この設定はあの設定より合わせやすい」という比べ合いにだけ使う（指のくせは下の HAND に置いた仮の値で、本当の人の指とは違う）。
//   node tools/feel.mjs                 狙う（見回す速さを3通り）と歩く（8方向とアナログ）
//   node tools/feel.mjs aim             狙うだけ（walk で歩くだけ）
//   --look 0.003,0.005,0.008           比べる見回す速さ（指が1px動くと何ラジアン回るか）
//   --trials <数>                      狙う課題の回数（既定 20）。歩く課題の道の数は --routes（既定 4）
// 結果は表で出し、tests/out/feel/summary.json にも書く。
//
// 課題
//   狙う：今の向きから左右に 15〜120° 離れた向きへ、±2.5° 以内に合わせる（的は横の向きだけ）。右半分を指でなぞる。
//         出る数：合うまでの時間・行き過ぎた回数（向きのずれの符号が変わった回数）・指を持ち替えた回数（1回のなぞりで届かない時）・4秒で合わなかった数。
//   歩く：今いる所から、歩いて 18〜26 マス先の床まで、迷宮を道なりに進む（道は迷宮の床を幅優先でたどって決める。曲がり角がある）。
//         左半分のスティックで、道の少し先のマスへ向けて倒す。出る数：着くまでの時間・壁に押し当てた割合（倒しているのに思った速さの3割も進めなかった時の割合）・
//         道からのずれ（道の線からの距離の平均）・25秒で着かなかった数。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withBrowser, openTest, advance, arg, OUT } from '../tests/lib.mjs';

/** 人の指のくせ（仮の値。出典の数値は目安で、この道具ではいつも同じ値を使う） */
const HAND = {
  react: 0.2, // 見てから指が動き出すまでの秒（人の単純な反応はおよそ 0.2 秒）
  replan: 0.18, // 1回のなぞりの後、ずれを見て次のなぞりを始めるまでの秒
  fittsA: 0.1, // なぞる時間 = fittsA + fittsB × log2(距離 / 的の幅 + 1)（フィッツの法則。指で画面を動かす時の目安の値）
  fittsB: 0.12,
  gain1: [0.95, 0.08], // 1回目のなぞりが、要る距離の何倍になるか（平均、ばらつき）。人の素早い動きは少し手前で止まりやすい
  gainN: [1.0, 0.12], // 2回目からの直しのなぞり
  tremor: 0.5, // なぞる途中の指のふるえ（px。毎回の位置に足す）
  strokeMax: 200, // 1回で楽になぞれる長さ（px）。越える時は指を離して持ち替える
  clutch: 0.12, // 持ち替えにかかる秒
  stickR: [44, 3], // スティックを倒す距離（px。平均、ばらつき）。走るのは 46px からなので、歩く
  stickAng: 7, // スティックの向きのぶれ（度）
  stickEvery: 0.15, // スティックの向きを直す間（秒）。人は毎フレームは直せない
};
const HZ = 60; // なぞりの指の位置を送る回数（1秒あたり）
const W = 750,
  H = 312;

const argv = process.argv.slice(2);
const only = argv.find((a) => a === 'aim' || a === 'walk');
const LOOKS = (arg('--look', '0.003,0.005,0.008') ?? '').split(',').map(Number);
const TRIALS = Number(arg('--trials', 20)),
  ROUTES = Number(arg('--routes', 4));

// 決まった並びの乱数（同じ設定なら、いつも同じ結果）。正規分布は箱ミュラー
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const gauss = (r, [m, s]) => m + s * Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const median = (a) => {
  const b = [...a].sort((x, y) => x - y);
  return b.length ? b[Math.floor(b.length / 2)] : NaN;
};
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');

await withBrowser(async ({ browser, base }) => {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  await openTest(pg, base, 'seed=202&god=1');
  const E = (f, a) => pg.evaluate(f, a);
  const cdp = await ctx.newCDPSession(pg);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const st = () => E(() => __test.state());
  // 指で「迷宮に入る」を押して始め、生き物を消す（課題の邪魔をしないように）
  await pg.locator('#enter').scrollIntoViewIfNeeded();
  const eb = await pg.locator('#enter').boundingBox();
  await pg.touchscreen.tap(eb.x + eb.width / 2, eb.y + eb.height / 2);
  await advance(pg, 2);
  await E(() => __test.clearAll());
  const summary = { hand: HAND, viewport: [W, H], aim: [], walk: [] };

  // ---------------------------------------------------------------- 狙う
  if (only !== 'walk')
    for (const K of LOOKS) {
      await E((k) => __test.touchTune({ look: k, analog: false }), K);
      const r = rng(1234),
        tol = (2.5 * Math.PI) / 180,
        rows = [];
      for (let n = 0; n < TRIALS; n++) {
        const off = ((r() < 0.5 ? -1 : 1) * ((15 + r() * 105) * Math.PI)) / 180;
        const goal = (await st()).yaw + off;
        let t = HAND.react,
          over = 0,
          clutches = 0,
          first = true,
          err = off,
          ok = false;
        while (t < 4) {
          const D = Math.abs(err) / K,
            g = gauss(r, first ? HAND.gain1 : HAND.gainN),
            want = D * g,
            len = Math.min(want, HAND.strokeMax),
            dir = err > 0 ? -1 : 1, // 右へなぞると右を向く（yaw が減る）。向きを増やすには左へ
            T = HAND.fittsA + HAND.fittsB * Math.log2(len / ((2 * tol) / K) + 1),
            x0 = dir < 0 ? W - 30 : W / 2 + 30,
            steps = Math.max(2, Math.round(T * HZ));
          await touch('touchStart', [[x0, 160, 1]]);
          for (let i = 1; i <= steps; i++) {
            const s = i / steps,
              p = len * (10 * s ** 3 - 15 * s ** 4 + 6 * s ** 5); // 速さが滑らかに上がって下がる、人の手の動き（躍度最小）
            await touch('touchMove', [[x0 + dir * p + gauss(r, [0, HAND.tremor]), 160, 1]]);
          }
          await touch('touchEnd', []);
          t += T;
          const e2 = goal - (await st()).yaw;
          if (Math.sign(e2) !== Math.sign(err) && Math.abs(e2) > tol) over++;
          err = e2;
          first = false;
          if (want > HAND.strokeMax) {
            clutches++;
            t += HAND.clutch;
          }
          if (Math.abs(err) <= tol) {
            ok = true;
            break;
          }
          t += HAND.replan;
        }
        rows.push({ off: (off * 180) / Math.PI, t, over, clutches, ok });
      }
      const okRows = rows.filter((x) => x.ok);
      summary.aim.push({
        look: K,
        meanT: mean(okRows.map((x) => x.t)),
        medianT: median(okRows.map((x) => x.t)),
        over: mean(rows.map((x) => x.over)),
        clutch: mean(rows.map((x) => x.clutches)),
        miss: rows.length - okRows.length,
        rows,
      });
    }

  // ---------------------------------------------------------------- 歩く
  if (only !== 'aim') {
    await E(() => __test.touchTune({ look: 0.005 }));
    // 道：今いるマスから、迷宮の床を幅優先でたどり、18〜26 マス先の床を選ぶ（道ごとに選ぶマスを変える）
    const start = (await st()).pos;
    const routes = await E(
      ({ start, n }) => {
        const { w, h } = __test.size(),
          c0 = __test.cell(0),
          cs = 2 * c0.x,
          si = Math.floor(start[1] / cs) * w + Math.floor(start[0] / cs);
        const prev = new Map([[si, -1]]),
          dist = new Map([[si, 0]]),
          q = [si];
        while (q.length) {
          const i = q.shift(),
            x = i % w,
            z = (i / w) | 0;
          for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = x + dx,
              nz = z + dz,
              j = nz * w + nx;
            if (nx < 0 || nz < 0 || nx >= w || nz >= h || dist.has(j) || !__test.cell(j).floor) continue;
            dist.set(j, (dist.get(i) ?? 0) + 1);
            prev.set(j, i);
            q.push(j);
          }
        }
        const far = [...dist].filter(([, d]) => d >= 18 && d <= 26).map(([j]) => j);
        const out = [];
        for (let k = 0; k < n && far.length; k++) {
          let j = far[Math.floor((k * far.length) / n)];
          const path = [];
          while (j !== -1 && j !== undefined) {
            const c = __test.cell(j);
            path.unshift([c.x, c.z]);
            j = prev.get(j);
          }
          out.push(path);
        }
        return out;
      },
      { start, n: ROUTES },
    );
    for (const mode of ['8方向', 'アナログ']) {
      await E((a) => __test.touchTune({ analog: a }), mode === 'アナログ');
      const r = rng(777),
        rows = [];
      for (const path of routes) {
        // 道の初めに立つ
        await E(([x, z]) => dbg.step(x, z), path[0]);
        await advance(pg, 0.5);
        const DT = 1 / 30,
          ox = 150,
          oy = 220;
        let t = 0,
          wi = 1,
          nextAim = 0,
          stuck = 0,
          held = 0,
          dev = [],
          sx = ox,
          sy = oy,
          prevPos = (await st()).pos;
        await touch('touchStart', [[ox, oy, 2]]);
        while (t < 25 && wi < path.length) {
          const s = await st(),
            [px, pz] = s.pos;
          // 今のマスを通り過ぎたら（次のマスの方が、今のマスから次のマスまでより近い）、次のマスへ。最後のマスは 0.8 以内で着いたことにする。
          // 向けるのは2マス先（角を少し内側で曲がるので、マスの真ん中を通るとは限らない）
          const d = (a) => Math.hypot(a[0] - px, a[1] - pz);
          while (wi < path.length - 1 && d(path[wi + 1]) < Math.hypot(path[wi + 1][0] - path[wi][0], path[wi + 1][1] - path[wi][1])) wi++;
          if (wi === path.length - 1 && d(path[wi]) < 0.8) wi++;
          if (wi >= path.length) break;
          if (t >= nextAim) {
            const [tx, tz] = path[Math.min(wi + 1, path.length - 1)],
              ix = tx - px,
              iz = tz - pz,
              l = Math.hypot(ix, iz) || 1,
              sy0 = Math.sin(s.yaw),
              cy0 = Math.cos(s.yaw);
            // 世界の向き → スティックの前後と左右（src/lib/player.ts の ix = -sin·fw + cos·st、iz = -cos·fw - sin·st を解く）
            const fw = -(sy0 * ix + cy0 * iz) / l,
              stv = (cy0 * ix - sy0 * iz) / l,
              a = Math.atan2(stv, fw) + (gauss(r, [0, HAND.stickAng]) * Math.PI) / 180,
              R = gauss(r, HAND.stickR);
            sx = ox + Math.sin(a) * R;
            sy = oy - Math.cos(a) * R;
            await touch('touchMove', [[sx, sy, 2]]);
            nextAim = t + HAND.stickEvery;
          }
          await advance(pg, DT);
          t += DT;
          const p2 = (await st()).pos,
            moved = Math.hypot(p2[0] - prevPos[0], p2[1] - prevPos[1]);
          held++;
          if (moved < 3.2 * DT * 0.3) stuck++;
          prevPos = p2;
          // 道からのずれ：道の線（今のマスの前後）までの距離
          const seg = (a, b) => {
            const vx = b[0] - a[0],
              vz = b[1] - a[1],
              u = Math.max(0, Math.min(1, ((p2[0] - a[0]) * vx + (p2[1] - a[1]) * vz) / (vx * vx + vz * vz || 1)));
            return Math.hypot(a[0] + vx * u - p2[0], a[1] + vz * u - p2[1]);
          };
          dev.push(Math.min(seg(path[wi - 1], path[wi]), wi + 1 < path.length ? seg(path[wi], path[wi + 1]) : Infinity));
        }
        await touch('touchEnd', []);
        await advance(pg, 0.5);
        rows.push({ cells: path.length, t, ok: wi >= path.length, stuck: held ? stuck / held : 0, dev: mean(dev) });
      }
      const okRows = rows.filter((x) => x.ok);
      summary.walk.push({
        mode,
        meanT: mean(okRows.map((x) => x.t)),
        stuck: mean(rows.map((x) => x.stuck)),
        dev: mean(rows.map((x) => x.dev)),
        miss: rows.length - okRows.length,
        rows,
      });
    }
  }

  // ---------------------------------------------------------------- 結果
  if (summary.aim.length) {
    console.log(`\n狙う（${TRIALS}回。左右に 15〜120° 離れた向きへ ±2.5° 以内に）`);
    console.log('見回す速さ | 合うまでの秒（平均・真ん中） | 行き過ぎ（1回あたり） | 持ち替え（1回あたり） | 4秒で合わず');
    for (const a of summary.aim) console.log(`${a.look} | ${f2(a.meanT)}・${f2(a.medianT)} | ${f2(a.over)} | ${f2(a.clutch)} | ${a.miss}`);
  }
  if (summary.walk.length) {
    console.log(`\n歩く（${routes_n(summary)}本の道。18〜26 マス先まで、道なりに）`);
    console.log('スティック | 着くまでの秒（平均） | 壁に押し当てた割合 | 道からのずれ（平均） | 25秒で着かず');
    for (const w of summary.walk) console.log(`${w.mode} | ${f2(w.meanT)} | ${(w.stuck * 100).toFixed(1)}% | ${f2(w.dev)} | ${w.miss}`);
  }
  if (errs.length) console.log('page errors:', errs);
  const dir = join(OUT, 'feel');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 1));
  console.log(`\n${join(dir, 'summary.json')}`);
  process.exitCode = errs.length ? 1 : 0;
});

function routes_n(s) {
  return s.walk[0]?.rows.length ?? 0;
}
