// テストの道具：階を移る処理（src/lib/levels.ts の newLevel・advance・checkEvents・die・newRun など）と、世界の組み立て（build.ts の buildWorld・setFog・updateWater）・
// 火と出来事と塵の用意（ground.ts の initFire、particles.ts の initDust・respawnDust）を、たくさんの場合で呼び、結果を1つの文字列にまとめる。
// F は関数をまとめた物。level.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（newLevel の中の generate）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、探索を始め（newRun）、次の場所へ進む向き（下り・上り・支道・異界、押し返される最深部）と着く所を変えながら階を移り、
// 階の中で、階段・支道・門・崩れた穴・封じられた階段を踏む場面と、死んで結果の画面のボタンを押す場面を通す。
// three.js の物（場面・水面の絵・階の文字の部品）は Node でも本物を作り、描画する部品 renderer だけ偽物にする（したことを記録する）。
// 書き換えた状態と、document・window・localStorage・performance・setTimeout・Math.random・音の乱数は、終わったら元に戻す。
import { sndInit } from '../../src/lib/audio.ts';
import { addLooks } from '../../src/lib/bodies/build.ts';
import { resetGlyphWork } from '../../src/lib/build.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { getLegend } from '../../src/lib/legend.ts';
import { P } from '../../src/lib/particles.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { DUST_N } from '../../src/lib/shaders.ts';
import {
  SND,
  adv,
  blaze,
  buf,
  clock,
  dust,
  edge,
  fight,
  gear,
  gfx,
  here,
  hudInfo,
  keys,
  lantern,
  msgs,
  placeMem,
  player,
  saved,
  stealth,
  ui,
  vfx,
} from '../../src/lib/state.ts';
import { T, fogCol } from '../../src/lib/three.ts';
import { BRANCHES, CELL, FINAL_DEPTH, MH, MW, NCELL, REALMS, SF_HAY, TF, TP } from '../../src/lib/world.ts';
import { fakeAudioClass } from './fake-audio.mjs';
import { fakeCamera, fakeDom, fakeTimers, fakeUniforms, hashArr } from './fight-cases.mjs';
import { swapGlobals } from './ui-cases.mjs';

/** 移した関数の名前（場合が全部を呼ぶか、level.test.mjs が確かめる） */
export const NAMES = [
  'placeKey',
  'advance',
  'generate',
  'setupFinal',
  'strataGrowth',
  'settleSlotPick',
  'showStratum',
  'initEvents',
  'computeFOV',
  'checkEvents',
  'newLevel',
  'die',
  'newRun',
  'initFire',
  'initDust',
  'respawnDust',
  'setFog',
  'updateWater',
  'buildWorld',
];
const FN_FIELDS = [
  ['advance', 'bounced'],
  ['showStratum', 't'],
  ['updatePlayer', 'sealT'],
  ['hurtPlayer', 'mt'],
  ['hurtPlayer', 'mc'],
];

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** 値を1つの文字列にする（three.js の物は、配列の指紋と数だけ。生き物は並びの番号） */
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
              ? { map: [...x] }
              : ArrayBuffer.isView(x)
                ? hashArr(x)
                : k === 'ty' && x && typeof x === 'object'
                  ? (x.name ?? 'ty')
                  : (k === 'form' || k === 'formSleep' || k === 'drawForm') && Array.isArray(x)
                    ? fnv(JSON.stringify(x))
                    : k === 'leader' && x && typeof x === 'object'
                      ? `#${here.monsters.indexOf(x)}`
                      : x,
  );
