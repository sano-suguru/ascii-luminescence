// ---------------------------------------------------------------- chanting: hold to chant, release to cast; the world slows while you chant
let beamRun=null;
let hitStopUntil=0;
const timeScale=()=>performance.now()<hitStopUntil?0.05:(castSt?0.5:1);
function beginCast(h){
  if(dead||trans||!started||isPaused()||swapSt||castSt||(beamRun&&!beamRun.auto)||player.netT>0||player.roll)return;
  if((player.recover||0)>0)return;
  const H=hands[h]; if(!H.atk){ castNow(h); return; }
  const at=atkType(h), def=RUNE_DEF[at]; if(def.chant<=0){ castNow(h); return; }
  let needK=1; if(time<(player.qcUntil||0)){ needK*=0.5; player.qcUntil=0; } if(BL('desperate')&&player.hp<PLAYER_MAX*0.5)needK*=BL('desperate')>=2?0.55:0.7;
  castSt={h,t:0,need:def.chant*Math.max(0.4,1-0.3*bodyN('quick'))*TRAIT_V.charge[wTL(h,'charge')]*needK,full:false,hold:0,beam:at==='beam',firing:false,tick:0,beamT:0};
  if(humNode)humNode.stop(); humNode=chantStart(H.elem?H.elem.type:null);
}
function fizzle(){ const [ox,oy,oz]=aimOrigin(), [dx,dy,dz]=viewDir(); for(let q=0;q<8;q++){ const a=mr()*6.28; spawn(ox+dx*0.7,oy-0.3+dy*0.7,oz+dz*0.7,Math.cos(a)*0.6,0.2+mr()*0.4,Math.sin(a)*0.6,0.5,G(mpick(['.','\''])),0.1,0.6,0.55,0.75,0); } }
function releaseCast(h){
  if(!castSt||castSt.h!==h)return;
  const c=castSt; castSt=null;
  if(c.full)castNow(h,{chanted:true,hold:c.hold}); else fizzle();
}
function updateCast(dt){
  if(!castSt&&humNode){ humNode.stop(); humNode=null; }
  if(beamRun){ beamRun.t-=dt; beamRun.tick-=dt; if(beamRun.tick<=0){ beamRun.tick=0.15; fireBeam(beamRun.h,beamRun.dir,beamRun.dir?handPoint(beamRun.h):null,beamRun.auto); } if(beamRun.t<=0){ turnElem(beamRun.h); beamRun=null; beamSegs=[]; } }
  trigCd.L=Math.max(0,trigCd.L-dt); trigCd.R=Math.max(0,trigCd.R-dt); player.recover=Math.max(0,(player.recover||0)-dt);
  if(swapSt){ swapSt.t+=dt; if(swapSt.t>=swapSt.dur){ swapSt=null; if(BL('swapedge'))player.swapEdgeUntil=time+3; sChime(player.x,player.z,0.25); renderHotbar(); } else if(((swapSt.t*10)|0)!==swapSt.last){ swapSt.last=(swapSt.t*10)|0; renderHotbar(); } }
  if(!castSt)return;
  if(!started||dead||trans){ castSt=null; beamSegs=[]; return; }
  castSt.t+=dt;
  if(!castSt.full&&castSt.t>=castSt.need){ castSt.full=true;
    const P=castPoint(castSt.h,1), c=elemCol(hands[castSt.h].elem?hands[castSt.h].elem.type:null); for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(P[0],P[1],P[2],Math.cos(a)*1.2,(mr()-0.4)*1.2,Math.sin(a)*1.2,0.35,G('*'),0.05,c[0]*3,c[1]*3,c[2]*3,0); } }
  if(humNode&&humNode.tick)humNode.tick(Math.min(1,castSt.t/Math.max(0.01,castSt.need)),castSt.full);
  if(castSt.full){ castSt.hold+=dt; if(castSt.hold>2){ const hh=castSt.h; castSt=null; castNow(hh,{chanted:true,hold:2}); } }
  if(((time*10)|0)!==updateCast.last){ updateCast.last=(time*10)|0; renderHotbar(); }
}
function castNow(h,opt){
  opt=opt||{}; const sp=specOf(h); if(BL('charge')&&(opt.hold||0)>0.35)sp.powK=BL('charge')>=2?1.5:1.3; vmKick[h]=time; if(isTwo())vmKick.R=time; if(sp.atk!=='beam')turnElem(h); const _sp0=sp, fr=shotFrame(h,!!opt.chanted,specOf(h).atk), dir=opt.dir||fr.d, col=elemCol(sp.elem), HP=opt.dir?handPoint(h):fr.o;
  if(!opt.auto)player.recover=Math.max(player.recover||0,sp.atk==='bare'?0.5:RUNE_DEF[sp.atk].rec);
  if(sp.atk==='blade'||sp.atk==='bare'){ meleeCast(sp,opt.dir||viewDir()); return; }
  if(sp.atk==='dash'){ dashCast(sp,opt.dir||viewDir(),!!opt.auto); return; }
  if(sp.atk==='gsweep'){ meleeCast(sp,opt.dir||viewDir()); return; }
  if(sp.atk==='gwave'){ castSound(sp); makeNoise(player.x,player.z,6,0.4); const ec=TL(sp,'echo'), n=1+(sp.aff.count||0), dmg=RUNE_DEF.gwave.dmg, fire=(dK,big)=>{ for(let k=0;k<n;k++){ const d=turnDir(dir,(k-(n-1)/2)*0.14); projs.push({kind:'bolt',wind:true,big,wave:true,cw:big?2.6:1.8,rad:big?0.74:0.34,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*10,vy:d[1]*10,vz:d[2]*10,accel:30,vmax:26,t:0,maxT:1.0,sp,bounce:0,homing:0,hit:new Set(),dmg,dmgK:dK,pierce:ec>=5?99:6,keep:true}); } sWhoosh(); };
    fire(1,true); if(ec){ const k=ec>=4?0.8:ec>=2?0.65:0.5; later(0.3,()=>fire(k,false)); if(ec>=3)later(0.6,()=>fire(k,false)); } return; }
  if(sp.atk==='bpower'||sp.atk==='rshot'){ castSound(sp); makeNoise(player.x,player.z,5,0.3); const n=1+(sp.aff.count||0), pw=sp.atk==='bpower', v=(pw?28:24)*tv(sp,'speed');
    for(let k=0;k<n;k++){ const d=turnDir(dir,(k-(n-1)/2)*0.1); projs.push({kind:'bolt',auto:!!opt.auto,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*v,vy:d[1]*v,vz:d[2]*v,t:0,sp,bounce:sp.aff.bounce||0,homing:sp.aff.homing||0,hit:new Set(),dmg:RUNE_DEF[sp.atk].dmg,...(pw?{pierce:2+[0,1,1,2,3,3][TL(sp,'pierce')],keep:true}:{})}); } return; }
  if(sp.atk==='mshot'){ castSound(sp); const n=1+(sp.aff.count||0); for(let k=0;k<n;k++){ const d=turnDir(dir,(k-(n-1)/2)*0.1); projs.push({kind:'bolt',x:HP[0],y:HP[1],z:HP[2],vx:d[0]*18,vy:d[1]*18,vz:d[2]*18,t:0,sp,bounce:sp.aff.bounce||0,homing:sp.aff.homing||0,hit:new Set(),dmg:RUNE_DEF.mshot.dmg,pierce:0,dust:TL(sp,'stardust')}); } return; }
  if(sp.atk==='mmoon'){ castSound(sp); makeNoise(player.x,player.z,6,0.4); const ph=0, k=clamp((opt.hold||0)/(2*tv(sp,'charge')),0,1), f=1+k*2*tv(sp,'size'), n=1+(sp.aff.count||0);
    for(let i=0;i<n;i++){ const d=turnDir(dir,(i-(n-1)/2)*0.2); projs.push({kind:'orb',noGrav:true,moon:f,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*9,vy:d[1]*9,vz:d[2]*9,t:0,sp,bounce:0,homing:0,hit:new Set(),tide:TL(sp,'pull'),phases:0,burnT:0}); } return; }
  if(sp.atk==='rain'||sp.atk==='star'){ castSound(sp); makeNoise(player.x,player.z,5,0.3); const tp=opt.dir?groundPoint(handPoint(h),opt.dir,16):groundPoint(aimOrigin(),viewDir(),22); if(sp.atk==='rain')startRain(sp,tp[0],tp[1]); else castStar(sp,tp[0],tp[1]); return; }
  if(sp.atk==='rapid'){ castSound(sp); makeNoise(player.x,player.z,5,0.3); castRapid(h,sp,opt); return; }
  castSound(sp); makeNoise(player.x,player.z,5,0.3);
  if(sp.atk==='bolt'){ const n=1+(sp.aff.count||0);
    for(let k=0;k<n;k++){ const off=(k-(n-1)/2)*0.11, d=turnDir(dir,off);
      const v=20*tv(sp,'speed'); projs.push({kind:'bolt',auto:!!opt.auto,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*v,vy:d[1]*v,vz:d[2]*v,t:0,sp,bounce:sp.aff.bounce||0,homing:sp.aff.homing||0,hit:new Set()}); } }
  else if(sp.atk==='orb'){ const n=1+(sp.aff.count||0);
    for(let k=0;k<n;k++){ const off=(k-(n-1)/2)*0.16, d=turnDir(dir,off);
      const v=12*tv(sp,'speed'); projs.push({kind:'orb',auto:!!opt.auto,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*v,vy:d[1]*v+2.6,vz:d[2]*v,t:0,sp,bounce:sp.aff.bounce||0,homing:sp.aff.homing||0,hit:new Set()}); } }
  else if(sp.atk==='beam'){ fireBeam(h,opt.dir||null,opt.dir?HP:null,!!opt.auto); beamRun={h,t:opt.auto?0.5:1.5,tick:0.15,auto:!!opt.auto,dir:opt.dir||null}; if(!opt.auto)player.recover=Math.max(player.recover||0,1.6); }
}
// turnDir は src/lib/math.ts（src/game/imports.mjs で読む）
// the rapier: a dash that cuts through
function dashCast(sp,dir,auto){ const hx=dir[0], hz=dir[2], l=Math.hypot(hx,hz)||1, dist=3+TRAIT_V.stride[TL(sp,'stride')], dur=0.2, x0=player.x, z0=player.z, af=TRAIT_V.after[TL(sp,'after')];
  player.swingH=sp.h; player.swing=0.22; player.swingCol=elemCol(sp.elem); sWhoosh();
  player.lunge={t:0,dur,dx:hx/l,dz:hz/l,sp:dist/dur,cut:{sp,hit:new Set(),w:1.0,dK:1,link:false}};
  if(!auto)player.recover=RUNE_DEF.dash.rec*TRAIT_V.link[TL(sp,'link')];
  later(dur,()=>{ const HP=handPoint(sp.h||'R'), d=viewDir(), dm=RUNE_DEF.dash.dmg, n=1+(sp.aff.count||0); for(let i=0;i<n;i++){ const dd=turnDir(d,(i-(n-1)/2)*0.1); projs.push({kind:'bolt',wind:true,x:HP[0],y:HP[1],z:HP[2],vx:dd[0]*22,vy:dd[1]*22,vz:dd[2]*22,t:0,maxT:0.36*tv(sp,'range'),sp,bounce:0,homing:0,hit:new Set(player.lunge&&player.lunge.cut?player.lunge.cut.hit:[]),dmg:[Math.max(1,Math.round(dm[0]*0.7)),Math.max(1,Math.round(dm[1]*0.7))],pierce:2,keep:true,rad:0.05,thrust:true}); } });
  if(af){ later(dur,()=>{ const x1=player.x, z1=player.z; for(let i=0;i<af;i++){ const f=(i+1)/(af+1), ax=x0+(x1-x0)*f, az=z0+(z1-z0)*f;
      for(let q=0;q<8;q++)spawn(ax+(mr()-0.5)*0.4,0.6+mr()*1.0,az+(mr()-0.5)*0.4,0,0.1,0,0.5,G(mpick([')','(','|'])),0.16,...elemCol(sp.elem).map(v=>v*1.6),0);
      later(0.35,()=>{ for(const m of monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-ax,m.z-az)<1.0+0.3*m.ty.scale){ m.playerT=time; applyHit(m,Math.max(1,Math.round(roll(RUNE_DEF.dash.dmg[0],RUNE_DEF.dash.dmg[1])*0.55)),sp,true); } } }); } }); } }
