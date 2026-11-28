// レベルアップの画面と祭壇の画面（どちらも #altarp に描く。開いている間は、ゲームが止まる）。
// レベルアップ：敵を倒して経験が貯まると、時が止まり、3つから1つを選ぶ（恩恵（加護。行いと性質に結び付いた強さ。代償のある物も）を2つと、ルーンか護符を1つ）。
// 最大体力はレベルでは増えない（新しい層に入るたびに 4 増える）。
// 祭壇の画面：灯った祭壇の近くで、3つの選択肢を並べる。クリックで選ぶ。
import { lookup, must, nth } from './array.ts';
import { altarDetail, altarLine, altarOpts, guardedNow, takeRune } from './altars.ts';
import { cssOf } from './color.ts';
import { makeRune, makeStrong, randomRuneType } from './gear.ts';
import type { Item } from './generate.ts';
import { renderHotbar } from './hotbar.ts';
import { ALTAR_W } from './hud.ts';
import { msg } from './log.ts';
import { BL } from './monsters.ts';
import { grabItem } from './pickup.ts';
import { BLESS } from './progress.ts';
import { keyedRand, shuffle } from './random.ts';
import { CAT_BR, CAT_NAME, RUNE_DEF, RUNE_TYPES, detailLines, runeCol, runeName } from './runes.ts';
import { tryLock, updateResume } from './screens.ts';
import { lockedOf } from './unlocks.ts';
import { type LevelOpt, adv, fight, gear, here, player, ui } from './state.ts';
import { isPaused, renderStatus } from './status.ts';
import { boxText, clipHtml, padTo, visW, wrapPlain } from './text.ts';
import { byInput, confirmTap } from './touch.ts';
import { cpos } from './world.ts';

const level = () => must(here.D, '今の階 here.D');

