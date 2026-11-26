// ---------------------------------------------------------------- chanting: hold to chant, release to cast; the world slows while you chant
const timeScale=()=>performance.now()<fight.hitStopUntil?0.05:(gear.castSt?0.5:1);
function beginCast(h){
  if(adv.dead||here.trans||!ui.started||isPaused()||gear.swapSt||gear.castSt||(fight.beamRun&&!fight.beamRun.auto)||player.netT>0||player.roll)return;
  if((player.recover||0)>0)return;
  const H=gear.hands[h]; if(!H.atk){ castNow(h); return; }
  const at=atkType(h), def=RUNE_DEF[at]; if(def.chant<=0){ castNow(h); return; }
  let needK=1; if(clock.time<(player.qcUntil||0)){ needK*=0.5; player.qcUntil=0; } if(BL('desperate')&&player.hp<adv.PLAYER_MAX*0.5)needK*=BL('desperate')>=2?0.55:0.7;
  gear.castSt={h,t:0,need:def.chant*Math.max(0.4,1-0.3*bodyN('quick'))*TRAIT_V.charge[wTL(h,'charge')]*needK,full:false,hold:0,beam:at==='beam',firing:false,tick:0,beamT:0};
  if(humNode)humNode.stop(); humNode=chantStart(H.elem?H.elem.type:null);
}
function fizzle(){ const [ox,oy,oz]=aimOrigin(), [dx,dy,dz]=viewDir(); for(let q=0;q<8;q++){ const a=mr()*6.28; spawn(ox+dx*0.7,oy-0.3+dy*0.7,oz+dz*0.7,Math.cos(a)*0.6,0.2+mr()*0.4,Math.sin(a)*0.6,0.5,G(mpick(['.','\''])),0.1,0.6,0.55,0.75,0); } }
function releaseCast(h){
  if(!gear.castSt||gear.castSt.h!==h)return;
  const c=gear.castSt; gear.castSt=null;
  if(c.full)castNow(h,{chanted:true,hold:c.hold}); else fizzle();
}
function updateCast(dt){
  if(!gear.castSt&&humNode){ humNode.stop(); humNode=null; }
  if(fight.beamRun){ fight.beamRun.t-=dt; fight.beamRun.tick-=dt; if(fight.beamRun.tick<=0){ fight.beamRun.tick=0.15; fireBeam(fight.beamRun.h,fight.beamRun.dir,fight.beamRun.dir?handPoint(fight.beamRun.h):null,fight.beamRun.auto); } if(fight.beamRun.t<=0){ turnElem(fight.beamRun.h); fight.beamRun=null; fight.beamSegs=[]; } }
  fight.trigCd.L=Math.max(0,fight.trigCd.L-dt); fight.trigCd.R=Math.max(0,fight.trigCd.R-dt); player.recover=Math.max(0,(player.recover||0)-dt);
  if(gear.swapSt){ gear.swapSt.t+=dt; if(gear.swapSt.t>=gear.swapSt.dur){ gear.swapSt=null; if(BL('swapedge'))player.swapEdgeUntil=clock.time+3; sChime(player.x,player.z,0.25); renderHotbar(); } else if(((gear.swapSt.t*10)|0)!==gear.swapSt.last){ gear.swapSt.last=(gear.swapSt.t*10)|0; renderHotbar(); } }
  if(!gear.castSt)return;
  if(!ui.started||adv.dead||here.trans){ gear.castSt=null; fight.beamSegs=[]; return; }
  gear.castSt.t+=dt;
  if(!gear.castSt.full&&gear.castSt.t>=gear.castSt.need){ gear.castSt.full=true;
    const P=castPoint(gear.castSt.h,1), c=elemCol(gear.hands[gear.castSt.h].elem?gear.hands[gear.castSt.h].elem.type:null); for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(P[0],P[1],P[2],Math.cos(a)*1.2,(mr()-0.4)*1.2,Math.sin(a)*1.2,0.35,G('*'),0.05,c[0]*3,c[1]*3,c[2]*3,0); } }
  if(humNode&&humNode.tick)humNode.tick(Math.min(1,gear.castSt.t/Math.max(0.01,gear.castSt.need)),gear.castSt.full);
  if(gear.castSt.full){ gear.castSt.hold+=dt; if(gear.castSt.hold>2){ const hh=gear.castSt.h; gear.castSt=null; castNow(hh,{chanted:true,hold:2}); } }
  if(((clock.time*10)|0)!==updateCast.last){ updateCast.last=(clock.time*10)|0; renderHotbar(); }
}
// castNow は src/lib/combat.ts（src/game/imports.mjs で読む）
// turnDir は src/lib/math.ts（src/game/imports.mjs で読む）
// the rapier: a dash that cuts through
// dashCast は src/lib/combat.ts（src/game/imports.mjs で読む）
// dashCuts は src/lib/combat.ts（src/game/imports.mjs で読む）
// the longbow: a rain of arrows over the aimed place
// startRain は src/lib/combat.ts（src/game/imports.mjs で読む）
function updateRains(dt){ for(const rn of fight.rains){ rn.tick-=dt;
    if(rn.follow){ let best=null, bd=4; for(const m of here.monsters){ if(!foe(m))continue; const dd=Math.hypot(m.x-rn.x,m.z-rn.z); if(dd<bd){ bd=dd; best=m; } } if(best){ const k=Math.min(1,dt*2/Math.max(0.1,bd)); rn.x+=(best.x-rn.x)*k; rn.z+=(best.z-rn.z)*k; } }
    while(rn.tick<=0&&rn.left>0){ rn.tick+=rn.iv; rn.left--; const a=mr()*6.28, rr=Math.sqrt(mr())*rn.r, px=rn.x+Math.cos(a)*rr, pz=rn.z+Math.sin(a)*rr, c=elemCol(rn.sp.elem), sp=rn.sp, eK=rn.elemK;
      spawn(px,4.6,pz,0,-24,0,0.19,G('|'),0.16,c[0]*2.4,c[1]*2.4,c[2]*2.4,0);
      later(0.18,()=>{ for(let q=0;q<3;q++)spawn(px,0.05,pz,(mr()-0.5)*1.2,0.4+mr()*0.5,(mr()-0.5)*1.2,0.3,G('.'),0.1,c[0]*2.2,c[1]*2.2,c[2]*2.2,0);
        for(const m of here.monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-px,m.z-pz)<0.7+0.3*m.ty.scale){ m.playerT=clock.time; applyHit(m,roll(RUNE_DEF.rain.dmg[0],RUNE_DEF.rain.dmg[1]),sp,true); } }
        if(sp.elem&&mr()<eK){ const ci=Math.floor(pz/CELL)*MW+Math.floor(px/CELL); if(ci>=0&&ci<NCELL)landElem(sp,px,0.1,pz,ci); } }); }
    if(rn.left<=0&&!rn.done){ rn.done=true; } }
  fight.rains=fight.rains.filter(rn=>!rn.done); for(const mk of fight.marks)mk.t-=dt; fight.marks=fight.marks.filter(mk=>mk.t>0); }
