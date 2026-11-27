// 階のシード（もとは src/game/18-level-player.js）と、最深部か（もとは 24-goal.js）、特別な階の場所（もとは 02-constants.js）と、
// 階を移る処理の部品（場所の名前・次の場所へ進む・階を作る・最深部の支度・層の名前・部屋の出来事・見えるマス）。
// 状態の入れ物 adv（探索）・here（今いる場所）・player・ui に頼る物。
import { lookup, must, nth } from './array.ts';
import { MTYPES } from './creatures.ts';
import { makeRune, applyOpen, resetRunes } from './gear.ts';
import { type Level, generateLevel } from './generate.ts';
import { tallAt, initFire } from './ground.ts';
import { makeHistory } from './history.ts';
import { legendAll, descentSealed } from './legend.ts';
import { msg } from './log.ts';
import { mr, keyedRand, roll } from './random.ts';
import { clamp } from './rng.ts';
import { took } from './took.ts';
import { rollTraits } from './runes.ts';
import {
  adv,
  here,
  placeMem,
  player,
  ui,
  blaze,
  buf,
  edge,
  fight,
  gear,
  gfx,
  hudInfo,
  iceT,
  keys,
  lantern,
  saved,
  stealth,
  vfx,
  clock,
} from './state.ts';
import { renderStatus, renderHelp, showHint } from './status.ts';
import { SPECIALS } from './strata.ts';
import { weaponPool, unlocked } from './unlocks.ts';
import { BRANCHES, CELL, FINAL_DEPTH, MH, MW, NCELL, TF, TP, TW, LQ_DEEP, LQ_WATER, REALMS } from './world.ts';
import { MACHINE_INFO } from './names.ts';
import { awardLore, graveCandidates, graveRows, loreRows, resultPlace, saveGrave } from './results.ts';
import { boxText } from './text.ts';
import { buildWorld, setFog, updateWater } from './build.ts';
import { hurtPlayer } from './combat.ts';
import { initDust } from './particles.ts';
import { makeMonster } from './monsters.ts';
import { placeRunesForLevel } from './altars.ts';
import { sRumble } from './audio.ts';
import { stairsGuarded } from './omens.ts';
import { updatePlayer } from './player.ts';
import { css } from './color.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/** 今の階のシード（探索のシード・深さ・支道・異界・特別な階から決める。0 にはならない） */
export const levelSeed = (): number =>
  (Math.imul(adv.runSeed, 2654435761) ^
    Math.imul(here.depth, 1013904223) ^
    (here.branch ? Math.imul(here.branch.lvl * 31 + here.branch.key.charCodeAt(0), 0x27d4eb2d) : 0) ^
    (here.realm ? Math.imul(here.realm.key.charCodeAt(0) + 7, 0x165667b1) : 0) ^
    (here.inter ? Math.imul(here.inter.key.charCodeAt(0) + 13, 0x2c1b3c6d) : 0)) >>>
    0 || 1;

/** 今いるのが最深部か（本道の一番深い階。支道・異界・特別な階は違う） */
export const isFinal = (): boolean => here.depth === FINAL_DEPTH && !here.branch && !here.realm && !here.inter;

/**
 * 特別な階 key（town・bigroom・oracle・fortress）がある深さ（大広間と砦は、探索のシードで1つずれる）。ほかの key は undefined。
 * 特別な階は、深さと深さの間に入る一度きりの場所（深さの代わりにはならない）：石の迷宮の後の地下の町、大洞窟の中の大広間、遺跡の前の神託所、溶岩の海の中の砦
 */
export function interAt(key: string): number | undefined {
  const h = Math.imul(adv.runSeed ^ 0x5bd1e995, 2654435761) >>> 0;
  const at: Readonly<Record<string, number>> = { town: 2, bigroom: 3 + (h & 1), oracle: 5, fortress: 9 + ((h >> 2) & 1) };
  return at[key];
}
/** 深さ d の次（下り階段の先）にある特別な階の key。無ければ null */
export function interAfter(d: number): string | null {
  for (const k in SPECIALS) if (interAt(k) === d) return k;
  return null;
}
/** 今いる場所の名前（探索のシードと、本道の深さ・支道・異界・特別な階。行った階の覚え placeMem の鍵。もとは src/game/02-constants.js） */
export const placeKey = (): string =>
  `${adv.runSeed}:` +
  (here.realm
    ? `r:${here.realm.key}:${here.realm.ret}`
    : here.branch
      ? `b:${here.branch.key}:${here.branch.lvl}`
      : here.inter
        ? `i:${here.inter.key}`
        : `m:${here.depth}`);
