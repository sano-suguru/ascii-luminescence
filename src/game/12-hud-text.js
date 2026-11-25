// stealth・lantern・hudInfo は src/lib/state.ts（src/game/imports.mjs で読む。丸ごと入れ替えないので、名前はそのまま）
// LIGHT_NAMES・LIGHT_COLS は src/lib/hud.ts（src/game/imports.mjs で読む）
function updateStealth(dt){
  const l=cellLight(player.x,player.z); let L=0.3*l[0]+0.55*l[1]+0.15*l[2];
  for(const m of here.monsters){ if(m.ty.light>0&&!m.ty.invisible&&(m.ty.form!=='eel'||m.surf>0)){ const d=Math.hypot(m.x-player.x,m.z-player.z); if(d<m.ty.light)L+=(1-d/m.ty.light)**2*0.6; } }
  if(blaze.spark){ const d=Math.hypot(blaze.spark.x-player.x,blaze.spark.z-player.z); if(d<5)L+=(1-d/5)**2*1.2; }
  L+=stealth.sneak?0.02:0.12;
  stealth.lum+=(L-stealth.lum)*Math.min(1,dt*4);
  stealth.level=stealth.lum<0.25?0:stealth.lum<0.85?1:2;
  const moving=Math.hypot(player.vx,player.vz)>0.3, running=moving&&(keys.ShiftLeft||keys.ShiftRight)&&!stealth.sneak;
  stealth.range=[4.5,8,14][stealth.level]*(stealth.sneak?0.6:1)*(running?1.6:moving?1:0.75)*Math.max(0.4,1-0.25*bodyN('hush'))*(trialOn('dusk')?0.7:1);
  lantern.r+=((stealth.sneak?3.4:8.2)*(trialOn('dusk')?0.6:1)-lantern.r)*Math.min(1,dt*3); lantern.k+=((stealth.sneak?0.35:1)-lantern.k)*Math.min(1,dt*3);
  const seen=here.monsters.some(m=>m.noticed&&!m.dead&&Math.hypot(m.x-player.x,m.z-player.z)<26);
  const key=stealth.level+'|'+stealth.sneak+'|'+seen;
  stealth.seen=seen;
  if(key!==stealth.hudKey){ stealth.hudKey=key; renderStatus(); }
}
// ---- the HUD is drawn with glyphs only: depth, light, sparks, and state when it matters
let helpT=0;
function renderStatus(){
  const el=document.getElementById('status'); if(!el||!here.D)return;
  const lv=stealth.level, lc=LIGHT_COLS[lv];
  const meter=['.',':','*'].map((g,k)=>k<=lv?`<span class="glow" style="color:${lc}">${g}</span>`:`<span class="dim">${g}</span>`).join(' ');
  let l4='';
  if(stealth.seen)l4+='<span class="glow" style="color:#ff6a4a">!</span> <span class="lab">見つかっている</span>';
  const hpR=clamp((player.hp||0)/adv.PLAYER_MAX,0,1), hpN=Math.round(hpR*20), rlN=Math.max(0,Math.min(20-hpN,Math.round(clamp(((player.hp||0)+(player.rally||0))/adv.PLAYER_MAX,0,1)*20)-hpN)), hpC=vfx.hpFlash>0?'#fff0d8':hpR>0.5?'#ff8a7a':hpR>0.25?'#ffb05a':'#ff4a3a';
  const hpLine=`<span class="glow" style="color:${hpC}">${'#'.repeat(hpN)}</span><span style="color:#d9874a">${'='.repeat(rlN)}</span><span class="dim">${'.'.repeat(20-hpN-rlN)}</span>  <span class="lab">体力 ${Math.ceil(player.hp||0)}/${adv.PLAYER_MAX}</span>`;
  const xf=Math.round(clamp(adv.lvl.exp/expNeed(adv.lvl.n),0,1)*20), xpLine=`<span style="color:#c8b6ff">${'-'.repeat(xf)}</span><span class="dim">${'.'.repeat(20-xf)}</span>  <span class="lab">Lv${adv.lvl.n}</span>`;
  el.innerHTML=hpLine+'\n'+xpLine+`\n<span class="glow" style="color:#ffbf6a">&gt; ${placeLabel()}</span>\n${meter}  <span class="lab">${LIGHT_NAMES[lv]}</span>`+(ui.started?'\n'+legendLine():'')+(l4?'\n'+l4:'')+(ui.perfOn?`\n<span class="lab">${pfFps} fps   文字 ${(glyphCount/10000).toFixed(1)}万   描画 ${(chunksDrawn/10000).toFixed(1)}万   生き物 ${here.monsters.length}</span>`:'');
}
let pfFrames=0, pfT=0, pfFps=0;
// パネルの文字の幅（visW）と枠（boxText）は src/lib/text.ts（src/game/imports.mjs で読む）
function renderChron(){
  const el=document.getElementById('help'); if(!el||!HIST)return;
  const f=t=>`<span class="f">${t}</span>`;
  const lines=[f(`+-- 年代記 ── ${HIST.civ.name}（${HIST.civ.ep}）`)];
  HIST.events.forEach(e=>{ const r=HIST.rulers[e.ruler]; lines.push(`${f('|')} <b>${r.title} ${r.name}</b>`); lines.push(`${f('|')}   ${e.text}`); });
  lines.push(f('+------------------------------'));
  el.innerHTML=boxText(lines);
}
function renderHelp(){
  const el=document.getElementById('help'); if(!el||!here.D)return;
  const f=t=>`<span class="f">${t}</span>`;
  el.innerHTML=boxText([f('+-- 操作 ----------------------'),
    `${f('|')} <b>WASD</b>     移動        <b>マウス</b>  視点`,`${f('|')} <b>左クリック</b> 左手      <b>右クリック</b> 右手`,`${f('|')} 押して詠唱、満ちたら離して放つ`,`${f('|')} <b>ホイール</b> ビルド切替  <b>Space</b>  回避`,`${f('|')} <b>Shift</b>    走る`,`${f('|')} <b>Tab</b>      装備        <b>Esc</b>    メニュー`,`${f('|')} 立ち止まると、辺りを自動で調べる`,f('|'),
    `${f('|')} 深度 ${here.depth}${here.branch||here.realm?`（${placeLabel()}）`:''}    地図 ${hudInfo.explored}%`,`${f('|')} シード ${adv.runSeed}`,f('+------------------------------')]);
}
function setHelp(on){ ui.helpOn=on; ui.chronOn=false; const el=document.getElementById('help'); if(!el)return; if(on)renderHelp(); el.classList.toggle('off',!on); }
function cycleUi(){ ui.uiMode=(ui.uiMode+1)%3; document.body.classList.toggle('ui-min',ui.uiMode===1); document.body.classList.toggle('ui-none',ui.uiMode===2);
  if(ui.uiMode<2){ showHint(ui.uiMode===0?'表示：通常':'表示：最小'); setTimeout(()=>showHint(''),1200); } }
