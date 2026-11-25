// ---------------------------------------------------------------- finding runes: drops, the starting pedestals, the first altar, floor runes, steles by the stairs
function dropRune(m){
  if(m.ty.critter||m.ty.peaceful||m.ty.dummy)return;
  const strong=(m.maxHp||0)>=40||(m.isLead&&m.g>=0), lord=m.key==='lord'||m.ty.lord;
  if(m.key==='final')return;
  if(!lord)return;
  let at=m.cz*MW+m.cx; for(const d of [-1,MW,-MW,1,MW+1,-MW-1])if(here.D.tile[at+d]===TF&&!here.D.liquid[at+d]&&!here.D.items.some(o=>o.i===at+d&&!o.taken)){ at+=d; break; }
  placeAltar(at,'lordaltar'+clock.time,{lord:true,born:clock.time});
  for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(m.x,0.6,m.z,Math.cos(a)*1.2,0.6+mr(),Math.sin(a)*1.2,0.8,G('.'),0.12,1.6,1.4,2.2,0); }
}
// ---------------------------------------------------------------- rune altars (predictable rewards): one on the main path of each level, sometimes another off it; three choices made when you come near:
// 祭壇の中身（altarFill）・番人（hostileKeys・nextGroup・addGuards・guardedNow）・鍛え方（forgeOptions）・祭壇を置く（placeAltar）・鍛えの祭壇の深さ（forgeDepthOf）・
// 宝物庫のまわり（vaultArea）・泉を置く（placeSpring）・祭壇の画面の1行（altarLine）は src/lib/altars.ts（src/game/imports.mjs で読む）
function strongestKey(){ const kinds=Object.keys(hostileKeys()).filter(k=>!MTYPES[k].beast&&!MTYPES[k].dragon&&k!=='X'&&k!=='D'); let best=null, bh=-1; for(const k of kinds){ let h=0; try{ h=statOf({ty:MTYPES[k],key:k})[0]; }catch(e){} if(h>bh){ bh=h; best=k; } } return best; }

