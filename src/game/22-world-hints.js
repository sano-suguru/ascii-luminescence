// ---------------------------------------------------------------- drawing: runes on the floor, pedestals, altars, steles, beams, a ring while swapping, the chant at your hands
// 先にある物の手がかり（表 STRATUM_OMEN など・computeOmen・omenOf・omenSound・drawOmens）と階段の封（stairsGuarded・drawStairSeal）は src/lib/omens.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- direction arrows: from a dial lying on a floor just above the hands, arrows spread out toward places - straight-line direction only, never the way;
// near ones short and thick, far ones long and thin. The stairs are always known; branch stairs and gates once seen; altars, springs, treasuries, guarded prizes and graves from 20 m (1.5x at the crossroads), the last four as '?' until seen. A place in plain sight needs no arrow.
const arrowCv=document.getElementById('arrows'), arrowCtx=arrowCv?arrowCv.getContext('2d'):null, hotbarEl=document.getElementById('hotbar');
function arrowTargets(){ const out=[]; if(!here.D||!ui.started||adv.dead)return out; const pc=((player.z/CELL)|0)*MW+((player.x/CELL)|0), atHub=here.D.hub&&here.D.roomOf[pc]===here.D.hub.ri, far=atHub?1.5:1;
  // standing at the crossroads, presences around are felt from farther off
  const P=(cell,ch,col,range,seenOnly,vague)=>{ if(cell==null||cell<0)return; if(seenOnly&&!here.explored[cell])return; const [x,z]=cpos(cell), d=Math.hypot(x-player.x,z-player.z); if(range&&d>range*far)return;
    // a thing not yet seen is only a presence: a '?' in the colour of its light
    if(vague&&!here.explored[cell])ch='?'; out.push({x,z,d,ch,col}); };
  if(!here.D.finalVault&&here.D.stairs>=0)P(here.D.stairs,'>',[1.0,0.85,0.45],0,false);
  if(here.D.bstairs)P(here.D.bstairs.cell,'>',[0.75,0.6,1.0],0,true);
  if(here.D.portal)P(here.D.portal.cell,'0',[1.0,0.55,0.9],0,true);
  const seenAltar=new Set(); for(const it of (here.D.items||[])){ if(it.taken)continue;
    if(it.altar&&!seenAltar.has(it.grp)){ seenAltar.add(it.grp); if(it.forge)P(it.i,'T',[0.7,0.85,1.0],20,false); else P(it.i,'_',[1.0,0.8,0.45],20,false); }
    else if(it.kind==='spring')P(it.i,'~',[0.5,0.88,1.0],20,false,true);
    else if(it.kind==='grave')P(it.i,'+',[0.78,0.78,0.9],20,false,true);
    else if(it.vault)P(here.D.gate?here.D.gate.cell:it.i,'#',[1.0,0.82,0.3],20,false,true);
    else if(it.elitePrize)P(it.i,'*',[1.0,0.42,0.32],20,false,true); }
  return out; }
function inPlainSight(t){ if(t.d>22)return false; const [ox,oy,oz]=aimOrigin(), [vx,vy,vz]=viewDir(), dx=t.x-ox, dz=t.z-oz, dy=0.9-oy, L=Math.hypot(dx,dy,dz)||1;
  if((dx*vx+dy*vy+dz*vz)/L<Math.cos(0.5))return false; return losClear(ox,oy,oz,t.x,0.9,t.z); }
