// ---------------------------------------------------------------- the small and simple creatures, each its own body: an outline that reads at a glance and one standing feature (glyphs about 0.22 m)
// cpt・HRAMP・q2 など 9 個は src/lib/bodies/kit.ts（読む名前の一覧は src/game/imports.mjs）
// jellyForm・bloatForm・wispForm など 8 個は src/lib/bodies/small.ts（読む名前の一覧は src/game/imports.mjs）
// ratForm・jackalForm・grazerForm など 14 個は src/lib/bodies/beasts.ts（読む名前の一覧は src/game/imports.mjs）

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

// ---------------------------------------------------------------- the ogre, its own body: broad shoulders and a V-shaped torso, bulging shoulders and arms, thick legs, a heavy brow and tusks,
// a leather loincloth with fur, a belt with an iron buckle, and a real club - thick at the head, iron-banded, studded with iron spikes - resting on its shoulder. Several colours, not one
function ogreForm(ty){
  const pts=[], S=0.167, GAP=0.14, LD=[0.42,0.72,0.55];
  const SKIN=[0.52,0.62,0.44], LEATHER=[0.36,0.22,0.14], FUR=[0.88,0.8,0.64], WOOD=[0.72,0.46,0.24], IRON=[0.82,0.86,0.95], TUSK=[0.98,0.95,0.86], EYE=[1.0,0.85,0.3];
  const R={skin:['.',':','o','%','#'], cloth:['.',':','|','/','#'], wood:['.',':','=','%','#'], fur:['.',',','"','%','#']};
  const put=(x,y,z,nx,ny,nz,mat,col,part,extra)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), r=R[mat];
    pts.push(Object.assign({x,y,z,g:G(r[Math.min(r.length-1,Math.floor(i*r.length))]),s:S,b:0.5+0.9*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{})); };
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const tube=(a,b,r0,r1,mat,col,part,extra,bulge)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), ux=dx/L, uy=dy/L, uz=dz/L; let px=-uz, py=0, pz=ux; if(Math.hypot(px,pz)<0.1){ px=1; pz=0; } const pl=Math.hypot(px,pz); px/=pl; pz/=pl;
    const qx=uy*pz-uz*py, qy=uz*px-ux*pz, qz=ux*py-uy*px; for(let t=0;t<=L+1e-6;t+=GAP){ const f=t/L, r=(r0+(r1-r0)*f)*(1+(bulge||0)*Math.sin(Math.PI*f)), n=Math.max(5,Math.round(2*Math.PI*r/GAP));
      for(let k=0;k<n;k++){ const an=k/n*Math.PI*2+t*2, ox=Math.cos(an)*px+Math.sin(an)*qx, oy=Math.cos(an)*py+Math.sin(an)*qy, oz=Math.cos(an)*pz+Math.sin(an)*qz; put(a[0]+ux*t+ox*r,a[1]+uy*t+oy*r,a[2]+uz*t+oz*r,ox,oy,oz,mat,col,part,extra); } } };
  const hip=0.6, sh=1.26, hc=1.42;
  // thick legs with bulging calves, wide feet
  for(const sd of [-1,1]){ const part=sd<0?'legL':'legR', ex={piv:hip,pz:0}; tube([sd*0.15,hip,0],[sd*0.16,0.06,0.02],0.12,0.09,'skin',SKIN,part,ex,0.25); for(let k=0;k<3;k++)lit(sd*0.16+(k-1)*0.06,0.03,0.1,'_',S,1.0,SKIN,part,ex); }
  // the torso: V-shaped, broadest at the chest; a slight belly in front
  for(let y=hip;y<=sh+0.01;y+=GAP){ const f=(y-hip)/(sh-hip), rx=0.26+0.18*Math.pow(f,1.3), rz=0.2+0.04*f, bel=0.07*Math.sin(Math.PI*Math.min(1,f*1.6)), n=Math.max(8,Math.round(2*Math.PI*rx/GAP));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); put(nx*rx,y,nz*(rz+(nz>0?bel:0)),nx,0.15,nz,'skin',SKIN); } }
  for(const sd of [-1,1])for(let k=0;k<3;k++)lit(sd*(0.1+k*0.07),sh-0.12-k*0.02,0.26,sd<0?'(':')',S,1.5,[0.5,0.46,0.32]);
  for(let r=0;r<3;r++)for(const sd of [-1,1])lit(sd*0.06,hip+0.2+r*0.11,0.29,'=',S*0.9,1.2,[0.5,0.46,0.32]);
  // bulging shoulders and a thick neck
  for(const sd of [-1,1])for(let i=0;i<12;i++){ const y=1-2*(i+0.5)/12, rr=Math.sqrt(1-y*y), a=i*2.39996; if(y<-0.3)continue; put(sd*0.46+Math.cos(a)*rr*0.14,sh-0.02+y*0.12,Math.sin(a)*rr*0.14,Math.cos(a)*rr,y,Math.sin(a)*rr,'skin',SKIN); }
  tube([0,sh,0],[0,hc-0.08,0.02],0.13,0.11,'skin',SKIN,'body');
  // thick arms with biceps and fists
  const armLen=0.82;
  // the left arm hangs; the right is bent at the elbow, its fist in front of the chest, holding the club on the shoulder
  for(const sd of [-1,1]){ const part=sd<0?'armL':'armR', ex={piv:sh,pz:0}, s0=[sd*0.5,sh-0.04,0], el=sd<0?[sd*0.56,sh-0.42,0.04]:[0.6,sh-0.4,0.14], wr=sd<0?[sd*0.54,sh-armLen,0.1]:[0.44,sh-0.14,0.32];
    tube(s0,el,0.1,0.085,'skin',SKIN,part,ex,0.3); tube(el,wr,0.085,0.075,'skin',SKIN,part,ex,0.15);
    for(let i=0;i<8;i++){ const y=1-2*(i+0.5)/8, rr=Math.sqrt(1-y*y), a=i*2.39996; put(wr[0]+Math.cos(a)*rr*0.09,wr[1]-0.06+y*0.08,wr[2]+Math.sin(a)*rr*0.09,Math.cos(a)*rr,y,Math.sin(a)*rr,'skin',SKIN,part,ex); }
    lit(sd*0.54,sh-0.2,0.12,'^',S*0.8,1.2,LEATHER,part,ex); }
  // a small head: heavy brow, small yellow eyes, a jutting jaw with tusks, small ears; its letter
  for(let i=0;i<14;i++){ const y=1-2*(i+0.5)/14, rr=Math.sqrt(1-y*y), a=i*2.39996; put(Math.cos(a)*rr*0.14,hc+y*0.14,0.04+Math.sin(a)*rr*0.14,Math.cos(a)*rr,y,Math.sin(a)*rr,'skin',SKIN,'head'); }
  for(let k=0;k<5;k++)lit((k-2)*0.05,hc+0.05,0.18,'=',S*0.9,1.4,[0.5,0.46,0.32],'head');
  for(const sd of [-1,1]){ lit(sd*0.05,hc+0.0,0.18,'.',S*0.8,3.2,EYE,'head'); lit(sd*0.06,hc-0.1,0.2,'^',S*0.9,2.4,TUSK,'head'); lit(sd*0.15,hc+0.02,0.02,sd<0?'(':')',S*0.85,1.1,SKIN,'head'); }
  for(let k=0;k<3;k++)lit((k-1)*0.05,hc-0.12,0.17,'-',S*0.85,1.2,SKIN,'head');
  lit(0,hc+0.02,0.1,ty.ch,S*1.2,1.4,SKIN,'core');
  // a leather loincloth with fur, a belt with an iron buckle
  for(let k=0;k<16;k++){ const a=k/16*Math.PI*2; lit(Math.cos(a)*0.29,hip+0.06,Math.sin(a)*0.23+(Math.sin(a)>0?0.04:0),'=',S,1.2,LEATHER); }
  lit(0,hip+0.06,0.3,'#',S*1.1,2.2,IRON);
  for(const zf of [1,-1])for(let k=0;k<5;k++){ const x=(k-2)*0.08; for(let y=hip;y>hip-0.32;y-=GAP)lit(x,y,zf*(0.24+0.02*(hip-y)),'|',S,0.95,LEATHER); lit(x,hip-0.34,zf*0.25,'"',S,1.3,FUR); }
  // the club: in the right hand, resting on the shoulder - narrow grip, swelling head, two iron bands, iron spikes
  const g0=[0.44,sh-0.22,0.36], g1=[0.47,sh+0.55,-0.46], ex={piv:sh,pz:0};
  tube(g0,g1,0.045,0.16,'wood',WOOD,'armR',ex,0);
  for(const f of [0.62,0.84]){ const c=[g0[0]+(g1[0]-g0[0])*f,g0[1]+(g1[1]-g0[1])*f,g0[2]+(g1[2]-g0[2])*f], r=0.05+0.12*f; for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; lit(c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r*0.4,c[2]+Math.sin(a)*r,'=',S,1.8,IRON,'armR',ex); } }
  for(let k=0;k<7;k++){ const a=k/7*Math.PI*2, f=0.9+0.08*(k%2), c=[g0[0]+(g1[0]-g0[0])*f,g0[1]+(g1[1]-g0[1])*f,g0[2]+(g1[2]-g0[2])*f], r=0.2; lit(c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r*0.6,c[2]+Math.sin(a)*r,'^',S*1.05,2.4,IRON,'armR',ex); }
  return pts;
}

