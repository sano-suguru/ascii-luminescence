#!/usr/bin/env node
// 指で遊ぶ時の土台（src/lib/touch.ts・src/lib/layout.ts）を、Playwright のスマホの真似（端末の名前で開く）で、テスト用モードで確かめる。
//   1. タイトルの枠が、どの端末でも画面に収まる（縮める下限 FIT_MIN まで縮めても収まらない時だけ、タイトルの画面の中で送る）
//   2. 指で「迷宮に入る」を押すと始まり、マウスを捕まえにいかない（マウスのドラッグの案内が出ない）
//   3. 描く画面を指で押しても、左手の詠唱が始まらない（ブラウザが後から出すマウスの事件を止めている）。
//      iPhone（WebKit）は pointerdown の preventDefault でマウスの事件を止めないので、iPhone と同じ順番で事件を送っても確かめる
//      （指の pointerdown → pointerup → mousedown → mouseup → click。Chromium の真似の tap では、マウスの事件は出ない）。
//      止める時に mousedown を取り消さないか（タイトルのシードの入力欄に入れなくなるおそれ）も見る
//   4. タッチのボタン [装備] [メニュー] で、装備の画面とメニューを開け閉めできる。[全画面] は、全画面にできる時だけ出る
//   5. マウスを動かすと、指の遊び方が終わり、タッチのボタンが消える
//   6. 探索中のタッチのボタンが、左上の状態の表示とも、右上のミニマップとも重ならない（狭い横向きの端末でも）
//   7. 診断の記録（src/lib/diag.ts）：偽の window.claude（Artifact の中の真似）で、持ち主なら端末・できごと・速さを db に書き、持ち主でなければ書かない。
//      書き込みの途中に頼まれた分（ページが隠れた時）も、途中の分が終わってから書く
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
      projs: __test.state().projs,
      pack: document.getElementById('pack').classList.contains('show'),
      menu: document.getElementById('menu').classList.contains('show'),
      log: document.getElementById('log').innerText,
    }));

  if (await shown('#touchbar')) errs.push('指で触れる前から、タッチのボタンが出ている');
  // iPhone の順番で、指の後にタイトルのシードの入力欄へ来た mousedown を、取り消していないか（取り消すと、入力欄に入れなくなるおそれ）
  const seedOk = await E(() => {
    const el = document.getElementById('seedIn');
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }));
    return el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  });
  if (!seedOk) errs.push('指の後にシードの入力欄へ来た mousedown を取り消している（入力欄に入れなくなるおそれ）');
  // タイトルで指で触れると、全画面にできる時だけ [全画面] が出る
  await pg.touchscreen.tap(5, 5);
  const fsOk = await E(() => document.fullscreenEnabled);
  if ((await shown('#fsB')) !== fsOk) errs.push(`タイトルの [全画面] の出し分けが違う（全画面にできる ${fsOk}）`);
  await tapEnter(pg);
  await advance(pg, 2);
  let v = await view();
  if (!v.touch || !v.started) errs.push(`指で「迷宮に入る」を押しても、指の遊び方で始まらない（touch ${v.touch}、started ${v.started}）`);
  if (v.log.includes(HINT)) errs.push('指で遊んでいるのに、マウスのドラッグの案内が出た（マウスを捕まえにいった）');

  // 3. 描く画面を押しても詠唱しない（溜めが始まらず、飛ぶ物も増えない。左手の小剣は、押すとすぐ三日月の斬撃を飛ばす）
  const [W, H] = await E(() => [innerWidth, innerHeight]);
  const p0 = v.projs;
  await pg.touchscreen.tap(W / 2, H / 2);
  await advance(pg, 0.2);
  v = await view();
  if (v.cast || v.projs > p0) errs.push(`描く画面を指で押すと、詠唱が始まる（溜め ${JSON.stringify(v.cast)}、飛ぶ物 ${p0} → ${v.projs}）`);

  // 3'. iPhone と同じ順番の事件
  // up：false なら mousedown まで送って止める（押したままの間に、詠唱が始まっていないかを見るため）。後で iosUp で残りを送る
  const iosTap = (sel, up = true) =>
    E(
      ([s, up]) => {
        const el = document.querySelector(s),
          o = { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, pointerId: 7 };
        el.dispatchEvent(new PointerEvent('pointerdown', o));
        el.dispatchEvent(new PointerEvent('pointerup', o));
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
        if (!up) return;
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
        el.click();
      },
      [sel, up],
    );
  const iosUp = (sel) =>
    E((s) => document.querySelector(s).dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 })), sel);
  await advance(pg, 1);
  const p1 = (await view()).projs;
  await iosTap('#gl', false);
  await advance(pg, 0.2);
  v = await view();
  if (v.cast || v.projs > p1)
    errs.push(`iPhone の順番の事件で描く画面を押すと、詠唱が始まる（溜め ${JSON.stringify(v.cast)}、飛ぶ物 ${p1} → ${v.projs}）`);
  await iosUp('#gl');
  await advance(pg, 1);
  await iosTap('#packB');
  await advance(pg, 0.1);
  await iosTap('#menuB');
  await advance(pg, 0.1);
  v = await view();
  if (v.pack || v.menu)
    errs.push(`iPhone の順番の事件で、装備の画面で [メニュー] を押すと、装備の画面が閉じるだけでない（pack ${v.pack}、menu ${v.menu}）`);
  await iosTap('#menuB');
  await advance(pg, 0.1);
  v = await view();
  if (!v.menu) errs.push('iPhone の順番の事件で、[メニュー] でメニューが開かない');
  await iosTap('#menuB');
  await advance(pg, 0.1);

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

  // ---------------------------------------------------------------- 7. 診断の記録
  // 偽の window.claude：user は持ち主か（owner）を答え、db は書き込まれた物を window.__sets に貯める。
  // window.__hold が true の間は、書き込みを終わらせない（window.__release() で終わる。書き込みの途中を作るため）
  const fakeClaude = (owner) => {
    window.__sets = [];
    window.__hold = false;
    const waits = [];
    window.__release = () => {
      window.__hold = false;
      for (const f of waits.splice(0)) f();
    };
    const set = async (p, id, d) => {
      window.__sets.push({ p, id, d: JSON.parse(JSON.stringify(d)) });
      if (window.__hold) await new Promise((ok) => waits.push(ok));
    };
    window.claude = {
      use: async (n) =>
        n === 'user'
          ? { isOwner: async () => owner }
          : n === 'db'
            ? { collection: (p) => ({ doc: (id) => ({ set: (d) => set(p, id, d) }) }) }
            : null,
    };
  };
  const nextFrames = (p) => p.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  for (const owner of [true, false]) {
    const p = await newPage(browser, errs, { device: 'iPhone 13 landscape' });
    await p.addInitScript(fakeClaude, owner);
    await openTest(p, base, 'seed=202');
    await tapEnter(p);
    await advance(p, 2);
    // [装備] を2回（開いて閉じる）
    for (let k = 0; k < 2; k++) {
      const b = await p.locator('#packB').boundingBox();
      await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await advance(p, 1.5);
    }
    await nextFrames(p);
    await advance(p, 11);
    await nextFrames(p);
    const sets = await p.evaluate(() => window.__sets);
    if (!owner) {
      if (sets.length) errs.push(`診断の記録：持ち主でないのに書いた（${sets.length} 回）`);
    } else {
      const d = sets.at(-1)?.d,
        ev = (k, v) => d?.events.some((e) => e.k === k && (v === undefined || e.v === v));
      if (!d || sets.at(-1).p !== 'diag') errs.push(`診断の記録：持ち主なのに、diag に書いていない（${sets.length} 回）`);
      else {
        if (d.device.coarse !== true || !Array.isArray(d.device.view))
          errs.push(`診断の記録：端末のことが無い（${JSON.stringify(d.device).slice(0, 200)}）`);
        for (const [k, v] of [['open'], ['touch', true], ['started', true], ['pack', true], ['pack', false]])
          if (!ev(k, v)) errs.push(`診断の記録：できごと ${k}=${v} が無い（${JSON.stringify(d.events).slice(0, 300)}）`);
        if (!d.events.some((e) => e.k === 'press' && String(e.v).startsWith('packB'))) errs.push('診断の記録：[装備] を押したことが無い');
        if (!(d.fps.length >= 1 && d.fps[0].avg > 0)) errs.push(`診断の記録：速さが無い（${JSON.stringify(d.fps)}）`);
        console.log(`診断の記録：${sets.length} 回書いた。できごと ${d.events.length}、速さ ${JSON.stringify(d.fps[0])}`);
        // 書き込みの途中に、ページが隠れた（書くよう頼まれた）時：途中の分が終わってから、隠れたことも書く
        await p.evaluate(() => {
          window.__hold = true;
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); // 隠れた（テストのページは実際には隠れない）
          document.dispatchEvent(new Event('visibilitychange')); // ここで書き始め、__hold で止まる
        });
        const n1 = await p.evaluate(() => window.__sets.length);
        await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // 途中に頼む（書かずに待つ）
        const n2 = await p.evaluate(() => window.__sets.length);
        await p.evaluate(async () => {
          window.__release();
          for (let i = 0; i < 3; i++) await Promise.resolve();
          await new Promise((ok) => queueMicrotask(ok));
        });
        await advance(p, 0.1);
        const after = await p.evaluate(() => window.__sets);
        const visible = after.at(-1)?.d.events.filter((e) => e.k === 'visible').length ?? 0;
        if (!(n2 === n1 && after.length === n1 + 1 && visible >= 2))
          errs.push(`診断の記録：書き込みの途中に頼んだ分が、後で書かれない（${n1} → ${n2} → ${after.length}、見える／隠れた ${visible}）`);
      }
    }
    await p.context().close();
  }
});
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