function mainPathAltars(r,free){ if(here.D.stratum.special||here.D.finalVault)return; const W=MW, N=here.D.tile.length, ok=i=>i>=0&&i<N&&here.D.tile[i]===TF&&here.D.liquid[i]!==LQ_DEEP&&here.D.liquid[i]!==LQ_LAVA;
  const bfs=s=>{ const d=new Int32Array(N).fill(-1); if(s==null||s<0||!ok(s))return d; const q=[s]; d[s]=0; for(let h=0;h<q.length;h++){ const c=q[h]; for(const o of [1,-1,W,-W]){ const j=c+o; if(ok(j)&&d[j]<0){ d[j]=d[c]+1; q.push(j); } } } return d; };
  const dS=bfs(here.D.start), goal=here.D.stairs>=0?here.D.stairs:(here.D.bstairs?here.D.bstairs.cell:-1), dT=bfs(goal), L=goal>=0&&dS[goal]>0?dS[goal]:0;
  const rooms=here.D.rooms.map((ro,ri)=>({ro,ri})).filter(o=>o.ri>0&&o.ro.cells.length>10&&!(o.ro.kindMsg&&o.ro.kindMsg.includes('鉄格子の奥')));
  const score=(ro)=>{ let best=1e9, mid=1e9; for(const c of ro.cells){ if(dS[c]<0||dT[c]<0)continue; const det=dS[c]+dT[c]-L; if(det<best){ best=det; mid=Math.abs(dS[c]-L/2); } } return {det:best,mid}; };
  const scored=rooms.map(o=>({...o,...score(o.ro)})).filter(o=>o.det<1e8);
  let hubDistRef=null; const pickCell=ro=>{ const c=ro.cells.filter(free); if(!c.length)return undefined; if(hubDistRef){ const nearC=c.filter(x=>hubDistRef[x]<=9); if(nearC.length)return nearC[Math.floor(nearC.length/2)]; } return c[Math.floor(c.length/2)]; };
  here.D.dS=dS; here.D.pathL=L;
  // the crossroads: the largest room near the middle of the main path (ordinary levels and other realms; not the first level, special levels or branches)
  let hub=null; if(L>0&&!here.branch&&(here.depth>=2||here.realm)&&!here.D.stratum.special){ for(const o of scored){ if(o.det>4)continue; let pos=0, n=0; for(const c of o.ro.cells)if(dS[c]>=0){ pos+=dS[c]; n++; } pos=n?pos/n/L:0; if(pos<0.25||pos>0.75)continue; if(!hub||o.ro.cells.length>hub.ro.cells.length)hub=o; } }
  if(hub){ const cx=hub.ro.cells.reduce((a,c)=>a+c%W,0)/hub.ro.cells.length, cz=hub.ro.cells.reduce((a,c)=>a+((c/W)|0),0)/hub.ro.cells.length; here.D.hub={ri:hub.ri,cx,cz}; }
  let hubDist=null; if(here.D.hub){ hubDist=new Float32Array(N).fill(1e9); const hc=here.D.rooms[here.D.hub.ri].cells, q=hc.slice(); for(const c of hc)hubDist[c]=0; for(let h=0;h<q.length;h++){ const c=q[h]; if(hubDist[c]>=10)continue; for(const o of [1,-1,W,-W]){ const j=c+o; if(j<0||j>=N||hubDist[j]<=hubDist[c]+1)continue; hubDist[j]=hubDist[c]+1; q.push(j); } } }
  hubDistRef=hubDist; const nearHub=o=>{ if(!here.D.hub)return true; for(const c of o.ro.cells)if(hubDist[c]<=10)return true; return false; };
  const sx=here.D.hub?here.D.hub.cx:here.D.start%W, sz=here.D.hub?here.D.hub.cz:(here.D.start/W)|0, angOf=ro=>Math.atan2(ro.cells.reduce((a,c)=>a+((c/W)|0),0)/ro.cells.length-sz,ro.cells.reduce((a,c)=>a+c%W,0)/ro.cells.length-sx);
  const placedA=[]; if(goal>=0)placedA.push(Math.atan2(((goal/W)|0)-sz,goal%W-sx));
  const adiff=(a,b)=>{ let d=Math.abs(a-b)%(Math.PI*2); return d>Math.PI?Math.PI*2-d:d; };
  const spreadPick=list=>{ if(!list.length)return null; const ok=list.filter(o=>placedA.every(a=>adiff(angOf(o.ro),a)>=Math.PI/3)); if(ok.length)return ok[Math.floor(r()*ok.length)];
    return list.slice().sort((p,q)=>Math.min(...placedA.map(a=>adiff(angOf(q.ro),a)),9)-Math.min(...placedA.map(a=>adiff(angOf(p.ro),a)),9))[0]; };
  const main=L>0?scored.filter(o=>o.det<=Math.max(6,L*0.15)).sort((a,b)=>a.mid-b.mid)[0]:scored[Math.floor(r()*scored.length)];
  let mainAt=main?pickCell(main.ro):undefined;
  if(mainAt===undefined&&L>0){ let best=-1, bs=1e9; for(let c=0;c<N;c++){ if(dS[c]<0||dT[c]<0||!free(c))continue; const det=dS[c]+dT[c]-L; if(det>3)continue; const sc=Math.abs(dS[c]-L/2)+det*2; if(sc<bs&&dS[c]>4&&dT[c]>4){ bs=sc; best=c; } } if(best>=0)mainAt=best; }
  if(mainAt!==undefined)placeAltar(mainAt,'altar'+levelSeed()+'m',{guardG:main&&r()<0.6?addGuards(mainAt,r):undefined});

  const sidePool=o=>o!==main&&o!==hub&&(here.D.hub?nearHub(o)&&o.det>=4:o.det>=12);
  const side=r()<0.2?spreadPick(scored.filter(o=>sidePool(o))):null; if(side)placedA.push(angOf(side.ro));
  if(side){ const at=pickCell(side.ro); if(at!==undefined)placeAltar(at,'altar'+levelSeed()+'s',{guardG:addGuards(at,r)}); }
  // the strong one's room: off the main path, one strong creature guarding a rare rune
  const er=spreadPick(scored.filter(o=>o!==side&&o.ro.cells.length>12&&(here.D.hub?sidePool(o):o.det>=5&&o!==main))), key=strongestKey(); if(er)placedA.push(angOf(er.ro));
  const roll=r(); here.D.eliteWhy={rooms:scored.length,far:scored.filter(o=>o.det>=5).length,er:!!er,key,roll:+roll.toFixed(2)};
  if(er&&key&&roll<0.35){ const cells=er.ro.cells.filter(free); if(cells.length>3){ const at=cells[Math.floor(cells.length/2)], g=nextGroup(), sc=cells.filter(c=>c!==at&&Math.hypot((c%MW)-(at%MW),((c/MW)|0)-((at/MW)|0))>=1.5)[0];
    if(sc!==undefined){ here.D.spawns.push({key,cx:sc%MW,cz:(sc/MW)|0,g,lead:true,home:er.ri,elite:true}); { const wp=weaponPool(); here.D.items.push({i:at,kind:'rune',rune:rollTraits(makeRune(wp[Math.floor(r()*wp.length)]),here.depth,1),taken:false,elitePrize:true,guardG:g}); } } } }
  placeSpring(r,free,here.D.hub?scored.filter(o=>sidePool(o)):scored,spreadPick);
  if(saved.META.grave&&!here.branch&&!here.realm&&!here.inter&&!gallery&&saved.META.grave.depth===here.depth&&!(here.D.items||[]).some(o=>o.kind==='grave')){ const pool=scored.filter(o=>sidePool(o)), ro=(pool[pool.length-1]||scored[scored.length-1]||{}).ro; if(ro){ const c=ro.cells.filter(free); if(c.length)here.D.items.push({i:c[Math.floor(c.length/2)],kind:'grave',g:saved.META.grave,rune:graveRune(saved.META.grave.item),taken:false}); } }
  if(!here.branch&&!here.realm&&!here.inter&&forgeDepthOf(here.D.stratum.k)===here.depth){ const ro=here.D.hub?here.D.rooms[here.D.hub.ri]:(scored.find(o=>o.det>=3)||scored[0]||{}).ro; if(ro){ const c=ro.cells.filter(free); if(c.length){ const at=c[Math.floor(c.length*0.3)]; placeAltar(at,'forge'+levelSeed(),{forge:true}); } } }
  // at the crossroads there should be somewhere to choose: at least two side places within reach of its arrows
  if(here.D.hub){ const near=()=>(here.D.items||[]).filter(it=>!it.taken&&(it.kind==='spring'||it.elitePrize||it.vault||(it.altar&&it.slot===1&&/s$/.test(it.grp)))&&hubDist[it.i]<=11).length;
    const used=new Set((here.D.items||[]).map(it=>here.D.roomOf[it.i])); let tries=0;
    const pocket=()=>{ const taken=(here.D.items||[]).map(it=>it.i); const cs=[]; for(let c=0;c<N;c++){ if(!free(c)||!(hubDist[c]<=10)||dS[c]<0||dT[c]<0||dS[c]+dT[c]-L<5)continue; if(taken.some(t=>Math.hypot((t%W)-(c%W),((t/W)|0)-((c/W)|0))<6))continue; cs.push(c); } if(!cs.length)return undefined;
      const ang=c=>Math.atan2(((c/W)|0)-here.D.hub.cz,c%W-here.D.hub.cx), ok=cs.filter(c=>placedA.every(a=>adiff(ang(c),a)>=Math.PI/3)); const pick=(ok.length?ok:cs)[Math.floor(r()*(ok.length?ok:cs).length)]; placedA.push(ang(pick)); return pick; };
    while(near()<2&&tries++<4){ const pool=scored.filter(o=>sidePool(o)&&!used.has(o.ri)&&o.ro.cells.length>6); const o=spreadPick(pool); let at;
      if(o){ used.add(o.ri); placedA.push(angOf(o.ro)); at=pickCell(o.ro); } else at=pocket(); if(at===undefined)continue;
      here.D.items.push({i:at,kind:'spring',taken:false}); }
    here.D.hubNear=near(); }
  // 3: wandering groups near the entrance move on toward the stairs (camps and guards stay put)
  if(L>0){ const groups=new Map(); for(const sp of here.D.spawns){ if(sp.camp||sp.home!==undefined||sp.elite||sp.key==='lord'||sp.key==='final'||sp.g==null||sp.g<0)continue; const ty=MTYPES[sp.key]; if(!ty||ty.habitat||ty.critter||ty.peaceful||ty.boss)continue; if(!groups.has(sp.g))groups.set(sp.g,[]); groups.get(sp.g).push(sp); }
    const late=[]; for(let c=0;c<N;c++)if(dS[c]>L*0.7&&dT[c]>4&&free(c))late.push(c);
    for(const [g,list] of groups){ const c0=list[0].cz*W+list[0].cx; if(!(dS[c0]>=0&&dS[c0]<L*0.3)||r()>=0.5||!late.length)continue; const nc=late[Math.floor(r()*late.length)];
      for(const sp of list){ let best=nc; for(let k=0;k<8;k++){ const c=nc+Math.round((r()-0.5)*4)+Math.round((r()-0.5)*4)*W; if(free(c)&&dS[c]>=0){ best=c; break; } } sp.cx=best%W; sp.cz=(best/W)|0; } } }
  // 4: on some levels a small band waits in the room before the stairs; the stairs stay sealed until it falls
  if(L>0&&here.D.stairs>=0&&!here.D.finalVault&&!here.D.stratum.special&&(here.branch?here.branch.lvl<here.branch.len:here.depth>=2&&here.depth<FINAL_DEPTH)&&!here.realm&&r()<0.3){ const hk=hostileKeys(), kinds=Object.keys(hk); if(kinds.length){ const key=kinds.sort((a,b)=>hk[b]-hk[a])[0], g=nextGroup();
      const cells=[]; for(let c=0;c<N;c++)if(dT[c]>=2&&dT[c]<=5&&free(c))cells.push(c); const n=2+(r()<0.5?1:0);
      if(cells.length>=n){ for(let k=0;k<n;k++){ const c=cells.splice(Math.floor(r()*cells.length),1)[0]; here.D.spawns.push({key,cx:c%W,cz:(c/W)|0,g,lead:k===0}); } here.D.stairGuard=g; } } }
  }
