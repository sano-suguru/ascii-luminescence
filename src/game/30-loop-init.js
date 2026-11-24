// ---------------------------------------------------------------- sizing
function applySize(){
  frame.stillDrawn=false;
  const w=window.innerWidth, h=window.innerHeight;
  renderer.setPixelRatio(pixelRatio); renderer.setSize(w,h,false);
  composer.setPixelRatio(pixelRatio); composer.setSize(w,h);
  camera.aspect=w/h; camera.updateProjectionMatrix();
  U.uScale.value=(h*pixelRatio)/(2*Math.tan(camera.fov*Math.PI/360));
  finalPass.uniforms.uRes.value.set(w*pixelRatio,h*pixelRatio);
}
window.addEventListener('resize',()=>{ applySize(); sizeMap(); });

// ---------------------------------------------------------------- main loop
let last=0, fovT=0, mapT=0, perfT=0, perfAcc=0, perfN=0, warm=0;
function frame(nowMs){
  requestAnimationFrame(frame);
  if(TEST){ if(TESTQ.n>0){ TESTQ.n--; try{ testTick(true); } finally{ if(!TESTQ.n&&TESTQ.done){ const d=TESTQ.done; TESTQ.done=null; d(); } } } return; }
  const now=nowMs/1000; let raw=last?now-last:0.016; last=now;
  tick(raw,true);
}
const TESTQ={n:0,done:null};
function testTick(draw){ TESTCLK.advance(TEST_STEP*1000); tick(TEST_STEP,draw); }
function tick(raw,draw){
  if(isPaused()&&ui.started){ if(frame.stillDrawn)return; frame.stillDrawn=true; } else frame.stillDrawn=false; const dt=isPaused()?0:clamp(raw,0,0.05)*timeScale();
  clock.time+=dt; const t=clock.time;
  U.uTime.value=t;
  if(here.trans){
    here.trans.t+=dt;
    if(here.trans.phase==='out'){ here.fade=1-here.trans.t/0.8; if(here.trans.t>=0.8){ if(here.trans.regen)adv.runSeed=(Math.random()*1e9)>>>0; else advance(here.trans.go); newLevel(); here.trans={phase:'in',t:0}; here.fade=0; } }
    else { here.fade=here.trans.t/1.3; if(here.trans.t>=1.3){ here.trans=null; here.fade=1; } }
  } else here.fade=Math.min(1,here.fade+dt*0.8);
  updatePlayer(dt);
  updateStealth(dt);
  updateStatuses(dt);
  for(const m of here.monsters)if(!m.galShow&&!m.ty.dummy)updateMonster(m,dt*monTimeK(m),t);
  if(here.monsters.some(m=>m.dead))here.monsters=here.monsters.filter(m=>!m.dead);
  pfFrames++; pfT+=raw; if(pfT>=0.5){ pfFps=Math.round(pfFrames/pfT); pfFrames=0; pfT=0; if(ui.perfOn)renderStatus(); }
  regrow(); brimRecover(dt); if(!adv.dead){ updateTraps(dt); updateSearch(dt); } updateLife(dt);
  updateLights(t);
  updateAtmosphere(dt);
  dn=0; drawFixtures(t,dt); drawDoors(t,dt); drawFire(t,dt); drawWebs(t); drawTraps(t); drawSwing(); drawViewWeapons(t); drawOmens(t,dt); drawRunesWorld(t); updateAltarPanel(); drawArrows(); drawLegendWorld(t); drawBoltFx(t,dt); drawGallery(t); drawFrozen(t); drawCastFx(t); if(ui.camMode==='tps'&&here.D&&!gallery){ updateAvatar(dt); drawMonster0(avatar,t); drawSection(); } for(const m of here.monsters)drawMonster(m,t); flushDyn();
  updateParticles(dt,t);
  fovT+=dt; if(fovT>0.1){ fovT=0; computeFOV(); checkEvents(false); look(); stepGas(); stepFire(); }
  mapT+=dt; if(mapT>0.11){ mapT=0; if(ui.uiMode===0)drawMap(); }
  if(helpT>0){ helpT-=dt; if(helpT<=0&&ui.helpOn)setHelp(false); }
  finalPass.uniforms.uTime.value=t; finalPass.uniforms.uFade.value=clamp(here.fade,0,1); finalPass.uniforms.uHurt.value=vfx.hurtFlash+(player.hp<adv.PLAYER_MAX*0.25&&!adv.dead?0.18+0.08*Math.sin(t*4):0);
  if(ui.started&&!here.trans&&!adv.dead&&!isPaused())pickupItems();
  if(gear.hands)updateCast(dt);
  updateFinal(dt); updateGallery(dt); trackSeen(dt); updateFrozen(dt); cloudsMeetFire();
  updateCross(raw);
  updateProjs(dt);
  sndUpdate(dt); updateEvents(dt,t);
  cullChunks();
  if(draw)composer.render(dt);
  if(TEST)return; // keep the resolution fixed in tests
  warm+=raw; if(warm>3&&!document.hidden){ perfAcc+=raw; perfN++; perfT+=raw;
    if(perfT>2.5){ const avg=perfAcc/perfN; if(avg>1/48&&pixelRatio>0.75){ pixelRatio=Math.max(0.75,pixelRatio-0.2); applySize(); } perfT=perfAcc=perfN=0; } }
}

