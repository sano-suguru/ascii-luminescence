// ---------------------------------------------------------------- 装備の画面を開け閉めする・付け替えの詠唱・魔導書・メニュー
// 装備の画面を作る renderInv と、その中のボタンの処理（選ぶ・はめる・袋のページ・ビルドの保存と呼び出し applyBuild）は src/lib/inventory.ts、
// 手を写す・戻す snapHands・handsKey は src/lib/gear.ts、反応の表 REACT は src/lib/runes.ts、枠 boxText は src/lib/text.ts（src/game/imports.mjs で読む）。
// 装備の画面の状態（選んでいるルーン packSel など）は src/lib/state.ts の ui
function startSwap(prev){
  if(nearStele()){ sChime(player.x,player.z,0.3); for(let q=0;q<16;q++){ const a=mr()*6.28; spawn(player.x+Math.cos(a)*0.7,0.4+mr()*1.2,player.z+Math.sin(a)*0.7,0,0.6,0,0.7,G('.'),0.1,0.8,1.1,1.6,0); } return; }
  gear.swapSt={t:0,dur:1.5,snap:prev,last:-1}; gear.castSt=null; fight.beamSegs=[];
}
function setInv(on){
  if(on===ui.invOpen)return;
  ui.invOpen=on; document.body.classList.toggle('paused',isPaused()); const el=document.getElementById('pack'); if(!el)return; el.classList.toggle('show',on);
  if(on){ packSnap={key:handsKey(),snap:snapHands()}; ui.packSel=null; ui.packHover=null; if(gear.castSt){ gear.castSt=null; fight.beamSegs=[]; } renderInv(); if(ui.locked&&document.exitPointerLock)document.exitPointerLock(); }
  else { if(packSnap&&packSnap.key!==handsKey())startSwap(packSnap.snap); packSnap=null; if(!plFailed&&ui.started&&!adv.dead)tryLock(); }
  updateResume(); renderHotbar();
}
function renderBook(){
  const el=document.getElementById('help'); if(!el)return; const f=t=>`<span class="f">${t}</span>`;
  const lines=[f('+-- 魔導書 ── 見つけた反応'),...Object.entries(REACT).map(([k,r])=>saved.BOOK.has(k)?`${f('|')} <b>${r.name}</b>  <span class="lab">${r.pair}</span>\n${f('|')}   ${r.desc}`:`${f('|')} <span class="dim">？？？　まだ見ていない</span>`),
    f('|'),`${f('|')} <span class="lab">両手に違う性質を宿し、同じ敵に重ねると何かが起きる</span>`,`${f('|')} <span class="lab">記録は探索をまたいで残る</span>`,f('+------------------------------')];
  el.innerHTML=boxText(lines);
}

function renderMenu(){
  const el=document.getElementById('menu'); if(!el)return; const f=t=>`<span class="f">${t}</span>`;
  const items=[['resume','探索を続ける'],['pack','持ち物を見る'],['help',`操作の案内`],['chron','年代記'],['book','魔導書'],['cam',`視点：${ui.camMode==='tps'?'三人称':'一人称'}`],['ui',`表示：${['通常','最小','なし'][ui.uiMode]}`],['snd',`音量：${SND_NAME[SND.lv]}`],['perf',`速度の表示：${ui.perfOn?'オン':'オフ'}`],['new',newRunArm>performance.now()?'本当に最初からやり直す？（もう一度押す）':'新しい探索を始める'],['title',ui.gallery?'タイトルに戻る':(titleArm>performance.now()?'本当にタイトルに戻る？（探索は終わる）':'タイトルに戻る')]];
  el.innerHTML=boxText([f('+-- メニュー --------------------'),...items.map(([k,l])=>`${f('|')} <button class="row" data-k="${k}"><span class="mk"> </span>${l}</button>`),f('+--------------------------------')]);
  for(const b of el.querySelectorAll('button.row'))b.onclick=()=>menuAct(b.dataset.k);
}
function setMenu(on){ ui.menuOpen=on; document.body.classList.toggle('paused',isPaused()); const el=document.getElementById('menu'); if(!el)return; el.classList.toggle('show',on); if(on)renderMenu(); }
function menuAct(k){
  if(k==='resume'){ setMenu(false); if(!plFailed)tryLock(); }
  else if(k==='pack'){ setMenu(false); setInv(true); }
  else if(k==='help'){ setHelp(!ui.helpOn); helpT=0; renderMenu(); }
  else if(k==='chron'){ ui.chronOn=!ui.chronOn; ui.helpOn=false; helpT=0; const el=document.getElementById('help'); if(el){ if(ui.chronOn)renderChron(); el.classList.toggle('off',!ui.chronOn); } renderMenu(); }
  else if(k==='book'){ const el=document.getElementById('help'); ui.chronOn=false; ui.helpOn=false; helpT=0; menuAct.book=!menuAct.book; if(el){ if(menuAct.book)renderBook(); el.classList.toggle('off',!menuAct.book); } renderMenu(); }
  else if(k==='cam'){ setCamMode(ui.camMode==='tps'?'fps':'tps'); renderMenu(); }
  else if(k==='ui'){ cycleUi(); renderMenu(); }
  else if(k==='snd'){ sndToggle(); renderMenu(); }
  else if(k==='perf'){ ui.perfOn=!ui.perfOn; renderStatus(); renderMenu(); }
  else if(k==='title'){ if(ui.gallery||titleArm>performance.now()){ titleArm=0; returnToTitle(); } else { titleArm=performance.now()+4000; newRunArm=0; renderMenu(); menuArmReset(); } }
  else if(k==='new'){ if(newRunArm>performance.now()){ newRunArm=0; setMenu(false); newRun(); if(!plFailed)tryLock(); } else { newRunArm=performance.now()+4000; titleArm=0; renderMenu(); menuArmReset(); } }
}
// the "press again to make sure" of the menu lasts 4 real seconds (game time stands still while the menu is open), then the label goes back.
// Only one of the two is armed at a time. Draw the menu again only when one has run out (so a click in the middle is not lost)
function menuArmReset(){ setTimeout(()=>{ const now=performance.now(), out=k=>k&&k<=now; if(!out(titleArm)&&!out(newRunArm))return; if(out(titleArm))titleArm=0; if(out(newRunArm))newRunArm=0; if(ui.menuOpen)renderMenu(); },4050);
}
// standing still a moment is enough to look around carefully (after Brogue's searching)
let stillT=0, searchedAt=-1;
function updateSearch(dt){
  const still=Math.hypot(player.vx,player.vz)<0.3, pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL);
  if(!still){ stillT=0; return; }
  stillT+=dt; if(stillT<1.5||searchedAt===pc)return; searchedAt=pc;
  let found=0; for(const tr of (here.D.traps||[])){ if(!tr.hidden)continue; const [x,z]=cpos(tr.i); if(Math.hypot(x-player.x,z-player.z)<CELL*4.5){ tr.hidden=false; found++; } }
  let mim=0; for(const m of here.monsters){ if(m.hidden&&Math.hypot(m.x-player.x,m.z-player.z)<9){ m.revealNow=true; mim++; } }
  if(found||mim){ sChime(player.x,player.z,0.2); msg(`<b style="color:#bfe4ff">?</b>立ち止まって辺りを見回した。${found?`隠された罠を${found}つ見つけた。`:''}${mim?'浮かんでいた巻物が、ぴくりと動いた。':''}`); }
}

