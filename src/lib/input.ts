// 入力（もとは src/game/17-meta.js と 16-view-input.js）：マウスを捕まえた・捕まえられなかった時の受け取りと指で遊ぶ時の土台を用意する initPointer、
// マウスとキーの処理を用意する initInput（診断の記録もここで始める）、キーの処理 onKeyDown、次のビルドに持ち替える nextBuild（ホイールと、指の操作の [持ち替え]）、
// 装備の画面とメニューを開け閉めする togglePack・toggleMenu（Tab・Esc とタッチのボタン）。
import { must, nth } from './array.ts';
import { beginCast, releaseCast, startRoll } from './chant.ts';
import { setDbg } from './debug.ts';
import { initDiag } from './diag.ts';
import { galleryDrag, galleryHold, galleryReset, galleryView, galleryWheel, galleryZoom, renderGallery, showBeast } from './gallery.ts';
import { snapHands } from './gear.ts';
import { buildsHave, renderHotbar } from './hotbar.ts';
import { redrawIntroLater } from './intro.ts';
import { applyBuild, setInv, startSwap } from './inventory.ts';
import { returnToTitle, setMenu } from './menu.ts';
import { closeAltar } from './panels.ts';
import { startNewRun } from './results.ts';
import { clamp } from './rng.ts';
import { lockFailed, menuOnHide, menuOnUnlock, relockClick, sndToggle, tryLock, updateResume } from './screens.ts';
import { adv, clock, gear, gfx, keys, player, saved, ui } from './state.ts';
import { cycleUi, flashHint, isPaused, renderChron, renderStatus, setHelp } from './status.ts';
import { initTouch } from './touch.ts';
import { initTouchpad, releaseTouch } from './touchpad.ts';

declare global {
  interface HTMLCanvasElement {
    /** 最後にビルドを持ち替えた時刻（nextBuild。続けて回した時に間をあける） */
    wheelT?: number;
  }
}
/** 描く画面（無ければ止まる） */
const canvas = () => must(gfx.canvas, '描く画面 gfx.canvas');

