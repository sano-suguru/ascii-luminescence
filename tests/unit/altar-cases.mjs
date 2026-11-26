// テストの道具：祭壇とルーンを置く関数を、たくさんの場合で呼び、返す値と、階の床の物・湧く所の変わり方を、1つの文字列にまとめる。
// F は関数をまとめた物（src/lib/altars.ts・unlocks.ts の関数と、gear.ts の randomRuneType）。altars.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は、迷宮の生成を使わずに、ここで小さな階（部屋・床・水・湧く所）を作る（迷宮の生成を変えても、この指紋は変わらない）。
// 場合ごとに、手（武器・特性・枠・体の枠）・解放・開発用モード・深さ・体力・探索のシード・番人の群れを、シードの乱数で変える。
// 書き換えた状態（here・gear・adv・player・saved）と Math.random は、終わったら元に戻す。
// 祭壇の中身と鍛え方は、本当は出来事ごとの乱数（keyedRand）で選ぶが、ここでは Math.random を読む乱数を渡す。乱数を分ける前と同じ指紋になるので、選び方は変わっていない。
import { UNLOCKS } from '../../src/lib/progress.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES, TRAITS } from '../../src/lib/runes.ts';
import { adv, gear, here, player, saved } from '../../src/lib/state.ts';
import { LQ_WATER, MH, MW, NCELL, TF, TW } from '../../src/lib/world.ts';

const HOSTILE = ['r', 'k', 'j', 'e', 'm', 'g', 'c', 'v'];

/** 小さな階：壁の中に四角い部屋を12個（0番は始まりの部屋）。床の一部は水、一部は固い物。湧く所は、部屋の中に群れで */
function makeLevel(r) {
  const tile = new Uint8Array(NCELL).fill(TW),
    liquid = new Uint8Array(NCELL),
    roomOf = new Int16Array(NCELL).fill(-1),
    solid = new Map(),
    rooms = [],
    spawns = [];
  for (let k = 0; k < 12; k++) {
    const w = 3 + Math.floor(r() * 8),
      h = 3 + Math.floor(r() * 8),
      x0 = 1 + Math.floor(r() * (MW - w - 2)),
      z0 = 1 + Math.floor(r() * (MH - h - 2)),
      cells = [];
    for (let z = z0; z < z0 + h; z++)
      for (let x = x0; x < x0 + w; x++) {
        const i = z * MW + x;
        if (roomOf[i] >= 0) continue;
        tile[i] = TF;
        roomOf[i] = k;
        cells.push(i);
        if (r() < 0.08) liquid[i] = LQ_WATER;
        else if (r() < 0.04) solid.set(i, 0.5);
      }
    rooms.push({ cells, cave: r() < 0.5 });
    const g = k + 1;
    for (let n = 0, m = Math.floor(r() * 4); n < m && cells.length; n++) {
      const c = cells[Math.floor(r() * cells.length)];
      spawns.push({ key: HOSTILE[Math.floor(r() * HOSTILE.length)], cx: c % MW, cz: (c / MW) | 0, g, lead: n === 0 });
    }
  }
  if (r() < 0.3) spawns.push({ key: 'lord', cx: 5, cz: 5, g: 99 });
  return { tile, liquid, roomOf, solid, rooms, spawns, items: [], stratum: { special: r() < 0.1 }, finalVault: r() < 0.1 };
}
const rune = (r, type, uid) => {
  const ru = { uid, type };
  if (RUNE_TYPES.atk.includes(type) && r() < 0.6)
    ru.traits = Object.keys(TRAITS[type] || {})
      .filter(() => r() < 0.4)
      .map((k) => ({ k, lv: 1 + Math.floor(r() * 5) }));
  if (r() < 0.2) ru.strong = true;
  return ru;
};
const pickT = (r, c) => RUNE_TYPES[c][Math.floor(r() * RUNE_TYPES[c].length)];
const show = (v) =>
  JSON.stringify(v, (k, x) =>
    x === undefined ? 'undefined' : typeof x === 'number' && !Number.isFinite(x) ? String(x) : x instanceof Map ? [...x] : x,
  );

