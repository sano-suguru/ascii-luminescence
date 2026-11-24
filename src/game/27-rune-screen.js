// ---------------------------------------------------------------- the rune screen, fixed in size: built once per change; hovering and choosing only touch the detail lines and the slot highlights
// CAT_BR・CAT_NAME・emptyChip は src/lib/runes.ts（src/game/imports.mjs で読む）
// PACK_W・PACK_SLOT・BAG_LINES は src/lib/hud.ts（src/game/imports.mjs で読む）
let packHover=null, packClick={u:0,t:0}, bagPage={atk:0,elem:0,trig:0}, bagPageN={atk:1,elem:1,trig:1};
// padTo・wrapPlain は src/lib/text.ts（src/game/imports.mjs で読む）
// reactionOf は src/lib/runes.ts（古い JS は使わない）
function runeChip(ru,attrs){ const d=RUNE_DEF[ru.type], br=CAT_BR[d.cat]||['',''];
  if(d.cat==='atk')return `<button class="row rs" data-u="${ru.uid}" ${attrs}><span class="mk"> </span><span${weaponCol(ru)?` style="color:${weaponCol(ru)}"`:''}>${d.name}</span></button>`;
  return `<button class="row rs" data-u="${ru.uid}" ${attrs}><span class="mk"> </span>${br[0]}<b class="rn" style="color:${css(runeCol(ru))}">${d.ch}</b> <span${ru.strong?` style="color:${css(TIER_COL[3])}"`:''}>${runeShort(ru)}</span>${br[1]}</button>`; }
// what a hand will do: its elements, resonance, trigger, and changes that do not work with its weapon
function handSummary(h){ const H=effHand(h); syncHand(H); const rs=handRunes(H), els=[...new Set(rs.filter(r=>RUNE_DEF[r.type].cat==='elem').map(r=>r.type))], parts=[];
  const w=H.atk?RUNE_DEF[H.atk.type].name:'素手';
  const nm=t=>{ const n=elemCount(H,t); return RUNE_DEF[t].name+(n>1?`×${n}（${Math.round(ELEM_POW[Math.min(4,n)]*100)}%）`:''); };
  if(els.length===2)parts.push(`${nm(els[0])}と${nm(els[1])}を、交互に撃つ${w}`);
  else if(els.length===1){ const n=elemCount(H,els[0]); parts.push(`${RUNE_DEF[els[0]].pre}${w}`+(n>1?`（${RUNE_DEF[els[0]].name} ×${n}：${Math.round(ELEM_POW[Math.min(4,n)]*100)}%）`:'')); }
  else parts.push(w);
  if(H.trig)parts.push(`${RUNE_DEF[H.trig.type].name}、ひとりでに撃つ`);
  const no=rs.filter(r=>RUNE_DEF[r.type].cat==='mod'&&!modWorks(RUNE_DEF[r.type].mk,H)).map(r=>runeName(r)); if(no.length)parts.push(`<span class="dim">${no.join('・')}はこの手には効かない</span>`);
  return parts.join('　'); }
