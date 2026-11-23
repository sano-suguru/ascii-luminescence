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
// mulberry32・clamp は src/lib/rng.ts（src/game/imports.mjs で読む）
const R=(a,b)=>a+rand()*(b-a);
const RI=(a,b)=>Math.floor(a+rand()*(b-a+1));
const pick=a=>a[Math.floor(rand()*a.length)];
const mpick=a=>a[Math.floor(mr()*a.length)];
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