// the crossbow: bolts in quick succession
// castRapid は src/lib/combat.ts（src/game/imports.mjs で読む）
// the star staff: a pillar of light falls on the aimed place after a moment
// castStar は src/lib/combat.ts（src/game/imports.mjs で読む）
// the wind blade a sword sends forward: short for the short sword, wide for the greatsword's sweep
// the slash lies in the plane the blade swept: slanted like the swing (a sword: right-up to left-down from the right hand, mirrored from the left; a greatsword's sweep near level);
// bowed forward with its tips trailing back toward you, thick and bright in the middle, thin at the tips; it widens as it flies, leaves a faint trail and fades at the end
function drawWave(p){ const c=elemCol(p.sp.elem), v=Math.hypot(p.vx,p.vz)||1, dx=p.vx/v, dz=p.vz/v, px=-dz, pz=dx, life=clamp(1-p.t/(p.maxT||1),0,1), fade=Math.min(1,life*2.2), b=(0.75+0.55*fade)*fade;
  if(p.thrust){ for(let i=0;i<6;i++){ const k=i*0.16; dyn(p.x-dx*k,p.y-p.vy/v*k,p.z-dz*k,G(i===0?'>':'-'),0.16-i*0.015,c[0]*2.4*b*(1-i/7),c[1]*2.4*b*(1-i/7),c[2]*2.4*b*(1-i/7)); } return; }
  const [cf,cr,cu]=handUp(), grow=1+0.5*(1-life), W=(p.cw||1.2)*grow, half=W/2, bow=0.28*W, ang=(p.big?0.14:0.61)*(p.sp.h==='L'?-1:1), ca=Math.cos(ang), sa=Math.sin(ang);
  const S=[px*ca,sa,pz*ca], n=Math.max(11,Math.round(W*9));
  const pt=(s,back)=>{ const f=-bow*s*s-back; return [p.x+S[0]*s*half+dx*f,p.y+S[1]*s*half,p.z+S[2]*s*half+dz*f]; };
  for(const [trail,tb] of [[0,1],[0.22,0.35]]){ const ox=-dx*trail*v*0.04*6, oz=-dz*trail*v*0.04*6;
    for(let i=0;i<n;i++){ const s=i/(n-1)*2-1, core=1-s*s, rows=trail?1:Math.max(1,Math.round(1+core*2.2));
      const T=[S[0]*half+dx*(-2*bow*s),S[1]*half,S[2]*half+dz*(-2*bow*s)], g=vmGlyph(T[0]*cr[0]+T[2]*cr[2],T[0]*cu[0]+T[1]*cu[1]+T[2]*cu[2]);
      for(let k=0;k<rows;k++){ const q=pt(s,k*0.07), bb=b*tb*(0.45+0.75*core)*(1-k*0.22); dyn(q[0]+ox,q[1],q[2]+oz,G(g),(p.big?0.2:0.16)*(0.7+0.45*core),c[0]*2.3*bb,c[1]*2.3*bb,c[2]*2.3*bb); } } } }
