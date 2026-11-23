// ---------------------------------------------------------------- the forgotten beast, built from parts by its chronicle: a body by kind (beast, dragon, serpent, moth, centipede),
// features laid over it (six legs, wingless, a thousand eyes, burning scales, shadow-eating, singing), a main colour and an accent; it sleeps crouched and rises when it wakes
const BEAST_S={scale:2.35};   // glyphs of about 0.3 m at the beast's size
function beastAcc(col){ return [Math.min(1,col[2]*0.9+0.25),Math.min(1,col[0]*0.9+0.15),Math.min(1,col[1]*0.9+0.2)]; }
function beastForm2(ty){
  const spec=ty.spec, C=ty.col, A=beastAcc(C), H=q3(BEAST_S), {S,pts,lit,stroke,ell,tube,put}=H;
  const R=['.',':',...spec.glyphs.slice(0,2),'#'], BONE=[0.9,0.86,0.76], EYE=[1,0.85,0.35];
  if(spec.kind==='竜'){ const d=dragonForm({...ty,scale:2.35}); for(const p of d){ if(!p.col||p.col===ty.col)p.col=C; } pts.push(...d); }
  else if(spec.plan==='quad'){
    tube([0,0.5,-0.5],[0,0.7,0.35],0.24,0.3,R,(ox,oy)=>oy<-0.5?A:C,'body',null,0.2); ell([0,0.95,0.22],0.24,0.18,0.24,R,()=>C,'body');
    for(let z=-0.45;z<=0.42;z+=0.13)for(const x of [-0.14,0,0.14]){ const top=0.5+0.2*(z+0.5)/0.85+(Math.abs(z-0.22)<0.2?0.38:0.28); lit(x,top,z,'#',1.05,1.4,A,'body'); lit(x,top+0.07,z-0.02,'^',1,1.6,A,'body'); }
    const legs=spec.legs===6?[[0.34,0.62],[-0.05,0.58],[-0.45,0.55]]:[[0.34,0.62],[-0.45,0.55]];
    legs.forEach(([z,top],k)=>{ for(const sd of [-1,1]){ const part=((k%2===0)===(sd>0))?'legL':'legR', ex={piv:top,pz:z}; tube([sd*0.24,top,z],[sd*0.3,0.22,z+0.06],0.11,0.08,R,C,part,ex,0.2); tube([sd*0.3,0.22,z+0.06],[sd*0.3,0.03,z+0.1],0.08,0.07,R,C,part,ex); for(let c=0;c<3;c++)lit(sd*0.3+(c-1)*0.05,0.01,z+0.18,'v',0.9,1.5,BONE,part,ex); } });
    ell([0,0.56,0.78],0.18,0.15,0.2,R,(nx,ny)=>ny<-0.4?A:C,'head'); for(const sd of [-1,1]){ lit(sd*0.08,0.6,0.95,'*',1,3.4,EYE,'head'); stroke([sd*0.12,0.66,0.8],[sd*0.3,0.84,0.62],BONE,1.6,1,'head'); stroke([sd*0.3,0.84,0.62],[sd*0.36,0.8,0.42],BONE,1.6,1,'head'); lit(sd*0.07,0.42,0.95,'^',1,2.2,BONE,'head'); }
    tube([0,0.5,-0.55],[0,0.28,-1.0],0.14,0.05,R,C,'tail',{piv:1});
  } else if(spec.plan==='serpent'){
    const coil=[]; for(let t=0;t<=1;t+=0.04){ const a=t*Math.PI*2*2.2, r=0.85-0.45*t; coil.push([Math.cos(a)*r,0.18+0.3*t,Math.sin(a)*r]); }
    for(let i=0;i<coil.length-1;i++)tube(coil[i],coil[i+1],0.22,0.22,R,(ox,oy)=>oy<-0.4?A:C,'body');
    const e=coil[coil.length-1], neck=[e,[e[0]*0.5,0.8,e[2]*0.5+0.15],[0,1.15,0.45],[0,1.2,0.75]]; for(let i=0;i<neck.length-1;i++)tube(neck[i],neck[i+1],0.2-i*0.03,0.18-i*0.03,R,(ox,oy)=>oy<-0.4?A:C,'head');
    ell([0,1.2,0.88],0.14,0.11,0.2,R,()=>C,'head'); for(const sd of [-1,1])lit(sd*0.07,1.25,1.02,'*',1,3.4,EYE,'head');
    for(let k=0;k<6;k++)stroke([0,1.3-k*0.03,0.85-k*0.1],[0,1.5-k*0.05,0.75-k*0.12],A,1.8,1,'head');
    for(let i=2;i<coil.length;i+=2){ const p=coil[i]; stroke([p[0],p[1]+0.2,p[2]],[p[0],p[1]+0.34,p[2]],A,1.4,0.9,'body'); }
  } else if(spec.plan==='moth'){
    ell([0,0,0.1],0.18,0.17,0.2,FUR,()=>C,'body'); ell([0,-0.04,-0.4],0.15,0.14,0.36,FUR,(nx,ny,nz)=>Math.sin(nz*12)>0.3?A:C,'body'); ell([0,0.02,0.36],0.12,0.11,0.11,FUR,()=>C,'head');
    for(const sd of [-1,1]){ lit(sd*0.07,0.05,0.44,'@',1.3,3.6,EYE,'head'); let pv=[sd*0.05,0.12,0.42]; for(let k=1;k<=6;k++){ const nx=[sd*(0.05+k*0.06),0.12+k*0.07,0.42+k*0.04]; stroke(pv,nx,A,1.4,0.85,'head'); lit(nx[0]+sd*0.04,nx[1]-0.02,nx[2],'-',0.7,1.2,A,'head'); pv=nx; } }
    for(const sd of [-1,1])for(let l=0;l<3;l++)stroke([sd*0.1,-0.12,0.15-l*0.1],[sd*0.2,-0.4,0.2-l*0.12],C,1.0,0.85,'body');
    for(const sd of [-1,1])for(const [z0,rmax] of [[0.08,1.35],[-0.22,0.95]])for(let r=0.2;r<=rmax;r+=S*1.0)for(let dz=-0.32;dz<=0.32;dz+=S*1.0){ const f=r/rmax, edge=Math.abs(dz)>0.3*(1-f*0.35); if(Math.abs(dz)>0.34*(1-f*0.35))continue;
      const spot=Math.hypot(r-rmax*0.6,dz)<0.12, ch=spot?(Math.hypot(r-rmax*0.6,dz)<0.05?'@':'O'):edge?'~':mpick(['%',':','.']); lit(0,0.04+dz*0.2,z0+dz,ch,1,spot?2.6:edge?1.4:0.95,spot?A:edge?A:C,'wing',{sd,r}); }
  } else if(spec.plan==='centipede'){
    const segs=14; for(let i=0;i<segs;i++){ const f=i/(segs-1), z=0.9-f*2.4, y=f<0.25?0.9-f*2.6:0.26, c=[0,y,z];
      for(let k=0;k<12;k++){ const a=k/12*Math.PI, x=Math.cos(a)*0.22, yy=Math.sin(a)*0.16; lit(c[0]+x,c[1]+yy,c[2],k===0||k===11?'=':mpick(['#','%','=']),1,1.0+0.4*Math.sin(a),k===0||k===11?A:C,'seg',{piv:i}); }
      for(const sd of [-1,1]){ const part=(i%2===0)===(sd>0)?'legL':'legR', top=c[1]; stroke([sd*0.22,top,z],[sd*0.42,top+0.1,z+0.04],C,1.1,0.9,part,{piv:top,pz:z}); stroke([sd*0.42,top+0.1,z+0.04],[sd*0.5,0.02,z+0.08],C,1.1,0.9,part,{piv:top,pz:z}); } }
    const hd=[0,0.98,1.0]; ell(hd,0.15,0.12,0.14,R,()=>C,'head'); for(const sd of [-1,1]){ lit(sd*0.07,1.02,1.12,'*',1,3.2,EYE,'head'); stroke([sd*0.08,0.92,1.12],[sd*0.16,0.86,1.3],A,1.8,1,'head'); stroke([sd*0.16,0.86,1.3],[sd*0.06,0.84,1.4],A,1.8,1,'head');
      let pv=[sd*0.06,1.08,1.1]; for(let k=1;k<=6;k++){ const nx=[sd*(0.06+k*0.05),1.08+k*0.08,1.1+k*0.07]; stroke(pv,nx,A,1.3,0.85,'head'); pv=nx; } }
  }
  // features over the body
  if(!spec.wings)for(let i=pts.length-1;i>=0;i--)if(pts[i].part==='wing'&&spec.plan!=='moth')pts.splice(i,1);
  const bodyPts=pts.filter(p=>p.part!=='wing');
  if(spec.eyes>0)for(let k=0;k<32;k++){ const p=bodyPts[Math.floor(mr()*bodyPts.length)]; lit(p.x*1.02,p.y+0.01,p.z*1.02,mr()<0.5?'o':'*',0.9,3.2,[1,0.9,0.4],p.part,{piv:p.piv,pz:p.pz,ti:p.ti}); }
  if(spec.fire){ for(let k=0;k<50;k++){ const p=bodyPts[Math.floor(mr()*bodyPts.length)]; p.col=[1,0.4,0.12]; p.g=G(mpick(['/','\\'])); p.b=2.4; }
    const tops=bodyPts.slice().sort((a,b)=>b.y-a.y).slice(0,14); for(const p of tops)for(let q=0;q<3;q++){ const f=q/2; lit(p.x,p.y+0.06+f*0.14,p.z,'^',1-f*0.3,2.2+1.2*f,[1,0.3+0.55*f,0.08+0.4*f],'flame',{fh:f}); } }
  if(spec.shadow){ for(const p of pts){ if(p.col===EYE)continue; if(mr()<0.22){ p.col=[0.88,0.84,1.0]; p.b=2.2; } else { p.col=[0.24,0.17,0.38]; p.b*=0.6; } } }
  if(spec.sing){ const tops=bodyPts.slice().sort((a,b)=>b.y-a.y).slice(0,7); for(const p of tops){ for(let q=0;q<3;q++){ const dx=(q-1)*0.06; for(let j=1;j<=3;j++)lit(p.x+dx*j/3,p.y+j*0.07,p.z,j===3?'*':'|',1,2.4,[0.6,0.95,1.0],'pulse'); } } }
  pts.noExtra=true; return pts;
}
// the beast asleep: crouched low, head down, wings folded
function beastSleep(form,ty){ const out=[]; for(const p of form){ const q={...p};
    if(ty.spec.plan==='moth'){ if(p.part==='wing')q.r=(p.r||0)*0.35; }
    else if(ty.spec.plan!=='serpent'){ if(p.part==='legL'||p.part==='legR'){ q.y=p.y*0.35; q.piv=(p.piv||0)*0.35; q.part='body'; } else if(p.part==='head'){ q.y=Math.max(0.08,p.y*0.38); q.z=p.z*0.95; } else if(p.part==='wing'){ q.r=(p.r||0)*0.4; q.y=(p.y||0)*0.6; } else q.y=p.y*0.6; }
    out.push(q); } return out; }