/**
 * 次の場所へ進む（go：'up' は上り階段・'branch' は支道の入口・'realm' は異界の門、ほかは下り階段）。今の階の見えた所を覚えてから、
 * 深さ・支道・異界・特別な階を書き換える。最深部より先や、伝説の物が揃わない最深部へは進めず、advance.bounced を立てる（もとは src/game/02-constants.js）
 */
export function advance(go?: string): void {
  if (here.D && here.explored) placeMem.set(placeKey(), { explored: here.explored.slice(), mem: here.mem.slice() });
  here.arrive = null;
  if (go === 'up') {
    if (here.inter) {
      here.inter = null;
      here.arrive = 'stairs';
      return;
    }
    if (here.realm) {
      here.depth = here.realm.ret - 1;
      here.realm = null;
      here.arrive = 'portal';
      return;
    }
    if (here.branch) {
      if (here.branch.lvl > 1) {
        here.branch.lvl--;
        here.arrive = 'stairs';
        return;
      }
      here.depth = here.branch.ret - 1;
      here.branch = null;
      here.arrive = 'bstairs';
      return;
    }
    return;
  }
  if (go === 'branch' && level().bstairs) {
    const B = lookup(BRANCHES, must(level().bstairs).key);
    here.branch = { key: B.key, lvl: 1, len: B.len, ret: here.depth + 1 };
    return;
  }
  if (go === 'realm' && level().portal) {
    here.realm = { key: must(level().portal).key, ret: here.depth + 1 };
    return;
  }
  if (here.inter) {
    here.depth = here.inter.after + 1;
    here.inter = null;
    return;
  }
  // a realm entered just above the bottom: without all three legendary things its way out leads back to the portal, as the stairs stay sealed
  if (here.realm && here.realm.ret >= FINAL_DEPTH && !legendAll()) {
    here.depth = here.realm.ret - 1;
    here.realm = null;
    here.arrive = 'portal';
    advance.bounced = true;
    return;
  }
  if (here.realm) {
    here.depth = here.realm.ret;
    here.realm = null;
    return;
  }
  if (here.branch) {
    if (here.branch.lvl < here.branch.len) {
      here.branch.lvl++;
      return;
    }
    here.depth = here.branch.ret;
    here.branch = null;
    return;
  }
  if (here.depth >= FINAL_DEPTH || (here.depth === FINAL_DEPTH - 1 && !legendAll())) {
    advance.bounced = true;
    return;
  }
  {
    const ik = interAfter(here.depth);
    if (ik) {
      here.inter = { key: ik, after: here.depth };
      return;
    }
  }
  here.depth++;
}
// 型だけの declare namespace で、関数の欄の型を付ける（組み立てで消える。古い JS の文をそのまま残すため）
export declare namespace advance {
  /** 進めずに押し戻されたか（読んだ側が戻す） */
  let bounced: boolean | undefined;
}
/** 今の場所の階を作る（年代記が無ければ作り、その階の主と忘れられた獣を生き物の表に足す。もとは src/game/04-generate.js） */
export function generate(seed: number, depth: number): Level {
  if (adv.HIST_SEED !== adv.runSeed) {
    adv.HIST = makeHistory(adv.runSeed);
    adv.HIST_SEED = adv.runSeed;
  }
  const r = generateLevel(
    seed,
    depth,
    {
      runSeed: adv.runSeed,
      branch: here.branch,
      realm: here.realm,
      inter: here.inter,
      showroom: here.showroomGen,
      hist: must(adv.HIST),
      trials: adv.runTrials,
      weapons: weaponPool(),
    },
    { MTYPES, makeRune, rollTraits },
  );
  if (r.lordType) MTYPES['lord'] = r.lordType;
  if (r.beastType) MTYPES['X'] = r.beastType;
  return r.level;
}
/**
 * 最深部の支度：天井の一番高い、まわりが開けた床（王の影が立つ所 c0）を探し、小さな生き物のほかを消して、最深部の状態を作る（もとは src/game/24-goal.js）
 */