function dashCuts(){ const L=player.lunge, c=L&&L.cut; if(!c)return; const dm=RUNE_DEF.dash.dmg;
  for(const m of monsters){ if(!hittable(m)||c.hit.has(m))continue; if(Math.hypot(m.x-player.x,m.z-player.z)<c.w+0.35*m.ty.scale){ c.hit.add(m); m.playerT=time; applyHit(m,Math.max(1,Math.round(roll(dm[0],dm[1])*c.dK)),c.sp); if(c.link)player.recover=Math.min(player.recover||0,0.05); } } }
// the longbow: a rain of arrows over the aimed place
function startRain(sp,x,z,again){ const de=0, n=8+3*(sp.aff.count||0), r=1.8*tv(sp,'area'), span=0.6*tv(sp,'span');
  rains.push({x,z,r,n,left:n,iv:span/n,tick:again?0:0.45,sp,follow:false,elemK:0.25,again:!!again}); marks.push({x,z,r,t:(again?0:0.45)+span,c:elemCol(sp.elem)});
  if(de>=3&&!again)later(0.45+span+0.25,()=>startRain(sp,x,z,true)); }
function updateRains(dt){ for(const rn of rains){ rn.tick-=dt;
    if(rn.follow){ let best=null, bd=4; for(const m of monsters){ if(!foe(m))continue; const dd=Math.hypot(m.x-rn.x,m.z-rn.z); if(dd<bd){ bd=dd; best=m; } } if(best){ const k=Math.min(1,dt*2/Math.max(0.1,bd)); rn.x+=(best.x-rn.x)*k; rn.z+=(best.z-rn.z)*k; } }
    while(rn.tick<=0&&rn.left>0){ rn.tick+=rn.iv; rn.left--; const a=mr()*6.28, rr=Math.sqrt(mr())*rn.r, px=rn.x+Math.cos(a)*rr, pz=rn.z+Math.sin(a)*rr, c=elemCol(rn.sp.elem), sp=rn.sp, eK=rn.elemK;
      spawn(px,4.6,pz,0,-24,0,0.19,G('|'),0.16,c[0]*2.4,c[1]*2.4,c[2]*2.4,0);
      later(0.18,()=>{ for(let q=0;q<3;q++)spawn(px,0.05,pz,(mr()-0.5)*1.2,0.4+mr()*0.5,(mr()-0.5)*1.2,0.3,G('.'),0.1,c[0]*2.2,c[1]*2.2,c[2]*2.2,0);
        for(const m of monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-px,m.z-pz)<0.7+0.3*m.ty.scale){ m.playerT=time; applyHit(m,roll(RUNE_DEF.rain.dmg[0],RUNE_DEF.rain.dmg[1]),sp,true); } }
        if(sp.elem&&mr()<eK){ const ci=Math.floor(pz/CELL)*MW+Math.floor(px/CELL); if(ci>=0&&ci<NCELL)landElem(sp,px,0.1,pz,ci); } }); }
    if(rn.left<=0&&!rn.done){ rn.done=true; } }
  rains=rains.filter(rn=>!rn.done); for(const mk of marks)mk.t-=dt; marks=marks.filter(mk=>mk.t>0); }
// the crossbow: bolts in quick succession
function castRapid(h,sp,opt){ const vo=0, sd=0, hv=0, ac=TL(sp,'accuracy'), n=3+(sp.aff.count||0), volleys=1;
  for(let v=0;v<volleys;v++)for(let k=0;k<n;k++)later(k*0.07+v*0.45,()=>{ if(dead)return; const fr=shotFrame(h,false,'bolt'), base=opt.dir||fr.d, HP=opt.dir?handPoint(h):fr.o, spread=0.045*(1-0.16*ac), d=turnDir(base,(mr()-0.5)*spread*2);
    projs.push({kind:'bolt',auto:!!opt.auto,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*22,vy:d[1]*22,vz:d[2]*22,t:0,sp,bounce:sp.aff.bounce||0,homing:(sp.aff.homing||0)+(sd>=2?20:sd>=1?10:0),hit:new Set(),dmg:RUNE_DEF.rapid.dmg,dmgK:(sd>=4?1.3:1)*(hv>=4?1.4:hv>=2?1.2:1),pierce:sd>=3?1:0,keep:true,heavy:hv,steady:sd,boom:vo>=5&&k===n-1}); if(k%2===0)sWhoosh(); }); }
