// ---------------------------------------------------------------- sizing
// why：何のために（'init'・'resize'・速さに合わせて解像度を下げた 'auto'・下げても速くならず戻した 'back'・比べる前に数えるのが途切れて戻した 'hold'）。大きさと解像度が前と同じなら、作り直さない
// （iOS は、画面の向きを変えると、同じ大きさの resize を続けて出すことがある。作り直すと、描く物の大きさを全部取り直すため）
let sizedAs='';
function applySize(why){
  frame.stillDrawn=false;
  const w=window.innerWidth, h=window.innerHeight;
  if(sizedAs===w+'x'+h+'@'+pixelRatio)return; sizedAs=w+'x'+h+'@'+pixelRatio;
  const t0=performance.now();
  gfx.renderer.setPixelRatio(pixelRatio); gfx.renderer.setSize(w,h,false);
  composer.setPixelRatio(pixelRatio); composer.setSize(w,h);
  gfx.camera.aspect=w/h; gfx.camera.updateProjectionMatrix();
  gfx.U.uScale.value=(h*pixelRatio)/(2*Math.tan(gfx.camera.fov*Math.PI/360));
  gfx.finalPass.uniforms.uRes.value.set(w*pixelRatio,h*pixelRatio);
  took('applySize',t0,{why,w,h,pr:+pixelRatio.toFixed(2)});
}
window.addEventListener('resize',()=>{ applySize('resize'); sizeMap(); });

// ---------------------------------------------------------------- main loop
let last=0, fovT=0, mapT=0, perfT=0, perfAcc=0, perfN=0, warm=0;
// 画質を下げる途中の状態（src/lib/quality.ts の stepQuality。q は数えるたびに今の値で置き換える）
let qRun={q:{pr:1,bloom:true},prev:null,done:false};
function frame(nowMs){
  requestAnimationFrame(frame);
  if(TEST){ if(TESTQ.n>0){ TESTQ.n--; try{ testTick(true); } finally{ if(!TESTQ.n&&TESTQ.done){ const d=TESTQ.done; TESTQ.done=null; d(); } } } return; }
  const now=nowMs/1000; let raw=last?now-last:0.016; last=now;
  stepTick(raw,true);
}
const TESTQ={n:0,done:null};
function testTick(draw){ TESTCLK.advance(TEST_STEP*1000); stepTick(TEST_STEP,draw); }
// one step of the game. While the bestiary shows a creature, the visual random (mr) reads the creature's own sequence (showBeast in src/lib/gallery.ts)
function stepTick(raw,draw){ const g=ui.gallery, r=g&&g.mode==='beast'&&g.m?g.rnd:null; if(r)withVisualRand(r,()=>tick(raw,draw)); else tick(raw,draw); }
// tick の段ごとの見た目の乱数：tick を段（プレイヤー・世界・灯り・描く物の種類ごと・粒子・火の広がり・飛ぶ物…）に分け、段ごとに、何の段か・探索のシード・
// 何回目の tick か（clock.frame）を鍵にした新しい並びを読む（keyedRand）。生き物は1体ずつ、動きと描画を、階のシード・階で何体目か（m.seq）・何回目の tick か を鍵にした並びで読む。
// なので、ある段で見た目の乱数を引く回数が変わっても、ほかの段・ほかの生き物と、次の tick からは変わらない（見た目だけの変更で、生き物の動き・戦い・火の広がりがずれない）。
// 同じ段の中では、その tick の後の物がずれる。図鑑で生き物を出している間は、段に分けず、これまでどおり生き物の並びで tick を包む（stepTick）。
// tick の外（マウスやキーの処理・setTimeout）は、Math.random の並びのまま（tick の中では引かないので、tick の中の変更ではずれない）。
// テスト用モードの __test.tickNoise(n) は、どの段も終わりに見た目の乱数を n 回余分に引く（段を分けていれば、何も変わらないことを確かめる。tests/determinism.mjs）
const tickNoise={n:0};
const keyedPhase=(r,fn)=>withVisualRand(r,()=>{ const v=fn(); for(let i=0;i<tickNoise.n;i++)mr(); return v; });
const tickRandOn=()=>{ const g=ui.gallery; return !(g&&g.mode==='beast'&&g.m); };
// テスト用モードの __test.skipPhase(names) で止めた段の名前（その段を飛ばす。何が光っているかを切り分ける時に。tools/glare.mjs の --hide）
const skipPhases=new Set();
const inPhase=(name,fn)=>skipPhases.has(name)?undefined:tickRandOn()?keyedPhase(keyedRand('tick '+name,adv.runSeed,clock.frame),fn):fn();
const inMobPhase=(name,m,fn)=>skipPhases.has(name)?undefined:tickRandOn()?keyedPhase(keyedRand('tick '+name,levelSeed(),m.seq,clock.frame),fn):fn();
// テスト用モードの __test.cam で置いたカメラ（{pos, at, lvl}。null ならふだんどおり）。描く間（見える区切りを選ぶ所と描く所）だけ、このカメラにする。
// 置いた時の階（lvl）と違う階に移ったら、置いたカメラは捨てて目に戻す（岩の中かは置いた時の階でしか確かめていないので）。
// ゲームの一歩の間は目のカメラのままなので、術の出る所・手元の灯り・照準・見た時の説明は、ふだんどおりプレイヤーの目から。
// 手元の武器と詠唱の円は目の前に描くので、離れたカメラから写すと宙に浮く（要らなければ __test.skipPhase(['hands','castfx'])）。
// 生き物の光り方の強さ（近いほど弱める）と、こちらを向く飾りは、目からの距離と向きで決まる
let testCam=null;
const placeTestCam=()=>{ const [x,y,z]=testCam.pos, [ax,ay,az]=testCam.at; gfx.camera.position.set(x,y,z);
  gfx.camera.rotation.set(Math.atan2(ay-y,Math.hypot(ax-x,az-z)),Math.atan2(-(ax-x),-(az-z)),0); };
