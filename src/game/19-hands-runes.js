// ---------------------------------------------------------------- the weapons in hand: drawn in glyphs as if held, entering from the lower edges of the view and cut off by them;
// near parts large, far parts small; filled shapes with bright rims; a hand where a hand would be (a fist on a hilt or shaft, the bow hand and the drawing hand,
// two hands on a two-handed weapon, an open hand when bare). Long weapons show only their upper part. Near a wall the picture shrinks toward the eye.
// VM_ST・vmGlyphS・vmGlyph など 5 個は src/lib/hands.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）
// RUNE_FONT・TRAIT_V・pct など 18 個は src/lib/runes.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）
const VM_MODELS=(()=>{ const TV=Math.tan(37*Math.PI/180), AS=16/9, SZ=0.03, K=VM_K;
  const S=(sx,sy,z)=>[sx*TV*AS*z,sy*TV*z,z];
  const L3=(A,B,t)=>[0,1,2].map(k=>A[k]+(B[k]-A[k])*t);
  // a stroke of glyphs along a line, spaced so that each glyph stands apart
  const stroke=(o,A,B,part,sz,g,gap)=>{ sz=(sz||SZ)*K; const dx=B[0]-A[0], dy=B[1]-A[1], dz=B[2]-A[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(sz*(gap||0.5)))), gg=g||vmGlyphS(A,B); for(let i=0;i<=n;i++){ const t=i/n; o.push([A[0]+dx*t,A[1]+dy*t,A[2]+dz*t,gg,part,sz]); } };
  const curve=(o,A,C,B,part,sz,g)=>{ const N=8; let P=A; for(let i=1;i<=N;i++){ const t=i/N, Q=[0,1,2].map(k=>(1-t)*(1-t)*A[k]+2*(1-t)*t*C[k]+t*t*B[k]); stroke(o,P,Q,part,sz,g); P=Q; } };
  const ring=(o,c,R,a0,a1,n,part,sz,g)=>{ for(let i=0;i<n;i++){ const a=a0+(a1-a0)*i/Math.max(1,n-1); o.push([c[0]+Math.cos(a)*R,c[1]+Math.sin(a)*R,c[2],g||'o',part,(sz||SZ)*K]); } };
  // a fist: a few large glyphs, the forearm leaving the view downward
  const fist=(o,c,arm)=>{ const P=[[-0.05,0.024,'@'],[0,0.032,'@'],[0.05,0.024,'@'],[-0.04,-0.027,'%'],[0.01,-0.03,'%'],[0.057,-0.02,'%']]; for(const [x,y,g] of P)o.push([c[0]+x,c[1]+y,c[2],g,g==='@'?'knuckle':'hand',0.038*K]);
    if(arm!==false)stroke(o,[c[0]+0.02,c[1]-0.04,c[2]-0.01],[c[0]+(arm||0.09),c[1]-0.42,c[2]-0.12],'arm',0.05,'%',1.1); };
  // a sword along one axis: pommel, grip in the fist, a guard square to the axis, the blade to the tip
  const sword=(o,P0,T,fistT,guardT,w0,guardW,inner)=>{ const ax=[T[0]-P0[0],T[1]-P0[1],T[2]-P0[2]], al=Math.hypot(ax[0],ax[1])||1, px=-ax[1]/al, py=ax[0]/al;
    const F=L3(P0,T,fistT), Gd=L3(P0,T,guardT); fist(o,F); stroke(o,L3(P0,T,fistT+0.03),Gd,'metal',0.03);
    stroke(o,[Gd[0]-px*guardW,Gd[1]-py*guardW,Gd[2]],[Gd[0]+px*guardW,Gd[1]+py*guardW,Gd[2]],'metal',0.032);
    const B0=L3(P0,T,guardT+0.02); stroke(o,[B0[0]-px*w0,B0[1]-py*w0,B0[2]],T,'edge',0.03); stroke(o,[B0[0]+px*w0,B0[1]+py*w0,B0[2]],T,'edge',0.03);
    if(inner)stroke(o,B0,L3(B0,T,0.85),'fill',0.026,null,0.9); o.push([...T,'^','edge',0.034]); return F; };
  const M={};
  { const o=[], F=sword(o,S(0.66,-1.12,0.47),S(0.42,-0.42,0.82),0.13,0.27,0.026,0.075,false); M.blade={kind:'sword',pivot:F,pts:o}; }
  { const o=[], F=sword(o,S(0.66,-1.12,0.47),S(0.38,-0.34,0.9),0.12,0.24,0.011,0.04,false); M.dash={kind:'sword',thrust:true,pivot:F,pts:o}; }
  { const o=[], P0=S(0.48,-1.22,0.45), T=S(0.32,-0.28,0.95); fist(o,L3(P0,T,0.06),0.06); const F=sword(o,P0,T,0.15,0.25,0.05,0.12,true); M.gsword={kind:'sword',two:true,pivot:F,pts:o}; }
  // bows: upright, a little left of the middle; the limbs bend away from you, the string toward you; the left fist on the grip
  const bow=(tall)=>{ const o=[], g=S(-0.3,-0.6,0.72), top=S(-0.35,tall?0.15:0.0,0.6), bot=S(-0.34,-1.9,0.62);
    curve(o,g,S(-0.3,tall?-0.2:-0.28,0.78),top,'wood',0.032); curve(o,g,S(-0.3,-1.2,0.79),bot,'wood',0.032); fist(o,[g[0]+0.004,g[1],g[2]-0.01],-0.05);
    return {kind:'bow',two:true,pivot:g,top,bot,grip:g,rest:S(-0.31,-0.6,0.6),draw:S(0.12,-0.8,0.46),pts:o}; };
  M.bolt=bow(false); M.rain=bow(true);
  // the crossbow (one hand): level, low and to the right, a glowing bolt along its top
  { const o=[]; fist(o,S(0.56,-1.05,0.5)); stroke(o,S(0.6,-1.25,0.44),S(0.36,-0.68,0.85),'wood',0.034);
    curve(o,S(0.14,-0.68,0.8),S(0.36,-0.6,0.84),S(0.6,-0.72,0.78),'metal',0.03,'=');
    stroke(o,S(0.14,-0.69,0.79),S(0.38,-0.75,0.64),'string',0.022); stroke(o,S(0.6,-0.73,0.78),S(0.38,-0.75,0.64),'string',0.022);
    stroke(o,S(0.385,-0.7,0.64),S(0.355,-0.62,0.9),'glow',0.028); o.push([...S(0.352,-0.61,0.91),'>','glow',0.034]); M.rapid={kind:'xbow',pivot:S(0.48,-0.85,0.6),pts:o}; }
  // staffs: only the upper shaft and the head come into view; the hands hold it below
  const staff=(head)=>{ const o=[], h=S(0.42,-0.42,0.86); stroke(o,S(0.6,-1.25,0.56),[h[0],h[1]-0.07,h[2]],'wood',0.034);
    if(head==='orb'){ ring(o,h,0.075,0,Math.PI*2,9,'head',0.034,'o'); o.push([...h,'*','glow',0.05*K]); }
    else if(head==='beam'){ const P=[[0,0.15],[0.066,0],[0,-0.09],[-0.066,0]]; for(let i=0;i<4;i++){ const A=P[i], B=P[(i+1)%4]; stroke(o,[h[0]+A[0],h[1]+A[1],h[2]],[h[0]+B[0],h[1]+B[1],h[2]],'head',0.028); } o.push([h[0],h[1]+0.018,h[2],'*','glow',0.05*K]); }
    else { for(let i=0;i<5;i++){ const a=Math.PI/2+i*Math.PI*2/5; stroke(o,h,[h[0]+Math.cos(a)*0.105,h[1]+Math.sin(a)*0.105,h[2]],'head',0.026); } o.push([...h,'*','glow',0.05*K]); }
    return {kind:'staff',pivot:S(0.52,-0.85,0.6),head:h,orbit:head==='star',pts:o}; };
  M.orb=staff('orb'); M.beam=staff('beam'); M.star=staff('star');
  { const o=[], h=S(0.36,-0.25,0.92); stroke(o,S(0.5,-1.5,0.5),[h[0]-0.01,h[1]-0.1,h[2]],'wood',0.036);
    ring(o,h,0.15,1.15,5.13,11,'head',0.05,'('); ring(o,[h[0]-0.03,h[1],h[2]],0.11,1.5,4.78,7,'glow',0.034,'('); M.mstaff={kind:'staff',two:true,pivot:S(0.44,-0.8,0.6),head:h,pts:o}; }
  // bare hands: an open hand of a few large glyphs, fingers up
  { const o=[], c=S(0.62,-0.92,0.55); for(const [x,y] of [[-0.035,0],[0.02,0],[0.065,-0.006],[-0.015,-0.05],[0.04,-0.05]])o.push([c[0]+x,c[1]+y,c[2],'@','hand',0.04*K]);
    for(let i=0;i<4;i++)stroke(o,[c[0]-0.05+i*0.04,c[1]+0.06,c[2]],[c[0]-0.07+i*0.05,c[1]+0.19-Math.abs(i-1.5)*0.025,c[2]+0.012],'knuckle',0.028,'|');
    stroke(o,[c[0]-0.07,c[1]-0.008,c[2]],[c[0]-0.15,c[1]+0.065,c[2]+0.01],'knuckle',0.028); stroke(o,[c[0]+0.02,c[1]-0.05,c[2]-0.01],[c[0]+0.09,c[1]-0.42,c[2]-0.12],'arm',0.05,'%',1.1);
    M.bare={kind:'bare',pivot:c,pts:o}; }
  return M; })();
