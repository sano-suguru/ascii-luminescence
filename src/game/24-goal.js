// ---------------------------------------------------------------- the goal: three legendary things held by lords, a sealed descent, the deepest place, the last king's shadow
// FINAL_DEPTH は src/lib/world.ts（src/game/imports.mjs で読む）
// LEGEND_KINDS・LEGEND_ORDER・BRANCH_HINT は src/lib/names.ts（src/game/imports.mjs で読む）
// 伝説の物 getLegend は src/lib/legend.ts（src/game/imports.mjs で読む）。状態の表示の1行 legendLine も src/lib/legend.ts（状態の表示が使う）
const legendOfBranch=bk=>{ const L=getLegend(); if(!L)return null; return LEGEND_ORDER.find(k=>L.items[k].branch===bk)||null; };
const legendAll=()=>{ const L=getLegend(); return !!L&&L.have.size>=3; };
// 最深部か isFinal は src/lib/levels.ts、最深部の状態 here.finalSt は src/lib/state.ts（src/game/imports.mjs で読む）
const descentSealed=()=>here.depth===FINAL_DEPTH-1&&!here.branch&&!here.realm&&!legendAll();

// a lord falls: its legendary thing (if it holds one) or a golden rune
function lordFell(m){
  if(m.key!=='lord'||!here.branch)return;
  adv.runState.lordsDone.add(here.branch.key);
  { let si=m.cz*MW+m.cx; for(const d of [1,-1,MW,-MW])if(here.D.tile[si+d]===TF&&!here.D.liquid[si+d]){ si+=d; break; } here.D.items.push({i:si,kind:'slot',taken:false,born:clock.time}); }
  const k=legendOfBranch(here.branch.key), L=getLegend();
  if(k&&L&&!L.have.has(k)){ here.D.items.push({i:m.cz*MW+m.cx,kind:'legend',legend:k,taken:false,born:clock.time});
    const c=LEGEND_KINDS[k].col; for(let q=0;q<60;q++){ const a=mr()*6.28; spawn(m.x,0.8+mr()*1.5,m.z,Math.cos(a)*2.2,0.5+mr()*2.4,Math.sin(a)*2.2,1.2+mr(),G(mpick(['*','+','.','\''])),0.2,c[0]*3,c[1]*3,c[2]*3,0); }
    sChime(m.x,m.z,0.6); setTimeout(()=>sChime(m.x,m.z,0.5),300);
    msg(`<b style="color:${css(c)}">${LEGEND_KINDS[k].ch}</b>${mname(m)}が崩れ落ちた。その胸の奥から、ひとつの光がこぼれ落ちた。`); }
}
let slotPickN=0;
function applyOpen(t){ if(t==='slotR'||t==='slotL'){ const H=gear.hands[t.slice(4)]; H.slotN=Math.min(SLOT_MAX,(H.slotN||2)+1); while(H.slots.length<H.slotN)H.slots.push(null); } else if(t==='body')adv.runState.bodyOpen=Math.min(2,(adv.runState.bodyOpen||0)+1); syncHands(); renderHotbar(); if(ui.invOpen)renderInv(); }
function openSlot(cell){ const opts=[];
  for(const h of ['R','L'])if((gear.hands[h].slotN||2)<SLOT_MAX)opts.push({target:'slot'+h,label:`${h==='L'?'左':'右'}手に、ルーンの枠をもう1つ`});
  if((adv.runState.bodyOpen||0)<2)opts.push({target:'body',label:'身の護符の枠'});
  sChime(player.x,player.z,0.5); setTimeout(()=>sChime(player.x,player.z,0.4),220);
  for(let q=0;q<30;q++){ const a=mr()*6.28; spawn(player.x,0.6+mr(),player.z,Math.cos(a)*1.2,0.4+mr()*1.4,Math.sin(a)*1.2,0.9,G(mpick(['{','}','*','.'])),0.16,2.4,2.1,1.4,0); }
  if(!opts.length){ const ru=makeRune(randomRuneType(mr)); msg('<b style="color:#ffe3a0">{ }</b>空の枠を手にした。開ける枠はもうない。枠は、ひとつのルーンに姿を変えた。'); takeRune(ru); return; }
  if(opts.length===1){ applyOpen(opts[0].target); msg(`<b style="color:#ffe3a0">{ }</b>空の枠を手にした。${opts[0].label}が開いた。`); return; }
  const grp='slotpick'+(++slotPickN);
  opts.forEach((o,k)=>here.D.items.push({i:cell,kind:'rune',altar:true,grp,slot:k,opt:'open',target:o.target,label:o.label,rune:{uid:-1,type:'slotopt'},taken:false}));
  adv.runState.slotPend=grp; msg('<b style="color:#ffe3a0">{ }</b>空の枠を手にした。どの枠を開けるか、選ぶ。'); }

