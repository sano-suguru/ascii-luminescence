// 構文の木で、移した関数と移す前の古い関数を比べる道具（tools/same-code.mjs）の単体テスト。
// 規則ごとに「同じと言う物」と「違うと言う物」を小さな見本で確かめ、写し漏れ・係数・比べ方・乱数を引く順番の違いを見つけることも確かめる。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { boxFields, compareSources, detectStates, gameUses, legacyDecls, referenced, wasUnused } from '../../tools/same-code.mjs';

/** 古い JS の文 oldJs と新しい .ts の文 newTs を比べ、関数ごとの違いの数・人が確かめる一覧・比べた名前を返す */
function cmp(oldJs, newTs, imported = new Map(), importedNow = new Map()) {
  const { results, review, compared } = compareSources(
    legacyDecls(new Map([['01-a.js', oldJs]])),
    [{ file: 'src/lib/a.ts', text: newTs }],
    null,
    imported,
    importedNow,
  );
  return { n: Object.fromEntries(results.map((r) => [r.name, r.diffs.length])), review, compared: [...compared], results };
}

describe('同じと言う物', () => {
  it('整形・括弧・引用符・コメント・型・export の違い', () => {
    const r = cmp(
      `function f(a,b){ const x=(a+b)*2; return g('s',x); }`,
      `// 説明\nexport function f(a: number, b?: number): string {\n  const x = (a + b) * 2; // 型の無い所\n  return g("s", x);\n}\n`,
    );
    expect(r.n).toEqual({ f: 0 });
  });
  it('nth・lookup・must を元の読み方に戻す', () => {
    expect(
      cmp(`function f(a,o,x){ return a[1]+o[k]+x.y; }`, `export function f(a, o, x) { return nth(a, 1) + lookup(o, k) + must(x, 'x').y; }`)
        .n,
    ).toEqual({ f: 0 });
    // 名前にできる文字の鍵は、欄の読み書きと同じ（名前にできない鍵と、名前の鍵は [ ] のまま）
    expect(
      cmp(
        `function f(o){ return o.rapid+o['a-b']+o[k]; }`,
        `export function f(o) { return lookup(o, 'rapid') + lookup(o, 'a-b') + lookup(o, k); }`,
      ).n,
    ).toEqual({
      f: 0,
    });
    expect(cmp(`function f(o){ return o.rapid; }`, `export function f(o) { return lookup(o, 'blade'); }`).n).toEqual({ f: 1 });
    expect(cmp(`function f(o,v){ o.lord=v; }`, `export function f(o, v) { o['lord'] = v; }`).n).toEqual({ f: 0 });
    expect(cmp(`function f(o,v){ o['a-b']=v; }`, `export function f(o, v) { o.ab = v; }`).n).not.toEqual({ f: 0 });
  });
  it('cssOf(c) は、./color.ts から読んだ時だけ css(c) に戻す（ほかの関数の名前や、引数の違いは戻さない）', () => {
    const imp = `import { cssOf } from './color.ts';\n`;
    expect(cmp(`function f(r){ return css(runeCol(r)); }`, `${imp}export function f(r) { return cssOf(runeCol(r)); }`).n).toEqual({ f: 0 });
    expect(cmp(`function f(r){ return css(runeCol(r)); }`, `${imp}export function f(r) { return cssOf(elemCol(r)); }`).n).toEqual({ f: 1 });
    expect(cmp(`function f(r){ return hsl(runeCol(r)); }`, `${imp}export function f(r) { return cssOf(runeCol(r)); }`).n).toEqual({ f: 1 });
    // 自分で定めた cssOf や、別のファイルから読んだ cssOf には当てない
    expect(
      cmp(`function f(r){ return css(runeCol(r)); }`, `const cssOf = (c) => hsl(c);\nexport function f(r) { return cssOf(runeCol(r)); }`).n,
    ).toEqual({ f: 1 });
    expect(
      cmp(
        `function f(r){ return css(runeCol(r)); }`,
        `import { cssOf } from './other.ts';\nexport function f(r) { return cssOf(runeCol(r)); }`,
      ).n,
    ).toEqual({ f: 1 });
  });
  it('level() は、そのファイルの level が () => must(here.D, …) の時だけ here.D に戻す', () => {
    const old = `function f(){ return here.D.stairs; }`;
    expect(cmp(old, `const level = () => must(here.D, '今の階');\nexport function f() { return level().stairs; }`).n).toEqual({ f: 0 });
    expect(cmp(old, `const level = () => here.D;\nexport function f() { return level().stairs; }`).n).toEqual({ f: 1 });
  });
  it('?? NaN は、算術・大小の比べ方・単項の -・Math.* の中だけ外す', () => {
    expect(
      cmp(
        `function f(a,b){ return [a*2, a<b, -a, Math.max(a,1), a+1]; }`,
        `export function f(a, b) { return [(a ?? NaN) * 2, (a ?? NaN) < b, -(a ?? NaN), Math.max(a ?? NaN, 1), (a ?? NaN) + 1]; }`,
      ).n,
    ).toEqual({ f: 0 });
  });
  it('Number(x) は、算術の中だけ外す', () => {
    expect(cmp(`function f(a,dt){ return (a||0)-dt; }`, `export function f(a, dt) { return Number(a || 0) - dt; }`).n).toEqual({ f: 0 });
  });
  it('a op= b と a = a op b', () => {
    expect(cmp(`function f(o,dt){ o.t-=dt; o.n+=1; }`, `export function f(o, dt) { o.t = (o.t ?? NaN) - dt; o.n += 1; }`).n).toEqual({
      f: 0,
    });
  });
  it('先に読む（const D = here.D、const [a, b] = 式）は戻し、新しく足した物だけを人が確かめる一覧に出す', () => {
    const r = cmp(
      `function f(E,i){ const c=here.col; g(here.D.x, here.D.y, E[i][0], E[i][1], c); }`,
      `export function f(E, i) { const D = here.D, c = here.col; const [a, b] = nth(E, i); g(D.x, D.y, a, b, c); }`,
    );
    expect(r.n).toEqual({ f: 0 });
    expect(r.review).toEqual(['f：D = here.D', 'f：[a, b] = E[i]']);
  });
  it('使わない引数の頭の _ と、ファイルの一番外の別名', () => {
    const r = cmp(
      `function f(t,dt){ return SPECIALS[dt]; }`,
      `const specials: Record<string, number> = SPECIALS;\nexport function f(_t: number, dt: number) { return specials[dt]; }`,
    );
    expect(r.n).toEqual({ f: 0 });
    expect(r.review).toEqual(['a.ts の一番外：specials = SPECIALS']);
  });
  it('残りの引数の型（...a: unknown[]）', () => {
    expect(cmp(`function f(...a){ return g(...a); }`, `export function f(...a: unknown[]): unknown { return g(...a); }`).n).toEqual({ f: 0 });
  });
  it('使わない catch の引数', () => {
    expect(cmp(`function f(){ try{ g(); }catch(e){} }`, `export function f() { try { g(); } catch {} }`).n).toEqual({ f: 0 });
  });
  it('ファイルの小さな道具（const 名前 = (引数) => 式）は、使う所で開く', () => {
    const r = cmp(
      `function f(m){ return Math.hypot(m.x-player.x,m.z-player.z)+SND.ctx.currentTime; }`,
      `const toPlayer = (m: M): number => Math.hypot(m.x - player.x, m.z - player.z);\nconst now = (): number => must(SND.ctx, '音').currentTime;\nexport function f(m) { return toPlayer(m) + now(); }`,
    );
    expect(r.n).toEqual({ f: 0 });
    expect(r.review).toEqual(['a.ts の道具を開いた：toPlayer', 'a.ts の道具を開いた：now']);
  });
  it('古い方も同じ名前で読んでいて、古い JS がこのファイルから import している道具（このファイルが export する物）は開かない', () => {
    const r = cmp(
      `function f(){ if(!sndReady())return; g(); }`,
      `export const sndReady = (): boolean => SND.on;\nexport function f() { if (!sndReady()) return; g(); }`,
      new Map([['sndReady', 'src/lib/a.ts']]),
    );
    expect(r.n).toEqual({ f: 0 });
    expect(r.review).toEqual([]);
  });
  it('型だけの書き方（as const・後ろの !）と、名前の ?', () => {
    expect(
      cmp(
        `const T=['a','b']; function f(x){ return x.y; }`,
        `export const T = ['a', 'b'] as const;\nexport function f(x?: { y: number }) { return x!.y; }`,
      ).n,
    ).toEqual({ T: 0, f: 0 });
  });
});

