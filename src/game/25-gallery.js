// ---------------------------------------------------------------- what has been met and found (kept across adventures); a developer switch shows everything
const loadSet=k=>{ try{ return new Set(JSON.parse(localStorage.getItem(k)||'[]')); }catch(e){ return new Set(); } };
const saveSet=(k,s)=>{ try{ localStorage.setItem(k,JSON.stringify([...s])); }catch(e){} };
let SEEN=loadSet('al_seen'), RSEEN=loadSet('al_runes'), DEVALL=false; try{ DEVALL=localStorage.getItem('al_dev')==='1'; }catch(e){}

let seenT=0, gallery=null;
const seenKey=m=>m.ty.beast?'beast:'+adv.runSeed+':'+m.ty.name:m.key==='lord'?'lord:'+(here.branch?here.branch.key:m.ty.sk):(m.key==='final'&&m.phase2)?'final2':m.key;
function trackSeen(dt){
  if(!ui.started||gallery)return; seenT-=dt; if(seenT>0)return; seenT=0.5; const n0=SEEN.size;
  for(const m of here.monsters){ if(m.dead||m.hidden||!m.visible||m.ty.dummy)continue; if(Math.hypot(m.x-player.x,m.z-player.z)<26){ SEEN.add(seenKey(m)); if(m.ty.beast)recordBeast(m.ty); } }
  if(SEEN.size!==n0)saveSet('al_seen',SEEN);
}
// LORD_GAL は src/lib/names.ts（src/game/imports.mjs で読む）
function galleryList(){
  const out=[]; for(const k of Object.keys(MTYPES)){ if(k==='lord'||k==='final'||k==='final2'||k==='X'||k.startsWith('__')||k.startsWith('dummy'))continue; out.push({key:k,ty:MTYPES[k]}); }
  for(const rec of loadBeasts().concat(DEVALL?beastSamples():[]))out.push({key:'beast:'+rec.seed+':'+rec.name,ty:{...rec,ch:'X',form:'beast',beast:true,light:9,boss:false,verb:rec.lore}});
  for(const [bk,L] of Object.entries(LORD_GAL)){ const base=MTYPES[L.base]; if(!base)continue; out.push({key:'lord:'+bk,ty:{...base,sk:L.base,name:L.name,scale:L.scale,verb:L.verb,boss:true,col:L.base==='L'?[0.75,0.9,1.0]:base.col,look:({crypt:null,lair:null,nest:null,snake:null})[bk]||base.look,...(bk==='lair'?{form:'olddragon',light:5}:bk==='sunken'?{form:'deepkraken',light:5}:bk==='crypt'?{form:'lichking',light:7}:bk==='nest'?{form:'spiderqueen',light:6}:bk==='snake'?{form:'nagaqueen',light:6}:{})}}); }
  out.push({key:'final',ty:{...MTYPES.L,ch:'&',look:null,form:'shadowking',sk:'final',name:'最後の王の影',scale:3.6,col:[0.62,0.48,1.0],boss:true,lich:false,light:6,verb:'光の届かない底で、王冠の形をした影が揺れている'}});
  out.push({key:'final2',ty:{...MTYPES.L,ch:'&',look:null,form:'shadowserpent',sk:'final2',name:'最後の王の影（底の闇）',scale:3.0,col:[0.62,0.48,1.0],boss:true,lich:false,light:6,verb:'冠と外套を失い、底の闇から長い体をもたげた影'}});
  return out;
}
// a quiet room from a fixed maze: everything else is cleared away
function galleryRoom(seed){
  here.depth=1; here.branch=null; here.realm=null; here.inter=null; adv.runState.startChosen=true; adv.runState.altar1=true; newLevel(seed);
  let best=null,bl=0; for(const r of here.D.rooms){ if(r.cells.length>bl&&!r.cave&&!r.vault){ bl=r.cells.length; best=r; } }
  const cs=best.cells, cx=Math.round(cs.reduce((s,i)=>s+i%MW,0)/cs.length), cz=Math.round(cs.reduce((s,i)=>s+((i/MW)|0),0)/cs.length);
  here.D.items=[]; here.D.steles=[]; here.monsters=[]; projs=[]; clouds=[]; boltFx=[]; zapQueue=[];
  if(here.D.tall)for(const i of cs)here.D.tall[i]=0;
  return {cx,cz,x:(cx+0.5)*CELL,z:(cz+0.5)*CELL};
}
// ---------------------------------------------------------------- the bestiary: one creature at a time, turning slowly in the light
function showroom(){
  // a run seed whose depth 4 is the great hall
  adv.runSeed=7; here.depth=4; here.branch=null; here.realm=null; here.inter={key:'bigroom',after:4}; adv.runState.startChosen=true; adv.runState.altar1=true; here.showroomGen=true; newLevel(424242); here.showroomGen=false; here.inter=null;
  const W=MW, open=i=>i>=0&&i<NCELL&&here.D.tile[i]===TF&&!here.D.liquid[i];
  let best=-1, bc=-1; for(let i=W*2;i<NCELL-W*2;i++){ if(!open(i))continue; const cx=i%W, cz=(i/W)|0; let c=0;
      for(let r=1;r<=12;r++){ let ok=true; for(let a=0;a<16&&ok;a++){ const an=a/16*Math.PI*2, j=Math.round(cz+Math.sin(an)*r)*W+Math.round(cx+Math.cos(an)*r); if(!open(j))ok=false; } if(!ok)break; c=r; }
      if(c>bc){ bc=c; best=i; } }
  const cx=best%W, cz=(best/W)|0, x=(cx+0.5)*CELL, z=(cz+0.5)*CELL;
  here.D.items=[]; here.D.steles=[]; here.monsters=[]; projs=[]; clouds=[]; boltFx=[]; zapQueue=[];
  here.fixtures=here.fixtures.filter(f=>{ const d=Math.hypot(f.x-x,f.z-z); if(d<8&&f.li!==undefined&&here.D.lights[f.li])here.D.lights[f.li].int=0; return d>=8; });
  for(const L of here.D.lights)if(Math.hypot(L.x-x,L.z-z)<8)L.int=0;
  // the open direction for the camera
  let dir=0, far=0; for(let a=0;a<16;a++){ const an=a/16*Math.PI*2; let d=0; for(let r=0.5;r<30;r+=0.5){ const j=Math.floor((z+Math.sin(an)*r)/CELL)*W+Math.floor((x+Math.cos(an)*r)/CELL); if(!open(j))break; d=r; } if(d>far){ far=d; dir=an; } }
  return {cx,cz,x,z,dir,far};
}
function openBestiary(){
  const all=galleryList(), list=DEVALL?all:all.filter(e=>SEEN.has(e.key));
  introEl.classList.add('gone'); const room=showroom();
  gallery={mode:'beast',list,all:all.length,idx:0,room,m:null,t:0};
  showBeast(0); renderGallery(); document.getElementById('gal').classList.add('show');
}
function showBeast(i){
  const g=gallery; here.monsters=[]; g.m=null; if(!g.list.length){ renderGallery(); return; }
  g.idx=(i+g.list.length)%g.list.length; const e=g.list[g.idx];
  MTYPES.__gal=e.ty; const m=makeMonster({key:'__gal',cx:g.room.cx,cz:g.room.cz,g:-1,lead:true});
  m.x=g.room.x; m.z=g.room.z; m.sleep=false; m.hidden=false; m.wait=1e9; m.galShow=true; m.heartOn=true; m.rise=1; m.surf=1; m.yaw=0; if(e.ty.form==='eel')m.y=0;
  g.water=e.ty.form==='kraken'||e.ty.form==='deepkraken'||e.ty.form==='eel'||e.ty.form==='fish'||e.ty.habitat==='deep'; if(g.water&&e.ty.form==='kraken')m.y=-0.25*(e.ty.scale||1); if(e.ty.form==='deepkraken')m.y=0; if(e.ty.habitat==='bog')m.y=0;
  here.monsters.push(m); g.m=m; g.t=0; renderGallery();
}
function updateGallery(dt){
  if(!gallery)return; const g=gallery;
  if(g.mode==='beast'&&g.m){ const m=g.m, sc=m.ty.scale||1; g.t+=dt; const walking=Math.floor(g.t/4)%2===1;
    m.moving+=((walking?1:0)-m.moving)*Math.min(1,dt*4); m.walk+=dt*2.2*m.moving; m.yaw+=dt*0.45; m.x=g.room.x; m.z=g.room.z;
    if(m.ty.form==='dragon'&&!m.ty.boss){ m.sleep=Math.floor(g.t/6)%2===0; if(m.sleep){ m.moving=0; } }
    { const ty=m.ty; if(ty.flier)m.y=(1.6+Math.sin(g.t*2.2)*0.15)*Math.max(1,sc*0.7); else if(ty.fl)m.y=ty.fl+Math.sin(g.t*1.3)*0.12; }
    const tall=m.ty.beast?1.3:m.ty.form==='lichking'?1.6:m.ty.form==='spiderqueen'?1.25:m.ty.form==='nagaqueen'?1.3:m.ty.form==='olddragon'?0.85:m.ty.form==='shadowking'?1.75:m.ty.form==='shadowserpent'?1.9:m.ty.form==='deepkraken'?2.0:1, want=(3.0+2.0*sc)*tall, R=Math.max(2,Math.min(want,g.room.far-0.8)), a=g.room.dir+0.25, cx=g.room.x+Math.cos(a)*R, cz=g.room.z+Math.sin(a)*R, ch=(1.0+0.75*sc)*tall+(m.ty.flier||m.ty.fl>0.5?m.y*0.5:0), ty2=Math.max(0.3,m.y+(m.ty.flier?0:0.6*sc*tall));
    player.x=cx; player.z=cz; player.yaw=Math.atan2(-(g.room.x-cx),-(g.room.z-cz)); player.pitch=Math.atan2(ty2-ch,R)-0.16;
    camera.position.set(cx,ch,cz); camera.rotation.set(player.pitch,player.yaw,0);
    if(R<want-0.2){ U.uCamP.value.set(cx,ch,cz); U.uCutP.value.set(g.room.x,ty2,g.room.z); U.uCut.value=1; } else U.uCut.value=0;
    vfx.zapFlash={x:g.room.x+Math.cos(a)*R*0.6,y:2.2+1.2*sc,z:g.room.z+Math.sin(a)*R*0.6,col:[0.5,0.48,0.45],t:999,r:7+3*sc}; }
  if(g.mode==='range'){ for(const d of g.dummies){ if(d.m.dead){ d.respawn-=dt; if(d.respawn<=0)spawnDummy(d); } else { d.respawn=1.5; d.m.dT=Math.max(0,(d.m.dT||0)-dt); if(d.m.dT<=0)d.m.dsum=0; } } }
}
function renderGallery(){
  const el=document.getElementById('gal'); if(!el||!gallery)return; const g=gallery, f=t=>`<span class="f">${t}</span>`;
  if(g.mode==='beast'){ const e=g.list[g.idx], ty=e&&e.ty, GW=64;
    const head=ty?`<b style="color:${css(ty.col||[1,1,1])}">${ty.ch==='&'?'&amp;':ty.ch}</b> <b>${ty.name}</b>`:'<span class="lab">まだ、何にも出会っていない</span>';
    const desc=wrapPlain(ty?ty.verb||'':'冒険で出会ったものが、ここに並ぶ',GW-4); while(desc.length<2)desc.push('');
    el.innerHTML=boxText([f('+-- 図鑑 ---'),`${f('|')} ${head}`,`${f('|')} <span class="lab">${desc[0]}</span>`,`${f('|')} <span class="lab">${desc[1]}</span>`,f('|'),
      `${f('|')} <button class="row" data-g="prev">[&lt;]</button> ${String(g.list.length?g.idx+1:0).padStart(2,' ')} / ${String(g.list.length).padStart(2,' ')}  <span class="lab">（見つけた数 ${String([...SEEN].filter(k=>k).length).padStart(2,' ')} / ${g.all}）</span> <button class="row" data-g="next">[&gt;]</button>`,
      `${f('|')} <button class="row" data-g="back">[タイトルへ戻る]</button>   <span class="lab">← → で切り替え　Esc で戻る</span>`,f('+---')],GW);
    for(const b of el.querySelectorAll('button[data-g]'))b.onclick=()=>{ const k=b.dataset.g; if(k==='prev')showBeast(g.idx-1); else if(k==='next')showBeast(g.idx+1); else returnToTitle(); }; }
}
// ---------------------------------------------------------------- the testing chamber: every rune found so far, and dummies that get back up
// DUMMY_KINDS は src/lib/names.ts（src/game/imports.mjs で読む）
for(const d of DUMMY_KINDS){ MTYPES[d.k]={ch:'+',name:d.name,col:d.col,form:'humanoid',scale:0.95,speed:0,fl:0,light:1.6,trail:0,dummy:true,verb:'藁と石で組まれた的。何度倒れても、また起き上がる'}; MSTAT[d.k]=[60,0,0,99]; }
RES.dummyF={fire:0.2,ice:2}; RES.dummyP={poison:0.2,fire:2}; RES.dummyT={thunder:2,fire:0.5};
function spawnDummy(d){ const m=makeMonster({key:d.k,cx:Math.floor(d.x/CELL),cz:Math.floor(d.z/CELL),g:-1,lead:true}); m.x=d.x; m.z=d.z; m.yaw=0; m.sleep=false; m.wait=1e9; m.noticed=false; m.dsum=0;
  here.monsters.push(m); d.m=m; d.respawn=1.5; for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(d.x,0.4,d.z,Math.cos(a),0.6+mr(),Math.sin(a),0.6,G('.'),0.12,1.2,1.1,0.9,0); } }
