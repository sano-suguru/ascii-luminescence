// ---------------------------------------------------------------- what has been met and found (kept across runs); a developer switch shows everything
// 保存する saveSet は src/lib/save.ts（src/game/imports.mjs で読む）
const loadSet=k=>{ try{ return new Set(JSON.parse(localStorage.getItem(k)||'[]')); }catch(e){ return new Set(); } };
saved.SEEN=loadSet('al_seen');
saved.RSEEN=loadSet('al_runes');
// developer mode (saved.DEVALL) is read in 17-meta.js, before the title is built

let seenT=0;
const seenKey=m=>m.ty.beast?'beast:'+adv.runSeed+':'+m.ty.name:m.key==='lord'?'lord:'+(here.branch?here.branch.key:m.ty.sk):(m.key==='final'&&m.phase2)?'final2':m.key;
function trackSeen(dt){
  if(!ui.started||ui.gallery)return; seenT-=dt; if(seenT>0)return; seenT=0.5; const n0=saved.SEEN.size;
  for(const m of here.monsters){ if(m.dead||m.hidden||!m.visible||m.ty.dummy)continue; if(Math.hypot(m.x-player.x,m.z-player.z)<26){ saved.SEEN.add(seenKey(m)); if(m.ty.beast)recordBeast(m.ty); } }
  if(saved.SEEN.size!==n0)saveSet('al_seen',saved.SEEN);
}
// LORD_GAL は src/lib/names.ts（src/game/imports.mjs で読む）
function galleryList(){
  const out=[]; for(const k of Object.keys(MTYPES)){ if(k==='lord'||k==='final'||k==='final2'||k==='X'||k.startsWith('__')||k.startsWith('dummy'))continue; out.push({key:k,ty:MTYPES[k]}); }
  for(const rec of loadBeasts().concat(saved.DEVALL?beastSamples():[]))out.push({key:'beast:'+rec.seed+':'+rec.name,ty:{...rec,ch:'X',form:'beast',beast:true,light:9,boss:false,verb:rec.lore}});
  for(const [bk,L] of Object.entries(LORD_GAL)){ const base=MTYPES[L.base]; if(!base)continue; out.push({key:'lord:'+bk,ty:{...base,sk:L.base,name:L.name,scale:L.scale,verb:L.verb,boss:true,col:L.base==='L'?[0.75,0.9,1.0]:base.col,look:({crypt:null,lair:null,nest:null,snake:null})[bk]||base.look,...(bk==='lair'?{form:'olddragon',light:5}:bk==='sunken'?{form:'deepkraken',light:5}:bk==='crypt'?{form:'lichking',light:7}:bk==='nest'?{form:'spiderqueen',light:6}:bk==='snake'?{form:'nagaqueen',light:6}:{})}}); }
  out.push({key:'final',ty:{...MTYPES.L,ch:'&',look:null,form:'shadowking',sk:'final',name:'王の影',scale:SHADOW_KING_SC,col:[0.62,0.48,1.0],boss:true,lich:false,light:6,verb:'光の届かない底で、長い剣を手に立っている。頭の上に、黒い太陽が浮かんでいる'}});
  out.push({key:'final2',ty:{...MTYPES.L,ch:'&',look:null,form:'shadowserpent',sk:'final2',name:'王の影（底の闇）',scale:SHADOW_KING_SC,col:[0.62,0.48,1.0],boss:true,lich:false,light:6,verb:'冠と外套を失い、底の闇から長い体をもたげた影'}});
  return out;
}
// a quiet room from a fixed maze: everything else is cleared away
function galleryRoom(seed){
  here.depth=1; here.branch=null; here.realm=null; here.inter=null; adv.runState.startChosen=true; adv.runState.altar1=true; newLevel(seed);
  let best=null,bl=0; for(const r of here.D.rooms){ if(r.cells.length>bl&&!r.cave&&!r.vault){ bl=r.cells.length; best=r; } }
  const cs=best.cells, cx=Math.round(cs.reduce((s,i)=>s+i%MW,0)/cs.length), cz=Math.round(cs.reduce((s,i)=>s+((i/MW)|0),0)/cs.length);
  here.D.items=[]; here.D.steles=[]; here.monsters=[]; fight.projs=[]; fight.clouds=[]; fight.boltFx=[]; fight.zapQueue=[];
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
  // the room's events too (statues, eruptions, floods and the like start when the player comes near, and change the cells)
  here.D.items=[]; here.D.steles=[]; here.monsters=[]; here.events=[]; fight.projs=[]; fight.clouds=[]; fight.boltFx=[]; fight.zapQueue=[];
  here.fixtures=here.fixtures.filter(f=>{ const d=Math.hypot(f.x-x,f.z-z); if(d<8&&f.li!==undefined&&here.D.lights[f.li])here.D.lights[f.li].int=0; return d>=8; });
  for(const L of here.D.lights)if(Math.hypot(L.x-x,L.z-z)<8)L.int=0;
  // the open direction for the camera
  let dir=0, far=0; for(let a=0;a<16;a++){ const an=a/16*Math.PI*2; let d=0; for(let r=0.5;r<30;r+=0.5){ const j=Math.floor((z+Math.sin(an)*r)/CELL)*W+Math.floor((x+Math.cos(an)*r)/CELL); if(!open(j))break; d=r; } if(d>far){ far=d; dir=an; } }
  return {cx,cz,x,z,dir,far};
}
function openBestiary(){
  const all=galleryList(), list=saved.DEVALL?all:all.filter(e=>saved.SEEN.has(e.key));
  introEl.classList.add('gone');
  // 部屋を作る前に入れる（階を作る処理が、図鑑の中だと分かるように。探索の届いた深さや墓に触れない）
  ui.gallery={mode:'beast',list,all:all.length,idx:0,room:null,m:null,t:0}; ui.gallery.room=showroom();
  // the room's fittings and lamps as they are now: each creature shown puts them back (showBeast)
  ui.gallery.still=structuredClone({fixtures:here.fixtures,lights:here.D.lights});
  showBeast(0); renderGallery(); document.getElementById('gal').classList.add('show');
}
function showBeast(i){
  const g=ui.gallery; here.monsters=[]; g.m=null; g.fix=null; g.view=null; g.drag=null; g.aimY=undefined; g.rNow=undefined; if(!g.list.length){ renderGallery(); return; }
  g.idx=(i+g.list.length)%g.list.length; const e=g.list[g.idx];
  // while a creature is on show, the visual random (mr) reads a sequence of its own, from its key: here (its shape and first values, then the falling dust made anew),
  // and in each step of the game (stepTick). So draws elsewhere (before it was shown, or outside the game's steps) do not change the picture.
  // The player stands at the room's middle until the first step puts it at the camera: the dust is made round the player (and made again when it strays
  // 16 away), and a few auras look at how far the player is, so neither hangs on where the last creature's camera was. For the same reason the eye's
  // exposure and the fog settle at once, in the step after the camera is placed (settle: 1 waits for updateGallery to place it, 2 settles in updateAtmosphere).
  // The fittings and lamps go back to how they were when the bestiary opened: they keep counters that run only while the player is within 46
  // (the sparks' f.acc, f.next, the lamps' fade and boost). The lamps are refilled in place, the same number as then
  { const s=structuredClone(g.still), Ls=here.D.lights; here.fixtures=s.fixtures; Ls.length=s.lights.length;
    s.lights.forEach((S,k)=>{ const L=Ls[k]; if(!L){ Ls[k]=S; return; } for(const a of Object.keys(L))delete L[a]; Object.assign(L,S); }); }
  MTYPES.__gal=e.ty; g.rnd=keyedRand('gallery '+e.key); player.x=g.room.x; player.z=g.room.z; g.settle=1;
  // makeMonster is handed g.rnd as the creature's own sequence (m.rnd), so what it makes when first drawn (in the first step) reads it too
  const m=withVisualRand(g.rnd,()=>{ const m=makeMonster({key:'__gal',cx:g.room.cx,cz:g.room.cz,g:-1,lead:true},g.rnd); initDust(); return m; });
  m.x=g.room.x; m.z=g.room.z; m.sleep=false; m.hidden=false; m.wait=1e9; m.galShow=true; m.heartOn=true; m.rise=1; m.surf=1; m.yaw=0; if(e.ty.form==='eel')m.y=0;
  g.water=e.ty.form==='kraken'||e.ty.form==='deepkraken'||e.ty.form==='eel'||e.ty.form==='fish'||e.ty.habitat==='deep'; if(g.water&&e.ty.form==='kraken')m.y=-0.25*(e.ty.scale||1); if(e.ty.form==='deepkraken')m.y=0; if(e.ty.habitat==='bog')m.y=0;
  here.monsters.push(m); g.m=m; g.t=0; renderGallery();
}
// the player's hands on the bestiary: the wheel moves in and out (the distance from 0.6 to 2 times the usual one), a drag with the left button turns the creature
// (across) and moves the camera up and down round it (up and down), R puts it back. After GAL_IDLE s with no hands on it, the creature turns by itself again;
// the distance and the angle stay. Moving to another creature puts everything back (showBeast)
// GAL_EASE: in the player's view, the aim and the distance move toward new ones at this rate (per second; most of the way in about half a second),
// so the camera does not jump when the wheel turns or a dragon wakes or falls asleep (its body changes over about a second)
const GAL_IDLE=3, GAL_ZOOM=[0.5,1/0.6], GAL_EASE=8;
// a new view starts its eased aim and distance from where the camera is now (g.aimY, g.rNow), so the first turn of the wheel does not jump either
function galleryView(){ const g=ui.gallery; if(!g.view)g.view={zoom:1,pitch:null,t:g.t,aimS:g.aimY,rS:g.rNow}; g.view.t=g.t; return g.view; }
// dy: the wheel's movement in pixels (one notch of a mouse wheel is about 100, a 10% step; a trackpad sends many small ones, each a small step)
function galleryWheel(dy){ const g=ui.gallery; if(!g||g.mode!=='beast'||!g.m||g.fix||!dy)return; const v=galleryView(); v.zoom=clamp(v.zoom*Math.pow(1.1,-clamp(dy,-100,100)/100),GAL_ZOOM[0],GAL_ZOOM[1]); }
function galleryDrag(dx,dy){ const g=ui.gallery; if(!g||g.mode!=='beast'||!g.m||g.fix)return; const v=galleryView();
  // the first move up or down starts from where the camera is now: its angle (tiltNow), and its distance from the point it looks at as a part of R (stretchNow)
  g.m.yaw+=dx*0.01; if(dy){ if(v.pitch===null)v.stretch=g.stretchNow??1; v.pitch=clamp((v.pitch??g.tiltNow??0)+dy*0.006,-0.3,1.3); } }
