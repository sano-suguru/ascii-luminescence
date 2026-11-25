// ---------------------------------------------------------------- drawing: runes on the floor, pedestals, altars, steles, beams, a ring while swapping, the chant at your hands
// ---------------------------------------------------------------- what lies ahead: not told in words but felt - what leaks up the stairs, traces at branch doors, the light of other realms;
// quiet enough to notice only up close
const STRATUM_OMEN={
 cavern:{col:[0.55,0.85,0.5],gl:[',','.',"'"],vy:0.5,look:'下から、湿った土と苔の匂いが上がってくる。遠くで、水の滴る音がする',snd:'drip'},
 ruins:{col:[0.78,0.64,1.0],gl:['.','ᛁ','ᚱ','ᛊ',':'],vy:0.35,look:'下から、古い石の冷たい空気が流れてくる。遠くで、鐘のような響きがする',snd:'chime'},
 magma:{col:[1.0,0.42,0.12],gl:['*',"'",'.'],vy:0.9,look:'下から、熱い風が吹き上がってくる。床が赤く照らされている',snd:'rumble',glow:[1.0,0.35,0.1]},
 abyss:{col:[0.55,0.42,0.95],gl:['.',':','`'],vy:0.25,look:'下から、冷たい闇が這い上がってくる。かすかな囁きが聞こえる',snd:'whisper',glow:[0.35,0.2,0.7]},
};
const SPECIAL_OMEN={
 town:{col:[1.0,0.78,0.45],gl:['.','*'],vy:0.4,look:'下から、焚き火の匂いと、かすかな人の声がする',snd:'drip'},
 bigroom:{col:[0.82,0.84,0.95],gl:['.'],vy:0.6,look:'下から、広い空間を渡る風の音がする',snd:'wind'},
 oracle:{col:[1.0,0.9,0.55],gl:['*','.'],vy:0.3,look:'下から、澄んだ鈴の音と、静かな水音が聞こえる',snd:'chime'},
 fortress:{col:[1.0,0.58,0.25],gl:['*','.',"'"],vy:0.7,look:'下から、熱気と、鉄を打つような響きが上がってくる',snd:'rumble'},
};
const BRANCH_OMEN={
 crypt:{col:[0.62,0.82,1.0],look:'周りに骨が散らばり、冷たい霧が這い出している',snd:'chant'},
 lair:{col:[1.0,0.62,0.32],look:'床に深い爪痕が刻まれている。奥から、温かい獣の息が漂ってくる',snd:'growl'},
 sunken:{col:[0.45,0.8,0.98],look:'床が濡れて光っている。奥から、水の音と泡の弾ける音がする',snd:'bubble'},
 nest:{col:[0.88,0.88,0.95],look:'蜘蛛の糸が絡みついている。奥で、何かがかさかさと動く',snd:'scuttle'},
 snake:{col:[0.62,0.86,0.45],look:'脱ぎ捨てられた蛇の皮が落ちている。奥から、低いシューという音がする',snd:'hiss'},
};
const REALM_OMEN={
 ice:{col:[0.75,0.92,1.0],gl:['*','.'],vy:-0.25,look:'門の周りの床に霜が降り、凍てついた冷気が流れ出している',frost:true,snd:'wind'},
 lab:{col:[1.0,0.45,0.88],gl:['ᛁ','ᚱ','ᛊ','*'],vy:0.2,look:'門の周りに、宙に浮かぶ文字の欠片と、魔法陣の光が漂っている',snd:'chime'},
 volcano:{col:[1.0,0.5,0.15],gl:["'",'.','*'],vy:0.6,look:'門の向こうから、灰と熱気が吹きつけてくる',snd:'rumble'},
};
// stratumAtDepth は src/lib/strata.ts（src/game/imports.mjs で読む）
function computeOmen(){ const o={stairs:null,branch:null,portal:null,traces:[],sndT:{}};
  if(here.branch){ if(here.branch.lvl<here.branch.len)o.stairs={kind:'branch',key:here.branch.key,strong:here.branch.lvl+1===here.branch.len}; }
  else if(!here.realm&&here.D.stairs>=0&&!here.D.finalVault&&here.depth<FINAL_DEPTH){ const ik=!here.inter?interAfter(here.depth):null; if(ik)o.stairs={kind:'special',key:ik}; else { const nd=here.depth+1, a=here.inter?SPECIALS[here.inter.key]:stratumAtDepth(here.depth), b=stratumAtDepth(nd); if(a&&b&&a.k!==b.k)o.stairs={kind:'stratum',key:b.k}; } }
  if(here.D.bstairs)o.branch={key:here.D.bstairs.key,cell:here.D.bstairs.cell};
  if(here.D.portal)o.portal={key:here.D.portal.key,cell:here.D.portal.cell};
  const lay=(cell,key,strong)=>{ const [cx,cz]=cpos(cell), n=strong?44:24, R=strong?6:4.2, rr=mulberry32((cell*7919+adv.runSeed)>>>0);
    for(let k=0;k<n;k++){ const a=rr()*6.28, d=0.9+rr()*(R-0.9), x=cx+Math.cos(a)*d, z=cz+Math.sin(a)*d, ci=((z/CELL)|0)*MW+((x/CELL)|0); if(ci<0||ci>=here.D.tile.length||here.D.tile[ci]!==TF)continue; o.traces.push({x,z,key,r:rr(),a:rr()*6.28}); } };
  if(o.branch)lay(o.branch.cell,o.branch.key,false);
  if(o.stairs&&o.stairs.kind==='branch')lay(here.D.stairs,o.stairs.key,o.stairs.strong);
  return o; }
