// 状態の表示と、まわりへの気配（もとは src/game/12-hud-text.js、02-constants.js の placeLabel、06-world.js の showHint、26-spells-hud.js の isPaused、
// 27-rune-screen.js の renderBook・updateSearch）。状態の入れ物 here・player・adv・ui・stealth・lantern・hudInfo・vfx・clock・keys・saved（魔導書）に頼り、画面の #status・#help・#hint に書く。
// 状態の表示（体力・経験・場所・明るさ・伝説の物・見つかっているか・速さ）、明るさと気配の範囲、年代記・操作の案内・魔導書、表示の量、
// 生き物に見つかった時と物音、立ち止まって辺りを調べる、生き物の頭の上の印（世界の中に文字を置く）
import { lookup, must, nth } from './array.ts';
import { sAlarm, sAlert, sChime, sHowl, sRoar } from './audio.ts';
import { cssOf } from './color.ts';
import { G } from './glyphs.ts';
import { bodyN } from './gear.ts';
import { LIGHT_COLS, LIGHT_NAMES, markHeight } from './hud.ts';
import { legendLine } from './legend.ts';
import { cellLight } from './lightmap.ts';
import { msg } from './log.ts';
import { mname } from './names.ts';
import { dyn } from './particles.ts';
import { expNeed } from './progress.ts';
import { clamp } from './rng.ts';
import { REACT } from './runes.ts';
import { type Mob, type Monster, adv, clock, here, hudInfo, keys, lantern, player, saved, stealth, ui, vfx } from './state.ts';
import { SPECIALS } from './strata.ts';
import { boxText, visW } from './text.ts';
import { trialOn } from './unlocks.ts';
import { BRANCHES, CELL, MH, MW, REALMS, TW, TX, cpos } from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/** 止まっているか（装備の画面・メニュー・F2 の画面・祭壇の画面・レベルアップの画面のどれかが開いている） */
export const isPaused = (): boolean =>
  ui.invOpen ||
  ui.menuOpen ||
  ui.dbgOpen ||
  ui.altarOpen ||
  ui.lvlOpen ||
  // 縦向きで止めるのは、生きて探索している間だけ（結果の画面では横にする案内が隠れるので、止めると［新しい探索へ］の後に黙って固まる）
  (ui.portrait && ui.started && !adv.dead);
/** 今いる場所の名前（特別な階・異界・支道とその階、ふつうの階は深さ） */
export function placeLabel(): string {
  if (here.inter) return lookup(SPECIALS, here.inter.key).name;
  if (here.realm) return lookup(REALMS, here.realm.key).name;
  if (here.branch) return `${lookup(BRANCHES, here.branch.key).name} ${here.branch.lvl}/${here.branch.len}`;
  return String(here.depth);
}
/** 画面の下の一言（同じなら書き直さない）。出した番号を返す（呼ぶたびに増える。clearHint に渡す） */
export function showHint(h: string): number {
  const n = ++ui.hintSeq;
  if (h === ui.hintHTML) return n;
  ui.hintHTML = h;
  const el = document.getElementById('hint');
  if (el) el.innerHTML = h;
  return n;
}
/** 番号 n の一言を消す。その後に別の一言が出ていれば（showHint が呼ばれていれば）、消さない */
export function clearHint(n: number): void {
  if (ui.hintSeq === n) showHint('');
}
/** 画面の下に一言を出し、ms ミリ秒後に消す（その間に別の一言が出ていれば、消さない） */
export function flashHint(h: string, ms: number): void {
  const n = showHint(h);
  setTimeout(() => clearHint(n), ms);
}

/**
 * 明るさと気配：足元の明るさ（灯り・光る生き物・手元の灯り）から明るさの段を決め、生き物に気づかれる範囲と手元の灯りを変える。
 * 段か忍び足か見つかっているかが変わったら、状態の表示を描き直す
 */
