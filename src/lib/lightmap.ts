// マスの明るさ（もとは src/game/14-lights-fixtures.js）と天井の高さ（もとは 06-world.js）、灯りの揺らぎ flicker と、灯りを描画に渡す配列を書き直す updateLights（もとは 14-lights-fixtures.js）。
// 状態の入れ物 here（今の階の灯りと天井・生き物）・blaze（火の明かり）・player・ui（1人称か3人称か）・gfx（カメラの位置。読むだけ）・gear（詠唱）・vfx（稲妻の光り）・
// lantern（手元の灯り）と、灯りを描画に渡す配列 SL・DLP・DLC に頼る物。灯りの計算そのもの（迷宮の生成も使う）は src/lib/light.ts。
// updateLights を呼ぶのは古い JS の描画（30-loop-init.js の tick）。flicker はランプの時に見た目の乱数 mr() を引く。
import { must, nth } from './array.ts';
import { bodyN } from './gear.ts';
import type { LevelLight } from './generate.ts';
import { LANTERN } from './light.ts';
import { mr } from './random.ts';
import { elemCol } from './runes.ts';
import { DLC, DLP, type Monster, SL, blaze, clock, gear, gfx, here, lantern, player, ui, vfx } from './state.ts';
import { BASE_H, CELL, MH, MW, NDL } from './world.ts';

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

// ---------------------------------------------------------------- lights
/** 灯りの揺らぎ（もとは src/game/14-lights-fixtures.js）：灯りの種類ごとの、時刻 t の明るさの倍率。ランプはときどき暗くなる（見た目の乱数を引く） */
export function flicker(L: LevelLight, t: number): number {
  const p = L.ph;
  switch (L.type) {
    case 'brazier':
      return 0.8 + 0.09 * Math.sin(t * 8.3 + p) + 0.07 * Math.sin(t * 19.7 + p * 1.7) + 0.05 * Math.sin(t * 41.3 + p * 3.1);
    case 'crystal':
      return 0.8 + 0.2 * Math.sin(t * 0.8 + p);
    case 'rune':
      return 0.75 + 0.25 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.6 + p), 2);
    case 'fungus':
      return 0.8 + 0.2 * Math.sin(t * 0.5 + p);
    case 'abyss':
      return 0.78 + 0.14 * Math.sin(t * 0.6 + p) + 0.08 * Math.sin(t * 2.7 + p * 2);
    case 'lamp': {
      let f = 0.9 + 0.08 * Math.sin(t * 3.1 + p);
      if (Math.sin(t * 0.37 + p * 5) * Math.sin(t * 1.9 + p) > 0.9) f *= 0.3 + 0.5 * mr();
      return f;
    }
    case 'upstairs':
      return 0.9 + 0.1 * Math.sin(t * 1.3 + p);
    case 'tele':
      return 0.75 + 0.25 * Math.sin(t * 2.2 + p);
    case 'portal':
      return 0.85 + 0.15 * Math.sin(t * 2.3 + p);
    case 'bstairs':
    case 'stairs':
      return 0.88 + 0.12 * Math.sin(t * 1.4 + p);
    case 'fall':
      return 0.9 + 0.1 * Math.sin(t * 2.1 + p);
    case 'veinlight':
      return 0.8 + 0.2 * Math.sin(t * 1.7 + p);
    case 'crater':
      return L.active ? 0.9 + 0.1 * Math.sin(t * 3 + p) : 0.25 + 0.08 * Math.sin(t * 2 + p);
    case 'spring':
      return L.active ? 0.9 : 0.3;
    case 'firefly':
      return 0.8 + 0.2 * Math.sin(t * 1.1 + p);
    case 'marsh':
      return 0.75 + 0.25 * Math.sin(t * 1.7 + p);
    case 'sun':
    case 'well':
      return 0.95 + 0.05 * Math.sin(t * 0.3 + p);
    case 'orb':
      return 0.9 + 0.1 * Math.sin(t * 0.7 + p);
    case 'bloodwort':
      return (L.fade === undefined ? 1 : L.fade) * (0.85 + 0.15 * Math.sin(t * 2.2 + p));
    case 'vent':
      return 0.04 + (L.boost || 0);
    case 'pitglow':
      return must(here.D, '今の階 here.D').collapsed ? 0.85 + 0.15 * Math.sin(t * 1.3 + p) : 0;
    case 'xlight':
      return 0.85 + 0.15 * Math.sin(t * 0.6 + p);
    case 'torch':
      return 0.8 + 0.08 * Math.sin(t * 9.1 + p) + 0.07 * Math.sin(t * 21.3 + p * 1.7) + 0.05 * Math.sin(t * 37.9 + p * 2.9);
    case 'lava':
      return 0.85 + 0.1 * Math.sin(t * 0.7 + p) + 0.05 * Math.sin(t * 2.3 + p);
    case 'embers':
      return 0.7 + 0.15 * Math.sin(t * 7.3 + p) + 0.1 * Math.sin(t * 17.1 + p * 2);
    case 'relic':
      return 0.85 + 0.15 * Math.sin(t * 1.1 + p);
    case 'pages':
      return 0.8 + 0.2 * Math.sin(t * 0.7 + p);
    case 'mist':
      return 0.75 + 0.25 * Math.sin(t * 0.4 + p);
  }
  return 1;
}
/**
 * 灯りを描画に渡す配列（SL・DLP・DLC）を書き直す（もとは src/game/14-lights-fixtures.js）：階の灯りの明るさ（揺らぎ・影の獣・眠る竜・不死の王の冷たい光）、
 * 手元の灯り（詠唱の間は性質の色に寄る）、稲妻の光り、灯りを持つ生き物（近い順）
 */