const omenOf=()=>here.D?(here.D.omen||(here.D.omen=computeOmen())):null;
function omenSound(kind,x,z){ if(!sndReady())return; const d=Math.hypot(x-player.x,z-player.z), v=Math.max(0.05,1-d/10);
  if(kind==='drip')sDrip(x,z,0.4*v); else if(kind==='chime'||kind==='chant')sChime(x,z,0.22*v); else if(kind==='rumble'||kind==='growl')sRumble(0.18*v,kind==='growl'?0.9:1.6);
  else if(kind==='whisper'||kind==='wind'||kind==='hiss')sHiss(x,z,kind==='hiss'?0.7:1.4); else if(kind==='bubble')sBubble(x,z,0.3*v); else if(kind==='scuttle')sHiss(x,z,0.18); }
function drawOmens(t,dt){ if(!here.D||ui.gallery)return; const o=omenOf(); if(!o)return;
  const near=(x,z,r)=>Math.hypot(x-player.x,z-player.z)<r, rate=(n)=>mr()<n*(dt||0.016);
  const rise=(x,z,def,n,spread)=>{ if(!rate(n))return; const a=mr()*6.28, rr=mr()*(spread||0.7), down=def.vy<0;
    spawn(x+Math.cos(a)*rr,down?2.2+mr()*0.6:0.15,z+Math.sin(a)*rr,(mr()-0.5)*0.15,def.vy*(0.7+mr()*0.6),(mr()-0.5)*0.15,2.4+mr(),G(mpick(def.gl)),0.12,def.col[0]*1.3,def.col[1]*1.3,def.col[2]*1.3,0); };
  const sound=(key,kind,x,z)=>{ if(!kind||!near(x,z,10))return; if(clock.time<(o.sndT[key]||0))return; o.sndT[key]=clock.time+6+sndRand()*5; omenSound(kind,x,z); };
  // the stairs: what lies below leaks up
  if(o.stairs&&o.stairs.kind!=='branch'){ const def=o.stairs.kind==='special'?SPECIAL_OMEN[o.stairs.key]:STRATUM_OMEN[o.stairs.key]; const [x,z]=cpos(here.D.stairs);
    if(def&&near(x,z,20)){ rise(x,z,def,3.2); if(def.glow)for(let k=0;k<16;k++){ const a=k/16*Math.PI*2+t*0.1, b=0.5+0.25*Math.sin(t*1.7+k); dyn(x+Math.cos(a)*1.3,0.04,z+Math.sin(a)*1.3,G('.'),0.15,def.glow[0]*b,def.glow[1]*b,def.glow[2]*b,0,0); } sound('st',def.snd,x,z); } }
  // the otherworld gate: its realm's light
  if(o.portal){ const def=REALM_OMEN[o.portal.key], [x,z]=cpos(o.portal.cell); if(def&&near(x,z,20)){ rise(x,z,def,3,1.0); if(def.frost)for(let k=0;k<20;k++){ const a=k*2.399, r=0.8+(k%5)*0.3; dyn(x+Math.cos(a)*r,0.03,z+Math.sin(a)*r,G(k%3?'.':'*'),0.13,0.55,0.7,0.85,0,0); } sound('po',def.snd,x,z); } }
  // traces at branch doors and on the stairs deeper into a branch
  for(const tr of o.traces){ if(!near(tr.x,tr.z,18))continue; const k=tr.key, r=tr.r;
    if(k==='crypt'){ dyn(tr.x,0.03,tr.z,G(r<0.15?'O':r<0.5?mpick(['(',')']):r<0.8?'=':'o'),0.15,0.62,0.6,0.55,0,0); }
    else if(k==='lair'){ if(r<0.45){ for(let q=0;q<3;q++)dyn(tr.x+Math.cos(tr.a)*q*0.1,0.03,tr.z+Math.sin(tr.a)*q*0.1,G('/'),0.15,0.55,0.4,0.3,0,0); } else if(r<0.8)dyn(tr.x,0.04,tr.z,G('"'),0.14,0.5,0.36,0.22,0,0); else dyn(tr.x,0.03,tr.z,G('%'),0.16,0.18,0.12,0.09,0,0); }
    else if(k==='sunken'){ const b=0.45+0.15*Math.sin(t*1.5+tr.a); dyn(tr.x,0.03,tr.z,G('~'),0.16,0.25*b*2,0.5*b*2,0.7*b*2,0,0); if(rate(0.25))spawn(tr.x,0.05,tr.z,0,0.35,0,1.0,G('o'),0.08,0.5,0.8,1.0,0); }
    else if(k==='nest'){ if(r<0.55)dyn(tr.x,0.03,tr.z,G(mpick(['-','/','\\'])),0.15,0.5,0.5,0.55,0,0); else if(r<0.85){ for(let q=0;q<3;q++)dyn(tr.x,1.4+q*0.35,tr.z,G('|'),0.13,0.45,0.45,0.5,0,0); } else { const a=t*1.5+tr.a; dyn(tr.x+Math.cos(a)*0.3,0.05,tr.z+Math.sin(a)*0.3,G('x'),0.11,0.5,0.45,0.4,0,0); } }
    else if(k==='snake'){ if(r<0.6){ for(let q=0;q<4;q++)dyn(tr.x+Math.cos(tr.a)*q*0.13,0.03,tr.z+Math.sin(tr.a)*q*0.13+Math.sin(q*1.6)*0.05,G(q%2?'s':'~'),0.14,0.62,0.6,0.42,0,0); } else dyn(tr.x,0.03,tr.z,G(','),0.14,0.3,0.5,0.24,0,0); } }
  if(o.branch){ const [x,z]=cpos(o.branch.cell), k=o.branch.key; if(near(x,z,18)){ if(k==='crypt')rise(x,z,{col:[0.45,0.6,0.8],gl:['~','.'],vy:0.08},1.5,1.2); if(k==='lair')rise(x,z,{col:[0.6,0.45,0.32],gl:['~'],vy:0.15},0.8,0.6); sound('br',BRANCH_OMEN[k].snd,x,z); } }
  if(o.stairs&&o.stairs.kind==='branch'){ const [x,z]=cpos(here.D.stairs), k=o.stairs.key; if(near(x,z,18)){ if(k==='crypt')rise(x,z,{col:[0.45,0.6,0.8],gl:['~','.'],vy:0.08},o.stairs.strong?3:1.5,1.4); sound('st',BRANCH_OMEN[k].snd,x,z); } }
}

