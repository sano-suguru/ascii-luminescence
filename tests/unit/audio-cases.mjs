// テストの道具：音を鳴らす関数を、たくさんの場合で呼び、偽の Web Audio の記録と状態の変わり方を、1つの文字列にまとめる。
// F は関数をまとめた物（src/lib/audio.ts の import * など）。audio.test.mjs が、この文字列の指紋を確かめる。
// 場合は、音の大きさ・向き・位置・音が出せる状態か・左右の部品の有無・まわりの様子を、シードの乱数で変える。
// まわりの様子は、迷宮の生成を使わずに、ここで小さな地図（水・溶岩・沼・崖・水晶の塊と、洞窟の部屋）を作る（迷宮の生成を変えても、この指紋は変わらない）。
// 音の乱数（sndRand）は場合ごとにシードで決める。音は見た目の乱数（Math.random）を引かないはずなので、Math.random を呼ぶと、記録に ['Math.random'] が残る。
// 書き換えた状態（SND・player・here・blaze）と、setTimeout・Math.random・音の乱数・window は、終わったら元に戻す。
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { SND, blaze, here, player } from '../../src/lib/state.ts';
import { CELL, LQ_BOG, LQ_DEEP, LQ_LAVA, LQ_WATER, MH, MW, NCELL, TC, TX } from '../../src/lib/world.ts';
import { fakeAudio, fakeAudioClass, logText } from './fake-audio.mjs';

const FIX = ['torch', 'brazier', 'lava', 'abyss', 'fall', 'embers', 'crystal'];
const LIQ = [LQ_WATER, LQ_DEEP, LQ_LAVA, LQ_BOG];

/** 小さな地図：液体・崖・水晶の塊と、部屋（半分くらいが洞窟）。マスの欄は、まわりの音が読む物だけ */
function makeMap(r) {
  const tile = new Uint8Array(NCELL),
    liquid = new Uint8Array(NCELL),
    roomOf = new Int16Array(NCELL).fill(-1),
    rooms = [];
  const blob = (big, put) => {
    const cx = Math.floor(r() * MW),
      cz = Math.floor(r() * MH),
      rad = 1 + r() * big;
    for (let z = Math.max(0, Math.floor(cz - rad)); z <= Math.min(MH - 1, cz + rad); z++)
      for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(MW - 1, cx + rad); x++)
        if (Math.hypot(x - cx, z - cz) <= rad) put(z * MW + x);
  };
  for (let k = 0; k < 24; k++) {
    const ri = rooms.length;
    rooms.push({ cave: r() < 0.5 });
    blob(12, (i) => (roomOf[i] = ri));
  }
  for (let k = 0; k < 20; k++) {
    const lq = LIQ[Math.floor(r() * LIQ.length)];
    blob(5, (i) => (liquid[i] = lq));
  }
  for (let k = 0; k < 10; k++) {
    const t = r() < 0.5 ? TC : TX;
    blob(5, (i) => (tile[i] = t));
  }
  return { tile, liquid, roomOf, rooms };
}