// the treasury's prize: taking it wakes guardians, or brings the ceiling down
let rockfall=null;
function vaultSprung(it){ const ri=here.D.roomOf[it.i], room=ri>=0&&here.D.rooms[ri]&&here.D.rooms[ri].cells.length>6?here.D.rooms[ri]:{cells:vaultArea(it,4)};
  if(it.ev==='guard'){ const pool=here.monsters.filter(m=>!m.dead&&!m.ty.critter&&!m.ty.peaceful&&!m.ty.boss&&m.key!=='lord'&&MTYPES[m.key]); const key=pool.length?pool.sort((a,b)=>(b.maxHp||0)-(a.maxHp||0))[0].key:'O';
    const cells=vaultArea(it,5).filter(c=>{ const [x,z]=cpos(c); return Math.hypot(x-player.x,z-player.z)>2.0; });
    for(let k=0;k<2&&cells.length;k++){ const c=cells.splice(Math.floor(mr()*cells.length),1)[0]; const m=makeMonster({key,cx:c%MW,cz:(c/MW)|0,g:-1,lead:true}); m.sleep=false; m.aware=1; m.noticed=true; m.alert=1; m.guardian=true; here.monsters.push(m);
      for(let q=0;q<24;q++){ const a=mr()*6.28; spawn(m.x,0.2+mr()*1.6,m.z,Math.cos(a)*0.8,mr()*0.8,Math.sin(a)*0.8,0.9,G(mpick(['#','%','.'])),0.14,0.8,0.78,0.85,0); } }
    sRumble(0.4,1.2); msg('<b style="color:#ffb0a0">!</b>石像の目に光が灯った。宝の番人たちが、目を覚ます。'); }
  else if(room.cells.length){ rockfall={t:0,dur:9,cells:room.cells.filter(c=>here.D.tile[c]===TF),rocks:[],next:0.2}; sRumble(0.5,2.0); msg('<b style="color:#ffd0a0">!</b>天井が軋み、崩れ始めた。早く外へ。'); } }