// ---------------------------------------------------------------- four-legged creatures, each its own body with several colours: the rat, the jackal, the moss grazer, the salamander
function salamanderAura(m,t){ if(Math.hypot(m.x-player.x,m.z-player.z)>24||mr()>0.08)return; const sc=m.ty.scale||1, cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), lz=-1.3*sc;
  spawn(m.x+lz*sy,0.12,m.z+lz*cy,(mr()-0.5)*0.2,-0.1,(mr()-0.5)*0.2,0.5,G(mpick(['\'','.'])),0.09,2.6,1.2,0.35,1); }

// ---------------------------------------------------------------- the large creatures, each its own body in several colours (glyphs about 0.22 m)
function bogAura(m,t){ const sc=m.ty.scale||1; if(Math.hypot(m.x-player.x,m.z-player.z)>26)return;
  for(let r=0.95;r<1.6;r+=0.3){ const n=Math.round(r*16); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.08*(r>1.2?-1:1); dyn(m.x+Math.cos(a)*r*sc,0.04,m.z+Math.sin(a)*r*sc,G('~'),0.13,0.28,0.24,0.16); } }
  if(mr()<0.06){ const a=mr()*6.28, r=mr()*0.7*sc; spawn(m.x+Math.cos(a)*r,0.15,m.z+Math.sin(a)*r,0,0.25,0,1.6,G(mpick(['o','.'])),0.14,0.7,0.95,0.45,0); }
  if(mr()<0.1){ const a=mr()*6.28, r=0.5*sc; spawn(m.x+Math.cos(a)*r,0.9*sc,m.z+Math.sin(a)*r,0,-0.2,0,1.2,G(mpick([',','.'])),0.12,0.5,0.38,0.24,1); } }
