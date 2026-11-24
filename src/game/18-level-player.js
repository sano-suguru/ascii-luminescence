// ---------------------------------------------------------------- level control
let expo=1.1;
adv.runSeed=(Math.random()*1e9)>>>0;
const levelSeed=()=>((Math.imul(adv.runSeed,2654435761)^Math.imul(here.depth,1013904223)^(here.branch?Math.imul(here.branch.lvl*31+here.branch.key.charCodeAt(0),0x27d4eb2d):0)^(here.realm?Math.imul(here.realm.key.charCodeAt(0)+7,0x165667b1):0)^(here.inter?Math.imul(here.inter.key.charCodeAt(0)+13,0x2c1b3c6d):0))>>>0)||1;
function setFog(){ const k=here.D.prof.fogDark, f=(here.D.stratum.fog?here.D.stratum.fog:here.D.stratum.k==='magma'?[0.016,0.004,0.003]:here.D.stratum.k==='abyss'?[0.007,0.003,0.014]:FOGS[(here.depth-1)%FOGS.length]).map(v=>v*k); fogCol.set(f[0],f[1],f[2]); renderer.setClearColor(new T.Color(f[0],f[1],f[2]),1); fogBase=0.05+Math.min(here.depth-1,6)*0.002; U.uFogDen.value=fogBase; }
let lastStratum=null;
function showStratum(st){
  const el=document.getElementById('stratum'); if(!el)return;
  const name=[...st.name].join(' ');
  el.innerHTML=`<span class="r">-  -  -</span>   ${st.special?'特 別 な 階':st.branch?'支 道':st.realm?'異 界':`第 ${st.n} 層`}   <span class="r">-  -  -</span>\n<b>${name}</b>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(showStratum.t); showStratum.t=setTimeout(()=>el.classList.remove('show'),5600);
}
function settleSlotPick(){ if(!adv.runState||!adv.runState.slotPend||!here.D)return; const o=(here.D.items||[]).find(x=>x.grp===adv.runState.slotPend&&!x.taken); if(o){ applyOpen(o.target); msg(`<span class="lab">選ばれなかった空の枠は、${o.label}を開けた。</span>`); } adv.runState.slotPend=null; }
function newLevel(seedOverride){
  settleSlotPick();
  if(advance.bounced){ advance.bounced=false; setTimeout(()=>msg('<b style="color:#a98cff">.</b>闇の底に触れた途端、何かに押し返された。まだ、降りることは許されていない。'),1200); }
  here.D=generate(seedOverride!==undefined?seedOverride:levelSeed(),here.depth);
  if(here.depth===FINAL_DEPTH&&!here.branch&&!here.realm)here.D.finalVault=true;
  frozen=new Map();
  placeRunesForLevel(); projs=[]; beamSegs=[]; clouds=[]; zones=[]; laters=[]; rains=[]; marks=[]; gear.castSt=null;
  U.uAmb.value=here.D.prof.ambient;
  hudInfo.explored=0;
  buildWorld(); updateWater();
  here.fixtures=here.D.fixtures;
  here.monsters=here.D.spawns.map(makeMonster);
  if(here.branch&&adv.runState.lordsDone&&adv.runState.lordsDone.has(here.branch.key))here.monsters=here.monsters.filter(m=>m.key!=='lord');
  finalSt=null; if(isFinal())setupFinal();
  for(const m of here.monsters)if(!m.isLead)m.leader=here.monsters.find(o=>o.g===m.g&&o.isLead)||null;
  for(const m of here.monsters)if(m.ty.beast||(m.ty.dragon&&Math.random()<0.9))m.sleep=true;
  { const asleep=new Set(); for(const m of here.monsters)if(m.isLead&&m.g>=0&&m.ty.form!=='eel'&&Math.random()<0.10)asleep.add(m.g); for(const m of here.monsters)if(asleep.has(m.g))m.sleep=true; }
  noticeMsgT={}; stealth.hudKey='';
  here.explored=new Uint8Array(NCELL); here.mem=new Float32Array(NCELL*3); here.fovVis=new Uint32Array(NCELL); here.fovStamp=1;
  { const pm=placeMem.get(placeKey()); if(pm){ here.explored.set(pm.explored); here.mem.set(pm.mem); } }
  visitedRooms=new Set(); stairsSeen=false; player.rally=0; rallyMotes=[]; if(adv.runStats&&!gallery)adv.runStats.maxDepth=Math.max(adv.runStats.maxDepth||0,here.depth); setTimeout(strataGrowth,50);
  if(ui.started&&!gallery&&!adv.dead&&!here.arrive){ const sp=here.inter?SPECIALS[here.inter.key]:null; if(sp&&(sp.k==='town'||sp.k==='oracle')){ player.hp=adv.PLAYER_MAX; setTimeout(()=>msg('<b style="color:#ffd9a0">+</b>静かな場所だ。張りつめていた体が、すっかりほどけた。'),1600); } else if(player.hp<adv.PLAYER_MAX){ player.hp=Math.min(adv.PLAYER_MAX,player.hp+adv.PLAYER_MAX*0.2); setTimeout(()=>msg('<span class="lab">階段を降りると、少し息が整った。</span>'),1600); } }
  player.x=(here.D.start%MW+0.5)*CELL; player.z=(((here.D.start/MW)|0)+0.5)*CELL; player.vx=player.vz=0; player.yaw=here.D.startYaw; player.pitch=-0.04; lockCell=-1;
  { const tc=here.arrive==='portal'&&here.D.portal?here.D.portal.cell:here.arrive==='bstairs'&&here.D.bstairs?here.D.bstairs.cell:here.arrive==='stairs'?here.D.stairs:-1;
    if(tc>=0){ const nb=[1,-1,MW,-MW,MW+1,MW-1,-MW+1,-MW-1].map(o=>tc+o).find(j=>j>=0&&j<NCELL&&here.D.tile[j]===TF&&!here.D.liquid[j]&&!here.D.solid.has(j))??tc;
      player.x=(nb%MW+0.5)*CELL; player.z=(((nb/MW)|0)+0.5)*CELL; player.yaw=Math.atan2(-((tc%MW)-(nb%MW)),-(((tc/MW)|0)-((nb/MW)|0)))+Math.PI; lockCell=tc; } here.arrive=null; }
  stealth.sneak=false; lantern.r=8.2; lantern.k=1;
  riverCells=[]; for(let i=0;i<NCELL;i++)if(here.D.flow[i]&&(here.D.liquid[i]===LQ_WATER||here.D.liquid[i]===LQ_DEEP))riverCells.push(i);
  trampled=[]; tallMsg=false; brimMsg=false; player.lastCell=-1; player.netT=0;
  scent=new Float32Array(NCELL); webMsg=false; webBurnMsg=false; repairMsg=false;
  pN=0; gasAny=false; initFire(); initEvents(); spark=null; projs=[]; showHint(''); edge.t=0; setFog(); initDust();
  renderStatus(); if(ui.helpOn)renderHelp();
  computeFOV(); checkEvents(true);
  if(player.fall){ player.fall=false; setTimeout(()=>{ hurtPlayer(roll(2,4),'落下の衝撃'); },300); }
  if(here.D.stratum!==lastStratum){ if(lastStratum!==null){ showStratum(here.D.stratum); if(here.D.stratum.msg)msg(`<b style="color:#c9b8ff">=</b>${here.D.stratum.msg}`); } lastStratum=here.D.stratum; }
}
function checkEvents(first){
  const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL);
  const ri=here.D.roomOf[pc];
  if(first)msg(here.depth===1?'<b style="color:#c9b8ff">@</b>石の迷宮に降り立った。闇の奥で、何かが息づいている。':`<b style="color:#ffcf7a">&gt;</b>深度 ${here.depth}。光はより鮮やかに、闇はより深くなった。`);
  if(ri>=0&&!visitedRooms.has(ri)){ visitedRooms.add(ri); const th=here.D.rooms[ri].theme; msg(`<b style="color:${css(th.col)}">${here.D.rooms[ri].cave?'~':'*'}</b>${th.msg}`); const km=here.D.rooms[ri].kindMsg; if(km)msg(`<b style="color:${css(th.col)}">=</b>${km}`); const mc=here.D.rooms[ri].machine; if(mc){ const mi=MACHINE_INFO[mc]; msg(`<b style="color:${css(mi.col)}">${mi.ch}</b>${mi.msg}`); } }
  if(!here.D.engrSeen&&here.D.engr.size){ for(const k of here.D.engr.keys()){ const i=k>>2; if(here.fovVis[i]===here.fovStamp&&Math.hypot((i%MW+0.5)*CELL-player.x,(((i/MW)|0)+0.5)*CELL-player.z)<7){ here.D.engrSeen=true; msg('<b style="color:#ffdca0">#</b>壁に彫刻が刻まれている。見つめれば、そこに描かれた出来事が読み取れる。'); break; } } }
  if(!stairsSeen&&here.fovVis[here.D.stairs]===here.fovStamp){ stairsSeen=true; msg('<b style="color:#ffcf7a">&gt;</b>金色に輝く下り階段を見つけた。踏み込めば、さらに深い階層へ。'); }
  if(lockCell>=0){ const lx=(lockCell%MW+0.5)*CELL, lz=(((lockCell/MW)|0)+0.5)*CELL; if(Math.hypot(player.x-lx,player.z-lz)>1.6)lockCell=-1; }
  if(ui.started&&!here.trans&&here.D.upstairs>=0&&lockCell!==here.D.upstairs){ const ux=(here.D.upstairs%MW+0.5)*CELL, uz=(((here.D.upstairs/MW)|0)+0.5)*CELL; if(Math.hypot(player.x-ux,player.z-uz)<0.95){ here.trans={phase:'out',t:0,regen:false,go:'up'}; msg('<b style="color:#c9b8ff">&lt;</b>上り階段を上り、来た道を引き返す……'); } }
  if(ui.started&&!here.trans&&here.D.bstairs&&lockCell!==here.D.bstairs.cell){ const bx=(here.D.bstairs.cell%MW+0.5)*CELL, bz=(((here.D.bstairs.cell/MW)|0)+0.5)*CELL; if(Math.hypot(player.x-bx,player.z-bz)<0.95){ here.trans={phase:'out',t:0,regen:false,go:'branch'}; msg(`<b style="color:${css(BRANCHES[here.D.bstairs.key].col)}">&gt;</b>本道を外れ、${BRANCHES[here.D.bstairs.key].name}へ続く脇道を下りていく……`); } }
  if(ui.started&&!here.trans&&here.D.portal&&lockCell!==here.D.portal.cell){ const px2=(here.D.portal.cell%MW+0.5)*CELL, pz2=(((here.D.portal.cell/MW)|0)+0.5)*CELL; if(Math.hypot(player.x-px2,player.z-pz2)<1.0){ here.trans={phase:'out',t:0,regen:false,go:'realm'}; msg(`<b style="color:${css(REALMS[here.D.portal.key].col)}">0</b>揺らめく門をくぐった……`); } }
  const sx=(here.D.stairs%MW+0.5)*CELL, sz=(((here.D.stairs/MW)|0)+0.5)*CELL;
  if(ui.started&&!here.trans&&here.D.pit&&here.D.pit[pc]){ here.trans={phase:'out',t:0,regen:false}; player.fall=true; msg('<b style="color:#ffa060">:</b>崩れた穴へ身を投じ、下の階層へと落ちていく……'); }
  if(ui.started&&!here.trans&&lockCell!==here.D.stairs&&Math.hypot(player.x-sx,player.z-sz)<0.95&&!isFinal()){
    if(stairsGuarded()){ if(clock.time-(updatePlayer.sealT||-99)>6){ updatePlayer.sealT=clock.time; msg('<b style="color:#ff8a8a">=</b>階段は、見えない封に閉ざされている。控えの間に潜むものを退ければ、解けるだろう。'); } }
    else if(descentSealed()){ if(clock.time-(updatePlayer.sealT||-99)>9){ updatePlayer.sealT=clock.time; msg('<b style="color:#a98cff">.</b>階段の先は、底の見えない闇に塞がれている。三つの窪みが、何かを待つように淡く光っている。'); } }
    else { here.trans={phase:'out',t:0,regen:false}; msg(legendAll()&&here.depth===FINAL_DEPTH-1?'<b style="color:#ffe9b0">*</b>三つの光が闇を押し分けた。最後の階段を、底へと降りていく……':'<b style="color:#ffcf7a">&gt;</b>光の螺旋に身を委ね、さらに深くへ降りていく。'); } }
  let ex=0; for(let i=0;i<NCELL;i++){ const tt=here.D.tile[i]; if(here.explored[i]&&(tt===TF||tt===TP))ex++; }
  const exP=Math.min(100,Math.round(ex/here.D.floorCount*100)); if(exP!==hudInfo.explored){ hudInfo.explored=exP; if(ui.helpOn)renderHelp(); }
}

// ---------------------------------------------------------------- player
const iceT=new Map();
function crackIce(i,dt){
  const t0=(iceT.get(i)||0)+dt; iceT.set(i,t0);
  if(t0<dt*1.5){ sSqueak(player.x,player.z); if(!here.D.crackMsg){ here.D.crackMsg=true; msg('<b style="color:#b8e4ff">/</b>足元の氷が、ぴしりと音を立ててきしんだ。'); } }
  if(t0>0.85){ here.D.liquid[i]=LQ_WATER; here.D.thin[i]=0; cellFlag[i]=50; uploadCells(); sSplash(0.45); vfx.shake=Math.max(vfx.shake,0.15);
    msg('<b style="color:#6ab4ff">~</b>氷が割れ、冷たい水に足が沈んだ。');
    const [x,z]=cpos(i); for(let q=0;q<26;q++){ const a=mr()*6.28; spawn(x+Math.cos(a)*0.5,0.1,z+Math.sin(a)*0.5,Math.cos(a)*1.2,0.6+mr(),Math.sin(a)*1.2,1+mr(),G(mpick(['/','\\','~','*'])),0.16,0.6,0.85,1.0,1); } }
}
const tallAt=i=>i>=0&&i<NCELL&&(here.D.surface[i]===SF_FOLIAGE||here.D.surface[i]===SF_FUNGFOR)&&cellFlag[i]!==20&&!burnt[i]&&!here.D.liquid[i];
let trampled=[], tallMsg=false, brimMsg=false;
function trample(i){ if(!tallAt(i))return; cellFlag[i]=20; uploadCells(); trampled.push([i,clock.time]); sHiss(player.x,player.z,0.22); }
function regrow(){ if(!trampled.length)return; const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL); let ch=false;
  trampled=trampled.filter(([i,t0])=>{ if(clock.time-t0>45&&i!==pc&&cellFlag[i]===20){ cellFlag[i]=0; ch=true; return false; } return cellFlag[i]===20; }); if(ch)uploadCells(); }
function brimFlare(i){ if(here.D.surface[i]!==SF_BRIM||fire[i]>0.1||fuel[i]<=0)return; ignite(i,1.0,false); for(const d of D4){ const j=i+d[0]+d[1]*MW; if(here.D.surface[j]===SF_BRIM&&fuel[j]>0)ignite(j,0.6,false); } sCrackleBurst&&sCrackleBurst((i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL);
  if(!brimMsg){ brimMsg=true; msg('<b style="color:#ffd04a">*</b>足元の硫黄が、ぼっと燃え上がった！ しばらくすると、また燃えるようになる。'); } }
let brimT=0; function brimRecover(dt){ brimT+=dt; if(brimT<2)return; brimT=0; let ch=false; for(let i=0;i<NCELL;i++){ if(here.D.surface[i]===SF_BRIM&&burnt[i]&&fire[i]<=0&&mr()<0.08){ burnt[i]=0; fuel[i]=0.8; ch=true; } } if(ch)uploadCells(); }
// ---------------------------------------------------------------- hidden traps, a lever-and-portcullis vault, sanctuaries (mechanisms after Brogue's machines; written independently)
// TRAP_INFO は src/lib/names.ts（src/game/imports.mjs で読む）
function triggerTrap(tr){
  tr.used=true; tr.hidden=false; const [x,z]=cpos(tr.i), info=TRAP_INFO[tr.type], tag=`<b style="color:${info[1]}">^</b>`;
  switch(tr.type){
    case 'alarm': sAlarm(x,z); vfx.shake=Math.max(vfx.shake,0.2); msg(tag+'カチリ……鐘の音が響き渡った！ 辺りの獣が集まってくる。');
      for(const m of here.monsters){ if(m.ty.critter||m.dead)continue; if(Math.hypot(m.x-x,m.z-z)<32){ m.sleep=false; m.aware=Math.max(m.aware,0.8); m.goal=[x,z]; m.goalT=clock.time+15; } } break;
    case 'trapdoor': sRumble(0.5,1.2); vfx.shake=Math.max(vfx.shake,0.4); msg(tag+'床が抜けた！ 闇の中を、下の階へと落ちていく……'); here.trans={phase:'out',t:0,regen:false}; player.fall=true; break;
    case 'net': player.netT=3.2; sHiss(x,z,0.5); msg(tag+'網が降ってきた！ もがいて抜け出そうとする……'); break;
    case 'flood': sSplash(0.5); msg(tag+'床の穴から、水が勢いよく噴き出した！'); events.push({type:'flood',ri:-2,order:tr.order.slice(),src:tr.i,state:1,t:0,k:0,max:tr.order.length*3}); break;
    case 'methane': sHiss(x,z,1.2); msg(tag+'床の穴から、沼のガスが噴き出した。火気に注意！');
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){ const j=tr.i+dx+dy*MW; if(j>=0&&j<NCELL&&here.D.tile[j]!==TW&&Math.hypot(dx,dy)<=2.3)here.D.gas[j]=Math.max(here.D.gas[j],0.9); } gasAny=true; break;
  }
}
function updateTraps(dt){
  for(const tr of (here.D.traps||[])){
    const [x,z]=cpos(tr.i), d=Math.hypot(x-player.x,z-player.z);
    if(tr.hidden&&d<CELL*1.3){ const mv=Math.hypot(player.vx,player.vz)>0.3, rate=(stealth.sneak?1.1:0.3)*(mv?0.6:1.6);
      if(mr()<dt*rate){ tr.hidden=false; sChime(x,z,0.15); msg(`<b style="color:${TRAP_INFO[tr.type][1]}">^</b>隠された${TRAP_INFO[tr.type][0]}罠を見つけた。踏まないように気をつけよう。`); } }
    if(!tr.used&&d<0.6&&!here.trans)triggerTrap(tr);
  }
  if(player.netT>0){ const mv=keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD; player.netT-=dt*(mv?1.6:1); if(player.netT<=0)msg('網から抜け出した。'); }
  const G2=here.D.gate;
  if(G2&&!G2.open){ const [lx,lz]=cpos(G2.lever); if(Math.hypot(player.x-lx-G2.ld[0]*0.6,player.z-lz-G2.ld[1]*0.6)<1.1){ G2.open=true; G2.pulled=clock.time; sCreak(lx,lz); const [gx,gz]=cpos(G2.cell); setTimeout(()=>sRumble(0.25,1.6),500); msg('<b style="color:#ffd48a">/</b>壁のレバーを引いた。どこか遠くで、鉄格子が軋みながら上がっていく音がした。'); } }
  if(G2)G2.o+=((G2.open?1:0)-G2.o)*Math.min(1,dt*0.8);
}
function drawTraps(t){
  for(const tr of (here.D.traps||[])){ if(tr.hidden)continue; const [x,z]=cpos(tr.i); if(Math.hypot(x-player.x,z-player.z)>30)continue;
    const col=TRAP_INFO[tr.type][1], c=[parseInt(col.slice(1,3),16)/255,parseInt(col.slice(3,5),16)/255,parseInt(col.slice(5,7),16)/255], k=tr.used?0.35:1.2+0.5*Math.sin(t*2.5+tr.i);
    dyn(x,0.05,z,G('^'),0.7,c[0]*k,c[1]*k,c[2]*k,1,0);
    for(let q=0;q<8;q++){ const a=q/8*Math.PI*2+t*0.4; dyn(x+Math.cos(a)*0.55,0.04,z+Math.sin(a)*0.55,G('.'),0.18,c[0]*k*0.7,c[1]*k*0.7,c[2]*k*0.7,1,a); } }
  const G2=here.D.gate; if(G2){ const [gx,gz]=cpos(G2.cell);
    if(Math.hypot(gx-player.x,gz-player.z)<36){ const lift=G2.o*2.7;
      for(let k=0;k<7;k++){ const u=(k+0.5)/7*CELL-CELL/2, bx=G2.axis===0?gx:gx+u, bz=G2.axis===0?gz+u:gz;
        for(let y=0.15+lift;y<3.0;y+=0.3)dyn(bx,y,bz,G('|'),0.3,0.75,0.72,0.8); }
      for(const yy of [0.9+lift,1.9+lift])if(yy<3.0)for(let k=0;k<7;k++){ const u=(k+0.5)/7*CELL-CELL/2; dyn(G2.axis===0?gx:gx+u,yy,G2.axis===0?gz+u:gz,G('='),0.28,0.75,0.72,0.8); } }
    const [lx,lz]=cpos(G2.lever), wx=lx+G2.ld[0]*0.93, wz=lz+G2.ld[1]*0.93;
    dyn(wx,1.3,wz,G('#'),0.4,0.6,0.55,0.5); dyn(wx-G2.ld[0]*0.08,1.45,wz-G2.ld[1]*0.08,G(G2.open?'\\':'/'),0.42,1.4,1.1,0.5); }
  if(player.netT>0&&ui.camMode==='tps'){ for(let k=0;k<16;k++){ const a=k/16*Math.PI*2+clock.time*0.3; for(let y=0.3;y<1.9;y+=0.32)dyn(player.x+Math.cos(a)*0.55,y,player.z+Math.sin(a)*0.55,G(k%2?'+':'#'),0.16,0.6,0.55,0.65); } }
  else if(player.netT>0){ const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw), rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw), cy=camera.position.y;
    for(let a=-3;a<=3;a++)for(let b=-2;b<=2;b++)dyn(camera.position.x+fx*0.7+rx*a*0.16,cy+b*0.16,camera.position.z+fz*0.7+rz*a*0.16,G('+'),0.1,0.55,0.5,0.6); }
}

// ---------------------------------------------------------------- life and death, and plain real-time melee
// numbers are this game's own, set by tier (not copied from any other game's tables)
// [hp, min damage, max damage, seconds between attacks]
const MSTAT={r:[6,1,3,1.0],k:[7,1,4,1.1],j:[8,2,4,0.9],e:[18,3,7,1.4],m:[12,1,3,0.9],b:[4,0,0,9],g:[15,2,5,1.1],c:[10,2,4,1.3],J:[50,1,3,1.0],v:[18,2,6,0.8],
  O:[55,9,13,1.8],w:[10,4,8,1.6],W:[50,6,13,1.5],P:[20,4,9,1.4],S:[20,3,7,1.1],Zf:[25,4,8,1.0],Zi:[25,4,8,1.0],Zl:[25,4,8,1.0],s:[18,2,6,1.2],sw:[22,3,7,1.2],
  B:[55,3,7,1.6],N:[75,7,11,1.5],l:[60,5,11,1.4],K:[120,8,15,2.0],T:[65,10,15,1.7],Y:[300,4,8,2.2],D:[150,20,30,2.4],L:[35,8,14,1.8],n:[12,2,5,1.0],X:[200,12,20,2.0]};
// WEAPON・SLEEP_MULT は src/lib/runes.ts（src/game/imports.mjs で読む）
// roll は src/lib/random.ts（src/game/imports.mjs で読む）
const statOf=m=>{ const st=MSTAT[m.ty.sk||m.key]||[12,2,5,1.2]; return trialOn('fury')?[st[0]*1.3,st[1]*1.3,st[2]*1.3,st[3]]:st; };
const hostile=m=>!m.ty.critter&&!m.ty.peaceful&&!m.ty.watcher&&m.ty.form!=='bloat'&&!m.dead;
const hittable=m=>!m.dead&&!m.ty.peaceful;
const foe=m=>hittable(m)&&(hostile(m)||m.ty.watcher||m.ty.form==='bloat'||m.ty.form==='shroom'||(m.ty.critter==='mimic'&&!m.hidden));
// angDiff は src/lib/math.ts（古い JS は使わない。src/lib/ の生成などが使う）
// expNeed・expOf は src/lib/progress.ts（src/game/imports.mjs で読む）
// serRune は src/lib/runes.ts（src/game/imports.mjs で読む）
function initMonsterLife(m){ const st=statOf(m); m.maxHp=Math.round(st[0]*(m.ty.boss?1.5:1)); m.hp=m.maxHp; m.atkCd=0.5+mr(); m.wind=0; }
// ---------------------------------------------------------------- levelling: defeating creatures gives experience; at each level time stops and you choose one of three
// (two blessings - strengths tied to actions and elements, some with a price - and one rune or charm). Max health does not grow with level: it grows by 4 on entering each new stratum.
let lvlOpenT=0, lvlOpts=[];
const BLESS={
  tough:    {name:'頑丈な体',     d:l=>`最大体力が ${6*l} 増える`},
  quickdodge:{name:'身軽な詠唱',  d:l=>`かわしてから ${l>=2?2.5:1.5}秒以内の詠唱が、半分の時間で済む`},
  counter:  {name:'返しの一撃',   d:l=>`かわしてから 1.5秒の間、与える傷が ${l>=2?80:50}% 増える`},
  momentum: {name:'追い風',         d:l=>`敵を倒すと、3秒の間、性質の傷が ${l>=2?40:25}% 増える`},
  devour:   {name:'巻き返し',   d:l=>`敵を倒した時、取り戻せる傷が、さらに ${3*l} 戻る`},
  kindle:   {name:'火攻め',   d:l=>`燃えている敵への傷が ${l>=2?40:25}% 増える`},
  shatter:  {name:'冷え込み',     d:l=>`凍えた敵を自分の攻撃で倒すと、周り ${l>=2?3.5:2.5}m の敵も凍える`},
  branch:   {name:'裂ける雷',       d:l=>`雷の連鎖が ${l} 増える`},
  charge:   {name:'溜めの一撃',   d:l=>`詠唱が満ちた後も構え続けて放つと、傷が ${l>=2?50:30}% 増える`},
  desperate:{name:'背水',         d:l=>`体力が半分を切ると、詠唱が ${l>=2?45:30}% 速い`},
  swapedge: {name:'持ち替えの冴え', d:l=>`ビルドを替えてから 3秒の間、与える傷が ${l>=2?90:60}% 増える`},
  scorch:   {name:'焦熱',         d:l=>`燃えている敵への傷が ${l>=2?70:50}% 増える。ただし、燃焼を生き延びた敵は、体力が3割戻る`, cost:true},
  reckless: {name:'捨て身',       d:l=>`与える傷が ${l>=2?40:25}% 増える。ただし、受ける傷も ${l>=2?35:25}% 増える`, cost:true} };
const BL=k=>adv.lvl.bless[k]||0;
// a cold snap: the creatures around are chilled (and fire goes out, water freezes)
function coldSnap(x,z,r){ chillArea(x,z,r); for(const m of here.monsters){ if(m.dead||m.ty.critter)continue; if(Math.hypot(m.x-x,m.z-z)<r+0.3*m.ty.scale){ const st=m.st||(m.st={}); st.chill=Math.max(st.chill||0,4); } }
  for(let q=0;q<28;q++){ const a=q/28*Math.PI*2; spawn(x+Math.cos(a)*r*0.9,0.15,z+Math.sin(a)*r*0.9,Math.cos(a)*0.6,0.4,Math.sin(a)*0.6,0.6,G(mpick(['*','.','+'])),0.14,1.2,1.7,2.2,0); } }
function gainExp(e){ if(!(e>0)||adv.dead)return; adv.lvl.exp+=e; let up=0; while(adv.lvl.exp>=expNeed(adv.lvl.n)){ adv.lvl.exp-=expNeed(adv.lvl.n); adv.lvl.n++; adv.lvl.pending++; up++; }
  renderStatus(); if(up){ sChime(player.x,player.z,0.6); setTimeout(()=>sChime(player.x,player.z,0.45),180); for(let q=0;q<40;q++){ const a=mr()*6.28, r=1.6+mr(); spawn(player.x+Math.cos(a)*r,0.4+mr()*1.6,player.z+Math.sin(a)*r,-Math.cos(a)*r*2.2,0.2,-Math.sin(a)*r*2.2,0.45,G(mpick(['*','+','.'])),0.14,2.6,2.3,1.5,0); } } }
function levelChoices(){ const BEHAVE=['quickdodge','counter','momentum','devour','shatter','charge','swapedge','branch']; let pool=Object.keys(BLESS).filter(k=>BL(k)<2&&!lockedOf('bless',k)), out=[];
  if(!adv.lvl.firstDone){ const b=pool.filter(k=>BEHAVE.includes(k)); if(b.length>=2)pool=b; adv.lvl.firstDone=true; }
  for(let i=0;i<2&&pool.length;i++){ const k=pool.splice(Math.floor(mr()*pool.length),1)[0]; out.push({kind:'bless',k}); }
  const useCharm=(adv.runState.bodyOpen||0)>0&&mr()<0.3, t=useCharm?RUNE_TYPES.body[Math.floor(mr()*RUNE_TYPES.body.length)]:randomRuneType(mr,{elem:0.45,trig:0.15,mod:0.4,body:0});
  out.push({kind:'rune',ru:RUNE_DEF[t].cat==='mod'&&mr()<0.1?makeStrong(t):makeRune(t,0)}); return shuffle(out,mr); }
function lvlLine(o){ const K=t=>t+' '.repeat(Math.max(2,14-visW(t))); // the label column is 14 wide (the longest, 恩恵（代償）, is 12)
  if(o.kind==='bless'){ const B=BLESS[o.k], l=BL(o.k)+1; return `${K(B.cost?'恩恵（代償）':'恩恵')}<span style="color:${B.cost?'#ff9a8a':'#ffe3a0'}">${B.name}${l>1?' II':''}</span>`; }
  const d=RUNE_DEF[o.ru.type], br=CAT_BR[d.cat]||['','']; return `${K(d.cat==='body'?'護符':'ルーン')}${br[0]}<b class="rn" style="color:${css(runeCol(o.ru))}">${d.ch}</b> ${runeName(o.ru)}${br[1]}　<span class="lab">${CAT_NAME[d.cat]}</span>`; }
function renderLevelUp(){ const el=document.getElementById('altarp'); if(!el)return; const f=t=>`<span class="f">${t}</span>`, rows=[f(`+-- レベルが上がった（Lv${adv.lvl.n-adv.lvl.pending+1}） ---`),f('|')];
  lvlOpts.forEach((o,i)=>rows.push(`${f('|')}  <button class="row ao" data-lk="${i}">${clipHtml(lvlLine(o),ALTAR_W-6)}</button>`));
  rows.push(f('|')); for(let i=0;i<4;i++)rows.push(`${f('|')} <span class="ldet">${padTo('',ALTAR_W-3)}</span>`);
  rows.push(f('|'),`${f('|')} <span class="lab">マウスを乗せると説明が出る。クリックで選ぶ</span>`,f('+---')); el.innerHTML=boxText(rows,ALTAR_W); setLevelDetail(null);
  if(!el.dataset.lvBound){ el.dataset.lvBound='1'; el.addEventListener('mouseover',e=>{ if(!ui.lvlOpen)return; const b=e.target.closest&&e.target.closest('button[data-lk]'); setLevelDetail(b?lvlOpts[+b.dataset.lk]:null); }); el.addEventListener('click',e=>{ if(!ui.lvlOpen)return; const b=e.target.closest&&e.target.closest('button[data-lk]'); if(!b)return; e.stopPropagation(); if(performance.now()-lvlOpenT<400)return; chooseLevel(+b.dataset.lk); }); } }
function setLevelDetail(o){ const el=document.getElementById('altarp'); if(!el)return; let L;
  if(!o)L=['<span class="lab">選択肢にマウスを乗せると、ここに説明が出る</span>','','',''];
  else if(o.kind==='bless'){ const B=BLESS[o.k], l=BL(o.k)+1, w=wrapPlain(B.d(l),ALTAR_W-10); L=[`<span style="color:${B.cost?'#ff9a8a':'#ffe3a0'}">${B.name}${l>1?' II（2回目で強まる）':''}</span>　<span class="lab">（恩恵${B.cost?'・代償あり':''}）</span>`,...w.slice(0,3).map(t=>`    <span class="lab">${t}</span>`)]; }
  else L=detailLines(o.ru).slice(0,4);
  el.querySelectorAll('.ldet').forEach((sp,i)=>{ sp.innerHTML=padTo(clipHtml(L[i]||'',ALTAR_W-4),ALTAR_W-3); }); }
function openLevelUp(){ const el=document.getElementById('altarp'); if(!el||ui.lvlOpen)return; ui.lvlOpen=true; lvlOpenT=performance.now(); lvlOpts=levelChoices(); document.body.classList.toggle('paused',true);
  if(gear.castSt){ gear.castSt=null; beamSegs=[]; } if(ui.locked&&document.exitPointerLock)document.exitPointerLock(); renderLevelUp(); el.classList.add('show','open'); }
function chooseLevel(i){ const o=lvlOpts[i]; if(!o)return;
  if(o.kind==='bless'){ adv.lvl.bless[o.k]=BL(o.k)+1; if(o.k==='tough'){ adv.PLAYER_MAX+=6; player.hp=Math.min(adv.PLAYER_MAX,player.hp+6); } msg(`<b style="color:#ffe3a0">+</b>恩恵「${BLESS[o.k].name}」を得た。${BLESS[o.k].d(BL(o.k))}。`); }
  else takeRune(o.ru);
  adv.lvl.pending=Math.max(0,adv.lvl.pending-1); renderStatus(); renderHotbar();
  if(adv.lvl.pending>0){ lvlOpenT=performance.now(); lvlOpts=levelChoices(); renderLevelUp(); return; }
  ui.lvlOpen=false; const el=document.getElementById('altarp'); if(el)el.classList.remove('show','open'); document.body.classList.toggle('paused',isPaused()); if(!plFailed&&ui.started&&!adv.dead)tryLock(); updateResume(); }
// a new stratum strengthens the body
function strataGrowth(){ if(!here.D||here.branch||here.realm||here.inter||!ui.started||gallery)return; const k=here.D.stratum&&here.D.stratum.k; if(!['cavern','ruins','magma','abyss'].includes(k)||adv.lvl.strata.has(k))return; adv.lvl.strata.add(k); adv.PLAYER_MAX+=4; player.hp=Math.min(adv.PLAYER_MAX,player.hp+4); renderStatus();
  setTimeout(()=>msg('<b style="color:#ffd9a0">+</b>新しい層の空気が、体を強くした。最大体力 +4。'),2200); }
function hurtPlayer(n,cause){
  if(godMode)return; if((player.invulT||0)>clock.time)return; if(BL('reckless'))n*=BL('reckless')>=2?1.35:1.25;
  n*=Math.max(0.4,1-0.15*bodyN('ward'));
  if(adv.dead||!ui.started||gallery||n<=0)return;
  player.hp-=n; player.lastHurt=clock.time; { const mn=bodyN('mend'); player.rally=Math.min(Math.max(0,adv.PLAYER_MAX-player.hp),(player.rally||0)+n*0.6); player.rallyRate=player.rally/Math.max(1,4*(1+0.5*mn)-0.6); } vfx.hurtFlash=Math.min(1.2,vfx.hurtFlash+0.35+n*0.05); vfx.shake=Math.max(vfx.shake,Math.min(0.5,0.12+n*0.03));
  if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sTone(t,'sine',140,60,0.25,sOut(undefined,undefined,0.35)),t,0.01,0.22); }
  if(clock.time-(hurtPlayer.mt||-9)>0.8||hurtPlayer.mc!==cause){ hurtPlayer.mt=clock.time; hurtPlayer.mc=cause; msg(`<b style="color:#ff5a4a">-</b>${cause}で ${n} の傷を負った。`); }
  if(player.hp<=0)player.hp=0;
  renderStatus();
  if(player.hp<=0)die(cause);
}
function resultPlace(){ const pl=placeLabel(); return /^[0-9]+$/.test(String(pl).trim())?`深度${here.depth}（${(here.D&&here.D.stratum&&here.D.stratum.name)||''}）`:`${pl}（深度${here.depth}）`; }
function runLore(victory){ const L=getLegend(), parts=[], add=(lab,n,v)=>{ if(v>0)parts.push([lab,n,v]); }, md=(adv.runStats&&adv.runStats.maxDepth)||here.depth;
  add('到達した深さ',`深度${md}`,md*2); const lords=adv.runState.lordsDone?adv.runState.lordsDone.size:0; add('倒した支道の主',`${lords}体`,lords*8);
  const pl=L?L.placed.size:0; add('捧げた伝説の物',`${pl}つ`,pl*6); if(victory)add('最後の王の影に勝った','',30);
  const lg=Math.max(0,(adv.lvl.n||1)-1); add('上がったレベル',`${lg}つ`,lg);
  const nb=Math.max(0,BOOK.size-((adv.runStats&&adv.runStats.book0)||0)); add('新しく記した反応',`${nb}つ`,nb*3); const nbe=(adv.runStats&&adv.runStats.beastsNew)||0; add('初めて出会った忘れられた獣',`${nbe}体`,nbe*4);
  const base=parts.reduce((a,p)=>a+p[2],0), mult=1+0.25*adv.runTrials.length; return {parts,base,mult,total:Math.round(base*mult)}; }
function awardLore(victory){ if(!adv.runStats||gallery)return null; if(adv.runStats.loreRes)return adv.runStats.loreRes; const R=runLore(victory); META.lore=(META.lore||0)+R.total; saveMeta(); adv.runStats.loreRes=R; return R; }
function loreRows(R,f){ if(!R)return []; const rows=[`${f('|')}  <b>伝承</b>`]; for(const [lab,n,v] of R.parts)rows.push(`${f('|')}    ${padTo(lab+(n?`（${n}）`:''),34)}${String(v).padStart(4)}`);
  if(R.mult>1)rows.push(`${f('|')}    ${padTo(`試練（${adv.runTrials.map(k=>({dusk:'薄明',fury:'猛り'})[k]).join('・')}）`,34)}  ×${R.mult.toFixed(2)}`);
  rows.push(`${f('|')}    ${padTo('合計',34)}<b style="color:#ffe3a0">${String('+'+R.total).padStart(4)}</b>`, `${f('|')}    <span class="lab">累計 ${META.lore}　　使える伝承 ${loreLeft()}</span>`);
  if(UNLOCKS.some(u=>!unlocked(u.id)&&u.cost<=loreLeft()))rows.push(`${f('|')}    <span style="color:#ffe3a0">解放できるものがある（タイトルの［解放］から）</span>`);
  else { const nx=UNLOCKS.filter(u=>!unlocked(u.id)).sort((a,b)=>a.cost-b.cost)[0]; if(nx)rows.push(`${f('|')}    <span class="lab">次の解放まで あと ${nx.cost-loreLeft()}（${nx.name} ${nx.cost}）</span>`); } return rows; }
// the grave: what the fallen adventurer leaves (one thing, chosen on the results screen)
let graveSel=0, graveCands=[];
function graveRune(g){ const ru=makeRune(g.type,0); ru.strong=false; if(g.traits&&g.traits.length)ru.traits=g.traits.map(t=>({k:t.k,lv:t.lv-1})).filter(t=>t.lv>0); return ru; }
function graveCandidates(){ const out=[], seen=new Set(), add=ru=>{ if(ru&&!seen.has(ru)){ seen.add(ru); out.push(ru); } };
  add(gear.hands.L.atk); add(gear.hands.R.atk); for(const h of ['L','R'])for(const r of gear.hands[h].slots)add(r); if(gear.hands.B){ add(gear.hands.B.b0); add(gear.hands.B.b1); } for(const r of gear.bag)add(r); return out.slice(0,10); }
function saveGrave(){ if(adv.won||!graveCands)return; const ru=graveSel>0?graveCands[graveSel-1]:null; META.grave=ru?{k:(STRATA.find(st=>here.depth>=st.from&&here.depth<=st.to)||{}).k||'',depth:here.depth,cause:adv.runStats.cause||'',item:serRune(ru)}:null; saveMeta(); graveCands=[]; }
function graveRows(f){ const rows=[`${f('|')}  <b>墓に遺すもの</b>　<span class="lab">（ひとつ選ぶ。次の冒険で、同じ深さに墓が現れる）</span>`];
  const opt=(i,label)=>`${f('|')}    <button class="row gv" data-gv="${i}"><span class="mk">${graveSel===i?'&gt;':' '}</span> ${label}</button>`;
  rows.push(opt(0,'<span class="lab">遺さない</span>')); graveCands.forEach((ru,i)=>rows.push(opt(i+1,clipHtml(thingLabel(ru),48)))); return rows; }
function die(cause){
  if(adv.won)return;
  adv.dead=true; keys.KeyW=keys.KeyA=keys.KeyS=keys.KeyD=false;
  const el=document.getElementById('death'); if(!el)return;
  const secs=Math.floor(clock.time-adv.runStats.t0), mm=Math.floor(secs/60), ss=String(secs%60).padStart(2,'0');
  const f=t=>`<span class="f">${t}</span>`;
  adv.runStats.cause=cause; const R=awardLore(false); graveCands=gallery?[]:graveCandidates(); graveSel=0; if(ui.locked&&document.exitPointerLock)document.exitPointerLock();
  const draw=()=>{ el.innerHTML=boxText([f('+-- あ な た は 死 ん だ ---'),f('|'),`${f('|')}  死因      ${cause}`,`${f('|')}  場所      ${resultPlace()}`,
    `${f('|')}  Lv${adv.lvl.n}　倒した敵 ${adv.runStats.kills}　時間 ${mm}:${ss}`,f('|'),...loreRows(R,f),f('|'),...(graveCands.length?[...graveRows(f),f('|')]:[]),`${f('|')}  ${HIST?HIST.civ.name+'の地に、またひとつ灯りが消えた。':''}`,f('|'),`${f('|')}  <button class="row" id="newRunB"><b>[Enter]</b> 新しい冒険へ</button>`,f('+---')],64); };
  document.body.classList.add('over'); draw(); el.onclick=e=>{ const b=e.target.closest&&e.target.closest('button'); if(!b)return; if(b.dataset.gv!==undefined){ graveSel=+b.dataset.gv; draw(); } else if(b.id==='newRunB')newRun(); };
  el.classList.add('show'); sRumble(0.6,2.5);
}
function newRun(){
  saveGrave(); document.body.classList.remove('over');
  const el=document.getElementById('death'); if(el)el.classList.remove('show','won');
  adv.dead=false; adv.runSeed=(Math.random()*1e9)>>>0; here.depth=1; here.branch=null; here.realm=null; here.inter=null; placeMem.clear(); here.arrive=null;
  here.trans=null; player.fall=false; gallery=null; { const gp=document.getElementById('gal'); if(gp)gp.classList.remove('show'); }
  adv.PLAYER_MAX=40; adv.lvl={n:1,exp:0,pending:0,bless:{},strata:new Set()}; adv.runTrials=(META.trials||[]).filter(k=>unlocked('t_'+k)); player.hp=adv.PLAYER_MAX; adv.runStats={kills:0,t0:clock.time,maxDepth:here.depth,book0:BOOK.size,beastsNew:0}; resetRunes(); newLevel();
}
function hitReact(m,n){ const ty=m.ty, boss=ty.boss||m.key==='lord'||m.key==='final', now=performance.now();
  m.flinchUntil=clock.time+Math.min(0.26,0.08+n*0.015);
  if(!boss&&!ty.habitat&&!['shroom','kraken','deepkraken'].includes(ty.form)){ const heavy=['O','T','Y','B','D','X'].includes(m.key)||ty.beast?2.5:1, w=Math.max(0.3,(ty.scale||1)*(ty.scale||1)*heavy), v=Math.min(6,n*0.9/w);
    const ak={blade:1.0,bolt:0.45,orb:0.75,beam:0.12,bare:0.6}[m.lastAtk]||0.6, vv=v*0.5*ak*(m.lastKnock||1), src=(m.lastAtk==='orb'&&hitSrcPoint)?hitSrcPoint:[player.x,player.z];
    if(vv>0.3){ const dx=m.x-src[0], dz=m.z-src[1], d=Math.hypot(dx,dz)||1; m.kx=(m.kx||0)+dx/d*vv; m.kz=(m.kz||0)+dz/d*vv; m.st=m.st||{}; } }
  if(m.wind>0&&!boss&&(n>=6||n>=(m.maxHp||99)*0.2)){ m.wind=0; m.atkCd=Math.max(m.atkCd||0,0.8); const cy=m.y+1.2*(ty.scale||1); for(let q=0;q<8;q++){ const a=mr()*6.28; spawn(m.x,cy,m.z,Math.cos(a)*1.6,0.4+mr(),Math.sin(a)*1.6,0.35,G(mpick(['!','\'','.'])),0.14,2.4,1.4,0.6,0); } }
  const strong=m.hp<=0||n>=8||n>=(m.maxHp||99)*0.25; if(strong&&now>hitStopUntil+90)hitStopUntil=now+(m.hp<=0?65:45); }
function damageMonster(m,n,how){
  if(m.dead||n<=0)return;
  if(m.key==='final'&&(!finalExposed(m)||m.invulnT>0)){ if(how!=='env')hitFeedback(m,0,null,false); return; }
  if(m.sleep&&how!=='env'){ n*=SLEEP_MULT;
    // a hit on a sleeper: a bright gold burst and a deep strike sound instead of words
    for(let q=0;q<22;q++){ const a=mr()*6.28, e=mr()*1.2; spawn(m.x,m.y+0.6*m.ty.scale,m.z,Math.cos(a)*2.4,0.8+e*1.6,Math.sin(a)*2.4,0.6+mr()*0.5,G(mpick(['*','+','\''])),0.2,3.4,2.6,1.0,0); }
    vfx.shake=Math.max(vfx.shake,0.18);
    if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sTone(t,'square',180,60,0.18,sOut(m.x,m.z,0.35)),t,0.005,0.25); } }
  if(m.ty.dummy){ m.dsum=(m.dsum||0)+n; m.dT=2; }
  m.hp-=n; m.hitT=0.22; m.sleep=false; if(m.hidden)m.revealNow=true; rallyOnHit(m,n,how); if(how!=='env'&&clock.time-(m.playerT||-99)<0.05)hitReact(m,n);
  if(!m.noticed&&hostile(m)){ m.aware=1.25; onNoticed(m); }
  for(let q=0;q<10;q++){ const a=mr()*6.28; spawn(m.x,m.y+0.6*m.ty.scale+mr()*0.4,m.z,Math.cos(a)*1.4,0.6+mr()*1.2,Math.sin(a)*1.4,0.5+mr()*0.3,G(mpick(['*','+','.'])),0.14,2.2,1.9,1.6,0); }
  if(m.hp<=0){ m.dead=true; adv.runStats.kills++; lordFell(m); if(m.key==='final')setTimeout(victory,1800); if(how!=='env'){ dropRune(m); onKilledBy(m); }
    if(clock.time-(m.playerT||-99)<6)gainExp(expOf(m)); if(BL('momentum')&&clock.time-(m.playerT||-99)<1)player.momUntil=clock.time+3; if(BL('shatter')&&m.st&&m.st.chill>0&&clock.time-(m.playerT||-99)<0.1)coldSnap(m.x,m.z,BL('shatter')>=2?3.5:2.5);
    for(const p of m.form){ if(mr()<0.6)continue; const a=mr()*6.28; spawn(m.x+p.x*m.ty.scale,m.y+p.y*m.ty.scale,m.z+p.z*m.ty.scale,Math.cos(a)*1.2,0.3+mr()*1.5,Math.sin(a)*1.2,0.8+mr()*0.8,p.g,0.18,m.ty.col[0]*1.6,m.ty.col[1]*1.6,m.ty.col[2]*1.6,0); }
    if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sTone(t,'triangle',300,90,0.4,sOut(m.x,m.z,0.3)),t,0.01,0.35); }
    msg(`<b style="color:${css(m.ty.col)}">${m.ty.ch}</b>${mname(m)}を倒した。${how==='fire'?'炎に巻かれて崩れ落ちた。':''}`);
  }
}
function playerAttack(){
  if(adv.dead||!ui.started||here.trans||(player.atkCd||0)>0||player.netT>0)return;
  player.atkCd=WEAPON.cd; player.swing=0.22; sWhoosh();
  let best=null, bd=1e9; const [vx,vy,vz]=viewDir(), [ox,oy,oz]=aimOrigin();
  for(const m of here.monsters){ if(m.dead||m.ty.peaceful||(m.ty.critter&&!m.hidden&&m.ty.critter!=='mimic'))continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; if(m.ty.habitat==='bog'&&(m.rise||0)<0.3)continue;
    const sc=m.ty.scale, cy=m.hidden?m.y+1.3:m.y+(m.ty.flier?0:0.6*sc), ax=m.x-ox, ay=cy-oy, az=m.z-oz, d=Math.hypot(ax,ay,az);
    if(Math.hypot(m.x-player.x,m.z-player.z)>WEAPON.reach+0.35*sc)continue;
    const cosA=(ax*vx+ay*vy+az*vz)/Math.max(d,1e-3), tol=0.42+Math.atan2(0.5*sc,Math.max(d,0.5));
    const ang=Math.acos(clamp(cosA,-1,1)); if(ang>tol)continue; if(ang<bd){bd=ang;best=m;} }
  if(!best)return;
  best.playerT=clock.time; damageMonster(best,roll(WEAPON.min,WEAPON.max),'blade');
}
function updateLife(dt){
  if(adv.dead)return;
  player.atkCd=Math.max(0,(player.atkCd||0)-dt); player.swing=Math.max(0,(player.swing||0)-dt);
  updateRally(dt);
  if(Math.round(player.hp)!==adv.hpShown){ adv.hpShown=Math.round(player.hp); renderStatus(); }
  vfx.hurtFlash=Math.max(0,vfx.hurtFlash-dt*1.6);
  // fire hurts whoever stands in it
  const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL);
  player.fireT=(player.fireT||0)+dt; if(player.fireT>0.5){ player.fireT=0; if(fire[pc]>0.1)hurtPlayer(2,'炎');
    for(const m of here.monsters){ if(m.dead||m.ty.critter||m.ty.habitat==='lava')continue; const ci=m.cz*MW+m.cx; if(fire[ci]>0.1&&!m.ty.flier)damageMonster(m,3,'fire'); } }
}
function monsterStrike(m,dt,dp){
  if(!hostile(m)||!m.noticed||m.sleep||adv.dead)return;
  if(m.ty.form==='eel'&&!(m.surf>0))return; if((m.ty.habitat==='deep'||m.ty.habitat==='bog')&&(m.rise||0)<0.5)return;
  const st=statOf(m), reach=(m.ty.habitat==='deep'?3.2:0.95+0.45*m.ty.scale);
  m.atkCd-=dt;
  if(m.wind>0){ m.wind-=dt; if(m.wind<=0){ m.atkCd=st[3]; if(dp<reach+0.35){ if(player.roll){ onDodged(m); if(clock.time-(monsterStrike.mt||-9)>2){ monsterStrike.mt=clock.time; msg(`<b style="color:#9fe0ff">~</b>転がって${mname(m)}の攻撃をかわした！`); } } else hurtPlayer(roll(st[1],st[2]),m.ty.name); } } }
  else if(dp<reach&&m.atkCd<=0&&st[2]>0){ m.wind=0.55; }
}
// the blade swing in front of the camera