const handResult=h=>{ const H=hands[h]; return (H.trig?`${RUNE_DEF[H.trig.type].name}：`:'')+handName(H); };
function detailLines(ru){ const W=PACK_W-4;
  if(!ru)return ['<span class="lab">武器・ルーン・護符にマウスを乗せると、ここに説明が出る</span>','','','',''];
  const d=RUNE_DEF[ru.type], desc=wrapPlain(d.desc,W-4), g=`<b class="rn" style="color:${css(runeCol(ru))}">${d.ch}</b>`;
  if(d.cat==='atk'){ const tr=trList(ru); return [`${d.name}　<span class="lab">（${d.wk||'武器'}・${d.chant>0?`詠唱 ${d.chant}秒`:'詠唱なし'}）</span>`,`    <span class="lab">攻撃　${d.desc}</span>`,...[0,1,2].map(i=>tr[i]?`    <span style="color:${css(TIER_COL[1])}">特性　${trName(ru.type,tr[i])} Lv${tr[i].lv}</span><span class="lab">：${trDesc(ru.type,tr[i])}</span>`:(i===0?'    <span class="dim">特性なし</span>':''))]; }
  if(d.cat==='body')return [`${g} ${d.name}`,`    <span class="lab">${desc[0]||''}</span>`,`    <span class="lab">${desc[1]||''}</span>`,`    <span class="dim">同じ護符を二つ着けると、効果が重なる</span>`,`    <span class="lab">着ける所：身の護符の枠（開いている枠だけ。どのビルドでも共通）</span>`];
  if(d.cat==='mod')return [`${g} ${runeName(ru)}　<span class="lab">（効き方のルーン${ru.strong?'・強い版':''}）</span>`,`    <span class="lab">${desc[0]||''}</span>`,`    <span class="lab">${desc[1]||''}</span>`,`    <span class="dim">効くもの：${modTargets(d.mk)}</span>`,`    <span class="lab">はめる所：手のルーンの枠（同じ変化は1つの手に2つまで）</span>`];
  return [`${g} ${d.name}のルーン　<span class="lab">（${CAT_NAME[d.cat]}）</span>`,`    <span class="lab">${desc[0]||''}</span>`,`    <span class="lab">${desc[1]||''}</span>`,d.cat==='trig'?'':`    <span class="dim">2種類なら交互に撃つ。同じ性質を重ねると強まる</span>`,`    <span class="lab">はめる所：手のルーンの枠（${d.cat==='trig'?'発動は1つの手に1つまで':'性質は1つの手に2種類まで'}）</span>`]; }
function setPackDetail(ru){ const el=document.getElementById('pack'); if(!el)return; const L=detailLines(ru);
  el.querySelectorAll('.pdet').forEach((sp,i)=>{ sp.innerHTML=padTo(clipHtml(L[i]||'',PACK_W-3),PACK_W-2); }); }
// choosing only changes marks and highlights
function updatePackSel(){ const el=document.getElementById('pack'); if(!el)return;
  el.querySelectorAll('button.rs').forEach(b=>{ const u=+b.dataset.u||0, mk=b.querySelector('.mk'); if(mk)mk.innerHTML=(packSel&&u&&packSel.ru.uid===u)?'&gt;':' ';
    b.classList.toggle('sel',!!(packSel&&u&&packSel.ru.uid===u)); if(b.dataset.s){ const ok=!!packSel&&slotAccepts(b.dataset.h,b.dataset.s,packSel.ru); b.classList.toggle('can',ok); b.classList.toggle('dimmed',!!packSel&&!ok); } });
  setPackDetail(packHover||(packSel&&packSel.ru)); }
