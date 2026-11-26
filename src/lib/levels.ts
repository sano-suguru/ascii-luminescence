// 階のシード（もとは src/game/18-level-player.js）と、最深部か（もとは 24-goal.js）、特別な階の場所（もとは 02-constants.js）と、
// 階を移る処理の部品（場所の名前・次の場所へ進む・階を作る・最深部の支度・層の名前・部屋の出来事・見えるマス）。
// 状態の入れ物 adv（探索）・here（今いる場所）・player・ui に頼る物。
import { lookup, must, nth } from './array.ts';
import { MTYPES } from './creatures.ts';
import { makeRune, applyOpen } from './gear.ts';
import { type Level, generateLevel } from './generate.ts';
import { tallAt } from './ground.ts';
import { makeHistory } from './history.ts';
import { legendAll } from './legend.ts';
import { msg } from './log.ts';
import { mr } from './random.ts';
import { rollTraits } from './runes.ts';
import { adv, here, placeMem, player, ui } from './state.ts';
import { renderStatus } from './status.ts';
import { SPECIALS } from './strata.ts';
import { weaponPool } from './unlocks.ts';
import { BRANCHES, CELL, FINAL_DEPTH, MH, MW, NCELL, TF, TP, TW } from './world.ts';

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
        here.events.push({ type: 'erupt', src: e.src, order: e.order, state: 0, t: 8 + mr() * 14, k: 0 });
    }
    const md = r.mdata;
    if (!md) return;
    if (md.type === 'statues')
      for (const c of md.awaken || []) here.events.push({ type: 'statue', cell: c, done: false, active: false, t: 0 });
    if (md.type === 'collapse') here.events.push({ type: 'collapse', cells: md.pit, ri, state: 0, t: 0 });
    if ((md.type === 'flood' || md.type === 'lavaflow') && md.order)
      here.events.push({ type: md.type, ri, order: md.order.slice(), src: md.src, state: 0, t: 0, k: 0, max: md.order.length * 3 });
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
