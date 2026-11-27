// ---------------------------------------------------------------- first / third person (chosen in the menu)
try{ ui.camMode=localStorage.getItem('al_cam')||'fps'; }catch(e){}
// 残した音量の段（src/lib/screens.ts の loadSndLevel）
loadSndLevel();
// AVATAR_TY は src/lib/names.ts（src/game/imports.mjs で読む）
// 頭の位置 headPos と、攻撃や投げた物が出る所 aimOrigin は src/lib/aim.ts（src/game/imports.mjs で読む）
// placeThirdPerson は src/lib/player.ts（src/game/imports.mjs で読む）
// 3人称の自分の姿 updateAvatar（姿は src/lib/state.ts の ui.avatar）・岩の中か rockAt・カメラと自分の間の岩の断面 drawSection は src/lib/camera.ts（src/game/imports.mjs で読む）
// 視点を変える setCamMode は src/lib/screens.ts、3人称のカメラの位置 ui.camPos は src/lib/state.ts（src/game/imports.mjs で読む）

// updatePlayer は src/lib/player.ts（src/game/imports.mjs で読む）
// 霧と目の慣れ updateAtmosphere は src/lib/camera.ts（目の慣れ expo は src/lib/state.ts の vfx。src/game/imports.mjs で読む）
