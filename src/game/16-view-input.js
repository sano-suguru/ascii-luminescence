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
let dragging=false, lmx=0, lmy=0;
ui.introEl=document.getElementById('intro');
// マウスを捕まえる tryLock・失敗した時 lockFailed・外れた時にメニューを開くか menuOnUnlock・「クリックで視点操作に戻る」の一言 updateResume は src/lib/screens.ts、捕まえられないと決めたか ui.plFailed・一度でも捕まえたか ui.lockedOnce・最後に捕まえてから捕まえようとした回数 ui.lockTries・最後に外れた時刻 ui.unlockedAt は src/lib/state.ts（src/game/imports.mjs で読む）
document.addEventListener('pointerlockchange',()=>{ const was=ui.locked; ui.locked=document.pointerLockElement===canvas; if(ui.locked){ ui.lockedOnce=true; ui.lockTries=0; } else if(was)ui.unlockedAt=performance.now(); if(ui.locked&&ui.menuOpen)setMenu(false); if(menuOnUnlock(was))setMenu(true); updateResume(); });
document.addEventListener('pointerlockerror',lockFailed);
// 指で遊ぶ時の土台（src/lib/touch.ts）。指の後に出るマウスの事件を止めるので、ゲームのマウスの処理（17-meta.js）より先に用意する。togglePack・toggleMenu は 17-meta.js
initTouch({pack:togglePack,menu:toggleMenu,changed:()=>{ if(ui.gallery&&ui.gallery.mode==='beast')renderGallery(); }});
initTouchpad({build:nextBuild,gallery:{on:()=>!!(ui.gallery&&ui.gallery.mode==='beast'),drag:galleryDrag,zoom:galleryZoom,hold:galleryHold}});
