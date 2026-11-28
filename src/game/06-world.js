// ---------------------------------------------------------------- world state
let staticMesh=null;
// player は src/lib/state.ts（丸ごと入れ替えないので、名前はそのまま）
// edge は src/lib/state.ts
// 画面の下の一言 showHint は src/lib/status.ts
// ceilAt は src/lib/lightmap.ts

// vnoise は src/lib/noise.ts
// hash3 は src/lib/noise.ts（古い JS は使わない。src/lib/ の生成などが使う）
// sstep は src/lib/math.ts
// CHUNK・CXN・CZN は src/lib/world.ts

// 水面を作る makeWater は src/lib/render.ts（水面 gfx.waterMesh は src/lib/state.ts）
// updateWater は src/lib/build.ts

// flowW は src/lib/math.ts
// buildWorld は src/lib/build.ts
// 見える区切りだけを描く cullChunks は src/lib/render.ts

