// ---------------------------------------------------------------- ambient sound (procedural, Web Audio)
// SND_LV・SND_NAME は src/lib/sound.ts（src/game/imports.mjs で読む）
const SND={lv:1,ctx:null,on:true,master:null,inp:null,wet:null,noise:null,L:{},envT:0,env:{water:0,lava:0,chasm:0,bog:0,xtal:0,burn:0,fire:0,fx:0,fz:0,cave:false}};
const sndReady=()=>SND.ctx&&SND.ctx.state==='running'&&SND.on;
function sndInit(){
  try{
    if(SND.ctx){ SND.ctx.resume(); return; }
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
    const ctx=new AC(); SND.ctx=ctx;
    const master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination); SND.master=master;
    master.gain.setTargetAtTime(SND_LV[SND.lv],ctx.currentTime,1.5);
    const comp=ctx.createDynamicsCompressor(); comp.connect(master);
    const dry=ctx.createGain(); dry.connect(comp);
    const ir=ctx.createBuffer(2,Math.floor(ctx.sampleRate*3.4),ctx.sampleRate);
    for(let c=0;c<2;c++){ const d=ir.getChannelData(c); for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.4); }
    const conv=ctx.createConvolver(); conv.buffer=ir; const wet=ctx.createGain(); wet.gain.value=0.35; conv.connect(wet); wet.connect(comp); SND.wet=wet;
    const inp=ctx.createGain(); inp.connect(dry); inp.connect(conv); SND.inp=inp;
    const nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate), nd=nb.getChannelData(0); for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1; SND.noise=nb;
    const loop=(type,freq,q)=>{ const s0=ctx.createBufferSource(); s0.buffer=nb; s0.loop=true; const f=ctx.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q; const g=ctx.createGain(); g.gain.value=0; s0.connect(f); f.connect(g); g.connect(inp); s0.start(); return {g,f}; };
    SND.L.rumble=loop('lowpass',90,0.7); SND.L.water=loop('bandpass',700,0.6); SND.L.fire=loop('bandpass',1100,0.5); SND.L.wind=loop('bandpass',320,0.4);
    const drone=ctx.createGain(); drone.gain.value=0; drone.connect(inp);
    const os=[[55,'sine',1],[82.6,'sine',0.7],[110.3,'triangle',0.2]].map(([f,ty,v])=>{ const o=ctx.createOscillator(); o.type=ty; o.frequency.value=f; const g=ctx.createGain(); g.gain.value=v; o.connect(g); g.connect(drone); o.start(); return o; });
    SND.L.drone={g:drone,o:os};
  }catch(e){ SND.ctx=null; }
}
function sndToggle(){ SND.lv=(SND.lv+1)%SND_LV.length; SND.on=SND_LV[SND.lv]>0; if(SND.master)SND.master.gain.setTargetAtTime(SND_LV[SND.lv],SND.ctx.currentTime,0.25); showHint('音量：'+SND_NAME[SND.lv]); setTimeout(()=>showHint(''),1200); }
const sDist=(x,z)=>x===undefined?1:Math.pow(clamp(1-Math.hypot(x-player.x,z-player.z)/24,0,1),1.4);
const sPan=(x,z)=>{ if(x===undefined)return (Math.random()-0.5)*1.2; const dx=x-player.x, dz=z-player.z, l=Math.hypot(dx,dz)||1; return clamp((dx*Math.cos(player.yaw)-dz*Math.sin(player.yaw))/l,-1,1)*0.85; };
function sOut(x,z,vol){ const ctx=SND.ctx, g=ctx.createGain(); g.gain.value=vol*sDist(x,z); if(ctx.createStereoPanner){ const p=ctx.createStereoPanner(); p.pan.value=sPan(x,z); g.connect(p); p.connect(SND.inp); } else g.connect(SND.inp); return g; }
// sEnv は src/lib/sound.ts（src/game/imports.mjs で読む）
function sNoise(t,dur,type,freq,q,out,f2){ const ctx=SND.ctx, s0=ctx.createBufferSource(); s0.buffer=SND.noise; const f=ctx.createBiquadFilter(); f.type=type; f.frequency.setValueAtTime(freq,t); if(f2)f.frequency.exponentialRampToValueAtTime(f2,t+dur); f.Q.value=q; const e=ctx.createGain(); s0.connect(f); f.connect(e); e.connect(out); s0.start(t,Math.random()*1.5); s0.stop(t+dur+0.05); return e; }
function sTone(t,type,f1,f2,dur,out){ const ctx=SND.ctx, o=ctx.createOscillator(); o.type=type; o.frequency.setValueAtTime(f1,t); if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur); const e=ctx.createGain(); o.connect(e); e.connect(out); o.start(t); o.stop(t+dur+0.05); return e; }
function sDrip(x,z,vol){ if(!sndReady())return; const t=SND.ctx.currentTime, f=900+Math.random()*1500; sEnv(sTone(t,'sine',f,f*0.55,0.12,sOut(x,z,vol)),t,0.004,0.2); }
function sCrackle(x,z,vol){ if(!sndReady())return; const t=SND.ctx.currentTime, d=0.004+Math.random()*0.014; sEnv(sNoise(t,d,'highpass',1800+Math.random()*2500,0.8,sOut(x,z,vol)),t,0.001,d); }
function sCrackleBurst(x,z){ for(let k=0;k<8;k++)setTimeout(()=>sCrackle(x,z,0.5),k*35); }
function sBubble(x,z,vol,low){ if(!sndReady())return; const t=SND.ctx.currentTime; sEnv(sTone(t,'sine',low?70:220,low?190:650,0.11,sOut(x,z,vol)),t,0.01,0.12); }
function sChime(x,z,vol){ if(!sndReady())return; const t=SND.ctx.currentTime, f=[1046.5,1174.7,1318.5,1568,1760,2093][Math.floor(Math.random()*6)], o=sOut(x,z,vol);
  sEnv(sTone(t,'sine',f,0,2.2,o),t,0.005,2.0,0.6); sEnv(sTone(t,'sine',f*2.76,0,1.2,o),t,0.003,1.0,0.15); }
