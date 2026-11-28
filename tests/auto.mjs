#!/usr/bin/env node
// 自動で試す（?auto。src/lib/auto.ts）のテスト：短い台本（?auto=quick）を、テスト用モードでなく（本物の時計で）流し、
// ページのエラーが無い・全部の段を通る・うまくいかなかった段が無い・診断の記録の欄 auto と、段の名前のできごとが書かれる・
// ゲームの保存（al_ で始まる名前）を localStorage に書かない（死んだ時の伝承・表示の切り替えなども）・ほかの名前は書ける、を確かめる。
// 流している途中に、レベルアップの画面を開かせ（開発用モードの dbg.exp。1つ目を選んで進むか）、ページが25秒隠れたことにする（時計を進めて真似る。隠れていた間を、
// 戻った最初のフレームの長さに数えないか）。もう1つのページでは、歩いている途中で［止める］を押し、台本の指が離れるか（スティックが消えるか）を見る。
// 本物の時計で動くので、この環境（CPU で描くので遅い）では2分ほどかかる。待つのは、台本が終わるまで（最大 5 分）
import { withBrowser, newPage } from './lib.mjs';
import { fakeClaude, readDiag } from './page-fakes.mjs';

const errs = [];
await withBrowser(async ({ browser, base }) => {
  // 本物の端末（iPhone の横向き、claude.ai のアプリの中）と同じ大きさ
  const pg = await newPage(browser, errs, { width: 750, height: 312 });
  await pg.addInitScript(fakeClaude, true);
  // 前から残っている記録（自動で試しても変わらないはず）
  await pg.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      // 開発用モード（途中でレベルアップさせる dbg.exp のため。自動で試す間も、オンにはしない）
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
  // 見回している間に、25秒隠れたことにする（ふつうのフレームより十分長く。CI のランナーで3つ同時に走ると、ふつうのフレームも9秒ほどかかることがある）
  await at('look');
  // （本物の端末では、隠れている間はフレームが来ない。それを真似て、隠れたことを知らせ、フレームを挟まずに performance.now を25秒進め、戻ったことを知らせる。
  // 台本はフレームの長さを performance.now で測るので、戻った最初のフレームの長さに25秒が入る。本当に25秒待たないのは、同時に走るほかのテストの CPU を取らないため。
  // 本物の端末でも、隠れていた間に performance.now は進むので、進めた時計は戻さない（戻すと、時計が逆に進む）。
  // ゲームの時計（rAF の時刻）は進まないが、ここで確かめるのは台本の数え方だけ）
  await pg.evaluate(() => {
    const vis = (v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    vis('hidden');
    const now = performance.now.bind(performance);
    performance.now = () => now() + 25000;
    vis('visible');
    delete document.visibilityState;
    delete document.hidden;
  });
  await pg.waitForFunction(() => document.getElementById('autobar')?.textContent?.includes('試し終えた'), null, {
    timeout: 300000,
    polling: 500,
  });
  console.log(`台本が終わるまで ${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
  // 終わった印は、10秒ごとの書き込みを待たずに、その場で書く（終わってすぐページを閉じても残るように）。readDiag で書かせる前に、書いた物を見る。
  // 実時間では比べない（CI では1フレームに数秒かかることがある）。終わった印を書いた最初の記録で、終わったできごとの時刻と書いた時刻（どちらも記録の時計）を比べる
  // （その場で書けば同じ見回りの中なので同じ。10秒ごとの書き込みまで待つと、たいてい離れる）
  const doneGap = await pg
    .waitForFunction(
      () => {
        const x = (window.__sets || []).find((x) => x.d?.auto?.done)?.d;
        const ev = x?.events.findLast((e) => e.k === 'auto' && e.v === 'done');
        return x && ev ? { gap: x.saved - ev.t } : null; // 0 は偽なので、オブジェクトで返す
      },
      null,
      { timeout: 60000, polling: 200 },
    )
    .then(async (h) => (await h.jsonValue()).gap)
    .catch(() => null);
  if (doneGap === null || doneGap > 0.2)
    errs.push(`自動で試し終えたのに、終わった印をすぐ書いていない（終わってから書くまで ${doneGap} 秒）`);
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
    const look = a.steps.find((s) => s.k === 'look'),
      // 開かせたのは歩く段の間だが、遅い時は、画面が開く前に次の段に移ることがあるので、どの段で閉じてもよい
      shut = a.steps.reduce((n, s) => n + (s.shut ?? 0), 0);
    if (!(shut >= 1)) errs.push(`レベルアップの画面を閉じていない（${JSON.stringify(a.steps)}）`);
    if (look?.waited !== 'hidden' || !(look.worst < 20000)) errs.push(`隠れていた間を、フレームの長さに数えた（${JSON.stringify(look)}）`);
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

  // タイトルの［自動で試す］：持ち主なら、持ち主と分かった後に［開発用モード］の真下に出て、押すと始まる（URL に ?auto は付けない。claude.ai はリンクの ?auto をゲームのページに渡さないため）。
  // ［止める］：歩いている途中で押すと、台本が置いた指を離す（スティックが消え、記録は「止めた」）
  const st = await newPage(browser, errs, { width: 750, height: 312 });
  await st.addInitScript(fakeClaude, true);
  await st.goto(base, { waitUntil: 'commit', timeout: 120000 });
  await st.waitForSelector('#intropanel #autoB', { timeout: 90000 });
  if (!(await st.evaluate(() => !!document.getElementById('galDev')))) errs.push('持ち主なのに、［開発用モード］が出ない');
  await st.click('#autoB');
  // 押すと、［自動で試す］と［開発用モード］は隠れる（流している間に開発用モードを変えると、台本の中身が変わるため）
  const left = await st.evaluate(() => ['autoB', 'galDev'].filter((id) => document.getElementById(id)));
  if (left.length) errs.push(`［自動で試す］を押した後も、開発用の物が出ている（${left.join('・')}）`);
  await st.waitForFunction(() => document.getElementById('autobar')?.textContent?.includes('・walk'), null, {
    timeout: 300000,
    polling: 100,
  });
  await st.waitForFunction(() => !document.getElementById('stick').hidden, null, { timeout: 60000, polling: 100 });
  await st.click('#autoStop');
  await st.waitForFunction(() => document.getElementById('autobar')?.textContent?.includes('試し終えた'), null, {
    timeout: 120000,
    polling: 200,
  });
  const stopped = await st.evaluate(() => ({ stick: document.getElementById('stick').hidden }));
  const sr = (await readDiag(st))?.auto;
  if (!stopped.stick) errs.push('［止める］の後も、台本のスティックが出たまま（指が離れていない）');
  if (sr?.stop !== '止めた') errs.push(`［止める］の記録が ${sr?.stop}`);
  if (sr?.laps !== 3 || sr?.quick) errs.push(`［自動で試す］の周の数が ${sr?.laps}（3 のはず）`);
  if (sr?.dev !== false || sr?.depth !== 1)
    errs.push(`［自動で試す］の記録の開発用モードと始める深さが ${sr?.dev}・${sr?.depth}（false・1 のはず）`);
  await st.close();

  // 共有された Artifact を持ち主でない人が開いた時は、［自動で試す］も［開発用モード］も出ない（遊ぶ人に開発用の物を見せない）
  const guest = await newPage(browser, errs, { width: 750, height: 312 });
  await guest.addInitScript(fakeClaude, false);
  await guest.goto(base, { waitUntil: 'commit', timeout: 120000 });
  await guest.waitForSelector('#enter', { timeout: 90000 });
  // 持ち主かの答えが出てから見る（答えが出る前に見ると、出ていなくて当たり前になる）。ゲームの用意ができた時の描き直しも待つ
  // （テスト用モードでないので、用意ができた印は無い。答えの後に描いたフレームを2つと、1秒）
  await guest.evaluate(async () => {
    await (await window.claude.use('user')).isOwner();
    for (let n = 0; n < 2; n++) await new Promise((ok) => requestAnimationFrame(ok));
  });
  await new Promise((ok) => setTimeout(ok, 1000));
  const shown = await guest.evaluate(() => ['autoB', 'galDev'].filter((id) => document.getElementById(id)));
  if (shown.length) errs.push(`持ち主でないのに、開発用の物が出た（${shown.join('・')}）`);
  await guest.close();
});
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