// ---------------------------------------------------------------- レベルアップ
// the choices come from their own random, made from the run's seed and which level this is (keyedRand), not the look random (mr): same seed, same choices. r is for tests
/** レベルアップの3つの選択肢（恩恵2つと、ルーンか護符1つ。初めてのレベルアップでは、恩恵は行いに結び付いた物から選ぶ） */
export function levelChoices(r = keyedRand('levelup', adv.runSeed, adv.lvl.n - adv.lvl.pending + 1)): LevelOpt[] {
  const BEHAVE = ['quickdodge', 'counter', 'momentum', 'devour', 'shatter', 'charge', 'swapedge', 'branch'];
  let pool = Object.keys(BLESS).filter((k) => BL(k) < 2 && !lockedOf('bless', k)),
    out: LevelOpt[] = [];
  if (!adv.lvl.firstDone) {
    const b = pool.filter((k) => BEHAVE.includes(k));
    if (b.length >= 2) pool = b;
    adv.lvl.firstDone = true;
  }
  for (let i = 0; i < 2 && pool.length; i++) {
    const k = nth(pool.splice(Math.floor(r() * pool.length), 1), 0);
    out.push({ kind: 'bless', k });
  }
  const useCharm = (adv.runState.bodyOpen || 0) > 0 && r() < 0.3,
    t = useCharm
      ? nth(RUNE_TYPES.body, Math.floor(r() * RUNE_TYPES.body.length))
      : randomRuneType(r, { elem: 0.45, trig: 0.15, mod: 0.4, body: 0 });
  out.push({ kind: 'rune', ru: lookup(RUNE_DEF, t).cat === 'mod' && r() < 0.1 ? makeStrong(t) : makeRune(t) });
  return shuffle(out, r);
}
/** レベルアップの画面の、選択肢の1行 */
export function lvlLine(o: LevelOpt): string {
  const K = (t: string): string => t + ' '.repeat(Math.max(2, 14 - visW(t))); // the label column is 14 wide (the longest, 恩恵（代償）, is 12)
  if (o.kind === 'bless') {
    const B = lookup(BLESS, o.k),
      l = BL(o.k) + 1;
    return `${K(B.cost ? '恩恵（代償）' : '恩恵')}<span style="color:${B.cost ? '#ff9a8a' : '#ffe3a0'}">${B.name}${l > 1 ? ' II' : ''}</span>`;
  }
  const d = lookup(RUNE_DEF, o.ru.type),
    br = CAT_BR[d.cat] || ['', ''];
  return `${K(d.cat === 'body' ? '護符' : 'ルーン')}${br[0]}<b class="rn" style="color:${cssOf(runeCol(o.ru))}">${d.ch}</b> ${runeName(o.ru)}${br[1]}　<span class="lab">${CAT_NAME[d.cat]}</span>`;
}
/** レベルアップの画面を描く（初めて描く時に、マウスを乗せた時とクリックの処理を付ける） */
export function renderLevelUp(): void {
  const el = document.getElementById('altarp');
  if (!el) return;
  const f = (t: string): string => `<span class="f">${t}</span>`,
    rows = [f(`+-- レベルが上がった（Lv${adv.lvl.n - adv.lvl.pending + 1}） ---`), f('|')];
  ui.lvlOpts.forEach((o, i) => rows.push(`${f('|')}  <button class="row ao" data-lk="${i}">${clipHtml(lvlLine(o), ALTAR_W - 6)}</button>`));
  rows.push(f('|'));
  for (let i = 0; i < 5; i++) rows.push(`${f('|')} <span class="ldet">${padTo('', ALTAR_W - 3)}</span>`);
  rows.push(
    f('|'),
    `${f('|')} <span class="lab">${byInput('マウスを乗せると説明が出る。クリックで選ぶ', '1回押すと説明が出る。もう1回押すと決まる')}</span>`,
    f('+---'),
  );
  el.innerHTML = boxText(rows, ALTAR_W);
  setLevelDetail(null);
  if (!el.dataset['lvBound']) {
    el.dataset['lvBound'] = '1';
    el.addEventListener('mouseover', (e) => {
      if (!ui.lvlOpen || ui.touch) return;
      // oxlint-disable-next-line typescript/consistent-type-assertions -- 押された所は画面の部品（元の読み方のまま）
      const b = (e.target as Element).closest && (e.target as Element).closest<HTMLElement>('button[data-lk]');
      setLevelDetail(b ? ui.lvlOpts[+(b.dataset['lk'] ?? NaN)] : null);
    });
    el.addEventListener('click', (e) => {
      if (!ui.lvlOpen) return;
      // oxlint-disable-next-line typescript/consistent-type-assertions -- 押された所は画面の部品（元の読み方のまま）
      const b = (e.target as Element).closest && (e.target as Element).closest<HTMLElement>('button[data-lk]');
      if (!b) return;
      e.stopPropagation();
      if (performance.now() - ui.lvlOpenT < 400) return;
      // 指なら、1回目は選んで説明を出すだけ、2回目で決める（confirmTap。マウスを乗せた時の説明は、指の時は出さない：iPhone は乗せた時に中身が変わると、最初のタップの click を出さないことがある）
      if (!confirmTap('lv' + ui.lvlOpenT + ':' + b.dataset['lk'])) {
        setLevelDetail(ui.lvlOpts[+(b.dataset['lk'] ?? NaN)]);
        el.querySelectorAll('button.armed').forEach((x) => x.classList.remove('armed'));
        b.classList.add('armed');
        return;
      }
      chooseLevel(+(b.dataset['lk'] ?? NaN));
    });
  }
}
/** レベルアップの画面の、下の説明の4行（選択肢 o の説明。無ければ案内） */
export function setLevelDetail(o: LevelOpt | null | undefined): void {
  const el = document.getElementById('altarp');
  if (!el) return;
  let L: string[];
  if (!o) L = [`<span class="lab">${byInput('選択肢にマウスを乗せると', '選択肢を押すと')}、ここに説明が出る</span>`, '', '', '', ''];
  else if (o.kind === 'bless') {
    const B = lookup(BLESS, o.k),
      l = BL(o.k) + 1,
      w = wrapPlain(B.d(l), ALTAR_W - 10);
    L = [
      `<span style="color:${B.cost ? '#ff9a8a' : '#ffe3a0'}">${B.name}${l > 1 ? ' II（2回目で強まる）' : ''}</span>　<span class="lab">（恩恵${B.cost ? '・代償あり' : ''}）</span>`,
      ...w.slice(0, 4).map((t) => `    <span class="lab">${t}</span>`),
    ];
  } else L = detailLines(o.ru);
  el.querySelectorAll('.ldet').forEach((sp, i) => {
    sp.innerHTML = padTo(clipHtml(L[i] || '', ALTAR_W - 4), ALTAR_W - 3);
  });
}
/** レベルアップの画面を開く（ゲームを止め、溜めている詠唱を散らし、マウスを放す） */
export function openLevelUp(): void {
  const el = document.getElementById('altarp');
  if (!el || ui.lvlOpen) return;
  ui.lvlOpen = true;
  ui.lvlOpenT = performance.now();
  ui.lvlOpts = levelChoices();
  document.body.classList.toggle('paused', true);
  document.body.classList.add('choosing');
  if (gear.castSt) {
    gear.castSt = null;
    fight.beamSegs = [];
  }
  // 古いブラウザには exitPointerLock が無い（型には必ずある）
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (ui.locked && document.exitPointerLock) document.exitPointerLock();
  renderLevelUp();
  el.classList.add('show', 'open');
}
/** レベルアップの i 番目の選択肢を選ぶ（まだ上がった分が残っていれば、次の選択肢を出す。無ければ閉じる） */
export function chooseLevel(i: number): void {
  const o = ui.lvlOpts[i];
  if (!o) return;
  if (o.kind === 'bless') {
    adv.lvl.bless[o.k] = BL(o.k) + 1;
    if (o.k === 'tough') {
      adv.PLAYER_MAX += 6;
      player.hp = Math.min(adv.PLAYER_MAX, player.hp + 6);
    }
    msg(`<b style="color:#ffe3a0">+</b>恩恵「${lookup(BLESS, o.k).name}」を得た。${lookup(BLESS, o.k).d(BL(o.k))}。`);
  } else takeRune(o.ru);
  adv.lvl.pending = Math.max(0, adv.lvl.pending - 1);
  renderStatus();
  renderHotbar();
  if (adv.lvl.pending > 0) {
    ui.lvlOpenT = performance.now();
    ui.lvlOpts = levelChoices();
    renderLevelUp();
    return;
  }
  ui.lvlOpen = false;
  const el = document.getElementById('altarp');
  if (el) el.classList.remove('show', 'open');
  document.body.classList.toggle('paused', isPaused());
  document.body.classList.toggle('choosing', ui.altarOpen);
  if (!ui.plFailed && ui.started && !adv.dead) tryLock();
  updateResume();
}