// ---------------------------------------------------------------- direction arrows: from a point just above the hands, arrows spread out toward places - straight-line direction only, never the way;
// near ones short and thick, far ones long and thin. The stairs are always known; branch stairs and gates once seen; altars, springs, treasuries, guarded prizes and graves from 20 m (1.5x at the crossroads), the last four as '?' until seen. A place in plain sight needs no arrow.
const arrowCv=document.getElementById('arrows'), arrowCtx=arrowCv?arrowCv.getContext('2d'):null;
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
function drawArrows(){ if(!arrowCtx)return; const W=Math.round(arrowCv.clientWidth*devicePixelRatio), H=Math.round(arrowCv.clientHeight*devicePixelRatio), c=arrowCtx; if(arrowCv.width!==W||arrowCv.height!==H){ arrowCv.width=W; arrowCv.height=H; } if(arrowsDrawn){ c.clearRect(0,0,W,H); arrowsDrawn=false; }
  if(!ui.started||adv.dead||isPaused()||ui.gallery)return; const ts=arrowTargets().filter(t=>!inPlainSight(t)); if(!ts.length)return; arrowsDrawn=true;
  const k=devicePixelRatio, ox=W/2, oy=H*0.66, r0=46*k, ps=player.yaw, fx=-Math.sin(ps), fz=-Math.cos(ps), rx=Math.cos(ps), rz=-Math.sin(ps), FONT='"M PLUS 1 Code","BIZ UDGothic",monospace';
  c.textAlign='center'; c.textBaseline='middle'; c.lineJoin='round';
  // the ring the arrows spread from
  c.font=`${11*k}px ${FONT}`; for(let q=0;q<24;q++){ const a=q/24*Math.PI*2; c.lineWidth=3*k; c.strokeStyle='rgba(0,0,0,0.55)'; c.strokeText('·',ox+Math.cos(a)*r0*0.72,oy+Math.sin(a)*r0*0.72); c.fillStyle='rgba(210,200,245,0.45)'; c.fillText('·',ox+Math.cos(a)*r0*0.72,oy+Math.sin(a)*r0*0.72); }
  const glyph=(ch,x,y,rot,size,rgb,alpha,bold)=>{ c.save(); c.translate(x,y); if(rot)c.rotate(rot); c.font=`${bold?'bold ':''}${size}px ${FONT}`;
    c.lineWidth=Math.max(2,size*0.28); c.strokeStyle='rgba(4,3,10,0.85)'; c.strokeText(ch,0,0);
    c.shadowColor=`rgba(${rgb},${(alpha*0.9).toFixed(2)})`; c.shadowBlur=size*0.6; c.fillStyle=`rgba(${rgb},${alpha.toFixed(2)})`; c.fillText(ch,0,0); c.restore(); };
  for(const t of ts){ const dx=t.x-player.x, dz=t.z-player.z, th=Math.atan2(dx*rx+dz*rz,dx*fx+dz*fz), sx=Math.sin(th), sy=-Math.cos(th);
    const near=clamp(1-(t.d-3)/37,0,1), len=(24+96*(1-near))*k, size=(13+7*near)*k, alpha=0.62+0.35*near, rgb=t.col.map(v=>Math.round(v*255)).join(',');
    const step=size*0.42, n=Math.max(1,Math.round(len/step)), thick=near>0.5, body=thick?'=':'-';
    for(let i=0;i<n;i++){ const px=ox+sx*(r0+i*step), py=oy+sy*(r0+i*step); glyph(i===n-1?'>':body,px,py,th-Math.PI/2,size,rgb,alpha,thick); }
    // the mark at the tip: larger, on a faint dark disc
    const mx=ox+sx*(r0+n*step+size*0.85), my=oy+sy*(r0+n*step+size*0.85), ms=(17+5*near)*k;
    c.beginPath(); c.arc(mx,my,ms*0.7,0,Math.PI*2); c.fillStyle='rgba(6,4,14,0.55)'; c.fill(); c.lineWidth=1.2*k; c.strokeStyle=`rgba(${rgb},${(alpha*0.6).toFixed(2)})`; c.stroke();
    glyph(t.ch,mx,my+ms*0.02,0,ms,rgb,Math.min(1,alpha+0.1),true); } }