export function updateStealth(dt: number): void {
  const l = cellLight(player.x, player.z);
  let L = 0.3 * nth(l, 0) + 0.55 * nth(l, 1) + 0.15 * nth(l, 2);
  for (const m of here.monsters) {
    if (m.ty.light > 0 && !m.ty.invisible && (m.ty.form !== 'eel' || (m.surf ?? NaN) > 0)) {
      const d = Math.hypot(m.x - player.x, m.z - player.z);
      if (d < m.ty.light) L += (1 - d / m.ty.light) ** 2 * 0.6;
    }
  }
  L += stealth.sneak ? 0.02 : 0.12;
  stealth.lum += (L - stealth.lum) * Math.min(1, dt * 4);
  stealth.level = stealth.lum < 0.25 ? 0 : stealth.lum < 0.85 ? 1 : 2;
  const moving = Math.hypot(player.vx, player.vz) > 0.3,
    running = moving && (keys['ShiftLeft'] || keys['ShiftRight']) && !stealth.sneak;
  stealth.range =
    nth([4.5, 8, 14], stealth.level) *
    (stealth.sneak ? 0.6 : 1) *
    (running ? 1.6 : moving ? 1 : 0.75) *
    Math.max(0.4, 1 - 0.25 * bodyN('hush')) *
    (trialOn('dusk') ? 0.7 : 1);
  lantern.r += ((stealth.sneak ? 3.4 : 8.2) * (trialOn('dusk') ? 0.6 : 1) - lantern.r) * Math.min(1, dt * 3);
  lantern.k += ((stealth.sneak ? 0.35 : 1) - lantern.k) * Math.min(1, dt * 3);
  const seen = here.monsters.some((m) => m.noticed && !m.dead && Math.hypot(m.x - player.x, m.z - player.z) < 26);
  const key = stealth.level + '|' + stealth.sneak + '|' + seen;
  stealth.seen = seen;
  if (key !== stealth.hudKey) {
    stealth.hudKey = key;
    renderStatus();
  }
}
/** 状態の表示：体力（取り戻せる体力も）・経験とレベル・場所・明るさの段・伝説の物・見つかっているか・速さ（速さの表示がオンの時） */
export function renderStatus(): void {
  const el = document.getElementById('status');
  if (!el || !here.D) return;
  const lv = stealth.level,
    lc = LIGHT_COLS[lv];
  const meter = ['.', ':', '*']
    .map((g, k) => (k <= lv ? `<span class="glow" style="color:${String(lc)}">${g}</span>` : `<span class="dim">${g}</span>`))
    .join(' ');
  let l4 = '';
  if (stealth.seen) l4 += '<span class="glow" style="color:#ff6a4a">!</span> <span class="lab">見つかっている</span>';
  const hp = player.hp || 0,
    hpR = clamp(hp / adv.PLAYER_MAX, 0, 1),
    hpN = Math.round(hpR * 20),
    rlN = Math.max(0, Math.min(20 - hpN, Math.round(clamp((hp + (player.rally || 0)) / adv.PLAYER_MAX, 0, 1) * 20) - hpN)),
    hpC = vfx.hpFlash > 0 ? '#fff0d8' : hpR > 0.5 ? '#ff8a7a' : hpR > 0.25 ? '#ffb05a' : '#ff4a3a';
  const hpLine = `<span class="glow" style="color:${hpC}">${'#'.repeat(hpN)}</span><span style="color:#d9874a">${'='.repeat(rlN)}</span><span class="dim">${'.'.repeat(20 - hpN - rlN)}</span>  <span class="lab">体力 ${Math.ceil(hp)}/${adv.PLAYER_MAX}</span>`;
  const xf = Math.round(clamp(adv.lvl.exp / expNeed(adv.lvl.n), 0, 1) * 20),
    xpLine = `<span style="color:#c8b6ff">${'-'.repeat(xf)}</span><span class="dim">${'.'.repeat(20 - xf)}</span>  <span class="lab">Lv${adv.lvl.n}</span>`;
  el.innerHTML =
    hpLine +
    '\n' +
    xpLine +
    `\n<span class="glow" style="color:#ffbf6a">&gt; ${placeLabel()}</span>\n${meter}  <span class="lab">${String(LIGHT_NAMES[lv])}</span>` +
    (ui.started ? '\n' + legendLine() : '') +
    (l4 ? '\n' + l4 : '') +
    (ui.perfOn
      ? `\n<span class="lab">${hudInfo.pfFps} fps   文字 ${(hudInfo.glyphCount / 10000).toFixed(1)}万   描画 ${(hudInfo.chunksDrawn / 10000).toFixed(1)}万   生き物 ${here.monsters.length}</span>`
      : '');
}
const f = (t: string): string => `<span class="f">${t}</span>`;
/** 年代記の枠の行（この探索の文明と、王たちの出来事。年代記が無ければ空）。案内の欄 #help と、指で遊ぶ時のメニューの中に出す */
export function chronRows(): string[] {
  const H = adv.HIST;
  if (!H) return [];
  const lines = [f(`+-- 年代記 ── ${H.civ.name}（${H.civ.ep}）`)];
  H.events.forEach((e) => {
    const r = nth(H.rulers, e.ruler);
    lines.push(`${f('|')} <b>${r.title} ${r.name}</b>`);
    lines.push(`${f('|')}   ${e.text}`);
  });
  lines.push(f('+------------------------------'));
  return lines;
}
/** 年代記を、案内の欄 #help に書く */
export function renderChron(): void {
  const el = document.getElementById('help');
  if (!el || !adv.HIST) return;
  el.innerHTML = boxText(chronRows());
}
/**
 * 操作の案内の枠の行（操作と、今の深さ・場所・見たマスの割合・シード）。案内の欄 #help と、指で遊ぶ時のメニューの中に出す。
 * 指で遊んでいる時は、指の操作（src/lib/touchpad.ts）の説明にする
 */
