// テストの道具：タイトルの画面（src/lib/intro.ts）・入力（src/lib/input.ts）・開発用の命令（src/lib/debug.ts）を、たくさんの場合で呼び、結果を1つの文字列にまとめる。
// F は関数をまとめた物。intro.test.mjs が、この文字列の指紋を確かめる。
// ここで確かめない処理（新しい階・音・図鑑・メニュー・装備の画面・詠唱など）は、intro.test.mjs が vi.mock で、呼んだ時の記録だけ取る物に入れ替える
// （記録は globalThis.__alMock.log。返す値は __alMock.ret で場合ごとに決める）。
// タイトルと入力の場合：記録 META・開発用モード・持ち主・指で触る端末・自動で試すかを変えてタイトルを用意し、タイトルのボタンを押し・シードを打ち・描き直し・
// [迷宮に入る] を押す。続けて、マウスとキーの処理を用意し、開け閉めの状態を変えながら、キー・マウス・ホイール・離れる・隠れる・マウスを捕まえた知らせと、
// 指の操作のボタン（[装備]・[メニュー]・[持ち替え]・図鑑の指）を乱数で混ぜて送る。
// 開発用の命令の場合：Node で本物の迷宮を生成し、祭壇・泉・生き物を置いて、dbg の全部の命令・F2 の画面とそのボタン・URL の指定を通す。
// 記録するのは、返す値と、呼ぶたびの状態（ui・記録・探索・場所・プレイヤー・押しているキー）と、画面の部品にした事と、入れ替えた処理を呼んだ記録の並び。
// テストを .mjs で書くのは、偽の画面の部品を、本物の型に合わせられないため。
// 書き換えた状態と、document・window・location・localStorage・performance・setTimeout・Math.random は、終わったら元に戻す。
import { addLooks } from '../../src/lib/bodies/build.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { makeRune } from '../../src/lib/gear.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { makeMonster } from '../../src/lib/monsters.ts';
import { META_DEF } from '../../src/lib/progress.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { adv, blaze, clock, fight, gear, gfx, here, keys, player, saved, ui } from '../../src/lib/state.ts';
import { NCELL, TF, cpos } from '../../src/lib/world.ts';
import { autoSt } from '../../src/lib/auto.ts';
import { fnv, text } from './fight-cases.mjs';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';

/** 確かめる関数の名前（場合が全部を呼ぶか、intro.test.mjs が確かめる。ほかの関数は、これらの中から呼ばれる） */
export const NAMES = [
  'initIntro',
  'buildIntroPanel',
  'redrawIntroLater',
  'initPointer',
  'initInput',
  'nextBuild',
  'togglePack',
  'toggleMenu',
  'initDbg',
  'setDbg',
  'dbgUrl',
];
/** 入れ替えた処理の記録と、返す値 */
export const M = (globalThis.__alMock ??= { log: [], ret: {} });

