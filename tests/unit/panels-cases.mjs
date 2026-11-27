// テストの道具：レベルアップ・祭壇・メニューのパネル（src/lib/panels.ts・src/lib/menu.ts）と、命の一歩 updateLife（src/lib/combat.ts）を、
// たくさんの場合で呼び、結果を1つの文字列にまとめる。makeF は、場合ごとに関数をまとめた物を返す（場合ごとに、関数が覚える状態を初めに戻すため）。
// panels.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 1つの場合では、Node で本物の迷宮を生成し、祭壇の組（ルーン・主・鍛え・空の枠。番人のいる物も）と生き物を置いて、分かれ道ごとの「場面」を通す
// （レベルアップ：開く・説明・400ms 以内のクリック・恩恵とルーンを選ぶ・続けてもう一度・指の2回押し。祭壇：近い・遠い・番人・取った後・見出しの種類・説明・
// やめる・右クリック・離れるまで開かない・止まっている間・選ぶ・指の2回押し。メニュー：マウスと指の一覧・全部の項目・確かめ待ちが4秒で戻る・タイトルに戻る。命の一歩：火）。
// ここで移さない重い処理（新しい階 newLevel・新しい探索 newRun・装備の画面の開け閉め setInv）は、panels.test.mjs が vi.mock で、呼んだ時の記録だけ取る物に入れ替える。
// 記録するのは、返す値と、呼ぶたびの状態（パネルの HTML と class・ui の欄・探索の記録・手と袋・祭壇の物・プレイヤー・生き物・伝言）と、画面の部品にした事の並び。
// 入れ物に移した状態（ui.lvlOpts・ui.altarDismissed など）そのものは記録しない（古い JS では包みの一番外の変数だったので。動きは画面と、ほかの状態に出る）。
// テストを .mjs で書くのは、偽の画面の部品を、本物の型に合わせられないため。
// 書き換えた状態と、document・localStorage・performance・setTimeout・Math.random は、終わったら元に戻す。
import { addLooks } from '../../src/lib/bodies/build.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { makeRune } from '../../src/lib/gear.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { makeMonster } from '../../src/lib/monsters.ts';
import { BLESS, META_DEF } from '../../src/lib/progress.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES, TRAITS } from '../../src/lib/runes.ts';
import { SND, adv, blaze, clock, fight, gear, gfx, here, hudInfo, msgs, placeMem, player, saved, ui, vfx } from '../../src/lib/state.ts';
import { CELL, MW, NCELL, TF, cpos } from '../../src/lib/world.ts';
import { fakeCamera, fakeUniforms, fnv, text } from './fight-cases.mjs';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';
import { stateFp } from './case-out.mjs';

/** 移した関数の名前（場合が全部を呼ぶか、panels.test.mjs が確かめる。ほかの関数は、これらの中から呼ばれる） */
export const NAMES = [
  'levelChoices',
  'openLevelUp',
  'chooseLevel',
  'updateAltarPanel',
  'closeAltar',
  'chooseAltar',
  'setMenu',
  'menuAct',
  'returnToTitle',
  'updateLife',
];
// ---------------------------------------------------------------- 偽の画面の部品
// innerHTML に書いた文から、ボタン（class と data-*）と、説明の欄（ldet・adet）を読み取り、querySelectorAll で返す。
// listener は覚えておき、fire で偽のイベントを渡す。部品にした事は log に並べる
const BTN = /<button class="([^"]*)"([^>]*)>/g,
  DET = /<span class="(ldet|adet)">/g;
