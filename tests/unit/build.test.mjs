// 組み立ての単体テスト：ソースマップを読む道具（tools/sourcemap.mjs）と、Vite の組み立て（公開用と同じ設定）、src/ の書き方
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeMappings, findMap, originalPosition } from '../../tools/sourcemap.mjs';

const ROOT = join(import.meta.dirname, '../..');
// src/lib/ の .ts を全部つないだ文
const libText = () =>
  readdirSync(join(ROOT, 'src/lib'), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => readFileSync(join(ROOT, 'src/lib', f), 'utf8'))
    .join('\n');

describe('ソースマップ', () => {
  it('mappings を読み、区切りを絶対値にする（負の差・大きな値・空の行も）', () => {
    // 区切りは前の区切りからの差で書く（生成の列だけは行ごとに0から）
    expect(decodeMappings(';AAAA,OAAO;GCwCL;;AAAA,gqjGDtC6pjG')).toEqual([
      [],
      [
        [0, 0, 0, 0],
        [7, 0, 0, 7],
      ],
      [[3, 1, 40, 2]],
      [],
      [
        [0, 1, 40, 2],
        [100000, 0, 2, 99999],
      ],
    ]);
  });
  it('originalPosition は、直前の区切りから列を数える。対応の無い行は null、範囲の外は undefined', () => {
    const map = { sources: ['a.ts', 'b.ts'], mappings: ';AAAA,OAAO;GCwCL;' };
    expect(originalPosition(map, 2, 9)).toEqual({ source: 'a.ts', line: 1, column: 9 });
    expect(originalPosition(map, 3, 3)).toEqual({ source: 'b.ts', line: 41, column: 2 });
    expect(originalPosition(map, 1, 0)).toBeNull();
    expect(originalPosition(map, 9, 0)).toBeUndefined();
  });
});

describe('Vite の組み立て（公開用と同じ設定）', () => {
  it('ソースマップを出力に残さず、関数を1つも消さず、組み立てた JS の名前が src/lib の同じ名前に戻る', async () => {
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
      expect(code).not.toContain('html_proxy'); // ページの <style> の空の部品（noCssStub）
      expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain('--void:#030209'); // <style> は HTML に残っている
      // ホーム画面に置ける（homeScreen）：宣言とアイコンを出し、HTML から読む
      const html = readFileSync(join(out, 'index.html'), 'utf8'),
        mf = JSON.parse(readFileSync(join(out, 'manifest.webmanifest'), 'utf8'));
      expect(html).toContain('<link rel="manifest" href="./manifest.webmanifest">');
      expect(html).toContain('<link rel="apple-touch-icon" href="./icon-192.png">');
      expect(mf.display).toBe('standalone');
      for (const ic of mf.icons) expect(readFileSync(join(out, ic.src)).subarray(1, 4).toString()).toBe('PNG');
      const map = findMap(js, maps),
        lines = code.split('\n'),
        cache = {};
      // 元のファイルは、ゲーム（src/main.js と src/lib/）と、npm の three.js だけ
      const OURS = /^src\/main\.js$|^src\/lib\/[a-z0-9/-]+\.ts$/,
        THREE_SRC = /^node_modules\/(\.pnpm\/three@[^/]+\/node_modules\/)?three\//; // 版は問わない（patch の更新で落ちないように）
      expect(map.sources.filter((f) => !OURS.test(f) && !THREE_SRC.test(f))).toEqual([]);
      expect(map.sources).toContain('src/lib/text.ts');
      expect(map.sources.some((f) => THREE_SRC.test(f))).toBe(true);
      // 関数の名前（function xx）は、元のファイルの同じ場所に戻る。src/lib/ の関数の名前を集める（three.js の物は除く）
      let checked = 0;
      const ours = [];
      lines.forEach((l, i) => {
        for (const m of l.matchAll(/function ([A-Za-z_$][\w$]*)/g)) {
          const at = m.index + 9,
            p = originalPosition(map, i + 1, at);
          if (!p) throw new Error(`組み立てた JS の ${i + 1} 行目の function ${m[1]} に、元の場所が無い`);
          if (THREE_SRC.test(p.source)) continue;
          const src = (cache[p.source] ??= readFileSync(join(ROOT, p.source), 'utf8').split('\n'))[p.line - 1];
          expect(src.slice(p.column, p.column + m[1].length)).toBe(m[1]);
          ours.push(m[1]);
          checked++;
        }
      });
      expect(checked).toBeGreaterThan(300);
      // 使っていない関数も消さない（消すかどうかは人が決める。vite.config.mjs の rolldownOptions）
      const sorted = (a) => a.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
      expect(sorted(ours)).toEqual(sorted([...libText().matchAll(/function\s+([A-Za-z_$][\w$]*)/g)].map((x) => x[1])));
    } finally {
      process.env.NODE_ENV = env;
      rmSync(out, { recursive: true, force: true });
      rmSync(maps, { recursive: true, force: true });
    }
  }, 60000);
});

describe('src/ の書き方', () => {
  // でたらめな値を返す比べる関数での並べ替え（.sort(() => rand() - 0.5)）は、エンジンと最適化の段階で並びが変わる。混ぜるのは shuffle で
  it('src/ に、でたらめな比べる関数での並べ替えが無い', () => {
    const root = join(ROOT, 'src');
    const bad = readdirSync(root, { recursive: true })
      .map(String)
      .filter((f) => /\.(js|ts|mjs)$/.test(f))
      .flatMap((f) =>
        readFileSync(join(root, f), 'utf8')
          .split('\n')
          .flatMap((l, i) => (/\.sort\(\s*\(\s*\)\s*=>/.test(l) && !/^\s*(\/\/|\*)/.test(l) ? [`src/${f}:${i + 1}`] : [])),
      );
    expect(bad).toEqual([]);
  });
});
