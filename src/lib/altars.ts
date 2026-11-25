// 祭壇とルーンを置く（もとは src/game/21-altars-heal.js）。状態の入れ物 here（今の階）・gear（手）・adv（探索）・player・saved（墓の記録）・ui（試しの間の中か）に頼る物。
// 拾う・選ぶ・祭壇の画面は、伝言と画面に頼るので、まだ古い JS（21-altars-heal.js）にある。
import { lookup, must, nth } from './array.ts';
import { css } from './color.ts';
import { MTYPES } from './creatures.ts';
import { type Item, type Room, type Spawn } from './generate.ts';
import { graveRune, makeRune, makeStrong, randomRuneType } from './gear.ts';
import { RUNE_CHARS } from './glyphs.ts';
import { levelSeed } from './levels.ts';
import { statOf } from './monsters.ts';
import { mpick, mr, shuffle } from './random.ts';
import { mulberry32 } from './rng.ts';
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
import { type Hands, adv, gear, here, player, saved, ui } from './state.ts';
import { visW } from './text.ts';
import { lockedOf, weaponPool } from './unlocks.ts';
import { FINAL_DEPTH, LQ_DEEP, LQ_LAVA, MH, MW, NCELL, TF, cpos } from './world.ts';

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
 * まれに武器・体力が最大の85%より少なければ癒し。主の祭壇は強い選択肢（武器・鍛える）と、体力が最大の85%より少なければ癒し。鍛えの祭壇は、持っている武器の鍛え方を3つ
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
export function placeSpring<T extends ScoredRoom>(
  r: () => number,
  free: (c: number) => boolean,
  scored?: T[],
  spreadPick?: (list: T[]) => T | null | undefined,
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

// ---------------------------------------------------------------- 階ごとに、祭壇とルーンを置く
/** 数の配列 a の i 番目（範囲の外は NaN。古い JS で undefined を数として比べた時と同じ結果になる） */
const numAt = (a: ArrayLike<number>, i: number): number => a[i] ?? NaN;
/** 強敵の部屋に置く種類：この階で戦う生き物のうち、体力が一番多い物（忘れられた獣・竜・機械・王の影の手前の主 D は除く） */
export function strongestKey(): string | null {
  const kinds = Object.keys(hostileKeys()).filter((k) => {
    const ty = lookup(MTYPES, k);
    return !ty.beast && !ty.dragon && k !== 'X' && k !== 'D';
  });
  let best: string | null = null,
    bh = -1;
  for (const k of kinds) {
    const h = nth(statOf({ ty: lookup(MTYPES, k), key: k }), 0);
    if (h > bh) {
      bh = h;
      best = k;
    }
  }
  return best;
}
/** 部屋の候補（本道からの外れ det と、本道の真ん中からの離れ mid） */
interface PathRoom extends ScoredRoom {
  ro: Room;
  mid: number;
}
/**
 * 深さ2から下（と支道・異界）の祭壇などを置く。r は階のシードの乱数、free は物を置けるマス。
 * 本道（始まりから階段まで）の真ん中あたりに祭壇、ときどき脇道にもう1つ。十字路・強敵の部屋・泉・墓・鍛えの祭壇・寄り道の泉も置き、
 * 入口の近くの群れを階段のほうへ動かし、ときどき階段の前に群れを待たせる
 */
export function mainPathAltars(r: () => number, free: (c: number) => boolean): void {
  const D = level();
  if (D.stratum.special || D.finalVault) return;
  const W = MW,
    N = D.tile.length,
    ok = (i: number): boolean => i >= 0 && i < N && D.tile[i] === TF && D.liquid[i] !== LQ_DEEP && D.liquid[i] !== LQ_LAVA;
  const bfs = (s: number | null | undefined): Int32Array => {
    const d = new Int32Array(N).fill(-1);
    if (s == null || s < 0 || !ok(s)) return d;
    const q = [s];
    d[s] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = nth(q, h);
      for (const o of [1, -1, W, -W]) {
        const j = c + o;
        if (ok(j) && numAt(d, j) < 0) {
          d[j] = numAt(d, c) + 1;
          q.push(j);
        }
      }
    }
    return d;
  };
  const dS = bfs(D.start),
    goal = D.stairs >= 0 ? D.stairs : D.bstairs ? D.bstairs.cell : -1,
    dT = bfs(goal),
    L = goal >= 0 && numAt(dS, goal) > 0 ? numAt(dS, goal) : 0;
  const rooms = D.rooms
    .map((ro, ri) => ({ ro, ri }))
    .filter((o) => o.ri > 0 && o.ro.cells.length > 10 && !(o.ro.kindMsg && o.ro.kindMsg.includes('鉄格子の奥')));
  const score = (ro: Room): { det: number; mid: number } => {
    let best = 1e9,
      mid = 1e9;
    for (const c of ro.cells) {
      if (numAt(dS, c) < 0 || numAt(dT, c) < 0) continue;
      const det = numAt(dS, c) + numAt(dT, c) - L;
      if (det < best) {
        best = det;
        mid = Math.abs(numAt(dS, c) - L / 2);
      }
    }
    return { det: best, mid };
  };
  const scored: PathRoom[] = rooms.map((o) => ({ ...o, ...score(o.ro) })).filter((o) => o.det < 1e8);
  let hubDistRef: Float32Array | null = null;
  const pickCell = (ro: Room): number | undefined => {
    const c = ro.cells.filter(free);
    if (!c.length) return undefined;
    if (hubDistRef) {
      const ref = hubDistRef,
        nearC = c.filter((x) => numAt(ref, x) <= 9);
      if (nearC.length) return nearC[Math.floor(nearC.length / 2)];
    }
    return c[Math.floor(c.length / 2)];
  };
  D.dS = dS;
  D.pathL = L;
  // 十字路：本道の真ん中あたりの、一番大きい部屋（ふつうの階と異界。深さ1・特別な階・支道には無い）
  let hub: PathRoom | null = null;
  if (L > 0 && !here.branch && (here.depth >= 2 || here.realm) && !D.stratum.special) {
    for (const o of scored) {
      if (o.det > 4) continue;
      let pos = 0,
        n = 0;
      for (const c of o.ro.cells)
        if (numAt(dS, c) >= 0) {
          pos += numAt(dS, c);
          n++;
        }
      pos = n ? pos / n / L : 0;
      if (pos < 0.25 || pos > 0.75) continue;
      if (!hub || o.ro.cells.length > hub.ro.cells.length) hub = o;
    }
  }
  if (hub) {
    const cx = hub.ro.cells.reduce((a, c) => a + (c % W), 0) / hub.ro.cells.length,
      cz = hub.ro.cells.reduce((a, c) => a + ((c / W) | 0), 0) / hub.ro.cells.length;
    D.hub = { ri: hub.ri, cx, cz };
  }
  let hubDist: Float32Array | null = null;
  if (D.hub) {
    const hd = new Float32Array(N).fill(1e9),
      hc = nth(D.rooms, D.hub.ri).cells,
      q = hc.slice();
    for (const c of hc) hd[c] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = nth(q, h);
      if (numAt(hd, c) >= 10) continue;
      for (const o of [1, -1, W, -W]) {
        const j = c + o;
        if (j < 0 || j >= N || numAt(hd, j) <= numAt(hd, c) + 1) continue;
        hd[j] = numAt(hd, c) + 1;
        q.push(j);
      }
    }
    hubDist = hd;
  }
  hubDistRef = hubDist;
  const nearHub = (o: PathRoom): boolean => {
    if (!D.hub) return true;
    const hd = must(hubDist, '十字路からの歩数');
    for (const c of o.ro.cells) if (numAt(hd, c) <= 10) return true;
    return false;
  };
  const hubAt = D.hub,
    sx = hubAt ? hubAt.cx : D.start % W,
    sz = hubAt ? hubAt.cz : (D.start / W) | 0,
    angOf = (ro: Room): number =>
      Math.atan2(
        ro.cells.reduce((a, c) => a + ((c / W) | 0), 0) / ro.cells.length - sz,
        ro.cells.reduce((a, c) => a + (c % W), 0) / ro.cells.length - sx,
      );
  const placedA: number[] = [];
  if (goal >= 0) placedA.push(Math.atan2(((goal / W) | 0) - sz, (goal % W) - sx));
  const adiff = (a: number, b: number): number => {
    const d = Math.abs(a - b) % (Math.PI * 2);
    return d > Math.PI ? Math.PI * 2 - d : d;
  };
  const spreadPick = (list: PathRoom[]): PathRoom | null | undefined => {
    if (!list.length) return null;
    const fine = list.filter((o) => placedA.every((a) => adiff(angOf(o.ro), a) >= Math.PI / 3));
    if (fine.length) return fine[Math.floor(r() * fine.length)];
    return list
      .slice()
      .sort(
        (p, q) => Math.min(...placedA.map((a) => adiff(angOf(q.ro), a)), 9) - Math.min(...placedA.map((a) => adiff(angOf(p.ro), a)), 9),
      )[0];
  };
  const main =
    L > 0 ? scored.filter((o) => o.det <= Math.max(6, L * 0.15)).sort((a, b) => a.mid - b.mid)[0] : scored[Math.floor(r() * scored.length)];
  let mainAt = main ? pickCell(main.ro) : undefined;
  if (mainAt === undefined && L > 0) {
    let best = -1,
      bs = 1e9;
    for (let c = 0; c < N; c++) {
      if (numAt(dS, c) < 0 || numAt(dT, c) < 0 || !free(c)) continue;
      const det = numAt(dS, c) + numAt(dT, c) - L;
      if (det > 3) continue;
      const sc = Math.abs(numAt(dS, c) - L / 2) + det * 2;
      if (sc < bs && numAt(dS, c) > 4 && numAt(dT, c) > 4) {
        bs = sc;
        best = c;
      }
    }
    if (best >= 0) mainAt = best;
  }
  if (mainAt !== undefined)
    placeAltar(mainAt, 'altar' + levelSeed() + 'm', { guardG: main && r() < 0.6 ? addGuards(mainAt, r) : undefined });

  const sidePool = (o: PathRoom): boolean => o !== main && o !== hub && (D.hub ? nearHub(o) && o.det >= 4 : o.det >= 12);
  const side = r() < 0.2 ? spreadPick(scored.filter((o) => sidePool(o))) : null;
  if (side) placedA.push(angOf(side.ro));
  if (side) {
    const c = pickCell(side.ro);
    if (c !== undefined) placeAltar(c, 'altar' + levelSeed() + 's', { guardG: addGuards(c, r) });
  }
  // 強敵の部屋：本道から外れた部屋に、強い生き物が1体、珍しいルーン（武器）を守っている
  const er = spreadPick(scored.filter((o) => o !== side && o.ro.cells.length > 12 && (D.hub ? sidePool(o) : o.det >= 5 && o !== main))),
    key = strongestKey();
  if (er) placedA.push(angOf(er.ro));
  const roll = r();
  D.eliteWhy = { rooms: scored.length, far: scored.filter((o) => o.det >= 5).length, er: !!er, key, roll: +roll.toFixed(2) };
  if (er && key && roll < 0.35) {
    const cells = er.ro.cells.filter(free);
    if (cells.length > 3) {
      const c = nth(cells, Math.floor(cells.length / 2)),
        g = nextGroup(),
        sc = cells.filter((x) => x !== c && Math.hypot((x % MW) - (c % MW), ((x / MW) | 0) - ((c / MW) | 0)) >= 1.5)[0];
      if (sc !== undefined) {
        D.spawns.push({ key, cx: sc % MW, cz: (sc / MW) | 0, g, lead: true, home: er.ri, elite: true });
        const wp = weaponPool();
        D.items.push({
          i: c,
          kind: 'rune',
          rune: rollTraits(makeRune(nth(wp, Math.floor(r() * wp.length))), here.depth, 1),
          taken: false,
          elitePrize: true,
          guardG: g,
        });
      }
    }
  }
  placeSpring(r, free, D.hub ? scored.filter((o) => sidePool(o)) : scored, spreadPick);
  const grave = saved.META.grave;
  if (
    grave &&
    !here.branch &&
    !here.realm &&
    !here.inter &&
    !ui.gallery &&
    grave.depth === here.depth &&
    !D.items.some((o) => o.kind === 'grave')
  ) {
    const pool = scored.filter((o) => sidePool(o)),
      ro = (pool[pool.length - 1] || scored[scored.length - 1])?.ro;
    if (ro) {
      const c = ro.cells.filter(free);
      if (c.length)
        D.items.push({ i: nth(c, Math.floor(c.length / 2)), kind: 'grave', g: grave, rune: graveRune(grave.item), taken: false });
    }
  }
  if (!here.branch && !here.realm && !here.inter && forgeDepthOf(D.stratum.k) === here.depth) {
    const ro = D.hub ? nth(D.rooms, D.hub.ri) : (scored.find((o) => o.det >= 3) || scored[0])?.ro;
    if (ro) {
      const c = ro.cells.filter(free);
      if (c.length) placeAltar(nth(c, Math.floor(c.length * 0.3)), 'forge' + levelSeed(), { forge: true });
    }
  }
  // 十字路には選ぶ所が要る：矢印が届く所に、寄り道の場所を少なくとも2つ
  if (D.hub) {
    const hd = must(hubDist, '十字路からの歩数'),
      hubC = D.hub;
    const near = (): number =>
      D.items.filter(
        (it) =>
          !it.taken &&
          (it.kind === 'spring' || it.elitePrize || it.vault || (it.altar && it.slot === 1 && (it.grp ?? '').endsWith('s'))) &&
          numAt(hd, it.i) <= 11,
      ).length;
    const used = new Set(D.items.map((it) => D.roomOf[it.i]));
    let tries = 0;
    const pocket = (): number | undefined => {
      const taken = D.items.map((it) => it.i),
        cs: number[] = [];
      for (let c = 0; c < N; c++) {
        if (!free(c) || !(numAt(hd, c) <= 10) || numAt(dS, c) < 0 || numAt(dT, c) < 0 || numAt(dS, c) + numAt(dT, c) - L < 5) continue;
        if (taken.some((t) => Math.hypot((t % W) - (c % W), ((t / W) | 0) - ((c / W) | 0)) < 6)) continue;
        cs.push(c);
      }
      if (!cs.length) return undefined;
      const ang = (c: number): number => Math.atan2(((c / W) | 0) - hubC.cz, (c % W) - hubC.cx),
        fine = cs.filter((c) => placedA.every((a) => adiff(ang(c), a) >= Math.PI / 3));
      const from = fine.length ? fine : cs,
        pick = nth(from, Math.floor(r() * from.length));
      placedA.push(ang(pick));
      return pick;
    };
    while (near() < 2 && tries++ < 4) {
      const pool = scored.filter((o) => sidePool(o) && !used.has(o.ri) && o.ro.cells.length > 6),
        o = spreadPick(pool);
      let c: number | undefined;
      if (o) {
        used.add(o.ri);
        placedA.push(angOf(o.ro));
        c = pickCell(o.ro);
      } else c = pocket();
      if (c === undefined) continue;
      D.items.push({ i: c, kind: 'spring', taken: false });
    }
    D.hubNear = near();
  }
  // 入口の近くでうろつく群れは、階段のほうへ動かす（住みかと番人は動かさない）
  if (L > 0) {
    const groups = new Map<number, Spawn[]>();
    for (const sp of D.spawns) {
      if (sp.camp || sp.home !== undefined || sp.elite || sp.key === 'lord' || sp.key === 'final' || sp.g == null || sp.g < 0) continue;
      const ty = MTYPES[sp.key];
      if (!ty || ty.habitat || ty.critter || ty.peaceful || ty.boss) continue;
      const list = groups.get(sp.g) || [];
      if (!groups.has(sp.g)) groups.set(sp.g, list);
      list.push(sp);
    }
    const late: number[] = [];
    for (let c = 0; c < N; c++) if (numAt(dS, c) > L * 0.7 && numAt(dT, c) > 4 && free(c)) late.push(c);
    for (const list of groups.values()) {
      const first = nth(list, 0),
        c0 = first.cz * W + first.cx;
      if (!(numAt(dS, c0) >= 0 && numAt(dS, c0) < L * 0.3) || r() >= 0.5 || !late.length) continue;
      const nc = nth(late, Math.floor(r() * late.length));
      for (const sp of list) {
        let best = nc;
        for (let k = 0; k < 8; k++) {
          const c = nc + Math.round((r() - 0.5) * 4) + Math.round((r() - 0.5) * 4) * W;
          if (free(c) && numAt(dS, c) >= 0) {
            best = c;
            break;
          }
        }
        sp.cx = best % W;
        sp.cz = (best / W) | 0;
      }
    }
  }
  // ときどき、階段の前の部屋に小さな群れが待つ。倒れるまで、階段は封じられる
  if (
    L > 0 &&
    D.stairs >= 0 &&
    !D.finalVault &&
    !D.stratum.special &&
    (here.branch ? here.branch.lvl < here.branch.len : here.depth >= 2 && here.depth < FINAL_DEPTH) &&
    !here.realm &&
    r() < 0.3
  ) {
    const hk = hostileKeys(),
      kinds = Object.keys(hk);
    if (kinds.length) {
      const key2 = must(kinds.sort((a, b) => (hk[b] ?? 0) - (hk[a] ?? 0))[0], '群れの種類'),
        g = nextGroup();
      const cells: number[] = [];
      for (let c = 0; c < N; c++) if (numAt(dT, c) >= 2 && numAt(dT, c) <= 5 && free(c)) cells.push(c);
      const n = 2 + (r() < 0.5 ? 1 : 0);
      if (cells.length >= n) {
        for (let k = 0; k < n; k++) {
          const c = must(cells.splice(Math.floor(r() * cells.length), 1)[0], '群れのマス');
          D.spawns.push({ key: key2, cx: c % W, cz: (c / W) | 0, g, lead: k === 0 });
        }
        D.stairGuard = g;
      }
    }
  }
}
/**
 * 今の階に、ルーンと祭壇を置く（階に入るたびに、階のシードで決める）。深さ1は、始まりのそばの3つの台（まだ選んでいなければ）と
 * 最初の祭壇（まだ取っていなければ）。深さ2から下は mainPathAltars。宝物庫の褒美に起きることを決め、階段と門のそばに石碑を置く。
 * 前に取った物（探索の記録 taken）は、取ったままにする
 */
