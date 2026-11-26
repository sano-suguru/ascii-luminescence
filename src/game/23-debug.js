// ---------------------------------------------------------------- debugging (developer mode): one set of commands behind both the F2 screen and window.dbg (for automated checks), plus URL options
function dbgEnter(){ const keepB=here.branch, keepR=here.realm, keepI=here.inter, keepD=here.depth;
  if(!ui.started){ startDepth=keepD; document.getElementById('enter').click(); }
  here.branch=keepB; here.realm=keepR; here.inter=keepI; here.depth=keepD; newLevel(); if(here.D)showStratum(here.D.stratum); }
function dbgNear(cell){ if(cell==null||cell<0)return false; let best=-1, bd=1e9; const cx=cell%MW, cz=(cell/MW)|0;
  for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){ if(cx+dx<0||cx+dx>=MW||cz+dz<0||cz+dz>=MH)continue; const i=(cz+dz)*MW+cx+dx; if(i===cell||here.D.tile[i]!==TF||here.D.liquid[i]===LQ_DEEP)continue; const d=Math.abs(Math.hypot(dx,dz)-2); if(d<bd){ bd=d; best=i; } }
  if(best<0)return false; const [tx,tz]=cpos(cell), [x,z]=cpos(best); player.x=x; player.z=z; player.yaw=Math.atan2(-(tx-x),-(tz-z)); player.pitch=-0.25; return true; }