// the star staff: a pillar of light falls on the aimed place after a moment
function castStar(sp,x,z){ const tw=0, sw=0, pl=TL(sp,'pull'), sz=tv(sp,'size'), delay=0.6*tv(sp,'fall'), pts=[[x,z]];
  const extra=(sp.aff.count||0);
  for(let i=0;i<extra;i++){ const a=mr()*6.28; pts.push([x+Math.cos(a)*1.6,z+Math.sin(a)*1.6]); }
  pts.forEach(([px,pz],i)=>{ const dl=delay+i*0.18; marks.push({x:px,z:pz,r:sz,t:dl,c:elemCol(sp.elem),star:true});
    if(pl&&i===0)later(dl*0.35,()=>{ const R=TRAIT_V.pull[pl]; for(const m of monsters){ if(!hittable(m)||m.ty.boss||m.key==='lord'||m.key==='final'||m.ty.habitat)continue; const ax=px-m.x, az=pz-m.z, dd=Math.hypot(ax,az); if(dd>R||dd<0.3)continue; const v=(2+pl*0.8)/Math.max(0.6,m.ty.scale||1); m.kx=(m.kx||0)+ax/dd*v; m.kz=(m.kz||0)+az/dd*v; m.st=m.st||{}; } });
    later(dl,()=>{ let fx=px, fz=pz; if(sw>=3){ let best=null, bd=2.5; for(const m of monsters){ if(!foe(m))continue; const dd=Math.hypot(m.x-px,m.z-pz); if(dd<bd){ bd=dd; best=m; } } if(best){ fx=best.x; fz=best.z; } }
      const c=elemCol(sp.elem); for(let y=0;y<7;y+=0.35)spawn(fx+(mr()-0.5)*0.2,y,fz+(mr()-0.5)*0.2,0,-6,0,0.25,G(mpick(['|','*','+'])),0.2,c[0]*3,c[1]*3,c[2]*3,0);
      orbBurst(fx,0.2,fz,sp,{dmg:1.25*Math.sqrt(sz),rad:sz}); shake=Math.max(shake,0.1);
      if(false)for(const m of monsters){ if(!hittable(m)||m.ty.boss||m.key==='lord'||m.key==='final')continue; if(Math.hypot(m.x-fx,m.z-fz)<1.2){ const st=m.st||(m.st={}); if(time>=(st.pinCd||0)){ st.pin=Math.max(st.pin||0,0.6); st.pinCd=time+1.8; } } } }); }); }
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
function fireWave(sp,dir,cut){ if(sp.atk==='bare')return; player.swingWave=true; const wide=sp.atk==='gsweep', W=(wide?2.0:1.2)+2*TRAIT_V.width[TL(sp,'width')], n=1+(sp.aff.count||0), HP=handPoint(sp.h||'R'), dm=RUNE_DEF[wide?'gsweep':'blade'].dmg, k=wide?0.55:0.65, v=wide?14:16;
  for(let i=0;i<n;i++){ const d=turnDir(dir,(i-(n-1)/2)*0.13); projs.push({kind:'bolt',wind:true,big:wide,wave:true,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*v,vy:d[1]*v,vz:d[2]*v,t:0,maxT:(wide?0.28:0.32)*tv(sp,'range'),sp,bounce:sp.aff.bounce||0,homing:sp.aff.homing||0,hit:new Set(cut||[]),
    dmg:[Math.max(1,Math.round(dm[0]*k)),Math.max(1,Math.round(dm[1]*k))],pierce:wide?6:4,keep:true,cw:W,rad:Math.max(0,W/2-0.56)}); } }
