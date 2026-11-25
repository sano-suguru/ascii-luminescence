// テストの道具：階ごとに祭壇とルーンを置く関数（src/lib/altars.ts）と、階のシード・生き物の強さ・墓のルーン・試練を、たくさんの場合で呼び、
// 返す値と、階の床の物・湧く所・十字路などの変わり方を、1つの文字列にまとめる。F は関数をまとめた物。
// place.test.ts が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は、Node で本物の迷宮を生成する（gen-places.ts の全部の場所）。なので、迷宮の生成を変えると、この指紋も変わる。
// 場合ごとに、探索のシード・深さ1の台と最初の祭壇を取ったか・取った物・墓の記録・試しの間の中か・試練・解放と、階の形（ときどき少し変える）を、シードの乱数で変える。
// 書き換えた状態（here・adv・saved・ui・gear・player・生き物の表の主と忘れられた獣）と Math.random は、終わったら元に戻す。
import { lookup } from '../../src/lib/array.ts';
import { type MonsterType, MTYPES } from '../../src/lib/creatures.ts';
import { UNLOCKS, type Grave } from '../../src/lib/progress.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES, TRAITS, type Rune, type SavedRune } from '../../src/lib/runes.ts';
import { adv, gear, here, player, saved, ui } from '../../src/lib/state.ts';
import { BRANCHES, CELL, REALMS, cpos } from '../../src/lib/world.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';

/** 比べる関数 */
export interface PlaceFns {
  levelSeed(): number;
  placeRunesForLevel(): void;
  nearStele(): boolean;
  strongestKey(): string | null;
  statOf(m: { ty: MonsterType; key: string }): readonly number[];
  graveRune(g: SavedRune): Rune;
  trialOn(k: string): boolean;
}

const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** 記録を1つの文字列にする（undefined の欄・NaN・Set・Map・数の配列も見分ける） */
const text = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) =>
    x === undefined
      ? 'undefined'
      : typeof x === 'number' && !Number.isFinite(x)
        ? String(x)
        : x instanceof Set
          ? { set: [...x] }
          : x instanceof Map
            ? { map: [...x] }
            : x instanceof Int32Array
              ? { arr: fnv(x.join(',')) }
              : x,
  );
const ALL_RUNES = Object.values(RUNE_TYPES).flat();
/** 保存したルーン（特性の数と段・強い版か・欄が無い古い記録も） */
function savedRune(r: () => number): SavedRune {
  const type = ALL_RUNES[Math.floor(r() * ALL_RUNES.length)] ?? 'fire',
    keys = Object.keys(TRAITS[type] || { a: 0, b: 0 }),
    g: SavedRune = { type };
  if (r() < 0.7) g.strong = r() < 0.4;
  if (r() < 0.8) g.traits = keys.filter(() => r() < 0.6).map((k) => ({ k, lv: Math.floor(r() * 6) }));
  return g;
}

/** 階のシード・生き物の強さ・墓のルーン・試練（seeds：場合のシードの数） */
export function smallCases(F: PlaceFns, seeds: number): string {
  const out: string[] = [],
    keep = {
      runSeed: adv.runSeed,
      runTrials: adv.runTrials,
      runeUid: gear.runeUid,
      depth: here.depth,
      branch: here.branch,
      realm: here.realm,
      inter: here.inter,
    };
  const branches = Object.values(BRANCHES),
    realms = Object.values(REALMS),
    inters = ['town', 'bigroom', 'oracle', 'fortress'];
  try {
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 7919 + 3);
      adv.runSeed = r() < 0.05 ? 0 : (r() * 4294967296) >>> 0;
      here.depth = 1 + Math.floor(r() * 16);
      const B = branches[Math.floor(r() * branches.length)],
        Rm = realms[Math.floor(r() * realms.length)];
      here.branch = B && r() < 0.3 ? { key: B.key, lvl: 1 + Math.floor(r() * B.len), len: B.len, ret: here.depth + 1 } : null;
      here.realm = Rm && r() < 0.2 ? { key: Rm.key, ret: here.depth + 1 } : null;
      here.inter = r() < 0.2 ? { key: inters[Math.floor(r() * inters.length)] ?? 'town', after: here.depth } : null;
      adv.runTrials = r() < 0.5 ? ['fury'] : r() < 0.5 ? ['dusk'] : [];
      gear.runeUid = 500;
      const g = savedRune(r);
      out.push(text({ seed: F.levelSeed(), fury: F.trialOn('fury'), dusk: F.trialOn('dusk'), g, grave: F.graveRune(g) }));
    }
    // 生き物の強さ：表の全部の種類と、表に無い種類・元にした種類 sk のある種類（主）を、試練のあり・なしで
    const keys = [...Object.keys(MTYPES), 'final', 'final2', 'dummy', 'dummyF', 'dummyP', 'dummyT', 'nope'];
    for (const trials of [[], ['fury']]) {
      adv.runTrials = trials;
      for (const key of keys) {
        const ty = MTYPES[key] || { ...lookup(MTYPES, 'r'), name: key },
          sk = keys[(key.charCodeAt(0) * 7) % keys.length] ?? 'r';
        out.push(text({ key, st: F.statOf({ ty, key }), lord: F.statOf({ ty: { ...ty, sk }, key: 'lord' }) }));
      }
    }
  } finally {
    Object.assign(adv, { runSeed: keep.runSeed, runTrials: keep.runTrials });
    gear.runeUid = keep.runeUid;
    Object.assign(here, { depth: keep.depth, branch: keep.branch, realm: keep.realm, inter: keep.inter });
  }
  return out.join('\n');
}

