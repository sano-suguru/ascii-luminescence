// テストの道具：状態の表示・明るさと気配・年代記・操作の案内・魔導書・表示の量・見つかった時・物音・飛べるマス・立ち止まって調べる・
// 伝説の物・マスの明るさを、たくさんの場合で呼び、返す値と、画面に書いた HTML（偽の画面の部品）・状態の変わり方を、1つの文字列にまとめる。
// F は関数をまとめた物。status.test.mjs が、この文字列の指紋を確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の全部の場所。灯りと罠が要るため）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、位置・生き物（種類・気づき・眠り・化けているか・群れ）・体力・経験・場所・忍び足・試練・年代記・伝説の物・表示の量などを
// シードの乱数で作り、関数を5つ続けて呼ぶ。音の部品は作らない（音を鳴らす処理は audio.test.mjs が確かめる）。
// テストを .mjs で書くのは、偽の画面の部品を、本物の型に合わせられないため。書き換えた状態と、document・setTimeout・performance.now は、終わったら元に戻す。
import { MTYPES } from '../../src/lib/creatures.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { LEGEND_ORDER } from '../../src/lib/names.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES } from '../../src/lib/runes.ts';
import { SND, adv, blaze, clock, gear, here, hudInfo, keys, lantern, msgs, player, saved, stealth, ui, vfx } from '../../src/lib/state.ts';
import { CELL, MW, NCELL, TF } from '../../src/lib/world.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';

/** 偽の画面の部品（innerHTML と classList だけ）。body も */
function fakeDoc() {
  const cls = () => {
    const set = new Set();
    return { set, toggle: (c, on) => (on ? set.add(c) : set.delete(c)), contains: (c) => set.has(c) };
  };
  const mk = (id) => ({ id, innerHTML: '', classList: cls() });
  const els = { status: mk('status'), help: mk('help'), hint: mk('hint'), log: mk('log') },
    body = { classList: cls() };
  return { els, body, document: { body, getElementById: (id) => els[id] ?? null } };
}
const text = (v) =>
  JSON.stringify(v, (_k, x) =>
    x === undefined
      ? 'undefined'
      : typeof x === 'number' && !Number.isFinite(x)
        ? String(x)
        : x instanceof Set
          ? { set: [...x] }
          : ArrayBuffer.isView(x)
            ? null
            : x,
  );
/** 写しから元に戻す（写しに無い欄は消す） */
const restore = (obj, copy) => {
  for (const k of Object.keys(obj)) if (!(k in copy)) delete obj[k];
  Object.assign(obj, copy);
};