function galleryReset(){ const g=ui.gallery; if(!g||g.mode!=='beast')return; g.view=null; g.drag=null; }
function updateGallery(dt){
  if(!ui.gallery)return; const g=ui.gallery;
  // g.fix (set only by __test.galleryShow): hold the creature at one angle (yaw from facing the camera) and one pose, and move the camera:
  // zoom divides the distance (still kept inside the room, and a zoom in stops outside the creature's body), pitch puts the camera that many radians above
  // the creature's middle, kept under the ceiling (null: the height the bestiary works out from the creature's size).
  // g.view (set by the player's wheel and drag, see galleryWheel): the same zoom and pitch; while the player handles it, and for GAL_IDLE s after, the creature stops turning
  if(g.mode==='beast'&&g.m){ const m=g.m, sc=m.ty.scale||1, fix=g.fix, cam=fix||g.view; g.t+=dt; const walking=fix?fix.pose==='walk':Math.floor(g.t/4)%2===1;
    const handled=!!(g.drag||(g.view&&g.t-g.view.t<GAL_IDLE));
    m.moving+=((walking?1:0)-m.moving)*Math.min(1,dt*4); m.walk+=dt*2.2*m.moving; if(!fix&&!handled)m.yaw+=dt*0.45; m.x=g.room.x; m.z=g.room.z;
    if(fix){ m.sleep=fix.pose==='sleep'; if(m.sleep)m.moving=0; }
    else if(m.ty.form==='dragon'&&!m.ty.boss){ m.sleep=Math.floor(g.t/6)%2===0; if(m.sleep){ m.moving=0; } }
    { const ty=m.ty; if(ty.flier)m.y=(1.6+Math.sin(g.t*2.2)*0.15)*Math.max(1,sc*0.7); else if(ty.fl)m.y=ty.fl+Math.sin(g.t*1.3)*0.12; }
    // how far and how high the camera sits, by form (the old dragon's long neck brings its head close when it turns this way: 1.05 sits a little farther and higher than 1)
    const tall=m.ty.beast?1.3:m.ty.form==='lichking'?1.6:m.ty.form==='spiderqueen'?1.25:m.ty.form==='nagaqueen'?1.3:m.ty.form==='olddragon'?1.05:m.ty.form==='shadowking'?1.75:m.ty.form==='shadowserpent'?1.9:m.ty.form==='deepkraken'?2.0:1,
      zoom=cam?cam.zoom:1, tilt=cam?cam.pitch:null;
    // the shape the camera is fitted to: a sleeping dragon or beast curls up into its own sleeping shape, which is built the first time it is drawn asleep;
    // until then (one tick) the centre waits for it, and the aim and the ball below keep the last ones (both are worked out again whenever the shape changes, as a dragon wakes and sleeps)
    const shape=cam?(m.sleep&&((m.ty.form==='dragon'&&!m.ty.boss)||m.ty.beast)?m.formSleep:m.form):null;
    // center (set only by __test.galleryShow): look at the middle of the body's height (halfway between its lowest and highest point, worked out once per creature)
    // and put it in the middle of the picture; otherwise turn the camera a little below the point it aims at, so the creature stands high, above the bestiary's panel
    if(fix&&fix.center&&fix.midOff===undefined&&shape){ let lo=Infinity, hi=-Infinity; for(const p of shape){ const y=(p.y||0)*sc; if(y<lo)lo=y; if(y>hi)hi=y; } fix.midOff=lo<=hi?(lo+hi)/2:0; }
    // the player's zoom in (g.view): the closer the camera, the more the aim rises from the usual point to the middle of the body's height, so a tall creature's head stays in the picture
    if(!fix&&g.view&&shape&&g.view.midFor!==shape){ let lo=Infinity, hi=-Infinity; for(const p of shape){ const y=(p.y||0)*sc; if(y<lo)lo=y; if(y>hi)hi=y; } g.view.midFor=shape; g.view.midOff=lo<=hi?(lo+hi)/2:0; }
    const lift=!fix&&g.view&&g.view.midOff!==undefined?clamp((zoom-1)/(GAL_ZOOM[1]-1),0,1):0, usual=m.y+(m.ty.flier?0:0.6*sc*tall);
    const centered=!!(fix&&fix.center&&fix.midOff!==undefined); let ty2=centered?Math.max(0.3,m.y+fix.midOff):Math.max(0.3,lift?usual+lift*Math.max(0,m.y+g.view.midOff-usual):usual);
    const ease=Math.min(1,dt*GAL_EASE);
    if(!fix&&g.view){ g.view.aimS=g.view.aimS===undefined?ty2:g.view.aimS+(ty2-g.view.aimS)*ease; ty2=g.view.aimS; }
    // a zoom in stops outside a ball round the point the camera looks at, wide enough to hold every point of the body (worked out again when the shape or that point changes)
    if(cam&&zoom>1&&shape&&(cam.bodyFor!==shape||Math.abs(cam.bodyAt-ty2)>0.01)){ cam.bodyFor=shape; cam.bodyAt=ty2; cam.bodyR=shape.reduce((r,p)=>p.part==='train'?r:Math.max(r,Math.hypot((p.x||0)*sc,(p.y||0)*sc+m.y-ty2,(p.z||0)*sc)),0); }
    const ball=cam&&zoom>1&&cam.bodyR!==undefined?cam.bodyR+0.8:0;
    const want=(3.0+2.0*sc)*tall/zoom, a=g.room.dir+0.25; let R=Math.max(Math.min(2,2/zoom),ball,Math.min(want,g.room.far-0.8));
    if(!fix&&g.view){ g.view.rS=g.view.rS===undefined?R:g.view.rS+(R-g.view.rS)*ease; R=g.view.rS; } g.rNow=R;
    // Rt: how far the camera sits from the point it looks at when it has a pitch (the player's view keeps the distance it had before the first move up or down, see galleryDrag)
    const Rt=R*(cam&&cam.stretch||1);
    let Rh=tilt===null?R:Rt*Math.cos(tilt), ch;
    if(tilt===null)ch=(1.0+0.75*sc)*tall+(m.ty.flier||m.ty.fl>0.5?m.y*0.5:0);
    else { ch=Math.max(0.3,Math.min(ty2+Rt*Math.sin(tilt),ceilAt(g.room.x+Math.cos(a)*Rh,g.room.z+Math.sin(a)*Rh)-0.4));
      // held by the floor or the ceiling: step back across the floor so the camera stays R from the point it looks at (but not out of the room)
      Rh=Math.min(Math.max(Rh,Math.sqrt(Math.max(0,Rt*Rt-(ch-ty2)*(ch-ty2)))),Math.max(Rh,g.room.far-0.8)); }
    const cx=g.room.x+Math.cos(a)*Rh, cz=g.room.z+Math.sin(a)*Rh;
    player.x=cx; player.z=cz; player.yaw=Math.atan2(-(g.room.x-cx),-(g.room.z-cz)); player.pitch=Math.atan2(ty2-ch,Rh)-(centered?0:0.16); g.aimY=ty2; g.tiltNow=Math.atan2(ch-ty2,Rh); g.stretchNow=Math.hypot(Rh,ch-ty2)/R;
    if(fix)m.yaw=player.yaw+fix.yaw;
    if(!!m.sleep!==!!g.shownSleep)galleryLine(); // a dragon fell asleep or woke: show the line that fits
    gfx.camera.position.set(cx,ch,cz); gfx.camera.rotation.set(player.pitch,player.yaw,0); if(g.settle===1)g.settle=2; // the camera is placed: the eye settles in the next step
    if(R<want-0.2){ gfx.U.uCamP.value.set(cx,ch,cz); gfx.U.uCutP.value.set(g.room.x,ty2,g.room.z); gfx.U.uCut.value=1; } else gfx.U.uCut.value=0;
    vfx.zapFlash={x:g.room.x+Math.cos(a)*Rh*0.6,y:2.2+1.2*sc,z:g.room.z+Math.sin(a)*Rh*0.6,col:[0.5,0.48,0.45],t:999,r:7+3*sc}; }
  if(g.mode==='range'){ for(const d of g.dummies){ if(d.m.dead){ d.respawn-=dt; if(d.respawn<=0)spawnDummy(d); } else { d.respawn=1.5; d.m.dT=Math.max(0,(d.m.dT||0)-dt); if(d.m.dT<=0)d.m.dsum=0; } } }
}
// the two lines under the name follow the creature: while it sleeps, its sleeping line (GALLERY_SLEEP: only the dragon has one), otherwise what it does awake.
// Each line is padded to the same width, so the frame around them never moves when the words change
function galleryDesc(g){ const e=g.list[g.idx], ty=e&&e.ty, GW=64; g.shownSleep=!!(g.m&&g.m.sleep);
  const desc=wrapPlain(ty?(g.shownSleep&&GALLERY_SLEEP[e.key])||ty.verb||'':'探索で出会ったものが、ここに並ぶ',GW-4); while(desc.length<2)desc.push('');
  return desc.slice(0,2).map(l=>padTo(l,GW-4)); }