function openRange(){
  introEl.classList.add('gone'); sndInit(); resetRunes(); const room=galleryRoom(52571);
  gallery={mode:'range',room,dummies:[]};
  const types=Object.keys(RUNE_DEF).filter(t=>RUNE_DEF[t].cat!=='open'&&RUNE_DEF[t].cat!=='sub'&&(RUNE_DEF[t].cat!=='mod'||RUNE_TYPES.mod.includes(t))&&(DEVALL||RSEEN.has(t)||t==='blade'||t==='bolt'||RUNE_DEF[t].cat==='mod'));
  gear.bag=[]; for(const t of types)gear.bag.push(makeRune(t,0));
  for(const h of ['L','R']){ gear.hands[h].slotN=SLOT_MAX; while(gear.hands[h].slots.length<SLOT_MAX)gear.hands[h].slots.push(null); } for(const t of RUNE_TYPES.mod)gear.bag.push(makeStrong(t)); for(const w of RUNE_TYPES.atk)for(const k of Object.keys(TRAITS[w]))for(const lv of [3,5]){ const ru=makeRune(w,0); ru.traits=[{k,lv}]; gear.bag.push(ru); } gear.hands.B=gear.hands.B||{b0:null,b1:null}; adv.runState.bodyOpen=2;
  DUMMY_KINDS.forEach((dk,j)=>{ const d={k:dk.k,x:room.x+(j-1.5)*2.4,z:room.z-5}; gallery.dummies.push(d); spawnDummy(d); });
  player.x=room.x; player.z=room.z+3; player.yaw=0; player.pitch=-0.05; player.hp=adv.PLAYER_MAX;
  adv.dead=false; ui.started=true; document.body.classList.add('started'); adv.runStats={kills:0,t0:time};
  canvas.focus(); tryLock(); updateResume(); renderHotbar(); renderStatus();
  setTimeout(()=>{ msg('<b style="color:#bfe4ff">+</b>試しの間。<b>Tab</b> で武器・ルーン・護符を自由に付け替えられる（ここでは付け替えが一瞬で済む）。'); msg('<span class="lab">的の人形は動かず、何度倒れても起き上がる。頭の上の数字は、直前に与えたダメージの合計。メニューからタイトルへ戻れる。</span>'); },400);
}
function drawGallery(t){
  if(!gallery)return;
  if(gallery.mode==='beast'&&gallery.m){ const g=gallery, sc=gallery.m.ty.scale||1, r=0.9+0.7*sc, n=Math.round(18+8*sc);
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.05; dyn(g.room.x+Math.cos(a)*r,0.06,g.room.z+Math.sin(a)*r,G('.'),0.1,0.35,0.33,0.4); }
    if(g.water)for(let k=0;k<Math.round(30*sc);k++){ const a=k*2.399, rr=(0.4+((k*0.37)%1))*1.6*sc; dyn(g.room.x+Math.cos(a)*rr,0.05+0.03*Math.sin(t*2+k),g.room.z+Math.sin(a)*rr,G('~'),0.22,0.25,0.55,0.9); } }
  if(gallery.mode==='range'){ for(const d of gallery.dummies){ const m=d.m; if(!m||m.dead||!(m.dsum>0))continue; const s=String(Math.round(m.dsum)), y=m.y+2.2;
      for(let k=0;k<s.length;k++)dyn(m.x+(k-(s.length-1)/2)*0.26,y,m.z,G(s[k]),0.32,2.6,2.3,1.6); } }
}

