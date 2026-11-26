// 指で遊ぶ時の土台：指で触れたら指の遊び方（ui.touch。body.touch）にし、マウスを動かしたら戻す。
// 指の遊び方では、マウスを捕まえない（src/lib/screens.ts の tryLock）。
// ブラウザが指の後に出すマウスの事件（mousedown・mouseup・mousemove。描く画面では左手の詠唱を始め、装備の画面やメニューの外を押したら閉じる処理も動く）は止める。
// Chromium は指の pointerdown の preventDefault で止まるが、iPhone（WebKit）は止まらないので、指の事件から COMPAT_MS 以内のマウスの事件も、
// ゲームの処理に届く前（window の捕まえる段。ゲームのマウスの処理より先に登録する）で、伝わりを止める。click と mouseover は止めない（ボタンと説明が効くように）
// 指で遊ぶ時は、パネルを画面に収める（src/lib/layout.ts の fitPanels）。
// タッチのボタン（#touchbar）：[全画面]（タイトルで、全画面にできて、まだ全画面でない時だけ）・[装備]・[メニュー]（探索中だけ。CSS が出し分ける）
import { must } from './array.ts';
import { fitPanels, initFitPanels } from './layout.ts';
import { ui } from './state.ts';

/** 指の事件の後、これだけの間（ミリ秒）に来たマウスの事件は、ブラウザが指の後に出した物とみなして止める */
export const COMPAT_MS = 1000;

/**
 * パネル（祭壇・レベルアップ）の選択肢を押した時、今決めるか。マウスなら、いつも今決める。
 * 指なら、1回目は選ぶだけ（呼ぶ側が説明を出す）で、同じ選択肢（key）の2回目で決める。
 * key には、パネルを開いた時刻など、開くたびに変わる物を入れる（前に開いた時の1回目が残っていても、決まらないように）
 */
export function confirmTap(key: string): boolean {
  if (!ui.touch) return true;
  if (ui.tapArm === key) {
    ui.tapArm = '';
    return true;
  }
  ui.tapArm = key;
  return false;
}

/** 指で遊んでいる時は finger を、マウスとキーボードの時は mouse を返す（操作の説明を、遊び方で書き分ける） */
export const byInput = (mouse: string, finger: string): string => (ui.touch ? finger : mouse);

/** 指の遊び方にする・戻す */
export function setTouch(on: boolean): void {
  if (ui.touch === on) return;
  ui.touch = on;
  document.body.classList.toggle('touch', on);
  fitPanels();
}

/** 全画面のボタンを、全画面にできて、まだ全画面でない時だけ出す */
export function updateFullscreenButton(): void {
  must(document.getElementById('fsB'), '#fsB').hidden = !document.fullscreenEnabled || !!document.fullscreenElement;
}

/** ボタンを押した時にすること（装備の画面とメニューの開け閉めは、古い JS の Tab・Esc と同じ処理を渡す） */
export interface TouchActions {
  pack: () => void;
  menu: () => void;
}

/**
 * 指の遊び方の事件と、タッチのボタンを用意する（ページを開いた時に1回）。
 * ゲームのマウスの処理（src/game/17-meta.js）より先に呼ぶこと（後から出るマウスの事件を、それより先に止めるため。src/game/16-view-input.js が呼ぶ）
 */
export function initTouch(act: TouchActions): void {
  // 最後の指の事件の時刻（事件の timeStamp。テスト用モードで止まる performance.now ではなく、事件と同じ時計で比べる）
  let lastTouch = -Infinity;
  for (const t of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel'] as const)
    window.addEventListener(
      t,
      (e) => {
        if (e.pointerType === 'touch') lastTouch = e.timeStamp;
      },
      true,
    );
  for (const t of ['mousedown', 'mouseup', 'mousemove'] as const)
    window.addEventListener(
      t,
      (e) => {
        if (e.timeStamp - lastTouch > COMPAT_MS) return;
        // 伝わりだけを止める（preventDefault はしない。mousedown を取り消すと、タイトルのシードの入力欄に入れなくなるおそれがある）
        e.stopImmediatePropagation();
      },
      true,
    );
  // 捕まえる段（capture）で見るので、ボタンの click より先に指の遊び方になる（タイトルの「迷宮に入る」の tryLock が捕まえにいかない）
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch') setTouch(true);
    },
    true,
  );
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') setTouch(false);
  });
  const stopCompat = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') e.preventDefault();
  };
  must(document.getElementById('gl'), '#gl').addEventListener('pointerdown', stopCompat);
  const bar = must(document.getElementById('touchbar'), '#touchbar');
  bar.addEventListener('pointerdown', stopCompat);
  must(document.getElementById('tctl'), '#tctl').addEventListener('pointerdown', stopCompat);
  must(document.getElementById('packB'), '#packB').addEventListener('click', act.pack);
  must(document.getElementById('menuB'), '#menuB').addEventListener('click', act.menu);
  must(document.getElementById('fsB'), '#fsB').addEventListener('click', () => {
    // 断られても（iPhone の Safari など）何もしない
    document.documentElement.requestFullscreen().catch(() => undefined);
  });
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  updateFullscreenButton();
  initFitPanels();
}
