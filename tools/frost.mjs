#!/usr/bin/env node
// 氷の武器で敵を凍えさせる場面と、水を凍らせる場面を、時間を追って写す（テスト版を組み立てて、テスト用モードで）。
// 凍る見た目（src/lib/combat.ts の applyElem の氷、src/lib/ground.ts の chillArea・updateFrozen、src/lib/fx.ts の drawFrozen、生き物の冷え st.chill の描き方）を直す時に使う。
//   pnpm frost                      既定（蛇の穴の水場、シード202。トロルを、床の上と水の中で）
//   pnpm frost ゴブリン             生き物を図鑑の名前（表の鍵でもよい）で選ぶ
//   --cases floor,water             写す場合（floor：水から離れた床に立つ物に当てる。water：水の中に立つ物に当て、まわりの水が凍って解けるまで）
//   --scene 4:202                   写す階（深さ:シード。URL の指定そのもの seed=202&branch=snake でもよい）
//   --n 1                           置く数（当てる1体を含む。1〜7。書かなければ floor は 1、water は 3）
//   --weapon bolt                   右手の武器（RUNE_DEF の攻撃の鍵）。性質は氷にする
//   --at 0,0.1,1,…                  当たってから写す時刻（ゲームの秒。書かなければ場合ごとの既定）
//   --views eye,high                写す見え方（eye：目の高さ・high：真上に近い高い所・side：横。tests/lib.mjs の sceneCam）
//   --hud                           画面に重ねた表示も写す（ふだんは隠す）
//   --hide particles,…              tick の段を止めて写す（__test.skipPhase）
//   --rev <版>                      前の版（例 origin/main）とも同じ場面・同じカメラで写し、6枚ごとに前（上）と今（下）を並べる（tools/zap.mjs と同じ）
//   --out <ディレクトリ>            置き場所（既定 tests/out/frost/）
// 写真は <場合>-<見え方>[-old]-<before|tNN.N>.png（画面全体）と、置いた所のまわりを切り抜いて時間の順に並べた <場合>-<見え方>.png（行ごとに6枚）。
// 数は summary.json：写した時刻ごとの、置いた生き物の体力と冷えの残りの秒（st.chill）と、凍らせた水のマスの数と残りの秒の範囲（__test.frozen）。
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { withBrowser, newPage, openTest, advance, frames, aimAt, strike, waterScene, sceneCam, arg, OUT, ROOT } from '../tests/lib.mjs';
import { cropRect, writeSheet } from './sheet.mjs';
import { MTYPES } from '../src/lib/creatures.ts';

const W = 960,
  H = 540,
  CLIP = { x: 0, y: 0, width: W, height: H };
const argv = process.argv.slice(2);
const usage = (why) => {
  console.log(
    `${why}\n使い方：pnpm frost [名前] [--cases floor,water] [--scene 4:202] [--n 1] [--weapon bolt] [--at 0,1,2] [--views eye,high,side] [--hide 段,…] [--hud] [--rev <版>] [--out <ディレクトリ>]`,
  );
  process.exit(1);
};
const opt = (k) => {
  const v = arg(k, null);
  if (argv.includes(k) && (!v || v.startsWith('--'))) usage(`${k} の後に値を書いてください`);
  return v;
};
const outDir = resolve(opt('--out') ?? join(OUT, 'frost'));
const scene = opt('--scene') ?? 'seed=202&branch=snake',
  [depth, seed] = scene.split(':').map(Number);
const query = scene.includes('=') ? scene : `seed=${seed}&depth=${depth}`;
if (!scene.includes('=') && !(depth >= 1 && depth <= 13 && seed >= 0))
  usage('--scene は 深さ:シード（深さは 1 から 13）か、URL の指定（seed=202&branch=snake）');