// the beasts met, kept across adventures (the bestiary lists each by name)
function loadBeasts(){ try{ return JSON.parse(localStorage.getItem('al_beasts')||'[]'); }catch(e){ return []; } }
function recordBeast(ty){ try{ const all=loadBeasts(); if(all.some(b=>b.seed===runSeed&&b.name===ty.name))return; all.push({seed:runSeed,name:ty.name,col:ty.col,spec:ty.spec,lore:ty.lore,scale:ty.scale,fl:ty.fl,flier:ty.flier}); if(runStats)runStats.beastsNew=(runStats.beastsNew||0)+1; localStorage.setItem('al_beasts',JSON.stringify(all.slice(-60))); }catch(e){} }
function beastSamples(){ const K=[['獣','六本脚の','quad'],['竜','燃える鱗の','quad'],['大蛇','千の眼を持つ','serpent'],['蛾','歌う','moth'],['百足','影を喰らう','centipede']];
  return K.map(([kind,feat,plan],i)=>({seed:-1-i,name:`${feat}${kind}（見本）`,col:feat==='燃える鱗の'?[1.0,0.42,0.14]:feat==='影を喰らう'?[0.5,0.32,0.8]:hsl2rgb(i*0.21+0.05,0.75,0.6),
    spec:{plan,kind,legs:feat==='六本脚の'?6:4,wings:kind==='竜'||kind==='蛾',eyes:feat==='千の眼を持つ'?26:0,fire:feat==='燃える鱗の',shadow:feat==='影を喰らう',sing:feat==='歌う',glyphs:[['#','%','&'],['=','~','x'],['%','*','#'],['&','8','%'],['#','=','%']][i]},
    lore:'開発用の見本。冒険で出会った獣は、名前と年代記の一節とともにここへ記される。',scale:plan==='moth'?3.0:3.6,fl:plan==='moth'?2.4:0,flier:plan==='moth'})); }