function renderInv(){
  const el=document.getElementById('pack'); if(!el||!hands)return; const f=t=>`<span class="f">${t}</span>`, W=PACK_SLOT;
  const slot=(h,s)=>{ const ru=slotGet(h,s);
    if(s!=='atk'&&+s.slice(1)>=(hands[h].slotN||2))return padTo(` <span class="dim">· 閉じ</span>`,W);
    return padTo(ru?runeChip(ru,`data-h="${h}" data-s="${s}"`):emptyChip(s==='atk'?'atk':'rune',`data-h="${h}" data-s="${s}"`),W); };
  if(!hands.B)hands.B={b0:null,b1:null};
  const bslot=i=>{ const s='b'+i, ru=hands.B[s]; if(i>=(runState.bodyOpen||0))return padTo(` <span class="dim">" 閉じ</span>`,W); return padTo(ru?runeChip(ru,`data-h="B" data-s="${s}"`):emptyChip('body',`data-h="B" data-s="${s}"`),W); };
  const bodyFx=[0,1].slice(0,runState.bodyOpen||0).map(i=>hands.B['b'+i]).filter(Boolean).map(r=>RUNE_DEF[r.type].name).join('・');
  const rows=[f('+-- 装備 ---'),`${f('|')}        ${padTo(' <span class="lab">武器</span>',W)}<span class="lab"> ルーン（性質は2つまで、発動は1つまで、同じ変化は2つまで）</span>`];
  const two=isTwo();
  for(const h of ['L','R']){ const wcell=two&&h==='R'?padTo(' <span class="dim">（両手）</span>',W):slot(h,'atk'); rows.push(`${f('|')} ${two?(h==='L'?'両手':'　　'):(h==='L'?'左手':'右手')}   ${wcell}${slot(h,'s0')}${slot(h,'s1')}${slot(h,'s2')}${slot(h,'s3')}`); if(!two||h==='R')rows.push(`${f('|')}        `+clipHtml(`<span class="lab">→ ${handSummary(h)}</span>`,PACK_W-11)); }
  if(two)rows.push(`${f('|')}        <span class="dim">両手で持つ間、両手のルーンの枠は合わせて${TWO_SLOTS}つまで使える</span>`);
  rows.push(`${f('|')} 身     ${bslot(0)}${bslot(1)}${padTo('',W)} <span class="lab">→</span> ${bodyFx||'<span class="dim">護符なし</span>'}`);
  rows.push(f('|'),`${f('|')} 袋`);
  for(const cat of ['atk','elem','trig','mod','body']){ const list=bag.filter(r=>RUNE_DEF[r.type].cat===cat).sort((a,b)=>runeTier(b)-runeTier(a)||a.type.localeCompare(b.type));
    // pages of BAG_LINES lines each; the last line keeps room for the page buttons
    const head=`${f('|')}   <span class="lab">${CAT_NAME[cat]}</span>  `, cont=`${f('|')}         `, lim=PACK_W-6, pagerW=16;
    const pages=[]; let cur=[], li=0, lw=visW(head);
    for(const r of list){ const c=runeChip(r,`data-b="${r.uid}"`), cw=visW(c)+1, cap=lim-(li===BAG_LINES-1?pagerW:0);
      if(lw+cw>cap){ li++; lw=visW(cont); if(li>=BAG_LINES){ pages.push(cur); cur=[]; li=0; lw=visW(head); } }
      cur.push({c,li}); lw+=cw; }
    if(cur.length||!pages.length)pages.push(cur);
    const n=pages.length, p=Math.min(bagPage[cat]||0,n-1); bagPage[cat]=p; bagPageN[cat]=n;
    const lines=Array.from({length:BAG_LINES},(_,k)=>k===0?head:cont);
    for(const it of pages[p])lines[it.li]+=it.c+' ';
    if(!list.length)lines[0]+='<span class="dim">-</span>';
    if(n===1){ const usedL=Math.max(1,...pages[p].map(it=>it.li+1)); lines.length=usedL; }
    if(n>1)lines[BAG_LINES-1]=padTo(lines[BAG_LINES-1],lim-pagerW+3)+`<button class="row" data-pg="${cat}:-1">[&lt;]</button> ${p+1}/${n} <button class="row" data-pg="${cat}:1">[&gt;]</button>`;
    rows.push(...lines); }
  rows.push(f('|'));
  for(let i=0;i<5;i++)rows.push(`${f('|')} <span class="pdet">${padTo('',PACK_W-2)}</span>`);
  rows.push(f('|'));
  for(const k of (unlocked('build3')?[0,1,2]:[0,1])){ const b=builds[k]; rows.push(`${f('|')} ビルド${k+1} <button class="row" data-save="${k}">[保存]</button> <button class="row${b?'':' off'}" data-load="${k}">[呼び出す]</button>  <span class="lab">${b&&b.label?b.label:'-'}</span>`); }
  rows.push(f('|'),`${f('|')} <span class="lab">選んで、光る枠をクリック　ダブルクリックで自動ではめる　右クリックで取り消し</span>`,`${f('|')} <span class="lab">閉じると付け替えの詠唱（約1.5秒）。石碑のそばなら一瞬</span>`,f('+---'));
  el.innerHTML=boxText(rows,PACK_W);
  updatePackSel();
  if(!el.dataset.bound){ el.dataset.bound='1';
    el.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('button'); 
      if(!b){ if(packSel){ packSel=null; updatePackSel(); } return; }
      e.stopPropagation();
      if(b.dataset.pg){ const [cat,d]=b.dataset.pg.split(':'), n=bagPageN[cat]||1; bagPage[cat]=((bagPage[cat]||0)+(+d)+n)%n; renderInv(); return; }
      if(b.dataset.h){ packSlot(b.dataset.h,b.dataset.s); return; }
      if(b.dataset.b){ const u=+b.dataset.b, ru=bag.find(r=>r.uid===u); if(!ru)return;
        if(packClick.u===u&&performance.now()-packClick.t<600){ packClick={u:0,t:0}; autoEquip(ru); renderInv(); renderHotbar(); return; }
        packClick={u,t:performance.now()}; packSel={ru,from:'bag'}; updatePackSel(); return; }
      if(b.dataset.save!==undefined){ const k=+b.dataset.save, u=r=>r?r.uid:0;
        builds[k]={L:{atk:u(hands.L.atk),slots:hands.L.slots.map(u)},R:{atk:u(hands.R.atk),slots:hands.R.slots.map(u)},label:`${handResult('L')} / ${handResult('R')}`}; buildIdx=k; sChime(player.x,player.z,0.2); renderInv(); return; }
      if(b.dataset.load!==undefined){ const k=+b.dataset.load; if(builds[k]){ applyBuild(k); packSel=null; renderInv(); renderHotbar(); } } });
    el.addEventListener('mouseover',e=>{ const b=e.target.closest&&e.target.closest('button[data-u]'), ru=b?allRunes().find(r=>r.uid===+b.dataset.u)||null:null; if(ru!==packHover){ packHover=ru; setPackDetail(packHover||(packSel&&packSel.ru)); } });
    el.addEventListener('mouseleave',()=>{ if(packHover){ packHover=null; setPackDetail(packSel&&packSel.ru); } });
    el.addEventListener('contextmenu',e=>{ e.preventDefault(); if(packSel){ packSel=null; updatePackSel(); } }); }
}
function equipWeapon(h,ru){ const out=[]; if(isTwo()){ out.push(hands.R.atk); hands.L.atk=null; hands.R.atk=null; }
  if(ru&&RUNE_DEF[ru.type].two){ for(const k of ['L','R'])if(hands[k].atk&&!out.includes(hands[k].atk))out.push(hands[k].atk); hands.L.atk=ru; hands.R.atk=ru; }
  else { if(hands[h].atk&&!out.includes(hands[h].atk))out.push(hands[h].atk); hands[h].atk=ru||null; }
  syncHands(); return out.filter(Boolean); }
