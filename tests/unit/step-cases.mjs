// テストの道具：詠唱と転がり（src/lib/chant.ts）・飛ぶ物と戦いの跡を進める処理（projs.ts）・詠唱の声（audio.ts の chantStart）・剣の波を描く（fx.ts の drawWave）・
// 火とガスと地面を進める処理（ground.ts の stepFire・stepGas・regrow・brimRecover）・部屋の出来事と罠（events.ts）・神託所の伝説の物の手がかり（legend.ts の oracleLegendHints）を、
// たくさんの場合で呼び、結果を1つの文字列にまとめる。F は関数をまとめた物。step.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の全部の場所）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、本物の階に、表の全部の種類の生き物を置き、両手の武器と特性と加護をシードの乱数で選んで、分かれ道ごとの「場面」を通す
// （詠唱を始めて溜める・離す・溜めすぎる、転がる、武器ごとに撃って飛ぶ物を何歩も進める、状態異常・魔法の場・雨・毒の霧、火とガス、部屋の出来事の種類ごと、罠の種類ごと）。
// 遅れて起きること（fight.laters）は、ゲームと同じく updateZones（updateStatuses から）が流す。fight.zapQueue と setTimeout は、時計を進めながらここで流す。
// 返す値と、呼ぶたびの状態（プレイヤー・生き物・戦いの状態・火と地面のマス・部屋の出来事・罠・粒子と置いた文字・伝言・画面の部品・音の記録）と、
// 見た目の乱数と音の乱数を引いた数を記録する。テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio を、本物の型に合わせられないため。
// 書き換えた状態と、document・window・localStorage・performance・setTimeout・Math.random・音の乱数は、終わったら元に戻す。
import { sndInit } from '../../src/lib/audio.ts';
import { addLooks } from '../../src/lib/bodies/build.ts';
import { castNow, fireWave, later, addZone, orbBurst, startRain } from '../../src/lib/combat.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { makeRune, snapHands, specOf } from '../../src/lib/gear.ts';
import { ignite, initFire, regrow } from '../../src/lib/ground.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { initEvents } from '../../src/lib/levels.ts';
import { makeMonster } from '../../src/lib/monsters.ts';
import { P, dCol, dPar, dPos } from '../../src/lib/particles.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES, TRAITS } from '../../src/lib/runes.ts';
import { SND, adv, blaze, buf, clock, fight, gear, gfx, here, keys, msgs, player, saved, stealth, ui, vfx } from '../../src/lib/state.ts';
import { CELL, LQ_BOG, LQ_DEEP, LQ_LAVA, LQ_WATER, MW, NCELL, SF_BRIM, SF_DEAD, SF_ICE, TF, TW, cpos } from '../../src/lib/world.ts';
import { fakeAudioClass } from './fake-audio.mjs';
import { fakeCamera, fakeDom, fakeTimers, fakeUniforms, fnv, hashArr, text } from './fight-cases.mjs';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';

/** 移した関数の名前（場合が全部を呼ぶか、step.test.mjs が確かめる） */
export const NAMES = [
  'timeScale',
  'beginCast',
  'fizzle',
  'releaseCast',
  'updateCast',
  'startRoll',
  'updateProjs',
  'moonBurst',
  'updateStatuses',
  'monTimeK',
  'updateZones',
  'updateRains',
  'cloudsMeetFire',
  'drawWave',
  'chantStart',
  'stepFire',
  'stepGas',
  'regrow',
  'brimRecover',
  'updateEvents',
  'triggerTrap',
  'updateTraps',
  'oracleLegendHints',
];
/** 関数に覚えさせる欄（場合ごとに消す） */
const FN_FIELDS = [['updateCast', 'last']];
const ELEMS = [null, ...RUNE_TYPES.elem];
const BLESS_KEYS = ['charge', 'desperate', 'quickdodge', 'counter', 'swapedge', 'scorch', 'kindle'];

