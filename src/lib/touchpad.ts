// 指の操作（スマホの横向き）：左半分に触れた所に出るスティックで移動、右半分のドラッグで見回す、右下の [右手] [左手] で詠唱（押して溜め、離して放つ）、
// 左下の [回避] で回避。指の遊び方（ui.touch。src/lib/touch.ts）の時だけ、CSS が出す（src/index.html の #tctl）。
// 移動はスティックの向きを WASD に置き換え（8方向）、端まで倒すと走る（Shift）。詠唱のボタンを押したまま指をずらすと、見回しもできる。
// ボタンの外で離した時・指を取り逃した時（pointercancel）も、離したことにする。止まっている間（メニューなど）は、新しく押しても何もしない。
// 描く画面と指の操作のボタンは touch-action を既定のままにし、touchmove の preventDefault で、ブラウザの送りと拡大を止める
// （touch-action: none の上で指を動かすと、Chromium はその直後のボタンのタップを click にしない。[メニュー] などが1回効かなくなる）
import { must } from './array.ts';
import { beginCast, releaseCast, startRoll } from './chant.ts';
import type { Side } from './gear.ts';
import { clamp } from './rng.ts';
import { adv, gear, keys, player, ui } from './state.ts';
import { isPaused } from './status.ts';

/** スティック：これより近いと動かない（遊び）・これより遠いと走る・つまみが動ける半径（どれも画面の px） */
export const STICK = { dead: 10, run: 46, max: 44 };
/** 見回す速さ（指が1px動くと、何ラジアン回るか。マウスのドラッグは 0.0045） */
export const LOOK_K = 0.005;
/** スティックが押すキー（離す時に、これだけを戻す） */
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'];

interface Finger {
  id: number;
  x: number;
  y: number;
}
let stickF: (Finger & { ox: number; oy: number }) | null = null,
  lookF: Finger | null = null;
/** 詠唱のボタンを押している指（指の番号 → 手と、見回すための前の位置） */
const holds = new Map<number, Finger & { h: Side }>();

/** 指を捕まえる（その指が画面のどこへ動いても、事件が届くように）。捕まえられない指（もう離れた指など）は、そのまま */
function capture(el: Element, id: number): void {
  try {
    el.setPointerCapture(id);
  } catch {
    // 捕まえられなくても、window で受けているので動く
  }
}

const canPlay = (): boolean => ui.started && !adv.dead && !isPaused();

/** 向きを変える（マウスのドラッグと同じく、上下は ±1.35 まで） */
function turn(dx: number, dy: number): void {
  player.yaw -= dx * LOOK_K;
  player.pitch = clamp(player.pitch - dy * LOOK_K, -1.35, 1.35);
}

/** スティックの倒し方から、押すキーを決める（8方向。倒しの向きの成分が 0.38 を越えた向きを押す） */
function stickKeys(dx: number, dy: number): void {
  const r = Math.hypot(dx, dy),
    on = r > STICK.dead,
    nx = on ? dx / r : 0,
    ny = on ? dy / r : 0;
  keys['KeyW'] = ny < -0.38;
  keys['KeyS'] = ny > 0.38;
  keys['KeyA'] = nx < -0.38;
  keys['KeyD'] = nx > 0.38;
  keys['ShiftLeft'] = r > STICK.run;
  const k = r > STICK.max ? STICK.max / r : 1;
  must(document.getElementById('knob'), '#knob').style.transform = `translate(${dx * k}px,${dy * k}px)`;
}
function endStick(): void {
  stickF = null;
  for (const c of MOVE_KEYS) keys[c] = false;
  must(document.getElementById('stick'), '#stick').hidden = true;
}
function endHold(id: number): void {
  const f = holds.get(id);
  if (!f) return;
  holds.delete(id);
  if (gear.hands) releaseCast(f.h);
}

/** 指の操作を用意する（ページを開いた時に1回） */
export function initTouchpad(): void {
  const gl = must(document.getElementById('gl'), '#gl'),
    stickEl = must(document.getElementById('stick'), '#stick');
  // 指を動かした時の、ブラウザの送りと拡大を止める（上の説明。touch-action: none は使わない）
  for (const el of [gl, must(document.getElementById('tctl'), '#tctl')])
    el.addEventListener(
      'touchmove',
      (e) => {
        if (e.cancelable) e.preventDefault();
      },
      { passive: false },
    );
  gl.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    if (!canPlay()) return;
    capture(gl, e.pointerId);
    if (e.clientX < innerWidth / 2 && !stickF) {
      stickF = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY };
      stickEl.style.left = `${e.clientX}px`;
      stickEl.style.top = `${e.clientY}px`;
      stickEl.hidden = false;
      stickKeys(0, 0);
    } else if (e.clientX >= innerWidth / 2 && !lookF) lookF = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  for (const [sel, h] of [
    ['#castL', 'L'],
    ['#castR', 'R'],
  ] as const) {
    const b = must(document.getElementById(sel.slice(1)), sel);
    b.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || !canPlay() || !gear.hands) return;
      holds.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY, h });
      capture(b, e.pointerId);
      beginCast(h);
    });
  }
  must(document.getElementById('rollB'), '#rollB').addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && canPlay()) startRoll();
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return;
    if (stickF?.id === e.pointerId) stickKeys(e.clientX - stickF.ox, e.clientY - stickF.oy);
    const f = lookF?.id === e.pointerId ? lookF : holds.get(e.pointerId);
    if (f) {
      turn(e.clientX - f.x, e.clientY - f.y);
      f.x = e.clientX;
      f.y = e.clientY;
    }
  });
  const end = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    if (stickF?.id === e.pointerId) endStick();
    if (lookF?.id === e.pointerId) lookF = null;
    endHold(e.pointerId);
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}
