// ---------------------------------------------------------------- small creatures (the living layer of the world; they never hunt you)
// critterForm・spiderForm・robotForm など 5 個は src/lib/bodies/small.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）
function critterStep(m,away){
  const opts=[]; for(const d of D4){ const i=(m.cz+d[1])*MW+m.cx+d[0]; if(canStep(m,i))opts.push(d); }
  if(!opts.length)return;
  let ch;
  if(away){ let bd=-1; for(const d of opts){ const dd=Math.hypot((m.cx+d[0]+0.5)*CELL-player.x,(m.cz+d[1]+0.5)*CELL-player.z)+mr()*0.4; if(dd>bd){bd=dd;ch=d;} } }
  else if((m.ty.critter==='cleaner'||m.ty.critter==='engineer')&&m.job>=0){ const [gx,gz]=m.ty.critter==='engineer'?[here.D.doors[m.job].bx,here.D.doors[m.job].bz]:cpos(m.job); let bd=1e9; for(const d of opts){ const dd=Math.hypot((m.cx+d[0]+0.5)*CELL-gx,(m.cz+d[1]+0.5)*CELL-gz)+mr()*0.5; if(dd<bd){bd=dd;ch=d;} } }
  else if(m.ty.critter==='grazer'){ const moss=opts.filter(d=>here.D.surface[(m.cz+d[1])*MW+m.cx+d[0]]===SF_LUMEN); ch=moss.length&&mr()<0.8?moss[Math.floor(mr()*moss.length)]:opts[Math.floor(mr()*opts.length)]; }
  else { const fwd=opts.find(o=>o[0]===m.dir[0]&&o[1]===m.dir[1]); const nrev=opts.filter(o=>!(o[0]===-m.dir[0]&&o[1]===-m.dir[1])); ch=(fwd&&mr()<0.6)?fwd:(nrev.length?nrev[Math.floor(mr()*nrev.length)]:opts[0]); }
  m.dir=ch; m.tx=m.cx+ch[0]; m.tz=m.cz+ch[1];
}
let shriekMsgT=-99, grazeMsg=false;
function updateCritter(m,dt,t,dp){
  const ty=m.ty; m.aware=0; m.noticed=false; m.sleep=false; m.alert=0;
  const lit=!stealth.sneak;
  if(ty.critter==='shrieker'){
    m.glow=1.2+0.7*Math.pow(0.5+0.5*Math.sin(t*1.1+m.ph),2);
    if(dp<3.2&&lit&&m.visible&&clock.time-(m.shriekT||-99)>12){
      m.shriekT=clock.time; m.glow=3; sShriek(m.x,m.z); vfx.shake=Math.max(vfx.shake,0.12);
      for(let q=0;q<36;q++){ const a=q/36*Math.PI*2; spawn(m.x,0.7,m.z,Math.cos(a)*2.2,0.2,Math.sin(a)*2.2,0.9,G(q%2?'!':'.'),0.18,ty.col[0]*2.4,ty.col[1]*2.4,ty.col[2]*2.4,1); }
      let woke=0; for(const o of here.monsters){ if(o===m||o.ty.critter||o.dead)continue; if(Math.hypot(o.x-m.x,o.z-m.z)<15){ if(o.sleep||!o.noticed)woke++; o.sleep=false; o.aware=Math.max(o.aware,1.05); } }
      if(clock.time-shriekMsgT>8){ shriekMsgT=clock.time; msg(`<b style="color:${css(ty.col)}">p</b>${mname(m)}が甲高い叫び声を上げた！${woke?' 周りの獣たちが目を覚ます。':''}`); }
    }
    return;
  }
  if(ty.critter==='cleaner'||ty.critter==='engineer'){ if(machineWork(m,dt)){ m.yaw=lerpAngle(m.yaw,m.dirYaw,1-Math.exp(-dt*4)); return; } }
  if(ty.critter==='mimic'&&m.hidden){
    if(dp<2.3||m.revealNow){ m.hidden=false; m.flee=8; sSqueak(m.x,m.z); sChime(m.x,m.z,0.25); vfx.shake=Math.max(vfx.shake,0.1);
      msg(`<b style="color:${css(ty.col)}">q</b>浮かんでいた巻物が脚を生やし、すばやく走り去った！ ${mname(m)}だ。`);
      for(let q=0;q<24;q++){ const a=mr()*6.28; spawn(m.x,1.2,m.z,Math.cos(a)*1.2,mr(),Math.sin(a)*1.2,1,G(mpick(['?','.','*'])),0.14,1.6,1.3,0.6,1); } }
    return;
  }
  // startle: a lit lantern close by sends fish and grazers fleeing
  if((ty.critter==='fish'&&dp<4.5&&lit)||(ty.critter==='grazer'&&dp<3.5&&lit)){
    if(!(m.flee>0)){ if(ty.critter==='fish'){ sSplash(0.15); splash(m.x,m.z,ty.col); } else if(!grazeMsg&&m.visible){ grazeMsg=true; msg(`<b style="color:${css(ty.col)}">h</b>${mname(m)}が灯りに驚いて、ぱたぱたと逃げ出した。灯りを絞れば、近くで眺められる。`); } }
    m.flee=ty.critter==='fish'?1.6:3;
  }
  if(m.flee>0)m.flee-=dt;
  if(m.wait>0){ m.wait-=dt; if(m.flee>0)m.wait=0;
    // grazing: a moss cell loses its glow
    if(ty.critter==='grazer'&&m.wait<=0){ const i=m.cz*MW+m.cx; if(here.D.surface[i]===SF_LUMEN&&blaze.cellFlag[i]!==30){ blaze.cellFlag[i]=30; here.D.surface[i]=SF_GRASS; uploadCells(); } }
    m.moving+=(0-m.moving)*Math.min(1,dt*5);
  } else {
    const tx=(m.tx+0.5)*CELL, tz=(m.tz+0.5)*CELL, ddx=tx-m.x, ddz=tz-m.z, d=Math.hypot(ddx,ddz);
    if(d<0.05){ m.x=tx; m.z=tz; m.cx=m.tx; m.cz=m.tz; critterStep(m,m.flee>0);
      if(ty.critter==='grazer'&&!(m.flee>0)&&here.D.surface[m.cz*MW+m.cx]===SF_LUMEN&&mr()<0.35)m.wait=2+mr()*3; }
    else { const sp=ty.speed*(m.flee>0?(ty.critter==='fish'?2.6:3):1)*dt, st=Math.min(sp,d); m.x+=ddx/d*st; m.z+=ddz/d*st; m.dirYaw=Math.atan2(ddx,ddz); m.cx=Math.floor(m.x/CELL); m.cz=Math.floor(m.z/CELL); }
    m.moving+=(1-m.moving)*Math.min(1,dt*5);
  }
  m.yaw=lerpAngle(m.yaw,m.dirYaw,1-Math.exp(-dt*6));
  m.walk+=dt*m.moving*ty.speed*5.5;
  // fish now and then leap out of the water in a glowing arc
  if(ty.critter==='fish'){ m.jumpT=(m.jumpT===undefined?3+mr()*10:m.jumpT)-dt;
    if(m.jumpT<=0&&!m.jump&&dp<26){ m.jump=0.001; splash(m.x,m.z,ty.col); }
    if(m.jump){ m.jump+=dt/0.9; if(m.jump>=1){ m.jump=0; m.jumpT=5+mr()*10; splash(m.x,m.z,ty.col); sSplash(0.08); } else if(mr()<0.6)spawn(m.x,m.y+0.1,m.z,0,-0.3,0,0.6,G(mpick(['.','*'])),0.1,ty.col[0]*2.4,ty.col[1]*2.4,ty.col[2]*2.4,1); } }
  m.y=ty.critter==='fish'?-0.16+Math.sin(t*2+m.ph)*0.03+(m.jump?Math.sin(Math.PI*m.jump)*1.0:0):0;
  m.glow=ty.critter==='fish'?1.4+0.4*Math.sin(t*3+m.ph):ty.critter==='grazer'?1.5+0.3*Math.sin(t*1.2+m.ph):1.2;
}
function sShriek(x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.5);
  for(let k=0;k<2;k++){ const os=SND.ctx.createOscillator(), g=SND.ctx.createGain(); os.type='square';
    os.frequency.setValueAtTime(1300+k*230,t); os.frequency.linearRampToValueAtTime(2100+k*300,t+0.25); os.frequency.linearRampToValueAtTime(1000,t+0.9);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.1,t+0.03); g.gain.exponentialRampToValueAtTime(0.001,t+1.0); os.connect(g); g.connect(o); os.start(t); os.stop(t+1.05); } }

