// ---------------------------------------------------------------- monsters
// ---------------------------------------------------------------- the forgotten beast (after Dwarf Fortress): the beast of this world's chronicle, built from its description
function hsl2rgb(h,s,l){ const f=n=>{ const k=(n+h*12)%12, a=s*Math.min(l,1-l); return l-a*Math.max(-1,Math.min(k-3,9-k,1)); }; return [f(0),f(8),f(4)]; }
function makeBeastType(H){
  const sp=H.beastSpec, rnd=mulberry32((runSeed^0x1234567)>>>0);
  const plan={'獣':'quad','竜':'quad','大蛇':'serpent','蛾':'moth','百足':'centipede'}[sp.kind]||'quad';
  const spec={plan,kind:sp.kind,legs:sp.feat==='六本脚の'?6:4,wings:(sp.kind==='竜'||sp.kind==='蛾')&&sp.feat!=='翼なき',eyes:sp.feat==='千の眼を持つ'?26:0,
    fire:sp.feat==='燃える鱗の',shadow:sp.feat==='影を喰らう',sing:sp.feat==='歌う',glyphs:[['#','%','&'],['=','~','x'],['%','*','#'],['&','8','%']][Math.floor(rnd()*4)]};
  const col=spec.fire?[1.0,0.42,0.14]:spec.shadow?[0.5,0.32,0.8]:hsl2rgb(rnd(),0.75,0.6);
  const lore=(H.events.find(e=>e.art==='serpent')||{}).text||`その名は、年代記の隅にだけ記されている。`;
  return {ch:'X',name:H.beast,col,form:'beast',spec,lore,scale:plan==='moth'?3.0:3.6,speed:plan==='moth'?1.0:0.55,fl:plan==='moth'?2.4:0,light:9,trail:spec.fire?8:3,flier:plan==='moth',beast:true,
    verb:'洞窟の奥で、身じろぎもせずに眠っている'};
}
function beastForm(spec){
  const pts=[], add=(x,y,z,ch,s,b,part,piv,pz)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:piv||0,pz:pz||0});
  const B=spec.glyphs, fib=(n,r,cx,cy,cz,set,s,b,part)=>{ for(let i=0;i<n;i++){ const y=1-2*(i+0.5)/n, rr=Math.sqrt(1-y*y), a=i*2.39996; add(cx+Math.cos(a)*rr*r,cy+y*r,cz+Math.sin(a)*rr*r,mpick(set),s,b,part); } };
  let head=[0,0.8,0.7];
  if(spec.plan==='quad'){
    for(let k=0;k<8;k++){ const z=-0.45+k*0.13; for(let j=0;j<7;j++){ const a=j/7*Math.PI*2; add(Math.cos(a)*0.2,0.55+Math.sin(a)*0.15,z,mpick(B),0.14,1.0,'body'); } }
    if(spec.kind==='竜'){ for(let k=0;k<4;k++)add(0,0.68+k*0.1,0.5+k*0.07,mpick(B),0.13,1.0,'head'); head=[0,1.08,0.8]; }
    fib(8,0.15,head[0],head[1],head[2],B,0.13,1.3,'head');
    const lz=spec.legs===6?[0.38,0,-0.38]:[0.36,-0.36];
    lz.forEach((z,k)=>{ for(const sx of [1,-1]){ const part=((k%2===0)===(sx>0))?'legL':'legR'; for(let q=0;q<4;q++)add(sx*0.17,0.42-q*0.13,z,mpick(['|','!','/']),0.12,0.9,part,0.45,z); } });
    for(let k=0;k<6;k++)add(0,0.6-k*0.03,-0.55-k*0.12,mpick(['~','-',B[0]]),0.12,0.9,'tail',k);
    if(spec.wings)for(const sd of [-1,1])for(let k=0;k<7;k++)pts.push({x:0,y:0.85,z:0.1,g:G(mpick(['^','v','/','\\','~'])),s:0.15,b:1.1,part:'wing',ph:mr()*6.28,piv:0,pz:0,sd,r:0.18+k*0.12});
  } else if(spec.plan==='serpent'||spec.plan==='centipede'){
    const n=spec.plan==='serpent'?18:14;
    for(let i=0;i<n;i++){ const zc=0.9-i*0.2, yc=0.22+(i<2?0.35-i*0.15:0), rr=0.16*(1-i/(n*1.4));
      for(let k=0;k<5;k++){ const a=k/5*Math.PI*2+i*0.4; add(Math.cos(a)*rr,yc+Math.sin(a)*rr,zc,mpick(B),0.15,1.0,'seg',i); }
      if(spec.plan==='centipede')for(const sd of [-1,1])add(sd*0.3,0.08,zc,sd<0?'/':'\\',0.13,0.9,'seg',i); }
    head=[0,0.62,1.0];
  } else {
    for(let k=0;k<6;k++)add(0,-0.1+k*0.1,0,mpick(B),0.13,1.1,'body');
    head=[0,0.55,0.05];
    if(spec.wings)for(const sd of [-1,1])for(const [yo,n] of [[0.18,8],[-0.08,6]])for(let k=0;k<n;k++)pts.push({x:0,y:yo,z:0,g:G(mpick(['^','v','~','*','o'])),s:0.16,b:1.2,part:'wing',ph:mr()*6.28,piv:0,pz:0,sd,r:0.14+k*0.11});
  }
  add(head[0],head[1],head[2]+0.05,spec.core||'X',0.42,3.2,spec.plan==='quad'||spec.plan==='moth'?'core':'shead',0);
  const eyes=spec.eyes||2;
  for(let k=0;k<eyes;k++){ const onHead=k<2||!spec.eyes; const p=onHead?[head[0]+(k%2?0.07:-0.07),head[1]+0.05,head[2]+0.13]:pts[Math.floor(mr()*pts.length)];
    add(p.x!==undefined?p.x:p[0],(p.y!==undefined?p.y:p[1])+0.05,p.z!==undefined?p.z:p[2],'o',0.11,3.0,onHead?'head':'body'); }
  return pts;
}

