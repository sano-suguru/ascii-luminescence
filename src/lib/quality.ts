// 速さに合わせて画質を下げる（遅い端末、主にスマホのため）。src/game/30-loop-init.js の frame が、探索中のフレームの時間を集めて呼ぶ。
// 一定の間の平均が遅ければ、1段ずつ下げる：描く細かさ（画素の比）を 1 まで → 光のにじみ（ブルーム）を切る → 描く細かさを下限まで。
// 光のにじみを先に切るのは、細かさを 1 より下げると文字がぼやけるため（画素の比が 3 の iPhone では、0.5 で壁の文字が潰れて読めない。
// 光のにじみを切っても、画面は1割ほど暗くなるだけで、文字はくっきりしている）。
// 下げるだけで上げない。下げた段は保存しない（毎回、数秒で同じ所まで下がるため）。テスト用モードでは呼ばない（画面写真を同じにするため）

/** 下げ方の決まり：平均がこれより長いと遅い（秒。48fps）・数える間（秒）・1回で下げる量・光のにじみを切る前の描く細かさ・描く細かさの下限 */
export const QUALITY = { slow: 1 / 48, span: 2.5, step: 0.2, sharp: 1, floor: 0.75 };

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
  // 100分の1に丸める（0.2 ずつ引くと、小数の誤差で止まる所のすぐ上に止まり、もう1段かかるため）
  const down = (to: number): number => Math.max(to, Math.round((q.pr - QUALITY.step) * 100) / 100);
  if (q.pr > QUALITY.sharp) return { pr: down(QUALITY.sharp), bloom: q.bloom };
  if (q.bloom) return { pr: q.pr, bloom: false };
  if (q.pr > QUALITY.floor) return { pr: down(QUALITY.floor), bloom: false };
  return null;
}
