// src/lib/text.ts の単体テスト（パネルの文字の幅と枠）。本物のフォントで測った幅は tests/panels.mjs が確かめる
import { describe, expect, it } from 'vitest';
import { boxText, padTo, visW, wrapPlain } from '../../src/lib/text.ts';

describe('visW', () => {
  it('半角は1マス、全角は2マス、全角スペースは1マス、← → は2マス', () => {
    expect(visW('abc')).toBe(3);
    expect(visW('日本語')).toBe(6);
    expect(visW('ルーン')).toBe(6);
    expect(visW('！？')).toBe(4);
    expect(visW('　')).toBe(1);
    expect(visW('←→')).toBe(4);
    expect(visW('ᚦᛏ')).toBe(2); // ルーン文字は半角
  });
  it('タグは数えず、文字参照は1文字、<input size="n"> は n マス', () => {
    expect(visW('<b class="x">名前</b>')).toBe(4);
    expect(visW('&lt;&gt;&amp;&quot;&#39;')).toBe(5);
    expect(visW('a<input type="text" size="12">b')).toBe(14);
  });
});

describe('padTo と wrapPlain', () => {
  it('padTo は半角スペースで埋めて、w マスにする（はみ出す時はそのまま）', () => {
    expect(padTo('名前', 6)).toBe('名前  ');
    expect(visW(padTo('<b>剣</b>', 10))).toBe(10);
    expect(padTo('長い名前です', 4)).toBe('長い名前です');
  });
  it('wrapPlain は w マスを超えないように折る（全角を途中で割らない）', () => {
    const out = wrapPlain('あいうえおかきくけこ', 5);
    expect(out).toEqual(['あい', 'うえ', 'おか', 'きく', 'けこ']);
    for (const l of wrapPlain('abc日本語のテキストdef', 7)) expect(visW(l)).toBeLessThanOrEqual(7);
    expect(wrapPlain('', 5)).toEqual([]);
  });
});

describe('boxText', () => {
  const f = (t: string) => `<span class="f">${t}</span>`;
  const plain = (s: string) => s.replace(/<[^>]*>/g, '');
  it('どの行も同じ幅になり、右の縦線が揃う', () => {
    const out = boxText([f('+-- 操作 ----'), `${f('|')} <b>WASD</b> 移動`, `${f('|')} とても長い説明の行です`, f('+----')]).split('\n');
    const widths = out.map((l) => visW(l));
    expect(new Set(widths).size).toBe(1);
    expect(plain(out[0] ?? '')).toMatch(/^\+-- 操作 -+\+$/);
    expect(plain(out.at(-1) ?? '')).toMatch(/^\+-+\+$/);
    for (const l of out.slice(1, -1)) expect(plain(l).endsWith(' |')).toBe(true);
  });
  it('fixedW があれば、中の幅をそれ以上にする', () => {
    const out = boxText([f('+-- 狭い'), `${f('|')} a`, f('+')], 40).split('\n');
    expect(visW(out.at(-1) ?? '')).toBe(42);
  });
});