// ---------------------------------------------------------------- 偽の画面の部品
// innerHTML に書いた文から、ボタン・入力欄（id・class・data-*）を読み取って子にする（id があれば getElementById で返す）。
// 子の querySelectorAll は「tag.class[data-x]」の形だけを見る。listener は覚えておき、fire で偽のイベントを渡す（click は親へ伝わる）
const TAG = /<(button|input)\b([^>]*)>/g;
function fakePage(log) {
  const byId = new Map();
  const classList = (name) => {
    const set = new Set();
    return {
      set,
      add: (...c) => (c.forEach((x) => set.add(x)), log.push(['add', name, ...c])),
      remove: (...c) => (c.forEach((x) => set.delete(x)), log.push(['remove', name, ...c])),
      toggle: (c, on) => {
        const v = on === undefined ? !set.has(c) : Boolean(on);
        if (v) set.add(c);
        else set.delete(c);
        log.push(['toggle', name, c, v]);
        return v;
      },
      contains: (c) => set.has(c),
    };
  };
  const listeners = (owner) => {
    const all = [];
    return {
      all,
      add: (t, fn, o) => (all.push([t, fn]), log.push(['listen', owner, t, typeof o === 'object' ? o : (o ?? null)])),
    };
  };
  const matches = (e, sel) => {
    for (const one of sel.split(',')) {
      const m = /^(#[\w-]+)?([a-z]+)?((?:\.[\w-]+)*)((?:\[data-[a-z]+\])*)$/.exec(one.trim());
      if (!m) throw new Error(`偽の画面：選び方 ${one} は読めない`);
      const [, id, tag, cls, data] = m;
      if (id && e.id !== id.slice(1)) continue;
      if (tag && e.tag !== tag) continue;
      if (
        cls &&
        !cls
          .split('.')
          .filter(Boolean)
          .every((c) => e.classList.contains(c))
      )
        continue;
      if (data && ![...data.matchAll(/data-([a-z]+)/g)].every((d) => d[1] in e.dataset)) continue;
      return true;
    }
    return false;
  };
  const make = (id, tag = 'div', parent = null, cls = '') => {
    let html = '',
      kids = [];
    const ls = listeners(id || tag),
      name = id || `${parent ? parent.name : '?'}>${tag}`;
    const e = {
      id: id || '',
      tag,
      name,
      parent,
      dataset: {},
      style: {},
      onclick: null,
      value: '',
      classList: classList(name),
      tagName: tag.toUpperCase(),
      get innerHTML() {
        return html;
      },
      set innerHTML(v) {
        html = String(v);
        log.push(['html', name, fnv(html), html.length]);
        for (const k of kids) if (k.id && byId.get(k.id) === k) byId.delete(k.id);
        kids = [...html.matchAll(TAG)].map((m, n) => {
          const attrs = m[2],
            kidId = /\bid="([^"]*)"/.exec(attrs)?.[1] ?? '',
            k = make(kidId, m[1], e, /\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '');
          if (!kidId) k.name = `${name}>${m[1]}#${n}`;
          for (const d of attrs.matchAll(/data-([a-z]+)="([^"]*)"/g)) k.dataset[d[1]] = d[2];
          if (kidId) byId.set(kidId, k);
          return k;
        });
      },
      listeners: ls.all,
      addEventListener: ls.add,
      querySelectorAll: (sel) => kids.filter((k) => matches(k, sel)),
      querySelector: (sel) => {
        if (sel !== '.mk') throw new Error(`偽の画面：${name} の querySelector(${sel}) は無い`);
        return (e.mk ??= {
          set innerHTML(v) {
            log.push(['mk', name, v]);
          },
        });
      },
      closest: (sel) => {
        for (let p = e; p; p = p.parent) if (matches(p, sel)) return p;
        return null;
      },
      click: () => {
        log.push(['click', name]);
        fireUp(e, 'click', {});
      },
      focus: () => log.push(['focus', name]),
    };
    for (const c of cls.split(' ')) if (c) e.classList.set.add(c);
    return e;
  };
  // 親へ伝わる click：押した物から上へ、listener と onclick を呼ぶ
  const fireUp = (target, type, ev) => {
    const e = { target, preventDefault: () => log.push(['preventDefault', type]), stopPropagation: () => log.push(['stop', type]), ...ev };
    for (let p = target; p; p = p.parent) {
      for (const [t, fn] of p.listeners.slice()) if (t === type) fn(e);
      if (type === 'click' && p.onclick) p.onclick(e);
    }
  };
  const win = listeners('window'),
    doc = listeners('document');
  const page = {
    byId,
    make,
    fire(owner, type, ev = {}) {
      const list = owner === 'window' ? win.all : owner === 'document' ? doc.all : owner.listeners;
      const e = { preventDefault: () => log.push(['preventDefault', type]), stopPropagation: () => log.push(['stop', type]), ...ev };
      for (const [t, fn] of list.slice()) if (t === type) fn(e);
    },
    reset() {
      Object.assign(page.document, { activeElement: null, pointerLockElement: null, hidden: false });
      page.coarse = false;
      byId.clear();
      win.all.length = 0;
      doc.all.length = 0;
      for (const id of ['intropanel', 'intro', 'death', 'help', 'dbgp']) byId.set(id, make(id));
    },
    document: {
      getElementById: (id) => byId.get(id) ?? null,
      body: { classList: classList('body') },
      activeElement: null,
      pointerLockElement: null,
      hidden: false,
      exitPointerLock: () => log.push(['exitPointerLock']),
      addEventListener: doc.add,
    },
    window: {
      addEventListener: win.add,
      matchMedia: () => ({ matches: page.coarse }),
    },
    coarse: false,
  };
  return page;
}

