// 速さに合わせて画質を下げる（遅い端末、主にスマホのため）。src/game/30-loop-init.js の frame が、探索中のフレームの時間を集めて呼ぶ。
// 一定の間の平均が遅ければ、描く細かさ（画素の比）を1段下げ、下限まで下げても遅ければ、光のにじみ（ブルーム）を切る。
// 下げるだけで上げない。下げた段は保存しない（毎回、数秒で同じ所まで下がるため）。テスト用モードでは呼ばない（画面写真を同じにするため）

/** 下げ方の決まり：平均がこれより長いと遅い（秒。48fps）・数える間（秒）・1回で下げる量・描く細かさの下限 */
export const QUALITY = { slow: 1 / 48, span: 2.5, step: 0.2, floor: 0.5 };

/** 今の画質 */
export interface Quality {
  /** 描く細かさ（画素の比） */
  pr: number;
  /** 光のにじみを描くか */
  bloom: boolean;
}

/** 平均のフレームの時間 avg（秒）から、次の画質を決める。変えない時は null */
export function nextQuality(avg: number, q: Quality): Quality | null {
  if (!(avg > QUALITY.slow)) return null;
  // 100分の1に丸める（0.2 ずつ引くと、小数の誤差で下限のすぐ上に止まり、もう1段かかるため）
  if (q.pr > QUALITY.floor) return { pr: Math.max(QUALITY.floor, Math.round((q.pr - QUALITY.step) * 100) / 100), bloom: q.bloom };
  if (q.bloom) return { pr: q.pr, bloom: false };
  return null;
}
