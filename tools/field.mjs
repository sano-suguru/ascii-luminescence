#!/usr/bin/env node
// 生き物を本物の階に置き、プレイヤーの目の高さから写す（テスト版を組み立てて、テスト用モードで）。図鑑より明るい迷宮の灯りの下で、
// 向かってくる姿が読めるか・光ってにじまないか・頭の上の印が体に付いているかを確かめる時に使う（見た目を直す時の最後の確かめ）。
//   pnpm field ヘビ                名前で選ぶ（図鑑の名前。表の鍵（n・T など）でもよい。主・忘れられた獣は pnpm lords）
//   --scenes 1:202,3:7             写す階（深さ:シード を , で区切る。既定は、石の迷宮の深さ 1 と大洞窟の深さ 3）
//   --rev <版>                     前の版（git の版。例 origin/main）とも同じ所で写し、前と今を上下に並べる（src/ だけを前の版にした一時的な作業場所で組み立てる。
//                                  その作業場所の src/ 以外（vite.config.mjs など）は、最後のコミットの物。まだコミットしていない src/ の外の変更は、前の版には入らない）
//   --out <ディレクトリ>           置き場所（既定 tests/out/field/）
//   --kill [1,4,10,30,90,240,330]  距離ごとの写真の代わりに、倒して時間を追って写す（倒れ方を直す時に）。数は倒してからのフレーム数（1/30 秒。小さい順）
// 写す物（階ごと）：生き物を 6m ほど先の、見えている床に置き、向かってくるところを 4m・3m・2.5m で写す（照準が当たると明るく描くので、
// いつも少し横を見る）。もう1枚、3m ほどの所で照準を合わせて写す（照準の先は明るく描く。近くの大きな生き物ほど弱める。白い塊にならないか）。
// 写真は <名前>-<深さ>-<距離>.png（照準を合わせた物は -aim）と、体のまわりで切り抜いて並べた1枚 <名前>-field.png
// （行が階、列が 4m・3m・2.5m・照準。--rev の時は、階ごとに前・今の2行で、同じ枠で切り抜く）。
// --kill の時（階ごと）：生き物が 4m（大きな物は体の大きさの 2 倍。竜は 6m）まで来たら、倒す直前を1枚写し、dbg.kill('near') で倒して、
// 挙げたフレーム数ごとに写す（照準は合わせず、少し横を見る。見た時の説明と行く先の矢印は隠す。前のフレームまでは描かずに進め、写すフレームだけ描く）。写真は <名前>-<深さ>-before.png・-k<フレーム数>.png と、
// 時間の順に横に並べた1枚 <名前>-kill.png（行が階。--rev の時は階ごとに前・今の2行）。倒した後は体の範囲を取れないので、行の全部の列を、
// 倒す直前の体の範囲（--rev の時は前と今を合わせた範囲）の正方形を 1.6 倍に広げた枠で切り抜く（床に散る文字も入るように）。
// 生き物が近づいて来ない時（道が無い・見回りを続ける、など）は、置き直して試し、それでも来なければ、プレイヤーの方が寄って写す（床が無ければ、その枡を黒のままにして知らせる）。
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { withBrowser, newPage, openTest, advance, frames, arg, OUT, ROOT } from '../tests/lib.mjs';
import { cropRect, writeSheet } from './sheet.mjs';

const W = 960,
  H = 540,
  CLIP = { x: 0, y: 0, width: W, height: H },
  DISTS = [4, 3, 2.5], // 2m より近くへは、手前で止まって攻撃する生き物がいる
  // --kill：倒す距離は KILL_AT か、体の大きさ（scale）の KILL_K 倍の遠い方。竜（scale 3）は 6m。
  // 4m だと竜は画面を覆い、床に積もる文字が画面の下の外に出る。9m だと、石の迷宮（深さ 1）で置ける床が見つからない。3m だと、小さな物でも手元の武器が切り抜きに入る
  KILL_AT = 4,
  KILL_K = 2,
  KILL_DEF = [1, 4, 10, 30, 90, 240, 330];
