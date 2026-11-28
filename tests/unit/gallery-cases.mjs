// テストの道具：見た物の記録・図鑑・試しの間（src/lib/gallery.ts）を、たくさんの場合で呼び、結果を1つの文字列にまとめる。
// F は関数をまとめた物。gallery.test.mjs が、この文字列の指紋を確かめる。
// 図鑑と試しの間の部屋は Node で本物の迷宮を生成する（newLevel）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、見た生き物・開発用モード・忘れられた獣の記録（無い・ある・壊れている）を変えて図鑑を開き、生き物を切り替え、
// 一歩ずつ進めながら、ホイール・ドラッグ・つまむ・指を置く・戻す・__test.galleryShow のように向きと姿を止める・止めをやめる・描く・説明を書き直す、を乱数で混ぜる。
// 続けて、探索の中で見た物を記録し（trackSeen）、試しの間を開いて、的を倒し・ダメージを数え・起き上がらせる。
// three.js の物（場面・水面の絵・階の文字の部品）は Node でも本物を作り、描画する部品 renderer だけ偽物にする。
// 書き換えた状態と、document・window・localStorage・performance・setTimeout・Math.random・音の乱数は、終わったら元に戻す。
import { sndInit } from '../../src/lib/audio.ts';
import { addLooks } from '../../src/lib/bodies/build.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { DUMMY_KINDS } from '../../src/lib/names.ts';
import { P, dCol, dPar, dPos } from '../../src/lib/particles.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RES } from '../../src/lib/runes.ts';
import { SND, adv, buf, clock, fight, gear, gfx, here, msgs, player, saved, ui, vfx } from '../../src/lib/state.ts';
import { T } from '../../src/lib/three.ts';
import { MH, MW, NCELL } from '../../src/lib/world.ts';
import { fakeAudioClass } from './fake-audio.mjs';
import { fakeCamera, fakeTimers, fakeUniforms, fnv, hashArr } from './fight-cases.mjs';
import { swapGlobals } from './ui-cases.mjs';

/** 確かめる関数の名前（場合が全部を呼ぶか、gallery.test.mjs が確かめる） */
export const NAMES = [
  'seenKey',
  'trackSeen',
  'galleryList',
  'galleryRoom',
  'showroom',
  'openBestiary',
  'showBeast',
  'galleryView',
  'galleryWheel',
  'galleryDrag',
  'galleryZoom',
  'galleryHold',
  'galleryReset',
  'updateGallery',
  'galleryDesc',
  'galleryLine',
  'renderGallery',
  'spawnDummy',
  'openRange',
  'drawGallery',
];

/** 値を1つの文字列にする（生き物は並びの番号、種類は名前、形は点の指紋、配列の型は指紋、関数は fn） */
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
              : k === 'ty' && x && typeof x === 'object'
                ? (x.name ?? 'ty')
                : (k === 'form' || k === 'formSleep' || k === 'drawForm' || k === 'bodyFor' || k === 'midFor') && Array.isArray(x)
                  ? fnv(JSON.stringify(x))
                  : (k === 'm' || k === 'leader') && x && typeof x === 'object' && 'ty' in x
                    ? `#${here.monsters.indexOf(x)}`
                    : x,
  );
const restore = (obj, copy) => {
  for (const k of Object.keys(obj)) if (!(k in copy)) delete obj[k];
  Object.assign(obj, copy);
};
/** 忘れられた獣の記録（図鑑に並ぶ） */
const BEASTS = [
  {
    seed: 11,
    name: '六本脚の獣',
    col: [0.8, 0.5, 0.3],
    spec: { plan: 'quad', legs: 6 },
    lore: '岩を砕いて進む',
    scale: 1.2,
    fl: 0,
    flier: false,
  },
  {
    seed: 12,
    name: '歌う蛾',
    col: [0.6, 0.7, 1.0],
    spec: { plan: 'moth' },
    lore: '羽の音が歌に聞こえる',
    scale: 0.9,
    fl: 1.2,
    flier: true,
  },
];

