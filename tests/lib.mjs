// テストの共通部分：組み立て・配信・ブラウザ・テスト用モードのページ。
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';
import { build } from 'vite';
import { serve } from '../tools/serve.mjs';
import { findMap, originalPosition } from '../tools/sourcemap.mjs';

const must = (v, what) => {
  if (v === undefined || v === null) throw new Error(`${what}が無い`);
  return v;
};
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'tests/out');
export const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};

// ヘッドレスの Chromium はソフトウェアGL（swiftshader）で描く。とても遅い（960x540 で1秒に1フレームほど）。
export const GL_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--font-render-hinting=none',
];

// ゲームの文言を含む全部の文のファイル（src/index.html と src/lib/ の .ts）と、それをつないだ文（index.html は、コメントを除いた本文。
// CSS の content なども描かれうるので残す）。文字を調べるテスト（使う文字・文字の幅）が使う
export const GAME_FILES = [
  'src/index.html',
  ...readdirSync(join(ROOT, 'src/lib'), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => `src/lib/${f}`),
];
// HTML のコメント（<!-- から --> まで）を除く。閉じていないコメントは残す
const dropComments = (t) => {
  let out = '',
    i = 0;
  for (let a; (a = t.indexOf('<!--', i)) >= 0;) {
    out += t.slice(i, a);
    const b = t.indexOf('-->', a + 4);
    if (b < 0) return out + t.slice(a);
    i = b + 3;
  }
  return out + t.slice(i);
};
export const gameText = () =>
  GAME_FILES.map((f) => {
    const t = readFileSync(join(ROOT, f), 'utf8');
    return f.endsWith('.html') ? dropComments(t) : t;
  }).join('\n');

// ページのエラーの「assets/index-xxxx.js:行:列」に、src/lib/ の場所を書き足す（組み立てた JS は書き直されていて、行が違うため）。
// ソースマップは公開物に入れず、.build/maps/<mode>/ に置いている（vite.config.mjs）
let mapDir = null;
const maps = {};
export const annotate = (s) =>
  !mapDir
    ? s
    : s.replace(/assets\/([\w.-]+\.js)(?:\?[^:\s)]*)?:(\d+):(\d+)/g, (all, f, l, c) => {
        maps[f] ??= findMap(f, mapDir);
        const p = maps[f] && originalPosition(maps[f], Number(l), Number(c) - 1);
        return p ? `${all} (${p.source}:${p.line}:${p.column + 1})` : all;
      });

// 組み立てて配信し、ブラウザを開く。fn が終わったら必ず閉じる。
// root：組み立てる作業場所（既定はこの作業場所。tools/field.mjs の --rev が、前の版の src を置いた一時的な作業場所を渡す。その時は AL_PREBUILT によらず組み立てる）
export async function withBrowser(fn, { prod = false, root = ROOT } = {}) {
  mkdirSync(OUT, { recursive: true });
  // テスト版は .build/test/、prod は公開用と同じ dist/（three.js とフォントは、どちらも組み立てに入っている。違いはテスト版の cjkFallback だけ）
  // テストをまとめて走らせる時（tests/run.mjs）は、テスト版を先に1回だけ組み立てて AL_PREBUILT を渡すので、ここでは組み立てない
  // （同時に走るテストが、同じ .build/test/ に組み立てるとぶつかるため）
  const mode = prod ? 'production' : 'test',
    dir = join(root, prod ? 'dist' : '.build/test');
  if (prod || root !== ROOT || process.env.AL_PREBUILT !== '1')
    await build({ configFile: join(root, 'vite.config.mjs'), mode, logLevel: 'warn' });
  else console.log('組み立ては済んでいるので、組み立てない（AL_PREBUILT=1。1つだけ走らせる時は、この環境変数を消すこと）');
  mapDir = join(root, '.build/maps', mode);
  // サンドボックスの iframe（tests/frame.mjs）から読めるように、CORS の見出しを付ける
  const srv = await serve(dir, 0, { cors: true });
  // システムのフォントを見せない（tests/fonts.conf）。テスト版は日本語も同梱のフォントで描くので、どのマシンでも同じ文字になる。
  // 公開用の版（prod）は、JetBrains Mono を指定した所の日本語をシステムのフォントで描くので、FONTCONFIG_FILE を替えない（システムのフォントも見せる）。
  const env = prod ? process.env : { ...process.env, FONTCONFIG_FILE: join(ROOT, 'tests/fonts.conf') };
  const browser = await chromium.launch({ args: GL_ARGS, env });
  try {
    return await fn({ browser, base: `http://127.0.0.1:${srv.port}/index.html` });
  } finally {
    await browser.close();
    srv.close();
  }
}