const argv = process.argv.slice(2);
const usage = (why) => {
  console.log(`${why}\n使い方：pnpm field <名前…> [--scenes 1:202,3:7] [--rev <版>] [--out <ディレクトリ>] [--kill [フレーム数,…]]`);
  process.exit(1);
};
const opt = (k) => {
  const v = arg(k, null);
  if (argv.includes(k) && (!v || v.startsWith('--'))) usage(`${k} の後に値を書いてください`);
  return v;
};
const outDir = resolve(opt('--out') ?? join(OUT, 'field'));
const rev = opt('--rev');
const scenes = (opt('--scenes') ?? '1:202,3:7').split(',').map((s) => {
  const [depth, seed] = s.split(':').map(Number);
  if (!(depth >= 1 && depth <= 13 && seed >= 0)) usage(`--scenes の「${s}」が読めない（深さ:シード。深さは 1 から 13）`);
  return { depth, seed };
});
// --kill の後の数の並びは書かなくてもよい（数と , だけの物を値とみなす）
const ki = argv.indexOf('--kill'),
  killArg = ki >= 0 && /^[\d,]+$/.test(argv[ki + 1] ?? '') ? (argv[ki + 1] ?? '') : null;
const kill = ki < 0 ? null : killArg === null ? KILL_DEF : killArg.split(',').map(Number);
if (kill && !kill.every((k, i) => Number.isInteger(k) && k >= 1 && (i === 0 || k > (kill[i - 1] ?? 0))))
  usage('--kill の数は、1 以上の整数を小さい順に , で区切って書いてください');
const VALUED = new Set(['--out', '--rev', '--scenes']);
const names = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1] ?? '') && !(i === ki + 1 && killArg !== null));
if (!names.length) usage('写す生き物の名前を書いてください');
mkdirSync(outDir, { recursive: true });