const VM_PART={fill:[0.46,0.48,0.56],edge:[0.86,0.89,0.96],metal:[0.7,0.72,0.8],wood:[0.42,0.3,0.19],woodedge:[0.66,0.49,0.32],hand:[0.5,0.35,0.25],knuckle:[0.66,0.48,0.34],arm:[0.3,0.22,0.18],head:[0.95,0.9,0.75],glow:[1,0.95,0.82],string:[0.7,0.66,0.58]};
const VM_BRIGHT={fill:0.8,edge:1.1,metal:0.95,wood:0.78,woodedge:1.0,hand:0.75,knuckle:0.9,arm:0.45,head:1.25,glow:1.3,string:0.6};
const VM_TINT={edge:0.7,head:0.85,glow:0.85,fill:0.25};
const vmKick={L:-9,R:-9};
function drawViewWeapons(t){ if(ui.camMode==='tps'||!ui.started||adv.dead||!gear.hands||!here.D)return; if(ui.gallery&&ui.gallery.mode==='beast')return;
  const [f,r,u]=handUp(), [ex,ey,ez]=aimOrigin(); let dw=0.62;
  for(const side of [-0.3,0,0.3])for(let st=0.05;st<=0.62;st+=0.04){ const x=ex+f[0]*st+r[0]*side, z=ez+f[2]*st+r[2]*side, ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL); if(ci<0||ci>=NCELL||here.D.tile[ci]===TW||here.D.tile[ci]===TX||doorBlock(ci)){ dw=Math.min(dw,st-0.07); break; } }
  const q=clamp(dw/0.62,0.3,1), spd=Math.hypot(player.vx||0,player.vz||0), bob=Math.sin(clock.time*9)*0.007*Math.min(1,spd/4), sway=Math.cos(clock.time*4.5)*0.004*Math.min(1,spd/4), two=isTwo();
  const kx=Math.min(1,(camera.aspect||1.78)/(16/9)), W=(x,y,z)=>{ x*=kx; return [ex+(f[0]*z+r[0]*x+u[0]*y)*q,ey+(f[1]*z+u[1]*y)*q,ez+(f[2]*z+r[2]*x+u[2]*y)*q]; };
  const one=(h,type,mirror)=>{ const M=VM_MODELS[type]||VM_MODELS.bare; const H=gear.hands[h], el=H.elem?H.elem.type:null, ec=elemCol(el);
    const chant=gear.castSt&&(gear.castSt.h===h||two)?Math.min(1,gear.castSt.t/Math.max(0.01,gear.castSt.need)):0, hold=gear.castSt&&(gear.castSt.h===h||two)&&gear.castSt.full?Math.min(1,gear.castSt.hold/2):0;
    const swingP=player.swing>0&&(player.swingH===h||two)?1-player.swing/0.22:-1, kick=Math.max(0,1-(clock.time-(vmKick[h]||-9))/0.16);
    let th=0, dx=sway, dy=bob, dz=0, glow=1;
    if(M.kind==='sword'){ if(swingP>=0){ th=M.thrust?0.15-0.3*swingP:0.9-2.2*swingP; dz=Math.sin(swingP*Math.PI)*(M.thrust?0.2:0.08); dy+=Math.sin(swingP*Math.PI)*0.04; }
      if(two&&gear.castSt&&gear.castSt.h==='R'){ th=0.55*chant; dy+=0.06*chant; } dz+=kick*0.04; }
    else if(M.kind==='bow'){ dz-=kick*0.03; }
    else if(M.kind==='xbow'){ dx-=0.05*chant; dy+=0.03*chant; dz-=kick*0.04; }
    else if(M.kind==='staff'){ dy+=0.05*chant+0.03*hold; dz+=kick*0.04; glow=1+2*chant+kick+1.5*hold; }
    else { dy+=0.04*chant; dz+=0.05*chant+kick*0.04; glow=1+chant; }
    const pv=M.pivot, cs=Math.cos(th), sn=Math.sin(th);
    const put=(x,y,z,g,part,sz,bri)=>{ let lx=x-pv[0], ly=y-pv[1]; const rx=lx*cs-ly*sn+pv[0], ry=lx*sn+ly*cs+pv[1]; let X=rx+dx, Y=ry+dy, Z=z+dz; if(mirror){ X=-X; g=VM_MIRROR[g]||g; }
      const base=VM_PART[part]||[0.8,0.8,0.8], tk=el?(VM_TINT[part]||0):0, bb=(VM_BRIGHT[part]||1)*(bri||1)*((part==='head'||part==='glow')?glow:1)*(part==='edge'&&swingP>=0?1.7:1);
      const p=W(X,Y,Z); dyn(p[0],p[1],p[2],G(g),sz*q,(base[0]*(1-tk)+ec[0]*tk)*bb,(base[1]*(1-tk)+ec[1]*tk)*bb,(base[2]*(1-tk)+ec[2]*tk)*bb); return p; };
    for(const p of M.pts)put(p[0],p[1],p[2],p[3],p[4],p[5]);
    if(M.kind==='bow'){ const pull=chant, mid=[M.rest[0]+(M.draw[0]-M.rest[0])*pull,M.rest[1]+(M.draw[1]-M.rest[1])*pull,M.rest[2]+(M.draw[2]-M.rest[2])*pull];
      for(const end of [M.top,M.bot]){ const n=Math.max(5,Math.round(Math.hypot(end[0]-mid[0],end[1]-mid[1],end[2]-mid[2])/0.05)); for(let i=1;i<n;i++){ const k=i/n; put(end[0]+(mid[0]-end[0])*k,end[1]+(mid[1]-end[1])*k,end[2]+(mid[2]-end[2])*k,vmGlyphS(end,mid),'string',0.035); } }
      if(pull>0.05){ const o=[]; VM_FIST(o,mid); for(const p of o)put(p[0],p[1],p[2],p[3],p[4],p[5],0.9);
        const TV=Math.tan(37*Math.PI/180), tz=1.0, tip=[-0.06*TV*(16/9)*tz,-0.08*TV*tz,tz], n=Math.round(Math.hypot(tip[0]-mid[0],tip[1]-mid[1],tip[2]-mid[2])/0.05); for(let i=1;i<=n;i++){ const k=i/n; put(mid[0]+(tip[0]-mid[0])*k,mid[1]+(tip[1]-mid[1])*k,mid[2]+(tip[2]-mid[2])*k,i===n?'^':vmGlyphS(mid,tip),'glow',0.05,0.8); } } }
    if(M.orbit)for(let i=0;i<3;i++){ const a=t*2.5+i*2.09; put(M.head[0]+Math.cos(a)*0.07,M.head[1]+Math.sin(a)*0.07,M.head[2],'+','glow',VM_ST*1.4); }
    if(el&&mr()<0.08*(1+chant*3)){ const hp=M.head||(M.kind==='sword'?[0.2,0.0,0.86]:[0.15,-0.19,0.88]); const p=W((mirror?-1:1)*(hp[0]+dx),hp[1]+dy,hp[2]+dz), g2=el==='fire'?'^':el==='ice'?'*':el==='thunder'?'/':'%';
      spawn(p[0],p[1],p[2],(mr()-0.5)*0.15,0.15+mr()*0.2,(mr()-0.5)*0.15,0.35,G(g2),0.03*q,ec[0]*2.2,ec[1]*2.2,ec[2]*2.2,0); } };
  if(two){ const w=gear.hands.R.atk; if(w)one('R',w.type,false); return; }
  for(const h of ['L','R']){ const w=gear.hands[h].atk; one(h,w?w.type:'bare',h==='L'); } }