// fireWave は src/lib/combat.ts（src/game/imports.mjs で読む）
// meleeCast は src/lib/combat.ts（src/game/imports.mjs で読む）
// the light beam: a ray each tick, reflecting off walls when it has bounces
// beamHold は src/lib/state.ts（src/game/imports.mjs で読む）
// fireBeam は src/lib/combat.ts（src/game/imports.mjs で読む）
// reflectDir は src/lib/aim.ts（src/game/imports.mjs で読む）
// inWater は src/lib/combat.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- hits, elements and reactions (all shown, never written)
// applyHit は src/lib/combat.ts（src/game/imports.mjs で読む）
// hitFeedback は src/lib/combat.ts（src/game/imports.mjs で読む）
// applyElem は src/lib/combat.ts（src/game/imports.mjs で読む）
// nearestFoe は src/lib/combat.ts（src/game/imports.mjs で読む）
// zapLine は src/lib/combat.ts（src/game/imports.mjs で読む）
// chainLightning は src/lib/combat.ts（src/game/imports.mjs で読む）
// react は src/lib/combat.ts（src/game/imports.mjs で読む）
// statuses tick on their own; chill slows, shock stops for a moment
function updateStatuses(dt){
  if(dt>0)for(const m of here.monsters){ if(m.plx!==undefined){ const k=Math.min(1,dt*8); m.vlx=(m.vlx||0)+(((m.x-m.plx)/dt)-(m.vlx||0))*k; m.vlz=(m.vlz||0)+(((m.z-m.plz)/dt)-(m.vlz||0))*k; } m.plx=m.x; m.plz=m.z; }
  for(const m of here.monsters){ const st=m.st; if(!st||m.dead)continue; const vis=m.visible&&Math.hypot(m.x-player.x,m.z-player.z)<26, cy=m.y+0.6*m.ty.scale;
    if(m.kx||m.kz){ m.x+=m.kx*dt; m.z+=m.kz*dt; m.kx*=Math.exp(-dt*6); m.kz*=Math.exp(-dt*6); if(Math.abs(m.kx)+Math.abs(m.kz)<0.05){ m.kx=0; m.kz=0; }
      const ci=Math.floor(m.z/CELL)*MW+Math.floor(m.x/CELL); if(here.D.tile[ci]===TW||here.D.tile[ci]===TX||here.D.solid.has(ci)){ if(m.slam&&clock.time<m.slam.until){ const dd=m.slam.d; m.slam=null; m.playerT=clock.time; damageMonster(m,dd,'blade'); for(let q=0;q<10;q++){ const a=mr()*6.28; spawn(m.x,m.y+0.6,m.z,Math.cos(a)*1.5,mr()*1.2,Math.sin(a)*1.5,0.5,G(mpick(['#','.',','])),0.14,0.9,0.85,0.8,0); } vfx.shake=Math.max(vfx.shake,0.12); } m.x-=m.kx*dt*1.5; m.z-=m.kz*dt*1.5; m.kx=0; m.kz=0; } m.cx=Math.floor(m.x/CELL); m.cz=Math.floor(m.z/CELL); }
    if(st.burn>0&&st.burn-dt<=0&&st.scorched&&!m.dead&&BL('scorch')){ m.hp=Math.min(m.maxHp||m.hp,m.hp+(m.maxHp||10)*0.3); st.scorched=false; }
    if(st.burn>0){ st.burn-=dt; st.bt=(st.bt||0)-dt; if(st.bt<=0){ st.bt=0.5; const r=(RES[m.key]||{}).fire; const n=Math.round(roll(1,2)*(r===undefined?1:r)); if(n>0)damageMonster(m,n,'fire'); }
      if(vis&&mr()<dt*14)spawn(m.x+(mr()-0.5)*0.5*m.ty.scale,cy+(mr()-0.3)*0.5,m.z+(mr()-0.5)*0.5*m.ty.scale,0,0.9+mr(),0,0.5,G(mpick(['^','\'','*'])),0.14,2.6,1.2,0.3,0); }
    if(st.poison>0){ st.poison-=dt; st.pt=(st.pt||0)-dt; if(st.pt<=0){ st.pt=0.6; const r=(RES[m.key]||{}).poison; const n=Math.round(1*(r===undefined?1:r)); if(n>0)damageMonster(m,n,'poison'); }
      if(vis&&mr()<dt*8)spawn(m.x+(mr()-0.5)*0.4*m.ty.scale,cy,m.z+(mr()-0.5)*0.4*m.ty.scale,0,-0.6,0,0.8,G(mpick(['.',','])),0.12,0.6,1.8,0.5,1); }
    if(st.chill>0){ st.chill-=dt; if(vis&&mr()<dt*6)spawn(m.x+(mr()-0.5)*0.6*m.ty.scale,cy+(mr()-0.5)*0.6,m.z+(mr()-0.5)*0.6*m.ty.scale,0,0.05,0,0.7,G('*'),0.12,1.4,2.0,2.6,0); }
    if(st.pin>0){ st.pin-=dt; if(vis&&mr()<dt*5)spawn(m.x+(mr()-0.5)*0.4,cy+0.3,m.z+(mr()-0.5)*0.4,0,0,0,0.3,G('#'),0.12,1.4,1.3,1.0,0); }
    if(st.shock>0){ st.shock-=dt; if(vis&&mr()<dt*12)spawn(m.x+(mr()-0.5)*0.5,cy+(mr()-0.5)*0.6,m.z+(mr()-0.5)*0.5,0,0,0,0.12,G(mpick(['/','\\'])),0.14,3,2.8,1.2,0); }
    if(m.dead&&st)m.st=null; }
  for(const c of fight.clouds){ c.t-=dt; c.tick-=dt; if(c.tick<=0){ c.tick=0.5; for(const o of here.monsters){ if(foe(o)&&Math.hypot(o.x-c.x,o.z-c.z)<c.r&&losClear(c.x,0.6,c.z,...mCenter(o))){ const s2=o.st||(o.st={}); s2.poison=Math.max(s2.poison||0,2.5); } } }
    if(mr()<dt*16){ const a=mr()*6.28, rr=Math.sqrt(mr())*c.r; spawn(c.x+Math.cos(a)*rr,0.15+mr()*0.5,c.z+Math.sin(a)*rr,0,0.15,0,1.2,G(mpick(['%','~','.'])),0.2,0.5,1.4,0.45,0); } }
  fight.clouds=fight.clouds.filter(c=>c.t>0); updateZones(dt);
}
const monTimeK=m=>{ let k=m.st?((m.st.shock>0||m.st.pin>0)?0:(m.st.chill>0?0.5:1)):1; if(m.ty.critter==='mimic'&&!m.hidden)k*=Math.sin(clock.time*4.5+m.ph)>-0.3?1.3:0.06; return k; };