// fn の間だけ、置いたカメラにする（置いていなければ、そのまま fn）
const withTestCam=fn=>{ if(testCam&&testCam.lvl!==here.D)testCam=null; if(!testCam)return fn(); const c=gfx.camera, p=c.position.clone(), r=c.rotation.clone();
  placeTestCam(); c.updateMatrixWorld(); try{ return fn(); } finally{ c.position.copy(p); c.rotation.copy(r); c.updateMatrixWorld(); } };
function tick(raw,draw){
  if(isPaused()&&ui.started){ if(frame.stillDrawn)return; frame.stillDrawn=true; } else frame.stillDrawn=false; clock.frame++; const dt=isPaused()?0:clamp(raw,0,0.05)*timeScale();
  clock.time+=dt; const t=clock.time;
  gfx.U.uTime.value=t;
  inPhase('trans',()=>{ if(here.trans){
    here.trans.t+=dt;
    if(here.trans.phase==='out'){ here.fade=1-here.trans.t/0.8; if(here.trans.t>=0.8){ if(here.trans.run)newRun(); else { if(here.trans.regen)adv.runSeed=(Math.random()*1e9)>>>0; else advance(here.trans.go); newLevel(); } here.trans={phase:'in',t:0}; here.fade=0; } }
    else { here.fade=here.trans.t/1.3; if(here.trans.t>=1.3){ here.trans=null; here.fade=1; } }
  } else here.fade=Math.min(1,here.fade+dt*0.8); });
  inPhase('player',()=>{ updatePlayer(dt); updateStealth(dt); updateStatuses(dt); });
  for(const m of here.monsters)if(!m.galShow&&!m.ty.dummy)inMobPhase('mob',m,()=>updateMonster(m,dt*monTimeK(m),t));
  if(here.monsters.some(m=>m.dead))here.monsters=here.monsters.filter(m=>!m.dead);
  hudInfo.pfFrames++; hudInfo.pfT+=raw; if(hudInfo.pfT>=0.5){ hudInfo.pfFps=Math.round(hudInfo.pfFrames/hudInfo.pfT); hudInfo.pfFrames=0; hudInfo.pfT=0; if(ui.perfOn)renderStatus(); }
  inPhase('world',()=>{ regrow(); brimRecover(dt); if(!adv.dead){ updateTraps(dt); updateSearch(dt); } updateLife(dt); });
  inPhase('lights',()=>{ updateLights(t); updateAtmosphere(dt); updateSectionAir(dt); });
  buf.dn=0; inPhase('fixtures',()=>drawFixtures(t,dt)); inPhase('doors',()=>drawDoors(t,dt)); inPhase('fire',()=>drawFire(t,dt)); inPhase('webs',()=>drawWebs(t)); inPhase('traps',()=>drawTraps(t));
  inPhase('swing',()=>drawSwing()); inPhase('hands',()=>drawViewWeapons(t)); inPhase('omens',()=>drawOmens(t,dt)); inPhase('runes',()=>{ drawRunesWorld(t); updateAltarPanel(); drawArrows(); drawLegendWorld(t); }); inPhase('rockfall',()=>{ if(!here.trans)updateRockfall(dt); }); // 階を移り始めたら、石は落ちず、当たらない（新しい階で newLevel が消す）
  inPhase('bolt',()=>drawBoltFx(t,dt)); inPhase('gallery',()=>drawGallery(t)); inPhase('frozen',()=>drawFrozen(t)); inPhase('castfx',()=>drawCastFx(t));
  for(const m of here.monsters)inMobPhase('mob draw',m,()=>drawMonster(m,t)); inPhase('debris',()=>updateDebris(dt)); flushDyn();
  inPhase('particles',()=>updateParticles(dt,t));
  fovT+=dt; if(fovT>0.1){ fovT=0; inPhase('fov',()=>{ computeFOV(); checkEvents(false); look(); }); inPhase('gas',()=>stepGas()); inPhase('spread',()=>stepFire()); }
  mapT+=dt; if(mapT>0.11){ mapT=0; if(ui.uiMode===0)inPhase('map',()=>drawMap()); }
  if(ui.helpT>0){ ui.helpT-=dt; if(ui.helpT<=0&&ui.helpOn)setHelp(false); }
  gfx.finalPass.uniforms.uTime.value=t; gfx.finalPass.uniforms.uFade.value=clamp(here.fade,0,1); gfx.finalPass.uniforms.uHurt.value=vfx.hurtFlash+(player.hp<adv.PLAYER_MAX*0.25&&!adv.dead?0.18+0.08*Math.sin(t*4):0);
  inPhase('pickup',()=>{ if(ui.started&&!here.trans&&!adv.dead&&!isPaused())pickupItems(); });
  inPhase('cast',()=>{ if(gear.hands)updateCast(dt); });
  inPhase('final',()=>updateFinal(dt)); inPhase('galstep',()=>updateGallery(dt)); inPhase('seen',()=>trackSeen(dt)); inPhase('thaw',()=>{ updateFrozen(dt); cloudsMeetFire(); });
  inPhase('cross',()=>updateCross(raw));
  inPhase('projs',()=>updateProjs(dt));
  inPhase('sound',()=>sndUpdate(dt)); inPhase('events',()=>updateEvents(dt,t));
  withTestCam(()=>{ cullChunks(); if(draw)composer.render(dt); });
  if(TEST)return; // keep the resolution fixed in tests
  // 速さに合わせて画質を下げる（src/lib/quality.ts）。数えるのは探索中だけ（階を移る途中・止まっている間・タイトルと図鑑は数えない。
  // 階を作る一瞬の遅れで下がらないように）。数えないフレームが来たら、そこから3秒は様子を見てから数え直す
  if(!ui.started||here.trans||isPaused()||document.hidden){ warm=perfT=perfAcc=perfN=0; if(qRun.prev){ qRun=holdQuality(qRun); setQuality(qRun.q,'hold'); } return; }
  warm+=raw; if(warm>3){ perfAcc+=raw; perfN++; perfT+=raw;
    if(perfT>QUALITY.span){ qRun=stepQuality(perfAcc/perfN,{...qRun,q:{pr:pixelRatio,bloom:bloom.enabled}}); perfT=perfAcc=perfN=0;
      setQuality(qRun.q,qRun.done?'back':'auto'); } }
}
// 画質を q にする。変えたら、作り直した直後の遅いフレームを次の比べに数えないように、3秒おいてから数え直す
function setQuality(q,why){
  if(q.pr===pixelRatio&&q.bloom===bloom.enabled)return;
  const pr0=pixelRatio; pixelRatio=q.pr; bloom.enabled=q.bloom; warm=perfT=perfAcc=perfN=0;
  if(q.pr!==pr0)applySize(why); else took('quality',performance.now(),{bloom:q.bloom,why});
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
  // 指の操作の、試して合わせる値を変える（{look, analog}。src/lib/touchpad.ts の TUNE。tools/feel.mjs が使う）
  touchTune(o){ Object.assign(TUNE,o||{}); return {...TUNE}; },
  // the quality the frame loop lowers on a slow device (src/lib/quality.ts; tests keep it fixed): pr is the pixel ratio, bloom whether the glow is drawn. Returns what it is now
  quality(q){ if(q){ if(q.pr!==undefined)pixelRatio=q.pr; if(q.bloom!==undefined)bloom.enabled=q.bloom; applySize('auto'); } return {pr:pixelRatio,bloom:bloom.enabled}; },
  bless(n=1){ for(const k in BLESS)adv.lvl.bless[k]=n; return Object.keys(BLESS).length; },
  // how many columns the panels count for a piece of text (visW)
  width(text){ return visW(text); },
  // every phase of tick draws the visual random n more times at its end (each phase reads its own keyed sequence, so nothing should change)
  tickNoise(n){ tickNoise.n=Math.max(0,n|0); return tickNoise.n; },
  // skip the phases of tick with these names (inPhase('hands',…), the creatures' drawing inMobPhase('mob draw',…)); [] brings them all back.
  // Returns the names skipped now. A name tick does not have is not taken (so a typo shows: the list comes back without it)
  // (the names are read from tick's own source, so the list does not need to be kept by hand; the build may rename inPhase to inPhase$1 and so on)
  skipPhase(names){ const known=new Set([...tick.toString().matchAll(/in(?:Mob)?Phase[$\w]*\(\s*["'`]([^"'`]+)["'`]/g)].map(x=>x[1]));
    skipPhases.clear(); for(const n of names||[])if(known.has(n))skipPhases.add(n); return [...skipPhases]; },
  // a plain copy of what matters, to compare runs
  state(){ const f=v=>+(+v||0).toFixed(3);
    return {time:f(clock.time),seed:adv.runSeed,place:placeLabel(),depth:here.depth,started:ui.started,dead:adv.dead,hp:f(player.hp),pos:[f(player.x),f(player.z)],yaw:f(player.yaw),lvl:adv.lvl.n,
      monsters:here.monsters.map(m=>[m.key,f(m.x),f(m.z),f(m.hp),m.sleep?1:0,f(m.wind)]),projs:fight.projs.length,
      trans:here.trans?here.trans.phase:null,maxDepth:adv.runStats&&adv.runStats.maxDepth!==undefined?adv.runStats.maxDepth:null,cast:gear.castSt?{h:gear.castSt.h,t:f(gear.castSt.t),need:f(gear.castSt.need),full:gear.castSt.full}:null,recover:f(player.recover),paused:isPaused(),
      roll:!!player.roll,quick:f(player.qcUntil),counter:f(player.ctrUntil)}; },
  // the room events of this level (type, crater cell, state, timer, step, the cells in the order they flood, done) and how many cells lava has flowed into (an eruption or a lava flow)
  events(){ return {list:here.events.map(e=>({type:e.type,src:e.src===undefined?null:e.src,state:e.state===undefined?null:e.state,t:e.t===undefined?null:+e.t.toFixed(3),k:e.k===undefined?null:e.k,order:e.order?e.order.slice():null,done:!!e.done})),lava:blaze.cellFlag.reduce((n,v)=>n+(v===70?1:0),0)}; },
  // hold a weapon (a RUNE_DEF key such as 'blade', 'bolt', 'orb'), and press / release a hand's button ('L' or 'R')
  open(t){ if(!['slotL','slotR','body'].includes(t))return 'no such slot: '+t; applyOpen(t); return t; },
  equip(h,type){ if(!RUNE_DEF[type]||RUNE_DEF[type].cat!=='atk')return 'no such weapon: '+type; equipWeapon(h,makeRune(type)); renderHotbar(); return type; },
  // 手 h（'L'・'R'）に性質（RUNE_DEF の性質の鍵：'fire'・'ice'・'thunder'・'poison'）を付ける。手の性質のルーンを外してから、空いた枠に入れる。
  // 付けた性質を返す（無い手・無い鍵・入る枠が無い時は、わけの文。入らなければ、外したルーンを元に戻す）。null なら性質のルーンを外すだけ
  elem(h,type){ if(h!=='L'&&h!=='R')return 'no such hand: '+h; if(type!==null&&(!RUNE_DEF[type]||RUNE_DEF[type].cat!=='elem'))return 'no such element: '+type;
    const H=gear.hands[h], n=H.slotN||2, took=[];
    for(let i=0;i<n;i++){ const r=H.slots[i]; if(r&&RUNE_DEF[r.type].cat==='elem'){ took.push([i,r]); slotSet(h,'s'+i,null); } }
    let put=type===null; if(!put){ const ru=makeRune(type); for(let i=0;i<n&&!put;i++)if(!H.slots[i]&&canPutAt(h,i,ru)){ slotSet(h,'s'+i,ru); put=true; } }
    if(!put)for(const [i,r] of took)slotSet(h,'s'+i,r);
    syncHands(); renderHotbar(); return put?type:'no free slot: '+h; },
  // n 番目（0 から。state().monsters の順）の生き物を、その場に止める（{yaw, walk}：yaw は向く向き（体の向き m.yaw と同じ、atan2(x の差, z の差)。無ければ今の向きのまま）、
  // walk なら足踏みする。止めている間は歩かず、攻撃もしない（止めた時に、攻撃の溜めも捨てる）。気づく・当たってひるむ・吹き飛ぶ・燃える・ブロートが近くで弾けるなどは、ふだんどおり）。
  // null で放す。止めたら true、いなければ false。小さな生き物（魚・清掃機など。動きが別の処理）は止められないので、わけの文を返す
  hold(n,o){ const m=here.monsters[n]; if(!m)return false; if(m.ty.critter)return 'cannot hold a critter: '+m.key;
    m.hold=o?{...(o.yaw!==undefined?{yaw:o.yaw}:{}),walk:!!o.walk}:null; if(o)m.wind=0; return true; },
  // 描く時のカメラを pos（[x,y,z]）に置いて at（[x,y,z]）を見る（ゲームの一歩は目のカメラのまま。上の testCam）。pos が岩の中（壁・地図の外・天井より上）か、
  // 横に 0.4 以内に壁がある時は置かず、わけの文を返す。置いたら {pos, at, clear}（clear は pos から at までの線が岩を通らないか）を返す。
  // null で目に戻す（ほかの階へ移っても目に戻る）。pos・at が3つの数でなければ、わけの文。引数なしなら何も変えず、目のカメラの位置と向きと置いたカメラ {pos, yaw, pitch, placed} を返す（placed は置いていなければ null）
  cam(o){ if(o===undefined){ if(testCam&&testCam.lvl!==here.D)testCam=null; const p=gfx.camera.position;
    return {pos:[p.x,p.y,p.z],yaw:gfx.camera.rotation.y,pitch:gfx.camera.rotation.x,placed:testCam?{pos:testCam.pos,at:testCam.at}:null}; }
    if(!o){ testCam=null; return null; }
    const v3=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite); if(!v3(o.pos)||!v3(o.at))return 'pos and at must be [x,y,z]';
    const [x,y,z]=o.pos, [ax,ay,az]=o.at;
    for(const [dx,dz] of [[0,0],[0.4,0],[-0.4,0],[0,0.4],[0,-0.4]])if(rockAt(x+dx,y,z+dz))return 'camera in rock: '+JSON.stringify(o.pos);
    let clear=true; for(let k=1;k<40&&clear;k++){ const f=k/40; if(rockAt(x+(ax-x)*f,y+(ay-y)*f,z+(az-z)*f))clear=false; }
    testCam={pos:o.pos.slice(),at:o.at.slice(),lvl:here.D}; return {pos:testCam.pos,at:testCam.at,clear}; },
  // true when the hand started charging, or attacked at once (a weapon with no charge, such as the short sword)
  press(h){ const r0=player.recover||0; beginCast(h); return !!gear.castSt||(player.recover||0)>r0; },
  release(h){ releaseCast(h); },
  // the doors of this level (cell i, the room cell j next to it, how open o, burnt away), a cell (its middle x z, floor to stand on, seen now, explored, ash,
  // sulphur or ice floor, thin ice and the seconds stood on it, water, lava, fire, fuel), the size of the map, setting a cell on fire (gas: as burning gas does, leaving a little fuel),
  // and putting a creature (an MTYPES key such as 'Re') on a cell
  doors(){ return here.D.doors.map(d=>({i:d.i,j:d.j,o:+d.o.toFixed(3),gone:!!d.gone})); },
  cell(i){ return {x:(i%MW+0.5)*CELL,z:(((i/MW)|0)+0.5)*CELL,floor:here.D.tile[i]===TF&&!here.D.solid.has(i)&&!blocksWalk(here.D.liquid[i]),seen:here.fovVis[i]===here.fovStamp,explored:!!here.explored[i],burnt:!!blaze.burnt[i],
    brim:here.D.surface[i]===SF_BRIM,ice:here.D.surface[i]===SF_ICE,thin:!!here.D.thin[i],iceT:iceT.get(i)||0,water:here.D.liquid[i]===LQ_WATER||here.D.liquid[i]===LQ_DEEP,lava:here.D.liquid[i]===LQ_LAVA,fire:+(blaze.fire[i]||0).toFixed(3),fuel:+(blaze.fuel[i]||0).toFixed(3)}; },
  // the size of the map in cells (a cell number is row times w plus column)
  size(){ return {w:MW,h:MH}; },
  ignite(i,gas=false){ ignite(i,1,gas); },
  // cold around a cell (r in world units, as an ice spell), and how many times a cell is in the list of burning cells
  chill(i,r){ chillArea((i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL,r); },
  burning(i){ return blaze.burning.filter(j=>j===i).length; },
  // 落石：on なら、プレイヤーのまわり（3マス）の床で、宝物庫の天井が崩れた時と同じ落石を始める。今の落石（経った秒・落ちている石の数。無ければ null）を返す
  // 倒れた生き物が崩れて積もった文字（崩れる体ごとの、文字の数・残す数・消えていない数・様子ごとの数（体に付いたまま・落ちている・積もった・塵になって縮む・水に沈む・溶岩で燃える・消えた）・積もった文字の高さの範囲と倒れた所からの距離。src/lib/debris.ts）
  debris(){ return debrisInfo(); },
  rockfall(on){ if(on){ const cx=Math.floor(player.x/CELL), cz=Math.floor(player.z/CELL), cells=[]; for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){ const x=cx+dx, z=cz+dz; if(x<0||x>=MW||z<0||z>=MH)continue; const c=z*MW+x; if(here.D.tile[c]===TF)cells.push(c); } fight.rockfall={t:0,dur:9,cells,rocks:[],next:0.2}; }
    const R=fight.rockfall; return R?{t:+R.t.toFixed(4),rocks:R.rocks.length}:null; },
  // lingering things of this level (fields, delayed hits, rains, marks on the floor, a beam being fired, lightning, lightning still to fall and its flash):
  // put one of each where the player stands, made to do nothing for 60 s (a field and a rain with no element, a beam whose first shot is 60 s away),
  // and count them. It also sets both hands' trigger wait to 60 s (it belongs to the run, not to the level: a new run sets it back to 0).
  // It also makes an ice hound where the player stands (not added to the level's creatures) and lets it fall, so one crumbling body lies there
  addTraces(){ const x=player.x, z=player.z; crumble(makeMonster({key:'Zi',cx:Math.floor(x/CELL),cz:Math.floor(z/CELL),g:-1,lead:true})); addZone(x,z,2,{elem:null},60,false); later(60,()=>{}); fight.marks.push({x,z,r:1,t:60,c:[1,0.5,0.2]});
    fight.rains.push({x,z,r:1,n:1,left:1,iv:1,tick:60,sp:{elem:null},follow:false,elemK:0,again:false}); fight.beamRun={h:'L',t:60,tick:60,auto:true,dir:null};
    const a=[x,1,z], b=[x,1,z+1]; fight.boltFx.push({a,b,col:[1,1,1],style:'spark',amp:0.1,t:0,life:60,re:0,pts:jagged(a,b,0.1)}); fight.zapQueue.push({t:60,fn:()=>{}}); vfx.zapFlash={x,y:2,z,col:[1,1,1],t:60,r:6};
    fight.trigCd={L:60,R:60}; return this.traces(); },
  traces(){ return {zones:fight.zones.length,laters:fight.laters.length,rains:fight.rains.length,marks:fight.marks.length,beam:!!fight.beamRun,
    bolts:fight.boltFx.length,zaps:fight.zapQueue.length,flash:!!vfx.zapFlash,trig:[fight.trigCd.L,fight.trigCd.R],debris:fight.debris.length}; },
  // a delayed thing that throws (to see that an error inside one is not swallowed in test mode)
  failLater(message){ later(0,()=>{ throw new Error(message); }); },
  // count the cells in sight now (the game does it every 0.1 s; a check that looks every frame should not miss a short moment)
  fov(){ computeFOV(); },
  // unseen: put it down as not seen yet, so the first sight of it gives its line (summon itself counts it as seen)
  summon(key,i,{unseen=false}={}){ if(!MTYPES[key])return 'no such creature: '+key; const m=summon(key,i); if(unseen)m.seen=false; return here.monsters.length; },
  // the bestiary, opened from the title (as its button does) if it is not open: every entry in order, n counted from 1
  gallery(){ if(!(ui.gallery&&ui.gallery.mode==='beast')){ if(ui.started)return 'the bestiary opens from the title'; openBestiary(); }
    return ui.gallery.list.map((e,i)=>({n:i+1,key:e.key,name:e.ty.name,form:e.ty.form,scale:e.ty.scale})); },
  // show entry n held still: yaw 0 faces the camera, + turns it to the right as seen from the camera; pose 'stand' | 'walk' | 'sleep'.
  // zoom (0.5-3, default 1) divides the camera's distance: 2 is half as far, so the creature looks bigger (the room still bounds it, and a zoom in stops outside the body).
  // pitch (-0.3 to 1.3 radians) moves the camera up around the creature, under the ceiling: 0 looks from the side, + looks down from above (left out: the height the bestiary works out from the creature's size).
  // center (true or false, default false) puts the middle of the body's height in the middle of the picture (otherwise the creature stands a little high, above the bestiary's panel).
  // It empties the sparks first (so a full pool does not swallow the sparks of a phantom, which is mostly sparks), then steps one tick so the angle
  // and pose take hold (a walk needs about 1 s more to reach its full stride). Returns what galleryDraw() returns
  galleryShow(n,{yaw=0,pose='stand',zoom=1,pitch=null,center=false}={}){ const list=this.gallery(); if(typeof list==='string')return list;
    if(!(Number.isInteger(n)&&n>=1&&n<=list.length))return 'no such entry: '+n+' (1-'+list.length+')'; if(!['stand','walk','sleep'].includes(pose))return 'no such pose: '+pose;
    if(typeof yaw!=='number'||!Number.isFinite(yaw))return 'no such yaw: '+yaw+' (a number of radians)';
    if(typeof zoom!=='number'||!(zoom>=0.5&&zoom<=3))return 'no such zoom: '+zoom+' (0.5-3)';
    if(pitch!==null&&(typeof pitch!=='number'||!(pitch>=-0.3&&pitch<=1.3)))return 'no such pitch: '+pitch+' (-0.3 to 1.3 radians)';
    if(typeof center!=='boolean')return 'no such center: '+center+' (true or false)';
    buf.pN=0; showBeast(n-1); ui.gallery.fix={yaw,pose,zoom,pitch,center}; testTick(false); return this.galleryDraw(); },
  // draw the creature on show once more and look at what it drew (then drop it again, even when the drawing throws): how many glyphs,
  // how many sparks it threw (a phantom is mostly sparks: its glyphs show only now and then), how many of those glyphs and sparks hold
  // a number that is not finite (place, colour, glyph, size, speed, life), the box the glyphs fill (width and depth across the floor, the lowest and highest point),
  // and where the camera is (distance across the floor to the creature, height, and how far it looks down: pitch is the camera's, so negative is down),
  // the height of the point it looks at (aimY) and the straight distance to it (aimed), and what bounds it: the ceiling over the camera, the farthest the room lets it go,
  // and the ball round the aimed point that holds the body (only worked out for a zoom in; otherwise null)
  // (what the creature makes and keeps when first drawn, such as the sleeping shape or the aura's things, reads its own sequence m.rnd, which is the creature's g.rnd:
  // while probing it reads a probe sequence instead, and what the probe added to the creature is taken off again, so the next step makes it as if galleryDraw was never called)
  galleryDraw(){ const m=ui.gallery&&ui.gallery.mode==='beast'&&ui.gallery.m; if(!m)return null;
    const d0=buf.dn, p0=buf.pN, r0=m.rnd, k0=new Set(Object.keys(m)); let d1=d0, p1=p0;
    try{ m.rnd=keyedRand('gallery probe looks'); withVisualRand(keyedRand('gallery probe'),()=>drawMonster(m,clock.time)); d1=buf.dn; p1=buf.pN; }
    finally{ buf.dn=d0; buf.pN=p0; m.rnd=r0; for(const k of Object.keys(m))if(!k0.has(k))delete m[k]; }
    const sparks=p1-p0; let bad=0; const lo=[1e9,1e9,1e9], hi=[-1e9,-1e9,-1e9];
    for(let k=d0;k<d1;k++){ let ok=true; for(let j=0;j<3;j++){ const v=dPos[k*3+j]; if(!Number.isFinite(v)||!Number.isFinite(dCol[k*3+j]))ok=false; else { lo[j]=Math.min(lo[j],v); hi[j]=Math.max(hi[j],v); } }
      for(let j=0;j<4;j++)if(!Number.isFinite(dPar[k*4+j]))ok=false; if(!ok)bad++; }
    for(let k=p0;k<p1;k++)if(['x','y','z','vx','vy','vz','life','gl','sz','r','g','b'].some(a=>!Number.isFinite(P[a][k])))bad++;
    const f=v=>+v.toFixed(2), n=d1-d0;
    // it draws with a sequence of its own (the same each time), so looking does not move on the creature's sequence (showBeast) that the next steps read
    // hash: a fingerprint of what it drew (the glyphs' place, colour, glyph and size, the sparks' place and colour, to 1/1000), so a check can see that two draws are the same
    let h=0x811c9dc5; const mix=v=>{ h=Math.imul(h^(Math.round(v*1000)|0),0x01000193)>>>0; };
    for(let k=d0;k<d1;k++){ for(let j=0;j<3;j++){ mix(dPos[k*3+j]); mix(dCol[k*3+j]); } for(let j=0;j<4;j++)mix(dPar[k*4+j]); }
    for(let k=p0;k<p1;k++)for(const a of ['x','y','z','r','g','b'])mix(P[a][k]);
    const cp=gfx.camera.position;
    // turn: the creature's angle from facing the camera (radians, -pi to pi), so a check can see it turn or hold still
    const turn=Math.atan2(Math.sin(m.yaw-player.yaw),Math.cos(m.yaw-player.yaw));
    // exposure: the eye's exposure now (the screen's brightness factor), so a check can see that it settles at once when a creature is shown
    return {name:m.ty.name,turn:+turn.toFixed(4),glyphs:n,sparks,bad,hash:h.toString(16),exposure:+gfx.finalPass.uniforms.uExposure.value.toFixed(4),box:n?{w:f(hi[0]-lo[0]),d:f(hi[2]-lo[2]),y0:f(lo[1]),y1:f(hi[1])}:null,
      camera:{dist:+Math.hypot(cp.x-m.x,cp.z-m.z).toFixed(3),height:+cp.y.toFixed(3),pitch:+gfx.camera.rotation.x.toFixed(3),
        aimY:+(ui.gallery.aimY??0).toFixed(3),aimed:+Math.hypot(cp.x-m.x,cp.y-(ui.gallery.aimY??0),cp.z-m.z).toFixed(3),ceil:+ceilAt(cp.x,cp.z).toFixed(3),roomR:+(ui.gallery.room.far-0.8).toFixed(3),
        bodyR:(ui.gallery.fix||ui.gallery.view)?.bodyR!==undefined?+(ui.gallery.fix||ui.gallery.view).bodyR.toFixed(3):null}}; },
  // where a creature's body is drawn (the first one alive with this key, e.g. 'lord' or 'final'; only the body and the deep lord's tentacles, not its aura or the sign
  // over its head): its glyphs' box in the world (y0, y1: lowest and highest), the ceiling above it, their box on the screen in CSS pixels (x0..x1, y0..y1,
  // kept to the screen), and the share of glyphs that fall outside the screen (cut)
  monsterView(key){ const m=here.monsters.find(m=>m.key===key&&!m.dead); if(!m)return null;
    const d0=buf.dn, p0=buf.pN; let d1=d0; const pts=[];
    try{ gfx.drawBodyOnly=true; if(m.ty.habitat==='deep')drawTentacles(m,clock.time); drawMonster0(m,clock.time); d1=buf.dn; for(let k=d0;k<d1;k++)pts.push([dPos[k*3],dPos[k*3+1],dPos[k*3+2]]); }
    finally{ gfx.drawBodyOnly=false; buf.dn=d0; buf.pN=p0; }
    if(!pts.length)return {key,x:m.x,z:m.z,glyphs:0};
    // 画面の範囲は、描いたカメラ（__test.cam で置いていれば、そのカメラ）で数える
    const W=gfx.canvas.clientWidth, H=gfx.canvas.clientHeight, v=new T.Vector3(); let out=0, y0=1e9, y1=-1e9; const sb=[1e9,1e9,-1e9,-1e9];
    withTestCam(()=>{ gfx.camera.updateMatrixWorld(); for(const [x,y,z] of pts){ y0=Math.min(y0,y); y1=Math.max(y1,y); v.set(x,y,z).project(gfx.camera); const sx=(v.x+1)/2*W, sy=(1-v.y)/2*H;
      if(v.z>1||sx<0||sx>W||sy<0||sy>H){ out++; if(v.z>1)continue; } sb[0]=Math.min(sb[0],sx); sb[1]=Math.min(sb[1],sy); sb[2]=Math.max(sb[2],sx); sb[3]=Math.max(sb[3],sy); } });
    const c=(a,lo,hi)=>Math.round(Math.max(lo,Math.min(hi,a)));
    return {key,name:m.ty.name,form:m.ty.form,scale:m.ty.scale,x:m.x,z:m.z,glyphs:pts.length,world:{y0:+y0.toFixed(2),y1:+y1.toFixed(2)},ceil:+ceilAt(m.x,m.z).toFixed(2),
      screen:{x0:c(sb[0],0,W),y0:c(sb[1],0,H),x1:c(sb[2],0,W),y1:c(sb[3],0,H)},cut:+(out/pts.length).toFixed(3)}; },
  // stop drawing a creature (the first one alive with this key) for a moment, and draw it again (on false). It stays in the level, so its light still shines
  hideMonster(key,on){ const m=here.monsters.find(m=>m.key===key&&!m.dead); if(!m)return false; m.drawHide=!!on; return true; },
  // the shapes and first values of the creatures (from the from-th on): for each, its key, a fingerprint of its shape (each point's place, size, brightness, glyph and part,
  // to 1/1000) and the first values makeMonster gives it (facing, the way it heads, the wait, the walk's and the sway's phases, the eel's surfacing, the strike's pause), to 1/10000
  mobLooks(from=0){ const f=v=>v===undefined?'-':(+v).toFixed(4);
    return here.monsters.slice(from).map(m=>{ let h=0x811c9dc5; for(const ch of JSON.stringify(m.form.map(p=>[+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3),+(p.s||0).toFixed(3),+(p.b||0).toFixed(3),p.g,p.part||'']))){ h=Math.imul(h^ch.charCodeAt(0),16777619); }
      return `${m.key}:${(h>>>0).toString(16)}:${[m.yaw,m.dirYaw,m.wait,m.walk,m.ph,m.surfT,m.atkCd].map(f).join(',')}`; }); },
  // build the world again (buildWorld) and count its draws from the shared visual random mr(): there are none (statueForm in src/lib/build.ts). Draws straight from
  // Math.random are not counted (three.js names each geometry and mesh it makes with one, 4 draws each: so many for each level, and nothing to do with statues).
  // Also how many statue sites the level has (a room of statues or a remnant's inert ones, a vault's statues, a colossus), so a check knows statues were built.
  // It uses up the maze random, so the world it builds is not quite the level's own: for checks at the end of a page
  worldDraws(){ let n=0; withVisualRand(()=>(n++,Math.random()),()=>buildWorld());
    const statues=here.D.rooms.reduce((s,r)=>s+(r.mdata&&(r.mdata.type==='statues'||(r.mdata.type==='remnant'&&r.mdata.inert&&r.mdata.inert.length))?1:0)+(r.vstat||[]).length+(r.colossus!==undefined?1:0),0);
    return {draws:n,statues}; },
  // remove every creature (lords too), so a check is not upset by one that happens to be near
  clearAll(){ const n=here.monsters.length; here.monsters=[]; return n; },
  // knock creature n (counted from 0, as in state().monsters) back with speed kx kz, as a hit's knockback does
  knock(n,kx,kz){ const m=here.monsters[n]; if(!m)return false; m.st=m.st||{}; m.kx=kx; m.kz=kz; return true; },
  // creature n's cell, the cell it walks to, its body scale, position and knockback speed
  mob(n){ const m=here.monsters[n]; return m?{cx:m.cx,cz:m.cz,tx:m.tx,tz:m.tz,scale:m.ty.scale,x:m.x,z:m.z,yaw:m.yaw,kx:m.kx||0,kz:m.kz||0,hitT:Math.max(0,m.hitT||0),glow:m.glow,alert:m.alert,aimed:m===ui.aimMon}:null; },
  // every place a run can visit, for generation checks
  places(){ return [...Array.from({length:FINAL_DEPTH},(_,i)=>({depth:i+1})), ...Object.keys(SPECIALS).map(k=>({inter:k})),
    ...Object.values(BRANCHES).flatMap(B=>Array.from({length:B.len},(_,i)=>({branch:B.key,lvl:i+1}))), ...Object.values(REALMS).map(R=>({realm:R.key,depth:R.minD+2}))]; },
  // generate one level only (no meshes). It restores where the run is (seed, depth, branch, realm, special level),
  // but not what generate() rewrites (the history adv.HIST, the level random rand, the light tables): use it on a page of its own
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
  gfx.U.uAtlas.value=buildAtlas();
  gfx.staticMat=new T.ShaderMaterial({uniforms:{uAtlas:gfx.U.uAtlas,uTime:gfx.U.uTime,uSL:gfx.U.uSL,uDLP:gfx.U.uDLP,uDLC:gfx.U.uDLC,uFogDen:gfx.U.uFogDen,uFogColor:gfx.U.uFogColor,uRamp:gfx.U.uRamp,uAmb:gfx.U.uAmb,uCell:gfx.U.uCell,uCollT:gfx.U.uCollT,uCamP:gfx.U.uCamP,uCutP:gfx.U.uCutP,uCut:gfx.U.uCut},
    vertexShader:STATIC_VS,fragmentShader:GLYPH_FS,side:T.DoubleSide,alphaToCoverage:true});
  dynMat=new T.ShaderMaterial({uniforms:{uAtlas:gfx.U.uAtlas,uFogDen:gfx.U.uFogDen,uFogColor:gfx.U.uFogColor},vertexShader:DYN_VS,fragmentShader:GLYPH_FS,side:T.DoubleSide,alphaToCoverage:true});
  ptMat=new T.ShaderMaterial({uniforms:{uAtlas:gfx.U.uAtlas,uScale:gfx.U.uScale,uFogDen:gfx.U.uFogDen},vertexShader:PT_VS,fragmentShader:PT_FS,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  gfx.occMat=new T.ShaderMaterial({uniforms:{uCamP:gfx.U.uCamP,uCutP:gfx.U.uCutP,uCut:gfx.U.uCut},colorWrite:false,side:T.DoubleSide,
    vertexShader:`varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader:`uniform vec3 uCamP; uniform vec3 uCutP; uniform float uCut; varying vec3 vW;
      void main(){ if(uCut>0.5){ vec3 seg=uCutP-uCamP; float L2=max(dot(seg,seg),1e-4); float tc=clamp(dot(vW-uCamP,seg)/L2,0.0,1.0); if(tc<0.97&&length(vW-(uCamP+seg*tc))<mix(2.6,0.9,tc)+0.15) discard; } gl_FragColor=vec4(0.0); }`});
  makeWater();
  const dynMesh=new T.Mesh(dynGeo,dynMat); dynMesh.frustumCulled=false; dynMesh.renderOrder=1; gfx.scene.add(dynMesh);
  const pts=new T.Points(gfx.ptGeo,ptMat); pts.frustumCulled=false; pts.renderOrder=5; gfx.scene.add(pts);
  applySize('init');
  newLevel();
  // 音の部品を先に作っておく（迷宮に入る時に止まらないように。鳴らし始めるのは、押した時の sndInit。src/lib/audio.ts）
  sndPrep();
  requestAnimationFrame(frame);
}
if(TEST)init().then(()=>{ dbgUrl(); testBoot=true; }).catch(e=>{ console.error(e); testBoot='error: '+e; });
else { init().then(()=>initAuto({ toStairs:()=>dbg.to('stairs'), clear:()=>{ dbg.clear(); }, hurt:n=>{ dbg.hurt(n); }, summon:(k,i)=>{ summon(k,i); }, title:()=>redrawIntroLater() })).catch(e=>console.error(e));
  setTimeout(()=>{ try{ dbgUrl(); }catch(e){ console.error(e); } },400); }
