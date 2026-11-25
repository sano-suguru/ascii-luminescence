// 下の HUD（もとは src/game/26-spells-hud.js）。状態の入れ物 gear（両手・詠唱・付け替え）に頼り、画面の #hotbar に書く。
import { lookup } from './array.ts';
import { cssOf } from './color.ts';
import { type Side, effHand } from './gear.ts';
import { RUNE_DEF, TIER_COL, elemCol, handName, handRunes, syncHand } from './runes.ts';
import { gear } from './state.ts';

/** 下の HUD を描き直す（左右の手の性質・武器・発動と、詠唱の溜め・付け替えの進み） */
export function renderHotbar(): void {
  const el = document.getElementById('hotbar');
  if (!el || !gear.hands) return;
  const part = (h: Side): string => {
    const H = effHand(h);
    syncHand(H);
    const c = elemCol(H.elem ? H.elem.type : null),
      gl = [
        ...new Set(
          handRunes(H)
            .filter((r) => lookup(RUNE_DEF, r.type).cat === 'elem')
            .map((r) => r.type),
        ),
      ]
        .map(
          (t) =>
            `<span class="rn" style="color:${cssOf(lookup(RUNE_DEF, t).col)}${H.elem && H.elem.type === t ? '' : ';opacity:0.45'}">${lookup(RUNE_DEF, t).ch}</span>`,
        )
        .join('');
    const tg = H.trig ? ` <span class="rn dim2" style="color:${cssOf(TIER_COL[0])}">${lookup(RUNE_DEF, H.trig.type).ch}</span>` : '';
    let bar = '';
    if (gear.castSt && gear.castSt.h === h) {
      const k = Math.min(1, gear.castSt.t / Math.max(0.01, gear.castSt.need)),
        n = Math.round(k * 8);
      bar = `\n<span style="color:${cssOf(c)}">${'='.repeat(n)}</span><span class="dim">${'-'.repeat(8 - n)}</span>`;
    }
    return `<span class="${gear.castSt && gear.castSt.h === h ? 'on' : ''}"><span class="dim">${h === 'L' ? '左' : '右'}</span> ${gl || '<span class="dim">-</span>'} <span style="color:${cssOf(c)}">${handName(H)}</span>${tg}${bar}</span>`;
  };
  let sw = '';
  if (gear.swapSt) {
    const n = Math.round((gear.swapSt.t / gear.swapSt.dur) * 10);
    sw = `\n<span class="lab">付け替え</span> ${'='.repeat(n)}<span class="dim">${'-'.repeat(10 - n)}</span>`;
  }
  el.innerHTML = part('L') + '      ' + part('R') + sw;
}
