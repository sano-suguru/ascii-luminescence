// 伝説の物（もとは src/game/24-goal.js）。状態の入れ物 saved（今の探索の伝説の物 LEGEND）・adv（探索のシードと年代記）・here（今いる場所と最深部の状態）に頼る物。
// 伝説の物の読み方（どの支道にあるか・3つそろったか・最深部の手前の封・台座に置いたか・王の影が無防備か）と、世界の中に描く物（床の伝説の物・封の印・台座）。
import { lookup, must, nth } from './array.ts';
import { cssOf } from './color.ts';
import { G } from './glyphs.ts';
import { isFinal } from './levels.ts';
import { LEGEND_KINDS, LEGEND_ORDER } from './names.ts';
import { dyn } from './particles.ts';
import { mr } from './random.ts';
import { mulberry32 } from './rng.ts';
import { type Legend, type Monster, adv, here, player, saved } from './state.ts';
import { BRANCHES, FINAL_DEPTH, cpos } from './world.ts';

/**
 * 今の探索の伝説の物（燭台・鐘・鏡。名前と言い伝えは年代記から、ある支道は探索のシードで決める）。はじめて読んだ時に作って saved.LEGEND に入れる。
 * まだ年代記が無ければ null
 */
export function getLegend(): Legend | null {
  if (saved.LEGEND && saved.LEGEND.seed === adv.runSeed) return saved.LEGEND;
  const H = adv.HIST;
  if (!H) return null;
  const r = mulberry32((adv.runSeed ^ 0x1e9e3) >>> 0),
    pk = (a: string[]): string | undefined => a[Math.floor(r() * a.length)],
    R = H.rulers,
    last = nth(R, R.length - 1),
    civ = H.civ;
  const pool = Object.keys(BRANCHES),
    take = (k: string | undefined): string | undefined => {
      const i = k === undefined ? -1 : pool.indexOf(k);
      if (i >= 0) pool.splice(i, 1);
      return k;
    };
  const candle = r() < 0.75 && pool.includes('crypt') ? take('crypt') : take(pk(pool));
  const bell = r() < 0.75 && pool.includes('sunken') ? take('sunken') : take(pk(pool));
  const mirror = take(pk(pool));
  const r2 = nth(R, Math.floor(r() * Math.max(1, R.length - 1))),
    r3 = nth(R, Math.floor(r() * R.length));
  const items: Legend['items'] = {
    candle: {
      name: `${last.name}王の燭台`,
      lore: `${last.title}${last.name}が最後の夜にともした燭台。王国が闇に呑まれた時も、火だけは消えなかった。`,
      branch: candle,
      kind: 'candle',
    },
    bell: {
      name: bell === 'sunken' ? `${civ.name}の都の鐘` : `${r2.name}王の鐘`,
      lore:
        bell === 'sunken'
          ? `この鐘が鳴ったのは一度きり。${civ.name}の都が水に沈んだ日のことだ。`
          : `${r2.title}${r2.name}の時代に鋳られた鐘。その音は、闇をひととき退けたという。`,
      branch: bell,
      kind: 'bell',
    },
    mirror: {
      name: `${r3.name}王の鏡`,
      lore: `${civ.ep}が、最後の光を映して封じた鏡。覗くと、今はない空が見える。`,
      branch: mirror,
      kind: 'mirror',
    },
  };
  saved.LEGEND = { seed: adv.runSeed, items, have: new Set(), placed: new Set() };
  return saved.LEGEND;
}
/** 状態の表示の1行：伝説の物の印（手にしたか置いた物は光る）と名前 */
export function legendLine(): string {
  const L = getLegend();
  if (!L) return '';
  return (
    LEGEND_ORDER.map((k) => {
      const kd = lookup(LEGEND_KINDS, k),
        has = L.have.has(k) || L.placed.has(k);
      return has ? `<span class="glow" style="color:${cssOf(kd.col)}">${kd.ch}</span>` : `<span class="dim">${kd.ch}</span>`;
    }).join(' ') + `  <span class="lab">${LEGEND_ORDER.map((k) => lookup(LEGEND_KINDS, k).name).join('・')}</span>`
  );
}

/** 支道 bk にある伝説の物の種類。無ければ（年代記がまだ無い時も）null */
export const legendOfBranch = (bk: string): string | null => {
  const L = getLegend();
  if (!L) return null;
  return LEGEND_ORDER.find((k) => lookup(L.items, k).branch === bk) || null;
};
/** 伝説の物が3つそろったか */
export const legendAll = (): boolean => {
  const L = getLegend();
  return !!L && L.have.size >= 3;
};
/** 最深部の手前の階で、下りが封じられているか（伝説の物が3つそろうまで。支道・異界にはない） */
export const descentSealed = (): boolean => here.depth === FINAL_DEPTH - 1 && !here.branch && !here.realm && !legendAll();
/** 最深部の台座 p に、伝説の物を置いたか */
export const pedLit = (p: { kind: string }): boolean => {
  const L = getLegend();
  return !!L && L.placed.has(p.kind);
};
/** 生き物 m（王の影）が無防備か：伝説の物を置いた台座から 4.5 以内にいる。最深部の状態が無ければ true */
export function finalExposed(m: Monster): boolean {
  if (!here.finalSt) return true;
  return here.finalSt.peds.some((p) => {
    if (!pedLit(p)) return false;
    const [x, z] = cpos(p.i);
    return Math.hypot(m.x - x, m.z - z) < 4.5;
  });
}

