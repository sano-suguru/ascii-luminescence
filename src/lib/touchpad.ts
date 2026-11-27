// 指の操作（スマホの横向き）：左半分に触れた所に出るスティックで移動、右半分のドラッグで見回す、右下の [右手] [左手] で詠唱（押して溜め、離して放つ）、
// その左の [持ち替え] で次のビルドへ（ビルドを2つ以上保存した時だけ出る。src/lib/hotbar.ts）、左の [回避]（左上の状態の表示の下）で回避。指の遊び方（ui.touch。src/lib/touch.ts）の時だけ、CSS が出す（src/index.html の #tctl）。
// 移動はスティックの向きを WASD に置き換え（8方向）、端まで倒すと走る（Shift）。詠唱のボタンを押したまま指をずらすと、見回しもできる。
// ボタンの外で離した時・指を取り逃した時（pointercancel）も、離したことにする。止まっている間（メニューなど）は、新しく押しても何もしない。
// 図鑑で生き物を見ている間は、描く画面の1本指のドラッグで生き物を回し・見下ろし（マウスのドラッグと同じ）、2本指でつまむと寄る・引く（ホイールと同じ）。
// 描く画面と指の操作のボタンは touch-action を既定のままにし、touchmove の preventDefault で、ブラウザの送りと拡大を止める
// （touch-action: none の上で指を動かすと、Chromium はその直後のボタンのタップを click にしない。[メニュー] などが1回効かなくなる）
import { must } from './array.ts';
import { beginCast, releaseCast, startRoll } from './chant.ts';
import type { Side } from './gear.ts';
import { clamp } from './rng.ts';
import { adv, gear, keys, thumb, player, ui } from './state.ts';
import { isPaused } from './status.ts';

/** スティック：これより近いと動かない（遊び）・これより遠いと走る・つまみが動ける半径（どれも画面の px） */
export const STICK = { dead: 10, run: 46, max: 44 };
/**
 * 試して合わせる値（テスト用モードの __test.touchTune で変えられる。手触りを比べる tools/feel.mjs が使う）。
 * look：見回す速さ（指が1px動くと、何ラジアン回るか。マウスのドラッグは 0.0045）。
 * analog：true なら、スティックを倒し具合で動く（thumb.stick。倒し具合が速さになる）。false なら、倒した向きを WASD に置き換える（8方向、歩くか走るか）
 */
export const TUNE = { look: 0.005, analog: false };
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
/** 図鑑の描く画面に触れている指（指の番号 → 前の位置） */
const galF = new Map<number, Finger>();

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
  player.yaw -= dx * TUNE.look;
  player.pitch = clamp(player.pitch - dy * TUNE.look, -1.35, 1.35);
}

/** スティックの倒し方から、押すキーを決める（8方向。倒しの向きの成分が 0.38 を越えた向きを押す） */
function stickKeys(dx: number, dy: number): void {
  const r = Math.hypot(dx, dy),
    on = r > STICK.dead,
    nx = on ? dx / r : 0,
    ny = on ? dy / r : 0;
  const eight = !TUNE.analog;
  keys['KeyW'] = eight && ny < -0.38;
  keys['KeyS'] = eight && ny > 0.38;
  keys['KeyA'] = eight && nx < -0.38;
  keys['KeyD'] = eight && nx > 0.38;
  keys['ShiftLeft'] = r > STICK.run;
  // アナログ：遊びから、つまみが動ける半径までを 0 から 1 にする（走るのは、8方向と同じく STICK.run を越えた時）
  const m = on ? Math.min(1, (r - STICK.dead) / (STICK.max - STICK.dead)) : 0;
  thumb.stick = eight ? null : [nx * m, ny * m];
  const k = r > STICK.max ? STICK.max / r : 1;
  must(document.getElementById('knob'), '#knob').style.transform = `translate(${dx * k}px,${dy * k}px)`;
}
function endStick(): void {
  stickF = null;
  for (const c of MOVE_KEYS) keys[c] = false;
  thumb.stick = null;
  must(document.getElementById('stick'), '#stick').hidden = true;
}
function endHold(id: number): void {
  const f = holds.get(id);
  if (!f) return;
  holds.delete(id);
  if (gear.hands) releaseCast(f.h);
}

/** ボタンを押した時にすること（ビルドの持ち替えは、古い JS のホイールと同じ処理を渡す） */
export interface PadActions {
  build: () => void;
  /** 図鑑の操作（古い JS の src/game/25-gallery.js。マウスのドラッグとホイールと同じ処理） */
  gallery: {
    /** 図鑑で生き物を見ているか */
    on: () => boolean;
    /** 回す（横）・見下ろす（縦）。指が動いた px */
    drag: (dx: number, dy: number) => void;
    /** 寄る・引く。f は2本の指の間の長さが何倍になったか（広げると寄る） */
    zoom: (f: number) => void;
    /** 指で触れ始めた・全部離した（触れている間は、生き物がひとりでに回らない） */
    hold: (on: boolean) => void;
  };
}

/** 2本の指の間の長さ */
function spread(): number {
  const [a, b] = [...galF.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

/** 指の操作を用意する（ページを開いた時に1回） */
export function initTouchpad(act: PadActions): void {
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
    if (act.gallery.on()) {
      if (galF.size >= 2) return;
      capture(gl, e.pointerId);
      if (!galF.size) act.gallery.hold(true);
      galF.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
      return;
    }
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
  must(document.getElementById('swapB'), '#swapB').addEventListener('pointerdown', (e) => {
    // 詠唱のボタンを押している間は持ち替えない（持ち替えると溜めが散るが、押している指は見回しと離した時の放つ処理を続けてしまう）
    if (e.pointerType === 'touch' && canPlay() && !holds.size) act.build();
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return;
    const g = galF.get(e.pointerId);
    if (g) {
      // 2本の時はつまむだけ、1本の時は回すだけ
      const d0 = spread();
      const dx = e.clientX - g.x,
        dy = e.clientY - g.y;
      g.x = e.clientX;
      g.y = e.clientY;
      if (galF.size >= 2) {
        const d1 = spread();
        if (d0 > 0 && d1 > 0) act.gallery.zoom(d1 / d0);
      } else act.gallery.drag(dx, dy);
      return;
    }
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
    if (galF.delete(e.pointerId) && !galF.size) act.gallery.hold(false);
    if (stickF?.id === e.pointerId) endStick();
    if (lookF?.id === e.pointerId) lookF = null;
    endHold(e.pointerId);
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}
