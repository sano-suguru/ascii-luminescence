// ---------------------------------------------------------------- 主を倒すと、その場に主の祭壇が立つ（深さ1の台・最初の祭壇・階ごとの祭壇・石碑を置くのは src/lib/altars.ts の placeRunesForLevel）
function dropRune(m){
  if(m.ty.critter||m.ty.peaceful||m.ty.dummy)return;
  const strong=(m.maxHp||0)>=40||(m.isLead&&m.g>=0), lord=m.key==='lord'||m.ty.lord;
  if(m.key==='final')return;
  if(!lord)return;
  let at=m.cz*MW+m.cx; for(const d of [-1,MW,-MW,1,MW+1,-MW-1])if(here.D.tile[at+d]===TF&&!here.D.liquid[at+d]&&!here.D.items.some(o=>o.i===at+d&&!o.taken)){ at+=d; break; }
  placeAltar(at,'lordaltar'+clock.time,{lord:true,born:clock.time});
  for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(m.x,0.6,m.z,Math.cos(a)*1.2,0.6+mr(),Math.sin(a)*1.2,0.8,G('.'),0.12,1.6,1.4,2.2,0); }
}
// ---------------------------------------------------------------- 祭壇
// 祭壇の中身 altarFill・番人が生きているか guardedNow・祭壇を置く placeAltar・宝物庫のまわり vaultArea・祭壇の画面の1行 altarLine・
// 階ごとに祭壇とルーンを置く placeRunesForLevel・石碑のそばか nearStele は src/lib/altars.ts（src/game/imports.mjs で読む）。
// 番人を置く・鍛え方・泉を置くなど、ほかの祭壇の処理も src/lib/altars.ts にある（古い JS は読まない）
// the treasury's prize: taking it wakes guardians, or brings the ceiling down
let rockfall=null;
function vaultSprung(it){ const ri=here.D.roomOf[it.i], room=ri>=0&&here.D.rooms[ri]&&here.D.rooms[ri].cells.length>6?here.D.rooms[ri]:{cells:vaultArea(it,4)};
  if(it.ev==='guard'){ const pool=here.monsters.filter(m=>!m.dead&&!m.ty.critter&&!m.ty.peaceful&&!m.ty.boss&&m.key!=='lord'&&MTYPES[m.key]); const key=pool.length?pool.sort((a,b)=>(b.maxHp||0)-(a.maxHp||0))[0].key:'O';
    const cells=vaultArea(it,5).filter(c=>{ const [x,z]=cpos(c); return Math.hypot(x-player.x,z-player.z)>2.0; });
    for(let k=0;k<2&&cells.length;k++){ const c=cells.splice(Math.floor(mr()*cells.length),1)[0]; const m=makeMonster({key,cx:c%MW,cz:(c/MW)|0,g:-1,lead:true}); m.sleep=false; m.aware=1; m.noticed=true; m.alert=1; m.guardian=true; here.monsters.push(m);
      for(let q=0;q<24;q++){ const a=mr()*6.28; spawn(m.x,0.2+mr()*1.6,m.z,Math.cos(a)*0.8,mr()*0.8,Math.sin(a)*0.8,0.9,G(mpick(['#','%','.'])),0.14,0.8,0.78,0.85,0); } }
    sRumble(0.4,1.2); msg('<b style="color:#ffb0a0">!</b>石像の目に光が灯った。宝の番人たちが、目を覚ます。'); }
  else if(room.cells.length){ rockfall={t:0,dur:9,cells:room.cells.filter(c=>here.D.tile[c]===TF),rocks:[],next:0.2}; sRumble(0.5,2.0); msg('<b style="color:#ffd0a0">!</b>天井が軋み、崩れ始めた。早く外へ。'); } }