// a fist built on demand (the hand that draws the bowstring)
function VM_FIST(o,c){ const K=VM_K, P=[[-0.05,0.024,'@'],[0,0.032,'@'],[0.05,0.024,'@'],[-0.04,-0.027,'%'],[0.01,-0.03,'%'],[0.057,-0.02,'%']]; for(const [x,y,g] of P)o.push([c[0]+x,c[1]+y,c[2],g,g==='@'?'knuckle':'hand',0.038*K]);
  for(let i=1;i<=4;i++)o.push([c[0]+0.03+i*0.02,c[1]-0.06-i*0.09,c[2]-0.01-i*0.025,'%','arm',0.05*K]); }
function drawSwing(){
  if(!(player.swing>0)||player.swingWave)return; const k=1-player.swing/0.22, [fx,fy,fz]=viewDir(), rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw);
  // up vector of the view = right x forward (flipped to point upward)
  let ux=-rz*fy, uy=rz*fx-rx*fz, uz=rx*fy; if(uy<0){ ux=-ux; uy=-uy; uz=-uz; } const ul=Math.hypot(ux,uy,uz)||1; ux/=ul; uy/=ul; uz/=ul;
  const [cx0,cy0,cz0]=aimOrigin();
  for(let q=0;q<7;q++){ const a=(q/6-0.5)*1.6+(k-0.5)*1.2, u=Math.sin(a)*0.75, v=Math.cos(a)*0.35-0.2;
    dyn(cx0+fx*0.9+rx*u+ux*v,cy0+fy*0.9+uy*v,cz0+fz*0.9+rz*u+uz*v,G(q%2?'/':'-'),0.16,(player.swingCol||[0.8,0.75,0.65])[0]*2*(1-k*0.6),(player.swingCol||[0.8,0.75,0.65])[1]*2*(1-k*0.6),(player.swingCol||[0.8,0.75,0.65])[2]*2*(1-k*0.6)); }
}

