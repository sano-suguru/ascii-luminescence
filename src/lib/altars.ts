// 祭壇とルーンを置く（もとは src/game/21-altars-heal.js）。状態の入れ物 here（今の階）・gear（手）・adv（探索）・player に頼る物。
// 拾う・選ぶ・祭壇の画面は、伝言と画面に頼るので、まだ古い JS（21-altars-heal.js）にある。
import { lookup, must, nth } from './array.ts';
import { css } from './color.ts';
import { MTYPES } from './creatures.ts';
import { type Item } from './generate.ts';
import { makeRune, makeStrong, randomRuneType } from './gear.ts';
import { mpick, mr, shuffle } from './random.ts';
import {
  CAT_BR,
  CAT_NAME,
  RUNE_DEF,
  RUNE_TYPES,
  type Rune,
  TIER_COL,
  TRAITS,
  rollTraits,
  runeCol,
  runeName,
  trList,
  trName,
  weaponCol,
} from './runes.ts';
import { type Hands, adv, gear, here, player } from './state.ts';
import { visW } from './text.ts';
import { lockedOf, weaponPool } from './unlocks.ts';
import { MH, MW, TF } from './world.ts';

/** 今の階（探索の始めからあるので、無ければその場で止まる） */
const level = () => must(here.D, '今の階 here.D');
/** 両手 */
const hands = (): Hands => must(gear.hands, '両手 gear.hands');
/** 体の枠 i のルーン（枠は b0・b1 の2つ。ほかは無い） */
const bodySlot = (B: Hands['B'], i: number): Rune | null | undefined => (i === 0 ? B.b0 : i === 1 ? B.b1 : undefined);
/** 色（3つの数）を css の色に（足りなければ止まる） */
const cssOf = (c: readonly number[] | undefined): string => {
  const v = must(c, '色');
  return css([nth(v, 0), nth(v, 1), nth(v, 2)]);
};

/** 祭壇の選択肢（選ぶと何が起きるか opt と、見せるルーン rune。鍛える選択肢は、武器・特性・上げた後の段も） */
export type AltarOpt = Pick<Item, 'opt' | 'rune' | 'forgeW' | 'forgeK' | 'forgeTo'>;
/** 鍛える候補（武器 w の特性 k を、段 from から to へ） */
export interface ForgeOption {
  w: Rune;
  k: string;
  from: number;
  to: number;
}
/** 回復の選択肢 */
const HEAL = (): AltarOpt => ({ opt: 'heal', rune: { uid: -1, type: 'mend' } });

// ---------------------------------------------------------------- 祭壇の中身（近づいた時に決める）
/**
 * 祭壇の組 grp の3つの選択肢を決める（まだ決めていなければ）。ルーンの祭壇は、新しいルーン（空いた枠の種類に寄せる）・
 * まれに武器・体力が最大の85%より少なければ癒し。主の祭壇は強い選択肢（武器・鍛える）。鍛えの祭壇は、持っている武器の鍛え方を3つ
 */
