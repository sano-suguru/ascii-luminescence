// ---------------------------------------------------------------- monsters
// ---------------------------------------------------------------- the forgotten beast (after Dwarf Fortress): the beast of this world's chronicle, built from its description
// BONE・PALE は src/lib/bodies/kit.ts（src/game/imports.mjs で読む）
// hsl2rgb は src/lib/color.ts、GOLD は src/lib/bodies/kit.ts（古い JS は使わない。src/lib/ の生成などが使う）
// beastForm・golemForm・HUM_PROP・LOOK_PROP は src/lib/bodies/lords.ts（src/game/imports.mjs で読む）
// makeBeastType（忘れられた獣の種類）は src/lib/bodies/lords.ts

// trollForm は src/lib/bodies/small.ts（src/game/imports.mjs で読む）
// ---------------------------------------------------------------- each creature's own features on the shared bodies (kept short: proportions and a few held things)
function lookHumanoid(look,pts,add,L){
  const mv=(parts,f)=>{ for(const p of pts)if(parts.includes(p.part))f(p); };
  if(look==='kobold'){ for(const sd of [-1,1])add(sd*0.13,1.72,0,'^',0.13,1.4,'head');
    for(let k=0;k<10;k++)add(0.33,0.35+k*0.17,0.05,k===9?'^':'|',0.13,k===9?2.2:1.0,'armR',1.36); }
  else if(look==='goblin'){ for(const sd of [-1,1])add(sd*0.25,1.56,-0.02,sd<0?'<':'>',0.13,1.3,'head'); add(0.36,0.8,0.14,'-',0.14,1.7,'armR',1.36); }
  else if(look==='snapjaw'){ mv(['head','core'],p=>{ p.z+=0.06; }); for(let k=0;k<4;k++)add(0,1.46,0.2+k*0.07,mpick(['=','>']),0.12,1.2,'head');
    for(let k=0;k<5;k++)add(0,1.72-k*0.1,-0.14-k*0.02,'^',0.12,1.1,'head'); }
  else if(look==='monkey'){ mv(['head','core','body'],p=>{ p.z+=0.18*Math.max(0,(p.y-0.9))/0.7; p.y-=0.12; });
    mv(['armL','armR'],p=>{ p.y=p.piv-(p.piv-p.y)*1.6; });
    for(let k=0;k<8;k++){ const a=k/7*Math.PI; add(0,0.72+Math.sin(a)*0.42,-0.2-k*0.07,mpick(['~','s','(']),0.11,1.0,'tail',k*0.6); } }
  else if(look==='conjurer'){ for(let i=pts.length-1;i>=0;i--)if(pts[i].part==='legL'||pts[i].part==='legR')pts.splice(i,1);
    for(let y=0.08;y<0.95;y+=0.13){ const r=0.36-(y/0.95)*0.14, n=9; for(let j=0;j<n;j++){ const a=j/n*Math.PI*2; add(Math.cos(a)*r,y,Math.sin(a)*r*0.8,mpick(['/','\\','|',L]),0.14,0.95,'robe'); } }
    for(let k=0;k<11;k++)add(0.4,0.1+k*0.18,0.1,'|',0.12,0.9,'armR',1.36); add(0.4,2.08,0.1,'*',0.22,3.2,'armR',1.36);
    for(const [dx,dy] of [[-0.1,1.72],[0,1.8],[0.1,1.72]])add(dx,dy,-0.02,'^',0.12,1.2,'head'); }
  else if(look==='ogre'){ mv(['body','head','core'],p=>{ p.x*=1.35; p.z*=1.3; }); mv(['armL','armR'],p=>{ p.x*=1.3; });
    for(let k=0;k<7;k++)add(0.47+(mr()-0.5)*0.12,0.6+k*0.05,0.12+(mr()-0.5)*0.12,mpick(['#','%','@']),0.17,1.1,'armR',1.36); }
  else if(look==='gnome'){ for(let k=0;k<5;k++){ const r=0.16-k*0.03, n=Math.max(1,6-k); for(let j=0;j<n;j++){ const a=j/n*Math.PI*2; add(Math.cos(a)*r,1.66+k*0.09,Math.sin(a)*r,k===4?'^':'A',0.12,1.2,'head'); } }
    for(let k=0;k<4;k++)add((k-1.5)*0.05,1.36,0.15,'"',0.11,1.1,'head'); }
}
// body proportions by kind: the hip, the shoulder and the head are moved, everything between follows (held things included)
function shapeHumanoid(pts,look){ const P=HUM_PROP[LOOK_PROP[look]||'base'];
  const map=y=>y<=0.86?y*(P.hip/0.86):P.hip+(y-0.86)*((P.sh-P.hip)/(1.37-0.86));
  for(const p of pts){ const head=p.part==='head'||p.part==='core';
    if(head){ p.y=P.hc+(p.y-1.5)*P.hk; p.x*=P.hk; p.z*=P.hk; } else p.y=map(p.y);
    if(p.piv&&(p.part.startsWith('arm')||p.part.startsWith('leg')))p.piv=map(p.piv);
    if(P.legW&&p.part.startsWith('leg'))p.x*=P.legW;
    if(P.lean&&!p.part.startsWith('leg')){ const k=Math.max(0,(p.y-P.hip)/(P.hc-P.hip)); p.z+=P.lean*k; } } }
