// 手と持ち物の処理（枠を開ける applyOpen も）。状態の入れ物 gear（両手・持ち物）に頼る物。
// 探索の始めの手に戻す resetRunes は、fight・ui・adv・saved・here も戻す。
// 表だけに頼る物（ルーンの名前・色・付けられるか）は src/lib/runes.ts。
import { lookup, must, nth } from './array.ts';
import { renderHotbar } from './hotbar.ts';
import { renderInv } from './inventory.ts';
import { BL } from './monsters.ts';
import {
  ELEM_POW,
  SLOT_MAX,
  RUNE_DEF,
  RUNE_TYPES,
  type Rune,
  type SavedRune,
  TRAIT_V,
  TWO_SLOTS,
  elemCount,
  handRunes,
  modVal,
  slotsAllow,
  syncHand,
  trList,
  canPut,
  modWorks,
} from './runes.ts';
import { saveSet } from './save.ts';
import { type HandState, type Hands, adv, fight, gear, here, saved, ui } from './state.ts';
import { lockedOf, weaponPool } from './unlocks.ts';

/** 左手・右手 */
export type Side = 'L' | 'R';
/** 実際に使う手（両手持ちの武器なら、左右の枠を合わせた手。two が付く） */
export interface EffHand {
  atk: Rune | null;
  slots: (Rune | null)[];
  slotN: number;
  turn: number;
  two?: true;
  elem?: Rune | null | undefined;
  trig?: Rune | null | undefined;
}
/** 両手と持ち物の写し（持ち替えの途中に戻すため） */
export interface HandsSnap {
  L: HandState;
  R: HandState;
  B: Hands['B'];
  bag: Rune[];
}

/** 両手（探索の始めからあるので、無ければその場で止まる） */
const hands = (): Hands => must(gear.hands, '両手 gear.hands');

/** ルーンを作る（番号 uid は探索の中で通し） */
export function makeRune(type: string): Rune {
  lookup(RUNE_DEF, type); // 表に無い種類は、ここで止まる（前と同じ）
  return { uid: gear.runeUid++, type };
}
/** 強いルーンを作る（効き方のルーンだけが強くなる） */
export function makeStrong(t: string): Rune {
  const ru = makeRune(t);
  if (lookup(RUNE_DEF, t).cat === 'mod') ru.strong = true;
  return ru;
}
/** ルーンの種類の重み（武器・性質・発動・効き方・護符） */
export type RuneWeights = Partial<Record<'atk' | 'elem' | 'trig' | 'mod' | 'body', number>>;
/** でたらめにルーンの種類を選ぶ（重み weights の割合で種類を選び、その中から解放した物を1つ。選べなければ火） */
export function randomRuneType(r: () => number, weights?: RuneWeights): string {
  const w = weights || { elem: 0.45, trig: 0.12, mod: 0.33, body: 0.1 };
  let x = r();
  for (const c of ['atk', 'elem', 'trig', 'mod', 'body'] as const) {
    const wc = w[c];
    if (!wc) continue;
    if (x < wc) {
      const a = c === 'atk' ? weaponPool() : RUNE_TYPES[c].filter((t) => !lockedOf('rune', t));
      return a[Math.floor(r() * a.length)] || 'fire';
    }
    x -= wc;
  }
  return 'fire';
}
/** 武器 w を持った、空の手 */
export function newHand(w: string): HandState {
  return { atk: makeRune(w), slots: [null, null], slotN: 2, turn: 0, elem: null, trig: null };
}
/** 両手持ちの武器を持っているか（左右が同じ武器で、その武器が両手持ち） */
export const isTwo = (): boolean =>
  !!(
    gear.hands &&
    gear.hands.R &&
    gear.hands.R.atk &&
    gear.hands.L.atk === gear.hands.R.atk &&
    lookup(RUNE_DEF, gear.hands.R.atk.type).two
  );