function updateRockfall(dt){ if(!rockfall)return; const R=rockfall; R.t+=dt; R.next-=dt;
  if(R.t<R.dur&&R.next<=0){ R.next=0.28+mr()*0.2; const near=R.cells.filter(c=>{ const [x,z]=cpos(c); return Math.hypot(x-player.x,z-player.z)<4.5; }); const c=(near.length&&mr()<0.7?near:R.cells)[Math.floor(mr()*(near.length&&mr()<0.7?near.length:R.cells.length))]; if(c!==undefined){ const [x,z]=cpos(c); R.rocks.push({x:x+(mr()-0.5)*1.2,z:z+(mr()-0.5)*1.2,t:0}); } }
  for(const k of R.rocks){ k.t+=dt; if(k.t<0.9){ const f=k.t/0.9; for(let q=0;q<10;q++){ const a=q/10*Math.PI*2; dyn(k.x+Math.cos(a)*0.55,0.04,k.z+Math.sin(a)*0.55,G('.'),0.13,0.9+0.8*f,0.45+0.3*f,0.2,0,0); } dyn(k.x,3.2-2.6*f*f,k.z,G('#'),0.3,0.7,0.66,0.6,0,0); }
    else if(!k.hit){ k.hit=true; for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(k.x,0.2,k.z,Math.cos(a)*1.4,0.6+mr()*1.2,Math.sin(a)*1.4,0.7,G(mpick(['#','%','.',','])),0.14,0.75,0.7,0.62,1); } if(Math.hypot(k.x-player.x,k.z-player.z)<0.65)hurtPlayer(6,'落石'); for(const m of here.monsters)if(!m.dead&&Math.hypot(k.x-m.x,k.z-m.z)<0.65)damageMonster(m,6,'落石'); } }
  R.rocks=R.rocks.filter(k=>k.t<1.2); if(R.t>=R.dur&&!R.rocks.length)rockfall=null; }

// ---------------------------------------------------------------- healing: no regeneration over time. Part of each wound lingers as recoverable (shown on the bar); strike back before it fades
// and the light of what you strike flows into you; a kill gives more. Altars, a little on going down, healing springs, and the town and the oracle heal.
let rallyMotes=[], rallyShown=-1, rallyChime=0;
// RALLY_FROM は src/lib/runes.ts（src/game/imports.mjs で読む）
function rallyOnHit(m,n,how){ if(!(player.rally>0)||!RALLY_FROM.has(how)||m.ty.critter||!(clock.time-(m.playerT||-99)<1.2))return; const mn=bodyN('mend');
  let gain=Math.min(player.rally,n*0.5*(1+0.5*mn)); const kill=m.hp<=0; if(kill)gain=Math.min(player.rally,gain+3+2*mn+3*BL('devour')); if(gain<=0.05)return; player.rally-=gain;
  const sc=m.ty.scale||1, k=kill?Math.min(16,6+Math.round(gain*2)):Math.min(5,1+Math.round(gain)), per=gain/k, src=kill&&m.form?m.form:null;
  for(let q=0;q<k;q++){ let x=m.x,y=m.y+0.6*sc,z=m.z; if(src){ const p=src[Math.floor(mr()*src.length)], cy=Math.cos(m.yaw), sy=Math.sin(m.yaw); x=m.x+(p.x*cy+p.z*sy)*sc; y=m.y+p.y*sc; z=m.z+(-p.x*sy+p.z*cy)*sc; }
    rallyMotes.push({x0:x,y0:y,z0:z,t:-q*0.03,dur:0.38+mr()*0.12,amt:per,c:m.ty.col||[1,0.9,0.7],wob:mr()*6.28}); } }