function meleeCast(sp,dir){
  player.swingWave=false; player.swingH=sp.h; player.swing=0.22; player.swingCol=elemCol(sp.elem); sWhoosh();
  const MD=RUNE_DEF[sp.atk==='bare'?'blade':sp.atk], wgt=TL(sp,'weight'), [vx,vy,vz]=dir, [ox,oy,oz]=aimOrigin(), spL=TL(sp,'spin'), reach=(MD.reach||2.2)+(spL>=2?0.5:0), maxT=1+(sp.aff.count||0)+(spL>=3?3:0)+(sp.atk==='gsweep'?2:0), cands=[];
  for(const m of monsters){ if(!hittable(m))continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; if(m.ty.habitat==='bog'&&(m.rise||0)<0.3)continue;
    const sc=m.ty.scale, cy=m.hidden?m.y+1.3:m.y+(m.ty.flier?0:0.6*sc), ax=m.x-ox, ay=cy-oy, az=m.z-oz, d=Math.hypot(ax,ay,az);
    if(Math.hypot(m.x-player.x,m.z-player.z)>reach+0.35*sc)continue;
    const ang=Math.acos(clamp((ax*vx+ay*vy+az*vz)/Math.max(d,1e-3),-1,1)), tol=(spL>=3||wgt>=5)?Math.PI:(MD.arc||0.42)+(maxT>1?0.25:0)+(spL>=1?0.3:0)+Math.atan2(0.5*sc,Math.max(d,0.5));
    if(ang<=tol)cands.push([ang,m]); }
  cands.sort((a,b)=>a[0]-b[0]);
  const dm=sp.atk==='bare'?[1,2]:MD.dmg, dK=spL>=4?1.3:1;
  for(const [,m] of cands.slice(0,maxT)){ applyHit(m,Math.round(roll(dm[0],dm[1])*dK),sp);
    if(wgt&&!m.dead&&!m.ty.boss&&m.key!=='lord'&&m.key!=='final'&&!m.ty.habitat){ const ax=m.x-player.x, az=m.z-player.z, dd=Math.hypot(ax,az)||1, v=(wgt>=2?8:6)/Math.max(0.6,m.ty.scale||1); m.kx=(m.kx||0)+ax/dd*v; m.kz=(m.kz||0)+az/dd*v; m.st=m.st||{}; if(wgt>=3)m.slam={d:wgt>=4?7:4,until:time+0.7}; } }
  const qk=TL(sp,'quake'); if(qk&&sp.atk==='gsweep'){ const px=player.x, pz=player.z, R=qk>=4?4.5:3.2, hitNow=new Set(cands.slice(0,maxT).map(c=>c[1])); later(0.12,()=>{ for(let q=0;q<36;q++){ const a=q/36*Math.PI*2; spawn(px+Math.cos(a)*R*0.9,0.1,pz+Math.sin(a)*R*0.9,Math.cos(a)*2,0.2,Math.sin(a)*2,0.35,G(mpick(['~','-','='])),0.15,1.4,1.2,0.9,0); }
      for(const m of monsters){ if(!hittable(m)||hitNow.has(m)||m.ty.flier)continue; if(Math.hypot(m.x-px,m.z-pz)<R){ m.playerT=time; applyHit(m,Math.max(1,Math.round(roll(dm[0],dm[1])*(qk>=2?0.55:0.4))),sp,true); if(qk>=3)m.wind=0; if(qk>=5&&!m.ty.boss){ const st=m.st||(m.st={}); if(time>=(st.pinCd||0)){ st.pin=Math.max(st.pin||0,0.4); st.pinCd=time+1.6; } } } } shake=Math.max(shake,0.15); }); }
  if(spL>=3){ for(let q=0;q<26;q++){ const a=q/26*Math.PI*2; spawn(player.x+Math.cos(a)*reach*0.8,player.eye-0.6,player.z+Math.sin(a)*reach*0.8,-Math.sin(a)*2,0,Math.cos(a)*2,0.25,G(mpick(['-','~','='])),0.14,...elemCol(sp.elem).map(v=>v*2.2),0); } }
  if(spL>=5){ const px=player.x, pz=player.z; later(0.25,()=>{ for(let q=0;q<30;q++){ const a=q/30*Math.PI*2; spawn(px+Math.cos(a)*reach,0.9,pz+Math.sin(a)*reach,0,0.2,0,0.45,G('='),0.16,...elemCol(sp.elem).map(v=>v*2.6),0); }
    for(const m of monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-px,m.z-pz)<reach+0.4*m.ty.scale){ m.playerT=time; applyHit(m,Math.max(1,Math.round(roll(dm[0],dm[1])*0.5)),sp,true); } } }); }
  fireWave(sp,dir,new Set(cands.slice(0,maxT).map(c=>c[1])));
  const wL=0; if(wL){ const HP=handPoint(sp.h||'R'), n=wL>=3?2:1, wK=wL>=4?0.6:wL>=2?0.5:0.4, wd=[Math.max(1,Math.round(dm[0]*wK)),Math.max(1,Math.round(dm[1]*wK))];
    for(let k=0;k<n;k++){ const d=turnDir(dir,(k-(n-1)/2)*0.18); projs.push({kind:'bolt',wind:true,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*16,vy:d[1]*16,vz:d[2]*16,t:0,maxT:0.38,sp,bounce:0,homing:0,hit:new Set(),dmg:wd,pierce:wL>=5?2:0,keep:false}); } }
  const lL=0; if(lL){ const hx=vx, hz=vz, hl=Math.hypot(hx,hz)||1, dist=[0,0.8,1.1,1.1,1.5,1.5][lL];
    player.lunge={t:0,dur:0.14,dx:hx/hl,dz:hz/hl,sp:dist/0.14}; if(lL>=5&&time>(player.invCd||0)){ player.invulT=time+0.25; player.invCd=time+1.2; }
    if(lL>=3)for(const m of monsters){ if(!hittable(m))continue; const ax=m.x-player.x, az=m.z-player.z, dd=Math.hypot(ax,az); if(dd<reach+0.6&&(ax*hx+az*hz)/Math.max(0.01,dd*hl)>0.6){ const v=6/Math.max(0.5,(m.ty.scale||1)); m.kx=(m.kx||0)+ax/dd*v; m.kz=(m.kz||0)+az/dd*v; m.st=m.st||{}; } } }
  if(sp.elem){ const fx=player.x+vx*1.5, fz=player.z+vz*1.5, ci=Math.floor(fz/CELL)*MW+Math.floor(fx/CELL); if(sp.elem!=='fire'||doorBlock(ci)||fuel[ci]>0)landElem(sp,fx,0.3,fz,ci); }
}
// the light beam: a ray each tick, reflecting off walls when it has bounces
const beamHold={L:{hold:0,last:-9,sear:-9,burst:-9},R:{hold:0,last:-9,sear:-9,burst:-9}};
function fireBeam(h,dirIn,orgIn,auto){
  const sp=specOf(h), fr=dirIn?null:beamFrame(h), base=dirIn||fr.d, n=1+(sp.aff.count||0), [ox,oy,oz]=orgIn||fr.o; beamSegs=[];
  const fb=beamHold[h]||beamHold.R, gap=time-fb.last; fb.hold=gap>0.4?0:fb.hold+gap; fb.last=time;
  const fL=TL(sp,'focus'), fMax=TRAIT_V.focus[fL], fK=1+Math.min(fMax,fb.hold*0.35), rL=TL(sp,'refract'), seL=TL(sp,'sear');
  for(let k=0;k<n;k++){ let d=turnDir(base,(k-(n-1)/2)*0.12), x=ox, y=oy, z=oz, left=12*tv(sp,'length'), bounces=sp.aff.bounce||0, bends=rL?(rL>=3?2:1):0, bent=false; const seg=[[x,y,z]], hitSet=new Set();
    while(left>0){ const nx=x+d[0]*0.25, ny=y+d[1]*0.25, nz=z+d[2]*0.25; left-=0.25;
      let hitM=null; for(const m of monsters){ if(!hittable(m)||hitSet.has(m))continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; const cy=m.y+(m.ty.flier?0:0.6*m.ty.scale); if(Math.hypot(m.x-nx,cy-ny,m.z-nz)<0.57+0.35*m.ty.scale){ hitM=m; break; } }
      if(hitM){ seg.push([nx,ny,nz]); hitSet.add(hitM); const bsp=bent&&rL>=5?{...sp,pow:sp.pow*1.5}:sp; applyHit(hitM,Math.max(1,Math.round(roll(RUNE_DEF.beam.dmg[0],RUNE_DEF.beam.dmg[1])*fK*(bent&&rL>=4?1.25:1))),bsp,true);
        if(bends>0){ let m2=null, bd=rL>=2?9:6; for(const m of monsters){ if(!hittable(m)||hitSet.has(m)||m.ty.critter)continue; const cy=m.y+(m.ty.flier?0:0.6*m.ty.scale), dd=Math.hypot(m.x-nx,cy-ny,m.z-nz); if(dd<bd&&losClear(nx,ny,nz,m.x,cy,m.z)){ bd=dd; m2=m; } }
          if(m2){ bends--; bent=true; const cy=m2.y+(m2.ty.flier?0:0.6*m2.ty.scale), L=Math.hypot(m2.x-nx,cy-ny,m2.z-nz)||1; d=[(m2.x-nx)/L,(cy-ny)/L,(m2.z-nz)/L]; x=nx; y=ny; z=nz; left=L+0.6; continue; } }
        break; }
      const ci=Math.floor(nz/CELL)*MW+Math.floor(nx/CELL), wall=nx<0||nz<0||nx>=MW*CELL||nz>=MH*CELL||D.tile[ci]===TW||D.tile[ci]===TX||doorBlock(ci)||ny<0.02||ny>D.ceil[ci];
      if(wall){ seg.push([x,y,z]); if(time-beamIgT>=0.5){ beamIgT=time; landElem(sp,x,y,z,doorBlock(ci)?ci:Math.floor(z/CELL)*MW+Math.floor(x/CELL)); } if(bounces<=0)break; bounces--; const r=reflectDir(x,y,z,d); d=r; continue; }
      x=nx; y=ny; z=nz; }
    if(seg.length<2)seg.push([x,y,z]); const e=seg[seg.length-1];
    if(k===0&&seL&&time-fb.sear>0.4){ fb.sear=time; addZone(e[0],e[2],seL>=3?1.0:0.7,sp,[0,2.5,3.5,3.5,5,5][seL],seL>=5); }
    if(false){ fb.burst=time; orbBurst(e[0],Math.max(0.2,e[1]),e[2],sp,{dmg:0.5,rad:0.6,cloud:false}); }
    for(let q=0;q<3;q++){ const a=mr()*6.28; spawn(e[0],e[1],e[2],Math.cos(a)*1.2,0.4+mr(),Math.sin(a)*1.2,0.3,G(mpick(['*','+'])),0.12,elemCol(sp.elem)[0]*2.8,elemCol(sp.elem)[1]*2.8,elemCol(sp.elem)[2]*2.8,0); }
    beamSegs.push({pts:seg,col:auto?elemCol(sp.elem).map(v=>v*0.6+0.4):elemCol(sp.elem),t:0.16}); }
}
function reflectDir(x,y,z,d){ const s=0.25, cx=Math.floor((x+d[0]*s)/CELL), cz=Math.floor((z+d[2]*s)/CELL), ox=Math.floor(x/CELL), oz=Math.floor(z/CELL);
  const solidAt=(a,b)=>a<0||b<0||a>=MW||b>=MH||D.tile[b*MW+a]===TW||D.tile[b*MW+a]===TX;
  let r=[d[0],d[1],d[2]]; const ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL);
  if(y+d[1]*s<0.02||y+d[1]*s>D.ceil[ci]){ r[1]=-r[1]; return r; }
  const bx=solidAt(cx,oz), bz=solidAt(ox,cz); if(bx)r[0]=-r[0]; if(bz)r[2]=-r[2]; if(!bx&&!bz){ r[0]=-r[0]; r[2]=-r[2]; } return r; }
const inWater=m=>{ const l=D.liquid[m.cz*MW+m.cx]; return l===LQ_WATER||l===LQ_DEEP; };

