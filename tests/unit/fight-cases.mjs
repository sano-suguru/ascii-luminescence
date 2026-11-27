// テストの道具：詠唱と当たり（src/lib/combat.ts）・照準と線（aim.ts の doorBlock など）・術の中身（gear.ts の specOf・resetRunes・applyOpen）・術の音（audio.ts の castSound）・
// 結果の画面（results.ts）・プレイヤーの動き（player.ts）・生き物の動き（monsters.ts の updateMonster）を、たくさんの場合で呼び、結果を1つの文字列にまとめる。
// F は関数をまとめた物。fight.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の全部の場所）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、本物の階に、表の全部の種類の生き物をいろいろな状態で置き、両手の武器と枠（性質・効き方・発動）と特性と加護をシードの乱数で選んで、
// 武器の種類ごとの詠唱・当たり・反応・ダメージ・プレイヤーの傷・生き物とプレイヤーの動きを、決まった「場面」と乱数の両方で呼ぶ。
// 遅れて起きること（fight.laters・fight.zapQueue）と setTimeout は、ゲームの時計を進めながら、ここで流す（ゲームでは古い JS の毎フレームの処理が流す）。
// 返す値と、呼ぶたびの状態（プレイヤー・生き物・飛ぶ物などの戦いの状態・火と地面のマス・粒子・伝言・画面の部品・音の記録・保存した物）と、
// 見た目の乱数と音の乱数を引いた数を記録する。テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio を、本物の型に合わせられないため。
// 書き換えた状態と、document・window・localStorage・performance・setTimeout・Math.random・音の乱数は、終わったら元に戻す。
import { sndInit } from '../../src/lib/audio.ts';
import { addLooks } from '../../src/lib/bodies/build.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { makeRune } from '../../src/lib/gear.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { makeBeastType } from '../../src/lib/bodies/lords.ts';
import { DEBRIS_MAX } from '../../src/lib/debris.ts';
import { makeMonster } from '../../src/lib/monsters.ts';
import { P } from '../../src/lib/particles.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES, TRAITS } from '../../src/lib/runes.ts';
import {
  SND,
  adv,
  beamHold,
  blaze,
  buf,
  clock,
  edge,
  fight,
  gear,
  gfx,
  here,
  keys,
  msgs,
  player,
  saved,
  stealth,
  ui,
  vfx,
  vmKick,
} from '../../src/lib/state.ts';
import {
  CELL,
  D4,
  LQ_BOG,
  LQ_DEEP,
  LQ_LAVA,
  LQ_WATER,
  MW,
  NCELL,
  SF_BRIM,
  SF_ICE,
  SF_MUD,
  TC,
  TF,
  TP,
  TX,
  cpos,
} from '../../src/lib/world.ts';
import { fakeAudioClass } from './fake-audio.mjs';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';
import { stateFp } from './case-out.mjs';

/** 移した関数の名前（場合が全部を呼ぶか、fight.test.mjs が確かめる） */
export const NAMES = [
  'castNow',
  'meleeCast',
  'dashCast',
  'dashCuts',
  'castStar',
  'castRapid',
  'startRain',
  'fireWave',
  'fireBeam',
  'orbBurst',
  'burstFire',
  'boom',
  'applyHit',
  'applyElem',
  'react',
  'chainLightning',
  'conductWater',
  'landElem',
  'onKilledBy',
  'onDodged',
  'damageMonster',
  'hurtPlayer',
  'monsterStrike',
  'hitFeedback',
  'hitReact',
  'rallyOnHit',
  'dropRune',
  'lordFell',
  'gainExp',
  'coldSnap',
  'nearestFoe',
  'zapLine',
  'inWater',
  'later',
  'addZone',
  'doorBlock',
  'losClear',
  'groundPoint',
  'reflectDir',
  'aimTarget',
  'assistPoint',
  'shotFrame',
  'beamFrame',
  'specOf',
  'resetRunes',
  'applyOpen',
  'castSound',
  'resultPlace',
  'runLore',
  'awardLore',
  'loreRows',
  'graveCandidates',
  'saveGrave',
  'graveRows',
  'victory',
  'solidAt',
  'updatePlayer',
  'updateMonster',
];
/** 関数に覚えさせる欄（場合ごとに消す） */
const FN_FIELDS = [
  ['boom', 'last'],
  ['hurtPlayer', 'mt'],
  ['hurtPlayer', 'mc'],
  ['monsterStrike', 'mt'],
  ['updatePlayer', 'sealT'],
];
const ELEMS = [null, ...RUNE_TYPES.elem];
const BLESS_KEYS = [
  'charge',
  'counter',
  'quickdodge',
  'swapedge',
  'reckless',
  'momentum',
  'kindle',
  'scorch',
  'branch',
  'devour',
  'shatter',
];
const SUBS = ['gsweep', 'gwave', 'bpower', 'rshot', 'mshot', 'mmoon'];

/** Float32Array に NaN を入れた時の並び（Float32Array の NaN を、指紋ではこれにそろえる） */
const NAN32 = new Uint32Array(new Float32Array([NaN]).buffer)[0] ?? 0;
/**
 * 配列の中身の指紋（NaN は1つの並びにそろえる。level・pickup・step の場合も使う）。
 * FNV-1a の形で、4バイトを1つの数として混ぜる（1バイトずつ混ぜると、掛け算が前の結果を待つので、大きな配列で遅い）。
 * 掛け算は上の桁へしか伝わらないので、混ぜるたびに上の桁を下へ戻す（戻さないと、2つの数の一番上の桁（Float32 の符号）が
 * どちらも変わった時に打ち消し合い、指紋が変わらない）。混ぜる1歩はどれも元に戻せる変換なので、どこか1つの数が変われば、
 * 指紋は必ず変わる。4バイトに足りない終わりは1バイトずつ混ぜる
 */
