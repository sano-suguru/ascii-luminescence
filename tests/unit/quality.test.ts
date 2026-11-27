// src/lib/quality.ts の単体テスト（速さに合わせて画質を下げる段の決め方）
import { describe, expect, it } from 'vitest';
import { QUALITY, nextQuality, type Quality } from '../../src/lib/quality.ts';

const slow = 1 / 30,
  fast = 1 / 60;

describe('nextQuality', () => {
  it('速ければ変えない（ちょうど 48fps も）', () => {
    expect(nextQuality(fast, { pr: 1.5, bloom: true })).toBeNull();
    expect(nextQuality(QUALITY.slow, { pr: 1.5, bloom: true })).toBeNull();
    expect(nextQuality(Number.NaN, { pr: 1.5, bloom: true })).toBeNull();
  });
  it('遅ければ、描く細かさを 1 まで下げ、次に光のにじみを切り、最後に下限まで下げ、それ以上は変えない', () => {
    let q: Quality = { pr: 1.5, bloom: true };
    const steps: Quality[] = [];
    for (let n = 0; n < 10; n++) {
      const next = nextQuality(slow, q);
      if (!next) break;
      steps.push(next);
      q = next;
    }
    expect(steps.map((s) => [s.pr, s.bloom])).toEqual([
      [1.3, true],
      [1.1, true],
      [1, true],
      [1, false],
      [0.8, false],
      [0.75, false],
    ]);
  });
  it('画素の比が 1 の端末は、まず光のにじみを切る。下限より細かさが低い端末は、細かさを上げない', () => {
    expect(nextQuality(slow, { pr: 1, bloom: true })).toEqual({ pr: 1, bloom: false });
    expect(nextQuality(slow, { pr: 0.6, bloom: false })).toBeNull();
    expect(nextQuality(slow, { pr: QUALITY.floor, bloom: false })).toBeNull();
  });
});