function lookQuad(look,pts,add,L){
  const mv=(parts,f)=>{ for(const p of pts)if(parts.includes(p.part))f(p); };
  const legStretch=(top,k)=>mv(['legL','legR'],p=>{ p.y=top-(p.piv-p.y)*k; p.piv=top; });
  if(look==='rat'){ mv(['body','head','core','tail'],p=>{ p.y*=0.72; }); legStretch(0.27,0.75);
    for(let k=3;k<9;k++)add(0,0.33-k*0.02,-0.42-k*0.12,mpick(['~','-']),0.09,0.85,'tail',k); }
  else if(look==='jackal'){ mv(['body','head','core','tail'],p=>{ p.y+=0.14; }); legStretch(0.5,1.4);
    for(const sd of [-1,1])add(sd*0.07,0.86,0.42,'^',0.11,1.3,'head'); }
  else if(look==='grazer'){ mv(['head','core'],p=>{ p.y-=0.14; p.z+=0.06; });
    for(let k=0;k<7;k++){ const z=-0.3+k*0.1; for(let j=-1;j<=1;j++)add(j*0.08,0.6+0.04*Math.cos(j),z,mpick(['o','%','"']),0.12,1.2,'body'); } }
  else if(look&&look.startsWith('hound')){ mv(['body','head','core','tail'],p=>{ p.y+=0.1; }); legStretch(0.46,1.3);
    for(let k=0;k<3;k++)add(0,0.66-k*0.02,0.56+k*0.07,k===2?'>':'=',0.11,1.3,'head');
    for(const sd of [-1,1])for(let k=0;k<2;k++)add(sd*0.07,0.8+k*0.04,0.4-k*0.08,'<',0.1,1.3,'head');
    const push=(x,y,z,ch,s,b,col)=>pts.push({x,y,z,g:G(ch),s,b,part:'body',ph:mr()*6.28,piv:0,pz:0,col});
    const lit2=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
    if(look==='houndF'){
      // a mane of flame tongues standing up from neck to back: deep red at the root, yellow-white at the tip; embers glowing in cracks of the dark body
      for(let k=0;k<10;k++){ const z=0.5-k*0.085, h=0.2+0.14*Math.sin(k*0.9+0.6)*(k<6?1:0.6), n=4;
        for(let q=0;q<n;q++){ const f=q/(n-1); lit2((mr()-0.5)*0.05,0.72+h*f,z-0.03*f,'^',0.13+0.03*(1-f),1.6+1.0*f,[1.0,0.25+0.6*f,0.06+0.5*f*f],'flame',{fh:f}); } }
      for(let k=0;k<6;k++){ const sd=k%2?1:-1; lit2(sd*0.16,0.48+mr()*0.12,-0.2+k*0.08,mpick(['/','\\']),0.11,2.2,[1.0,0.35,0.1]); }
      for(const sd of [-1,1])lit2(sd*0.05,0.74,0.56,'*',0.09,3.4,[1.0,0.6,0.2],'head'); }
    if(look==='houndI'){
      // clusters of large ice crystals jutting from the shoulders, the back and the hips; pale eyes
      for(const [cx,cy,cz] of [[0.12,0.72,0.3],[-0.12,0.72,0.3],[0,0.76,0.06],[0.1,0.72,-0.18],[-0.1,0.72,-0.18]]){ const sdx=cx===0?0:Math.sign(cx);
        for(let q=0;q<3;q++){ const dx=sdx*0.08+(q-1)*0.06, dy=0.2+0.12*((q*7+cz*10)%3)/2, dz=(q-1)*0.04-0.05; const L=Math.hypot(dx,dy,dz), n=Math.max(2,Math.round(L/0.08));
          for(let j=1;j<=n;j++){ const f=j/n; lit2(cx+dx*f,cy+dy*f,cz+dz*f,j===n?'*':(Math.abs(dx)>dy*0.5?(dx>0?'/':'\\'):'|'),0.12,j===n?3.0:2.2,[0.85,0.97,1.0]); } } }
      for(const sd of [-1,1])lit2(sd*0.05,0.74,0.56,'*',0.09,3.2,[0.7,0.95,1.0],'head'); }
    if(look==='houndL'){
      // a hound made of light: its whole body brighter, eyes like lamps, a core of light in the chest
      for(const p of pts)p.b*=1.6;
      for(const sd of [-1,1])lit2(sd*0.05,0.74,0.56,'*',0.1,4.0,[1.0,1.0,0.9],'head');
      lit2(0,0.55,0.3,'*',0.2,3.6,[1.0,0.95,0.7],'body'); lit2(0,0.55,0.3,'o',0.28,1.6,[1.0,0.9,0.6],'body'); } }
  else if(look==='salamander'){ mv(['body','head','core','tail'],p=>{ p.y*=0.62; p.z*=1.35; }); legStretch(0.24,0.7);
    for(let k=3;k<8;k++)add(0,0.3-k*0.02,-0.56-k*0.12,mpick(['~','=']),0.1,0.9,'tail',k);
    for(let k=0;k<6;k++)add((mr()-0.5)*0.1,0.42+mr()*0.08,-0.35+k*0.14,'^',0.13,2.6,'body'); }
}
for(const [k,v] of Object.entries({k:'kobold',g:'goblin',s:'snapjaw',sw:'snapjaw',m:'monkey',c:'conjurer',O:'ogre',G:'gnome',r:'rat',j:'jackal',h:'grazer',Zf:'houndF',Zi:'houndI',Zl:'houndL',l:'salamander',L:'lich',W:'wraith'}))if(MTYPES[k])MTYPES[k].look=v;
MTYPES.Rc.form='cleaner'; MTYPES.Re.form='repairer'; MTYPES.Rw.form='watcher';
// the fire and ice hounds: dark bodies, so the flames and the ice stand out; their light keeps its colour
MTYPES.Zf.trail=0; MTYPES.Zi.trail=0; MTYPES.Zl.trail=0;
MTYPES.Zf.lcol=MTYPES.Zf.col; MTYPES.Zf.col=[0.42,0.3,0.26]; MTYPES.Zi.lcol=MTYPES.Zi.col; MTYPES.Zi.col=[0.32,0.42,0.56]; MTYPES.Zl.col=[1.0,0.95,0.78];

