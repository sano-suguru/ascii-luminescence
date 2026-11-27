// src/lib/quality.ts の単体テスト（速さに合わせて画質を下げる段の決め方）
import { describe, expect, it } from 'vitest';
import { QUALITY, nextQuality, planQuality, type Quality, type QualityTry } from '../../src/lib/quality.ts';

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

describe('planQuality', () => {
  /** 画質 q の時の平均のフレームの時間 at(q) を返す端末で、何回か決めさせ、変えた先と止まったかを並べる */
  const run = (at: (q: Quality) => number, n = 10): { steps: [number, boolean][]; stop: boolean; q: Quality } => {
    let q: Quality = { pr: 1.5, bloom: true },
      tried: QualityTry | null = null,
      stop = false;
    const steps: [number, boolean][] = [];
    for (let i = 0; i < n && !stop; i++) {
      const p = planQuality(at(q), q, tried);
      tried = p.tried;
      stop = p.stop;
      if (p.q) {
        q = p.q;
        steps.push([q.pr, q.bloom]);
      }
    }
    return { steps, stop, q };
  };
  it('描く回数が 30 に抑えられた端末（下げても 30fps のまま）：1段だけ試して、元に戻して止める', () => {
    const r = run(() => 1 / 30);
    expect(r.steps).toEqual([
      [1.3, true],
      [1.5, true],
    ]);
    expect(r.stop).toBe(true);
    expect(r.q).toEqual({ pr: 1.5, bloom: true });
  });
  it('光のにじみを切っても速くならなければ、光のにじみを戻して止める（描く細かさは、速くなった所まで下げたまま）', () => {
    // 描く画素の数に比べて遅い：細かさを下げると速くなるが、光のにじみは関係ない
    const r = run((q) => (1 / 15) * (q.pr / 1.5) ** 2);
    expect(r.steps).toEqual([
      [1.3, true],
      [1.1, true],
      [1, true],
      [1, false],
      [1, true],
    ]);
    expect(r.stop).toBe(true);
  });
  it('下げるたびに速くなる端末：nextQuality と同じく下限まで下げる', () => {
    const r = run((q) => (1 / 8) * (q.pr / 1.5) ** 2 * (q.bloom ? 1.3 : 1));
    expect(r.steps).toEqual([
      [1.3, true],
      [1.1, true],
      [1, true],
      [1, false],
      [0.8, false],
      [0.75, false],
    ]);
  });
  it('下げて速くなり、十分に速くなったら、それより後は変えない（止めはしない）', () => {
    const p = planQuality(1 / 55, { pr: 1.3, bloom: true }, { from: { pr: 1.5, bloom: true }, avg: 1 / 40 });
    expect(p).toEqual({ q: null, tried: null, stop: false });
    expect(QUALITY.gain).toBeGreaterThan(1);
  });
});
