// tools/case-diff.mjs の単体テスト（場合の書き出しを比べて、まとめる所。テストを走らせる所は、本物の書き出しで手で確かめた）
import { describe, expect, it } from 'vitest';
import { applyFix, plainText, report, summarize } from '../../tools/case-diff.mjs';
import { stateFp } from './case-out.mjs';

const line = (calls) => JSON.stringify(calls);

describe('場合の書き出しを比べる', () => {
  it('同じなら、同じと言う', () => {
    const s = summarize('a\nb', 'a\nb');
    expect(s.lines).toBe(0);
    expect(report('t', s)).toBe('== t：同じ（2 行）\n');
  });
  it('呼び出しは名前、生き物は鍵で道すじを一般にし、数の違いと、その時の伝言を出す', () => {
    const mob = (key, form) => ({ key, ty: '名前', form });
    const a = [
        line([
          { name: 'draw', dn: 35, msgs: '' },
          { name: 'tick', state: JSON.stringify({ mons: [mob('r', 'x'), mob('q', 'f1')] }), msgs: '<b>q</b>ギタイムシを倒した。' },
        ]),
        line([{ name: 'draw', dn: 35, msgs: '' }]),
      ].join('\n'),
      b = [
        line([
          { name: 'draw', dn: 162, msgs: '' },
          { name: 'tick', state: JSON.stringify({ mons: [mob('r', 'x'), mob('q', 'f2')] }), msgs: '<b>q</b>ギタイムシを倒した。' },
        ]),
        line([{ name: 'draw', dn: 162, msgs: '' }]),
      ].join('\n');
    const s = summarize(a, b);
    expect(s.lines).toBe(2);
    expect([...s.paths.keys()].sort((p, q) => p.localeCompare(q))).toEqual(['[draw].dn', '[tick].state.mons{q}.form']);
    expect([...(s.paths.get('[draw].dn')?.deltas ?? [])]).toEqual([[127, 2]]);
    expect(s.firsts.map((f) => f.where)).toEqual(['行0[0][draw].dn', '行1[0][draw].dn']);
    const r = report('t', s);
    expect(r).toContain('2 行が違う');
    expect(r).toContain('数の違い +127×2');
    // 違う所が呼び出しの中なら、伝言の終わりを、印（HTML）を除いて出す
    const tick = summarize(
      line([{ name: 'tick', msgs: '<b>q</b>倒した。', mr: 1 }]),
      line([{ name: 'tick', msgs: '<b>q</b>倒した。', mr: 4 }]),
    );
    expect(report('t', tick)).toContain('伝言：…q倒した。');
  });
  it('行ごとに JSON の文字列（生き物の一覧）を配列として読み、数が違えば要素の違いの後に出す', () => {
    const m = (key, hp) => JSON.stringify({ key, ty: 't', hp });
    const s = summarize(
      line([{ mons: [m('a', 1), m('q', 2)].join('\n') }]),
      line([{ mons: [m('a', 1), m('q', 3), m('b', 1)].join('\n') }]),
    );
    expect(s.firsts[0]?.where).toBe('行0[0].mons[1]{q}.hp');
    expect([...s.paths.keys()]).toEqual(['[].mons{q}.hp', '[].mons.length']);
  });
  it('伝言の HTML から印を除く（入れ子や閉じていない印でも、< は残らない）', () => {
    expect(plainText('<b style="c">q</b>ギタイムシを倒した。')).toBe('qギタイムシを倒した。');
    expect(plainText('a<<script>b>c<d')).toBe('ab>cd'); // 閉じていない < は、その < だけを捨てる
    expect(plainText('<scr<script>ipt>x')).not.toContain('<');
  });
  it('JSON でない行は、最初に違う文字の場所と手前を出す。行が無い時も数える', () => {
    const s = summarize('q 3fa6:35:0\nz', 'q 2415:162:0');
    expect(s.lines).toBe(2);
    expect(s.firsts[0]).toMatchObject({ where: '行0 2文字目', before: 'q ' });
    expect(s.firsts[1]?.path).toBe('(行が無い)');
  });
});

describe('状態の指紋（case-out.mjs）', () => {
  it('書き出さない時は、今までどおりの指紋', () => {
    const prev = process.env.AL_CASES_OUT;
    delete process.env.AL_CASES_OUT;
    try {
      expect(stateFp('{"a":1}', (s) => `h:${s}`)).toBe('h:{"a":1}');
    } finally {
      if (prev !== undefined) process.env.AL_CASES_OUT = prev;
    }
  });
  it('書き出す時は、欄ごと・生き物ごとの指紋', () => {
    const prev = process.env.AL_CASES_OUT;
    process.env.AL_CASES_OUT = '/nonexistent';
    try {
      const h = (s) => `h${s.length}`;
      const o = stateFp(JSON.stringify({ player: { x: 1, hp: 10 }, mons: [{ key: 'q', ty: 'ギタイムシ', form: 'abc' }], t: 5 }), h);
      expect(o).toEqual({ player: { x: 'h1', hp: 'h2' }, mons: [{ key: 'q', ty: 'h7', form: 'h5' }], t: 'h1' });
    } finally {
      if (prev === undefined) delete process.env.AL_CASES_OUT;
      else process.env.AL_CASES_OUT = prev;
    }
  });
});

describe('落ちた指紋を書き換える（--update）', () => {
  const src = [
    "  it('x', () => {",
    "    caseOut('x', all);",
    "    expect([fnv(all), all.length]).toEqual(['aaaa1111', 100]);",
    '    expect(all.length).toBe(100);',
    "    expect(fnv(all)).toBe('bbbb2222'); // 説明（括弧）も残す);",
    "    expect(new Set(calls)).toEqual(new Set(['a']));",
    '  });',
  ].join('\n');
  it('配列と、数・文字列の toBe を、今の値に書き換える（行の後ろの説明は残す）', () => {
    const a = applyFix(src, 3, "AssertionError: expected [ 'cccc3333', 120 ] to deeply equal [ 'aaaa1111', 100 ]");
    expect(a.src?.split('\n')[2]).toBe("    expect([fnv(all), all.length]).toEqual(['cccc3333', 120]);");
    const b = applyFix(src, 4, 'AssertionError: expected 120 to be 100 // Object.is equality');
    expect(b.src?.split('\n')[3]).toBe('    expect(all.length).toBe(120);');
    const c = applyFix(src, 5, "AssertionError: expected 'dddd4444' to be 'bbbb2222' // Object.is equality");
    expect(c.src?.split('\n')[4]).toBe("    expect(fnv(all)).toBe('dddd4444'); // 説明（括弧）も残す);");
  });
  it('caseOut のすぐ後でない行・行の値が期待していた値と違う時・指紋でない失敗は、書き換えない', () => {
    expect(applyFix(src, 6, "AssertionError: expected Set{ 'b' } to deeply equal Set{ 'a' }").src).toBeUndefined();
    expect(applyFix(src, 3, "AssertionError: expected [ 'cccc3333', 120 ] to deeply equal [ 'ffff0000', 1 ]").why).toBe(
      '行の値が、テストの期待していた値と違う',
    );
    expect(
      applyFix(src.replace("    caseOut('x', all);\n", ''), 2, "AssertionError: expected [ 'c', 1 ] to deeply equal [ 'aaaa1111', 100 ]")
        .why,
    ).toBe('caseOut のすぐ後（4 行以内）の行ではない');
    expect(applyFix(src, 3, 'TypeError: x is undefined').why).toBe('指紋の失敗の文ではない');
  });
});
