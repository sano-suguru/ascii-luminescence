// ---------------------------------------------------------------- field of view & minimap
// computeFOV は src/lib/levels.ts（src/game/imports.mjs で読む）
ui.mapC=document.getElementById('map');
ui.mctx=ui.mapC.getContext('2d');
// ミニマップの大きさを合わせる sizeMap と描く drawMap は src/lib/minimap.ts（src/game/imports.mjs で読む。キャンバス ui.mapC と描き手 ui.mctx は上で入れる）
sizeMap();

// ---------------------------------------------------------------- messages
// 伝言を出す msg と描き直す renderLog は src/lib/log.ts（src/game/imports.mjs で読む）、伝言の一覧 msgs は src/lib/state.ts
setInterval(renderLog,1000);

// ---------------------------------------------------------------- collisions
// solidAt は src/lib/player.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- input
// keys は src/lib/state.ts（src/game/imports.mjs で読む。丸ごと入れ替えないので、名前はそのまま）
ui.introEl=document.getElementById('intro');
// マウスを捕まえた・捕まえられなかった時の受け取りと、指で遊ぶ時の土台を用意する initPointer は src/lib/input.ts（src/game/imports.mjs で読む）
initPointer();
