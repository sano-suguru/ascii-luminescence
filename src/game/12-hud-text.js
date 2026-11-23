const stealth={lum:0,level:1,range:8,sneak:false,hudKey:''};
const lantern={r:8.2,k:1};
const LIGHT_NAMES=['暗がり','薄明かり','光の中'], LIGHT_COLS=['#8a92d6','#d8c07e','#ffd27a'];
function updateStealth(dt){
  const l=cellLight(player.x,player.z); let L=0.3*l[0]+0.55*l[1]+0.15*l[2];
  for(const m of monsters){ if(m.ty.light>0&&!m.ty.invisible&&(m.ty.form!=='eel'||m.surf>0)){ const d=Math.hypot(m.x-player.x,m.z-player.z); if(d<m.ty.light)L+=(1-d/m.ty.light)**2*0.6; } }
  if(spark){ const d=Math.hypot(spark.x-player.x,spark.z-player.z); if(d<5)L+=(1-d/5)**2*1.2; }
  L+=stealth.sneak?0.02:0.12;
  stealth.lum+=(L-stealth.lum)*Math.min(1,dt*4);
  stealth.level=stealth.lum<0.25?0:stealth.lum<0.85?1:2;
  const moving=Math.hypot(player.vx,player.vz)>0.3, running=moving&&(keys.ShiftLeft||keys.ShiftRight)&&!stealth.sneak;
  stealth.range=[4.5,8,14][stealth.level]*(stealth.sneak?0.6:1)*(running?1.6:moving?1:0.75)*Math.max(0.4,1-0.25*bodyN('hush'))*(trialOn('dusk')?0.7:1);
  lantern.r+=((stealth.sneak?3.4:8.2)*(trialOn('dusk')?0.6:1)-lantern.r)*Math.min(1,dt*3); lantern.k+=((stealth.sneak?0.35:1)-lantern.k)*Math.min(1,dt*3);
  const seen=monsters.some(m=>m.noticed&&!m.dead&&Math.hypot(m.x-player.x,m.z-player.z)<26);
  const key=stealth.level+'|'+stealth.sneak+'|'+seen;
  stealth.seen=seen;
  if(key!==stealth.hudKey){ stealth.hudKey=key; renderStatus(); }
}
// ---- the HUD is drawn with glyphs only: depth, light, sparks, and state when it matters
const hudInfo={explored:0};
let uiMode=0, helpOn=false, helpT=0;
function renderStatus(){
  const el=document.getElementById('status'); if(!el||!D)return;
  const lv=stealth.level, lc=LIGHT_COLS[lv];
  const meter=['.',':','*'].map((g,k)=>k<=lv?`<span class="glow" style="color:${lc}">${g}</span>`:`<span class="dim">${g}</span>`).join(' ');
  let l4='';
  if(stealth.seen)l4+='<span class="glow" style="color:#ff6a4a">!</span> <span class="lab">見つかっている</span>';
  const hpR=clamp((player.hp||0)/PLAYER_MAX,0,1), hpN=Math.round(hpR*20), rlN=Math.max(0,Math.min(20-hpN,Math.round(clamp(((player.hp||0)+(player.rally||0))/PLAYER_MAX,0,1)*20)-hpN)), hpC=hpFlash>0?'#fff0d8':hpR>0.5?'#ff8a7a':hpR>0.25?'#ffb05a':'#ff4a3a';
  const hpLine=`<span class="glow" style="color:${hpC}">${'#'.repeat(hpN)}</span><span style="color:#d9874a">${'='.repeat(rlN)}</span><span class="dim">${'.'.repeat(20-hpN-rlN)}</span>  <span class="lab">体力 ${Math.ceil(player.hp||0)}/${PLAYER_MAX}</span>`;
  const xf=Math.round(clamp(lvl.exp/expNeed(lvl.n),0,1)*20), xpLine=`<span style="color:#c8b6ff">${'-'.repeat(xf)}</span><span class="dim">${'.'.repeat(20-xf)}</span>  <span class="lab">Lv${lvl.n}</span>`;
  el.innerHTML=hpLine+'\n'+xpLine+`\n<span class="glow" style="color:#ffbf6a">&gt; ${placeLabel()}</span>\n${meter}  <span class="lab">${LIGHT_NAMES[lv]}</span>`+(started?'\n'+legendLine():'')+(l4?'\n'+l4:'')+(perfOn?`\n<span class="lab">${pfFps} fps   文字 ${(glyphCount/10000).toFixed(1)}万   描画 ${(chunksDrawn/10000).toFixed(1)}万   生き物 ${monsters.length}</span>`:'');
}
let perfOn=false, pfFrames=0, pfT=0, pfFps=0;
let chronOn=false;
// how many columns a piece of panel text takes. The panels use M PLUS 1 Code (half width = 1, full width = 2);
// the few characters it lacks (← → and full-width ！：？［］) come from BIZ UDGothic, where they are full width (2).
// Note: the ideographic space (U+3000) is half width in M PLUS 1 Code, so it counts 1. tests/panels.mjs checks this against the fonts.
const visW=html=>{ const t=html.replace(/<input[^>]*size="(\d+)"[^>]*>/g,(m,n)=>' '.repeat(+n)).replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'"); let w=0;
  for(const ch of t){ const c=ch.codePointAt(0); w+=c===0x3000?1:(c===0x2190||c===0x2192)?2:(c>=0x1100&&(c<=0x115f||(c>=0x2e80&&c<=0xa4cf)||(c>=0xac00&&c<=0xd7a3)||(c>=0xf900&&c<=0xfaff)||(c>=0xfe30&&c<=0xfe4f)||(c>=0xff00&&c<=0xff60)||(c>=0xffe0&&c<=0xffe6)||(c>=0x3000&&c<=0x30ff)))?2:1; } return w; };