describe('違うと言う物', () => {
  const old = `function f(L,t,dt){ for(const a of L){ if(a.d<2.3)g(a); } for(const b of M){ h(b,mr(),mr()*2); } t+=dt; }`;
  it('抜けた文（2つ目のループ）', () => {
    expect(cmp(old, `export function f(L, t, dt) { for (const a of L) { if (a.d < 2.3) g(a); } t += dt; }`).n).toEqual({ f: 1 });
  });
  it('係数・比べ方・乱数を引く順番', () => {
    expect(cmp(old, old.replace('2.3', '2.2')).n).toEqual({ f: 1 });
    expect(cmp(old, old.replace('a.d<2.3', 'a.d<=2.3')).n).toEqual({ f: 1 });
    expect(cmp(old, old.replace('h(b,mr(),mr()*2)', 'h(b,mr()*2,mr())')).n.f).toBeGreaterThan(0);
  });
  it('?? NaN を、undefined と NaN で結果が変わりうる所で外した時（=== ・関数に渡す・文字との +）', () => {
    expect(cmp(`function f(a){ return a===undefined; }`, `export function f(a) { return (a ?? NaN) === undefined; }`).n).toEqual({ f: 1 });
    expect(cmp(`function f(a){ g(a); }`, `export function f(a) { g(a ?? NaN); }`).n).toEqual({ f: 1 });
    expect(cmp(`function f(a){ return 'x'+a; }`, `export function f(a) { return 'x' + (a ?? NaN); }`).n).toEqual({ f: 1 });
  });
  it('Number(x) を算術の外で使った時・a?.b と a.b', () => {
    expect(cmp(`function f(a){ g(a||0); }`, `export function f(a) { g(Number(a || 0)); }`).n).toEqual({ f: 1 });
    expect(cmp(`function f(a){ return a?.b; }`, `export function f(a) { return a.b; }`).n).toEqual({ f: 1 });
  });
  it('古い方と同じ名前でも、古い JS が読む物とは別の道具は開く（中身が違えば違いとして出る）', () => {
    const old = `function f(){ if(!sndReady())return; g(); }`,
      mine = new Map([['sndReady', 'src/lib/a.ts']]);
    // export しない、このファイルだけの道具
    expect(
      cmp(old, `const sndReady = (): boolean => SND.on;\nexport function f() { if (!sndReady()) return; g(); }`, mine).n.f,
    ).toBeGreaterThan(0);
    // export しているが、古い JS は別のファイルから読んでいる
    expect(
      cmp(
        old,
        `export const sndReady = (): boolean => SND.on;\nexport function f() { if (!sndReady()) return; g(); }`,
        new Map([['sndReady', 'src/lib/audio.ts']]),
      ).n.f,
    ).toBeGreaterThan(0);
    // 古い JS が import で読んでいない
    expect(
      cmp(old, `export const sndReady = (): boolean => SND.on;\nexport function f() { if (!sndReady()) return; g(); }`).n.f,
    ).toBeGreaterThan(0);
  });
  it('小さな道具に、呼び出しを渡している時と、使う所で道具の中の名前を宣言し直している時は開かない', () => {
    const helper = `const toPlayer = (m) => Math.hypot(m.x - player.x, m.z - player.z);\n`;
    expect(
      cmp(`function f(){ return Math.hypot(g().x-player.x,g().z-player.z); }`, `${helper}export function f() { return toPlayer(g()); }`).n
        .f,
    ).toBeGreaterThan(0);
    expect(
      cmp(
        `function f(m,player){ return Math.hypot(m.x-player.x,m.z-player.z); }`,
        `${helper}export function f(m, player) { return toPlayer(m); }`,
      ).n.f,
    ).toBeGreaterThan(0);
  });
  it('先に読んだ名前を、後で書き換えている時は戻さない', () => {
    const r = cmp(`function f(){ g(here.D.x); }`, `export function f() { const D = here.D; D = 1; g(D.x); }`);
    expect(r.n.f).toBeGreaterThan(0);
    expect(r.review).toEqual([]);
  });
  it('?? NaN を、文字かもしれない物との + で外した時（もう片方が数と分かる時だけ外す）', () => {
    expect(cmp(`function f(s,a){ return s+a; }`, `export function f(s, a) { return s + (a ?? NaN); }`).n).toEqual({ f: 1 });
    expect(cmp(`function f(a,b){ return a+b*2; }`, `export function f(a, b) { return (a ?? NaN) + b * 2; }`).n).toEqual({ f: 0 });
  });
  it('頭に _ の付いた引数で、本体が外の同じ名前を読んでいる時は、名前を戻さない', () => {
    expect(cmp(`function f(t){ return t; }`, `export function f(_t) { return t; }`).n.f).toBeGreaterThan(0);
  });
  it('一番外の別名と同じ名前を、関数の中で宣言し直している時は戻さない', () => {
    const r = cmp(
      `function f(SPECIALS){ return SPECIALS+SPECIALS; }`,
      `const sp = SPECIALS;\nexport function f(sp) { return sp + SPECIALS; }`,
    );
    expect(r.n.f).toBeGreaterThan(0);
  });
  it('欄を読んだり呼び出したりするオブジェクトは、先に読む書き換えとして戻さない', () => {
    expect(
      cmp(`function f(){ g(); return {t: clock.time}[k]; }`, `export function f() { const at = { t: clock.time }; g(); return at[k]; }`).n
        .f,
    ).toBeGreaterThan(0);
  });
  it('古い方の先読みを、新しい方でやめた物も、人が確かめる一覧に出す', () => {
    const r = cmp(`function f(o){ const c=o.col; g(); h(c); }`, `export function f(o) { g(); h(o.col); }`);
    expect(r.n).toEqual({ f: 0 });
    expect(r.review).toEqual(['f：c = o.col（古い方の先読みを、やめた）']);
  });
  it('両方にある先読みでも、書き込みの前後で位置が変わった時（レビューの指摘）', () => {
    expect(
      cmp(`function f(x){ here.D = x; const D = here.D; use(D); }`, `export function f(x) { const D = here.D; here.D = x; use(D); }`).n.f,
    ).toBeGreaterThan(0);
    expect(
      cmp(`function f(it){ it.v = 1; const c = it.v; g(c); }`, `export function f(it) { const c = it.v; it.v = 1; g(c); }`).n.f,
    ).toBeGreaterThan(0);
    // 同じ位置なら同じ
    expect(
      cmp(`function f(x){ here.D = x; const D = here.D; use(D); }`, `export function f(x) { here.D = x; const D = here.D; use(D); }`).n,
    ).toEqual({ f: 0 });
  });
  it('置き換える式の中の名前が、内側の宣言に捕まる時（レビューの指摘）', () => {
    expect(
      cmp(`function f(L){ return L.map((o) => o.p + o); }`, `export function f(L) { const q = o.p; return L.map((o) => q + o); }`).n.f,
    ).toBeGreaterThan(0);
    const helper = `const toPlayer = (m) => Math.hypot(m.x - player.x, m.z - player.z);\n`,
      oldHypot = 'Math.hypot(m.x-player.x,m.z-player.z)';
    expect(
      cmp(
        `function f(list){ return list.map(({player, m}) => ${oldHypot}); }`,
        `${helper}export function f(list) { return list.map(({ player, m }) => toPlayer(m)); }`,
      ).n.f,
    ).toBeGreaterThan(0);
    expect(
      cmp(
        `function f(m){ try{ g(); }catch(player){ return ${oldHypot}; } }`,
        `${helper}export function f(m) { try { g(); } catch (player) { return toPlayer(m); } }`,
      ).n.f,
    ).toBeGreaterThan(0);
    // 渡す値の名前を、道具の中で宣言し直している
    expect(
      cmp(
        `function f(L,p){ return L.map((p) => p + p); }`,
        `const add = (L, q) => L.map((p) => p + q);\nexport function f(L, p) { return add(L, p); }`,
      ).n.f,
    ).toBeGreaterThan(0);
  });
  it('一番外の別名が let の時と、書き換えている時は戻さない（レビューの指摘）', () => {
    expect(cmp(`function g(){ return INIT; }`, `let mode = INIT;\nexport function g() { return mode; }`).n.g).toBeGreaterThan(0);
    expect(
      cmp(
        `function g(){ return INIT; } function s(m){ INIT = m; }`,
        `const mode = INIT;\nexport function g() { return mode; }\nexport function s(m) { mode = m; }`,
      ).n.g,
    ).toBeGreaterThan(0);
  });
  it('ループの中で使うオブジェクトの別名は戻さない。一覧にはオブジェクトの中身を出す（レビューの指摘）', () => {
    expect(
      cmp(`function f(L){ for (const x of L) g(x, {n: 0}); }`, `export function f(L) { const o = { n: 0 }; for (const x of L) g(x, o); }`).n
        .f,
    ).toBeGreaterThan(0);
    const r = cmp(`function f(k){ return {a: 1, b: 2}[k]; }`, `export function f(k) { const at = { a: 1, b: 2 }; return at[k]; }`);
    expect([r.n, r.review]).toEqual([{ f: 0 }, ['f：at = { a: 1, b: 2 }']]);
  });
  it('?? NaN どうしの + では外さない（レビューの指摘）', () => {
    expect(cmp(`function f(a,b){ return a + b; }`, `export function f(a, b) { return (a ?? NaN) + (b ?? NaN); }`).n).toEqual({ f: 2 });
  });
  it('BigInt の数でも止まらない', () => {
    expect(cmp(`function f(){ return 1n; }`, `export function f() { return 1n; }`).n).toEqual({ f: 0 });
    expect(cmp(`function f(){ return 1n; }`, `export function f() { return 2n; }`).n).toEqual({ f: 1 });
  });
  it('小さな道具の引数は、まとめて置き換える（/code-review の指摘）', () => {
    const helper = `const sub = (a: number, b: number): number => a - b;\n`;
    expect(cmp(`function f(a,b){ return b-a; }`, `${helper}export function f(a, b) { return sub(b, a); }`).n).toEqual({ f: 0 });
    expect(cmp(`function f(a,b){ return a-a; }`, `${helper}export function f(a, b) { return sub(b, a); }`).n.f).toBeGreaterThan(0);
  });
  it('先に読む式が読む名前を、その先で書き換えている時は戻さない（/code-review の指摘）', () => {
    expect(
      cmp(`function f(o,i){ i++; return o[i]+o[i]; }`, `export function f(o, i) { const v = o[i]; i++; return v + o[i]; }`).n.f,
    ).toBeGreaterThan(0);
  });
  it('クラスと、分けて読む形の一番外の宣言も比べる（/code-review の指摘）', () => {
    const r = cmp(
      `const [W0, W1] = SIZES; class Box { f(){ return 1; } }`,
      `export const [W0, W1] = [1, 2];\nexport class Box { f() { return 2; } }`,
    );
    expect([new Set(r.compared), r.n.W0 > 0, r.n.W1 > 0, r.n.Box]).toEqual([new Set(['Box', 'W0', 'W1']), true, true, 1]);
  });
  it('違いの場所（古い文と新しい文の行）を出す', () => {
    const r = cmp(`function f(a){\n  g(a);\n  h(a*2);\n}`, `export function f(a) {\n  g(a);\n  h(a * 3);\n}`);
    expect(r.results[0].diffs).toEqual([{ old: '2', new: '3', oldLine: 3, newLine: 3 }]);
  });
  it('古い JS が今の imports.mjs で別のファイルから読んでいる名前は、このファイルの同じ名前の物とは比べない', () => {
    const old = `function frame(t){ return t+1; }`,
      ts = `const frame = (s: string) => '<b>' + s + '</b>';\nexport function box(s: string) { return frame(s); }\n`;
    expect(cmp(old, ts, new Map(), new Map([['frame', 'src/lib/loop.ts']])).compared).toEqual([]);
    // 読んでいるファイルの物なら比べる
    expect(cmp(old, ts, new Map(), new Map([['frame', 'src/lib/a.ts']])).n).toEqual({ frame: 1 });
  });
  it('古い JS に無い名前は比べない', () => {
    expect(cmp(`function f(){}`, `export function f() {}\nexport function g() { return 1; }`).compared).toEqual(['f']);
  });
});

