// 音を鳴らす（Web Audio。もとは src/game/15-sound-fire.js）。状態の入れ物 SND（音）・player（聞く位置と向き）・here・blaze（まわりの様子）に頼る物。
// 音の表と小さな道具（SND_LV・sEnv など）は src/lib/sound.ts。
import { must, nth } from './array.ts';
import { sndRand } from './random.ts';
import { clamp } from './rng.ts';
import { SND_LV, sEnv } from './sound.ts';
import { type DroneLoop, type SoundLoop, SND, blaze, here, player } from './state.ts';
import { CELL, FIRE_TYPES, LQ_BOG, LQ_DEEP, LQ_LAVA, LQ_WATER, MH, MW, TC, TX } from './world.ts';

/** 音を鳴らせるか（音の部品があって動いていて、音量がオフでない） */
export const sndReady = (): boolean | null => SND.ctx && SND.ctx.state === 'running' && SND.on;
/** 音の部品 */
const actx = (): AudioContext => must(SND.ctx, '音の部品 SND.ctx');

/**
 * 音の部品を作る（はじめてのクリックで呼ぶ）。作れなければ音は鳴らない（作りかけの部品は閉じる）。
 * 2回目からは、止まっていたのを動かすだけ（動かせなくても、部品はそのまま使う）
 */
export function sndInit(): void {
  if (SND.ctx) {
    try {
      SND.ctx.resume().catch(() => {});
    } catch {
      // 動かす関数が無い古いブラウザでは、そのまま使う
    }
    return;
  }
  try {
    const w: { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext } = window;
    const AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    SND.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    SND.master = master;
    master.gain.setTargetAtTime(nth(SND_LV, SND.lv), ctx.currentTime, 1.5);
    const comp = ctx.createDynamicsCompressor();
    comp.connect(master);
    const dry = ctx.createGain();
    dry.connect(comp);
    // 響き（3.4秒の、だんだん消える雑音）
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 3.4), ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = (sndRand() * 2 - 1) * Math.pow(1 - i / d.length, 2.4);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    conv.connect(wet);
    wet.connect(comp);
    SND.wet = wet;
    const inp = ctx.createGain();
    inp.connect(dry);
    inp.connect(conv);
    SND.inp = inp;
    // 雑音（2秒）
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
      nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = sndRand() * 2 - 1;
    SND.noise = nb;
    const loop = (type: BiquadFilterType, freq: number, q: number): SoundLoop => {
      const s0 = ctx.createBufferSource();
      s0.buffer = nb;
      s0.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      s0.connect(f);
      f.connect(g);
      g.connect(inp);
      s0.start();
      return { g, f };
    };
    SND.L.rumble = loop('lowpass', 90, 0.7);
    SND.L.water = loop('bandpass', 700, 0.6);
    SND.L.fire = loop('bandpass', 1100, 0.5);
    SND.L.wind = loop('bandpass', 320, 0.4);
    const drone = ctx.createGain();
    drone.gain.value = 0;
    drone.connect(inp);
    const os = (
      [
        [55, 'sine', 1],
        [82.6, 'sine', 0.7],
        [110.3, 'triangle', 0.2],
      ] as const
    ).map(([f, ty, v]) => {
      const o = ctx.createOscillator();
      o.type = ty;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = v;
      o.connect(g);
      g.connect(drone);
      o.start();
      return o;
    });
    SND.L.drone = { g: drone, o: os };
  } catch {
    // 作りかけの部品は閉じて、全部空に戻す（次のクリックで、はじめから作り直す）
    const ctx = SND.ctx;
    SND.ctx = SND.master = SND.inp = SND.wet = SND.noise = null;
    SND.L = {};
    if (ctx)
      try {
        ctx.close().catch(() => {});
      } catch {
        // 閉じる関数が無い古いブラウザでは、閉じずに手放す
      }
  }
}
/** 音の大きさ（聞く位置から 24 離れると 0。位置が無い音は 1） */
export const sDist = (x?: number, z?: number): number =>
  x === undefined ? 1 : Math.pow(clamp(1 - Math.hypot(x - player.x, (z ?? NaN) - player.z) / 24, 0, 1), 1.4);
