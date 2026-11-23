import { withBrowser, newPage, openTest, advance, nearAltar } from './lib.mjs';
await withBrowser(async ({ browser, base }) => {
  const pg = await newPage(browser, [], { width: 1280, height: 720, still: true });
  await openTest(pg, base, 'seed=202&depth=3&god=1'); await advance(pg, 2); await nearAltar(pg); await advance(pg, 0.5);
  console.log(await pg.evaluate(() => {
    const el = document.getElementById('altarp'), x0 = el.getBoundingClientRect().left;
    const rng = document.createRange(), walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; const lines = [[]];
    while ((n = walk.nextNode())) for (let i = 0; i < n.data.length; i++) { if (n.data[i] === '\n') { lines.push([]); continue; } rng.setStart(n, i); rng.setEnd(n, i + 1); const b = rng.getBoundingClientRect(); lines.at(-1).push([n.data[i], b.left - x0, b.right - x0, n.parentElement.tagName + '.' + n.parentElement.className]); }
    return lines.map((l) => { const t = l.map((c) => c[0]).join(''); const i = t.lastIndexOf('|'); const p = l[i]; const q = l[1];
      return `${p ? p[2].toFixed(1) : '-'}  first|=${l[0] ? l[0][1].toFixed(1) : '-'} 2nd=${q ? q[1].toFixed(1) + ' ' + JSON.stringify(q[0]) : ''} ${p ? p[3] : ''}  ${t.slice(0, 40)}`; }).join('\n');
  }));
});
