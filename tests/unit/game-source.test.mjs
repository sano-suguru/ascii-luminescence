// tools/game-source.mjs の単体テスト：ゲーム本体をつなぐ処理と、行の対応・ソースマップ
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gameLayout, gameParts, gameSource, gameSourceMap, gameText, locate } from '../../tools/game-source.mjs';
import { decodeMappings, encodeMappings, findMap, originalPosition } from '../../tools/sourcemap.mjs';

const ROOT = join(import.meta.dirname, '../..');
let tmp;
const fixture = (files) => {
  tmp = mkdtempSync(join(tmpdir(), 'al-game-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(tmp, name), text);
  return tmp;
};
afterEach(() => tmp && rmSync(tmp, { recursive: true, force: true }));

describe('gameSource', () => {
  it('ファイルを名前の順につなぎ、一番外側の関数で包む', () => {
    const dir = fixture({ '10-b.js': 'b1\nb2\n', '00-a.js': 'a1\n' });
    expect(gameSource({ dir })).toBe("(function(){\n'use strict';\na1\nb1\nb2\n})();\n");
  });
  it('改行で終わらないファイルがあれば止める（次のファイルとつながってしまうため）', () => {
    const dir = fixture({ '00-a.js': '// 最後の行がコメント', '01-b.js': 'function f(){}\n' });
    expect(() => gameSource({ dir })).toThrow(/改行で終わっていない/);
  });
  it('「2桁の番号-名前.js」でないファイル名があれば止める（初期化の後ろにつながってしまうため）', () => {
    const dir = fixture({ '00-a.js': 'a\n', 'helpers.js': 'h\n', '9-x.js': 'x\n' });
    expect(() => gameParts(dir)).toThrow(/helpers\.js.*9-x\.js|9-x\.js.*helpers\.js/);
  });
});

describe('locate', () => {
  it('つないだものの全部の行が、元のファイルの同じ中身の行に戻る（本物の src/game）', () => {
    const lines = gameSource().split('\n'),
      layout = gameLayout();
    let checked = 0;
    for (let n = 1; n <= lines.length; n++) {
      const at = locate(n, { layout });
      if (!at) continue;
      expect(readFileSync(join(ROOT, at.file), 'utf8').split('\n')[at.line - 1]).toBe(lines[n - 1]);
      checked++;
    }
    expect(checked).toBe(lines.length - 4); // 包みの2行＋末尾の '})();' と最後の空の行
  });
});

describe('ソースマップ', () => {
  it('mappings の書き方と読み方が往復する（負の差・大きな値も）', () => {
    const lines = [
      [],
      [
        [0, 0, 0, 0],
        [7, 0, 0, 7],
      ],
      [[3, 1, 40, 2]],
      [],
      [
        [0, 0, 1, 0],
        [100000, 1, 2, 99999],
      ],
    ];
    expect(decodeMappings(encodeMappings(lines))).toEqual(lines);
  });
  it('gameSource の語の頭は、元のファイルの同じ行・同じ列に戻る（本物の src/game）', () => {
    const lines = gameSource().split('\n'),
      map = gameSourceMap(),
      cache = {};
    let checked = 0;
    for (let n = 1; n <= lines.length; n += 13)
      for (const m of lines[n - 1].matchAll(/[A-Za-z_$][\w$]*/g)) {
        const p = originalPosition(map, n, m.index);
        if (!p) continue; // 包みの行
        const src = (cache[p.source] ??= readFileSync(p.source, 'utf8').split('\n'))[p.line - 1];
        expect(src.slice(p.column, p.column + m[0].length)).toBe(m[0]);
        checked++;
      }
    expect(checked).toBeGreaterThan(1000);
    const wrap = lines.indexOf('(function(){') + 1;
    expect(wrap).toBeGreaterThan(1); // 包みの前に imports.mjs の import の文がある
    expect(originalPosition(map, wrap, 0)).toBeNull(); // 包みの行
    expect(originalPosition(map, 1, 0)?.source).toMatch(/src\/game\/imports\.mjs$/);
  });
});

describe('Vite の組み立て（公開用と同じ設定）', () => {
  it('ソースマップを出力に残さず、関数を1つも消さず、組み立てた JS の名前が src/game の同じ名前に戻る', async () => {
    const { build } = await import('vite');
    const mode = `unit-${process.pid}`,
      out = join(ROOT, '.build', mode),
      maps = join(ROOT, '.build/maps', mode);
    // Vitest の中では NODE_ENV=test。Vite は NODE_ENV が既にあると上書きしないので、公開用と同じ production にして組み立てる
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({ configFile: join(ROOT, 'vite.config.mjs'), mode, logLevel: 'silent' });
      const files = readdirSync(join(out, 'assets'));
      expect(files.filter((f) => f.endsWith('.map'))).toEqual([]);
      const js = files.find((f) => f.endsWith('.js')),
        code = readFileSync(join(out, 'assets', js), 'utf8');
      expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain(`src="./assets/${js}"`);
      expect(code).not.toContain('sourceMappingURL');
      const map = findMap(js, maps),
        lines = code.split('\n'),
        cache = {};
      // 元のファイルは、ゲーム本体（src/game/）と TypeScript に移した物（src/lib/）だけ
      expect(map.sources.filter((f) => !/^src\/game\/\d{2}-[a-z0-9-]+\.js$|^src\/lib\/[a-z0-9-]+\.ts$/.test(f))).toEqual([]);
      expect(map.sources).toContain('src/lib/text.ts');
      // 関数の名前（function xx）は、元のファイルの同じ場所に戻る
      let checked = 0;
      lines.forEach((l, i) => {
        for (const m of l.matchAll(/function ([A-Za-z_$][\w$]*)/g)) {
          const at = m.index + 9,
            p = originalPosition(map, i + 1, at);
          const src = (cache[p.source] ??= readFileSync(join(ROOT, p.source), 'utf8').split('\n'))[p.line - 1];
          expect(src.slice(p.column, p.column + m[1].length)).toBe(m[1]);
          checked++;
        }
      });
      expect(checked).toBeGreaterThan(300);
      // 使っていない関数も消さない（消すかどうかは人が決める。vite.config.mjs の rolldownOptions）
      const fnNames = (t) =>
        [...t.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)].map((x) => x[1]).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      expect(fnNames(code)).toEqual(fnNames(gameText()));
    } finally {
      process.env.NODE_ENV = env;
      rmSync(out, { recursive: true, force: true });
      rmSync(maps, { recursive: true, force: true });
    }
  }, 60000);
});