function updateRally(dt){ if(adv.dead)return; const mn=bodyN('mend');
  if(player.rally>0&&clock.time-(player.lastHurt||-99)>0.6){ player.rally=Math.max(0,player.rally-dt*(player.rallyRate||2)); }
  const tx=player.x, ty=(ui.camMode==='tps'?1.0:player.eye-0.35), tz=player.z;
  for(const p of rallyMotes){ p.t+=dt; if(p.t<0)continue; const f=Math.min(1,p.t/p.dur), e=f*f*(3-2*f), arc=Math.sin(f*Math.PI)*0.35;
    const x=p.x0+(tx-p.x0)*e+Math.cos(p.wob)*arc*0.4, y=p.y0+(ty-p.y0)*e+arc, z=p.z0+(tz-p.z0)*e+Math.sin(p.wob)*arc*0.4, b=1.6+1.2*f;
    dyn(x,y,z,G(f<0.5?'*':'.'),0.12,(p.c[0]*0.5+0.6)*b,(p.c[1]*0.5+0.55)*b,(p.c[2]*0.5+0.4)*b,0,0);
    if(f>=1&&!p.done){ p.done=true; player.hp=Math.min(adv.PLAYER_MAX,player.hp+p.amt); vfx.hpFlash=0.35; if(sndReady()&&clock.time-rallyChime>0.12){ rallyChime=clock.time; sChime(player.x,player.z,0.12); } } }
  rallyMotes=rallyMotes.filter(p=>!p.done);
  vfx.hpFlash=Math.max(0,vfx.hpFlash-dt);
  const rs=Math.round((player.rally||0)*4)+(vfx.hpFlash>0?1000:0); if(rs!==rallyShown){ rallyShown=rs; renderStatus(); } }
// 癒しの泉を描く（1つで1回、全回復。泉を置くのは src/lib/altars.ts の placeSpring）
function drawSprings(t){ for(const it of (here.D.items||[])){ if(it.kind!=='spring')continue; const [x,z]=cpos(it.i); if(Math.hypot(x-player.x,z-player.z)>26)continue; const used=it.taken;
    for(let k=0;k<16;k++){ const a=k/16*Math.PI*2+t*0.25, rr=0.55+0.05*Math.sin(t*2+k), b=used?0.25:0.7+0.3*Math.sin(t*1.8+k); dyn(x+Math.cos(a)*rr,0.05,z+Math.sin(a)*rr,G('~'),0.15,0.35*b,0.85*b,1.0*b,0,0); }
    if(!used){ dyn(x,0.06,z,G('o'),0.3,0.8,1.6,2.0,0,0); if(mr()<0.2)spawn(x+(mr()-0.5)*0.6,0.1,z+(mr()-0.5)*0.6,0,0.6,0,1.4,G(mpick(['.','\''])),0.1,0.6,1.5,1.8,0); } } }

