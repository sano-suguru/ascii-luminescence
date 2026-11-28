// 特性を名前で読む所（TL(術, '名前')・tv(術, '名前')・wTL(手, '名前')）が、どれも特性の表（src/lib/runes.ts の TRAITS）にある名前かを、
// src/lib/ の .ts を構文の木で調べて確かめる。武器に特性を付ける所（rollTraits・鍛えの祭壇・試しの間・墓のルーン）は TRAITS の名前しか付けないので、
// 表に無い名前を読む所は、ゲームの中ではいつも 0 になる（効かない処理が残る）。
// テストを .mjs で書くのは、構文の木の型を、as を使わずに付けられないため。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseAst } from 'vite';
import { describe, expect, it } from 'vitest';
import { TRAITS } from '../../src/lib/runes.ts';

const ROOT = join(import.meta.dirname, '../..');
const READERS = new Set(['TL', 'tv', 'wTL']);

/**
 * TypeScript の文 text の中の、特性を名前で読む所 [名前か null（名前が文字列でない）, 行]。
 * TL・tv・wTL の定義の中（tv が TL を呼ぶ所）は数えない
 */
export function traitReads(text) {
  const ast = parseAst(text, { lang: 'ts' }),
    out = [];
  const line = (pos) => text.slice(0, pos).split('\n').length;
  const walk = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if ((node.type === 'VariableDeclarator' || node.type === 'FunctionDeclaration') && READERS.has(node.id?.name)) return;
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && READERS.has(node.callee.name)) {
      const a = node.arguments[1];
      out.push([a && a.type === 'Literal' && typeof a.value === 'string' ? a.value : null, line(node.start)]);
    }
    for (const v of Object.values(node))
      if (Array.isArray(v)) for (const c of v) walk(c);
      else if (v && typeof v === 'object') walk(v);
  };
  walk(ast);
  return out;
}

describe('特性の名前', () => {
  it('src/ の中で特性を名前で読む所は、全部 TRAITS にある（名前は文字列で書く）', () => {
    const known = new Set(Object.values(TRAITS).flatMap((t) => Object.keys(t))),
      files = readdirSync(join(ROOT, 'src/lib'), { recursive: true })
        .map(String)
        .filter((f) => f.endsWith('.ts'))
        .map((f) => `src/lib/${f}`),
      reads = files.flatMap((f) => traitReads(readFileSync(join(ROOT, f), 'utf8')).map(([k, ln]) => [k, `${f}:${ln}`])),
      bad = reads.filter(([k]) => k === null || !known.has(k)).map(([k, at]) => `${k ?? '（文字列でない）'} ${at}`);
    expect(bad).toEqual([]);
    // 調べ方が中身を通っているか：読む所と名前の種類が十分ある（数・ホーミング・跳ね返りは sp.aff で読むので、TL では読まない）
    expect([reads.length > 20, new Set(reads.map(([k]) => k)).size > 12]).toEqual([true, true]);
  });
  it('調べ方：表に無い名前・文字列でない名前を見つける', () => {
    expect(traitReads("const a = TL(sp, 'echo'),\n  b = tv(sp, 'speed');\nwTL(h, k);")).toEqual([
      ['echo', 1],
      ['speed', 2],
      [null, 3],
    ]);
    expect(traitReads("function f(){\n  return TL(p.sp, 'pin') + other(sp, 'x');\n}")).toEqual([['pin', 2]]);
    expect(traitReads('export const tv = (sp, k) => TRAIT_V[k][TL(sp, k)];\nfunction wTL(h, k) { return TL(h, k); }')).toEqual([]);
  });
});
