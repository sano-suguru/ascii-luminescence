// テストの道具：カメラから見て描く・調べる処理を、たくさんの場合で呼び、結果を1つの文字列にまとめる。
// 生き物を描く処理（src/lib/bodies/draw.ts の drawMonster・drawMonster1・drawMonster0・drawTentacles）・罠と鉄格子を描く処理（fixtures.ts の drawTraps）・
// 見た時の説明（look.ts の look）・灯りの揺らぎと灯りを描画に渡す配列（lightmap.ts の flicker・updateLights）・照準（aim.ts）。
// F は関数をまとめた物。view.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の全部の場所）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、本物の階に、全部の種類の生き物（主・忘れられた獣・王の影も）と、罠・鉄格子・床の物・灯りの種類を足し、
// カメラ（gfx.camera は、TypeScript が読む位置だけの偽物）とプレイヤーの向きを、どれかの物へ向けて、関数を続けて呼ぶ。
// 返す値と、置いた文字と粒子の配列の中身・見た目の乱数と音の乱数を引いた数・伝言・偽の Web Audio の記録・説明の画面・灯りの配列・状態の変わり方を記録する。
// テストを .mjs で書くのは、偽の画面の部品・偽のカメラ・偽の Web Audio を、本物の型に合わせられないため。
// 書き換えた状態と、document・window・Math.random・音の乱数は、終わったら元に戻す。
import { sndInit } from '../../src/lib/audio.ts';
import { addLooks, buildForm } from '../../src/lib/bodies/build.ts';
import { beastSamples } from '../../src/lib/bodies/lords.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { TRAP_INFO } from '../../src/lib/names.ts';
import { P, dCol, dPar, dPos } from '../../src/lib/particles.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES, TRAITS } from '../../src/lib/runes.ts';
import { STRATUM_OMEN } from '../../src/lib/omens.ts';
import { SPECIALS } from '../../src/lib/strata.ts';
import { DLC, DLP, SL, SND, adv, blaze, buf, clock, gear, gfx, here, lantern, msgs, player, ui, vfx } from '../../src/lib/state.ts';
import {
  BRANCHES,
  CELL,
  D4,
  FINAL_DEPTH,
  LQ_BOG,
  LQ_DEEP,
  LQ_LAVA,
  LQ_WATER,
  MW,
  NCELL,
  REALMS,
  SF_BRIM,
  SF_DEAD,
  SF_FOLIAGE,
  SF_FUNGFOR,
  SF_GRASS,
  SF_HAY,
  SF_ICE,
  SF_LUMEN,
  SF_MUD,
  SF_OBSIDIAN,
  SF_RUBBLE,
  TC,
  TF,
  TP,
  TW,
  TX,
  cpos,
} from '../../src/lib/world.ts';
import { formTypes } from './bodies-legacy-cases.mjs';
import { fakeAudioClass } from './fake-audio.mjs';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';

/** 灯りの全部の種類（flicker の分かれ道と同じ並び。'none' は、どれにも当たらない種類） */
export const LIGHT_TYPES = [
  'brazier',
  'crystal',
  'rune',
  'fungus',
  'abyss',
  'lamp',
  'upstairs',
  'tele',
  'portal',
  'bstairs',
  'stairs',
  'fall',
  'veinlight',
  'crater',
  'spring',
  'firefly',
  'marsh',
  'sun',
  'well',
  'orb',
  'bloodwort',
  'vent',
  'pitglow',
  'xlight',
  'torch',
  'lava',
  'embers',
  'relic',
  'pages',
  'mist',
  'none',
];
/** 形の点の部位のうち、drawMonster0 が動かし方を分ける物（switch の分かれ道と、その前の部位ごとの扱い） */
export const PARTS = [
  'heart',
  'crack',
  'tongue',
  'eye',
  'tent',
  'ap',
  'flame',
  'jel',
  'bloat',
  'wisp',
  'eelw',
  'slither',
  'cap',
  'snout',
  'graze',
  'sway',
  'bog',
  'bogarm',
  'breathe',
  'claw',
  'parm',
  'serp',
  'tendril',
  'armL',
  'legR',
  'armR',
  'legL',
  'head',
  'core',
  'body',
  'shell',
  'puff',
  'wing',
  'tail',
  'spin',
  'halo',
  'orbit',
  'robe',
  'seg',
  'shead',
  'jelly',
  'pulse',
];
const SURFACES = [SF_OBSIDIAN, SF_LUMEN, SF_ICE, SF_RUBBLE, SF_DEAD, SF_FOLIAGE, SF_FUNGFOR, SF_BRIM, SF_MUD, SF_HAY, SF_GRASS, 0];
const LIQUIDS = [0, 0, 0, LQ_DEEP, LQ_BOG, LQ_LAVA, LQ_WATER];

/** 場合ごとに1つ通す場面（場合の終わり。説明と描き方の細かい分かれ道） */
const SCENES = [
  'spring',
  'vault',
  'grave',
  'peaceful',
  'hidden',
  'critter',
  'relic',
  'gate',
  'omen',
  'tomb',
  'halo',
  'phantom',
  'floor',
  'start',
  'tongue',
  'trampled',
  'gates',
];
/**
 * 配列の中身の指紋（Float32Array・Uint8Array のバイト列の from から to まで）。NaN は1つの並びにそろえる
 * （NaN のビットの並びは、同じ計算でも、V8 が最適化する前と後で変わりうる。NaN どうしの違いは動きに関係しない）
 */
