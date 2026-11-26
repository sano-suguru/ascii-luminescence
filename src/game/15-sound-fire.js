// ---------------------------------------------------------------- ambient sound (procedural, Web Audio)
// SND_NAME・sEnv は src/lib/sound.ts、音を鳴らす処理（sndReady・sndInit・sOut・sNoise・sTone・効果音・まわりの音 sndUpdate）は src/lib/audio.ts（どれも src/game/imports.mjs で読む）
// SND は src/lib/state.ts（src/game/imports.mjs で読む。丸ごと入れ替えないので、名前はそのまま）
// 音量を次の段にする sndToggle は src/lib/screens.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- swamp gas
// ガスが広がる時の作業の配列 gasTmp は src/lib/state.ts の blaze（src/game/imports.mjs で読む）
// ---------------------------------------------------------------- fire (after Brogue: spreads through flammable terrain, ignites gas)
let sparkCD=0;
// FIRE_TYPES は src/lib/world.ts（src/game/imports.mjs で読む）
// initFire は src/lib/ground.ts（src/game/imports.mjs で読む）
// 火をつける ignite は src/lib/ground.ts（src/game/imports.mjs で読む）
// boom は src/lib/combat.ts（src/game/imports.mjs で読む）
// 火を1歩進める stepFire は src/lib/ground.ts（src/game/imports.mjs で読む）
// マスの火・灰・変わり方を描画に渡す uploadCells は src/lib/ground.ts（src/game/imports.mjs で読む）
// 火を描く drawFire は src/lib/fx.ts（src/game/imports.mjs で読む）
let sparks=3, sparkRegen=0; const SPARK_MAX=3;
function updateSparkHud(){ renderStatus(); }
function throwSpark(){
  if(sparks<=0){ showHint('火花を使い切った。少し待てば、また溜まる'); sparkCD=0.6; return; }
  sparks--; sparkRegen=0; updateSparkHud(); sWhoosh();
  const cp=Math.cos(player.pitch), dx=-Math.sin(player.yaw)*cp, dy=Math.sin(player.pitch), dz=-Math.cos(player.yaw)*cp;
  blaze.spark={x:gfx.camera.position.x+dx*0.4,y:gfx.camera.position.y-0.15+dy*0.4,z:gfx.camera.position.z+dz*0.4,vx:dx*13,vy:dy*13+2.2,vz:dz*13,t:0};
  sparkCD=0.6;
}
function updateSpark(dt){
  if(!blaze.spark)return;
  const s2=blaze.spark; s2.t+=dt; s2.vy-=9.8*dt;
  const nx=s2.x+s2.vx*dt, ny=s2.y+s2.vy*dt, nz=s2.z+s2.vz*dt;
  const cx=Math.floor(nx/CELL), cz=Math.floor(nz/CELL), i=cz*MW+cx;
  if(mr()<0.8)spawn(s2.x,s2.y,s2.z,(mr()-0.5)*0.4,(mr()-0.5)*0.4,(mr()-0.5)*0.4,0.5+mr()*0.4,G(mpick(['.','\''])),0.08,2.6,1.5,0.5,0);
  let hit=-1;
  if(cx<0||cz<0||cx>=MW||cz>=MH||s2.t>4){ blaze.spark=null; return; }
  if(here.D.tile[i]===TW||here.D.tile[i]===TX)hit=Math.floor(s2.z/CELL)*MW+Math.floor(s2.x/CELL);
  else if(ny<0.03&&here.D.tile[i]!==TC)hit=i;
  else if(ny>here.D.ceil[i])hit=i;
  if(hit<0){ s2.x=nx; s2.y=ny; s2.z=nz; return; }
  for(let q=0;q<12;q++){ const a=mr()*6.28; spawn(s2.x,Math.max(0.05,s2.y),s2.z,Math.cos(a)*1.2,0.4+mr()*1.2,Math.sin(a)*1.2,0.5+mr()*0.5,G(mpick(['*','.','\''])),0.12,3,1.6,0.5,0); }
  let lit=false;
  for(const j of [hit,hit+1,hit-1,hit+MW,hit-MW]){ if(j<0||j>=NCELL)continue; if(here.D.gas[j]>0.1){ ignite(j,1,true); boom(j); lit=true; } else if(blaze.fuel[j]>0&&j===hit){ ignite(j,0.6,false); lit=true; } }
  makeNoise(s2.x,s2.z,6,0.45);
  if(lit)sCrackleBurst(s2.x,s2.z);
  if(lit&&blaze.burning.length<4)msg('<b style="color:#ffb347">^</b>火花が燃え移り、炎が広がり始めた。');
  blaze.spark=null;
}
// initEvents は src/lib/levels.ts（src/game/imports.mjs で読む）
// cpos は src/lib/world.ts（src/game/imports.mjs で読む）
// 生き物を呼び出す summon は src/lib/monsters.ts（src/game/imports.mjs で読む）
// 部屋の出来事を進める updateEvents は src/lib/events.ts（src/game/imports.mjs で読む）

