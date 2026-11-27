// メニュー（Esc・[メニュー]）と、タイトルへ戻る処理（もとは src/game/27-rune-screen.js と src/game/24-goal.js）。
// 指で遊ぶ時は、操作の案内・年代記・魔導書をメニューの中に開き、[戻る] で一覧に戻る（ui.menuPage）。マウスの時は案内の欄 #help に出す
// （狭い画面では #help を出さず、出してもゲームの画面に重なるため）。
import { must, nth } from './array.ts';
import { resetRunes } from './gear.ts';
import { renderHotbar } from './hotbar.ts';
import { setInv } from './inventory.ts';
import { newLevel, newRun } from './levels.ts';
import { setCamMode, sndToggle, tryLock } from './screens.ts';
import { SND_NAME } from './sound.ts';
import { SND, adv, gear, here, placeMem, player, ui, vfx } from './state.ts';
import { bookRows, chronRows, cycleUi, helpRows, isPaused, renderBook, renderChron, renderStatus, setHelp } from './status.ts';
import { boxText } from './text.ts';

/** 指で遊ぶ時に、メニューの中に開く物を k にする（'' なら一覧）。送った所を一番上に戻す */
export function menuGo(k: string): void {
  ui.menuPage = k;
  renderMenu();
  const el = document.getElementById('menu');
  if (el) el.scrollTop = 0;
}
/** メニューを描く（指で遊ぶ時に開いている物があれば、それと [戻る]） */
export function renderMenu(): void {
  const el = document.getElementById('menu');
  if (!el) return;
  const f = (t: string): string => `<span class="f">${t}</span>`;
  if (ui.menuPage && ui.touch) {
    const rows = (ui.menuPage === 'help' ? helpRows() : ui.menuPage === 'chron' ? chronRows() : bookRows()).slice(0, -1);
    el.innerHTML = boxText([
      ...(rows.length ? rows : [f('+--')]),
      f('|'),
      `${f('|')} <button class="row" data-k="back"><span class="mk"> </span>[戻る]</button>`,
      f('+---'),
    ]);
    for (const b of el.querySelectorAll<HTMLElement>('button.row')) b.onclick = () => menuAct(b.dataset['k']);
    return;
  }
  const items = [
    ['resume', '探索を続ける'],
    ['pack', '持ち物を見る'],
    ['help', `操作の案内`],
    ['chron', '年代記'],
    ['book', '魔導書'],
    ['cam', `視点：${ui.camMode === 'tps' ? '三人称' : '一人称'}`],
    ['ui', `表示：${nth(['通常', '最小', 'なし'], ui.uiMode)}`],
    ['snd', `音量：${nth(SND_NAME, SND.lv)}`],
    ['perf', `速度の表示：${ui.perfOn ? 'オン' : 'オフ'}`],
    ['new', ui.newRunArm > performance.now() ? '本当に最初からやり直す？（もう一度押す）' : '新しい探索を始める'],
    [
      'title',
      ui.gallery ? 'タイトルに戻る' : ui.titleArm > performance.now() ? '本当にタイトルに戻る？（探索は終わる）' : 'タイトルに戻る',
    ],
  ];
  el.innerHTML = boxText([
    f('+-- メニュー --------------------'),
    ...items.map(([k, l]) => `${f('|')} <button class="row" data-k="${k}"><span class="mk"> </span>${l}</button>`),
    f('+--------------------------------'),
  ]);
  for (const b of el.querySelectorAll<HTMLElement>('button.row')) b.onclick = () => menuAct(b.dataset['k']);
}
/** メニューを開く・閉じる（開いている物は一覧に戻し、送った所を一番上に戻す） */
export function setMenu(on: boolean): void {
  ui.menuOpen = on;
  ui.menuPage = '';
  {
    const el = document.getElementById('menu');
    if (el) el.scrollTop = 0;
  }
  document.body.classList.toggle('paused', isPaused());
  const el = document.getElementById('menu');
  if (!el) return;
  el.classList.toggle('show', on);
  if (on) renderMenu();
}
/** メニューの項目 k を押した */
export function menuAct(k: string | undefined): void {
  if (k === 'resume') {
    setMenu(false);
    if (!ui.plFailed) tryLock();
  } else if (k === 'pack') {
    setMenu(false);
    setInv(true);
  } else if (k === 'back') menuGo('');
  else if (ui.touch && (k === 'help' || k === 'chron' || k === 'book')) menuGo(k);
  else if (k === 'help') {
    setHelp(!ui.helpOn);
    ui.helpT = 0;
    renderMenu();
  } else if (k === 'chron') {
    ui.chronOn = !ui.chronOn;
    ui.helpOn = false;
    ui.helpT = 0;
    const el = document.getElementById('help');
    if (el) {
      if (ui.chronOn) renderChron();
      el.classList.toggle('off', !ui.chronOn);
    }
    renderMenu();
  } else if (k === 'book') {
    const el = document.getElementById('help');
    ui.chronOn = false;
    ui.helpOn = false;
    ui.helpT = 0;
    menuAct.book = !menuAct.book;
    if (el) {
      if (menuAct.book) renderBook();
      el.classList.toggle('off', !menuAct.book);
    }
    renderMenu();
  } else if (k === 'cam') {
    setCamMode(ui.camMode === 'tps' ? 'fps' : 'tps');
    renderMenu();
  } else if (k === 'ui') {
    cycleUi();
    renderMenu();
  } else if (k === 'snd') {
    sndToggle();
    renderMenu();
  } else if (k === 'perf') {
    ui.perfOn = !ui.perfOn;
    renderStatus();
    renderMenu();
  } else if (k === 'title') {
    if (ui.gallery || ui.titleArm > performance.now()) {
      ui.titleArm = 0;
      returnToTitle();
    } else {
      ui.titleArm = performance.now() + 4000;
      ui.newRunArm = 0;
      renderMenu();
      menuArmReset();
    }
  } else if (k === 'new') {
    if (ui.newRunArm > performance.now()) {
      ui.newRunArm = 0;
      setMenu(false);
      newRun();
      if (!ui.plFailed) tryLock();
    } else {
      ui.newRunArm = performance.now() + 4000;
      ui.titleArm = 0;
      renderMenu();
      menuArmReset();
    }
  }
}
// 型だけの declare namespace で、関数の欄の型を付ける（組み立てで消える。古い JS の文をそのまま残すため）
export declare namespace menuAct {
  /** 魔導書を案内の欄 #help に出しているか（マウスの時。メニューの「魔導書」で切り替える） */
  let book: boolean | undefined;
}
// the "press again to make sure" of the menu lasts 4 real seconds (game time stands still while the menu is open), then the label goes back.
// Only one of the two is armed at a time. Draw the menu again only when one has run out (so a click in the middle is not lost)
export function menuArmReset(): void {
  setTimeout(() => {
    const now = performance.now(),
      out = (k: number): number | boolean => k && k <= now;
    if (!out(ui.titleArm) && !out(ui.newRunArm)) return;
    if (out(ui.titleArm)) ui.titleArm = 0;
    if (out(ui.newRunArm)) ui.newRunArm = 0;
    if (ui.menuOpen) renderMenu();
  }, 4050);
}

