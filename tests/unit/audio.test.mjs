// 音を鳴らす処理（src/lib/audio.ts）と詠唱の声（src/game/26-spells-hud.js の chantStart）の単体テスト。Node には Web Audio が無いので、偽の Web Audio（fake-audio.mjs）で確かめる。
// 指紋の値は、移す前の古い JS（src/game/15-sound-fire.js と、遠吠え・警報は 13-creatures.js。詠唱の声は Math.random を直に引いていた版）に、
// 音の乱数（sndRand）と同じ並びを Math.random として入れた時と同じになる（audio-cases.mjs の場合を、古い関数で数えて確かめた）。
// 迷宮の生成は使わないので、生成を変えてもこの指紋は変わらない。
// 音を鳴らす所が見た目の乱数を引いていないかは、src/ を構文の木で調べて確かめる（sound-random-check.mjs）。
// テストを .mjs で書くのは、偽の Web Audio を AudioContext の型に合わせられないため（型の言い切り as を使わない）
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { legacyValues } from '../../tools/legacy-eval.mjs';
import * as A from '../../src/lib/audio.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { SND, clock, gear, player } from '../../src/lib/state.ts';
import { audioCases } from './audio-cases.mjs';
import { fakeAudio, fakeAudioClass } from './fake-audio.mjs';
import { soundRandomCheck } from './sound-random-check.mjs';

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
    expect(all.includes('"Math.random"')).toBe(false); // 音は見た目の乱数を引かない（引くと、音を変えただけで粒子などの並びがずれる）
    expect(JSON.stringify([player, SND.lv, SND.on, SND.ctx])).toBe(before); // 書き換えた状態は元に戻る
  }, 30000);
});

describe('詠唱の声（src/game/26-spells-hud.js の chantStart）', () => {
  it('音節ごとの記録と、円の文字を光らせる音節の番号の指紋。見た目の乱数（Math.random）は引かない', async () => {
    const { chantStart } = await legacyValues(['ELEM_ROOT', 'chantStart']);
    const random = Math.random,
      oldSound = setSoundRand(Math.random),
      savedCast = gear.castSt,
      savedTime = clock.time;
    let calls = 0;
    const out = [];
    try {
      Math.random = () => {
        calls++;
        return 0.5;
      };
      for (const [n, el] of [null, 'fire', 'ice', 'thunder', 'poison', 'other'].entries()) {
        fresh();
        const log = [];
        SND.ctx = fakeAudio(log);
        SND.master = SND.inp = SND.ctx.createGain();
        SND.noise = { id: 'noise' };
        setSoundRand(mulberry32(n * 13 + 5));
        gear.castSt = { syl: -1, sylT: -1 };
        const h = chantStart(el);
        // 1.6秒、0.05秒ごとに溜めを進める（途中で溜めきる）。その後、止める（2回止めても1回だけ）
        for (let k = 0; k < 32; k++) {
          SND.ctx.currentTime = 12.5 + k * 0.05;
          clock.time = k * 0.05;
          h.tick(Math.min(1, k / 20), k >= 20);
        }
        h.stop();
        h.stop();
        h.tick(1, true); // 止めた後は鳴らない
        out.push(JSON.stringify([el, gear.castSt, log]));
      }
      fresh();
      expect(chantStart('fire')).toBe(null); // 音が鳴らせない時は作らない
    } finally {
      Math.random = random;
      setSoundRand(oldSound);
      gear.castSt = savedCast;
      clock.time = savedTime;
      fresh();
    }
    const all = out.join('\n');
    expect(calls).toBe(0);
    expect([fnv(all), all.length]).toEqual(['ba541717', 115649]);
  });
});

