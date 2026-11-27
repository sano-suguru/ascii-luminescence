// テストの道具：世界の中の手がかりと詠唱の見た目（src/lib/arrows.ts の arrowTargets・inPlainSight・drawArrows、camera.ts の updateSectionAir、
// fixtures.ts の drawRunesWorld、chantfx.ts の simPath・drawCastFx・updateCross）を、たくさんの場合で呼び、結果を1つの文字列にまとめる。
// F は関数をまとめた物。hints.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の全部の場所）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、本物の階に、祭壇の組（ルーン・鍛え・癒し・枠を開ける・まだ中身の無い物・番人のいる物・主の物）・台・主の褒美・宝物庫の褒美（番人・崩れる・何も無い）・
// 空の枠・泉・墓・石碑・分かれ道・階段までの距離・支道の階段・異界の門・宝物庫の門・光線・飛ぶ物（矢・玉・剣の波・突き）と、生き物（番人の群れ・見えている敵・
// 穏やかな物・倒れた物）を足し、プレイヤーの位置・向き・見上げる角度・1人称か3人称か、両手の武器と性質、溜め（どちらの手か・溜まり具合・溜めきった・音節が光る）、
// 付け替えの途中、見たマス、矢印のキャンバスの大きさと画面の倍率・下の HUD の位置（隠れている・無い・大きさを見ていない）、照準の文字の要素（無い時も）を変えて、関数を続けて呼ぶ。
// 記録するのは、返す値・置いた文字と出した粒子の配列の中身・見た目の乱数を引いた数・偽の描き手にした全部のこと・照準の文字の要素に書いた物・
// 後処理の uniform に書いた物・状態の変わり方（ui と vfx の欄・祭壇の中身・宝物庫の褒美のまわりの床）。
// テストを .mjs で書くのは、偽の描き手・キャンバス・画面の部品を、本物の型に合わせられないため。書き換えた状態と document・window・Math.random は、終わったら元に戻す。
import { MTYPES } from '../../src/lib/creatures.ts';
import { makeRune } from '../../src/lib/gear.ts';
import { P, dCol, dPar, dPos } from '../../src/lib/particles.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES } from '../../src/lib/runes.ts';
import { adv, buf, clock, fight, gear, gfx, here, player, ui, vfx } from '../../src/lib/state.ts';
import { CELL, MW, NCELL, TF, cpos } from '../../src/lib/world.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';

const PROPS = ['fillStyle', 'strokeStyle', 'shadowColor', 'shadowBlur', 'font', 'textAlign', 'textBaseline', 'lineJoin', 'lineWidth'],
  METHODS = [
    'clearRect',
    'fillText',
    'strokeText',
    'beginPath',
    'arc',
    'fill',
    'stroke',
    'setTransform',
    'save',
    'restore',
    'translate',
    'scale',
  ];
/** 偽のキャンバスと描き手。描き手にしたことを log に1行ずつ書く（数は String のまま。丸めない） */
export function fakeArrowCanvas() {
  const log = [],
    ctx = {},
    vals = {};
  let grads = 0;
  for (const p of PROPS)
    Object.defineProperty(ctx, p, {
      get: () => vals[p],
      set: (v) => {
        vals[p] = v;
        log.push(`${p}=${typeof v === 'string' || typeof v === 'number' ? String(v) : v.id}`);
      },
    });
  for (const m of METHODS) ctx[m] = (...a) => void log.push(`${m}(${a.map(String).join(',')})`);
  ctx.createRadialGradient = (...a) => {
    const id = `grad${++grads}`;
    log.push(`${id}=createRadialGradient(${a.map(String).join(',')})`);
    return { id, addColorStop: (o, c) => void log.push(`${id}.addColorStop(${o},${c})`) };
  };
  const cv = { clientWidth: 960, clientHeight: 540, getContext: (k) => (k === '2d' ? ctx : null) },
    sizes = [];
  // キャンバスの大きさを書いた時も記録する
  for (const p of ['width', 'height']) {
    let v = 300;
    Object.defineProperty(cv, p, {
      get: () => v,
      set: (x) => {
        v = x;
        sizes.push(`${p}=${x}`);
      },
    });
  }
  return { cv, ctx, log, sizes };
}

