#!/usr/bin/env node
// 水の中に立つ何体かの敵の1体に雷を当て、ほかの敵へ伝わるところを、時間を追って写す（テスト版を組み立てて、テスト用モードで）。
// 雷が水を伝わる見た目（src/lib/combat.ts の conductWater・chainLightning と、src/lib/fx.ts の描き方）を直す時に使う。
//   pnpm zap                        既定（蛇の穴の水場、シード202。ゴブリンを4体）
//   pnpm zap ゴブリン               生き物を図鑑の名前（表の鍵でもよい）で選ぶ
//   --scene 4:202                   写す階（深さ:シード。URL の指定そのもの seed=202&branch=snake でもよい）
//   --n 4                           水の中に置く数（当てる1体を含む。2〜7）
//   --dry                           水の外にも1体置く（雷は跳ぶが、水を伝わらない物）
//   --weapon bolt                   右手の武器（RUNE_DEF の攻撃の鍵）。性質は雷にする
//   --frames 18                     当たった後に写すフレームの数（1フレーム＝ゲームの1/30秒）
//   --views eye,high,side           写す見え方（eye：目の高さ・high：真上に近い高い所・side：プレイヤーから見て横の、目の高さ。見え方ごとに自分のページで同じ場面を作る）
//   --hud                           画面に重ねた表示（状態・ミニマップ・伝言・矢印など）も写す（ふだんは隠す）
//   --hide particles,…              tick の段（src/lib/loop.ts の inPhase の名前）を止めて写す（何が光っているかの切り分けに。__test.skipPhase。稲妻の段 bolt は、遅れて当たる処理も止まる）
//   --rev <版>                      前の版（git の版。例 origin/main）とも同じ場面・同じカメラで写し、6枚ごとに前（上）と今（下）を並べる（src/ と組み立てを前の版にした一時的な作業場所で。tools/field.mjs と同じ）
//   --out <ディレクトリ>            置き場所（既定 tests/out/zap/）
// 写す物：水のマスが固まっている所を探し、当てる1体と、そのまわり 1.6〜4.5 の水のマスに残りを置いて止め（__test.hold）、3.5〜5.5 離れた床から照準を合わせる。
// 目の高さ（eye）と、__test.cam で置いたカメラ（high・side）で、当てる前の1枚と、当たったフレームから --frames 枚を写す
// （テスト用モードなので、2通りとも同じ場面になる）。写真は <見え方>[-old]-<before|hNN>.png（画面全体）と、体のまわりを切り抜いて時間の順に並べた
// <見え方>.png（行ごとに6枚）。数は summary.json：フレームごとの、置いた生き物の体力と、稲妻の数（__test.traces の bolts）。
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
    `${why}\n使い方：pnpm zap [名前] [--scene 4:202] [--n 4] [--dry] [--weapon bolt] [--frames 18] [--views eye,high,side] [--hide 段,…] [--hud] [--rev <版>] [--out <ディレクトリ>]`,
  );
  process.exit(1);
};
const opt = (k) => {
  const v = arg(k, null);
  if (argv.includes(k) && (!v || v.startsWith('--'))) usage(`${k} の後に値を書いてください`);
  return v;
};
const outDir = resolve(opt('--out') ?? join(OUT, 'zap'));
const scene = opt('--scene') ?? 'seed=202&branch=snake',
  [depth, seed] = scene.split(':').map(Number);
// 深さ:シードか、URL の指定そのもの（例：seed=202&branch=snake）
const query = scene.includes('=') ? scene : `seed=${seed}&depth=${depth}`;
if (!scene.includes('=') && !(depth >= 1 && depth <= 13 && seed >= 0))
  usage('--scene は 深さ:シード（深さは 1 から 13）か、URL の指定（seed=202&branch=snake）');
const count = Number(opt('--n') ?? 4);
if (!(count >= 2 && count <= 7)) usage('--n は 2 から 7');
const after = Number(opt('--frames') ?? 18);
const weapon = opt('--weapon') ?? 'bolt';
const dry = argv.includes('--dry');
const views = (opt('--views') ?? 'eye,high,side').split(',');
if (!views.every((v) => ['eye', 'high', 'side'].includes(v))) usage('--views は eye・high・side から');
const hud = argv.includes('--hud');
const hide = opt('--hide')?.split(',').filter(Boolean) ?? [];
const rev = opt('--rev');
const VALUED = new Set(['--out', '--scene', '--n', '--weapon', '--frames', '--views', '--hide', '--rev']);
const want = argv.find((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1] ?? '')) ?? 'ゴブリン';
const hit = Object.entries(MTYPES).filter(([k, t]) => !t.dummy && (k === want || t.name === want));
if (hit.length !== 1) usage(`表に無い名前：${want}`);
const key = hit[0][0];
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.png')) rmSync(join(outDir, f));

