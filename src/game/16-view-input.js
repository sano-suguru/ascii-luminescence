// ---------------------------------------------------------------- field of view & minimap
function computeFOV(){
  here.fovStamp++;
  const ox=player.x/CELL, oz=player.z/CELL, pcF=Math.floor(oz)*MW+Math.floor(ox);
  for(let k=0;k<300;k++){
    const a=k/300*Math.PI*2, dx=Math.cos(a), dz=Math.sin(a);
    for(let s=0;s<18;s+=0.25){
      const x=ox+dx*s, z=oz+dz*s, cx=Math.floor(x), cz=Math.floor(z);
      if(cx<0||cz<0||cx>=MW||cz>=MH)break;
      const i=cz*MW+cx; here.fovVis[i]=here.fovStamp; here.explored[i]=1;
      const tt=here.D.tile[i]; if(tt===TW)break;
      if(s>0.9&&i!==pcF&&tallAt(i))break;
      if(tt===TP&&Math.hypot(x-cx-0.5,z-cz-0.5)<0.28)break;
      const di=here.D.doorAt[i]; if(di>=0&&i!==pcF&&!here.D.doors[di].gone&&here.D.doors[di].o<0.35&&s>0.3)break; // a door in the cell you stand in does not hide what is around you
    }
  }
}
const mapC=document.getElementById('map'), mctx=mapC.getContext('2d');
// MMC・MMR・MCW・MCH・MPAD は src/lib/hud.ts（src/game/imports.mjs で読む）
function sizeMap(){ const dpr=Math.min(2,window.devicePixelRatio||1); mapC.width=Math.round((MMC*MCW+MPAD*2)*dpr); mapC.height=Math.round((MMR*MCH+MPAD*2)*dpr); mctx.setTransform(dpr,0,0,dpr,0,0); }
sizeMap();
// tone は src/lib/hud.ts（src/game/imports.mjs で読む）
function drawMap(){
  const Wd=MMC*MCW+MPAD*2, Hd=MMR*MCH+MPAD*2;
  mctx.clearRect(0,0,Wd,Hd);
  mctx.fillStyle='rgba(3,2,10,0.6)'; mctx.fillRect(4,5,Wd-8,Hd-10);
  mctx.font='400 10px "JetBrains Mono",Menlo,Consolas,monospace'; mctx.textAlign='center'; mctx.textBaseline='middle'; mctx.fillStyle='rgba(120,108,200,0.6)';
  for(let x=11;x<Wd-8;x+=7){ mctx.fillText('-',x,5); mctx.fillText('-',x,Hd-5); }
  for(let y=14;y<Hd-9;y+=9){ mctx.fillText('|',4,y); mctx.fillText('|',Wd-4,y); }
  for(const [x,y] of [[4,5],[Wd-4,5],[4,Hd-5],[Wd-4,Hd-5]])mctx.fillText('+',x,y);
  const pcx=player.x/CELL, pcz=player.z/CELL;
  const ox=clamp(Math.floor(pcx)-(MMC>>1),0,MW-MMC), oy=clamp(Math.floor(pcz)-(MMR>>1),0,MH-MMR);
  const px=MPAD+(pcx-ox)*MCW, py=MPAD+(pcz-oy)*MCH;
  const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw), ang=Math.atan2(fz*MCH,fx*MCW);
  const grad=mctx.createRadialGradient(px,py,3,px,py,120);
  grad.addColorStop(0,'rgba(150,205,255,0.22)'); grad.addColorStop(1,'rgba(150,205,255,0)');
  mctx.fillStyle=grad; mctx.beginPath(); mctx.moveTo(px,py); mctx.arc(px,py,120,ang-0.62,ang+0.62); mctx.closePath(); mctx.fill();
  mctx.font='700 12px "JetBrains Mono",Menlo,Consolas,monospace'; mctx.textAlign='center'; mctx.textBaseline='middle';
  for(let r=0;r<MMR;r++)for(let c=0;c<MMC;c++){
    const x=ox+c, y=oy+r, i=y*MW+x; if(!here.explored[i])continue;
    const tt=here.D.tile[i]; let ch, b0,b1,b2;
    const fxc=here.D.fixCell.get(i), dc=fxc?null:here.D.decoCell.get(i);
    if(fxc){ ch=fxc.ch; b0=fxc.col[0]*1.4+0.3; b1=fxc.col[1]*1.4+0.3; b2=fxc.col[2]*1.4+0.3; }
    else if(dc){ ch=dc.ch; b0=dc.col[0]; b1=dc.col[1]; b2=dc.col[2]; }
    else if(tt===TW&&here.D.vein[i]){ ch=here.D.vein[i]===1?'$':'*'; const vc=VEIN_COL[here.D.vein[i]]; b0=vc[0];b1=vc[1];b2=vc[2]; }
    else if(tt===TW){ ch='#'; b0=0.72;b1=0.7;b2=1.0; }
    else if(tt===TP){ ch='0'; b0=0.8;b1=0.78;b2=1.0; }
    else if(tt===TC){ ch=':'; b0=0.42;b1=0.26;b2=0.7; }
    else if(tt===TX){ ch='#'; const xc=here.D.xtalCol.get(i)||[0.6,0.85,1.0]; b0=xc[0]*1.2;b1=xc[1]*1.2;b2=xc[2]*1.2; }
    else if(here.D.bridge[i]){ ch='='; b0=0.85;b1=0.62;b2=0.4; }
    else if(here.D.liquid[i]===LQ_DEEP){ ch='~'; b0=0.2;b1=0.34;b2=0.85; }
    else if(here.D.liquid[i]===LQ_BOG){ ch='~'; b0=0.55;b1=0.6;b2=0.28; }
    else if(here.D.surface[i]===SF_ICE){ ch='='; b0=0.7;b1=0.9;b2=1.1; }
    else if(here.D.surface[i]===SF_RUBBLE&&!here.D.liquid[i]){ ch=','; b0=0.7;b1=0.58;b2=0.48; }
    else if(here.D.surface[i]===SF_DEAD){ ch='"'; b0=0.65;b1=0.52;b2=0.32; }
    else if(blaze.fire[i]>0.05){ ch='^'; b0=2.2;b1=1.0;b2=0.3; }
    else if(here.D.pit&&here.D.pit[i]){ ch=':'; b0=1.0;b1=0.5;b2=0.25; }
    else if(here.D.doorAt[i]>=0&&here.D.doors[here.D.doorAt[i]].gone){ ch=','; b0=0.35;b1=0.32;b2=0.32; }
    else if(blaze.burnt[i]&&tt===TF&&!here.D.liquid[i]){ ch=','; b0=0.38;b1=0.35;b2=0.36; }
    else if(here.D.doorAt[i]>=0){ ch=here.D.doors[here.D.doorAt[i]].o>0.5?"'":'+'; b0=0.95;b1=0.66;b2=0.38; }
    else if(here.D.liquid[i]===LQ_LAVA){ ch='~'; b0=1.3;b1=0.45;b2=0.12; }
    else if(here.D.liquid[i]===LQ_WATER){ ch='~'; b0=0.35;b1=0.68;b2=1.0; }
    else if(here.D.surface[i]===SF_OBSIDIAN){ ch=','; b0=0.6;b1=0.35;b2=0.35; }
    else if(here.D.surface[i]===SF_FOLIAGE||here.D.surface[i]===SF_FUNGFOR){ const t2=blaze.cellFlag[i]===20; ch=t2?',':'"'; if(here.D.surface[i]===SF_FUNGFOR){b0=0.5;b1=0.9;b2=1.0;} else {b0=0.3;b1=t2?0.6:0.85;b2=0.3;} }
    else if(here.D.surface[i]===SF_BRIM){ ch='*'; b0=1.0;b1=0.82;b2=0.3; }
    else if(here.D.surface[i]===SF_MUD){ ch='~'; b0=0.55;b1=0.4;b2=0.25; }
    else if(here.D.surface[i]===SF_HAY){ ch='"'; b0=0.95;b1=0.8;b2=0.4; }
    else if(here.D.surface[i]===SF_GRASS||here.D.surface[i]===SF_LUMEN){ ch='"'; b0=0.35;b1=0.95;b2=here.D.surface[i]===SF_LUMEN?0.85:0.55; }
    else { ch='.'; b0=0.68;b1=0.68;b2=0.9; }
    let r0,g0,bl;
    if(here.fovVis[i]===here.fovStamp){
      const l=cellLight((x+0.5)*CELL,(y+0.5)*CELL);
      const d=Math.hypot(x+0.5-pcx,y+0.5-pcz)*CELL, lan=Math.max(0,1-d/lantern.r); const lw=lan*lan*0.75*lantern.k;
      const e=(fxc||here.D.liquid[i]===LQ_LAVA)?1.0:tt===TX?0.7:dc?0.32:0.16;
      r0=b0*(e+l[0]*0.85+lw*LANTERN[0]); g0=b1*(e+l[1]*0.85+lw*LANTERN[1]); bl=b2*(e+l[2]*0.85+lw*LANTERN[2]);
      here.mem[i*3]=r0; here.mem[i*3+1]=g0; here.mem[i*3+2]=bl;
    } else {
      const m0=here.mem[i*3], m1=here.mem[i*3+1], m2=here.mem[i*3+2], avg=(m0+m1+m2)/3;
      r0=(m0*0.4+avg*0.6)*0.32+0.035; g0=(m1*0.4+avg*0.6)*0.32+0.035; bl=(m2*0.4+avg*0.6)*0.36+0.085;
    }
    const gv=here.D.gas[i]; if(gv>0.08&&here.fovVis[i]===here.fovStamp){ mctx.fillStyle=`rgba(120,190,60,${Math.min(0.4,gv*0.45).toFixed(2)})`; mctx.fillRect(MPAD+c*MCW,MPAD+r*MCH,MCW,MCH); }
    mctx.fillStyle=`rgb(${tone(r0)},${tone(g0)},${tone(bl)})`;
    mctx.fillText(ch,MPAD+(c+0.5)*MCW,MPAD+(r+0.5)*MCH);
  }
  mctx.shadowBlur=8;
  for(const it of (here.D.items||[])){ if(it.taken||!here.explored[it.i])continue; if(!it.rune)continue; const tc=TIER_COL[0], c=it.i%MW-ox, r=((it.i/MW)|0)-oy; if(c<0||r<0||c>=MMC||r>=MMR)continue; mctx.shadowColor=css(tc); mctx.fillStyle=css(tc); mctx.fillText('*',MPAD+(c+0.5)*MCW,MPAD+(r+0.5)*MCH); }
  for(const tr of (here.D.traps||[])){ if(tr.hidden||!here.explored[tr.i])continue; const c=tr.i%MW-ox, r=((tr.i/MW)|0)-oy; if(c<0||r<0||c>=MMC||r>=MMR)continue; mctx.shadowColor=TRAP_INFO[tr.type][1]; mctx.fillStyle=TRAP_INFO[tr.type][1]; mctx.fillText('^',MPAD+(c+0.5)*MCW,MPAD+(r+0.5)*MCH); }
  if(here.D.gate){ for(const [ci,chr] of [[here.D.gate.cell,here.D.gate.open?'.':'#'],[here.D.gate.lever,'/']]){ if(!here.explored[ci])continue; const c=ci%MW-ox, r=((ci/MW)|0)-oy; if(c<0||r<0||c>=MMC||r>=MMR)continue; mctx.shadowColor='#ffd48a'; mctx.fillStyle='#ffd48a'; mctx.fillText(chr,MPAD+(c+0.5)*MCW,MPAD+(r+0.5)*MCH); } }
  for(const w of (here.D.webs||[])){ if(w.gone||!here.explored[w.i])continue; const c=w.i%MW-ox, r=((w.i/MW)|0)-oy; if(c<0||r<0||c>=MMC||r>=MMR)continue; mctx.shadowColor='#d8c8ff'; mctx.fillStyle='rgba(216,200,255,0.8)'; mctx.fillText('%',MPAD+(c+0.5)*MCW,MPAD+(r+0.5)*MCH); }
  for(const m of here.monsters){
    const ghost=m.ty.invisible&&Math.hypot(m.x-player.x,m.z-player.z)<6;
    if(!m.visible&&!ghost)continue;
    const c=m.cx-ox, r=m.cz-oy; if(c<0||r<0||c>=MMC||r>=MMR)continue;
    const col=ghost?[0.25,0.3,0.4]:m.hidden?[1.0,0.82,0.42]:m.ty.col; mctx.shadowColor=css(col); mctx.fillStyle=css(col);
    mctx.fillText(m.hidden?'?':m.ty.ch,MPAD+(m.x/CELL-ox)*MCW,MPAD+(m.z/CELL-oy)*MCH);
  }
  mctx.shadowColor='rgba(255,255,255,0.9)'; mctx.fillStyle='#ffffff'; mctx.shadowBlur=10;
  mctx.font='800 13px "JetBrains Mono",Menlo,Consolas,monospace';
  mctx.fillText('@',px,py);
  mctx.shadowBlur=0;
  mctx.fillStyle='rgba(170,220,255,0.95)';
  const tx=px+Math.cos(ang)*11, ty=py+Math.sin(ang)*11;
  mctx.beginPath(); mctx.moveTo(tx+Math.cos(ang)*4,ty+Math.sin(ang)*4);
  mctx.lineTo(tx+Math.cos(ang+2.4)*3.5,ty+Math.sin(ang+2.4)*3.5); mctx.lineTo(tx+Math.cos(ang-2.4)*3.5,ty+Math.sin(ang-2.4)*3.5); mctx.closePath(); mctx.fill();
}