// ---------------------------------------------------------------- runes (stage B): attacks and elements held in each hand, random modifiers, chanting, reactions
// RUNE_DEF は src/lib/runes.ts（src/game/imports.mjs で読む）
// ルーンの名前・色・付けられるか（runeName・canPut など）は src/lib/runes.ts、手と持ち物の処理（makeRune・effHand・isTwo など）は src/lib/gear.ts
// what a trait does at its level: its first or third step, and the fifth when reached
const trDesc=(w,t)=>{ const T=TRAITS[w]&&TRAITS[w][t.k]; return T?T.d(t.lv):''; };
// RUNE_TYPES は src/lib/runes.ts（src/game/imports.mjs で読む）
// what each kind of creature tends to drop, and how much each element hurts it (0 = no effect, 2 = badly)
const ELEM_OF={l:'fire',Zf:'fire',D:'fire',Zi:'ice',L:'ice',K:'ice',Zl:'thunder',Rc:'thunder',Re:'thunder',Rw:'thunder',S:'poison',n:'poison',N:'poison',B:'poison'};
// RES は src/lib/runes.ts（src/game/imports.mjs で読む）
let packSnap=null, packSel=null;
try{ saved.BOOK=new Set(JSON.parse(localStorage.getItem('al_book')||'[]')); }catch(e){}
// ルーンの種類を選ぶ randomRuneType は src/lib/gear.ts（src/game/imports.mjs で読む）
// cut html to a visible width (text beyond it is dropped), so a long line never widens a fixed box
function clipHtml(html,w){ if(visW(html)<=w)return html; const box=document.createElement('span'); box.innerHTML=html; let left=w; const walk=n=>{ for(const c of [...n.childNodes]){ if(left<=0){ n.removeChild(c); continue; } if(c.nodeType===3){ let out=''; for(const ch of c.textContent){ const cw=visW(ch); if(cw>left){ left=0; break; } out+=ch; left-=cw; } c.textContent=out; } else walk(c); } }; walk(box); return box.innerHTML; }
// called only when a run starts, after the page has loaded (saved.RSEEN is filled from al_runes in 25-gallery.js; before that it is an empty placeholder)
function resetRunes(){ fight.trigCd={L:0,R:0}; fight.hitSrcPoint=null;
  gear.hands={L:newHand('blade'), R:newHand('orb'), B:{b0:null,b1:null}};
  gear.bag=[]; gear.builds=[null,null,null]; gear.buildIdx=-1; gear.castSt=null; gear.swapSt=null; packSel=null; fight.beamSegs=[]; fight.clouds=[];
  adv.runState={startChosen:false,altar1:false,taken:new Set(),lordsDone:new Set(),bodyOpen:0}; saved.LEGEND=null; finalSt=null; adv.won=false; renderHotbar();
  try{ if(!saved.RSEEN.has('blade')||!saved.RSEEN.has('bolt')){ saved.RSEEN.add('blade'); saved.RSEEN.add('bolt'); saveSet('al_runes',saved.RSEEN); } }catch(e){}
}
function specOf(h){ const H=effHand(h); syncHand(H); if(H.two){ gear.hands.L.elem=gear.hands.R.elem=H.elem; gear.hands.L.trig=gear.hands.R.trig=H.trig; } const aff={};
  for(const ru of handRunes(H)){ const d=RUNE_DEF[ru.type]; if(d.cat==='mod'&&modWorks(d.mk,H))aff[d.mk]=(aff[d.mk]||0)+modVal(ru); }
  const el=H.elem?H.elem.type:null;
  const tr={}, el0=H.elem?H.elem.type:null; for(const t of trList(H.atk))tr[t.k]=t.lv;
  if(el0==='thunder'&&BL('branch'))aff.chain=(aff.chain||0)+BL('branch');
  if(tr.count)aff.count=(aff.count||0)+TRAIT_V.count[tr.count]; if(tr.bounce)aff.bounce=(aff.bounce||0)+TRAIT_V.bounce[tr.bounce]; if(tr.homing)aff.homing=(aff.homing||0)+TRAIT_V.homing[tr.homing]; if(tr.accuracy)aff.homing=(aff.homing||0)+tr.accuracy*4;
  return {h,atk:atkType(h),elem:el,aff,tr,pow:el?(ELEM_POW[Math.min(4,elemCount(H,el))]||1):1}; }