// 沼のガスを1歩進める stepGas は src/lib/ground.ts（src/game/imports.mjs で読む）
function updateGasPoints(t){
  let gi=0;
  if(blaze.gasAny){
    const pcx=Math.floor(player.x/CELL), pcz=Math.floor(player.z/CELL), RR=12, g=here.D.gas;
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
// respawnDust は src/lib/particles.ts（src/game/imports.mjs で読む）
// initDust は src/lib/particles.ts（src/game/imports.mjs で読む）
function riverFX(dt){
  if(!here.riverCells.length)return;
  for(let k=0;k<6&&mr()<dt*14;k++){
    const i=here.riverCells[Math.floor(mr()*here.riverCells.length)], x=(i%MW+0.2+mr()*0.6)*CELL, z=(((i/MW)|0)+0.2+mr()*0.6)*CELL;
    const lq=here.D.liquid[i]; if(Math.hypot(x-player.x,z-player.z)>18||(lq!==LQ_WATER&&lq!==LQ_DEEP))continue; // a river frozen or turned to lava has no ripples
    const a=here.D.flow[i]-10; spawn(x,0.12,z,Math.cos(a)*1.3,0.01,Math.sin(a)*1.3,2.2+mr(),G(mpick(['~','.','-'])),0.13,0.25,0.55,0.75,1);
  }
}
function updateParticles(dt,t){
  riverFX(dt);
  const px=player.x, pz=player.z;
  for(let i=0;i<DUST_N;i++){
    const ph=dust.ph[i];
    dust.x[i]+=Math.sin(t*0.31+ph)*0.13*dt; dust.z[i]+=Math.cos(t*0.27+ph*1.3)*0.13*dt; dust.y[i]+=(Math.sin(t*0.21+ph*2)*0.06+0.015)*dt;
    const dx=dust.x[i]-px, dz=dust.z[i]-pz;
    if(here.D.stratum.fall){ dust.y[i]-=(here.D.stratum.fall==='snow'?0.45:0.3)*dt; dust.x[i]+=Math.sin(t*0.7+ph)*0.2*dt; }
    if(dx*dx+dz*dz>16*16||dust.y[i]>ceilAt(dust.x[i],dust.z[i])-0.05||(here.D.stratum.fall&&dust.y[i]<0.05))respawnDust(i,false);
    const l=cellLight(dust.x[i],dust.z[i]);
    const dd=Math.hypot(dust.x[i]-px,dust.y[i]-EYE,dust.z[i]-pz), lan=Math.max(0,1-dd/7);
    const tw=0.5+0.5*Math.sin(t*(0.7+(ph%1)*1.3)+ph*9), k=(0.2+0.8*tw);
    const i3=i*3;
    ptPos[i3]=dust.x[i]; ptPos[i3+1]=dust.y[i]; ptPos[i3+2]=dust.z[i];
    ptCol[i3]=(0.012+l[0]*0.2+lan*lan*0.09)*k; ptCol[i3+1]=(0.01+l[1]*0.2+lan*lan*0.085)*k; ptCol[i3+2]=(0.026+l[2]*0.2+lan*lan*0.13)*k;
    ptSize[i]=dust.s[i]; ptGly[i]=dust.g[i];
  }
  for(let i=0;i<buf.pN;){
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
  const total=P0+buf.pN;
  ptGeo.setDrawRange(0,total);
  for(const [a,s] of [[bpPos,3],[bpCol,3],[bpSize,1],[bpGly,1]]){ a.updateRange.offset=0; a.updateRange.count=total*s; a.needsUpdate=true; }
}

