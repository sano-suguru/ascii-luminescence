// 洞窟の形と宝物庫の絵（もとは src/game/03-vaults-history.js）。迷宮の乱数（rand）を使う。
import { nth } from './array.ts';
import { rand } from './random.ts';
import { D4 } from './world.ts';

/** 洞窟の形（w × h。1 が床）。つながった広い形になるまで、何度か作り直す */
export function makeCave(w: number, h: number): number[] | null {
  for (let attempt = 0; attempt < 14; attempt++) {
    let g = new Uint8Array(w * h);
    const inE = (x: number, y: number): number => {
      const dx = (x + 0.5 - w / 2) / (w / 2),
        dy = (y + 0.5 - h / 2) / (h / 2);
      return dx * dx + dy * dy;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = inE(x, y) < 0.9 && rand() < 0.57 ? 1 : 0;
    for (let it = 0; it < 5; it++) {
      const ng = new Uint8Array(w * h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const xx = x + dx,
                yy = y + dy;
              if (xx >= 0 && yy >= 0 && xx < w && yy < h && g[yy * w + xx]) n++;
            }
          ng[y * w + x] = inE(x, y) >= 0.95 ? 0 : n >= 5 ? 1 : n < 4 ? 0 : nth(g, y * w + x);
        }
      g = ng;
    }
    const seen = new Uint8Array(w * h);
    let best: number[] = [];
    for (let s = 0; s < w * h; s++) {
      if (!g[s] || seen[s]) continue;
      const list = [s];
      seen[s] = 1;
      for (let h2 = 0; h2 < list.length; h2++) {
        const c = nth(list, h2),
          x = c % w,
          y = (c / w) | 0;
        for (const d of D4) {
          const xx = x + d[0],
            yy = y + d[1];
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (g[j] && !seen[j]) {
            seen[j] = 1;
            list.push(j);
          }
        }
      }
      if (list.length > best.length) best = list;
    }
    if (best.length >= w * h * 0.33) return best;
  }
  return null;
}
// vaults (after DCSS / Angband): hand-drawn ASCII map pieces
// legend: # wall  H hedge  . floor  0 pillar  ~ shallow water  W deep water  L lava  : chasm  X crystal  " moss  c carpet
//         * light  & statue  _ altar  x rubble  (space) leave as is
// wall / wcol: the glyphs and colour of the vault's own masonry, so its outline reads from inside
export const VAULTS = [
  {
    k: 'temple',
    name: '円形神殿',
    strata: ['maze', 'ruins'],
    minD: 1,
    wall: '|I=#',
    wcol: [0.95, 0.8, 0.5],
    msg: '円形の神殿に足を踏み入れた。中央の像が、静かにこちらを見下ろしている。',
    map: [
      '...#####...',
      '.##.....##.',
      '.#.0...0.#.',
      '#....*....#',
      '.....&.....',
      '#....*....#',
      '.#.0...0.#.',
      '.##.....##.',
      '...##.##...',
    ],
  },
  {
    k: 'cross',
    name: '十字の大聖堂',
    strata: ['ruins'],
    minD: 1,
    wall: '+|=#',
    wcol: [0.85, 0.75, 1.0],
    msg: '十字形の大聖堂。四方の翼廊の奥で、古の灯が揺れている。',
    map: [
      '....#...#....',
      '....#.*.#....',
      '#####...#####',
      '#.0.......0.#',
      '#...........#',
      '....*.&.*....',
      '#...........#',
      '#.0.......0.#',
      '#####...#####',
      '....#.*.#....',
      '....#...#....',
    ],
  },
  {
    k: 'shrine',
    name: '水没した祠',
    strata: ['maze', 'ruins'],
    minD: 2,
    wall: '=#~',
    wcol: [0.5, 0.85, 0.95],
    msg: '水に沈んだ祠。浅い水の中に、小さな社がぽつんと残っている。',
    map: [
      '~~~~~~~~~~~',
      '~WWWWWWWWW~',
      '~W~~~~~~~W~',
      '~W~##.##~W~',
      '~~~#._.#~~~',
      '~W~#.*.#~W~',
      '~W~~~~~~~W~',
      '~WWWW~WWWW~',
      '~~~~~~~~~~~',
    ],
  },
  {
    k: 'peristyle',
    name: '列柱の中庭',
    strata: ['ruins'],
    minD: 1,
    wall: '|=#',
    wcol: [0.9, 0.85, 0.7],
    msg: '列柱に囲まれた中庭。苔むした庭の中心に、灯がひとつ残っている。',
    map: [
      '.............',
      '.0.0.0.0.0.0.',
      '.............',
      '.0.""""""".0.',
      '.0."""*""".0.',
      '.0.""""""".0.',
      '.............',
      '.0.0.0.0.0.0.',
      '.............',
    ],
  },
  {
    k: 'fountain',
    name: '泉の広間',
    strata: ['maze', 'ruins'],
    minD: 1,
    wall: '=~#',
    wcol: [0.55, 0.8, 1.0],
    msg: '四つの灯に囲まれた泉。水面に、灯の光が揺れている。',
    map: [
      '"".......""',
      '"..*...*.."',
      '....~~~....',
      '...~WWW~...',
      '...~W&W~...',
      '...~WWW~...',
      '....~~~....',
      '"..*...*.."',
      '"".......""',
    ],
  },
  {
    k: 'labyrinth',
    name: '小さな迷宮',
    strata: ['maze'],
    minD: 1,
    wall: '#=+',
    wcol: [0.7, 0.55, 1.0],
    msg: '部屋の中に、もうひとつ小さな迷宮が築かれている。中心で何かが光っている。',
    map: ['####.####', '#.......#', '#.#####.#', '#.#...#.#', '#.#.*.#.#', '#.#.#.#.#', '#...#...#', '#########'],
  },
  {
    k: 'lavaaltar',
    name: '溶岩の祭壇',
    strata: ['maze', 'ruins'],
    minD: 4,
    wall: '#%=',
    wcol: [1.0, 0.5, 0.3],
    msg: '溶岩の堀に囲まれた祭壇。一本だけ残った道の先で、巻物が浮かんでいる。',
    map: ['...........', '.LLLLLLLLL.', '.L.......L.', '.L.x._.x.L.', '.L.......L.', '.LLLL.LLLL.', '...........'],
  },
  {
    k: 'ossuary',
    name: '納骨堂',
    strata: ['maze', 'ruins'],
    minD: 3,
    wall: '%0o#',
    wcol: [0.9, 0.86, 0.75],
    msg: '壁龕に骨が積まれた納骨堂。崩れた瓦礫の向こうで、灯が揺れている。',
    map: ['#.#.#.#.#', '#x.....x#', '#.#&.&#.#', '....*....', '#.#&.&#.#', '#x.....x#', '#.#.#.#.#'],
  },
  {
    k: 'throne',
    name: '玉座の間',
    strata: ['maze', 'ruins'],
    minD: 2,
    wall: '|=#',
    wcol: [1.0, 0.72, 0.42],
    msg: '色褪せた絨毯の先に、空の玉座が残っている。主はとうにいない。',
    map: [
      '...........',
      '.0.0...0.0.',
      '....ccc....',
      '....ccc....',
      '.0..ccc..0.',
      '....ccc....',
      '....c_c....',
      '.0.0*.*0.0.',
      '...........',
    ],
  },
  {
    k: 'observatory',
    name: '結晶の観測所',
    strata: ['maze', 'ruins'],
    minD: 3,
    wall: '*+|',
    wcol: [0.6, 0.85, 1.0],
    msg: '結晶が環を描いて並ぶ観測所。中心の灯が、結晶の中で何重にも屈折している。',
    map: ['...........', '..X..X..X..', '...........', '.X...*...X.', '...........', '..X..X..X..', '...........'],
  },
  {
    k: 'hedge',
    name: '生垣の迷路',
    strata: ['maze', 'ruins'],
    minD: 1,
    wall: '"vY%',
    wcol: [0.3, 0.8, 0.45],
    msg: '苔と蔓で編まれた生垣の迷路。中心で小さな灯がまたたいている。',
    map: [
      'HHHHH.HHHHH',
      'H.........H',
      'H.HHH.HHH.H',
      'H.H.....H.H',
      '..H.H*H.H..',
      'H.H.....H.H',
      'H.HHH.HHH.H',
      'H.........H',
      'HHHHH.HHHHH',
    ],
  },
  {
    k: 'twinpools',
    name: '双子の池',
    strata: ['maze', 'ruins'],
    minD: 1,
    wall: '=~',
    wcol: [0.5, 0.8, 1.0],
    msg: '鏡のように並んだ二つの池。その間に、ひとつの灯が置かれている。',
    map: ['...........', '.~~~...~~~.', '.~W~.*.~W~.', '.~~~...~~~.', '...........'],
  },
  // ---- special-level pieces (only placed by the special levels)
  {
    k: 'house',
    name: '家',
    strata: ['town'],
    minD: 1,
    roof: true,
    wall: '#=|',
    wcol: [0.92, 0.72, 0.5],
    msg: '',
    map: ['#######', '#.....#', '#..*..#', '#.....#', '###.###'],
  },
  {
    k: 'shop',
    name: '店',
    strata: ['town'],
    minD: 1,
    roof: true,
    wall: '#=[]',
    wcol: [0.95, 0.8, 0.45],
    msg: '',
    map: ['#######', '#ccccc#', '#c.*.c#', '#.....#', '###.###'],
  },
  {
    k: 'townTemple',
    name: '町の神殿',
    strata: ['town'],
    minD: 1,
    roof: true,
    wall: '|I=#',
    wcol: [0.85, 0.8, 1.0],
    msg: '',
    map: ['#########', '#*.....*#', '#.......#', '#..._...#', '#.......#', '#*.....*#', '####.####'],
  },
  {
    k: 'townFountain',
    name: '泉の広場',
    strata: ['town'],
    minD: 1,
    wall: '=~',
    wcol: [0.55, 0.8, 1.0],
    msg: '',
    map: ['..*.*..', '.~~~~~.', '.~WWW~.', '.~~~~~.', '..*.*..'],
  },
  {
    k: 'oracle',
    name: '神託所',
    strata: ['oracle'],
    minD: 1,
    wall: '|=',
    wcol: [0.7, 0.85, 1.0],
    msg: '泉と像に囲まれた聖域。中央の座に、神託の巻物が浮かんでいる。',
    map: [
      '~~~...........~~~',
      '~W~..&.....&..~W~',
      '~~~...........~~~',
      '......0.*.0......',
      '...&....~....&...',
      '......~W_W~......',
      '...&....~....&...',
      '......0.*.0......',
      '~~~...........~~~',
      '~W~..&.....&..~W~',
      '~~~...........~~~',
    ],
  },
  {
    k: 'pit',
    name: '奈落の環',
    strata: ['maze', 'ruins'],
    minD: 2,
    wall: '#=:',
    wcol: [0.7, 0.6, 0.9],
    msg: '円を描く裂け目に囲まれた小島。一本の道だけが、中心の灯へと続いている。',
    map: ['.........', '.:::::::.', '.:.....:.', '.:.0*0.:.', '.:.....:.', '.:::.:::.', '.........'],
  },
];
/** 宝物庫の絵を、左右・上下を返したり、縦横を入れ替えたりして、いろいろな向きにする */
export function vaultCells(v: { map: readonly string[] }): string[][] {
  // random mirroring and transposition, so the same drawing appears in many orientations
  let m = v.map.map((r) => r.split(''));
  if (rand() < 0.5) m = m.map((r) => r.slice().reverse());
  if (rand() < 0.5) m = m.slice().reverse();
  if (rand() < 0.5) {
    const t: string[][] = [];
    for (let x = 0; x < nth(m, 0).length; x++) {
      t.push(m.map((r) => nth(r, x)));
    }
    m = t;
  }
  return m;
}