function toggleSneak(){ stealth.sneak=!stealth.sneak; showHint(stealth.sneak?'ランタンを絞った。忍び足で、気配を殺して進む':'ランタンの灯りを戻した'); setTimeout(()=>showHint(''),1600); }
let noticeMsgT={};
function onNoticed(m){
  if(m.ty.watcher&&!m.alarmed){ m.alarmed=true; sAlarm(m.x,m.z); vfx.shake=Math.max(vfx.shake,0.15); msg(`<b style="color:${css(m.ty.col)}">R</b>${mname(m)}が赤い光を明滅させ、警報を鳴らした！`); for(const o of here.monsters){ if(o===m||o.ty.critter||o.dead)continue; if(Math.hypot(o.x-m.x,o.z-m.z)<22){ o.sleep=false; o.aware=Math.max(o.aware,1.05); } } }
  if(m.ty.snap&&!m.howled){ for(const o of here.monsters)if(o.ty.snap)o.howled=true; sHowl(m.x,m.z); msg(`<b style="color:${css(m.ty.col)}">s</b>${mname(m)}が遠吠えを上げた。野営地じゅうが、こちらを向く。`); for(const o of here.monsters){ if(!o.ty.snap||o===m)continue; if(Math.hypot(o.x-m.x,o.z-m.z)<30){ o.sleep=false; o.aware=Math.max(o.aware,1.05); } } }
  if(m.ty.hound&&!m.howled){ for(const o of here.monsters)if(o.g===m.g)o.howled=true; sHowl(m.x,m.z); }
  if(m.ty.beast&&!m.woke){ m.woke=true; m.noticed=true; m.sleep=false; m.aware=1.25; vfx.shake=Math.max(vfx.shake,0.6); sRoar(); msg(`<b style="color:${css(m.ty.col)}">X</b>${mname(m)}が目を覚まし、こちらを見た。`); msg(`<b style="color:${css(m.ty.col)}">X</b>──年代記に記された、あの獣だ。${m.ty.lore}`); return; }
  const grp=m.g>=0?here.monsters.filter(o=>o.g===m.g):[m];
  for(const o of grp){ o.noticed=true; o.sleep=false; o.aware=Math.max(o.aware,1); o.mark=0; }
  const k=m.g>=0?'g'+m.g:'m'+here.monsters.indexOf(m);
  if(clock.time-(noticeMsgT[k]||-99)>12){ noticeMsgT[k]=clock.time; msg(`<b style="color:#ff6a4a">!</b>${mname(m)}${grp.length>1?'の群れ':''}があなたに気づいた！`); sAlert(m.x,m.z); }
}
function makeNoise(x,z,r,amt){
  for(const m of here.monsters){ const d=Math.hypot(m.x-x,m.z-z); if(d>r)continue; m.aware=Math.min(1.25,m.aware+amt*(1-d/r)); if(m.sleep&&m.aware>0.35){ m.sleep=false; m.wait=0.6; } }
}
// MARK_H は src/lib/hud.ts（src/game/imports.mjs で読む）
function drawMark(m,t,dp){
  if(m.ty.peaceful||!m.visible||m.ty.invisible||dp>22)return;
  m.mark+=1/60;
  const y=m.y+(MARK_H[m.ty.form]||1.5)*m.ty.scale+0.25, near=clamp(dp/4,0.5,1);
  if(m.sleep){ for(let k=0;k<2;k++){ const q=(t*0.45+k*0.5)%1; dyn(m.x+q*0.25,y+q*0.45,m.z,G('z'),(0.16+0.1*(1-q))*(k?0.8:1),0.55*(1-q)*near,0.6*(1-q)*near,1.0*(1-q)*near); } }
  else if(m.noticed){ const pop=1+Math.max(0,1-m.mark*3)*0.6; dyn(m.x,y+Math.sin(t*6)*0.03,m.z,G('!'),0.36*pop,2.4*near,0.55*near,0.3*near); }
  else if(m.aware>0.35){ dyn(m.x,y+Math.sin(t*3)*0.04,m.z,G('?'),0.32,2.0*near,1.7*near,0.5*near); }
}
// lerpAngle は src/lib/math.ts（src/game/imports.mjs で読む）
const flyOpen=(x,z)=>{ const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL); if(cx<0||cz<0||cx>=MW||cz>=MH)return false; const tt=here.D.tile[cz*MW+cx]; return tt!==TW&&tt!==TX; };
// mname は src/lib/names.ts（src/game/imports.mjs で読む）