/** seeds：場合の数 */
export async function statusCases(F, seeds) {
  const env = await loadEnv(),
    out = [];
  const keep = {
    here: { D: here.D, depth: here.depth, branch: here.branch, realm: here.realm, inter: here.inter, monsters: here.monsters },
    adv: {
      runSeed: adv.runSeed,
      HIST: adv.HIST,
      HIST_SEED: adv.HIST_SEED,
      PLAYER_MAX: adv.PLAYER_MAX,
      lvl: adv.lvl,
      runTrials: adv.runTrials,
      runState: adv.runState,
    },
    player: { ...player },
    stealth: { ...stealth },
    lantern: { ...lantern },
    hudInfo: { ...hudInfo },
    ui: { ...ui },
    vfx: { ...vfx },
    blaze: { fireLight: blaze.fireLight },
    saved: { LEGEND: saved.LEGEND, BOOK: saved.BOOK },
    gear: { hands: gear.hands, runeUid: gear.runeUid },
    shift: Object.getOwnPropertyDescriptor(keys, 'ShiftLeft'),
    time: clock.time,
    ctx: SND.ctx,
    lord: MTYPES['lord'],
    X: MTYPES['X'],
  };
  const page = fakeDoc(),
    timers = [];
  let now = 5000;
  const restoreGlobals = swapGlobals({ document: page.document, setTimeout: (fn, ms) => (timers.push(ms), fn(), 0) }),
    keepNow = Object.getOwnPropertyDescriptor(performance, 'now');
  performance.now = () => now;
  try {
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 48271 + 11),
        pick = (a) => a[Math.floor(r() * a.length)];
      const place = PLACES[(s * 7) % PLACES.length];
      adv.runSeed = (r() * 4294967296) >>> 0;
      Object.assign(here, { depth: place.depth, branch: place.branch ?? null, realm: place.realm ?? null, inter: place.inter ?? null });
      const res = gen(env, (r() * 4294967296) >>> 0, place, adv.runSeed);
      if (res.lordType) MTYPES['lord'] = res.lordType;
      if (res.beastType) MTYPES['X'] = res.beastType;
      here.D = res.level;
      SND.ctx = null;
      // 年代記と伝説の物
      adv.HIST = r() < 0.9 ? makeHistory(adv.runSeed) : null;
      saved.LEGEND =
        r() < 0.5
          ? null
          : {
              seed: r() < 0.7 ? adv.runSeed : 1,
              items: {},
              have: new Set([...LEGEND_ORDER.filter(() => r() < 0.4), ...LEGEND_ORDER.filter(() => r() < 0.3)]),
            };
      // プレイヤー：床のマス（生き物の近く）
      const floors = [];
      for (let i = 0; i < NCELL; i++) if (here.D.tile[i] === TF) floors.push(i);
      const c = pick(floors);
      Object.assign(player, {
        x: ((c % MW) + 0.2 + r() * 0.6) * CELL,
        z: (Math.floor(c / MW) + 0.2 + r() * 0.6) * CELL,
        vx: r() < 0.5 ? 0 : (r() - 0.5) * 4,
        vz: r() < 0.5 ? 0 : (r() - 0.5) * 4,
        hp: r() < 0.1 ? 0 : r() * 60,
        rally: r() < 0.5 ? 0 : r() * 10,
        stillT: r() < 0.5 ? 0 : r() * 2,
        searchedAt: r() < 0.3 ? c : -1,
      });
      // 生き物（群れ・気づき・眠り・化けている・うなぎ）。種類は、その階の主 lord と忘れられた獣 X を足した後の表から選ぶ。
      // 見つかった時に特別なことが起きる種類（主・獣・監視の機械・野営の群れ・猟犬）は、少し多めに出す
      const kinds = Object.keys(MTYPES).filter((k) => !MTYPES[k].dummy),
        rare = kinds.filter((k) => k === 'lord' || k === 'X' || MTYPES[k].watcher || MTYPES[k].snap || MTYPES[k].hound);
      here.monsters = Array.from({ length: 3 + Math.floor(r() * 10) }, (_, k) => {
        const key = r() < 0.3 && rare.length ? pick(rare) : pick(kinds);
        return {
          key,
          ty: MTYPES[key],
          x: player.x + (r() - 0.5) * 40,
          z: player.z + (r() - 0.5) * 40,
          g: r() < 0.6 ? Math.floor(r() * 3) : -1,
          aware: r() * 1.2,
          sleep: r() < 0.4,
          noticed: r() < 0.3,
          hidden: r() < 0.15,
          dead: r() < 0.1,
          surf: r() < 0.5 ? 0 : r(),
          mark: k,
        };
      });
      for (const t of here.D.traps) t.hidden = r() < 0.7;
      adv.PLAYER_MAX = 30 + Math.floor(r() * 40);
      adv.lvl = { n: 1 + Math.floor(r() * 9), exp: Math.floor(r() * 80), pending: 0, bless: {}, strata: new Set() };
      adv.runTrials = r() < 0.3 ? ['dusk'] : [];
      adv.runState = { startChosen: false, altar1: false, taken: new Set(), lordsDone: new Set(), bodyOpen: Math.floor(r() * 3) };
      gear.hands = {
        L: { atk: null, slots: [], slotN: 2, turn: 0, elem: null, trig: null },
        R: { atk: null, slots: [], slotN: 2, turn: 0, elem: null, trig: null },
        B: { b0: r() < 0.5 ? { uid: 1, type: 'hush' } : null, b1: r() < 0.3 ? { uid: 2, type: pick(RUNE_TYPES.body) } : null },
      };
      Object.assign(stealth, {
        lum: r() * 1.5,
        level: Math.floor(r() * 3),
        range: 8,
        sneak: r() < 0.4,
        hudKey: r() < 0.3 ? '1|false|false' : '',
      });
      if (r() < 0.5) delete stealth.seen;
      else stealth.seen = r() < 0.5;
      Object.assign(lantern, { r: 2 + r() * 8, k: r() });
      Object.assign(hudInfo, {
        explored: Math.floor(r() * 100),
        glyphCount: Math.floor(r() * 90000),
        chunksDrawn: Math.floor(r() * 50000),
        pfFps: Math.floor(r() * 60),
      });
      Object.assign(ui, {
        started: r() < 0.85,
        perfOn: r() < 0.3,
        helpOn: r() < 0.5,
        chronOn: r() < 0.3,
        uiMode: Math.floor(r() * 3),
        hintHTML: r() < 0.3 ? '表示：通常' : '',
        noticeMsgT: {},
      });
      Object.assign(ui, { invOpen: r() < 0.2, menuOpen: r() < 0.2, dbgOpen: r() < 0.1, altarOpen: r() < 0.1, lvlOpen: r() < 0.1 });
      Object.assign(vfx, { hpFlash: r() < 0.2 ? 0.3 : 0, shake: r() * 0.3 });
      keys['ShiftLeft'] = r() < 0.3;
      blaze.fireLight = new Float32Array(NCELL);
      for (let k = 0; k < 40; k++) blaze.fireLight[pick(floors)] = r() * 2;
      saved.BOOK = new Set(['steam', 'blast', 'overload', 'nope'].filter(() => r() < 0.5));
      clock.time = 100 + r() * 50;
      for (const el of Object.values(page.els)) {
        el.innerHTML = '';
        el.classList.set.clear();
      }
      page.body.classList.set.clear();
      msgs.length = 0;
      timers.length = 0;
      const calls = [];
      for (let n = 0; n < 5; n++) {
        now += r() * 3000;
        clock.time += r() * 8;
        const m = pick(here.monsters),
          ops = [
            ['isPaused', () => []],
            ['placeLabel', () => []],
            ['showHint', () => [r() < 0.5 ? '' : '一言']],
            ['updateStealth', () => [r() * 0.2]],
            ['renderStatus', () => []],
            ['renderChron', () => []],
            ['renderHelp', () => []],
            ['setHelp', () => [r() < 0.5]],
            ['renderBook', () => []],
            ['cycleUi', () => []],
            ['onNoticed', () => [m]],
            ['makeNoise', () => [m.x + (r() - 0.5) * 6, m.z + (r() - 0.5) * 6, 2 + r() * 10, r() * 0.8]],
            ['flyOpen', () => [player.x + (r() - 0.5) * 20, player.z + (r() - 0.5) * 20]],
            ['updateSearch', () => [r() * 1.2]],
            ['getLegend', () => []],
            ['legendLine', () => []],
            ['cellLight', () => [player.x + (r() - 0.5) * 10, player.z + (r() - 0.5) * 10]],
          ],
          [name, args] = pick(ops),
          a = args(),
          ret = F[name](...a);
        calls.push({
          name,
          ret: name === 'getLegend' ? ret && { seed: ret.seed, items: ret.items } : name === 'cellLight' ? [...ret] : ret,
        });
      }
      out.push(
        text({
          calls,
          dom: Object.fromEntries(Object.entries(page.els).map(([k, v]) => [k, [v.innerHTML, [...v.classList.set]]])),
          body: [...page.body.classList.set],
          log: msgs.map((x) => x.html),
          timers,
          stealth,
          lantern,
          ui: { uiMode: ui.uiMode, helpOn: ui.helpOn, chronOn: ui.chronOn, hintHTML: ui.hintHTML, noticeMsgT: ui.noticeMsgT },
          shake: vfx.shake,
          player: { stillT: player.stillT, searchedAt: player.searchedAt },
          monsters: here.monsters.map((x) => [x.aware, x.sleep, x.noticed, x.wait, x.revealNow, x.alarmed, x.howled, x.woke, x.mark]),
          traps: here.D.traps.map((t) => t.hidden),
          legend: saved.LEGEND && saved.LEGEND.seed,
        }),
      );
    }
  } finally {
    restoreGlobals();
    if (keepNow) Object.defineProperty(performance, 'now', keepNow);
    else Reflect.deleteProperty(performance, 'now');
    Object.assign(here, keep.here);
    Object.assign(adv, keep.adv);
    restore(player, keep.player);
    restore(stealth, keep.stealth);
    restore(lantern, keep.lantern);
    restore(hudInfo, keep.hudInfo);
    restore(ui, keep.ui);
    restore(vfx, keep.vfx);
    Object.assign(blaze, keep.blaze);
    Object.assign(saved, keep.saved);
    gear.hands = keep.gear.hands;
    gear.runeUid = keep.gear.runeUid;
    clock.time = keep.time;
    SND.ctx = keep.ctx;
    if (keep.shift) Object.defineProperty(keys, 'ShiftLeft', keep.shift);
    else delete keys['ShiftLeft'];
    msgs.length = 0;
    if (keep.lord) MTYPES['lord'] = keep.lord;
    else delete MTYPES['lord'];
    if (keep.X) MTYPES['X'] = keep.X;
    else delete MTYPES['X'];
  }
  return out.join('\n');
}
