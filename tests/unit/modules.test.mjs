// src/lib のどのモジュールも、ほかより先に1つだけ読んで止まらないか（読み込みが輪になって、まだ作っていない値を使っていないか）。
// 組み立てた JS では、モジュールの並びがたまたま合えば、輪があっても止まらずに動く（値が黙って空になることもある）ので、ファイルごとに別の Node で読んで確かめる。
import { execFile } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

const run = promisify(execFile),
  LIB = join(import.meta.dirname, '../../src/lib'),
  files = readdirSync(LIB, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts'))
    .sort();

it('src/lib のどのモジュールも、単独で読める', async () => {
  const bad = [];
  await Promise.all(
    files.map(async (f) => {
      try {
        await run(process.execPath, [
          '--no-warnings',
          '--input-type=module',
          '-e',
          `await import(${JSON.stringify(pathToFileURL(join(LIB, f)).href)});`,
        ]);
      } catch (e) {
        bad.push(
          `${f}：${
            String(e.stderr)
              .split('\n')
              .find((l) => /Error/.test(l)) ?? String(e)
          }`,
        );
      }
    }),
  );
  expect(files.length).toBeGreaterThan(30);
  expect(bad).toEqual([]);
}, 60000);
