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
function drawViewWeapons(t){ if(camMode==='tps'||!started||dead||!hands||!D)return; if(gallery&&gallery.mode==='beast')return;
  const [f,r,u]=handUp(), [ex,ey,ez]=aimOrigin(); let dw=0.62;
  for(const side of [-0.3,0,0.3])for(let st=0.05;st<=0.62;st+=0.04){ const x=ex+f[0]*st+r[0]*side, z=ez+f[2]*st+r[2]*side, ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL); if(ci<0||ci>=NCELL||D.tile[ci]===TW||D.tile[ci]===TX||doorBlock(ci)){ dw=Math.min(dw,st-0.07); break; } }
  const q=clamp(dw/0.62,0.3,1), spd=Math.hypot(player.vx||0,player.vz||0), bob=Math.sin(time*9)*0.007*Math.min(1,spd/4), sway=Math.cos(time*4.5)*0.004*Math.min(1,spd/4), two=isTwo();
  const kx=Math.min(1,(camera.aspect||1.78)/(16/9)), W=(x,y,z)=>{ x*=kx; return [ex+(f[0]*z+r[0]*x+u[0]*y)*q,ey+(f[1]*z+u[1]*y)*q,ez+(f[2]*z+r[2]*x+u[2]*y)*q]; };
  const one=(h,type,mirror)=>{ const M=VM_MODELS[type]||VM_MODELS.bare; const H=hands[h], el=H.elem?H.elem.type:null, ec=elemCol(el);
    const chant=castSt&&(castSt.h===h||two)?Math.min(1,castSt.t/Math.max(0.01,castSt.need)):0, hold=castSt&&(castSt.h===h||two)&&castSt.full?Math.min(1,castSt.hold/2):0;
    const swingP=player.swing>0&&(player.swingH===h||two)?1-player.swing/0.22:-1, kick=Math.max(0,1-(time-(vmKick[h]||-9))/0.16);
    let th=0, dx=sway, dy=bob, dz=0, glow=1;
    if(M.kind==='sword'){ if(swingP>=0){ th=M.thrust?0.15-0.3*swingP:0.9-2.2*swingP; dz=Math.sin(swingP*Math.PI)*(M.thrust?0.2:0.08); dy+=Math.sin(swingP*Math.PI)*0.04; }
      if(two&&castSt&&castSt.h==='R'){ th=0.55*chant; dy+=0.06*chant; } dz+=kick*0.04; }
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
  if(two){ const w=hands.R.atk; if(w)one('R',w.type,false); return; }
  for(const h of ['L','R']){ const w=hands[h].atk; one(h,w?w.type:'bare',h==='L'); } }
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
const RUNE_DEF={
  blade:  {cat:'atk', ch:')', name:'小剣',     wk:'剣', chant:0,   dmg:[4,6], rec:0.42, aff:['count'],                desc:'目の前を薙ぐ。詠唱はいらない'},
  bolt:   {cat:'atk', ch:'}', name:'短弓',     wk:'弓', two:true, L:'bolt', R:'bpower', chant:0.4, dmg:[3,5], rec:0.12, aff:['count','bounce','homing'], desc:'両手で持つ。左：素早く射る　右：引き絞って、強く貫く一矢'},
  orb:    {cat:'atk', ch:'/', name:'樫の杖',   wk:'杖', chant:0.8, dmg:[5,8], rec:0.15, aff:['count','bounce','homing'], desc:'光の弾を放つ。弧を描いて飛び、落ちた所で弾ける'},
  beam:   {cat:'atk', ch:'/', name:'水晶の杖', wk:'杖', chant:0.3, dmg:[1,2], rec:0.25, aff:['count','bounce'],          desc:'押している間、光の帯で照らし続ける'},
  dash:   {cat:'atk', ch:')', name:'風走りの細剣', wk:'剣', chant:0,   dmg:[4,6], rec:0.55, aff:[],                     desc:'斬りながら、前へ駆け抜ける。通り抜けた敵を斬る'},
  rain:   {cat:'atk', ch:'}', name:'雨降らしの長弓', wk:'弓', two:true, L:'rshot', R:'rain', chant:0.9, dmg:[2,3], rec:0.3, aff:['count','bounce','homing'], desc:'両手で持つ。左：遠くへ一矢を射る　右：狙った所に、壁を越えて矢の雨を降らせる'},
  bpower: {cat:'sub', name:'強弓', chant:0.8, dmg:[6,9], rec:0.4, aff:['count','bounce','homing']},
  rshot:  {cat:'sub', name:'遠矢', chant:0.5, dmg:[4,6], rec:0.3, aff:['count','bounce','homing']},
  rapid:  {cat:'atk', ch:'}', name:'早撃ちの連弩', wk:'弓', chant:0.3, dmg:[2,3], rec:0.35, aff:['count','bounce','homing'], desc:'矢を、素早く3本続けて撃つ'},
  star:   {cat:'atk', ch:'/', name:'星降りの杖', wk:'杖', chant:0.7, dmg:[6,9], rec:0.25, aff:['count'],               desc:'狙った所に、少し遅れて光の柱が降る'},
  gsword: {cat:'atk', ch:')', name:'遠鳴りの両手剣', wk:'剣', two:true, L:'gsweep', R:'gwave', chant:0, dmg:[7,10], rec:0.8, aff:['count'], desc:'両手で持つ。左：大きく薙ぐ　右：溜めて、加速する大きな風の刃を飛ばす'},
  mstaff: {cat:'atk', ch:'/', name:'満ち月の長杖', wk:'杖', two:true, L:'mshot', R:'mmoon', chant:0.3, dmg:[3,4], rec:0.25, aff:['count','bounce','homing'], desc:'両手で持つ。左：光の弾を撃つ　右：溜めるほど大きな光の月を放つ'},
  gsweep: {cat:'sub', name:'薙ぎ', chant:0, dmg:[7,10], rec:0.8, reach:2.7, arc:0.75, aff:['count']},
  gwave:  {cat:'sub', name:'遠鳴りの刃', chant:1.0, dmg:[8,12], rec:0.6, aff:['count']},
  mshot:  {cat:'sub', name:'光の弾', chant:0.3, dmg:[3,4], rec:0.25, aff:['count','bounce','homing']},
  mmoon:  {cat:'sub', name:'光の月', chant:0.8, dmg:[6,9], rec:0.5, aff:['count']},
  fire:   {cat:'elem',ch:'ᚲ', name:'火', pre:'炎の', col:[1.0,0.5,0.16],  aff:['chain','area','dur'], desc:'燃え移り、草や干し草にも火をつける'},
  ice:    {cat:'elem',ch:'ᛁ', name:'氷', pre:'氷の', col:[0.55,0.86,1.0], aff:['chain','area','dur'], desc:'凍えさせ、動きを鈍らせる'},
  thunder:{cat:'elem',ch:'ᛊ', name:'雷', pre:'雷の', col:[1.0,0.92,0.45], aff:['chain','area','dur'], desc:'痺れさせ、近くの敵へ跳ぶ。水の中の敵によく通る'},
  poison: {cat:'elem',ch:'ᚾ', name:'毒', pre:'毒の', col:[0.45,1.0,0.35], aff:['chain','area','dur'], desc:'じわじわと蝕む'},
  dodge:  {cat:'trig',ch:'ᚱ', name:'攻撃をかわした時', short:'かわした時', aff:[], desc:'敵の攻撃を転がってかわした瞬間、この手の攻撃が、かわした相手へひとりでに放たれる'},
  kill:   {cat:'trig',ch:'ᚺ', name:'敵を倒した時', short:'倒した時', aff:[], desc:'敵を倒した時、この手の攻撃が近くの敵へひとりでに放たれる'},
  swift:   {cat:'body',ch:'"', col:[1.0,0.86,0.62], name:'疾風の護符', aff:[], desc:'走る速さが 15% 上がる'},
  roll:    {cat:'body',ch:'"', col:[1.0,0.86,0.62], name:'身軽の護符', aff:[], desc:'転がってかわす距離が 35% 伸びる'},
  quick:   {cat:'body',ch:'"', col:[1.0,0.86,0.62], name:'早口の護符', aff:[], desc:'詠唱の時間が 30% 短くなる'},
  lamp:    {cat:'body',ch:'"', col:[1.0,0.86,0.62], name:'灯火の護符', aff:[], desc:'灯りの届く距離が 35% 伸びる'},
  mend:    {cat:'body',ch:'"', col:[1.0,0.86,0.62], name:'癒しの護符', aff:[], desc:'取り戻せる傷が長く残り、攻めて取り戻す量も増える'},
  linger:  {cat:'body',ch:'"', col:[1.0,0.86,0.62], name:'余韻の護符', aff:[], desc:'燃焼・凍え・痺れ・毒が 50% 長く続く'},
  hush:    {cat:'body',ch:'"', col:[1.0,0.86,0.62], name:'忍び足の護符', aff:[], desc:'足音が静かになり、敵に気づかれる距離が 25% 縮む'},
  slotopt: {cat:'open',ch:'{', col:[1.0,0.9,0.6], name:'枠', aff:[], desc:''},
  forgeopt:{cat:'open',ch:'T', col:[0.7,0.85,1.0], name:'鍛え', aff:[], desc:''},
  m_count: {cat:'mod', sh:'数', nm:'数', unit:'',ch:'ᚷ', col:[0.85,0.8,1.0], name:'数 +1',          mk:'count', val:1,  aff:[], desc:'その手の攻撃の数が 1 増える。短弓なら矢が2本、樫の杖なら弾が2つ、小剣なら2度薙ぐ'},
  m_bounce:{cat:'mod', sh:'跳返', nm:'跳ね返り', unit:'',ch:'ᚢ', col:[0.85,0.8,1.0], name:'跳ね返り +2',     mk:'bounce',val:2,  aff:[], desc:'壁で 2 回多く跳ねる'},
  m_homing:{cat:'mod', sh:'追尾', nm:'ホーミング', unit:'度',ch:'ᛉ', col:[0.85,0.8,1.0], name:'ホーミング +20度', mk:'homing',val:20, aff:[], desc:'飛びながら、敵の方へ曲がる'},
  m_chain: {cat:'mod', sh:'連鎖', nm:'連鎖', unit:'',ch:'ᚹ', col:[0.85,0.8,1.0], name:'連鎖 +1',         mk:'chain', val:1,  aff:[], desc:'性質の連鎖が 1 増える。雷なら、もう1体へ跳ぶ'},
  m_area:  {cat:'mod',ch:'ᛈ', col:[0.85,0.8,1.0], sh:'広がり', nm:'広がり', unit:'%', name:'広がり +30%', mk:'area', val:30, aff:[], desc:'性質の効果が広がる。炎の燃え広がりや、霧の広さなど'},
  m_dur:   {cat:'mod',ch:'ᚠ', col:[0.85,0.8,1.0], sh:'長さ', nm:'長さ', unit:'%', name:'長さ +50%', mk:'dur', val:50, aff:[], desc:'性質の効果が長く続く。燃焼や凍えなど'},
  ward:    {cat:'body',ch:'"', col:[1.0,0.86,0.62], name:'守りの護符', aff:[], desc:'受ける傷が 15% 軽くなる'},
};
// what a trait does at its level: its first or third step, and the fifth when reached
const trDesc=(w,t)=>{ const T=TRAITS[w]&&TRAITS[w][t.k]; return T?T.d(t.lv):''; };
const wTL=(h,k)=>{ const H=effHand(h); for(const t of trList(H.atk))if(t.k===k)return t.lv; return 0; };
// a found weapon may carry 0-2 of its own traits; deeper, treasuries and the strong give higher levels
const WEAPON_SIG=t=>Object.keys(TRAITS[t]||{}).slice(0,2);
function rollTraits(ru,r,d,bonus){ if(!ru||RUNE_DEF[ru.type].cat!=='atk'||!TRAITS[ru.type])return ru; const tier=Math.min(4,clamp(Math.floor(((d||1)-1)/3),0,3)+(bonus||0));
  ru.traits=tier>0?WEAPON_SIG(ru.type).map(k=>({k,lv:tier})):[]; return ru; }