// ページを作る。ページのエラーは errs に集める（ページの中の iframe のエラーも）。ポインタロックは止める。
// still: CSS のアニメーションとトランジションを止める（実際の時間で進むので、撮るたびに画面写真が変わる。いつも終わった後の姿にする）
// realLock: ポインタロックを止めない（ブラウザ本来の動きのまま。tests/frame.mjs のサンドボックスの iframe で使う）
// device: Playwright の端末の名前（'iPhone 13 landscape' など）。その端末の画面の大きさ・タッチ・UA で開く（width・height は使わない。tests/touch.mjs）
export async function newPage(browser, errs, { width = 960, height = 540, still = false, realLock = false, device = null } = {}) {
  const pg = device
    ? await (await browser.newContext({ ...must(devices[device], `端末 ${String(device)}`) })).newPage()
    : await browser.newPage({ viewport: { width, height } });
  pg.on('pageerror', (e) => errs.push(annotate(String(e.stack || e)).slice(0, 600)));
  pg.on('requestfailed', (r) => console.log('request failed:', r.url(), r.failure()?.errorText || ''));
  if (!realLock)
    await pg.addInitScript(() => {
      HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new Error('no'));
    });
  if (still)
    await pg.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style');
        st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important;}';
        document.head.appendChild(st);
      });
    });
  return pg;
}

// テスト用モード（?test=1）で開き、準備ができるまで待つ。ゲームは、advance / frames を呼ぶまで進まない。
export async function openTest(pg, base, query = '') {
  await pg.goto(`${base}?test=1${query ? '&' + query : ''}`, { waitUntil: 'commit', timeout: 120000 });
  await pg.waitForFunction(() => window.__test && (window.__test.ready() || window.__test.error()), null, { timeout: 90000, polling: 200 });
  const err = await pg.evaluate(() => __test.error());
  if (err) throw new Error(`起動に失敗：${err}`);
}