let arrowsDrawn=false;
// where the line at the bottom (#hotbar) starts, in CSS pixels (-1: hidden), kept until it or the window changes size, so the page's layout is not read every tick
// (reading it right after the status or the log was written makes the browser lay the page out again). Without ResizeObserver it is read every time
let hotbarTop=null; const hotbarWatch=!!(hotbarEl&&window.ResizeObserver);
if(hotbarWatch){ new ResizeObserver(()=>{ hotbarTop=null; }).observe(hotbarEl); addEventListener('resize',()=>{ hotbarTop=null; }); }
// the dial lies on a floor in front of you, seen from above at a slant: what is ahead points away into the dial, what is behind comes toward you.
// The slant follows the look up and down, but only between ARROW_TILT (radians above the floor), so the dial never leaves the screen or turns into a flat circle
const ARROW_TILT=[0.55,1.15], ARROW_TILT0=0.8;
function drawArrows(){ if(!arrowCtx)return; const W=Math.round(arrowCv.clientWidth*devicePixelRatio), H=Math.round(arrowCv.clientHeight*devicePixelRatio), c=arrowCtx; if(arrowCv.width!==W||arrowCv.height!==H){ arrowCv.width=W; arrowCv.height=H; } if(arrowsDrawn){ c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,W,H); arrowsDrawn=false; }
  if(!ui.started||adv.dead||isPaused()||ui.gallery)return; const ts=arrowTargets().filter(t=>!inPlainSight(t)); if(!ts.length)return; arrowsDrawn=true;
  // on a short screen the whole dial is smaller, so what is behind you still fits above the bottom edge
  const k=devicePixelRatio*clamp(arrowCv.clientHeight/450,0.6,1), ox=W/2, oy=H*0.6, r0=60*k, ps=player.yaw, fx=-Math.sin(ps), fz=-Math.cos(ps), rx=Math.cos(ps), rz=-Math.sin(ps), FONT='"M PLUS 1 Code","BIZ UDGothic",monospace';
  // a point (u to the right, v ahead) on the dial's floor, seen from Dv away at the slant e: its place on the screen
  const e=clamp(ARROW_TILT0-player.pitch,ARROW_TILT[0],ARROW_TILT[1]), ce=Math.cos(e), se=Math.sin(e), Dv=800*k;
  // the lowest a tip mark may reach: just above the line at the bottom (#hotbar), wherever it is now; the bottom of the screen when it is hidden
  let top=hotbarTop; if(top===null){ const hb=hotbarEl?hotbarEl.getBoundingClientRect():null; top=hb&&hb.height>0?hb.top:-1; if(hotbarWatch)hotbarTop=top; }
  const floorY=top<0?H:top*devicePixelRatio-6*k;
  const proj=(u,v)=>{ const dp=Dv/(Dv+v*ce); return [ox+u*dp,oy-v*se*dp]; };
  c.textAlign='center'; c.textBaseline='middle'; c.lineJoin='round';
  // a glyph lying on the dial at (u,v), its line of writing along (du,dv)
  const glyph=(ch,u,v,du,dv,size,rgb,alpha,bold)=>{ const [x,y]=proj(u,v), [ax,ay]=proj(u+du,v+dv), [bx,by]=proj(u+dv,v-du); c.save(); c.setTransform(ax-x,ay-y,bx-x,by-y,x,y);
    c.font=`${bold?'bold ':''}${size}px ${FONT}`;
    c.lineWidth=Math.max(2,size*0.28); c.strokeStyle='rgba(4,3,10,0.85)'; c.strokeText(ch,0,0);
    c.shadowColor=`rgba(${rgb},${(alpha*0.9).toFixed(2)})`; c.shadowBlur=size*0.6; c.fillStyle=`rgba(${rgb},${alpha.toFixed(2)})`; c.fillText(ch,0,0); c.restore(); };
  // a faint shadow on the floor under the dial, and the ring the arrows spread from
  { const [cx]=proj(0,0), [,ty]=proj(0,r0*2.2), [,by]=proj(0,-r0*2.2), [lx]=proj(-r0*2.2,0); c.save(); c.translate(cx,(ty+by)/2); c.scale(1,(by-ty)/2/(cx-lx));
    const g=c.createRadialGradient(0,0,0,0,0,cx-lx); g.addColorStop(0,'rgba(4,3,10,0.6)'); g.addColorStop(1,'rgba(4,3,10,0)'); c.fillStyle=g; c.beginPath(); c.arc(0,0,cx-lx,0,Math.PI*2); c.fill(); c.restore(); }
  for(let q=0;q<24;q++){ const a=q/24*Math.PI*2; glyph('·',Math.cos(a)*r0*0.72,Math.sin(a)*r0*0.72,Math.cos(a),Math.sin(a),19*k,'215,205,250',0.75,false); }
  for(const t of ts){ const dx=t.x-player.x, dz=t.z-player.z, th=Math.atan2(dx*rx+dz*rz,dx*fx+dz*fz), su=Math.sin(th), sv=Math.cos(th);
    const near=clamp(1-(t.d-3)/37,0,1), len=(30+120*(1-near))*k, size=(18+10*near)*k, alpha=0.62+0.35*near, rgb=t.col.map(v=>Math.round(v*255)).join(',');
    const step=size*0.42, thick=near>0.5, body=thick?'=':'-', ms=(17+5*near)*k, tipR=n=>r0+n*step+size*0.85;
    // what is behind comes toward you: an arrow too long for the room above the line at the bottom is cut shorter
    let n=Math.max(1,Math.round(len/step)); while(n>1&&proj(su*tipR(n),sv*tipR(n))[1]>floorY-ms)n--;
    for(let i=0;i<n;i++)glyph(i===n-1?'>':body,su*(r0+i*step),sv*(r0+i*step),su,sv,size,rgb,alpha,thick);
    // the mark at the tip: larger, standing up on a faint dark disc, the same size however far into the dial it is, to be read at a glance
    const [mx,my]=proj(su*tipR(n),sv*tipR(n));
    c.beginPath(); c.arc(mx,my,ms*0.7,0,Math.PI*2); c.fillStyle='rgba(6,4,14,0.55)'; c.fill(); c.lineWidth=1.2*k; c.strokeStyle=`rgba(${rgb},${(alpha*0.6).toFixed(2)})`; c.stroke();
    c.save(); c.translate(mx,my+ms*0.02); c.font=`bold ${ms}px ${FONT}`; c.lineWidth=Math.max(2,ms*0.28); c.strokeStyle='rgba(4,3,10,0.85)'; c.strokeText(t.ch,0,0);
    c.shadowColor=`rgba(${rgb},${(Math.min(1,alpha+0.1)*0.9).toFixed(2)})`; c.shadowBlur=ms*0.6; c.fillStyle=`rgba(${rgb},${Math.min(1,alpha+0.1).toFixed(2)})`; c.fillText(t.ch,0,0); c.restore(); } }