export function helpRows(): string[] {
  const K = (t: string): string => `<b>${t}</b>${' '.repeat(Math.max(1, 15 - visW(t)))}`;
  const keysRows = ui.touch
    ? [
        `${f('|')} ${K('左半分')}押すとスティック。倒して移動、端まで倒すと走る`,
        `${f('|')} ${K('右半分')}なぞって視点`,
        `${f('|')} ${K('[右手] [左手]')}押して詠唱、満ちたら離して放つ`,
        `${f('|')} ${K('[回避]')}転がってかわす`,
        `${f('|')} ${K('[持ち替え]')}次のビルドへ（2つ以上保存した時に出る）`,
        `${f('|')} ${K('[装備]')}装備の画面`,
        `${f('|')} ${K('[メニュー]')}メニュー`,
        `${f('|')} 選ぶ画面は、1回押すと説明、もう1回で決まる`,
      ]
    : [
        `${f('|')} <b>WASD</b>     移動        <b>マウス</b>  視点`,
        `${f('|')} <b>左クリック</b> 左手      <b>右クリック</b> 右手`,
        `${f('|')} 押して詠唱、満ちたら離して放つ`,
        `${f('|')} <b>ホイール</b> ビルド切替  <b>Space</b>  回避`,
        `${f('|')} <b>Shift</b>    走る`,
        `${f('|')} <b>Tab</b>      装備        <b>Esc</b>    メニュー`,
      ];
  return [
    f('+-- 操作 ----------------------'),
    ...keysRows,
    `${f('|')} 立ち止まると、辺りを自動で調べる`,
    f('|'),
    `${f('|')} 深度 ${here.depth}${here.branch || here.realm ? `（${placeLabel()}）` : ''}    地図 ${hudInfo.explored}%`,
    `${f('|')} シード ${adv.runSeed}`,
    f('+------------------------------'),
  ];
}
/** 操作の案内を、案内の欄 #help に書く */
export function renderHelp(): void {
  const el = document.getElementById('help');
  if (!el || !here.D) return;
  el.innerHTML = boxText(helpRows());
}
/** 操作の案内を出す・消す（年代記と魔導書は閉じる） */
export function setHelp(on: boolean): void {
  ui.helpOn = on;
  ui.chronOn = false;
  ui.bookOn = false;
  const el = document.getElementById('help');
  if (!el) return;
  if (on) renderHelp();
  el.classList.toggle('off', !on);
}
/** 魔導書の枠の行（見つけた反応と、まだ見ていない反応）。案内の欄 #help と、指で遊ぶ時のメニューの中に出す */
export function bookRows(): string[] {
  return [
    f('+-- 魔導書 ── 見つけた反応'),
    ...Object.entries(REACT).map(([k, r]) =>
      saved.BOOK.has(k)
        ? `${f('|')} <b>${r.name}</b>  <span class="lab">${r.pair}</span>\n${f('|')}   ${r.desc}`
        : `${f('|')} <span class="dim">？？？　まだ見ていない</span>`,
    ),
    f('|'),
    `${f('|')} <span class="lab">両手に違う性質を宿し、同じ敵に重ねると何かが起きる</span>`,
    `${f('|')} <span class="lab">記録は探索をまたいで残る</span>`,
    f('+------------------------------'),
  ];
}
/** 魔導書を、案内の欄 #help に書く */
export function renderBook(): void {
  const el = document.getElementById('help');
  if (!el) return;
  el.innerHTML = boxText(bookRows());
}
/** 表示の量を、通常・最小・なしの順に変える（なし以外は、画面の下に少しの間だけ出す） */
export function cycleUi(): void {
  ui.uiMode = (ui.uiMode + 1) % 3;
  document.body.classList.toggle('ui-min', ui.uiMode === 1);
  document.body.classList.toggle('ui-none', ui.uiMode === 2);
  if (ui.uiMode < 2) {
    flashHint(ui.uiMode === 0 ? '表示：通常' : '表示：最小', 1200);
  }
}
/**
 * 生き物 m がこちらに気づいた。監視の機械は警報を鳴らして周りを起こし、野営の群れは遠吠えで仲間を起こし、猟犬は遠吠えを上げ、
 * 忘れられた獣は目を覚ます（伝言を出してここで終わる）。ほかは群れごと気づき、同じ群れの伝言は12秒あける
 */