function sBoom(vol){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(undefined,undefined,vol); sEnv(sNoise(t,1.3,'lowpass',900,0.7,o,70),t,0.01,1.2); sEnv(sTone(t,'sine',62,32,0.9,o),t,0.01,0.85,0.9); }
function sWhoosh(){ if(!sndReady())return; const t=SND.ctx.currentTime; sEnv(sNoise(t,0.35,'bandpass',400,1.2,sOut(undefined,undefined,0.3),2600),t,0.05,0.3); }
function sRumble(vol,dur){ if(!sndReady())return; const t=SND.ctx.currentTime; sEnv(sNoise(t,dur,'lowpass',140,0.8,sOut(undefined,undefined,vol)),t,0.3,dur); }
function sCreak(x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.18), f=SND.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=700; f.Q.value=5; f.connect(o); sEnv(sTone(t,'sawtooth',150,92,0.45,f),t,0.04,0.4); }
function sSplash(vol){ if(!sndReady())return; const t=SND.ctx.currentTime; sEnv(sNoise(t,0.22,'bandpass',1300,0.9,sOut(undefined,undefined,vol),600),t,0.005,0.2); }
function sHiss(x,z,dur){ if(!sndReady())return; const t=SND.ctx.currentTime; sEnv(sNoise(t,dur,'highpass',3200,0.5,sOut(x,z,0.22)),t,0.15,dur); }
function sAlert(x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.22); sEnv(sTone(t,'triangle',520,780,0.12,o),t,0.01,0.14); sEnv(sTone(t+0.13,'triangle',780,1040,0.12,o),t+0.13,0.01,0.18); }
function sRoar(){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(undefined,undefined,0.5), f=SND.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420; f.connect(o);
  sEnv(sTone(t,'sawtooth',70,42,2.2,f),t,0.15,2.0); sEnv(sTone(t,'sawtooth',104,61,2.0,f),t,0.2,1.8,0.6); sEnv(sNoise(t,2.2,'lowpass',260,0.7,o,90),t,0.2,2.0,0.5); }
function sSqueak(x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.07); sEnv(sTone(t,'sine',5200,3600,0.06,o),t,0.003,0.06); sEnv(sTone(t+0.09,'sine',5000,3500,0.05,o),t+0.09,0.003,0.05); }
function sndUpdate(dt){
  if(!SND.ctx||!SND.on)return;
  const E=SND.env;
  SND.envT-=dt;
  if(SND.envT<=0){
    SND.envT=0.25;
    const pcx=Math.floor(player.x/CELL), pcz=Math.floor(player.z/CELL); let water=0,lava=0,chasm=0,bog=0,xtal=0,burn=0,n=0;
    for(let dz=-6;dz<=6;dz++)for(let dx=-6;dx<=6;dx++){ const x=pcx+dx, z=pcz+dz; if(x<0||z<0||x>=MW||z>=MH)continue; const i=z*MW+x, w=Math.max(0,1-Math.hypot(dx,dz)/7); n+=w; const lq=D.liquid[i], tt=D.tile[i];
      if(lq===LQ_WATER||lq===LQ_DEEP)water+=w; else if(lq===LQ_LAVA)lava+=w; else if(lq===LQ_BOG)bog+=w; if(tt===TC)chasm+=w; if(tt===TX)xtal+=w; if(fire[i]>0)burn+=w*fire[i]; }
    let fb=0, fx=0, fz=0; for(const f of here.fixtures){ if(!FIRE_TYPES.has(f.type)||f.type==='lava'||f.type==='abyss')continue; const d=Math.hypot(f.x-player.x,f.z-player.z), v=Math.max(0,1-d/7); if(v>fb){fb=v;fx=f.x;fz=f.z;} }
    const ri=D.roomOf[pcz*MW+pcx];
    let fallN=0; for(const f of here.fixtures){ if(f.type==='fall')fallN=Math.max(fallN,1-Math.hypot(f.x-player.x,f.z-player.z)/16); }
    Object.assign(E,{fall:fallN,water:Math.min(1,water/12),lava:Math.min(1,lava/8),chasm:Math.min(1,chasm/10),bog:Math.min(1,bog/10),xtal:Math.min(1,xtal/8),burn:Math.min(1,burn/6),fire:fb,fx,fz,cave:ri>=0&&D.rooms[ri].cave});
    const now=SND.ctx.currentTime, set=(g,v)=>g.gain.setTargetAtTime(v,now,0.6);
    set(SND.L.rumble.g,0.05+E.chasm*0.45+E.lava*0.3+(E.cave?0.04:0));
    set(SND.L.water.g,E.water*0.05+E.fall*0.22);
    set(SND.L.fire.g,Math.min(0.3,E.burn*0.25+E.fire*0.03));
    set(SND.L.wind.g,E.cave?0.025:0.008);
    set(SND.L.drone.g,0.03);
    SND.L.drone.o[0].frequency.setTargetAtTime(55*Math.pow(0.97,here.depth-1),now,2); SND.L.drone.o[1].frequency.setTargetAtTime(82.6*Math.pow(0.97,here.depth-1),now,2);
    SND.wet.gain.setTargetAtTime(E.cave?0.6:0.32,now,1);
  }
  const roll=r=>Math.random()<r*dt;
  if(roll(0.25+E.water*2.4+(E.cave?0.4:0))){ const a=Math.random()*6.28, r=2+Math.random()*9; sDrip(player.x+Math.cos(a)*r,player.z+Math.sin(a)*r,0.2+Math.random()*0.15); }
  if(roll(E.fire*14+E.burn*30))sCrackle(E.burn>E.fire?undefined:E.fx,E.burn>E.fire?undefined:E.fz,0.25+Math.random()*0.25);
  if(roll(E.bog*2.5))sBubble(undefined,undefined,0.2,false);
  if(roll(E.lava*2))sBubble(undefined,undefined,0.3,true);
  if(roll(E.xtal*0.8))sChime(undefined,undefined,0.12);
  for(const m of here.monsters){ if(m.ty.flier&&Math.hypot(m.x-player.x,m.z-player.z)<10&&roll(0.35))sSqueak(m.x,m.z); }
}