// the air of each part of a level: the crossroads a little brighter, the way to the stairs a little darker and quieter
let ambK=1;
function updateSectionAir(dt){ if(!here.D||!here.D.prof)return; const pc=((player.z/CELL)|0)*MW+((player.x/CELL)|0); let k=1;
  if(here.D.hub&&here.D.roomOf[pc]===here.D.hub.ri)k=1.25; else if(here.D.dS&&here.D.pathL>0&&here.D.dS[pc]>here.D.pathL*0.7)k=0.85;
  ambK+=(k-ambK)*Math.min(1,dt*1.2); gfx.U.uAmb.value=here.D.prof.ambient*ambK; }
// 墓を描く drawGraves は src/lib/fixtures.ts（src/game/imports.mjs で読む）
function drawRunesWorld(t){
  drawZones(t);
  drawStairSeal(t); updateSectionAir(0.016);
  drawSprings(t); drawGraves(t);
  { const pr=(here.D.items||[]).find(o=>o.vault&&!o.taken&&o.ev); if(pr){ const ri=here.D.roomOf[pr.i], room=ri>=0&&here.D.rooms[ri]&&here.D.rooms[ri].cells.length>6?here.D.rooms[ri]:(pr.area||(pr.area={cells:vaultArea(pr,2)})); const [px,pz]=cpos(pr.i); if(room&&Math.hypot(px-player.x,pz-player.z)<20){ const rr=mulberry32((pr.i*31+7)>>>0);
    if(pr.ev==='guard'){ for(let k=0;k<2;k++){ const c=room.cells[Math.floor(rr()*room.cells.length)], [x,z]=cpos(c), b=0.6+0.5*Math.max(0,Math.sin(t*0.9+k*2)); dyn(x-0.06,1.35,z,G('.'),0.12,1.6*b,0.3*b,0.25*b,0,0); dyn(x+0.06,1.35,z,G('.'),0.12,1.6*b,0.3*b,0.25*b,0,0); for(let y=0;y<4;y++)dyn(x,0.2+y*0.32,z,G(y===3?'@':'#'),0.3,0.32,0.3,0.34,0,0); } }
    else { if(mr()<0.12){ const c=room.cells[Math.floor(mr()*room.cells.length)], [x,z]=cpos(c); spawn(x+(mr()-0.5),2.8,z+(mr()-0.5),0,-0.4,0,2.2,G(mpick(['.',','])),0.1,0.6,0.56,0.5,1); } for(let k=0;k<6;k++){ const c=room.cells[Math.floor(rr()*room.cells.length)], [x,z]=cpos(c); dyn(x,0.03,z,G(rr()<0.5?'/':'\\'),0.18,0.4,0.36,0.32,0,0); } } } } }
  updateRockfall(0.016);
  for(const it of (here.D.items||[])){ if(it.taken||it.kind!=='slot')continue; const [x,z]=cpos(it.i); if(Math.hypot(x-player.x,z-player.z)>28)continue; const b=1.8+0.6*Math.sin(t*2.2+it.i), hy=0.75+0.08*Math.sin(t*1.6);
    dyn(x-0.16,hy,z,G('{'),0.34,2.6*b/2,2.2*b/2,1.3*b/2,0,0); dyn(x+0.16,hy,z,G('}'),0.34,2.6*b/2,2.2*b/2,1.3*b/2,0,0); dyn(x,hy,z,G('.'),0.2,1.6,1.5,1.2,0,0); if(mr()<0.15)spawn(x+(mr()-0.5)*0.4,hy,z+(mr()-0.5)*0.4,0,0.5,0,0.8,G('.'),0.1,2.2,1.9,1.2,0); }
  for(const it of (here.D.items||[])){ if(it.taken||it.kind!=='rune')continue; let [x,z]=cpos(it.i); const dd=Math.hypot(x-player.x,z-player.z); if(dd>28)continue;
    const guarded=it.guardG!==undefined&&guardedNow(it);
    if(guarded&&it.elitePrize){ const b=0.5; dyn(x,0.75,z,G(RUNE_DEF[it.rune.type].ch),0.42,0.5*b,0.45*b,0.5*b); for(let k=0;k<8;k++){ const a=k/8*Math.PI*2+t*0.3; dyn(x+Math.cos(a)*0.4,0.75+Math.sin(a*2)*0.08,z+Math.sin(a)*0.4,G('#'),0.14,0.55,0.25,0.2); } continue; }
    if(!it.rune||guarded){ if(dd<12&&it.altar&&!guarded)altarFill(it.grp); if(!it.rune||guarded){ if(it.altar&&it.slot===1&&it.opt!=='open')for(let k=-1;k<=1;k++){ dyn(x+k*0.55,0.55,z,G('='),0.42,0.4,0.38,0.45); dyn(x+k*0.55,0.25,z,G('#'),0.36,0.3,0.28,0.34); } continue; } }
    if(it.altar)x+=(it.slot-1)*0.55;
    const c=runeCol(it.rune), tc=TIER_COL[0], b=(1.7+0.5*Math.sin(t*2+it.i+(it.slot||0))), hy=it.pedestal?1.05:it.altar?1.05:0.6;
    if(it.pedestal){ dyn(x,0.25,z,G('|'),0.36,0.5,0.48,0.55); dyn(x,0.6,z,G('|'),0.36,0.5,0.48,0.55); dyn(x,0.85,z,G('='),0.34,0.6,0.58,0.65); }
    if(it.altar&&it.slot===1&&it.opt!=='open'){ for(let k=-1;k<=1;k++){ dyn(x+k*0.55,0.55,z,G('='),0.42,0.55,0.52,0.6); dyn(x+k*0.55,0.25,z,G('#'),0.36,0.4,0.38,0.45); } }
    if(it.opt==='heal'){ dyn(x,hy+Math.sin(t*1.5+it.i+(it.slot||0))*0.06,z,G('+'),0.5,1.0*b,0.5*b,0.58*b); } else { dyn(x,hy+Math.sin(t*1.5+it.i+(it.slot||0))*0.06,z,G(RUNE_DEF[it.rune.type].ch),0.5,c[0]*b,c[1]*b,c[2]*b); }
    for(let k=0;k<6;k++){ const a=t*0.8+k/6*Math.PI*2+(it.slot||0); dyn(x+Math.cos(a)*0.3,hy-0.45,z+Math.sin(a)*0.3,G('.'),0.1,tc[0]*1.4,tc[1]*1.4,tc[2]*1.4); } }
  for(const s of (here.D.steles||[])){ const [x,z]=cpos(s.i), d=Math.hypot(x-player.x,z-player.z); if(d>30)continue; const near=d<2.6, g=near?2.2:0.9;
    for(let y=0;y<4;y++)dyn(x,0.25+y*0.42,z,G(y===3?'^':'#'),0.4,0.42,0.4,0.48);
    dyn(x,1.0+Math.sin(t*1.3+s.i)*0.04,z+0.01,G(s.g),0.32,0.55*g,0.75*g,1.0*g); }
  for(const b of fight.beamSegs){ let run=0; for(let k=0;k+1<b.pts.length;k++){ const a=b.pts[k], e=b.pts[k+1], L=Math.hypot(e[0]-a[0],e[1]-a[1],e[2]-a[2]), n=Math.max(1,Math.round(L/0.22));
      for(let j=0;j<n;j++){ const f=j/n, fl=0.75+0.5*mr(), dd=run+L*f, near=Math.max(0,1-dd/7), sz=0.1+0.1*near, br=1.3+1.2*near; dyn(a[0]+(e[0]-a[0])*f,a[1]+(e[1]-a[1])*f,a[2]+(e[2]-a[2])*f,G(mpick(['-','=','*'])),sz,b.col[0]*br*fl,b.col[1]*br*fl,b.col[2]*br*fl); } run+=L; }
    const e=b.pts[b.pts.length-1]; dyn(e[0],e[1],e[2],G('*'),0.3,b.col[0]*3,b.col[1]*3,b.col[2]*3); }
  for(const p of fight.projs){ if(p.wave||p.thrust){ drawWave(p); continue; } const c=elemCol(p.sp.elem); dyn(p.x,p.y,p.z,G(p.kind==='bolt'?'*':'o'),p.kind==='bolt'?0.26:0.32,c[0]*2.2,c[1]*2.2,c[2]*2.2); if(p.auto)dyn(p.x,p.y,p.z,G('o'),0.46,0.9,0.9,1.0); }
  // the chant gathers at the hand: the hand's runes circle in front of you, brighter as the chant fills
  if(gear.castSt||gear.swapSt){ const [ox,oy,oz]=aimOrigin(), [fx,fy,fz]=viewDir(), rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw);
    if(gear.castSt){ const H=gear.hands[gear.castSt.h], side=gear.castSt.h==='L'?-0.35:0.35, k=Math.min(1,gear.castSt.t/Math.max(0.01,gear.castSt.need)), c=elemCol(H.elem?H.elem.type:null), list=[H.elem].filter(Boolean);
      list.forEach((ru,j)=>{ const a=t*3+j*Math.PI, r=0.12+0.06*k; dyn(ox+fx*0.8+rx*(side+Math.cos(a)*r),oy-0.3+fy*0.8+Math.sin(a)*r,oz+fz*0.8+rz*(side+Math.cos(a)*r),G(RUNE_DEF[ru.type].ch),0.1+0.05*k,c[0]*(1+2*k),c[1]*(1+2*k),c[2]*(1+2*k)); }); }
    if(gear.swapSt){ const rs=allRunes().filter(r=>['elem','trig','mod'].includes(RUNE_DEF[r.type].cat)).slice(0,8), k=gear.swapSt.t/gear.swapSt.dur; rs.forEach((ru,j)=>{ const a=t*2+j/rs.length*Math.PI*2; dyn(player.x+Math.cos(a)*0.9,(ui.camMode==='tps'?1.0:player.eye-0.5)+Math.sin(t*3+j)*0.08,player.z+Math.sin(a)*0.9,G(RUNE_DEF[ru.type].ch),0.2,0.6+k,0.6+k,0.9+k); }); } }
}