// ---------------------------------------------------------------- packs and hunters: spiders and their webs, hounds on your scent, snapjaw camps, ancient machines
let webMsg=false, webBurnMsg=false, repairMsg=false;
function drawWebs(t){
  if(!here.D.webs)return;
  for(const w of here.D.webs){
    if(w.gone)continue;
    const [x,z]=cpos(w.i), dd=Math.hypot(x-player.x,z-player.z); if(dd>30)continue;
    if(blaze.fire[w.i]>0.1){ w.gone=true; for(let q=0;q<30;q++){ const a=mr()*6.28; spawn(x,0.6+mr()*1.6,z,Math.cos(a)*0.6,0.4+mr(),Math.sin(a)*0.6,1+mr(),G(mpick(['*','.','\''])),0.14,2.4,1.2,0.4,0); }
      if(!webBurnMsg&&dd<20){ webBurnMsg=true; msg('<b style="color:#ff9a4a">%</b>クモの巣が、ぱちぱちと音を立てて燃え落ちた。'); } continue; }
    const yaw=w.ax===0?Math.PI/2:0, tX=Math.cos(yaw), tZ=-Math.sin(yaw), sh=0.85+0.15*Math.sin(t*1.3+w.i), k=(w.shake>0?1.8:1)*sh;
    if(w.shake>0)w.shake-=1/60;
    const jit=w.shake>0?Math.sin(t*40)*0.04:0;
    for(let s2=0;s2<8;s2++){ const a=s2/8*Math.PI*2, ch=Math.abs(Math.cos(a))>0.92?'-':Math.abs(Math.sin(a))>0.92?'|':(Math.cos(a)*Math.sin(a)>0?'/':'\\');
      for(let r=1;r<=4;r++){ const u=Math.cos(a)*r*0.24+jit, v=Math.sin(a)*r*0.24; dyn(x+tX*u,1.3+v,z+tZ*u,G(ch),0.2,0.8*k,0.75*k,1.0*k,2,yaw); } }
    for(const rr of [0.42,0.84])for(let s2=0;s2<12;s2++){ const a=s2/12*Math.PI*2+0.26; dyn(x+tX*(Math.cos(a)*rr+jit),1.3+Math.sin(a)*rr,z+tZ*(Math.cos(a)*rr+jit),G(s2%3?'.':'*'),0.14,1.1*k,1.0*k,1.4*k,2,yaw); }
  }
}
function webTouch(i){
  const w=here.D.webAt&&here.D.webAt.get(i); if(!w||w.gone)return false;
  if(clock.time-(w.touchT||-99)>3){ w.touchT=clock.time; w.shake=1.2; sSqueak(player.x,player.z);
    for(const m of here.monsters){ if(!m.ty.spider||Math.hypot(m.x-player.x,m.z-player.z)>24)continue; m.sleep=false; m.aware=Math.max(m.aware,1.05); m.goal=[(i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL]; m.goalT=clock.time+12; }
    if(!webMsg){ webMsg=true; msg('<b style="color:#d8c8ff">%</b>光る糸に絡まった！ 巣全体が震えている……。炎なら、糸を焼き払える。'); } }
  return true;
}
// hounds follow the freshest scent; water washes it away
function houndScent(m){
  let best=null, bs=clock.time-40;
  for(const d of D4){ const i=(m.cz+d[1])*MW+m.cx+d[0]; if(!canStep(m,i))continue; if(blaze.scent[i]>0&&blaze.scent[i]>bs){bs=blaze.scent[i];best=d;} } // 0 is a cell with no scent (in the first 40 s, bs is below 0)
  return best;
}
function machineWork(m,dt){
  // cleaners clear ash and put out fires; engineers rebuild burnt doors
  const ty=m.ty;
  if(m.job!==undefined&&m.job>=0){
    const [jx,jz]=ty.critter==='engineer'?[here.D.doors[m.job].bx,here.D.doors[m.job].bz]:cpos(m.job);
    if(Math.hypot(jx-m.x,jz-m.z)<(ty.critter==='engineer'?1.6:0.4)){
      m.work=(m.work||0)+dt; m.moving=0;
      if(mr()<dt*10)spawn(jx+(mr()-0.5)*0.4,0.3+mr()*0.6,jz+(mr()-0.5)*0.4,(mr()-0.5)*0.8,0.6+mr(),(mr()-0.5)*0.8,0.5,G(mpick(['*','.','+'])),0.1,ty.col[0]*2,ty.col[1]*2,ty.col[2]*2,0);
      if(m.work>(ty.critter==='engineer'?3:1.8)){
        if(ty.critter==='engineer'){ const d=here.D.doors[m.job]; if(!d.gone){ m.job=-1; m.work=0; return true; } d.gone=false; d.o=0; blaze.fuel[d.i]=1.4; blaze.burnt[d.i]=0; uploadCells(); if(!repairMsg&&m.visible){ repairMsg=true; msg(`<b style="color:${css(ty.col)}">R</b>${mname(m)}が、焼け落ちた扉を黙々と作り直した。`); } }
        else { blaze.burnt[m.job]=0; blaze.fire[m.job]=0; uploadCells(); }
        m.job=-1; m.work=0;
      }
      return true;
    }
    return false;
  }
  if(clock.time-(m.scanT||-9)<1.5)return false; m.scanT=clock.time;
  if(ty.critter==='engineer'){ let bi=-1,bd=1e9; here.D.doors.forEach((d,k)=>{ if(!d.gone)return; const dd=Math.hypot(d.bx-m.x,d.bz-m.z); if(dd<bd&&dd<40){bd=dd;bi=k;} }); m.job=bi; }
  else { let bi=-1,bd=1e9; for(let dz=-10;dz<=10;dz++)for(let dx=-10;dx<=10;dx++){ const x=m.cx+dx, z=m.cz+dz; if(x<0||z<0||x>=MW||z>=MH)continue; const i=z*MW+x; if(!blaze.burnt[i]&&!(blaze.fire[i]>0.1))continue; if(here.D.tile[i]!==TF)continue; const dd=Math.abs(dx)+Math.abs(dz); if(dd<bd){bd=dd;bi=i;} } m.job=bi; }
  return false;
}
// 遠吠え sHowl・警報 sAlarm の音は src/lib/audio.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- large creatures of the terrain, mighty ones of the deep, and the lords of the branches
// kraken tentacles: columns of glyphs rising out of the water around the body, swaying
function drawTentacles(m,t){
  const ty=m.ty, sc=ty.scale, c=ty.col, rise=m.rise||0; if(rise<0.05)return;
  for(let k=0;k<6;k++){ const a=k/6*Math.PI*2+m.ph, r0=1.2*sc*0.55, bx=m.x+Math.cos(a)*r0, bz=m.z+Math.sin(a)*r0, h=(1.4+0.8*Math.sin(k*1.7))*sc*0.5*rise;
    for(let j=0;j*0.22<h;j++){ const q=j*0.22, sw=Math.sin(t*1.6+k+q*1.8)*0.35*q/Math.max(h,0.1); dyn(bx+Math.cos(a)*sw,0.05+q,bz+Math.sin(a)*sw,G(j%2?'S':'s'),0.26*(1-q/h*0.5),c[0]*1.4,c[1]*1.4,c[2]*1.4); } }
}

function updateMonster(m,dt,t){
  const ty=m.ty, dxp=player.x-m.x, dzp=player.z-m.z, dp=Math.hypot(dxp,dzp);
  const cell=m.cz*MW+m.cx;
  const inView=here.fovVis[cell]===here.fovStamp&&dp<28;
  if(ty.habitat==='bog'||ty.habitat==='deep'){ const tgt=(dp<(ty.habitat==='bog'?4:9)||m.noticed)?1:0; m.rise=(m.rise||0)+(tgt-(m.rise||0))*Math.min(1,dt*(tgt?1.4:0.5));
    if(ty.habitat==='bog'){ m.y=-0.9+0.9*m.rise; if(mr()<dt*3&&dp<24)spawn(m.x+(mr()-0.5)*1.2,0.06,m.z+(mr()-0.5)*1.2,0,0.25,0,0.9,G('o'),0.14,0.35,0.42,0.15,1); if(m.rise>0.3&&!m.riseMsg&&inView){ m.riseMsg=true; msg(`<b style="color:${css(ty.col)}">B</b>沼が盛り上がり、${mname(m)}が姿を現した！`); sBubble(m.x,m.z,0.5,false); } }
    else { m.y=-0.7; if(m.rise>0.3&&!m.riseMsg&&inView){ m.riseMsg=true; msg(`<b style="color:${css(ty.col)}">K</b>水面が割れ、${mname(m)}の触手が立ち上がった！`); sSplash(0.5); vfx.shake=Math.max(vfx.shake,0.2); } } }
  m.visible=inView&&!ty.invisible&&(ty.form!=='eel'||m.surf>0.08)&&(ty.habitat!=='bog'||(m.rise||0)>0.25)&&!(tallAt(cell)&&dp>3);
  if(tallAt(cell)&&!ty.flier&&m.moving>0.5&&mr()<dt*0.5)trample(cell);
  if(here.D.surface[cell]===SF_BRIM&&!ty.flier&&m.moving>0.5)brimFlare(cell);
  if(ty.critter){ if(dp>30&&!ty.critter.startsWith('clean')&&ty.critter!=='engineer'){ m.visible=false; return; } updateCritter(m,dt,t,dp); return; }
  // perception (after Brogue's stealth): the brighter the spot you stand in, the farther away you can be noticed
  if(ty.peaceful){ m.aware=0; m.noticed=false; m.sleep=false;
    if(dp<2.4&&clock.time-(m.talkT||-99)>14){ m.talkT=clock.time; const ru=adv.HIST.rulers[Math.floor(mr()*adv.HIST.rulers.length)];
      const L=[`昔々、この上には${adv.HIST.civ.name}の都があったんだとさ。`,`${ru.title}${ru.name}の巨像を見たかい？ 眼だけは、まだ光ってるんだ。`,'溶岩の海の先には、何もない闇があるって話だ。','灯りを絞って歩けば、獣にも見つからないよ。','神殿の巻物は、近づくと勝手にしゃべるんだ。',`${adv.HIST.beast}の話を聞くと、子どもたちは眠れなくなる。`,'壁の彫刻を読んでごらん。この世界の昔話が刻んであるよ。'];
      msg(`<b style="color:${css(ty.col)}">G</b><span style="color:${css(ty.col)}">ノーム</span>「${L[Math.floor(mr()*L.length)]}」`); } }
  else if(ty.form!=='eel'||m.surf>0){
    const sr=ui.started?stealth.range*(m.sleep?0.5:1):0;
    if(inView&&dp<sr){ const rate=(1-dp/sr)*2.2+0.35; m.aware=Math.min(1.25,m.aware+dt*rate*(m.sleep?0.35:1)); }
    else m.aware=Math.max(0,m.aware-dt*(m.noticed?0.12:0.2));
  }
  if(m.sleep&&m.aware>0.35){ m.sleep=false; m.wait=0.6; }
  if(!m.noticed&&m.aware>=1)onNoticed(m);
  if(m.noticed&&m.aware<0.55)m.noticed=false;
  m.alert+=((m.noticed?1:m.aware>0.35?0.35:0)-m.alert)*Math.min(1,dt*3);
  let moving=0;
  if(m.sleep){ moving=0; }
  else if(ty.flier){
    // erratic flight: picks a new heading every fraction of a second; circles the player once it notices them
    m.flitT-=dt;
    if(m.flitT<=0){
      m.flitT=0.25+mr()*0.5; const a=mr()*6.28;
      const tx=m.noticed?player.x+Math.cos(a)*2.5:m.x+Math.cos(a)*3, tz=m.noticed?player.z+Math.sin(a)*2.5:m.z+Math.sin(a)*3;
      const dx=tx-m.x, dz=tz-m.z, d=Math.hypot(dx,dz)||1, sp=ty.speed*(0.6+mr()*0.6);
      m.vx=dx/d*sp; m.vz=dz/d*sp; m.vy=(mr()-0.5)*1.6;
    }
    { const fn=fireNear(m.cx,m.cz,1); if(fn>=0){ const ax=m.x-(fn%MW+0.5)*CELL, az=m.z-(((fn/MW)|0)+0.5)*CELL, al=Math.hypot(ax,az)||1; m.vx=ax/al*ty.speed; m.vz=az/al*ty.speed; } }
    const nx=m.x+m.vx*dt, nz=m.z+m.vz*dt;
    if(flyOpen(nx,m.z))m.x=nx; else m.vx*=-1;
    if(flyOpen(m.x,nz))m.z=nz; else m.vz*=-1;
    m.fy=clamp(m.fy+m.vy*dt,1.0,Math.max(1.2,Math.min(3.0,ceilAt(m.x,m.z)-0.4))); m.y=m.fy;
    m.cx=Math.floor(m.x/CELL); m.cz=Math.floor(m.z/CELL); moving=1; m.dirYaw=Math.atan2(m.vx,m.vz);
  } else if(m.wait>0){ m.wait-=dt; if(fireNear(m.cx,m.cz,2)>=0)m.wait=0; }
  else{
    const tx=(m.tx+0.5)*CELL, tz=(m.tz+0.5)*CELL, ddx=tx-m.x, ddz=tz-m.z, d=Math.hypot(ddx,ddz);
    if(d<0.04){ m.x=tx; m.z=tz; m.cx=m.tx; m.cz=m.tz; chooseNext(m); }
    else{
      if(m.flee>0)m.flee-=dt;
      const calm=(ty.form==='bloat'||ty.form==='eel'||m.flee>0)?(m.flee>0?1.6:1):(m.noticed&&hostile(m)?1.15:(1-0.88*m.alert));
      const catchUp=m.leader&&Math.hypot(m.leader.x-m.x,m.leader.z-m.z)>4?1.35:1;
      const sp=ty.speed*calm*catchUp*dt, st=Math.min(sp,d);
      m.x+=ddx/d*st; m.z+=ddz/d*st; moving=calm; m.dirYaw=Math.atan2(ddx,ddz);
      m.cx=Math.floor(m.x/CELL); m.cz=Math.floor(m.z/CELL);
    }
  }
  m.moving+=(moving-m.moving)*Math.min(1,dt*5);
  m.yaw=lerpAngle(m.yaw,((m.alert>0.3||(ty.peaceful&&dp<4))&&!ty.flier&&ty.form!=='eel')?Math.atan2(dxp,dzp):m.dirYaw,1-Math.exp(-dt*(ty.flier?8:3)));
  m.walk+=dt*m.moving*ty.speed*5.5;
  m.glow=1+m.alert*0.7;
  if(!ty.flier&&ty.form!=='eel')m.y=ty.fl?ty.fl+Math.sin(t*1.3+m.ph)*0.12:(ty.hop?Math.abs(Math.sin(m.walk*0.7))*0.45*m.moving:0);
  const c=ty.col;
  // eels: lurk below the surface, leaving only ripples, and now and then arc out of the water
  if(ty.form==='eel'){
    m.surfT-=dt;
    if(m.surf<=0&&m.surfT<=0&&dp<20){ m.surf=0.001; m.surfT=6+mr()*8; splash(m.x,m.z,c); }
    if(m.surf>0){ m.surf+=dt/2.6; if(m.surf>=1){ m.surf=0; splash(m.x,m.z,c); } }
    m.acc+=dt*(m.surf>0?0:3.5);
    while(m.acc>=1){ m.acc--; if(dp>22)continue; for(let q=0;q<6;q++){ const a=q/6*Math.PI*2; spawn(m.x+Math.cos(a)*0.2,0.08,m.z+Math.sin(a)*0.2,Math.cos(a)*0.3,0.01,Math.sin(a)*0.3,1.1,G('~'),0.14,0.12,0.3,0.45,1); } }
  }
  if(ty.form==='bloat'&&((dp<1.4&&!m.sleep)||fireNear(m.cx,m.cz,1)>=0)){
    m.dead=true;
    for(const d of [[0,0],...D4,[1,1],[-1,1],[1,-1],[-1,-1]]){ const i=(m.cz+d[1])*MW+m.cx+d[0]; if(i>=0&&i<NCELL&&here.D.tile[i]!==TW)here.D.gas[i]=Math.min(1,here.D.gas[i]+0.95); }
    blaze.gasAny=true;
    for(let q=0;q<26;q++){ const a=mr()*6.28, e2=(mr()-0.3)*1.2; spawn(m.x,m.y,m.z,Math.cos(a)*1.6,e2,Math.sin(a)*1.6,1+mr(),G(mpick(['o','.','*','~'])),0.16,c[0]*1.6,c[1]*1.6,c[2]*1.6,1); }
    sBubble(m.x,m.z,0.5,true); sSplash(0.2);
    msg(`<b style="color:${css(c)}">b</b>${mname(m)}が弾け、腐食性のガスが広がった。`);
    return;
  }
  if(ty.conj){
    const hunt=m.noticed&&dp<10;
    if(hunt&&!m.bladeMsg){ m.bladeMsg=true; msg(`<b style="color:${css(c)}">g</b>${mname(m)}の霊剣が、あなたの周りを旋回し始めた。`); }
    for(const b of m.blades){
      b.a+=dt*(hunt?2.6:1.6);
      const ccx=hunt?player.x:m.x, ccz=hunt?player.z:m.z, r=hunt?1.7:0.9;
      const tx=ccx+Math.cos(b.a)*r, tz=ccz+Math.sin(b.a)*r, tyy=(hunt?1.35:1.55)+Math.sin(b.a*2)*0.2, k=Math.min(1,dt*(hunt?3:5));
      b.x+=(tx-b.x)*k; b.y+=(tyy-b.y)*k; b.z+=(tz-b.z)*k;
      if(mr()<dt*10&&dp<24)spawn(b.x,b.y,b.z,0,0,0,0.5,G(mpick(['.','\''])),0.1,0.8,1.2,1.5,1);
    }
  }
  if(!m.seen){
    if(m.visible&&dp<22&&ty.boss){ m.seen=true; msg(`<b style="color:${css(c)}">${ty.ch}</b>${mname(m)}がいる。この地の主だ。`); sRumble(0.25,1.6); }
    else if(m.visible&&dp<16&&ty.beast){ m.seen=true; msg(`<b style="color:${css(c)}">X</b>${mname(m)}が、洞窟の奥で眠っている。`); }
    else if(m.visible&&dp<13){ m.seen=true; msg(`<b style="color:${css(c)}">${ty.ch}</b>${mname(m)}が${m.sleep?'眠っている。忍び寄れば、気づかれずに通り抜けられるかもしれない':ty.verb}。`); }
    else if(ty.invisible&&inView&&dp<7){ m.seen=true; msg(`<b style="color:${css(c)}">?</b>何かが、すぐ近くで空気を揺らしている……。`); }
  }
  monsterStrike(m,dt,dp); if(m.hitT>0)m.hitT-=dt;
  if(ty.heavy&&!m.sleep&&m.moving>0.4&&dp<16){ m.stepT=(m.stepT||0)+dt*m.moving*ty.speed*1.6; if(m.stepT>1){ m.stepT=0; vfx.shake=Math.max(vfx.shake,0.12*(1-dp/16)); sRumble(0.12*(1-dp/16),0.4); } }
  if(ty.habitat==='lava'&&m.moving>0.5){ const ci=m.cz*MW+m.cx; if(!here.D.liquid[ci]&&blaze.fuel[ci]>0&&blaze.fire[ci]<=0&&mr()<dt*0.8)ignite(ci,0.5,false); }
  if(ty.hound&&m.moving>0.5){ const ci=m.cz*MW+m.cx; if(ty.hound==='fire'&&blaze.fuel[ci]>0&&blaze.fire[ci]<=0&&mr()<dt*0.4)ignite(ci,0.4,false); if(ty.hound==='ice'&&blaze.fire[ci]>0)blaze.fire[ci]=0; }
  if(ty.beast&&!m.sleep){
    if(ty.spec.fire){ const ci=m.cz*MW+m.cx; if(blaze.fuel[ci]>0&&blaze.fire[ci]<=0)ignite(ci,0.5,false); }
    if(ty.spec.sing&&dp<22&&mr()<dt*0.5)sChime(m.x,m.z,0.35);
  }
  if(dp<30&&ty.trail){
    m.acc+=dt*ty.trail*(m.sleep?0.25:1);
    while(m.acc>=1){ m.acc--;
      const y=m.y+(ty.form==='orb'||ty.form==='bat'||ty.form==='bloat'?0:ty.form==='wraith'?0.4+mr()*1.2:0.3+mr()*1.2*ty.scale);
      spawn(m.x+(mr()-0.5)*0.4,y,m.z+(mr()-0.5)*0.4,(mr()-0.5)*0.15,ty.form==='wraith'?-0.08:0.12+mr()*0.15,(mr()-0.5)*0.15,1.5+mr()*2,
        G(mpick(['.','\'','*','`',ty.ch])),0.08+mr()*0.06,c[0]*1.3,c[1]*1.3,c[2]*1.3,1);
    }
  }
}
function splash(x,z,c){
  if(Math.hypot(x-player.x,z-player.z)<24)sSplash(0.25*sDist(x,z));
  if(Math.hypot(x-player.x,z-player.z)>26)return;
  for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(x+Math.cos(a)*0.3,0.1,z+Math.sin(a)*0.3,Math.cos(a)*0.8,0.8+mr()*1.2,Math.sin(a)*0.8,0.9+mr()*0.5,G(mpick(['~','.','\'','o'])),0.13,0.25,0.55,0.9,1); }
}
let aimMon=null;
function drawMonster(m,t){
  if(m.wind>0){ const sc=m.ty.scale, h=m.y+(m.ty.habitat==='deep'?2.2:1.9*sc); dyn(m.x,h,m.z,G('!'),0.5,3.2,0.6,0.4); }
  if(m.hitT>0){ const g0=m.glow; m.glow*=3; drawMonster1(m,t); m.glow=g0; return; }
  drawMonster1(m,t);
}
function drawMonster1(m,t){
  if(m.ty.habitat==='deep'&&Math.hypot(m.x-player.x,m.z-player.z)<44)drawTentacles(m,t);
  if(m.ty.critter&&Math.hypot(m.x-player.x,m.z-player.z)>30)return;
  if(m===aimMon&&!m.hidden){ const g0=m.glow; m.glow*=1.9; drawMonster0(m,t); m.glow=g0; const sc=m.ty.scale, c=m.ty.col; for(let k=0;k<12;k++){ const a=k/12*Math.PI*2+t*0.8; dyn(m.x+Math.cos(a)*0.75*sc,m.y+0.5*sc,m.z+Math.sin(a)*0.75*sc,G('.'),0.12,c[0]*2.4,c[1]*2.4,c[2]*2.4); } return; }
  drawMonster0(m,t);
}
function drawMonster0(m,t){
  const fj=(m.flinchUntil||0)>clock.time?(m.flinchUntil-clock.time)*0.9*(m.ty.scale||1):0;
  if((m.ty.form==='dragon'&&!m.ty.boss)||m.ty.beast){ if(!m.formSleep)m.formSleep=m.ty.beast?beastSleep(m.form,m.ty):dragonSleepForm(m.ty);
    if(m.wasSleep&&!m.sleep&&!m.morph)m.morph={from:m.formSleep,t0:clock.time,dur:1.0};
    m.wasSleep=!!m.sleep; m.drawForm=m.sleep&&!m.morph?m.formSleep:null; }
  if(m.ty.form==='lichking'&&!m.dead)lichAura(m,t);
  if(m.ty.form==='spiderqueen'&&!m.dead)spiderAura(m,t);
  if(m.ty.form==='nagaqueen'&&!m.dead)nagaAura(m,t);
  if(m.ty.form==='olddragon'&&!m.dead)dragonAura(m,t);
  if((m.ty.form==='shadowking'||m.ty.form==='shadowserpent')&&!m.dead)shadowAura(m,t);
  if(m.ty.form==='deepkraken'&&!m.dead)krakenAura(m,t);
  if(m.ty.hound&&!m.dead)houndAura(m,t);
  if(m.elite&&!m.dead&&Math.hypot(m.x-player.x,m.z-player.z)<26){ const r=0.75*(m.ty.scale||1); for(let k=0;k<14;k++){ const a=k/14*Math.PI*2+t*0.6; dyn(m.x+Math.cos(a)*r,m.y+0.04,m.z+Math.sin(a)*r,G('.'),0.15,1.4,0.45,0.25,0,0); } }
  if(m.ty.look==='salamander'&&!m.dead)salamanderAura(m,t);
  if(m.ty.form==='bog'&&!m.ty.boss&&!m.dead)bogAura(m,t);
  if(m.morph&&drawMorph(m,t))return;
  const dx=m.x-player.x, dz=m.z-player.z, d2=dx*dx+dz*dz; if(d2>44*44)return;
  if(m.hidden){ const y=1.3+Math.sin(t*1.1+m.ph)*0.06, sh=Math.sin(t*23+m.ph)*0.012; dyn(m.x+sh,y,m.z,G('?'),0.5,2.2,1.75,0.85); for(let k=0;k<6;k++){ const a=t*0.7+k/6*Math.PI*2; dyn(m.x+Math.cos(a)*0.35,y-0.25,m.z+Math.sin(a)*0.35,G('.'),0.12,1.4,1.1,0.5); } return; }
  const ty=m.ty, c=ty.col, sc=ty.scale*(ty.form==='shadowking'?1+0.025*Math.sin(t*0.8+m.ph):1), cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), dp=Math.sqrt(d2);
  const near=clamp(dp/3.5,0.45,1);
  const swing=Math.sin(m.walk)*0.55*m.moving, bob=Math.abs(Math.sin(m.walk))*0.04*m.moving;
  const lit=cellLight(m.x,m.z);
  const eelArc=ty.form==='eel'?Math.sin(Math.PI*m.surf):0;
  for(const p of (m.drawForm||m.form)){
    if(p.part==='heart'&&!m.heartOn)continue;
    if(p.part==='crack'&&!(m.maxHp&&m.hp/m.maxHp<p.th))continue;
    if(p.part==='tongue'&&Math.sin(t*2.3+m.ph)<0.6)continue;
    let lx=p.x, ly=p.y, lz=p.z;
    if((p.part==='heart'||p.part==='eye')&&ty.form==='shadowserpent'){ const k=Math.max(0,p.y-0.4); lx+=Math.sin(t*0.9-p.y*1.3+m.ph)*0.035*k; lz+=Math.cos(t*0.7-p.y*1.1)*0.025*k; }
    switch(p.part){
      case 'tent': { const q=p.piv||0; lx+=Math.sin(t*0.8+q*0.45+(p.ti||0)*1.7)*0.012*q; ly+=Math.cos(t*0.7+q*0.5+(p.ti||0))*0.008*q; break; }
      case 'ap': { const k=1+0.18*Math.sin(t*0.9+m.ph); lx=p.cx+(p.x-p.cx)*k; ly=p.cy+(p.y-p.cy)*k; break; }
      case 'flame': { const f=p.fh||0; ly+=(Math.sin(t*9+p.ph)*0.03+0.02)*f; lz-=(m.moving||0)*0.1*f; lx+=Math.sin(t*6+p.ph*2)*0.015*f; break; }
      case 'jel': { const k=1+0.07*Math.sin(t*3.2+p.y*5+m.ph); lx*=k; lz*=k; ly*=1-0.05*Math.sin(t*3.2+m.ph); break; }
      case 'bloat': { const k=1+0.06*Math.sin(t*1.6+m.ph); lx*=k; ly*=k; lz*=k; break; }
      case 'wisp': { lx+=Math.sin(t*5+p.ph)*0.03; ly+=Math.sin(t*4.3+p.ph*1.3)*0.04; lz+=Math.cos(t*5.4+p.ph)*0.03; break; }
      case 'eelw': lx+=Math.sin(t*4-p.z*3.5+m.ph)*0.09*(0.4+Math.max(0,0.8-p.z)); break;
      case 'slither': lx+=Math.sin(t*5-p.z*5+m.ph)*0.05*(0.3+Math.max(0,0.6-p.z)); break;
      case 'tongue': lx+=Math.sin(t*5-p.z*5+m.ph)*0.02; break;
      case 'cap': if(m.noticed||m.alert>0.5){ lx+=Math.sin(t*40+p.ph)*0.012; lz+=Math.cos(t*37+p.ph)*0.012; } break;
      case 'snout': if(!(m.moving>0.3)){ lz+=Math.sin(t*14+m.ph)*0.012; } break;
      case 'graze': { const g2=Math.max(0,Math.sin(t*0.9+m.ph)); ly-=g2*0.08; lz+=g2*0.03; break; }
      case 'sway': lx+=Math.sin(t*2.2+p.ph)*0.015; break;
      case 'bog': { const k=1+0.05*Math.sin(t*1.4+m.ph+p.y*2); lx*=k; lz*=k; break; }
      case 'bogarm': { const k=1+0.05*Math.sin(t*1.4+m.ph+p.y*2); lx*=k; lz*=k; lz+=Math.sin(t*0.9+m.ph)*0.05*Math.max(0,p.z); ly+=Math.cos(t*0.8+m.ph)*0.03*Math.max(0,p.z); break; }
      case 'breathe': { const k=1+0.025*Math.sin(t*1.1+m.ph); lx*=k; ly*=k; lz*=k; break; }
      case 'claw': { const k=Math.max(0,p.y-0.4); lx+=Math.sin(t*0.9-p.y*1.3+m.ph)*0.035*k; lz+=Math.cos(t*0.7-p.y*1.1)*0.025*k; const cl=Math.pow(Math.max(0,Math.sin(t*0.8+m.ph+p.hx)),6)*0.35*(p.cf||0); lx+=(p.hx-p.x)*cl; ly+=(p.hy-p.y)*cl; lz+=(p.hz-p.z)*cl; break; }
      case 'parm': { const k=Math.max(0,p.y-0.4); lx+=Math.sin(t*0.9-p.y*1.3+m.ph)*0.035*k; lz+=Math.cos(t*0.7-p.y*1.1)*0.025*k+Math.sin(t*1.1+m.ph)*0.08*Math.min(1,Math.abs(p.x)/1.2); ly+=Math.sin(t*1.1+m.ph)*0.04*Math.min(1,Math.abs(p.x)/1.2); break; }
      case 'serp': { const k=Math.max(0,p.y-0.4); lx+=Math.sin(t*0.9-p.y*1.3+m.ph)*0.035*k; lz+=Math.cos(t*0.7-p.y*1.1)*0.025*k; break; }
      case 'wing2': { const k=Math.abs(p.x); ly+=Math.sin(t*0.9+k*1.5)*0.07*k; lz+=Math.sin(t*0.9+k)*0.05*k; break; }
      case 'tendril': { const q=p.piv||0; lx+=Math.sin(t*1.6+q*0.8+p.ph*0.1)*0.012*q; ly+=Math.cos(t*1.3+q*0.7)*0.01*q; break; }
      case 'armL': case 'legR': case 'armR': case 'legL': {
        const ang=(p.part==='armL'||p.part==='legR')?swing:-swing, dy=ly-p.piv, dz2=lz-p.pz;
        ly=p.piv+dy*Math.cos(ang)-dz2*Math.sin(ang); lz=p.pz+dy*Math.sin(ang)+dz2*Math.cos(ang); ly+=bob; break; }
      case 'head': case 'core': case 'body': ly+=bob+(ty.form==='humanoid'||ty.form==='quad'?0:Math.sin(t*1.6+m.ph)*0.03); break;
      case 'shell': { const a=t*0.9+m.ph, ca=Math.cos(a), sa=Math.sin(a); const nx=lx*ca-lz*sa, nz=lx*sa+lz*ca; const b=0.35*Math.sin(t*0.6+m.ph); lx=nx; lz=nz*Math.cos(b)-ly*Math.sin(b); ly=nz*Math.sin(b)+ly*Math.cos(b); break; }
      case 'puff': { const k=1+0.07*Math.sin(t*2.2+m.ph), a=t*0.25, ca=Math.cos(a), sa=Math.sin(a); const nx=lx*ca-lz*sa, nz=lx*sa+lz*ca; lx=nx*k; ly*=k; lz=nz*k; break; }
      case 'wing': { const dr=ty.form==='dragon'||(ty.beast&&ty.spec&&ty.spec.plan!=='moth'), mo=ty.beast&&ty.spec&&ty.spec.plan==='moth', fa=dr?0.8+Math.sin(t*1.3+m.ph)*(m.sleep?0.06:0.3):mo?Math.sin(t*4+m.ph)*0.55:Math.sin(t*16+m.ph)*0.9; lx=p.sd*p.r*Math.cos(fa); ly=p.y+p.r*Math.sin(fa)*0.9; break; }
      case 'tail': lx+=Math.sin(t*7+m.ph)*0.05*(p.piv+1); break;
      case 'spin': { const a=t*(p.sp||1)+p.ph; lx=p.cx+Math.cos(a)*p.r; lz=p.cz+Math.sin(a)*p.r; ly=p.y; break; }
      case 'halo': { const a=t*(p.sp||0.2)+p.ph; lx=Math.cos(a)*p.r; ly=p.cy+Math.sin(a)*p.r; break; } // a ring standing upright (the king's shadow's black sun), turning in its own plane
      case 'orbit': { const a=t*(p.sp||0.8)+p.ph+(p.da||0); lx=Math.cos(a)*p.r; lz=Math.sin(a)*p.r; ly=p.y+Math.sin(t*2+p.ph)*0.06; break; }
      case 'robe': { const k=1.95-p.y; lx+=Math.sin(t*2.2+p.y*3+p.ph)*0.05*k; lz+=Math.cos(t*1.7+p.y*2.5+p.ph)*0.05*k; break; }
      case 'seg': { lx+=Math.sin(t*2.6*Math.max(0.4,m.moving)+m.walk*0.5-p.piv*0.65)*0.26*(0.35+p.piv/11); ly+=Math.sin(t*3+p.piv)*0.01; break; }
      case 'shead': { lx+=Math.sin(t*2.6*Math.max(0.4,m.moving)+m.walk*0.5)*0.26*0.35; ly+=Math.sin(t*1.7+m.ph)*0.05; break; }
      case 'jelly': { const k=Math.sin(t*3+m.ph); ly*=1+0.12*k; lx*=1-0.06*k; lz*=1-0.06*k; break; }
    }
    if(ty.form==='eel'){ const seg=p.part==='shead'?0:p.piv; ly+=1.3*Math.max(0,Math.sin(Math.PI*clamp(m.surf*1.35-seg*0.03,0,1)))-0.1*seg*eelArc; }
    lx*=sc; ly*=sc; lz*=sc;
    const wx=m.x+lx*cy+lz*sy, wz=m.z-lx*sy+lz*cy, wy=m.y+ly;
    if(ty.invisible){
      // phantoms are only a shimmer: brief, faint glyphs scattered over the silhouette; now and then the whole shape shows for a moment
      const rv=Math.max(0,(Math.sin(t*1.1+m.ph)-0.88)/0.12); if(rv>0){ const kk=p.b*0.55*rv; dyn(wx,wy,wz,p.g,p.s*sc,0.6*kk,0.72*kk,1.0*kk,0,0); }
      if(dp<16&&mr()<0.5){ const fk=dp<4?0.22:0.07; spawn(wx+(mr()-0.5)*0.08,wy,wz+(mr()-0.5)*0.08,0,0,0,0.08,G(SWAPSET[Math.floor(mr()*SWAPSET.length)]),p.s*sc*1.2,0.6*fk,0.7*fk,1.0*fk,1); }
      continue;
    }
    const isCore=p.part==='core'||p.part==='shead';
    const shim=isCore?(0.85+0.15*Math.sin(t*2.3+m.ph)):(0.62+0.38*Math.sin(t*3.1+p.ph*7));
    let g=p.g;
    if(!isCore&&Math.sin(t*0.8+p.ph*11.3)>0.986)g=G(SWAPSET[Math.floor(t*3+p.ph*7)%SWAPSET.length]);
    let k=p.b*shim*m.glow*0.62*(isCore?near:1)*(sc<0.9?1.4:1);
    if(p.part==='pulse')k*=0.5+0.9*Math.max(0,Math.sin(t*2.5+p.ph*0.3));
    if(p.part==='eye')k*=(1+2*Math.max(0,Math.sin(t*0.7+m.ph)-0.85)/0.15)*(ty.form==='watcher'&&m.noticed?1.8:1); else if(p.part==='heart')k*=0.7+0.6*Math.max(0,Math.sin(t*4));
    const sb=sc<0.9?1+clamp((dp-4)/10,0,0.6):1;
    if(ty.form==='eel'&&wy<0){ if(dp>14)continue; k*=0.12; }
    const cc=p.col||c; if(p.part==='flame')g=G(['^','\'','^','*'][((t*12+p.ph*3)|0)%4]); const jx=fj?(mr()-0.5)*fj:0, jy=fj?(mr()-0.5)*fj:0, jz=fj?(mr()-0.5)*fj:0; dyn(wx+jx,wy+jy,wz+jz,g,p.s*sc*sb,cc[0]*k+lit[0]*0.12,cc[1]*k+lit[1]*0.12,cc[2]*k+lit[2]*0.12,0,0);
  }
  drawMark(m,t,dp);
  if(ty.conj)for(const b of m.blades){
    const bn=clamp(Math.hypot(b.x-camera.position.x,b.y-camera.position.y,b.z-camera.position.z)/3,0.25,1);
    dyn(b.x,b.y,b.z,G('|'),0.55,1.4*bn,2.2*bn,2.6*bn,0,0);
    dyn(b.x,b.y-0.3,b.z,G('+'),0.3,0.9*bn,1.4*bn,1.8*bn,0,0);
  }
}

