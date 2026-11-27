#!/usr/bin/env node
// 自動で遊ぶ（?auto。src/lib/auto.ts）のテスト：短い台本（?auto=quick）を、テスト用モードでなく（本物の時計で）流し、
// ページのエラーが無い・全部の段を通る・うまくいかなかった段が無い・診断の記録の欄 auto と、段の名前のできごとが書かれる・
// localStorage に何も書かない（死んだ時の伝承・視点・表示の切り替えなども）、を確かめる。
// 本物の時計で動くので、この環境（CPU で描くので遅い）では1分ほどかかる。待つのは、台本が終わるまで（最大 5 分）
import { withBrowser, newPage } from './lib.mjs';
import { fakeClaude, readDiag } from './page-fakes.mjs';

const errs = [];
await withBrowser(async ({ browser, base }) => {
  // 本物の端末（iPhone の横向き、claude.ai のアプリの中）と同じ大きさ
  const pg = await newPage(browser, errs, { width: 750, height: 312 });
  await pg.addInitScript(fakeClaude, true);
  // 前から残っている記録（自動で遊んでも変わらないはず）
  await pg.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('al_cam', 'fps');
    }
  });
  await pg.goto(`${base}?auto=quick`, { waitUntil: 'commit', timeout: 120000 });
  await pg.waitForSelector('#enter', { timeout: 90000 });
  const store0 = await pg.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  const t0 = Date.now();
  await pg.waitForFunction(() => document.getElementById('autobar')?.textContent?.includes('遊び終えた'), null, {
    timeout: 300000,
    polling: 500,
  });
  console.log(`台本が終わるまで ${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
  const rec = await readDiag(pg);
  const a = rec?.auto;
  if (!a) errs.push('診断の記録に auto の欄が無い');
  else {
    console.log(
      a.steps
        .map((s) => `${s.k} ${s.sec}秒 ${s.frames}フレーム 平均 ${s.avg}fps 最長 ${s.worst}ms${s.miss ? ` 違った：${s.miss}` : ''}`)
        .join('\n'),
    );
    if (!a.done || a.stop) errs.push(`台本が終わっていない（done ${a.done}・stop ${a.stop}）`);
    const ks = a.steps.map((s) => s.k).join(',');
    if (ks !== 'enter,walk,look,fight,stairs,menu,pack,die') errs.push(`通った段が ${ks}`);
    for (const s of a.steps) {
      if (s.miss) errs.push(`段 ${s.k}：${s.miss}`);
      if (!(s.frames > 0)) errs.push(`段 ${s.k}：フレームを数えていない`);
    }
    // できごとは新しい50件だけ残るので、終わりのほうの段を見る
    const ev = rec.events.filter((e) => e.k === 'auto').map((e) => e.v);
    if (!ev.includes('die') || !ev.includes('done')) errs.push(`段の名前のできごとが無い（${ev.join(',')}）`);
    // 自動の指の事件は、メニューの押し方に数えない
    if (rec.menu.length) errs.push(`自動で押したメニューを、人の押し方に数えた（${JSON.stringify(rec.menu)}）`);
  }
  const store1 = await pg.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  if (store1 !== store0) errs.push(`localStorage が変わった：${store0} → ${store1}`);
  await pg.close();
});
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