// change only those two lines (rebuilding the whole panel would swap the buttons under a press in progress)
function galleryLine(){ const g=ui.gallery, el=document.getElementById('gal'); if(!g||!el)return; const spans=el.querySelectorAll('span[data-gd]');
  if(spans.length!==2){ renderGallery(); return; } const desc=galleryDesc(g); spans.forEach((s,i)=>{ s.textContent=desc[i]; }); }
function renderGallery(){
  const el=document.getElementById('gal'); if(!el||!ui.gallery)return; const g=ui.gallery, f=t=>`<span class="f">${t}</span>`;
  if(g.mode==='beast'){ const e=g.list[g.idx], ty=e&&e.ty, GW=64;
    const head=ty?`<b style="color:${css(ty.col||[1,1,1])}">${ty.ch==='&'?'&amp;':ty.ch}</b> <b>${ty.name}</b>`:'<span class="lab">まだ、何にも出会っていない</span>';
    const desc=galleryDesc(g);
    el.innerHTML=boxText([f('+-- 図鑑 ---'),`${f('|')} ${head}`,`${f('|')} <span class="lab" data-gd="0">${desc[0]}</span>`,`${f('|')} <span class="lab" data-gd="1">${desc[1]}</span>`,f('|'),
      `${f('|')} <button class="row" data-g="prev">[&lt;]</button> ${String(g.list.length?g.idx+1:0).padStart(2,' ')} / ${String(g.list.length).padStart(2,' ')}  <span class="lab">（見つけた数 ${String([...saved.SEEN].filter(k=>k).length).padStart(2,' ')} / ${g.all}）</span> <button class="row" data-g="next">[&gt;]</button>`,
      `${f('|')} <button class="row" data-g="back">[タイトルへ戻る]</button>   <span class="lab">← → で切り替え　Esc で戻る</span>`,`${f('|')} <span class="lab">ドラッグで回す　ホイールで寄る　R で戻す</span>`,f('+---')],GW);
    for(const b of el.querySelectorAll('button[data-g]'))b.onclick=()=>{ const k=b.dataset.g; if(k==='prev')showBeast(g.idx-1); else if(k==='next')showBeast(g.idx+1); else returnToTitle(); }; }
}
// ---------------------------------------------------------------- the testing chamber: every rune found so far, and dummies that get back up
// DUMMY_KINDS は src/lib/names.ts（src/game/imports.mjs で読む）
for(const d of DUMMY_KINDS){ MTYPES[d.k]={ch:'+',name:d.name,col:d.col,form:'humanoid',scale:0.95,speed:0,fl:0,light:1.6,trail:0,dummy:true,verb:'藁と石で組まれた的。何度倒れても、また起き上がる'}; }
RES.dummyF={fire:0.2,ice:2}; RES.dummyP={poison:0.2,fire:2}; RES.dummyT={thunder:2,fire:0.5};
function spawnDummy(d){ const m=makeMonster({key:d.k,cx:Math.floor(d.x/CELL),cz:Math.floor(d.z/CELL),g:-1,lead:true}); m.x=d.x; m.z=d.z; m.yaw=0; m.sleep=false; m.wait=1e9; m.noticed=false; m.dsum=0;
  here.monsters.push(m); d.m=m; d.respawn=1.5; for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(d.x,0.4,d.z,Math.cos(a),0.6+mr(),Math.sin(a),0.6,G('.'),0.12,1.2,1.1,0.9,0); } }
