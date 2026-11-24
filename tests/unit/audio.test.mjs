// 音を鳴らす処理（src/lib/audio.ts）の単体テスト。Node には Web Audio が無いので、偽の Web Audio（fake-audio.mjs）で確かめる。
// 指紋の値は、移す前の古い JS（src/game/15-sound-fire.js）でも同じになる（audio-cases.mjs の場合を、古い関数で数えて確かめた）。
// テストを .mjs で書くのは、偽の Web Audio を AudioContext の型に合わせられないため（型の言い切り as を使わない）
import { beforeAll, describe, expect, it } from 'vitest';
import * as A from '../../src/lib/audio.ts';
import { SND, player } from '../../src/lib/state.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { audioCases } from './audio-cases.mjs';
import { fakeAudio, fakeAudioClass } from './fake-audio.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const fresh = () => {
  SND.ctx = SND.master = SND.inp = SND.wet = SND.noise = null;
  SND.L = {};
  SND.lv = 1;
  SND.on = true;
};

describe('音の土台', () => {
  it('鳴らせるのは、音の部品が動いていて、音量がオフでない時だけ', () => {
    fresh();
    expect(A.sndReady()).toBe(null);
    SND.ctx = fakeAudio([], 'suspended');
    expect(A.sndReady()).toBe(false);
    SND.ctx = fakeAudio([], 'running');
    SND.on = false;
    expect(A.sndReady()).toBe(false);
    SND.on = true;
    expect(A.sndReady()).toBe(true);
  });
  it('はじめて呼ぶと音の部品と鳴り続ける音を作り、2回目は動かすだけ。AudioContext が無ければ作らない', () => {
    const saved = globalThis.window;
    try {
      fresh();
      const log = [];
      globalThis.window = { AudioContext: fakeAudioClass(log) };
      A.sndInit();
      expect(Object.keys(SND.L)).toEqual(['rumble', 'water', 'fire', 'wind', 'drone']);
      expect(log).toContainEqual(['gain0', 'gain', 'setTargetAtTime', 0.5, 12.5, 1.5]); // 音量の段 1 は 0.5
      log.length = 0;
      A.sndInit();
      expect(log).toEqual([['resume']]);
      fresh();
      globalThis.window = {};
      A.sndInit();
      expect(SND.ctx).toBe(null);
    } finally {
      globalThis.window = saved;
    }
  });
  it('大きさは 24 離れると 0、左右は向きから見た左右（右が正）', () => {
    Object.assign(player, { x: 10, z: 10, yaw: 0 });
    expect([A.sDist(), A.sDist(10, 10), A.sDist(34, 10), A.sDist(22, 10)]).toEqual([1, 1, 0, Math.pow(0.5, 1.4)]);
    expect([A.sPan(20, 10), A.sPan(0, 10), A.sPan(10, 20)]).toEqual([0.85, -0.85, 0]);
  });
});

describe('移す前と同じ', () => {
  let levels;
  beforeAll(async () => {
    const env = await loadEnv();
    // 前の4つはふつうの階、後ろの5つは崖・水晶・水がある階
    levels = [3, 7, 12, 20]
      .map((s, k) => gen(env, s, PLACES[(k * 5) % PLACES.length]).level)
      .concat([3, 6, 11, 12, 22].map((k) => gen(env, 5 + k, PLACES[k]).level));
  });
  it('音の部品・効果音・まわりの音の記録と状態の変わり方（60シード、約1300の場合）の指紋', () => {
    const all = audioCases(A, levels, 60),
      lines = all.split('\n');
    // 偽の Web Audio が作れずに、どの音も鳴らないまま比べていないか（1320 の場合のうち 1301 で音が鳴る）
    expect([lines.length, lines.filter((l) => l.includes('"start"')).length]).toEqual([1320, 1301]);
    expect([fnv(all), all.length]).toEqual(['6f4a4661', 3843361]);
  }, 30000);
});