// ---------------------------------------------------------------- hits, elements and reactions (all shown, never written)
let hitSrcPoint=null;
function applyHit(m,dmg,sp,quiet){
  if(m.dead)return; m.playerT=time; m.lastAtk=sp.atk; m.lastKnock=tv(sp,'knock');
  { const sg=TL(sp,'stagger'); if(sg&&m.wind>0&&!m.ty.boss&&mr()<TRAIT_V.stagger[sg]){ m.wind=0; m.atkCd=Math.max(m.atkCd||0,0.8); } } const el=sp.elem; let mult=1;
  if(el){ const r=(RES[m.key]||{})[el]; if(r!==undefined)mult=r; if(el==='thunder'&&inWater(m))mult*=1.5; }
  hitFeedback(m,mult,el,quiet);
  if(time<(player.ctrUntil||0))mult*=BL('counter')>=2?1.8:1.5; if(time<(player.swapEdgeUntil||0))mult*=BL('swapedge')>=2?1.9:1.6; if(BL('reckless'))mult*=BL('reckless')>=2?1.4:1.25; if(sp.powK)mult*=sp.powK;
  if(el&&time<(player.momUntil||0))mult*=BL('momentum')>=2?1.4:1.25; if(m.st&&m.st.burn>0){ if(BL('kindle'))mult*=BL('kindle')>=2?1.4:1.25; if(BL('scorch')){ mult*=BL('scorch')>=2?1.7:1.5; m.st.scorched=true; } }
  const n=Math.round(dmg*mult);
  if(n>0)damageMonster(m,n,el==='fire'?'fire':(el||'magic'));
  else if(!m.noticed&&hostile(m)){ m.sleep=false; m.aware=1.25; onNoticed(m); }
  if(el&&mult>0.25&&!m.dead)applyElem(m,el,sp,dmg);
}
function hitFeedback(m,mult,el,quiet){
  const cy=m.y+0.6*m.ty.scale, c=elemCol(el);
  if(mult<=0.25){ for(let q=0;q<9;q++){ const a=mr()*6.28; spawn(m.x,cy,m.z,Math.cos(a)*2.2,0.6+mr(),Math.sin(a)*2.2,0.45,G(mpick(['x','.','\''])),0.12,0.45,0.45,0.5,0); }
    if(sndReady()&&!quiet){ const t=SND.ctx.currentTime; sEnv(sTone(t,'sine',120,80,0.12,sOut(m.x,m.z,0.25)),t,0.005,0.12); } return; }
  if(mult>=1.5){ for(let q=0;q<(quiet?6:18);q++){ const a=mr()*6.28; spawn(m.x,cy,m.z,Math.cos(a)*3,0.8+mr()*2,Math.sin(a)*3,0.6+mr()*0.4,G(mpick(['*','+','#','%'])),0.2,c[0]*3,c[1]*3,c[2]*3,0); }
    m.hitT=0.35; if(sndReady()&&!quiet){ const t=SND.ctx.currentTime; sEnv(sNoise(t,0.25,'highpass',2400,0.8,sOut(m.x,m.z,0.35)),t,0.003,0.22); } }
  else if(el){ for(let q=0;q<6;q++){ const a=mr()*6.28; spawn(m.x,cy,m.z,Math.cos(a)*1.4,0.5+mr(),Math.sin(a)*1.4,0.5,G(mpick(['*','.'])),0.14,c[0]*2.2,c[1]*2.2,c[2]*2.2,0); } }
}
function applyElem(m,el,sp,base){
  const st=m.st||(m.st={}), durK=(1+(sp.aff.dur||0)/100)*sp.pow*(1+0.5*bodyN('linger')), areaK=1+(sp.aff.area||0)/100;
  if(el==='fire'){ if(st.chill>0)react('steam',m,sp,base); else if(st.poison>0)react('blast',m,sp,base); else if(st.shock>0)react('overload',m,sp,base);
    if(!m.dead){ st.burn=Math.max(st.burn||0,3*durK); const ci=m.cz*MW+m.cx; if(!D.liquid[ci]&&time-(m.fireT2||-9)>=0.5){ m.fireT2=time; burstFire(ci,0.6*areaK,0.7); } } }
  else if(el==='ice'){ if(st.burn>0)react('steam',m,sp,base); else if(st.poison>0)react('frostbite',m,sp,base); if(!m.dead)st.chill=Math.max(st.chill||0,2.5*durK); if(time-(m.iceT||-9)>=0.5){ m.iceT=time; chillArea(m.x,m.z,0.9*areaK); } }
  else if(el==='thunder'){ if(st.chill>0)react('shatter',m,sp,base); else if(st.poison>0)react('contagion',m,sp,base); else if(st.burn>0)react('overload',m,sp,base);
    if(!m.dead){ st.shock=Math.max(st.shock||0,0.4*sp.pow); m.wind=0; }
    if(time-(m.chainT||-9)>=0.5){ m.chainT=time; chainLightning(m,1+(sp.aff.chain||0),Math.max(1,Math.round(base*0.5)),areaK); conductWater(m,base); } }
  else if(el==='poison'){ if(st.burn>0)react('blast',m,sp,base); else if(st.chill>0)react('frostbite',m,sp,base); else if(st.shock>0)react('contagion',m,sp,base); if(!m.dead)st.poison=Math.max(st.poison||0,5*durK); }
  if(el!=='thunder'&&sp.aff.chain&&time-(m.chainT2||-9)>=0.5){ m.chainT2=time; let from=m; const seen=new Set([m]);
    for(let k=0;k<sp.aff.chain;k++){ const nx=nearestFoe(from.x,from.z,4*areaK,seen,from.y+0.6*from.ty.scale); if(!nx)break; seen.add(nx); zapLine(from,nx,elemCol(el),el); const s2=nx.st||(nx.st={});
      if(el==='fire')s2.burn=Math.max(s2.burn||0,2*durK); else if(el==='ice')s2.chill=Math.max(s2.chill||0,1.8*durK); else if(el==='poison')s2.poison=Math.max(s2.poison||0,3.5*durK); from=nx; } }
}
function nearestFoe(x,z,r,skip,fy){ let b=null, bd=r; for(const o of monsters){ if(!foe(o)||skip.has(o))continue; const d=Math.hypot(o.x-x,o.z-z); if(d<bd&&(fy===undefined||losClear(x,fy,z,...mCenter(o)))){ bd=d; b=o; } } return b; }
function zapLine(a,b,c,style){ addBolt([a.x,a.y+0.6*a.ty.scale,a.z],[b.x,b.y+0.6*b.ty.scale,b.z],c,style||'thunder'); }
function chainLightning(m,jumps,dmg,areaK){ let from=m; const seen=new Set([m]), order=[];
  sparkCrown(m,RUNE_DEF.thunder.col); zapFlash={x:m.x,y:m.y+0.6*m.ty.scale,z:m.z,col:RUNE_DEF.thunder.col,t:0.16,r:6};
  for(let k=0;k<jumps;k++){ const nx=nearestFoe(from.x,from.z,4*areaK,seen,from.y+0.6*from.ty.scale); if(!nx)break; seen.add(nx); order.push([from,nx]); from=nx; }
  order.forEach(([a,b],k)=>zapQueue.push({t:0.08*(k+1),fn:()=>{ if(b.dead)return; const ay=a.y+0.6*a.ty.scale, by=b.y+0.6*b.ty.scale;
    addBolt([a.x,ay,a.z],[b.x,by,b.z],RUNE_DEF.thunder.col,'thunder');
    let mult=(RES[b.key]||{}).thunder; if(mult===undefined)mult=1; if(inWater(b))mult*=1.5; const n=Math.round(dmg*mult);
    if(n>0)damageMonster(b,n,'thunder'); if(!b.dead){ const s2=b.st||(b.st={}); s2.shock=Math.max(s2.shock||0,0.3); b.wind=0; }
    sparkCrown(b,RUNE_DEF.thunder.col); zapFlash={x:b.x,y:by,z:b.z,col:RUNE_DEF.thunder.col,t:0.16,r:6};
    if(sndReady()){ const t=SND.ctx.currentTime, o=sOut(b.x,b.z,0.3); sEnv(sNoise(t,0.16,'highpass',3200,0.6,o),t,0.002,0.14); sEnv(sTone(t,'square',700+k*180,300,0.08,o),t,0.002,0.07,0.5); } }}));
  if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sNoise(t,0.18,'highpass',3200,0.6,sOut(m.x,m.z,0.25)),t,0.002,0.16); }
}
function react(kind,m,sp,base){
  const st=m.st, areaK=1+(sp.aff.area||0)/100, cx=m.x, cz=m.z, cy=m.y+0.6*m.ty.scale;
  const around=(r,f)=>{ for(const o of monsters){ if(!foe(o))continue; if(Math.hypot(o.x-cx,o.z-cz)<r&&(o===m||losClear(cx,cy,cz,...mCenter(o))))f(o); } };
  const burst=(chars,col,n,sp2)=>{ for(let q=0;q<n;q++){ const a=mr()*6.28, e=mr(); spawn(cx,cy,cz,Math.cos(a)*sp2*(0.5+e),0.6+mr()*2.2,Math.sin(a)*sp2*(0.5+e),0.8+mr()*0.7,G(mpick(chars)),0.22,col[0],col[1],col[2],0); } };
  if(kind==='steam'){ st.burn=0; st.chill=0; burst(['~','o','.'],[2.4,2.5,2.6],40,2.6); around(2.4*areaK,o=>damageMonster(o,roll(4,7),'magic'));
    if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sNoise(t,1.0,'highpass',1800,0.5,sOut(cx,cz,0.4)),t,0.02,0.9); } }
  else if(kind==='blast'){ st.burn=0; st.poison=0; burst(['*','#','%','\''],[3.4,1.8,0.5],50,3.4); burstFire(m.cz*MW+m.cx,1.3*areaK,1.0); around(2.6*areaK,o=>damageMonster(o,roll(5,9),'fire'));
    if(Math.hypot(player.x-cx,player.z-cz)<2.0*areaK)hurtPlayer(roll(1,3),'爆炎'); sBoom(0.4); flash=Math.max(flash,0.35); shake=Math.max(shake,0.25); }
  else if(kind==='overload'){ st.burn=0; st.shock=0; burst(['*','+','/'],[3.2,2.4,1.2],30,3.0);
    around(2.2*areaK,o=>{ damageMonster(o,roll(3,5),'thunder'); const d=Math.hypot(o.x-cx,o.z-cz)||1; o.kx=(o.x-cx)/d*5; o.kz=(o.z-cz)/d*5; }); sBoom(0.25); }
  else if(kind==='shatter'){ st.chill=0; burst(['*','/','\\','+'],[1.6,2.4,3.2],36,3.2); damageMonster(m,Math.round(base*2),'magic');
    if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sNoise(t,0.4,'highpass',4200,1.2,sOut(cx,cz,0.45)),t,0.002,0.35); } }
  else if(kind==='frostbite'){ st.poison=(st.poison||0)*2+3; st.chill=Math.max(st.chill||0,2); burst(['*','.'],[1.2,2.6,1.8],24,1.6); }
  else if(kind==='contagion'){ around(4*areaK,o=>{ if(o===m)return; const s2=o.st||(o.st={}); s2.poison=Math.max(s2.poison||0,st.poison||4); zapLine(m,o,RUNE_DEF.poison.col,'poison'); }); burst(['%','.'],[1.2,3.0,1.0],20,1.8); }
  if(!BOOK.has(kind)){ BOOK.add(kind); try{ localStorage.setItem('al_book',JSON.stringify([...BOOK])); }catch(e){} setTimeout(()=>sChime(player.x,player.z,0.35),120); }
}
// statuses tick on their own; chill slows, shock stops for a moment
function updateStatuses(dt){
  if(dt>0)for(const m of monsters){ if(m.plx!==undefined){ const k=Math.min(1,dt*8); m.vlx=(m.vlx||0)+(((m.x-m.plx)/dt)-(m.vlx||0))*k; m.vlz=(m.vlz||0)+(((m.z-m.plz)/dt)-(m.vlz||0))*k; } m.plx=m.x; m.plz=m.z; }
  for(const m of monsters){ const st=m.st; if(!st||m.dead)continue; const vis=m.visible&&Math.hypot(m.x-player.x,m.z-player.z)<26, cy=m.y+0.6*m.ty.scale;
    if(m.kx||m.kz){ m.x+=m.kx*dt; m.z+=m.kz*dt; m.kx*=Math.exp(-dt*6); m.kz*=Math.exp(-dt*6); if(Math.abs(m.kx)+Math.abs(m.kz)<0.05){ m.kx=0; m.kz=0; }
      const ci=Math.floor(m.z/CELL)*MW+Math.floor(m.x/CELL); if(D.tile[ci]===TW||D.tile[ci]===TX||D.solid.has(ci)){ if(m.slam&&time<m.slam.until){ const dd=m.slam.d; m.slam=null; m.playerT=time; damageMonster(m,dd,'blade'); for(let q=0;q<10;q++){ const a=mr()*6.28; spawn(m.x,m.y+0.6,m.z,Math.cos(a)*1.5,mr()*1.2,Math.sin(a)*1.5,0.5,G(mpick(['#','.',','])),0.14,0.9,0.85,0.8,0); } shake=Math.max(shake,0.12); } m.x-=m.kx*dt*1.5; m.z-=m.kz*dt*1.5; m.kx=0; m.kz=0; } m.cx=Math.floor(m.x/CELL); m.cz=Math.floor(m.z/CELL); }
    if(st.burn>0&&st.burn-dt<=0&&st.scorched&&!m.dead&&BL('scorch')){ m.hp=Math.min(m.maxHp||m.hp,m.hp+(m.maxHp||10)*0.3); st.scorched=false; }
    if(st.burn>0){ st.burn-=dt; st.bt=(st.bt||0)-dt; if(st.bt<=0){ st.bt=0.5; const r=(RES[m.key]||{}).fire; const n=Math.round(roll(1,2)*(r===undefined?1:r)); if(n>0)damageMonster(m,n,'fire'); }
      if(vis&&mr()<dt*14)spawn(m.x+(mr()-0.5)*0.5*m.ty.scale,cy+(mr()-0.3)*0.5,m.z+(mr()-0.5)*0.5*m.ty.scale,0,0.9+mr(),0,0.5,G(mpick(['^','\'','*'])),0.14,2.6,1.2,0.3,0); }
    if(st.poison>0){ st.poison-=dt; st.pt=(st.pt||0)-dt; if(st.pt<=0){ st.pt=0.6; const r=(RES[m.key]||{}).poison; const n=Math.round(1*(r===undefined?1:r)); if(n>0)damageMonster(m,n,'poison'); }
      if(vis&&mr()<dt*8)spawn(m.x+(mr()-0.5)*0.4*m.ty.scale,cy,m.z+(mr()-0.5)*0.4*m.ty.scale,0,-0.6,0,0.8,G(mpick(['.',','])),0.12,0.6,1.8,0.5,1); }
    if(st.chill>0){ st.chill-=dt; if(vis&&mr()<dt*6)spawn(m.x+(mr()-0.5)*0.6*m.ty.scale,cy+(mr()-0.5)*0.6,m.z+(mr()-0.5)*0.6*m.ty.scale,0,0.05,0,0.7,G('*'),0.12,1.4,2.0,2.6,0); }
    if(st.pin>0){ st.pin-=dt; if(vis&&mr()<dt*5)spawn(m.x+(mr()-0.5)*0.4,cy+0.3,m.z+(mr()-0.5)*0.4,0,0,0,0.3,G('#'),0.12,1.4,1.3,1.0,0); }
    if(st.shock>0){ st.shock-=dt; if(vis&&mr()<dt*12)spawn(m.x+(mr()-0.5)*0.5,cy+(mr()-0.5)*0.6,m.z+(mr()-0.5)*0.5,0,0,0,0.12,G(mpick(['/','\\'])),0.14,3,2.8,1.2,0); }
    if(m.dead&&st)m.st=null; }
  for(const c of clouds){ c.t-=dt; c.tick-=dt; if(c.tick<=0){ c.tick=0.5; for(const o of monsters){ if(foe(o)&&Math.hypot(o.x-c.x,o.z-c.z)<c.r&&losClear(c.x,0.6,c.z,...mCenter(o))){ const s2=o.st||(o.st={}); s2.poison=Math.max(s2.poison||0,2.5); } } }
    if(mr()<dt*16){ const a=mr()*6.28, rr=Math.sqrt(mr())*c.r; spawn(c.x+Math.cos(a)*rr,0.15+mr()*0.5,c.z+Math.sin(a)*rr,0,0.15,0,1.2,G(mpick(['%','~','.'])),0.2,0.5,1.4,0.45,0); } }
  clouds=clouds.filter(c=>c.t>0); updateZones(dt);
}
const monTimeK=m=>{ let k=m.st?((m.st.shock>0||m.st.pin>0)?0:(m.st.chill>0?0.5:1)):1; if(m.ty.critter==='mimic'&&!m.hidden)k*=Math.sin(time*4.5+m.ph)>-0.3?1.3:0.06; return k; };