function placeRunesForLevel(){
  here.D.items=here.D.items||[]; const seed=levelSeed(), r=mulberry32(seed^0x5eed1);
  const free=c=>c>=0&&c<NCELL&&here.D.tile[c]===TF&&!here.D.liquid[c]&&!here.D.solid.has(c)&&c!==here.D.stairs&&c!==here.D.upstairs&&!here.D.items.some(it=>it.i===c);
  if(here.depth===1&&!here.branch&&!here.realm&&!adv.runState.startChosen){
    const s=here.D.start, cand=[]; for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){ const d=Math.hypot(dx,dz); if(d<1.8||d>3.2)continue; const c=s+dx+dz*MW; if(free(c))cand.push([Math.atan2(dz,dx),c]); }
    cand.sort((a,b)=>a[0]-b[0]); const els=shuffle(RUNE_TYPES.elem.slice(),r).slice(0,3);
    if(cand.length>=3){ const step=cand.length/3; for(let k=0;k<3;k++)here.D.items.push({i:cand[Math.floor(k*step+step/2)][1],kind:'rune',rune:makeRune(els[k]),grp:'start',pedestal:true,taken:false}); }
  }
  if(here.depth===1&&!here.branch&&!here.realm&&!adv.runState.altar1){
    const rooms=here.D.rooms.filter((ro,ri)=>ri>0&&!ro.cave&&ro.cells.length>12); const ro=rooms.length?rooms[Math.floor(r()*rooms.length)]:null;
    const c=ro?ro.cells.filter(free):[]; if(c.length){ const at=c[Math.floor(c.length/2)];
      const opts=[...shuffle(RUNE_TYPES.elem.slice(),r).slice(0,2),RUNE_TYPES.trig[Math.floor(r()*2)]];
      opts.forEach((t,k)=>{ r(); /* 前は飾りの数を決めて乱数を1回引いていた（飾りは付かない）。迷宮を変えないため、同じ数だけ引く */ here.D.items.push({i:at,kind:'rune',rune:makeRune(t),grp:'altar1',altar:true,slot:k,taken:false}); }); } }
  else if(here.depth>1||here.branch||here.realm)mainPathAltars(r,free);
  for(const it of here.D.items)if(it.vault&&!it.ev)it.ev=r()<0.5?'guard':'collapse';
  // steles beside the stairs and gates: swap runes there at once
  here.D.steles=[]; for(const c0 of [here.D.stairs,here.D.upstairs,here.D.bstairs&&here.D.bstairs.cell,here.D.portal&&here.D.portal.cell]){ if(c0===undefined||c0===null||c0<0)continue;
    const nb=[1,-1,MW,-MW,MW+1,MW-1,-MW+1,-MW-1].map(o=>c0+o).find(free); if(nb!==undefined)here.D.steles.push({i:nb,g:RUNE_CHARS[Math.floor(r()*RUNE_CHARS.length)]}); }
  here.D.items.forEach((it,k)=>{ if(adv.runState.taken.has(seed+':'+k+':'+it.kind))it.taken=true; });
}
const nearStele=()=>(gallery&&gallery.mode==='range')||(here.D.steles||[]).some(s=>{ const [x,z]=cpos(s.i); return Math.hypot(x-player.x,z-player.z)<2.6; })||(here.D.items||[]).some(o=>o.altar&&o.slot===1&&(()=>{ const [x,z]=cpos(o.i); return Math.hypot(x-player.x,z-player.z)<2.6; })());
function pickupItems(){
  for(let k=0;k<(here.D.items||[]).length;k++){ const it=here.D.items[k]; if(it.taken)continue; if(it.kind==='rune'&&it.guardG!==undefined){ const gd=guardedNow(it); if(it.wasGuarded&&!gd&&!(here.D.lit||(here.D.lit=new Set())).has(it.grp||it.i)){ here.D.lit.add(it.grp||it.i); const [lx,lz]=cpos(it.i); sChime(lx,lz,0.5); msg(it.elitePrize?'<b style="color:#ffd27a">*</b>番人が倒れた。守られていたルーンが、手の届く光になった。':'<b style="color:#ffd27a">_</b>祭壇に光が灯った。'); } it.wasGuarded=gd; if(gd)continue; }
    if(it.kind==='legend'){ if(it.born&&clock.time-it.born<1)continue; const [lx,lz]=cpos(it.i); if(Math.hypot(lx-player.x,lz-player.z)<0.9){ it.taken=true; pickLegend(it); } continue; }
    if(it.kind==='grave'){ const [gx,gz]=cpos(it.i); if(Math.hypot(gx-player.x,gz-player.z)<0.9){ it.taken=true; takeRune(it.rune); msg(`<b style="color:#c8c8d8">+</b>前の冒険者の形見を、墓から拾った：${thingLabel(it.rune)}`); saved.META.grave=null; saveMeta(); sChime(gx,gz,0.4); } continue; }
    if(it.kind==='spring'){ const [sx,sz]=cpos(it.i); if(player.hp<adv.PLAYER_MAX-0.5&&Math.hypot(sx-player.x,sz-player.z)<0.9){ it.taken=true; adv.runState.taken.add(levelSeed()+':'+k+':spring'); player.hp=adv.PLAYER_MAX; player.rally=0; vfx.hpFlash=0.6; renderStatus(); sChime(sx,sz,0.5); setTimeout(()=>sChime(sx,sz,0.35),200); msg('<b style="color:#8fe0ff">~</b>泉の光が体を満たし、傷がすっかり癒えた。泉は静かに光を失った。'); for(let q=0;q<30;q++){ const a=mr()*6.28; spawn(player.x+Math.cos(a)*0.5,0.2+mr(),player.z+Math.sin(a)*0.5,Math.cos(a)*0.4,0.8+mr(),Math.sin(a)*0.4,1.0,G(mpick(['*','.','~'])),0.12,0.8,1.8,2.2,0); } } continue; }
    if(it.kind==='slot'){ if(it.born&&clock.time-it.born<1)continue; const [sx,sz]=cpos(it.i); if(Math.hypot(sx-player.x,sz-player.z)<0.9){ it.taken=true; openSlot(it.i); } continue; }
    if(it.kind!=='rune'||!it.rune)continue; if(it.born&&clock.time-it.born<0.6)continue; const [x,z]=cpos(it.i);
    if(it.altar)continue; if(Math.hypot(x-player.x,z-player.z)>0.75)continue;
    grabItem(it,k,x,z); }
}
function grabItem(it,k,x,z,dest){
    it.taken=true; adv.runState.taken.add(levelSeed()+':'+k+':rune');
    if(it.grp){ here.D.items.forEach((o,j)=>{ if(o!==it&&o.grp===it.grp&&!o.taken){ o.taken=true; adv.runState.taken.add(levelSeed()+':'+j+':rune'); const [ox,oz]=cpos(o.i); for(let q=0;q<12;q++){ const a=mr()*6.28; spawn(ox+(o.altar?(o.slot-1)*0.55:0),0.95,oz,Math.cos(a)*0.8,0.3+mr()*0.6,Math.sin(a)*0.8,0.9,G('.'),0.1,0.8,0.75,1.0,0); } } }); }
    if(it.grp==='start')adv.runState.startChosen=true; if(it.grp==='altar1')adv.runState.altar1=true;
    if(it.opt==='forge'){ const w=it.forgeW, t=trList(w).find(t=>t.k===it.forgeK); if(t)t.lv=it.forgeTo; else { w.traits=w.traits||[]; w.traits.push({k:it.forgeK,lv:it.forgeTo}); }
      msg(`<b style="color:#bcdcff">T</b>${RUNE_DEF[w.type].name}の「${trName(w.type,{k:it.forgeK})}」が Lv${it.forgeTo} になった。`); sChime(x,z,0.5); renderHotbar(); if(ui.invOpen)renderInv(); return; }
    if(it.opt==='open'){ applyOpen(it.target); if(adv.runState.slotPend===it.grp)adv.runState.slotPend=null; msg(`<b style="color:#ffe3a0">{ }</b>${it.label}が開いた。`); sChime(x,z,0.5); return; }
    if(it.opt==='heal'){ player.hp=Math.min(adv.PLAYER_MAX,player.hp+adv.PLAYER_MAX*0.7); renderStatus(); msg('<b style="color:#ff9aa8">+</b>温かな光が、傷を塞いでいく。'); sChime(x,z,0.45); return; }
    if(dest){ placeChosen(it.rune,dest,!!it.altar); sChime(x,z,0.45); return; }
    takeRune(it.rune,it.grp==='start'?'R':null,!!it.altar); sChime(x,z,0.45); if(it.vault)vaultSprung(it);
}
// a rune put where the player chose: into a hand (what was there goes to the bag), or into the bag
function placeChosen(ru,dest,fromAltar){ if(!saved.RSEEN.has(ru.type)){ saved.RSEEN.add(ru.type); saveSet('al_runes',saved.RSEEN); } if(mergeMod(ru))return; const def=RUNE_DEF[ru.type], col=runeCol(ru);
  gear.bag.push(ru); msg(`<b class="rn" style="color:${css(col)}">${def.ch}</b>${thingLabel(ru)}を手にした。袋に収めた。Tab で付け替えられる（祭壇のそばなら詠唱はいらない）。`); renderHotbar(); if(ui.invOpen)renderInv(); }