export function setupFinal(): void {
  // the bottom: the place with the highest vault on this level, with open floor around it, so the shadow can stand under the vault
  let c0 = level().stairs,
    bc = level().ceil[c0] || 0;
  const open = (i: number): boolean => i >= 0 && i < NCELL && level().tile[i] === TF && !level().liquid[i] && !level().solid.has(i);
  for (const rad of [3, 2, 1]) {
    for (let i = 0; i < NCELL; i++) {
      if (!open(i) || nth(level().ceil, i) <= bc) continue;
      const x = i % MW,
        z = (i / MW) | 0;
      let ok = x > rad && z > rad && x < MW - rad - 1 && z < MH - rad - 1;
      for (let dz = -rad; dz <= rad && ok; dz++)
        for (let dx = -rad; dx <= rad; dx++)
          if (!open(i + dz * MW + dx)) {
            ok = false;
            break;
          }
      if (ok) {
        bc = nth(level().ceil, i);
        c0 = i;
      }
    }
    if (bc >= 10) break;
  }
  here.monsters = here.monsters.filter((m) => m.ty.critter);
  here.finalSt = { c0, boss: null, bossT: -1, summonT: 12, said: false };
}
/** 新しい層に入ると体が強くなる（本道の4つの層で一度ずつ。最大体力 +4。もとは src/game/18-level-player.js） */
export function strataGrowth(): void {
  if (!here.D || here.branch || here.realm || here.inter || !ui.started || ui.gallery) return;
  const k = here.D.stratum && here.D.stratum.k;
  if (!['cavern', 'ruins', 'magma', 'abyss'].includes(k) || adv.lvl.strata.has(k)) return;
  adv.lvl.strata.add(k);
  adv.PLAYER_MAX += 4;
  player.hp = Math.min(adv.PLAYER_MAX, player.hp + 4);
  renderStatus();
  setTimeout(() => msg('<b style="color:#ffd9a0">+</b>新しい層の空気が、体を強くした。最大体力 +4。'), 2200);
}
/** 選ばれなかった空の枠の祭壇があれば、その枠を開ける（枠を選ぶ祭壇から離れた時。もとは src/game/18-level-player.js） */
export function settleSlotPick(): void {
  if (!adv.runState || !adv.runState.slotPend || !here.D) return;
  const o = (here.D.items || []).find((x) => x.grp === adv.runState.slotPend && !x.taken);
  if (o) {
    applyOpen(must(o.target));
    msg(`<span class="lab">選ばれなかった空の枠は、${o.label}を開けた。</span>`);
  }
  adv.runState.slotPend = null;
}
/** 層の名前を、画面の真ん中に少しの間出す（もとは src/game/18-level-player.js） */
export function showStratum(st: { name: string; special?: boolean; branch?: boolean; realm?: boolean; n?: number }): void {
  const el = document.getElementById('stratum');
  if (!el) return;
  // oxlint-disable-next-line typescript/no-misused-spread -- 層の名前は絵文字の無い日本語（1文字ずつ空ける。元のまま）
  const name = [...st.name].join(' ');
  el.innerHTML = `<span class="r">-  -  -</span>   ${st.special ? '特 別 な 階' : st.branch ? '支 道' : st.realm ? '異 界' : `第 ${st.n} 層`}   <span class="r">-  -  -</span>\n<b>${name}</b>`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(showStratum.t);
  showStratum.t = setTimeout(() => el.classList.remove('show'), 5600);
}
// 型だけの declare namespace で、関数の欄の型を付ける（組み立てで消える。古い JS の文をそのまま残すため）
export declare namespace showStratum {
  /** 名前を消す時計 */
  let t: ReturnType<typeof setTimeout> | undefined;
}
/** 部屋の出来事を作る（神託・転移・噴き出し・目覚める像・崩れる床・水攻めと溶岩・霊。もとは src/game/15-sound-fire.js） */
export function initEvents(): void {
  here.events = [];
  level().collapsed = false;
  level().pit = new Uint8Array(NCELL);
  level().rooms.forEach((r, ri) => {
    if (r.vault && r.vault.k === 'oracle' && r.valtar && r.valtar.length)
      here.events.push({ type: 'oracle', cell: nth(r.valtar, 0), done: false });
    if (ri === 0) {
      for (const tp of level().teles || []) here.events.push({ type: 'tele', a: tp.a, b: tp.b, lock: -1 });
      for (const e of level().erupts || [])
        here.events.push({ type: 'erupt', src: e.src, order: e.order.slice(), state: 0, t: 8 + mr() * 14, k: 0 });
    }
    const md = r.mdata;
    if (!md) return;
    if (md.type === 'statues')
      for (const c of md.awaken || []) here.events.push({ type: 'statue', cell: c, done: false, active: false, t: 0 });
    if (md.type === 'collapse') here.events.push({ type: 'collapse', cells: md.pit, ri, state: 0, t: 0 });
    if ((md.type === 'flood' || md.type === 'lavaflow') && md.order)
      here.events.push({ type: md.type, ri, order: md.order.slice(), src: md.src, state: 0, t: 0, k: 0 });
    if (md.type === 'crypt' && must(md.tombs).length)
      here.events.push({ type: 'haunt', ri, tombs: must(md.tombs).map((tb) => tb.i), done: false, t: -1 });
  });
}
/** 見えるマスを数え直す（300 の向きに 18 マスまで。壁・背の高い茂み・柱・閉じた扉で止まる。見えたマスは覚える。もとは src/game/16-view-input.js） */
export function computeFOV(): void {
  here.fovStamp++;
  const ox = player.x / CELL,
    oz = player.z / CELL,
    pcF = Math.floor(oz) * MW + Math.floor(ox);
  for (let k = 0; k < 300; k++) {
    const a = (k / 300) * Math.PI * 2,
      dx = Math.cos(a),
      dz = Math.sin(a);
    for (let s = 0; s < 18; s += 0.25) {
      const x = ox + dx * s,
        z = oz + dz * s,
        cx = Math.floor(x),
        cz = Math.floor(z);
      if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) break;
      const i = cz * MW + cx;
      here.fovVis[i] = here.fovStamp;
      here.explored[i] = 1;
      const tt = level().tile[i];
      if (tt === TW) break;
      if (s > 0.9 && i !== pcF && tallAt(i)) break;
      if (tt === TP && Math.hypot(x - cx - 0.5, z - cz - 0.5) < 0.28) break;
      const di = nth(level().doorAt, i);
      if (di >= 0 && i !== pcF && !nth(level().doors, di).gone && nth(level().doors, di).o < 0.35 && s > 0.3) break; // a door in the cell you stand in does not hide what is around you
    }
  }
}
/**
 * 階の中の出来事を調べる（first なら着いた時の伝言）：初めて入った部屋・壁の彫刻・下り階段を見つけた・上り階段と支道と異界の門と崩れた穴と下り階段を
 * 踏んだ（封じられた階段は伝言だけ）・見た所の割合（もとは src/game/18-level-player.js）
 */