// ---------------------------------------------------------------- test hooks (only with ?test=1; see the test mode block at the top)
let testBoot=false;
if(TEST)window.__test={
  step:TEST_STEP,
  ready(){ return testBoot===true&&!!here.D; },
  error(){ return typeof testBoot==='string'?testBoot:null; },
  // step the game without drawing (fast); returns the game time
  advance(sec){ const n=Math.max(0,Math.round(sec/TEST_STEP)); for(let i=0;i<n;i++)testTick(false); return +clock.time.toFixed(4); },
  // step and draw n frames (one per animation frame)
  frames(n){ if(TESTQ.done)return Promise.reject(new Error('__test.frames: the previous call has not finished'));
    return new Promise(ok=>{ TESTQ.n=Math.max(0,n|0); if(!TESTQ.n)ok(); else TESTQ.done=ok; }); },
  // give every blessing at level n (default 1), so a level-up offers their next level (shown with II)
  bless(n=1){ for(const k in BLESS)adv.lvl.bless[k]=n; return Object.keys(BLESS).length; },
  // how many columns the panels count for a piece of text (visW)
  width(text){ return visW(text); },
  // a plain copy of what matters, to compare runs
  state(){ const f=v=>+(+v||0).toFixed(3);
    return {time:f(clock.time),seed:adv.runSeed,place:placeLabel(),depth:here.depth,started:ui.started,dead:adv.dead,hp:f(player.hp),pos:[f(player.x),f(player.z)],yaw:f(player.yaw),lvl:adv.lvl.n,
      monsters:here.monsters.map(m=>[m.key,f(m.x),f(m.z),f(m.hp),m.sleep?1:0]),projs:projs.length,
      trans:here.trans?here.trans.phase:null,cast:gear.castSt?{h:gear.castSt.h,t:f(gear.castSt.t),need:f(gear.castSt.need),full:gear.castSt.full}:null,recover:f(player.recover),paused:isPaused()}; },
  // hold a weapon (a RUNE_DEF key such as 'blade', 'bolt', 'orb'), and press / release a hand's button ('L' or 'R')
  equip(h,type){ if(!RUNE_DEF[type]||RUNE_DEF[type].cat!=='atk')return 'no such weapon: '+type; equipWeapon(h,makeRune(type,0)); renderHotbar(); return type; },
  // true when the hand started charging, or attacked at once (a weapon with no charge, such as the short sword)
  press(h){ const r0=player.recover||0; beginCast(h); return !!gear.castSt||(player.recover||0)>r0; },
  release(h){ releaseCast(h); },
  // the doors of this level (cell i, the room cell j next to it, how open o, burnt away), a cell (its middle x z, floor to stand on, seen now, explored, ash),
  // setting a cell on fire, and putting a creature (an MTYPES key such as 'Re') on a cell
  doors(){ return here.D.doors.map(d=>({i:d.i,j:d.j,o:+d.o.toFixed(3),gone:!!d.gone})); },
  cell(i){ return {x:(i%MW+0.5)*CELL,z:(((i/MW)|0)+0.5)*CELL,floor:here.D.tile[i]===TF&&!here.D.solid.has(i)&&!blocksWalk(here.D.liquid[i]),seen:here.fovVis[i]===here.fovStamp,explored:!!here.explored[i],burnt:!!burnt[i]}; },
  ignite(i){ ignite(i,1,false); },
  // lingering things of this level (fields, delayed hits, rains, marks on the floor): put one of each kind that is easy to make where the player stands
  // (a field with no element, so it does nothing to creatures), and count them
  addTraces(){ addZone(player.x,player.z,2,{elem:null},60,false); later(60,()=>{}); marks.push({x:player.x,z:player.z,r:1,t:60,c:[1,0.5,0.2]}); return this.traces(); },
  traces(){ return {zones:zones.length,laters:laters.length,rains:rains.length,marks:marks.length}; },
  // count the cells in sight now (the game does it every 0.1 s; a check that looks every frame should not miss a short moment)
  fov(){ computeFOV(); },
  summon(key,i){ if(!MTYPES[key])return 'no such creature: '+key; summon(key,i); return here.monsters.length; },
  // remove every creature (lords too), so a check is not upset by one that happens to be near
  clearAll(){ const n=here.monsters.length; here.monsters=[]; return n; },
  // every place a run can visit, for generation checks
  places(){ return [...Array.from({length:FINAL_DEPTH},(_,i)=>({depth:i+1})), ...Object.keys(SPECIALS).map(k=>({inter:k})),
    ...Object.values(BRANCHES).flatMap(B=>Array.from({length:B.len},(_,i)=>({branch:B.key,lvl:i+1}))), ...Object.values(REALMS).map(R=>({realm:R.key,depth:R.minD+2}))]; },
  // generate one level only (no meshes). It restores where the run is (seed, depth, branch, realm, special level),
  // but not what generate() rewrites (the history HIST, the level random rand, the light tables): use it on a page of its own
  gen(seed,pl){ const keep={runSeed:adv.runSeed,depth:here.depth,branch:here.branch,realm:here.realm,inter:here.inter};
    try{ adv.runSeed=seed>>>0; here.branch=null; here.realm=null; here.inter=null;
      if(pl.branch){ const B=BRANCHES[pl.branch]; here.depth=B.at[0]; here.branch={key:B.key,lvl:pl.lvl||1,len:B.len,ret:here.depth+1}; }
      else if(pl.inter){ here.depth=interAt(pl.inter); here.inter={key:pl.inter,after:here.depth}; }
      else if(pl.realm){ here.depth=pl.depth||4; here.realm={key:pl.realm,ret:here.depth+1}; }
      else here.depth=pl.depth;
      const L=generate(levelSeed(),here.depth); L.place=placeLabel(); L.final=here.depth===FINAL_DEPTH&&!here.branch&&!here.realm&&!here.inter; return L; }
    finally{ ({runSeed:adv.runSeed,depth:here.depth,branch:here.branch,realm:here.realm,inter:here.inter}=keep); } },
};

