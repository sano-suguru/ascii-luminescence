// ---------------------------------------------------------------- level control
let expo=1.1;
adv.runSeed=(Math.random()*1e9)>>>0;
// levelSeed は src/lib/levels.ts（src/game/imports.mjs で読む）
// setFog は src/lib/build.ts（src/game/imports.mjs で読む）
// showStratum は src/lib/levels.ts（src/game/imports.mjs で読む）
// settleSlotPick は src/lib/levels.ts（src/game/imports.mjs で読む）
// newLevel は src/lib/levels.ts（src/game/imports.mjs で読む）
// checkEvents は src/lib/levels.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- player
// 薄い氷に乗っていた秒 iceT は src/lib/state.ts、氷が割れる crackIce・背の高い茂みか tallAt・踏み分ける trample・硫黄が燃え上がる brimFlare は src/lib/ground.ts（src/game/imports.mjs で読む）
function regrow(){ if(!blaze.trampled.length)return; const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL); let ch=false;
  blaze.trampled=blaze.trampled.filter(([i,t0])=>{ if(clock.time-t0>45&&i!==pc&&blaze.cellFlag[i]===20){ blaze.cellFlag[i]=0; ch=true; return false; } return blaze.cellFlag[i]===20; }); if(ch)uploadCells(); }