export function placeRunesForLevel(): void {
  const D = level(),
    seed = levelSeed(),
    r = mulberry32(seed ^ 0x5eed1);
  const free = (c: number): boolean =>
    c >= 0 &&
    c < NCELL &&
    D.tile[c] === TF &&
    !D.liquid[c] &&
    !D.solid.has(c) &&
    c !== D.stairs &&
    c !== D.upstairs &&
    !D.items.some((it) => it.i === c);
  const rs = adv.runState;
  if (here.depth === 1 && !here.branch && !here.realm && !rs.startChosen) {
    const s = D.start,
      cand: [number, number][] = [];
    for (let dz = -3; dz <= 3; dz++)
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dz);
        if (d < 1.8 || d > 3.2) continue;
        const c = s + dx + dz * MW;
        if (free(c)) cand.push([Math.atan2(dz, dx), c]);
      }
    cand.sort((a, b) => a[0] - b[0]);
    const els = shuffle(RUNE_TYPES.elem.slice(), r).slice(0, 3);
    if (cand.length >= 3) {
      const step = cand.length / 3;
      for (let k = 0; k < 3; k++)
        D.items.push({
          i: nth(cand, Math.floor(k * step + step / 2))[1],
          kind: 'rune',
          rune: makeRune(nth(els, k)),
          grp: 'start',
          pedestal: true,
          taken: false,
        });
    }
  }
  if (here.depth === 1 && !here.branch && !here.realm && !rs.altar1) {
    const rooms = D.rooms.filter((ro, ri) => ri > 0 && !ro.cave && ro.cells.length > 12),
      ro = rooms.length ? nth(rooms, Math.floor(r() * rooms.length)) : null;
    const c = ro ? ro.cells.filter(free) : [];
    if (c.length) {
      const a = nth(c, Math.floor(c.length / 2));
      const opts = [...shuffle(RUNE_TYPES.elem.slice(), r).slice(0, 2), nth(RUNE_TYPES.trig, Math.floor(r() * 2))];
      opts.forEach((t, k) => {
        r(); // ルーンごとに乱数を1回引く（使わないが、引く数を変えると同じシードで違う迷宮になる）
        D.items.push({ i: a, kind: 'rune', rune: makeRune(t), grp: 'altar1', altar: true, slot: k, taken: false });
      });
    }
  } else if (here.depth > 1 || here.branch || here.realm) mainPathAltars(r, free);
  for (const it of D.items) if (it.vault && !it.ev) it.ev = r() < 0.5 ? 'guard' : 'collapse';
  // 階段と門のそばの石碑：そこでは、その場でルーンを付け替えられる
  D.steles = [];
  for (const c0 of [D.stairs, D.upstairs, D.bstairs?.cell, D.portal?.cell]) {
    if (c0 === undefined || c0 === null || c0 < 0) continue;
    const nb = [1, -1, MW, -MW, MW + 1, MW - 1, -MW + 1, -MW - 1].map((o) => c0 + o).find(free);
    if (nb !== undefined) D.steles.push({ i: nb, g: nth(RUNE_CHARS, Math.floor(r() * RUNE_CHARS.length)) });
  }
  D.items.forEach((it, k) => {
    if (rs.taken.has(seed + ':' + k + ':' + it.kind)) it.taken = true;
  });
}
/** 石碑か祭壇のそば（2.6より近い）か、試しの間の中か（そこでは、詠唱なしでルーンを付け替えられる） */
export const nearStele = (): boolean => {
  const D = level(),
    near = (i: number): boolean => {
      const [x, z] = cpos(i);
      return Math.hypot(x - player.x, z - player.z) < 2.6;
    };
  return (
    (ui.gallery && ui.gallery.mode === 'range') ||
    (D.steles || []).some((s) => near(s.i)) ||
    D.items.some((o) => o.altar && o.slot === 1 && near(o.i))
  );
};