// ---------------------------------------------------------------- init
async function init(){
  try{ if(document.fonts&&document.fonts.load)await Promise.race([Promise.all([document.fonts.load('800 96px "JetBrains Mono"'),document.fonts.load('500 96px "Noto Sans Runic"','ᚦᛏᛜᛞᚲᛁᛊᚾᚱᚺ'),document.fonts.load('400 14px "BIZ UDGothic"','←→！：？［］')]),new Promise(r=>(TEST?TESTCLK.realTimeout:setTimeout)(r,2500))]); }catch(e){}
  U.uAtlas.value=buildAtlas();
  staticMat=new T.ShaderMaterial({uniforms:{uAtlas:U.uAtlas,uTime:U.uTime,uSL:U.uSL,uDLP:U.uDLP,uDLC:U.uDLC,uFogDen:U.uFogDen,uFogColor:U.uFogColor,uRamp:U.uRamp,uAmb:U.uAmb,uCell:U.uCell,uCollT:U.uCollT,uCamP:U.uCamP,uCutP:U.uCutP,uCut:U.uCut},
    vertexShader:STATIC_VS,fragmentShader:GLYPH_FS,side:T.DoubleSide,alphaToCoverage:true});
  dynMat=new T.ShaderMaterial({uniforms:{uAtlas:U.uAtlas,uFogDen:U.uFogDen,uFogColor:U.uFogColor},vertexShader:DYN_VS,fragmentShader:GLYPH_FS,side:T.DoubleSide,alphaToCoverage:true});
  ptMat=new T.ShaderMaterial({uniforms:{uAtlas:U.uAtlas,uScale:U.uScale,uFogDen:U.uFogDen},vertexShader:PT_VS,fragmentShader:PT_FS,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  occMat=new T.ShaderMaterial({uniforms:{uCamP:U.uCamP,uCutP:U.uCutP,uCut:U.uCut},colorWrite:false,side:T.DoubleSide,
    vertexShader:`varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader:`uniform vec3 uCamP; uniform vec3 uCutP; uniform float uCut; varying vec3 vW;
      void main(){ if(uCut>0.5){ vec3 seg=uCutP-uCamP; float L2=max(dot(seg,seg),1e-4); float tc=clamp(dot(vW-uCamP,seg)/L2,0.0,1.0); if(tc<0.97&&length(vW-(uCamP+seg*tc))<mix(2.6,0.9,tc)+0.15) discard; } gl_FragColor=vec4(0.0); }`});
  makeWater();
  const dynMesh=new T.Mesh(dynGeo,dynMat); dynMesh.frustumCulled=false; dynMesh.renderOrder=1; scene.add(dynMesh);
  const pts=new T.Points(ptGeo,ptMat); pts.frustumCulled=false; pts.renderOrder=5; scene.add(pts);
  applySize();
  newLevel();
  requestAnimationFrame(frame);
}
if(TEST)init().then(()=>{ dbgUrl(); testBoot=true; }).catch(e=>{ console.error(e); testBoot='error: '+e; });
else { init(); setTimeout(()=>{ try{ dbgUrl(); }catch(e){ console.error(e); } },400); }