/** 実際に使う手（両手持ちなら、左右の枠を合わせて、多くても TWO_SLOTS 枠） */
export function effHand(h: Side): EffHand {
  const hs = hands();
  if (!isTwo()) return hs[h];
  const sl = [...hs.L.slots.slice(0, hs.L.slotN || 2), ...hs.R.slots.slice(0, hs.R.slotN || 2)].slice(0, TWO_SLOTS);
  return { atk: hs.R.atk, slots: sl, slotN: sl.length, turn: hs.R.turn || 0, two: true };
}
/** 手 h の攻撃の種類（素手は 'bare'。両手持ちは左右で別の撃ち方。定義に無ければ undefined） */
export const atkType = (h: Side): string | undefined => {
  const H = hands()[h];
  if (!H || !H.atk) return 'bare';
  const d = lookup(RUNE_DEF, H.atk.type);
  return d.two ? d[h] : H.atk.type;
};
/** 両手の、次に放つ性質と発動のルーンを決め直す（両手持ちは左右で同じ） */
export function syncHands(): void {
  if (!gear.hands) return;
  if (isTwo()) {
    const v = effHand('R');
    syncHand(v);
    for (const h of ['L', 'R'] as const) {
      gear.hands[h].elem = v.elem ?? null;
      gear.hands[h].trig = v.trig ?? null;
    }
    return;
  }
  syncHand(gear.hands.L);
  syncHand(gear.hands.R);
}
/** 手 h の性質を、次の物に交代する */
export function turnElem(h: Side): void {
  const hs = hands();
  if (isTwo()) {
    hs.R.turn = (hs.R.turn || 0) + 1;
    hs.L.turn = hs.R.turn;
    syncHands();
    return;
  }
  const H = hs[h];
  if (!H) return;
  H.turn = (H.turn || 0) + 1;
  syncHand(H);
}
/** 手 h の枠 i に、ルーン ru を付けられるか（両手持ちなら、左右の枠を合わせて数える） */
export function canPutAt(h: Side, i: number, ru: Rune): boolean {
  const hs = hands();
  if (!isTwo()) return canPut(hs[h], i, ru);
  const H = hs[h];
  if (i >= (H.slotN || 2)) return false;
  const d = lookup(RUNE_DEF, ru.type);
  if (!['elem', 'trig', 'mod'].includes(d.cat)) return false;
  const others: Rune[] = [];
  for (const k of ['L', 'R'] as const)
    hs[k].slots.slice(0, hs[k].slotN || 2).forEach((r, j) => {
      if (r && !(k === h && j === i) && r !== ru) others.push(r);
    });
  if (!H.slots[i] && others.length >= TWO_SLOTS) return false;
  return slotsAllow(others, ru, d.cat);
}
/** 持っているルーン全部（両手の武器と枠、体の枠、持ち物。同じ物は1つ） */
export const allRunes = (): Rune[] => {
  const hs = hands();
  return [
    ...new Set(
      [hs.L.atk, ...hs.L.slots, hs.R.atk, ...hs.R.slots, ...(hs.B ? [hs.B.b0, hs.B.b1] : []), ...gear.bag].filter((r): r is Rune =>
        Boolean(r),
      ),
    ),
  ];
};
/** 両手と体の枠の並びを、ルーンの番号で表した文字列（変わったかを見るため） */
export const handsKey = (): string => {
  const hs = hands();
  const side = (h: Side): string => [hs[h].atk, ...hs[h].slots].map((r) => (r ? r.uid : 0)).join(',') + ':' + (hs[h].slotN || 2);
  return side('L') + '|' + side('R') + '|' + (hs.B ? [hs.B.b0, hs.B.b1].map((r) => (r ? r.uid : 0)).join(',') : '');
};
/** 両手・体の枠・持ち物の写し */
export function snapHands(): HandsSnap {
  const hs = hands();
  return {
    L: { ...hs.L, slots: hs.L.slots.slice() },
    R: { ...hs.R, slots: hs.R.slots.slice() },
    B: { ...(hs.B || { b0: null, b1: null }) },
    bag: gear.bag.slice(),
  };
}
/** 写し sn に戻す */
export function restoreHands(sn: HandsSnap): void {
  const hs = hands();
  hs.L = { ...sn.L, slots: sn.L.slots.slice() };
  hs.R = { ...sn.R, slots: sn.R.slots.slice() };
  hs.B = { ...(sn.B || { b0: null, b1: null }) };
  gear.bag = sn.bag.slice();
  syncHands();
}
/** 手 h の武器の特性 k の段（無ければ 0） */
export const wTL = (h: Side, k: string): number => {
  for (const t of trList(effHand(h).atk)) if (t.k === k) return t.lv;
  return 0;
};
/** 墓に残したルーン g から、拾うルーンを作る（強い版ではなくなり、特性はそれぞれ1段下がる。0段になった特性は消える） */
export function graveRune(g: SavedRune): Rune {
  const ru = makeRune(g.type);
  ru.strong = false;
  if (g.traits && g.traits.length) ru.traits = g.traits.map((t) => ({ k: t.k, lv: t.lv - 1 })).filter((t) => t.lv > 0);
  return ru;
}
/** 体の枠 i のルーン（枠は b0・b1 の2つ。ほかは無い） */
const bodyAt = (B: Hands['B'], i: number): Rune | null | undefined => (i === 0 ? B.b0 : i === 1 ? B.b1 : undefined);
/** 武器 ru を手 h に持つ（両手持ちの武器は両手に。両手持ちを持っていたら、両手とも外す）。外れた武器を返す */
export function equipWeapon(h: Side, ru: Rune | null | undefined): Rune[] {
  const hs = hands(),
    out: (Rune | null)[] = [];
  if (isTwo()) {
    out.push(hs.R.atk);
    hs.L.atk = null;
    hs.R.atk = null;
  }
  if (ru && lookup(RUNE_DEF, ru.type).two) {
    for (const k of ['L', 'R'] as const) {
      const a = hs[k].atk;
      if (a && !out.includes(a)) out.push(a);
    }
    hs.L.atk = ru;
    hs.R.atk = ru;
  } else {
    const a = hs[h].atk;
    if (a && !out.includes(a)) out.push(a);
    hs[h].atk = ru || null;
  }
  syncHands();
  return out.filter((r): r is Rune => Boolean(r));
}
/** 手 h の枠 s（'atk' は武器、's0' から 's3' はルーンの枠、手 'B' の 'b0'・'b1' は体の枠）に、ルーン v を入れる */
export function slotSet(h: Side | 'B', s: string, v: Rune | null): void {
  const hs = hands();
  if (h === 'B') Object.assign(hs.B, { [s]: v });
  else if (s === 'atk') hs[h].atk = v;
  else hs[h].slots[+s.slice(1)] = v;
}
/** ルーン ru を付けられる、空いた手のルーンの枠（手の順 order。効き方のルーンは、効く手を先に）。無ければ null */
export function freeSlotFor(ru: Rune, order?: Side[]): [Side, string] | null {
  const hs = hands(),
    ord = (order || ['R', 'L']).slice(),
    d = lookup(RUNE_DEF, ru.type);
  if (d.cat === 'mod') ord.sort((a, b) => (modWorks(d.mk ?? '', hs[b]) ? 1 : 0) - (modWorks(d.mk ?? '', hs[a]) ? 1 : 0));
  for (const h of ord) {
    const H = hs[h];
    for (let i = 0; i < (H.slotN || 2); i++) if (!H.slots[i] && canPutAt(h, i, ru)) return [h, 's' + i];
  }
  return null;
}
/** 開いている体の枠に、種類 type の護符がいくつ着いているか */
export function bodyN(type: string): number {
  if (!gear.hands || !gear.hands.B) return 0;
  let n = 0;
  for (let i = 0; i < (adv.runState.bodyOpen || 0); i++) {
    const ru = bodyAt(gear.hands.B, i);
    if (ru && ru.type === type) n++;
  }
  return n;
}
/** 効き方の合計（効き方のルーンの種類 mk → 値。数 count・跳ね返り bounce・追う homing・連鎖 chain・範囲 area・長さ dur など） */
export interface Aff {
  count?: number;
  bounce?: number;
  homing?: number;
  chain?: number;
  area?: number;
  dur?: number;
  [mk: string]: number | undefined;
}
/** 武器の特性の段（特性の鍵 → 段） */
export interface SpecTraits {
  count?: number;
  bounce?: number;
  homing?: number;
  accuracy?: number;
  [k: string]: number | undefined;
}
/** 術の中身（手 h・攻撃の種類 atk・性質 elem・効き方の合計 aff・武器の特性の段 tr・性質の強さ pow。溜めの加護で powK が付く） */
export interface Spec {
  h: Side;
  atk: string | undefined;
  elem: string | null;
  aff: Aff;
  tr: SpecTraits;
  pow: number;
  powK?: number;
}
/** 手 h で今放つ術の中身（両手持ちは、次に放つ性質と発動を左右でそろえる） */
export function specOf(h: Side): Spec {
  const H = effHand(h);
  syncHand(H);
  if (H.two) {
    hands().L.elem = hands().R.elem = H.elem;
    hands().L.trig = hands().R.trig = H.trig;
  }
  const aff: Aff = {};
  for (const ru of handRunes(H)) {
    const d = lookup(RUNE_DEF, ru.type);
    if (d.cat === 'mod' && modWorks(must(d.mk), H)) aff[must(d.mk)] = (aff[must(d.mk)] || 0) + modVal(ru);
  }
  const el = H.elem ? H.elem.type : null;
  const tr: SpecTraits = {},
    el0 = H.elem ? H.elem.type : null;
  for (const t of trList(H.atk)) tr[t.k] = t.lv;
  if (el0 === 'thunder' && BL('branch')) aff.chain = (aff.chain || 0) + BL('branch');
  if (tr.count) aff.count = (aff.count || 0) + nth(TRAIT_V.count, tr.count);
  if (tr.bounce) aff.bounce = (aff.bounce || 0) + nth(TRAIT_V.bounce, tr.bounce);
  if (tr.homing) aff.homing = (aff.homing || 0) + nth(TRAIT_V.homing, tr.homing);
  if (tr.accuracy) aff.homing = (aff.homing || 0) + tr.accuracy * 4;
  return { h, atk: atkType(h), elem: el, aff, tr, pow: el ? ELEM_POW[Math.min(4, elemCount(H, el))] || 1 : 1 };
}
/**
 * 探索の始めの手と持ち物に戻す（右手は杖・左手は剣、袋は空。ビルド・祭壇の記録・伝説の物・最深部の状態も）。
 * 探索を始める時だけ、ページを読み終えた後に呼ぶ（見たルーン saved.RSEEN は src/lib/boot.ts の boot が al_runes から読む。それより前は空の仮の物）
 */