/**
 * 伝説の物を世界の中に描く：床に落ちている伝説の物（光の柱）、封じられた下り階段のまわりの3つの印（手にした物は光る）、
 * 最深部の台座（置いた物は光の柱と輪）。最深部では、王の影が無防備な間、体を明るくし、心臓を見せる
 */
export function drawLegendWorld(t: number): void {
  const L = getLegend();
  if (!L || !here.D) return;
  const D = here.D;
  for (const it of D.items || []) {
    if (it.taken || it.kind !== 'legend') continue;
    const [x, z] = cpos(it.i),
      kd = lookup(LEGEND_KINDS, must(it.legend, '伝説の物の種類')),
      c = kd.col,
      b = 2.4 + 0.6 * Math.sin(t * 2.5);
    dyn(x, 1.0 + Math.sin(t * 1.6) * 0.08, z, G(kd.ch), 0.7, nth(c, 0) * b, nth(c, 1) * b, nth(c, 2) * b);
    for (let k = 0; k < 10; k++) {
      const a = t * 0.9 + (k / 10) * Math.PI * 2;
      dyn(x + Math.cos(a) * 0.5, 0.3 + k * 0.04, z + Math.sin(a) * 0.5, G('*'), 0.1, nth(c, 0) * 2, nth(c, 1) * 2, nth(c, 2) * 2);
    }
    for (let y = 0; y < 10; y++)
      dyn(x, 1.4 + y * 0.5, z, G('|'), 0.2, nth(c, 0) * (1.2 - y * 0.1), nth(c, 1) * (1.2 - y * 0.1), nth(c, 2) * (1.2 - y * 0.1));
  }
  if (descentSealed()) {
    const [x, z] = cpos(D.stairs);
    if (Math.hypot(x - player.x, z - player.z) < 30)
      LEGEND_ORDER.forEach((k, j) => {
        const a = (j / 3) * Math.PI * 2 + t * 0.3,
          kd = lookup(LEGEND_KINDS, k),
          has = L.have.has(k),
          c = kd.col,
          br = has ? 2.4 : 0.35;
        dyn(x + Math.cos(a) * 1.1, 0.9, z + Math.sin(a) * 1.1, G(kd.ch), 0.4, nth(c, 0) * br, nth(c, 1) * br, nth(c, 2) * br);
        for (let q = 0; q < 8; q++) {
          const b2 = a + q * 0.09;
          dyn(x + Math.cos(b2) * 1.1, 0.12, z + Math.sin(b2) * 1.1, G('.'), 0.1, 0.5, 0.45, 0.7);
        }
      });
  }
  if (here.finalSt && isFinal()) {
    for (const p of here.finalSt.peds) {
      const [x, z] = cpos(p.i),
        kd = lookup(LEGEND_KINDS, p.kind),
        c = kd.col,
        lit = L.placed.has(p.kind),
        can = L.have.has(p.kind);
      dyn(x, 0.25, z, G('#'), 0.4, 0.45, 0.42, 0.52);
      dyn(x, 0.6, z, G('='), 0.42, 0.55, 0.52, 0.6);
      const br = lit ? 3 : can ? 1.4 + 0.8 * Math.sin(t * 4) : 0.3;
      dyn(x, 1.0, z, G(kd.ch), 0.48, nth(c, 0) * br, nth(c, 1) * br, nth(c, 2) * br);
      if (lit) {
        for (let y = 0; y < 14; y++) {
          const fl = 0.75 + 0.25 * Math.sin(t * 3 + y);
          dyn(
            x + (mr() - 0.5) * 0.05,
            1.3 + y * 0.45,
            z,
            G(y % 3 ? '|' : '*'),
            0.22,
            nth(c, 0) * 2.2 * fl * (1 - y / 18),
            nth(c, 1) * 2.2 * fl * (1 - y / 18),
            nth(c, 2) * 2.2 * fl * (1 - y / 18),
          );
        }
        for (let k = 0; k < 28; k++) {
          const a = (k / 28) * Math.PI * 2 + t * 0.15;
          dyn(
            x + Math.cos(a) * 4.5,
            0.1,
            z + Math.sin(a) * 4.5,
            G(k % 4 ? '.' : '+'),
            0.16,
            nth(c, 0) * 1.3,
            nth(c, 1) * 1.3,
            nth(c, 2) * 1.3,
          );
        }
      }
    }
    const b = here.finalSt.boss;
    if (b && !b.dead && b.visible !== false) {
      const ex = finalExposed(b);
      b.glow = ex ? 2.2 + 0.4 * Math.sin(t * 9) : 0.55;
      b.heartOn = ex;
    }
  }
}