function slotGet(h,s){ if(h==='B')return hands.B[s]; if(s==='atk')return hands[h].atk; return hands[h].slots[+s.slice(1)]||null; }
function slotSet(h,s,v){ if(h==='B')hands.B[s]=v; else if(s==='atk')hands[h].atk=v; else hands[h].slots[+s.slice(1)]=v; }
function slotAccepts(h,s,ru){ const c=RUNE_DEF[ru.type].cat; if(h==='B')return c==='body'&&(+s.slice(1))<(runState.bodyOpen||0); if(s==='atk')return c==='atk'; return canPutAt(h,+s.slice(1),ru); }
function freeSlotFor(ru,order){ let ord=(order||['R','L']).slice(); const d=RUNE_DEF[ru.type]; if(d.cat==='mod')ord.sort((a,b)=>(modWorks(d.mk,hands[b])?1:0)-(modWorks(d.mk,hands[a])?1:0));
  for(const h of ord){ const H=hands[h]; for(let i=0;i<(H.slotN||2);i++)if(!H.slots[i]&&canPutAt(h,i,ru))return [h,'s'+i]; } return null; }
function autoEquip(ru){ const cat=RUNE_DEF[ru.type].cat; let pick=null;
  if(cat==='body'){ const n=runState.bodyOpen||0; if(!n)return false; let i=[0,1].slice(0,n).find(i=>!hands.B['b'+i]); if(i===undefined)i=0; pick=['B','b'+i]; }
  else if(cat==='atk'){ const j=bag.indexOf(ru); if(j>=0)bag.splice(j,1); const out=equipWeapon(isTwo()?'R':(['R','L'].find(h=>!hands[h].atk)||'R'),ru); bag.push(...out); packSel=null; return true; }
  else { pick=freeSlotFor(ru); if(!pick){ for(const h of ['R','L']){ const H=hands[h]; for(let i=0;i<(H.slotN||2)&&!pick;i++)if(H.slots[i]&&RUNE_DEF[H.slots[i].type].cat===cat&&canPutAt(h,i,ru))pick=[h,'s'+i]; } } }
  if(!pick)return false; const old=slotGet(pick[0],pick[1]), j=bag.indexOf(ru); if(j>=0)bag.splice(j,1); if(old)bag.push(old); slotSet(pick[0],pick[1],ru); packSel=null; syncHands(); return true; }