// RUNE_TYPES は src/lib/runes.ts（src/game/imports.mjs で読む）
// AFFIX は src/lib/runes.ts（src/game/imports.mjs で読む）
// what each kind of creature tends to drop, and how much each element hurts it (0 = no effect, 2 = badly)
const ELEM_OF={l:'fire',Zf:'fire',D:'fire',Zi:'ice',L:'ice',K:'ice',Zl:'thunder',Rc:'thunder',Re:'thunder',Rw:'thunder',S:'poison',n:'poison',N:'poison',B:'poison'};
const RES={
  L:{poison:0.2,fire:2}, lord:{poison:0.5},
  Y:{poison:0.2,thunder:2}, Rc:{poison:0.2,thunder:2}, Re:{poison:0.2,thunder:2}, Rw:{poison:0.2,thunder:2},
  l:{fire:0.2,ice:2}, Zf:{fire:0.2,ice:2}, D:{fire:0.2,ice:1.5},
  Zi:{ice:0.2,fire:2}, Zl:{thunder:0.2},
  N:{fire:0.5,thunder:2}, K:{fire:0.5,thunder:2}, f:{thunder:2},
  n:{poison:0.25}, B:{poison:0.2,fire:2}, S:{fire:2}, j:{}, T:{fire:1.5},
};
let runeUid=1, hands=null, bag=[], builds=[null,null], buildIdx=-1, runState={startChosen:false,altar1:false,taken:new Set(),lordsDone:new Set()};
let castSt=null, swapSt=null, packSnap=null, packSel=null, trigCd={L:0,R:0}, beamSegs=[], clouds=[];
let BOOK=new Set(); try{ BOOK=new Set(JSON.parse(localStorage.getItem('al_book')||'[]')); }catch(e){}
function makeRune(type,nAff,r){ r=r||mr; const def=RUNE_DEF[type], pool=def.aff.slice(), aff={}; let n=0;
  while(n-->0){ const k=pool.splice(Math.floor(r()*pool.length),1)[0]; aff[k]=AFFIX[k].roll(r); }
  return {uid:runeUid++,type,aff}; }
