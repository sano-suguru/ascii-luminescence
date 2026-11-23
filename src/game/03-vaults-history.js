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