// ---------------------------------------------------------------- messages
// 伝言を出す msg と描き直す renderLog は src/lib/log.ts（src/game/imports.mjs で読む）、伝言の一覧 msgs は src/lib/state.ts
setInterval(renderLog,1000);

// ---------------------------------------------------------------- collisions
let blockType='';
function solidAt(x,z,r){
  const x0=Math.floor((x-r)/CELL), x1=Math.floor((x+r)/CELL), z0=Math.floor((z-r)/CELL), z1=Math.floor((z+r)/CELL);
  for(let cz=z0;cz<=z1;cz++)for(let cx=x0;cx<=x1;cx++){
    if(cx<0||cz<0||cx>=MW||cz>=MH){ blockType='wall'; return true; }
    if(here.D.gate&&here.D.gate.o<0.7&&cz*MW+cx===here.D.gate.cell){ const nx=clamp(x,cx*CELL,(cx+1)*CELL), nz=clamp(z,cz*CELL,(cz+1)*CELL); if((x-nx)**2+(z-nz)**2<r*r){ blockType='gate'; return true; } }
    const tt=here.D.tile[cz*MW+cx];
    const lqc=here.D.liquid[cz*MW+cx];
    if(tt===TW||(tt===TC&&!(here.D.pit&&here.D.pit[cz*MW+cx]))||tt===TX||lqc===LQ_LAVA){ const nx=clamp(x,cx*CELL,(cx+1)*CELL), nz=clamp(z,cz*CELL,(cz+1)*CELL); if((x-nx)**2+(z-nz)**2<r*r){ blockType=tt===TC?'chasm':tt===TX?'xtal':lqc===LQ_LAVA?'lava':'wall'; return true; } }
    else if(tt===TP){ if(Math.hypot(x-(cx+0.5)*CELL,z-(cz+0.5)*CELL)<0.55+r){ blockType='wall'; return true; } }
    else { const sr=here.D.solid.get(cz*MW+cx); if(sr&&Math.hypot(x-(cx+0.5)*CELL,z-(cz+0.5)*CELL)<sr+r){ blockType='wall'; return true; } }
  }
  return false;
}

// ---------------------------------------------------------------- input
// keys は src/lib/state.ts（src/game/imports.mjs で読む。丸ごと入れ替えないので、名前はそのまま）
let dragging=false, lmx=0, lmy=0;
const introEl=document.getElementById('intro');
// マウスを捕まえる tryLock・失敗した時 lockFailed・外れた時にメニューを開くか menuOnUnlock・「クリックで視点操作に戻る」の一言 updateResume は src/lib/screens.ts、捕まえられないと決めたか ui.plFailed・一度でも捕まえたか ui.lockedOnce・最後に捕まえてから捕まえようとした回数 ui.lockTries・最後に外れた時刻 ui.unlockedAt は src/lib/state.ts（src/game/imports.mjs で読む）
document.addEventListener('pointerlockchange',()=>{ const was=ui.locked; ui.locked=document.pointerLockElement===canvas; if(ui.locked){ ui.lockedOnce=true; ui.lockTries=0; } else if(was)ui.unlockedAt=performance.now(); if(ui.locked&&ui.menuOpen)setMenu(false); if(menuOnUnlock(was))setMenu(true); updateResume(); });
document.addEventListener('pointerlockerror',lockFailed);
let startDepth=1;
