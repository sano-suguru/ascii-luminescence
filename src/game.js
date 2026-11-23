(function(){
'use strict';
// ---------------------------------------------------------------- test mode (?test=1): the same result every time, for automated checks
// Math.random is seeded, and the clock (performance.now / setTimeout / setInterval) only moves when the game steps.
// The game does not step by itself: window.__test.frames(n) draws n frames, __test.advance(sec) steps without drawing.
const TEST=(()=>{ try{ return new URLSearchParams(location.search).get('test')==='1'; }catch(e){ return false; } })();
const TEST_STEP=1/30;
const TESTCLK=TEST?(()=>{
  const q=new URLSearchParams(location.search), sd=Number(q.get('seed'))>>>0||1;
  let a=(sd^0x9e3779b9)>>>0; Math.random=()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  let now=0, nextId=1; const timers=new Map();
  performance.now=()=>now;
  window.setTimeout=(fn,ms,...args)=>{ const id=nextId++; timers.set(id,{at:now+Math.max(0,+ms||0),fn,args}); return id; };
  window.setInterval=(fn,ms,...args)=>{ const id=nextId++; const every=Math.max(1,+ms||0); timers.set(id,{at:now+every,fn,args,every}); return id; };
  window.clearTimeout=window.clearInterval=id=>{ timers.delete(id); };
  return { advance(ms){ const end=now+ms;
    for(;;){ let id=-1, e=null; for(const [k,v] of timers)if(v.at<=end&&(!e||v.at<e.at||(v.at===e.at&&k<id))){ id=k; e=v; }
      if(!e)break; now=Math.max(now,e.at); if(e.every)e.at+=e.every; else timers.delete(id);
      if(typeof e.fn==='function')e.fn(...e.args); }
    now=end; } };
})():null;
const errEl=document.getElementById('err');
if(!window.THREE||!THREE.EffectComposer||!THREE.UnrealBloomPass){ errEl.textContent='描画ライブラリを読み込めませんでした。ページを再読み込みしてください。'; return; }
const T=THREE;

// ---------------------------------------------------------------- title letters
// ---------------------------------------------------------------- the title as a logo: filled block letters with shadows, in the style of oh-my-logo
// The art below was rendered with oh-my-logo's filled block font (cfonts 'block'), one letter at a time, and pasted here as text.
// To change the title: render the new words the same way (node gen2.mjs WORD1 WORD2) and replace LOGO_ART; TITLE_LINES must match its keys.
const TITLE_LINES=['ASCII','LUMINESCENCE'];
const LOGO_ART={"ASCII": [" █████╗  ███████╗  ██████╗ ██╗ ██╗", "██╔══██╗ ██╔════╝ ██╔════╝ ██║ ██║", "███████║ ███████╗ ██║      ██║ ██║", "██╔══██║ ╚════██║ ██║      ██║ ██║", "██║  ██║ ███████║ ╚██████╗ ██║ ██║", "╚═╝  ╚═╝ ╚══════╝  ╚═════╝ ╚═╝ ╚═╝"], "LUMINESCENCE": ["██╗      ██╗   ██╗ ███╗   ███╗ ██╗ ███╗   ██╗ ███████╗ ███████╗  ██████╗ ███████╗ ███╗   ██╗  ██████╗ ███████╗", "██║      ██║   ██║ ████╗ ████║ ██║ ████╗  ██║ ██╔════╝ ██╔════╝ ██╔════╝ ██╔════╝ ████╗  ██║ ██╔════╝ ██╔════╝", "██║      ██║   ██║ ██╔████╔██║ ██║ ██╔██╗ ██║ █████╗   ███████╗ ██║      █████╗   ██╔██╗ ██║ ██║      █████╗", "██║      ██║   ██║ ██║╚██╔╝██║ ██║ ██║╚██╗██║ ██╔══╝   ╚════██║ ██║      ██╔══╝   ██║╚██╗██║ ██║      ██╔══╝", "███████╗ ╚██████╔╝ ██║ ╚═╝ ██║ ██║ ██║ ╚████║ ███████╗ ███████║ ╚██████╗ ███████╗ ██║ ╚████║ ╚██████╗ ███████╗", "╚══════╝  ╚═════╝  ╚═╝     ╚═╝ ╚═╝ ╚═╝  ╚═══╝ ╚══════╝ ╚══════╝  ╚═════╝ ╚══════╝ ╚═╝  ╚═══╝  ╚═════╝ ╚══════╝"]};
// fallback when no rendered art exists for the title: a 5x5 dot font filled with the dungeon's own glyphs
const LOGO_FONT={
  A:['01110','10001','11111','10001','10001'],B:['11110','10001','11110','10001','11110'],C:['01111','10000','10000','10000','01111'],
  D:['11110','10001','10001','10001','11110'],E:['11111','10000','11110','10000','11111'],F:['11111','10000','11110','10000','10000'],
  G:['01111','10000','10011','10001','01111'],H:['10001','10001','11111','10001','10001'],I:['111','010','010','010','111'],
  J:['00111','00010','00010','10010','01100'],K:['10001','10010','11100','10010','10001'],L:['10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10001','10001'],N:['10001','11001','10101','10011','10001'],O:['01110','10001','10001','10001','01110'],
  P:['11110','10001','11110','10000','10000'],Q:['01110','10001','10101','10010','01101'],R:['11110','10001','11110','10010','10001'],
  S:['01111','10000','01110','00001','11110'],T:['11111','00100','00100','00100','00100'],U:['10001','10001','10001','10001','01110'],
  V:['10001','10001','10001','01010','00100'],W:['10001','10001','10101','11011','10001'],X:['10001','01010','00100','01010','10001'],
  Y:['10001','01010','00100','00100','00100'],Z:['11111','00010','00100','01000','11111'],
  '0':['01110','10011','10101','11001','01110'],'1':['010','110','010','010','111'],'2':['11110','00001','01110','10000','11111'],
  '3':['11110','00001','01110','00001','11110'],'4':['10010','10010','11111','00010','00010'],'5':['11111','10000','11110','00001','11110'],
  '6':['01110','10000','11110','10001','01110'],'7':['11111','00010','00100','01000','01000'],'8':['01110','10001','01110','10001','01110'],
  '9':['01110','10001','01111','00001','01110'],' ':['000','000','000','000','000'],'-':['000','000','111','000','000'],
};
function buildDotLogo(el){
  const GL='#%&8@$#8@', cA=[0.72,0.6,1.0], cB=[1.0,0.8,0.45], rows=[], cells=[];
  const lineRows=TITLE_LINES.map(t=>{ const r=['','','','','']; [...t.toUpperCase()].forEach((ch,k)=>{ const f=LOGO_FONT[ch]||LOGO_FONT[' ']; for(let y=0;y<5;y++)r[y]+=(k?'0':'')+f[y]; }); return r; });
  const W=Math.max(...lineRows.map(r=>r[0].length));
  let seed=7; const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
  lineRows.forEach((r,li)=>{ const pad=Math.floor((W-r[0].length)/2);
    for(let y=0;y<5;y++){ let line=''; for(let x=0;x<W;x++){ const on=r[y][x-pad]==='1';
        if(!on){ line+=' '; continue; } const f=x/Math.max(1,W-1), c=cA.map((a,i)=>a+(cB[i]-a)*f), ch=GL[Math.floor(rnd()*GL.length)];
        line+=`<span class="px" style="color:rgb(${c.map(v=>Math.round(v*255)).join(',')})">${ch==='&'?'&amp;':ch}</span>`; }
      rows.push(line); }
    if(li<lineRows.length-1)rows.push(''); });
  el.innerHTML=rows.join('\n'); cells.push(...el.querySelectorAll('.px'));
  const fit=()=>{ const fs=Math.max(5,Math.min(19,(window.innerWidth*0.9)/(W*0.62),(window.innerHeight*0.3)/(11*0.62))); el.style.fontSize=fs+'px'; };
  fit(); window.addEventListener('resize',fit);
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  // a few glyphs change now and then, and a band of light sweeps across
  let sweep=-10; const tick=()=>{ if(document.body.classList.contains('started'))return;
    for(let k=0;k<5;k++){ const c=cells[Math.floor(Math.random()*cells.length)]; c.textContent=GL[Math.floor(Math.random()*GL.length)]; }
    sweep+=1.2; if(sweep>W+30)sweep=-30; const lit=new Set();
    cells.forEach(c=>{ const x=c.dataset.x!==undefined?+c.dataset.x:(c.dataset.x=String(c.offsetLeft/ (c.offsetWidth||1)|0),+c.dataset.x); c.classList.toggle('lit',Math.abs(x-sweep)<2.5); });
    setTimeout(tick,110); };
  setTimeout(tick,600);
}
(function buildLogo(){
  const el=document.getElementById('logo'); if(!el)return;
  if(!TITLE_LINES.every(t=>LOGO_ART[t])){ el.classList.add('dots'); const p=document.createElement('pre'); el.appendChild(p); buildDotLogo(p); return; }
  const rows=[]; const W=Math.max(...TITLE_LINES.map(t=>Math.max(...LOGO_ART[t].map(l=>[...l].length))));
  TITLE_LINES.forEach((t,k)=>{ const art=LOGO_ART[t], w=Math.max(...art.map(l=>[...l].length)), pad=' '.repeat(Math.floor((W-w)/2)); art.forEach(l=>rows.push(pad+l)); if(k<TITLE_LINES.length-1)rows.push(''); });
  const face=rows.map(l=>[...l].map(c=>c==='█'?c:' ').join('')).join('\n'), shade=rows.map(l=>[...l].map(c=>c==='█'||c===' '?' ':c).join('')).join('\n');
  el.innerHTML=`<pre class="lg-shade">${shade}</pre><pre class="lg-face">${face}</pre><pre class="lg-shine">${face}</pre>`;
  const fit=()=>{ const fs=Math.max(4,Math.min(15,(window.innerWidth*0.92)/(W*0.6),(window.innerHeight*0.26)/rows.length)); el.style.fontSize=fs+'px'; };
  fit(); window.addEventListener('resize',fit);
})();

// ---------------------------------------------------------------- constants
const CELL=2, BASE_H=3.2, EYE=1.62, MW=70, MH=46, NCELL=MW*MH, CH_D=9;
const TW=0, TF=1, TP=2, TC=3, TX=4;
const NSL=96, NDL=6;
const PR=0.3;
const RUNE_CHARS='ᚦᛏᛜᛞᚲᛁᛊᚾᚱᚺ';
const G=ch=>{ const c=ch.charCodeAt(0); if(c<128)return c-32; const k=RUNE_CHARS.indexOf(ch); return k>=0?96+k:31; };
const D4=[[1,0],[-1,0],[0,1],[0,-1]];
const mr=Math.random;
let rand=mr;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const R=(a,b)=>a+rand()*(b-a);
const RI=(a,b)=>Math.floor(a+rand()*(b-a+1));
const pick=a=>a[Math.floor(rand()*a.length)];
const mpick=a=>a[Math.floor(mr()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const RUNESET=['&','%','$','?','!','#','+','x','Y','Z','8','0','*','~','^','=','<','>','{','}','/','\\'];
const SWAPSET='#$%&*+=?@0123456789ABCDEFGHJKLMNPQRSTUVWXYZ<>{}[]~^';
const WG='###########%%&8HX=+#$#';
const RAMP_CH='.`,:-~=+*^%%#&08';
const MACHINE_INFO={
 camp:{ch:'%',col:[0.95,0.85,0.7],msg:'焚き火の跡と朽ちた寝袋。散らばった骨が、先客の末路を物語っている。'},
 altar:{ch:'_',col:[1.0,0.82,0.42],msg:'石の祭壇の上に、一枚の巻物 ? が静かに浮かんでいる。'},
 library:{ch:'[',col:[0.75,0.6,1.0],msg:'崩れかけた書架。読めない文字の頁が、宙をゆっくりと舞っている。'},
 crypt:{ch:'+',col:[0.55,0.75,1.0],msg:'R.I.P. と刻まれた墓石が並ぶ墓所。冷たい霧が足元を這っている。'},
 idyll:{ch:'~',col:[0.5,0.9,1.0],msg:'小さな泉を草が囲む、穏やかな一角。天井の裂け目から、地上の光が差し込んでいる。'},
 remnant:{ch:'.',col:[0.95,0.4,0.35],msg:'焼け焦げた灰に囲まれて、古い絨毯だけが色を留めている。'},
 dismal:{ch:'%',col:[0.85,0.25,0.25],msg:'血と骨と炭が散らばる、陰惨な部屋。何があったのかは考えたくない。'},
 bloodwort:{ch:'*',col:[1.0,0.3,0.35],msg:'壁際で、赤く熟したブラッドワートの実が脈打つように光っている。'},
 flood:{ch:'~',col:[0.45,0.75,1.0],msg:'壁の亀裂から、水の滴る音がする。'},
 lavaflow:{ch:'^',col:[1.0,0.45,0.15],msg:'床の裂け目が赤く脈打っている。足元から熱が這い上がってくる。'},
 collapse:{ch:':',col:[1.0,0.6,0.3],msg:'床に走る無数のひび割れから、下の階層のかすかな光が漏れている。'},
 statues:{ch:'&',col:[0.8,0.8,0.95],msg:'石を刻んだ彫像たちが、部屋の中央を見つめている。'},
};

const THEMES=[
 {k:'amber',  col:[1.0,0.55,0.17], fix:'brazier', msg:'琥珀色の炎が揺らめく広間に出た。壁が火影に震えている。'},
 {k:'crimson',col:[1.0,0.13,0.22], fix:'brazier', msg:'深紅の火が、壁一面を血の色に染めている。'},
 {k:'cyan',   col:[0.2,0.8,1.0],   fix:'crystal', msg:'宙に浮かぶ水晶が、青白い光をゆっくりと脈打たせている。'},
 {k:'violet', col:[0.55,0.33,1.0], fix:'crystal', msg:'菫色の燐光が満ちる静かな広間。天井で無数の小さな光が瞬いている。'},
 {k:'emerald',col:[0.2,1.0,0.5],   fix:'fungus',  msg:'発光する苔が、床一面に芽吹いている。'},
 {k:'magenta',col:[1.0,0.25,0.8],  fix:'rune',    msg:'床に描かれた魔法陣が、妖しく回転している。'},
];
// districts of the ancient ruins (palette after Caves of Qud)
const RUIN_THEMES=[
 {k:'r_teal',  col:[0.3,0.95,0.85], fix:'orb',     ruin:true, msg:'青緑に灯る古の球体が、崩れかけた大広間をいまも照らしている。'},
 {k:'r_ochre', col:[1.0,0.66,0.28], fix:'brazier', ruin:true, msg:'黄土色の炎が、巨大な柱の影を長く伸ばしている。'},
 {k:'r_rose',  col:[1.0,0.42,0.62], fix:'orb',     ruin:true, msg:'薔薇色に灯る古代の球体が、壁一面の碑文を照らしている。'},
 {k:'r_violet',col:[0.62,0.45,1.0], fix:'crystal', ruin:true, msg:'菫色の光の中で、誰のものとも知れぬ文明の名残が眠っている。'},
];
const RUIN_KIND_MSG={atrium:'吹き抜けの遥か上から、青白い光が降り注いでいる。',plaza:'広場の中央に、石を刻んだ巨像がそびえている。',garden:'廃墟を呑み込むように、草木が生い茂っている。'};
const BIOMES={
 lake:     {k:'lake',     col:[0.25,0.82,1.0], base:13.2, slope:2.0, cave:true, msg:'天井の見えない大空洞に出た。光る湖の上を、無数の光の粒が星のように漂っている。'},
 chasm:    {k:'chasm',    col:[1.0,0.34,0.14], base:10.4, slope:1.8, cave:true, msg:'足元に底知れぬ裂け目が口を開けている。深淵の奥から、燃える火の粉が立ち昇ってくる。'},
 fungal:   {k:'fungal',   col:[0.25,1.0,0.55], base:8.4,  slope:1.4, cave:true, msg:'巨大な茸が林立する、燐光の森に迷い込んだ。'},
 cathedral:{k:'cathedral',col:[1.0,0.62,0.24], base:12.8, slope:3.2, cave:true, msg:'石の巨柱が闇へと伸びる、大聖堂のような空間。遥か頭上で琥珀の灯が揺れている。'},

 swamp:    {k:'swamp',    col:[0.55,0.9,0.3],  base:8.0,  slope:1.6, cave:true, msg:'湿った沼地に足を踏み入れた。泥の泡がはじけ、鼻をつくガスが低く漂っている。'},
 crystal:  {k:'crystal',  col:[0.6,0.85,1.0],  base:10.4, slope:2.2, cave:true, msg:'透き通った結晶が林立する洞窟。光が結晶を抜けて、虹色に揺らめいている。'},
 towercap: {k:'towercap', col:[0.72,0.55,1.0], base:14,   slope:2.2, cave:true, msg:'茸の巨木が林立する森に出た。遥か頭上で、笠の裏が淡く光っている。'},
 mossfield:{k:'mossfield',col:[0.3,1.0,0.85],  base:12,   slope:2.0, cave:true, msg:'光る苔が一面を覆う、静かな原。蛍のような光の粒が漂っている。'},
 basalt:   {k:'basalt',   col:[1.0,0.42,0.14], base:16,   slope:2.4, cave:true, msg:'黒い玄武岩の島。周りを、ゆっくりと流れる溶岩が取り囲んでいる。'},
 ashfield: {k:'ashfield', col:[1.0,0.55,0.25], base:15,   slope:2.2, cave:true, msg:'灰に覆われた焦土。燃え残りの熾火が、あちこちで赤く光っている。'},
 abyssal:  {k:'abyssal',  col:[0.6,0.4,1.0],   base:22,   slope:3.0, cave:true, msg:'虚空に浮かぶ岩の欠片。足元の遥か下で、紫の光が渦を巻いている。'},
 warren:   {k:'warren',   col:[0.85,0.6,0.35],  base:5.6,  slope:1.6, cave:true, msg:'泥で塗り固められたゴブリンの巣穴。干し草と、焚き火の燻った匂いがする。'},
 cavern:   {k:'cavern',   col:[0.55,0.55,0.85],base:17,   slope:2.5, cave:true, msg:''},
 magma:    {k:'magma',    col:[1.0,0.36,0.1],  base:11.2, slope:2.0, cave:true, msg:'灼熱の大空洞に出た。溶岩の河がゆっくりと流れ、岩肌が赤く脈打っている。'},
};
const MTYPES={
 r:{ch:'r',name:'ネズミ',col:[0.8,0.66,0.52],form:'quad',scale:0.55,speed:1.9,fl:0,light:3.2,trail:0.5,verb:'物陰をちょろちょろと走り回っている'},
 k:{ch:'k',name:'コボルト',col:[0.9,0.55,0.3],form:'humanoid',scale:0.62,speed:1.3,fl:0,light:3,trail:1,verb:'小さな槍を抱えて、辺りを嗅ぎ回っている'},
 j:{ch:'j',name:'ジャッカル',col:[1.0,0.74,0.36],form:'quad',scale:0.85,speed:2.4,fl:0,light:3.2,trail:0.5,verb:'群れをなして素早く駆けていく'},
 f:{ch:'f',name:'ヒカリウオ',col:[0.4,0.95,1.0],form:'fish',scale:0.55,speed:1.3,fl:0,light:0,trail:0,critter:'fish',aquatic:true,verb:'水面の下を、光の帯になって泳いでいる'},
 h:{ch:'h',name:'コケハミ',col:[0.7,1.0,0.55],form:'quad',scale:0.58,speed:0.5,fl:0,light:0,trail:0,critter:'grazer',verb:'光る苔を、もそもそと食んでいる'},
 p:{ch:'p',name:'サケビダケ',col:[0.85,0.55,1.0],form:'shroom',scale:0.85,speed:0,fl:0,light:0,trail:0,critter:'shrieker',verb:'暗がりで、ぼんやりと光っている'},
 q:{ch:'q',name:'ギタイムシ',col:[0.95,0.8,0.45],form:'crab',scale:0.5,speed:1.4,fl:0,light:0,trail:0,critter:'mimic',verb:'脚を生やして、すばしこく走り回っている'},
 S:{ch:'S',name:'洞窟蜘蛛',col:[0.82,0.7,1.0],form:'spider',scale:0.9,speed:1.5,fl:0,light:2,trail:0,spider:true,verb:'光る糸の陰で、じっと獲物を待っている'},
 Zf:{ch:'Z',name:'炎のハウンド',col:[1.0,0.45,0.18],form:'quad',scale:0.8,speed:2.3,fl:0,light:3,trail:3,hound:'fire',verb:'鼻を鳴らし、熱い息を吐きながら辺りを嗅ぎ回っている'},
 Zi:{ch:'Z',name:'氷のハウンド',col:[0.55,0.85,1.0],form:'quad',scale:0.8,speed:2.3,fl:0,light:3,trail:3,hound:'ice',verb:'白い息を吐きながら、地面の匂いを追っている'},
 Zl:{ch:'Z',name:'光のハウンド',col:[1.0,0.92,0.5],form:'quad',scale:0.8,speed:2.4,fl:0,light:3.5,trail:3,hound:'light',verb:'灯りの気配に、耳をぴんと立てている'},
 s:{ch:'s',name:'スナップジョー',col:[0.88,0.68,0.42],form:'humanoid',scale:0.82,speed:1.4,fl:0,light:2.5,trail:0.5,snap:true,verb:'ハイエナのような頭を揺らし、焚き火のそばでくつろいでいる'},
 sw:{ch:'s',name:'スナップジョーの見張り',col:[0.95,0.55,0.35],form:'humanoid',scale:0.85,speed:1.2,fl:0,light:2.5,trail:0.5,snap:true,verb:'野営地の周りを、油断なく見回っている'},
 Rc:{ch:'R',name:'清掃機',col:[0.5,1.0,0.6],form:'robot',scale:0.7,speed:0.9,fl:0,light:2,trail:0,critter:'cleaner',verb:'燃えた跡や灰を、黙々と片付けている'},
 Re:{ch:'R',name:'修復機',col:[1.0,0.85,0.35],form:'robot',scale:0.75,speed:0.9,fl:0,light:2,trail:0,critter:'engineer',verb:'壊れた扉を探して、ゆっくりと巡回している'},
 Rw:{ch:'R',name:'監視機',col:[1.0,0.35,0.3],form:'robot',scale:0.8,speed:0.8,fl:0,light:3,trail:0,watcher:true,verb:'赤い単眼で、辺りをゆっくりと見回している'},
 B:{ch:'B',name:'沼の怪物',col:[0.55,0.75,0.3],form:'bog',scale:1.3,speed:0.8,fl:0,light:0,trail:0,habitat:'bog',verb:'沼の底に沈み、泡だけを吐いている'},
 N:{ch:'N',name:'ナーガ',col:[0.35,0.9,0.75],form:'naga',scale:1.6,speed:1.1,fl:0,light:3,trail:1,habitat:'amph',verb:'深い水辺を、ゆったりと這い回っている'},
 l:{ch:'l',name:'サラマンダー',col:[1.0,0.48,0.15],form:'quad',scale:0.95,speed:1.2,fl:0,light:4,trail:6,habitat:'lava',verb:'溶岩の中を泳ぎ、ときどき岸へ這い上がってくる'},
 K:{ch:'K',name:'クラーケン',col:[0.45,0.55,0.95],form:'kraken',scale:2.6,speed:0.7,fl:0,light:0,trail:0,habitat:'deep',verb:'深い水の底から、触手だけを水面に出している'},
 T:{ch:'T',name:'トロル',col:[0.6,0.75,0.55],form:'troll',scale:1.6,speed:1.1,fl:0,light:3,trail:1,heavy:true,verb:'重い足音で床を揺らしながら歩いている'},
 Y:{ch:'Y',name:'ゴーレム',col:[0.75,0.72,0.85],form:'golem',scale:1.5,speed:0.7,fl:0,light:3.5,trail:0,heavy:true,golem:true,verb:'石の体をきしませ、決まった道筋を巡回している'},
 D:{ch:'D',name:'竜',col:[0.95,0.5,0.35],form:'dragon',scale:3.0,speed:0.9,fl:0,light:5,trail:3,heavy:true,dragon:true,verb:'翼を畳んで眠っている。寝息のたびに、周りの灯りが揺れる'},
 L:{ch:'L',name:'リッチ',col:[0.6,0.85,1.0],form:'wraith',scale:1.3,speed:0.8,fl:0.15,light:4,trail:6,lich:true,verb:'青白い光をまとい、音もなく漂っている'},
 n:{ch:'n',name:'ヘビ',col:[0.6,0.85,0.4],form:'snake',scale:0.75,speed:1.6,fl:0,light:1.5,trail:0,verb:'乾いた砂の上を、するすると這っている'},
 e:{ch:'e',name:'ウナギ',col:[0.35,0.95,0.78],form:'eel',scale:1,speed:1.6,fl:0,light:3.5,trail:0,verb:'深い水の中から、ぬるりと身を躍らせた'},
 m:{ch:'m',name:'サル',col:[0.9,0.62,0.42],form:'humanoid',scale:0.6,speed:1.7,fl:0,light:2.5,trail:0.5,hop:true,verb:'落ち着きなく跳ね回っている'},
 b:{ch:'b',name:'ブロート',col:[0.68,1.0,0.36],form:'bloat',scale:1,speed:0.35,fl:1.7,light:3.5,trail:2,verb:'腐食性のガスを溜め込み、ふわふわと漂っている'},
 g:{ch:'g',name:'ゴブリン',col:[1.0,0.3,0.13],form:'humanoid',scale:0.82,speed:1.15,fl:0,light:4.5,trail:1.5,verb:'闇の向こうからこちらを窺っている'},
 c:{ch:'g',name:'ゴブリンの呪術師',col:[0.82,0.45,1.0],form:'humanoid',scale:0.8,speed:1.0,fl:0,light:5,trail:2,conj:true,verb:'霊剣を呼び出し、宙に舞わせている'},
 J:{ch:'J',name:'ピンクゼリー',col:[1.0,0.45,0.75],form:'jelly',scale:1.35,speed:0.5,fl:0,light:4.5,trail:1,verb:'ぶよぶよと震えながら這っている'},
 v:{ch:'v',name:'吸血コウモリ',col:[0.9,0.25,0.38],form:'bat',scale:1,speed:3.2,fl:2.0,light:3,trail:2,flier:true,verb:'不規則な軌道で飛び回っている'},
 O:{ch:'O',name:'オーガ',col:[1.0,0.6,0.15],form:'humanoid',scale:1.32,speed:0.7,fl:0,light:5.5,trail:1.5,verb:'重い足音を響かせながら徘徊している'},
 w:{ch:'w',name:'ウィル・オ・ウィスプ',col:[0.3,0.92,1.0],form:'orb',scale:1,speed:1.45,fl:1.4,light:5.5,trail:9,verb:'ゆらゆらと宙を漂っている'},
 W:{ch:'W',name:'レイス',col:[0.66,0.38,1.0],form:'wraith',scale:1,speed:0.9,fl:0.12,light:5,trail:5,verb:'音もなく滑るように彷徨っている'},
 G:{ch:'G',name:'ノーム',col:[0.95,0.78,0.5],form:'humanoid',scale:0.6,speed:0.9,fl:0,light:3,trail:0.5,peaceful:true,verb:'町の通りを、のんびりと歩いている'},
 P:{ch:'P',name:'ファントム',col:[0.7,0.8,1.0],form:'wraith',scale:1.1,speed:1.1,fl:0.2,light:0,trail:0,invisible:true,verb:'姿は見えず、空気だけが揺らいでいる'},
};
// hordes (after Brogue): a leader and the followers that travel with it, gated by depth
// strata (after Dwarf Fortress's layers and DCSS's branches): the way the world is built changes with depth
const STRATA=[
 {k:'maze',  n:1, name:'石の迷宮',   from:1, to:2,   msg:''},
 {k:'cavern',n:2, name:'大洞窟',     from:3, to:5,   msg:'石の迷宮が途切れ、果てしない大洞窟が広がった。天井は遥か闇の彼方にある。'},
 {k:'ruins', n:3, name:'古代の廃墟', from:6, to:8,   msg:'洞窟の先に、巨大な建造物の残骸が現れた。誰が、何のために築いたのかは分からない。'},
 {k:'magma', n:4, name:'溶岩の海',   from:9, to:11,  msg:'足元から熱気が噴き上がる。見渡す限り、溶岩の海が広がっている。'},
 {k:'abyss', n:5, name:'深淵',       from:12,to:999, msg:'足場の下には何もない。底知れぬ闇の中を、これまでの世界の断片が漂っている。'},
];
// special levels (after NetHack's special levels and Dwarf Fortress's abandoned fortresses): one-off landmarks, placed per run seed
const SPECIALS={
 town:    {k:'town',    special:true, name:'地下の町',     msg:'岩盤をくり抜いて築かれた町に出た。家々の窓には、まだ灯りがともっている。'},
 bigroom: {k:'bigroom', special:true, name:'大広間',       msg:'視界が一気に開けた。どこまでも続く、ひとつきりの巨大な広間だ。'},
 oracle:  {k:'oracle',  special:true, name:'神託所',       msg:'静かな水音が聞こえる。この階のどこかに、神託を告げる座があるらしい。'},
 fortress:{k:'fortress',special:true, name:'放棄された砦', msg:'ドワーフの砦の跡に出た。溶岩の熱を頼りに栄え、そして見捨てられた場所だ。'},
};
// special levels come between depths (they no longer take a depth's place): the town after the stone labyrinth, the great hall within the great cavern,
// the oracle before the ruins, the abandoned fortress within the lava sea
let inter=null, showroomGen=false;
function interAt(key){ const h=Math.imul(runSeed^0x5bd1e995,2654435761)>>>0; return {town:2, bigroom:3+(h&1), oracle:5, fortress:9+((h>>2)&1)}[key]; }
function interAfter(d){ for(const k in SPECIALS)if(interAt(k)===d)return k; return null; }
const specialAt=d=>null;
const FORT_THEMES=[
 {k:'f_forge',col:[1.0,0.55,0.2], fix:'brazier',ruin:true,msg:'鍛冶の炎の名残が、煤けた壁を赤く照らしている。'},
 {k:'f_hall', col:[1.0,0.75,0.4], fix:'brazier',ruin:true,msg:'ドワーフの大広間。石に刻まれた紋様が、炎の光に浮かぶ。'},
 {k:'f_deep', col:[0.45,0.75,1.0],fix:'orb',    ruin:true,msg:'冷たい青い灯が、砦の奥の静けさを照らしている。'},
];
const FORT_KIND_MSG={dining:'長い石の食卓が並ぶ食堂。皿も杯も、埃をかぶったままだ。',forge:'冷えた炉と金床が並ぶ鍛冶場。槌の音は、とうに途絶えている。',flooded:'この広間は水に沈んでいる。上の階から、ゆっくりと水が染み出してきたのだろう。'};
const PROPHECIES=['石の回廊の先で大地は口を開け、星のような光が天井を覆うだろう。','水底の影に気をつけよ。光る湖は、何かを抱いて眠っている。','巨像の眼はまだ見ている。名を失った王たちの時代を。','やがて足元は燃える海となり、黒い島々だけが道を示す。','最後には何もない闇がある。そこでは落ちることだけが、先へ進む道だ。','灯りを絞れ。闇は、見つからぬ者の味方だ。','火は草を走り、沼の息はそれを待っている。'];
// branches (after DCSS): short side-dungeons that leave the main path and rejoin it one level further down
// portal realms (after DCSS's portal vaults): one-level places behind a shimmering gate
const CRYPT_THEMES=[
 {k:'c_cold',  col:[0.45,0.6,1.0], fix:'crystal',msg:'冷たい青い光の中に、石の棺が並んでいる。'},
 {k:'c_violet',col:[0.62,0.4,1.0], fix:'rune',   msg:'菫色の魔法陣が、死者の眠りを見守っている。'},
 {k:'c_pale',  col:[0.8,0.85,1.0], fix:'orb',    msg:'青白い灯が、埃をかぶった回廊を照らしている。'},
];
const LAB_THEMES=[
 {k:'l_magenta',col:[1.0,0.3,0.85],fix:'rune',   msg:'床一面に魔法陣が描かれている。まだ微かに力が残っているようだ。'},
 {k:'l_cyan',   col:[0.3,0.9,1.0], fix:'crystal',msg:'宙に浮かぶ水晶が、実験の続きを待っている。'},
 {k:'l_violet', col:[0.65,0.45,1.0],fix:'orb',   msg:'灯の下に、書きかけの羊皮紙が散らばっている。'},
];
const SUNKEN_THEMES=[RUIN_THEMES[0],RUIN_THEMES[3]];
const BRANCHES={
 crypt: {key:'crypt', name:'墓所',     len:2, at:[2,3], col:[0.6,0.5,1.0]},
 lair:  {key:'lair',  name:'獣の巣',   len:2, at:[4,5], col:[0.4,1.0,0.5]},
 sunken:{key:'sunken',name:'水没神殿', len:2, at:[6,8], col:[0.35,0.85,1.0]},
 nest:  {key:'nest',  name:'蜘蛛の巣', len:2, at:[5,7], col:[0.82,0.7,1.0]},
 snake: {key:'snake', name:'蛇の穴',   len:2, at:[7,9], col:[0.6,0.85,0.4]},
};
const BRANCH_STRATA={
 crypt: {k:'maze',  branch:true,name:'墓所',    msg:'冷たい石段を下りた。ここは死者のための回廊だ。',themes:CRYPT_THEMES,machines:['crypt','crypt','statues','dismal','library'],vaults:['ossuary','temple','labyrinth','throne'],hordes:['W','P','w','k','J'],hordeMul:1,torchMul:0.25,fog:[0.004,0.004,0.012]},
 lair:  {k:'cavern',branch:true,name:'獣の巣',  msg:'獣の匂いが立ちこめる洞窟に入った。あちこちで何かが息づいている。',cw:{towercap:2.5,fungal:2,mossfield:1.5,swamp:1.2,lake:0.8},hordes:['r','j','v','m','b'],hordeMul:1.25,fog:[0.006,0.008,0.004]},
 nest:  {k:'cavern',branch:true,name:'蜘蛛の巣',msg:'糸が幾重にも張りめぐらされた洞窟に入った。どこかで、何かが糸を伝って動いている。',cw:{fungal:2,mossfield:1,swamp:1,crystal:0.6},denseWebs:true,hordes:['S'],hordeMul:1.3,fog:[0.008,0.006,0.012]},
 snake: {k:'cavern',branch:true,name:'蛇の穴',  msg:'乾いた砂地と、湿った水場が交互に続く洞窟。足元で、何かが這う音がする。',cw:{lake:2.5,swamp:1.5,mossfield:1,crystal:0.4},hordes:['n','N'],hordeMul:1.2,fog:[0.012,0.01,0.004]},
 sunken:{k:'ruins', branch:true,name:'水没神殿',msg:'足元を水が満たしている。神殿は、ゆっくりと水の底へ沈みつつある。',themes:SUNKEN_THEMES,flood:true,hordes:['e','w','J','b'],hordeMul:0.9,fog:[0.002,0.008,0.014]},
};
const REALMS={
 ice:    {key:'ice',    name:'氷の洞窟',      minD:2, col:[0.6,0.85,1.0]},
 lab:    {key:'lab',    name:'魔術師の研究所', minD:2, col:[1.0,0.35,0.85]},
 volcano:{key:'volcano',name:'火山',          minD:4, col:[1.0,0.45,0.12]},
};
const REALM_STRATA={
 ice:    {k:'cavern',realm:true,name:'氷の洞窟',      msg:'門をくぐると、凍てついた空気が肺を刺した。すべてが氷に閉ざされている。',cw:{crystal:2.5,lake:2,mossfield:0.6},freeze:true,fall:'snow',hordes:['w','b','v'],fog:[0.012,0.016,0.026]},
 lab:    {k:'maze',  realm:true,name:'魔術師の研究所',msg:'門の先は、誰かの研究所だった。魔法陣と書物が、主の帰りを待っている。',themes:LAB_THEMES,machines:['library','library','altar','statues'],vaults:['observatory','temple','labyrinth'],hordes:['w','c','b','J']},
 volcano:{k:'magma', realm:true,name:'火山',         msg:'灼けた風が吹きつける。灰が雪のように降り続けている。',fall:'ash',hordes:['v','b','w'],fog:[0.022,0.006,0.002]},
};
let branch=null, realm=null;
function branchAtDepth(d){
  const taken=new Set();
  for(const k in BRANCHES){ const B=BRANCHES[k], span=[]; for(let x=B.at[0];x<=B.at[1];x++)if(!taken.has(x))span.push(x);
    if(!span.length)continue; const h=Math.imul(runSeed^(k.length*0x9e37+k.charCodeAt(0)),2654435761)>>>0, at=span[h%span.length]; taken.add(at); if(at===d)return k; }
  return null;
}
let arrive=null, lockCell=-1; const placeMem=new Map();
const placeKey=()=>`${runSeed}:`+(realm?`r:${realm.key}:${realm.ret}`:branch?`b:${branch.key}:${branch.lvl}`:inter?`i:${inter.key}`:`m:${depth}`);
function advance(go){
  if(D&&explored)placeMem.set(placeKey(),{explored:explored.slice(),mem:mem.slice()});
  arrive=null;
  if(go==='up'){
    if(inter){ inter=null; arrive='stairs'; return; }
    if(realm){ depth=realm.ret-1; realm=null; arrive='portal'; return; }
    if(branch){ if(branch.lvl>1){ branch.lvl--; arrive='stairs'; return; } depth=branch.ret-1; branch=null; arrive='bstairs'; return; }
    return;
  }
  if(go==='branch'&&D.bstairs){ const B=BRANCHES[D.bstairs.key]; branch={key:B.key,lvl:1,len:B.len,ret:depth+1}; return; }
  if(go==='realm'&&D.portal){ realm={key:D.portal.key,ret:depth+1}; return; }
  if(inter){ depth=inter.after+1; inter=null; return; }
  if(realm){ depth=realm.ret; realm=null; return; }
  if(branch){ if(branch.lvl<branch.len){ branch.lvl++; return; } depth=branch.ret; branch=null; return; }
  if(depth>=FINAL_DEPTH||(depth===FINAL_DEPTH-1&&!legendAll())){ advance.bounced=true; return; }
  { const ik=interAfter(depth); if(ik){ inter={key:ik,after:depth}; return; } }
  depth++;
}
function placeLabel(){ if(inter)return SPECIALS[inter.key].name; if(realm)return REALMS[realm.key].name; if(branch)return `${BRANCHES[branch.key].name} ${branch.lvl}/${branch.len}`; return String(depth); }
const stratumOf=d=>STRATA.find(st=>d>=st.from&&d<=st.to)||STRATA[STRATA.length-1];
const HORDES=[
 {lead:'r',fol:[['r',1,3]],d:[1,5],w:3},   {lead:'k',fol:[['k',0,2]],d:[1,4],w:3},
 {lead:'j',fol:[['j',2,4]],d:[1,7],w:2.5}, {lead:'m',fol:[],d:[2,8],w:1.5},
 {lead:'b',fol:[['b',0,1]],d:[2,12],w:1.6},{lead:'g',fol:[['g',0,2]],d:[2,99],w:2},
 {lead:'c',fol:[['g',2,3]],d:[3,99],w:1.6},{lead:'J',fol:[],d:[3,10],w:1.5},
 {lead:'w',fol:[],d:[1,99],w:1.4}, {lead:'Zf',fol:[['Zf',2,3]],d:[4,99],w:1.0}, {lead:'Zi',fol:[['Zi',2,3]],d:[4,99],w:1.0}, {lead:'Zl',fol:[['Zl',1,3]],d:[3,99],w:1.0},         {lead:'v',fol:[['v',0,2]],d:[4,99],w:1.8},
 {lead:'O',fol:[['O',0,1]],d:[5,99],w:1.3},{lead:'W',fol:[],d:[6,99],w:1.4},
 {lead:'P',fol:[],d:[6,99],w:1.1},
 {lead:'n',fol:[['n',1,3]],d:[6,99],w:0.6}, {lead:'S',fol:[['S',0,1]],d:[99,99],w:1.0}, {lead:'N',fol:[['n',1,2]],d:[99,99],w:1.0},
 {lead:'T',fol:[],d:[6,99],w:1.0}, {lead:'T',fol:[['T',1,1]],d:[9,99],w:0.5}, {lead:'L',fol:[['W',1,2]],d:[9,99],w:0.5}, {lead:'D',fol:[],d:[10,99],w:0.35},
];
// terrain layers (after Brogue's dungeon / liquid / surface layers)
const LQ_WATER=1, LQ_DEEP=2, LQ_LAVA=3, LQ_BOG=4;
const blocksWalk=l=>l===LQ_LAVA||l===LQ_DEEP;
const SF_GRASS=1, SF_LUMEN=2, SF_OBSIDIAN=3, SF_DEAD=4, SF_RUBBLE=5, SF_ICE=6, SF_FOLIAGE=7, SF_FUNGFOR=8, SF_BRIM=9, SF_MUD=10, SF_HAY=11;
// what changes as you descend: bright, torch-lit halls near the surface; dark fungus, crystal and lava below
function depthProfile(d){
  const t=clamp((d-1)/7,0,1);
  return {t,
    torch:1.15-t*0.85, grass:1-t*0.55, lumen:0.3+t*0.9, ambient:1-t*0.42, door:0.8-t*0.3,
    lavaPool:d>=4?0.18+t*0.22:0, bogPool:d>=2?0.12+t*0.1:0, fogDark:1-t*0.4,
    biomes:{lake:3-1.8*t, fungal:1.6+t, chasm:d>=2?1+1.5*t:0.4, cathedral:d>=2?1.4:0.5, magma:d>=2?1.2+5*t:0, swamp:d>=2?1.3+t:0.5, crystal:d>=2?0.9+1.8*t:0.4}};
}
const FOGS=[[0.0035,0.0024,0.011],[0.0018,0.0038,0.0105],[0.0058,0.0018,0.0085],[0.003,0.0028,0.012]];
const css=c=>`rgb(${Math.round(255*Math.min(1,c[0]*0.85+0.15))},${Math.round(255*Math.min(1,c[1]*0.85+0.15))},${Math.round(255*Math.min(1,c[2]*0.85+0.15))})`;

// ---------------------------------------------------------------- light helpers
function computeVis(L,tile){
  const vis=new Uint8Array(NCELL);
  const lcx=Math.floor(L.x/CELL), lcz=Math.floor(L.z/CELL), r=Math.ceil(L.rad/CELL)+1;
  for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
    const cx=lcx+dx, cz=lcz+dz; if(cx<0||cz<0||cx>=MW||cz>=MH)continue;
    const tx=(cx+0.5)*CELL, tz=(cz+0.5)*CELL, ddx=tx-L.x, ddz=tz-L.z, dist=Math.hypot(ddx,ddz);
    if(dist>L.rad+CELL)continue;
    const steps=Math.max(1,Math.ceil(dist/0.3)); let ok=true;
    for(let s=1;s<steps;s++){
      const f=s/steps, sx=L.x+ddx*f, sz=L.z+ddz*f, ccx=Math.floor(sx/CELL), ccz=Math.floor(sz/CELL);
      if(ccx===cx&&ccz===cz)break;
      const tt=tile[ccz*MW+ccx];
      if(tt===TW){ok=false;break;}
      if(tt===TP&&Math.hypot(sx-(ccx+0.5)*CELL,sz-(ccz+0.5)*CELL)<0.5){ok=false;break;}
    }
    if(ok)vis[cz*MW+cx]=1;
  }
  return vis;
}
function topLights(lights,x,y,z,nx,ny,nz,ref,outI,outW,o){
  let i0=-1,i1=-1,i2=-1,w0=0,w1=0,w2=0;
  for(let li=0;li<lights.length;li++){
    const L=lights[li], dx=L.x-x, dy=L.y-y, dz=L.z-z, d2=dx*dx+dy*dy+dz*dz;
    if(d2>=L.rad*L.rad)continue;
    if(ref>=0&&!L.vis[ref])continue;
    const d=Math.sqrt(d2), f=1-d/L.rad; let w=f*f*(1+0.5*f*f);
    if(nx!==null){ const nd=(nx*dx+ny*dy+nz*dz)/Math.max(d,1e-3); w*=Math.max(0,nd*0.62+0.38); }
    if(w<=0.002)continue;
    if(w>w0){i2=i1;w2=w1;i1=i0;w1=w0;i0=li;w0=w;}
    else if(w>w1){i2=i1;w2=w1;i1=li;w1=w;}
    else if(w>w2){i2=li;w2=w;}
  }
  outI[o]=i0;outI[o+1]=i1;outI[o+2]=i2;outW[o]=w0;outW[o+1]=w1;outW[o+2]=w2;
}

// ---------------------------------------------------------------- dungeon generation
function makeCave(w,h){
  for(let attempt=0;attempt<14;attempt++){
    let g=new Uint8Array(w*h);
    const inE=(x,y)=>{ const dx=(x+0.5-w/2)/(w/2), dy=(y+0.5-h/2)/(h/2); return dx*dx+dy*dy; };
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)g[y*w+x]=(inE(x,y)<0.9&&rand()<0.57)?1:0;
    for(let it=0;it<5;it++){
      const ng=new Uint8Array(w*h);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        let n=0; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy)continue; const xx=x+dx, yy=y+dy; if(xx>=0&&yy>=0&&xx<w&&yy<h&&g[yy*w+xx])n++; }
        ng[y*w+x]=inE(x,y)>=0.95?0:(n>=5?1:(n<4?0:g[y*w+x]));
      }
      g=ng;
    }
    const seen=new Uint8Array(w*h); let best=[];
    for(let s=0;s<w*h;s++){
      if(!g[s]||seen[s])continue;
      const list=[s]; seen[s]=1;
      for(let h2=0;h2<list.length;h2++){ const c=list[h2], x=c%w, y=(c/w)|0;
        for(const d of D4){ const xx=x+d[0], yy=y+d[1]; if(xx<0||yy<0||xx>=w||yy>=h)continue; const j=yy*w+xx; if(g[j]&&!seen[j]){seen[j]=1;list.push(j);} } }
      if(list.length>best.length)best=list;
    }
    if(best.length>=w*h*0.33)return best;
  }
  return null;
}

// ---------------------------------------------------------------- vaults (after DCSS / Angband): hand-drawn ASCII map pieces
// legend: # wall  H hedge  . floor  0 pillar  ~ shallow water  W deep water  L lava  : chasm  X crystal  " moss  c carpet
//         * light  & statue  _ altar  x rubble  (space) leave as is
// wall / wcol: the glyphs and colour of the vault's own masonry, so its outline reads from inside
const VAULT_WALL_H=3.0;
const VAULTS=[
 {k:'temple', name:'円形神殿', strata:['maze','ruins'], minD:1, wall:'|I=#', wcol:[0.95,0.8,0.5], msg:'円形の神殿に足を踏み入れた。中央の像が、静かにこちらを見下ろしている。', map:[
  "...#####...",
  ".##.....##.",
  ".#.0...0.#.",
  "#....*....#",
  ".....&.....",
  "#....*....#",
  ".#.0...0.#.",
  ".##.....##.",
  "...##.##..."]},
 {k:'cross', name:'十字の大聖堂', strata:['ruins'], minD:1, wall:'+|=#', wcol:[0.85,0.75,1.0], msg:'十字形の大聖堂。四方の翼廊の奥で、古の灯が揺れている。', map:[
  "....#...#....",
  "....#.*.#....",
  "#####...#####",
  "#.0.......0.#",
  "#...........#",
  "....*.&.*....",
  "#...........#",
  "#.0.......0.#",
  "#####...#####",
  "....#.*.#....",
  "....#...#...."]},
 {k:'shrine', name:'水没した祠', strata:['maze','ruins'], minD:2, wall:'=#~', wcol:[0.5,0.85,0.95], msg:'水に沈んだ祠。浅い水の中に、小さな社がぽつんと残っている。', map:[
  "~~~~~~~~~~~",
  "~WWWWWWWWW~",
  "~W~~~~~~~W~",
  "~W~##.##~W~",
  "~~~#._.#~~~",
  "~W~#.*.#~W~",
  "~W~~~~~~~W~",
  "~WWWW~WWWW~",
  "~~~~~~~~~~~"]},
 {k:'peristyle', name:'列柱の中庭', strata:['ruins'], minD:1, wall:'|=#', wcol:[0.9,0.85,0.7], msg:'列柱に囲まれた中庭。苔むした庭の中心に、灯がひとつ残っている。', map:[
  ".............",
  ".0.0.0.0.0.0.",
  ".............",
  ".0.\"\"\"\"\"\"\".0.",
  ".0.\"\"\"*\"\"\".0.",
  ".0.\"\"\"\"\"\"\".0.",
  ".............",
  ".0.0.0.0.0.0.",
  "............."]},
 {k:'fountain', name:'泉の広間', strata:['maze','ruins'], minD:1, wall:'=~#', wcol:[0.55,0.8,1.0], msg:'四つの灯に囲まれた泉。水面に、灯の光が揺れている。', map:[
  "\"\".......\"\"",
  "\"..*...*..\"",
  "....~~~....",
  "...~WWW~...",
  "...~W&W~...",
  "...~WWW~...",
  "....~~~....",
  "\"..*...*..\"",
  "\"\".......\"\""]},
 {k:'labyrinth', name:'小さな迷宮', strata:['maze'], minD:1, wall:'#=+', wcol:[0.7,0.55,1.0], msg:'部屋の中に、もうひとつ小さな迷宮が築かれている。中心で何かが光っている。', map:[
  "####.####",
  "#.......#",
  "#.#####.#",
  "#.#...#.#",
  "#.#.*.#.#",
  "#.#.#.#.#",
  "#...#...#",
  "#########"]},
 {k:'lavaaltar', name:'溶岩の祭壇', strata:['maze','ruins'], minD:4, wall:'#%=', wcol:[1.0,0.5,0.3], msg:'溶岩の堀に囲まれた祭壇。一本だけ残った道の先で、巻物が浮かんでいる。', map:[
  "...........",
  ".LLLLLLLLL.",
  ".L.......L.",
  ".L.x._.x.L.",
  ".L.......L.",
  ".LLLL.LLLL.",
  "..........."]},
 {k:'ossuary', name:'納骨堂', strata:['maze','ruins'], minD:3, wall:'%0o#', wcol:[0.9,0.86,0.75], msg:'壁龕に骨が積まれた納骨堂。崩れた瓦礫の向こうで、灯が揺れている。', map:[
  "#.#.#.#.#",
  "#x.....x#",
  "#.#&.&#.#",
  "....*....",
  "#.#&.&#.#",
  "#x.....x#",
  "#.#.#.#.#"]},
 {k:'throne', name:'玉座の間', strata:['maze','ruins'], minD:2, wall:'|=#', wcol:[1.0,0.72,0.42], msg:'色褪せた絨毯の先に、空の玉座が残っている。主はとうにいない。', map:[
  "...........",
  ".0.0...0.0.",
  "....ccc....",
  "....ccc....",
  ".0..ccc..0.",
  "....ccc....",
  "....c_c....",
  ".0.0*.*0.0.",
  "..........."]},
 {k:'observatory', name:'結晶の観測所', strata:['maze','ruins'], minD:3, wall:'*+|', wcol:[0.6,0.85,1.0], msg:'結晶が環を描いて並ぶ観測所。中心の灯が、結晶の中で何重にも屈折している。', map:[
  "...........",
  "..X..X..X..",
  "...........",
  ".X...*...X.",
  "...........",
  "..X..X..X..",
  "..........."]},
 {k:'hedge', name:'生垣の迷路', strata:['maze','ruins'], minD:1, wall:'"vY%', wcol:[0.3,0.8,0.45], msg:'苔と蔓で編まれた生垣の迷路。中心で小さな灯がまたたいている。', map:[
  "HHHHH.HHHHH",
  "H.........H",
  "H.HHH.HHH.H",
  "H.H.....H.H",
  "..H.H*H.H..",
  "H.H.....H.H",
  "H.HHH.HHH.H",
  "H.........H",
  "HHHHH.HHHHH"]},
 {k:'twinpools', name:'双子の池', strata:['maze','ruins'], minD:1, wall:'=~', wcol:[0.5,0.8,1.0], msg:'鏡のように並んだ二つの池。その間に、ひとつの灯が置かれている。', map:[
  "...........",
  ".~~~...~~~.",
  ".~W~.*.~W~.",
  ".~~~...~~~.",
  "..........."]},
 // ---- special-level pieces (only placed by the special levels)
 {k:'house', name:'家', strata:['town'], minD:1, roof:true, wall:'#=|', wcol:[0.92,0.72,0.5], msg:'', map:[
  "#######",
  "#.....#",
  "#..*..#",
  "#.....#",
  "###.###"]},
 {k:'shop', name:'店', strata:['town'], minD:1, roof:true, wall:'#=[]', wcol:[0.95,0.8,0.45], msg:'', map:[
  "#######",
  "#ccccc#",
  "#c.*.c#",
  "#.....#",
  "###.###"]},
 {k:'townTemple', name:'町の神殿', strata:['town'], minD:1, roof:true, wall:'|I=#', wcol:[0.85,0.8,1.0], msg:'', map:[
  "#########",
  "#*.....*#",
  "#.......#",
  "#..._...#",
  "#.......#",
  "#*.....*#",
  "####.####"]},
 {k:'townFountain', name:'泉の広場', strata:['town'], minD:1, wall:'=~', wcol:[0.55,0.8,1.0], msg:'', map:[
  "..*.*..",
  ".~~~~~.",
  ".~WWW~.",
  ".~~~~~.",
  "..*.*.."]},
 {k:'oracle', name:'神託所', strata:['oracle'], minD:1, wall:'|=', wcol:[0.7,0.85,1.0], msg:'泉と像に囲まれた聖域。中央の座に、神託の巻物が浮かんでいる。', map:[
  "~~~...........~~~",
  "~W~..&.....&..~W~",
  "~~~...........~~~",
  "......0.*.0......",
  "...&....~....&...",
  "......~W_W~......",
  "...&....~....&...",
  "......0.*.0......",
  "~~~...........~~~",
  "~W~..&.....&..~W~",
  "~~~...........~~~"]},
 {k:'pit', name:'奈落の環', strata:['maze','ruins'], minD:2, wall:'#=:', wcol:[0.7,0.6,0.9], msg:'円を描く裂け目に囲まれた小島。一本の道だけが、中心の灯へと続いている。', map:[
  ".........",
  ".:::::::.",
  ".:.....:.",
  ".:.0*0.:.",
  ".:.....:.",
  ".:::.:::.",
  "........."]},
];
function vaultCells(v){
  // random mirroring and transposition, so the same drawing appears in many orientations
  let m=v.map.map(r=>r.split(''));
  if(rand()<0.5)m=m.map(r=>r.slice().reverse());
  if(rand()<0.5)m=m.slice().reverse();
  if(rand()<0.5){ const t=[]; for(let x=0;x<m[0].length;x++){ t.push(m.map(r=>r[x])); } m=t; }
  return m;
}

// ---------------------------------------------------------------- history and engravings (after Caves of Qud's histories and Dwarf Fortress's engravings)
// ASCII-art motifs carved into walls; each row is exactly 7 characters
const ARTS={
 tower:["   ^   ","  /#\\  ","  |#|  "," /|#|\\ ","/_|#|_\\"],
 star: ["   .   "," \\ | / ","-- * --"," / | \\ ","   '   "],
 hammer:[" _____ ","|_____|","   |   ","   |   ","  _|_  "],
 bridge:["_______","| \\_/ |","|  |  |","~~~~~~~"],
 fountain:["  ( )  "," ( | ) ","  \\|/  "," _/ \\_ ","~~~~~~~"],
 swords:["\\     /"," \\   / ","  \\ /  ","  / \\  "," /   \\ "],
 serpent:["  __   "," (oo)  ","  \\ \\  ","  / /  "," ( (__ ","  \\__) "],
 skull:[" _____ ","/ o o \\","|  ^  |"," \\___/ ","  |||  "],
 eye:  ["  ___  "," /   \\ ","| (o) |"," \\___/ "],
 crown:["^  ^  ^","|\\/ \\/|","|_____|"],
 wave: ["  .-.  "," /   \\ ","~~~~~~~","~ ~ ~ ~","~~~~~~~"],
 tree: ["  ___  "," (   ) ","(_____)","   |   ","  /|\\  "],
 moon: ["  __   "," /  )  ","(  (   "," \\__)  ","     . "],
 lantern:["   |   ","  _|_  "," |   | "," | * | "," |___| "],
};
let HIST=null, HIST_SEED=-1;
// rock of each stratum: two tones for the banded layers, and a name for the look text
const ROCKS={maze:{name:'花崗岩',a:[0.62,0.56,0.62],b:[0.48,0.46,0.6]},cavern:{name:'石灰岩',a:[0.74,0.72,0.62],b:[0.52,0.6,0.72]},ruins:{name:'砂岩',a:[0.88,0.7,0.48],b:[0.68,0.52,0.44]},
  magma:{name:'玄武岩',a:[0.36,0.3,0.32],b:[0.52,0.32,0.28]},abyss:{name:'黒曜石',a:[0.3,0.25,0.42],b:[0.46,0.34,0.62]},bigroom:{name:'大理石',a:[0.86,0.86,0.92],b:[0.7,0.72,0.82]},
  oracle:{name:'大理石',a:[0.86,0.86,0.92],b:[0.7,0.72,0.82]},town:{name:'花崗岩',a:[0.62,0.56,0.62],b:[0.48,0.46,0.6]},fortress:{name:'花崗岩',a:[0.62,0.56,0.62],b:[0.48,0.46,0.6]}};
const VEIN_COL={1:[1.0,0.82,0.35],2:[1.0,0.22,0.32],3:[0.35,0.55,1.0],4:[0.25,1.0,0.55]}, VEIN_NAME={1:'金',2:'紅玉',3:'青玉',4:'翠玉'};
function makeHistory(seed){
  const rnd=mulberry32((seed^0x9e3779b9)>>>0), pk=a=>a[Math.floor(rnd()*a.length)];
  const SY=['ア','カ','サ','タ','ナ','ハ','マ','ラ','ザ','ル','ネ','ケ','セ','オ','ヴァ','イ','エ','ク','シ','ト','ミ','ヤ','ゼ','ド','グ','ベ','ラン','ヌ','ホ','ジ'];
  const nm=(a,b)=>{ let s=''; const n=a+Math.floor(rnd()*(b-a+1)); for(let k=0;k<n;k++)s+=pk(SY); if(rnd()<0.3)s+=pk(['ン','ル','ス','ト']); return s; };
  const civ={name:nm(2,3), ep:pk(['光を編む民','石を歌う民','星を数える民','水底に祈る民','灰を纏う民','碑文を刻む民','茸を育てる民','鐘を鳴らす民'])};
  const foe=nm(2,3)+'の民', beastSpec={name:nm(2,3),feat:pk(['六本脚の','千の眼を持つ','燃える鱗の','翼なき','影を喰らう','歌う']),kind:pk(['獣','大蛇','蛾','竜','百足'])}, beast=beastSpec.name+'、'+beastSpec.feat+beastSpec.kind;
  const ORD=['一','二','三','四','五','六','七'], N=5+Math.floor(rnd()*3);
  const rulers=ORD.slice(0,N).map(o=>({title:`第${o}の王`,name:nm(2,3)}));
  const EV={
    found:   R=>({art:'tower',   text:`${R}は、石の迷宮の上に${civ.name}の最初の都を築いた。`}),
    discover:R=>({art:'star',    text:`${R}の民は大洞窟を見いだし、その天井に星を見た。`}),
    forge:   R=>({art:'hammer',  text:`ドワーフたちは${R}のために、溶岩の熱で千の剣を鍛えた。`}),
    festival:R=>({art:'lantern', text:`${R}の治世、民は百日のあいだ灯りの祭りを続けた。`}),
    migrate: R=>({art:'tower',   text:`${R}は民を率いて、さらに深い層へと移り住んだ。`}),
    bridge:  R=>({art:'bridge',  text:`${R}は、燃える海に黒い石の橋を架けた。`}),
    oracle:  R=>({art:'fountain',text:`${R}は泉のほとりで神託を受け、都の名を改めた。`}),
    flood:   R=>({art:'wave',    text:`${R}の時代、地底の川があふれ、下の都が水に沈んだ。`}),
    grove:   R=>({art:'tree',    text:`${R}は茸の巨木を植え、その森を聖域とした。`}),
    war:     R=>({art:'swords',  text:`${R}は${foe}との戦いに勝ち、敵の王冠を深淵に投げ入れた。`}),
    beast:   R=>({art:'serpent', text:`${R}の治世、${beast}が地の底より現れ、三つの都を呑んだ。`}),
    betray:  R=>({art:'crown',   text:`${R}は弟に裏切られ、王冠を奪われた。`}),
    plague:  R=>({art:'skull',   text:`${R}の治世、灰色の病が都を覆い、灯りがひとつずつ消えていった。`}),
    fall:    R=>({art:'skull',   text:`${R}は光を失い、${civ.name}の民は散り散りになった。`}),
    abyss:   R=>({art:'eye',     text:`${R}は深淵を覗き込み、二度と戻らなかった。`}),
    starfall:R=>({art:'star',    text:`${R}の最期の夜、天井の星がすべて地に落ちた。`}),
    sleep:   R=>({art:'moon',    text:`${R}は眠りについた。いつか目覚めると言い残して。`}),
  };
  const GROW=['discover','forge','festival','migrate'], MID=['bridge','oracle','flood','grove','discover'], CONF=['war','beast','betray','plague'], END=['fall','abyss','starfall','sleep'];
  const plan=N===5?[['found'],GROW,MID,CONF,END]:N===6?[['found'],GROW,MID,CONF,CONF,END]:[['found'],GROW,GROW,MID,CONF,CONF,END];
  const used=new Set();
  const events=rulers.map((r,k)=>{ let key; for(let t=0;t<8;t++){ key=pk(plan[k]); if(!used.has(key))break; } used.add(key); const e=EV[key](`${r.title}${r.name}`); e.ruler=k; return e; });
  const crowns=rulers.map((r,k)=>({art:'crown',ruler:k,text:`${r.title}${r.name}の戴冠を描いた彫刻。`}));
  return {civ,foe,beast,beastSpec,rulers,events,crowns};
}

// how much of the 70x46 frame a level uses
function levelDims(st,d){ if(st.k==='bigroom'&&!showroomGen)return [56,34]; if(st.k==='fortress')return [56,36]; if(realm||st.special||st.realm)return [MW,MH]; if(branch)return [46,32];
  const k=st.k; let w=MW, h=MH;
  if(k==='maze'){ if(d<=1){ w=40; h=28; } else { w=50; h=34; } }
  else if(k==='cavern'){ const f=clamp((d-3)/2,0,1); w=Math.round(60+10*f); h=Math.round(40+6*f); }
  else if(k==='magma'){ w=70; h=30; }
  else if(k==='abyss'){ w=52; h=36; }
  return [Math.min(MW,w),Math.min(MH,h)]; }
function generate(seed,depth){
  if(HIST_SEED!==runSeed){ HIST=makeHistory(runSeed); HIST_SEED=runSeed; }
  rand=mulberry32(seed);
  const W=MW,H=MH,N=NCELL;
  const prof=depthProfile(depth);
  const tile=new Uint8Array(N), liquid=new Uint8Array(N), surface=new Uint8Array(N), roomOf=new Int16Array(N).fill(-1);
  const walk=j=>tile[j]===TF&&!blocksWalk(liquid[j]);
  const bridge=new Uint8Array(N), bridgeDir=new Uint8Array(N), xtalCol=new Map();
  const ns=(rand()*1e9)|0; noiseSeed=ns;
  const ceil=new Float32Array(N).fill(BASE_H), dfield=new Int16Array(N), flow=new Float32Array(N);
  const overlaps=(list,x,y,w,h,m)=>list.some(r=>x<r.x+r.w+m&&x+w+m>r.x&&y<r.y+r.h+m&&y+h+m>r.y);

  const stratum=realm?REALM_STRATA[realm.key]:branch?BRANCH_STRATA[branch.key]:inter?SPECIALS[inter.key]:stratumOf(depth);
  const [UW,UH]=levelDims(stratum,depth);
  let caves=[], normals=[], rooms;
  if(stratum.k==='ruins'||stratum.k==='fortress'){
    const fort=stratum.k==='fortress';
    // ---- the Ancient Ruins (after Caves of Qud): a decaying megastructure of grand halls on a grid of broad avenues
    const cols=RI(3,4), rowsN=fort?3:(rand()<0.45?2:3), bw=Math.floor((UW-2)/cols), bh=Math.floor((UH-2)/rowsN), streetH=fort?3.6:5.2;
    const carveS=(x,y)=>{ if(x<1||y<1||x>UW-2||y>UH-2)return; const i=y*W+x; if(tile[i]===TW){ tile[i]=TF; ceil[i]=streetH; } };
    for(let bx=0;bx<cols;bx++){ const X0=1+bx*bw; for(let y=1;y<UH-1;y++){ carveS(X0,y); carveS(X0+1,y); } }
    for(let by=0;by<rowsN;by++){ const Y0=1+by*bh; for(let x=1;x<UW-1;x++){ carveS(x,Y0); carveS(x,Y0+1); } }
    const KINDS=fort?['dining','forge','crypt','library','statues','hall','flooded']:['hall','hall','atrium','plaza','garden'];
    for(let by=0;by<rowsN;by++)for(let bx=0;bx<cols;bx++){
      const X0=1+bx*bw, Y0=1+by*bh, x=X0+3, y=Y0+3, w=bw-4, h=bh-4;
      if(w<5||h<4||x+w>UW-1||y+h>UH-1)continue;
      if(normals.length>0&&rand()<0.08)continue;
      normals.push({x,y,w,h,shape:'rect',cx:x+(w>>1),cy:y+(h>>1),theme:null,cells:[],cave:false,chasm:[],lava:[],mush:[],ruin:true,fort,rkind:normals.length===0?'hall':pick(KINDS),rh:Math.round((fort?R(4.4,5.6):R(6.4,10))/0.4)*0.4});
    }
    rooms=normals; caves=[];
    rooms.forEach(r=>{ r.deep=[]; r.bog=[]; r.xtal=[]; r.clusters=[]; });
    rooms.forEach((r,ri)=>{ for(let yy=r.y;yy<r.y+r.h;yy++)for(let xx=r.x;xx<r.x+r.w;xx++){ const i=yy*W+xx; tile[i]=TF; roomOf[i]=ri; ceil[i]=r.rh; } });
    // gates (2 wide) from every hall onto the avenues, and a few extra ones
    rooms.forEach(r=>{
      const gate=(x0,y0,horiz)=>{ for(const o of [0,1]){ if(horiz)carveS(x0,y0+o); else carveS(x0+o,y0); } };
      gate(r.x-1,r.cy-1,true); gate(r.x+r.w,r.cy-1,true); gate(r.cx-1,r.y-1,false); gate(r.cx-1,r.y+r.h,false);
      if(rand()<0.5)gate(r.x-1,RI(r.y+1,r.y+r.h-3),true);
      if(rand()<0.5)gate(RI(r.x+1,r.x+r.w-3),r.y+r.h,false);
    });
    // decay: breaches through thin walls, rubble everywhere
    for(let i=W;i<N-W;i++){
      if(tile[i]!==TW)continue;
      const lr=tile[i-1]===TF&&tile[i+1]===TF, ud=tile[i-W]===TF&&tile[i+W]===TF;
      if((lr||ud)&&rand()<(fort?0.025:0.07)){ tile[i]=TF; ceil[i]=streetH; surface[i]=SF_RUBBLE; for(const d of D4){ const j=i+d[0]+d[1]*W; if(tile[j]===TF&&rand()<0.6)surface[j]=SF_RUBBLE; } }
    }
    for(let i=0;i<N;i++)if(tile[i]===TF&&!surface[i]&&D4.some(d=>tile[i+d[0]+d[1]*W]===TW)&&rand()<0.05)surface[i]=SF_RUBBLE;
    // an aqueduct runs down the middle of one avenue
    if(!fort){ const Y0=1+RI(1,rowsN-1)*bh; for(let x=1;x<UW-1;x++){ const i=Y0*W+x; if(tile[i]===TF&&roomOf[i]<0&&!surface[i]){ liquid[i]=LQ_WATER; flow[i]=10; } } }
  } else if(stratum.k==='bigroom'||stratum.k==='town'){
    // ---- one enormous hall between two small chambers (NetHack's Big Room; the town is built inside such a hall)
    const town=stratum.k==='town', cyM=UH>>1;
    normals=[{x:2,y:cyM-3,w:7,h:7},{x:12,y:3,w:UW-24,h:UH-6},{x:UW-9,y:cyM-3,w:7,h:7}].map(r=>({...r,shape:'rect',cx:r.x+(r.w>>1),cy:r.y+(r.h>>1),theme:null,cells:[],cave:false,chasm:[],lava:[],mush:[]}));
    normals[1].special=true; normals[1].kindMsg=town?'':'天井の高みまで、無数の灯が整然と並んでいる。';
    rooms=normals; caves=[];
    rooms.forEach(r=>{ r.deep=[]; r.bog=[]; r.xtal=[]; r.clusters=[]; });
    rooms.forEach((r,ri)=>{ const rh=ri===1?(town?8:10.4):3.6; for(let yy=r.y;yy<r.y+r.h;yy++)for(let xx=r.x;xx<r.x+r.w;xx++){ const i=yy*W+xx; tile[i]=TF; roomOf[i]=ri; ceil[i]=rh; } });
    for(const [x0,x1] of [[9,11],[UW-12,UW-10]])for(let x=x0;x<=x1;x++)for(const y of [cyM,cyM+1]){ const i=y*W+x; tile[i]=TF; ceil[i]=3.2; }
  } else if(stratum.k==='maze'||stratum.k==='oracle'){
  // caverns first (the large open spaces)
  caves=[]; const nCave=stratum.k==='oracle'?0:1+(rand()<0.6?1:0);
  const bk=[]; { const w={...prof.biomes,...(stratum.k==='maze'?{warren:1.3}:{})}; for(let c=0;c<2;c++){ let tot=0; for(const k in w)tot+=w[k]; let r0=rand()*tot, chosen=null; for(const k in w){ r0-=w[k]; if(r0<=0){chosen=k;break;} } if(!chosen)chosen=Object.keys(w)[0]; bk.push(chosen); delete w[chosen]; } }
  for(let c=0;c<nCave;c++){
    for(let a=0;a<40;a++){
      const w=c===0?RI(22,30):RI(15,21), h=c===0?RI(15,21):RI(12,16);
      const x=RI(1,UW-w-1), y=RI(1,UH-h-1);
      if(overlaps(caves,x,y,w,h,3))continue;
      const loc=makeCave(w,h); if(!loc)continue;
      caves.push({x,y,w,h,shape:'cave',cave:true,cells0:loc.map(li=>(y+((li/w)|0))*W+x+li%w),theme:BIOMES[bk[c]],cells:[],chasm:[],lava:[],mush:[]});
      break;
    }
  }
  // rooms sized for a hand-drawn vault are reserved first, then ordinary rooms fill the rest
  const vRooms=[];
  if(stratum.k==='oracle'){ const ov=VAULTS.find(v=>v.k==='oracle'), w=ov.map[0].length+4, h=ov.map.length+4, x=(UW-w)>>1, y=(UH-h)>>1;
    if(!overlaps(caves,x,y,w,h,1))vRooms.push({x,y,w,h,shape:'rect',cx:x+(w>>1),cy:y+(h>>1),theme:null,cells:[],cave:false,chasm:[],lava:[],mush:[],vaultPref:true,forceVault:ov}); }
  { const vo=VAULTS.filter(v=>v.strata.includes('maze')&&depth>=v.minD), want=RI(1,2);
    for(let t=0;t<400&&vRooms.length<want&&vo.length;t++){ const v=pick(vo), w=v.map[0].length+RI(2,3), h=v.map.length+RI(2,3), x=RI(1,UW-w-1), y=RI(1,UH-h-1);
      if(overlaps(vRooms,x,y,w,h,2)||overlaps(caves,x,y,w,h,2))continue;
      vRooms.push({x,y,w,h,shape:'rect',cx:x+(w>>1),cy:y+(h>>1),theme:null,cells:[],cave:false,chasm:[],lava:[],mush:[],vaultPref:true}); } }
  // ordinary rooms
  normals=[];
  for(let i=0;i<800&&normals.length<12;i++){
    const w=RI(5,12), h=RI(5,9), x=RI(1,UW-w-1), y=RI(1,UH-h-1);
    if(overlaps(normals,x,y,w,h,2)||overlaps(caves,x,y,w,h,2)||overlaps(vRooms,x,y,w,h,2))continue;
    const s=rand(); const shape=s<0.2?'ellipse':(s<0.32&&w>=7&&h>=7?'cross':'rect');
    normals.push({x,y,w,h,shape,cx:x+(w>>1),cy:y+(h>>1),theme:null,cells:[],cave:false,chasm:[],lava:[],mush:[]});
  }
  normals=normals.concat(vRooms);
  rooms=normals.concat(caves);
  rooms.forEach(r=>{ r.deep=[]; r.bog=[]; r.xtal=[]; r.clusters=[]; });
  rooms.forEach((r,ri)=>{
    if(r.cave){
      let sx=0,sy=0; for(const i of r.cells0){ tile[i]=TF; roomOf[i]=ri; sx+=i%W; sy+=(i/W)|0; }
      sx/=r.cells0.length; sy/=r.cells0.length; let bi=r.cells0[0], bd=1e9;
      for(const i of r.cells0){ const d=(i%W-sx)**2+(((i/W)|0)-sy)**2; if(d<bd){bd=d;bi=i;} }
      r.cx=bi%W; r.cy=(bi/W)|0; return;
    }
    const rh=r.shape==='ellipse'?4.4:pick([3.2,3.2,3.6,4.0]);
    for(let yy=r.y;yy<r.y+r.h;yy++)for(let xx=r.x;xx<r.x+r.w;xx++){
      let ok=true;
      if(r.shape==='ellipse'){ const dx=(xx+0.5-(r.x+r.w/2))/(r.w/2), dy=(yy+0.5-(r.y+r.h/2))/(r.h/2); ok=dx*dx+dy*dy<=1.05; }
      else if(r.shape==='cross'){ const ix=xx-r.x, iy=yy-r.y, bx=Math.floor(r.w/3), by=Math.floor(r.h/3); ok=(ix>=bx&&ix<r.w-bx)||(iy>=by&&iy<r.h-by); }
      if(ok){ const i=yy*W+xx; tile[i]=TF; roomOf[i]=ri; ceil[i]=rh; }
    }
  });
  // connect everything
  const edges=[], inTree=[0], rest=new Set(rooms.map((_,i)=>i)); rest.delete(0);
  const rd=(a,b)=>Math.abs(rooms[a].cx-rooms[b].cx)+Math.abs(rooms[a].cy-rooms[b].cy);
  while(rest.size){ let best=null,bd=1e9; for(const a of inTree)for(const b of rest){ const d=rd(a,b); if(d<bd){bd=d;best=[a,b];} } edges.push(best); inTree.push(best[1]); rest.delete(best[1]); }
  for(let k=0;k<4;k++){ const a=RI(0,rooms.length-1); const others=rooms.map((_,i)=>i).filter(i=>i!==a).sort((p,q)=>rd(a,p)-rd(a,q)); if(others.length>2)edges.push([a,others[RI(1,2)]]); }
  const carve=(x,y)=>{ if(x<1||y<1||x>UW-2||y>UH-2)return; const i=y*W+x; if(tile[i]===TW){ tile[i]=TF; ceil[i]=BASE_H; } };
  for(const [ai,bi] of edges){
    const a=rooms[ai], b=rooms[bi]; let x=a.cx,y=a.cy;
    const sx=()=>{ while(x!==b.cx){ x+=Math.sign(b.cx-x); carve(x,y);} };
    const sy=()=>{ while(y!==b.cy){ y+=Math.sign(b.cy-y); carve(x,y);} };
    if(rand()<0.5){sx();sy();}else{sy();sx();}
  }
  } else {
    // ---- the Great Caverns (after Dwarf Fortress's cavern layers): one vast cave system crossed by an underground river
    let g=new Uint8Array(N);
    const edgeOf=(x,y)=>Math.min(x,y,UW-1-x,UH-1-y);
    for(let y=1;y<UH-1;y++)for(let x=1;x<UW-1;x++)g[y*W+x]=(edgeOf(x,y)>2&&rand()<0.6)?1:0;
    for(let k=RI(4,6);k>0;k--){ const cx=RI(9,UW-10), cy=RI(7,UH-8), rx=R(4,9), ry=R(3.5,7); for(let y=2;y<UH-2;y++)for(let x=2;x<UW-2;x++){ const dx=(x-cx)/rx, dy=(y-cy)/ry; if(dx*dx+dy*dy<1)g[y*W+x]=1; } }
    for(let it=0;it<5;it++){ const ng=new Uint8Array(N);
      for(let y=1;y<UH-1;y++)for(let x=1;x<UW-1;x++){ let n=0; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)n+=g[(y+dy)*W+x+dx]; ng[y*W+x]=edgeOf(x,y)<2?0:(n>=5?1:(n<4?0:g[y*W+x])); }
      g=ng; }
    const comps=(val)=>{ const lab=new Int32Array(N).fill(-1), out=[]; for(let s0=0;s0<N;s0++){ if(g[s0]!==val||lab[s0]>=0)continue; const list=[s0]; lab[s0]=out.length;
        for(let h=0;h<list.length;h++){ const c=list[h], x=c%W, y=(c/W)|0; for(const d of D4){ const xx=x+d[0], yy=y+d[1]; if(xx<0||yy<0||xx>=UW||yy>=UH)continue; const j=yy*W+xx; if(g[j]===val&&lab[j]<0){ lab[j]=out.length; list.push(j);} } }
        out.push(list); } return out; };
    { const oc=comps(1).sort((p,q)=>q.length-p.length); for(let k=1;k<oc.length;k++)for(const i of oc[k])g[i]=0; }
    { const rc=comps(0); for(const list of rc){ if(list.length<6&&!list.some(i=>edgeOf(i%W,(i/W)|0)<2))for(const i of list)g[i]=1; } }
    for(let i=0;i<N;i++)if(g[i])tile[i]=TF;
    let magSeeds=[];
    if(stratum.k==='cavern'){
    // the river meanders from the west edge to the east edge, carving its own channel through the rock
    const path=[]; { let ry=RI(10,UH-11), ty=RI(8,UH-9); for(let x=2;x<UW-2;x++){ ry=clamp(ry+clamp(Math.round((ty-ry)*0.1+(vnoise(x*0.15,7.3,0.5)-0.5)*2.6),-1,1),4,UH-5); path.push([x,ry]); if(rand()<0.05)ty=RI(8,UH-9); } }
    path.forEach(([px,py],pi)=>{ const pa=path[Math.max(0,pi-2)], pb=path[Math.min(path.length-1,pi+2)], ang=Math.atan2(pb[1]-pa[1],pb[0]-pa[0]);
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){ const d=Math.hypot(dx,dy), x=px+dx, y=py+dy; if(edgeOf(x,y)<1)continue; const i=y*W+x;
        if(d<=0.9){ tile[i]=TF; liquid[i]=LQ_DEEP; flow[i]=ang+10; } else if(d<=1.8){ tile[i]=TF; if(liquid[i]!==LQ_DEEP)liquid[i]=LQ_WATER; flow[i]=ang+10; } } });
    const ford=k=>{ const [px,py]=path[clamp(k,0,path.length-1)]; for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){ const i=(py+dy)*W+px+dx; if(Math.hypot(dx,dy)<=1.8&&tile[i]===TF&&liquid[i]===LQ_DEEP)liquid[i]=LQ_WATER; } };
    for(let k=RI(4,8);k<path.length;k+=RI(9,15))ford(k);
    // make sure everything walkable is reachable: add fords until it is
    { const anyWalk=()=>{ for(let i=0;i<N;i++)if(walk(i)&&!liquid[i])return i; return -1; };
      for(let tries=0;tries<40;tries++){ const s0=anyWalk(), seen=new Uint8Array(N), st=[s0]; seen[s0]=1; while(st.length){ const c=st.pop(); for(const d of D4){ const j=c+d[0]+d[1]*W; if(!seen[j]&&walk(j)){seen[j]=1;st.push(j);} } }
        let missing=false; for(let i=0;i<N;i++)if(walk(i)&&!seen[i]){missing=true;break;} if(!missing)break; ford(RI(0,path.length-1)); }
      for(let i=0;i<N;i++)if(liquid[i]===LQ_DEEP&&tile[i]!==TF)liquid[i]=0; }
    } else if(stratum.k==='abyss'){
      // ---- the Abyss (after DCSS's Abyss and NetHack's Gehennom): fragments of the world above, drifting over the void, tied together by rope bridges
      const cand0=[]; for(let i=0;i<N;i++)if(tile[i]===TF&&edgeOf(i%W,(i/W)|0)>3)cand0.push(i);
      magSeeds=[cand0[Math.floor(rand()*cand0.length)]];
      while(magSeeds.length<10){ let bi=-1,bd=-1; for(let t=0;t<300;t++){ const c=cand0[Math.floor(rand()*cand0.length)]; let md=1e9; for(const o of magSeeds){ const d=(c%W-o%W)**2+(((c/W)|0)-((o/W)|0))**2; if(d<md)md=d; } if(md>bd){bd=md;bi=c;} } if(bd<30)break; magSeeds.push(bi); }
      for(let i=0;i<N;i++)if(tile[i]===TF)tile[i]=TC;
      for(const c of magSeeds){ const cx=c%W, cy=(c/W)|0;
        if(rand()<0.45){ const hw=RI(2,3), hh=RI(1,3); for(let y=cy-hh;y<=cy+hh;y++)for(let x=cx-hw;x<=cx+hw;x++){ if(edgeOf(x,y)>=2&&rand()>0.06)tile[y*W+x]=TF; } }
        else { const rr=R(2.2,3.8); for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){ const x=cx+dx, y=cy+dy; if(edgeOf(x,y)<2)continue; if(Math.hypot(dx,dy)<=rr+vnoise(x*0.5,2.9,y*0.5)*1.4-0.5)tile[y*W+x]=TF; } }
        tile[c]=TF; }
      const span=(a,b)=>{ let x=a%W, y=(a/W)|0; const tx=b%W, ty=(b/W)|0, hf=rand()<0.5;
        const put=(dir)=>{ const i=y*W+x; if(tile[i]===TC||tile[i]===TW){ tile[i]=TF; bridge[i]=1; bridgeDir[i]=dir; } };
        const sx=()=>{ while(x!==tx){ x+=Math.sign(tx-x); put(0); } }, sy=()=>{ while(y!==ty){ y+=Math.sign(ty-y); put(1); } };
        if(hf){sx();sy();}else{sy();sx();} };
      { const inT=[0], rest2=new Set(magSeeds.map((_,k)=>k)); rest2.delete(0);
        const dd=(a,b)=>Math.abs(magSeeds[a]%W-magSeeds[b]%W)+Math.abs(((magSeeds[a]/W)|0)-((magSeeds[b]/W)|0));
        while(rest2.size){ let best=null,bd2=1e9; for(const a of inT)for(const b of rest2){ const d=dd(a,b); if(d<bd2){bd2=d;best=[a,b];} } span(magSeeds[best[0]],magSeeds[best[1]]); inT.push(best[1]); rest2.delete(best[1]); }
        for(let k=0;k<2;k++){ const a=RI(0,magSeeds.length-1), b=RI(0,magSeeds.length-1); if(a!==b)span(magSeeds[a],magSeeds[b]); } }
      { const seen=new Uint8Array(N), st=[magSeeds[0]]; seen[magSeeds[0]]=1; while(st.length){ const c=st.pop(); for(const d of D4){ const j=c+d[0]+d[1]*W; if(!seen[j]&&walk(j)){seen[j]=1;st.push(j);} } }
        for(let i=0;i<N;i++)if(walk(i)&&!seen[i]){ tile[i]=TC; bridge[i]=0; } }
    } else {
      // ---- the Magma Sea (after Dwarf Fortress): basalt islands joined by narrow causeways over a sea of lava
      const cand0=[]; for(let i=0;i<N;i++)if(tile[i]===TF&&edgeOf(i%W,(i/W)|0)>3)cand0.push(i);
      magSeeds=[cand0[Math.floor(rand()*cand0.length)]];
      while(magSeeds.length<11){ let bi=-1,bd=-1; for(let t=0;t<300;t++){ const c=cand0[Math.floor(rand()*cand0.length)]; let md=1e9; for(const o of magSeeds){ const d=(c%W-o%W)**2+(((c/W)|0)-((o/W)|0))**2; if(d<md)md=d; } if(md>bd){bd=md;bi=c;} } if(bd<24)break; magSeeds.push(bi); }
      for(let i=0;i<N;i++)if(tile[i]===TF)liquid[i]=LQ_LAVA;
      for(const c of magSeeds){ const rr=R(2.6,4.6), cx=c%W, cy=(c/W)|0; for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){ const x=cx+dx, y=cy+dy; if(edgeOf(x,y)<1)continue; const i=y*W+x; if(Math.hypot(dx,dy)<=rr+vnoise(x*0.5,1.7,y*0.5)*1.2-0.4){ tile[i]=TF; liquid[i]=0; } } }
      const causeway=(a,b)=>{ let x=a%W, y=(a/W)|0; const tx=b%W, ty=(b/W)|0;
        for(let guard=0;(x!==tx||y!==ty)&&guard<500;guard++){ const dx=tx-x, dy=ty-y;
          if(rand()<0.3){ if(rand()<0.5&&dy!==0)y+=Math.sign(dy); else if(dx!==0)x+=Math.sign(dx); else y+=Math.sign(dy); }
          else if(Math.abs(dx)>Math.abs(dy))x+=Math.sign(dx); else y+=Math.sign(dy);
          x=clamp(x,2,UW-3); y=clamp(y,2,UH-3); const i=y*W+x; tile[i]=TF; liquid[i]=0;
          { const j=i+(rand()<0.5?1:W); if(edgeOf(j%W,(j/W)|0)>=1){ tile[j]=TF; liquid[j]=0; } } } };
      { const inT=[0], rest2=new Set(magSeeds.map((_,k)=>k)); rest2.delete(0);
        const dd=(a,b)=>Math.abs(magSeeds[a]%W-magSeeds[b]%W)+Math.abs(((magSeeds[a]/W)|0)-((magSeeds[b]/W)|0));
        while(rest2.size){ let best=null,bd2=1e9; for(const a of inT)for(const b of rest2){ const d=dd(a,b); if(d<bd2){bd2=d;best=[a,b];} } causeway(magSeeds[best[0]],magSeeds[best[1]]); inT.push(best[1]); rest2.delete(best[1]); }
        for(let k=0;k<2;k++){ const a=RI(0,magSeeds.length-1), b=RI(0,magSeeds.length-1); if(a!==b)causeway(magSeeds[a],magSeeds[b]); } }
      // cooled crust: obsidian footholds creeping out from the shores
      for(let i=W;i<N-W;i++){ if(liquid[i]!==LQ_LAVA||tile[i]!==TF)continue; if(D4.some(d=>walk(i+d[0]+d[1]*W))&&vnoise((i%W)*0.4,4.2,((i/W)|0)*0.4)>0.55&&rand()<0.55)liquid[i]=0; }
      { const seen=new Uint8Array(N), st=[magSeeds[0]]; seen[magSeeds[0]]=1; while(st.length){ const c=st.pop(); for(const d of D4){ const j=c+d[0]+d[1]*W; if(!seen[j]&&walk(j)){seen[j]=1;st.push(j);} } }
        for(let i=0;i<N;i++)if(walk(i)&&!seen[i])liquid[i]=LQ_LAVA; }
    }
    // regions: each part of the cave system gets its own character (multi-source flood from far-apart seeds)
    const cand=[]; for(let i=0;i<N;i++)if(walk(i)&&!liquid[i])cand.push(i);
    const seeds=(stratum.k==='magma'||stratum.k==='abyss')?magSeeds.filter(c=>walk(c)):[cand[Math.floor(rand()*cand.length)]];
    while(seeds.length<7){ let bi=-1,bd=-1; for(let t=0;t<400;t++){ const c=cand[Math.floor(rand()*cand.length)]; let md=1e9; for(const o of seeds){ const d=(c%W-o%W)**2+(((c/W)|0)-((o/W)|0))**2; if(d<md)md=d; } if(md>bd){bd=md;bi=c;} } if(bd<36)break; seeds.push(bi); }
    { const q=[]; seeds.forEach((sd0,k)=>{ roomOf[sd0]=k; q.push(sd0); }); for(let h=0;h<q.length;h++){ const c=q[h]; for(const d of D4){ const j=c+d[0]+d[1]*W; if((tile[j]===TF||(stratum.k==='abyss'&&tile[j]===TC))&&roomOf[j]<0){ roomOf[j]=roomOf[c]; q.push(j); } } } }
    const cw=stratum.cw||{warren:0.8,mossfield:2,towercap:2.2,lake:1.6,crystal:1.2,fungal:1,swamp:0.8,chasm:0.9,magma:depth>=4?0.9:0};
    const pickCW=()=>{ let tot=0; for(const k in cw)tot+=cw[k]; let r0=rand()*tot; for(const k in cw){ r0-=cw[k]; if(r0<=0)return BIOMES[k]; } return BIOMES.mossfield; };
    caves=seeds.map((sd0,k)=>{ const cells0=[]; let x0=W,y0=H,x1=0,y1=0; for(let i=0;i<N;i++)if(roomOf[i]===k){ cells0.push(i); const x=i%W, y=(i/W)|0; x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y); }
      return {x:x0,y:y0,w:x1-x0+1,h:y1-y0+1,shape:'cave',cave:true,noShell:true,cells0,cx:sd0%W,cy:(sd0/W)|0,theme:stratum.k==='abyss'?(k===0?BIOMES.abyssal:pick([BIOMES.abyssal,BIOMES.mossfield,BIOMES.crystal,BIOMES.towercap,BIOMES.fungal,BIOMES.abyssal])):stratum.k==='magma'?(k===0||rand()<0.6?BIOMES.basalt:rand()<0.75?BIOMES.ashfield:BIOMES.crystal):(k===0?BIOMES.mossfield:pickCW()),cells:[],chasm:[],lava:[],mush:[]}; });
    const all=[]; for(let i=0;i<N;i++)if(tile[i]===TF||(stratum.k==='abyss'&&tile[i]===TC))all.push(i);
    caves.push({x:1,y:1,w:UW-2,h:UH-2,shape:'cave',cave:true,shell:true,cells0:all,cx:caves[0].cx,cy:caves[0].cy,theme:BIOMES.cavern,cells:[],chasm:[],lava:[],mush:[]});
    rooms=caves.slice(); normals=[];
    rooms.forEach(r=>{ r.deep=[]; r.bog=[]; r.xtal=[]; r.clusters=[]; });
  }
  // cavern ceilings rise toward the middle
  rooms.forEach((r,ri)=>{
    if(!r.cave||r.shell)return;
    const q=[];
    for(const i of r.cells0){ if(D4.some(d=>roomOf[i+d[0]+d[1]*W]!==ri)){ dfield[i]=1; q.push(i); } }
    for(let h=0;h<q.length;h++){ const i=q[h]; for(const d of D4){ const j=i+d[0]+d[1]*W; if(roomOf[j]===ri&&!dfield[j]){ dfield[j]=dfield[i]+1; q.push(j);} } }
    const B=r.theme;
    for(const i of r.cells0)ceil[i]=Math.round(Math.min(B.base,3.6+(dfield[i]-1)*B.slope)/0.4)*0.4;
  });
  const startI=rooms[0].cy*W+rooms[0].cx;
  const flood=from=>{ const seen=new Uint8Array(N), st=[from]; seen[from]=1; let c=0;
    while(st.length){ const i=st.pop(); c++; const x=i%W, y=(i/W)|0;
      for(const d of D4){ const j=(y+d[1])*W+x+d[0]; if(!seen[j]&&walk(j)){seen[j]=1;st.push(j);} } }
    return c; };
  const countTF=()=>{ let c=0; for(let i=0;i<N;i++)if(walk(i))c++; return c; };
  // vaults: stamp a few hand-drawn ASCII rooms into ordinary rooms, keeping every walkable cell reachable
  const vaultCell=new Uint8Array(N);
  const stampAt=(r,vt,m,ox,oy)=>{
    const saved=[], fx=[];
    for(let y=0;y<m.length;y++)for(let x=0;x<m[0].length;x++){
      const ch=m[y][x]; if(ch===' ')continue; const xx=ox+x, yy=oy+y; if(xx<1||yy<1||xx>UW-2||yy>UH-2)continue; const i=yy*W+xx;
      saved.push([i,tile[i],liquid[i],surface[i]]); surface[i]=0; liquid[i]=0;
      if(ch==='#'||ch==='H')tile[i]=TW; else if(ch===':')tile[i]=TC; else if(ch==='X'){ tile[i]=TX; xtalCol.set(i,vt.wcol); } else if(ch==='0'||ch==='&'||ch==='_'){ tile[i]=TP; if(ch!=='0')fx.push([ch,i]); }
      else { tile[i]=TF; if(ch==='~')liquid[i]=LQ_WATER; else if(ch==='W')liquid[i]=LQ_DEEP; else if(ch==='L')liquid[i]=LQ_LAVA; else if(ch==='"')surface[i]=rand()<0.5?SF_LUMEN:SF_GRASS; else if(ch==='x')surface[i]=SF_RUBBLE; else if(ch==='*'||ch==='c')fx.push([ch,i]); }
    }
    if(flood(startI)!==countTF()){ for(const [i,t0,l0,s0] of saved){ tile[i]=t0; liquid[i]=l0; surface[i]=s0; } return false; }
    r.vfx=(r.vfx||[]).concat(fx); const vi=VAULTS.indexOf(vt)+1; for(const [i] of saved)vaultCell[i]=vi; return true;
  };
  for(const r of rooms){ if(!r.forceVault)continue; const vt=r.forceVault, m=vt.map.map(x=>x.split(''));
    if(stampAt(r,vt,m,r.x+((r.w-m[0].length)>>1),r.y+((r.h-m.length)>>1))){ r.vault=vt; r.kindMsg=vt.msg; } }
  if(stratum.k==='town'){
    // the town: a fountain plaza in the middle, houses, shops and a temple on a loose grid around it
    const big=rooms[1], hs=VAULTS.filter(v=>v.k==='house'||v.k==='shop'), tp=VAULTS.find(v=>v.k==='townTemple'), fo=VAULTS.find(v=>v.k==='townFountain');
    stampAt(big,fo,fo.map.map(x=>x.split('')),big.cx-3,big.cy-2);
    let templeDone=false;
    for(let gy=big.y+1;gy+8<=big.y+big.h;gy+=9)for(let gx=big.x+1;gx+10<=big.x+big.w;gx+=11){
      if(Math.abs(gx+4-big.cx)<9&&Math.abs(gy+3-big.cy)<6)continue;
      if(rand()<0.12)continue;
      const vt=(!templeDone&&rand()<0.3)?tp:pick(hs), m=vaultCells(vt);
      if(stampAt(big,vt,m,gx+RI(0,1),gy+RI(0,1))&&vt===tp)templeDone=true;
    }
  }
  if(stratum.k==='maze'||stratum.k==='ruins'||stratum.k==='oracle'){
    const sk=stratum.k==='oracle'?'maze':stratum.k;
    const want=stratum.k==='ruins'?RI(2,3):RI(1,2), opts=VAULTS.filter(v=>stratum.vaults?stratum.vaults.includes(v.k):(v.strata.includes(sk)&&depth>=v.minD)); let placed=0;
    const order=rooms.map((_,i)=>i).filter(i=>i>0).sort(()=>rand()-0.5).sort((a2,b2)=>(rooms[b2].vaultPref?1:0)-(rooms[a2].vaultPref?1:0));
    for(const ri of order){
      if(placed>=want||!opts.length)break;
      const r=rooms[ri]; if(r.cave||r.shape!=='rect'||r.vault)continue;
      let mg=2; const fit=(w,h)=>w<=r.w-mg&&h<=r.h-mg;
      let fits=opts.filter(v=>fit(v.map[0].length,v.map.length)||fit(v.map.length,v.map[0].length));
      if(!fits.length&&r.ruin){ mg=0; fits=opts.filter(v=>fit(v.map[0].length,v.map.length)||fit(v.map.length,v.map[0].length)); }
      if(!fits.length)continue;
      let tw=0; for(const v of fits)tw+=v.map.length*v.map[0].length; let r0=rand()*tw, vt=fits[0]; for(const v of fits){ r0-=v.map.length*v.map[0].length; if(r0<=0){vt=v;break;} }
      let m=vaultCells(vt);
      if(!fit(m[0].length,m.length)){ const t2=[]; for(let x=0;x<m[0].length;x++)t2.push(m.map(row=>row[x])); m=t2; }
      if(!fit(m[0].length,m.length))continue;
      const vh=m.length, vw=m[0].length;
      const ox=r.x+Math.floor((r.w-vw)/2), oy=r.y+Math.floor((r.h-vh)/2), saved=[], fx=[];
      for(let y=0;y<vh;y++)for(let x=0;x<vw;x++){
        const ch=m[y][x]; if(ch===' ')continue; const i=(oy+y)*W+ox+x;
        saved.push([i,tile[i],liquid[i],surface[i]]); surface[i]=0; liquid[i]=0;
        if(ch==='#'||ch==='H')tile[i]=TW; else if(ch===':')tile[i]=TC; else if(ch==='X'){ tile[i]=TX; xtalCol.set(i,vt.wcol); } else if(ch==='0'||ch==='&'||ch==='_'){ tile[i]=TP; if(ch!=='0')fx.push([ch,i]); }
        else { tile[i]=TF; if(ch==='~')liquid[i]=LQ_WATER; else if(ch==='W')liquid[i]=LQ_DEEP; else if(ch==='L')liquid[i]=LQ_LAVA; else if(ch==='"')surface[i]=rand()<0.5?SF_LUMEN:SF_GRASS; else if(ch==='x')surface[i]=SF_RUBBLE; else if(ch==='*'||ch==='c')fx.push([ch,i]); }
      }
      if(flood(startI)!==countTF()){ for(const [i,t0,l0,s0] of saved){ tile[i]=t0; liquid[i]=l0; surface[i]=s0; } continue; }
      r.vault=vt; r.vfx=fx; r.kindMsg=vt.msg; if(r.ruin)r.rkind='vault'; placed++;
      const vi=VAULTS.indexOf(vt)+1; for(const [i] of saved)vaultCell[i]=vi;
    }
  }
  // bridges: rope bridges over chasms, stone causeways over deep water, laid where they save the longest detour
  const bfsDist=(a,b)=>{ const dd=new Int32Array(N).fill(-1), q=[a]; dd[a]=0; for(let h=0;h<q.length;h++){ const i=q[h]; if(i===b)return dd[i]; for(const d of D4){ const j=i+d[0]+d[1]*W; if(dd[j]<0&&walk(j)){dd[j]=dd[i]+1;q.push(j);} } } return -1; };
  const bridgeAcross=(r,isGap,kind)=>{
    const cands=[];
    for(const a of r.cells0){ if(!walk(a))continue; for(const d of D4){ let j=a+d[0]+d[1]*W, k=0; while(isGap(j)&&k<12){ j+=d[0]+d[1]*W; k++; } if(k<2||k>9||!walk(j))continue; cands.push([a,j,d,k]); } }
    if(!cands.length)return false;
    let best=null,bs=-1;
    for(let t=0;t<Math.min(40,cands.length);t++){ const c=cands[Math.floor(rand()*cands.length)]; const dd=bfsDist(c[0],c[1]); const sc=(dd<0?1000:dd)-c[2+1]; if(sc>bs){bs=sc;best=c;} }
    if(!best||bs<6)return false;
    const [a,,d,k]=best; let j=a+d[0]+d[1]*W;
    for(let st=0;st<k;st++){ bridge[j]=kind; bridgeDir[j]=d[0]?0:1; if(kind===1)tile[j]=TF; else liquid[j]=0; j+=d[0]+d[1]*W; }
    return true;
  };
  // biome terrain
  rooms.forEach(r=>{
    if(!r.cave)return;
    const blob=minD=>r.cells0.filter(i=>{ const x=i%W+0.5, y=((i/W)|0)+0.5, dx=(x-(r.x+r.w/2))/(r.w*0.3), dy=(y-(r.y+r.h/2))/(r.h*0.3);
      return tile[i]===TF&&dx*dx+dy*dy<1+0.3*Math.sin(x*0.9+y*0.7)&&dfield[i]>=minD; });
    if(r.theme.k==='chasm'){
      const b=blob(2);
      if(b.length<10)r.theme=BIOMES.lake;
      else{
        b.forEach(i=>tile[i]=TC);
        for(let tries=0;tries<3&&flood(startI)!==countTF();tries++)if(!bridgeAcross(r,j=>tile[j]===TC,1))break;
        if(flood(startI)!==countTF()){
          b.forEach(i=>{ tile[i]=TF; bridge[i]=0; });
          const b3=blob(3); b3.forEach(i=>tile[i]=TC);
          if(flood(startI)!==countTF()){ b3.forEach(i=>tile[i]=TF); r.theme=BIOMES.lake; }
          else bridgeAcross(r,j=>tile[j]===TC,1);
        } else if(rand()<0.8)bridgeAcross(r,j=>tile[j]===TC,1);
      }
    }
    if(r.theme.k==='lake'){
      blob(2).forEach(i=>liquid[i]=LQ_WATER);
      const core=blob(3).filter(i=>liquid[i]===LQ_WATER);
      if(core.length>=6){
        core.forEach(i=>liquid[i]=LQ_DEEP);
        for(let tries=0;tries<3&&flood(startI)!==countTF();tries++)if(!bridgeAcross(r,j=>liquid[j]===LQ_DEEP,2))break;
        if(flood(startI)!==countTF())core.forEach(i=>{ liquid[i]=LQ_WATER; bridge[i]=0; });
        else if(rand()<0.6)bridgeAcross(r,j=>liquid[j]===LQ_DEEP,2);
      }
    }
    if(r.theme.k==='towercap'||r.theme.k==='mossfield'){ /* vegetation comes from the surface pass and the lights below */ }
    if(r.theme.k==='warren'){
      for(const i of r.cells0){ if(tile[i]!==TF||liquid[i])continue; const v=vnoise((i%W)*0.5,6.6,((i/W)|0)*0.5); surface[i]=v>0.68?SF_HAY:SF_MUD; }
    }
    if(r.theme.k==='swamp'){
      for(const i of r.cells0){ if(tile[i]!==TF||liquid[i])continue; if(vnoise((i%W)*0.4,2.2,((i/W)|0)*0.4)>0.55)surface[i]=SF_MUD; }
      for(const i of r.cells0){ if(tile[i]!==TF)continue; const x=i%W, y=(i/W)|0; const v=vnoise(x*0.33,0.5,y*0.33)*0.7+vnoise(x*0.9,3.1,y*0.9)*0.3; if(v>0.46)liquid[i]=LQ_BOG; }
    }
    if(r.theme.k==='crystal'){
      const pal=[[0.55,0.85,1.0],[0.75,0.6,1.0],[0.85,0.95,1.0],[0.5,1.0,0.85]];
      const pool=r.cells0.filter(i=>tile[i]===TF&&dfield[i]>=2), seeds=[];
      for(let t=0;t<60&&seeds.length<9;t++){ const c=pool[Math.floor(rand()*pool.length)]; if(c===undefined)break; if(seeds.every(o=>Math.hypot(o%W-c%W,((o/W)|0)-((c/W)|0))>3.5))seeds.push(c); }
      for(const s0 of seeds){
        const rad=R(0.8,1.9), sx=s0%W, sy=(s0/W)|0, cl=r.cells0.filter(i=>tile[i]===TF&&Math.hypot(i%W-sx,((i/W)|0)-sy)<=rad);
        cl.forEach(i=>tile[i]=TX);
        if(flood(startI)!==countTF()){ cl.forEach(i=>tile[i]=TF); continue; }
        const col=pick(pal); cl.forEach(i=>xtalCol.set(i,col)); r.clusters.push({c:s0,col});
      }
      for(const i of r.cells0){ if(tile[i]!==TF||dfield[i]!==1||rand()>0.22)continue; tile[i]=TX; if(flood(startI)!==countTF())tile[i]=TF; else xtalCol.set(i,pick(pal)); }
    }
    if(r.theme.k==='magma'){
      let ok=false;
      for(const md of [2,3,4]){ const b=blob(md); if(b.length<6)continue; b.forEach(i=>liquid[i]=LQ_LAVA); if(flood(startI)===countTF()){ok=true;break;} b.forEach(i=>liquid[i]=0); }
      if(!ok)blob(2).forEach(i=>surface[i]=SF_OBSIDIAN);
    }
    if(r.theme.k==='cathedral'){
      for(let py=r.y+2;py<r.y+r.h-2;py+=4)for(let px=r.x+2;px<r.x+r.w-2;px+=4){
        const blk=[py*W+px,py*W+px+1,(py+1)*W+px,(py+1)*W+px+1];
        if(!blk.every(i=>tile[i]===TF&&roomOf[i]===rooms.indexOf(r)&&dfield[i]>=3))continue;
        blk.forEach(i=>tile[i]=TW); if(flood(startI)!==countTF())blk.forEach(i=>tile[i]=TF);
      }
    }
  });
  // pillars in ordinary rooms
  let base=flood(startI);
  rooms.forEach(r=>{
    if(r.cave||r.vault||r.special||r.shape!=='rect'||r.w<7||r.h<6||(r.ruin?r.rkind!=='hall':rand()<0.25))return;
    for(let py=r.y+2;py<r.y+r.h-2;py+=3)for(let px=r.x+2;px<r.x+r.w-2;px+=3){
      if(px===r.cx||py===r.cy)continue; const i=py*W+px; if(tile[i]!==TF)continue;
      tile[i]=TP; const c=flood(startI); if(c!==base-1)tile[i]=TF; else base=c;
    }
  });
  const TH=stratum.themes?stratum.themes:stratum.k==='ruins'?RUIN_THEMES:stratum.k==='fortress'?FORT_THEMES:THEMES;
  const pickTheme=()=>{ let tot=0; const ws=TH.map(th=>{ const w=th.fix==='brazier'?1.7-1.2*prof.t:th.k==='emerald'?0.6+0.9*prof.t:1; tot+=w; return w; });
    let r0=rand()*tot; for(let k=0;k<TH.length;k++){ r0-=ws[k]; if(r0<=0)return TH[k]; } return TH[0]; };
  normals.forEach((r,i)=>{ let th; do{th=pickTheme();}while(i>0&&th===normals[i-1].theme&&rand()<0.85); r.theme=th; });
  // pools in ordinary rooms: water near the surface, lava in the depths
  normals.forEach((r,ri)=>{
    if(ri===0||r.vault||r.special||r.fort||r.w<6||r.h<5)return;
    const lava=rand()<prof.lavaPool, bogp=!lava&&rand()<prof.bogPool, wet=!lava&&!bogp&&rand()<0.3; if(!lava&&!wet&&!bogp)return;
    const k=lava?1.7:1.3, rx=r.w/2-k, ry=r.h/2-k, ox=r.x+r.w/2+R(-0.8,0.8), oy=r.y+r.h/2+R(-0.6,0.6);
    const pool=[];
    for(let yy=r.y;yy<r.y+r.h;yy++)for(let xx=r.x;xx<r.x+r.w;xx++){ const i=yy*W+xx; if(roomOf[i]!==ri||tile[i]!==TF)continue; const dx=(xx+0.5-ox)/rx, dy=(yy+0.5-oy)/ry; if(dx*dx+dy*dy<1)pool.push(i); }
    if(!pool.length)return;
    pool.forEach(i=>liquid[i]=lava?LQ_LAVA:bogp?LQ_BOG:LQ_WATER);
    if(lava&&flood(startI)!==countTF())pool.forEach(i=>liquid[i]=0);
    if(wet&&pool.length>=14){ const ps=new Set(pool), core=pool.filter(i=>D4.every(d=>ps.has(i+d[0]+d[1]*W)));
      if(core.length>=3){ core.forEach(i=>liquid[i]=LQ_DEEP); if(flood(startI)!==countTF())core.forEach(i=>liquid[i]=LQ_WATER); } }
  });
  for(let i=0;i<N;i++){ const ri=roomOf[i]; if(ri<0)continue; const R0=rooms[ri];
    if(tile[i]===TC)R0.chasm.push(i); else if(tile[i]===TX)R0.xtal.push(i);
    else if(tile[i]===TF){ const l=liquid[i]; if(l===LQ_LAVA)R0.lava.push(i); else if(l===LQ_DEEP)R0.deep.push(i); else { R0.cells.push(i); if(l===LQ_BOG)R0.bog.push(i); } } }
  // surface layer: moss, luminescent fungus, cooled obsidian around lava
  for(let i=0;i<N;i++){
    if(!walk(i)||liquid[i])continue;
    let nearLava=false; for(let dy=-1;dy<=1&&!nearLava;dy++)for(let dx=-1;dx<=1;dx++){ if(liquid[i+dx+dy*W]===LQ_LAVA){nearLava=true;break;} }
    if(nearLava){ surface[i]=SF_OBSIDIAN; continue; }
    if(surface[i])continue;
    const ri=roomOf[i], nearWall=D4.some(d=>tile[i+d[0]+d[1]*W]===TW), k=ri>=0?rooms[ri].theme.k:'';
    const lum=k==='emerald'||k==='fungal'||k==='towercap'||k==='mossfield', shore=(k==='lake'||stratum.k==='cavern')&&D4.some(d=>liquid[i+d[0]+d[1]*W]===LQ_WATER||liquid[i+d[0]+d[1]*W]===LQ_DEEP), swamp=k==='swamp'||D4.some(d=>liquid[i+d[0]+d[1]*W]===LQ_BOG);
    const p=k==='mossfield'?0.85:lum?0.55:swamp?0.42:shore?0.35:(nearWall?0.07:0.015)*prof.grass;
    if(rand()<p)surface[i]=swamp?(rand()<0.7?SF_DEAD:SF_GRASS):(lum||shore||rand()<prof.lumen*0.2)?SF_LUMEN:SF_GRASS;
  }
  // stairs in the farthest area
  const dist=new Int32Array(N).fill(-1); { const q=[startI]; dist[startI]=0; for(let h=0;h<q.length;h++){ const i=q[h]; for(const d of D4){ const j=i+d[0]+d[1]*W; if(dist[j]<0&&walk(j)){dist[j]=dist[i]+1;q.push(j);} } } }
  let best=1,bd=-1; rooms.forEach((r,ri)=>{ if(ri===0||!r.cells.length)return; const d=dist[r.cells[0]]; if(d>bd){bd=d;best=ri;} });
  // a level of one great cave has no other room: the stairs go to the farthest dry floor from the start
  let stI; const sroom=rooms[best]&&best!==0?rooms[best]:null;
  if(!sroom){ let far=-1; stI=startI; for(let i=0;i<N;i++){ if(dist[i]>far&&!liquid[i]&&walk(i)){ far=dist[i]; stI=i; } } }
  else { stI=sroom.cells[0]; let sbd=1e9;
    for(const i of sroom.cells){ if(liquid[i])continue; const d=(i%W-sroom.cx)**2+(((i/W)|0)-sroom.cy)**2; if(d<sbd){sbd=d;stI=i;} } }
  liquid[stI]=0; surface[stI]=0;

  // lights and fixtures
  const lights=[], fixtures=[], fixCell=new Map(), used=new Set();
  const addFix=(type,ci,col,y,int,rad,chr)=>{
    if(lights.length>=NSL)return;
    const x=(ci%W+0.5)*CELL, z=(((ci/W)|0)+0.5)*CELL;
    lights.push({x,y,z,col,int,rad,type,ph:rand()*100,f:1,vis:null});
    fixtures.push({type,x,z,col,li:lights.length-1,acc:0,ph:rand()*6.28});
    fixCell.set(ci,{ch:chr,col}); used.add(ci);
  };
  addFix('stairs',stI,[1.0,0.76,0.36],1.7,2.0,8.5,'>');
  // doors where a corridor meets an ordinary room
  const doors=[], doorAt=new Int16Array(N).fill(-1);
  for(let i=0;i<N;i++){
    if(!walk(i)||roomOf[i]>=0||used.has(i))continue;
    for(const d of D4){
      const j=i+d[0]+d[1]*W, rj=roomOf[j];
      if(rj<0||rooms[rj].cave||!walk(j))continue;
      if(tile[i-d[1]+d[0]*W]!==TW||tile[i+d[1]-d[0]*W]!==TW)continue;
      if(!walk(i-d[0]-d[1]*W))continue;
      if(rand()>prof.door)break;
      let close=false; for(const o of doors){ if(Math.abs(o.i%W-i%W)<=1&&Math.abs(((o.i/W)|0)-((i/W)|0))<=1){close=true;break;} }
      if(close)break;
      const cx=i%W, cz=(i/W)|0;
      doorAt[i]=doors.length; doors.push({i,j,bx:(cx+0.5+d[0]*0.5)*CELL,bz:(cz+0.5+d[1]*0.5)*CELL,yaw:Math.atan2(-d[0],-d[1]),o:0}); used.add(i); break;
    }
  }
  const cd=(a,b)=>(a%W-b%W)**2+(((a/W)|0)-((b/W)|0))**2;
  const spread=(cands,n)=>{ const out=[]; if(!cands.length||n<1)return out; out.push(cands[Math.floor(rand()*cands.length)]);
    while(out.length<n){ let bi=-1,bdd=-1; for(const c of cands){ let md=1e9; for(const o of out){const d=cd(c,o); if(d<md)md=d;} if(md>bdd){bdd=md;bi=c;} } if(bdd<9)break; out.push(bi);} return out; };
  const nearWallC=i=>D4.some(d=>tile[i+d[0]+d[1]*W]===TW);
  rooms.forEach(r=>{
    const th=r.theme, area=r.cells.length;
    const ok=r.cells.filter(i=>!used.has(i)&&cd(i,stI)>4);
    const dry=ok.filter(i=>!liquid[i]&&!bridge[i]);
    const edge=dry.filter(nearWallC);
    const inner=ok.filter(i=>!D4.some(d=>tile[i+d[0]+d[1]*W]!==TF));
    if(r.cave){
      switch(th.k){
        case 'lake': {
          const wet=ok.filter(i=>liquid[i]===LQ_WATER);
          for(const i of spread(wet.length?wet:ok,4))addFix('crystal',i,pick([[0.25,0.82,1.0],[0.5,0.68,1.0],[0.4,1.0,0.88]]),R(3.2,4.6),2.5,14,'*');
          for(const i of spread(edge,1))addFix('fungus',i,[0.3,0.9,1.0],0.6,1.3,8,'"');
          break; }
        case 'chasm':
          for(const i of spread(r.chasm,3))addFix('abyss',i,pick([[1.0,0.3,0.12],[1.0,0.55,0.15],[1.0,0.18,0.3]]),-3.2,3.4,13,'^');
          for(const i of spread(edge,2))addFix('brazier',i,[1.0,0.42,0.14],1.35,2.2,9,'*');
          break;
        case 'fungal':
          for(const i of spread(dry,5))addFix('fungus',i,pick([[0.25,1.0,0.55],[0.3,0.9,1.0],[0.6,1.0,0.35]]),0.6,1.6,9,'"');
          r.mush=spread(dry.filter(i=>dfield[i]>=2&&!used.has(i)),9);
          break;
        case 'swamp':
          for(const i of spread(ok.filter(i=>liquid[i]===LQ_BOG),4))addFix('marsh',i,pick([[0.55,1.0,0.45],[0.75,1.0,0.5],[0.4,0.95,0.7]]),1.3,1.4,8,'*');
          break;
        case 'crystal':
          for(const cl of r.clusters.slice(0,8))addFix('xlight',cl.c,cl.col,1.6,1.9,10.5,'#');
          break;
        case 'towercap':
          for(const i of spread(dry,4))addFix('fungus',i,pick([[0.72,0.55,1.0],[0.4,0.85,1.0]]),0.6,1.6,10,'"');
          r.mush=spread(dry.filter(i=>dfield[i]>=2&&!used.has(i)),16); r.giant=true;
          break;
        case 'mossfield':
          for(const i of spread(dry,3))addFix('fungus',i,[0.3,1.0,0.85],0.6,1.4,10,'"');
          for(const i of spread(dry.filter(i=>!used.has(i)),3))addFix('firefly',i,pick([[0.6,1.0,0.6],[0.5,0.95,1.0]]),1.4,1.1,8,'.');
          break;
        case 'abyssal':
          for(const i of spread(dry,2))addFix('crystal',i,pick([[0.6,0.4,1.0],[0.9,0.3,0.6]]),2.3,1.8,10,'*');
          break;
        case 'ashfield':
          for(const i of spread(dry,4))addFix('embers',i,[1.0,0.48,0.16],0.45,1.2,6.5,'*');
          break;
        case 'magma':
          for(const i of spread(edge,1))addFix('brazier',i,[1.0,0.3,0.1],1.35,1.6,8,'*');
          break;
        case 'cathedral':
          for(const i of spread(edge,4))addFix('brazier',i,pick([[1.0,0.55,0.17],[1.0,0.2,0.22]]),1.35,2.4,10,'*');
          for(const i of spread(dry.filter(i=>dfield[i]>=3),3))addFix('lamp',i,[1.0,0.7,0.35],ceil[i]-3.6,2.0,12,'*');
          break;
      }
      return;
    }
    const n=area>60?3:area>30?2:1;
    if(th.fix==='brazier'){ for(const i of spread(edge.length?edge:dry,n+(area>85?1:0)))addFix('brazier',i,th.col,1.35,2.4,9.5,'*'); }
    else if(th.fix==='crystal'){ for(const i of spread(inner.length?inner:ok,n))addFix('crystal',i,th.col,1.95,2.0,11,'*'); }
    else if(th.fix==='orb'){ for(const i of spread(edge.length?edge:dry,n+1))addFix('orb',i,th.col,1.65,2.1,11,'o'); }
    else if(th.fix==='rune'){ const c=r.cy*W+r.cx; const list=ok.includes(c)&&!liquid[c]?[c]:spread(inner.length?inner:dry,1); for(const i of list)addFix('rune',i,th.col,0.7,2.3,10.5,'0');
      if(area>55){ for(const i of spread(edge.filter(i=>!used.has(i)),1))addFix('crystal',i,th.col,1.95,1.5,8,'*'); } }
    else { for(const i of spread(dry,n+1))addFix('fungus',i,th.col,0.55,1.35,7.5,'"'); }
  });
  // Brogue-style machines: small story set pieces in ordinary rooms
  const solid=new Map(), decoCell=new Map();
  const trySolid=(i,rad)=>{ tile[i]=TP; const okc=flood(startI)===countTF(); tile[i]=TF; if(okc)solid.set(i,rad); return okc; };
  const mlist=['camp','altar','library','crypt','statues','collapse','bloodwort','flood'].concat(depth>=4?['lavaflow']:[],depth<=5?['idyll']:[],depth>=3?['dismal']:[],depth>=4?['remnant']:[]).sort(()=>rand()-0.5); let mk=0;
  normals.forEach((r,ri)=>{
    if(ri===0||r===sroom||r.vault||r.special||r.cells.length<14)return;
    if(r.fort&&!['crypt','library','statues'].includes(r.rkind))return;
    if(stratum.machines){ if(rand()>0.85)return; }
    else if(!r.fort&&(mk>=mlist.length||rand()>0.65))return;
    const type=stratum.machines?pick(stratum.machines):r.fort?r.rkind:mlist[mk++], md={type};
    const free=r.cells.filter(i=>!used.has(i)&&!liquid[i]&&cd(i,stI)>2);
    const edgeF=free.filter(nearWallC), innerF=free.filter(i=>!D4.some(d=>tile[i+d[0]+d[1]*W]!==TF));
    const one=list=>{ const o=spread(list,1)[0]; if(o!==undefined)used.add(o); return o; };
    if(type==='camp'){
      const f=one(innerF.length?innerF:free); if(f===undefined)return; md.fire=f; addFix('embers',f,[1.0,0.5,0.16],0.45,1.1,6,'*');
      md.beds=free.filter(i=>!used.has(i)&&cd(i,f)<=2).slice(0,2); md.beds.forEach(i=>{ used.add(i); decoCell.set(i,{ch:'=',col:[0.7,0.4,0.3]}); });
      md.bones=spread(free.filter(i=>!used.has(i)),4); md.bones.forEach(i=>decoCell.set(i,{ch:'%',col:[0.9,0.88,0.75]}));
    } else if(type==='altar'){
      const a=one(innerF.length?innerF:free); if(a===undefined)return; md.altar=a; addFix('relic',a,[1.0,0.82,0.42],1.55,1.7,8,'_'); trySolid(a,0.75);
    } else if(type==='library'){
      md.shelves=[];
      for(const i of edgeF){ if(md.shelves.length>=10)break; if(used.has(i))continue; const d=D4.find(d=>tile[i+d[0]+d[1]*W]===TW); md.shelves.push({i,dx:d[0],dz:d[1]}); used.add(i); decoCell.set(i,{ch:'[',col:[0.75,0.55,0.35]}); }
      const c=one(innerF.length?innerF:free); if(c!==undefined)addFix('pages',c,[0.62,0.48,1.0],2.2,1.3,8,'?');
      md.pages=spread(free.filter(i=>!used.has(i)),6);
    } else if(type==='crypt'){
      const c=one(innerF.length?innerF:free); if(c!==undefined)addFix('mist',c,[0.45,0.65,1.0],0.6,1.2,9,'~');
      md.tombs=[];
      for(const i of innerF){ if(md.tombs.length>=7)break; if(used.has(i)||((i%W+((i/W)|0))%2))continue; if(!trySolid(i,0.45))continue; used.add(i); md.tombs.push({i,yaw:rand()<0.5?0:Math.PI}); decoCell.set(i,{ch:'+',col:[0.7,0.72,0.9]}); }
    } else if(type==='statues'){
      md.statues=[];
      for(const i of spread(edgeF.filter(i=>!used.has(i)),5)){ if(!trySolid(i,0.5))continue; used.add(i); md.statues.push(i); decoCell.set(i,{ch:'&',col:[0.75,0.74,0.9]}); }
      md.awaken=md.statues.slice(0,depth>=3?2:1);
    } else if(type==='idyll'){
      const pool=innerF.length?innerF:free; if(pool.length<4)return;
      md.ponds=spread(pool,RI(1,2));
      for(const c of md.ponds)for(const i of r.cells){ if(!used.has(i)&&Math.hypot(i%W-c%W,((i/W)|0)-((c/W)|0))<=1.25){ liquid[i]=LQ_WATER; surface[i]=0; } }
      for(const i of r.cells){ if(!liquid[i]&&!used.has(i)&&rand()<0.75)surface[i]=rand()<0.35?SF_LUMEN:SF_GRASS; }
      const sc=one(free.filter(i=>!liquid[i])); if(sc!==undefined){ addFix('sun',sc,[1.0,0.93,0.78],ceil[sc]-0.3,2.2,9,'*'); fixCell.delete(sc); }
    } else if(type==='remnant'){
      const hw=Math.max(1,Math.floor((r.w-4)/2)), hh=Math.max(1,Math.floor((r.h-4)/2));
      md.carpet=[]; md.ash=[];
      for(const i of r.cells){ if(used.has(i)||liquid[i])continue; const dx=Math.abs(i%W-r.cx), dy=Math.abs(((i/W)|0)-r.cy); if(dx<=hw&&dy<=hh)md.carpet.push(i); else if(dx<=hw+1&&dy<=hh+1)md.ash.push(i); }
      if(md.carpet.length<4)return;
      md.carpet.forEach(i=>{ surface[i]=0; used.add(i); decoCell.set(i,{ch:'.',col:[0.95,0.35,0.32],k:'carpet'}); });
      md.ash.forEach(i=>{ surface[i]=0; });
      md.inert=[];
      for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ const i=(r.cy+sy*(hh+1))*W+r.cx+sx*(hw+1); if(r.cells.includes(i)&&!used.has(i)&&trySolid(i,0.5)){ used.add(i); md.inert.push(i); decoCell.set(i,{ch:'&',col:[0.75,0.74,0.9]}); } }
    } else if(type==='dismal'){
      md.blood=spread(free,5); md.bones2=spread(free.filter(i=>!md.blood.includes(i)),4); md.char=spread(free,5);
      md.blood.forEach(i=>decoCell.set(i,{ch:'~',col:[0.75,0.1,0.12],k:'blood'}));
      md.bones2.forEach(i=>decoCell.set(i,{ch:'%',col:[0.9,0.88,0.75]}));
      md.char.forEach(i=>{ surface[i]=0; });
    } else if(type==='bloodwort'){
      const c=one(edgeF.length?edgeF:free); if(c===undefined)return; md.plant=c;
      addFix('bloodwort',c,[1.0,0.25,0.3],1.0,1.4,6.5,'*'); trySolid(c,0.35);
    } else if(type==='flood'){
      // a spring behind a cracked wall: when you enter, water bursts out and spreads through the room (Brogue's flooded rooms)
      const src=one(edgeF.length?edgeF:free); if(src===undefined)return; const dW=D4.find(d=>tile[src+d[0]+d[1]*W]===TW)||[1,0];
      const before=fixtures.length; addFix('spring',src,[0.45,0.75,1.0],1.2,0.9,7,'~'); fixCell.delete(src); if(fixtures.length>before)fixtures[fixtures.length-1].wd=dW;
      const order=[], seen=new Set([src]), q=[src];
      for(let h=0;h<q.length&&order.length<80;h++){ const c=q[h]; order.push(c); for(const dd of D4){ const j=c+dd[0]+dd[1]*W; if(seen.has(j)||!walk(j)||liquid[j]||solid.has(j)||j===stI)continue; if(roomOf[j]>=0&&roomOf[j]!==ri)continue; seen.add(j); q.push(j); } }
      md.src=src; md.order=order;
    } else if(type==='lavaflow'){
      // a crack in the floor: when you enter, lava wells up and spreads, but only over cells that never cut the level apart
      const src=one(innerF.length?innerF:free); if(src===undefined)return;
      addFix('crater',src,[1.0,0.42,0.12],0.6,1.4,9,'^'); fixCell.delete(src);
      const order=[], seen=new Set([src]), q=[src];
      for(let h=0;h<q.length&&order.length<34;h++){ const c=q[h];
        liquid[c]=LQ_LAVA; const okc=flood(startI)===countTF(); liquid[c]=0; if(!okc&&c!==src)continue; order.push(c);
        for(const dd of D4){ const j=c+dd[0]+dd[1]*W; if(seen.has(j)||!walk(j)||liquid[j]||solid.has(j)||j===stI||roomOf[j]!==ri)continue; seen.add(j); q.push(j); } }
      order.forEach(j=>liquid[j]=LQ_LAVA); const allOk=flood(startI)===countTF(); order.forEach(j=>liquid[j]=0); if(!allOk)order.length=1;
      md.src=src; md.order=order;
    } else if(type==='collapse'){
      const pool=innerF.filter(i=>!used.has(i)); if(pool.length<6)return;
      const c0=pool[Math.floor(rand()*pool.length)], reg=pool.filter(i=>Math.hypot(i%W-c0%W,((i/W)|0)-((c0/W)|0))<=1.6);
      if(reg.length<3)return;
      reg.forEach(i=>tile[i]=TC); const okc=flood(startI)===countTF(); reg.forEach(i=>tile[i]=TF);
      if(!okc)return;
      md.pit=reg; reg.forEach(i=>used.add(i));
      addFix('pitglow',c0,[1.0,0.5,0.2],-4.5,2.6,10,':'); fixCell.delete(c0);
    }
    r.mdata=md; r.machine=type;
  });
  if(stratum.k==='cavern')rooms.forEach(r=>{ if(r.shell||!r.cells.length)return; const dry=r.cells.filter(i=>!liquid[i]&&!used.has(i)&&!bridge[i]);
    for(const i of spread(dry,2))addFix('fungus',i,pick([[0.3,0.9,1.0],[0.62,0.45,1.0],[0.35,1.0,0.6]]),0.6,1.5,11,'"'); });
  // the glow of the void, far below the fragments
  if(stratum.k==='abyss'){ const vo=[]; for(let i=0;i<N;i++)if(tile[i]===TC&&!bridge[i])vo.push(i); for(const i of spread(vo,9))addFix('abyss',i,pick([[0.6,0.35,1.0],[0.95,0.25,0.55],[0.4,0.6,1.0]]),-3.2,3.0,13,'^'); }
  let bstairs=null, portal=null, upstairs=-1;
  if(stratum.branch||stratum.realm){ const c=[1,-1,W,-W,W+1,W-1,-W+1,-W-1].map(o=>startI+o).find(j=>walk(j)&&!liquid[j]&&!used.has(j)&&!solid.has(j)&&j!==stI);
    if(c!==undefined){ addFix('upstairs',c,stratum.realm?REALMS[realm.key].col:BRANCHES[branch.key].col,1.6,1.5,7,'<'); upstairs=c; } }
  if(!stratum.branch&&!stratum.realm&&!stratum.special){
    const pickSpot=()=>{ const cand=[]; rooms.forEach((r,ri)=>{ if(ri===0||!r.cells.length||r.shell)return; for(const i of r.cells)if(walk(i)&&!liquid[i]&&!used.has(i)&&!solid.has(i)&&cd(i,stI)>36&&cd(i,startI)>25)cand.push(i); }); return cand.length?cand[Math.floor(rand()*cand.length)]:-1; };
    const bk=branchAtDepth(depth);
    if(bk){ const c=pickSpot(); if(c>=0){ addFix('bstairs',c,BRANCHES[bk].col,1.7,1.8,8.5,'>'); bstairs={cell:c,key:bk}; } }
    if(depth>=2&&rand()<0.3){ const ks=Object.keys(REALMS).filter(k=>depth>=REALMS[k].minD), rk=ks[Math.floor(rand()*ks.length)], c=pickSpot();
      if(c>=0){ addFix('portal',c,REALMS[rk].col,1.6,2.0,9,'0'); portal={cell:c,key:rk}; } }
  }
  // lava is itself a light source
  rooms.forEach(r=>{ if(!r.lava.length)return; const n=clamp(Math.round(r.lava.length/9),1,5); for(const i of spread(r.lava,n))addFix('lava',i,[1.0,0.4,0.1],0.8,2.6,10,'~'); });
  // wall-mounted torches: plentiful near the surface, rare in the depths
  const addTorch=(ci,d)=>{
    if(lights.length>=NSL)return;
    const cx=ci%W, cz=(ci/W)|0, wx=(cx+0.5+d[0]*0.5)*CELL, wz=(cz+0.5+d[1]*0.5)*CELL, nx=-d[0], nz=-d[1], x=wx+nx*0.45, z=wz+nz*0.45, col=[1.0,0.6,0.22];
    lights.push({x,y:2.05,z,col,int:1.9,rad:8.5,type:'torch',ph:rand()*100,f:1,vis:null});
    fixtures.push({type:'torch',x,z,wx,wz,nx,nz,col,li:lights.length-1,acc:0,ph:rand()*6.28});
    fixCell.set((cz+d[1])*W+cx+d[0],{ch:'#',col:[1.0,0.72,0.32]}); used.add(ci);
  };
  let nT=0;
  for(let i=0;i<N&&nT<24;i++){
    if(!walk(i)||liquid[i]||used.has(i))continue;
    const ri=roomOf[i]; if(ri>=0&&rooms[ri].cave)continue;
    if(rand()>(ri>=0?0.05:0.03)*prof.torch*(stratum.torchMul||1))continue;
    const fs=D4.filter(d=>tile[i+d[0]+d[1]*W]===TW); if(!fs.length)continue;
    let near=false; for(const f of fixtures){ if(Math.hypot(f.x/CELL-(i%W+0.5),f.z/CELL-(((i/W)|0)+0.5))<3.2){near=true;break;} }
    if(near)continue;
    addTorch(i,pick(fs)); nT++;
  }
  // vault features: lights, statues and altars marked in the drawing
  rooms.forEach(r=>{
    if(!r.vfx)return; r.vstat=[]; r.valtar=[]; r.vcarpet=[];
    for(const [ch,i] of r.vfx){
      if(ch==='*'){ if(r.theme.fix==='brazier')addFix('brazier',i,r.theme.col,1.35,2.2,9,'*'); else addFix('orb',i,r.theme.col,1.65,2.0,10,'o'); }
      else if(ch==='&'){ tile[i]=TF; solid.set(i,0.5); used.add(i); r.vstat.push(i); decoCell.set(i,{ch:'&',col:[0.75,0.74,0.9]}); }
      else if(ch==='c'){ used.add(i); r.vcarpet.push(i); decoCell.set(i,{ch:'.',col:[0.95,0.35,0.32],k:'carpet'}); }
      else if(ch==='_'){ tile[i]=TF; solid.set(i,0.6); used.add(i); r.valtar.push(i); addFix('relic',i,[1.0,0.82,0.42],1.55,1.6,8,'_'); }
    }
  });
  // ruins are lit by ancient lamps scattered through every district
  if(stratum.k==='ruins')rooms.forEach(r=>{ if(!r.ruin)return; for(const i of spread(r.cells.filter(i=>!used.has(i)&&!liquid[i]&&!solid.has(i)),r.cells.length>90?2:1))addFix('orb',i,r.theme.col,1.65,1.9,10,'o'); });
  if(stratum.k==='bigroom'){
    const big=rooms[1], cols2=[[1.0,0.55,0.17],[0.25,0.82,1.0],[0.62,0.4,1.0],[1.0,0.25,0.5],[0.3,1.0,0.6]]; let k2=0;
    for(let y=big.y+7;y<big.y+big.h-2;y+=8)for(let x=big.x+8;x<big.x+big.w-3;x+=9){ const i=y*W+x; if(!used.has(i)&&!liquid[i])addFix('lamp',i,pick([[1.0,0.78,0.45],[0.6,0.8,1.0]]),5.4,2.3,13,'*'); }
    for(let y=big.y+3;y<big.y+big.h-2;y+=8)for(let x=big.x+4;x<big.x+big.w-3;x+=9){ const i=y*W+x; if(used.has(i)||liquid[i])continue; const t2=(k2++)%3;
      addFix(t2===0?'brazier':t2===1?'crystal':'rune',i,cols2[(k2*2)%cols2.length],t2===0?1.35:t2===1?2.4:0.7,2.3,11,t2===2?'0':'*'); }
  }
  if(stratum.k==='town'){
    const big=rooms[1], streets=big.cells.filter(i=>!vaultCell[i]&&!used.has(i)&&!liquid[i]);
    for(const i of spread(streets,12))addFix('lamp',i,pick([[1.0,0.78,0.45],[1.0,0.62,0.3]]),3.4,1.6,8,'*');
  }
  if(stratum.k==='fortress')rooms.forEach(r=>{
    if(!r.fort)return;
    if(FORT_KIND_MSG[r.rkind])r.kindMsg=FORT_KIND_MSG[r.rkind];
    const free=r.cells.filter(i=>!used.has(i)&&!liquid[i]&&!solid.has(i));
    if(r.rkind==='dining'){ r.tables=[];
      for(let y=r.y+2;y<r.y+r.h-2;y+=3)for(let x=r.x+2;x<r.x+r.w-2;x++){ const i=y*W+x; if(!free.includes(i))continue; if(trySolid(i,0.62)){ used.add(i); r.tables.push(i); decoCell.set(i,{ch:'=',col:[0.78,0.62,0.45],k:'table'}); } } }
    else if(r.rkind==='forge'){ r.anvils=[];
      const c=r.cy*W+r.cx; if(free.includes(c)){ addFix('embers',c,[1.0,0.48,0.16],0.6,1.6,8,'*'); }
      for(const i of spread(free.filter(i=>i!==c&&!used.has(i)),4)){ if(trySolid(i,0.45)){ used.add(i); r.anvils.push(i); decoCell.set(i,{ch:'T',col:[0.6,0.6,0.7],k:'anvil'}); } } }
    else if(r.rkind==='flooded'){
      for(const i of r.cells){ if(used.has(i)||solid.has(i))continue; liquid[i]=LQ_WATER; surface[i]=0; }
      const core=r.cells.filter(i=>liquid[i]===LQ_WATER&&D4.every(d=>liquid[i+d[0]+d[1]*W]===LQ_WATER));
      core.forEach(i=>liquid[i]=LQ_DEEP); if(flood(startI)!==countTF())core.forEach(i=>liquid[i]=LQ_WATER);
    }
  });
  // ruin districts: atriums open to a light well, plazas with a colossus, gardens swallowed by plants
  if(stratum.k==='ruins')rooms.forEach(r=>{
    if(!r.ruin)return;
    const c=r.cy*W+r.cx;
    if(r.rkind==='hall'&&!r.kindMsg)r.kindMsg=`${HIST.civ.name}の民が集った大広間の跡。柱だけが、いまも天井を支えている。`;
    if(r.rkind==='atrium'){
      const rx=r.w/2-2.2, ry=r.h/2-2.2;
      for(const i of r.cells){ if(used.has(i)||solid.has(i))continue; const dx=(i%W+0.5-(r.x+r.w/2))/rx, dy=(((i/W)|0)+0.5-(r.y+r.h/2))/ry; if(dx*dx+dy*dy<1){ liquid[i]=LQ_WATER; surface[i]=0; } }
      addFix('well',c,[0.45,1.0,0.92],Math.min(ceil[c]-0.4,4.4),2.6,12,'*'); fixCell.delete(c); r.kindMsg=RUIN_KIND_MSG.atrium;
    } else if(r.rkind==='plaza'){
      if(!used.has(c)&&trySolid(c,1.35)){ r.colossus=c; used.add(c); decoCell.set(c,{ch:'&',col:[0.85,0.82,0.95],k:'colossus'}); const ru=HIST.rulers[c%HIST.rulers.length]; r.kindMsg=`広場の中央に、${ru.title}${ru.name}の巨像がそびえている。`; }
    } else if(r.rkind==='garden'){
      for(const i of r.cells)if(!liquid[i]&&!used.has(i)&&rand()<0.75)surface[i]=rand()<0.4?SF_LUMEN:SF_GRASS;
      r.kindMsg=RUIN_KIND_MSG.garden;
    }
  });
  if(stratum.flood){
    for(let i=0;i<N;i++){ if(walk(i)&&!liquid[i]&&!used.has(i)&&!solid.has(i)&&i!==stI&&i!==startI){ liquid[i]=LQ_WATER; surface[i]=0; } }
    const core=[]; for(let i=W;i<N-W;i++){ if(liquid[i]!==LQ_WATER||roomOf[i]<0)continue; let ok=true; for(let dy=-1;dy<=1&&ok;dy++)for(let dx=-1;dx<=1;dx++){ if(liquid[i+dx+dy*W]!==LQ_WATER){ok=false;break;} } if(ok&&vnoise((i%W)*0.3,7.7,((i/W)|0)*0.3)>0.45)core.push(i); }
    core.forEach(i=>liquid[i]=LQ_DEEP); if(flood(startI)!==countTF())core.forEach(i=>liquid[i]=LQ_WATER);
  }
  const thin=new Uint8Array(N);
  if(stratum.freeze){ for(let i=0;i<N;i++){ if(liquid[i]===LQ_WATER||liquid[i]===LQ_DEEP){ if(liquid[i]===LQ_DEEP)thin[i]=1; liquid[i]=0; surface[i]=SF_ICE; flow[i]=0; } } }
  const teles=[], erupts=[];
  if(stratum.realm&&realm&&realm.key==='lab'){
    const rs=rooms.map((r,ri)=>ri).filter(ri=>ri>0&&rooms[ri].cells.length>12).sort(()=>rand()-0.5);
    for(let k=0;k+1<rs.length&&teles.length<3;k+=2){ const pick2=ri=>{ const c=rooms[ri].cells.filter(i=>walk(i)&&!liquid[i]&&!used.has(i)&&!solid.has(i)&&i!==stI); return c.length?c[Math.floor(rand()*c.length)]:-1; };
      const a=pick2(rs[k]), b=pick2(rs[k+1]); if(a<0||b<0)continue; const col=pick([[1.0,0.35,0.85],[0.35,0.9,1.0],[0.7,0.5,1.0]]);
      addFix('tele',a,col,0.4,1.4,6,'*'); addFix('tele',b,col,0.4,1.4,6,'*'); fixCell.delete(a); fixCell.delete(b); teles.push({a,b}); }
  }
  // volcano: craters that erupt now and then; their flows only take cells that never cut the level apart
  if(stratum.realm&&realm&&realm.key==='volcano'){
    const cand=[]; for(let i=0;i<N;i++)if(walk(i)&&!liquid[i]&&!used.has(i)&&!solid.has(i)&&i!==stI&&cd(i,startI)>30)cand.push(i);
    const tried=cand.slice().sort(()=>rand()-0.5).slice(0,60);
    for(const src of tried){
      if(erupts.length>=3)break; if(erupts.some(e=>cd(e.src,src)<64))continue;
      const order=[], seen=new Set([src]), q=[src];
      for(let h=0;h<q.length&&order.length<22;h++){ const c=q[h]; liquid[c]=LQ_LAVA; const okc=flood(startI)===countTF(); liquid[c]=0; if(!okc&&c!==src)continue; order.push(c);
        for(const dd of D4){ const j=c+dd[0]+dd[1]*W; if(seen.has(j)||!walk(j)||liquid[j]||solid.has(j)||j===stI||j===startI)continue; seen.add(j); q.push(j); } }
      order.forEach(j=>liquid[j]=LQ_LAVA); const ok=flood(startI)===countTF(); order.forEach(j=>liquid[j]=0); if(!ok||order.length<14)continue;
      addFix('crater',src,[1.0,0.42,0.12],0.6,1.6,10,'^'); fixCell.delete(src); erupts.push({src,order});
    }
  }
  // where lava meets water it cools to obsidian and steams (after Dwarf Fortress)
  { const contact=[]; for(let i=W;i<N-W;i++){ if(liquid[i]!==LQ_LAVA)continue; if(D4.some(d=>{ const l=liquid[i+d[0]+d[1]*W]; return l===LQ_WATER||l===LQ_DEEP; })){ liquid[i]=0; surface[i]=SF_OBSIDIAN; contact.push(i); } }
    for(const i of spread(contact,3))addFix('vent',i,[0.85,0.9,1.0],1.4,1.6,8,'o'); }
  // waterfalls fall from glowing rifts high in the vault, over lakes and rivers
  { const fc=[]; for(const r of rooms){ if(!r.cave||r.shell)continue; for(const i of r.cells){ if((liquid[i]===LQ_WATER||liquid[i]===LQ_DEEP)&&!used.has(i)&&ceil[i]>=5.5)fc.push(i); } }
    fc.sort((p,q)=>ceil[q]-ceil[p]); const topC=fc.slice(0,Math.max(4,Math.floor(fc.length*0.25)));
    const nF=stratum.k==='cavern'?RI(1,2):(topC.length?1:0);
    for(const i of spread(topC,nF))addFix('fall',i,[0.5,0.85,1.0],Math.min(6,ceil[i]*0.45),1.9,12,'|'); }
  // ore veins in the rock (gold near the surface, gems deeper)
  const vein=new Uint8Array(N);
  if(stratum.k!=='abyss')for(let i=W;i<N-W;i++){ if(tile[i]!==TW||!D4.some(d=>tile[i+d[0]+d[1]*W]!==TW))continue; const x=i%W, y=(i/W)|0, v=vnoise(x*0.33,9.1,y*0.33)*0.75+vnoise(x*0.9,2.2,y*0.9)*0.25;
    if(v>0.68){ const g2=vnoise(x*0.1,5.5,y*0.1); vein[i]=depth<=3?1:(g2<0.35?1:g2<0.55?2:g2<0.75?3:4); } }
  { const vc=[]; for(let i=W;i<N-W;i++){ if(!vein[i])continue; for(const d of D4){ const j=i-d[0]-d[1]*W; if(walk(j)&&!liquid[j]&&!used.has(j)){ vc.push([j,i,d]); break; } } }
    const nV=Math.min(7,Math.max(0,NSL-lights.length-8));
    for(const j of spread(vc.map(x=>x[0]),nV)){ const e=vc.find(x=>x[0]===j), before=fixtures.length; addFix('veinlight',j,VEIN_COL[vein[e[1]]],1.3,1.0,6.5,'*');
      if(fixtures.length>before){ fixtures[fixtures.length-1].wd=[e[2][0],e[2][1]]; fixCell.delete(j); } } }
  // autogenerators (after Brogue's DF_SUNLIGHT / DF_DARKNESS / STEAM_VENT)
  const darkMul=new Float32Array(N).fill(1);
  if(depth<=5)for(let k=RI(1,3);k>0;k--){ const r=normals[RI(1,Math.max(1,normals.length-1))]; if(!r)continue; const c=spread(r.cells.filter(i=>!used.has(i)&&!liquid[i]),1)[0]; if(c===undefined)continue; addFix('sun',c,[1.0,0.93,0.78],ceil[c]-0.3,2.2,9,'*'); fixCell.delete(c); }
  if(depth>=2)for(let k=RI(1,2);k>0;k--){ const r=rooms[RI(1,rooms.length-1)]; const c=r&&r.cells.length?pick(r.cells):undefined; if(c===undefined)continue;
    const cx=c%W, cy=(c/W)|0; for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){ const x=cx+dx, y=cy+dy; if(x<0||y<0||x>=UW||y>=UH)continue; const m=clamp((Math.hypot(dx,dy)-1.2)/2.6,0,1); darkMul[y*W+x]=Math.min(darkMul[y*W+x],0.12+0.88*m); } }
  if(depth>=5)for(let k=RI(1,3);k>0;k--){ const r=rooms[RI(1,rooms.length-1)]; const c=r?spread(r.cells.filter(i=>!used.has(i)&&!liquid[i]),1)[0]:undefined; if(c===undefined)continue; addFix('vent',c,[0.85,0.9,1.0],1.4,1.6,8,'o'); }
  const engr=new Map();
  { const nE={ruins:10,fortress:10,town:4,oracle:6,maze:3,bigroom:6}[stratum.k]||0, FD=[[1,0],[-1,0],[0,1],[0,-1]], cands=[];
    if(nE)for(const r of rooms){ if(r.cave)continue; for(const i of r.cells){ if(liquid[i]||used.has(i))continue; for(let fi=0;fi<4;fi++){ const j=i+FD[fi][0]+FD[fi][1]*W; if(tile[j]===TW&&!fixCell.has(j))cands.push(i*4+fi); } } }
    const picks=[]; for(let t=0;t<600&&picks.length<nE&&cands.length;t++){ const k=cands[Math.floor(rand()*cands.length)], i=k>>2; if(picks.some(o=>Math.hypot((o>>2)%W-i%W,(((o>>2)/W)|0)-((i/W)|0))<5))continue; picks.push(k); }
    const pool=HIST.events.concat(HIST.events,HIST.crowns);
    for(const k of picks){ const i=k>>2, fi=k&3, ev=pick(pool), tg=fi<2?[W,-W]:[1,-1];
      let pi=-1; for(const o of tg){ const p=i+o, wj=p+FD[fi][0]+FD[fi][1]*W; if(tile[p]===TF&&!liquid[p]&&roomOf[p]===roomOf[i]&&tile[wj]===TW&&!fixCell.has(wj)&&!engr.has(p*4+fi)){ pi=p; break; } }
      if(pi>=0&&rand()<0.75){ engr.set(k,{...ev,wide:true,pi}); engr.set(pi*4+fi,{skip:true,mi:i,art:ev.art}); } else engr.set(k,ev); } }
  const lampCols=[[0.5,0.68,1.0],[0.62,0.45,1.0],[0.45,0.9,0.95]];
  for(let i=0;i<N;i++){
    if(tile[i]!==TF||roomOf[i]>=0||used.has(i)||rand()>(stratum.k==='ruins'?0.085:0.05))continue;
    let near=false; for(const f of fixtures){ if(Math.hypot(f.x/CELL-(i%W+0.5),f.z/CELL-(((i/W)|0)+0.5))<7){near=true;break;} }
    if(!near)addFix('lamp',i,pick(lampCols),2.35,1.1,6.5,'*');
  }
  lights.forEach(L=>L.vis=computeVis(L,tile));
  const cellLI=new Float32Array(N*3).fill(-1), cellLW=new Float32Array(N*3);
  const bakeCellLights=()=>{ cellLI.fill(-1); cellLW.fill(0);
  for(let i=0;i<N;i++){
    let ref=i;
    if(tile[i]===TW){ ref=-1; for(const d of D4){ const x=i%W+d[0], y=((i/W)|0)+d[1]; if(x>=0&&y>=0&&x<UW&&y<UH&&tile[y*W+x]!==TW){ref=y*W+x;break;} } if(ref<0)continue; }
    topLights(lights,(i%W+0.5)*CELL,1.3,(((i/W)|0)+0.5)*CELL,null,0,0,ref,cellLI,cellLW,i*3);
    for(let k=0;k<3;k++)cellLW[i*3+k]*=darkMul[i];
  } };
  bakeCellLights();
  // tall vegetation (after Brogue's foliage and fungus forests): blocks sight, hides whoever stands in it, flattens when walked through
  for(let i=W;i<N-W;i++){
    if(tile[i]!==TF||liquid[i]||i===startI||i===stI||vaultCell[i])continue; const sf=surface[i], x=i%W, y=(i/W)|0, r=roomOf[i]>=0?rooms[roomOf[i]]:null, k=r&&r.theme?r.theme.k:'';
    const v=vnoise(x*0.28,8.8,y*0.28)*0.7+vnoise(x*0.9,1.9,y*0.9)*0.3;
    if((sf===SF_GRASS||sf===SF_DEAD||(sf===0&&r&&r.cave&&!['crystal','magma','basalt','ashfield','abyssal','warren','cavern'].includes(k)))&&v>0.5&&k!=='warren')surface[i]=SF_FOLIAGE;
    else if((k==='fungal'||k==='towercap'||k==='mossfield')&&v>0.6)surface[i]=SF_FUNGFOR;
  }
  // brimstone near lava: flares up when stepped on (after Brogue)
  if(depth>=4||(stratum.realm&&realm&&realm.key==='volcano')){
    for(let i=W;i<N-W;i++){ if(tile[i]!==TF||liquid[i]||surface[i]===SF_FOLIAGE||i===startI)continue; let nearL=false; for(let dy=-3;dy<=3&&!nearL;dy++)for(let dx=-3;dx<=3;dx++){ const j=i+dx+dy*W; if(j>=0&&j<N&&liquid[j]===LQ_LAVA){nearL=true;break;} }
      if(nearL&&vnoise((i%W)*0.45,4.4,((i/W)|0)*0.45)>0.6)surface[i]=SF_BRIM; }
  }
  // luminescent algae drifting in deep water
  const algae=new Uint8Array(N);
  for(let i=0;i<N;i++){ if(liquid[i]===LQ_DEEP&&vnoise((i%W)*0.3,5.1,((i/W)|0)*0.3)>(stratum.flood||stratum.cw&&stratum.cw.lake>2?0.42:0.56))algae[i]=1; }
  // a sanctuary: a room whose whole floor is laid with sacred glyphs no beast will cross
  const glyph=new Uint8Array(N);
  if(depth>=3&&!stratum.special&&rand()<0.5){ const rs=rooms.map((r,ri)=>ri).filter(ri=>ri>0&&!rooms[ri].cave&&!rooms[ri].vault&&!rooms[ri].mdata&&rooms[ri].cells.length>=12&&rooms[ri].cells.length<=60&&!rooms[ri].cells.includes(stI));
    if(rs.length){ const r=rooms[rs[Math.floor(rand()*rs.length)]]; for(const i of r.cells)if(walk(i)&&!liquid[i])glyph[i]=1; r.sanct=true; r.kindMsg='床一面に聖なる紋様が描かれた部屋。獣たちは、この紋様を越えようとしない。'; } }
  // monsters arrive in hordes: a leader and its followers placed on nearby free cells
  const spawns=[], taken=new Set();
  const okCell=i=>i!==undefined&&i>=0&&walk(i)&&dist[i]>=8&&i!==stI&&!solid.has(i)&&!bridge[i]&&!taken.has(i)&&!glyph[i];
  const avail=stratum.hordes?HORDES.filter(H=>stratum.hordes.includes(H.lead)):HORDES.filter(H=>depth>=H.d[0]&&depth<=H.d[1]);
  const areaK=clamp((UW*UH)/(MW*MH),0.3,1)*(trialOn('fury')?1.25:1), nH=Math.max(2,Math.round(areaK*(stratum.hordeMul||1)*(6+Math.min(depth,6))*(stratum.k==='bigroom'?1.5:stratum.k==='town'?0.35:1))); let gid=0;
  for(let g2=0;g2<800&&gid<nH&&avail.length;g2++){
    let tot=0; for(const H of avail)tot+=H.w; let r0=rand()*tot, H=avail[0]; for(const h of avail){ r0-=h.w; if(r0<=0){H=h;break;} }
    const room=rooms[RI(1,rooms.length-1)], i=(room&&room.cells.length&&rand()<0.85)?pick(room.cells):RI(0,N-1);
    if(!okCell(i))continue;
    taken.add(i); spawns.push({key:H.lead,cx:i%W,cz:(i/W)|0,g:gid,lead:true});
    const nearC=[]; { const q=[i], seen=new Map([[i,0]]); for(let h=0;h<q.length;h++){ const c=q[h], dd=seen.get(c); if(dd>=4)continue; for(const d of D4){ const j=c+d[0]+d[1]*W; if(seen.has(j)||!walk(j))continue; seen.set(j,dd+1); q.push(j); if(okCell(j))nearC.push(j); } } }
    for(const [fk,mn,mx] of H.fol){ const n=RI(mn,mx); for(let k=0;k<n&&nearC.length;k++){ const j=nearC.splice(Math.floor(rand()*nearC.length),1)[0]; taken.add(j); spawns.push({key:fk,cx:j%W,cz:(j/W)|0,g:gid,lead:false}); } }
    gid++;
  }
  // schools of glowing fish in lakes and rivers
  { const wc=[]; for(let i=0;i<N;i++)if(tile[i]===TF&&(liquid[i]===LQ_WATER||liquid[i]===LQ_DEEP))wc.push(i);
    if(wc.length>=12)for(const c of spread(wc,Math.min(3,Math.floor(wc.length/70)+1))){ const q=[c], seen=new Set([c]); for(let h=0;h<q.length&&q.length<12;h++)for(const d of D4){ const j=q[h]+d[0]+d[1]*W; if(!seen.has(j)&&tile[j]===TF&&(liquid[j]===LQ_WATER||liquid[j]===LQ_DEEP)){ seen.add(j); q.push(j); } }
      for(let k=0;k<RI(3,5)&&q.length;k++){ const j=q.splice(Math.floor(rand()*q.length),1)[0]; spawns.push({key:'f',cx:j%W,cz:(j/W)|0,g:-1,lead:true}); } } }
  // grazers wander the luminous moss in small herds
  { const mc=[]; for(let i=0;i<N;i++)if(surface[i]===SF_LUMEN&&walk(i)&&!liquid[i]&&i!==stI&&dist[i]>=5)mc.push(i);
    if(mc.length>=10)for(const c of spread(mc,Math.min(3,Math.floor(mc.length/35)+1))){ const near=mc.filter(j=>Math.abs(j%W-c%W)+Math.abs(((j/W)|0)-((c/W)|0))<=3);
      for(let k=0;k<RI(3,5)&&near.length;k++){ const j=near.splice(Math.floor(rand()*near.length),1)[0]; spawns.push({key:'h',cx:j%W,cz:(j/W)|0,g:-1,lead:true}); } } }
  // shriekers keep watch in dark corners, often beside a sleeping horde
  if(depth>=2||stratum.branch||stratum.realm){ const nS=RI(2,4); for(let k=0;k<nS;k++){ let c=-1;
      if(rand()<0.5&&spawns.length){ const s0=spawns[Math.floor(rand()*spawns.length)]; const b0=s0.cz*W+s0.cx; const nb=[]; for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){ const j=b0+dx+dy*W; if(j>0&&j<N&&okCell(j)&&!liquid[j])nb.push(j); } if(nb.length)c=nb[Math.floor(rand()*nb.length)]; }
      if(c<0){ for(let t2=0;t2<40;t2++){ const j=RI(0,N-1); if(okCell(j)&&!liquid[j]&&roomOf[j]>=0){c=j;break;} } }
      if(c>=0){ taken.add(c); spawns.push({key:'p',cx:c%W,cz:(c/W)|0,g:-1,lead:true}); } } }
  // spider nests: narrow passages strung with glowing webs
  const webs=[]; 
  if((depth>=2||stratum.branch||stratum.realm)&&!stratum.special&&stratum.k!=='abyss'){
    const dense=!!stratum.denseWebs, narrow=[]; for(let i=W;i<N-W;i++){ if(!walk(i)||liquid[i]||i===stI||dist[i]<10||bridge[i])continue; let n=0; for(const d of D4)if(walk(i+d[0]+d[1]*W))n++; if(n<=(dense?3:2))narrow.push(i); }
    for(const c of spread(narrow,dense?RI(4,6):(rand()<0.5?1:2))){ const g=gid++; const q=[c], seen=new Map([[c,0]]);
      for(let h=0;h<q.length;h++){ const x=q[h], dd=seen.get(x); if(dd>=6)continue; for(const d of D4){ const j=x+d[0]+d[1]*W; if(seen.has(j)||!walk(j))continue; seen.set(j,dd+1); q.push(j); } }
      const cand=q.filter(i=>!liquid[i]&&i!==stI&&!used.has(i)&&!solid.has(i)); let nW=0;
      for(const i of cand.sort(()=>rand()-0.5)){ if(nW>=(dense?12:7))break; let n=0; const ew=walk(i+1)&&walk(i-1), ns=walk(i+W)&&walk(i-W); for(const d of D4)if(walk(i+d[0]+d[1]*W))n++; if(n>2&&!dense&&rand()<0.7)continue; webs.push({i,ax:ew&&!ns?0:1,gone:false}); nW++; }
      for(let k=0;k<RI(1,2);k++){ const sc=cand.filter(i=>okCell(i)&&!webs.some(w=>w.i===i)); if(!sc.length)break; const j=sc[Math.floor(rand()*sc.length)]; taken.add(j); spawns.push({key:'S',cx:j%W,cz:(j/W)|0,g,lead:k===0}); } }
  }
  // a snapjaw camp: a campfire, the tribe around it, and sentries walking a loop
  if(depth>=2&&!stratum.special&&!stratum.realm&&stratum.k!=='abyss'&&stratum.k!=='magma'&&rand()<(stratum.branch?0.6:0.4)){
    const rs=rooms.map((r,ri)=>ri).filter(ri=>ri>0&&rooms[ri].cells.length>=30&&!rooms[ri].vault&&!rooms[ri].shell&&!rooms[ri].mdata);
    if(rs.length){ const r=rooms[rs[Math.floor(rand()*rs.length)]], cc=r.cells.filter(i=>walk(i)&&!liquid[i]&&!used.has(i)&&!solid.has(i)&&i!==stI&&dist[i]>=10);
      if(cc.length){ const c=cc.sort((a,b)=>Math.hypot(a%W-r.cx,((a/W)|0)-r.cy)-Math.hypot(b%W-r.cx,((b/W)|0)-r.cy))[0], g=gid++;
        addFix('embers',c,[1.0,0.55,0.2],0.6,2.6,11,'*');
        const ring=(r0,r1)=>r.cells.filter(i=>{ const d=Math.hypot(i%W-c%W,((i/W)|0)-((c/W)|0)); return d>=r0&&d<=r1&&okCell(i)&&!liquid[i]; });
        const sit=ring(1,2.3); for(let k=0;k<RI(3,5)&&sit.length;k++){ const j=sit.splice(Math.floor(rand()*sit.length),1)[0]; taken.add(j); spawns.push({key:'s',cx:j%W,cz:(j/W)|0,g,lead:k===0,camp:c}); }
        const loop=ring(3.5,5.5).sort((a,b)=>Math.atan2(((a/W)|0)-((c/W)|0),a%W-c%W)-Math.atan2(((b/W)|0)-((c/W)|0),b%W-c%W));
        const route=loop.filter((_,k)=>k%Math.max(1,Math.floor(loop.length/8))===0);
        for(let k=0;k<RI(1,2)&&route.length>2;k++){ const j=route[Math.floor(rand()*route.length)]; if(!okCell(j))continue; taken.add(j); spawns.push({key:'sw',cx:j%W,cz:(j/W)|0,g,lead:false,route:k?route.slice().reverse():route}); }
        r.camp=c; r.kindMsg=(r.kindMsg?r.kindMsg+' ':'')+'焚き火の煙と、獣じみた笑い声。スナップジョーの野営地だ。'; } }
  }
  // ancient machines keep the ruins tidy (after Cogmind)
  if(stratum.k==='ruins'||stratum.k==='fortress'||(stratum.realm&&realm&&realm.key==='lab')){
    const plan=[['Rc',RI(1,2)],['Re',1],['Rw',RI(1,2)]];
    for(const [key,n] of plan)for(let k=0;k<n;k++){ for(let t2=0;t2<40;t2++){ const j=RI(0,N-1); if(okCell(j)&&!liquid[j]&&roomOf[j]>=0){ taken.add(j); spawns.push({key,cx:j%W,cz:(j/W)|0,g:key==='Rw'?gid++:-1,lead:true}); break; } } }
  }
  // large creatures live where their terrain is (after Brogue): bog monsters in bogs, nagas and krakens in deep water, salamanders in lava
  { const cnt=lq=>{ const a=[]; for(let i=0;i<N;i++)if(tile[i]===TF&&liquid[i]===lq&&!taken.has(i))a.push(i); return a; };
    const put=(key,arr,n)=>{ for(const j of spread(arr,n)){ taken.add(j); spawns.push({key,cx:j%W,cz:(j/W)|0,g:gid++,lead:true}); } };
    const bog=cnt(LQ_BOG), deep=cnt(LQ_DEEP), lava=cnt(LQ_LAVA);
    if(depth>=2&&bog.length>=15)put('B',bog,bog.length>60?2:1);
    if(depth>=3&&deep.length>=25&&rand()<0.6){ const shore=deep.filter(i=>D4.some(d=>walk(i+d[0]+d[1]*W)&&!liquid[i+d[0]+d[1]*W])); put('N',shore.length?shore:deep,1); }
    if(depth>=5&&deep.length>=60&&rand()<0.5)put('K',deep.filter(i=>D4.every(d=>liquid[i+d[0]+d[1]*W]===LQ_DEEP)),1);
    if(depth>=4&&lava.length>=20)put('l',lava,lava.length>300?2:1); }
  if((stratum.k==='ruins'||stratum.k==='fortress')&&depth>=6){ for(let k=0;k<RI(1,2);k++)for(let t2=0;t2<40;t2++){ const j=RI(0,N-1); if(okCell(j)&&!liquid[j]&&roomOf[j]>=0&&rooms[roomOf[j]].cells.length>20){ taken.add(j); spawns.push({key:'Y',cx:j%W,cz:(j/W)|0,g:gid++,lead:true}); break; } } }
  // the lord of a branch waits near its last staircase (after DCSS's branch-end uniques)
  if(stratum.branch&&branch&&branch.lvl===branch.len){
    const ru=HIST.rulers[HIST.rulers.length-1], bk=branch.key;
    const LORD={crypt:{base:'L',name:`不死の王 ${ru.name}`,scale:1.7,verb:`${ru.title}${ru.name}の亡霊。王冠だけが、まだ光を失っていない`},
                lair:{base:'D',name:'年老いた竜',scale:3.6,verb:'巣の最奥で、とぐろを巻いて眠っている。寝息のたびに洞窟が揺れる'},
                sunken:{base:'K',name:'深みの主',scale:3.6,verb:'沈んだ神殿の底から、無数の触手を伸ばしている'},
                nest:{base:'S',name:'蜘蛛の女王',scale:2.4,verb:'巣の中心で、光る糸を紡ぎ続けている'},
                snake:{base:'N',name:'ナーガの女王',scale:2.6,verb:'水場のほとりで、冠のような鱗を光らせている'}}[bk];
    if(LORD){ MTYPES.lord={...MTYPES[LORD.base],sk:LORD.base,name:LORD.name,scale:LORD.scale,verb:LORD.verb,boss:true,col:LORD.base==='L'?[0.75,0.9,1.0]:MTYPES[LORD.base].col,look:({crypt:null,lair:null,nest:null,snake:null})[bk]||MTYPES[LORD.base].look}; if(bk==='lair'){ MTYPES.lord.form='olddragon'; MTYPES.lord.light=5; } if(bk==='sunken'){ MTYPES.lord.form='deepkraken'; MTYPES.lord.light=5; } if(bk==='crypt'){ MTYPES.lord.form='lichking'; MTYPES.lord.light=7; } if(bk==='nest'){ MTYPES.lord.form='spiderqueen'; MTYPES.lord.light=6; } if(bk==='snake'){ MTYPES.lord.form='nagaqueen'; MTYPES.lord.light=6; }
      const near=[]; for(let i=0;i<N;i++){ const d=cd(i,stI); if(d<36||d>144||taken.has(i))continue; const okL=LORD.base==='K'?(liquid[i]===LQ_DEEP&&D4.every(dd=>liquid[i+dd[0]+dd[1]*W]===LQ_DEEP)):(walk(i)&&!liquid[i]&&!solid.has(i)); if(okL)near.push(i); }
      if(!near.length&&LORD.base==='K'){ const dw=[]; for(let i=0;i<N;i++)if(liquid[i]===LQ_DEEP&&cd(i,stI)>=36&&!taken.has(i))dw.push(i); dw.sort((a,b)=>cd(a,stI)-cd(b,stI)); near.push(...dw.slice(0,8)); }
      // a lord must always be there (it may hold a legendary thing): with no deep water, a pool is dug for the Lord of the Depths; any other lord takes the farthest open floor
      if(!near.length){ let best=-1, bd=-1; const open2=i=>{ const x=i%W, z=(i/W)|0; if(x<3||z<3||x>UW-4||z>UH-4)return false; for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){ const j=i+dz*W+dx; if(!walk(j)||solid.has(j)||taken.has(j))return false; } return true; };
        for(let i=0;i<N;i++){ if(!open2(i))continue; const d=cd(i,stI); if(d>bd){ bd=d; best=i; } }
        if(best<0)for(let i=0;i<N;i++){ if(!walk(i)||liquid[i]||solid.has(i)||taken.has(i))continue; const d=cd(i,stI); if(d>bd){ bd=d; best=i; } }
        if(best>=0){ if(LORD.base==='K'){ for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){ const j=best+dz*W+dx; if(Math.hypot(dx,dz)<=2.6)liquid[j]=LQ_DEEP; } } near.push(best); } }
      if(near.length){ const j=near[Math.floor(rand()*near.length)]; taken.add(j); spawns.push({key:'lord',cx:j%W,cz:(j/W)|0,g:gid++,lead:true}); } }
  }
  // mimics wait in rooms, disguised as floating scrolls
  { const nM=rand()<0.6?1:2; for(let k=0;k<nM;k++){ const rr=rooms.filter((r,ri)=>ri>0&&r.cells.length>12&&!r.shell); if(!rr.length)break; const r=rr[Math.floor(rand()*rr.length)];
      const c=r.cells.filter(i=>okCell(i)&&!liquid[i]&&!used.has(i)); if(c.length){ const j=c[Math.floor(rand()*c.length)]; taken.add(j); spawns.push({key:'q',cx:j%W,cz:(j/W)|0,g:-1,lead:true}); } } }
  if(stratum.k==='town'){ const st2=rooms[1].cells.filter(i=>!vaultCell[i]&&walk(i)&&!liquid[i]&&!solid.has(i)); for(let k=0;k<7&&st2.length;k++){ const i=st2.splice(Math.floor(rand()*st2.length),1)[0]; spawns.push({key:'G',cx:i%W,cz:(i/W)|0,g:-1,lead:true}); } }
  if(stratum.k==='cavern'&&depth===3&&!stratum.branch&&!stratum.realm){
    MTYPES.X=makeBeastType(HIST);
    let lr=-1,ld=-1; rooms.forEach((r,ri)=>{ if(ri===0||!r.cells.length||!r.cave||r.shell)return; const d=dist[r.cx+r.cy*W]; if(d>ld&&r.cells.length>30){ld=d;lr=ri;} });
    if(lr>=0){ const r=rooms[lr]; r.lair=true; const cand=r.cells.filter(i=>walk(i)&&!liquid[i]&&!solid.has(i)&&i!==stI); const c=cand.sort((p,q)=>dfield[q]-dfield[p])[0];
      if(c!==undefined)spawns.push({key:'X',cx:c%W,cz:(c/W)|0,g:-1,lead:true,home:lr}); }
  }
  if(depth>=2){ const deepAll=[]; for(let i=0;i<N;i++)if(liquid[i]===LQ_DEEP)deepAll.push(i);
    const ne=deepAll.length>=8?Math.min(3,1+Math.floor(deepAll.length/20)):0;
    for(let k=0;k<ne;k++){ const i=pick(deepAll); spawns.push({key:'e',cx:i%W,cz:(i/W)|0,g:-1,lead:true}); } }
  let sy=0,bl=-1; for(const d of D4){ let l=0,x=rooms[0].cx,y=rooms[0].cy; while(tile[(y+d[1])*W+x+d[0]]===TF&&l<20){x+=d[0];y+=d[1];l++;} if(l>bl){bl=l;sy=Math.atan2(-d[0],-d[1]);} }
  let floorCount=0; for(let i=0;i<N;i++)if(tile[i]===TF||tile[i]===TP)floorCount++;
  // a vault behind a portcullis, opened by a lever somewhere else on the level
  let gate=null;
  if(!stratum.special&&!stratum.realm&&stratum.k!=='abyss'&&stratum.k!=='magma'&&rand()<0.55){
    for(const ri of rooms.map((_,k)=>k).sort(()=>rand()-0.5)){
      const r=rooms[ri]; if(ri===0||r.cave||r.vault||r.sanct||r.camp!==undefined||r.mdata||r.cells.includes(stI)||r.cells.length<10||r.cells.length>70)continue;
      const set=new Set(r.cells), ent=new Set(); for(const i of r.cells)for(const d of D4){ const j=i+d[0]+d[1]*W; if(!set.has(j)&&walk(j))ent.add(j); }
      if(ent.size<1||ent.size>4)continue; const entL=[...ent].filter(j=>j!==stI&&j!==startI&&doorAt[j]<0&&!used.has(j)); if(!entL.length)continue; const e=entL[0], seal=[...ent].filter(j=>j!==e);
      if(seal.some(j=>j===stI||j===startI||doorAt[j]>=0||used.has(j)))continue;
      const inside=r.cells.filter(i=>walk(i)).length, sv=tile[e]; for(const j of seal)tile[j]=TW; tile[e]=TW; const ok=flood(startI)===countTF()-inside; tile[e]=sv; if(!ok){ for(const j of seal)tile[j]=TF; continue; }
      if(spawns.some(sp=>set.has(sp.cz*W+sp.cx)))for(let k=spawns.length-1;k>=0;k--)if(set.has(spawns[k].cz*W+spawns[k].cx))spawns.splice(k,1);
      const lc=[]; for(let i=W;i<N-W;i++){ if(!walk(i)||liquid[i]||set.has(i)||i===e||used.has(i)||cd(i,e)<100)continue; const d=D4.find(dd=>tile[i+dd[0]+dd[1]*W]===TW); if(d)lc.push([i,d]); }
      if(!lc.length)continue; const [li,ld]=lc[Math.floor(rand()*lc.length)];
      const axis=(walk(e+W)||set.has(e+W))&&(walk(e-W)||set.has(e-W))?1:0;
      gate={cell:e,lever:li,ld,open:false,o:0,axis};
      const c=r.cells.filter(i=>walk(i)&&!liquid[i]&&!used.has(i)).sort((a,b)=>Math.hypot(a%W-r.cx,((a/W)|0)-r.cy)-Math.hypot(b%W-r.cx,((b/W)|0)-r.cy))[0];
      if(c!==undefined){ addFix('relic',c,[1.0,0.82,0.42],1.55,1.6,8,'_'); const ru=HIST.rulers[Math.floor(rand()*HIST.rulers.length)]; gate.heir=`${ru.title}${ru.name}の遺品`; }
      r.kindMsg='鉄格子の奥の宝物庫。古の王の遺品が、台座の上で静かに光っている。';
      break;
    }
    // no room qualifies: carve a small treasure alcove into solid rock, reachable only through the gate
    if(!gate){
      const all=[]; for(let i=W*3;i<N-W*3;i++)if(walk(i)&&!liquid[i]&&!used.has(i)&&i!==stI&&i!==startI&&cd(i,startI)>49)all.push(i);
      for(let t2=0;t2<300&&!gate&&all.length;t2++){
        const f=all[Math.floor(rand()*all.length)], d=D4[Math.floor(rand()*4)], fx=f%W, fz=(f/W)|0, cxN=fx+d[0]*3, czN=fz+d[1]*3;
        if(cxN<3||czN<3||cxN>UW-4||czN>UH-4)continue;
        let solidAll=tile[f+d[0]+d[1]*W]===TW; for(let dz=-2;dz<=2&&solidAll;dz++)for(let dx=-2;dx<=2;dx++){ if(tile[(czN+dz)*W+cxN+dx]!==TW){solidAll=false;break;} }
        if(!solidAll)continue;
        const e=f+d[0]+d[1]*W, cells=[]; tile[e]=TF; ceil[e]=BASE_H;
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){ const j=(czN+dz)*W+cxN+dx; tile[j]=TF; ceil[j]=BASE_H; cells.push(j); }
        const ri=rooms.length; rooms.push({x:cxN-1,y:czN-1,w:3,h:3,shape:'rect',cx:cxN,cy:czN,cells,theme:rooms[0].theme,cave:false,chasm:[],lava:[],mush:[],deep:[],bog:[],xtal:[],clusters:[],alcove:true,kindMsg:'鉄格子の奥の小さな宝物庫。古の王の遺品が、台座の上で静かに光っている。'});
        for(const j of cells)roomOf[j]=ri;
        const lc=[]; for(let i=W;i<N-W;i++){ if(!walk(i)||liquid[i]||cells.includes(i)||i===e||used.has(i)||cd(i,e)<100)continue; const dd=D4.find(q=>tile[i+q[0]+q[1]*W]===TW); if(dd)lc.push([i,dd]); }
        if(!lc.length){ for(const j of cells.concat([e]))tile[j]=TW; rooms.pop(); continue; }
        const [li,ld]=lc[Math.floor(rand()*lc.length)];
        gate={cell:e,lever:li,ld,open:false,o:0,axis:d[0]!==0?0:1};
        addFix('relic',czN*W+cxN,[1.0,0.82,0.42],1.55,1.6,8,'_'); const ru=HIST.rulers[Math.floor(rand()*HIST.rulers.length)]; gate.heir=`${ru.title}${ru.name}の遺品`;
      }
    }
    // still nothing: a one-cell niche in the wall, which even the thin walls of the great caverns can hold
    if(!gate){
      const all=[]; for(let i=W*2;i<N-W*2;i++)if(walk(i)&&!liquid[i]&&!used.has(i)&&i!==stI&&i!==startI&&cd(i,startI)>49)all.push(i);
      for(let t2=0;t2<400&&!gate&&all.length;t2++){
        const f=all[Math.floor(rand()*all.length)], d=D4[Math.floor(rand()*4)], e=f+d[0]+d[1]*W, c=f+d[0]*2+d[1]*W*2, ccx=c%W, ccz=(c/W)|0;
        if(ccx<2||ccz<2||ccx>UW-3||ccz>UH-3||tile[e]!==TW)continue;
        let ok=true; for(let dz=-1;dz<=1&&ok;dz++)for(let dx=-1;dx<=1;dx++){ if(tile[(ccz+dz)*W+ccx+dx]!==TW){ok=false;break;} } if(!ok)continue;
        const lc=[]; for(let i=W;i<N-W;i++){ if(!walk(i)||liquid[i]||i===e||used.has(i)||cd(i,e)<100)continue; const dd=D4.find(q=>tile[i+q[0]+q[1]*W]===TW); if(dd)lc.push([i,dd]); }
        if(!lc.length)continue;
        tile[e]=TF; tile[c]=TF; ceil[e]=ceil[c]=BASE_H;
        const ri=rooms.length; rooms.push({x:ccx,y:ccz,w:1,h:1,shape:'rect',cx:ccx,cy:ccz,cells:[c],theme:rooms[0].theme,cave:false,chasm:[],lava:[],mush:[],deep:[],bog:[],xtal:[],clusters:[],alcove:true,kindMsg:'鉄格子の奥の壁龕。古の王の遺品が、ひっそりと光っている。'}); roomOf[c]=ri;
        const [li,ld]=lc[Math.floor(rand()*lc.length)];
        gate={cell:e,lever:li,ld,open:false,o:0,axis:d[0]!==0?0:1};
        addFix('relic',c,[1.0,0.82,0.42],1.55,1.6,8,'_'); const ru=HIST.rulers[Math.floor(rand()*HIST.rulers.length)]; gate.heir=`${ru.title}${ru.name}の遺品`;
      }
    }
  }
  // hidden traps: alarms, trapdoors, nets, floods and gas
  const traps=[];
  if(depth>=2&&!stratum.special){
    const types=['alarm','net','methane','flood'].concat(stratum.k!=='abyss'?['trapdoor']:[]), nT=RI(2,4)+(depth>=6?1:0), cand=[];
    for(let i=W;i<N-W;i++){ if(!walk(i)||liquid[i]||used.has(i)||solid.has(i)||bridge[i]||i===stI||i===startI||cd(i,startI)<64||cd(i,stI)<9||vaultCell[i]||glyph[i]||(gate&&i===gate.cell)||taken.has(i))continue; cand.push(i); }
    for(const i of spread(cand,nT)){ const type=types[Math.floor(rand()*types.length)], t={i,type,hidden:true,used:false};
      if(type==='flood'){ const order=[], seen=new Set([i]), q=[i]; for(let h=0;h<q.length&&order.length<40;h++){ const c=q[h]; order.push(c); for(const d of D4){ const j=c+d[0]+d[1]*W; if(seen.has(j)||!walk(j)||liquid[j]||solid.has(j)||j===stI)continue; seen.add(j); q.push(j); } } t.order=order; }
      traps.push(t); }
  }
  const items=[];
  if(!stratum.special){
    const free=[]; for(let i=W;i<N-W;i++)if(walk(i)&&!liquid[i]&&!used.has(i)&&!solid.has(i)&&i!==stI&&i!==startI&&!taken.has(i)&&!(gate&&i===gate.cell))free.push(i);
    const put=kind=>{ if(!free.length)return; const j=free.splice(Math.floor(rand()*free.length),1)[0]; items.push({i:j,kind,taken:false}); };
    if(gate){ const inside=[]; for(let i=0;i<N;i++){ const rr=roomOf[i]; if(rr>=0&&rooms[rr].kindMsg&&rooms[rr].kindMsg.includes('鉄格子の奥')&&walk(i)&&!used.has(i))inside.push(i); } items.push({i:inside.length?inside[Math.floor(rand()*inside.length)]:gate.cell,kind:'rune',rune:(()=>{ if(rand()<0.5){ const wp=weaponPool(); return rollTraits(makeRune(wp[Math.floor(rand()*wp.length)],0,rand),rand,depth,1); } const ru=makeRune(RUNE_TYPES.mod[Math.floor(rand()*RUNE_TYPES.mod.length)],0,rand); if(rand()<0.35)ru.strong=true; return ru; })(),taken:false,vault:true}); }
  }
  // the deepest place: a high vault over the bottom, so the last shadow stands under its own dark sky
  if(depth===FINAL_DEPTH&&!branch&&!realm){ const sx0=stI%W, sz0=(stI/W)|0; for(let dz=-10;dz<=10;dz++)for(let dx=-10;dx<=10;dx++){ const i=(sz0+dz)*W+sx0+dx, d=Math.hypot(dx,dz); if(i<0||i>=N||d>10)continue; ceil[i]=Math.max(ceil[i],7+6*(1-d/10)); } }
  // lights placed with the inhabitants (campfires) still need their visibility, and the light map must include them
  if(lights.some(L=>!L.vis)){ lights.forEach(L=>{ if(!L.vis)L.vis=computeVis(L,tile); }); bakeCellLights(); }
  return {items,traps,glyph,gate,algae,webs,thin,teles,erupts,upstairs,bstairs,portal,rock:ROCKS[stratum.k]||ROCKS.maze,vein,engr,vaultCell,flow,stratum,darkMul,bridge,bridgeDir,xtalCol,prof,doors,doorAt,tile,liquid,surface,roomOf,rooms,ceil,dfield,lights,fixtures,fixCell,decoCell,solid,stairs:stI,start:startI,startYaw:sy,cellLI,cellLW,spawns,floorCount,noiseSeed:ns,gas:new Float32Array(N),bogList:rooms.flatMap(r=>r.bog).concat([...Array(N).keys()].filter(i=>roomOf[i]<0&&liquid[i]===LQ_BOG))};
}

// ---------------------------------------------------------------- renderer & post
const canvas=document.getElementById('gl');
let renderer;
try{ renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',stencil:false}); }
catch(e){ errEl.textContent='WebG Lを初期化できませんでした。ハードウェアアクセラレーションを有効にしてください。'.replace('WebG L','WebGL'); return; }
const isGL2=renderer.capabilities.isWebGL2;
let pixelRatio=Math.min(window.devicePixelRatio||1,1.5);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth,window.innerHeight,false);
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(74,window.innerWidth/window.innerHeight,0.05,110);
camera.rotation.order='YXZ';
const fogCol=new T.Vector3(...FOGS[0]);
renderer.setClearColor(new T.Color(fogCol.x,fogCol.y,fogCol.z),1);

const rt=new T.WebGLRenderTarget(window.innerWidth*pixelRatio,window.innerHeight*pixelRatio,{type:T.HalfFloatType,samples:isGL2?4:0});
const composer=new T.EffectComposer(renderer,rt);
composer.setPixelRatio(pixelRatio);
composer.setSize(window.innerWidth,window.innerHeight);
composer.addPass(new T.RenderPass(scene,camera));
const bloom=new T.UnrealBloomPass(new T.Vector2(window.innerWidth,window.innerHeight),0.8,0.55,0.76);
[bloom.renderTargetBright,...bloom.renderTargetsHorizontal,...bloom.renderTargetsVertical].forEach(t=>{ if(t)t.texture.type=T.HalfFloatType; });
composer.addPass(bloom);
const FinalShader={
  uniforms:{tDiffuse:{value:null},uTime:{value:0},uRes:{value:new T.Vector2(1,1)},uExposure:{value:1.1},uFade:{value:1},uHeat:{value:0},uSwim:{value:0},uHurt:{value:0},uSlow:{value:0},uTint:{value:new T.Vector3(1,1,1)}},
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uExposure; uniform float uFade; uniform float uHeat; uniform float uSwim; uniform float uHurt; uniform float uSlow; uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
    void main(){
      vec2 uv0=vUv+vec2((sin(vUv.y*90.0+uTime*5.0)+sin(vUv.y*53.0-uTime*3.7))*0.0011*uHeat*(1.0-vUv.y),0.0);
      uv0.x+=sin(vUv.y*38.0+uTime*2.2)*0.0016*uSwim;
      vec2 c=uv0-0.5; float r2=dot(c,c);
      vec2 off=c*(0.0008+r2*0.0045);
      vec3 col=vec3(texture2D(tDiffuse,uv0+off).r,texture2D(tDiffuse,uv0).g,texture2D(tDiffuse,uv0-off).b);
      col*=uExposure;
      col=aces(col);
      col=mix(col,col*vec3(0.5,0.75,1.0)+vec3(0.0,0.015,0.04),uSwim*(0.25+0.6*smoothstep(0.6,0.3,vUv.y)));
      col=pow(col,vec3(0.4545));
      col+=vec3(0.010,0.005,0.026)*(1.0-col);
      float lum=dot(col,vec3(0.299,0.587,0.114)); col=mix(col,vec3(lum)*vec3(0.9,0.94,1.06),0.32*uSlow);
      col+=uTint*0.09*uSlow*smoothstep(0.08,0.5,r2);
      float vig=1.0-smoothstep(0.16,0.75,r2*1.3);
      col*=mix(0.32-0.12*uSlow,1.0,vig);
      col+=(hash(vUv*uRes+fract(uTime*7.31)*91.7)-0.5)*0.022;
      col=mix(col,col*vec3(1.0,0.35,0.3)+vec3(0.18,0.0,0.0),clamp(uHurt,0.0,1.0)*(0.25+0.75*smoothstep(0.05,0.45,r2)));
      gl_FragColor=vec4(col*uFade,1.0);
    }`
};
const finalPass=new T.ShaderPass(FinalShader);
composer.addPass(finalPass);

// ---------------------------------------------------------------- shaders
const GLSL_COMMON=`
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec2 glyphUV(float g, vec2 uv){ uv=uv*0.94+0.03; float cx=mod(g,16.0); float cy=floor(g/16.0); return vec2((cx+uv.x)/16.0, 1.0-(cy+1.0-uv.y)/7.0); }
`;
const STATIC_VS=`
#define NSL ${NSL}
#define NDL ${NDL}
attribute float iGlyph; attribute vec3 iColor; attribute vec4 iEmit; attribute vec3 iLI; attribute vec3 iLW;
uniform float uTime; uniform vec3 uSL[NSL]; uniform vec4 uDLP[NDL]; uniform vec3 uDLC[NDL]; uniform float uFogDen; uniform float uRamp[16]; uniform float uAmb; uniform sampler2D uCell; uniform float uCollT; uniform vec3 uCamP; uniform vec3 uCutP; uniform float uCut;
varying vec2 vUv; varying vec3 vCol; varying float vFog;
${GLSL_COMMON}
void main(){
  float kind=iEmit.z; float ph=iEmit.y;
  vec3 pos=position;
  if(kind>4.5&&kind<5.5) pos.x+=sin(uTime*1.4+ph*40.0)*0.16*(pos.y+0.5);
  if(kind>12.5&&kind<13.5) pos.x+=sin(uTime*1.1+ph*40.0)*0.08*(pos.y+0.5);
  vec4 wp=modelMatrix*instanceMatrix*vec4(pos,1.0);
  vec3 ctr=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
  vec3 n=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*vec3(0.0,0.0,1.0));
  float cutG=0.0;
  if(uCut>0.5){ vec3 seg=uCutP-uCamP; float L2=max(dot(seg,seg),1e-4); float tc=clamp(dot(ctr-uCamP,seg)/L2,0.0,1.0);
    float rc=mix(2.6,0.9,tc), dc=length(ctr-(uCamP+seg*tc));
    if(tc<0.97&&dc<rc){ if(fract(ph*91.7)>0.1) wp.xyz=vec3(0.0,-1000.0,0.0); else cutG=1.0; }
    else if(tc<0.97&&dc<rc+0.35) cutG=-1.0; }
  // cell state: r = firelight (smooth), g = own fire, b = ash, a = event flag (100 statue gone, 200 floor collapsed)
  vec2 csz=vec2(${MW}.0,${MH}.0);
  float fireL=texture2D(uCell,(ctr.xz+n.xz*0.6)/(csz*${CELL}.0)).r;
  vec4 cs=texture2D(uCell,(floor(ctr.xz/${CELL}.0)+0.5)/csz);
  float evf=cs.a*255.0;
  bool isFloor=(kind>0.5&&kind<1.5)||(kind>4.5&&kind<5.5)||(kind>8.5&&kind<9.5);
  if(kind>11.5&&kind<12.5&&evf<150.0) wp.xyz=vec3(0.0,-1000.0,0.0);
  if(evf>150.0&&isFloor){ float ft=max(uTime-uCollT,0.0); wp.y-=4.9*ft*ft; if(ft>2.5) wp.xyz=vec3(0.0,-1000.0,0.0); }
  if(evf>50.0&&evf<150.0&&kind>7.5&&kind<8.5) wp.xyz=vec3(0.0,-1000.0,0.0);
  if(cs.b>0.5&&kind>4.5&&kind<5.5) wp.xyz=vec3(0.0,-1000.0,0.0);
  if(kind>12.5&&kind<13.5){ if(cs.b>0.5||(evf>40.0&&evf<80.0)) wp.xyz=vec3(0.0,-1000.0,0.0); else { wp.x+=sin(uTime*0.9+ctr.z*0.6+ph*9.0)*0.035*ctr.y; if(evf>15.0&&evf<25.0) wp.y*=0.16; } }
  if(evf>40.0&&evf<80.0){ if(kind>4.5&&kind<5.5) wp.xyz=vec3(0.0,-1000.0,0.0); else if(isFloor) wp.y+=0.05+sin(uTime*1.5+ctr.x*1.7)*0.015; }
  if(kind>2.5&&kind<3.5){ wp.y+=(sin(ctr.x*1.7+uTime*1.6)+sin(ctr.z*1.3-uTime*1.1))*0.018; }
  vec3 lit=vec3(0.0);
  for(int k=0;k<3;k++){ float id=iLI[k]; if(id>-0.5) lit+=uSL[int(id+0.5)]*iLW[k]; }
  for(int i=0;i<NDL;i++){
    vec3 d=uDLP[i].xyz-ctr; float dist=length(d); float x=clamp(1.0-dist/max(uDLP[i].w,0.001),0.0,1.0);
    float ndl=max(dot(n,d/max(dist,0.001))*0.6+0.4,0.0);
    lit+=uDLC[i]*x*x*ndl;
  }
  lit+=vec3(1.0,0.45,0.12)*fireL*3.4*(0.85+0.15*sin(uTime*11.0+ctr.x*3.0));
  // soft knee: lifts dim light, compresses hot spots near light sources while keeping hue
  float lm=max(max(lit.r,lit.g),lit.b);
  lit*=1.55/(1.0+lm*0.8);
  float spd=0.4+fract(ph*17.3)*0.9;
  float emis=iEmit.x*(0.72+0.28*sin(uTime*spd+ph*6.2831));
  if(kind<2.5||(kind>5.5&&kind<6.5)||(kind>7.5&&kind<9.5)) emis*=uAmb;
  float g=iGlyph;
  float tt=floor(uTime*(0.3+fract(ph*7.1)*0.5)+ph*31.0);
  float h=hash(vec2(ph*97.13,tt));
  float flash=0.0;
  if(kind<0.5||(kind>5.5&&kind<6.5)){
    if(h>0.991){ g=3.0+floor(hash(vec2(tt,ph*13.7))*90.0); flash=1.0; }
  } else if(kind>3.5&&kind<4.5){
    if(h>0.55) g=3.0+floor(hash(vec2(tt*1.3,ph*5.1))*90.0);
    emis*=1.0+1.1*pow(0.5+0.5*sin(uTime*2.0+ph*20.0),4.0);
  } else if(kind>1.5&&kind<2.5){
    emis*=0.45+1.3*pow(0.5+0.5*sin(uTime*(1.2+ph*2.5)+ph*50.0),6.0);
  } else if(kind>2.5&&kind<3.5){
    float wv=sin(ctr.x*2.1+ctr.z*1.3-uTime*1.8);
    if(iEmit.w>0.0005){ float an=(iEmit.w-0.001)*6.2831; vec2 fd=vec2(cos(an),sin(an)); wv=sin(dot(ctr.xz,fd)*1.8-uTime*3.2+sin(dot(ctr.xz,vec2(-fd.y,fd.x))*0.7+uTime*0.4)*0.9); }
    g = wv>0.62 ? 13.0 : (wv<-0.75 ? 29.0 : iGlyph);
    emis*=0.7+0.6*(0.5+0.5*wv);
  } else if(kind>6.5&&kind<7.5){
    emis*=0.6+0.6*pow(0.5+0.5*sin(uTime*0.9+ph*30.0),3.0);
  } else if(kind>10.5){
    float sh=0.5+0.5*sin(uTime*1.3+ctr.y*2.2+ph*20.0);
    emis*=0.7+0.7*sh*sh;
  }
  float wave=pow(0.5+0.5*sin(dot(ctr,vec3(0.23,0.11,0.17))-uTime*0.55),14.0);
  emis+=wave*0.09+flash*0.6;
  float heat=0.0;
  if(kind>9.5&&kind<10.5){
    // lava: slow flowing heat bands; the glyph itself shows the temperature
    float f1=sin(ctr.x*0.9+ctr.z*0.4-uTime*0.55+sin(ctr.z*0.7+uTime*0.3)*1.6);
    float f2=sin(ctr.z*1.3-ctr.x*0.6+uTime*0.8);
    heat=clamp(0.5+0.32*f1+0.22*f2,0.0,1.0);
    if(iEmit.w>0.5) heat*=0.22;
    else g = heat>0.82 ? 10.0 : (heat>0.55 ? 94.0 : (heat>0.32 ? 29.0 : 13.0));
    wp.y+=sin(uTime*1.3+ph*30.0)*0.02;
  }
  vCol=iColor*(lit+vec3(emis));
  if(kind>10.5){ vec3 pr=0.55+0.45*cos(6.2831*(vec3(0.0,0.33,0.67)+ctr.y*0.12+uTime*0.04+ph*0.5)); vCol=iColor*mix(vec3(1.0),pr,0.55)*(lit*0.7+vec3(emis)); }
  else if(kind>9.5){ vCol=mix(vec3(0.6,0.06,0.02),vec3(1.0,0.68,0.24),heat)*(0.6+3.0*heat*heat)+lit*iColor*0.15; }
  else if(kind>7.5){
    // ASCII-art shading: the glyph itself encodes how much light the rock receives
    float L=dot(vCol,vec3(0.3,0.55,0.15));
    float ri=sqrt(L*2.4)*15.99+(fract(ph*13.7)-0.5)*1.8;
    if(kind>8.5) ri=min(ri*0.6,8.0);
    g=uRamp[int(clamp(ri,0.0,15.0))];
  }
  if(isFloor){
    if(cs.b>0.5){ vCol*=vec3(0.32,0.3,0.3); g=hash(vec2(ph,3.0))>0.5?12.0:14.0; }
    if(evf>25.0&&evf<35.0&&kind>4.5&&kind<5.5){ vCol*=vec3(0.22,0.3,0.25); }
    if(evf>40.0&&evf<60.0){ float wv=sin(ctr.x*2.1+ctr.z*1.3-uTime*1.8); g=wv>0.5?13.0:94.0; vCol=vec3(0.25,0.6,1.0)*(lit*0.55+vec3(0.14+0.06*wv)); }
    else if(evf>60.0&&evf<80.0){ float f1=sin(ctr.x*0.9+ctr.z*0.4-uTime*0.55+sin(ctr.z*0.7+uTime*0.3)*1.6); float ht=clamp(0.5+0.4*f1,0.0,1.0); g=ht>0.75?10.0:(ht>0.45?94.0:29.0); vCol=mix(vec3(0.6,0.06,0.02),vec3(1.0,0.68,0.24),ht)*(0.6+3.0*ht*ht); }
    if(cs.g>0.02){ float fk=cs.g*(1.6+0.6*sin(uTime*13.0+ph*30.0)); vCol=mix(vCol,vec3(1.0,0.5,0.12)*fk*2.2,min(1.0,cs.g*1.2)); if(hash(vec2(ph,floor(uTime*6.0)))>0.6) g=62.0; }
  }
  if(kind>12.5&&kind<13.5&&evf>15.0&&evf<25.0) vCol*=0.55;
  if(cutG>0.5) vCol*=0.22; else if(cutG<-0.5) vCol=vCol*1.35+vec3(0.08,0.06,0.04);
  vUv=glyphUV(g,uv);
  vec4 mv=viewMatrix*wp;
  float dd=length(mv.xyz);
  vFog=1.0-exp(-uFogDen*uFogDen*dd*dd);
  gl_Position=projectionMatrix*mv;
}`;
// ---------------------------------------------------------------- water surface: one plane drawing the '~' glyphs in its fragment shader
const WATER_VS=`
varying vec3 vW;
void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const WATER_FS=`
#define NSL ${NSL}
#define NDL ${NDL}
uniform sampler2D uAtlas; uniform sampler2D uWater; uniform sampler2D uWaterL; uniform float uTime;
uniform vec3 uSL[NSL]; uniform vec4 uDLP[NDL]; uniform vec3 uDLC[NDL]; uniform float uFogDen; uniform vec3 uFogColor;
varying vec3 vW;
${GLSL_COMMON}
void main(){
  vec2 csz=vec2(${MW}.0,${MH}.0); vec2 cc=floor(vW.xz/${CELL}.0);
  if(cc.x<0.0||cc.y<0.0||cc.x>=csz.x||cc.y>=csz.y) discard;
  vec4 w=texture2D(uWater,(cc+0.5)/csz);
  if(w.r<0.25) discard;
  bool deep=w.r>0.75;
  float sub=deep?${CELL}.0/3.0:${CELL}.0/4.0;
  vec2 sp=vW.xz/sub; sp.x+=mod(floor(sp.y),2.0)*0.5; vec2 si=floor(sp), lp=fract(sp);
  vec2 ctr=(si+0.5)*sub;
  float hh=hash(si*0.37+1.3);
  lp+=vec2(hash(si+7.1),hash(si+3.3))*0.36-0.18;
  float wv=sin(ctr.x*2.1+ctr.y*1.3-uTime*1.8);
  if(w.g>0.0005){ float an=(w.g-0.001)*6.2831; vec2 fd=vec2(cos(an),sin(an)); wv=sin(dot(ctr,fd)*1.8-uTime*3.2+sin(dot(ctr,vec2(-fd.y,fd.x))*0.7+uTime*0.4)*0.9); }
  float g=wv>0.62?13.0:(wv<-0.75?29.0:94.0);
  float scale=(deep?0.58:0.5)/sub*(0.75+0.5*hash(si+11.7));
  vec2 uv=(lp-0.5)/scale+0.5; uv.y=1.0-uv.y;
  if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0) discard;
  float a=texture2D(uAtlas,glyphUV(g,uv),-0.6).a;
  float fw=max(fwidth(a),0.04); a=clamp((a-0.42)/fw+0.5,0.0,1.0);
  if(a<0.03) discard;
  vec4 L=texture2D(uWaterL,(cc+0.5)/csz);
  vec3 lit=vec3(0.0);
  if(L.x>0.5) lit+=uSL[int(L.x-0.5)]*L.y;
  if(L.z>0.5) lit+=uSL[int(L.z-0.5)]*L.w;
  for(int i=0;i<NDL;i++){ vec3 d=uDLP[i].xyz-vW; float dist=length(d); float x=clamp(1.0-dist/max(uDLP[i].w,0.001),0.0,1.0); lit+=uDLC[i]*x*x*(max(d.y/max(dist,0.001),0.0)*0.6+0.4); }
  float lm=max(max(lit.r,lit.g),lit.b); lit*=1.55/(1.0+lm*0.8);
  vec3 wc=deep?vec3(0.1,0.22,0.55):(w.b>0.5?vec3(0.22,0.72,1.0):vec3(0.28,0.62,1.0));
  float emis=(deep?(w.b>0.5?0.12:0.06):(w.b>0.5?0.24:0.16))*(0.7+0.6*(0.5+0.5*wv));
  vec3 col=wc*(0.8+0.4*hh)*(lit+vec3(emis));
  if(w.a>0.5){ float ap=0.5+0.5*sin(uTime*0.9+ctr.x*0.7+ctr.y*0.5+hh*6.0); col+=vec3(0.15,0.9,0.55)*(0.25+0.55*ap*ap); }
  float dd=distance(cameraPosition,vW); float fog=1.0-exp(-uFogDen*uFogDen*dd*dd);
  gl_FragColor=vec4(mix(col,uFogColor,fog),a);
}`;
const GLYPH_FS=`
uniform sampler2D uAtlas; uniform vec3 uFogColor;
varying vec2 vUv; varying vec3 vCol; varying float vFog;
void main(){
  float a=texture2D(uAtlas,vUv,-0.6).a;
  float fw=max(fwidth(a),0.04);
  a=clamp((a-0.42)/fw+0.5,0.0,1.0);
  if(a<0.03) discard;
  gl_FragColor=vec4(mix(vCol,uFogColor,vFog),a);
}`;
const DYN_VS=`
attribute vec3 iPos; attribute vec3 iCol; attribute vec4 iP;
uniform float uFogDen;
varying vec2 vUv; varying vec3 vCol; varying float vFog;
${GLSL_COMMON}
void main(){
  vec2 p=position.xy*iP.y;
  vec4 mv;
  if(iP.z<0.5){ mv=viewMatrix*vec4(iPos,1.0); mv.xy+=p; }
  else{
    float c=cos(iP.w), s=sin(iP.w); vec3 w=iPos;
    if(iP.z<1.5) w+=vec3(p.x*c-p.y*s,0.0,p.x*s+p.y*c);
    else w+=vec3(p.x*c,p.y,-p.x*s);
    mv=viewMatrix*vec4(w,1.0);
  }
  vCol=iCol; vUv=glyphUV(iP.x,uv);
  float dd=length(mv.xyz); vFog=1.0-exp(-uFogDen*uFogDen*dd*dd);
  gl_Position=projectionMatrix*mv;
}`;
const PT_VS=`
attribute vec3 aCol; attribute float aSize; attribute float aGlyph;
uniform float uScale; uniform float uFogDen;
varying vec3 vCol; varying float vGlyph;
void main(){
  vec4 mv=viewMatrix*vec4(position,1.0);
  float dd=length(mv.xyz);
  vCol=aCol*exp(-uFogDen*uFogDen*dd*dd)*smoothstep(0.25,1.4,dd);
  vGlyph=aGlyph;
  gl_PointSize=clamp(aSize*uScale/max(-mv.z,0.05),0.0,256.0);
  gl_Position=projectionMatrix*mv;
}`;
const PT_FS=`
uniform sampler2D uAtlas;
varying vec3 vCol; varying float vGlyph;
void main(){
  vec2 pc=vec2(gl_PointCoord.x,1.0-gl_PointCoord.y);
  vec2 uv=pc*0.94+0.03;
  float cx=mod(vGlyph,16.0), cy=floor(vGlyph/16.0);
  float a=texture2D(uAtlas,vec2((cx+uv.x)/16.0,1.0-(cy+1.0-uv.y)/7.0)).a;
  float r=length(pc-0.5);
  float k=a+exp(-r*r*20.0)*0.3;
  if(k<0.01) discard;
  gl_FragColor=vec4(vCol*k,1.0);
}`;

// ---------------------------------------------------------------- shared uniforms
const SL=new Float32Array(NSL*3), DLP=new Float32Array(NDL*4), DLC=new Float32Array(NDL*3);
const cellData=new Uint8Array(NCELL*4);
const cellTex=new T.DataTexture(cellData,MW,MH,T.RGBAFormat,T.UnsignedByteType);
cellTex.magFilter=T.LinearFilter; cellTex.minFilter=T.LinearFilter; cellTex.needsUpdate=true;
const U={
  uCell:{value:cellTex}, uCollT:{value:-100},
  uAtlas:{value:null}, uTime:{value:0}, uSL:{value:SL}, uDLP:{value:DLP}, uDLC:{value:DLC},
  uCamP:{value:new T.Vector3()}, uCutP:{value:new T.Vector3()}, uCut:{value:0},
  uFogDen:{value:0.05}, uFogColor:{value:fogCol}, uScale:{value:600}, uRamp:{value:new Float32Array([...RAMP_CH].map(c=>c.charCodeAt(0)-32))}, uAmb:{value:1}
};
let staticMat, dynMat, ptMat, occMat;

// ---------------------------------------------------------------- glyph atlas
function buildAtlas(){
  const AC=128, c=document.createElement('canvas'); c.width=16*AC; c.height=7*AC;
  const x=c.getContext('2d');
  x.fillStyle='#fff'; x.strokeStyle='#fff'; x.textAlign='center'; x.textBaseline='middle';
  x.font=`800 ${Math.round(AC*0.74)}px "JetBrains Mono","DejaVu Sans Mono",Menlo,Consolas,monospace`;
  x.lineWidth=AC*0.03; x.lineJoin='round';
  for(let i=1;i<95;i++){ const ch=String.fromCharCode(32+i), cx=(i%16+0.5)*AC, cy=(Math.floor(i/16)+0.5)*AC+AC*0.03; x.fillText(ch,cx,cy); x.strokeText(ch,cx,cy); }
  x.font=`500 ${Math.round(AC*0.8)}px ${RUNE_FONT}`; x.lineWidth=AC*0.035;
  for(let k=0;k<RUNE_CHARS.length;k++){ const cx=(k+0.5)*AC, cy=6.5*AC+AC*0.02; x.fillText(RUNE_CHARS[k],cx,cy); x.strokeText(RUNE_CHARS[k],cx,cy); }
  const tex=new T.CanvasTexture(c);
  tex.generateMipmaps=true; tex.minFilter=T.LinearMipmapLinearFilter; tex.magFilter=T.LinearFilter;
  tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy()); tex.needsUpdate=true;
  return tex;
}

// ---------------------------------------------------------------- dynamic glyph billboards
const DYN_MAX=12000;
const dPos=new Float32Array(DYN_MAX*3), dCol=new Float32Array(DYN_MAX*3), dPar=new Float32Array(DYN_MAX*4);
const dynGeo=new T.InstancedBufferGeometry();
{ const pg=new T.PlaneGeometry(1,1); dynGeo.index=pg.index; dynGeo.setAttribute('position',pg.attributes.position); dynGeo.setAttribute('uv',pg.attributes.uv); }
const aPos=new T.InstancedBufferAttribute(dPos,3).setUsage(T.DynamicDrawUsage);
const aCol=new T.InstancedBufferAttribute(dCol,3).setUsage(T.DynamicDrawUsage);
const aPar=new T.InstancedBufferAttribute(dPar,4).setUsage(T.DynamicDrawUsage);
dynGeo.setAttribute('iPos',aPos); dynGeo.setAttribute('iCol',aCol); dynGeo.setAttribute('iP',aPar);
dynGeo.instanceCount=0;
let dn=0;
function dyn(x,y,z,g,size,r,gg,b,mode,yaw){
  if(dn>=DYN_MAX)return; const i3=dn*3, i4=dn*4;
  dPos[i3]=x; dPos[i3+1]=y; dPos[i3+2]=z; dCol[i3]=r; dCol[i3+1]=gg; dCol[i3+2]=b;
  dPar[i4]=g; dPar[i4+1]=size; dPar[i4+2]=mode||0; dPar[i4+3]=yaw||0; dn++;
}
function flushDyn(){
  dynGeo.instanceCount=dn;
  for(const [a,s] of [[aPos,3],[aCol,3],[aPar,4]]){ a.updateRange.offset=0; a.updateRange.count=Math.max(1,dn*s); a.needsUpdate=true; }
}

// ---------------------------------------------------------------- particles
const DUST_N=900, GAS_N=700, P_MAX=3600, PT_TOTAL=DUST_N+GAS_N+P_MAX, P0=DUST_N+GAS_N;
const ptPos=new Float32Array(PT_TOTAL*3), ptCol=new Float32Array(PT_TOTAL*3), ptSize=new Float32Array(PT_TOTAL), ptGly=new Float32Array(PT_TOTAL);
const ptGeo=new T.BufferGeometry();
const bpPos=new T.BufferAttribute(ptPos,3).setUsage(T.DynamicDrawUsage), bpCol=new T.BufferAttribute(ptCol,3).setUsage(T.DynamicDrawUsage),
      bpSize=new T.BufferAttribute(ptSize,1).setUsage(T.DynamicDrawUsage), bpGly=new T.BufferAttribute(ptGly,1).setUsage(T.DynamicDrawUsage);
ptGeo.setAttribute('position',bpPos); ptGeo.setAttribute('aCol',bpCol); ptGeo.setAttribute('aSize',bpSize); ptGeo.setAttribute('aGlyph',bpGly);
const dust={x:new Float32Array(DUST_N),y:new Float32Array(DUST_N),z:new Float32Array(DUST_N),ph:new Float32Array(DUST_N),g:new Float32Array(DUST_N),s:new Float32Array(DUST_N)};
const P={x:new Float32Array(P_MAX),y:new Float32Array(P_MAX),z:new Float32Array(P_MAX),vx:new Float32Array(P_MAX),vy:new Float32Array(P_MAX),vz:new Float32Array(P_MAX),
  age:new Float32Array(P_MAX),life:new Float32Array(P_MAX),r:new Float32Array(P_MAX),g:new Float32Array(P_MAX),b:new Float32Array(P_MAX),gl:new Float32Array(P_MAX),
  sz:new Float32Array(P_MAX),ty:new Uint8Array(P_MAX),ph:new Float32Array(P_MAX)};
const PF=Object.values(P);
let pN=0;
function spawn(x,y,z,vx,vy,vz,life,gl,sz,r,g,b,ty){
  if(pN>=P_MAX)return; const i=pN++;
  P.x[i]=x;P.y[i]=y;P.z[i]=z;P.vx[i]=vx;P.vy[i]=vy;P.vz[i]=vz;P.age[i]=0;P.life[i]=life;P.gl[i]=gl;P.sz[i]=sz;P.r[i]=r;P.g[i]=g;P.b[i]=b;P.ty[i]=ty;P.ph[i]=mr()*100;
}
function killP(i){ const j=--pN; if(i!==j)for(const a of PF)a[i]=a[j]; }

// ---------------------------------------------------------------- world state
let D=null, depth=1, staticMesh=null, occMesh=null, glyphCount=0;
let monsters=[], fixtures=[];
let explored=new Uint8Array(NCELL), mem=new Float32Array(NCELL*3), fovVis=new Uint32Array(NCELL), fovStamp=1;
let visitedRooms=new Set(), stairsSeen=false, fogBase=0.05;
const player={x:0,z:0,vx:0,vz:0,yaw:0,pitch:-0.04,bob:0,eye:1.62,hp:40};
const edge={t:0,k:'',idle:0};
let hintHTML='';
function showHint(h){ if(h===hintHTML)return; hintHTML=h; const el=document.getElementById('hint'); if(el)el.innerHTML=h; }
const ceilAt=(x,z)=>{ const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL); if(cx<0||cz<0||cx>=MW||cz>=MH)return BASE_H; return D.ceil[cz*MW+cx]; };

// value noise (deterministic per level)
let noiseSeed=1;
const hash3=(x,y,z)=>{ let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1274126177)^noiseSeed; h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16; return (h>>>0)/4294967296; };
function vnoise(x,y,z){
  const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z), xf=x-xi, yf=y-yi, zf=z-zi;
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf), w=zf*zf*(3-2*zf);
  const l=(a,b,t)=>a+(b-a)*t;
  return l(l(l(hash3(xi,yi,zi),hash3(xi+1,yi,zi),u),l(hash3(xi,yi+1,zi),hash3(xi+1,yi+1,zi),u),v),
           l(l(hash3(xi,yi,zi+1),hash3(xi+1,yi,zi+1),u),l(hash3(xi,yi+1,zi+1),hash3(xi+1,yi+1,zi+1),u),v),w);
}
const sstep=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };

let chunks=[];
let waterMesh=null, waterTex=null, waterLTex=null;
function makeWater(){
  waterTex=new T.DataTexture(new Float32Array(NCELL*4),MW,MH,T.RGBAFormat,T.FloatType); waterTex.magFilter=waterTex.minFilter=T.NearestFilter;
  waterLTex=new T.DataTexture(new Float32Array(NCELL*4),MW,MH,T.RGBAFormat,T.FloatType); waterLTex.magFilter=waterLTex.minFilter=T.NearestFilter;
  const mat=new T.ShaderMaterial({uniforms:{uAtlas:U.uAtlas,uTime:U.uTime,uSL:U.uSL,uDLP:U.uDLP,uDLC:U.uDLC,uFogDen:U.uFogDen,uFogColor:U.uFogColor,uWater:{value:waterTex},uWaterL:{value:waterLTex}},
    vertexShader:WATER_VS,fragmentShader:WATER_FS,side:T.DoubleSide,alphaToCoverage:true,extensions:{derivatives:true}});
  const geo=new T.PlaneGeometry(MW*CELL,MH*CELL); geo.rotateX(-Math.PI/2);
  waterMesh=new T.Mesh(geo,mat); waterMesh.position.set(MW*CELL/2,0.06,MH*CELL/2); waterMesh.frustumCulled=false; scene.add(waterMesh);
}
function updateWater(){
  const W2=waterTex.image.data, L2=waterLTex.image.data, oI=new Float32Array(3), oW=new Float32Array(3);
  for(let i=0;i<NCELL;i++){
    const lq=D.liquid[i], o=i*4; W2[o]=W2[o+1]=W2[o+2]=W2[o+3]=0; L2[o]=L2[o+1]=L2[o+2]=L2[o+3]=0;
    if(lq!==LQ_WATER&&lq!==LQ_DEEP)continue;
    const r=D.roomOf[i]>=0?D.rooms[D.roomOf[i]]:null, lake=(r&&r.theme&&r.theme.k==='lake')||D.stratum.k==='cavern';
    W2[o]=lq===LQ_DEEP?1:0.5; W2[o+1]=D.flow[i]?flowW(D.flow[i]):0; W2[o+2]=lake?1:0; W2[o+3]=D.algae&&D.algae[i]?1:0;
    topLights(D.lights,(i%MW+0.5)*CELL,0.1,(((i/MW)|0)+0.5)*CELL,0,1,0,i,oI,oW,0);
    L2[o]=oI[0]>=0?oI[0]+1:0; L2[o+1]=oW[0]; L2[o+2]=oI[1]>=0?oI[1]+1:0; L2[o+3]=oW[1];
  }
  waterTex.needsUpdate=true; waterLTex.needsUpdate=true;
}

const flowW=f=>((((f-10)%(Math.PI*2))+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*0.998+0.001;
const CHUNK=8, CXN=Math.ceil(MW/CHUNK), CZN=Math.ceil(MH/CHUNK);
function buildWorld(){
  for(const c of chunks){ scene.remove(c.mesh); c.mesh.geometry.dispose(); }
  chunks=[];
  if(occMesh){ scene.remove(occMesh); occMesh.geometry.dispose(); }
  const {tile,liquid,surface,roomOf,rooms,lights,ceil}=D;
  noiseSeed=D.noiseSeed;
  const cap=360000;
  const M=new Float32Array(cap*16), GL=new Float32Array(cap), CO=new Float32Array(cap*3), EM=new Float32Array(cap*4), LI=new Float32Array(cap*3), LW=new Float32Array(cap*3);
  const CK=new Int16Array(cap), PY=new Float32Array(cap);
  let n=0; const occ=[];
  const m4=new T.Matrix4(), q=new T.Quaternion(), e=new T.Euler(0,0,0,'YXZ'), p=new T.Vector3(), s=new T.Vector3();
  const push=(x,y,z,ex,ey,size,g,r,gg,b,emis,kind,ref,nx,ny,nz)=>{
    if(n>=cap)return;
    e.set(ex,ey,0,'YXZ'); q.setFromEuler(e); p.set(x,y,z); s.set(size,size,size); m4.compose(p,q,s); m4.toArray(M,n*16);
    GL[n]=g; CO[n*3]=r; CO[n*3+1]=gg; CO[n*3+2]=b; EM[n*4]=emis; EM[n*4+1]=rand(); EM[n*4+2]=kind; EM[n*4+3]=0;
    topLights(lights,x,y,z,nx,ny,nz,ref,LI,LW,n*3);
    { const ci=cellOf(x,z), dm=ci>=0?D.darkMul[ci]:1; if(dm<1){ LW[n*3]*=dm; LW[n*3+1]*=dm; LW[n*3+2]*=dm; EM[n*4]*=0.3+0.7*dm; } }
    CK[n]=clamp(Math.floor(x/(CELL*CHUNK)),0,CXN-1)+clamp(Math.floor(z/(CELL*CHUNK)),0,CZN-1)*CXN; PY[n]=y;
    n++;
  };
  const pushX=(x,y,z,size,g,c,emis,kind,ref)=>{ const yaw=rand()*Math.PI; push(x,y,z,0,yaw,size,g,c[0],c[1],c[2],emis,kind,ref,null,0,0); push(x,y,z,0,yaw+Math.PI/2,size,g,c[0],c[1],c[2],emis,kind,ref,null,0,0); };
  const cellOf=(x,z)=>{ const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL); return (cx<0||cz<0||cx>=MW||cz>=MH)?-1:cz*MW+cx; };

  // masonry wall face for ordinary rooms and corridors (layered glyphs receding into the stone)
  const RG='##==||[]HH#:=#|][', FGL='##H=+#|#=#';
  let faceStyle=null, faceSkip=null, faceVein=0;
  const face=(pcx,pcz,yaw,nX,nZ,y0,y1,ref,tint,layers,occl,th)=>{
    const ruinW=D.stratum.k==='ruins', fortW=D.stratum.k==='fortress', rmF=roomOf[ref]>=0?rooms[roomOf[ref]]:null;
    const tX=Math.cos(yaw), tZ=-Math.sin(yaw);
    const segs=[];
    if(y0<0)segs.push([y0,Math.min(y1,0),0.62,3,0.66]);
    if(y1>0&&y0<BASE_H)segs.push([Math.max(y0,0),Math.min(y1,BASE_H),0.4,5,0.44]);
    if(y1>BASE_H)segs.push([Math.max(y0,BASE_H),y1,0.66,3,0.7]);
    for(const [a,b,target,cols,size] of segs){
      const len=b-a; if(len<0.1)continue;
      const rows=Math.max(1,Math.round(len/target)), sp=len/rows;
      for(let row=0;row<rows;row++){
        const yc=a+(row+0.5)*sp;
        const lyr=((ruinW||fortW)&&(a>=BASE_H-0.01||!rmF))?1:layers;
        for(let L=0;L<lyr;L++){
          const off=(L%2)?(CELL/cols)*0.5:0, sz=size*(1-0.15*L), dim=1-0.36*L;
          for(let col=0;col<cols;col++){
            let u=(col+0.5)*(CELL/cols)-CELL/2+off; if(u>CELL/2)u-=CELL;
            if(faceSkip&&faceSkip(u,yc))continue;
            const dp=L===0?rand()*0.035:-(L*0.24+rand()*0.04), v=(0.75+rand()*0.45)*dim;
            let r=tint[0]*v, g=tint[1]*v, bb=tint[2]*v, emis=(0.03+rand()*0.035)*dim, kind=0, ch=faceStyle?faceStyle.wall[Math.floor(rand()*faceStyle.wall.length)]:ruinW?RG[Math.floor(rand()*RG.length)]:fortW?FGL[Math.floor(rand()*FGL.length)]:WG[Math.floor(rand()*WG.length)];
            if(yc<0){ const kd=clamp(1+yc/CH_D,0.15,1); r*=kd; g*=kd; bb*=kd; }
            if(L===0&&rand()<(faceStyle?0.05:ruinW?0.035:0.012)){ kind=4; const c=th?th.col:[0.6,0.45,1.0]; r=c[0]; g=c[1]; bb=c[2]; emis=0.5+rand()*0.6; ch=pick(RUNESET); }
            if(L===0&&faceVein&&kind!==4&&rand()<0.24){ const vc=VEIN_COL[faceVein]; ch=faceVein===1?'$':'*'; r=vc[0]; g=vc[1]; bb=vc[2]; emis=0.35+rand()*0.25; kind=7; }
            push(pcx+tX*u+nX*dp,yc,pcz+tZ*u+nZ*dp,0,yaw,sz,G(ch),r,g,bb,emis,kind,ref,nX,0,nZ);
          }
        }
      }
    }
    if(ruinW&&y1>2&&rand()<(rmF&&rmF.rkind==='garden'?0.55:0.16)){
      const tX=Math.cos(yaw), tZ=-Math.sin(yaw), u=R(-0.8,0.8), len=R(1.2,Math.min(4.2,y1-0.6)), glow=rmF&&rmF.rkind==='garden'&&rand()<0.5;
      for(let y=y1-0.2;y>y1-len;y-=0.3)push(pcx+tX*(u+Math.sin(y*2)*0.08)+nX*0.07,y,pcz+tZ*(u+Math.sin(y*2)*0.08)+nZ*0.07,0,yaw,0.34,G(pick([';','{','}','(',')','~'])),glow?0.35:0.3,glow?1.0:0.8,glow?0.85:0.4,glow?0.28:0.05,5,ref,nX,0,nZ);
    }
    if(occl){
      const od=layers*0.24+0.1, ocx=pcx-nX*od, ocz=pcz-nZ*od, hw=(CELL+0.1)/2;
      occ.push(ocx-tX*hw,y0,ocz-tZ*hw, ocx+tX*hw,y0,ocz+tZ*hw, ocx+tX*hw,y1,ocz+tZ*hw, ocx-tX*hw,y0,ocz-tZ*hw, ocx+tX*hw,y1,ocz+tZ*hw, ocx-tX*hw,y1,ocz-tZ*hw);
    }
  };

  // ---- organic cavern surfaces: a smoothed distance field + 3D noise, sliced into contour lines
  const FR=0.5, Y0=2.2;
  const rockN=(x,y,z)=>{ const nn=0.65*vnoise(x*0.5,y*0.5,z*0.5)+0.35*vnoise(x*1.25+31.7,y*1.25,z*1.25); const t=sstep(1.4,3.0,y); return (1-t)*nn*0.6+t*(nn-0.42)*1.7; };
  rooms.forEach((r,ri)=>{
    if(!r.cave)return;
    const tintOf=t2=>(t2.k==='magma'||t2.k==='basalt'||t2.k==='ashfield')?[0.46,0.3,0.32]:[0.5+t2.col[0]*0.22,0.47+t2.col[1]*0.22,0.66+t2.col[2]*0.22];
    const th=r.theme, tint=tintOf(th), thR=th, tintR=tint;
    const gx0=r.x-2, gz0=r.y-2, ox=gx0*CELL, oz=gz0*CELL, fw=(r.w+4)*4, fh=(r.h+4)*4, NF=fw*fh;
    const sdf=pred=>{
      const open=new Uint8Array(NF), dO=new Float32Array(NF), dC=new Float32Array(NF);
      for(let j=0;j<fh;j++)for(let i=0;i<fw;i++){ const c=cellOf(ox+(i+0.5)*FR,oz+(j+0.5)*FR); const o=c>=0&&pred(c)?1:0; const k=j*fw+i; open[k]=o; dO[k]=o?1e9:0; dC[k]=o?0:1e9; }
      const a=FR, b=FR*1.4142;
      for(const arr of [dO,dC]){
        for(let j=0;j<fh;j++)for(let i=0;i<fw;i++){ const k=j*fw+i; let v=arr[k];
          if(i>0)v=Math.min(v,arr[k-1]+a); if(j>0){ v=Math.min(v,arr[k-fw]+a); if(i>0)v=Math.min(v,arr[k-fw-1]+b); if(i<fw-1)v=Math.min(v,arr[k-fw+1]+b); } arr[k]=v; }
        for(let j=fh-1;j>=0;j--)for(let i=fw-1;i>=0;i--){ const k=j*fw+i; let v=arr[k];
          if(i<fw-1)v=Math.min(v,arr[k+1]+a); if(j<fh-1){ v=Math.min(v,arr[k+fw]+a); if(i<fw-1)v=Math.min(v,arr[k+fw+1]+b); if(i>0)v=Math.min(v,arr[k+fw-1]+b); } arr[k]=v; }
      }
      const sd0=new Float32Array(NF); for(let k=0;k<NF;k++)sd0[k]=open[k]?dO[k]-FR*0.5:-(dC[k]-FR*0.5);
      const sd=new Float32Array(NF); let mx=0;
      for(let j=0;j<fh;j++)for(let i=0;i<fw;i++){ let acc=0,c=0; for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){ const ii=i+di, jj=j+dj; if(ii<0||jj<0||ii>=fw||jj>=fh)continue; acc+=sd0[jj*fw+ii]; c++; } const v=acc/c; sd[j*fw+i]=v; if(v>mx)mx=v; }
      return {sd,mx};
    };
    const samp=(sd,x,z)=>{ let fx=clamp((x-ox)/FR-0.5,0,fw-1.001), fz=clamp((z-oz)/FR-0.5,0,fh-1.001); const i=Math.floor(fx), j=Math.floor(fz), u=fx-i, v=fz-j, k=j*fw+i;
      return (sd[k]*(1-u)+sd[k+1]*u)*(1-v)+(sd[k+fw]*(1-u)+sd[k+fw+1]*u)*v; };
    // contour slicing: emits glyphs along the iso-line of vf at each height
    const slice=(sd,vf,ys,accept,style,qb)=>{
      const vals=new Float32Array(NF), h=0.12;
      const V=(x,y,z)=>vf(samp(sd,x,z),x,y,z);
      for(const [y,sp,size,layers] of ys){
        const gq=qb?qb(y):0;
        for(let j=0;j<fh;j++)for(let i=0;i<fw;i++){ const k=j*fw+i; if(qb){ const b0=sd[k]-gq; if(b0>1.4||b0<-1.4){ vals[k]=b0; continue; } } const x=ox+(i+0.5)*FR, z=oz+(j+0.5)*FR; vals[k]=vf(sd[k],x,y,z); }
        let acc=rand()*sp;
        for(let j=0;j<fh-1;j++)for(let i=0;i<fw-1;i++){
          const k=j*fw+i, va=vals[k], vb=vals[k+1], vc=vals[k+fw+1], vd=vals[k+fw];
          const pts=[], x0=ox+(i+0.5)*FR, z0=oz+(j+0.5)*FR;
          const ed=(v1,v2,x1,z1,x2,z2)=>{ if((v1>0)!==(v2>0)){ const t=v1/(v1-v2); pts.push(x1+(x2-x1)*t,z1+(z2-z1)*t); } };
          ed(va,vb,x0,z0,x0+FR,z0); ed(vb,vc,x0+FR,z0,x0+FR,z0+FR); ed(vd,vc,x0,z0+FR,x0+FR,z0+FR); ed(va,vd,x0,z0,x0,z0+FR);
          for(let s2=0;s2+3<pts.length;s2+=4){
            const ax=pts[s2], az=pts[s2+1], bx=pts[s2+2], bz=pts[s2+3], len=Math.hypot(bx-ax,bz-az);
            acc+=len;
            while(acc>=sp){
              acc-=sp; const t=rand(), px=ax+(bx-ax)*t, pz=az+(bz-az)*t;
              let gx=V(px+h,y,pz)-V(px-h,y,pz), gy=V(px,y+h,pz)-V(px,y-h,pz), gz=V(px,y,pz+h)-V(px,y,pz-h);
              const gl=Math.hypot(gx,gy,gz); if(gl<1e-5)continue; gx/=gl; gy/=gl; gz/=gl;
              const hl=Math.hypot(gx,gz)||1;
              let ref=-1;
              for(const k2 of [0.6,1.2,2.0,3.0]){ const c=cellOf(px+gx/hl*k2,pz+gz/hl*k2); if(c<0)break; if(accept(c)){ref=c;break;} if(tile[c]!==TW)break; }
              if(ref<0)continue;
              style(px,y,pz,gx,gy,gz,ref,size,layers);
            }
          }
        }
      }
    };
    const rockGlyph=(px,y,pz,nx,ny,nz,ref,size,layers,deep)=>{
      const th=r.shell?rooms[roomOf[ref]].theme:thR, tint=r.shell?tintOf(th):tintR;
      const yaw=Math.atan2(nx,nz), pitch=-Math.asin(clamp(ny,-1,1));
      for(let L=0;L<layers;L++){
        const d=L*0.27, sz=size*(1-0.14*L), dim=1-0.33*L; let v=(0.8+rand()*0.4)*dim;
        const rk=D.rock, bnd=0.5+0.5*Math.sin(y*1.35+vnoise(px*0.15,y*0.3,pz*0.15)*5);
        let c=[(rk.a[0]*(1-bnd)+rk.b[0]*bnd)*0.55+tint[0]*0.45,(rk.a[1]*(1-bnd)+rk.b[1]*bnd)*0.55+tint[1]*0.45,(rk.a[2]*(1-bnd)+rk.b[2]*bnd)*0.55+tint[2]*0.45], emis=(0.025+rand()*0.03)*dim, kind=8, g=G('#');
        const wcI=cellOf(px-nx*0.6,pz-nz*0.6), ve=wcI>=0?D.vein[wcI]:0;
        if(L===0){
          const rr=rand();
          if(ve&&rr<0.32&&ny>-0.4){ kind=7; c=VEIN_COL[ve]; emis=R(0.35,0.6); g=G(ve===1?'$':'*'); }
          else if(ny<-0.5&&rr<(r.shell?0.17:0.07)){ kind=2; c=r.shell?pick([[0.6,0.55,1.0],[0.5,0.9,1.0],[1.0,0.82,0.6],[0.7,1.0,0.8]]):[0.6,0.55,1.0]; emis=R(0.4,0.8); g=G(pick(['*','+','*'])); }
          else if(th.k==='fungal'&&y<1.6&&rr<0.09){ kind=7; c=th.col; emis=R(0.3,0.6); g=G(pick(['"',',','v'])); }
          else if((th.k==='magma'||th.k==='basalt'||th.k==='ashfield')&&y<2.8&&rr<0.09){ kind=7; c=[1.0,0.38,0.08]; emis=R(0.5,1.1); g=G(pick(['~','=','-'])); }
          else if(th.k==='chasm'&&deep&&y<-2.5&&rr<0.07){ kind=7; c=[1.0,0.42,0.12]; emis=R(0.5,1.0); g=G(pick(['~','=','-'])); }
          else if(rr<0.012){ kind=4; c=th.col; emis=R(0.4,0.9); g=G(pick(RUNESET)); }
        }
        if(deep){ const k=clamp(1+y/CH_D,0.15,1); v*=k; }
        push(px-nx*d,y-ny*d,pz-nz*d,pitch,yaw,sz,g,c[0]*v,c[1]*v,c[2]*v,emis,kind,ref,nx,ny,nz);
      }
    };
    // cavern walls and vault
    if(!r.noShell){
      const C=sdf(c=>tile[c]!==TW), top=(D.finalVault&&(D.rooms[D.roomOf[D.stairs]]===r||r.cells.includes(D.stairs)||(r.cells0&&r.cells0.includes(D.stairs))))?Math.max(th.base,13):th.base, dmx=Math.max(1.5,C.mx);
      const gD=y=>y<Y0?0:dmx*Math.pow((y-Y0)/(top-Y0),1.6);
      for(const i of (r.shell?r.cells0.filter(i=>tile[i]!==TW):r.cells.concat(r.chasm))){ const sdc=samp(C.sd,(i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL); ceil[i]=Y0+(top-Y0)*Math.pow(clamp(sdc/dmx,0,1),1/1.6); }
      const ys=[];
      if(r.shell){ for(let y=0.25;y<BASE_H;y+=0.5)ys.push([y,0.5,0.52,2]); for(let y=3.7;y<top+0.4;y+=0.8)ys.push([y,0.8,0.82,2]); }
      else { for(let y=0.21;y<BASE_H;y+=0.42)ys.push([y,0.42,0.47,3]); for(let y=3.6;y<top+0.4;y+=0.62)ys.push([y,0.62,0.68,2]); }
      const acc=r.shell?(c=>roomOf[c]>=0&&rooms[roomOf[c]].cave&&tile[c]!==TW):(c=>roomOf[c]===ri&&tile[c]!==TW);
      slice(C.sd,(sv,x,y,z)=>sv+rockN(x,y,z)-gD(y),ys,acc,(px,y,pz,nx,ny,nz,ref,size,layers)=>rockGlyph(px,y,pz,nx,ny,nz,ref,size,layers,false),gD);
    }
    // chasm throat narrowing into the dark
    if(r.chasm.length&&D.stratum.k!=='abyss'){
      const Cc=sdf(c=>tile[c]===TC||D.bridge[c]===1), dmc=Math.max(1,Cc.mx);
      const ysc=[]; for(let y=-0.3;y>-CH_D+0.3;y-=0.55)ysc.push([y,0.52,0.58,2]);
      slice(Cc.sd,(sv,x,y,z)=>{ const nn=0.65*vnoise(x*0.5,y*0.5,z*0.5)+0.35*vnoise(x*1.25,y*1.25+11,z*1.25); const t=clamp(-y/2,0,1); return sv-((1-t)*nn*0.4+t*(nn-0.5)*1.3)-dmc*0.55*Math.pow(-y/CH_D,1.3); },
        ysc,c=>(tile[c]===TC||D.bridge[c]===1)&&roomOf[c]===ri,(px,y,pz,nx,ny,nz,ref,size,layers)=>rockGlyph(px,y,pz,nx,ny,nz,ref,size,layers,true));
    }
  });

  // ---- per-cell content
  const FACES=[[1,0,-Math.PI/2],[-1,0,Math.PI/2],[0,1,Math.PI],[0,-1,0]];
  for(let cz=0;cz<MH;cz++)for(let cx=0;cx<MW;cx++){
    const i=cz*MW+cx, ti=tile[i]; if(ti!==TF&&ti!==TC)continue;
    const ri=roomOf[i], room=ri>=0?rooms[ri]:null, th=room?room.theme:(ti===TC?((rooms.find(r=>r.theme)||{}).theme||null):null), cave=!!(room&&room.cave);
    const tint=cave&&(th.k==='magma'||th.k==='basalt'||th.k==='ashfield')?[0.46,0.3,0.32]:cave?[0.5+th.col[0]*0.2,0.48+th.col[1]*0.2,0.66+th.col[2]*0.2]:(th?[0.6+th.col[0]*0.14,0.6+th.col[1]*0.14,0.78+th.col[2]*0.14]:[0.5,0.53,0.8]);
    const c0=ceil[i];
    if(!cave){
      for(let fi=0;fi<4;fi++){ const f=FACES[fi];
        const ax=cx+f[0], az=cz+f[1], j=az*MW+ax;
        const nt=(ax<0||az<0||ax>=MW||az>=MH)?TW:tile[j];
        const yaw=f[2], nX=-f[0], nZ=-f[1], pcx=(cx+0.5+f[0]*0.5)*CELL, pcz=(cz+0.5+f[1]*0.5)*CELL;
        if(nt===TW){ const vj=(ax<0||az<0||ax>=MW||az>=MH)?0:D.vaultCell[j]; faceStyle=vj?VAULTS[vj-1]:null;
          const top=vj&&c0>=5?VAULT_WALL_H:c0, vt=vj?[faceStyle.wcol[0]*0.85,faceStyle.wcol[1]*0.85,faceStyle.wcol[2]*0.85]:tint;
          let eg=D.engr.get(i*4+fi); faceVein=D.vein[j]||0;
          const tX=Math.cos(yaw), tZ=-Math.sin(yaw);
          if(eg&&eg.skip){ const sa=ARTS[eg.art], sh=sa.length*0.42, pOff=-((eg.mi%MW-cx)*tX+(((eg.mi/MW)|0)-cz)*tZ)*CELL/2*-1;
            faceSkip=(u,yc)=>Math.abs(u-pOff)<2.0&&yc>1.95-sh/2-0.35&&yc<1.95+sh/2+0.35; eg=null; }
          const art=eg&&ARTS[eg.art], wide=!!(eg&&eg.wide), sx=wide?0.5:0.27, sy=wide?0.42:0.3, gs=wide?0.48:0.33;
          const aH=art?art.length*sy:0, aY=wide?1.95:1.7, y0=aY+aH/2, cOff=wide?((eg.pi%MW-cx)*tX+(((eg.pi/MW)|0)-cz)*tZ)*CELL/2:0;
          if(art)faceSkip=(u,yc)=>Math.abs(u-cOff)<(wide?2.0:1.1)&&yc>aY-aH/2-0.35&&yc<aY+aH/2+0.35;
          face(pcx,pcz,yaw,nX,nZ,ti===TC?-CH_D:0,top,i,vt,2,true,th); faceStyle=null; faceSkip=null; faceVein=0;
          if(art){
            for(let r2=0;r2<art.length;r2++)for(let c2=0;c2<7;c2++){ const ch=art[r2][c2]; if(ch===' ')continue; const u=cOff+(c2-3)*sx, y=y0-(r2+0.5)*sy;
              push(pcx+tX*u+nX*0.05,y,pcz+tZ*u+nZ*0.05,0,yaw,gs,G(ch),1.0,0.86,0.6,0.3,7,i,nX,0,nZ); }
            const fz=gs*0.85;
            for(let c2=-1;c2<=7;c2++)for(const y of [y0+sy*0.5,y0-aH-sy*0.5]){ const u=cOff+(c2-3)*sx; push(pcx+tX*u+nX*0.04,y,pcz+tZ*u+nZ*0.04,0,yaw,fz,G(c2===-1||c2===7?'+':'-'),0.66,0.55,0.44,0.06,1,i,nX,0,nZ); }
            for(let r2=0;r2<art.length;r2++)for(const c2 of [-1,7]){ const u=cOff+(c2-3)*sx; push(pcx+tX*u+nX*0.04,y0-(r2+0.5)*sy,pcz+tZ*u+nZ*0.04,0,yaw,fz,G('|'),0.66,0.55,0.44,0.06,1,i,nX,0,nZ); } }
          continue; }
        if(ti===TC&&nt!==TC){ face(pcx,pcz,yaw,nX,nZ,-CH_D,0,i,tint,1,false,th); continue; }
        const nr=roomOf[j]; if(nr>=0&&rooms[nr].cave)continue;
        const c1=ceil[j]; if(c1<c0-0.01)face(pcx,pcz,yaw,nX,nZ,c1,c0,i,tint,1,false,th);
      }
      const per=2;
      for(let a=0;a<per;a++)for(let bb=0;bb<per;bb++){
        if(rand()>0.55)continue; const star=rand()<0.08;
        push((cx+(a+0.5)/per)*CELL+R(-0.25,0.25),c0-0.03,(cz+(bb+0.5)/per)*CELL+R(-0.25,0.25),Math.PI/2,R(0,6.28),star?0.42:0.5,
          G(star?pick(['*','+','*','x']):pick(['.','.','`','\'','-',':'])),0.55,0.5,0.95,star?R(0.45,0.85):R(0.02,0.07),2,i,0,-1,0);
      }
    }
    const deepWater=()=>{
      for(let a=0;a<2;a++)for(let bb=0;bb<2;bb++)push((cx+(a+0.5)/2)*CELL+R(-0.3,0.3),-0.7,(cz+(bb+0.5)/2)*CELL+R(-0.3,0.3),-Math.PI/2,R(0,6.28),0.5,G(pick(['.',':','~'])),0.08,0.18,0.45,0.07,2,i,0,1,0);
    };
    if(D.stratum.k==='abyss'&&ti===TF&&!D.bridge[i]){
      for(const f of FACES){ const ax=cx+f[0], az=cz+f[1]; if(ax<0||az<0||ax>=MW||az>=MH||tile[az*MW+ax]!==TC||D.bridge[az*MW+ax])continue;
        const dep=1.6+vnoise(ax*0.7,5.5,az*0.7)*4.2, pcx=(cx+0.5+f[0]*0.5)*CELL, pcz=(cz+0.5+f[1]*0.5)*CELL;
        faceStyle={wall:'%&8#:o',wcol:tint}; face(pcx,pcz,Math.atan2(f[0],f[1]),f[0],f[1],-dep,0,i,tint,1,false,th); faceStyle=null; }
    }
    if(ti===TC||D.bridge[i]===1){
      for(let a=0;a<2;a++)for(let bb=0;bb<2;bb++){ if(rand()<0.35)continue; const c=th.col;
        push((cx+(a+0.5)/2)*CELL+R(-0.3,0.3),-CH_D+0.05,(cz+(bb+0.5)/2)*CELL+R(-0.3,0.3),-Math.PI/2,R(0,6.28),0.7,G(pick(['.','*',':','~','\''])),c[0],c[1]*0.7,c[2]*0.7,R(0.12,0.3),2,i,0,1,0); }
    }
    if(ti===TC){
    } else if(D.bridge[i]){
      const dir=D.bridgeDir[i], ax=dir===0?[1,0]:[0,1], pr=dir===0?[0,1]:[1,0], x0=(cx+0.5)*CELL, z0=(cz+0.5)*CELL, rope=D.bridge[i]===1;
      const deckY=rope?0.02:0.22, wood=[0.62,0.42,0.25], stoneC=[0.6,0.6,0.76], dc2=rope?wood:stoneC;
      const nbW=(dx,dz)=>{ const x=cx+dx, z=cz+dz; if(x<0||z<0||x>=MW||z>=MH)return false; const j=z*MW+x; return tile[j]===TF&&(D.bridge[j]>0||(liquid[j]!==LQ_DEEP&&liquid[j]!==LQ_LAVA)); };
      const sideOpen=sd=>nbW(pr[0]*sd,pr[1]*sd), endOpen=e=>nbW(ax[0]*e,ax[1]*e), junction=sideOpen(-1)||sideOpen(1);
      for(let k=0;k<6;k++)for(let w=-1;w<=1;w++){ const u=(k+0.5)/6*CELL-CELL/2, px=x0+ax[0]*u+pr[0]*w*0.42, pz=z0+ax[1]*u+pr[1]*w*0.42;
        push(px,deckY,pz,-Math.PI/2,dir===0?Math.PI/2:0,0.46,G(rope?'=':pick(['#','=','#'])),dc2[0],dc2[1],dc2[2],0.04,rope?1:8,i,0,1,0); }
      if(junction)for(let k=0;k<6;k++)for(const w of [-1,1]){ if(!sideOpen(w))continue; const u=(k+0.5)/6*CELL-CELL/2;
        for(const q of [0.62,0.9]){ const px=x0+pr[0]*w*q+ax[0]*u*0.5, pz=z0+pr[1]*w*q+ax[1]*u*0.5; push(px,deckY,pz,-Math.PI/2,dir===0?0:Math.PI/2,0.46,G(rope?'=':'#'),dc2[0],dc2[1],dc2[2],0.04,rope?1:8,i,0,1,0); } }
      if(junction&&rope)for(const e of [-1,1]){ if(endOpen(e))continue; const yawE=Math.atan2(ax[0]*e,ax[1]*e);
        for(let k=0;k<8;k++){ const f=(k+0.5)/8, v=f*CELL-CELL/2, px=x0+ax[0]*e*0.8+pr[0]*v, pz=z0+ax[1]*e*0.8+pr[1]*v; push(px,0.95-0.12*Math.sin(Math.PI*f),pz,0,yawE,0.24,G('~'),0.7,0.55,0.35,0.05,1,i,ax[0]*e,0,ax[1]*e); } }
      for(const sd of [-1,1]){
        if(sideOpen(sd))continue;
        const yawP=Math.atan2(pr[0]*sd,pr[1]*sd);
        if(rope){
          for(let k=0;k<=2;k++){ const u=k/2*CELL-CELL/2, px=x0+ax[0]*u+pr[0]*sd*0.8, pz=z0+ax[1]*u+pr[1]*sd*0.8; for(let y=0.15;y<0.95;y+=0.25)pushX(px,y,pz,0.24,G('|'),wood,0.04,1,i); }
          for(let k=0;k<8;k++){ const f=(k+0.5)/8, u=f*CELL-CELL/2, px=x0+ax[0]*u+pr[0]*sd*0.8, pz=z0+ax[1]*u+pr[1]*sd*0.8; push(px,0.95-0.12*Math.sin(Math.PI*f),pz,0,yawP,0.24,G('~'),0.7,0.55,0.35,0.05,1,i,pr[0]*sd,0,pr[1]*sd); }
        } else {
          for(let k=0;k<5;k++){ const u=(k+0.5)/5*CELL-CELL/2, px=x0+ax[0]*u+pr[0]*sd*0.85, pz=z0+ax[1]*u+pr[1]*sd*0.85; push(px,0.12,pz,0,yawP,0.3,G('='),stoneC[0],stoneC[1],stoneC[2],0.04,8,i,pr[0]*sd,0,pr[1]*sd); }
        }
      }
      if(!rope)deepWater();
    } else if(liquid[i]===LQ_DEEP){
      deepWater();
    } else if(liquid[i]===LQ_BOG){
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=0.7+rand()*0.6;
        push((cx+(a+0.5)/3)*CELL+R(-0.12,0.12),0.04,(cz+(bb+0.5)/3)*CELL+R(-0.12,0.12),-Math.PI/2,R(0,6.28),0.52,G(pick(['~','~',',','.','"'])),0.32*v,0.36*v,0.14*v,0.035,3,i,0,1,0); }
      if(rand()<0.3)for(let k=0;k<RI(2,3);k++){ const sz=R(0.4,0.65); push((cx+R(0.1,0.9))*CELL,sz*0.5,(cz+R(0.1,0.9))*CELL,0,R(0,6.28),sz,G(pick(['|','/','\\','Y'])),0.45,0.38,0.22,0.03,5,i,null,0,0); }
    } else if(liquid[i]===LQ_LAVA){
      for(let a=0;a<5;a++)for(let bb=0;bb<5;bb++){ const crust=rand()<0.1;
        push((cx+(a+0.5)/5)*CELL+R(-0.06,0.06),0.1,(cz+(bb+0.5)/5)*CELL+R(-0.06,0.06),-Math.PI/2,R(0,6.28),crust?0.44:0.56,G(crust?pick(['#','%','o']):'~'),1.0,0.32,0.06,1.0,10,i,0,1,0);
        if(crust)EM[(n-1)*4+3]=1; }
    } else if(surface[i]===SF_OBSIDIAN){
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const crack=rand()<0.28;
        push((cx+(a+0.5)/3)*CELL+R(-0.15,0.15),0.03,(cz+(bb+0.5)/3)*CELL+R(-0.15,0.15),-Math.PI/2,R(0,6.28),0.5,G(crack?pick(['~','-','=']):pick(['#','%','=',':'])),
          crack?1.0:0.3,crack?0.34:0.22,crack?0.08:0.26,crack?R(0.35,0.8):0.03,crack?7:9,i,0,1,0); }
    } else if(liquid[i]===LQ_WATER){
      const lake=th&&(th.k==='lake'||D.stratum.k==='cavern'), wc=lake?[0.22,0.72,1.0]:[0.28,0.62,1.0];
      const wn=D.stratum.flood?3:4, ws=D.stratum.flood?0.6:0.5;
      // the surface itself is drawn by the water plane
    } else if(surface[i]===SF_ICE){
      const tn=D.thin[i];
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=(tn?0.6:0.8)+rand()*0.4; push((cx+(a+0.5)/3)*CELL+R(-0.08,0.08),0.04,(cz+(bb+0.5)/3)*CELL+R(-0.08,0.08),-Math.PI/2,Math.floor(rand()*2)*Math.PI/2,0.56,G(tn?pick(['/','\\','-','=']):pick(['=','#','-','='])),0.62*v,0.85*v,1.0*v,(tn?0.08:0.12)+rand()*0.08,tn?1:11,i,0,1,0); }
    } else if(cave){
      // uneven rubble floor, shaded by the same density ramp
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=0.7+rand()*0.5;
        push((cx+(a+0.5)/3)*CELL+R(-0.18,0.18),0.02+rand()*0.05,(cz+(bb+0.5)/3)*CELL+R(-0.18,0.18),-Math.PI/2+R(-0.25,0.25),R(0,6.28),0.52,G('.'),tint[0]*0.6*v,tint[1]*0.6*v,tint[2]*0.6*v,0.03,9,i,0,1,0); }
      if(D.dfield[i]===1&&rand()<0.35){ const x0=(cx+R(0.2,0.8))*CELL, z0=(cz+R(0.2,0.8))*CELL; for(let k=0;k<RI(3,6);k++)pushX(x0+R(-0.3,0.3),0.12+k*0.12,z0+R(-0.3,0.3),0.34-k*0.03,G(pick(['o','0','O','.'])),[tint[0]*0.7,tint[1]*0.7,tint[2]*0.7],0.03,8,i); }
    } else if(surface[i]===SF_RUBBLE&&!liquid[i]){
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=0.7+rand()*0.5; push((cx+(a+0.5)/3)*CELL+R(-0.15,0.15),0.03,(cz+(bb+0.5)/3)*CELL+R(-0.15,0.15),-Math.PI/2,R(0,6.28),0.5,G(pick([':','.',',','%'])),tint[0]*0.55*v,tint[1]*0.5*v,tint[2]*0.5*v,0.03,9,i,0,1,0); }
      for(let k=0;k<RI(2,4);k++){ const x0=(cx+R(0.2,0.8))*CELL, z0=(cz+R(0.2,0.8))*CELL; for(let h2=0;h2<RI(1,3);h2++)pushX(x0+R(-0.15,0.15),0.14+h2*0.2,z0+R(-0.15,0.15),0.36-h2*0.06,G(pick(['#','%','o','='])),[tint[0]*0.75,tint[1]*0.7,tint[2]*0.72],0.03,8,i); }
    } else if(D.decoCell.get(i)&&D.decoCell.get(i).k==='carpet'){
    } else if(D.vaultCell[i]&&!cave){
      // mosaic floor: a fixed pattern marks vault ground as built, not natural
      const vs=VAULTS[D.vaultCell[i]-1];
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const gx=cx*3+a, gz=cz*3+bb, ch=(gx+gz)%2?'.':(gx%3===1&&gz%3===1?'*':'+');
        push((cx+(a+0.5)/3)*CELL,0.02,(cz+(bb+0.5)/3)*CELL,-Math.PI/2,0,0.5,G(ch),vs.wcol[0]*0.5,vs.wcol[1]*0.5,vs.wcol[2]*0.5,ch==='*'?0.14:0.05,1,i,0,1,0); }
    } else {
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){
        const r0=rand(), ch=r0<0.62?'.':r0<0.72?',':r0<0.8?'`':r0<0.87?'\'':r0<0.94?':':'-', v=0.7+rand()*0.5;
        push((cx+(a+0.5)/3)*CELL+R(-0.12,0.12),0.02,(cz+(bb+0.5)/3)*CELL+R(-0.12,0.12),-Math.PI/2,Math.floor(rand()*4)*Math.PI/2,0.5,G(ch),0.34*v,0.35*v,0.56*v,0.025+rand()*0.035,1,i,0,1,0);
      }
    }
    if(surface[i]===SF_DEAD){
      for(let j=0;j<RI(3,5);j++){ const sz=R(0.3,0.6);
        push((cx+R(0.1,0.9))*CELL,sz*0.5,(cz+R(0.1,0.9))*CELL,0,R(0,Math.PI*2),sz,G(pick(['|','/','\\',',','"','Y'])),0.55,0.44,0.26,0.03,5,i,null,0,0); }
    }
    if(surface[i]===SF_FOLIAGE||surface[i]===SF_FUNGFOR){
      const fung=surface[i]===SF_FUNGFOR, gc=fung?pick([[0.45,0.95,1.0],[0.7,0.55,1.0],[0.5,1.0,0.7]]):null;
      for(let k=0;k<4;k++){ const x0=(cx+0.15+rand()*0.7)*CELL, z0=(cz+0.15+rand()*0.7)*CELL, hgt=fung?R(1.5,2.4):R(1.3,2.0);
        for(let y=0.2;y<hgt;y+=0.42){ const top=y+0.42>=hgt; const ch=fung?(top?pick(['^','n','*']):'|'):(top?pick(['"','Y','*']):pick(['|','(',')','/','\\']));
          const c=fung?(top?gc:[0.55,0.6,0.62]):(top?[0.55,0.95,0.45]:[0.35,0.7,0.3]); pushX(x0,y,z0,top?0.32:0.28,G(ch),c,fung?(top?0.45:0.05):0.03,13,i); } }
    }
    if(D.glyph[i]){ for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const ch=(a+bb)%2?'o':(a===1&&bb===1?'*':'+'); push((cx+(a+0.5)/3)*CELL,0.05,(cz+(bb+0.5)/3)*CELL,-Math.PI/2,0,0.5,G(ch),1.0,0.9,0.6,0.32,7,i,0,1,0); } }
    if(surface[i]===SF_BRIM){ for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=0.8+rand()*0.4; push((cx+(a+0.5)/3)*CELL+R(-0.1,0.1),0.04,(cz+(bb+0.5)/3)*CELL+R(-0.1,0.1),-Math.PI/2,R(0,6.28),0.5,G(pick(['*','%',':','*'])),1.0*v,0.82*v,0.3*v,0.1,1,i,0,1,0); } }
    if(surface[i]===SF_MUD){ for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=0.7+rand()*0.4; push((cx+(a+0.5)/3)*CELL+R(-0.1,0.1),0.03,(cz+(bb+0.5)/3)*CELL+R(-0.1,0.1),-Math.PI/2,0,0.55,G(pick(['~','=','.','~'])),0.5*v,0.36*v,0.2*v,0.02,1,i,0,1,0); } }
    if(surface[i]===SF_HAY){ for(let k=0;k<7;k++){ const x0=(cx+0.1+rand()*0.8)*CELL, z0=(cz+0.1+rand()*0.8)*CELL; pushX(x0,0.18,z0,0.3,G(pick(['"','/','\\',','])),[0.95,0.8,0.4],0.04,5,i); } }
    if(surface[i]===SF_GRASS||surface[i]===SF_LUMEN){
      const glow=surface[i]===SF_LUMEN, c=glow?((th&&(th.k==='emerald'||th.k==='fungal'||th.k==='lake'))?th.col:[0.4,0.95,0.85]):[0.35,0.85,0.5], k=RI(3,6);
      for(let j=0;j<k;j++){ const sz=R(0.28,0.55);
        push((cx+R(0.1,0.9))*CELL,sz*0.5,(cz+R(0.1,0.9))*CELL,0,R(0,Math.PI*2),sz,G(pick(['"','"',',','\'',';','v','Y'])),c[0],c[1],c[2],glow?R(0.2,0.5):R(0.03,0.08),5,i,null,0,0); }
    }
    if(cave&&th.k!=='cathedral'&&c0>4.5&&rand()<0.08){
      const x0=(cx+R(0.25,0.75))*CELL, z0=(cz+R(0.25,0.75))*CELL, len=R(1.0,Math.min(4.2,c0-2.4)), rock=[tint[0]*0.9,tint[1]*0.9,tint[2]*0.9];
      for(let y=c0+0.2;y>c0-len;y-=0.3){ const f=(c0-y)/len; pushX(x0,y,z0,0.44*(1-f*0.5),G('|'),rock,0.03,8,i); }
      pushX(x0,c0-len-0.1,z0,0.24,G('\''),th.col,0.7,7,i);
    }
    if(cave&&ti===TF&&!liquid[i]&&rand()<0.03){
      const x0=(cx+R(0.25,0.75))*CELL, z0=(cz+R(0.25,0.75))*CELL, len=R(0.6,2.2), rock=[tint[0]*0.85,tint[1]*0.85,tint[2]*0.85];
      for(let y=0.15;y<len;y+=0.28){ const f=y/len; pushX(x0,y,z0,0.44*(1-f*0.55),G('^'),rock,0.03,8,i); }
    }
  }
  // crystal formations: leaning prisms of glyphs that glow and refract
  for(let i=0;i<NCELL;i++){
    if(tile[i]!==TX)continue;
    const cx=i%MW, cz=(i/MW)|0, ri=roomOf[i], th=ri>=0?rooms[ri].theme:null;
    const col=D.xtalCol.get(i)||[0.6,0.85,1.0], top=Math.max(1.3,Math.min(ceil[i]-0.8,th&&th.k==='crystal'?6:3.2));
    for(let a=0;a<2;a++)for(let bb=0;bb<2;bb++)push((cx+(a+0.5)/2)*CELL,0.03,(cz+(bb+0.5)/2)*CELL,-Math.PI/2,R(0,6.28),0.5,G(pick(['.',':','*'])),col[0]*0.5,col[1]*0.5,col[2]*0.5,0.15,11,i,0,1,0);
    for(let sN=RI(3,5),sh=0;sh<sN;sh++){
      const bx=(cx+R(0.15,0.85))*CELL, bz=(cz+R(0.15,0.85))*CELL, H=R(1.0,top), lx=R(-0.4,0.4), lz=R(-0.4,0.4);
      for(let y=0.12;y<H;y+=0.26){ const f=y/H, tip=y+0.26>=H; pushX(bx+lx*f,y,bz+lz*f,tip?0.3:0.38*(1-f*0.4),G(tip?'^':pick(['|','|','!',':','I'])),col,tip?R(0.9,1.4):R(0.25,0.55),11,i); }
      pushX(bx-0.14,0.15,bz,0.3,G('/'),col,0.3,11,i); pushX(bx+0.14,0.15,bz,0.3,G('\\'),col,0.3,11,i);
    }
  }
  // giant mushrooms in the fungal forest
  rooms.forEach(r=>{
    for(const i of (r.mush||[])){
      const gi=!!r.giant, S=gi?R(1.8,2.6):1;
      const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL, H=gi?R(4.5,Math.max(5,Math.min(11,ceil[i]-1.5))):R(2.2,Math.max(2.4,Math.min(5,ceil[i]-1.2))), c=gi?pick([r.theme.col,[0.45,0.8,1.0],[0.9,0.6,1.0]]):pick([r.theme.col,[0.3,0.9,1.0],[0.7,1.0,0.35]]);
      const stems=gi?[[0,0],[0.22,0],[-0.11,0.19],[-0.11,-0.19]]:[[0,0]];
      for(const [sx,sz] of stems)for(let y=0.2;y<H;y+=0.3)pushX(x0+sx,y,z0+sz,gi?0.42:0.36,G(pick(['|','I','|','!'])),[0.62,0.78,0.72],0.05,0,i);
      const ring=(rad,y,n,set,em)=>{ for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+y, nx=Math.cos(a), nz=Math.sin(a); push(x0+nx*rad,y,z0+nz*rad,0,Math.atan2(nx,nz),0.42*(gi?1.3:1),G(pick(set)),c[0],c[1],c[2],R(em[0],em[1]),7,i,nx,0,nz); } };
      ring(0.95*S,H-0.05,Math.round(14*S),['^','n','~','*','n'],[0.45,0.8]);
      ring(0.6*S,H+0.25*S,Math.round(9*S),['^','n','*'],[0.5,0.9]);
      if(gi)ring(0.3*S,H+0.45*S,7,['^','*'],[0.6,1.0]);
      for(let k=0;k<Math.round(10*S*S);k++){ const a=k*2.399, rr=Math.sqrt((k+0.5)/(10*S*S))*0.9*S;
        push(x0+Math.cos(a)*rr,H-0.12,z0+Math.sin(a)*rr,Math.PI/2,R(0,6.28),0.32*(gi?1.2:1),G(pick(['.','\'','|',':'])),c[0],c[1],c[2],R(0.3,0.6),7,i,0,-1,0); }
    }
  });
  // ---- Brogue-style "machines": small set pieces that tell a story
  rooms.forEach(r=>{
    const md=r.mdata; if(!md)return;
    const cxy=i=>[(i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL];
    const stone=[0.62,0.6,0.78];
    if(md.type==='camp'){
      const [fx,fz]=cxy(md.fire);
      for(let k=0;k<9;k++){ const a=k/9*Math.PI*2; pushX(fx+Math.cos(a)*0.45,0.12,fz+Math.sin(a)*0.45,0.26,G(pick(['o','0','o'])),stone,0.03,8,md.fire); }
      for(let k=0;k<6;k++)push(fx+R(-0.3,0.3),0.03,fz+R(-0.3,0.3),-Math.PI/2,R(0,6.28),0.3,G(pick(['.',',','`'])),0.5,0.32,0.2,0.15,7,md.fire,0,1,0);
      for(const b of md.beds){ const [bx,bz]=cxy(b), yaw=rand()<0.5?0:Math.PI/2, ca=Math.cos(yaw), sa=Math.sin(yaw);
        for(let u=0;u<4;u++)for(let v=0;v<2;v++){ const lx=(u-1.5)*0.32, lz=(v-0.5)*0.32; push(bx+lx*ca+lz*sa,0.05,bz-lx*sa+lz*ca,-Math.PI/2,yaw,0.36,G(u===0?'0':pick(['=','~','='])),0.55,0.28,0.24,0.03,1,b,0,1,0); } }
      for(const b of md.bones){ const [bx,bz]=cxy(b); for(let k=0;k<5;k++)push(bx+R(-0.6,0.6),0.04,bz+R(-0.6,0.6),-Math.PI/2,R(0,6.28),0.34,G(pick(['%',',','\'','%','-'])),0.85,0.82,0.7,0.05,1,b,0,1,0);
        pushX(bx+R(-0.3,0.3),0.16,bz+R(-0.3,0.3),0.3,G('0'),[0.85,0.82,0.7],0.06,1,b); }
    } else if(md.type==='altar'){
      const [ax,az]=cxy(md.altar);
      for(let k=0;k<20;k++){ const a=k/20*Math.PI*2; push(ax+Math.cos(a)*1.5,0.03,az+Math.sin(a)*1.5,-Math.PI/2,-a,0.36,G(pick(RUNESET)),1.0,0.8,0.4,0.6,4,md.altar,0,1,0); }
      const W2=0.6, D2=0.38, H2=0.9;
      for(const [nx,nz,hw] of [[0,1,W2],[0,-1,W2],[1,0,D2],[-1,0,D2]]){
        const yaw=Math.atan2(nx,nz), tX=Math.cos(yaw), tZ=-Math.sin(yaw), px=ax+nx*(nz?D2:W2), pz=az+nz*(nz?D2:W2);
        const cols=Math.max(2,Math.round(hw*2/0.3));
        for(let row=0;row<3;row++)for(let col=0;col<cols;col++){ const u=(col+0.5)*(hw*2/cols)-hw; push(px+tX*u,0.15+row*0.3,pz+tZ*u,0,yaw,0.32,G(row===2?'=':'#'),stone[0],stone[1],stone[2],0.04,8,md.altar,nx,0,nz); }
      }
      for(let u=0;u<4;u++)for(let v=0;v<3;v++)push(ax+(u-1.5)*0.3,H2,az+(v-1)*0.24,-Math.PI/2,0,0.3,G('='),stone[0],stone[1],stone[2],0.05,8,md.altar,0,1,0);
    } else if(md.type==='library'){
      for(const sh of md.shelves){
        const [sx,sz]=cxy(sh.i), nx=-sh.dx, nz=-sh.dz, yaw=Math.atan2(nx,nz), tX=Math.cos(yaw), tZ=-Math.sin(yaw);
        const bx=sx+sh.dx*0.62, bz=sz+sh.dz*0.62;
        for(let row=0;row<8;row++)for(let col=0;col<6;col++){
          const u=(col+0.5)*(1.9/6)-0.95, y=0.18+row*0.34, shelf=row%3===0;
          let ch=shelf?'=':pick(['[',']','|','I','!','[',']']), c=shelf?[0.55,0.38,0.25]:pick([[0.75,0.3,0.25],[0.3,0.45,0.8],[0.35,0.65,0.4],[0.7,0.55,0.3],[0.55,0.35,0.65]]), em=0.035, kind=1;
          if(!shelf&&rand()<0.05){ ch='?'; c=[0.75,0.6,1.0]; em=0.7; kind=7; }
          push(bx+tX*u,y,bz+tZ*u,0,yaw,0.34,G(ch),c[0],c[1],c[2],em,kind,sh.i,nx,0,nz);
        }
      }
      for(const i of md.pages){ const [px,pz]=cxy(i); push(px+R(-0.7,0.7),0.03,pz+R(-0.7,0.7),-Math.PI/2,R(0,6.28),0.3,G(pick(['?','=','~'])),0.8,0.75,0.95,0.12,1,i,0,1,0); }
    } else if(md.type==='crypt'){
      for(const tb of md.tombs){
        const [tx,tz]=cxy(tb.i), yaw=tb.yaw, tX=Math.cos(yaw), tZ=-Math.sin(yaw), nx=Math.sin(yaw), nz=Math.cos(yaw);
        const rows=[['.','-','.'],['|','R','|'],['|','I','|'],['|','P','|']];
        rows.forEach((rw,ri2)=>rw.forEach((ch,ci)=>{ const u=(ci-1)*0.28, y=1.25-ri2*0.3; push(tx+tX*u,y,tz+tZ*u,0,yaw,0.34,G(ch),0.7,0.74,0.95,ci===1&&ri2>0?0.32:0.09,ci===1&&ri2>0?7:1,tb.i,nx,0,nz); }));
        for(let k=0;k<6;k++)push(tx+nx*R(0.3,0.8)+tX*R(-0.3,0.3),0.04,tz+nz*R(0.3,0.8)+tZ*R(-0.3,0.3),-Math.PI/2,R(0,6.28),0.3,G(pick(['~','.',',','o'])),0.45,0.48,0.62,0.04,1,tb.i,0,1,0);
      }
    } else if(md.type==='statues'){
      const form=buildForm({ch:'&',form:'humanoid'});
      for(const si of md.statues){
        const [sx,sz]=cxy(si), sc=1.35;
        for(let k=0;k<14;k++){ const a=k/14*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); push(sx+nx*0.5,0.12,sz+nz*0.5,0,Math.atan2(nx,nz),0.3,G('='),stone[0],stone[1],stone[2],0.04,8,si,nx,0,nz); push(sx+nx*0.45,0.36,sz+nz*0.45,0,Math.atan2(nx,nz),0.3,G('#'),stone[0],stone[1],stone[2],0.04,8,si,nx,0,nz); }
        for(const pnt of form){ if(pnt.part==='core')continue; pushX(sx+pnt.x*sc,0.45+pnt.y*sc,sz+pnt.z*sc,pnt.s*sc*1.25,G(pick(['&','#','%','&'])),stone,0.07,8,si); }
        pushX(sx,0.45+1.52*sc,sz,0.5,G('&'),[0.7,0.68,0.9],0.05,8,si);
      }
    }
  });
  // roofs over houses in tall halls (the town): a ceiling inside, a roof outside
  for(let i=0;i<NCELL;i++){
    if(!D.vaultCell[i]||tile[i]===TW||ceil[i]<5)continue; const vs=VAULTS[D.vaultCell[i]-1]; if(!vs.roof)continue;
    const cx=i%MW, cz=(i/MW)|0;
    for(let a=0;a<2;a++)for(let bb=0;bb<2;bb++){ const x=(cx+(a+0.5)/2)*CELL, z=(cz+(bb+0.5)/2)*CELL;
      push(x,VAULT_WALL_H-0.02,z,Math.PI/2,0,0.6,G(pick(['.',':','='])),0.5,0.45,0.42,0.03,8,i,0,-1,0);
      push(x,VAULT_WALL_H+0.04,z,-Math.PI/2,(a+bb)%2?0:Math.PI/2,0.62,G(pick(['=','#','='])),vs.wcol[0]*0.6,vs.wcol[1]*0.55,vs.wcol[2]*0.5,0.04,8,i,0,1,0); }
  }
  // fortress furniture: stone tables and anvils
  rooms.forEach(r=>{
    for(const i of (r.tables||[])){ const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL, st=[0.72,0.6,0.48];
      for(const [lx,lz] of [[-0.6,-0.6],[0.6,-0.6],[-0.6,0.6],[0.6,0.6]])for(let y=0.15;y<0.8;y+=0.25)pushX(x0+lx,y,z0+lz,0.24,G('|'),st,0.03,8,i);
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++)push(x0+(a-1)*0.5,0.86,z0+(bb-1)*0.5,-Math.PI/2,0,0.52,G(a===1&&bb===1?'o':'='),st[0],st[1],st[2],0.04,8,i,0,1,0); }
    for(const i of (r.anvils||[])){ const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL, ir=[0.55,0.55,0.62];
      pushX(x0,0.2,z0,0.4,G('#'),ir,0.03,8,i); pushX(x0,0.48,z0,0.34,G('I'),ir,0.03,8,i); pushX(x0,0.74,z0,0.5,G('T'),ir,0.05,8,i); }
  });
  // caps on low vault walls standing in tall halls, and vault carpets
  for(let i=0;i<NCELL;i++){
    if(tile[i]!==TW||!D.vaultCell[i])continue;
    let ref=-1, hi=0; for(const d of D4){ const j=i+d[0]+d[1]*MW; if(j>=0&&j<NCELL&&tile[j]!==TW){ if(ceil[j]>hi){hi=ceil[j];ref=j;} } }
    if(ref<0||hi<5)continue;
    const vs=VAULTS[D.vaultCell[i]-1], cx=i%MW, cz=(i/MW)|0;
    for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++)push((cx+(a+0.5)/3)*CELL,VAULT_WALL_H+0.02,(cz+(bb+0.5)/3)*CELL,-Math.PI/2,0,0.6,G(vs.wall[(a+bb)%vs.wall.length]),vs.wcol[0]*0.7,vs.wcol[1]*0.7,vs.wcol[2]*0.7,0.06,8,ref,0,1,0);
  }
  rooms.forEach(r=>{
    const set=new Set(r.vcarpet||[]);
    for(const i of (r.vcarpet||[])){ const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL;
      for(let a=0;a<4;a++)for(let bb=0;bb<4;bb++){ const lx=(a+0.5)/4*CELL-CELL/2, lz=(bb+0.5)/4*CELL-CELL/2;
        const ex=(a===0&&!set.has(i-1))||(a===3&&!set.has(i+1)), ez=(bb===0&&!set.has(i-MW))||(bb===3&&!set.has(i+MW)), border=ex||ez;
        const ch=border?'=':((a+bb)%2?'+':'*'), c=border?[1.0,0.78,0.35]:((a+bb)%2?[0.85,0.22,0.3]:[0.55,0.3,0.85]);
        push(x0+lx,0.03,z0+lz,-Math.PI/2,border&&ez?0:Math.PI/2,0.48,G(ch),c[0],c[1],c[2],0.06,1,i,0,1,0); } }
  });
  // statues and altars drawn into vaults
  rooms.forEach(r=>{
    const stone=[0.62,0.6,0.78];
    for(const si of (r.vstat||[])){ const sx=(si%MW+0.5)*CELL, sz=(((si/MW)|0)+0.5)*CELL, sc=1.35;
      for(let k=0;k<14;k++){ const a=k/14*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); push(sx+nx*0.5,0.12,sz+nz*0.5,0,Math.atan2(nx,nz),0.3,G('='),stone[0],stone[1],stone[2],0.04,8,si,nx,0,nz); push(sx+nx*0.45,0.36,sz+nz*0.45,0,Math.atan2(nx,nz),0.3,G('#'),stone[0],stone[1],stone[2],0.04,8,si,nx,0,nz); }
      for(const pnt of buildForm({ch:'&',form:'humanoid'})){ if(pnt.part==='core')continue; pushX(sx+pnt.x*sc,0.45+pnt.y*sc,sz+pnt.z*sc,pnt.s*sc*1.25,G(pick(['&','#','%','&'])),stone,0.07,8,si); }
      pushX(sx,0.45+1.52*sc,sz,0.5,G('&'),[0.7,0.68,0.9],0.06,8,si); }
    for(const ai of (r.valtar||[])){ const ax=(ai%MW+0.5)*CELL, az=(((ai/MW)|0)+0.5)*CELL;
      for(let y=0.15;y<0.95;y+=0.28)for(let k=0;k<8;k++){ const a=k/8*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); push(ax+nx*0.5,y,az+nz*0.5,0,Math.atan2(nx,nz),0.32,G(y>0.7?'=':'#'),stone[0],stone[1],stone[2],0.05,8,ai,nx,0,nz); }
      for(let u=0;u<3;u++)for(let w=0;w<3;w++)push(ax+(u-1)*0.3,0.95,az+(w-1)*0.3,-Math.PI/2,0,0.3,G('='),stone[0],stone[1],stone[2],0.05,8,ai,0,1,0); }
  });
  // the beast's lair: bones and old remains scattered around
  rooms.forEach(r=>{ if(!r.lair)return; for(const i of r.cells.filter(()=>rand()<0.12)){ if(liquid[i])continue; const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL;
    for(let k=0;k<4;k++)push(x0+R(-0.7,0.7),0.04,z0+R(-0.7,0.7),-Math.PI/2,R(0,6.28),0.36,G(pick(['%',',','\'','-','%'])),0.85,0.8,0.68,0.05,1,i,0,1,0);
    if(rand()<0.4)pushX(x0+R(-0.4,0.4),0.18,z0+R(-0.4,0.4),0.34,G('0'),[0.85,0.8,0.68],0.05,1,i); } });
  // colossi in ruined plazas
  rooms.forEach(r=>{
    if(r.colossus===undefined)return;
    const c=r.colossus, sx=(c%MW+0.5)*CELL, sz=(((c/MW)|0)+0.5)*CELL, sc=Math.min(3.4,(ceil[c]-1.4)/2.1), stone=[0.66,0.64,0.8], col=r.theme.col;
    for(const [rad,y,ch] of [[1.5,0.15,'#'],[1.35,0.45,'='],[1.2,0.75,'#']])for(let k=0;k<22;k++){ const a=k/22*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); push(sx+nx*rad,y,sz+nz*rad,0,Math.atan2(nx,nz),0.36,G(ch),stone[0],stone[1],stone[2],0.05,8,c,nx,0,nz); }
    for(const pnt of buildForm({ch:'&',form:'humanoid'})){ if(pnt.part==='core')continue; pushX(sx+pnt.x*sc,0.9+pnt.y*sc,sz+pnt.z*sc,pnt.s*sc*1.25,G(pick(['&','#','%','&','='])),stone,0.05,8,c); }
    for(const ex of [-0.07,0.07])push(sx+ex*sc,0.9+1.56*sc,sz+0.17*sc,0,0,0.22*sc,G('*'),col[0],col[1],col[2],1.1,7,c,0,0,1);
  });
  // remnant carpets, dismal rooms, idyll ferns, bloodwort stalks, steam vents
  rooms.forEach(r=>{
    const md=r.mdata; if(!md)return;
    const cxy=i=>[(i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL];
    if(md.type==='remnant'){
      const set=new Set(md.carpet);
      for(const i of md.carpet){ const [x0,z0]=cxy(i);
        for(let a=0;a<4;a++)for(let bb=0;bb<4;bb++){ const lx=(a+0.5)/4*CELL-CELL/2, lz=(bb+0.5)/4*CELL-CELL/2;
          const edgeX=(a===0&&!set.has(i-1))||(a===3&&!set.has(i+1)), edgeZ=(bb===0&&!set.has(i-MW))||(bb===3&&!set.has(i+MW));
          const border=edgeX||edgeZ, ch=border?'=':((a+bb)%2?'+':'*'), c=border?[1.0,0.78,0.35]:((a+bb)%2?[0.85,0.22,0.3]:[0.55,0.3,0.85]);
          push(x0+lx,0.03,z0+lz,-Math.PI/2,border&&edgeZ?0:Math.PI/2,0.48,G(ch),c[0],c[1],c[2],0.06,1,i,0,1,0); } }
      const form=buildForm({ch:'&',form:'humanoid'}), stone=[0.62,0.6,0.78];
      for(const si of md.inert){ const [sx,sz]=cxy(si); for(const pnt of form){ if(pnt.part==='core')continue; pushX(sx+pnt.x*1.3,0.3+pnt.y*1.3,sz+pnt.z*1.3,pnt.s*1.6,G(pick(['&','#','%'])),stone,0.06,8,si); } }
    } else if(md.type==='dismal'){
      for(const i of md.blood){ const [x0,z0]=cxy(i); for(let k=0;k<7;k++)push(x0+R(-0.6,0.6),0.035,z0+R(-0.6,0.6),-Math.PI/2,R(0,6.28),R(0.35,0.6),G(pick(['~',',','.','~'])),0.55,0.05,0.07,0.04,1,i,0,1,0); }
      for(const i of md.bones2){ const [x0,z0]=cxy(i); for(let k=0;k<5;k++)push(x0+R(-0.6,0.6),0.04,z0+R(-0.6,0.6),-Math.PI/2,R(0,6.28),0.34,G(pick(['%',',','\'','-'])),0.85,0.82,0.7,0.05,1,i,0,1,0); pushX(x0+R(-0.3,0.3),0.16,z0+R(-0.3,0.3),0.3,G('0'),[0.85,0.82,0.7],0.06,1,i); }
      for(const i of md.char){ const [x0,z0]=cxy(i); for(let k=0;k<3;k++)pushX(x0+R(-0.5,0.5),0.14+k*0.1,z0+R(-0.5,0.5),0.3,G(pick(['o','0','.'])),[0.3,0.28,0.3],0.02,8,i); }
    } else if(md.type==='bloodwort'){
      const [x0,z0]=cxy(md.plant);
      for(let y=0.15;y<1.4;y+=0.25)pushX(x0+Math.sin(y*3)*0.06,y,z0,0.3,G('|'),[0.35,0.6,0.3],0.05,1,md.plant);
      for(let k=0;k<6;k++){ const a=k/6*Math.PI*2, h=0.4+k*0.14; pushX(x0+Math.cos(a)*0.25,h,z0+Math.sin(a)*0.25,0.28,G(pick(['"','v','~'])),[0.3,0.65,0.3],0.06,5,md.plant); }
    }
  });
  // collapsing floors: cracks now, a hidden shaft (kind 12) revealed when the floor gives way
  rooms.forEach(r=>{
    const md=r.mdata; if(!md||md.type!=='collapse')return;
    const pit=new Set(md.pit);
    for(const i of md.pit){
      const cx=i%MW, cz=(i/MW)|0;
      for(let k=0;k<4;k++)push((cx+R(0.15,0.85))*CELL,0.03,(cz+R(0.15,0.85))*CELL,-Math.PI/2,R(0,6.28),0.42,G(pick(['/','\\','x','-'])),1.0,0.55,0.25,R(0.12,0.3),1,i,0,1,0);
      for(const f of [[1,0,-Math.PI/2],[-1,0,Math.PI/2],[0,1,Math.PI],[0,-1,0]]){
        const j=(cz+f[1])*MW+cx+f[0]; if(pit.has(j))continue;
        const yaw=f[2], nX=-f[0], nZ=-f[1], tX=Math.cos(yaw), tZ=-Math.sin(yaw), pcx=(cx+0.5+f[0]*0.5)*CELL, pcz=(cz+0.5+f[1]*0.5)*CELL;
        for(let y=-0.2;y>-6.2;y-=0.42)for(let col=0;col<5;col++){ const u=(col+0.5)*0.4-CELL/2, k2=clamp(1+y/7,0.2,1);
          push(pcx+tX*u,y,pcz+tZ*u,0,yaw,0.44,G(pick(['#','%','&','8',':'])),0.55*k2,0.5*k2,0.62*k2,0.03,12,i,nX,0,nZ); }
      }
      for(let a=0;a<2;a++)for(let bb=0;bb<2;bb++)push((cx+(a+0.5)/2)*CELL,-6.2,(cz+(bb+0.5)/2)*CELL,-Math.PI/2,R(0,6.28),0.7,G(pick(['*','.','~'])),1.0,0.55,0.25,0.9,12,i,0,1,0);
    }
  });
  // pillars (ordinary rooms)
  for(let i=0;i<NCELL;i++){
    if(tile[i]!==TP)continue;
    const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL, SEG=12, rr=0.38, ph=(D.vaultCell[i]&&ceil[i]>=5)?4.4:ceil[i];
    for(let k=0;k<SEG;k++){
      const a0=k/SEG*Math.PI*2, a1=(k+1)/SEG*Math.PI*2;
      const ax=x0+Math.cos(a0)*rr, az=z0+Math.sin(a0)*rr, bx=x0+Math.cos(a1)*rr, bz=z0+Math.sin(a1)*rr;
      occ.push(ax,0,az,bx,0,bz,bx,ph,bz, ax,0,az,bx,ph,bz,ax,ph,az);
    }
    const ys2=[]; for(let y=0.22;y<Math.min(ph,BASE_H);y+=0.31)ys2.push([y,11]); for(let y=BASE_H+0.1;y<ph-0.2;y+=0.5)ys2.push([y,8]);
    for(let row=0;row<ys2.length;row++){ const [y,nk]=ys2[row];
      for(let k=0;k<nk;k++){ const a=k/nk*Math.PI*2+row*0.29, nx=Math.cos(a), nz=Math.sin(a), v=0.75+rand()*0.4;
        push(x0+nx*0.48,y,z0+nz*0.48,0,Math.atan2(nx,nz),0.36,G(pick(['|','|','I','!','l','1',':','|'])),0.66*v,0.64*v,0.92*v,0.035+rand()*0.03,6,i,nx,0,nz); } }
    for(const yy of [0.1,ph-0.12])for(let k=0;k<14;k++){ const a=k/14*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a);
      push(x0+nx*0.62,yy,z0+nz*0.62,0,Math.atan2(nx,nz),0.34,G('='),0.7,0.66,0.95,0.06,6,i,nx,0,nz); }
  }
  // ---- split into spatial chunks so whole regions can be culled each frame
  const count=new Int32Array(CXN*CZN); for(let k=0;k<n;k++)count[CK[k]]++;
  const order=new Int32Array(n), start=new Int32Array(CXN*CZN+1);
  for(let c=0;c<CXN*CZN;c++)start[c+1]=start[c]+count[c];
  const fill=start.slice(0,CXN*CZN); for(let k=0;k<n;k++)order[fill[CK[k]]++]=k;
  for(let c=0;c<CXN*CZN;c++){
    const cnt=count[c]; if(!cnt)continue;
    const gl=new Float32Array(cnt), co=new Float32Array(cnt*3), em=new Float32Array(cnt*4), li=new Float32Array(cnt*3), lw=new Float32Array(cnt*3), mm=new Float32Array(cnt*16);
    let ymin=1e9,ymax=-1e9;
    for(let a=0;a<cnt;a++){ const k=order[start[c]+a];
      gl[a]=GL[k]; co.set(CO.subarray(k*3,k*3+3),a*3); em.set(EM.subarray(k*4,k*4+4),a*4); li.set(LI.subarray(k*3,k*3+3),a*3); lw.set(LW.subarray(k*3,k*3+3),a*3); mm.set(M.subarray(k*16,k*16+16),a*16);
      if(PY[k]<ymin)ymin=PY[k]; if(PY[k]>ymax)ymax=PY[k]; }
    const geo=new T.PlaneGeometry(1,1);
    geo.setAttribute('iGlyph',new T.InstancedBufferAttribute(gl,1));
    geo.setAttribute('iColor',new T.InstancedBufferAttribute(co,3));
    geo.setAttribute('iEmit',new T.InstancedBufferAttribute(em,4));
    geo.setAttribute('iLI',new T.InstancedBufferAttribute(li,3));
    geo.setAttribute('iLW',new T.InstancedBufferAttribute(lw,3));
    const mesh=new T.InstancedMesh(geo,staticMat,cnt);
    mesh.instanceMatrix.array.set(mm); mesh.instanceMatrix.needsUpdate=true;
    mesh.frustumCulled=false; scene.add(mesh);
    const cxw=((c%CXN)+0.5)*CHUNK*CELL, czw=(((c/CXN)|0)+0.5)*CHUNK*CELL, cyw=(ymin+ymax)/2;
    const rad=Math.hypot(CHUNK*CELL*0.5+0.6,CHUNK*CELL*0.5+0.6,(ymax-ymin)/2+0.6);
    chunks.push({mesh,sphere:new T.Sphere(new T.Vector3(cxw,cyw,czw),rad)});
  }
  const og=new T.BufferGeometry(); og.setAttribute('position',new T.Float32BufferAttribute(occ,3));
  occMesh=new T.Mesh(og,occMat); occMesh.renderOrder=-10; occMesh.frustumCulled=false; scene.add(occMesh);
  glyphCount=n;
}
const _frus=new T.Frustum(), _pm=new T.Matrix4();
let chunksDrawn=0;
function cullChunks(){
  camera.updateMatrixWorld();
  _pm.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse); _frus.setFromProjectionMatrix(_pm);
  const maxD=2.4/U.uFogDen.value; chunksDrawn=0;
  for(const c of chunks){ const d=c.sphere.center.distanceTo(camera.position)-c.sphere.radius; c.mesh.visible=d<maxD&&_frus.intersectsSphere(c.sphere); if(c.mesh.visible)chunksDrawn+=c.mesh.count; }
}

// ---------------------------------------------------------------- monsters
// ---------------------------------------------------------------- the forgotten beast (after Dwarf Fortress): the beast of this world's chronicle, built from its description
function hsl2rgb(h,s,l){ const f=n=>{ const k=(n+h*12)%12, a=s*Math.min(l,1-l); return l-a*Math.max(-1,Math.min(k-3,9-k,1)); }; return [f(0),f(8),f(4)]; }
function makeBeastType(H){
  const sp=H.beastSpec, rnd=mulberry32((runSeed^0x1234567)>>>0);
  const plan={'獣':'quad','竜':'quad','大蛇':'serpent','蛾':'moth','百足':'centipede'}[sp.kind]||'quad';
  const spec={plan,kind:sp.kind,legs:sp.feat==='六本脚の'?6:4,wings:(sp.kind==='竜'||sp.kind==='蛾')&&sp.feat!=='翼なき',eyes:sp.feat==='千の眼を持つ'?26:0,
    fire:sp.feat==='燃える鱗の',shadow:sp.feat==='影を喰らう',sing:sp.feat==='歌う',glyphs:[['#','%','&'],['=','~','x'],['%','*','#'],['&','8','%']][Math.floor(rnd()*4)]};
  const col=spec.fire?[1.0,0.42,0.14]:spec.shadow?[0.5,0.32,0.8]:hsl2rgb(rnd(),0.75,0.6);
  const lore=(H.events.find(e=>e.art==='serpent')||{}).text||`その名は、年代記の隅にだけ記されている。`;
  return {ch:'X',name:H.beast,col,form:'beast',spec,lore,scale:plan==='moth'?3.0:3.6,speed:plan==='moth'?1.0:0.55,fl:plan==='moth'?2.4:0,light:9,trail:spec.fire?8:3,flier:plan==='moth',beast:true,
    verb:'洞窟の奥で、身じろぎもせずに眠っている'};
}
function beastForm(spec){
  const pts=[], add=(x,y,z,ch,s,b,part,piv,pz)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:piv||0,pz:pz||0});
  const B=spec.glyphs, fib=(n,r,cx,cy,cz,set,s,b,part)=>{ for(let i=0;i<n;i++){ const y=1-2*(i+0.5)/n, rr=Math.sqrt(1-y*y), a=i*2.39996; add(cx+Math.cos(a)*rr*r,cy+y*r,cz+Math.sin(a)*rr*r,mpick(set),s,b,part); } };
  let head=[0,0.8,0.7];
  if(spec.plan==='quad'){
    for(let k=0;k<8;k++){ const z=-0.45+k*0.13; for(let j=0;j<7;j++){ const a=j/7*Math.PI*2; add(Math.cos(a)*0.2,0.55+Math.sin(a)*0.15,z,mpick(B),0.14,1.0,'body'); } }
    if(spec.kind==='竜'){ for(let k=0;k<4;k++)add(0,0.68+k*0.1,0.5+k*0.07,mpick(B),0.13,1.0,'head'); head=[0,1.08,0.8]; }
    fib(8,0.15,head[0],head[1],head[2],B,0.13,1.3,'head');
    const lz=spec.legs===6?[0.38,0,-0.38]:[0.36,-0.36];
    lz.forEach((z,k)=>{ for(const sx of [1,-1]){ const part=((k%2===0)===(sx>0))?'legL':'legR'; for(let q=0;q<4;q++)add(sx*0.17,0.42-q*0.13,z,mpick(['|','!','/']),0.12,0.9,part,0.45,z); } });
    for(let k=0;k<6;k++)add(0,0.6-k*0.03,-0.55-k*0.12,mpick(['~','-',B[0]]),0.12,0.9,'tail',k);
    if(spec.wings)for(const sd of [-1,1])for(let k=0;k<7;k++)pts.push({x:0,y:0.85,z:0.1,g:G(mpick(['^','v','/','\\','~'])),s:0.15,b:1.1,part:'wing',ph:mr()*6.28,piv:0,pz:0,sd,r:0.18+k*0.12});
  } else if(spec.plan==='serpent'||spec.plan==='centipede'){
    const n=spec.plan==='serpent'?18:14;
    for(let i=0;i<n;i++){ const zc=0.9-i*0.2, yc=0.22+(i<2?0.35-i*0.15:0), rr=0.16*(1-i/(n*1.4));
      for(let k=0;k<5;k++){ const a=k/5*Math.PI*2+i*0.4; add(Math.cos(a)*rr,yc+Math.sin(a)*rr,zc,mpick(B),0.15,1.0,'seg',i); }
      if(spec.plan==='centipede')for(const sd of [-1,1])add(sd*0.3,0.08,zc,sd<0?'/':'\\',0.13,0.9,'seg',i); }
    head=[0,0.62,1.0];
  } else {
    for(let k=0;k<6;k++)add(0,-0.1+k*0.1,0,mpick(B),0.13,1.1,'body');
    head=[0,0.55,0.05];
    if(spec.wings)for(const sd of [-1,1])for(const [yo,n] of [[0.18,8],[-0.08,6]])for(let k=0;k<n;k++)pts.push({x:0,y:yo,z:0,g:G(mpick(['^','v','~','*','o'])),s:0.16,b:1.2,part:'wing',ph:mr()*6.28,piv:0,pz:0,sd,r:0.14+k*0.11});
  }
  add(head[0],head[1],head[2]+0.05,spec.core||'X',0.42,3.2,spec.plan==='quad'||spec.plan==='moth'?'core':'shead',0);
  const eyes=spec.eyes||2;
  for(let k=0;k<eyes;k++){ const onHead=k<2||!spec.eyes; const p=onHead?[head[0]+(k%2?0.07:-0.07),head[1]+0.05,head[2]+0.13]:pts[Math.floor(mr()*pts.length)];
    add(p.x!==undefined?p.x:p[0],(p.y!==undefined?p.y:p[1])+0.05,p.z!==undefined?p.z:p[2],'o',0.11,3.0,onHead?'head':'body'); }
  return pts;
}

// troll: hunched, with arms that nearly reach the ground and moss hanging from the shoulders
function trollForm(){
  const L='T', pts=[], add=(x,y,z,ch,s,b,part,piv,pz)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:piv||0,pz:pz||0});
  for(let i=0;i<9;i++){ const y=1-2*(i+0.5)/9, rr=Math.sqrt(1-y*y), a=i*2.39996; add(Math.cos(a)*rr*0.15,1.26+y*0.14,0.24+Math.sin(a)*rr*0.15,mpick([L,'%','*']),0.15,1.5,'head'); }
  for(let k=0;k<5;k++){ const yy=0.88+k*0.1, lean=k*0.045; for(let j=0;j<8;j++){ const a=j/8*Math.PI*2; add(Math.cos(a)*0.26,yy,Math.sin(a)*0.17+lean,mpick(['%','&','#',L]),0.16,1.0,'body'); } }
  for(const sd of [-1,1]){
    for(let k=0;k<8;k++){ const f=k/7; add(sd*(0.34+f*0.05),1.3-f*1.05,0.12+f*0.06,mpick([L,'|','%',sd<0?'/':'\\\\']),0.15,1.0,sd<0?'armL':'armR',1.3); }
    for(let k=0;k<3;k++)add(sd*(0.36+k*0.05),0.22-k*0.03,0.2,'v',0.12,1.0,sd<0?'armL':'armR',1.3);
    for(let k=0;k<5;k++){ const f=k/4; add(sd*0.14,0.82-f*0.74,0,mpick(['|','!','#']),0.17,0.95,sd<0?'legL':'legR',0.82); }
    for(let k=0;k<4;k++)add(sd*(0.2+k*0.04),1.25-k*0.12,-0.05,mpick(['"',',',';']),0.12,0.9,'body');
  }
  add(0,1.3,0.33,L,0.4,3.0,'core');
  return pts;
}
// golem: stacked stone blocks with a rune pulsing in its chest
function golemForm(){
  const L='Y', pts=[], add=(x,y,z,ch,s,b,part,piv,pz)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:piv||0,pz:pz||0});
  for(let a=0;a<3;a++)for(let b=0;b<4;b++)for(let c=0;c<2;c++){ if(a===1&&b===2&&c===1)continue; add((a-1)*0.17,0.92+b*0.15,(c-0.5)*0.17,(a+b+c)%2?'#':'=',0.19,0.85,'body'); }
  for(let a=0;a<2;a++)for(let b=0;b<2;b++)add((a-0.5)*0.15,1.58+b*0.13,0,b?'[':']',0.17,0.9,'head');
  add(0.07,1.64,0.1,'*',0.1,3.0,'head'); add(-0.07,1.64,0.1,'*',0.1,3.0,'head');
  for(const sd of [-1,1]){
    for(let k=0;k<4;k++)add(sd*0.38,1.32-k*0.17,0,k===3?'#':'[',0.2,0.85,sd<0?'armL':'armR',1.32);
    for(let k=0;k<4;k++)add(sd*0.14,0.8-k*0.2,0,'#',0.2,0.85,sd<0?'legL':'legR',0.8);
  }
  add(0,1.24,0.12,L,0.36,3.4,'core');
  return pts;
}
// ---------------------------------------------------------------- each creature's own features on the shared bodies (kept short: proportions and a few held things)
function lookHumanoid(look,pts,add,L){
  const mv=(parts,f)=>{ for(const p of pts)if(parts.includes(p.part))f(p); };
  if(look==='kobold'){ for(const sd of [-1,1])add(sd*0.13,1.72,0,'^',0.13,1.4,'head');
    for(let k=0;k<10;k++)add(0.33,0.35+k*0.17,0.05,k===9?'^':'|',0.13,k===9?2.2:1.0,'armR',1.36); }
  else if(look==='goblin'){ for(const sd of [-1,1])add(sd*0.25,1.56,-0.02,sd<0?'<':'>',0.13,1.3,'head'); add(0.36,0.8,0.14,'-',0.14,1.7,'armR',1.36); }
  else if(look==='snapjaw'){ mv(['head','core'],p=>{ p.z+=0.06; }); for(let k=0;k<4;k++)add(0,1.46,0.2+k*0.07,mpick(['=','>']),0.12,1.2,'head');
    for(let k=0;k<5;k++)add(0,1.72-k*0.1,-0.14-k*0.02,'^',0.12,1.1,'head'); }
  else if(look==='monkey'){ mv(['head','core','body'],p=>{ p.z+=0.18*Math.max(0,(p.y-0.9))/0.7; p.y-=0.12; });
    mv(['armL','armR'],p=>{ p.y=p.piv-(p.piv-p.y)*1.6; });
    for(let k=0;k<8;k++){ const a=k/7*Math.PI; add(0,0.72+Math.sin(a)*0.42,-0.2-k*0.07,mpick(['~','s','(']),0.11,1.0,'tail',k*0.6); } }
  else if(look==='conjurer'){ for(let i=pts.length-1;i>=0;i--)if(pts[i].part==='legL'||pts[i].part==='legR')pts.splice(i,1);
    for(let y=0.08;y<0.95;y+=0.13){ const r=0.36-(y/0.95)*0.14, n=9; for(let j=0;j<n;j++){ const a=j/n*Math.PI*2; add(Math.cos(a)*r,y,Math.sin(a)*r*0.8,mpick(['/','\\','|',L]),0.14,0.95,'robe'); } }
    for(let k=0;k<11;k++)add(0.4,0.1+k*0.18,0.1,'|',0.12,0.9,'armR',1.36); add(0.4,2.08,0.1,'*',0.22,3.2,'armR',1.36);
    for(const [dx,dy] of [[-0.1,1.72],[0,1.8],[0.1,1.72]])add(dx,dy,-0.02,'^',0.12,1.2,'head'); }
  else if(look==='ogre'){ mv(['body','head','core'],p=>{ p.x*=1.35; p.z*=1.3; }); mv(['armL','armR'],p=>{ p.x*=1.3; });
    for(let k=0;k<7;k++)add(0.47+(mr()-0.5)*0.12,0.6+k*0.05,0.12+(mr()-0.5)*0.12,mpick(['#','%','@']),0.17,1.1,'armR',1.36); }
  else if(look==='gnome'){ for(let k=0;k<5;k++){ const r=0.16-k*0.03, n=Math.max(1,6-k); for(let j=0;j<n;j++){ const a=j/n*Math.PI*2; add(Math.cos(a)*r,1.66+k*0.09,Math.sin(a)*r,k===4?'^':'A',0.12,1.2,'head'); } }
    for(let k=0;k<4;k++)add((k-1.5)*0.05,1.36,0.15,'"',0.11,1.1,'head'); }
}
// body proportions by kind: the hip, the shoulder and the head are moved, everything between follows (held things included)
const HUM_PROP={base:{hip:0.75,sh:1.30,hc:1.47,hk:1.0}, small:{hip:0.6,sh:1.12,hc:1.36,hk:1.25}, monkey:{hip:0.52,sh:1.1,hc:1.28,hk:1.1},
  snapjaw:{hip:0.68,sh:1.24,hc:1.43,hk:1.05,lean:0.12}, ogre:{hip:0.6,sh:1.26,hc:1.4,hk:0.9,legW:1.3}};
const LOOK_PROP={kobold:'small',goblin:'small',gnome:'small',conjurer:'small',monkey:'monkey',snapjaw:'snapjaw',ogre:'ogre'};
function shapeHumanoid(pts,look){ const P=HUM_PROP[LOOK_PROP[look]||'base'];
  const map=y=>y<=0.86?y*(P.hip/0.86):P.hip+(y-0.86)*((P.sh-P.hip)/(1.37-0.86));
  for(const p of pts){ const head=p.part==='head'||p.part==='core';
    if(head){ p.y=P.hc+(p.y-1.5)*P.hk; p.x*=P.hk; p.z*=P.hk; } else p.y=map(p.y);
    if(p.piv&&(p.part.startsWith('arm')||p.part.startsWith('leg')))p.piv=map(p.piv);
    if(P.legW&&p.part.startsWith('leg'))p.x*=P.legW;
    if(P.lean&&!p.part.startsWith('leg')){ const k=Math.max(0,(p.y-P.hip)/(P.hc-P.hip)); p.z+=P.lean*k; } } }
function lookQuad(look,pts,add,L){
  const mv=(parts,f)=>{ for(const p of pts)if(parts.includes(p.part))f(p); };
  const legStretch=(top,k)=>mv(['legL','legR'],p=>{ p.y=top-(p.piv-p.y)*k; p.piv=top; });
  if(look==='rat'){ mv(['body','head','core','tail'],p=>{ p.y*=0.72; }); legStretch(0.27,0.75);
    for(let k=3;k<9;k++)add(0,0.33-k*0.02,-0.42-k*0.12,mpick(['~','-']),0.09,0.85,'tail',k); }
  else if(look==='jackal'){ mv(['body','head','core','tail'],p=>{ p.y+=0.14; }); legStretch(0.5,1.4);
    for(const sd of [-1,1])add(sd*0.07,0.86,0.42,'^',0.11,1.3,'head'); }
  else if(look==='grazer'){ mv(['head','core'],p=>{ p.y-=0.14; p.z+=0.06; });
    for(let k=0;k<7;k++){ const z=-0.3+k*0.1; for(let j=-1;j<=1;j++)add(j*0.08,0.6+0.04*Math.cos(j),z,mpick(['o','%','"']),0.12,1.2,'body'); } }
  else if(look&&look.startsWith('hound')){ mv(['body','head','core','tail'],p=>{ p.y+=0.1; }); legStretch(0.46,1.3);
    for(let k=0;k<3;k++)add(0,0.66-k*0.02,0.56+k*0.07,k===2?'>':'=',0.11,1.3,'head');
    for(const sd of [-1,1])for(let k=0;k<2;k++)add(sd*0.07,0.8+k*0.04,0.4-k*0.08,'<',0.1,1.3,'head');
    const push=(x,y,z,ch,s,b,col)=>pts.push({x,y,z,g:G(ch),s,b,part:'body',ph:mr()*6.28,piv:0,pz:0,col});
    const lit2=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
    if(look==='houndF'){
      // a mane of flame tongues standing up from neck to back: deep red at the root, yellow-white at the tip; embers glowing in cracks of the dark body
      for(let k=0;k<10;k++){ const z=0.5-k*0.085, h=0.2+0.14*Math.sin(k*0.9+0.6)*(k<6?1:0.6), n=4;
        for(let q=0;q<n;q++){ const f=q/(n-1); lit2((mr()-0.5)*0.05,0.72+h*f,z-0.03*f,'^',0.13+0.03*(1-f),1.6+1.0*f,[1.0,0.25+0.6*f,0.06+0.5*f*f],'flame',{fh:f}); } }
      for(let k=0;k<6;k++){ const sd=k%2?1:-1; lit2(sd*0.16,0.48+mr()*0.12,-0.2+k*0.08,mpick(['/','\\']),0.11,2.2,[1.0,0.35,0.1]); }
      for(const sd of [-1,1])lit2(sd*0.05,0.74,0.56,'*',0.09,3.4,[1.0,0.6,0.2],'head'); }
    if(look==='houndI'){
      // clusters of large ice crystals jutting from the shoulders, the back and the hips; pale eyes
      for(const [cx,cy,cz] of [[0.12,0.72,0.3],[-0.12,0.72,0.3],[0,0.76,0.06],[0.1,0.72,-0.18],[-0.1,0.72,-0.18]]){ const sdx=cx===0?0:Math.sign(cx);
        for(let q=0;q<3;q++){ const dx=sdx*0.08+(q-1)*0.06, dy=0.2+0.12*((q*7+cz*10)%3)/2, dz=(q-1)*0.04-0.05; const L=Math.hypot(dx,dy,dz), n=Math.max(2,Math.round(L/0.08));
          for(let j=1;j<=n;j++){ const f=j/n; lit2(cx+dx*f,cy+dy*f,cz+dz*f,j===n?'*':(Math.abs(dx)>dy*0.5?(dx>0?'/':'\\'):'|'),0.12,j===n?3.0:2.2,[0.85,0.97,1.0]); } } }
      for(const sd of [-1,1])lit2(sd*0.05,0.74,0.56,'*',0.09,3.2,[0.7,0.95,1.0],'head'); }
    if(look==='houndL'){
      // a hound made of light: its whole body brighter, eyes like lamps, a core of light in the chest
      for(const p of pts)p.b*=1.6;
      for(const sd of [-1,1])lit2(sd*0.05,0.74,0.56,'*',0.1,4.0,[1.0,1.0,0.9],'head');
      lit2(0,0.55,0.3,'*',0.2,3.6,[1.0,0.95,0.7],'body'); lit2(0,0.55,0.3,'o',0.28,1.6,[1.0,0.9,0.6],'body'); } }
  else if(look==='salamander'){ mv(['body','head','core','tail'],p=>{ p.y*=0.62; p.z*=1.35; }); legStretch(0.24,0.7);
    for(let k=3;k<8;k++)add(0,0.3-k*0.02,-0.56-k*0.12,mpick(['~','=']),0.1,0.9,'tail',k);
    for(let k=0;k<6;k++)add((mr()-0.5)*0.1,0.42+mr()*0.08,-0.35+k*0.14,'^',0.13,2.6,'body'); }
}
for(const [k,v] of Object.entries({k:'kobold',g:'goblin',s:'snapjaw',sw:'snapjaw',m:'monkey',c:'conjurer',O:'ogre',G:'gnome',r:'rat',j:'jackal',h:'grazer',Zf:'houndF',Zi:'houndI',Zl:'houndL',l:'salamander',L:'lich',W:'wraith'}))if(MTYPES[k])MTYPES[k].look=v;
MTYPES.Rc.form='cleaner'; MTYPES.Re.form='repairer'; MTYPES.Rw.form='watcher';
// the fire and ice hounds: dark bodies, so the flames and the ice stand out; their light keeps its colour
MTYPES.Zf.trail=0; MTYPES.Zi.trail=0; MTYPES.Zl.trail=0;
MTYPES.Zf.lcol=MTYPES.Zf.col; MTYPES.Zf.col=[0.42,0.3,0.26]; MTYPES.Zi.lcol=MTYPES.Zi.col; MTYPES.Zi.col=[0.32,0.42,0.56]; MTYPES.Zl.col=[1.0,0.95,0.78];

// ---------------------------------------------------------------- bosses and the dead: their own features on top of the shared bodies (crowns, staves, hoods, horns, torn cloth); parts may carry their own colour
const GOLD=[1.0,0.82,0.38], BONE=[0.85,0.8,0.66], PALE=[0.75,0.9,1.0];
function extraLook(ty,pts){
  const look=ty.look; if(!look||pts.noExtra)return;
  const add=(x,y,z,ch,s,b,part,col,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const crown=(y,r,n,ch,col,b)=>{ for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; add(Math.cos(a)*r,y,Math.sin(a)*r,ch,0.12,b||2.4,'head',col); } };
  if(look==='lichking'||look==='lich'){
    crown(2.08,look==='lichking'?0.17:0.13,look==='lichking'?8:5,'^',look==='lichking'?GOLD:[0.9,0.85,0.6],look==='lichking'?2.6:1.8);
    if(look==='lichking'){ for(let k=0;k<12;k++)add(0.48,0.25+k*0.15,0.1,'|',0.12,1.1,'robe',BONE); add(0.48,2.1,0.1,'*',0.24,3.2,'robe',PALE);
      for(let k=0;k<14;k++){ const a=k/14*Math.PI*2; add(Math.cos(a)*0.62,0.12+mr()*0.3,Math.sin(a)*0.62,mpick(['\\','/','~','%']),0.13,0.9,'robe'); } }
    else { add(0,1.45,0,'#',0.2,2.2,'orbit',[0.75,0.55,1.0],{r:0.62,sp:0.9}); add(0,1.58,0,'=',0.16,1.8,'orbit',[0.75,0.55,1.0],{r:0.62,sp:0.9}); }
  }
  else if(look==='wraith'){
    for(let k=0;k<16;k++){ const a=k/16*Math.PI*2, r=0.5+mr()*0.15; add(Math.cos(a)*r,0.05+mr()*0.35,Math.sin(a)*r,mpick(['|','\\','/','!']),0.13,0.85,'robe'); }
    for(const sd of [-1,1])for(let k=0;k<3;k++)add(sd*(0.68+k*0.07),1.28-k*0.05,0.35+k*0.06,sd<0?'<':'>',0.11,1.8,'robe',[0.9,0.92,1.0]);
  }
  else if(look==='shadowking'){
    for(let k=0;k<5;k++){ const a=k/5*Math.PI*2; for(let q=0;q<3;q++)add(Math.cos(a)*0.2,2.12+q*0.12,Math.sin(a)*0.2,q===2?'^':'|',0.12,2.4,'head',[0.82,0.72,1.0]); }
    add(0.08,1.92,0.14,'*',0.09,3.4,'head',[1,1,1]); add(-0.08,1.92,0.14,'*',0.09,3.4,'head',[1,1,1]);
    for(let k=0;k<18;k++){ const f=k/18; add((mr()-0.5)*0.6,1.6-f*1.1,-0.3-f*0.8,mpick(['~','%','\'']),0.15,0.9,'robe',[0.4,0.3,0.7]); }
  }
  else if(look==='spiderqueen'){
    for(let i=0;i<22;i++){ const y=1-2*(i+0.5)/22, rr=Math.sqrt(1-y*y), a=i*2.39996; add(Math.cos(a)*rr*0.3,0.5+y*0.24,-0.42+Math.sin(a)*rr*0.34,mpick(['%','&','@']),0.15,1.0,'body'); }
    for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; add(Math.cos(a)*0.1,0.66,0.2+Math.sin(a)*0.06,mpick(['*','\'']),0.08,2.6,'head',[0.88,0.92,1.0]); }
    for(let k=0;k<4;k++)add(0,0.05,0,'s',0.1,1.3,'orbit',null,{r:0.9+k*0.12,sp:0.6+k*0.15,ph:k*1.57});
  }
  else if(look==='nagaqueen'){
    crown(0.92,0.1,5,'^',GOLD,2.6); for(const p of pts)if(p.part==='head'&&p.y>0.9-0.01&&p.col===GOLD)p.z+=1.0;
    for(const sd of [-1,1])for(let k=0;k<5;k++)add(sd*(0.12+k*0.05),0.58+k*0.04,0.86,sd<0?'(':')',0.12,1.2,'head');
  }
  else if(look==='olddragon'){
    for(const sd of [-1,1])for(let k=0;k<4;k++)add(sd*(0.08+k*0.03),1.2+k*0.08,0.74-k*0.06,sd<0?'\\':'/',0.11,1.4,'head',BONE);
    for(let k=0;k<5;k++)add((k-2)*0.03,0.94-k*0.04,0.92,mpick(['"',',']),0.1,1.1,'head',[0.8,0.78,0.7]);
    for(let i=pts.length-1;i>=0;i--)if(pts[i].part==='wing'&&mr()<0.3)pts.splice(i,1);
    for(const p of pts)if(p.part==='wing'&&mr()<0.3)p.g=G('%');
    for(let k=0;k<4;k++)add((mr()<0.5?-1:1)*0.21,0.55+mr()*0.1,-0.3+k*0.18,'=',0.12,1.6,'body',[0.9,0.32,0.22]);
  }
}

// ---------------------------------------------------------------- the Undead King (rebuilt): a floating upper body joined to its mantle only by the spine, one huge spiked shoulder and armoured arm,
// one long bone arm holding a cold flame, a crown of tall light needles, a greatsword planted in the floor with chains and rune pendants.
// Surfaces are filled densely; each glyph is chosen by how its surface faces the light (ASCII-art shading), by material.
function lichKingForm(){
  // readable glyphs: about 0.17 body units each (0.29 m at the king's size), spaced 1.2-1.5 glyphs apart; lines are drawn as one stroke of glyphs that follow their direction
  const pts=[], LD=[0.42,0.72,0.55], S=0.17, GAP=0.145;
  const RAMP={cloth:['.',':','|','|','#'], red:['.',':','|','|','#'], metal:['.',':','=','#','@'], bone:['.','o','o','0','@'], gold:['-','=','=','#','@']};
  const COL={cloth:[0.3,0.27,0.4], red:[0.72,0.14,0.16], metal:[0.44,0.44,0.5], bone:[0.9,0.86,0.74], gold:[1.0,0.78,0.34], blade:[0.8,0.82,0.88], ice:[0.6,0.86,1.0], chain:[0.75,0.72,0.66]};
  const put=(x,y,z,nx,ny,nz,mat,part,s)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=RAMP[mat];
    pts.push({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:s||S,b:0.45+(mat==='gold'?1.2:0.95)*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col:COL[mat]}); };
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  // a stroke: glyphs following the line's direction as seen from the front (| / \ -)
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,step)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(step||0.15))), ch=strokeCh(dx,dy);
    for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part); } };
  const shell=(cx,cy,cz,rx,ry,rz,mat,part,keep)=>{ for(let v=0.2;v<=Math.PI-0.2;v+=GAP/Math.max(rx,ry,rz)){ const sv=Math.sin(v), cv=Math.cos(v), n=Math.max(5,Math.round(2*Math.PI*Math.max(rx,rz)*sv/GAP));
      for(let k=0;k<n;k++){ const u=k/n*Math.PI*2+v, nx=Math.cos(u)*sv, ny=cv, nz=Math.sin(u)*sv; if(keep&&!keep(nx,ny,nz))continue; put(cx+nx*rx,cy+ny*ry,cz+nz*rz,nx/rx,ny/ry,nz/rz,mat,part); } } };
  const ring=(cx,cy,cz,rx,rz,n,mat,part,s)=>{ for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; put(cx+Math.cos(a)*rx,cy,cz+Math.sin(a)*rz,Math.cos(a),0.2,Math.sin(a),mat,part,s); } };
  // 1. the mantle column: fold lines of | from the waist to the torn hem, a crimson slit at the front
  for(let y=0.05;y<1.12;y+=0.115){ const f=y/1.12, r=0.78-0.4*f, n=Math.round(2*Math.PI*r/0.14);
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+(y*3)%0.3, nx=Math.cos(a), nz=Math.sin(a), front=Math.abs(Math.atan2(nx,nz))<0.4;
      if(f<0.2&&mr()<0.3)continue; put(nx*r,y,nz*r*0.92,nx,0.25,nz,front?'red':'cloth','robe'); } }
  // 2. the spine
  for(let y=1.14;y<1.5;y+=0.1)lit(0,y,-0.02,'o',0.13,1.1,COL.bone,'body');
  // 3. the floating chest, gold at the waist and the collar
  shell(0,1.76,0,0.4,0.3,0.25,'metal','body',(nx,ny)=>ny>-0.85);
  ring(0,1.5,0,0.34,0.22,18,'gold','body'); ring(0,2.02,0,0.24,0.18,13,'gold','body');
  // 4. the skull, with large cold eyes and teeth
  shell(0,2.2,0.02,0.15,0.17,0.15,'bone','head');
  lit(0.06,2.22,0.16,'*',0.16,4.0,COL.ice,'head'); lit(-0.06,2.22,0.16,'*',0.16,4.0,COL.ice,'head'); lit(0,2.1,0.16,'=',0.13,1.2,COL.bone,'head');
  // 5. the crown: a gold band, tall needles of light
  ring(0,2.36,0,0.16,0.15,9,'gold','head',0.14);
  for(let k=0;k<9;k++){ const a=k/9*Math.PI*2, h=0.32+0.3*Math.abs(Math.sin(k*1.7)), lean=0.12, base=[Math.cos(a)*0.16,2.42,Math.sin(a)*0.15], tip=[Math.cos(a)*(0.16+lean),2.42+h,Math.sin(a)*(0.15+lean)];
    stroke(base,tip,COL.gold,2.0,0.13,'head',0.13); lit(tip[0],tip[1]+0.06,tip[2],'^',0.18,3.6,COL.ice,'head'); }
  // 6. the huge shoulder (right), its rim and spikes
  shell(0.56,1.98,0,0.3,0.24,0.28,'metal','body',(nx,ny)=>ny>-0.2);
  ring(0.56,1.93,0,0.3,0.28,16,'gold','body');
  for(let k=0;k<6;k++){ const a=-0.3+k*0.55, d=[Math.cos(a)*0.6,0.8,Math.sin(a)*0.4], b0=[0.56+d[0]*0.22,1.98+d[1]*0.14,d[2]*0.22], b1=[0.56+d[0]*0.56,1.98+d[1]*0.48,d[2]*0.56];
    stroke(b0,b1,COL.gold,1.8,0.13,'body',0.13); lit(b1[0],b1[1]+0.05,b1[2],'^',0.15,2.6,COL.gold,'body'); }
  // 7. the armoured arm (right): plates, gold joints, elbow spikes, a gauntlet on the sword's grip
  const sh=[0.66,1.8,0.02], el=[0.82,1.36,0.1], wr=[0.86,1.02,0.22];
  for(const [a,b] of [[sh,el],[el,wr]]){ const L=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]); for(let t=0;t<=L;t+=0.13)for(let k=0;k<6;k++){ const an=k/6*Math.PI*2+t*2, f=t/L; put(a[0]+(b[0]-a[0])*f+Math.cos(an)*0.12,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f+Math.sin(an)*0.12,Math.cos(an),0,Math.sin(an),'metal','body'); } }
  for(const j of [el,wr])ring(j[0],j[1],j[2],0.14,0.14,6,'gold','body',0.13);
  stroke([el[0]+0.08,el[1],el[2]-0.04],[el[0]+0.3,el[1]+0.05,el[2]-0.16],COL.gold,1.8,0.13,'body',0.12);
  // 8. the bone arm (left), long, its claws holding a cold flame
  const lsh=[-0.4,1.86,0], lel=[-0.7,1.38,0.12], lwr=[-0.62,0.98,0.42];
  stroke(lsh,lel,COL.bone,1.3,0.14,'body',0.12); stroke(lel,lwr,COL.bone,1.3,0.14,'body',0.12);
  lit(lel[0],lel[1],lel[2],'o',0.14,1.4,COL.bone,'body');
  for(let f=0;f<3;f++)stroke([lwr[0]+(f-1)*0.06,lwr[1]+0.04,lwr[2]+0.04],[lwr[0]+(f-1)*0.08,lwr[1]+0.14,lwr[2]+0.2],COL.bone,1.3,0.11,'body',0.08);
  for(let k=0;k<5;k++)lit(0,lwr[1]+0.32+k*0.03,0,k?'\'':'*',k?0.12:0.22,k?2.6:4.2,COL.ice,'spin',{cx:lwr[0],cz:lwr[2]+0.12,r:0.03+0.03*(k%3),sp:2.4+k*0.4,ph:k*1.2});
  // 9. the greatsword, planted; chains with rune pendants from the guard
  const sx=1.12, sz=0.32;
  for(const o of [-0.06,0.06])stroke([sx+o,0.08,sz],[sx+o,2.0,sz],COL.blade,1.5,0.15,'body',0.15);
  stroke([sx,0.02,sz],[sx,1.95,sz],COL.gold,1.2,0.1,'body',0.3);
  stroke([sx-0.32,2.04,sz],[sx+0.32,2.04,sz],COL.gold,2.0,0.15,'body',0.12); lit(sx-0.38,2.08,sz,'<',0.14,2.2,COL.gold,'body'); lit(sx+0.38,2.08,sz,'>',0.14,2.2,COL.gold,'body');
  stroke([sx,2.1,sz],[sx,2.38,sz],COL.metal,1.2,0.14,'body',0.12); lit(sx,2.46,sz,'@',0.2,2.6,COL.gold,'body');
  for(const side of [-1,1]){ const ax=sx+side*0.24; for(let t=0;t<=1;t+=0.14){ lit(ax+side*0.12*t,2.0-0.75*t,sz+0.04,t*7%2<1?'o':'.',0.11,1.3,COL.chain,'body'); }
    lit(ax+side*0.12,1.18,sz+0.04,RUNE_CHARS[side>0?0:6],0.2,3.0,COL.ice,'body'); }
  return pts;
}
// presence: the swords of the fallen planted around, a ring of frost, cold mist, the flame's sparks, a low drone close by
function lichAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>30)return;
  if(!m.swords){ m.swords=[]; for(let k=0;k<7;k++){ const a=k/7*Math.PI*2+mr()*0.4, r=(1.7+mr()*0.9)*sc; m.swords.push({x:m.x+Math.cos(a)*r,z:m.z+Math.sin(a)*r,tx:(mr()-0.5)*0.5,tz:(mr()-0.5)*0.5,h:0.8+mr()*0.5}); } }
  for(const s of m.swords){ for(let y=0;y<s.h;y+=0.12)dyn(s.x+s.tx*y,y,s.z+s.tz*y,G('|'),0.14,0.42,0.42,0.48); dyn(s.x+s.tx*s.h,s.h,s.z+s.tz*s.h,G('+'),0.18,0.55,0.48,0.32); }
  const n=36; for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.05, r=(1.3+0.12*Math.sin(t*0.7+k))*sc; dyn(m.x+Math.cos(a)*r,0.05,m.z+Math.sin(a)*r,G(k%3?'.':'*'),0.12,0.45,0.65,0.9); }
  if(mr()<0.25){ const a=mr()*6.28, r=mr()*1.2*sc; spawn(m.x+Math.cos(a)*r,0.15,m.z+Math.sin(a)*r,Math.cos(a)*0.25,0.08,Math.sin(a)*0.25,2.2,G(mpick(['~','.'])),0.22,0.3,0.4,0.55,0); }
  if(dp<14&&time>(m.droneT||0)&&sndReady()){ m.droneT=time+3.2; const t0=SND.ctx.currentTime, o=sOut(m.x,m.z,0.16); sEnv(sTone(t0,'sine',55,52,3,o),t0,0.6,2.3); sEnv(sTone(t0,'sine',82.5,80,3,o),t0,0.8,2.1,0.5); } }

// ---------------------------------------------------------------- the Spider Queen: held high on eight arched legs, a lantern abdomen glowing amber through its plates, a cluster of eyes,
// a crown spun of silver thread, threads up to the dark with prey cocoons hanging; readable glyphs (0.12 body units = about 0.29 m at her size)
function spiderQueenForm(){
  const pts=[], LD=[0.42,0.72,0.55], S=0.12, GAP=0.1;
  const COL={chitin:[0.74,0.64,0.92], silver:[0.86,0.88,0.96], amber:[1.0,0.68,0.28], eye:[1.0,0.55,0.85], cocoon:[0.88,0.86,0.8]};
  const RAMP={chitin:['.',':','o','%','@'], cocoon:['.',':','0','0','@']};
  const put=(x,y,z,nx,ny,nz,mat,part,s,extra)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=RAMP[mat];
    pts.push(Object.assign({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:s||S,b:0.45+0.95*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col:COL[mat]},extra||{})); };
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,step,extra)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(step||0.1))), ch=strokeCh(dx,dy);
    for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part,extra); } };
  const shell=(cx,cy,cz,rx,ry,rz,mat,part,glow)=>{ for(let v=0.2;v<=Math.PI-0.15;v+=GAP/Math.max(rx,ry,rz)){ const sv=Math.sin(v), cv=Math.cos(v), n=Math.max(5,Math.round(2*Math.PI*Math.max(rx,rz)*sv/GAP));
      for(let k=0;k<n;k++){ const u=k/n*Math.PI*2+v, nx=Math.cos(u)*sv, ny=cv, nz=Math.sin(u)*sv, x=cx+nx*rx, y=cy+ny*ry, z=cz+nz*rz;
        if(glow&&glow(nx,ny,nz))lit(x,y,z,mpick(['*','+','\'']),S*0.9,2.6+mr(),COL.amber,part); else put(x,y,z,nx/rx,ny/ry,nz/rz,mat,part); } } };
  // the eight legs: hip, a high knee, a far foot; each swings from its hip
  for(const sx of [1,-1])for(let k=0;k<4;k++){ const hz=0.32-k*0.16, part=((k%2===0)===(sx>0))?'legL':'legR', ex={piv:1.12,pz:hz};
    const hip=[sx*0.14,1.12,hz], knee=[sx*(0.5+k*0.04),1.62-k*0.05,hz+(1.5-k)*0.14], foot=[sx*(0.95+k*0.05),0.02,hz+(1.5-k)*0.42];
    for(const [a,b,w0,w1] of [[hip,knee,0.06,0.045],[knee,foot,0.045,0.022]]){ for(const o of [-1,0,1]){ const off=f=>o*(w0+(w1-w0)*f); const n=Math.max(2,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/0.1));
        for(let q=0;q<=n;q++){ const f=q/n; lit(a[0]+(b[0]-a[0])*f+off(f)*sx*0.4,a[1]+(b[1]-a[1])*f+off(f),a[2]+(b[2]-a[2])*f,strokeCh(b[0]-a[0],b[1]-a[1]),S*(o?0.85:1),o?0.8:1.15,COL.chitin,part,ex); } }
      for(let q=1;q<5;q++){ const f=q/5; lit(a[0]+(b[0]-a[0])*f+sx*0.07,a[1]+(b[1]-a[1])*f+0.04,a[2]+(b[2]-a[2])*f,mpick([',','"']),S*0.7,0.7,[0.55,0.48,0.62],part,ex); } }
    lit(knee[0],knee[1],knee[2],'o',S*1.5,1.6,COL.chitin,part,ex); lit(foot[0],foot[1]+0.03,foot[2],'^',S,1.2,COL.chitin,part,ex); }
  // head-chest and the eye cluster
  shell(0,1.14,0.2,0.2,0.13,0.22,'chitin','body');
  shell(0,1.2,0.46,0.1,0.09,0.1,'chitin','head');
  for(let e=0;e<24;e++){ const row=Math.floor(e/6), k=e%6, a=(k/5-0.5)*1.5, b=0.5-row*0.28; lit(Math.sin(a)*0.1*Math.cos(b),1.2+Math.sin(b)*0.09,0.46+Math.cos(a)*0.1*Math.cos(b),'*',S*(row<2?0.9:0.65),row<2?3.6:2.6,COL.eye,'head'); }
  for(let k=0;k<7;k++)lit((mr()-0.5)*0.3,1.27,0.1+mr()*0.25,'.',S*0.8,2.4,COL.eye,'body');
  for(let k=0;k<14;k++)lit((mr()-0.5)*0.36,1.2+mr()*0.05,(mr()-0.2)*0.4,mpick([',','"']),S*0.7,0.7,[0.55,0.48,0.62],'body');
  // fangs: thick curved chelicerae, and the palps beside them
  for(const sx of [1,-1]){ const p0=[sx*0.05,1.14,0.55], p1=[sx*0.08,0.98,0.66], p2=[sx*0.03,0.86,0.62];
    for(const o of [-0.02,0.02]){ stroke([p0[0]+o,p0[1],p0[2]],[p1[0]+o,p1[1],p1[2]],[0.5,0.42,0.55],1.3,S,'head',0.06); stroke([p1[0]+o,p1[1],p1[2]],[p2[0]+o,p2[1],p2[2]],[0.85,0.82,0.78],1.6,S*0.9,'head',0.06); }
    lit(p2[0],p2[1]-0.03,p2[2],'\'',S*0.9,2.4,[0.55,1.0,0.5],'head');
    const q0=[sx*0.11,1.12,0.5], q1=[sx*0.2,1.0,0.66], q2=[sx*0.16,0.9,0.76]; stroke(q0,q1,COL.chitin,1.1,S*0.85,'head',0.07); stroke(q1,q2,COL.chitin,1.1,S*0.85,'head',0.07); lit(q1[0],q1[1],q1[2],'o',S,1.4,COL.chitin,'head'); }
  // a crown spun of thread
  for(let k=0;k<7;k++){ const a=(k/6-0.5)*1.6; stroke([Math.sin(a)*0.08,1.28,0.46+Math.cos(a)*0.03],[Math.sin(a)*0.16,1.55+0.06*Math.cos(a*2),0.42],COL.silver,1.9,S*0.85,'head',0.07); lit(Math.sin(a)*0.16,1.6,0.42,'\'',S,3,COL.silver,'head'); }
  // the lantern abdomen: plates of chitin, amber light through the cracks, a core inside
  shell(0,1.26,-0.6,0.42,0.38,0.52,'chitin','body',(nx,ny,nz)=>Math.sin(nx*9+nz*7)>0.72||Math.abs(ny)<0.12&&Math.sin(nz*20)>0);
  for(let k=0;k<6;k++)lit((mr()-0.5)*0.26,1.26+(mr()-0.5)*0.26,-0.6+(mr()-0.5)*0.32,'*',S*1.6,3.4,COL.amber,'body');
  // threads up into the dark, prey cocoons hanging from them; the spinnerets' line to the floor
  for(const [x,z] of [[0.18,-0.6],[-0.2,-0.4],[0.05,-0.8],[-0.1,-0.2]])stroke([x,1.46,z],[x*2.6,3.0,z*1.6],COL.silver,1.0,S*0.75,'body',0.12);
  for(const [x,y,z] of [[0.62,2.1,-0.9],[-0.66,2.35,-0.5],[0.3,1.95,0.6]]){ stroke([x,2.9,z],[x,y+0.2,z],COL.silver,0.9,S*0.7,'body',0.12); for(let k=0;k<6;k++)put(x+(mr()-0.5)*0.08,y-k*0.06+0.12,z+(mr()-0.5)*0.08,(mr()-0.5),0.3,0.8,'cocoon','body',S*0.95); lit(x,y-0.04,z+0.03,'*',S*0.8,1.8,COL.amber,'body'); }
  stroke([0,0.92,-1.1],[0,0.02,-1.45],COL.silver,1.0,S*0.75,'body',0.12);
  return pts;
}
// her floor: a radial web and spiderlings running on it
function spiderAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>30)return;
  if(mr()<0.12){ const cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), lx=(mr()<0.5?1:-1)*0.03*sc, lz=0.62*sc; spawn(m.x+lx*cy+lz*sy,m.y+0.82*sc,m.z-lx*sy+lz*cy,0,-0.2,0,1.2,G('.'),0.12,0.5,1.0,0.45,1); }
  for(let k=0;k<10;k++){ const a=k/10*Math.PI*2+0.2; const dark=k%3===0; for(let r=0.5;r<2.6;r+=0.28)dyn(m.x+Math.cos(a)*r*sc,0.04,m.z+Math.sin(a)*r*sc,G(k%2?'/':'\\'),0.12,dark?0.14:0.38,dark?0.1:0.4,dark?0.18:0.48); }
  for(let r=0.9;r<2.6;r+=0.55){ const n=Math.round(r*14); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; dyn(m.x+Math.cos(a)*r*sc,0.04,m.z+Math.sin(a)*r*sc,G('.'),0.1,0.32,0.34,0.42); } }
  for(let k=0;k<5;k++){ const a=t*(0.5+k*0.13)+k*1.3, r=(1.2+0.6*Math.sin(t*0.7+k))*sc; dyn(m.x+Math.cos(a)*r,0.08,m.z+Math.sin(a)*r,G('s'),0.16,0.75,0.65,0.95); } }

// ---------------------------------------------------------------- the Naga Queen: a coiled serpent throne, an upright body with four arms (two curved blades, a mirror, an open hand),
// a cobra hood with glowing eye patterns, a tall gold crown; jade scales and gold; readable glyphs (0.11 body units = about 0.29 m at her size)
function nagaQueenForm(){
  const pts=[], LD=[0.42,0.72,0.55], S=0.11;
  const COL={jade:[0.32,0.8,0.55], belly:[0.86,0.86,0.6], skin:[0.55,0.82,0.62], gold:[1.0,0.8,0.36], steel:[0.82,0.86,0.9], teal:[0.4,1.0,0.85], mirror:[0.75,0.95,1.0]};
  const RAMP={jade:['.',':','=','%','#'], belly:['.','-','=','=','#'], skin:['.',':','o','0','@'], gold:['-','=','=','#','@']};
  const put=(x,y,z,nx,ny,nz,mat,part,s)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=RAMP[mat];
    pts.push({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:s||S,b:0.45+(mat==='gold'?1.2:0.95)*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col:COL[mat]}); };
  const lit=(x,y,z,ch,s,b,col,part)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col});
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,step)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(step||0.09))), ch=strokeCh(dx,dy);
    for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part); } };
  // a tube along a path: scales on top, pale belly underneath
  const tube=(path,r0,r1,part)=>{ for(let i=0;i<path.length-1;i++){ const a=path[i], b=path[i+1], f=i/(path.length-1), r=r0+(r1-r0)*f;
      const tx=b[0]-a[0], ty=b[1]-a[1], tz=b[2]-a[2], tl=Math.hypot(tx,ty,tz)||1; let px=-tz/tl, pz=tx/tl, py=0; if(Math.hypot(px,pz)<0.1){ px=1; pz=0; }
      const qx=(ty/tl)*pz-(tz/tl)*py, qy=(tz/tl)*px-(tx/tl)*pz, qz=(tx/tl)*py-(ty/tl)*px, n=Math.max(5,Math.round(2*Math.PI*r/0.1));
      for(let k=0;k<n;k++){ const an=k/n*Math.PI*2+i*0.5, ox=Math.cos(an)*px+Math.sin(an)*qx, oy=Math.cos(an)*py+Math.sin(an)*qy, oz=Math.cos(an)*pz+Math.sin(an)*qz;
        put(a[0]+ox*r,a[1]+oy*r,a[2]+oz*r,ox,oy,oz,oy<-0.35?'belly':'jade',part); } } };
  // 1. the coil: two turns rising from the floor, the tail running out
  const coil=[]; for(let t=0;t<=1;t+=0.03){ const a=t*Math.PI*2*2.1, r=0.66-0.4*t; coil.push([Math.cos(a)*r,0.12+0.4*t,Math.sin(a)*r]); }
  tube(coil,0.15,0.17,'body');
  const tail=[]; for(let t=0;t<=1;t+=0.08){ const a=-t*1.6; tail.push([Math.cos(a)*(0.66+0.4*t),0.1-0.05*t,Math.sin(a)*(0.66+0.4*t)]); } tube(tail,0.14,0.04,'body');
  const trunk=[]; for(let t=0;t<=1;t+=0.12)trunk.push([coil[coil.length-1][0]*(1-t),0.52+0.43*t,coil[coil.length-1][2]*(1-t)+0.05*t]); tube(trunk,0.17,0.15,'body');
  // 2. the upright body: skin, a gold belt and neck ornament
  for(let y=0.95;y<1.36;y+=0.08){ const r=0.15+0.05*Math.sin((y-0.95)/0.41*Math.PI), n=Math.round(2*Math.PI*r/0.1); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; put(Math.cos(a)*r,y,Math.sin(a)*r*0.75+0.05,Math.cos(a),0,Math.sin(a),'skin','body'); } }
  for(let k=0;k<12;k++){ const a=k/12*Math.PI*2; put(Math.cos(a)*0.17,0.97,Math.sin(a)*0.13+0.05,Math.cos(a),0,Math.sin(a),'gold','body'); put(Math.cos(a)*0.16,1.34,Math.sin(a)*0.12+0.05,Math.cos(a),0.4,Math.sin(a),'gold','body'); }
  // 3. the head, slit eyes, a tall crown with a gem
  for(let i=0;i<16;i++){ const y=1-2*(i+0.5)/16, rr=Math.sqrt(1-y*y), a=i*2.39996; put(Math.cos(a)*rr*0.09,1.5+y*0.11,0.07+Math.sin(a)*rr*0.09,Math.cos(a)*rr,y,Math.sin(a)*rr,'skin','head'); }
  lit(0.035,1.52,0.16,'*',S*0.8,3.4,COL.gold,'head'); lit(-0.035,1.52,0.16,'*',S*0.8,3.4,COL.gold,'head');
  for(let k=0;k<5;k++){ const a=(k/4-0.5)*1.4; stroke([Math.sin(a)*0.09,1.6,0.07+Math.cos(a)*0.05],[Math.sin(a)*0.06,1.78+0.08*(k===2),0.06],COL.gold,2.0,S*0.9,'head',0.06); }
  lit(0,1.92,0.06,'*',S*1.4,3.6,COL.teal,'head');
  // 4. the hood: a broad fan behind the neck with glowing eye patterns
  for(let y=1.22;y<1.78;y+=0.07){ const f=(y-1.22)/0.56, w=0.12+0.34*Math.sin(Math.PI*Math.min(1,f*1.15)); const n=Math.round(w*2/0.075);
    for(let k=0;k<=n;k++){ const x=-w+k*(2*w/n), z=-0.06-0.1*(x/w)*(x/w); put(x,y,z,x*0.8,0.2,0.6,'jade','head'); } }
  for(const [x,y] of [[0.24,1.52],[-0.24,1.52],[0.3,1.38],[-0.3,1.38],[0.17,1.65],[-0.17,1.65]]){ lit(x,y,-0.02,'O',S*1.2,3.0,COL.teal,'head'); lit(x,y,-0.01,'.',S*0.6,3.6,[1,1,1],'head'); }
  // 5. four arms: two curved blades, a mirror, an open hand
  const arm=(a,b,c)=>{ stroke(a,b,COL.skin,1.2,S,'body',0.08); stroke(b,c,COL.skin,1.2,S,'body',0.08); lit(b[0],b[1],b[2],'o',S,1.4,COL.skin,'body'); lit(c[0],c[1],c[2],'o',S*1.1,2.0,COL.gold,'body'); };
  arm([0.2,1.33,0.05],[0.42,1.5,0.12],[0.5,1.74,0.16]);
  for(let t=0;t<=1;t+=0.08){ const a=t*1.6; lit(0.5+Math.sin(a)*0.18,1.78+t*0.5,0.16+(1-Math.cos(a))*0.08,t<0.5?'|':'/',S,2.0,COL.steel,'body'); }
  arm([-0.2,1.33,0.05],[-0.45,1.26,0.15],[-0.64,1.3,0.32]);
  for(let t=0;t<=1;t+=0.08){ const a=t*1.6; lit(-0.64-Math.sin(a)*0.12,1.3+Math.sin(a)*0.18,0.32+t*0.42,t<0.6?'-':'\\',S,2.0,COL.steel,'body'); }
  arm([0.18,1.2,0.06],[0.34,1.05,0.2],[0.38,1.0,0.36]);
  for(let k=0;k<12;k++){ const a=k/12*Math.PI*2; lit(0.38+Math.cos(a)*0.12,1.08+Math.sin(a)*0.12,0.42,'=',S*0.9,1.8,COL.gold,'body'); } lit(0.38,1.08,0.43,'*',S*1.3,3.0,COL.mirror,'body');
  arm([-0.18,1.2,0.06],[-0.3,1.1,0.3],[-0.28,1.06,0.55]);
  for(let f=0;f<4;f++)lit(-0.28+(f-1.5)*0.03,1.06,0.62,'\'',S*0.8,1.3,COL.skin,'body');
  return pts;
}
// her floor: ripples of water, small snakes, a hiss close by
function nagaAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>30)return;
  for(let r=1.1;r<2.4;r+=0.45){ const n=Math.round(r*16); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.1*(r>1.6?-1:1); dyn(m.x+Math.cos(a)*r*sc,0.04+0.02*Math.sin(t*2+k),m.z+Math.sin(a)*r*sc,G('~'),0.12,0.2,0.5,0.55); } }
  for(let k=0;k<4;k++){ const a=t*(0.4+k*0.11)+k*1.6, r=(1.3+0.5*Math.sin(t*0.6+k))*sc; for(let q=0;q<4;q++){ const aa=a-q*0.06; dyn(m.x+Math.cos(aa)*r,0.08,m.z+Math.sin(aa)*r,G(q?'~':'n'),0.15,0.4,0.85,0.45); } }
  if(dp<12&&time>(m.hissT||0)&&sndReady()){ m.hissT=time+4+mr()*3; const t0=SND.ctx.currentTime; sEnv(sNoise(t0,0.9,'highpass',3000,0.7,sOut(m.x,m.z,0.18)),t0,0.15,0.7); } }

// ---------------------------------------------------------------- the Old Dragon: asleep on its hoard, a low mound of a body, a long arched neck with a horned head on the floor,
// wings folded like torn sails, a spine of jagged plates grown over with moss and crystal, scars, embers between the teeth; readable glyphs (0.08 body units = about 0.29 m at its size)
function oldDragonForm(){
  const pts=[], LD=[0.42,0.72,0.55], S=0.08;
  const COL={scale:[0.78,0.38,0.24], plate:[0.62,0.5,0.42], moss:[0.45,0.8,0.35], crystal:[0.55,0.95,1.0], horn:[0.86,0.8,0.66], wing:[0.55,0.24,0.2], scar:[0.95,0.3,0.22], ember:[1.0,0.55,0.18]};
  const RAMP={scale:['.',':','=','%','#'], wing:['.',':','%','%','#']};
  const put=(x,y,z,nx,ny,nz,mat,part,s)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=RAMP[mat];
    pts.push({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:s||S,b:0.45+0.95*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col:COL[mat]}); };
  const lit=(x,y,z,ch,s,b,col,part)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col});
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,step)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(step||0.07))), ch=strokeCh(dx,dy);
    for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part); } };
  const tube=(path,r0,r1,mat,part,step)=>{ for(let i=0;i<path.length-1;i++){ const a=path[i], b=path[i+1], f=i/(path.length-1), r=r0+(r1-r0)*f;
      const tx=b[0]-a[0], ty=b[1]-a[1], tz=b[2]-a[2], tl=Math.hypot(tx,ty,tz)||1; let px=-tz/tl, pz=tx/tl, py=0; if(Math.hypot(px,pz)<0.1){ px=1; pz=0; }
      const qx=(ty/tl)*pz-(tz/tl)*py, qy=(tz/tl)*px-(tx/tl)*pz, qz=(tx/tl)*py-(ty/tl)*px, n=Math.max(5,Math.round(2*Math.PI*r/(step||0.1)));
      if(i%2&&r<0.12)continue;
      for(let k=0;k<n;k++){ const an=k/n*Math.PI*2+i*0.5, ox=Math.cos(an)*px+Math.sin(an)*qx, oy=Math.cos(an)*py+Math.sin(an)*qy, oz=Math.cos(an)*pz+Math.sin(an)*qz; if(a[1]+oy*r<0.02)continue;
        put(a[0]+ox*r,a[1]+oy*r,a[2]+oz*r,ox,oy,oz,mat,part); } } };
  const curve=(p0,p1,p2,n)=>{ const out=[]; for(let i=0;i<=n;i++){ const t=i/n, a=(1-t)*(1-t), b=2*(1-t)*t, c=t*t; out.push([a*p0[0]+b*p1[0]+c*p2[0],a*p0[1]+b*p1[1]+c*p2[1],a*p0[2]+b*p1[2]+c*p2[2]]); } return out; };
  // 1. the mound of the body
  for(let v=0.15;v<=Math.PI*0.62;v+=0.1/0.55){ const sv=Math.sin(v), cv=Math.cos(v), n=Math.max(6,Math.round(2*Math.PI*0.8*sv/0.1));
    for(let k=0;k<n;k++){ const u=k/n*Math.PI*2+v, nx=Math.cos(u)*sv, ny=cv, nz=Math.sin(u)*sv; put(nx*0.55,0.4+ny*0.4,nz*0.8,nx/0.55,ny/0.4,nz/0.8,'scale','body'); } }
  for(let k=0;k<4;k++){ const z=-0.25+k*0.14; stroke([0.52,0.42+k*0.03,z],[0.5,0.32+k*0.03,z+0.12],COL.scar,1.8,S,'body',0.05); }
  // 2. the spine's jagged plates, moss and crystal
  for(let t=0;t<=1;t+=0.06){ const z=0.72-t*1.5, y=0.8-0.25*t*t+0.02*Math.sin(t*20), h=0.1+0.08*Math.abs(Math.sin(t*9));
    stroke([0,y,z],[0,y+h,z-0.04],COL.plate,1.4,S,'body',0.05); lit(0,y+h+0.03,z-0.05,'^',S*1.1,1.6,COL.plate,'body');
    if(Math.sin(t*13)>0.3)lit((mr()-0.5)*0.12,y+0.03,z+0.04,mpick([',','"']),S,1.3,COL.moss,'body');
    if(Math.sin(t*7+1)>0.75)lit(0.06*(mr()<0.5?1:-1),y+0.05,z,mpick(['*','<','>']),S*1.2,2.6,COL.crystal,'body'); }
  // 3. the neck arching forward, the head lying on the floor
  tube(curve([0,0.62,0.68],[0.05,1.05,1.05],[0.25,0.2,1.5],12),0.17,0.12,'scale','body');
  tube(curve([0.25,0.2,1.5],[0.3,0.2,1.75],[0.36,0.12,2.02],6),0.13,0.06,'scale','head');
  for(const sd of [1,-1])for(let k=0;k<2;k++){ const b0=[0.25+sd*(0.06+k*0.04),0.3,1.58-k*0.06]; stroke(b0,[0.25+sd*(0.22+k*0.08),0.58-k*0.12,1.18-k*0.1],COL.horn,1.5,S*1.1,'head',0.05); }
  for(const sd of [1,-1])stroke([0.25+sd*0.09,0.27,1.72],[0.25+sd*0.11,0.27,1.82],[0.5,0.3,0.2],1.0,S*0.9,'head',0.04);
  // embers between the teeth
  for(let k=0;k<7;k++)lit(0.33+(mr()-0.5)*0.06,0.12+mr()*0.04,1.88+k*0.02,mpick(['*','\'','.']),S*(1+mr()*0.5),3.2+mr(),COL.ember,'head');
  for(let k=0;k<8;k++)lit(0.35+(k%2?0.05:-0.05),0.1,1.82+k*0.025,'v',S*0.8,1.2,COL.horn,'head');
  // 4. wings folded like torn sails
  for(const sd of [1,-1]){ const sh=[sd*0.42,0.72,0.42], wr=[sd*0.72,1.3,-0.12], tip=[sd*0.68,0.32,-1.0];
    stroke(sh,wr,COL.horn,1.3,S*1.1,'body',0.05); stroke(wr,tip,COL.horn,1.2,S,'body',0.06);
    for(let f=0;f<3;f++){ const e=[sd*(0.64-f*0.04),0.3+f*0.04,0.1-f*0.35]; stroke(wr,e,COL.horn,1.0,S*0.9,'body',0.07);
      for(let q=0;q<18;q++){ const u=mr(), v=mr(); if(mr()<0.22)continue; const nxt=f<2?[sd*(0.64-(f+1)*0.04),0.3+(f+1)*0.04,0.1-(f+1)*0.35]:tip;
        const x=wr[0]+(e[0]-wr[0])*u+(nxt[0]-e[0])*u*v, y=wr[1]+(e[1]-wr[1])*u+(nxt[1]-e[1])*u*v, z=wr[2]+(e[2]-wr[2])*u+(nxt[2]-e[2])*u*v; put(x,y,z,sd,0.2,0,'wing','body'); } } }
  // 5. the tail curling round to the front, spiked
  const tail=curve([0,0.3,-0.75],[-1.2,0.1,-0.3],[-0.7,0.06,0.95],18); tube(tail,0.18,0.04,'scale','body');
  for(let i=0;i<tail.length;i+=2)lit(tail[i][0],tail[i][1]+0.18*(1-i/tail.length)+0.04,tail[i][2],'^',S,1.4,COL.plate,'body');
  // 6. forelegs and claws beside the head
  for(const sd of [1,-1]){ const a=[sd*0.35,0.35,0.55], b=[sd*0.45,0.1,0.9]; tube([a,b],0.09,0.07,'scale','body'); for(let c=0;c<3;c++)stroke([b[0]+(c-1)*0.05,0.06,b[2]+0.05],[b[0]+(c-1)*0.07,0.02,b[2]+0.15],COL.horn,1.3,S*0.9,'body',0.04); }
  return pts;
}
// its hoard and its breath: coins, cups and chests around and beneath; smoke from the nostrils now and then
function dragonAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>36)return;
  if(!m.hoard){ m.hoard=[]; for(let k=0;k<70;k++){ const a=mr()*6.28, r=(0.4+mr()*0.9)*sc; m.hoard.push({x:m.x+Math.cos(a)*r,z:m.z+Math.sin(a)*r,y:0.05+mr()*0.15,ch:mpick(['$','o','$','o','U','#','*'])}); } }
  for(const h of m.hoard)dyn(h.x,h.y,h.z,G(h.ch),0.2,h.ch==='*'?1.6:1.1,h.ch==='*'?1.4:0.85,h.ch==='*'?0.9:0.3);
  if(mr()<0.05){ const cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), lx=0.36*sc, lz=2.0*sc; spawn(m.x+lx*cy+lz*sy,m.y+0.25*sc,m.z-lx*sy+lz*cy,(mr()-0.5)*0.2,0.5,(mr()-0.5)*0.2,2.4,G('~'),0.3,0.35,0.32,0.3,0); } }

// ---------------------------------------------------------------- the Last King's Shadow: a king made of darkness, dark inside, only its edges thin and white like cut paper;
// a crown of broken light floating above a hollow face with one cold light, six arms of shadow reaching out, its hem dissolving into streams that run to the pedestals
// streams of shadow running from its hem across the floor to the pedestals; dark mist
function shadowAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>40)return;
  if(!m.phase2&&m.maxHp&&m.hp/m.maxHp<0.95&&mr()<(1-m.hp/m.maxHp)*0.6){ const a=mr()*6.28, y=(0.4+mr()*1.4)*sc; spawn(m.x+Math.cos(a)*0.55*sc,y,m.z+Math.sin(a)*0.45*sc,Math.cos(a)*0.4,0.3,Math.sin(a)*0.4,1.4,G(mpick(['.','+','*'])),0.14,1.4,1.5,2.2,0); }
  const targets=(finalSt&&finalSt.peds&&isFinal())?finalSt.peds.map(p=>cpos(p.i)):[0,1,2].map(k=>{ const a=k/3*Math.PI*2+0.5; return [m.x+Math.cos(a)*4.5*sc,m.z+Math.sin(a)*4.5*sc]; });
  for(const [tx,tz] of targets){ const dx=tx-m.x, dz=tz-m.z, L=Math.hypot(dx,dz)||1, ux=dx/L, uz=dz/L, n=Math.round(L/0.35);
    for(let k=2;k<n;k++){ const f=k/n, w=Math.sin(f*9-t*2.2)*0.22, x=m.x+dx*f-uz*w, z=m.z+dz*f+ux*w, edge=(k+Math.floor(t*6))%5===0;
      dyn(x,0.05,z,G(edge?'.':'~'),0.2,edge?0.75:0.24,edge?0.72:0.16,edge?0.95:0.4); } }
  if(mr()<0.2){ const a=mr()*6.28, r=mr()*0.9*sc; spawn(m.x+Math.cos(a)*r,0.2,m.z+Math.sin(a)*r,Math.cos(a)*0.2,0.25,Math.sin(a)*0.2,2.6,G(mpick(['~','%'])),0.26,0.16,0.1,0.26,0); } }

function shadowKingForm(){
  // the first form, kept simple: a king's cloak and wings, a crown of light, one cold eye, the heart; the dark held inside this shape like a seal.
  // cracks of cold light (part 'crack', each with a health threshold) open as it weakens, letting the starry dark show through
  const pts=[], S=0.08;
  const EDGE=[0.88,0.84,1.0], DARK=[0.26,0.18,0.42], SHARD=[0.92,0.9,1.0], EYE=[0.75,0.92,1.0], HEART=[1.0,0.86,0.55], CRACK=[0.8,0.9,1.0], STAR=[0.7,0.72,1.0];
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,step)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(step||0.1))), ch=strokeCh(dx,dy);
    for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part); } };
  const skin=(x,y,z,nx,nz,part,slope)=>{ const rim=1-Math.abs(nz)/(Math.hypot(nx,nz)||1);
    if(rim>0.72)lit(x,y,z,slope>0.35?'/':slope<-0.35?'\\':'|',S,1.6+1.2*rim,EDGE,part); else if(mr()<0.6)lit(x,y,z,mpick(['%',':','.']),S,0.3+0.2*rim,DARK,part); };
  const prof=y=>y<1.0?0.92-0.47*Math.pow(y/1.0,0.8):y<1.78?0.45+0.27*Math.sin((y-1.0)/0.78*Math.PI/2):0.72-0.52*Math.min(1,(y-1.78)/0.18);
  for(let y=0.04;y<1.96;y+=0.12){ const r=prof(y), slope=(prof(y+0.05)-prof(y-0.05))/0.1, n=Math.max(8,Math.round(2*Math.PI*r/0.13));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+y*2, nx=Math.cos(a), nz=Math.sin(a); if(y<0.25&&mr()<0.4){ lit(nx*r*(1+mr()*0.3),0.03,nz*r*(1+mr()*0.3),'~',S,0.6,DARK,'robe'); continue; } skin(nx*r,y,nz*r*0.8,nx,nz,y<1.0?'robe':'body',nx>0?-slope:slope); } }
  // wings: two finger bones each, edges bright
  for(const sd of [1,-1]){ const root=[sd*0.45,1.75,-0.25], top=[sd*1.35,2.65,-0.55], far=[sd*2.1,1.95,-0.6];
    stroke(root,top,EDGE,1.9,S,'wing2',0.1); stroke(top,far,EDGE,1.8,S,'wing2',0.1);
    const lows=[[sd*1.0,0.7,-0.45],[sd*1.7,1.05,-0.5]]; for(const e of lows){ stroke(top,e,[0.66,0.6,0.86],1.2,S*0.9,'wing2',0.12); lit(e[0],e[1]-0.06,e[2],'\'',S,1.4,EDGE,'wing2'); }
    for(let q=0;q<26;q++){ const u=mr(), v=mr()*(1-u), A=top, B=lows[0], C=far; if(mr()<0.3)continue; lit(A[0]+(B[0]-A[0])*u+(C[0]-A[0])*v,A[1]+(B[1]-A[1])*u+(C[1]-A[1])*v,A[2]-0.03,mpick([':','.','%']),S,0.32,DARK,'wing2'); } }
  for(const sd of [1,-1])for(let k=0;k<2;k++){ const b=[sd*(0.62+k*0.1),1.8,(k-0.5)*0.16], tp=[sd*(0.74+k*0.12),2.02,(k-0.5)*0.2]; stroke(b,tp,EDGE,1.8,S*0.85,'body',0.08); }
  // the hollow head, one cold eye
  for(let i=0;i<34;i++){ const y=1-2*(i+0.5)/34, rr=Math.sqrt(1-y*y), a=i*2.39996, nx=Math.cos(a)*rr, nz=Math.sin(a)*rr; skin(nx*0.22,2.16+y*0.24,nz*0.2,nx,nz,'head',0); }
  lit(0,2.16,0.12,'*',S*2.2,4.4,EYE,'eye');
  // the crown: one ring of broken light and a spire
  for(let k=0;k<11;k++)lit(0,2.64+0.05*Math.sin(k*2),0,mpick(['/','\\','<','>','|']),S*1.3,3.4,SHARD,'orbit',{r:0.38,sp:0.4,ph:k/11*Math.PI*2});
  for(let k=0;k<6;k++)lit((mr()-0.5)*0.04,2.8+k*0.07,0,k===5?'^':'|',S*1.2,3.6-k*0.1,SHARD,'head');
  // the heart (seen in the light)
  lit(0,1.55,0.08,'*',S*2.6,4.0,HEART,'heart'); for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; lit(Math.cos(a)*0.1,1.55+Math.sin(a)*0.1,0.1,'+',S*0.9,2.4,HEART,'heart'); }
  // cracks of the seal: each opens below its threshold of health, with the starry dark behind it
  for(let c=0;c<7;c++){ const th=0.95-c*0.06; let a=mr()*Math.PI*2*0.8-0.4*Math.PI+Math.PI/2, y=0.3+mr()*1.4;
    for(let k=0;k<9;k++){ const r=prof(y)+0.01, x=Math.cos(a)*r, z=Math.sin(a)*r*0.8; const na=a+(mr()-0.5)*0.35, ny=y+0.07+(mr()-0.3)*0.06, dx=Math.cos(na)*r-x, dy=ny-y;
      lit(x,y,z,strokeCh(dx,dy),S*1.05,3.0,CRACK,'crack',{th}); if(k%3===1)lit(x*0.92,y,z*0.92,mpick(['.','+']),S*0.8,2.2,STAR,'crack',{th}); a=na; y=ny; } }
  return pts;
}
// the second form: the seal broken. The cloak twisted into a long body, the wing bones grown into two great arms with torn membrane hanging,
// the crown's shards grown into horns, the same single eye in a hollow skull with an open jaw; the starry dark and the trapped faces of the kings inside;
// top-heavy (the chest the thickest), flared ribs, muscle bands, great back fins, a thick double coil on the floor, leaning hard forward; the heart in the chest with light running down the belly
function shadowSerpentForm(){
  const pts=[], S=0.08;
  const EDGE=[0.88,0.84,1.0], DARK=[0.26,0.18,0.42], BELLY=[0.62,0.5,0.3], LIGHT=[1.0,0.86,0.5], SHARD=[0.92,0.9,1.0], EYE=[0.75,0.92,1.0], STAR=[0.7,0.72,1.0], MASK=[0.72,0.68,0.82], HEART=[1.0,0.86,0.55];
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'serp',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,step)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(step||0.1))), ch=strokeCh(dx,dy);
    for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part); } };
  const thick=(a,b,w,col,bri,part)=>{ for(const o of [-1,0,1])stroke([a[0]+o*w,a[1]+o*w*0.6,a[2]],[b[0]+o*w*0.8,b[1]+o*w*0.5,b[2]],col,o?bri*0.75:bri,S,part,0.09); };
  const spline=(ctrl,step)=>{ const out=[]; for(let i=0;i<ctrl.length-1;i++)for(let t=0;t<1;t+=step){ const a=ctrl[Math.max(0,i-1)], b=ctrl[i], c=ctrl[i+1], d=ctrl[Math.min(ctrl.length-1,i+2)], t2=t*t, t3=t2*t;
      out.push([0,1,2].map(k=>0.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3))); } out.push(ctrl[ctrl.length-1]); return out; };
  // the body: a thick double coil on the floor, rising in an S, thickest at the chest, leaning hard forward
  const path=spline([[0.7,0.2,-0.9],[1.0,0.22,0.1],[0.2,0.24,0.75],[-0.7,0.3,0.2],[-0.45,0.75,-0.45],[0.15,1.35,-0.55],[0.35,1.95,-0.2],[0.15,2.45,0.3],[0.0,2.7,0.85]],0.1);
  const rad=f=>f<0.45?0.3:f<0.82?0.3+0.24*Math.sin((f-0.45)/0.37*Math.PI/2):0.54-0.3*(f-0.82)/0.18;
  for(let i=0;i<path.length-1;i++){ const a=path[i], b=path[i+1], f=i/(path.length-1), r=rad(f); if(f>0.86)break;
    const tx=b[0]-a[0], ty=b[1]-a[1], tz=b[2]-a[2], tl=Math.hypot(tx,ty,tz)||1; let px=-tz/tl, pz=tx/tl, py=0; if(Math.hypot(px,pz)<0.1){ px=1; pz=0; } const pl=Math.hypot(px,pz); px/=pl; pz/=pl;
    const qx=(ty/tl)*pz-(tz/tl)*py, qy=(tz/tl)*px-(tx/tl)*pz, qz=(tx/tl)*py-(ty/tl)*px; const n=Math.max(8,Math.round(2*Math.PI*r/0.15));
    for(let k=0;k<n;k++){ const an=k/n*Math.PI*2+i*0.3, ox=Math.cos(an)*px+Math.sin(an)*qx, oy=Math.cos(an)*py+Math.sin(an)*qy, oz=Math.cos(an)*pz+Math.sin(an)*qz;
      const x=a[0]+ox*r, y=a[1]+oy*r, z=a[2]+oz*r; if(y<0.02)continue; const belly=Math.cos(an)<-0.55, rim=1-Math.abs(oz);
      if(belly){ lit(x,y,z,i%2?'=':'-',S,0.75,BELLY,'serp'); if(i%2&&f>0.35)lit(x,y,z,'=',S*1.05,3.0,LIGHT,'heart'); }
      else if(rim>0.74)lit(x,y,z,Math.abs(oy)>0.6?'-':'|',S,1.7+1.2*rim,EDGE,'serp'); else if(mr()<0.6)lit(x,y,z,mpick(['%',':','.']),S,0.32+0.25*rim,DARK,'serp');
      // great back fins and muscle bands
      if(!belly&&Math.cos(an)>0.95&&f>0.15){ const h=(0.2+0.34*Math.sin(f*Math.PI))*(i%2?0.55:1); for(let q=1;q<=4;q++){ const bend=q*q*0.012; lit(x+ox*h*q/4,y+oy*h*q/4-bend,z+oz*h*q/4-bend*2,q===4?'^':'|',S*(q===4?1.25:1.05),i%2?1.1:2.0,i%2?[0.55,0.5,0.72]:EDGE,'serp'); } }
      if(f>0.6&&f<0.88&&i%3===0&&Math.abs(Math.cos(an)-0.3)<0.12)lit(x,y,z,'(',S,1.6,EDGE,'serp'); }
    // the starry dark inside
    if(i%2===0&&f>0.3)for(let q=0;q<1;q++){ const rr=r*0.55*Math.sqrt(mr()), an=mr()*6.28; lit(a[0]+Math.cos(an)*px*rr+Math.sin(an)*qx*rr,a[1]+Math.sin(an)*qy*rr,a[2]+Math.cos(an)*pz*rr+Math.sin(an)*qz*rr,mr()<0.8?'.':'+',S*0.8,1.6+mr(),STAR,'serp'); } }
  // the chest: flared ribs and the heart, kept low so the face has room
  const C=path[Math.floor(0.8*(path.length-1))];
  for(let r=0;r<4;r++){ const y=C[1]-0.42+r*0.1; for(const sd of [1,-1]){ stroke([C[0]+sd*0.08,y,C[2]+0.42],[C[0]+sd*0.42,y-0.08,C[2]+0.22],EDGE,1.8,S*0.9,'serp',0.07); } }
  const HC=[C[0],C[1]-0.28,C[2]+0.44]; lit(HC[0],HC[1],HC[2],'*',S*3,4.2,HEART,'heart'); for(let k=0;k<10;k++){ const a=k/10*Math.PI*2; lit(HC[0]+Math.cos(a)*0.13,HC[1]+Math.sin(a)*0.13,HC[2]+0.02,'+',S,2.6,HEART,'heart'); }
  // the trapped faces of the kings
  for(let k=0;k<5;k++){ const p=path[Math.floor((0.38+k*0.08)*(path.length-1))], sd=k%2?1:-1; lit(p[0]+sd*0.08,p[1]+0.05,p[2]+0.1,'(',S*1.3,1.1,MASK,'serp'); lit(p[0]+sd*0.08+0.12,p[1]+0.05,p[2]+0.1,')',S*1.3,1.1,MASK,'serp');
    lit(p[0]+sd*0.08+0.04,p[1]+0.08,p[2]+0.12,'.',S,2.2,EYE,'serp'); lit(p[0]+sd*0.08+0.08,p[1]+0.08,p[2]+0.12,'.',S,2.2,EYE,'serp'); }
  // massive shoulders, set wide, with great spikes
  for(const sd of [1,-1]){ const SH=[C[0]+sd*0.72,C[1]+0.18,C[2]-0.05];
    for(let i=0;i<22;i++){ const y=1-2*(i+0.5)/22, rr=Math.sqrt(1-y*y), a=i*2.39996, nx=Math.cos(a)*rr, nz=Math.sin(a)*rr; if(y<-0.4)continue; const rim=Math.abs(nx);
      lit(SH[0]+nx*0.26,SH[1]+y*0.2,SH[2]+nz*0.24,rim>0.7||y>0.75?'-':mpick(['%',':']),S,rim>0.7||y>0.75?1.9:0.4,rim>0.7||y>0.75?EDGE:DARK,'serp'); }
    for(let k=0;k<3;k++){ const b0=[SH[0]+sd*(0.05+k*0.08),SH[1]+0.18,SH[2]-0.1+k*0.08]; stroke(b0,[b0[0]+sd*(0.14+k*0.04),b0[1]+0.34-k*0.06,b0[2]-0.12],EDGE,2.2,S*1.05,'serp',0.07); lit(b0[0]+sd*(0.14+k*0.04),b0[1]+0.4-k*0.06,b0[2]-0.12,'^',S*1.3,2.8,EDGE,'serp'); } }
  // four thick arms: the upper pair raised and brought forward, the lower pair with elbows out, forearms forward and slightly up, hands at chest height reaching for you
  const limb=(a,b,r0,r1)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), ux=dx/L, uy=dy/L, uz=dz/L; let px=-uz, py=0, pz=ux; if(Math.hypot(px,pz)<0.1){ px=1; pz=0; } const pl=Math.hypot(px,pz); px/=pl; pz/=pl;
    const qx=uy*pz-uz*py, qy=uz*px-ux*pz, qz=ux*py-uy*px; for(let t=0;t<=L;t+=0.13){ const f=t/L, r=r0+(r1-r0)*f, n=Math.max(6,Math.round(2*Math.PI*r/0.13));
      for(let k=0;k<n;k++){ const an=k/n*Math.PI*2+t*3, ox=Math.cos(an)*px+Math.sin(an)*qx, oy=Math.cos(an)*py+Math.sin(an)*qy, oz=Math.cos(an)*pz+Math.sin(an)*qz, rim=1-Math.abs(oz);
        lit(a[0]+ux*t+ox*r,a[1]+uy*t+oy*r,a[2]+uz*t+oz*r,rim>0.7?(Math.abs(uy)>0.6?'|':'-'):mpick(['%',':','=']),S,rim>0.7?1.8:0.5,rim>0.7?EDGE:DARK,'serp'); } } };
  const hand=(w,dir,sd)=>{ for(let i=0;i<14;i++){ const a=i*2.39996, y=1-2*(i+0.5)/14, rr=Math.sqrt(1-y*y); lit(w[0]+Math.cos(a)*rr*0.14,w[1]+y*0.11,w[2]+Math.sin(a)*rr*0.14,mpick(['%','#']),S,0.9,EDGE,'serp'); }
    for(let c=0;c<4;c++){ const spread=(c-1.5)*0.13, base=[w[0]+dir[0]*0.1-sd*0.0,w[1]+spread+dir[1]*0.1,w[2]+dir[2]*0.1]; let prev=base;
      for(let q=1;q<=5;q++){ const f=q/5, curl=f*f*0.2, nxt=[base[0]+dir[0]*0.44*f-sd*curl*0.6,base[1]+dir[1]*0.44*f-spread*f*0.4-curl*0.3,base[2]+dir[2]*0.44*f-curl*0.35];
        lit(nxt[0],nxt[1],nxt[2],q===5?'>':strokeCh(nxt[0]-prev[0],nxt[1]-prev[1]),S*(q===5?1.1:1.05),q>3?2.8:2.0,q>3?[0.95,0.9,0.85]:EDGE,'claw',{hx:w[0],hy:w[1],hz:w[2],cf:f}); prev=nxt; } } };
  const armSpikes=(a,b,sd)=>{ for(let k=1;k<=3;k++){ const f=k/4, p=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]; stroke([p[0]+sd*0.08,p[1]+0.06,p[2]-0.04],[p[0]+sd*0.28,p[1]+0.16,p[2]-0.18],EDGE,2.1,S,'serp',0.06); lit(p[0]+sd*0.3,p[1]+0.18,p[2]-0.2,'^',S*1.1,2.6,EDGE,'serp'); } };
  for(const sd of [1,-1]){
    const s0=[C[0]+sd*0.82,C[1]+0.26,C[2]], e0=[C[0]+sd*1.35,C[1]+0.7,C[2]+0.2], w0=[C[0]+sd*1.0,C[1]+1.1,C[2]+0.72];
    limb(s0,e0,0.15,0.13); limb(e0,w0,0.13,0.1); armSpikes(e0,w0,sd); stroke([e0[0]+sd*0.1,e0[1],e0[2]-0.05],[e0[0]+sd*0.34,e0[1]-0.12,e0[2]-0.2],EDGE,2.2,S*1.05,'serp',0.06);
    hand(w0,[-sd*0.45,0.2,0.85],sd);
    const s1=[C[0]+sd*0.7,C[1]-0.05,C[2]+0.1], e1=[C[0]+sd*1.25,C[1]-0.12,C[2]+0.15], w1=[C[0]+sd*0.82,C[1]+0.12,C[2]+1.05];
    limb(s1,e1,0.14,0.13); limb(e1,w1,0.13,0.1); armSpikes(e1,w1,sd); stroke([e1[0]+sd*0.1,e1[1],e1[2]-0.05],[e1[0]+sd*0.34,e1[1]-0.1,e1[2]-0.22],EDGE,2.2,S*1.05,'serp',0.06);
    hand(w1,[-sd*0.35,0.05,0.95],sd);
    for(let q=0;q<12;q++){ const u=mr(); lit(s0[0]+(e0[0]-s0[0])*u,s0[1]+(e0[1]-s0[1])*u-0.12-mr()*0.5,s0[2]+(e0[2]-s0[2])*u-0.08,mpick([':','%','.']),S,0.35,DARK,'serp'); } }
  // the head: a crowned skull-helm (the first form's crown became this helm) - riveted dark bronze plates, deep sockets with small cold points of light,
  // a heavy jaw thrust forward with uneven fangs and tusks, chains hanging from it, and two great horns rising from the helm and curving up and out
  const H=[C[0],C[1]+0.36,C[2]+0.58], BONE=[0.88,0.84,0.76], BRZ=[0.78,0.6,0.36], DBRZ=[0.42,0.32,0.22];
  for(let i=0;i<70;i++){ const y=1-2*(i+0.5)/70, rr=Math.sqrt(1-y*y), a=i*2.39996, nx=Math.cos(a)*rr, nz=Math.sin(a)*rr; if(nz<-0.2||y<-0.45)continue;
    const ex=Math.abs(Math.abs(nx)-0.36), sock=ex<0.17&&Math.abs(y-0.02)<0.17&&nz>0.5; if(sock)continue;
    const d=clamp(0.2+0.8*Math.max(0,nx*0.42+y*0.72+nz*0.55),0,1), ch=['.',':','=','#','@'][Math.min(4,Math.floor(d*5))];
    lit(H[0]+nx*0.32,H[1]+0.05+y*0.3,H[2]+nz*0.28,Math.abs(nx)>0.85?'|':ch,S,0.45+1.1*d,BRZ,'serp'); }
  for(let k=0;k<=10;k++){ const f=k/10-0.5; lit(H[0]+f*0.56,H[1]+0.18-Math.abs(f)*0.12,H[2]+0.25,'=',S*1.15,1.9,BRZ,'serp'); if(k%2===0)lit(H[0]+f*0.56,H[1]+0.22-Math.abs(f)*0.12,H[2]+0.26,'.',S*0.8,3.0,[1,0.9,0.7],'serp'); }
  for(let k=0;k<5;k++)lit(H[0],H[1]+0.32-k*0.07,H[2]+0.26+k*0.005,k%2?'.':'|',S*(k%2?0.8:1),k%2?3:1.6,k%2?[1,0.9,0.7]:BRZ,'serp');
  for(const sd of [1,-1]){ const ex=H[0]+sd*0.115, ey=H[1]+0.02, ez=H[2]+0.2;
    for(let k=0;k<10;k++){ const a=k/10*Math.PI*2; lit(ex+Math.cos(a)*0.075,ey+Math.sin(a)*0.07,ez+0.02,mpick(['%','#']),S*0.9,0.35,DARK,'serp'); }
    lit(ex,ey,ez-0.04,'.',S*1.2,4.6,EYE,'eye'); lit(ex,ey,ez-0.05,'*',S*0.8,3.2,EYE,'eye'); }
  lit(H[0]-0.03,H[1]-0.1,H[2]+0.24,'/',S,0.9,DARK,'serp'); lit(H[0]+0.03,H[1]-0.1,H[2]+0.24,'\\',S,0.9,DARK,'serp');
  for(let k=0;k<=6;k++){ const f=k/6-0.5; lit(H[0]+f*0.3,H[1]-0.18,H[2]+0.25-Math.abs(f)*0.06,'v',S*(0.9+0.3*((k*7)%3)/2),2.4,BONE,'serp'); }
  for(let k=0;k<=8;k++){ const f=k/8-0.5, x=H[0]+f*0.42, z=H[2]+0.34-f*f*0.5, y=H[1]-0.4; lit(x,y,z,'=',S*1.1,1.6,BONE,'serp'); lit(x,y-0.06,z-0.02,'-',S,1.1,BONE,'serp');
    const big=k%3===1; lit(x,y+0.09+(big?0.05:0),z+0.01,'^',S*(big?1.4:1.0),2.6,BONE,'serp'); if(big)lit(x,y+0.2,z+0.01,'|',S*0.9,2.2,BONE,'serp'); }
  for(const sd of [1,-1]){ stroke([H[0]+sd*0.2,H[1]-0.14,H[2]+0.16],[H[0]+sd*0.22,H[1]-0.4,H[2]+0.28],BONE,1.4,S,'serp',0.07);
    let prev=[H[0]+sd*0.22,H[1]-0.38,H[2]+0.3]; for(let k=1;k<=4;k++){ const f=k/4, nxt=[H[0]+sd*(0.22+0.07*f),H[1]-0.38+0.26*f,H[2]+0.3+0.12*f-0.08*f*f]; lit(nxt[0],nxt[1],nxt[2],k===4?'^':strokeCh(nxt[0]-prev[0],nxt[1]-prev[1]),S*1.1,k===4?2.6:2.0,k===4?BRZ:BONE,'serp'); prev=nxt; }
    for(let k=1;k<=6;k++)lit(H[0]+sd*0.24,H[1]-0.42-k*0.07,H[2]+0.22+Math.sin(k)*0.02,k%2?'o':'.',S*0.85,1.6,BRZ,'serp'); lit(H[0]+sd*0.24,H[1]-0.9,H[2]+0.22,'+',S,2.2,BRZ,'serp'); }
  for(const sd of [1,-1]){ let prev=[H[0]+sd*0.24,H[1]+0.24,H[2]+0.02]; for(let k=1;k<=10;k++){ const f=k/10, nxt=[H[0]+sd*(0.24+0.26*f+0.06*Math.sin(f*Math.PI)),H[1]+0.24+0.95*f-0.18*f*f,H[2]+0.02-0.28*f*f];
      const w=0.075*(1-f*0.85), tip=f>0.8, col=tip?SHARD:(f<0.35?BRZ:DBRZ);
      for(const o of (w>0.04?[-1,0,1]:[0])){ const mx=(prev[0]+nxt[0])/2+o*w, my=(prev[1]+nxt[1])/2, mz=(prev[2]+nxt[2])/2; lit(mx,my,mz,tip?mpick(['/','\\','|']):strokeCh(nxt[0]-prev[0],nxt[1]-prev[1]),S*(o?0.95:1.1),tip?3.4:(o?1.3:1.9),col,'serp'); }
      if(k%3===0&&!tip)lit(nxt[0],nxt[1],nxt[2]+0.02,'-',S,1.5,BRZ,'serp'); prev=nxt; }
    lit(prev[0],prev[1]+0.05,prev[2],'^',S*1.4,4.0,SHARD,'serp'); }
  // the crest, set back from the top of the head down the nape, leaning back, leading into the back fin
  for(let k=0;k<4;k++){ const z=H[2]-0.34-k*0.17, yb=H[1]+0.1-k*0.1, h=0.2+k*0.05; stroke([H[0],yb,z],[H[0],yb+h,z-0.16],EDGE,2.0,S,'serp',0.06); lit(H[0],yb+h+0.04,z-0.19,'^',S*1.2,2.6,EDGE,'serp'); }
  return pts;
}
// the change: the seal breaks; the glyphs of the first form flow into the shape of the second over 2.5 s
function transformShadow(b){
  const R=HIST.rulers, last=R[R.length-1];
  b.phase2=true; b.invulnT=2.5; sRumble(1.0,3.2); shake=Math.max(shake,0.8); flash=Math.max(flash,0.5);
  const sc=b.ty.scale||3;
  for(let q=0;q<60;q++){ const a=mr()*6.28; spawn(b.x+Math.cos(a)*0.3,2.8*sc,b.z+Math.sin(a)*0.3,Math.cos(a)*3,2+mr()*3,Math.sin(a)*3,1.6+mr(),G(mpick(['/','\\','<','>','^'])),0.28,2.6,2.5,3.0,0); }
  for(let q=0;q<70;q++){ const a=mr()*6.28, r=mr()*0.9*sc; spawn(b.x+Math.cos(a)*r,0.5+mr()*1.8*sc,b.z+Math.sin(a)*r,Math.cos(a)*0.6,-0.4-mr(),Math.sin(a)*0.6,2.2,G(mpick(['%','#','~'])),0.3,0.3,0.22,0.5,1); }
  if(sndReady()){ const t0=SND.ctx.currentTime, o=sOut(b.x,b.z,0.3); for(const f of [55,82.5,110,164.8])sEnv(sTone(t0,'sawtooth',f,f*0.97,3.5,o),t0,0.4,3,0.25); }
  const from=b.form.filter(p=>p.part!=='crack'&&p.part!=='heart');
  MTYPES.final2={...b.ty,form:'shadowserpent',sk:'final2',speed:(b.ty.speed||0.8)*1.35,verb:'封印が破れ、底の闇から長い体をもたげた影'};
  b.ty=MTYPES.final2; b.form=buildForm(b.ty); b.morph={from,t0:time,dur:2.5};
  msg(`<b style="color:#a98cff">&amp;</b>王の姿が砕け、封じられていた闇があふれ出した。`);
  setTimeout(()=>msg(`<b style="color:#a98cff">&amp;</b>${last.title}${last.name}の影が、底の闇から長い体をもたげた。`),1500);
}
// drawing the change: each glyph of the second form flies from a glyph of the first
function drawMorph(m,t){ const M=m.morph, f=clamp((time-M.t0)/M.dur,0,1); if(f>=1){ m.morph=null; return false; }
  const e=f<0.5?2*f*f:1-Math.pow(-2*f+2,2)/2, sc=m.ty.scale, cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), F=M.from, n=F.length;
  for(let i=0;i<m.form.length;i++){ const p=m.form[i]; if(p.part==='heart')continue; const q=F[(i*7)%n];
    const lx=(q.x+(p.x-q.x)*e)*sc, ly=(q.y+(p.y-q.y)*e)*sc+Math.sin(f*Math.PI)*0.3*sc*Math.sin(i), lz=(q.z+(p.z-q.z)*e)*sc, col=p.col||m.ty.col, k=(f<0.5?q.b:p.b)*0.62*(0.8+0.6*Math.sin(f*Math.PI));
    dyn(m.x+lx*cy+lz*sy,m.y+ly,m.z-lx*sy+lz*cy,f<0.5?q.g:p.g,(f<0.5?q.s:p.s)*sc,col[0]*k,col[1]*k,col[2]*k,0,0); }
  return true; }

// ---------------------------------------------------------------- the Lord of the Depths (rebuilt): a tall domed head rising from churning water, a ridge down its face,
// many small red eyes in pairs and a diamond eye on the brow, a fringe of short tentacles hanging from the mouth into the water,
// eight tentacles - two rising above the head and hooking over it, two arching out to the sides, two curling up toward you, two behind - suckers on the inside of each curl;
// two broken temple pillars stuck in its back
const KRAKEN_T=[
  [[-0.45,0,0.1],[-0.9,1.2,0.0],[-0.85,2.4,-0.1],[-0.25,2.95,0.1],[0.12,2.65,0.32],[0.02,2.35,0.36]],
  [[0.5,0,0.05],[1.0,1.05,-0.1],[1.1,2.05,-0.2],[0.8,2.65,0.0],[0.45,2.55,0.22],[0.55,2.28,0.32]],
  [[-0.42,0,0.62],[-0.75,0.42,1.3],[-0.62,0.95,1.8],[-0.3,1.12,1.92],[-0.18,0.88,1.78]],
  [[0.38,0,0.66],[0.82,0.32,1.22],[0.96,0.78,1.62],[0.7,1.02,1.76],[0.6,0.82,1.66]]], KRAKEN_W=[0.22,0.22,0.2,0.2];
// tentacles breaking the water at different distances: some arch high, some curl in or out, a few show only their tips
for(let k=0;k<10;k++){ const a=k/10*Math.PI*2+0.3*(k%3)+0.15, r=1.35+0.95*((k*0.618)%1), tipOnly=k%4===3, h=tipOnly?0.35+0.15*((k*0.41)%1):0.6+1.5*((k*0.37+0.2)%1), sd=k%2?1:-1;
  const bx=Math.cos(a)*r, bz=Math.sin(a)*r, tx=-Math.sin(a)*sd, tz=Math.cos(a)*sd, ox=Math.cos(a)*(k%3?1:-1), oz=Math.sin(a)*(k%3?1:-1), L=tipOnly?0.4:1;
  KRAKEN_T.push([[bx,0,bz],[bx+tx*0.15*L,h*0.45,bz+tz*0.15*L],[bx+tx*0.3*L+ox*0.1*L,h*0.9,bz+tz*0.3*L+oz*0.1*L],[bx+tx*0.15*L+ox*0.35*L,h,bz+tz*0.15*L+oz*0.35*L],[bx+ox*0.4*L,h*0.78,bz+oz*0.4*L]]);
  KRAKEN_W.push(tipOnly?0.09:0.13+0.04*((k*0.29)%1)); }
function deepKrakenForm(){
  const pts=[], S=0.08, LD=[0.42,0.72,0.55];
  const COL={skin:[0.36,0.5,0.62], dark:[0.2,0.26,0.36], stone:[0.64,0.66,0.6], moss:[0.42,0.72,0.4], eye:[1.0,0.32,0.24], sucker:[0.7,0.85,0.95], ridge:[0.6,0.72,0.85]};
  const RAMP={skin:['.',':','~','%','#']};
  const put=(x,y,z,nx,ny,nz,part,extra)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=RAMP.skin;
    pts.push(Object.assign({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:S,b:0.45+0.95*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col:COL.skin},extra||{})); };
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const spline=(ctrl,step)=>{ const out=[]; for(let i=0;i<ctrl.length-1;i++)for(let t=0;t<1;t+=step){ const a=ctrl[Math.max(0,i-1)], b=ctrl[i], c=ctrl[i+1], d=ctrl[Math.min(ctrl.length-1,i+2)], t2=t*t, t3=t2*t;
      out.push([0,1,2].map(k=>0.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3))); } out.push(ctrl[ctrl.length-1]); return out; };
  // 1. the head: a neck rising from the water into a tall dome
  // a broad neck at the water, a big bulbous dome leaning a little back
  const hr=y=>y<1.25?0.66-0.06*Math.min(1,y/1.25):0.62*Math.sqrt(Math.max(0,1-Math.pow((y-1.25)/0.95,2)))+0.02, hl=y=>0.14*Math.max(0,y-1.1);
  const fz=y=>hr(y)*0.92-hl(y);
  for(let y=0.05;y<2.22;y+=0.12){ const r=hr(y), n=Math.max(6,Math.round(2*Math.PI*r/0.13));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); if(nz>0.82&&y>0.95&&y<1.75)continue; put(nx*r,y,nz*r*0.92-hl(y),nx,y>1.25?(y-1.25)/0.97:0.15,nz,'head'); } }
  // the face: a ridge down the middle, brow folds, the eyes in pairs, a diamond eye on the brow
  for(let y=1.0;y<2.05;y+=0.08)lit(0,y,fz(y)+0.02,'|',S*1.05,1.7,COL.ridge,'head');
  for(const sd of [1,-1])for(let k=0;k<4;k++){ const y=1.62-k*0.16; lit(sd*0.22,y,fz(y)-0.03,sd>0?'(':')',S*1.1,0.9,COL.dark,'head'); lit(sd*0.36,y-0.04,fz(y)-0.1,sd>0?'(':')',S,0.8,COL.dark,'head'); }
  for(const [y,x] of [[1.38,0.11],[1.24,0.145],[1.1,0.1]])for(const sd of [1,-1]){ lit(sd*x,y,fz(y)-0.01,'(',S*0.9,0.5,COL.dark,'head'); lit(sd*x,y,fz(y)+0.01,'*',S*1.2,4.4,COL.eye,'eye'); }
  lit(-0.03,1.62,fz(1.62)+0.01,'<',S,3.6,COL.eye,'eye'); lit(0.03,1.62,fz(1.62)+0.01,'>',S,3.6,COL.eye,'eye');
  // a fringe of short tentacles from the mouth into the water
  for(let k=0;k<8;k++){ const f=(k/7-0.5), x0=f*0.38, z0=fz(0.95)-Math.abs(f)*0.1; for(let q=0;q<9;q++){ const t=q/8; lit(x0+Math.sin(t*3+k)*0.05,0.95-t*0.85,z0+t*0.12,t>0.85?'~':(q%2?')':'('),S*0.95,1.0,COL.skin,'tent',{piv:q,ti:k+10}); } }
  // 2. two broken temple pillars in its back, moss on them
  for(const [x,z,h,lean] of [[-0.27,-0.52,0.9,-0.25],[0.24,-0.5,0.7,0.2]]){ for(let y=0;y<h;y+=0.1)lit(x+lean*y*0.4,1.4+y,z-y*0.25,'|',S*1.15,1.1,COL.stone,'head'); lit(x+lean*h*0.4,1.4+h,z-h*0.25,mpick(['%','#']),S*1.2,1.1,COL.stone,'head'); lit(x,1.5,z+0.02,mpick([',','"']),S,1.2,COL.moss,'head'); }
  // 3. eight tentacles, suckers on the inside of each curl
  KRAKEN_T.forEach((ctrl,ti)=>{ const P=spline(ctrl,ti<4?0.12:0.15), N=P.length, W0=KRAKEN_W[ti]||0.15;
    for(let i=1;i<N-1;i++){ const a=P[i], f=i/(N-1), w=W0*(1-f*0.84), tx=P[i+1][0]-P[i-1][0], ty=P[i+1][1]-P[i-1][1], tz=P[i+1][2]-P[i-1][2], tl=Math.hypot(tx,ty,tz)||1;
      let cx=P[i+1][0]-2*a[0]+P[i-1][0], cy=P[i+1][1]-2*a[1]+P[i-1][1], cz=P[i+1][2]-2*a[2]+P[i-1][2]; const dot=(cx*tx+cy*ty+cz*tz)/tl; cx-=dot*tx/tl; cy-=dot*ty/tl; cz-=dot*tz/tl; let cl=Math.hypot(cx,cy,cz); if(cl<1e-4){ cx=0; cy=-1; cz=0; cl=1; } cx/=cl; cy/=cl; cz/=cl;
      const bx=(ty*cz-tz*cy)/tl, by=(tz*cx-tx*cz)/tl, bz=(tx*cy-ty*cx)/tl, n=Math.max(5,Math.round(2*Math.PI*w/(ti<4?0.13:0.15)));
      for(let k=0;k<n;k++){ const an=k/n*Math.PI*2, ox=Math.cos(an)*cx+Math.sin(an)*bx, oy=Math.cos(an)*cy+Math.sin(an)*by, oz=Math.cos(an)*cz+Math.sin(an)*bz; if(a[1]+oy*w<0.02)continue;
        if(Math.cos(an)>0.75){ if(i%2===0)lit(a[0]+ox*w,a[1]+oy*w,a[2]+oz*w,'o',S*(0.7+0.5*(1-f)),1.7,COL.sucker,'tent',{piv:i*0.45,ti}); }
        else put(a[0]+ox*w,a[1]+oy*w,a[2]+oz*w,ox,oy,oz,'tent',{piv:i*0.45,ti}); } }
    const e=P[N-1]; lit(e[0],e[1],e[2],'~',S,1.4,COL.skin,'tent',{piv:N*0.45,ti}); });
  return pts;
}
// its water: churning foam round the head and where the tentacles break the surface, rings of waves, the drowned temple's lights
function krakenAura(m,t){ const sc=m.ty.scale||1, dp=Math.hypot(m.x-player.x,m.z-player.z); if(dp>36)return; const cy=Math.cos(m.yaw), sy=Math.sin(m.yaw);
  const at=(lx,lz)=>[m.x+(lx*cy+lz*sy)*sc,m.z+(-lx*sy+lz*cy)*sc];
  for(let q=0;q<26;q++){ const a=q/26*Math.PI*2+t*0.2, r=0.62+0.06*Math.sin(t*3+q), p=at(Math.cos(a)*r,Math.sin(a)*r); dyn(p[0],0.08+0.05*Math.abs(Math.sin(t*2.4+q)),p[1],G(q%3?'~':'^'),0.15,0.75,0.85,0.95); }
  KRAKEN_T.forEach((c,k)=>{ const b=c[0], rr=0.18+0.06*Math.sin(t*1.5+k); for(let q=0;q<9;q++){ const a=q/9*Math.PI*2, p=at(b[0]+Math.cos(a)*rr,b[2]+Math.sin(a)*rr); dyn(p[0],0.07,p[1],G(q%2?'~':'^'),0.13,0.6,0.75,0.85); } });
  for(let k=0;k<3;k++){ const rr=(1.0+k*0.45+0.1*Math.sin(t+k))*sc, n=Math.round(rr*10); for(let q=0;q<n;q++){ const b=q/n*Math.PI*2+t*0.05*(k%2?1:-1); dyn(m.x+Math.cos(b)*rr,0.05,m.z+Math.sin(b)*rr,G('~'),0.13,0.18,0.38,0.5); } }
  if(!m.lamps){ m.lamps=[]; for(let k=0;k<6;k++){ const a=mr()*6.28, r=(2.4+mr()*1.2)*sc; m.lamps.push([m.x+Math.cos(a)*r,m.z+Math.sin(a)*r,mr()*6]); } }
  for(const L of m.lamps){ const b=0.6+0.4*Math.sin(t*0.9+L[2]); dyn(L[0],0.12+0.04*Math.sin(t+L[2]),L[1],G('*'),0.2,1.2*b,0.95*b,0.5*b); }
  if(mr()<0.12){ const c=KRAKEN_T[Math.floor(mr()*KRAKEN_T.length)][0], p=at(c[0],c[2]); for(let q=0;q<6;q++)spawn(p[0],0.1,p[1],(mr()-0.5)*1.2,1+mr()*1.5,(mr()-0.5)*1.2,0.8,G(mpick(['\'','.',','])),0.14,0.7,0.85,0.95,1); } }

// ---------------------------------------------------------------- the ancient machines, each its own body: old brass with light leaking from the seams (readable glyphs; S about 0.28 local)
const BRASS=[0.85,0.68,0.38], BRASS_R=['.','-','=','#','@'];
function mPut(pts,x,y,z,nx,ny,nz,col,ramp,s,part,extra){ const LD=[0.42,0.72,0.55], l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1);
  pts.push(Object.assign({x,y,z,g:G(ramp[Math.min(ramp.length-1,Math.floor(i*ramp.length))]),s,b:0.45+0.95*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{})); }
function mLit(pts,x,y,z,ch,s,b,col,part,extra){ pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{})); }
function cleanerForm(ty){ const pts=[], S=0.28, C=ty.col;
  for(const [y,r] of [[0.1,0.56],[0.22,0.56],[0.32,0.46],[0.42,0.3],[0.5,0.12]]){ const n=Math.max(5,Math.round(2*Math.PI*r/0.3)); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; mPut(pts,Math.cos(a)*r,y,Math.sin(a)*r,Math.cos(a),y>0.3?0.8:0.1,Math.sin(a),BRASS,BRASS_R,S); } }
  for(let k=0;k<14;k++){ const a=k/14*Math.PI*2; mLit(pts,Math.cos(a)*0.57,0.27,Math.sin(a)*0.57,'-',S*0.8,2.2,C); }
  for(const sd of [1,-1])for(let k=0;k<3;k++)mLit(pts,0,0.05,0,k?'x':'*',S*0.9,1.6,[0.9,0.9,0.85],'spin',{cx:sd*0.3,cz:0.32,r:0.1+k*0.05,sp:7*sd,ph:k*2.1});
  for(let k=0;k<4;k++)mLit(pts,(k-1.5)*0.1,0.12,0.58,'=',S*0.8,1.8,C);
  mLit(pts,0,0.44,0.24,'.',S,3.2,C,'eye'); return pts; }
function repairerForm(ty){ const pts=[], S=0.27, C=ty.col;
  for(let i=0;i<30;i++){ const y=1-2*(i+0.5)/30, rr=Math.sqrt(1-y*y), a=i*2.39996; mPut(pts,Math.cos(a)*rr*0.36,0.78+y*0.32,Math.sin(a)*rr*0.36,Math.cos(a)*rr,y,Math.sin(a)*rr,BRASS,BRASS_R,S); }
  for(let k=0;k<5;k++)mLit(pts,(k-2)*0.08,0.84,0.36,'=',S*0.85,2.6,C,'eye');
  for(let k=0;k<12;k++){ const a=k/12*Math.PI*2; mLit(pts,Math.cos(a)*0.37,0.66,Math.sin(a)*0.37,'-',S*0.75,1.9,C); }
  for(const [a,part] of [[Math.PI/2,'legL'],[Math.PI*7/6,'legR'],[-Math.PI/6,'legL']]){ const fx=Math.cos(a)*0.34, fz=Math.sin(a)*0.34; for(let k=0;k<4;k++){ const f=k/3; mLit(pts,fx*(0.5+0.5*f),0.5-0.48*f,fz*(0.5+0.5*f),k===3?'^':'|',S,1.1,BRASS,part,{piv:0.5,pz:fz*0.5}); } }
  const tools=['>','+','=','%'];
  [[0.36,0.84,1,'armR'],[0.34,0.66,1,'armR'],[-0.36,0.84,-1,'armL'],[-0.34,0.66,-1,'armL']].forEach(([x,y,sd,part],j)=>{ const el=[x+sd*0.22,y+0.05,0.18], tp=[x+sd*0.12,y-0.08,0.48];
    for(let k=0;k<=3;k++){ const f=k/3; mLit(pts,x+(el[0]-x)*f,y+(el[1]-y)*f,0.05+(el[2]-0.05)*f,'-',S*0.85,1.2,BRASS,part,{piv:y}); }
    mLit(pts,el[0],el[1],el[2],'o',S*0.9,1.5,BRASS,part,{piv:y}); for(let k=1;k<=3;k++){ const f=k/3; mLit(pts,el[0]+(tp[0]-el[0])*f,el[1]+(tp[1]-el[1])*f,el[2]+(tp[2]-el[2])*f,'/',S*0.85,1.2,BRASS,part,{piv:y}); }
    mLit(pts,tp[0],tp[1],tp[2]+0.05,tools[j],S*1.05,2.6,[0.95,0.95,0.9],part,{piv:y}); });
  for(let k=0;k<8;k++)mLit(pts,(k%3-1)*0.14,0.86+Math.floor(k/3)*0.13,-0.42,'#',S,0.9,[0.6,0.6,0.58]); return pts; }
function watcherForm(ty){ const pts=[], S=0.26, C=ty.col;
  for(const [a,part] of [[Math.PI/2,'legL'],[Math.PI*7/6,'legR'],[-Math.PI/6,'legL']]){ const fx=Math.cos(a)*0.55, fz=Math.sin(a)*0.55, kx=Math.cos(a)*0.32, kz=Math.sin(a)*0.32;
    for(let k=0;k<=4;k++){ const f=k/4; mLit(pts,kx*f,1.3-(1.3-0.75)*f,kz*f,fx>0?'/':'\\',S*0.9,1.1,BRASS,part,{piv:1.3,pz:0}); }
    mLit(pts,kx,0.75,kz,'o',S,1.4,BRASS,part,{piv:1.3}); for(let k=1;k<=4;k++){ const f=k/4; mLit(pts,kx+(fx-kx)*f,0.75-0.73*f,kz+(fz-kz)*f,'|',S*0.9,1.1,BRASS,part,{piv:1.3}); } }
  for(let k=0;k<10;k++){ const a=k/10*Math.PI*2; mLit(pts,Math.cos(a)*0.2,1.3,Math.sin(a)*0.2,'=',S*0.85,1.3,BRASS); }
  for(let i=0;i<34;i++){ const y=1-2*(i+0.5)/34, rr=Math.sqrt(1-y*y), a=i*2.39996, nz=Math.sin(a)*rr; if(nz>0.55)continue; mPut(pts,Math.cos(a)*rr*0.3,1.62+y*0.3,nz*0.3,Math.cos(a)*rr,y,nz,BRASS,BRASS_R,S); }
  for(let k=0;k<12;k++){ const a=k/12*Math.PI*2; mLit(pts,Math.cos(a)*0.2,1.62+Math.sin(a)*0.2,0.25,Math.abs(Math.cos(a))>0.7?'|':'-',S*0.9,1.6,BRASS,'ap',{cx:0,cy:1.62}); mLit(pts,Math.cos(a)*0.13,1.62+Math.sin(a)*0.13,0.28,a<Math.PI?'<':'>',S*0.8,1.8,[0.8,0.6,0.5],'ap',{cx:0,cy:1.62}); }
  mLit(pts,0,1.62,0.3,'@',S*1.5,4.2,C,'eye'); return pts; }
// the hounds' trails: sparks behind the fire hound, frozen breath from the ice hound, afterimages behind the light hound
function houndAura(m,t){ const sc=m.ty.scale||1, mv=m.moving||0, h=m.ty.hound, cy=Math.cos(m.yaw), sy=Math.sin(m.yaw);
  if(Math.hypot(m.x-player.x,m.z-player.z)>26)return;
  if(h==='fire'&&mv>0.3&&mr()<0.12){ const lz=-0.35*sc; spawn(m.x+lz*sy+(mr()-0.5)*0.2,0.06,m.z+lz*cy+(mr()-0.5)*0.2,(mr()-0.5)*0.2,0.4+mr()*0.5,(mr()-0.5)*0.2,0.4,G(mpick(['\'','.'])),0.09,2.6,1.2,0.35,0); }
  if(h==='ice'&&mr()<0.12){ const lz=0.68*sc; const ice=mr()<0.15; spawn(m.x+lz*sy+(mr()-0.5)*0.1,m.y+0.58*sc,m.z+lz*cy+(mr()-0.5)*0.1,sy*0.18,-0.12,cy*0.18,1.6,G(ice?'*':mpick(['~','.'])),ice?0.08:0.18,ice?1.5:0.62,ice?1.8:0.86,ice?2.1:1.2,0); }
  if(h==='light'){ m.ghosts=m.ghosts||[]; if(mv>0.3&&time-(m.ghostT||0)>0.12){ m.ghostT=time; m.ghosts.push({x:m.x,y:m.y,z:m.z,yaw:m.yaw,t:time}); if(m.ghosts.length>3)m.ghosts.shift(); }
    for(const gh of m.ghosts){ const age=time-gh.t; if(age>0.5)continue; const k=(1-age/0.5)*0.5, c2=Math.cos(gh.yaw), s2=Math.sin(gh.yaw);
      for(let i=0;i<m.form.length;i+=2){ const p=m.form[i]; if(p.part==='orbit')continue; const lx=p.x*sc, ly=p.y*sc, lz=p.z*sc; dyn(gh.x+lx*c2+lz*s2,gh.y+ly,gh.z-lx*s2+lz*c2,p.g,p.s*sc,1.0*k,0.95*k,0.75*k,0,0); } } } }
// ---------------------------------------------------------------- the small and simple creatures, each its own body: an outline that reads at a glance and one standing feature (glyphs about 0.22 m)
function cpt(pts,x,y,z,ch,s,b,col,part,extra){ pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{})); }
function jellyForm(ty){ const pts=[], S=0.22/ty.scale, C=ty.col;
  for(let y=0.04;y<0.6;y+=0.11){ const r=0.5*Math.sqrt(Math.max(0,1-Math.pow(y/0.62,2)))+0.03, n=Math.max(5,Math.round(2*Math.PI*r/0.16)); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+y*3, rim=Math.abs(Math.cos(a));
      cpt(pts,Math.cos(a)*r,y,Math.sin(a)*r,rim>0.7?'(':mpick(['~','o','.']),S,rim>0.7?1.4:0.7,C,'jel'); } }
  for(let k=0;k<7;k++)cpt(pts,(mr()-0.5)*0.4,0.12+mr()*0.3,(mr()-0.5)*0.4,mpick(['o','%','=']),S*0.9,0.8,[0.88,0.82,0.72],'jel'); return pts; }
function bloatForm(ty){ const pts=[], S=0.22, C=ty.col;
  for(let i=0;i<38;i++){ const y=1-2*(i+0.5)/38, rr=Math.sqrt(1-y*y), a=i*2.39996; cpt(pts,Math.cos(a)*rr*0.42,y*0.4,Math.sin(a)*rr*0.42,y>0.3?'o':mpick(['O','%','o']),S,0.9+0.5*Math.max(0,y),C,'bloat'); }
  for(let m2=0;m2<4;m2++){ const a=m2/4*Math.PI*2; for(let k=0;k<6;k++){ const v=-0.7+k*0.28; cpt(pts,Math.cos(a)*Math.cos(v)*0.43,Math.sin(v)*0.41,Math.sin(a)*Math.cos(v)*0.43,'|',S*0.8,1.5,[0.75,0.72,0.5],'bloat'); } }
  for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; cpt(pts,Math.cos(a)*0.09,-0.4,Math.sin(a)*0.09,k%2?'(':')',S*0.8,1.2,[0.55,0.4,0.3],'bloat'); } return pts; }
function wispForm(ty){ const pts=[], S=0.22, C=ty.col;
  cpt(pts,0,0,0,'*',S*1.5,4.0,[1.0,1.0,0.9],'wisp'); for(let k=0;k<5;k++)cpt(pts,(mr()-0.5)*0.06,0.04+k*0.05,(mr()-0.5)*0.06,'^',S*(1-k*0.12),3.2-k*0.3,C,'wisp');
  for(let i=0;i<22;i++){ const y=1-2*(i+0.5)/22, rr=Math.sqrt(1-y*y), a=i*2.39996; cpt(pts,Math.cos(a)*rr*0.32,y*0.34,Math.sin(a)*rr*0.32,mpick(['.','\'',',']),S*0.85,0.9,C,'wisp'); } return pts; }
function eelForm(ty){ const pts=[], S=0.2, C=ty.col;
  for(let k=0;k<=16;k++){ const z=0.8-k*0.1, w=0.07*(1-k/20); for(const sd of [-1,1])cpt(pts,sd*w,0.04,z,sd<0?'(':')',S,1.1,C,'eelw'); if(k%2===0&&k>2)cpt(pts,0,0.12,z,'^',S*0.85,1.3,C,'eelw'); }
  cpt(pts,0.05,0.08,0.82,'.',S*0.9,3.0,[0.9,1.0,0.8],'eelw'); cpt(pts,-0.05,0.08,0.82,'.',S*0.9,3.0,[0.9,1.0,0.8],'eelw'); cpt(pts,0,0.04,0.9,'>',S,1.3,C,'eelw'); return pts; }
function snakeForm(ty){ const pts=[], S=0.22/ty.scale, C=ty.col;
  for(let k=0;k<=18;k++){ const z=0.55-k*0.075, w=0.06*(1-k/24); cpt(pts,0,0.05,z,k%3===0?'=':'~',S,1.1,C,'slither'); for(const sd of [-1,1])if(k%2===0)cpt(pts,sd*w,0.05,z,'.',S*0.7,0.8,[0.55,0.6,0.35],'slither'); }
  cpt(pts,-0.06,0.07,0.6,'<',S,1.4,C,'slither'); cpt(pts,0.06,0.07,0.6,'>',S,1.4,C,'slither'); cpt(pts,0,0.08,0.64,'^',S,1.3,C,'slither');
  cpt(pts,0.03,0.1,0.62,'.',S*0.8,3.0,[1.0,0.9,0.4],'slither'); cpt(pts,-0.03,0.1,0.62,'.',S*0.8,3.0,[1.0,0.9,0.4],'slither'); cpt(pts,0,0.06,0.73,'-',S*0.8,1.8,[0.95,0.35,0.35],'tongue'); return pts; }
function fishForm(ty){ const pts=[], S=0.22/ty.scale, C=ty.col;
  for(let k=0;k<=6;k++){ const z=0.3-k*0.09, w=0.13*Math.sin(Math.PI*(k+0.5)/7.5); for(const sd of [-1,1])cpt(pts,sd*w,0,z,sd<0?'(':')',S,1.1,C,'body'); }
  cpt(pts,0,0,0.38,'>',S,1.3,C,'head'); cpt(pts,0.05,0.03,0.3,'.',S*0.8,2.4,[1,1,1],'head');
  for(let k=0;k<3;k++)cpt(pts,(mr()-0.5)*0.06,(mr()-0.5)*0.05,0.12-k*0.04,'*',S*(1.1-k*0.2),3.6,[1.0,0.95,0.6],'body');
  for(const sd of [-1,1])cpt(pts,sd*0.08,0,-0.4,sd<0?'/':'\\',S,1.3,C,'tail',{piv:2}); cpt(pts,0,0,-0.36,'<',S,1.2,C,'tail',{piv:1}); return pts; }
function shroomForm(ty){ const pts=[], S=0.22/ty.scale, C=ty.col;
  for(let k=0;k<4;k++)cpt(pts,0,0.06+k*0.13,0,'|',S*1.1,0.95,[0.85,0.82,0.75],'body');
  for(const [y,r] of [[0.55,0.46],[0.64,0.4],[0.72,0.28],[0.78,0.12]]){ const n=Math.max(5,Math.round(2*Math.PI*r/0.16)); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; cpt(pts,Math.cos(a)*r,y,Math.sin(a)*r,y<0.6?'=':'^',S,1.1,C,'cap'); } }
  for(let k=0;k<10;k++){ const a=k/10*Math.PI*2; cpt(pts,Math.cos(a)*0.28,0.5,Math.sin(a)*0.28,'|',S*0.85,0.8,[0.8,0.7,0.65],'cap'); }
  for(let k=0;k<6;k++){ const a=mr()*6.28, r=mr()*0.3; cpt(pts,Math.cos(a)*r,0.76,Math.sin(a)*r,'.',S,2.8,[1.0,0.95,0.85],'cap'); } return pts; }
function crabForm(ty){ const pts=[], S=0.22/ty.scale, C=ty.col;
  for(let k=0;k<14;k++){ const a=k/14*Math.PI*2; cpt(pts,Math.cos(a)*0.32,0.22,Math.sin(a)*0.24,Math.abs(Math.sin(a))>0.7?'=':'(',S,1.1,C,'body'); }
  for(let k=0;k<5;k++)cpt(pts,(k-2)*0.1,0.26,(k%2)*0.06-0.03,k===2?'?':'~',S,k===2?2.2:1.1,[0.95,0.88,0.6],'body');
  for(const sd of [-1,1])for(let l=0;l<3;l++){ const z=0.14-l*0.14, part=(l%2===0)===(sd>0)?'legL':'legR'; cpt(pts,sd*0.4,0.14,z,sd<0?'\\':'/',S,1.0,C,part,{piv:0.22,pz:z}); cpt(pts,sd*0.48,0.04,z,'|',S*0.9,0.9,C,part,{piv:0.22,pz:z}); }
  for(const sd of [-1,1]){ cpt(pts,sd*0.1,0.32,0.22,'|',S*0.7,1.0,C,'head'); cpt(pts,sd*0.1,0.38,0.22,'.',S*0.9,2.6,[1,1,0.9],'head'); } return pts; }

// ---------------------------------------------------------------- humanoids, rebuilt: a body made of readable glyphs with shading by material, proportions by kind, and each kind's own features
const HRAMP={skin:['.',':','o','%','#'], cloth:['.',':','|','/','#'], fur:['.',',','"','%','#'], metal:['.',':','=','#','@']};
function humanoid2(ty){
  const look=ty.look, P=HUM_PROP[LOOK_PROP[look]||'base'], S=Math.min(0.36,0.22/ty.scale), GAP=S*0.8, pts=[];
  const SK=ty.col, CL={kobold:[0.6,0.42,0.3],goblin:[0.55,0.45,0.32],conjurer:[0.42,0.3,0.6],snapjaw:[0.62,0.5,0.36],monkey:[0.55,0.42,0.3],ogre:[0.55,0.42,0.3],gnome:[0.35,0.45,0.75]}[look]||[0.5,0.45,0.4];
  const LD=[0.42,0.72,0.55], put=(x,y,z,nx,ny,nz,mat,col,part,extra)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), R=HRAMP[mat];
    pts.push(Object.assign({x,y,z,g:G(R[Math.min(R.length-1,Math.floor(i*R.length))]),s:S,b:0.5+0.9*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{})); };
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,extra)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/GAP)), ch=strokeCh(dx,dy); for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s||S,bri,col,part,extra); } };
  const lean=look==='goblin'?0.12:look==='snapjaw'?0.14:look==='monkey'?0.22:0, lz=y=>lean*Math.max(0,(y-P.hip)/(P.hc-P.hip));
  const bw=look==='ogre'?1.45:look==='kobold'||look==='gnome'?0.9:1, legW=P.legW||1;
  // legs (cloth or fur), swinging from the hip
  for(const sd of [-1,1]){ const part=sd<0?'legL':'legR'; for(let y=0.04;y<P.hip;y+=GAP){ put(sd*0.1*bw*legW,y,0,sd,0,0.6,look==='snapjaw'||look==='monkey'||look==='kobold'?'fur':'cloth',look==='snapjaw'||look==='monkey'||look==='kobold'?SK:CL,part,{piv:P.hip,pz:0}); if(legW>1.1)put(sd*0.16*bw,y,0,sd,0,0.4,'skin',SK,part,{piv:P.hip,pz:0}); } }
  // torso: rings from hip to shoulder; the ogre's belly bulges
  for(let y=P.hip;y<=P.sh+0.01;y+=GAP){ const f=(y-P.hip)/(P.sh-P.hip), bel=look==='ogre'?0.1*Math.sin(Math.PI*Math.min(1,f*1.3)):0, rx=(0.18+0.04*f)*bw+bel, rz=0.13*bw+bel, n=Math.max(5,Math.round(2*Math.PI*Math.max(rx,rz)/GAP));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a), mat=f<0.25&&look!=='ogre'?'cloth':(look==='conjurer'||look==='gnome'?'cloth':'skin'); put(nx*rx,y,nz*rz+lz(y),nx,0.2,nz,mat,mat==='cloth'?CL:SK); } }
  // arms, swinging from the shoulder; the monkey's reach the ground
  const armLen=(P.sh-P.hip)*(look==='monkey'?1.9:look==='ogre'?1.25:1.1);
  for(const sd of [-1,1]){ const part=sd<0?'armL':'armR', ax=sd*(0.22*bw+0.06); for(let t=0;t<=armLen;t+=GAP)put(ax+sd*0.02*t,P.sh-t,lz(P.sh)+0.04*t,sd,0,0.5,'skin',SK,part,{piv:P.sh,pz:0}); lit(ax+sd*0.02*armLen,P.sh-armLen-0.02,lz(P.sh)+0.04*armLen,'o',S,1.4,SK,part,{piv:P.sh,pz:0}); }
  // head: shaded sphere, glowing eyes, the creature's letter small at its centre
  const hr=0.15*P.hk*(look==='ogre'?1.0:1), H=[0,P.hc,lz(P.hc)];
  for(let i=0;i<14;i++){ const y=1-2*(i+0.5)/14, rr=Math.sqrt(1-y*y), a=i*2.39996; put(H[0]+Math.cos(a)*rr*hr,H[1]+y*hr,H[2]+Math.sin(a)*rr*hr,Math.cos(a)*rr,y,Math.sin(a)*rr,'skin',SK,'head'); }
  const EYE=look==='goblin'?[1,0.9,0.3]:look==='conjurer'?[0.8,0.5,1]:look==='gnome'?[0.6,0.8,1]:[1,0.75,0.4];
  for(const sd of [-1,1])lit(H[0]+sd*hr*0.38,H[1]+hr*0.15,H[2]+hr*0.92,'.',S*0.8,3.2,EYE,'head');
  lit(0,P.hc,H[2]+hr*0.2,ty.ch,S*1.3,1.5,SK,'core');
  const tool=(part,pts2)=>pts2;
  const hand=[0.22*bw+0.06+0.02*armLen,P.sh-armLen,lz(P.sh)+0.04*armLen], arm={piv:P.sh,pz:0};
  if(look==='kobold'){ for(let k=1;k<=3;k++)lit(0,H[1]-hr*0.2,H[2]+hr+k*S*0.6,k===3?'>':'=',S*0.9,1.4,SK,'head');
    for(const sd of [-1,1]){ lit(sd*hr*0.6,H[1]+hr*1.1,H[2],'^',S,1.4,SK,'head'); lit(sd*hr*0.65,H[1]+hr*1.45,H[2]-0.02,'^',S*0.8,1.2,SK,'head'); }
    stroke([hand[0],hand[1]-0.3,hand[2]],[hand[0],hand[1]+0.85,hand[2]],[0.6,0.5,0.35],1.1,S*0.9,'armR',arm); lit(hand[0],hand[1]+0.92,hand[2],'^',S*1.1,2.2,[0.85,0.85,0.9],'armR',arm);
    stroke([0,P.hip,-0.12],[0,P.hip-0.2,-0.3],SK,1.0,S*0.9,'tail',{piv:0}); }
  if(look==='goblin'){ for(const sd of [-1,1]){ stroke([sd*hr,H[1]+hr*0.2,H[2]],[sd*(hr+0.22),H[1]+hr*0.6,H[2]-0.04],SK,1.4,S,'head'); lit(sd*(hr+0.26),H[1]+hr*0.65,H[2]-0.05,sd<0?'<':'>',S,1.6,SK,'head'); }
    for(let k=0;k<5;k++)lit((k-2)*0.07,P.hip-0.05-((k*7)%3)*0.04,0.14+lz(P.hip),mpick(['|','/','\\']),S*0.9,1.0,CL);
    stroke([hand[0],hand[1],hand[2]],[hand[0],hand[1]-0.02,hand[2]+0.3],[0.7,0.55,0.4],1.6,S*0.9,'armR',arm); }
  if(look==='conjurer'){ for(let y=0.04;y<P.hip+0.1;y+=GAP){ const r=0.34-(y/(P.hip+0.1))*0.12, n=Math.max(6,Math.round(2*Math.PI*r/GAP)); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; put(Math.cos(a)*r,y,Math.sin(a)*r*0.85,Math.cos(a),0.1,Math.sin(a),'cloth',CL,'robe'); } }
    for(let i=0;i<10;i++){ const y=1-2*(i+0.5)/10, rr=Math.sqrt(1-y*y), a=i*2.39996; if(Math.sin(a)*rr>0.4&&y<0.6)continue; put(Math.cos(a)*rr*hr*1.35,H[1]+0.03+y*hr*1.3,H[2]-0.02+Math.sin(a)*rr*hr*1.3,Math.cos(a)*rr,y,Math.sin(a)*rr,'cloth',CL,'head'); }
    lit(0,H[1]+hr*1.55,H[2]-0.04,'^',S,1.2,CL,'head');
    stroke([hand[0]+0.04,0.04,hand[2]],[hand[0]+0.04,P.hc+0.35,hand[2]],[0.85,0.8,0.68],1.1,S*0.9,'armR',arm);
    for(const sd of [-1,1])lit(hand[0]+0.04+sd*0.07,P.hc+0.32,hand[2],sd<0?'}':'{',S*0.85,1.3,[0.9,0.9,0.8],'armR',arm); lit(hand[0]+0.04,P.hc+0.45,hand[2],'*',S*1.3,3.4,[0.75,0.45,1.0],'armR',arm); }
  if(look==='snapjaw'){ for(let k=1;k<=4;k++)lit(0,H[1]-hr*0.25,H[2]+hr+k*S*0.55,k===4?'>':'=',S*0.9,1.4,SK,'head');
    for(let k=0;k<6;k++)lit(0,H[1]+hr*0.9-k*0.08,H[2]-hr-0.02-k*0.03,'^',S*0.9,1.3,[0.4,0.3,0.22],'head');
    for(let k=0;k<5;k++)lit((k-2)*0.08,P.hip-0.04,0.15+lz(P.hip),'"',S*0.9,1.1,[0.5,0.4,0.3]);
    if(ty.sk==='sw'||ty.name&&ty.name.includes('見張り')){ stroke([hand[0],hand[1]-0.05,hand[2]],[hand[0],hand[1]+0.45,hand[2]],[0.5,0.38,0.25],1.0,S*0.9,'armR',arm); for(let q=0;q<4;q++){ const f=q/3; lit(hand[0],hand[1]+0.5+f*0.22,hand[2],'^',S*(1.1-f*0.3),2.0+1.2*f,[1.0,0.3+0.55*f,0.1+0.4*f],'flame',{fh:f,piv:P.sh}); } } }
  if(look==='monkey'){ for(let k=0;k<9;k++){ const a=k/8*Math.PI*1.4; lit(0,P.hip-0.05+Math.sin(a)*0.35,-0.15-k*0.07+Math.cos(a)*0.0,mpick(['~','(',')']),S*0.9,1.1,SK,'tail',{piv:k*0.6}); }
    for(const sd of [-1,1])lit(sd*hr*0.95,H[1],H[2],sd<0?'(':')',S,1.2,SK,'head'); }
  if(look==='ogre'){ for(let k=0;k<6;k++)lit((k-2.5)*0.1,P.hip+0.02,0.25,'"',S*0.9,1.1,[0.55,0.45,0.3]);
    stroke([hand[0],hand[1],hand[2]],[hand[0]-0.05,P.sh+0.3,-0.25],[0.55,0.42,0.3],1.1,S,'armR',arm);
    for(let q=0;q<7;q++)lit(hand[0]-0.05+(mr()-0.5)*0.16,P.sh+0.32+(mr()-0.5)*0.16,-0.28+(mr()-0.5)*0.12,mpick(['#','%','@']),S*1.05,1.2,[0.6,0.5,0.4],'armR',arm); }
  if(look==='gnome'){ for(let k=0;k<6;k++){ const r=hr*1.15*(1-k/6), n=Math.max(1,6-k); for(let j=0;j<n;j++){ const a=j/n*Math.PI*2; lit(Math.cos(a)*r,H[1]+hr*0.7+k*0.08,H[2]+Math.sin(a)*r,k===5?'^':'A',S*0.9,1.3,[0.85,0.3,0.3],'head'); } }
    for(let k=0;k<5;k++)stroke([(k-2)*0.04,H[1]-hr*0.3,H[2]+hr*0.85],[(k-2)*0.05,H[1]-hr*1.6,H[2]+hr*0.9],[0.92,0.92,0.92],1.3,S*0.85,'head');
    lit(hand[0],hand[1]-0.08,hand[2]+0.1,'[',S*0.9,1.2,[0.7,0.6,0.4],'armR',arm); lit(hand[0]+0.08,hand[1]-0.08,hand[2]+0.1,']',S*0.9,1.2,[0.7,0.6,0.4],'armR',arm); lit(hand[0]+0.04,hand[1]-0.08,hand[2]+0.1,'*',S*1.1,3.6,[1,0.85,0.5],'armR',arm); }
  return pts;
}

// ---------------------------------------------------------------- the ogre, its own body: broad shoulders and a V-shaped torso, bulging shoulders and arms, thick legs, a heavy brow and tusks,
// a leather loincloth with fur, a belt with an iron buckle, and a real club - thick at the head, iron-banded, studded with iron spikes - resting on its shoulder. Several colours, not one
function ogreForm(ty){
  const pts=[], S=0.167, GAP=0.14, LD=[0.42,0.72,0.55];
  const SKIN=[0.52,0.62,0.44], LEATHER=[0.36,0.22,0.14], FUR=[0.88,0.8,0.64], WOOD=[0.72,0.46,0.24], IRON=[0.82,0.86,0.95], TUSK=[0.98,0.95,0.86], EYE=[1.0,0.85,0.3];
  const R={skin:['.',':','o','%','#'], cloth:['.',':','|','/','#'], wood:['.',':','=','%','#'], fur:['.',',','"','%','#']};
  const put=(x,y,z,nx,ny,nz,mat,col,part,extra)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1), r=R[mat];
    pts.push(Object.assign({x,y,z,g:G(r[Math.min(r.length-1,Math.floor(i*r.length))]),s:S,b:0.5+0.9*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{})); };
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const tube=(a,b,r0,r1,mat,col,part,extra,bulge)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), ux=dx/L, uy=dy/L, uz=dz/L; let px=-uz, py=0, pz=ux; if(Math.hypot(px,pz)<0.1){ px=1; pz=0; } const pl=Math.hypot(px,pz); px/=pl; pz/=pl;
    const qx=uy*pz-uz*py, qy=uz*px-ux*pz, qz=ux*py-uy*px; for(let t=0;t<=L+1e-6;t+=GAP){ const f=t/L, r=(r0+(r1-r0)*f)*(1+(bulge||0)*Math.sin(Math.PI*f)), n=Math.max(5,Math.round(2*Math.PI*r/GAP));
      for(let k=0;k<n;k++){ const an=k/n*Math.PI*2+t*2, ox=Math.cos(an)*px+Math.sin(an)*qx, oy=Math.cos(an)*py+Math.sin(an)*qy, oz=Math.cos(an)*pz+Math.sin(an)*qz; put(a[0]+ux*t+ox*r,a[1]+uy*t+oy*r,a[2]+uz*t+oz*r,ox,oy,oz,mat,col,part,extra); } } };
  const hip=0.6, sh=1.26, hc=1.42;
  // thick legs with bulging calves, wide feet
  for(const sd of [-1,1]){ const part=sd<0?'legL':'legR', ex={piv:hip,pz:0}; tube([sd*0.15,hip,0],[sd*0.16,0.06,0.02],0.12,0.09,'skin',SKIN,part,ex,0.25); for(let k=0;k<3;k++)lit(sd*0.16+(k-1)*0.06,0.03,0.1,'_',S,1.0,SKIN,part,ex); }
  // the torso: V-shaped, broadest at the chest; a slight belly in front
  for(let y=hip;y<=sh+0.01;y+=GAP){ const f=(y-hip)/(sh-hip), rx=0.26+0.18*Math.pow(f,1.3), rz=0.2+0.04*f, bel=0.07*Math.sin(Math.PI*Math.min(1,f*1.6)), n=Math.max(8,Math.round(2*Math.PI*rx/GAP));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); put(nx*rx,y,nz*(rz+(nz>0?bel:0)),nx,0.15,nz,'skin',SKIN); } }
  for(const sd of [-1,1])for(let k=0;k<3;k++)lit(sd*(0.1+k*0.07),sh-0.12-k*0.02,0.26,sd<0?'(':')',S,1.5,[0.5,0.46,0.32]);
  for(let r=0;r<3;r++)for(const sd of [-1,1])lit(sd*0.06,hip+0.2+r*0.11,0.29,'=',S*0.9,1.2,[0.5,0.46,0.32]);
  // bulging shoulders and a thick neck
  for(const sd of [-1,1])for(let i=0;i<12;i++){ const y=1-2*(i+0.5)/12, rr=Math.sqrt(1-y*y), a=i*2.39996; if(y<-0.3)continue; put(sd*0.46+Math.cos(a)*rr*0.14,sh-0.02+y*0.12,Math.sin(a)*rr*0.14,Math.cos(a)*rr,y,Math.sin(a)*rr,'skin',SKIN); }
  tube([0,sh,0],[0,hc-0.08,0.02],0.13,0.11,'skin',SKIN,'body');
  // thick arms with biceps and fists
  const armLen=0.82;
  // the left arm hangs; the right is bent at the elbow, its fist in front of the chest, holding the club on the shoulder
  for(const sd of [-1,1]){ const part=sd<0?'armL':'armR', ex={piv:sh,pz:0}, s0=[sd*0.5,sh-0.04,0], el=sd<0?[sd*0.56,sh-0.42,0.04]:[0.6,sh-0.4,0.14], wr=sd<0?[sd*0.54,sh-armLen,0.1]:[0.44,sh-0.14,0.32];
    tube(s0,el,0.1,0.085,'skin',SKIN,part,ex,0.3); tube(el,wr,0.085,0.075,'skin',SKIN,part,ex,0.15);
    for(let i=0;i<8;i++){ const y=1-2*(i+0.5)/8, rr=Math.sqrt(1-y*y), a=i*2.39996; put(wr[0]+Math.cos(a)*rr*0.09,wr[1]-0.06+y*0.08,wr[2]+Math.sin(a)*rr*0.09,Math.cos(a)*rr,y,Math.sin(a)*rr,'skin',SKIN,part,ex); }
    lit(sd*0.54,sh-0.2,0.12,'^',S*0.8,1.2,LEATHER,part,ex); }
  // a small head: heavy brow, small yellow eyes, a jutting jaw with tusks, small ears; its letter
  for(let i=0;i<14;i++){ const y=1-2*(i+0.5)/14, rr=Math.sqrt(1-y*y), a=i*2.39996; put(Math.cos(a)*rr*0.14,hc+y*0.14,0.04+Math.sin(a)*rr*0.14,Math.cos(a)*rr,y,Math.sin(a)*rr,'skin',SKIN,'head'); }
  for(let k=0;k<5;k++)lit((k-2)*0.05,hc+0.05,0.18,'=',S*0.9,1.4,[0.5,0.46,0.32],'head');
  for(const sd of [-1,1]){ lit(sd*0.05,hc+0.0,0.18,'.',S*0.8,3.2,EYE,'head'); lit(sd*0.06,hc-0.1,0.2,'^',S*0.9,2.4,TUSK,'head'); lit(sd*0.15,hc+0.02,0.02,sd<0?'(':')',S*0.85,1.1,SKIN,'head'); }
  for(let k=0;k<3;k++)lit((k-1)*0.05,hc-0.12,0.17,'-',S*0.85,1.2,SKIN,'head');
  lit(0,hc+0.02,0.1,ty.ch,S*1.2,1.4,SKIN,'core');
  // a leather loincloth with fur, a belt with an iron buckle
  for(let k=0;k<16;k++){ const a=k/16*Math.PI*2; lit(Math.cos(a)*0.29,hip+0.06,Math.sin(a)*0.23+(Math.sin(a)>0?0.04:0),'=',S,1.2,LEATHER); }
  lit(0,hip+0.06,0.3,'#',S*1.1,2.2,IRON);
  for(const zf of [1,-1])for(let k=0;k<5;k++){ const x=(k-2)*0.08; for(let y=hip;y>hip-0.32;y-=GAP)lit(x,y,zf*(0.24+0.02*(hip-y)),'|',S,0.95,LEATHER); lit(x,hip-0.34,zf*0.25,'"',S,1.3,FUR); }
  // the club: in the right hand, resting on the shoulder - narrow grip, swelling head, two iron bands, iron spikes
  const g0=[0.44,sh-0.22,0.36], g1=[0.47,sh+0.55,-0.46], ex={piv:sh,pz:0};
  tube(g0,g1,0.045,0.16,'wood',WOOD,'armR',ex,0);
  for(const f of [0.62,0.84]){ const c=[g0[0]+(g1[0]-g0[0])*f,g0[1]+(g1[1]-g0[1])*f,g0[2]+(g1[2]-g0[2])*f], r=0.05+0.12*f; for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; lit(c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r*0.4,c[2]+Math.sin(a)*r,'=',S,1.8,IRON,'armR',ex); } }
  for(let k=0;k<7;k++){ const a=k/7*Math.PI*2, f=0.9+0.08*(k%2), c=[g0[0]+(g1[0]-g0[0])*f,g0[1]+(g1[1]-g0[1])*f,g0[2]+(g1[2]-g0[2])*f], r=0.2; lit(c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r*0.6,c[2]+Math.sin(a)*r,'^',S*1.05,2.4,IRON,'armR',ex); }
  return pts;
}

// ---------------------------------------------------------------- four-legged creatures, each its own body with several colours: the rat, the jackal, the moss grazer, the salamander
function q2(ty){ const S=Math.min(0.36,0.2/ty.scale), pts=[], LD=[0.42,0.72,0.55];
  const put=(x,y,z,nx,ny,nz,ramp,col,part,extra)=>{ const l=Math.hypot(nx,ny,nz)||1, d=(nx*LD[0]+ny*LD[1]+nz*LD[2])/l, i=clamp(0.2+0.8*Math.max(0,d),0,1);
    pts.push(Object.assign({x,y,z,g:G(ramp[Math.min(ramp.length-1,Math.floor(i*ramp.length))]),s:S,b:0.5+0.9*i,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{})); };
  const lit=(x,y,z,ch,s,b,col,part,extra)=>pts.push(Object.assign({x,y,z,g:G(ch),s:s*S,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0,col},extra||{}));
  const strokeCh=(dx,dy)=>Math.abs(dy)>Math.abs(dx)*2?'|':Math.abs(dx)>Math.abs(dy)*2?'-':(dx*dy>0?'/':'\\');
  const stroke=(a,b,col,bri,s,part,extra,step)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz), n=Math.max(1,Math.round(L/(step||S*0.8))), ch=strokeCh(dx,dy); for(let k=0;k<=n;k++){ const f=k/n; lit(a[0]+dx*f,a[1]+dy*f,a[2]+dz*f,ch,s,bri,col,part,extra); } };
  const ell=(c,rx,ry,rz,ramp,colf,part,step,skip)=>{ const st=step||S*0.85; for(let v=0.25;v<Math.PI-0.1;v+=st/Math.max(rx,ry)){ const sv=Math.sin(v), cv=Math.cos(v), n=Math.max(5,Math.round(2*Math.PI*Math.max(rx,rz)*sv/st));
      for(let k=0;k<n;k++){ const u=k/n*Math.PI*2+v, nx=Math.cos(u)*sv, ny=cv, nz=Math.sin(u)*sv; if(skip&&skip(nx,ny,nz))continue; put(c[0]+nx*rx,c[1]+ny*ry,c[2]+nz*rz,nx/rx,ny/ry,nz/rz,ramp,colf(nx,ny,nz),part); } } };
  return {S,pts,put,lit,stroke,ell};
}
const FUR=['.',',','"','%','#'], SCALE=['.',':','=','%','#'];
function ratForm(ty){ const {S,pts,lit,stroke,ell}=q2(ty), GREY=[0.6,0.54,0.48], PINK=[0.95,0.62,0.66], EYE=[1,0.3,0.25];
  ell([0,0.3,0],0.22,0.2,0.38,FUR,(nx,ny)=>ny<-0.5?[0.75,0.7,0.64]:GREY,'body');
  ell([0,0.27,0.42],0.13,0.12,0.14,FUR,()=>GREY,'head');
  lit(0,0.23,0.6,'>',1,1.6,PINK,'snout'); for(const sd of [-1,1]){ lit(sd*0.1,0.25,0.56,'-',0.8,1.4,[0.9,0.88,0.85],'snout'); lit(sd*0.14,0.26,0.53,'-',0.8,1.2,[0.9,0.88,0.85],'snout'); lit(sd*0.1,0.4,0.38,sd<0?'(':')',1,1.4,PINK,'head'); lit(sd*0.05,0.31,0.53,'.',0.7,3.2,EYE,'head'); }
  for(const [x,z,part] of [[-0.12,0.22,'legL'],[0.12,0.22,'legR'],[-0.12,-0.22,'legR'],[0.12,-0.22,'legL']]){ stroke([x,0.18,z],[x,0.02,z+0.03],GREY,1.0,0.9,part,{piv:0.18,pz:z}); lit(x,0.01,z+0.06,'_',0.8,1.1,PINK,part,{piv:0.18,pz:z}); }
  for(let k=0;k<14;k++){ const f=k/13; lit(Math.sin(f*3)*0.08,0.24-0.2*f,-0.38-f*0.75,k%2?'~':'-',0.8,1.2,PINK,'tail',{piv:k*0.5}); }
  return pts; }
function jackalForm(ty){ const {S,pts,lit,stroke,ell}=q2(ty), SAND=[0.82,0.66,0.42], DARK=[0.42,0.3,0.2], WHITE=[0.92,0.88,0.8], EYE=[1,0.85,0.3];
  for(let z=-0.4;z<=0.42;z+=S*0.8){ const f=(z+0.4)/0.82, r=0.11+0.06*Math.sin(Math.PI*Math.min(1,f*1.3))+(f>0.7?0.03:0), ry=0.15+0.05*f, cy=0.72+0.06*f, n=Math.max(5,Math.round(2*Math.PI*r/(S*0.85)));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, nx=Math.cos(a), ny=Math.sin(a); lit(nx*r,cy+ny*ry,z,ny>0.75?'"':ny<-0.4?':':mpick(['%','"',',']),1,ny>0.75?1.0:1.2,ny>0.75?DARK:ny<-0.4?WHITE:SAND); } }
  ell([0,0.9,0.52],0.09,0.09,0.1,FUR,(nx,ny)=>ny<-0.3?WHITE:SAND,'head'); stroke([0,0.87,0.6],[0,0.82,0.84],SAND,1.3,0.9,'head'); lit(0,0.82,0.88,'.',0.8,1.8,[0.2,0.15,0.12],'head');
  for(const sd of [-1,1]){ stroke([sd*0.05,0.97,0.5],[sd*0.09,1.17,0.47],SAND,1.4,0.9,'head'); lit(sd*0.09,1.21,0.47,'^',1,1.6,SAND,'head'); lit(sd*0.04,0.93,0.6,'.',0.7,3.2,EYE,'head'); }
  for(const [x,z,part] of [[-0.08,0.34,'legL'],[0.08,0.34,'legR'],[-0.08,-0.32,'legR'],[0.08,-0.32,'legL']]){ stroke([x,0.62,z],[x,0.3,z-0.04],SAND,1.1,0.85,part,{piv:0.62,pz:z}); stroke([x,0.3,z-0.04],[x,0.02,z+0.02],SAND,1.1,0.85,part,{piv:0.62,pz:z}); }
  for(let k=0;k<8;k++){ const f=k/7; for(const o of [-0.03,0.03])lit(o,0.68-0.38*f,-0.42-0.18*f,mpick(['"','%']),1,1.1,f>0.75?WHITE:SAND,'tail',{piv:k*0.4}); }
  return pts; }
function grazerForm(ty){ const {S,pts,lit,stroke,ell}=q2(ty), BROWN=[0.62,0.46,0.3], MOSS=[0.45,0.75,0.35];
  ell([0,0.45,0],0.38,0.32,0.48,FUR,()=>BROWN,'body',null,(nx,ny)=>ny>0.45);
  for(let i=0;i<40;i++){ const y=1-(i+0.5)/40*0.55, rr=Math.sqrt(1-y*y), a=i*2.39996; lit(Math.cos(a)*rr*0.4,0.45+y*0.34,Math.sin(a)*rr*0.5,mpick([',','"','%','"']),1,1.2+0.3*mr(),MOSS); }
  for(const [x,z,cap] of [[0.12,0.1,[1,0.35,0.3]],[-0.14,-0.12,[0.95,0.95,0.9]],[0.05,-0.28,[1,0.35,0.3]],[-0.08,0.24,[0.95,0.95,0.9]]]){ lit(x,0.8,z,'|',0.9,1.2,[0.92,0.9,0.82],'sway'); lit(x,0.9,z,'n',1.1,1.8,cap,'sway'); }
  ell([0,0.24,0.56],0.13,0.12,0.13,FUR,()=>BROWN,'graze'); for(const sd of [-1,1])lit(sd*0.06,0.28,0.66,'.',0.7,2.4,[0.2,0.15,0.1],'graze'); lit(0,0.15,0.68,'-',0.8,1.2,[0.4,0.3,0.2],'graze');
  for(const [x,z,part] of [[-0.2,0.26,'legL'],[0.2,0.26,'legR'],[-0.2,-0.26,'legR'],[0.2,-0.26,'legL']]){ for(const o of [-0.03,0.03])stroke([x+o,0.2,z],[x+o,0.02,z],BROWN,1.0,1,part,{piv:0.2,pz:z}); }
  return pts; }
function salamanderForm(ty){ const {S,pts,lit,stroke}=q2(ty), BLACK=[0.3,0.26,0.28], EMBER=[1,0.35,0.12];
  for(let z=0.6;z>=-1.25;z-=S*0.8){ const f=(0.6-z)/1.85, r=0.15*(1-f*0.85), n=Math.max(4,Math.round(2*Math.PI*r/(S*0.9)));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, nx=Math.cos(a), ny=Math.sin(a); lit(nx*r,0.17*(1-f*0.6)+ny*r*0.55,z,ny>0.6?'=':mpick(['%','#',':']),1,ny>0.3?1.1:0.8,BLACK,'slither'); }
    if(f>0.08&&f<0.75&&Math.round(z*20)%2===0)lit((mr()-0.5)*0.06,0.17*(1-f*0.6)+r*0.6,z,mpick(['/','\\']),1,2.6,EMBER,'slither'); }
  for(const sd of [-1,1]){ lit(sd*0.07,0.24,0.62,'.',0.8,3.2,[1,0.6,0.2],'slither'); }
  for(const [z,part] of [[0.32,'legL'],[-0.2,'legR']])for(const sd of [-1,1]){ const p2=sd>0?part:(part==='legL'?'legR':'legL'); stroke([sd*0.12,0.12,z],[sd*0.32,0.06,z+0.06],BLACK,1.0,0.9,p2,{piv:0.12,pz:z}); stroke([sd*0.32,0.06,z+0.06],[sd*0.36,0.01,z+0.14],BLACK,1.0,0.9,p2,{piv:0.12,pz:z}); }
  for(let q=0;q<5;q++){ const f=q/4; lit((mr()-0.5)*0.05,0.06+f*0.22,-1.28-0.04*f,'^',1.05-0.3*f,2.2+1.2*f,[1,0.35+0.55*f,0.1+0.4*f],'flame',{fh:f}); }
  return pts; }
function salamanderAura(m,t){ if(Math.hypot(m.x-player.x,m.z-player.z)>24||mr()>0.08)return; const sc=m.ty.scale||1, cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), lz=-1.3*sc;
  spawn(m.x+lz*sy,0.12,m.z+lz*cy,(mr()-0.5)*0.2,-0.1,(mr()-0.5)*0.2,0.5,G(mpick(['\'','.'])),0.09,2.6,1.2,0.35,1); }

// ---------------------------------------------------------------- the large creatures, each its own body in several colours (glyphs about 0.22 m)
function q3(ty){ const H=q2(ty); const {S,put,lit}=H;
  H.tube=(a,b,r0,r1,ramp,col,part,extra,bulge)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.hypot(dx,dy,dz)||1e-3, ux=dx/L, uy=dy/L, uz=dz/L; let px=-uz, py=0, pz=ux; if(Math.hypot(px,pz)<0.1){ px=1; pz=0; } const pl=Math.hypot(px,pz); px/=pl; pz/=pl;
    const qx=uy*pz-uz*py, qy=uz*px-ux*pz, qz=ux*py-uy*px, st=S*0.85; for(let t=0;t<=L+1e-6;t+=st){ const f=t/L, r=(r0+(r1-r0)*f)*(1+(bulge||0)*Math.sin(Math.PI*f)), n=Math.max(4,Math.round(2*Math.PI*r/st));
      for(let k=0;k<n;k++){ const an=k/n*Math.PI*2+t*2, ox=Math.cos(an)*px+Math.sin(an)*qx, oy=Math.cos(an)*py+Math.sin(an)*qy, oz=Math.cos(an)*pz+Math.sin(an)*qz; put(a[0]+ux*t+ox*r,a[1]+uy*t+oy*r,a[2]+uz*t+oz*r,ox,oy,oz,ramp,typeof col==='function'?col(ox,oy,oz):col,part,extra); } } };
  H.box=(c,w,h,d,ramp,col,part,extra)=>{ const st=S*0.9; for(let x=-w;x<=w+1e-6;x+=st)for(let y=-h;y<=h+1e-6;y+=st)for(let z=-d;z<=d+1e-6;z+=st){ const onX=Math.abs(Math.abs(x)-w)<st*0.5, onY=Math.abs(Math.abs(y)-h)<st*0.5, onZ=Math.abs(Math.abs(z)-d)<st*0.5; if(!(onX||onY||onZ))continue;
      put(c[0]+x,c[1]+y,c[2]+z,onX?Math.sign(x):0,onY?Math.sign(y):0,onZ?Math.sign(z):0,ramp,col,part,extra); } };
  return H; }
const SKINR=['.',':','o','%','#'], STONE=['.',':','=','#','#'], MUD=['.',',','~','%','#'];
function trollForm2(ty){ const {S,pts,lit,stroke,ell,tube}=q3(ty), SK=[0.5,0.6,0.46], MOSS=[0.42,0.72,0.36], ST=[0.62,0.62,0.6], EYE=[1,0.85,0.3];
  for(const sd of [-1,1]){ const part=sd<0?'legL':'legR'; tube([sd*0.16,0.62,0],[sd*0.18,0.05,0.04],0.12,0.1,SKINR,SK,part,{piv:0.62,pz:0},0.2); }
  for(let y=0.6;y<=1.45;y+=S*0.85){ const f=(y-0.6)/0.85, rx=0.28+0.08*f, rz=0.22, lean=0.3*f, n=Math.max(6,Math.round(2*Math.PI*rx/(S*0.85))); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; lit(Math.cos(a)*rx,y,Math.sin(a)*rz+lean,Math.sin(a)<-0.4&&f>0.4?mpick([',','"']):mpick(['o','%',':']),1,Math.sin(a)<-0.4&&f>0.4?1.2:1.0,Math.sin(a)<-0.4&&f>0.4?MOSS:SK); } }
  for(const sd of [-1,1]){ const part=sd<0?'armL':'armR', ex={piv:1.4,pz:0}; tube([sd*0.4,1.38,0.3],[sd*0.5,0.8,0.45],0.09,0.08,SKINR,SK,part,ex,0.2); tube([sd*0.5,0.8,0.45],[sd*0.48,0.2,0.55],0.08,0.07,SKINR,SK,part,ex,0.1);
    for(let c=0;c<4;c++)lit(sd*0.48+(c-1.5)*0.04,0.1,0.6,'v',1,1.3,SK,part,ex); }
  ell([0,1.38,0.55],0.15,0.14,0.15,SKINR,()=>SK,'head'); lit(0,1.33,0.73,'(',1.3,1.5,SK,'head'); lit(0.02,1.33,0.73,')',1.3,1.5,SK,'head'); for(const sd of [-1,1]){ lit(sd*0.06,1.42,0.68,'.',0.8,3.2,EYE,'head'); lit(sd*0.08,1.22,0.68,'^',1,2.2,[0.95,0.92,0.82],'head'); }
  stroke([0.48,0.2,0.55],[0.4,0.04,1.2],[0.55,0.45,0.3],1.1,1,'armR',{piv:1.4,pz:0}); for(let q=0;q<6;q++)lit(0.4+(mr()-0.5)*0.15,0.08+(mr()-0.2)*0.1,1.25+(mr()-0.5)*0.15,mpick(['#','%']),1.1,1.2,ST,'armR',{piv:1.4,pz:0});
  return pts; }
function golemForm2(ty){ const {S,pts,lit,box}=q3(ty), ST=[0.66,0.66,0.68], MOSS=[0.42,0.68,0.36], GLOW=[0.6,0.85,1.0];
  for(const sd of [-1,1])box([sd*0.2,0.3,0],0.13,0.3,0.14,STONE,ST,sd<0?'legL':'legR',{piv:0.6,pz:0});
  box([0,0.95,0],0.38,0.32,0.24,STONE,ST); box([0,0.58,0],0.26,0.08,0.18,STONE,ST);
  for(const sd of [-1,1]){ const part=sd<0?'armL':'armR', ex={piv:1.2,pz:0}; box([sd*0.55,1.15,0],0.15,0.12,0.16,STONE,ST,part,ex); box([sd*0.58,0.75,0.04],0.12,0.25,0.12,STONE,ST,part,ex); box([sd*0.58,0.4,0.08],0.13,0.1,0.13,STONE,ST,part,ex); }
  box([0,1.42,0.04],0.12,0.12,0.12,STONE,ST,'head'); for(const sd of [-1,1])lit(sd*0.05,1.44,0.17,'.',0.8,3.4,GLOW,'head');
  for(let k=0;k<9;k++){ const a=k/9*Math.PI*2; lit(Math.cos(a)*0.14,0.98+Math.sin(a)*0.14,0.25,'*',0.9,2.8,GLOW); } lit(0,0.98,0.26,'+',1.2,3.4,GLOW);
  for(const y of [0.62,1.28])for(let x=-0.36;x<=0.36;x+=S)lit(x,y,0.245,'-',0.8,2.0,GLOW);
  for(let k=0;k<10;k++)lit((mr()-0.5)*0.7,1.0+mr()*0.3,-0.25,mpick([',','"']),1,1.2,MOSS);
  return pts; }
function bogForm2(ty){ const {S,pts,lit,tube}=q3(ty), MUDC=[0.4,0.3,0.19], WET=[0.75,0.7,0.55], WEED=[0.42,0.7,0.32], ROOT=[0.5,0.38,0.24], BONE=[0.92,0.9,0.82], RUST=[0.72,0.32,0.18], EYE=[0.8,1.0,0.4];
  // a hunched mound of mud from the swamp's bottom
  for(let i=0;i<170;i++){ const y=1-(i+0.5)/170*1.25, rr=Math.sqrt(Math.max(0,1-y*y)), a=i*2.39996; if(y<-0.25)continue; const n=0.12*Math.sin(a*3+y*5)+0.06*Math.sin(a*7);
    const x=Math.cos(a)*rr*(0.72+n), z=Math.sin(a)*rr*(0.62+n)-0.05, yy=0.05+(y+0.25)*0.95;
    if(mr()<0.12)lit(x,yy,z,'~',1,2.0,WET,'bog'); else lit(x,yy,z,mpick(['%','~','#',',']),1,0.55+0.6*Math.max(0,y),MUDC,'bog'); }
  // two thick arms of mud reaching forward, lumpy
  for(const sd of [-1,1]){ const ex={piv:0},p0=[sd*0.45,0.85,0.25], p1=[sd*0.62,0.55,0.62], p2=[sd*0.5,0.18,0.9]; tube(p0,p1,0.16,0.14,MUD,MUDC,'bogarm',ex,0.3); tube(p1,p2,0.14,0.12,MUD,MUDC,'bogarm',ex,0.3);
    for(let c=0;c<3;c++)lit(p2[0]+(c-1)*0.07,p2[1]-0.06,p2[2]+0.1,mpick(['v','|']),1,1.0,MUDC,'bogarm',ex);
    for(let q=0;q<4;q++){ const f=0.2+q*0.2; lit(p0[0]+(p1[0]-p0[0])*f,p0[1]+(p1[1]-p0[1])*f-0.2-q*0.04,p0[2]+(p1[2]-p0[2])*f,q%2?')':'|',1,1.2,WEED,'bogarm',ex); } }
  // the head lump: a gaping mouth (a dark hole) and two glowing eyes; mud dripping from the mouth's edge
  const H=[0,1.12,0.42]; for(let i=0;i<40;i++){ const y=1-2*(i+0.5)/40, rr=Math.sqrt(1-y*y), a=i*2.39996, nx=Math.cos(a)*rr, nz=Math.sin(a)*rr; if(nz>0.55&&y<0.15&&y>-0.6&&Math.abs(nx)<0.45)continue; lit(H[0]+nx*0.3,H[1]+y*0.26,H[2]+nz*0.26,mpick(['%','~','#']),1,0.7+0.4*Math.max(0,y),MUDC,'bog'); }
  for(let k=0;k<10;k++){ const a=k/10*Math.PI*2; lit(H[0]+Math.cos(a)*0.13,H[1]-0.08+Math.sin(a)*0.11,H[2]+0.24,mpick(['(',')','~']),0.95,0.5,[0.2,0.15,0.1],'bog'); }
  for(let k=0;k<3;k++)lit(H[0]+(k-1)*0.06,H[1]-0.24-k*0.04,H[2]+0.25,'|',0.9,1.0,MUDC,'bog');
  for(const sd of [-1,1]){ lit(H[0]+sd*0.13,H[1]+0.1,H[2]+0.24,'O',1.1,1.0,[0.25,0.2,0.12],'bog'); lit(H[0]+sd*0.13,H[1]+0.1,H[2]+0.26,'*',1.05,3.8,EYE,'bog'); }
  // half-buried bones and skulls, an old rusted sword
  for(const [x,y,z] of [[-0.45,0.55,0.38],[0.35,0.4,0.48],[0.15,0.8,-0.5],[-0.3,0.25,-0.45]]){ lit(x,y,z,'O',1.1,1.5,BONE,'bog'); lit(x-0.03,y+0.01,z+0.03,'.',0.7,0.4,[0.1,0.1,0.1],'bog'); lit(x+0.03,y+0.01,z+0.03,'.',0.7,0.4,[0.1,0.1,0.1],'bog'); }
  for(const [x,y,z] of [[0.5,0.7,0.1],[-0.55,0.35,-0.1],[0.2,0.25,0.62]])lit(x,y,z,mpick(['(',')','=']),1,1.4,BONE,'bog');
  for(let k=0;k<5;k++)lit(-0.15+k*0.0,0.95+k*0.1,0.2-k*0.06,k===0?'+':'|',1,k===0?1.6:1.3,RUST,'bog');
  // rotting weeds and roots hanging from the shoulders
  for(let k=0;k<10;k++){ const a=k/10*Math.PI*2+0.2, x=Math.cos(a)*0.62, z=Math.sin(a)*0.52-0.05; for(let q=0;q<4;q++)lit(x*(1+q*0.04),0.95-q*0.16,z*(1+q*0.04),k%3===0?'\\':(q%2?')':'|'),1,1.15,k%3===0?ROOT:WEED,'bog'); }
  return pts; }
function bogAura(m,t){ const sc=m.ty.scale||1; if(Math.hypot(m.x-player.x,m.z-player.z)>26)return;
  for(let r=0.95;r<1.6;r+=0.3){ const n=Math.round(r*16); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.08*(r>1.2?-1:1); dyn(m.x+Math.cos(a)*r*sc,0.04,m.z+Math.sin(a)*r*sc,G('~'),0.13,0.28,0.24,0.16); } }
  if(mr()<0.06){ const a=mr()*6.28, r=mr()*0.7*sc; spawn(m.x+Math.cos(a)*r,0.15,m.z+Math.sin(a)*r,0,0.25,0,1.6,G(mpick(['o','.'])),0.14,0.7,0.95,0.45,0); }
  if(mr()<0.1){ const a=mr()*6.28, r=0.5*sc; spawn(m.x+Math.cos(a)*r,0.9*sc,m.z+Math.sin(a)*r,0,-0.2,0,1.2,G(mpick([',','.'])),0.12,0.5,0.38,0.24,1); } }
function dragonForm(ty){ const {S,pts,lit,stroke,ell,tube,put}=q3(ty), SC=ty.col, BELLY=[0.95,0.78,0.5], MEM=[0.55,0.18,0.18], HORN=[0.88,0.84,0.72], EMB=[1,0.55,0.18];
  // a predator's build: a deep, heavy chest and raised shoulders tapering to a tight waist and light hips; legs thick at the top, slim below; a shorter neck holding the head high;
  // an angular head (brow ridges, a pointed snout, a jaw line, cheek spikes, long swept horns); a thick-based tail; a spined ridge largest at the shoulders
  const prof=z=>{ const f=(z+0.6)/1.05; const rx=z>0.15?0.17+0.07*Math.sin(Math.min(1,(z-0.15)/0.3)*Math.PI/2):z>-0.25?0.13+0.04*(z+0.25)/0.4:0.13; const ry=z>0.15?0.18+0.08*Math.sin(Math.min(1,(z-0.15)/0.3)*Math.PI/2):z>-0.25?0.13+0.05*(z+0.25)/0.4:0.14; const cy=z>0.15?0.7+0.04*(z-0.15)/0.3:0.66+0.04*Math.max(0,(z+0.25)/0.4); return [rx,ry,cy]; };
  for(let z=-0.6;z<=0.48;z+=S*0.85){ const [rx,ry,cy]=prof(Math.min(z,0.45)), n=Math.max(6,Math.round(2*Math.PI*Math.max(rx,ry)/(S*0.85)));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, nx=Math.cos(a), ny=Math.sin(a); put(nx*rx,cy+ny*ry,z,nx,ny,0.1,SCALE,ny<-0.5?BELLY:SC,'body'); } }
  for(const sd of [-1,1])for(let i=0;i<10;i++){ const y=1-2*(i+0.5)/10, rr=Math.sqrt(1-y*y), a=i*2.39996; if(y<-0.3)continue; put(sd*0.2+Math.cos(a)*rr*0.1,0.82+y*0.08,0.36+Math.sin(a)*rr*0.1,Math.cos(a)*rr,y,Math.sin(a)*rr,SCALE,SC,'body'); }
  for(const sd of [-1,1]){ const part=sd<0?'legL':'legR', ex={piv:0.7,pz:0.38}; tube([sd*0.2,0.72,0.38],[sd*0.21,0.38,0.4],0.095,0.06,SCALE,SC,part,ex,0.2); tube([sd*0.21,0.38,0.4],[sd*0.21,0.04,0.45],0.055,0.04,SCALE,SC,part,ex); for(let c=0;c<3;c++)lit(sd*0.21+(c-1)*0.04,0.01,0.52,'v',0.85,1.5,HORN,part,ex); }
  for(const sd of [-1,1]){ const part=sd<0?'legR':'legL', ex={piv:0.64,pz:-0.42}; tube([sd*0.15,0.66,-0.42],[sd*0.18,0.38,-0.25],0.11,0.065,SCALE,SC,part,ex,0.25); tube([sd*0.18,0.38,-0.25],[sd*0.18,0.17,-0.45],0.06,0.045,SCALE,SC,part,ex); tube([sd*0.18,0.17,-0.45],[sd*0.19,0.03,-0.36],0.045,0.035,SCALE,SC,part,ex); for(let c=0;c<3;c++)lit(sd*0.19+(c-1)*0.04,0.01,-0.3,'v',0.85,1.5,HORN,part,ex); }
  const neck=[[0,0.86,0.42],[0,1.04,0.54],[0,1.2,0.66]]; for(let i=0;i<neck.length-1;i++)tube(neck[i],neck[i+1],0.14-i*0.035,0.105-i*0.025,SCALE,(ox,oy)=>oy<-0.5?BELLY:SC,'head');
  ell([0,1.26,0.78],0.09,0.08,0.14,SCALE,(nx,ny)=>ny<-0.4?BELLY:SC,'head');
  for(const sd of [-1,1]){ stroke([sd*0.06,1.27,0.86],[sd*0.02,1.22,1.04],SC,1.3,0.9,'head'); stroke([sd*0.06,1.19,0.84],[sd*0.015,1.16,1.0],SC,1.0,0.85,'head');
    stroke([sd*0.04,1.33,0.8],[sd*0.09,1.33,0.9],HORN,1.8,0.95,'head'); lit(sd*0.07,1.29,0.9,'.',0.85,3.4,[1,0.8,0.3],'head'); lit(sd*0.12,1.22,0.78,sd<0?'<':'>',0.95,1.7,HORN,'head');
    stroke([sd*0.05,1.34,0.76],[sd*0.11,1.48,0.58],HORN,1.6,1,'head'); stroke([sd*0.11,1.48,0.58],[sd*0.14,1.52,0.4],HORN,1.6,0.9,'head'); lit(sd*0.14,1.54,0.36,'<',0.95,1.9,HORN,'head'); }
  lit(0,1.2,1.06,'v',0.85,1.4,HORN,'head'); for(let k=0;k<4;k++)lit((mr()-0.5)*0.04,1.17,1.04+k*0.015,mpick(['*','\'']),0.85,3.0,EMB,'head');
  const tail=[[0,0.64,-0.58],[0.08,0.52,-0.92],[0.22,0.34,-1.2],[0.28,0.16,-1.45]]; for(let i=0;i<tail.length-1;i++)tube(tail[i],tail[i+1],0.12-i*0.035,0.085-i*0.03,SCALE,SC,'tail',{piv:i});
  for(const sd of [-1,1])stroke([0.28,0.16,-1.45],[0.28+sd*0.08,0.12,-1.58],HORN,1.6,0.9,'tail',{piv:3}); lit(0.28,0.12,-1.62,'^',1.1,1.8,HORN,'tail',{piv:3});
  for(let k=0;k<12;k++){ const z=0.66-k*0.12, top=z>0.42?1.28-(0.66-z)*1.6:z>-0.6?prof(z)[2]+prof(z)[1]:0.64-(-0.6-z)*0.4, h=0.06+0.1*Math.max(0,1-Math.abs(z-0.3)/0.7); stroke([0,top,z],[0,top+h,z-0.06],HORN,1.6,0.9,'body'); }
  // dragon wings: an arm bone to the wrist, four finger bones fanning back, membrane filled between them with a scalloped trailing edge, a claw at the wrist.
  // drawn in the wing's own plane (r = out from the body, z = along it); the 'wing' motion raises them in a V and opens and closes them
  const WY=0.9, sh=[0.12,0.32], wr=[0.85,0.46], tips=[[1.6,0.22],[1.55,-0.36],[1.22,-0.86],[0.7,-1.06]];
  for(const sd of [-1,1]){ const W=(r,z,ch,b,col,s2)=>lit(0,WY,z,ch,s2||1,b,col,'wing',{sd,r});
    const bone=(a,b2,thick)=>{ const n=Math.max(2,Math.round(Math.hypot(b2[0]-a[0],b2[1]-a[1])/(S*0.75))); for(let k=0;k<=n;k++){ const f=k/n; W(a[0]+(b2[0]-a[0])*f,a[1]+(b2[1]-a[1])*f,thick?'=':'-',1.6,HORN,thick?1.1:1); } };
    bone(sh,wr,true); W(wr[0],wr[1]+0.06,'^',2.2,HORN,1.1); for(const tp of tips)bone(wr,tp,false);
    // membrane: fill each triangle (wrist, tip_i, tip_i+1) and (shoulder, wrist, last tip); trailing edge bows inward between tips
    const tris=[[wr,tips[0],tips[1]],[wr,tips[1],tips[2]],[wr,tips[2],tips[3]],[sh,wr,tips[3]]];
    for(const [A,B,C] of tris){ const st=S*0.85, la=Math.hypot(B[0]-A[0],B[1]-A[1]), lb=Math.hypot(C[0]-A[0],C[1]-A[1]), nu=Math.max(2,Math.round(la/st)), nv=Math.max(2,Math.round(lb/st));
      for(let i=1;i<nu;i++)for(let j=1;j<nv;j++){ const u=i/nu, v=j/nv; if(u+v>=0.98)continue; const bow=0.18*Math.sin(Math.PI*v/(u+v||1))*(u+v);
        const r=A[0]+(B[0]-A[0])*u+(C[0]-A[0])*v, z=A[1]+(B[1]-A[1])*u+(C[1]-A[1])*v; const cx=(B[0]+C[0])/2, cz=(B[1]+C[1])/2; if(u+v>0.82&&Math.hypot(r-cx,z-cz)<bow*0.9)continue;
        W(r,z,mpick(['%',':','#','.']),0.85+0.25*mr(),MEM); } }
    for(let i=0;i<tips.length-1;i++){ const B=tips[i], C=tips[i+1]; for(let k=1;k<6;k++){ const f=k/6, r=B[0]+(C[0]-B[0])*f, z=B[1]+(C[1]-B[1])*f, inw=0.16*Math.sin(Math.PI*f); const dr=wr[0]-r, dz=wr[1]-z, dl=Math.hypot(dr,dz)||1; W(r+dr/dl*inw,z+dz/dl*inw,'~',1.3,[0.75,0.3,0.28]); } } }
  return pts; }
function nagaForm(ty){ const {S,pts,lit,stroke,ell,tube}=q3(ty), SC=ty.col, SKIN=[0.78,0.82,0.7], WOOD=[0.55,0.4,0.25], MET=[0.85,0.88,0.95];
  const path=[]; for(let k=0;k<=14;k++){ const f=k/14; path.push([Math.sin(f*Math.PI*1.6)*0.3,0.1+0.25*Math.max(0,f-0.6)/0.4,-0.9+f*0.95]); }
  for(let i=0;i<path.length-1;i++)tube(path[i],path[i+1],0.06+0.08*(i/path.length),0.06+0.08*((i+1)/path.length),SCALE,(ox,oy)=>oy<-0.4?[0.86,0.86,0.6]:SC,'slither');
  for(let y=0.35;y<=0.85;y+=S*0.85){ const f=(y-0.35)/0.5, rx=0.12+0.05*f, n=Math.max(5,Math.round(2*Math.PI*rx/(S*0.85))); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; lit(Math.cos(a)*rx,y,0.05+Math.sin(a)*rx*0.75,mpick(['o','%',':']),1,1.0,SKIN); } }
  ell([0,1.0,0.06],0.09,0.1,0.09,SKINR,()=>SKIN,'head'); for(const sd of [-1,1]){ lit(sd*0.035,1.02,0.15,'.',0.8,3,[1,0.9,0.4],'head'); lit(sd*0.12,0.95,0.02,sd<0?'(':')',1.1,1.4,SC,'head'); }
  for(const sd of [-1,1])tube([sd*0.16,0.82,0.05],[sd*0.22,0.55,0.25],0.045,0.04,SKINR,SKIN,sd<0?'armL':'armR',{piv:0.82,pz:0});
  stroke([0.22,0.2,0.28],[0.22,1.3,0.28],WOOD,1.1,0.9,'armR',{piv:0.82,pz:0}); lit(0.22,1.36,0.28,'^',1.1,2.4,MET,'armR',{piv:0.82,pz:0});
  return pts; }
function krakenForm2(ty){ const {S,pts,lit,ell}=q3(ty), BODY=[0.28,0.5,0.6], SUCK=[0.7,0.9,0.95], EYE=[1,0.3,0.25];
  ell([0,0.18,0],0.38,0.4,0.36,SCALE,()=>BODY,'body',null,(nx,ny)=>ny<-0.3);
  for(const sd of [-1,1]){ lit(sd*0.12,0.3,0.34,'*',1,3.8,EYE,'eye'); }
  for(let ti=0;ti<4;ti++){ const a0=ti/4*Math.PI*2+0.4; for(let i=0;i<=14;i++){ const t2=i/14, r=0.35+0.55*t2, y=0.9*Math.sin(Math.PI*Math.min(1,t2*1.1)), x=Math.cos(a0)*r, z=Math.sin(a0)*r;
      lit(x,y,z,mpick(['%','~',':']),1,1.0,BODY,'tent',{piv:i*0.45,ti}); if(i%2===0)lit(x,y-0.06,z,'o',0.8,1.6,SUCK,'tent',{piv:i*0.45,ti}); } }
  return pts; }
function caveSpiderForm(ty){ const {S,pts,lit,ell,tube}=q3(ty), BR=[0.45,0.34,0.26], OCH=[0.85,0.68,0.35], EYE=[1,0.3,0.25];
  ell([0,0.38,0.12],0.16,0.12,0.16,FUR,()=>BR,'body'); ell([0,0.42,-0.28],0.24,0.2,0.28,FUR,(nx,ny,nz)=>ny>0.5&&Math.abs(Math.sin(nz*9))>0.6?OCH:BR,'body');
  for(let r=0;r<2;r++)for(let k=0;k<4;k++)lit((k-1.5)*0.04,0.44+r*0.04,0.27,'.',0.7,3.4,EYE,'head');
  for(const sd of [-1,1])lit(sd*0.03,0.32,0.3,'v',0.8,1.6,[0.9,0.88,0.8],'head');
  for(const sd of [1,-1])for(let k=0;k<4;k++){ const hz=0.22-k*0.1, part=((k%2===0)===(sd>0))?'legL':'legR', ex={piv:0.38,pz:hz}, knee=[sd*0.52,0.78,hz+(1.5-k)*0.14], foot=[sd*0.88,0.02,hz+(1.5-k)*0.32];
    tube([sd*0.12,0.38,hz],knee,0.04,0.035,FUR,BR,part,ex); tube(knee,foot,0.035,0.02,FUR,BR,part,ex); }
  return pts; }
function batForm(ty){ const {S,pts,lit,ell}=q3(ty), FURC=[0.3,0.24,0.26], MEM=[0.45,0.2,0.32], EYE=[1,0.25,0.25];
  ell([0,0,0],0.13,0.12,0.15,FUR,()=>FURC,'body');
  for(const sd of [-1,1]){ lit(sd*0.08,0.16,0.04,'^',1.1,1.3,FURC,'body'); lit(sd*0.04,0.03,0.13,'.',0.8,3.4,EYE,'body'); lit(sd*0.02,-0.05,0.14,'v',0.7,2.2,[0.95,0.95,0.9],'body');
    for(let k=0;k<4;k++){ const r=0.18+k*0.15; lit(0,0.06-k*0.01,0.02,'-',1,1.4,[0.6,0.5,0.5],'wing',{sd,r}); for(let q=1;q<3;q++)lit(0,0.06-k*0.01-q*0.07,0.02-q*0.02,mpick(['%',':']),1,1.0,MEM,'wing',{sd,r:r*(1-q*0.12)}); } }
  return pts; }

// ---------------------------------------------------------------- the sleeping dragon: curled low, the tail wrapped round the front, the neck bent in an S with the head resting on its coil,
// wings folded along the back, legs tucked under; the whole body breathing slowly
function dragonSleepForm(ty){ const {S,pts,lit,stroke,ell,tube}=q3(ty), SC=ty.col, BELLY=[0.95,0.78,0.5], MEM=[0.55,0.18,0.18], HORN=[0.88,0.84,0.72], EMB=[1,0.55,0.18];
  const spl=(ctrl,step)=>{ const out=[]; for(let i=0;i<ctrl.length-1;i++)for(let t=0;t<1;t+=step){ const a=ctrl[Math.max(0,i-1)], b=ctrl[i], c=ctrl[i+1], d=ctrl[Math.min(ctrl.length-1,i+2)], t2=t*t, t3=t2*t;
      out.push([0,1,2].map(k=>0.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3))); } out.push(ctrl[ctrl.length-1]); return out; };
  const body=spl([[-0.42,0.34,-0.3],[-0.1,0.4,-0.5],[0.28,0.44,-0.32],[0.46,0.46,0.08]],0.2);
  for(let i=0;i<body.length-1;i++){ const f=i/(body.length-1); tube(body[i],body[i+1],0.15+0.08*f,0.15+0.08*((i+1)/(body.length-1)),SCALE,(ox,oy)=>oy<-0.5?BELLY:SC,'breathe'); }
  const tail=spl([[-0.42,0.3,-0.3],[-0.6,0.14,0.12],[-0.32,0.07,0.55],[0.15,0.06,0.7],[0.55,0.05,0.5],[0.7,0.04,0.25]],0.2);
  for(let i=0;i<tail.length-1;i++){ const f=i/(tail.length-1); tube(tail[i],tail[i+1],0.12*(1-f*0.8),0.12*(1-(i+1)/(tail.length-1)*0.8),SCALE,SC,'breathe'); }
  lit(0.7,0.04,0.25,'^',1.1,1.7,HORN,'breathe');
  const neck=spl([[0.46,0.5,0.1],[0.42,0.78,0.22],[0.18,0.9,0.12],[-0.02,0.78,0.28],[0.02,0.66,0.46]],0.2);
  for(let i=0;i<neck.length-1;i++){ const f=i/(neck.length-1); tube(neck[i],neck[i+1],0.13-0.05*f,0.13-0.05*((i+1)/(neck.length-1)),SCALE,(ox,oy)=>oy<-0.5?BELLY:SC,'breathe'); }
  ell([0.03,0.64,0.58],0.09,0.07,0.14,SCALE,(nx,ny)=>ny<-0.4?BELLY:SC,'breathe'); for(const sd of [-1,1]){ stroke([0.03+sd*0.05,0.64,0.66],[0.03+sd*0.015,0.6,0.8],SC,1.3,0.9,'breathe'); lit(0.03+sd*0.055,0.68,0.66,'-',0.85,1.8,[1,0.75,0.35],'breathe');
    stroke([0.03+sd*0.05,0.72,0.55],[0.03+sd*0.1,0.8,0.38],HORN,1.6,0.95,'breathe'); lit(0.03+sd*0.12,0.82,0.33,'<',0.95,1.8,HORN,'breathe'); }
  for(let k=0;k<3;k++)lit(0.03+(mr()-0.5)*0.03,0.58,0.82+k*0.02,mpick(["'",'.']),0.8,2.4,EMB,'breathe');
  // folded wings along the back
  for(const sd of [-1,1]){ const r0=[sd*0.16,0.7,0.12], r1=[sd*0.3,0.74,-0.2], r2=[sd*0.34,0.66,-0.55]; stroke(r0,r1,HORN,1.5,1,'breathe'); stroke(r1,r2,HORN,1.4,0.95,'breathe');
    for(let q=0;q<28;q++){ const u=mr(), v=mr()*(1-u); lit(r0[0]+(r1[0]-r0[0])*u+(r2[0]-r0[0])*v-sd*0.06*v,r0[1]+(r1[1]-r0[1])*u+(r2[1]-r0[1])*v-0.12*v,r0[2]+(r1[2]-r0[2])*u+(r2[2]-r0[2])*v,mpick(['%',':','#']),1,0.9,MEM,'breathe'); } }
  // tucked legs: front paws before the chest, a hind haunch
  for(const sd of [-1,1]){ tube([0.42+sd*0.12,0.3,0.22],[0.4+sd*0.14,0.06,0.38],0.06,0.045,SCALE,SC,'breathe'); for(let c=0;c<3;c++)lit(0.4+sd*0.14+(c-1)*0.035,0.02,0.44,'v',0.8,1.4,HORN,'breathe'); }
  ell([-0.32,0.28,-0.12],0.14,0.14,0.16,SCALE,()=>SC,'breathe');
  // a spined ridge along the curled back
  for(let i=0;i<body.length;i+=1){ const p=body[i]; stroke([p[0],p[1]+0.18,p[2]],[p[0],p[1]+0.28,p[2]-0.04],HORN,1.5,0.85,'breathe'); }
  return pts; }

// ---------------------------------------------------------------- the dead, their own bodies: the lich (a floating skeletal mage) and the wraith (a heap of rags with claws)
function lichForm(ty){ const {S,pts,lit,stroke,ell,tube}=q3(ty); pts.noExtra=true;
  const BONE=[0.9,0.88,0.8], ROBE=[0.45,0.35,0.6], GOLD=[0.85,0.7,0.38], ICE=[0.6,0.88,1.0], MIST=[0.55,0.55,0.75], BOOK=[0.6,0.45,0.85];
  // the robe, its hem unravelling into mist above the floor
  for(let y=0.28;y<=1.3;y+=S*0.85){ const f=(y-0.28)/1.02, r=0.32-0.1*f, n=Math.max(6,Math.round(2*Math.PI*r/(S*0.9)));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; if(f<0.25&&mr()<0.35*(1-f/0.25))continue; lit(Math.cos(a)*r,y,Math.sin(a)*r*0.85,mpick(['%',':','|','#']),1,0.75+0.35*Math.max(0,Math.cos(a-0.8)),ROBE,'robe'); } }
  for(let k=0;k<16;k++){ const a=mr()*6.28, r=0.25+mr()*0.15; lit(Math.cos(a)*r,0.08+mr()*0.2,Math.sin(a)*r,mpick(['~','.']),0.9,0.8,MIST,'robe'); }
  // ribs glimpsed at the open chest
  for(let r=0;r<4;r++)for(const sd of [-1,1])lit(sd*0.08,1.12-r*0.08,0.2,sd<0?'(':')',0.9,1.4,BONE);
  // the skull, cold eyes, a faded crown
  ell([0,1.5,0.02],0.13,0.14,0.13,SKINR,()=>BONE,'head'); for(const sd of [-1,1])lit(sd*0.05,1.52,0.14,'*',0.9,3.8,ICE,'head'); lit(0,1.4,0.14,'=',0.85,1.4,BONE,'head');
  for(let k=0;k<9;k++){ const a=k/9*Math.PI*2; lit(Math.cos(a)*0.12,1.65,Math.sin(a)*0.11,k%2?'^':'=',0.9,1.8,GOLD,'head'); }
  // a bony arm with a bone staff, its head lit cold; the other hand open
  stroke([0.26,1.25,0.06],[0.34,0.95,0.14],BONE,1.3,0.9,'body'); stroke([0.38,0.15,0.14],[0.38,1.85,0.14],[0.7,0.66,0.6],1.1,0.9,'body'); lit(0.38,1.92,0.14,'@',1.3,3.6,ICE,'body');
  stroke([-0.26,1.25,0.06],[-0.36,1.05,0.3],BONE,1.3,0.9,'body'); for(let f2=0;f2<4;f2++)lit(-0.36+(f2-1.5)*0.03,1.02,0.38,"'",0.8,1.4,BONE,'body');
  // a book circling, its pages turning
  for(const [ch,dy] of [['#',0],['=',0.08],['=',-0.08]])lit(0,1.0+dy,0,ch,1.05,2.2,BOOK,'orbit',{r:0.6,sp:0.7,ph:0});
  lit(0,1.12,0,'~',0.9,2.8,ICE,'orbit',{r:0.6,sp:0.7,ph:0.12});
  return pts; }
function wraithForm2(ty){ const {S,pts,lit,stroke,ell}=q3(ty); pts.noExtra=true;
  const RAG=[0.34,0.33,0.38], EYE=[0.55,1.0,0.6], CLAW=[0.82,0.88,0.92];
  // a heap of rags leaning forward, the hood dark inside
  for(let y=0.2;y<=1.4;y+=S*0.85){ const f=(y-0.2)/1.2, r=0.3-0.1*f, lean=0.18*f, n=Math.max(6,Math.round(2*Math.PI*r/(S*0.9)));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; if(mr()<0.12)continue; lit(Math.cos(a)*r,y,Math.sin(a)*r*0.85+lean,mpick(['%','#',':','|']),1,0.6+0.3*Math.max(0,Math.cos(a-0.8)),RAG,'robe'); } }
  for(let i=0;i<20;i++){ const y=1-2*(i+0.5)/20, rr=Math.sqrt(1-y*y), a=i*2.39996, nz=Math.sin(a)*rr; if(nz>0.5&&y<0.5)continue; if(y<-0.4)continue; lit(Math.cos(a)*rr*0.2,1.5+y*0.2,0.18+nz*0.2,mpick(['%','#']),1,0.75,RAG,'head'); }
  for(const sd of [-1,1])lit(sd*0.05,1.48,0.34,'*',0.85,3.6,EYE,'head');
  // long sleeves reaching forward, long claws
  for(const sd of [-1,1]){ stroke([sd*0.24,1.25,0.2],[sd*0.3,1.05,0.55],RAG,1.0,1,'body'); for(let c=0;c<4;c++)stroke([sd*0.3,1.03,0.58],[sd*(0.28+0.04*(c-1.5)),0.86-0.03*c,0.82],CLAW,2.0,0.85,'body'); }
  // rag strips trailing behind from the hem
  for(let k=0;k<9;k++){ const a=Math.PI*(1.15+0.7*k/8), x=Math.cos(a)*0.28, z=Math.sin(a)*0.24; for(let q=0;q<5;q++)lit(x*(1+q*0.05),0.22-q*0.03,z-0.08*q,q%2?'\\\\':'|',0.95,0.8,RAG,'robe'); }
  return pts; }

// ---------------------------------------------------------------- the phantom's hidden shape (only glimpsed)
function phantomForm(ty){ const {S,pts,lit,stroke,ell}=q3(ty); pts.noExtra=true;
  // the hidden shape, glimpsed only: a wailing ghost - hollow eyes, an open mouth, long hair streaming back, a veil over head and shoulders,
  // faint collarbones and ribs with a soft light within, one arm reaching with long fingers, the other hanging in a torn sleeve, a ragged hem fraying into wisps
  const C=[0.75,0.85,1.0], DIM=[0.5,0.58,0.75], HOLLOW=[0.08,0.1,0.18], CORE=[0.85,0.92,1.0];
  // head: a pale face with dark hollows
  for(let i=0;i<22;i++){ const y=1-2*(i+0.5)/22, rr=Math.sqrt(1-y*y), a=i*2.39996, nz=Math.sin(a)*rr; lit(Math.cos(a)*rr*0.12,1.56+y*0.14,0.04+nz*0.12,nz>0.3?':':'.',1,0.8+0.5*Math.max(0,nz),C,'head'); }
  for(const sd of [-1,1]){ lit(sd*0.045,1.58,0.16,'O',0.85,0.6,HOLLOW,'head'); lit(sd*0.045,1.58,0.17,'.',0.6,1.6,CORE,'head'); }
  lit(0,1.47,0.16,'O',0.95,0.5,HOLLOW,'head'); lit(0,1.44,0.15,'o',0.7,0.9,C,'head');
  // a veil over the head, falling over the shoulders and back
  for(let k=0;k<14;k++){ const a=Math.PI*(0.15+0.7*k/13), x=Math.cos(a)*0.16, z=-Math.sin(a)*0.13; for(let q=0;q<5;q++)lit(x*(1+q*0.35),1.68-q*0.12,z*(1+q*0.2)-0.02*q,q===0?'^':(x>0?'\\':'/'),0.95,0.9-q*0.1,DIM,'robe'); }
  // long hair streaming back and down
  for(let h=0;h<7;h++){ const x0=(h-3)*0.04; for(let q=0;q<9;q++){ const f=q/8; lit(x0*(1+f),1.62-f*0.55,-0.1-f*0.32,q%2?')':'~',0.9,1.0-0.4*f,C,'tendril',{piv:q}); } }
  // the body: shoulders, faint collarbones and ribs, a soft light within; it thins and frays below
  for(let y=0.4;y<=1.38;y+=S*0.85){ const f=(y-0.4)/0.98, r=0.06+0.2*Math.pow(f,1.3), n=Math.max(4,Math.round(2*Math.PI*r/(S*0.9))); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; if(f<0.35&&mr()<0.55*(1-f/0.35))continue; lit(Math.cos(a)*r,y,Math.sin(a)*r*0.75,Math.abs(Math.cos(a))>0.8?'|':mpick([':','.','\'']),1,0.7+0.4*f,C,'robe'); } }
  for(const sd of [-1,1]){ stroke([sd*0.02,1.36,0.14],[sd*0.2,1.38,0.08],C,1.4,0.85); for(let r=0;r<4;r++)lit(sd*0.08,1.24-r*0.07,0.15,sd<0?'(':')',0.85,1.0,DIM); }
  lit(0,1.15,0.1,'*',1.2,2.2,CORE); lit(0,1.15,0.1,'o',1.6,0.7,CORE);
  // one arm reaching, long fingers; the other hanging in a torn sleeve
  stroke([0.22,1.34,0.04],[0.34,1.22,0.4],C,1.1,0.95); stroke([0.34,1.22,0.4],[0.38,1.24,0.68],C,1.1,0.9);
  for(let c=0;c<5;c++){ const sp=(c-2)*0.03; stroke([0.38+sp,1.24,0.7],[0.38+sp*1.6,1.25-Math.abs(sp)*0.6,0.86],C,1.3,0.75); }
  stroke([-0.22,1.34,0.0],[-0.28,1.0,0.06],C,1.0,0.95); stroke([-0.28,1.0,0.06],[-0.28,0.78,0.1],C,1.0,0.9);
  for(let k=0;k<5;k++)lit(-0.28+(k-2)*0.035,0.95-((k*7)%3)*0.05,0.1,k%2?'\\':'/',0.9,0.8,DIM,'robe');
  // the ragged hem fraying into wisps that trail behind
  for(let w=0;w<6;w++){ const a=Math.PI*(1.1+0.8*w/5), x=Math.cos(a)*0.1, z=Math.sin(a)*0.08; for(let q=0;q<8;q++){ const f=q/7; lit(x*(1+f),0.5-f*0.35,z-f*0.45,q%2?'~':'\'',0.85,0.9-0.5*f,C,'tendril',{piv:q*1.2}); } }
  return pts; }

// ---------------------------------------------------------------- the forgotten beast, built from parts by its chronicle: a body by kind (beast, dragon, serpent, moth, centipede),
// features laid over it (six legs, wingless, a thousand eyes, burning scales, shadow-eating, singing), a main colour and an accent; it sleeps crouched and rises when it wakes
const BEAST_S={scale:2.35};   // glyphs of about 0.3 m at the beast's size
function beastAcc(col){ return [Math.min(1,col[2]*0.9+0.25),Math.min(1,col[0]*0.9+0.15),Math.min(1,col[1]*0.9+0.2)]; }
function beastForm2(ty){
  const spec=ty.spec, C=ty.col, A=beastAcc(C), H=q3(BEAST_S), {S,pts,lit,stroke,ell,tube,put}=H;
  const R=['.',':',...spec.glyphs.slice(0,2),'#'], BONE=[0.9,0.86,0.76], EYE=[1,0.85,0.35];
  if(spec.kind==='竜'){ const d=dragonForm({...ty,scale:2.35}); for(const p of d){ if(!p.col||p.col===ty.col)p.col=C; } pts.push(...d); }
  else if(spec.plan==='quad'){
    tube([0,0.5,-0.5],[0,0.7,0.35],0.24,0.3,R,(ox,oy)=>oy<-0.5?A:C,'body',null,0.2); ell([0,0.95,0.22],0.24,0.18,0.24,R,()=>C,'body');
    for(let z=-0.45;z<=0.42;z+=0.13)for(const x of [-0.14,0,0.14]){ const top=0.5+0.2*(z+0.5)/0.85+(Math.abs(z-0.22)<0.2?0.38:0.28); lit(x,top,z,'#',1.05,1.4,A,'body'); lit(x,top+0.07,z-0.02,'^',1,1.6,A,'body'); }
    const legs=spec.legs===6?[[0.34,0.62],[-0.05,0.58],[-0.45,0.55]]:[[0.34,0.62],[-0.45,0.55]];
    legs.forEach(([z,top],k)=>{ for(const sd of [-1,1]){ const part=((k%2===0)===(sd>0))?'legL':'legR', ex={piv:top,pz:z}; tube([sd*0.24,top,z],[sd*0.3,0.22,z+0.06],0.11,0.08,R,C,part,ex,0.2); tube([sd*0.3,0.22,z+0.06],[sd*0.3,0.03,z+0.1],0.08,0.07,R,C,part,ex); for(let c=0;c<3;c++)lit(sd*0.3+(c-1)*0.05,0.01,z+0.18,'v',0.9,1.5,BONE,part,ex); } });
    ell([0,0.56,0.78],0.18,0.15,0.2,R,(nx,ny)=>ny<-0.4?A:C,'head'); for(const sd of [-1,1]){ lit(sd*0.08,0.6,0.95,'*',1,3.4,EYE,'head'); stroke([sd*0.12,0.66,0.8],[sd*0.3,0.84,0.62],BONE,1.6,1,'head'); stroke([sd*0.3,0.84,0.62],[sd*0.36,0.8,0.42],BONE,1.6,1,'head'); lit(sd*0.07,0.42,0.95,'^',1,2.2,BONE,'head'); }
    tube([0,0.5,-0.55],[0,0.28,-1.0],0.14,0.05,R,C,'tail',{piv:1});
  } else if(spec.plan==='serpent'){
    const coil=[]; for(let t=0;t<=1;t+=0.04){ const a=t*Math.PI*2*2.2, r=0.85-0.45*t; coil.push([Math.cos(a)*r,0.18+0.3*t,Math.sin(a)*r]); }
    for(let i=0;i<coil.length-1;i++)tube(coil[i],coil[i+1],0.22,0.22,R,(ox,oy)=>oy<-0.4?A:C,'body');
    const e=coil[coil.length-1], neck=[e,[e[0]*0.5,0.8,e[2]*0.5+0.15],[0,1.15,0.45],[0,1.2,0.75]]; for(let i=0;i<neck.length-1;i++)tube(neck[i],neck[i+1],0.2-i*0.03,0.18-i*0.03,R,(ox,oy)=>oy<-0.4?A:C,'head');
    ell([0,1.2,0.88],0.14,0.11,0.2,R,()=>C,'head'); for(const sd of [-1,1])lit(sd*0.07,1.25,1.02,'*',1,3.4,EYE,'head');
    for(let k=0;k<6;k++)stroke([0,1.3-k*0.03,0.85-k*0.1],[0,1.5-k*0.05,0.75-k*0.12],A,1.8,1,'head');
    for(let i=2;i<coil.length;i+=2){ const p=coil[i]; stroke([p[0],p[1]+0.2,p[2]],[p[0],p[1]+0.34,p[2]],A,1.4,0.9,'body'); }
  } else if(spec.plan==='moth'){
    ell([0,0,0.1],0.18,0.17,0.2,FUR,()=>C,'body'); ell([0,-0.04,-0.4],0.15,0.14,0.36,FUR,(nx,ny,nz)=>Math.sin(nz*12)>0.3?A:C,'body'); ell([0,0.02,0.36],0.12,0.11,0.11,FUR,()=>C,'head');
    for(const sd of [-1,1]){ lit(sd*0.07,0.05,0.44,'@',1.3,3.6,EYE,'head'); let pv=[sd*0.05,0.12,0.42]; for(let k=1;k<=6;k++){ const nx=[sd*(0.05+k*0.06),0.12+k*0.07,0.42+k*0.04]; stroke(pv,nx,A,1.4,0.85,'head'); lit(nx[0]+sd*0.04,nx[1]-0.02,nx[2],'-',0.7,1.2,A,'head'); pv=nx; } }
    for(const sd of [-1,1])for(let l=0;l<3;l++)stroke([sd*0.1,-0.12,0.15-l*0.1],[sd*0.2,-0.4,0.2-l*0.12],C,1.0,0.85,'body');
    for(const sd of [-1,1])for(const [z0,rmax] of [[0.08,1.35],[-0.22,0.95]])for(let r=0.2;r<=rmax;r+=S*1.0)for(let dz=-0.32;dz<=0.32;dz+=S*1.0){ const f=r/rmax, edge=Math.abs(dz)>0.3*(1-f*0.35); if(Math.abs(dz)>0.34*(1-f*0.35))continue;
      const spot=Math.hypot(r-rmax*0.6,dz)<0.12, ch=spot?(Math.hypot(r-rmax*0.6,dz)<0.05?'@':'O'):edge?'~':mpick(['%',':','.']); lit(0,0.04+dz*0.2,z0+dz,ch,1,spot?2.6:edge?1.4:0.95,spot?A:edge?A:C,'wing',{sd,r}); }
  } else if(spec.plan==='centipede'){
    const segs=14; for(let i=0;i<segs;i++){ const f=i/(segs-1), z=0.9-f*2.4, y=f<0.25?0.9-f*2.6:0.26, c=[0,y,z];
      for(let k=0;k<12;k++){ const a=k/12*Math.PI, x=Math.cos(a)*0.22, yy=Math.sin(a)*0.16; lit(c[0]+x,c[1]+yy,c[2],k===0||k===11?'=':mpick(['#','%','=']),1,1.0+0.4*Math.sin(a),k===0||k===11?A:C,'seg',{piv:i}); }
      for(const sd of [-1,1]){ const part=(i%2===0)===(sd>0)?'legL':'legR', top=c[1]; stroke([sd*0.22,top,z],[sd*0.42,top+0.1,z+0.04],C,1.1,0.9,part,{piv:top,pz:z}); stroke([sd*0.42,top+0.1,z+0.04],[sd*0.5,0.02,z+0.08],C,1.1,0.9,part,{piv:top,pz:z}); } }
    const hd=[0,0.98,1.0]; ell(hd,0.15,0.12,0.14,R,()=>C,'head'); for(const sd of [-1,1]){ lit(sd*0.07,1.02,1.12,'*',1,3.2,EYE,'head'); stroke([sd*0.08,0.92,1.12],[sd*0.16,0.86,1.3],A,1.8,1,'head'); stroke([sd*0.16,0.86,1.3],[sd*0.06,0.84,1.4],A,1.8,1,'head');
      let pv=[sd*0.06,1.08,1.1]; for(let k=1;k<=6;k++){ const nx=[sd*(0.06+k*0.05),1.08+k*0.08,1.1+k*0.07]; stroke(pv,nx,A,1.3,0.85,'head'); pv=nx; } }
  }
  // features over the body
  if(!spec.wings)for(let i=pts.length-1;i>=0;i--)if(pts[i].part==='wing'&&spec.plan!=='moth')pts.splice(i,1);
  const bodyPts=pts.filter(p=>p.part!=='wing');
  if(spec.eyes>0)for(let k=0;k<32;k++){ const p=bodyPts[Math.floor(mr()*bodyPts.length)]; lit(p.x*1.02,p.y+0.01,p.z*1.02,mr()<0.5?'o':'*',0.9,3.2,[1,0.9,0.4],p.part,{piv:p.piv,pz:p.pz,ti:p.ti}); }
  if(spec.fire){ for(let k=0;k<50;k++){ const p=bodyPts[Math.floor(mr()*bodyPts.length)]; p.col=[1,0.4,0.12]; p.g=G(mpick(['/','\\'])); p.b=2.4; }
    const tops=bodyPts.slice().sort((a,b)=>b.y-a.y).slice(0,14); for(const p of tops)for(let q=0;q<3;q++){ const f=q/2; lit(p.x,p.y+0.06+f*0.14,p.z,'^',1-f*0.3,2.2+1.2*f,[1,0.3+0.55*f,0.08+0.4*f],'flame',{fh:f}); } }
  if(spec.shadow){ for(const p of pts){ if(p.col===EYE)continue; if(mr()<0.22){ p.col=[0.88,0.84,1.0]; p.b=2.2; } else { p.col=[0.24,0.17,0.38]; p.b*=0.6; } } }
  if(spec.sing){ const tops=bodyPts.slice().sort((a,b)=>b.y-a.y).slice(0,7); for(const p of tops){ for(let q=0;q<3;q++){ const dx=(q-1)*0.06; for(let j=1;j<=3;j++)lit(p.x+dx*j/3,p.y+j*0.07,p.z,j===3?'*':'|',1,2.4,[0.6,0.95,1.0],'pulse'); } } }
  pts.noExtra=true; return pts;
}
// the beast asleep: crouched low, head down, wings folded
function beastSleep(form,ty){ const out=[]; for(const p of form){ const q={...p};
    if(ty.spec.plan==='moth'){ if(p.part==='wing')q.r=(p.r||0)*0.35; }
    else if(ty.spec.plan!=='serpent'){ if(p.part==='legL'||p.part==='legR'){ q.y=p.y*0.35; q.piv=(p.piv||0)*0.35; q.part='body'; } else if(p.part==='head'){ q.y=Math.max(0.08,p.y*0.38); q.z=p.z*0.95; } else if(p.part==='wing'){ q.r=(p.r||0)*0.4; q.y=(p.y||0)*0.6; } else q.y=p.y*0.6; }
    out.push(q); } return out; }
// the beasts met, kept across adventures (the bestiary lists each by name)
function loadBeasts(){ try{ return JSON.parse(localStorage.getItem('al_beasts')||'[]'); }catch(e){ return []; } }
function recordBeast(ty){ try{ const all=loadBeasts(); if(all.some(b=>b.seed===runSeed&&b.name===ty.name))return; all.push({seed:runSeed,name:ty.name,col:ty.col,spec:ty.spec,lore:ty.lore,scale:ty.scale,fl:ty.fl,flier:ty.flier}); if(runStats)runStats.beastsNew=(runStats.beastsNew||0)+1; localStorage.setItem('al_beasts',JSON.stringify(all.slice(-60))); }catch(e){} }
function beastSamples(){ const K=[['獣','六本脚の','quad'],['竜','燃える鱗の','quad'],['大蛇','千の眼を持つ','serpent'],['蛾','歌う','moth'],['百足','影を喰らう','centipede']];
  return K.map(([kind,feat,plan],i)=>({seed:-1-i,name:`${feat}${kind}（見本）`,col:feat==='燃える鱗の'?[1.0,0.42,0.14]:feat==='影を喰らう'?[0.5,0.32,0.8]:hsl2rgb(i*0.21+0.05,0.75,0.6),
    spec:{plan,kind,legs:feat==='六本脚の'?6:4,wings:kind==='竜'||kind==='蛾',eyes:feat==='千の眼を持つ'?26:0,fire:feat==='燃える鱗の',shadow:feat==='影を喰らう',sing:feat==='歌う',glyphs:[['#','%','&'],['=','~','x'],['%','*','#'],['&','8','%'],['#','=','%']][i]},
    lore:'開発用の見本。冒険で出会った獣は、名前と年代記の一節とともにここへ記される。',scale:plan==='moth'?3.0:3.6,fl:plan==='moth'?2.4:0,flier:plan==='moth'})); }

function buildForm(ty){ const pts=buildForm0(ty); extraLook(ty,pts); return pts; }
function buildForm0(ty){
  if(ty.form==='wraith'&&!ty.boss){ if(ty.look==='lich')return lichForm(ty); if(ty.look==='wraith')return wraithForm2(ty); if(ty.invisible)return phantomForm(ty); }
  if(!ty.boss){ const F={troll:trollForm2,golem:golemForm2,bog:bogForm2,dragon:dragonForm,naga:nagaForm,kraken:krakenForm2,spider:caveSpiderForm,bat:batForm}[ty.form]; if(F)return F(ty); }
  if(ty.form==='quad'){ const F={rat:ratForm,jackal:jackalForm,grazer:grazerForm,salamander:salamanderForm}[ty.look]; if(F&&!ty.boss)return F(ty); }
  if(ty.form==='humanoid'&&ty.look==='ogre')return ogreForm(ty);
  if(ty.form==='humanoid'&&ty.look&&LOOK_PROP[ty.look]!==undefined||ty.form==='humanoid'&&ty.look==='snapjaw')return humanoid2(ty);
  { const F={jelly:jellyForm,bloat:bloatForm,orb:wispForm,eel:eelForm,snake:snakeForm,fish:fishForm,shroom:shroomForm,crab:crabForm}[ty.form]; if(F&&!ty.boss)return F(ty); }
  if(ty.form==='lichking')return lichKingForm();
  if(ty.form==='spiderqueen')return spiderQueenForm();
  if(ty.form==='nagaqueen')return nagaQueenForm();
  if(ty.form==='olddragon')return oldDragonForm();
  if(ty.form==='shadowking')return shadowKingForm();
  if(ty.form==='shadowserpent')return shadowSerpentForm();
  if(ty.form==='deepkraken')return deepKrakenForm();
  if(ty.form==='snake')return beastForm({plan:'serpent',kind:'大蛇',legs:0,wings:false,eyes:0,glyphs:['~','s','='],core:ty.ch});
  if(ty.form==='troll')return trollForm();
  if(ty.form==='golem')return golemForm();
  if(ty.form==='bog')return bogForm();
  if(ty.form==='kraken')return krakenForm();
  if(ty.form==='dragon')return beastForm({plan:'quad',kind:'竜',legs:4,wings:true,eyes:0,glyphs:['#','%','&'],core:ty.ch});
  if(ty.form==='naga')return beastForm({plan:'serpent',kind:'大蛇',legs:0,wings:false,eyes:0,glyphs:['~','=','%'],core:ty.ch});
  if(ty.form==='spider')return spiderForm();
  if(ty.form==='robot')return robotForm();
  if(ty.form==='cleaner')return cleanerForm(ty);
  if(ty.form==='repairer')return repairerForm(ty);
  if(ty.form==='watcher')return watcherForm(ty);
  if(ty.form==='fish'||ty.form==='shroom'||ty.form==='crab')return critterForm(ty);
  if(ty.form==='beast')return beastForm2(ty);
  const L=ty.ch, pts=[];
  const add=(x,y,z,ch,s,b,part,piv,pz)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:piv||0,pz:pz||0});
  const fib=(n,r,cx,cy,cz,set,s,b,part)=>{ for(let i=0;i<n;i++){ const y=1-2*(i+0.5)/n, rr=Math.sqrt(1-y*y), a=i*2.39996; add(cx+Math.cos(a)*rr*r,cy+y*r,cz+Math.sin(a)*rr*r,mpick(set),s,b,part); } };
  switch(ty.form){
    case 'humanoid':
      fib(10,0.17,0,1.5,0,[L,L,'*'],0.15,1.6,'head');
      for(let yy=0.92;yy<=1.37;yy+=0.11)for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; add(Math.cos(a)*0.2,yy,Math.sin(a)*0.13,mpick([L,L,'#','=']),0.15,1.0,'body'); }
      for(const sd of [-1,1]){
        for(let k=0;k<5;k++){ const f=k/4; add(sd*(0.27+f*0.06),1.36-f*0.5,0,mpick([L,'|',sd<0?'/':'\\']),0.14,1.0,sd<0?'armL':'armR',1.36); }
        for(let k=0;k<6;k++){ const f=k/5; add(sd*(0.1+f*0.03),0.86-f*0.8,0,mpick([L,'|','!']),0.15,0.95,sd<0?'legL':'legR',0.86); }
      }
      add(0,1.52,0.03,L,0.44,3.2,'core');
      lookHumanoid(ty.look,pts,add,L);
      shapeHumanoid(pts,ty.look);
      break;
    case 'quad':
      for(let k=0;k<6;k++){ const z=-0.32+k*0.13; for(let j=0;j<5;j++){ const a=j/5*Math.PI*2; add(Math.cos(a)*0.15,0.42+Math.sin(a)*0.11,z,mpick([L,L,'~','=']),0.13,1.0,'body'); } }
      fib(6,0.11,0,0.55,0.44,[L,'*'],0.12,1.4,'head');
      add(0,0.57,0.48,L,0.32,3.0,'core');
      for(const [sx,sz,part] of [[1,0.26,'legL'],[-1,0.26,'legR'],[1,-0.26,'legR'],[-1,-0.26,'legL']])
        for(let k=0;k<3;k++)add(sx*0.12,0.33-k*0.13,sz,mpick(['|','!',L]),0.12,0.9,part,0.36,sz);
      for(let k=0;k<3;k++)add(0,0.48+k*0.05,-0.42-k*0.12,mpick(['~','-',L]),0.11,0.9,'tail',k);
      lookQuad(ty.look,pts,add,L);
      break;
    case 'bat':
      fib(5,0.1,0,0,0,['v','*'],0.13,1.3,'body');
      add(0,0.02,0.02,'v',0.36,2.6,'core');
      for(const sd of [-1,1])for(let k=0;k<5;k++){ const p={x:0,y:0,z:-0.02*k,g:G(mpick(['^','v','/','\\','~'])),s:0.13,b:1.1,part:'wing',ph:mr()*6.28,piv:0,pz:0,sd,r:0.12+k*0.11}; pts.push(p); }
      break;
    case 'bloat':
      fib(30,0.4,0,0,0,['o','0','.','b'],0.14,1.0,'puff');
      add(0,0,0,'b',0.5,2.6,'core');
      for(let k=0;k<4;k++)add((mr()-0.5)*0.3,-0.45-k*0.1,(mr()-0.5)*0.3,mpick([':','\'','.']),0.1,0.8,'tail',k);
      break;
    case 'orb':
      fib(28,0.34,0,0,0,[L,'.','*','+'],0.13,1.3,'shell');
      add(0,0,0,L,0.55,3.6,'core');
      break;
    case 'wraith':
      for(let k=0;k<7;k++){ const y=1.85-k*0.26, r=0.1+k*0.075, n=5+k*2; for(let j=0;j<n;j++){ const a=j/n*Math.PI*2+k*0.4; add(Math.cos(a)*r,y,Math.sin(a)*r,mpick([L,L.toLowerCase(),'~','\'','"','|']),0.15,1.25-k*0.1,'robe'); } }
      for(const sd of [-1,1])for(let k=0;k<5;k++)add(sd*(0.2+k*0.1),1.55-k*0.06,0.1+k*0.05,mpick(['~','-',L.toLowerCase()]),0.12,0.9,'robe');
      add(0,1.9,0,L,0.46,3.2,'core');
      break;
    case 'eel':
      for(let i=0;i<12;i++){ const zc=1.1-i*0.27, yc=0.22+(i===0?0.3:i===1?0.12:0), rr=0.14*(1-i/16);
        for(let k=0;k<4;k++){ const a=k/4*Math.PI*2+i*0.4; add(Math.cos(a)*rr,yc+Math.sin(a)*rr,zc,mpick([L,'~','=',L]),0.15,1.0,'seg',i); } }
      add(0,0.62,1.18,L,0.4,3.0,'shead',0);
      break;
    case 'jelly':
      for(let i=0;i<56;i++){ const y=1-2*(i+0.5)/56; if(y<0)continue; const rr=Math.sqrt(1-y*y), a=i*2.39996; add(Math.cos(a)*rr*0.5,y*0.45+0.03,Math.sin(a)*rr*0.5,mpick([L,'o','~','.',L]),0.14,1.1,'jelly'); }
      for(let k=0;k<5;k++)add((mr()-0.5)*0.4,0.1+mr()*0.25,(mr()-0.5)*0.4,'.',0.12,1.6,'jelly');
      add(0,0.28,0,L,0.42,3.0,'core');
      break;
  }
  return pts;
}
function makeMonster(s){
  const ty=MTYPES[s.key];
  if(ty&&ty.golem&&!s.route&&D&&D.roomOf){ const r=D.roomOf[s.cz*MW+s.cx]>=0?D.rooms[D.roomOf[s.cz*MW+s.cx]]:null; if(r&&r.cells.length>12){ const pts=[]; for(let k=0;k<4;k++){ const c=r.cells[Math.floor(Math.random()*r.cells.length)]; if(D.tile[c]===TF&&!D.liquid[c]&&!D.solid.has(c))pts.push(c); } s.route=pts; } }
  const m={home:s.home,route:s.route,ri:0,camp:s.camp,ty,key:s.key,x:(s.cx+0.5)*CELL,z:(s.cz+0.5)*CELL,cx:s.cx,cz:s.cz,tx:s.cx,tz:s.cz,dir:[0,0],yaw:mr()*6.28,dirYaw:mr()*6.28,
    wait:mr()*2,alert:0,seen:false,visible:false,walk:mr()*10,moving:0,ph:mr()*100,form:buildForm(ty),acc:0,glow:1,y:0,
    g:s.g,isLead:s.lead,leader:null,dead:false,aware:0,noticed:false,sleep:false,mark:0,surf:0,surfT:2+mr()*6,vx:0,vz:0,vy:0,fy:1.8,flitT:0};
  if(ty.form==='eel')m.y=-0.6;
  if(ty.critter==='mimic'){ m.hidden=true; }
  initMonsterLife(m); if(s.elite){ m.maxHp=Math.round(m.maxHp*2.5); m.hp=m.maxHp; m.elite=true; }
  if(ty.conj){ m.blades=[0,1,2].map(k=>({a:k*2.094,x:m.x,y:1.5,z:m.z})); m.bladeMsg=false; }
  return m;
}
const fireAt=i=>i>=0&&i<NCELL&&fire[i]>0.1;
function fireNear(cx,cz,r){ let best=-1,bd=1e9; for(const i of burning){ if(fire[i]<=0.1)continue; const dx=i%MW-cx, dz=((i/MW)|0)-cz, d=Math.max(Math.abs(dx),Math.abs(dz)); if(d<=r&&d<bd){bd=d;best=i;} } return best; }
let fleeMsgT=-10;
const canStep=(m,i)=>(m.ty.habitat==='lava'||!fireAt(i))&&!(D.glyph&&D.glyph[i]&&!m.ty.critter)&&!(D.gate&&D.gate.o<0.7&&i===D.gate.cell)&&(m.home===undefined||D.roomOf[i]===m.home)&&(m.ty.habitat==='bog'?(D.tile[i]===TF&&D.liquid[i]===LQ_BOG):m.ty.habitat==='deep'?(D.tile[i]===TF&&D.liquid[i]===LQ_DEEP):m.ty.habitat==='amph'?(D.tile[i]===TF&&!D.solid.has(i)&&D.liquid[i]!==LQ_LAVA&&D.liquid[i]!==LQ_BOG):m.ty.habitat==='lava'?(D.tile[i]===TF&&!D.solid.has(i)&&D.liquid[i]!==LQ_DEEP&&D.liquid[i]!==LQ_WATER):m.ty.aquatic?(D.tile[i]===TF&&(D.liquid[i]===LQ_WATER||D.liquid[i]===LQ_DEEP)):m.ty.form==='eel'?(D.tile[i]===TF&&D.liquid[i]===LQ_DEEP):(D.tile[i]===TF&&!blocksWalk(D.liquid[i])&&!D.solid.has(i)));
function chooseNext(m){
  if(m.ty.form!=='eel'&&!m.leader&&m.ty.form!=='bloat'&&mr()<0.1)m.wait=1+mr()*3;
  const opts=[]; for(const d of D4){ const i=(m.cz+d[1])*MW+m.cx+d[0]; if(canStep(m,i))opts.push(d); }
  if(!opts.length)return;
  const fn=fireNear(m.cx,m.cz,2);
  if(fn>=0){
    let best=opts[0],bd=-1; for(const d of opts){ const dd=Math.hypot(m.cx+d[0]-fn%MW,m.cz+d[1]-((fn/MW)|0))+mr()*0.3; if(dd>bd){bd=dd;best=d;} }
    m.dir=best; m.tx=m.cx+best[0]; m.tz=m.cz+best[1]; m.flee=1.6;
    if(m.visible&&time-fleeMsgT>6){ fleeMsgT=time; msg(`<b style="color:${css(m.ty.col)}">${m.ty.ch}</b>${mname(m)}が炎から逃げ出した。`); }
    return;
  }
  let goal=null;
  if(m.noticed&&hostile(m)&&!(m.flee>0))goal=[player.x,player.z];
  if(!goal&&m.goal&&time<m.goalT)goal=m.goal;
  if(!goal&&m.route&&m.route.length&&!m.noticed){ const rc=m.route[m.ri%m.route.length]; if(rc===m.cz*MW+m.cx)m.ri++; goal=cpos(m.route[m.ri%m.route.length]); }
  if(!goal&&m.camp>=0&&m.camp!==undefined&&!m.noticed){ const [cx2,cz2]=cpos(m.camp); if(Math.hypot(cx2-m.x,cz2-m.z)>3.2)goal=[cx2,cz2]; else if(mr()<0.85){ m.wait=2+mr()*4; return; } }
  if(!goal&&m.ty.hound&&m.isLead&&!m.noticed){
    if(m.ty.hound==='light'&&!stealth.sneak&&Math.hypot(player.x-m.x,player.z-m.z)<22)goal=[player.x,player.z];
    else { const sd=houndScent(m); if(sd){ m.dir=sd; m.tx=m.cx+sd[0]; m.tz=m.cz+sd[1]; if(!m.tracked){ m.tracked=true; if(time-(houndScent.msgT||-99)>20){ houndScent.msgT=time; msg(`<b style="color:${css(m.ty.col)}">Z</b>どこかで${mname(m)}の群れが、あなたの匂いを嗅ぎつけた。`); sHowl(m.x,m.z); } } return; } }
  }
  if(!goal&&m.leader&&!m.leader.dead){ const L=m.leader; if(Math.hypot(L.x-m.x,L.z-m.z)>3.2)goal=[L.x,L.z]; else if(mr()<0.5){ m.wait=0.3+mr()*0.8; return; } }
  if(m.ty.form==='bloat'&&m.noticed)goal=[player.x,player.z];
  if(goal){
    let best=opts[0],bd=1e9;
    for(const d of opts){ const x=(m.cx+d[0]+0.5)*CELL, z=(m.cz+d[1]+0.5)*CELL, dd=Math.hypot(x-goal[0],z-goal[1])+mr()*0.6; if(dd<bd){bd=dd;best=d;} }
    m.dir=best; m.tx=m.cx+best[0]; m.tz=m.cz+best[1]; return;
  }
  const fwd=opts.find(o=>o[0]===m.dir[0]&&o[1]===m.dir[1]);
  const nrev=opts.filter(o=>!(o[0]===-m.dir[0]&&o[1]===-m.dir[1]));
  const ch=(fwd&&mr()<0.6)?fwd:(nrev.length?nrev[Math.floor(mr()*nrev.length)]:opts[0]);
  m.dir=ch; m.tx=m.cx+ch[0]; m.tz=m.cz+ch[1];
}
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
const visW=html=>{ const t=html.replace(/<input[^>]*size="(\d+)"[^>]*>/g,(m,n)=>' '.repeat(+n)).replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'"); let w=0;
  for(const ch of t){ const c=ch.codePointAt(0); w+=(c>=0x1100&&(c<=0x115f||(c>=0x2e80&&c<=0xa4cf)||(c>=0xac00&&c<=0xd7a3)||(c>=0xf900&&c<=0xfaff)||(c>=0xfe30&&c<=0xfe4f)||(c>=0xff00&&c<=0xff60)||(c>=0xffe0&&c<=0xffe6)||(c>=0x3000&&c<=0x30ff)))?2:1; } return w; };
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
// ---------------------------------------------------------------- small creatures (the living layer of the world; they never hunt you)
function critterForm(ty){
  const pts=[], add=(x,y,z,ch,s,b,part,piv,pz)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:piv||0,pz:pz||0});
  if(ty.form==='fish'){
    add(0,0,0.32,'>',0.22,2.0,'head');
    for(let k=0;k<4;k++)add(0,0,0.18-k*0.12,k%2?'=':'-',0.2,1.5,'body');
    add(0,0,-0.36,'<',0.24,1.4,'tail',1); add(0.09,0.02,0.05,'.',0.1,1.6,'body'); add(-0.09,0.02,0.05,'.',0.1,1.6,'body');
  } else if(ty.form==='shroom'){
    for(let k=0;k<3;k++)add(0,0.1+k*0.16,0,'|',0.18,0.8,'body');
    for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; add(Math.cos(a)*0.22,0.58,Math.sin(a)*0.22,k%2?'^':'n',0.17,1.5,'head'); }
    add(0,0.66,0,'*',0.2,2.4,'core'); for(let k=0;k<5;k++){ const a=k/5*Math.PI*2; add(Math.cos(a)*0.12,0.5,Math.sin(a)*0.12,'.',0.1,2.2,'head'); }
  } else {
    for(let i=0;i<10;i++){ const y=1-2*(i+0.5)/10, rr=Math.sqrt(1-y*y), a=i*2.39996; add(Math.cos(a)*rr*0.2,0.28+y*0.1,Math.sin(a)*rr*0.2,mpick(['&','%','o']),0.14,1.1,'body'); }
    add(0.07,0.38,0.18,'o',0.1,2.4,'head'); add(-0.07,0.38,0.18,'o',0.1,2.4,'head');
    for(const sx of [1,-1])for(const z of [0.15,0,-0.15]){ const part=((z>0)===(sx>0))?'legL':'legR'; add(sx*0.28,0.12,z,sx>0?'\\':'/',0.14,0.9,part,0.25,z); }
  }
  return pts;
}
function critterStep(m,away){
  const opts=[]; for(const d of D4){ const i=(m.cz+d[1])*MW+m.cx+d[0]; if(canStep(m,i))opts.push(d); }
  if(!opts.length)return;
  let ch;
  if(away){ let bd=-1; for(const d of opts){ const dd=Math.hypot((m.cx+d[0]+0.5)*CELL-player.x,(m.cz+d[1]+0.5)*CELL-player.z)+mr()*0.4; if(dd>bd){bd=dd;ch=d;} } }
  else if((m.ty.critter==='cleaner'||m.ty.critter==='engineer')&&m.job>=0){ const [gx,gz]=m.ty.critter==='engineer'?[D.doors[m.job].bx,D.doors[m.job].bz]:cpos(m.job); let bd=1e9; for(const d of opts){ const dd=Math.hypot((m.cx+d[0]+0.5)*CELL-gx,(m.cz+d[1]+0.5)*CELL-gz)+mr()*0.5; if(dd<bd){bd=dd;ch=d;} } }
  else if(m.ty.critter==='grazer'){ const moss=opts.filter(d=>D.surface[(m.cz+d[1])*MW+m.cx+d[0]]===SF_LUMEN); ch=moss.length&&mr()<0.8?moss[Math.floor(mr()*moss.length)]:opts[Math.floor(mr()*opts.length)]; }
  else { const fwd=opts.find(o=>o[0]===m.dir[0]&&o[1]===m.dir[1]); const nrev=opts.filter(o=>!(o[0]===-m.dir[0]&&o[1]===-m.dir[1])); ch=(fwd&&mr()<0.6)?fwd:(nrev.length?nrev[Math.floor(mr()*nrev.length)]:opts[0]); }
  m.dir=ch; m.tx=m.cx+ch[0]; m.tz=m.cz+ch[1];
}
let shriekMsgT=-99, grazeMsg=false;
function updateCritter(m,dt,t,dp){
  const ty=m.ty; m.aware=0; m.noticed=false; m.sleep=false; m.alert=0;
  const lit=!stealth.sneak;
  if(ty.critter==='shrieker'){
    m.glow=1.2+0.7*Math.pow(0.5+0.5*Math.sin(t*1.1+m.ph),2);
    if(dp<3.2&&lit&&m.visible&&time-(m.shriekT||-99)>12){
      m.shriekT=time; m.glow=3; sShriek(m.x,m.z); shake=Math.max(shake,0.12);
      for(let q=0;q<36;q++){ const a=q/36*Math.PI*2; spawn(m.x,0.7,m.z,Math.cos(a)*2.2,0.2,Math.sin(a)*2.2,0.9,G(q%2?'!':'.'),0.18,ty.col[0]*2.4,ty.col[1]*2.4,ty.col[2]*2.4,1); }
      let woke=0; for(const o of monsters){ if(o===m||o.ty.critter||o.dead)continue; if(Math.hypot(o.x-m.x,o.z-m.z)<15){ if(o.sleep||!o.noticed)woke++; o.sleep=false; o.aware=Math.max(o.aware,1.05); } }
      if(time-shriekMsgT>8){ shriekMsgT=time; msg(`<b style="color:${css(ty.col)}">p</b>${mname(m)}が甲高い叫び声を上げた！${woke?' 周りの獣たちが目を覚ます。':''}`); }
    }
    return;
  }
  if(ty.critter==='cleaner'||ty.critter==='engineer'){ if(machineWork(m,dt)){ m.yaw=lerpAngle(m.yaw,m.dirYaw,1-Math.exp(-dt*4)); return; } }
  if(ty.critter==='mimic'&&m.hidden){
    if(dp<2.3||m.revealNow){ m.hidden=false; m.flee=8; sSqueak(m.x,m.z); sChime(m.x,m.z,0.25); shake=Math.max(shake,0.1);
      msg(`<b style="color:${css(ty.col)}">q</b>浮かんでいた巻物が脚を生やし、すばやく走り去った！ ${mname(m)}だ。`);
      for(let q=0;q<24;q++){ const a=mr()*6.28; spawn(m.x,1.2,m.z,Math.cos(a)*1.2,mr(),Math.sin(a)*1.2,1,G(mpick(['?','.','*'])),0.14,1.6,1.3,0.6,1); } }
    return;
  }
  // startle: a lit lantern close by sends fish and grazers fleeing
  if((ty.critter==='fish'&&dp<4.5&&lit)||(ty.critter==='grazer'&&dp<3.5&&lit)){
    if(!(m.flee>0)){ if(ty.critter==='fish'){ sSplash(0.15); splash(m.x,m.z,ty.col); } else if(!grazeMsg&&m.visible){ grazeMsg=true; msg(`<b style="color:${css(ty.col)}">h</b>${mname(m)}が灯りに驚いて、ぱたぱたと逃げ出した。灯りを絞れば、近くで眺められる。`); } }
    m.flee=ty.critter==='fish'?1.6:3;
  }
  if(m.flee>0)m.flee-=dt;
  if(m.wait>0){ m.wait-=dt; if(m.flee>0)m.wait=0;
    // grazing: a moss cell loses its glow
    if(ty.critter==='grazer'&&m.wait<=0){ const i=m.cz*MW+m.cx; if(D.surface[i]===SF_LUMEN&&cellFlag[i]!==30){ cellFlag[i]=30; D.surface[i]=SF_GRASS; uploadCells(); } }
    m.moving+=(0-m.moving)*Math.min(1,dt*5);
  } else {
    const tx=(m.tx+0.5)*CELL, tz=(m.tz+0.5)*CELL, ddx=tx-m.x, ddz=tz-m.z, d=Math.hypot(ddx,ddz);
    if(d<0.05){ m.x=tx; m.z=tz; m.cx=m.tx; m.cz=m.tz; critterStep(m,m.flee>0);
      if(ty.critter==='grazer'&&!(m.flee>0)&&D.surface[m.cz*MW+m.cx]===SF_LUMEN&&mr()<0.35)m.wait=2+mr()*3; }
    else { const sp=ty.speed*(m.flee>0?(ty.critter==='fish'?2.6:3):1)*dt, st=Math.min(sp,d); m.x+=ddx/d*st; m.z+=ddz/d*st; m.dirYaw=Math.atan2(ddx,ddz); m.cx=Math.floor(m.x/CELL); m.cz=Math.floor(m.z/CELL); }
    m.moving+=(1-m.moving)*Math.min(1,dt*5);
  }
  m.yaw=lerpAngle(m.yaw,m.dirYaw,1-Math.exp(-dt*6));
  m.walk+=dt*m.moving*ty.speed*5.5;
  // fish now and then leap out of the water in a glowing arc
  if(ty.critter==='fish'){ m.jumpT=(m.jumpT===undefined?3+mr()*10:m.jumpT)-dt;
    if(m.jumpT<=0&&!m.jump&&dp<26){ m.jump=0.001; splash(m.x,m.z,ty.col); }
    if(m.jump){ m.jump+=dt/0.9; if(m.jump>=1){ m.jump=0; m.jumpT=5+mr()*10; splash(m.x,m.z,ty.col); sSplash(0.08); } else if(mr()<0.6)spawn(m.x,m.y+0.1,m.z,0,-0.3,0,0.6,G(mpick(['.','*'])),0.1,ty.col[0]*2.4,ty.col[1]*2.4,ty.col[2]*2.4,1); } }
  m.y=ty.critter==='fish'?-0.16+Math.sin(t*2+m.ph)*0.03+(m.jump?Math.sin(Math.PI*m.jump)*1.0:0):0;
  m.glow=ty.critter==='fish'?1.4+0.4*Math.sin(t*3+m.ph):ty.critter==='grazer'?1.5+0.3*Math.sin(t*1.2+m.ph):1.2;
}
function sShriek(x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.5);
  for(let k=0;k<2;k++){ const os=SND.ctx.createOscillator(), g=SND.ctx.createGain(); os.type='square';
    os.frequency.setValueAtTime(1300+k*230,t); os.frequency.linearRampToValueAtTime(2100+k*300,t+0.25); os.frequency.linearRampToValueAtTime(1000,t+0.9);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.1,t+0.03); g.gain.exponentialRampToValueAtTime(0.001,t+1.0); os.connect(g); g.connect(o); os.start(t); os.stop(t+1.05); } }

// ---------------------------------------------------------------- packs and hunters: spiders and their webs, hounds on your scent, snapjaw camps, ancient machines
function spiderForm(){
  const pts=[], add=(x,y,z,ch,s,b,part,piv,pz)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:piv||0,pz:pz||0});
  for(let i=0;i<10;i++){ const y=1-2*(i+0.5)/10, rr=Math.sqrt(1-y*y), a=i*2.39996; add(Math.cos(a)*rr*0.22,0.42+y*0.16,-0.18+Math.sin(a)*rr*0.26,mpick(['%','&','o']),0.15,1.0,'body'); }
  for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; add(Math.cos(a)*0.12,0.42,0.16+Math.sin(a)*0.08,'o',0.12,1.1,'head'); }
  add(0.05,0.48,0.26,'*',0.08,2.6,'head'); add(-0.05,0.48,0.26,'*',0.08,2.6,'head'); add(0.02,0.52,0.24,'.',0.06,2.4,'head'); add(-0.02,0.52,0.24,'.',0.06,2.4,'head');
  for(const sx of [1,-1])for(let k=0;k<4;k++){ const z=0.2-k*0.13, part=((k%2===0)===(sx>0))?'legL':'legR';
    add(sx*0.24,0.5,z,sx>0?'/':'\\',0.14,0.8,part,0.42,z); add(sx*0.4,0.34,z+0.02,sx>0?'\\':'/',0.14,0.8,part,0.42,z); add(sx*0.5,0.12,z+0.04,'|',0.12,0.7,part,0.42,z); }
  return pts;
}
function robotForm(){
  const pts=[], add=(x,y,z,ch,s,b,part)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0});
  for(let a=0;a<3;a++)for(let b=0;b<2;b++)for(let c=0;c<3;c++){ if(a===1&&c===1&&b===0)continue; add((a-1)*0.16,0.42+b*0.18,(c-1)*0.16,(a+b+c)%2?'#':'=',0.17,0.85,'body'); }
  add(0,0.56,0.26,'o',0.2,3.0,'core'); add(0,0.82,0,'|',0.14,0.8,'head'); add(0,0.96,0,'*',0.12,2.4,'head');
  for(const sx of [1,-1])for(let k=0;k<3;k++)add(sx*0.27,0.14,(k-1)*0.16,'=',0.15,0.7,'body');
  return pts;
}
let scent=new Float32Array(NCELL), webMsg=false, webBurnMsg=false, repairMsg=false;
function drawWebs(t){
  if(!D.webs)return;
  for(const w of D.webs){
    if(w.gone)continue;
    const [x,z]=cpos(w.i), dd=Math.hypot(x-player.x,z-player.z); if(dd>30)continue;
    if(fire[w.i]>0.1){ w.gone=true; for(let q=0;q<30;q++){ const a=mr()*6.28; spawn(x,0.6+mr()*1.6,z,Math.cos(a)*0.6,0.4+mr(),Math.sin(a)*0.6,1+mr(),G(mpick(['*','.','\''])),0.14,2.4,1.2,0.4,0); }
      if(!webBurnMsg&&dd<20){ webBurnMsg=true; msg('<b style="color:#ff9a4a">%</b>クモの巣が、ぱちぱちと音を立てて燃え落ちた。'); } continue; }
    const yaw=w.ax===0?Math.PI/2:0, tX=Math.cos(yaw), tZ=-Math.sin(yaw), sh=0.85+0.15*Math.sin(t*1.3+w.i), k=(w.shake>0?1.8:1)*sh;
    if(w.shake>0)w.shake-=1/60;
    const jit=w.shake>0?Math.sin(t*40)*0.04:0;
    for(let s2=0;s2<8;s2++){ const a=s2/8*Math.PI*2, ch=Math.abs(Math.cos(a))>0.92?'-':Math.abs(Math.sin(a))>0.92?'|':(Math.cos(a)*Math.sin(a)>0?'/':'\\');
      for(let r=1;r<=4;r++){ const u=Math.cos(a)*r*0.24+jit, v=Math.sin(a)*r*0.24; dyn(x+tX*u,1.3+v,z+tZ*u,G(ch),0.2,0.8*k,0.75*k,1.0*k,2,yaw); } }
    for(const rr of [0.42,0.84])for(let s2=0;s2<12;s2++){ const a=s2/12*Math.PI*2+0.26; dyn(x+tX*(Math.cos(a)*rr+jit),1.3+Math.sin(a)*rr,z+tZ*(Math.cos(a)*rr+jit),G(s2%3?'.':'*'),0.14,1.1*k,1.0*k,1.4*k,2,yaw); }
  }
}
function webTouch(i){
  const w=D.webAt&&D.webAt.get(i); if(!w||w.gone)return false;
  if(time-(w.touchT||-99)>3){ w.touchT=time; w.shake=1.2; sSqueak(player.x,player.z);
    for(const m of monsters){ if(!m.ty.spider||Math.hypot(m.x-player.x,m.z-player.z)>24)continue; m.sleep=false; m.aware=Math.max(m.aware,1.05); m.goal=[(i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL]; m.goalT=time+12; }
    if(!webMsg){ webMsg=true; msg('<b style="color:#d8c8ff">%</b>光る糸に絡まった！ 巣全体が震えている……。炎なら、糸を焼き払える。'); } }
  return true;
}
// hounds follow the freshest scent; water washes it away
function houndScent(m){
  let best=null, bs=time-40;
  for(const d of D4){ const i=(m.cz+d[1])*MW+m.cx+d[0]; if(!canStep(m,i))continue; if(scent[i]>bs){bs=scent[i];best=d;} }
  return best;
}
function machineWork(m,dt){
  // cleaners clear ash and put out fires; engineers rebuild burnt doors
  const ty=m.ty;
  if(m.job!==undefined&&m.job>=0){
    const [jx,jz]=ty.critter==='engineer'?[D.doors[m.job].bx,D.doors[m.job].bz]:cpos(m.job);
    if(Math.hypot(jx-m.x,jz-m.z)<(ty.critter==='engineer'?1.6:0.4)){
      m.work=(m.work||0)+dt; m.moving=0;
      if(mr()<dt*10)spawn(jx+(mr()-0.5)*0.4,0.3+mr()*0.6,jz+(mr()-0.5)*0.4,(mr()-0.5)*0.8,0.6+mr(),(mr()-0.5)*0.8,0.5,G(mpick(['*','.','+'])),0.1,ty.col[0]*2,ty.col[1]*2,ty.col[2]*2,0);
      if(m.work>(ty.critter==='engineer'?3:1.8)){
        if(ty.critter==='engineer'){ const d=D.doors[m.job]; d.gone=false; d.o=0; fuel[d.i]=1.4; if(!repairMsg&&m.visible){ repairMsg=true; msg(`<b style="color:${css(ty.col)}">R</b>${mname(m)}が、焼け落ちた扉を黙々と作り直した。`); } }
        else { burnt[m.job]=0; fire[m.job]=0; uploadCells(); }
        m.job=-1; m.work=0;
      }
      return true;
    }
    return false;
  }
  if(time-(m.scanT||-9)<1.5)return false; m.scanT=time;
  if(ty.critter==='engineer'){ let bi=-1,bd=1e9; D.doors.forEach((d,k)=>{ if(!d.gone)return; const dd=Math.hypot(d.bx-m.x,d.bz-m.z); if(dd<bd&&dd<40){bd=dd;bi=k;} }); m.job=bi; }
  else { let bi=-1,bd=1e9; for(let dz=-10;dz<=10;dz++)for(let dx=-10;dx<=10;dx++){ const x=m.cx+dx, z=m.cz+dz; if(x<0||z<0||x>=MW||z>=MH)continue; const i=z*MW+x; if(!burnt[i]&&!(fire[i]>0.1))continue; if(D.tile[i]!==TF)continue; const dd=Math.abs(dx)+Math.abs(dz); if(dd<bd){bd=dd;bi=i;} } m.job=bi; }
  return false;
}
function sHowl(x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.45), os=SND.ctx.createOscillator(), g=SND.ctx.createGain(), lfo=SND.ctx.createOscillator(), lg=SND.ctx.createGain();
  os.type='sawtooth'; os.frequency.setValueAtTime(320,t); os.frequency.linearRampToValueAtTime(720,t+0.5); os.frequency.linearRampToValueAtTime(380,t+1.6);
  lfo.frequency.value=6; lg.gain.value=18; lfo.connect(lg); lg.connect(os.frequency);
  const f=SND.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1400;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.09,t+0.2); g.gain.exponentialRampToValueAtTime(0.001,t+1.8);
  os.connect(f); f.connect(g); g.connect(o); os.start(t); lfo.start(t); os.stop(t+1.85); lfo.stop(t+1.85); }
function sAlarm(x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.4);
  for(let k=0;k<6;k++){ const os=SND.ctx.createOscillator(), g=SND.ctx.createGain(); os.type='square'; os.frequency.value=k%2?660:880;
    g.gain.setValueAtTime(0,t+k*0.22); g.gain.linearRampToValueAtTime(0.06,t+k*0.22+0.02); g.gain.linearRampToValueAtTime(0,t+k*0.22+0.2); os.connect(g); g.connect(o); os.start(t+k*0.22); os.stop(t+k*0.22+0.21); } }

// ---------------------------------------------------------------- large creatures of the terrain, mighty ones of the deep, and the lords of the branches
function bogForm(){
  const pts=[], add=(x,y,z,ch,s,b,part)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0});
  for(let i=0;i<22;i++){ const y=(i+0.5)/22, rr=Math.sqrt(1-y*y)*0.55, a=i*2.39996; add(Math.cos(a)*rr,y*0.75,Math.sin(a)*rr,mpick(['%','&','#','~','o']),0.2,0.9,'body'); }
  add(0.14,0.62,0.4,'o',0.14,3.0,'head'); add(-0.14,0.62,0.4,'o',0.14,3.0,'head');
  for(let k=0;k<5;k++)add((k-2)*0.12,0.18,0.5,'|',0.14,0.8,'body');
  return pts;
}
function krakenForm(){
  const pts=[], add=(x,y,z,ch,s,b,part)=>pts.push({x,y,z,g:G(ch),s,b,part:part||'body',ph:mr()*6.28,piv:0,pz:0});
  for(let i=0;i<16;i++){ const y=1-2*(i+0.5)/16, rr=Math.sqrt(1-y*y), a=i*2.39996; add(Math.cos(a)*rr*0.6,y*0.35,Math.sin(a)*rr*0.6,mpick(['%','&','o','8']),0.24,0.7,'body'); }
  add(0.2,0.15,0.45,'O',0.22,3.0,'head'); add(-0.2,0.15,0.45,'O',0.22,3.0,'head');
  return pts;
}
// kraken tentacles: columns of glyphs rising out of the water around the body, swaying
function drawTentacles(m,t){
  const ty=m.ty, sc=ty.scale, c=ty.col, rise=m.rise||0; if(rise<0.05)return;
  for(let k=0;k<6;k++){ const a=k/6*Math.PI*2+m.ph, r0=1.2*sc*0.55, bx=m.x+Math.cos(a)*r0, bz=m.z+Math.sin(a)*r0, h=(1.4+0.8*Math.sin(k*1.7))*sc*0.5*rise;
    for(let j=0;j*0.22<h;j++){ const q=j*0.22, sw=Math.sin(t*1.6+k+q*1.8)*0.35*q/Math.max(h,0.1); dyn(bx+Math.cos(a)*sw,0.05+q,bz+Math.sin(a)*sw,G(j%2?'S':'s'),0.26*(1-q/h*0.5),c[0]*1.4,c[1]*1.4,c[2]*1.4); } }
}

function updateMonster(m,dt,t){
  const ty=m.ty, dxp=player.x-m.x, dzp=player.z-m.z, dp=Math.hypot(dxp,dzp);
  const cell=m.cz*MW+m.cx;
  const inView=fovVis[cell]===fovStamp&&dp<28;
  if(ty.habitat==='bog'||ty.habitat==='deep'){ const tgt=(dp<(ty.habitat==='bog'?4:9)||m.noticed)?1:0; m.rise=(m.rise||0)+(tgt-(m.rise||0))*Math.min(1,dt*(tgt?1.4:0.5));
    if(ty.habitat==='bog'){ m.y=-0.9+0.9*m.rise; if(mr()<dt*3&&dp<24)spawn(m.x+(mr()-0.5)*1.2,0.06,m.z+(mr()-0.5)*1.2,0,0.25,0,0.9,G('o'),0.14,0.35,0.42,0.15,1); if(m.rise>0.3&&!m.riseMsg&&inView){ m.riseMsg=true; msg(`<b style="color:${css(ty.col)}">B</b>沼が盛り上がり、${mname(m)}が姿を現した！`); sBubble(m.x,m.z,0.5,false); } }
    else { m.y=-0.7; if(m.rise>0.3&&!m.riseMsg&&inView){ m.riseMsg=true; msg(`<b style="color:${css(ty.col)}">K</b>水面が割れ、${mname(m)}の触手が立ち上がった！`); sSplash(0.5); shake=Math.max(shake,0.2); } } }
  m.visible=inView&&!ty.invisible&&(ty.form!=='eel'||m.surf>0.08)&&(ty.habitat!=='bog'||(m.rise||0)>0.25)&&!(tallAt(cell)&&dp>3);
  if(tallAt(cell)&&!ty.flier&&m.moving>0.5&&mr()<dt*0.5)trample(cell);
  if(D.surface[cell]===SF_BRIM&&!ty.flier&&m.moving>0.5)brimFlare(cell);
  if(ty.critter){ if(dp>30&&!ty.critter.startsWith('clean')&&ty.critter!=='engineer'){ m.visible=false; return; } updateCritter(m,dt,t,dp); return; }
  // perception (after Brogue's stealth): the brighter the spot you stand in, the farther away you can be noticed
  if(ty.peaceful){ m.aware=0; m.noticed=false; m.sleep=false;
    if(dp<2.4&&time-(m.talkT||-99)>14){ m.talkT=time; const ru=HIST.rulers[Math.floor(mr()*HIST.rulers.length)];
      const L=[`昔々、この上には${HIST.civ.name}の都があったんだとさ。`,`${ru.title}${ru.name}の巨像を見たかい？ 眼だけは、まだ光ってるんだ。`,'溶岩の海の先には、何もない闇があるって話だ。','灯りを絞って歩けば、獣にも見つからないよ。','神殿の巻物は、近づくと勝手にしゃべるんだ。',`${HIST.beast}の話を聞くと、子どもたちは眠れなくなる。`,'壁の彫刻を読んでごらん。この世界の昔話が刻んであるよ。'];
      msg(`<b style="color:${css(ty.col)}">G</b><span style="color:${css(ty.col)}">ノーム</span>「${L[Math.floor(mr()*L.length)]}」`); } }
  else if(ty.form!=='eel'||m.surf>0){
    const sr=started?stealth.range*(m.sleep?0.5:1):0;
    if(inView&&dp<sr){ const rate=(1-dp/sr)*2.2+0.35; m.aware=Math.min(1.25,m.aware+dt*rate*(m.sleep?0.35:1)); }
    else m.aware=Math.max(0,m.aware-dt*(m.noticed?0.12:0.2));
  }
  if(m.sleep&&m.aware>0.35){ m.sleep=false; m.wait=0.6; }
  if(!m.noticed&&m.aware>=1)onNoticed(m);
  if(m.noticed&&m.aware<0.55)m.noticed=false;
  m.alert+=((m.noticed?1:m.aware>0.35?0.35:0)-m.alert)*Math.min(1,dt*3);
  let moving=0;
  if(m.sleep){ moving=0; }
  else if(ty.flier){
    // erratic flight: picks a new heading every fraction of a second; circles the player once it notices them
    m.flitT-=dt;
    if(m.flitT<=0){
      m.flitT=0.25+mr()*0.5; const a=mr()*6.28;
      const tx=m.noticed?player.x+Math.cos(a)*2.5:m.x+Math.cos(a)*3, tz=m.noticed?player.z+Math.sin(a)*2.5:m.z+Math.sin(a)*3;
      const dx=tx-m.x, dz=tz-m.z, d=Math.hypot(dx,dz)||1, sp=ty.speed*(0.6+mr()*0.6);
      m.vx=dx/d*sp; m.vz=dz/d*sp; m.vy=(mr()-0.5)*1.6;
    }
    { const fn=fireNear(m.cx,m.cz,1); if(fn>=0){ const ax=m.x-(fn%MW+0.5)*CELL, az=m.z-(((fn/MW)|0)+0.5)*CELL, al=Math.hypot(ax,az)||1; m.vx=ax/al*ty.speed; m.vz=az/al*ty.speed; } }
    const nx=m.x+m.vx*dt, nz=m.z+m.vz*dt;
    if(flyOpen(nx,m.z))m.x=nx; else m.vx*=-1;
    if(flyOpen(m.x,nz))m.z=nz; else m.vz*=-1;
    m.fy=clamp(m.fy+m.vy*dt,1.0,Math.max(1.2,Math.min(3.0,ceilAt(m.x,m.z)-0.4))); m.y=m.fy;
    m.cx=Math.floor(m.x/CELL); m.cz=Math.floor(m.z/CELL); moving=1; m.dirYaw=Math.atan2(m.vx,m.vz);
  } else if(m.wait>0){ m.wait-=dt; if(fireNear(m.cx,m.cz,2)>=0)m.wait=0; }
  else{
    const tx=(m.tx+0.5)*CELL, tz=(m.tz+0.5)*CELL, ddx=tx-m.x, ddz=tz-m.z, d=Math.hypot(ddx,ddz);
    if(d<0.04){ m.x=tx; m.z=tz; m.cx=m.tx; m.cz=m.tz; chooseNext(m); }
    else{
      if(m.flee>0)m.flee-=dt;
      const calm=(ty.form==='bloat'||ty.form==='eel'||m.flee>0)?(m.flee>0?1.6:1):(m.noticed&&hostile(m)?1.15:(1-0.88*m.alert));
      const catchUp=m.leader&&Math.hypot(m.leader.x-m.x,m.leader.z-m.z)>4?1.35:1;
      const sp=ty.speed*calm*catchUp*dt, st=Math.min(sp,d);
      m.x+=ddx/d*st; m.z+=ddz/d*st; moving=calm; m.dirYaw=Math.atan2(ddx,ddz);
      m.cx=Math.floor(m.x/CELL); m.cz=Math.floor(m.z/CELL);
    }
  }
  m.moving+=(moving-m.moving)*Math.min(1,dt*5);
  m.yaw=lerpAngle(m.yaw,((m.alert>0.3||(ty.peaceful&&dp<4))&&!ty.flier&&ty.form!=='eel')?Math.atan2(dxp,dzp):m.dirYaw,1-Math.exp(-dt*(ty.flier?8:3)));
  m.walk+=dt*m.moving*ty.speed*5.5;
  m.glow=1+m.alert*0.7;
  if(!ty.flier&&ty.form!=='eel')m.y=ty.fl?ty.fl+Math.sin(t*1.3+m.ph)*0.12:(ty.hop?Math.abs(Math.sin(m.walk*0.7))*0.45*m.moving:0);
  const c=ty.col;
  // eels: lurk below the surface, leaving only ripples, and now and then arc out of the water
  if(ty.form==='eel'){
    m.surfT-=dt;
    if(m.surf<=0&&m.surfT<=0&&dp<20){ m.surf=0.001; m.surfT=6+mr()*8; splash(m.x,m.z,c); }
    if(m.surf>0){ m.surf+=dt/2.6; if(m.surf>=1){ m.surf=0; splash(m.x,m.z,c); } }
    m.acc+=dt*(m.surf>0?0:3.5);
    while(m.acc>=1){ m.acc--; if(dp>22)continue; for(let q=0;q<6;q++){ const a=q/6*Math.PI*2; spawn(m.x+Math.cos(a)*0.2,0.08,m.z+Math.sin(a)*0.2,Math.cos(a)*0.3,0.01,Math.sin(a)*0.3,1.1,G('~'),0.14,0.12,0.3,0.45,1); } }
  }
  if(ty.form==='bloat'&&((dp<1.4&&!m.sleep)||fireNear(m.cx,m.cz,1)>=0)){
    m.dead=true;
    for(const d of [[0,0],...D4,[1,1],[-1,1],[1,-1],[-1,-1]]){ const i=(m.cz+d[1])*MW+m.cx+d[0]; if(i>=0&&i<NCELL&&D.tile[i]!==TW)D.gas[i]=Math.min(1,D.gas[i]+0.95); }
    gasAny=true;
    for(let q=0;q<26;q++){ const a=mr()*6.28, e2=(mr()-0.3)*1.2; spawn(m.x,m.y,m.z,Math.cos(a)*1.6,e2,Math.sin(a)*1.6,1+mr(),G(mpick(['o','.','*','~'])),0.16,c[0]*1.6,c[1]*1.6,c[2]*1.6,1); }
    sBubble(m.x,m.z,0.5,true); sSplash(0.2);
    msg(`<b style="color:${css(c)}">b</b>${mname(m)}が弾け、腐食性のガスが広がった。`);
    return;
  }
  if(ty.conj){
    const hunt=m.noticed&&dp<10;
    if(hunt&&!m.bladeMsg){ m.bladeMsg=true; msg(`<b style="color:${css(c)}">g</b>${mname(m)}の霊剣が、あなたの周りを旋回し始めた。`); }
    for(const b of m.blades){
      b.a+=dt*(hunt?2.6:1.6);
      const ccx=hunt?player.x:m.x, ccz=hunt?player.z:m.z, r=hunt?1.7:0.9;
      const tx=ccx+Math.cos(b.a)*r, tz=ccz+Math.sin(b.a)*r, tyy=(hunt?1.35:1.55)+Math.sin(b.a*2)*0.2, k=Math.min(1,dt*(hunt?3:5));
      b.x+=(tx-b.x)*k; b.y+=(tyy-b.y)*k; b.z+=(tz-b.z)*k;
      if(mr()<dt*10&&dp<24)spawn(b.x,b.y,b.z,0,0,0,0.5,G(mpick(['.','\''])),0.1,0.8,1.2,1.5,1);
    }
  }
  if(!m.seen){
    if(m.visible&&dp<22&&ty.boss){ m.seen=true; msg(`<b style="color:${css(c)}">${ty.ch}</b>${mname(m)}がいる。この地の主だ。`); sRumble(0.25,1.6); }
    else if(m.visible&&dp<16&&ty.beast){ m.seen=true; msg(`<b style="color:${css(c)}">X</b>${mname(m)}が、洞窟の奥で眠っている。`); }
    else if(m.visible&&dp<13){ m.seen=true; msg(`<b style="color:${css(c)}">${ty.ch}</b>${mname(m)}が${m.sleep?'眠っている。忍び寄れば、気づかれずに通り抜けられるかもしれない':ty.verb}。`); }
    else if(ty.invisible&&inView&&dp<7){ m.seen=true; msg(`<b style="color:${css(c)}">?</b>何かが、すぐ近くで空気を揺らしている……。`); }
  }
  monsterStrike(m,dt,dp); if(m.hitT>0)m.hitT-=dt;
  if(ty.heavy&&!m.sleep&&m.moving>0.4&&dp<16){ m.stepT=(m.stepT||0)+dt*m.moving*ty.speed*1.6; if(m.stepT>1){ m.stepT=0; shake=Math.max(shake,0.12*(1-dp/16)); sRumble(0.12*(1-dp/16),0.4); } }
  if(ty.habitat==='lava'&&m.moving>0.5){ const ci=m.cz*MW+m.cx; if(!D.liquid[ci]&&fuel[ci]>0&&fire[ci]<=0&&mr()<dt*0.8)ignite(ci,0.5,false); }
  if(ty.hound&&m.moving>0.5){ const ci=m.cz*MW+m.cx; if(ty.hound==='fire'&&fuel[ci]>0&&fire[ci]<=0&&mr()<dt*0.4)ignite(ci,0.4,false); if(ty.hound==='ice'&&fire[ci]>0)fire[ci]=0; }
  if(ty.beast&&!m.sleep){
    if(ty.spec.fire){ const ci=m.cz*MW+m.cx; if(fuel[ci]>0&&fire[ci]<=0)ignite(ci,0.5,false); }
    if(ty.spec.sing&&dp<22&&mr()<dt*0.5)sChime(m.x,m.z,0.35);
  }
  if(dp<30&&ty.trail){
    m.acc+=dt*ty.trail*(m.sleep?0.25:1);
    while(m.acc>=1){ m.acc--;
      const y=m.y+(ty.form==='orb'||ty.form==='bat'||ty.form==='bloat'?0:ty.form==='wraith'?0.4+mr()*1.2:0.3+mr()*1.2*ty.scale);
      spawn(m.x+(mr()-0.5)*0.4,y,m.z+(mr()-0.5)*0.4,(mr()-0.5)*0.15,ty.form==='wraith'?-0.08:0.12+mr()*0.15,(mr()-0.5)*0.15,1.5+mr()*2,
        G(mpick(['.','\'','*','`',ty.ch])),0.08+mr()*0.06,c[0]*1.3,c[1]*1.3,c[2]*1.3,1);
    }
  }
}
function splash(x,z,c){
  if(Math.hypot(x-player.x,z-player.z)<24)sSplash(0.25*sDist(x,z));
  if(Math.hypot(x-player.x,z-player.z)>26)return;
  for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(x+Math.cos(a)*0.3,0.1,z+Math.sin(a)*0.3,Math.cos(a)*0.8,0.8+mr()*1.2,Math.sin(a)*0.8,0.9+mr()*0.5,G(mpick(['~','.','\'','o'])),0.13,0.25,0.55,0.9,1); }
}
let aimMon=null;
function drawMonster(m,t){
  if(m.wind>0){ const sc=m.ty.scale, h=m.y+(m.ty.habitat==='deep'?2.2:1.9*sc); dyn(m.x,h,m.z,G('!'),0.5,3.2,0.6,0.4); }
  if(m.hitT>0){ const g0=m.glow; m.glow*=3; drawMonster1(m,t); m.glow=g0; return; }
  drawMonster1(m,t);
}
function drawMonster1(m,t){
  if(m.ty.habitat==='deep'&&Math.hypot(m.x-player.x,m.z-player.z)<44)drawTentacles(m,t);
  if(m.ty.critter&&Math.hypot(m.x-player.x,m.z-player.z)>30)return;
  if(m===aimMon&&!m.hidden){ const g0=m.glow; m.glow*=1.9; drawMonster0(m,t); m.glow=g0; const sc=m.ty.scale, c=m.ty.col; for(let k=0;k<12;k++){ const a=k/12*Math.PI*2+t*0.8; dyn(m.x+Math.cos(a)*0.75*sc,m.y+0.5*sc,m.z+Math.sin(a)*0.75*sc,G('.'),0.12,c[0]*2.4,c[1]*2.4,c[2]*2.4); } return; }
  drawMonster0(m,t);
}
function drawMonster0(m,t){
  const fj=(m.flinchUntil||0)>time?(m.flinchUntil-time)*0.9*(m.ty.scale||1):0;
  if((m.ty.form==='dragon'&&!m.ty.boss)||m.ty.beast){ if(!m.formSleep)m.formSleep=m.ty.beast?beastSleep(m.form,m.ty):dragonSleepForm(m.ty);
    if(m.wasSleep&&!m.sleep&&!m.morph)m.morph={from:m.formSleep,t0:time,dur:1.0};
    m.wasSleep=!!m.sleep; m.drawForm=m.sleep&&!m.morph?m.formSleep:null; }
  if(m.ty.form==='lichking'&&!m.dead)lichAura(m,t);
  if(m.ty.form==='spiderqueen'&&!m.dead)spiderAura(m,t);
  if(m.ty.form==='nagaqueen'&&!m.dead)nagaAura(m,t);
  if(m.ty.form==='olddragon'&&!m.dead)dragonAura(m,t);
  if((m.ty.form==='shadowking'||m.ty.form==='shadowserpent')&&!m.dead)shadowAura(m,t);
  if(m.ty.form==='deepkraken'&&!m.dead)krakenAura(m,t);
  if(m.ty.hound&&!m.dead)houndAura(m,t);
  if(m.elite&&!m.dead&&Math.hypot(m.x-player.x,m.z-player.z)<26){ const r=0.75*(m.ty.scale||1); for(let k=0;k<14;k++){ const a=k/14*Math.PI*2+t*0.6; dyn(m.x+Math.cos(a)*r,m.y+0.04,m.z+Math.sin(a)*r,G('.'),0.15,1.4,0.45,0.25,0,0); } }
  if(m.ty.look==='salamander'&&!m.dead)salamanderAura(m,t);
  if(m.ty.form==='bog'&&!m.ty.boss&&!m.dead)bogAura(m,t);
  if(m.morph&&drawMorph(m,t))return;
  const dx=m.x-player.x, dz=m.z-player.z, d2=dx*dx+dz*dz; if(d2>44*44)return;
  if(m.hidden){ const y=1.3+Math.sin(t*1.1+m.ph)*0.06, sh=Math.sin(t*23+m.ph)*0.012; dyn(m.x+sh,y,m.z,G('?'),0.5,2.2,1.75,0.85); for(let k=0;k<6;k++){ const a=t*0.7+k/6*Math.PI*2; dyn(m.x+Math.cos(a)*0.35,y-0.25,m.z+Math.sin(a)*0.35,G('.'),0.12,1.4,1.1,0.5); } return; }
  const ty=m.ty, c=ty.col, sc=ty.scale*(ty.form==='shadowking'?1+0.025*Math.sin(t*0.8+m.ph):1), cy=Math.cos(m.yaw), sy=Math.sin(m.yaw), dp=Math.sqrt(d2);
  const near=clamp(dp/3.5,0.45,1);
  const swing=Math.sin(m.walk)*0.55*m.moving, bob=Math.abs(Math.sin(m.walk))*0.04*m.moving;
  const lit=cellLight(m.x,m.z);
  const eelArc=ty.form==='eel'?Math.sin(Math.PI*m.surf):0;
  for(const p of (m.drawForm||m.form)){
    if(p.part==='heart'&&!m.heartOn)continue;
    if(p.part==='crack'&&!(m.maxHp&&m.hp/m.maxHp<p.th))continue;
    if(p.part==='tongue'&&Math.sin(t*2.3+m.ph)<0.6)continue;
    let lx=p.x, ly=p.y, lz=p.z;
    if((p.part==='heart'||p.part==='eye')&&ty.form==='shadowserpent'){ const k=Math.max(0,p.y-0.4); lx+=Math.sin(t*0.9-p.y*1.3+m.ph)*0.035*k; lz+=Math.cos(t*0.7-p.y*1.1)*0.025*k; }
    switch(p.part){
      case 'tent': { const q=p.piv||0; lx+=Math.sin(t*0.8+q*0.45+(p.ti||0)*1.7)*0.012*q; ly+=Math.cos(t*0.7+q*0.5+(p.ti||0))*0.008*q; break; }
      case 'ap': { const k=1+0.18*Math.sin(t*0.9+m.ph); lx=p.cx+(p.x-p.cx)*k; ly=p.cy+(p.y-p.cy)*k; break; }
      case 'flame': { const f=p.fh||0; ly+=(Math.sin(t*9+p.ph)*0.03+0.02)*f; lz-=(m.moving||0)*0.1*f; lx+=Math.sin(t*6+p.ph*2)*0.015*f; break; }
      case 'jel': { const k=1+0.07*Math.sin(t*3.2+p.y*5+m.ph); lx*=k; lz*=k; ly*=1-0.05*Math.sin(t*3.2+m.ph); break; }
      case 'bloat': { const k=1+0.06*Math.sin(t*1.6+m.ph); lx*=k; ly*=k; lz*=k; break; }
      case 'wisp': { lx+=Math.sin(t*5+p.ph)*0.03; ly+=Math.sin(t*4.3+p.ph*1.3)*0.04; lz+=Math.cos(t*5.4+p.ph)*0.03; break; }
      case 'eelw': lx+=Math.sin(t*4-p.z*3.5+m.ph)*0.09*(0.4+Math.max(0,0.8-p.z)); break;
      case 'slither': lx+=Math.sin(t*5-p.z*5+m.ph)*0.05*(0.3+Math.max(0,0.6-p.z)); break;
      case 'tongue': lx+=Math.sin(t*5-p.z*5+m.ph)*0.02; break;
      case 'cap': if(m.noticed||m.alert>0.5){ lx+=Math.sin(t*40+p.ph)*0.012; lz+=Math.cos(t*37+p.ph)*0.012; } break;
      case 'snout': if(!(m.moving>0.3)){ lz+=Math.sin(t*14+m.ph)*0.012; } break;
      case 'graze': { const g2=Math.max(0,Math.sin(t*0.9+m.ph)); ly-=g2*0.08; lz+=g2*0.03; break; }
      case 'sway': lx+=Math.sin(t*2.2+p.ph)*0.015; break;
      case 'bog': { const k=1+0.05*Math.sin(t*1.4+m.ph+p.y*2); lx*=k; lz*=k; break; }
      case 'bogarm': { const k=1+0.05*Math.sin(t*1.4+m.ph+p.y*2); lx*=k; lz*=k; lz+=Math.sin(t*0.9+m.ph)*0.05*Math.max(0,p.z); ly+=Math.cos(t*0.8+m.ph)*0.03*Math.max(0,p.z); break; }
      case 'breathe': { const k=1+0.025*Math.sin(t*1.1+m.ph); lx*=k; ly*=k; lz*=k; break; }
      case 'claw': { const k=Math.max(0,p.y-0.4); lx+=Math.sin(t*0.9-p.y*1.3+m.ph)*0.035*k; lz+=Math.cos(t*0.7-p.y*1.1)*0.025*k; const cl=Math.pow(Math.max(0,Math.sin(t*0.8+m.ph+p.hx)),6)*0.35*(p.cf||0); lx+=(p.hx-p.x)*cl; ly+=(p.hy-p.y)*cl; lz+=(p.hz-p.z)*cl; break; }
      case 'parm': { const k=Math.max(0,p.y-0.4); lx+=Math.sin(t*0.9-p.y*1.3+m.ph)*0.035*k; lz+=Math.cos(t*0.7-p.y*1.1)*0.025*k+Math.sin(t*1.1+m.ph)*0.08*Math.min(1,Math.abs(p.x)/1.2); ly+=Math.sin(t*1.1+m.ph)*0.04*Math.min(1,Math.abs(p.x)/1.2); break; }
      case 'serp': { const k=Math.max(0,p.y-0.4); lx+=Math.sin(t*0.9-p.y*1.3+m.ph)*0.035*k; lz+=Math.cos(t*0.7-p.y*1.1)*0.025*k; break; }
      case 'wing2': { const k=Math.abs(p.x); ly+=Math.sin(t*0.9+k*1.5)*0.07*k; lz+=Math.sin(t*0.9+k)*0.05*k; break; }
      case 'tendril': { const q=p.piv||0; lx+=Math.sin(t*1.6+q*0.8+p.ph*0.1)*0.012*q; ly+=Math.cos(t*1.3+q*0.7)*0.01*q; break; }
      case 'armL': case 'legR': case 'armR': case 'legL': {
        const ang=(p.part==='armL'||p.part==='legR')?swing:-swing, dy=ly-p.piv, dz2=lz-p.pz;
        ly=p.piv+dy*Math.cos(ang)-dz2*Math.sin(ang); lz=p.pz+dy*Math.sin(ang)+dz2*Math.cos(ang); ly+=bob; break; }
      case 'head': case 'core': case 'body': ly+=bob+(ty.form==='humanoid'||ty.form==='quad'?0:Math.sin(t*1.6+m.ph)*0.03); break;
      case 'shell': { const a=t*0.9+m.ph, ca=Math.cos(a), sa=Math.sin(a); const nx=lx*ca-lz*sa, nz=lx*sa+lz*ca; const b=0.35*Math.sin(t*0.6+m.ph); lx=nx; lz=nz*Math.cos(b)-ly*Math.sin(b); ly=nz*Math.sin(b)+ly*Math.cos(b); break; }
      case 'puff': { const k=1+0.07*Math.sin(t*2.2+m.ph), a=t*0.25, ca=Math.cos(a), sa=Math.sin(a); const nx=lx*ca-lz*sa, nz=lx*sa+lz*ca; lx=nx*k; ly*=k; lz=nz*k; break; }
      case 'wing': { const dr=ty.form==='dragon'||(ty.beast&&ty.spec&&ty.spec.plan!=='moth'), mo=ty.beast&&ty.spec&&ty.spec.plan==='moth', fa=dr?0.8+Math.sin(t*1.3+m.ph)*(m.sleep?0.06:0.3):mo?Math.sin(t*4+m.ph)*0.55:Math.sin(t*16+m.ph)*0.9; lx=p.sd*p.r*Math.cos(fa); ly=p.y+p.r*Math.sin(fa)*0.9; break; }
      case 'tail': lx+=Math.sin(t*7+m.ph)*0.05*(p.piv+1); break;
      case 'spin': { const a=t*(p.sp||1)+p.ph; lx=p.cx+Math.cos(a)*p.r; lz=p.cz+Math.sin(a)*p.r; ly=p.y; break; }
      case 'orbit': { const a=t*(p.sp||0.8)+p.ph+(p.da||0); lx=Math.cos(a)*p.r; lz=Math.sin(a)*p.r; ly=p.y+Math.sin(t*2+p.ph)*0.06; break; }
      case 'robe': { const k=1.95-p.y; lx+=Math.sin(t*2.2+p.y*3+p.ph)*0.05*k; lz+=Math.cos(t*1.7+p.y*2.5+p.ph)*0.05*k; break; }
      case 'seg': { lx+=Math.sin(t*2.6*Math.max(0.4,m.moving)+m.walk*0.5-p.piv*0.65)*0.26*(0.35+p.piv/11); ly+=Math.sin(t*3+p.piv)*0.01; break; }
      case 'shead': { lx+=Math.sin(t*2.6*Math.max(0.4,m.moving)+m.walk*0.5)*0.26*0.35; ly+=Math.sin(t*1.7+m.ph)*0.05; break; }
      case 'jelly': { const k=Math.sin(t*3+m.ph); ly*=1+0.12*k; lx*=1-0.06*k; lz*=1-0.06*k; break; }
    }
    if(ty.form==='eel'){ const seg=p.part==='shead'?0:p.piv; ly+=1.3*Math.max(0,Math.sin(Math.PI*clamp(m.surf*1.35-seg*0.03,0,1)))-0.1*seg*eelArc; }
    lx*=sc; ly*=sc; lz*=sc;
    const wx=m.x+lx*cy+lz*sy, wz=m.z-lx*sy+lz*cy, wy=m.y+ly;
    if(ty.invisible){
      // phantoms are only a shimmer: brief, faint glyphs scattered over the silhouette; now and then the whole shape shows for a moment
      const rv=Math.max(0,(Math.sin(t*1.1+m.ph)-0.88)/0.12); if(rv>0){ const kk=p.b*0.55*rv; dyn(wx,wy,wz,p.g,p.s*sc,0.6*kk,0.72*kk,1.0*kk,0,0); }
      if(dp<16&&mr()<0.5){ const fk=dp<4?0.22:0.07; spawn(wx+(mr()-0.5)*0.08,wy,wz+(mr()-0.5)*0.08,0,0,0,0.08,G(SWAPSET[Math.floor(mr()*SWAPSET.length)]),p.s*sc*1.2,0.6*fk,0.7*fk,1.0*fk,1); }
      continue;
    }
    const isCore=p.part==='core'||p.part==='shead';
    const shim=isCore?(0.85+0.15*Math.sin(t*2.3+m.ph)):(0.62+0.38*Math.sin(t*3.1+p.ph*7));
    let g=p.g;
    if(!isCore&&Math.sin(t*0.8+p.ph*11.3)>0.986)g=G(SWAPSET[Math.floor(t*3+p.ph*7)%SWAPSET.length]);
    let k=p.b*shim*m.glow*0.62*(isCore?near:1)*(sc<0.9?1.4:1);
    if(p.part==='pulse')k*=0.5+0.9*Math.max(0,Math.sin(t*2.5+p.ph*0.3));
    if(p.part==='eye')k*=(1+2*Math.max(0,Math.sin(t*0.7+m.ph)-0.85)/0.15)*(ty.form==='watcher'&&m.noticed?1.8:1); else if(p.part==='heart')k*=0.7+0.6*Math.max(0,Math.sin(t*4));
    const sb=sc<0.9?1+clamp((dp-4)/10,0,0.6):1;
    if(ty.form==='eel'&&wy<0){ if(dp>14)continue; k*=0.12; }
    const cc=p.col||c; if(p.part==='flame')g=G(['^','\'','^','*'][((t*12+p.ph*3)|0)%4]); const jx=fj?(mr()-0.5)*fj:0, jy=fj?(mr()-0.5)*fj:0, jz=fj?(mr()-0.5)*fj:0; dyn(wx+jx,wy+jy,wz+jz,g,p.s*sc*sb,cc[0]*k+lit[0]*0.12,cc[1]*k+lit[1]*0.12,cc[2]*k+lit[2]*0.12,0,0);
  }
  drawMark(m,t,dp);
  if(ty.conj)for(const b of m.blades){
    const bn=clamp(Math.hypot(b.x-camera.position.x,b.y-camera.position.y,b.z-camera.position.z)/3,0.25,1);
    dyn(b.x,b.y,b.z,G('|'),0.55,1.4*bn,2.2*bn,2.6*bn,0,0);
    dyn(b.x,b.y-0.3,b.z,G('+'),0.3,0.9*bn,1.4*bn,1.8*bn,0,0);
  }
}

// ---------------------------------------------------------------- lights
function flicker(L,t){
  const p=L.ph;
  switch(L.type){
    case 'brazier': return 0.8+0.09*Math.sin(t*8.3+p)+0.07*Math.sin(t*19.7+p*1.7)+0.05*Math.sin(t*41.3+p*3.1);
    case 'crystal': return 0.8+0.2*Math.sin(t*0.8+p);
    case 'rune': return 0.75+0.25*Math.pow(0.5+0.5*Math.sin(t*1.6+p),2);
    case 'fungus': return 0.8+0.2*Math.sin(t*0.5+p);
    case 'abyss': return 0.78+0.14*Math.sin(t*0.6+p)+0.08*Math.sin(t*2.7+p*2);
    case 'lamp': { let f=0.9+0.08*Math.sin(t*3.1+p); if(Math.sin(t*0.37+p*5)*Math.sin(t*1.9+p)>0.9)f*=0.3+0.5*mr(); return f; }
    case 'upstairs': return 0.9+0.1*Math.sin(t*1.3+p);
    case 'tele': return 0.75+0.25*Math.sin(t*2.2+p);
    case 'portal': return 0.85+0.15*Math.sin(t*2.3+p);
    case 'bstairs':
    case 'stairs': return 0.88+0.12*Math.sin(t*1.4+p);
    case 'fall': return 0.9+0.1*Math.sin(t*2.1+p);
    case 'veinlight': return 0.8+0.2*Math.sin(t*1.7+p);
    case 'crater': return L.active?0.9+0.1*Math.sin(t*3+p):0.25+0.08*Math.sin(t*2+p);
    case 'spring': return L.active?0.9:0.3;
    case 'firefly': return 0.8+0.2*Math.sin(t*1.1+p);
    case 'marsh': return 0.75+0.25*Math.sin(t*1.7+p);
    case 'sun': case 'well': return 0.95+0.05*Math.sin(t*0.3+p);
    case 'orb': return 0.9+0.1*Math.sin(t*0.7+p);
    case 'bloodwort': return (L.fade===undefined?1:L.fade)*(0.85+0.15*Math.sin(t*2.2+p));
    case 'vent': return 0.04+(L.boost||0);
    case 'pitglow': return D.collapsed?0.85+0.15*Math.sin(t*1.3+p):0;
    case 'xlight': return 0.85+0.15*Math.sin(t*0.6+p);
    case 'torch': return 0.8+0.08*Math.sin(t*9.1+p)+0.07*Math.sin(t*21.3+p*1.7)+0.05*Math.sin(t*37.9+p*2.9);
    case 'lava': return 0.85+0.1*Math.sin(t*0.7+p)+0.05*Math.sin(t*2.3+p);
    case 'embers': return 0.7+0.15*Math.sin(t*7.3+p)+0.1*Math.sin(t*17.1+p*2);
    case 'relic': return 0.85+0.15*Math.sin(t*1.1+p);
    case 'pages': return 0.8+0.2*Math.sin(t*0.7+p);
    case 'mist': return 0.75+0.25*Math.sin(t*0.4+p);
  }
  return 1;
}
const _cl=[0,0,0];
function cellLight(x,z){
  _cl[0]=_cl[1]=_cl[2]=0;
  const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL); if(cx<0||cz<0||cx>=MW||cz>=MH)return _cl;
  const o=(cz*MW+cx)*3;
  for(let k=0;k<3;k++){ const id=D.cellLI[o+k]; if(id<0)break; const L=D.lights[id], w=D.cellLW[o+k]*L.int*L.f; _cl[0]+=L.col[0]*w; _cl[1]+=L.col[1]*w; _cl[2]+=L.col[2]*w; }
  const fl=fireLight[cz*MW+cx]; if(fl>0){ _cl[0]+=fl*2.2; _cl[1]+=fl*0.99; _cl[2]+=fl*0.26; }
  return _cl;
}
const LANTERN=[0.6,0.58,0.86];
function updateLights(t){
  SL.fill(0);
  let shadowK=1; for(const m of monsters)if(m.ty.beast&&m.ty.spec.shadow&&!m.sleep){ const d=Math.hypot(m.x-player.x,m.z-player.z); if(d<16)shadowK=Math.min(shadowK,0.45+0.55*d/16); }
  const drag=monsters.filter(m=>m.ty.dragon&&m.sleep), lich=monsters.filter(m=>m.ty.lich);
  D.lights.forEach((L,i)=>{ let f=flicker(L,t)*shadowK; let c0=L.col[0], c1=L.col[1], c2=L.col[2];
    for(const m of drag){ const d=Math.hypot(L.x-m.x,L.z-m.z); if(d<11)f*=1-0.35*(1-d/11)*(0.5+0.5*Math.sin(t*0.8+m.ph)); }
    for(const m of lich){ const d=Math.hypot(L.x-m.x,L.z-m.z); if(d<12){ const k2=(1-d/12)*0.8; c0=c0*(1-k2)+0.55*k2; c1=c1*(1-k2)+0.8*k2; c2=c2*(1-k2)+1.0*k2; } }
    L.f=f; const k=L.int*f; SL[i*3]=c0*k; SL[i*3+1]=c1*k; SL[i*3+2]=c2*k; });
  DLP.fill(0); DLC.fill(0);
  const lf=0.96+0.03*Math.sin(t*7.1)+0.02*Math.sin(t*13.3);
  if(camMode==='tps'){ DLP[0]=player.x; DLP[1]=player.eye+0.15; DLP[2]=player.z; } else { DLP[0]=camera.position.x-Math.sin(player.yaw)*0.25; DLP[1]=camera.position.y-0.2; DLP[2]=camera.position.z-Math.cos(player.yaw)*0.25; } DLP[3]=lantern.r*(1+0.35*bodyN('lamp'));
  DLC[0]=LANTERN[0]*lf*lantern.k; DLC[1]=LANTERN[1]*lf*lantern.k; DLC[2]=LANTERN[2]*lf*lantern.k;
  if(castSt&&hands){ const kk=Math.min(1,castSt.t/Math.max(0.01,castSt.need))*(castSt.full?1+0.15*Math.sin(time*14):1), cc=elemCol(hands[castSt.h].elem?hands[castSt.h].elem.type:null); for(let q=0;q<3;q++)DLC[q]=DLC[q]*(1-0.55*kk)+cc[q]*2.6*kk; }
  const list=monsters.filter(m=>m.ty.light>0&&!m.ty.invisible&&(m.ty.form!=='eel'||m.surf>0)).map(m=>[(m.x-player.x)**2+(m.z-player.z)**2,m]).sort((a,b)=>a[0]-b[0]);
  const flOn=zapFlash&&zapFlash.t>0;
  if(flOn){ const s5=(NDL-1), k5=zapFlash.t>900?1:Math.min(1,zapFlash.t/0.16); DLP[s5*4]=zapFlash.x; DLP[s5*4+1]=zapFlash.y; DLP[s5*4+2]=zapFlash.z; DLP[s5*4+3]=(zapFlash.r||6); DLC[s5*3]=zapFlash.col[0]*3*k5; DLC[s5*3+1]=zapFlash.col[1]*3*k5; DLC[s5*3+2]=zapFlash.col[2]*3*k5; }
  else if(spark){ const s5=(NDL-1); DLP[s5*4]=spark.x; DLP[s5*4+1]=spark.y; DLP[s5*4+2]=spark.z; DLP[s5*4+3]=5; DLC[s5*3]=2.4; DLC[s5*3+1]=1.3; DLC[s5*3+2]=0.4; }
  for(let k=0;k<NDL-((spark||flOn)?2:1)&&k<list.length;k++){
    const m=list[k][1], s=k+1, ty=m.ty;
    DLP[s*4]=m.x; DLP[s*4+1]=m.y+(ty.fl?0:0.9); DLP[s*4+2]=m.z; DLP[s*4+3]=ty.light*(1+m.alert*0.3);
    const pulse=(0.85+0.15*Math.sin(t*2.3+m.ph))*0.8*m.glow;
    const lc=ty.lcol||ty.col; DLC[s*3]=lc[0]*pulse; DLC[s*3+1]=lc[1]*pulse; DLC[s*3+2]=lc[2]*pulse;
  }
}

// ---------------------------------------------------------------- fixtures
function drawFixtures(t,dt){
  for(const f of fixtures){
    const ddx=f.x-player.x, ddz=f.z-player.z, d2=ddx*ddx+ddz*ddz; if(d2>46*46)continue;
    const near=clamp(Math.sqrt(d2)/4,0.35,1);
    const L=D.lights[f.li], fl=L?L.f:1, c=f.col, x=f.x, z=f.z, ly=L?L.y:1.5;
    switch(f.type){
      case 'brazier': {
        for(let k=0;k<3;k++){ const a=k*2.094+f.ph; dyn(x+Math.cos(a)*0.2,0.42,z+Math.sin(a)*0.2,G('|'),0.6,c[0]*0.55*fl+0.04,c[1]*0.55*fl+0.04,c[2]*0.55*fl+0.06,2,Math.atan2(Math.cos(a),Math.sin(a))); }
        for(let k=0;k<12;k++){ const a=k/12*Math.PI*2+f.ph; dyn(x+Math.cos(a)*0.34,0.86,z+Math.sin(a)*0.34,G(k%2?'=':'-'),0.3,c[0]*1.3*fl,c[1]*1.3*fl,c[2]*1.3*fl,2,Math.atan2(Math.cos(a),Math.sin(a))); }
        for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; dyn(x+Math.cos(a)*0.22,0.72,z+Math.sin(a)*0.22,G('-'),0.22,c[0]*0.8*fl,c[1]*0.8*fl,c[2]*0.8*fl,2,Math.atan2(Math.cos(a),Math.sin(a))); }
        const core=0.52+0.08*Math.sin(t*14+f.ph)+0.05*Math.sin(t*23+f.ph), cb=near;
        dyn(x,1.16,z,G('*'),core,(c[0]*3.4*fl+0.9)*cb,(c[1]*3.4*fl+0.6)*cb,(c[2]*3.4*fl+0.35)*cb);
        for(let k=0;k<7;k++){ const q=(t*1.7+k/7+f.ph)%1, a=k*1.7+f.ph+t, rr=0.17*(1-q), kk=(1-q)*(1-q), b=2.8*cb;
          dyn(x+Math.cos(a)*rr,0.98+q*0.8,z+Math.sin(a)*rr,G(k%3===0?'^':k%3===1?'\'':'*'),0.32*(1-q*0.7),c[0]*b*(1-q),c[1]*b*kk,c[2]*b*kk*(1-q)); }
        f.acc+=dt*13;
        while(f.acc>=1){ f.acc--; spawn(x+(mr()-0.5)*0.3,1.1,z+(mr()-0.5)*0.3,(mr()-0.5)*0.4,0.7+mr()*0.9,(mr()-0.5)*0.4,1.4+mr()*2.2,G(mpick(['.','\'','*','`','.'])),0.1+mr()*0.12,c[0]*2.6,c[1]*2.1,c[2]*1.7,0); }
        break; }
      case 'crystal': {
        const cy=ly+Math.sin(t*0.9+f.ph)*0.1, rot=t*0.45+f.ph, cr=Math.cos(rot), sr=Math.sin(rot);
        const V=[[0,0.75,0],[0,-0.75,0],[0.45,0,0],[-0.45,0,0],[0,0,0.45],[0,0,-0.45]];
        const E=[[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[4,3],[3,5],[5,2]];
        for(let ei=0;ei<E.length;ei++){ const a=V[E[ei][0]], b=V[E[ei][1]];
          for(let s=1;s<=3;s++){ const u=s/4, lx=a[0]+(b[0]-a[0])*u, lyy=a[1]+(b[1]-a[1])*u, lz=a[2]+(b[2]-a[2])*u;
            const br=2.0*(0.75+0.25*Math.sin(t*2+ei+s))*fl;
            dyn(x+lx*cr+lz*sr,cy+lyy,z-lx*sr+lz*cr,G(s===2?'+':':'),0.2,c[0]*br,c[1]*br,c[2]*br); } }
        for(const v of V)dyn(x+v[0]*cr+v[2]*sr,cy+v[1],z-v[0]*sr+v[2]*cr,G('*'),0.26,c[0]*2.8*fl,c[1]*2.8*fl,c[2]*2.8*fl);
        const cb=3.6*fl*near;
        dyn(x,cy,z,G('*'),0.7+0.06*Math.sin(t*1.7+f.ph),c[0]*cb+0.5*near,c[1]*cb+0.5*near,c[2]*cb+0.5*near);
        for(let k=0;k<9;k++){ const a=t*0.7+k/9*Math.PI*2; dyn(x+Math.cos(a)*1.0,cy+Math.sin(t*1.1+k*2)*0.35,z+Math.sin(a)*1.0,G(k%3?'.':'+'),0.2,c[0]*1.6,c[1]*1.6,c[2]*1.6); }
        f.acc+=dt*(ly>3?8:5);
        while(f.acc>=1){ f.acc--; const a=mr()*Math.PI*2, r=0.4+mr()*(ly>3?3:1.4); spawn(x+Math.cos(a)*r,0.3+mr()*(ly+0.5),z+Math.sin(a)*r,0,0.12+mr()*0.2,0,3+mr()*4,G(mpick(['.','+','*','\''])),0.1+mr()*0.12,c[0]*2,c[1]*2,c[2]*2,1); }
        break; }
      case 'rune': {
        const sp=t*0.2+f.ph, br=1.8*fl;
        for(let k=0;k<20;k++){ const a=k/20*Math.PI*2+sp; const g=RUNESET[(k*7+Math.floor(t*0.8+k*0.3))%RUNESET.length];
          dyn(x+Math.cos(a)*1.55,0.05,z+Math.sin(a)*1.55,G(g),0.42,c[0]*br,c[1]*br,c[2]*br,1,a+Math.PI/2); }
        for(let k=0;k<12;k++){ const a=k/12*Math.PI*2-sp*1.6; dyn(x+Math.cos(a)*0.95,0.05,z+Math.sin(a)*0.95,G(k%2?'*':'+'),0.3,c[0]*br*1.2,c[1]*br*1.2,c[2]*br*1.2,1,a+Math.PI/2); }
        for(let k=0;k<6;k++){ const a=k/6*Math.PI*2+sp*0.5; dyn(x+Math.cos(a)*0.45,0.05,z+Math.sin(a)*0.45,G('='),0.26,c[0]*br,c[1]*br,c[2]*br,1,a); }
        const cb=3.3*fl*near;
        dyn(x,0.95+Math.sin(t*1.2+f.ph)*0.1,z,G(RUNESET[Math.floor(t*0.7)%RUNESET.length]),0.55,c[0]*cb+0.3,c[1]*cb+0.3,c[2]*cb+0.3);
        f.acc+=dt*8;
        while(f.acc>=1){ f.acc--; const a=mr()*Math.PI*2, r=mpick([0.95,1.55]); spawn(x+Math.cos(a)*r,0.1,z+Math.sin(a)*r,0,0.5+mr()*0.6,0,1.8+mr()*1.5,G(mpick(RUNESET)),0.14+mr()*0.08,c[0]*2.2,c[1]*2.2,c[2]*2.2,2); }
        break; }
      case 'lamp': {
        const top=ceilAt(x,z)-0.15, yy=ly+Math.sin(t*1.2+f.ph)*0.03;
        for(let y=top,k=0;y>yy+0.2&&k<40;y-=0.22,k++)dyn(x,y,z,G(':'),0.2,c[0]*0.5,c[1]*0.5,c[2]*0.5);
        dyn(x,yy,z,G('o'),0.36,c[0]*1.5*fl,c[1]*1.5*fl,c[2]*1.5*fl);
        const cb=3.2*fl*near;
        dyn(x,yy,z,G('*'),0.3,c[0]*cb+0.4*near,c[1]*cb+0.4*near,c[2]*cb+0.4*near);
        f.acc+=dt*1.5; while(f.acc>=1){ f.acc--; spawn(x,yy,z,(mr()-0.5)*0.2,-0.1-mr()*0.2,(mr()-0.5)*0.2,2+mr()*2,G('.'),0.12,c[0]*1.8,c[1]*1.8,c[2]*1.8,1); }
        break; }
      case 'fungus': {
        const GLs=['T','Y','f','?','t','T','Y','r'];
        for(let k=0;k<8;k++){ const a=k*0.9+f.ph, r=0.12+(k%3)*0.2, s=0.24+((k*37)%5)*0.06, b=(1.4+0.6*Math.sin(t*1.3+k))*fl;
          dyn(x+Math.cos(a)*r,s*0.5,z+Math.sin(a)*r,G(GLs[k]),s,c[0]*b,c[1]*b,c[2]*b); }
        f.acc+=dt*3; while(f.acc>=1){ f.acc--; spawn(x+(mr()-0.5)*0.8,0.3,z+(mr()-0.5)*0.8,(mr()-0.5)*0.1,0.12+mr()*0.15,(mr()-0.5)*0.1,4+mr()*3,G(mpick(['.','\'','`'])),0.1,c[0]*1.8,c[1]*1.8,c[2]*1.8,1); }
        break; }
      case 'abyss': {
        const sp=t*0.15+f.ph, by=-CH_D+0.12;
        for(let k=0;k<18;k++){ const a=k/18*Math.PI*2+sp; dyn(x+Math.cos(a)*1.7,by,z+Math.sin(a)*1.7,G(RUNESET[(k*5+Math.floor(t*0.5))%RUNESET.length]),0.62,c[0]*1.5*fl,c[1]*1.5*fl,c[2]*1.5*fl,1,a+Math.PI/2); }
        for(let k=0;k<10;k++){ const a=k/10*Math.PI*2-sp*1.4; dyn(x+Math.cos(a)*0.9,by,z+Math.sin(a)*0.9,G('*'),0.4,c[0]*2,c[1]*2,c[2]*2,1,a); }
        dyn(x,ly+Math.sin(t*0.7+f.ph)*0.3,z,G('*'),1.2,c[0]*3.6*fl+0.4,c[1]*3.6*fl+0.25,c[2]*3.6*fl+0.15);
        for(let k=0;k<16;k++){ const q=(t*0.22+k/16+f.ph)%1, y=-CH_D+q*(CH_D+1.2), a=k*2.4+t*0.3, r=0.6+q*0.9, b=2.4*(1-q)*fl;
          dyn(x+Math.cos(a)*r,y,z+Math.sin(a)*r,G(k%2?'^':'\''),0.36,c[0]*b,c[1]*b*0.8,c[2]*b*0.7); }
        f.acc+=dt*11;
        while(f.acc>=1){ f.acc--; const a=mr()*Math.PI*2, r=mr()*2.6; spawn(x+Math.cos(a)*r,-CH_D+0.5+mr()*2,z+Math.sin(a)*r,(mr()-0.5)*0.3,0.8+mr()*0.9,(mr()-0.5)*0.3,7+mr()*5,G(mpick(['.','\'','*','^','`'])),0.12+mr()*0.14,c[0]*2.6,c[1]*2.2,c[2]*1.8,0); }
        break; }
      case 'embers': {
        const cb=near*fl;
        dyn(x,0.22,z,G('*'),0.32+0.05*Math.sin(t*11+f.ph),c[0]*2.6*cb,c[1]*2.0*cb,c[2]*1.6*cb);
        for(let k=0;k<4;k++){ const q=(t*1.3+k/4+f.ph)%1, a=k*1.6+t; dyn(x+Math.cos(a)*0.1*(1-q),0.15+q*0.45,z+Math.sin(a)*0.1*(1-q),G(k%2?'^':'\''),0.2*(1-q*0.6),c[0]*2.2*(1-q)*cb,c[1]*1.6*(1-q)*(1-q)*cb,c[2]*(1-q)*(1-q)*cb); }
        f.acc+=dt*4; while(f.acc>=1){ f.acc--; spawn(x+(mr()-0.5)*0.3,0.3,z+(mr()-0.5)*0.3,(mr()-0.5)*0.2,0.4+mr()*0.5,(mr()-0.5)*0.2,1.5+mr()*1.5,G('.'),0.08,c[0]*2,c[1]*1.6,c[2]*1.2,0); }
        break; }
      case 'relic': {
        const yy=ly+Math.sin(t*1.1+f.ph)*0.08, cb=3.0*fl*near;
        dyn(x,yy,z,G('?'),0.5,c[0]*cb+0.3,c[1]*cb+0.25,c[2]*cb+0.15);
        for(let k=0;k<10;k++){ const a=t*0.9+k/10*Math.PI*2; dyn(x+Math.cos(a)*0.55,yy+Math.sin(t*1.7+k)*0.12,z+Math.sin(a)*0.55,G(k%2?'.':'*'),0.16,c[0]*1.8,c[1]*1.8,c[2]*1.8); }
        f.acc+=dt*3; while(f.acc>=1){ f.acc--; const a=mr()*6.28; spawn(x+Math.cos(a)*0.4,yy-0.3,z+Math.sin(a)*0.4,0,0.25+mr()*0.2,0,2+mr()*1.5,G(mpick(['.','*','+'])),0.1,c[0]*2,c[1]*2,c[2]*2,2); }
        break; }
      case 'pages': {
        f.acc+=dt*1.6; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*3.5; spawn(x+Math.cos(a)*r,0.4+mr()*2.2,z+Math.sin(a)*r,(mr()-0.5)*0.25,0.03+mr()*0.08,(mr()-0.5)*0.25,6+mr()*4,G(mpick(['?','=','~','?'])),0.22,c[0]*1.2,c[1]*1.2,c[2]*1.2,1); }
        break; }
      case 'mist': {
        f.acc+=dt*7; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*4; spawn(x+Math.cos(a)*r,0.1+mr()*0.35,z+Math.sin(a)*r,(mr()-0.5)*0.35,0.01,(mr()-0.5)*0.35,6+mr()*4,G(mpick(['~','~','-','.'])),0.3+mr()*0.15,c[0]*0.7,c[1]*0.7,c[2]*0.7,1); }
        break; }
      case 'fall': {
        // a column of water falling from a glowing rift in the vault
        const top=Math.max(4,ceilAt(x,z)-0.15);
        for(let s2=0;s2<5;s2++){ const a=s2/5*Math.PI*2+t*0.3, ox=Math.cos(a)*0.22, oz=Math.sin(a)*0.22;
          for(let j=0;j*0.36<top;j++){ const y=top-((t*7+j*0.36+s2*0.07)%top), b=1.1+0.6*Math.sin(t*9+j+s2); dyn(x+ox,y,z+oz,G(j%3===0?'|':j%3===1?':':'!'),0.32,c[0]*b,c[1]*b,c[2]*b); } }
        for(let k=0;k<12;k++){ const a=k/12*Math.PI*2+t*0.05, r2=0.55+0.15*Math.sin(t+k); dyn(x+Math.cos(a)*r2,top+0.05,z+Math.sin(a)*r2,G(k%2?'*':'~'),0.28,c[0]*2.4,c[1]*2.4,c[2]*2.4,1,a); }
        dyn(x,top+0.08,z,G('*'),0.5,c[0]*3.2*near,c[1]*3.2*near,c[2]*3.2*near,1,0);
        f.acc+=dt*22;
        while(f.acc>=1){ f.acc--; const a=mr()*6.28, r2=0.2+mr()*0.6;
          spawn(x+Math.cos(a)*r2,0.15,z+Math.sin(a)*r2,Math.cos(a)*1.2,0.8+mr()*1.6,Math.sin(a)*1.2,0.9+mr(),G(mpick(['~','.','\'','o'])),0.14+mr()*0.14,0.55,0.8,1.0,1);
          if(mr()<0.3)spawn(x+(mr()-0.5)*2,0.4+mr(),z+(mr()-0.5)*2,(mr()-0.5)*0.3,0.15,(mr()-0.5)*0.3,3+mr()*2,G('.'),0.6,0.12,0.16,0.22,1); }
        break; }
      case 'veinlight': {
        const wd=f.wd||[1,0];
        f.acc+=dt*1.4; while(f.acc>=1){ f.acc--; const tX=-wd[1], tZ=wd[0], u=(mr()-0.5)*1.6; spawn(x+wd[0]*0.92+tX*u,0.5+mr()*1.8,z+wd[1]*0.92+tZ*u,0,0.02,0,0.5+mr()*0.4,G(mpick(['*','+','.'])),0.14,c[0]*2.6,c[1]*2.6,c[2]*2.6,2); }
        break; }
      case 'crater': {
        const cb=near*(f.active?1:0.4);
        for(let k=0;k<10;k++){ const a=k/10*Math.PI*2; dyn(x+Math.cos(a)*0.55,0.05,z+Math.sin(a)*0.55,G(k%2?'^':'%'),0.34,0.5,0.25,0.2,1,a+Math.PI/2); }
        dyn(x,0.12,z,G('*'),0.5,c[0]*3*cb,c[1]*2*cb,c[2]*cb,1,t*0.3);
        f.acc+=dt*(f.active?10:2); while(f.acc>=1){ f.acc--; spawn(x+(mr()-0.5)*0.6,0.2,z+(mr()-0.5)*0.6,(mr()-0.5)*0.4,0.6+mr()*1.2,(mr()-0.5)*0.4,1+mr()*1.5,G(mpick(['.','*','\''])),0.1,c[0]*2.6,c[1]*1.8,c[2]*1.2,0); }
        break; }
      case 'spring': {
        const wd=f.wd||[1,0], wx=x+wd[0]*0.85, wz=z+wd[1]*0.85;
        if(f.active){
          for(let j=0;j<12;j++){ const q=(t*1.6+j/12)%1; dyn(wx-wd[0]*q*1.3,1.3-q*q*1.25,wz-wd[1]*q*1.3,G(j%2?'~':'-'),0.3,0.5,0.8,1.0); }
          f.acc+=dt*12; while(f.acc>=1){ f.acc--; const a=mr()*6.28; spawn(wx-wd[0]*1.3,0.1,wz-wd[1]*1.3,Math.cos(a)*0.8,0.5+mr(),Math.sin(a)*0.8,0.8+mr()*0.6,G(mpick(['~','.','o'])),0.14,0.45,0.7,0.95,1); }
        } else { f.acc+=dt*1.5; while(f.acc>=1){ f.acc--; spawn(wx,1.4,wz,0,-1.5,0,0.9,G('.'),0.1,0.35,0.55,0.8,1); } }
        break; }
      case 'firefly': {
        for(let k=0;k<16;k++){ const a=t*(0.25+(k%5)*0.05)+k*2.4+f.ph, r2=0.6+((k*37)%11)/11*2.2, y=0.6+((k*53)%13)/13*2.2+Math.sin(t*0.9+k)*0.25, tw=0.5+0.5*Math.sin(t*(2+k%3)+k*1.7);
          dyn(x+Math.cos(a)*r2,y,z+Math.sin(a*1.3)*r2,G(k%4?'.':'*'),0.14+0.06*tw,c[0]*2.2*tw,c[1]*2.2*tw,c[2]*2.2*tw); }
        break; }
      case 'marsh': {
        const mx=x+Math.sin(t*0.4+f.ph)*1.1, mz=z+Math.cos(t*0.33+f.ph*1.7)*1.1, my=ly+Math.sin(t*0.9+f.ph)*0.25, cb=fl*near;
        dyn(mx,my,mz,G('*'),0.3+0.05*Math.sin(t*6+f.ph),c[0]*2.6*cb,c[1]*2.6*cb,c[2]*2.6*cb);
        for(let k=0;k<6;k++){ const a=t*1.4+k/6*Math.PI*2; dyn(mx+Math.cos(a)*0.22,my+Math.sin(t*2+k)*0.08,mz+Math.sin(a)*0.22,G('.'),0.14,c[0]*1.5,c[1]*1.5,c[2]*1.5); }
        f.acc+=dt*4; while(f.acc>=1){ f.acc--; spawn(mx,my,mz,(mr()-0.5)*0.15,0.05+mr()*0.1,(mr()-0.5)*0.15,1.5+mr()*1.5,G(mpick(['.','\'','`'])),0.08,c[0]*1.6,c[1]*1.6,c[2]*1.6,1); }
        break; }
      case 'well': case 'sun': {
        const top=ceilAt(x,z)-0.05;
        for(let k=0;k<10;k++){ const a=k/10*Math.PI*2+t*0.05; dyn(x+Math.cos(a)*0.45,top,z+Math.sin(a)*0.45,G(k%2?'.':'*'),0.22,c[0]*2.2,c[1]*2.15,c[2]*2.05); }
        dyn(x,top,z,G('*'),0.45,c[0]*3,c[1]*3,c[2]*2.85);
        f.acc+=dt*9; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=Math.sqrt(mr())*0.75; spawn(x+Math.cos(a)*r,0.2+mr()*(top-0.4),z+Math.sin(a)*r,(mr()-0.5)*0.05,-0.05-mr()*0.05,(mr()-0.5)*0.05,4+mr()*3,G(mpick(['.','.','\'','*'])),0.1+mr()*0.06,c[0]*1.4,c[1]*1.4,c[2]*1.3,1); }
        if(mr()<dt*2.5){ const r=mr()*0.6, a=mr()*6.28; spawn(x+Math.cos(a)*r,0.3+mr()*(top-0.6),z+Math.sin(a)*r,0,-0.02,0,3,G('|'),0.9,0.06,0.055,0.04,1); }
        break; }
      case 'orb': {
        for(let y=0.15;y<1.3;y+=0.24)dyn(x,y,z,G(y<0.3||y>1.1?'=':'|'),0.34,0.3+c[0]*0.15,0.3+c[1]*0.15,0.36+c[2]*0.15);
        const yy=ly+Math.sin(t*1.3+f.ph)*0.06, cb=near*fl;
        dyn(x,yy,z,G('o'),0.5,c[0]*2.4*cb,c[1]*2.4*cb,c[2]*2.4*cb);
        dyn(x,yy,z,G('*'),0.3,(c[0]*3.4+0.4)*cb,(c[1]*3.4+0.4)*cb,(c[2]*3.4+0.4)*cb);
        for(let k=0;k<6;k++){ const a=t*0.8+k/6*Math.PI*2; dyn(x+Math.cos(a)*0.42,yy+Math.sin(a*2)*0.08,z+Math.sin(a)*0.42,G('.'),0.16,c[0]*1.6,c[1]*1.6,c[2]*1.6); }
        break; }
      case 'bloodwort': {
        if(!f.burst){
          for(let k=0;k<4;k++){ const a=k*1.7+f.ph, h=0.7+k*0.18; const pb=(1.2+0.5*Math.sin(t*2.2+k))*near;
            dyn(x+Math.cos(a)*0.32,h,z+Math.sin(a)*0.32,G('o'),0.26,c[0]*pb*1.6,c[1]*pb,c[2]*pb); }
          if(Math.hypot(x-player.x,z-player.z)<2.3){ f.burst=true; L.fade=1;
            for(let q=0;q<40;q++){ const a=mr()*6.28; spawn(x+Math.cos(a)*0.3,0.8+mr()*0.6,z+Math.sin(a)*0.3,Math.cos(a)*0.6,0.4+mr()*0.9,Math.sin(a)*0.6,2.5+mr()*2,G(mpick(['*','.','+','o'])),0.13,2.4,0.6,0.7,2); }
            sChime(x,z,0.5); sChime(x,z,0.35);
            msg('<b style="color:#ff5566">*</b>ブラッドワートの実が弾け、温かな赤い光の粒が舞い上がった。'); }
        } else if(L&&L.fade>0.25)L.fade-=dt*0.08;
        break; }
      case 'vent': {
        for(let k=0;k<9;k++){ const a=k/9*Math.PI*2; dyn(x+Math.cos(a)*0.42,0.05,z+Math.sin(a)*0.42,G('o'),0.3,0.5,0.52,0.6,1,a); }
        dyn(x,0.06,z,G('0'),0.4,0.6,0.62,0.72,1,0);
        f.next=(f.next===undefined?2+mr()*5:f.next)-dt;
        if(f.next<=0){ f.next=4+mr()*6; f.erupt=2.2; sHiss(x,z,2.2); }
        if(f.erupt>0){ f.erupt-=dt; if(L)L.boost=Math.min(1.2,(L.boost||0)+dt*3);
          for(let q=0;q<Math.ceil(dt*45);q++){ const a=mr()*6.28; spawn(x+Math.cos(a)*0.15,0.2,z+Math.sin(a)*0.15,Math.cos(a)*0.4,3+mr()*2,Math.sin(a)*0.4,1.4+mr(),G(mpick(['~','.',':','\''])),0.3+mr()*0.25,0.5,0.52,0.58,1); } }
        else if(L)L.boost=Math.max(0,(L.boost||0)-dt*0.8);
        break; }
      case 'pitglow': {
        if(!D.collapsed)break;
        f.acc+=dt*6; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*1.6; spawn(x+Math.cos(a)*r,-5.5,z+Math.sin(a)*r,(mr()-0.5)*0.2,0.9+mr()*0.8,(mr()-0.5)*0.2,4+mr()*2,G(mpick(['.','*','\''])),0.12,c[0]*2.4,c[1]*2,c[2]*1.5,0); }
        break; }
      case 'xlight': {
        f.acc+=dt*4; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*2; spawn(x+Math.cos(a)*r,0.3+mr()*3,z+Math.sin(a)*r,0,0.06+mr()*0.08,0,2+mr()*2,G(mpick(['+','*','.'])),0.12,c[0]*2.2,c[1]*2.2,c[2]*2.2,1); }
        break; }
      case 'torch': {
        const nx=f.nx, nz=f.nz, yaw=Math.atan2(nx,nz), wx=f.wx+nx*0.1, wz=f.wz+nz*0.1, tX=Math.cos(yaw), tZ=-Math.sin(yaw), ik=0.18+fl*0.3;
        dyn(wx,1.72,wz,G('|'),0.36,0.7*ik,0.55*ik,0.5*ik,2,yaw);
        dyn(wx-tX*0.12+nx*0.05,1.98,wz-tZ*0.12+nz*0.05,G('\\'),0.26,0.7*ik,0.55*ik,0.5*ik,2,yaw);
        dyn(wx+tX*0.12+nx*0.05,1.98,wz+tZ*0.12+nz*0.05,G('/'),0.26,0.7*ik,0.55*ik,0.5*ik,2,yaw);
        dyn(wx+nx*0.08,1.9,wz+nz*0.08,G('_'),0.26,0.7*ik,0.55*ik,0.5*ik,2,yaw);
        const fx=wx+nx*0.14, fz=wz+nz*0.14, cb=near*fl;
        dyn(fx,2.12,fz,G('*'),0.34+0.05*Math.sin(t*15+f.ph),(c[0]*3.2+0.6)*cb,(c[1]*3.2+0.4)*cb,(c[2]*3.2+0.2)*cb);
        for(let k=0;k<4;k++){ const q=(t*1.9+k/4+f.ph)%1, a=k*1.9+t*1.3;
          dyn(fx+Math.cos(a)*0.06*(1-q),2.05+q*0.45,fz+Math.sin(a)*0.06*(1-q),G(k%2?'^':'\''),0.22*(1-q*0.6),c[0]*2.6*(1-q)*cb,c[1]*2.0*(1-q)*(1-q)*cb,c[2]*1.4*(1-q)*(1-q)*cb); }
        f.acc+=dt*4; while(f.acc>=1){ f.acc--; spawn(fx,2.2,fz,(mr()-0.5)*0.2+nx*0.1,0.5+mr()*0.6,(mr()-0.5)*0.2+nz*0.1,1+mr()*1.5,G(mpick(['.','\'','`'])),0.08,c[0]*2.4,c[1]*1.9,c[2]*1.4,0); }
        break; }
      case 'lava': {
        f.acc+=dt*7;
        while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*3.2; spawn(x+Math.cos(a)*r,0.15,z+Math.sin(a)*r,(mr()-0.5)*0.3,0.5+mr()*0.9,(mr()-0.5)*0.3,1.5+mr()*2.5,G(mpick(['.','\'','*','`'])),0.09+mr()*0.08,c[0]*2.8,c[1]*2.2,c[2]*1.6,0); }
        f.burst=(f.burst||0)-dt;
        if(f.burst<=0){ f.burst=0.8+mr()*2.2; f.bx=x+(mr()-0.5)*4; f.bz=z+(mr()-0.5)*4; const ci=Math.floor(f.bz/CELL)*MW+Math.floor(f.bx/CELL); f.bt=(ci>=0&&ci<NCELL&&D.liquid[ci]===LQ_LAVA)?0:1; }
        if(f.bt<1){ f.bt+=dt*1.6; const q=Math.min(1,f.bt), rr=0.15+q*0.7, b=2.6*(1-q);
          for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; dyn(f.bx+Math.cos(a)*rr,0.14+Math.sin(q*Math.PI)*0.25,f.bz+Math.sin(a)*rr,G(k%2?'o':'*'),0.2*(1-q*0.5),c[0]*b,c[1]*b*0.7,c[2]*b*0.4); }
          if(q<0.2)dyn(f.bx,0.22,f.bz,G('0'),0.4,c[0]*3,c[1]*2,c[2]); }
        break; }
      case 'portal': {
        // a ring of glyphs standing on its edge, turned to face you, with a swirl inside
        const ddx=player.x-x, ddz=player.z-z, dl=Math.hypot(ddx,ddz)||1, rx=-ddz/dl, rz=ddx/dl, cy=1.5, cb=near*fl;
        for(let k=0;k<20;k++){ const a=k/20*Math.PI*2+t*0.4; dyn(x+rx*Math.cos(a)*1.05,cy+Math.sin(a)*1.2,z+rz*Math.cos(a)*1.05,G(k%2?'*':'+'),0.3,c[0]*2.6*cb,c[1]*2.6*cb,c[2]*2.6*cb); }
        for(let k=0;k<26;k++){ const q=((t*0.35+k/26)%1), a=k*2.4+t*1.6, rr=(1-q)*0.95; dyn(x+rx*Math.cos(a)*rr,cy+Math.sin(a)*rr*1.1,z+rz*Math.cos(a)*rr,G(k%3===0?'~':k%3===1?'.':'*'),0.22,c[0]*(1+q*2)*cb,c[1]*(1+q*2)*cb,c[2]*(1+q*2)*cb); }
        dyn(x,cy,z,G('*'),0.6,c[0]*3.4*cb+0.4,c[1]*3.4*cb+0.4,c[2]*3.4*cb+0.4);
        f.acc+=dt*8; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=1.4+mr()*0.6; spawn(x+Math.cos(a)*r,0.3+mr()*2.4,z+Math.sin(a)*r,-Math.cos(a)*0.6,0,-Math.sin(a)*0.6,1.6,G(mpick(['.','*','+'])),0.12,c[0]*2,c[1]*2,c[2]*2,1); }
        break; }
      case 'bstairs':
      case 'upstairs': {
        const n=24;
        for(let k=0;k<n;k++){ const h=k/n, a=-h*Math.PI*4-t*0.5, b=(1.1+1.6*h)*fl; dyn(x+Math.cos(a)*0.65,0.15+h*2.4,z+Math.sin(a)*0.65,G('<'),0.26,c[0]*b,c[1]*b,c[2]*b); }
        dyn(x,1.2+Math.sin(t*1.2)*0.08,z,G('<'),0.9,c[0]*3*fl*near+0.3,c[1]*3*fl*near+0.3,c[2]*3*fl*near+0.3);
        f.acc+=dt*6; while(f.acc>=1){ f.acc--; const a=mr()*6.28, r=mr()*1.0; spawn(x+Math.cos(a)*r,2.4,z+Math.sin(a)*r,0,-0.6-mr()*0.5,0,2+mr(),G(mpick(['.','*','\''])),0.11,c[0]*2,c[1]*2,c[2]*2,2); }
        break; }
      case 'tele': {
        // a magic circle that carries you to its twin
        const cb=near*fl;
        for(let k=0;k<18;k++){ const a=k/18*Math.PI*2+t*0.6; dyn(x+Math.cos(a)*0.85,0.05,z+Math.sin(a)*0.85,G(k%3?'*':'+'),0.3,c[0]*1.8*cb,c[1]*1.8*cb,c[2]*1.8*cb,1,a); }
        for(let k=0;k<12;k++){ const a=-k/12*Math.PI*2-t*0.9; dyn(x+Math.cos(a)*0.5,0.06,z+Math.sin(a)*0.5,G(k%2?'o':'.'),0.24,c[0]*2.2*cb,c[1]*2.2*cb,c[2]*2.2*cb,1,a); }
        dyn(x,0.07,z,G('*'),0.5,c[0]*2.8*cb,c[1]*2.8*cb,c[2]*2.8*cb,1,t);
        f.acc+=dt*4; while(f.acc>=1){ f.acc--; const a=mr()*6.28; spawn(x+Math.cos(a)*0.8,0.1,z+Math.sin(a)*0.8,0,0.6+mr()*0.6,0,1.4,G(mpick(['.','*','+'])),0.11,c[0]*2,c[1]*2,c[2]*2,1); }
        break; }
      case 'stairs': {
        const n=32;
        for(let k=0;k<n;k++){ const h=k/n, a=h*Math.PI*4+t*0.5, b=(1.1+2.0*h)*fl; dyn(x+Math.cos(a)*0.75,0.15+h*2.7,z+Math.sin(a)*0.75,G('>'),0.28,c[0]*b,c[1]*b,c[2]*b); }
        for(let k=0;k<16;k++){ const a=k/16*Math.PI*2-t*0.3; dyn(x+Math.cos(a)*1.25,0.04,z+Math.sin(a)*1.25,G('>'),0.34,c[0]*1.6,c[1]*1.6,c[2]*1.6,1,a+Math.PI); }
        const cb=3.6*fl*near;
        dyn(x,1.3+Math.sin(t*1.2)*0.08,z,G('>'),1.05,c[0]*cb+0.4,c[1]*cb+0.35,c[2]*cb+0.2);
        f.acc+=dt*9; while(f.acc>=1){ f.acc--; const a=mr()*Math.PI*2, r=mr()*1.2; spawn(x+Math.cos(a)*r,0.1,z+Math.sin(a)*r,0,0.5+mr()*0.7,0,2+mr()*1.5,G(mpick(['.','*','\'','+'])),0.12,c[0]*2.3,c[1]*2.3,c[2]*2.3,2); }
        break; }
    }
  }
}

// ---------------------------------------------------------------- doors
function drawDoors(t,dt){
  for(const d of D.doors){
    if(d.gone)continue;
    const dx=d.bx-player.x, dz=d.bz-player.z, dd=Math.hypot(dx,dz);
    let tgt=dd<2.7?1:0;
    if(!tgt)for(const m of monsters){ if(Math.hypot(m.x-d.bx,m.z-d.bz)<1.7){tgt=1;break;} }
    if(tgt&&d.o<0.05&&!d.creaked){ d.creaked=true; sCreak(d.bx,d.bz); makeNoise(d.bx,d.bz,7,0.3); } if(!tgt&&d.o<0.02)d.creaked=false;
    d.o+=(tgt-d.o)*Math.min(1,dt*4);
    if(dd>40)continue;
    const yaw=d.yaw+d.o*1.75, tX=Math.cos(yaw), tZ=-Math.sin(yaw), bX=Math.cos(d.yaw), bZ=-Math.sin(d.yaw);
    const hx=d.bx-bX*0.95, hz=d.bz-bZ*0.95;
    const l1=cellLight((d.i%MW+0.5)*CELL,(((d.i/MW)|0)+0.5)*CELL), lr=l1[0], lg=l1[1], lb=l1[2];
    const l2=cellLight((d.j%MW+0.5)*CELL,(((d.j/MW)|0)+0.5)*CELL);
    const lan=Math.max(0,1-dd/8); const la=lan*lan*0.8;
    const k0=0.07+la, wr=0.62*(k0+(lr+l2[0])*0.2), wg=0.38*(k0+(lg+l2[1])*0.2), wb=0.22*(k0+(lb+l2[2])*0.2);
    for(let row=0;row<9;row++)for(let col=0;col<6;col++){
      const u=(col+0.5)*(1.9/6), y=0.18+row*0.335;
      let ch=row===8?'=':(col===0||col===5)?'|':(row%3===0?'=':'+'), r=wr, g=wg, b=wb;
      if(col===4&&row===3){ ch='o'; r*=2.2; g*=2.2; b*=1.4; }
      dyn(hx+tX*u,y,hz+tZ*u,G(ch),0.34,r,g,b,2,yaw);
      if(col<5&&row<8)dyn(hx+tX*(u+0.16)-Math.sin(yaw)*0.07,y+0.17,hz+tZ*(u+0.16)-Math.cos(yaw)*0.07,G('#'),0.26,r*0.5,g*0.5,b*0.5,2,yaw);
    }
  }
}

// ---------------------------------------------------------------- ambient sound (procedural, Web Audio)
const SND_LV=[0.85,0.5,0.25,0], SND_NAME=['大','中','小','オフ'];
const SND={lv:1,ctx:null,on:true,master:null,inp:null,wet:null,noise:null,L:{},envT:0,env:{water:0,lava:0,chasm:0,bog:0,xtal:0,burn:0,fire:0,fx:0,fz:0,cave:false}};
const sndReady=()=>SND.ctx&&SND.ctx.state==='running'&&SND.on;
function sndInit(){
  try{
    if(SND.ctx){ SND.ctx.resume(); return; }
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
    const ctx=new AC(); SND.ctx=ctx;
    const master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination); SND.master=master;
    master.gain.setTargetAtTime(SND_LV[SND.lv],ctx.currentTime,1.5);
    const comp=ctx.createDynamicsCompressor(); comp.connect(master);
    const dry=ctx.createGain(); dry.connect(comp);
    const ir=ctx.createBuffer(2,Math.floor(ctx.sampleRate*3.4),ctx.sampleRate);
    for(let c=0;c<2;c++){ const d=ir.getChannelData(c); for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.4); }
    const conv=ctx.createConvolver(); conv.buffer=ir; const wet=ctx.createGain(); wet.gain.value=0.35; conv.connect(wet); wet.connect(comp); SND.wet=wet;
    const inp=ctx.createGain(); inp.connect(dry); inp.connect(conv); SND.inp=inp;
    const nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate), nd=nb.getChannelData(0); for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1; SND.noise=nb;
    const loop=(type,freq,q)=>{ const s0=ctx.createBufferSource(); s0.buffer=nb; s0.loop=true; const f=ctx.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q; const g=ctx.createGain(); g.gain.value=0; s0.connect(f); f.connect(g); g.connect(inp); s0.start(); return {g,f}; };
    SND.L.rumble=loop('lowpass',90,0.7); SND.L.water=loop('bandpass',700,0.6); SND.L.fire=loop('bandpass',1100,0.5); SND.L.wind=loop('bandpass',320,0.4);
    const drone=ctx.createGain(); drone.gain.value=0; drone.connect(inp);
    const os=[[55,'sine',1],[82.6,'sine',0.7],[110.3,'triangle',0.2]].map(([f,ty,v])=>{ const o=ctx.createOscillator(); o.type=ty; o.frequency.value=f; const g=ctx.createGain(); g.gain.value=v; o.connect(g); g.connect(drone); o.start(); return o; });
    SND.L.drone={g:drone,o:os};
  }catch(e){ SND.ctx=null; }
}
function sndToggle(){ SND.lv=(SND.lv+1)%SND_LV.length; SND.on=SND_LV[SND.lv]>0; if(SND.master)SND.master.gain.setTargetAtTime(SND_LV[SND.lv],SND.ctx.currentTime,0.25); showHint('音量：'+SND_NAME[SND.lv]); setTimeout(()=>showHint(''),1200); }
const sDist=(x,z)=>x===undefined?1:Math.pow(clamp(1-Math.hypot(x-player.x,z-player.z)/24,0,1),1.4);
const sPan=(x,z)=>{ if(x===undefined)return (Math.random()-0.5)*1.2; const dx=x-player.x, dz=z-player.z, l=Math.hypot(dx,dz)||1; return clamp((dx*Math.cos(player.yaw)-dz*Math.sin(player.yaw))/l,-1,1)*0.85; };
function sOut(x,z,vol){ const ctx=SND.ctx, g=ctx.createGain(); g.gain.value=vol*sDist(x,z); if(ctx.createStereoPanner){ const p=ctx.createStereoPanner(); p.pan.value=sPan(x,z); g.connect(p); p.connect(SND.inp); } else g.connect(SND.inp); return g; }
function sEnv(node,t,a,d,peak){ node.gain.setValueAtTime(0.0001,t); node.gain.exponentialRampToValueAtTime(peak||1,t+a); node.gain.exponentialRampToValueAtTime(0.0001,t+a+d); }
function sNoise(t,dur,type,freq,q,out,f2){ const ctx=SND.ctx, s0=ctx.createBufferSource(); s0.buffer=SND.noise; const f=ctx.createBiquadFilter(); f.type=type; f.frequency.setValueAtTime(freq,t); if(f2)f.frequency.exponentialRampToValueAtTime(f2,t+dur); f.Q.value=q; const e=ctx.createGain(); s0.connect(f); f.connect(e); e.connect(out); s0.start(t,Math.random()*1.5); s0.stop(t+dur+0.05); return e; }
function sTone(t,type,f1,f2,dur,out){ const ctx=SND.ctx, o=ctx.createOscillator(); o.type=type; o.frequency.setValueAtTime(f1,t); if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur); const e=ctx.createGain(); o.connect(e); e.connect(out); o.start(t); o.stop(t+dur+0.05); return e; }
function sDrip(x,z,vol){ if(!sndReady())return; const t=SND.ctx.currentTime, f=900+Math.random()*1500; sEnv(sTone(t,'sine',f,f*0.55,0.12,sOut(x,z,vol)),t,0.004,0.2); }
function sCrackle(x,z,vol){ if(!sndReady())return; const t=SND.ctx.currentTime, d=0.004+Math.random()*0.014; sEnv(sNoise(t,d,'highpass',1800+Math.random()*2500,0.8,sOut(x,z,vol)),t,0.001,d); }
function sCrackleBurst(x,z){ for(let k=0;k<8;k++)setTimeout(()=>sCrackle(x,z,0.5),k*35); }
function sBubble(x,z,vol,low){ if(!sndReady())return; const t=SND.ctx.currentTime; sEnv(sTone(t,'sine',low?70:220,low?190:650,0.11,sOut(x,z,vol)),t,0.01,0.12); }
function sChime(x,z,vol){ if(!sndReady())return; const t=SND.ctx.currentTime, f=[1046.5,1174.7,1318.5,1568,1760,2093][Math.floor(Math.random()*6)], o=sOut(x,z,vol);
  sEnv(sTone(t,'sine',f,0,2.2,o),t,0.005,2.0,0.6); sEnv(sTone(t,'sine',f*2.76,0,1.2,o),t,0.003,1.0,0.15); }
function sBoom(vol){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(undefined,undefined,vol); sEnv(sNoise(t,1.3,'lowpass',900,0.7,o,70),t,0.01,1.2); sEnv(sTone(t,'sine',62,32,0.9,o),t,0.01,0.85,0.9); }
function sWhoosh(){ if(!sndReady())return; const t=SND.ctx.currentTime; sEnv(sNoise(t,0.35,'bandpass',400,1.2,sOut(undefined,undefined,0.3),2600),t,0.05,0.3); }
function sRumble(vol,dur){ if(!sndReady())return; const t=SND.ctx.currentTime; sEnv(sNoise(t,dur,'lowpass',140,0.8,sOut(undefined,undefined,vol)),t,0.3,dur); }
function sCreak(x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.18), f=SND.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=700; f.Q.value=5; f.connect(o); sEnv(sTone(t,'sawtooth',150,92,0.45,f),t,0.04,0.4); }
function sSplash(vol){ if(!sndReady())return; const t=SND.ctx.currentTime; sEnv(sNoise(t,0.22,'bandpass',1300,0.9,sOut(undefined,undefined,vol),600),t,0.005,0.2); }
function sHiss(x,z,dur){ if(!sndReady())return; const t=SND.ctx.currentTime; sEnv(sNoise(t,dur,'highpass',3200,0.5,sOut(x,z,0.22)),t,0.15,dur); }
function sAlert(x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.22); sEnv(sTone(t,'triangle',520,780,0.12,o),t,0.01,0.14); sEnv(sTone(t+0.13,'triangle',780,1040,0.12,o),t+0.13,0.01,0.18); }
function sRoar(){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(undefined,undefined,0.5), f=SND.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420; f.connect(o);
  sEnv(sTone(t,'sawtooth',70,42,2.2,f),t,0.15,2.0); sEnv(sTone(t,'sawtooth',104,61,2.0,f),t,0.2,1.8,0.6); sEnv(sNoise(t,2.2,'lowpass',260,0.7,o,90),t,0.2,2.0,0.5); }
function sSqueak(x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.07); sEnv(sTone(t,'sine',5200,3600,0.06,o),t,0.003,0.06); sEnv(sTone(t+0.09,'sine',5000,3500,0.05,o),t+0.09,0.003,0.05); }
function sndUpdate(dt){
  if(!SND.ctx||!SND.on)return;
  const E=SND.env;
  SND.envT-=dt;
  if(SND.envT<=0){
    SND.envT=0.25;
    const pcx=Math.floor(player.x/CELL), pcz=Math.floor(player.z/CELL); let water=0,lava=0,chasm=0,bog=0,xtal=0,burn=0,n=0;
    for(let dz=-6;dz<=6;dz++)for(let dx=-6;dx<=6;dx++){ const x=pcx+dx, z=pcz+dz; if(x<0||z<0||x>=MW||z>=MH)continue; const i=z*MW+x, w=Math.max(0,1-Math.hypot(dx,dz)/7); n+=w; const lq=D.liquid[i], tt=D.tile[i];
      if(lq===LQ_WATER||lq===LQ_DEEP)water+=w; else if(lq===LQ_LAVA)lava+=w; else if(lq===LQ_BOG)bog+=w; if(tt===TC)chasm+=w; if(tt===TX)xtal+=w; if(fire[i]>0)burn+=w*fire[i]; }
    let fb=0, fx=0, fz=0; for(const f of fixtures){ if(!FIRE_TYPES.has(f.type)||f.type==='lava'||f.type==='abyss')continue; const d=Math.hypot(f.x-player.x,f.z-player.z), v=Math.max(0,1-d/7); if(v>fb){fb=v;fx=f.x;fz=f.z;} }
    const ri=D.roomOf[pcz*MW+pcx];
    let fallN=0; for(const f of fixtures){ if(f.type==='fall')fallN=Math.max(fallN,1-Math.hypot(f.x-player.x,f.z-player.z)/16); }
    Object.assign(E,{fall:fallN,water:Math.min(1,water/12),lava:Math.min(1,lava/8),chasm:Math.min(1,chasm/10),bog:Math.min(1,bog/10),xtal:Math.min(1,xtal/8),burn:Math.min(1,burn/6),fire:fb,fx,fz,cave:ri>=0&&D.rooms[ri].cave});
    const now=SND.ctx.currentTime, set=(g,v)=>g.gain.setTargetAtTime(v,now,0.6);
    set(SND.L.rumble.g,0.05+E.chasm*0.45+E.lava*0.3+(E.cave?0.04:0));
    set(SND.L.water.g,E.water*0.05+E.fall*0.22);
    set(SND.L.fire.g,Math.min(0.3,E.burn*0.25+E.fire*0.03));
    set(SND.L.wind.g,E.cave?0.025:0.008);
    set(SND.L.drone.g,0.03);
    SND.L.drone.o[0].frequency.setTargetAtTime(55*Math.pow(0.97,depth-1),now,2); SND.L.drone.o[1].frequency.setTargetAtTime(82.6*Math.pow(0.97,depth-1),now,2);
    SND.wet.gain.setTargetAtTime(E.cave?0.6:0.32,now,1);
  }
  const roll=r=>Math.random()<r*dt;
  if(roll(0.25+E.water*2.4+(E.cave?0.4:0))){ const a=Math.random()*6.28, r=2+Math.random()*9; sDrip(player.x+Math.cos(a)*r,player.z+Math.sin(a)*r,0.2+Math.random()*0.15); }
  if(roll(E.fire*14+E.burn*30))sCrackle(E.burn>E.fire?undefined:E.fx,E.burn>E.fire?undefined:E.fz,0.25+Math.random()*0.25);
  if(roll(E.bog*2.5))sBubble(undefined,undefined,0.2,false);
  if(roll(E.lava*2))sBubble(undefined,undefined,0.3,true);
  if(roll(E.xtal*0.8))sChime(undefined,undefined,0.12);
  for(const m of monsters){ if(m.ty.flier&&Math.hypot(m.x-player.x,m.z-player.z)<10&&roll(0.35))sSqueak(m.x,m.z); }
}

// ---------------------------------------------------------------- swamp gas
let gasTmp=new Float32Array(NCELL), gasAny=false;
// ---------------------------------------------------------------- fire (after Brogue: spreads through flammable terrain, ignites gas)
let fire=new Float32Array(NCELL), fuel=new Float32Array(NCELL), burnt=new Uint8Array(NCELL), cellFlag=new Uint8Array(NCELL), fireLight=new Float32Array(NCELL);
let burning=[], fireSrc=[], flash=0, shake=0, lastBoom=-10, events=[], spark=null, sparkCD=0;
const FIRE_TYPES=new Set(['brazier','torch','lava','embers','abyss']);
function initFire(){
  fire=new Float32Array(NCELL); fuel=new Float32Array(NCELL); burnt=new Uint8Array(NCELL); cellFlag=new Uint8Array(NCELL); fireLight=new Float32Array(NCELL); burning=[];
  for(let i=0;i<NCELL;i++){ const sf=D.surface[i]; fuel[i]=sf===SF_DEAD?1.0:sf===SF_GRASS?0.7:sf===SF_LUMEN?0.6:sf===SF_FOLIAGE?1.0:sf===SF_HAY?1.2:sf===SF_BRIM?0.8:0; }
  for(const d of D.doors)fuel[d.i]=Math.max(fuel[d.i],1.4);
  D.webAt=new Map(); for(const w of (D.webs||[])){ fuel[w.i]=Math.max(fuel[w.i],0.9); D.webAt.set(w.i,w); }
  for(const r of D.rooms){ if(r.theme&&r.theme.k==='ashfield')for(const i of r.cells)if(!D.liquid[i])burnt[i]=1; }
  for(const r of D.rooms){ const md=r.mdata; if(!md)continue; for(const i of (md.ash||[]))burnt[i]=1; for(const i of (md.char||[]))burnt[i]=1; }
  for(const [i,dc] of D.decoCell)if(dc.ch==='['||dc.ch==='='||dc.k==='carpet')fuel[i]=Math.max(fuel[i],1.5);
  fireSrc=D.fixtures.filter(f=>FIRE_TYPES.has(f.type)).map(f=>Math.floor(f.z/CELL)*MW+Math.floor(f.x/CELL));
  uploadCells();
}
function ignite(i,strength,gasBurn){
  if(i<0||i>=NCELL||D.tile[i]===TW)return;
  if(fire[i]<=0){ fire[i]=strength; burning.push(i); }
  else fire[i]=Math.max(fire[i],strength);
  if(gasBurn){ fuel[i]=Math.max(fuel[i],0.25); D.gas[i]=0; }
}
function boom(i){
  const x=(i%MW+0.5)*CELL, z=(((i/MW)|0)+0.5)*CELL, dd=Math.hypot(x-player.x,z-player.z);
  if(time-(boom.last||-9)>0.35){ boom.last=time; sBoom(clamp(1-dd/34,0.05,1)); makeNoise(x,z,20,1.3); }
  if(dd<30){ for(let q=0;q<10;q++){ const a=mr()*6.28, e2=mr(); spawn(x,0.6+mr(),z,Math.cos(a)*3*e2,0.5+mr()*2.5,Math.sin(a)*3*e2,0.6+mr()*0.6,G(mpick(['*','#','^','%'])),0.3+mr()*0.2,3.2,1.6,0.5,0); } }
  flash=Math.max(flash,clamp(1-dd/26,0,1)); shake=Math.max(shake,clamp(1-dd/22,0,1)*0.6);
  if(dd<3.6)hurtPlayer(Math.round(12*(1-dd/3.6))+2,'爆発');
  for(const m of monsters){ if(m.dead||m.ty.critter)continue; const dm=Math.hypot(m.x-x,m.z-z); if(dm<3.6)damageMonster(m,Math.round(16*(1-dm/3.6))+3,'fire'); }
  if(time-lastBoom>3&&dd<34){ lastBoom=time; msg('<b style="color:#ffb347">*</b>沼のガスに火が回り、轟音とともに爆ぜた！'); }
}
function stepFire(){
  const g=D.gas;
  // open flames (braziers, torches, lava) ignite gas that drifts into them
  for(const s0 of fireSrc){ for(const j of [s0,s0+1,s0-1,s0+MW,s0-MW]){ if(j>=0&&j<NCELL&&g[j]>0.15){ ignite(j,1,true); boom(j); } } }
  const next=[];
  for(const i of burning){
    if(fire[i]<=0)continue;
    if(fuel[i]>0){ fuel[i]-=0.05*fire[i]; fire[i]=Math.min(1,fire[i]+0.15); }
    else fire[i]*=0.6;
    const x=i%MW;
    for(const j of [i+1,i-1,i+MW,i-MW]){
      if(j<0||j>=NCELL||(j===i+1&&x===MW-1)||(j===i-1&&x===0))continue;
      if(g[j]>0.1){ ignite(j,1,true); boom(j); continue; }
      if(fire[j]<=0&&fuel[j]>0&&mr()<0.22*fire[i]*(D.surface[j]===SF_DEAD?1.4:1))ignite(j,0.25,false);
      const lq=D.liquid[j]; if((lq===LQ_WATER||lq===LQ_DEEP)&&fire[i]>0.5&&mr()<0.15){ const sx=(j%MW+0.5)*CELL, sz=(((j/MW)|0)+0.5)*CELL; for(let q=0;q<3;q++)spawn(sx+(mr()-0.5),0.2,sz+(mr()-0.5),(mr()-0.5)*0.3,0.6+mr()*0.6,(mr()-0.5)*0.3,2.5,G(mpick(['~','.','\''])),0.35,0.35,0.36,0.4,1); }
    }
    if(fire[i]<0.04){ fire[i]=0; burnt[i]=1; fuel[i]=0; if(D.surface[i]!==SF_OBSIDIAN)D.surface[i]=0; const di=D.doorAt[i]; if(di>=0)D.doors[di].gone=true; }
    else next.push(i);
  }
  for(const i of burning)if(fire[i]>0&&!next.includes(i))next.push(i);
  burning=next;
  // blurred firelight for the shader and for CPU-side lighting
  fireLight.fill(0);
  for(const i of burning){ const f=fire[i], x=i%MW;
    for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){ if(x+dx<0||x+dx>=MW)continue; const j=i+dx+dz*MW; if(j<0||j>=NCELL)continue; const w=f*Math.max(0,1-Math.hypot(dx,dz)/2.6); fireLight[j]+=w; } }
  uploadCells();
}
function uploadCells(){
  for(let i=0;i<NCELL;i++){ const o=i*4; cellData[o]=Math.min(255,fireLight[i]*150); cellData[o+1]=Math.min(255,fire[i]*255); cellData[o+2]=burnt[i]?255:0; cellData[o+3]=cellFlag[i]; }
  cellTex.needsUpdate=true;
}
function drawFire(t,dt){
  for(const i of burning){
    const f=fire[i]; if(f<=0)continue;
    const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL; if(Math.hypot(x0-player.x,z0-player.z)>34)continue;
    let h=Math.sin(i*12.9898)*43758.5453; h-=Math.floor(h);
    for(let k=0;k<5;k++){
      const q=(t*(1.8+h)+k/5+h)%1, ox=Math.sin(k*2.3+h*9)*0.6, oz=Math.cos(k*1.7+h*7)*0.6, b=2.8*(1-q)*f;
      dyn(x0+ox,0.12+q*1.3*f,z0+oz,G(k%3===0?'^':k%3===1?'*':'\''),0.5*(1-q*0.6)*(0.5+f*0.5),b*1.0,b*0.45*(1-q),b*0.12*(1-q)*(1-q));
    }
    if(mr()<dt*6*f)spawn(x0+(mr()-0.5)*1.4,0.3,z0+(mr()-0.5)*1.4,(mr()-0.5)*0.4,0.9+mr()*1.2,(mr()-0.5)*0.4,1.2+mr()*1.6,G(mpick(['.','\'','*'])),0.1,2.8,1.4,0.5,0);
  }
  if(spark)dyn(spark.x,spark.y,spark.z,G('*'),0.32,3.4,2.2,0.9);
}
let sparks=3, sparkRegen=0; const SPARK_MAX=3;
function updateSparkHud(){ renderStatus(); }
function throwSpark(){
  if(sparks<=0){ showHint('火花を使い切った。少し待てば、また溜まる'); sparkCD=0.6; return; }
  sparks--; sparkRegen=0; updateSparkHud(); sWhoosh();
  const cp=Math.cos(player.pitch), dx=-Math.sin(player.yaw)*cp, dy=Math.sin(player.pitch), dz=-Math.cos(player.yaw)*cp;
  spark={x:camera.position.x+dx*0.4,y:camera.position.y-0.15+dy*0.4,z:camera.position.z+dz*0.4,vx:dx*13,vy:dy*13+2.2,vz:dz*13,t:0};
  sparkCD=0.6;
}
function updateSpark(dt){
  if(!spark)return;
  const s2=spark; s2.t+=dt; s2.vy-=9.8*dt;
  const nx=s2.x+s2.vx*dt, ny=s2.y+s2.vy*dt, nz=s2.z+s2.vz*dt;
  const cx=Math.floor(nx/CELL), cz=Math.floor(nz/CELL), i=cz*MW+cx;
  if(mr()<0.8)spawn(s2.x,s2.y,s2.z,(mr()-0.5)*0.4,(mr()-0.5)*0.4,(mr()-0.5)*0.4,0.5+mr()*0.4,G(mpick(['.','\''])),0.08,2.6,1.5,0.5,0);
  let hit=-1;
  if(cx<0||cz<0||cx>=MW||cz>=MH||s2.t>4){ spark=null; return; }
  if(D.tile[i]===TW||D.tile[i]===TX)hit=Math.floor(s2.z/CELL)*MW+Math.floor(s2.x/CELL);
  else if(ny<0.03&&D.tile[i]!==TC)hit=i;
  else if(ny>D.ceil[i])hit=i;
  if(hit<0){ s2.x=nx; s2.y=ny; s2.z=nz; return; }
  for(let q=0;q<12;q++){ const a=mr()*6.28; spawn(s2.x,Math.max(0.05,s2.y),s2.z,Math.cos(a)*1.2,0.4+mr()*1.2,Math.sin(a)*1.2,0.5+mr()*0.5,G(mpick(['*','.','\''])),0.12,3,1.6,0.5,0); }
  let lit=false;
  for(const j of [hit,hit+1,hit-1,hit+MW,hit-MW]){ if(j<0||j>=NCELL)continue; if(D.gas[j]>0.1){ ignite(j,1,true); boom(j); lit=true; } else if(fuel[j]>0&&j===hit){ ignite(j,0.6,false); lit=true; } }
  makeNoise(s2.x,s2.z,6,0.45);
  if(lit)sCrackleBurst(s2.x,s2.z);
  if(lit&&burning.length<4)msg('<b style="color:#ffb347">^</b>火花が燃え移り、炎が広がり始めた。');
  spark=null;
}
function initEvents(){
  events=[];
  D.collapsed=false; D.pit=new Uint8Array(NCELL);
  D.rooms.forEach((r,ri)=>{
    if(r.vault&&r.vault.k==='oracle'&&r.valtar&&r.valtar.length)events.push({type:'oracle',cell:r.valtar[0],done:false});
    if(ri===0){ for(const tp of (D.teles||[]))events.push({type:'tele',a:tp.a,b:tp.b,lock:-1}); for(const e of (D.erupts||[]))events.push({type:'erupt',src:e.src,order:e.order,state:0,t:8+mr()*14,k:0}); }
    const md=r.mdata; if(!md)return;
    if(md.type==='statues')for(const c of (md.awaken||[]))events.push({type:'statue',cell:c,done:false,active:false,t:0});
    if(md.type==='collapse')events.push({type:'collapse',cells:md.pit,ri,state:0,t:0});
    if((md.type==='flood'||md.type==='lavaflow')&&md.order)events.push({type:md.type,ri,order:md.order.slice(),src:md.src,state:0,t:0,k:0,max:md.order.length*3});
    if(md.type==='crypt'&&md.tombs.length)events.push({type:'haunt',ri,tombs:md.tombs.map(tb=>tb.i),done:false,t:-1});
  });
}
const cpos=i=>[(i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL];
function summon(key,cell){ const m=makeMonster({key,cx:cell%MW,cz:(cell/MW)|0,g:-1,lead:true}); m.alert=1; m.seen=true; monsters.push(m); return m; }
function updateEvents(dt,t){
  const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL);
  for(const ev of events){
    if(ev.type==='statue'){
      const [sx,sz]=cpos(ev.cell);
      if(!ev.done&&Math.hypot(sx-player.x,sz-player.z)<3.6){
        ev.done=true; ev.active=true; ev.t=0; sRumble(0.35,1.2); cellFlag[ev.cell]=100; D.solid.delete(ev.cell); D.decoCell.delete(ev.cell); uploadCells();
        for(let q=0;q<70;q++){ const a=mr()*6.28, h=mr()*2.4; spawn(sx+Math.cos(a)*0.3,0.4+h,sz+Math.sin(a)*0.3,Math.cos(a)*1.6,0.4+mr(),Math.sin(a)*1.6,1.1+mr()*0.4,G(mpick(['&','#','%','&'])),0.2,0.8,0.78,1.0,1); }
        shake=Math.max(shake,0.25);
      }
      if(ev.active){
        ev.t+=dt;
        if(mr()<dt*40){ const a=mr()*6.28, r=1.6*(1-ev.t/1.3); spawn(sx+Math.cos(a)*r,0.3+mr()*2,sz+Math.sin(a)*r,-Math.cos(a)*1.4,0,-Math.sin(a)*1.4,0.4,G(mpick(['&','#','%'])),0.18,1,0.95,1.2,1); }
        if(ev.t>1.3&&!ev.chimed){ ev.chimed=true; sChime(sx,sz,0.3); }
        if(ev.t>1.3){ ev.active=false; const key=depth>=5?'O':depth>=3?'g':'k'; const m=summon(key,ev.cell);
          msg(`<b style="color:${css(m.ty.col)}">&</b>彫像が崩れ、${mname(m)}の姿へと組み直された！`); }
      }
    } else if(ev.type==='collapse'){
      if(ev.state===0){
        if(D.roomOf[pc]===ev.ri&&ev.cells.some(c=>{ const [x,z]=cpos(c); return Math.hypot(x-player.x,z-player.z)<4.4; })){ ev.state=1; ev.t=0; sRumble(0.45,1.6); msg('<b style="color:#ffa060">:</b>足元で低い地鳴りが響く。床のひび割れが広がっていく……'); }
      } else if(ev.state===1){
        ev.t+=dt; shake=Math.max(shake,0.18+ev.t*0.15);
        if(mr()<dt*30){ const c=ev.cells[Math.floor(mr()*ev.cells.length)], [x,z]=cpos(c); spawn(x+(mr()-0.5)*1.8,D.ceil[c]-0.1,z+(mr()-0.5)*1.8,0,-1.5,0,1.5,G(mpick(['.',',','\''])),0.12,0.4,0.38,0.45,1); }
        if(ev.t>1.4){
          ev.state=2; D.collapsed=true; sBoom(0.7); makeNoise(player.x,player.z,22,1.2); U.uCollT.value=t;
          for(const c of ev.cells){ cellFlag[c]=200; D.tile[c]=TC; D.pit[c]=1; const [x,z]=cpos(c);
            for(let q=0;q<10;q++)spawn(x+(mr()-0.5)*1.8,0.1,z+(mr()-0.5)*1.8,(mr()-0.5)*0.6,-0.5-mr()*2,(mr()-0.5)*0.6,1.6,G(mpick(['.','#',':','%'])),0.2,0.6,0.55,0.6,1); }
          for(const m of monsters){ if(D.pit[m.cz*MW+m.cx]&&!m.ty.flier){ m.dead=true; } }
          uploadCells(); shake=0.8;
          msg('<b style="color:#ffa060">:</b>轟音とともに床が崩れ落ちた！ 穴の底に、下の階層の光が見える。');
        }
      }
    } else if(ev.type==='oracle'){
      if(ev.done)continue; const [ox2,oz2]=cpos(ev.cell);
      if(Math.hypot(ox2-player.x,oz2-player.z)<3.4){ ev.done=true; const ru=HIST.rulers[Math.floor(mr()*HIST.rulers.length)];
        const hp=[`${ru.title}${ru.name}の名を口にする者は、もういない。`,`${HIST.civ.name}の民が最後に見たものを、お前もやがて見るだろう。`,`${HIST.beast}は、まだどこかで眠っている。`];
        const a=[hp[Math.floor(mr()*hp.length)],PROPHECIES[Math.floor(mr()*PROPHECIES.length)]];
        sChime(ox2,oz2,0.4); setTimeout(()=>sChime(ox2,oz2,0.3),500);
        msg('<b style="color:#bfe4ff">?</b>巻物の文字がひとりでに光り、声なき声が告げる──'); msg(`<b style="color:#bfe4ff">「</b>${a[0]}」`); msg(`<b style="color:#bfe4ff">「</b>${a[1]}」`); oracleLegendHints();
        for(let q=0;q<50;q++){ const an=mr()*6.28; spawn(ox2+Math.cos(an)*0.3,1.2+mr(),oz2+Math.sin(an)*0.3,Math.cos(an)*0.7,0.4+mr()*0.8,Math.sin(an)*0.7,2.5+mr()*2,G(mpick(['?','*','.','+'])),0.14,1.0,1.6,2.2,2); } }
    } else if(ev.type==='flood'||ev.type==='lavaflow'){
      const lava=ev.type==='lavaflow';
      if(ev.state===0){
        if(D.roomOf[pc]===ev.ri){ ev.state=1; ev.t=0;
          const f=fixtures.find(f=>f.type===(lava?'crater':'spring')&&Math.floor(f.z/CELL)*MW+Math.floor(f.x/CELL)===ev.src); if(f){ f.active=true; const L=D.lights[f.li]; if(L)L.active=true; }
          if(lava){ sRumble(0.5,2); shake=Math.max(shake,0.3); msg('<b style="color:#ff7a3a">^</b>床の裂け目が割れ、溶岩がゆっくりとあふれ出した！'); }
          else { sSplash(0.4); msg('<b style="color:#6ab4ff">~</b>壁の亀裂が崩れ、水が勢いよく噴き出した！'); } }
      } else if(ev.state===1){
        ev.t+=dt; const step=lava?0.38:0.11; let changed=false;
        while(ev.t>=step&&ev.k<ev.order.length&&ev.k<ev.max){ ev.t-=step; const i=ev.order[ev.k++]; const [x,z]=cpos(i);
          if(lava&&(Math.hypot(x-player.x,z-player.z)<1.6||monsters.some(m=>!m.ty.flier&&m.cz*MW+m.cx===i))){ ev.order.push(i); continue; }
          changed=true;
          if(lava){ D.liquid[i]=LQ_LAVA; cellFlag[i]=70; for(const j of [i+1,i-1,i+MW,i-MW])if(j>=0&&j<NCELL&&fuel[j]>0)ignite(j,0.6,false); if(D.gas[i]>0.1)boom(i); if(mr()<0.3)sBubble(x,z,0.25,true); }
          else { D.liquid[i]=LQ_WATER; cellFlag[i]=50; fire[i]=0; fuel[i]=0; if(mr()<0.2)sSplash(0.12); } }
        if(changed)uploadCells();
        if(ev.k>=ev.order.length||ev.k>=ev.max)ev.state=2;
      }
    } else if(ev.type==='tele'){
      const [ax,az]=cpos(ev.a), [bx,bz]=cpos(ev.b), da=Math.hypot(player.x-ax,player.z-az), db=Math.hypot(player.x-bx,player.z-bz);
      if(ev.lock>=0){ const [lx,lz]=cpos(ev.lock); if(Math.hypot(player.x-lx,player.z-lz)>1.3)ev.lock=-1; }
      const from=da<0.7&&ev.lock!==ev.a?ev.a:db<0.7&&ev.lock!==ev.b?ev.b:-1;
      if(from>=0&&!trans){ const to=from===ev.a?ev.b:ev.a, [tx2,tz2]=cpos(to), [fx2,fz2]=cpos(from);
        for(const [px3,pz3] of [[fx2,fz2],[tx2,tz2]])for(let q=0;q<40;q++){ const an=mr()*6.28; spawn(px3+Math.cos(an)*0.5,0.2+mr()*2,pz3+Math.sin(an)*0.5,Math.cos(an)*0.8,mr()*1.2,Math.sin(an)*0.8,1.2+mr(),G(mpick(['*','+','.','o'])),0.16,1.0,0.6,1.6,2); }
        player.x=tx2; player.z=tz2; player.vx=player.vz=0; ev.lock=to; sChime(tx2,tz2,0.5);
        if(!D.teleMsg){ D.teleMsg=true; msg('<b style="color:#ff7ae0">*</b>魔法陣が閃き、体が別の場所へと運ばれた。対になった陣が、どこかにもうひとつある。'); } }
    } else if(ev.type==='erupt'){
      ev.t-=dt; const f=fixtures.find(f=>f.type==='crater'&&Math.floor(f.z/CELL)*MW+Math.floor(f.x/CELL)===ev.src);
      if(ev.state===0&&ev.t<=0){ ev.state=1; ev.k=0; ev.t=0; if(f){ f.active=true; const L=D.lights[f.li]; if(L)L.active=true; }
        const [sx,sz]=cpos(ev.src), dd=Math.hypot(sx-player.x,sz-player.z); if(dd<30){ sRumble(0.6*(1-dd/30)+0.15,2.2); shake=Math.max(shake,0.5*(1-dd/30)); }
        if(dd<24&&fovVis[ev.src]===fovStamp)msg('<b style="color:#ff7a3a">^</b>火口が轟音とともに噴き上がり、溶岩があふれ出した！');
        for(let q=0;q<70;q++){ const an=mr()*6.28, sp2=1+mr()*2.4; spawn(sx,0.4,sz,Math.cos(an)*sp2*0.5,3+mr()*4,Math.sin(an)*sp2*0.5,1.4+mr(),G(mpick(['*','o','\'','.'])),0.18,2.4,1.1,0.3,0); } }
      else if(ev.state===1){ ev.t+=dt; let ch=false;
        while(ev.t>=0.3&&ev.k<ev.order.length){ ev.t-=0.3; const i=ev.order[ev.k++], [x,z]=cpos(i);
          if(Math.hypot(x-player.x,z-player.z)<1.6||monsters.some(m=>!m.ty.flier&&m.cz*MW+m.cx===i))continue;
          D.liquid[i]=LQ_LAVA; cellFlag[i]=70; ch=true; for(const j of [i+1,i-1,i+MW,i-MW])if(j>=0&&j<NCELL&&fuel[j]>0)ignite(j,0.6,false); }
        if(ch)uploadCells(); if(ev.k>=ev.order.length){ ev.state=2; ev.t=12; } }
      else if(ev.state===2&&ev.t<=0){ ev.state=3; ev.k=ev.order.length-1; ev.t=0; if(f){ f.active=false; const L=D.lights[f.li]; if(L)L.active=false; } }
      else if(ev.state===3){ ev.t+=dt; let ch=false;
        while(ev.t>=0.15&&ev.k>=0){ ev.t-=0.15; const i=ev.order[ev.k--]; if(cellFlag[i]===70){ D.liquid[i]=0; cellFlag[i]=0; ch=true; const [x,z]=cpos(i); if(mr()<0.4)spawn(x,0.2,z,0,0.5,0,2,G('.'),0.4,0.15,0.13,0.13,1); } }
        if(ch)uploadCells(); if(ev.k<0){ ev.state=0; ev.t=20+mr()*20; } }
    } else if(ev.type==='haunt'){
      if(ev.done)continue;
      if(ev.t<0&&D.roomOf[pc]===ev.ri)ev.t=0;
      if(ev.t>=0){
        ev.t+=dt;
        for(const c of ev.tombs.slice(0,2)){ const [x,z]=cpos(c); if(mr()<dt*25){ const a=mr()*6.28, r=1.4*(1-Math.min(1,ev.t/2)); spawn(x+Math.cos(a)*r,0.2+mr()*1.8,z+Math.sin(a)*r,-Math.cos(a)*0.6,0.1,-Math.sin(a)*0.6,0.6,G(mpick(['~','W','\''])),0.2,0.5,0.4,0.9,1); } }
        if(ev.t>2&&!ev.chimed){ ev.chimed=true; sChime(...cpos(ev.tombs[0]),0.3); }
        if(ev.t>2){ ev.done=true; const ms=ev.tombs.slice(0,2).map(c=>{ const nb=[c+1,c-1,c+MW,c-MW].find(j=>canStep({ty:{form:''}},j)); return summon('W',nb!==undefined?nb:c); });
          msg(`<b style="color:${css(ms[0].ty.col)}">W</b>墓石の間から、${mname(ms[0])}がゆらりと立ち上がった……`); }
      }
    }
  }
}

function stepGas(){
  const g=D.gas, nb=gasTmp, tile=D.tile; let any=false;
  for(let i=0;i<NCELL;i++){
    if(tile[i]===TW){ nb[i]=0; continue; }
    const v=g[i], x=i%MW; let s=0,c=0;
    if(x>0&&tile[i-1]!==TW){s+=g[i-1];c++;} if(x<MW-1&&tile[i+1]!==TW){s+=g[i+1];c++;}
    if(i>=MW&&tile[i-MW]!==TW){s+=g[i-MW];c++;} if(i<NCELL-MW&&tile[i+MW]!==TW){s+=g[i+MW];c++;}
    let nv=(c?v*0.6+(s/c)*0.4:v)*0.993; if(nv<0.005)nv=0; nb[i]=nv; if(nv>0)any=true;
  }
  g.set(nb);
  for(const i of D.bogList){
    if(mr()>0.012)continue;
    g[i]=Math.min(1,g[i]+0.8); any=true;
    const x=(i%MW+0.3+mr()*0.4)*CELL, z=(((i/MW)|0)+0.3+mr()*0.4)*CELL;
    if(Math.hypot(x-player.x,z-player.z)<26){
      for(let k=0;k<7;k++){ const a=k/7*Math.PI*2; spawn(x+Math.cos(a)*0.08,0.08,z+Math.sin(a)*0.08,Math.cos(a)*0.4,0.02,Math.sin(a)*0.4,0.9,G('o'),0.13,0.4,0.48,0.16,1); }
      spawn(x,0.15,z,0,0.35,0,2.2,G('~'),0.3,0.35,0.6,0.12,1);
      sBubble(x,z,0.3,false);
    }
  }
  gasAny=any;
}
function updateGasPoints(t){
  let gi=0;
  if(gasAny){
    const pcx=Math.floor(player.x/CELL), pcz=Math.floor(player.z/CELL), RR=12, g=D.gas;
    for(let cz=Math.max(0,pcz-RR);cz<=Math.min(MH-1,pcz+RR)&&gi<GAS_N;cz++)for(let cx=Math.max(0,pcx-RR);cx<=Math.min(MW-1,pcx+RR)&&gi<GAS_N;cx++){
      const i=cz*MW+cx, v=g[i]; if(v<0.04)continue;
      const l=cellLight((cx+0.5)*CELL,(cz+0.5)*CELL), n=v>0.35?3:v>0.15?2:1;
      for(let s=0;s<n&&gi<GAS_N;s++){
        let h1=Math.sin(i*12.9898+s*78.233)*43758.5453; h1-=Math.floor(h1); let h2=Math.sin(i*39.3468+s*11.135)*24634.6345; h2-=Math.floor(h2);
        const k=Math.min(1,v)*(0.6+0.4*Math.sin(t*1.3+h1*20)), j=DUST_N+gi, j3=j*3;
        ptPos[j3]=(cx+((h1+t*0.02*(1+s))%1))*CELL; ptPos[j3+1]=0.25+((h1*3.7+t*0.05)%1)*1.6; ptPos[j3+2]=(cz+((h2+t*0.017*(1+s))%1))*CELL;
        ptCol[j3]=(0.05+l[0]*0.15)*k; ptCol[j3+1]=(0.09+l[1]*0.15)*k; ptCol[j3+2]=(0.02+l[2]*0.1)*k;
        ptSize[j]=0.45+h2*0.35; ptGly[j]=G(h1<0.5?'~':(h1<0.8?'.':':'));
        gi++;
      }
    }
  }
  for(let k=gi;k<GAS_N;k++)ptSize[DUST_N+k]=0;
}

// ---------------------------------------------------------------- particle update
function respawnDust(i,near){
  for(let tries=0;tries<8;tries++){
    const a=mr()*Math.PI*2, r=near?Math.sqrt(mr())*15:10+mr()*5;
    const x=player.x+Math.cos(a)*r, z=player.z+Math.sin(a)*r, cx=Math.floor(x/CELL), cz=Math.floor(z/CELL);
    if(cx<0||cz<0||cx>=MW||cz>=MH)continue;
    const ci=cz*MW+cx, tt=D.tile[ci]; if(tt!==TF&&tt!==TC)continue;
    const lo=tt===TC?-CH_D+1:0.15, hi=Math.min(D.ceil[ci]-0.2,8);
    dust.x[i]=x; dust.z[i]=z; dust.y[i]=lo+mr()*(hi-lo); return;
  }
  dust.x[i]=player.x; dust.z[i]=player.z; dust.y[i]=-50;
}
function initDust(){ const fl=D.stratum.fall; for(let i=0;i<DUST_N;i++){ dust.ph[i]=mr()*100; dust.g[i]=G(mpick(fl==='snow'?['*','.','+','*']:fl==='ash'?[',','.','`','\'']:['.','.','.','+','*','\'',':','`'])); dust.s[i]=0.1+mr()*0.11; respawnDust(i,true); } }
let riverCells=[];
function riverFX(dt){
  if(!riverCells.length)return;
  for(let k=0;k<6&&mr()<dt*14;k++){
    const i=riverCells[Math.floor(mr()*riverCells.length)], x=(i%MW+0.2+mr()*0.6)*CELL, z=(((i/MW)|0)+0.2+mr()*0.6)*CELL;
    if(Math.hypot(x-player.x,z-player.z)>18)continue;
    const a=D.flow[i]-10; spawn(x,0.12,z,Math.cos(a)*1.3,0.01,Math.sin(a)*1.3,2.2+mr(),G(mpick(['~','.','-'])),0.13,0.25,0.55,0.75,1);
  }
}
function updateParticles(dt,t){
  riverFX(dt);
  const px=player.x, pz=player.z;
  for(let i=0;i<DUST_N;i++){
    const ph=dust.ph[i];
    dust.x[i]+=Math.sin(t*0.31+ph)*0.13*dt; dust.z[i]+=Math.cos(t*0.27+ph*1.3)*0.13*dt; dust.y[i]+=(Math.sin(t*0.21+ph*2)*0.06+0.015)*dt;
    const dx=dust.x[i]-px, dz=dust.z[i]-pz;
    if(D.stratum.fall){ dust.y[i]-=(D.stratum.fall==='snow'?0.45:0.3)*dt; dust.x[i]+=Math.sin(t*0.7+ph)*0.2*dt; }
    if(dx*dx+dz*dz>16*16||dust.y[i]>ceilAt(dust.x[i],dust.z[i])-0.05||(D.stratum.fall&&dust.y[i]<0.05))respawnDust(i,false);
    const l=cellLight(dust.x[i],dust.z[i]);
    const dd=Math.hypot(dust.x[i]-px,dust.y[i]-EYE,dust.z[i]-pz), lan=Math.max(0,1-dd/7);
    const tw=0.5+0.5*Math.sin(t*(0.7+(ph%1)*1.3)+ph*9), k=(0.2+0.8*tw);
    const i3=i*3;
    ptPos[i3]=dust.x[i]; ptPos[i3+1]=dust.y[i]; ptPos[i3+2]=dust.z[i];
    ptCol[i3]=(0.012+l[0]*0.2+lan*lan*0.09)*k; ptCol[i3+1]=(0.01+l[1]*0.2+lan*lan*0.085)*k; ptCol[i3+2]=(0.026+l[2]*0.2+lan*lan*0.13)*k;
    ptSize[i]=dust.s[i]; ptGly[i]=dust.g[i];
  }
  for(let i=0;i<pN;){
    P.age[i]+=dt; if(P.age[i]>=P.life[i]){ killP(i); continue; }
    const ph=P.ph[i], ty=P.ty[i];
    P.vx[i]+=Math.sin(t*1.7+ph)*0.35*dt; P.vz[i]+=Math.cos(t*1.3+ph*1.3)*0.35*dt;
    if(ty===0)P.vy[i]+=0.2*dt;
    const drag=1-0.5*dt; P.vx[i]*=drag; P.vz[i]*=drag; P.vy[i]*=1-0.15*dt;
    P.x[i]+=P.vx[i]*dt; P.y[i]+=P.vy[i]*dt; P.z[i]+=P.vz[i]*dt;
    const a=P.age[i]/P.life[i]; let k=Math.min(1,P.age[i]*5)*(1-a);
    if(ty===1)k*=0.6+0.4*Math.sin(t*4+ph);
    const j=P0+i, j3=j*3;
    ptPos[j3]=P.x[i]; ptPos[j3+1]=P.y[i]; ptPos[j3+2]=P.z[i];
    if(ty===0){ ptCol[j3]=P.r[i]*k; ptCol[j3+1]=P.g[i]*Math.pow(k,1.7); ptCol[j3+2]=P.b[i]*Math.pow(k,2.4); }
    else { ptCol[j3]=P.r[i]*k; ptCol[j3+1]=P.g[i]*k; ptCol[j3+2]=P.b[i]*k; }
    ptSize[j]=P.sz[i]; ptGly[j]=P.gl[i];
    i++;
  }
  updateGasPoints(t);
  const total=P0+pN;
  ptGeo.setDrawRange(0,total);
  for(const [a,s] of [[bpPos,3],[bpCol,3],[bpSize,1],[bpGly,1]]){ a.updateRange.offset=0; a.updateRange.count=total*s; a.needsUpdate=true; }
}

// ---------------------------------------------------------------- field of view & minimap
function computeFOV(){
  fovStamp++;
  const ox=player.x/CELL, oz=player.z/CELL, pcF=Math.floor(oz)*MW+Math.floor(ox);
  for(let k=0;k<300;k++){
    const a=k/300*Math.PI*2, dx=Math.cos(a), dz=Math.sin(a);
    for(let s=0;s<18;s+=0.25){
      const x=ox+dx*s, z=oz+dz*s, cx=Math.floor(x), cz=Math.floor(z);
      if(cx<0||cz<0||cx>=MW||cz>=MH)break;
      const i=cz*MW+cx; fovVis[i]=fovStamp; explored[i]=1;
      const tt=D.tile[i]; if(tt===TW)break;
      if(s>0.9&&i!==pcF&&tallAt(i))break;
      if(tt===TP&&Math.hypot(x-cx-0.5,z-cz-0.5)<0.28)break;
      const di=D.doorAt[i]; if(di>=0&&!D.doors[di].gone&&D.doors[di].o<0.35&&s>0.3)break;
    }
  }
}
const mapC=document.getElementById('map'), mctx=mapC.getContext('2d');
const MMC=45, MMR=27, MCW=8, MCH=13, MPAD=11;
function sizeMap(){ const dpr=Math.min(2,window.devicePixelRatio||1); mapC.width=Math.round((MMC*MCW+MPAD*2)*dpr); mapC.height=Math.round((MMR*MCH+MPAD*2)*dpr); mctx.setTransform(dpr,0,0,dpr,0,0); }
sizeMap();
const tone=v=>Math.round(255*(1-Math.exp(-v*1.7)));
function drawMap(){
  const Wd=MMC*MCW+MPAD*2, Hd=MMR*MCH+MPAD*2;
  mctx.clearRect(0,0,Wd,Hd);
  mctx.fillStyle='rgba(3,2,10,0.6)'; mctx.fillRect(4,5,Wd-8,Hd-10);
  mctx.font='400 10px "JetBrains Mono",Menlo,Consolas,monospace'; mctx.textAlign='center'; mctx.textBaseline='middle'; mctx.fillStyle='rgba(120,108,200,0.6)';
  for(let x=11;x<Wd-8;x+=7){ mctx.fillText('-',x,5); mctx.fillText('-',x,Hd-5); }
  for(let y=14;y<Hd-9;y+=9){ mctx.fillText('|',4,y); mctx.fillText('|',Wd-4,y); }
  for(const [x,y] of [[4,5],[Wd-4,5],[4,Hd-5],[Wd-4,Hd-5]])mctx.fillText('+',x,y);
  const pcx=player.x/CELL, pcz=player.z/CELL;
  const ox=clamp(Math.floor(pcx)-(MMC>>1),0,MW-MMC), oy=clamp(Math.floor(pcz)-(MMR>>1),0,MH-MMR);
  const px=MPAD+(pcx-ox)*MCW, py=MPAD+(pcz-oy)*MCH;
  const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw), ang=Math.atan2(fz*MCH,fx*MCW);
  const grad=mctx.createRadialGradient(px,py,3,px,py,120);
  grad.addColorStop(0,'rgba(150,205,255,0.22)'); grad.addColorStop(1,'rgba(150,205,255,0)');
  mctx.fillStyle=grad; mctx.beginPath(); mctx.moveTo(px,py); mctx.arc(px,py,120,ang-0.62,ang+0.62); mctx.closePath(); mctx.fill();
  mctx.font='700 12px "JetBrains Mono",Menlo,Consolas,monospace'; mctx.textAlign='center'; mctx.textBaseline='middle';
  for(let r=0;r<MMR;r++)for(let c=0;c<MMC;c++){
    const x=ox+c, y=oy+r, i=y*MW+x; if(!explored[i])continue;
    const tt=D.tile[i]; let ch, b0,b1,b2;
    const fxc=D.fixCell.get(i), dc=fxc?null:D.decoCell.get(i);
    if(fxc){ ch=fxc.ch; b0=fxc.col[0]*1.4+0.3; b1=fxc.col[1]*1.4+0.3; b2=fxc.col[2]*1.4+0.3; }
    else if(dc){ ch=dc.ch; b0=dc.col[0]; b1=dc.col[1]; b2=dc.col[2]; }
    else if(tt===TW&&D.vein[i]){ ch=D.vein[i]===1?'$':'*'; const vc=VEIN_COL[D.vein[i]]; b0=vc[0];b1=vc[1];b2=vc[2]; }
    else if(tt===TW){ ch='#'; b0=0.72;b1=0.7;b2=1.0; }
    else if(tt===TP){ ch='0'; b0=0.8;b1=0.78;b2=1.0; }
    else if(tt===TC){ ch=':'; b0=0.42;b1=0.26;b2=0.7; }
    else if(tt===TX){ ch='#'; const xc=D.xtalCol.get(i)||[0.6,0.85,1.0]; b0=xc[0]*1.2;b1=xc[1]*1.2;b2=xc[2]*1.2; }
    else if(D.bridge[i]){ ch='='; b0=0.85;b1=0.62;b2=0.4; }
    else if(D.liquid[i]===LQ_DEEP){ ch='~'; b0=0.2;b1=0.34;b2=0.85; }
    else if(D.liquid[i]===LQ_BOG){ ch='~'; b0=0.55;b1=0.6;b2=0.28; }
    else if(D.surface[i]===SF_ICE){ ch='='; b0=0.7;b1=0.9;b2=1.1; }
    else if(D.surface[i]===SF_RUBBLE&&!D.liquid[i]){ ch=','; b0=0.7;b1=0.58;b2=0.48; }
    else if(D.surface[i]===SF_DEAD){ ch='"'; b0=0.65;b1=0.52;b2=0.32; }
    else if(fire[i]>0.05){ ch='^'; b0=2.2;b1=1.0;b2=0.3; }
    else if(D.pit&&D.pit[i]){ ch=':'; b0=1.0;b1=0.5;b2=0.25; }
    else if(D.doorAt[i]>=0&&D.doors[D.doorAt[i]].gone){ ch=','; b0=0.35;b1=0.32;b2=0.32; }
    else if(burnt[i]&&tt===TF&&!D.liquid[i]){ ch=','; b0=0.38;b1=0.35;b2=0.36; }
    else if(D.doorAt[i]>=0){ ch=D.doors[D.doorAt[i]].o>0.5?"'":'+'; b0=0.95;b1=0.66;b2=0.38; }
    else if(D.liquid[i]===LQ_LAVA){ ch='~'; b0=1.3;b1=0.45;b2=0.12; }
    else if(D.liquid[i]===LQ_WATER){ ch='~'; b0=0.35;b1=0.68;b2=1.0; }
    else if(D.surface[i]===SF_OBSIDIAN){ ch=','; b0=0.6;b1=0.35;b2=0.35; }
    else if(D.surface[i]===SF_FOLIAGE||D.surface[i]===SF_FUNGFOR){ const t2=cellFlag[i]===20; ch=t2?',':'"'; if(D.surface[i]===SF_FUNGFOR){b0=0.5;b1=0.9;b2=1.0;} else {b0=0.3;b1=t2?0.6:0.85;b2=0.3;} }
    else if(D.surface[i]===SF_BRIM){ ch='*'; b0=1.0;b1=0.82;b2=0.3; }
    else if(D.surface[i]===SF_MUD){ ch='~'; b0=0.55;b1=0.4;b2=0.25; }
    else if(D.surface[i]===SF_HAY){ ch='"'; b0=0.95;b1=0.8;b2=0.4; }
    else if(D.surface[i]===SF_GRASS||D.surface[i]===SF_LUMEN){ ch='"'; b0=0.35;b1=0.95;b2=D.surface[i]===SF_LUMEN?0.85:0.55; }
    else { ch='.'; b0=0.68;b1=0.68;b2=0.9; }
    let r0,g0,bl;
    if(fovVis[i]===fovStamp){
      const l=cellLight((x+0.5)*CELL,(y+0.5)*CELL);
      const d=Math.hypot(x+0.5-pcx,y+0.5-pcz)*CELL, lan=Math.max(0,1-d/lantern.r); const lw=lan*lan*0.75*lantern.k;
      const e=(fxc||D.liquid[i]===LQ_LAVA)?1.0:tt===TX?0.7:dc?0.32:0.16;
      r0=b0*(e+l[0]*0.85+lw*LANTERN[0]); g0=b1*(e+l[1]*0.85+lw*LANTERN[1]); bl=b2*(e+l[2]*0.85+lw*LANTERN[2]);
      mem[i*3]=r0; mem[i*3+1]=g0; mem[i*3+2]=bl;
    } else {
      const m0=mem[i*3], m1=mem[i*3+1], m2=mem[i*3+2], avg=(m0+m1+m2)/3;
      r0=(m0*0.4+avg*0.6)*0.32+0.035; g0=(m1*0.4+avg*0.6)*0.32+0.035; bl=(m2*0.4+avg*0.6)*0.36+0.085;
    }
    const gv=D.gas[i]; if(gv>0.08&&fovVis[i]===fovStamp){ mctx.fillStyle=`rgba(120,190,60,${Math.min(0.4,gv*0.45).toFixed(2)})`; mctx.fillRect(MPAD+c*MCW,MPAD+r*MCH,MCW,MCH); }
    mctx.fillStyle=`rgb(${tone(r0)},${tone(g0)},${tone(bl)})`;
    mctx.fillText(ch,MPAD+(c+0.5)*MCW,MPAD+(r+0.5)*MCH);
  }
  mctx.shadowBlur=8;
  for(const it of (D.items||[])){ if(it.taken||!explored[it.i])continue; if(!it.rune)continue; const tc=TIER_COL[runeTier(it.rune)], c=it.i%MW-ox, r=((it.i/MW)|0)-oy; if(c<0||r<0||c>=MMC||r>=MMR)continue; mctx.shadowColor=css(tc); mctx.fillStyle=css(tc); mctx.fillText('*',MPAD+(c+0.5)*MCW,MPAD+(r+0.5)*MCH); }
  for(const tr of (D.traps||[])){ if(tr.hidden||!explored[tr.i])continue; const c=tr.i%MW-ox, r=((tr.i/MW)|0)-oy; if(c<0||r<0||c>=MMC||r>=MMR)continue; mctx.shadowColor=TRAP_INFO[tr.type][1]; mctx.fillStyle=TRAP_INFO[tr.type][1]; mctx.fillText('^',MPAD+(c+0.5)*MCW,MPAD+(r+0.5)*MCH); }
  if(D.gate){ for(const [ci,chr] of [[D.gate.cell,D.gate.open?'.':'#'],[D.gate.lever,'/']]){ if(!explored[ci])continue; const c=ci%MW-ox, r=((ci/MW)|0)-oy; if(c<0||r<0||c>=MMC||r>=MMR)continue; mctx.shadowColor='#ffd48a'; mctx.fillStyle='#ffd48a'; mctx.fillText(chr,MPAD+(c+0.5)*MCW,MPAD+(r+0.5)*MCH); } }
  for(const w of (D.webs||[])){ if(w.gone||!explored[w.i])continue; const c=w.i%MW-ox, r=((w.i/MW)|0)-oy; if(c<0||r<0||c>=MMC||r>=MMR)continue; mctx.shadowColor='#d8c8ff'; mctx.fillStyle='rgba(216,200,255,0.8)'; mctx.fillText('%',MPAD+(c+0.5)*MCW,MPAD+(r+0.5)*MCH); }
  for(const m of monsters){
    const ghost=m.ty.invisible&&Math.hypot(m.x-player.x,m.z-player.z)<6;
    if(!m.visible&&!ghost)continue;
    const c=m.cx-ox, r=m.cz-oy; if(c<0||r<0||c>=MMC||r>=MMR)continue;
    const col=ghost?[0.25,0.3,0.4]:m.hidden?[1.0,0.82,0.42]:m.ty.col; mctx.shadowColor=css(col); mctx.fillStyle=css(col);
    mctx.fillText(m.hidden?'?':m.ty.ch,MPAD+(m.x/CELL-ox)*MCW,MPAD+(m.z/CELL-oy)*MCH);
  }
  mctx.shadowColor='rgba(255,255,255,0.9)'; mctx.fillStyle='#ffffff'; mctx.shadowBlur=10;
  mctx.font='800 13px "JetBrains Mono",Menlo,Consolas,monospace';
  mctx.fillText('@',px,py);
  mctx.shadowBlur=0;
  mctx.fillStyle='rgba(170,220,255,0.95)';
  const tx=px+Math.cos(ang)*11, ty=py+Math.sin(ang)*11;
  mctx.beginPath(); mctx.moveTo(tx+Math.cos(ang)*4,ty+Math.sin(ang)*4);
  mctx.lineTo(tx+Math.cos(ang+2.4)*3.5,ty+Math.sin(ang+2.4)*3.5); mctx.lineTo(tx+Math.cos(ang-2.4)*3.5,ty+Math.sin(ang-2.4)*3.5); mctx.closePath(); mctx.fill();
}

// ---------------------------------------------------------------- messages
const logEl=document.getElementById('log'); const msgs=[];
function msg(html){ msgs.push({html,t:performance.now()}); if(msgs.length>3)msgs.shift(); renderLog(); }
function renderLog(){
  const now=performance.now();
  while(msgs.length&&(now-msgs[0].t)/1000>13)msgs.shift();
  logEl.innerHTML=msgs.map((m,i)=>{ const age=(now-m.t)/1000, rank=msgs.length-1-i; const o=(1-rank*0.3)*clamp(1-(age-7)/5,0,1); return `<div class="m" style="opacity:${o.toFixed(2)}">${m.html}</div>`; }).join('');
}
setInterval(renderLog,1000);

// ---------------------------------------------------------------- collisions
let blockType='';
function solidAt(x,z,r){
  const x0=Math.floor((x-r)/CELL), x1=Math.floor((x+r)/CELL), z0=Math.floor((z-r)/CELL), z1=Math.floor((z+r)/CELL);
  for(let cz=z0;cz<=z1;cz++)for(let cx=x0;cx<=x1;cx++){
    if(cx<0||cz<0||cx>=MW||cz>=MH){ blockType='wall'; return true; }
    if(D.gate&&D.gate.o<0.7&&cz*MW+cx===D.gate.cell){ const nx=clamp(x,cx*CELL,(cx+1)*CELL), nz=clamp(z,cz*CELL,(cz+1)*CELL); if((x-nx)**2+(z-nz)**2<r*r){ blockType='gate'; return true; } }
    const tt=D.tile[cz*MW+cx];
    const lqc=D.liquid[cz*MW+cx];
    if(tt===TW||(tt===TC&&!(D.pit&&D.pit[cz*MW+cx]))||tt===TX||lqc===LQ_LAVA){ const nx=clamp(x,cx*CELL,(cx+1)*CELL), nz=clamp(z,cz*CELL,(cz+1)*CELL); if((x-nx)**2+(z-nz)**2<r*r){ blockType=tt===TC?'chasm':tt===TX?'xtal':lqc===LQ_LAVA?'lava':'wall'; return true; } }
    else if(tt===TP){ if(Math.hypot(x-(cx+0.5)*CELL,z-(cz+0.5)*CELL)<0.55+r){ blockType='wall'; return true; } }
    else { const sr=D.solid.get(cz*MW+cx); if(sr&&Math.hypot(x-(cx+0.5)*CELL,z-(cz+0.5)*CELL)<sr+r){ blockType='wall'; return true; } }
  }
  return false;
}

// ---------------------------------------------------------------- input
const keys={};
let started=false, locked=false, dragging=false, lmx=0, lmy=0, plFailed=false;
const introEl=document.getElementById('intro'), resumeEl=document.getElementById('resume');
function updateResume(){ resumeEl.style.display='none'; }
function tryLock(){
  if(plFailed||!canvas.requestPointerLock)return;
  try{ const p=canvas.requestPointerLock(); if(p&&p.catch)p.catch(()=>{ plFailed=true; updateResume(); }); }catch(e){ plFailed=true; }
}
document.addEventListener('pointerlockchange',()=>{ const was=locked; locked=document.pointerLockElement===canvas; if(locked&&menuOpen)setMenu(false); if(was&&!locked&&started&&!dead&&!invOpen)setMenu(true); updateResume(); });
document.addEventListener('pointerlockerror',()=>{ plFailed=true; updateResume(); msg('<b style="color:#8fe9ff">i</b>マウスをドラッグして視点を動かせます。'); });
let startDepth=1;
// ---------------------------------------------------------------- stage D: lore (points kept between adventures), unlocks, the last adventurer's grave, trials
const META_DEF={lore:0,spent:0,unl:[],grave:null,trials:[]};
function loadMeta(){ try{ return Object.assign({},META_DEF,JSON.parse(localStorage.getItem('al_meta')||'{}')); }catch(e){ return Object.assign({},META_DEF); } }
let META=loadMeta();
function saveMeta(){ try{ localStorage.setItem('al_meta',JSON.stringify(META)); }catch(e){} }
const UNLOCKS=[
  {id:'w_star',kind:'weapon',t:'star',name:'星降りの杖',cost:15,desc:'狙った所に、遅れて光の柱が降る杖'},
  {id:'w_rain',kind:'weapon',t:'rain',name:'雨降らしの長弓',cost:20,desc:'両手で持つ長弓。狙った所に、矢の雨を降らせる'},
  {id:'w_gsword',kind:'weapon',t:'gsword',name:'遠鳴りの両手剣',cost:25,desc:'両手で持つ大剣。広い斬撃と、溜めた大きな斬撃'},
  {id:'w_mstaff',kind:'weapon',t:'mstaff',name:'満ち月の長杖',cost:25,desc:'両手で持つ長杖。溜めるほど育つ光の月'},
  {id:'r_poison',kind:'rune',t:'poison',name:'毒のルーン',cost:15,desc:'性質のルーン「毒」が、祭壇などに出るようになる'},
  {id:'b_shatter',kind:'bless',t:'shatter',name:'恩恵「冷え込み」',cost:10,desc:'レベルアップの恩恵に加わる'},
  {id:'b_swapedge',kind:'bless',t:'swapedge',name:'恩恵「持ち替えの冴え」',cost:10,desc:'レベルアップの恩恵に加わる'},
  {id:'b_scorch',kind:'bless',t:'scorch',name:'恩恵「焦熱」',cost:10,desc:'レベルアップの恩恵に加わる（代償あり）'},
  {id:'b_reckless',kind:'bless',t:'reckless',name:'恩恵「捨て身」',cost:10,desc:'レベルアップの恩恵に加わる（代償あり）'},
  {id:'build3',kind:'build',name:'三つ目のビルド',cost:30,desc:'保存できるビルドが3つになる'},
  {id:'t_dusk',kind:'trial',t:'dusk',name:'試練「薄明」',cost:20,desc:'灯りが約6割しか届かない。代わりに、敵にも見つかりにくい'},
  {id:'t_fury',kind:'trial',t:'fury',name:'試練「猛り」',cost:30,desc:'敵の体力と攻撃が約3割強く、群れが少し増える'} ];
const devAllSafe=()=>{ try{ return DEVALL; }catch(e){ return false; } };
const unlocked=id=>devAllSafe()||META.unl.includes(id);
const lockedOf=(kind,t)=>{ const u=UNLOCKS.find(x=>x.kind===kind&&x.t===t); return !!u&&!unlocked(u.id); };
const weaponPool=()=>RUNE_TYPES.atk.filter(t=>!lockedOf('weapon',t));
const loreLeft=()=>Math.max(0,(META.lore||0)-(META.spent||0));
let runTrials=[];
const trialOn=k=>runTrials.includes(k);
let introMode='main';
function buildUnlockPanel(){ const el=document.getElementById('intropanel'); if(!el)return; const f=t=>`<span class="f">${t}</span>`, KIND={weapon:'武器',rune:'ルーン',bless:'恩恵',build:'ビルド',trial:'試練'};
  const rows=[f('+-- 解放 ---'),`${f('|')} 伝承を使って、選べるものを増やす。　使える伝承 <b style="color:#ffe3a0">${loreLeft()}</b>`,f('|')];
  for(const u of UNLOCKS){ const done=unlocked(u.id), can=!done&&u.cost<=loreLeft();
    rows.push(`${f('|')} ${done?'<span class="lab">　解放済み　</span>':can?`<button class="sl" type="button" data-unl="${u.id}">[ 解放する ]</button>`:'<span class="dim">　伝承不足　</span>'} ${padTo(`<span class="lab">${KIND[u.kind]}</span>`,6)} ${padTo(done?u.name:`<span${can?'':' class="dim"'}>${u.name}</span>`,24)} <span class="lab">${String(u.cost).padStart(3)}</span>`);
    rows.push(`${f('|')}               <span class="dim">${u.desc}</span>`); }
  rows.push(f('|'),`${f('|')} <button class="sl" id="unlBack" type="button">[ もどる ]</button>`,f('+---'));
  el.innerHTML=boxText(rows);
  document.getElementById('unlBack').addEventListener('click',()=>{ introMode='main'; buildIntroPanel(); });
  for(const b of el.querySelectorAll('button[data-unl]'))b.addEventListener('click',()=>{ const u=UNLOCKS.find(x=>x.id===b.dataset.unl); if(!u||unlocked(u.id)||u.cost>loreLeft())return; META.unl=[...(META.unl||[]),u.id]; META.spent=(META.spent||0)+u.cost; saveMeta(); sndInit(); sChime(0,0,0.5); buildUnlockPanel(); }); }
function buildIntroPanel(){
  const devOn=(()=>{ try{ return localStorage.getItem('al_dev')==='1'; }catch(e){ return false; } })(); if(!devOn)startDepth=1; const seedKeep=(document.getElementById('seedIn')||{}).value||'';
  const el=document.getElementById('intropanel'); if(!el)return; const f=t=>`<span class="f">${t}</span>`;
  if(introMode==='unlock'){ buildUnlockPanel(); return; }
  const keys=[['WASD','移動'],['マウス','視点'],['左クリック','左手'],['右クリック','右手'],['ホイール','ビルド切替'],['Space','回避'],['Shift','走る'],['Tab','装備'],['Esc','メニュー']];
  const cell=([k,v])=>{ const s=`<b>[${k}]</b> ${v}`; return s+' '.repeat(Math.max(1,24-visW(s))); };
  const keyRows=[]; for(let i=0;i<keys.length;i+=2)keyRows.push(`${f('|')} ${cell(keys[i])}${keys[i+1]?cell(keys[i+1]):''}`);
  const seen=new Set(), layers=[]; for(const st of STRATA){ if(seen.has(st.n))continue; seen.add(st.n); layers.push(st); }
  const layerRows=devOn?[`${f('|')} 開始する層`,...layers.map(st=>`${f('|')}   <button class="sl${st.from===startDepth?' on':''}" type="button" data-d="${st.from}"><span class="mk">${st.from===startDepth?'&gt;':' '}</span> 第${st.n}層 ${st.name}</button>`),f('|')]:[];
  el.innerHTML=boxText([f('+-- 地下迷宮へ ---'),
    `${f('|')} 壁も床も天井も、そこに棲むものも、`,`${f('|')} すべてが光る文字でできた地下迷宮。`,`${f('|')} 深く潜るほど闇は濃く、溶岩の光が強くなる。`,f('|'),
    ...keyRows,f('|'),...layerRows,
    `${f('|')} シード [<input id="seedIn" type="text" inputmode="numeric" autocomplete="off" maxlength="10" size="10" placeholder="ランダム" aria-label="シード">]`,f('|'),
    ...(UNLOCKS.some(u=>u.kind==='trial'&&unlocked(u.id))?[`${f('|')} 試練 `+UNLOCKS.filter(u=>u.kind==='trial'&&unlocked(u.id)).map(u=>`<button class="sl${(META.trials||[]).includes(u.t)?' on':''}" type="button" data-trial="${u.t}"><span class="mk">${(META.trials||[]).includes(u.t)?'&gt;':' '}</span> ${u.name.replace(/試練|「|」/g,'')}</button>`).join('  '),f('|')]:[]),
    `${f('|')} 伝承 <b style="color:#ffe3a0">${loreLeft()}</b> <span class="lab">（累計 ${META.lore||0}）</span>  <button class="sl" id="unlockB" type="button">[ 解放 ]</button>`,f('|'),
    `${f('|')}               <button id="enter" type="button">[ 迷宮に入る ]</button>`,f('|'),
    `${f('|')} <button class="sl" id="galB" type="button">[ 図鑑 ]</button>  <button class="sl" id="galR" type="button">[ 試しの間 ]</button>   <button class="sl" id="galDev" type="button">[開発用モード：${devOn?'オン':'オフ'}]</button>`,f('+---')]);
  document.getElementById('galB').addEventListener('click',()=>{ sndInit(); openBestiary(); });
  document.getElementById('unlockB').addEventListener('click',()=>{ introMode='unlock'; buildIntroPanel(); });
  for(const b of el.querySelectorAll('button[data-trial]'))b.addEventListener('click',()=>{ const k=b.dataset.trial, T=new Set(META.trials||[]); if(T.has(k))T.delete(k); else T.add(k); META.trials=[...T]; saveMeta(); buildIntroPanel(); });
  document.getElementById('galR').addEventListener('click',()=>openRange());
  document.getElementById('galDev').addEventListener('click',()=>{ DEVALL=!DEVALL; try{ localStorage.setItem('al_dev',DEVALL?'1':'0'); }catch(er){} buildIntroPanel(); });
  for(const b of el.querySelectorAll('button.sl[data-d]'))b.addEventListener('click',()=>{ startDepth=+b.dataset.d; for(const o of el.querySelectorAll('button.sl[data-d]')){ const on=o===b; o.classList.toggle('on',on); o.querySelector('.mk').innerHTML=on?'&gt;':' '; } });
  const si=document.getElementById('seedIn'); if(si)si.value=seedKeep;
}
buildIntroPanel();

// the title panel can be rebuilt, so its [迷宮に入る] is caught on the panel itself
document.getElementById('intropanel').addEventListener('click',e=>{
  if(!(e.target&&e.target.closest&&e.target.closest('#enter')))return;
  sndInit();
  const sv=(document.getElementById('seedIn').value||'').trim();
  let regen=false;
  if(/^[0-9]{1,10}$/.test(sv)){ const n=Number(sv)>>>0; if(n!==runSeed){ runSeed=n; regen=true; } }
  if(startDepth!==depth){ depth=startDepth; regen=true; }
  if(regen){ branch=null; realm=null; inter=null; }
  rains=[]; marks=[]; zones=[]; laters=[];
  dead=false; { const de=document.getElementById('death'); if(de)de.classList.remove('show','won'); }
  PLAYER_MAX=40; lvl={n:1,exp:0,pending:0,bless:{},strata:new Set()}; runTrials=(META.trials||[]).filter(k=>unlocked('t_'+k)); player.hp=PLAYER_MAX; runStats={kills:0,t0:time,maxDepth:depth,book0:BOOK.size,beastsNew:0}; resetRunes();
  if(regen)newLevel();
  started=true; document.body.classList.add('started'); if(D)showStratum(D.stratum); setHelp(true); helpT=25; introEl.classList.add('gone'); canvas.focus(); tryLock(); updateResume();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('mousedown',e=>{
  if(!menuOpen&&!invOpen)return;
  if(dbgOpen){ if(!(e.target&&e.target.closest&&e.target.closest('#dbgp'))){ e.preventDefault(); e.stopPropagation(); setDbg(false); } return; }
  const inside=e.target&&e.target.closest&&e.target.closest('#menu,#pack');
  if(inside)return;
  e.preventDefault(); e.stopPropagation();
  if(menuOpen){ setMenu(false); if(!plFailed)tryLock(); }
  if(invOpen)setInv(false);
},true);
canvas.addEventListener('wheel',e=>{ if(!started||isPaused()||!hands)return; e.preventDefault(); const have=(unlocked('build3')?[0,1,2]:[0,1]).filter(k=>builds[k]); if(!have.length||time-(canvas.wheelT||-9)<0.35)return; canvas.wheelT=time;
  const pos=Math.max(0,have.indexOf(buildIdx)), next=have[(pos+1)%have.length]; const prev=snapHands(); if(applyBuild(next)){ startSwap(prev); showHint(`ビルド${next+1}`); setTimeout(()=>showHint(''),900); } renderHotbar(); },{passive:false});
let downAt=null;
canvas.addEventListener('mousedown',e=>{ if(!started||isPaused())return; if(e.button===2){ beginCast('R'); return; } if(locked&&e.button===0){ beginCast('L'); return; } if(e.button===0){ downAt=[e.clientX,e.clientY]; beginCast('L'); } dragging=true; lmx=e.clientX; lmy=e.clientY; if(!locked)tryLock(); canvas.focus(); updateResume(); });
window.addEventListener('mouseup',e=>{ if(hands){ if(e.button===0)releaseCast('L'); if(e.button===2)releaseCast('R'); } downAt=null; dragging=false; updateResume(); });
window.addEventListener('mousemove',e=>{
  if(!started)return;
  if(locked){ player.yaw-=e.movementX*0.0022; player.pitch-=e.movementY*0.0022; }
  else if(dragging){ player.yaw-=(e.clientX-lmx)*0.0045; player.pitch-=(e.clientY-lmy)*0.0045; lmx=e.clientX; lmy=e.clientY; }
  player.pitch=clamp(player.pitch,-1.35,1.35);
});
window.addEventListener('keydown',e=>{
  if(gallery&&gallery.mode==='beast'){ if(e.code==='ArrowLeft')showBeast(gallery.idx-1); else if(e.code==='ArrowRight')showBeast(gallery.idx+1); else if(e.code==='Escape')returnToTitle(); e.preventDefault(); return; }
  if(e.target&&e.target.tagName==='INPUT'){ if(e.code==='Enter'){ e.preventDefault(); document.getElementById('enter').click(); } return; }
  keys[e.code]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(!started&&(e.code==='Enter'||e.code==='Space')){ document.getElementById('enter').click(); return; }
  if(e.code==='F2'){ e.preventDefault(); if(started&&!dead&&DEVALL){ if(menuOpen)setMenu(false); if(invOpen)setInv(false); setDbg(!dbgOpen); } return; }
  if(e.code==='Escape'&&dbgOpen){ setDbg(false); return; }
  if(altarOpen&&(e.code==='Escape'||e.code==='Tab')){ e.preventDefault(); closeAltar(true); if(e.code==='Tab'&&started&&!dead)setInv(true); return; }
  if(e.code==='Tab'){ e.preventDefault(); if(started&&!dead){ if(menuOpen)setMenu(false); setInv(!invOpen); } return; }
  if(e.code==='Escape'){ if(invOpen){ setInv(false); return; } if(started&&!dead&&plFailed){ setMenu(!menuOpen); return; } }
  if(isPaused())return;
  if(started&&e.code==='KeyM'){ sndToggle(); }
  if(started&&e.code==='KeyH'){ cycleUi(); }
  if(dead&&(e.code==='Enter'||e.code==='KeyR')){ newRun(); return; }
  if(started&&e.code==='Space'){ startRoll(); }
  if(started&&e.code==='KeyP'){ perfOn=!perfOn; renderStatus(); }
  if(started&&e.code==='KeyJ'){ chronOn=!chronOn; helpOn=false; helpT=0; const el=document.getElementById('help'); if(el){ if(chronOn)renderChron(); el.classList.toggle('off',!chronOn); } }
  if(started&&(e.key==='?'||e.code==='Slash')){ setHelp(!helpOn); helpT=0; }
});
window.addEventListener('keyup',e=>{ keys[e.code]=false; });
window.addEventListener('blur',()=>{ for(const k in keys)keys[k]=false; dragging=false; });

// ---------------------------------------------------------------- level control
let trans=null, fade=0, expo=1.1;
let runSeed=(Math.random()*1e9)>>>0;
const levelSeed=()=>((Math.imul(runSeed,2654435761)^Math.imul(depth,1013904223)^(branch?Math.imul(branch.lvl*31+branch.key.charCodeAt(0),0x27d4eb2d):0)^(realm?Math.imul(realm.key.charCodeAt(0)+7,0x165667b1):0)^(inter?Math.imul(inter.key.charCodeAt(0)+13,0x2c1b3c6d):0))>>>0)||1;
function setFog(){ const k=D.prof.fogDark, f=(D.stratum.fog?D.stratum.fog:D.stratum.k==='magma'?[0.016,0.004,0.003]:D.stratum.k==='abyss'?[0.007,0.003,0.014]:FOGS[(depth-1)%FOGS.length]).map(v=>v*k); fogCol.set(f[0],f[1],f[2]); renderer.setClearColor(new T.Color(f[0],f[1],f[2]),1); fogBase=0.05+Math.min(depth-1,6)*0.002; U.uFogDen.value=fogBase; }
let lastStratum=null;
function showStratum(st){
  const el=document.getElementById('stratum'); if(!el)return;
  const name=[...st.name].join(' ');
  el.innerHTML=`<span class="r">-  -  -</span>   ${st.special?'特 別 な 階':st.branch?'支 道':st.realm?'異 界':`第 ${st.n} 層`}   <span class="r">-  -  -</span>\n<b>${name}</b>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(showStratum.t); showStratum.t=setTimeout(()=>el.classList.remove('show'),5600);
}
function settleSlotPick(){ if(!runState||!runState.slotPend||!D)return; const o=(D.items||[]).find(x=>x.grp===runState.slotPend&&!x.taken); if(o){ applyOpen(o.target); msg(`<span class="lab">選ばれなかった空の枠は、${o.label}を開けた。</span>`); } runState.slotPend=null; }
function newLevel(seedOverride){
  settleSlotPick();
  if(advance.bounced){ advance.bounced=false; setTimeout(()=>msg('<b style="color:#a98cff">.</b>闇の底に触れた途端、何かに押し返された。まだ、降りることは許されていない。'),1200); }
  D=generate(seedOverride!==undefined?seedOverride:levelSeed(),depth);
  if(depth===FINAL_DEPTH&&!branch&&!realm)D.finalVault=true;
  D.doorAt=new Map(D.doors.map(d=>[d.i,d])); frozen=new Map();
  placeRunesForLevel(); projs=[]; beamSegs=[]; clouds=[]; castSt=null;
  U.uAmb.value=D.prof.ambient;
  hudInfo.explored=0;
  buildWorld(); updateWater();
  fixtures=D.fixtures;
  monsters=D.spawns.map(makeMonster);
  if(branch&&runState.lordsDone&&runState.lordsDone.has(branch.key))monsters=monsters.filter(m=>m.key!=='lord');
  finalSt=null; if(isFinal())setupFinal();
  for(const m of monsters)if(!m.isLead)m.leader=monsters.find(o=>o.g===m.g&&o.isLead)||null;
  for(const m of monsters)if(m.ty.beast||(m.ty.dragon&&Math.random()<0.9))m.sleep=true;
  { const asleep=new Set(); for(const m of monsters)if(m.isLead&&m.g>=0&&m.ty.form!=='eel'&&Math.random()<0.10)asleep.add(m.g); for(const m of monsters)if(asleep.has(m.g))m.sleep=true; }
  noticeMsgT={}; stealth.hudKey='';
  explored=new Uint8Array(NCELL); mem=new Float32Array(NCELL*3); fovVis=new Uint32Array(NCELL); fovStamp=1;
  { const pm=placeMem.get(placeKey()); if(pm){ explored.set(pm.explored); mem.set(pm.mem); } }
  visitedRooms=new Set(); stairsSeen=false; player.rally=0; rallyMotes=[]; if(runStats&&!gallery)runStats.maxDepth=Math.max(runStats.maxDepth||0,depth); setTimeout(strataGrowth,50);
  if(started&&!gallery&&!dead&&!arrive){ const sp=inter?SPECIALS[inter.key]:null; if(sp&&(sp.k==='town'||sp.k==='oracle')){ player.hp=PLAYER_MAX; setTimeout(()=>msg('<b style="color:#ffd9a0">+</b>静かな場所だ。張りつめていた体が、すっかりほどけた。'),1600); } else if(player.hp<PLAYER_MAX){ player.hp=Math.min(PLAYER_MAX,player.hp+PLAYER_MAX*0.2); setTimeout(()=>msg('<span class="lab">階段を降りると、少し息が整った。</span>'),1600); } }
  player.x=(D.start%MW+0.5)*CELL; player.z=(((D.start/MW)|0)+0.5)*CELL; player.vx=player.vz=0; player.yaw=D.startYaw; player.pitch=-0.04; lockCell=-1;
  { const tc=arrive==='portal'&&D.portal?D.portal.cell:arrive==='bstairs'&&D.bstairs?D.bstairs.cell:arrive==='stairs'?D.stairs:-1;
    if(tc>=0){ const nb=[1,-1,MW,-MW,MW+1,MW-1,-MW+1,-MW-1].map(o=>tc+o).find(j=>j>=0&&j<NCELL&&D.tile[j]===TF&&!D.liquid[j]&&!D.solid.has(j))??tc;
      player.x=(nb%MW+0.5)*CELL; player.z=(((nb/MW)|0)+0.5)*CELL; player.yaw=Math.atan2(-((tc%MW)-(nb%MW)),-(((tc/MW)|0)-((nb/MW)|0)))+Math.PI; lockCell=tc; } arrive=null; }
  stealth.sneak=false; lantern.r=8.2; lantern.k=1;
  riverCells=[]; for(let i=0;i<NCELL;i++)if(D.flow[i]&&(D.liquid[i]===LQ_WATER||D.liquid[i]===LQ_DEEP))riverCells.push(i);
  trampled=[]; tallMsg=false; brimMsg=false; player.lastCell=-1; player.netT=0;
  scent=new Float32Array(NCELL); webMsg=false; webBurnMsg=false; repairMsg=false;
  pN=0; gasAny=false; initFire(); initEvents(); spark=null; projs=[]; showHint(''); edge.t=0; setFog(); initDust();
  renderStatus(); if(helpOn)renderHelp();
  computeFOV(); checkEvents(true);
  if(player.fall){ player.fall=false; setTimeout(()=>{ hurtPlayer(roll(2,4),'落下の衝撃'); },300); }
  if(D.stratum!==lastStratum){ if(lastStratum!==null){ showStratum(D.stratum); if(D.stratum.msg)msg(`<b style="color:#c9b8ff">=</b>${D.stratum.msg}`); } lastStratum=D.stratum; }
}
function checkEvents(first){
  const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL);
  const ri=D.roomOf[pc];
  if(first)msg(depth===1?'<b style="color:#c9b8ff">@</b>石の迷宮に降り立った。闇の奥で、何かが息づいている。':`<b style="color:#ffcf7a">&gt;</b>深度 ${depth}。光はより鮮やかに、闇はより深くなった。`);
  if(ri>=0&&!visitedRooms.has(ri)){ visitedRooms.add(ri); const th=D.rooms[ri].theme; msg(`<b style="color:${css(th.col)}">${D.rooms[ri].cave?'~':'*'}</b>${th.msg}`); const km=D.rooms[ri].kindMsg; if(km)msg(`<b style="color:${css(th.col)}">=</b>${km}`); const mc=D.rooms[ri].machine; if(mc){ const mi=MACHINE_INFO[mc]; msg(`<b style="color:${css(mi.col)}">${mi.ch}</b>${mi.msg}`); } }
  if(!D.engrSeen&&D.engr.size){ for(const k of D.engr.keys()){ const i=k>>2; if(fovVis[i]===fovStamp&&Math.hypot((i%MW+0.5)*CELL-player.x,(((i/MW)|0)+0.5)*CELL-player.z)<7){ D.engrSeen=true; msg('<b style="color:#ffdca0">#</b>壁に彫刻が刻まれている。見つめれば、そこに描かれた出来事が読み取れる。'); break; } } }
  if(!stairsSeen&&fovVis[D.stairs]===fovStamp){ stairsSeen=true; msg('<b style="color:#ffcf7a">&gt;</b>金色に輝く下り階段を見つけた。踏み込めば、さらに深い階層へ。'); }
  if(lockCell>=0){ const lx=(lockCell%MW+0.5)*CELL, lz=(((lockCell/MW)|0)+0.5)*CELL; if(Math.hypot(player.x-lx,player.z-lz)>1.6)lockCell=-1; }
  if(started&&!trans&&D.upstairs>=0&&lockCell!==D.upstairs){ const ux=(D.upstairs%MW+0.5)*CELL, uz=(((D.upstairs/MW)|0)+0.5)*CELL; if(Math.hypot(player.x-ux,player.z-uz)<0.95){ trans={phase:'out',t:0,regen:false,go:'up'}; msg('<b style="color:#c9b8ff">&lt;</b>上り階段を上り、来た道を引き返す……'); } }
  if(started&&!trans&&D.bstairs&&lockCell!==D.bstairs.cell){ const bx=(D.bstairs.cell%MW+0.5)*CELL, bz=(((D.bstairs.cell/MW)|0)+0.5)*CELL; if(Math.hypot(player.x-bx,player.z-bz)<0.95){ trans={phase:'out',t:0,regen:false,go:'branch'}; msg(`<b style="color:${css(BRANCHES[D.bstairs.key].col)}">&gt;</b>本道を外れ、${BRANCHES[D.bstairs.key].name}へ続く脇道を下りていく……`); } }
  if(started&&!trans&&D.portal&&lockCell!==D.portal.cell){ const px2=(D.portal.cell%MW+0.5)*CELL, pz2=(((D.portal.cell/MW)|0)+0.5)*CELL; if(Math.hypot(player.x-px2,player.z-pz2)<1.0){ trans={phase:'out',t:0,regen:false,go:'realm'}; msg(`<b style="color:${css(REALMS[D.portal.key].col)}">0</b>揺らめく門をくぐった……`); } }
  const sx=(D.stairs%MW+0.5)*CELL, sz=(((D.stairs/MW)|0)+0.5)*CELL;
  if(started&&!trans&&D.pit&&D.pit[pc]){ trans={phase:'out',t:0,regen:false}; player.fall=true; msg('<b style="color:#ffa060">:</b>崩れた穴へ身を投じ、下の階層へと落ちていく……'); }
  if(started&&!trans&&lockCell!==D.stairs&&Math.hypot(player.x-sx,player.z-sz)<0.95&&!isFinal()){
    if(stairsGuarded()){ if(time-(updatePlayer.sealT||-99)>6){ updatePlayer.sealT=time; msg('<b style="color:#ff8a8a">=</b>階段は、見えない封に閉ざされている。控えの間に潜むものを退ければ、解けるだろう。'); } }
    else if(descentSealed()){ if(time-(updatePlayer.sealT||-99)>9){ updatePlayer.sealT=time; msg('<b style="color:#a98cff">.</b>階段の先は、底の見えない闇に塞がれている。三つの窪みが、何かを待つように淡く光っている。'); } }
    else { trans={phase:'out',t:0,regen:false}; msg(legendAll()&&depth===FINAL_DEPTH-1?'<b style="color:#ffe9b0">*</b>三つの光が闇を押し分けた。最後の階段を、底へと降りていく……':'<b style="color:#ffcf7a">&gt;</b>光の螺旋に身を委ね、さらに深くへ降りていく。'); } }
  let ex=0; for(let i=0;i<NCELL;i++){ const tt=D.tile[i]; if(explored[i]&&(tt===TF||tt===TP))ex++; }
  const exP=Math.min(100,Math.round(ex/D.floorCount*100)); if(exP!==hudInfo.explored){ hudInfo.explored=exP; if(helpOn)renderHelp(); }
}

// ---------------------------------------------------------------- player
const iceT=new Map();
function crackIce(i,dt){
  const t0=(iceT.get(i)||0)+dt; iceT.set(i,t0);
  if(t0<dt*1.5){ sSqueak(player.x,player.z); if(!D.crackMsg){ D.crackMsg=true; msg('<b style="color:#b8e4ff">/</b>足元の氷が、ぴしりと音を立ててきしんだ。'); } }
  if(t0>0.85){ D.liquid[i]=LQ_WATER; D.thin[i]=0; cellFlag[i]=50; uploadCells(); sSplash(0.45); shake=Math.max(shake,0.15);
    msg('<b style="color:#6ab4ff">~</b>氷が割れ、冷たい水に足が沈んだ。');
    const [x,z]=cpos(i); for(let q=0;q<26;q++){ const a=mr()*6.28; spawn(x+Math.cos(a)*0.5,0.1,z+Math.sin(a)*0.5,Math.cos(a)*1.2,0.6+mr(),Math.sin(a)*1.2,1+mr(),G(mpick(['/','\\','~','*'])),0.16,0.6,0.85,1.0,1); } }
}
const tallAt=i=>i>=0&&i<NCELL&&(D.surface[i]===SF_FOLIAGE||D.surface[i]===SF_FUNGFOR)&&cellFlag[i]!==20&&!burnt[i]&&!D.liquid[i];
let trampled=[], tallMsg=false, brimMsg=false;
function trample(i){ if(!tallAt(i))return; cellFlag[i]=20; uploadCells(); trampled.push([i,time]); sHiss(player.x,player.z,0.22); }
function regrow(){ if(!trampled.length)return; const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL); let ch=false;
  trampled=trampled.filter(([i,t0])=>{ if(time-t0>45&&i!==pc&&cellFlag[i]===20){ cellFlag[i]=0; ch=true; return false; } return cellFlag[i]===20; }); if(ch)uploadCells(); }
function brimFlare(i){ if(D.surface[i]!==SF_BRIM||fire[i]>0.1||fuel[i]<=0)return; ignite(i,1.0,false); for(const d of D4){ const j=i+d[0]+d[1]*MW; if(D.surface[j]===SF_BRIM&&fuel[j]>0)ignite(j,0.6,false); } sCrackleBurst&&sCrackleBurst((i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL);
  if(!brimMsg){ brimMsg=true; msg('<b style="color:#ffd04a">*</b>足元の硫黄が、ぼっと燃え上がった！ しばらくすると、また燃えるようになる。'); } }
let brimT=0; function brimRecover(dt){ brimT+=dt; if(brimT<2)return; brimT=0; let ch=false; for(let i=0;i<NCELL;i++){ if(D.surface[i]===SF_BRIM&&burnt[i]&&fire[i]<=0&&mr()<0.08){ burnt[i]=0; fuel[i]=0.8; ch=true; } } if(ch)uploadCells(); }
// ---------------------------------------------------------------- hidden traps, a lever-and-portcullis vault, sanctuaries (mechanisms after Brogue's machines; written independently)
const TRAP_INFO={alarm:['警報の','#ff6a4a','踏むと鐘が鳴り響き、辺りの獣が集まってくる'],trapdoor:['落とし戸の','#c9b8ff','踏むと床が抜け、下の階へ落ちる'],net:['網の','#d8c8ff','踏むと網が降ってきて、しばらく動けなくなる'],flood:['水の','#6ab4ff','踏むと水があふれ出し、辺りが水浸しになる'],methane:['ガスの','#a8e05a','踏むと沼のガスが噴き出す。火気は厳禁']};
function triggerTrap(tr){
  tr.used=true; tr.hidden=false; const [x,z]=cpos(tr.i), info=TRAP_INFO[tr.type], tag=`<b style="color:${info[1]}">^</b>`;
  switch(tr.type){
    case 'alarm': sAlarm(x,z); shake=Math.max(shake,0.2); msg(tag+'カチリ……鐘の音が響き渡った！ 辺りの獣が集まってくる。');
      for(const m of monsters){ if(m.ty.critter||m.dead)continue; if(Math.hypot(m.x-x,m.z-z)<32){ m.sleep=false; m.aware=Math.max(m.aware,0.8); m.goal=[x,z]; m.goalT=time+15; } } break;
    case 'trapdoor': sRumble(0.5,1.2); shake=Math.max(shake,0.4); msg(tag+'床が抜けた！ 闇の中を、下の階へと落ちていく……'); trans={phase:'out',t:0,regen:false}; player.fall=true; break;
    case 'net': player.netT=3.2; sHiss(x,z,0.5); msg(tag+'網が降ってきた！ もがいて抜け出そうとする……'); break;
    case 'flood': sSplash(0.5); msg(tag+'床の穴から、水が勢いよく噴き出した！'); events.push({type:'flood',ri:-2,order:tr.order.slice(),src:tr.i,state:1,t:0,k:0,max:tr.order.length*3}); break;
    case 'methane': sHiss(x,z,1.2); msg(tag+'床の穴から、沼のガスが噴き出した。火気に注意！');
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){ const j=tr.i+dx+dy*MW; if(j>=0&&j<NCELL&&D.tile[j]!==TW&&Math.hypot(dx,dy)<=2.3)D.gas[j]=Math.max(D.gas[j],0.9); } gasAny=true; break;
  }
}
function updateTraps(dt){
  for(const tr of (D.traps||[])){
    const [x,z]=cpos(tr.i), d=Math.hypot(x-player.x,z-player.z);
    if(tr.hidden&&d<CELL*1.3){ const mv=Math.hypot(player.vx,player.vz)>0.3, rate=(stealth.sneak?1.1:0.3)*(mv?0.6:1.6);
      if(mr()<dt*rate){ tr.hidden=false; sChime(x,z,0.15); msg(`<b style="color:${TRAP_INFO[tr.type][1]}">^</b>隠された${TRAP_INFO[tr.type][0]}罠を見つけた。踏まないように気をつけよう。`); } }
    if(!tr.used&&d<0.6&&!trans)triggerTrap(tr);
  }
  if(player.netT>0){ const mv=keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD; player.netT-=dt*(mv?1.6:1); if(player.netT<=0)msg('網から抜け出した。'); }
  const G2=D.gate;
  if(G2&&!G2.open){ const [lx,lz]=cpos(G2.lever); if(Math.hypot(player.x-lx-G2.ld[0]*0.6,player.z-lz-G2.ld[1]*0.6)<1.1){ G2.open=true; G2.pulled=time; sCreak(lx,lz); const [gx,gz]=cpos(G2.cell); setTimeout(()=>sRumble(0.25,1.6),500); msg('<b style="color:#ffd48a">/</b>壁のレバーを引いた。どこか遠くで、鉄格子が軋みながら上がっていく音がした。'); } }
  if(G2)G2.o+=((G2.open?1:0)-G2.o)*Math.min(1,dt*0.8);
}
function drawTraps(t){
  for(const tr of (D.traps||[])){ if(tr.hidden)continue; const [x,z]=cpos(tr.i); if(Math.hypot(x-player.x,z-player.z)>30)continue;
    const col=TRAP_INFO[tr.type][1], c=[parseInt(col.slice(1,3),16)/255,parseInt(col.slice(3,5),16)/255,parseInt(col.slice(5,7),16)/255], k=tr.used?0.35:1.2+0.5*Math.sin(t*2.5+tr.i);
    dyn(x,0.05,z,G('^'),0.7,c[0]*k,c[1]*k,c[2]*k,1,0);
    for(let q=0;q<8;q++){ const a=q/8*Math.PI*2+t*0.4; dyn(x+Math.cos(a)*0.55,0.04,z+Math.sin(a)*0.55,G('.'),0.18,c[0]*k*0.7,c[1]*k*0.7,c[2]*k*0.7,1,a); } }
  const G2=D.gate; if(G2){ const [gx,gz]=cpos(G2.cell);
    if(Math.hypot(gx-player.x,gz-player.z)<36){ const lift=G2.o*2.7;
      for(let k=0;k<7;k++){ const u=(k+0.5)/7*CELL-CELL/2, bx=G2.axis===0?gx:gx+u, bz=G2.axis===0?gz+u:gz;
        for(let y=0.15+lift;y<3.0;y+=0.3)dyn(bx,y,bz,G('|'),0.3,0.75,0.72,0.8); }
      for(const yy of [0.9+lift,1.9+lift])if(yy<3.0)for(let k=0;k<7;k++){ const u=(k+0.5)/7*CELL-CELL/2; dyn(G2.axis===0?gx:gx+u,yy,G2.axis===0?gz+u:gz,G('='),0.28,0.75,0.72,0.8); } }
    const [lx,lz]=cpos(G2.lever), wx=lx+G2.ld[0]*0.93, wz=lz+G2.ld[1]*0.93;
    dyn(wx,1.3,wz,G('#'),0.4,0.6,0.55,0.5); dyn(wx-G2.ld[0]*0.08,1.45,wz-G2.ld[1]*0.08,G(G2.open?'\\':'/'),0.42,1.4,1.1,0.5); }
  if(player.netT>0&&camMode==='tps'){ for(let k=0;k<16;k++){ const a=k/16*Math.PI*2+time*0.3; for(let y=0.3;y<1.9;y+=0.32)dyn(player.x+Math.cos(a)*0.55,y,player.z+Math.sin(a)*0.55,G(k%2?'+':'#'),0.16,0.6,0.55,0.65); } }
  else if(player.netT>0){ const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw), rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw), cy=camera.position.y;
    for(let a=-3;a<=3;a++)for(let b=-2;b<=2;b++)dyn(camera.position.x+fx*0.7+rx*a*0.16,cy+b*0.16,camera.position.z+fz*0.7+rz*a*0.16,G('+'),0.1,0.55,0.5,0.6); }
}

// ---------------------------------------------------------------- life and death, and plain real-time melee
// numbers are this game's own, set by tier (not copied from any other game's tables)
// [hp, min damage, max damage, seconds between attacks]
const MSTAT={r:[6,1,3,1.0],k:[7,1,4,1.1],j:[8,2,4,0.9],e:[18,3,7,1.4],m:[12,1,3,0.9],b:[4,0,0,9],g:[15,2,5,1.1],c:[10,2,4,1.3],J:[50,1,3,1.0],v:[18,2,6,0.8],
  O:[55,9,13,1.8],w:[10,4,8,1.6],W:[50,6,13,1.5],P:[20,4,9,1.4],S:[20,3,7,1.1],Zf:[25,4,8,1.0],Zi:[25,4,8,1.0],Zl:[25,4,8,1.0],s:[18,2,6,1.2],sw:[22,3,7,1.2],
  B:[55,3,7,1.6],N:[75,7,11,1.5],l:[60,5,11,1.4],K:[120,8,15,2.0],T:[65,10,15,1.7],Y:[300,4,8,2.2],D:[150,20,30,2.4],L:[35,8,14,1.8],n:[12,2,5,1.0],X:[200,12,20,2.0]};
let PLAYER_MAX=40;
const WEAPON={name:'短剣',min:3,max:5,cd:0.45,reach:2.2}, SLEEP_MULT=3;
let dead=false, runStats={kills:0,t0:0}, hurtFlash=0, hpShown=-1;
const roll=(a,b)=>a+Math.floor(mr()*(b-a+1));
const statOf=m=>{ const st=MSTAT[m.ty.sk||m.key]||[12,2,5,1.2]; return trialOn('fury')?[st[0]*1.3,st[1]*1.3,st[2]*1.3,st[3]]:st; };
const hostile=m=>!m.ty.critter&&!m.ty.peaceful&&!m.ty.watcher&&m.ty.form!=='bloat'&&!m.dead;
const hittable=m=>!m.dead&&!m.ty.peaceful;
const foe=m=>hittable(m)&&(hostile(m)||m.ty.watcher||m.ty.form==='bloat'||m.ty.form==='shroom'||(m.ty.critter==='mimic'&&!m.hidden));
const angDiff=(a,b)=>{ let d=a-b; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return d; };
function initMonsterLife(m){ const st=statOf(m); m.maxHp=Math.round(st[0]*(m.ty.boss?1.5:1)); m.hp=m.maxHp; m.atkCd=0.5+mr(); m.wind=0; }
// ---------------------------------------------------------------- levelling: defeating creatures gives experience; at each level time stops and you choose one of three
// (two blessings - strengths tied to actions and elements, some with a price - and one rune or charm). Max health does not grow with level: it grows by 4 on entering each new stratum.
let lvl={n:1,exp:0,pending:0,bless:{},strata:new Set()}, lvlOpen=false, lvlOpenT=0, lvlOpts=[];
const BLESS={
  tough:    {name:'頑丈な体',     d:l=>`最大体力が ${6*l} 増える`},
  quickdodge:{name:'身軽な詠唱',  d:l=>`かわしてから ${l>=2?2.5:1.5}秒以内の詠唱が、半分の時間で済む`},
  counter:  {name:'返しの一撃',   d:l=>`かわしてから 1.5秒の間、与える傷が ${l>=2?80:50}% 増える`},
  momentum: {name:'追い風',         d:l=>`敵を倒すと、3秒の間、性質の傷が ${l>=2?40:25}% 増える`},
  devour:   {name:'巻き返し',   d:l=>`敵を倒した時、取り戻せる傷が、さらに ${3*l} 戻る`},
  kindle:   {name:'火攻め',   d:l=>`燃えている敵への傷が ${l>=2?40:25}% 増える`},
  shatter:  {name:'冷え込み',     d:l=>`凍えた敵を自分の攻撃で倒すと、周り ${l>=2?3.5:2.5}m の敵も凍える`},
  branch:   {name:'裂ける雷',       d:l=>`雷の連鎖が ${l} 増える`},
  charge:   {name:'溜めの一撃',   d:l=>`詠唱が満ちた後も構え続けて放つと、傷が ${l>=2?50:30}% 増える`},
  desperate:{name:'背水',         d:l=>`体力が半分を切ると、詠唱が ${l>=2?45:30}% 速い`},
  swapedge: {name:'持ち替えの冴え', d:l=>`ビルドを替えてから 3秒の間、与える傷が ${l>=2?90:60}% 増える`},
  scorch:   {name:'焦熱',         d:l=>`燃えている敵への傷が ${l>=2?70:50}% 増える。ただし、燃焼を生き延びた敵は、体力が3割戻る`, cost:true},
  reckless: {name:'捨て身',       d:l=>`与える傷が ${l>=2?40:25}% 増える。ただし、受ける傷も ${l>=2?35:25}% 増える`, cost:true} };
const BL=k=>lvl.bless[k]||0;
// a cold snap: the creatures around are chilled (and fire goes out, water freezes)
function coldSnap(x,z,r){ chillArea(x,z,r); for(const m of monsters){ if(m.dead||m.ty.critter)continue; if(Math.hypot(m.x-x,m.z-z)<r+0.3*m.ty.scale){ const st=m.st||(m.st={}); st.chill=Math.max(st.chill||0,4); } }
  for(let q=0;q<28;q++){ const a=q/28*Math.PI*2; spawn(x+Math.cos(a)*r*0.9,0.15,z+Math.sin(a)*r*0.9,Math.cos(a)*0.6,0.4,Math.sin(a)*0.6,0.6,G(mpick(['*','.','+'])),0.14,1.2,1.7,2.2,0); } }
const expNeed=n=>n<=1?4:8+14*(n-2);
function expOf(m){ if(m.ty.dummy||m.ty.critter||m.ty.peaceful)return 0; return Math.min(60,(1+Math.floor(Math.sqrt(m.maxHp||10)/3))*(m.elite?3:1)*(m.key==='lord'||m.key==='final'?10:1)); }
function gainExp(e){ if(!(e>0)||dead)return; lvl.exp+=e; let up=0; while(lvl.exp>=expNeed(lvl.n)){ lvl.exp-=expNeed(lvl.n); lvl.n++; lvl.pending++; up++; }
  renderStatus(); if(up){ sChime(player.x,player.z,0.6); setTimeout(()=>sChime(player.x,player.z,0.45),180); for(let q=0;q<40;q++){ const a=mr()*6.28, r=1.6+mr(); spawn(player.x+Math.cos(a)*r,0.4+mr()*1.6,player.z+Math.sin(a)*r,-Math.cos(a)*r*2.2,0.2,-Math.sin(a)*r*2.2,0.45,G(mpick(['*','+','.'])),0.14,2.6,2.3,1.5,0); } } }
function levelChoices(){ const BEHAVE=['quickdodge','counter','momentum','devour','shatter','charge','swapedge','branch']; let pool=Object.keys(BLESS).filter(k=>BL(k)<2&&!lockedOf('bless',k)), out=[];
  if(!lvl.firstDone){ const b=pool.filter(k=>BEHAVE.includes(k)); if(b.length>=2)pool=b; lvl.firstDone=true; }
  for(let i=0;i<2&&pool.length;i++){ const k=pool.splice(Math.floor(mr()*pool.length),1)[0]; out.push({kind:'bless',k}); }
  const useCharm=(runState.bodyOpen||0)>0&&mr()<0.3, t=useCharm?RUNE_TYPES.body[Math.floor(mr()*RUNE_TYPES.body.length)]:randomRuneType(mr,{elem:0.45,trig:0.15,mod:0.4,body:0});
  out.push({kind:'rune',ru:RUNE_DEF[t].cat==='mod'&&mr()<0.1?makeStrong(t):makeRune(t,0)}); return out.sort(()=>mr()-0.5); }
function lvlLine(o){ const K=t=>t+'　'.repeat(Math.max(1,6-t.length));
  if(o.kind==='bless'){ const B=BLESS[o.k], l=BL(o.k)+1; return `${K(B.cost?'恩恵（代償）':'恩恵')}<span style="color:${B.cost?'#ff9a8a':'#ffe3a0'}">${B.name}${l>1?' Ⅱ':''}</span>`; }
  const d=RUNE_DEF[o.ru.type], br=CAT_BR[d.cat]||['','']; return `${K(d.cat==='body'?'護符':'ルーン')}${br[0]}<b class="rn" style="color:${css(runeCol(o.ru))}">${d.ch}</b> ${runeName(o.ru)}${br[1]}　<span class="lab">${CAT_NAME[d.cat]}</span>`; }
function renderLevelUp(){ const el=document.getElementById('altarp'); if(!el)return; const f=t=>`<span class="f">${t}</span>`, rows=[f(`+-- レベルが上がった（Lv${lvl.n-lvl.pending+1}） ---`),f('|')];
  lvlOpts.forEach((o,i)=>rows.push(`${f('|')}  <button class="row ao" data-lk="${i}">${clipHtml(lvlLine(o),ALTAR_W-6)}</button>`));
  rows.push(f('|')); for(let i=0;i<4;i++)rows.push(`${f('|')} <span class="ldet">${padTo('',ALTAR_W-3)}</span>`);
  rows.push(f('|'),`${f('|')} <span class="lab">マウスを乗せると説明が出る。クリックで選ぶ</span>`,f('+---')); el.innerHTML=boxText(rows,ALTAR_W); setLevelDetail(null);
  if(!el.dataset.lvBound){ el.dataset.lvBound='1'; el.addEventListener('mouseover',e=>{ if(!lvlOpen)return; const b=e.target.closest&&e.target.closest('button[data-lk]'); setLevelDetail(b?lvlOpts[+b.dataset.lk]:null); }); el.addEventListener('click',e=>{ if(!lvlOpen)return; const b=e.target.closest&&e.target.closest('button[data-lk]'); if(!b)return; e.stopPropagation(); if(performance.now()-lvlOpenT<400)return; chooseLevel(+b.dataset.lk); }); } }
function setLevelDetail(o){ const el=document.getElementById('altarp'); if(!el)return; let L;
  if(!o)L=['<span class="lab">選択肢にマウスを乗せると、ここに説明が出る</span>','','',''];
  else if(o.kind==='bless'){ const B=BLESS[o.k], l=BL(o.k)+1, w=wrapPlain(B.d(l),ALTAR_W-10); L=[`<span style="color:${B.cost?'#ff9a8a':'#ffe3a0'}">${B.name}${l>1?' Ⅱ（2回目で強まる）':''}</span>　<span class="lab">（恩恵${B.cost?'・代償あり':''}）</span>`,...w.slice(0,3).map(t=>`    <span class="lab">${t}</span>`)]; }
  else L=detailLines(o.ru).slice(0,4);
  el.querySelectorAll('.ldet').forEach((sp,i)=>{ sp.innerHTML=padTo(clipHtml(L[i]||'',ALTAR_W-4),ALTAR_W-3); }); }
function openLevelUp(){ const el=document.getElementById('altarp'); if(!el||lvlOpen)return; lvlOpen=true; lvlOpenT=performance.now(); lvlOpts=levelChoices(); document.body.classList.toggle('paused',true);
  if(castSt){ castSt=null; beamSegs=[]; } if(locked&&document.exitPointerLock)document.exitPointerLock(); renderLevelUp(); el.classList.add('show','open'); }
function chooseLevel(i){ const o=lvlOpts[i]; if(!o)return;
  if(o.kind==='bless'){ lvl.bless[o.k]=BL(o.k)+1; if(o.k==='tough'){ PLAYER_MAX+=6; player.hp=Math.min(PLAYER_MAX,player.hp+6); } msg(`<b style="color:#ffe3a0">+</b>恩恵「${BLESS[o.k].name}」を得た。${BLESS[o.k].d(BL(o.k))}。`); }
  else takeRune(o.ru);
  lvl.pending=Math.max(0,lvl.pending-1); renderStatus(); renderHotbar();
  if(lvl.pending>0){ lvlOpenT=performance.now(); lvlOpts=levelChoices(); renderLevelUp(); return; }
  lvlOpen=false; const el=document.getElementById('altarp'); if(el)el.classList.remove('show','open'); document.body.classList.toggle('paused',isPaused()); if(!plFailed&&started&&!dead)tryLock(); updateResume(); }
// a new stratum strengthens the body
function strataGrowth(){ if(!D||branch||realm||inter||!started||gallery)return; const k=D.stratum&&D.stratum.k; if(!['cavern','ruins','magma','abyss'].includes(k)||lvl.strata.has(k))return; lvl.strata.add(k); PLAYER_MAX+=4; player.hp=Math.min(PLAYER_MAX,player.hp+4); renderStatus();
  setTimeout(()=>msg('<b style="color:#ffd9a0">+</b>新しい層の空気が、体を強くした。最大体力 +4。'),2200); }
function hurtPlayer(n,cause){
  if(godMode)return; if((player.invulT||0)>time)return; if(BL('reckless'))n*=BL('reckless')>=2?1.35:1.25;
  n*=Math.max(0.4,1-0.15*bodyN('ward'));
  if(dead||!started||gallery||n<=0)return;
  player.hp-=n; player.lastHurt=time; { const mn=bodyN('mend'); player.rally=Math.min(Math.max(0,PLAYER_MAX-player.hp),(player.rally||0)+n*0.6); player.rallyRate=player.rally/Math.max(1,4*(1+0.5*mn)-0.6); } hurtFlash=Math.min(1.2,hurtFlash+0.35+n*0.05); shake=Math.max(shake,Math.min(0.5,0.12+n*0.03));
  if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sTone(t,'sine',140,60,0.25,sOut(undefined,undefined,0.35)),t,0.01,0.22); }
  if(time-(hurtPlayer.mt||-9)>0.8||hurtPlayer.mc!==cause){ hurtPlayer.mt=time; hurtPlayer.mc=cause; msg(`<b style="color:#ff5a4a">-</b>${cause}で ${n} の傷を負った。`); }
  if(player.hp<=0)player.hp=0;
  renderStatus();
  if(player.hp<=0)die(cause);
}
function resultPlace(){ const pl=placeLabel(); return /^[0-9]+$/.test(String(pl).trim())?`深度${depth}（${(D&&D.stratum&&D.stratum.name)||''}）`:`${pl}（深度${depth}）`; }
function runLore(victory){ const L=getLegend(), parts=[], add=(lab,n,v)=>{ if(v>0)parts.push([lab,n,v]); }, md=(runStats&&runStats.maxDepth)||depth;
  add('到達した深さ',`深度${md}`,md*2); const lords=runState.lordsDone?runState.lordsDone.size:0; add('倒した支道の主',`${lords}体`,lords*8);
  const pl=L?L.placed.size:0; add('捧げた伝説の物',`${pl}つ`,pl*6); if(victory)add('最後の王の影に勝った','',30);
  const lg=Math.max(0,(lvl.n||1)-1); add('上がったレベル',`${lg}つ`,lg);
  const nb=Math.max(0,BOOK.size-((runStats&&runStats.book0)||0)); add('新しく記した反応',`${nb}つ`,nb*3); const nbe=(runStats&&runStats.beastsNew)||0; add('初めて出会った忘れられた獣',`${nbe}体`,nbe*4);
  const base=parts.reduce((a,p)=>a+p[2],0), mult=1+0.25*runTrials.length; return {parts,base,mult,total:Math.round(base*mult)}; }
function awardLore(victory){ if(!runStats||gallery)return null; if(runStats.loreRes)return runStats.loreRes; const R=runLore(victory); META.lore=(META.lore||0)+R.total; saveMeta(); runStats.loreRes=R; return R; }
function loreRows(R,f){ if(!R)return []; const rows=[`${f('|')}  <b>伝承</b>`]; for(const [lab,n,v] of R.parts)rows.push(`${f('|')}    ${padTo(lab+(n?`（${n}）`:''),34)}${String(v).padStart(4)}`);
  if(R.mult>1)rows.push(`${f('|')}    ${padTo(`試練（${runTrials.map(k=>({dusk:'薄明',fury:'猛り'})[k]).join('・')}）`,34)}  ×${R.mult.toFixed(2)}`);
  rows.push(`${f('|')}    ${padTo('合計',34)}<b style="color:#ffe3a0">${String('+'+R.total).padStart(4)}</b>`, `${f('|')}    <span class="lab">累計 ${META.lore}　　使える伝承 ${loreLeft()}</span>`);
  if(UNLOCKS.some(u=>!unlocked(u.id)&&u.cost<=loreLeft()))rows.push(`${f('|')}    <span style="color:#ffe3a0">解放できるものがある（タイトルの［解放］から）</span>`);
  else { const nx=UNLOCKS.filter(u=>!unlocked(u.id)).sort((a,b)=>a.cost-b.cost)[0]; if(nx)rows.push(`${f('|')}    <span class="lab">次の解放まで あと ${nx.cost-loreLeft()}（${nx.name} ${nx.cost}）</span>`); } return rows; }
// the grave: what the fallen adventurer leaves (one thing, chosen on the results screen)
let graveSel=0, graveCands=[];
const serRune=ru=>({type:ru.type,strong:!!ru.strong,traits:(ru.traits||[]).map(t=>({k:t.k,lv:t.lv}))});
function graveRune(g){ const ru=makeRune(g.type,0); ru.strong=false; if(g.traits&&g.traits.length)ru.traits=g.traits.map(t=>({k:t.k,lv:t.lv-1})).filter(t=>t.lv>0); return ru; }
function graveCandidates(){ const out=[], seen=new Set(), add=ru=>{ if(ru&&!seen.has(ru)){ seen.add(ru); out.push(ru); } };
  add(hands.L.atk); add(hands.R.atk); for(const h of ['L','R'])for(const r of hands[h].slots)add(r); if(hands.B){ add(hands.B.b0); add(hands.B.b1); } for(const r of bag)add(r); return out.slice(0,10); }
function saveGrave(){ if(won||!graveCands)return; const ru=graveSel>0?graveCands[graveSel-1]:null; META.grave=ru?{k:(STRATA.find(st=>depth>=st.from&&depth<=st.to)||{}).k||'',depth,cause:runStats.cause||'',item:serRune(ru)}:null; saveMeta(); graveCands=[]; }
function graveRows(f){ const rows=[`${f('|')}  <b>墓に遺すもの</b>　<span class="lab">（ひとつ選ぶ。次の冒険で、同じ深さに墓が現れる）</span>`];
  const opt=(i,label)=>`${f('|')}    <button class="row gv" data-gv="${i}"><span class="mk">${graveSel===i?'&gt;':' '}</span> ${label}</button>`;
  rows.push(opt(0,'<span class="lab">遺さない</span>')); graveCands.forEach((ru,i)=>rows.push(opt(i+1,clipHtml(thingLabel(ru),48)))); return rows; }
function die(cause){
  if(won)return;
  dead=true; keys.KeyW=keys.KeyA=keys.KeyS=keys.KeyD=false;
  const el=document.getElementById('death'); if(!el)return;
  const secs=Math.floor(time-runStats.t0), mm=Math.floor(secs/60), ss=String(secs%60).padStart(2,'0');
  const f=t=>`<span class="f">${t}</span>`;
  runStats.cause=cause; const R=awardLore(false); graveCands=gallery?[]:graveCandidates(); graveSel=0; if(locked&&document.exitPointerLock)document.exitPointerLock();
  const draw=()=>{ el.innerHTML=boxText([f('+-- あ な た は 死 ん だ ---'),f('|'),`${f('|')}  死因      ${cause}`,`${f('|')}  場所      ${resultPlace()}`,
    `${f('|')}  Lv${lvl.n}　倒した敵 ${runStats.kills}　時間 ${mm}:${ss}`,f('|'),...loreRows(R,f),f('|'),...(graveCands.length?[...graveRows(f),f('|')]:[]),`${f('|')}  ${HIST?HIST.civ.name+'の地に、またひとつ灯りが消えた。':''}`,f('|'),`${f('|')}  <button class="row" id="newRunB"><b>[Enter]</b> 新しい冒険へ</button>`,f('+---')],64); };
  document.body.classList.add('over'); draw(); el.onclick=e=>{ const b=e.target.closest&&e.target.closest('button'); if(!b)return; if(b.dataset.gv!==undefined){ graveSel=+b.dataset.gv; draw(); } else if(b.id==='newRunB')newRun(); };
  el.classList.add('show'); sRumble(0.6,2.5);
}
function newRun(){
  saveGrave(); document.body.classList.remove('over');
  const el=document.getElementById('death'); if(el)el.classList.remove('show','won');
  dead=false; runSeed=(Math.random()*1e9)>>>0; depth=1; branch=null; realm=null; placeMem.clear(); arrive=null;
  PLAYER_MAX=40; lvl={n:1,exp:0,pending:0,bless:{},strata:new Set()}; runTrials=(META.trials||[]).filter(k=>unlocked('t_'+k)); player.hp=PLAYER_MAX; runStats={kills:0,t0:time,maxDepth:depth,book0:BOOK.size,beastsNew:0}; resetRunes(); newLevel();
}
function hitReact(m,n){ const ty=m.ty, boss=ty.boss||m.key==='lord'||m.key==='final', now=performance.now();
  m.flinchUntil=time+Math.min(0.26,0.08+n*0.015);
  if(!boss&&!ty.habitat&&!['shroom','kraken','deepkraken'].includes(ty.form)){ const heavy=['O','T','Y','B','D','X'].includes(m.key)||ty.beast?2.5:1, w=Math.max(0.3,(ty.scale||1)*(ty.scale||1)*heavy), v=Math.min(6,n*0.9/w);
    const ak={blade:1.0,bolt:0.45,orb:0.75,beam:0.12,bare:0.6}[m.lastAtk]||0.6, vv=v*0.5*ak*(m.lastKnock||1), src=(m.lastAtk==='orb'&&hitSrcPoint)?hitSrcPoint:[player.x,player.z];
    if(vv>0.3){ const dx=m.x-src[0], dz=m.z-src[1], d=Math.hypot(dx,dz)||1; m.kx=(m.kx||0)+dx/d*vv; m.kz=(m.kz||0)+dz/d*vv; m.st=m.st||{}; } }
  if(m.wind>0&&!boss&&(n>=6||n>=(m.maxHp||99)*0.2)){ m.wind=0; m.atkCd=Math.max(m.atkCd||0,0.8); const cy=m.y+1.2*(ty.scale||1); for(let q=0;q<8;q++){ const a=mr()*6.28; spawn(m.x,cy,m.z,Math.cos(a)*1.6,0.4+mr(),Math.sin(a)*1.6,0.35,G(mpick(['!','\'','.'])),0.14,2.4,1.4,0.6,0); } }
  const strong=m.hp<=0||n>=8||n>=(m.maxHp||99)*0.25; if(strong&&now>hitStopUntil+90)hitStopUntil=now+(m.hp<=0?65:45); }
function damageMonster(m,n,how){
  if(m.dead||n<=0)return;
  if(m.key==='final'&&(!finalExposed(m)||m.invulnT>0)){ if(how!=='env')hitFeedback(m,0,null,false); return; }
  if(m.sleep&&how!=='env'){ n*=SLEEP_MULT;
    // a hit on a sleeper: a bright gold burst and a deep strike sound instead of words
    for(let q=0;q<22;q++){ const a=mr()*6.28, e=mr()*1.2; spawn(m.x,m.y+0.6*m.ty.scale,m.z,Math.cos(a)*2.4,0.8+e*1.6,Math.sin(a)*2.4,0.6+mr()*0.5,G(mpick(['*','+','\''])),0.2,3.4,2.6,1.0,0); }
    shake=Math.max(shake,0.18);
    if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sTone(t,'square',180,60,0.18,sOut(m.x,m.z,0.35)),t,0.005,0.25); } }
  if(m.ty.dummy){ m.dsum=(m.dsum||0)+n; m.dT=2; }
  m.hp-=n; m.hitT=0.22; m.sleep=false; if(m.hidden)m.revealNow=true; rallyOnHit(m,n,how); if(how!=='env'&&time-(m.playerT||-99)<0.05)hitReact(m,n);
  if(!m.noticed&&hostile(m)){ m.aware=1.25; onNoticed(m); }
  for(let q=0;q<10;q++){ const a=mr()*6.28; spawn(m.x,m.y+0.6*m.ty.scale+mr()*0.4,m.z,Math.cos(a)*1.4,0.6+mr()*1.2,Math.sin(a)*1.4,0.5+mr()*0.3,G(mpick(['*','+','.'])),0.14,2.2,1.9,1.6,0); }
  if(m.hp<=0){ m.dead=true; runStats.kills++; lordFell(m); if(m.key==='final')setTimeout(victory,1800); if(how!=='env'){ dropRune(m); onKilledBy(m); }
    if(time-(m.playerT||-99)<6)gainExp(expOf(m)); if(BL('momentum')&&time-(m.playerT||-99)<1)player.momUntil=time+3; if(BL('shatter')&&m.st&&m.st.chill>0&&time-(m.playerT||-99)<0.1)coldSnap(m.x,m.z,BL('shatter')>=2?3.5:2.5);
    for(const p of m.form){ if(mr()<0.6)continue; const a=mr()*6.28; spawn(m.x+p.x*m.ty.scale,m.y+p.y*m.ty.scale,m.z+p.z*m.ty.scale,Math.cos(a)*1.2,0.3+mr()*1.5,Math.sin(a)*1.2,0.8+mr()*0.8,p.g,0.18,m.ty.col[0]*1.6,m.ty.col[1]*1.6,m.ty.col[2]*1.6,0); }
    if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sTone(t,'triangle',300,90,0.4,sOut(m.x,m.z,0.3)),t,0.01,0.35); }
    msg(`<b style="color:${css(m.ty.col)}">${m.ty.ch}</b>${mname(m)}を倒した。${how==='fire'?'炎に巻かれて崩れ落ちた。':''}`);
  }
}
function playerAttack(){
  if(dead||!started||trans||(player.atkCd||0)>0||player.netT>0)return;
  player.atkCd=WEAPON.cd; player.swing=0.22; sWhoosh();
  let best=null, bd=1e9; const [vx,vy,vz]=viewDir(), [ox,oy,oz]=aimOrigin();
  for(const m of monsters){ if(m.dead||m.ty.peaceful||(m.ty.critter&&!m.hidden&&m.ty.critter!=='mimic'))continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; if(m.ty.habitat==='bog'&&(m.rise||0)<0.3)continue;
    const sc=m.ty.scale, cy=m.hidden?m.y+1.3:m.y+(m.ty.flier?0:0.6*sc), ax=m.x-ox, ay=cy-oy, az=m.z-oz, d=Math.hypot(ax,ay,az);
    if(Math.hypot(m.x-player.x,m.z-player.z)>WEAPON.reach+0.35*sc)continue;
    const cosA=(ax*vx+ay*vy+az*vz)/Math.max(d,1e-3), tol=0.42+Math.atan2(0.5*sc,Math.max(d,0.5));
    const ang=Math.acos(clamp(cosA,-1,1)); if(ang>tol)continue; if(ang<bd){bd=ang;best=m;} }
  if(!best)return;
  best.playerT=time; damageMonster(best,roll(WEAPON.min,WEAPON.max),'blade');
}
function updateLife(dt){
  if(dead)return;
  player.atkCd=Math.max(0,(player.atkCd||0)-dt); player.swing=Math.max(0,(player.swing||0)-dt);
  updateRally(dt);
  if(Math.round(player.hp)!==hpShown){ hpShown=Math.round(player.hp); renderStatus(); }
  hurtFlash=Math.max(0,hurtFlash-dt*1.6);
  // fire hurts whoever stands in it
  const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL);
  player.fireT=(player.fireT||0)+dt; if(player.fireT>0.5){ player.fireT=0; if(fire[pc]>0.1)hurtPlayer(2,'炎');
    for(const m of monsters){ if(m.dead||m.ty.critter||m.ty.habitat==='lava')continue; const ci=m.cz*MW+m.cx; if(fire[ci]>0.1&&!m.ty.flier)damageMonster(m,3,'fire'); } }
}
function monsterStrike(m,dt,dp){
  if(!hostile(m)||!m.noticed||m.sleep||dead)return;
  if(m.ty.form==='eel'&&!(m.surf>0))return; if((m.ty.habitat==='deep'||m.ty.habitat==='bog')&&(m.rise||0)<0.5)return;
  const st=statOf(m), reach=(m.ty.habitat==='deep'?3.2:0.95+0.45*m.ty.scale);
  m.atkCd-=dt;
  if(m.wind>0){ m.wind-=dt; if(m.wind<=0){ m.atkCd=st[3]; if(dp<reach+0.35){ if(player.roll){ onDodged(m); if(time-(monsterStrike.mt||-9)>2){ monsterStrike.mt=time; msg(`<b style="color:#9fe0ff">~</b>転がって${mname(m)}の攻撃をかわした！`); } } else hurtPlayer(roll(st[1],st[2]),m.ty.name); } } }
  else if(dp<reach&&m.atkCd<=0&&st[2]>0){ m.wind=0.55; }
}
// the blade swing in front of the camera
// ---------------------------------------------------------------- the weapons in hand: drawn in glyphs as if held, entering from the lower edges of the view and cut off by them;
// near parts large, far parts small; filled shapes with bright rims; a hand where a hand would be (a fist on a hilt or shaft, the bow hand and the drawing hand,
// two hands on a two-handed weapon, an open hand when bare). Long weapons show only their upper part. Near a wall the picture shrinks toward the eye.
const VM_ST=0.022;
// the glyph for a stroke going this way on screen
const vmGlyphS=(A,B)=>vmGlyph(B[0]/B[2]-A[0]/A[2],B[1]/B[2]-A[1]/A[2]);
const vmGlyph=(dx,dy)=>{ const a=Math.atan2(dy,dx); let d=((a*180/Math.PI)+360)%180; return d<22.5||d>=157.5?'-':d<67.5?'/':d<112.5?'|':'\\'; };
const VM_K=1.95;
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
const VM_MIRROR={'/':'\\','\\':'/','(':')',')':'(','<':'>','>':'<'};
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
const RUNE_FONT='"Noto Sans Runic","Segoe UI Historic","Segoe UI Symbol",FreeMono,Unifont,serif';
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
const TRAIT_V={count:[0,1,1,2,2,3],pierce:[0,1,1,2,3,3],bounce:[0,1,2,2,3,3],homing:[0,10,15,20,25,30],range:[1,1.2,1.35,1.5,1.65,1.8],speed:[1,1.15,1.25,1.35,1.45,1.6],
  width:[0,0.15,0.25,0.35,0.45,0.6],knock:[1,1.5,1.8,2.1,2.4,2.8],stagger:[0,0.3,0.45,0.6,0.75,0.9],charge:[1,0.9,0.82,0.75,0.68,0.6],length:[1,1.2,1.35,1.5,1.65,1.8],focus:[0,0.2,0.4,0.6,0.8,1.0],
  size:[1,1.15,1.3,1.45,1.6,1.8],pull:[0,2.5,3,3.5,4,4.5],fall:[1,0.85,0.75,0.65,0.55,0.45],stride:[0,0.6,1.0,1.4,1.8,2.2],link:[1,0.85,0.75,0.65,0.55,0.45],after:[0,1,1,2,2,3],area:[1,1.15,1.3,1.45,1.6,1.8],span:[1,1.25,1.5,1.75,2,2.3],accuracy:[0,1,2,3,4,5]};
const pct=v=>Math.round((v-1)*100);
const TD={ count:(lv,what)=>`${what}が ${TRAIT_V.count[lv]} つ増える`, pierce:lv=>`敵を ${TRAIT_V.pierce[lv]} 体貫く`, bounce:lv=>`壁で ${TRAIT_V.bounce[lv]} 回跳ねる`, homing:lv=>`飛びながら敵の方へ曲がる（${TRAIT_V.homing[lv]}度）`,
  range:lv=>`${pct(TRAIT_V.range[lv])}% 遠くまで飛ぶ`, speed:lv=>`${pct(TRAIT_V.speed[lv])}% 速く飛ぶ`, width:lv=>`当たる幅が ${Math.round(TRAIT_V.width[lv]*100)}cm 広がる`, knock:lv=>`当たった敵を、${TRAIT_V.knock[lv]}倍の強さで押し返す`,
  stagger:lv=>`当たった敵の攻撃の構えを、${Math.round(TRAIT_V.stagger[lv]*100)}% で崩す`, charge:lv=>`詠唱が ${Math.round((1-TRAIT_V.charge[lv])*100)}% 速い`, length:lv=>`帯が ${pct(TRAIT_V.length[lv])}% 長く届く`, focus:lv=>`照らし続けるほど強まる（最大 +${Math.round(TRAIT_V.focus[lv]*100)}%）`,
  size:lv=>`${pct(TRAIT_V.size[lv])}% 大きい`, pull:lv=>`周りの敵を引き寄せる（${TRAIT_V.pull[lv]}m）`, fall:lv=>`降るまでが ${Math.round((1-TRAIT_V.fall[lv])*100)}% 短い`, stride:lv=>`駆ける距離が ${TRAIT_V.stride[lv]}m 伸びる`,
  link:lv=>`次に駆けるまでの間が ${Math.round((1-TRAIT_V.link[lv])*100)}% 短い`, after:lv=>`駆けた跡に、刃の残像が ${TRAIT_V.after[lv]} つ残って当たる`, area:lv=>`雨の範囲が ${pct(TRAIT_V.area[lv])}% 広い`, span:lv=>`雨が ${pct(TRAIT_V.span[lv])}% 長く降る`, accuracy:lv=>`ばらつきが小さく、少し敵へ曲がる` };
const TR=(k,name,what)=>({name,d:lv=>TD[k](lv,what)});
const TRAITS={
  blade: {count:TR('count','数','風の刃'),range:TR('range','飛距離'),width:TR('width','刃の幅'),knock:TR('knock','押し返し')},
  dash:  {stride:TR('stride','駆ける距離'),link:TR('link','駆ける間'),after:TR('after','残像'),range:TR('range','突きの飛距離')},
  gsword:{width:TR('width','刃の幅'),charge:TR('charge','溜めの速さ'),knock:TR('knock','押し返し'),stagger:TR('stagger','よろめき')},
  bolt:  {count:TR('count','数','矢'),pierce:TR('pierce','貫き'),homing:TR('homing','ホーミング'),speed:TR('speed','矢の速さ')},
  rain:  {area:TR('area','雨の広さ'),charge:TR('charge','引きの速さ'),span:TR('span','降る長さ'),count:TR('count','数','矢')},
  rapid: {count:TR('count','数','矢'),accuracy:TR('accuracy','精密'),charge:TR('charge','装填の速さ'),knock:TR('knock','押し返し')},
  orb:   {count:TR('count','数','弾'),bounce:TR('bounce','跳ね返り'),speed:TR('speed','弾の速さ'),knock:TR('knock','押し返し')},
  beam:  {length:TR('length','帯の長さ'),bounce:TR('bounce','跳ね返り'),focus:TR('focus','収束')},
  star:  {count:TR('count','数','光の柱'),size:TR('size','柱の大きさ'),fall:TR('fall','降る速さ'),pull:TR('pull','引き寄せ')},
  mstaff:{charge:TR('charge','満ちる速さ'),size:TR('size','月の大きさ'),pull:TR('pull','潮'),count:TR('count','数','光の弾')} };
const trName=(w,t)=>(TRAITS[w]&&TRAITS[w][t.k])?TRAITS[w][t.k].name:t.k;
// what a trait does at its level: its first or third step, and the fifth when reached
const trDesc=(w,t)=>{ const T=TRAITS[w]&&TRAITS[w][t.k]; return T?T.d(t.lv):''; };
const tv=(sp,k)=>TRAIT_V[k][TL(sp,k)];
const wTL=(h,k)=>{ const H=effHand(h); for(const t of trList(H.atk))if(t.k===k)return t.lv; return 0; };
const trList=ru=>(ru&&ru.traits)||[];
const weaponCol=ru=>{ const tr=trList(ru); if(!tr.length)return ''; return tr.some(t=>t.lv>=5)||ru.named?css(TIER_COL[3]):'#9fdcf0'; };
const TL=(sp,k)=>(sp&&sp.tr&&sp.tr[k])||0;
// a found weapon may carry 0-2 of its own traits; deeper, treasuries and the strong give higher levels
const WEAPON_SIG=t=>Object.keys(TRAITS[t]||{}).slice(0,2);
function rollTraits(ru,r,d,bonus){ if(!ru||RUNE_DEF[ru.type].cat!=='atk'||!TRAITS[ru.type])return ru; const tier=Math.min(4,clamp(Math.floor(((d||1)-1)/3),0,3)+(bonus||0));
  ru.traits=tier>0?WEAPON_SIG(ru.type).map(k=>({k,lv:tier})):[]; return ru; }
const RUNE_TYPES={atk:['blade','bolt','orb','beam','dash','rain','rapid','star','gsword','mstaff'], elem:['fire','ice','thunder','poison'], trig:['dodge','kill'], mod:['m_chain','m_area','m_dur'], body:['swift','roll','quick','lamp','mend','linger','hush','ward']};
const AFFIX={
  count: {name:'弾数',       roll:r=>1+(r()<0.3?1:0),          fmt:v=>`弾数 +${v}`},
  bounce:{name:'跳ね返り',   roll:r=>1+Math.floor(r()*3),       fmt:v=>`跳ね返り +${v}`},
  homing:{name:'ホーミング', roll:r=>20+Math.floor(r()*5)*10,   fmt:v=>`ホーミング +${v}度`},
  chain: {name:'連鎖',       roll:r=>1+(r()<0.35?1:0),          fmt:v=>`連鎖 +${v}`},
  area:  {name:'範囲',       roll:r=>25+Math.floor(r()*8)*5,    fmt:v=>`範囲 +${v}%`},
  dur:   {name:'持続',       roll:r=>30+Math.floor(r()*6)*10,   fmt:v=>`持続 +${v}%`},
};
const TIER_COL=[[0.9,0.9,0.95],[0.45,0.72,1.0],[0.45,1.0,0.55],[1.0,0.82,0.3]];
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
const REACT={
  steam:    {name:'蒸気',     pair:'火 × 氷', desc:'凍えたものを焼くと、蒸気が噴き出して周りを巻き込む'},
  blast:    {name:'爆炎',     pair:'火 × 毒', desc:'毒に蝕まれたものに火をつけると、弾けて燃え広がる'},
  overload: {name:'過熱',     pair:'火 × 雷', desc:'燃えるものと雷が重なると、周りを吹き飛ばす'},
  shatter:  {name:'砕氷',     pair:'氷 × 雷', desc:'凍えたものに雷を落とすと、氷ごと砕ける'},
  frostbite:{name:'凍える毒', pair:'氷 × 毒', desc:'凍えと毒が重なると、毒が長く深く残る'},
  contagion:{name:'毒の伝播', pair:'雷 × 毒', desc:'毒に蝕まれたものに雷が走ると、毒が周りへ移る'},
};
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
const SLOT_MAX=4;
function newHand(w){ return {atk:makeRune(w,0),slots:[null,null],slotN:2,turn:0,elem:null,trig:null}; }
const handRunes=H=>(H.slots||[]).slice(0,H.slotN||2).filter(Boolean);
// the element to be cast next (two different elements take turns) and the hand's trigger
function syncHand(H){ const rs=handRunes(H), els=[...new Set(rs.filter(r=>RUNE_DEF[r.type].cat==='elem').map(r=>r.type))]; const et=els.length?els[(H.turn||0)%els.length]:null; H.elem=et?rs.find(r=>r.type===et):null; H.trig=rs.find(r=>RUNE_DEF[r.type].cat==='trig')||null; }
const TWO_SLOTS=6;
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
// the same element twice or more in one hand resonates
const ELEM_POW=[1,1,1.4,1.7,1.9];
const elemCount=(H,el)=>handRunes(H).filter(r=>r.type===el).length;
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

// ---------------------------------------------------------------- chanting: hold to chant, release to cast; the world slows while you chant
let beamRun=null;
let hitStopUntil=0;
const timeScale=()=>performance.now()<hitStopUntil?0.05:(castSt?0.5:1);
function beginCast(h){
  if(dead||trans||!started||isPaused()||swapSt||castSt||(beamRun&&!beamRun.auto)||player.netT>0||player.roll)return;
  if((player.recover||0)>0)return;
  const H=hands[h]; if(!H.atk){ castNow(h); return; }
  const at=atkType(h), def=RUNE_DEF[at]; if(def.chant<=0){ castNow(h); return; }
  let needK=1; if(time<(player.qcUntil||0)){ needK*=0.5; player.qcUntil=0; } if(BL('desperate')&&player.hp<PLAYER_MAX*0.5)needK*=BL('desperate')>=2?0.55:0.7;
  castSt={h,t:0,need:def.chant*Math.max(0.4,1-0.3*bodyN('quick'))*TRAIT_V.charge[wTL(h,'charge')]*needK,full:false,hold:0,beam:at==='beam',firing:false,tick:0,beamT:0};
  if(humNode)humNode.stop(); humNode=chantStart(H.elem?H.elem.type:null);
}
function fizzle(){ const [ox,oy,oz]=aimOrigin(), [dx,dy,dz]=viewDir(); for(let q=0;q<8;q++){ const a=mr()*6.28; spawn(ox+dx*0.7,oy-0.3+dy*0.7,oz+dz*0.7,Math.cos(a)*0.6,0.2+mr()*0.4,Math.sin(a)*0.6,0.5,G(mpick(['.','\''])),0.1,0.6,0.55,0.75,0); } }
function releaseCast(h){
  if(!castSt||castSt.h!==h)return;
  const c=castSt; castSt=null;
  if(c.full)castNow(h,{chanted:true,hold:c.hold}); else fizzle();
}
function updateCast(dt){
  if(!castSt&&humNode){ humNode.stop(); humNode=null; }
  if(beamRun){ beamRun.t-=dt; beamRun.tick-=dt; if(beamRun.tick<=0){ beamRun.tick=0.15; fireBeam(beamRun.h,beamRun.dir,beamRun.dir?handPoint(beamRun.h):null,beamRun.auto); } if(beamRun.t<=0){ turnElem(beamRun.h); beamRun=null; beamSegs=[]; } }
  trigCd.L=Math.max(0,trigCd.L-dt); trigCd.R=Math.max(0,trigCd.R-dt); player.recover=Math.max(0,(player.recover||0)-dt);
  if(swapSt){ swapSt.t+=dt; if(swapSt.t>=swapSt.dur){ swapSt=null; if(BL('swapedge'))player.swapEdgeUntil=time+3; sChime(player.x,player.z,0.25); renderHotbar(); } else if(((swapSt.t*10)|0)!==swapSt.last){ swapSt.last=(swapSt.t*10)|0; renderHotbar(); } }
  if(!castSt)return;
  if(!started||dead||trans){ castSt=null; beamSegs=[]; return; }
  castSt.t+=dt;
  if(!castSt.full&&castSt.t>=castSt.need){ castSt.full=true;
    const P=castPoint(castSt.h,1), c=elemCol(hands[castSt.h].elem?hands[castSt.h].elem.type:null); for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(P[0],P[1],P[2],Math.cos(a)*1.2,(mr()-0.4)*1.2,Math.sin(a)*1.2,0.35,G('*'),0.05,c[0]*3,c[1]*3,c[2]*3,0); } }
  if(humNode&&humNode.tick)humNode.tick(Math.min(1,castSt.t/Math.max(0.01,castSt.need)),castSt.full);
  if(castSt.full){ castSt.hold+=dt; if(castSt.hold>2){ const hh=castSt.h; castSt=null; castNow(hh,{chanted:true,hold:2}); } }
  if(((time*10)|0)!==updateCast.last){ updateCast.last=(time*10)|0; renderHotbar(); }
}
function castNow(h,opt){
  opt=opt||{}; const sp=specOf(h); if(BL('charge')&&(opt.hold||0)>0.35)sp.powK=BL('charge')>=2?1.5:1.3; vmKick[h]=time; if(isTwo())vmKick.R=time; if(sp.atk!=='beam')turnElem(h); const _sp0=sp, fr=shotFrame(h,!!opt.chanted,specOf(h).atk), dir=opt.dir||fr.d, col=elemCol(sp.elem), HP=opt.dir?handPoint(h):fr.o;
  if(!opt.auto)player.recover=Math.max(player.recover||0,sp.atk==='bare'?0.5:RUNE_DEF[sp.atk].rec);
  if(sp.atk==='blade'||sp.atk==='bare'){ meleeCast(sp,opt.dir||viewDir()); return; }
  if(sp.atk==='dash'){ dashCast(sp,opt.dir||viewDir(),!!opt.auto); return; }
  if(sp.atk==='gsweep'){ meleeCast(sp,opt.dir||viewDir()); return; }
  if(sp.atk==='gwave'){ castSound(sp); makeNoise(player.x,player.z,6,0.4); const ec=TL(sp,'echo'), n=1+(sp.aff.count||0), dmg=RUNE_DEF.gwave.dmg, fire=(dK,big)=>{ for(let k=0;k<n;k++){ const d=turnDir(dir,(k-(n-1)/2)*0.14); projs.push({kind:'bolt',wind:true,big,wave:true,cw:big?2.6:1.8,rad:big?0.74:0.34,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*10,vy:d[1]*10,vz:d[2]*10,accel:30,vmax:26,t:0,maxT:1.0,sp,bounce:0,homing:0,hit:new Set(),dmg,dmgK:dK,pierce:ec>=5?99:6,keep:true}); } sWhoosh(); };
    fire(1,true); if(ec){ const k=ec>=4?0.8:ec>=2?0.65:0.5; later(0.3,()=>fire(k,false)); if(ec>=3)later(0.6,()=>fire(k,false)); } return; }
  if(sp.atk==='bpower'||sp.atk==='rshot'){ castSound(sp); makeNoise(player.x,player.z,5,0.3); const n=1+(sp.aff.count||0), pw=sp.atk==='bpower', v=(pw?28:24)*tv(sp,'speed');
    for(let k=0;k<n;k++){ const d=turnDir(dir,(k-(n-1)/2)*0.1); projs.push({kind:'bolt',auto:!!opt.auto,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*v,vy:d[1]*v,vz:d[2]*v,t:0,sp,bounce:sp.aff.bounce||0,homing:sp.aff.homing||0,hit:new Set(),dmg:RUNE_DEF[sp.atk].dmg,...(pw?{pierce:2+[0,1,1,2,3,3][TL(sp,'pierce')],keep:true}:{})}); } return; }
  if(sp.atk==='mshot'){ castSound(sp); const n=1+(sp.aff.count||0); for(let k=0;k<n;k++){ const d=turnDir(dir,(k-(n-1)/2)*0.1); projs.push({kind:'bolt',x:HP[0],y:HP[1],z:HP[2],vx:d[0]*18,vy:d[1]*18,vz:d[2]*18,t:0,sp,bounce:sp.aff.bounce||0,homing:sp.aff.homing||0,hit:new Set(),dmg:RUNE_DEF.mshot.dmg,pierce:0,dust:TL(sp,'stardust')}); } return; }
  if(sp.atk==='mmoon'){ castSound(sp); makeNoise(player.x,player.z,6,0.4); const ph=0, k=clamp((opt.hold||0)/(2*tv(sp,'charge')),0,1), f=1+k*2*tv(sp,'size'), n=1+(sp.aff.count||0);
    for(let i=0;i<n;i++){ const d=turnDir(dir,(i-(n-1)/2)*0.2); projs.push({kind:'orb',noGrav:true,moon:f,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*9,vy:d[1]*9,vz:d[2]*9,t:0,sp,bounce:0,homing:0,hit:new Set(),tide:TL(sp,'pull'),phases:0,burnT:0}); } return; }
  if(sp.atk==='rain'||sp.atk==='star'){ castSound(sp); makeNoise(player.x,player.z,5,0.3); const tp=opt.dir?groundPoint(handPoint(h),opt.dir,16):groundPoint(aimOrigin(),viewDir(),22); if(sp.atk==='rain')startRain(sp,tp[0],tp[1]); else castStar(sp,tp[0],tp[1]); return; }
  if(sp.atk==='rapid'){ castSound(sp); makeNoise(player.x,player.z,5,0.3); castRapid(h,sp,opt); return; }
  castSound(sp); makeNoise(player.x,player.z,5,0.3);
  if(sp.atk==='bolt'){ const n=1+(sp.aff.count||0);
    for(let k=0;k<n;k++){ const off=(k-(n-1)/2)*0.11, d=turnDir(dir,off);
      const v=20*tv(sp,'speed'); projs.push({kind:'bolt',auto:!!opt.auto,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*v,vy:d[1]*v,vz:d[2]*v,t:0,sp,bounce:sp.aff.bounce||0,homing:sp.aff.homing||0,hit:new Set()}); } }
  else if(sp.atk==='orb'){ const n=1+(sp.aff.count||0);
    for(let k=0;k<n;k++){ const off=(k-(n-1)/2)*0.16, d=turnDir(dir,off);
      const v=12*tv(sp,'speed'); projs.push({kind:'orb',auto:!!opt.auto,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*v,vy:d[1]*v+2.6,vz:d[2]*v,t:0,sp,bounce:sp.aff.bounce||0,homing:sp.aff.homing||0,hit:new Set()}); } }
  else if(sp.atk==='beam'){ fireBeam(h,opt.dir||null,opt.dir?HP:null,!!opt.auto); beamRun={h,t:opt.auto?0.5:1.5,tick:0.15,auto:!!opt.auto,dir:opt.dir||null}; if(!opt.auto)player.recover=Math.max(player.recover||0,1.6); }
}
function turnDir(d,a){ const c=Math.cos(a), s=Math.sin(a); return [d[0]*c-d[2]*s,d[1],d[0]*s+d[2]*c]; }
// the rapier: a dash that cuts through
function dashCast(sp,dir,auto){ const hx=dir[0], hz=dir[2], l=Math.hypot(hx,hz)||1, dist=3+TRAIT_V.stride[TL(sp,'stride')], dur=0.2, x0=player.x, z0=player.z, af=TRAIT_V.after[TL(sp,'after')];
  player.swingH=sp.h; player.swing=0.22; player.swingCol=elemCol(sp.elem); sWhoosh();
  player.lunge={t:0,dur,dx:hx/l,dz:hz/l,sp:dist/dur,cut:{sp,hit:new Set(),w:1.0,dK:1,link:false}};
  if(!auto)player.recover=RUNE_DEF.dash.rec*TRAIT_V.link[TL(sp,'link')];
  later(dur,()=>{ const HP=handPoint(sp.h||'R'), d=viewDir(), dm=RUNE_DEF.dash.dmg, n=1+(sp.aff.count||0); for(let i=0;i<n;i++){ const dd=turnDir(d,(i-(n-1)/2)*0.1); projs.push({kind:'bolt',wind:true,x:HP[0],y:HP[1],z:HP[2],vx:dd[0]*22,vy:dd[1]*22,vz:dd[2]*22,t:0,maxT:0.36*tv(sp,'range'),sp,bounce:0,homing:0,hit:new Set(player.lunge&&player.lunge.cut?player.lunge.cut.hit:[]),dmg:[Math.max(1,Math.round(dm[0]*0.7)),Math.max(1,Math.round(dm[1]*0.7))],pierce:2,keep:true,rad:0.05,thrust:true}); } });
  if(af){ later(dur,()=>{ const x1=player.x, z1=player.z; for(let i=0;i<af;i++){ const f=(i+1)/(af+1), ax=x0+(x1-x0)*f, az=z0+(z1-z0)*f;
      for(let q=0;q<8;q++)spawn(ax+(mr()-0.5)*0.4,0.6+mr()*1.0,az+(mr()-0.5)*0.4,0,0.1,0,0.5,G(mpick([')','(','|'])),0.16,...elemCol(sp.elem).map(v=>v*1.6),0);
      later(0.35,()=>{ for(const m of monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-ax,m.z-az)<1.0+0.3*m.ty.scale){ m.playerT=time; applyHit(m,Math.max(1,Math.round(roll(RUNE_DEF.dash.dmg[0],RUNE_DEF.dash.dmg[1])*0.55)),sp,true); } } }); } }); } }
function dashCuts(){ const L=player.lunge, c=L&&L.cut; if(!c)return; const dm=RUNE_DEF.dash.dmg;
  for(const m of monsters){ if(!hittable(m)||c.hit.has(m))continue; if(Math.hypot(m.x-player.x,m.z-player.z)<c.w+0.35*m.ty.scale){ c.hit.add(m); m.playerT=time; applyHit(m,Math.max(1,Math.round(roll(dm[0],dm[1])*c.dK)),c.sp); if(c.link)player.recover=Math.min(player.recover||0,0.05); } } }
// the longbow: a rain of arrows over the aimed place
function startRain(sp,x,z,again){ const de=0, n=8+3*(sp.aff.count||0), r=1.8*tv(sp,'area'), span=0.6*tv(sp,'span');
  rains.push({x,z,r,n,left:n,iv:span/n,tick:again?0:0.45,sp,follow:false,elemK:0.25,again:!!again}); marks.push({x,z,r,t:(again?0:0.45)+span,c:elemCol(sp.elem)});
  if(de>=3&&!again)later(0.45+span+0.25,()=>startRain(sp,x,z,true)); }
function updateRains(dt){ for(const rn of rains){ rn.tick-=dt;
    if(rn.follow){ let best=null, bd=4; for(const m of monsters){ if(!foe(m))continue; const dd=Math.hypot(m.x-rn.x,m.z-rn.z); if(dd<bd){ bd=dd; best=m; } } if(best){ const k=Math.min(1,dt*2/Math.max(0.1,bd)); rn.x+=(best.x-rn.x)*k; rn.z+=(best.z-rn.z)*k; } }
    while(rn.tick<=0&&rn.left>0){ rn.tick+=rn.iv; rn.left--; const a=mr()*6.28, rr=Math.sqrt(mr())*rn.r, px=rn.x+Math.cos(a)*rr, pz=rn.z+Math.sin(a)*rr, c=elemCol(rn.sp.elem), sp=rn.sp, eK=rn.elemK;
      spawn(px,4.6,pz,0,-24,0,0.19,G('|'),0.16,c[0]*2.4,c[1]*2.4,c[2]*2.4,0);
      later(0.18,()=>{ for(let q=0;q<3;q++)spawn(px,0.05,pz,(mr()-0.5)*1.2,0.4+mr()*0.5,(mr()-0.5)*1.2,0.3,G('.'),0.1,c[0]*2.2,c[1]*2.2,c[2]*2.2,0);
        for(const m of monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-px,m.z-pz)<0.7+0.3*m.ty.scale){ m.playerT=time; applyHit(m,roll(RUNE_DEF.rain.dmg[0],RUNE_DEF.rain.dmg[1]),sp,true); } }
        if(sp.elem&&mr()<eK){ const ci=Math.floor(pz/CELL)*MW+Math.floor(px/CELL); if(ci>=0&&ci<NCELL)landElem(sp,px,0.1,pz,ci); } }); }
    if(rn.left<=0&&!rn.done){ rn.done=true; } }
  rains=rains.filter(rn=>!rn.done); for(const mk of marks)mk.t-=dt; marks=marks.filter(mk=>mk.t>0); }
// the crossbow: bolts in quick succession
function castRapid(h,sp,opt){ const vo=0, sd=0, hv=0, ac=TL(sp,'accuracy'), n=3+(sp.aff.count||0), volleys=1;
  for(let v=0;v<volleys;v++)for(let k=0;k<n;k++)later(k*0.07+v*0.45,()=>{ if(dead)return; const fr=shotFrame(h,false,'bolt'), base=opt.dir||fr.d, HP=opt.dir?handPoint(h):fr.o, spread=0.045*(1-0.16*ac), d=turnDir(base,(mr()-0.5)*spread*2);
    projs.push({kind:'bolt',auto:!!opt.auto,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*22,vy:d[1]*22,vz:d[2]*22,t:0,sp,bounce:sp.aff.bounce||0,homing:(sp.aff.homing||0)+(sd>=2?20:sd>=1?10:0),hit:new Set(),dmg:RUNE_DEF.rapid.dmg,dmgK:(sd>=4?1.3:1)*(hv>=4?1.4:hv>=2?1.2:1),pierce:sd>=3?1:0,keep:true,heavy:hv,steady:sd,boom:vo>=5&&k===n-1}); if(k%2===0)sWhoosh(); }); }
// the star staff: a pillar of light falls on the aimed place after a moment
function castStar(sp,x,z){ const tw=0, sw=0, pl=TL(sp,'pull'), sz=tv(sp,'size'), delay=0.6*tv(sp,'fall'), pts=[[x,z]];
  const extra=(sp.aff.count||0);
  for(let i=0;i<extra;i++){ const a=mr()*6.28; pts.push([x+Math.cos(a)*1.6,z+Math.sin(a)*1.6]); }
  pts.forEach(([px,pz],i)=>{ const dl=delay+i*0.18; marks.push({x:px,z:pz,r:sz,t:dl,c:elemCol(sp.elem),star:true});
    if(pl&&i===0)later(dl*0.35,()=>{ const R=TRAIT_V.pull[pl]; for(const m of monsters){ if(!hittable(m)||m.ty.boss||m.key==='lord'||m.key==='final'||m.ty.habitat)continue; const ax=px-m.x, az=pz-m.z, dd=Math.hypot(ax,az); if(dd>R||dd<0.3)continue; const v=(2+pl*0.8)/Math.max(0.6,m.ty.scale||1); m.kx=(m.kx||0)+ax/dd*v; m.kz=(m.kz||0)+az/dd*v; m.st=m.st||{}; } });
    later(dl,()=>{ let fx=px, fz=pz; if(sw>=3){ let best=null, bd=2.5; for(const m of monsters){ if(!foe(m))continue; const dd=Math.hypot(m.x-px,m.z-pz); if(dd<bd){ bd=dd; best=m; } } if(best){ fx=best.x; fz=best.z; } }
      const c=elemCol(sp.elem); for(let y=0;y<7;y+=0.35)spawn(fx+(mr()-0.5)*0.2,y,fz+(mr()-0.5)*0.2,0,-6,0,0.25,G(mpick(['|','*','+'])),0.2,c[0]*3,c[1]*3,c[2]*3,0);
      orbBurst(fx,0.2,fz,sp,{dmg:1.25*Math.sqrt(sz),rad:sz}); shake=Math.max(shake,0.1);
      if(false)for(const m of monsters){ if(!hittable(m)||m.ty.boss||m.key==='lord'||m.key==='final')continue; if(Math.hypot(m.x-fx,m.z-fz)<1.2){ const st=m.st||(m.st={}); if(time>=(st.pinCd||0)){ st.pin=Math.max(st.pin||0,0.6); st.pinCd=time+1.8; } } } }); }); }
// the wind blade a sword sends forward: short for the short sword, wide for the greatsword's sweep
// the slash lies in the plane the blade swept: slanted like the swing (a sword: right-up to left-down from the right hand, mirrored from the left; a greatsword's sweep near level);
// bowed forward with its tips trailing back toward you, thick and bright in the middle, thin at the tips; it widens as it flies, leaves a faint trail and fades at the end
function drawWave(p){ const c=elemCol(p.sp.elem), v=Math.hypot(p.vx,p.vz)||1, dx=p.vx/v, dz=p.vz/v, px=-dz, pz=dx, life=clamp(1-p.t/(p.maxT||1),0,1), fade=Math.min(1,life*2.2), b=(0.75+0.55*fade)*fade;
  if(p.thrust){ for(let i=0;i<6;i++){ const k=i*0.16; dyn(p.x-dx*k,p.y-p.vy/v*k,p.z-dz*k,G(i===0?'>':'-'),0.16-i*0.015,c[0]*2.4*b*(1-i/7),c[1]*2.4*b*(1-i/7),c[2]*2.4*b*(1-i/7)); } return; }
  const [cf,cr,cu]=handUp(), grow=1+0.5*(1-life), W=(p.cw||1.2)*grow, half=W/2, bow=0.28*W, ang=(p.big?0.14:0.61)*(p.sp.h==='L'?-1:1), ca=Math.cos(ang), sa=Math.sin(ang);
  const S=[px*ca,sa,pz*ca], n=Math.max(11,Math.round(W*9));
  const pt=(s,back)=>{ const f=-bow*s*s-back; return [p.x+S[0]*s*half+dx*f,p.y+S[1]*s*half,p.z+S[2]*s*half+dz*f]; };
  for(const [trail,tb] of [[0,1],[0.22,0.35]]){ const ox=-dx*trail*v*0.04*6, oz=-dz*trail*v*0.04*6;
    for(let i=0;i<n;i++){ const s=i/(n-1)*2-1, core=1-s*s, rows=trail?1:Math.max(1,Math.round(1+core*2.2));
      const T=[S[0]*half+dx*(-2*bow*s),S[1]*half,S[2]*half+dz*(-2*bow*s)], g=vmGlyph(T[0]*cr[0]+T[2]*cr[2],T[0]*cu[0]+T[1]*cu[1]+T[2]*cu[2]);
      for(let k=0;k<rows;k++){ const q=pt(s,k*0.07), bb=b*tb*(0.45+0.75*core)*(1-k*0.22); dyn(q[0]+ox,q[1],q[2]+oz,G(g),(p.big?0.2:0.16)*(0.7+0.45*core),c[0]*2.3*bb,c[1]*2.3*bb,c[2]*2.3*bb); } } } }
function fireWave(sp,dir,cut){ if(sp.atk==='bare')return; player.swingWave=true; const wide=sp.atk==='gsweep', W=(wide?2.0:1.2)+2*TRAIT_V.width[TL(sp,'width')], n=1+(sp.aff.count||0), HP=handPoint(sp.h||'R'), dm=RUNE_DEF[wide?'gsweep':'blade'].dmg, k=wide?0.55:0.65, v=wide?14:16;
  for(let i=0;i<n;i++){ const d=turnDir(dir,(i-(n-1)/2)*0.13); projs.push({kind:'bolt',wind:true,big:wide,wave:true,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*v,vy:d[1]*v,vz:d[2]*v,t:0,maxT:(wide?0.28:0.32)*tv(sp,'range'),sp,bounce:sp.aff.bounce||0,homing:sp.aff.homing||0,hit:new Set(cut||[]),
    dmg:[Math.max(1,Math.round(dm[0]*k)),Math.max(1,Math.round(dm[1]*k))],pierce:wide?6:4,keep:true,cw:W,rad:Math.max(0,W/2-0.56)}); } }
function meleeCast(sp,dir){
  player.swingWave=false; player.swingH=sp.h; player.swing=0.22; player.swingCol=elemCol(sp.elem); sWhoosh();
  const MD=RUNE_DEF[sp.atk==='bare'?'blade':sp.atk], wgt=TL(sp,'weight'), [vx,vy,vz]=dir, [ox,oy,oz]=aimOrigin(), spL=TL(sp,'spin'), reach=(MD.reach||2.2)+(spL>=2?0.5:0), maxT=1+(sp.aff.count||0)+(spL>=3?3:0)+(sp.atk==='gsweep'?2:0), cands=[];
  for(const m of monsters){ if(!hittable(m))continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; if(m.ty.habitat==='bog'&&(m.rise||0)<0.3)continue;
    const sc=m.ty.scale, cy=m.hidden?m.y+1.3:m.y+(m.ty.flier?0:0.6*sc), ax=m.x-ox, ay=cy-oy, az=m.z-oz, d=Math.hypot(ax,ay,az);
    if(Math.hypot(m.x-player.x,m.z-player.z)>reach+0.35*sc)continue;
    const ang=Math.acos(clamp((ax*vx+ay*vy+az*vz)/Math.max(d,1e-3),-1,1)), tol=(spL>=3||wgt>=5)?Math.PI:(MD.arc||0.42)+(maxT>1?0.25:0)+(spL>=1?0.3:0)+Math.atan2(0.5*sc,Math.max(d,0.5));
    if(ang<=tol)cands.push([ang,m]); }
  cands.sort((a,b)=>a[0]-b[0]);
  const dm=sp.atk==='bare'?[1,2]:MD.dmg, dK=spL>=4?1.3:1;
  for(const [,m] of cands.slice(0,maxT)){ applyHit(m,Math.round(roll(dm[0],dm[1])*dK),sp);
    if(wgt&&!m.dead&&!m.ty.boss&&m.key!=='lord'&&m.key!=='final'&&!m.ty.habitat){ const ax=m.x-player.x, az=m.z-player.z, dd=Math.hypot(ax,az)||1, v=(wgt>=2?8:6)/Math.max(0.6,m.ty.scale||1); m.kx=(m.kx||0)+ax/dd*v; m.kz=(m.kz||0)+az/dd*v; m.st=m.st||{}; if(wgt>=3)m.slam={d:wgt>=4?7:4,until:time+0.7}; } }
  const qk=TL(sp,'quake'); if(qk&&sp.atk==='gsweep'){ const px=player.x, pz=player.z, R=qk>=4?4.5:3.2, hitNow=new Set(cands.slice(0,maxT).map(c=>c[1])); later(0.12,()=>{ for(let q=0;q<36;q++){ const a=q/36*Math.PI*2; spawn(px+Math.cos(a)*R*0.9,0.1,pz+Math.sin(a)*R*0.9,Math.cos(a)*2,0.2,Math.sin(a)*2,0.35,G(mpick(['~','-','='])),0.15,1.4,1.2,0.9,0); }
      for(const m of monsters){ if(!hittable(m)||hitNow.has(m)||m.ty.flier)continue; if(Math.hypot(m.x-px,m.z-pz)<R){ m.playerT=time; applyHit(m,Math.max(1,Math.round(roll(dm[0],dm[1])*(qk>=2?0.55:0.4))),sp,true); if(qk>=3)m.wind=0; if(qk>=5&&!m.ty.boss){ const st=m.st||(m.st={}); if(time>=(st.pinCd||0)){ st.pin=Math.max(st.pin||0,0.4); st.pinCd=time+1.6; } } } } shake=Math.max(shake,0.15); }); }
  if(spL>=3){ for(let q=0;q<26;q++){ const a=q/26*Math.PI*2; spawn(player.x+Math.cos(a)*reach*0.8,player.eye-0.6,player.z+Math.sin(a)*reach*0.8,-Math.sin(a)*2,0,Math.cos(a)*2,0.25,G(mpick(['-','~','='])),0.14,...elemCol(sp.elem).map(v=>v*2.2),0); } }
  if(spL>=5){ const px=player.x, pz=player.z; later(0.25,()=>{ for(let q=0;q<30;q++){ const a=q/30*Math.PI*2; spawn(px+Math.cos(a)*reach,0.9,pz+Math.sin(a)*reach,0,0.2,0,0.45,G('='),0.16,...elemCol(sp.elem).map(v=>v*2.6),0); }
    for(const m of monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-px,m.z-pz)<reach+0.4*m.ty.scale){ m.playerT=time; applyHit(m,Math.max(1,Math.round(roll(dm[0],dm[1])*0.5)),sp,true); } } }); }
  fireWave(sp,dir,new Set(cands.slice(0,maxT).map(c=>c[1])));
  const wL=0; if(wL){ const HP=handPoint(sp.h||'R'), n=wL>=3?2:1, wK=wL>=4?0.6:wL>=2?0.5:0.4, wd=[Math.max(1,Math.round(dm[0]*wK)),Math.max(1,Math.round(dm[1]*wK))];
    for(let k=0;k<n;k++){ const d=turnDir(dir,(k-(n-1)/2)*0.18); projs.push({kind:'bolt',wind:true,x:HP[0],y:HP[1],z:HP[2],vx:d[0]*16,vy:d[1]*16,vz:d[2]*16,t:0,maxT:0.38,sp,bounce:0,homing:0,hit:new Set(),dmg:wd,pierce:wL>=5?2:0,keep:false}); } }
  const lL=0; if(lL){ const hx=vx, hz=vz, hl=Math.hypot(hx,hz)||1, dist=[0,0.8,1.1,1.1,1.5,1.5][lL];
    player.lunge={t:0,dur:0.14,dx:hx/hl,dz:hz/hl,sp:dist/0.14}; if(lL>=5&&time>(player.invCd||0)){ player.invulT=time+0.25; player.invCd=time+1.2; }
    if(lL>=3)for(const m of monsters){ if(!hittable(m))continue; const ax=m.x-player.x, az=m.z-player.z, dd=Math.hypot(ax,az); if(dd<reach+0.6&&(ax*hx+az*hz)/Math.max(0.01,dd*hl)>0.6){ const v=6/Math.max(0.5,(m.ty.scale||1)); m.kx=(m.kx||0)+ax/dd*v; m.kz=(m.kz||0)+az/dd*v; m.st=m.st||{}; } } }
  if(sp.elem){ const fx=player.x+vx*1.5, fz=player.z+vz*1.5, ci=Math.floor(fz/CELL)*MW+Math.floor(fx/CELL); if(sp.elem!=='fire'||doorBlock(ci)||fuel[ci]>0)landElem(sp,fx,0.3,fz,ci); }
}
// the light beam: a ray each tick, reflecting off walls when it has bounces
const beamHold={L:{hold:0,last:-9,sear:-9,burst:-9},R:{hold:0,last:-9,sear:-9,burst:-9}};
function fireBeam(h,dirIn,orgIn,auto){
  const sp=specOf(h), fr=dirIn?null:beamFrame(h), base=dirIn||fr.d, n=1+(sp.aff.count||0), [ox,oy,oz]=orgIn||fr.o; beamSegs=[];
  const fb=beamHold[h]||beamHold.R, gap=time-fb.last; fb.hold=gap>0.4?0:fb.hold+gap; fb.last=time;
  const fL=TL(sp,'focus'), fMax=TRAIT_V.focus[fL], fK=1+Math.min(fMax,fb.hold*0.35), rL=TL(sp,'refract'), seL=TL(sp,'sear');
  for(let k=0;k<n;k++){ let d=turnDir(base,(k-(n-1)/2)*0.12), x=ox, y=oy, z=oz, left=12*tv(sp,'length'), bounces=sp.aff.bounce||0, bends=rL?(rL>=3?2:1):0, bent=false; const seg=[[x,y,z]], hitSet=new Set();
    while(left>0){ const nx=x+d[0]*0.25, ny=y+d[1]*0.25, nz=z+d[2]*0.25; left-=0.25;
      let hitM=null; for(const m of monsters){ if(!hittable(m)||hitSet.has(m))continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; const cy=m.y+(m.ty.flier?0:0.6*m.ty.scale); if(Math.hypot(m.x-nx,cy-ny,m.z-nz)<0.57+0.35*m.ty.scale){ hitM=m; break; } }
      if(hitM){ seg.push([nx,ny,nz]); hitSet.add(hitM); const bsp=bent&&rL>=5?{...sp,pow:sp.pow*1.5}:sp; applyHit(hitM,Math.max(1,Math.round(roll(RUNE_DEF.beam.dmg[0],RUNE_DEF.beam.dmg[1])*fK*(bent&&rL>=4?1.25:1))),bsp,true);
        if(bends>0){ let m2=null, bd=rL>=2?9:6; for(const m of monsters){ if(!hittable(m)||hitSet.has(m)||m.ty.critter)continue; const cy=m.y+(m.ty.flier?0:0.6*m.ty.scale), dd=Math.hypot(m.x-nx,cy-ny,m.z-nz); if(dd<bd&&losClear(nx,ny,nz,m.x,cy,m.z)){ bd=dd; m2=m; } }
          if(m2){ bends--; bent=true; const cy=m2.y+(m2.ty.flier?0:0.6*m2.ty.scale), L=Math.hypot(m2.x-nx,cy-ny,m2.z-nz)||1; d=[(m2.x-nx)/L,(cy-ny)/L,(m2.z-nz)/L]; x=nx; y=ny; z=nz; left=L+0.6; continue; } }
        break; }
      const ci=Math.floor(nz/CELL)*MW+Math.floor(nx/CELL), wall=nx<0||nz<0||nx>=MW*CELL||nz>=MH*CELL||D.tile[ci]===TW||D.tile[ci]===TX||doorBlock(ci)||ny<0.02||ny>D.ceil[ci];
      if(wall){ seg.push([x,y,z]); if(time-beamIgT>=0.5){ beamIgT=time; landElem(sp,x,y,z,doorBlock(ci)?ci:Math.floor(z/CELL)*MW+Math.floor(x/CELL)); } if(bounces<=0)break; bounces--; const r=reflectDir(x,y,z,d); d=r; continue; }
      x=nx; y=ny; z=nz; }
    if(seg.length<2)seg.push([x,y,z]); const e=seg[seg.length-1];
    if(k===0&&seL&&time-fb.sear>0.4){ fb.sear=time; addZone(e[0],e[2],seL>=3?1.0:0.7,sp,[0,2.5,3.5,3.5,5,5][seL],seL>=5); }
    if(false){ fb.burst=time; orbBurst(e[0],Math.max(0.2,e[1]),e[2],sp,{dmg:0.5,rad:0.6,cloud:false}); }
    for(let q=0;q<3;q++){ const a=mr()*6.28; spawn(e[0],e[1],e[2],Math.cos(a)*1.2,0.4+mr(),Math.sin(a)*1.2,0.3,G(mpick(['*','+'])),0.12,elemCol(sp.elem)[0]*2.8,elemCol(sp.elem)[1]*2.8,elemCol(sp.elem)[2]*2.8,0); }
    beamSegs.push({pts:seg,col:auto?elemCol(sp.elem).map(v=>v*0.6+0.4):elemCol(sp.elem),t:0.16}); }
}
function reflectDir(x,y,z,d){ const s=0.25, cx=Math.floor((x+d[0]*s)/CELL), cz=Math.floor((z+d[2]*s)/CELL), ox=Math.floor(x/CELL), oz=Math.floor(z/CELL);
  const solidAt=(a,b)=>a<0||b<0||a>=MW||b>=MH||D.tile[b*MW+a]===TW||D.tile[b*MW+a]===TX;
  let r=[d[0],d[1],d[2]]; const ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL);
  if(y+d[1]*s<0.02||y+d[1]*s>D.ceil[ci]){ r[1]=-r[1]; return r; }
  const bx=solidAt(cx,oz), bz=solidAt(ox,cz); if(bx)r[0]=-r[0]; if(bz)r[2]=-r[2]; if(!bx&&!bz){ r[0]=-r[0]; r[2]=-r[2]; } return r; }
const inWater=m=>{ const l=D.liquid[m.cz*MW+m.cx]; return l===LQ_WATER||l===LQ_DEEP; };

// ---------------------------------------------------------------- hits, elements and reactions (all shown, never written)
let hitSrcPoint=null;
function applyHit(m,dmg,sp,quiet){
  if(m.dead)return; m.playerT=time; m.lastAtk=sp.atk; m.lastKnock=tv(sp,'knock');
  { const sg=TL(sp,'stagger'); if(sg&&m.wind>0&&!m.ty.boss&&mr()<TRAIT_V.stagger[sg]){ m.wind=0; m.atkCd=Math.max(m.atkCd||0,0.8); } } const el=sp.elem; let mult=1;
  if(el){ const r=(RES[m.key]||{})[el]; if(r!==undefined)mult=r; if(el==='thunder'&&inWater(m))mult*=1.5; }
  hitFeedback(m,mult,el,quiet);
  if(time<(player.ctrUntil||0))mult*=BL('counter')>=2?1.8:1.5; if(time<(player.swapEdgeUntil||0))mult*=BL('swapedge')>=2?1.9:1.6; if(BL('reckless'))mult*=BL('reckless')>=2?1.4:1.25; if(sp.powK)mult*=sp.powK;
  if(el&&time<(player.momUntil||0))mult*=BL('momentum')>=2?1.4:1.25; if(m.st&&m.st.burn>0){ if(BL('kindle'))mult*=BL('kindle')>=2?1.4:1.25; if(BL('scorch')){ mult*=BL('scorch')>=2?1.7:1.5; m.st.scorched=true; } }
  const n=Math.round(dmg*mult);
  if(n>0)damageMonster(m,n,el==='fire'?'fire':(el||'magic'));
  else if(!m.noticed&&hostile(m)){ m.sleep=false; m.aware=1.25; onNoticed(m); }
  if(el&&mult>0.25&&!m.dead)applyElem(m,el,sp,dmg);
}
function hitFeedback(m,mult,el,quiet){
  const cy=m.y+0.6*m.ty.scale, c=elemCol(el);
  if(mult<=0.25){ for(let q=0;q<9;q++){ const a=mr()*6.28; spawn(m.x,cy,m.z,Math.cos(a)*2.2,0.6+mr(),Math.sin(a)*2.2,0.45,G(mpick(['x','.','\''])),0.12,0.45,0.45,0.5,0); }
    if(sndReady()&&!quiet){ const t=SND.ctx.currentTime; sEnv(sTone(t,'sine',120,80,0.12,sOut(m.x,m.z,0.25)),t,0.005,0.12); } return; }
  if(mult>=1.5){ for(let q=0;q<(quiet?6:18);q++){ const a=mr()*6.28; spawn(m.x,cy,m.z,Math.cos(a)*3,0.8+mr()*2,Math.sin(a)*3,0.6+mr()*0.4,G(mpick(['*','+','#','%'])),0.2,c[0]*3,c[1]*3,c[2]*3,0); }
    m.hitT=0.35; if(sndReady()&&!quiet){ const t=SND.ctx.currentTime; sEnv(sNoise(t,0.25,'highpass',2400,0.8,sOut(m.x,m.z,0.35)),t,0.003,0.22); } }
  else if(el){ for(let q=0;q<6;q++){ const a=mr()*6.28; spawn(m.x,cy,m.z,Math.cos(a)*1.4,0.5+mr(),Math.sin(a)*1.4,0.5,G(mpick(['*','.'])),0.14,c[0]*2.2,c[1]*2.2,c[2]*2.2,0); } }
}
function applyElem(m,el,sp,base){
  const st=m.st||(m.st={}), durK=(1+(sp.aff.dur||0)/100)*sp.pow*(1+0.5*bodyN('linger')), areaK=1+(sp.aff.area||0)/100;
  if(el==='fire'){ if(st.chill>0)react('steam',m,sp,base); else if(st.poison>0)react('blast',m,sp,base); else if(st.shock>0)react('overload',m,sp,base);
    if(!m.dead){ st.burn=Math.max(st.burn||0,3*durK); const ci=m.cz*MW+m.cx; if(!D.liquid[ci]&&time-(m.fireT2||-9)>=0.5){ m.fireT2=time; burstFire(ci,0.6*areaK,0.7); } } }
  else if(el==='ice'){ if(st.burn>0)react('steam',m,sp,base); else if(st.poison>0)react('frostbite',m,sp,base); if(!m.dead)st.chill=Math.max(st.chill||0,2.5*durK); if(time-(m.iceT||-9)>=0.5){ m.iceT=time; chillArea(m.x,m.z,0.9*areaK); } }
  else if(el==='thunder'){ if(st.chill>0)react('shatter',m,sp,base); else if(st.poison>0)react('contagion',m,sp,base); else if(st.burn>0)react('overload',m,sp,base);
    if(!m.dead){ st.shock=Math.max(st.shock||0,0.4*sp.pow); m.wind=0; }
    if(time-(m.chainT||-9)>=0.5){ m.chainT=time; chainLightning(m,1+(sp.aff.chain||0),Math.max(1,Math.round(base*0.5)),areaK); conductWater(m,base); } }
  else if(el==='poison'){ if(st.burn>0)react('blast',m,sp,base); else if(st.chill>0)react('frostbite',m,sp,base); else if(st.shock>0)react('contagion',m,sp,base); if(!m.dead)st.poison=Math.max(st.poison||0,5*durK); }
  if(el!=='thunder'&&sp.aff.chain&&time-(m.chainT2||-9)>=0.5){ m.chainT2=time; let from=m; const seen=new Set([m]);
    for(let k=0;k<sp.aff.chain;k++){ const nx=nearestFoe(from.x,from.z,4*areaK,seen,from.y+0.6*from.ty.scale); if(!nx)break; seen.add(nx); zapLine(from,nx,elemCol(el),el); const s2=nx.st||(nx.st={});
      if(el==='fire')s2.burn=Math.max(s2.burn||0,2*durK); else if(el==='ice')s2.chill=Math.max(s2.chill||0,1.8*durK); else if(el==='poison')s2.poison=Math.max(s2.poison||0,3.5*durK); from=nx; } }
}
function nearestFoe(x,z,r,skip,fy){ let b=null, bd=r; for(const o of monsters){ if(!foe(o)||skip.has(o))continue; const d=Math.hypot(o.x-x,o.z-z); if(d<bd&&(fy===undefined||losClear(x,fy,z,...mCenter(o)))){ bd=d; b=o; } } return b; }
function zapLine(a,b,c,style){ addBolt([a.x,a.y+0.6*a.ty.scale,a.z],[b.x,b.y+0.6*b.ty.scale,b.z],c,style||'thunder'); }
function chainLightning(m,jumps,dmg,areaK){ let from=m; const seen=new Set([m]), order=[];
  sparkCrown(m,RUNE_DEF.thunder.col); zapFlash={x:m.x,y:m.y+0.6*m.ty.scale,z:m.z,col:RUNE_DEF.thunder.col,t:0.16,r:6};
  for(let k=0;k<jumps;k++){ const nx=nearestFoe(from.x,from.z,4*areaK,seen,from.y+0.6*from.ty.scale); if(!nx)break; seen.add(nx); order.push([from,nx]); from=nx; }
  order.forEach(([a,b],k)=>zapQueue.push({t:0.08*(k+1),fn:()=>{ if(b.dead)return; const ay=a.y+0.6*a.ty.scale, by=b.y+0.6*b.ty.scale;
    addBolt([a.x,ay,a.z],[b.x,by,b.z],RUNE_DEF.thunder.col,'thunder');
    let mult=(RES[b.key]||{}).thunder; if(mult===undefined)mult=1; if(inWater(b))mult*=1.5; const n=Math.round(dmg*mult);
    if(n>0)damageMonster(b,n,'thunder'); if(!b.dead){ const s2=b.st||(b.st={}); s2.shock=Math.max(s2.shock||0,0.3); b.wind=0; }
    sparkCrown(b,RUNE_DEF.thunder.col); zapFlash={x:b.x,y:by,z:b.z,col:RUNE_DEF.thunder.col,t:0.16,r:6};
    if(sndReady()){ const t=SND.ctx.currentTime, o=sOut(b.x,b.z,0.3); sEnv(sNoise(t,0.16,'highpass',3200,0.6,o),t,0.002,0.14); sEnv(sTone(t,'square',700+k*180,300,0.08,o),t,0.002,0.07,0.5); } }}));
  if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sNoise(t,0.18,'highpass',3200,0.6,sOut(m.x,m.z,0.25)),t,0.002,0.16); }
}
function react(kind,m,sp,base){
  const st=m.st, areaK=1+(sp.aff.area||0)/100, cx=m.x, cz=m.z, cy=m.y+0.6*m.ty.scale;
  const around=(r,f)=>{ for(const o of monsters){ if(!foe(o))continue; if(Math.hypot(o.x-cx,o.z-cz)<r&&(o===m||losClear(cx,cy,cz,...mCenter(o))))f(o); } };
  const burst=(chars,col,n,sp2)=>{ for(let q=0;q<n;q++){ const a=mr()*6.28, e=mr(); spawn(cx,cy,cz,Math.cos(a)*sp2*(0.5+e),0.6+mr()*2.2,Math.sin(a)*sp2*(0.5+e),0.8+mr()*0.7,G(mpick(chars)),0.22,col[0],col[1],col[2],0); } };
  if(kind==='steam'){ st.burn=0; st.chill=0; burst(['~','o','.'],[2.4,2.5,2.6],40,2.6); around(2.4*areaK,o=>damageMonster(o,roll(4,7),'magic'));
    if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sNoise(t,1.0,'highpass',1800,0.5,sOut(cx,cz,0.4)),t,0.02,0.9); } }
  else if(kind==='blast'){ st.burn=0; st.poison=0; burst(['*','#','%','\''],[3.4,1.8,0.5],50,3.4); burstFire(m.cz*MW+m.cx,1.3*areaK,1.0); around(2.6*areaK,o=>damageMonster(o,roll(5,9),'fire'));
    if(Math.hypot(player.x-cx,player.z-cz)<2.0*areaK)hurtPlayer(roll(1,3),'爆炎'); sBoom(0.4); flash=Math.max(flash,0.35); shake=Math.max(shake,0.25); }
  else if(kind==='overload'){ st.burn=0; st.shock=0; burst(['*','+','/'],[3.2,2.4,1.2],30,3.0);
    around(2.2*areaK,o=>{ damageMonster(o,roll(3,5),'thunder'); const d=Math.hypot(o.x-cx,o.z-cz)||1; o.kx=(o.x-cx)/d*5; o.kz=(o.z-cz)/d*5; }); sBoom(0.25); }
  else if(kind==='shatter'){ st.chill=0; burst(['*','/','\\','+'],[1.6,2.4,3.2],36,3.2); damageMonster(m,Math.round(base*2),'magic');
    if(sndReady()){ const t=SND.ctx.currentTime; sEnv(sNoise(t,0.4,'highpass',4200,1.2,sOut(cx,cz,0.45)),t,0.002,0.35); } }
  else if(kind==='frostbite'){ st.poison=(st.poison||0)*2+3; st.chill=Math.max(st.chill||0,2); burst(['*','.'],[1.2,2.6,1.8],24,1.6); }
  else if(kind==='contagion'){ around(4*areaK,o=>{ if(o===m)return; const s2=o.st||(o.st={}); s2.poison=Math.max(s2.poison||0,st.poison||4); zapLine(m,o,RUNE_DEF.poison.col,'poison'); }); burst(['%','.'],[1.2,3.0,1.0],20,1.8); }
  if(!BOOK.has(kind)){ BOOK.add(kind); try{ localStorage.setItem('al_book',JSON.stringify([...BOOK])); }catch(e){} setTimeout(()=>sChime(player.x,player.z,0.35),120); }
}
// statuses tick on their own; chill slows, shock stops for a moment
function updateStatuses(dt){
  if(dt>0)for(const m of monsters){ if(m.plx!==undefined){ const k=Math.min(1,dt*8); m.vlx=(m.vlx||0)+(((m.x-m.plx)/dt)-(m.vlx||0))*k; m.vlz=(m.vlz||0)+(((m.z-m.plz)/dt)-(m.vlz||0))*k; } m.plx=m.x; m.plz=m.z; }
  for(const m of monsters){ const st=m.st; if(!st||m.dead)continue; const vis=m.visible&&Math.hypot(m.x-player.x,m.z-player.z)<26, cy=m.y+0.6*m.ty.scale;
    if(m.kx||m.kz){ m.x+=m.kx*dt; m.z+=m.kz*dt; m.kx*=Math.exp(-dt*6); m.kz*=Math.exp(-dt*6); if(Math.abs(m.kx)+Math.abs(m.kz)<0.05){ m.kx=0; m.kz=0; }
      const ci=Math.floor(m.z/CELL)*MW+Math.floor(m.x/CELL); if(D.tile[ci]===TW||D.tile[ci]===TX||D.solid.has(ci)){ if(m.slam&&time<m.slam.until){ const dd=m.slam.d; m.slam=null; m.playerT=time; damageMonster(m,dd,'blade'); for(let q=0;q<10;q++){ const a=mr()*6.28; spawn(m.x,m.y+0.6,m.z,Math.cos(a)*1.5,mr()*1.2,Math.sin(a)*1.5,0.5,G(mpick(['#','.',','])),0.14,0.9,0.85,0.8,0); } shake=Math.max(shake,0.12); } m.x-=m.kx*dt*1.5; m.z-=m.kz*dt*1.5; m.kx=0; m.kz=0; } m.cx=Math.floor(m.x/CELL); m.cz=Math.floor(m.z/CELL); }
    if(st.burn>0&&st.burn-dt<=0&&st.scorched&&!m.dead&&BL('scorch')){ m.hp=Math.min(m.maxHp||m.hp,m.hp+(m.maxHp||10)*0.3); st.scorched=false; }
    if(st.burn>0){ st.burn-=dt; st.bt=(st.bt||0)-dt; if(st.bt<=0){ st.bt=0.5; const r=(RES[m.key]||{}).fire; const n=Math.round(roll(1,2)*(r===undefined?1:r)); if(n>0)damageMonster(m,n,'fire'); }
      if(vis&&mr()<dt*14)spawn(m.x+(mr()-0.5)*0.5*m.ty.scale,cy+(mr()-0.3)*0.5,m.z+(mr()-0.5)*0.5*m.ty.scale,0,0.9+mr(),0,0.5,G(mpick(['^','\'','*'])),0.14,2.6,1.2,0.3,0); }
    if(st.poison>0){ st.poison-=dt; st.pt=(st.pt||0)-dt; if(st.pt<=0){ st.pt=0.6; const r=(RES[m.key]||{}).poison; const n=Math.round(1*(r===undefined?1:r)); if(n>0)damageMonster(m,n,'poison'); }
      if(vis&&mr()<dt*8)spawn(m.x+(mr()-0.5)*0.4*m.ty.scale,cy,m.z+(mr()-0.5)*0.4*m.ty.scale,0,-0.6,0,0.8,G(mpick(['.',','])),0.12,0.6,1.8,0.5,1); }
    if(st.chill>0){ st.chill-=dt; if(vis&&mr()<dt*6)spawn(m.x+(mr()-0.5)*0.6*m.ty.scale,cy+(mr()-0.5)*0.6,m.z+(mr()-0.5)*0.6*m.ty.scale,0,0.05,0,0.7,G('*'),0.12,1.4,2.0,2.6,0); }
    if(st.pin>0){ st.pin-=dt; if(vis&&mr()<dt*5)spawn(m.x+(mr()-0.5)*0.4,cy+0.3,m.z+(mr()-0.5)*0.4,0,0,0,0.3,G('#'),0.12,1.4,1.3,1.0,0); }
    if(st.shock>0){ st.shock-=dt; if(vis&&mr()<dt*12)spawn(m.x+(mr()-0.5)*0.5,cy+(mr()-0.5)*0.6,m.z+(mr()-0.5)*0.5,0,0,0,0.12,G(mpick(['/','\\'])),0.14,3,2.8,1.2,0); }
    if(m.dead&&st)m.st=null; }
  for(const c of clouds){ c.t-=dt; c.tick-=dt; if(c.tick<=0){ c.tick=0.5; for(const o of monsters){ if(foe(o)&&Math.hypot(o.x-c.x,o.z-c.z)<c.r&&losClear(c.x,0.6,c.z,...mCenter(o))){ const s2=o.st||(o.st={}); s2.poison=Math.max(s2.poison||0,2.5); } } }
    if(mr()<dt*16){ const a=mr()*6.28, rr=Math.sqrt(mr())*c.r; spawn(c.x+Math.cos(a)*rr,0.15+mr()*0.5,c.z+Math.sin(a)*rr,0,0.15,0,1.2,G(mpick(['%','~','.'])),0.2,0.5,1.4,0.45,0); } }
  clouds=clouds.filter(c=>c.t>0); updateZones(dt);
}
const monTimeK=m=>{ let k=m.st?((m.st.shock>0||m.st.pin>0)?0:(m.st.chill>0?0.5:1)):1; if(m.ty.critter==='mimic'&&!m.hidden)k*=Math.sin(time*4.5+m.ph)>-0.3?1.3:0.06; return k; };

// ---------------------------------------------------------------- projectiles: arrows fly straight, orbs arc and burst; both can bounce and seek
function updateProjs(dt){
  for(const b of beamSegs)b.t-=dt; beamSegs=beamSegs.filter(b=>b.t>0||beamRun);
  for(const p of projs){
    p.t+=dt; if(p.kind==='orb'&&!p.noGrav)p.vy-=9.8*dt;
    if(p.accel){ const v=Math.hypot(p.vx,p.vy,p.vz)||1, nv=Math.min(p.vmax,v+p.accel*dt); p.vx*=nv/v; p.vy*=nv/v; p.vz*=nv/v; }
    if(p.moon){ const R=(p.tide?TRAIT_V.pull[p.tide]:2.6)+p.moon*0.3; if(p.tide)for(const m of monsters){ if(!hittable(m)||m.ty.boss||m.key==='lord'||m.key==='final'||m.ty.habitat)continue; const ax=p.x-m.x, az=p.z-m.z, dd=Math.hypot(ax,az); if(dd>R||dd<0.4)continue; const v=(2+p.tide*0.6)*dt*3/Math.max(0.6,m.ty.scale||1); m.kx=(m.kx||0)+ax/dd*v; m.kz=(m.kz||0)+az/dd*v; m.st=m.st||{}; (p.pulled=p.pulled||new Set()).add(m); }
      if(p.phases>=5){ p.burnT-=dt; if(p.burnT<=0){ p.burnT=0.25; for(const m of monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-p.x,m.z-p.z)<0.6+0.25*p.moon){ m.playerT=time; applyHit(m,2,p.sp,true); } } } }
      const c2=elemCol(p.sp.elem); for(let q=0;q<Math.round(p.moon*2);q++){ const a=mr()*6.28, r=0.25*p.moon; spawn(p.x+Math.cos(a)*r,p.y+(mr()-0.5)*r,p.z+Math.sin(a)*r,0,0,0,0.25,G(mpick(['o','O','*','(',')'])),0.14+0.04*p.moon,c2[0]*2.6,c2[1]*2.6,c2[2]*2.6,0); } }
    if(p.homing){ let best=null, bs=0.5; const v=Math.hypot(p.vx,p.vy,p.vz)||1;
      for(const m of monsters){ if(!foe(m))continue; const cy=m.y+0.6*m.ty.scale, ax=m.x-p.x, ay=cy-p.y, az=m.z-p.z, d=Math.hypot(ax,ay,az); if(d>12||d<0.1)continue; const c=(ax*p.vx+ay*p.vy+az*p.vz)/(d*v); if(c>bs&&losClear(p.x,p.y,p.z,m.x,cy,m.z)){ bs=c; best=[ax/d,ay/d,az/d]; } }
      if(best){ const k=Math.min(1,(p.homing*Math.PI/180)*dt*2.2); p.vx+=(best[0]*v-p.vx)*k; p.vz+=(best[2]*v-p.vz)*k; if(p.kind==='bolt')p.vy+=(best[1]*v-p.vy)*k; } }
    const nx=p.x+p.vx*dt, ny=p.y+p.vy*dt, nz=p.z+p.vz*dt, cx=Math.floor(nx/CELL), cz=Math.floor(nz/CELL);
    const c=elemCol(p.sp.elem), bolt=p.kind==='bolt';
    if(mr()<(p.wave?0.35:0.85))spawn(p.x,p.y,p.z,(mr()-0.5)*0.3,(mr()-0.5)*0.3,(mr()-0.5)*0.3,0.35+mr()*0.25,G(mpick(p.wind?['~',')','(']:bolt?['*','.','\'']:['o','.','*'])),p.big?0.24:p.mini?0.08:bolt?0.11:0.13,c[0]*2.2,c[1]*2.2,c[2]*2.2,0);
    if(cx<0||cz<0||cx>=MW||cz>=MH||p.t>(p.maxT||4)){ p.dead=true; continue; }
    let hm=null; for(const m of monsters){ if(!hittable(m)||p.hit.has(m))continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; const cy=m.y+(m.ty.flier?0:0.6*m.ty.scale); if(Math.hypot(m.x-nx,cy-ny,m.z-nz)<0.42+0.35*m.ty.scale+(p.kind==='bolt'?0.14:0)+(p.rad||0)){ hm=m; break; } }
    if(hm){ p.hit.add(hm); if(bolt){ const dmg=p.dmg||RUNE_DEF.bolt.dmg; applyHit(hm,Math.max(1,Math.round(roll(dmg[0],dmg[1])*(p.dmgK||1))),p.sp); if(!p.wind&&(!p.mini||TL(p.sp,'scatter')>=5))arrowTraits(p,hm,nx,ny,nz);
        if(p.pierce===undefined&&!p.wind&&!p.mini){ const pl=TL(p.sp,'pierce'); p.pierce=[0,1,1,2,3,3][pl]; p.keep=pl>=2; if(pl>=5)p.wallPass=1; }
        if(p.heavy&&!hm.dead){ const v=Math.hypot(p.vx,p.vz)||1, k=(p.heavy>=1?3:0)/Math.max(0.6,hm.ty.scale||1); if(!hm.ty.boss&&hm.key!=='lord'&&hm.key!=='final'){ hm.kx=(hm.kx||0)+p.vx/v*k; hm.kz=(hm.kz||0)+p.vz/v*k; hm.st=hm.st||{}; if(p.heavy>=3)hm.wind=0; if(p.heavy>=5&&time>=(hm.st.pinCd||0)){ hm.st.pin=Math.max(hm.st.pin||0,0.2); hm.st.pinCd=time+1.2; } } }
        if(p.steady>=5){ hm.rapidN=(time-(hm.rapidT||-9)<0.8?(hm.rapidN||0):0)+1; hm.rapidT=time; if(hm.rapidN===3&&!hm.dead){ m_rapidCrit(hm,p.sp); } }
        if(p.boom){ orbBurst(nx,ny,nz,p.sp,{dmg:0.4,rad:0.6,cloud:false}); p.boom=false; }
        if(p.dust){ const n=p.dust>=3?3:2, k=p.dust>=4?0.8:p.dust>=2?0.6:0.45, md=RUNE_DEF.mshot.dmg, sp=p.sp, dl=p.dust; for(let i=0;i<n;i++){ const a=mr()*6.28; projs.push({kind:'bolt',mini:true,x:nx,y:ny,z:nz,vx:Math.cos(a)*12,vy:(mr()-0.3)*2,vz:Math.sin(a)*12,t:0,maxT:0.3,sp,bounce:0,homing:0,hit:new Set([hm]),dmg:[Math.max(1,Math.round(md[0]*k)),Math.max(1,Math.round(md[1]*k))],trail:dl>=5}); } p.dust=0; }
        if(p.trail&&sp_elem(p))addZone(nx,nz,0.6,p.sp,3,false);
        if(p.pierce>0){ p.pierce--; if(!p.keep)p.dmgK=(p.dmgK||1)*0.7; p.x=nx; p.y=ny; p.z=nz; } else p.dead=true; }
      else { if(p.moon)moonBurst(p,nx,ny,nz); else orbBurst(nx,ny,nz,p.sp,p.mini?{dmg:p.burstK,rad:0.6,cloud:false,proj:p}:{proj:p}); p.dead=true; } continue; }
    const i=cz*MW+cx, wall=D.tile[i]===TW||D.tile[i]===TX||doorBlock(i), floor=ny<0.03&&D.tile[i]!==TC, ceil=ny>D.ceil[i];
    if(wall||floor||ceil){
      if(wall&&!floor&&!ceil&&p.wallPass===undefined&&p.kind==='bolt'&&!p.mini&&!p.wind&&TL(p.sp,'pierce')>=5)p.wallPass=1;
      if(wall&&!floor&&!ceil&&p.wallPass>0&&p.kind==='bolt'){ p.wallPass--; p.passing=true; }
      if(p.passing){ if(!wall)p.passing=false; p.x=nx; p.y=ny; p.z=nz; continue; }
      if(p.bounce>0){ p.bounce--; if(p.kind==='orb')orbBurst(p.x,Math.max(0.1,p.y),p.z,p.sp,{dmg:0.6,rad:0.7,cloud:false}); const r=reflectDir(p.x,p.y,p.z,[p.vx*dt,p.vy*dt,p.vz*dt].map(v=>v/Math.max(1e-4,Math.hypot(p.vx,p.vy,p.vz)*dt)));
        const v=Math.hypot(p.vx,p.vy,p.vz); p.vx=r[0]*v; p.vy=r[1]*v*(p.kind==='orb'?0.7:1); p.vz=r[2]*v; if(floor&&p.kind==='orb')p.vy=Math.abs(p.vy)+1;
        for(let q=0;q<5;q++){ const a=mr()*6.28; spawn(p.x,p.y,p.z,Math.cos(a)*1.2,mr(),Math.sin(a)*1.2,0.35,G('.'),0.1,c[0]*2.4,c[1]*2.4,c[2]*2.4,0); } continue; }
      p.dead=true; if(p.boom)orbBurst(p.x,Math.max(0.1,p.y),p.z,p.sp,{dmg:0.4,rad:0.6,cloud:false}); if(p.moon){ moonBurst(p,p.x,Math.max(0.1,p.y),p.z); continue; } if(p.kind==='orb')orbBurst(p.x,Math.max(0.1,p.y),p.z,p.sp,p.mini?{dmg:p.burstK,rad:0.6,cloud:false,proj:p}:{proj:p});
      else { for(let q=0;q<8;q++){ const a=mr()*6.28; spawn(p.x,Math.max(0.05,p.y),p.z,Math.cos(a)*1.4,0.3+mr(),Math.sin(a)*1.4,0.4,G(mpick(['*','.'])),0.12,c[0]*2.4,c[1]*2.4,c[2]*2.4,0); }
        landElem(p.sp,p.x,p.y,p.z,doorBlock(i)?i:Math.floor(p.z/CELL)*MW+Math.floor(p.x/CELL)); }
      continue; }
    p.x=nx; p.y=ny; p.z=nz;
  }
  projs=projs.filter(p=>!p.dead);
}
const sp_elem=p=>!!(p&&p.sp&&p.sp.elem);
function m_rapidCrit(m,sp){ m.playerT=time; applyHit(m,5,sp,true); for(let q=0;q<10;q++){ const a=mr()*6.28; spawn(m.x,m.y+0.8,m.z,Math.cos(a)*1.6,0.4+mr(),Math.sin(a)*1.6,0.4,G(mpick(['!','*'])),0.14,2.6,2.2,1.2,0); } }
function moonBurst(p,x,y,z){ const f=p.moon, sp=p.sp; orbBurst(x,y,z,sp,{dmg:f*1.1,rad:0.8+0.45*f}); shake=Math.max(shake,0.1+0.05*f);
  if(p.phases>=3&&f>2.2){ const n=p.phases>=4?5:3; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+mr(); projs.push({kind:'orb',mini:true,gen:9,x,y:Math.max(0.5,y),z,vx:Math.cos(a)*6,vy:3.2,vz:Math.sin(a)*6,t:0,sp,bounce:0,homing:0,hit:new Set(),burstK:0.6}); } }
  if(p.tide>=5&&p.pulled)for(const m of p.pulled){ if(m.dead||m.ty.boss)continue; const st=m.st||(m.st={}); if(time>=(st.pinCd||0)){ st.pin=Math.max(st.pin||0,0.5); st.pinCd=time+1.6; } } }
function arrowTraits(p,hm,x,y,z){ const sp=p.sp, gen=p.gen||0;
  const sc=TL(sp,'scatter'); if(sc&&gen<(sc>=5?2:1)){ const n=sc>=3?3:2, v=Math.hypot(p.vx,p.vz)||1, k=sc>=4?0.8:sc>=2?0.65:0.5, bd=RUNE_DEF.bolt.dmg;
    for(let i=0;i<n;i++){ const a=Math.atan2(p.vz,p.vx)+(mr()-0.5)*1.4; projs.push({kind:'bolt',mini:true,gen:gen+1,x,y,z,vx:Math.cos(a)*14,vy:(mr()-0.4)*2,vz:Math.sin(a)*14,t:0,maxT:0.35,sp,bounce:0,homing:0,hit:new Set([hm]),dmg:[Math.max(1,Math.round(bd[0]*k)),Math.max(1,Math.round(bd[1]*k))]}); } }
  const pn=TL(sp,'pin'); if(pn&&!hm.dead&&!hm.ty.boss&&hm.key!=='lord'&&hm.key!=='final'){ const st=hm.st||(hm.st={}); let dur=pn>=2?0.45:0.3;
    if(pn>=3){ const v=Math.hypot(p.vx,p.vz)||1, wx=hm.x+p.vx/v*1.1, wz=hm.z+p.vz/v*1.1, wi=Math.floor(wz/CELL)*MW+Math.floor(wx/CELL); if(wi>=0&&wi<NCELL&&(D.tile[wi]===TW||D.tile[wi]===TX)){ dur=pn>=4?1.6:1.2; for(let q=0;q<6;q++)spawn(hm.x,hm.y+0.8,hm.z,(mr()-0.5)*0.5,mr()*0.4,(mr()-0.5)*0.5,0.5,G('#'),0.14,1.6,1.4,1.0,0);
        if(pn>=5)for(const k of ['burn','chill','shock','poison'])if(st[k]>0)st[k]*=2; } }
    if(time<(st.pinCd||0))return; st.pin=Math.max(st.pin||0,dur); st.pinCd=time+dur+1.2; } }
function orbBurst(x,y,z,sp,opt){
  opt=opt||{}; const dK=opt.dmg||1, areaK=1+(sp.aff.area||0)/100, R=1.7*areaK*(opt.rad||1), c=elemCol(sp.elem), ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL);
  for(let q=0;q<28;q++){ const a=mr()*6.28, e=mr(); spawn(x,y,z,Math.cos(a)*R*1.6*(0.4+e),0.5+mr()*1.8,Math.sin(a)*R*1.6*(0.4+e),0.6+mr()*0.4,G(mpick(['*','o','.','+'])),0.18,c[0]*2.6,c[1]*2.6,c[2]*2.6,0); }
  sCrackleBurst(x,z); makeNoise(x,z,9,0.6); shake=Math.max(shake,0.08);
  for(const m of monsters){ if(!hittable(m))continue; if(Math.hypot(m.x-x,m.z-z)<R+0.3*m.ty.scale&&losClear(x,Math.max(0.4,y),z,...mCenter(m))){ hitSrcPoint=[x,z]; applyHit(m,Math.max(1,Math.round(roll(RUNE_DEF.orb.dmg[0],RUNE_DEF.orb.dmg[1])*dK)),sp,true); hitSrcPoint=null; } }
  if(sp.elem==='fire'&&ci>=0&&ci<NCELL&&!D.liquid[ci])burstFire(ci,R/CELL+0.6,0.9);
  if(sp.elem==='ice')chillArea(x,z,R); if(sp.elem==='thunder')landElem(sp,x,y,z,ci);
  if(sp.elem==='poison'&&opt.cloud!==false)clouds.push({x,z,r:R*1.1,t:3*(1+(sp.aff.dur||0)/100),tick:0});
  if(!opt.proj)return; const p=opt.proj, gen=p.gen||0;
  const sL=TL(sp,'split'); if(sL&&gen<(sL>=5?2:1)){ const n=sL>=3?3:2, spd=sL>=2?6.5:4.5; for(let k=0;k<n;k++){ const a=mr()*6.28; projs.push({kind:'orb',mini:true,gen:gen+1,x,y:Math.max(0.5,y),z,vx:Math.cos(a)*spd,vy:3.8,vz:Math.sin(a)*spd,t:0,sp,bounce:0,homing:0,hit:new Set(),burstK:sL>=4?0.7:0.5}); } }
  const tL=TL(sp,'trace'); if(tL&&!p.mini)addZone(x,z,R*(tL>=3?1.0:0.7),sp,[0,4,6,6,8,8][tL],tL>=5);
  const iL=TL(sp,'impact'); if(iL&&!p.mini){ for(const m of monsters){ if(!hittable(m))continue; const ax=m.x-x, az=m.z-z, dd=Math.hypot(ax,az)||0.01; if(dd>R+0.5)continue; if(m.ty.boss||m.key==='lord'||m.key==='final'||m.ty.habitat)continue;
      const v=(iL>=2?8:6)/Math.max(0.6,(m.ty.scale||1)); m.kx=(m.kx||0)+ax/dd*v; m.kz=(m.kz||0)+az/dd*v; m.st=m.st||{}; if(iL>=3)m.slam={d:iL>=4?6:3,until:time+0.7}; if(iL>=5){ m.wind=0; m.st.pin=Math.max(m.st.pin||0,0.8); } } }
}
// lingering traces of an element: every half second, what stands in them takes the element
let zones=[], laters=[];
function addZone(x,z,r,sp,dur,grow){ const near=zones.find(zn=>zn.el===sp.elem&&Math.hypot(zn.x-x,zn.z-z)<Math.max(0.7,zn.r*0.6)); if(near){ near.t=Math.max(near.t,dur); near.sp=sp; return; } zones.push({x,z,r,r0:r,sp,el:sp.elem,t:dur,tick:0,grow}); if(zones.length>14)zones.shift(); }
function later(dt,fn){ laters.push({t:time+dt,fn}); }
function updateZones(dt){ updateRains(dt); for(const L of laters)if(time>=L.t){ L.done=true; try{ L.fn(); }catch(e){} } laters=laters.filter(L=>!L.done);
  for(const zn of zones){ zn.t-=dt; zn.tick-=dt; if(zn.grow)zn.r=Math.min(zn.r0*1.7,zn.r+dt*0.18);
    if(zn.tick<=0&&zn.el){ zn.tick=0.5; for(const m of monsters){ if(!hittable(m)||m.ty.critter)continue; if(Math.hypot(m.x-zn.x,m.z-zn.z)<zn.r+0.3*m.ty.scale){ m.playerT=time; applyElem(m,zn.el,zn.sp,1); } } } }
  zones=zones.filter(zn=>zn.t>0); }
function drawZones(t){ for(const mk of marks){ const n=mk.star?14:18, b=0.6+0.4*Math.sin(t*10); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*(mk.star?1.5:0.6); dyn(mk.x+Math.cos(a)*mk.r,0.06,mk.z+Math.sin(a)*mk.r,G(mk.star?'+':'.'),0.15,mk.c[0]*b*2,mk.c[1]*b*2,mk.c[2]*b*2,0,0); } if(mk.star)dyn(mk.x,0.08,mk.z,G('*'),0.3,mk.c[0]*2.5*b,mk.c[1]*2.5*b,mk.c[2]*2.5*b,0,0); }
  for(const zn of zones){ if(Math.hypot(zn.x-player.x,zn.z-player.z)>30)continue; const c=elemCol(zn.el), f=Math.min(1,zn.t/1.5), n=Math.round(10+zn.r*8);
  for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.3, rr=zn.r*(0.92+0.08*Math.sin(t*3+k)), b=(zn.el?0.9:0.35)*f*(0.7+0.3*Math.sin(t*4+k*1.3)); dyn(zn.x+Math.cos(a)*rr,0.05,zn.z+Math.sin(a)*rr,G(zn.el==='fire'?'^':zn.el==='ice'?'*':zn.el==='thunder'?'/':zn.el==='poison'?'%':'.'),0.15,c[0]*b*1.8,c[1]*b*1.8,c[2]*b*1.8,0,0); } } }
// a hit somewhere in the world from other code
function burstFire(i,r,str){
  const cx=i%MW, cz=(i/MW)|0, rr=Math.ceil(r);
  for(let dz=-rr;dz<=rr;dz++)for(let dx=-rr;dx<=rr;dx++){ if(Math.hypot(dx,dz)>r)continue; const x=cx+dx, z=cz+dz; if(x<0||z<0||x>=MW||z>=MH)continue; const j=z*MW+x; const tt=D.tile[j]; if(tt===TW||tt===TC||D.liquid[j]===LQ_WATER||D.liquid[j]===LQ_DEEP)continue;
    fuel[j]=Math.max(fuel[j],0.5); ignite(j,str,false); if(D.gas[j]>0.1)boom(j); }
}
function viewDir(){ const cp=Math.cos(player.pitch); return [-Math.sin(player.yaw)*cp,Math.sin(player.pitch),-Math.cos(player.yaw)*cp]; }
let projs=[];
function groundPoint(o,d,maxD){ let x=o[0], y=o[1], z=o[2], px=x, pz=z; for(let s2=0;s2<(maxD||22);s2+=0.3){ x+=d[0]*0.3; y+=d[1]*0.3; z+=d[2]*0.3;
    for(const m of monsters){ if(!foe(m))continue; const cy=m.y+0.6*m.ty.scale; if(Math.hypot(m.x-x,cy-y,m.z-z)<0.6+0.35*m.ty.scale)return [m.x,m.z]; }
    const ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL); if(ci<0||ci>=NCELL||D.tile[ci]===TW||D.tile[ci]===TX||doorBlock(ci))return [px,pz]; if(y<=0.05)return [x,z]; px=x; pz=z; }
  return [x,z]; }
let rains=[], marks=[];

// ---------------------------------------------------------------- triggers
function onRolled(){ if(BL('quickdodge'))player.qcUntil=time+(BL('quickdodge')>=2?2.5:1.5); if(BL('counter'))player.ctrUntil=time+1.5;
   for(const h of ['L','R']){ if(h==='R'&&isTwo())continue; const H=hands[h]; if(H.trig&&H.trig.type==='dodge'&&H.atk&&trigCd[h]<=0&&!swapSt){ trigCd[h]=1.0; castNow(h); } } }
function onKilledBy(m){ for(const h of ['L','R']){ if(h==='R'&&isTwo())continue; const H=hands[h]; if(!(H.trig&&H.trig.type==='kill')||!H.atk||trigCd[h]>0||swapSt)continue;
    const [ox,oy,oz]=handPoint(h); let t=null, bd=15; for(const o of monsters){ if(o===m||!foe(o))continue; const dd=Math.hypot(o.x-player.x,o.z-player.z); if(dd>=bd)continue; if(!losClear(ox,oy,oz,...mCenter(o)))continue; bd=dd; t=o; }
    if(!t)continue; const cy=t.y+0.6*t.ty.scale, d=Math.hypot(t.x-ox,cy-oy,t.z-oz)||1; trigCd[h]=0.5;
    if(((atkType(h)==='blade'||atkType(h)==='gsweep')&&Math.hypot(t.x-player.x,t.z-player.z)>2.9)||(atkType(h)==='dash'&&Math.hypot(t.x-player.x,t.z-player.z)>4.5))continue; castNow(h,{dir:[(t.x-ox)/d,(cy-oy)/d,(t.z-oz)/d],auto:true}); } }

// ---------------------------------------------------------------- finding runes: drops, the starting pedestals, the first altar, floor runes, steles by the stairs
function dropRune(m){
  if(m.ty.critter||m.ty.peaceful||m.ty.dummy)return;
  const strong=(m.maxHp||0)>=40||(m.isLead&&m.g>=0), lord=m.key==='lord'||m.ty.lord;
  if(m.key==='final')return;
  if(!lord)return;
  let at=m.cz*MW+m.cx; for(const d of [-1,MW,-MW,1,MW+1,-MW-1])if(D.tile[at+d]===TF&&!D.liquid[at+d]&&!D.items.some(o=>o.i===at+d&&!o.taken)){ at+=d; break; }
  placeAltar(at,'lordaltar'+time,{lord:true,born:time});
  for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(m.x,0.6,m.z,Math.cos(a)*1.2,0.6+mr(),Math.sin(a)*1.2,0.8,G('.'),0.12,1.6,1.4,2.2,0); }
}
// ---------------------------------------------------------------- rune altars (predictable rewards): one on the main path of each level, sometimes another off it; three choices made when you come near:
// a new rune (leaning to empty open slots), honing an equipped rune (one more affix), or healing. Lords leave an altar of strong choices. Treasuries hold the unpredictable.
function altarFill(grp){ const its=(D.items||[]).filter(o=>o.grp===grp&&o.altar); if(!its.length||its[0].rune)return; const lord=its[0].lord;
  if(its[0].forge){ const fo=forgeOptions(3); its.forEach((it,k)=>{ const f=fo[k]; Object.assign(it,f?{opt:'forge',forgeW:f.w,forgeK:f.k,forgeTo:f.to,rune:{uid:-1,type:'forgeopt',aff:{}}}:{opt:'heal',rune:{uid:-1,type:'mend',aff:{}}}); }); return; }
  const opts=[], usedT=new Set(), usedC=new Set(), held=new Set([hands.L.atk,hands.R.atk].filter(Boolean).map(r=>r.type));
  const newRune=()=>{ const empty=[]; for(const h of ['L','R']){ const H=hands[h]; for(let i=0;i<(H.slotN||2);i++)if(!H.slots[i])empty.push(mpick(['elem','mod','mod','trig'])); } for(let i=0;i<(runState.bodyOpen||0);i++)if(!hands.B['b'+i])empty.push('body');
    for(let tries=0;tries<16;tries++){ let t; if(empty.length&&mr()<0.5){ const c=empty[Math.floor(mr()*empty.length)], a=RUNE_TYPES[c].filter(t=>!lockedOf('rune',t)); t=a[Math.floor(mr()*a.length)]; } else t=randomRuneType(mr,lord?{elem:0.3,trig:0.15,mod:0.35,body:0.2}:{elem:0.4,trig:0.12,mod:0.38,body:0.1}); if(usedT.has(t)||(tries<10&&usedC.has(RUNE_DEF[t].cat)))continue; usedT.add(t); usedC.add(RUNE_DEF[t].cat); return {opt:'rune',rune:RUNE_DEF[t].cat==='mod'&&mr()<(lord?0.5:0.05)?makeStrong(t):makeRune(t,0)}; } return null; };
  const weapon=()=>{ const pool=weaponPool().filter(t=>!usedT.has(t)); if(!pool.length)return null; const t=pool[Math.floor(mr()*pool.length)]; usedT.add(t); return {opt:'rune',rune:rollTraits(makeRune(t,0),mr,depth,lord?2:0)}; };
  const heal=()=>player.hp<PLAYER_MAX*0.85?{opt:'heal',rune:{uid:-1,type:'mend',aff:{}}}:null;
  const forge=()=>{ const f=forgeOptions(1)[0]; return f?{opt:'forge',forgeW:f.w,forgeK:f.k,forgeTo:f.to,rune:{uid:-1,type:'forgeopt',aff:{}}}:null; };
  opts.push((lord||mr()<0.08)?(weapon()||newRune()):newRune()); opts.push(lord?(forge()||newRune()):newRune()); opts.push(heal()||newRune()); for(let k=0;k<3;k++)if(!opts[k])opts[k]={opt:'heal',rune:{uid:-1,type:'mend',aff:{}}};
  opts.sort(()=>mr()-0.5); its.forEach((it,k)=>Object.assign(it,opts[k])); }
// guards for altars and the strong one's room: groups added to this level's spawns, kept in their room; an altar or prize is dark until its guards are gone
function hostileKeys(){ const n={}; for(const s of (D.spawns||[])){ const ty=MTYPES[s.key]; if(!ty||ty.critter||ty.peaceful||ty.boss||s.key==='lord'||s.key==='final'||ty.habitat||ty.form==='eel')continue; n[s.key]=(n[s.key]||0)+1; } return n; }
function nextGroup(){ return (D.spawns||[]).reduce((a,s)=>Math.max(a,s.g||0),0)+1; }
function addGuards(at,r){ const ri=D.roomOf[at]; if(ri<0)return undefined; const hk=hostileKeys(), keys=Object.keys(hk); if(!keys.length)return undefined;
  const key=keys.sort((a,b)=>hk[b]-hk[a])[0], cells=D.rooms[ri].cells.filter(c=>D.tile[c]===TF&&!D.liquid[c]&&!D.solid.has(c)&&Math.hypot((c%MW)-(at%MW),((c/MW)|0)-((at/MW)|0))>=2), g=nextGroup(), n=2+(r()<0.5?1:0);
  if(cells.length<n)return undefined; for(let k=0;k<n;k++){ const c=cells.splice(Math.floor(r()*cells.length),1)[0]; D.spawns.push({key,cx:c%MW,cz:(c/MW)|0,g,lead:k===0,home:ri}); } return g; }
function strongestKey(){ const keys=Object.keys(hostileKeys()).filter(k=>!MTYPES[k].beast&&!MTYPES[k].dragon&&k!=='X'&&k!=='D'); let best=null, bh=-1; for(const k of keys){ let h=0; try{ h=statOf({ty:MTYPES[k],key:k})[0]; }catch(e){} if(h>bh){ bh=h; best=k; } } return best; }

function forgeOptions(n){ const ws=[...new Set([hands.L.atk,hands.R.atk].filter(Boolean))], cands=[];
  for(const w of ws){ const pool=Object.keys(TRAITS[w.type]||{}), tr=trList(w);
    for(const t of tr)if(t.lv<5)cands.push({w,k:t.k,from:t.lv,to:t.lv+1});
    for(const k of pool)if(!tr.some(t=>t.k===k))cands.push({w,k,from:0,to:1}); }
  const out=[]; while(out.length<n&&cands.length){ out.push(cands.splice(Math.floor(mr()*cands.length),1)[0]); } return out; }
function placeAltar(at,grp,extra){ for(let k=0;k<3;k++)D.items.push(Object.assign({i:at,kind:'rune',rune:null,grp,altar:true,slot:k,taken:false},extra||{})); }
function forgeDepthOf(k){ const h=Math.imul(runSeed^0x2f6b1c3d,2654435761)>>>0, span={cavern:[3,5],ruins:[6,8],magma:[9,11]}[k]; if(!span)return -1; return span[0]+(h>>>({cavern:0,ruins:3,magma:6}[k]))%(span[1]-span[0]+1); }
function mainPathAltars(r,free){ if(D.stratum.special||D.finalVault)return; const W=MW, N=D.tile.length, ok=i=>i>=0&&i<N&&D.tile[i]===TF&&D.liquid[i]!==LQ_DEEP&&D.liquid[i]!==LQ_LAVA;
  const bfs=s=>{ const d=new Int32Array(N).fill(-1); if(s==null||s<0||!ok(s))return d; const q=[s]; d[s]=0; for(let h=0;h<q.length;h++){ const c=q[h]; for(const o of [1,-1,W,-W]){ const j=c+o; if(ok(j)&&d[j]<0){ d[j]=d[c]+1; q.push(j); } } } return d; };
  const dS=bfs(D.start), goal=D.stairs>=0?D.stairs:(D.bstairs?D.bstairs.cell:-1), dT=bfs(goal), L=goal>=0&&dS[goal]>0?dS[goal]:0;
  const rooms=D.rooms.map((ro,ri)=>({ro,ri})).filter(o=>o.ri>0&&o.ro.cells.length>10&&!(o.ro.kindMsg&&o.ro.kindMsg.includes('鉄格子の奥')));
  const score=(ro)=>{ let best=1e9, mid=1e9; for(const c of ro.cells){ if(dS[c]<0||dT[c]<0)continue; const det=dS[c]+dT[c]-L; if(det<best){ best=det; mid=Math.abs(dS[c]-L/2); } } return {det:best,mid}; };
  const scored=rooms.map(o=>({...o,...score(o.ro)})).filter(o=>o.det<1e8);
  let hubDistRef=null; const pickCell=ro=>{ const c=ro.cells.filter(free); if(!c.length)return undefined; if(hubDistRef){ const nearC=c.filter(x=>hubDistRef[x]<=9); if(nearC.length)return nearC[Math.floor(nearC.length/2)]; } return c[Math.floor(c.length/2)]; };
  D.dS=dS; D.pathL=L;
  // the crossroads: the largest room near the middle of the main path (ordinary levels and other realms; not the first level, special levels or branches)
  let hub=null; if(L>0&&!branch&&(depth>=2||realm)&&!D.stratum.special){ for(const o of scored){ if(o.det>4)continue; let pos=0, n=0; for(const c of o.ro.cells)if(dS[c]>=0){ pos+=dS[c]; n++; } pos=n?pos/n/L:0; if(pos<0.25||pos>0.75)continue; if(!hub||o.ro.cells.length>hub.ro.cells.length)hub=o; } }
  if(hub){ const cx=hub.ro.cells.reduce((a,c)=>a+c%W,0)/hub.ro.cells.length, cz=hub.ro.cells.reduce((a,c)=>a+((c/W)|0),0)/hub.ro.cells.length; D.hub={ri:hub.ri,cx,cz}; }
  let hubDist=null; if(D.hub){ hubDist=new Float32Array(N).fill(1e9); const hc=D.rooms[D.hub.ri].cells, q=hc.slice(); for(const c of hc)hubDist[c]=0; for(let h=0;h<q.length;h++){ const c=q[h]; if(hubDist[c]>=10)continue; for(const o of [1,-1,W,-W]){ const j=c+o; if(j<0||j>=N||hubDist[j]<=hubDist[c]+1)continue; hubDist[j]=hubDist[c]+1; q.push(j); } } }
  hubDistRef=hubDist; const nearHub=o=>{ if(!D.hub)return true; for(const c of o.ro.cells)if(hubDist[c]<=10)return true; return false; };
  const sx=D.hub?D.hub.cx:D.start%W, sz=D.hub?D.hub.cz:(D.start/W)|0, angOf=ro=>Math.atan2(ro.cells.reduce((a,c)=>a+((c/W)|0),0)/ro.cells.length-sz,ro.cells.reduce((a,c)=>a+c%W,0)/ro.cells.length-sx);
  const placedA=[]; if(goal>=0)placedA.push(Math.atan2(((goal/W)|0)-sz,goal%W-sx));
  const adiff=(a,b)=>{ let d=Math.abs(a-b)%(Math.PI*2); return d>Math.PI?Math.PI*2-d:d; };
  const spreadPick=list=>{ if(!list.length)return null; const ok=list.filter(o=>placedA.every(a=>adiff(angOf(o.ro),a)>=Math.PI/3)); if(ok.length)return ok[Math.floor(r()*ok.length)];
    return list.slice().sort((p,q)=>Math.min(...placedA.map(a=>adiff(angOf(q.ro),a)),9)-Math.min(...placedA.map(a=>adiff(angOf(p.ro),a)),9))[0]; };
  const main=L>0?scored.filter(o=>o.det<=Math.max(6,L*0.15)).sort((a,b)=>a.mid-b.mid)[0]:scored[Math.floor(r()*scored.length)];
  let mainAt=main?pickCell(main.ro):undefined;
  if(mainAt===undefined&&L>0){ let best=-1, bs=1e9; for(let c=0;c<N;c++){ if(dS[c]<0||dT[c]<0||!free(c))continue; const det=dS[c]+dT[c]-L; if(det>3)continue; const sc=Math.abs(dS[c]-L/2)+det*2; if(sc<bs&&dS[c]>4&&dT[c]>4){ bs=sc; best=c; } } if(best>=0)mainAt=best; }
  if(mainAt!==undefined)placeAltar(mainAt,'altar'+levelSeed()+'m',{guardG:main&&r()<0.6?addGuards(mainAt,r):undefined});

  const sidePool=o=>o!==main&&o!==hub&&(D.hub?nearHub(o)&&o.det>=4:o.det>=12);
  const side=r()<0.2?spreadPick(scored.filter(o=>sidePool(o))):null; if(side)placedA.push(angOf(side.ro));
  if(side){ const at=pickCell(side.ro); if(at!==undefined)placeAltar(at,'altar'+levelSeed()+'s',{guardG:addGuards(at,r)}); }
  // the strong one's room: off the main path, one strong creature guarding a rare rune
  const er=spreadPick(scored.filter(o=>o!==side&&o.ro.cells.length>12&&(D.hub?sidePool(o):o.det>=5&&o!==main))), key=strongestKey(); if(er)placedA.push(angOf(er.ro));
  const roll=r(); D.eliteWhy={rooms:scored.length,far:scored.filter(o=>o.det>=5).length,er:!!er,key,roll:+roll.toFixed(2)};
  if(er&&key&&roll<0.35){ const cells=er.ro.cells.filter(free); if(cells.length>3){ const at=cells[Math.floor(cells.length/2)], g=nextGroup(), sc=cells.filter(c=>c!==at&&Math.hypot((c%MW)-(at%MW),((c/MW)|0)-((at/MW)|0))>=1.5)[0];
    if(sc!==undefined){ D.spawns.push({key,cx:sc%MW,cz:(sc/MW)|0,g,lead:true,home:er.ri,elite:true}); { const wp=weaponPool(); D.items.push({i:at,kind:'rune',rune:rollTraits(makeRune(wp[Math.floor(r()*wp.length)],0,r),r,depth,1),taken:false,elitePrize:true,guardG:g}); } } } }
  placeSpring(r,free,D.hub?scored.filter(o=>sidePool(o)):scored,spreadPick);
  if(META.grave&&!branch&&!realm&&!inter&&!gallery&&META.grave.depth===depth&&!(D.items||[]).some(o=>o.kind==='grave')){ const pool=scored.filter(o=>sidePool(o)), ro=(pool[pool.length-1]||scored[scored.length-1]||{}).ro; if(ro){ const c=ro.cells.filter(free); if(c.length)D.items.push({i:c[Math.floor(c.length/2)],kind:'grave',g:META.grave,rune:graveRune(META.grave.item),taken:false}); } }
  if(!branch&&!realm&&!inter&&forgeDepthOf(D.stratum.k)===depth){ const ro=D.hub?D.rooms[D.hub.ri]:(scored.find(o=>o.det>=3)||scored[0]||{}).ro; if(ro){ const c=ro.cells.filter(free); if(c.length){ const at=c[Math.floor(c.length*0.3)]; placeAltar(at,'forge'+levelSeed(),{forge:true}); } } }
  // at the crossroads there should be somewhere to choose: at least two side places within reach of its arrows
  if(D.hub){ const near=()=>(D.items||[]).filter(it=>!it.taken&&(it.kind==='spring'||it.elitePrize||it.vault||(it.altar&&it.slot===1&&/s$/.test(it.grp)))&&hubDist[it.i]<=11).length;
    const used=new Set((D.items||[]).map(it=>D.roomOf[it.i])); let tries=0;
    const pocket=()=>{ const taken=(D.items||[]).map(it=>it.i); const cs=[]; for(let c=0;c<N;c++){ if(!free(c)||!(hubDist[c]<=10)||dS[c]<0||dT[c]<0||dS[c]+dT[c]-L<5)continue; if(taken.some(t=>Math.hypot((t%W)-(c%W),((t/W)|0)-((c/W)|0))<6))continue; cs.push(c); } if(!cs.length)return undefined;
      const ang=c=>Math.atan2(((c/W)|0)-D.hub.cz,c%W-D.hub.cx), ok=cs.filter(c=>placedA.every(a=>adiff(ang(c),a)>=Math.PI/3)); const pick=(ok.length?ok:cs)[Math.floor(r()*(ok.length?ok:cs).length)]; placedA.push(ang(pick)); return pick; };
    while(near()<2&&tries++<4){ const pool=scored.filter(o=>sidePool(o)&&!used.has(o.ri)&&o.ro.cells.length>6); const o=spreadPick(pool); let at;
      if(o){ used.add(o.ri); placedA.push(angOf(o.ro)); at=pickCell(o.ro); } else at=pocket(); if(at===undefined)continue;
      D.items.push({i:at,kind:'spring',taken:false}); }
    D.hubNear=near(); }
  // 3: wandering groups near the entrance move on toward the stairs (camps and guards stay put)
  if(L>0){ const groups=new Map(); for(const sp of D.spawns){ if(sp.camp||sp.home!==undefined||sp.elite||sp.key==='lord'||sp.key==='final'||sp.g==null||sp.g<0)continue; const ty=MTYPES[sp.key]; if(!ty||ty.habitat||ty.critter||ty.peaceful||ty.boss)continue; if(!groups.has(sp.g))groups.set(sp.g,[]); groups.get(sp.g).push(sp); }
    const late=[]; for(let c=0;c<N;c++)if(dS[c]>L*0.7&&dT[c]>4&&free(c))late.push(c);
    for(const [g,list] of groups){ const c0=list[0].cz*W+list[0].cx; if(!(dS[c0]>=0&&dS[c0]<L*0.3)||r()>=0.5||!late.length)continue; const nc=late[Math.floor(r()*late.length)];
      for(const sp of list){ let best=nc; for(let k=0;k<8;k++){ const c=nc+Math.round((r()-0.5)*4)+Math.round((r()-0.5)*4)*W; if(free(c)&&dS[c]>=0){ best=c; break; } } sp.cx=best%W; sp.cz=(best/W)|0; } } }
  // 4: on some levels a small band waits in the room before the stairs; the stairs stay sealed until it falls
  if(L>0&&D.stairs>=0&&!D.finalVault&&!D.stratum.special&&(branch?branch.lvl<branch.len:depth>=2&&depth<FINAL_DEPTH)&&!realm&&r()<0.3){ const hk=hostileKeys(), keys=Object.keys(hk); if(keys.length){ const key=keys.sort((a,b)=>hk[b]-hk[a])[0], g=nextGroup();
      const cells=[]; for(let c=0;c<N;c++)if(dT[c]>=2&&dT[c]<=5&&free(c))cells.push(c); const n=2+(r()<0.5?1:0);
      if(cells.length>=n){ for(let k=0;k<n;k++){ const c=cells.splice(Math.floor(r()*cells.length),1)[0]; D.spawns.push({key,cx:c%W,cz:(c/W)|0,g,lead:k===0}); } D.stairGuard=g; } } }
  }
// the treasury's prize: taking it wakes guardians, or brings the ceiling down
let rockfall=null;
function vaultArea(it,R){ const out=[], cx=it.i%MW, cz=(it.i/MW)|0; for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++){ const c=(cz+dz)*MW+cx+dx; if(c<0||c>=D.tile.length||D.tile[c]!==TF||D.liquid[c]||Math.hypot(dx,dz)>R)continue; out.push(c); } return out; }
function vaultSprung(it){ const ri=D.roomOf[it.i], room=ri>=0&&D.rooms[ri]&&D.rooms[ri].cells.length>6?D.rooms[ri]:{cells:vaultArea(it,4)};
  if(it.ev==='guard'){ const pool=monsters.filter(m=>!m.dead&&!m.ty.critter&&!m.ty.peaceful&&!m.ty.boss&&m.key!=='lord'&&MTYPES[m.key]); const key=pool.length?pool.sort((a,b)=>(b.maxHp||0)-(a.maxHp||0))[0].key:'O';
    const cells=vaultArea(it,5).filter(c=>{ const [x,z]=cpos(c); return Math.hypot(x-player.x,z-player.z)>2.0; });
    for(let k=0;k<2&&cells.length;k++){ const c=cells.splice(Math.floor(mr()*cells.length),1)[0]; const m=makeMonster({key,cx:c%MW,cz:(c/MW)|0,g:-1,lead:true}); m.sleep=false; m.aware=1; m.noticed=true; m.alert=1; m.guardian=true; monsters.push(m);
      for(let q=0;q<24;q++){ const a=mr()*6.28; spawn(m.x,0.2+mr()*1.6,m.z,Math.cos(a)*0.8,mr()*0.8,Math.sin(a)*0.8,0.9,G(mpick(['#','%','.'])),0.14,0.8,0.78,0.85,0); } }
    sRumble(0.4,1.2); msg('<b style="color:#ffb0a0">!</b>石像の目に光が灯った。宝の番人たちが、目を覚ます。'); }
  else if(room.cells.length){ rockfall={t:0,dur:9,cells:room.cells.filter(c=>D.tile[c]===TF),rocks:[],next:0.2}; sRumble(0.5,2.0); msg('<b style="color:#ffd0a0">!</b>天井が軋み、崩れ始めた。早く外へ。'); } }
function updateRockfall(dt){ if(!rockfall)return; const R=rockfall; R.t+=dt; R.next-=dt;
  if(R.t<R.dur&&R.next<=0){ R.next=0.28+mr()*0.2; const near=R.cells.filter(c=>{ const [x,z]=cpos(c); return Math.hypot(x-player.x,z-player.z)<4.5; }); const c=(near.length&&mr()<0.7?near:R.cells)[Math.floor(mr()*(near.length&&mr()<0.7?near.length:R.cells.length))]; if(c!==undefined){ const [x,z]=cpos(c); R.rocks.push({x:x+(mr()-0.5)*1.2,z:z+(mr()-0.5)*1.2,t:0}); } }
  for(const k of R.rocks){ k.t+=dt; if(k.t<0.9){ const f=k.t/0.9; for(let q=0;q<10;q++){ const a=q/10*Math.PI*2; dyn(k.x+Math.cos(a)*0.55,0.04,k.z+Math.sin(a)*0.55,G('.'),0.13,0.9+0.8*f,0.45+0.3*f,0.2,0,0); } dyn(k.x,3.2-2.6*f*f,k.z,G('#'),0.3,0.7,0.66,0.6,0,0); }
    else if(!k.hit){ k.hit=true; for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(k.x,0.2,k.z,Math.cos(a)*1.4,0.6+mr()*1.2,Math.sin(a)*1.4,0.7,G(mpick(['#','%','.',','])),0.14,0.75,0.7,0.62,1); } if(Math.hypot(k.x-player.x,k.z-player.z)<0.65)hurtPlayer(6,'落石'); for(const m of monsters)if(!m.dead&&Math.hypot(k.x-m.x,k.z-m.z)<0.65)damageMonster(m,6,'落石'); } }
  R.rocks=R.rocks.filter(k=>k.t<1.2); if(R.t>=R.dur&&!R.rocks.length)rockfall=null; }

// ---------------------------------------------------------------- healing: no regeneration over time. Part of each wound lingers as recoverable (shown on the bar); strike back before it fades
// and the light of what you strike flows into you; a kill gives more. Altars, a little on going down, rare healing springs, and the town and the oracle heal.
let rallyMotes=[], hpFlash=0, rallyShown=-1, rallyChime=0;
const RALLY_FROM=new Set(['blade','magic','fire','thunder','poison','ice']);
function rallyOnHit(m,n,how){ if(!(player.rally>0)||!RALLY_FROM.has(how)||m.ty.critter||!(time-(m.playerT||-99)<1.2))return; const mn=bodyN('mend');
  let gain=Math.min(player.rally,n*0.5*(1+0.5*mn)); const kill=m.hp<=0; if(kill)gain=Math.min(player.rally,gain+3+2*mn+3*BL('devour')); if(gain<=0.05)return; player.rally-=gain;
  const sc=m.ty.scale||1, k=kill?Math.min(16,6+Math.round(gain*2)):Math.min(5,1+Math.round(gain)), per=gain/k, src=kill&&m.form?m.form:null;
  for(let q=0;q<k;q++){ let x=m.x,y=m.y+0.6*sc,z=m.z; if(src){ const p=src[Math.floor(mr()*src.length)], cy=Math.cos(m.yaw), sy=Math.sin(m.yaw); x=m.x+(p.x*cy+p.z*sy)*sc; y=m.y+p.y*sc; z=m.z+(-p.x*sy+p.z*cy)*sc; }
    rallyMotes.push({x0:x,y0:y,z0:z,t:-q*0.03,dur:0.38+mr()*0.12,amt:per,c:m.ty.col||[1,0.9,0.7],wob:mr()*6.28}); } }
function updateRally(dt){ if(dead)return; const mn=bodyN('mend');
  if(player.rally>0&&time-(player.lastHurt||-99)>0.6){ player.rally=Math.max(0,player.rally-dt*(player.rallyRate||2)); }
  const tx=player.x, ty=(camMode==='tps'?1.0:player.eye-0.35), tz=player.z;
  for(const p of rallyMotes){ p.t+=dt; if(p.t<0)continue; const f=Math.min(1,p.t/p.dur), e=f*f*(3-2*f), arc=Math.sin(f*Math.PI)*0.35;
    const x=p.x0+(tx-p.x0)*e+Math.cos(p.wob)*arc*0.4, y=p.y0+(ty-p.y0)*e+arc, z=p.z0+(tz-p.z0)*e+Math.sin(p.wob)*arc*0.4, b=1.6+1.2*f;
    dyn(x,y,z,G(f<0.5?'*':'.'),0.12,(p.c[0]*0.5+0.6)*b,(p.c[1]*0.5+0.55)*b,(p.c[2]*0.5+0.4)*b,0,0);
    if(f>=1&&!p.done){ p.done=true; player.hp=Math.min(PLAYER_MAX,player.hp+p.amt); hpFlash=0.35; if(sndReady()&&time-rallyChime>0.12){ rallyChime=time; sChime(player.x,player.z,0.12); } } }
  rallyMotes=rallyMotes.filter(p=>!p.done);
  hpFlash=Math.max(0,hpFlash-dt);
  const rs=Math.round((player.rally||0)*4)+(hpFlash>0?1000:0); if(rs!==rallyShown){ rallyShown=rs; renderStatus(); } }
// healing springs: rare, off the path; one use heals fully
function placeSpring(r,free,scored,spreadPick){ if(D.stratum.special||D.finalVault||r()>=0.25)return; const pool=(scored||[]).filter(o=>o.det>=5&&!D.items.some(it=>D.roomOf[it.i]===o.ri)); const pick=spreadPick?spreadPick(pool.length?pool:(scored||[])):(pool.length?pool:(scored||[]))[Math.floor(r()*Math.max(1,(pool.length?pool:(scored||[])).length))];
  if(!pick)return; const c=pick.ro.cells.filter(free); if(!c.length)return; D.items.push({i:c[Math.floor(c.length/2)],kind:'spring',taken:false}); }
function drawSprings(t){ for(const it of (D.items||[])){ if(it.kind!=='spring')continue; const [x,z]=cpos(it.i); if(Math.hypot(x-player.x,z-player.z)>26)continue; const used=it.taken;
    for(let k=0;k<16;k++){ const a=k/16*Math.PI*2+t*0.25, rr=0.55+0.05*Math.sin(t*2+k), b=used?0.25:0.7+0.3*Math.sin(t*1.8+k); dyn(x+Math.cos(a)*rr,0.05,z+Math.sin(a)*rr,G('~'),0.15,0.35*b,0.85*b,1.0*b,0,0); }
    if(!used){ dyn(x,0.06,z,G('o'),0.3,0.8,1.6,2.0,0,0); if(mr()<0.2)spawn(x+(mr()-0.5)*0.6,0.1,z+(mr()-0.5)*0.6,0,0.6,0,1.4,G(mpick(['.','\''])),0.1,0.6,1.5,1.8,0); } } }

function placeRunesForLevel(){
  D.items=D.items||[]; const seed=levelSeed(), r=mulberry32(seed^0x5eed1);
  const free=c=>c>=0&&c<NCELL&&D.tile[c]===TF&&!D.liquid[c]&&!D.solid.has(c)&&c!==D.stairs&&c!==D.upstairs&&!D.items.some(it=>it.i===c);
  if(depth===1&&!branch&&!realm&&!runState.startChosen){
    const s=D.start, cand=[]; for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){ const d=Math.hypot(dx,dz); if(d<1.8||d>3.2)continue; const c=s+dx+dz*MW; if(free(c))cand.push([Math.atan2(dz,dx),c]); }
    cand.sort((a,b)=>a[0]-b[0]); const els=RUNE_TYPES.elem.slice().sort(()=>r()-0.5).slice(0,3);
    if(cand.length>=3){ const step=cand.length/3; for(let k=0;k<3;k++)D.items.push({i:cand[Math.floor(k*step+step/2)][1],kind:'rune',rune:makeRune(els[k],0,r),grp:'start',pedestal:true,taken:false}); }
  }
  if(depth===1&&!branch&&!realm&&!runState.altar1){
    const rooms=D.rooms.filter((ro,ri)=>ri>0&&!ro.cave&&ro.cells.length>12); const ro=rooms.length?rooms[Math.floor(r()*rooms.length)]:null;
    const c=ro?ro.cells.filter(free):[]; if(c.length){ const at=c[Math.floor(c.length/2)];
      const opts=[...RUNE_TYPES.elem.slice().sort(()=>r()-0.5).slice(0,2),RUNE_TYPES.trig[Math.floor(r()*2)]];
      opts.forEach((t,k)=>D.items.push({i:at,kind:'rune',rune:makeRune(t,rollAffN(r,0.1),r),grp:'altar1',altar:true,slot:k,taken:false})); } }
  else if(depth>1||branch||realm)mainPathAltars(r,free);
  for(const it of D.items)if(it.vault&&!it.ev)it.ev=r()<0.5?'guard':'collapse';
  // steles beside the stairs and gates: swap runes there at once
  D.steles=[]; for(const c0 of [D.stairs,D.upstairs,D.bstairs&&D.bstairs.cell,D.portal&&D.portal.cell]){ if(c0===undefined||c0===null||c0<0)continue;
    const nb=[1,-1,MW,-MW,MW+1,MW-1,-MW+1,-MW-1].map(o=>c0+o).find(free); if(nb!==undefined)D.steles.push({i:nb,g:RUNE_CHARS[Math.floor(r()*RUNE_CHARS.length)]}); }
  D.items.forEach((it,k)=>{ if(runState.taken.has(seed+':'+k+':'+it.kind))it.taken=true; });
}
const nearStele=()=>(gallery&&gallery.mode==='range')||(D.steles||[]).some(s=>{ const [x,z]=cpos(s.i); return Math.hypot(x-player.x,z-player.z)<2.6; })||(D.items||[]).some(o=>o.altar&&o.slot===1&&(()=>{ const [x,z]=cpos(o.i); return Math.hypot(x-player.x,z-player.z)<2.6; })());
const guardedNow=it=>it.guardG!==undefined&&monsters.some(m=>!m.dead&&m.g===it.guardG);
function pickupItems(){
  for(let k=0;k<(D.items||[]).length;k++){ const it=D.items[k]; if(it.taken)continue; if(it.kind==='rune'&&it.guardG!==undefined){ const gd=guardedNow(it); if(it.wasGuarded&&!gd&&!(D.lit||(D.lit=new Set())).has(it.grp||it.i)){ D.lit.add(it.grp||it.i); const [lx,lz]=cpos(it.i); sChime(lx,lz,0.5); msg(it.elitePrize?'<b style="color:#ffd27a">*</b>番人が倒れた。守られていたルーンが、手の届く光になった。':'<b style="color:#ffd27a">_</b>祭壇に光が灯った。'); } it.wasGuarded=gd; if(gd)continue; }
    if(it.kind==='legend'){ if(it.born&&time-it.born<1)continue; const [lx,lz]=cpos(it.i); if(Math.hypot(lx-player.x,lz-player.z)<0.9){ it.taken=true; pickLegend(it); } continue; }
    if(it.kind==='grave'){ const [gx,gz]=cpos(it.i); if(Math.hypot(gx-player.x,gz-player.z)<0.9){ it.taken=true; takeRune(it.rune); msg(`<b style="color:#c8c8d8">+</b>前の冒険者の形見を、墓から拾った：${thingLabel(it.rune)}`); META.grave=null; saveMeta(); sChime(gx,gz,0.4); } continue; }
    if(it.kind==='spring'){ const [sx,sz]=cpos(it.i); if(player.hp<PLAYER_MAX-0.5&&Math.hypot(sx-player.x,sz-player.z)<0.9){ it.taken=true; runState.taken.add(levelSeed()+':'+k+':spring'); player.hp=PLAYER_MAX; player.rally=0; hpFlash=0.6; renderStatus(); sChime(sx,sz,0.5); setTimeout(()=>sChime(sx,sz,0.35),200); msg('<b style="color:#8fe0ff">~</b>泉の光が体を満たし、傷がすっかり癒えた。泉は静かに光を失った。'); for(let q=0;q<30;q++){ const a=mr()*6.28; spawn(player.x+Math.cos(a)*0.5,0.2+mr(),player.z+Math.sin(a)*0.5,Math.cos(a)*0.4,0.8+mr(),Math.sin(a)*0.4,1.0,G(mpick(['*','.','~'])),0.12,0.8,1.8,2.2,0); } } continue; }
    if(it.kind==='slot'){ if(it.born&&time-it.born<1)continue; const [sx,sz]=cpos(it.i); if(Math.hypot(sx-player.x,sz-player.z)<0.9){ it.taken=true; openSlot(it.i); } continue; }
    if(it.kind!=='rune'||!it.rune)continue; if(it.born&&time-it.born<0.6)continue; const [x,z]=cpos(it.i);
    if(it.altar)continue; if(Math.hypot(x-player.x,z-player.z)>0.75)continue;
    grabItem(it,k,x,z); }
}
function grabItem(it,k,x,z,dest){
    it.taken=true; runState.taken.add(levelSeed()+':'+k+':rune');
    if(it.grp){ D.items.forEach((o,j)=>{ if(o!==it&&o.grp===it.grp&&!o.taken){ o.taken=true; runState.taken.add(levelSeed()+':'+j+':rune'); const [ox,oz]=cpos(o.i); for(let q=0;q<12;q++){ const a=mr()*6.28; spawn(ox+(o.altar?(o.slot-1)*0.55:0),0.95,oz,Math.cos(a)*0.8,0.3+mr()*0.6,Math.sin(a)*0.8,0.9,G('.'),0.1,0.8,0.75,1.0,0); } } }); }
    if(it.grp==='start')runState.startChosen=true; if(it.grp==='altar1')runState.altar1=true;
    if(it.opt==='forge'){ const w=it.forgeW, t=trList(w).find(t=>t.k===it.forgeK); if(t)t.lv=it.forgeTo; else { w.traits=w.traits||[]; w.traits.push({k:it.forgeK,lv:it.forgeTo}); }
      msg(`<b style="color:#bcdcff">T</b>${RUNE_DEF[w.type].name}の「${trName(w.type,{k:it.forgeK})}」が Lv${it.forgeTo} になった。`); sChime(x,z,0.5); renderHotbar(); if(invOpen)renderInv(); return; }
    if(it.opt==='open'){ applyOpen(it.target); if(runState.slotPend===it.grp)runState.slotPend=null; msg(`<b style="color:#ffe3a0">{ }</b>${it.label}が開いた。`); sChime(x,z,0.5); return; }
    if(it.opt==='heal'){ player.hp=Math.min(PLAYER_MAX,player.hp+PLAYER_MAX*0.7); renderStatus(); msg('<b style="color:#ff9aa8">+</b>温かな光が、傷を塞いでいく。'); sChime(x,z,0.45); return; }
    if(it.opt==='hone'){ const ru=allRunes().find(o=>o.uid===it.hone.uid); if(ru){ ru.aff[it.hone.k]=it.hone.v; msg(`<b class="rn" style="color:${css(runeCol(ru))}">${RUNE_DEF[ru.type].ch}</b>${RUNE_DEF[ru.type].name}のルーンに、${AFFIX[it.hone.k].fmt(it.hone.v)} が宿った。`); renderHotbar(); if(invOpen)renderInv(); } else msg('<span class="lab">宿すはずのルーンは、もう手元にない。光は静かに消えた。</span>'); sChime(x,z,0.45); return; }
    if(dest){ placeChosen(it.rune,dest,!!it.altar); sChime(x,z,0.45); return; }
    takeRune(it.rune,it.grp==='start'?'R':null,!!it.altar); sChime(x,z,0.45); if(it.vault)vaultSprung(it);
}
// a rune put where the player chose: into a hand (what was there goes to the bag), or into the bag
function placeChosen(ru,dest,fromAltar){ if(!RSEEN.has(ru.type)){ RSEEN.add(ru.type); saveSet('al_runes',RSEEN); } if(mergeMod(ru))return; const def=RUNE_DEF[ru.type], col=runeCol(ru);
  bag.push(ru); msg(`<b class="rn" style="color:${css(col)}">${def.ch}</b>${thingLabel(ru)}を手にした。袋に収めた。Tab で付け替えられる（祭壇のそばなら詠唱はいらない）。`); renderHotbar(); if(invOpen)renderInv(); }
// the altar's comparison panel: near a lit altar, its three choices side by side; 1, 2, 3 choose (touching still works). The game does not pause.
let altarNear=null, altarPanelKey='', altarSel=null, altarAim=-1, altarOpen=false, altarDismissed=null;
function runeDest(ru){ const def=RUNE_DEF[ru.type], cat=def.cat;
  if(cat==='body'){ const i=[0,1].slice(0,runState.bodyOpen||0).find(i=>!hands.B['b'+i]); return i!==undefined?'身の護符の枠へ':'袋へ'; }
  if(cat==='atk'){ const h=['R','L'].find(h=>!hands[h].atk); return h?`${h==='L'?'左':'右'}手へ`:'袋へ'; }
  const p=freeSlotFor(ru); return p?`${p[0]==='L'?'左':'右'}手のルーンの枠へ`:'袋へ'; }
function altarLine(o){ const K=t=>t+'　'.repeat(Math.max(1,7-t.length));
  if(o.opt==='heal')return `${K('癒し')}<b style="color:#ff9aa8">+</b> 体力 ${Math.round(player.hp)} → ${Math.round(Math.min(PLAYER_MAX,player.hp+PLAYER_MAX*0.7))}`;
  if(o.opt==='open')return `${K('枠を開ける')}<b style="color:#ffe3a0">{ }</b> ${o.label}`;
  if(o.opt==='forge'){ const w=o.forgeW, cur=(trList(w).find(t=>t.k===o.forgeK)||{lv:0}).lv; return `${K('鍛える')}<span style="color:#bcdcff">${RUNE_DEF[w.type].name}</span>の ${trName(w.type,{k:o.forgeK})}　<span class="lab">${cur?`Lv${cur} → Lv${o.forgeTo}`:`を足す（Lv1）`}</span>`; }
  const d=RUNE_DEF[o.rune.type], br=CAT_BR[d.cat]||['',''], kind=d.cat==='atk'?'武器':d.cat==='body'?'護符':'ルーン';
  if(d.cat==='atk'){ const tr=trList(o.rune), wc=weaponCol(o.rune); return `${K(kind)}<span${wc?` style="color:${wc}"`:''}>${d.name}</span>　<span class="lab">${tr.length?tr.map(t=>`${trName(o.rune.type,t)} Lv${t.lv}`).join('・'):d.desc}</span>`; }
  return `${K(kind)}${br[0]}<b class="rn" style="color:${css(runeCol(o.rune))}">${d.ch}</b> <span${o.rune.strong?` style="color:${css(TIER_COL[3])}"`:''}>${runeName(o.rune)}</span>${br[1]}　<span class="lab">${CAT_NAME[d.cat]}${o.rune.strong?'・強い版':''}</span>`; }
function altarDetail(o){ if(!o)return ['<span class="lab">選択肢にマウスを乗せると、ここに説明が出る</span>','','','',''];
  if(o.opt==='heal')return ['<b style="color:#ff9aa8">+</b> 癒し',`    <span class="lab">体力 ${Math.round(player.hp)} → ${Math.round(Math.min(PLAYER_MAX,player.hp+PLAYER_MAX*0.7))}</span>`,'    <span class="lab">温かな光が、傷を大きく塞ぐ</span>','',''];
  if(o.opt==='open')return [`<b style="color:#ffe3a0">{ }</b> ${o.label}`,'    <span class="lab">選ぶと、その枠が開く。ほかの選択肢は消える</span>','','',''];
  if(o.opt==='forge'){ const w=o.forgeW; return [`<b style="color:#bcdcff">T</b> ${RUNE_DEF[w.type].name}を鍛える`,`    <span class="lab">${trName(w.type,{k:o.forgeK})} Lv${o.forgeTo}：${trDesc(w.type,{k:o.forgeK,lv:o.forgeTo})}</span>`,'    <span class="dim">今持っている武器が、その場で鍛えられる</span>','','']; }
  return detailLines(o.rune); }
const ALTAR_W=72;
function altarOpts(){ return [0,1,2].map(k=>D.items.find(o=>o.grp===altarNear&&o.slot===k&&!o.taken)).filter(Boolean); }
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
    el.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('button'); if(!b||!altarOpen)return; e.stopPropagation();
      if(b.dataset.cancel){ closeAltar(true); return; } if(b.dataset.k!==undefined)chooseAltar(+b.dataset.k); });
    el.addEventListener('mouseover',e=>{ if(!altarOpen)return; const b=e.target.closest&&e.target.closest('button[data-k]'); setAltarDetail(b?altarOpts().find(o=>o.slot===+b.dataset.k):null); });
    el.addEventListener('contextmenu',e=>{ e.preventDefault(); if(altarOpen)closeAltar(true); }); } }
function setAltarDetail(o){ const el=document.getElementById('altarp'); if(!el)return; const L=altarDetail(o); el.querySelectorAll('.adet').forEach((sp,i)=>{ sp.innerHTML=padTo(clipHtml(L[i]||'',ALTAR_W-4),ALTAR_W-3); }); }
function openAltar(){ const el=document.getElementById('altarp'); if(!el)return; altarOpen=true; document.body.classList.toggle('paused',true);
  if(castSt){ castSt=null; beamSegs=[]; } if(locked&&document.exitPointerLock)document.exitPointerLock(); renderAltar(); el.classList.add('show','open'); renderHotbar(); }
function closeAltar(dismiss){ const el=document.getElementById('altarp'); altarOpen=false; if(dismiss)altarDismissed=altarNear; if(el)el.classList.remove('show','open'); document.body.classList.toggle('paused',isPaused());
  if(!plFailed&&started&&!dead)tryLock(); updateResume(); }
function updateAltarPanel(){ const el=document.getElementById('altarp'); if(!el)return; if(lvlOpen)return; if(lvl.pending>0&&started&&!dead&&!isPaused()){ openLevelUp(); return; }
  if(altarOpen){ if(!D||!started||dead||!altarOpts().length)closeAltar(false); return; }
  altarNear=null;
  if(started&&!dead&&!isPaused()&&D){ let best=null, bd=1.5; for(const it of (D.items||[])){ if(it.taken||!it.altar||!it.rune||it.slot!==1)continue; if(it.guardG!==undefined&&guardedNow(it))continue; const [x,z]=cpos(it.i), d=Math.hypot(x-player.x,z-player.z); if(d<bd){ bd=d; best=it; } } if(best)altarNear=best.grp; }
  if(!altarNear){ altarDismissed=null; if(el.classList.contains('show'))el.classList.remove('show','open'); return; }
  if(altarDismissed===altarNear)return;
  openAltar(); }
function chooseAltar(n){ if(!altarNear)return false; const k=D.items.findIndex(o=>o.grp===altarNear&&o.slot===n&&!o.taken); if(k<0)return false; const it=D.items[k];
  const [x,z]=cpos(it.i); if(!it.opt||it.opt==='rune')grabItem(it,k,x+(it.slot-1)*0.55,z,'bag'); else grabItem(it,k,x+(it.slot-1)*0.55,z); altarSel=null; altarPanelKey=''; if(altarOpen)closeAltar(false); return true; }
function altarPlace(dest){ if(!altarSel)return false; const k=D.items.findIndex(o=>o.grp===altarSel.grp&&o.slot===altarSel.slot&&!o.taken); altarSel=null; altarPanelKey=''; if(k<0)return false; const it=D.items[k], [x,z]=cpos(it.i); grabItem(it,k,x+(it.slot-1)*0.55,z,dest); return true; }

function mergeMod(ru){ if(RUNE_DEF[ru.type].cat!=='mod'||ru.strong)return false; const tw=bag.find(b=>b.type===ru.type&&!b.strong); if(!tw)return false; tw.strong=true; msg(`<b class="rn" style="color:${css(TIER_COL[3])}">${RUNE_DEF[ru.type].ch}</b>2つの「${RUNE_DEF[ru.type].nm}」のルーンが、ひとつの強い版にまとまった（${runeName(tw)}）。`); renderHotbar(); if(invOpen)renderInv(); return true; }
function takeRune(ru,prefer,fromAltar){
  if(!RSEEN.has(ru.type)){ RSEEN.add(ru.type); saveSet('al_runes',RSEEN); }
  if(mergeMod(ru))return;
  const def=RUNE_DEF[ru.type], col=runeCol(ru), order=prefer?[prefer,prefer==='R'?'L':'R']:['R','L']; let where='';
  if(def.cat==='body'){ const i=[0,1].slice(0,runState.bodyOpen||0).find(i=>!hands.B['b'+i]); if(i!==undefined){ hands.B['b'+i]=ru; where='身に着けた'; } else { bag.push(ru); where='袋に収めた'; } }
  else if(def.cat==='atk'){ const two=def.two, h=two?(!hands.L.atk&&!hands.R.atk?'R':null):(isTwo()?null:order.find(h=>!hands[h].atk)); if(h){ equipWeapon(h,ru); where=two?'両手で持った':`${h==='L'?'左':'右'}手に持った`; } else { bag.push(ru); where='袋に収めた'; } }
  else { const p=freeSlotFor(ru,order); if(p){ slotSet(p[0],p[1],ru); where=`${p[0]==='L'?'左':'右'}手に宿った`; } else { bag.push(ru); where='袋に収めた'; } }
  syncHands(); msg(`<b class="rn" style="color:${css(col)}">${def.ch}</b>${thingLabel(ru)}を手にした。${where}。`); renderHotbar(); if(invOpen)renderInv();
}
// ---------------------------------------------------------------- drawing: runes on the floor, pedestals, altars, steles, beams, a ring while swapping, the chant at your hands
// ---------------------------------------------------------------- what lies ahead (stage B): not told in words but felt - what leaks up the stairs, traces at branch doors, the light of other realms;
// quiet enough to notice only up close
const STRATUM_OMEN={
 cavern:{col:[0.55,0.85,0.5],gl:[',','.',"'"],vy:0.5,look:'下から、湿った土と苔の匂いが上がってくる。遠くで、水の滴る音がする',snd:'drip'},
 ruins:{col:[0.78,0.64,1.0],gl:['.','ᛁ','ᚱ','ᛊ',':'],vy:0.35,look:'下から、古い石の冷たい空気が流れてくる。遠くで、鐘のような響きがする',snd:'chime'},
 magma:{col:[1.0,0.42,0.12],gl:['*',"'",'.'],vy:0.9,look:'下から、熱い風が吹き上がってくる。床が赤く照らされている',snd:'rumble',glow:[1.0,0.35,0.1]},
 abyss:{col:[0.55,0.42,0.95],gl:['.',':','`'],vy:0.25,look:'下から、冷たい闇が這い上がってくる。かすかな囁きが聞こえる',snd:'whisper',glow:[0.35,0.2,0.7]},
};
const SPECIAL_OMEN={
 town:{col:[1.0,0.78,0.45],gl:['.','*'],vy:0.4,look:'下から、焚き火の匂いと、かすかな人の声がする',snd:'drip'},
 bigroom:{col:[0.82,0.84,0.95],gl:['.'],vy:0.6,look:'下から、広い空間を渡る風の音がする',snd:'wind'},
 oracle:{col:[1.0,0.9,0.55],gl:['*','.'],vy:0.3,look:'下から、澄んだ鈴の音と、静かな水音が聞こえる',snd:'chime'},
 fortress:{col:[1.0,0.58,0.25],gl:['*','.',"'"],vy:0.7,look:'下から、熱気と、鉄を打つような響きが上がってくる',snd:'rumble'},
};
const BRANCH_OMEN={
 crypt:{col:[0.62,0.82,1.0],look:'周りに骨が散らばり、冷たい霧が這い出している',snd:'chant'},
 lair:{col:[1.0,0.62,0.32],look:'床に深い爪痕が刻まれている。奥から、温かい獣の息が漂ってくる',snd:'growl'},
 sunken:{col:[0.45,0.8,0.98],look:'床が濡れて光っている。奥から、水の音と泡の弾ける音がする',snd:'bubble'},
 nest:{col:[0.88,0.88,0.95],look:'蜘蛛の糸が絡みついている。奥で、何かがかさかさと動く',snd:'scuttle'},
 snake:{col:[0.62,0.86,0.45],look:'脱ぎ捨てられた蛇の皮が落ちている。奥から、低いシューという音がする',snd:'hiss'},
};
const REALM_OMEN={
 ice:{col:[0.75,0.92,1.0],gl:['*','.'],vy:-0.25,look:'門の周りの床に霜が降り、凍てついた冷気が流れ出している',frost:true,snd:'wind'},
 lab:{col:[1.0,0.45,0.88],gl:['ᛁ','ᚱ','ᛊ','*'],vy:0.2,look:'門の周りに、宙に浮かぶ文字の欠片と、魔法陣の光が漂っている',snd:'chime'},
 volcano:{col:[1.0,0.5,0.15],gl:["'",'.','*'],vy:0.6,look:'門の向こうから、灰と熱気が吹きつけてくる',snd:'rumble'},
};
const stratumAtDepth=d=>STRATA.find(s=>d>=s.from&&d<=s.to);
function computeOmen(){ const o={stairs:null,branch:null,portal:null,traces:[],sndT:{}};
  if(branch){ if(branch.lvl<branch.len)o.stairs={kind:'branch',key:branch.key,strong:branch.lvl+1===branch.len}; }
  else if(!realm&&D.stairs>=0&&!D.finalVault&&depth<FINAL_DEPTH){ const ik=!inter?interAfter(depth):null; if(ik)o.stairs={kind:'special',key:ik}; else { const nd=depth+1, a=inter?SPECIALS[inter.key]:stratumAtDepth(depth), b=stratumAtDepth(nd); if(a&&b&&a.k!==b.k)o.stairs={kind:'stratum',key:b.k}; } }
  if(D.bstairs)o.branch={key:D.bstairs.key,cell:D.bstairs.cell};
  if(D.portal)o.portal={key:D.portal.key,cell:D.portal.cell};
  const lay=(cell,key,strong)=>{ const [cx,cz]=cpos(cell), n=strong?44:24, R=strong?6:4.2, rr=mulberry32((cell*7919+runSeed)>>>0);
    for(let k=0;k<n;k++){ const a=rr()*6.28, d=0.9+rr()*(R-0.9), x=cx+Math.cos(a)*d, z=cz+Math.sin(a)*d, ci=((z/CELL)|0)*MW+((x/CELL)|0); if(ci<0||ci>=D.tile.length||D.tile[ci]!==TF)continue; o.traces.push({x,z,key,r:rr(),a:rr()*6.28}); } };
  if(o.branch)lay(o.branch.cell,o.branch.key,false);
  if(o.stairs&&o.stairs.kind==='branch')lay(D.stairs,o.stairs.key,o.stairs.strong);
  return o; }
const omenOf=()=>D?(D.omen||(D.omen=computeOmen())):null;
function omenSound(kind,x,z){ if(!sndReady())return; const d=Math.hypot(x-player.x,z-player.z), v=Math.max(0.05,1-d/10);
  if(kind==='drip')sDrip(x,z,0.4*v); else if(kind==='chime'||kind==='chant')sChime(x,z,0.22*v); else if(kind==='rumble'||kind==='growl')sRumble(0.18*v,kind==='growl'?0.9:1.6);
  else if(kind==='whisper'||kind==='wind'||kind==='hiss')sHiss(x,z,kind==='hiss'?0.7:1.4); else if(kind==='bubble')sBubble(x,z,0.3*v); else if(kind==='scuttle')sHiss(x,z,0.18); }
function drawOmens(t,dt){ if(!D||gallery)return; const o=omenOf(); if(!o)return;
  const near=(x,z,r)=>Math.hypot(x-player.x,z-player.z)<r, rate=(n)=>mr()<n*(dt||0.016);
  const rise=(x,z,def,n,spread)=>{ if(!rate(n))return; const a=mr()*6.28, rr=mr()*(spread||0.7), down=def.vy<0;
    spawn(x+Math.cos(a)*rr,down?2.2+mr()*0.6:0.15,z+Math.sin(a)*rr,(mr()-0.5)*0.15,def.vy*(0.7+mr()*0.6),(mr()-0.5)*0.15,2.4+mr(),G(mpick(def.gl)),0.12,def.col[0]*1.3,def.col[1]*1.3,def.col[2]*1.3,0); };
  const sound=(key,kind,x,z)=>{ if(!kind||!near(x,z,10))return; if(time<(o.sndT[key]||0))return; o.sndT[key]=time+6+mr()*5; omenSound(kind,x,z); };
  // the stairs: what lies below leaks up
  if(o.stairs&&o.stairs.kind!=='branch'){ const def=o.stairs.kind==='special'?SPECIAL_OMEN[o.stairs.key]:STRATUM_OMEN[o.stairs.key]; const [x,z]=cpos(D.stairs);
    if(def&&near(x,z,20)){ rise(x,z,def,3.2); if(def.glow)for(let k=0;k<16;k++){ const a=k/16*Math.PI*2+t*0.1, b=0.5+0.25*Math.sin(t*1.7+k); dyn(x+Math.cos(a)*1.3,0.04,z+Math.sin(a)*1.3,G('.'),0.15,def.glow[0]*b,def.glow[1]*b,def.glow[2]*b,0,0); } sound('st',def.snd,x,z); } }
  // the otherworld gate: its realm's light
  if(o.portal){ const def=REALM_OMEN[o.portal.key], [x,z]=cpos(o.portal.cell); if(def&&near(x,z,20)){ rise(x,z,def,3,1.0); if(def.frost)for(let k=0;k<20;k++){ const a=k*2.399, r=0.8+(k%5)*0.3; dyn(x+Math.cos(a)*r,0.03,z+Math.sin(a)*r,G(k%3?'.':'*'),0.13,0.55,0.7,0.85,0,0); } sound('po',def.snd,x,z); } }
  // traces at branch doors and on the stairs deeper into a branch
  for(const tr of o.traces){ if(!near(tr.x,tr.z,18))continue; const k=tr.key, r=tr.r;
    if(k==='crypt'){ dyn(tr.x,0.03,tr.z,G(r<0.15?'O':r<0.5?mpick(['(',')']):r<0.8?'=':'o'),0.15,0.62,0.6,0.55,0,0); }
    else if(k==='lair'){ if(r<0.45){ for(let q=0;q<3;q++)dyn(tr.x+Math.cos(tr.a)*q*0.1,0.03,tr.z+Math.sin(tr.a)*q*0.1,G('/'),0.15,0.55,0.4,0.3,0,0); } else if(r<0.8)dyn(tr.x,0.04,tr.z,G('"'),0.14,0.5,0.36,0.22,0,0); else dyn(tr.x,0.03,tr.z,G('%'),0.16,0.18,0.12,0.09,0,0); }
    else if(k==='sunken'){ const b=0.45+0.15*Math.sin(t*1.5+tr.a); dyn(tr.x,0.03,tr.z,G('~'),0.16,0.25*b*2,0.5*b*2,0.7*b*2,0,0); if(rate(0.25))spawn(tr.x,0.05,tr.z,0,0.35,0,1.0,G('o'),0.08,0.5,0.8,1.0,0); }
    else if(k==='nest'){ if(r<0.55)dyn(tr.x,0.03,tr.z,G(mpick(['-','/','\\'])),0.15,0.5,0.5,0.55,0,0); else if(r<0.85){ for(let q=0;q<3;q++)dyn(tr.x,1.4+q*0.35,tr.z,G('|'),0.13,0.45,0.45,0.5,0,0); } else { const a=t*1.5+tr.a; dyn(tr.x+Math.cos(a)*0.3,0.05,tr.z+Math.sin(a)*0.3,G('x'),0.11,0.5,0.45,0.4,0,0); } }
    else if(k==='snake'){ if(r<0.6){ for(let q=0;q<4;q++)dyn(tr.x+Math.cos(tr.a)*q*0.13,0.03,tr.z+Math.sin(tr.a)*q*0.13+Math.sin(q*1.6)*0.05,G(q%2?'s':'~'),0.14,0.62,0.6,0.42,0,0); } else dyn(tr.x,0.03,tr.z,G(','),0.14,0.3,0.5,0.24,0,0); } }
  if(o.branch){ const [x,z]=cpos(o.branch.cell), k=o.branch.key; if(near(x,z,18)){ if(k==='crypt')rise(x,z,{col:[0.45,0.6,0.8],gl:['~','.'],vy:0.08},1.5,1.2); if(k==='lair')rise(x,z,{col:[0.6,0.45,0.32],gl:['~'],vy:0.15},0.8,0.6); sound('br',BRANCH_OMEN[k].snd,x,z); } }
  if(o.stairs&&o.stairs.kind==='branch'){ const [x,z]=cpos(D.stairs), k=o.stairs.key; if(near(x,z,18)){ if(k==='crypt')rise(x,z,{col:[0.45,0.6,0.8],gl:['~','.'],vy:0.08},o.stairs.strong?3:1.5,1.4); sound('st',BRANCH_OMEN[k].snd,x,z); } }
}

// ---------------------------------------------------------------- direction arrows: from a point just above the hands, arrows spread out toward places - straight-line direction only, never the way;
// near ones short and thick, far ones long and thin. The stairs are always known; gates once seen; altars from 20 m; springs, treasuries and guarded prizes from 12 m. A place in plain sight needs no arrow.
const arrowCv=document.getElementById('arrows'), arrowCtx=arrowCv?arrowCv.getContext('2d'):null;
function arrowTargets(){ const out=[]; if(!D||!started||dead)return out; const pc=((player.z/CELL)|0)*MW+((player.x/CELL)|0), atHub=D.hub&&D.roomOf[pc]===D.hub.ri, far=atHub?1.5:1;
  // standing at the crossroads, presences around are felt from farther off
  const P=(cell,ch,col,range,seenOnly,vague)=>{ if(cell==null||cell<0)return; if(seenOnly&&!explored[cell])return; const [x,z]=cpos(cell), d=Math.hypot(x-player.x,z-player.z); if(range&&d>range*far)return;
    // a thing not yet seen is only a presence: a '?' in the colour of its light
    if(vague&&!explored[cell])ch='?'; out.push({x,z,d,ch,col}); };
  if(!D.finalVault&&D.stairs>=0)P(D.stairs,'>',[1.0,0.85,0.45],0,false);
  if(D.bstairs)P(D.bstairs.cell,'>',[0.75,0.6,1.0],0,true);
  if(D.portal)P(D.portal.cell,'0',[1.0,0.55,0.9],0,true);
  const seenAltar=new Set(); for(const it of (D.items||[])){ if(it.taken)continue;
    if(it.altar&&!seenAltar.has(it.grp)){ seenAltar.add(it.grp); if(it.forge)P(it.i,'T',[0.7,0.85,1.0],20,false); else P(it.i,'_',[1.0,0.8,0.45],20,false); }
    else if(it.kind==='spring')P(it.i,'~',[0.5,0.88,1.0],20,false,true);
    else if(it.kind==='grave')P(it.i,'+',[0.78,0.78,0.9],20,false,true);
    else if(it.vault)P(D.gate?D.gate.cell:it.i,'#',[1.0,0.82,0.3],20,false,true);
    else if(it.elitePrize)P(it.i,'*',[1.0,0.42,0.32],20,false,true); }
  return out; }
function inPlainSight(t){ if(t.d>22)return false; const [ox,oy,oz]=aimOrigin(), [vx,vy,vz]=viewDir(), dx=t.x-ox, dz=t.z-oz, dy=0.9-oy, L=Math.hypot(dx,dy,dz)||1;
  if((dx*vx+dy*vy+dz*vz)/L<Math.cos(0.5))return false; return losClear(ox,oy,oz,t.x,0.9,t.z); }
let arrowsDrawn=false;
function drawArrows(){ if(!arrowCtx)return; const W=Math.round(arrowCv.clientWidth*devicePixelRatio), H=Math.round(arrowCv.clientHeight*devicePixelRatio), c=arrowCtx; if(arrowCv.width!==W||arrowCv.height!==H){ arrowCv.width=W; arrowCv.height=H; } if(arrowsDrawn){ c.clearRect(0,0,W,H); arrowsDrawn=false; }
  if(!started||dead||isPaused()||gallery)return; const ts=arrowTargets().filter(t=>!inPlainSight(t)); if(!ts.length)return; arrowsDrawn=true;
  const k=devicePixelRatio, ox=W/2, oy=H*0.66, r0=46*k, ps=player.yaw, fx=-Math.sin(ps), fz=-Math.cos(ps), rx=Math.cos(ps), rz=-Math.sin(ps), FONT='"M PLUS 1 Code","BIZ UDGothic",monospace';
  c.textAlign='center'; c.textBaseline='middle'; c.lineJoin='round';
  // the ring the arrows spread from
  c.font=`${11*k}px ${FONT}`; for(let q=0;q<24;q++){ const a=q/24*Math.PI*2; c.lineWidth=3*k; c.strokeStyle='rgba(0,0,0,0.55)'; c.strokeText('·',ox+Math.cos(a)*r0*0.72,oy+Math.sin(a)*r0*0.72); c.fillStyle='rgba(210,200,245,0.45)'; c.fillText('·',ox+Math.cos(a)*r0*0.72,oy+Math.sin(a)*r0*0.72); }
  const glyph=(ch,x,y,rot,size,rgb,alpha,bold)=>{ c.save(); c.translate(x,y); if(rot)c.rotate(rot); c.font=`${bold?'bold ':''}${size}px ${FONT}`;
    c.lineWidth=Math.max(2,size*0.28); c.strokeStyle='rgba(4,3,10,0.85)'; c.strokeText(ch,0,0);
    c.shadowColor=`rgba(${rgb},${(alpha*0.9).toFixed(2)})`; c.shadowBlur=size*0.6; c.fillStyle=`rgba(${rgb},${alpha.toFixed(2)})`; c.fillText(ch,0,0); c.restore(); };
  for(const t of ts){ const dx=t.x-player.x, dz=t.z-player.z, th=Math.atan2(dx*rx+dz*rz,dx*fx+dz*fz), sx=Math.sin(th), sy=-Math.cos(th);
    const near=clamp(1-(t.d-3)/37,0,1), len=(24+96*(1-near))*k, size=(13+7*near)*k, alpha=0.62+0.35*near, rgb=t.col.map(v=>Math.round(v*255)).join(',');
    const step=size*0.42, n=Math.max(1,Math.round(len/step)), thick=near>0.5, body=thick?'=':'-';
    for(let i=0;i<n;i++){ const px=ox+sx*(r0+i*step), py=oy+sy*(r0+i*step); glyph(i===n-1?'>':body,px,py,th-Math.PI/2,size,rgb,alpha,thick); }
    // the mark at the tip: larger, on a faint dark disc
    const mx=ox+sx*(r0+n*step+size*0.85), my=oy+sy*(r0+n*step+size*0.85), ms=(17+5*near)*k;
    c.beginPath(); c.arc(mx,my,ms*0.7,0,Math.PI*2); c.fillStyle='rgba(6,4,14,0.55)'; c.fill(); c.lineWidth=1.2*k; c.strokeStyle=`rgba(${rgb},${(alpha*0.6).toFixed(2)})`; c.stroke();
    glyph(t.ch,mx,my+ms*0.02,0,ms,rgb,Math.min(1,alpha+0.1),true); } }
const stairsGuarded=()=>D&&D.stairGuard!==undefined&&monsters.some(m=>!m.dead&&m.g===D.stairGuard);
function drawStairSeal(t){ if(!D||D.stairGuard===undefined)return; const [x,z]=cpos(D.stairs); const d=Math.hypot(x-player.x,z-player.z); if(d>26)return; const on=stairsGuarded();
  if(on){ for(let k=0;k<18;k++){ const a=k/18*Math.PI*2+t*0.4, b=0.7+0.3*Math.sin(t*2+k); dyn(x+Math.cos(a)*0.9,0.3+0.12*Math.sin(t*1.5+k),z+Math.sin(a)*0.9,G(k%3?'=':'#'),0.18,1.4*b,0.4*b,0.55*b,0,0); } if(d<12&&time>(D.sealSnd||0)){ D.sealSnd=time+7+mr()*4; omenSound('growl',x,z); } }
  else if(!D.sealOpenMsg){ D.sealOpenMsg=true; msg('<b style="color:#ffd27a">=</b>階段を閉ざしていた封が、静かに解けた。'); sChime(x,z,0.4); } }
// the air of each part of a level: the crossroads a little brighter, the way to the stairs a little darker and quieter
let ambK=1;
function updateSectionAir(dt){ if(!D||!D.prof)return; const pc=((player.z/CELL)|0)*MW+((player.x/CELL)|0); let k=1;
  if(D.hub&&D.roomOf[pc]===D.hub.ri)k=1.25; else if(D.dS&&D.pathL>0&&D.dS[pc]>D.pathL*0.7)k=0.85;
  ambK+=(k-ambK)*Math.min(1,dt*1.2); U.uAmb.value=D.prof.ambient*ambK; }
function drawGraves(t){ for(const it of (D.items||[])){ if(it.kind!=='grave'||it.taken)continue; const [x,z]=cpos(it.i); if(Math.hypot(x-player.x,z-player.z)>26)continue;
    for(let y=0;y<3;y++)dyn(x,0.2+y*0.3,z,G(y===2?'+':'|'),0.34,0.55,0.55,0.62,0,0); dyn(x-0.18,0.62,z,G('-'),0.3,0.5,0.5,0.58,0,0); dyn(x+0.18,0.62,z,G('-'),0.3,0.5,0.5,0.58,0,0);
    const c=runeCol(it.rune), b=0.9+0.4*Math.sin(t*1.8+it.i); dyn(x,1.35+0.06*Math.sin(t*1.3),z,G(RUNE_DEF[it.rune.type].ch),0.26,c[0]*b,c[1]*b,c[2]*b,0,0); } }
function drawRunesWorld(t){
  drawZones(t);
  drawStairSeal(t); updateSectionAir(0.016);
  drawSprings(t); drawGraves(t);
  { const pr=(D.items||[]).find(o=>o.vault&&!o.taken&&o.ev); if(pr){ const ri=D.roomOf[pr.i], room=ri>=0&&D.rooms[ri]&&D.rooms[ri].cells.length>6?D.rooms[ri]:(pr.area||(pr.area={cells:vaultArea(pr,2)})); const [px,pz]=cpos(pr.i); if(room&&Math.hypot(px-player.x,pz-player.z)<20){ const rr=mulberry32((pr.i*31+7)>>>0);
    if(pr.ev==='guard'){ for(let k=0;k<2;k++){ const c=room.cells[Math.floor(rr()*room.cells.length)], [x,z]=cpos(c), b=0.6+0.5*Math.max(0,Math.sin(t*0.9+k*2)); dyn(x-0.06,1.35,z,G('.'),0.12,1.6*b,0.3*b,0.25*b,0,0); dyn(x+0.06,1.35,z,G('.'),0.12,1.6*b,0.3*b,0.25*b,0,0); for(let y=0;y<4;y++)dyn(x,0.2+y*0.32,z,G(y===3?'@':'#'),0.3,0.32,0.3,0.34,0,0); } }
    else { if(mr()<0.12){ const c=room.cells[Math.floor(mr()*room.cells.length)], [x,z]=cpos(c); spawn(x+(mr()-0.5),2.8,z+(mr()-0.5),0,-0.4,0,2.2,G(mpick(['.',','])),0.1,0.6,0.56,0.5,1); } for(let k=0;k<6;k++){ const c=room.cells[Math.floor(rr()*room.cells.length)], [x,z]=cpos(c); dyn(x,0.03,z,G(rr()<0.5?'/':'\\'),0.18,0.4,0.36,0.32,0,0); } } } } }
  updateRockfall(0.016);
  for(const it of (D.items||[])){ if(it.taken||it.kind!=='slot')continue; const [x,z]=cpos(it.i); if(Math.hypot(x-player.x,z-player.z)>28)continue; const b=1.8+0.6*Math.sin(t*2.2+it.i), hy=0.75+0.08*Math.sin(t*1.6);
    dyn(x-0.16,hy,z,G('{'),0.34,2.6*b/2,2.2*b/2,1.3*b/2,0,0); dyn(x+0.16,hy,z,G('}'),0.34,2.6*b/2,2.2*b/2,1.3*b/2,0,0); dyn(x,hy,z,G('.'),0.2,1.6,1.5,1.2,0,0); if(mr()<0.15)spawn(x+(mr()-0.5)*0.4,hy,z+(mr()-0.5)*0.4,0,0.5,0,0.8,G('.'),0.1,2.2,1.9,1.2,0); }
  for(const it of (D.items||[])){ if(it.taken||it.kind!=='rune')continue; let [x,z]=cpos(it.i); const dd=Math.hypot(x-player.x,z-player.z); if(dd>28)continue;
    const guarded=it.guardG!==undefined&&guardedNow(it);
    if(guarded&&it.elitePrize){ const b=0.5; dyn(x,0.75,z,G(RUNE_DEF[it.rune.type].ch),0.42,0.5*b,0.45*b,0.5*b); for(let k=0;k<8;k++){ const a=k/8*Math.PI*2+t*0.3; dyn(x+Math.cos(a)*0.4,0.75+Math.sin(a*2)*0.08,z+Math.sin(a)*0.4,G('#'),0.14,0.55,0.25,0.2); } continue; }
    if(!it.rune||guarded){ if(dd<12&&it.altar&&!guarded)altarFill(it.grp); if(!it.rune||guarded){ if(it.altar&&it.slot===1&&it.opt!=='open')for(let k=-1;k<=1;k++){ dyn(x+k*0.55,0.55,z,G('='),0.42,0.4,0.38,0.45); dyn(x+k*0.55,0.25,z,G('#'),0.36,0.3,0.28,0.34); } continue; } }
    if(it.altar)x+=(it.slot-1)*0.55;
    const c=runeCol(it.rune), tc=TIER_COL[runeTier(it.rune)], b=(1.7+0.5*Math.sin(t*2+it.i+(it.slot||0))), hy=it.pedestal?1.05:it.altar?1.05:0.6;
    if(it.pedestal){ dyn(x,0.25,z,G('|'),0.36,0.5,0.48,0.55); dyn(x,0.6,z,G('|'),0.36,0.5,0.48,0.55); dyn(x,0.85,z,G('='),0.34,0.6,0.58,0.65); }
    if(it.altar&&it.slot===1&&it.opt!=='open'){ for(let k=-1;k<=1;k++){ dyn(x+k*0.55,0.55,z,G('='),0.42,0.55,0.52,0.6); dyn(x+k*0.55,0.25,z,G('#'),0.36,0.4,0.38,0.45); } }
    if(it.opt==='heal'){ dyn(x,hy+Math.sin(t*1.5+it.i+(it.slot||0))*0.06,z,G('+'),0.5,1.0*b,0.5*b,0.58*b); } else { dyn(x,hy+Math.sin(t*1.5+it.i+(it.slot||0))*0.06,z,G(RUNE_DEF[it.rune.type].ch),0.5,c[0]*b,c[1]*b,c[2]*b); if(it.opt==='hone')dyn(x+0.2,hy+0.32,z,G('+'),0.24,1.0*b,0.95*b,0.7*b); }
    for(let k=0;k<6;k++){ const a=t*0.8+k/6*Math.PI*2+(it.slot||0); dyn(x+Math.cos(a)*0.3,hy-0.45,z+Math.sin(a)*0.3,G('.'),0.1,tc[0]*1.4,tc[1]*1.4,tc[2]*1.4); } }
  for(const s of (D.steles||[])){ const [x,z]=cpos(s.i), d=Math.hypot(x-player.x,z-player.z); if(d>30)continue; const near=d<2.6, g=near?2.2:0.9;
    for(let y=0;y<4;y++)dyn(x,0.25+y*0.42,z,G(y===3?'^':'#'),0.4,0.42,0.4,0.48);
    dyn(x,1.0+Math.sin(t*1.3+s.i)*0.04,z+0.01,G(s.g),0.32,0.55*g,0.75*g,1.0*g); }
  for(const b of beamSegs){ let run=0; for(let k=0;k+1<b.pts.length;k++){ const a=b.pts[k], e=b.pts[k+1], L=Math.hypot(e[0]-a[0],e[1]-a[1],e[2]-a[2]), n=Math.max(1,Math.round(L/0.22));
      for(let j=0;j<n;j++){ const f=j/n, fl=0.75+0.5*mr(), dd=run+L*f, near=Math.max(0,1-dd/7), sz=0.1+0.1*near, br=1.3+1.2*near; dyn(a[0]+(e[0]-a[0])*f,a[1]+(e[1]-a[1])*f,a[2]+(e[2]-a[2])*f,G(mpick(['-','=','*'])),sz,b.col[0]*br*fl,b.col[1]*br*fl,b.col[2]*br*fl); } run+=L; }
    const e=b.pts[b.pts.length-1]; dyn(e[0],e[1],e[2],G('*'),0.3,b.col[0]*3,b.col[1]*3,b.col[2]*3); }
  for(const p of projs){ if(p.wave||p.thrust){ drawWave(p); continue; } const c=elemCol(p.sp.elem); dyn(p.x,p.y,p.z,G(p.kind==='bolt'?'*':'o'),p.kind==='bolt'?0.26:0.32,c[0]*2.2,c[1]*2.2,c[2]*2.2); if(p.auto)dyn(p.x,p.y,p.z,G('o'),0.46,0.9,0.9,1.0); }
  // the chant gathers at the hand: the hand's runes circle in front of you, brighter as the chant fills
  if(castSt||swapSt){ const [ox,oy,oz]=aimOrigin(), [fx,fy,fz]=viewDir(), rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw);
    if(castSt){ const H=hands[castSt.h], side=castSt.h==='L'?-0.35:0.35, k=Math.min(1,castSt.t/Math.max(0.01,castSt.need)), c=elemCol(H.elem?H.elem.type:null), list=[H.elem].filter(Boolean);
      list.forEach((ru,j)=>{ const a=t*3+j*Math.PI, r=0.12+0.06*k; dyn(ox+fx*0.8+rx*(side+Math.cos(a)*r),oy-0.3+fy*0.8+Math.sin(a)*r,oz+fz*0.8+rz*(side+Math.cos(a)*r),G(RUNE_DEF[ru.type].ch),0.1+0.05*k,c[0]*(1+2*k),c[1]*(1+2*k),c[2]*(1+2*k)); }); }
    if(swapSt){ const rs=allRunes().filter(r=>['elem','trig','mod'].includes(RUNE_DEF[r.type].cat)).slice(0,8), k=swapSt.t/swapSt.dur; rs.forEach((ru,j)=>{ const a=t*2+j/rs.length*Math.PI*2; dyn(player.x+Math.cos(a)*0.9,(camMode==='tps'?1.0:player.eye-0.5)+Math.sin(t*3+j)*0.08,player.z+Math.sin(a)*0.9,G(RUNE_DEF[ru.type].ch),0.2,0.6+k,0.6+k,0.9+k); }); } }
}

// ---------------------------------------------------------------- the feel of a chant: a circle of runes at the hand, light gathering, the lantern taking the element's colour, a rising hum
let humNode=null, crossKey='', aimT=0, crossMon=null, slowFx=0;
function humStart(){ if(!sndReady())return null; const ctx=SND.ctx, t=ctx.currentTime, o=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain();
  o.type='triangle'; o.frequency.setValueAtTime(110,t); o.frequency.linearRampToValueAtTime(220,t+1.4); o2.type='sine'; o2.frequency.setValueAtTime(165,t); o2.frequency.linearRampToValueAtTime(330,t+1.4);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.06,t+0.35); o.connect(g); o2.connect(g); g.connect(sOut(undefined,undefined,1)); o.start(t); o2.start(t);
  return {stop(){ const t2=ctx.currentTime; try{ g.gain.cancelScheduledValues(t2); g.gain.setValueAtTime(Math.max(0.0001,g.gain.value),t2); g.gain.exponentialRampToValueAtTime(0.0001,t2+0.15); o.stop(t2+0.2); o2.stop(t2+0.2); }catch(e){} }}; }
function castSound(sp,x,z){ if(!sndReady())return; const t=SND.ctx.currentTime, o=sOut(x,z,0.32), el=sp.elem;
  if(el==='fire'){ sEnv(sNoise(t,0.5,'lowpass',1400,0.7,o,300),t,0.01,0.45); sCrackleBurst(player.x,player.z); }
  else if(el==='ice'){ sEnv(sTone(t,'sine',1760,2640,0.35,o),t,0.005,0.3); sEnv(sTone(t,'sine',2349,3520,0.25,o),t,0.01,0.25,0.5); }
  else if(el==='thunder'){ sEnv(sNoise(t,0.3,'highpass',3000,0.7,o),t,0.002,0.28); sEnv(sTone(t,'square',90,40,0.25,o),t,0.003,0.22,0.4); }
  else if(el==='poison'){ for(let k=0;k<4;k++)setTimeout(()=>sBubble(player.x,player.z,0.4,k%2===0),k*60); }
  else sWhoosh(); }
function handUp(){ const [fx,fy,fz]=viewDir(), rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw); let ux=-rz*fy, uy=rz*fx-rx*fz, uz=rx*fy; if(uy<0){ ux=-ux; uy=-uy; uz=-uz; } const l=Math.hypot(ux,uy,uz)||1; return [[fx,fy,fz],[rx,0,rz],[ux/l,uy/l,uz/l]]; }
// what the crosshair points at: the first wall, floor or creature along the line of sight
function aimPoint(){ const [ox,oy,oz]=aimOrigin(), [dx,dy,dz]=viewDir(); let x=ox, y=oy, z=oz;
  const near=monsters.filter(m=>hittable(m)&&Math.hypot(m.x-ox,m.z-oz)<42);
  for(let s=0;s<160;s++){ x+=dx*0.25; y+=dy*0.25; z+=dz*0.25; const ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL); if(ci<0||ci>=NCELL)break;
    if(D.tile[ci]===TW||D.tile[ci]===TX||y<0.02||y>D.ceil[ci])return [x,y,z];
    for(const m of near){ if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; const cy=m.hidden?m.y+1.3:m.y+(m.ty.flier?0:0.6*m.ty.scale); if(Math.hypot(m.x-x,cy-y,m.z-z)<0.42+0.35*m.ty.scale)return [x,y,z]; } }
  return [x,y,z]; }
function centerPoint(){ const [o0,o1,o2]=aimOrigin(), [f]=handUp(); return [o0+f[0]*0.95,o1+f[1]*0.95,o2+f[2]*0.95]; }
// the chant circle: born at the hand, drawn to the crosshair as the chant fills
function castPoint(h,k){ const a=handPoint(h), b=centerPoint(), e=1-Math.pow(1-clamp(k,0,1),2.2); return [a[0]+(b[0]-a[0])*e,a[1]+(b[1]-a[1])*e,a[2]+(b[2]-a[2])*e]; }
function shotFrame(h,chanted,kind){ const o=chanted?(()=>{ const c=castPoint(h,1), u=handUp()[2]; return [c[0]-u[0]*0.14,c[1]-u[1]*0.14,c[2]-u[2]*0.14]; })():handPoint(h), a=assistPoint(o,kind)||aimPoint(), dx=a[0]-o[0], dy=a[1]-o[1], dz=a[2]-o[2], l=Math.hypot(dx,dy,dz);
  return {o,d:l>1?[dx/l,dy/l,dz/l]:viewDir()}; }
function assistPoint(o,kind){ if(kind!=='bolt'&&kind!=='beam')return null; const m=aimTarget(); if(!m||m.dead)return null;
  const c=[m.x,m.y+(m.ty.flier?0:0.6*m.ty.scale),m.z]; if(kind==='beam')return c;
  const t=Math.hypot(c[0]-o[0],c[1]-o[1],c[2]-o[2])/20; return [c[0]+(m.vlx||0)*t,c[1],c[2]+(m.vlz||0)*t]; }
function handPoint(h){ const [o0,o1,o2]=aimOrigin(), [f,r,u]=handUp(), s=h==='L'?-1:1; return [o0+f[0]*0.95+r[0]*s*0.38-u[0]*0.27,o1+f[1]*0.95-u[1]*0.27,o2+f[2]*0.95+r[2]*s*0.38-u[2]*0.27]; }
// where the spell will go: straight (arrows, beams) or an arc (orbs), with bounces; the first creature in the way
function simPath(sp){
  const fr=sp.atk==='beam'?beamFrame(sp.h):shotFrame(sp.h,true,sp.atk), [ox,oy,oz]=fr.o, d0=fr.d, pts=[]; let hitM=null;
  if(sp.atk==='orb'){ let x=ox, y=oy, z=oz, vx=d0[0]*12, vy=d0[1]*12+2.6, vz=d0[2]*12, b=sp.aff.bounce||0;
    for(let s=0;s<160;s++){ const dt=0.025; vy-=9.8*dt; const nx=x+vx*dt, ny=y+vy*dt, nz=z+vz*dt, ci=Math.floor(nz/CELL)*MW+Math.floor(nx/CELL);
      if(ci<0||ci>=NCELL)break; if(s%3===0)pts.push([x,y,z]);
      for(const m of monsters){ if(!foe(m)||!m.visible)continue; if(Math.hypot(m.x-nx,m.y+0.6*m.ty.scale-ny,m.z-nz)<0.42+0.35*m.ty.scale){ hitM=m; break; } } if(hitM){ x=nx; y=ny; z=nz; break; }
      const wall=D.tile[ci]===TW||D.tile[ci]===TX, fl=ny<0.03&&D.tile[ci]!==TC, ce=ny>D.ceil[ci];
      if(wall||fl||ce){ if(b>0){ b--; const v=Math.hypot(vx,vy,vz)||1, r=reflectDir(x,y,z,[vx/v,vy/v,vz/v]); vx=r[0]*v; vy=r[1]*v*0.7; vz=r[2]*v; if(fl)vy=Math.abs(vy)+1; continue; } break; }
      x=nx; y=ny; z=nz; }
    return {pts,end:[x,Math.max(0.05,y),z],hitM,orb:true}; }
  let x=ox, y=oy, z=oz, d=d0.slice(), b=sp.aff.bounce||0, left=sp.atk==='beam'?12:26;
  while(left>0){ const nx=x+d[0]*0.3, ny=y+d[1]*0.3, nz=z+d[2]*0.3, ci=Math.floor(nz/CELL)*MW+Math.floor(nx/CELL); left-=0.3; if(ci<0||ci>=NCELL)break;
    for(const m of monsters){ if(!foe(m)||!m.visible)continue; if(Math.hypot(m.x-nx,m.y+0.6*m.ty.scale-ny,m.z-nz)<0.42+0.35*m.ty.scale){ hitM=m; break; } } if(hitM){ x=nx; y=ny; z=nz; break; }
    const wall=D.tile[ci]===TW||D.tile[ci]===TX||ny<0.02||ny>D.ceil[ci];
    if(wall){ if(b>0){ b--; d=reflectDir(x,y,z,d); pts.push([x,y,z]); continue; } break; }
    x=nx; y=ny; z=nz; pts.push([x,y,z]); }
  return {pts,end:[x,y,z],hitM}; }
function drawCastFx(t){
  if(!hands)return;
  if(!castSt){ if(crossMon&&crossMon.dead)crossMon=null; return; }
  const sp=specOf(castSt.h), c=elemCol(sp.elem), k=Math.min(1,castSt.t/Math.max(0.01,castSt.need)), full=castSt.full;
  // the circle at the hand
  const P=castPoint(castSt.h,k), [f,r,u]=handUp(), H=hands[castSt.h], rs=[H.elem].filter(Boolean).map(ru=>RUNE_DEF[ru.type].ch), n=12, rr=0.05+0.03*k, spin=t*(full?5:2);
  for(let j=0;j<n;j++){ const a=spin+j/n*Math.PI*2, ch=(j%3===0&&rs.length)?rs[(j/3|0)%rs.length]:'.', lit=j%3===0&&castSt.sylT!==undefined&&time-castSt.sylT<0.16&&(j/3|0)===(castSt.syl%4), br=(0.8+2.4*k)*(full?1.25+0.25*Math.sin(t*12):1)*(lit?2.2:1);
    dyn(P[0]+(r[0]*Math.cos(a)+u[0]*Math.sin(a))*rr,P[1]+(u[1]*Math.sin(a))*rr,P[2]+(r[2]*Math.cos(a)+u[2]*Math.sin(a))*rr,G(ch),ch==='.'?0.02:0.032+0.014*k,c[0]*br,c[1]*br,c[2]*br); }
  // light gathers toward the hand
  if(mr()<0.5+0.4*k){ const a=mr()*6.28, e=(mr()-0.3)*1.2, d=1.4+mr()*0.8, sx=player.x+Math.cos(a)*d, sz=player.z+Math.sin(a)*d, sy=P[1]+e;
    spawn(sx,sy,sz,(P[0]-sx)/0.45,(P[1]-sy)/0.45,(P[2]-sz)/0.45,0.42,G(mpick(['.','\'','*'])),0.06,c[0]*2,c[1]*2,c[2]*2,0); }
  // the path, the landing, the target
  if(sp.atk==='blade'||sp.atk==='bare')return;
  const path=simPath(sp), dim=0.35+0.65*k;
  const [aox,aoy,aoz]=aimOrigin();
  path.pts.forEach((p,j)=>{ if(j%2||Math.hypot(p[0]-aox,p[1]-aoy,p[2]-aoz)<1.6)return; const fade=dim*(1-j/Math.max(1,path.pts.length)*0.5); dyn(p[0],p[1],p[2],G(path.orb?'o':'-'),path.orb?0.11:0.12,c[0]*2.4*fade,c[1]*2.4*fade,c[2]*2.4*fade); });
  const e=path.end;
  if(path.orb){ const R=1.7*(1+(sp.aff.area||0)/100); for(let j=0;j<18;j++){ const a=j/18*Math.PI*2+t*0.6; dyn(e[0]+Math.cos(a)*R,0.12,e[2]+Math.sin(a)*R,G(j%3?'.':'+'),0.24,c[0]*2.6*dim,c[1]*2.6*dim,c[2]*2.6*dim); } }
  dyn(e[0],e[1],e[2],G('x'),0.26,c[0]*3*dim,c[1]*3*dim,c[2]*3*dim);
  const m=path.hitM; if(m){ const cy=m.y+0.6*m.ty.scale, w=0.35*m.ty.scale+0.25; dyn(m.x-r[0]*w,cy,m.z-r[2]*w,G('['),0.42*Math.max(0.8,m.ty.scale),c[0]*3,c[1]*3,c[2]*3); dyn(m.x+r[0]*w,cy,m.z+r[2]*w,G(']'),0.42*Math.max(0.8,m.ty.scale),c[0]*3,c[1]*3,c[2]*3); }
}
// the crosshair is a glyph: it closes from ( + ) to [+] as the chant fills; it warms when a creature is in the line
function aimTarget(){ if(time-aimT<0.1)return crossMon; aimT=time; crossMon=null; const [ox,oy,oz]=aimOrigin(), [vx,vy,vz]=viewDir(); let bd=1e9;
  let ba=1e9; for(const m of monsters){ if(!foe(m)||!m.visible)continue; if(m.ty.habitat==='deep'&&(m.rise||0)<0.3)continue; const cy=m.y+0.6*m.ty.scale, ax=m.x-ox, ay=cy-oy, az=m.z-oz, d=Math.hypot(ax,ay,az); if(d>28)continue;
    const ang=Math.acos(clamp((ax*vx+ay*vy+az*vz)/Math.max(d,1e-3),-1,1)), tol=0.08+Math.atan2(0.6*m.ty.scale,Math.max(d,0.5)); if(ang>tol)continue;
    const score=ang/tol+d*0.01; if(score<ba&&losClear(ox,oy,oz,m.x,cy,m.z)){ ba=score; crossMon=m; } }
  return crossMon; }
function updateCross(dt){
  const el=document.getElementById('cross'); if(!el)return;
  slowFx+=((castSt?1:0)-slowFx)*Math.min(1,(dt||0.016)*8); finalPass.uniforms.uSlow.value=slowFx;
  if(castSt){ const c=elemCol(hands[castSt.h].elem?hands[castSt.h].elem.type:null); finalPass.uniforms.uTint.value.set(c[0],c[1],c[2]); }
  const tg=started&&!dead&&!isPaused()?aimTarget():null;
  // the sight: a small dot; it is flanked when it holds a creature; while chanting, the runes of that hand close in on it and, when the chant is full, rest beside it and pulse
  let txt='·', col='rgba(225,215,255,.55)', cls='';
  if(castSt){ const H=hands[castSt.h], k=Math.min(1,castSt.t/Math.max(0.01,castSt.need)), c0=elemCol(H.elem?H.elem.type:null), c=c0.map(v=>v*0.72+0.25), gap=castSt.full?0:Math.max(0,3-Math.round(k*3));
    const E=H.elem?RUNE_DEF[H.elem.type].ch:'·', A=E;
    txt=`${A}${' '.repeat(gap+1)}·${' '.repeat(gap+1)}${E}`; col=css(c); cls=castSt.full?'full':'chant'; }
  else if(tg){ txt='‹·›'; col='rgba(255,190,140,.85)'; }
  const key=txt+col+cls; if(key===crossKey)return; crossKey=key; el.textContent=txt; el.style.color=col; el.className=cls;
}

// ---------------------------------------------------------------- debugging (developer mode): one set of commands behind both the F2 screen and window.dbg (for automated checks), plus URL options
let godMode=false, dbgOpen=false;
function dbgEnter(){ const keepB=branch, keepR=realm, keepD=depth;
  if(!started){ startDepth=keepD; document.getElementById('enter').click(); }
  branch=keepB; realm=keepR; depth=keepD; newLevel(); if(D)showStratum(D.stratum); }
function dbgNear(cell){ if(cell==null||cell<0)return false; let best=-1, bd=1e9; const cx=cell%MW, cz=(cell/MW)|0;
  for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){ const i=(cz+dz)*MW+cx+dx; if(i<0||i>=D.tile.length||i===cell||D.tile[i]!==TF||D.liquid[i]===LQ_DEEP)continue; const d=Math.abs(Math.hypot(dx,dz)-2); if(d<bd){ bd=d; best=i; } }
  if(best<0)return false; const [tx,tz]=cpos(cell), [x,z]=cpos(best); player.x=x; player.z=z; player.yaw=Math.atan2(-(tx-x),-(tz-z)); player.pitch=-0.25; return true; }
const dbg={
  help(){ return 'dbg.info() / go(深度) / branch(key,階) / realm(key) / to("stairs"|"branch"|"portal"|"lord"|"altar"|"vault") / god(on) / heal() / reveal() / give("slot"|"body"|"runes"|"legends") / kill("lord"|"near") / open() / step(x,z) / look(x,y,z) / items() / clear()   支道: '+Object.keys(BRANCHES).join(',')+'   異界: '+Object.keys(REALMS).join(','); },
  info(){ const o=D?omenOf():null; return {seed:runSeed,depth,inter:inter?inter.key:null,branch:branch?{...branch}:null,realm:realm?{...realm}:null,stratum:D&&D.stratum?D.stratum.name:'',hp:Math.round(player.hp),god:godMode,
    next:o&&o.stairs?o.stairs.kind+':'+o.stairs.key+(o.stairs.strong?' (strong)':''):null, branchDoor:o&&o.branch?o.branch.key:null, portal:o&&o.portal?o.portal.key:null,
    lord:monsters.some(m=>m.key==='lord'&&!m.dead), monsters:monsters.filter(m=>!m.dead).length, bodyOpen:runState.bodyOpen||0,
    altars:[...new Set((D.items||[]).filter(o=>o.altar&&!o.taken).map(o=>o.grp))].length, springs:(D.items||[]).filter(o=>o.kind==='spring'&&!o.taken).length, startPos:D?cpos(D.start).map(v=>+v.toFixed(1)):null, hub:D&&D.hub?[+(D.hub.cx*CELL+1).toFixed(1),+(D.hub.cz*CELL+1).toFixed(1)]:null, hubNear:D?D.hubNear:null, stairGuard:D&&D.stairGuard!==undefined?stairsGuarded():null, stairsPos:D&&D.stairs>=0?cpos(D.stairs).map(v=>+v.toFixed(1)):null, guarded:[...new Set((D.items||[]).filter(o=>o.altar&&!o.taken&&o.guardG!==undefined&&guardedNow(o)).map(o=>o.grp))].length, elite:monsters.some(m=>m.elite&&!m.dead), elitePrize:(D.items||[]).some(o=>o.elitePrize&&!o.taken), eliteWhy:D.eliteWhy||null, looseRunes:(D.items||[]).filter(o=>o.kind==='rune'&&!o.altar&&!o.vault&&!o.pedestal&&!o.taken).length, vault:(()=>{ const v=(D.items||[]).find(o=>o.vault); return v?{ev:v.ev,taken:v.taken,gateOpen:!!(D.gate&&D.gate.open)}:null; })()}; },
  go(d){ branch=null; realm=null; inter=null; depth=clamp(d|0,1,FINAL_DEPTH); dbgEnter(); return dbg.info(); },
  branch(key,lvl){ const B=BRANCHES[key]; if(!B)return 'no such branch: '+Object.keys(BRANCHES).join(','); realm=null; inter=null; const at=B.at[0]; branch={key,lvl:clamp(lvl||1,1,B.len),len:B.len,ret:at+1}; depth=at; dbgEnter(); return dbg.info(); },
  inter(key){ if(!SPECIALS[key])return 'no such place: '+Object.keys(SPECIALS).join(','); const at=interAt(key); branch=null; realm=null; depth=at; inter={key,after:at}; dbgEnter(); return dbg.info(); },
  realm(key){ if(!REALMS[key])return 'no such realm: '+Object.keys(REALMS).join(','); branch=null; realm={key,ret:depth+1}; dbgEnter(); return dbg.info(); },
  to(what){ if(!D)return false; const cell=what==='forge'?((D.items||[]).find(o=>o.forge&&!o.taken)||{i:-1}).i:what==='hub'?(D.hub?((Math.round(D.hub.cz))*MW+Math.round(D.hub.cx)):-1):what==='spring'?((D.items||[]).find(o=>o.kind==='spring'&&!o.taken)||{i:-1}).i:what==='altar'?((D.items||[]).find(o=>o.altar&&!o.taken)||{i:-1}).i:what==='elite'?((D.items||[]).find(o=>o.elitePrize&&!o.taken)||{i:-1}).i:what==='vault'?(D.gate?D.gate.cell:-1):what==='stairs'?D.stairs:what==='branch'?(D.bstairs&&D.bstairs.cell):what==='portal'?(D.portal&&D.portal.cell):what==='lord'?(()=>{ const m=monsters.find(m=>(m.key==='lord'||m.key==='final')&&!m.dead); return m?m.cz*MW+m.cx:-1; })():-1; return dbgNear(cell); },
  god(on){ godMode=on===undefined?!godMode:!!on; return godMode; },
  heal(){ player.hp=PLAYER_MAX; return player.hp; },
  reveal(){ explored.fill(1); return true; },
  give(what){ if(what==='slot')openSlot(((player.z/CELL)|0)*MW+((player.x/CELL)|0)); else if(what==='body'){ for(const t of RUNE_TYPES.body)takeRune(makeRune(t,0)); } else if(what==='runes'){ for(const t of Object.keys(RUNE_DEF))if(RUNE_DEF[t].cat!=='sub'&&RUNE_DEF[t].cat!=='open'&&(RUNE_DEF[t].cat!=='mod'||RUNE_TYPES.mod.includes(t)))takeRune(makeRune(t,0)); }
    else if(what==='legends'){ const L=getLegend(); if(L){ for(const k of LEGEND_ORDER)L.have.add(k); renderStatus(); } } else return 'give: slot / body / runes / legends'; renderHotbar(); return true; },
  kill(what){ if(what==='guards'){ const gs=new Set((D.items||[]).filter(o=>!o.taken&&o.guardG!==undefined&&Math.hypot(cpos(o.i)[0]-player.x,cpos(o.i)[1]-player.z)<18).map(o=>o.guardG)); let n=0; for(const m of monsters)if(!m.dead&&gs.has(m.g)){ damageMonster(m,99999,'debug'); n++; } return n; }
    const m=what==='lord'?monsters.find(m=>(m.key==='lord'||m.key==='final')&&!m.dead):monsters.filter(m=>!m.dead).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]; if(!m)return false; damageMonster(m,99999,'debug'); return true; },
  open(){ if(!D||!D.gate)return false; D.gate.open=true; return true; },
  step(x,z){ player.x=x; player.z=z; return [x,z]; },
  lore(n){ META.lore=(META.lore||0)+(n||50); saveMeta(); return loreLeft(); },
  exp(n){ gainExp(n||20); return {lvl:lvl.n,exp:lvl.exp,pending:lvl.pending}; },
  hurt(n){ const g=godMode; godMode=false; hurtPlayer(n||5,'debug'); godMode=g; return {hp:+player.hp.toFixed(1),rally:+(player.rally||0).toFixed(1)}; },
  hit(n){ const m=monsters.filter(m=>!m.dead&&!m.ty.critter&&!m.ty.peaceful).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]; if(!m)return false; m.playerT=time; damageMonster(m,n||4,'magic'); return {target:m.ty.name,dead:m.dead}; },
  hp(){ return {hp:+player.hp.toFixed(1),rally:+(player.rally||0).toFixed(1),motes:rallyMotes.length}; },
  look(x,y,z){ const [ox,oy,oz]=aimOrigin(); player.yaw=Math.atan2(-(x-ox),-(z-oz)); player.pitch=Math.atan2(y-oy,Math.hypot(x-ox,z-oz)); return [player.yaw,player.pitch]; },
  items(){ return (D.items||[]).filter(o=>!o.taken).map(o=>({kind:o.kind,opt:o.opt||null,altar:!!o.altar,vault:!!o.vault,lord:!!o.lord,type:o.rune?o.rune.type:null,pos:cpos(o.i).map(v=>+v.toFixed(2)),slot:o.slot})); },
  clear(){ const n0=monsters.length; monsters=monsters.filter(m=>m.ty.boss||m.key==='lord'||m.key==='final'||m.ty.critter||Math.hypot(m.x-player.x,m.z-player.z)>25); return n0-monsters.length; },
};
window.dbg=new Proxy(dbg,{get(o,k){ const v=o[k]; if(typeof v!=='function')return v; return (...a)=>DEVALL?v(...a):'開発用モードがオフです（タイトルでオンにするか、URL に ?dev=1 を付けてください）'; }});
// the F2 screen
function setDbg(on){ if(on===dbgOpen)return; if(on&&(!DEVALL||!started||dead))return; dbgOpen=on; document.body.classList.toggle('paused',isPaused()); const el=document.getElementById('dbgp'); if(!el)return; el.classList.toggle('show',on); if(on){ renderDbg(); if(document.pointerLockElement)document.exitPointerLock(); } else tryLock(); }
function renderDbg(){ const el=document.getElementById('dbgp'); if(!el)return; const f=t=>`<span class="f">${t}</span>`, I=dbg.info(), B=(c,t)=>`<button class="row" data-c="${c}">[${t}]</button>`;
  const where=I.realm?`異界：${REALMS[I.realm.key].name}`:I.branch?`支道：${BRANCHES[I.branch.key].name} ${I.branch.lvl}/${I.branch.len}階`:`深度 ${I.depth}`;
  const nx=I.next?(()=>{ const [k,v]=I.next.split(':'); const key=v.replace(' (strong)',''); return k==='stratum'?(STRATA.find(s=>s.k===key)||{}).name:k==='special'?SPECIALS[key].name:BRANCHES[key].name+(v.includes('strong')?'（主の階へ）':''); })():'変わらない';
  const rows=[f('+-- デバッグ ---'),`${f('|')} 今　${where}　${I.stratum}　シード ${I.seed}　体力 ${I.hp}/${PLAYER_MAX}`,
    `${f('|')} 先　下り階段の先：${nx}　支道の入口：${I.branchDoor?BRANCHES[I.branchDoor].name:'なし'}　門：${I.portal?REALMS[I.portal].name:'なし'}`,
    `${f('|')} 　　祭壇：${I.altars}　宝物庫：${I.vault?(I.vault.ev==='guard'?'番人':'崩落')+(I.vault.taken?'（取った）':''):'なし'}`,f('|'),
    `${f('|')} 深度　`+Array.from({length:FINAL_DEPTH},(_,i)=>B('go:'+(i+1),i+1)).join(''),
    ...Object.keys(BRANCHES).map(k=>`${f('|')} 支道　${BRANCHES[k].name}　`+Array.from({length:BRANCHES[k].len},(_,i)=>B(`br:${k}:${i+1}`,(i+1)+'階')).join('')),
    `${f('|')} 異界　`+Object.keys(REALMS).map(k=>B('re:'+k,REALMS[k].name)).join(' '),f('|'),
    `${f('|')} 跳ぶ　${B('to:stairs','下り階段')} ${B('to:branch','支道の入口')} ${B('to:portal','異界の門')} ${B('to:lord','主')} ${B('to:altar','祭壇')} ${B('to:vault','宝物庫')}`,
    `${f('|')} 体　　${B('god','無敵：'+(godMode?'オン':'オフ'))} ${B('heal','全快')}　　見る　${B('reveal','地図を明かす')}`,
    `${f('|')} 得る　${B('give:slot','空の枠')} ${B('give:body','補助のルーン全種')} ${B('give:runes','すべてのルーン')} ${B('give:legends','伝説の三つ')}`,
    `${f('|')} 敵　　${B('clear','周りの敵を消す')} ${B('kill:lord','主を倒す')}　　仕掛け　${B('open','鉄格子を開ける')}`,f('|'),`${f('|')} <span class="lab">F2 か Esc で閉じる。同じことは、コンソールの dbg.help() からもできる</span>`,f('+---')];
  el.innerHTML=boxText(rows);
  for(const b of el.querySelectorAll('button[data-c]'))b.onclick=()=>{ const [c,a,b2]=b.dataset.c.split(':');
    if(c==='go')dbg.go(+a); else if(c==='br')dbg.branch(a,+b2); else if(c==='re')dbg.realm(a); else if(c==='to')dbg.to(a); else if(c==='god')dbg.god(); else if(c==='heal')dbg.heal(); else if(c==='reveal')dbg.reveal(); else if(c==='give')dbg.give(a); else if(c==='clear')dbg.clear(); else if(c==='kill')dbg.kill(a); else if(c==='open')dbg.open();
    if(['go','br','re','to'].includes(c))setDbg(false); else renderDbg(); }; }
// URL options: ?dev=1&seed=123&depth=8 | branch=crypt:2 | realm=ice &to=stairs &god=1 &reveal=1 &give=slot,body
function dbgUrl(){ let q; try{ q=new URLSearchParams(location.search); }catch(e){ return; } if(q.get('dev')==='1'||TEST){ DEVALL=true; try{ localStorage.setItem('al_dev','1'); }catch(e){} buildIntroPanel(); }
  if(!DEVALL)return; const sd=q.get('seed'); if(sd&&/^[0-9]{1,10}$/.test(sd)){ runSeed=Number(sd)>>>0; const si=document.getElementById('seedIn'); if(si)si.value=sd; }
  const dp=q.get('depth'), br=q.get('branch'), re=q.get('realm'); if(!dp&&!br&&!re&&!q.get('to'))return;
  if(br){ const [k,l]=br.split(':'); dbg.branch(k,+l||1); } else if(re){ if(dp)depth=+dp; dbg.realm(re); } else dbg.go(+dp||1);
  if(q.get('god')==='1')dbg.god(true); if(q.get('reveal')==='1')dbg.reveal(); for(const g of (q.get('give')||'').split(',').filter(Boolean))dbg.give(g); if(q.get('to'))dbg.to(q.get('to')); }

// ---------------------------------------------------------------- the goal (stage C): three legendary things held by lords, a sealed descent, the deepest place, the last king's shadow
const FINAL_DEPTH=13;
const LEGEND_KINDS={candle:{name:'燭台',ch:'i',col:[1.0,0.78,0.42]}, bell:{name:'鐘',ch:'A',col:[0.98,0.9,0.55]}, mirror:{name:'鏡',ch:'O',col:[0.72,0.9,1.0]}};
const LEGEND_ORDER=['candle','bell','mirror'];
const BRANCH_HINT={crypt:'死者の眠る回廊の奥',lair:'獣の匂う洞窟の奥',sunken:'水に沈んだ神殿の底',nest:'糸の張りめぐらされた闇の奥',snake:'這うものたちの水場の奥'};
let LEGEND=null, finalSt=null, won=false;
MSTAT.final=[260,6,11,1.7];
MSTAT.final2=[260,8,14,1.25];
function getLegend(){
  if(LEGEND&&LEGEND.seed===runSeed)return LEGEND;
  if(!HIST)return null;
  const r=mulberry32((runSeed^0x1e9e3)>>>0), pk=a=>a[Math.floor(r()*a.length)], R=HIST.rulers, last=R[R.length-1], civ=HIST.civ;
  const pool=Object.keys(BRANCHES), take=k=>{ const i=pool.indexOf(k); if(i>=0)pool.splice(i,1); return k; };
  const where={};
  where.candle=(r()<0.75&&pool.includes('crypt'))?take('crypt'):take(pk(pool));
  where.bell=(r()<0.75&&pool.includes('sunken'))?take('sunken'):take(pk(pool));
  where.mirror=take(pk(pool));
  const r2=R[Math.floor(r()*Math.max(1,R.length-1))], r3=R[Math.floor(r()*R.length)];
  const items={
    candle:{name:`${last.name}王の燭台`, lore:`${last.title}${last.name}が最後の夜にともした燭台。王国が闇に呑まれた時も、火だけは消えなかった。`},
    bell:  {name:where.bell==='sunken'?`${civ.name}の都の鐘`:`${r2.name}王の鐘`, lore:where.bell==='sunken'?`この鐘が鳴ったのは一度きり。${civ.name}の都が水に沈んだ日のことだ。`:`${r2.title}${r2.name}の時代に鋳られた鐘。その音は、闇をひととき退けたという。`},
    mirror:{name:`${r3.name}王の鏡`, lore:`${civ.ep}が、最後の光を映して封じた鏡。覗くと、今はない空が見える。`},
  };
  for(const k of LEGEND_ORDER){ items[k].branch=where[k]; items[k].kind=k; }
  LEGEND={seed:runSeed,items,have:new Set(),placed:new Set()};
  return LEGEND;
}
const legendOfBranch=bk=>{ const L=getLegend(); if(!L)return null; return LEGEND_ORDER.find(k=>L.items[k].branch===bk)||null; };
const legendAll=()=>{ const L=getLegend(); return !!L&&L.have.size>=3; };
const isFinal=()=>depth===FINAL_DEPTH&&!branch&&!realm&&!inter;
const descentSealed=()=>depth===FINAL_DEPTH-1&&!branch&&!realm&&!legendAll();
function legendLine(){ const L=getLegend(); if(!L)return '';
  return LEGEND_ORDER.map(k=>{ const kd=LEGEND_KINDS[k], has=L.have.has(k)||L.placed.has(k); return has?`<span class="glow" style="color:${css(kd.col)}">${kd.ch}</span>`:`<span class="dim">${kd.ch}</span>`; }).join(' ')+`  <span class="lab">${LEGEND_ORDER.map(k=>LEGEND_KINDS[k].name).join('・')}</span>`; }

// a lord falls: its legendary thing (if it holds one) or a golden rune
function lordFell(m){
  if(m.key!=='lord'||!branch)return;
  runState.lordsDone.add(branch.key);
  { let si=m.cz*MW+m.cx; for(const d of [1,-1,MW,-MW])if(D.tile[si+d]===TF&&!D.liquid[si+d]){ si+=d; break; } D.items.push({i:si,kind:'slot',taken:false,born:time}); }
  const k=legendOfBranch(branch.key), L=getLegend();
  if(k&&L&&!L.have.has(k)){ D.items.push({i:m.cz*MW+m.cx,kind:'legend',legend:k,taken:false,born:time});
    const c=LEGEND_KINDS[k].col; for(let q=0;q<60;q++){ const a=mr()*6.28; spawn(m.x,0.8+mr()*1.5,m.z,Math.cos(a)*2.2,0.5+mr()*2.4,Math.sin(a)*2.2,1.2+mr(),G(mpick(['*','+','.','\''])),0.2,c[0]*3,c[1]*3,c[2]*3,0); }
    sChime(m.x,m.z,0.6); setTimeout(()=>sChime(m.x,m.z,0.5),300);
    msg(`<b style="color:${css(c)}">${LEGEND_KINDS[k].ch}</b>${mname(m)}が崩れ落ちた。その胸の奥から、ひとつの光がこぼれ落ちた。`); }
}
let slotPickN=0;
function applyOpen(t){ if(t==='slotR'||t==='slotL'){ const H=hands[t.slice(4)]; H.slotN=Math.min(SLOT_MAX,(H.slotN||2)+1); while(H.slots.length<H.slotN)H.slots.push(null); } else if(t==='body')runState.bodyOpen=Math.min(2,(runState.bodyOpen||0)+1); syncHands(); renderHotbar(); if(invOpen)renderInv(); }
function openSlot(cell){ const opts=[];
  for(const h of ['R','L'])if((hands[h].slotN||2)<SLOT_MAX)opts.push({target:'slot'+h,label:`${h==='L'?'左':'右'}手に、ルーンの枠をもう1つ`});
  if((runState.bodyOpen||0)<2)opts.push({target:'body',label:'身の護符の枠'});
  sChime(player.x,player.z,0.5); setTimeout(()=>sChime(player.x,player.z,0.4),220);
  for(let q=0;q<30;q++){ const a=mr()*6.28; spawn(player.x,0.6+mr(),player.z,Math.cos(a)*1.2,0.4+mr()*1.4,Math.sin(a)*1.2,0.9,G(mpick(['{','}','*','.'])),0.16,2.4,2.1,1.4,0); }
  if(!opts.length){ const ru=makeRune(randomRuneType(mr),0); msg('<b style="color:#ffe3a0">{ }</b>空の枠を手にした。開ける枠はもうない。枠は、ひとつのルーンに姿を変えた。'); takeRune(ru); return; }
  if(opts.length===1){ applyOpen(opts[0].target); msg(`<b style="color:#ffe3a0">{ }</b>空の枠を手にした。${opts[0].label}が開いた。`); return; }
  const grp='slotpick'+(++slotPickN);
  opts.forEach((o,k)=>D.items.push({i:cell,kind:'rune',altar:true,grp,slot:k,opt:'open',target:o.target,label:o.label,rune:{uid:-1,type:'slotopt',aff:{}},taken:false}));
  runState.slotPend=grp; msg('<b style="color:#ffe3a0">{ }</b>空の枠を手にした。どの枠を開けるか、選ぶ。'); }

function pickLegend(it){
  const L=getLegend(), k=it.legend, kd=LEGEND_KINDS[k], c=kd.col; L.have.add(k); renderStatus();
  sChime(player.x,player.z,0.6); setTimeout(()=>sChime(player.x,player.z,0.5),250); setTimeout(()=>sChime(player.x,player.z,0.4),500);
  msg(`<b style="color:${css(c)}">${kd.ch}</b><b style="color:${css(c)}">${L.items[k].name}</b>を手にした。`); msg(`<span class="lab">${L.items[k].lore}</span>`);
  if(L.have.size===3)setTimeout(()=>msg(`<b style="color:#ffe9b0">*</b>三つの光が、手の中で同じ方へ震えている。ずっと下の、闇の底へ。`),1800);
}
// the oracle names, in its own way, where the three are kept
function oracleLegendHints(){ const L=getLegend(); if(!L)return;
  LEGEND_ORDER.forEach((k,j)=>{ if(L.have.has(k))return; const it=L.items[k]; setTimeout(()=>msg(`<b style="color:#bfe4ff">「</b>${LEGEND_KINDS[k].name}は、${BRANCH_HINT[it.branch]}で、主に抱かれている」`),900+j*700); }); }

// ---------------------------------------------------------------- the deepest place: three pedestals around where the stairs would go down
function setupFinal(){
  // the bottom is the highest point of the cave the stairs end in, so the shadow can stand under the vault
  // the bottom: the place with the highest vault on this level, with open floor around it for the pedestals
  let c0=D.stairs, bc=D.ceil[c0]||0; const open=i=>i>=0&&i<NCELL&&D.tile[i]===TF&&!D.liquid[i]&&!D.solid.has(i);
  for(const rad of [3,2,1]){ for(let i=0;i<NCELL;i++){ if(!open(i)||D.ceil[i]<=bc)continue; const x=i%MW, z=(i/MW)|0; let ok=x>rad&&z>rad&&x<MW-rad-1&&z<MH-rad-1;
      for(let dz=-rad;dz<=rad&&ok;dz++)for(let dx=-rad;dx<=rad;dx++)if(!open(i+dz*MW+dx)){ ok=false; break; } if(ok){ bc=D.ceil[i]; c0=i; } }
    if(bc>=10)break; }
  const L=getLegend(), cx0=c0%MW, cz0=(c0/MW)|0;
  monsters=monsters.filter(m=>m.ty.critter);
  const ok=c=>c>=0&&c<NCELL&&D.tile[c]===TF&&!D.liquid[c]&&!D.solid.has(c)&&c!==c0;
  const cand=[]; for(let dz=-5;dz<=5;dz++)for(let dx=-5;dx<=5;dx++){ const d=Math.hypot(dx,dz); if(d<2.4||d>4.6)continue; const c=(cz0+dz)*MW+cx0+dx; if(ok(c))cand.push([Math.atan2(dz,dx),c]); }
  cand.sort((a,b)=>a[0]-b[0]); const peds=[];
  if(cand.length>=3){ const step=cand.length/3; for(let k=0;k<3;k++)peds.push({kind:LEGEND_ORDER[k],i:cand[Math.floor(k*step)][1]}); }
  else { const free=[]; for(let i=0;i<NCELL;i++)if(ok(i))free.push(i); free.sort((a,b)=>Math.hypot(a%MW-cx0,((a/MW)|0)-cz0)-Math.hypot(b%MW-cx0,((b/MW)|0)-cz0)); for(let k=0;k<3;k++)peds.push({kind:LEGEND_ORDER[k],i:free[2+k*3]}); }
  finalSt={c0,peds,boss:null,bossT:-1,summonT:12,said:false};
  for(const k of LEGEND_ORDER)if(L.placed.has(k))L.have.delete(k);
  if(L.placed.size===3)finalSt.bossT=1.5;
}
const pedLit=p=>{ const L=getLegend(); return !!L&&L.placed.has(p.kind); };
function finalExposed(m){ if(!finalSt)return true; return finalSt.peds.some(p=>{ if(!pedLit(p))return false; const [x,z]=cpos(p.i); return Math.hypot(m.x-x,m.z-z)<4.5; }); }
function updateFinal(dt){
  if(!finalSt||!isFinal()||dead)return; const L=getLegend();
  if(!finalSt.said&&started){ finalSt.said=true; setTimeout(()=>msg('<b style="color:#bfe4ff">.</b>底に着いた。光の届かない、静かな闇だ。三つの台座が、何かを待っている。'),1600); }
  for(const p of finalSt.peds){ if(L.placed.has(p.kind)||!L.have.has(p.kind))continue; const [x,z]=cpos(p.i); if(Math.hypot(x-player.x,z-player.z)>1.4)continue;
    L.have.delete(p.kind); L.placed.add(p.kind); renderStatus(); const c=LEGEND_KINDS[p.kind].col;
    for(let q=0;q<70;q++){ const a=mr()*6.28; spawn(x,0.5+mr()*4,z,Math.cos(a)*1.2,0.6+mr()*2.5,Math.sin(a)*1.2,1.4+mr(),G(mpick(['|','*','.','\''])),0.2,c[0]*3,c[1]*3,c[2]*3,0); }
    sChime(x,z,0.7); flash=Math.max(flash,0.35);
    msg(`<b style="color:${css(c)}">${LEGEND_KINDS[p.kind].ch}</b>${L.items[p.kind].name}を台座に置いた。光の柱が、闇を押し返していく。`);
    if(L.placed.size===3)finalSt.bossT=2.6; }
  if(finalSt.bossT>0){ finalSt.bossT-=dt; if(finalSt.bossT<=0)spawnFinalBoss(); }
  const b=finalSt.boss; if(b&&!b.dead&&!b.phase2&&b.hp<b.maxHp*0.5)transformShadow(b);
  if(b&&b.invulnT>0)b.invulnT-=dt;
  if(b&&!b.dead){ finalSt.summonT-=dt;
    if(finalSt.summonT<=0){ finalSt.summonT=14; const n=monsters.filter(m=>!m.dead&&m.key==='W').length; if(n<4){ for(let k=0;k<2;k++){ const a=mr()*6.28, cx=Math.floor((b.x+Math.cos(a)*2.5)/CELL), cz=Math.floor((b.z+Math.sin(a)*2.5)/CELL), c=cz*MW+cx; if(D.tile[c]!==TF)continue;
        const s=makeMonster({key:'W',cx,cz,g:-1,lead:true}); s.sleep=false; s.aware=1.25; s.noticed=true; monsters.push(s); for(let q=0;q<16;q++){ const an=mr()*6.28; spawn(s.x,0.6,s.z,Math.cos(an),0.4+mr(),Math.sin(an),0.8,G('.'),0.14,0.6,0.4,1.2,0); } }
        msg(`<b style="color:#a98cff">W</b>影が身をよじり、闇の中から亡霊を呼び出した。`); } } }
}
function spawnFinalBoss(){
  const R=HIST.rulers, last=R[R.length-1], cx=finalSt.c0%MW, cz=(finalSt.c0/MW)|0;
  const ceilH=D.ceil[finalSt.c0]||6;
  MTYPES.final={...MTYPES.L,ch:'&',look:null,form:'shadowking',sk:'final',name:`${last.name}王の影`,scale:Math.max(2.0,Math.min(3.6,(ceilH-0.3)/3.3)),col:[0.62,0.48,1.0],boss:true,lich:false,light:6,verb:'王冠の形をした影が、底の闇から立ちのぼっている'};
  const b=makeMonster({key:'final',cx,cz,g:-1,lead:true}); b.sleep=false; b.aware=1.25; b.noticed=true; monsters.push(b); finalSt.boss=b;
  sRumble(0.9,3); shake=Math.max(shake,0.6); flash=Math.max(flash,0.3);
  for(let q=0;q<90;q++){ const a=mr()*6.28, e=mr(); spawn(b.x+Math.cos(a)*e*2,0.2,b.z+Math.sin(a)*e*2,Math.cos(a)*0.6,1+mr()*3,Math.sin(a)*0.6,1.6+mr(),G(mpick(['%','#','.','&'])),0.24,0.5,0.35,0.9,0); }
  msg(`<b style="color:#a98cff">&amp;</b>三つの光に照らされて、底の闇がひとところに集まっていく……`);
  setTimeout(()=>msg(`<b style="color:#a98cff">&amp;</b><b style="color:#c9b8ff">${last.title}${last.name}の影</b>が立ち上がった。闇の外では、その影に触れることさえできない。`),1400);
}
// drawing: the pedestals, the pillars of light and their circles; the seal on the stairs at the last level before the bottom; legendary things lying where a lord fell
function drawLegendWorld(t){
  const L=getLegend(); if(!L||!D)return;
  for(const it of (D.items||[])){ if(it.taken||it.kind!=='legend')continue; const [x,z]=cpos(it.i), c=LEGEND_KINDS[it.legend].col, b=2.4+0.6*Math.sin(t*2.5);
    dyn(x,1.0+Math.sin(t*1.6)*0.08,z,G(LEGEND_KINDS[it.legend].ch),0.7,c[0]*b,c[1]*b,c[2]*b);
    for(let k=0;k<10;k++){ const a=t*0.9+k/10*Math.PI*2; dyn(x+Math.cos(a)*0.5,0.3+k*0.04,z+Math.sin(a)*0.5,G('*'),0.1,c[0]*2,c[1]*2,c[2]*2); }
    for(let y=0;y<10;y++)dyn(x,1.4+y*0.5,z,G('|'),0.2,c[0]*(1.2-y*0.1),c[1]*(1.2-y*0.1),c[2]*(1.2-y*0.1)); }
  if(descentSealed()){ const [x,z]=cpos(D.stairs); if(Math.hypot(x-player.x,z-player.z)<30)LEGEND_ORDER.forEach((k,j)=>{ const a=j/3*Math.PI*2+t*0.3, kd=LEGEND_KINDS[k], has=L.have.has(k), c=kd.col, br=has?2.4:0.35;
      dyn(x+Math.cos(a)*1.1,0.9,z+Math.sin(a)*1.1,G(kd.ch),0.4,c[0]*br,c[1]*br,c[2]*br); for(let q=0;q<8;q++){ const b2=a+q*0.09; dyn(x+Math.cos(b2)*1.1,0.12,z+Math.sin(b2)*1.1,G('.'),0.1,0.5,0.45,0.7); } }); }
  if(finalSt&&isFinal()){ for(const p of finalSt.peds){ const [x,z]=cpos(p.i), kd=LEGEND_KINDS[p.kind], c=kd.col, lit=L.placed.has(p.kind), can=L.have.has(p.kind);
      dyn(x,0.25,z,G('#'),0.4,0.45,0.42,0.52); dyn(x,0.6,z,G('='),0.42,0.55,0.52,0.6);
      const br=lit?3:can?1.4+0.8*Math.sin(t*4):0.3; dyn(x,1.0,z,G(kd.ch),0.48,c[0]*br,c[1]*br,c[2]*br);
      if(lit){ for(let y=0;y<14;y++){ const fl=0.75+0.25*Math.sin(t*3+y); dyn(x+(mr()-0.5)*0.05,1.3+y*0.45,z,G(y%3?'|':'*'),0.22,c[0]*2.2*fl*(1-y/18),c[1]*2.2*fl*(1-y/18),c[2]*2.2*fl*(1-y/18)); }
        for(let k=0;k<28;k++){ const a=k/28*Math.PI*2+t*0.15; dyn(x+Math.cos(a)*4.5,0.1,z+Math.sin(a)*4.5,G(k%4?'.':'+'),0.16,c[0]*1.3,c[1]*1.3,c[2]*1.3); } } }
    const b=finalSt.boss; if(b&&!b.dead&&b.visible!==false){ const ex=finalExposed(b); b.glow=ex?2.2+0.4*Math.sin(t*9):0.55; b.heartOn=ex; } }
}
// the end: a screen like the one for death, but light
function victory(){
  if(won)return; won=true; dead=true; keys.KeyW=keys.KeyA=keys.KeyS=keys.KeyD=false;
  const el=document.getElementById('death'); if(!el)return; const L=getLegend();
  const secs=Math.floor(time-runStats.t0), mm=Math.floor(secs/60), ss=String(secs%60).padStart(2,'0'), f=t=>`<span class="f">${t}</span>`;
  const R=awardLore(true); graveCands=[]; document.body.classList.add('over');
  el.innerHTML=boxText([f('+-- 光 は 戻 っ た ---'),f('|'),...LEGEND_ORDER.map(k=>`${f('|')}  <b style="color:${css(LEGEND_KINDS[k].col)}">${LEGEND_KINDS[k].ch}</b> ${L.items[k].name}`),f('|'),
    `${f('|')}  Lv${lvl.n}　倒した敵 ${runStats.kills}　時間 ${mm}:${ss}　シード ${runSeed}`,f('|'),...loreRows(R,f),f('|'),`${f('|')}  ${HIST.civ.name}の地の底に、ひとつの灯りがともった。`,f('|'),`${f('|')}  <b>[Enter]</b> 新しい冒険へ`,f('+---')]);
  el.classList.add('show','won'); for(let k=0;k<4;k++)setTimeout(()=>sChime(player.x,player.z,0.5),k*380);
}

// ---------------------------------------------------------------- lightning that can be followed: a jagged bolt that flickers, jumping one target after another, lighting the room for an instant
let boltFx=[], zapQueue=[], zapFlash=null;
function jagged(a,b,amp){ const n=Math.max(3,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/0.45)), pts=[a];
  for(let k=1;k<n;k++){ const f=k/n, w=Math.sin(Math.PI*f)*amp; pts.push([a[0]+(b[0]-a[0])*f+(mr()-0.5)*w*2,a[1]+(b[1]-a[1])*f+(mr()-0.5)*w*2,a[2]+(b[2]-a[2])*f+(mr()-0.5)*w*2]); }
  pts.push(b); return pts; }
function addBolt(a,b,col,style){ style=style||'thunder'; const amp=style==='thunder'?0.35:0.14; boltFx.push({a,b,col,style,amp,t:0,life:style==='thunder'?0.36:0.3,re:0,pts:jagged(a,b,amp)}); }
function sparkCrown(m,col){ const cy=m.y+0.6*m.ty.scale+0.35*m.ty.scale; m.hitT=Math.max(m.hitT||0,0.3);
  for(let q=0;q<12;q++){ const a=q/12*Math.PI*2; spawn(m.x+Math.cos(a)*0.3*m.ty.scale,cy,m.z+Math.sin(a)*0.3*m.ty.scale,Math.cos(a)*1.4,1.2+mr(),Math.sin(a)*1.4,0.35,G(mpick(['*','+','\''])),0.13,col[0]*3.2,col[1]*3.2,col[2]*3.2,0); } }
function drawBoltFx(t,dt){
  for(const z of zapQueue){ z.t-=dt; if(z.t<=0&&!z.done){ z.done=true; z.fn(); } } zapQueue=zapQueue.filter(z=>!z.done);
  if(zapFlash&&zapFlash.t<900)zapFlash.t-=dt;
  for(const f of boltFx){ f.t+=dt; f.re-=dt; if(f.re<=0){ f.re=0.07; f.pts=jagged(f.a,f.b,f.amp); }
    const fade=Math.max(0,1-f.t/f.life), c=f.col, br=(f.style==='thunder'?3.2:2.2)*fade*(0.75+0.5*mr());
    for(let k=0;k+1<f.pts.length;k++){ const p=f.pts[k], q=f.pts[k+1], dx=q[0]-p[0], dy=q[1]-p[1], dz=q[2]-p[2], hz=Math.hypot(dx,dz);
      const ch=f.style==='thunder'?(Math.abs(dy)>hz*1.2?'|':((dy>0)===(dx+dz>0)?'/':'\\')):f.style==='fire'?mpick(['^','~']):f.style==='ice'?mpick(['*','.']):mpick(['%','.']);
      const n=Math.max(1,Math.round(Math.hypot(dx,dy,dz)/0.2)); for(let j=0;j<n;j++){ const s=j/n; dyn(p[0]+dx*s,p[1]+dy*s,p[2]+dz*s,G(ch),f.style==='thunder'?0.16:0.12,c[0]*br,c[1]*br,c[2]*br); } } }
  boltFx=boltFx.filter(f=>f.t<f.life);
}

// ---------------------------------------------------------------- back to the title (the adventure ends)
let titleArm=0;
function returnToTitle(){
  setMenu(false); if(invOpen)setInv(false); if(locked&&document.exitPointerLock)document.exitPointerLock();
  started=false; dead=false; won=false; gallery=null; castSt=null; swapSt=null; zapFlash=null;
  document.body.classList.remove('started'); const de=document.getElementById('death'); if(de)de.classList.remove('show','won');
  const gp=document.getElementById('gal'); if(gp)gp.classList.remove('show');
  runSeed=(Math.random()*1e9)>>>0; depth=startDepth; branch=null; realm=null; placeMem.clear(); arrive=null;
  player.hp=PLAYER_MAX; resetRunes(); newLevel();
  introEl.classList.remove('gone'); setHelp(false); const st=document.getElementById('stratum'); if(st)st.classList.remove('show');
  renderStatus(); renderHotbar();
}

// ---------------------------------------------------------------- what has been met and found (kept across adventures); a developer switch shows everything
const loadSet=k=>{ try{ return new Set(JSON.parse(localStorage.getItem(k)||'[]')); }catch(e){ return new Set(); } };
const saveSet=(k,s)=>{ try{ localStorage.setItem(k,JSON.stringify([...s])); }catch(e){} };
let SEEN=loadSet('al_seen'), RSEEN=loadSet('al_runes'), DEVALL=false; try{ DEVALL=localStorage.getItem('al_dev')==='1'; }catch(e){}

let seenT=0, gallery=null;
const seenKey=m=>m.ty.beast?'beast:'+runSeed+':'+m.ty.name:m.key==='lord'?'lord:'+(branch?branch.key:m.ty.sk):(m.key==='final'&&m.phase2)?'final2':m.key;
function trackSeen(dt){
  if(!started||gallery)return; seenT-=dt; if(seenT>0)return; seenT=0.5; const n0=SEEN.size;
  for(const m of monsters){ if(m.dead||m.hidden||!m.visible||m.ty.dummy)continue; if(Math.hypot(m.x-player.x,m.z-player.z)<26){ SEEN.add(seenKey(m)); if(m.ty.beast)recordBeast(m.ty); } }
  if(SEEN.size!==n0)saveSet('al_seen',SEEN);
}
const LORD_GAL={crypt:{base:'L',name:'不死の王',scale:1.7,verb:'王冠だけが、まだ光を失っていない亡霊'},lair:{base:'D',name:'年老いた竜',scale:3.6,verb:'巣の最奥で、とぐろを巻いて眠っている'},
  sunken:{base:'K',name:'深みの主',scale:3.6,verb:'沈んだ神殿の底から、無数の触手を伸ばしている'},nest:{base:'S',name:'蜘蛛の女王',scale:2.4,verb:'巣の中心で、光る糸を紡ぎ続けている'},
  snake:{base:'N',name:'ナーガの女王',scale:2.6,verb:'水場のほとりで、冠のような鱗を光らせている'}};
function galleryList(){
  const out=[]; for(const k of Object.keys(MTYPES)){ if(k==='lord'||k==='final'||k==='final2'||k==='X'||k.startsWith('__')||k.startsWith('dummy'))continue; out.push({key:k,ty:MTYPES[k]}); }
  for(const rec of loadBeasts().concat(DEVALL?beastSamples():[]))out.push({key:'beast:'+rec.seed+':'+rec.name,ty:{...rec,ch:'X',form:'beast',beast:true,light:9,boss:false,verb:rec.lore}});
  for(const [bk,L] of Object.entries(LORD_GAL)){ const base=MTYPES[L.base]; if(!base)continue; out.push({key:'lord:'+bk,ty:{...base,sk:L.base,name:L.name,scale:L.scale,verb:L.verb,boss:true,col:L.base==='L'?[0.75,0.9,1.0]:base.col,look:({crypt:null,lair:null,nest:null,snake:null})[bk]||base.look,...(bk==='lair'?{form:'olddragon',light:5}:bk==='sunken'?{form:'deepkraken',light:5}:bk==='crypt'?{form:'lichking',light:7}:bk==='nest'?{form:'spiderqueen',light:6}:bk==='snake'?{form:'nagaqueen',light:6}:{})}}); }
  out.push({key:'final',ty:{...MTYPES.L,ch:'&',look:null,form:'shadowking',sk:'final',name:'最後の王の影',scale:3.6,col:[0.62,0.48,1.0],boss:true,lich:false,light:6,verb:'光の届かない底で、王冠の形をした影が揺れている'}});
  out.push({key:'final2',ty:{...MTYPES.L,ch:'&',look:null,form:'shadowserpent',sk:'final2',name:'最後の王の影（底の闇）',scale:3.0,col:[0.62,0.48,1.0],boss:true,lich:false,light:6,verb:'冠と外套を失い、底の闇から長い体をもたげた影'}});
  return out;
}
// a quiet room from a fixed maze: everything else is cleared away
function galleryRoom(seed){
  depth=1; branch=null; realm=null; runState.startChosen=true; runState.altar1=true; newLevel(seed);
  let best=null,bl=0; for(const r of D.rooms){ if(r.cells.length>bl&&!r.cave&&!r.vault){ bl=r.cells.length; best=r; } }
  const cs=best.cells, cx=Math.round(cs.reduce((s,i)=>s+i%MW,0)/cs.length), cz=Math.round(cs.reduce((s,i)=>s+((i/MW)|0),0)/cs.length);
  D.items=[]; D.steles=[]; monsters=[]; projs=[]; clouds=[]; boltFx=[]; zapQueue=[];
  if(D.tall)for(const i of cs)D.tall[i]=0;
  return {cx,cz,x:(cx+0.5)*CELL,z:(cz+0.5)*CELL};
}
// ---------------------------------------------------------------- the bestiary: one creature at a time, turning slowly in the light
function showroom(){
  // a run seed whose depth 4 is the great hall
  runSeed=7; depth=4; branch=null; realm=null; inter={key:'bigroom',after:4}; runState.startChosen=true; runState.altar1=true; showroomGen=true; newLevel(424242); showroomGen=false; inter=null;
  const W=MW, open=i=>i>=0&&i<NCELL&&D.tile[i]===TF&&!D.liquid[i];
  let best=-1, bc=-1; for(let i=W*2;i<NCELL-W*2;i++){ if(!open(i))continue; const cx=i%W, cz=(i/W)|0; let c=0;
      for(let r=1;r<=12;r++){ let ok=true; for(let a=0;a<16&&ok;a++){ const an=a/16*Math.PI*2, j=Math.round(cz+Math.sin(an)*r)*W+Math.round(cx+Math.cos(an)*r); if(!open(j))ok=false; } if(!ok)break; c=r; }
      if(c>bc){ bc=c; best=i; } }
  const cx=best%W, cz=(best/W)|0, x=(cx+0.5)*CELL, z=(cz+0.5)*CELL;
  D.items=[]; D.steles=[]; monsters=[]; projs=[]; clouds=[]; boltFx=[]; zapQueue=[];
  fixtures=fixtures.filter(f=>{ const d=Math.hypot(f.x-x,f.z-z); if(d<8&&f.li!==undefined&&D.lights[f.li])D.lights[f.li].int=0; return d>=8; });
  for(const L of D.lights)if(Math.hypot(L.x-x,L.z-z)<8)L.int=0;
  // the open direction for the camera
  let dir=0, far=0; for(let a=0;a<16;a++){ const an=a/16*Math.PI*2; let d=0; for(let r=0.5;r<30;r+=0.5){ const j=Math.floor((z+Math.sin(an)*r)/CELL)*W+Math.floor((x+Math.cos(an)*r)/CELL); if(!open(j))break; d=r; } if(d>far){ far=d; dir=an; } }
  return {cx,cz,x,z,dir,far};
}
function openBestiary(){
  const all=galleryList(), list=DEVALL?all:all.filter(e=>SEEN.has(e.key));
  introEl.classList.add('gone'); const room=showroom();
  gallery={mode:'beast',list,all:all.length,idx:0,room,m:null,t:0};
  showBeast(0); renderGallery(); document.getElementById('gal').classList.add('show');
}
function showBeast(i){
  const g=gallery; monsters=[]; g.m=null; if(!g.list.length){ renderGallery(); return; }
  g.idx=(i+g.list.length)%g.list.length; const e=g.list[g.idx];
  MTYPES.__gal=e.ty; const m=makeMonster({key:'__gal',cx:g.room.cx,cz:g.room.cz,g:-1,lead:true});
  m.x=g.room.x; m.z=g.room.z; m.sleep=false; m.hidden=false; m.wait=1e9; m.galShow=true; m.heartOn=true; m.rise=1; m.surf=1; m.yaw=0; if(e.ty.form==='eel')m.y=0;
  g.water=e.ty.form==='kraken'||e.ty.form==='deepkraken'||e.ty.form==='eel'||e.ty.form==='fish'||e.ty.habitat==='deep'; if(g.water&&e.ty.form==='kraken')m.y=-0.25*(e.ty.scale||1); if(e.ty.form==='deepkraken')m.y=0; if(e.ty.habitat==='bog')m.y=0;
  monsters.push(m); g.m=m; g.t=0; renderGallery();
}
function updateGallery(dt){
  if(!gallery)return; const g=gallery;
  if(g.mode==='beast'&&g.m){ const m=g.m, sc=m.ty.scale||1; g.t+=dt; const walking=Math.floor(g.t/4)%2===1;
    m.moving+=((walking?1:0)-m.moving)*Math.min(1,dt*4); m.walk+=dt*2.2*m.moving; m.yaw+=dt*0.45; m.x=g.room.x; m.z=g.room.z;
    if(m.ty.form==='dragon'&&!m.ty.boss){ m.sleep=Math.floor(g.t/6)%2===0; if(m.sleep){ m.moving=0; } }
    { const ty=m.ty; if(ty.flier)m.y=(1.6+Math.sin(g.t*2.2)*0.15)*Math.max(1,sc*0.7); else if(ty.fl)m.y=ty.fl+Math.sin(g.t*1.3)*0.12; }
    const tall=m.ty.beast?1.3:m.ty.form==='lichking'?1.6:m.ty.form==='spiderqueen'?1.25:m.ty.form==='nagaqueen'?1.3:m.ty.form==='olddragon'?0.85:m.ty.form==='shadowking'?1.75:m.ty.form==='shadowserpent'?1.9:m.ty.form==='deepkraken'?2.0:1, want=(3.0+2.0*sc)*tall, R=Math.max(2,Math.min(want,g.room.far-0.8)), a=g.room.dir+0.25, cx=g.room.x+Math.cos(a)*R, cz=g.room.z+Math.sin(a)*R, ch=(1.0+0.75*sc)*tall+(m.ty.flier||m.ty.fl>0.5?m.y*0.5:0), ty2=Math.max(0.3,m.y+(m.ty.flier?0:0.6*sc*tall));
    player.x=cx; player.z=cz; player.yaw=Math.atan2(-(g.room.x-cx),-(g.room.z-cz)); player.pitch=Math.atan2(ty2-ch,R)-0.16;
    camera.position.set(cx,ch,cz); camera.rotation.set(player.pitch,player.yaw,0);
    if(R<want-0.2){ U.uCamP.value.set(cx,ch,cz); U.uCutP.value.set(g.room.x,ty2,g.room.z); U.uCut.value=1; } else U.uCut.value=0;
    zapFlash={x:g.room.x+Math.cos(a)*R*0.6,y:2.2+1.2*sc,z:g.room.z+Math.sin(a)*R*0.6,col:[0.5,0.48,0.45],t:999,r:7+3*sc}; }
  if(g.mode==='range'){ for(const d of g.dummies){ if(d.m.dead){ d.respawn-=dt; if(d.respawn<=0)spawnDummy(d); } else { d.respawn=1.5; d.m.dT=Math.max(0,(d.m.dT||0)-dt); if(d.m.dT<=0)d.m.dsum=0; } } }
}
function renderGallery(){
  const el=document.getElementById('gal'); if(!el||!gallery)return; const g=gallery, f=t=>`<span class="f">${t}</span>`;
  if(g.mode==='beast'){ const e=g.list[g.idx], ty=e&&e.ty, GW=64;
    const head=ty?`<b style="color:${css(ty.col||[1,1,1])}">${ty.ch==='&'?'&amp;':ty.ch}</b> <b>${ty.name}</b>`:'<span class="lab">まだ、何にも出会っていない</span>';
    const desc=wrapPlain(ty?ty.verb||'':'冒険で出会ったものが、ここに並ぶ',GW-4); while(desc.length<2)desc.push('');
    el.innerHTML=boxText([f('+-- 図鑑 ---'),`${f('|')} ${head}`,`${f('|')} <span class="lab">${desc[0]}</span>`,`${f('|')} <span class="lab">${desc[1]}</span>`,f('|'),
      `${f('|')} <button class="row" data-g="prev">[&lt;]</button> ${String(g.list.length?g.idx+1:0).padStart(2,' ')} / ${String(g.list.length).padStart(2,' ')}  <span class="lab">（見つけた数 ${String([...SEEN].filter(k=>k).length).padStart(2,' ')} / ${g.all}）</span> <button class="row" data-g="next">[&gt;]</button>`,
      `${f('|')} <button class="row" data-g="back">[タイトルへ戻る]</button>   <span class="lab">← → で切り替え　Esc で戻る</span>`,f('+---')],GW);
    for(const b of el.querySelectorAll('button[data-g]'))b.onclick=()=>{ const k=b.dataset.g; if(k==='prev')showBeast(g.idx-1); else if(k==='next')showBeast(g.idx+1); else returnToTitle(); }; }
}
// ---------------------------------------------------------------- the testing chamber: every rune found so far, and dummies that get back up
const DUMMY_KINDS=[{k:'dummy',name:'的の人形',col:[0.78,0.74,0.66]},{k:'dummyF',name:'的の人形（火に強い）',col:[1.0,0.55,0.3]},{k:'dummyP',name:'的の人形（毒が効かない）',col:[0.62,0.85,1.0]},{k:'dummyT',name:'的の人形（濡れている）',col:[0.5,0.7,1.0]}];
for(const d of DUMMY_KINDS){ MTYPES[d.k]={ch:'+',name:d.name,col:d.col,form:'humanoid',scale:0.95,speed:0,fl:0,light:1.6,trail:0,dummy:true,verb:'藁と石で組まれた的。何度倒れても、また起き上がる'}; MSTAT[d.k]=[60,0,0,99]; }
RES.dummyF={fire:0.2,ice:2}; RES.dummyP={poison:0.2,fire:2}; RES.dummyT={thunder:2,fire:0.5};
function spawnDummy(d){ const m=makeMonster({key:d.k,cx:Math.floor(d.x/CELL),cz:Math.floor(d.z/CELL),g:-1,lead:true}); m.x=d.x; m.z=d.z; m.yaw=0; m.sleep=false; m.wait=1e9; m.noticed=false; m.dsum=0;
  monsters.push(m); d.m=m; d.respawn=1.5; for(let q=0;q<14;q++){ const a=mr()*6.28; spawn(d.x,0.4,d.z,Math.cos(a),0.6+mr(),Math.sin(a),0.6,G('.'),0.12,1.2,1.1,0.9,0); } }
function openRange(){
  introEl.classList.add('gone'); sndInit(); resetRunes(); const room=galleryRoom(52571);
  gallery={mode:'range',room,dummies:[]};
  const types=Object.keys(RUNE_DEF).filter(t=>RUNE_DEF[t].cat!=='open'&&RUNE_DEF[t].cat!=='sub'&&(RUNE_DEF[t].cat!=='mod'||RUNE_TYPES.mod.includes(t))&&(DEVALL||RSEEN.has(t)||t==='blade'||t==='bolt'||RUNE_DEF[t].cat==='mod'));
  bag=[]; for(const t of types)bag.push(makeRune(t,0));
  for(const h of ['L','R']){ hands[h].slotN=SLOT_MAX; while(hands[h].slots.length<SLOT_MAX)hands[h].slots.push(null); } for(const t of RUNE_TYPES.mod)bag.push(makeStrong(t)); for(const w of RUNE_TYPES.atk)for(const k of Object.keys(TRAITS[w]))for(const lv of [3,5]){ const ru=makeRune(w,0); ru.traits=[{k,lv}]; bag.push(ru); } hands.B=hands.B||{b0:null,b1:null}; runState.bodyOpen=2;
  DUMMY_KINDS.forEach((dk,j)=>{ const d={k:dk.k,x:room.x+(j-1.5)*2.4,z:room.z-5}; gallery.dummies.push(d); spawnDummy(d); });
  player.x=room.x; player.z=room.z+3; player.yaw=0; player.pitch=-0.05; player.hp=PLAYER_MAX;
  dead=false; started=true; document.body.classList.add('started'); runStats={kills:0,t0:time};
  canvas.focus(); tryLock(); updateResume(); renderHotbar(); renderStatus();
  setTimeout(()=>{ msg('<b style="color:#bfe4ff">+</b>試しの間。<b>Tab</b> で武器・ルーン・護符を自由に付け替えられる（ここでは付け替えが一瞬で済む）。'); msg('<span class="lab">的の人形は動かず、何度倒れても起き上がる。頭の上の数字は、直前に与えたダメージの合計。メニューからタイトルへ戻れる。</span>'); },400);
}
function drawGallery(t){
  if(!gallery)return;
  if(gallery.mode==='beast'&&gallery.m){ const g=gallery, sc=gallery.m.ty.scale||1, r=0.9+0.7*sc, n=Math.round(18+8*sc);
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+t*0.05; dyn(g.room.x+Math.cos(a)*r,0.06,g.room.z+Math.sin(a)*r,G('.'),0.1,0.35,0.33,0.4); }
    if(g.water)for(let k=0;k<Math.round(30*sc);k++){ const a=k*2.399, rr=(0.4+((k*0.37)%1))*1.6*sc; dyn(g.room.x+Math.cos(a)*rr,0.05+0.03*Math.sin(t*2+k),g.room.z+Math.sin(a)*rr,G('~'),0.22,0.25,0.55,0.9); } }
  if(gallery.mode==='range'){ for(const d of gallery.dummies){ const m=d.m; if(!m||m.dead||!(m.dsum>0))continue; const s=String(Math.round(m.dsum)), y=m.y+2.2;
      for(let k=0;k<s.length;k++)dyn(m.x+(k-(s.length-1)/2)*0.26,y,m.z,G(s[k]),0.32,2.6,2.3,1.6); } }
}

// ---------------------------------------------------------------- spells meet the world: doors stop them, sight lines matter, ice freezes water and puts out fire, thunder runs through water, fire lights poison mist
let frozen=new Map(), beamIgT=-9;
function doorBlock(ci){ const d=D.doorAt&&D.doorAt.get(ci); return !!d&&!d.gone&&d.o<0.5; }
function losClear(ax,ay,az,bx,by,bz){ const d=Math.hypot(bx-ax,by-ay,bz-az), n=Math.ceil(d/0.3);
  for(let k=1;k<n;k++){ const f=k/n, x=ax+(bx-ax)*f, y=ay+(by-ay)*f, z=az+(bz-az)*f, ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL); if(ci<0||ci>=NCELL)return false;
    const tt=D.tile[ci]; if(tt===TW||tt===TX||doorBlock(ci)||y>D.ceil[ci])return false; }
  return true; }
const mCenter=m=>[m.x,m.y+0.6*m.ty.scale,m.z];
function beamFrame(h){ const o=handPoint(h), a=assistPoint(o,'beam')||aimPoint(), dx=a[0]-o[0], dy=a[1]-o[1], dz=a[2]-o[2], l=Math.hypot(dx,dy,dz); return {o,d:l>1?[dx/l,dy/l,dz/l]:viewDir()}; }
// ice: puts out fire, freezes water for a while (walkable, slippery); fire melts it again
function chillArea(x,z,r){ const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL), rr=Math.ceil(r/CELL)+1; let ch=false, froze=false;
  for(let dz=-rr;dz<=rr;dz++)for(let dx=-rr;dx<=rr;dx++){ const i=(cz+dz)*MW+cx+dx; if(i<0||i>=NCELL)continue; const px=(cx+dx+0.5)*CELL, pz=(cz+dz+0.5)*CELL; if(Math.hypot(px-x,pz-z)>r+0.7)continue;
    if(fire[i]>0){ fire[i]=0; ch=true; for(let q=0;q<5;q++)spawn(px+(mr()-0.5)*1.4,0.3,pz+(mr()-0.5)*1.4,0,0.9+mr(),0,0.9,G(mpick(['~','.'])),0.16,1.6,1.7,1.8,0); }
    const lq=D.liquid[i]; if((lq===LQ_WATER||lq===LQ_DEEP)&&!frozen.has(i)){ frozen.set(i,{t:25,liq:lq,surf:D.surface[i]}); D.liquid[i]=0; D.surface[i]=SF_ICE; ch=true; froze=true;
      for(const m of monsters){ if(m.dead||m.cx!==cx+dx||m.cz!==cz+dz)continue; const s2=m.st||(m.st={}); s2.chill=Math.max(s2.chill||0,4); } }
    else if(frozen.has(i))frozen.get(i).t=25; }
  if(ch)uploadCells();
  if(froze&&sndReady()){ const t=SND.ctx.currentTime, o=sOut(x,z,0.3); sEnv(sTone(t,'sine',2093,3136,0.4,o),t,0.004,0.35); sEnv(sNoise(t,0.3,'highpass',5000,0.6,o),t,0.003,0.25,0.4); } }
function updateFrozen(dt){ if(!frozen.size)return; let ch=false;
  for(const [i,f] of frozen){ f.t-=dt; if(f.t<=0||fire[i]>0.1){ D.liquid[i]=f.liq; D.surface[i]=f.surf; frozen.delete(i); ch=true; const [x,z]=cpos(i); for(let q=0;q<8;q++){ const a=mr()*6.28; spawn(x+Math.cos(a)*0.6,0.1,z+Math.sin(a)*0.6,Math.cos(a),0.6+mr(),Math.sin(a),0.6,G(mpick(['/','\\','~'])),0.14,0.7,0.95,1.2,1); } } }
  if(ch)uploadCells(); }
function drawFrozen(t){ for(const [i,f] of frozen){ const [x,z]=cpos(i); if(Math.hypot(x-player.x,z-player.z)>30)continue; const crack=f.t<5;
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){ const sh=0.85+0.15*Math.sin(t*2+a+b*1.7); dyn(x+(a-1)*0.62,0.08,z+(b-1)*0.62,G(crack&&((a+b)%2)?'/':'='),0.36,0.7*sh,0.92*sh,1.25*sh); } } }
// thunder runs through water: everything standing in the same water near the hit takes a share
function conductWater(m,base){ if(!inWater(m))return; let n=0;
  for(const o of monsters){ if(o===m||!foe(o)||!inWater(o))continue; if(Math.hypot(o.x-m.x,o.z-m.z)>6)continue; if(n++>5)break;
    addBolt([m.x,0.15,m.z],[o.x,0.15,o.z],RUNE_DEF.thunder.col,'thunder'); const r=(RES[o.key]||{}).thunder, k=r===undefined?1:r, d2=Math.round(Math.max(1,base*0.5)*k*1.5);
    if(d2>0)damageMonster(o,d2,'thunder'); if(!o.dead){ const s2=o.st||(o.st={}); s2.shock=Math.max(s2.shock||0,0.3); o.wind=0; } sparkCrown(o,RUNE_DEF.thunder.col); } }
// what an element does where it lands (walls, doors, floor, water)
function landElem(sp,x,y,z,ci){ if(!sp.elem||ci<0||ci>=NCELL)return; const areaK=1+(sp.aff.area||0)/100;
  if(sp.elem==='fire'){ if(doorBlock(ci)||(D.tile[ci]!==TW&&D.tile[ci]!==TX&&!D.liquid[ci]))burstFire(ci,0.5*areaK,0.9); }
  else if(sp.elem==='ice')chillArea(x,z,1.2*areaK);
  else if(sp.elem==='thunder'){ const lq=D.liquid[ci]; if(lq===LQ_WATER||lq===LQ_DEEP){ for(const o of monsters){ if(!foe(o)||!inWater(o)||Math.hypot(o.x-x,o.z-z)>5)continue; addBolt([x,0.15,z],[o.x,0.15,o.z],RUNE_DEF.thunder.col,'thunder'); damageMonster(o,2,'thunder'); } } } }
// fire reaching a poison mist sets the whole mist off
function cloudsMeetFire(){ for(const c of clouds){ if(c.t<=0)continue; const cx=Math.floor(c.x/CELL), cz=Math.floor(c.z/CELL), rr=Math.ceil(c.r/CELL); let lit=false;
    for(let dz=-rr;dz<=rr&&!lit;dz++)for(let dx=-rr;dx<=rr;dx++){ const i=(cz+dz)*MW+cx+dx; if(i>=0&&i<NCELL&&fire[i]>0.1){ lit=true; break; } }
    if(!lit)continue; c.t=0; const R=c.r+0.6;
    for(let q=0;q<46;q++){ const a=mr()*6.28, e=mr(); spawn(c.x+Math.cos(a)*e*R,0.4+mr()*1.2,c.z+Math.sin(a)*e*R,Math.cos(a)*2.4,0.8+mr()*2,Math.sin(a)*2.4,0.9+mr()*0.5,G(mpick(['*','#','%','\''])),0.22,3.2,1.8,0.6,0); }
    for(const o of monsters){ if(!foe(o)||Math.hypot(o.x-c.x,o.z-c.z)>R)continue; if(!losClear(c.x,0.6,c.z,...mCenter(o)))continue; damageMonster(o,roll(5,9),'fire'); }
    if(Math.hypot(player.x-c.x,player.z-c.z)<R*0.8)hurtPlayer(roll(1,3),'爆炎'); burstFire(cz*MW+cx,c.r/CELL+0.5,1.0); sBoom(0.4); shake=Math.max(shake,0.25); flash=Math.max(flash,0.3);
    if(!BOOK.has('blast')){ BOOK.add('blast'); try{ localStorage.setItem('al_book',JSON.stringify([...BOOK])); }catch(e){} } } }
// a perfect dodge: the dodge rune answers only when an attack was actually evaded
function onDodged(m){ if(!hands)return; let any=false;
  for(const h of ['L','R']){ const H=hands[h]; if(!(H.trig&&H.trig.type==='dodge'&&H.atk)||trigCd[h]>0||swapSt)continue;
    if(((atkType(h)==='blade'||atkType(h)==='gsweep')&&Math.hypot(m.x-player.x,m.z-player.z)>2.9)||(atkType(h)==='dash'&&Math.hypot(m.x-player.x,m.z-player.z)>4.5))continue;
    const [ox,oy,oz]=handPoint(h), c=mCenter(m), d=Math.hypot(c[0]-ox,c[1]-oy,c[2]-oz)||1; trigCd[h]=0.6; any=true;
    castNow(h,{dir:[(c[0]-ox)/d,(c[1]-oy)/d,(c[2]-oz)/d],auto:true}); }
  for(let q=0;q<16;q++){ const a=mr()*6.28; spawn(player.x+Math.cos(a)*0.6,1.0+mr(),player.z+Math.sin(a)*0.6,Math.cos(a)*1.5,0.3,Math.sin(a)*1.5,0.4,G(mpick(['~','\'','.'])),0.12,1.6,2.2,2.6,0); }
  if(any&&sndReady()){ const t=SND.ctx.currentTime; sEnv(sTone(t,'sine',1320,1980,0.18,sOut(undefined,undefined,0.12)),t,0.003,0.16); } }

// ---------------------------------------------------------------- the chant as a voice: whispered syllables that swell into a choir; each syllable lights one rune of the circle
const VOWELS=[[800,1150],[450,800],[325,700],[400,1700],[300,2200]];
const CHANT_STEPS=[0,3,5,7,10,12,15,17];
const ELEM_ROOT={fire:110,ice:294,thunder:196,poison:98};
function chantStart(el){
  if(!sndReady())return null; const ctx=SND.ctx, out=ctx.createGain(); out.gain.value=1; out.connect(sOut(undefined,undefined,0.85));
  const root=ELEM_ROOT[el]||165; let next=ctx.currentTime+0.03, syl=0, k=0, full=false, pad=[], stopped=false;
  const syllable=(t,f,vow,dur)=>{
    const amp=0.035*(0.25+0.75*k), breath=0.05*(1-k)+0.004;
    const f1=ctx.createBiquadFilter(), f2=ctx.createBiquadFilter(); f1.type='bandpass'; f2.type='bandpass'; f1.frequency.value=vow[0]; f2.frequency.value=vow[1]; f1.Q.value=7; f2.Q.value=9;
    const g=ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(amp,t+0.04); g.gain.setValueAtTime(amp,t+dur*0.6); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    f1.connect(g); f2.connect(g); g.connect(out);
    const n=1+Math.floor(k*3); for(let j=0;j<n;j++){ const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=f*[1,2,1.5,0.5][j]*Math.pow(2,(Math.random()-0.5)*0.014); o.connect(f1); o.connect(f2); o.start(t); o.stop(t+dur+0.05); }
    // the whisper: breath through a vowel-shaped band
    const s0=ctx.createBufferSource(); s0.buffer=SND.noise; const wf=ctx.createBiquadFilter(); wf.type='bandpass'; wf.frequency.value=vow[1]; wf.Q.value=2.5;
    const wg=ctx.createGain(); wg.gain.setValueAtTime(0.0001,t); wg.gain.exponentialRampToValueAtTime(breath,t+0.03); wg.gain.exponentialRampToValueAtTime(0.0001,t+dur*0.9);
    s0.connect(wf); wf.connect(wg); wg.connect(out); s0.start(t,Math.random()*1.5); s0.stop(t+dur+0.05);
    // a consonant at the front of the syllable
    sEnv(sNoise(t,0.04,'highpass',3500+Math.random()*2500,0.8,out),t,0.003,0.035,0.02*(0.5+0.5*(1-k)));
    // the element's own colour
    if(el==='ice')sEnv(sTone(t,'sine',f*4,f*4,0.5,out),t,0.004,0.45,0.012);
    else if(el==='thunder'&&Math.random()<0.6){ const tc=t+dur*(0.2+0.6*Math.random()); sEnv(sNoise(tc,0.04,'highpass',4500,1,out),tc,0.004,0.03,0.018); }
    else if(el==='fire')sEnv(sTone(t,'sawtooth',f*0.5,f*0.5,dur,out),t,0.03,dur*0.9,0.01);
    else if(el==='poison'){ const o=sTone(t,'sine',root*0.5,root*0.48,dur,out); sEnv(o,t,0.05,dur*0.9,0.02); }
  };
  const startPad=()=>{ const t=ctx.currentTime; for(const [mul,vow] of [[2,VOWELS[0]],[3,VOWELS[1]],[4,VOWELS[0]]]){
      const o=ctx.createOscillator(), f1=ctx.createBiquadFilter(), g=ctx.createGain(), lfo=ctx.createOscillator(), lg=ctx.createGain(); o.type='sawtooth'; o.frequency.value=root*mul;
      lfo.frequency.value=5+Math.random(); lg.gain.value=root*mul*0.006; lfo.connect(lg); lg.connect(o.frequency);
      f1.type='bandpass'; f1.frequency.value=vow[0]; f1.Q.value=6; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.03,t+0.12);
      o.connect(f1); f1.connect(g); g.connect(out); o.start(t); lfo.start(t); pad.push({o,lfo,g}); }
    sEnv(sTone(t,'sine',root*8,root*8,1.4,out),t,0.003,1.3,0.05); sEnv(sTone(t+0.02,'sine',root*12,root*12,1.0,out),t+0.02,0.003,0.9,0.025); };
  return {
    tick(kk,isFull){ if(stopped)return; k=kk; if(isFull&&!full){ full=true; startPad(); }
      while(next<ctx.currentTime+0.06){ const step=CHANT_STEPS[Math.min(CHANT_STEPS.length-1,(syl%4)+Math.floor(k*3)+(syl%3===2?1:0))], f=root*Math.pow(2,step/12);
        const dur=full?0.3:0.2; syllable(next,f,VOWELS[(syl*3)%5],dur); if(castSt){ castSt.syl=syl; castSt.sylT=time; } syl++; next+=full?0.3:0.21; } },
    stop(){ if(stopped)return; stopped=true; const t=ctx.currentTime; try{ out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value,t); out.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
      for(const p of pad){ p.o.stop(t+0.25); p.lfo.stop(t+0.25); } }catch(e){} } };
}

// ---------------------------------------------------------------- HUD at the bottom: what each hand holds, the chant
function renderHotbar(){
  const el=document.getElementById('hotbar'); if(!el||!hands)return;
  const part=h=>{ const H=effHand(h); syncHand(H); const c=elemCol(H.elem?H.elem.type:null), gl=[...new Set(handRunes(H).filter(r=>RUNE_DEF[r.type].cat==='elem').map(r=>r.type))].map(t=>`<span class="rn" style="color:${css(RUNE_DEF[t].col)}${H.elem&&H.elem.type===t?'':';opacity:0.45'}">${RUNE_DEF[t].ch}</span>`).join('');
    const tg=H.trig?` <span class="rn dim2" style="color:${css(TIER_COL[0])}">${RUNE_DEF[H.trig.type].ch}</span>`:'';
    let bar=''; if(castSt&&castSt.h===h){ const k=Math.min(1,castSt.t/Math.max(0.01,castSt.need)), n=Math.round(k*8); bar=`\n<span style="color:${css(c)}">${'='.repeat(n)}</span><span class="dim">${'-'.repeat(8-n)}</span>`; }
    return `<span class="${castSt&&castSt.h===h?'on':''}"><span class="dim">${h==='L'?'左':'右'}</span> ${gl||'<span class="dim">-</span>'} <span style="color:${css(c)}">${handName(H)}</span>${tg}${bar}</span>`; };
  let sw=''; if(swapSt){ const n=Math.round(swapSt.t/swapSt.dur*10); sw=`\n<span class="lab">付け替え</span> ${'='.repeat(n)}<span class="dim">${'-'.repeat(10-n)}</span>`; }
  el.innerHTML=part('L')+'      '+part('R')+sw;
}

// dodge roll (after Minecraft Dungeons): a quick burst in the direction you are moving, untouchable while it lasts
function startRoll(){
  if(dead||trans||(player.rollCd||0)>0||player.netT>0||player.roll)return;
  const k=keys, fw=((k.KeyW||k.ArrowUp)?1:0)-((k.KeyS||k.ArrowDown)?1:0), st=(k.KeyD?1:0)-(k.KeyA?1:0), sy=Math.sin(player.yaw), cy=Math.cos(player.yaw);
  let ix=-sy*fw+cy*st, iz=-cy*fw-sy*st; const l=Math.hypot(ix,iz); if(l<0.01){ ix=sy; iz=cy; } else { ix/=l; iz/=l; }
  player.roll={t:0,dx:ix,dz:iz}; player.rollCd=1.0; sWhoosh();
  if(swapSt){ restoreHands(swapSt.snap); swapSt=null; renderHotbar(); }
  if(castSt){ castSt=null; beamSegs=[]; fizzle(); renderHotbar(); }
  if(beamRun){ beamRun=null; beamSegs=[]; }
  for(let q=0;q<10;q++){ const a=mr()*6.28; spawn(player.x,0.1,player.z,Math.cos(a)*0.8,0.2+mr()*0.4,Math.sin(a)*0.8,0.6,G(mpick(['.',',','\''])),0.14,0.5,0.48,0.55,1); }
}

// ---------------------------------------------------------------- inventory as a list; hotbar (wheel / 1-5, right click) and a pack screen (Tab); a menu (Esc)
let invOpen=false, menuOpen=false, newRunArm=0;
const isPaused=()=>invOpen||menuOpen||dbgOpen||altarOpen||lvlOpen;
// ---------------------------------------------------------------- the rune screen, fixed in size: built once per change; hovering and choosing only touch the detail lines and the slot highlights
const CAT_BR={atk:['',''],elem:['(',')'],trig:['&lt;','&gt;'],mod:['{','}'],body:['','']};
const CAT_NAME={atk:'武器',elem:'性質',trig:'発動',mod:'効き方',body:'護符'};
const PACK_W=84, PACK_SLOT=14, BAG_LINES=2;
let packHover=null, packClick={u:0,t:0}, bagPage={atk:0,elem:0,trig:0}, bagPageN={atk:1,elem:1,trig:1};
const padTo=(html,w)=>html+' '.repeat(Math.max(0,w-visW(html)));
function wrapPlain(str,w){ const out=[]; let line='', lw=0; for(const ch of str){ const cw=visW(ch); if(lw+cw>w){ out.push(line); line=''; lw=0; } line+=ch; lw+=cw; } if(line)out.push(line); return out; }
function reactionOf(a,b){ const k=[a,b].sort().join('+'); return {'fire+ice':'steam','fire+poison':'blast','fire+thunder':'overload','ice+thunder':'shatter','ice+poison':'frostbite','poison+thunder':'contagion'}[k]||null; }
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
function emptyChip(cat,attrs){ const br=cat==='atk'?['',''] :cat==='body'?['"','']:cat==='rune'?['[',']']:(CAT_BR[cat]||['','']); return `<button class="row rs empty" ${attrs}><span class="mk"> </span><span class="dim">${br[0]} 空き ${br[1]}</span></button>`; }
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

// ---------------------------------------------------------------- first / third person (chosen in the menu)
let camMode='fps'; try{ camMode=localStorage.getItem('al_cam')||'fps'; }catch(e){}
const AVATAR_TY={ch:'@',name:'あなた',col:[1.0,0.9,0.75],form:'humanoid',scale:0.92,speed:1,fl:0,light:0,trail:0};
let avatar=null, camPos=null;
function headPos(){ return [player.x,player.eye+0.05-(player.roll?Math.sin(Math.PI*player.roll.t/0.32)*0.55:0),player.z]; }
// where attacks and thrown things start: the eye in first person, the head of the avatar in third person
function aimOrigin(){ return camMode==='tps'?headPos():[camera.position.x,camera.position.y,camera.position.z]; }
function camBlocked(x,y,z){
  for(const [ox,oz] of [[0,0],[0.22,0],[-0.22,0],[0,0.22],[0,-0.22]]){ const cx=Math.floor((x+ox)/CELL), cz=Math.floor((z+oz)/CELL); if(cx<0||cz<0||cx>=MW||cz>=MH)return true;
    const i=cz*MW+cx, tt=D.tile[i]; if(tt===TW||tt===TX)return true; if(y>D.ceil[i]-0.25)return true; if(tt!==TC&&y<0.3)return true;
    if(tt===TP&&Math.hypot(x+ox-(cx+0.5)*CELL,z+oz-(cz+0.5)*CELL)<0.7)return true; }
  return false;
}
function placeThirdPerson(dt,sk){
  const h=headPos(), [dx,dy,dz]=viewDir(), rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw);
  const tx=h[0]-dx*4.0+rx*0.5, ty=Math.max(0.4,h[1]-dy*4.0+0.5), tz=h[2]-dz*4.0+rz*0.5;
  if(!camPos)camPos=[tx,ty,tz];
  const k=Math.min(1,dt*14); camPos[0]+=(tx-camPos[0])*k; camPos[1]+=(ty-camPos[1])*k; camPos[2]+=(tz-camPos[2])*k;
  camera.position.set(camPos[0]+(mr()-0.5)*sk,camPos[1]+(mr()-0.5)*sk,camPos[2]);
  camera.rotation.set(player.pitch,player.yaw,0);
  U.uCamP.value.set(camPos[0],camPos[1],camPos[2]); U.uCutP.value.set(h[0],h[1]-0.25,h[2]); U.uCut.value=1;
}
function updateAvatar(dt){
  if(!avatar)avatar={ty:AVATAR_TY,form:buildForm(AVATAR_TY),x:0,z:0,y:0,yaw:0,walk:0,moving:0,ph:1.3,glow:1.1,surf:0};
  const sp=Math.hypot(player.vx,player.vz), face=(player.swing>0||sp<0.3)?player.yaw+Math.PI:Math.atan2(player.vx,player.vz);
  avatar.x=player.x; avatar.z=player.z; avatar.yaw=lerpAngle(avatar.yaw,face,1-Math.exp(-dt*12));
  avatar.moving+=((sp>0.3?1:0)-avatar.moving)*Math.min(1,dt*6); avatar.walk+=dt*sp*2.2;
  avatar.y=(player.eye<1?-0.95:0)-(player.roll?Math.sin(Math.PI*player.roll.t/0.32)*0.6:0);
  avatar.glow=1.9+Math.min(1.5,hurtFlash*2);
}
function rockAt(x,y,z){
  const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL); if(cx<0||cz<0||cx>=MW||cz>=MH)return true;
  const i=cz*MW+cx, tt=D.tile[i]; if(tt===TW||tt===TX)return true;
  if(y>D.ceil[i])return true; if(y<0&&tt!==TC)return true; return false;
}
function drawSection(){
  if(camMode!=='tps'||!camPos)return;
  const C=camPos, h=headPos(), P=[h[0],h[1]-0.25,h[2]], sx=P[0]-C[0], sy=P[1]-C[1], sz=P[2]-C[2], L=Math.hypot(sx,sy,sz)||1, ax=sx/L, ay=sy/L, az=sz/L;
  // two directions perpendicular to the line from the camera to you
  let ux=-az, uy=0, uz=ax; const ul=Math.hypot(ux,uz)||1; ux/=ul; uz/=ul;
  const vx=ay*uz-az*uy, vy=az*ux-ax*uz, vz=ax*uy-ay*ux;
  for(let r=0;r<18;r++){ const t=0.03+r*0.053, R=2.6+(0.9-2.6)*t+0.04, cx=C[0]+sx*t, cy=C[1]+sy*t, cz=C[2]+sz*t, n=Math.max(12,Math.round(R*22));
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+r*0.37, px=cx+(ux*Math.cos(a)+vx*Math.sin(a))*R, py=cy+(uy*Math.cos(a)+vy*Math.sin(a))*R, pz=cz+(uz*Math.cos(a)+vz*Math.sin(a))*R;
      if(!rockAt(px,py,pz))continue; const hsh=((k*73+r*151)%7), b=0.2+0.06*(hsh%3);
      dyn(px,py,pz,G(hsh<3?'#':hsh<5?'%':':'),0.38,b*1.25,b*1.1,b*1.35); } }
}
function setCamMode(m){ camMode=m; camPos=null; try{ localStorage.setItem('al_cam',m); }catch(e){} }

function updatePlayer(dt){
  if(dead)return;
  if(!started){ player.yaw+=dt*0.07; }
  else{
    const k=keys;
    const fw=((k.KeyW||k.ArrowUp)?1:0)-((k.KeyS||k.ArrowDown)?1:0), st=(k.KeyD?1:0)-(k.KeyA?1:0);
    if(k.ArrowLeft)player.yaw+=dt*2.0; if(k.ArrowRight)player.yaw-=dt*2.0;
    const sy=Math.sin(player.yaw), cy=Math.cos(player.yaw);
    const pci=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL), lq=D.liquid[pci], wade=(D.bridge[pci]?1:lq===LQ_DEEP?0.45:lq===LQ_BOG?0.55:lq===LQ_WATER?0.8:1)*(webTouch(pci)?0.35:1)*(D.surface[pci]===SF_MUD&&!lq?0.72:1)*(player.netT>0?0:1);
    if(pci!==player.lastCell){ player.lastCell=pci; brimFlare(pci); if(tallAt(pci)){ if(!tallMsg){ tallMsg=true; msg('<b style="color:#7ad86a">"</b>背の高い茂みを踏み分けた。茂みは視線を遮る。獣との間に挟めば、身を隠す壁になる。踏み分けた跡は、しばらくすると元に戻る。'); } trample(pci); } }
    if(!lq)scent[pci]=time;
    if(lq===LQ_DEEP&&!D.swimMsg){ D.swimMsg=true; msg('<b style="color:#5aa0ff">~</b>深い水に入った。足が届かない。ゆっくりと泳いで進む。'); }
    const ix=-sy*fw+cy*st, iz=-cy*fw-sy*st, len=Math.hypot(ix,iz), sp=((k.ShiftLeft||k.ShiftRight)&&!stealth.sneak?5.6:stealth.sneak?2.3:3.2)*wade;
    if(wade<1&&len){ player.splash=(player.splash||0)+dt*Math.hypot(player.vx,player.vz)*1.4; while(player.splash>1){ player.splash--; const a0=mr()*6.28;
      sSplash(lq===LQ_DEEP?0.22:0.12);
      for(let q=0;q<5;q++){ const a=a0+q/5*Math.PI*2; spawn(player.x+Math.cos(a)*0.15,0.07,player.z+Math.sin(a)*0.15,Math.cos(a)*0.5,0.02,Math.sin(a)*0.5,0.8,G(lq===LQ_BOG?'o':'~'),0.12,lq===LQ_BOG?0.3:0.15,lq===LQ_BOG?0.34:0.3,lq===LQ_BOG?0.12:0.55,1); } } }
    const onIce=D.surface[pci]===SF_ICE&&!D.liquid[pci]&&!D.bridge[pci];
    if(onIce&&!D.iceMsg){ D.iceMsg=true; msg('<b style="color:#b8e4ff">=</b>氷の上だ。足が滑る。止まるにも、曲がるにも時間がかかる。'); }
    if(D.thin[pci]&&!D.liquid[pci])crackIce(pci,dt);
    const BSP=1+0.15*bodyN('swift'), tx=len?ix/len*sp*BSP:0, tz=len?iz/len*sp*BSP:0, a=1-Math.exp(-dt*(onIce?1.3:9));
    player.vx+=(tx-player.vx)*a; player.vz+=(tz-player.vz)*a;
    if(player.lunge){ player.lunge.t+=dt; player.vx=player.lunge.dx*player.lunge.sp; player.vz=player.lunge.dz*player.lunge.sp; dashCuts(); if(player.lunge.t>=player.lunge.dur)player.lunge=null; }
    if(player.roll){ player.roll.t+=dt; const rs=8.5*Math.min(1,wade+0.25); player.vx=player.roll.dx*rs; player.vz=player.roll.dz*rs; if(player.roll.t>=0.32*(1+0.35*bodyN('roll')))player.roll=null; }
    player.rollCd=Math.max(0,(player.rollCd||0)-dt);
    let blocked='';
    const nx=player.x+player.vx*dt; if(!solidAt(nx,player.z,PR))player.x=nx; else { player.vx=0; blocked=blockType; }
    const nz=player.z+player.vz*dt; if(!solidAt(player.x,nz,PR))player.z=nz; else { player.vz=0; blocked=blocked||blockType; }
    // make impassable terrain legible: say what is in the way; at a chasm's edge, keep pushing to jump (as in Brogue)
    if(len&&blocked&&blocked!=='wall'){
      edge.t+=dt; edge.k=blocked; edge.idle=0;
      if(blocked==='chasm'){ showHint(`裂け目の縁だ。このまま進み続けると飛び降りる <b>[${'#'.repeat(Math.min(5,Math.floor(edge.t/0.24)))}${'-'.repeat(5-Math.min(5,Math.floor(edge.t/0.24)))}]</b>`); if(edge.t>1.2&&!trans){ trans={phase:'out',t:0,regen:false}; player.fall=true; sRumble(0.5,1.4); msg('<b style="color:#9a7cff">:</b>裂け目へ身を投じ、闇の中を下の階層へと落ちていく……'); } }
      else if(blocked==='lava'){ showHint('溶岩の熱が行く手を阻んでいる。これ以上は近づけない'); finalPass.uniforms.uHeat.value=Math.min(1.4,finalPass.uniforms.uHeat.value+dt*2); }
      else if(blocked==='gate')showHint('鉄格子が行く手を塞いでいる。どこかに開ける仕掛けがあるはずだ');
      else if(blocked==='xtal')showHint('結晶に行く手を塞がれている。光は通るが、体は通れない');
    } else { edge.idle+=dt; if(edge.idle>0.15)edge.t=0; if(edge.idle>0.9)showHint(''); }
    for(const m of monsters){
      if(m.ty.flier||m.ty.form==='eel')continue;
      const dx=player.x-m.x, dz=player.z-m.z, d=Math.hypot(dx,dz), rr=0.7*m.ty.scale;
      if(d<rr&&d>1e-4){ const qx=m.x+dx/d*rr, qz=m.z+dz/d*rr; if(!solidAt(qx,player.z,PR))player.x=qx; if(!solidAt(player.x,qz,PR))player.z=qz; }
    }
    player.bob+=dt*Math.hypot(player.vx,player.vz)*2.1;
  }
  const spd=Math.min(1,Math.hypot(player.vx,player.vz)/3.2);
  const sk=shake*0.08; shake=Math.max(0,shake-dt*1.2);
  { const pci=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL), deep=D.liquid[pci]===LQ_DEEP&&!D.bridge[pci]; player.eye+=((deep?0.62:EYE)-player.eye)*Math.min(1,dt*3); }
  if(camMode==='tps'){ placeThirdPerson(dt,sk); return; }
  U.uCut.value=0;
  camera.position.set(player.x+(mr()-0.5)*sk,(mr()-0.5)*sk+player.eye-(player.roll?Math.sin(Math.PI*player.roll.t/0.32)*0.55:0)+Math.sin(player.bob*2)*0.035*spd*(player.eye<1?0.3:1)+(player.eye<1?Math.sin(time*1.8)*0.04:0),player.z);
  camera.rotation.set(player.pitch,player.yaw,Math.sin(player.bob)*0.004*spd);
}
// eye adaptation and atmosphere: open caverns thin the fog, bright surroundings lower the exposure
function updateAtmosphere(dt){
  const pc=Math.floor(player.z/CELL)*MW+Math.floor(player.x/CELL), ri=D.roomOf[pc];
  const inCave=ri>=0&&D.rooms[ri].cave;
  const fogT=inCave?(D.stratum.k==='cavern'?0.032:0.03):(D.stratum.k==='ruins'?0.04:fogBase);
  U.uFogDen.value+=(fogT-U.uFogDen.value)*(1-Math.exp(-dt*0.9));
  const l=cellLight(player.x,player.z); let B=0.3*l[0]+0.55*l[1]+0.15*l[2];
  for(const m of monsters){ const d=Math.hypot(m.x-player.x,m.z-player.z); if(d<5)B+=(1-d/5)**2*0.7; }
  for(const f of fixtures){ const d=Math.hypot(f.x-player.x,f.z-player.z); if(d<3)B+=(1-d/3)**2*0.8; }
  const target=clamp(1.25/(1+B*0.6),0.55,1.25);
  expo+=(target-expo)*(1-Math.exp(-dt*(target<expo?2.5:1.0)));
  flash=Math.max(0,flash-dt*2.5);
  finalPass.uniforms.uExposure.value=expo*(1+flash*1.6);
  let heat=0; for(const f of fixtures){ if(f.type!=='lava'&&!(f.type==='crater'&&f.active))continue; heat=Math.max(heat,1-Math.hypot(f.x-player.x,f.z-player.z)/10); }
  const hu=finalPass.uniforms.uHeat; hu.value+=(heat-hu.value)*Math.min(1,dt*2);
  finalPass.uniforms.uSwim.value=camMode==='tps'?0:clamp((EYE-player.eye)/(EYE-0.62),0,1);
}

// ---------------------------------------------------------------- look descriptions
const FIX_NAMES={
 brazier:['*','火鉢','炎が揺れ、壁に火影を落としている'], crystal:['*','浮遊する水晶','ゆっくり回転しながら、脈打つ光を放っている'],
 rune:['0','魔法陣','刻まれた紋様が絶えず入れ替わりながら回っている'], lamp:['*','吊り灯','鎖に吊られた小さな灯が揺れている'],
 fungus:['"','発光する茸','胞子を漂わせながら燐光を放っている'], abyss:['^','深淵の灯','裂け目の底で燃え続ける光'],
 stairs:['>','下り階段','光の螺旋が、さらに深い階層へと続いている'], embers:['*','焚き火の残り火','熾火がまだかすかに赤く光っている'],
 upstairs:['<','上り階段','来た道へと引き返す階段'], tele:['*','転移の魔法陣','踏み込めば、対になった魔法陣へと運ばれる'], fall:['|','滝','天井の裂け目から、光る水が絶え間なく流れ落ちている'], crater:['^','溶岩の火口','床の裂け目の奥で、溶岩が脈打っている'], spring:['~','壁の亀裂','亀裂の奥から、水の流れる音がする'], relic:['?','浮遊する巻物','祭壇の上で静かに回転している'], orb:['o','古の灯','台座の上で、今も変わらず光り続けている球体'], well:['*','光井戸','崩れた天井の穴から、青白い光が降り注いでいる'], firefly:['.','光の粒の群れ','蛍のような光の粒が、ゆっくりと漂っている'], sun:['*','差し込む光','天井の裂け目から、遥か地上の光が差し込んでいる'], bloodwort:['*','ブラッドワート','赤く熟した実が、脈打つように光っている'], vent:['o','蒸気の噴出口','地の底から、時折熱い蒸気が噴き上がる'], marsh:['*','鬼火','沼の上をさまよう、青白い炎'], torch:['#','壁掛け松明','壁に据えられた松明が、琥珀色の光を投げかけている'],
};
const DECO_NAMES={'&':['&','彫像','石を刻んだ人影が、部屋の中央を見つめている'],'+':['+','墓石','R.I.P. と刻まれている'],
 '=':['=','朽ちた寝袋','誰かがここで眠った跡'],'%':['%','散らばった骨','先客の末路を物語っている'],'[':['[','書架','読めない文字の背表紙がぎっしりと並んでいる']};
const DECO_K={table:['=','石の食卓','埃をかぶった皿と杯が、並んだままになっている'],anvil:['T','金床','冷えきった鉄の塊。無数の槌の跡が残る'],colossus:['&','巨像','石を刻んだ巨大な像。その眼だけが、まだ光を宿している'],carpet:['.','古い絨毯','色褪せた文様が、灰の中でかろうじて残っている'],blood:['~','血だまり','乾ききらない、暗い赤'] };
let lookPend='', lookPendT=0;
const lookEl=document.getElementById('look'); let lookHTML='';
const lookLine=(ch,col,name,desc)=>`<b style="color:${css(col)}">${ch}</b>${name}<span>${desc}</span>`;
function look(){
  aimMon=null;
  if(!started||trans){ if(lookHTML){ lookHTML=''; lookEl.innerHTML=''; } return; }
  const cp=Math.cos(player.pitch), dx=-Math.sin(player.yaw)*cp, dy=Math.sin(player.pitch), dz=-Math.cos(player.yaw)*cp;
  const ox=camera.position.x, oy=camera.position.y, oz=camera.position.z;
  let best=null, bt=18;
  const sph=(cx,cy,cz,r,res)=>{ const lx=cx-ox, ly=cy-oy, lz=cz-oz, tc=lx*dx+ly*dy+lz*dz; if(tc<0)return; const d2=lx*lx+ly*ly+lz*lz-tc*tc; if(d2>r*r)return; const tt=tc-Math.sqrt(r*r-d2); if(tt<bt){bt=tt;best=res;} };
  for(const m of monsters){ const s=m.ty.scale, near=Math.hypot(m.x-ox,m.z-oz)<6;
    if(m.ty.invisible){ if(near)sph(m.x,m.y+1.1,m.z,0.6,{k:'ph'}); continue; }
    if(!m.visible)continue; sph(m.x,m.y+(m.ty.fl||m.ty.flier||m.ty.form==='eel'?0.3:0.9*s),m.z,0.6*s,{k:'m',m}); }
  for(const f of fixtures){
    if(!FIX_NAMES[f.type]&&f.type!=='bstairs'&&f.type!=='portal')continue; const L=D.lights[f.li];
    if(f.type==='torch'){ sph(f.wx+f.nx*0.15,2.0,f.wz+f.nz*0.15,0.35,{k:'f',f}); continue; }
    const fy=f.type==='fall'?(ceilAt(f.x,f.z)*0.5):f.type==='crater'?0.2:f.type==='spring'?1.3:f.type==='orb'?1.4:f.type==='well'?1.6:f.type==='firefly'?1.5:f.type==='sun'?1.6:f.type==='bloodwort'?0.9:f.type==='vent'?0.2:f.type==='brazier'?0.9:f.type==='stairs'?1.3:f.type==='rune'?0.3:f.type==='fungus'?0.3:(L?L.y:1.2);
    sph(f.x,fy,f.z,f.type==='stairs'?0.9:f.type==='rune'?1.2:f.type==='abyss'?1.0:0.5,{k:'f',f});
  }
  for(const d of D.doors){ if(d.gone)sph(d.bx,0.4,d.bz,0.8,{k:'dg',d}); else if(d.o<0.5)sph(d.bx,1.4,d.bz,1.0,{k:'d',d}); }
  for(const w of (D.webs||[])){ if(w.gone)continue; const [wx,wz]=cpos(w.i); sph(wx,1.3,wz,0.75,{k:'web'}); }
  for(const tr of (D.traps||[])){ if(tr.hidden)continue; const [tx3,tz3]=cpos(tr.i); sph(tx3,0.15,tz3,0.5,{k:'trap',tr}); }
  for(const it of (D.items||[])){ if(it.taken)continue; const [ix3,iz3]=cpos(it.i); sph(ix3,0.55,iz3,0.4,{k:'item',it}); }
  if(D.gate){ const [gx,gz]=cpos(D.gate.cell); if(D.gate.o<0.7)sph(gx,1.4,gz,0.95,{k:'gate'}); const [lx,lz]=cpos(D.gate.lever); sph(lx+D.gate.ld[0]*0.9,1.35,lz+D.gate.ld[1]*0.9,0.35,{k:'lever'}); }
  let gasSeen=false;
  let prevI=-1;
  for(let t=0.1;t<bt;t+=0.08){
    const x=ox+dx*t, y=oy+dy*t, z=oz+dz*t, cx=Math.floor(x/CELL), cz=Math.floor(z/CELL);
    if(cx<0||cz<0||cx>=MW||cz>=MH)break;
    const i=cz*MW+cx, tt=D.tile[i], ccx=(cx+0.5)*CELL, ccz=(cz+0.5)*CELL, pv=prevI; if(tt!==TW)prevI=i;
    if(t<8&&y<2&&D.gas[i]>0.25)gasSeen=true;
    if(tt===TW){ best={k:'wall',i,prev:pv}; break; }
    if(tt===TX&&y<3.6){ best={k:'xtal',i}; break; }
    if(tt===TP&&Math.hypot(x-ccx,z-ccz)<0.5){ best={k:'pillar',i}; break; }
    const sr=D.solid.get(i); if(sr&&y<2.3&&Math.hypot(x-ccx,z-ccz)<sr){ best={k:'deco',i}; break; }
    if(tt===TC){ if(D.pit&&D.pit[i]){ if(y<0.06){ best={k:'floor',i}; break; } } else if(y<-1){ best={k:'chasm',i}; break; } }
    else if(y<0.06){ best={k:'floor',i}; break; }
    if(y>D.ceil[i]){ best={k:'ceil',i}; break; }
  }
  if(gasSeen&&(!best||best.k==='floor'||best.k==='wall'||best.k==='ceil'))best={k:'gas'};
  let h='';
  if(best){
    const i=best.i, ri=i!==undefined?D.roomOf[i]:-1, cave=ri>=0&&D.rooms[ri].cave;
    if(best.k==='m')aimMon=best.m;
    switch(best.k){
      case 'item': { if(best.it.forge){ h=lookLine('T',[0.7,0.85,1.0],'鍛えの祭壇','今持っている武器を、ひとつ鍛えられる（特性を上げる、または足す）'); break; }
        if(best.it.kind==='grave'){ const g=best.it.g||{}; h=lookLine('+',[0.78,0.78,0.9],'前の冒険者の墓',`深度${g.depth}で、${g.cause||'何か'}に倒れた。${thingLabel(best.it.rune)}が眠っている`); break; }
        if(best.it.kind==='spring'){ h=lookLine('~',[0.5,0.9,1],'癒しの泉',best.it.taken?'もう光は残っていない':'触れると、傷がすっかり癒える。一度だけ'); break; }
        if(best.it.guardG!==undefined&&guardedNow(best.it)){ h=best.it.elitePrize?lookLine('*',[1,0.5,0.35],'守られた宝','強いものが守っている。番人を倒せば、手に取れる'):lookLine('_',[0.6,0.55,0.65],'眠っている祭壇','光はまだ眠っている。この部屋に巣くうものを退ければ、灯るだろう'); break; }
        const ru=best.it.rune; if(!ru)break; if(best.it.opt==='open'){ h=lookLine('{',[1,0.9,0.6],best.it.label,'空の枠が開けられる所。祭壇と同じく、選んで決める'); break; }
        if(best.it.opt==='heal'){ h=lookLine('+',[1,0.55,0.6],'癒しの光','傷が大きく癒える。祭壇の前で、数字キーで選ぶ'); break; }
        if(best.it.opt==='hone'){ const d=RUNE_DEF[ru.type]; h=lookLine(d.ch,runeCol(ru),d.name+'のルーンに宿す',`今はめている${d.name}のルーンに、${AFFIX[best.it.hone.k].fmt(best.it.hone.v)} が宿る。ひとつ手に取ると、残りは消える`); break; }
        if(best.it.vault){ const d=RUNE_DEF[ru.type], trs=trList(ru); h=lookLine(d.ch,runeCol(ru),thingLabel(ru)+'（宝物庫の宝）',d.desc+(trs.length?'。特性：'+trs.map(t=>`${trName(ru.type,t)} Lv${t.lv}`).join('・'):'')+'。'+(best.it.ev==='guard'?'周りの石像が、こちらを見ている気がする':'頭上の天井に、深いひびが走っている')); break; }
        const d=RUNE_DEF[ru.type], trs=trList(ru); h=lookLine(d.ch,runeCol(ru),thingLabel(ru),d.desc+(trs.length?'。特性：'+trs.map(t=>`${trName(ru.type,t)} Lv${t.lv}`).join('・'):'')+(best.it.grp?'。ひとつ手に取ると、残りは消える':'')); break; }
      case 'trap': { const inf=TRAP_INFO[best.tr.type], c=inf[1]; h=lookLine('^',[parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255],`${inf[0]}罠${best.tr.used?'（作動済み）':''}`,inf[2]); break; }
      case 'gate': { const pr=(D.items||[]).find(o=>o.vault&&!o.taken); h=lookLine('#',[0.75,0.72,0.8],'鉄格子','固く閉ざされている。どこかに開ける仕掛けがあるはずだ'+(pr?(pr.ev==='guard'?'。奥で、石像の目がかすかに光っている':'。奥の天井に、大きなひびが走っている'):'')); break; }
      case 'lever': h=lookLine('/',[1.0,0.85,0.5],'壁のレバー',D.gate.open?'もう引かれている':'古いレバー。触れれば、引けそうだ'); break;
      case 'web': h=lookLine('%',[0.85,0.8,1.0],'クモの巣','光る糸が張りめぐらされている。触れると、巣の主に伝わる'); break;
      case 'ph': h=lookLine('?',[0.7,0.8,1.0],'空気の揺らぎ','人の形をした何かが、見えないままそこにいる'); break;
      case 'm': { const m=best.m;
        if(m.hidden){ h=lookLine('?',[1.0,0.82,0.42],'浮遊する巻物','ゆっくりと宙に浮かんでいる……よく見ると、わずかに震えている'); break; }
        if(m.ty.critter){ h=lookLine(m.ty.ch,m.ty.col,`${m.ty.name}（${m.ty.ch}）`,m.flee>0?'驚いて逃げている':m.ty.verb); break; }
        if(m.hp<m.maxHp&&!m.ty.critter){ const st2=m.sleep?'眠っている':m.noticed?'こちらに気づいている':'こちらに気づいていない'; h=lookLine(m.ty.ch,m.ty.col,`${m.ty.name}（${m.ty.ch}）`,`${st2}　体力 ${Math.max(0,Math.ceil(m.hp))}/${m.maxHp}`); break; }
        if(m.ty.beast){ h=lookLine('X',m.ty.col,m.ty.name,m.sleep?`眠っている。${m.ty.lore}`:`こちらを見ている。${m.ty.lore}`); break; } const st=m.ty.peaceful?'穏やかにこちらを見ている':m.sleep?'眠っている':m.noticed?'こちらに気づいている':m.aware>0.35?'辺りを警戒している':'こちらに気づいていない'; h=lookLine(m.ty.ch,m.ty.col,`${m.ty.name}（${m.ty.ch}）`,`${st}`); break; }
      case 'f': {
        if(best.f.type==='relic'&&D.gate&&D.gate.heir&&Math.hypot(best.f.x-player.x,best.f.z-player.z)<30){ const rr=D.roomOf[Math.floor(best.f.z/CELL)*MW+Math.floor(best.f.x/CELL)]; if(rr>=0&&D.rooms[rr].kindMsg&&D.rooms[rr].kindMsg.includes('鉄格子の奥')){ h=lookLine('_',best.f.col,D.gate.heir,'台座の上で、静かに光っている。年代記に記された王のものだ'); break; } }
        if(best.f.type==='bstairs'){ h=lookLine('>',best.f.col,`${BRANCHES[D.bstairs.key].name}への階段`,'本道を外れて、脇道へと続く下り階段。'+BRANCH_OMEN[D.bstairs.key].look); break; }
        if(best.f.type==='portal'){ h=lookLine('0',best.f.col,'揺らめく門',`門の向こうに、${REALMS[D.portal.key].name}が揺らいで見える。`+REALM_OMEN[D.portal.key].look); break; }
        if(best.f.type==='stairs'&&stairsGuarded()){ h=lookLine('>',[1,0.55,0.6],'封じられた下り階段','見えない封が下りを阻んでいる。控えの間に潜むものを退ければ、解けるだろう'); break; }
        if(best.f.type==='stairs'){ const o=omenOf(), st=o&&o.stairs; if(st){ const look=st.kind==='branch'?(st.strong?'奥から、主の気配が濃く漂ってくる。':'')+BRANCH_OMEN[st.key].look:st.kind==='special'?SPECIAL_OMEN[st.key].look:STRATUM_OMEN[st.key].look; h=lookLine('>',best.f.col,'下り階段',look); break; } }
        const n=FIX_NAMES[best.f.type]; h=lookLine(n[0],best.f.col,n[1],n[2]); break; }
      case 'd': h=lookLine('+',[0.95,0.66,0.38],'木の扉','閉ざされている。近づけば開く'); break;
      case 'dg': h=lookLine(':',[0.45,0.38,0.34],'焼け落ちた扉の跡','黒く焦げた枠だけが残っている'); break;
      case 'wall': {
        if(best.prev>=0){ const ddx=(i%MW)-(best.prev%MW), ddz=((i/MW)|0)-((best.prev/MW)|0), fi=[[1,0],[-1,0],[0,1],[0,-1]].findIndex(d=>d[0]===ddx&&d[1]===ddz), eg=fi>=0&&D.engr.get(best.prev*4+fi);
          const eg2=eg&&eg.skip?D.engr.get(eg.mi*4+fi):eg; if(eg2){ h=lookLine('#',[1.0,0.86,0.6],'壁の彫刻',eg2.text); break; } }
        const fx=D.fixCell.get(i);
        if(fx){ h=lookLine('#',[1.0,0.72,0.32],'壁掛け松明','壁に据えられた松明が、琥珀色の光を投げかけている'); break; }
        const nearCave=D4.some(d=>{ const j=i+d[0]+d[1]*MW; const r2=j>=0&&j<NCELL?D.roomOf[j]:-1; return r2>=0&&D.rooms[r2].cave; })||cave;
        const ve=D.vein[i]; if(ve){ h=lookLine(ve===1?'$':'*',VEIN_COL[ve],`${VEIN_NAME[ve]}の鉱脈`,`${D.rock.name}の中を${VEIN_NAME[ve]}の鉱脈が走り、光を受けてきらめいている`); break; }
        h=nearCave?lookLine('%',[0.75,0.7,0.9],`${D.rock.name}の岩肌`,'光の届くところだけ、岩の筋が濃く浮かび上がる'):lookLine('#',[0.72,0.7,1.0],`${D.rock.name}の石壁`,'無数の紋様が刻み込まれた壁');
        break; }
      case 'gas': h=lookLine('~',[0.6,0.9,0.3],'沼のガス','鼻をつく臭気が低く漂っている。火気は禁物だ'); break;
      case 'xtal': { const xc=D.xtalCol.get(i)||[0.6,0.85,1.0]; h=lookLine('#',xc,'結晶','透き通った結晶が、内側から淡い光を放っている'); break; }
      case 'pillar': h=lookLine('0',[0.8,0.78,1.0],'石柱','縦に連なる石が天井を支えている'); break;
      case 'deco': { const dc=D.decoCell.get(i);
        if(dc&&dc.ch==='+'){ if(i%3===0){ const ru=HIST.rulers[i%HIST.rulers.length]; h=lookLine('+',dc.col,`${ru.title}${ru.name}の墓`,'R.I.P. の下に、王の名が刻まれている'); } else h=lookLine('+',dc.col,`${HIST.civ.name}の民の墓`,'名前は風化して、もう読めない'); break; }
        if(dc&&dc.k==='colossus'){ const ru=HIST.rulers[i%HIST.rulers.length]; h=lookLine('&',dc.col,`${ru.title}${ru.name}の巨像`,'その眼だけが、まだ光を宿している'); break; } const n=dc&&(dc.k&&DECO_K[dc.k]||DECO_NAMES[dc.ch]); if(n)h=lookLine(n[0],dc.col,n[1],n[2]); else h=lookLine('_',[1.0,0.82,0.42],'祭壇','石を積み上げた祭壇'); break; }
      case 'chasm': h=lookLine(':',[0.6,0.4,1.0],'裂け目','底知れぬ闇。遥か下で燃える火が見える'); break;
      case 'ceil': h=cave?lookLine('*',[0.7,0.65,1.0],'岩の天蓋','遥か頭上で、星のような光が瞬いている'):lookLine('*',[0.7,0.65,1.0],'天井','まばらな光が、星のように瞬いている'); break;
      case 'floor': {
        const lq=D.liquid[i], sf=D.surface[i], dc=D.decoCell.get(i);
        if(fire[i]>0.05)h=lookLine('^',[1.0,0.55,0.2],'炎','燃え移った炎が、隣の草へと広がっていく');
        else if(D.pit&&D.pit[i])h=lookLine(':',[1.0,0.55,0.3],'崩落した穴','遥か下に、次の階層の光が見える。飛び込めば落ちていける');
        else if(burnt[i]&&!D.liquid[i])h=lookLine(',',[0.6,0.55,0.55],'灰','燃え尽きた草の名残');
        else if(D.bridge[i]===1)h=lookLine('=',[0.75,0.55,0.35],'吊り橋','板の隙間から、足元の深淵が覗いている');
        else if(D.bridge[i]===2)h=lookLine('=',[0.7,0.7,0.85],'石橋','深い水の上に架けられた、古い石の道');
        else if(lq===LQ_DEEP)h=D.algae&&D.algae[i]?lookLine('~',[0.3,1.0,0.65],'光る藻','深い水の中で、藻がゆっくりと明滅している'):lookLine('~',[0.2,0.35,0.9],'深い水','暗い水底は見通せない。何かが潜んでいるかもしれない');
        else if(lq===LQ_BOG)h=lookLine('~',[0.55,0.6,0.25],'沼','泥の泡がはじけ、ガスが立ち昇っている');
        else if(lq===LQ_LAVA)h=lookLine('~',[1.0,0.45,0.12],'溶岩','灼熱の岩がゆっくりと流れ、空気が揺らいでいる');
        else if(lq===LQ_WATER)h=lookLine('~',[0.35,0.68,1.0],'浅い水','波紋が静かに揺れている');
        else if(dc&&dc.k&&DECO_K[dc.k])h=lookLine(DECO_K[dc.k][0],dc.col,DECO_K[dc.k][1],DECO_K[dc.k][2]);
        else if(D.darkMul[i]<0.4)h=lookLine('.',[0.4,0.4,0.55],'暗がり','光を呑み込むような、不自然な闇');
        else if(dc&&DECO_NAMES[dc.ch])h=lookLine(DECO_NAMES[dc.ch][0],dc.col,DECO_NAMES[dc.ch][1],DECO_NAMES[dc.ch][2]);
        else if(sf===SF_OBSIDIAN)h=lookLine(',',[0.9,0.4,0.3],'黒曜石','冷え固まった溶岩。ひび割れから赤い光が漏れている');
        else if(sf===SF_LUMEN)h=lookLine('"',[0.4,0.95,0.85],'発光する苔','淡い燐光を放っている');
        else if(sf===SF_ICE)h=D.thin[i]?lookLine('/',[0.6,0.8,1.0],'薄い氷','ひびが走っている。下には深い水が眠っている'):lookLine('=',[0.7,0.9,1.0],'氷','凍りついた水面。よく滑る');
        else if(sf===SF_RUBBLE)h=lookLine(',',[0.75,0.62,0.5],'瓦礫','崩れ落ちた壁と天井の欠片');
        else if(sf===SF_DEAD)h=lookLine('"',[0.6,0.5,0.3],'枯れ草','湿った沼の縁で朽ちかけている');
        else if(D.glyph&&D.glyph[i])h=lookLine('*',[1.0,0.9,0.6],'聖なる紋様','獣たちは、この紋様を越えようとしない');
        else if(sf===SF_FOLIAGE)h=cellFlag[i]===20?lookLine(',',[0.3,0.6,0.3],'踏み分けられた茂み','しばらくすると、また伸びてくる'):lookLine('"',[0.4,0.9,0.4],'背の高い茂み','視線を遮る。踏み込むと倒れて、しばらくすると元に戻る');
        else if(sf===SF_FUNGFOR)h=cellFlag[i]===20?lookLine(',',[0.4,0.6,0.7],'踏み分けられた茸の森','倒れた茸が、まだ淡く光っている'):lookLine('"',[0.5,0.9,1.0],'茸の森','背の高い光る茸が林立し、視線を遮っている');
        else if(sf===SF_BRIM)h=lookLine('*',[1.0,0.82,0.3],'硫黄','踏むと燃え上がる。燃えた後は、しばらくすると元に戻る');
        else if(sf===SF_MUD)h=lookLine('~',[0.6,0.42,0.25],'泥','足を取られて、歩みが遅くなる');
        else if(sf===SF_HAY)h=lookLine('"',[0.95,0.8,0.4],'干し草','乾いていて、よく燃える');
        else if(sf===SF_GRASS)h=lookLine('"',[0.35,0.85,0.5],'苔草','湿った床にまばらに生えている');
        else h=cave?lookLine(':',[0.7,0.68,0.85],'砂利の床','砕けた岩が散らばっている'):lookLine('.',[0.7,0.7,0.9],'石の床','細かな石が敷き詰められている');
        break; }
    }
  }
  // only describe what the player keeps looking at
  if(h!==lookPend){ lookPend=h; lookPendT=time; }
  const show=time-lookPendT>0.5?h:'';
  if(show!==lookHTML){ lookHTML=show; lookEl.innerHTML=show; }
}

// ---------------------------------------------------------------- sizing
function applySize(){
  frame.stillDrawn=false;
  const w=window.innerWidth, h=window.innerHeight;
  renderer.setPixelRatio(pixelRatio); renderer.setSize(w,h,false);
  composer.setPixelRatio(pixelRatio); composer.setSize(w,h);
  camera.aspect=w/h; camera.updateProjectionMatrix();
  U.uScale.value=(h*pixelRatio)/(2*Math.tan(camera.fov*Math.PI/360));
  finalPass.uniforms.uRes.value.set(w*pixelRatio,h*pixelRatio);
}
window.addEventListener('resize',()=>{ applySize(); sizeMap(); });

// ---------------------------------------------------------------- main loop
let last=0, time=0, fovT=0, mapT=0, perfT=0, perfAcc=0, perfN=0, warm=0;
function frame(nowMs){
  requestAnimationFrame(frame);
  if(TEST){ if(TESTQ.n>0){ TESTQ.n--; testTick(true); if(!TESTQ.n&&TESTQ.done){ const d=TESTQ.done; TESTQ.done=null; d(); } } return; }
  const now=nowMs/1000; let raw=last?now-last:0.016; last=now;
  tick(raw,true);
}
const TESTQ={n:0,done:null};
function testTick(draw){ TESTCLK.advance(TEST_STEP*1000); tick(TEST_STEP,draw); }
function tick(raw,draw){
  if(isPaused()&&started){ if(frame.stillDrawn)return; frame.stillDrawn=true; } else frame.stillDrawn=false; const dt=isPaused()?0:clamp(raw,0,0.05)*timeScale();
  time+=dt; const t=time;
  U.uTime.value=t;
  if(trans){
    trans.t+=dt;
    if(trans.phase==='out'){ fade=1-trans.t/0.8; if(trans.t>=0.8){ if(trans.regen)runSeed=(Math.random()*1e9)>>>0; else advance(trans.go); newLevel(); trans={phase:'in',t:0}; fade=0; } }
    else { fade=trans.t/1.3; if(trans.t>=1.3){ trans=null; fade=1; } }
  } else fade=Math.min(1,fade+dt*0.8);
  updatePlayer(dt);
  updateStealth(dt);
  updateStatuses(dt);
  for(const m of monsters)if(!m.galShow&&!m.ty.dummy)updateMonster(m,dt*monTimeK(m),t);
  if(monsters.some(m=>m.dead))monsters=monsters.filter(m=>!m.dead);
  pfFrames++; pfT+=raw; if(pfT>=0.5){ pfFps=Math.round(pfFrames/pfT); pfFrames=0; pfT=0; if(perfOn)renderStatus(); }
  regrow(); brimRecover(dt); if(!dead){ updateTraps(dt); updateSearch(dt); } updateLife(dt);
  updateLights(t);
  updateAtmosphere(dt);
  dn=0; drawFixtures(t,dt); drawDoors(t,dt); drawFire(t,dt); drawWebs(t); drawTraps(t); drawSwing(); drawViewWeapons(t); drawOmens(t,dt); drawRunesWorld(t); updateAltarPanel(); drawArrows(); drawLegendWorld(t); drawBoltFx(t,dt); drawGallery(t); drawFrozen(t); drawCastFx(t); if(camMode==='tps'&&D&&!gallery){ updateAvatar(dt); drawMonster0(avatar,t); drawSection(); } for(const m of monsters)drawMonster(m,t); flushDyn();
  updateParticles(dt,t);
  fovT+=dt; if(fovT>0.1){ fovT=0; computeFOV(); checkEvents(false); look(); stepGas(); stepFire(); }
  mapT+=dt; if(mapT>0.11){ mapT=0; if(uiMode===0)drawMap(); }
  if(helpT>0){ helpT-=dt; if(helpT<=0&&helpOn)setHelp(false); }
  finalPass.uniforms.uTime.value=t; finalPass.uniforms.uFade.value=clamp(fade,0,1); finalPass.uniforms.uHurt.value=hurtFlash+(player.hp<PLAYER_MAX*0.25&&!dead?0.18+0.08*Math.sin(t*4):0);
  if(started&&!trans&&!dead&&!isPaused())pickupItems();
  if(hands)updateCast(dt);
  updateFinal(dt); updateGallery(dt); trackSeen(dt); updateFrozen(dt); cloudsMeetFire();
  updateCross(raw);
  updateProjs(dt);
  sndUpdate(dt); updateEvents(dt,t);
  cullChunks();
  if(draw)composer.render(dt);
  if(TEST)return; // keep the resolution fixed in tests
  warm+=raw; if(warm>3&&!document.hidden){ perfAcc+=raw; perfN++; perfT+=raw;
    if(perfT>2.5){ const avg=perfAcc/perfN; if(avg>1/48&&pixelRatio>0.75){ pixelRatio=Math.max(0.75,pixelRatio-0.2); applySize(); } perfT=perfAcc=perfN=0; } }
}

// ---------------------------------------------------------------- test hooks (only with ?test=1; see the test mode block at the top)
let testBoot=false;
if(TEST)window.__test={
  step:TEST_STEP,
  ready(){ return testBoot===true&&!!D; },
  error(){ return typeof testBoot==='string'?testBoot:null; },
  // step the game without drawing (fast); returns the game time
  advance(sec){ const n=Math.max(0,Math.round(sec/TEST_STEP)); for(let i=0;i<n;i++)testTick(false); return +time.toFixed(4); },
  // step and draw n frames (one per animation frame)
  frames(n){ return new Promise(ok=>{ TESTQ.n=Math.max(0,n|0); if(!TESTQ.n)ok(); else TESTQ.done=ok; }); },
  // a plain copy of what matters, to compare runs
  state(){ const f=v=>+(+v||0).toFixed(3);
    return {time:f(time),seed:runSeed,place:placeLabel(),depth,started,dead,hp:f(player.hp),pos:[f(player.x),f(player.z)],yaw:f(player.yaw),lvl:lvl.n,
      monsters:monsters.map(m=>[m.key,f(m.x),f(m.z),f(m.hp),m.sleep?1:0]),projs:projs.length}; },
  // every place a run can visit, for generation checks
  places(){ return [...Array.from({length:FINAL_DEPTH},(_,i)=>({depth:i+1})), ...Object.keys(SPECIALS).map(k=>({inter:k})),
    ...Object.values(BRANCHES).flatMap(B=>Array.from({length:B.len},(_,i)=>({branch:B.key,lvl:i+1}))), ...Object.values(REALMS).map(R=>({realm:R.key,depth:R.minD+2}))]; },
  // generate one level only (no meshes); breaks the drawn world, so use it on a page of its own
  gen(seed,pl){ const keep={runSeed,depth,branch,realm,inter};
    try{ runSeed=seed>>>0; branch=null; realm=null; inter=null;
      if(pl.branch){ const B=BRANCHES[pl.branch]; depth=B.at[0]; branch={key:B.key,lvl:pl.lvl||1,len:B.len,ret:depth+1}; }
      else if(pl.inter){ depth=interAt(pl.inter); inter={key:pl.inter,after:depth}; }
      else if(pl.realm){ depth=pl.depth||4; realm={key:pl.realm,ret:depth+1}; }
      else depth=pl.depth;
      const L=generate(levelSeed(),depth); L.place=placeLabel(); L.final=depth===FINAL_DEPTH&&!branch&&!realm&&!inter; return L; }
    finally{ ({runSeed,depth,branch,realm,inter}=keep); } },
};

// ---------------------------------------------------------------- init
async function init(){
  try{ if(document.fonts&&document.fonts.load)await Promise.race([Promise.all([document.fonts.load('800 96px "JetBrains Mono"'),document.fonts.load('500 96px "Noto Sans Runic"','ᚦᛏᛜᛞᚲᛁᛊᚾᚱᚺ')]),new Promise(r=>setTimeout(r,2500))]); }catch(e){}
  U.uAtlas.value=buildAtlas();
  staticMat=new T.ShaderMaterial({uniforms:{uAtlas:U.uAtlas,uTime:U.uTime,uSL:U.uSL,uDLP:U.uDLP,uDLC:U.uDLC,uFogDen:U.uFogDen,uFogColor:U.uFogColor,uRamp:U.uRamp,uAmb:U.uAmb,uCell:U.uCell,uCollT:U.uCollT,uCamP:U.uCamP,uCutP:U.uCutP,uCut:U.uCut},
    vertexShader:STATIC_VS,fragmentShader:GLYPH_FS,side:T.DoubleSide,alphaToCoverage:true});
  dynMat=new T.ShaderMaterial({uniforms:{uAtlas:U.uAtlas,uFogDen:U.uFogDen,uFogColor:U.uFogColor},vertexShader:DYN_VS,fragmentShader:GLYPH_FS,side:T.DoubleSide,alphaToCoverage:true});
  ptMat=new T.ShaderMaterial({uniforms:{uAtlas:U.uAtlas,uScale:U.uScale,uFogDen:U.uFogDen},vertexShader:PT_VS,fragmentShader:PT_FS,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  occMat=new T.ShaderMaterial({uniforms:{uCamP:U.uCamP,uCutP:U.uCutP,uCut:U.uCut},colorWrite:false,side:T.DoubleSide,
    vertexShader:`varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader:`uniform vec3 uCamP; uniform vec3 uCutP; uniform float uCut; varying vec3 vW;
      void main(){ if(uCut>0.5){ vec3 seg=uCutP-uCamP; float L2=max(dot(seg,seg),1e-4); float tc=clamp(dot(vW-uCamP,seg)/L2,0.0,1.0); if(tc<0.97&&length(vW-(uCamP+seg*tc))<mix(2.6,0.9,tc)+0.15) discard; } gl_FragColor=vec4(0.0); }`});
  makeWater();
  const dynMesh=new T.Mesh(dynGeo,dynMat); dynMesh.frustumCulled=false; dynMesh.renderOrder=1; scene.add(dynMesh);
  const pts=new T.Points(ptGeo,ptMat); pts.frustumCulled=false; pts.renderOrder=5; scene.add(pts);
  applySize();
  newLevel();
  requestAnimationFrame(frame);
}
if(TEST)init().then(()=>{ dbgUrl(); testBoot=true; }).catch(e=>{ console.error(e); testBoot='error: '+e; });
else { init(); setTimeout(()=>{ try{ dbgUrl(); }catch(e){ console.error(e); } },400); }
})();