// troll: hunched, with arms that nearly reach the ground and moss hanging from the shoulders
function trollForm(){
  const L='T', pts=[], add=(x,y,z,ch,s,b,part,piv,pz)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:piv||0,pz:pz||0});
  for(let i=0;i<9;i++){ const y=1-2*(i+0.5)/9, rr=Math.sqrt(1-y*y), a=i*2.39996; add(Math.cos(a)*rr*0.15,1.26+y*0.14,0.24+Math.sin(a)*rr*0.15,mpick([L,'%','*']),0.15,1.5,'head'); }
  for(let k=0;k<5;k++){ const yy=0.88+k*0.1, lean=k*0.045; for(let j=0;j<8;j++){ const a=j/8*Math.PI*2; add(Math.cos(a)*0.26,yy,Math.sin(a)*0.17+lean,mpick(['%','&','#',L]),0.16,1.0,'body'); } }
  for(const sd of [-1,1]){
    for(let k=0;k<8;k++){ const f=k/7; add(sd*(0.34+f*0.05),1.3-f*1.05,0.12+f*0.06,mpick([L,'|','%',sd<0?'/':'\\\\']),0.15,1.0,sd<0?'armL':'armR',1.3); }
    for(let k=0;k<3;k++)add(sd*(0.36+k*0.05),0.22-k*0.03,0.2,'v',0.12,1.0,sd<0?'armL':'armR',1.3);
    for(let k=0;k<5;k++){ const f=k/4; add(sd*0.14,0.82-f*0.74,0,mpick(['|','!','#']),0.17,0.95,sd<0?'legL':'legR',0.82); }
    for(let k=0;k<4;k++)add(sd*(0.2+k*0.04),1.25-k*0.12,-0.05,mpick(['"',',',';']),0.12,0.9,'body');
  }
  add(0,1.3,0.33,L,0.4,3.0,'core');
  return pts;
}
// golem: stacked stone blocks with a rune pulsing in its chest
function golemForm(){
  const L='Y', pts=[], add=(x,y,z,ch,s,b,part,piv,pz)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:piv||0,pz:pz||0});
  for(let a=0;a<3;a++)for(let b=0;b<4;b++)for(let c=0;c<2;c++){ if(a===1&&b===2&&c===1)continue; add((a-1)*0.17,0.92+b*0.15,(c-0.5)*0.17,(a+b+c)%2?'#':'=',0.19,0.85,'body'); }
  for(let a=0;a<2;a++)for(let b=0;b<2;b++)add((a-0.5)*0.15,1.58+b*0.13,0,b?'[':']',0.17,0.9,'head');
  add(0.07,1.64,0.1,'*',0.1,3.0,'head'); add(-0.07,1.64,0.1,'*',0.1,3.0,'head');
  for(const sd of [-1,1]){
    for(let k=0;k<4;k++)add(sd*0.38,1.32-k*0.17,0,k===3?'#':'[',0.2,0.85,sd<0?'armL':'armR',1.32);
    for(let k=0;k<4;k++)add(sd*0.14,0.8-k*0.2,0,'#',0.2,0.85,sd<0?'legL':'legR',0.8);
  }
  add(0,1.24,0.12,L,0.36,3.4,'core');
  return pts;
}
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
const HUM_PROP={base:{hip:0.75,sh:1.30,hc:1.47,hk:1.0}, small:{hip:0.6,sh:1.12,hc:1.36,hk:1.25}, monkey:{hip:0.52,sh:1.1,hc:1.28,hk:1.1},
  snapjaw:{hip:0.68,sh:1.24,hc:1.43,hk:1.05,lean:0.12}, ogre:{hip:0.6,sh:1.26,hc:1.4,hk:0.9,legW:1.3}};
const LOOK_PROP={kobold:'small',goblin:'small',gnome:'small',conjurer:'small',monkey:'monkey',snapjaw:'snapjaw',ogre:'ogre'};
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
const GOLD=[1.0,0.82,0.38], BONE=[0.85,0.8,0.66], PALE=[0.75,0.9,1.0];
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

