// ---------------------------------------------------------------- the goal: three legendary things held by lords, a sealed descent, the deepest place, the last king's shadow
// FINAL_DEPTH は src/lib/world.ts（src/game/imports.mjs で読む）
// LEGEND_KINDS・LEGEND_ORDER・BRANCH_HINT は src/lib/names.ts（src/game/imports.mjs で読む）
// 伝説の物 getLegend は src/lib/legend.ts（src/game/imports.mjs で読む）。状態の表示の1行 legendLine も src/lib/legend.ts（状態の表示が使う）
// 伝説の物の読み方（legendOfBranch・legendAll・descentSealed）は src/lib/legend.ts（src/game/imports.mjs で読む）
// 最深部か isFinal は src/lib/levels.ts、最深部の状態 here.finalSt は src/lib/state.ts（src/game/imports.mjs で読む）

// lordFell は src/lib/combat.ts（src/game/imports.mjs で読む）
let slotPickN=0;
// applyOpen は src/lib/gear.ts（src/game/imports.mjs で読む）
function openSlot(cell){ const opts=[];
  for(const h of ['R','L'])if((gear.hands[h].slotN||2)<SLOT_MAX)opts.push({target:'slot'+h,label:`${h==='L'?'左':'右'}手に、ルーンの枠をもう1つ`});
  if((adv.runState.bodyOpen||0)<2)opts.push({target:'body',label:'身の護符の枠'});
  sChime(player.x,player.z,0.5); setTimeout(()=>sChime(player.x,player.z,0.4),220);
  for(let q=0;q<30;q++){ const a=mr()*6.28; spawn(player.x,0.6+mr(),player.z,Math.cos(a)*1.2,0.4+mr()*1.4,Math.sin(a)*1.2,0.9,G(mpick(['{','}','*','.'])),0.16,2.4,2.1,1.4,0); }
  if(!opts.length){ const ru=makeRune(randomRuneType(keyedRand('slot',levelSeed(),cell))); msg('<b style="color:#ffe3a0">{ }</b>空の枠を手にした。開ける枠はもうない。枠は、ひとつのルーンに姿を変えた。'); takeRune(ru); return; }
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
// 神託所が伝説の物の在りかを告げる oracleLegendHints は src/lib/legend.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- the deepest place: with the three legendary things in hand, the king's shadow rises there
// setupFinal は src/lib/levels.ts（src/game/imports.mjs で読む）
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
// 伝説の物を世界の中に描く drawLegendWorld は src/lib/legend.ts（src/game/imports.mjs で読む）
// victory は src/lib/results.ts（src/game/imports.mjs で読む）

// 稲妻の見た目 addBolt・sparkCrown・drawBoltFx は src/lib/fx.ts（src/game/imports.mjs で読む）

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