// ---------------------------------------------------------------- swamp gas
let gasTmp=new Float32Array(NCELL), gasAny=false;
// ---------------------------------------------------------------- fire (after Brogue: spreads through flammable terrain, ignites gas)
let fire=new Float32Array(NCELL), fuel=new Float32Array(NCELL), burnt=new Uint8Array(NCELL), cellFlag=new Uint8Array(NCELL), fireLight=new Float32Array(NCELL);
let burning=[], fireSrc=[], lastBoom=-10, events=[], spark=null, sparkCD=0;
// FIRE_TYPES は src/lib/world.ts（src/game/imports.mjs で読む）
function initFire(){
  fire=new Float32Array(NCELL); fuel=new Float32Array(NCELL); burnt=new Uint8Array(NCELL); cellFlag=new Uint8Array(NCELL); fireLight=new Float32Array(NCELL); burning=[];
  for(let i=0;i<NCELL;i++){ const sf=D.surface[i]; fuel[i]=sf===SF_DEAD?1.0:sf===SF_GRASS?0.7:sf===SF_LUMEN?0.6:sf===SF_FOLIAGE?1.0:sf===SF_HAY?1.2:sf===SF_BRIM?0.8:0; }
  for(const d of D.doors)fuel[d.i]=Math.max(fuel[d.i],1.4);
  D.webAt=new Map(); for(const w of (D.webs||[])){ fuel[w.i]=Math.max(fuel[w.i],0.9); D.webAt.set(w.i,w); }
  for(const r of D.rooms){ if(r.theme&&r.theme.k==='ashfield')for(const i of r.cells)if(!D.liquid[i])burnt[i]=1; }
  for(const r of D.rooms){ const md=r.mdata; if(!md)continue; for(const i of (md.ash||[]))burnt[i]=1; for(const i of (md.char||[]))burnt[i]=1; }
  for(const [i,dc] of D.decoCell)if(dc.ch==='['||dc.ch==='='||dc.k==='carpet')fuel[i]=Math.max(fuel[i],1.5);
  fireSrc=D.fixtures.filter(f=>FIRE_TYPES.has(f.type)).map(f=>Math.floor(f.z/CELL)*MW+Math.floor(f.x/CELL));
  uploadCells();
}
function ignite(i,strength,gasBurn){
  if(i<0||i>=NCELL||D.tile[i]===TW)return;
  if(fire[i]<=0){ fire[i]=strength; burning.push(i); }
  else fire[i]=Math.max(fire[i],strength);
  if(gasBurn){ fuel[i]=Math.max(fuel[i],0.25); D.gas[i]=0; }
}
function boom(i){
  const x=(i%MW+0.5)*CELL, z=(((i/MW)|0)+0.5)*CELL, dd=Math.hypot(x-player.x,z-player.z);
  if(time-(boom.last||-9)>0.35){ boom.last=time; sBoom(clamp(1-dd/34,0.05,1)); makeNoise(x,z,20,1.3); }
  if(dd<30){ for(let q=0;q<10;q++){ const a=mr()*6.28, e2=mr(); spawn(x,0.6+mr(),z,Math.cos(a)*3*e2,0.5+mr()*2.5,Math.sin(a)*3*e2,0.6+mr()*0.6,G(mpick(['*','#','^','%'])),0.3+mr()*0.2,3.2,1.6,0.5,0); } }
  vfx.flash=Math.max(vfx.flash,clamp(1-dd/26,0,1)); vfx.shake=Math.max(vfx.shake,clamp(1-dd/22,0,1)*0.6);
  if(dd<3.6)hurtPlayer(Math.round(12*(1-dd/3.6))+2,'爆発');
  for(const m of here.monsters){ if(m.dead||m.ty.critter)continue; const dm=Math.hypot(m.x-x,m.z-z); if(dm<3.6)damageMonster(m,Math.round(16*(1-dm/3.6))+3,'fire'); }
  if(time-lastBoom>3&&dd<34){ lastBoom=time; msg('<b style="color:#ffb347">*</b>沼のガスに火が回り、轟音とともに爆ぜた！'); }
}
function stepFire(){
  const g=D.gas;
  // open flames (braziers, torches, lava) ignite gas that drifts into them
  for(const s0 of fireSrc){ for(const j of [s0,s0+1,s0-1,s0+MW,s0-MW]){ if(j>=0&&j<NCELL&&g[j]>0.15){ ignite(j,1,true); boom(j); } } }
  const next=[];
  for(const i of burning){
    if(fire[i]<=0)continue;
    if(fuel[i]>0){ fuel[i]-=0.05*fire[i]; fire[i]=Math.min(1,fire[i]+0.15); }
    else fire[i]*=0.6;
    const x=i%MW;
    for(const j of [i+1,i-1,i+MW,i-MW]){
      if(j<0||j>=NCELL||(j===i+1&&x===MW-1)||(j===i-1&&x===0))continue;
      if(g[j]>0.1){ ignite(j,1,true); boom(j); continue; }
      if(fire[j]<=0&&fuel[j]>0&&mr()<0.22*fire[i]*(D.surface[j]===SF_DEAD?1.4:1))ignite(j,0.25,false);
      const lq=D.liquid[j]; if((lq===LQ_WATER||lq===LQ_DEEP)&&fire[i]>0.5&&mr()<0.15){ const sx=(j%MW+0.5)*CELL, sz=(((j/MW)|0)+0.5)*CELL; for(let q=0;q<3;q++)spawn(sx+(mr()-0.5),0.2,sz+(mr()-0.5),(mr()-0.5)*0.3,0.6+mr()*0.6,(mr()-0.5)*0.3,2.5,G(mpick(['~','.','\''])),0.35,0.35,0.36,0.4,1); }
    }
    if(fire[i]<0.04){ fire[i]=0; burnt[i]=1; fuel[i]=0; if(D.surface[i]!==SF_OBSIDIAN)D.surface[i]=0; const di=D.doorAt[i]; if(di>=0)D.doors[di].gone=true; }
    else next.push(i);
  }
  for(const i of burning)if(fire[i]>0&&!next.includes(i))next.push(i);
  burning=next;
  // blurred firelight for the shader and for CPU-side lighting
  fireLight.fill(0);
  for(const i of burning){ const f=fire[i], x=i%MW;
    for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){ if(x+dx<0||x+dx>=MW)continue; const j=i+dx+dz*MW; if(j<0||j>=NCELL)continue; const w=f*Math.max(0,1-Math.hypot(dx,dz)/2.6); fireLight[j]+=w; } }
  uploadCells();
}
function uploadCells(){
  for(let i=0;i<NCELL;i++){ const o=i*4; cellData[o]=Math.min(255,fireLight[i]*150); cellData[o+1]=Math.min(255,fire[i]*255); cellData[o+2]=burnt[i]?255:0; cellData[o+3]=cellFlag[i]; }
  cellTex.needsUpdate=true;
}
function drawFire(t,dt){
  for(const i of burning){
    const f=fire[i]; if(f<=0)continue;
    const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL; if(Math.hypot(x0-player.x,z0-player.z)>34)continue;
    let h=Math.sin(i*12.9898)*43758.5453; h-=Math.floor(h);
    for(let k=0;k<5;k++){
      const q=(t*(1.8+h)+k/5+h)%1, ox=Math.sin(k*2.3+h*9)*0.6, oz=Math.cos(k*1.7+h*7)*0.6, b=2.8*(1-q)*f;
      dyn(x0+ox,0.12+q*1.3*f,z0+oz,G(k%3===0?'^':k%3===1?'*':'\''),0.5*(1-q*0.6)*(0.5+f*0.5),b*1.0,b*0.45*(1-q),b*0.12*(1-q)*(1-q));
    }
    if(mr()<dt*6*f)spawn(x0+(mr()-0.5)*1.4,0.3,z0+(mr()-0.5)*1.4,(mr()-0.5)*0.4,0.9+mr()*1.2,(mr()-0.5)*0.4,1.2+mr()*1.6,G(mpick(['.','\'','*'])),0.1,2.8,1.4,0.5,0);
  }
  if(spark)dyn(spark.x,spark.y,spark.z,G('*'),0.32,3.4,2.2,0.9);
}
let sparks=3, sparkRegen=0; const SPARK_MAX=3;
function updateSparkHud(){ renderStatus(); }
function throwSpark(){
  if(sparks<=0){ showHint('火花を使い切った。少し待てば、また溜まる'); sparkCD=0.6; return; }
  sparks--; sparkRegen=0; updateSparkHud(); sWhoosh();
  const cp=Math.cos(player.pitch), dx=-Math.sin(player.yaw)*cp, dy=Math.sin(player.pitch), dz=-Math.cos(player.yaw)*cp;
  spark={x:camera.position.x+dx*0.4,y:camera.position.y-0.15+dy*0.4,z:camera.position.z+dz*0.4,vx:dx*13,vy:dy*13+2.2,vz:dz*13,t:0};
  sparkCD=0.6;
}
function updateSpark(dt){
  if(!spark)return;
  const s2=spark; s2.t+=dt; s2.vy-=9.8*dt;
  const nx=s2.x+s2.vx*dt, ny=s2.y+s2.vy*dt, nz=s2.z+s2.vz*dt;
  const cx=Math.floor(nx/CELL), cz=Math.floor(nz/CELL), i=cz*MW+cx;
  if(mr()<0.8)spawn(s2.x,s2.y,s2.z,(mr()-0.5)*0.4,(mr()-0.5)*0.4,(mr()-0.5)*0.4,0.5+mr()*0.4,G(mpick(['.','\''])),0.08,2.6,1.5,0.5,0);
  let hit=-1;
  if(cx<0||cz<0||cx>=MW||cz>=MH||s2.t>4){ spark=null; return; }
  if(D.tile[i]===TW||D.tile[i]===TX)hit=Math.floor(s2.z/CELL)*MW+Math.floor(s2.x/CELL);
  else if(ny<0.03&&D.tile[i]!==TC)hit=i;
  else if(ny>D.ceil[i])hit=i;
  if(hit<0){ s2.x=nx; s2.y=ny; s2.z=nz; return; }
  for(let q=0;q<12;q++){ const a=mr()*6.28; spawn(s2.x,Math.max(0.05,s2.y),s2.z,Math.cos(a)*1.2,0.4+mr()*1.2,Math.sin(a)*1.2,0.5+mr()*0.5,G(mpick(['*','.','\''])),0.12,3,1.6,0.5,0); }
  let lit=false;
  for(const j of [hit,hit+1,hit-1,hit+MW,hit-MW]){ if(j<0||j>=NCELL)continue; if(D.gas[j]>0.1){ ignite(j,1,true); boom(j); lit=true; } else if(fuel[j]>0&&j===hit){ ignite(j,0.6,false); lit=true; } }
  makeNoise(s2.x,s2.z,6,0.45);
  if(lit)sCrackleBurst(s2.x,s2.z);
  if(lit&&burning.length<4)msg('<b style="color:#ffb347">^</b>火花が燃え移り、炎が広がり始めた。');
  spark=null;
}
function initEvents(){
  events=[];
  D.collapsed=false; D.pit=new Uint8Array(NCELL);
  D.rooms.forEach((r,ri)=>{
    if(r.vault&&r.vault.k==='oracle'&&r.valtar&&r.valtar.length)events.push({type:'oracle',cell:r.valtar[0],done:false});
    if(ri===0){ for(const tp of (D.teles||[]))events.push({type:'tele',a:tp.a,b:tp.b,lock:-1}); for(const e of (D.erupts||[]))events.push({type:'erupt',src:e.src,order:e.order,state:0,t:8+mr()*14,k:0}); }
    const md=r.mdata; if(!md)return;
    if(md.type==='statues')for(const c of (md.awaken||[]))events.push({type:'statue',cell:c,done:false,active:false,t:0});
    if(md.type==='collapse')events.push({type:'collapse',cells:md.pit,ri,state:0,t:0});
    if((md.type==='flood'||md.type==='lavaflow')&&md.order)events.push({type:md.type,ri,order:md.order.slice(),src:md.src,state:0,t:0,k:0,max:md.order.length*3});
    if(md.type==='crypt'&&md.tombs.length)events.push({type:'haunt',ri,tombs:md.tombs.map(tb=>tb.i),done:false,t:-1});
  });
}
// cpos は src/lib/world.ts（src/game/imports.mjs で読む）
function summon(key,cell){ const m=makeMonster({key,cx:cell%MW,cz:(cell/MW)|0,g:-1,lead:true}); m.alert=1; m.seen=true; here.monsters.push(m); return m; }
function updateEvents(dt,t){
  const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL);
  for(const ev of events){
    if(ev.type==='statue'){
      const [sx,sz]=cpos(ev.cell);
      if(!ev.done&&Math.hypot(sx-player.x,sz-player.z)<3.6){
        ev.done=true; ev.active=true; ev.t=0; sRumble(0.35,1.2); cellFlag[ev.cell]=100; D.solid.delete(ev.cell); D.decoCell.delete(ev.cell); uploadCells();
        for(let q=0;q<70;q++){ const a=mr()*6.28, h=mr()*2.4; spawn(sx+Math.cos(a)*0.3,0.4+h,sz+Math.sin(a)*0.3,Math.cos(a)*1.6,0.4+mr(),Math.sin(a)*1.6,1.1+mr()*0.4,G(mpick(['&','#','%','&'])),0.2,0.8,0.78,1.0,1); }
        vfx.shake=Math.max(vfx.shake,0.25);
      }
      if(ev.active){
        ev.t+=dt;
        if(mr()<dt*40){ const a=mr()*6.28, r=1.6*(1-ev.t/1.3); spawn(sx+Math.cos(a)*r,0.3+mr()*2,sz+Math.sin(a)*r,-Math.cos(a)*1.4,0,-Math.sin(a)*1.4,0.4,G(mpick(['&','#','%'])),0.18,1,0.95,1.2,1); }
        if(ev.t>1.3&&!ev.chimed){ ev.chimed=true; sChime(sx,sz,0.3); }
        if(ev.t>1.3){ ev.active=false; const key=here.depth>=5?'O':here.depth>=3?'g':'k'; const m=summon(key,ev.cell);
          msg(`<b style="color:${css(m.ty.col)}">&</b>彫像が崩れ、${mname(m)}の姿へと組み直された！`); }
      }
    } else if(ev.type==='collapse'){
      if(ev.state===0){
        if(D.roomOf[pc]===ev.ri&&ev.cells.some(c=>{ const [x,z]=cpos(c); return Math.hypot(x-player.x,z-player.z)<4.4; })){ ev.state=1; ev.t=0; sRumble(0.45,1.6); msg('<b style="color:#ffa060">:</b>足元で低い地鳴りが響く。床のひび割れが広がっていく……'); }
      } else if(ev.state===1){
        ev.t+=dt; vfx.shake=Math.max(vfx.shake,0.18+ev.t*0.15);
        if(mr()<dt*30){ const c=ev.cells[Math.floor(mr()*ev.cells.length)], [x,z]=cpos(c); spawn(x+(mr()-0.5)*1.8,D.ceil[c]-0.1,z+(mr()-0.5)*1.8,0,-1.5,0,1.5,G(mpick(['.',',','\''])),0.12,0.4,0.38,0.45,1); }
        if(ev.t>1.4){
          ev.state=2; D.collapsed=true; sBoom(0.7); makeNoise(player.x,player.z,22,1.2); U.uCollT.value=t;
          for(const c of ev.cells){ cellFlag[c]=200; D.tile[c]=TC; D.pit[c]=1; const [x,z]=cpos(c);
            for(let q=0;q<10;q++)spawn(x+(mr()-0.5)*1.8,0.1,z+(mr()-0.5)*1.8,(mr()-0.5)*0.6,-0.5-mr()*2,(mr()-0.5)*0.6,1.6,G(mpick(['.','#',':','%'])),0.2,0.6,0.55,0.6,1); }
          for(const m of here.monsters){ if(D.pit[m.cz*MW+m.cx]&&!m.ty.flier){ m.dead=true; } }
          uploadCells(); vfx.shake=0.8;
          msg('<b style="color:#ffa060">:</b>轟音とともに床が崩れ落ちた！ 穴の底に、下の階層の光が見える。');
        }
      }
    } else if(ev.type==='oracle'){
      if(ev.done)continue; const [ox2,oz2]=cpos(ev.cell);
      if(Math.hypot(ox2-player.x,oz2-player.z)<3.4){ ev.done=true; const ru=HIST.rulers[Math.floor(mr()*HIST.rulers.length)];
        const hp=[`${ru.title}${ru.name}の名を口にする者は、もういない。`,`${HIST.civ.name}の民が最後に見たものを、お前もやがて見るだろう。`,`${HIST.beast}は、まだどこかで眠っている。`];
        const a=[hp[Math.floor(mr()*hp.length)],PROPHECIES[Math.floor(mr()*PROPHECIES.length)]];
        sChime(ox2,oz2,0.4); setTimeout(()=>sChime(ox2,oz2,0.3),500);
        msg('<b style="color:#bfe4ff">?</b>巻物の文字がひとりでに光り、声なき声が告げる──'); msg(`<b style="color:#bfe4ff">「</b>${a[0]}」`); msg(`<b style="color:#bfe4ff">「</b>${a[1]}」`); oracleLegendHints();
        for(let q=0;q<50;q++){ const an=mr()*6.28; spawn(ox2+Math.cos(an)*0.3,1.2+mr(),oz2+Math.sin(an)*0.3,Math.cos(an)*0.7,0.4+mr()*0.8,Math.sin(an)*0.7,2.5+mr()*2,G(mpick(['?','*','.','+'])),0.14,1.0,1.6,2.2,2); } }
    } else if(ev.type==='flood'||ev.type==='lavaflow'){
      const lava=ev.type==='lavaflow';
      if(ev.state===0){
        if(D.roomOf[pc]===ev.ri){ ev.state=1; ev.t=0;
          const f=here.fixtures.find(f=>f.type===(lava?'crater':'spring')&&Math.floor(f.z/CELL)*MW+Math.floor(f.x/CELL)===ev.src); if(f){ f.active=true; const L=D.lights[f.li]; if(L)L.active=true; }
          if(lava){ sRumble(0.5,2); vfx.shake=Math.max(vfx.shake,0.3); msg('<b style="color:#ff7a3a">^</b>床の裂け目が割れ、溶岩がゆっくりとあふれ出した！'); }
          else { sSplash(0.4); msg('<b style="color:#6ab4ff">~</b>壁の亀裂が崩れ、水が勢いよく噴き出した！'); } }
      } else if(ev.state===1){
        ev.t+=dt; const step=lava?0.38:0.11; let changed=false;
        while(ev.t>=step&&ev.k<ev.order.length&&ev.k<ev.max){ ev.t-=step; const i=ev.order[ev.k++]; const [x,z]=cpos(i);
          if(lava&&(Math.hypot(x-player.x,z-player.z)<1.6||here.monsters.some(m=>!m.ty.flier&&m.cz*MW+m.cx===i))){ ev.order.push(i); continue; }
          changed=true;
          if(lava){ D.liquid[i]=LQ_LAVA; cellFlag[i]=70; for(const j of [i+1,i-1,i+MW,i-MW])if(j>=0&&j<NCELL&&fuel[j]>0)ignite(j,0.6,false); if(D.gas[i]>0.1)boom(i); if(mr()<0.3)sBubble(x,z,0.25,true); }
          else { D.liquid[i]=LQ_WATER; cellFlag[i]=50; fire[i]=0; fuel[i]=0; if(mr()<0.2)sSplash(0.12); } }
        if(changed)uploadCells();
        if(ev.k>=ev.order.length||ev.k>=ev.max)ev.state=2;
      }
    } else if(ev.type==='tele'){
      const [ax,az]=cpos(ev.a), [bx,bz]=cpos(ev.b), da=Math.hypot(player.x-ax,player.z-az), db=Math.hypot(player.x-bx,player.z-bz);
      if(ev.lock>=0){ const [lx,lz]=cpos(ev.lock); if(Math.hypot(player.x-lx,player.z-lz)>1.3)ev.lock=-1; }
      const from=da<0.7&&ev.lock!==ev.a?ev.a:db<0.7&&ev.lock!==ev.b?ev.b:-1;
      if(from>=0&&!here.trans){ const to=from===ev.a?ev.b:ev.a, [tx2,tz2]=cpos(to), [fx2,fz2]=cpos(from);
        for(const [px3,pz3] of [[fx2,fz2],[tx2,tz2]])for(let q=0;q<40;q++){ const an=mr()*6.28; spawn(px3+Math.cos(an)*0.5,0.2+mr()*2,pz3+Math.sin(an)*0.5,Math.cos(an)*0.8,mr()*1.2,Math.sin(an)*0.8,1.2+mr(),G(mpick(['*','+','.','o'])),0.16,1.0,0.6,1.6,2); }
        player.x=tx2; player.z=tz2; player.vx=player.vz=0; ev.lock=to; sChime(tx2,tz2,0.5);
        if(!D.teleMsg){ D.teleMsg=true; msg('<b style="color:#ff7ae0">*</b>魔法陣が閃き、体が別の場所へと運ばれた。対になった陣が、どこかにもうひとつある。'); } }
    } else if(ev.type==='erupt'){
      ev.t-=dt; const f=here.fixtures.find(f=>f.type==='crater'&&Math.floor(f.z/CELL)*MW+Math.floor(f.x/CELL)===ev.src);
      if(ev.state===0&&ev.t<=0){ ev.state=1; ev.k=0; ev.t=0; if(f){ f.active=true; const L=D.lights[f.li]; if(L)L.active=true; }
        const [sx,sz]=cpos(ev.src), dd=Math.hypot(sx-player.x,sz-player.z); if(dd<30){ sRumble(0.6*(1-dd/30)+0.15,2.2); vfx.shake=Math.max(vfx.shake,0.5*(1-dd/30)); }
        if(dd<24&&fovVis[ev.src]===fovStamp)msg('<b style="color:#ff7a3a">^</b>火口が轟音とともに噴き上がり、溶岩があふれ出した！');
        for(let q=0;q<70;q++){ const an=mr()*6.28, sp2=1+mr()*2.4; spawn(sx,0.4,sz,Math.cos(an)*sp2*0.5,3+mr()*4,Math.sin(an)*sp2*0.5,1.4+mr(),G(mpick(['*','o','\'','.'])),0.18,2.4,1.1,0.3,0); } }
      else if(ev.state===1){ ev.t+=dt; let ch=false;
        while(ev.t>=0.3&&ev.k<ev.order.length){ ev.t-=0.3; const i=ev.order[ev.k++], [x,z]=cpos(i);
          if(Math.hypot(x-player.x,z-player.z)<1.6||here.monsters.some(m=>!m.ty.flier&&m.cz*MW+m.cx===i))continue;
          D.liquid[i]=LQ_LAVA; cellFlag[i]=70; ch=true; for(const j of [i+1,i-1,i+MW,i-MW])if(j>=0&&j<NCELL&&fuel[j]>0)ignite(j,0.6,false); }
        if(ch)uploadCells(); if(ev.k>=ev.order.length){ ev.state=2; ev.t=12; } }
      else if(ev.state===2&&ev.t<=0){ ev.state=3; ev.k=ev.order.length-1; ev.t=0; if(f){ f.active=false; const L=D.lights[f.li]; if(L)L.active=false; } }
      else if(ev.state===3){ ev.t+=dt; let ch=false;
        while(ev.t>=0.15&&ev.k>=0){ ev.t-=0.15; const i=ev.order[ev.k--]; if(cellFlag[i]===70){ D.liquid[i]=0; cellFlag[i]=0; ch=true; const [x,z]=cpos(i); if(mr()<0.4)spawn(x,0.2,z,0,0.5,0,2,G('.'),0.4,0.15,0.13,0.13,1); } }
        if(ch)uploadCells(); if(ev.k<0){ ev.state=0; ev.t=20+mr()*20; } }
    } else if(ev.type==='haunt'){
      if(ev.done)continue;
      if(ev.t<0&&D.roomOf[pc]===ev.ri)ev.t=0;
      if(ev.t>=0){
        ev.t+=dt;
        for(const c of ev.tombs.slice(0,2)){ const [x,z]=cpos(c); if(mr()<dt*25){ const a=mr()*6.28, r=1.4*(1-Math.min(1,ev.t/2)); spawn(x+Math.cos(a)*r,0.2+mr()*1.8,z+Math.sin(a)*r,-Math.cos(a)*0.6,0.1,-Math.sin(a)*0.6,0.6,G(mpick(['~','W','\''])),0.2,0.5,0.4,0.9,1); } }
        if(ev.t>2&&!ev.chimed){ ev.chimed=true; sChime(...cpos(ev.tombs[0]),0.3); }
        if(ev.t>2){ ev.done=true; const ms=ev.tombs.slice(0,2).map(c=>{ const nb=[c+1,c-1,c+MW,c-MW].find(j=>canStep({ty:{form:''}},j)); return summon('W',nb!==undefined?nb:c); });
          msg(`<b style="color:${css(ms[0].ty.col)}">W</b>墓石の間から、${mname(ms[0])}がゆらりと立ち上がった……`); }
      }
    }
  }
}