// the altar's comparison panel: near a lit altar, its three choices side by side; 1, 2, 3 choose (touching still works). The game does not pause.
let altarNear=null, altarPanelKey='', altarSel=null, altarAim=-1, altarDismissed=null;
function runeDest(ru){ const def=RUNE_DEF[ru.type], cat=def.cat;
  if(cat==='body'){ const i=[0,1].slice(0,adv.runState.bodyOpen||0).find(i=>!gear.hands.B['b'+i]); return i!==undefined?'身の護符の枠へ':'袋へ'; }
  if(cat==='atk'){ const h=['R','L'].find(h=>!gear.hands[h].atk); return h?`${h==='L'?'左':'右'}手へ`:'袋へ'; }
  const p=freeSlotFor(ru); return p?`${p[0]==='L'?'左':'右'}手のルーンの枠へ`:'袋へ'; }
function altarDetail(o){ if(!o)return ['<span class="lab">選択肢にマウスを乗せると、ここに説明が出る</span>','','','',''];
  if(o.opt==='heal')return ['<b style="color:#ff9aa8">+</b> 癒し',`    <span class="lab">体力 ${Math.round(player.hp)} → ${Math.round(Math.min(adv.PLAYER_MAX,player.hp+adv.PLAYER_MAX*0.7))}</span>`,'    <span class="lab">温かな光が、傷を大きく塞ぐ</span>','',''];
  if(o.opt==='open')return [`<b style="color:#ffe3a0">{ }</b> ${o.label}`,'    <span class="lab">選ぶと、その枠が開く。ほかの選択肢は消える</span>','','',''];
  if(o.opt==='forge'){ const w=o.forgeW; return [`<b style="color:#bcdcff">T</b> ${RUNE_DEF[w.type].name}を鍛える`,`    <span class="lab">${trName(w.type,{k:o.forgeK})} Lv${o.forgeTo}：${trDesc(w.type,{k:o.forgeK,lv:o.forgeTo})}</span>`,'    <span class="dim">今持っている武器が、その場で鍛えられる</span>','','']; }
  return detailLines(o.rune); }
// ALTAR_W は src/lib/hud.ts（src/game/imports.mjs で読む）
function altarOpts(){ return [0,1,2].map(k=>here.D.items.find(o=>o.grp===altarNear&&o.slot===k&&!o.taken)).filter(Boolean); }
function renderAltar(){ const el=document.getElementById('altarp'); if(!el)return; const opts=altarOpts(); if(!opts.length){ closeAltar(false); return; }
  const f=t=>`<span class="f">${t}</span>`, rows=[f(opts[0].lord?'+-- 主の祭壇 ---':opts[0].opt==='open'?'+-- 空の枠 ---':opts[0].forge?'+-- 鍛えの祭壇 ---':'+-- ルーンの祭壇 ---'),f('|')];
  for(const o of opts)rows.push(`${f('|')}  <button class="row ao" data-k="${o.slot}">${clipHtml(altarLine(o),ALTAR_W-6)}</button>`);
  rows.push(f('|'));
  for(let i=0;i<5;i++)rows.push(`${f('|')} <span class="adet">${padTo('',ALTAR_W-3)}</span>`);
  rows.push(f('|'),`${f('|')} <span class="lab">クリックで選ぶ　Esc・右クリックでやめる</span>　<button class="row" data-cancel="1">[やめる]</button>`);
  if(opts[0].opt!=='open'&&!opts[0].forge)rows.push(`${f('|')} <span class="lab">ルーンは袋に入る。祭壇のそばでは、Tab の付け替えに詠唱はいらない</span>`);
  rows.push(f('+---'));
  el.innerHTML=boxText(rows,ALTAR_W); setAltarDetail(null);
  if(!el.dataset.bound){ el.dataset.bound='1';
    el.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('button'); if(!b||!ui.altarOpen)return; e.stopPropagation();
      if(b.dataset.cancel){ closeAltar(true); return; } if(b.dataset.k!==undefined)chooseAltar(+b.dataset.k); });
    el.addEventListener('mouseover',e=>{ if(!ui.altarOpen)return; const b=e.target.closest&&e.target.closest('button[data-k]'); setAltarDetail(b?altarOpts().find(o=>o.slot===+b.dataset.k):null); });
    el.addEventListener('contextmenu',e=>{ e.preventDefault(); if(ui.altarOpen)closeAltar(true); }); } }