function buildForm(ty){ const pts=buildForm0(ty); extraLook(ty,pts); return pts; }
function buildForm0(ty){
  if(ty.form==='wraith'&&!ty.boss){ if(ty.look==='lich')return lichForm(ty); if(ty.look==='wraith')return wraithForm2(ty); if(ty.invisible)return phantomForm(ty); }
  if(!ty.boss){ const F={troll:trollForm2,golem:golemForm2,bog:bogForm2,dragon:dragonForm,naga:nagaForm,kraken:krakenForm2,spider:caveSpiderForm,bat:batForm}[ty.form]; if(F)return F(ty); }
  if(ty.form==='quad'){ const F={rat:ratForm,jackal:jackalForm,grazer:grazerForm,salamander:salamanderForm}[ty.look]; if(F&&!ty.boss)return F(ty); }
  if(ty.form==='humanoid'&&ty.look==='ogre')return ogreForm(ty);
  if(ty.form==='humanoid'&&ty.look&&LOOK_PROP[ty.look]!==undefined||ty.form==='humanoid'&&ty.look==='snapjaw')return humanoid2(ty);
  { const F={jelly:jellyForm,bloat:bloatForm,orb:wispForm,eel:eelForm,snake:snakeForm,fish:fishForm,shroom:shroomForm,crab:crabForm}[ty.form]; if(F&&!ty.boss)return F(ty); }
  if(ty.form==='lichking')return lichKingForm();
  if(ty.form==='spiderqueen')return spiderQueenForm();
  if(ty.form==='nagaqueen')return nagaQueenForm();
  if(ty.form==='olddragon')return oldDragonForm();
  if(ty.form==='shadowking')return shadowKingForm();
  if(ty.form==='shadowserpent')return shadowSerpentForm();
  if(ty.form==='deepkraken')return deepKrakenForm();
  if(ty.form==='snake')return beastForm({plan:'serpent',kind:'大蛇',legs:0,wings:false,eyes:0,glyphs:['~','s','='],core:ty.ch});
  if(ty.form==='troll')return trollForm();
  if(ty.form==='golem')return golemForm();
  if(ty.form==='bog')return bogForm();
  if(ty.form==='kraken')return krakenForm();
  if(ty.form==='dragon')return beastForm({plan:'quad',kind:'竜',legs:4,wings:true,eyes:0,glyphs:['#','%','&'],core:ty.ch});
  if(ty.form==='naga')return beastForm({plan:'serpent',kind:'大蛇',legs:0,wings:false,eyes:0,glyphs:['~','=','%'],core:ty.ch});
  if(ty.form==='spider')return spiderForm();
  if(ty.form==='robot')return robotForm();
  if(ty.form==='cleaner')return cleanerForm(ty);
  if(ty.form==='repairer')return repairerForm(ty);
  if(ty.form==='watcher')return watcherForm(ty);
  if(ty.form==='fish'||ty.form==='shroom'||ty.form==='crab')return critterForm(ty);
  if(ty.form==='beast')return beastForm2(ty);
  const L=ty.ch, pts=[];
  const add=(x,y,z,ch,s,b,part,piv,pz)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:piv||0,pz:pz||0});
  const fib=(n,r,cx,cy,cz,set,s,b,part)=>{ for(let i=0;i<n;i++){ const y=1-2*(i+0.5)/n, rr=Math.sqrt(1-y*y), a=i*2.39996; add(cx+Math.cos(a)*rr*r,cy+y*r,cz+Math.sin(a)*rr*r,mpick(set),s,b,part); } };
  switch(ty.form){
    case 'humanoid':
      fib(10,0.17,0,1.5,0,[L,L,'*'],0.15,1.6,'head');
      for(let yy=0.92;yy<=1.37;yy+=0.11)for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; add(Math.cos(a)*0.2,yy,Math.sin(a)*0.13,mpick([L,L,'#','=']),0.15,1.0,'body'); }
      for(const sd of [-1,1]){
        for(let k=0;k<5;k++){ const f=k/4; add(sd*(0.27+f*0.06),1.36-f*0.5,0,mpick([L,'|',sd<0?'/':'\\']),0.14,1.0,sd<0?'armL':'armR',1.36); }
        for(let k=0;k<6;k++){ const f=k/5; add(sd*(0.1+f*0.03),0.86-f*0.8,0,mpick([L,'|','!']),0.15,0.95,sd<0?'legL':'legR',0.86); }
      }
      add(0,1.52,0.03,L,0.44,3.2,'core');
      lookHumanoid(ty.look,pts,add,L);
      shapeHumanoid(pts,ty.look);
      break;
    case 'quad':
      for(let k=0;k<6;k++){ const z=-0.32+k*0.13; for(let j=0;j<5;j++){ const a=j/5*Math.PI*2; add(Math.cos(a)*0.15,0.42+Math.sin(a)*0.11,z,mpick([L,L,'~','=']),0.13,1.0,'body'); } }
      fib(6,0.11,0,0.55,0.44,[L,'*'],0.12,1.4,'head');
      add(0,0.57,0.48,L,0.32,3.0,'core');
      for(const [sx,sz,part] of [[1,0.26,'legL'],[-1,0.26,'legR'],[1,-0.26,'legR'],[-1,-0.26,'legL']])
        for(let k=0;k<3;k++)add(sx*0.12,0.33-k*0.13,sz,mpick(['|','!',L]),0.12,0.9,part,0.36,sz);
      for(let k=0;k<3;k++)add(0,0.48+k*0.05,-0.42-k*0.12,mpick(['~','-',L]),0.11,0.9,'tail',k);
      lookQuad(ty.look,pts,add,L);
      break;
    case 'bat':
      fib(5,0.1,0,0,0,['v','*'],0.13,1.3,'body');
      add(0,0.02,0.02,'v',0.36,2.6,'core');
      for(const sd of [-1,1])for(let k=0;k<5;k++){ const p={x:0,y:0,z:-0.02*k,g:G(mpick(['^','v','/','\\','~'])),s:0.13,b:1.1,part:'wing',ph:mr()*6.28,piv:0,pz:0,sd,r:0.12+k*0.11}; pts.push(p); }
      break;
    case 'bloat':
      fib(30,0.4,0,0,0,['o','0','.','b'],0.14,1.0,'puff');
      add(0,0,0,'b',0.5,2.6,'core');
      for(let k=0;k<4;k++)add((mr()-0.5)*0.3,-0.45-k*0.1,(mr()-0.5)*0.3,mpick([':','\'','.']),0.1,0.8,'tail',k);
      break;
    case 'orb':
      fib(28,0.34,0,0,0,[L,'.','*','+'],0.13,1.3,'shell');
      add(0,0,0,L,0.55,3.6,'core');
      break;
    case 'wraith':
      for(let k=0;k<7;k++){ const y=1.85-k*0.26, r=0.1+k*0.075, n=5+k*2; for(let j=0;j<n;j++){ const a=j/n*Math.PI*2+k*0.4; add(Math.cos(a)*r,y,Math.sin(a)*r,mpick([L,L.toLowerCase(),'~','\'','"','|']),0.15,1.25-k*0.1,'robe'); } }
      for(const sd of [-1,1])for(let k=0;k<5;k++)add(sd*(0.2+k*0.1),1.55-k*0.06,0.1+k*0.05,mpick(['~','-',L.toLowerCase()]),0.12,0.9,'robe');
      add(0,1.9,0,L,0.46,3.2,'core');
      break;
    case 'eel':
      for(let i=0;i<12;i++){ const zc=1.1-i*0.27, yc=0.22+(i===0?0.3:i===1?0.12:0), rr=0.14*(1-i/16);
        for(let k=0;k<4;k++){ const a=k/4*Math.PI*2+i*0.4; add(Math.cos(a)*rr,yc+Math.sin(a)*rr,zc,mpick([L,'~','=',L]),0.15,1.0,'seg',i); } }
      add(0,0.62,1.18,L,0.4,3.0,'shead',0);
      break;
    case 'jelly':
      for(let i=0;i<56;i++){ const y=1-2*(i+0.5)/56; if(y<0)continue; const rr=Math.sqrt(1-y*y), a=i*2.39996; add(Math.cos(a)*rr*0.5,y*0.45+0.03,Math.sin(a)*rr*0.5,mpick([L,'o','~','.',L]),0.14,1.1,'jelly'); }
      for(let k=0;k<5;k++)add((mr()-0.5)*0.4,0.1+mr()*0.25,(mr()-0.5)*0.4,'.',0.12,1.6,'jelly');
      add(0,0.28,0,L,0.42,3.0,'core');
      break;
  }
  return pts;
}