// ---------------------------------------------------------------- projectiles: arrows fly straight, orbs arc and burst; both can bounce and seek
function updateProjs(dt){
  for(const b of fight.beamSegs)b.t-=dt; fight.beamSegs=fight.beamSegs.filter(b=>b.t>0||fight.beamRun);
  for(const p of fight.projs){
    p.t+=dt; if(p.kind==='orb'&&!p.noGrav)p.vy-=9.8*dt;
    if(p.accel){ const v=Math.hypot(p.vx,p.vy,p.vz)||1, nv=Math.min(p.vmax,v+p.accel*dt); p.vx*=nv/v; p.vy*=nv/v; p.vz*=nv/v; }
    if(p.moon){ const R=(p.tide?TRAIT_V.pull[p.tide]:2.6)+p.moon*0.3; if(p.tide)for(const m of here.monsters){ if(!hittable(m)||m.ty.boss||m.key==='lord'||m.key==='final'||m.ty.habitat)continue; const ax=p.x-m.x, az=p.z-m.z, dd=Math.hypot(ax,az); if(dd>R||dd<0.4)continue; const v=(2+p.tide*0.6)*dt*3/Math.max(0.6,m.ty.scale||1); m.kx=(m.kx||0)+ax/dd*v; m.kz=(m.kz||0)+az/dd*v; m.st=m.st||{}; (p.pulled=p.pulled||new Set()).add(m); }
      if(p.phases>=5){ p.burnT-=dt; if(p.burnT<=0){ p.burnT=0.25; for(const m of here.monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-p.x,m.z-p.z)<0.6+0.25*p.moon){ m.playerT=clock.time; applyHit(m,2,p.sp,true); } } } }
      const c2=elemCol(p.sp.elem); for(let q=0;q<Math.round(p.moon*2);q++){ const a=mr()*6.28, r=0.25*p.moon; spawn(p.x+Math.cos(a)*r,p.y+(mr()-0.5)*r,p.z+Math.sin(a)*r,0,0,0,0.25,G(mpick(['o','O','*','(',')'])),0.14+0.04*p.moon,c2[0]*2.6,c2[1]*2.6,c2[2]*2.6,0); } }
    if(p.homing){ let best=null, bs=0.5; const v=Math.hypot(p.vx,p.vy,p.vz)||1;
      for(const m of here.monsters){ if(!foe(m))continue; const cy=m.y+0.6*m.ty.scale, ax=m.x-p.x, ay=cy-p.y, az=m.z-p.z, d=Math.hypot(ax,ay,az); if(d>12||d<0.1)continue; const c=(ax*p.vx+ay*p.vy+az*p.vz)/(d*v); if(c>bs&&losClear(p.x,p.y,p.z,m.x,cy,m.z)){ bs=c; best=[ax/d,ay/d,az/d]; } }
      if(best){ const k=Math.min(1,(p.homing*Math.PI/180)*dt*2.2); p.vx+=(best[0]*v-p.vx)*k; p.vz+=(best[2]*v-p.vz)*k; if(p.kind==='bolt')p.vy+=(best[1]*v-p.vy)*k; } }
    const nx=p.x+p.vx*dt, ny=p.y+p.vy*dt, nz=p.z+p.vz*dt, cx=Math.floor(nx/CELL), cz=Math.floor(nz/CELL);
    const c=elemCol(p.sp.elem), bolt=p.kind==='bolt';
    if(mr()<(p.wave?0.35:0.85))spawn(p.x,p.y,p.z,(mr()-0.5)*0.3,(mr()-0.5)*0.3,(mr()-0.5)*0.3,0.35+mr()*0.25,G(mpick(p.wind?['~',')','(']:bolt?['*','.','\'']:['o','.','*'])),p.big?0.24:p.mini?0.08:bolt?0.11:0.13,c[0]*2.2,c[1]*2.2,c[2]*2.2,0);
    if(cx<0||cz<0||cx>=MW||cz>=MH||p.t>(p.maxT||4)){ p.dead=true; continue; }
    let hm=null; for(const m of here.monsters){ if(!hittable(m)||p.hit.has(m))continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; const cy=m.y+(m.ty.flier?0:0.6*m.ty.scale); if(Math.hypot(m.x-nx,cy-ny,m.z-nz)<0.42+0.35*m.ty.scale+(p.kind==='bolt'?0.14:0)+(p.rad||0)){ hm=m; break; } }
    if(hm){ p.hit.add(hm); if(bolt){ const dmg=p.dmg||RUNE_DEF.bolt.dmg; applyHit(hm,Math.max(1,Math.round(roll(dmg[0],dmg[1])*(p.dmgK||1))),p.sp); if(!p.wind&&(!p.mini||TL(p.sp,'scatter')>=5))arrowTraits(p,hm,nx,ny,nz);
        if(p.pierce===undefined&&!p.wind&&!p.mini){ const pl=TL(p.sp,'pierce'); p.pierce=[0,1,1,2,3,3][pl]; p.keep=pl>=2; if(pl>=5)p.wallPass=1; }
        if(p.heavy&&!hm.dead){ const v=Math.hypot(p.vx,p.vz)||1, k=(p.heavy>=1?3:0)/Math.max(0.6,hm.ty.scale||1); if(!hm.ty.boss&&hm.key!=='lord'&&hm.key!=='final'){ hm.kx=(hm.kx||0)+p.vx/v*k; hm.kz=(hm.kz||0)+p.vz/v*k; hm.st=hm.st||{}; if(p.heavy>=3)hm.wind=0; if(p.heavy>=5&&clock.time>=(hm.st.pinCd||0)){ hm.st.pin=Math.max(hm.st.pin||0,0.2); hm.st.pinCd=clock.time+1.2; } } }
        if(p.steady>=5){ hm.rapidN=(clock.time-(hm.rapidT||-9)<0.8?(hm.rapidN||0):0)+1; hm.rapidT=clock.time; if(hm.rapidN===3&&!hm.dead){ m_rapidCrit(hm,p.sp); } }
        if(p.boom){ orbBurst(nx,ny,nz,p.sp,{dmg:0.4,rad:0.6,cloud:false}); p.boom=false; }
        if(p.dust){ const n=p.dust>=3?3:2, k=p.dust>=4?0.8:p.dust>=2?0.6:0.45, md=RUNE_DEF.mshot.dmg, sp=p.sp, dl=p.dust; for(let i=0;i<n;i++){ const a=mr()*6.28; fight.projs.push({kind:'bolt',mini:true,x:nx,y:ny,z:nz,vx:Math.cos(a)*12,vy:(mr()-0.3)*2,vz:Math.sin(a)*12,t:0,maxT:0.3,sp,bounce:0,homing:0,hit:new Set([hm]),dmg:[Math.max(1,Math.round(md[0]*k)),Math.max(1,Math.round(md[1]*k))],trail:dl>=5}); } p.dust=0; }
        if(p.trail&&sp_elem(p))addZone(nx,nz,0.6,p.sp,3,false);
        if(p.pierce>0){ p.pierce--; if(!p.keep)p.dmgK=(p.dmgK||1)*0.7; p.x=nx; p.y=ny; p.z=nz; } else p.dead=true; }
      else { if(p.moon)moonBurst(p,nx,ny,nz); else orbBurst(nx,ny,nz,p.sp,p.mini?{dmg:p.burstK,rad:0.6,cloud:false,proj:p}:{proj:p}); p.dead=true; } continue; }
    const i=cz*MW+cx, wall=here.D.tile[i]===TW||here.D.tile[i]===TX||doorBlock(i), floor=ny<0.03&&here.D.tile[i]!==TC, ceil=ny>here.D.ceil[i];
    if(wall||floor||ceil){
      if(wall&&!floor&&!ceil&&p.wallPass===undefined&&p.kind==='bolt'&&!p.mini&&!p.wind&&TL(p.sp,'pierce')>=5)p.wallPass=1;
      if(wall&&!floor&&!ceil&&p.wallPass>0&&p.kind==='bolt'){ p.wallPass--; p.passing=true; }
      if(p.passing){ if(!wall)p.passing=false; p.x=nx; p.y=ny; p.z=nz; continue; }
      if(p.bounce>0){ p.bounce--; if(p.kind==='orb')orbBurst(p.x,Math.max(0.1,p.y),p.z,p.sp,{dmg:0.6,rad:0.7,cloud:false}); const r=reflectDir(p.x,p.y,p.z,[p.vx*dt,p.vy*dt,p.vz*dt].map(v=>v/Math.max(1e-4,Math.hypot(p.vx,p.vy,p.vz)*dt)));
        const v=Math.hypot(p.vx,p.vy,p.vz); p.vx=r[0]*v; p.vy=r[1]*v*(p.kind==='orb'?0.7:1); p.vz=r[2]*v; if(floor&&p.kind==='orb')p.vy=Math.abs(p.vy)+1;
        for(let q=0;q<5;q++){ const a=mr()*6.28; spawn(p.x,p.y,p.z,Math.cos(a)*1.2,mr(),Math.sin(a)*1.2,0.35,G('.'),0.1,c[0]*2.4,c[1]*2.4,c[2]*2.4,0); } continue; }
      p.dead=true; if(p.boom)orbBurst(p.x,Math.max(0.1,p.y),p.z,p.sp,{dmg:0.4,rad:0.6,cloud:false}); if(p.moon){ moonBurst(p,p.x,Math.max(0.1,p.y),p.z); continue; } if(p.kind==='orb')orbBurst(p.x,Math.max(0.1,p.y),p.z,p.sp,p.mini?{dmg:p.burstK,rad:0.6,cloud:false,proj:p}:{proj:p});
      else { for(let q=0;q<8;q++){ const a=mr()*6.28; spawn(p.x,Math.max(0.05,p.y),p.z,Math.cos(a)*1.4,0.3+mr(),Math.sin(a)*1.4,0.4,G(mpick(['*','.'])),0.12,c[0]*2.4,c[1]*2.4,c[2]*2.4,0); }
        landElem(p.sp,p.x,p.y,p.z,doorBlock(i)?i:Math.floor(p.z/CELL)*MW+Math.floor(p.x/CELL)); }
      continue; }
    p.x=nx; p.y=ny; p.z=nz;
  }
  fight.projs=fight.projs.filter(p=>!p.dead);
}
// sp_elem は src/lib/runes.ts（src/game/imports.mjs で読む）
function m_rapidCrit(m,sp){ m.playerT=clock.time; applyHit(m,5,sp,true); for(let q=0;q<10;q++){ const a=mr()*6.28; spawn(m.x,m.y+0.8,m.z,Math.cos(a)*1.6,0.4+mr(),Math.sin(a)*1.6,0.4,G(mpick(['!','*'])),0.14,2.6,2.2,1.2,0); } }
function moonBurst(p,x,y,z){ const f=p.moon, sp=p.sp; orbBurst(x,y,z,sp,{dmg:f*1.1,rad:0.8+0.45*f}); vfx.shake=Math.max(vfx.shake,0.1+0.05*f);
  if(p.phases>=3&&f>2.2){ const n=p.phases>=4?5:3; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+mr(); fight.projs.push({kind:'orb',mini:true,gen:9,x,y:Math.max(0.5,y),z,vx:Math.cos(a)*6,vy:3.2,vz:Math.sin(a)*6,t:0,sp,bounce:0,homing:0,hit:new Set(),burstK:0.6}); } }
  if(p.tide>=5&&p.pulled)for(const m of p.pulled){ if(m.dead||m.ty.boss)continue; const st=m.st||(m.st={}); if(clock.time>=(st.pinCd||0)){ st.pin=Math.max(st.pin||0,0.5); st.pinCd=clock.time+1.6; } } }