/** 音の左右（向きから見た左右。位置が無い音は、でたらめに少し左右へ） */
export const sPan = (x?: number, z?: number): number => {
  if (x === undefined) return (sndRand() - 0.5) * 1.2;
  const dx = x - player.x,
    dz = (z ?? NaN) - player.z,
    l = Math.hypot(dx, dz) || 1;
  return clamp((dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / l, -1, 1) * 0.85;
};
/** 位置 x・z の音の出口（大きさと左右を付けて、響きへつなぐ） */
export function sOut(x: number | undefined, z: number | undefined, vol: number): GainNode {
  const ctx = actx(),
    g = ctx.createGain();
  g.gain.value = vol * sDist(x, z);
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = sPan(x, z);
    g.connect(p);
    p.connect(must(SND.inp, '音の入口 SND.inp'));
  } else g.connect(must(SND.inp, '音の入口 SND.inp'));
  return g;
}
/** 雑音を濾した音（時刻 t から dur 秒。f2 があれば、高さを f2 へ動かす）。大きさを付ける部品を返す */
export function sNoise(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, out: AudioNode, f2?: number): GainNode {
  const ctx = actx(),
    s0 = ctx.createBufferSource();
  s0.buffer = SND.noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  f.Q.value = q;
  const e = ctx.createGain();
  s0.connect(f);
  f.connect(e);
  e.connect(out);
  s0.start(t, sndRand() * 1.5);
  s0.stop(t + dur + 0.05);
  return e;
}
/** 音の波（時刻 t から dur 秒。f2 があれば、高さを f1 から f2 へ動かす）。大きさを付ける部品を返す */
export function sTone(t: number, type: OscillatorType, f1: number, f2: number, dur: number, out: AudioNode): GainNode {
  const ctx = actx(),
    o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const e = ctx.createGain();
  o.connect(e);
  e.connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
  return e;
}