const hashArr0 = (a, from = 0, to = a.length) => {
  // 配列は写さずに読む（Float64Array に NaN がある時と、4バイトの区切りに揃っていない時だけ写す。呼ぶ数が多く、写すとテストの時間の多くを占めるため）
  a = a.subarray(from, Math.max(from, to));
  if (a instanceof Float64Array)
    for (let i = 0; i < a.length; i++)
      if (Number.isNaN(a[i])) {
        a = a.map((x) => (Number.isNaN(x) ? NaN : x));
        break;
      }
  if (a.byteOffset % 4) a = a.slice();
  const n = a.length * a.BYTES_PER_ELEMENT,
    w = new Uint32Array(a.buffer, a.byteOffset, n >>> 2),
    b = new Uint8Array(a.buffer, a.byteOffset, n);
  let h = 0x811c9dc5;
  // Float32Array の NaN は、混ぜながら1つの並びに置き換える（指数が全部1で、仮数が0でない数。NaN を探すために配列をもう一度読まない）
  if (a instanceof Float32Array)
    for (let i = 0; i < w.length; i++) {
      const x = w[i];
      h = Math.imul(h ^ ((x & 0x7f800000) === 0x7f800000 && x & 0x7fffff ? NAN32 : x), 0x01000193);
      h ^= h >>> 15;
    }
  else
    for (let i = 0; i < w.length; i++) {
      h = Math.imul(h ^ w[i], 0x01000193);
      h ^= h >>> 15;
    }
  for (let i = w.length * 4; i < n; i++) h = Math.imul(h ^ b[i], 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/**
 * hashArr0 を、前と同じ中身なら数え直さない（同じ配列・同じ範囲で、前に数えた時の中身の写しとバイトごとに同じなら、前の指紋を返す。
 * 火と地面のマスなどの大きな配列は、呼ぶたびに数えるが、たいてい変わっていないため。比べるのは Buffer の equals で、指紋を数えるより速い）
 */
const lastHash = new WeakMap();
export const hashArr = (a, from = 0, to = a.length) => {
  const v = a.subarray(from, Math.max(from, to)),
    b = Buffer.from(v.buffer, v.byteOffset, v.length * v.BYTES_PER_ELEMENT),
    m = lastHash.get(a);
  if (m && m.from === from && m.to === to && m.copy.equals(b)) return m.h;
  const h = hashArr0(a, from, to);
  lastHash.set(a, { from, to, copy: Buffer.from(b), h });
  return h;
};
export const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** 値を1つの文字列にする（NaN・Infinity・undefined も見分ける。生き物は並びの番号、種類は名前、形は点の指紋、配列の型は指紋、関数は fn） */
export const text = (v) =>
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
              ? { map: [...x] }
              : ArrayBuffer.isView(x)
                ? hashArr(x)
                : k === 'ty' && x && typeof x === 'object'
                  ? (x.name ?? 'ty')
                  : (k === 'form' || k === 'formSleep' || k === 'drawForm') && Array.isArray(x)
                    ? fnv(JSON.stringify(x))
                    : k !== '' && x && typeof x === 'object' && 'ty' in x && 'cx' in x
                      ? `#${here.monsters.indexOf(x)}`
                      : x,
  );
/** 写しから元に戻す（写しに無い欄は消す） */
const restore = (obj, copy) => {
  for (const k of Object.keys(obj)) if (!(k in copy)) delete obj[k];
  Object.assign(obj, copy);
};
/** 偽の画面の部品（したことを log に記録する。id ごとの部品は、innerHTML・classList・onclick・offsetWidth を持つ） */
export function fakeDom() {
  const log = [],
    els = {};
  const classList = (id) => {
    const set = new Set();
    return {
      add: (...c) => (c.forEach((x) => set.add(x)), log.push(['add', id, ...c])),
      remove: (...c) => (c.forEach((x) => set.delete(x)), log.push(['remove', id, ...c])),
      toggle: (c, on) => (on ? set.add(c) : set.delete(c), log.push(['toggle', id, c, on])),
      contains: (c) => set.has(c),
    };
  };
  const el = (id) => {
    let html = '';
    return {
      id,
      dataset: {},
      classList: classList(id),
      get innerHTML() {
        return html;
      },
      set innerHTML(v) {
        html = v;
        log.push(['html', id, fnv(String(v)), String(v).length]);
      },
      get offsetWidth() {
        log.push(['offsetWidth', id]);
        return 0;
      },
      onclick: null,
      querySelectorAll: () => [],
      addEventListener: (t) => log.push(['listen', id, t]),
    };
  };
  const hide = new Set();
  return {
    log,
    els,
    hide,
    reset() {
      log.length = 0;
      hide.clear();
      for (const k of Object.keys(els)) delete els[k];
    },
    document: {
      getElementById: (id) => (hide.has(id) ? null : (els[id] ??= el(id))),
      body: { classList: classList('body') },
      exitPointerLock: () => log.push(['exitPointerLock']),
      createElement: () => ({ innerHTML: '', childNodes: [] }),
    },
  };
}
/** 偽の setTimeout（待たせた物を記録し、flush で時刻の順に流す。流した中で例外が起きたら数える） */
export function fakeTimers() {
  let id = 0;
  const q = new Map(),
    st = { n: 0, threw: 0 };
  return {
    st,
    setTimeout: (fn, ms) => (q.set(++id, { fn, at: (ms || 0) + id * 1e-6 }), st.n++, id),
    clearTimeout: (i) => q.delete(i),
    flush() {
      for (let k = 0; k < 50 && q.size; k++) {
        const all = [...q].sort((a, b) => a[1].at - b[1].at);
        q.clear();
        for (const [, e] of all)
          try {
            e.fn();
          } catch {
            st.threw++;
          }
      }
    },
    clear: () => q.clear(),
  };
}
/** 偽のカメラ（位置と向きを記録する） */
export const fakeCamera = () => {
  const position = { x: 0, y: 0, z: 0, set: (x, y, z) => Object.assign(position, { x, y, z }) },
    rotation = { x: 0, y: 0, z: 0, set: (x, y, z) => Object.assign(rotation, { x, y, z }) };
  return { position, rotation };
};
/** 描画の部品が分け合う値（uniform）の偽物（値の器だけ。Vector3 の代わりに set で数を覚える物） */
export const fakeUniforms = () => {
  const v3 = () => {
    const o = { x: 0, y: 0, z: 0, set: (x, y, z) => Object.assign(o, { x, y, z }) };
    return o;
  };
  const U = {};
  for (const k of ['uCollT', 'uTime', 'uCut', 'uFogDen', 'uScale', 'uAmb']) U[k] = { value: 0 };
  U.uCamP = { value: v3() };
  U.uCutP = { value: v3() };
  U.uFogColor = { value: v3() };
  return U;
};

/** seeds：場合の数。page：fakeDom() の偽の画面。返り値は、場合ごとの記録（呼んだ関数ごとの記録 calls） */
export async function fightCases(F, seeds, page) {
  const env = await loadEnv(),
    out = [];
  const keep = {
    here: { ...here },
    adv: { ...adv },
    player: { ...player },
    ui: { ...ui },
    vfx: { ...vfx },
    blaze: { ...blaze },
    fight: { ...fight },
    stealth: { ...stealth },
    SND: { ...SND },
    buf: { ...buf },
    gear: { ...gear },
    gfx: { ...gfx },
    edge: { ...edge },
    vmKick: { ...vmKick },
    beamHold: JSON.parse(JSON.stringify(beamHold)),
    keys: { ...keys },
    saved: { ...saved, BOOK: saved.BOOK, META: saved.META },
    time: clock.time,
    lord: MTYPES['lord'],
    X: MTYPES['X'],
    random: Math.random,
    sound: setSoundRand(Math.random),
    msgs: [...msgs],
  };
  const LOOK_FIELDS = ['look', 'form', 'trail', 'col', 'lcol'],
    keptTypes = Object.entries(MTYPES).map(([k, t]) => [k, LOOK_FIELDS.map((f) => [f, Object.getOwnPropertyDescriptor(t, f)])]);
  addLooks();
  const alog = [],
    stored = [],
    timers = fakeTimers();
  let msgN = 0,
    noStore = false;
  msgs.push = (...a) => (msgN++, Array.prototype.push.apply(msgs, a));
  const restoreGlobals = swapGlobals({
    document: page.document,
    window: { AudioContext: fakeAudioClass(alog, 'running') },
    localStorage: {
      setItem: (k, v) => {
        if (noStore) throw new Error('no storage');
        stored.push([k, v]);
      },
      getItem: () => null,
    },
    performance: { now: () => clock.time * 1000 },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });
  try {
    Math.random = mulberry32(1);
    Object.assign(SND, { ctx: null, master: null, inp: null, wet: null, noise: null, on: true });
    sndInit();
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 48271 + 11),
        pick = (a) => a[Math.floor(r() * a.length)],
        chance = (p) => r() < p;
      let mrN = 0;
      const mrSrc = mulberry32(s * 7919 + 41);
      Math.random = () => (mrN++, mrSrc());
      let sndN = 0;
      const sndSrc = mulberry32(s * 104729 + 43);
      setSoundRand(() => (sndN++, sndSrc()));
      for (const [f, k] of FN_FIELDS) delete F[f][k];
      page.reset();
      timers.clear();
      stored.length = 0;
      alog.length = 0;
      msgs.length = 0;
      const place = pick(PLACES);
      adv.runSeed = (r() * 4294967296) >>> 0;
      Object.assign(here, {
        depth: place.depth,
        branch: place.branch ? { ...place.branch } : null,
        realm: place.realm ? { ...place.realm } : null,
        inter: place.inter ? { ...place.inter } : null,
      });
      const res = gen(env, (r() * 4294967296) >>> 0, place, adv.runSeed);
      if (res.lordType) MTYPES['lord'] = res.lordType;
      if (res.beastType) MTYPES['X'] = res.beastType;
      const D = res.level;
      here.D = D;
      here.fixtures = D.fixtures;
      adv.HIST = makeHistory(adv.runSeed);
      adv.HIST_SEED = adv.runSeed;
      saved.BOOK = new Set(chance(0.5) ? [] : ['steam', 'blast']);
      saved.META = { lore: Math.floor(r() * 200), spent: Math.floor(r() * 50), unl: [], grave: null, trials: [] };
      saved.LEGEND = null;
      saved.DEVALL = chance(0.5);
      adv.runTrials = chance(0.3) ? ['dusk'] : [];
      adv.dead = false;
      adv.won = false;
      adv.PLAYER_MAX = 40 + Math.floor(r() * 3) * 4;
      adv.lvl = { n: 1 + Math.floor(r() * 5), exp: Math.floor(r() * 30), pending: 0, bless: {}, strata: new Set() };
      for (const b of BLESS_KEYS) if (chance(0.35)) adv.lvl.bless[b] = 1 + Math.floor(r() * 2);
      adv.runStats = { kills: 0, t0: 0, maxDepth: here.depth, book0: chance(0.5) ? 0 : 1, beastsNew: Math.floor(r() * 2) };
      adv.runState = { startChosen: true, altar1: true, taken: new Set(), lordsDone: new Set(), bodyOpen: Math.floor(r() * 3) };
      Object.assign(ui, {
        started: true,
        gallery: null,
        godMode: chance(0.1),
        invOpen: false,
        tallMsg: chance(0.3),
        aimT: -9,
        crossMon: null,
        graveCands: [],
        graveSel: 0,
        locked: chance(0.5),
        helpOn: false,
        noticeMsgT: {},
        hintSeq: 0,
      });
      Object.assign(here, { finalSt: null, trans: null, lockCell: -1 });
      clock.time = 20 + r() * 100;
      Object.assign(vfx, { shake: 0, flash: 0, hurtFlash: 0, zapFlash: null });
      buf.pN = 0;
      stealth.sneak = chance(0.3);
      stealth.range = 6 + r() * 10;
      SND.on = true;
      Object.assign(blaze, {
        fire: new Float32Array(NCELL),
        fuel: new Float32Array(NCELL),
        burnt: new Uint8Array(NCELL),
        cellFlag: new Uint8Array(NCELL),
        fireLight: new Float32Array(NCELL),
        scent: new Float32Array(NCELL),
        burning: [],
        frozen: new Map(),
        trampled: [],
        gasAny: false,
        lastBoom: -10,
      });
      Object.assign(fight, {
        projs: [],
        beamSegs: [],
        clouds: [],
        zones: [],
        laters: [],
        rains: [],
        marks: [],
        beamRun: null,
        hitStopUntil: 0,
        hitSrcPoint: null,
        trigCd: { L: 0, R: 0 },
        beamIgT: -9,
        boltFx: [],
        zapQueue: [],
        rallyMotes: [],
        debris: [],
      });
      Object.assign(vmKick, { L: -9, R: -9 });
      for (const h of ['L', 'R']) Object.assign(beamHold[h], { hold: 0, last: -9 });
      Object.assign(edge, { t: 0, k: '', idle: 0, hint: 0 });
      for (const k of Object.keys(keys)) delete keys[k];
      gfx.camera = fakeCamera();
      gfx.U = fakeUniforms();
      gfx.finalPass = { uniforms: { uHeat: { value: 0 } } };
      gfx.cellTex = { needsUpdate: false };
      const floors = [];
      for (let i = 0; i < NCELL; i++) if (D.tile[i] === TF) floors.push(i);
      const c0 = pick(floors),
        [px, pz] = cpos(c0);
      Object.assign(player, {
        x: px,
        z: pz,
        vx: 0,
        vz: 0,
        yaw: r() * 6.28,
        pitch: (r() - 0.5) * 0.6,
        eye: 1.62,
        bob: 0,
        hp: adv.PLAYER_MAX,
        rally: chance(0.6) ? r() * 10 : 0,
        roll: null,
        lunge: null,
        recover: 0,
        netT: chance(0.1) ? 1 : 0,
        blockType: '',
        lastCell: -1,
      });
      const near = (rr) => {
        const cx = Math.floor((player.x + (r() - 0.5) * rr) / CELL),
          cz = Math.floor((player.z + (r() - 0.5) * rr) / CELL);
        return Math.max(0, Math.min(NCELL - 1, cz * MW + cx));
      };
      const nearFloor = (rr) => {
        for (let k = 0; k < 20; k++) {
          const i = near(rr);
          if (D.tile[i] === TF) return i;
        }
        return c0;
      };
      // 地面：燃える物・燃えるガス・水・沼・溶岩・氷・泥・裂け目・結晶・硫黄・薄い氷
      for (let k = 0; k < 50; k++) {
        const i = nearFloor(chance(0.5) ? 6 : 16),
          w = Math.floor(r() * 10);
        if (w === 0) blaze.fuel[i] = r() * 1.2;
        if (w === 1) D.gas[i] = r();
        if (w === 2) D.liquid[i] = pick([LQ_WATER, LQ_DEEP, LQ_BOG]);
        if (w === 3) D.surface[i] = pick([SF_ICE, SF_MUD, SF_BRIM]);
        if (w === 4) D.thin[i] = 1;
        if (w === 5 && i !== c0) D.tile[i] = pick([TC, TX]);
        if (w === 6 && i !== c0) D.liquid[i] = LQ_LAVA;
        if (w === 7) blaze.fire[i] = r();
        if (w === 8) D.bridge[i] = 1;
      }
      // 両手：武器（両手持ちも）・枠（性質・効き方・発動）・特性、体の枠（護符）
      const atk = [...RUNE_TYPES.atk],
        withTraits = (w) => {
          const ru = makeRune(w),
            ks = Object.keys(TRAITS[w] || {});
          const all = chance(0.3);
          ru.traits = ks.filter(() => all || chance(0.6)).map((k) => ({ k, lv: all ? pick([3, 4, 5]) : 1 + Math.floor(r() * 5) }));
          return ru;
        };
      const hand = (w) => {
        const slots = [];
        const n = 2 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++)
          slots.push(
            chance(0.15)
              ? null
              : makeRune(chance(0.5) ? pick(RUNE_TYPES.elem) : chance(0.5) ? pick(RUNE_TYPES.mod) : pick(RUNE_TYPES.trig)),
          );
        return { atk: w, slots, slotN: n, turn: Math.floor(r() * 3), elem: null, trig: null };
      };
      const two = chance(0.25),
        wL = withTraits(two ? pick(['gsword', 'mstaff']) : pick(atk.filter((t) => t !== 'gsword' && t !== 'mstaff')));
      gear.hands = {
        L: hand(wL),
        R: hand(two ? wL : withTraits(pick(atk.filter((t) => t !== 'gsword' && t !== 'mstaff')))),
        B: { b0: chance(0.5) ? makeRune(pick(RUNE_TYPES.body)) : null, b1: chance(0.3) ? makeRune(pick(RUNE_TYPES.body)) : null },
      };
      gear.bag = Array.from({ length: Math.floor(r() * 4) }, () => makeRune(pick(Object.values(RUNE_TYPES).flat())));
      gear.castSt = null;
      gear.swapSt = chance(0.1) ? { t: 0, dur: 1, snap: null, last: 0 } : null;
      // 生き物：階に湧く物の一部と、表の全部の種類（プレイヤーのまわりに）
      here.monsters = [];
      const kinds = Object.keys(MTYPES).filter((k) => MTYPES[k].col && !MTYPES[k].dummy);
      for (const sp of D.spawns.slice(0, 8)) if (MTYPES[sp.key]) here.monsters.push(makeMonster({ ...sp }));
      for (const key of kinds) {
        if (!chance(0.5)) continue;
        const i = nearFloor(chance(0.6) ? 6 : 14);
        here.monsters.push(makeMonster({ key, cx: i % MW, cz: (i / MW) | 0, g: chance(0.4) ? 1 : -1, lead: chance(0.5) }));
      }
      const mons = here.monsters.filter(Boolean);
      for (const m of mons) {
        m.hp = m.maxHp = 5 + Math.floor(r() * 40);
        if (chance(0.5)) Object.assign(m, { x: player.x + (r() - 0.5) * 5, z: player.z + (r() - 0.5) * 5 });
        m.cx = Math.floor(m.x / CELL);
        m.cz = Math.floor(m.z / CELL);
        if (chance(0.5)) Object.assign(m, { tx: m.cx, tz: m.cz });
        if (chance(0.4)) m.noticed = true;
        if (chance(0.2)) m.sleep = true;
        m.aware = r() * 1.3;
        if (chance(0.3)) m.wind = r() * 0.6;
        m.atkCd = r() - 0.3;
        m.visible = chance(0.7);
        if (chance(0.4))
          m.st = {
            burn: chance(0.3) ? r() * 3 : 0,
            chill: chance(0.3) ? r() * 3 : 0,
            poison: chance(0.3) ? r() * 3 : 0,
            shock: chance(0.3) ? r() : 0,
          };
        if (chance(0.3)) m.playerT = clock.time - r() * 3;
        if (chance(0.2)) m.rise = r();
        if (chance(0.2)) m.surf = r();
        if (chance(0.1)) m.hidden = true;
        if (chance(0.2)) m.flee = r() * 2;
        if (m.ty.conj && !m.blades) m.blades = [{ a: 0, x: m.x, y: 1.5, z: m.z }];
      }
      const foes = () => here.monsters.filter((m) => m && !m.dead && !m.ty.critter && !m.ty.peaceful);
      const anyMon = () => pick(here.monsters.filter(Boolean));
      const calls = [];
      const state = () =>
        text({
          player: { ...player },
          mons: here.monsters,
          fight: { ...fight, laters: fight.laters.map((l) => [l.t, !!l.done]), zapQueue: fight.zapQueue.map((z) => [z.t, !!z.done]) },
          vfx,
          blaze: {
            fire: hashArr(blaze.fire),
            fuel: hashArr(blaze.fuel),
            burnt: hashArr(blaze.burnt),
            cellFlag: hashArr(blaze.cellFlag),
            scent: hashArr(blaze.scent),
            burning: blaze.burning.join(','),
            frozen: [...blaze.frozen],
            gasAny: blaze.gasAny,
            lastBoom: blaze.lastBoom,
          },
          D: {
            gas: hashArr(D.gas),
            liquid: hashArr(D.liquid),
            surface: hashArr(D.surface),
            items: D.items,
            flags: [D.swimMsg, D.iceMsg, D.crackMsg],
          },
          adv: { lvl: adv.lvl, runStats: adv.runStats, runState: adv.runState, dead: adv.dead, won: adv.won, max: adv.PLAYER_MAX },
          ui: {
            aimT: ui.aimT,
            crossMon: ui.crossMon,
            graveCands: ui.graveCands.map((x) => x.uid),
            graveSel: ui.graveSel,
            tallMsg: ui.tallMsg,
          },
          hands: gear.hands,
          bag: gear.bag.map((x) => x.uid),
          here: { trans: here.trans, branch: here.branch },
          beamHold,
          vmKick,
          edge,
          cam: gfx.camera,
          U: gfx.U,
          heat: gfx.finalPass.uniforms.uHeat.value,
          pN: buf.pN,
          p: Object.values(P)
            .map((a) => hashArr(a, 0, buf.pN))
            .join(''),
          book: [...saved.BOOK],
          meta: saved.META,
          fn: FN_FIELDS.map(([f, k]) => F[f][k]),
        });
      const call = (name, ...args) => {
        const m0 = mrN,
          s0 = sndN,
          g0 = msgN,
          t0 = timers.st.n;
        let ret, threw;
        try {
          ret = F[name](...args);
        } catch (e) {
          threw = String(e && e.message).slice(0, 40);
        }
        calls.push({
          name,
          ret: text(ret),
          threw,
          mr: mrN - m0,
          snd: sndN - s0,
          msg: msgN - g0,
          timers: timers.st.n - t0,
          state: stateFp(state(), fnv),
          msgs: msgs.map((m) => m.html).join('|'),
        });
        return ret;
      };
      // 場面の初めに、たまっていく飛ぶ物・稲妻の跡・崩れた体を片付ける。場合の中では入れるだけで、読む物が無く
      // （動かす updateProjs・drawBoltFx・updateDebris は呼ばない）、残すと、呼ぶたびに取る状態の指紋が大きくなって遅いため。
      // 崩れた体の上限（crumble が数える）は、上限を越えるまで続けて倒す場面で通す
      const tidy = () => Object.assign(fight, { projs: [], boltFx: [], debris: [] });
      // ゲームの時計を進め、遅れて起きることと setTimeout を流す
      const tick = (dt) => {
        clock.time += dt;
        for (const l of fight.laters)
          if (!l.done && l.t <= clock.time) {
            l.done = true;
            try {
              l.fn();
            } catch {
              calls.push({ name: 'later-threw' });
            }
          }
        fight.laters = fight.laters.filter((l) => !l.done);
        for (const z of fight.zapQueue) {
          z.t -= dt;
          if (!z.done && z.t <= 0) {
            z.done = true;
            try {
              z.fn();
            } catch {
              calls.push({ name: 'zap-threw' });
            }
          }
        }
        fight.zapQueue = fight.zapQueue.filter((z) => !z.done);
        for (const k of ['L', 'R']) fight.trigCd[k] = Math.max(0, fight.trigCd[k] - dt);
        timers.flush();
      };
      const dir = () => {
        const a = r() * 6.28,
          y = (r() - 0.5) * 0.6,
          c = Math.cos(y);
        return [Math.cos(a) * c, Math.sin(y), Math.sin(a) * c];
      };
      // 術の中身の特性は、その武器の特性の表にある物だけ（ゲームの術の中身は、武器のルーンの特性から作る）
      const W_OF = { gsweep: 'gsword', gwave: 'gsword', mshot: 'mstaff', mmoon: 'mstaff', bpower: 'bolt', rshot: 'bolt', bare: '' };
      const sp0 = (atk, elem) => ({
        h: pick(['L', 'R']),
        atk,
        elem,
        aff: {
          count: chance(0.4) ? 1 + Math.floor(r() * 2) : 0,
          bounce: chance(0.3) ? 1 : 0,
          homing: chance(0.3) ? 10 : 0,
          chain: chance(0.4) ? 1 + Math.floor(r() * 2) : 0,
          area: chance(0.4) ? 50 : 0,
          dur: chance(0.4) ? 50 : 0,
        },
        tr: Object.fromEntries(
          Object.keys(TRAITS[W_OF[atk] ?? atk] || {})
            .filter(() => chance(0.6))
            .map((k) => [k, 1 + Math.floor(r() * 5)]),
        ),
        pow: pick([1, 1.4, 2]),
        ...(chance(0.2) ? { powK: 1.3 } : {}),
      });
      // ---- 場面：詠唱（両手の武器と、武器の種類ごとの撃ち方）
      tidy();
      for (const h of ['L', 'R']) {
        call('specOf', h);
        for (let k = 0; k < 2; k++) {
          const opt = chance(0.2) ? undefined : { hold: r() * 2, chanted: chance(0.5), dir: chance(0.3) ? dir() : null, auto: chance(0.3) };
          call('castNow', h, opt);
          tick(pick([0.1, 0.3, 0.7]));
        }
      }
      // 武器の種類ごとに（素手・大剣の払い・遠鳴り・強弓・遠矢・光の弾・光の月も）
      for (const atkT of [...atk, ...SUBS, 'bare']) {
        if (!chance(0.35)) continue;
        const h = pick(['L', 'R']),
          H = gear.hands[h];
        const keepAtk = H.atk;
        if (atkT === 'bare') H.atk = null;
        else if (SUBS.includes(atkT)) {
          const w = atkT === 'gsweep' || atkT === 'gwave' ? 'gsword' : atkT === 'mshot' || atkT === 'mmoon' ? 'mstaff' : 'bolt';
          H.atk = gear.hands.L.atk = gear.hands.R.atk = withTraits(w);
        } else H.atk = withTraits(atkT);
        call('castNow', h, { hold: r() * 3, chanted: chance(0.5), dir: chance(0.4) ? dir() : null, auto: chance(0.4) });
        for (let q = 0; q < 4; q++) tick(pick([0.1, 0.2, 0.4]));
        H.atk = keepAtk;
      }
      // 直接：近くを切る・突進・星・連射・雨・剣の波・光線・玉
      for (let k = 0; k < 3; k++) {
        const el = pick(ELEMS);
        call('meleeCast', sp0(pick(['blade', 'bare', 'gsweep']), el), dir());
        call('dashCast', sp0('dash', el), dir(), chance(0.5));
        tick(0.25);
        if (player.lunge) call('dashCuts');
        if (k === 0) {
          // 突進が無い時は何もしない（突進は戻す）
          const L = player.lunge;
          player.lunge = null;
          call('dashCuts');
          player.lunge = L;
        }
        tick(0.4);
        call('castStar', sp0('star', el), player.x + (r() - 0.5) * 6, player.z + (r() - 0.5) * 6);
        call('startRain', sp0('rain', el), player.x, player.z, chance(0.3));
        call('castRapid', pick(['L', 'R']), sp0('rapid', el), { dir: chance(0.5) ? dir() : null, auto: chance(0.5) });
        call('fireWave', sp0(pick(['blade', 'gsweep', 'bare']), el), dir(), chance(0.5) ? new Set([anyMon()]) : undefined);
        {
          // 向きを渡す時は、撃つ所も渡す（発動のルーンが撃つ時。ゲームではほかの組み合わせは起きない）
          const d = chance(0.5) ? dir() : null;
          call('fireBeam', pick(['L', 'R']), d, d ? [player.x, 1.5, player.z] : null, chance(0.5));
        }
        call(
          'orbBurst',
          player.x + (r() - 0.5) * 6,
          r() * 2,
          player.z + (r() - 0.5) * 6,
          sp0('orb', el),
          chance(0.2)
            ? undefined
            : {
                dmg: r() * 2,
                rad: chance(0.5) ? r() * 2 : undefined,
                cloud: chance(0.8),
              },
        );
        for (let q = 0; q < 6; q++) tick(pick([0.1, 0.3]));
      }
      // ---- 場面：当たりと性質と反応（状態をそろえて、反応ごとに）
      tidy();
      const REACT = [
        ['fire', { chill: 1 }],
        ['fire', { poison: 1 }],
        ['fire', { shock: 1 }],
        ['ice', { burn: 1 }],
        ['ice', { poison: 1 }],
        ['thunder', { chill: 1 }],
        ['thunder', { poison: 1 }],
        ['thunder', { burn: 1 }],
        ['poison', { burn: 1 }],
        ['poison', { chill: 1 }],
        ['poison', { shock: 1 }],
        ['fire', {}],
        ['ice', {}],
        ['thunder', {}],
        ['poison', {}],
      ];
      for (const [el, st] of REACT) {
        const fs = foes();
        if (!fs.length) break;
        const m = pick(fs);
        m.st = chance(0.2) ? undefined : { ...st };
        if (chance(0.5)) {
          m.st = { ...st };
          call('applyElem', m, el, sp0(pick(['bolt', 'orb']), el), 2 + Math.floor(r() * 8));
        } else call('applyHit', m, 2 + Math.floor(r() * 8), sp0(pick(['bolt', 'orb', 'blade']), el), chance(0.5));
        tick(0.3);
      }
      for (const kind of ['steam', 'blast', 'overload', 'shatter', 'frostbite', 'contagion']) {
        const fs = foes();
        if (!fs.length) break;
        const m = pick(fs);
        m.st = { burn: 1, chill: 1, poison: chance(0.5) ? 2 : 0, shock: 0.5 };
        if (chance(0.3)) Object.assign(m, { x: player.x + 0.5, z: player.z });
        call('react', kind, m, sp0('orb', 'fire'), 4);
        tick(0.2);
      }
      for (let k = 0; k < 6; k++) {
        const fs = foes();
        if (!fs.length) break;
        const m = pick(fs);
        // 水の中（伝わる・効きが増す）
        if (chance(0.5)) {
          const ci = m.cz * MW + m.cx;
          D.liquid[ci] = LQ_WATER;
          for (const o of fs) if (chance(0.4)) D.liquid[o.cz * MW + o.cx] = LQ_DEEP;
        }
        const w = Math.floor(r() * 8);
        if (w === 0) call('chainLightning', m, 1 + Math.floor(r() * 3), 3, 1 + r());
        else if (w === 1) call('conductWater', m, 4);
        else if (w === 2) call('landElem', sp0('orb', pick(ELEMS)), m.x, 0.3, m.z, pick([m.cz * MW + m.cx, -1, NCELL, nearFloor(8)]));
        else if (w === 3) call('burstFire', pick([m.cz * MW + m.cx, nearFloor(8)]), r() * 2, 0.9);
        else if (w === 4) {
          const i = nearFloor(chance(0.5) ? 2 : 10);
          D.gas[i] = 0.5;
          call('boom', i);
          if (chance(0.5)) call('boom', i);
        } else if (w === 5) call('nearestFoe', m.x, m.z, 6, new Set([m]), chance(0.5) ? 1 : undefined);
        else if (w === 6) call('zapLine', m, pick(fs), [1, 1, 1], chance(0.5) ? 'poison' : undefined);
        else call('inWater', m);
        tick(pick([0.1, 0.2]));
      }
      // ---- 場面：ダメージと倒す（眠り・的・王の影・主・まわりの物）
      tidy();
      for (let k = 0; k < 8; k++) {
        const fs = foes();
        if (!fs.length) break;
        const m = pick(fs);
        const w = Math.floor(r() * 6);
        if (w === 0) m.sleep = true;
        if (w === 1 && here.branch) {
          m.key = 'lord';
          saved.LEGEND = null;
        }
        if (w === 2) {
          m.key = 'final';
          m.invulnT = chance(0.5) ? 1 : 0;
        }
        if (w === 3) m.ty = { ...m.ty, dummy: true };
        if (chance(0.5)) m.playerT = clock.time;
        if (chance(0.3)) m.hp = 1;
        call('damageMonster', m, pick([0, 1, 5, 30, 200]), pick(['blade', 'fire', 'magic', 'env', 'thunder']));
        if (chance(0.3)) call('hitReact', m, pick([1, 6, 20]));
        if (chance(0.3)) call('hitFeedback', m, pick([0, 0.2, 1, 2]), pick(ELEMS), chance(0.5));
        if (chance(0.3)) call('rallyOnHit', m, 5, pick(['blade', 'fire', 'env']));
        if (chance(0.3)) call('dropRune', m);
        // 主にした時はいつも呼ぶ（伝説の物がこぼれ落ちる道を、乱数の並びによらず通すため）
        if (m.key === 'lord' || chance(0.3)) call('lordFell', m);
        tick(0.2);
      }
      // 発動のルーン：倒した時・かわした時（両手の発動を入れ替えて）
      for (const trig of ['kill', 'dodge']) {
        for (const h of ['L', 'R']) gear.hands[h].trig = chance(0.8) ? makeRune(trig) : null;
        fight.trigCd = { L: chance(0.2) ? 1 : 0, R: 0 };
        const fs = foes();
        if (!fs.length) break;
        const m = pick(fs);
        if (trig === 'kill') call('onKilledBy', m);
        else call('onDodged', m);
        tick(0.3);
      }
      call('gainExp', pick([0, 3, 50, 500]));
      call('coldSnap', player.x, player.z, 2 + r());
      call('later', r(), () => (player.hp += 0));
      call('addZone', player.x, player.z, 1, sp0('orb', pick(ELEMS)), 2, chance(0.5));
      call('addZone', player.x + 0.1, player.z, 1, sp0('orb', 'fire'), 3, false);
      // ---- 場面：崩れた体の上限（上限より多く続けて倒し、古い体を早く消す印が付くか）
      tidy();
      const fallen = [];
      for (let k = 0; k < DEBRIS_MAX + 3; k++) {
        const i = nearFloor(6),
          m = makeMonster({ key: pick(kinds), cx: i % MW, cz: (i / MW) | 0, g: 1 });
        here.monsters.push(m);
        fallen.push(m);
        m.playerT = clock.time;
        call('damageMonster', m, 9999, pick(['blade', 'fire', 'magic', 'thunder']));
        tick(0.1);
      }
      const cap = { bodies: fight.debris.length, hurried: fight.debris.filter((d) => d.hurry !== Infinity).length };
      here.monsters = here.monsters.filter((m) => !fallen.includes(m));
      // ---- 場面：照準と線
      tidy();
      for (let k = 0; k < 6; k++) {
        gfx.camera.position.set(player.x, player.eye, player.z);
        const i = near(10);
        call('doorBlock', D.doors.length && chance(0.5) ? pick(D.doors).i : i);
        call('losClear', player.x, 1.2, player.z, player.x + (r() - 0.5) * 20, r() * 3, player.z + (r() - 0.5) * 20);
        call('groundPoint', [player.x, 1.5, player.z], dir(), chance(0.5) ? undefined : 8);
        call('reflectDir', player.x + (r() - 0.5) * 4, r() * 4, player.z + (r() - 0.5) * 4, dir());
        if (chance(0.5)) ui.aimT = -9;
        call('aimTarget');
        call('assistPoint', [player.x, 1.5, player.z], pick(['bolt', 'beam', 'orb', undefined]));
        call('shotFrame', pick(['L', 'R']), chance(0.5), pick(['bolt', 'beam', undefined]));
        call('beamFrame', pick(['L', 'R']));
        const fl = foes().filter((o) => o.ty.flier);
        if (fl.length) {
          ui.crossMon = pick(fl);
          ui.aimT = clock.time;
          call('assistPoint', [player.x, 1.5, player.z], 'bolt');
        }
        call('landElem', sp0('orb', 'fire'), player.x, 0.3, player.z, Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL));
        if (foes().length && chance(0.5)) {
          const fl = foes().filter((o) => o.ty.flier);
          const m = fl.length && chance(0.5) ? pick(fl) : pick(foes());
          player.yaw = Math.atan2(-(m.x - player.x), -(m.z - player.z));
          player.pitch = 0;
          m.visible = true;
        }
      }
      // ---- 場面：近接の攻撃（溜め・かわす・当たる）
      tidy();
      for (let k = 0; k < 6; k++) {
        const fs = foes();
        if (!fs.length) break;
        const m = pick(fs);
        Object.assign(m, { noticed: true, sleep: false, wind: chance(0.6) ? r() * 0.2 : 0, atkCd: chance(0.5) ? -1 : 1 });
        player.roll = chance(0.4) ? { t: 0, dx: 1, dz: 0 } : null;
        call('monsterStrike', m, pick([0.1, 0.3]), pick([0.5, 1, 4]));
        tick(0.1);
      }
      // ---- 場面：プレイヤーの傷（神のモード・加護・死）
      tidy();
      for (let k = 0; k < 4; k++) {
        ui.godMode = chance(0.2);
        if (chance(0.25)) player.hp = 2;
        call('hurtPlayer', pick([0, 1, 3, 8]), pick(['炎', '爆発', 'ネズミ']));
        tick(0.1);
        if (adv.dead) {
          adv.dead = false;
          player.hp = adv.PLAYER_MAX;
        }
      }
      ui.godMode = false;
      // ---- 場面：術の音・手と持ち物
      tidy();
      for (const el of ELEMS) if (chance(0.5)) call('castSound', { elem: el }, chance(0.5) ? player.x : undefined, player.z);
      tick(0.5);
      for (const t of ['slotL', 'slotR', 'body', 'none'])
        if (chance(0.6)) {
          ui.invOpen = false;
          call('applyOpen', t);
        }
      // ---- 場面：結果の画面
      tidy();
      {
        const md = adv.runStats.maxDepth,
          meta = saved.META,
          dev = saved.DEVALL;
        adv.runStats.maxDepth = 12;
        call('runLore', true);
        adv.runStats.maxDepth = 1;
        call('runLore', false);
        adv.runStats.maxDepth = md;
        saved.META = { ...meta, lore: 0, spent: 0 };
        saved.DEVALL = false;
        call('loreRows', { parts: [['a', '', 1]], base: 1, mult: 1, total: 1 }, (t) => t);
        saved.META = meta;
        saved.DEVALL = dev;
      }
      call('resultPlace');
      call('runLore', chance(0.5));
      if (chance(0.5)) adv.runStats.loreRes = undefined;
      ui.gallery = chance(0.2) ? { mode: 'beast' } : null;
      call('awardLore', chance(0.5));
      ui.gallery = null;
      call('loreRows', chance(0.2) ? null : F.runLore(false), (t) => `<${t}>`);
      ui.graveCands = call('graveCandidates');
      ui.graveSel = Math.floor(r() * (ui.graveCands.length + 1));
      call('graveRows', (t) => `[${t}]`);
      adv.won = chance(0.2);
      call('saveGrave');
      adv.won = chance(0.3);
      saved.LEGEND = null;
      if (chance(0.5)) call('victory');
      adv.won = false;
      adv.dead = false;
      call('resetRunes');
      // ---- 場面：分かれ道ごと（加護の効く間・効かない当たり・吹き飛び・立ち直り・発動のルーンの届く所・魔法の場の数・音が鳴らない・保存できない・画面の部品が無い）
      tidy();
      {
        const fs = foes();
        if (fs.length) {
          const m = pick(fs);
          Object.assign(player, { ctrUntil: clock.time + 1, swapEdgeUntil: clock.time + 1, momUntil: clock.time + 1 });
          call('applyHit', m, 3, sp0('bolt', 'fire'));
          Object.assign(player, { ctrUntil: 0, swapEdgeUntil: 0, momUntil: 0 });
          const m2 = pick(fs);
          Object.assign(m2, { noticed: false, dead: false });
          call('applyHit', m2, 0, sp0('bolt', null));
          m2.dead = true;
          call('applyHit', m2, 3, sp0('bolt', 'fire'));
          m2.dead = false;
          for (const la of ['blade', 'bolt', 'orb', 'beam', 'bare', 'rapid', undefined]) {
            const m3 = pick(fs);
            Object.assign(m3, {
              lastAtk: la,
              lastKnock: chance(0.5) ? 2 : undefined,
              hp: chance(0.3) ? 0 : 10,
              wind: chance(0.5) ? 0.3 : 0,
            });
            fight.hitSrcPoint = chance(0.5) ? [player.x, player.z] : null;
            call('hitReact', m3, pick([2, 9, 30]));
          }
          fight.hitSrcPoint = null;
          player.rally = 0.01;
          call('rallyOnHit', Object.assign(pick(fs), { playerT: clock.time }), 0.05, 'blade');
          player.rally = 20;
          call('rallyOnHit', Object.assign(pick(fs), { playerT: clock.time, hp: 0 }), 4, 'fire');
          for (const atkW of ['blade', 'dash', 'gsword']) {
            for (const h of ['L', 'R']) {
              gear.hands[h].atk = withTraits(atkW);
              gear.hands[h].trig = makeRune(pick(['kill', 'dodge']));
            }
            fight.trigCd = { L: 0, R: 0 };
            const far = pick(fs);
            Object.assign(far, { x: player.x + 4, z: player.z + 0.1, dead: false });
            call('onKilledBy', pick(fs));
            call('onDodged', far);
          }
          const hs = gear.hands;
          gear.hands = null;
          call('onDodged', pick(fs));
          gear.hands = hs;
        }
        for (let k = 0; k < 16; k++) call('addZone', player.x + k * 2, player.z, 1, sp0('orb', 'fire'), 2, false);
        SND.on = false;
        call('castSound', { elem: 'fire' }, player.x, player.z);
        SND.on = true;
        noStore = true;
        saved.RSEEN = new Set();
        call('resetRunes');
        saved.BOOK = new Set();
        if (foes().length) {
          const m = pick(foes());
          m.st = { burn: 1 };
          call('react', 'steam', m, sp0('orb', 'ice'), 3);
        }
        noStore = false;
        ui.invOpen = true;
        call('applyOpen', 'slotL');
        ui.invOpen = false;
        page.hide.add('death');
        adv.won = false;
        call('victory');
        page.hide.delete('death');
        adv.won = true;
        call('victory');
        // 勝った時の画面の［新しい探索へ］（指で遊ぶ時はキーが無いので押して進む）：暗くし始める（真っ暗になった時に tick が newRun を呼ぶ）
        {
          adv.won = false;
          here.trans = null;
          here.fade = 1;
          call('victory');
          const el = page.els['death'];
          if (!el || !el.onclick) throw new Error('勝った時の画面に、押した時の処理が無い');
          el.onclick({ target: { closest: () => ({ id: 'other' }) } });
          const before = here.trans;
          el.onclick({ target: { closest: () => ({ id: 'newRunB' }) } });
          if (before !== null || !here.trans || !here.trans.run || here.trans.t !== 0)
            throw new Error(`勝った時の画面の［新しい探索へ］で暗くし始めない（${JSON.stringify(here.trans)}）`);
          here.trans = null;
        }
        adv.won = false;
        adv.dead = false;
        saved.LEGEND = null;
        // 水の中の敵（7体より多い・雷の効き目のある物）に雷が伝わる・水に雷を落とす
        {
          if (MTYPES['Y'])
            here.monsters.push(makeMonster({ key: 'Y', cx: Math.floor(player.x / CELL), cz: Math.floor(player.z / CELL), g: -1 }));
          for (let q = 0; q < 8; q++)
            here.monsters.push(makeMonster({ key: 'k', cx: Math.floor(player.x / CELL), cz: Math.floor(player.z / CELL), g: -1 }));
          const fs2 = [...foes().filter((o) => o.key === 'Y'), ...foes()].slice(0, 9);
          for (const o of fs2) {
            Object.assign(o, { x: player.x + (r() - 0.5) * 3, z: player.z + (r() - 0.5) * 3, dead: false });
            o.cx = Math.floor(o.x / CELL);
            o.cz = Math.floor(o.z / CELL);
            D.liquid[o.cz * MW + o.cx] = LQ_WATER;
          }
          const y = fs2[fs2.length - 1];
          if (y) {
            call('conductWater', fs2[1] ?? y, 6);
            call('conductWater', y, 6);
            call('landElem', sp0('orb', 'thunder'), y.x, 0.2, y.z, y.cz * MW + y.cx);
          }
        }
        // 閉じた扉へ光線を撃つ
        if (D.doors.length) {
          const d = pick(D.doors);
          d.o = 0;
          d.gone = false;
          const [dx2, dz2] = cpos(d.i),
            w = gear.hands.R.atk;
          gear.hands.R.atk = makeRune('beam');
          for (const [ax, az] of D4) {
            const ci = d.i - ax - az * MW;
            if (D.tile[ci] !== TF) continue;
            Object.assign(player, { x: dx2 - ax * CELL, z: dz2 - az * CELL });
            fight.beamIgT = -9;
            call('fireBeam', 'R', [ax, 0, az], [player.x, 1.2, player.z], false);
            break;
          }
          gear.hands.R.atk = w;
          Object.assign(player, { x: px, z: pz });
        }
        // 深い水の中で歩く（水しぶき・目が低い）
        {
          const ci = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL);
          D.liquid[ci] = LQ_DEEP;
          D.bridge[ci] = 0;
          keys.KeyW = true;
          for (let q = 0; q < 8; q++) call('updatePlayer', 0.25);
          keys.KeyW = false;
          D.liquid[ci] = 0;
        }
        // 当たり判定：マップの外・崩れた穴・柱・置物
        call('solidAt', -1, -1, 0.3);
        const i = nearFloor(6),
          [ix, iz] = cpos(i);
        D.pit = new Uint8Array(NCELL);
        D.tile[i + 1] = TC;
        D.pit[i + 1] = chance(0.5) ? 1 : 0;
        call('solidAt', ix + CELL * 0.9, iz, 0.3);
        D.tile[i - 1] = TP;
        call('solidAt', ix - CELL * 0.6, iz, 0.3);
        call('solidAt', ix - CELL * 0.1, iz, 0.1);
        D.solid.set(i + MW, 0.5);
        call('solidAt', ix, iz + CELL * 0.8, 0.3);
        call('solidAt', ix, iz + CELL * 0.1, 0.1);
        // 死んでいる時は動かない・クモの巣
        adv.dead = true;
        call('updatePlayer', 0.1);
        adv.dead = false;
        D.webAt = new Map([[Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL), { i: 0, gone: false }]]);
        keys.KeyW = true;
        call('updatePlayer', 0.1);
        keys.KeyW = false;
        D.webAt = new Map();
      }
      // ---- 場面：プレイヤーの動き（キー・水・氷・泥・網・突進・転がり・通れない所・生き物に押される）
      tidy();
      for (let st = 0; st < 30; st++) {
        for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft'])
          keys[k] = chance(0.3);
        if (chance(0.1))
          player.lunge = {
            t: 0,
            dur: 0.2,
            dx: 1,
            dz: 0,
            sp: 10,
            cut: { sp: sp0('dash', null), hit: new Set(), w: 1, dK: 1, link: chance(0.5) },
          };
        if (chance(0.1)) player.roll = { t: 0, dx: 0, dz: 1 };
        if (chance(0.05)) ui.started = !ui.started;
        if (chance(0.05)) here.trans = chance(0.5) ? null : { phase: 'out', t: 0 };
        const dt = pick([1 / 30, 0.1, 0.25]);
        call('updatePlayer', dt);
        if (chance(0.2)) call('solidAt', player.x + (r() - 0.5) * 2, player.z + (r() - 0.5) * 2, pick([0.3, 0.5]));
        tick(dt);
      }
      // 裂け目の縁・溶岩・鉄格子・結晶に押し当てる
      for (const [tile, liq] of [
        [TC, 0],
        [TF, LQ_LAVA],
        [TX, 0],
        ['gate', 0],
      ]) {
        const i = nearFloor(4),
          d = pick(D4),
          j = i + d[0] + d[1] * MW;
        if (tile === 'gate') D.gate = { cell: j, o: 0.2 };
        else {
          D.tile[j] = tile;
          D.liquid[j] = liq;
        }
        const [ix, iz] = cpos(i);
        Object.assign(player, {
          x: ix + d[0] * 0.5,
          z: iz + d[1] * 0.5,
          vx: 0,
          vz: 0,
          roll: null,
          lunge: null,
          yaw: Math.atan2(-d[0], -d[1]),
        });
        ui.started = true;
        here.trans = null;
        for (const k of Object.keys(keys)) keys[k] = false;
        keys.KeyW = true;
        for (let q = 0; q < (tile === TC ? 16 : 4); q++) call('updatePlayer', 0.1);
        keys.KeyW = false;
        call('updatePlayer', 0.5);
        call('updatePlayer', 0.5);
      }
      // ---- 場面：生き物の動き（全部の生き物を、何歩か）
      tidy();
      const kinds2 = Object.keys(MTYPES).filter((k) => MTYPES[k].col && !MTYPES[k].dummy);
      for (const key of [...kinds2, 'X'].filter((k) => MTYPES[k] && chance(0.5))) {
        const i = nearFloor(chance(0.5) ? 3 : 12),
          m = makeMonster({ key, cx: i % MW, cz: (i / MW) | 0, g: -1 });
        if (m.ty.conj && !m.blades) m.blades = [{ a: 0, x: m.x, y: 1.5, z: m.z }];
        Object.assign(m, {
          noticed: chance(0.5),
          aware: r() * 1.3,
          sleep: chance(0.2),
          visible: chance(0.5),
          rise: chance(0.5) ? r() : undefined,
        });
        here.monsters.push(m);
      }
      // 場面：遠くの小さな生き物・群れの頭から離れた物・水面に出るうなぎ・溶岩の生き物と火の猟犬と氷の猟犬（燃える床の上）・忘れられた獣
      for (const m of here.monsters) {
        if (!m || m.dead) continue;
        if (m.ty.critter && chance(0.3)) Object.assign(m, { x: player.x + 70, z: player.z });
        if (m.ty.habitat === 'bog' || m.ty.habitat === 'deep')
          Object.assign(m, { noticed: false, rise: 0.5, x: player.x + 25, z: player.z });
        if (m.ty.form === 'eel') Object.assign(m, { surf: chance(0.5) ? 0 : 0.97, surfT: -1, x: player.x + 2, z: player.z });
        if ((m.ty.habitat === 'lava' || m.ty.hound || m.ty.beast) && !m.ty.flier) {
          Object.assign(m, { sleep: false, moving: 1, wait: 0 });
          const ci = m.cz * MW + m.cx;
          if (ci >= 0 && ci < NCELL) {
            blaze.fuel[ci] = 1;
            blaze.fire[ci] = m.ty.hound === 'ice' ? 0.5 : 0;
            D.liquid[ci] = 0;
          }
        }
        if (!m.ty.flier && chance(0.3)) m.leader = Object.assign(pick(here.monsters.filter(Boolean)), {});
      }
      // 燃える鱗の獣・歌う獣（探索のシードの年代記から作る、本物の忘れられた獣）・遠くの水の中のうなぎ・雷の効き目のある物
      {
        const want = chance(0.5) ? 'fire' : 'sing';
        for (let k = 1; k < 400; k++) {
          const sd = (s * 1000 + k) >>> 0,
            ty = makeBeastType(makeHistory(sd), sd);
          if (!ty.spec[want]) continue;
          MTYPES['X'] = ty;
          const i = nearFloor(4),
            m = makeMonster({ key: 'X', cx: i % MW, cz: (i / MW) | 0, g: -1 });
          Object.assign(m, { sleep: false, noticed: true, moving: 1, wait: 0 });
          blaze.fuel[i] = 1;
          blaze.fire[i] = 0;
          here.monsters.push(m);
          break;
        }
        for (const key of ['e', 'Y'].filter((k) => MTYPES[k])) {
          const i = nearFloor(14),
            m = makeMonster({ key, cx: i % MW, cz: (i / MW) | 0, g: -1 });
          if (MTYPES[key].form === 'eel') Object.assign(m, { x: player.x + 30, z: player.z, surf: 0, surfT: 99, acc: 0.9 });
          here.monsters.push(m);
        }
      }
      // 場面（決まった形）：うなぎ（水面に出終わる・遠くで波紋を出さない・近くで波紋）・火の猟犬が火をつける・転がって攻撃をかわす・潜った物は攻撃しない
      {
        const eelK = Object.keys(MTYPES).find((k) => MTYPES[k].form === 'eel'),
          houndK = Object.keys(MTYPES).find((k) => MTYPES[k].hound === 'fire'),
          i = nearFloor(4);
        const mk = (key, o) => {
          const m = makeMonster({ key, cx: i % MW, cz: (i / MW) | 0, g: -1 });
          Object.assign(m, o);
          here.monsters.push(m);
          return m;
        };
        if (eelK) {
          call('updateMonster', mk(eelK, { surf: 0.99, surfT: 5 }), 0.1, clock.time);
          call('updateMonster', mk(eelK, { x: player.x + 30, z: player.z, surf: 0, surfT: 99, acc: 0.9 }), 0.1, clock.time);
          call('updateMonster', mk(eelK, { x: player.x + 3, z: player.z, surf: 0, surfT: 99, acc: 0.9 }), 0.1, clock.time);
          call('monsterStrike', mk(eelK, { noticed: true, surf: 0 }), 0.1, 0.5);
        }
        if (houndK) {
          const h = mk(houndK, { sleep: false, moving: 1, wait: 9, noticed: false, aware: 0 });
          for (let q = 0; q < 12; q++) {
            const ci = h.cz * MW + h.cx;
            blaze.fuel[ci] = 1;
            blaze.fire[ci] = 0;
            D.liquid[ci] = 0;
            h.moving = 1;
            h.wait = 9;
            call('updateMonster', h, 1, clock.time);
          }
        }
        const fs = foes().filter((o) => !o.ty.habitat && o.ty.form !== 'eel');
        if (fs.length) {
          const m = pick(fs);
          Object.assign(m, { noticed: true, sleep: false, wind: 0.05, atkCd: 1 });
          player.roll = { t: 0, dx: 1, dz: 0 };
          delete F.monsterStrike.mt;
          call('monsterStrike', m, 0.1, 0.5);
          player.roll = null;
        }
      }
      here.fovStamp = 7;
      for (let i = 0; i < NCELL; i++) if (chance(0.3)) here.fovVis[i] = 7;
      for (let st = 0; st < 12; st++) {
        const dt = pick([1 / 30, 0.1, 0.3]);
        for (const m of here.monsters) if (m && !m.dead && chance(0.7)) call('updateMonster', m, dt, clock.time);
        if (chance(0.3)) Object.assign(player, { x: player.x + (r() - 0.5) * 3, z: player.z + (r() - 0.5) * 3 });
        if (chance(0.2)) ui.started = !ui.started;
        tick(dt);
      }
      out.push({
        s,
        place: `${place.depth}${place.branch?.key ?? ''}${place.realm?.key ?? ''}${place.inter?.key ?? ''}`,
        calls,
        cap,
        dom: fnv(text(page.log)),
        audio: fnv(text(alog)),
        stored: fnv(text(stored)),
        timers: { ...timers.st },
      });
    }
  } finally {
    restoreGlobals();
    delete msgs.push;
    for (const [k, fields] of keptTypes)
      for (const [f, d] of fields) {
        if (d) Object.defineProperty(MTYPES[k], f, d);
        else delete MTYPES[k][f];
      }
    restore(here, keep.here);
    restore(adv, keep.adv);
    restore(player, keep.player);
    restore(ui, keep.ui);
    restore(vfx, keep.vfx);
    restore(blaze, keep.blaze);
    restore(fight, keep.fight);
    restore(stealth, keep.stealth);
    restore(SND, keep.SND);
    restore(buf, keep.buf);
    restore(gear, keep.gear);
    restore(gfx, keep.gfx);
    restore(edge, keep.edge);
    restore(vmKick, keep.vmKick);
    for (const h of ['L', 'R']) Object.assign(beamHold[h], keep.beamHold[h]);
    restore(keys, keep.keys);
    restore(saved, keep.saved);
    clock.time = keep.time;
    if (keep.lord) MTYPES['lord'] = keep.lord;
    else delete MTYPES['lord'];
    if (keep.X) MTYPES['X'] = keep.X;
    else delete MTYPES['X'];
    Math.random = keep.random;
    setSoundRand(keep.sound);
    msgs.length = 0;
    msgs.push(...keep.msgs);
    for (const [f, k] of FN_FIELDS) delete F[f][k];
  }
  return out;
}
/** 場合の記録を1つの文字列にする */
export const fightText = (all) =>
  all.map((c) => `${c.s} ${c.place} ${c.dom} ${c.audio} ${c.stored} ${text(c.timers)} ${text(c.cap)}\n${text(c.calls)}`).join('\n');