const stairsGuarded=()=>here.D&&here.D.stairGuard!==undefined&&here.monsters.some(m=>!m.dead&&m.g===here.D.stairGuard);
function drawStairSeal(t){ if(!here.D||here.D.stairGuard===undefined)return; const [x,z]=cpos(here.D.stairs); const d=Math.hypot(x-player.x,z-player.z); if(d>26)return; const on=stairsGuarded();
  if(on){ for(let k=0;k<18;k++){ const a=k/18*Math.PI*2+t*0.4, b=0.7+0.3*Math.sin(t*2+k); dyn(x+Math.cos(a)*0.9,0.3+0.12*Math.sin(t*1.5+k),z+Math.sin(a)*0.9,G(k%3?'=':'#'),0.18,1.4*b,0.4*b,0.55*b,0,0); } if(d<12&&clock.time>(here.D.sealSnd||0)){ here.D.sealSnd=clock.time+7+sndRand()*4; omenSound('growl',x,z); } }
  else if(!here.D.sealOpenMsg){ here.D.sealOpenMsg=true; msg('<b style="color:#ffd27a">=</b>階段を閉ざしていた封が、静かに解けた。'); sChime(x,z,0.4); } }
// the air of each part of a level: the crossroads a little brighter, the way to the stairs a little darker and quieter
let ambK=1;
function updateSectionAir(dt){ if(!here.D||!here.D.prof)return; const pc=((player.z/CELL)|0)*MW+((player.x/CELL)|0); let k=1;
  if(here.D.hub&&here.D.roomOf[pc]===here.D.hub.ri)k=1.25; else if(here.D.dS&&here.D.pathL>0&&here.D.dS[pc]>here.D.pathL*0.7)k=0.85;
  ambK+=(k-ambK)*Math.min(1,dt*1.2); U.uAmb.value=here.D.prof.ambient*ambK; }