const restore = (obj, copy) => {
  for (const k of Object.keys(obj)) if (!(k in copy)) delete obj[k];
  Object.assign(obj, copy);
};
/** 階の文字の部品（区切りごとの文字の数・置き方・属性）と、壁の向こうを隠す板の指紋 */
const worldPrint0 = () =>
  fnv(
    gfx.chunks
      .map((c) => {
        const g = c.mesh.geometry;
        return [
          c.count,
          ...Object.keys(g.attributes).map((k) => `${k}:${hashArr(g.attributes[k].array)}`),
          `index:${hashArr(g.index.array)}`,
          c.sphere.center.x,
          c.sphere.center.y,
          c.sphere.center.z,
          c.sphere.radius,
        ].join(',');
      })
      .join('|') +
      '#' +
      (gfx.occMesh ? hashArr(gfx.occMesh.geometry.attributes.position.array) : 'none') +
      '#' +
      gfx.scene.children.length,
  );
/**
 * worldPrint0 を、部品が作り直された時だけ数え直す（呼ぶたびに全部の配列の指紋を取ると、テストの時間の半分以上になるため）。
 * 作り直したかは、区切りの配列・各区切りの Mesh と幾何・隠す板とその幾何・場面の子の数が、前と同じ物かで見る（buildWorld は毎回これらを新しく作り、ほかの所は書き換えない）。
 * buildWorld を、これらを使い回して中身だけ書き換える形に変えたら、この見分け方も変えること（変えないと、違いを見逃す）
 */