export function altarFill(grp: string): void {
  const D = level(),
    its = D.items.filter((o) => o.grp === grp && o.altar),
    first = its[0];
  if (!first || first.rune) return;
  const lord = first.lord;
  if (first.forge) {
    const fo = forgeOptions(3);
    its.forEach((it, k) => {
      const f = fo[k];
      Object.assign(it, f ? { opt: 'forge', forgeW: f.w, forgeK: f.k, forgeTo: f.to, rune: { uid: -1, type: 'forgeopt' } } : HEAL());
    });
    return;
  }
  const hs = hands(),
    opts: (AltarOpt | null)[] = [],
    usedT = new Set<string>(),
    usedC = new Set<string>();
  // 新しいルーン（半分は、空いている枠に合う種類から選ぶ。同じ種類は出さず、なるべく違う分類にする）
  const newRune = (): AltarOpt | null => {
    const empty: ('elem' | 'mod' | 'trig' | 'body')[] = [];
    for (const h of ['L', 'R'] as const) {
      const H = hs[h];
      for (let i = 0; i < (H.slotN || 2); i++) if (!H.slots[i]) empty.push(mpick(['elem', 'mod', 'mod', 'trig'] as const));
    }
    for (let i = 0; i < (adv.runState.bodyOpen || 0); i++) if (!bodySlot(hs.B, i)) empty.push('body');
    for (let tries = 0; tries < 16; tries++) {
      let t: string;
      if (empty.length && mr() < 0.5) {
        const c = nth(empty, Math.floor(mr() * empty.length)),
          a = RUNE_TYPES[c].filter((u) => !lockedOf('rune', u));
        t = must(a[Math.floor(mr() * a.length)], '選べるルーン');
      } else
        t = randomRuneType(mr, lord ? { elem: 0.3, trig: 0.15, mod: 0.35, body: 0.2 } : { elem: 0.4, trig: 0.12, mod: 0.38, body: 0.1 });
      if (usedT.has(t) || (tries < 10 && usedC.has(lookup(RUNE_DEF, t).cat))) continue;
      usedT.add(t);
      usedC.add(lookup(RUNE_DEF, t).cat);
      return { opt: 'rune', rune: lookup(RUNE_DEF, t).cat === 'mod' && mr() < (lord ? 0.5 : 0.05) ? makeStrong(t) : makeRune(t) };
    }
    return null;
  };
  const weapon = (): AltarOpt | null => {
    const pool = weaponPool().filter((t) => !usedT.has(t));
    if (!pool.length) return null;
    const t = nth(pool, Math.floor(mr() * pool.length));
    usedT.add(t);
    return { opt: 'rune', rune: rollTraits(makeRune(t), here.depth, lord ? 2 : 0) };
  };
  const heal = (): AltarOpt | null => (player.hp < adv.PLAYER_MAX * 0.85 ? HEAL() : null);
  const forge = (): AltarOpt | null => {
    const f = forgeOptions(1)[0];
    return f ? { opt: 'forge', forgeW: f.w, forgeK: f.k, forgeTo: f.to, rune: { uid: -1, type: 'forgeopt' } } : null;
  };
  opts.push(lord || mr() < 0.08 ? weapon() || newRune() : newRune());
  opts.push(lord ? forge() || newRune() : newRune());
  opts.push(heal() || newRune());
  for (let k = 0; k < 3; k++) if (!opts[k]) opts[k] = HEAL();
  shuffle(opts, mr);
  its.forEach((it, k) => Object.assign(it, opts[k]));
}

// ---------------------------------------------------------------- 番人（祭壇と強敵の部屋を守る群れ）
/** この階の湧く所にいる、戦う生き物の種類と数（小さな生き物・おとなしい生き物・主・住みかの決まった生き物・うなぎは数えない） */
export function hostileKeys(): Record<string, number> {
  const n: Record<string, number> = {};
  for (const s of level().spawns) {
    const ty = MTYPES[s.key];
    if (!ty || ty.critter || ty.peaceful || ty.boss || s.key === 'lord' || s.key === 'final' || ty.habitat || ty.form === 'eel') continue;
    n[s.key] = (n[s.key] || 0) + 1;
  }
  return n;
}
/** 次の群れの番号 */
export function nextGroup(): number {
  return level().spawns.reduce((a, s) => Math.max(a, s.g || 0), 0) + 1;
}
/**
 * マス at の部屋に、番人の群れ（この階で一番多い種類を2から3体）を置く。群れの番号を返す（置けなければ undefined）。
 * 番人は at から2マス以上離れた、乾いた床に置く
 */