function updateRockfall(dt){ if(!rockfall)return; const R=rockfall; R.t+=dt; R.next-=dt;
  if(R.t<R.dur&&R.next<=0){ R.next=0.28+mr()*0.2; const near=R.cells.filter(c=>{ const [x,z]=cpos(c); return Math.hypot(x-player.x,z-player.z)<4.5; }); const c=(near.length&&mr()<0.7?near:R.cells)[Math.floor(mr()*(near.length&&mr()<0.7?near.length:R.cells.length))]; if(c!==undefined){ const [x,z]=cpos(c); R.rocks.push({x:x+(mr()-0.5)*1.2,z:z+(mr()-0.5)*1.2,t:0}); } }
  for(const k of R.rocks){ k.t+=dt; if(k.t<0.9){ const f=k.t/0.9; for(let q=0;q<10;q++){ const a=q/10*Math.PI*2; dyn(k.x+Math.cos(a)*0.55,0.04,k.z+Math.sin(a)*0.55,G('.'),0.13,0.9+0.8*f,0.45+0.3*f,0.2,0,0); } dyn(k.x,3.2-2.6*f*f,k.z,G('#'),0.3,0.7,0.66,0.6,0,0); }
    else if(!k.hit){ k.hit=true; for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(k.x,0.2,k.z,Math.cos(a)*1.4,0.6+mr()*1.2,Math.sin(a)*1.4,0.7,G(mpick(['#','%','.',','])),0.14,0.75,0.7,0.62,1); } if(Math.hypot(k.x-player.x,k.z-player.z)<0.65)hurtPlayer(6,'落石'); for(const m of here.monsters)if(!m.dead&&Math.hypot(k.x-m.x,k.z-m.z)<0.65)damageMonster(m,6,'落石'); } }
  R.rocks=R.rocks.filter(k=>k.t<1.2); if(R.t>=R.dur&&!R.rocks.length)rockfall=null; }

// ---------------------------------------------------------------- healing: no regeneration over time. Part of each wound lingers as recoverable (shown on the bar); strike back before it fades
// and the light of what you strike flows into you; a kill gives more. Altars, a little on going down, healing springs, and the town and the oracle heal.
let rallyMotes=[], rallyShown=-1, rallyChime=0;
// RALLY_FROM は src/lib/runes.ts（src/game/imports.mjs で読む）
function rallyOnHit(m,n,how){ if(!(player.rally>0)||!RALLY_FROM.has(how)||m.ty.critter||!(clock.time-(m.playerT||-99)<1.2))return; const mn=bodyN('mend');
  let gain=Math.min(player.rally,n*0.5*(1+0.5*mn)); const kill=m.hp<=0; if(kill)gain=Math.min(player.rally,gain+3+2*mn+3*BL('devour')); if(gain<=0.05)return; player.rally-=gain;
  const sc=m.ty.scale||1, k=kill?Math.min(16,6+Math.round(gain*2)):Math.min(5,1+Math.round(gain)), per=gain/k, src=kill&&m.form?m.form:null;
  for(let q=0;q<k;q++){ let x=m.x,y=m.y+0.6*sc,z=m.z; if(src){ const p=src[Math.floor(mr()*src.length)], cy=Math.cos(m.yaw), sy=Math.sin(m.yaw); x=m.x+(p.x*cy+p.z*sy)*sc; y=m.y+p.y*sc; z=m.z+(-p.x*sy+p.z*cy)*sc; }
    rallyMotes.push({x0:x,y0:y,z0:z,t:-q*0.03,dur:0.38+mr()*0.12,amt:per,c:m.ty.col||[1,0.9,0.7],wob:mr()*6.28}); } }
function updateRally(dt){ if(adv.dead)return; const mn=bodyN('mend');
  if(player.rally>0&&clock.time-(player.lastHurt||-99)>0.6){ player.rally=Math.max(0,player.rally-dt*(player.rallyRate||2)); }
  const tx=player.x, ty=(ui.camMode==='tps'?1.0:player.eye-0.35), tz=player.z;
  for(const p of rallyMotes){ p.t+=dt; if(p.t<0)continue; const f=Math.min(1,p.t/p.dur), e=f*f*(3-2*f), arc=Math.sin(f*Math.PI)*0.35;
    const x=p.x0+(tx-p.x0)*e+Math.cos(p.wob)*arc*0.4, y=p.y0+(ty-p.y0)*e+arc, z=p.z0+(tz-p.z0)*e+Math.sin(p.wob)*arc*0.4, b=1.6+1.2*f;
    dyn(x,y,z,G(f<0.5?'*':'.'),0.12,(p.c[0]*0.5+0.6)*b,(p.c[1]*0.5+0.55)*b,(p.c[2]*0.5+0.4)*b,0,0);
    if(f>=1&&!p.done){ p.done=true; player.hp=Math.min(adv.PLAYER_MAX,player.hp+p.amt); vfx.hpFlash=0.35; if(sndReady()&&clock.time-rallyChime>0.12){ rallyChime=clock.time; sChime(player.x,player.z,0.12); } } }
  rallyMotes=rallyMotes.filter(p=>!p.done);
  vfx.hpFlash=Math.max(0,vfx.hpFlash-dt);
  const rs=Math.round((player.rally||0)*4)+(vfx.hpFlash>0?1000:0); if(rs!==rallyShown){ rallyShown=rs; renderStatus(); } }