function openRange(){
  introEl.classList.add('gone'); sndInit(); resetRunes();
  ui.gallery={mode:'range',room:null,dummies:[]}; const room=ui.gallery.room=galleryRoom(52571); // 部屋を作る前に入れる（図鑑と同じ）
  const types=Object.keys(RUNE_DEF).filter(t=>RUNE_DEF[t].cat!=='open'&&RUNE_DEF[t].cat!=='sub'&&(RUNE_DEF[t].cat!=='mod'||RUNE_TYPES.mod.includes(t))&&(saved.DEVALL||saved.RSEEN.has(t)||t==='blade'||t==='bolt'||RUNE_DEF[t].cat==='mod'));
  gear.bag=[]; for(const t of types)gear.bag.push(makeRune(t));
  for(const h of ['L','R']){ gear.hands[h].slotN=SLOT_MAX; while(gear.hands[h].slots.length<SLOT_MAX)gear.hands[h].slots.push(null); } for(const t of RUNE_TYPES.mod)gear.bag.push(makeStrong(t)); for(const w of RUNE_TYPES.atk)for(const k of Object.keys(TRAITS[w]))for(const lv of [3,5]){ const ru=makeRune(w); ru.traits=[{k,lv}]; gear.bag.push(ru); } gear.hands.B=gear.hands.B||{b0:null,b1:null}; adv.runState.bodyOpen=2;
  DUMMY_KINDS.forEach((dk,j)=>{ const d={k:dk.k,x:room.x+(j-1.5)*2.4,z:room.z-5}; ui.gallery.dummies.push(d); spawnDummy(d); });
  player.x=room.x; player.z=room.z+3; player.yaw=0; player.pitch=-0.05; player.hp=adv.PLAYER_MAX;
  adv.dead=false; ui.started=true; document.body.classList.add('started'); adv.runStats={kills:0,t0:clock.time};
  canvas.focus(); tryLock(); updateResume(); renderHotbar(); renderStatus();
  setTimeout(()=>{ msg('<b style="color:#bfe4ff">+</b>試しの間。<b>'+byInput('Tab','[装備]')+'</b> で武器・ルーン・護符を自由に付け替えられる（ここでは付け替えが一瞬で済む）。'); msg('<span class="lab">的の人形は動かず、何度倒れても起き上がる。頭の上の数字は、直前に与えたダメージの合計。メニューからタイトルへ戻れる。</span>'); },400);
}
function drawGallery(t){
  if(!ui.gallery)return;
  if(ui.gallery.mode==='beast'&&ui.gallery.m){ const g=ui.gallery, sc=ui.gallery.m.ty.scale||1, r=0.9+0.7*sc, n=Math.round(18+8*sc);
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.05; dyn(g.room.x+Math.cos(a)*r,0.06,g.room.z+Math.sin(a)*r,G('.'),0.1,0.35,0.33,0.4); }
    if(g.water)for(let k=0;k<Math.round(30*sc);k++){ const a=k*2.399, rr=(0.4+((k*0.37)%1))*1.6*sc; dyn(g.room.x+Math.cos(a)*rr,0.05+0.03*Math.sin(t*2+k),g.room.z+Math.sin(a)*rr,G('~'),0.22,0.25,0.55,0.9); } }
  if(ui.gallery.mode==='range'){ for(const d of ui.gallery.dummies){ const m=d.m; if(!m||m.dead||!(m.dsum>0))continue; const s=String(Math.round(m.dsum)), y=m.y+2.2;
      for(let k=0;k<s.length;k++)dyn(m.x+(k-(s.length-1)/2)*0.26,y,m.z,G(s[k]),0.32,2.6,2.3,1.6); } }
}

