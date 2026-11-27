// かかった時間を、診断の記録（src/lib/diag.ts）に渡す。記録していない時（ふつうの公開用の版・テスト・持ち主でない人）は何もしない。
// 場面が切り替わる時（階を作る・音の部品を作る・死んだ時・画面の大きさを変える）に、本物の端末でどれだけ止まるかを確かめるため。
// diag.ts は場所の名前（src/lib/levels.ts）を読むので、levels.ts などが diag.ts を直に読むと輪になる。そのため、この小さなモジュールを間に置く

/** 記録する先（diag.ts の initDiag が入れる） */
type Sink = (k: string, ms: number, v?: Record<string, unknown>) => void;
let sink: Sink | null = null;
/** 記録する先を入れる（null で止める） */
export function setTookSink(s: Sink | null): void {
  sink = s;
}
/** t0（performance.now で読んだ時刻）から今までの時間を、名前 k で記録する。v は添える値 */
export function took(k: string, t0: number, v?: Record<string, unknown>): void {
  if (sink) sink(k, performance.now() - t0, v);
}