/** 1つの階で、1つの生き物を写す。写真のファイルと体の範囲を、距離（と 'aim'）ごとに返す。来なかった距離は null */
async function shootScene(browser, base, { key, scale }, { depth, seed }, prefix, errs) {
  const pageErrs = [];
  const pg = await newPage(browser, pageErrs, { width: W, height: H, still: true });
  await openTest(pg, base, `seed=${seed}&depth=${depth}&god=1`);
  await advance(pg, 2); // 階に入ると、約1.25秒かけて明るくなる
  // --kill：倒すと照準の先が床に移り、床の説明（#look）と行く先の矢印（#arrows）が、積もった文字の上に重なるので隠す
  if (kill) await pg.addStyleTag({ content: '#look, #arrows { visibility: hidden !important; }' });
  const got = {};
  // --kill：倒す距離は体の大きさ（図鑑の一覧の scale）に合わせる（大きな物は、近いと画面を覆い、床に積もる文字が画面の下の外に出る）
  const killAt = Math.max(KILL_AT, scale * KILL_K),
    far = kill ? Math.max(6, killAt + 2) : 6;
  // 置き直して試す：見えている床で、far（ふだんは 6m）ほど先の物を、近い順に
  const cells = await pg.evaluate((far) => {
    __test.clearAll();
    __test.fov();
    const s = __test.state(),
      { w, h } = __test.size(),
      out = [];
    for (let i = 0; i < w * h; i++) {
      const c = __test.cell(i);
      if (!c.floor || !c.seen) continue;
      const d = Math.hypot(c.x - s.pos[0], c.z - s.pos[1]);
      if (d >= far - 1 && d <= far + 2) out.push([Math.abs(d - far), i]);
    }
    return out.sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  }, far);
  // 生き物の位置と距離。look が真なら、照準が当たらないよう、生き物の 0.9 横を見る（偽なら生き物そのものを見る）
  const lookAt = (aim) =>
    pg.evaluate(
      ([key, aim]) => {
        const m = __test.state().monsters.find((m) => m[0] === key),
          s = __test.state();
        if (!m) return null;
        const dx = m[1] - s.pos[0],
          dz = m[2] - s.pos[1],
          d = Math.hypot(dx, dz) || 1,
          v = __test.monsterView(key),
          y = v && v.world ? (v.world.y0 + v.world.y1) / 2 : 0.3;
        if (aim) dbg.look(m[1], y, m[2]);
        else dbg.look(m[1] + (dz / d) * 0.9, y, m[2] - (dx / d) * 0.9);
        return d;
      },
      [key, aim],
    );
  const snap = async (tag, n = 2) => {
    await frames(pg, n);
    const file = `${prefix}-${tag}.png`;
    await pg.screenshot({ path: file, timeout: 90000 });
    const v = await pg.evaluate((key) => __test.monsterView(key), key);
    got[tag] = { file, box: v && v.screen ? v.screen : null };
  };
  // --kill：倒す直前を写し、一番近い生き物を倒して、倒してから挙げたフレーム数ごとに写す（前の1フレームまでは描かずに進め、最後の1フレームを描く）
  const dists = kill ? [killAt] : DISTS;
  const killSeq = async () => {
    await snap('before', 1);
    await pg.evaluate(() => dbg.kill('near'));
    let done = 0;
    for (const k of kill ?? []) {
      if (k - done > 1) await advance(pg, (k - done - 1) / 30);
      await snap(`k${k}`, 1);
      done = k;
    }
  };
  const reach = async (d) => {
    if (kill) await killSeq();
    else await snap(`${d}m`);
  };
  const reached = (d) => (kill ? !!got.before : !!got[`${d}m`]);
  for (const cell of cells.slice(0, 4)) {
    await pg.evaluate(
      ([key, cell]) => {
        __test.clearAll();
        __test.summon(key, cell);
      },
      [key, cell],
    );
    for (let k = 0; k < 80 && dists.some((d) => !reached(d)); k++) {
      await advance(pg, 0.15);
      const d = await lookAt(false);
      if (d === null) break;
      const want = dists.find((w) => !reached(w) && d <= w);
      if (want === undefined) continue;
      await reach(want);
      // 3m を写したら、照準を合わせた1枚も（同じ所で）
      if (!kill && want === 3 && !got.aim && (await lookAt(true)) !== null) await snap('aim');
    }
    if (dists.every((d) => reached(d))) break;
  }
  // 近づいて来なかった距離は、プレイヤーの方が、生き物から今の向きにその距離の床へ寄って写す（見回りを続ける生き物など）
  const walked = [];
  for (const d of dists) {
    if (reached(d)) continue;
    const ok = await pg.evaluate(
      ([key, d]) => {
        const m = __test.state().monsters.find((m) => m[0] === key),
          s = __test.state();
        if (!m) return false;
        const dx = s.pos[0] - m[1],
          dz = s.pos[1] - m[2],
          l = Math.hypot(dx, dz) || 1,
          x = m[1] + (dx / l) * d,
          z = m[2] + (dz / l) * d,
          { w } = __test.size();
        if (!__test.cell(Math.floor(z / 2) * w + Math.floor(x / 2)).floor) return false;
        dbg.step(x, z);
        __test.advance(1 / 30);
        return true;
      },
      [key, d],
    );
    if (!ok || (await lookAt(false)) === null) continue;
    await reach(d);
    walked.push(`${d}m`);
    if (!kill && d === 3 && !got.aim && (await lookAt(true)) !== null) await snap('aim');
  }
  if (kill && got.before) console.log(`${prefix}：${killAt}m で倒した`);
  if (walked.length) console.log(`${prefix}：近づいて来ないので、プレイヤーが寄って写した（${walked.join('・')}）`);
  const missing = TAGS.filter((t) => !got[t]);
  if (missing.length) errs.push(`${prefix}：写せなかった（${missing.join('・')}。生き物がいないか、その距離に床が無い）`);
  if (pageErrs.length) errs.push(`${prefix}：${pageErrs.join(' / ')}`);
  await pg.close();
  return got;
}

/** 生き物の鍵ごとの体の大きさ（初めに写す今の版の、図鑑の一覧から） */
const scales = {};
/** 作業場所 root で組み立てたゲームで、全部の生き物と階を写す。返り値は [図鑑の名前][階] ごとの写真 */
async function shootAll(root, tag, errs) {
  const res = {};
  await withBrowser(
    async ({ browser, base }) => {
      // 名前を鍵にする（図鑑の一覧から。主・忘れられた獣は呼び出せないので除く）
      const pg = await newPage(browser, errs, { width: W, height: H, still: true });
      await openTest(pg, base);
      await advance(pg, 1);
      const list = await pg.evaluate(() => __test.gallery());
      await pg.close();
      if (typeof list === 'string') throw new Error(list);
      for (const want of names) {
        const e = list.find((x) => (x.name === want || x.key === want) && !String(x.key).includes(':'));
        if (!e) {
          errs.push(`図鑑に無い名前（主・忘れられた獣は pnpm lords）：${want}`);
          continue;
        }
        res[e.name] = [];
        // 体の大きさは、今の版の一覧の物を前の版（--rev）にも使う（前と今を同じ距離で倒す。前の版の一覧には scale が無いことがある）
        const scale = (scales[e.key] ??= e.scale ?? 1);
        for (const sc of scenes) {
          const prefix = join(outDir, `${e.name.replace(/[\\/:*?"<>|（）\s]/g, '_')}-${sc.depth}${tag}`);
          res[e.name].push(await shootScene(browser, base, { key: e.key, scale }, sc, prefix, errs));
          console.log(`${e.name} 深さ ${sc.depth}${tag ? `（${tag.slice(1)}）` : ''}：写した`);
        }
      }
    },
    { root },
  );
  return res;
}

