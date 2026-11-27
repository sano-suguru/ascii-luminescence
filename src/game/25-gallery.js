// ---------------------------------------------------------------- what has been met and found (kept across runs); a developer switch shows everything
// 保存した集まりを読む loadSet と保存する saveSet は src/lib/save.ts（src/game/imports.mjs で読む）
saved.SEEN=loadSet('al_seen');
saved.RSEEN=loadSet('al_runes');
// developer mode (saved.DEVALL) is read in 17-meta.js, before the title is built
// 見た物の記録 trackSeen・図鑑（galleryList・showroom・openBestiary・showBeast・galleryView・galleryWheel・galleryDrag・galleryZoom・galleryHold・galleryReset・
// updateGallery・galleryDesc・galleryLine・renderGallery）・試しの間（galleryRoom・spawnDummy・openRange）・drawGallery は src/lib/gallery.ts（src/game/imports.mjs で読む）
// ---------------------------------------------------------------- the testing chamber: the dummies' kinds (DUMMY_KINDS は src/lib/names.ts)
for(const d of DUMMY_KINDS){ MTYPES[d.k]={ch:'+',name:d.name,col:d.col,form:'humanoid',scale:0.95,speed:0,fl:0,light:1.6,trail:0,dummy:true,verb:'藁と石で組まれた的。何度倒れても、また起き上がる'}; }
RES.dummyF={fire:0.2,ice:2}; RES.dummyP={poison:0.2,fire:2}; RES.dummyT={thunder:2,fire:0.5};
