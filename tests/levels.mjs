#!/usr/bin/env node
// 全部の階を作るテスト：いくつかのシードで、本道・特別な階・支道・異界を生成だけして（描かない）確かめる。
//   - 生成で例外が出ない
//   - スタートから、階段・支道の入口・異界の門・戻りの階段・置かれた物まで歩いて行ける
//     （歩けるマス＝床で、深い水でも溶岩でもない。上下左右。ゲームの mainPathAltars の bfs と同じ決まり）
// 使い方：node tests/levels.mjs [--seeds 20] [--seed 202]
import { withBrowser, newPage, openTest, arg } from './lib.mjs';

const seeds = arg('--seed') ? [Number(arg('--seed'))] : Array.from({ length: Number(arg('--seeds', 20)) }, (_, i) => (Math.imul(i + 1, 2654435761) >>> 0) % 1e9);

const errs = [];
const results = await withBrowser(async ({ browser, base }) => {
  const pg = await newPage(browser, errs, { width: 320, height: 180 });
  await openTest(pg, base);
  return pg.evaluate((seeds) => {
    const W = 70; // MW
    const out = { levels: 0, fails: [] };
    for (const seed of seeds) for (const pl of __test.places()) {
      out.levels++;
      let L;
      try { L = __test.gen(seed, pl); } catch (e) { out.fails.push({ seed, pl, error: String(e && e.stack || e).slice(0, 300) }); continue; }
      const N = L.tile.length, ok = (i) => i >= 0 && i < N && L.tile[i] === 1 && L.liquid[i] !== 2 && L.liquid[i] !== 3;
      const d = new Int32Array(N).fill(-1), q = [L.start]; d[L.start] = 0;
      for (let h = 0; h < q.length; h++) { const c = q[h]; for (const o of [1, -1, W, -W]) { const j = c + o; if (ok(j) && d[j] < 0) { d[j] = d[c] + 1; q.push(j); } } }
      // 目印のマスそのものが歩けなくても（柱や台）、隣まで行ければよい
      const reach = (i) => d[i] >= 0 || [1, -1, W, -W].some((o) => d[i + o] >= 0);
      const goals = [];
      if (L.stairs >= 0) goals.push(['階段', L.stairs]);
      if (L.bstairs) goals.push(['支道の入口', L.bstairs.cell]);
      if (L.portal) goals.push(['異界の門', L.portal.cell]);
      if (L.upstairs >= 0) goals.push(['戻りの階段', L.upstairs]);
      for (const it of L.items) goals.push([`物（${it.kind}）`, it.i]);
      const missing = goals.filter(([, i]) => !reach(i)).map(([k, i]) => `${k} @${i % W},${(i / W) | 0}`);
      if (!ok(L.start)) missing.unshift('スタートが歩けないマス');
      if (L.stairs < 0 && !L.final && !L.bstairs) missing.push('階段が無い');
      if (missing.length) out.fails.push({ seed, pl, place: L.place, missing });
    }
    return out;
  }, seeds);
});
const how = (f) => {
  const p = f.pl;
  if (p.branch) return `?dev=1&seed=${f.seed}&branch=${p.branch}:${p.lvl}`;
  if (p.realm) return `?dev=1&seed=${f.seed}&depth=${p.depth}&realm=${p.realm}`;
  if (p.inter) return `?dev=1&seed=${f.seed} のあと dbg.inter('${p.inter}')`;
  return `?dev=1&seed=${f.seed}&depth=${p.depth}`;
};
for (const f of results.fails) console.log(`✗ ${f.place || JSON.stringify(f.pl)}  シード ${f.seed}：${f.error || f.missing.join('、')}\n    開き方：${how(f)}`);
console.log(`${seeds.length} シード、${results.levels} 階を生成。失敗 ${results.fails.length}`);
if (errs.length) console.log('page errors:', errs);
process.exit(results.fails.length || errs.length ? 1 : 0);