// ---------------------------------------------------------------- projectiles: arrows fly straight, orbs arc and burst; both can bounce and seek
function updateProjs(dt){
  for(const b of beamSegs)b.t-=dt; beamSegs=beamSegs.filter(b=>b.t>0||beamRun);
  for(const p of projs){
    p.t+=dt; if(p.kind==='orb'&&!p.noGrav)p.vy-=9.8*dt;
    if(p.accel){ const v=Math.hypot(p.vx,p.vy,p.vz)||1, nv=Math.min(p.vmax,v+p.accel*dt); p.vx*=nv/v; p.vy*=nv/v; p.vz*=nv/v; }
    if(p.moon){ const R=(p.tide?TRAIT_V.pull[p.tide]:2.6)+p.moon*0.3; if(p.tide)for(const m of monsters){ if(!hittable(m)||m.ty.boss||m.key==='lord'||m.key==='final'||m.ty.habitat)continue; const ax=p.x-m.x, az=p.z-m.z, dd=Math.hypot(ax,az); if(dd>R||dd<0.4)continue; const v=(2+p.tide*0.6)*dt*3/Math.max(0.6,m.ty.scale||1); m.kx=(m.kx||0)+ax/dd*v; m.kz=(m.kz||0)+az/dd*v; m.st=m.st||{}; (p.pulled=p.pulled||new Set()).add(m); }
      if(p.phases>=5){ p.burnT-=dt; if(p.burnT<=0){ p.burnT=0.25; for(const m of monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-p.x,m.z-p.z)<0.6+0.25*p.moon){ m.playerT=time; applyHit(m,2,p.sp,true); } } } }
      const c2=elemCol(p.sp.elem); for(let q=0;q<Math.round(p.moon*2);q++){ const a=mr()*6.28, r=0.25*p.moon; spawn(p.x+Math.cos(a)*r,p.y+(mr()-0.5)*r,p.z+Math.sin(a)*r,0,0,0,0.25,G(mpick(['o','O','*','(',')'])),0.14+0.04*p.moon,c2[0]*2.6,c2[1]*2.6,c2[2]*2.6,0); } }
    if(p.homing){ let best=null, bs=0.5; const v=Math.hypot(p.vx,p.vy,p.vz)||1;
      for(const m of monsters){ if(!foe(m))continue; const cy=m.y+0.6*m.ty.scale, ax=m.x-p.x, ay=cy-p.y, az=m.z-p.z, d=Math.hypot(ax,ay,az); if(d>12||d<0.1)continue; const c=(ax*p.vx+ay*p.vy+az*p.vz)/(d*v); if(c>bs&&losClear(p.x,p.y,p.z,m.x,cy,m.z)){ bs=c; best=[ax/d,ay/d,az/d]; } }
      if(best){ const k=Math.min(1,(p.homing*Math.PI/180)*dt*2.2); p.vx+=(best[0]*v-p.vx)*k; p.vz+=(best[2]*v-p.vz)*k; if(p.kind==='bolt')p.vy+=(best[1]*v-p.vy)*k; } }
    const nx=p.x+p.vx*dt, ny=p.y+p.vy*dt, nz=p.z+p.vz*dt, cx=Math.floor(nx/CELL), cz=Math.floor(nz/CELL);
    const c=elemCol(p.sp.elem), bolt=p.kind==='bolt';
    if(mr()<(p.wave?0.35:0.85))spawn(p.x,p.y,p.z,(mr()-0.5)*0.3,(mr()-0.5)*0.3,(mr()-0.5)*0.3,0.35+mr()*0.25,G(mpick(p.wind?['~',')','(']:bolt?['*','.','\'']:['o','.','*'])),p.big?0.24:p.mini?0.08:bolt?0.11:0.13,c[0]*2.2,c[1]*2.2,c[2]*2.2,0);
    if(cx<0||cz<0||cx>=MW||cz>=MH||p.t>(p.maxT||4)){ p.dead=true; continue; }
    let hm=null; for(const m of monsters){ if(!hittable(m)||p.hit.has(m))continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; const cy=m.y+(m.ty.flier?0:0.6*m.ty.scale); if(Math.hypot(m.x-nx,cy-ny,m.z-nz)<0.42+0.35*m.ty.scale+(p.kind==='bolt'?0.14:0)+(p.rad||0)){ hm=m; break; } }
    if(hm){ p.hit.add(hm); if(bolt){ const dmg=p.dmg||RUNE_DEF.bolt.dmg; applyHit(hm,Math.max(1,Math.round(roll(dmg[0],dmg[1])*(p.dmgK||1))),p.sp); if(!p.wind&&(!p.mini||TL(p.sp,'scatter')>=5))arrowTraits(p,hm,nx,ny,nz);
        if(p.pierce===undefined&&!p.wind&&!p.mini){ const pl=TL(p.sp,'pierce'); p.pierce=[0,1,1,2,3,3][pl]; p.keep=pl>=2; if(pl>=5)p.wallPass=1; }
        if(p.heavy&&!hm.dead){ const v=Math.hypot(p.vx,p.vz)||1, k=(p.heavy>=1?3:0)/Math.max(0.6,hm.ty.scale||1); if(!hm.ty.boss&&hm.key!=='lord'&&hm.key!=='final'){ hm.kx=(hm.kx||0)+p.vx/v*k; hm.kz=(hm.kz||0)+p.vz/v*k; hm.st=hm.st||{}; if(p.heavy>=3)hm.wind=0; if(p.heavy>=5&&time>=(hm.st.pinCd||0)){ hm.st.pin=Math.max(hm.st.pin||0,0.2); hm.st.pinCd=time+1.2; } } }
        if(p.steady>=5){ hm.rapidN=(time-(hm.rapidT||-9)<0.8?(hm.rapidN||0):0)+1; hm.rapidT=time; if(hm.rapidN===3&&!hm.dead){ m_rapidCrit(hm,p.sp); } }
        if(p.boom){ orbBurst(nx,ny,nz,p.sp,{dmg:0.4,rad:0.6,cloud:false}); p.boom=false; }
        if(p.dust){ const n=p.dust>=3?3:2, k=p.dust>=4?0.8:p.dust>=2?0.6:0.45, md=RUNE_DEF.mshot.dmg, sp=p.sp, dl=p.dust; for(let i=0;i<n;i++){ const a=mr()*6.28; projs.push({kind:'bolt',mini:true,x:nx,y:ny,z:nz,vx:Math.cos(a)*12,vy:(mr()-0.3)*2,vz:Math.sin(a)*12,t:0,maxT:0.3,sp,bounce:0,homing:0,hit:new Set([hm]),dmg:[Math.max(1,Math.round(md[0]*k)),Math.max(1,Math.round(md[1]*k))],trail:dl>=5}); } p.dust=0; }
        if(p.trail&&sp_elem(p))addZone(nx,nz,0.6,p.sp,3,false);
        if(p.pierce>0){ p.pierce--; if(!p.keep)p.dmgK=(p.dmgK||1)*0.7; p.x=nx; p.y=ny; p.z=nz; } else p.dead=true; }
      else { if(p.moon)moonBurst(p,nx,ny,nz); else orbBurst(nx,ny,nz,p.sp,p.mini?{dmg:p.burstK,rad:0.6,cloud:false,proj:p}:{proj:p}); p.dead=true; } continue; }
    const i=cz*MW+cx, wall=D.tile[i]===TW||D.tile[i]===TX||doorBlock(i), floor=ny<0.03&&D.tile[i]!==TC, ceil=ny>D.ceil[i];
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
  projs=projs.filter(p=>!p.dead);
}
// sp_elem は src/lib/runes.ts（src/game/imports.mjs で読む）
function m_rapidCrit(m,sp){ m.playerT=time; applyHit(m,5,sp,true); for(let q=0;q<10;q++){ const a=mr()*6.28; spawn(m.x,m.y+0.8,m.z,Math.cos(a)*1.6,0.4+mr(),Math.sin(a)*1.6,0.4,G(mpick(['!','*'])),0.14,2.6,2.2,1.2,0); } }
function moonBurst(p,x,y,z){ const f=p.moon, sp=p.sp; orbBurst(x,y,z,sp,{dmg:f*1.1,rad:0.8+0.45*f}); shake=Math.max(shake,0.1+0.05*f);
  if(p.phases>=3&&f>2.2){ const n=p.phases>=4?5:3; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+mr(); projs.push({kind:'orb',mini:true,gen:9,x,y:Math.max(0.5,y),z,vx:Math.cos(a)*6,vy:3.2,vz:Math.sin(a)*6,t:0,sp,bounce:0,homing:0,hit:new Set(),burstK:0.6}); } }
  if(p.tide>=5&&p.pulled)for(const m of p.pulled){ if(m.dead||m.ty.boss)continue; const st=m.st||(m.st={}); if(time>=(st.pinCd||0)){ st.pin=Math.max(st.pin||0,0.5); st.pinCd=time+1.6; } } }