// ---------------------------------------------------------------- bosses and the dead: their own features on top of the shared bodies (crowns, staves, hoods, horns, torn cloth); parts may carry their own colour
function extraLook(ty,pts){
  const look=ty.look; if(!look||pts.noExtra)return;
  const add=(x,y,z,ch,s,b,part,col,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const crown=(y,r,n,ch,col,b)=>{ for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; add(Math.cos(a)*r,y,Math.sin(a)*r,ch,0.12,b||2.4,'head',col); } };
  if(look==='lichking'||look==='lich'){
    crown(2.08,look==='lichking'?0.17:0.13,look==='lichking'?8:5,'^',look==='lichking'?GOLD:[0.9,0.85,0.6],look==='lichking'?2.6:1.8);
    if(look==='lichking'){ for(let k=0;k<12;k++)add(0.48,0.25+k*0.15,0.1,'|',0.12,1.1,'robe',BONE); add(0.48,2.1,0.1,'*',0.24,3.2,'robe',PALE);
      for(let k=0;k<14;k++){ const a=k/14*Math.PI*2; add(Math.cos(a)*0.62,0.12+mr()*0.3,Math.sin(a)*0.62,mpick(['\\','/','~','%']),0.13,0.9,'robe'); } }
    else { add(0,1.45,0,'#',0.2,2.2,'orbit',[0.75,0.55,1.0],{r:0.62,sp:0.9}); add(0,1.58,0,'=',0.16,1.8,'orbit',[0.75,0.55,1.0],{r:0.62,sp:0.9}); }
  }
  else if(look==='wraith'){
    for(let k=0;k<16;k++){ const a=k/16*Math.PI*2, r=0.5+mr()*0.15; add(Math.cos(a)*r,0.05+mr()*0.35,Math.sin(a)*r,mpick(['|','\\','/','!']),0.13,0.85,'robe'); }
    for(const sd of [-1,1])for(let k=0;k<3;k++)add(sd*(0.68+k*0.07),1.28-k*0.05,0.35+k*0.06,sd<0?'<':'>',0.11,1.8,'robe',[0.9,0.92,1.0]);
  }
  else if(look==='shadowking'){
    for(let k=0;k<5;k++){ const a=k/5*Math.PI*2; for(let q=0;q<3;q++)add(Math.cos(a)*0.2,2.12+q*0.12,Math.sin(a)*0.2,q===2?'^':'|',0.12,2.4,'head',[0.82,0.72,1.0]); }
    add(0.08,1.92,0.14,'*',0.09,3.4,'head',[1,1,1]); add(-0.08,1.92,0.14,'*',0.09,3.4,'head',[1,1,1]);
    for(let k=0;k<18;k++){ const f=k/18; add((mr()-0.5)*0.6,1.6-f*1.1,-0.3-f*0.8,mpick(['~','%','\'']),0.15,0.9,'robe',[0.4,0.3,0.7]); }
  }
  else if(look==='spiderqueen'){
    for(let i=0;i<22;i++){ const y=1-2*(i+0.5)/22, rr=Math.sqrt(1-y*y), a=i*2.39996; add(Math.cos(a)*rr*0.3,0.5+y*0.24,-0.42+Math.sin(a)*rr*0.34,mpick(['%','&','@']),0.15,1.0,'body'); }
    for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; add(Math.cos(a)*0.1,0.66,0.2+Math.sin(a)*0.06,mpick(['*','\'']),0.08,2.6,'head',[0.88,0.92,1.0]); }
    for(let k=0;k<4;k++)add(0,0.05,0,'s',0.1,1.3,'orbit',null,{r:0.9+k*0.12,sp:0.6+k*0.15,ph:k*1.57});
  }
  else if(look==='nagaqueen'){
    crown(0.92,0.1,5,'^',GOLD,2.6); for(const p of pts)if(p.part==='head'&&p.y>0.9-0.01&&p.col===GOLD)p.z+=1.0;
    for(const sd of [-1,1])for(let k=0;k<5;k++)add(sd*(0.12+k*0.05),0.58+k*0.04,0.86,sd<0?'(':')',0.12,1.2,'head');
  }
  else if(look==='olddragon'){
    for(const sd of [-1,1])for(let k=0;k<4;k++)add(sd*(0.08+k*0.03),1.2+k*0.08,0.74-k*0.06,sd<0?'\\':'/',0.11,1.4,'head',BONE);
    for(let k=0;k<5;k++)add((k-2)*0.03,0.94-k*0.04,0.92,mpick(['"',',']),0.1,1.1,'head',[0.8,0.78,0.7]);
    for(let i=pts.length-1;i>=0;i--)if(pts[i].part==='wing'&&mr()<0.3)pts.splice(i,1);
    for(const p of pts)if(p.part==='wing'&&mr()<0.3)p.g=G('%');
    for(let k=0;k<4;k++)add((mr()<0.5?-1:1)*0.21,0.55+mr()*0.1,-0.3+k*0.18,'=',0.12,1.6,'body',[0.9,0.32,0.22]);
  }
}