const errs = [];
/** 作業場所 root で組み立てたゲームで、見え方ごとに写す（suffix は写真の名前の後ろ。前の版は '-old'）。見え方ごとの {setup, rows（写真と体力と稲妻の数）, boxes} を返す */
async function shootAll(root, suffix) {
  const got = {};
  await withBrowser(
    async ({ browser, base }) => {
      for (const view of views) {
        const pageErrs = [];
        const pg = await newPage(browser, pageErrs, { width: W, height: H, still: true });
        await openTest(pg, base, `${query}&god=1`);
        // 画面に重ねた表示（状態・ミニマップ・伝言・矢印など）を隠す（--hud で残す）
        if (!hud) await pg.addStyleTag({ content: 'body > :not(#gl) { visibility: hidden !important; }' });
        if (hide.length) {
          const got = await pg.evaluate((h) => __test.skipPhase(h), hide);
          // 前の版（--rev）の作業場所を片付けられるように、止めずに例外にする
          if (got.join() !== hide.join()) throw new Error(`止められない段がある（${hide.join('・')} → ${got.join('・')}）`);
        }
        await advance(pg, 2);
        const s = await waterScene(pg, { key, count, dry, weapon });
        if (s.err) {
          errs.push(`${view}${suffix}：${s.err}`);
          await pg.close();
          continue;
        }
        await advance(pg, 0.5);
        try {
          await aimAt(pg, key);
        } catch (e) {
          errs.push(`${view}${suffix}：${e.message}`);
          await pg.close();
          continue;
        }
        if (view !== 'eye') {
          const placed = await sceneCam(pg, s, view);
          if (!placed) errs.push(`${view}${suffix}：カメラを置けない（目の高さで写す）`);
          else console.log(`${view}：カメラ ${placed.pos.map((v) => v.toFixed(1)).join(',')}`);
        }
        const rows = [];
        const snap = async (tag) => {
          const file = join(outDir, `${view}${suffix}-${tag}.png`);
          await pg.screenshot({ path: file, timeout: 90000 });
          const st = await pg.evaluate(() => {
            const s = __test.state();
            return { hp: s.monsters.map((m) => m[3]), bolts: __test.traces().bolts ?? null, time: +s.time.toFixed(3) };
          });
          rows.push({ tag, file, ...st });
        };
        // 切り抜く範囲：置いた所の足元と、頭の上 1.2 の画面の位置を、全部含む範囲（前の版には __test.project が無いので、今の版の範囲を使う）
        const boxes = await pg.evaluate((s) => {
          if (!__test.project) return null;
          const p = __test
            .project(
              s.cells.flatMap(([x, z]) => [
                [x, 0, z],
                [x, 1.2, z],
              ]),
            )
            .filter(Boolean);
          if (!p.length) return null;
          const xs = p.map((q) => q[0]),
            ys = p.map((q) => q[1]);
          return [{ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }];
        }, s);
        await frames(pg, 1);
        await snap('before');
        try {
          await strike(pg, 'R', key);
        } catch (e) {
          errs.push(`${view}${suffix}：${e.message}`);
          await pg.close();
          continue;
        }
        for (let k = 0; k <= after; k++) {
          await frames(pg, 1);
          await snap(`h${String(k).padStart(2, '0')}`);
        }
        if (pageErrs.length) errs.push(`${view}${suffix}：${pageErrs.join(' / ')}`);
        await pg.close();
        got[view] = { setup: s, rows, boxes };
      }
    },
    { root },
  );
  return got;
}

const now = await shootAll(ROOT, '');
let old = null;
if (rev) {
  // src/ と組み立て（vite.config.mjs と、それが読む tools/）を前の版にした一時的な作業場所（tools/field.mjs の --rev と同じ）
  const tmp = mkdtempSync(join(tmpdir(), 'al-zap-'));
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  try {
    git('worktree', 'add', '--detach', tmp, 'HEAD');
    rmSync(join(tmp, 'src'), { recursive: true, force: true });
    execFileSync('git', ['checkout', rev, '--', 'src', 'vite.config.mjs', 'tools'], { cwd: tmp, stdio: 'ignore' });
    symlinkSync(join(ROOT, 'node_modules'), join(tmp, 'node_modules'));
    old = await shootAll(tmp, '-old');
  } finally {
    // 消す前にリンクを外す（リンクを残したまま worktree remove --force で消すと、リンクの先の node_modules まで消えることがある）
    rmSync(join(tmp, 'node_modules'), { force: true });
    try {
      git('worktree', 'remove', '--force', tmp);
    } catch {
      rmSync(tmp, { recursive: true, force: true });
      git('worktree', 'prune');
    }
  }
}
const result = { query, key, weapon, rev, views: {} };
for (const view of views) {
  const g = now[view];
  if (!g) continue;
  const rect = g.boxes ? cropRect(g.boxes, CLIP) : { x: 0, y: 0, side: H },
    per = 6,
    sheet = [];
  const o = old?.[view];
  for (let i = 0; i < g.rows.length; i += per) {
    // --rev の時は、前の版の行を今の版の行の上に置く（同じフレーム・同じ枠）
    if (o) sheet.push(o.rows.slice(i, i + per).map((r) => ({ file: r.file, rect })));
    sheet.push(g.rows.slice(i, i + per).map((r) => ({ file: r.file, rect })));
  }
  writeSheet(sheet, join(outDir, `${view}.png`), 320);
  result.views[view] = {
    setup: g.setup,
    rows: g.rows.map(({ file, ...r }) => r),
    ...(o ? { old: o.rows.map(({ file, ...r }) => r) } : {}),
  };
  console.log(`${view}：${join(outDir, `${view}.png`)}${o ? '（6枚ごとに、上が前の版・下が今）' : ''}`);
  for (const [k, r] of g.rows.entries())
    console.log(
      `  ${r.tag.padEnd(6)} 体力 ${r.hp.join(' ')}  稲妻 ${r.bolts}${o?.rows[k] ? `   前：体力 ${o.rows[k].hp.join(' ')}  稲妻 ${o.rows[k].bolts}` : ''}`,
    );
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
if (errs.length) {
  console.log('うまくいかなかった物：', errs);
  process.exitCode = 1;
}