// how many of a charm sit in the open body slots
function bodyN(type){ if(!hands||!hands.B)return 0; let n=0; for(let i=0;i<(runState.bodyOpen||0);i++){ const ru=hands.B['b'+i]; if(ru&&ru.type===type)n++; } return n; }
function packSlot(h,s){
  const cur=slotGet(h,s);
  if(packSel&&packSel.from==='bag'){ const ru=packSel.ru; if(slotAccepts(h,s,ru)){ const i=bag.indexOf(ru); if(i>=0)bag.splice(i,1); if(s==='atk')bag.push(...equipWeapon(h,ru)); else { if(cur)bag.push(cur); slotSet(h,s,ru); } packSel=null; } }
  else if(packSel&&packSel.from==='slot'){ if(packSel.h===h&&packSel.s===s){ if(cur){ bag.push(cur); if(s==='atk'){ if(isTwo()){ hands.L.atk=null; hands.R.atk=null; } else hands[h].atk=null; } else slotSet(h,s,null); } }
    else if((packSel.s==='atk'||s==='atk')&&(isTwo()||packSel.s!==s)){ }
    else { const ru=packSel.ru; slotSet(packSel.h,packSel.s,null); const okA=slotAccepts(h,s,ru), okB=!cur||slotAccepts(packSel.h,packSel.s,cur); slotSet(packSel.h,packSel.s,ru);
      if(okA&&okB){ slotSet(packSel.h,packSel.s,cur); slotSet(h,s,ru); } } packSel=null; }
  else if(cur)packSel={ru:cur,from:'slot',h,s};
  syncHands(); renderInv(); renderHotbar();
}
function applyBuild(k){
  const b=builds[k]; if(!b)return false; const pool=allRunes(), byU=u=>u?pool.find(r=>r.uid===u)||null:null, before=handsKey(), used=new Set(hands.B?[hands.B.b0,hands.B.b1].filter(Boolean):[]);
  const take=u=>{ const r=byU(u); if(!r||used.has(r))return null; used.add(r); return r; };
  const twoB=b.L&&b.R&&b.L.atk&&b.L.atk===b.R.atk, w2=twoB?take(b.L.atk):null;
  for(const h of ['L','R']){ const H=hands[h], B=b[h]||{}; H.atk=twoB?w2:take(B.atk); const sl=(B.slots||[]); H.slots=Array.from({length:Math.max(H.slotN||2,H.slots.length)},(_,i)=>i<(H.slotN||2)?take(sl[i]):null); }
  bag=pool.filter(r=>!used.has(r)); buildIdx=k; syncHands(); return handsKey()!==before;
}
function startSwap(prev){
  if(nearStele()){ sChime(player.x,player.z,0.3); for(let q=0;q<16;q++){ const a=mr()*6.28; spawn(player.x+Math.cos(a)*0.7,0.4+mr()*1.2,player.z+Math.sin(a)*0.7,0,0.6,0,0.7,G('.'),0.1,0.8,1.1,1.6,0); } return; }
  swapSt={t:0,dur:1.5,snap:prev,last:-1}; castSt=null; beamSegs=[];
}
function setInv(on){
  if(on===invOpen)return;
  invOpen=on; document.body.classList.toggle('paused',isPaused()); const el=document.getElementById('pack'); if(!el)return; el.classList.toggle('show',on);
  if(on){ packSnap={key:handsKey(),snap:snapHands()}; packSel=null; packHover=null; if(castSt){ castSt=null; beamSegs=[]; } renderInv(); if(locked&&document.exitPointerLock)document.exitPointerLock(); }
  else { if(packSnap&&packSnap.key!==handsKey())startSwap(packSnap.snap); packSnap=null; if(!plFailed&&started&&!dead)tryLock(); }
  updateResume(); renderHotbar();
}
function renderBook(){
  const el=document.getElementById('help'); if(!el)return; const f=t=>`<span class="f">${t}</span>`;
  const lines=[f('+-- 魔導書 ── 見つけた反応'),...Object.entries(REACT).map(([k,r])=>BOOK.has(k)?`${f('|')} <b>${r.name}</b>  <span class="lab">${r.pair}</span>\n${f('|')}   ${r.desc}`:`${f('|')} <span class="dim">？？？　まだ見ていない</span>`),
    f('|'),`${f('|')} <span class="lab">両手に違う性質を宿し、同じ敵に重ねると何かが起きる</span>`,`${f('|')} <span class="lab">記録は冒険をまたいで残る</span>`,f('+------------------------------')];
  el.innerHTML=boxText(lines);
}