// ---------------------------------------------------------------- the Undead King (rebuilt): a floating upper body joined to its mantle only by the spine, one huge spiked shoulder and armoured arm,
// one long bone arm holding a cold flame, a crown of tall light needles, a greatsword planted in the floor with chains and rune pendants.
// Surfaces are filled densely; each glyph is chosen by how its surface faces the light (ASCII-art shading), by material.
function lichKingForm(){
  // readable glyphs: about 0.17 body units each (0.29 m at the king's size), spaced 1.2-1.5 glyphs apart; lines are drawn as one stroke of glyphs that follow their direction
  const pts=[], LD=[0.42,0.72,0.55], S=0.17, GAP=0.145;
  const RAMP={cloth:['.',':','|','|','#'], red:['.',':','|','|','#'], metal:['.',':','=','#','@'], bone:['.','o','o','0','@'], gold:['-','=','=','#','@']};
  const COL={cloth:[0.3,0.27,0.4], red:[0.72,0.14,0.16], metal:[0.44,0.44,0.5], bone:[0.9,0.86,0.74], gold:[1.0,0.78,0.34], blade:[0.8,0.82,0.88], ice:[0.6,0.86,1.0], chain:[0.75,0.72,0.66]};
  const put=(x,y,z,nx,ny,nz,mat,part,s)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=RAMP[mat];
    pts.push({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:s||S,b:0.45+(mat==='gold'?1.2:0.95)*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col:COL[mat]}); };
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  // a stroke: glyphs following the line's direction as seen from the front (| / \ -)
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,step)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(step||0.15))), ch=strokeCh(dx,dy);
    for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part); } };
  const shell=(cx,cy,cz,rx,ry,rz,mat,part,keep)=>{ for(let v=0.2;v<=Math.PI-0.2;v+=GAP/Math.max(rx,ry,rz)){ const sv=Math.sin(v), cv=Math.cos(v), n=Math.max(5,Math.round(2*Math.PI*Math.max(rx,rz)*sv/GAP));
      for(let k=0;k<n;k++){ const u=k/n*Math.PI*2+v, nx=Math.cos(u)*sv, ny=cv, nz=Math.sin(u)*sv; if(keep&&!keep(nx,ny,nz))continue; put(cx+nx*rx,cy+ny*ry,cz+nz*rz,nx/rx,ny/ry,nz/rz,mat,part); } } };
  const ring=(cx,cy,cz,rx,rz,n,mat,part,s)=>{ for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; put(cx+Math.cos(a)*rx,cy,cz+Math.sin(a)*rz,Math.cos(a),0.2,Math.sin(a),mat,part,s); } };
  // 1. the mantle column: fold lines of | from the waist to the torn hem, a crimson slit at the front
  for(let y=0.05;y<1.12;y+=0.115){ const f=y/1.12, r=0.78-0.4*f, n=Math.round(2*Math.PI*r/0.14);
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+(y*3)%0.3, nx=Math.cos(a), nz=Math.sin(a), front=Math.abs(Math.atan2(nx,nz))<0.4;
      if(f<0.2&&mr()<0.3)continue; put(nx*r,y,nz*r*0.92,nx,0.25,nz,front?'red':'cloth','robe'); } }
  // 2. the spine
  for(let y=1.14;y<1.5;y+=0.1)lit(0,y,-0.02,'o',0.13,1.1,COL.bone,'body');
  // 3. the floating chest, gold at the waist and the collar
  shell(0,1.76,0,0.4,0.3,0.25,'metal','body',(nx,ny)=>ny>-0.85);
  ring(0,1.5,0,0.34,0.22,18,'gold','body'); ring(0,2.02,0,0.24,0.18,13,'gold','body');
  // 4. the skull, with large cold eyes and teeth
  shell(0,2.2,0.02,0.15,0.17,0.15,'bone','head');
  lit(0.06,2.22,0.16,'*',0.16,4.0,COL.ice,'head'); lit(-0.06,2.22,0.16,'*',0.16,4.0,COL.ice,'head'); lit(0,2.1,0.16,'=',0.13,1.2,COL.bone,'head');
  // 5. the crown: a gold band, tall needles of light
  ring(0,2.36,0,0.16,0.15,9,'gold','head',0.14);
  for(let k=0;k<9;k++){ const a=k/9*Math.PI*2, h=0.32+0.3*Math.abs(Math.sin(k*1.7)), lean=0.12, base=[Math.cos(a)*0.16,2.42,Math.sin(a)*0.15], tip=[Math.cos(a)*(0.16+lean),2.42+h,Math.sin(a)*(0.15+lean)];
    stroke(base,tip,COL.gold,2.0,0.13,'head',0.13); lit(tip[0],tip[1]+0.06,tip[2],'^',0.18,3.6,COL.ice,'head'); }
  // 6. the huge shoulder (right), its rim and spikes
  shell(0.56,1.98,0,0.3,0.24,0.28,'metal','body',(nx,ny)=>ny>-0.2);
  ring(0.56,1.93,0,0.3,0.28,16,'gold','body');
  for(let k=0;k<6;k++){ const a=-0.3+k*0.55, d=[Math.cos(a)*0.6,0.8,Math.sin(a)*0.4], b0=[0.56+d[0]*0.22,1.98+d[1]*0.14,d[2]*0.22], b1=[0.56+d[0]*0.56,1.98+d[1]*0.48,d[2]*0.56];
    stroke(b0,b1,COL.gold,1.8,0.13,'body',0.13); lit(b1[0],b1[1]+0.05,b1[2],'^',0.15,2.6,COL.gold,'body'); }
  // 7. the armoured arm (right): plates, gold joints, elbow spikes, a gauntlet on the sword's grip
  const sh=[0.66,1.8,0.02], el=[0.82,1.36,0.1], wr=[0.86,1.02,0.22];
  for(const [a,b] of [[sh,el],[el,wr]]){ const L=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]); for(let t=0;t<=L;t+=0.13)for(let k=0;k<6;k++){ const an=k/6*Math.PI*2+t*2, f=t/L; put(a[0]+(b[0]-a[0])*f+Math.cos(an)*0.12,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f+Math.sin(an)*0.12,Math.cos(an),0,Math.sin(an),'metal','body'); } }
  for(const j of [el,wr])ring(j[0],j[1],j[2],0.14,0.14,6,'gold','body',0.13);
  stroke([el[0]+0.08,el[1],el[2]-0.04],[el[0]+0.3,el[1]+0.05,el[2]-0.16],COL.gold,1.8,0.13,'body',0.12);
  // 8. the bone arm (left), long, its claws holding a cold flame
  const lsh=[-0.4,1.86,0], lel=[-0.7,1.38,0.12], lwr=[-0.62,0.98,0.42];
  stroke(lsh,lel,COL.bone,1.3,0.14,'body',0.12); stroke(lel,lwr,COL.bone,1.3,0.14,'body',0.12);
  lit(lel[0],lel[1],lel[2],'o',0.14,1.4,COL.bone,'body');
  for(let f=0;f<3;f++)stroke([lwr[0]+(f-1)*0.06,lwr[1]+0.04,lwr[2]+0.04],[lwr[0]+(f-1)*0.08,lwr[1]+0.14,lwr[2]+0.2],COL.bone,1.3,0.11,'body',0.08);
  for(let k=0;k<5;k++)lit(0,lwr[1]+0.32+k*0.03,0,k?'\'':'*',k?0.12:0.22,k?2.6:4.2,COL.ice,'spin',{cx:lwr[0],cz:lwr[2]+0.12,r:0.03+0.03*(k%3),sp:2.4+k*0.4,ph:k*1.2});
  // 9. the greatsword, planted; chains with rune pendants from the guard
  const sx=1.12, sz=0.32;
  for(const o of [-0.06,0.06])stroke([sx+o,0.08,sz],[sx+o,2.0,sz],COL.blade,1.5,0.15,'body',0.15);
  stroke([sx,0.02,sz],[sx,1.95,sz],COL.gold,1.2,0.1,'body',0.3);
  stroke([sx-0.32,2.04,sz],[sx+0.32,2.04,sz],COL.gold,2.0,0.15,'body',0.12); lit(sx-0.38,2.08,sz,'<',0.14,2.2,COL.gold,'body'); lit(sx+0.38,2.08,sz,'>',0.14,2.2,COL.gold,'body');
  stroke([sx,2.1,sz],[sx,2.38,sz],COL.metal,1.2,0.14,'body',0.12); lit(sx,2.46,sz,'@',0.2,2.6,COL.gold,'body');
  for(const side of [-1,1]){ const ax=sx+side*0.24; for(let t=0;t<=1;t+=0.14){ lit(ax+side*0.12*t,2.0-0.75*t,sz+0.04,t*7%2<1?'o':'.',0.11,1.3,COL.chain,'body'); }
    lit(ax+side*0.12,1.18,sz+0.04,RUNE_CHARS[side>0?0:6],0.2,3.0,COL.ice,'body'); }
  return pts;
}
// presence: the swords of the fallen planted around, a ring of frost, cold mist, the flame's sparks, a low drone close by
function lichAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>30)return;
  if(!m.swords){ m.swords=[]; for(let k=0;k<7;k++){ const a=k/7*Math.PI*2+mr()*0.4, r=(1.7+mr()*0.9)*sc; m.swords.push({x:m.x+Math.cos(a)*r,z:m.z+Math.sin(a)*r,tx:(mr()-0.5)*0.5,tz:(mr()-0.5)*0.5,h:0.8+mr()*0.5}); } }
  for(const s of m.swords){ for(let y=0;y<s.h;y+=0.12)dyn(s.x+s.tx*y,y,s.z+s.tz*y,G('|'),0.14,0.42,0.42,0.48); dyn(s.x+s.tx*s.h,s.h,s.z+s.tz*s.h,G('+'),0.18,0.55,0.48,0.32); }
  const n=36; for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.05, r=(1.3+0.12*Math.sin(t*0.7+k))*sc; dyn(m.x+Math.cos(a)*r,0.05,m.z+Math.sin(a)*r,G(k%3?'.':'*'),0.12,0.45,0.65,0.9); }
  if(mr()<0.25){ const a=mr()*6.28, r=mr()*1.2*sc; spawn(m.x+Math.cos(a)*r,0.15,m.z+Math.sin(a)*r,Math.cos(a)*0.25,0.08,Math.sin(a)*0.25,2.2,G(mpick(['~','.'])),0.22,0.3,0.4,0.55,0); }
  if(dp<14&&time>(m.droneT||0)&&sndReady()){ m.droneT=time+3.2; const t0=SND.ctx.currentTime, o=sOut(m.x,m.z,0.16); sEnv(sTone(t0,'sine',55,52,3,o),t0,0.6,2.3); sEnv(sTone(t0,'sine',82.5,80,3,o),t0,0.8,2.1,0.5); } }

