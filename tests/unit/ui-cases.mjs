// テストの道具：伝言・下の HUD・手の枠・保存・ルーンの説明・拾ったルーンを入れる処理を、たくさんの場合で呼び、
// 返す値と、画面に書いた HTML（偽の画面の部品）・保存した物（偽の localStorage）・手と袋と見たルーンの変わり方を、1つの文字列にまとめる。
// F は関数をまとめた物。ui.test.mjs が、この文字列の指紋を確かめる。
// 1つの場合では、手（武器・枠・体の枠）・袋・詠唱・付け替え・加護・体力・近くの祭壇をシードの乱数で作り、関数を3つ続けて呼ぶ。
// 装備の画面は閉じたままにする（開いている時の作り直しは ui.test.mjs が、装備の画面そのものはブラウザの tests/inventory.mjs が確かめる）。
// テストを .mjs で書くのは、偽の画面の部品と偽の localStorage を、本物の型に合わせられないため。
// 書き換えた状態（gear・adv・saved・ui・here・player・msgs）と、document・localStorage・performance.now は、終わったら元に戻す。
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES, TRAITS } from '../../src/lib/runes.ts';
import { adv, gear, here, msgs, player, saved, ui } from '../../src/lib/state.ts';

const ALL = Object.values(RUNE_TYPES).flat();
const BLESS_KEYS = ['reckless', 'swift', 'devour', 'nope'];
const text = (v) => JSON.stringify(v, (_k, x) => (x === undefined ? 'undefined' : x instanceof Set ? { set: [...x] } : x));

