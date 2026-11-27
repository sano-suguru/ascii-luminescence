// ---------------------------------------------------------------- 主を倒すと、その場に主の祭壇が立つ（深さ1の台・最初の祭壇・階ごとの祭壇・石碑を置くのは src/lib/altars.ts の placeRunesForLevel）
// dropRune は src/lib/combat.ts（src/game/imports.mjs で読む）
// ---------------------------------------------------------------- 祭壇
// 祭壇の中身 altarFill・番人が生きているか guardedNow・祭壇を置く placeAltar・宝物庫のまわり vaultArea・祭壇の画面の1行 altarLine・
// 階ごとに祭壇とルーンを置く placeRunesForLevel は src/lib/altars.ts（src/game/imports.mjs で読む）。
// 番人を置く・鍛え方・泉を置く・石碑のそばか nearStele など、ほかの祭壇の処理も src/lib/altars.ts にある（古い JS は読まない）
// the treasury's prize: taking it wakes guardians, or brings the ceiling down
// 宝物庫の褒美を取った時 vaultSprung と落石 updateRockfall（落石の状態は src/lib/state.ts の fight.rockfall）は src/lib/pickup.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- healing: no regeneration over time. Part of each wound lingers as recoverable (shown on the bar); strike back before it fades
// and the light of what you strike flows into you; a kill gives more. Altars, a little on going down, healing springs, and the town and the oracle heal.
// RALLY_FROM は src/lib/runes.ts（src/game/imports.mjs で読む）
// rallyOnHit は src/lib/combat.ts（src/game/imports.mjs で読む）
// 立ち直りを進める updateRally は src/lib/combat.ts（src/game/imports.mjs で読む）
// 癒しの泉を描く drawSprings は src/lib/fixtures.ts、泉を置く placeSpring は src/lib/altars.ts（src/game/imports.mjs で読む）

// 足元の物を拾う pickupItems と、物を取る grabItem は src/lib/pickup.ts（src/game/imports.mjs で読む）
// 拾ったルーンを手か袋に入れる（takeRune・placeChosen・mergeMod）・行き先の名前 runeDest・祭壇の画面の説明 altarDetail と選択肢 altarOpts は src/lib/altars.ts（src/game/imports.mjs で読む）
// 祭壇の画面：灯った祭壇の近くで、3つの選択肢を並べる。クリックで選ぶ。開いている間は、ゲームが止まる
let altarPanelKey='', altarSel=null, altarAim=-1, altarDismissed=null;
// ALTAR_W は src/lib/hud.ts（src/game/imports.mjs で読む）
function renderAltar(){ const el=document.getElementById('altarp'); if(!el)return; const opts=altarOpts(); if(!opts.length){ closeAltar(false); return; }
  const f=t=>`<span class="f">${t}</span>`, rows=[f(opts[0].lord?'+-- 主の祭壇 ---':opts[0].opt==='open'?'+-- 空の枠 ---':opts[0].forge?'+-- 鍛えの祭壇 ---':'+-- ルーンの祭壇 ---'),f('|')];
  for(const o of opts)rows.push(`${f('|')}  <button class="row ao" data-k="${o.slot}">${clipHtml(altarLine(o),ALTAR_W-6)}</button>`);
  rows.push(f('|'));
  for(let i=0;i<5;i++)rows.push(`${f('|')} <span class="adet">${padTo('',ALTAR_W-3)}</span>`);
  rows.push(f('|'),`${f('|')} <span class="lab">${byInput('クリックで選ぶ　Esc・右クリックでやめる','1回押すと説明、もう1回で決まる')}</span>　<button class="row" data-cancel="1">[やめる]</button>`);
  if(opts[0].opt!=='open'&&!opts[0].forge)rows.push(`${f('|')} <span class="lab">ルーンは袋に入る。祭壇のそばでは、${byInput('Tab','[装備]')} の付け替えに詠唱はいらない</span>`);
  rows.push(f('+---'));
  el.innerHTML=boxText(rows,ALTAR_W); setAltarDetail(null);
  if(!el.dataset.bound){ el.dataset.bound='1';
    el.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('button'); if(!b||!ui.altarOpen)return; e.stopPropagation();
      if(b.dataset.cancel){ closeAltar(true); return; }
      // 指なら、1回目は選んで説明を出すだけ、2回目で決める（レベルアップの画面と同じ。18-level-player.js）
      if(b.dataset.k!==undefined&&!confirmTap('altar'+altarOpenT+':'+b.dataset.k)){ setAltarDetail(altarOpts().find(o=>o.slot===+b.dataset.k)); el.querySelectorAll('button.armed').forEach(x=>x.classList.remove('armed')); b.classList.add('armed'); return; }
      if(b.dataset.k!==undefined)chooseAltar(+b.dataset.k); });
    el.addEventListener('mouseover',e=>{ if(!ui.altarOpen||ui.touch)return; const b=e.target.closest&&e.target.closest('button[data-k]'); setAltarDetail(b?altarOpts().find(o=>o.slot===+b.dataset.k):null); });
    el.addEventListener('contextmenu',e=>{ e.preventDefault(); if(ui.altarOpen)closeAltar(true); }); } }
