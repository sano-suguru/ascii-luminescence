// ---------------------------------------------------------------- lore (points kept between runs), unlocks, the last run's grave, trials
// META_DEF・UNLOCKS は src/lib/progress.ts（src/game/imports.mjs で読む）
// タイトルの画面（記録を読む loadMeta・解放の画面 buildUnlockPanel・タイトルの枠 buildIntroPanel・後から描き直す redrawIntroLater・初めて指で入った時の一言 touchTip）と、
// それを用意する initIntro は src/lib/intro.ts（src/game/imports.mjs で読む）
initIntro();
// 次のビルドに持ち替える（ホイールと、指の操作の [持ち替え]。続けて回した時は 0.35 秒あける）。buildsHave は src/lib/hotbar.ts
function nextBuild(){ if(!ui.started||isPaused()||!gear.hands)return; const have=buildsHave(); if(!have.length||clock.time-(gfx.canvas.wheelT||-9)<0.35)return; gfx.canvas.wheelT=clock.time;
  const pos=Math.max(0,have.indexOf(gear.buildIdx)), next=have[(pos+1)%have.length]; const prev=snapHands(); if(applyBuild(next)){ startSwap(prev); flashHint(`ビルド${next+1}`,900); } renderHotbar(); }
// Esc：捕まえていない時は、メニューを開け閉めする。Esc で閉じた時は捕まえない（下の ui.escKey）。捕まえる遊び方なら、その後は
// 「クリックで視点操作に戻る」が出て、次のクリックで捕まえる（relockClick）。レベルアップの画面では何もしない
function onKeyDown(e){
  if(ui.gallery&&ui.gallery.mode==='beast'){ if(e.code==='ArrowLeft')showBeast(ui.gallery.idx-1); else if(e.code==='ArrowRight')showBeast(ui.gallery.idx+1); else if(e.code==='Escape')returnToTitle(); else if(e.code==='KeyR')galleryReset(); e.preventDefault(); return; }
  if(e.target&&e.target.tagName==='INPUT'){ if(e.code==='Enter'){ e.preventDefault(); document.getElementById('enter').click(); } return; }
  keys[e.code]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(!ui.started&&(e.code==='Enter'||e.code==='Space')){ document.getElementById('enter').click(); return; }
  if(e.code==='F2'){ e.preventDefault(); if(ui.started&&!adv.dead&&saved.DEVALL){ if(ui.menuOpen)setMenu(false); if(ui.invOpen)setInv(false); setDbg(!ui.dbgOpen); } return; }
  if(e.code==='Escape'&&ui.dbgOpen){ setDbg(false); return; }
  if(ui.altarOpen&&e.code==='Escape'){ e.preventDefault(); closeAltar(true); return; }
  if(e.code==='Tab'){ e.preventDefault(); togglePack(); return; }
  if(e.code==='Escape'){ if(ui.invOpen){ setInv(false); return; } if(ui.lvlOpen)return; if(ui.started&&!adv.dead&&!ui.locked){ setMenu(!ui.menuOpen); return; } }
  if(isPaused())return;
  if(ui.started&&e.code==='KeyM'){ sndToggle(); }
  if(ui.started&&e.code==='KeyH'){ cycleUi(); }
  if(adv.dead&&(e.code==='Enter'||e.code==='KeyR')){ startNewRun(); return; }
  if(ui.started&&e.code==='Space'){ startRoll(); }
  if(ui.started&&e.code==='KeyP'){ ui.perfOn=!ui.perfOn; renderStatus(); }
  if(ui.started&&e.code==='KeyJ'){ ui.chronOn=!ui.chronOn; ui.helpOn=false; ui.bookOn=false; ui.helpT=0; const el=document.getElementById('help'); if(el){ if(ui.chronOn)renderChron(); el.classList.toggle('off',!ui.chronOn); } }
  if(ui.started&&(e.key==='?'||e.code==='Slash')){ setHelp(!ui.helpOn); ui.helpT=0; }
}
// 装備の画面を開け閉めする（Tab とタッチの [装備]）。祭壇の画面が開いていれば、閉じて装備の画面を開く
function togglePack(){
  if(ui.altarOpen){ closeAltar(true); if(ui.started&&!adv.dead)setInv(true); return; }
  if(ui.started&&!adv.dead){ if(ui.menuOpen)setMenu(false); setInv(!ui.invOpen); }
}
// タッチの [メニュー]：Esc と同じく、祭壇・装備の画面が開いていれば閉じ、そうでなければメニューを開け閉めする（レベルアップの画面では何もしない）
function toggleMenu(){
  if(ui.altarOpen){ closeAltar(true); return; }
  if(ui.invOpen){ setInv(false); return; }
  if(ui.lvlOpen||!ui.started||adv.dead)return;
  setMenu(!ui.menuOpen);
}
// マウスとキーの処理を用意する（診断の記録もここで始める）
function initInput(){
gfx.canvas.addEventListener('contextmenu',e=>e.preventDefault());
// the bestiary: the wheel moves in and out, a drag with the left button turns the creature and moves the camera up and down (galleryWheel, galleryDrag)
gfx.canvas.addEventListener('wheel',e=>{ if(!(ui.gallery&&ui.gallery.mode==='beast'))return; e.preventDefault(); galleryWheel(e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?400:1)); },{passive:false});
gfx.canvas.addEventListener('mousedown',e=>{ if(!(ui.gallery&&ui.gallery.mode==='beast')||e.button!==0)return; ui.gallery.drag={x:e.clientX,y:e.clientY}; galleryView(); });
// the left button let go where no mouseup reaches (another window took the focus): the drag ends
window.addEventListener('mousemove',e=>{ const g=ui.gallery; if(!g||!g.drag)return; if(!(e.buttons&1)){ g.drag=null; galleryView(); return; } galleryDrag(e.clientX-g.drag.x,e.clientY-g.drag.y); g.drag.x=e.clientX; g.drag.y=e.clientY; });
window.addEventListener('mouseup',e=>{ const g=ui.gallery; if(!g||!g.drag||e.button!==0)return; g.drag=null; galleryView(); });
window.addEventListener('blur',()=>{ const g=ui.gallery; if(!g||!g.drag)return; g.drag=null; galleryView(); });
window.addEventListener('mousedown',e=>{
  if(!ui.menuOpen&&!ui.invOpen)return;
  if(ui.dbgOpen){ if(!(e.target&&e.target.closest&&e.target.closest('#dbgp'))){ e.preventDefault(); e.stopPropagation(); setDbg(false); } return; }
  const inside=e.target&&e.target.closest&&e.target.closest('#menu,#pack');
  if(inside)return;
  e.preventDefault(); e.stopPropagation();
  if(ui.menuOpen){ setMenu(false); if(!ui.plFailed)tryLock(); }
  if(ui.invOpen)setInv(false);
},true);
gfx.canvas.addEventListener('wheel',e=>{ if(!ui.started||isPaused()||!gear.hands)return; e.preventDefault(); nextBuild(); },{passive:false});
gfx.canvas.addEventListener('mousedown',e=>{ if(!ui.started||isPaused())return; if(relockClick()){ gfx.canvas.focus(); return; } if(e.button===2){ beginCast('R'); return; } if(ui.locked&&e.button===0){ beginCast('L'); return; } if(e.button===0){ ui.downAt=[e.clientX,e.clientY]; beginCast('L'); } ui.dragging=true; ui.lmx=e.clientX; ui.lmy=e.clientY; if(!ui.locked)tryLock(); gfx.canvas.focus(); updateResume(); });
window.addEventListener('mouseup',e=>{ if(gear.hands){ if(e.button===0)releaseCast('L'); if(e.button===2)releaseCast('R'); } ui.downAt=null; ui.dragging=false; updateResume(); });
window.addEventListener('mousemove',e=>{
  if(!ui.started)return;
  if(ui.locked){ player.yaw-=e.movementX*0.0022; player.pitch-=e.movementY*0.0022; }
  else if(ui.dragging){ player.yaw-=(e.clientX-ui.lmx)*0.0045; player.pitch-=(e.clientY-ui.lmy)*0.0045; ui.lmx=e.clientX; ui.lmy=e.clientY; }
  player.pitch=clamp(player.pitch,-1.35,1.35);
});
// 診断の記録（claude.ai の Artifact の中で、持ち主が開いた時だけ。src/lib/diag.ts）
// 持ち主と分かったら、タイトルを描き直す（［開発用モード］と［自動で試す］を出す）
void initDiag(()=>redrawIntroLater());
// Esc のキーを処理している間は、マウスを捕まえにいかない（ui.escKey。Esc のキーで掛けたロックは、ブラウザがすぐ外し、外れた事件でメニューが開いてしまうため）
window.addEventListener('keydown',e=>{ ui.escKey=e.code==='Escape'; try{ onKeyDown(e); } finally{ ui.escKey=false; } });
window.addEventListener('keyup',e=>{ keys[e.code]=false; });
window.addEventListener('blur',()=>{ for(const k in keys)keys[k]=false; ui.dragging=false; });
// ページが隠れたら（アプリの切り替えなど）、押しているキーと指を離したことにし、溜めている詠唱を散らし、探索中ならメニューを開いて止める（src/lib/screens.ts の menuOnHide）
document.addEventListener('visibilitychange',()=>{ if(!document.hidden)return; for(const k in keys)keys[k]=false; ui.dragging=false; releaseTouch(); if(menuOnHide())setMenu(true); });
}
initInput();
