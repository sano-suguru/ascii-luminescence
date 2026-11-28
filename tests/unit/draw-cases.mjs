// テストの道具：階に置いてある物を描く処理（src/lib/fixtures.ts）・火と術の跡を描く処理（fx.ts）・先にある物の手がかりと階段の封（omens.ts）・
// 伝説の物の読み方と描く処理（legend.ts）・特別な階の場所（levels.ts の interAt・interAfter）・天井の高さ（lightmap.ts の ceilAt）を、たくさんの場合で呼び、
// 返す値と、置いた文字と粒子の配列の中身・見た目の乱数と音の乱数を引いた数・伝言・偽の Web Audio の記録・状態の変わり方を、1つの文字列にまとめる。
// F は関数をまとめた物。draw.test.mjs が、この文字列の指紋を確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の全部の場所。本物の備品・扉・灯り・巣・階段が要るため）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、本物の階に、全部の種類の備品・巣・泉・墓・伝説の物・燃えるマス・凍ったマス・稲妻・床の目印・魔法の場・生き物（扉のそば・クモ・階段の番）を
// シードの乱数で足し、プレイヤーをどれかのそばに置いて、関数を続けて呼ぶ。
// テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio を、本物の型に合わせられないため。
// 書き換えた状態と、document・window・Math.random・音の乱数は、終わったら元に戻す。
import { sndInit } from '../../src/lib/audio.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { getLegend } from '../../src/lib/legend.ts';
import { jagged } from '../../src/lib/math.ts';
import { LEGEND_ORDER } from '../../src/lib/names.ts';
import { P, dCol, dPar, dPos } from '../../src/lib/particles.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES } from '../../src/lib/runes.ts';
import { SND, adv, blaze, buf, clock, fight, here, msgs, player, saved, ui, vfx } from '../../src/lib/state.ts';
import { SPECIALS } from '../../src/lib/strata.ts';
import { BRANCHES, CELL, FINAL_DEPTH, MW, NCELL, REALMS, TF, cpos } from '../../src/lib/world.ts';
import { fakeAudioClass } from './fake-audio.mjs';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';

/** 備品の全部の種類（drawFixtures の分かれ道と同じ並び。'none' は、どれにも当たらない種類） */
export const FIX_TYPES = [
  'brazier',
  'crystal',
  'rune',
  'lamp',
  'fungus',
  'abyss',
  'embers',
  'relic',
  'pages',
  'mist',
  'fall',
  'veinlight',
  'crater',
  'spring',
  'firefly',
  'marsh',
  'well',
  'sun',
  'orb',
  'bloodwort',
  'vent',
  'pitglow',
  'xlight',
  'torch',
  'lava',
  'portal',
  'bstairs',
  'upstairs',
  'tele',
  'stairs',
  'none',
];
/** 配列の中身の指紋（Float32Array・Uint8Array のバイト列） */
const hashArr = (a, from, to) => {
  const b = new Uint8Array(a.buffer, a.byteOffset + from * a.BYTES_PER_ELEMENT, (to - from) * a.BYTES_PER_ELEMENT);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ (b[i] ?? 0), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** 値を1つの文字列にする（NaN・Infinity・undefined も見分ける。生き物の種類は名前だけ、配列の型は指紋） */
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
                  : k === 'form'
                    ? 'form'
                    : x,
  );
/** 写しから元に戻す（写しに無い欄は消す） */
const restore = (obj, copy) => {
  for (const k of Object.keys(obj)) if (!(k in copy)) delete obj[k];
  Object.assign(obj, copy);
};

