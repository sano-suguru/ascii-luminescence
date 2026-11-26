#!/usr/bin/env node
// 指で遊ぶ時の土台（src/lib/touch.ts・src/lib/layout.ts）を、Playwright のスマホの真似（端末の名前で開く）で、テスト用モードで確かめる。
//   1. タイトルの枠が、どの端末でも画面に収まる（縮める下限 FIT_MIN まで縮めても収まらない時だけ、タイトルの画面の中で送る）
//   2. 指で「迷宮に入る」を押すと始まり、マウスを捕まえにいかない（マウスのドラッグの案内が出ない）
//   3. 描く画面を指で押しても、左手の詠唱が始まらない（ブラウザが後から出すマウスの事件を止めている）
//   4. タッチのボタン [装備] [メニュー] で、装備の画面とメニューを開け閉めできる。[全画面] は、全画面にできる時だけ出る
//   5. マウスを動かすと、指の遊び方が終わり、タッチのボタンが消える
//   6. 探索中のタッチのボタンが、左上の状態の表示とも、右上のミニマップとも重ならない（狭い横向きの端末でも）
import { FIT_MIN } from '../src/lib/layout.ts';
import { withBrowser, newPage, openTest, advance } from './lib.mjs';

const errs = [];
const HINT = 'マウスをドラッグして視点を動かせます';