export function addGuards(at: number, r: () => number): number | undefined {
  const D = level(),
    ri = D.roomOf[at] ?? NaN;
  if (ri < 0) return undefined;
  const hk = hostileKeys(),
    kinds = Object.keys(hk);
  if (!kinds.length) return undefined;
  const key = must(kinds.sort((a, b) => (hk[b] ?? 0) - (hk[a] ?? 0))[0], '番人の種類'),
    cells = nth(D.rooms, ri).cells.filter(
      (c) => D.tile[c] === TF && !D.liquid[c] && !D.solid.has(c) && Math.hypot((c % MW) - (at % MW), ((c / MW) | 0) - ((at / MW) | 0)) >= 2,
    ),
    g = nextGroup(),
    n = 2 + (r() < 0.5 ? 1 : 0);
  if (cells.length < n) return undefined;
  for (let k = 0; k < n; k++) {
    const c = must(cells.splice(Math.floor(r() * cells.length), 1)[0], '番人のマス');
    D.spawns.push({ key, cx: c % MW, cz: (c / MW) | 0, g, lead: k === 0, home: ri });
  }
  return g;
}
/** 番人の群れが、まだ生きているか（生きている間、その祭壇や褒美は暗く、取れない） */
export const guardedNow = (it: { guardG?: number }): boolean =>
  it.guardG !== undefined && here.monsters.some((m) => !m.dead && m.g === it.guardG);

// ---------------------------------------------------------------- 祭壇を置く・鍛える
/** 持っている武器の鍛え方を、でたらめに n 個（特性の段を1つ上げる、まだ無い特性を足す） */
export function forgeOptions(n: number): ForgeOption[] {
  const hs = hands(),
    ws = [...new Set([hs.L.atk, hs.R.atk].filter((w): w is Rune => Boolean(w)))],
    cands: ForgeOption[] = [];
  for (const w of ws) {
    const pool = Object.keys(TRAITS[w.type] || {}),
      tr = trList(w);
    for (const t of tr) if (t.lv < 5) cands.push({ w, k: t.k, from: t.lv, to: t.lv + 1 });
    for (const k of pool) if (!tr.some((t) => t.k === k)) cands.push({ w, k, from: 0, to: 1 });
  }
  const out: ForgeOption[] = [];
  while (out.length < n && cands.length) out.push(must(cands.splice(Math.floor(mr() * cands.length), 1)[0], '鍛え方'));
  return out;
}
/** マス at に、祭壇の組 grp の3つの選択肢の台を置く（中身は近づいた時に altarFill が決める。extra は主の祭壇などの印） */
export function placeAltar(at: number, grp: string, extra?: Partial<Item>): void {
  for (let k = 0; k < 3; k++)
    level().items.push(Object.assign({ i: at, kind: 'rune', rune: null, grp, altar: true, slot: k, taken: false }, extra || {}));
}
/** 鍛えの祭壇がある層と、その中の深さの幅・シードから深さを決める時のずらし */
const FORGE_SPAN: Partial<Record<string, readonly [number, number]>> = { cavern: [3, 5], ruins: [6, 8], magma: [9, 11] },
  FORGE_SHIFT: Record<string, number> = { cavern: 0, ruins: 3, magma: 6 };
/** 鍛えの祭壇がある深さ（層 k の中で、探索のシードで決める。大洞窟・古代の廃墟・溶岩の海のほかは -1） */
export function forgeDepthOf(k: string): number {
  const h = Math.imul(adv.runSeed ^ 0x2f6b1c3d, 2654435761) >>> 0,
    span = FORGE_SPAN[k];
  if (!span) return -1;
  return span[0] + ((h >>> lookup(FORGE_SHIFT, k)) % (span[1] - span[0] + 1));
}
/** 宝物庫の物 it のまわり R マスの、乾いた床のマス */
export function vaultArea(it: { i: number }, R: number): number[] {
  const D = level(),
    out: number[] = [],
    cx = it.i % MW,
    cz = (it.i / MW) | 0;
  for (let dz = -R; dz <= R; dz++)
    for (let dx = -R; dx <= R; dx++) {
      if (cx + dx < 0 || cx + dx >= MW || cz + dz < 0 || cz + dz >= MH) continue;
      const c = (cz + dz) * MW + cx + dx;
      if (D.tile[c] !== TF || D.liquid[c] || Math.hypot(dx, dz) > R) continue;
      out.push(c);
    }
  return out;
}
/** 祭壇を置く部屋の候補（部屋 ro とその番号 ri と、本道からの外れ det） */
export interface ScoredRoom {
  ri: number;
  ro: { cells: number[] };
  det: number;
}
/**
 * 癒しの泉を置く（25%の階。特別な階と最深部には置かない）。本道から5以上外れた、まだ物の無い部屋を選ぶ（無ければ候補の全部から）。
 * spreadPick があれば、それで選ぶ。泉は、部屋の置ける床（free）の真ん中に置く
 */