/** 呼ぶたびの状態（DOM の部品は名前にする） */
const stateOf = () =>
  text({
    ui: Object.fromEntries(Object.entries(ui).filter(([k]) => !['introEl', 'errEl', 'gallery'].includes(k))),
    gallery: ui.gallery && { mode: ui.gallery.mode, idx: ui.gallery.idx, drag: ui.gallery.drag },
    META: saved.META,
    DEVALL: saved.DEVALL,
    run: [adv.runSeed, adv.dead, adv.PLAYER_MAX, adv.lvl, adv.runTrials, adv.runStats],
    here: [here.depth, here.branch, here.realm, here.inter],
    fight: [fight.rains.length, fight.marks.length, fight.zones.length, fight.laters.length],
    player: [player.x, player.z, player.yaw, player.pitch, player.hp],
    keys: { ...keys },
    explored: here.explored ? fnv(String(here.explored.reduce((a, b) => a + b, 0))) : null,
    wheelT: gfx.canvas?.wheelT,
    monsters: here.monsters.length,
  });

/** 状態の初めの値（場合ごとに戻す） */
function keepState() {
  return {
    here: { ...here },
    adv: { ...adv },
    player: { ...player },
    ui: { ...ui },
    gear: { ...gear },
    gfx: { ...gfx },
    saved: { ...saved },
    fight: { ...fight },
    autoOn: autoSt.on,
    time: clock.time,
    fire: blaze.fire,
    random: Math.random,
    lord: MTYPES['lord'],
    X: MTYPES['X'],
  };
}
function restoreState(k) {
  for (const f of Object.keys(ui)) if (!(f in k.ui)) delete ui[f];
  Object.assign(ui, k.ui);
  Object.assign(here, k.here);
  Object.assign(adv, k.adv);
  Object.assign(player, k.player);
  Object.assign(gear, k.gear);
  Object.assign(gfx, k.gfx);
  Object.assign(saved, k.saved);
  Object.assign(fight, k.fight);
  autoSt.on = k.autoOn;
  clock.time = k.time;
  blaze.fire = k.fire;
  Math.random = k.random;
  MTYPES['lord'] = k.lord;
  MTYPES['X'] = k.X;
  for (const c of Object.keys(keys)) delete keys[c];
}

/** 場合を流す土台：偽の画面と globals を入れ、場合ごとに状態を戻して body(s, env) を呼び、行を集める */
async function run(seeds, body) {
  const log = [],
    page = fakePage(log),
    k = keepState(),
    env = await loadEnv(),
    out = [];
  let nowMs = 0;
  const store = new Map();
  let blocked = false;
  const timers = new Map();
  let tid = 0;
  const location = { search: '' };
  const restoreGlobals = swapGlobals({
    document: page.document,
    window: page.window,
    location,
    localStorage: {
      getItem: (key) => {
        if (blocked) throw new Error('blocked');
        return store.has(key) ? store.get(key) : null;
      },
      setItem: (key, v) => {
        log.push(['store', key, v]);
        if (blocked) throw new Error('blocked');
        store.set(key, String(v));
      },
    },
    performance: { now: () => nowMs },
    setTimeout: (fn, ms) => (timers.set(++tid, { fn, ms }), log.push(['setTimeout', ms]), tid),
  });
  const keepErr = console.error;
  console.error = (e) => log.push(['console.error', String(e && e.message)]);
  try {
    for (let s = 1; s <= seeds; s++) {
      restoreState(k);
      page.reset();
      store.clear();
      blocked = false;
      timers.clear();
      log.length = 0;
      M.log.length = 0;
      M.ret = {};
      nowMs = 1000 * s;
      const r = mulberry32(s * 6151 + 29);
      const calls = [];
      const ctx = {
        r,
        pick: (a) => a[Math.floor(r() * a.length)],
        chance: (p) => r() < p,
        page,
        store,
        env,
        location,
        block: (on) => (blocked = on),
        tick: (ms) => (nowMs += ms),
        runTimers: () => {
          const all = [...timers.values()];
          timers.clear();
          for (const t of all) t.fn();
        },
        // 1回の呼び出しを記録する（返す値・例外・状態・画面にした事・入れ替えた処理の記録）
        call(name, fn) {
          log.length = 0;
          M.log.length = 0;
          let ret,
            threw = null;
          try {
            ret = fn();
          } catch (e) {
            threw = e instanceof Error ? e.constructor.name : String(e);
          }
          calls.push({ name, ret: text(ret), threw, state: stateOf(), dom: text(log), mock: text(M.log) });
          return ret;
        },
      };
      await body(s, ctx);
      out.push(JSON.stringify({ s, calls }));
    }
  } finally {
    console.error = keepErr;
    restoreGlobals();
    restoreState(k);
  }
  return out.join('\n');
}

