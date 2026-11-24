// ---------------------------------------------------------------- the small and simple creatures, each its own body: an outline that reads at a glance and one standing feature (glyphs about 0.22 m)
// cpt・HRAMP・q2 など 9 個は src/lib/bodies/kit.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）
// jellyForm・bloatForm・wispForm など 8 個は src/lib/bodies/small.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）
// ratForm・jackalForm・grazerForm など 14 個は src/lib/bodies/beasts.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）

// ---------------------------------------------------------------- humanoids, rebuilt: a body made of readable glyphs with shading by material, proportions by kind, and each kind's own features
function humanoid2(ty){
  const look=ty.look, P=HUM_PROP[LOOK_PROP[look]||'base'], S=Math.min(0.36,0.22/ty.scale), GAP=S*0.8, pts=[];
  const SK=ty.col, CL={kobold:[0.6,0.42,0.3],goblin:[0.55,0.45,0.32],conjurer:[0.42,0.3,0.6],snapjaw:[0.62,0.5,0.36],monkey:[0.55,0.42,0.3],ogre:[0.55,0.42,0.3],gnome:[0.35,0.45,0.75]}[look]||[0.5,0.45,0.4];
  const LD=[0.42,0.72,0.55], put=(x,y,z,nx,ny,nz,mat,col,part,extra)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=HRAMP[mat];
    pts.push(Object.assign({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:S,b:0.5+0.9*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{})); };
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,extra)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/GAP)), ch=strokeCh(dx,dy); for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part,extra); } };
  const lean=look==='goblin'?0.12:look==='snapjaw'?0.14:look==='monkey'?0.22:0, lz=y=>lean*Math.max(0,(y-P.hip)/(P.hc-P.hip));
  const bw=look==='ogre'?1.45:look==='kobold'||look==='gnome'?0.9:1, legW=P.legW||1;
  // legs (cloth or fur), swinging from the hip
  for(const sd of [-1,1]){ const part=sd<0?'legL':'legR'; for(let y=0.04;y<P.hip;y+=GAP){ put(sd*0.1*bw*legW,y,0,sd,0,0.6,look==='snapjaw'||look==='monkey'||look==='kobold'?'fur':'cloth',look==='snapjaw'||look==='monkey'||look==='kobold'?SK:CL,part,{piv:P.hip,pz:0}); if(legW>1.1)put(sd*0.16*bw,y,0,sd,0,0.4,'skin',SK,part,{piv:P.hip,pz:0}); } }
  // torso: rings from hip to shoulder; the ogre's belly bulges
  for(let y=P.hip;y<=P.sh+0.01;y+=GAP){ const f=(y-P.hip)/(P.sh-P.hip), bel=look==='ogre'?0.1*Math.sin(Math.PI*Math.min(1,f*1.3)):0, rx=(0.18+0.04*f)*bw+bel, rz=0.13*bw+bel, n=Math.max(5,Math.round(2*Math.PI*Math.max(rx,rz)/GAP));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a), mat=f<0.25&&look!=='ogre'?'cloth':(look==='conjurer'||look==='gnome'?'cloth':'skin'); put(nx*rx,y,nz*rz+lz(y),nx,0.2,nz,mat,mat==='cloth'?CL:SK); } }
  // arms, swinging from the shoulder; the monkey's reach the ground
  const armLen=(P.sh-P.hip)*(look==='monkey'?1.9:look==='ogre'?1.25:1.1);
  for(const sd of [-1,1]){ const part=sd<0?'armL':'armR', ax=sd*(0.22*bw+0.06); for(let t=0;t<=armLen;t+=GAP)put(ax+sd*0.02*t,P.sh-t,lz(P.sh)+0.04*t,sd,0,0.5,'skin',SK,part,{piv:P.sh,pz:0}); lit(ax+sd*0.02*armLen,P.sh-armLen-0.02,lz(P.sh)+0.04*armLen,'o',S,1.4,SK,part,{piv:P.sh,pz:0}); }
  // head: shaded sphere, glowing eyes, the creature's letter small at its centre
  const hr=0.15*P.hk*(look==='ogre'?1.0:1), H=[0,P.hc,lz(P.hc)];
  for(let i=0;i<14;i++){ const y=1-2*(i+0.5)/14, rr=Math.sqrt(1-y*y), a=i*2.39996; put(H[0]+Math.cos(a)*rr*hr,H[1]+y*hr,H[2]+Math.sin(a)*rr*hr,Math.cos(a)*rr,y,Math.sin(a)*rr,'skin',SK,'head'); }
  const EYE=look==='goblin'?[1,0.9,0.3]:look==='conjurer'?[0.8,0.5,1]:look==='gnome'?[0.6,0.8,1]:[1,0.75,0.4];
  for(const sd of [-1,1])lit(H[0]+sd*hr*0.38,H[1]+hr*0.15,H[2]+hr*0.92,'.',S*0.8,3.2,EYE,'head');
  lit(0,P.hc,H[2]+hr*0.2,ty.ch,S*1.3,1.5,SK,'core');
  const tool=(part,pts2)=>pts2;
  const hand=[0.22*bw+0.06+0.02*armLen,P.sh-armLen,lz(P.sh)+0.04*armLen], arm={piv:P.sh,pz:0};
  if(look==='kobold'){ for(let k=1;k<=3;k++)lit(0,H[1]-hr*0.2,H[2]+hr+k*S*0.6,k===3?'>':'=',S*0.9,1.4,SK,'head');
    for(const sd of [-1,1]){ lit(sd*hr*0.6,H[1]+hr*1.1,H[2],'^',S,1.4,SK,'head'); lit(sd*hr*0.65,H[1]+hr*1.45,H[2]-0.02,'^',S*0.8,1.2,SK,'head'); }
    stroke([hand[0],hand[1]-0.3,hand[2]],[hand[0],hand[1]+0.85,hand[2]],[0.6,0.5,0.35],1.1,S*0.9,'armR',arm); lit(hand[0],hand[1]+0.92,hand[2],'^',S*1.1,2.2,[0.85,0.85,0.9],'armR',arm);
    stroke([0,P.hip,-0.12],[0,P.hip-0.2,-0.3],SK,1.0,S*0.9,'tail',{piv:0}); }
  if(look==='goblin'){ for(const sd of [-1,1]){ stroke([sd*hr,H[1]+hr*0.2,H[2]],[sd*(hr+0.22),H[1]+hr*0.6,H[2]-0.04],SK,1.4,S,'head'); lit(sd*(hr+0.26),H[1]+hr*0.65,H[2]-0.05,sd<0?'<':'>',S,1.6,SK,'head'); }
    for(let k=0;k<5;k++)lit((k-2)*0.07,P.hip-0.05-((k*7)%3)*0.04,0.14+lz(P.hip),mpick(['|','/','\\']),S*0.9,1.0,CL);
    stroke([hand[0],hand[1],hand[2]],[hand[0],hand[1]-0.02,hand[2]+0.3],[0.7,0.55,0.4],1.6,S*0.9,'armR',arm); }
  if(look==='conjurer'){ for(let y=0.04;y<P.hip+0.1;y+=GAP){ const r=0.34-(y/(P.hip+0.1))*0.12, n=Math.max(6,Math.round(2*Math.PI*r/GAP)); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; put(Math.cos(a)*r,y,Math.sin(a)*r*0.85,Math.cos(a),0.1,Math.sin(a),'cloth',CL,'robe'); } }
    for(let i=0;i<10;i++){ const y=1-2*(i+0.5)/10, rr=Math.sqrt(1-y*y), a=i*2.39996; if(Math.sin(a)*rr>0.4&&y<0.6)continue; put(Math.cos(a)*rr*hr*1.35,H[1]+0.03+y*hr*1.3,H[2]-0.02+Math.sin(a)*rr*hr*1.3,Math.cos(a)*rr,y,Math.sin(a)*rr,'cloth',CL,'head'); }
    lit(0,H[1]+hr*1.55,H[2]-0.04,'^',S,1.2,CL,'head');
    stroke([hand[0]+0.04,0.04,hand[2]],[hand[0]+0.04,P.hc+0.35,hand[2]],[0.85,0.8,0.68],1.1,S*0.9,'armR',arm);
    for(const sd of [-1,1])lit(hand[0]+0.04+sd*0.07,P.hc+0.32,hand[2],sd<0?'}':'{',S*0.85,1.3,[0.9,0.9,0.8],'armR',arm); lit(hand[0]+0.04,P.hc+0.45,hand[2],'*',S*1.3,3.4,[0.75,0.45,1.0],'armR',arm); }
  if(look==='snapjaw'){ for(let k=1;k<=4;k++)lit(0,H[1]-hr*0.25,H[2]+hr+k*S*0.55,k===4?'>':'=',S*0.9,1.4,SK,'head');
    for(let k=0;k<6;k++)lit(0,H[1]+hr*0.9-k*0.08,H[2]-hr-0.02-k*0.03,'^',S*0.9,1.3,[0.4,0.3,0.22],'head');
    for(let k=0;k<5;k++)lit((k-2)*0.08,P.hip-0.04,0.15+lz(P.hip),'"',S*0.9,1.1,[0.5,0.4,0.3]);
    if(ty.sk==='sw'||ty.name&&ty.name.includes('見張り')){ stroke([hand[0],hand[1]-0.05,hand[2]],[hand[0],hand[1]+0.45,hand[2]],[0.5,0.38,0.25],1.0,S*0.9,'armR',arm); for(let q=0;q<4;q++){ const f=q/3; lit(hand[0],hand[1]+0.5+f*0.22,hand[2],'^',S*(1.1-f*0.3),2.0+1.2*f,[1.0,0.3+0.55*f,0.1+0.4*f],'flame',{fh:f,piv:P.sh}); } } }
  if(look==='monkey'){ for(let k=0;k<9;k++){ const a=k/8*Math.PI*1.4; lit(0,P.hip-0.05+Math.sin(a)*0.35,-0.15-k*0.07+Math.cos(a)*0.0,mpick(['~','(',')']),S*0.9,1.1,SK,'tail',{piv:k*0.6}); }
    for(const sd of [-1,1])lit(sd*hr*0.95,H[1],H[2],sd<0?'(':')',S,1.2,SK,'head'); }
  if(look==='ogre'){ for(let k=0;k<6;k++)lit((k-2.5)*0.1,P.hip+0.02,0.25,'"',S*0.9,1.1,[0.55,0.45,0.3]);
    stroke([hand[0],hand[1],hand[2]],[hand[0]-0.05,P.sh+0.3,-0.25],[0.55,0.42,0.3],1.1,S,'armR',arm);
    for(let q=0;q<7;q++)lit(hand[0]-0.05+(mr()-0.5)*0.16,P.sh+0.32+(mr()-0.5)*0.16,-0.28+(mr()-0.5)*0.12,mpick(['#','%','@']),S*1.05,1.2,[0.6,0.5,0.4],'armR',arm); }
  if(look==='gnome'){ for(let k=0;k<6;k++){ const r=hr*1.15*(1-k/6), n=Math.max(1,6-k); for(let j=0;j<n;j++){ const a=j/n*Math.PI*2; lit(Math.cos(a)*r,H[1]+hr*0.7+k*0.08,H[2]+Math.sin(a)*r,k===5?'^':'A',S*0.9,1.3,[0.85,0.3,0.3],'head'); } }
    for(let k=0;k<5;k++)stroke([(k-2)*0.04,H[1]-hr*0.3,H[2]+hr*0.85],[(k-2)*0.05,H[1]-hr*1.6,H[2]+hr*0.9],[0.92,0.92,0.92],1.3,S*0.85,'head');
    lit(hand[0],hand[1]-0.08,hand[2]+0.1,'[',S*0.9,1.2,[0.7,0.6,0.4],'armR',arm); lit(hand[0]+0.08,hand[1]-0.08,hand[2]+0.1,']',S*0.9,1.2,[0.7,0.6,0.4],'armR',arm); lit(hand[0]+0.04,hand[1]-0.08,hand[2]+0.1,'*',S*1.1,3.6,[1,0.85,0.5],'armR',arm); }
  return pts;
}