export function placeSpring(
  r: () => number,
  free: (c: number) => boolean,
  scored?: ScoredRoom[],
  spreadPick?: (list: ScoredRoom[]) => ScoredRoom | null | undefined,
): void {
  const D = level();
  if (D.stratum.special || D.finalVault || r() >= 0.25) return;
  const all = scored || [],
    pool = all.filter((o) => o.det >= 5 && !D.items.some((it) => D.roomOf[it.i] === o.ri)),
    base = pool.length ? pool : all,
    pick = spreadPick ? spreadPick(base) : base[Math.floor(r() * Math.max(1, base.length))];
  if (!pick) return;
  const c = pick.ro.cells.filter(free);
  if (!c.length) return;
  D.items.push({ i: nth(c, Math.floor(c.length / 2)), kind: 'spring', taken: false });
}

// ---------------------------------------------------------------- 祭壇の画面の1行
/** 祭壇の選択肢 o の1行（左に種類の名前を12マスの幅で、右に中身。HTML の文字列） */
export function altarLine(o: Item): string {
  const K = (t: string): string => t + ' '.repeat(Math.max(2, 12 - visW(t))); // 種類の名前の列は12マス（一番長い「枠を開ける」は10）
  if (o.opt === 'heal')
    return `${K('癒し')}<b style="color:#ff9aa8">+</b> 体力 ${Math.round(player.hp)} → ${Math.round(Math.min(adv.PLAYER_MAX, player.hp + adv.PLAYER_MAX * 0.7))}`;
  if (o.opt === 'open') return `${K('枠を開ける')}<b style="color:#ffe3a0">{ }</b> ${String(o.label)}`;
  if (o.opt === 'forge') {
    const w = must(o.forgeW, '鍛える武器'),
      cur = (trList(w).find((t) => t.k === o.forgeK) || { lv: 0 }).lv;
    return `${K('鍛える')}<span style="color:#bcdcff">${lookup(RUNE_DEF, w.type).name}</span>の ${trName(w.type, { k: String(o.forgeK), lv: 0 })}　<span class="lab">${cur ? `Lv${cur} → Lv${String(o.forgeTo)}` : `を足す（Lv1）`}</span>`;
  }
  const ru = must(o.rune, '祭壇のルーン'),
    d = lookup(RUNE_DEF, ru.type),
    br = CAT_BR[d.cat] || ['', ''],
    kind = d.cat === 'atk' ? '武器' : d.cat === 'body' ? '護符' : 'ルーン';
  if (d.cat === 'atk') {
    const tr = trList(ru),
      wc = weaponCol(ru);
    return `${K(kind)}<span${wc ? ` style="color:${wc}"` : ''}>${d.name}</span>　<span class="lab">${tr.length ? tr.map((t) => `${trName(ru.type, t)} Lv${t.lv}`).join('・') : String(d.desc)}</span>`;
  }
  return `${K(kind)}${br[0]}<b class="rn" style="color:${cssOf(runeCol(ru))}">${d.ch}</b> <span${ru.strong ? ` style="color:${css(nth(TIER_COL, 3))}"` : ''}>${runeName(ru)}</span>${br[1]}　<span class="lab">${String(CAT_NAME[d.cat])}${ru.strong ? '・強い版' : ''}</span>`;
}