function arrowTraits(p,hm,x,y,z){ const sp=p.sp, gen=p.gen||0;
  const sc=TL(sp,'scatter'); if(sc&&gen<(sc>=5?2:1)){ const n=sc>=3?3:2, v=Math.hypot(p.vx,p.vz)||1, k=sc>=4?0.8:sc>=2?0.65:0.5, bd=RUNE_DEF.bolt.dmg;
    for(let i=0;i<n;i++){ const a=Math.atan2(p.vz,p.vx)+(mr()-0.5)*1.4; projs.push({kind:'bolt',mini:true,gen:gen+1,x,y,z,vx:Math.cos(a)*14,vy:(mr()-0.4)*2,vz:Math.sin(a)*14,t:0,maxT:0.35,sp,bounce:0,homing:0,hit:new Set([hm]),dmg:[Math.max(1,Math.round(bd[0]*k)),Math.max(1,Math.round(bd[1]*k))]}); } }
  const pn=TL(sp,'pin'); if(pn&&!hm.dead&&!hm.ty.boss&&hm.key!=='lord'&&hm.key!=='final'){ const st=hm.st||(hm.st={}); let dur=pn>=2?0.45:0.3;
    if(pn>=3){ const v=Math.hypot(p.vx,p.vz)||1, wx=hm.x+p.vx/v*1.1, wz=hm.z+p.vz/v*1.1, wi=Math.floor(wz/CELL)*MW+Math.floor(wx/CELL); if(wi>=0&&wi<NCELL&&(D.tile[wi]===TW||D.tile[wi]===TX)){ dur=pn>=4?1.6:1.2; for(let q=0;q<6;q++)spawn(hm.x,hm.y+0.8,hm.z,(mr()-0.5)*0.5,mr()*0.4,(mr()-0.5)*0.5,0.5,G('#'),0.14,1.6,1.4,1.0,0);
        if(pn>=5)for(const k of ['burn','chill','shock','poison'])if(st[k]>0)st[k]*=2; } }
    if(time<(st.pinCd||0))return; st.pin=Math.max(st.pin||0,dur); st.pinCd=time+dur+1.2; } }
