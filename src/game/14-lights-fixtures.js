// ---------------------------------------------------------------- lights
function flicker(L,t){
  const p=L.ph;
  switch(L.type){
    case 'brazier': return 0.8+0.09*Math.sin(t*8.3+p)+0.07*Math.sin(t*19.7+p*1.7)+0.05*Math.sin(t*41.3+p*3.1);
    case 'crystal': return 0.8+0.2*Math.sin(t*0.8+p);
    case 'rune': return 0.75+0.25*Math.pow(0.5+0.5*Math.sin(t*1.6+p),2);
    case 'fungus': return 0.8+0.2*Math.sin(t*0.5+p);
    case 'abyss': return 0.78+0.14*Math.sin(t*0.6+p)+0.08*Math.sin(t*2.7+p*2);
    case 'lamp': { let f=0.9+0.08*Math.sin(t*3.1+p); if(Math.sin(t*0.37+p*5)*Math.sin(t*1.9+p)>0.9)f*=0.3+0.5*mr(); return f; }
    case 'upstairs': return 0.9+0.1*Math.sin(t*1.3+p);
    case 'tele': return 0.75+0.25*Math.sin(t*2.2+p);
    case 'portal': return 0.85+0.15*Math.sin(t*2.3+p);
    case 'bstairs':
    case 'stairs': return 0.88+0.12*Math.sin(t*1.4+p);
    case 'fall': return 0.9+0.1*Math.sin(t*2.1+p);
    case 'veinlight': return 0.8+0.2*Math.sin(t*1.7+p);
    case 'crater': return L.active?0.9+0.1*Math.sin(t*3+p):0.25+0.08*Math.sin(t*2+p);
    case 'spring': return L.active?0.9:0.3;
    case 'firefly': return 0.8+0.2*Math.sin(t*1.1+p);
    case 'marsh': return 0.75+0.25*Math.sin(t*1.7+p);
    case 'sun': case 'well': return 0.95+0.05*Math.sin(t*0.3+p);
    case 'orb': return 0.9+0.1*Math.sin(t*0.7+p);
    case 'bloodwort': return (L.fade===undefined?1:L.fade)*(0.85+0.15*Math.sin(t*2.2+p));
    case 'vent': return 0.04+(L.boost||0);
    case 'pitglow': return here.D.collapsed?0.85+0.15*Math.sin(t*1.3+p):0;
    case 'xlight': return 0.85+0.15*Math.sin(t*0.6+p);
    case 'torch': return 0.8+0.08*Math.sin(t*9.1+p)+0.07*Math.sin(t*21.3+p*1.7)+0.05*Math.sin(t*37.9+p*2.9);
    case 'lava': return 0.85+0.1*Math.sin(t*0.7+p)+0.05*Math.sin(t*2.3+p);
    case 'embers': return 0.7+0.15*Math.sin(t*7.3+p)+0.1*Math.sin(t*17.1+p*2);
    case 'relic': return 0.85+0.15*Math.sin(t*1.1+p);
    case 'pages': return 0.8+0.2*Math.sin(t*0.7+p);
    case 'mist': return 0.75+0.25*Math.sin(t*0.4+p);
  }
  return 1;
}
const _cl=[0,0,0];
function cellLight(x,z){
  _cl[0]=_cl[1]=_cl[2]=0;
  const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL); if(cx<0||cz<0||cx>=MW||cz>=MH)return _cl;
  const o=(cz*MW+cx)*3;
  for(let k=0;k<3;k++){ const id=here.D.cellLI[o+k]; if(id<0)break; const L=here.D.lights[id], w=here.D.cellLW[o+k]*L.int*L.f; _cl[0]+=L.col[0]*w; _cl[1]+=L.col[1]*w; _cl[2]+=L.col[2]*w; }
  const fl=fireLight[cz*MW+cx]; if(fl>0){ _cl[0]+=fl*2.2; _cl[1]+=fl*0.99; _cl[2]+=fl*0.26; }
  return _cl;
}
// LANTERN は src/lib/light.ts（src/game/imports.mjs で読む）
function updateLights(t){
  SL.fill(0);
  let shadowK=1; for(const m of here.monsters)if(m.ty.beast&&m.ty.spec.shadow&&!m.sleep){ const d=Math.hypot(m.x-player.x,m.z-player.z); if(d<16)shadowK=Math.min(shadowK,0.45+0.55*d/16); }
  const drag=here.monsters.filter(m=>m.ty.dragon&&m.sleep), lich=here.monsters.filter(m=>m.ty.lich);
  here.D.lights.forEach((L,i)=>{ let f=flicker(L,t)*shadowK; let c0=L.col[0], c1=L.col[1], c2=L.col[2];
    for(const m of drag){ const d=Math.hypot(L.x-m.x,L.z-m.z); if(d<11)f*=1-0.35*(1-d/11)*(0.5+0.5*Math.sin(t*0.8+m.ph)); }
    for(const m of lich){ const d=Math.hypot(L.x-m.x,L.z-m.z); if(d<12){ const k2=(1-d/12)*0.8; c0=c0*(1-k2)+0.55*k2; c1=c1*(1-k2)+0.8*k2; c2=c2*(1-k2)+1.0*k2; } }
    L.f=f; const k=L.int*f; SL[i*3]=c0*k; SL[i*3+1]=c1*k; SL[i*3+2]=c2*k; });
  DLP.fill(0); DLC.fill(0);
  const lf=0.96+0.03*Math.sin(t*7.1)+0.02*Math.sin(t*13.3);
  if(ui.camMode==='tps'){ DLP[0]=player.x; DLP[1]=player.eye+0.15; DLP[2]=player.z; } else { DLP[0]=camera.position.x-Math.sin(player.yaw)*0.25; DLP[1]=camera.position.y-0.2; DLP[2]=camera.position.z-Math.cos(player.yaw)*0.25; } DLP[3]=lantern.r*(1+0.35*bodyN('lamp'));
  DLC[0]=LANTERN[0]*lf*lantern.k; DLC[1]=LANTERN[1]*lf*lantern.k; DLC[2]=LANTERN[2]*lf*lantern.k;
  if(gear.castSt&&gear.hands){ const kk=Math.min(1,gear.castSt.t/Math.max(0.01,gear.castSt.need))*(gear.castSt.full?1+0.15*Math.sin(time*14):1), cc=elemCol(gear.hands[gear.castSt.h].elem?gear.hands[gear.castSt.h].elem.type:null); for(let q=0;q<3;q++)DLC[q]=DLC[q]*(1-0.55*kk)+cc[q]*2.6*kk; }
  const list=here.monsters.filter(m=>m.ty.light>0&&!m.ty.invisible&&(m.ty.form!=='eel'||m.surf>0)).map(m=>[(m.x-player.x)**2+(m.z-player.z)**2,m]).sort((a,b)=>a[0]-b[0]);
  const flOn=vfx.zapFlash&&vfx.zapFlash.t>0;
  if(flOn){ const s5=(NDL-1), k5=vfx.zapFlash.t>900?1:Math.min(1,vfx.zapFlash.t/0.16); DLP[s5*4]=vfx.zapFlash.x; DLP[s5*4+1]=vfx.zapFlash.y; DLP[s5*4+2]=vfx.zapFlash.z; DLP[s5*4+3]=(vfx.zapFlash.r||6); DLC[s5*3]=vfx.zapFlash.col[0]*3*k5; DLC[s5*3+1]=vfx.zapFlash.col[1]*3*k5; DLC[s5*3+2]=vfx.zapFlash.col[2]*3*k5; }
  else if(spark){ const s5=(NDL-1); DLP[s5*4]=spark.x; DLP[s5*4+1]=spark.y; DLP[s5*4+2]=spark.z; DLP[s5*4+3]=5; DLC[s5*3]=2.4; DLC[s5*3+1]=1.3; DLC[s5*3+2]=0.4; }
  for(let k=0;k<NDL-((spark||flOn)?2:1)&&k<list.length;k++){
    const m=list[k][1], s=k+1, ty=m.ty;
    DLP[s*4]=m.x; DLP[s*4+1]=m.y+(ty.fl?0:0.9); DLP[s*4+2]=m.z; DLP[s*4+3]=ty.light*(1+m.alert*0.3);
    const pulse=(0.85+0.15*Math.sin(t*2.3+m.ph))*0.8*m.glow;
    const lc=ty.lcol||ty.col; DLC[s*3]=lc[0]*pulse; DLC[s*3+1]=lc[1]*pulse; DLC[s*3+2]=lc[2]*pulse;
  }
}

