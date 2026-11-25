// 手と持ち物の処理（もとは src/game/19-hands-runes.js）。状態の入れ物 gear（両手・持ち物）に頼る物。
// 表だけに頼る物（ルーンの名前・色・付けられるか）は src/lib/runes.ts。
import { lookup, must } from './array.ts';
import { RUNE_DEF, RUNE_TYPES, type Rune, TWO_SLOTS, slotsAllow, syncHand, trList, canPut } from './runes.ts';
import { type HandState, type Hands, gear } from './state.ts';
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
  elem?: Rune | null;
  trig?: Rune | null;
}
/** 両手と持ち物の写し（持ち替えの途中に戻すため） */
export interface HandsSnap {
  L: HandState;
  R: HandState;
  B: Hands['B'];
  bag: Rune[];
}

/** 両手（冒険の始めからあるので、無ければその場で止まる） */
const hands = (): Hands => must(gear.hands, '両手 gear.hands');

/** ルーンを作る（番号 uid は冒険の中で通し） */
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
/** 手 h の攻撃の種類（素手は 'bare'。両手持ちは左右で別の撃ち方。定義に無ければ、移す前と同じく undefined） */
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
/** 両手と体の枠の並びを、ルーンの番号で表した文字（変わったかを見るため） */
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