// 癒しの泉を描く（1つで1回、全回復。泉を置くのは src/lib/altars.ts の placeSpring）
function drawSprings(t){ for(const it of (here.D.items||[])){ if(it.kind!=='spring')continue; const [x,z]=cpos(it.i); if(Math.hypot(x-player.x,z-player.z)>26)continue; const used=it.taken;
    for(let k=0;k<16;k++){ const a=k/16*Math.PI*2+t*0.25, rr=0.55+0.05*Math.sin(t*2+k), b=used?0.25:0.7+0.3*Math.sin(t*1.8+k); dyn(x+Math.cos(a)*rr,0.05,z+Math.sin(a)*rr,G('~'),0.15,0.35*b,0.85*b,1.0*b,0,0); }
    if(!used){ dyn(x,0.06,z,G('o'),0.3,0.8,1.6,2.0,0,0); if(mr()<0.2)spawn(x+(mr()-0.5)*0.6,0.1,z+(mr()-0.5)*0.6,0,0.6,0,1.4,G(mpick(['.','\''])),0.1,0.6,1.5,1.8,0); } } }

function pickupItems(){
  for(let k=0;k<(here.D.items||[]).length;k++){ const it=here.D.items[k]; if(it.taken)continue; if(it.kind==='rune'&&it.guardG!==undefined){ const gd=guardedNow(it); if(it.wasGuarded&&!gd&&!(here.D.lit||(here.D.lit=new Set())).has(it.grp||it.i)){ here.D.lit.add(it.grp||it.i); const [lx,lz]=cpos(it.i); sChime(lx,lz,0.5); msg(it.elitePrize?'<b style="color:#ffd27a">*</b>番人が倒れた。守られていたルーンが、手の届く光になった。':'<b style="color:#ffd27a">_</b>祭壇に光が灯った。'); } it.wasGuarded=gd; if(gd)continue; }
    if(it.kind==='legend'){ if(it.born&&clock.time-it.born<1)continue; const [lx,lz]=cpos(it.i); if(Math.hypot(lx-player.x,lz-player.z)<0.9){ it.taken=true; pickLegend(it); } continue; }
    if(it.kind==='grave'){ const [gx,gz]=cpos(it.i); if(Math.hypot(gx-player.x,gz-player.z)<0.9){ it.taken=true; takeRune(it.rune); msg(`<b style="color:#c8c8d8">+</b>先人の形見を、墓から拾った：${thingLabel(it.rune)}`); saved.META.grave=null; saveMeta(); sChime(gx,gz,0.4); } continue; }
    if(it.kind==='spring'){ const [sx,sz]=cpos(it.i); if(player.hp<adv.PLAYER_MAX-0.5&&Math.hypot(sx-player.x,sz-player.z)<0.9){ it.taken=true; adv.runState.taken.add(levelSeed()+':'+k+':spring'); player.hp=adv.PLAYER_MAX; player.rally=0; vfx.hpFlash=0.6; renderStatus(); sChime(sx,sz,0.5); setTimeout(()=>sChime(sx,sz,0.35),200); msg('<b style="color:#8fe0ff">~</b>泉の光が体を満たし、傷がすっかり癒えた。泉は静かに光を失った。'); for(let q=0;q<30;q++){ const a=mr()*6.28; spawn(player.x+Math.cos(a)*0.5,0.2+mr(),player.z+Math.sin(a)*0.5,Math.cos(a)*0.4,0.8+mr(),Math.sin(a)*0.4,1.0,G(mpick(['*','.','~'])),0.12,0.8,1.8,2.2,0); } } continue; }
    if(it.kind==='slot'){ if(it.born&&clock.time-it.born<1)continue; const [sx,sz]=cpos(it.i); if(Math.hypot(sx-player.x,sz-player.z)<0.9){ it.taken=true; openSlot(it.i); } continue; }
    if(it.kind!=='rune'||!it.rune)continue; if(it.born&&clock.time-it.born<0.6)continue; const [x,z]=cpos(it.i);
    if(it.altar)continue; if(Math.hypot(x-player.x,z-player.z)>0.75)continue;
    grabItem(it,k,x,z); }
}
function grabItem(it,k,x,z,dest){
    it.taken=true; adv.runState.taken.add(levelSeed()+':'+k+':rune');
    if(it.grp){ here.D.items.forEach((o,j)=>{ if(o!==it&&o.grp===it.grp&&!o.taken){ o.taken=true; adv.runState.taken.add(levelSeed()+':'+j+':rune'); const [ox,oz]=cpos(o.i); for(let q=0;q<12;q++){ const a=mr()*6.28; spawn(ox+(o.altar?(o.slot-1)*0.55:0),0.95,oz,Math.cos(a)*0.8,0.3+mr()*0.6,Math.sin(a)*0.8,0.9,G('.'),0.1,0.8,0.75,1.0,0); } } }); }
    if(it.grp==='start')adv.runState.startChosen=true; if(it.grp==='altar1')adv.runState.altar1=true;
    if(it.opt==='forge'){ const w=it.forgeW, t=trList(w).find(t=>t.k===it.forgeK); if(t)t.lv=it.forgeTo; else { w.traits=w.traits||[]; w.traits.push({k:it.forgeK,lv:it.forgeTo}); }
      msg(`<b style="color:#bcdcff">T</b>${RUNE_DEF[w.type].name}の「${trName(w.type,{k:it.forgeK})}」が Lv${it.forgeTo} になった。`); sChime(x,z,0.5); renderHotbar(); if(ui.invOpen)renderInv(); return; }
    if(it.opt==='open'){ applyOpen(it.target); if(adv.runState.slotPend===it.grp)adv.runState.slotPend=null; msg(`<b style="color:#ffe3a0">{ }</b>${it.label}が開いた。`); sChime(x,z,0.5); return; }
    if(it.opt==='heal'){ player.hp=Math.min(adv.PLAYER_MAX,player.hp+adv.PLAYER_MAX*0.7); renderStatus(); msg('<b style="color:#ff9aa8">+</b>温かな光が、傷を塞いでいく。'); sChime(x,z,0.45); return; }
    if(dest){ placeChosen(it.rune); sChime(x,z,0.45); return; }
    takeRune(it.rune,it.grp==='start'?'R':null); sChime(x,z,0.45); if(it.vault)vaultSprung(it);
}
// 拾ったルーンを手か袋に入れる（takeRune・placeChosen・mergeMod）・行き先の名前 runeDest・祭壇の画面の説明 altarDetail と選択肢 altarOpts は src/lib/altars.ts（src/game/imports.mjs で読む）
// 祭壇の画面：灯った祭壇の近くで、3つの選択肢を並べる。クリックで選ぶ。開いている間は、ゲームが止まる
let altarPanelKey='', altarSel=null, altarAim=-1, altarDismissed=null;
// ALTAR_W は src/lib/hud.ts（src/game/imports.mjs で読む）
function renderAltar(){ const el=document.getElementById('altarp'); if(!el)return; const opts=altarOpts(); if(!opts.length){ closeAltar(false); return; }
  const f=t=>`<span class="f">${t}</span>`, rows=[f(opts[0].lord?'+-- 主の祭壇 ---':opts[0].opt==='open'?'+-- 空の枠 ---':opts[0].forge?'+-- 鍛えの祭壇 ---':'+-- ルーンの祭壇 ---'),f('|')];
  for(const o of opts)rows.push(`${f('|')}  <button class="row ao" data-k="${o.slot}">${clipHtml(altarLine(o),ALTAR_W-6)}</button>`);
  rows.push(f('|'));
  for(let i=0;i<5;i++)rows.push(`${f('|')} <span class="adet">${padTo('',ALTAR_W-3)}</span>`);
  rows.push(f('|'),`${f('|')} <span class="lab">クリックで選ぶ　Esc・右クリックでやめる</span>　<button class="row" data-cancel="1">[やめる]</button>`);
  if(opts[0].opt!=='open'&&!opts[0].forge)rows.push(`${f('|')} <span class="lab">ルーンは袋に入る。祭壇のそばでは、Tab の付け替えに詠唱はいらない</span>`);
  rows.push(f('+---'));
  el.innerHTML=boxText(rows,ALTAR_W); setAltarDetail(null);
  if(!el.dataset.bound){ el.dataset.bound='1';
    el.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('button'); if(!b||!ui.altarOpen)return; e.stopPropagation();
      if(b.dataset.cancel){ closeAltar(true); return; } if(b.dataset.k!==undefined)chooseAltar(+b.dataset.k); });
    el.addEventListener('mouseover',e=>{ if(!ui.altarOpen)return; const b=e.target.closest&&e.target.closest('button[data-k]'); setAltarDetail(b?altarOpts().find(o=>o.slot===+b.dataset.k):null); });
    el.addEventListener('contextmenu',e=>{ e.preventDefault(); if(ui.altarOpen)closeAltar(true); }); } }
