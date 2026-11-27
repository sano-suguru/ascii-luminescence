// テストの道具：大きさとメインループ（src/lib/loop.ts）と描画の土台（src/lib/render.ts）を、たくさんの場合で呼び、結果を1つの文字列にまとめる。
// F は関数をまとめた物。loop.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（newLevel）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、本物の階で探索を始め、tick を何十回も進めながら、止める・階を移る・置いたカメラ・止めた段・余分に引く乱数・画面の大きさ・
// 画質（速いフレームと遅いフレーム・隠れたページ）・体力を変え、frame・stepTick・applySize・setQuality・withTestCam・cullChunks・flushDyn も直に呼ぶ。
// three.js の物（場面・カメラ・置いた文字の形と属性・水面）は Node でも本物を作り、描画する部品・後処理・光のにじみ・ミニマップは偽物にする（したことを記録する）。
// テスト用モードでないので（Node には ?test=1 が無い）、tick は画質を下げる所まで進む。
// 書き換えた状態と、document・window・localStorage・performance・setTimeout・requestAnimationFrame・Math.random・音の乱数は、終わったら元に戻す。
import { sndInit } from '../../src/lib/audio.ts';
import { addLooks } from '../../src/lib/bodies/build.ts';
import { resetRunes } from '../../src/lib/gear.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { dCol, dPar, dPos, P } from '../../src/lib/particles.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RES } from '../../src/lib/runes.ts';
import {
  SND,
  adv,
  buf,
  clock,
  fight,
  gear,
  gfx,
  here,
  hudInfo,
  lantern,
  msgs,
  placeMem,
  player,
  saved,
  skipPhases,
  stealth,
  tickNoise,
  ui,
  vfx,
} from '../../src/lib/state.ts';
import { T } from '../../src/lib/three.ts';
import { MH, MW, NCELL } from '../../src/lib/world.ts';
import { fakeAudioClass } from './fake-audio.mjs';
import { fakeDom, fakeTimers, fakeUniforms, fnv, hashArr } from './fight-cases.mjs';
import { swapGlobals } from './ui-cases.mjs';
import { advance, newLevel, showStratum } from '../../src/lib/levels.ts';
import { boom, hurtPlayer, monsterStrike } from '../../src/lib/combat.ts';
import { houndScent } from '../../src/lib/monsters.ts';
import { updatePlayer } from '../../src/lib/player.ts';

/** 移した関数の名前（場合が全部を呼ぶか、loop.test.mjs が確かめる。keyedPhase・tickRandOn・inPhase・inMobPhase・placeTestCam は tick の中から呼ばれる） */
export const NAMES = [
  'applySize',
  'frame',
  'stepTick',
  'tick',
  'setQuality',
  'withTestCam',
  'buildAtlas',
  'flushDyn',
  'makeWater',
  'cullChunks',
];

/** 関数に覚えさせた欄（前の場合や、前に走らせた物の値を残さないように、場合ごとに消す） */
const FN_FIELDS = [
  [boom, 'last'],
  [hurtPlayer, 'mt'],
  [hurtPlayer, 'mc'],
  [monsterStrike, 'mt'],
  [updatePlayer, 'sealT'],
  [houndScent, 'msgT'],
  [advance, 'bounced'],
  [showStratum, 't'],
];
/** 値を1つの文字列にする（生き物は種類と位置、配列の型は指紋、関数は fn） */
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
            : ArrayBuffer.isView(x)
              ? hashArr(x)
              : x,
  );
const restore = (obj, copy) => {
  for (const k of Object.keys(obj)) if (!(k in copy)) delete obj[k];
  Object.assign(obj, copy);
};
/** 偽の 2D の描き手（文字の絵の表を作る buildAtlas が描く。したことを log に書く） */
const fakeCanvas = (log) => {
  const ctx = new Proxy(
    {},
    {
      get: (o, k) => (k in o ? o[k] : (...a) => void log.push(['ctx', String(k), ...a.map(String)])),
      set: (o, k, v) => (log.push(['ctx=', String(k), String(v)]), (o[k] = v), true),
    },
  );
  return { width: 0, height: 0, getContext: () => ctx };
};

