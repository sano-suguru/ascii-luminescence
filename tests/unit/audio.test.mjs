// 音を鳴らす処理と詠唱の声 chantStart（どちらも src/lib/audio.ts）の単体テスト。Node には Web Audio が無いので、偽の Web Audio（fake-audio.mjs）で確かめる。
// 指紋の値は、移す前の古い JS（src/game/15-sound-fire.js と、遠吠え・警報は 13-creatures.js。詠唱の声は 26-spells-hud.js の、Math.random を直に引いていた版）に、
// 音の乱数（sndRand）と同じ並びを Math.random として入れた時と同じになる（audio-cases.mjs の場合を、古い関数で数えて確かめた）。
// 迷宮の生成は使わないので、生成を変えてもこの指紋は変わらない。
// 音を鳴らす所が見た目の乱数を引いていないかは、src/ を構文の木で調べて確かめる（sound-random-check.mjs）。
// テストを .mjs で書くのは、偽の Web Audio を AudioContext の型に合わせられないため（型の言い切り as を使わない）
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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
  it('先に作った部品（sndPrep）は、sndInit までは SND に入れず音量も上げない。sndInit で入れ、音量を上げ始め、止まっていた部品を動かす', () => {
    const saved = globalThis.window;
    try {
      fresh();
      const log = [];
      globalThis.window = { AudioContext: fakeAudioClass(log) };
      A.sndPrep();
      expect([SND.ctx, SND.master, Object.keys(SND.L)]).toEqual([null, null, []]);
      expect(log.filter((l) => l[2] === 'setTargetAtTime' || l[0] === 'resume')).toEqual([]);
      expect(A.sndReady()).toBe(null);
      A.sndPrep(); // 2回目は作らない
      const made = log.length;
      log.length = 0;
      A.sndInit();
      expect(Object.keys(SND.L)).toEqual(['rumble', 'water', 'fire', 'wind', 'drone']);
      expect(log).toEqual([['gain0', 'gain', 'setTargetAtTime', 0.5, 12.5, 1.5], ['resume']]);
      expect(made).toBeGreaterThan(20);
      // 音が鳴り始めた後は、先に作らない
      log.length = 0;
      A.sndPrep();
      expect(log).toEqual([]);
      // 先に作れなかった時は、押した時（sndInit）に作り直す
      fresh();
      globalThis.window = {
        AudioContext: function BrokenAudioContext() {
          throw new Error('作れない');
        },
      };
      A.sndPrep();
      globalThis.window = { AudioContext: fakeAudioClass([]) };
      A.sndInit();
      expect(Object.keys(SND.L)).toEqual(['rumble', 'water', 'fire', 'wind', 'drone']);
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
    expect([fnv(all), all.length]).toEqual(['c0f1dabc', 4251819]);
    expect(all.includes('"Math.random"')).toBe(false); // 音は見た目の乱数を引かない（引くと、音を変えただけで粒子などの並びがずれる）
    expect(JSON.stringify([player, SND.lv, SND.on, SND.ctx])).toBe(before); // 書き換えた状態は元に戻る
  }, 30000);
});