// ---------------------------------------------------------------- 祭壇の画面
/** 祭壇の画面を描く（選択肢が無ければ閉じる。初めて描く時に、クリック・マウスを乗せた時・右クリックの処理を付ける） */
export function renderAltar(): void {
  const el = document.getElementById('altarp');
  if (!el) return;
  const opts = altarOpts();
  if (!opts.length) {
    closeAltar(false);
    return;
  }
  const o0 = nth(opts, 0);
  const f = (t: string): string => `<span class="f">${t}</span>`,
    rows = [
      f(o0.lord ? '+-- 主の祭壇 ---' : o0.opt === 'open' ? '+-- 空の枠 ---' : o0.forge ? '+-- 鍛えの祭壇 ---' : '+-- ルーンの祭壇 ---'),
      f('|'),
    ];
  for (const o of opts) rows.push(`${f('|')}  <button class="row ao" data-k="${o.slot}">${clipHtml(altarLine(o), ALTAR_W - 6)}</button>`);
  rows.push(f('|'));
  for (let i = 0; i < 5; i++) rows.push(`${f('|')} <span class="adet">${padTo('', ALTAR_W - 3)}</span>`);
  rows.push(
    f('|'),
    `${f('|')} <span class="lab">${byInput('クリックで選ぶ　Esc・右クリックでやめる', '1回押すと説明、もう1回で決まる')}</span>　<button class="row" data-cancel="1">[やめる]</button>`,
  );
  if (o0.opt !== 'open' && !o0.forge)
    rows.push(
      `${f('|')} <span class="lab">ルーンは袋に入る。祭壇のそばでは、${byInput('Tab', '[装備]')} の付け替えに詠唱はいらない</span>`,
    );
  rows.push(f('+---'));
  el.innerHTML = boxText(rows, ALTAR_W);
  setAltarDetail(null);
  if (!el.dataset['bound']) {
    el.dataset['bound'] = '1';
    el.addEventListener('click', (e) => {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- 押された所は画面の部品（元の読み方のまま）
      const b = (e.target as Element).closest && (e.target as Element).closest<HTMLElement>('button');
      if (!b || !ui.altarOpen) return;
      e.stopPropagation();
      if (b.dataset['cancel']) {
        closeAltar(true);
        return;
      }
      // 指なら、1回目は選んで説明を出すだけ、2回目で決める（レベルアップの画面と同じ）
      if (b.dataset['k'] !== undefined && !confirmTap('altar' + ui.altarOpenT + ':' + b.dataset['k'])) {
        setAltarDetail(altarOpts().find((o) => o.slot === +(b.dataset['k'] ?? NaN)));
        el.querySelectorAll('button.armed').forEach((x) => x.classList.remove('armed'));
        b.classList.add('armed');
        return;
      }
      if (b.dataset['k'] !== undefined) chooseAltar(+(b.dataset['k'] ?? NaN));
    });
    el.addEventListener('mouseover', (e) => {
      if (!ui.altarOpen || ui.touch) return;
      // oxlint-disable-next-line typescript/consistent-type-assertions -- 押された所は画面の部品（元の読み方のまま）
      const b = (e.target as Element).closest && (e.target as Element).closest<HTMLElement>('button[data-k]');
      setAltarDetail(b ? altarOpts().find((o) => o.slot === +(b.dataset['k'] ?? NaN)) : null);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (ui.altarOpen) closeAltar(true);
    });
  }
}
/** 祭壇の画面の、下の説明の5行（選択肢 o の説明。無ければ案内） */
export function setAltarDetail(o: Item | null | undefined): void {
  const el = document.getElementById('altarp');
  if (!el) return;
  const L = altarDetail(o);
  el.querySelectorAll('.adet').forEach((sp, i) => {
    sp.innerHTML = padTo(clipHtml(L[i] || '', ALTAR_W - 4), ALTAR_W - 3);
  });
}
/** 祭壇の画面を開く（ゲームを止め、溜めている詠唱を散らし、マウスを放す） */
export function openAltar(): void {
  const el = document.getElementById('altarp');
  if (!el) return;
  ui.altarOpen = true;
  ui.altarOpenT = performance.now();
  document.body.classList.toggle('paused', true);
  document.body.classList.add('choosing');
  if (gear.castSt) {
    gear.castSt = null;
    fight.beamSegs = [];
  }
  // 古いブラウザには exitPointerLock が無い（型には必ずある）
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (ui.locked && document.exitPointerLock) document.exitPointerLock();
  renderAltar();
  el.classList.add('show', 'open');
  renderHotbar();
}
/** 祭壇の画面を閉じる。dismiss なら、プレイヤーが閉じた（離れて戻るまで、また開かない） */
export function closeAltar(dismiss: boolean): void {
  const el = document.getElementById('altarp');
  ui.altarOpen = false;
  if (dismiss) ui.altarDismissed = ui.altarNear;
  if (el) el.classList.remove('show', 'open');
  document.body.classList.toggle('paused', isPaused());
  document.body.classList.toggle('choosing', ui.lvlOpen);
  if (!ui.plFailed && ui.started && !adv.dead) tryLock();
  updateResume();
}
/**
 * 毎フレーム：上がったレベルがあれば、レベルアップの画面を開く。祭壇の画面が開いていれば、階が無い・死んだ・選択肢が無い時に閉じる。
 * 閉じていれば、灯った祭壇の真ん中の台から1.5より近い時に開く（プレイヤーが閉じた祭壇は、離れるまで開かない）
 */
