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
//   6. 探索中のタッチのボタンと指の操作のボタンが、左上の状態の表示・右上のミニマップ・下の HUD・互いと重ならない
//      （狭い横向きの端末と、claude.ai のアプリの中で測った本物の大きさ 750×312）
//   8. 指の操作（src/lib/touchpad.ts。CDP の Input.dispatchTouchEvent で、2本の指を同時に動かす）：左半分のスティックで進む（離すと止まる）・右半分のドラッグで見回す・
//      両方を同時に・[右手] を押して溜め、指をずらすと見回し、離すと溜めが終わる・指を取り逃した時（touchCancel）も溜めが終わる・[回避]・
//      メニューを開いている間は、スティックで動かない・レベルアップと祭壇の画面は、1回目のタップで選んで説明を出し、2回目で決める
//   7. 診断の記録（src/lib/diag.ts）：偽の window.claude（Artifact の中の真似）で、持ち主なら端末・できごと・速さを db に書き、持ち主でなければ書かない。
//      書き込みの途中に頼まれた分（ページが隠れた時）も、途中の分が終わってから書く
import { FIT_MIN } from '../src/lib/layout.ts';
import { withBrowser, newPage, openTest, advance, nearAltar } from './lib.mjs';

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
  for (const device of ['iPhone SE landscape', 'iPhone 13 landscape', 'Pixel 7 landscape', '750x312']) {
    const pg =
      device === '750x312'
        ? await (await browser.newContext({ viewport: { width: 750, height: 312 }, hasTouch: true, isMobile: true })).newPage()
        : await newPage(browser, errs, { device });
    await openTest(pg, base, 'seed=202');
    await tapEnter(pg);
    await advance(pg, 3);
    const r = await pg.evaluate(() => {
      const q = (s) => document.querySelector(s).getBoundingClientRect();
      const hit = (a, o) => a.left < o.right && o.left < a.right && a.top < o.bottom && o.top < a.bottom;
      const btn = ['#touchbar', '#rollB', '#castR', '#castL'],
        hud = ['#status', '#mapwrap', '#hotbar'],
        out = [];
      btn.forEach((b, i) => {
        if (!(q(b).width > 0)) out.push(`${b} が出ていない`);
        for (const h of [...hud, ...btn.slice(i + 1)]) if (hit(q(b), q(h))) out.push(`${b} と ${h}`);
      });
      return out;
    });
    if (r.length) errs.push(`${device}：探索中のボタンが重なる（${r.join('、')}）`);
    // 左下の伝言と下の HUD も重ならない（伝言は、始めの伝言と、初めて指で入った時の一言）
    const lh = await pg.evaluate(() => {
      const a = document.getElementById('log').getBoundingClientRect(),
        o = document.getElementById('hotbar').getBoundingClientRect();
      return a.left < o.right && o.left < a.right && a.top < o.bottom && o.top < a.bottom
        ? `伝言 ${a.left | 0}〜${a.right | 0}、HUD ${o.left | 0}〜`
        : '';
    });
    if (lh) errs.push(`${device}：左下の伝言と下の HUD が重なる（${lh}）`);
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

  // ---------------------------------------------------------------- 8. 指の操作
  {
    const pg = await newPage(browser, errs, { device: 'iPhone 13 landscape' });
    await openTest(pg, base, 'seed=202');
    const E = (f, a) => pg.evaluate(f, a);
    const cdp = await pg.context().newCDPSession(pg);
    // pts：今触れている指の全部（[x, y, 指の番号]）。touchEnd・touchCancel は、残る指を渡す
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
    const st = () => E(() => __test.state());
    const mid = async (sel) => {
      const b = await pg.locator(sel).boundingBox();
      if (!b) throw new Error(`${sel} が見えない`);
      return [b.x + b.width / 2, b.y + b.height / 2];
    };
    const dist = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]);
    await tapEnter(pg);
    await advance(pg, 2);
    if (!(await E(() => getComputedStyle(document.getElementById('castR')).display !== 'none')))
      errs.push('指の操作：探索中に [右手] のボタンが出ていない');

    // スティック：上に倒すと進み、離すと止まる
    let a = await st();
    await touch('touchStart', [[150, 250, 1]]);
    await touch('touchMove', [[150, 190, 1]]);
    await advance(pg, 0.6);
    let b = await st();
    if (!(dist(a, b) > 1)) errs.push(`指の操作：スティックを倒しても進まない（${dist(a, b).toFixed(2)}）`);
    await touch('touchEnd', []);
    await advance(pg, 0.5); // 離した後の惰性が収まるまで
    a = await st();
    await advance(pg, 0.5);
    b = await st();
    if (dist(a, b) > 0.05) errs.push(`指の操作：スティックを離しても止まらない（${dist(a, b).toFixed(2)}）`);

    // 見回す：右半分を 50px 右へ → 0.25 ラジアン（TUNE.look 0.005）右を向く（yaw が減る）
    a = await st();
    await touch('touchStart', [[560, 150, 2]]);
    await touch('touchMove', [[610, 150, 2]]);
    await touch('touchEnd', []);
    b = await st();
    if (Math.abs(a.yaw - b.yaw - 0.25) > 0.01) errs.push(`指の操作：右半分のドラッグで見回せない（${a.yaw} → ${b.yaw}）`);

    // 両方を同時に
    a = await st();
    await touch('touchStart', [[150, 250, 1]]);
    await touch('touchStart', [
      [150, 250, 1],
      [560, 150, 2],
    ]);
    await touch('touchMove', [
      [150, 190, 1],
      [600, 150, 2],
    ]);
    await advance(pg, 0.6);
    b = await st();
    if (!(dist(a, b) > 1) || Math.abs(a.yaw - b.yaw - 0.2) > 0.01)
      errs.push(`指の操作：移動と見回しを同時にできない（進んだ ${dist(a, b).toFixed(2)}、向き ${a.yaw} → ${b.yaw}）`);
    if ((await E(() => visualViewport.scale)) !== 1) errs.push('指の操作：2本の指を動かすと、画面が拡大された');
    await touch('touchEnd', []);
    // 描く画面の上で指を動かした直後でも、タッチのボタンのタップが効く（touch-action: none だと、Chromium は直後のタップを click にしない）
    await touch('touchStart', [[560, 150, 2]]);
    await touch('touchMove', [[600, 150, 2]]);
    await touch('touchEnd', []);
    await pg.touchscreen.tap(...(await mid('#menuB')));
    await advance(pg, 0.1);
    if (!(await st()).paused) errs.push('指の操作：見回した直後に [メニュー] を押しても、メニューが開かない');
    await pg.touchscreen.tap(...(await mid('#menuB')));
    await advance(pg, 0.1);

    // [右手]（樫の杖）：押すと溜め、指をずらすと見回し、離すと溜めが終わる
    const [rx, ry] = await mid('#castR');
    a = await st();
    await touch('touchStart', [[rx, ry, 3]]);
    await advance(pg, 0.3);
    b = await st();
    if (b.cast?.h !== 'R') errs.push(`指の操作：[右手] を押しても溜めない（${JSON.stringify(b.cast)}）`);
    await touch('touchMove', [[rx - 40, ry, 3]]);
    const c = await st();
    if (Math.abs(c.yaw - b.yaw - 0.2) > 0.01) errs.push(`指の操作：[右手] を押したまま指をずらしても見回せない（${b.yaw} → ${c.yaw}）`);
    await touch('touchEnd', []);
    await advance(pg, 0.2);
    if ((await st()).cast) errs.push('指の操作：[右手] から指を離しても、溜めが終わらない（ボタンの外で離した）');

    // 指を取り逃した時（touchCancel）も、溜めが終わる
    await advance(pg, 1);
    await touch('touchStart', [[rx, ry, 4]]);
    await advance(pg, 0.2);
    const held = (await st()).cast?.h;
    await touch('touchCancel', []);
    await advance(pg, 0.2);
    if (held !== 'R' || (await st()).cast) errs.push(`指の操作：指を取り逃しても、溜めが終わらない（押した時 ${held}）`);

    // [回避]：押すと動く（押している向きが無ければ、見ている向きへ）
    await advance(pg, 2);
    const [vx, vy] = await mid('#rollB');
    a = await st();
    await touch('touchStart', [[vx, vy, 5]]);
    await touch('touchEnd', []);
    await advance(pg, 0.4);
    b = await st();
    if (!(dist(a, b) > 0.5)) errs.push(`指の操作：[回避] を押しても動かない（${dist(a, b).toFixed(2)}）`);
    await advance(pg, 2); // 回避の勢いが収まるまで

    // メニューを開いている間は、スティックで動かない（閉じた後も、そのまま動き出さない）
    await pg.touchscreen.tap(...(await mid('#menuB')));
    await advance(pg, 0.1);
    a = await st();
    await touch('touchStart', [[40, 290, 6]]);
    await touch('touchMove', [[40, 230, 6]]);
    await touch('touchEnd', []);
    await pg.touchscreen.tap(...(await mid('#menuB')));
    await advance(pg, 0.6);
    b = await st();
    if (!a.paused || dist(a, b) > 0.05)
      errs.push(`指の操作：メニューを開いている間に、スティックで動いた（止まっていた ${a.paused}、${dist(a, b).toFixed(2)}）`);

    // レベルアップ：1回目のタップで選んで説明を出し、2回目で決める
    await E(() => dbg.exp(400));
    await advance(pg, 0.6);
    const lv = () =>
      E(() => ({
        open: document.getElementById('altarp').classList.contains('open'),
        armed: document.querySelectorAll('#altarp button.armed').length,
      }));
    if (!(await lv()).open) errs.push('指の操作：レベルアップの画面が開かない（テストの前提が崩れた）');
    const opt = '#altarp button[data-lk="0"]';
    await pg.touchscreen.tap(...(await mid(opt)));
    await advance(pg, 0.1);
    let v = await lv();
    if (!v.open || v.armed !== 1)
      errs.push(`指の操作：レベルアップの選択肢を1回押すと、選ぶだけでなく決まる（開いている ${v.open}、選んだ ${v.armed}）`);
    await pg.touchscreen.tap(...(await mid(opt)));
    await advance(pg, 0.3);
    // dbg.exp(400) は何レベルか上がるので、決めると次のレベルアップの画面が開く（選んだ印が消える）。2回ずつ押して、最後に閉じる
    v = await lv();
    if (v.open && v.armed) errs.push('指の操作：レベルアップの選択肢を2回押しても決まらない');
    for (let i = 0; i < 20 && (await lv()).open; i++) {
      await advance(pg, 0.6);
      await pg.touchscreen.tap(...(await mid(opt)));
      await pg.touchscreen.tap(...(await mid(opt)));
      await advance(pg, 0.3);
    }
    if ((await lv()).open) errs.push('指の操作：レベルアップの選択肢を2回ずつ押しても、画面が閉じない');

    // 祭壇：同じく、1回目で選び、2回目で決める（seed=202 の3階には祭壇がある）
    await E(() => dbg.go(3));
    await advance(pg, 2);
    await nearAltar(pg);
    await advance(pg, 0.5);
    const al = () =>
      E(() => ({
        open: document.getElementById('altarp').classList.contains('open'),
        armed: document.querySelectorAll('#altarp button.armed').length,
        n: document.querySelectorAll('#altarp button[data-k]').length,
      }));
    let w = await al();
    if (!w.open || !w.n) errs.push(`指の操作：祭壇の画面が開かない（テストの前提が崩れた。${JSON.stringify(w)}）`);
    else {
      const k = await E(() => document.querySelector('#altarp button[data-k]').dataset.k);
      const sel = `#altarp button[data-k="${k}"]`;
      await pg.touchscreen.tap(...(await mid(sel)));
      await advance(pg, 0.1);
      w = await al();
      if (!w.open || w.armed !== 1) errs.push(`指の操作：祭壇の選択肢を1回押すと、選ぶだけでなく決まる（${JSON.stringify(w)}）`);
      const n0 = w.n;
      await pg.touchscreen.tap(...(await mid(sel)));
      await advance(pg, 0.3);
      w = await al();
      if (w.open && w.n === n0) errs.push(`指の操作：祭壇の選択肢を2回押しても決まらない（${JSON.stringify(w)}）`);
    }
    await pg.context().close();
  }

  // ---------------------------------------------------------------- 9. 狭い画面（本物の大きさ 750×312）：パネル・指の時の文言・[持ち替え]・始めの一言
  {
    const pg = await (await browser.newContext({ viewport: { width: 750, height: 312 }, hasTouch: true, isMobile: true })).newPage();
    pg.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 600)));
    await openTest(pg, base, 'seed=202');
    const E = (f, a) => pg.evaluate(f, a);
    // 押す物が見える所まで送ってから押す（装備の画面などは、中を送る）
    const tap = async (sel) => {
      await pg.locator(sel).first().scrollIntoViewIfNeeded();
      const b = await pg.locator(sel).first().boundingBox();
      if (!b) throw new Error(`${sel} が見えない`);
      await pg.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await advance(pg, 0.1);
    };
    const text = (sel) => E((s) => document.querySelector(s).innerText, sel);
    // パネル sel が画面に収まるか（上の [装備] [メニュー] が出ていれば、その下に）。送れるか（中身の高さ・見える高さ）も返す
    const fit = (sel) =>
      E((s) => {
        const el = document.querySelector(s),
          r = el.getBoundingClientRect(),
          bar = document.getElementById('touchbar').getBoundingClientRect(),
          top = bar.height > 0 ? bar.bottom : 0,
          out = r.top < top - 0.5 || r.bottom > innerHeight + 0.5 || r.left < -0.5 || r.right > innerWidth + 0.5;
        return {
          out,
          box: [r.left | 0, r.top | 0, r.right | 0, r.bottom | 0],
          top: top | 0,
          zoom: Number(el.style.zoom) || 1,
          sh: el.scrollHeight,
          ch: el.clientHeight,
          bar: bar.height > 0,
        };
      }, sel);
    const fits = async (sel, what) => {
      const f = await fit(sel);
      if (f.out) errs.push(`狭い画面：${what}が画面に収まらない（${JSON.stringify(f)}）`);
      if (f.zoom < FIT_MIN - 1e-6) errs.push(`狭い画面：${what}を ${FIT_MIN} 倍より小さく縮めた（${f.zoom}）`);
      return f;
    };
    await tapEnter(pg);
    await advance(pg, 2);
    if (!(await text('#log')).includes('左半分で動く')) errs.push('狭い画面：初めて指で入った時の一言が出ない');

    // メニューと、メニューの中に開く操作の案内（[戻る] で一覧に戻る）
    await tap('#menuB');
    await fits('#menu', 'メニュー');
    await tap('#menu button[data-k="help"]');
    await fits('#menu', 'メニューの中の操作の案内');
    let t = await text('#menu');
    if (!t.includes('スティック') || !t.includes('[持ち替え]') || t.includes('WASD'))
      errs.push(`狭い画面：操作の案内が、指の操作の説明でない（${t.slice(0, 120)}）`);
    await tap('#menu button[data-k="back"]');
    if (!(await text('#menu')).includes('探索を続ける')) errs.push('狭い画面：操作の案内の [戻る] で、メニューの一覧に戻らない');
    await tap('#menu button[data-k="book"]');
    if (!(await text('#menu')).includes('魔導書')) errs.push('狭い画面：メニューの「魔導書」が、メニューの中に開かない');
    await tap('#menuB');
    if (await E(() => document.getElementById('menu').classList.contains('show'))) errs.push('狭い画面：[メニュー] でメニューが閉じない');

    // 装備の画面：収まらない分は中を送れる。袋のルーンを選ぶと、はめられる枠が見える所まで送る
    await E(() => dbg.give('runes'));
    await tap('#packB');
    let f = await fits('#pack', '装備の画面');
    if (!(f.sh > f.ch)) errs.push(`狭い画面：装備の画面が送れない（テストの前提が崩れた。${JSON.stringify(f)}）`);
    if (!(await text('#pack')).includes('続けて2回押すと自動ではめる')) errs.push('狭い画面：装備の画面の案内が、指の言い方でない');
    // 手のルーンの枠にはめられる、袋のルーン（押して、光る枠ができる物）を探す
    const bags = await E(() => [...document.querySelectorAll('#pack button[data-b]')].map((b) => b.dataset.b));
    let can = null;
    const slotSeen = () =>
      E(() => {
        const p = document.getElementById('pack').getBoundingClientRect(),
          r = document.querySelector('#pack button.rs.can')?.getBoundingClientRect();
        return !!r && r.top >= p.top && r.bottom <= p.bottom;
      });
    for (const u of bags) {
      // 一番下まで送ってから、そのルーンが見える所まで戻して押す（手の枠は画面の外）
      await E(() => (document.getElementById('pack').scrollTop = 1e4));
      await tap(`#pack button[data-b="${u}"]`);
      if (!(await E(() => !!document.querySelector('#pack button.rs.can')))) continue;
      can = u;
      if (await slotSeen()) errs.push('狭い画面：袋のルーンを押した時に、手の枠がもう見えている（テストの前提が崩れた）');
      await advance(pg, 1); // 続けて2回押すのを待つ間（0.65 秒）の後に送る
      break;
    }
    if (!can) errs.push('狭い画面：はめられる袋のルーンが無い（テストの前提が崩れた）');
    else {
      if (!(await slotSeen())) errs.push('狭い画面：袋のルーンを選んでも、はめられる枠が見える所まで送らない');
    }
    // ビルドを2つ（違う手で）保存すると、[持ち替え] が出て、押すと持ち替える
    if (await E(() => !document.getElementById('swapB').hidden)) errs.push('狭い画面：ビルドを保存する前から [持ち替え] が出ている');
    const save = (k) => tap(`#pack button[data-save="${k}"]`);
    await save(0);
    // 中身を書き直しても（ビルドを保存すると、装備の画面を作り直す）、送った所は一番上へ戻らない
    const sc = await E(() => document.getElementById('pack').scrollTop);
    if (!(sc > 0)) errs.push(`狭い画面：装備の画面でボタンを押すと、送った所が一番上へ戻る（${sc}）`);
    if (can) {
      // 2回続けて押すと、自動ではめる（手が変わる）
      await pg.locator(`#pack button[data-b="${can}"]`).scrollIntoViewIfNeeded();
      const b = await pg.locator(`#pack button[data-b="${can}"]`).boundingBox();
      if (b) {
        await pg.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        await pg.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        await advance(pg, 0.1);
      }
    }
    await save(1);
    await tap('#packB');
    await advance(pg, 2); // 付け替えの詠唱が終わるまで
    if (!(await E(() => getComputedStyle(document.getElementById('swapB')).display !== 'none' && !document.getElementById('swapB').hidden)))
      errs.push('狭い画面：ビルドを2つ保存しても、[持ち替え] が出ない');
    else {
      // 持ち替えると、付け替えの詠唱が始まる（下の HUD に出る。十字の下の一言「ビルド1」は tests/panels.mjs が見る）
      await tap('#swapB');
      t = await text('#hotbar');
      if (!t.includes('付け替え')) errs.push(`狭い画面：[持ち替え] を押しても、持ち替えない（下の HUD「${t}」）`);
      const ov = await E(() => {
        const q = (s) => document.querySelector(s).getBoundingClientRect(),
          hit = (a, o) => a.left < o.right && o.left < a.right && a.top < o.bottom && o.top < a.bottom;
        return ['#castR', '#castL', '#rollB', '#hotbar', '#mapwrap', '#status', '#touchbar'].filter((s) => hit(q('#swapB'), q(s)));
      });
      if (ov.length) errs.push(`狭い画面：[持ち替え] が ${ov.join('・')} と重なる`);
      // [右手] を押して溜めている間に、別の指で [持ち替え] を押しても、持ち替えない（溜めが散って、押している指だけが残るため）
      await advance(pg, 2);
      const cdp = await pg.context().newCDPSession(pg);
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
      const mid = async (sel) => {
        const b = await pg.locator(sel).boundingBox();
        return [b.x + b.width / 2, b.y + b.height / 2];
      };
      const [rx, ry] = await mid('#castR'),
        [sx, sy] = await mid('#swapB');
      await touch('touchStart', [[rx, ry, 1]]);
      await advance(pg, 0.2);
      // 2本目の指で [持ち替え] を押す（押した時に持ち替える。離すのは、両方まとめて後で）
      await touch('touchStart', [
        [rx, ry, 1],
        [sx, sy, 2],
      ]);
      await advance(pg, 0.1);
      const held = await E(() => __test.state().cast?.h);
      t = await text('#hotbar');
      if (held !== 'R' || t.includes('付け替え'))
        errs.push(`狭い画面：溜めている間に [持ち替え] を押すと、持ち替える（溜め ${held}、下の HUD「${t}」）`);
      await touch('touchEnd', []);
      await advance(pg, 0.5);
    }

    // レベルアップの画面：収まり、[装備] [メニュー] は隠れ、案内は指の言い方
    await advance(pg, 2);
    await E(() => dbg.exp(400));
    await advance(pg, 0.6);
    f = await fits('#altarp', 'レベルアップの画面');
    if (f.bar) errs.push('狭い画面：レベルアップの画面の間も、[装備] [メニュー] が出ている');
    if (!(await text('#altarp')).includes('1回押すと説明が出る')) errs.push('狭い画面：レベルアップの画面の案内が、指の言い方でない');
    for (let i = 0; i < 20 && (await E(() => document.getElementById('altarp').classList.contains('open'))); i++) {
      await advance(pg, 0.6);
      await tap('#altarp button[data-lk="0"]');
      await tap('#altarp button[data-lk="0"]');
      await advance(pg, 0.3);
    }

    // 祭壇の画面：同じ。[やめる] で閉じると、[装備] [メニュー] がまた出る
    await E(() => dbg.go(3));
    await advance(pg, 2);
    await nearAltar(pg);
    await advance(pg, 0.5);
    if (!(await E(() => document.getElementById('altarp').classList.contains('open'))))
      errs.push('狭い画面：祭壇の画面が開かない（テストの前提が崩れた）');
    else {
      f = await fits('#altarp', '祭壇の画面');
      if (f.bar) errs.push('狭い画面：祭壇の画面の間も、[装備] [メニュー] が出ている');
      if (!(await text('#altarp')).includes('1回押すと説明、もう1回で決まる')) errs.push('狭い画面：祭壇の画面の案内が、指の言い方でない');
      await tap('#altarp button[data-cancel]');
      if (!(await fit('#altarp')).bar) errs.push('狭い画面：祭壇の画面を閉じても、[装備] [メニュー] が出ない');
    }

    // 結果の画面
    await E(() => dbg.hurt(9999));
    await advance(pg, 3);
    if (!(await E(() => document.getElementById('death').classList.contains('show'))))
      errs.push('狭い画面：結果の画面が出ない（テストの前提が崩れた）');
    else await fits('#death', '結果の画面');
    await pg.context().close();
  }

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
        else {
          // 探索の始めの階（本道）にいる。場所は placeKey の形（探索のシード:m:深さ）
          const want = await p.evaluate(() => `${__test.state().seed}:m:${__test.state().depth}`);
          if (d.fps.at(-1).place !== want) errs.push(`診断の記録：速さの行の場所が ${want} でない（${JSON.stringify(d.fps.at(-1))}）`);
        }
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
