#!/usr/bin/env node
// 自動で遊ぶ（?auto。src/lib/auto.ts）のテスト：短い台本（?auto=quick）を、テスト用モードでなく（本物の時計で）流し、
// ページのエラーが無い・全部の段を通る・うまくいかなかった段が無い・診断の記録の欄 auto と、段の名前のできごとが書かれる・
// ゲームの保存（al_ で始まる名前）を localStorage に書かない（死んだ時の伝承・視点・表示の切り替えなども）・ほかの名前は書ける、を確かめる。
// 流している途中に、レベルアップの画面を開かせ（開発用モードの dbg.exp。1つ目を選んで進むか）、ページが12秒隠れたことにする（隠れていた間を、
// 戻った最初のフレームの長さに数えないか）。もう1つのページでは、歩いている途中で［止める］を押し、台本の指が離れるか（スティックが消えるか）を見る。
// 本物の時計で動くので、この環境（CPU で描くので遅い）では2分ほどかかる。待つのは、台本が終わるまで（最大 5 分）
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
      // 開発用モード（途中でレベルアップさせる dbg.exp のため。自動で遊ぶ間も、オンにはしない）
      localStorage.setItem('al_dev', '1');
    }
  });
  await pg.goto(`${base}?auto=quick`, { waitUntil: 'commit', timeout: 120000 });
  await pg.waitForSelector('#enter', { timeout: 90000 });
  const store0 = await pg.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  const t0 = Date.now();
  const at = (step) =>
    pg.waitForFunction((k) => document.getElementById('autobar')?.textContent?.includes(`・${k}`), step, { timeout: 300000, polling: 100 });
  // 歩いている間に、レベルアップの画面を開かせる（ゲームが止まるので、閉じないと、ゲームの時刻で待つ所が終わらない）
  await at('walk');
  await pg.evaluate(() => dbg.exp(500));
  // 見回している間に、12秒隠れたことにする（ふつうのフレームより十分長く。CI のランナーで3つ同時に走ると、ふつうのフレームも7秒ほどかかることがある）
  await at('look');
  // （本物の端末では、隠れている間はフレームが来ない。それを真似て、隠れたことを知らせてから12秒フレームを止め、戻ったことを知らせる）
  await pg.evaluate(() => {
    const vis = (v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    vis('hidden');
    for (const t = performance.now(); performance.now() - t < 12000;);
    vis('visible');
    delete document.visibilityState;
    delete document.hidden;
  });
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
    const walk = a.steps.find((s) => s.k === 'walk'),
      look = a.steps.find((s) => s.k === 'look');
    if (!(walk?.shut >= 1)) errs.push(`レベルアップの画面を閉じていない（${JSON.stringify(walk)}）`);
    if (look?.waited !== 'hidden' || !(look.worst < 10000)) errs.push(`隠れていた間を、フレームの長さに数えた（${JSON.stringify(look)}）`);
    // できごとは新しい50件だけ残るので、終わりのほうの段を見る
    const ev = rec.events.filter((e) => e.k === 'auto').map((e) => e.v);
    // （終わったことは a.done で見る。'done' のできごとは、0.25秒ごとの見回りが書くので、読んだ時にはまだ無いことがある）
    if (!ev.includes('die')) errs.push(`段の名前のできごとが無い（${ev.join(',')}）`);
    // 自動の指の事件は、メニューの押し方に数えない
    if (rec.menu.length) errs.push(`自動で押したメニューを、人の押し方に数えた（${JSON.stringify(rec.menu)}）`);
  }
  const store1 = await pg.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  if (store1 !== store0) errs.push(`localStorage が変わった：${store0} → ${store1}`);
  // ゲームの物でない名前は書ける
  const other = await pg.evaluate(() => (localStorage.setItem('x-other', '1'), localStorage.getItem('x-other')));
  if (other !== '1') errs.push('ゲームの物でない名前まで、localStorage に書けない');
  await pg.close();

  // ［止める］：歩いている途中で押すと、台本が置いた指を離す（スティックが消え、記録は「止めた」）
  const st = await newPage(browser, errs, { width: 750, height: 312 });
  await st.addInitScript(fakeClaude, true);
  await st.goto(`${base}?auto=quick`, { waitUntil: 'commit', timeout: 120000 });
  await st.waitForFunction(() => document.getElementById('autobar')?.textContent?.includes('・walk'), null, {
    timeout: 300000,
    polling: 100,
  });
  await st.waitForFunction(() => !document.getElementById('stick').hidden, null, { timeout: 60000, polling: 100 });
  await st.click('#autoStop');
  await st.waitForFunction(() => document.getElementById('autobar')?.textContent?.includes('遊び終えた'), null, {
    timeout: 120000,
    polling: 200,
  });
  const stopped = await st.evaluate(() => ({ stick: document.getElementById('stick').hidden }));
  const sr = (await readDiag(st))?.auto;
  if (!stopped.stick) errs.push('［止める］の後も、台本のスティックが出たまま（指が離れていない）');
  if (sr?.stop !== '止めた') errs.push(`［止める］の記録が ${sr?.stop}`);
  await st.close();
});
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