/** 配列の中身の指紋（Float32Array のバイト列） */
const hashArr = (a, from, to) => {
  const b = new Uint8Array(a.buffer, a.byteOffset + from * a.BYTES_PER_ELEMENT, (to - from) * a.BYTES_PER_ELEMENT);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ (b[i] ?? 0), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** 値を1つの文字列にする（NaN・Infinity・undefined も見分ける。生き物は並びの番号だけ） */
const text = (v) =>
  JSON.stringify(v, (k, x) =>
    x === undefined
      ? 'undefined'
      : typeof x === 'number' && !Number.isFinite(x)
        ? String(x)
        : typeof x === 'function'
          ? 'fn'
          : x && typeof x === 'object' && 'ty' in x && 'key' in x
            ? `mob${here.monsters.indexOf(x)}`
            : x,
  );
/** 写しから元に戻す（写しに無い欄は消す） */
const restore = (obj, copy) => {
  for (const k of Object.keys(obj)) if (!(k in copy)) delete obj[k];
  Object.assign(obj, copy);
};

const ATK = ['blade', 'bolt', 'orb', 'beam', 'dash', 'rain', 'rapid', 'star', 'gsword', 'mstaff'];

/** seeds：場合の数。返り値は、場合ごとの1行 */
export async function hintsCases(F, seeds) {
  const env = await loadEnv(),
    out = [];
  const keep = {
    here: { ...here },
    adv: { ...adv },
    player: { ...player },
    ui: { ...ui },
    vfx: { ...vfx },
    fight: { ...fight },
    gear: { ...gear },
    gfx: { ...gfx },
    buf: { ...buf },
    time: clock.time,
    lord: MTYPES['lord'],
    X: MTYPES['X'],
    random: Math.random,
  };
  const crossEl = { textContent: '', className: '', style: { color: '' } },
    page = { cross: crossEl },
    win = { devicePixelRatio: 1 };
  const restoreGlobals = swapGlobals({
    document: { getElementById: (id) => page[id] ?? null },
    devicePixelRatio: 1,
  });
  // 階（場合ごとに作ると遅いので、いくつかを使い回す。足した物は場合ごとに作り直す）
  const levels = PLACES.filter((_, k) => k % 3 === 0).map((p, k) => ({ p, res: gen(env, 9100 + k * 53, p, 4242 + k) }));
  try {
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 48271 + 11),
        pick = (a) => a[Math.floor(r() * a.length)],
        chance = (p) => r() < p;
      let mrN = 0;
      const mrSrc = mulberry32(s * 7919 + 3);
      Math.random = () => (mrN++, mrSrc());
      const L0 = levels[Math.floor(s / 3) % levels.length],
        place = L0.p;
      // 階は写して使う（足した物や、祭壇を埋めた中身を、次の場合に残さない）
      const D = {
        ...L0.res.level,
        items: L0.res.level.items.map((it) => ({ ...it })),
        rooms: L0.res.level.rooms,
      };
      if (L0.res.lordType) MTYPES['lord'] = L0.res.lordType;
      if (L0.res.beastType) MTYPES['X'] = L0.res.beastType;
      Object.assign(here, { D, depth: place.depth, branch: place.branch ?? null, realm: place.realm ?? null, inter: place.inter ?? null });
      adv.runSeed = (r() * 4294967296) >>> 0;
      adv.dead = chance(0.05);
      const floors = [];
      for (let i = 0; i < NCELL; i++) if (D.tile[i] === TF) floors.push(i);
      const c0 = pick(floors),
        [px, pz] = cpos(c0);
      Object.assign(player, {
        x: px + (r() - 0.5) * 3,
        z: pz + (r() - 0.5) * 3,
        yaw: r() * 6.28 - 3.14,
        pitch: chance(0.2) ? pick([-1.2, -0.25, 0.25, 0.35, 1.2]) : (r() - 0.5) * 1.4,
        eye: chance(0.8) ? 1.62 : 0.6 + r(),
        roll: null,
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
        return pick(floors);
      };
      ui.camMode = chance(0.25) ? 'tps' : 'fps';
      gfx.camera = { position: { x: player.x, y: player.eye, z: player.z } };
      // 見たマス（全部・何も・まだらに）
      const ex = r();
      here.explored = new Uint8Array(NCELL);
      for (let i = 0; i < NCELL; i++) here.explored[i] = ex < 0.2 ? 1 : ex < 0.3 ? 0 : r() < 0.6 ? 1 : 0;
      // 分かれ道・階段までの距離
      const pc = ((player.z / CELL) | 0) * MW + ((player.x / CELL) | 0),
        myRoom = D.roomOf[pc];
      D.hub = chance(0.3) ? { ri: chance(0.6) && myRoom >= 0 ? myRoom : Math.floor(r() * D.rooms.length), cx: 0, cz: 0 } : undefined;
      if (chance(0.7)) {
        D.dS = new Int32Array(NCELL);
        for (let i = 0; i < NCELL; i++) D.dS[i] = Math.floor(r() * 120);
        D.pathL = pick([0, -1, 50, 100, 120, r() * 150]);
        // 境の 0.7 ちょうどの前後
        if (chance(0.2)) D.dS[pc] = Math.round(D.pathL * 0.7) + pick([-1, 0, 1]);
      } else {
        D.dS = undefined;
        D.pathL = chance(0.5) ? 50 : undefined;
      }
      if (chance(0.1)) D.prof = undefined;
      D.finalVault = chance(0.1);
      if (chance(0.1)) D.stairs = -1;
      else if (chance(0.3)) D.stairs = nearFloor(30);
      D.bstairs = chance(0.4) ? { key: 'crypt', cell: chance(0.1) ? -1 : nearFloor(60) } : null;
      D.portal = chance(0.4) ? { key: 'abyss', cell: nearFloor(60) } : null;
      D.gate = chance(0.3) ? { cell: nearFloor(30) } : null;
      // 生き物：番人の群れ（1・2）・見えている敵・穏やかな物・倒れた物
      here.monsters = [];
      const kinds = Object.keys(MTYPES).filter((k) => MTYPES[k].col && !MTYPES[k].dummy);
      const mon = (extra = {}) => {
        const key = pick(kinds),
          i = nearFloor(chance(0.5) ? 8 : 24),
          [x, z] = cpos(i);
        const m = {
          key,
          ty: MTYPES[key],
          x: x + (r() - 0.5),
          z: z + (r() - 0.5),
          y: chance(0.3) ? r() * 2 : 0,
          g: -1,
          visible: chance(0.8),
          dead: chance(0.1),
          hidden: chance(0.05),
          ...extra,
        };
        here.monsters.push(m);
        return m;
      };
      for (let k = 0; k < 2 + Math.floor(r() * 6); k++) mon({ g: chance(0.4) ? pick([1, 2]) : -1 });
      // 視線の先にも置く（照準の先・術の道の先）
      for (let k = 0; k < 2; k++) {
        const d = 2 + r() * 14,
          cp = Math.cos(player.pitch);
        mon({
          x: player.x - Math.sin(player.yaw) * cp * d + (r() - 0.5) * 0.6,
          z: player.z - Math.cos(player.yaw) * cp * d + (r() - 0.5) * 0.6,
          y: Math.max(0, player.eye + Math.sin(player.pitch) * d - 0.9),
          visible: chance(0.9),
          dead: chance(0.05),
        });
      }
      // 床の物
      const items = D.items;
      const rune = (cat) => makeRune(pick(RUNE_TYPES[cat]));
      for (let g = 0; g < 1 + Math.floor(r() * 3); g++) {
        const grp = `hint${s}-${g}`,
          i0 = nearFloor(chance(0.5) ? 10 : 30),
          forge = chance(0.2),
          lord = chance(0.2),
          guard = chance(0.3) ? pick([1, 2, 3]) : undefined,
          empty = chance(0.4);
        for (let sl = 0; sl < 3; sl++) {
          const it = { i: i0, kind: 'rune', taken: chance(0.05), altar: true, grp, slot: sl, forge, lord, guardG: guard };
          if (!empty) {
            it.opt = pick(['rune', 'rune', 'heal', 'open', 'forge']);
            it.rune = it.opt === 'heal' ? { uid: -1, type: 'heal' } : rune(pick(['elem', 'mod', 'trig', 'body']));
            if (it.opt === 'heal') it.rune = { uid: -1, type: 'fire' };
          } else it.rune = null;
          items.push(it);
        }
      }
      for (let k = 0; k < 3; k++) {
        const kind = pick(['pedestal', 'elite', 'plain', 'slot', 'spring', 'grave', 'vault', 'nothing']),
          i = nearFloor(chance(0.7) ? 14 : 40),
          taken = chance(0.1);
        if (kind === 'pedestal')
          items.push({ i, kind: 'rune', taken, pedestal: true, rune: rune('atk'), slot: chance(0.5) ? k : undefined });
        if (kind === 'elite')
          items.push({ i, kind: 'rune', taken, elitePrize: true, guardG: chance(0.8) ? pick([1, 2]) : undefined, rune: rune('elem') });
        if (kind === 'plain') items.push({ i, kind: 'rune', taken, rune: chance(0.9) ? rune(pick(['elem', 'atk', 'body'])) : null });
        if (kind === 'slot') items.push({ i, kind: 'slot', taken, target: 'slotL' });
        if (kind === 'spring') items.push({ i, kind: 'spring', taken });
        if (kind === 'grave') items.push({ i, kind: 'grave', taken, rune: rune('atk') });
        // 宝物庫の褒美は、乾いた床に置く（まわりに乾いた床が1つも無いと、兆しを描く所が無く、新しい関数は nth で止まる。本物の階では起きない）
        if (kind === 'vault')
          items.push({
            i: D.liquid[i]
              ? (floors.find((c) => !D.liquid[c] && Math.abs((c % MW) - (i % MW)) + Math.abs(((c / MW) | 0) - ((i / MW) | 0)) < 12) ?? i)
              : i,
            kind: 'rune',
            taken,
            vault: true,
            ev: pick(['guard', 'collapse', undefined]),
            rune: rune('elem'),
            ...(chance(0.2) ? { area: { cells: [i, i + 1, i + MW] } } : {}),
          });
      }
      D.steles = chance(0.6)
        ? Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ i: nearFloor(chance(0.5) ? 6 : 40), g: pick(['&', '%', 'ᚦ', '?']) }))
        : undefined;
      // 光線・飛ぶ物
      const pt = () => [player.x + (r() - 0.5) * 12, r() * 3, player.z + (r() - 0.5) * 12];
      fight.beamSegs = chance(0.4)
        ? Array.from({ length: 1 + Math.floor(r() * 2) }, () => ({
            pts: Array.from({ length: 1 + Math.floor(r() * 4) }, pt),
            col: [r(), r(), r()],
            t: 0.1,
          }))
        : [];
      fight.projs = chance(0.5)
        ? Array.from({ length: 1 + Math.floor(r() * 4) }, () => {
            const [x, y, z] = pt(),
              w = pick(['bolt', 'orb', 'wave', 'thrust']);
            return {
              x,
              y,
              z,
              vx: (r() - 0.5) * 20,
              vy: (r() - 0.5) * 2,
              vz: (r() - 0.5) * 20,
              kind: w === 'orb' ? 'orb' : 'bolt',
              wave: w === 'wave',
              thrust: w === 'thrust',
              auto: chance(0.2),
              big: chance(0.3),
              cw: chance(0.5) ? 1.6 : undefined,
              t: r() * 0.4,
              maxT: 0.5,
              sp: { h: pick(['L', 'R']), elem: pick([null, 'fire', 'ice', 'thunder', 'poison']) },
            };
          })
        : [];
      // 両手と溜め・付け替え
      const hand = (w) => ({
        atk: makeRune(w),
        slots: [chance(0.5) ? rune('elem') : null, chance(0.3) ? rune('mod') : null],
        slotN: 2,
        turn: 0,
        elem: null,
        trig: null,
      });
      gear.hands = chance(0.05) ? null : { L: hand(pick(ATK)), R: hand(pick(ATK)), B: { b0: null, b1: null } };
      if (gear.hands && chance(0.3)) {
        const two = pick(['gsword', 'mstaff', 'bolt', 'rain']);
        gear.hands.L.atk = gear.hands.R.atk = makeRune(two);
      }
      if (gear.hands) for (const h of ['L', 'R']) if (chance(0.6)) gear.hands[h].elem = rune('elem');
      gear.bag = Array.from({ length: Math.floor(r() * 4) }, () => rune(pick(['elem', 'mod', 'trig', 'body', 'atk'])));
      const castSt = () =>
        chance(0.3)
          ? null
          : {
              h: pick(['L', 'R']),
              t: pick([0, 0.1, 0.5, 1, 2, r()]),
              need: pick([0, 0.005, 0.5, 1]),
              full: chance(0.3),
              hold: 0,
              beam: false,
              firing: false,
              tick: 0,
              beamT: 0,
              ...(chance(0.6) ? { sylT: clock.time - pick([0, 0.1, 0.15, 0.17, 0.5]), syl: Math.floor(r() * 9) } : {}),
            };
      gear.swapSt = chance(0.2) ? { t: r() * 1.2, dur: 1, snap: null, last: 0 } : null;
      clock.time = 30 + r() * 200;
      gear.castSt = castSt();
      // 画面の開け閉め
      ui.started = chance(0.9);
      ui.gallery = chance(0.05) ? { mode: 'beast' } : null;
      ui.invOpen = chance(0.05);
      ui.menuOpen = false;
      ui.portrait = false;
      ui.crossMon = chance(0.3) && here.monsters.length ? pick(here.monsters) : null;
      ui.aimT = clock.time - pick([0, 0.05, 0.2]);
      // 矢印のキャンバス・下の HUD・画面の倍率
      const fc = fakeArrowCanvas();
      fc.cv.clientWidth = pick([960, 750, 1280, 0]);
      fc.cv.clientHeight = pick([540, 312, 720, 450, 200]);
      ui.arrowCv = fc.cv;
      ui.arrowCtx = chance(0.05) ? null : fc.ctx;
      const hb = pick(['shown', 'hidden', 'none']),
        hbTop = pick([fc.cv.clientHeight - 40, fc.cv.clientHeight * 0.5, 30]);
      ui.hotbarEl = hb === 'none' ? null : { getBoundingClientRect: () => ({ top: hbTop, height: hb === 'hidden' ? 0 : 40 }) };
      ui.hotbarWatch = chance(0.6);
      ui.hotbarTop = chance(0.3) ? pick([null, -1, 300]) : null;
      ui.arrowsDrawn = chance(0.5);
      ui.crossKey = chance(0.3) ? `·rgba(225,215,255,.55)` : '';
      page.cross = chance(0.05) ? null : crossEl;
      crossEl.textContent = '';
      crossEl.className = '';
      crossEl.style.color = '';
      win.devicePixelRatio = pick([1, 2, 1.5]);
      globalThis.devicePixelRatio = win.devicePixelRatio;
      // 分け合う値と後処理（書いた物を記録する）
      const uniLog = [];
      gfx.U = { uAmb: { value: 1 } };
      gfx.finalPass = {
        uniforms: { uSlow: { value: 0 }, uTint: { value: { set: (...a) => void uniLog.push(`tint(${a.join(',')})`) } } },
      };
      vfx.ambK = pick([1, 1.25, 0.85, r() + 0.5]);
      vfx.slowFx = pick([0, 1, r()]);
      buf.pN = chance(0.05) ? 9990 : 0;
      // 呼ぶ関数
      const someTarget = () => {
        const ts = F.arrowTargets();
        return ts.length && chance(0.7)
          ? pick(ts)
          : { x: player.x + (r() - 0.5) * 50, z: player.z + (r() - 0.5) * 50, d: pick([5, 21.9, 22, 22.1, 40]), ch: '>', col: [1, 1, 1] };
      };
      const someSpec = () => {
        const h = pick(['L', 'R']);
        return {
          h,
          atk: pick(['orb', 'orb', 'beam', 'bolt', 'rain', 'star']),
          elem: pick([null, 'fire', 'ice']),
          aff: { bounce: pick([0, 0, 1, 2, 3, undefined]), area: pick([0, 50, undefined]) },
          tr: {},
          pow: 1,
        };
      };
      const ops = [
        ['arrowTargets', () => []],
        ['inPlainSight', () => [someTarget()]],
        ['drawArrows', () => []],
        ['drawArrows', () => []],
        ['updateSectionAir', () => [pick([0, 0.016, 1 / 30, 0.5, 2])]],
        ['drawRunesWorld', () => [clock.time]],
        ['drawRunesWorld', () => [clock.time]],
        ['simPath', () => [someSpec()]],
        ['simPath', () => [someSpec()]],
        ['drawCastFx', () => [clock.time]],
        ['drawCastFx', () => [clock.time]],
        ['updateCross', () => [pick([0, 1 / 60, 1 / 30, 0.2, undefined])]],
        ['updateCross', () => [pick([0, 1 / 60, 1 / 30, 0.2, undefined])]],
      ];
      const calls = [];
      const run = (name, a) => {
        buf.dn = 0;
        const pN0 = buf.pN,
          mr0 = mrN,
          cl0 = fc.log.length,
          sz0 = fc.sizes.length,
          un0 = uniLog.length;
        let ret,
          threw = false;
        try {
          ret = F[name](...a);
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
          canvas: fc.log.slice(cl0),
          sizes: fc.sizes.slice(sz0),
          uni: [uniLog.slice(un0), gfx.U.uAmb.value, gfx.finalPass.uniforms.uSlow.value],
          cross: [crossEl.textContent, crossEl.className, crossEl.style.color],
          st: [ui.arrowsDrawn, ui.hotbarTop, ui.crossKey, ui.crossMon, ui.aimT, vfx.ambK, vfx.slowFx],
        });
      };
      for (let n = 0; n < 12; n++) {
        if (chance(0.25)) {
          // 時刻・溜め・向きを少し変える
          clock.time += r() * 0.5;
          if (chance(0.5)) gear.castSt = castSt();
          if (chance(0.3)) player.yaw += (r() - 0.5) * 1.5;
        }
        const [name, args] = pick(ops);
        run(name, args());
      }
      out.push(
        text({
          s,
          calls,
          items: D.items.map((it) => [it.opt, it.rune && it.rune.type, it.forgeK, it.area && it.area.cells.length]),
        }),
      );
    }
  } finally {
    restoreGlobals();
    Math.random = keep.random;
    restore(here, keep.here);
    restore(adv, keep.adv);
    restore(player, keep.player);
    restore(ui, keep.ui);
    restore(vfx, keep.vfx);
    restore(fight, keep.fight);
    restore(gear, keep.gear);
    restore(gfx, keep.gfx);
    restore(buf, keep.buf);
    clock.time = keep.time;
    if (keep.lord) MTYPES['lord'] = keep.lord;
    else delete MTYPES['lord'];
    if (keep.X) MTYPES['X'] = keep.X;
    else delete MTYPES['X'];
  }
  return out.join('\n');
}
