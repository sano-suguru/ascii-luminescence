// ---------------------------------------------------------------- constants
// CELL・BASE_H・EYE など 40 個は src/lib/world.ts（古い JS が読むのは、そのうち src/game/imports.mjs にある物）
// css は src/lib/color.ts（src/game/imports.mjs で読む）
// topLights は src/lib/light.ts（src/game/imports.mjs で読む）
// computeVis は src/lib/light.ts（古い JS は使わない。src/lib/ の生成などが使う）
// RUNE_CHARS・G は src/lib/glyphs.ts（src/game/imports.mjs で読む）
// mr・mpick・rand・R・RI・pick は src/lib/random.ts（迷宮の乱数の入れ替えは setRand。src/game/imports.mjs で読む）
// mulberry32・clamp は src/lib/rng.ts（src/game/imports.mjs で読む）
// RUNESET・SWAPSET・WG・RAMP_CH は src/lib/glyphs.ts（src/game/imports.mjs で読む）
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
// MTYPES は src/lib/creatures.ts（src/game/imports.mjs で読む）
// special levels (after NetHack's special levels and Dwarf Fortress's abandoned fortresses): one-off landmarks, placed per run seed
// special levels come between depths (they no longer take a depth's place): the town after the stone labyrinth, the great hall within the great cavern,
// the oracle before the ruins, the abandoned fortress within the lava sea
function interAt(key){ const h=Math.imul(adv.runSeed^0x5bd1e995,2654435761)>>>0; return {town:2, bigroom:3+(h&1), oracle:5, fortress:9+((h>>2)&1)}[key]; }
function interAfter(d){ for(const k in SPECIALS)if(interAt(k)===d)return k; return null; }
let lockCell=-1; // placeMem は src/lib/state.ts（src/game/imports.mjs で読む）
const placeKey=()=>`${adv.runSeed}:`+(here.realm?`r:${here.realm.key}:${here.realm.ret}`:here.branch?`b:${here.branch.key}:${here.branch.lvl}`:here.inter?`i:${here.inter.key}`:`m:${here.depth}`);
function advance(go){
  if(here.D&&here.explored)placeMem.set(placeKey(),{explored:here.explored.slice(),mem:here.mem.slice()});
  here.arrive=null;
  if(go==='up'){
    if(here.inter){ here.inter=null; here.arrive='stairs'; return; }
    if(here.realm){ here.depth=here.realm.ret-1; here.realm=null; here.arrive='portal'; return; }
    if(here.branch){ if(here.branch.lvl>1){ here.branch.lvl--; here.arrive='stairs'; return; } here.depth=here.branch.ret-1; here.branch=null; here.arrive='bstairs'; return; }
    return;
  }
  if(go==='branch'&&here.D.bstairs){ const B=BRANCHES[here.D.bstairs.key]; here.branch={key:B.key,lvl:1,len:B.len,ret:here.depth+1}; return; }
  if(go==='realm'&&here.D.portal){ here.realm={key:here.D.portal.key,ret:here.depth+1}; return; }
  if(here.inter){ here.depth=here.inter.after+1; here.inter=null; return; }
  if(here.realm){ here.depth=here.realm.ret; here.realm=null; return; }
  if(here.branch){ if(here.branch.lvl<here.branch.len){ here.branch.lvl++; return; } here.depth=here.branch.ret; here.branch=null; return; }
  if(here.depth>=FINAL_DEPTH||(here.depth===FINAL_DEPTH-1&&!legendAll())){ advance.bounced=true; return; }
  { const ik=interAfter(here.depth); if(ik){ here.inter={key:ik,after:here.depth}; return; } }
  here.depth++;
}
function placeLabel(){ if(here.inter)return SPECIALS[here.inter.key].name; if(here.realm)return REALMS[here.realm.key].name; if(here.branch)return `${BRANCHES[here.branch.key].name} ${here.branch.lvl}/${here.branch.len}`; return String(here.depth); }