export function resetRunes(): void {
  fight.trigCd = { L: 0, R: 0 };
  fight.hitSrcPoint = null;
  gear.hands = { L: newHand('blade'), R: newHand('orb'), B: { b0: null, b1: null } };
  gear.bag = [];
  gear.builds = [null, null, null];
  gear.buildIdx = -1;
  gear.castSt = null;
  gear.swapSt = null;
  ui.packSel = null;
  fight.beamSegs = [];
  fight.clouds = [];
  adv.runState = { startChosen: false, altar1: false, taken: new Set(), lordsDone: new Set(), bodyOpen: 0 };
  saved.LEGEND = null;
  here.finalSt = null;
  adv.won = false;
  renderHotbar();
  try {
    if (!saved.RSEEN.has('blade') || !saved.RSEEN.has('bolt')) {
      saved.RSEEN.add('blade');
      saved.RSEEN.add('bolt');
      saveSet('al_runes', saved.RSEEN);
    }
  } catch {}
}
/** 枠を1つ開ける（t：手の枠 'slotL'・'slotR' は多くても SLOT_MAX まで、体の枠 'body' は2まで） */
export function applyOpen(t: string): void {
  if (t === 'slotR' || t === 'slotL') {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- t は 'slotR' か 'slotL' なので、t.slice(4) は 'R' か 'L'
    const H = hands()[t.slice(4) as Side];
    H.slotN = Math.min(SLOT_MAX, (H.slotN || 2) + 1);
    while (H.slots.length < H.slotN) H.slots.push(null);
  } else if (t === 'body') adv.runState.bodyOpen = Math.min(2, (adv.runState.bodyOpen || 0) + 1);
  syncHands();
  renderHotbar();
  if (ui.invOpen) renderInv();
}
