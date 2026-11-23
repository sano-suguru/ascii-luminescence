#!/usr/bin/env node
// 全部の階を作るテスト：いくつかのシードで、本道・特別な階・支道・異界を生成だけして（描かない）確かめる。
//   - 生成で例外が出ない
//   - スタートから、階段・支道の入口・異界の門・戻りの階段・置かれた物まで歩いて行ける（決まりは tests/reach.mjs）
// 使い方：node tests/levels.mjs [--seeds 20] [--seed 202]
import { withBrowser, newPage, openTest, arg } from './lib.mjs';
import { reachPart, reachProblems, unpackReach } from './reach.mjs';

const seeds = arg('--seed')
  ? [Number(arg('--seed'))]
  : Array.from({ length: Number(arg('--seeds', 20)) }, (_, i) => (Math.imul(i + 1, 2654435761) >>> 0) % 1e9);

const errs = [];
const results = await withBrowser(async ({ browser, base }) => {
  const pg = await newPage(browser, errs, { width: 320, height: 180 });
  await openTest(pg, base);
  // 生成はブラウザで（ゲームの包み・特別な階の深さ・階のシードも本物のまま）、歩いて行けるかは Node で調べる（tests/reach.mjs）
  await pg.addScriptTag({ content: `window.__reachPart = ${reachPart.toString()};` });
  const out = { levels: 0, fails: [] };
  for (const seed of seeds) {
    const got = await pg.evaluate((seed) => {
      const reachPart = window.__reachPart;
      return __test.places().map((pl) => {
        try {
          const L = __test.gen(seed, pl);
          return { pl, place: L.place, final: L.final, L: reachPart(L) };
        } catch (e) {
          return { pl, error: String((e && e.stack) || e).slice(0, 300) };
        }
      });
    }, seed);
    for (const g of got) {
      out.levels++;
      if (g.error) {
        out.fails.push({ seed, pl: g.pl, error: g.error });
        continue;
      }
      const missing = reachProblems(unpackReach(g.L), g.final);
      if (missing.length) out.fails.push({ seed, pl: g.pl, place: g.place, missing });
    }
  }
  return out;
});
const how = (f) => {
  const p = f.pl;
  if (p.branch) return `?dev=1&seed=${f.seed}&branch=${p.branch}:${p.lvl}`;
  if (p.realm) return `?dev=1&seed=${f.seed}&depth=${p.depth}&realm=${p.realm}`;
  if (p.inter) return `?dev=1&seed=${f.seed} のあと dbg.inter('${p.inter}')`;
  return `?dev=1&seed=${f.seed}&depth=${p.depth}`;
};
for (const f of results.fails)
  console.log(`✗ ${f.place || JSON.stringify(f.pl)}  シード ${f.seed}：${f.error || f.missing.join('、')}\n    開き方：${how(f)}`);
console.log(`${seeds.length} シード、${results.levels} 階を生成。失敗 ${results.fails.length}`);
if (errs.length) console.log('page errors:', errs);
process.exit(results.fails.length || errs.length ? 1 : 0);
