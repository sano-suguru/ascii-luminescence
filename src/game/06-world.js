// ---------------------------------------------------------------- world state
let staticMesh=null;
// player は src/lib/state.ts（src/game/imports.mjs で読む。丸ごと入れ替えないので、名前はそのまま）
// edge は src/lib/state.ts（src/game/imports.mjs で読む）
// 画面の下の一言 showHint は src/lib/status.ts（src/game/imports.mjs で読む）
// ceilAt は src/lib/lightmap.ts（src/game/imports.mjs で読む）

// vnoise は src/lib/noise.ts（src/game/imports.mjs で読む）
// hash3 は src/lib/noise.ts（古い JS は使わない。src/lib/ の生成などが使う）
// sstep は src/lib/math.ts（src/game/imports.mjs で読む）
// CHUNK・CXN・CZN は src/lib/world.ts（src/game/imports.mjs で読む）

// 水面を作る makeWater は src/lib/render.ts（水面 gfx.waterMesh は src/lib/state.ts。src/game/imports.mjs で読む）
// updateWater は src/lib/build.ts（src/game/imports.mjs で読む）

// flowW は src/lib/math.ts（src/game/imports.mjs で読む）
// buildWorld は src/lib/build.ts（src/game/imports.mjs で読む）
// 見える区切りだけを描く cullChunks は src/lib/render.ts（src/game/imports.mjs で読む）