describe('状態を入れ物に移した名前を見つける（--auto-state）', () => {
  const old = legacyDecls(new Map([['01-a.js', 'let webMsg=false, both=0, unread=1, nobox=2; function draw(){}']]));
  const fields = boxFields(
    `import type { X } from './x.ts';\nexport interface Here { webMsg: boolean }\nexport const here: Here = { webMsg: false, both: 0, unread: 1, draw: 0 };\nexport const ui = { both: 1 };\nexport const msgs: string[] = [];`,
  );
  it('state.ts の入れ物ごとの、初めの値を書いた欄', () => {
    expect([...fields].map(([b, k]) => [b, [...k]])).toEqual([
      ['here', ['webMsg', 'both', 'unread', 'draw']],
      ['ui', ['both']],
    ]);
  });
  it('欄として宣言した変数を見つける（どこからも読まれない状態も）。関数と、どの入れ物の欄でもない名前は見つけない', () => {
    expect(detectStates(old, ['webMsg', 'unread', 'nobox', 'draw'], 'here.webMsg=true;', fields)).toEqual([
      { box: 'here', names: ['webMsg', 'unread'] },
    ]);
  });
  it('同じ名前の欄が2つの入れ物にある時は、今の文で読んでいる入れ物に絞る。決まらなければ見つけない', () => {
    expect(detectStates(old, ['both'], 'ui.both=2; xhere.both=1;', fields)).toEqual([{ box: 'ui', names: ['both'] }]);
    expect(detectStates(old, ['both'], 'here.both=1; ui.both=2;', fields)).toEqual([]);
    expect(detectStates(old, ['both'], '', fields)).toEqual([]);
  });
});