function setAltarDetail(o){ const el=document.getElementById('altarp'); if(!el)return; const L=altarDetail(o); el.querySelectorAll('.adet').forEach((sp,i)=>{ sp.innerHTML=padTo(clipHtml(L[i]||'',ALTAR_W-4),ALTAR_W-3); }); }
function openAltar(){ const el=document.getElementById('altarp'); if(!el)return; ui.altarOpen=true; document.body.classList.toggle('paused',true);
  if(gear.castSt){ gear.castSt=null; fight.beamSegs=[]; } if(ui.locked&&document.exitPointerLock)document.exitPointerLock(); renderAltar(); el.classList.add('show','open'); renderHotbar(); }
function closeAltar(dismiss){ const el=document.getElementById('altarp'); ui.altarOpen=false; if(dismiss)altarDismissed=ui.altarNear; if(el)el.classList.remove('show','open'); document.body.classList.toggle('paused',isPaused());
  if(!plFailed&&ui.started&&!adv.dead)tryLock(); updateResume(); }
function updateAltarPanel(){ const el=document.getElementById('altarp'); if(!el)return; if(ui.lvlOpen)return; if(adv.lvl.pending>0&&ui.started&&!adv.dead&&!isPaused()){ openLevelUp(); return; }
  if(ui.altarOpen){ if(!here.D||!ui.started||adv.dead||!altarOpts().length)closeAltar(false); return; }
  ui.altarNear=null;
  if(ui.started&&!adv.dead&&!isPaused()&&here.D){ let best=null, bd=1.5; for(const it of (here.D.items||[])){ if(it.taken||!it.altar||!it.rune||it.slot!==1)continue; if(it.guardG!==undefined&&guardedNow(it))continue; const [x,z]=cpos(it.i), d=Math.hypot(x-player.x,z-player.z); if(d<bd){ bd=d; best=it; } } if(best)ui.altarNear=best.grp; }
  // 止まっている間（装備の画面・メニューなど）は、近くの祭壇が無いことにするが、閉じた記録は消さない（離れるまで開かない）
  if(!ui.altarNear){ if(!(ui.started&&!adv.dead&&here.D&&isPaused()))altarDismissed=null; if(el.classList.contains('show'))el.classList.remove('show','open'); return; }
  if(altarDismissed===ui.altarNear)return;
  openAltar(); }
function chooseAltar(n){ if(!ui.altarNear)return false; const k=here.D.items.findIndex(o=>o.grp===ui.altarNear&&o.slot===n&&!o.taken); if(k<0)return false; const it=here.D.items[k];
  const [x,z]=cpos(it.i); if(!it.opt||it.opt==='rune')grabItem(it,k,x+(it.slot-1)*0.55,z,'bag'); else grabItem(it,k,x+(it.slot-1)*0.55,z); altarSel=null; altarPanelKey=''; if(ui.altarOpen)closeAltar(false); return true; }
function altarPlace(dest){ if(!altarSel)return false; const k=here.D.items.findIndex(o=>o.grp===altarSel.grp&&o.slot===altarSel.slot&&!o.taken); altarSel=null; altarPanelKey=''; if(k<0)return false; const it=here.D.items[k], [x,z]=cpos(it.i); grabItem(it,k,x+(it.slot-1)*0.55,z,dest); return true; }