// 描いて n フレーム進める（1フレーム＝ゲームの 1/30 秒）
export const frames = (pg, n) => pg.evaluate((n) => __test.frames(n), n);
// 描かずに進める（速い）
export const advance = (pg, sec) => pg.evaluate((s) => __test.advance(s), sec);
// 鍵 key の生き物の体の高さの真ん中を向く（dbg.look）。その生き物の体力を返す（いなければ Error）
const lookAt = async (pg, key) => {
  const hp = await pg.evaluate((key) => {
    const m = __test.state().monsters.find((m) => m[0] === key);
    if (!m) return null;
    const v = __test.monsterView(key);
    dbg.look(m[1], v && v.world ? (v.world.y0 + v.world.y1) / 2 : 0.5, m[2]);
    return m[3];
  }, key);
  if (hp === null) throw new Error(`照準を合わせる生き物 ${key} がいない`);
  return hp;
};
// 鍵 key の生き物が照準の先（__test.mob(n).aimed）になるまで、体の高さの真ん中を向いて 1/30 秒ずつ進める。なれば、もう一度向き直して終わる
// （照準の先は 0.1 秒ごとに探し直すので、12 回試す。なれなければ Error）
export async function aimAt(pg, key) {
  for (let k = 0; k < 12; k++) {
    await lookAt(pg, key);
    await advance(pg, 1 / 30);
    const aimed = await pg.evaluate((key) => {
      const n = __test.state().monsters.findIndex((m) => m[0] === key);
      return n >= 0 && !!__test.mob(n)?.aimed;
    }, key);
    if (aimed) {
      await lookAt(pg, key);
      return;
    }
  }
  throw new Error(`生き物 ${key} が照準の先にならない（12 回、1/30 秒ずつ進めて向き直した）`);
}
// 手 hand（'L'・'R'）の武器で、鍵 key の生き物を撃つ。押して、体力が減るまで描かずに 1/30 秒ずつ進める。近接（小剣など）は押した時に当たる。
// 溜める武器（光弾など）は溜めきる（cast.full）まで待ち、向き直してから離す（早く離すと散る）。当たって光るのは 0.22〜0.35 秒なので、毎フレーム見る。
// { hit: true, frame }（押してから何フレーム目に当たったか。押した時に当たれば 0）を返す。150 フレームで当たらなければ Error
export async function strike(pg, hand, key) {
  // 押してから当たるまでを、ページの中の1回の evaluate で進める（溜める間の1フレームごとに、ページと行き来しない）
  const frame = await pg.evaluate(
    ([hand, key]) => {
      const hpNow = () => {
          const m = __test.state().monsters.find((m) => m[0] === key);
          return m ? m[3] : -1;
        },
        hp0 = hpNow();
      __test.press(hand);
      let released = false;
      try {
        for (let k = 0; k < 150; k++) {
          if (hpNow() < hp0) return k;
          if (!released && __test.state().cast?.full) {
            // 離す前に向き直す（lookAt と同じ）
            const m = __test.state().monsters.find((m) => m[0] === key);
            if (m) {
              const v = __test.monsterView(key);
              dbg.look(m[1], v && v.world ? (v.world.y0 + v.world.y1) / 2 : 0.5, m[2]);
            }
            __test.release(hand);
            released = true;
          }
          __test.advance(1 / 30);
        }
      } finally {
        if (!released) __test.release(hand);
      }
      return -1;
    },
    [hand, key],
  );
  if (frame < 0) throw new Error(`手 ${hand} の武器が生き物 ${key} に当たらない（150 フレーム）`);
  return { hit: true, frame };
}
// 一番近い祭壇のそばへ行く（dbg.to('altar') は2マス手前に置くが、祭壇の画面は1.5以内でないと開かない）
export const nearAltar = (pg) =>
  pg.evaluate(() => {
    dbg.to('altar');
    const [px, pz] = __test.state().pos,
      d = (o) => Math.hypot(o.pos[0] - px, o.pos[1] - pz);
    const a = dbg
      .items()
      .filter((o) => o.altar && o.slot === 1)
      .sort((p, q) => d(p) - d(q))[0];
    if (!a) return false;
    const [ax, az] = a.pos,
      k = 1.2 / (d(a) || 1);
    dbg.step(ax + (px - ax) * k, az + (pz - az) * k);
    return true;
  });
