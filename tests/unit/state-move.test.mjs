// tools/state-move.mjs（古い JS の状態を入れ物の欄に移す書き換え）の単体テスト。小さな見本の古い JS を作って書き換え、結果の文を確かめる。
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { stateMove } from '../../tools/state-move.mjs';

let dir = null;
const make = (files) => {
  dir = mkdtempSync(join(tmpdir(), 'state-move-'));
  for (const [f, t] of Object.entries(files)) writeFileSync(join(dir, f), t);
  return dir;
};
const read = (f) => readFileSync(join(dir, f), 'utf8');
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe('状態を入れ物に移す（tools/state-move.mjs）', () => {
  it('ゲームの状態を指す所だけを書き換え、同じ名前の引数・局所の変数はそのまま。縮めた書き方は開き、宣言を消す', () => {
    make({
      '00-a.js': [
        'let keep=1, shake=0, other=2;',
        'let flash=0;',
        'function hit(){ shake=Math.max(shake,0.4); flash+=1; }',
        'function f(shake){ return shake*2; }',
        'function g(){ const flash=5; return flash; }',
        'const o={shake, other};',
        '',
      ].join('\n'),
      '01-b.js': 'function h(){ return shake+flash+keep; }\n',
    });
    const { report } = stateMove({ dir, box: 'vfx', names: ['shake', 'flash'] });
    expect(read('00-a.js')).toBe(
      [
        'let keep=1, other=2;',
        'function hit(){ vfx.shake=Math.max(vfx.shake,0.4); vfx.flash+=1; }',
        'function f(shake){ return shake*2; }',
        'function g(){ const flash=5; return flash; }',
        'const o={shake:vfx.shake, other};',
        '',
      ].join('\n'),
    );
    expect(read('01-b.js')).toBe('function h(){ return vfx.shake+vfx.flash+keep; }\n');
    expect(report.map((r) => [r.name, r.init, r.n, r.locals.length])).toEqual([
      ['shake', '0', 4, 1],
      ['flash', '0', 2, 1],
    ]);
  });

  it('いくつも並んだ宣言の最後の1つも、区切りのコンマごと消す', () => {
    make({ '00-a.js': 'let a=1, zap=null;\nfunction t(){ zap={t:1}; return zap; }\n' });
    stateMove({ dir, box: 'vfx', names: ['zap'] });
    expect(read('00-a.js')).toBe('let a=1;\nfunction t(){ vfx.zap={t:1}; return vfx.zap; }\n');
  });

  it('1つの宣言に並んだ名前を全部・いくつか移しても、範囲が重ならない（残る宣言子の初めの値の中も書き換える）', () => {
    make({ '00-a.js': 'let dead=false, stats={k:0}, shown=-1;\nlet a=1, b=2, c=b+1, d=4;\nfunction t(){ return dead||shown||b||d; }\n' });
    stateMove({ dir, box: 'adv', names: ['dead', 'stats', 'shown', 'b', 'd'] });
    expect(read('00-a.js')).toBe('let a=1, c=adv.b+1;\nfunction t(){ return adv.dead||adv.shown||adv.b||adv.d; }\n');
  });

  it('書き換える場所で入れ物の名前が別の宣言に隠されていたら、何も書き換えずに止める', () => {
    const src = 'let shake=0;\nfunction burst(fx,fz){ shake=Math.max(shake,0.1); return fx+fz; }\n';
    make({ '00-a.js': src });
    expect(() => stateMove({ dir, box: 'fx', names: ['shake'] })).toThrow(/隠されている/);
    expect(read('00-a.js')).toBe(src);
  });

  it('初めの値が関数を呼ぶ宣言は、その場に「入れ物.名前=初めの値;」として残す（呼ぶ時と順番を変えない）', () => {
    make({ '00-a.js': 'let a=1;\nlet seed=(Math.random()*1e9)>>>0;\nfunction s(){ return seed+a; }\n' });
    const { report } = stateMove({ dir, box: 'adv', names: ['seed'] });
    expect(read('00-a.js')).toBe('let a=1;\nadv.seed=(Math.random()*1e9)>>>0;\nfunction s(){ return adv.seed+a; }\n');
    expect(report[0].kept).toBe(true);
  });

  it('dry なら書き換えない', () => {
    const src = 'let shake=0;\nfunction s(){ return shake; }\n';
    make({ '00-a.js': src });
    const { report } = stateMove({ dir, box: 'vfx', names: ['shake'], dry: true });
    expect(report[0].n).toBe(1);
    expect(read('00-a.js')).toBe(src);
  });
});
