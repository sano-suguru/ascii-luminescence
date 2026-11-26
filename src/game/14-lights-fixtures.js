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
// マスの明るさ cellLight は src/lib/lightmap.ts（src/game/imports.mjs で読む）
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
  if(gear.castSt&&gear.hands){ const kk=Math.min(1,gear.castSt.t/Math.max(0.01,gear.castSt.need))*(gear.castSt.full?1+0.15*Math.sin(clock.time*14):1), cc=elemCol(gear.hands[gear.castSt.h].elem?gear.hands[gear.castSt.h].elem.type:null); for(let q=0;q<3;q++)DLC[q]=DLC[q]*(1-0.55*kk)+cc[q]*2.6*kk; }
  const list=here.monsters.filter(m=>m.ty.light>0&&!m.ty.invisible&&(m.ty.form!=='eel'||m.surf>0)).map(m=>[(m.x-player.x)**2+(m.z-player.z)**2,m]).sort((a,b)=>a[0]-b[0]);
  const flOn=vfx.zapFlash&&vfx.zapFlash.t>0;
  if(flOn){ const s5=(NDL-1), k5=vfx.zapFlash.t>900?1:Math.min(1,vfx.zapFlash.t/0.16); DLP[s5*4]=vfx.zapFlash.x; DLP[s5*4+1]=vfx.zapFlash.y; DLP[s5*4+2]=vfx.zapFlash.z; DLP[s5*4+3]=(vfx.zapFlash.r||6); DLC[s5*3]=vfx.zapFlash.col[0]*3*k5; DLC[s5*3+1]=vfx.zapFlash.col[1]*3*k5; DLC[s5*3+2]=vfx.zapFlash.col[2]*3*k5; }
  else if(blaze.spark){ const s5=(NDL-1); DLP[s5*4]=blaze.spark.x; DLP[s5*4+1]=blaze.spark.y; DLP[s5*4+2]=blaze.spark.z; DLP[s5*4+3]=5; DLC[s5*3]=2.4; DLC[s5*3+1]=1.3; DLC[s5*3+2]=0.4; }
  for(let k=0;k<NDL-((blaze.spark||flOn)?2:1)&&k<list.length;k++){
    const m=list[k][1], s=k+1, ty=m.ty;
    DLP[s*4]=m.x; DLP[s*4+1]=m.y+(ty.fl?0:0.9); DLP[s*4+2]=m.z; DLP[s*4+3]=ty.light*(1+m.alert*0.3);
    const pulse=(0.85+0.15*Math.sin(t*2.3+m.ph))*0.8*m.glow;
    const lc=ty.lcol||ty.col; DLC[s*3]=lc[0]*pulse; DLC[s*3+1]=lc[1]*pulse; DLC[s*3+2]=lc[2]*pulse;
  }
}

// 灯りの備品を描く drawFixtures と、扉を描く drawDoors は src/lib/fixtures.ts（src/game/imports.mjs で読む）