export function checkEvents(first?: boolean): void {
  const pc = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL);
  const ri = nth(level().roomOf, pc);
  if (first)
    msg(
      here.depth === 1
        ? '<b style="color:#c9b8ff">@</b>石の迷宮に降り立った。闇の奥で、何かが息づいている。'
        : `<b style="color:#ffcf7a">&gt;</b>深度 ${here.depth}。光はより鮮やかに、闇はより深くなった。`,
    );
  if (ri >= 0 && !here.visitedRooms.has(ri)) {
    here.visitedRooms.add(ri);
    const th = must(nth(level().rooms, ri).theme);
    msg(`<b style="color:${css(th.col)}">${nth(level().rooms, ri).cave ? '~' : '*'}</b>${th.msg}`);
    const km = nth(level().rooms, ri).kindMsg;
    if (km) msg(`<b style="color:${css(th.col)}">=</b>${km}`);
    const mc = nth(level().rooms, ri).machine;
    if (mc) {
      const mi = lookup(MACHINE_INFO, mc);
      msg(`<b style="color:${css(mi.col)}">${mi.ch}</b>${mi.msg}`);
    }
  }
  if (!level().engrSeen && level().engr.size) {
    for (const k of level().engr.keys()) {
      const i = k >> 2;
      if (
        here.fovVis[i] === here.fovStamp &&
        Math.hypot(((i % MW) + 0.5) * CELL - player.x, (((i / MW) | 0) + 0.5) * CELL - player.z) < 7
      ) {
        level().engrSeen = true;
        msg('<b style="color:#ffdca0">#</b>壁に彫刻が刻まれている。見つめれば、そこに描かれた出来事が読み取れる。');
        break;
      }
    }
  }
  if (!here.stairsSeen && here.fovVis[level().stairs] === here.fovStamp) {
    here.stairsSeen = true;
    msg('<b style="color:#ffcf7a">&gt;</b>金色に輝く下り階段を見つけた。踏み込めば、さらに深い階層へ。');
  }
  if (here.lockCell >= 0) {
    const lx = ((here.lockCell % MW) + 0.5) * CELL,
      lz = (((here.lockCell / MW) | 0) + 0.5) * CELL;
    if (Math.hypot(player.x - lx, player.z - lz) > 1.6) here.lockCell = -1;
  }
  if (ui.started && !here.trans && level().upstairs >= 0 && here.lockCell !== level().upstairs) {
    const ux = ((level().upstairs % MW) + 0.5) * CELL,
      uz = (((level().upstairs / MW) | 0) + 0.5) * CELL;
    if (Math.hypot(player.x - ux, player.z - uz) < 0.95) {
      here.trans = { phase: 'out', t: 0, regen: false, go: 'up' };
      msg('<b style="color:#c9b8ff">&lt;</b>上り階段を上り、来た道を引き返す……');
    }
  }
  if (ui.started && !here.trans && level().bstairs && here.lockCell !== must(level().bstairs).cell) {
    const bx = ((must(level().bstairs).cell % MW) + 0.5) * CELL,
      bz = (((must(level().bstairs).cell / MW) | 0) + 0.5) * CELL;
    if (Math.hypot(player.x - bx, player.z - bz) < 0.95) {
      here.trans = { phase: 'out', t: 0, regen: false, go: 'branch' };
      msg(
        `<b style="color:${css(lookup(BRANCHES, must(level().bstairs).key).col)}">&gt;</b>本道を外れ、${lookup(BRANCHES, must(level().bstairs).key).name}へ続く脇道を下りていく……`,
      );
    }
  }
  if (ui.started && !here.trans && level().portal && here.lockCell !== must(level().portal).cell) {
    const px2 = ((must(level().portal).cell % MW) + 0.5) * CELL,
      pz2 = (((must(level().portal).cell / MW) | 0) + 0.5) * CELL;
    if (Math.hypot(player.x - px2, player.z - pz2) < 1.0) {
      here.trans = { phase: 'out', t: 0, regen: false, go: 'realm' };
      msg(`<b style="color:${css(lookup(REALMS, must(level().portal).key).col)}">0</b>揺らめく門をくぐった……`);
    }
  }
  const sx = ((level().stairs % MW) + 0.5) * CELL,
    sz = (((level().stairs / MW) | 0) + 0.5) * CELL;
  if (ui.started && !here.trans && level().pit && must(level().pit)[pc]) {
    here.trans = { phase: 'out', t: 0, regen: false };
    player.fall = true;
    msg('<b style="color:#ffa060">:</b>崩れた穴へ身を投じ、下の階層へと落ちていく……');
  }
  if (ui.started && !here.trans && here.lockCell !== level().stairs && Math.hypot(player.x - sx, player.z - sz) < 0.95 && !isFinal()) {
    if (stairsGuarded()) {
      if (clock.time - (updatePlayer.sealT || -99) > 6) {
        updatePlayer.sealT = clock.time;
        msg('<b style="color:#ff8a8a">=</b>階段は、見えない封に閉ざされている。控えの間に潜むものを退ければ、解けるだろう。');
      }
    } else if (descentSealed()) {
      if (clock.time - (updatePlayer.sealT || -99) > 9) {
        updatePlayer.sealT = clock.time;
        msg('<b style="color:#a98cff">.</b>階段の先は、底の見えない闇に塞がれている。三つの窪みが、何かを待つように淡く光っている。');
      }
    } else {
      here.trans = { phase: 'out', t: 0, regen: false };
      msg(
        legendAll() && here.depth === FINAL_DEPTH - 1
          ? '<b style="color:#ffe9b0">*</b>三つの光が闇を押し分けた。最後の階段を、底へと降りていく……'
          : '<b style="color:#ffcf7a">&gt;</b>光の螺旋に身を委ね、さらに深くへ降りていく。',
      );
    }
  }
  let ex = 0;
  for (let i = 0; i < NCELL; i++) {
    const tt = level().tile[i];
    if (here.explored[i] && (tt === TF || tt === TP)) ex++;
  }
  const exP = Math.min(100, Math.round((ex / level().floorCount) * 100));
  if (exP !== hudInfo.explored) {
    hudInfo.explored = exP;
    if (ui.helpOn) renderHelp();
  }
}
/**
 * 新しい階に入る（seedOverride があればそのシードで作る）：階を作り、祭壇とルーンを置き、世界を組み立て、生き物を作り（眠る物は階のシードから）、
 * 見えた所の覚えを戻し、体を少し休め、着いた所（階段・門）のそばに立ち、火と出来事と霧と塵を用意して、見えるマスと出来事を調べる。
 * 層が変わったら層の名前を出す（もとは src/game/18-level-player.js）
 */