function drawGraves(t){ for(const it of (here.D.items||[])){ if(it.kind!=='grave'||it.taken)continue; const [x,z]=cpos(it.i); if(Math.hypot(x-player.x,z-player.z)>26)continue;
    for(let y=0;y<3;y++)dyn(x,0.2+y*0.3,z,G(y===2?'+':'|'),0.34,0.55,0.55,0.62,0,0); dyn(x-0.18,0.62,z,G('-'),0.3,0.5,0.5,0.58,0,0); dyn(x+0.18,0.62,z,G('-'),0.3,0.5,0.5,0.58,0,0);
    const c=runeCol(it.rune), b=0.9+0.4*Math.sin(t*1.8+it.i); dyn(x,1.35+0.06*Math.sin(t*1.3),z,G(RUNE_DEF[it.rune.type].ch),0.26,c[0]*b,c[1]*b,c[2]*b,0,0); } }
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
let humNode=null, crossKey='', aimT=0, crossMon=null, slowFx=0;
function humStart(){ if(!sndReady())return null; const ctx=SND.ctx, t=ctx.currentTime, o=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain();
  o.type='triangle'; o.frequency.setValueAtTime(110,t); o.frequency.linearRampToValueAtTime(220,t+1.4); o2.type='sine'; o2.frequency.setValueAtTime(165,t); o2.frequency.linearRampToValueAtTime(330,t+1.4);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.06,t+0.35); o.connect(g); o2.connect(g); g.connect(sOut(undefined,undefined,1)); o.start(t); o2.start(t);
  return {stop(){ const t2=ctx.currentTime; try{ g.gain.cancelScheduledValues(t2); g.gain.setValueAtTime(Math.max(0.0001,g.gain.value),t2); g.gain.exponentialRampToValueAtTime(0.0001,t2+0.15); o.stop(t2+0.2); o2.stop(t2+0.2); }catch(e){} }}; }