// ogreForm（オーガの形）は src/lib/bodies/beasts.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- four-legged creatures, each its own body with several colours: the rat, the jackal, the moss grazer, the salamander
function salamanderAura(m,t){ if(Math.hypot(m.x-player.x,m.z-player.z)>24||mr()>0.08)return; const sc=m.ty.scale||1, cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), lz=-1.3*sc;
  spawn(m.x+lz*sy,0.12,m.z+lz*cy,(mr()-0.5)*0.2,-0.1,(mr()-0.5)*0.2,0.5,G(mpick(['\'','.'])),0.09,2.6,1.2,0.35,1); }

// ---------------------------------------------------------------- the large creatures, each its own body in several colours (glyphs about 0.22 m)
function bogAura(m,t){ const sc=m.ty.scale||1; if(Math.hypot(m.x-player.x,m.z-player.z)>26)return;
  for(let r=0.95;r<1.6;r+=0.3){ const n=Math.round(r*16); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.08*(r>1.2?-1:1); dyn(m.x+Math.cos(a)*r*sc,0.04,m.z+Math.sin(a)*r*sc,G('~'),0.13,0.28,0.24,0.16); } }
  if(mr()<0.06){ const a=mr()*6.28, r=mr()*0.7*sc; spawn(m.x+Math.cos(a)*r,0.15,m.z+Math.sin(a)*r,0,0.25,0,1.6,G(mpick(['o','.'])),0.14,0.7,0.95,0.45,0); }
  if(mr()<0.1){ const a=mr()*6.28, r=0.5*sc; spawn(m.x+Math.cos(a)*r,0.9*sc,m.z+Math.sin(a)*r,0,-0.2,0,1.2,G(mpick([',','.'])),0.12,0.5,0.38,0.24,1); } }