function setAltarDetail(o){ const el=document.getElementById('altarp'); if(!el)return; const L=altarDetail(o); el.querySelectorAll('.adet').forEach((sp,i)=>{ sp.innerHTML=padTo(clipHtml(L[i]||'',ALTAR_W-4),ALTAR_W-3); }); }
function openAltar(){ const el=document.getElementById('altarp'); if(!el)return; ui.altarOpen=true; document.body.classList.toggle('paused',true);
  if(gear.castSt){ gear.castSt=null; fight.beamSegs=[]; } if(ui.locked&&document.exitPointerLock)document.exitPointerLock(); renderAltar(); el.classList.add('show','open'); renderHotbar(); }
function closeAltar(dismiss){ const el=document.getElementById('altarp'); ui.altarOpen=false; if(dismiss)altarDismissed=altarNear; if(el)el.classList.remove('show','open'); document.body.classList.toggle('paused',isPaused());
  if(!plFailed&&ui.started&&!adv.dead)tryLock(); updateResume(); }
function updateAltarPanel(){ const el=document.getElementById('altarp'); if(!el)return; if(ui.lvlOpen)return; if(adv.lvl.pending>0&&ui.started&&!adv.dead&&!isPaused()){ openLevelUp(); return; }
  if(ui.altarOpen){ if(!here.D||!ui.started||adv.dead||!altarOpts().length)closeAltar(false); return; }
  altarNear=null;
  if(ui.started&&!adv.dead&&!isPaused()&&here.D){ let best=null, bd=1.5; for(const it of (here.D.items||[])){ if(it.taken||!it.altar||!it.rune||it.slot!==1)continue; if(it.guardG!==undefined&&guardedNow(it))continue; const [x,z]=cpos(it.i), d=Math.hypot(x-player.x,z-player.z); if(d<bd){ bd=d; best=it; } } if(best)altarNear=best.grp; }
  if(!altarNear){ altarDismissed=null; if(el.classList.contains('show'))el.classList.remove('show','open'); return; }
  if(altarDismissed===altarNear)return;
  openAltar(); }
function chooseAltar(n){ if(!altarNear)return false; const k=here.D.items.findIndex(o=>o.grp===altarNear&&o.slot===n&&!o.taken); if(k<0)return false; const it=here.D.items[k];
  const [x,z]=cpos(it.i); if(!it.opt||it.opt==='rune')grabItem(it,k,x+(it.slot-1)*0.55,z,'bag'); else grabItem(it,k,x+(it.slot-1)*0.55,z); altarSel=null; altarPanelKey=''; if(ui.altarOpen)closeAltar(false); return true; }
function altarPlace(dest){ if(!altarSel)return false; const k=here.D.items.findIndex(o=>o.grp===altarSel.grp&&o.slot===altarSel.slot&&!o.taken); altarSel=null; altarPanelKey=''; if(k<0)return false; const it=here.D.items[k], [x,z]=cpos(it.i); grabItem(it,k,x+(it.slot-1)*0.55,z,dest); return true; }

function mergeMod(ru){ if(RUNE_DEF[ru.type].cat!=='mod'||ru.strong)return false; const tw=gear.bag.find(b=>b.type===ru.type&&!b.strong); if(!tw)return false; tw.strong=true; msg(`<b class="rn" style="color:${css(TIER_COL[3])}">${RUNE_DEF[ru.type].ch}</b>2つの「${RUNE_DEF[ru.type].nm}」のルーンが、ひとつの強い版にまとまった（${runeName(tw)}）。`); renderHotbar(); if(ui.invOpen)renderInv(); return true; }
function takeRune(ru,prefer,fromAltar){
  if(!saved.RSEEN.has(ru.type)){ saved.RSEEN.add(ru.type); saveSet('al_runes',saved.RSEEN); }
  if(mergeMod(ru))return;
  const def=RUNE_DEF[ru.type], col=runeCol(ru), order=prefer?[prefer,prefer==='R'?'L':'R']:['R','L']; let where='';
  if(def.cat==='body'){ const i=[0,1].slice(0,adv.runState.bodyOpen||0).find(i=>!gear.hands.B['b'+i]); if(i!==undefined){ gear.hands.B['b'+i]=ru; where='身に着けた'; } else { gear.bag.push(ru); where='袋に収めた'; } }
  else if(def.cat==='atk'){ const two=def.two, h=two?(!gear.hands.L.atk&&!gear.hands.R.atk?'R':null):(isTwo()?null:order.find(h=>!gear.hands[h].atk)); if(h){ equipWeapon(h,ru); where=two?'両手で持った':`${h==='L'?'左':'右'}手に持った`; } else { gear.bag.push(ru); where='袋に収めた'; } }
  else { const p=freeSlotFor(ru,order); if(p){ slotSet(p[0],p[1],ru); where=`${p[0]==='L'?'左':'右'}手に宿った`; } else { gear.bag.push(ru); where='袋に収めた'; } }
  syncHands(); msg(`<b class="rn" style="color:${css(col)}">${def.ch}</b>${thingLabel(ru)}を手にした。${where}。`); renderHotbar(); if(ui.invOpen)renderInv();
}