function dragonForm(ty){ const {S,pts,lit,stroke,ell,tube,put}=q3(ty), SC=ty.col, BELLY=[0.95,0.78,0.5], MEM=[0.55,0.18,0.18], HORN=[0.88,0.84,0.72], EMB=[1,0.55,0.18];
  // a predator's build: a deep, heavy chest and raised shoulders tapering to a tight waist and light hips; legs thick at the top, slim below; a shorter neck holding the head high;
  // an angular head (brow ridges, a pointed snout, a jaw line, cheek spikes, long swept horns); a thick-based tail; a spined ridge largest at the shoulders
  const prof=z=>{ const f=(z+0.6)/1.05; const rx=z>0.15?0.17+0.07*Math.sin(Math.min(1,(z-0.15)/0.3)*Math.PI/2):z>-0.25?0.13+0.04*(z+0.25)/0.4:0.13; const ry=z>0.15?0.18+0.08*Math.sin(Math.min(1,(z-0.15)/0.3)*Math.PI/2):z>-0.25?0.13+0.05*(z+0.25)/0.4:0.14; const cy=z>0.15?0.7+0.04*(z-0.15)/0.3:0.66+0.04*Math.max(0,(z+0.25)/0.4); return [rx,ry,cy]; };
  for(let z=-0.6;z<=0.48;z+=S*0.85){ const [rx,ry,cy]=prof(Math.min(z,0.45)), n=Math.max(6,Math.round(2*Math.PI*Math.max(rx,ry)/(S*0.85)));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, nx=Math.cos(a), ny=Math.sin(a); put(nx*rx,cy+ny*ry,z,nx,ny,0.1,SCALE,ny<-0.5?BELLY:SC,'body'); } }
  for(const sd of [-1,1])for(let i=0;i<10;i++){ const y=1-2*(i+0.5)/10, rr=Math.sqrt(1-y*y), a=i*2.39996; if(y<-0.3)continue; put(sd*0.2+Math.cos(a)*rr*0.1,0.82+y*0.08,0.36+Math.sin(a)*rr*0.1,Math.cos(a)*rr,y,Math.sin(a)*rr,SCALE,SC,'body'); }
  for(const sd of [-1,1]){ const part=sd<0?'legL':'legR', ex={piv:0.7,pz:0.38}; tube([sd*0.2,0.72,0.38],[sd*0.21,0.38,0.4],0.095,0.06,SCALE,SC,part,ex,0.2); tube([sd*0.21,0.38,0.4],[sd*0.21,0.04,0.45],0.055,0.04,SCALE,SC,part,ex); for(let c=0;c<3;c++)lit(sd*0.21+(c-1)*0.04,0.01,0.52,'v',0.85,1.5,HORN,part,ex); }
  for(const sd of [-1,1]){ const part=sd<0?'legR':'legL', ex={piv:0.64,pz:-0.42}; tube([sd*0.15,0.66,-0.42],[sd*0.18,0.38,-0.25],0.11,0.065,SCALE,SC,part,ex,0.25); tube([sd*0.18,0.38,-0.25],[sd*0.18,0.17,-0.45],0.06,0.045,SCALE,SC,part,ex); tube([sd*0.18,0.17,-0.45],[sd*0.19,0.03,-0.36],0.045,0.035,SCALE,SC,part,ex); for(let c=0;c<3;c++)lit(sd*0.19+(c-1)*0.04,0.01,-0.3,'v',0.85,1.5,HORN,part,ex); }
  const neck=[[0,0.86,0.42],[0,1.04,0.54],[0,1.2,0.66]]; for(let i=0;i<neck.length-1;i++)tube(neck[i],neck[i+1],0.14-i*0.035,0.105-i*0.025,SCALE,(ox,oy)=>oy<-0.5?BELLY:SC,'head');
  ell([0,1.26,0.78],0.09,0.08,0.14,SCALE,(nx,ny)=>ny<-0.4?BELLY:SC,'head');
  for(const sd of [-1,1]){ stroke([sd*0.06,1.27,0.86],[sd*0.02,1.22,1.04],SC,1.3,0.9,'head'); stroke([sd*0.06,1.19,0.84],[sd*0.015,1.16,1.0],SC,1.0,0.85,'head');
    stroke([sd*0.04,1.33,0.8],[sd*0.09,1.33,0.9],HORN,1.8,0.95,'head'); lit(sd*0.07,1.29,0.9,'.',0.85,3.4,[1,0.8,0.3],'head'); lit(sd*0.12,1.22,0.78,sd<0?'<':'>',0.95,1.7,HORN,'head');
    stroke([sd*0.05,1.34,0.76],[sd*0.11,1.48,0.58],HORN,1.6,1,'head'); stroke([sd*0.11,1.48,0.58],[sd*0.14,1.52,0.4],HORN,1.6,0.9,'head'); lit(sd*0.14,1.54,0.36,'<',0.95,1.9,HORN,'head'); }
  lit(0,1.2,1.06,'v',0.85,1.4,HORN,'head'); for(let k=0;k<4;k++)lit((mr()-0.5)*0.04,1.17,1.04+k*0.015,mpick(['*','\'']),0.85,3.0,EMB,'head');
  const tail=[[0,0.64,-0.58],[0.08,0.52,-0.92],[0.22,0.34,-1.2],[0.28,0.16,-1.45]]; for(let i=0;i<tail.length-1;i++)tube(tail[i],tail[i+1],0.12-i*0.035,0.085-i*0.03,SCALE,SC,'tail',{piv:i});
  for(const sd of [-1,1])stroke([0.28,0.16,-1.45],[0.28+sd*0.08,0.12,-1.58],HORN,1.6,0.9,'tail',{piv:3}); lit(0.28,0.12,-1.62,'^',1.1,1.8,HORN,'tail',{piv:3});
  for(let k=0;k<12;k++){ const z=0.66-k*0.12, top=z>0.42?1.28-(0.66-z)*1.6:z>-0.6?prof(z)[2]+prof(z)[1]:0.64-(-0.6-z)*0.4, h=0.06+0.1*Math.max(0,1-Math.abs(z-0.3)/0.7); stroke([0,top,z],[0,top+h,z-0.06],HORN,1.6,0.9,'body'); }
  // dragon wings: an arm bone to the wrist, four finger bones fanning back, membrane filled between them with a scalloped trailing edge, a claw at the wrist.
  // drawn in the wing's own plane (r = out from the body, z = along it); the 'wing' motion raises them in a V and opens and closes them
  const WY=0.9, sh=[0.12,0.32], wr=[0.85,0.46], tips=[[1.6,0.22],[1.55,-0.36],[1.22,-0.86],[0.7,-1.06]];
  for(const sd of [-1,1]){ const W=(r,z,ch,b,col,s2)=>lit(0,WY,z,ch,s2||1,b,col,'wing',{sd,r});
    const bone=(a,b2,thick)=>{ const n=Math.max(2,Math.round(Math.hypot(b2[0]-a[0],b2[1]-a[1])/(S*0.75))); for(let k=0;k<=n;k++){ const f=k/n; W(a[0]+(b2[0]-a[0])*f,a[1]+(b2[1]-a[1])*f,thick?'=':'-',1.6,HORN,thick?1.1:1); } };
    bone(sh,wr,true); W(wr[0],wr[1]+0.06,'^',2.2,HORN,1.1); for(const tp of tips)bone(wr,tp,false);
    // membrane: fill each triangle (wrist, tip_i, tip_i+1) and (shoulder, wrist, last tip); trailing edge bows inward between tips
    const tris=[[wr,tips[0],tips[1]],[wr,tips[1],tips[2]],[wr,tips[2],tips[3]],[sh,wr,tips[3]]];
    for(const [A,B,C] of tris){ const st=S*0.85, la=Math.hypot(B[0]-A[0],B[1]-A[1]), lb=Math.hypot(C[0]-A[0],C[1]-A[1]), nu=Math.max(2,Math.round(la/st)), nv=Math.max(2,Math.round(lb/st));
      for(let i=1;i<nu;i++)for(let j=1;j<nv;j++){ const u=i/nu, v=j/nv; if(u+v>=0.98)continue; const bow=0.18*Math.sin(Math.PI*v/(u+v||1))*(u+v);
        const r=A[0]+(B[0]-A[0])*u+(C[0]-A[0])*v, z=A[1]+(B[1]-A[1])*u+(C[1]-A[1])*v; const cx=(B[0]+C[0])/2, cz=(B[1]+C[1])/2; if(u+v>0.82&&Math.hypot(r-cx,z-cz)<bow*0.9)continue;
        W(r,z,mpick(['%',':','#','.']),0.85+0.25*mr(),MEM); } }
    for(let i=0;i<tips.length-1;i++){ const B=tips[i], C=tips[i+1]; for(let k=1;k<6;k++){ const f=k/6, r=B[0]+(C[0]-B[0])*f, z=B[1]+(C[1]-B[1])*f, inw=0.16*Math.sin(Math.PI*f); const dr=wr[0]-r, dz=wr[1]-z, dl=Math.hypot(dr,dz)||1; W(r+dr/dl*inw,z+dz/dl*inw,'~',1.3,[0.75,0.3,0.28]); } } }
  return pts; }


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