// dragonForm（竜の形）は src/lib/bodies/beasts.ts


// ---------------------------------------------------------------- the dead, their own bodies: the lich (a floating skeletal mage) and the wraith (a heap of rags with claws)
function lichForm(ty){ const {S,pts,lit,stroke,ell,tube}=q3(ty); pts.noExtra=true;
  const BONE=[0.9,0.88,0.8], ROBE=[0.45,0.35,0.6], GOLD=[0.85,0.7,0.38], ICE=[0.6,0.88,1.0], MIST=[0.55,0.55,0.75], BOOK=[0.6,0.45,0.85];
  // the robe, its hem unravelling into mist above the floor
  for(let y=0.28;y<=1.3;y+=S*0.85){ const f=(y-0.28)/1.02, r=0.32-0.1*f, n=Math.max(6,Math.round(2*Math.PI*r/(S*0.9)));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; if(f<0.25&&mr()<0.35*(1-f/0.25))continue; lit(Math.cos(a)*r,y,Math.sin(a)*r*0.85,mpick(['%',':','|','#']),1,0.75+0.35*Math.max(0,Math.cos(a-0.8)),ROBE,'robe'); } }
  for(let k=0;k<16;k++){ const a=mr()*6.28, r=0.25+mr()*0.15; lit(Math.cos(a)*r,0.08+mr()*0.2,Math.sin(a)*r,mpick(['~','.']),0.9,0.8,MIST,'robe'); }
  // ribs glimpsed at the open chest
  for(let r=0;r<4;r++)for(const sd of [-1,1])lit(sd*0.08,1.12-r*0.08,0.2,sd<0?'(':')',0.9,1.4,BONE);
  // the skull, cold eyes, a faded crown
  ell([0,1.5,0.02],0.13,0.14,0.13,SKINR,()=>BONE,'head'); for(const sd of [-1,1])lit(sd*0.05,1.52,0.14,'*',0.9,3.8,ICE,'head'); lit(0,1.4,0.14,'=',0.85,1.4,BONE,'head');
  for(let k=0;k<9;k++){ const a=k/9*Math.PI*2; lit(Math.cos(a)*0.12,1.65,Math.sin(a)*0.11,k%2?'^':'=',0.9,1.8,GOLD,'head'); }
  // a bony arm with a bone staff, its head lit cold; the other hand open
  stroke([0.26,1.25,0.06],[0.34,0.95,0.14],BONE,1.3,0.9,'body'); stroke([0.38,0.15,0.14],[0.38,1.85,0.14],[0.7,0.66,0.6],1.1,0.9,'body'); lit(0.38,1.92,0.14,'@',1.3,3.6,ICE,'body');
  stroke([-0.26,1.25,0.06],[-0.36,1.05,0.3],BONE,1.3,0.9,'body'); for(let f2=0;f2<4;f2++)lit(-0.36+(f2-1.5)*0.03,1.02,0.38,"'",0.8,1.4,BONE,'body');
  // a book circling, its pages turning
  for(const [ch,dy] of [['#',0],['=',0.08],['=',-0.08]])lit(0,1.0+dy,0,ch,1.05,2.2,BOOK,'orbit',{r:0.6,sp:0.7,ph:0});
  lit(0,1.12,0,'~',0.9,2.8,ICE,'orbit',{r:0.6,sp:0.7,ph:0.12});
  return pts; }