describe('使っていない物を消しただけか（wasUnused）', () => {
  const game = new Map([
    ['01-a.js', 'function dead(x){ return dead(x-1); }\nfunction live(){ return 1; }\nlet flag=0;\n'],
    ['02-b.js', 'live(); o.dead = 1; // live のコメント\n'],
    ['imports.mjs', "import { flag } from './x.ts';\n"],
  ]);
  const old = legacyDecls(game);
  it('自分の宣言の外から使われていない物（自分を呼ぶだけ・欄の名前・imports.mjs は数えない）', () => {
    expect(['dead', 'live', 'flag'].map((n) => wasUnused(game, old, n))).toEqual([true, false, true]);
  });
  it('古い JS に無い名前は「使っていない」と言わない', () => {
    expect(wasUnused(game, old, 'none')).toBe(false);
  });
});

describe('古い JS で、今も名前として使っているか（gameUses）', () => {
  it('一番外の宣言・imports.mjs の名前・どこにも無い名前を指す所だけ（局所の同じ名前・欄の名前・コメント・文字列は数えない）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'same-code-uses-'));
    try {
      writeFileSync(join(dir, 'imports.mjs'), "import { imp } from './x.ts';\n");
      writeFileSync(
        join(dir, '01-a.js'),
        [
          'let top=0;',
          'function f(){ const local=1, gone=2; return {gone, local, top}; }',
          '// gone note',
          "const o={ note: 'gone' }; o.gone=1;",
          'imp(); lost();',
          '',
        ].join('\n'),
      );
      expect([...gameUses(dir, new Set(['top', 'gone', 'note', 'imp', 'lost', 'none']))].sort((a, b) => a.localeCompare(b))).toEqual([
        'imp',
        'lost',
        'top',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('今どこかで使っているか（referenced）', () => {
  it('名前として使っている所だけ（欄の名前 a.foo と、名前の一部は数えない）', () => {
    expect([referenced('foo();', 'foo'), referenced('o.foo = 1; foobar(); xfoo;', 'foo'), referenced('$a + 1', '$a')]).toEqual([
      true,
      false,
      true,
    ]);
    // 名前の中の記号（$）は、正規表現の記号としてでなく、その文字として探す
    expect([referenced('a$b();', 'a$b'), referenced('ab();', 'a$b')]).toEqual([true, false]);
  });
});