const hashArr = (a, from, to) => {
  if (a instanceof Float32Array) a = a.slice(from, Math.max(from, to)).map((x) => (Number.isNaN(x) ? NaN : x));
  else a = a.subarray(from, Math.max(from, to));
  const b = new Uint8Array(a.buffer, a.byteOffset, a.length * a.BYTES_PER_ELEMENT);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ (b[i] ?? 0), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** 値を1つの文字列にする（NaN・Infinity・undefined も見分ける。生き物の種類は名前だけ、形は点の指紋、配列の型は指紋） */
const text = (v) =>
  JSON.stringify(v, (k, x) =>
    x === undefined
      ? 'undefined'
      : typeof x === 'number' && !Number.isFinite(x)
        ? String(x)
        : typeof x === 'function'
          ? 'fn'
          : x instanceof Set
            ? { set: [...x] }
            : x instanceof Map
              ? { map: [...x.keys()] }
              : ArrayBuffer.isView(x)
                ? hashArr(x, 0, x.length)
                : k === 'ty' && x && typeof x === 'object'
                  ? (x.name ?? 'ty')
                  : (k === 'form' || k === 'formSleep' || k === 'drawForm' || k === 'from') && Array.isArray(x)
                    ? fnv(JSON.stringify(x))
                    : x,
  );
/** 写しから元に戻す（写しに無い欄は消す） */
const restore = (obj, copy) => {
  for (const k of Object.keys(obj)) if (!(k in copy)) delete obj[k];
  Object.assign(obj, copy);
};
/** 見た時の説明の名前（lookLine の <b>…</b> と <span> の間） */
export const lookName = (h) => (h.match(/<\/b>(.*?)<span>/) || [])[1] ?? '';

/** seeds：場合の数。返り値は、場合ごとの1行（呼んだ関数ごとの記録と、最後の状態） */
export async function viewCases(F, seeds) {
  const env = await loadEnv(),
    out = [];
  const keep = {
    here: { ...here },
    adv: { runSeed: adv.runSeed, HIST: adv.HIST, HIST_SEED: adv.HIST_SEED, runState: adv.runState },
    player: { ...player },
    ui: { ...ui },
    vfx: { ...vfx },
    blaze: { ...blaze },
    gear: { ...gear },
    gfx: { ...gfx },
    lantern: { ...lantern },
    SND: { ...SND },
    buf: { ...buf },
    time: clock.time,
    lord: MTYPES['lord'],
    X: MTYPES['X'],
    random: Math.random,
    sound: setSoundRand(Math.random),
    msgs: [...msgs],
  };
  // ゲームと同じく、形を作る前に表へ見た目を書き足す。書き足す欄は、終わったら元に戻す（addLooks は2回呼ぶと灯りの色が変わる）
  const LOOK_FIELDS = ['look', 'form', 'trail', 'col', 'lcol'],
    keptTypes = Object.entries(MTYPES).map(([k, t]) => [k, LOOK_FIELDS.map((f) => [f, Object.getOwnPropertyDescriptor(t, f)])]);
  addLooks();
  const els = { log: { innerHTML: '' } },
    alog = [];
  const restoreGlobals = swapGlobals({
    document: { getElementById: (id) => els[id] ?? null },
    window: { AudioContext: fakeAudioClass(alog, 'running') },
  });
  try {
    Math.random = mulberry32(1);
    Object.assign(SND, { ctx: null, master: null, inp: null, wet: null, noise: null, on: true });
    sndInit();
    // 生き物の種類：表の全部と主・古い形・忘れられた獣・図鑑の見本・王の影（色と大きさの無い物は除く）
    const types = formTypes(beastSamples(), 4).filter(([, ty]) => ty.col && ty.scale !== undefined);
    // 影をまとう忘れられた獣（起きていてそばにいると、階の灯りが暗くなる）
    types.push(
      ...types
        .filter(([, t]) => t.beast && t.spec)
        .slice(0, 2)
        .map(([, ty], i) => [`shadowBeast${i}`, { ...ty, spec: { ...ty.spec, shadow: true } }]),
    );
    const conj = types.filter(([, ty]) => ty.conj),
      deep = types.filter(([, ty]) => ty.habitat === 'deep' || ty.form === 'deepkraken'),
      shadow = types.filter(([k]) => k === 'final' || k.startsWith('shadow')),
      dragons = types.filter(([, ty]) => ty.beast || (ty.form === 'dragon' && !ty.boss)),
      inv = types.filter(([, ty]) => ty.invisible),
      odd3 = types.filter(([, ty]) => ty.critter || ty.peaceful || ty.beast || ty.spec?.shadow),
      eels = types.filter(([, ty]) => ty.form === 'eel');
    // めったに無い部位を持つ種類（その部位を持つ種類が8つより少ない物。形は見た目の乱数で少し変わるので、1度作って調べる）
    Math.random = mulberry32(2);
    const partsOf = types.map(([, ty]) => new Set(buildForm(ty).map((p) => p.part))),
      few = PARTS.filter((p) => partsOf.filter((ps) => ps.has(p)).length < 8),
      rare = types.filter((_, i) => few.some((p) => partsOf[i].has(p)));
    const odd = PLACES.filter((p) => p.branch || p.realm || p.inter || p.depth >= FINAL_DEPTH - 1);
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 69069 + 11),
        pick = (a) => a[Math.floor(r() * a.length)],
        chance = (p) => r() < p;
      let mrN = 0;
      const mrSrc = mulberry32(s * 7919 + 13);
      Math.random = () => (mrN++, mrSrc());
      let sndN = 0;
      const sndSrc = mulberry32(s * 104729 + 17);
      setSoundRand(() => (sndN++, sndSrc()));
      const place = chance(0.5) ? pick(odd) : pick(PLACES);
      adv.runSeed = (r() * 4294967296) >>> 0;
      Object.assign(here, {
        depth: place.depth,
        branch: place.branch ?? null,
        realm: place.realm ?? null,
        inter: place.inter ?? null,
        trans: null,
        finalSt: null,
      });
      const res = gen(env, (r() * 4294967296) >>> 0, place, adv.runSeed);
      if (res.lordType) MTYPES['lord'] = res.lordType;
      if (res.beastType) MTYPES['X'] = res.beastType;
      const D = res.level;
      here.D = D;
      here.fixtures = D.fixtures;
      adv.HIST = makeHistory(adv.runSeed);
      adv.runState = { startChosen: true, altar1: true, taken: new Set(), lordsDone: new Set(), bodyOpen: Math.floor(r() * 3) };
      const floors = [],
        walls = [];
      for (let i = 0; i < NCELL; i++) {
        if (D.tile[i] === TF) floors.push(i);
        else if (D.tile[i] === TW && D4.some(([dx, dz]) => D.tile[i + dx + dz * MW] === TF)) walls.push(i);
      }
      const c0 = pick(floors),
        [px, pz] = cpos(c0);
      const cellNear = (x, z, rr) => {
        const cx = Math.floor((x + (r() - 0.5) * rr) / CELL),
          cz = Math.floor((z + (r() - 0.5) * rr) / CELL);
        return Math.max(0, Math.min(NCELL - 1, cz * MW + cx));
      };
      // 灯り：本物の灯りの種類を、全部の種類から選び直す（半分ほど）。噴き出しているか・ブラッドワートの明るさ・噴気孔の明るさ
      for (const L of D.lights) {
        if (chance(0.5)) L.type = pick(LIGHT_TYPES);
        if (chance(0.3)) L.active = chance(0.5);
        if (chance(0.2)) L.fade = r();
        if (chance(0.2)) L.boost = r();
      }
      D.collapsed = chance(0.5);
      D.pit = chance(0.6) ? new Uint8Array(NCELL) : undefined;
      // 罠（全部の種類。見つかった物・作動した物）と鉄格子
      D.traps = D.traps || [];
      for (let k = 0; k < 4; k++)
        D.traps.push({ i: cellNear(px, pz, 40), type: pick(Object.keys(TRAP_INFO)), hidden: chance(0.2), used: chance(0.3) });
      if (!D.gate || chance(0.3)) {
        const cell = cellNear(px, pz, 30),
          lever = cellNear(px, pz, 30);
        D.gate = { cell, lever, ld: pick(D4), open: chance(0.4), o: chance(0.5) ? r() : pick([0, 1]), axis: pick([0, 1]) };
        if (chance(0.6)) D.gate.heir = '王の冠';
      }
      // 支道の入口と異界の門（本物の階には、決まった深さにしか無いので、足して全部の種類を通す。備品も足す）
      for (const kind of ['bstairs', 'portal']) {
        if (!chance(0.3)) continue;
        const cell = cellNear(px, pz, 20),
          [fx, fz] = cpos(cell);
        D[kind] = { key: pick(Object.keys(kind === 'bstairs' ? BRANCHES : REALMS)), cell };
        here.fixtures.push({ type: kind, x: fx, z: fz, col: [r(), r(), r()], li: 99999, acc: 0, ph: 0 });
      }
      // 階段の封（階段の前の部屋で待つ群れ。7 は番人のいる祭壇の群れと同じ）
      if (chance(0.4)) D.stairGuard = pick([7, 8]);
      // 床の物：鍛えの祭壇・墓・泉・番人のいる祭壇・枠を開ける・癒し・宝物庫の宝・ふつうのルーン（特性つき）
      const rune = () => {
        const type = pick([...RUNE_TYPES.atk, ...RUNE_TYPES.elem, ...RUNE_TYPES.body]),
          trk = Object.keys(TRAITS[type] || {});
        const ru = { uid: Math.floor(r() * 1000), type, strong: chance(0.3) };
        if (chance(0.6))
          ru.traits = (chance(0.8) && trk.length ? trk : ['nope']).slice(0, 2).map((k) => ({ k, lv: 1 + Math.floor(r() * 5) }));
        return ru;
      };
      const noVault = chance(0.3);
      for (let k = 0; k < 8; k++) {
        const i = cellNear(px, pz, 40),
          kind = pick(['forge', 'grave', 'spring', 'guard', 'open', 'heal', noVault ? 'rune' : 'vault', 'rune', 'none']);
        const it = { i, kind: kind === 'grave' || kind === 'spring' ? kind : 'rune', taken: chance(kind === 'spring' ? 0.4 : 0.15) };
        if (kind === 'forge') it.forge = true;
        if (kind === 'grave') {
          if (chance(0.6)) it.g = { k: 'x', depth: Math.floor(r() * 12), cause: chance(0.6) ? '大蛇' : '', item: null };
          it.rune = rune();
        }
        if (kind === 'guard') {
          it.guardG = 7;
          it.elitePrize = chance(0.5);
        }
        if (kind !== 'none' && kind !== 'spring' && chance(0.9)) it.rune = it.rune || rune();
        if (kind === 'open') Object.assign(it, { opt: 'open', label: chance(0.8) ? '右手の枠を開ける' : undefined });
        if (kind === 'heal') it.opt = 'heal';
        if (kind === 'vault') Object.assign(it, { vault: true, ev: pick(['guard', 'collapse']) });
        if (kind === 'rune' && chance(0.6)) it.grp = 'altar1';
        D.items.push(it);
      }
      // 遺品の台（鉄格子の奥の部屋）
      if (chance(0.3) && D.rooms.length) {
        const ri = Math.floor(r() * D.rooms.length),
          room = D.rooms[ri],
          c = room.cells[Math.floor(r() * room.cells.length)] ?? c0,
          [fx, fz] = cpos(c);
        if (chance(0.8)) room.kindMsg = chance(0.7) ? '鉄格子の奥に、何かが光っている' : '静かな部屋';
        here.fixtures.push({ type: 'relic', x: fx, z: fz, col: [1, 0.8, 0.4], li: 99999, acc: 0, ph: 0 });
      }
      // 床の様子：火・灰・穴・橋・液体・藻・飾り・暗がり・表面・薄い氷・紋様・踏み分けた所
      blaze.fire = new Float32Array(NCELL);
      blaze.burnt = new Uint8Array(NCELL);
      blaze.cellFlag = new Uint8Array(NCELL);
      const floorLook = [];
      for (let k = 0; k < 24; k++) {
        const i = chance(0.5) ? pick(floors) : cellNear(px, pz, 20);
        if (D.tile[i] !== TF) continue;
        floorLook.push(i);
        const w = Math.floor(r() * 16);
        D.liquid[i] = pick(LIQUIDS);
        D.surface[i] = pick(SURFACES);
        D.bridge[i] = w === 0 ? 1 : w === 1 ? 2 : 0;
        if (w === 2) blaze.fire[i] = r() * 0.3;
        if (w === 3) blaze.burnt[i] = 1;
        if (w === 4 && D.pit) D.pit[i] = 1;
        D.algae[i] = chance(0.3) ? 1 : 0;
        D.darkMul[i] = chance(0.08) ? r() * 0.5 : 1;
        D.thin[i] = chance(0.25) ? 1 : 0;
        D.glyph[i] = chance(0.1) ? 1 : 0;
        blaze.cellFlag[i] = chance(0.3) ? 20 : 0;
        if (chance(0.08))
          D.decoCell.set(i, {
            ch: pick(['&', '+', '=', '%', '[', '?']),
            col: [r(), r(), r()],
            ...(chance(0.4) ? { k: pick(['table', 'anvil', 'colossus', 'carpet', 'blood', 'nope']) } : {}),
          });
        if (chance(0.05)) D.gas[i] = r();
      }
      // 崩れた穴（裂け目のマスの上）
      const chasms = [];
      for (let i = 0; i < NCELL; i++) if (D.tile[i] === TC) chasms.push(i);
      if (D.pit) for (const i of chasms) if (chance(0.3)) D.pit[i] = 1;
      // 生き物：全部の種類から、いろいろな状態で
      here.monsters = [];
      const mon = ([key, ty], x, z) => {
        Math.random = mulberry32(s * 31 + here.monsters.length);
        const form = buildForm(ty);
        Math.random = () => (mrN++, mrSrc());
        const m = {
          // 鍵 'final'（王の影）は、王の影の二つの形だけが持つ（頭の上の ! の高さを、形ごとの表 MARK_H から引く）
          key: key === 'final' || ((ty.form === 'shadowking' || ty.form === 'shadowserpent') && chance(0.5)) ? 'final' : key,
          ty,
          x,
          z,
          y: ty.form === 'eel' && chance(0.5) ? -0.6 : chance(0.7) ? 0 : r() * 2,
          yaw: r() * 6.28,
          ph: r() * 100,
          walk: r() * 10,
          moving: pick([0, 0.2, 0.35, 1, r()]),
          glow: chance(0.8) ? 1 : r() * 2,
          form,
          g: chance(0.3) ? 7 : -1,
          dead: chance(0.08),
          visible: chance(0.85),
          sleep: chance(0.3),
          noticed: chance(0.4),
          aware: chance(0.8) ? r() : undefined,
          alert: chance(0.9) ? r() : undefined,
          surf: chance(0.8) ? r() : undefined,
        };
        if (chance(0.3)) m.wasSleep = chance(0.5);
        if (chance(0.15)) m.hitT = r() * 0.3;
        if (chance(0.15)) m.wind = pick([0, 0.3]);
        if (chance(0.05)) m.drawHide = true;
        if (chance(0.2)) m.flinchUntil = clock.time + (chance(0.5) ? r() * 0.3 : -0.1);
        if (chance(0.06)) m.hidden = true;
        if (chance(0.15)) m.elite = true;
        if (chance(0.5)) {
          m.maxHp = 100;
          m.hp = pick([100, 90, 40, 10, 0]);
        }
        if (chance(0.5)) m.heartOn = chance(0.5);
        if (chance(0.5)) m.rise = r();
        if (chance(0.3)) m.flee = r() * 2 - 0.5;
        if (ty.conj) m.blades = [0, 1, 2].map((k) => ({ a: k * 2.094, x: x + r() * 2, y: 1.5, z: z + r() * 2 }));
        if (chance(0.08)) m.morph = { from: form.slice(0, Math.max(1, Math.floor(r() * form.length))), t0: clock.time - r() * 3, dur: 1 };
        // 眠っている竜と獣が、変身を終えたところ（今描く姿が、ふだんの姿になる）
        if ((ty.beast || ty.form === 'dragon') && chance(0.2))
          Object.assign(m, { sleep: true, morph: { from: form.slice(0, 1), t0: clock.time - 5, dur: 1 } });
        here.monsters.push(m);
        return m;
      };
      clock.time = 50 + r() * 200;
      const n = 6 + Math.floor(r() * 6);
      for (let k = 0; k < n; k++) {
        const list = pick([types, types, types, conj, deep, shadow, dragons, inv, eels, odd3]),
          d = pick([1, 3, 5, 8, 15, 25, 27, 29, 31, 40, 43, 45, r() * 50]),
          a = r() * 6.28;
        if (list.length) mon(pick(list), px + Math.cos(a) * d, pz + Math.sin(a) * d);
      }
      ui.aimMon = chance(0.4) && here.monsters.length ? pick(here.monsters) : null;
      // 手と詠唱（手元の灯りの色）・体のルーン（手元の灯りの大きさ）
      const hand = () => ({
        atk: null,
        slots: [],
        slotN: 0,
        turn: 0,
        trig: null,
        elem: chance(0.6) ? { uid: 1, type: pick(RUNE_TYPES.elem) } : null,
      });
      gear.hands = chance(0.9)
        ? {
            L: hand(),
            R: hand(),
            B: { b0: chance(0.6) ? { uid: 2, type: pick(['lamp', 'swift']) } : null, b1: chance(0.5) ? { uid: 3, type: 'lamp' } : null },
          }
        : null;
      gear.castSt = chance(0.5)
        ? {
            h: pick(['L', 'R']),
            t: r() * 2,
            need: pick([0, 1, 1.5]),
            full: chance(0.4),
            hold: 0,
            beam: false,
            firing: false,
            tick: 0,
            beamT: 0,
          }
        : null;
      lantern.r = 6 + r() * 4;
      lantern.k = r() * 1.5;
      vfx.zapFlash = chance(0.4)
        ? null
        : { x: px, y: 1, z: pz, col: [r(), r(), r()], t: pick([999, 0, -0.1, r()]), r: chance(0.5) ? 8 : 0 };
      blaze.spark = chance(0.3) ? { x: px + r() * 4, y: 1 + r(), z: pz + r() * 4, vx: 0, vy: 0, vz: 0, t: 0 } : null;
      // カメラ（TypeScript が読む位置だけ）と、見た時の説明を出す所
      gfx.camera = { position: { x: px, y: 1.6, z: pz } };
      const lookEl = { innerHTML: '' };
      ui.lookEl = lookEl;
      Object.assign(ui, {
        started: chance(0.95),
        lookPend: '',
        lookPendT: 0,
        lookHTML: chance(0.1) ? 'old' : '',
        camMode: chance(0.3) ? 'tps' : 'fps',
      });
      if (chance(0.05)) here.trans = { phase: 'out', t: 0, regen: false };
      Object.assign(player, { x: px, z: pz, eye: 1.62, yaw: r() * 6.28, pitch: (r() - 0.5) * 2 });
      SND.on = chance(0.8);
      alog.length = 0;
      msgs.length = 0;
      buf.pN = chance(0.05) ? 9990 : 0;
      gfx.drawBodyOnly = chance(0.15);
      // 見る：目（カメラ）を、物から距離 d の所に置き、その物へ向ける
      const aimAt = (tx, ty, tz, d) => {
        const a = r() * 6.28,
          up = (r() - 0.5) * 0.8,
          ex = tx + Math.cos(a) * d,
          ez = tz + Math.sin(a) * d,
          ey = Math.max(0.3, ty + up * d);
        gfx.camera.position = { x: ex, y: ey, z: ez };
        const dx = tx - ex,
          dy = ty - ey,
          dz = tz - ez,
          l = Math.hypot(dx, dy, dz) || 1;
        player.yaw = Math.atan2(-dx, -dz);
        player.pitch = Math.asin(dy / l);
        if (chance(0.5)) Object.assign(player, { x: ex, z: ez });
      };
      const targets = () => {
        const k = chance(0.2) ? 9 : Math.floor(r() * 14);
        if (k === 0 && here.monsters.length) {
          // 半分は、説明の分かれる生き物（化けた巻物・小さな生き物・穏やかな生き物・傷ついた物・忘れられた獣）から
          const odd4 = here.monsters.filter(
              (o) => o.visible && (o.hidden || o.ty.critter || o.ty.peaceful || o.ty.beast || o.hp < o.maxHp),
            ),
            m = odd4.length && chance(0.5) ? pick(odd4) : pick(here.monsters);
          return [m.x, (m.y || 0) + 0.9 * m.ty.scale, m.z, chance(0.5) ? 2 + r() * 3 : r() * 12];
        }
        if (k === 1 && here.fixtures.length) {
          // 半分は、説明の分かれる備品（遺品・支道の入口・異界の門・階段・たいまつ）から
          const odd2 = here.fixtures.filter((f) => ['relic', 'bstairs', 'portal', 'stairs', 'torch'].includes(f.type)),
            f = odd2.length && chance(0.5) ? pick(odd2) : pick(here.fixtures);
          return [
            f.type === 'torch' ? (f.wx ?? f.x) : f.x,
            f.type === 'torch' ? 2 : 1.2,
            f.type === 'torch' ? (f.wz ?? f.z) : f.z,
            1 + r() * 6,
          ];
        }
        if (k === 2 && D.doors.length) {
          const dd = pick(D.doors);
          if (chance(0.3)) dd.gone = true;
          else if (chance(0.5)) dd.o = r();
          return [dd.bx, dd.gone ? 0.4 : 1.4, dd.bz, 1 + r() * 5];
        }
        if (k === 3 && D.webs.length) {
          const w = pick(D.webs);
          if (chance(0.2)) w.gone = !w.gone;
          const [x, z] = cpos(w.i);
          return [x, 1.3, z, 1 + r() * 5];
        }
        if (k === 4 && D.traps.length) {
          const tr = pick(D.traps),
            [x, z] = cpos(tr.i);
          return [x, 0.15, z, 1 + r() * 4];
        }
        if (k === 5 && D.items.length) {
          // 半分は、番人のいる祭壇から（番人の群れ 7 の生き物がいる間は、眠っている）
          const guarded = D.items.filter((o) => o.guardG !== undefined),
            it = guarded.length && chance(0.5) ? pick(guarded) : pick(D.items),
            [x, z] = cpos(it.i);
          return [x, 0.55, z, 1 + r() * 4];
        }
        if (k === 6 && D.gate) {
          const g = D.gate,
            [x, z] = cpos(chance(0.5) ? g.cell : g.lever);
          return [x + (chance(0.5) ? 0 : g.ld[0] * 0.9), 1.4, z + (chance(0.5) ? 0 : g.ld[1] * 0.9), 1 + r() * 5];
        }
        if (k === 7 && D.engr.size) {
          // 壁の彫刻：手前のマスの真ん中から、壁の方を見る
          const key = pick([...D.engr.keys()]),
            prev = key >> 2,
            dir = [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ][key & 3],
            [x, z] = cpos(prev);
          gfx.camera.position = { x: x - dir[0] * 0.3, y: 1.4 + r() * 0.6, z: z - dir[1] * 0.3 };
          player.yaw = Math.atan2(-dir[0], -dir[1]);
          player.pitch = (r() - 0.5) * 0.3;
          return null;
        }
        if (k === 8 && walls.length) {
          // 壁（鉱脈・岩肌・松明）：隣の床のマスから
          const w = pick(walls),
            nb = D4.find(([dx, dz]) => D.tile[w + dx + dz * MW] === TF) || [1, 0],
            [x, z] = cpos(w + nb[0] + nb[1] * MW),
            [wx, wz] = cpos(w);
          return [wx, 1 + r(), wz, Math.hypot(wx - x, wz - z) * (0.6 + r() * 0.6)];
        }
        if (k === 9 && floorLook.length) {
          // 床：真上近くから見下ろす
          const i = pick(floorLook),
            [x, z] = cpos(i);
          gfx.camera.position = { x: x + (r() - 0.5) * 0.4, y: 0.8 + r() * 1.5, z: z + (r() - 0.5) * 0.4 };
          player.yaw = r() * 6.28;
          player.pitch = -1.5 + r() * 0.05;
          return null;
        }
        if (k === 10) {
          // 天井：見上げる
          const i = pick(floors),
            [x, z] = cpos(i);
          gfx.camera.position = { x, y: 1.6, z };
          player.yaw = r() * 6.28;
          player.pitch = 1.5;
          return null;
        }
        if (k === 11) {
          // 結晶・柱・飾り（当たり判定のある物）
          const cand = [];
          for (let i = 0; i < NCELL; i += 1 + Math.floor(r() * 4)) if (D.tile[i] === TX || D.tile[i] === TP || D.solid.has(i)) cand.push(i);
          if (cand.length) {
            const i = pick(cand),
              [x, z] = cpos(i);
            if (chance(0.3)) D.xtalCol.delete(i);
            return [x, 1.2, z, 1 + r() * 4];
          }
        }
        if (k === 12 && chasms.length) {
          const i = pick(chasms),
            [x, z] = cpos(i);
          gfx.camera.position = { x, y: 0.5 + r(), z };
          player.yaw = r() * 6.28;
          player.pitch = -1.5;
          return null;
        }
        return [px + (r() - 0.5) * 20, r() * 3, pz + (r() - 0.5) * 20, r() * 10];
      };
      const tm = () => [clock.time];
      // 描く生き物：階にいる物か、全部の種類から選んだ新しい物（プレイヤーのそば。小さな生き物は 30 より遠いと描かないので）
      const someMon = () => {
        if (chance(0.4)) {
          const a = r() * 6.28,
            d = r() * 28;
          return mon(pick(chance(0.3) ? rare : types), player.x + Math.cos(a) * d, player.z + Math.sin(a) * d);
        }
        return here.monsters.length ? pick(here.monsters) : null;
      };
      const ops = [
        ['drawMonster', () => [someMon(), clock.time], 2],
        ['drawMonster', () => [someMon(), clock.time]],
        ['drawMonster1', () => [someMon(), clock.time]],
        ['drawMonster0', () => [someMon(), clock.time]],
        ['drawTentacles', () => [someMon(), clock.time]],
        ['drawTraps', tm],
        ['look', () => [], 1, true],
        ['look', () => [], 2, true],
        ['look', () => [], 2, true],
        ['look', () => [], 2, true],
        [
          'flicker',
          () => [
            D.lights.length && chance(0.8) ? pick(D.lights) : { type: pick(LIGHT_TYPES), ph: r() * 6, active: chance(0.5) },
            clock.time,
          ],
        ],
        ['updateLights', tm],
        ['headPos', () => []],
        ['aimOrigin', () => []],
        ['viewDir', () => []],
        ['hittable', () => [someMon() || { ty: {} }]],
        ['handUp', () => []],
        ['aimPoint', () => []],
        ['centerPoint', () => []],
        ['castPoint', () => [pick(['L', 'R']), pick([-0.5, 0, 0.3, 1, 2])]],
        ['handPoint', () => [pick(['L', 'R'])]],
        ['drawSwing', () => []],
      ];
      const calls = [];
      /** name の関数を、引数 a で times 回呼び、記録を足す（2回目からは、少し時刻を進める） */
      const run = (name, a, times = 1, noArrays = false) => {
        // 巣・罠・床の物の配列が無い階（古い階の形。|| [] の所を通す）
        const bare =
          (name === 'look' || name === 'drawTraps') && (noArrays || chance(0.05)) ? { webs: D.webs, traps: D.traps, items: D.items } : null;
        if (bare) Object.assign(D, { webs: undefined, traps: undefined, items: undefined });
        buf.dn = 0;
        const pN0 = buf.pN,
          mr0 = mrN,
          snd0 = sndN,
          al0 = alog.length,
          ms0 = msgs.length;
        let ret,
          threw = false;
        try {
          for (let t = 0; t < times; t++) {
            // 2回目は、少し時刻を進める（見た時の説明は、同じ物を0.5秒見続けると出る）
            if (t > 0) clock.time += pick([0.3, 0.6]);
            ret = F[name](...a);
          }
        } catch (e) {
          // 止まったかだけを記録する（新しい方は、表に無い物を読んだ所で RangeError で止まる。元は、その先で TypeError で止まる）
          threw = e instanceof Error;
        }
        if (bare) Object.assign(D, bare);
        const m = a[0] && typeof a[0] === 'object' && 'form' in a[0] ? a[0] : null;
        calls.push({
          name,
          ret: text(ret),
          threw,
          dn: buf.dn,
          dyn: buf.dn ? [hashArr(dPos, 0, buf.dn * 3), hashArr(dCol, 0, buf.dn * 3), hashArr(dPar, 0, buf.dn * 4)] : [],
          pN: buf.pN - pN0,
          pts: buf.pN > pN0 ? Object.values(P).map((A) => hashArr(A, pN0, buf.pN)) : [],
          mr: mrN - mr0,
          sndRand: sndN - snd0,
          snd: fnv(text(alog.slice(al0))),
          msg: msgs.slice(ms0).map((x) => x.html),
          // 見た時の説明と照準の先の生き物
          look: name === 'look' ? [lookEl.innerHTML, ui.lookHTML, ui.lookPend, ui.lookPendT, here.monsters.indexOf(ui.aimMon)] : null,
          // 灯りの配列
          lights:
            name === 'updateLights'
              ? [hashArr(SL, 0, SL.length), hashArr(DLP, 0, DLP.length), hashArr(DLC, 0, DLC.length), D.lights.map((L) => L.f)]
              : null,
          // 描いた生き物の状態（眠っている姿・前に眠っていたか・今描く姿・姿を変える途中・明るさ）
          mon: m
            ? text([
                m.formSleep,
                m.wasSleep,
                m.drawForm === undefined ? 'u' : m.drawForm === null ? 'n' : m.drawForm === m.formSleep ? 'sleep' : 'other',
                m.morph,
                m.glow,
                m.mark,
              ])
            : null,
          // 場合が中身を通っているかを数えるための、描いた生き物の形の部位と、揺らぎを調べた灯りの種類（数えるだけで、指紋には入れない）
          parts: m && buf.dn ? [...new Set((m.drawForm || m.form).map((p) => p.part))] : [],
          light: name === 'flicker' ? a[0].type : null,
        });
      };
      for (let k = 0; k < 40; k++) {
        clock.time += pick([0, 0.2, 0.3, 0.6, r() * 3]);
        // プレイヤーの様子（転がり・振り・網）は呼ぶたびに変える
        player.roll = chance(0.3) ? { t: r() * 0.32, dx: 1, dz: 0 } : chance(0.5) ? null : undefined;
        player.swing = chance(0.6) ? pick([0, 0.22, r() * 0.22, -0.1]) : undefined;
        player.swingWave = chance(0.2);
        player.swingCol = chance(0.5) ? [r(), r(), r()] : undefined;
        player.netT = chance(0.3) ? pick([0, r() * 3]) : undefined;
        if (chance(0.2)) ui.camMode = ui.camMode === 'tps' ? 'fps' : 'tps';
        const [name, args, times = 1, aims = false] = pick(ops);
        if (aims || chance(0.3)) {
          const tg = targets();
          if (tg) aimAt(...tg);
        }
        // 真上より後ろを向いた時（見ている向きの上が、下を向く）
        if (chance(0.05)) player.pitch = pick([2, -2]);
        run(name, args(), times);
      }
      // 場面：説明と描き方の細かい分かれ道を、毎回1つずつ通す（ランダムな狙い方だけでは、場合の並びで出たり出なかったりするので）
      const scene = SCENES[(s - 1) % SCENES.length],
        // その場面を通るのが何回目か（場面の中の分かれ道を、乱数によらず順に通す）
        visit = Math.floor((s - 1) / SCENES.length);
      const near = (d) => {
        const a = r() * 6.28;
        return [player.x + Math.cos(a) * d, player.z + Math.sin(a) * d];
      };
      const floorAt = (pred) =>
        floors.find((i) => pred(i) && Math.hypot(cpos(i)[0] - player.x, cpos(i)[1] - player.z) < 25) ?? pick(floors);
      ui.started = true;
      here.trans = null;
      if (scene === 'spring') {
        const i = floorAt(() => chance(0.1)),
          [x, z] = cpos(i);
        D.items.push({ i, kind: 'spring', taken: chance(0.5) });
        aimAt(x, 0.55, z, 1.5);
        run('look', [], 2);
      } else if (scene === 'vault') {
        const i = floorAt(() => chance(0.1)),
          [x, z] = cpos(i);
        D.items.push({
          i,
          kind: 'rune',
          taken: false,
          vault: true,
          ev: pick(['guard', 'collapse']),
          rune: { uid: 5, type: pick(RUNE_TYPES.atk) },
        });
        aimAt(x, 0.55, z, 1.5);
        run('look', [], 2);
      } else if (scene === 'grave') {
        const i = floorAt(() => chance(0.1)),
          [x, z] = cpos(i);
        D.items.push({
          i,
          kind: 'grave',
          taken: false,
          g: chance(0.7) ? { k: 'x', depth: Math.floor(r() * 12), cause: chance(0.6) ? '大蛇' : '', item: null } : undefined,
          rune: { uid: 6, type: pick(RUNE_TYPES.atk) },
        });
        aimAt(x, 0.55, z, 1.5);
        run('look', [], 2);
      } else if (scene === 'peaceful' || scene === 'hidden' || scene === 'critter') {
        const list = types.filter(([, ty]) =>
          scene === 'peaceful' ? ty.peaceful && !ty.critter : scene === 'critter' ? ty.critter : !ty.invisible,
        );
        const [x, z] = near(3),
          m = mon(pick(list), x, z);
        Object.assign(m, { visible: true, dead: false, hidden: scene === 'hidden', hp: undefined, maxHp: undefined, y: 0 });
        aimAt(m.x, 0.9 * m.ty.scale, m.z, 2.5);
        run('look', [], 2);
        run('drawMonster', [m, clock.time]);
      } else if (scene === 'relic') {
        // 鉄格子の奥の部屋の遺品（年代記の王の物）。床のある部屋が無い階では、この場面を飛ばす
        const rooms = D.rooms.filter((ro) => ro.cells.length);
        if (rooms.length) {
          const room = pick(rooms),
            c = pick(room.cells),
            [x, z] = cpos(c);
          room.kindMsg = '鉄格子の奥に、何かが光っている';
          D.gate = D.gate || { cell: c, lever: c, ld: [1, 0], open: false, o: 1, axis: 0 };
          D.gate.heir = chance(0.8) ? '王の冠' : undefined;
          here.fixtures.push({ type: 'relic', x, z, col: [1, 0.8, 0.4], li: 99999, acc: 0, ph: 0 });
          Object.assign(player, { x: x + 3, z });
          aimAt(x, 1.2, z, 2);
          run('look', [], 2);
        }
      } else if (scene === 'gate') {
        // 鉄格子（奥に宝が残っていない時も）
        if (!D.gate) D.gate = { cell: c0, lever: c0, ld: [1, 0], open: false, o: 0, axis: 0 };
        D.gate.o = 0;
        if (chance(0.5)) for (const it of D.items) if (it.vault) it.taken = true;
        const [x, z] = cpos(D.gate.cell);
        aimAt(x, 1.4, z, 2);
        run('look', [], 2, chance(0.3));
        run('drawTraps', [clock.time]);
      } else if (scene === 'omen') {
        // 下り階段から漏れる物（支道の奥・特別な階・層の変わり目）
        D.stairGuard = undefined;
        const st = pick([
          { kind: 'branch', key: pick(Object.keys(BRANCHES)), strong: chance(0.5) },
          { kind: 'special', key: pick(Object.keys(SPECIALS)) },
          { kind: 'stratum', key: pick(Object.keys(STRATUM_OMEN)) },
        ]);
        D.omen = { stairs: st, branch: null, portal: null, traces: [], sndT: {} };
        const [x, z] = cpos(D.stairs >= 0 ? D.stairs : c0);
        if (!here.fixtures.some((f) => f.type === 'stairs'))
          here.fixtures.push({ type: 'stairs', x, z, col: [1, 1, 1], li: 99999, acc: 0, ph: 0 });
        const f = here.fixtures.find((g) => g.type === 'stairs');
        aimAt(f.x, 1.3, f.z, 2);
        run('look', [], 2);
      } else if (scene === 'tomb') {
        // 王の墓（飾りの当たりのあるマスで、マスの番号が3で割り切れる所）と、民の墓・巨像・名前の無い飾り（祭壇）
        const v = ['ruler', 'civ', 'colossus', 'plain'][visit % 4],
          i = floorAt((j) => j % 3 === (v === 'civ' ? 1 : 0)),
          [x, z] = cpos(i);
        D.solid.set(i, 0.5);
        D.decoCell.set(
          i,
          v === 'colossus' ? { ch: '&', col: [0.8, 0.8, 0.9], k: 'colossus' } : { ch: v === 'plain' ? '?' : '+', col: [0.8, 0.8, 0.9] },
        );
        aimAt(x, 1, z, 2);
        run('look', [], 2);
      } else if (scene === 'halo') {
        // 王の影の黒い太陽を、真上から見る（目と体の床の上の距離が 0 の時は、体の前の面に置く）
        const sh = types.filter(([k, ty]) => k === 'final' || ty.form === 'shadowking'),
          [x, z] = near(4),
          m = mon(pick(sh), x, z);
        gfx.camera.position = { x: m.x, y: 8, z: m.z };
        run('drawMonster0', [m, clock.time]);
      } else if (scene === 'phantom') {
        // 見えない生き物（6 より近い時だけ、空気の揺らぎとして見える）
        const [x, z] = near(2),
          m = mon(pick(inv.length ? inv : types), x, z);
        Object.assign(m, { dead: false, y: 0 });
        aimAt(m.x, 1.1, m.z, 2);
        Object.assign(player, { x: gfx.camera.position.x, z: gfx.camera.position.z });
        run('look', [], 2);
      } else if (scene === 'floor' || scene === 'trampled') {
        // 床の表面（ほかの物の無い床）。trampled は、踏み分けた茂みと茸の森を交互に
        const i = floorAt(() => chance(0.1)),
          [x, z] = cpos(i);
        blaze.fire[i] = 0;
        blaze.burnt[i] = 0;
        if (D.pit) D.pit[i] = 0;
        D.bridge[i] = 0;
        D.liquid[i] = 0;
        D.decoCell.delete(i);
        D.darkMul[i] = 1;
        D.glyph[i] = 0;
        D.surface[i] = scene === 'trampled' ? [SF_FOLIAGE, SF_FUNGFOR][visit % 2] : pick(SURFACES);
        D.thin[i] = chance(0.5) ? 1 : 0;
        blaze.cellFlag[i] = scene === 'trampled' || chance(0.5) ? 20 : 0;
        gfx.camera.position = { x, y: 1.2, z };
        player.pitch = -1.55;
        run('look', [], 2);
      } else if (scene === 'start') {
        // 探索が始まる前（タイトルの画面）と、階を移る途中は、出している説明を消す
        ui.started = chance(0.5);
        if (ui.started) here.trans = { phase: 'in', t: 0, regen: false };
        ui.lookHTML = chance(0.7) ? 'old' : '';
        lookEl.innerHTML = ui.lookHTML;
        run('look', []);
      } else if (scene === 'gates') {
        // 異界の門と、封じられた下り階段を交互に（封の番人は見えない所に置き、説明の的にしない）
        const kind = visit % 2 ? 'stairs' : 'portal';
        if (kind === 'portal') D.portal = D.portal || { key: pick(Object.keys(REALMS)), cell: c0 };
        else {
          D.stairGuard = 7;
          const [x, z] = near(8);
          Object.assign(mon(pick(types.filter(([, ty]) => !ty.invisible)), x, z), { g: 7, dead: false, visible: false });
        }
        const [x, z] = cpos(kind === 'portal' ? D.portal.cell : D.stairs >= 0 ? D.stairs : c0);
        if (!here.fixtures.some((f) => f.type === kind)) here.fixtures.push({ type: kind, x, z, col: [1, 1, 1], li: 99999, acc: 0, ph: 0 });
        const f = here.fixtures.find((g) => g.type === kind);
        aimAt(f.x, 1.3, f.z, 2);
        run('look', [], 2);
      } else if (scene === 'tongue') {
        // 舌を出し入れする生き物を、時刻を変えて何度か描く（舌は、出ている間だけ描く）
        const list = types.filter((_, i) => partsOf[i]?.has('tongue')),
          [x, z] = near(3),
          m = mon(pick(list.length ? list : types), x, z);
        Object.assign(m, { dead: false, hidden: false });
        for (let k = 0; k < 4; k++) {
          clock.time += 0.7;
          run('drawMonster0', [m, clock.time]);
        }
      }
      out.push({ s, place, calls });
    }
  } finally {
    for (const [k, fields] of keptTypes)
      for (const [f, d] of fields) {
        const t = MTYPES[k];
        if (!t) continue;
        if (d) Object.defineProperty(t, f, d);
        else Reflect.deleteProperty(t, f);
      }
    restoreGlobals();
    Math.random = keep.random;
    setSoundRand(keep.sound);
    restore(here, keep.here);
    Object.assign(adv, keep.adv);
    restore(player, keep.player);
    restore(ui, keep.ui);
    restore(vfx, keep.vfx);
    restore(blaze, keep.blaze);
    restore(gear, keep.gear);
    restore(gfx, keep.gfx);
    restore(lantern, keep.lantern);
    restore(SND, keep.SND);
    restore(buf, keep.buf);
    clock.time = keep.time;
    msgs.splice(0, msgs.length, ...keep.msgs);
    if (keep.lord) MTYPES['lord'] = keep.lord;
    else delete MTYPES['lord'];
    if (keep.X) MTYPES['X'] = keep.X;
    else delete MTYPES['X'];
  }
  return out;
}
/** 場合の記録を、指紋を取る1つの文字列にする（数えるためだけの parts は除く） */
export const viewText = (all) =>
  all.map(({ s, place, calls }) => text({ s, place, calls: calls.map(({ parts: _p, light: _l, ...c }) => c) })).join('\n');