// ---------------------------------------------------------------- fixtures
function drawFixtures(t,dt){
  for(const f of here.fixtures){
    const ddx=f.x-player.x, ddz=f.z-player.z, d2=ddx*ddx+ddz*ddz; if(d2>46*46)continue;
    const near=clamp(Math.sqrt(d2)/4,0.35,1);
    const L=here.D.lights[f.li], fl=L?L.f:1, c=f.col, x=f.x, z=f.z, ly=L?L.y:1.5;
    switch(f.type){
      case 'brazier': {
        for(let k=0;k<3;k++){ const a=k*2.094+f.ph; dyn(x+Math.cos(a)*0.2,0.42,z+Math.sin(a)*0.2,G('|'),0.6,c[0]*0.55*fl+0.04,c[1]*0.55*fl+0.04,c[2]*0.55*fl+0.06,2,Math.atan2(Math.cos(a),Math.sin(a))); }
        for(let k=0;k<12;k++){ const a=k/12*Math.PI*2+f.ph; dyn(x+Math.cos(a)*0.34,0.86,z+Math.sin(a)*0.34,G(k%2?'=':'-'),0.3,c[0]*1.3*fl,c[1]*1.3*fl,c[2]*1.3*fl,2,Math.atan2(Math.cos(a),Math.sin(a))); }
        for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; dyn(x+Math.cos(a)*0.22,0.72,z+Math.sin(a)*0.22,G('-'),0.22,c[0]*0.8*fl,c[1]*0.8*fl,c[2]*0.8*fl,2,Math.atan2(Math.cos(a),Math.sin(a))); }
        const core=0.52+0.08*Math.sin(t*14+f.ph)+0.05*Math.sin(t*23+f.ph), cb=near;
        dyn(x,1.16,z,G('*'),core,(c[0]*3.4*fl+0.9)*cb,(c[1]*3.4*fl+0.6)*cb,(c[2]*3.4*fl+0.35)*cb);
        for(let k=0;k<7;k++){ const q=(t*1.7+k/7+f.ph)%1, a=k*1.7+f.ph+t, rr=0.17*(1-q), kk=(1-q)*(1-q), b=2.8*cb;
          dyn(x+Math.cos(a)*rr,0.98+q*0.8,z+Math.sin(a)*rr,G(k%3===0?'^':k%3===1?'\'':'*'),0.32*(1-q*0.7),c[0]*b*(1-q),c[1]*b*kk,c[2]*b*kk*(1-q)); }
        f.acc+=dt*13;
        while(f.acc>=1){ f.acc--; spawn(x+(mr()-0.5)*0.3,1.1,z+(mr()-0.5)*0.3,(mr()-0.5)*0.4,0.7+mr()*0.9,(mr()-0.5)*0.4,1.4+mr()*2.2,G(mpick(['.','\'','*','`','.'])),0.1+mr()*0.12,c[0]*2.6,c[1]*2.1,c[2]*1.7,0); }
        break; }
      case 'crystal': {
        const cy=ly+Math.sin(t*0.9+f.ph)*0.1, rot=t*0.45+f.ph, cr=Math.cos(rot), sr=Math.sin(rot);
        const V=[[0,0.75,0],[0,-0.75,0],[0.45,0,0],[-0.45,0,0],[0,0,0.45],[0,0,-0.45]];
        const E=[[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[4,3],[3,5],[5,2]];
        for(let ei=0;ei<E.length;ei++){ const a=V[E[ei][0]], b=V[E[ei][1]];
          for(let s=1;s<=3;s++){ const u=s/4, lx=a[0]+(b[0]-a[0])*u, lyy=a[1]+(b[1]-a[1])*u, lz=a[2]+(b[2]-a[2])*u;
            const br=2.0*(0.75+0.25*Math.sin(t*2+ei+s))*fl;
            dyn(x+lx*cr+lz*sr,cy+lyy,z-lx*sr+lz*cr,G(s===2?'+':':'),0.2,c[0]*br,c[1]*br,c[2]*br); } }
        for(const v of V)dyn(x+v[0]*cr+v[2]*sr,cy+v[1],z-v[0]*sr+v[2]*cr,G('*'),0.26,c[0]*2.8*fl,c[1]*2.8*fl,c[2]*2.8*fl);
        const cb=3.6*fl*near;
        dyn(x,cy,z,G('*'),0.7+0.06*Math.sin(t*1.7+f.ph),c[0]*cb+0.5*near,c[1]*cb+0.5*near,c[2]*cb+0.5*near);
        for(let k=0;k<9;k++){ const a=t*0.7+k/9*Math.PI*2; dyn(x+Math.cos(a)*1.0,cy+Math.sin(t*1.1+k*2)*0.35,z+Math.sin(a)*1.0,G(k%3?'.':'+'),0.2,c[0]*1.6,c[1]*1.6,c[2]*1.6); }
        f.acc+=dt*(ly>3?8:5);
        while(f.acc>=1){ f.acc--; const a=mr()*Math.PI*2, r=0.4+mr()*(ly>3?3:1.4); spawn(x+Math.cos(a)*r,0.3+mr()*(ly+0.5),z+Math.sin(a)*r,0,0.12+mr()*0.2,0,3+mr()*4,G(mpick(['.','+','*','\''])),0.1+mr()*0.12,c[0]*2,c[1]*2,c[2]*2,1); }
        break; }
      case 'rune': {
        const sp=t*0.2+f.ph, br=1.8*fl;
        for(let k=0;k<20;k++){ const a=k/20*Math.PI*2+sp; const g=RUNESET[(k*7+Math.floor(t*0.8+k*0.3))%RUNESET.length];
          dyn(x+Math.cos(a)*1.55,0.05,z+Math.sin(a)*1.55,G(g),0.42,c[0]*br,c[1]*br,c[2]*br,1,a+Math.PI/2); }
        for(let k=0;k<12;k++){ const a=k/12*Math.PI*2-sp*1.6; dyn(x+Math.cos(a)*0.95,0.05,z+Math.sin(a)*0.95,G(k%2?'*':'+'),0.3,c[0]*br*1.2,c[1]*br*1.2,c[2]*br*1.2,1,a+Math.PI/2); }
        for(let k=0;k<6;k++){ const a=k/6*Math.PI*2+sp*0.5; dyn(x+Math.cos(a)*0.45,0.05,z+Math.sin(a)*0.45,G('='),0.26,c[0]*br,c[1]*br,c[2]*br,1,a); }
        const cb=3.3*fl*near;
        dyn(x,0.95+Math.sin(t*1.2+f.ph)*0.1,z,G(RUNESET[Math.floor(t*0.7)%RUNESET.length]),0.55,c[0]*cb+0.3,c[1]*cb+0.3,c[2]*cb+0.3);
        f.acc+=dt*8;
        while(f.acc>=1){ f.acc--; const a=mr()*Math.PI*2, r=mpick([0.95,1.55]); spawn(x+Math.cos(a)*r,0.1,z+Math.sin(a)*r,0,0.5+mr()*0.6,0,1.8+mr()*1.5,G(mpick(RUNESET)),0.14+mr()*0.08,c[0]*2.2,c[1]*2.2,c[2]*2.2,2); }
        break; }
      case 'lamp': {
        const top=ceilAt(x,z)-0.15, yy=ly+Math.sin(t*1.2+f.ph)*0.03;
        for(let y=top,k=0;y>yy+0.2&&k<40;y-=0.22,k++)dyn(x,y,z,G(':'),0.2,c[0]*0.5,c[1]*0.5,c[2]*0.5);
        dyn(x,yy,z,G('o'),0.36,c[0]*1.5*fl,c[1]*1.5*fl,c[2]*1.5*fl);
        const cb=3.2*fl*near;
        dyn(x,yy,z,G('*'),0.3,c[0]*cb+0.4*near,c[1]*cb+0.4*near,c[2]*cb+0.4*near);
        f.acc+=dt*1.5; while(f.acc>=1){ f.acc--; spawn(x,yy,z,(mr()-0.5)*0.2,-0.1-mr()*0.2,(mr()-0.5)*0.2,2+mr()*2,G('.'),0.12,c[0]*1.8,c[1]*1.8,c[2]*1.8,1); }
        break; }
      case 'fungus': {
        const GLs=['T','Y','f','?','t','T','Y','r'];
        for(let k=0;k<8;k++){ const a=k*0.9+f.ph, r=0.12+(k%3)*0.2, s=0.24+((k*37)%5)*0.06, b=(1.4+0.6*Math.sin(t*1.3+k))*fl;
          dyn(x+Math.cos(a)*r,s*0.5,z+Math.sin(a)*r,G(GLs[k]),s,c[0]*b,c[1]*b,c[2]*b); }
        f.acc+=dt*3; while(f.acc>=1){ f.acc--; spawn(x+(mr()-0.5)*0.8,0.3,z+(mr()-0.5)*0.8,(mr()-0.5)*0.1,0.12+mr()*0.15,(mr()-0.5)*0.1,4+mr()*3,G(mpick(['.','\'','`'])),0.1,c[0]*1.8,c[1]*1.8,c[2]*1.8,1); }
        break; }
      case 'abyss': {
        const sp=t*0.15+f.ph, by=-CH_D+0.12;
        for(let k=0;k<18;k++){ const a=k/18*Math.PI*2+sp; dyn(x+Math.cos(a)*1.7,by,z+Math.sin(a)*1.7,G(RUNESET[(k*5+Math.floor(t*0.5))%RUNESET.length]),0.62,c[0]*1.5*fl,c[1]*1.5*fl,c[2]*1.5*fl,1,a+Math.PI/2); }
        for(let k=0;k<10;k++){ const a=k/10*Math.PI*2-sp*1.4; dyn(x+Math.cos(a)*0.9,by,z+Math.sin(a)*0.9,G('*'),0.4,c[0]*2,c[1]*2,c[2]*2,1,a); }
        dyn(x,ly+Math.sin(t*0.7+f.ph)*0.3,z,G('*'),1.2,c[0]*3.6*fl+0.4,c[1]*3.6*fl+0.25,c[2]*3.6*fl+0.15);
        for(let k=0;k<16;k++){ const q=(t*0.22+k/16+f.ph)%1, y=-CH_D+q*(CH_D+1.2), a=k*2.4+t*0.3, r=0.6+q*0.9, b=2.4*(1-q)*fl;
          dyn(x+Math.cos(a)*r,y,z+Math.sin(a)*r,G(k%2?'^':'\''),0.36,c[0]*b,c[1]*b*0.8,c[2]*b*0.7); }
        f.acc+=dt*11;
        while(f.acc>=1){ f.acc--; const a=mr()*Math.PI*2, r=mr()*2.6; spawn(x+Math.cos(a)*r,-CH_D+0.5+mr()*2,z+Math.sin(a)*r,(mr()-0.5)*0.3,0.8+mr()*0.9,(mr()-0.5)*0.3,7+mr()*5,G(mpick(['.','\'','*','^','`'])),0.12+mr()*0.14,c[0]*2.6,c[1]*2.2,c[2]*1.8,0); }
        break; }
      case 'embers': {
        const cb=near*fl;
        dyn(x,0.22,z,G('*'),0.32+0.05*Math.sin(t*11+f.ph),c[0]*2.6*cb,c[1]*2.0*cb,c[2]*1.6*cb);
        for(let k=0;k<4;k++){ const q=(t*1.3+k/4+f.ph)%1, a=k*1.6+t; dyn(x+Math.cos(a)*0.1*(1-q),0.15+q*0.45,z+Math.sin(a)*0.1*(1-q),G(k%2?'^':'\''),0.2*(1-q*0.6),c[0]*2.2*(1-q)*cb,c[1]*1.6*(1-q)*(1-q)*cb,c[2]*(1-q)*(1-q)*cb); }
        f.acc+=dt*4; while(f.acc>=1){ f.acc--; spawn(x+(mr()-0.5)*0.3,0.3,z+(mr()-0.5)*0.3,(mr()-0.5)*0.2,0.4+mr()*0.5,(mr()-0.5)*0.2,1.5+mr()*1.5,G('.'),0.08,c[0]*2,c[1]*1.6,c[2]*1.2,0); }
        break; }
      case 'relic': {
        const yy=ly+Math.sin(t*1.1+f.ph)*0.08, cb=3.0*fl*near;
        dyn(x,yy,z,G('?'),0.5,c[0]*cb+0.3,c[1]*cb+0.25,c[2]*cb+0.15);
        for(let k=0;k<10;k++){ const a=t*0.9+k/10*Math.PI*2; dyn(x+Math.cos(a)*0.55,yy+Math.sin(t*1.7+k)*0.12,z+Math.sin(a)*0.55,G(k%2?'.':'*'),0.16,c[0]*1.8,c[1]*1.8,c[2]*1.8); }
        f.acc+=dt*3; while(f.acc>=1){ f.acc--; const a=mr()*6.28; spawn(x+Math.cos(a)*0.4,yy-0.3,z+Math.sin(a)*0.4,0,0.25+mr()*0.2,0,2+mr()*1.5,G(mpick(['.','*','+'])),0.1,c[0]*2,c[1]*2,c[2]*2,2); }
        break; }
      case 'pages': {
        f.acc+=dt*1.6; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*3.5; spawn(x+Math.cos(a)*r,0.4+mr()*2.2,z+Math.sin(a)*r,(mr()-0.5)*0.25,0.03+mr()*0.08,(mr()-0.5)*0.25,6+mr()*4,G(mpick(['?','=','~','?'])),0.22,c[0]*1.2,c[1]*1.2,c[2]*1.2,1); }
        break; }
      case 'mist': {
        f.acc+=dt*7; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*4; spawn(x+Math.cos(a)*r,0.1+mr()*0.35,z+Math.sin(a)*r,(mr()-0.5)*0.35,0.01,(mr()-0.5)*0.35,6+mr()*4,G(mpick(['~','~','-','.'])),0.3+mr()*0.15,c[0]*0.7,c[1]*0.7,c[2]*0.7,1); }
        break; }
      case 'fall': {
        // a column of water falling from a glowing rift in the vault
        const top=Math.max(4,ceilAt(x,z)-0.15);
        for(let s2=0;s2<5;s2++){ const a=s2/5*Math.PI*2+t*0.3, ox=Math.cos(a)*0.22, oz=Math.sin(a)*0.22;
          for(let j=0;j*0.36<top;j++){ const y=top-((t*7+j*0.36+s2*0.07)%top), b=1.1+0.6*Math.sin(t*9+j+s2); dyn(x+ox,y,z+oz,G(j%3===0?'|':j%3===1?':':'!'),0.32,c[0]*b,c[1]*b,c[2]*b); } }
        for(let k=0;k<12;k++){ const a=k/12*Math.PI*2+t*0.05, r2=0.55+0.15*Math.sin(t+k); dyn(x+Math.cos(a)*r2,top+0.05,z+Math.sin(a)*r2,G(k%2?'*':'~'),0.28,c[0]*2.4,c[1]*2.4,c[2]*2.4,1,a); }
        dyn(x,top+0.08,z,G('*'),0.5,c[0]*3.2*near,c[1]*3.2*near,c[2]*3.2*near,1,0);
        f.acc+=dt*22;
        while(f.acc>=1){ f.acc--; const a=mr()*6.28, r2=0.2+mr()*0.6;
          spawn(x+Math.cos(a)*r2,0.15,z+Math.sin(a)*r2,Math.cos(a)*1.2,0.8+mr()*1.6,Math.sin(a)*1.2,0.9+mr(),G(mpick(['~','.','\'','o'])),0.14+mr()*0.14,0.55,0.8,1.0,1);
          if(mr()<0.3)spawn(x+(mr()-0.5)*2,0.4+mr(),z+(mr()-0.5)*2,(mr()-0.5)*0.3,0.15,(mr()-0.5)*0.3,3+mr()*2,G('.'),0.6,0.12,0.16,0.22,1); }
        break; }
      case 'veinlight': {
        const wd=f.wd||[1,0];
        f.acc+=dt*1.4; while(f.acc>=1){ f.acc--; const tX=-wd[1], tZ=wd[0], u=(mr()-0.5)*1.6; spawn(x+wd[0]*0.92+tX*u,0.5+mr()*1.8,z+wd[1]*0.92+tZ*u,0,0.02,0,0.5+mr()*0.4,G(mpick(['*','+','.'])),0.14,c[0]*2.6,c[1]*2.6,c[2]*2.6,2); }
        break; }
      case 'crater': {
        const cb=near*(f.active?1:0.4);
        for(let k=0;k<10;k++){ const a=k/10*Math.PI*2; dyn(x+Math.cos(a)*0.55,0.05,z+Math.sin(a)*0.55,G(k%2?'^':'%'),0.34,0.5,0.25,0.2,1,a+Math.PI/2); }
        dyn(x,0.12,z,G('*'),0.5,c[0]*3*cb,c[1]*2*cb,c[2]*cb,1,t*0.3);
        f.acc+=dt*(f.active?10:2); while(f.acc>=1){ f.acc--; spawn(x+(mr()-0.5)*0.6,0.2,z+(mr()-0.5)*0.6,(mr()-0.5)*0.4,0.6+mr()*1.2,(mr()-0.5)*0.4,1+mr()*1.5,G(mpick(['.','*','\''])),0.1,c[0]*2.6,c[1]*1.8,c[2]*1.2,0); }
        break; }
      case 'spring': {
        const wd=f.wd||[1,0], wx=x+wd[0]*0.85, wz=z+wd[1]*0.85;
        if(f.active){
          for(let j=0;j<12;j++){ const q=(t*1.6+j/12)%1; dyn(wx-wd[0]*q*1.3,1.3-q*q*1.25,wz-wd[1]*q*1.3,G(j%2?'~':'-'),0.3,0.5,0.8,1.0); }
          f.acc+=dt*12; while(f.acc>=1){ f.acc--; const a=mr()*6.28; spawn(wx-wd[0]*1.3,0.1,wz-wd[1]*1.3,Math.cos(a)*0.8,0.5+mr(),Math.sin(a)*0.8,0.8+mr()*0.6,G(mpick(['~','.','o'])),0.14,0.45,0.7,0.95,1); }
        } else { f.acc+=dt*1.5; while(f.acc>=1){ f.acc--; spawn(wx,1.4,wz,0,-1.5,0,0.9,G('.'),0.1,0.35,0.55,0.8,1); } }
        break; }
      case 'firefly': {
        for(let k=0;k<16;k++){ const a=t*(0.25+(k%5)*0.05)+k*2.4+f.ph, r2=0.6+((k*37)%11)/11*2.2, y=0.6+((k*53)%13)/13*2.2+Math.sin(t*0.9+k)*0.25, tw=0.5+0.5*Math.sin(t*(2+k%3)+k*1.7);
          dyn(x+Math.cos(a)*r2,y,z+Math.sin(a*1.3)*r2,G(k%4?'.':'*'),0.14+0.06*tw,c[0]*2.2*tw,c[1]*2.2*tw,c[2]*2.2*tw); }
        break; }
      case 'marsh': {
        const mx=x+Math.sin(t*0.4+f.ph)*1.1, mz=z+Math.cos(t*0.33+f.ph*1.7)*1.1, my=ly+Math.sin(t*0.9+f.ph)*0.25, cb=fl*near;
        dyn(mx,my,mz,G('*'),0.3+0.05*Math.sin(t*6+f.ph),c[0]*2.6*cb,c[1]*2.6*cb,c[2]*2.6*cb);
        for(let k=0;k<6;k++){ const a=t*1.4+k/6*Math.PI*2; dyn(mx+Math.cos(a)*0.22,my+Math.sin(t*2+k)*0.08,mz+Math.sin(a)*0.22,G('.'),0.14,c[0]*1.5,c[1]*1.5,c[2]*1.5); }
        f.acc+=dt*4; while(f.acc>=1){ f.acc--; spawn(mx,my,mz,(mr()-0.5)*0.15,0.05+mr()*0.1,(mr()-0.5)*0.15,1.5+mr()*1.5,G(mpick(['.','\'','`'])),0.08,c[0]*1.6,c[1]*1.6,c[2]*1.6,1); }
        break; }
      case 'well': case 'sun': {
        const top=ceilAt(x,z)-0.05;
        for(let k=0;k<10;k++){ const a=k/10*Math.PI*2+t*0.05; dyn(x+Math.cos(a)*0.45,top,z+Math.sin(a)*0.45,G(k%2?'.':'*'),0.22,c[0]*2.2,c[1]*2.15,c[2]*2.05); }
        dyn(x,top,z,G('*'),0.45,c[0]*3,c[1]*3,c[2]*2.85);
        f.acc+=dt*9; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=Math.sqrt(mr())*0.75; spawn(x+Math.cos(a)*r,0.2+mr()*(top-0.4),z+Math.sin(a)*r,(mr()-0.5)*0.05,-0.05-mr()*0.05,(mr()-0.5)*0.05,4+mr()*3,G(mpick(['.','.','\'','*'])),0.1+mr()*0.06,c[0]*1.4,c[1]*1.4,c[2]*1.3,1); }
        if(mr()<dt*2.5){ const r=mr()*0.6, a=mr()*6.28; spawn(x+Math.cos(a)*r,0.3+mr()*(top-0.6),z+Math.sin(a)*r,0,-0.02,0,3,G('|'),0.9,0.06,0.055,0.04,1); }
        break; }
      case 'orb': {
        for(let y=0.15;y<1.3;y+=0.24)dyn(x,y,z,G(y<0.3||y>1.1?'=':'|'),0.34,0.3+c[0]*0.15,0.3+c[1]*0.15,0.36+c[2]*0.15);
        const yy=ly+Math.sin(t*1.3+f.ph)*0.06, cb=near*fl;
        dyn(x,yy,z,G('o'),0.5,c[0]*2.4*cb,c[1]*2.4*cb,c[2]*2.4*cb);
        dyn(x,yy,z,G('*'),0.3,(c[0]*3.4+0.4)*cb,(c[1]*3.4+0.4)*cb,(c[2]*3.4+0.4)*cb);
        for(let k=0;k<6;k++){ const a=t*0.8+k/6*Math.PI*2; dyn(x+Math.cos(a)*0.42,yy+Math.sin(a*2)*0.08,z+Math.sin(a)*0.42,G('.'),0.16,c[0]*1.6,c[1]*1.6,c[2]*1.6); }
        break; }
      case 'bloodwort': {
        if(!f.burst){
          for(let k=0;k<4;k++){ const a=k*1.7+f.ph, h=0.7+k*0.18; const pb=(1.2+0.5*Math.sin(t*2.2+k))*near;
            dyn(x+Math.cos(a)*0.32,h,z+Math.sin(a)*0.32,G('o'),0.26,c[0]*pb*1.6,c[1]*pb,c[2]*pb); }
          if(Math.hypot(x-player.x,z-player.z)<2.3){ f.burst=true; L.fade=1;
            for(let q=0;q<40;q++){ const a=mr()*6.28; spawn(x+Math.cos(a)*0.3,0.8+mr()*0.6,z+Math.sin(a)*0.3,Math.cos(a)*0.6,0.4+mr()*0.9,Math.sin(a)*0.6,2.5+mr()*2,G(mpick(['*','.','+','o'])),0.13,2.4,0.6,0.7,2); }
            sChime(x,z,0.5); sChime(x,z,0.35);
            msg('<b style="color:#ff5566">*</b>ブラッドワートの実が弾け、温かな赤い光の粒が舞い上がった。'); }
        } else if(L&&L.fade>0.25)L.fade-=dt*0.08;
        break; }
      case 'vent': {
        for(let k=0;k<9;k++){ const a=k/9*Math.PI*2; dyn(x+Math.cos(a)*0.42,0.05,z+Math.sin(a)*0.42,G('o'),0.3,0.5,0.52,0.6,1,a); }
        dyn(x,0.06,z,G('0'),0.4,0.6,0.62,0.72,1,0);
        f.next=(f.next===undefined?2+mr()*5:f.next)-dt;
        if(f.next<=0){ f.next=4+mr()*6; f.erupt=2.2; sHiss(x,z,2.2); }
        if(f.erupt>0){ f.erupt-=dt; if(L)L.boost=Math.min(1.2,(L.boost||0)+dt*3);
          for(let q=0;q<Math.ceil(dt*45);q++){ const a=mr()*6.28; spawn(x+Math.cos(a)*0.15,0.2,z+Math.sin(a)*0.15,Math.cos(a)*0.4,3+mr()*2,Math.sin(a)*0.4,1.4+mr(),G(mpick(['~','.',':','\''])),0.3+mr()*0.25,0.5,0.52,0.58,1); } }
        else if(L)L.boost=Math.max(0,(L.boost||0)-dt*0.8);
        break; }
      case 'pitglow': {
        if(!here.D.collapsed)break;
        f.acc+=dt*6; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*1.6; spawn(x+Math.cos(a)*r,-5.5,z+Math.sin(a)*r,(mr()-0.5)*0.2,0.9+mr()*0.8,(mr()-0.5)*0.2,4+mr()*2,G(mpick(['.','*','\''])),0.12,c[0]*2.4,c[1]*2,c[2]*1.5,0); }
        break; }
      case 'xlight': {
        f.acc+=dt*4; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*2; spawn(x+Math.cos(a)*r,0.3+mr()*3,z+Math.sin(a)*r,0,0.06+mr()*0.08,0,2+mr()*2,G(mpick(['+','*','.'])),0.12,c[0]*2.2,c[1]*2.2,c[2]*2.2,1); }
        break; }
      case 'torch': {
        const nx=f.nx, nz=f.nz, yaw=Math.atan2(nx,nz), wx=f.wx+nx*0.1, wz=f.wz+nz*0.1, tX=Math.cos(yaw), tZ=-Math.sin(yaw), ik=0.18+fl*0.3;
        dyn(wx,1.72,wz,G('|'),0.36,0.7*ik,0.55*ik,0.5*ik,2,yaw);
        dyn(wx-tX*0.12+nx*0.05,1.98,wz-tZ*0.12+nz*0.05,G('\\'),0.26,0.7*ik,0.55*ik,0.5*ik,2,yaw);
        dyn(wx+tX*0.12+nx*0.05,1.98,wz+tZ*0.12+nz*0.05,G('/'),0.26,0.7*ik,0.55*ik,0.5*ik,2,yaw);
        dyn(wx+nx*0.08,1.9,wz+nz*0.08,G('_'),0.26,0.7*ik,0.55*ik,0.5*ik,2,yaw);
        const fx=wx+nx*0.14, fz=wz+nz*0.14, cb=near*fl;
        dyn(fx,2.12,fz,G('*'),0.34+0.05*Math.sin(t*15+f.ph),(c[0]*3.2+0.6)*cb,(c[1]*3.2+0.4)*cb,(c[2]*3.2+0.2)*cb);
        for(let k=0;k<4;k++){ const q=(t*1.9+k/4+f.ph)%1, a=k*1.9+t*1.3;
          dyn(fx+Math.cos(a)*0.06*(1-q),2.05+q*0.45,fz+Math.sin(a)*0.06*(1-q),G(k%2?'^':'\''),0.22*(1-q*0.6),c[0]*2.6*(1-q)*cb,c[1]*2.0*(1-q)*(1-q)*cb,c[2]*1.4*(1-q)*(1-q)*cb); }
        f.acc+=dt*4; while(f.acc>=1){ f.acc--; spawn(fx,2.2,fz,(mr()-0.5)*0.2+nx*0.1,0.5+mr()*0.6,(mr()-0.5)*0.2+nz*0.1,1+mr()*1.5,G(mpick(['.','\'','`'])),0.08,c[0]*2.4,c[1]*1.9,c[2]*1.4,0); }
        break; }
      case 'lava': {
        f.acc+=dt*7;
        while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*3.2; spawn(x+Math.cos(a)*r,0.15,z+Math.sin(a)*r,(mr()-0.5)*0.3,0.5+mr()*0.9,(mr()-0.5)*0.3,1.5+mr()*2.5,G(mpick(['.','\'','*','`'])),0.09+mr()*0.08,c[0]*2.8,c[1]*2.2,c[2]*1.6,0); }
        f.burst=(f.burst||0)-dt;
        if(f.burst<=0){ f.burst=0.8+mr()*2.2; f.bx=x+(mr()-0.5)*4; f.bz=z+(mr()-0.5)*4; const ci=Math.floor(f.bz/CELL)*MW+Math.floor(f.bx/CELL); f.bt=(ci>=0&&ci<NCELL&&here.D.liquid[ci]===LQ_LAVA)?0:1; }
        if(f.bt<1){ f.bt+=dt*1.6; const q=Math.min(1,f.bt), rr=0.15+q*0.7, b=2.6*(1-q);
          for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; dyn(f.bx+Math.cos(a)*rr,0.14+Math.sin(q*Math.PI)*0.25,f.bz+Math.sin(a)*rr,G(k%2?'o':'*'),0.2*(1-q*0.5),c[0]*b,c[1]*b*0.7,c[2]*b*0.4); }
          if(q<0.2)dyn(f.bx,0.22,f.bz,G('0'),0.4,c[0]*3,c[1]*2,c[2]); }
        break; }
      case 'portal': {
        // a ring of glyphs standing on its edge, turned to face you, with a swirl inside
        const ddx=player.x-x, ddz=player.z-z, dl=Math.hypot(ddx,ddz)||1, rx=-ddz/dl, rz=ddx/dl, cy=1.5, cb=near*fl;
        for(let k=0;k<20;k++){ const a=k/20*Math.PI*2+t*0.4; dyn(x+rx*Math.cos(a)*1.05,cy+Math.sin(a)*1.2,z+rz*Math.cos(a)*1.05,G(k%2?'*':'+'),0.3,c[0]*2.6*cb,c[1]*2.6*cb,c[2]*2.6*cb); }
        for(let k=0;k<26;k++){ const q=((t*0.35+k/26)%1), a=k*2.4+t*1.6, rr=(1-q)*0.95; dyn(x+rx*Math.cos(a)*rr,cy+Math.sin(a)*rr*1.1,z+rz*Math.cos(a)*rr,G(k%3===0?'~':k%3===1?'.':'*'),0.22,c[0]*(1+q*2)*cb,c[1]*(1+q*2)*cb,c[2]*(1+q*2)*cb); }
        dyn(x,cy,z,G('*'),0.6,c[0]*3.4*cb+0.4,c[1]*3.4*cb+0.4,c[2]*3.4*cb+0.4);
        f.acc+=dt*8; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=1.4+mr()*0.6; spawn(x+Math.cos(a)*r,0.3+mr()*2.4,z+Math.sin(a)*r,-Math.cos(a)*0.6,0,-Math.sin(a)*0.6,1.6,G(mpick(['.','*','+'])),0.12,c[0]*2,c[1]*2,c[2]*2,1); }
        break; }
      case 'bstairs':
      case 'upstairs': {
        const n=24;
        for(let k=0;k<n;k++){ const h=k/n, a=-h*Math.PI*4-t*0.5, b=(1.1+1.6*h)*fl; dyn(x+Math.cos(a)*0.65,0.15+h*2.4,z+Math.sin(a)*0.65,G('<'),0.26,c[0]*b,c[1]*b,c[2]*b); }
        dyn(x,1.2+Math.sin(t*1.2)*0.08,z,G('<'),0.9,c[0]*3*fl*near+0.3,c[1]*3*fl*near+0.3,c[2]*3*fl*near+0.3);
        f.acc+=dt*6; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*1.0; spawn(x+Math.cos(a)*r,2.4,z+Math.sin(a)*r,0,-0.6-mr()*0.5,0,2+mr(),G(mpick(['.','*','\''])),0.11,c[0]*2,c[1]*2,c[2]*2,2); }
        break; }
      case 'tele': {
        // a magic circle that carries you to its twin
        const cb=near*fl;
        for(let k=0;k<18;k++){ const a=k/18*Math.PI*2+t*0.6; dyn(x+Math.cos(a)*0.85,0.05,z+Math.sin(a)*0.85,G(k%3?'*':'+'),0.3,c[0]*1.8*cb,c[1]*1.8*cb,c[2]*1.8*cb,1,a); }
        for(let k=0;k<12;k++){ const a=-k/12*Math.PI*2-t*0.9; dyn(x+Math.cos(a)*0.5,0.06,z+Math.sin(a)*0.5,G(k%2?'o':'.'),0.24,c[0]*2.2*cb,c[1]*2.2*cb,c[2]*2.2*cb,1,a); }
        dyn(x,0.07,z,G('*'),0.5,c[0]*2.8*cb,c[1]*2.8*cb,c[2]*2.8*cb,1,t);
        f.acc+=dt*4; while(f.acc>=1){ f.acc--; const a=mr()*6.28; spawn(x+Math.cos(a)*0.8,0.1,z+Math.sin(a)*0.8,0,0.6+mr()*0.6,0,1.4,G(mpick(['.','*','+'])),0.11,c[0]*2,c[1]*2,c[2]*2,1); }
        break; }
      case 'stairs': {
        const n=32;
        for(let k=0;k<n;k++){ const h=k/n, a=h*Math.PI*4+t*0.5, b=(1.1+2.0*h)*fl; dyn(x+Math.cos(a)*0.75,0.15+h*2.7,z+Math.sin(a)*0.75,G('>'),0.28,c[0]*b,c[1]*b,c[2]*b); }
        for(let k=0;k<16;k++){ const a=k/16*Math.PI*2-t*0.3; dyn(x+Math.cos(a)*1.25,0.04,z+Math.sin(a)*1.25,G('>'),0.34,c[0]*1.6,c[1]*1.6,c[2]*1.6,1,a+Math.PI); }
        const cb=3.6*fl*near;
        dyn(x,1.3+Math.sin(t*1.2)*0.08,z,G('>'),1.05,c[0]*cb+0.4,c[1]*cb+0.35,c[2]*cb+0.2);
        f.acc+=dt*9; while(f.acc>=1){ f.acc--; const a=mr()*Math.PI*2, r=mr()*1.2; spawn(x+Math.cos(a)*r,0.1,z+Math.sin(a)*r,0,0.5+mr()*0.7,0,2+mr()*1.5,G(mpick(['.','*','\'','+'])),0.12,c[0]*2.3,c[1]*2.3,c[2]*2.3,2); }
        break; }
    }
  }
}