describe('詠唱の声（chantStart）', () => {
  it('音節ごとの記録と、円の文字を光らせる音節の番号の指紋。見た目の乱数（Math.random）は引かない', async () => {
    const { chantStart } = A;
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
          '  if(clock.time>t0){ t0=clock.time+6+mr()*5; sPing(1); } }', // 4：次に鳴らす時刻
          'const sPop=(x,z)=>{ if(!sndReady())return; sTone(0,"sine",shuffle([1,2],mr)[0],0,1,null); };', // 矢印関数の音の関数。3：mr を値として渡す
          'function g(){ if(roll(1,3)>2)sPop(1,2); sChime(1,2,roll(1,2)*0.1);', // 2：矢印関数の音の関数を呼ぶ。1：roll
          '  if(performance.now()>nextT){ nextT=performance.now()+Math.random()*9; sPop(1,2); } }', // 4：performance.now の時刻
          'function k(){ if(clock.time>o.next.t){ o.next={t:clock.time+4+mr()*6}; sChime(1,2,0.1); } }', // 4：オブジェクトの欄の中の時刻
          'function n(m){ if(go){ m.nextMove=clock.time+2+mr(); sChime(1,2,0.1); } }', // 見逃す：音を鳴らすかを決めない時刻（ゲームの時刻）
          'function u(){ if(mr()<0.3)sBubble(1,2,0.3,true); else spawnBat();', // 見逃す：else でゲームのことをする
          '  if(mr()<0.3)sBubble(1,2,0.3,true); else if(on)sDrip(1,2,0.1);', // 2：else も音だけ
          '  if(mr()<0.3){ if(trySpawn())sDrip(1,2,0.1); } }', // 見逃す：中の if の条件でゲームの処理を呼ぶ
          'function w(o){ if(clock.time<o.t)return; o.t=clock.time+mr()*3; sDrip(1,2,0.1); }', // 4：if(…)return の後ろ
          'function y(m){ const due=clock.time>m.dripT; if(due){ m.dripT=clock.time+mr()*3; sDrip(1,2,0.1); } }', // 4：比べた結果を変数に入れてから
          'function z(m){ if(clock.time>m.atkT){ m.atkT=clock.time+1+mr(); hurtPlayer(3); sDrip(1,2,0.1); } }', // 見逃す：攻撃の待ち時間（ゲームのことも決める）
          'function a1(){ let t=0; if(clock.time>t)sDrip(1,2,0.1); }', // 名前 t の比べる所は、この関数の t だけ
          'function b1(){ let t; if(go){ t=clock.time+mr()*3; sDrip(1,2,0.1); } use(t); }', // 見逃す：別の関数の、同じ名前の変数
          'function c1(m){ if(clock.time>m.hissT&&sndReady()){ m.hissT=clock.time+mr(); const t0=now(); sDrip(1,2,t0); } }', // 4：sndReady の条件の中（3 でも出る）
          'function d1(m){ if(clock.time<m.t){ } else { m.t=clock.time+mr()*3; sDrip(1,2,0.1); } }', // 4：else の中
          'function e1(m){ const due=m.dT; if(clock.time>due){ m.dT=clock.time+mr()*3; sDrip(1,2,0.1); } }', // 4：入れる先を変数に入れてから比べる
          'function f1(m){ if(clock.time>m.dripT)dripNow(m); }', // 4：呼ぶ所で比べる（次の行）
          'function dripNow(m){ m.dripT=clock.time+mr()*3; sDrip(1,2,0.1); }',
          'function g1(m){ if(clock.time>m.nextMove)moveNow(m); }', // 見逃す：呼ぶ関数がゲームのこともする（次の行）
          'function moveNow(m){ m.nextMove=clock.time+mr(); step(m); sDrip(1,2,0.1); }',
          'function h1(m){ if(clock.time>m.t){ const d=mr()*3; m.t=clock.time+d; sDrip(1,2,0.1); } }', // 4：入れる先への代入にだけ使う変数の宣言
          'function f2(m){ if(clock.time>m.hT)hissNow(m); }', // 呼ぶ所（hissNow は game/02-b.js）
          'function i1(m){ if(clock.time>m.t){ const q=mr(); spawn(q,0,0); m.t=clock.time+mr(); sDrip(1,2,0.1); } }', // 見逃す：ゲームに使う変数の宣言がある
          'function j1(m){ if(clock.time>m.t){ m.t=clock.time+mr()*3; sDrip(1,2,0.1); } else { hide(m); } }', // 見逃す：もう片方でゲームのことをする
          'function k1(o){ if(clock.time<o.t){ wander(o); return; } o.t=clock.time+mr()*3; sDrip(1,2,0.1); }', // 見逃す：return の前でゲームのことをする
          'function l1(mon){ if(clock.time>mon.wT)wailNow(mon); }', // 4：呼ぶ所で、引数の名前が違う（次の行）
          'function wailNow(m){ m.wT=clock.time+mr()*3; sDrip(1,2,0.1); }',
        ].join('\n'),
      },
      // 4：呼ぶ所が、ほかのファイルにある（game/01-a.js の f2 が、ここの hissNow を比べてから呼ぶ）
      { name: 'game/02-b.js', text: 'function hissNow(m){ m.hT=clock.time+mr()*2; sDrip(1,2,0.1); }' },
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
      'game/01-a.js:9 次に鳴らす時刻',
      'game/01-a.js:12 if の条件で、音を鳴らすか',
      'game/01-a.js:14 次に鳴らす時刻',
      'game/01-a.js:15 次に鳴らす時刻',
      'game/01-a.js:19 sndReady の中',
      'game/01-a.js:19 次に鳴らす時刻',
      'game/01-a.js:20 次に鳴らす時刻',
      'game/01-a.js:21 次に鳴らす時刻',
      'game/01-a.js:23 次に鳴らす時刻',
      'game/01-a.js:32 次に鳴らす時刻',
      'game/01-a.js:26 変数 d を経て 次に鳴らす時刻',
      'game/02-b.js:1 次に鳴らす時刻',
      'lib/b.ts:1 sndReady の中',
    ]);
  });
  it('見本：引いた値を変数に入れてから音に使う形を見つけ、音のほかのことにも使う変数は見逃す', () => {
    const files = [
      {
        name: 'game/01-a.js',
        text: [
          'function f(dt,i){ const v=mr(); sDrip(1,2,v);', // 捕まえる：変数に入れてから引数に
          '  const a=mr()*0.1; const vol=0.2+a; sChime(1,2,vol);', // 捕まえる：変数から変数へ
          '  const r=mr(); if(r<0.3)sBubble(1,2,0.3,true);', // 捕まえる：if の条件で、中身は音だけ
          '  let w; w=mpick([1,2]); setTimeout(()=>sDrip(0,0,w),9);', // 捕まえる：後から入れる・中の関数で使う
          '  const d=Math.random()*5; if(clock.time>t1){ t1=clock.time+d; sChime(1,2,0.1); }', // 捕まえる：次に鳴らす時刻
          '  const q=mr(); if(q<dt){ found=true; sChime(1,2,q); msg("罠を見つけた"); }', // 見逃す：罠を見つけたかの判定にも使う
          '  const x=mr()*9; spawn(x,0,0); sDrip(x,0,1);', // 見逃す：粒子の位置にも使う
          '  const k=mr(); const y=k*2; spawn(y,0,0); sDrip(0,0,k); }', // 見逃す：移した先の変数を、粒子の位置に使う
          'function g(){ const v=mr(); spawn(v,0,0); { const v=0.5; sDrip(0,0,v); } }', // 見逃す：同じ名前の別の変数
          'function h(){ const from=mr(); if(go){ b.morph={from,t0:clock.time}; sChime(1,2,0.1); } }', // 見逃す：オブジェクトの中の値は時刻ではない
          'let lv=mr(); function c(){ sDrip(0,0,lv); }', // 追わない：一番外の変数
          'function play(v){ sDrip(0,0,v); } function e(){ play(mr()); m.t=mr(); sDrip(0,0,m.t); }', // 追わない：引数とオブジェクトの欄
          'function j(big){ const [px,vol]=[mr()*9,0.3]; spawn(px,0,0); sDrip(0,0,vol);', // 見逃す：分割代入で、vol に入るのは 0.3
          '  const {a2,b2}={a2:0.3,b2:mr()}; spawn(a2,0,0); sDrip(0,0,b2);', // 捕まえる：分割代入で、b2 に入るのは引いた値
          '  let pp=400+mr()*50; if(big)pp*=0.5; sDrip(0,0,pp);', // 捕まえる：その場で変えてから使う
          '  const c2=mr(); const gg=()=>{ spawn(c2,0,0); return 1; }; sDrip(0,0,gg());', // 見逃す：中の関数で粒子の位置に使う
          '  const sp=2+mr(); if(go){ m.nextMove=clock.time+sp; sChime(1,2,0.1); }', // 見逃す：ゲームの時刻
          '  const r2=mr(); if(r2<0.3)sBubble(1,2,0.3,true); else spawnBat(); }', // 見逃す：else でゲームのことをする
        ].join('\n'),
      },
      {
        // TypeScript の型が付いていても追う
        name: 'lib/b.ts',
        text: 'export function g(n: number): void { const v: number = (mr() as number) * n; const s = v!; sDrip(0, 0, s); }',
      },
    ];
    const r = soundRandomCheck(files, ['sTone', 'sDrip', 'sBubble', 'sChime']);
    expect(r.bad).toEqual([
      'game/01-a.js:1 変数 v を経て sDrip の引数',
      'game/01-a.js:2 変数 a・vol を経て sChime の引数',
      'game/01-a.js:3 変数 r を経て if の条件で、音を鳴らすか',
      'game/01-a.js:4 変数 w を経て sDrip の引数',
      'game/01-a.js:5 変数 d を経て 次に鳴らす時刻',
      'game/01-a.js:14 変数 b2 を経て sDrip の引数',
      'game/01-a.js:15 変数 pp を経て sDrip の引数',
      'lib/b.ts:1 変数 v・s を経て sDrip の引数',
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
    // audio.ts（コメントを除く。詠唱の声も入る）は丸ごと調べる：見た目の乱数を、どんな形でも使わない（音だけの処理の外の形も、変数に入れてから渡す形も）
    expect(/\b(mr|mpick)\b|Math\.random/.test(audioText.replace(/^\s*(\/\/|\*).*$/gm, ''))).toBe(false);
    // audio.ts が random.ts から読むのは sndRand だけ（random.ts の roll も読まない）
    expect([...audioText.matchAll(/^import .* from '\.\/random\.ts';$/gm)].map((m) => m[0])).toEqual([
      "import { sndRand } from './random.ts';",
    ]);
  }, 30000);
});