function boxText(lines,fixedW){
  const f=t=>`<span class="f">${t}</span>`, all=lines.join('\n').split('\n'), top=all[0], body=all.slice(1,-1);
  const title=top.replace(/<[^>]*>/g,'').replace(/^\+-+\s*/,'').replace(/\s*-*\+?\s*$/,'');
  const T=fixedW?Math.max(fixedW,...body.map(visW)):Math.max(visW(`+-- ${title} `)+4,...body.map(visW));
  const head=`+-- ${title} `; const out=[f(head+'-'.repeat(Math.max(1,T+1-visW(head)))+'+')];
  for(const l of body)out.push(l+' '.repeat(Math.max(0,T-visW(l)))+' '+f('|'));
  out.push(f('+'+'-'.repeat(T)+'+')); return out.join('\n');
}
function renderChron(){
  const el=document.getElementById('help'); if(!el||!HIST)return;
  const f=t=>`<span class="f">${t}</span>`;
  const lines=[f(`+-- 年代記 ── ${HIST.civ.name}（${HIST.civ.ep}）`)];
  HIST.events.forEach(e=>{ const r=HIST.rulers[e.ruler]; lines.push(`${f('|')} <b>${r.title} ${r.name}</b>`); lines.push(`${f('|')}   ${e.text}`); });
  lines.push(f('+------------------------------'));
  el.innerHTML=boxText(lines);
}
function renderHelp(){
  const el=document.getElementById('help'); if(!el||!D)return;
  const f=t=>`<span class="f">${t}</span>`;
  el.innerHTML=boxText([f('+-- 操作 ----------------------'),
    `${f('|')} <b>WASD</b>     移動        <b>マウス</b>  視点`,`${f('|')} <b>左クリック</b> 左手      <b>右クリック</b> 右手`,`${f('|')} 押して詠唱、満ちたら離して放つ`,`${f('|')} <b>ホイール</b> ビルド切替  <b>Space</b>  回避`,`${f('|')} <b>Shift</b>    走る`,`${f('|')} <b>Tab</b>      装備        <b>Esc</b>    メニュー`,`${f('|')} 立ち止まると、辺りを自動で調べる`,f('|'),
    `${f('|')} 深度 ${depth}${branch||realm?`（${placeLabel()}）`:''}    探索 ${hudInfo.explored}%`,`${f('|')} シード ${runSeed}`,f('+------------------------------')]);
}
function setHelp(on){ helpOn=on; chronOn=false; const el=document.getElementById('help'); if(!el)return; if(on)renderHelp(); el.classList.toggle('off',!on); }
function cycleUi(){ uiMode=(uiMode+1)%3; document.body.classList.toggle('ui-min',uiMode===1); document.body.classList.toggle('ui-none',uiMode===2);
  if(uiMode<2){ showHint(uiMode===0?'表示：通常':'表示：最小'); setTimeout(()=>showHint(''),1200); } }