/** seeds：場合の数。page：fakeDom() の偽の画面。返り値は、場合ごとの記録（呼んだ関数ごとの記録 calls） */
export async function stepCases(F, seeds, page) {
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
    keys: { ...keys },
    saved: { ...saved },
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
    timers = fakeTimers(),
    errs = [];
  let msgN = 0,
    noStore = false;
  msgs.push = (...a) => (msgN++, Array.prototype.push.apply(msgs, a));
  const restoreGlobals = swapGlobals({
    document: page.document,
    window: { AudioContext: fakeAudioClass(alog, 'running') },
    localStorage: {
      setItem: (k, v) => {
        if (noStore) throw new Error('no storage');
        alog.push(['store', k, v]);
      },
      getItem: () => null,
    },
    performance: { now: () => clock.time * 1000 },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });
  const keepErr = console.error;
  console.error = (e) => errs.push(String(e && e.message));
  try {
    Math.random = mulberry32(1);
    Object.assign(SND, { ctx: null, master: null, inp: null, wet: null, noise: null, on: true });
    sndInit();
    const actx = SND.ctx;
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 48271 + 29),
        pick = (a) => a[Math.floor(r() * a.length)],
        chance = (p) => r() < p;
      let mrN = 0;
      const mrSrc = mulberry32(s * 7919 + 43);
      Math.random = () => (mrN++, mrSrc());
      let sndN = 0;
      const sndSrc = mulberry32(s * 104729 + 47);
      setSoundRand(() => (sndN++, sndSrc()));
      for (const [f, k] of FN_FIELDS) delete F[f][k];
      page.reset();
      timers.clear();
      alog.length = 0;
      msgs.length = 0;
      errs.length = 0;
      SND.ctx = actx;
      SND.on = true;
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
      here.fovVis = new Uint32Array(NCELL);
      here.fovStamp = 1;
      adv.HIST = makeHistory(adv.runSeed);
      adv.HIST_SEED = adv.runSeed;
      saved.BOOK = new Set(chance(0.5) ? [] : ['blast']);
      saved.LEGEND = null;
      adv.dead = false;
      adv.won = false;
      adv.PLAYER_MAX = 40;
      adv.lvl = { n: 3, exp: 0, pending: 0, bless: {}, strata: new Set() };
      for (const b of BLESS_KEYS) if (chance(0.4)) adv.lvl.bless[b] = 1 + Math.floor(r() * 2);
      adv.runStats = { kills: 0, t0: 0, maxDepth: here.depth, book0: 0, beastsNew: 0 };
      adv.runState = { startChosen: true, altar1: true, taken: new Set(), lordsDone: new Set(), bodyOpen: 0 };
      Object.assign(ui, {
        started: true,
        gallery: null,
        godMode: false,
        camMode: 'fps',
        camPos: null,
        invOpen: false,
        menuOpen: false,
        dbgOpen: false,
        altarOpen: false,
        lvlOpen: false,
        aimT: -9,
        crossMon: null,
        locked: true,
        noticeMsgT: {},
      });
      Object.assign(here, { finalSt: null, trans: null, lockCell: -1 });
      clock.time = 20 + r() * 100;
      Object.assign(vfx, { shake: 0, flash: 0, hurtFlash: 0, zapFlash: null });
      buf.pN = 0;
      buf.dn = 0;
      stealth.sneak = chance(0.3);
      initFire();
      Object.assign(blaze, { scent: new Float32Array(NCELL), frozen: new Map(), trampled: [], gasAny: false, lastBoom: -10, brimT: 0 });
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
      });
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
        pitch: (r() - 0.5) * 0.3,
        eye: 1.62,
        bob: 0,
        hp: adv.PLAYER_MAX,
        rally: 0,
        roll: null,
        rollCd: 0,
        lunge: null,
        recover: 0,
        netT: 0,
        fall: null,
        qcUntil: 0,
        ctrUntil: 0,
        swapEdgeUntil: 0,
      });
      gfx.camera.position.set(player.x, player.eye, player.z);
      // 両手：武器（両手持ちも）と特性。atk の無い手（素手）も
      const atk = [...RUNE_TYPES.atk],
        withTraits = (w, lv) => {
          const ru = makeRune(w),
            ks = Object.keys(TRAITS[w] || {}),
            all = lv !== undefined || chance(0.4);
          ru.traits = ks.filter(() => all || chance(0.6)).map((k) => ({ k, lv: lv ?? (all ? pick([3, 4, 5]) : 1 + Math.floor(r() * 5)) }));
          return ru;
        };
      const hand = (w) => ({
        atk: w,
        slots: [chance(0.5) ? makeRune(pick(RUNE_TYPES.elem)) : null, chance(0.4) ? makeRune(pick(RUNE_TYPES.mod)) : null],
        slotN: 2,
        turn: 0,
        elem: null,
        trig: null,
      });
      const setHands = (wL, wR) => {
        gear.hands = {
          L: hand(wL),
          R: hand(wR ?? wL),
          B: { b0: chance(0.5) ? makeRune(pick(RUNE_TYPES.body)) : null, b1: null },
        };
        for (const h of ['L', 'R']) {
          const H = gear.hands[h];
          const el = H.slots.find((x) => x && RUNE_TYPES.elem.includes(x.type));
          H.elem = el ?? null;
        }
      };
      // 両手で持つ武器（短弓・雨・大剣・杖）は、両手に同じルーン。片手の武器は、もう片方の手に別の片手の武器
      const TWO = ['bolt', 'rain', 'gsword', 'mstaff'],
        oneHand = () => withTraits(pick(atk.filter((t) => !TWO.includes(t)))),
        arm = (w, lv) => (TWO.includes(w) ? setHands(withTraits(w, lv)) : setHands(withTraits(w, lv), oneHand()));
      setHands(oneHand(), oneHand());
      gear.bag = [];
      gear.castSt = null;
      gear.swapSt = null;
      gear.humNode = null;
      // 生き物：表の全部の種類の一部（プレイヤーのまわりに）
      here.monsters = [];
      here.mobSeq = 0;
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
      const kinds = Object.keys(MTYPES).filter((k) => MTYPES[k].col && !MTYPES[k].dummy);
      for (const key of kinds) {
        if (!chance(0.45) && MTYPES[key].critter !== 'mimic') continue;
        const i = nearFloor(chance(0.6) ? 6 : 14);
        here.monsters.push(makeMonster({ key, cx: i % MW, cz: (i / MW) | 0, g: -1 }));
      }
      for (const m of here.monsters) {
        m.hp = m.maxHp = 5 + Math.floor(r() * 30);
        m.noticed = chance(0.5);
        m.sleep = chance(0.2);
        m.visible = chance(0.8);
        if (chance(0.2)) m.rise = r();
      }
      const foes = () => here.monsters.filter((m) => !m.dead && !m.ty.critter && !m.ty.peaceful);
      // 新しく置く（前の場面で倒れた生き物が多い時のため）。飛ばない・水に住まない種類
      const walkers = kinds.filter((k2) => !MTYPES[k2].critter && !MTYPES[k2].peaceful && !MTYPES[k2].habitat && !MTYPES[k2].boss);
      const fresh = (x, z) => {
        const key = pick(walkers),
          m = makeMonster({ key, cx: Math.floor(x / CELL), cz: Math.floor(z / CELL), g: -1 });
        Object.assign(m, { x, z, hp: 20, maxHp: 20, visible: true });
        here.monsters.push(m);
        return m;
      };
      // 前に並べる：見ている向きの先に、距離 d で
      const ahead = (m, d, side = 0) => {
        const fx = -Math.sin(player.yaw),
          fz = -Math.cos(player.yaw);
        m.x = player.x + fx * d + fz * side;
        m.z = player.z + fz * d - fx * side;
        m.cx = Math.floor(m.x / CELL);
        m.cz = Math.floor(m.z / CELL);
        m.dead = false;
        m.hidden = false;
        if (m.hp <= 0) m.hp = 10;
      };
      const calls = [];
      let eruptSeen = null,
        bigCell = -1,
        bigLava = false,
        lavaflow = null,
        orderKept = null,
        water = null,
        thawed = null,
        lavaLeft = null;
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
            burning: blaze.burning.join(','),
            gasAny: blaze.gasAny,
            gasTmp: hashArr(blaze.gasTmp),
            brimT: blaze.brimT,
            trampled: blaze.trampled,
            lastBoom: blaze.lastBoom,
          },
          D: {
            gas: hashArr(D.gas),
            liquid: hashArr(D.liquid),
            surface: hashArr(D.surface),
            tile: hashArr(D.tile),
            pit: D.pit ? hashArr(D.pit) : null,
            solid: D.solid.size,
            deco: D.decoCell.size,
            flags: [D.collapsed, D.teleMsg],
            traps: D.traps,
            gate: D.gate,
            lights: D.lights.map((l) => l.active),
          },
          events: here.events,
          fixtures: here.fixtures.map((f) => f.active),
          adv: { dead: adv.dead },
          here: { trans: here.trans },
          gear: { castSt: gear.castSt, swapSt: gear.swapSt, hum: !!gear.humNode, hands: gear.hands },
          U: gfx.U,
          cellTex: gfx.cellTex.needsUpdate,
          pN: buf.pN,
          p: Object.values(P)
            .map((a) => hashArr(a, 0, buf.pN))
            .join(''),
          dn: buf.dn,
          d: [hashArr(dPos, 0, buf.dn * 3), hashArr(dCol, 0, buf.dn * 3), hashArr(dPar, 0, buf.dn * 4)].join(''),
          book: [...saved.BOOK],
          fn: FN_FIELDS.map(([f, k]) => F[f][k]),
          errs,
        });
      const call = (name, ...args) => {
        const m0 = mrN,
          s0 = sndN,
          g0 = msgN,
          t0 = timers.st.n,
          a0 = alog.length;
        let ret, threw;
        try {
          ret = F[name](...args);
        } catch (e) {
          threw = String(e && e.message).slice(0, 40);
        }
        calls.push({
          name,
          ret: name === 'chantStart' ? !!ret : text(ret),
          threw,
          mr: mrN - m0,
          snd: sndN - s0,
          msg: msgN - g0,
          timers: timers.st.n - t0,
          audio: fnv(JSON.stringify(alog.slice(a0))),
          state: fnv(state()),
          msgs: msgs.map((m) => m.html).join('|'),
        });
        return ret;
      };
      // ゲームの時計を進め、稲妻の順番待ちと setTimeout を流す（遅れて起きること fight.laters は updateZones が流す）
      const tick = (dt) => {
        clock.time += dt;
        actx.currentTime += dt;
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
        timers.flush();
        buf.dn = 0;
      };

      // ---- 場面：詠唱（始められない時・素手・溜めの要らない武器・溜めて離す・溜めすぎる・持ち替えの途中）
      call('timeScale');
      for (const [k, v] of [
        ['dead', 1],
        ['trans', 1],
        ['started', 0],
        ['paused', 1],
        ['swap', 1],
        ['cast', 1],
        ['beam', 1],
        ['net', 1],
        ['roll', 1],
        ['recover', 1],
      ]) {
        if (k === 'dead') adv.dead = true;
        if (k === 'trans') here.trans = { t: 0 };
        if (k === 'started') ui.started = false;
        if (k === 'paused') ui.menuOpen = true;
        if (k === 'swap') gear.swapSt = { t: 0, dur: 1, snap: snapHands(), last: 0 };
        if (k === 'cast') gear.castSt = { h: 'L', t: 0, need: 1, full: false, hold: 0 };
        if (k === 'beam') fight.beamRun = { h: 'L', t: 1, tick: 0, dir: null, auto: chance(0.5) };
        if (k === 'net') player.netT = 1;
        if (k === 'roll') player.roll = { t: 0, dx: 1, dz: 0 };
        if (k === 'recover') player.recover = 0.5;
        call('beginCast', pick(['L', 'R']));
        Object.assign(adv, { dead: false });
        Object.assign(here, { trans: null });
        Object.assign(ui, { started: true, menuOpen: false });
        Object.assign(gear, { swapSt: null, castSt: null });
        fight.beamRun = null;
        Object.assign(player, { netT: 0, roll: null, recover: 0 });
      }
      const weapons = [...atk, 'bare'];
      for (const w of weapons) {
        if (!chance(0.7)) continue;
        if (w === 'bare') setHands(null, null);
        else arm(w);
        const h = pick(['L', 'R']);
        if (chance(0.3)) player.qcUntil = clock.time + 1;
        if (chance(0.3)) player.hp = 10;
        for (const m of foes().slice(0, 3)) ahead(m, 2 + r() * 6, (r() - 0.5) * 2);
        call('beginCast', h);
        call('timeScale');
        const mode = pick(['early', 'full', 'over', 'wrong']);
        for (let q = 0; q < (mode === 'over' ? 40 : 14); q++) {
          call('updateCast', pick([0.05, 0.1, 0.2]));
          tick(0.1);
          if (mode === 'early' && q === 1) call('releaseCast', h);
          if (mode === 'full' && gear.castSt && gear.castSt.full) call('releaseCast', h);
          if (mode === 'wrong' && q === 2) call('releaseCast', h === 'L' ? 'R' : 'L');
        }
        call('releaseCast', h);
        player.hp = adv.PLAYER_MAX;
        for (let q = 0; q < 4; q++) {
          call('updateCast', 0.1);
          tick(0.1);
        }
      }
      // 溜め終わらずに離して、声が残っているうちにまた始める（声を止めてから始め直す）。体力が少なく、捨て身の加護がある
      setHands(withTraits('orb'), withTraits('blade'));
      player.hp = 5;
      adv.lvl.bless.desperate = 2;
      call('beginCast', 'L');
      call('releaseCast', 'L');
      call('beginCast', 'R');
      call('fizzle');
      for (let q = 0; q < 40; q++) {
        call('updateCast', 0.1);
        tick(0.1);
      }
      player.hp = adv.PLAYER_MAX;
      // 詠唱の途中で、探索が止まる・持ち替えが進む・光線を撃ち続ける
      setHands(withTraits('orb'), withTraits('beam'));
      call('beginCast', 'L');
      ui.started = false;
      call('updateCast', 0.1);
      ui.started = true;
      for (const edgeOn of [false, true]) {
        adv.lvl.bless.swapedge = edgeOn ? 1 : 0;
        gear.swapSt = { t: 0, dur: 0.35, snap: snapHands(), last: 0 };
        for (let q = 0; q < 5; q++) call('updateCast', 0.1);
      }
      fight.beamRun = { h: 'R', t: 0.4, tick: 0, dir: chance(0.5) ? [0, 0, -1] : null, auto: chance(0.5) };
      for (let q = 0; q < 6; q++) {
        call('updateCast', 0.1);
        tick(0.1);
      }
      fight.hitStopUntil = clock.time * 1000 + 50;
      call('timeScale');
      fight.hitStopUntil = 0;
      // ---- 場面：詠唱の声（性質ごと・溜まる・溜め終わる・止める・二度止める・音が鳴らない）
      for (const el of ELEMS) {
        if (!chance(0.5)) continue;
        const v = call('chantStart', el);
        if (v) {
          for (let q = 0; q < 6; q++) {
            actx.currentTime += 0.15;
            v.tick(q / 5, q >= 4);
          }
          v.stop();
          v.tick(1, true);
          v.stop();
        }
      }
      SND.on = false;
      call('chantStart', 'fire');
      SND.on = true;
      // ---- 場面：転がる（転がれない時・向き・持ち替えと詠唱と光線の途中）
      for (const k of ['dead', 'trans', 'cd', 'net', 'roll']) {
        if (k === 'dead') adv.dead = true;
        if (k === 'trans') here.trans = { t: 0 };
        if (k === 'cd') player.rollCd = 0.5;
        if (k === 'net') player.netT = 1;
        if (k === 'roll') player.roll = { t: 0, dx: 1, dz: 0 };
        call('startRoll');
        adv.dead = false;
        here.trans = null;
        Object.assign(player, { rollCd: 0, netT: 0, roll: null });
      }
      for (const ks of [[], ['KeyW'], ['ArrowUp', 'KeyD'], ['KeyS', 'KeyA'], ['ArrowDown'], ['KeyW', 'KeyS']]) {
        for (const k of ks) keys[k] = true;
        if (chance(0.4)) gear.swapSt = { t: 0, dur: 1, snap: snapHands(), last: 0 };
        if (chance(0.4)) {
          gear.castSt = { h: 'L', t: 0.2, need: 1, full: false, hold: 0 };
          fight.beamSegs = [{ t: 1 }];
        }
        if (chance(0.4)) fight.beamRun = { h: 'L', t: 1, tick: 0, dir: null, auto: false };
        call('startRoll');
        for (const k of ks) delete keys[k];
        Object.assign(player, { rollCd: 0, roll: null });
      }
      // ---- 場面：飛ぶ物（武器ごとに撃ち、生き物を前に並べて何歩も進める）
      const SHOT = ['bolt', 'orb', 'rapid', 'mstaff', 'blade', 'gsword', 'star', 'rain'];
      for (let round = 0; round < 6; round++) {
        const w = pick(SHOT);
        arm(w);
        for (const m of foes()) if (chance(0.5)) ahead(m, 1.5 + r() * 9, (r() - 0.5) * 1.5);
        if (chance(0.3)) player.pitch = -0.4 + r() * 0.2;
        for (const h of ['L', 'R']) castNow(h, { hold: r() * 2.5, chanted: chance(0.7), dir: null, auto: chance(0.3) });
        player.pitch = (r() - 0.5) * 0.3;
        if (chance(0.5)) fight.beamSegs.push({ t: 0.1 }, { t: 0.3 });
        for (let q = 0; q < 30 && (fight.projs.length || q < 3); q++) {
          call('updateProjs', pick([0.03, 0.05, 0.08]));
          if (q % 3 === 0) {
            call('updateStatuses', 0.1);
            for (const p of fight.projs) if (p.wave) call('drawWave', p);
          }
          tick(0.05);
        }
      }
      // 飛ぶ物を直に作る（壁を抜ける・跳ね返る・床と天井・地図の外・ゆっくり速くなる・追う）
      const sp = (w, el, lv) => {
        arm(w, lv);
        const s2 = specOf('L');
        s2.elem = el;
        return s2;
      };
      // 的へ向いて撃つ：前に置いた生き物の真ん中・閉じた扉・床・天井・地図の端の壁（跳ね返る・壁や床に当たる・扉に当たる・追う・飛びすぎて消える）
      const doorCells = D.doors.filter((d) => !d.gone).map((d) => d.i);
      const faceTo = (x, y, z) => {
        const dx = x - player.x,
          dz = z - player.z;
        player.yaw = Math.atan2(-dx, -dz);
        player.pitch = Math.atan2(y - player.eye, Math.hypot(dx, dz));
        gfx.camera.position.set(player.x, player.eye, player.z);
      };
      for (let k = 0; k < 16; k++) {
        // 1回目は、貫きの特性が1の短弓で生き物を射る（1体だけ貫き、次は弱くなる）
        const w = k === 0 ? 'bolt' : pick(['bolt', 'orb', 'mstaff', 'rapid', 'blade', 'gsword']);
        arm(w, k === 0 ? 1 : chance(0.5) ? pick([1, 3, 5]) : undefined);
        for (const h of ['L', 'R']) if (chance(0.6)) gear.hands[h].slots[1] = makeRune(pick(RUNE_TYPES.mod));
        const fs = foes(),
          to = k === 0 ? 0 : Math.floor(r() * 4);
        if (to === 0 && fs.length) {
          const m = pick(fs);
          ahead(m, 2 + r() * 4, 0);
          if (chance(0.5)) delete m.st;
          faceTo(m.x, m.y + (m.ty.flier ? 0 : 0.6 * m.ty.scale), m.z);
        } else if (to === 1 && doorCells.length) {
          const di = pick(doorCells),
            [x, z] = cpos(di);
          for (const [ox, oz] of [
            [2.5, 0],
            [-2.5, 0],
            [0, 2.5],
            [0, -2.5],
          ]) {
            const c = Math.floor((z + oz) / CELL) * MW + Math.floor((x + ox) / CELL);
            if (D.tile[c] === TF) {
              player.x = x + ox;
              player.z = z + oz;
              break;
            }
          }
          faceTo(x, 1, z);
        } else if (to === 2) {
          player.pitch = chance(0.5) ? -0.9 : 0.9;
        }
        for (const h of ['L', 'R']) if (chance(0.7)) castNow(h, { hold: r() * 2.5, chanted: chance(0.7), dir: null, auto: chance(0.2) });
        for (let q = 0; q < 30 && (fight.projs.length || fight.laters.length); q++) {
          call('updateProjs', 0.05);
          if (q % 2 === 0) call('updateZones', 0.1);
          tick(0.05);
        }
        fight.projs = [];
        Object.assign(player, { x: px, z: pz, pitch: 0 });
        gfx.camera.position.set(player.x, player.eye, player.z);
      }
      // 直に：月が弾ける（状態異常の残り・引き寄せた生き物）
      for (let k = 0; k < 4; k++) {
        const fs = foes();
        if (!fs.length) break;
        const m = pick(fs);
        if (k === 3) delete m.st;
        if (chance(0.5)) m.st = { burn: 1, chill: 1, shock: 1, poison: 1, pinCd: chance(0.5) ? clock.time + 1 : 0 };
        const s3 = sp('mstaff', pick(ELEMS)),
          pulled = new Set(fs.slice(0, 2));
        if (k === 1) for (const o of pulled) delete o.st;
        call('moonBurst', { moon: 1 + r() * 2, sp: s3, tide: pick([0, 5]), pulled }, m.x, 1, m.z);
      }
      // ---- 場面：状態異常・吹き飛び（壁で止まる）・毒の霧・魔法の場・雨・遅れて起きること
      for (let k = 0; k < 3; k++) {
        adv.lvl.bless.scorch = k === 1 ? 1 : 0;
        for (const m of foes()) {
          if (!chance(0.5)) continue;
          m.st = {
            burn: chance(0.5) ? (chance(0.5) ? 0.05 : r() * 2) : 0,
            scorched: k === 1 && chance(0.5),
            poison: chance(0.4) ? r() * 2 : 0,
            chill: chance(0.4) ? r() * 2 : 0,
            pin: chance(0.3) ? r() : 0,
            shock: chance(0.3) ? r() : 0,
          };
          if (chance(0.4)) {
            m.kx = (r() - 0.5) * 12;
            m.kz = (r() - 0.5) * 12;
          }
        }
        // 壁の隣で、壁へ向かって飛ばす
        const fs = foes();
        if (fs.length) {
          const m = pick(fs);
          for (let i = 0; i < NCELL; i++)
            if (D.tile[i] === TF && D.tile[i + 1] === TW) {
              const [x, z] = cpos(i);
              Object.assign(m, { x: x + 0.3, z, cx: i % MW, cz: (i / MW) | 0, kx: 8, kz: 0, st: m.st || {} });
              break;
            }
        }
        // 毒の霧と魔法の場の中に、状態の無い生き物も
        for (const m of foes().slice(0, 4)) {
          ahead(m, 0.6 + r(), (r() - 0.5) * 0.8);
          if (chance(0.5)) delete m.st;
        }
        const s2 = sp('orb', 'poison');
        orbBurst(player.x - Math.sin(player.yaw) * 3, 0.5, player.z - Math.cos(player.yaw) * 3, s2, { dmg: 0.5 });
        fight.clouds.push({ x: player.x, z: player.z, r: 3, t: 1, tick: 0 });
        addZone(player.x, player.z, 2, sp('orb', pick(RUNE_TYPES.elem)), 2, chance(0.5));
        startRain(sp('rain', pick(ELEMS)), player.x, player.z, chance(0.5));
        fight.rains.push({ x: player.x + 2, z: player.z, r: 2, iv: 0.1, tick: 0, left: 5, sp: sp('rain', 'fire'), elemK: 1, follow: true });
        fight.marks.push({ x: player.x, z: player.z, t: 0.3 });
        later(0.1, () => (player.hp += 0));
        if (k === 1)
          later(0.05, () => {
            throw new Error('遅れて起きることの中の例外');
          });
        // 燃えが尽きる時に、焦がしの加護が効いていた（体力が戻る）。毒の霧の中に、状態の無い生き物
        const fs2 = foes();
        if (k === 1) fresh(player.x + 3, player.z).st = { burn: 0.05, scorched: true };
        if (fs2.length) {
          ahead(fs2[0], 0.8, 0);
          delete fs2[0].st;
          fight.clouds.push({ x: fs2[0].x, z: fs2[0].z, r: 1.5, t: 1, tick: 0 });
        }
        for (let q = 0; q < 14; q++) {
          call('updateStatuses', pick([0, 0.1, 0.25]));
          tick(0.1);
        }
        call('updateZones', 0.1);
        call('updateRains', 0.1);
      }
      for (const m of here.monsters.slice(0, 12)) {
        if (chance(0.3)) m.st = { shock: chance(0.5) ? 1 : 0, pin: chance(0.3) ? 1 : 0, chill: chance(0.5) ? 1 : 0 };
        call('monTimeK', m);
      }
      const mim = here.monsters.find((m) => m.ty.critter === 'mimic');
      if (mim) {
        for (const hid of [true, false]) {
          mim.hidden = hid;
          call('monTimeK', mim);
          clock.time += 0.4;
          call('monTimeK', mim);
        }
      }
      // ---- 場面：毒の霧に火が届く（燃えるマスが無い・ある、プレイヤーが近い・遠い、魔導書に書いてある・ない）
      for (let k = 0; k < 3; k++) {
        const cx = player.x + (k === 2 ? 30 : 1),
          cz = player.z;
        fight.clouds = [
          { x: cx, z: cz, r: 2, t: k === 0 ? 0 : 2, tick: 1 },
          { x: player.x, z: player.z + 1, r: 1.5, t: 2, tick: 1 },
        ];
        if (k > 0) {
          const i = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL);
          blaze.fire[i] = 0.5;
          blaze.fire[Math.floor(cz / CELL) * MW + Math.floor(cx / CELL)] = 0.5;
        }
        for (let q = 0; q < 2; q++) fresh(cx + (r() - 0.5) * 0.6, cz + (r() - 0.5) * 0.6);
        if (k === 1) {
          saved.BOOK.delete('blast');
          noStore = true;
        }
        if (k === 2) saved.BOOK.add('blast');
        call('cloudsMeetFire');
        noStore = false;
        tick(0.1);
      }
      if (adv.dead) adv.dead = false;
      player.hp = adv.PLAYER_MAX;
      // ---- 場面：剣の波を描く（大剣の払い・突き・左右の手・飛んだ割合）
      for (const w of ['blade', 'gsword']) {
        arm(w);
        const s2 = specOf(pick(['L', 'R']));
        fireWave(s2, [-Math.sin(player.yaw), 0, -Math.cos(player.yaw)], null);
        for (const p of fight.projs)
          for (const t of [0, 0.2, 0.6]) {
            p.t = t;
            call('drawWave', p);
          }
        call('drawWave', { ...fight.projs[0], thrust: true, sp: { ...s2, h: 'L' } });
        call('drawWave', { x: player.x, y: 1, z: player.z, vx: 0, vy: 0, vz: 0, t: 0, sp: s2, big: true });
        fight.projs = [];
        buf.dn = 0;
      }
      // ---- 場面：火とガス（火の備品がガスに触れる・燃え広がる・燃え尽きる・水の隣で湯気）
      {
        const i0 = nearFloor(8);
        if (blaze.fireSrc.length) {
          const s0 = pick(blaze.fireSrc);
          for (const j of [s0, s0 + 1, s0 - 1, s0 + MW, s0 - MW]) if (j >= 0 && j < NCELL) D.gas[j] = 0.3;
        }
        for (let k = 0; k < 30; k++) {
          const i = nearFloor(10);
          const w = Math.floor(r() * 5);
          if (w === 0) blaze.fuel[i] = 0.5 + r();
          if (w === 1) D.gas[i] = 0.3 + r() * 0.5;
          if (w === 2) D.liquid[i] = pick([LQ_WATER, LQ_DEEP]);
          if (w === 3) D.surface[i] = SF_BRIM;
          if (w === 4) {
            D.surface[i] = SF_DEAD;
            blaze.fuel[i] = 0.6;
          }
        }
        blaze.fuel[i0] = 1;
        ignite(i0, 1, false);
        if (D.doors.length) {
          const di = pick(D.doors).i;
          blaze.fuel[di] = 0.05;
          ignite(di, 0.3, false);
        }
        blaze.fuel[i0 + 1] = 0;
        D.liquid[i0 + 1] = LQ_WATER;
        ignite(nearFloor(10), 1, false);
        for (let q = 0; q < 14; q++) {
          call('stepFire');
          if (q % 2 === 0) call('stepGas');
          if (q % 3 === 0) call('brimRecover', 0.8);
          tick(0.1);
        }
        // 沼のガスが湧く（沼のマスを、プレイヤーの近くと遠くに）
        D.bogList = [nearFloor(6), nearFloor(6), ...Array.from({ length: 30 }, () => Math.floor(r() * NCELL))];
        for (const i of D.bogList) D.liquid[i] = LQ_BOG;
        for (let q = 0; q < 40; q++) call('stepGas');
        // 燃えた硫黄が戻る
        for (let k = 0; k < 6; k++) {
          const i = nearFloor(8);
          D.surface[i] = SF_BRIM;
          blaze.burnt[i] = chance(0.5) ? 1 : 0;
          blaze.fuel[i] = 0;
          blaze.fire[i] = 0;
        }
        for (let q = 0; q < 4; q++) call('brimRecover', 0.9);
        // 踏み分けた茂みが戻る（時間がたった・たっていない・プレイヤーの立つマス）
        call('regrow');
        const pc = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL);
        const tr = [pc, nearFloor(6), nearFloor(6), nearFloor(6)];
        for (const i of tr) blaze.cellFlag[i] = 20;
        blaze.cellFlag[tr[3]] = 0;
        blaze.trampled = tr.map((i, j) => [i, clock.time - (j === 2 ? 10 : 60)]);
        call('regrow');
        blaze.trampled = [[tr[2], clock.time - 10]];
        call('regrow');
      }
      // ---- 場面：部屋の出来事（本物の階の出来事と、種類ごとに作った物）
      initEvents();
      // 部屋の床のマス（像・柱などの通れないマスは除く。本物の階では、溶岩の流れる道や出来事のマスにならない。
      // 除かないと、像が目覚めてマスの印を変え、火口の溶岩が引かずに残る、のように、本物の階で起きない場面になる）
      const rooms = D.rooms,
        roomCells = (ri) => {
          const out2 = [];
          for (let i = 0; i < NCELL; i++) if (D.roomOf[i] === ri && D.tile[i] === TF && !D.solid.has(i)) out2.push(i);
          return out2;
        };
      const goto = (i, dx = 0) => {
        const [x, z] = cpos(i);
        player.x = x + dx;
        player.z = z;
      };
      const ri0 = Math.floor(r() * rooms.length),
        cells0 = roomCells(ri0);
      const ri1 = (ri0 + 1) % rooms.length,
        cells1 = roomCells(ri1);
      if (cells0.length > 6 && cells1.length > 6) {
        const spring = here.fixtures.findIndex((f) => f.type === 'spring'),
          crater = here.fixtures.findIndex((f) => f.type === 'crater'),
          fixCell = (k) => (k < 0 ? -1 : Math.floor(here.fixtures[k].z / CELL) * MW + Math.floor(here.fixtures[k].x / CELL));
        const order = cells0.slice(-8);
        here.events.push(
          { type: 'statue', cell: cells0[0], done: false, active: false, t: 0 },
          { type: 'collapse', cells: cells0.slice(1, 4), ri: ri0, state: 0, t: 0 },
          { type: 'oracle', cell: cells0[2], done: false },
          { type: 'flood', ri: ri0, order: order.slice(), src: fixCell(spring), state: 0, t: 0, k: 0 },
          { type: 'lavaflow', ri: ri0, order: order.slice(), src: fixCell(crater), state: 0, t: 0, k: 0 },
          { type: 'tele', a: cells0[3], b: cells1[0], lock: -1 },
          { type: 'erupt', src: fixCell(crater) >= 0 ? fixCell(crater) : cells1[1], order: cells1.slice(0, 6), state: 0, t: 0.2, k: 0 },
          { type: 'haunt', ri: ri0, tombs: cells0.slice(4, 6), done: false, t: -1 },
        );
        for (const m of foes().slice(0, 2))
          Object.assign(m, { x: cpos(order[0])[0], z: cpos(order[0])[1], cx: order[0] % MW, cz: (order[0] / MW) | 0 });
        // 崩れる床の上に、飛ぶ物と飛ばない物
        const flier = kinds.find((k2) => MTYPES[k2].flier && !MTYPES[k2].critter),
          walker = kinds.find((k2) => !MTYPES[k2].flier && !MTYPES[k2].critter && !MTYPES[k2].habitat),
          pitM = [flier, walker].filter(Boolean).map((key, j) => {
            const c = cells0[1 + j];
            return makeMonster({ key, cx: c % MW, cz: (c / MW) | 0, g: -1 });
          });
        here.monsters.push(...pitM);
        // 溶岩の流れる所に燃えるガス
        D.gas[order[2]] = 0.5;
        const src2 = cells0[Math.floor(cells0.length / 2)];
        here.fovVis[src2] = here.fovStamp;
        here.events.push({ type: 'erupt', src: src2, order: cells1.slice(0, 4), state: 0, t: 0.1, k: 0 });
        if (chance(0.5)) here.fovVis[cells1[1]] = here.fovStamp;
        if (chance(0.5)) saved.LEGEND = null;
        const erupts = here.events.filter((e) => e.type === 'erupt'),
          seen = new Map(erupts.map((e) => [e, new Set([e.state])]));
        // 流れる順の写し（噴き上がりの後も、並びが変わらないか）と、水のマスを1つ（引いた後に水へ戻るか）
        const order0 = erupts.map((e) => e.order.slice()),
          wet = erupts[0].order[4],
          ice = erupts[0].order[5],
          grass = erupts[0].order[3];
        D.liquid[wet] = LQ_WATER;
        // 凍らせた水（液体は仮の 0、本当の中身は blaze.frozen）と、踏み分けた草（液体の無い床に、印 20 と、生え戻りの一覧）
        blaze.frozen.set(ice, { t: 999, liq: LQ_WATER, surf: D.surface[ice] });
        D.liquid[ice] = 0;
        D.surface[ice] = SF_ICE;
        D.liquid[grass] = 0;
        blaze.cellFlag[grass] = 20;
        blaze.trampled.push([grass, clock.time]);
        // 流れる道のマスで、初めから溶岩でない物（引き終えたら、どれも溶岩でなくなる）
        const dry = [...new Set(erupts.flatMap((e) => e.order))].filter((i) => D.liquid[i] !== LQ_LAVA);
        let wetLava = false,
          // 踏み分けた草のマス：溶岩が流れたか、引いて印 20 に戻った時に生え戻りの一覧にあったか
          grassLava = false,
          grassBack = null;
        const watchGrass = () => {
          if (blaze.cellFlag[grass] === 70) grassLava = true;
          else if (grassLava && grassBack === null && blaze.cellFlag[grass] === 20) grassBack = blaze.trampled.some(([i]) => i === grass);
        };
        // 体の大きな生き物（トロル）を、流れる道の隣のマスの、道との境の近くに止めておく（体が道のマスにかかる。溶岩はそこへ流れない）
        const way = erupts[0].order[2];
        for (const d of [1, -1, MW, -MW]) {
          const j = way + d;
          if (D.tile[j] !== TF || D.liquid[j] || erupts.some((e) => e.order.includes(j))) continue;
          const big = makeMonster({ key: 'T', cx: j % MW, cz: (j / MW) | 0, g: -1 }),
            [jx, jz] = cpos(j),
            [wx, wz] = cpos(way);
          Object.assign(big, { x: jx + (wx - jx) * 0.45, z: jz + (wz - jz) * 0.45, wait: 999 });
          here.monsters.push(big);
          bigCell = way;
          break;
        }
        for (let q = 0; q < 60; q++) {
          if (q === 0) goto(cells0[0]);
          if (q === 20) goto(cells0[3]);
          if (q === 24) goto(cells1[0]);
          if (q === 26) goto(cells1[0], 1.5);
          if (q === 28) goto(cells1[0]);
          if (q === 30) goto(cells0[5]);
          call('updateEvents', pick([0.1, 0.3]), clock.time);
          tick(0.2);
          for (const e of erupts) seen.get(e).add(e.state);
          if (bigCell >= 0 && D.liquid[bigCell] === LQ_LAVA) bigLava = true;
          if (D.liquid[wet] === LQ_LAVA) wetLava = true;
          watchGrass();
          regrow();
        }
        // 噴き上がりを最後まで（流れ出す 1 → 待つ 2 → 引く 3 → 次まで待つ 0）。足もとには流れないので、離れて立つ
        goto(cells0[5]);
        for (let q = 0; q < 70 && !erupts.every((e) => seen.get(e).has(3) && e.state === 0); q++) {
          call('updateEvents', pick([0.2, 0.4]), clock.time);
          tick(0.2);
          for (const e of erupts) seen.get(e).add(e.state);
          if (bigCell >= 0 && D.liquid[bigCell] === LQ_LAVA) bigLava = true;
          if (D.liquid[wet] === LQ_LAVA) wetLava = true;
          watchGrass();
          regrow();
        }
        orderKept = erupts.every((e, n) => JSON.stringify(e.order) === JSON.stringify(order0[n]));
        water = [wetLava, D.liquid[wet] === LQ_WATER];
        // 引いた後：凍らせた水は水に（氷の一覧から外れる）。踏み分けた草は、溶岩が流れ、引いて印 20 に戻った時に生え戻りの一覧にある
        thawed = [D.liquid[ice] === LQ_WATER, !blaze.frozen.has(ice), grassLava && grassBack === true];
        lavaLeft = erupts.every((e) => e.state === 0) ? dry.filter((i) => D.liquid[i] === LQ_LAVA).length : null;
        eruptSeen = erupts.map((e) => [...seen.get(e)].sort((a, b) => a - b).join(''));
        // 部屋の出来事の溶岩の流れ：状態と、流れる順のマスで、溶岩でなく、塞がれてもいない物の数
        // （塞がれている：プレイヤーの近くか、溶岩を歩けない生き物がいる・向かっている・体がかかる。src/lib/events.ts の lavaBlocked と同じ決まり）
        const blocked = (i) => {
          const [x, z] = cpos(i),
            x0 = (i % MW) * CELL,
            z0 = Math.floor(i / MW) * CELL;
          return (
            Math.hypot(x - player.x, z - player.z) < 1.6 ||
            here.monsters.some(
              (m) =>
                !m.ty.flier &&
                m.ty.habitat !== 'lava' &&
                (m.cz * MW + m.cx === i ||
                  m.tz * MW + m.tx === i ||
                  Math.hypot(m.x - Math.max(x0, Math.min(m.x, x0 + CELL)), m.z - Math.max(z0, Math.min(m.z, z0 + CELL))) <
                    0.35 * m.ty.scale),
            )
          );
        };
        const lf = here.events.find((e) => e.type === 'lavaflow');
        lavaflow = lf ? [lf.state, lf.order.filter((i) => D.liquid[i] !== LQ_LAVA && !blocked(i)).length] : null;
        call('oracleLegendHints');
        adv.HIST = null;
        saved.LEGEND = null;
        call('oracleLegendHints');
        adv.HIST = makeHistory(adv.runSeed);
      }
      // ---- 場面：罠（種類ごとに踏む・隠れた罠を見つける・網・鉄格子のレバー）
      goto(c0);
      here.trans = null;
      for (const type of ['alarm', 'trapdoor', 'net', 'flood', 'methane']) {
        const i = nearFloor(4);
        call('triggerTrap', { i, type, hidden: true, used: false, order: [i, i + 1, i - 1] });
        here.trans = null;
        player.fall = null;
      }
      {
        const pc = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL);
        D.traps = [
          { i: pc, type: pick(['net', 'alarm', 'methane']), hidden: true, used: false },
          { i: pc + 1, type: 'net', hidden: true, used: false },
          { i: nearFloor(20), type: 'alarm', hidden: false, used: true },
        ];
        player.vx = chance(0.5) ? 1 : 0;
        for (let q = 0; q < 8; q++) {
          stealth.sneak = q % 2 === 0;
          if (q === 4) keys.KeyW = true;
          call('updateTraps', 0.5);
          tick(0.5);
        }
        delete keys.KeyW;
        const lever = nearFloor(6),
          [lx, lz] = cpos(lever);
        D.gate = { cell: nearFloor(6), lever, ld: [1, 0], open: false, o: 0, axis: 0 };
        call('updateTraps', 0.2);
        Object.assign(player, { x: lx + 0.6, z: lz });
        for (let q = 0; q < 3; q++) call('updateTraps', 0.2);
        D.traps = undefined;
        D.gate = null;
        call('updateTraps', 0.2);
      }
      out.push({
        seed: s,
        place: place.label ?? JSON.stringify(place),
        calls,
        timers: { ...timers.st },
        eruptSeen,
        big: bigCell >= 0 ? bigLava : null,
        lavaflow,
        orderKept,
        water,
        thawed,
        lavaLeft,
      });
    }
  } finally {
    console.error = keepErr;
    restoreGlobals();
    delete msgs.push;
    Math.random = keep.random;
    setSoundRand(keep.sound);
    const boxes = { here, adv, player, ui, vfx, blaze, fight, stealth, SND, buf, gear, gfx, keys, saved };
    for (const [k, obj] of Object.entries(boxes)) {
      for (const f of Object.keys(obj)) if (!(f in keep[k])) delete obj[f];
      Object.assign(obj, keep[k]);
    }
    clock.time = keep.time;
    MTYPES['lord'] = keep.lord;
    MTYPES['X'] = keep.X;
    msgs.length = 0;
    msgs.push(...keep.msgs);
    for (const [k, fs] of keptTypes)
      for (const [f, d] of fs) {
        if (d) Object.defineProperty(MTYPES[k], f, d);
        else delete MTYPES[k][f];
      }
  }
  return out;
}

/** 記録を1つの文字列にする（step.test.mjs が指紋を取る） */
export const stepText = (all) =>
  all.map((c) => JSON.stringify({ seed: c.seed, place: c.place, calls: c.calls, timers: c.timers })).join('\n');