/** seeds：場合の数。page：fakeDom() の偽の画面 */
export async function galleryCases(F, seeds, page) {
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
    time: clock.time,
    random: Math.random,
    sound: setSoundRand(Math.random),
    msgs: [...msgs],
    types: Object.keys(MTYPES),
    res: Object.keys(RES),
  };
  const LOOK_FIELDS = ['look', 'form', 'trail', 'col', 'lcol'],
    keptTypes = Object.entries(MTYPES).map(([k, t]) => [k, LOOK_FIELDS.map((f) => [f, Object.getOwnPropertyDescriptor(t, f)])]);
  addLooks();
  // 試しの間の的の種類（ゲームでは src/lib/boot.ts の boot が足す）
  for (const d of DUMMY_KINDS)
    MTYPES[d.k] = {
      ch: '+',
      name: d.name,
      col: d.col,
      form: 'humanoid',
      scale: 0.95,
      speed: 0,
      fl: 0,
      light: 1.6,
      trail: 0,
      dummy: true,
      verb: '藁と石で組まれた的。何度倒れても、また起き上がる',
    };
  RES.dummyF = { fire: 0.2, ice: 2 };
  RES.dummyP = { poison: 0.2, fire: 2 };
  RES.dummyT = { thunder: 2, fire: 0.5 };
  const alog = [],
    stored = [],
    timers = fakeTimers(),
    focus = [];
  let beasts = '[]',
    msgN = 0;
  msgs.push = (...a) => (msgN++, Array.prototype.push.apply(msgs, a));
  // 画面の部品には style も持たせる（マウスを捕まえられない時に、src/lib/screens.ts の updateResume が書く）
  const doc = {
    ...page.document,
    getElementById: (id) => {
      const e = page.document.getElementById(id);
      if (e && !e.style) e.style = {};
      return e;
    },
  };
  const restoreGlobals = swapGlobals({
    document: doc,
    window: { AudioContext: fakeAudioClass(alog, 'running') },
    localStorage: { setItem: (k, v) => stored.push([k, v]), getItem: (k) => (k === 'al_beasts' ? beasts : null) },
    performance: { now: () => clock.time * 1000 },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });
  try {
    Math.random = mulberry32(3);
    Object.assign(SND, { ctx: null, master: null, inp: null, wet: null, noise: null, on: true });
    sndInit();
    // three.js の物は、乱数を数える前に作る（作る時に Math.random を引く）
    gfx.scene = new T.Scene();
    gfx.staticMat = new T.ShaderMaterial();
    gfx.occMat = new T.ShaderMaterial();
    gfx.waterTex = new T.DataTexture(new Float32Array(NCELL * 4), MW, MH, T.RGBAFormat, T.FloatType);
    gfx.waterLTex = new T.DataTexture(new Float32Array(NCELL * 4), MW, MH, T.RGBAFormat, T.FloatType);
    gfx.renderer = { setClearColor: () => undefined };
    gfx.canvas = { focus: () => focus.push('focus') };
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 16807 + 7),
        pick = (a) => a[Math.floor(r() * a.length)],
        chance = (p) => r() < p;
      let mrN = 0;
      const mrSrc = mulberry32(s * 7919 + 61);
      Math.random = () => (mrN++, mrSrc());
      const sndSrc = mulberry32(s * 104729 + 67);
      setSoundRand(sndSrc);
      page.reset();
      timers.clear();
      stored.length = 0;
      alog.length = 0;
      focus.length = 0;
      msgs.length = 0;
      gfx.camera = fakeCamera();
      gfx.U = { ...fakeUniforms(), uFogDen: { value: 0.05 } };
      gfx.cellTex = { needsUpdate: false };
      gfx.chunks = [];
      gfx.occMesh = null;
      buf.dn = 0;
      buf.pN = 0;
      ui.introEl = doc.getElementById('intro');
      Object.assign(ui, {
        started: false,
        gallery: null,
        godMode: false,
        locked: false,
        invOpen: false,
        seenT: chance(0.5) ? 0 : 0.3,
        touch: chance(0.3),
      });
      here.lastStratum = null;
      here.showroomGen = false;
      saved.META = { lore: 0, spent: 0, unl: [], grave: null, trials: [] };
      saved.DEVALL = chance(0.4);
      saved.SEEN = new Set(Object.keys(MTYPES).filter(() => chance(0.4)));
      if (chance(0.5)) saved.SEEN.add('lord:lair');
      if (chance(0.5)) saved.SEEN.add('final');
      if (chance(0.3)) saved.SEEN.add('');
      saved.RSEEN = new Set(chance(0.5) ? ['blade', 'bolt', 'orb', 'fire'] : []);
      saved.BOOK = new Set();
      saved.LEGEND = null;
      beasts = pick(['[]', JSON.stringify(BEASTS), JSON.stringify(BEASTS.slice(1)), '{']);
      for (const b of BEASTS) if (chance(0.5)) saved.SEEN.add('beast:' + b.seed + ':' + b.name);
      adv.HIST_SEED = -1;
      adv.runSeed = 1234 + s;
      adv.runState = { startChosen: false, altar1: false, taken: new Set(), lordsDone: new Set() };
      adv.runStats = { kills: 0, t0: 0 };
      gear.runeUid = 1;
      player.hp = 20;
      adv.won = false;
      adv.dead = false;
      clock.time = 10 + r() * 50;
      const calls = [];
      const state = () =>
        text({
          gallery: ui.gallery,
          player: { ...player },
          cam: [gfx.camera.position, gfx.camera.rotation],
          U: [gfx.U.uCut.value, gfx.U.uCamP.value, gfx.U.uCutP.value],
          zap: vfx.zapFlash,
          mons: here.monsters.map((m) => [m.key, m.x, m.y, m.z, m.yaw, m.sleep, m.moving, m.walk, m.dead, m.dsum, m.dT, m.blades]),
          gal: MTYPES['__gal'] && MTYPES['__gal'].name,
          seen: saved.SEEN,
          seenT: ui.seenT,
          place: [here.depth, here.inter, adv.runSeed, adv.runState],
          fix: here.fixtures.length,
          lights: here.D && here.D.lights.map((L) => L.int),
          bag: gear.bag.map((ru) => [ru.type, ru.traits, ru.strong]),
          hands: gear.hands,
          dn: buf.dn,
          dyn: [hashArr(dPos, 0, buf.dn * 3), hashArr(dCol, 0, buf.dn * 3), hashArr(dPar, 0, buf.dn * 4)],
          pN: buf.pN,
          P: P.length,
          started: [ui.started, adv.dead, player.hp, adv.runStats],
          focus,
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
          args: text(args),
          ret: text(ret),
          threw,
          mr: mrN - m0,
          msgs: msgN - g0,
          timers: timers.st.n - t0,
          dom: text(page.log.splice(0)),
          stored: text(stored.splice(0)),
          state: state(),
        });
        return ret;
      };
      // 図鑑
      call('galleryList');
      call('openBestiary');
      const g = ui.gallery;
      for (let k = 0; k < 40 && g; k++) {
        const what = r();
        if (what < 0.08) call('showBeast', Math.floor(r() * 80) - 10);
        else if (what < 0.13) call('galleryWheel', pick([0, 100, -100, 300, -40, 7]));
        else if (what < 0.18) call('galleryDrag', r() * 60 - 30, pick([0, 0, r() * 40 - 20]));
        else if (what < 0.21) call('galleryZoom', pick([0, -1, 0.8, 1.25, 3, NaN]));
        else if (what < 0.24) call('galleryHold', chance(0.5));
        else if (what < 0.26) call('galleryReset');
        else if (what < 0.28) call('galleryView');
        else if (what < 0.32) {
          // __test.galleryShow のように向きと姿を止める（止めをやめる時も）
          g.fix = chance(0.25)
            ? null
            : {
                yaw: r() * 6 - 3,
                pose: pick(['stand', 'walk', 'sleep']),
                zoom: pick([0.5, 1, 1.6, 3]),
                pitch: pick([null, 0, 0.5, 1.3, -0.3]),
                center: chance(0.5),
              };
        } else if (what < 0.36) call('drawGallery', clock.time);
        else if (what < 0.38) call('galleryLine');
        else if (what < 0.4) call('renderGallery');
        else if (what < 0.41) call('galleryDesc', g);
        else if (what < 0.43 && g.m) g.m.sleep = !g.m.sleep;
        else {
          clock.time += 1 / 30;
          call('updateGallery', pick([1 / 30, 1 / 30, 0.2, 2, 0]));
        }
      }
      call('drawGallery', clock.time);
      // 探索の中で見た物を記録する（図鑑を閉じて、生き物を近く・遠くに置く）
      ui.gallery = null;
      ui.started = chance(0.85);
      for (const m of here.monsters) {
        m.visible = chance(0.8);
        m.hidden = chance(0.1);
        m.x = player.x + (r() - 0.5) * 60;
        m.z = player.z + (r() - 0.5) * 60;
      }
      for (const m of here.monsters) call('seenKey', m);
      for (let k = 0; k < 4; k++) call('trackSeen', pick([0.1, 0.3, 0.6]));
      // 試しの間
      gear.hands = null;
      gear.bag = [];
      call('openRange');
      timers.flush();
      for (let k = 0; k < 30 && ui.gallery; k++) {
        const ds = ui.gallery.dummies,
          d = pick(ds),
          what = r();
        if (what < 0.15 && d.m) {
          d.m.dead = true;
        } else if (what < 0.3 && d.m) {
          d.m.dsum = (d.m.dsum || 0) + Math.floor(r() * 40);
          d.m.dT = pick([0, 0.5, 2]);
        } else if (what < 0.35) call('spawnDummy', d);
        else if (what < 0.4) call('drawGallery', clock.time);
        else {
          clock.time += 1 / 30;
          call('updateGallery', pick([1 / 30, 0.5, 1.6]));
        }
      }
      call('drawGallery', clock.time);
      call('galleryRoom', 1000 + s);
      call('showroom');
      out.push(JSON.stringify({ s, calls }));
    }
  } finally {
    restoreGlobals();
    Math.random = keep.random;
    setSoundRand(keep.sound);
    delete msgs.push;
    msgs.length = 0;
    msgs.push(...keep.msgs);
    clock.time = keep.time;
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
  }
  return out.join('\n');
}