function rollAffN(r,bonus){ const x=r()+(bonus||0)+Math.min(0.25,depth*0.015); return x<0.55?0:x<0.82?1:x<0.96?2:3; }
function randomRuneType(r,weights){ const w=weights||{elem:0.45,trig:0.12,mod:0.33,body:0.1}; let x=r(); for(const c of ['atk','elem','trig','mod','body']){ if(!w[c])continue; if(x<w[c]){ const a=(c==='atk'?weaponPool():RUNE_TYPES[c].filter(t=>!lockedOf('rune',t))); return a[Math.floor(r()*a.length)]||'fire'; } x-=w[c]; } return 'fire'; }
const runeTier=ru=>Object.keys(ru.aff).length;
const runeCol=ru=>{ const d=RUNE_DEF[ru.type]; if(ru.strong)return TIER_COL[3]; return d.col||TIER_COL[runeTier(ru)]; };
// a change rune is named by its value; a strong one doubles it
const modVal=ru=>RUNE_DEF[ru.type].val*(ru.strong?2:1);
const runeName=ru=>{ const d=RUNE_DEF[ru.type]; return d.cat==='mod'?`${d.nm} +${modVal(ru)}${d.unit}`:d.name; };
// what to call a thing when it is taken: a weapon or a charm by its name, a rune as a rune
const thingLabel=ru=>{ const d=RUNE_DEF[ru.type]; return d.cat==='atk'||d.cat==='body'?d.name:runeName(ru)+'のルーン'; };
const runeShort=ru=>{ const d=RUNE_DEF[ru.type]; return d.cat==='mod'?`${d.sh} +${modVal(ru)}${d.unit==='%'?'%':''}`:(d.short||d.name); };
// cut html to a visible width (text beyond it is dropped), so a long line never widens a fixed box
function clipHtml(html,w){ if(visW(html)<=w)return html; const box=document.createElement('span'); box.innerHTML=html; let left=w; const walk=n=>{ for(const c of [...n.childNodes]){ if(left<=0){ n.removeChild(c); continue; } if(c.nodeType===3){ let out=''; for(const ch of c.textContent){ const cw=visW(ch); if(cw>left){ left=0; break; } out+=ch; left-=cw; } c.textContent=out; } else walk(c); } }; walk(box); return box.innerHTML; }
function makeStrong(t){ const ru=makeRune(t,0); if(RUNE_DEF[t].cat==='mod')ru.strong=true; return ru; }
const runeLabel=ru=>RUNE_DEF[ru.type].name;
function handName(H){ if(!H.atk)return H.elem?`${RUNE_DEF[H.elem.type].pre}素手`:'素手'; return (H.elem?RUNE_DEF[H.elem.type].pre:'')+RUNE_DEF[H.atk.type].name; }
function resetRunes(){
  hands={L:newHand('blade'), R:newHand('orb'), B:{b0:null,b1:null}};
  bag=[]; builds=[null,null,null]; buildIdx=-1; castSt=null; swapSt=null; packSel=null; beamSegs=[]; clouds=[];
  runState={startChosen:false,altar1:false,taken:new Set(),lordsDone:new Set(),bodyOpen:0}; LEGEND=null; finalSt=null; won=false; renderHotbar();
  try{ if(!RSEEN.has('blade')||!RSEEN.has('bolt')){ RSEEN.add('blade'); RSEEN.add('bolt'); saveSet('al_runes',RSEEN); } }catch(e){}
}
function newHand(w){ return {atk:makeRune(w,0),slots:[null,null],slotN:2,turn:0,elem:null,trig:null}; }
// the element to be cast next (two different elements take turns) and the hand's trigger
function syncHand(H){ const rs=handRunes(H), els=[...new Set(rs.filter(r=>RUNE_DEF[r.type].cat==='elem').map(r=>r.type))]; const et=els.length?els[(H.turn||0)%els.length]:null; H.elem=et?rs.find(r=>r.type===et):null; H.trig=rs.find(r=>RUNE_DEF[r.type].cat==='trig')||null; }
const isTwo=()=>!!(hands&&hands.R&&hands.R.atk&&hands.L.atk===hands.R.atk&&RUNE_DEF[hands.R.atk.type].two);
function effHand(h){ if(!isTwo())return hands[h]; const sl=[...hands.L.slots.slice(0,hands.L.slotN||2),...hands.R.slots.slice(0,hands.R.slotN||2)].slice(0,TWO_SLOTS); return {atk:hands.R.atk,slots:sl,slotN:sl.length,turn:hands.R.turn||0,two:true}; }
const atkType=h=>{ const H=hands[h]; if(!H||!H.atk)return 'bare'; const d=RUNE_DEF[H.atk.type]; return d.two?d[h]:H.atk.type; };
function syncHands(){ if(!hands)return; if(isTwo()){ const v=effHand('R'); syncHand(v); for(const h of ['L','R']){ hands[h].elem=v.elem; hands[h].trig=v.trig; } return; } syncHand(hands.L); syncHand(hands.R); }
function turnElem(h){ if(isTwo()){ hands.R.turn=(hands.R.turn||0)+1; hands.L.turn=hands.R.turn; syncHands(); return; } const H=hands[h]; if(!H)return; H.turn=(H.turn||0)+1; syncHand(H); }
// a hand holds at most two elements, one trigger, and two of the same change
function canPut(H,i,ru){ const d=RUNE_DEF[ru.type]; if(!['elem','trig','mod'].includes(d.cat)||i>=(H.slotN||2))return false;
  const others=(H.slots||[]).slice(0,H.slotN||2).filter((r,j)=>r&&j!==i&&r!==ru);
  if(d.cat==='elem'){ const el=new Set(others.filter(r=>RUNE_DEF[r.type].cat==='elem').map(r=>r.type)); el.add(ru.type); if(el.size>2)return false; }
  if(d.cat==='trig'&&others.some(r=>RUNE_DEF[r.type].cat==='trig'))return false;
  if(d.cat==='mod'&&others.filter(r=>r.type===ru.type).length>=2)return false; return true; }