/** 階ごとに祭壇とルーンを置く（seeds：探索のシードの数。1つのシードで、全部の場所を1回ずつ） */
export async function placeCases(F: PlaceFns, seeds: number): Promise<string> {
  const env = await loadEnv(),
    out: string[] = [];
  const keep = {
    here: { D: here.D, depth: here.depth, branch: here.branch, realm: here.realm, inter: here.inter },
    adv: { runSeed: adv.runSeed, runState: adv.runState, runTrials: adv.runTrials },
    saved: { META: saved.META, DEVALL: saved.DEVALL },
    gallery: ui.gallery,
    runeUid: gear.runeUid,
    player: { x: player.x, z: player.z },
    lord: MTYPES['lord'],
    X: MTYPES['X'],
    random: Math.random,
  };
  const unl = UNLOCKS.map((u) => u.id);
  try {
    for (let s = 1; s <= seeds; s++) {
      for (const [pi, place] of PLACES.entries()) {
        const r = mulberry32(s * 1000003 + pi * 7907);
        Math.random = mulberry32(s * 31 + pi);
        adv.runSeed = (r() * 4294967296) >>> 0;
        here.depth = place.depth;
        here.branch = place.branch ?? null;
        here.realm = place.realm ?? null;
        here.inter = place.inter ?? null;
        const seed = F.levelSeed(),
          res = gen(env, seed, place, adv.runSeed);
        // 古い JS の generate と同じく、その階の主と忘れられた獣を、生き物の表に入れる
        if (res.lordType) MTYPES['lord'] = res.lordType;
        if (res.beastType) MTYPES['X'] = res.beastType;
        here.D = res.level;
        if (place.depth === 16 && !place.branch && !place.realm) here.D.finalVault = true;
        // 生成ではまれにしか出ない形も通るように、ときどき階を少し変える：階段が無い・階段が支道の出口だけ・部屋（始まりの部屋のほか）の床が全部ふさがっている・異界が深さ1
        const shape = r(),
          D0 = here.D;
        if (shape < 0.08) {
          D0.stairs = -1;
          D0.bstairs = null;
        } else if (shape < 0.16) {
          const far = D0.rooms[D0.rooms.length - 1]?.cells ?? [];
          D0.bstairs = { cell: far[Math.floor(far.length / 2)] ?? D0.start, key: 'crypt' };
          D0.stairs = -1;
        } else if (shape < 0.24) for (const ro of D0.rooms.slice(1)) for (const c of ro.cells) D0.solid.set(c, 0.5);
        if (place.realm && r() < 0.5) here.depth = 1;
        // 探索の状態
        const taken = new Set<string>();
        for (let k = 0; k < 3; k++) if (r() < 0.3) taken.add(seed + ':' + Math.floor(r() * 12) + ':' + (r() < 0.7 ? 'rune' : 'spring'));
        adv.runState = { startChosen: r() < 0.3, altar1: r() < 0.3, taken, lordsDone: new Set() };
        adv.runTrials = r() < 0.3 ? ['fury'] : [];
        const grave: Grave | null =
          r() < 0.4 ? null : { k: 'cavern', depth: r() < 0.7 ? place.depth : 1 + Math.floor(r() * 16), cause: '落石', item: savedRune(r) };
        saved.META = { ...saved.META, grave, unl: unl.filter(() => r() < 0.5) };
        saved.DEVALL = r() < 0.3;
        ui.gallery = r() < 0.08 ? { mode: 'range' } : null;
        gear.runeUid = 1000;
        const key = F.strongestKey();
        F.placeRunesForLevel();
        const D = here.D;
        // 石碑と祭壇のまわりと、でたらめな所で、そばか
        const spots: number[][] = [];
        for (const c of [...(D.steles || []).map((x) => x.i), ...D.items.filter((o) => o.altar && o.slot === 1).map((o) => o.i)]) {
          const [x, z] = cpos(c);
          for (const d of [1.5, 2.55, 2.65, 4]) spots.push([x + d, z], [x, z - d]);
        }
        for (let k = 0; k < 4; k++) spots.push([r() * 160, r() * 160]);
        const near = spots.map(([x, z]) => {
          player.x = x ?? 0;
          player.z = z ?? 0;
          return F.nearStele() ? 1 : 0;
        });
        out.push(
          text({
            pi,
            seed,
            key,
            items: D.items,
            spawns: D.spawns,
            dS: D.dS,
            pathL: D.pathL,
            hub: D.hub,
            hubNear: D.hubNear,
            eliteWhy: D.eliteWhy,
            stairGuard: D.stairGuard,
            steles: D.steles,
            near: near.join(''),
            uid: gear.runeUid,
            cell: CELL,
          }),
        );
      }
    }
  } finally {
    Object.assign(here, keep.here);
    Object.assign(adv, keep.adv);
    Object.assign(saved, keep.saved);
    ui.gallery = keep.gallery;
    gear.runeUid = keep.runeUid;
    Object.assign(player, keep.player);
    if (keep.lord) MTYPES['lord'] = keep.lord;
    else delete MTYPES['lord']; // oxlint-disable-line no-dynamic-delete
    if (keep.X) MTYPES['X'] = keep.X;
    else delete MTYPES['X']; // oxlint-disable-line no-dynamic-delete
    Math.random = keep.random;
  }
  return out.join('\n');
}