function castSound(sp,x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.32), el=sp.elem;
  if(el==='fire'){ sEnv(sNoise(t,0.5,'lowpass',1400,0.7,o,300),t,0.01,0.45); sCrackleBurst(player.x,player.z); }
  else if(el==='ice'){ sEnv(sTone(t,'sine',1760,2640,0.35,o),t,0.005,0.3); sEnv(sTone(t,'sine',2349,3520,0.25,o),t,0.01,0.25,0.5); }
  else if(el==='thunder'){ sEnv(sNoise(t,0.3,'highpass',3000,0.7,o),t,0.002,0.28); sEnv(sTone(t,'square',90,40,0.25,o),t,0.003,0.22,0.4); }
  else if(el==='poison'){ for(let k=0;k<4;k++)setTimeout(()=>sBubble(player.x,player.z,0.4,k%2===0),k*60); }
  else sWhoosh(); }
function handUp(){ const [fx,fy,fz]=viewDir(), rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw); let ux=-rz*fy, uy=rz*fx-rx*fz, uz=rx*fy; if(uy<0){ ux=-ux; uy=-uy; uz=-uz; } const l=Math.hypot(ux,uy,uz)||1; return [[fx,fy,fz],[rx,0,rz],[ux/l,uy/l,uz/l]]; }
// what the crosshair points at: the first wall, floor or creature along the line of sight
function aimPoint(){ const [ox,oy,oz]=aimOrigin(), [dx,dy,dz]=viewDir(); let x=ox, y=oy, z=oz;
  const near=here.monsters.filter(m=>hittable(m)&&Math.hypot(m.x-ox,m.z-oz)<42);
  for(let s=0;s<160;s++){ x+=dx*0.25; y+=dy*0.25; z+=dz*0.25; const ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL); if(ci<0||ci>=NCELL)break;
    if(here.D.tile[ci]===TW||here.D.tile[ci]===TX||y<0.02||y>here.D.ceil[ci])return [x,y,z];
    for(const m of near){ if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; const cy=m.hidden?m.y+1.3:m.y+(m.ty.flier?0:0.6*m.ty.scale); if(Math.hypot(m.x-x,cy-y,m.z-z)<0.42+0.35*m.ty.scale)return [x,y,z]; } }
  return [x,y,z]; }
function centerPoint(){ const [o0,o1,o2]=aimOrigin(), [f]=handUp(); return [o0+f[0]*0.95,o1+f[1]*0.95,o2+f[2]*0.95]; }
// the chant circle: born at the hand, drawn to the crosshair as the chant fills
function castPoint(h,k){ const a=handPoint(h), b=centerPoint(), e=1-Math.pow(1-clamp(k,0,1),2.2); return [a[0]+(b[0]-a[0])*e,a[1]+(b[1]-a[1])*e,a[2]+(b[2]-a[2])*e]; }
function shotFrame(h,chanted,kind){ const o=chanted?(()=>{ const c=castPoint(h,1), u=handUp()[2]; return [c[0]-u[0]*0.14,c[1]-u[1]*0.14,c[2]-u[2]*0.14]; })():handPoint(h), a=assistPoint(o,kind)||aimPoint(), dx=a[0]-o[0], dy=a[1]-o[1], dz=a[2]-o[2], l=Math.hypot(dx,dy,dz);
  return {o,d:l>1?[dx/l,dy/l,dz/l]:viewDir()}; }