const dbg={
  help(){ return 'dbg.info() / go(深度) / branch(key,階) / realm(key) / to("stairs"|"branch"|"portal"|"lord"|"altar"|"vault") / god(on) / heal() / reveal() / give("slot"|"body"|"runes"|"legends") / kill("lord"|"near") / open() / step(x,z) / look(x,y,z) / items() / clear()   支道: '+Object.keys(BRANCHES).join(',')+'   異界: '+Object.keys(REALMS).join(','); },
  info(){ const o=here.D?omenOf():null; return {seed:adv.runSeed,depth:here.depth,inter:here.inter?here.inter.key:null,branch:here.branch?{...here.branch}:null,realm:here.realm?{...here.realm}:null,stratum:here.D&&here.D.stratum?here.D.stratum.name:'',hp:Math.round(player.hp),god:ui.godMode,
    next:o&&o.stairs?o.stairs.kind+':'+o.stairs.key+(o.stairs.strong?' (strong)':''):null, branchDoor:o&&o.branch?o.branch.key:null, portal:o&&o.portal?o.portal.key:null,
    lord:here.monsters.some(m=>m.key==='lord'&&!m.dead), monsters:here.monsters.filter(m=>!m.dead).length, bodyOpen:adv.runState.bodyOpen||0,
    altars:[...new Set((here.D.items||[]).filter(o=>o.altar&&!o.taken).map(o=>o.grp))].length, springs:(here.D.items||[]).filter(o=>o.kind==='spring'&&!o.taken).length, startPos:here.D?cpos(here.D.start).map(v=>+v.toFixed(1)):null, hub:here.D&&here.D.hub?[+(here.D.hub.cx*CELL+1).toFixed(1),+(here.D.hub.cz*CELL+1).toFixed(1)]:null, hubNear:here.D?here.D.hubNear:null, stairGuard:here.D&&here.D.stairGuard!==undefined?stairsGuarded():null, stairsPos:here.D&&here.D.stairs>=0?cpos(here.D.stairs).map(v=>+v.toFixed(1)):null, guarded:[...new Set((here.D.items||[]).filter(o=>o.altar&&!o.taken&&o.guardG!==undefined&&guardedNow(o)).map(o=>o.grp))].length, elite:here.monsters.some(m=>m.elite&&!m.dead), elitePrize:(here.D.items||[]).some(o=>o.elitePrize&&!o.taken), eliteWhy:here.D.eliteWhy||null, looseRunes:(here.D.items||[]).filter(o=>o.kind==='rune'&&!o.altar&&!o.vault&&!o.pedestal&&!o.taken).length, vault:(()=>{ const v=(here.D.items||[]).find(o=>o.vault); return v?{ev:v.ev,taken:v.taken,gateOpen:!!(here.D.gate&&here.D.gate.open)}:null; })()}; },
  go(d){ here.branch=null; here.realm=null; here.inter=null; here.depth=clamp(d|0,1,FINAL_DEPTH); dbgEnter(); return dbg.info(); },
  branch(key,lvl){ const B=BRANCHES[key]; if(!B)return 'no such branch: '+Object.keys(BRANCHES).join(','); here.realm=null; here.inter=null; const at=B.at[0]; here.branch={key,lvl:clamp(lvl||1,1,B.len),len:B.len,ret:at+1}; here.depth=at; dbgEnter(); return dbg.info(); },
  inter(key){ if(!SPECIALS[key])return 'no such place: '+Object.keys(SPECIALS).join(','); const at=interAt(key); here.branch=null; here.realm=null; here.depth=at; here.inter={key,after:at}; dbgEnter(); return dbg.info(); },
  realm(key){ if(!REALMS[key])return 'no such realm: '+Object.keys(REALMS).join(','); here.branch=null; here.inter=null; here.realm={key,ret:here.depth+1}; dbgEnter(); return dbg.info(); },
  to(what){ if(!here.D)return false;
    const cell=what==='forge'?((here.D.items||[]).find(o=>o.forge&&!o.taken)||{i:-1}).i:what==='hub'?(here.D.hub?((Math.round(here.D.hub.cz))*MW+Math.round(here.D.hub.cx)):-1):what==='spring'?((here.D.items||[]).find(o=>o.kind==='spring'&&!o.taken)||{i:-1}).i:what==='altar'?((here.D.items||[]).find(o=>o.altar&&!o.taken)||{i:-1}).i:what==='elite'?((here.D.items||[]).find(o=>o.elitePrize&&!o.taken)||{i:-1}).i:what==='vault'?(here.D.gate?here.D.gate.cell:-1):what==='stairs'?here.D.stairs:what==='branch'?(here.D.bstairs&&here.D.bstairs.cell):what==='portal'?(here.D.portal&&here.D.portal.cell):what==='lord'?(()=>{ const m=here.monsters.find(m=>(m.key==='lord'||m.key==='final')&&!m.dead); return m?m.cz*MW+m.cx:-1; })():-1; return dbgNear(cell); },
  god(on){ ui.godMode=on===undefined?!ui.godMode:!!on; return ui.godMode; },
  heal(){ player.hp=adv.PLAYER_MAX; return player.hp; },
  reveal(){ here.explored.fill(1); return true; },
  give(what){ if(what==='slot')openSlot(((player.z/CELL)|0)*MW+((player.x/CELL)|0)); else if(what==='body'){ for(const t of RUNE_TYPES.body)takeRune(makeRune(t)); } else if(what==='runes'){ for(const t of Object.keys(RUNE_DEF))if(RUNE_DEF[t].cat!=='sub'&&RUNE_DEF[t].cat!=='open'&&(RUNE_DEF[t].cat!=='mod'||RUNE_TYPES.mod.includes(t)))takeRune(makeRune(t)); }
    else if(what==='legends'){ const L=getLegend(); if(L){ for(const k of LEGEND_ORDER)L.have.add(k); renderStatus(); } } else return 'give: slot / body / runes / legends'; renderHotbar(); return true; },
  kill(what){ if(what==='guards'){ const gs=new Set((here.D.items||[]).filter(o=>!o.taken&&o.guardG!==undefined&&Math.hypot(cpos(o.i)[0]-player.x,cpos(o.i)[1]-player.z)<18).map(o=>o.guardG)); let n=0; for(const m of here.monsters)if(!m.dead&&gs.has(m.g)){ damageMonster(m,99999,'debug'); n++; } return n; }
    const m=what==='lord'?here.monsters.find(m=>(m.key==='lord'||m.key==='final')&&!m.dead):here.monsters.filter(m=>!m.dead).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]; if(!m)return false; damageMonster(m,99999,'debug'); return true; },
  open(){ if(!here.D||!here.D.gate)return false; here.D.gate.open=true; return true; },
  step(x,z){ player.x=x; player.z=z; return [x,z]; },
  lore(n){ saved.META.lore=(saved.META.lore||0)+(n||50); saveMeta(); return loreLeft(); },
  exp(n){ gainExp(n||20); return {lvl:adv.lvl.n,exp:adv.lvl.exp,pending:adv.lvl.pending}; },
  hurt(n){ const g=ui.godMode; ui.godMode=false; hurtPlayer(n||5,'debug'); ui.godMode=g; return {hp:+player.hp.toFixed(1),rally:+(player.rally||0).toFixed(1)}; },
  hit(n){ const m=here.monsters.filter(m=>!m.dead&&!m.ty.critter&&!m.ty.peaceful).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]; if(!m)return false; m.playerT=clock.time; damageMonster(m,n||4,'magic'); return {target:m.ty.name,dead:m.dead}; },
  hp(){ return {hp:+player.hp.toFixed(1),rally:+(player.rally||0).toFixed(1),motes:fight.rallyMotes.length}; },
  look(x,y,z){ const [ox,oy,oz]=aimOrigin(); player.yaw=Math.atan2(-(x-ox),-(z-oz)); player.pitch=Math.atan2(y-oy,Math.hypot(x-ox,z-oz)); return [player.yaw,player.pitch]; },
  items(){ return (here.D.items||[]).filter(o=>!o.taken).map(o=>({kind:o.kind,opt:o.opt||null,altar:!!o.altar,vault:!!o.vault,lord:!!o.lord,type:o.rune?o.rune.type:null,pos:cpos(o.i).map(v=>+v.toFixed(2)),slot:o.slot})); },
  clear(){ const n0=here.monsters.length; here.monsters=here.monsters.filter(m=>m.ty.boss||m.key==='lord'||m.key==='final'||m.ty.critter||Math.hypot(m.x-player.x,m.z-player.z)>25); return n0-here.monsters.length; },
};
window.dbg=new Proxy(dbg,{get(o,k){ const v=o[k]; if(typeof v!=='function')return v; return (...a)=>saved.DEVALL?v(...a):'開発用モードがオフです（タイトルでオンにするか、URL に ?dev=1 を付けてください）'; }});
// the F2 screen
function setDbg(on){ if(on===ui.dbgOpen)return; if(on&&(!saved.DEVALL||!ui.started||adv.dead))return; ui.dbgOpen=on; document.body.classList.toggle('paused',isPaused()); const el=document.getElementById('dbgp'); if(!el)return; el.classList.toggle('show',on); if(on){ renderDbg(); if(document.pointerLockElement)document.exitPointerLock(); } else tryLock(); }
function renderDbg(){ const el=document.getElementById('dbgp'); if(!el)return; const f=t=>`<span class="f">${t}</span>`, I=dbg.info(), B=(c,t)=>`<button class="row" data-c="${c}">[${t}]</button>`;
  const where=I.realm?`異界：${REALMS[I.realm.key].name}`:I.branch?`支道：${BRANCHES[I.branch.key].name} ${I.branch.lvl}/${I.branch.len}階`:`深度 ${I.depth}`;
  const nx=I.next?(()=>{ const [k,v]=I.next.split(':'); const key=v.replace(' (strong)',''); return k==='stratum'?(STRATA.find(s=>s.k===key)||{}).name:k==='special'?SPECIALS[key].name:BRANCHES[key].name+(v.includes('strong')?'（主の階へ）':''); })():'変わらない';
  const rows=[f('+-- デバッグ ---'),`${f('|')} 今　${where}　${I.stratum}　シード ${I.seed}　体力 ${I.hp}/${adv.PLAYER_MAX}`,
    `${f('|')} 先　下り階段の先：${nx}　支道の入口：${I.branchDoor?BRANCHES[I.branchDoor].name:'なし'}　門：${I.portal?REALMS[I.portal].name:'なし'}`,
    `${f('|')} 　　祭壇：${I.altars}　宝物庫：${I.vault?(I.vault.ev==='guard'?'番人':'崩落')+(I.vault.taken?'（取った）':''):'なし'}`,f('|'),
    `${f('|')} 深度　`+Array.from({length:FINAL_DEPTH},(_,i)=>B('go:'+(i+1),i+1)).join(''),
    ...Object.keys(BRANCHES).map(k=>`${f('|')} 支道　${BRANCHES[k].name}　`+Array.from({length:BRANCHES[k].len},(_,i)=>B(`br:${k}:${i+1}`,(i+1)+'階')).join('')),
    `${f('|')} 異界　`+Object.keys(REALMS).map(k=>B('re:'+k,REALMS[k].name)).join(' '),f('|'),
    `${f('|')} 跳ぶ　${B('to:stairs','下り階段')} ${B('to:branch','支道の入口')} ${B('to:portal','異界の門')} ${B('to:lord','主')} ${B('to:altar','祭壇')} ${B('to:vault','宝物庫')}`,
    `${f('|')} 体　　${B('god','無敵：'+(ui.godMode?'オン':'オフ'))} ${B('heal','全快')}　　見る　${B('reveal','地図を明かす')}`,
    `${f('|')} 得る　${B('give:slot','空の枠')} ${B('give:body','補助のルーン全種')} ${B('give:runes','すべてのルーン')} ${B('give:legends','伝説の三つ')}`,
    `${f('|')} 敵　　${B('clear','周りの敵を消す')} ${B('kill:lord','主を倒す')}　　仕掛け　${B('open','鉄格子を開ける')}`,f('|'),`${f('|')} <span class="lab">F2 か Esc で閉じる。同じことは、コンソールの dbg.help() からもできる</span>`,f('+---')];
  el.innerHTML=boxText(rows);
  for(const b of el.querySelectorAll('button[data-c]'))b.onclick=()=>{ const [c,a,b2]=b.dataset.c.split(':');
    if(c==='go')dbg.go(+a); else if(c==='br')dbg.branch(a,+b2); else if(c==='re')dbg.realm(a); else if(c==='to')dbg.to(a); else if(c==='god')dbg.god(); else if(c==='heal')dbg.heal(); else if(c==='reveal')dbg.reveal(); else if(c==='give')dbg.give(a); else if(c==='clear')dbg.clear(); else if(c==='kill')dbg.kill(a); else if(c==='open')dbg.open();
    if(['go','br','re','to'].includes(c))setDbg(false); else renderDbg(); }; }