/** seeds：場合の数。page：fakeDom() の偽の画面 */
export async function loopCases(F, seeds, page) {
  const out = [];
  const keep = {
    here: { ...here },
    adv: { ...adv },
    player: { ...player },
    ui: { ...ui },
    vfx: { ...vfx },
    fight: { ...fight },
    SND: { ...SND },
    buf: { ...buf },
    gear: { ...gear },
    gfx: { ...gfx },
    saved: { ...saved },
    clock: { ...clock },
    hud: { ...hudInfo },
    stealth: { ...stealth },
    lantern: { ...lantern },
    random: Math.random,
    sound: setSoundRand(Math.random),
    msgs: [...msgs],
    types: Object.keys(MTYPES),
    res: Object.keys(RES),
  };
  const LOOK_FIELDS = ['look', 'form', 'trail', 'col', 'lcol'],
    keptTypes = Object.entries(MTYPES).map(([k, t]) => [k, LOOK_FIELDS.map((f) => [f, Object.getOwnPropertyDescriptor(t, f)])]);
  addLooks();
  const alog = [],
    log = [],
    timers = fakeTimers(),
    raf = [],
    win = { AudioContext: fakeAudioClass(alog, 'running'), innerWidth: 960, innerHeight: 540, devicePixelRatio: 1 };
  let msgN = 0;
  msgs.push = (...a) => (msgN++, Array.prototype.push.apply(msgs, a));
  const doc = {
    ...page.document,
    hidden: false,
    getElementById: (id) => {
      const e = page.document.getElementById(id);
      if (e && !e.style) e.style = {};
      return e;
    },
    createElement: (k) => (k === 'canvas' ? fakeCanvas(log) : page.document.createElement(k)),
  };
  const restoreGlobals = swapGlobals({
    document: doc,
    window: win,
    localStorage: { setItem: () => undefined, getItem: () => null },
    performance: { now: () => clock.time * 1000 },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    requestAnimationFrame: (fn) => (raf.push(fn.name), raf.length),
  });
  try {
    Math.random = mulberry32(5);
    Object.assign(SND, { ctx: null, master: null, inp: null, wet: null, noise: null, on: true });
    sndInit();
    // three.js の物は、乱数を数える前に作る（作る時に Math.random を引く）
    gfx.scene = new T.Scene();
    gfx.staticMat = new T.ShaderMaterial();
    gfx.occMat = new T.ShaderMaterial();
    gfx.waterTex = new T.DataTexture(new Float32Array(NCELL * 4), MW, MH, T.RGBAFormat, T.FloatType);
    gfx.waterLTex = new T.DataTexture(new Float32Array(NCELL * 4), MW, MH, T.RGBAFormat, T.FloatType);
    const cam = new T.PerspectiveCamera(74, 16 / 9, 0.05, 110);
    cam.rotation.order = 'YXZ';
    gfx.dynGeo = new T.InstancedBufferGeometry();
    gfx.aPos = new T.InstancedBufferAttribute(dPos, 3);
    gfx.aCol = new T.InstancedBufferAttribute(dCol, 3);
    gfx.aPar = new T.InstancedBufferAttribute(dPar, 4);
    const v2 = () => {
      const o = { x: 0, y: 0, set: (x, y) => Object.assign(o, { x, y }) };
      return o;
    };
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 16807 + 11),
        pick = (a) => a[Math.floor(r() * a.length)],
        chance = (p) => r() < p;
      let mrN = 0;
      const mrSrc = mulberry32(s * 7919 + 71);
      Math.random = () => (mrN++, mrSrc());
      setSoundRand(mulberry32(s * 104729 + 73));
      for (const [f, k] of FN_FIELDS) delete f[k];
      buf.dn = 0;
      buf.pN = 0;
      delete F.frame.stillDrawn;
      page.reset();
      timers.clear();
      alog.length = 0;
      log.length = 0;
      raf.length = 0;
      msgs.length = 0;
      cam.position.set(0, 0, 0);
      cam.rotation.set(0, 0, 0);
      gfx.camera = cam;
      gfx.U = {
        ...fakeUniforms(),
        uFogDen: { value: 0.05 },
        uAtlas: { value: null },
        uSL: { value: null },
        uDLP: { value: null },
        uDLC: { value: null },
      };
      gfx.cellTex = { needsUpdate: false };
      gfx.chunks = [];
      gfx.occMesh = null;
      gfx.renderer = {
        setClearColor: () => undefined,
        setPixelRatio: (p) => log.push(['renderer.pr', p]),
        setSize: (w, h) => log.push(['renderer.size', w, h]),
        capabilities: { getMaxAnisotropy: () => 16 },
      };
      gfx.composer = {
        setPixelRatio: (p) => log.push(['composer.pr', p]),
        setSize: (w, h) => log.push(['composer.size', w, h]),
        render: (dt) => log.push(['render', dt]),
      };
      gfx.bloom = { enabled: true };
      // 粒子を描く形と属性（src/lib/motes.ts の updateParticles が数を書く）
      gfx.ptGeo = { setDrawRange: (a, b) => log.push(['ptRange', a, b]) };
      for (const k of ['bpPos', 'bpCol', 'bpSize', 'bpGly']) gfx[k] = { updateRange: { offset: 0, count: 0 }, needsUpdate: false };
      gfx.finalPass = {
        uniforms: Object.fromEntries(
          ['uTime', 'uFade', 'uHurt', 'uExposure', 'uHeat', 'uSwim', 'uSlow']
            .map((k) => [k, { value: 0 }])
            .concat([
              ['uRes', { value: v2() }],
              ['uTint', { value: { set: () => undefined } }],
            ]),
        ),
      };
      gfx.pixelRatio = pick([1, 1.5]);
      gfx.sizedAs = '';
      gfx.qRun = { q: { pr: 1, bloom: true }, prev: null, done: false };
      gfx.testCam = null;
      win.innerWidth = 960;
      win.innerHeight = 540;
      doc.hidden = false;
      skipPhases.clear();
      tickNoise.n = 0;
      Object.assign(clock, { time: 5 + r() * 20, frame: 0, last: 0, fovT: 0, mapT: 0, perfT: 0, perfAcc: 0, perfN: 0, warm: 0 });
      Object.assign(hudInfo, { pfFrames: 0, pfT: 0, pfFps: 0 });
      Object.assign(ui, {
        started: true,
        gallery: null,
        godMode: false,
        locked: false,
        invOpen: false,
        menuOpen: false,
        altarOpen: false,
        lvlOpen: false,
        dbgOpen: false,
        helpOn: chance(0.5),
        helpT: chance(0.5) ? 0.2 : 0,
        uiMode: 1,
        perfOn: chance(0.5),
      });
      ui.lookEl = doc.getElementById('look');
      here.lastStratum = null;
      here.showroomGen = false;
      here.trans = null;
      here.fade = pick([1, 1, 0.3]);
      saved.META = { lore: 0, spent: 0, unl: [], grave: null, trials: [] };
      saved.DEVALL = true;
      saved.SEEN = new Set();
      saved.RSEEN = new Set();
      saved.BOOK = new Set();
      saved.LEGEND = null;
      adv.HIST_SEED = -1;
      adv.runSeed = 4321 + s;
      adv.dead = false;
      adv.won = false;
      gear.runeUid = 1;
      resetRunes();
      adv.runStats = { kills: 0, t0: 0 };
      // 忍び足・手元の灯り・揺れと光りは、ページを開いた時の値から（前の場合の物を残さない）
      restore(stealth, keep.stealth);
      restore(lantern, keep.lantern);
      restore(vfx, keep.vfx);
      // 新しい探索と同じ初めの値（src/lib/levels.ts の newRun。前の場合の物を残さない）
      adv.PLAYER_MAX = 40;
      adv.lvl = { n: 1, exp: 0, pending: 0, bless: {}, strata: new Set() };
      adv.runTrials = [];
      placeMem.clear();
      here.arrive = null;
      player.fall = false;
      here.depth = 1 + Math.floor(r() * 8);
      here.branch = null;
      here.realm = null;
      here.inter = null;
      newLevel();
      player.hp = chance(0.3) ? 5 : adv.PLAYER_MAX;
      const calls = [];
      const state = () =>
        text({
          clock: { ...clock, TESTCLK: null },
          gfx: [gfx.pixelRatio, gfx.sizedAs, gfx.qRun, gfx.bloom.enabled, gfx.testCam && gfx.testCam.pos],
          cam: [cam.position.toArray(), cam.rotation.toArray(), cam.aspect, cam.projectionMatrix.elements],
          U: [gfx.U.uTime.value, gfx.U.uScale.value, gfx.U.uAtlas.value && 'atlas'],
          fp: Object.entries(gfx.finalPass.uniforms).map(([k, u]) => [
            k,
            k === 'uRes' ? [u.value.x, u.value.y] : k === 'uTint' ? 0 : u.value,
          ]),
          here: [here.fade, here.trans, here.depth, here.D && here.D.stratum],
          mons: here.monsters.map((m) => [m.key, m.x, m.z, m.hp, m.sleep, m.yaw]),
          player: { ...player },
          dn: buf.dn,
          dyn: [hashArr(dPos, 0, buf.dn * 3), hashArr(dCol, 0, buf.dn * 3), hashArr(dPar, 0, buf.dn * 4)],
          inst: [
            gfx.dynGeo.instanceCount,
            ...[gfx.aPos, gfx.aCol, gfx.aPar].map((a) => [a.updateRange.offset, a.updateRange.count, a.version]),
          ],
          pN: buf.pN,
          bp: ['bpPos', 'bpCol', 'bpSize', 'bpGly'].map((k) => gfx[k].updateRange.count),
          P: P.length,
          hud: { ...hudInfo },
          vis: gfx.chunks.map((c) => (c.mesh.visible ? 1 : 0)).join(''),
          water: gfx.waterMesh ? gfx.waterMesh.position.toArray() : null,
          ui: [ui.helpT, ui.helpOn],
          raf: raf.slice(),
          vfx: { ...vfx },
        });
      const call = (name, ...args) => {
        const m0 = mrN,
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
          args: text(args.map((a) => (typeof a === 'function' ? 'fn' : a))),
          ret: typeof ret === 'object' && ret ? (ret.isTexture ? 'texture' : text(ret)) : text(ret),
          threw,
          mr: mrN - m0,
          msgs: msgN - g0,
          timers: timers.st.n - t0,
          log: text(log.splice(0)),
          dom: fnv(text(page.log.splice(0))),
          state: state(),
        });
        return ret;
      };
      // 用意（newLevel など）の間に書いた物は数えない
      page.log.length = 0;
      log.length = 0;
      if (s === 1) call('buildAtlas');
      call('makeWater');
      call('applySize', 'init');
      call('applySize', 'init');
      for (let k = 0; k < 60; k++) {
        const what = r();
        if (what < 0.05) ui.menuOpen = !ui.menuOpen;
        else if (what < 0.08 && !here.trans)
          here.trans = pick([
            { phase: 'out', t: 0, go: 'down' },
            { phase: 'out', t: 0.7, regen: true },
            { phase: 'in', t: 1.2 },
          ]);
        else if (what < 0.11)
          gfx.testCam = chance(0.3)
            ? null
            : { pos: [player.x + 1, 1.4, player.z + 1], at: [player.x, 1, player.z], lvl: chance(0.85) ? here.D : null };
        else if (what < 0.13) {
          skipPhases.clear();
          if (chance(0.7)) for (const n of ['hands', 'mob draw', 'fov', 'particles', 'trans']) if (chance(0.3)) skipPhases.add(n);
        } else if (what < 0.15) tickNoise.n = pick([0, 0, 2]);
        else if (what < 0.18) {
          win.innerWidth = pick([960, 750, 1280]);
          win.innerHeight = pick([540, 312, 720]);
          call('applySize', 'resize');
        } else if (what < 0.21)
          call(
            'setQuality',
            pick([
              { pr: 1, bloom: true },
              { pr: 0.8, bloom: false },
              { pr: gfx.pixelRatio, bloom: false },
            ]),
            pick(['auto', 'back']),
          );
        else if (what < 0.23) doc.hidden = !doc.hidden;
        else if (what < 0.25) player.hp = pick([3, adv.PLAYER_MAX]);
        else if (what < 0.28) call('frame', clock.last * 1000 + pick([16, 33, 70]));
        else if (what < 0.3) call('stepTick', 1 / 30, chance(0.5));
        else if (what < 0.32) call('withTestCam', () => [gfx.camera.position.x, gfx.camera.position.z]);
        else if (what < 0.34) call('cullChunks');
        else if (what < 0.36) call('flushDyn');
        else call('tick', pick([1 / 60, 1 / 30, 1 / 30, 0.08, 0.3, 0]), chance(0.7));
      }
      // 画質を下げる所まで：探索中に遅いフレームを続ける（ページを出し、止めをやめ、階を移る途中もやめる）
      ui.menuOpen = false;
      doc.hidden = false;
      here.trans = null;
      for (let k = 0; k < 420; k++) call('tick', pick([0.03, 0.03, 0.05]), false);
      // 数えるのが途切れた時（下げた1段を戻す）
      here.trans = { phase: 'in', t: 1.25 };
      call('tick', 0.03, false);
      out.push(JSON.stringify({ s, calls }));
    }
  } finally {
    restoreGlobals();
    Math.random = keep.random;
    setSoundRand(keep.sound);
    delete msgs.push;
    msgs.length = 0;
    msgs.push(...keep.msgs);
    skipPhases.clear();
    tickNoise.n = 0;
    for (const k of Object.keys(MTYPES)) if (!keep.types.includes(k)) delete MTYPES[k];
    for (const k of Object.keys(RES)) if (!keep.res.includes(k)) delete RES[k];
    for (const [k, fs] of keptTypes)
      for (const [f, d] of fs) {
        const t = MTYPES[k];
        if (!t) continue;
        if (d) Object.defineProperty(t, f, d);
        else delete t[f];
      }
    restore(here, keep.here);
    restore(adv, keep.adv);
    restore(player, keep.player);
    restore(ui, keep.ui);
    restore(vfx, keep.vfx);
    restore(fight, keep.fight);
    restore(SND, keep.SND);
    restore(buf, keep.buf);
    restore(gear, keep.gear);
    restore(gfx, keep.gfx);
    restore(saved, keep.saved);
    restore(clock, keep.clock);
    restore(hudInfo, keep.hud);
    restore(stealth, keep.stealth);
    restore(lantern, keep.lantern);
  }
  return out.join('\n');
}
