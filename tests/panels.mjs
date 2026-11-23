#!/usr/bin/env node
// 枠のテスト：パネルの枠（boxText）は、visW で文字の幅を数えて右の縦線を揃えている。
//   1. ゲームの文言に出る全部の文字を、パネルのフォントで描いて幅を測り、visW の数え方と一致するか
//      （ルーン文字は、パネルと同じく <b class="rn"> の中で測る）
//   2. 実際の画面（操作・装備・メニュー・レベルアップ・祭壇・結果）で、右の縦線が全部の行で同じ位置にあるか
//      レベルアップと祭壇は、一覧の見出しの後ろの名前の列も揃っているか
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withBrowser, newPage, openTest, advance, nearAltar, ROOT } from './lib.mjs';

const src = readFileSync(join(ROOT, 'src/game.js'), 'utf8');
const chars = [...new Set([...src].filter((c) => c.codePointAt(0) >= 0x20 && c !== '\u007f'))].sort();
const errs = [];
let fails = 0;
await withBrowser(async ({ browser, base }) => {
  let pg = await newPage(browser, errs, { width: 1280, height: 720, still: true });
  const pgSwap = (p) => { pg = p; };
  await openTest(pg, base, 'seed=202&depth=1&god=1');
  await advance(pg, 2);
  await pg.evaluate(() => document.fonts.ready);

  // 1. 文字ごとの幅
  const bad = await pg.evaluate(async (chars) => {
    const box = document.createElement('pre'); box.id = 'pack'; box.className = 'show';
    box.style.cssText = 'position:fixed;left:0;top:0;transform:none;visibility:hidden';
    document.body.appendChild(box);
    // ルーン文字は、ゲームと同じく1文字ずつ <b class="rn">（CSS で幅が1マスに固定）に入れる
    const wrap = (c) => /[ᚠ-᛿]/.test(c) ? `<span>${`<b class="rn">${c}</b>`.repeat(8)}</span>` : `<span>${c.repeat(8)}</span>`;
    box.innerHTML = `<span>${'0'.repeat(40)}</span>` + chars.map((c) => wrap(c.replace('&', '&amp;').replace('<', '&lt;'))).join('');
    // 使うフォントを先に読み込む（描く時まで読み込まれないので、すぐ測ると幅が違う）
    const runes = chars.filter((c) => /[\u16a0-\u16ff]/.test(c)).join(''), rest = chars.filter((c) => !/[\u16a0-\u16ff]/.test(c)).join('');
    const fam = getComputedStyle(box).fontFamily, runeFam = getComputedStyle(box.querySelector('.rn') || box).fontFamily;
    await Promise.all([400, 600, 700].map((w) => document.fonts.load(`${w} 14px ${fam}`, rest)).concat([document.fonts.load(`500 14px ${runeFam}`, runes)]));
    await document.fonts.ready;
    const spans = [...box.children], cw = spans[0].getBoundingClientRect().width / 40, out = [];
    chars.forEach((c, i) => { const w = spans[i + 1].getBoundingClientRect().width / 8 / cw, n = __test.width(c);
      if (Math.abs(w - n) > 0.05) out.push(`${c} U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}：数え方 ${n}、実際 ${w.toFixed(2)}`); });
    box.remove();
    return out;
  }, chars);
  if (bad.length) { fails += bad.length; console.log(`✗ visW と実際の幅が違う文字（${bad.length}）：\n  ${bad.join('\n  ')}`); }
  else console.log(`✓ ${chars.length} 文字、すべて visW の数え方どおりの幅`);

  // 2. 実際の画面で、右の縦線が揃うか
  // パネルのフォントは、文字の範囲ごとのファイルを使う時に読む。読み終わる前は代わりのフォントで描かれて幅が違うので、待ってから測る
  const fontsSettled = (id) => pg.evaluate(async (id) => { void document.getElementById(id).offsetWidth; await document.fonts.ready; }, id);
  const rightEdges = async (id) => { await fontsSettled(id); return pg.evaluate((id) => {
    const el = document.getElementById(id), rng = document.createRange(), lines = [[]];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = walk.nextNode())) for (let i = 0; i < n.data.length; i++) {
      if (n.data[i] === '\n') { lines.push([]); continue; }
      rng.setStart(n, i); rng.setEnd(n, i + 1); const b = rng.getBoundingClientRect(); lines.at(-1).push([n.data[i], b.right]); }
    return lines.filter((l) => l.length).map((l) => { const t = l.map((c) => c[0]).join('').trimEnd(), last = [...l].reverse().find((c) => c[0] !== ' ');
      return { text: t, end: last[1], frame: /[|+]$/.test(t) }; }).filter((l) => l.frame);
  }, id); };
  // 一覧の行（button.ao）で、見出しの後ろの名前が始まる位置
  const columns = (id) => pg.evaluate((id) => [...document.getElementById(id).querySelectorAll('button.ao')].map((b) => {
    const t = b.textContent, m = t.match(/^(\s*\S+\s+)\S/); if (!m) return null;
    const rng = document.createRange(), walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n, at = m[1].length;
    while ((n = walk.nextNode())) { if (at < n.data.length) { rng.setStart(n, at); rng.setEnd(n, at + 1); return { text: t.trim(), x: rng.getBoundingClientRect().left }; } at -= n.data.length; }
    return null;
  }).filter(Boolean), id);
  const check = async (name, id, { column = false } = {}) => {
    const ls = await rightEdges(id);
    if (!ls.length) { fails++; console.log(`✗ ${name}：枠が見つからない`); return; }
    const ref = ls[ls.length - 1].end, off = ls.filter((l) => Math.abs(l.end - ref) > 1);
    if (off.length) { fails++; console.log(`✗ ${name}：右の縦線がずれている行（${off.length}）：\n  ${off.map((l) => `${(l.end - ref).toFixed(1)}px  ${l.text.slice(0, 50)}`).join('\n  ')}`); }
    else console.log(`✓ ${name}：${ls.length} 行の右の縦線が揃っている`);
    if (!column) return;
    const cs = await columns(id);
    if (cs.length < 2) { fails++; console.log(`✗ ${name}：一覧の行が見つからない（${cs.length}）`); return; }
    const x0 = cs[0].x, bad = cs.filter((c) => Math.abs(c.x - x0) > 1);
    if (bad.length) { fails++; console.log(`✗ ${name}：名前の列がずれている行（${bad.length}）：\n  ${bad.map((c) => `${(c.x - x0).toFixed(1)}px  ${c.text.slice(0, 40)}`).join('\n  ')}`); }
    else console.log(`✓ ${name}：${cs.length} 行の名前の列が揃っている`);
  };
  await check('操作', 'help');
  await pg.evaluate(() => { dbg.give('runes'); dbg.give('slot'); dbg.give('body'); });
  await advance(pg, 0.5);
  await pg.keyboard.press('Tab'); await advance(pg, 0.2);
  await check('装備', 'pack');
  await pg.keyboard.press('Tab'); await advance(pg, 0.2);
  await pg.keyboard.press('Escape'); await advance(pg, 0.2);
  await check('メニュー', 'menu');
  await pg.close();

  // レベルアップ：全部の加護を1段目にしてから上げる（2段目の「II」の印が出る）
  const open = async (q) => { const p = await newPage(browser, errs, { width: 1280, height: 720, still: true }); await openTest(p, base, q); await advance(p, 2); return p; };
  let p2 = await open('seed=202&depth=1&god=1');
  await p2.evaluate(() => { __test.bless(1); dbg.exp(60); }); await advance(p2, 0.3);
  pgSwap(p2); await check('レベルアップ', 'altarp', { column: true });
  await p2.close();
  // 祭壇
  p2 = await open('seed=202&depth=3&god=1');
  await nearAltar(p2); await advance(p2, 0.5);
  pgSwap(p2); await check('祭壇', 'altarp', { column: true });
  await p2.close();
  // 結果の画面（死んだ時）
  p2 = await open('seed=202&depth=1');
  await p2.evaluate(() => { dbg.hurt(999); }); await advance(p2, 3);
  pgSwap(p2); await check('結果（死んだ時）', 'death');
  await p2.close();
});
if (errs.length) console.log('page errors:', errs);
process.exit(fails || errs.length ? 1 : 0);