const cases = (opt('--cases') ?? 'floor,water').split(',');
if (!cases.every((c) => ['floor', 'water'].includes(c))) usage('--cases は floor・water から');
const nOpt = opt('--n');
if (nOpt !== null && !(Number(nOpt) >= 1 && Number(nOpt) <= 7)) usage('--n は 1 から 7');
// 場合ごとの既定の写す時刻：床は冷えが切れるまで（1回の当たりで 2.5 秒ほど）、水は凍らせた水が解けるまで（25 秒）
const AT = {
  floor: [0, 0.1, 0.3, 0.6, 1, 1.5, 2, 2.3, 2.6, 3, 3.5, 4.5],
  water: [0, 0.1, 0.3, 1, 2.5, 4, 6, 10, 15, 19, 20, 21, 22, 23, 24, 24.6, 25.2, 26.5],
};
const atOpt = opt('--at')?.split(',').map(Number);
if (atOpt && !atOpt.every((v, i) => v >= 0 && (i === 0 || v > atOpt[i - 1]))) usage('--at は 0 以上の、増えていく秒の並び');
const weapon = opt('--weapon') ?? 'bolt';
const views = (opt('--views') ?? 'eye,high').split(',');
if (!views.every((v) => ['eye', 'high', 'side'].includes(v))) usage('--views は eye・high・side から');
const hud = argv.includes('--hud');
const hide = opt('--hide')?.split(',').filter(Boolean) ?? [];
const rev = opt('--rev');
const VALUED = new Set(['--out', '--scene', '--n', '--weapon', '--at', '--views', '--hide', '--rev', '--cases']);
const want = argv.find((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1] ?? '')) ?? 'トロル';
const hit = Object.entries(MTYPES).filter(([k, t]) => !t.dummy && (k === want || t.name === want));
if (hit.length !== 1) usage(`表に無い名前：${want}`);
const key = hit[0][0];
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.png')) rmSync(join(outDir, f));

const errs = [];
/** 作業場所 root で組み立てたゲームで、場合と見え方ごとに写す（suffix は写真の名前の後ろ。前の版は '-old'） */
async function shootAll(root, suffix) {
  const got = {};
  await withBrowser(
    async ({ browser, base }) => {
      for (const kase of cases)
        for (const view of views) {
          const name = `${kase}-${view}`,
            fail = (why) => errs.push(`${name}${suffix}：${why}`);
          const pageErrs = [];
          const pg = await newPage(browser, pageErrs, { width: W, height: H, still: true });
          await openTest(pg, base, `${query}&god=1`);
          if (!hud) await pg.addStyleTag({ content: 'body > :not(#gl) { visibility: hidden !important; }' });
          if (hide.length) {
            const got = await pg.evaluate((h) => __test.skipPhase(h), hide);
            if (got.join() !== hide.join()) throw new Error(`止められない段がある（${hide.join('・')} → ${got.join('・')}）`);
          }
          await advance(pg, 2);
          const count = Number(nOpt ?? (kase === 'floor' ? 1 : 3));
          const s = await waterScene(pg, { key, count, dry: false, weapon, elem: 'ice', floor: kase === 'floor' });
          if (s.err) {
            fail(s.err);
            await pg.close();
            continue;
          }
          await advance(pg, 0.5);
          try {
            await aimAt(pg, key);
          } catch (e) {
            fail(e.message);
            await pg.close();
            continue;
          }
          if (view !== 'eye') {
            const placed = await sceneCam(pg, s, view);
            if (!placed) fail('カメラを置けない（目の高さで写す）');
          }
          // 切り抜く範囲：置いた所のまわり 1.6 の足元と、頭の上 1.6
          const boxes = await pg.evaluate((s) => {
            if (!__test.project) return null;
            const pts = s.cells.flatMap(([x, z]) =>
              [
                [-1.6, 0],
                [1.6, 0],
                [0, -1.6],
                [0, 1.6],
              ].flatMap(([dx, dz]) => [
                [x + dx, 0, z + dz],
                [x + dx, 1.6, z + dz],
              ]),
            );
            const p = __test.project(pts).filter(Boolean);
            if (!p.length) return null;
            const xs = p.map((q) => q[0]),
              ys = p.map((q) => q[1]);
            return [{ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }];
          }, s);
          const rows = [];
          const snap = async (tag) => {
            const file = join(outDir, `${name}${suffix}-${tag}.png`);
            await pg.screenshot({ path: file, timeout: 90000 });
            const st = await pg.evaluate(() => {
              const s = __test.state(),
                fz = __test.frozen ? __test.frozen() : [];
              return {
                time: +s.time.toFixed(3),
                hp: s.monsters.map((m) => m[3]),
                chill: s.monsters.map((_, n) => +(__test.mob(n)?.st?.chill ?? 0).toFixed(2)),
                frozen: fz.length,
                frozenT: fz.length ? [Math.min(...fz.map((f) => f.t)), Math.max(...fz.map((f) => f.t))].map((v) => +v.toFixed(2)) : null,
              };
            });
            rows.push({ tag, file, ...st });
          };
          await frames(pg, 1);
          await snap('before');
          let t0;
          try {
            await strike(pg, 'R', key);
            t0 = await pg.evaluate(() => __test.state().time);
          } catch (e) {
            fail(e.message);
            await pg.close();
            continue;
          }
          for (const at of atOpt ?? AT[kase]) {
            // 写す時刻の1フレーム前まで描かずに進め、1フレーム描いて写す
            const now = await pg.evaluate(() => __test.state().time);
            const wait = t0 + at - now - 1 / 30;
            if (wait > 0.001) await advance(pg, wait);
            await frames(pg, 1);
            await snap(`t${at.toFixed(1).padStart(4, '0')}`);
          }
          if (pageErrs.length) fail(pageErrs.join(' / '));
          await pg.close();
          got[name] = { setup: s, rows, boxes };
        }
    },
    { root },
  );
  return got;
}

