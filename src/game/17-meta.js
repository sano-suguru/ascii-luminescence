// ---------------------------------------------------------------- lore (points kept between runs), unlocks, the last run's grave, trials
// META_DEF・UNLOCKS は src/lib/progress.ts（src/game/imports.mjs で読む）
function loadMeta(){ try{ return Object.assign({},META_DEF,JSON.parse(localStorage.getItem('al_meta')||'{}')); }catch(e){ return Object.assign({},META_DEF); } }
saved.META=loadMeta();
// developer mode (al_dev) is read here, before the title is built below (the title's trials row depends on it)
try{ saved.DEVALL=localStorage.getItem('al_dev')==='1'; }catch(e){}
// 記録 META を保存する saveMeta は src/lib/save.ts、解放の確かめ（unlocked・lockedOf・weaponPool）は src/lib/unlocks.ts（src/game/imports.mjs で読む）
const loreLeft=()=>Math.max(0,(saved.META.lore||0)-(saved.META.spent||0));
// trialOn は src/lib/unlocks.ts（src/game/imports.mjs で読む）
let introMode='main';
function buildUnlockPanel(){ const el=document.getElementById('intropanel'); if(!el)return; const f=t=>`<span class="f">${t}</span>`, KIND={weapon:'武器',rune:'ルーン',bless:'恩恵',build:'ビルド',trial:'試練'};
  const rows=[f('+-- 解放 ---'),`${f('|')} 伝承を使って、選べるものを増やす。　使える伝承 <b style="color:#ffe3a0">${loreLeft()}</b>`,f('|')];
  for(const u of UNLOCKS){ const done=unlocked(u.id), can=!done&&u.cost<=loreLeft();
    rows.push(`${f('|')} ${done?'<span class="lab">　解放済み　</span>':can?`<button class="sl" type="button" data-unl="${u.id}">[ 解放する ]</button>`:'<span class="dim">　伝承不足　</span>'} ${padTo(`<span class="lab">${KIND[u.kind]}</span>`,6)} ${padTo(done?u.name:`<span${can?'':' class="dim"'}>${u.name}</span>`,24)} <span class="lab">${String(u.cost).padStart(3)}</span>`);
    rows.push(`${f('|')}               <span class="dim">${u.desc}</span>`); }
  rows.push(f('|'),`${f('|')} <button class="sl" id="unlBack" type="button">[ もどる ]</button>`,f('+---'));
  el.innerHTML=boxText(rows);
  document.getElementById('unlBack').addEventListener('click',()=>{ introMode='main'; buildIntroPanel(); });
  for(const b of el.querySelectorAll('button[data-unl]'))b.addEventListener('click',()=>{ const u=UNLOCKS.find(x=>x.id===b.dataset.unl); if(!u||unlocked(u.id)||u.cost>loreLeft())return; saved.META.unl=[...(saved.META.unl||[]),u.id]; saved.META.spent=(saved.META.spent||0)+u.cost; saveMeta(); sndInit(); sChime(0,0,0.5); buildUnlockPanel(); }); }
