// ---------------------------------------------------------------- first / third person (chosen in the menu)
try{ ui.camMode=localStorage.getItem('al_cam')||'fps'; }catch(e){}
// AVATAR_TY は src/lib/names.ts（src/game/imports.mjs で読む）
let avatar=null, camPos=null;
function headPos(){ return [player.x,player.eye+0.05-(player.roll?Math.sin(Math.PI*player.roll.t/0.32)*0.55:0),player.z]; }
// where attacks and thrown things start: the eye in first person, the head of the avatar in third person
function aimOrigin(){ return ui.camMode==='tps'?headPos():[camera.position.x,camera.position.y,camera.position.z]; }
function camBlocked(x,y,z){
  for(const [ox,oz] of [[0,0],[0.22,0],[-0.22,0],[0,0.22],[0,-0.22]]){ const cx=Math.floor((x+ox)/CELL), cz=Math.floor((z+oz)/CELL); if(cx<0||cz<0||cx>=MW||cz>=MH)return true;
    const i=cz*MW+cx, tt=here.D.tile[i]; if(tt===TW||tt===TX)return true; if(y>here.D.ceil[i]-0.25)return true; if(tt!==TC&&y<0.3)return true;
    if(tt===TP&&Math.hypot(x+ox-(cx+0.5)*CELL,z+oz-(cz+0.5)*CELL)<0.7)return true; }
  return false;
}
function placeThirdPerson(dt,sk){
  const h=headPos(), [dx,dy,dz]=viewDir(), rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw);
  const tx=h[0]-dx*4.0+rx*0.5, ty=Math.max(0.4,h[1]-dy*4.0+0.5), tz=h[2]-dz*4.0+rz*0.5;
  if(!camPos)camPos=[tx,ty,tz];
  const k=Math.min(1,dt*14); camPos[0]+=(tx-camPos[0])*k; camPos[1]+=(ty-camPos[1])*k; camPos[2]+=(tz-camPos[2])*k;
  camera.position.set(camPos[0]+(mr()-0.5)*sk,camPos[1]+(mr()-0.5)*sk,camPos[2]);
  camera.rotation.set(player.pitch,player.yaw,0);
  U.uCamP.value.set(camPos[0],camPos[1],camPos[2]); U.uCutP.value.set(h[0],h[1]-0.25,h[2]); U.uCut.value=1;
}
function updateAvatar(dt){
  if(!avatar)avatar={ty:AVATAR_TY,form:buildForm(AVATAR_TY),x:0,z:0,y:0,yaw:0,walk:0,moving:0,ph:1.3,glow:1.1,surf:0};
  const sp=Math.hypot(player.vx,player.vz), face=(player.swing>0||sp<0.3)?player.yaw+Math.PI:Math.atan2(player.vx,player.vz);
  avatar.x=player.x; avatar.z=player.z; avatar.yaw=lerpAngle(avatar.yaw,face,1-Math.exp(-dt*12));
  avatar.moving+=((sp>0.3?1:0)-avatar.moving)*Math.min(1,dt*6); avatar.walk+=dt*sp*2.2;
  avatar.y=(player.eye<1?-0.95:0)-(player.roll?Math.sin(Math.PI*player.roll.t/0.32)*0.6:0);
  avatar.glow=1.9+Math.min(1.5,vfx.hurtFlash*2);
}
function rockAt(x,y,z){
  const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL); if(cx<0||cz<0||cx>=MW||cz>=MH)return true;
  const i=cz*MW+cx, tt=here.D.tile[i]; if(tt===TW||tt===TX)return true;
  if(y>here.D.ceil[i])return true; if(y<0&&tt!==TC)return true; return false;
}
function drawSection(){
  if(ui.camMode!=='tps'||!camPos)return;
  const C=camPos, h=headPos(), P=[h[0],h[1]-0.25,h[2]], sx=P[0]-C[0], sy=P[1]-C[1], sz=P[2]-C[2], L=Math.hypot(sx,sy,sz)||1, ax=sx/L, ay=sy/L, az=sz/L;
  // two directions perpendicular to the line from the camera to you
  let ux=-az, uy=0, uz=ax; const ul=Math.hypot(ux,uz)||1; ux/=ul; uz/=ul;
  const vx=ay*uz-az*uy, vy=az*ux-ax*uz, vz=ax*uy-ay*ux;
  for(let r=0;r<18;r++){ const t=0.03+r*0.053, R=2.6+(0.9-2.6)*t+0.04, cx=C[0]+sx*t, cy=C[1]+sy*t, cz=C[2]+sz*t, n=Math.max(12,Math.round(R*22));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+r*0.37, px=cx+(ux*Math.cos(a)+vx*Math.sin(a))*R, py=cy+(uy*Math.cos(a)+vy*Math.sin(a))*R, pz=cz+(uz*Math.cos(a)+vz*Math.sin(a))*R;
      if(!rockAt(px,py,pz))continue; const hsh=((k*73+r*151)%7), b=0.2+0.06*(hsh%3);
      dyn(px,py,pz,G(hsh<3?'#':hsh<5?'%':':'),0.38,b*1.25,b*1.1,b*1.35); } }
}
function setCamMode(m){ ui.camMode=m; camPos=null; try{ localStorage.setItem('al_cam',m); }catch(e){} }

