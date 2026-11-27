// テストの道具：粒子を動かす処理（src/lib/motes.ts の updateParticles・riverFX・updateGasPoints）を、たくさんの場合で呼び、結果を1つの文字列にまとめる。
// F は関数をまとめた物、A は描く粒子の配列（ptPos・ptCol・ptSize・ptGly）。motes.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の全部の場所）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、本物の階に、降る物（雪・灰・無し）・川のマス（水・深い水・溶岩・凍った水・流れの無い水、遠いマス）・ガスの濃さ（境の値 0.04・0.15・0.35 と、
// 上限の GAS_N に届く濃い沼）・火の明かりを決め、塵を置き直して一部を遠く・天井より上・床の下へ動かし、動き方 0・1・2 の粒子（寿命が尽きる物・数の上限の近くも）を出して、
// 何フレームか進める（止まっている dt=0 も）。ガスを止めた後の updateGasPoints と、川のさざ波だけを出す riverFX も直に呼ぶ。
// 記録するのは、描く粒子の配列（塵・ガス・そのほかに分けて、数を丸めない文字列の指紋）・粒子と塵の配列・生きている粒子の数・GPU に渡す数（描く範囲・updateRange・版）・
// その後の見た目の乱数1つ（引いた回数の違いを見る）。テストを .mjs で書くのは、古い JS の関数と同じ台本で比べるため。書き換えた状態は、終わったら元に戻す。
import * as THREE from 'three';
import { P, initDust, spawn } from '../../src/lib/particles.ts';
import { mr, withVisualRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { DUST_N, P0, P_MAX } from '../../src/lib/shaders.ts';
import { blaze, buf, dust, gfx, here, player } from '../../src/lib/state.ts';
import { CELL, LQ_DEEP, LQ_LAVA, LQ_WATER, MH, MW, NCELL, TC, TF } from '../../src/lib/world.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** 配列の a から b 未満（step 個ずつ）の指紋 */
const part = (arr, a, b) => fnv(Array.prototype.join.call(arr.subarray(a, b), ','));

/** seeds：場合の数 */
export async function motesCases(F, A, seeds) {
  const env = await loadEnv(),
    out = [];
  const keep = {
    here: { D: here.D, riverCells: here.riverCells },
    blaze: { gasAny: blaze.gasAny, fireLight: blaze.fireLight },
    player: { ...player },
    buf: { ...buf },
    gfx: { ptGeo: gfx.ptGeo, bpPos: gfx.bpPos, bpCol: gfx.bpCol, bpSize: gfx.bpSize, bpGly: gfx.bpGly },
    // 中身を書き換える配列（粒子・塵・描く粒子）は写しを取って、終わったら書き戻す
    arrays: [...Object.values(P), ...Object.values(dust), A.ptPos, A.ptCol, A.ptSize, A.ptGly].map((a) => [a, a.slice()]),
  };
  // GPU に渡す形と属性（05-renderer.js と同じ作り方。three.js は作る時に Math.random を引くので、場合の前に作る）
  const geo = new THREE.BufferGeometry(),
    at = [
      new THREE.BufferAttribute(A.ptPos, 3).setUsage(THREE.DynamicDrawUsage),
      new THREE.BufferAttribute(A.ptCol, 3).setUsage(THREE.DynamicDrawUsage),
      new THREE.BufferAttribute(A.ptSize, 1).setUsage(THREE.DynamicDrawUsage),
      new THREE.BufferAttribute(A.ptGly, 1).setUsage(THREE.DynamicDrawUsage),
    ];
  Object.assign(gfx, { ptGeo: geo, bpPos: at[0], bpCol: at[1], bpSize: at[2], bpGly: at[3] });
  const record = (label) => {
    const n = buf.pN,
      gasOn = Array.from(A.ptSize.subarray(DUST_N, P0)).filter((v) => v > 0).length;
    const arrs = ['ptPos', 'ptCol'].map(
      (k) => `${k}:${part(A[k], 0, DUST_N * 3)}/${part(A[k], DUST_N * 3, P0 * 3)}/${part(A[k], P0 * 3, (P0 + n) * 3)}`,
    );
    const ones = ['ptSize', 'ptGly'].map((k) => `${k}:${part(A[k], 0, DUST_N)}/${part(A[k], DUST_N, P0)}/${part(A[k], P0, P0 + n)}`);
    const pf = Object.entries(P)
      .map(([k, a]) => `${k}${part(a, 0, n)}`)
      .join(' ');
    const df = Object.entries(dust)
      .map(([k, a]) => `${k}${part(a, 0, DUST_N)}`)
      .join(' ');
    const gpu =
      `range=${geo.drawRange.start},${geo.drawRange.count} ` +
      at.map((a) => `${a.updateRange.offset},${a.updateRange.count},v${a.version}`).join(' ');
    out.push(`${label} pN=${n} gas=${gasOn} ${arrs.join(' ')} ${ones.join(' ')} | P ${pf} | dust ${df} | ${gpu} | next=${mr()}`);
  };
  try {
    for (let s = 0; s < seeds; s++) {
      const place = PLACES[s % PLACES.length],
        R = mulberry32(9100 + s * 31);
      const D = gen(env, 4000 + s * 13, place).level;
      withVisualRand(mulberry32(777 + s), () => {
        // 降る物：雪・灰・無し（層の表を書き換えないよう、写してから変える）
        D.stratum = { ...D.stratum, fall: [undefined, 'snow', 'ash'][s % 3] };
        here.D = D;
        // プレイヤー：床か裂け目のマス（場合によってマップの左上か右下の端の近く）
        const floors = [];
        for (let i = 0; i < NCELL; i++) if (D.tile[i] === TF || D.tile[i] === TC) floors.push(i);
        const pc = s % 7 === 3 ? MW + 1 : s % 7 === 6 ? NCELL - MW - 2 : floors[Math.floor(R() * floors.length)];
        player.x = ((pc % MW) + R()) * CELL;
        player.z = (Math.floor(pc / MW) + R()) * CELL;
        const pcx = Math.floor(player.x / CELL),
          pcz = Math.floor(player.z / CELL);
        // 川のマス：まわりと遠くのマスに、水・深い水・溶岩・凍った水（液体なし）を混ぜ、流れの向きを決める（流れが無いマスも）
        here.riverCells = [];
        if (s % 5 !== 4)
          for (let k = 0; k < 40; k++) {
            const far = k % 6 === 5,
              cx = Math.max(0, Math.min(MW - 1, pcx + Math.round((R() - 0.5) * (far ? 60 : 14)))),
              cz = Math.max(0, Math.min(MH - 1, pcz + Math.round((R() - 0.5) * (far ? 60 : 14)))),
              i = cz * MW + cx;
            D.liquid[i] = [LQ_WATER, LQ_DEEP, LQ_WATER, LQ_LAVA, 0][k % 5];
            D.flow[i] = k % 9 === 8 ? 0 : 10 + R() * 6.3;
            here.riverCells.push(i);
          }
        // 火の明かり（塵とガスの色に入る）
        blaze.fireLight = new Float32Array(NCELL);
        for (let k = 0; k < 30; k++) blaze.fireLight[(pcz + Math.round((R() - 0.5) * 16)) * MW + pcx + Math.round((R() - 0.5) * 16)] = R();
        // ガス：場合ごとに、無し・まばら・境の値・上限に届く濃い沼
        D.gas.fill(0);
        const gk = s % 4;
        blaze.gasAny = gk !== 0 || s % 8 === 0;
        const EDGES = [0.0399, 0.04, 0.0401, 0.15, 0.1501, 0.35, 0.3501, 1, 1.4];
        for (let cz = pcz - 14; cz <= pcz + 14; cz++)
          for (let cx = pcx - 14; cx <= pcx + 14; cx++) {
            if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) continue;
            const i = cz * MW + cx;
            D.gas[i] =
              gk === 1 ? (R() < 0.2 ? R() * 0.6 : 0) : gk === 2 ? EDGES[(cx + cz * 3) % EDGES.length] : gk === 3 ? 0.4 + R() * 0.6 : 0;
          }
        // 塵：置き直して、一部を遠く（16 の境の前後も）・天井より上（0.05 の境の前後も）・床の下へ
        initDust();
        for (let i = 0; i < DUST_N; i += 7) {
          const w = (i / 7) % 8;
          if (w === 0) dust.x[i] = player.x + 17;
          else if (w === 1) dust.y[i] = 40;
          else if (w === 2) dust.y[i] = 0.02;
          else if (w === 3) dust.y[i] = -3;
          else if (w === 4 || w === 5) {
            dust.x[i] = player.x + (w === 4 ? 16.03 : 15.97);
            dust.z[i] = player.z;
          } else {
            const ci = Math.floor(dust.z[i] / CELL) * MW + Math.floor(dust.x[i] / CELL);
            dust.y[i] = (D.ceil[ci] ?? 5) - (w === 6 ? 0.06 : 0.04);
          }
        }
        // 粒子：動き方 0・1・2、寿命の尽きかけの物も。場合によって数の上限の近く
        buf.pN = s % 6 === 5 ? P_MAX - 3 : 0;
        const np = 20 + Math.floor(R() * 120);
        for (let k = 0; k < np; k++) {
          spawn(
            player.x + (R() - 0.5) * 8,
            R() * 3,
            player.z + (R() - 0.5) * 8,
            R() - 0.5,
            R() - 0.5,
            R() - 0.5,
            0.05 + R() * 3,
            33 + (k % 50),
            0.2 + R(),
            R(),
            R(),
            R(),
            k % 3,
          );
          if (k % 4 === 0 && buf.pN > 0) P.age[buf.pN - 1] = P.life[buf.pN - 1] - R() * 0.06;
        }
        out.push(
          `== case ${s} place=${JSON.stringify(place)} fall=${D.stratum.fall} gas=${gk}/${blaze.gasAny} river=${here.riverCells.length} pN0=${buf.pN}`,
        );
        let t = s % 2 ? 1234.567 : 3.25;
        const DTS = [1 / 30, 0, 0.05, 1 / 30, 0.017, 1 / 30];
        for (let f = 0; f < DTS.length; f++) {
          t += DTS[f];
          F.updateParticles(DTS[f], t);
          record(`f${f} dt=${DTS[f]} t=${t}`);
        }
        // 川のさざ波だけ（たくさん出す）と、ガスを止めた後の粒
        for (let k = 0; k < 4; k++) F.riverFX(0.05);
        record('river');
        blaze.gasAny = false;
        F.updateGasPoints(t + 1);
        record('gasoff');
      });
    }
  } finally {
    Object.assign(here, keep.here);
    Object.assign(blaze, keep.blaze);
    Object.assign(player, keep.player);
    Object.assign(buf, keep.buf);
    Object.assign(gfx, keep.gfx);
    for (const [a, copy] of keep.arrays) a.set(copy);
  }
  return out.join('\n');
}