function buildIntroPanel(){
  const devOn=saved.DEVALL; if(!devOn)startDepth=1; const seedKeep=(document.getElementById('seedIn')||{}).value||'';
  const el=document.getElementById('intropanel'); if(!el)return; const f=t=>`<span class="f">${t}</span>`;
  if(introMode==='unlock'){ buildUnlockPanel(); return; }
  const keyList=[['WASD','移動'],['マウス','視点'],['左クリック','左手'],['右クリック','右手'],['ホイール','ビルド切替'],['Space','回避'],['Shift','走る'],['Tab','装備'],['Esc','メニュー']];
  const cell=([k,v])=>{ const s=`<b>[${k}]</b> ${v}`; return s+' '.repeat(Math.max(1,24-visW(s))); };
  const keyRows=[]; for(let i=0;i<keyList.length;i+=2)keyRows.push(`${f('|')} ${cell(keyList[i])}${keyList[i+1]?cell(keyList[i+1]):''}`);
  const seen=new Set(), layers=[]; for(const st of STRATA){ if(seen.has(st.n))continue; seen.add(st.n); layers.push(st); }
  const layerRows=devOn?[`${f('|')} 開始する層`,...layers.map(st=>`${f('|')}   <button class="sl${st.from===startDepth?' on':''}" type="button" data-d="${st.from}"><span class="mk">${st.from===startDepth?'&gt;':' '}</span> 第${st.n}層 ${st.name}</button>`),f('|')]:[];
  el.innerHTML=boxText([f('+-- 地下迷宮へ ---'),
    `${f('|')} 壁も床も天井も、そこに棲むものも、`,`${f('|')} すべてが光る文字でできた地下迷宮。`,`${f('|')} 深く潜るほど闇は濃く、溶岩の光が強くなる。`,f('|'),
    ...keyRows,f('|'),...layerRows,
    `${f('|')} シード [<input id="seedIn" type="text" inputmode="numeric" autocomplete="off" maxlength="10" size="10" placeholder="ランダム" aria-label="シード">]`,f('|'),
    ...(UNLOCKS.some(u=>u.kind==='trial'&&unlocked(u.id))?[`${f('|')} 試練 `+UNLOCKS.filter(u=>u.kind==='trial'&&unlocked(u.id)).map(u=>`<button class="sl${(saved.META.trials||[]).includes(u.t)?' on':''}" type="button" data-trial="${u.t}"><span class="mk">${(saved.META.trials||[]).includes(u.t)?'&gt;':' '}</span> ${u.name.replace(/試練|「|」/g,'')}</button>`).join('  '),f('|')]:[]),
    `${f('|')} 伝承 <b style="color:#ffe3a0">${loreLeft()}</b> <span class="lab">（累計 ${saved.META.lore||0}）</span>  <button class="sl" id="unlockB" type="button">[ 解放 ]</button>`,f('|'),
    `${f('|')}               <button id="enter" type="button">[ 迷宮に入る ]</button>`,f('|'),
    `${f('|')} <button class="sl" id="galB" type="button">[ 図鑑 ]</button>  <button class="sl" id="galR" type="button">[ 試しの間 ]</button>   <button class="sl" id="galDev" type="button">[開発用モード：${devOn?'オン':'オフ'}]</button>`,f('+---')]);
  document.getElementById('galB').addEventListener('click',()=>{ sndInit(); openBestiary(); });
  document.getElementById('unlockB').addEventListener('click',()=>{ introMode='unlock'; buildIntroPanel(); });
  for(const b of el.querySelectorAll('button[data-trial]'))b.addEventListener('click',()=>{ const k=b.dataset.trial, T=new Set(saved.META.trials||[]); if(T.has(k))T.delete(k); else T.add(k); saved.META.trials=[...T]; saveMeta(); buildIntroPanel(); });
  document.getElementById('galR').addEventListener('click',()=>openRange());
  document.getElementById('galDev').addEventListener('click',()=>{ saved.DEVALL=!saved.DEVALL; try{ localStorage.setItem('al_dev',saved.DEVALL?'1':'0'); }catch(er){} buildIntroPanel(); });
  for(const b of el.querySelectorAll('button.sl[data-d]'))b.addEventListener('click',()=>{ startDepth=+b.dataset.d; for(const o of el.querySelectorAll('button.sl[data-d]')){ const on=o===b; o.classList.toggle('on',on); o.querySelector('.mk').innerHTML=on?'&gt;':' '; } });
  const si=document.getElementById('seedIn'); if(si)si.value=seedKeep;
}
buildIntroPanel();

// the title panel can be rebuilt, so its [迷宮に入る] is caught on the panel itself
document.getElementById('intropanel').addEventListener('click',e=>{
  if(!(e.target&&e.target.closest&&e.target.closest('#enter')))return;
  sndInit();
  const sv=(document.getElementById('seedIn').value||'').trim();
  let regen=false;
  if(/^[0-9]{1,10}$/.test(sv)){ const n=Number(sv)>>>0; if(n!==adv.runSeed){ adv.runSeed=n; regen=true; } }
  if(startDepth!==here.depth){ here.depth=startDepth; regen=true; }
  if(regen){ here.branch=null; here.realm=null; here.inter=null; }
  fight.rains=[]; fight.marks=[]; fight.zones=[]; fight.laters=[];
  adv.dead=false; { const de=document.getElementById('death'); if(de)de.classList.remove('show','won'); }
  adv.PLAYER_MAX=40; adv.lvl={n:1,exp:0,pending:0,bless:{},strata:new Set()}; adv.runTrials=(saved.META.trials||[]).filter(k=>unlocked('t_'+k)); player.hp=adv.PLAYER_MAX; adv.runStats={kills:0,t0:clock.time,maxDepth:here.depth,book0:saved.BOOK.size,beastsNew:0}; resetRunes();
  if(regen)newLevel();
  ui.started=true; document.body.classList.add('started'); if(here.D)showStratum(here.D.stratum); setHelp(true); helpT=25; introEl.classList.add('gone'); canvas.focus(); tryLock(); updateResume();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
// the bestiary: the wheel moves in and out, a drag with the left button turns the creature and moves the camera up and down (galleryWheel, galleryDrag)
canvas.addEventListener('wheel',e=>{ if(!(ui.gallery&&ui.gallery.mode==='beast'))return; e.preventDefault(); galleryWheel(e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?400:1)); },{passive:false});
canvas.addEventListener('mousedown',e=>{ if(!(ui.gallery&&ui.gallery.mode==='beast')||e.button!==0)return; ui.gallery.drag={x:e.clientX,y:e.clientY}; galleryView(); });
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
  if(ui.menuOpen){ setMenu(false); if(!plFailed)tryLock(); }
  if(ui.invOpen)setInv(false);
},true);
canvas.addEventListener('wheel',e=>{ if(!ui.started||isPaused()||!gear.hands)return; e.preventDefault(); const have=(unlocked('build3')?[0,1,2]:[0,1]).filter(k=>gear.builds[k]); if(!have.length||clock.time-(canvas.wheelT||-9)<0.35)return; canvas.wheelT=clock.time;
  const pos=Math.max(0,have.indexOf(gear.buildIdx)), next=have[(pos+1)%have.length]; const prev=snapHands(); if(applyBuild(next)){ startSwap(prev); showHint(`ビルド${next+1}`); setTimeout(()=>showHint(''),900); } renderHotbar(); },{passive:false});