function updatePlayer(dt){
  if(adv.dead)return;
  if(!ui.started){ player.yaw+=dt*0.07; }
  else{
    const k=keys;
    const fw=((k.KeyW||k.ArrowUp)?1:0)-((k.KeyS||k.ArrowDown)?1:0), st=(k.KeyD?1:0)-(k.KeyA?1:0);
    if(k.ArrowLeft)player.yaw+=dt*2.0; if(k.ArrowRight)player.yaw-=dt*2.0;
    const sy=Math.sin(player.yaw), cy=Math.cos(player.yaw);
    const pci=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL), lq=here.D.liquid[pci], wade=(here.D.bridge[pci]?1:lq===LQ_DEEP?0.45:lq===LQ_BOG?0.55:lq===LQ_WATER?0.8:1)*(webTouch(pci)?0.35:1)*(here.D.surface[pci]===SF_MUD&&!lq?0.72:1)*(player.netT>0?0:1);
    if(pci!==player.lastCell){ player.lastCell=pci; brimFlare(pci); if(tallAt(pci)){ if(!tallMsg){ tallMsg=true; msg('<b style="color:#7ad86a">"</b>背の高い茂みを踏み分けた。茂みは視線を遮る。獣との間に挟めば、身を隠す壁になる。踏み分けた跡は、しばらくすると元に戻る。'); } trample(pci); } }
    if(!lq)scent[pci]=time;
    if(lq===LQ_DEEP&&!here.D.swimMsg){ here.D.swimMsg=true; msg('<b style="color:#5aa0ff">~</b>深い水に入った。足が届かない。ゆっくりと泳いで進む。'); }
    const ix=-sy*fw+cy*st, iz=-cy*fw-sy*st, len=Math.hypot(ix,iz), sp=((k.ShiftLeft||k.ShiftRight)&&!stealth.sneak?5.6:stealth.sneak?2.3:3.2)*wade;
    if(wade<1&&len){ player.splash=(player.splash||0)+dt*Math.hypot(player.vx,player.vz)*1.4; while(player.splash>1){ player.splash--; const a0=mr()*6.28;
      sSplash(lq===LQ_DEEP?0.22:0.12);
      for(let q=0;q<5;q++){ const a=a0+q/5*Math.PI*2; spawn(player.x+Math.cos(a)*0.15,0.07,player.z+Math.sin(a)*0.15,Math.cos(a)*0.5,0.02,Math.sin(a)*0.5,0.8,G(lq===LQ_BOG?'o':'~'),0.12,lq===LQ_BOG?0.3:0.15,lq===LQ_BOG?0.34:0.3,lq===LQ_BOG?0.12:0.55,1); } } }
    const onIce=here.D.surface[pci]===SF_ICE&&!here.D.liquid[pci]&&!here.D.bridge[pci];
    if(onIce&&!here.D.iceMsg){ here.D.iceMsg=true; msg('<b style="color:#b8e4ff">=</b>氷の上だ。足が滑る。止まるにも、曲がるにも時間がかかる。'); }
    if(here.D.thin[pci]&&!here.D.liquid[pci])crackIce(pci,dt);
    const BSP=1+0.15*bodyN('swift'), tx=len?ix/len*sp*BSP:0, tz=len?iz/len*sp*BSP:0, a=1-Math.exp(-dt*(onIce?1.3:9));
    player.vx+=(tx-player.vx)*a; player.vz+=(tz-player.vz)*a;
    if(player.lunge){ player.lunge.t+=dt; player.vx=player.lunge.dx*player.lunge.sp; player.vz=player.lunge.dz*player.lunge.sp; dashCuts(); if(player.lunge.t>=player.lunge.dur)player.lunge=null; }
    if(player.roll){ player.roll.t+=dt; const rs=8.5*Math.min(1,wade+0.25); player.vx=player.roll.dx*rs; player.vz=player.roll.dz*rs; if(player.roll.t>=0.32*(1+0.35*bodyN('roll')))player.roll=null; }
    player.rollCd=Math.max(0,(player.rollCd||0)-dt);
    let blocked='';
    const nx=player.x+player.vx*dt; if(!solidAt(nx,player.z,PR))player.x=nx; else { player.vx=0; blocked=blockType; }
    const nz=player.z+player.vz*dt; if(!solidAt(player.x,nz,PR))player.z=nz; else { player.vz=0; blocked=blocked||blockType; }
    // make impassable terrain legible: say what is in the way; at a chasm's edge, keep pushing to jump (as in Brogue)
    if(len&&blocked&&blocked!=='wall'){
      edge.t+=dt; edge.k=blocked; edge.idle=0;
      if(blocked==='chasm'){ showHint(`裂け目の縁だ。このまま進み続けると飛び降りる <b>[${'#'.repeat(Math.min(5,Math.floor(edge.t/0.24)))}${'-'.repeat(5-Math.min(5,Math.floor(edge.t/0.24)))}]</b>`); if(edge.t>1.2&&!here.trans){ here.trans={phase:'out',t:0,regen:false}; player.fall=true; sRumble(0.5,1.4); msg('<b style="color:#9a7cff">:</b>裂け目へ身を投じ、闇の中を下の階層へと落ちていく……'); } }
      else if(blocked==='lava'){ showHint('溶岩の熱が行く手を阻んでいる。これ以上は近づけない'); finalPass.uniforms.uHeat.value=Math.min(1.4,finalPass.uniforms.uHeat.value+dt*2); }
      else if(blocked==='gate')showHint('鉄格子が行く手を塞いでいる。どこかに開ける仕掛けがあるはずだ');
      else if(blocked==='xtal')showHint('結晶に行く手を塞がれている。光は通るが、体は通れない');
    } else { edge.idle+=dt; if(edge.idle>0.15)edge.t=0; if(edge.idle>0.9)showHint(''); }
    for(const m of here.monsters){
      if(m.ty.flier||m.ty.form==='eel')continue;
      const dx=player.x-m.x, dz=player.z-m.z, d=Math.hypot(dx,dz), rr=0.7*m.ty.scale;
      if(d<rr&&d>1e-4){ const qx=m.x+dx/d*rr, qz=m.z+dz/d*rr; if(!solidAt(qx,player.z,PR))player.x=qx; if(!solidAt(player.x,qz,PR))player.z=qz; }
    }
    player.bob+=dt*Math.hypot(player.vx,player.vz)*2.1;
  }
  const spd=Math.min(1,Math.hypot(player.vx,player.vz)/3.2);
  const sk=vfx.shake*0.08; vfx.shake=Math.max(0,vfx.shake-dt*1.2);
  { const pci=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL), deep=here.D.liquid[pci]===LQ_DEEP&&!here.D.bridge[pci]; player.eye+=((deep?0.62:EYE)-player.eye)*Math.min(1,dt*3); }
  if(ui.camMode==='tps'){ placeThirdPerson(dt,sk); return; }
  U.uCut.value=0;
  camera.position.set(player.x+(mr()-0.5)*sk,(mr()-0.5)*sk+player.eye-(player.roll?Math.sin(Math.PI*player.roll.t/0.32)*0.55:0)+Math.sin(player.bob*2)*0.035*spd*(player.eye<1?0.3:1)+(player.eye<1?Math.sin(time*1.8)*0.04:0),player.z);
  camera.rotation.set(player.pitch,player.yaw,Math.sin(player.bob)*0.004*spd);
}
// eye adaptation and atmosphere: open caverns thin the fog, bright surroundings lower the exposure
function updateAtmosphere(dt){
  const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL), ri=here.D.roomOf[pc];
  const inCave=ri>=0&&here.D.rooms[ri].cave;
  const fogT=inCave?(here.D.stratum.k==='cavern'?0.032:0.03):(here.D.stratum.k==='ruins'?0.04:fogBase);
  U.uFogDen.value+=(fogT-U.uFogDen.value)*(1-Math.exp(-dt*0.9));
  const l=cellLight(player.x,player.z); let B=0.3*l[0]+0.55*l[1]+0.15*l[2];
  for(const m of here.monsters){ const d=Math.hypot(m.x-player.x,m.z-player.z); if(d<5)B+=(1-d/5)**2*0.7; }
  for(const f of here.fixtures){ const d=Math.hypot(f.x-player.x,f.z-player.z); if(d<3)B+=(1-d/3)**2*0.8; }
  const target=clamp(1.25/(1+B*0.6),0.55,1.25);
  expo+=(target-expo)*(1-Math.exp(-dt*(target<expo?2.5:1.0)));
  vfx.flash=Math.max(0,vfx.flash-dt*2.5);
  finalPass.uniforms.uExposure.value=expo*(1+vfx.flash*1.6);
  let heat=0; for(const f of here.fixtures){ if(f.type!=='lava'&&!(f.type==='crater'&&f.active))continue; heat=Math.max(heat,1-Math.hypot(f.x-player.x,f.z-player.z)/10); }
  const hu=finalPass.uniforms.uHeat; hu.value+=(heat-hu.value)*Math.min(1,dt*2);
  finalPass.uniforms.uSwim.value=ui.camMode==='tps'?0:clamp((EYE-player.eye)/(EYE-0.62),0,1);
}

