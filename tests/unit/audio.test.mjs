// 音を鳴らす処理（src/lib/audio.ts）の単体テスト。Node には Web Audio が無いので、偽の Web Audio（fake-audio.mjs）で確かめる。
// 指紋の値は、移す前の古い JS（src/game/15-sound-fire.js と、遠吠え・警報は 13-creatures.js）でも同じになる（audio-cases.mjs の場合を、古い関数で数えて確かめた）。
// 迷宮の生成は使わないので、生成を変えてもこの指紋は変わらない。
// テストを .mjs で書くのは、偽の Web Audio を AudioContext の型に合わせられないため（型の言い切り as を使わない）
import { describe, expect, it } from 'vitest';
import * as A from '../../src/lib/audio.ts';
import { SND, player } from '../../src/lib/state.ts';
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
  it('作る途中で止まったら、作りかけの音の部品を閉じ、部品を全部空に戻す。次は、はじめから作り直せる', async () => {
    const saved = globalThis.window;
    try {
      // 鳴り続ける音を作った後、低い音の2つ目の波で止まる。閉じるのも失敗する
      fresh();
      const log = [];
      globalThis.window = {
        AudioContext: function LateBrokenAudioContext() {
          const c = fakeAudio(log),
            osc = c.createOscillator;
          let n = 0;
          c.createOscillator = () => {
            if (++n === 2) throw new Error('低い音の波が作れない');
            return osc();
          };
          c.close = () => {
            log.push(['close']);
            return Promise.reject(new Error('閉じられない'));
          };
          return c;
        },
      };
      A.sndInit();
      expect(log.filter((l) => l[1] === 'start').length).toBe(5); // 鳴り続ける雑音4つと、低い音の1つ目の波は鳴り始めていた
      expect([SND.ctx, SND.master, SND.inp, SND.wet, SND.noise, Object.keys(SND.L)]).toEqual([null, null, null, null, null, []]);
      expect(log).toContainEqual(['close']);
      await Promise.resolve(); // 閉じる失敗の知らせを受けていなければ、ここで、処理されない Promise の失敗（unhandled rejection）になる
      // 閉じる関数が無い古いブラウザでも、止まらずに空に戻す
      globalThis.window = {
        AudioContext: function NoCloseAudioContext() {
          const c = fakeAudio([]);
          c.createConvolver = () => {
            throw new Error('響きの部品が作れない');
          };
          return c;
        },
      };
      expect(() => A.sndInit()).not.toThrow();
      expect([SND.ctx, SND.master]).toEqual([null, null]);
      // 次のクリックでは、はじめから作り直せる
      globalThis.window = { AudioContext: fakeAudioClass([]) };
      A.sndInit();
      expect(Object.keys(SND.L)).toEqual(['rumble', 'water', 'fire', 'wind', 'drone']);
    } finally {
      globalThis.window = saved;
    }
  });
  it('2回目に動かせなくても（動かす関数が無い・失敗する）、動いている部品はそのまま使う', async () => {
    fresh();
    const c = fakeAudio([]);
    SND.ctx = c;
    const master = (SND.master = c.createGain());
    c.resume = () => {
      throw new TypeError('resume が無い');
    };
    expect(() => A.sndInit()).not.toThrow();
    expect([SND.ctx, SND.master]).toEqual([c, master]);
    c.resume = () => Promise.reject(new Error('動かせない'));
    A.sndInit();
    await Promise.resolve();
    expect([SND.ctx, SND.master]).toEqual([c, master]);
  });
  it('大きさは 24 離れると 0、左右は向きから見た左右（右が正）', () => {
    Object.assign(player, { x: 10, z: 10, yaw: 0 });
    expect([A.sDist(), A.sDist(10, 10), A.sDist(34, 10), A.sDist(22, 10)]).toEqual([1, 1, 0, Math.pow(0.5, 1.4)]);
    expect([A.sPan(20, 10), A.sPan(0, 10), A.sPan(10, 20)]).toEqual([0.85, -0.85, 0]);
  });
});

describe('移す前と同じ', () => {
  it('音の部品・効果音・まわりの音の記録と状態の変わり方（60シード、1440の場合）の指紋', () => {
    const before = JSON.stringify([player, SND.lv, SND.on, SND.ctx]);
    const all = audioCases(A, 60),
      lines = all.split('\n');
    // 偽の Web Audio が作れずに、どの音も鳴らないまま比べていないか（1440 の場合のうち 1421 で音が鳴る）
    expect([lines.length, lines.filter((l) => l.includes('"start"')).length]).toEqual([1440, 1421]);
    expect([fnv(all), all.length]).toEqual(['b5c61e76', 4251819]);
    expect(JSON.stringify([player, SND.lv, SND.on, SND.ctx])).toBe(before); // 書き換えた状態は元に戻る
  }, 30000);
});
