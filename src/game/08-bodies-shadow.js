// ---------------------------------------------------------------- the Last King's Shadow: a king made of darkness, dark inside, only its edges thin and white like cut paper;
// a crown of broken light floating above a hollow face with one cold light, six arms of shadow reaching out, its hem dissolving into streams that run to the pedestals
// streams of shadow running from its hem across the floor to the pedestals; dark mist
function shadowAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>40)return;
  if(!m.phase2&&m.maxHp&&m.hp/m.maxHp<0.95&&mr()<(1-m.hp/m.maxHp)*0.6){ const a=mr()*6.28, y=(0.4+mr()*1.4)*sc; spawn(m.x+Math.cos(a)*0.55*sc,y,m.z+Math.sin(a)*0.45*sc,Math.cos(a)*0.4,0.3,Math.sin(a)*0.4,1.4,G(mpick(['.','+','*'])),0.14,1.4,1.5,2.2,0); }
  const targets=(finalSt&&finalSt.peds&&isFinal())?finalSt.peds.map(p=>cpos(p.i)):[0,1,2].map(k=>{ const a=k/3*Math.PI*2+0.5; return [m.x+Math.cos(a)*4.5*sc,m.z+Math.sin(a)*4.5*sc]; });
  for(const [tx,tz] of targets){ const dx=tx-m.x, dz=tz-m.z, L=Math.hypot(dx,dz)||1, ux=dx/L, uz=dz/L, n=Math.round(L/0.35);
    for(let k=2;k<n;k++){ const f=k/n, w=Math.sin(f*9-t*2.2)*0.22, x=m.x+dx*f-uz*w, z=m.z+dz*f+ux*w, edge=(k+Math.floor(t*6))%5===0;
      dyn(x,0.05,z,G(edge?'.':'~'),0.2,edge?0.75:0.24,edge?0.72:0.16,edge?0.95:0.4); } }
  if(mr()<0.2){ const a=mr()*6.28, r=mr()*0.9*sc; spawn(m.x+Math.cos(a)*r,0.2,m.z+Math.sin(a)*r,Math.cos(a)*0.2,0.25,Math.sin(a)*0.2,2.6,G(mpick(['~','%'])),0.26,0.16,0.1,0.26,0); } }

// shadowKingForm・KRAKEN_T・KRAKEN_W など 6 個は src/lib/bodies/lords.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）
// BRASS・BRASS_R・mPut・mLit は src/lib/bodies/kit.ts（古い JS は使わない。src/lib/ の生成などが使う）
// shadowSerpentForm（王の影の二つ目の姿）は src/lib/bodies/bosses.ts（src/game/imports.mjs で読む）
// the change: the seal breaks; the glyphs of the first form flow into the shape of the second over 2.5 s
function transformShadow(b){
  const R=HIST.rulers, last=R[R.length-1];
  b.phase2=true; b.invulnT=2.5; sRumble(1.0,3.2); vfx.shake=Math.max(vfx.shake,0.8); vfx.flash=Math.max(vfx.flash,0.5);
  const sc=b.ty.scale||3;
  for(let q=0;q<60;q++){ const a=mr()*6.28; spawn(b.x+Math.cos(a)*0.3,2.8*sc,b.z+Math.sin(a)*0.3,Math.cos(a)*3,2+mr()*3,Math.sin(a)*3,1.6+mr(),G(mpick(['/','\\','<','>','^'])),0.28,2.6,2.5,3.0,0); }
  for(let q=0;q<70;q++){ const a=mr()*6.28, r=mr()*0.9*sc; spawn(b.x+Math.cos(a)*r,0.5+mr()*1.8*sc,b.z+Math.sin(a)*r,Math.cos(a)*0.6,-0.4-mr(),Math.sin(a)*0.6,2.2,G(mpick(['%','#','~'])),0.3,0.3,0.22,0.5,1); }
  if(sndReady()){ const t0=SND.ctx.currentTime, o=sOut(b.x,b.z,0.3); for(const f of [55,82.5,110,164.8])sEnv(sTone(t0,'sawtooth',f,f*0.97,3.5,o),t0,0.4,3,0.25); }
  const from=b.form.filter(p=>p.part!=='crack'&&p.part!=='heart');
  MTYPES.final2={...b.ty,form:'shadowserpent',sk:'final2',speed:(b.ty.speed||0.8)*1.35,verb:'封印が破れ、底の闇から長い体をもたげた影'};
  b.ty=MTYPES.final2; b.form=buildForm(b.ty); b.morph={from,t0:time,dur:2.5};
  msg(`<b style="color:#a98cff">&amp;</b>王の姿が砕け、封じられていた闇があふれ出した。`);
  setTimeout(()=>msg(`<b style="color:#a98cff">&amp;</b>${last.title}${last.name}の影が、底の闇から長い体をもたげた。`),1500);
}
// drawing the change: each glyph of the second form flies from a glyph of the first
function drawMorph(m,t){ const M=m.morph, f=clamp((time-M.t0)/M.dur,0,1); if(f>=1){ m.morph=null; return false; }
  const e=f<0.5?2*f*f:1-Math.pow(-2*f+2,2)/2, sc=m.ty.scale, cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), F=M.from, n=F.length;
  for(let i=0;i<m.form.length;i++){ const p=m.form[i]; if(p.part==='heart')continue; const q=F[(i*7)%n];
    const lx=(q.x+(p.x-q.x)*e)*sc, ly=(q.y+(p.y-q.y)*e)*sc+Math.sin(f*Math.PI)*0.3*sc*Math.sin(i), lz=(q.z+(p.z-q.z)*e)*sc, col=p.col||m.ty.col, k=(f<0.5?q.b:p.b)*0.62*(0.8+0.6*Math.sin(f*Math.PI));
    dyn(m.x+lx*cy+lz*sy,m.y+ly,m.z-lx*sy+lz*cy,f<0.5?q.g:p.g,(f<0.5?q.s:p.s)*sc,col[0]*k,col[1]*k,col[2]*k,0,0); }
  return true; }