export function panelDom() {
  const log = [],
    els = {};
  const classList = (id) => {
    const set = new Set();
    return {
      set,
      add: (...c) => (c.forEach((x) => set.add(x)), log.push(['add', id, ...c])),
      remove: (...c) => (c.forEach((x) => set.delete(x)), log.push(['remove', id, ...c])),
      toggle: (c, on) => {
        const v = on === undefined ? !set.has(c) : Boolean(on);
        if (v) set.add(c);
        else set.delete(c);
        log.push(['toggle', id, c, v]);
        return v;
      },
      contains: (c) => set.has(c),
    };
  };
  const button = (id, n, cls, attrs) => {
    const dataset = {};
    for (const m of attrs.matchAll(/data-([a-z]+)="([^"]*)"/g)) dataset[m[1]] = m[2];
    const b = {
      tag: 'button',
      name: `${id}#${n}`,
      dataset,
      classList: classList(`${id}#${n}`),
      onclick: null,
      closest: (sel) =>
        sel === 'button' || (sel === 'button[data-k]' && 'k' in dataset) || (sel === 'button[data-lk]' && 'lk' in dataset) ? b : null,
    };
    for (const c of cls.split(' ')) if (c) b.classList.set.add(c);
    return b;
  };
  const el = (id) => {
    let html = '',
      buttons = [],
      dets = [],
      scroll = 0;
    const e = {
      id,
      dataset: {},
      style: {},
      listeners: [],
      classList: classList(id),
      get innerHTML() {
        return html;
      },
      set innerHTML(v) {
        html = String(v);
        log.push(['html', id, fnv(html), html.length]);
        buttons = [...html.matchAll(BTN)].map((m, n) => button(id, n, m[1], m[2]));
        dets = [...html.matchAll(DET)].map((m, n) => {
          let t = '';
          return {
            get innerHTML() {
              return t;
            },
            set innerHTML(v2) {
              t = String(v2);
              log.push(['det', id, m[1], n, fnv(t), t.length]);
            },
          };
        });
      },
      get scrollTop() {
        return scroll;
      },
      set scrollTop(v) {
        scroll = v;
        log.push(['scrollTop', id, v]);
      },
      get offsetWidth() {
        return 0;
      },
      querySelectorAll: (sel) => {
        if (sel === '.ldet' || sel === '.adet') return dets;
        if (sel === 'button.armed') return buttons.filter((b) => b.classList.contains('armed'));
        if (sel === 'button.row') return buttons.filter((b) => b.classList.contains('row'));
        if (sel === 'button') return buttons;
        throw new Error(`偽の画面：${id} の querySelectorAll(${sel}) は無い`);
      },
      querySelector: () => null,
      addEventListener: (t, fn) => (e.listeners.push([t, fn]), log.push(['listen', id, t])),
      requestPointerLock: () => log.push(['requestPointerLock', id]),
      buttons: () => buttons,
    };
    return e;
  };
  return {
    log,
    els,
    reset() {
      log.length = 0;
      for (const k of Object.keys(els)) delete els[k];
    },
    document: {
      getElementById: (id) => (els[id] ??= el(id)),
      body: { classList: classList('body') },
      exitPointerLock: () => log.push(['exitPointerLock']),
      createElement: () => ({ innerHTML: '', childNodes: [] }),
      fonts: { ready: Promise.resolve() },
    },
  };
}
/** 部品 e の、種類 type の listener に、偽のイベント（押された所 target）を渡す */
function fire(page, e, type, target) {
  const ev = {
    target: target ?? { closest: () => null },
    stopPropagation: () => page.log.push(['stop', e.id, type]),
    preventDefault: () => page.log.push(['prevent', e.id, type]),
  };
  for (const [t, fn] of e.listeners) if (t === type) fn(ev);
}