// lichKingForm（不死の王の形）は src/lib/bodies/bosses.ts（src/game/imports.mjs で読む）
// presence: the swords of the fallen planted around, a ring of frost, cold mist, the flame's sparks, a low drone close by
function lichAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>30)return;
  if(!m.swords){ m.swords=[]; for(let k=0;k<7;k++){ const a=k/7*Math.PI*2+mr()*0.4, r=(1.7+mr()*0.9)*sc; m.swords.push({x:m.x+Math.cos(a)*r,z:m.z+Math.sin(a)*r,tx:(mr()-0.5)*0.5,tz:(mr()-0.5)*0.5,h:0.8+mr()*0.5}); } }
  for(const s of m.swords){ for(let y=0;y<s.h;y+=0.12)dyn(s.x+s.tx*y,y,s.z+s.tz*y,G('|'),0.14,0.42,0.42,0.48); dyn(s.x+s.tx*s.h,s.h,s.z+s.tz*s.h,G('+'),0.18,0.55,0.48,0.32); }
  const n=36; for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.05, r=(1.3+0.12*Math.sin(t*0.7+k))*sc; dyn(m.x+Math.cos(a)*r,0.05,m.z+Math.sin(a)*r,G(k%3?'.':'*'),0.12,0.45,0.65,0.9); }
  if(mr()<0.25){ const a=mr()*6.28, r=mr()*1.2*sc; spawn(m.x+Math.cos(a)*r,0.15,m.z+Math.sin(a)*r,Math.cos(a)*0.25,0.08,Math.sin(a)*0.25,2.2,G(mpick(['~','.'])),0.22,0.3,0.4,0.55,0); }
  if(dp<14&&time>(m.droneT||0)&&sndReady()){ m.droneT=time+3.2; const t0=SND.ctx.currentTime, o=sOut(m.x,m.z,0.16); sEnv(sTone(t0,'sine',55,52,3,o),t0,0.6,2.3); sEnv(sTone(t0,'sine',82.5,80,3,o),t0,0.8,2.1,0.5); } }