// ---------------------------------------------------------------- 効果音（x・z が無い音は、聞く位置で鳴る）
/** しずく */
export function sDrip(x: number | undefined, z: number | undefined, vol: number): void {
  if (!sndReady()) return;
  const t = actx().currentTime,
    f = 900 + sndRand() * 1500;
  sEnv(sTone(t, 'sine', f, f * 0.55, 0.12, sOut(x, z, vol)), t, 0.004, 0.2);
}
/** 火のはぜる音 */
export function sCrackle(x: number | undefined, z: number | undefined, vol: number): void {
  if (!sndReady()) return;
  const t = actx().currentTime,
    d = 0.004 + sndRand() * 0.014;
  sEnv(sNoise(t, d, 'highpass', 1800 + sndRand() * 2500, 0.8, sOut(x, z, vol)), t, 0.001, d);
}
/** 続けてはぜる音（35ミリ秒ごとに8回） */
export function sCrackleBurst(x: number | undefined, z: number | undefined): void {
  for (let k = 0; k < 8; k++) setTimeout(() => sCrackle(x, z, 0.5), k * 35);
}
/** 泡（low は溶岩の低い泡） */
export function sBubble(x: number | undefined, z: number | undefined, vol: number, low?: boolean): void {
  if (!sndReady()) return;
  const t = actx().currentTime;
  sEnv(sTone(t, 'sine', low ? 70 : 220, low ? 190 : 650, 0.11, sOut(x, z, vol)), t, 0.01, 0.12);
}
/** 澄んだ鈴の音（水晶など） */
export function sChime(x: number | undefined, z: number | undefined, vol: number): void {
  if (!sndReady()) return;
  const t = actx().currentTime,
    f = nth([1046.5, 1174.7, 1318.5, 1568, 1760, 2093], Math.floor(sndRand() * 6)),
    o = sOut(x, z, vol);
  sEnv(sTone(t, 'sine', f, 0, 2.2, o), t, 0.005, 2.0, 0.6);
  sEnv(sTone(t, 'sine', f * 2.76, 0, 1.2, o), t, 0.003, 1.0, 0.15);
}
/** 爆発 */
export function sBoom(vol: number): void {
  if (!sndReady()) return;
  const t = actx().currentTime,
    o = sOut(undefined, undefined, vol);
  sEnv(sNoise(t, 1.3, 'lowpass', 900, 0.7, o, 70), t, 0.01, 1.2);
  sEnv(sTone(t, 'sine', 62, 32, 0.9, o), t, 0.01, 0.85, 0.9);
}
/** 風を切る音 */
export function sWhoosh(): void {
  if (!sndReady()) return;
  const t = actx().currentTime;
  sEnv(sNoise(t, 0.35, 'bandpass', 400, 1.2, sOut(undefined, undefined, 0.3), 2600), t, 0.05, 0.3);
}
/** 地鳴り（dur 秒） */
export function sRumble(vol: number, dur: number): void {
  if (!sndReady()) return;
  const t = actx().currentTime;
  sEnv(sNoise(t, dur, 'lowpass', 140, 0.8, sOut(undefined, undefined, vol)), t, 0.3, dur);
}
/** きしむ音（扉など） */
export function sCreak(x: number | undefined, z: number | undefined): void {
  if (!sndReady()) return;
  const ctx = actx(),
    t = ctx.currentTime,
    o = sOut(x, z, 0.18),
    f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 700;
  f.Q.value = 5;
  f.connect(o);
  sEnv(sTone(t, 'sawtooth', 150, 92, 0.45, f), t, 0.04, 0.4);
}
/** 水しぶき */
export function sSplash(vol: number): void {
  if (!sndReady()) return;
  const t = actx().currentTime;
  sEnv(sNoise(t, 0.22, 'bandpass', 1300, 0.9, sOut(undefined, undefined, vol), 600), t, 0.005, 0.2);
}
/** しゅうっという音（dur 秒） */
export function sHiss(x: number | undefined, z: number | undefined, dur: number): void {
  if (!sndReady()) return;
  const t = actx().currentTime;
  sEnv(sNoise(t, dur, 'highpass', 3200, 0.5, sOut(x, z, 0.22)), t, 0.15, dur);
}
/** 気づいた時の音（2つの上がる音） */
export function sAlert(x: number | undefined, z: number | undefined): void {
  if (!sndReady()) return;
  const t = actx().currentTime,
    o = sOut(x, z, 0.22);
  sEnv(sTone(t, 'triangle', 520, 780, 0.12, o), t, 0.01, 0.14);
  sEnv(sTone(t + 0.13, 'triangle', 780, 1040, 0.12, o), t + 0.13, 0.01, 0.18);
}
/** うなり声（大きな生き物） */
export function sRoar(): void {
  if (!sndReady()) return;
  const ctx = actx(),
    t = ctx.currentTime,
    o = sOut(undefined, undefined, 0.5),
    f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  f.connect(o);
  sEnv(sTone(t, 'sawtooth', 70, 42, 2.2, f), t, 0.15, 2.0);
  sEnv(sTone(t, 'sawtooth', 104, 61, 2.0, f), t, 0.2, 1.8, 0.6);
  sEnv(sNoise(t, 2.2, 'lowpass', 260, 0.7, o, 90), t, 0.2, 2.0, 0.5);
}
/** 小さな鳴き声（飛ぶ生き物） */
export function sSqueak(x: number | undefined, z: number | undefined): void {
  if (!sndReady()) return;
  const t = actx().currentTime,
    o = sOut(x, z, 0.07);
  sEnv(sTone(t, 'sine', 5200, 3600, 0.06, o), t, 0.003, 0.06);
  sEnv(sTone(t + 0.09, 'sine', 5000, 3500, 0.05, o), t + 0.09, 0.003, 0.05);
}

/**
 * まわりの音（毎フレーム）。0.25秒ごとに、まわり13×13マスの水・溶岩・崖・沼・水晶・燃えている所と、近くの火と滝を数え直し、
 * 鳴り続ける音の大きさを変える。しずく・はぜる音・泡・鈴・飛ぶ生き物の声を、ときどき鳴らす
 */