export function newLevel(seedOverride?: number): void {
  const t0 = performance.now();
  settleSlotPick();
  if (advance.bounced) {
    advance.bounced = false;
    setTimeout(() => msg('<b style="color:#a98cff">.</b>闇の底に触れた途端、何かに押し返された。まだ、降りることは許されていない。'), 1200);
  }
  here.D = generate(seedOverride !== undefined ? seedOverride : levelSeed(), here.depth);
  const tGen = performance.now();
  if (here.depth === FINAL_DEPTH && !here.branch && !here.realm) here.D.finalVault = true;
  blaze.frozen = new Map();
  placeRunesForLevel();
  fight.projs = [];
  fight.beamSegs = [];
  fight.clouds = [];
  fight.zones = [];
  fight.laters = [];
  fight.rains = [];
  fight.marks = [];
  fight.beamRun = null;
  fight.boltFx = [];
  fight.zapQueue = [];
  vfx.zapFlash = null;
  gear.castSt = null;
  must(gfx.U).uAmb.value = level().prof.ambient;
  hudInfo.explored = 0;
  const tBuild = performance.now();
  buildWorld();
  const tBuilt = performance.now();
  updateWater();
  here.fixtures = level().fixtures;
  // 生き物ごとの見た目の乱数は、階のシードとその階で何体目か（here.mobSeq）から作る。map(makeMonster) にしない（番号を並びとして渡してしまう）
  here.mobSeq = 0;
  here.monsters = level().spawns.map((s) => makeMonster(s));
  if (here.branch && adv.runState.lordsDone && adv.runState.lordsDone.has(here.branch.key))
    here.monsters = here.monsters.filter((m) => m.key !== 'lord');
  here.finalSt = null;
  if (isFinal()) setupFinal();
  for (const m of here.monsters) if (!m.isLead) m.leader = here.monsters.find((o) => o.g === m.g && o.isLead) || null;
  // who sleeps: its own random from the level's seed (keyedRand), not the look random (mr)
  {
    const sr = keyedRand('sleep', levelSeed());
    for (const m of here.monsters) if (m.ty.beast || (m.ty.dragon && sr() < 0.9)) m.sleep = true;
    const asleep = new Set();
    for (const m of here.monsters) if (m.isLead && (m.g ?? NaN) >= 0 && m.ty.form !== 'eel' && sr() < 0.1) asleep.add(m.g);
    for (const m of here.monsters) if (asleep.has(m.g)) m.sleep = true;
  }
  ui.noticeMsgT = {};
  stealth.hudKey = '';
  here.explored = new Uint8Array(NCELL);
  here.mem = new Float32Array(NCELL * 3);
  here.fovVis = new Uint32Array(NCELL);
  here.fovStamp = 1;
  {
    const pm = placeMem.get(placeKey());
    if (pm) {
      here.explored.set(pm.explored);
      here.mem.set(pm.mem);
    }
  }
  here.visitedRooms = new Set();
  here.stairsSeen = false;
  player.rally = 0;
  fight.rallyMotes = [];
  if (adv.runStats && !ui.gallery) adv.runStats.maxDepth = Math.max(adv.runStats.maxDepth || 0, here.depth);
  setTimeout(strataGrowth, 50);
  if (ui.started && !ui.gallery && !adv.dead && !here.arrive) {
    const sp = here.inter ? lookup(SPECIALS, here.inter.key) : null;
    if (sp && (sp.k === 'town' || sp.k === 'oracle')) {
      player.hp = adv.PLAYER_MAX;
      setTimeout(() => msg('<b style="color:#ffd9a0">+</b>静かな場所だ。張りつめていた体が、すっかりほどけた。'), 1600);
    } else if (player.hp < adv.PLAYER_MAX) {
      player.hp = Math.min(adv.PLAYER_MAX, player.hp + adv.PLAYER_MAX * 0.2);
      setTimeout(() => msg('<span class="lab">階段を降りると、少し息が整った。</span>'), 1600);
    }
  }
  player.x = ((level().start % MW) + 0.5) * CELL;
  player.z = (((level().start / MW) | 0) + 0.5) * CELL;
  player.vx = player.vz = 0;
  player.yaw = level().startYaw;
  player.pitch = -0.04;
  here.lockCell = -1;
  {
    const tc =
      here.arrive === 'portal' && level().portal
        ? must(level().portal).cell
        : here.arrive === 'bstairs' && level().bstairs
          ? must(level().bstairs).cell
          : here.arrive === 'stairs'
            ? level().stairs
            : -1;
    if (tc >= 0) {
      const nb =
        [1, -1, MW, -MW, MW + 1, MW - 1, -MW + 1, -MW - 1]
          .map((o) => tc + o)
          .find((j) => j >= 0 && j < NCELL && level().tile[j] === TF && !level().liquid[j] && !level().solid.has(j)) ?? tc;
      player.x = ((nb % MW) + 0.5) * CELL;
      player.z = (((nb / MW) | 0) + 0.5) * CELL;
      player.yaw = Math.atan2(-((tc % MW) - (nb % MW)), -(((tc / MW) | 0) - ((nb / MW) | 0))) + Math.PI;
      here.lockCell = tc;
    }
    here.arrive = null;
  }
  stealth.sneak = false;
  lantern.r = 8.2;
  lantern.k = 1;
  here.riverCells = [];
  for (let i = 0; i < NCELL; i++)
    if (level().flow[i] && (level().liquid[i] === LQ_WATER || level().liquid[i] === LQ_DEEP)) here.riverCells.push(i);
  blaze.trampled = [];
  iceT.clear();
  ui.tallMsg = false;
  here.brimMsg = false;
  player.lastCell = -1;
  player.netT = 0;
  blaze.scent = new Float32Array(NCELL);
  here.webMsg = false;
  here.webBurnMsg = false;
  here.repairMsg = false;
  buf.pN = 0;
  blaze.gasAny = false;
  initFire();
  initEvents();
  blaze.spark = null;
  fight.projs = [];
  showHint('');
  edge.t = 0;
  setFog();
  initDust();
  renderStatus();
  if (ui.helpOn) renderHelp();
  computeFOV();
  checkEvents(true);
  if (player.fall) {
    player.fall = false;
    setTimeout(() => {
      hurtPlayer(roll(2, 4), '落下の衝撃');
    }, 300);
  }
  if (level().stratum !== here.lastStratum) {
    if (here.lastStratum !== null) {
      showStratum(level().stratum);
      if (level().stratum.msg) msg(`<b style="color:#c9b8ff">=</b>${level().stratum.msg}`);
    }
    here.lastStratum = level().stratum;
  }
  took('newLevel', t0, { gen: Math.round(tGen - t0), build: Math.round(tBuilt - tBuild) });
}
/**
 * 死んだ時（勝った後は何もしない）：動きを止め、伝承を受け取り、墓に遺せる物を選ぶ結果の画面を出す（選び直すと描き直す。［新しい探索へ］で次の探索。
 * もとは src/game/18-level-player.js）
 */