const tapEnter = async (pg) => {
  await pg.locator('#enter').scrollIntoViewIfNeeded();
  const b = await pg.locator('#enter').boundingBox();
  if (!b) throw new Error('#enter が見えない');
  await pg.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
};
await withBrowser(async ({ browser, base }) => {
  // ---------------------------------------------------------------- 1. タイトルの枠が画面に収まる
  for (const device of ['iPhone SE', 'iPhone 13', 'Pixel 7', 'iPhone SE landscape', 'iPhone 13 landscape', 'Pixel 7 landscape']) {
    const pg = await newPage(browser, errs, { device });
    await openTest(pg, base, 'seed=202');
    await pg.evaluate(() => document.fonts.ready);
    const m = await pg.evaluate(() => {
      const it = document.getElementById('intro'),
        p = document.getElementById('intropanel');
      return { sw: it.scrollWidth, cw: it.clientWidth, sh: it.scrollHeight, ch: it.clientHeight, zoom: Number(p.style.zoom || 1) };
    });
    const fits = m.sw <= m.cw && m.sh <= m.ch;
    if (!fits && m.zoom > FIT_MIN + 1e-6)
      errs.push(`${device}：タイトルがはみ出しているのに、縮め切っていない（横 ${m.sw}/${m.cw}、縦 ${m.sh}/${m.ch}、倍率 ${m.zoom}）`);
    if (m.sw > m.cw) errs.push(`${device}：タイトルが横にはみ出す（${m.sw}/${m.cw}、倍率 ${m.zoom}）`);
    console.log(`${device}：倍率 ${m.zoom.toFixed(2)}、${fits ? '収まる' : `縦に送る（${m.sh}/${m.ch}）`}`);
    await pg.context().close();
  }

  // ---------------------------------------------------------------- 6. 探索中のタッチのボタンの場所
  for (const device of ['iPhone SE landscape', 'iPhone 13 landscape', 'Pixel 7 landscape']) {
    const pg = await newPage(browser, errs, { device });
    await openTest(pg, base, 'seed=202');
    await tapEnter(pg);
    await advance(pg, 3);
    const r = await pg.evaluate(() => {
      const q = (s) => document.querySelector(s).getBoundingClientRect();
      const bar = q('#touchbar'),
        hit = (o) => bar.left < o.right && o.left < bar.right && bar.top < o.bottom && o.top < bar.bottom;
      return { status: hit(q('#status')), map: hit(q('#mapwrap')), w: bar.width };
    });
    if (r.status || r.map) errs.push(`${device}：探索中のタッチのボタンが重なる（状態の表示 ${r.status}、ミニマップ ${r.map}）`);
    if (!(r.w > 0)) errs.push(`${device}：探索中のタッチのボタンが出ていない`);
    await pg.context().close();
  }

  // ---------------------------------------------------------------- 2〜5. 指で遊ぶ
  const pg = await newPage(browser, errs, { device: 'iPhone 13 landscape' });
  await openTest(pg, base, 'seed=202');
  const E = (f, a) => pg.evaluate(f, a);
  const center = async (sel) => {
    const b = await pg.locator(sel).boundingBox();
    if (!b) throw new Error(`${sel} が見えない`);
    return [b.x + b.width / 2, b.y + b.height / 2];
  };
  // 画面の外にあれば、そこまで送ってから押す（背の低い画面では、タイトルの「迷宮に入る」が下に隠れる）
  const tap = async (sel) => {
    await pg.locator(sel).scrollIntoViewIfNeeded();
    await pg.touchscreen.tap(...(await center(sel)));
  };
  const shown = (sel) => E((s) => getComputedStyle(document.querySelector(s)).display !== 'none' && !document.querySelector(s).hidden, sel);
  const view = () =>
    E(() => ({
      touch: document.body.classList.contains('touch'),
      started: __test.state().started,
      paused: __test.state().paused,
      cast: __test.state().cast,
      pack: document.getElementById('pack').classList.contains('show'),
      menu: document.getElementById('menu').classList.contains('show'),
      log: document.getElementById('log').innerText,
    }));

  if (await shown('#touchbar')) errs.push('指で触れる前から、タッチのボタンが出ている');
  // タイトルで指で触れると、全画面にできる時だけ [全画面] が出る
  await pg.touchscreen.tap(5, 5);
  const fsOk = await E(() => document.fullscreenEnabled);
  if ((await shown('#fsB')) !== fsOk) errs.push(`タイトルの [全画面] の出し分けが違う（全画面にできる ${fsOk}）`);
  await tapEnter(pg);
  await advance(pg, 2);
  let v = await view();
  if (!v.touch || !v.started) errs.push(`指で「迷宮に入る」を押しても、指の遊び方で始まらない（touch ${v.touch}、started ${v.started}）`);
  if (v.log.includes(HINT)) errs.push('指で遊んでいるのに、マウスのドラッグの案内が出た（マウスを捕まえにいった）');

  // 3. 描く画面を押しても詠唱しない（押したまま少し進めて、溜めが始まっていないか）
  const [W, H] = await E(() => [innerWidth, innerHeight]);
  await pg.touchscreen.tap(W / 2, H / 2);
  await advance(pg, 0.2);
  v = await view();
  if (v.cast) errs.push(`描く画面を指で押すと、詠唱が始まる（${JSON.stringify(v.cast)}）`);

  // 4. ボタン
  for (const sel of ['#packB', '#menuB']) if (!(await shown(sel))) errs.push(`探索中に ${sel} が出ていない`);
  if (await shown('#fsB')) errs.push('探索中に [全画面] が出ている（タイトルだけのはず）');
  await tap('#packB');
  await advance(pg, 0.1);
  v = await view();
  if (!v.pack || !v.paused) errs.push(`[装備] で装備の画面が開かない（pack ${v.pack}、paused ${v.paused}）`);
  await tap('#packB');
  await advance(pg, 0.1);
  v = await view();
  if (v.pack || v.paused) errs.push(`もう一度 [装備] を押しても、装備の画面が閉じない（pack ${v.pack}）`);
  await tap('#menuB');
  await advance(pg, 0.1);
  v = await view();
  if (!v.menu || !v.paused) errs.push(`[メニュー] でメニューが開かない（menu ${v.menu}、paused ${v.paused}）`);
  await tap('#menuB');
  await advance(pg, 0.1);
  v = await view();
  if (v.menu || v.paused) errs.push(`もう一度 [メニュー] を押しても、メニューが閉じない（menu ${v.menu}）`);
  // 装備の画面を開いたまま [メニュー]：装備の画面が閉じる（Esc と同じ）
  await tap('#packB');
  await tap('#menuB');
  await advance(pg, 0.1);
  v = await view();
  if (v.pack || v.menu) errs.push(`装備の画面で [メニュー] を押すと、装備の画面が閉じない（pack ${v.pack}、menu ${v.menu}）`);
  v = await view();
  if (v.log.includes(HINT)) errs.push('ボタンを押した後に、マウスのドラッグの案内が出た');

  // 5. マウスを動かすと戻る
  await pg.mouse.move(W / 3, H / 3);
  await pg.mouse.move(W / 3 + 10, H / 3 + 10);
  v = await view();
  if (v.touch) errs.push('マウスを動かしても、指の遊び方が終わらない');
  if (await shown('#touchbar')) errs.push('マウスを動かしても、タッチのボタンが消えない');
  await pg.context().close();
});
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
