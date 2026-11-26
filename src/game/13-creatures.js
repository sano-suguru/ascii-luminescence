// ---------------------------------------------------------------- small creatures (the living layer of the world; they never hunt you)
// 小さな生き物の形（critterForm など）は src/lib/bodies/small.ts（形は src/lib/bodies/build.ts の buildForm が選んで作る。古い JS は読まない）
// 小さな生き物の動き updateCritter は src/lib/ground.ts（src/game/imports.mjs で読む）。次に向かうマス critterStep は src/lib/monsters.ts、叫び声の音 sShriek は src/lib/audio.ts（古い JS は読まない）

// ---------------------------------------------------------------- packs and hunters: spiders and their webs, hounds on your scent, snapjaw camps, ancient machines
// クモの巣を描く drawWebs と触れた時の webTouch は src/lib/fixtures.ts（src/game/imports.mjs で読む）。その階で一度だけの伝言の旗は src/lib/state.ts の here
// 猟犬が追う匂い houndScent は src/lib/monsters.ts、掃除機と修復機の仕事 machineWork は src/lib/ground.ts（古い JS は読まない）
// 遠吠え sHowl・警報 sAlarm の音は src/lib/audio.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- large creatures of the terrain, mighty ones of the deep, and the lords of the branches
// 深みの主の触手 drawTentacles は src/lib/bodies/draw.ts（src/game/imports.mjs で読む）

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
    if(ty.spec.sing&&dp<22&&sndRand()<dt*0.5)sChime(m.x,m.z,0.35);
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
// 水しぶき splash は src/lib/ground.ts（src/game/imports.mjs で読む）
// 生き物を描く drawMonster・drawMonster1・drawMonster0 は src/lib/bodies/draw.ts（src/game/imports.mjs で読む）