// ---------------------------------------------------------------- the Lord of the Depths (rebuilt): a tall domed head rising from churning water, a ridge down its face,
// many small red eyes in pairs and a diamond eye on the brow, a fringe of short tentacles hanging from the mouth into the water,
// eight tentacles - two rising above the head and hooking over it, two arching out to the sides, two curling up toward you, two behind - suckers on the inside of each curl;
// two broken temple pillars stuck in its back
// 水面から出る10本の触手も、KRAKEN_T・KRAKEN_W に入っている（src/lib/bodies/lords.ts）
function deepKrakenForm(){
  const pts=[], S=0.08, LD=[0.42,0.72,0.55];
  const COL={skin:[0.36,0.5,0.62], dark:[0.2,0.26,0.36], stone:[0.64,0.66,0.6], moss:[0.42,0.72,0.4], eye:[1.0,0.32,0.24], sucker:[0.7,0.85,0.95], ridge:[0.6,0.72,0.85]};
  const RAMP={skin:['.',':','~','%','#']};
  const put=(x,y,z,nx,ny,nz,part,extra)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=RAMP.skin;
    pts.push(Object.assign({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:S,b:0.45+0.95*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col:COL.skin},extra||{})); };
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const spline=(ctrl,step)=>{ const out=[]; for(let i=0;i<ctrl.length-1;i++)for(let t=0;t<1;t+=step){ const a=ctrl[Math.max(0,i-1)], b=ctrl[i], c=ctrl[i+1], d=ctrl[Math.min(ctrl.length-1,i+2)], t2=t*t, t3=t2*t;
      out.push([0,1,2].map(k=>0.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3))); } out.push(ctrl[ctrl.length-1]); return out; };
  // 1. the head: a neck rising from the water into a tall dome
  // a broad neck at the water, a big bulbous dome leaning a little back
  const hr=y=>y<1.25?0.66-0.06*Math.min(1,y/1.25):0.62*Math.sqrt(Math.max(0,1-Math.pow((y-1.25)/0.95,2)))+0.02, hl=y=>0.14*Math.max(0,y-1.1);
  const fz=y=>hr(y)*0.92-hl(y);
  for(let y=0.05;y<2.22;y+=0.12){ const r=hr(y), n=Math.max(6,Math.round(2*Math.PI*r/0.13));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); if(nz>0.82&&y>0.95&&y<1.75)continue; put(nx*r,y,nz*r*0.92-hl(y),nx,y>1.25?(y-1.25)/0.97:0.15,nz,'head'); } }
  // the face: a ridge down the middle, brow folds, the eyes in pairs, a diamond eye on the brow
  for(let y=1.0;y<2.05;y+=0.08)lit(0,y,fz(y)+0.02,'|',S*1.05,1.7,COL.ridge,'head');
  for(const sd of [1,-1])for(let k=0;k<4;k++){ const y=1.62-k*0.16; lit(sd*0.22,y,fz(y)-0.03,sd>0?'(':')',S*1.1,0.9,COL.dark,'head'); lit(sd*0.36,y-0.04,fz(y)-0.1,sd>0?'(':')',S,0.8,COL.dark,'head'); }
  for(const [y,x] of [[1.38,0.11],[1.24,0.145],[1.1,0.1]])for(const sd of [1,-1]){ lit(sd*x,y,fz(y)-0.01,'(',S*0.9,0.5,COL.dark,'head'); lit(sd*x,y,fz(y)+0.01,'*',S*1.2,4.4,COL.eye,'eye'); }
  lit(-0.03,1.62,fz(1.62)+0.01,'<',S,3.6,COL.eye,'eye'); lit(0.03,1.62,fz(1.62)+0.01,'>',S,3.6,COL.eye,'eye');
  // a fringe of short tentacles from the mouth into the water
  for(let k=0;k<8;k++){ const f=(k/7-0.5), x0=f*0.38, z0=fz(0.95)-Math.abs(f)*0.1; for(let q=0;q<9;q++){ const t=q/8; lit(x0+Math.sin(t*3+k)*0.05,0.95-t*0.85,z0+t*0.12,t>0.85?'~':(q%2?')':'('),S*0.95,1.0,COL.skin,'tent',{piv:q,ti:k+10}); } }
  // 2. two broken temple pillars in its back, moss on them
  for(const [x,z,h,lean] of [[-0.27,-0.52,0.9,-0.25],[0.24,-0.5,0.7,0.2]]){ for(let y=0;y<h;y+=0.1)lit(x+lean*y*0.4,1.4+y,z-y*0.25,'|',S*1.15,1.1,COL.stone,'head'); lit(x+lean*h*0.4,1.4+h,z-h*0.25,mpick(['%','#']),S*1.2,1.1,COL.stone,'head'); lit(x,1.5,z+0.02,mpick([',','"']),S,1.2,COL.moss,'head'); }
  // 3. eight tentacles, suckers on the inside of each curl
  KRAKEN_T.forEach((ctrl,ti)=>{ const P=spline(ctrl,ti<4?0.12:0.15), N=P.length, W0=KRAKEN_W[ti]||0.15;
    for(let i=1;i<N-1;i++){ const a=P[i], f=i/(N-1), w=W0*(1-f*0.84), tx=P[i+1][0]-P[i-1][0], ty=P[i+1][1]-P[i-1][1], tz=P[i+1][2]-P[i-1][2], tl=Math.hypot(tx,ty,tz)||1;
      let cx=P[i+1][0]-2*a[0]+P[i-1][0], cy=P[i+1][1]-2*a[1]+P[i-1][1], cz=P[i+1][2]-2*a[2]+P[i-1][2]; const dot=(cx*tx+cy*ty+cz*tz)/tl; cx-=dot*tx/tl; cy-=dot*ty/tl; cz-=dot*tz/tl; let cl=Math.hypot(cx,cy,cz); if(cl<1e-4){ cx=0; cy=-1; cz=0; cl=1; } cx/=cl; cy/=cl; cz/=cl;
      const bx=(ty*cz-tz*cy)/tl, by=(tz*cx-tx*cz)/tl, bz=(tx*cy-ty*cx)/tl, n=Math.max(5,Math.round(2*Math.PI*w/(ti<4?0.13:0.15)));
      for(let k=0;k<n;k++){ const an=k/n*Math.PI*2, ox=Math.cos(an)*cx+Math.sin(an)*bx, oy=Math.cos(an)*cy+Math.sin(an)*by, oz=Math.cos(an)*cz+Math.sin(an)*bz; if(a[1]+oy*w<0.02)continue;
        if(Math.cos(an)>0.75){ if(i%2===0)lit(a[0]+ox*w,a[1]+oy*w,a[2]+oz*w,'o',S*(0.7+0.5*(1-f)),1.7,COL.sucker,'tent',{piv:i*0.45,ti}); }
        else put(a[0]+ox*w,a[1]+oy*w,a[2]+oz*w,ox,oy,oz,'tent',{piv:i*0.45,ti}); } }
    const e=P[N-1]; lit(e[0],e[1],e[2],'~',S,1.4,COL.skin,'tent',{piv:N*0.45,ti}); });
  return pts;
}
// its water: churning foam round the head and where the tentacles break the surface, rings of waves, the drowned temple's lights
function krakenAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>36)return; const cy=Math.cos(m.yaw), sy=Math.sin(m.yaw);
  const at=(lx,lz)=>[m.x+(lx*cy+lz*sy)*sc,m.z+(-lx*sy+lz*cy)*sc];
  for(let q=0;q<26;q++){ const a=q/26*Math.PI*2+t*0.2, r=0.62+0.06*Math.sin(t*3+q), p=at(Math.cos(a)*r,Math.sin(a)*r); dyn(p[0],0.08+0.05*Math.abs(Math.sin(t*2.4+q)),p[1],G(q%3?'~':'^'),0.15,0.75,0.85,0.95); }
  KRAKEN_T.forEach((c,k)=>{ const b=c[0], rr=0.18+0.06*Math.sin(t*1.5+k); for(let q=0;q<9;q++){ const a=q/9*Math.PI*2, p=at(b[0]+Math.cos(a)*rr,b[2]+Math.sin(a)*rr); dyn(p[0],0.07,p[1],G(q%2?'~':'^'),0.13,0.6,0.75,0.85); } });
  for(let k=0;k<3;k++){ const rr=(1.0+k*0.45+0.1*Math.sin(t+k))*sc, n=Math.round(rr*10); for(let q=0;q<n;q++){ const b=q/n*Math.PI*2+t*0.05*(k%2?1:-1); dyn(m.x+Math.cos(b)*rr,0.05,m.z+Math.sin(b)*rr,G('~'),0.13,0.18,0.38,0.5); } }
  if(!m.lamps){ m.lamps=[]; for(let k=0;k<6;k++){ const a=mr()*6.28, r=(2.4+mr()*1.2)*sc; m.lamps.push([m.x+Math.cos(a)*r,m.z+Math.sin(a)*r,mr()*6]); } }
  for(const L of m.lamps){ const b=0.6+0.4*Math.sin(t*0.9+L[2]); dyn(L[0],0.12+0.04*Math.sin(t+L[2]),L[1],G('*'),0.2,1.2*b,0.95*b,0.5*b); }
  if(mr()<0.12){ const c=KRAKEN_T[Math.floor(mr()*KRAKEN_T.length)][0], p=at(c[0],c[2]); for(let q=0;q<6;q++)spawn(p[0],0.1,p[1],(mr()-0.5)*1.2,1+mr()*1.5,(mr()-0.5)*1.2,0.8,G(mpick(['\'','.',','])),0.14,0.7,0.85,0.95,1); } }