// ---------------------------------------------------------------- back to the title (the run ends)
/** タイトルへ戻る（探索を終え、始める深さの新しい階を作り直して、タイトルの画面を出す） */
export function returnToTitle(): void {
  setMenu(false);
  if (ui.invOpen) setInv(false);
  // 古いブラウザには exitPointerLock が無い（型には必ずある）
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (ui.locked && document.exitPointerLock) document.exitPointerLock();
  ui.started = false;
  adv.dead = false;
  adv.won = false;
  ui.gallery = null;
  gear.castSt = null;
  gear.swapSt = null;
  vfx.zapFlash = null;
  document.body.classList.remove('started');
  const de = document.getElementById('death');
  if (de) de.classList.remove('show', 'won');
  const gp = document.getElementById('gal');
  if (gp) gp.classList.remove('show');
  adv.runSeed = (Math.random() * 1e9) >>> 0;
  here.depth = ui.startDepth;
  here.branch = null;
  here.realm = null;
  here.inter = null;
  placeMem.clear();
  here.arrive = null;
  here.trans = null;
  player.fall = false;
  player.hp = adv.PLAYER_MAX;
  resetRunes();
  newLevel();
  must(ui.introEl, 'タイトルの画面 #intro').classList.remove('gone');
  setHelp(false);
  const st = document.getElementById('stratum');
  if (st) st.classList.remove('show');
  renderStatus();
  renderHotbar();
}