function pickLegend(it){
  const L=getLegend(), k=it.legend, kd=LEGEND_KINDS[k], c=kd.col; L.have.add(k); renderStatus();
  sChime(player.x,player.z,0.6); setTimeout(()=>sChime(player.x,player.z,0.5),250); setTimeout(()=>sChime(player.x,player.z,0.4),500);
  msg(`<b style="color:${css(c)}">${kd.ch}</b><b style="color:${css(c)}">${L.items[k].name}</b>を手にした。`); msg(`<span class="lab">${L.items[k].lore}</span>`);
  if(L.have.size===3)setTimeout(()=>msg(`<b style="color:#ffe9b0">*</b>三つの光が、手の中で同じ方へ震えている。ずっと下の、闇の底へ。`),1800);
}
// the oracle names, in its own way, where the three are kept
function oracleLegendHints(){ const L=getLegend(); if(!L)return;
  LEGEND_ORDER.forEach((k,j)=>{ if(L.have.has(k))return; const it=L.items[k]; setTimeout(()=>msg(`<b style="color:#bfe4ff">「</b>${LEGEND_KINDS[k].name}は、${BRANCH_HINT[it.branch]}で、主に抱かれている」`),900+j*700); }); }

// ---------------------------------------------------------------- the deepest place: with the three legendary things in hand, the king's shadow rises there
function setupFinal(){
  // the bottom: the place with the highest vault on this level, with open floor around it, so the shadow can stand under the vault
  let c0=here.D.stairs, bc=here.D.ceil[c0]||0; const open=i=>i>=0&&i<NCELL&&here.D.tile[i]===TF&&!here.D.liquid[i]&&!here.D.solid.has(i);
  for(const rad of [3,2,1]){ for(let i=0;i<NCELL;i++){ if(!open(i)||here.D.ceil[i]<=bc)continue; const x=i%MW, z=(i/MW)|0; let ok=x>rad&&z>rad&&x<MW-rad-1&&z<MH-rad-1;
      for(let dz=-rad;dz<=rad&&ok;dz++)for(let dx=-rad;dx<=rad;dx++)if(!open(i+dz*MW+dx)){ ok=false; break; } if(ok){ bc=here.D.ceil[i]; c0=i; } }
    if(bc>=10)break; }
  here.monsters=here.monsters.filter(m=>m.ty.critter);
  here.finalSt={c0,boss:null,bossT:-1,summonT:12,said:false};
}
function updateFinal(dt){
  if(!here.finalSt||!isFinal()||adv.dead)return;
  if(!here.finalSt.said&&ui.started){ here.finalSt.said=true; setTimeout(()=>msg('<b style="color:#bfe4ff">.</b>底に着いた。光の届かない、静かな闇だ。手の中で、三つの光が震えている。'),1600); }
  // with the three legendary things in hand, the shadow rises a little after you arrive
  if(!here.finalSt.boss&&here.finalSt.bossT<0&&legendAll())here.finalSt.bossT=3.2;
  if(here.finalSt.bossT>0){ here.finalSt.bossT-=dt; if(here.finalSt.bossT<=0)spawnFinalBoss(); }
  const b=here.finalSt.boss; if(b&&!b.dead&&!b.phase2&&b.hp<b.maxHp*0.5)transformShadow(b);
  if(b&&b.invulnT>0)b.invulnT-=dt;
  if(b&&!b.dead){ here.finalSt.summonT-=dt;
    if(here.finalSt.summonT<=0){ here.finalSt.summonT=14; const n=here.monsters.filter(m=>!m.dead&&m.key==='W').length; if(n<4){ for(let k=0;k<2;k++){ const a=mr()*6.28, cx=Math.floor((b.x+Math.cos(a)*2.5)/CELL), cz=Math.floor((b.z+Math.sin(a)*2.5)/CELL), c=cz*MW+cx; if(here.D.tile[c]!==TF)continue;
        const s=makeMonster({key:'W',cx,cz,g:-1,lead:true}); s.sleep=false; s.aware=1.25; s.noticed=true; here.monsters.push(s); for(let q=0;q<16;q++){ const an=mr()*6.28; spawn(s.x,0.6,s.z,Math.cos(an),0.4+mr(),Math.sin(an),0.8,G('.'),0.14,0.6,0.4,1.2,0); } }
        msg(`<b style="color:#a98cff">W</b>影が身をよじり、闇の中から亡霊を呼び出した。`); } } }
}
// SHADOW_KING_SC・shadowKingScale は src/lib/bodies/lords.ts（src/game/imports.mjs で読む）。二つ目の姿の大きさ shadowSerpentScale は src/lib/bodies/bosses.ts
function spawnFinalBoss(){
  const R=adv.HIST.rulers, last=R[R.length-1], cx=here.finalSt.c0%MW, cz=(here.finalSt.c0/MW)|0;
  const ceilH=here.D.ceil[here.finalSt.c0]||6;
  MTYPES.final={...MTYPES.L,ch:'&',look:null,form:'shadowking',sk:'final',name:`${last.name}王の影`,scale:shadowKingScale(ceilH),col:[0.62,0.48,1.0],boss:true,lich:false,light:6,verb:'黒い太陽を頭に浮かべ、長い剣を手に、底の闇から立ち上がった'};
  const b=makeMonster({key:'final',cx,cz,g:-1,lead:true}); b.sleep=false; b.aware=1.25; b.noticed=true; b.heartOn=true; here.monsters.push(b); here.finalSt.boss=b;
  sRumble(0.9,3); vfx.shake=Math.max(vfx.shake,0.6); vfx.flash=Math.max(vfx.flash,0.3);
  for(let q=0;q<90;q++){ const a=mr()*6.28, e=mr(); spawn(b.x+Math.cos(a)*e*2,0.2,b.z+Math.sin(a)*e*2,Math.cos(a)*0.6,1+mr()*3,Math.sin(a)*0.6,1.6+mr(),G(mpick(['%','#','.','&'])),0.24,0.5,0.35,0.9,0); }
  msg(`<b style="color:#a98cff">&amp;</b>三つの光に照らされて、底の闇がひとところに集まっていく……`);
  setTimeout(()=>msg(`<b style="color:#a98cff">&amp;</b><b style="color:#c9b8ff">${last.title}${last.name}の影</b>が立ち上がった。`),1400);
}
// drawing: the seal on the stairs at the last level before the bottom; legendary things lying where a lord fell
function drawLegendWorld(t){
  const L=getLegend(); if(!L||!here.D)return;
  for(const it of (here.D.items||[])){ if(it.taken||it.kind!=='legend')continue; const [x,z]=cpos(it.i), c=LEGEND_KINDS[it.legend].col, b=2.4+0.6*Math.sin(t*2.5);
    dyn(x,1.0+Math.sin(t*1.6)*0.08,z,G(LEGEND_KINDS[it.legend].ch),0.7,c[0]*b,c[1]*b,c[2]*b);
    for(let k=0;k<10;k++){ const a=t*0.9+k/10*Math.PI*2; dyn(x+Math.cos(a)*0.5,0.3+k*0.04,z+Math.sin(a)*0.5,G('*'),0.1,c[0]*2,c[1]*2,c[2]*2); }
    for(let y=0;y<10;y++)dyn(x,1.4+y*0.5,z,G('|'),0.2,c[0]*(1.2-y*0.1),c[1]*(1.2-y*0.1),c[2]*(1.2-y*0.1)); }
  if(descentSealed()){ const [x,z]=cpos(here.D.stairs); if(Math.hypot(x-player.x,z-player.z)<30)LEGEND_ORDER.forEach((k,j)=>{ const a=j/3*Math.PI*2+t*0.3, kd=LEGEND_KINDS[k], has=L.have.has(k), c=kd.col, br=has?2.4:0.35;
      dyn(x+Math.cos(a)*1.1,0.9,z+Math.sin(a)*1.1,G(kd.ch),0.4,c[0]*br,c[1]*br,c[2]*br); for(let q=0;q<8;q++){ const b2=a+q*0.09; dyn(x+Math.cos(b2)*1.1,0.12,z+Math.sin(b2)*1.1,G('.'),0.1,0.5,0.45,0.7); } }); }
}
// the end: a screen like the one for death, but light
function victory(){
  if(adv.won)return; adv.won=true; adv.dead=true; keys.KeyW=keys.KeyA=keys.KeyS=keys.KeyD=false;
  const el=document.getElementById('death'); if(!el)return; const L=getLegend();
  const secs=Math.floor(clock.time-adv.runStats.t0), mm=Math.floor(secs/60), ss=String(secs%60).padStart(2,'0'), f=t=>`<span class="f">${t}</span>`;
  const R=awardLore(true); graveCands=[]; document.body.classList.add('over');
  el.innerHTML=boxText([f('+-- 光 は 戻 っ た ---'),f('|'),...LEGEND_ORDER.map(k=>`${f('|')}  <b style="color:${css(LEGEND_KINDS[k].col)}">${LEGEND_KINDS[k].ch}</b> ${L.items[k].name}`),f('|'),
    `${f('|')}  Lv${adv.lvl.n}　倒した敵 ${adv.runStats.kills}　時間 ${mm}:${ss}　シード ${adv.runSeed}`,f('|'),...loreRows(R,f),f('|'),`${f('|')}  ${adv.HIST.civ.name}の地の底に、ひとつの灯りがともった。`,f('|'),`${f('|')}  <b>[Enter]</b> 新しい探索へ`,f('+---')]);
  el.classList.add('show','won'); for(let k=0;k<4;k++)setTimeout(()=>sChime(player.x,player.z,0.5),k*380);
}