// URL options: ?dev=1&seed=123&depth=8 | branch=crypt:2 | realm=ice &to=stairs &god=1 &reveal=1 &give=slot,body
function dbgUrl(){ let q; try{ q=new URLSearchParams(location.search); }catch(e){ return; } if(q.get('dev')==='1'||TEST){ saved.DEVALL=true; try{ localStorage.setItem('al_dev','1'); }catch(e){} buildIntroPanel(); }
  if(!saved.DEVALL)return; const sd=q.get('seed'); if(sd&&/^[0-9]{1,10}$/.test(sd)){ adv.runSeed=Number(sd)>>>0; const si=document.getElementById('seedIn'); if(si)si.value=sd; }
  const dp=q.get('depth'), br=q.get('branch'), re=q.get('realm'); if(!dp&&!br&&!re&&!q.get('to'))return;
  if(br){ const [k,l]=br.split(':'); dbg.branch(k,+l||1); } else if(re){ if(dp)here.depth=+dp; dbg.realm(re); } else dbg.go(+dp||1);
  if(q.get('god')==='1')dbg.god(true); if(q.get('reveal')==='1')dbg.reveal(); for(const g of (q.get('give')||'').split(',').filter(Boolean))dbg.give(g); if(q.get('to'))dbg.to(q.get('to')); }

