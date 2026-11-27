// 診断の記録の表（tools/diag-report.mjs）の単体テスト：メニューの押し方の数え方・画質の移り変わり・自動で遊んだ段の比べ方
import { describe, expect, it } from 'vitest';
import { compareRows, menuRows, qualitySteps } from '../../tools/diag-report.mjs';

describe('メニューの押し方', () => {
  it('すぐ別の項目を押した回数と、切り替えを押し戻した回数を数える', () => {
    const rows = menuRows([
      { t: 1, k: 'chron', prev: null, dt: null },
      { t: 1.6, k: 'book', prev: 'chron', dt: 0.6 }, // すぐ別の項目
      { t: 9, k: 'ui', prev: 'book', dt: 7.4 }, // 間があいている
      { t: 9.8, k: 'ui', prev: 'ui', dt: 0.8 }, // 切り替えを押し戻した
      { t: 11.3, k: 'ui', prev: 'ui', dt: 1.5 }, // ちょうど境（数える）
      { t: 12.9, k: 'resume', prev: 'ui', dt: 1.6 }, // 境を越える
    ]);
    expect(rows[0]).toBe('メニューの押し方：6 回（chron 1・book 1・ui 3・resume 1）');
    expect(rows[1]).toBe('  1.5秒以内に別の項目：1 回（chron→book 0.6秒）');
    expect(rows[2]).toBe('  1.5秒以内に押し戻した：2 回（ui 0.8秒・ui 1.5秒）');
    expect(rows[3]).toBe('  押す間の秒：0.6 7.4 0.8 1.5 1.6');
  });
  it('切り替えでない項目を続けて押したのは、押し戻しに数えない・記録の無い古い版は何も出さない', () => {
    const rows = menuRows([
      { t: 1, k: 'new', prev: null, dt: null },
      { t: 1.5, k: 'new', prev: 'new', dt: 0.5 },
    ]);
    expect(rows[1]).toBe('  1.5秒以内に別の項目：0 回');
    expect(rows[2]).toBe('  1.5秒以内に押し戻した：0 回');
    expect(menuRows(undefined)).toEqual([]);
    expect(menuRows([])).toEqual(['メニューの押し方：押していない']);
  });
});

describe('画質と、自動で遊んだ段', () => {
  // 本物の iPhone（低電力モード）の記録の形：1段下げて、速くならずに戻した
  const took = [
    { t: 0.1, k: 'applySize', why: 'init', pr: 1.5 },
    { t: 9.8, k: 'applySize', why: 'auto', pr: 1.3 },
    { t: 12, k: 'newLevel', ms: 130 },
    { t: 13, k: 'quality', why: 'auto', bloom: false },
    { t: 15.3, k: 'applySize', why: 'back', pr: 1.5 },
  ];
  it('画質を変えた物だけを、理由と一緒に並べる（init と resize は数えない）', () => {
    expect(qualitySteps(took).map((x) => `${x.why} ${x.what}`)).toEqual(['auto 解像度 1.3', 'auto 光のにじみ なし', 'back 解像度 1.5']);
    expect(qualitySteps(undefined)).toEqual([]);
  });
  it('前と今を、周と段の名前で合わせて並べる（前に無い段は -）', () => {
    const step = (lap, k, avg, worst, slow) => ({ lap, k, avg, worst, slow });
    const prev = { took: [], auto: { steps: [step(1, 'walk', 30, 120, 2)] } };
    const cur = { took, auto: { steps: [step(1, 'walk', 29.5, 90, 0), step(1, 'look', 30, 40, 0)] } };
    const rows = compareRows(prev, cur);
    expect(rows[2]).toMatch(/^ {2}1 +walk +30 → 29\.5 +120 → 90 +2 → 0$/);
    expect(rows[3]).toMatch(/^ {2}1 +look +- → 30 +- → 40 +- → 0$/);
    expect(rows.at(-2)).toContain('前 変えていない');
    expect(rows.at(-1)).toContain('今 auto 解像度 1.3 → auto 光のにじみ なし → back 解像度 1.5');
  });
});