export function sndUpdate(dt: number): void {
  if (!SND.ctx || !SND.on) return;
  const E = SND.env;
  SND.envT -= dt;
  if (SND.envT <= 0) {
    SND.envT = 0.25;
    const D = must(here.D, '今の階 here.D');
    const pcx = Math.floor(player.x / CELL),
      pcz = Math.floor(player.z / CELL);
    let water = 0,
      lava = 0,
      chasm = 0,
      bog = 0,
      xtal = 0,
      burn = 0,
      n = 0;
    for (let dz = -6; dz <= 6; dz++)
      for (let dx = -6; dx <= 6; dx++) {
        const x = pcx + dx,
          z = pcz + dz;
        if (x < 0 || z < 0 || x >= MW || z >= MH) continue;
        const i = z * MW + x,
          w = Math.max(0, 1 - Math.hypot(dx, dz) / 7);
        n += w;
        const lq = D.liquid[i],
          tt = D.tile[i],
          fi = blaze.fire[i] ?? 0;
        if (lq === LQ_WATER || lq === LQ_DEEP) water += w;
        else if (lq === LQ_LAVA) lava += w;
        else if (lq === LQ_BOG) bog += w;
        if (tt === TC) chasm += w;
        if (tt === TX) xtal += w;
        if (fi > 0) burn += w * fi;
      }
    let fb = 0,
      fx = 0,
      fz = 0;
    for (const f of here.fixtures) {
      if (!FIRE_TYPES.has(f.type) || f.type === 'lava' || f.type === 'abyss') continue;
      const d = Math.hypot(f.x - player.x, f.z - player.z),
        v = Math.max(0, 1 - d / 7);
      if (v > fb) {
        fb = v;
        fx = f.x;
        fz = f.z;
      }
    }
    const ri = D.roomOf[pcz * MW + pcx] ?? NaN;
    let fallN = 0;
    for (const f of here.fixtures) {
      if (f.type === 'fall') fallN = Math.max(fallN, 1 - Math.hypot(f.x - player.x, f.z - player.z) / 16);
    }
    Object.assign(E, {
      fall: fallN,
      water: Math.min(1, water / 12),
      lava: Math.min(1, lava / 8),
      chasm: Math.min(1, chasm / 10),
      bog: Math.min(1, bog / 10),
      xtal: Math.min(1, xtal / 8),
      burn: Math.min(1, burn / 6),
      fire: fb,
      fx,
      fz,
      cave: ri >= 0 && nth(D.rooms, ri).cave,
    });
    const now = SND.ctx.currentTime,
      set = (lp: SoundLoop | DroneLoop | undefined, v: number): void => {
        must(lp, '鳴り続ける音 SND.L').g.gain.setTargetAtTime(v, now, 0.6);
      },
      drone = must(SND.L.drone, '低い音 SND.L.drone');
    set(SND.L.rumble, 0.05 + E.chasm * 0.45 + E.lava * 0.3 + (E.cave ? 0.04 : 0));
    set(SND.L.water, E.water * 0.05 + (E.fall ?? 0) * 0.22);
    set(SND.L.fire, Math.min(0.3, E.burn * 0.25 + E.fire * 0.03));
    set(SND.L.wind, E.cave ? 0.025 : 0.008);
    set(drone, 0.03);
    must(drone.o[0], '低い音の波').frequency.setTargetAtTime(55 * Math.pow(0.97, here.depth - 1), now, 2);
    must(drone.o[1], '低い音の波').frequency.setTargetAtTime(82.6 * Math.pow(0.97, here.depth - 1), now, 2);
    must(SND.wet, '響き SND.wet').gain.setTargetAtTime(E.cave ? 0.6 : 0.32, now, 1);
  }
  const roll = (r: number): boolean => sndRand() < r * dt;
  if (roll(0.25 + E.water * 2.4 + (E.cave ? 0.4 : 0))) {
    const a = sndRand() * 6.28,
      r = 2 + sndRand() * 9;
    sDrip(player.x + Math.cos(a) * r, player.z + Math.sin(a) * r, 0.2 + sndRand() * 0.15);
  }
  if (roll(E.fire * 14 + E.burn * 30))
    sCrackle(E.burn > E.fire ? undefined : E.fx, E.burn > E.fire ? undefined : E.fz, 0.25 + sndRand() * 0.25);
  if (roll(E.bog * 2.5)) sBubble(undefined, undefined, 0.2, false);
  if (roll(E.lava * 2)) sBubble(undefined, undefined, 0.3, true);
  if (roll(E.xtal * 0.8)) sChime(undefined, undefined, 0.12);
  for (const m of here.monsters) {
    if (m.ty.flier && Math.hypot(m.x - player.x, m.z - player.z) < 10 && roll(0.35)) sSqueak(m.x, m.z);
  }
}
/** 遠吠え（野営の群れ・猟犬が気づいた時） */
export function sHowl(x: number | undefined, z: number | undefined): void {
  if (!sndReady()) return;
  const ctx = actx(),
    t = ctx.currentTime,
    o = sOut(x, z, 0.45),
    os = ctx.createOscillator(),
    g = ctx.createGain(),
    lfo = ctx.createOscillator(),
    lg = ctx.createGain();
  os.type = 'sawtooth';
  os.frequency.setValueAtTime(320, t);
  os.frequency.linearRampToValueAtTime(720, t + 0.5);
  os.frequency.linearRampToValueAtTime(380, t + 1.6);
  lfo.frequency.value = 6;
  lg.gain.value = 18;
  lfo.connect(lg);
  lg.connect(os.frequency);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1400;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.09, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
  os.connect(f);
  f.connect(g);
  g.connect(o);
  os.start(t);
  lfo.start(t);
  os.stop(t + 1.85);
  lfo.stop(t + 1.85);
}
/** 叫び声（叫ぶ生き物が灯りに気づいた時。高い矩形波を2つ重ね、上げてから下げる） */
export function sShriek(x: number | undefined, z: number | undefined): void {
  if (!sndReady()) return;
  const ctx = actx(),
    t = ctx.currentTime,
    o = sOut(x, z, 0.5);
  for (let k = 0; k < 2; k++) {
    const os = ctx.createOscillator(),
      g = ctx.createGain();
    os.type = 'square';
    os.frequency.setValueAtTime(1300 + k * 230, t);
    os.frequency.linearRampToValueAtTime(2100 + k * 300, t + 0.25);
    os.frequency.linearRampToValueAtTime(1000, t + 0.9);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    os.connect(g);
    g.connect(o);
    os.start(t);
    os.stop(t + 1.05);
  }
}
/** 警報（監視の機械が気づいた時。高い音と低い音を3回ずつ交互に） */
export function sAlarm(x: number | undefined, z: number | undefined): void {
  if (!sndReady()) return;
  const ctx = actx(),
    t = ctx.currentTime,
    o = sOut(x, z, 0.4);
  for (let k = 0; k < 6; k++) {
    const os = ctx.createOscillator(),
      g = ctx.createGain();
    os.type = 'square';
    os.frequency.value = k % 2 ? 660 : 880;
    g.gain.setValueAtTime(0, t + k * 0.22);
    g.gain.linearRampToValueAtTime(0.06, t + k * 0.22 + 0.02);
    g.gain.linearRampToValueAtTime(0, t + k * 0.22 + 0.2);
    os.connect(g);
    g.connect(o);
    os.start(t + k * 0.22);
    os.stop(t + k * 0.22 + 0.21);
  }
}
/** 術を放つ音（性質ごと：火はこもった音とぱちぱち、氷は高い澄んだ音、雷は鋭い音と低いうなり、毒は泡、ほかは風切り。もとは src/game/22-world-hints.js） */
export function castSound(sp: { elem: string | null }, x: number, z: number): void {
  if (!sndReady()) return;
  const t = must(SND.ctx).currentTime,
    o = sOut(x, z, 0.32),
    el = sp.elem;
  if (el === 'fire') {
    sEnv(sNoise(t, 0.5, 'lowpass', 1400, 0.7, o, 300), t, 0.01, 0.45);
    sCrackleBurst(player.x, player.z);
  } else if (el === 'ice') {
    sEnv(sTone(t, 'sine', 1760, 2640, 0.35, o), t, 0.005, 0.3);
    sEnv(sTone(t, 'sine', 2349, 3520, 0.25, o), t, 0.01, 0.25, 0.5);
  } else if (el === 'thunder') {
    sEnv(sNoise(t, 0.3, 'highpass', 3000, 0.7, o), t, 0.002, 0.28);
    sEnv(sTone(t, 'square', 90, 40, 0.25, o), t, 0.003, 0.22, 0.4);
  } else if (el === 'poison') {
    for (let k = 0; k < 4; k++) setTimeout(() => sBubble(player.x, player.z, 0.4, k % 2 === 0), k * 60);
  } else sWhoosh();
}
