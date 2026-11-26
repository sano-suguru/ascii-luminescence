// ---------------------------------------------------------------- first / third person (chosen in the menu)
try{ ui.camMode=localStorage.getItem('al_cam')||'fps'; }catch(e){}
// AVATAR_TY は src/lib/names.ts（src/game/imports.mjs で読む）
let avatar=null;
// 頭の位置 headPos と、攻撃や投げた物が出る所 aimOrigin は src/lib/aim.ts（src/game/imports.mjs で読む）
function camBlocked(x,y,z){
  for(const [ox,oz] of [[0,0],[0.22,0],[-0.22,0],[0,0.22],[0,-0.22]]){ const cx=Math.floor((x+ox)/CELL), cz=Math.floor((z+oz)/CELL); if(cx<0||cz<0||cx>=MW||cz>=MH)return true;
    const i=cz*MW+cx, tt=here.D.tile[i]; if(tt===TW||tt===TX)return true; if(y>here.D.ceil[i]-0.25)return true; if(tt!==TC&&y<0.3)return true;
    if(tt===TP&&Math.hypot(x+ox-(cx+0.5)*CELL,z+oz-(cz+0.5)*CELL)<0.7)return true; }
  return false;
}
// placeThirdPerson は src/lib/player.ts（src/game/imports.mjs で読む）
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
  if(ui.camMode!=='tps'||!ui.camPos)return;
  const C=ui.camPos, h=headPos(), P=[h[0],h[1]-0.25,h[2]], sx=P[0]-C[0], sy=P[1]-C[1], sz=P[2]-C[2], L=Math.hypot(sx,sy,sz)||1, ax=sx/L, ay=sy/L, az=sz/L;
  // two directions perpendicular to the line from the camera to you
  let ux=-az, uy=0, uz=ax; const ul=Math.hypot(ux,uz)||1; ux/=ul; uz/=ul;
  const vx=ay*uz-az*uy, vy=az*ux-ax*uz, vz=ax*uy-ay*ux;
  for(let r=0;r<18;r++){ const t=0.03+r*0.053, R=2.6+(0.9-2.6)*t+0.04, cx=C[0]+sx*t, cy=C[1]+sy*t, cz=C[2]+sz*t, n=Math.max(12,Math.round(R*22));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+r*0.37, px=cx+(ux*Math.cos(a)+vx*Math.sin(a))*R, py=cy+(uy*Math.cos(a)+vy*Math.sin(a))*R, pz=cz+(uz*Math.cos(a)+vz*Math.sin(a))*R;
      if(!rockAt(px,py,pz))continue; const hsh=((k*73+r*151)%7), b=0.2+0.06*(hsh%3);
      dyn(px,py,pz,G(hsh<3?'#':hsh<5?'%':':'),0.38,b*1.25,b*1.1,b*1.35); } }
}
// 視点を変える setCamMode は src/lib/screens.ts、3人称のカメラの位置 ui.camPos は src/lib/state.ts（src/game/imports.mjs で読む）

// updatePlayer は src/lib/player.ts（src/game/imports.mjs で読む）
// eye adaptation and atmosphere: open caverns thin the fog, bright surroundings lower the exposure
function updateAtmosphere(dt){
  const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL), ri=here.D.roomOf[pc];
  const inCave=ri>=0&&here.D.rooms[ri].cave;
  const fogT=inCave?(here.D.stratum.k==='cavern'?0.032:0.03):(here.D.stratum.k==='ruins'?0.04:gfx.fogBase);
  gfx.U.uFogDen.value+=(fogT-gfx.U.uFogDen.value)*(1-Math.exp(-dt*0.9));
  const l=cellLight(player.x,player.z); let B=0.3*l[0]+0.55*l[1]+0.15*l[2];
  for(const m of here.monsters){ const d=Math.hypot(m.x-player.x,m.z-player.z); if(d<5)B+=(1-d/5)**2*0.7; }
  for(const f of here.fixtures){ const d=Math.hypot(f.x-player.x,f.z-player.z); if(d<3)B+=(1-d/3)**2*0.8; }
  const target=clamp(1.25/(1+B*0.6),0.55,1.25);
  expo+=(target-expo)*(1-Math.exp(-dt*(target<expo?2.5:1.0)));
  vfx.flash=Math.max(0,vfx.flash-dt*2.5);
  gfx.finalPass.uniforms.uExposure.value=expo*(1+vfx.flash*1.6);
  let heat=0; for(const f of here.fixtures){ if(f.type!=='lava'&&!(f.type==='crater'&&f.active))continue; heat=Math.max(heat,1-Math.hypot(f.x-player.x,f.z-player.z)/10); }
  const hu=gfx.finalPass.uniforms.uHeat; hu.value+=(heat-hu.value)*Math.min(1,dt*2);
  gfx.finalPass.uniforms.uSwim.value=ui.camMode==='tps'?0:clamp((EYE-player.eye)/(EYE-0.62),0,1);
}