function canPutAt(h,i,ru){ if(!isTwo())return canPut(hands[h],i,ru); const H=hands[h]; if(i>=(H.slotN||2))return false; const d=RUNE_DEF[ru.type]; if(!['elem','trig','mod'].includes(d.cat))return false;
  const others=[]; for(const k of ['L','R'])hands[k].slots.slice(0,hands[k].slotN||2).forEach((r,j)=>{ if(r&&!(k===h&&j===i)&&r!==ru)others.push(r); });
  if(!H.slots[i]&&others.length>=TWO_SLOTS)return false;
  if(d.cat==='elem'){ const el=new Set(others.filter(r=>RUNE_DEF[r.type].cat==='elem').map(r=>r.type)); el.add(ru.type); if(el.size>2)return false; }
  if(d.cat==='trig'&&others.some(r=>RUNE_DEF[r.type].cat==='trig'))return false;
  if(d.cat==='mod'&&others.filter(r=>r.type===ru.type).length>=2)return false; return true; }
const allRunes=()=>[...new Set([hands.L.atk,...hands.L.slots,hands.R.atk,...hands.R.slots,...(hands.B?[hands.B.b0,hands.B.b1]:[]),...bag].filter(Boolean))];
const handsKey=()=>['L','R'].map(h=>[hands[h].atk,...hands[h].slots].map(r=>r?r.uid:0).join(',')+':'+(hands[h].slotN||2)).join('|')+'|'+(hands.B?[hands.B.b0,hands.B.b1].map(r=>r?r.uid:0).join(','):'');
function snapHands(){ return {L:{...hands.L,slots:hands.L.slots.slice()},R:{...hands.R,slots:hands.R.slots.slice()},B:{...(hands.B||{b0:null,b1:null})},bag:bag.slice()}; }
function restoreHands(sn){ hands.L={...sn.L,slots:sn.L.slots.slice()}; hands.R={...sn.R,slots:sn.R.slots.slice()}; hands.B={...(sn.B||{b0:null,b1:null})}; bag=sn.bag.slice(); syncHands(); }
function specOf(h){ const H=effHand(h); syncHand(H); if(H.two){ hands.L.elem=hands.R.elem=H.elem; hands.L.trig=hands.R.trig=H.trig; } const aff={};
  for(const ru of handRunes(H)){ const d=RUNE_DEF[ru.type]; if(d.cat==='mod'&&modWorks(d.mk,H))aff[d.mk]=(aff[d.mk]||0)+modVal(ru); }
  const el=H.elem?H.elem.type:null;
  const tr={}, el0=H.elem?H.elem.type:null; for(const t of trList(H.atk))tr[t.k]=t.lv;
  if(el0==='thunder'&&BL('branch'))aff.chain=(aff.chain||0)+BL('branch');
  if(tr.count)aff.count=(aff.count||0)+TRAIT_V.count[tr.count]; if(tr.bounce)aff.bounce=(aff.bounce||0)+TRAIT_V.bounce[tr.bounce]; if(tr.homing)aff.homing=(aff.homing||0)+TRAIT_V.homing[tr.homing]; if(tr.accuracy)aff.homing=(aff.homing||0)+tr.accuracy*4;
  return {h,atk:atkType(h),elem:el,aff,tr,pow:el?(ELEM_POW[Math.min(4,elemCount(H,el))]||1):1}; }
const elemCol=el=>el?RUNE_DEF[el].col:[0.85,0.8,1.0];
// a change rune works when the weapon (or the hand's element) takes that change
function modWorks(mk,H){ const A=H.atk?RUNE_DEF[H.atk.type]:null; if(A&&A.aff.includes(mk))return true; return handRunes(H).some(r=>RUNE_DEF[r.type].cat==='elem'&&RUNE_DEF[r.type].aff.includes(mk)); }
const modTargets=mk=>{ const w=RUNE_TYPES.atk.filter(t=>RUNE_DEF[t].aff.includes(mk)).map(t=>RUNE_DEF[t].name); return w.length?w.join('・'):'性質のルーン（炎・氷・雷・毒）'; };