/** Node で本物の迷宮を生成して、今の階にする（プレイヤーは始まりのマス）。始まりのマスの位置を返す */
function setupLevel(s, c) {
  const { r } = c;
  addLooks();
  const place = PLACES[(s * 7) % PLACES.length];
  adv.runSeed = (r() * 4294967296) >>> 0;
  Object.assign(here, {
    depth: place.depth,
    branch: place.branch ? { ...place.branch } : null,
    realm: place.realm ? { ...place.realm } : null,
    inter: place.inter ? { ...place.inter } : null,
  });
  const res = gen(c.env, (r() * 4294967296) >>> 0, place, adv.runSeed);
  if (res.lordType) MTYPES['lord'] = res.lordType;
  if (res.beastType) MTYPES['X'] = res.beastType;
  here.D = res.level;
  here.fixtures = res.level.fixtures;
  here.explored = new Uint8Array(NCELL);
  blaze.fire = new Float32Array(NCELL);
  adv.HIST = makeHistory(adv.runSeed);
  adv.lvl = { n: 3, exp: 1, pending: 0, bless: {}, strata: new Set() };
  adv.runState = {
    startChosen: false,
    altar1: false,
    taken: new Set(),
    lordsDone: new Set(),
    bodyOpen: Math.floor(r() * 3),
    slotPend: null,
  };
  adv.PLAYER_MAX = 40;
  const [sx, sz] = cpos(here.D.start);
  Object.assign(player, { x: sx, z: sz, yaw: 0, pitch: 0, hp: 30, rally: 2 });
  return [sx, sz];
}

// ---------------------------------------------------------------- タイトルと入力
const KEYS = [
  'Enter',
  'Space',
  'F2',
  'Escape',
  'Tab',
  'KeyM',
  'KeyH',
  'KeyR',
  'KeyP',
  'KeyJ',
  'Slash',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'KeyW',
  'KeyA',
  'ShiftLeft',
];
const OPEN_FLAGS = ['menuOpen', 'invOpen', 'altarOpen', 'lvlOpen', 'dbgOpen', 'plFailed', 'touch', 'locked'];