// ---------------------------------------------------------------- the Spider Queen: held high on eight arched legs, a lantern abdomen glowing amber through its plates, a cluster of eyes,
// a crown spun of silver thread, threads up to the dark with prey cocoons hanging; readable glyphs (0.12 body units = about 0.29 m at her size)
function spiderQueenForm(){
  const pts=[], LD=[0.42,0.72,0.55], S=0.12, GAP=0.1;
  const COL={chitin:[0.74,0.64,0.92], silver:[0.86,0.88,0.96], amber:[1.0,0.68,0.28], eye:[1.0,0.55,0.85], cocoon:[0.88,0.86,0.8]};
  const RAMP={chitin:['.',':','o','%','@'], cocoon:['.',':','0','0','@']};
  const put=(x,y,z,nx,ny,nz,mat,part,s,extra)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=RAMP[mat];
    pts.push(Object.assign({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:s||S,b:0.45+0.95*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col:COL[mat]},extra||{})); };
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,step,extra)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(step||0.1))), ch=strokeCh(dx,dy);
    for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part,extra); } };
  const shell=(cx,cy,cz,rx,ry,rz,mat,part,glow)=>{ for(let v=0.2;v<=Math.PI-0.15;v+=GAP/Math.max(rx,ry,rz)){ const sv=Math.sin(v), cv=Math.cos(v), n=Math.max(5,Math.round(2*Math.PI*Math.max(rx,rz)*sv/GAP));
      for(let k=0;k<n;k++){ const u=k/n*Math.PI*2+v, nx=Math.cos(u)*sv, ny=cv, nz=Math.sin(u)*sv, x=cx+nx*rx, y=cy+ny*ry, z=cz+nz*rz;
        if(glow&&glow(nx,ny,nz))lit(x,y,z,mpick(['*','+','\'']),S*0.9,2.6+mr(),COL.amber,part); else put(x,y,z,nx/rx,ny/ry,nz/rz,mat,part); } } };
  // the eight legs: hip, a high knee, a far foot; each swings from its hip
  for(const sx of [1,-1])for(let k=0;k<4;k++){ const hz=0.32-k*0.16, part=((k%2===0)===(sx>0))?'legL':'legR', ex={piv:1.12,pz:hz};
    const hip=[sx*0.14,1.12,hz], knee=[sx*(0.5+k*0.04),1.62-k*0.05,hz+(1.5-k)*0.14], foot=[sx*(0.95+k*0.05),0.02,hz+(1.5-k)*0.42];
    for(const [a,b,w0,w1] of [[hip,knee,0.06,0.045],[knee,foot,0.045,0.022]]){ for(const o of [-1,0,1]){ const off=f=>o*(w0+(w1-w0)*f); const n=Math.max(2,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/0.1));
        for(let q=0;q<=n;q++){ const f=q/n; lit(a[0]+(b[0]-a[0])*f+off(f)*sx*0.4,a[1]+(b[1]-a[1])*f+off(f),a[2]+(b[2]-a[2])*f,strokeCh(b[0]-a[0],b[1]-a[1]),S*(o?0.85:1),o?0.8:1.15,COL.chitin,part,ex); } }
      for(let q=1;q<5;q++){ const f=q/5; lit(a[0]+(b[0]-a[0])*f+sx*0.07,a[1]+(b[1]-a[1])*f+0.04,a[2]+(b[2]-a[2])*f,mpick([',','"']),S*0.7,0.7,[0.55,0.48,0.62],part,ex); } }
    lit(knee[0],knee[1],knee[2],'o',S*1.5,1.6,COL.chitin,part,ex); lit(foot[0],foot[1]+0.03,foot[2],'^',S,1.2,COL.chitin,part,ex); }
  // head-chest and the eye cluster
  shell(0,1.14,0.2,0.2,0.13,0.22,'chitin','body');
  shell(0,1.2,0.46,0.1,0.09,0.1,'chitin','head');
  for(let e=0;e<24;e++){ const row=Math.floor(e/6), k=e%6, a=(k/5-0.5)*1.5, b=0.5-row*0.28; lit(Math.sin(a)*0.1*Math.cos(b),1.2+Math.sin(b)*0.09,0.46+Math.cos(a)*0.1*Math.cos(b),'*',S*(row<2?0.9:0.65),row<2?3.6:2.6,COL.eye,'head'); }
  for(let k=0;k<7;k++)lit((mr()-0.5)*0.3,1.27,0.1+mr()*0.25,'.',S*0.8,2.4,COL.eye,'body');
  for(let k=0;k<14;k++)lit((mr()-0.5)*0.36,1.2+mr()*0.05,(mr()-0.2)*0.4,mpick([',','"']),S*0.7,0.7,[0.55,0.48,0.62],'body');
  // fangs: thick curved chelicerae, and the palps beside them
  for(const sx of [1,-1]){ const p0=[sx*0.05,1.14,0.55], p1=[sx*0.08,0.98,0.66], p2=[sx*0.03,0.86,0.62];
    for(const o of [-0.02,0.02]){ stroke([p0[0]+o,p0[1],p0[2]],[p1[0]+o,p1[1],p1[2]],[0.5,0.42,0.55],1.3,S,'head',0.06); stroke([p1[0]+o,p1[1],p1[2]],[p2[0]+o,p2[1],p2[2]],[0.85,0.82,0.78],1.6,S*0.9,'head',0.06); }
    lit(p2[0],p2[1]-0.03,p2[2],'\'',S*0.9,2.4,[0.55,1.0,0.5],'head');
    const q0=[sx*0.11,1.12,0.5], q1=[sx*0.2,1.0,0.66], q2=[sx*0.16,0.9,0.76]; stroke(q0,q1,COL.chitin,1.1,S*0.85,'head',0.07); stroke(q1,q2,COL.chitin,1.1,S*0.85,'head',0.07); lit(q1[0],q1[1],q1[2],'o',S,1.4,COL.chitin,'head'); }
  // a crown spun of thread
  for(let k=0;k<7;k++){ const a=(k/6-0.5)*1.6; stroke([Math.sin(a)*0.08,1.28,0.46+Math.cos(a)*0.03],[Math.sin(a)*0.16,1.55+0.06*Math.cos(a*2),0.42],COL.silver,1.9,S*0.85,'head',0.07); lit(Math.sin(a)*0.16,1.6,0.42,'\'',S,3,COL.silver,'head'); }
  // the lantern abdomen: plates of chitin, amber light through the cracks, a core inside
  shell(0,1.26,-0.6,0.42,0.38,0.52,'chitin','body',(nx,ny,nz)=>Math.sin(nx*9+nz*7)>0.72||Math.abs(ny)<0.12&&Math.sin(nz*20)>0);
  for(let k=0;k<6;k++)lit((mr()-0.5)*0.26,1.26+(mr()-0.5)*0.26,-0.6+(mr()-0.5)*0.32,'*',S*1.6,3.4,COL.amber,'body');
  // threads up into the dark, prey cocoons hanging from them; the spinnerets' line to the floor
  for(const [x,z] of [[0.18,-0.6],[-0.2,-0.4],[0.05,-0.8],[-0.1,-0.2]])stroke([x,1.46,z],[x*2.6,3.0,z*1.6],COL.silver,1.0,S*0.75,'body',0.12);
  for(const [x,y,z] of [[0.62,2.1,-0.9],[-0.66,2.35,-0.5],[0.3,1.95,0.6]]){ stroke([x,2.9,z],[x,y+0.2,z],COL.silver,0.9,S*0.7,'body',0.12); for(let k=0;k<6;k++)put(x+(mr()-0.5)*0.08,y-k*0.06+0.12,z+(mr()-0.5)*0.08,(mr()-0.5),0.3,0.8,'cocoon','body',S*0.95); lit(x,y-0.04,z+0.03,'*',S*0.8,1.8,COL.amber,'body'); }
  stroke([0,0.92,-1.1],[0,0.02,-1.45],COL.silver,1.0,S*0.75,'body',0.12);
  return pts;
}
// her floor: a radial web and spiderlings running on it
function spiderAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>30)return;
  if(mr()<0.12){ const cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), lx=(mr()<0.5?1:-1)*0.03*sc, lz=0.62*sc; spawn(m.x+lx*cy+lz*sy,m.y+0.82*sc,m.z-lx*sy+lz*cy,0,-0.2,0,1.2,G('.'),0.12,0.5,1.0,0.45,1); }
  for(let k=0;k<10;k++){ const a=k/10*Math.PI*2+0.2; const dark=k%3===0; for(let r=0.5;r<2.6;r+=0.28)dyn(m.x+Math.cos(a)*r*sc,0.04,m.z+Math.sin(a)*r*sc,G(k%2?'/':'\\'),0.12,dark?0.14:0.38,dark?0.1:0.4,dark?0.18:0.48); }
  for(let r=0.9;r<2.6;r+=0.55){ const n=Math.round(r*14); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; dyn(m.x+Math.cos(a)*r*sc,0.04,m.z+Math.sin(a)*r*sc,G('.'),0.1,0.32,0.34,0.42); } }
  for(let k=0;k<5;k++){ const a=t*(0.5+k*0.13)+k*1.3, r=(1.2+0.6*Math.sin(t*0.7+k))*sc; dyn(m.x+Math.cos(a)*r,0.08,m.z+Math.sin(a)*r,G('s'),0.16,0.75,0.65,0.95); } }

