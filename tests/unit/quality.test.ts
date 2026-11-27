// src/lib/quality.ts の単体テスト（速さに合わせて画質を下げる段の決め方と、下げても速くならない時に戻すか）
import { describe, expect, it } from 'vitest';
import { QUALITY, nextQuality, stepQuality, type Quality, type QualityRun } from '../../src/lib/quality.ts';

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

/** 平均の並び avgs を順に渡し、画質の移り変わりを [細かさ, 光のにじみ] で返す */
function run(avgs: number[], q: Quality = { pr: 1.5, bloom: true }): [number, boolean][] {
  let r: QualityRun = { q, prev: null, done: false };
  return avgs.map((avg) => {
    r = stepQuality(avg, r);
    return [r.q.pr, r.q.bloom];
  });
}

describe('stepQuality', () => {
  it('書き換えが30回に抑えられた端末（低電力モードの iPhone）は、1段下げて速くならなければ戻し、それからは変えない', () => {
    expect(run([1 / 30, 1 / 30, 1 / 30, 1 / 30, 1 / 30])).toEqual([
      [1.3, true],
      [1.5, true],
      [1.5, true],
      [1.5, true],
      [1.5, true],
    ]);
  });
  it('下げて速くなるなら、今までどおり下限まで下げる', () => {
    // 1段ごとにフレームの時間が1割より多く縮み、下限に着くまでは遅い
    const avgs = [0.06, 0.048, 0.0384, 0.0307, 0.0246, 0.0216, 0.0173];
    expect(run(avgs)).toEqual([
      [1.3, true],
      [1.1, true],
      [1, true],
      [1, false],
      [0.8, false],
      [0.75, false],
      [0.75, false],
    ]);
  });
  it('途中の段が効かなければ、その1段だけ戻して止める', () => {
    expect(run([0.05, 0.04, 0.039, 0.02])).toEqual([
      [1.3, true],
      [1.1, true],
      [1.3, true],
      [1.3, true],
    ]);
  });
  it('下げて速くなり、もう遅くなければ、そこで止める（後でまた遅くなれば下げる）', () => {
    expect(run([0.03, fast, fast, slow])).toEqual([
      [1.3, true],
      [1.3, true],
      [1.3, true],
      [1.1, true],
    ]);
  });
  it('縮みがちょうど gain の割合なら、効かなかったと見る', () => {
    const a = 0.04;
    expect(run([a, a * (1 - QUALITY.gain)])).toEqual([
      [1.3, true],
      [1.5, true],
    ]);
  });
});