function arrowTraits(p,hm,x,y,z){ const sp=p.sp, gen=p.gen||0;
  const sc=TL(sp,'scatter'); if(sc&&gen<(sc>=5?2:1)){ const n=sc>=3?3:2, v=Math.hypot(p.vx,p.vz)||1, k=sc>=4?0.8:sc>=2?0.65:0.5, bd=RUNE_DEF.bolt.dmg;
    for(let i=0;i<n;i++){ const a=Math.atan2(p.vz,p.vx)+(mr()-0.5)*1.4; fight.projs.push({kind:'bolt',mini:true,gen:gen+1,x,y,z,vx:Math.cos(a)*14,vy:(mr()-0.4)*2,vz:Math.sin(a)*14,t:0,maxT:0.35,sp,bounce:0,homing:0,hit:new Set([hm]),dmg:[Math.max(1,Math.round(bd[0]*k)),Math.max(1,Math.round(bd[1]*k))]}); } }
  const pn=TL(sp,'pin'); if(pn&&!hm.dead&&!hm.ty.boss&&hm.key!=='lord'&&hm.key!=='final'){ const st=hm.st||(hm.st={}); let dur=pn>=2?0.45:0.3;
    if(pn>=3){ const v=Math.hypot(p.vx,p.vz)||1, wx=hm.x+p.vx/v*1.1, wz=hm.z+p.vz/v*1.1, wi=Math.floor(wz/CELL)*MW+Math.floor(wx/CELL); if(wi>=0&&wi<NCELL&&(here.D.tile[wi]===TW||here.D.tile[wi]===TX)){ dur=pn>=4?1.6:1.2; for(let q=0;q<6;q++)spawn(hm.x,hm.y+0.8,hm.z,(mr()-0.5)*0.5,mr()*0.4,(mr()-0.5)*0.5,0.5,G('#'),0.14,1.6,1.4,1.0,0);
        if(pn>=5)for(const k of ['burn','chill','shock','poison'])if(st[k]>0)st[k]*=2; } }
    if(clock.time<(st.pinCd||0))return; st.pin=Math.max(st.pin||0,dur); st.pinCd=clock.time+dur+1.2; } }
