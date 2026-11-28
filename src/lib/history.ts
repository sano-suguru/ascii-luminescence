// 迷宮の歴史（年代記）を作る。
// シードだけで決まる。乱数を引く順番を変えると、同じシードでも違う歴史になるので、順番を変えないこと（tests/unit/history.test.ts）。
import { mulberry32 } from './rng.ts';

export type Art =
  | 'tower'
  | 'star'
  | 'hammer'
  | 'lantern'
  | 'bridge'
  | 'fountain'
  | 'wave'
  | 'tree'
  | 'swords'
  | 'serpent'
  | 'crown'
  | 'skull'
  | 'eye'
  | 'moon';
export interface Ruler {
  title: string;
  name: string;
}
export interface HistoryEvent {
  art: Art;
  text: string;
  /** rulers の何番目の王の出来事か */
  ruler: number;
}
export interface History {
  civ: { name: string; ep: string };
  foe: string;
  beast: string;
  beastSpec: { name: string; feat: string; kind: string };
  rulers: Ruler[];
  events: HistoryEvent[];
  crowns: HistoryEvent[];
}

const SY = [
  'ア',
  'カ',
  'サ',
  'タ',
  'ナ',
  'ハ',
  'マ',
  'ラ',
  'ザ',
  'ル',
  'ネ',
  'ケ',
  'セ',
  'オ',
  'ヴァ',
  'イ',
  'エ',
  'ク',
  'シ',
  'ト',
  'ミ',
  'ヤ',
  'ゼ',
  'ド',
  'グ',
  'ベ',
  'ラン',
  'ヌ',
  'ホ',
  'ジ',
];
const ORD = ['一', '二', '三', '四', '五', '六', '七'];
type EventKey =
  | 'found'
  | 'discover'
  | 'forge'
  | 'festival'
  | 'migrate'
  | 'bridge'
  | 'oracle'
  | 'flood'
  | 'grove'
  | 'war'
  | 'beast'
  | 'betray'
  | 'plague'
  | 'fall'
  | 'abyss'
  | 'starfall'
  | 'sleep';
const GROW: readonly EventKey[] = ['discover', 'forge', 'festival', 'migrate'],
  MID: readonly EventKey[] = ['bridge', 'oracle', 'flood', 'grove', 'discover'],
  CONF: readonly EventKey[] = ['war', 'beast', 'betray', 'plague'],
  END: readonly EventKey[] = ['fall', 'abyss', 'starfall', 'sleep'];

// 配列の i 番目。範囲の外なら止める（作り方の誤りなので、黙って undefined にしない）
function at<T>(a: readonly T[], i: number): T {
  const v = a[i];
  if (v === undefined) throw new RangeError(`範囲の外：${i}（長さ ${a.length}）`);
  return v;
}

export function makeHistory(seed: number): History {
  const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0),
    pk = <T>(a: readonly T[]): T => at(a, Math.floor(rnd() * a.length));
  const nm = (a: number, b: number): string => {
    let s = '';
    const n = a + Math.floor(rnd() * (b - a + 1));
    for (let k = 0; k < n; k++) s += pk(SY);
    if (rnd() < 0.3) s += pk(['ン', 'ル', 'ス', 'ト']);
    return s;
  };
  const civ = {
    name: nm(2, 3),
    ep: pk(['光を編む民', '石を歌う民', '星を数える民', '水底に祈る民', '灰を纏う民', '碑文を刻む民', '茸を育てる民', '鐘を鳴らす民']),
  };
  const foe = nm(2, 3) + 'の民',
    beastSpec = {
      name: nm(2, 3),
      feat: pk(['六本脚の', '千の眼を持つ', '燃える鱗の', '翼なき', '影を喰らう', '歌う']),
      kind: pk(['獣', '大蛇', '蛾', '竜', '百足']),
    },
    beast = beastSpec.name + '、' + beastSpec.feat + beastSpec.kind;
  const N = 5 + Math.floor(rnd() * 3);
  const rulers: Ruler[] = ORD.slice(0, N).map((o) => ({ title: `第${o}の王`, name: nm(2, 3) }));
  const EV: Record<EventKey, (R: string) => { art: Art; text: string }> = {
    found: (R) => ({ art: 'tower', text: `${R}は、石の迷宮の上に${civ.name}の最初の都を築いた。` }),
    discover: (R) => ({ art: 'star', text: `${R}の民は大洞窟を見いだし、その天井に星を見た。` }),
    forge: (R) => ({ art: 'hammer', text: `ドワーフたちは${R}のために、溶岩の熱で千の剣を鍛えた。` }),
    festival: (R) => ({ art: 'lantern', text: `${R}の治世、民は百日のあいだ灯りの祭りを続けた。` }),
    migrate: (R) => ({ art: 'tower', text: `${R}は民を率いて、さらに深い層へと移り住んだ。` }),
    bridge: (R) => ({ art: 'bridge', text: `${R}は、燃える海に黒い石の橋を架けた。` }),
    oracle: (R) => ({ art: 'fountain', text: `${R}は泉のほとりで神託を受け、都の名を改めた。` }),
    flood: (R) => ({ art: 'wave', text: `${R}の時代、地底の川があふれ、下の都が水に沈んだ。` }),
    grove: (R) => ({ art: 'tree', text: `${R}は茸の巨木を植え、その森を聖域とした。` }),
    war: (R) => ({ art: 'swords', text: `${R}は${foe}との戦いに勝ち、敵の王冠を深淵に投げ入れた。` }),
    beast: (R) => ({ art: 'serpent', text: `${R}の治世、${beast}が地の底より現れ、三つの都を呑んだ。` }),
    betray: (R) => ({ art: 'crown', text: `${R}は弟に裏切られ、王冠を奪われた。` }),
    plague: (R) => ({ art: 'skull', text: `${R}の治世、灰色の病が都を覆い、灯りがひとつずつ消えていった。` }),
    fall: (R) => ({ art: 'skull', text: `${R}は光を失い、${civ.name}の民は散り散りになった。` }),
    abyss: (R) => ({ art: 'eye', text: `${R}は深淵を覗き込み、二度と戻らなかった。` }),
    starfall: (R) => ({ art: 'star', text: `${R}の最期の夜、天井の星がすべて地に落ちた。` }),
    sleep: (R) => ({ art: 'moon', text: `${R}は眠りについた。いつか目覚めると言い残して。` }),
  };
  const plan: readonly (readonly EventKey[])[] =
    N === 5
      ? [['found'], GROW, MID, CONF, END]
      : N === 6
        ? [['found'], GROW, MID, CONF, CONF, END]
        : [['found'], GROW, GROW, MID, CONF, CONF, END];
  const used = new Set<EventKey>();
  const events: HistoryEvent[] = rulers.map((r, k) => {
    // 同じ出来事が重ならないように、8回まで引き直す（どれも使われていたら、最後に引いたものにする）
    const keys = at(plan, k);
    let key = pk(keys);
    for (let t = 1; t < 8 && used.has(key); t++) key = pk(keys);
    used.add(key);
    return { ...EV[key](`${r.title}${r.name}`), ruler: k };
  });
  const crowns: HistoryEvent[] = rulers.map((r, k) => ({ art: 'crown', ruler: k, text: `${r.title}${r.name}の戴冠を描いた彫刻。` }));
  return { civ, foe, beast, beastSpec, rulers, events, crowns };
}