// ---------------------------------------------------------------- the feel of a chant: a circle of runes at the hand, light gathering, the lantern taking the element's colour, a rising hum
// 詠唱の声 humNode は src/lib/state.ts の gear（src/game/imports.mjs で読む）
let crossKey='', slowFx=0;
function humStart(){ if(!sndReady())return null; const ctx=SND.ctx, t=ctx.currentTime, o=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain();
  o.type='triangle'; o.frequency.setValueAtTime(110,t); o.frequency.linearRampToValueAtTime(220,t+1.4); o2.type='sine'; o2.frequency.setValueAtTime(165,t); o2.frequency.linearRampToValueAtTime(330,t+1.4);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.06,t+0.35); o.connect(g); o2.connect(g); g.connect(sOut(undefined,undefined,1)); o.start(t); o2.start(t);
  return {stop(){ const t2=ctx.currentTime; try{ g.gain.cancelScheduledValues(t2); g.gain.setValueAtTime(Math.max(0.0001,g.gain.value),t2); g.gain.exponentialRampToValueAtTime(0.0001,t2+0.15); o.stop(t2+0.2); o2.stop(t2+0.2); }catch(e){} }}; }
// castSound は src/lib/audio.ts（src/game/imports.mjs で読む）
// 照準の小さな関数（handUp・aimPoint・centerPoint・castPoint・handPoint）は src/lib/aim.ts（src/game/imports.mjs で読む）
// shotFrame は src/lib/aim.ts（src/game/imports.mjs で読む）
// assistPoint は src/lib/aim.ts（src/game/imports.mjs で読む）
// where the spell will go: straight (arrows, beams) or an arc (orbs), with bounces; the first creature in the way
function simPath(sp){
  const fr=sp.atk==='beam'?beamFrame(sp.h):shotFrame(sp.h,true,sp.atk), [ox,oy,oz]=fr.o, d0=fr.d, pts=[]; let hitM=null;
  if(sp.atk==='orb'){ let x=ox, y=oy, z=oz, vx=d0[0]*12, vy=d0[1]*12+2.6, vz=d0[2]*12, b=sp.aff.bounce||0;
    for(let s=0;s<160;s++){ const dt=0.025; vy-=9.8*dt; const nx=x+vx*dt, ny=y+vy*dt, nz=z+vz*dt, ci=Math.floor(nz/CELL)*MW+Math.floor(nx/CELL);
      if(ci<0||ci>=NCELL)break; if(s%3===0)pts.push([x,y,z]);
      for(const m of here.monsters){ if(!foe(m)||!m.visible)continue; if(Math.hypot(m.x-nx,m.y+0.6*m.ty.scale-ny,m.z-nz)<0.42+0.35*m.ty.scale){ hitM=m; break; } } if(hitM){ x=nx; y=ny; z=nz; break; }
      const wall=here.D.tile[ci]===TW||here.D.tile[ci]===TX, fl=ny<0.03&&here.D.tile[ci]!==TC, ce=ny>here.D.ceil[ci];
      if(wall||fl||ce){ if(b>0){ b--; const v=Math.hypot(vx,vy,vz)||1, r=reflectDir(x,y,z,[vx/v,vy/v,vz/v]); vx=r[0]*v; vy=r[1]*v*0.7; vz=r[2]*v; if(fl)vy=Math.abs(vy)+1; continue; } break; }
      x=nx; y=ny; z=nz; }
    return {pts,end:[x,Math.max(0.05,y),z],hitM,orb:true}; }
  let x=ox, y=oy, z=oz, d=d0.slice(), b=sp.aff.bounce||0, left=sp.atk==='beam'?12:26;
  while(left>0){ const nx=x+d[0]*0.3, ny=y+d[1]*0.3, nz=z+d[2]*0.3, ci=Math.floor(nz/CELL)*MW+Math.floor(nx/CELL); left-=0.3; if(ci<0||ci>=NCELL)break;
    for(const m of here.monsters){ if(!foe(m)||!m.visible)continue; if(Math.hypot(m.x-nx,m.y+0.6*m.ty.scale-ny,m.z-nz)<0.42+0.35*m.ty.scale){ hitM=m; break; } } if(hitM){ x=nx; y=ny; z=nz; break; }
    const wall=here.D.tile[ci]===TW||here.D.tile[ci]===TX||ny<0.02||ny>here.D.ceil[ci];
    if(wall){ if(b>0){ b--; d=reflectDir(x,y,z,d); pts.push([x,y,z]); continue; } break; }
    x=nx; y=ny; z=nz; pts.push([x,y,z]); }
  return {pts,end:[x,y,z],hitM}; }