/** seeds：場合の数 */
export function altarCases(F, seeds) {
  const out = [],
    saved0 = {
      random: Math.random,
      here: { D: here.D, depth: here.depth, monsters: here.monsters },
      gear: { hands: gear.hands, runeUid: gear.runeUid },
      adv: { runSeed: adv.runSeed, PLAYER_MAX: adv.PLAYER_MAX, runState: adv.runState },
      hp: player.hp,
      saved: { DEVALL: saved.DEVALL, META: saved.META },
    };
  try {
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s);
      const D = makeLevel(r);
      here.D = D;
      here.depth = 1 + Math.floor(r() * 13);
      adv.runSeed = Math.floor(r() * 2 ** 31);
      adv.PLAYER_MAX = 40 + Math.floor(r() * 40);
      adv.runState = { ...saved0.adv.runState, bodyOpen: Math.floor(r() * 4) };
      player.hp = r() * adv.PLAYER_MAX;
      saved.DEVALL = r() < 0.3;
      saved.META = { ...saved0.saved.META, unl: UNLOCKS.filter(() => r() < 0.5).map((u) => u.id) };
      let uid = 100;
      const hand = (atk) => ({
        atk,
        slots: Array.from({ length: 4 }, () => (r() < 0.4 ? rune(r, pickT(r, ['elem', 'trig', 'mod'][Math.floor(r() * 3)]), uid++) : null)),
        slotN: 2 + Math.floor(r() * 3),
        turn: 0,
        elem: null,
        trig: null,
      });
      const w1 = r() < 0.9 ? rune(r, pickT(r, 'atk'), uid++) : null,
        w2 = r() < 0.3 ? w1 : r() < 0.9 ? rune(r, pickT(r, 'atk'), uid++) : null;
      gear.hands = {
        L: hand(w1),
        R: hand(w2),
        B: { b0: r() < 0.5 ? rune(r, pickT(r, 'body'), uid++) : null, b1: r() < 0.5 ? rune(r, pickT(r, 'body'), uid++) : null },
      };
      gear.runeUid = 500;
      here.monsters = Array.from({ length: Math.floor(r() * 5) }, () => ({ x: 0, z: 0, ty: {}, dead: r() < 0.3, g: Math.floor(r() * 6) }));
      const res = [];
      Math.random = mulberry32(s * 13 + 5);
      const rr = mulberry32(s * 17 + 3);
      const floors = [];
      for (let i = 0; i < NCELL; i++) if (D.tile[i] === TF && !D.liquid[i]) floors.push(i);
      const cell = () => floors[Math.floor(r() * floors.length)];
      try {
        res.push(
          F.unlocked(UNLOCKS[Math.floor(r() * UNLOCKS.length)].id),
          F.lockedOf('weapon', pickT(r, 'atk')),
          F.lockedOf('rune', 'poison'),
          F.weaponPool(),
        );
        for (let k = 0; k < 4; k++)
          res.push(
            F.randomRuneType(
              rr,
              r() < 0.5 ? undefined : { atk: r() * 0.3, elem: r() * 0.4, trig: r() * 0.2, mod: r() * 0.4, body: r() * 0.2 },
            ),
          );
        res.push(F.hostileKeys(), F.nextGroup());
        for (let k = 0; k < 3; k++) res.push(F.addGuards(cell(), rr));
        res.push(F.forgeOptions(Math.floor(r() * 4), () => Math.random()).map((f) => [f.w.uid, f.k, f.from, f.to]));
        for (const k of ['cavern', 'ruins', 'magma', 'deep']) res.push(F.forgeDepthOf(k));
        res.push(F.vaultArea({ i: cell() }, 1 + Math.floor(r() * 4)));
        // 祭壇：ルーンの祭壇・主の祭壇（番人つき）・鍛えの祭壇。2回目の altarFill は何もしない
        F.placeAltar(cell(), 'a0');
        F.placeAltar(cell(), 'a1', { lord: true, guardG: Math.floor(r() * 6) });
        F.placeAltar(cell(), 'a2', { forge: true });
        for (const g of ['a0', 'a1', 'a2', 'nope', 'a0']) F.altarFill(g, () => Math.random());
        for (const it of D.items) if (it.altar && it.opt) res.push(F.altarLine(it), F.guardedNow(it));
        res.push(F.altarLine({ opt: 'open', label: r() < 0.8 ? '左手の枠' : undefined }));
        res.push(F.guardedNow({ guardG: Math.floor(r() * 6) }), F.guardedNow({}));
        // 泉（候補の部屋の外れ det はでたらめ。選ぶ関数がある時と無い時）
        const scored = D.rooms.map((ro, ri) => ({ ri, ro, det: Math.floor(r() * 10) })).filter(() => r() < 0.7);
        const free = (c) => D.tile[c] === TF && !D.liquid[c];
        for (let k = 0; k < 4; k++)
          F.placeSpring(
            rr,
            free,
            r() < 0.15 ? undefined : scored,
            r() < 0.3 ? (list) => list[Math.floor(r() * (list.length + 1))] ?? null : undefined,
          );
      } catch (e) {
        res.push('ERR ' + String(e.message).slice(0, 60));
      }
      out.push(show({ res, items: D.items, spawns: D.spawns, uid: gear.runeUid }));
    }
  } finally {
    Math.random = saved0.random;
    Object.assign(here, saved0.here);
    Object.assign(gear, saved0.gear);
    Object.assign(adv, saved0.adv);
    player.hp = saved0.hp;
    Object.assign(saved, saved0.saved);
  }
  return out.join('\n');
}