/** seeds：場合のシードの数（1つのシードで、24の場合） */
export function audioCases(F, seeds) {
  const out = [];
  let log = [];
  const hadWindow = 'window' in globalThis,
    saved = {
      setTimeout: globalThis.setTimeout,
      random: Math.random,
      sound: setSoundRand(Math.random),
      window: globalThis.window,
      SND: { ...SND },
      player: { ...player },
      here: { D: here.D, depth: here.depth, fixtures: here.fixtures, monsters: here.monsters },
      fire: blaze.fire,
    };
  globalThis.setTimeout = (fn, ms) => {
    log.push(['setTimeout', ms]);
    fn();
    return 0;
  };
  Math.random = () => {
    log.push(['Math.random']);
    return 0.5;
  };
  const sum = (b) => (b ? b.data.reduce((s, d) => s + d.reduce((a, x) => a + x, 0), 0) : null);
  // 1つの場合：状態を作り（setup）、呼ぶ（call）。状態を作る間と呼ぶ間の乱数は、それぞれシードで決める
  const run = (seed, setup, call) => {
    const r = mulberry32(seed);
    log = [];
    setSoundRand(mulberry32(seed * 3 + 2));
    setup(r);
    setSoundRand(mulberry32(seed * 7 + 1));
    let ret,
      err = null;
    try {
      ret = call();
    } catch (e) {
      err = String(e.message).slice(0, 40);
    }
    out.push(
      logText({
        ret: typeof ret === 'object' && ret ? ret.id : ret,
        err,
        log,
        env: SND.env,
        envT: SND.envT,
        noise: sum(SND.noise),
        L: Object.keys(SND.L),
        ctx: !!SND.ctx,
      }),
    );
  };
  // 音の部品を作る偽の window（鳴らせるのは約85%。左右の部品が無いのは約15%）
  const audioWindow = (r) => ({ AudioContext: fakeAudioClass(log, r() < 0.85 ? 'running' : 'suspended', r() >= 0.15) });
  const base = (r, withCtx = true) => {
    player.x = 4 + r() * (MW * CELL - 8);
    player.z = 4 + r() * (MH * CELL - 8);
    player.yaw = (r() - 0.5) * 7;
    SND.lv = Math.floor(r() * 4);
    SND.on = r() < 0.85;
    SND.envT = r() * 0.5 - 0.2;
    SND.env = { water: 0, lava: 0, chasm: 0, bog: 0, xtal: 0, burn: 0, fire: 0, fx: 0, fz: 0, cave: false };
    SND.ctx = SND.master = SND.inp = SND.wet = SND.noise = null;
    SND.L = {};
    if (withCtx) {
      globalThis.window = audioWindow(r);
      F.sndInit();
    }
  };
  const xz = (r) => (r() < 0.25 ? [undefined, undefined] : [player.x + (r() - 0.5) * 50, player.z + (r() - 0.5) * 50]);
  const one = [
    ['sndReady', () => []],
    ['sDist', xz],
    ['sPan', xz],
    ['sOut', (r) => [...xz(r), r()]],
    ['sNoise', (r) => [r() * 9, r() * 2, 'lowpass', 100 + r() * 3000, r() * 2, { id: 'out' }, r() < 0.5 ? 50 + r() * 900 : undefined]],
    ['sTone', (r) => [r() * 9, 'sine', 100 + r() * 900, r() < 0.5 ? 0 : 50 + r() * 900, r() * 2, { id: 'out' }]],
    ['sDrip', (r) => [...xz(r), r()]],
    ['sCrackle', (r) => [...xz(r), r()]],
    ['sCrackleBurst', xz],
    ['sBubble', (r) => [...xz(r), r(), r() < 0.5]],
    ['sChime', (r) => [...xz(r), r()]],
    ['sBoom', (r) => [r()]],
    ['sWhoosh', () => []],
    ['sRumble', (r) => [r(), r() * 3]],
    ['sCreak', xz],
    ['sSplash', (r) => [r()]],
    ['sHiss', (r) => [...xz(r), r() * 2]],
    ['sAlert', xz],
    ['sRoar', () => []],
    ['sSqueak', xz],
    ['sHowl', xz],
    ['sAlarm', xz],
  ];
  try {
    for (let s = 1; s <= seeds; s++) {
      // 音の部品を作る（はじめて・止まっていたのを動かす・AudioContext が無い・webkitAudioContext だけ）
      run(
        s,
        (r) => {
          base(r, false);
          const k = r();
          globalThis.window = k < 0.1 ? {} : k < 0.2 ? { webkitAudioContext: fakeAudioClass(log) } : { AudioContext: fakeAudioClass(log) };
          if (r() < 0.2) SND.ctx = fakeAudio(log, 'suspended');
        },
        () => F.sndInit(),
      );
      for (const [nm, args] of one) {
        let a = [];
        run(
          s * 31 + nm.length,
          (r) => {
            base(r);
            a = args(r);
          },
          () => F[nm](...a),
        );
      }
      // まわりの音（液体・崖・水晶の近くに立つことが多い。火・備品・飛ぶ生き物はでたらめに置く）
      run(
        s * 977,
        (r) => {
          base(r);
          if (r() < 0.05) SND.ctx = null;
          const D = makeMap(r);
          here.D = D;
          here.depth = 1 + Math.floor(r() * 13);
          const cells = [];
          for (let i = 0; i < NCELL; i++) if (D.liquid[i] || D.tile[i] === TC || D.tile[i] === TX) cells.push(i);
          if (cells.length && r() < 0.8) {
            const c = cells[Math.floor(r() * cells.length)];
            player.x = ((c % MW) + 0.5) * CELL + (r() - 0.5) * 8;
            player.z = (Math.floor(c / MW) + 0.5) * CELL + (r() - 0.5) * 8;
          }
          blaze.fire = new Float32Array(NCELL);
          for (let k = 0; k < 40; k++) blaze.fire[Math.floor(r() * NCELL)] = r() < 0.5 ? r() * 2 : 0;
          here.fixtures = Array.from({ length: Math.floor(r() * 12) }, () => ({
            type: FIX[Math.floor(r() * FIX.length)],
            x: player.x + (r() - 0.5) * 30,
            z: player.z + (r() - 0.5) * 30,
          }));
          here.monsters = Array.from({ length: Math.floor(r() * 6) }, () => ({
            x: player.x + (r() - 0.5) * 24,
            z: player.z + (r() - 0.5) * 24,
            ty: { flier: r() < 0.5 },
          }));
        },
        () => {
          for (let k = 0; k < 6; k++) F.sndUpdate(0.02 + ((k * 0.11) % 0.4));
        },
      );
    }
  } finally {
    globalThis.setTimeout = saved.setTimeout;
    Math.random = saved.random;
    setSoundRand(saved.sound);
    if (hadWindow) globalThis.window = saved.window;
    else delete globalThis.window;
    Object.assign(SND, saved.SND);
    Object.assign(player, saved.player);
    Object.assign(here, saved.here);
    blaze.fire = saved.fire;
  }
  return out.join('\n');
}