/** タイトルの画面と入力：F は { initIntro, buildIntroPanel, redrawIntroLater, initPointer, initInput, nextBuild, togglePack, toggleMenu, setDbg, initDbg, dbgUrl, dbg } */
export async function introCases(F, seeds) {
  return run(seeds, async (s, c) => {
    const { r, pick, chance, page } = c;
    setupLevel(s, c);
    // 記録 META（無い・欄が足りない・試練と解放がある・壊れている）、開発用モード、保存が使えないか
    const metaKind = s % 4;
    if (metaKind === 1) c.store.set('al_meta', JSON.stringify({ lore: 7 }));
    if (metaKind === 2)
      c.store.set(
        'al_meta',
        JSON.stringify({ lore: 200, spent: 30, unl: ['t_dim', 't_fury', 'w_star'], trials: ['dim'], touchTip: chance(0.5) }),
      );
    if (metaKind === 3) c.store.set('al_meta', '{broken');
    if (chance(0.5)) c.store.set('al_dev', '1');
    if (s % 7 === 0) c.block(true);
    ui.owner = chance(0.3);
    ui.devSeen = chance(0.2);
    ui.touch = chance(0.3);
    autoSt.on = chance(0.15);
    page.coarse = chance(0.3);
    M.ret.canOfferAuto = chance(0.3);
    M.ret.homeHint = chance(0.3);
    M.ret.owner = chance(0.4);
    adv.runSeed = (r() * 4294967296) >>> 0;
    here.depth = pick([1, 3, 6]);
    ui.started = false;
    gfx.canvas = page.make('gl', 'canvas');
    ui.introEl = page.byId.get('intro');
    c.call('initIntro', () => F.initIntro());
    c.block(false);
    // タイトルのボタンを押す・シードを打つ・描き直す
    for (let n = 0; n < 14; n++) {
      const btns = [...page.byId.values()].filter((e) => e.tag === 'button'),
        kids = page.byId.get('intropanel').querySelectorAll('button[data-unl],button[data-trial],button.sl[data-d]'),
        all = [...btns, ...kids].filter((b) => b.id !== 'enter');
      const what = r();
      if (what < 0.45 && all.length) {
        const b = pick(all);
        c.call(`click ${b.id || Object.entries(b.dataset).join()}`, () => b.click());
      } else if (what < 0.6) {
        const si = page.byId.get('seedIn');
        if (si) si.value = pick(['', '12345', ' 77 ', 'abc', String(adv.runSeed), '4294967295']);
        c.call('seed', () => 0);
      } else if (what < 0.75) {
        page.document.activeElement = chance(0.5) ? (page.byId.get('seedIn') ?? null) : null;
        c.call('redrawIntroLater', () => F.redrawIntroLater());
        const si = page.byId.get('seedIn');
        if (si && chance(0.5)) c.call('blur seedIn', () => page.fire(si, 'blur'));
      } else if (what < 0.85) {
        saved.DEVALL = chance(0.5);
        ui.owner = chance(0.5);
        autoSt.on = chance(0.2);
        M.ret.canOfferAuto = chance(0.4);
        c.call('buildIntroPanel', () => F.buildIntroPanel());
      } else {
        // 開発用モードの時だけ、始める深さを変えてから入る
        ui.startDepth = pick([1, 3, 6, here.depth]);
        const si = page.byId.get('seedIn');
        if (si) si.value = pick(['', '99', String(adv.runSeed), 'x1']);
        if (!page.byId.get('enter')) c.call('click unlBack', () => page.byId.get('unlBack').click());
        c.call('enter', () => page.byId.get('enter').click());
        c.call('timers', () => c.runTimers());
        if (ui.started && chance(0.5)) break;
      }
    }
    // 入力：マウスを捕まえた知らせ・指の土台・マウスとキー
    c.call('initPointer', () => F.initPointer());
    const touchHooks = M.touchHooks,
      padHooks = M.padHooks;
    c.call('initDbg', () => F.initDbg());
    c.call('initInput', () => F.initInput());
    gear.hands = { L: {}, R: {} };
    for (let n = 0; n < 60; n++) {
      // 開け閉めの状態と、入れ替えた処理の返す値を、ときどき変える
      if (chance(0.25)) {
        for (const f of OPEN_FLAGS) ui[f] = chance(0.15);
        ui.started = chance(0.85);
        adv.dead = chance(0.1);
        saved.DEVALL = chance(0.6);
        gear.hands = chance(0.9) ? { L: {}, R: {} } : null;
        ui.gallery = chance(0.2)
          ? { mode: chance(0.8) ? 'beast' : 'range', idx: Math.floor(r() * 5), drag: chance(0.3) ? { x: 5, y: 7 } : null }
          : null;
        M.ret.relockClick = chance(0.2);
        M.ret.buildsHave = pick([[], [0], [0, 1], [1, 2]]);
        M.ret.applyBuild = chance(0.7);
        gear.buildIdx = pick([0, 1, 2]);
      }
      const ev = r(),
        cv = gfx.canvas,
        mouse = () => ({
          button: pick([0, 0, 2, 1]),
          buttons: pick([0, 1, 1]),
          clientX: Math.floor(r() * 800),
          clientY: Math.floor(r() * 400),
          movementX: Math.floor(r() * 40 - 20),
          movementY: Math.floor(r() * 40 - 20),
          target: chance(0.2) ? page.byId.get('dbgp') : chance(0.2) ? page.make('menu') : cv,
        });
      if (ev < 0.3) {
        const code = pick(KEYS),
          target = chance(0.1) ? { tagName: 'INPUT' } : cv;
        c.call(`keydown ${code}`, () => page.fire('window', 'keydown', { code, key: code === 'Slash' ? '?' : code, target }));
        if (chance(0.5)) c.call(`keyup ${code}`, () => page.fire('window', 'keyup', { code }));
      } else if (ev < 0.45) {
        const m = mouse();
        c.call('mousedown canvas', () => page.fire(cv, 'mousedown', m));
        c.call('mousedown window', () => page.fire('window', 'mousedown', m));
      } else if (ev < 0.55) {
        c.call('mousemove', () => page.fire('window', 'mousemove', mouse()));
      } else if (ev < 0.62) {
        c.call('mouseup', () => page.fire('window', 'mouseup', mouse()));
      } else if (ev < 0.7) {
        c.call('wheel', () => page.fire(cv, 'wheel', { deltaY: Math.floor(r() * 200 - 100), deltaMode: pick([0, 1, 2]) }));
        c.tick(pick([100, 400]));
        clock.time += pick([0.1, 0.5]);
      } else if (ev < 0.75) {
        c.call('contextmenu', () => page.fire(cv, 'contextmenu'));
        c.call('blur', () => page.fire('window', 'blur'));
      } else if (ev < 0.8) {
        page.document.hidden = chance(0.7);
        c.call('visibilitychange', () => page.fire('document', 'visibilitychange'));
      } else if (ev < 0.86) {
        page.document.pointerLockElement = chance(0.5) ? cv : null;
        c.call('pointerlockchange', () => page.fire('document', 'pointerlockchange'));
        if (chance(0.3)) c.call('pointerlockerror', () => page.fire('document', 'pointerlockerror'));
      } else if (ev < 0.92) {
        const k = pick(['pack', 'menu', 'changed']);
        c.call(`touch ${k}`, () => touchHooks[k]());
      } else if (ev < 0.96) {
        c.call('touch build', () => padHooks.build());
        c.call('touch gallery on', () => padHooks.gallery.on());
        clock.time += 0.4;
      } else {
        const f = pick(['togglePack', 'toggleMenu', 'nextBuild']);
        c.call(f, () => F[f]());
      }
    }
  });
}