const worldKey = () => [
  gfx.chunks,
  gfx.occMesh,
  gfx.occMesh && gfx.occMesh.geometry,
  gfx.scene.children.length,
  ...gfx.chunks.flatMap((c) => [c.mesh, c.mesh.geometry]),
];
let lastWorld = { key: [], print: '' };
const worldPrint = () => {
  const key = worldKey();
  if (key.length !== lastWorld.key.length || key.some((k, i) => k !== lastWorld.key[i])) lastWorld = { key, print: worldPrint0() };
  return lastWorld.print;
};
/** seeds：場合の数。page：fakeDom() の偽の画面 */
export async function levelCases(F, seeds, page) {
  const out = [];
  lastWorld = { key: [], print: '' };
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
    lantern: { ...lantern },
    hudInfo: { ...hudInfo },
    keys: { ...keys },
    saved: { ...saved },
    time: clock.time,
    lord: MTYPES['lord'],
    X: MTYPES['X'],
    random: Math.random,
    sound: setSoundRand(Math.random),
    msgs: [...msgs],
    mem: [...placeMem],
    fog: fogCol.clone(),
  };
  const LOOK_FIELDS = ['look', 'form', 'trail', 'col', 'lcol'],
    keptTypes = Object.entries(MTYPES).map(([k, t]) => [k, LOOK_FIELDS.map((f) => [f, Object.getOwnPropertyDescriptor(t, f)])]);
  addLooks();
  const alog = [],
    stored = [],
    rlog = [],
    timers = fakeTimers();
  let msgN = 0;
  msgs.push = (...a) => (msgN++, Array.prototype.push.apply(msgs, a));
  const restoreGlobals = swapGlobals({
    document: page.document,
    window: { AudioContext: fakeAudioClass(alog, 'running') },
    localStorage: { setItem: (k, v) => stored.push([k, v]), getItem: () => null },
    performance: { now: () => clock.time * 1000 },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });
  try {
    Math.random = mulberry32(2);
    Object.assign(SND, { ctx: null, master: null, inp: null, wet: null, noise: null, on: true });
    sndInit();
    // three.js の物は、乱数を数える前に作る（作る時に Math.random を引く）
    gfx.scene = new T.Scene();
    gfx.staticMat = new T.ShaderMaterial();
    gfx.occMat = new T.ShaderMaterial();
    gfx.waterTex = new T.DataTexture(new Float32Array(NCELL * 4), MW, MH, T.RGBAFormat, T.FloatType);
    gfx.waterLTex = new T.DataTexture(new Float32Array(NCELL * 4), MW, MH, T.RGBAFormat, T.FloatType);
    gfx.renderer = { setClearColor: (c, a) => rlog.push([c.r, c.g, c.b, a]) };
    gfx.chunks = [];
    gfx.occMesh = null;
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 16807 + 5),
        pick = (a) => a[Math.floor(r() * a.length)],
        chance = (p) => r() < p;
      let mrN = 0;
      const mrSrc = mulberry32(s * 7919 + 53);
      Math.random = () => (mrN++, mrSrc());
      let sndN = 0;
      const sndSrc = mulberry32(s * 104729 + 59);
      setSoundRand(() => (sndN++, sndSrc()));
      for (const [f, k] of FN_FIELDS) delete F[f][k];
      page.reset();
      timers.clear();
      stored.length = 0;
      alog.length = 0;
      rlog.length = 0;
      msgs.length = 0;
      placeMem.clear();
      gfx.camera = fakeCamera();
      gfx.U = { ...fakeUniforms(), uFogDen: { value: 0.05 } };
      gfx.cellTex = { needsUpdate: false };
      Object.assign(ui, {
        started: chance(0.9),
        gallery: null,
        godMode: false,
        helpOn: chance(0.3),
        locked: chance(0.5),
        invOpen: false,
        camMode: 'fps',
      });
      here.lastStratum = null;
      here.showroomGen = false;
      saved.META = { lore: chance(0.5) ? 0 : Math.floor(r() * 100), spent: 0, unl: [], grave: null, trials: chance(0.3) ? ['dusk'] : [] };
      saved.DEVALL = chance(0.5);
      saved.BOOK = new Set();
      saved.RSEEN = new Set(chance(0.5) ? ['blade', 'bolt'] : []);
      saved.LEGEND = null;
      adv.HIST_SEED = -1;
      adv.won = false;
      adv.dead = chance(0.1);
      clock.time = 10 + r() * 50;
      player.fall = false;
      const calls = [];
      const state = () =>
        text({
          place: [here.depth, here.branch, here.realm, here.inter, here.arrive, here.trans, here.lockCell],
          player: { ...player },
          mons: here.monsters,
          adv: {
            seed: adv.runSeed,
            lvl: adv.lvl,
            runStats: adv.runStats,
            runState: adv.runState,
            dead: adv.dead,
            max: adv.PLAYER_MAX,
            trials: adv.runTrials,
          },
          here: {
            explored: hashArr(here.explored),
            mem: hashArr(here.mem),
            fovVis: hashArr(here.fovVis),
            fovStamp: here.fovStamp,
            events: here.events,
            river: here.riverCells.length,
            finalSt: here.finalSt,
            visited: here.visitedRooms,
            stairsSeen: here.stairsSeen,
            flags: [here.webMsg, here.brimMsg, here.repairMsg, here.webBurnMsg],
          },
          D: here.D && {
            items: here.D.items,
            finalVault: here.D.finalVault,
            pit: here.D.pit,
            collapsed: here.D.collapsed,
            engrSeen: here.D.engrSeen,
            web: here.D.webAt && here.D.webAt.size,
          },
          blaze: {
            fire: hashArr(blaze.fire),
            fuel: hashArr(blaze.fuel),
            burnt: hashArr(blaze.burnt),
            scent: hashArr(blaze.scent),
            src: blaze.fireSrc,
            frozen: blaze.frozen.size,
          },
          dust: Object.values(dust).map((a) => hashArr(a)),
          water: [hashArr(gfx.waterTex.image.data), hashArr(gfx.waterLTex.image.data)],
          fog: [fogCol.x, fogCol.y, fogCol.z, gfx.fogBase, gfx.U.uFogDen.value, gfx.U.uAmb.value],
          rlog,
          world: gfx.chunks.length ? worldPrint() : '',
          glyphs: hudInfo.glyphCount,
          explored: hudInfo.explored,
          ui: [ui.graveCands.map((x) => x.uid), ui.graveSel, ui.tallMsg, ui.gallery],
          hands: gear.hands,
          lantern,
          edge,
          stealth: [stealth.sneak, stealth.hudKey],
          pN: buf.pN,
          meta: saved.META,
          mem: [...placeMem.keys()],
          fn: FN_FIELDS.map(([f, k]) => F[f][k]),
          lord: MTYPES['lord'] && MTYPES['lord'].name,
          X: MTYPES['X'] && MTYPES['X'].name,
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
          ret: name === 'generate' ? fnv(text(ret)) : text(ret),
          threw,
          mr: mrN - m0,
          snd: sndN - s0,
          msg: msgN - g0,
          timers: timers.st.n - t0,
          state: fnv(state()),
          msgs: msgs.map((m) => m.html).join('|'),
        });
        return ret;
      };
      const flush = () => {
        clock.time += 3;
        timers.flush();
      };
      // 探索を始める（墓の記録を持つ・持たない）
      ui.graveCands = chance(0.5) ? [] : [{ uid: 9, type: 'fire' }];
      ui.graveSel = ui.graveCands.length && chance(0.5) ? 1 : 0;
      call('newRun');
      flush();
      // 場面：次の場所へ進む向きと、今いる場所の組み合わせごと（階は作らず、advance だけ）
      {
        const B = pick(Object.values(BRANCHES)),
          R = pick(Object.values(REALMS)),
          L = getLegend(),
          set = (o) => Object.assign(here, { inter: null, realm: null, branch: null, depth: 3 }, o);
        const cases = [
          [{ inter: { key: 'town', after: 2 } }, 'up'],
          [{ realm: { key: R.key, ret: 5 } }, 'up'],
          [{ branch: { key: B.key, lvl: 2, len: 3, ret: 4 } }, 'up'],
          [{ branch: { key: B.key, lvl: 1, len: 3, ret: 4 } }, 'up'],
          [{}, 'up'],
          [{}, 'branch'],
          [{}, 'realm'],
          [{ realm: { key: R.key, ret: FINAL_DEPTH } }, undefined, false],
          [{ realm: { key: R.key, ret: FINAL_DEPTH } }, undefined, true],
          [{ realm: { key: R.key, ret: 6 } }, undefined],
          [{ branch: { key: B.key, lvl: 1, len: 3, ret: 4 } }, undefined],
          [{ branch: { key: B.key, lvl: 3, len: 3, ret: 4 } }, undefined],
          [{ inter: { key: 'oracle', after: 5 } }, undefined],
          [{ depth: FINAL_DEPTH }, undefined],
          [{ depth: FINAL_DEPTH - 1 }, undefined, false],
          [{ depth: FINAL_DEPTH - 1 }, undefined, true],
          [{ depth: 1 }, undefined],
        ];
        for (const [o, go, legends] of cases) {
          set(o);
          if (L && legends !== undefined) L.have = new Set(legends ? Object.keys(L.items) : []);
          if (here.D) {
            here.D.bstairs = go === 'branch' ? { key: B.key, cell: here.D.stairs } : here.D.bstairs;
            here.D.portal = go === 'realm' ? { key: R.key, cell: here.D.stairs } : here.D.portal;
          }
          call('placeKey');
          call('advance', go);
        }
        if (L) L.have = new Set();
      }
      // 場面：階を作る（最深部・支道の奥の主の階・溶岩の海・倒した主の支道・着く所ごと）
      {
        const L = getLegend(),
          B = pick(Object.values(BRANCHES));
        const cases = [
          () => Object.assign(here, { inter: null, realm: null, branch: null, depth: FINAL_DEPTH }),
          () =>
            Object.assign(here, {
              inter: null,
              realm: null,
              depth: B.at[0],
              branch: { key: B.key, lvl: B.len, len: B.len, ret: B.at[0] + 1 },
            }),
          () => {
            Object.assign(here, {
              inter: null,
              realm: null,
              depth: B.at[0],
              branch: { key: B.key, lvl: B.len, len: B.len, ret: B.at[0] + 1 },
            });
            adv.runState.lordsDone.add(B.key);
          },
          () => Object.assign(here, { inter: null, realm: null, branch: null, depth: pick([9, 10, 11]) }),
          () => Object.assign(here, { arrive: 'portal' }),
          () => Object.assign(here, { arrive: 'bstairs' }),
          () => Object.assign(here, { arrive: 'stairs' }),
        ];
        for (const c of cases) {
          if (!chance(0.5)) continue;
          if (L) L.have = new Set(Object.keys(L.items));
          c();
          call('newLevel');
          flush();
          const D = here.D;
          // 最深部の一つ手前の階段（封じられている・開いている）と、上り階段
          if (D && here.depth === FINAL_DEPTH - 1) {
            here.trans = null;
            player.x = ((D.stairs % MW) + 0.5) * CELL;
            player.z = (((D.stairs / MW) | 0) + 0.5) * CELL;
            here.lockCell = -1;
            call('checkEvents');
          }
          if (D && D.upstairs >= 0) {
            here.trans = null;
            here.lockCell = -1;
            player.x = ((D.upstairs % MW) + 0.5) * CELL;
            player.z = (((D.upstairs / MW) | 0) + 0.5) * CELL;
            call('checkEvents');
          }
        }
        if (L) L.have = new Set();
        Object.assign(here, { inter: null, realm: null, branch: null, depth: FINAL_DEPTH - 1, trans: null });
        if (L && s % 2 === 0) L.have = new Set(Object.keys(L.items));
        call('newLevel');
        flush();
        if (here.D) {
          // 階段の前の群れは倒れている（封じられた階段の伝言を通すため）
          for (const m of here.monsters) if (m.g === here.D.stairGuard) m.dead = true;
          here.lockCell = -1;
          here.trans = null;
          player.x = ((here.D.stairs % MW) + 0.5) * CELL;
          player.z = (((here.D.stairs / MW) | 0) + 0.5) * CELL;
          call('checkEvents');
          clock.time += 20;
          here.trans = null;
          call('checkEvents');
        }
        if (L) L.have = new Set();
        call('showStratum', { name: '支道', branch: true });
        call('showStratum', { name: '異界', realm: true });
        call('showStratum', { name: '町', special: true });
      }
      // 場面：層ごとの階（石の迷宮・大洞窟・遺跡・溶岩の海・深淵）と地下の町（体が休まる）。支道の入口と、選ばれなかった枠
      {
        const TOUR = [
          { depth: 2 },
          { depth: 4 },
          { depth: 7 },
          { depth: 10 },
          { depth: 11 },
          { depth: 2, inter: { key: 'town', after: 2 } },
          ...Object.values(REALMS).map((R) => ({ depth: R.minD + 2, realm: { key: R.key, ret: R.minD + 3 } })),
        ];
        for (const pl of [TOUR[((s - 1) * 2) % TOUR.length], TOUR[((s - 1) * 2 + 1) % TOUR.length]]) {
          Object.assign(here, {
            depth: pl.depth,
            inter: pl.inter ? { ...pl.inter } : null,
            realm: pl.realm ? { ...pl.realm } : null,
            branch: null,
            arrive: null,
            trans: null,
          });
          ui.started = true;
          adv.dead = false;
          player.hp = 5;
          call('newLevel');
          flush();
          const D = here.D;
          if (D && D.bstairs) {
            here.lockCell = -1;
            here.trans = null;
            player.x = ((D.bstairs.cell % MW) + 0.5) * CELL;
            player.z = (((D.bstairs.cell / MW) | 0) + 0.5) * CELL;
            call('checkEvents');
          }
          if (D) {
            adv.runState.slotPend = 'g2';
            D.items.push({ i: 0, kind: 'open', grp: 'g2', taken: false, target: pick(['slotL', 'slotR', 'body']), label: '右手の枠' });
            call('settleSlotPick');
          }
        }
      }
      // 次の場所へ進む向きを変えながら、何階か移る
      const nMoves = 4 + Math.floor(r() * 3);
      for (let k = 0; k < nMoves; k++) {
        const w = Math.floor(r() * 9);
        let go;
        if (w === 0 && here.D && here.D.bstairs) go = 'branch';
        else if (w === 1 && here.D && here.D.portal) go = 'realm';
        else if (w === 2) go = 'up';
        else if (w === 3) {
          // 支道・異界・特別な階・最深部のそばへ飛ぶ（dbg と同じく、場所を直に書き換える）
          const v = Math.floor(r() * 5);
          here.inter = here.realm = here.branch = null;
          if (v === 0) {
            const B = pick(Object.values(BRANCHES));
            here.depth = B.at[0];
            here.branch = { key: B.key, lvl: 1 + Math.floor(r() * B.len), len: B.len, ret: B.at[0] + 1 };
          } else if (v === 1) {
            const R = pick(Object.values(REALMS));
            here.depth = chance(0.5) ? R.minD + 2 : FINAL_DEPTH - 1;
            here.realm = { key: R.key, ret: here.depth + 1 };
          } else if (v === 2) here.inter = { key: pick(['town', 'oracle', 'bigroom', 'fortress']), after: 3 };
          else here.depth = chance(0.5) ? pick([FINAL_DEPTH - 1, FINAL_DEPTH]) : 1 + Math.floor(r() * FINAL_DEPTH);
          // 伝説の物を揃える・揃えない
          const L = getLegend();
          if (L) L.have = new Set(chance(0.5) ? Object.keys(L.items) : []);
        }
        if (w !== 3 || chance(0.6)) {
          call('placeKey');
          call('advance', w === 3 ? pick([undefined, 'up']) : go);
        }
        here.arrive = chance(0.3) ? null : chance(0.3) ? pick(['portal', 'bstairs', 'stairs']) : here.arrive;
        if (here.branch && chance(0.3)) adv.runState.lordsDone.add(here.branch.key);
        if (chance(0.15)) player.fall = true;
        if (chance(0.2)) adv.runState.slotPend = 'slotgrp';
        if (chance(0.15)) ui.gallery = { mode: 'range' };
        if (k === nMoves - 1 && chance(0.5)) call('newLevel', 424242);
        else call('newLevel');
        ui.gallery = null;
        flush();
        // 階の中：踏む場面
        const D = here.D;
        if (!D) continue;
        const atCell = (c) => {
          player.x = ((c % MW) + 0.5) * CELL;
          player.z = (((c / MW) | 0) + 0.5) * CELL;
        };
        for (let q = 0; q < 6; q++) {
          here.trans = null;
          ui.started = chance(0.9);
          const v = Math.floor(r() * 8);
          if (v === 0 && D.upstairs >= 0) atCell(D.upstairs);
          else if (v === 1 && D.bstairs) atCell(D.bstairs.cell);
          else if (v === 2 && D.portal) atCell(D.portal.cell);
          else if (v === 3) {
            const c = pick(D.rooms.flatMap((rm) => rm.cells.slice(0, 3)));
            if (c !== undefined) {
              D.pit = D.pit || new Uint8Array(NCELL);
              D.pit[c] = 1;
              atCell(c);
            }
          } else if (v === 4) {
            atCell(D.stairs);
            if (chance(0.5)) here.lockCell = D.stairs;
            if (chance(0.3)) here.lockCell = pick([D.stairs + 3, D.stairs + MW * 2]);
          } else if (v === 5) {
            // 部屋の中（初めて入った部屋の伝言・彫刻・見つけた階段）
            const rm = pick(D.rooms.filter((x) => x.cells.length));
            if (rm) atCell(pick(rm.cells));
            for (let i = 0; i < NCELL; i++) if (chance(0.5)) here.fovVis[i] = here.fovStamp;
          } else if (v === 6) {
            atCell(D.stairs);
            here.lockCell = -1;
          } else {
            const fl = [];
            for (let i = 0; i < NCELL; i++) if (D.tile[i] === TF) fl.push(i);
            atCell(pick(fl));
          }
          call('checkEvents', chance(0.2));
          if (chance(0.3)) {
            // 柱のマスが見える所にある
            const pc = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL);
            if (chance(0.5) && D.tile[pc + 1] === TF) D.tile[pc + 1] = TP;
            call('computeFOV');
          }
          if (q === 0) {
            const pc = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL);
            D.tile[pc + 1] = TP;
            call('computeFOV');
          }
        }
        if (chance(0.4)) {
          if (chance(0.3)) page.hide.add('stratum');
          call('showStratum', D.stratum);
          page.hide.delete('stratum');
        }
        if (chance(0.3)) {
          adv.runState.slotPend = chance(0.5) ? 'g' : null;
          if (chance(0.5))
            D.items.push({ i: 0, kind: 'open', grp: 'g', taken: false, target: pick(['slotL', 'slotR', 'body']), label: '左手の枠' });
          call('settleSlotPick');
        }
        if (chance(0.3)) call('strataGrowth');
        if (chance(0.2)) call('setFog');
        if (chance(0.2)) call('updateWater');
        if (chance(0.2)) call('initFire');
        if (chance(0.2)) call('initEvents');
        if (chance(0.2)) call('initDust');
        if (k === 0) {
          call('respawnDust', Math.floor(r() * DUST_N), true);
          call('respawnDust', Math.floor(r() * DUST_N), false);
          // 干し草の床も燃える
          for (let q = 0; q < 3; q++) D.surface[Math.floor(r() * NCELL)] = SF_HAY;
          call('initFire');
        }
        if (chance(0.15) || k === 1) call('setupFinal');
        if (k === 0 && s % 2 === 0) call('generate', (r() * 1e9) >>> 0, here.depth);
        // 作業用の配列が小さい時に、伸ばしながら組み立てても、同じ世界になる（使い回した時と、指紋が同じ）
        if (k === 2 && s === 1) resetGlyphWork(1000);
        if (chance(0.1) || k === 2) call('buildWorld');
        flush();
      }
      // 死んで、結果の画面のボタンを押す（墓を選ぶ・新しい探索へ）
      {
        adv.won = s % 7 === 3;
        ui.gallery = s % 5 === 2 ? { mode: 'beast' } : null;
        ui.locked = s % 2 === 1;
        if (s % 6 === 4) page.hide.add('death');
        call('die', pick(['炎', 'ネズミ', '落下の衝撃']));
        page.hide.delete('death');
        ui.gallery = null;
        const el = page.els['death'];
        if (el && el.onclick) {
          const btn = (ds, id) => ({ target: { closest: () => ({ dataset: ds, id }) } });
          el.onclick({ target: { closest: () => null } });
          if (ui.graveCands.length) el.onclick(btn({ gv: '1' }, ''));
          el.onclick(btn({}, 'other'));
          if (chance(0.7)) {
            // ［新しい探索へ］は暗くし始めるだけ（startNewRun）。真っ暗になった時に tick が呼ぶ newRun を、ここで呼ぶ
            el.onclick(btn({}, 'newRunB'));
            calls.push({ name: 'newRunB', state: fnv(state()) });
            if (here.trans && here.trans.run) call('newRun');
          }
        }
        flush();
      }
      out.push({ s, calls, dom: fnv(text(page.log)), audio: fnv(text(alog)), stored: fnv(text(stored)), timers: { ...timers.st } });
    }
  } finally {
    // 終わった階の部品を持ち続けない
    lastWorld = { key: [], print: '' };
    restoreGlobals();
    delete msgs.push;
    for (const [k, fields] of keptTypes)
      for (const [f, d] of fields) {
        if (d) Object.defineProperty(MTYPES[k], f, d);
        else delete MTYPES[k][f];
      }
    for (const c of gfx.chunks) c.mesh.geometry.dispose();
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
    restore(lantern, keep.lantern);
    restore(hudInfo, keep.hudInfo);
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
    placeMem.clear();
    for (const [k, v] of keep.mem) placeMem.set(k, v);
    fogCol.copy(keep.fog);
    for (const [f, k] of FN_FIELDS) delete F[f][k];
  }
  return out;
}
/** 場合の記録を1つの文字列にする */
export const levelText = (all) => all.map((c) => `${c.s} ${c.dom} ${c.audio} ${c.stored} ${text(c.timers)}\n${text(c.calls)}`).join('\n');