// ---------------------------------------------------------------- doors
function drawDoors(t,dt){
  for(const d of here.D.doors){
    if(d.gone)continue;
    const dx=d.bx-player.x, dz=d.bz-player.z, dd=Math.hypot(dx,dz);
    let tgt=dd<2.7?1:0;
    if(!tgt)for(const m of here.monsters){ if(Math.hypot(m.x-d.bx,m.z-d.bz)<1.7){tgt=1;break;} }
    if(tgt&&d.o<0.05&&!d.creaked){ d.creaked=true; sCreak(d.bx,d.bz); makeNoise(d.bx,d.bz,7,0.3); } if(!tgt&&d.o<0.02)d.creaked=false;
    d.o+=(tgt-d.o)*Math.min(1,dt*4);
    if(dd>40)continue;
    const yaw=d.yaw+d.o*1.75, tX=Math.cos(yaw), tZ=-Math.sin(yaw), bX=Math.cos(d.yaw), bZ=-Math.sin(d.yaw);
    const hx=d.bx-bX*0.95, hz=d.bz-bZ*0.95;
    const l1=cellLight((d.i%MW+0.5)*CELL,(((d.i/MW)|0)+0.5)*CELL), lr=l1[0], lg=l1[1], lb=l1[2];
    const l2=cellLight((d.j%MW+0.5)*CELL,(((d.j/MW)|0)+0.5)*CELL);
    const lan=Math.max(0,1-dd/8); const la=lan*lan*0.8;
    const k0=0.07+la, wr=0.62*(k0+(lr+l2[0])*0.2), wg=0.38*(k0+(lg+l2[1])*0.2), wb=0.22*(k0+(lb+l2[2])*0.2);
    for(let row=0;row<9;row++)for(let col=0;col<6;col++){
      const u=(col+0.5)*(1.9/6), y=0.18+row*0.335;
      let ch=row===8?'=':(col===0||col===5)?'|':(row%3===0?'=':'+'), r=wr, g=wg, b=wb;
      if(col===4&&row===3){ ch='o'; r*=2.2; g*=2.2; b*=1.4; }
      dyn(hx+tX*u,y,hz+tZ*u,G(ch),0.34,r,g,b,2,yaw);
      if(col<5&&row<8)dyn(hx+tX*(u+0.16)-Math.sin(yaw)*0.07,y+0.17,hz+tZ*(u+0.16)-Math.cos(yaw)*0.07,G('#'),0.26,r*0.5,g*0.5,b*0.5,2,yaw);
    }
  }
}

