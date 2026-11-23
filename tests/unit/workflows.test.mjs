// GitHub Actions のワークフローで使うアクションは、コミットのハッシュ（40文字）で固定する。
// タグ（@v1 など）は後から中身を差し替えられるので使わない（Dependabot は、ハッシュで書いた物を上げるだけで、タグをハッシュに直さない）
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(import.meta.dirname, '../../.github/workflows');
const uses = readdirSync(DIR)
  .filter((f) => /\.ya?ml$/.test(f))
  .flatMap((f) =>
    readFileSync(join(DIR, f), 'utf8')
      .split('\n')
      .map((line, i) => ({ f, n: i + 1, m: line.match(/^\s*(?:-\s*)?uses:\s*['"]?([^\s'"#]+)/) }))
      .filter((x) => x.m)
      .map((x) => ({ where: `${x.f}:${x.n}`, ref: x.m[1] })),
  );

describe('GitHub Actions', () => {
  it('ワークフローにアクションがある（このテスト自体が空振りしていない）', () => {
    expect(uses.length).toBeGreaterThan(0);
  });
  it('アクションはすべてコミットのハッシュで固定している', () => {
    const bad = uses.filter((u) => !u.ref.startsWith('./') && !u.ref.startsWith('docker://') && !/@[0-9a-f]{40}$/.test(u.ref));
    expect(bad.map((u) => `${u.where} ${u.ref}`)).toEqual([]);
  });
});