export function die(cause: string): void {
  if (adv.won) return;
  const t0 = performance.now();
  adv.dead = true;
  keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false;
  const el = document.getElementById('death');
  if (!el) return;
  const secs = Math.floor(clock.time - adv.runStats.t0),
    mm = Math.floor(secs / 60),
    ss = String(secs % 60).padStart(2, '0');
  const f = (t: string) => `<span class="f">${t}</span>`;
  adv.runStats.cause = cause;
  const R = awardLore(false);
  ui.graveCands = ui.gallery ? [] : graveCandidates();
  ui.graveSel = 0;
  if (ui.locked && document.exitPointerLock) document.exitPointerLock();
  const draw = () => {
    el.innerHTML = boxText(
      [
        f('+-- あ な た は 死 ん だ ---'),
        f('|'),
        `${f('|')}  死因      ${cause}`,
        `${f('|')}  場所      ${resultPlace()}`,
        `${f('|')}  Lv${adv.lvl.n}　倒した敵 ${adv.runStats.kills}　時間 ${mm}:${ss}`,
        f('|'),
        ...loreRows(R, f),
        f('|'),
        ...(ui.graveCands.length ? [...graveRows(f), f('|')] : []),
        `${f('|')}  ${adv.HIST ? adv.HIST.civ.name + 'の地に、またひとつ灯りが消えた。' : ''}`,
        f('|'),
        `${f('|')}  <button class="row" id="newRunB"><b>[Enter]</b> 新しい探索へ</button>`,
        f('+---'),
      ],
      64,
    );
  };
  document.body.classList.add('over');
  draw();
  el.onclick = (e) => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- 押された所は画面の部品（元の読み方のまま）
    const b = (e.target as Element).closest && (e.target as Element).closest('button');
    if (!b) return;
    if (b.dataset['gv'] !== undefined) {
      ui.graveSel = +b.dataset['gv'];
      draw();
    } else if (b.id === 'newRunB') startNewRun();
  };
  el.classList.add('show');
  sRumble(0.6, 2.5);
  took('die', t0);
}
/** 新しい探索を始める（墓を記録し、結果の画面を閉じ、探索のシード・深さ・体力・レベル・記録・手と持ち物を戻して、1つ目の階に入る。もとは src/game/18-level-player.js） */
export function newRun(): void {
  const t0 = performance.now();
  saveGrave();
  document.body.classList.remove('over');
  const el = document.getElementById('death');
  if (el) el.classList.remove('show', 'won');
  adv.dead = false;
  adv.runSeed = (Math.random() * 1e9) >>> 0;
  here.depth = 1;
  here.branch = null;
  here.realm = null;
  here.inter = null;
  placeMem.clear();
  here.arrive = null;
  here.trans = null;
  player.fall = false;
  ui.gallery = null;
  {
    const gp = document.getElementById('gal');
    if (gp) gp.classList.remove('show');
  }
  adv.PLAYER_MAX = 40;
  adv.lvl = { n: 1, exp: 0, pending: 0, bless: {}, strata: new Set() };
  adv.runTrials = (saved.META.trials || []).filter((k) => unlocked('t_' + k));
  player.hp = adv.PLAYER_MAX;
  adv.runStats = { kills: 0, t0: clock.time, maxDepth: here.depth, book0: saved.BOOK.size, beastsNew: 0 };
  resetRunes();
  newLevel();
  took('newRun', t0);
}
/**
 * 結果の画面から新しい探索へ（［新しい探索へ］・Enter・R）：結果の画面を消し、暗くして、真っ暗になった時に newRun する（src/game/30-loop-init.js の tick）。
 * 新しい階を作るのは重く、スマホでは何百ミリ秒も止まるので、止まるのを真っ暗な間にする。階を移る途中なら、今の暗さから続けて暗くする
 */
export function startNewRun(): void {
  if (here.trans?.run) return;
  const el = document.getElementById('death');
  if (el) el.classList.remove('show', 'won');
  here.trans = { phase: 'out', t: clamp((1 - here.fade) * 0.8, 0, 0.8), run: true };
}
