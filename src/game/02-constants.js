// ---------------------------------------------------------------- constants
// CELL・BASE_H・EYE など 40 個は src/lib/world.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）
// css は src/lib/color.ts（src/game/imports.mjs で読む）
// topLights は src/lib/light.ts（src/game/imports.mjs で読む）
// computeVis は src/lib/light.ts（古い JS は使わない。src/lib/ の生成などが使う）
// RUNE_CHARS・G は src/lib/glyphs.ts（src/game/imports.mjs で読む）
// mr・mpick・rand・R・RI・pick は src/lib/random.ts（迷宮の乱数の入れ替えは setRand。src/game/imports.mjs で読む）
// mulberry32・clamp は src/lib/rng.ts（src/game/imports.mjs で読む）
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

// THEMES・RUIN_THEMES・BIOMES など 14 個は src/lib/strata.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）
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
// special levels (after NetHack's special levels and Dwarf Fortress's abandoned fortresses): one-off landmarks, placed per run seed
// special levels come between depths (they no longer take a depth's place): the town after the stone labyrinth, the great hall within the great cavern,
// the oracle before the ruins, the abandoned fortress within the lava sea
let inter=null, showroomGen=false;
function interAt(key){ const h=Math.imul(runSeed^0x5bd1e995,2654435761)>>>0; return {town:2, bigroom:3+(h&1), oracle:5, fortress:9+((h>>2)&1)}[key]; }
function interAfter(d){ for(const k in SPECIALS)if(interAt(k)===d)return k; return null; }
let branch=null, realm=null;
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