export function onNoticed(m: Mob): void {
  if (m.ty.watcher && !m.alarmed) {
    m.alarmed = true;
    sAlarm(m.x, m.z);
    vfx.shake = Math.max(vfx.shake, 0.15);
    msg(`<b style="color:${cssOf(m.ty.col)}">R</b>${mname(m)}が赤い光を明滅させ、警報を鳴らした！`);
    for (const o of here.monsters) {
      if (o === m || o.ty.critter || o.dead) continue;
      if (Math.hypot(o.x - m.x, o.z - m.z) < 22) {
        o.sleep = false;
        o.aware = Math.max(o.aware ?? NaN, 1.05);
      }
    }
  }
  if (m.ty.snap && !m.howled) {
    for (const o of here.monsters) if (o.ty.snap) o.howled = true;
    sHowl(m.x, m.z);
    msg(`<b style="color:${cssOf(m.ty.col)}">s</b>${mname(m)}が遠吠えを上げた。野営地じゅうが、こちらを向く。`);
    for (const o of here.monsters) {
      if (!o.ty.snap || o === m) continue;
      if (Math.hypot(o.x - m.x, o.z - m.z) < 30) {
        o.sleep = false;
        o.aware = Math.max(o.aware ?? NaN, 1.05);
      }
    }
  }
  if (m.ty.hound && !m.howled) {
    for (const o of here.monsters) if (o.g === m.g) o.howled = true;
    sHowl(m.x, m.z);
  }
  if (m.ty.beast && !m.woke) {
    m.woke = true;
    m.noticed = true;
    m.sleep = false;
    m.aware = 1.25;
    vfx.shake = Math.max(vfx.shake, 0.6);
    sRoar();
    msg(`<b style="color:${cssOf(m.ty.col)}">X</b>${mname(m)}が目を覚まし、こちらを見た。`);
    msg(`<b style="color:${cssOf(m.ty.col)}">X</b>──年代記に記された、あの獣だ。${String(m.ty.lore)}`);
    return;
  }
  const g = m.g ?? NaN,
    grp = g >= 0 ? here.monsters.filter((o) => o.g === m.g) : [m];
  for (const o of grp) {
    o.noticed = true;
    o.sleep = false;
    o.aware = Math.max(o.aware ?? NaN, 1);
    o.mark = 0;
  }
  const k = g >= 0 ? 'g' + g : 'm' + here.monsters.indexOf(m);
  if (clock.time - (ui.noticeMsgT[k] || -99) > 12) {
    ui.noticeMsgT[k] = clock.time;
    msg(`<b style="color:#ff6a4a">!</b>${mname(m)}${grp.length > 1 ? 'の群れ' : ''}があなたに気づいた！`);
    sAlert(m.x, m.z);
  }
}
/** 物音（x・z から r まで。近いほど、生き物の気づく度合いを amt まで上げる。0.35 を超えた眠っている生き物は起きる） */
export function makeNoise(x: number, z: number, r: number, amt: number): void {
  for (const m of here.monsters) {
    const d = Math.hypot(m.x - x, m.z - z);
    if (d > r) continue;
    m.aware = Math.min(1.25, (m.aware ?? NaN) + amt * (1 - d / r));
    if (m.sleep && m.aware > 0.35) {
      m.sleep = false;
      m.wait = 0.6;
    }
  }
}
/** 飛ぶ生き物が通れる所か（マップの中で、壁と水晶の塊のほか） */
export const flyOpen = (x: number, z: number): boolean => {
  const cx = Math.floor(x / CELL),
    cz = Math.floor(z / CELL);
  if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) return false;
  const tt = level().tile[cz * MW + cx];
  return tt !== TW && tt !== TX;
};
/**
 * 立ち止まって辺りを調べる：1.5秒立ち止まると、そのマスで一度だけ、近くの隠された罠（4.5マス）と、化けた生き物（9）を見つける。
 * 見つけたら、音と伝言で知らせる
 */