function stepGas(){
  const g=D.gas, nb=gasTmp, tile=D.tile; let any=false;
  for(let i=0;i<NCELL;i++){
    if(tile[i]===TW){ nb[i]=0; continue; }
    const v=g[i], x=i%MW; let s=0,c=0;
    if(x>0&&tile[i-1]!==TW){s+=g[i-1];c++;} if(x<MW-1&&tile[i+1]!==TW){s+=g[i+1];c++;}
    if(i>=MW&&tile[i-MW]!==TW){s+=g[i-MW];c++;} if(i<NCELL-MW&&tile[i+MW]!==TW){s+=g[i+MW];c++;}
    let nv=(c?v*0.6+(s/c)*0.4:v)*0.993; if(nv<0.005)nv=0; nb[i]=nv; if(nv>0)any=true;
  }
  g.set(nb);
  for(const i of D.bogList){
    if(mr()>0.012)continue;
    g[i]=Math.min(1,g[i]+0.8); any=true;
    const x=(i%MW+0.3+mr()*0.4)*CELL, z=(((i/MW)|0)+0.3+mr()*0.4)*CELL;
    if(Math.hypot(x-player.x,z-player.z)<26){
      for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; spawn(x+Math.cos(a)*0.08,0.08,z+Math.sin(a)*0.08,Math.cos(a)*0.4,0.02,Math.sin(a)*0.4,0.9,G('o'),0.13,0.4,0.48,0.16,1); }
      spawn(x,0.15,z,0,0.35,0,2.2,G('~'),0.3,0.35,0.6,0.12,1);
      sBubble(x,z,0.3,false);
    }
  }
  gasAny=any;
}
function updateGasPoints(t){
  let gi=0;
  if(gasAny){
    const pcx=Math.floor(player.x/CELL), pcz=Math.floor(player.z/CELL), RR=12, g=D.gas;
    for(let cz=Math.max(0,pcz-RR);cz<=Math.min(MH-1,pcz+RR)&&gi<GAS_N;cz++)for(let cx=Math.max(0,pcx-RR);cx<=Math.min(MW-1,pcx+RR)&&gi<GAS_N;cx++){
      const i=cz*MW+cx, v=g[i]; if(v<0.04)continue;
      const l=cellLight((cx+0.5)*CELL,(cz+0.5)*CELL), n=v>0.35?3:v>0.15?2:1;
      for(let s=0;s<n&&gi<GAS_N;s++){
        let h1=Math.sin(i*12.9898+s*78.233)*43758.5453; h1-=Math.floor(h1); let h2=Math.sin(i*39.3468+s*11.135)*24634.6345; h2-=Math.floor(h2);
        const k=Math.min(1,v)*(0.6+0.4*Math.sin(t*1.3+h1*20)), j=DUST_N+gi, j3=j*3;
        ptPos[j3]=(cx+((h1+t*0.02*(1+s))%1))*CELL; ptPos[j3+1]=0.25+((h1*3.7+t*0.05)%1)*1.6; ptPos[j3+2]=(cz+((h2+t*0.017*(1+s))%1))*CELL;
        ptCol[j3]=(0.05+l[0]*0.15)*k; ptCol[j3+1]=(0.09+l[1]*0.15)*k; ptCol[j3+2]=(0.02+l[2]*0.1)*k;
        ptSize[j]=0.45+h2*0.35; ptGly[j]=G(h1<0.5?'~':(h1<0.8?'.':':'));
        gi++;
      }
    }
  }
  for(let k=gi;k<GAS_N;k++)ptSize[DUST_N+k]=0;
}