/** globalThis の名前を、値 vals に入れ替える。元に戻す関数を返す（元の値は読み出さずに、欄の形のまま覚える。Node の localStorage は、読むと警告を出すため） */
export function swapGlobals(vals) {
  const keep = Object.keys(vals).map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  for (const [k, v] of Object.entries(vals)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  return () => {
    for (const [k, d] of keep) {
      if (d) Object.defineProperty(globalThis, k, d);
      else Reflect.deleteProperty(globalThis, k);
    }
  };
}
/** 偽の画面の部品（id ごとの innerHTML だけ）と、偽の localStorage（書いた物を記録する） */
export function fakePage() {
  const els = { log: { id: 'log', innerHTML: '' }, hotbar: { id: 'hotbar', innerHTML: '' } },
    stored = [];
  return {
    els,
    stored,
    document: { getElementById: (id) => (els[id] ??= { id, innerHTML: '' }) },
    localStorage: { setItem: (k, v) => stored.push([k, v]) },
  };
}

/**
 * seeds：場合の数。clearLog：伝言の一覧を空にする関数。page：fakePage() の偽の画面（すべての場合で同じ物を使い、場合ごとに中身を空にする）
 */
export function uiCases(F, seeds, clearLog, page) {
  const keep = {
    hands: gear.hands,
    bag: gear.bag,
    castSt: gear.castSt,
    swapSt: gear.swapSt,
    runeUid: gear.runeUid,
    runState: adv.runState,
    lvl: adv.lvl,
    max: adv.PLAYER_MAX,
    rseen: saved.RSEEN,
    invOpen: ui.invOpen,
    altarNear: ui.altarNear,
    D: here.D,
    hp: player.hp,
    now: Object.getOwnPropertyDescriptor(performance, 'now'),
  };
  const restoreGlobals = swapGlobals({ document: page.document, localStorage: page.localStorage }),
    out = [];
  let clock = 1000;
  performance.now = () => clock;
  try {
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 2654435761 + 7),
        pick = (a) => a[Math.floor(r() * a.length)];
      gear.runeUid = 100;
      const rune = (cat) => {
        const type = cat ? pick(RUNE_TYPES[cat]) : pick(ALL),
          ru = { uid: gear.runeUid++, type };
        if (r() < 0.2) ru.strong = true;
        const keys = Object.keys(TRAITS[type] || {});
        if (keys.length && r() < 0.6) ru.traits = keys.filter(() => r() < 0.5).map((k) => ({ k, lv: Math.floor(r() * 6) }));
        return ru;
      };
      const maybe = (cat, p) => (r() < p ? rune(cat) : null);
      // 手：ときどき両手持ち（左右が同じ武器）
      const hand = (atk) => {
        const slotN = 2 + Math.floor(r() * 3),
          slots = [0, 1, 2, 3].map(() => (r() < 0.35 ? rune(pick(['elem', 'trig', 'mod'])) : null));
        return { atk, slots, slotN, turn: 0, elem: null, trig: null };
      };
      const two = r() < 0.25 ? rune('atk') : null;
      gear.hands = {
        L: hand(two || maybe('atk', 0.6)),
        R: hand(two || maybe('atk', 0.6)),
        B: { b0: maybe('body', 0.4), b1: maybe('body', 0.3) },
      };
      gear.bag = Array.from({ length: Math.floor(r() * 5) }, () => rune());
      gear.castSt = r() < 0.3 ? { h: pick(['L', 'R']), t: r() * 2, need: r() < 0.1 ? 0 : r() * 2 } : null;
      gear.swapSt = r() < 0.2 ? { t: r() * 1.5, dur: 1.5 } : null;
      adv.runState = { startChosen: false, altar1: false, taken: new Set(), lordsDone: new Set(), bodyOpen: Math.floor(r() * 3) };
      adv.lvl = {
        n: 1,
        exp: 0,
        pending: 0,
        bless: Object.fromEntries(BLESS_KEYS.filter(() => r() < 0.5).map((k) => [k, 1 + Math.floor(r() * 3)])),
        strata: new Set(),
      };
      adv.PLAYER_MAX = 30 + Math.floor(r() * 40);
      player.hp = r() * adv.PLAYER_MAX;
      saved.RSEEN = new Set(ALL.filter(() => r() < 0.3));
      ui.invOpen = false;
      // 近くの祭壇：選択肢3つ（ときどき1つ取った後）。鍛える・癒し・枠を開ける・ルーン
      const grp = 'altar' + s;
      const opt = (k) => {
        const o = {
          i: 10 + k,
          kind: 'rune',
          grp,
          altar: true,
          slot: k,
          taken: r() < 0.15,
          opt: pick(['rune', 'rune', 'heal', 'open', 'forge']),
        };
        if (o.opt === 'rune') o.rune = rune();
        if (o.opt === 'open') o.label = '左手の3つ目の枠';
        if (o.opt === 'forge') {
          o.forgeW = rune('atk');
          o.forgeK = pick(Object.keys(TRAITS[o.forgeW.type] || { count: 0 }));
          o.forgeTo = 1 + Math.floor(r() * 5);
        }
        return o;
      };
      here.D = { items: [opt(0), opt(1), opt(2), { i: 3, kind: 'spring', taken: false }] };
      ui.altarNear = r() < 0.8 ? grp : r() < 0.5 ? 'altar0' : null;
      for (const el of Object.values(page.els)) el.innerHTML = '';
      page.stored.length = 0;
      clearLog();
      // 関数を3つ続けて呼ぶ
      const calls = [];
      for (let n = 0; n < 3; n++) {
        clock += r() < 0.3 ? 9000 + r() * 6000 : r() * 2000;
        const side = pick(['L', 'R']),
          ops = [
            ['msg', () => [`伝言 ${s}-${n}`]],
            ['renderLog', () => []],
            ['renderHotbar', () => []],
            ['equipWeapon', () => [side, r() < 0.15 ? null : rune('atk')]],
            [
              'slotSet',
              () =>
                r() < 0.3 ? ['B', pick(['b0', 'b1']), maybe('body', 0.8)] : [side, pick(['atk', 's0', 's1', 's2', 's3']), maybe(null, 0.8)],
            ],
            ['freeSlotFor', () => [rune(pick(['elem', 'trig', 'mod'])), r() < 0.5 ? undefined : [side]]],
            ['bodyN', () => [pick(RUNE_TYPES.body)]],
            ['BL', () => [pick(BLESS_KEYS)]],
            ['saveSet', () => ['al_test', new Set(ALL.filter(() => r() < 0.1))]],
            ['saveMeta', () => []],
            [
              'trDesc',
              () => {
                const w = rune('atk'),
                  keys = Object.keys(TRAITS[w.type] || {});
                return [w.type, { k: r() < 0.9 ? pick(keys.length ? keys : ['count']) : 'nope', lv: Math.floor(r() * 6) }];
              },
            ],
            ['detailLines', () => [r() < 0.1 ? null : rune()]],
            ['altarDetail', () => [r() < 0.1 ? null : pick(here.D.items)]],
            ['altarOpts', () => []],
            ['mergeMod', () => [r() < 0.7 ? rune('mod') : rune()]],
            ['placeChosen', () => [rune()]],
            ['takeRune', () => [rune(), r() < 0.5 ? null : side]],
          ],
          [name, args] = pick(ops),
          a = args();
        const ret = F[name](...a);
        calls.push({ name, a, ret });
      }
      out.push(
        text({
          calls,
          dom: Object.fromEntries(Object.entries(page.els).map(([k, v]) => [k, v.innerHTML])),
          stored: page.stored,
          hands: gear.hands,
          bag: gear.bag,
          rseen: saved.RSEEN.size,
        }),
      );
    }
  } finally {
    Object.assign(gear, { hands: keep.hands, bag: keep.bag, castSt: keep.castSt, swapSt: keep.swapSt, runeUid: keep.runeUid });
    Object.assign(adv, { runState: keep.runState, lvl: keep.lvl, PLAYER_MAX: keep.max });
    saved.RSEEN = keep.rseen;
    Object.assign(ui, { invOpen: keep.invOpen, altarNear: keep.altarNear });
    here.D = keep.D;
    player.hp = keep.hp;
    msgs.length = 0;
    restoreGlobals();
    if (keep.now) Object.defineProperty(performance, 'now', keep.now);
    else Reflect.deleteProperty(performance, 'now');
  }
  return out.join('\n');
}