// ---------------------------------------------------------------- the Naga Queen: a coiled serpent throne, an upright body with four arms (two curved blades, a mirror, an open hand),
// a cobra hood with glowing eye patterns, a tall gold crown; jade scales and gold; readable glyphs (0.11 body units = about 0.29 m at her size)
function nagaQueenForm(){
  const pts=[], LD=[0.42,0.72,0.55], S=0.11;
  const COL={jade:[0.32,0.8,0.55], belly:[0.86,0.86,0.6], skin:[0.55,0.82,0.62], gold:[1.0,0.8,0.36], steel:[0.82,0.86,0.9], teal:[0.4,1.0,0.85], mirror:[0.75,0.95,1.0]};
  const RAMP={jade:['.',':','=','%','#'], belly:['.','-','=','=','#'], skin:['.',':','o','0','@'], gold:['-','=','=','#','@']};
  const put=(x,y,z,nx,ny,nz,mat,part,s)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=RAMP[mat];
    pts.push({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:s||S,b:0.45+(mat==='gold'?1.2:0.95)*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col:COL[mat]}); };
  const lit=(x,y,z,ch,s,b,col,part)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col});
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,step)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(step||0.09))), ch=strokeCh(dx,dy);
    for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part); } };
  // a tube along a path: scales on top, pale belly underneath
  const tube=(path,r0,r1,part)=>{ for(let i=0;i<path.length-1;i++){ const a=path[i], b=path[i+1], f=i/(path.length-1), r=r0+(r1-r0)*f;
      const tx=b[0]-a[0], ty=b[1]-a[1], tz=b[2]-a[2], tl=Math.hypot(tx,ty,tz)||1; let px=-tz/tl, pz=tx/tl, py=0; if(Math.hypot(px,pz)<0.1){ px=1; pz=0; }
      const qx=(ty/tl)*pz-(tz/tl)*py, qy=(tz/tl)*px-(tx/tl)*pz, qz=(tx/tl)*py-(ty/tl)*px, n=Math.max(5,Math.round(2*Math.PI*r/0.1));
      for(let k=0;k<n;k++){ const an=k/n*Math.PI*2+i*0.5, ox=Math.cos(an)*px+Math.sin(an)*qx, oy=Math.cos(an)*py+Math.sin(an)*qy, oz=Math.cos(an)*pz+Math.sin(an)*qz;
        put(a[0]+ox*r,a[1]+oy*r,a[2]+oz*r,ox,oy,oz,oy<-0.35?'belly':'jade',part); } } };
  // 1. the coil: two turns rising from the floor, the tail running out
  const coil=[]; for(let t=0;t<=1;t+=0.03){ const a=t*Math.PI*2*2.1, r=0.66-0.4*t; coil.push([Math.cos(a)*r,0.12+0.4*t,Math.sin(a)*r]); }
  tube(coil,0.15,0.17,'body');
  const tail=[]; for(let t=0;t<=1;t+=0.08){ const a=-t*1.6; tail.push([Math.cos(a)*(0.66+0.4*t),0.1-0.05*t,Math.sin(a)*(0.66+0.4*t)]); } tube(tail,0.14,0.04,'body');
  const trunk=[]; for(let t=0;t<=1;t+=0.12)trunk.push([coil[coil.length-1][0]*(1-t),0.52+0.43*t,coil[coil.length-1][2]*(1-t)+0.05*t]); tube(trunk,0.17,0.15,'body');
  // 2. the upright body: skin, a gold belt and neck ornament
  for(let y=0.95;y<1.36;y+=0.08){ const r=0.15+0.05*Math.sin((y-0.95)/0.41*Math.PI), n=Math.round(2*Math.PI*r/0.1); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; put(Math.cos(a)*r,y,Math.sin(a)*r*0.75+0.05,Math.cos(a),0,Math.sin(a),'skin','body'); } }
  for(let k=0;k<12;k++){ const a=k/12*Math.PI*2; put(Math.cos(a)*0.17,0.97,Math.sin(a)*0.13+0.05,Math.cos(a),0,Math.sin(a),'gold','body'); put(Math.cos(a)*0.16,1.34,Math.sin(a)*0.12+0.05,Math.cos(a),0.4,Math.sin(a),'gold','body'); }
  // 3. the head, slit eyes, a tall crown with a gem
  for(let i=0;i<16;i++){ const y=1-2*(i+0.5)/16, rr=Math.sqrt(1-y*y), a=i*2.39996; put(Math.cos(a)*rr*0.09,1.5+y*0.11,0.07+Math.sin(a)*rr*0.09,Math.cos(a)*rr,y,Math.sin(a)*rr,'skin','head'); }
  lit(0.035,1.52,0.16,'*',S*0.8,3.4,COL.gold,'head'); lit(-0.035,1.52,0.16,'*',S*0.8,3.4,COL.gold,'head');
  for(let k=0;k<5;k++){ const a=(k/4-0.5)*1.4; stroke([Math.sin(a)*0.09,1.6,0.07+Math.cos(a)*0.05],[Math.sin(a)*0.06,1.78+0.08*(k===2),0.06],COL.gold,2.0,S*0.9,'head',0.06); }
  lit(0,1.92,0.06,'*',S*1.4,3.6,COL.teal,'head');
  // 4. the hood: a broad fan behind the neck with glowing eye patterns
  for(let y=1.22;y<1.78;y+=0.07){ const f=(y-1.22)/0.56, w=0.12+0.34*Math.sin(Math.PI*Math.min(1,f*1.15)); const n=Math.round(w*2/0.075);
    for(let k=0;k<=n;k++){ const x=-w+k*(2*w/n), z=-0.06-0.1*(x/w)*(x/w); put(x,y,z,x*0.8,0.2,0.6,'jade','head'); } }
  for(const [x,y] of [[0.24,1.52],[-0.24,1.52],[0.3,1.38],[-0.3,1.38],[0.17,1.65],[-0.17,1.65]]){ lit(x,y,-0.02,'O',S*1.2,3.0,COL.teal,'head'); lit(x,y,-0.01,'.',S*0.6,3.6,[1,1,1],'head'); }
  // 5. four arms: two curved blades, a mirror, an open hand
  const arm=(a,b,c)=>{ stroke(a,b,COL.skin,1.2,S,'body',0.08); stroke(b,c,COL.skin,1.2,S,'body',0.08); lit(b[0],b[1],b[2],'o',S,1.4,COL.skin,'body'); lit(c[0],c[1],c[2],'o',S*1.1,2.0,COL.gold,'body'); };
  arm([0.2,1.33,0.05],[0.42,1.5,0.12],[0.5,1.74,0.16]);
  for(let t=0;t<=1;t+=0.08){ const a=t*1.6; lit(0.5+Math.sin(a)*0.18,1.78+t*0.5,0.16+(1-Math.cos(a))*0.08,t<0.5?'|':'/',S,2.0,COL.steel,'body'); }
  arm([-0.2,1.33,0.05],[-0.45,1.26,0.15],[-0.64,1.3,0.32]);
  for(let t=0;t<=1;t+=0.08){ const a=t*1.6; lit(-0.64-Math.sin(a)*0.12,1.3+Math.sin(a)*0.18,0.32+t*0.42,t<0.6?'-':'\\',S,2.0,COL.steel,'body'); }
  arm([0.18,1.2,0.06],[0.34,1.05,0.2],[0.38,1.0,0.36]);
  for(let k=0;k<12;k++){ const a=k/12*Math.PI*2; lit(0.38+Math.cos(a)*0.12,1.08+Math.sin(a)*0.12,0.42,'=',S*0.9,1.8,COL.gold,'body'); } lit(0.38,1.08,0.43,'*',S*1.3,3.0,COL.mirror,'body');
  arm([-0.18,1.2,0.06],[-0.3,1.1,0.3],[-0.28,1.06,0.55]);
  for(let f=0;f<4;f++)lit(-0.28+(f-1.5)*0.03,1.06,0.62,'\'',S*0.8,1.3,COL.skin,'body');
  return pts;
}
// her floor: ripples of water, small snakes, a hiss close by
function nagaAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>30)return;
  for(let r=1.1;r<2.4;r+=0.45){ const n=Math.round(r*16); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.1*(r>1.6?-1:1); dyn(m.x+Math.cos(a)*r*sc,0.04+0.02*Math.sin(t*2+k),m.z+Math.sin(a)*r*sc,G('~'),0.12,0.2,0.5,0.55); } }
  for(let k=0;k<4;k++){ const a=t*(0.4+k*0.11)+k*1.6, r=(1.3+0.5*Math.sin(t*0.6+k))*sc; for(let q=0;q<4;q++){ const aa=a-q*0.06; dyn(m.x+Math.cos(aa)*r,0.08,m.z+Math.sin(aa)*r,G(q?'~':'n'),0.15,0.4,0.85,0.45); } }
  if(dp<12&&time>(m.hissT||0)&&sndReady()){ m.hissT=time+4+mr()*3; const t0=SND.ctx.currentTime; sEnv(sNoise(t0,0.9,'highpass',3000,0.7,sOut(m.x,m.z,0.18)),t0,0.15,0.7); } }