function renderMenu(){
  const el=document.getElementById('menu'); if(!el)return; const f=t=>`<span class="f">${t}</span>`;
  const items=[['resume','冒険を続ける'],['pack','持ち物を見る'],['help',`操作の案内`],['chron','年代記'],['book','魔導書'],['cam',`視点：${camMode==='tps'?'三人称':'一人称'}`],['ui',`表示：${['通常','最小','なし'][uiMode]}`],['snd',`音量：${SND_NAME[SND.lv]}`],['perf',`速度の表示：${perfOn?'オン':'オフ'}`],['new',newRunArm>time?'本当に最初からやり直す？（もう一度押す）':'新しい冒険を始める'],['title',gallery?'タイトルに戻る':(titleArm>time?'本当にタイトルに戻る？（冒険は終わる）':'タイトルに戻る')]];
  el.innerHTML=boxText([f('+-- メニュー --------------------'),...items.map(([k,l])=>`${f('|')} <button class="row" data-k="${k}"><span class="mk"> </span>${l}</button>`),f('+--------------------------------')]);
  for(const b of el.querySelectorAll('button.row'))b.onclick=()=>menuAct(b.dataset.k);
}
function setMenu(on){ menuOpen=on; document.body.classList.toggle('paused',isPaused()); const el=document.getElementById('menu'); if(!el)return; el.classList.toggle('show',on); if(on)renderMenu(); }
function menuAct(k){
  if(k==='resume'){ setMenu(false); if(!plFailed)tryLock(); }
  else if(k==='pack'){ setMenu(false); setInv(true); }
  else if(k==='help'){ setHelp(!helpOn); helpT=0; renderMenu(); }
  else if(k==='chron'){ chronOn=!chronOn; helpOn=false; helpT=0; const el=document.getElementById('help'); if(el){ if(chronOn)renderChron(); el.classList.toggle('off',!chronOn); } renderMenu(); }
  else if(k==='book'){ const el=document.getElementById('help'); chronOn=false; helpOn=false; helpT=0; menuAct.book=!menuAct.book; if(el){ if(menuAct.book)renderBook(); el.classList.toggle('off',!menuAct.book); } renderMenu(); }
  else if(k==='cam'){ setCamMode(camMode==='tps'?'fps':'tps'); renderMenu(); }
  else if(k==='ui'){ cycleUi(); renderMenu(); }
  else if(k==='snd'){ sndToggle(); renderMenu(); }
  else if(k==='perf'){ perfOn=!perfOn; renderStatus(); renderMenu(); }
  else if(k==='title'){ if(gallery||titleArm>time){ titleArm=0; returnToTitle(); } else { titleArm=time+4; renderMenu(); } }
  else if(k==='new'){ if(newRunArm>time){ newRunArm=0; setMenu(false); newRun(); if(!plFailed)tryLock(); } else { newRunArm=time+4; renderMenu(); } }
}
// standing still a moment is enough to look around carefully (after Brogue's searching)
let stillT=0, searchedAt=-1;
function updateSearch(dt){
  const still=Math.hypot(player.vx,player.vz)<0.3, pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL);
  if(!still){ stillT=0; return; }
  stillT+=dt; if(stillT<1.5||searchedAt===pc)return; searchedAt=pc;
  let found=0; for(const tr of (D.traps||[])){ if(!tr.hidden)continue; const [x,z]=cpos(tr.i); if(Math.hypot(x-player.x,z-player.z)<CELL*4.5){ tr.hidden=false; found++; } }
  let mim=0; for(const m of monsters){ if(m.hidden&&Math.hypot(m.x-player.x,m.z-player.z)<9){ m.revealNow=true; mim++; } }
  if(found||mim){ sChime(player.x,player.z,0.2); msg(`<b style="color:#bfe4ff">?</b>立ち止まって辺りを見回した。${found?`隠された罠を${found}つ見つけた。`:''}${mim?'浮かんでいた巻物が、ぴくりと動いた。':''}`); }
}