/** マウスを捕まえた・捕まえられなかった時の受け取りと、指で遊ぶ時の土台を用意する */
export function initPointer(): void {
  // マウスを捕まえる tryLock・失敗した時 lockFailed・外れた時にメニューを開くか menuOnUnlock・「クリックで視点操作に戻る」の一言 updateResume は src/lib/screens.ts
  document.addEventListener('pointerlockchange', () => {
    const was = ui.locked;
    ui.locked = document.pointerLockElement === gfx.canvas;
    if (ui.locked) {
      ui.lockedOnce = true;
      ui.lockTries = 0;
    } else if (was) ui.unlockedAt = performance.now();
    if (ui.locked && ui.menuOpen) setMenu(false);
    if (menuOnUnlock(was)) setMenu(true);
    updateResume();
  });
  document.addEventListener('pointerlockerror', lockFailed);
  // 指で遊ぶ時の土台（src/lib/touch.ts）。指の後に出るマウスの事件を止めるので、ゲームのマウスの処理（initInput）より先に用意する
  initTouch({
    pack: togglePack,
    menu: toggleMenu,
    changed: () => {
      if (ui.gallery && ui.gallery.mode === 'beast') renderGallery();
    },
  });
  initTouchpad({
    build: nextBuild,
    gallery: { on: () => !!(ui.gallery && ui.gallery.mode === 'beast'), drag: galleryDrag, zoom: galleryZoom, hold: galleryHold },
  });
}
// 次のビルドに持ち替える（ホイールと、指の操作の [持ち替え]。続けて回した時は 0.35 秒あける）。buildsHave は src/lib/hotbar.ts
export function nextBuild(): void {
  if (!ui.started || isPaused() || !gear.hands) return;
  const have = buildsHave();
  if (!have.length || clock.time - (canvas().wheelT || -9) < 0.35) return;
  canvas().wheelT = clock.time;
  const pos = Math.max(0, have.indexOf(gear.buildIdx)),
    next = nth(have, (pos + 1) % have.length);
  const prev = snapHands();
  if (applyBuild(next)) {
    startSwap(prev);
    flashHint(`ビルド${next + 1}`, 900);
  }
  renderHotbar();
}
// Esc：捕まえていない時は、メニューを開け閉めする。Esc で閉じた時は捕まえない（下の ui.escKey）。捕まえる遊び方なら、その後は
// 「クリックで視点操作に戻る」が出て、次のクリックで捕まえる（relockClick）。レベルアップの画面では何もしない
function onKeyDown(e: KeyboardEvent): void {
  if (ui.gallery && ui.gallery.mode === 'beast') {
    if (e.code === 'ArrowLeft') showBeast((ui.gallery.idx ?? NaN) - 1);
    else if (e.code === 'ArrowRight') showBeast((ui.gallery.idx ?? NaN) + 1);
    else if (e.code === 'Escape') returnToTitle();
    else if (e.code === 'KeyR') galleryReset();
    e.preventDefault();
    return;
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- キーを受けた所は画面の部品（元の読み方のまま）
  if (e.target && (e.target as HTMLElement).tagName === 'INPUT') {
    if (e.code === 'Enter') {
      e.preventDefault();
      must(document.getElementById('enter'), '［迷宮に入る］').click();
    }
    return;
  }
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!ui.started && (e.code === 'Enter' || e.code === 'Space')) {
    must(document.getElementById('enter'), '［迷宮に入る］').click();
    return;
  }
  if (e.code === 'F2') {
    e.preventDefault();
    if (ui.started && !adv.dead && saved.DEVALL) {
      if (ui.menuOpen) setMenu(false);
      if (ui.invOpen) setInv(false);
      setDbg(!ui.dbgOpen);
    }
    return;
  }
  if (e.code === 'Escape' && ui.dbgOpen) {
    setDbg(false);
    return;
  }
  if (ui.altarOpen && e.code === 'Escape') {
    e.preventDefault();
    closeAltar(true);
    return;
  }
  if (e.code === 'Tab') {
    e.preventDefault();
    togglePack();
    return;
  }
  if (e.code === 'Escape') {
    if (ui.invOpen) {
      setInv(false);
      return;
    }
    if (ui.lvlOpen) return;
    if (ui.started && !adv.dead && !ui.locked) {
      setMenu(!ui.menuOpen);
      return;
    }
  }
  if (isPaused()) return;
  if (ui.started && e.code === 'KeyM') {
    sndToggle();
  }
  if (ui.started && e.code === 'KeyH') {
    cycleUi();
  }
  if (adv.dead && (e.code === 'Enter' || e.code === 'KeyR')) {
    startNewRun();
    return;
  }
  if (ui.started && e.code === 'Space') {
    startRoll();
  }
  if (ui.started && e.code === 'KeyP') {
    ui.perfOn = !ui.perfOn;
    renderStatus();
  }
  if (ui.started && e.code === 'KeyJ') {
    ui.chronOn = !ui.chronOn;
    ui.helpOn = false;
    ui.bookOn = false;
    ui.helpT = 0;
    const el = document.getElementById('help');
    if (el) {
      if (ui.chronOn) renderChron();
      el.classList.toggle('off', !ui.chronOn);
    }
  }
  if (ui.started && (e.key === '?' || e.code === 'Slash')) {
    setHelp(!ui.helpOn);
    ui.helpT = 0;
  }
}
// 装備の画面を開け閉めする（Tab とタッチの [装備]）。祭壇の画面が開いていれば、閉じて装備の画面を開く
export function togglePack(): void {
  if (ui.altarOpen) {
    closeAltar(true);
    if (ui.started && !adv.dead) setInv(true);
    return;
  }
  if (ui.started && !adv.dead) {
    if (ui.menuOpen) setMenu(false);
    setInv(!ui.invOpen);
  }
}
// タッチの [メニュー]：Esc と同じく、祭壇・装備の画面が開いていれば閉じ、そうでなければメニューを開け閉めする（レベルアップの画面では何もしない）
export function toggleMenu(): void {
  if (ui.altarOpen) {
    closeAltar(true);
    return;
  }
  if (ui.invOpen) {
    setInv(false);
    return;
  }
  if (ui.lvlOpen || !ui.started || adv.dead) return;
  setMenu(!ui.menuOpen);
}
/** マウスとキーの処理を用意する（診断の記録もここで始める） */
export function initInput(): void {
  canvas().addEventListener('contextmenu', (e) => e.preventDefault());
  // the bestiary: the wheel moves in and out, a drag with the left button turns the creature and moves the camera up and down (galleryWheel, galleryDrag)
  canvas().addEventListener(
    'wheel',
    (e) => {
      if (!(ui.gallery && ui.gallery.mode === 'beast')) return;
      e.preventDefault();
      galleryWheel(e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1));
    },
    { passive: false },
  );
  canvas().addEventListener('mousedown', (e) => {
    if (!(ui.gallery && ui.gallery.mode === 'beast') || e.button !== 0) return;
    ui.gallery.drag = { x: e.clientX, y: e.clientY };
    galleryView();
  });
  // the left button let go where no mouseup reaches (another window took the focus): the drag ends
  window.addEventListener('mousemove', (e) => {
    const g = ui.gallery;
    if (!g || !g.drag) return;
    if (!(e.buttons & 1)) {
      g.drag = null;
      galleryView();
      return;
    }
    galleryDrag(e.clientX - g.drag.x, e.clientY - g.drag.y);
    g.drag.x = e.clientX;
    g.drag.y = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    const g = ui.gallery;
    if (!g || !g.drag || e.button !== 0) return;
    g.drag = null;
    galleryView();
  });
  window.addEventListener('blur', () => {
    const g = ui.gallery;
    if (!g || !g.drag) return;
    g.drag = null;
    galleryView();
  });
  window.addEventListener(
    'mousedown',
    (e) => {
      if (!ui.menuOpen && !ui.invOpen) return;
      if (ui.dbgOpen) {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- 押された所は画面の部品（元の読み方のまま）
        if (!(e.target && (e.target as Element).closest && (e.target as Element).closest('#dbgp'))) {
          e.preventDefault();
          e.stopPropagation();
          setDbg(false);
        }
        return;
      }
      // oxlint-disable-next-line typescript/consistent-type-assertions -- 押された所は画面の部品（元の読み方のまま）
      const inside = e.target && (e.target as Element).closest && (e.target as Element).closest('#menu,#pack');
      if (inside) return;
      e.preventDefault();
      e.stopPropagation();
      if (ui.menuOpen) {
        setMenu(false);
        if (!ui.plFailed) tryLock();
      }
      if (ui.invOpen) setInv(false);
    },
    true,
  );
  canvas().addEventListener(
    'wheel',
    (e) => {
      if (!ui.started || isPaused() || !gear.hands) return;
      e.preventDefault();
      nextBuild();
    },
    { passive: false },
  );
  canvas().addEventListener('mousedown', (e) => {
    if (!ui.started || isPaused()) return;
    if (relockClick()) {
      canvas().focus();
      return;
    }
    if (e.button === 2) {
      beginCast('R');
      return;
    }
    if (ui.locked && e.button === 0) {
      beginCast('L');
      return;
    }
    if (e.button === 0) {
      ui.downAt = [e.clientX, e.clientY];
      beginCast('L');
    }
    ui.dragging = true;
    ui.lmx = e.clientX;
    ui.lmy = e.clientY;
    if (!ui.locked) tryLock();
    canvas().focus();
    updateResume();
  });
  window.addEventListener('mouseup', (e) => {
    if (gear.hands) {
      if (e.button === 0) releaseCast('L');
      if (e.button === 2) releaseCast('R');
    }
    ui.downAt = null;
    ui.dragging = false;
    updateResume();
  });
  window.addEventListener('mousemove', (e) => {
    if (!ui.started) return;
    if (ui.locked) {
      player.yaw -= e.movementX * 0.0022;
      player.pitch -= e.movementY * 0.0022;
    } else if (ui.dragging) {
      player.yaw -= (e.clientX - ui.lmx) * 0.0045;
      player.pitch -= (e.clientY - ui.lmy) * 0.0045;
      ui.lmx = e.clientX;
      ui.lmy = e.clientY;
    }
    player.pitch = clamp(player.pitch, -1.35, 1.35);
  });
  // 診断の記録（claude.ai の Artifact の中で、持ち主が開いた時だけ。src/lib/diag.ts）
  // 持ち主と分かったら、タイトルを描き直す（［開発用モード］と［自動で試す］を出す）
  void initDiag(() => redrawIntroLater());
  // Esc のキーを処理している間は、マウスを捕まえにいかない（ui.escKey。Esc のキーで掛けたロックは、ブラウザがすぐ外し、外れた事件でメニューが開いてしまうため）
  window.addEventListener('keydown', (e) => {
    ui.escKey = e.code === 'Escape';
    try {
      onKeyDown(e);
    } finally {
      ui.escKey = false;
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    ui.dragging = false;
  });
  // ページが隠れたら（アプリの切り替えなど）、押しているキーと指を離したことにし、溜めている詠唱を散らし、探索中ならメニューを開いて止める（src/lib/screens.ts の menuOnHide）
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    for (const k in keys) keys[k] = false;
    ui.dragging = false;
    releaseTouch();
    if (menuOnHide()) setMenu(true);
  });
}
