// 世界の組み立て（もとは src/game/06-world.js・18-level-player.js）：階の霧の色、水面の絵、階の文字の組み立て。
// 状態の入れ物 here（今の階）・gfx（three.js の物）に頼る。three.js は src/lib/three.ts の T。
import { must, nth } from './array.ts';
import { topLights } from './light.ts';
import { flowW } from './math.ts';
import { gfx, here } from './state.ts';
import { T, fogCol } from './three.ts';
import { CELL, FOGS, LQ_DEEP, LQ_WATER, MW, NCELL } from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/** 階の霧の色と濃さ（層の霧の色、無ければ溶岩の海・深淵の色か、深さごとの色。階の暗さを掛ける。もとは src/game/18-level-player.js） */
export function setFog(): void {
  const k = level().prof.fogDark,
    f = (
      level().stratum.fog
        ? must(level().stratum.fog)
        : level().stratum.k === 'magma'
          ? [0.016, 0.004, 0.003]
          : level().stratum.k === 'abyss'
            ? [0.007, 0.003, 0.014]
            : nth(FOGS, (here.depth - 1) % FOGS.length)
    ).map((v) => v * k);
  fogCol.set(nth(f, 0), nth(f, 1), nth(f, 2));
  must(gfx.renderer).setClearColor(new T.Color(nth(f, 0), nth(f, 1), nth(f, 2)), 1);
  gfx.fogBase = 0.05 + Math.min(here.depth - 1, 6) * 0.002;
  must(gfx.U).uFogDen.value = gfx.fogBase;
}
/** 水面の絵を書き直す（水のマスごとに、深さ・流れ・湖か・藻と、上から届く2つの灯りの番号と重み。もとは src/game/06-world.js） */
export function updateWater(): void {
  const W2 = must(gfx.waterTex).image.data,
    L2 = must(gfx.waterLTex).image.data,
    oI = new Float32Array(3),
    oW = new Float32Array(3);
  for (let i = 0; i < NCELL; i++) {
    const lq = level().liquid[i],
      o = i * 4;
    W2[o] = W2[o + 1] = W2[o + 2] = W2[o + 3] = 0;
    L2[o] = L2[o + 1] = L2[o + 2] = L2[o + 3] = 0;
    if (lq !== LQ_WATER && lq !== LQ_DEEP) continue;
    const r = nth(level().roomOf, i) >= 0 ? nth(level().rooms, nth(level().roomOf, i)) : null,
      lake = (r && r.theme && r.theme.k === 'lake') || level().stratum.k === 'cavern';
    W2[o] = lq === LQ_DEEP ? 1 : 0.5;
    W2[o + 1] = level().flow[i] ? flowW(nth(level().flow, i)) : 0;
    W2[o + 2] = lake ? 1 : 0;
    W2[o + 3] = level().algae && level().algae[i] ? 1 : 0;
    topLights(level().lights, ((i % MW) + 0.5) * CELL, 0.1, (((i / MW) | 0) + 0.5) * CELL, 0, 1, 0, i, oI, oW, 0);
    L2[o] = nth(oI, 0) >= 0 ? nth(oI, 0) + 1 : 0;
    L2[o + 1] = nth(oW, 0);
    L2[o + 2] = nth(oI, 1) >= 0 ? nth(oI, 1) + 1 : 0;
    L2[o + 3] = nth(oW, 1);
  }
  must(gfx.waterTex).needsUpdate = true;
  must(gfx.waterLTex).needsUpdate = true;
}