/** makeF：場合ごとに呼ぶ、関数をまとめた物を返す関数（async でもよい）。seeds：場合の数。page：panelDom() の偽の画面。calls：入れ替えた重い処理の記録 */
export async function panelCases(makeF, seeds, page, mocked) {
  const env = await loadEnv(),
    out = [];
  const keep = {
    here: { ...here },
    adv: { ...adv },
    player: { ...player },
    ui: { ...ui },
    vfx: { ...vfx },
    fight: { ...fight },
    SND: { ...SND },
    gear: { ...gear },
    gfx: { ...gfx },
    saved: { ...saved },
    hudInfo: { ...hudInfo },
    fire: blaze.fire,
    time: clock.time,
    lord: MTYPES['lord'],
    X: MTYPES['X'],
    random: Math.random,
    sound: setSoundRand(Math.random),
    msgs: [...msgs],
    place: new Map(placeMem),
  };
  const LOOK_FIELDS = ['look', 'form', 'trail', 'col', 'lcol'],
    keptTypes = Object.entries(MTYPES).map(([k, t]) => [k, LOOK_FIELDS.map((f) => [f, Object.getOwnPropertyDescriptor(t, f)])]);
  addLooks();
  let nowMs = 0,
    msgN = 0;
  const errs = [];
  // 偽の setTimeout：待たせた物を、時計（nowMs）が待つ時刻を過ぎた時に、時刻の順に流す（メニューの確かめ待ちが4秒で戻るのを確かめるため）
  const timers = (() => {
    let id = 0;
    const q = new Map(),
      st = { n: 0, threw: 0 };
    return {
      st,
      setTimeout: (fn, ms) => (q.set(++id, { fn, at: nowMs + (ms || 0), id }), st.n++, id),
      clearTimeout: (i) => q.delete(i),
      flush() {
        for (let k = 0; k < 200; k++) {
          const due = [...q.values()].filter((e) => e.at <= nowMs).sort((a, b) => a.at - b.at || a.id - b.id)[0];
          if (!due) return;
          q.delete(due.id);
          try {
            due.fn();
          } catch {
            st.threw++;
          }
        }
      },
      clear: () => q.clear(),
    };
  })();
  msgs.push = (...a) => (msgN++, Array.prototype.push.apply(msgs, a));
  const stored = [];
  const restoreGlobals = swapGlobals({
    document: page.document,
    window: {},
    localStorage: { setItem: (k, v) => stored.push(['store', k, v]), getItem: () => null },
    performance: { now: () => nowMs },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });
  const keepErr = console.error;
  console.error = (e) => errs.push(String(e && e.message));
  try {
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 48271 + 77),
        pick = (a) => a[Math.floor(r() * a.length)],
        chance = (p) => r() < p;
      let mrN = 0;
      const mrSrc = mulberry32(s * 7919 + 13);
      Math.random = () => (mrN++, mrSrc());
      setSoundRand(mulberry32(s * 104729 + 3));
      page.reset();
      timers.clear();
      msgs.length = 0;
      errs.length = 0;
      stored.length = 0;
      mocked.length = 0;
      nowMs = 5000 + Math.floor(r() * 5000);
      Object.assign(SND, { ctx: null, master: null, on: true, lv: Math.floor(r() * 3) });
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
      blaze.fire = new Float32Array(NCELL);
      adv.HIST = makeHistory(adv.runSeed);
      adv.HIST_SEED = adv.runSeed;
      saved.LEGEND = null;
      saved.META = { ...META_DEF, grave: null, unl: [] };
      saved.DEVALL = chance(0.5);
      saved.BOOK = new Set();
      adv.dead = false;
      adv.won = false;
      adv.PLAYER_MAX = 30 + Math.floor(r() * 20);
      const bless = {};
      for (const k of Object.keys(BLESS)) if (chance(0.15)) bless[k] = 1;
      adv.lvl = { n: 2 + Math.floor(r() * 5), exp: 0, pending: 0, bless, strata: new Set(), firstDone: chance(0.5) };
      adv.hpShown = -1;
      adv.runStats = { kills: 0, t0: 0, maxDepth: here.depth, book0: 0, beastsNew: 0 };
      adv.runState = {
        startChosen: false,
        altar1: false,
        taken: new Set(),
        lordsDone: new Set(),
        bodyOpen: Math.floor(r() * 3),
        slotPend: null,
      };
      // ui は、場合ごとに丸ごと初めの値に戻してから、場合の値を入れる（関数が使う欄を、場合の間で持ち越さないため）
      for (const f of Object.keys(ui)) if (!(f in keep.ui)) delete ui[f];
      Object.assign(ui, keep.ui);
      Object.assign(ui, {
        started: true,
        gallery: null,
        godMode: false,
        touch: false,
        tapArm: '',
        camMode: chance(0.5) ? 'tps' : 'fps',
        uiMode: 0,
        perfOn: false,
        invOpen: false,
        menuOpen: false,
        dbgOpen: false,
        altarOpen: false,
        lvlOpen: false,
        altarNear: null,
        locked: chance(0.6),
        plFailed: chance(0.2),
        escKey: false,
        lockedOnce: true,
        lockTries: 0,
        unlockedAt: 0,
        helpOn: false,
        helpT: 0,
        chronOn: false,
        titleArm: 0,
        newRunArm: 0,
        noticeMsgT: {},
      });
      Object.assign(here, { finalSt: null, trans: null, arrive: null, lockCell: -1, mobSeq: 0 });
      clock.time = 20 + r() * 100;
      Object.assign(vfx, { shake: 0, flash: 0, hurtFlash: 0.8, hpFlash: 0, zapFlash: null });
      fight.rallyMotes = [];
      fight.beamSegs = [1];
      gfx.camera = fakeCamera();
      gfx.U = fakeUniforms();
      const F = await makeF();
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
        eye: 1.62,
        hp: adv.PLAYER_MAX - 5,
        rally: 0,
        lastHurt: -99,
        fall: false,
      });
      const atk = RUNE_TYPES.atk.filter((t) => !['bolt', 'rain', 'gsword', 'mstaff'].includes(t)),
        weapon = () => {
          const w = makeRune(pick(atk)),
            ks = Object.keys(TRAITS[w.type] || {});
          w.traits = ks.filter(() => chance(0.4)).map((k) => ({ k, lv: 1 + Math.floor(r() * 4) }));
          return w;
        },
        hand = () => ({ atk: weapon(), slots: [null, null, null, null], slotN: 2 + Math.floor(r() * 3), turn: 0, elem: null, trig: null });
      gear.hands = { L: hand(), R: hand(), B: { b0: null, b1: null } };
      gear.bag = [];
      gear.castSt = chance(0.3) ? { h: 'L', t: 0 } : null;
      gear.swapSt = null;
      // 生き物：プレイヤーのまわりに少し（番人と、火の中の物も）
      here.monsters = [];
      const nearFloor = (rr) => {
        for (let k = 0; k < 30; k++) {
          const cx = Math.floor((player.x + (r() - 0.5) * rr) / CELL),
            cz = Math.floor((player.z + (r() - 0.5) * rr) / CELL),
            i = Math.max(0, Math.min(NCELL - 1, cz * MW + cx));
          if (D.tile[i] === TF) return i;
        }
        return c0;
      };
      const kinds = Object.keys(MTYPES).filter((k) => MTYPES[k].col && !MTYPES[k].dummy && k !== 'final' && k !== 'final2');
      for (const key of kinds) {
        if (!chance(0.12)) continue;
        const i = nearFloor(8);
        here.monsters.push(makeMonster({ key, cx: i % MW, cz: (i / MW) | 0, g: -1 }));
      }
      for (const m of here.monsters) m.hp = m.maxHp = 5 + Math.floor(r() * 30);

      const calls = [];
      const state = () =>
        text({
          ui: {
            started: ui.started,
            gallery: ui.gallery,
            lvlOpen: ui.lvlOpen,
            altarOpen: ui.altarOpen,
            altarNear: ui.altarNear,
            menuOpen: ui.menuOpen,
            invOpen: ui.invOpen,
            tapArm: ui.tapArm,
            titleArm: ui.titleArm,
            newRunArm: ui.newRunArm,
            helpOn: ui.helpOn,
            helpT: ui.helpT,
            chronOn: ui.chronOn,
            bookOn: ui.bookOn,
            camMode: ui.camMode,
            uiMode: ui.uiMode,
            perfOn: ui.perfOn,
            lockTries: ui.lockTries,
          },
          lvl: adv.lvl,
          max: adv.PLAYER_MAX,
          dead: adv.dead,
          won: adv.won,
          runSeed: adv.runSeed,
          place: [here.depth, here.branch, here.realm, here.inter, here.arrive, here.trans, placeMem.size],
          player: [player.hp, player.swing, player.fireT, player.fall, player.rally],
          vfx: [vfx.hurtFlash, vfx.zapFlash],
          castSt: gear.castSt,
          swapSt: gear.swapSt,
          beam: fight.beamSegs,
          hands: gear.hands,
          bag: gear.bag,
          snd: SND.lv,
          items: D.items.filter((o) => o.altar || o.grp).map((o) => [o.grp, o.slot, o.taken, o.opt, o.rune && o.rune.type]),
          mons: here.monsters.map((m) => [m.key, m.hp, m.dead]),
          dom: fnv(JSON.stringify(page.log)),
          mocked,
          stored,
          errs,
        });
      const call = (name, ...args) => {
        const m0 = mrN,
          g0 = msgN,
          t0 = timers.st.n,
          l0 = page.log.length;
        let ret, threw;
        try {
          ret = F[name](...args);
        } catch (e) {
          threw = String(e && e.message).slice(0, 80);
        }
        calls.push({
          name,
          ret: name === 'levelChoices' ? text(ret) : text(ret === undefined ? null : typeof ret === 'boolean' ? ret : 'obj'),
          threw,
          mr: mrN - m0,
          msg: msgN - g0,
          timers: timers.st.n - t0,
          dom: page.log.slice(l0),
          state: stateFp(state(), fnv),
          msgs: msgs.map((m) => m.html).join('|'),
        });
        return ret;
      };
      // 画面の部品の listener に渡す（どの関数から呼ばれたかの印を付ける）
      const ev = (id, type, target) => {
        const l0 = page.log.length,
          g0 = msgN;
        let threw;
        try {
          fire(page, page.els[id] ?? page.document.getElementById(id), type, target);
        } catch (e) {
          threw = String(e && e.message).slice(0, 80);
        }
        calls.push({ name: `ev:${id}:${type}`, threw, msg: msgN - g0, dom: page.log.slice(l0), state: stateFp(state(), fnv) });
      };
      const click = (b) => {
        const l0 = page.log.length;
        let threw;
        try {
          b.onclick();
        } catch (e) {
          threw = String(e && e.message).slice(0, 80);
        }
        calls.push({ name: `onclick:${b.name}`, threw, dom: page.log.slice(l0), state: stateFp(state(), fnv) });
      };
      const btns = (id) => (page.els[id] ? page.els[id].buttons() : []);
      const tick = (ms) => {
        nowMs += ms;
        clock.time += ms / 1000;
        timers.flush();
      };
      const add = (o) => (D.items.push({ taken: false, ...o }), D.items[D.items.length - 1]);
      const rune = () => makeRune(pick([...RUNE_TYPES.elem, ...RUNE_TYPES.mod, ...RUNE_TYPES.trig, ...RUNE_TYPES.body, ...atk]));

      // ---- 場面：レベルアップの選択肢（乱数を渡す・渡さない）
      call('levelChoices');
      call('levelChoices', mulberry32(s));
      // ---- 場面：レベルアップの画面（マウス・指。pending は 1〜3）
      for (const touch of [false, true]) {
        ui.touch = touch;
        adv.lvl.pending = 1 + Math.floor(r() * 3);
        adv.lvl.n += adv.lvl.pending;
        call('updateAltarPanel');
        call('openLevelUp'); // 開いている時は何もしない
        for (let k = 0; k < 8 && ui.lvlOpen; k++) {
          const bs = btns('altarp').filter((b) => 'lk' in b.dataset);
          const b = pick(bs.concat([null]));
          if (chance(0.5)) ev('altarp', 'mouseover', b ?? undefined);
          if (!b) continue;
          if (chance(0.3)) ev('altarp', 'click', b); // 開いてすぐ（400ms の内）
          tick(450);
          ev('altarp', 'click', b);
          if (touch && chance(0.7)) ev('altarp', 'click', b);
        }
        // まだ開いていれば、直に選ぶ（無い番号も）
        for (let k = 0; k < 4 && ui.lvlOpen; k++) call('chooseLevel', k === 0 ? 7 : Math.floor(r() * 3));
        tick(100);
      }
      ui.touch = false;
      // 丈夫の恩恵（最大体力が増える）は、直に選ぶ
      adv.lvl.pending = 1;
      adv.lvl.bless.tough = chance(0.5) ? 1 : 0;
      call('updateAltarPanel');
      if (ui.lvlOpen) {
        call('chooseLevel', 0);
        while (ui.lvlOpen) call('chooseLevel', 0);
      }
      // ---- 場面：祭壇（ルーン・主・鍛え・空の枠、番人のいる物）
      const kindsA = [
        {},
        { lord: true },
        { forge: true, opt: 'forge' },
        { opt: 'open', target: 'body', label: '身の護符の枠' },
        { opt: 'heal' },
        { guardG: 55 },
      ];
      for (const extra of kindsA) {
        const i = nearFloor(10),
          grp = 'pg' + D.items.length;
        const list = [0, 1, 2].map((k) => {
          const o = { i, kind: 'rune', altar: true, slot: k, grp, rune: rune(), ...extra };
          if (extra.forge)
            Object.assign(o, {
              forgeW: gear.hands.L.atk,
              forgeK: Object.keys(TRAITS[gear.hands.L.atk.type] || { x: 1 })[k % 2] ?? 'x',
              forgeTo: 1 + k,
            });
          if (k === 2 && chance(0.3)) o.taken = true;
          return add(o);
        });
        if (extra.guardG) {
          const m = here.monsters[0];
          if (m) m.g = chance(0.5) ? 55 : -1;
        }
        const [ax, az] = cpos(i);
        // 遠い・近い・祭壇の上
        for (const d of [3, 1.55, 1.45, 1.2, 0.2]) {
          player.x = ax + d;
          player.z = az;
          call('updateAltarPanel');
        }
        ui.touch = chance(0.4);
        if (ui.altarOpen) {
          // マウスを乗せる・押す・やめる・右クリック
          const bs = btns('altarp');
          for (let k = 0; k < 3; k++) ev('altarp', 'mouseover', pick(bs.concat([null])) ?? undefined);
          const how = Math.floor(r() * 5);
          if (how === 0)
            ev(
              'altarp',
              'click',
              bs.find((b) => b.dataset.cancel),
            );
          else if (how === 1) ev('altarp', 'contextmenu');
          else if (how === 2) call('closeAltar', chance(0.5));
          else {
            const b = pick(bs.filter((x) => 'k' in x.dataset));
            if (b) {
              ev('altarp', 'click', b);
              if (ui.touch) ev('altarp', 'click', chance(0.8) ? b : pick(bs));
              if (ui.altarOpen) ev('altarp', 'click', b);
            }
          }
          // 閉じた後：同じ所ではまた開かないか・止まっている間・離れて戻る
          call('updateAltarPanel');
          ui.menuOpen = true;
          call('updateAltarPanel');
          ui.menuOpen = false;
          call('updateAltarPanel');
          player.x = ax + 4;
          call('updateAltarPanel');
          player.x = ax + 0.2;
          call('updateAltarPanel');
          if (ui.altarOpen && chance(0.5)) {
            // 中身が無くなったら閉じる
            for (const o of list) o.taken = true;
            call('updateAltarPanel');
          }
          if (ui.altarOpen) call('chooseAltar', Math.floor(r() * 4));
          if (ui.altarOpen) call('closeAltar', true);
        }
        call('chooseAltar', 1);
        player.x = ax + 6;
        call('updateAltarPanel');
        ui.touch = false;
      }
      // 開いている祭壇が、階が無くなる・死ぬと閉じる
      {
        const i = nearFloor(4),
          grp = 'pz' + D.items.length;
        for (let k = 0; k < 3; k++) add({ i, kind: 'rune', altar: true, slot: k, grp, rune: rune() });
        [player.x, player.z] = cpos(i);
        call('updateAltarPanel');
        if (chance(0.5)) adv.dead = true;
        else ui.started = false;
        call('updateAltarPanel');
        adv.dead = false;
        ui.started = true;
        call('chooseAltar', 0); // 近くの祭壇が無い
      }
      // ---- 場面：命の一歩（火の中のプレイヤーと生き物、体力の表示）
      player.x = px;
      player.z = pz;
      for (let k = 0; k < 4; k++) {
        const pc = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL);
        blaze.fire[pc] = chance(0.6) ? 0.5 : 0;
        for (const m of here.monsters) if (chance(0.5)) blaze.fire[m.cz * MW + m.cx] = 0.5;
        player.hp -= r() * 3;
        call('updateLife', 0.3);
      }
      adv.dead = true;
      call('updateLife', 0.3);
      adv.dead = false;
      // ---- 場面：メニュー（マウスと指、全部の項目。確かめ待ちは4秒で戻る）
      const ITEMS = ['resume', 'pack', 'help', 'chron', 'book', 'cam', 'ui', 'snd', 'perf', 'new', 'title', 'back'];
      for (const touch of [false, true, false]) {
        ui.touch = touch;
        call('setMenu', true);
        for (let k = 0; k < 14; k++) {
          if (!ui.menuOpen) call('setMenu', true);
          const by = chance(0.5);
          if (by) {
            const bs = btns('menu');
            const b = pick(bs);
            if (b) click(b);
          } else call('menuAct', pick(ITEMS));
          if (chance(0.4)) tick(pick([1000, 3000, 4000, 4060, 4100]));
        }
        call('setMenu', false);
        tick(4000);
        tick(100);
      }
      // 図鑑から・探索からタイトルに戻る
      ui.gallery = chance(0.5) ? { mode: 'beast', idx: 0 } : null;
      ui.started = true;
      call('setMenu', true);
      call('menuAct', 'title');
      call('menuAct', 'title');
      ui.started = true;
      ui.invOpen = chance(0.5);
      ui.locked = chance(0.5);
      call('returnToTitle');
      tick(5000);

      out.push({ seed: s, place: place.key ?? `${place.depth}`, calls, timers: timers.st.threw });
    }
  } finally {
    console.error = keepErr;
    restoreGlobals();
    delete msgs.push;
    Math.random = keep.random;
    setSoundRand(keep.sound);
    const boxes = { here, adv, player, ui, vfx, fight, SND, gear, gfx, saved, hudInfo };
    for (const [k, obj] of Object.entries(boxes)) {
      for (const f of Object.keys(obj)) if (!(f in keep[k])) delete obj[f];
      Object.assign(obj, keep[k]);
    }
    blaze.fire = keep.fire;
    clock.time = keep.time;
    for (const k of ['lord', 'X']) {
      if (keep[k]) MTYPES[k] = keep[k];
      else delete MTYPES[k];
    }
    placeMem.clear();
    for (const [k, v] of keep.place) placeMem.set(k, v);
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

/** 記録を1つの文字列にする（panels.test.mjs が指紋を取る） */
export const panelText = (all) =>
  all.map((c) => JSON.stringify({ seed: c.seed, place: c.place, calls: c.calls, timers: c.timers })).join('\n');