const now = await shootAll(ROOT, '');
let old = null;
if (rev) {
  const tmp = mkdtempSync(join(tmpdir(), 'al-frost-'));
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  try {
    git('worktree', 'add', '--detach', tmp, 'HEAD');
    rmSync(join(tmp, 'src'), { recursive: true, force: true });
    // 前の版の src/ と組み立て。場面を作る道具（tests/lib.mjs）は今の物を使う
    execFileSync('git', ['checkout', rev, '--', 'src', 'vite.config.mjs', 'tools'], { cwd: tmp, stdio: 'ignore' });
    symlinkSync(join(ROOT, 'node_modules'), join(tmp, 'node_modules'));
    old = await shootAll(tmp, '-old');
  } finally {
    rmSync(join(tmp, 'node_modules'), { force: true });
    try {
      git('worktree', 'remove', '--force', tmp);
    } catch {
      rmSync(tmp, { recursive: true, force: true });
      git('worktree', 'prune');
    }
  }
}
const result = { query, key, weapon, rev, shots: {} };
for (const [name, g] of Object.entries(now)) {
  const rect = g.boxes ? cropRect(g.boxes, CLIP) : { x: 0, y: 0, side: H },
    per = 6,
    sheet = [];
  const o = old?.[name];
  for (let i = 0; i < g.rows.length; i += per) {
    if (o) sheet.push(o.rows.slice(i, i + per).map((r) => ({ file: r.file, rect })));
    sheet.push(g.rows.slice(i, i + per).map((r) => ({ file: r.file, rect })));
  }
  writeSheet(sheet, join(outDir, `${name}.png`), 320);
  result.shots[name] = {
    setup: g.setup,
    rows: g.rows.map(({ file, ...r }) => r),
    ...(o ? { old: o.rows.map(({ file, ...r }) => r) } : {}),
  };
  console.log(`${name}：${join(outDir, `${name}.png`)}${o ? '（6枚ごとに、上が前の版・下が今）' : ''}`);
  for (const r of g.rows)
    console.log(
      `  ${r.tag.padEnd(7)} 体力 ${r.hp.join(' ')}  冷え ${r.chill.join(' ')}  凍った水 ${r.frozen}${r.frozenT ? `（残り ${r.frozenT.join('〜')} 秒）` : ''}`,
    );
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
if (errs.length) {
  console.log('うまくいかなかった物：', errs);
  process.exitCode = 1;
}