// ---------------------------------------------------------------- lightning that can be followed: a jagged bolt that flickers, jumping one target after another, lighting the room for an instant
// jagged は src/lib/math.ts（src/game/imports.mjs で読む）
function addBolt(a,b,col,style){ style=style||'thunder'; const amp=style==='thunder'?0.35:0.14; fight.boltFx.push({a,b,col,style,amp,t:0,life:style==='thunder'?0.36:0.3,re:0,pts:jagged(a,b,amp)}); }
function sparkCrown(m,col){ const cy=m.y+0.6*m.ty.scale+0.35*m.ty.scale; m.hitT=Math.max(m.hitT||0,0.3);
  for(let q=0;q<12;q++){ const a=q/12*Math.PI*2; spawn(m.x+Math.cos(a)*0.3*m.ty.scale,cy,m.z+Math.sin(a)*0.3*m.ty.scale,Math.cos(a)*1.4,1.2+mr(),Math.sin(a)*1.4,0.35,G(mpick(['*','+','\''])),0.13,col[0]*3.2,col[1]*3.2,col[2]*3.2,0); } }
function drawBoltFx(t,dt){
  for(const z of fight.zapQueue){ z.t-=dt; if(z.t<=0&&!z.done){ z.done=true; z.fn(); } } fight.zapQueue=fight.zapQueue.filter(z=>!z.done);
  if(vfx.zapFlash&&vfx.zapFlash.t<900)vfx.zapFlash.t-=dt;
  for(const f of fight.boltFx){ f.t+=dt; f.re-=dt; if(f.re<=0){ f.re=0.07; f.pts=jagged(f.a,f.b,f.amp); }
    const fade=Math.max(0,1-f.t/f.life), c=f.col, br=(f.style==='thunder'?3.2:2.2)*fade*(0.75+0.5*mr());
    for(let k=0;k+1<f.pts.length;k++){ const p=f.pts[k], q=f.pts[k+1], dx=q[0]-p[0], dy=q[1]-p[1], dz=q[2]-p[2], hz=Math.hypot(dx,dz);
      const ch=f.style==='thunder'?(Math.abs(dy)>hz*1.2?'|':((dy>0)===(dx+dz>0)?'/':'\\')):f.style==='fire'?mpick(['^','~']):f.style==='ice'?mpick(['*','.']):mpick(['%','.']);
      const n=Math.max(1,Math.round(Math.hypot(dx,dy,dz)/0.2)); for(let j=0;j<n;j++){ const s=j/n; dyn(p[0]+dx*s,p[1]+dy*s,p[2]+dz*s,G(ch),f.style==='thunder'?0.16:0.12,c[0]*br,c[1]*br,c[2]*br); } } }
  fight.boltFx=fight.boltFx.filter(f=>f.t<f.life);
}

// ---------------------------------------------------------------- back to the title (the run ends)
function returnToTitle(){
  setMenu(false); if(ui.invOpen)setInv(false); if(ui.locked&&document.exitPointerLock)document.exitPointerLock();
  ui.started=false; adv.dead=false; adv.won=false; ui.gallery=null; gear.castSt=null; gear.swapSt=null; vfx.zapFlash=null;
  document.body.classList.remove('started'); const de=document.getElementById('death'); if(de)de.classList.remove('show','won');
  const gp=document.getElementById('gal'); if(gp)gp.classList.remove('show');
  adv.runSeed=(Math.random()*1e9)>>>0; here.depth=startDepth; here.branch=null; here.realm=null; here.inter=null; placeMem.clear(); here.arrive=null; here.trans=null; player.fall=false;
  player.hp=adv.PLAYER_MAX; resetRunes(); newLevel();
  introEl.classList.remove('gone'); setHelp(false); const st=document.getElementById('stratum'); if(st)st.classList.remove('show');
  renderStatus(); renderHotbar();
}

