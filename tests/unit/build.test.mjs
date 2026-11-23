// tools/build.mjs の単体テスト：ゲーム本体をつなぐ処理と、行の対応
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assemble, gameLayout, gameParts, gameSource, locate, locateInPage, MARK } from '../../tools/build.mjs';

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
  it('markers を付けると、ファイルの境目に印の行が入る', () => {
    const dir = fixture({ '00-a.js': 'a1\n', '01-b.js': 'b1\n' });
    expect(gameSource({ dir, markers: true })).toContain(`${MARK}src/game/01-b.js =====\nb1\n`);
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

describe('locateInPage', () => {
  const page = assemble(),
    lines = page.split('\n');
  it('組み立てたページのゲーム本体の行は、元のファイルの行に戻る', () => {
    for (let n = 1; n <= lines.length; n += 97) {
      const r = locateInPage(page, n);
      if (r.file) expect(readFileSync(join(ROOT, r.file), 'utf8').split('\n')[r.line - 1]).toBe(lines[n - 1]);
    }
  });
  it('head・印の行・包みの後ろ・範囲外は「外」と答える', () => {
    expect(locateInPage(page, 1)).toEqual({ outside: 'head' });
    expect(locateInPage(page, lines.findIndex((l) => l.startsWith(MARK)) + 1)).toEqual({ outside: 'marker' });
    expect(locateInPage(page, lines.indexOf('</body>') + 1)).toEqual({ outside: 'tail' });
    expect(locateInPage(page, lines.length + 5)).toEqual({ outside: 'range' });
  });
});