describe('音を鳴らす所が、見た目の乱数を引かない（src/ を調べる）', () => {
  const SRC = join(import.meta.dirname, '../../src');
  const audioText = readFileSync(join(SRC, 'lib/audio.ts'), 'utf8');
  const audioNames = [...audioText.matchAll(/^export (?:function|const) (s[A-Z]\w*)/gm)].map((m) => m[1]);
  it('見本：4つの形を見つけ、音のほかのこともする判定は見逃す', () => {
    const files = [
      {
        name: 'game/01-a.js',
        text: [
          'function sPing(x){ if(!sndReady())return; sTone(0,"sine",440+mr()*9,0,1,null); }', // 3：音を鳴らす関数の中
          'function f(dt,i){ sDrip(1,2,0.2+mr()*0.1);', // 1：引数
          '  if(mr()<0.3)sBubble(1,2,0.3,true);', // 2：if の条件で、中身は音だけ
          '  if(mr()<dt){ found=true; sChime(1,2,0.2); msg("罠を見つけた"); }', // 音のほかのこともするので、見逃す
          '  if(clock.time>t0){ t0=clock.time+6+mr()*5; omen(); sPing(1); } }', // 4：次に鳴らす時刻
          'const sPop=(x,z)=>{ if(!sndReady())return; sTone(0,"sine",shuffle([1,2],mr)[0],0,1,null); };', // 矢印関数の音の関数。3：mr を値として渡す
          'function g(){ if(roll(1,3)>2)sPop(1,2); sChime(1,2,roll(1,2)*0.1);', // 2：矢印関数の音の関数を呼ぶ。1：roll
          '  if(go){ nextT=performance.now()+Math.random()*9; sPop(1,2); } }', // 4：performance.now の時刻
        ].join('\n'),
      },
      { name: 'lib/b.ts', text: 'export function g(): void { if (on && sndReady()) { const v = mr(); sDrip(0, 0, v); } }' }, // 3：sndReady の中
      {
        // 自分で roll を宣言しているファイルでは、roll は見た目の乱数として数えない
        name: 'lib/c.ts',
        text: 'export function h(dt: number): void { const roll = (r: number): boolean => sndRand() < r * dt; if (roll(1)) sDrip(0, 0, 1); }',
      },
    ];
    const r = soundRandomCheck(files, ['sTone', 'sDrip', 'sBubble', 'sChime']);
    expect(r.sound).toEqual(['sBubble', 'sChime', 'sDrip', 'sPing', 'sPop', 'sTone']);
    expect(r.bad).toEqual([
      'game/01-a.js:1 音を鳴らす関数の中',
      'game/01-a.js:1 sTone の引数',
      'game/01-a.js:2 sDrip の引数',
      'game/01-a.js:3 if の条件で、音を鳴らすか',
      'game/01-a.js:5 次に鳴らす時刻',
      'game/01-a.js:6 音を鳴らす関数の中',
      'game/01-a.js:6 sTone の引数',
      'game/01-a.js:7 if の条件で、音を鳴らすか',
      'game/01-a.js:7 sChime の引数',
      'game/01-a.js:8 次に鳴らす時刻',
      'lib/b.ts:1 sndReady の中',
    ]);
  });
  it('src/ のどこにも無い（音を鳴らす所は、音の乱数 sndRand を使う）', () => {
    const files = readdirSync(SRC, { recursive: true })
      .map(String)
      .filter((f) => (f.startsWith('game/') && f.endsWith('.js')) || (f.startsWith('lib/') && f.endsWith('.ts')))
      .map((name) => ({ name, text: readFileSync(join(SRC, name), 'utf8') }));
    const r = soundRandomCheck(files, audioNames);
    // 古い JS の音を鳴らす関数も見つけている（本体が if(!sndReady())return で始まる関数）
    expect(r.sound).toEqual(expect.arrayContaining(['castSound', 'chantStart', 'humStart', 'omenSound', 'sShriek', 'sDrip', 'sChime']));
    expect(r.bad).toEqual([]);
    // audio.ts（コメントを除く）と詠唱の声は丸ごと調べる：見た目の乱数を、どんな形でも使わない（音だけの処理の外の形も、変数に入れてから渡す形も）
    const spells = readFileSync(join(SRC, 'game/26-spells-hud.js'), 'utf8'),
      chant = spells.slice(spells.indexOf('function chantStart'), spells.indexOf('\n}\n', spells.indexOf('function chantStart')));
    const anyVisual = /\b(mr|mpick)\b|Math\.random/;
    expect([anyVisual.test(audioText.replace(/^\s*(\/\/|\*).*$/gm, '')), chant.length > 1000, anyVisual.test(chant)]).toEqual([
      false,
      true,
      false,
    ]);
    // audio.ts が random.ts から読むのは sndRand だけ（random.ts の roll も読まない）
    expect([...audioText.matchAll(/^import .* from '\.\/random\.ts';$/gm)].map((m) => m[0])).toEqual([
      "import { sndRand } from './random.ts';",
    ]);
  }, 30000);
});