/** 写す物の名前（列の順）。--kill の時は、倒す直前と、倒してからのフレーム数 */
const TAGS = kill ? ['before', ...kill.map((k) => `k${k}`)] : [...DISTS.map((d) => `${d}m`), 'aim'];
/**
 * 切り抜く枠。--kill の時は、倒した後は体が無く範囲を取れないので、倒す直前の体の範囲の正方形を 1.6 倍に広げる（床に散る文字も入るように）。
 * 広げる真ん中は、体の範囲の真ん中（cropRect が画面の端に寄せて動かした後の正方形の真ん中ではなく）
 */
const crop = (boxes) => {
  const r = cropRect(boxes, CLIP),
    bs = boxes.filter(Boolean);
  if (!kill) return r;
  const side = Math.round(Math.min(W, H, r.side * 1.6)),
    fit = (c, lim) => Math.round(Math.max(0, Math.min(lim - side, c - side / 2))),
    mid = (k0, k1, at) => (bs.length ? (Math.min(...bs.map((b) => b[k0])) + Math.max(...bs.map((b) => b[k1]))) / 2 : at);
  return { x: fit(mid('x0', 'x1', r.x + r.side / 2), W), y: fit(mid('y0', 'y1', r.y + r.side / 2), H), side };
};
const errs = [];
const now = await shootAll(ROOT, '', errs);
let old = null;
if (rev) {
  // src/ だけを前の版にした一時的な作業場所（tools/case-diff.mjs と同じ作り方）
  const tmp = mkdtempSync(join(tmpdir(), 'al-field-'));
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  try {
    git('worktree', 'add', '--detach', tmp, 'HEAD');
    rmSync(join(tmp, 'src'), { recursive: true, force: true });
    execFileSync('git', ['checkout', rev, '--', 'src'], { cwd: tmp, stdio: 'ignore' });
    symlinkSync(join(ROOT, 'node_modules'), join(tmp, 'node_modules'));
    old = await shootAll(tmp, '-old', errs);
  } finally {
    try {
      git('worktree', 'remove', '--force', tmp);
    } catch {
      rmSync(tmp, { recursive: true, force: true });
      git('worktree', 'prune');
    }
  }
}
for (const want of Object.keys(now)) {
  const rowsOf = (shots, boxesFrom) =>
    TAGS.map((t, c) => {
      const s = shots[t];
      return { file: s ? s.file : null, rect: crop(boxesFrom(t, c)) };
    });
  const rows = [];
  scenes.forEach((_, i) => {
    const n = now[want]?.[i] ?? {},
      o = old?.[want]?.[i];
    // 前と今は同じ枠で切り抜く（大きさの違いも見えるように）。--kill の時は、行の全部の列を、倒す直前の体の範囲で
    const boxes = (t) => (kill ? [n.before?.box, o?.before?.box] : [n[t]?.box, o?.[t]?.box]);
    if (o) rows.push(rowsOf(o, boxes));
    rows.push(rowsOf(n, boxes));
  });
  const file = join(outDir, `${want.replace(/[\\/:*?"<>|（）\s]/g, '_')}-${kill ? 'kill' : 'field'}.png`);
  writeSheet(rows, file);
  console.log(
    `${file}（列：${TAGS.join('・')}。行：${scenes.map((s) => `深さ ${s.depth}`).join('・')}${old ? '。階ごとに、上が前の版、下が今' : ''}）`,
  );
}
writeFileSync(join(outDir, kill ? 'summary-kill.json' : 'summary.json'), JSON.stringify({ scenes, rev, kill, now, old }, null, 2) + '\n');
if (errs.length) {
  console.log('うまくいかなかった物：', errs);
  process.exitCode = 1;
}