export function updateLights(t: number): void {
  SL.fill(0);
  let shadowK = 1;
  for (const m of here.monsters)
    if (m.ty.beast && must(m.ty.spec, '獣の体の作り spec').shadow && !m.sleep) {
      const d = Math.hypot(m.x - player.x, m.z - player.z);
      if (d < 16) shadowK = Math.min(shadowK, 0.45 + (0.55 * d) / 16);
    }
  const drag = here.monsters.filter((m) => m.ty.dragon && m.sleep),
    lich = here.monsters.filter((m) => m.ty.lich);
  must(here.D, '今の階 here.D').lights.forEach((L, i) => {
    let f = flicker(L, t) * shadowK;
    let c0 = nth(L.col, 0),
      c1 = nth(L.col, 1),
      c2 = nth(L.col, 2);
    for (const m of drag) {
      const d = Math.hypot(L.x - m.x, L.z - m.z);
      if (d < 11) f *= 1 - 0.35 * (1 - d / 11) * (0.5 + 0.5 * Math.sin(t * 0.8 + (m.ph ?? NaN)));
    }
    for (const m of lich) {
      const d = Math.hypot(L.x - m.x, L.z - m.z);
      if (d < 12) {
        const k2 = (1 - d / 12) * 0.8;
        c0 = c0 * (1 - k2) + 0.55 * k2;
        c1 = c1 * (1 - k2) + 0.8 * k2;
        c2 = c2 * (1 - k2) + 1.0 * k2;
      }
    }
    L.f = f;
    const k = L.int * f;
    SL[i * 3] = c0 * k;
    SL[i * 3 + 1] = c1 * k;
    SL[i * 3 + 2] = c2 * k;
  });
  DLP.fill(0);
  DLC.fill(0);
  const lf = 0.96 + 0.03 * Math.sin(t * 7.1) + 0.02 * Math.sin(t * 13.3);
  if (ui.camMode === 'tps') {
    DLP[0] = player.x;
    DLP[1] = player.eye + 0.15;
    DLP[2] = player.z;
  } else {
    DLP[0] = gfx.camera.position.x - Math.sin(player.yaw) * 0.25;
    DLP[1] = gfx.camera.position.y - 0.2;
    DLP[2] = gfx.camera.position.z - Math.cos(player.yaw) * 0.25;
  }
  DLP[3] = lantern.r * (1 + 0.35 * bodyN('lamp'));
  DLC[0] = nth(LANTERN, 0) * lf * lantern.k;
  DLC[1] = nth(LANTERN, 1) * lf * lantern.k;
  DLC[2] = nth(LANTERN, 2) * lf * lantern.k;
  if (gear.castSt && gear.hands) {
    const kk =
        Math.min(1, gear.castSt.t / Math.max(0.01, gear.castSt.need)) * (gear.castSt.full ? 1 + 0.15 * Math.sin(clock.time * 14) : 1),
      cc = elemCol(gear.hands[gear.castSt.h].elem ? must(gear.hands[gear.castSt.h].elem, '性質のルーン').type : null);
    for (let q = 0; q < 3; q++) DLC[q] = nth(DLC, q) * (1 - 0.55 * kk) + nth(must(cc, '性質の色'), q) * 2.6 * kk;
  }
  const list = here.monsters
    .filter((m) => m.ty.light > 0 && !m.ty.invisible && (m.ty.form !== 'eel' || (m.surf ?? NaN) > 0))
    .map((m): [number, Monster] => [(m.x - player.x) ** 2 + (m.z - player.z) ** 2, m])
    .sort((a, b) => a[0] - b[0]);
  const flOn = vfx.zapFlash && vfx.zapFlash.t > 0;
  if (flOn) {
    const s5 = NDL - 1,
      k5 = must(vfx.zapFlash, '稲妻の光り').t > 900 ? 1 : Math.min(1, must(vfx.zapFlash, '稲妻の光り').t / 0.16);
    DLP[s5 * 4] = must(vfx.zapFlash, '稲妻の光り').x;
    DLP[s5 * 4 + 1] = must(vfx.zapFlash, '稲妻の光り').y;
    DLP[s5 * 4 + 2] = must(vfx.zapFlash, '稲妻の光り').z;
    DLP[s5 * 4 + 3] = must(vfx.zapFlash, '稲妻の光り').r || 6;
    DLC[s5 * 3] = nth(must(vfx.zapFlash, '稲妻の光り').col, 0) * 3 * k5;
    DLC[s5 * 3 + 1] = nth(must(vfx.zapFlash, '稲妻の光り').col, 1) * 3 * k5;
    DLC[s5 * 3 + 2] = nth(must(vfx.zapFlash, '稲妻の光り').col, 2) * 3 * k5;
  }
  for (let k = 0; k < NDL - (flOn ? 2 : 1) && k < list.length; k++) {
    const m = nth(list, k)[1],
      s = k + 1,
      ty = m.ty;
    DLP[s * 4] = m.x;
    DLP[s * 4 + 1] = must(m.y, '足もとの高さ y') + (ty.fl ? 0 : 0.9);
    DLP[s * 4 + 2] = m.z;
    DLP[s * 4 + 3] = ty.light * (1 + (m.alert ?? NaN) * 0.3);
    const pulse = (0.85 + 0.15 * Math.sin(t * 2.3 + (m.ph ?? NaN))) * 0.8 * (m.glow ?? NaN);
    const lc = ty.lcol || ty.col;
    DLC[s * 3] = lc[0] * pulse;
    DLC[s * 3 + 1] = lc[1] * pulse;
    DLC[s * 3 + 2] = lc[2] * pulse;
  }
}