// ---------------------------------------------------------------- 開発用の命令
const TO = ['stairs', 'branch', 'portal', 'lord', 'altar', 'vault', 'hub', 'spring', 'forge', 'elite', 'nowhere'];
const GIVE = ['slot', 'body', 'runes', 'legends', 'other'];
const URLS = [
  '',
  '?dev=1',
  '?dev=1&seed=123&depth=8',
  '?dev=1&branch=crypt:2&god=1&reveal=1',
  '?dev=1&realm=ice&depth=5&to=stairs',
  '?dev=1&realm=ice',
  '?dev=1&to=altar&give=slot,body',
  '?seed=55',
  '?dev=1&seed=99x&depth=3',
  '?dev=1&branch=lair',
];

/** 開発用の命令：F は introCases と同じ物 */
export async function debugCases(F, seeds) {
  return run(seeds, async (s, c) => {
    const { r, pick, chance, page } = c;
    const [sx, sz] = setupLevel(s, c);
    gfx.canvas = page.make('gl', 'canvas');
    ui.introEl = page.byId.get('intro');
    c.call('initIntro', () => F.initIntro());
    saved.META = { ...META_DEF, unl: [], trials: [], lore: Math.floor(r() * 40) };
    saved.DEVALL = true;
    ui.started = true;
    adv.dead = false;
    // 生き物：階の物と、主・強敵・小さな生き物・おとなしい物
    here.monsters = [];
    const floor = [];
    for (let i = 0; i < NCELL; i++) if (here.D.tile[i] === TF) floor.push(i);
    for (const key of [
      'lord',
      ...Object.keys(MTYPES)
        .filter((k) => k !== 'lord')
        .slice(0, 14),
    ]) {
      if (!MTYPES[key]) continue;
      const i = pick(floor),
        m = makeMonster({ key, cx: i % 120, cz: Math.floor(i / 120), g: chance(0.5) ? 1 : -1, lead: true });
      if (chance(0.3)) m.elite = true;
      here.monsters.push(m);
    }
    for (const m of here.monsters) if (chance(0.2)) m.dead = true;
    M.ret.legend = chance(0.7) ? { have: new Set() } : null;
    // 命令を全部
    const dbg = F.dbg;
    c.call('help', () => dbg.help());
    c.call('info', () => dbg.info());
    c.call('items', () => dbg.items());
    for (const w of TO) c.call(`to ${w}`, () => dbg.to(w));
    c.call('god', () => dbg.god());
    c.call('god true', () => dbg.god(true));
    c.call('heal', () => dbg.heal());
    c.call('reveal', () => dbg.reveal());
    for (const g of GIVE) c.call(`give ${g}`, () => dbg.give(g));
    c.call('kill guards', () => dbg.kill('guards'));
    c.call('kill near', () => dbg.kill());
    c.call('kill lord', () => dbg.kill('lord'));
    c.call('open', () => dbg.open());
    c.call('step', () => dbg.step(sx + 1, sz - 1));
    c.call('lore', () => dbg.lore(chance(0.5) ? undefined : 5));
    c.call('exp', () => dbg.exp(chance(0.5) ? undefined : 3));
    c.call('hurt', () => dbg.hurt(chance(0.5) ? undefined : 2));
    c.call('hit', () => dbg.hit(chance(0.5) ? undefined : 9));
    c.call('hp', () => dbg.hp());
    c.call('look', () => dbg.look(sx + 3, 1.2, sz + 2));
    c.call('clear', () => dbg.clear());
    // 場所を移る命令（新しい階は入れ替えた物。場所の欄だけ変わる）
    c.call('go', () => dbg.go(pick([0, 3, 7.6, 40])));
    c.call('branch', () => dbg.branch(pick(['crypt', 'lair', 'sunken', 'nest', 'snake', 'nope']), pick([undefined, 1, 2, 9])));
    c.call('inter', () => dbg.inter(pick(['town', 'bigroom', 'oracle', 'fortress', 'nope'])));
    c.call('realm', () => dbg.realm(pick(['ice', 'lab', 'volcano', 'nope'])));
    ui.started = false;
    c.call('go from title', () => dbg.go(2));
    ui.started = true;
    // window.dbg（開発用モードのオンとオフ）
    c.call('initDbg', () => F.initDbg());
    saved.DEVALL = chance(0.5);
    c.call('window.dbg.heal', () => globalThis.window.dbg.heal());
    c.call('window.dbg.help', () => typeof globalThis.window.dbg.help);
    saved.DEVALL = true;
    // F2 の画面：開く・ボタンを押す・閉じる
    for (let n = 0; n < 8; n++) {
      ui.started = chance(0.9);
      adv.dead = chance(0.1);
      saved.DEVALL = chance(0.9);
      page.document.pointerLockElement = chance(0.5) ? gfx.canvas : null;
      c.call('setDbg on', () => F.setDbg(true));
      const btns = page.byId.get('dbgp').querySelectorAll('button[data-c]');
      if (btns.length) {
        const b = pick(btns);
        c.call(`dbg button ${b.dataset.c}`, () => b.onclick());
      }
      c.call('setDbg off', () => F.setDbg(false));
    }
    // URL の指定
    for (let n = 0; n < 3; n++) {
      c.location.search = pick(URLS);
      saved.DEVALL = chance(0.3);
      c.call(`dbgUrl ${c.location.search}`, () => F.dbgUrl());
    }
    c.call('rune', () => makeRune('fire').type);
  });
}