// ---------------------------------------------------------------- particle update
function respawnDust(i,near){
  for(let tries=0;tries<8;tries++){
    const a=mr()*Math.PI*2, r=near?Math.sqrt(mr())*15:10+mr()*5;
    const x=player.x+Math.cos(a)*r, z=player.z+Math.sin(a)*r, cx=Math.floor(x/CELL), cz=Math.floor(z/CELL);
    if(cx<0||cz<0||cx>=MW||cz>=MH)continue;
    const ci=cz*MW+cx, tt=D.tile[ci]; if(tt!==TF&&tt!==TC)continue;
    const lo=tt===TC?-CH_D+1:0.15, hi=Math.min(D.ceil[ci]-0.2,8);
    dust.x[i]=x; dust.z[i]=z; dust.y[i]=lo+mr()*(hi-lo); return;
  }
  dust.x[i]=player.x; dust.z[i]=player.z; dust.y[i]=-50;
}
function initDust(){ const fl=D.stratum.fall; for(let i=0;i<DUST_N;i++){ dust.ph[i]=mr()*100; dust.g[i]=G(mpick(fl==='snow'?['*','.','+','*']:fl==='ash'?[',','.','`','\'']:['.','.','.','+','*','\'',':','`'])); dust.s[i]=0.1+mr()*0.11; respawnDust(i,true); } }
let riverCells=[];
function riverFX(dt){
  if(!riverCells.length)return;
  for(let k=0;k<6&&mr()<dt*14;k++){
    const i=riverCells[Math.floor(mr()*riverCells.length)], x=(i%MW+0.2+mr()*0.6)*CELL, z=(((i/MW)|0)+0.2+mr()*0.6)*CELL;
    if(Math.hypot(x-player.x,z-player.z)>18)continue;
    const a=D.flow[i]-10; spawn(x,0.12,z,Math.cos(a)*1.3,0.01,Math.sin(a)*1.3,2.2+mr(),G(mpick(['~','.','-'])),0.13,0.25,0.55,0.75,1);
  }
}
function updateParticles(dt,t){
  riverFX(dt);
  const px=player.x, pz=player.z;
  for(let i=0;i<DUST_N;i++){
    const ph=dust.ph[i];
    dust.x[i]+=Math.sin(t*0.31+ph)*0.13*dt; dust.z[i]+=Math.cos(t*0.27+ph*1.3)*0.13*dt; dust.y[i]+=(Math.sin(t*0.21+ph*2)*0.06+0.015)*dt;
    const dx=dust.x[i]-px, dz=dust.z[i]-pz;
    if(D.stratum.fall){ dust.y[i]-=(D.stratum.fall==='snow'?0.45:0.3)*dt; dust.x[i]+=Math.sin(t*0.7+ph)*0.2*dt; }
    if(dx*dx+dz*dz>16*16||dust.y[i]>ceilAt(dust.x[i],dust.z[i])-0.05||(D.stratum.fall&&dust.y[i]<0.05))respawnDust(i,false);
    const l=cellLight(dust.x[i],dust.z[i]);
    const dd=Math.hypot(dust.x[i]-px,dust.y[i]-EYE,dust.z[i]-pz), lan=Math.max(0,1-dd/7);
    const tw=0.5+0.5*Math.sin(t*(0.7+(ph%1)*1.3)+ph*9), k=(0.2+0.8*tw);
    const i3=i*3;
    ptPos[i3]=dust.x[i]; ptPos[i3+1]=dust.y[i]; ptPos[i3+2]=dust.z[i];
    ptCol[i3]=(0.012+l[0]*0.2+lan*lan*0.09)*k; ptCol[i3+1]=(0.01+l[1]*0.2+lan*lan*0.085)*k; ptCol[i3+2]=(0.026+l[2]*0.2+lan*lan*0.13)*k;
    ptSize[i]=dust.s[i]; ptGly[i]=dust.g[i];
  }
  for(let i=0;i<pN;){
    P.age[i]+=dt; if(P.age[i]>=P.life[i]){ killP(i); continue; }
    const ph=P.ph[i], ty=P.ty[i];
    P.vx[i]+=Math.sin(t*1.7+ph)*0.35*dt; P.vz[i]+=Math.cos(t*1.3+ph*1.3)*0.35*dt;
    if(ty===0)P.vy[i]+=0.2*dt;
    const drag=1-0.5*dt; P.vx[i]*=drag; P.vz[i]*=drag; P.vy[i]*=1-0.15*dt;
    P.x[i]+=P.vx[i]*dt; P.y[i]+=P.vy[i]*dt; P.z[i]+=P.vz[i]*dt;
    const a=P.age[i]/P.life[i]; let k=Math.min(1,P.age[i]*5)*(1-a);
    if(ty===1)k*=0.6+0.4*Math.sin(t*4+ph);
    const j=P0+i, j3=j*3;
    ptPos[j3]=P.x[i]; ptPos[j3+1]=P.y[i]; ptPos[j3+2]=P.z[i];
    if(ty===0){ ptCol[j3]=P.r[i]*k; ptCol[j3+1]=P.g[i]*Math.pow(k,1.7); ptCol[j3+2]=P.b[i]*Math.pow(k,2.4); }
    else { ptCol[j3]=P.r[i]*k; ptCol[j3+1]=P.g[i]*k; ptCol[j3+2]=P.b[i]*k; }
    ptSize[j]=P.sz[i]; ptGly[j]=P.gl[i];
    i++;
  }
  updateGasPoints(t);
  const total=P0+pN;
  ptGeo.setDrawRange(0,total);
  for(const [a,s] of [[bpPos,3],[bpCol,3],[bpSize,1],[bpGly,1]]){ a.updateRange.offset=0; a.updateRange.count=total*s; a.needsUpdate=true; }
}