// ---------------------------------------------------------------- the Old Dragon: asleep on its hoard, a low mound of a body, a long arched neck with a horned head on the floor,
// wings folded like torn sails, a spine of jagged plates grown over with moss and crystal, scars, embers between the teeth; readable glyphs (0.08 body units = about 0.29 m at its size)
function oldDragonForm(){
  const pts=[], LD=[0.42,0.72,0.55], S=0.08;
  const COL={scale:[0.78,0.38,0.24], plate:[0.62,0.5,0.42], moss:[0.45,0.8,0.35], crystal:[0.55,0.95,1.0], horn:[0.86,0.8,0.66], wing:[0.55,0.24,0.2], scar:[0.95,0.3,0.22], ember:[1.0,0.55,0.18]};
  const RAMP={scale:['.',':','=','%','#'], wing:['.',':','%','%','#']};
  const put=(x,y,z,nx,ny,nz,mat,part,s)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=RAMP[mat];
    pts.push({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:s||S,b:0.45+0.95*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col:COL[mat]}); };
  const lit=(x,y,z,ch,s,b,col,part)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col});
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,step)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(step||0.07))), ch=strokeCh(dx,dy);
    for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part); } };
  const tube=(path,r0,r1,mat,part,step)=>{ for(let i=0;i<path.length-1;i++){ const a=path[i], b=path[i+1], f=i/(path.length-1), r=r0+(r1-r0)*f;
      const tx=b[0]-a[0], ty=b[1]-a[1], tz=b[2]-a[2], tl=Math.hypot(tx,ty,tz)||1; let px=-tz/tl, pz=tx/tl, py=0; if(Math.hypot(px,pz)<0.1){ px=1; pz=0; }
      const qx=(ty/tl)*pz-(tz/tl)*py, qy=(tz/tl)*px-(tx/tl)*pz, qz=(tx/tl)*py-(ty/tl)*px, n=Math.max(5,Math.round(2*Math.PI*r/(step||0.1)));
      if(i%2&&r<0.12)continue;
      for(let k=0;k<n;k++){ const an=k/n*Math.PI*2+i*0.5, ox=Math.cos(an)*px+Math.sin(an)*qx, oy=Math.cos(an)*py+Math.sin(an)*qy, oz=Math.cos(an)*pz+Math.sin(an)*qz; if(a[1]+oy*r<0.02)continue;
        put(a[0]+ox*r,a[1]+oy*r,a[2]+oz*r,ox,oy,oz,mat,part); } } };
  const curve=(p0,p1,p2,n)=>{ const out=[]; for(let i=0;i<=n;i++){ const t=i/n, a=(1-t)*(1-t), b=2*(1-t)*t, c=t*t; out.push([a*p0[0]+b*p1[0]+c*p2[0],a*p0[1]+b*p1[1]+c*p2[1],a*p0[2]+b*p1[2]+c*p2[2]]); } return out; };
  // 1. the mound of the body
  for(let v=0.15;v<=Math.PI*0.62;v+=0.1/0.55){ const sv=Math.sin(v), cv=Math.cos(v), n=Math.max(6,Math.round(2*Math.PI*0.8*sv/0.1));
    for(let k=0;k<n;k++){ const u=k/n*Math.PI*2+v, nx=Math.cos(u)*sv, ny=cv, nz=Math.sin(u)*sv; put(nx*0.55,0.4+ny*0.4,nz*0.8,nx/0.55,ny/0.4,nz/0.8,'scale','body'); } }
  for(let k=0;k<4;k++){ const z=-0.25+k*0.14; stroke([0.52,0.42+k*0.03,z],[0.5,0.32+k*0.03,z+0.12],COL.scar,1.8,S,'body',0.05); }
  // 2. the spine's jagged plates, moss and crystal
  for(let t=0;t<=1;t+=0.06){ const z=0.72-t*1.5, y=0.8-0.25*t*t+0.02*Math.sin(t*20), h=0.1+0.08*Math.abs(Math.sin(t*9));
    stroke([0,y,z],[0,y+h,z-0.04],COL.plate,1.4,S,'body',0.05); lit(0,y+h+0.03,z-0.05,'^',S*1.1,1.6,COL.plate,'body');
    if(Math.sin(t*13)>0.3)lit((mr()-0.5)*0.12,y+0.03,z+0.04,mpick([',','"']),S,1.3,COL.moss,'body');
    if(Math.sin(t*7+1)>0.75)lit(0.06*(mr()<0.5?1:-1),y+0.05,z,mpick(['*','<','>']),S*1.2,2.6,COL.crystal,'body'); }
  // 3. the neck arching forward, the head lying on the floor
  tube(curve([0,0.62,0.68],[0.05,1.05,1.05],[0.25,0.2,1.5],12),0.17,0.12,'scale','body');
  tube(curve([0.25,0.2,1.5],[0.3,0.2,1.75],[0.36,0.12,2.02],6),0.13,0.06,'scale','head');
  for(const sd of [1,-1])for(let k=0;k<2;k++){ const b0=[0.25+sd*(0.06+k*0.04),0.3,1.58-k*0.06]; stroke(b0,[0.25+sd*(0.22+k*0.08),0.58-k*0.12,1.18-k*0.1],COL.horn,1.5,S*1.1,'head',0.05); }
  for(const sd of [1,-1])stroke([0.25+sd*0.09,0.27,1.72],[0.25+sd*0.11,0.27,1.82],[0.5,0.3,0.2],1.0,S*0.9,'head',0.04);
  // embers between the teeth
  for(let k=0;k<7;k++)lit(0.33+(mr()-0.5)*0.06,0.12+mr()*0.04,1.88+k*0.02,mpick(['*','\'','.']),S*(1+mr()*0.5),3.2+mr(),COL.ember,'head');
  for(let k=0;k<8;k++)lit(0.35+(k%2?0.05:-0.05),0.1,1.82+k*0.025,'v',S*0.8,1.2,COL.horn,'head');
  // 4. wings folded like torn sails
  for(const sd of [1,-1]){ const sh=[sd*0.42,0.72,0.42], wr=[sd*0.72,1.3,-0.12], tip=[sd*0.68,0.32,-1.0];
    stroke(sh,wr,COL.horn,1.3,S*1.1,'body',0.05); stroke(wr,tip,COL.horn,1.2,S,'body',0.06);
    for(let f=0;f<3;f++){ const e=[sd*(0.64-f*0.04),0.3+f*0.04,0.1-f*0.35]; stroke(wr,e,COL.horn,1.0,S*0.9,'body',0.07);
      for(let q=0;q<18;q++){ const u=mr(), v=mr(); if(mr()<0.22)continue; const nxt=f<2?[sd*(0.64-(f+1)*0.04),0.3+(f+1)*0.04,0.1-(f+1)*0.35]:tip;
        const x=wr[0]+(e[0]-wr[0])*u+(nxt[0]-e[0])*u*v, y=wr[1]+(e[1]-wr[1])*u+(nxt[1]-e[1])*u*v, z=wr[2]+(e[2]-wr[2])*u+(nxt[2]-e[2])*u*v; put(x,y,z,sd,0.2,0,'wing','body'); } } }
  // 5. the tail curling round to the front, spiked
  const tail=curve([0,0.3,-0.75],[-1.2,0.1,-0.3],[-0.7,0.06,0.95],18); tube(tail,0.18,0.04,'scale','body');
  for(let i=0;i<tail.length;i+=2)lit(tail[i][0],tail[i][1]+0.18*(1-i/tail.length)+0.04,tail[i][2],'^',S,1.4,COL.plate,'body');
  // 6. forelegs and claws beside the head
  for(const sd of [1,-1]){ const a=[sd*0.35,0.35,0.55], b=[sd*0.45,0.1,0.9]; tube([a,b],0.09,0.07,'scale','body'); for(let c=0;c<3;c++)stroke([b[0]+(c-1)*0.05,0.06,b[2]+0.05],[b[0]+(c-1)*0.07,0.02,b[2]+0.15],COL.horn,1.3,S*0.9,'body',0.04); }
  return pts;
}
// its hoard and its breath: coins, cups and chests around and beneath; smoke from the nostrils now and then
function dragonAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>36)return;
  if(!m.hoard){ m.hoard=[]; for(let k=0;k<70;k++){ const a=mr()*6.28, r=(0.4+mr()*0.9)*sc; m.hoard.push({x:m.x+Math.cos(a)*r,z:m.z+Math.sin(a)*r,y:0.05+mr()*0.15,ch:mpick(['$','o','$','o','U','#','*'])}); } }
  for(const h of m.hoard)dyn(h.x,h.y,h.z,G(h.ch),0.2,h.ch==='*'?1.6:1.1,h.ch==='*'?1.4:0.85,h.ch==='*'?0.9:0.3);
  if(mr()<0.05){ const cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), lx=0.36*sc, lz=2.0*sc; spawn(m.x+lx*cy+lz*sy,m.y+0.25*sc,m.z-lx*sy+lz*cy,(mr()-0.5)*0.2,0.5,(mr()-0.5)*0.2,2.4,G('~'),0.3,0.35,0.32,0.3,0); } }