// spiderQueenForm（蜘蛛の女王の形）は src/lib/bodies/bosses.ts
// her floor: a radial web and spiderlings running on it
function spiderAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>30)return;
  if(mr()<0.12){ const cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), lx=(mr()<0.5?1:-1)*0.03*sc, lz=0.62*sc; spawn(m.x+lx*cy+lz*sy,m.y+0.82*sc,m.z-lx*sy+lz*cy,0,-0.2,0,1.2,G('.'),0.12,0.5,1.0,0.45,1); }
  for(let k=0;k<10;k++){ const a=k/10*Math.PI*2+0.2; const dark=k%3===0; for(let r=0.5;r<2.6;r+=0.28)dyn(m.x+Math.cos(a)*r*sc,0.04,m.z+Math.sin(a)*r*sc,G(k%2?'/':'\\'),0.12,dark?0.14:0.38,dark?0.1:0.4,dark?0.18:0.48); }
  for(let r=0.9;r<2.6;r+=0.55){ const n=Math.round(r*14); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; dyn(m.x+Math.cos(a)*r*sc,0.04,m.z+Math.sin(a)*r*sc,G('.'),0.1,0.32,0.34,0.42); } }
  for(let k=0;k<5;k++){ const a=t*(0.5+k*0.13)+k*1.3, r=(1.2+0.6*Math.sin(t*0.7+k))*sc; dyn(m.x+Math.cos(a)*r,0.08,m.z+Math.sin(a)*r,G('s'),0.16,0.75,0.65,0.95); } }

// nagaQueenForm（ナーガの女王の形）は src/lib/bodies/bosses.ts
// her floor: ripples of water, small snakes, a hiss close by
function nagaAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>30)return;
  for(let r=1.1;r<2.4;r+=0.45){ const n=Math.round(r*16); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.1*(r>1.6?-1:1); dyn(m.x+Math.cos(a)*r*sc,0.04+0.02*Math.sin(t*2+k),m.z+Math.sin(a)*r*sc,G('~'),0.12,0.2,0.5,0.55); } }
  for(let k=0;k<4;k++){ const a=t*(0.4+k*0.11)+k*1.6, r=(1.3+0.5*Math.sin(t*0.6+k))*sc; for(let q=0;q<4;q++){ const aa=a-q*0.06; dyn(m.x+Math.cos(aa)*r,0.08,m.z+Math.sin(aa)*r,G(q?'~':'n'),0.15,0.4,0.85,0.45); } }
  if(dp<12&&time>(m.hissT||0)&&sndReady()){ m.hissT=time+4+mr()*3; const t0=SND.ctx.currentTime; sEnv(sNoise(t0,0.9,'highpass',3000,0.7,sOut(m.x,m.z,0.18)),t0,0.15,0.7); } }

// oldDragonForm（古竜の形）は src/lib/bodies/bosses.ts
// its hoard and its breath: coins, cups and chests around and beneath; smoke from the nostrils now and then
function dragonAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>36)return;
  if(!m.hoard){ m.hoard=[]; for(let k=0;k<70;k++){ const a=mr()*6.28, r=(0.4+mr()*0.9)*sc; m.hoard.push({x:m.x+Math.cos(a)*r,z:m.z+Math.sin(a)*r,y:0.05+mr()*0.15,ch:mpick(['$','o','$','o','U','#','*'])}); } }
  for(const h of m.hoard)dyn(h.x,h.y,h.z,G(h.ch),0.2,h.ch==='*'?1.6:1.1,h.ch==='*'?1.4:0.85,h.ch==='*'?0.9:0.3);
  if(mr()<0.05){ const cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), lx=0.36*sc, lz=2.0*sc; spawn(m.x+lx*cy+lz*sy,m.y+0.25*sc,m.z-lx*sy+lz*cy,(mr()-0.5)*0.2,0.5,(mr()-0.5)*0.2,2.4,G('~'),0.3,0.35,0.32,0.3,0); } }