export function updateAltarPanel(): void {
  const el = document.getElementById('altarp');
  if (!el) return;
  if (ui.lvlOpen) return;
  if (adv.lvl.pending > 0 && ui.started && !adv.dead && !isPaused()) {
    openLevelUp();
    return;
  }
  if (ui.altarOpen) {
    if (!here.D || !ui.started || adv.dead || !altarOpts().length) closeAltar(false);
    return;
  }
  ui.altarNear = null;
  if (ui.started && !adv.dead && !isPaused() && here.D) {
    let best: Item | null = null,
      bd = 1.5;
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- items はいつもある
    for (const it of here.D.items || []) {
      if (it.taken || !it.altar || !it.rune || it.slot !== 1) continue;
      if (it.guardG !== undefined && guardedNow(it)) continue;
      const [x, z] = cpos(it.i),
        d = Math.hypot(x - player.x, z - player.z);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    if (best) ui.altarNear = must(best.grp, '祭壇の組');
  }
  // 止まっている間（装備の画面・メニューなど）は、近くの祭壇が無いことにするが、閉じた記録は消さない（離れるまで開かない）
  if (!ui.altarNear) {
    if (!(ui.started && !adv.dead && here.D && isPaused())) ui.altarDismissed = null;
    if (el.classList.contains('show')) el.classList.remove('show', 'open');
    return;
  }
  if (ui.altarDismissed === ui.altarNear) return;
  openAltar();
}
/** 近くの祭壇の n 番目の台の物を取る（ルーンは袋に入る）。取れたら true */
export function chooseAltar(n: number): boolean {
  if (!ui.altarNear) return false;
  const k = level().items.findIndex((o) => o.grp === ui.altarNear && o.slot === n && !o.taken);
  if (k < 0) return false;
  const it = nth(level().items, k);
  const [x, z] = cpos(it.i);
  if (!it.opt || it.opt === 'rune') grabItem(it, k, x + ((it.slot ?? NaN) - 1) * 0.55, z, 'bag');
  else grabItem(it, k, x + ((it.slot ?? NaN) - 1) * 0.55, z);
  if (ui.altarOpen) closeAltar(false);
  return true;
}