function assistPoint(o,kind){ if(kind!=='bolt'&&kind!=='beam')return null; const m=aimTarget(); if(!m||m.dead)return null;
  const c=[m.x,m.y+(m.ty.flier?0:0.6*m.ty.scale),m.z]; if(kind==='beam')return c;
  const t=Math.hypot(c[0]-o[0],c[1]-o[1],c[2]-o[2])/20; return [c[0]+(m.vlx||0)*t,c[1],c[2]+(m.vlz||0)*t]; }
function handPoint(h){ const [o0,o1,o2]=aimOrigin(), [f,r,u]=handUp(), s=h==='L'?-1:1; return [o0+f[0]*0.95+r[0]*s*0.38-u[0]*0.27,o1+f[1]*0.95-u[1]*0.27,o2+f[2]*0.95+r[2]*s*0.38-u[2]*0.27]; }
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
  if(!gear.castSt){ if(crossMon&&crossMon.dead)crossMon=null; return; }
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
function aimTarget(){ if(clock.time-aimT<0.1)return crossMon; aimT=clock.time; crossMon=null; const [ox,oy,oz]=aimOrigin(), [vx,vy,vz]=viewDir(); let bd=1e9;
  let ba=1e9; for(const m of here.monsters){ if(!foe(m)||!m.visible)continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; const cy=m.y+0.6*m.ty.scale, ax=m.x-ox, ay=cy-oy, az=m.z-oz, d=Math.hypot(ax,ay,az); if(d>28)continue;
    const ang=Math.acos(clamp((ax*vx+ay*vy+az*vz)/Math.max(d,1e-3),-1,1)), tol=0.08+Math.atan2(0.6*m.ty.scale,Math.max(d,0.5)); if(ang>tol)continue;
    const score=ang/tol+d*0.01; if(score<ba&&losClear(ox,oy,oz,m.x,cy,m.z)){ ba=score; crossMon=m; } }
  return crossMon; }
function updateCross(dt){
  const el=document.getElementById('cross'); if(!el)return;
  slowFx+=((gear.castSt?1:0)-slowFx)*Math.min(1,(dt||0.016)*8); finalPass.uniforms.uSlow.value=slowFx;
  if(gear.castSt){ const c=elemCol(gear.hands[gear.castSt.h].elem?gear.hands[gear.castSt.h].elem.type:null); finalPass.uniforms.uTint.value.set(c[0],c[1],c[2]); }
  const tg=ui.started&&!adv.dead&&!isPaused()?aimTarget():null;
  // the sight: a small dot; it is flanked when it holds a creature; while chanting, the runes of that hand close in on it and, when the chant is full, rest beside it and pulse
  let txt='·', col='rgba(225,215,255,.55)', cls='';
  if(gear.castSt){ const H=gear.hands[gear.castSt.h], k=Math.min(1,gear.castSt.t/Math.max(0.01,gear.castSt.need)), c0=elemCol(H.elem?H.elem.type:null), c=c0.map(v=>v*0.72+0.25), gap=gear.castSt.full?0:Math.max(0,3-Math.round(k*3));
    const E=H.elem?RUNE_DEF[H.elem.type].ch:'·', A=E;
    txt=`${A}${' '.repeat(gap+1)}·${' '.repeat(gap+1)}${E}`; col=css(c); cls=gear.castSt.full?'full':'chant'; }
  else if(tg){ txt='‹·›'; col='rgba(255,190,140,.85)'; }
  const key=txt+col+cls; if(key===crossKey)return; crossKey=key; el.textContent=txt; el.style.color=col; el.className=cls;
}