// 硫黄が戻るまでの秒 brimT は src/lib/state.ts の blaze（src/game/imports.mjs で読む）
function brimRecover(dt){ blaze.brimT+=dt; if(blaze.brimT<2)return; blaze.brimT=0; let ch=false; for(let i=0;i<NCELL;i++){ if(here.D.surface[i]===SF_BRIM&&(blaze.burnt[i]||blaze.fuel[i]<=0)&&blaze.fire[i]<=0&&mr()<0.08){ /* burnt, or swept by a cleaner (no ash, no fuel) */ blaze.burnt[i]=0; blaze.fuel[i]=0.8; ch=true; } } if(ch)uploadCells(); }
// ---------------------------------------------------------------- hidden traps, a lever-and-portcullis vault, sanctuaries (mechanisms after Brogue's machines; written independently)
// TRAP_INFO は src/lib/names.ts（src/game/imports.mjs で読む）
function triggerTrap(tr){
  tr.used=true; tr.hidden=false; const [x,z]=cpos(tr.i), info=TRAP_INFO[tr.type], tag=`<b style="color:${info[1]}">^</b>`;
  switch(tr.type){
    case 'alarm': sAlarm(x,z); vfx.shake=Math.max(vfx.shake,0.2); msg(tag+'カチリ……鐘の音が響き渡った！ 辺りの獣が集まってくる。');
      for(const m of here.monsters){ if(m.ty.critter||m.dead)continue; if(Math.hypot(m.x-x,m.z-z)<32){ m.sleep=false; m.aware=Math.max(m.aware,0.8); m.goal=[x,z]; m.goalT=clock.time+15; } } break;
    case 'trapdoor': sRumble(0.5,1.2); vfx.shake=Math.max(vfx.shake,0.4); msg(tag+'床が抜けた！ 闇の中を、下の階へと落ちていく……'); here.trans={phase:'out',t:0,regen:false}; player.fall=true; break;
    case 'net': player.netT=3.2; sHiss(x,z,0.5); msg(tag+'網が降ってきた！ もがいて抜け出そうとする……'); break;
    case 'flood': sSplash(0.5); msg(tag+'床の穴から、水が勢いよく噴き出した！'); here.events.push({type:'flood',ri:-2,order:tr.order.slice(),src:tr.i,state:1,t:0,k:0,max:tr.order.length*3}); break;
    case 'methane': sHiss(x,z,1.2); msg(tag+'床の穴から、沼のガスが噴き出した。火気に注意！');
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){ const j=tr.i+dx+dy*MW; if(j>=0&&j<NCELL&&here.D.tile[j]!==TW&&Math.hypot(dx,dy)<=2.3)here.D.gas[j]=Math.max(here.D.gas[j],0.9); } blaze.gasAny=true; break;
  }
}
function updateTraps(dt){
  for(const tr of (here.D.traps||[])){
    const [x,z]=cpos(tr.i), d=Math.hypot(x-player.x,z-player.z);
    if(tr.hidden&&d<CELL*1.3){ const mv=Math.hypot(player.vx,player.vz)>0.3, rate=(stealth.sneak?1.1:0.3)*(mv?0.6:1.6);
      if(mr()<dt*rate){ tr.hidden=false; sChime(x,z,0.15); msg(`<b style="color:${TRAP_INFO[tr.type][1]}">^</b>隠された${TRAP_INFO[tr.type][0]}罠を見つけた。踏まないように気をつけよう。`); } }
    if(!tr.used&&d<0.6&&!here.trans)triggerTrap(tr);
  }
  if(player.netT>0){ const mv=keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD; player.netT-=dt*(mv?1.6:1); if(player.netT<=0)msg('網から抜け出した。'); }
  const G2=here.D.gate;
  if(G2&&!G2.open){ const [lx,lz]=cpos(G2.lever); if(Math.hypot(player.x-lx-G2.ld[0]*0.6,player.z-lz-G2.ld[1]*0.6)<1.1){ G2.open=true; G2.pulled=clock.time; sCreak(lx,lz); const [gx,gz]=cpos(G2.cell); setTimeout(()=>sRumble(0.25,1.6),500); msg('<b style="color:#ffd48a">/</b>壁のレバーを引いた。どこか遠くで、鉄格子が軋みながら上がっていく音がした。'); } }
  if(G2)G2.o+=((G2.open?1:0)-G2.o)*Math.min(1,dt*0.8);
}
// 罠と鉄格子を描く drawTraps は src/lib/fixtures.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- life and death, and plain real-time melee
// 生き物の強さ statOf は src/lib/monsters.ts（src/game/imports.mjs で読む）。強さの表 MSTAT は src/lib/creatures.ts（statOf だけが読む）
// WEAPON・SLEEP_MULT は src/lib/runes.ts（src/game/imports.mjs で読む）
// roll は src/lib/random.ts（src/game/imports.mjs で読む）
// 敵か hostile・攻撃の的にしてよいか foe は src/lib/monsters.ts、攻撃が当たる生き物か hittable は src/lib/aim.ts（src/game/imports.mjs で読む）
// angDiff は src/lib/math.ts（古い JS は使わない。src/lib/ の生成などが使う）
// expNeed・expOf は src/lib/progress.ts（src/game/imports.mjs で読む）
// serRune は src/lib/runes.ts（src/game/imports.mjs で読む）
// 生き物の体力を初めの値にする initMonsterLife は src/lib/monsters.ts（古い JS は読まない。makeMonster が呼ぶ）
// ---------------------------------------------------------------- levelling: defeating creatures gives experience; at each level time stops and you choose one of three
// (two blessings - strengths tied to actions and elements, some with a price - and one rune or charm). Max health does not grow with level: it grows by 4 on entering each new stratum.
let lvlOpenT=0, lvlOpts=[];
// BLESS は src/lib/progress.ts、加護の段 BL は src/lib/monsters.ts（src/game/imports.mjs で読む）
// coldSnap は src/lib/combat.ts（src/game/imports.mjs で読む）
// gainExp は src/lib/combat.ts（src/game/imports.mjs で読む）
// the choices come from their own random, made from the run's seed and which level this is (keyedRand), not the look random (mr): same seed, same choices. r is for tests
function levelChoices(r=keyedRand('levelup',adv.runSeed,adv.lvl.n-adv.lvl.pending+1)){ const BEHAVE=['quickdodge','counter','momentum','devour','shatter','charge','swapedge','branch']; let pool=Object.keys(BLESS).filter(k=>BL(k)<2&&!lockedOf('bless',k)), out=[];
  if(!adv.lvl.firstDone){ const b=pool.filter(k=>BEHAVE.includes(k)); if(b.length>=2)pool=b; adv.lvl.firstDone=true; }
  for(let i=0;i<2&&pool.length;i++){ const k=pool.splice(Math.floor(r()*pool.length),1)[0]; out.push({kind:'bless',k}); }
  const useCharm=(adv.runState.bodyOpen||0)>0&&r()<0.3, t=useCharm?RUNE_TYPES.body[Math.floor(r()*RUNE_TYPES.body.length)]:randomRuneType(r,{elem:0.45,trig:0.15,mod:0.4,body:0});
  out.push({kind:'rune',ru:RUNE_DEF[t].cat==='mod'&&r()<0.1?makeStrong(t):makeRune(t)}); return shuffle(out,r); }
