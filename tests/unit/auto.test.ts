// 自動で遊ぶ（src/lib/auto.ts）の単体テスト：URL の読み方
import { describe, expect, it } from 'vitest';
import { AUTO_STEPS, autoMode } from '../../src/lib/auto.ts';

describe('自動で遊ぶ', () => {
  it('?auto の読み方', () => {
    expect(autoMode('?auto=1')).toEqual({ laps: 1, quick: false });
    expect(autoMode('?auto=3&x=1')).toEqual({ laps: 3, quick: false });
    expect(autoMode('?auto=quick')).toEqual({ laps: 1, quick: true });
    for (const s of ['', '?auto', '?auto=', '?auto=0', '?auto=10', '?auto=yes', '?test=1']) expect(autoMode(s).laps).toBe(0);
  });
  it('台本の段の並び（tests/auto.mjs と tools/auto-run.mjs が名前で比べる）', () => {
    expect(AUTO_STEPS.map(([k]) => k)).toEqual(['enter', 'walk', 'look', 'fight', 'stairs', 'menu', 'pack', 'die']);
  });
});