// 生き物を水の中に置く場面（tools/zap.mjs・tools/frost.mjs と tests/world.mjs が使う）：右手を武器 weapon にして性質 elem（書かなければ雷）を付け、生き物を全部消して、水のマスが固まっている所に、鍵 key の生き物を count 体
// （当てる1体 target と、そのまわり 1.6〜4.5 の、互いに 1.4 以上離れた水のマス。dry なら水の外にも1体）置いて止め（__test.hold）、プレイヤーを当てる1体から 3.5〜5.5 離れた
// 水でない床（水の外の1体から 2.5 以上離れた所）に立たせる。置いた物が全部見える所を選ぶ。{ok, stand, target, cells（置いた順。dry の1体は最後）, dry} か {err} を返す
// floor なら、水のマスの代わりに、水から 2.5 以上離れた、まわりの8マスも床のマスに置く（dry は使わない）
export const waterScene = (pg, { key, count, dry, weapon, elem = 'thunder', floor: onFloor = false }) =>
  pg.evaluate(
    ([key, count, dry, weapon, elem, onFloor]) => {
      const eq = __test.equip('R', weapon);
      if (eq !== weapon) return { err: `武器 ${weapon}：${eq}` };
      const el = __test.elem('R', elem);
      if (el !== elem) return { err: `性質 ${elem}：${el}` };
      __test.clearAll();
      const { w, h } = __test.size(),
        cells = [];
      for (let i = 0; i < w * h; i++) {
        const c = __test.cell(i);
        cells.push({ i, ...c });
      }
      const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z),
        wet = cells.filter((c) => c.water && c.floor),
        floor = cells.filter((c) => c.floor),
        // floor の時は、まわりの8マスも床の所（狭い通路の行き止まりに置かない）
        open = (c) =>
          [-1, 0, 1].every((dz) => [-1, 0, 1].every((dx) => (c.i % w) + dx >= 0 && (c.i % w) + dx < w && cells[c.i + dx + dz * w]?.floor)),
        water = onFloor
          ? floor.filter((c) => !c.water && !c.ice && !c.lava && !c.bog && !c.tall && open(c) && wet.every((w) => d(w, c) >= 2.5))
          : wet;
      for (const t of water) {
        // まわりの水：互いに 1.4 以上離れた物を、近い順に選ぶ
        const near = water.filter((c) => c !== t && d(c, t) >= 1.6 && d(c, t) <= 4.5).sort((a, b) => d(a, t) - d(b, t)),
          picks = [t];
        for (const c of near) if (picks.length < count && picks.every((p) => d(p, c) >= 1.4)) picks.push(c);
        if (picks.length < count) continue;
        let dryCell = null;
        if (dry) {
          dryCell = floor.find((c) => !c.water && d(c, t) >= 1.6 && d(c, t) <= 3.5 && picks.every((p) => d(p, c) >= 1.4));
          if (!dryCell) continue;
        }
        // 立つ所：当てる1体から 3.5〜5.5 離れた、水でない床で、置いた物が全部見える所
        const stands = floor.filter((c) => !c.water && d(c, t) >= 3.5 && d(c, t) <= 5.5);
        for (const s of stands) {
          if (dryCell && d(dryCell, s) < 2.5) continue;
          dbg.step(s.x, s.z);
          __test.fov();
          const all = dryCell ? [...picks, dryCell] : picks;
          if (!all.every((c) => __test.cell(c.i).seen)) continue;
          all.forEach((c) => __test.summon(key, c.i));
          __test.state().monsters.forEach((_, n) => __test.hold(n, {}));
          return { ok: true, stand: [s.x, s.z], target: [t.x, t.z], cells: all.map((c) => [c.x, c.z]), dry: !!dryCell };
        }
      }
      return { err: `${onFloor ? '床' : '水の中'}に ${count} 体を置ける所が無い` };
    },
    [key, count, dry, weapon, elem, onFloor],
  );
// 場面（waterScene の結果 s）を、置いたカメラで写す所に置く（tools/zap.mjs・tools/frost.mjs が使う）。view は high（置いた物の真ん中の、プレイヤー側の少し手前の高い所から、ほぼ真下を見る）か
// side（置いた物の真ん中から見て、プレイヤーの向きを 40〜120 度回した横から、目の高さで見る）。置けたら __test.cam の結果、どこも見通せなければ目に戻して null
export const sceneCam = (pg, s, view) =>
  pg.evaluate(
    ([s, view]) => {
      const [px, pz] = s.stand,
        mx = s.cells.reduce((a, c) => a + c[0], 0) / s.cells.length,
        mz = s.cells.reduce((a, c) => a + c[1], 0) / s.cells.length,
        dl = Math.hypot(mx - px, mz - pz) || 1,
        ux = (mx - px) / dl,
        uz = (mz - pz) / dl,
        tries = [];
      if (view === 'high')
        for (const y of [7, 6, 5, 4.2, 3.6, 3, 2.6]) for (const back of [1.5, 2.5, 0.8]) tries.push([mx - ux * back, y, mz - uz * back]);
      else
        for (const deg of [90, -90, 60, -60, 120, -120, 40, -40])
          for (const d of [6, 5, 4.2])
            for (const y of [1.6, 2.2]) {
              const a = (deg * Math.PI) / 180;
              tries.push([mx - (ux * Math.cos(a) - uz * Math.sin(a)) * d, y, mz - (ux * Math.sin(a) + uz * Math.cos(a)) * d]);
            }
      for (const pos of tries) {
        // 置いた物から 3 より近い所には置かない（体で前が塞がる）
        if (view === 'side' && s.cells.some(([x, z]) => Math.hypot(x - pos[0], z - pos[2]) < 3)) continue;
        const r = __test.cam({ pos, at: [mx, 0.4, mz] });
        if (typeof r !== 'string' && r.clear) return r;
      }
      // どこも見通せなければ、最後に置いたカメラを外して目に戻す
      __test.cam(null);
      return null;
    },
    [s, view],
  );