function lvlLine(o){ const K=t=>t+' '.repeat(Math.max(2,14-visW(t))); // the label column is 14 wide (the longest, 恩恵（代償）, is 12)
  if(o.kind==='bless'){ const B=BLESS[o.k], l=BL(o.k)+1; return `${K(B.cost?'恩恵（代償）':'恩恵')}<span style="color:${B.cost?'#ff9a8a':'#ffe3a0'}">${B.name}${l>1?' II':''}</span>`; }
  const d=RUNE_DEF[o.ru.type], br=CAT_BR[d.cat]||['','']; return `${K(d.cat==='body'?'護符':'ルーン')}${br[0]}<b class="rn" style="color:${css(runeCol(o.ru))}">${d.ch}</b> ${runeName(o.ru)}${br[1]}　<span class="lab">${CAT_NAME[d.cat]}</span>`; }
function renderLevelUp(){ const el=document.getElementById('altarp'); if(!el)return; const f=t=>`<span class="f">${t}</span>`, rows=[f(`+-- レベルが上がった（Lv${adv.lvl.n-adv.lvl.pending+1}） ---`),f('|')];
  lvlOpts.forEach((o,i)=>rows.push(`${f('|')}  <button class="row ao" data-lk="${i}">${clipHtml(lvlLine(o),ALTAR_W-6)}</button>`));
  rows.push(f('|')); for(let i=0;i<4;i++)rows.push(`${f('|')} <span class="ldet">${padTo('',ALTAR_W-3)}</span>`);
  rows.push(f('|'),`${f('|')} <span class="lab">マウスを乗せると説明が出る。クリックで選ぶ</span>`,f('+---')); el.innerHTML=boxText(rows,ALTAR_W); setLevelDetail(null);
  if(!el.dataset.lvBound){ el.dataset.lvBound='1'; el.addEventListener('mouseover',e=>{ if(!ui.lvlOpen)return; const b=e.target.closest&&e.target.closest('button[data-lk]'); setLevelDetail(b?lvlOpts[+b.dataset.lk]:null); }); el.addEventListener('click',e=>{ if(!ui.lvlOpen)return; const b=e.target.closest&&e.target.closest('button[data-lk]'); if(!b)return; e.stopPropagation(); if(performance.now()-lvlOpenT<400)return; chooseLevel(+b.dataset.lk); }); } }
function setLevelDetail(o){ const el=document.getElementById('altarp'); if(!el)return; let L;
  if(!o)L=['<span class="lab">選択肢にマウスを乗せると、ここに説明が出る</span>','','',''];
  else if(o.kind==='bless'){ const B=BLESS[o.k], l=BL(o.k)+1, w=wrapPlain(B.d(l),ALTAR_W-10); L=[`<span style="color:${B.cost?'#ff9a8a':'#ffe3a0'}">${B.name}${l>1?' II（2回目で強まる）':''}</span>　<span class="lab">（恩恵${B.cost?'・代償あり':''}）</span>`,...w.slice(0,3).map(t=>`    <span class="lab">${t}</span>`)]; }
  else L=detailLines(o.ru).slice(0,4);
  el.querySelectorAll('.ldet').forEach((sp,i)=>{ sp.innerHTML=padTo(clipHtml(L[i]||'',ALTAR_W-4),ALTAR_W-3); }); }
function openLevelUp(){ const el=document.getElementById('altarp'); if(!el||ui.lvlOpen)return; ui.lvlOpen=true; lvlOpenT=performance.now(); lvlOpts=levelChoices(); document.body.classList.toggle('paused',true);
  if(gear.castSt){ gear.castSt=null; fight.beamSegs=[]; } if(ui.locked&&document.exitPointerLock)document.exitPointerLock(); renderLevelUp(); el.classList.add('show','open'); }