let downAt=null;
canvas.addEventListener('mousedown',e=>{ if(!ui.started||isPaused())return; if(e.button===2){ beginCast('R'); return; } if(ui.locked&&e.button===0){ beginCast('L'); return; } if(e.button===0){ downAt=[e.clientX,e.clientY]; beginCast('L'); } dragging=true; lmx=e.clientX; lmy=e.clientY; if(!ui.locked)tryLock(); canvas.focus(); updateResume(); });
window.addEventListener('mouseup',e=>{ if(gear.hands){ if(e.button===0)releaseCast('L'); if(e.button===2)releaseCast('R'); } downAt=null; dragging=false; updateResume(); });
window.addEventListener('mousemove',e=>{
  if(!ui.started)return;
  if(ui.locked){ player.yaw-=e.movementX*0.0022; player.pitch-=e.movementY*0.0022; }
  else if(dragging){ player.yaw-=(e.clientX-lmx)*0.0045; player.pitch-=(e.clientY-lmy)*0.0045; lmx=e.clientX; lmy=e.clientY; }
  player.pitch=clamp(player.pitch,-1.35,1.35);
});
window.addEventListener('keydown',e=>{
  if(ui.gallery&&ui.gallery.mode==='beast'){ if(e.code==='ArrowLeft')showBeast(ui.gallery.idx-1); else if(e.code==='ArrowRight')showBeast(ui.gallery.idx+1); else if(e.code==='Escape')returnToTitle(); else if(e.code==='KeyR')galleryReset(); e.preventDefault(); return; }
  if(e.target&&e.target.tagName==='INPUT'){ if(e.code==='Enter'){ e.preventDefault(); document.getElementById('enter').click(); } return; }
  keys[e.code]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(!ui.started&&(e.code==='Enter'||e.code==='Space')){ document.getElementById('enter').click(); return; }
  if(e.code==='F2'){ e.preventDefault(); if(ui.started&&!adv.dead&&saved.DEVALL){ if(ui.menuOpen)setMenu(false); if(ui.invOpen)setInv(false); setDbg(!ui.dbgOpen); } return; }
  if(e.code==='Escape'&&ui.dbgOpen){ setDbg(false); return; }
  if(ui.altarOpen&&(e.code==='Escape'||e.code==='Tab')){ e.preventDefault(); closeAltar(true); if(e.code==='Tab'&&ui.started&&!adv.dead)setInv(true); return; }
  if(e.code==='Tab'){ e.preventDefault(); if(ui.started&&!adv.dead){ if(ui.menuOpen)setMenu(false); setInv(!ui.invOpen); } return; }
  if(e.code==='Escape'){ if(ui.invOpen){ setInv(false); return; } if(ui.started&&!adv.dead&&plFailed){ setMenu(!ui.menuOpen); return; } }
  if(isPaused())return;
  if(ui.started&&e.code==='KeyM'){ sndToggle(); }
  if(ui.started&&e.code==='KeyH'){ cycleUi(); }
  if(adv.dead&&(e.code==='Enter'||e.code==='KeyR')){ newRun(); return; }
  if(ui.started&&e.code==='Space'){ startRoll(); }
  if(ui.started&&e.code==='KeyP'){ ui.perfOn=!ui.perfOn; renderStatus(); }
  if(ui.started&&e.code==='KeyJ'){ ui.chronOn=!ui.chronOn; ui.helpOn=false; helpT=0; const el=document.getElementById('help'); if(el){ if(ui.chronOn)renderChron(); el.classList.toggle('off',!ui.chronOn); } }
  if(ui.started&&(e.key==='?'||e.code==='Slash')){ setHelp(!ui.helpOn); helpT=0; }
});
window.addEventListener('keyup',e=>{ keys[e.code]=false; });
window.addEventListener('blur',()=>{ for(const k in keys)keys[k]=false; dragging=false; });