function toggleSneak(){ stealth.sneak=!stealth.sneak; showHint(stealth.sneak?'ランタンを絞った。忍び足で、気配を殺して進む':'ランタンの灯りを戻した'); setTimeout(()=>showHint(''),1600); }
let noticeMsgT={};
function onNoticed(m){
  if(m.ty.watcher&&!m.alarmed){ m.alarmed=true; sAlarm(m.x,m.z); shake=Math.max(shake,0.15); msg(`<b style="color:${css(m.ty.col)}">R</b>${mname(m)}が赤い光を明滅させ、警報を鳴らした！`); for(const o of monsters){ if(o===m||o.ty.critter||o.dead)continue; if(Math.hypot(o.x-m.x,o.z-m.z)<22){ o.sleep=false; o.aware=Math.max(o.aware,1.05); } } }
  if(m.ty.snap&&!m.howled){ for(const o of monsters)if(o.ty.snap)o.howled=true; sHowl(m.x,m.z); msg(`<b style="color:${css(m.ty.col)}">s</b>${mname(m)}が遠吠えを上げた。野営地じゅうが、こちらを向く。`); for(const o of monsters){ if(!o.ty.snap||o===m)continue; if(Math.hypot(o.x-m.x,o.z-m.z)<30){ o.sleep=false; o.aware=Math.max(o.aware,1.05); } } }
  if(m.ty.hound&&!m.howled){ for(const o of monsters)if(o.g===m.g)o.howled=true; sHowl(m.x,m.z); }
  if(m.ty.beast&&!m.woke){ m.woke=true; m.noticed=true; m.sleep=false; m.aware=1.25; shake=Math.max(shake,0.6); sRoar(); msg(`<b style="color:${css(m.ty.col)}">X</b>${mname(m)}が目を覚まし、こちらを見た。`); msg(`<b style="color:${css(m.ty.col)}">X</b>──年代記に記された、あの獣だ。${m.ty.lore}`); return; }
  const grp=m.g>=0?monsters.filter(o=>o.g===m.g):[m];
  for(const o of grp){ o.noticed=true; o.sleep=false; o.aware=Math.max(o.aware,1); o.mark=0; }
  const k=m.g>=0?'g'+m.g:'m'+monsters.indexOf(m);
  if(time-(noticeMsgT[k]||-99)>12){ noticeMsgT[k]=time; msg(`<b style="color:#ff6a4a">!</b>${mname(m)}${grp.length>1?'の群れ':''}があなたに気づいた！`); sAlert(m.x,m.z); }
}
function makeNoise(x,z,r,amt){
  for(const m of monsters){ const d=Math.hypot(m.x-x,m.z-z); if(d>r)continue; m.aware=Math.min(1.25,m.aware+amt*(1-d/r)); if(m.sleep&&m.aware>0.35){ m.sleep=false; m.wait=0.6; } }
}
const MARK_H={humanoid:2.05,quad:0.95,orb:0.55,bat:0.38,bloat:0.68,wraith:2.35,jelly:0.85,eel:1.2};
function drawMark(m,t,dp){
  if(m.ty.peaceful||!m.visible||m.ty.invisible||dp>22)return;
  m.mark+=1/60;
  const y=m.y+(MARK_H[m.ty.form]||1.5)*m.ty.scale+0.25, near=clamp(dp/4,0.5,1);
  if(m.sleep){ for(let k=0;k<2;k++){ const q=(t*0.45+k*0.5)%1; dyn(m.x+q*0.25,y+q*0.45,m.z,G('z'),(0.16+0.1*(1-q))*(k?0.8:1),0.55*(1-q)*near,0.6*(1-q)*near,1.0*(1-q)*near); } }
  else if(m.noticed){ const pop=1+Math.max(0,1-m.mark*3)*0.6; dyn(m.x,y+Math.sin(t*6)*0.03,m.z,G('!'),0.36*pop,2.4*near,0.55*near,0.3*near); }
  else if(m.aware>0.35){ dyn(m.x,y+Math.sin(t*3)*0.04,m.z,G('?'),0.32,2.0*near,1.7*near,0.5*near); }
}
const lerpAngle=(a,b,k)=>{ let d=b-a; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return a+d*k; };
const flyOpen=(x,z)=>{ const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL); if(cx<0||cz<0||cx>=MW||cz>=MH)return false; const tt=D.tile[cz*MW+cx]; return tt!==TW&&tt!==TX; };
const mname=m=>`<span style="color:${css(m.ty.col)}">${m.ty.name}（${m.ty.ch}）</span>`;