function chooseLevel(i){ const o=lvlOpts[i]; if(!o)return;
  if(o.kind==='bless'){ adv.lvl.bless[o.k]=BL(o.k)+1; if(o.k==='tough'){ adv.PLAYER_MAX+=6; player.hp=Math.min(adv.PLAYER_MAX,player.hp+6); } msg(`<b style="color:#ffe3a0">+</b>恩恵「${BLESS[o.k].name}」を得た。${BLESS[o.k].d(BL(o.k))}。`); }
  else takeRune(o.ru);
  adv.lvl.pending=Math.max(0,adv.lvl.pending-1); renderStatus(); renderHotbar();
  if(adv.lvl.pending>0){ lvlOpenT=performance.now(); lvlOpts=levelChoices(); renderLevelUp(); return; }
  ui.lvlOpen=false; const el=document.getElementById('altarp'); if(el)el.classList.remove('show','open'); document.body.classList.toggle('paused',isPaused()); if(!ui.plFailed&&ui.started&&!adv.dead)tryLock(); updateResume(); }
// strataGrowth は src/lib/levels.ts（src/game/imports.mjs で読む）
// hurtPlayer は src/lib/combat.ts（src/game/imports.mjs で読む）
// resultPlace は src/lib/results.ts（src/game/imports.mjs で読む）
// runLore は src/lib/results.ts（src/game/imports.mjs で読む）
// awardLore は src/lib/results.ts（src/game/imports.mjs で読む）
// loreRows は src/lib/results.ts（src/game/imports.mjs で読む）
// 墓のルーンを作る graveRune は src/lib/gear.ts（祭壇などを置く src/lib/altars.ts が使う）
// graveCandidates は src/lib/results.ts（src/game/imports.mjs で読む）
// saveGrave は src/lib/results.ts（src/game/imports.mjs で読む）
// graveRows は src/lib/results.ts（src/game/imports.mjs で読む）
// die は src/lib/levels.ts（src/game/imports.mjs で読む）
// newRun は src/lib/levels.ts（src/game/imports.mjs で読む）
// hitReact は src/lib/combat.ts（src/game/imports.mjs で読む）
// damageMonster は src/lib/combat.ts（src/game/imports.mjs で読む）
function playerAttack(){
  if(adv.dead||!ui.started||here.trans||(player.atkCd||0)>0||player.netT>0)return;
  player.atkCd=WEAPON.cd; player.swing=0.22; sWhoosh();
  let best=null, bd=1e9; const [vx,vy,vz]=viewDir(), [ox,oy,oz]=aimOrigin();
  for(const m of here.monsters){ if(m.dead||m.ty.peaceful||(m.ty.critter&&!m.hidden&&m.ty.critter!=='mimic'))continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; if(m.ty.habitat==='bog'&&(m.rise||0)<0.3)continue;
    const sc=m.ty.scale, cy=m.hidden?m.y+1.3:m.y+(m.ty.flier?0:0.6*sc), ax=m.x-ox, ay=cy-oy, az=m.z-oz, d=Math.hypot(ax,ay,az);
    if(Math.hypot(m.x-player.x,m.z-player.z)>WEAPON.reach+0.35*sc)continue;
    const cosA=(ax*vx+ay*vy+az*vz)/Math.max(d,1e-3), tol=0.42+Math.atan2(0.5*sc,Math.max(d,0.5));
    const ang=Math.acos(clamp(cosA,-1,1)); if(ang>tol)continue; if(ang<bd){bd=ang;best=m;} }
  if(!best)return;
  best.playerT=clock.time; damageMonster(best,roll(WEAPON.min,WEAPON.max),'blade');
}
function updateLife(dt){
  if(adv.dead)return;
  player.atkCd=Math.max(0,(player.atkCd||0)-dt); player.swing=Math.max(0,(player.swing||0)-dt);
  updateRally(dt);
  if(Math.round(player.hp)!==adv.hpShown){ adv.hpShown=Math.round(player.hp); renderStatus(); }
  vfx.hurtFlash=Math.max(0,vfx.hurtFlash-dt*1.6);
  // fire hurts whoever stands in it
  const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL);
  player.fireT=(player.fireT||0)+dt; if(player.fireT>0.5){ player.fireT=0; if(blaze.fire[pc]>0.1)hurtPlayer(2,'炎');
    for(const m of here.monsters){ if(m.dead||m.ty.critter||m.ty.habitat==='lava')continue; const ci=m.cz*MW+m.cx; if(blaze.fire[ci]>0.1&&!m.ty.flier)damageMonster(m,3,'fire'); } }
}
// monsterStrike は src/lib/combat.ts（src/game/imports.mjs で読む）
// the blade swing in front of the camera
