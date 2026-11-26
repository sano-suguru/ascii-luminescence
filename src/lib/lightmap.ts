// マスの明るさ（もとは src/game/14-lights-fixtures.js）と天井の高さ（もとは 06-world.js）。状態の入れ物 here（今の階の灯りと天井）・blaze（火の明かり）に頼る物。
// 灯りの計算そのもの（迷宮の生成も使う）は src/lib/light.ts。
import { must, nth } from './array.ts';
import { blaze, here } from './state.ts';
import { BASE_H, CELL, MH, MW } from './world.ts';

/** cellLight が返す色（毎回同じ配列を書き直して返す。持っておく時は写すこと） */
const out: [number, number, number] = [0, 0, 0];
/** x・z のマスの明るさ（RGB）：そのマスに届く灯り（3つまで）と、燃えている火の明かり。マップの外は 0 */
export function cellLight(x: number, z: number): [number, number, number] {
  out[0] = out[1] = out[2] = 0;
  const cx = Math.floor(x / CELL),
    cz = Math.floor(z / CELL);
  if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) return out;
  const D = must(here.D, '今の階 here.D'),
    o = (cz * MW + cx) * 3;
  for (let k = 0; k < 3; k++) {
    const id = D.cellLI[o + k] ?? NaN;
    if (id < 0) break;
    const L = nth(D.lights, id),
      w = (D.cellLW[o + k] ?? NaN) * L.int * L.f;
    out[0] += L.col[0] * w;
    out[1] += L.col[1] * w;
    out[2] += L.col[2] * w;
  }
  const fl = blaze.fireLight[cz * MW + cx] ?? NaN;
  if (fl > 0) {
    out[0] += fl * 2.2;
    out[1] += fl * 0.99;
    out[2] += fl * 0.26;
  }
  return out;
}

/** x・z のマスの天井の高さ。マップの外は BASE_H。座標が NaN の時は、範囲の確かめをすり抜けて undefined（呼ぶ側の計算で NaN になる） */
export const ceilAt = (x: number, z: number): number | undefined => {
  const cx = Math.floor(x / CELL),
    cz = Math.floor(z / CELL);
  if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) return BASE_H;
  return must(here.D, '今の階 here.D').ceil[cz * MW + cx];
};