// orbBurst は src/lib/combat.ts（src/game/imports.mjs で読む）
// lingering traces of an element: every half second, what stands in them takes the element
// addZone は src/lib/combat.ts（src/game/imports.mjs で読む）
// later は src/lib/combat.ts（src/game/imports.mjs で読む）
function updateZones(dt){ updateRains(dt); for(const L of fight.laters)if(clock.time>=L.t){ L.done=true; try{ L.fn(); }catch(e){ /* play goes on, but the error is shown in the console; in test mode, throw it outside so the page reports it */ console.error(e); if(TEST)setTimeout(()=>{ throw e; },0); } } fight.laters=fight.laters.filter(L=>!L.done);
  for(const zn of fight.zones){ zn.t-=dt; zn.tick-=dt; if(zn.grow)zn.r=Math.min(zn.r0*1.7,zn.r+dt*0.18);
    if(zn.tick<=0&&zn.el){ zn.tick=0.5; for(const m of here.monsters){ if(!hittable(m)||m.ty.critter)continue; if(Math.hypot(m.x-zn.x,m.z-zn.z)<zn.r+0.3*m.ty.scale){ m.playerT=clock.time; applyElem(m,zn.el,zn.sp,1); } } } }
  fight.zones=fight.zones.filter(zn=>zn.t>0); }
// 床の目印と魔法の場を描く drawZones は src/lib/fx.ts（src/game/imports.mjs で読む）
// a hit somewhere in the world from other code
// burstFire は src/lib/combat.ts（src/game/imports.mjs で読む）
// 見ている向き viewDir は src/lib/aim.ts（src/game/imports.mjs で読む）
// groundPoint は src/lib/aim.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- triggers
function onRolled(){ if(BL('quickdodge'))player.qcUntil=clock.time+(BL('quickdodge')>=2?2.5:1.5); if(BL('counter'))player.ctrUntil=clock.time+1.5;
   for(const h of ['L','R']){ if(h==='R'&&isTwo())continue; const H=gear.hands[h]; if(H.trig&&H.trig.type==='dodge'&&H.atk&&fight.trigCd[h]<=0&&!gear.swapSt){ fight.trigCd[h]=1.0; castNow(h); } } }
// onKilledBy は src/lib/combat.ts（src/game/imports.mjs で読む）