// the hounds' trails: sparks behind the fire hound, frozen breath from the ice hound, afterimages behind the light hound
function houndAura(m,t){ const sc=m.ty.scale||1, mv=m.moving||0, h=m.ty.hound, cy=Math.cos(m.yaw), sy=Math.sin(m.yaw);
  if(Math.hypot(m.x-player.x,m.z-player.z)>26)return;
  if(h==='fire'&&mv>0.3&&mr()<0.12){ const lz=-0.35*sc; spawn(m.x+lz*sy+(mr()-0.5)*0.2,0.06,m.z+lz*cy+(mr()-0.5)*0.2,(mr()-0.5)*0.2,0.4+mr()*0.5,(mr()-0.5)*0.2,0.4,G(mpick(['\'','.'])),0.09,2.6,1.2,0.35,0); }
  if(h==='ice'&&mr()<0.12){ const lz=0.68*sc; const ice=mr()<0.15; spawn(m.x+lz*sy+(mr()-0.5)*0.1,m.y+0.58*sc,m.z+lz*cy+(mr()-0.5)*0.1,sy*0.18,-0.12,cy*0.18,1.6,G(ice?'*':mpick(['~','.'])),ice?0.08:0.18,ice?1.5:0.62,ice?1.8:0.86,ice?2.1:1.2,0); }
  if(h==='light'){ m.ghosts=m.ghosts||[]; if(mv>0.3&&time-(m.ghostT||0)>0.12){ m.ghostT=time; m.ghosts.push({x:m.x,y:m.y,z:m.z,yaw:m.yaw,t:time}); if(m.ghosts.length>3)m.ghosts.shift(); }
    for(const gh of m.ghosts){ const age=time-gh.t; if(age>0.5)continue; const k=(1-age/0.5)*0.5, c2=Math.cos(gh.yaw), s2=Math.sin(gh.yaw);
      for(let i=0;i<m.form.length;i+=2){ const p=m.form[i]; if(p.part==='orbit')continue; const lx=p.x*sc, ly=p.y*sc, lz=p.z*sc; dyn(gh.x+lx*c2+lz*s2,gh.y+ly,gh.z-lx*s2+lz*c2,p.g,p.s*sc,1.0*k,0.95*k,0.75*k,0,0); } } } }
