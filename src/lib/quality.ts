// 速さに合わせて画質を下げる（遅い端末、主にスマホのため）。src/game/30-loop-init.js の frame が、探索中のフレームの時間を集めて呼ぶ。
// 一定の間の平均が遅ければ、1段ずつ下げる：描く細かさ（画素の比）を 1 まで → 光のにじみ（ブルーム）を切る → 描く細かさを下限まで。
// 光のにじみを先に切るのは、細かさを 1 より下げると文字がぼやけるため（画素の比が 3 の iPhone では、0.5 で壁の文字が潰れて読めない。
// 光のにじみを切っても、画面は1割ほど暗くなるだけで、文字はくっきりしている）。
// 下げた後の平均が、下げる前より1割以上速くなっていなければ、その段を元に戻し、それより後は変えない（planQuality）。
// 描く回数が端末の側で抑えられている時（iPhone の Claude アプリで、画質を下限まで下げても 30fps のままだった）に、
// 速くならないのに文字をぼやかし続けないため。
// それ以外では上げない。下げた段は保存しない（毎回、数秒で同じ所まで下がるため）。テスト用モードでは呼ばない（画面写真を同じにするため）

/**
 * 下げ方の決まり：平均がこれより長いと遅い（秒。48fps）・数える間（秒）・1回で下げる量・光のにじみを切る前の描く細かさ・描く細かさの下限・
 * 下げた甲斐があったとみなす速さの比（下げる前の平均 ÷ 下げた後の平均）
 */
export const QUALITY = { slow: 1 / 48, span: 2.5, step: 0.2, sharp: 1, floor: 0.75, gain: 1.1 };

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

/** 1段下げた時の記録：下げる前の画質と、その時の平均のフレームの時間（秒） */
export interface QualityTry {
  from: Quality;
  avg: number;
}
/** 次にすること：q は変える先（変えない時は null）、tried は次に比べる記録、stop は、それより後は変えないか */
export interface QualityPlan {
  q: Quality | null;
  tried: QualityTry | null;
  stop: boolean;
}

/**
 * 平均のフレームの時間 avg（秒）と、前に下げた記録 tried から、次の画質を決める。
 * 前に下げた段で QUALITY.gain 倍より速くなっていなければ、下げる前の画質に戻して止める。速くなっていれば、nextQuality で次を決める
 */
export function planQuality(avg: number, q: Quality, tried: QualityTry | null): QualityPlan {
  if (tried && !(tried.avg / avg >= QUALITY.gain)) return { q: tried.from, tried: null, stop: true };
  const next = nextQuality(avg, q);
  return { q: next, tried: next ? { from: q, avg } : null, stop: false };
}
