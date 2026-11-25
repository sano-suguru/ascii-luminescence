// 伝説の物（もとは src/game/24-goal.js）。状態の入れ物 saved（今の探索の伝説の物 LEGEND）・adv（探索のシードと年代記）に頼る物。
import { lookup, nth } from './array.ts';
import { cssOf } from './color.ts';
import { LEGEND_KINDS, LEGEND_ORDER } from './names.ts';
import { mulberry32 } from './rng.ts';
import { type Legend, adv, saved } from './state.ts';
import { BRANCHES } from './world.ts';

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
  saved.LEGEND = { seed: adv.runSeed, items, have: new Set() };
  return saved.LEGEND;
}
/** 状態の表示の1行：伝説の物の印（手にしたか置いた物は光る）と名前 */
export function legendLine(): string {
  const L = getLegend();
  if (!L) return '';
  return (
    LEGEND_ORDER.map((k) => {
      const kd = lookup(LEGEND_KINDS, k),
        has = L.have.has(k);
      return has ? `<span class="glow" style="color:${cssOf(kd.col)}">${kd.ch}</span>` : `<span class="dim">${kd.ch}</span>`;
    }).join(' ') + `  <span class="lab">${LEGEND_ORDER.map((k) => lookup(LEGEND_KINDS, k).name).join('・')}</span>`
  );
}