function setAltarDetail(o){ const el=document.getElementById('altarp'); if(!el)return; const L=altarDetail(o); el.querySelectorAll('.adet').forEach((sp,i)=>{ sp.innerHTML=padTo(clipHtml(L[i]||'',ALTAR_W-4),ALTAR_W-3); }); }
// 祭壇の画面を開いた時刻（指で選ぶ時の、開くたびに変わる鍵。confirmTap）
let altarOpenT=0;
function openAltar(){ const el=document.getElementById('altarp'); if(!el)return; ui.altarOpen=true; altarOpenT=performance.now(); document.body.classList.toggle('paused',true); document.body.classList.add('choosing');
  if(gear.castSt){ gear.castSt=null; fight.beamSegs=[]; } if(ui.locked&&document.exitPointerLock)document.exitPointerLock(); renderAltar(); el.classList.add('show','open'); renderHotbar(); }
function closeAltar(dismiss){ const el=document.getElementById('altarp'); ui.altarOpen=false; if(dismiss)altarDismissed=ui.altarNear; if(el)el.classList.remove('show','open'); document.body.classList.toggle('paused',isPaused()); document.body.classList.toggle('choosing',ui.lvlOpen);
  if(!ui.plFailed&&ui.started&&!adv.dead)tryLock(); updateResume(); }
function updateAltarPanel(){ const el=document.getElementById('altarp'); if(!el)return; if(ui.lvlOpen)return; if(adv.lvl.pending>0&&ui.started&&!adv.dead&&!isPaused()){ openLevelUp(); return; }
  if(ui.altarOpen){ if(!here.D||!ui.started||adv.dead||!altarOpts().length)closeAltar(false); return; }
  ui.altarNear=null;
  if(ui.started&&!adv.dead&&!isPaused()&&here.D){ let best=null, bd=1.5; for(const it of (here.D.items||[])){ if(it.taken||!it.altar||!it.rune||it.slot!==1)continue; if(it.guardG!==undefined&&guardedNow(it))continue; const [x,z]=cpos(it.i), d=Math.hypot(x-player.x,z-player.z); if(d<bd){ bd=d; best=it; } } if(best)ui.altarNear=best.grp; }
  // 止まっている間（装備の画面・メニューなど）は、近くの祭壇が無いことにするが、閉じた記録は消さない（離れるまで開かない）
  if(!ui.altarNear){ if(!(ui.started&&!adv.dead&&here.D&&isPaused()))altarDismissed=null; if(el.classList.contains('show'))el.classList.remove('show','open'); return; }
  if(altarDismissed===ui.altarNear)return;
  openAltar(); }
function chooseAltar(n){ if(!ui.altarNear)return false; const k=here.D.items.findIndex(o=>o.grp===ui.altarNear&&o.slot===n&&!o.taken); if(k<0)return false; const it=here.D.items[k];
  const [x,z]=cpos(it.i); if(!it.opt||it.opt==='rune')grabItem(it,k,x+(it.slot-1)*0.55,z,'bag'); else grabItem(it,k,x+(it.slot-1)*0.55,z); altarSel=null; altarPanelKey=''; if(ui.altarOpen)closeAltar(false); return true; }
function altarPlace(dest){ if(!altarSel)return false; const k=here.D.items.findIndex(o=>o.grp===altarSel.grp&&o.slot===altarSel.slot&&!o.taken); altarSel=null; altarPanelKey=''; if(k<0)return false; const it=here.D.items[k], [x,z]=cpos(it.i); grabItem(it,k,x+(it.slot-1)*0.55,z,dest); return true; }

