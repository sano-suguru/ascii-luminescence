// 名前と説明の表（もとは src/game/02・12・18・24・25・28・29）：見た時の説明、罠・伝説の物・主の名前、試しの間の的、部屋の仕掛けの伝言。
import { type Color, cssOf } from './color.ts';

/** 見た時の説明の1行（文字 ch を色 col で、名前 name と説明 desc。色は3つの数。無い・足りない時は止まる。文字・名前・説明が無い時は undefined と書く） */
export const lookLine = (
  ch: string | undefined,
  col: readonly number[] | undefined,
  name: string | undefined,
  desc: string | undefined,
): string => `<b style="color:${cssOf(col)}">${ch}</b>${name}<span>${desc}</span>`;
/** 生き物の名前（色付き、文字を添えて） */
export const mname = (m: { ty: { col: readonly number[]; name: string; ch: string } }): string =>
  `<span style="color:${cssOf(m.ty.col)}">${m.ty.name}（${m.ty.ch}）</span>`;
/** 備品の、見た時の説明（[文字, 名前, 説明]） */
export const FIX_NAMES: Readonly<Record<string, readonly [string, string, string]>> = {
  brazier: ['*', '火鉢', '炎が揺れ、壁に火影を落としている'],
  crystal: ['*', '浮遊する水晶', 'ゆっくり回転しながら、脈打つ光を放っている'],
  rune: ['0', '魔法陣', '刻まれた紋様が絶えず入れ替わりながら回っている'],
  lamp: ['*', '吊り灯', '鎖に吊られた小さな灯が揺れている'],
  fungus: ['"', '発光する茸', '胞子を漂わせながら燐光を放っている'],
  abyss: ['^', '深淵の灯', '裂け目の底で燃え続ける光'],
  stairs: ['>', '下り階段', '光の螺旋が、さらに深い階層へと続いている'],
  embers: ['*', '焚き火の残り火', '熾火がまだかすかに赤く光っている'],
  upstairs: ['<', '上り階段', '来た道へと引き返す階段'],
  tele: ['*', '転移の魔法陣', '踏み込めば、対になった魔法陣へと運ばれる'],
  fall: ['|', '滝', '天井の裂け目から、光る水が絶え間なく流れ落ちている'],
  crater: ['^', '溶岩の火口', '床の裂け目の奥で、溶岩が脈打っている'],
  spring: ['~', '壁の亀裂', '亀裂の奥から、水の流れる音がする'],
  relic: ['?', '浮遊する巻物', '祭壇の上で静かに回転している'],
  orb: ['o', '古の灯', '台座の上で、今も変わらず光り続けている球体'],
  well: ['*', '光井戸', '崩れた天井の穴から、青白い光が降り注いでいる'],
  firefly: ['.', '光の粒の群れ', '蛍のような光の粒が、ゆっくりと漂っている'],
  sun: ['*', '差し込む光', '天井の裂け目から、遥か地上の光が差し込んでいる'],
  bloodwort: ['*', 'ブラッドワート', '赤く熟した実が、脈打つように光っている'],
  vent: ['o', '蒸気の噴出口', '地の底から、時折熱い蒸気が噴き上がる'],
  marsh: ['*', '鬼火', '沼の上をさまよう、青白い炎'],
  torch: ['#', '壁掛け松明', '壁に据えられた松明が、琥珀色の光を投げかけている'],
};
/** 床の飾りの、見た時の説明（飾りの文字ごと。[文字, 名前, 説明]） */
export const DECO_NAMES: Readonly<Record<string, readonly [string, string, string]>> = {
  '&': ['&', '彫像', '石を刻んだ人影が、部屋の中央を見つめている'],
  '+': ['+', '墓石', 'R.I.P. と刻まれている'],
  '=': ['=', '朽ちた寝袋', '誰かがここで眠った跡'],
  '%': ['%', '散らばった骨', '先客の末路を物語っている'],
  '[': ['[', '書架', '読めない文字の背表紙がぎっしりと並んでいる'],
};
/** 部屋の飾りの、見た時の説明（飾りの種類ごと。[文字, 名前, 説明]） */
export const DECO_K: Readonly<Record<string, readonly [string, string, string]>> = {
  table: ['=', '石の食卓', '埃をかぶった皿と杯が、並んだままになっている'],
  anvil: ['T', '金床', '冷えきった鉄の塊。無数の槌の跡が残る'],
  colossus: ['&', '巨像', '石を刻んだ巨大な像。その眼だけが、まだ光を宿している'],
  carpet: ['.', '古い絨毯', '色褪せた文様が、灰の中でかろうじて残っている'],
  blood: ['~', '血だまり', '乾ききらない、暗い赤'],
};
/** 隠れた罠の名前・色・説明（[名前, 色, 説明]） */
export const TRAP_INFO: Readonly<Record<string, readonly [string, string, string]>> = {
  alarm: ['警報の', '#ff6a4a', '踏むと鐘が鳴り響き、辺りの獣が集まってくる'],
  trapdoor: ['落とし戸の', '#c9b8ff', '踏むと床が抜け、下の階へ落ちる'],
  net: ['網の', '#d8c8ff', '踏むと網が降ってきて、しばらく動けなくなる'],
  flood: ['水の', '#6ab4ff', '踏むと水があふれ出し、辺りが水浸しになる'],
  methane: ['ガスの', '#a8e05a', '踏むと沼のガスが噴き出す。火気は厳禁'],
};
/** 伝説の物（名前・文字・色）と、その並び */
export const LEGEND_KINDS: Record<string, { name: string; ch: string; col: Color }> = {
  candle: { name: '燭台', ch: 'i', col: [1.0, 0.78, 0.42] },
  bell: { name: '鐘', ch: 'A', col: [0.98, 0.9, 0.55] },
  mirror: { name: '鏡', ch: 'O', col: [0.72, 0.9, 1.0] },
};
export const LEGEND_ORDER = ['candle', 'bell', 'mirror'];
/** 支道ごとの、伝説の物がある所の言い方 */
export const BRANCH_HINT = {
  crypt: '死者の眠る回廊の奥',
  lair: '獣の匂う洞窟の奥',
  sunken: '水に沈んだ神殿の底',
  nest: '糸の張りめぐらされた闇の奥',
  snake: '這うものたちの水場の奥',
};
/** 図鑑で眠っている間の説明（生き物の表の鍵ごと）。図鑑で寝起きをくり返す竜だけ。起きている間は生き物の表の verb */
export const GALLERY_SLEEP: Record<string, string> = {
  D: '翼を畳んで眠っている。寝息のたびに、周りの灯りが揺れる',
};
/** 図鑑の主（支道ごと。元の生き物 base・名前・大きさ・説明） */
export const LORD_GAL = {
  crypt: { base: 'L', name: '不死の王', scale: 1.7, verb: '王冠だけが、まだ光を失っていない亡霊' },
  lair: { base: 'D', name: '年老いた竜', scale: 3.6, verb: '巣の最奥で、とぐろを巻いて眠っている' },
  sunken: { base: 'K', name: '深みの主', scale: 3.6, verb: '沈んだ神殿の底から、無数の触手を伸ばしている' },
  nest: { base: 'S', name: '蜘蛛の女王', scale: 2.0, verb: '巣の中心で、光る糸を紡ぎ続けている' },
  snake: { base: 'N', name: 'ナーガの女王', scale: 2.6, verb: '水場のほとりで、冠のような鱗を光らせている' },
};
/** 試しの間の、起き上がる的 */
export const DUMMY_KINDS = [
  { k: 'dummy', name: '的の人形', col: [0.78, 0.74, 0.66] },
  { k: 'dummyF', name: '的の人形（火に強い）', col: [1.0, 0.55, 0.3] },
  { k: 'dummyP', name: '的の人形（毒が効かない）', col: [0.62, 0.85, 1.0] },
  { k: 'dummyT', name: '的の人形（濡れている）', col: [0.5, 0.7, 1.0] },
];
/** 部屋の仕掛け（野営の跡・祭壇・書庫・墓所など）の、文字と色と、初めて入った時の伝言（もとは src/game/02-constants.js） */
export const MACHINE_INFO: Record<string, { ch: string; col: Color; msg: string }> = {
  camp: { ch: '%', col: [0.95, 0.85, 0.7], msg: '焚き火の跡と朽ちた寝袋。散らばった骨が、先客の末路を物語っている。' },
  altar: { ch: '_', col: [1.0, 0.82, 0.42], msg: '石の祭壇の上に、一枚の巻物 ? が静かに浮かんでいる。' },
  library: { ch: '[', col: [0.75, 0.6, 1.0], msg: '崩れかけた書架。読めない文字の頁が、宙をゆっくりと舞っている。' },
  crypt: { ch: '+', col: [0.55, 0.75, 1.0], msg: 'R.I.P. と刻まれた墓石が並ぶ墓所。冷たい霧が足元を這っている。' },
  idyll: { ch: '~', col: [0.5, 0.9, 1.0], msg: '小さな泉を草が囲む、穏やかな一角。天井の裂け目から、地上の光が差し込んでいる。' },
  remnant: { ch: '.', col: [0.95, 0.4, 0.35], msg: '焼け焦げた灰に囲まれて、古い絨毯だけが色を留めている。' },
  dismal: { ch: '%', col: [0.85, 0.25, 0.25], msg: '血と骨と炭が散らばる、陰惨な部屋。何があったのかは考えたくない。' },
  bloodwort: { ch: '*', col: [1.0, 0.3, 0.35], msg: '壁際で、赤く熟したブラッドワートの実が脈打つように光っている。' },
  flood: { ch: '~', col: [0.45, 0.75, 1.0], msg: '壁の亀裂から、水の滴る音がする。' },
  lavaflow: { ch: '^', col: [1.0, 0.45, 0.15], msg: '床の裂け目が赤く脈打っている。足元から熱が這い上がってくる。' },
  collapse: { ch: ':', col: [1.0, 0.6, 0.3], msg: '床に走る無数のひび割れから、下の階層のかすかな光が漏れている。' },
  statues: { ch: '&', col: [0.8, 0.8, 0.95], msg: '石を刻んだ彫像たちが、部屋の中央を見つめている。' },
};