export function updateSearch(dt: number): void {
  const still = Math.hypot(player.vx, player.vz) < 0.3,
    pc = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL);
  if (!still) {
    player.stillT = 0;
    return;
  }
  player.stillT += dt;
  if (player.stillT < 1.5 || player.searchedAt === pc) return;
  player.searchedAt = pc;
  let found = 0;
  for (const tr of level().traps || []) {
    if (!tr.hidden) continue;
    const [x, z] = cpos(tr.i);
    if (Math.hypot(x - player.x, z - player.z) < CELL * 4.5) {
      tr.hidden = false;
      found++;
    }
  }
  let mim = 0;
  for (const m of here.monsters) {
    if (m.hidden && Math.hypot(m.x - player.x, m.z - player.z) < 9) {
      m.revealNow = true;
      mim++;
    }
  }
  if (found || mim) {
    sChime(player.x, player.z, 0.2);
    msg(
      `<b style="color:#bfe4ff">?</b>立ち止まって辺りを見回した。${found ? `隠された罠を${found}つ見つけた。` : ''}${mim ? '浮かんでいた巻物が、ぴくりと動いた。' : ''}`,
    );
  }
}

/**
 * 生き物の頭の上の印（もとは src/game/12-hud-text.js）：眠っている z（上へ流れる2つ）・気づいた !（出た時に大きく）・怪しんでいる ?。
 * 争わない生き物・見えていない生き物・見えない生き物と、22より遠い（dp はカメラからの距離）時は出さない。近いほど暗くする
 */
export function drawMark(m: Monster, t: number, dp: number): void {
  if (m.ty.peaceful || !m.visible || m.ty.invisible || dp > 22) return;
  m.mark = (m.mark ?? NaN) + 1 / 60;
  const y = (m.y ?? NaN) + markHeight(m.ty),
    near = clamp(dp / 4, 0.5, 1);
  if (m.sleep) {
    for (let k = 0; k < 2; k++) {
      const q = (t * 0.45 + k * 0.5) % 1;
      dyn(
        m.x + q * 0.25,
        y + q * 0.45,
        m.z,
        G('z'),
        (0.16 + 0.1 * (1 - q)) * (k ? 0.8 : 1),
        0.55 * (1 - q) * near,
        0.6 * (1 - q) * near,
        1.0 * (1 - q) * near,
      );
    }
  } else if (m.noticed) {
    const pop = 1 + Math.max(0, 1 - m.mark * 3) * 0.6;
    dyn(m.x, y + Math.sin(t * 6) * 0.03, m.z, G('!'), 0.36 * pop, 2.4 * near, 0.55 * near, 0.3 * near);
  } else if ((m.aware ?? NaN) > 0.35) {
    dyn(m.x, y + Math.sin(t * 3) * 0.04, m.z, G('?'), 0.32, 2.0 * near, 1.7 * near, 0.5 * near);
  }
}