function orbBurst(x,y,z,sp,opt){
  opt=opt||{}; const dK=opt.dmg||1, areaK=1+(sp.aff.area||0)/100, R=1.7*areaK*(opt.rad||1), c=elemCol(sp.elem), ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL);
  for(let q=0;q<28;q++){ const a=mr()*6.28, e=mr(); spawn(x,y,z,Math.cos(a)*R*1.6*(0.4+e),0.5+mr()*1.8,Math.sin(a)*R*1.6*(0.4+e),0.6+mr()*0.4,G(mpick(['*','o','.','+'])),0.18,c[0]*2.6,c[1]*2.6,c[2]*2.6,0); }
  sCrackleBurst(x,z); makeNoise(x,z,9,0.6); shake=Math.max(shake,0.08);
  for(const m of monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-x,m.z-z)<R+0.3*m.ty.scale&&losClear(x,Math.max(0.4,y),z,...mCenter(m))){ hitSrcPoint=[x,z]; applyHit(m,Math.max(1,Math.round(roll(RUNE_DEF.orb.dmg[0],RUNE_DEF.orb.dmg[1])*dK)),sp,true); hitSrcPoint=null; } }
  if(sp.elem==='fire'&&ci>=0&&ci<NCELL&&!D.liquid[ci])burstFire(ci,R/CELL+0.6,0.9);
  if(sp.elem==='ice')chillArea(x,z,R); if(sp.elem==='thunder')landElem(sp,x,y,z,ci);
  if(sp.elem==='poison'&&opt.cloud!==false)clouds.push({x,z,r:R*1.1,t:3*(1+(sp.aff.dur||0)/100),tick:0});
  if(!opt.proj)return; const p=opt.proj, gen=p.gen||0;
  const sL=TL(sp,'split'); if(sL&&gen<(sL>=5?2:1)){ const n=sL>=3?3:2, spd=sL>=2?6.5:4.5; for(let k=0;k<n;k++){ const a=mr()*6.28; projs.push({kind:'orb',mini:true,gen:gen+1,x,y:Math.max(0.5,y),z,vx:Math.cos(a)*spd,vy:3.8,vz:Math.sin(a)*spd,t:0,sp,bounce:0,homing:0,hit:new Set(),burstK:sL>=4?0.7:0.5}); } }
  const tL=TL(sp,'trace'); if(tL&&!p.mini)addZone(x,z,R*(tL>=3?1.0:0.7),sp,[0,4,6,6,8,8][tL],tL>=5);
  const iL=TL(sp,'impact'); if(iL&&!p.mini){ for(const m of monsters){ if(!hittable(m))continue; const ax=m.x-x, az=m.z-z, dd=Math.hypot(ax,az)||0.01; if(dd>R+0.5)continue; if(m.ty.boss||m.key==='lord'||m.key==='final'||m.ty.habitat)continue;
      const v=(iL>=2?8:6)/Math.max(0.6,(m.ty.scale||1)); m.kx=(m.kx||0)+ax/dd*v; m.kz=(m.kz||0)+az/dd*v; m.st=m.st||{}; if(iL>=3)m.slam={d:iL>=4?6:3,until:time+0.7}; if(iL>=5){ m.wind=0; m.st.pin=Math.max(m.st.pin||0,0.8); } } }
}
// lingering traces of an element: every half second, what stands in them takes the element
let zones=[], laters=[];
function addZone(x,z,r,sp,dur,grow){ const near=zones.find(zn=>zn.el===sp.elem&&Math.hypot(zn.x-x,zn.z-z)<Math.max(0.7,zn.r*0.6)); if(near){ near.t=Math.max(near.t,dur); near.sp=sp; return; } zones.push({x,z,r,r0:r,sp,el:sp.elem,t:dur,tick:0,grow}); if(zones.length>14)zones.shift(); }
function later(dt,fn){ laters.push({t:time+dt,fn}); }
function updateZones(dt){ updateRains(dt); for(const L of laters)if(time>=L.t){ L.done=true; try{ L.fn(); }catch(e){} } laters=laters.filter(L=>!L.done);
  for(const zn of zones){ zn.t-=dt; zn.tick-=dt; if(zn.grow)zn.r=Math.min(zn.r0*1.7,zn.r+dt*0.18);
    if(zn.tick<=0&&zn.el){ zn.tick=0.5; for(const m of monsters){ if(!hittable(m)||m.ty.critter)continue; if(Math.hypot(m.x-zn.x,m.z-zn.z)<zn.r+0.3*m.ty.scale){ m.playerT=time; applyElem(m,zn.el,zn.sp,1); } } } }
  zones=zones.filter(zn=>zn.t>0); }
function drawZones(t){ for(const mk of marks){ const n=mk.star?14:18, b=0.6+0.4*Math.sin(t*10); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*(mk.star?1.5:0.6); dyn(mk.x+Math.cos(a)*mk.r,0.06,mk.z+Math.sin(a)*mk.r,G(mk.star?'+':'.'),0.15,mk.c[0]*b*2,mk.c[1]*b*2,mk.c[2]*b*2,0,0); } if(mk.star)dyn(mk.x,0.08,mk.z,G('*'),0.3,mk.c[0]*2.5*b,mk.c[1]*2.5*b,mk.c[2]*2.5*b,0,0); }
  for(const zn of zones){ if(Math.hypot(zn.x-player.x,zn.z-player.z)>30)continue; const c=elemCol(zn.el), f=Math.min(1,zn.t/1.5), n=Math.round(10+zn.r*8);
  for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.3, rr=zn.r*(0.92+0.08*Math.sin(t*3+k)), b=(zn.el?0.9:0.35)*f*(0.7+0.3*Math.sin(t*4+k*1.3)); dyn(zn.x+Math.cos(a)*rr,0.05,zn.z+Math.sin(a)*rr,G(zn.el==='fire'?'^':zn.el==='ice'?'*':zn.el==='thunder'?'/':zn.el==='poison'?'%':'.'),0.15,c[0]*b*1.8,c[1]*b*1.8,c[2]*b*1.8,0,0); } } }
// a hit somewhere in the world from other code
function burstFire(i,r,str){
  const cx=i%MW, cz=(i/MW)|0, rr=Math.ceil(r);
  for(let dz=-rr;dz<=rr;dz++)for(let dx=-rr;dx<=rr;dx++){ if(Math.hypot(dx,dz)>r)continue; const x=cx+dx, z=cz+dz; if(x<0||z<0||x>=MW||z>=MH)continue; const j=z*MW+x; const tt=D.tile[j]; if(tt===TW||tt===TC||D.liquid[j]===LQ_WATER||D.liquid[j]===LQ_DEEP)continue;
    fuel[j]=Math.max(fuel[j],0.5); ignite(j,str,false); if(D.gas[j]>0.1)boom(j); }
}
function viewDir(){ const cp=Math.cos(player.pitch); return [-Math.sin(player.yaw)*cp,Math.sin(player.pitch),-Math.cos(player.yaw)*cp]; }
let projs=[];
function groundPoint(o,d,maxD){ let x=o[0], y=o[1], z=o[2], px=x, pz=z; for(let s2=0;s2<(maxD||22);s2+=0.3){ x+=d[0]*0.3; y+=d[1]*0.3; z+=d[2]*0.3;
    for(const m of monsters){ if(!foe(m))continue; const cy=m.y+0.6*m.ty.scale; if(Math.hypot(m.x-x,cy-y,m.z-z)<0.6+0.35*m.ty.scale)return [m.x,m.z]; }
    const ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL); if(ci<0||ci>=NCELL||D.tile[ci]===TW||D.tile[ci]===TX||doorBlock(ci))return [px,pz]; if(y<=0.05)return [x,z]; px=x; pz=z; }
  return [x,z]; }
let rains=[], marks=[];

// ---------------------------------------------------------------- triggers
function onRolled(){ if(BL('quickdodge'))player.qcUntil=time+(BL('quickdodge')>=2?2.5:1.5); if(BL('counter'))player.ctrUntil=time+1.5;
   for(const h of ['L','R']){ if(h==='R'&&isTwo())continue; const H=hands[h]; if(H.trig&&H.trig.type==='dodge'&&H.atk&&trigCd[h]<=0&&!swapSt){ trigCd[h]=1.0; castNow(h); } } }
function onKilledBy(m){ for(const h of ['L','R']){ if(h==='R'&&isTwo())continue; const H=hands[h]; if(!(H.trig&&H.trig.type==='kill')||!H.atk||trigCd[h]>0||swapSt)continue;
    const [ox,oy,oz]=handPoint(h); let t=null, bd=15; for(const o of monsters){ if(o===m||!foe(o))continue; const dd=Math.hypot(o.x-player.x,o.z-player.z); if(dd>=bd)continue; if(!losClear(ox,oy,oz,...mCenter(o)))continue; bd=dd; t=o; }
    if(!t)continue; const cy=t.y+0.6*t.ty.scale, d=Math.hypot(t.x-ox,cy-oy,t.z-oz)||1; trigCd[h]=0.5;
    if(((atkType(h)==='blade'||atkType(h)==='gsweep')&&Math.hypot(t.x-player.x,t.z-player.z)>2.9)||(atkType(h)==='dash'&&Math.hypot(t.x-player.x,t.z-player.z)>4.5))continue; castNow(h,{dir:[(t.x-ox)/d,(cy-oy)/d,(t.z-oz)/d],auto:true}); } }

