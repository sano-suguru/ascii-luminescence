// 指で遊ぶ時の土台：指で触れたら指の遊び方（ui.touch。body.touch）にし、マウスを動かしたら戻す。
// 指の遊び方では、マウスを捕まえない（src/lib/screens.ts の tryLock）。描く画面とタッチのボタンでは、指の pointerdown で preventDefault して、
// ブラウザが後から出すマウスの事件（mousedown など。描く画面では左手の詠唱を始め、メニューの外を押したら閉じる処理も動く）を止める（click は止まらない）。
// タッチのボタン（#touchbar）：[全画面]（タイトルで、全画面にできて、まだ全画面でない時だけ）・[装備]・[メニュー]（探索中だけ。CSS が出し分ける）
import { must } from './array.ts';
import { ui } from './state.ts';

/** 指の遊び方にする・戻す */
export function setTouch(on: boolean): void {
  if (ui.touch === on) return;
  ui.touch = on;
  document.body.classList.toggle('touch', on);
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

/** 指の遊び方の事件と、タッチのボタンを用意する（ページを開いた時に1回） */
export function initTouch(act: TouchActions): void {
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
  must(document.getElementById('packB'), '#packB').addEventListener('click', act.pack);
  must(document.getElementById('menuB'), '#menuB').addEventListener('click', act.menu);
  must(document.getElementById('fsB'), '#fsB').addEventListener('click', () => {
    // 断られても（iPhone の Safari など）何もしない
    document.documentElement.requestFullscreen().catch(() => undefined);
  });
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  updateFullscreenButton();
}