/** seeds：場合の数。返り値は、場合ごとの1行（呼んだ関数ごとの記録と、最後の状態） */
export async function drawCases(F, seeds) {
  const env = await loadEnv(),
    out = [];
  const keep = {
    here: { ...here },
    adv: { runSeed: adv.runSeed, HIST: adv.HIST, HIST_SEED: adv.HIST_SEED },
    player: { ...player },
    ui: { ...ui },
    vfx: { ...vfx },
    blaze: { ...blaze },
    fight: { ...fight },
    saved: { LEGEND: saved.LEGEND },
    SND: { ...SND },
    buf: { ...buf },
    time: clock.time,
    lord: MTYPES['lord'],
    X: MTYPES['X'],
    random: Math.random,
    // 音の乱数（入れ替えて、元の物を覚える）
    sound: setSoundRand(Math.random),
    msgs: [...msgs],
  };
  const els = { log: { innerHTML: '' } },
    alog = [];
  const restoreGlobals = swapGlobals({
    document: { getElementById: (id) => els[id] ?? null },
    window: { AudioContext: fakeAudioClass(alog, 'running') },
  });
  try {
    // 音の部品は1度だけ作る（場合ごとに、記録を空にし、鳴らせるかを変える）
    Math.random = mulberry32(1);
    Object.assign(SND, { ctx: null, master: null, inp: null, wet: null, noise: null, on: true });
    sndInit();
    const spiders = Object.keys(MTYPES).filter((k) => MTYPES[k].spider),
      kinds = Object.keys(MTYPES).filter((k) => !MTYPES[k].dummy && k !== 'lord' && k !== 'X'),
      // 手がかりと伝説の物の分かれ道を通るように、半分は、支道・異界・特別な階・最深部とその手前から選ぶ
      odd = PLACES.filter((p) => p.branch || p.realm || p.inter || p.depth >= FINAL_DEPTH - 1),
      final = PLACES.find((p) => p.depth === FINAL_DEPTH && !p.branch && !p.realm && !p.inter);
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 69069 + 7),
        pick = (a) => a[Math.floor(r() * a.length)],
        chance = (p) => r() < p;
      // 見た目の乱数（mr）は、場合ごとのシードで決め、引いた数を数える
      let mrN = 0;
      const mrSrc = mulberry32(s * 7919 + 3);
      Math.random = () => (mrN++, mrSrc());
      // 音の乱数も、場合ごとのシードで決め、引いた数を数える
      let sndN = 0;
      const sndSrc = mulberry32(s * 104729 + 5);
      setSoundRand(() => (sndN++, sndSrc()));
      const place = chance(0.1) ? final : chance(0.5) ? pick(odd) : pick(PLACES);
      adv.runSeed = (r() * 4294967296) >>> 0;
      Object.assign(here, { depth: place.depth, branch: place.branch ?? null, realm: place.realm ?? null, inter: place.inter ?? null });
      const res = gen(env, (r() * 4294967296) >>> 0, place, adv.runSeed);
      if (res.lordType) MTYPES['lord'] = res.lordType;
      if (res.beastType) MTYPES['X'] = res.beastType;
      const D = res.level;
      here.D = D;
      here.fixtures = D.fixtures;
      here.finalSt = null;
      here.webMsg = chance(0.3);
      here.webBurnMsg = chance(0.3);
      const floors = [];
      for (let i = 0; i < NCELL; i++) if (D.tile[i] === TF) floors.push(i);
      const cellNear = (x, z, rr) => {
        const cx = Math.floor((x + (r() - 0.5) * rr) / CELL),
          cz = Math.floor((z + (r() - 0.5) * rr) / CELL);
        return Math.max(0, Math.min(NCELL - 1, cz * MW + cx));
      };
      // プレイヤーを置く所：どれかの物のそば（初めは、床のどこか）
      const c0 = pick(floors),
        [px, pz] = cpos(c0);
      Object.assign(player, { x: px, z: pz });
      // 足す物：全部の種類の備品（半分ほど。灯りは本物の灯りの番号か、無い番号）
      for (const type of FIX_TYPES) {
        if (!chance(0.5)) continue;
        const x = px + (r() - 0.5) * 30,
          z = pz + (r() - 0.5) * 30,
          nx = pick([1, -1, 0]),
          nz = nx ? 0 : pick([1, -1]);
        const f = {
          type,
          x,
          z,
          col: [r() * 1.2, r() * 1.2, r() * 1.2],
          li: chance(0.9) && D.lights.length ? Math.floor(r() * D.lights.length) : 99999,
          acc: r() * 2,
          ph: r() * 6.28,
        };
        if (type === 'torch' || chance(0.1)) Object.assign(f, { nx, nz, wx: x - nx * 0.5, wz: z - nz * 0.5 });
        if (chance(0.5))
          f.wd = pick([
            [1, 0],
            [0, -1],
            [-1, 0],
            [0, 1],
          ]);
        if (chance(0.5)) f.active = chance(0.5);
        if (type === 'bloodwort' && chance(0.3)) f.burst = true;
        // 噴気孔の残りの秒は、ちょうど 0 になる値（dt と同じ）も
        if (type === 'vent' && chance(0.5))
          Object.assign(f, { next: chance(0.3) ? pick([0.1, 0.5]) : r() * 3 - 0.5, erupt: chance(0.5) ? r() * 2 : 0 });
        if (type === 'lava' && chance(0.5)) Object.assign(f, { burst: r() - 0.3, bx: x, bz: z, bt: r() * 1.2 });
        here.fixtures.push(f);
      }
      for (const L of D.lights) {
        if (chance(0.2)) L.fade = r();
        if (chance(0.2)) L.boost = r();
      }
      D.collapsed = chance(0.5);
      // 支道の入口と異界の門（本物の階には、決まった深さにしか無いので、足して全部の種類を通す）。支道の奥の階が3つ以上ある時も
      if (chance(0.25)) D.bstairs = { key: pick(Object.keys(BRANCHES)), cell: cellNear(px, pz, 20) };
      if (chance(0.25)) D.portal = { key: pick([...Object.keys(REALMS), 'none']), cell: cellNear(px, pz, 20) };
      if (here.branch && chance(0.3)) here.branch = { ...here.branch, len: here.branch.len + 1 };
      // 巣（本物が無ければ、足す）と、マス → 巣
      if (!D.webs.length || chance(0.3))
        for (let k = 0; k < 4; k++) D.webs.push({ i: cellNear(px, pz, 30), ax: pick([0, 1]), gone: chance(0.1) });
      D.webAt = new Map();
      for (const w of D.webs) {
        if (chance(0.3)) w.shake = r() * 1.5;
        if (chance(0.2)) w.touchT = r() * 200;
        D.webAt.set(w.i, w);
      }
      // 火（燃えている一覧には、同じマスが2回入ることも、火の消えたマスもある）・凍ったマス・火の明かり
      blaze.fire = new Float32Array(NCELL);
      blaze.fireLight = new Float32Array(NCELL);
      blaze.burning = [];
      for (let k = 0; k < 12; k++) {
        const i = chance(0.3) && D.webs.length ? pick(D.webs).i : cellNear(px, pz, 50);
        blaze.fire[i] = chance(0.15) ? 0 : r() * 1.2;
        blaze.fireLight[i] = r() * 2;
        blaze.burning.push(i);
        if (chance(0.1)) blaze.burning.push(i);
      }
      blaze.frozen = new Map();
      for (let k = 0; k < 5; k++) blaze.frozen.set(cellNear(px, pz, 50), { t: chance(0.2) ? 5 : r() * 10, liq: 0, surf: 0 });
      // 床の物：泉・墓（ルーンつき）・伝説の物
      for (let k = 0; k < 6; k++) {
        const i = cellNear(px, pz, 40),
          kind = pick(['spring', 'grave', 'legend', 'rune']);
        const it = { i, kind, taken: chance(0.25) };
        if (kind === 'grave')
          it.rune = { uid: 100 + k, type: pick([...RUNE_TYPES.atk, ...RUNE_TYPES.elem, ...RUNE_TYPES.body]), strong: chance(0.3) };
        if (kind === 'legend') it.legend = pick(LEGEND_ORDER);
        D.items.push(it);
      }
      // 年代記と伝説の物（手にした物）
      adv.HIST = chance(0.9) ? makeHistory(adv.runSeed) : null;
      saved.LEGEND = null;
      const L = getLegend();
      if (L) {
        for (const k of LEGEND_ORDER) if (chance(0.5)) L.have.add(k);
      }
      // 生き物：扉のそば・クモ・階段の番（群れ 1）・ほか
      here.monsters = [];
      const mon = (key, x, z, extra = {}) => {
        const m = {
          key,
          ty: MTYPES[key],
          x,
          z,
          y: chance(0.8) ? r() : undefined,
          g: -1,
          aware: chance(0.8) ? r() : undefined,
          sleep: chance(0.5),
          dead: chance(0.1),
          ...extra,
        };
        here.monsters.push(m);
        return m;
      };
      for (const d of D.doors) if (chance(0.15)) mon(pick(kinds), d.bx + (r() - 0.5) * 3, d.bz + (r() - 0.5) * 3);
      for (let k = 0; k < 3; k++) mon(pick(spiders), px + (r() - 0.5) * 50, pz + (r() - 0.5) * 50);
      for (let k = 0; k < 3; k++) mon(pick(kinds), px + (r() - 0.5) * 30, pz + (r() - 0.5) * 30, { g: chance(0.6) ? 1 : 2 });
      if (chance(0.6)) D.stairGuard = chance(0.8) ? 1 : 3;
      if (chance(0.3)) D.sealOpenMsg = true;
      if (chance(0.3)) D.sealSnd = r() * 300;
      for (const d of D.doors) {
        if (chance(0.1)) d.gone = true;
        if (chance(0.3)) d.o = r();
        if (chance(0.2)) d.creaked = chance(0.5);
      }
      // 稲妻・遅れて落ちる稲妻・床の目印・稲妻の光り
      const zapLog = [];
      const pt = () => [px + (r() - 0.5) * 20, r() * 3, pz + (r() - 0.5) * 20];
      fight.boltFx = [];
      for (let k = 0; k < 3; k++) {
        const a = pt(),
          b = pt(),
          amp = r() * 0.4;
        const life = 0.3 + r() * 0.1;
        // 消える時刻ちょうどの稲妻も（dt が 0 の時に、消えるかの境目を通る）
        fight.boltFx.push({
          a,
          b,
          col: [r(), r(), r()],
          style: pick(['thunder', 'fire', 'ice', 'spark']),
          amp,
          t: chance(0.2) ? life : r() * 0.4,
          life,
          re: r() * 0.1 - 0.02,
          pts: jagged(a, b, amp),
        });
      }
      fight.zapQueue = [];
      for (let k = 0; k < 3; k++) {
        const id = k;
        fight.zapQueue.push({
          t: chance(0.2) ? 0 : r() * 0.2,
          done: chance(0.1),
          fn: () => {
            zapLog.push(id);
            if (id === 0) F.addBolt(pt(), pt(), [1, 1, 1]);
            if (id === 1) fight.zapQueue.push({ t: 0, fn: () => zapLog.push('again') });
          },
        });
      }
      fight.marks = Array.from({ length: 3 }, () => ({
        x: px + (r() - 0.5) * 10,
        z: pz + (r() - 0.5) * 10,
        r: r() * 2,
        t: 1,
        c: [r(), r(), r()],
        ...(chance(0.5) ? { star: chance(0.7) } : {}),
      }));
      // 魔法の場（性質の無い場も）
      fight.zones = Array.from({ length: 3 }, () => {
        const r0 = r() * 3;
        return {
          x: px + (r() - 0.5) * 50,
          z: pz + (r() - 0.5) * 50,
          r: r0,
          r0,
          sp: null,
          el: chance(0.2) ? null : pick(['fire', 'ice', 'thunder', 'poison', ...RUNE_TYPES.elem]),
          t: r() * 3,
          tick: 0,
          grow: false,
        };
      });
      vfx.zapFlash = chance(0.3) ? null : { x: px, y: 1, z: pz, col: [1, 1, 1], t: chance(0.3) ? 999 : r(), r: 8 };
      ui.gallery = chance(0.1) ? { mode: 'beast' } : null;
      clock.time = 50 + r() * 200;
      // 音：鳴らせる時と、鳴らせない時
      SND.on = chance(0.8);
      alog.length = 0;
      msgs.length = 0;
      buf.pN = chance(0.1) ? 9990 : 0;
      // プレイヤーを、どれかの物のそばに置き直す
      const spots = [
        ...here.fixtures.map((f) => [f.x, f.z]),
        ...D.doors.map((d) => [d.bx, d.bz]),
        ...D.webs.map((w) => cpos(w.i)),
        ...D.items.map((it) => cpos(it.i)),
        ...(D.stairs >= 0 ? [cpos(D.stairs), cpos(D.stairs)] : []),
        ...(D.bstairs ? [cpos(D.bstairs.cell)] : []),
        ...(D.portal ? [cpos(D.portal.cell)] : []),
      ];
      const blood = here.fixtures.filter((f) => f.type === 'bloodwort' || f.type === 'portal').map((f) => [f.x, f.z]);
      const placeNear = () => {
        const fromBlood = blood.length > 0 && chance(0.15),
          [sx, sz] = fromBlood ? pick(blood) : pick(spots),
          // 境目のすぐ内と外（ブラッドワート 2.3・扉 2.7・階段の封の音 12・手がかり 20・伝説の物の印 30）も通す
          d = chance(fromBlood ? 0.3 : 0.05)
            ? 0
            : chance(0.15)
              ? pick([2.3, 2.7, 12, 20, 30]) + (chance(0.5) ? -0.02 : 0.02)
              : chance(0.3)
                ? r() * 2.5
                : r() * r() * 50,
          a = r() * 6.28;
        Object.assign(player, { x: sx + Math.cos(a) * d, z: sz + Math.sin(a) * d });
      };
      placeNear();
      const tdt = () => [clock.time, pick([0, 1 / 60, 1 / 30, 0.1, 0.5, 2])];
      const someMon = () => (here.monsters.length ? pick(here.monsters) : { x: px, z: pz, y: 0, ty: MTYPES['k'] });
      const ops = [
        ['drawFixtures', tdt],
        ['drawFixtures', tdt],
        ['drawDoors', tdt],
        ['drawSprings', () => [clock.time]],
        ['drawGraves', () => [clock.time]],
        ['drawWebs', () => [clock.time]],
        ['webTouch', () => [chance(0.7) && D.webs.length ? pick(D.webs).i : pick(floors)]],
        ['drawFire', tdt],
        ['drawFrozen', () => [clock.time]],
        ['drawZones', () => [clock.time]],
        ['addBolt', () => [pt(), pt(), [r(), r(), r()], pick([undefined, 'thunder', 'fire', 'ice', 'spark'])]],
        ['sparkCrown', () => [someMon(), [r(), r(), r()]]],
        ['drawBoltFx', tdt],
        ['computeOmen', () => []],
        ['omenOf', () => (chance(0.5) && delete D.omen, [])],
        ['drawOmens', tdt],
        ['drawOmens', tdt, 3],
        [
          'omenSound',
          () => [
            pick(['drip', 'chime', 'chant', 'rumble', 'growl', 'whisper', 'wind', 'hiss', 'bubble', 'scuttle', 'none']),
            player.x + r() * 12,
            player.z,
          ],
        ],
        ['stairsGuarded', () => []],
        ['drawStairSeal', () => [clock.time]],
        ['interAt', () => [pick([...Object.keys(SPECIALS), 'none'])]],
        ['interAfter', () => [Math.floor(r() * 12)]],
        ['legendOfBranch', () => [pick([...Object.keys(BRANCHES), 'none'])]],
        ['legendAll', () => []],
        ['descentSealed', () => []],
        ['drawLegendWorld', () => [clock.time]],
        ['ceilAt', () => [player.x + (r() - 0.5) * 300, player.z + (r() - 0.5) * 300]],
      ];
      const calls = [];
      /** name の関数を、引数 a で times 回呼び、記録を足す */
      const run = (name, a, times = 1) => {
        buf.dn = 0;
        const pN0 = buf.pN,
          mr0 = mrN,
          snd0 = sndN,
          al0 = alog.length,
          ms0 = msgs.length;
        let ret,
          threw = false;
        try {
          for (let k = 0; k < times; k++) ret = F[name](...a);
        } catch {
          threw = true;
        }
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
          msg: msgs.slice(ms0).map((m) => m.html),
        });
      };
      for (let n = 0; n < 14; n++) {
        if (chance(0.3)) placeNear();
        clock.time += r() * 3;
        const [name, args, times = 1] = pick(ops);
        run(name, args(), times);
      }
      // 場面：10の場合に1つ、弾けていないブラッドワートのそばに立って描く（ランダムな置き方だけでは、場合の並びで出たり出なかったりするので）
      if (s % 10 === 0 && D.lights.length) {
        here.fixtures.push({ type: 'bloodwort', x: player.x + 1, z: player.z, col: [1, 0.3, 0.35], li: 0, acc: 0, ph: 0 });
        run('drawFixtures', [clock.time, 1 / 30]);
      }
      // 最後の状態：備品・灯り・扉・巣・生き物・稲妻・遅れて落ちる稲妻・稲妻の光り・手がかり・階段の封・伝言の旗
      const state = {
        fix: here.fixtures.map((f) => [f.acc, f.burst, f.next, f.erupt, f.bx, f.bz, f.bt]),
        lights: D.lights.map((L) => [L.fade, L.boost]),
        doors: D.doors.map((d) => [d.o, d.creaked, d.gone]),
        webs: D.webs.map((w) => [w.gone, w.shake, w.touchT]),
        mons: here.monsters.map((m) => [m.aware, m.sleep, m.wait, m.goal, m.goalT, m.hitT, m.glow, m.heartOn]),
        bolts: fight.boltFx,
        zaps: fight.zapQueue.map((z) => [z.t, z.done]),
        zapLog,
        flash: vfx.zapFlash,
        omen: D.omen,
        seal: [D.sealSnd, D.sealOpenMsg],
        flags: [here.webMsg, here.webBurnMsg],
        legend: L && L.have,
      };
      out.push(text({ s, place, calls, state }));
    }
  } finally {
    restoreGlobals();
    Math.random = keep.random;
    setSoundRand(keep.sound);
    restore(here, keep.here);
    Object.assign(adv, keep.adv);
    restore(player, keep.player);
    restore(ui, keep.ui);
    restore(vfx, keep.vfx);
    restore(blaze, keep.blaze);
    restore(fight, keep.fight);
    saved.LEGEND = keep.saved.LEGEND;
    restore(SND, keep.SND);
    restore(buf, keep.buf);
    clock.time = keep.time;
    msgs.splice(0, msgs.length, ...keep.msgs);
    if (keep.lord) MTYPES['lord'] = keep.lord;
    else delete MTYPES['lord'];
    if (keep.X) MTYPES['X'] = keep.X;
    else delete MTYPES['X'];
  }
  return out.join('\n');
}
