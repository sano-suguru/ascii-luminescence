// 速さに合わせて画質を下げる（遅い端末、主にスマホのため）。src/game/30-loop-init.js の frame が、探索中のフレームの時間を集めて呼ぶ。
// 一定の間の平均が遅ければ、1段ずつ下げる：描く細かさ（画素の比）を 1 まで → 光のにじみ（ブルーム）を切る → 描く細かさを下限まで。
// 光のにじみを先に切るのは、細かさを 1 より下げると文字がぼやけるため（画素の比が 3 の iPhone では、0.5 で壁の文字が潰れて読めない。
// 光のにじみを切っても、画面は1割ほど暗くなるだけで、文字はくっきりしている）。
// 1段下げたら、次の間の平均を下げる前と比べ、ほとんど速くならなければ（フレームの時間が gain の割合ほども縮まなければ）1段戻して、それからは変えない。
// 端末が書き換えの回数を抑えている時（iPhone の低電力モードは1秒に30回まで）は、描く手間を減らしても速くならず、下げるとぼやけるだけなので。
// 下げた後と比べる間は、変えてから3秒おいて数える（作り直した直後の遅いフレームを数えないため。src/game/30-loop-init.js）。比べる前に数えるのが途切れたら（階を移る・止まる）、
// 違う場面どうしを比べないように、下げた1段を戻して、次に遅くなった時に下げ直す（holdQuality）。
// 下げるだけで上げない（戻すのは、効かなかった1段と、比べる前に途切れた1段だけ）。下げた段は保存しない（毎回、数秒で同じ所まで下がるため）。テスト用モードでは呼ばない（画面写真を同じにするため）

/** 下げ方の決まり：平均がこれより長いと遅い（秒。48fps）・数える間（秒）・1回で下げる量・光のにじみを切る前の描く細かさ・描く細かさの下限・
 *  1段下げて効いたと見る、フレームの時間の縮み（割合） */
export const QUALITY = { slow: 1 / 48, span: 2.5, step: 0.2, sharp: 1, floor: 0.75, gain: 0.1 };

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

/** 画質を下げる途中の状態：今の画質 q・直前に1段下げたなら、その前の画質と平均 prev・効かずに戻して、もう変えないか done */
export interface QualityRun {
  q: Quality;
  prev: { q: Quality; avg: number } | null;
  done: boolean;
}

/** 数える間ごとに呼ぶ。平均のフレームの時間 avg（秒）から、次の状態を決める（画質を変えるかは、返した q と今の q を比べる） */
export function stepQuality(avg: number, run: QualityRun): QualityRun {
  if (run.done) return run;
  // 直前に下げた段が効いたか。効かなければ、前の画質に戻して止める
  if (run.prev && !(avg < run.prev.avg * (1 - QUALITY.gain))) return { q: run.prev.q, prev: null, done: true };
  const q = nextQuality(avg, run.q);
  return q ? { q, prev: { q: run.q, avg }, done: false } : { q: run.q, prev: null, done: false };
}

/** 数えるのが途切れた時（階を移る・止まる・隠れる）に呼ぶ。下げた1段の比べが済んでいなければ、その1段を戻す（次に遅くなった時に下げ直す） */
export function holdQuality(run: QualityRun): QualityRun {
  return run.prev && !run.done ? { q: run.prev.q, prev: null, done: false } : run;
}