function drawCastFx(t){
  if(!gear.hands)return;
  if(!gear.castSt){ if(ui.crossMon&&ui.crossMon.dead)ui.crossMon=null; return; }
  const sp=specOf(gear.castSt.h), c=elemCol(sp.elem), k=Math.min(1,gear.castSt.t/Math.max(0.01,gear.castSt.need)), full=gear.castSt.full;
  // the circle at the hand
  const P=castPoint(gear.castSt.h,k), [f,r,u]=handUp(), H=gear.hands[gear.castSt.h], rs=[H.elem].filter(Boolean).map(ru=>RUNE_DEF[ru.type].ch), n=12, rr=0.05+0.03*k, spin=t*(full?5:2);
  for(let j=0;j<n;j++){ const a=spin+j/n*Math.PI*2, ch=(j%3===0&&rs.length)?rs[(j/3|0)%rs.length]:'.', lit=j%3===0&&gear.castSt.sylT!==undefined&&clock.time-gear.castSt.sylT<0.16&&(j/3|0)===(gear.castSt.syl%4), br=(0.8+2.4*k)*(full?1.25+0.25*Math.sin(t*12):1)*(lit?2.2:1);
    dyn(P[0]+(r[0]*Math.cos(a)+u[0]*Math.sin(a))*rr,P[1]+(u[1]*Math.sin(a))*rr,P[2]+(r[2]*Math.cos(a)+u[2]*Math.sin(a))*rr,G(ch),ch==='.'?0.02:0.032+0.014*k,c[0]*br,c[1]*br,c[2]*br); }
  // light gathers toward the hand
  if(mr()<0.5+0.4*k){ const a=mr()*6.28, e=(mr()-0.3)*1.2, d=1.4+mr()*0.8, sx=player.x+Math.cos(a)*d, sz=player.z+Math.sin(a)*d, sy=P[1]+e;
    spawn(sx,sy,sz,(P[0]-sx)/0.45,(P[1]-sy)/0.45,(P[2]-sz)/0.45,0.42,G(mpick(['.','\'','*'])),0.06,c[0]*2,c[1]*2,c[2]*2,0); }
  // the path, the landing, the target
  if(sp.atk==='blade'||sp.atk==='bare')return;
  const path=simPath(sp), dim=0.35+0.65*k;
  const [aox,aoy,aoz]=aimOrigin();
  path.pts.forEach((p,j)=>{ if(j%2||Math.hypot(p[0]-aox,p[1]-aoy,p[2]-aoz)<1.6)return; const fade=dim*(1-j/Math.max(1,path.pts.length)*0.5); dyn(p[0],p[1],p[2],G(path.orb?'o':'-'),path.orb?0.11:0.12,c[0]*2.4*fade,c[1]*2.4*fade,c[2]*2.4*fade); });
  const e=path.end;
  if(path.orb){ const R=1.7*(1+(sp.aff.area||0)/100); for(let j=0;j<18;j++){ const a=j/18*Math.PI*2+t*0.6; dyn(e[0]+Math.cos(a)*R,0.12,e[2]+Math.sin(a)*R,G(j%3?'.':'+'),0.24,c[0]*2.6*dim,c[1]*2.6*dim,c[2]*2.6*dim); } }
  dyn(e[0],e[1],e[2],G('x'),0.26,c[0]*3*dim,c[1]*3*dim,c[2]*3*dim);
  const m=path.hitM; if(m){ const cy=m.y+0.6*m.ty.scale, w=0.35*m.ty.scale+0.25; dyn(m.x-r[0]*w,cy,m.z-r[2]*w,G('['),0.42*Math.max(0.8,m.ty.scale),c[0]*3,c[1]*3,c[2]*3); dyn(m.x+r[0]*w,cy,m.z+r[2]*w,G(']'),0.42*Math.max(0.8,m.ty.scale),c[0]*3,c[1]*3,c[2]*3); }
}
// the crosshair is a glyph: it closes from ( + ) to [+] as the chant fills; it warms when a creature is in the line
// aimTarget は src/lib/aim.ts（src/game/imports.mjs で読む）
function updateCross(dt){
  const el=document.getElementById('cross'); if(!el)return;
  slowFx+=((gear.castSt?1:0)-slowFx)*Math.min(1,(dt||0.016)*8); gfx.finalPass.uniforms.uSlow.value=slowFx;
  if(gear.castSt){ const c=elemCol(gear.hands[gear.castSt.h].elem?gear.hands[gear.castSt.h].elem.type:null); gfx.finalPass.uniforms.uTint.value.set(c[0],c[1],c[2]); }
  const tg=ui.started&&!adv.dead&&!isPaused()?aimTarget():null;
  // the sight: a small dot; it is flanked when it holds a creature; while chanting, the runes of that hand close in on it and, when the chant is full, rest beside it and pulse
  let txt='·', col='rgba(225,215,255,.55)', cls='';
  if(gear.castSt){ const H=gear.hands[gear.castSt.h], k=Math.min(1,gear.castSt.t/Math.max(0.01,gear.castSt.need)), c0=elemCol(H.elem?H.elem.type:null), c=c0.map(v=>v*0.72+0.25), gap=gear.castSt.full?0:Math.max(0,3-Math.round(k*3));
    const E=H.elem?RUNE_DEF[H.elem.type].ch:'·', A=E;
    txt=`${A}${' '.repeat(gap+1)}·${' '.repeat(gap+1)}${E}`; col=css(c); cls=gear.castSt.full?'full':'chant'; }
  else if(tg){ txt='‹·›'; col='rgba(255,190,140,.85)'; }
  const key=txt+col+cls; if(key===crossKey)return; crossKey=key; el.textContent=txt; el.style.color=col; el.className=cls;
}

