// テストの道具：粒子と世界の中に置く文字（src/lib/particles.ts）・頭の上の印（status.ts の drawMark）・装備の画面の開け閉めと付け替えの詠唱
// （inventory.ts の setInv・startSwap）・マウスを捕まえる・視点・音量（screens.ts）を、たくさんの場合で呼び、配列の中身と数・状態の変わり方・
// 画面の部品にしたこと（偽の画面の部品が記録する）を、1つの文字列にまとめる。screens.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// F は関数をまとめた物。粒子の場合（particleCases）は、F の配列（P・dPos・dCol・dPar）を読む。ほかの場合（screenCases）は、粒子と文字を
// 本物の src/lib/particles.ts に置く物として、その配列を読む。
// テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio の音量・偽の localStorage を、本物の型に合わせられないため。
// 書き換えた状態と、document・localStorage・setTimeout・Math.random・performance.now は、終わったら元に戻す。
import { MTYPES } from '../../src/lib/creatures.ts';
import { dCol, dPar, dPos, P as PP } from '../../src/lib/particles.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES, TRAITS } from '../../src/lib/runes.ts';
import { DYN_MAX, P_MAX } from '../../src/lib/shaders.ts';
import { SND, adv, buf, fight, gear, here, player, ui } from '../../src/lib/state.ts';
import { cpos } from '../../src/lib/world.ts';
import { fakeAudio } from './fake-audio.mjs';
import { swapGlobals } from './ui-cases.mjs';

const text = (v) =>
  JSON.stringify(v, (_k, x) => (x === undefined ? 'undefined' : Number.isNaN(x) ? 'NaN' : x instanceof Set ? { set: [...x] } : x));
/** 配列の中身の指紋（Float32Array・Uint8Array のバイト列） */
const hashArr = (a, from = 0, to = a.length) => {
  const b = new Uint8Array(a.buffer, a.byteOffset + from * a.BYTES_PER_ELEMENT, (to - from) * a.BYTES_PER_ELEMENT);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ (b[i] ?? 0), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** 0 から n までの、置いた文字の配列の中身 */
const dynSlice = (A, n) => [hashArr(A.dPos, 0, n * 3), hashArr(A.dCol, 0, n * 3), hashArr(A.dPar, 0, n * 4)];

/** Math.random をシードの乱数に入れ替える（見た目の乱数 mr は、呼んだ時に Math.random を読む）。元に戻す関数を返す */
function seedRandom(seed) {
  const keep = Math.random;
  Math.random = mulberry32(seed);
  return () => {
    Math.random = keep;
  };
}

/**
 * 粒子と置く文字：場合ごとに数（buf.pN・buf.dn）を、0・少し・上限の手前・上限から始め、出す・消す・置く・数を0に戻すを、シードの乱数で20回続ける。
 * 消す番号は、生きている粒子の外（-1 や数そのもの）も混ぜる。終わった時の数と、全部の配列の中身を記録する
 */
export function particleCases(F, seeds) {
  const keep = { dn: buf.dn, pN: buf.pN },
    PF = Object.values(F.P),
    out = [];
  for (const a of [...PF, F.dPos, F.dCol, F.dPar]) a.fill(0);
  try {
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 2654435761 + 11),
        pick = (a) => a[Math.floor(r() * a.length)],
        num = () => (r() < 0.05 ? pick([0, -1.5, 1e6]) : (r() - 0.5) * 40),
        restore = seedRandom(s);
      try {
        buf.pN = pick([0, Math.floor(r() * 50), P_MAX - 3, P_MAX]);
        buf.dn = pick([0, Math.floor(r() * 50), DYN_MAX - 3, DYN_MAX]);
        const calls = [];
        for (let n = 0; n < 20; n++) {
          const k = r();
          if (k < 0.4) {
            const a = [num(), num(), num(), num(), num(), num(), r() * 3, Math.floor(r() * 300), r(), r() * 3, r() * 3, r() * 3];
            if (r() < 0.9) a.push(pick([0, 1, 2, 3, 4, 255, 256]));
            F.spawn(...a);
            calls.push('s');
          } else if (k < 0.6) {
            const i = r() < 0.2 ? pick([-1, buf.pN, buf.pN + 3]) : Math.floor(r() * Math.max(1, buf.pN));
            F.killP(i);
            calls.push('k' + i);
          } else if (k < 0.95) {
            const a = [num(), num(), num(), Math.floor(r() * 300), r(), r() * 3, r() * 3, r() * 3];
            const tail = r();
            if (tail < 0.4) a.push(pick([undefined, 0, 1, 2]));
            if (tail < 0.2) a.push(pick([undefined, 0, r() * 6.28]));
            F.dyn(...a);
            calls.push('d');
          } else {
            buf.dn = 0;
            calls.push('0');
          }
        }
        out.push(
          text({
            calls: calls.join(','),
            dn: buf.dn,
            pN: buf.pN,
            P: PF.map((a) => hashArr(a)),
            dyn: dynSlice(F, DYN_MAX),
          }),
        );
      } finally {
        restore();
      }
    }
  } finally {
    Object.assign(buf, keep);
  }
  return out.join('\n');
}

const KINDS = Object.keys(MTYPES);
const ALL = Object.values(RUNE_TYPES).flat();

/**
 * 偽の画面の部品：したことを log に記録する。描く画面 #gl の requestPointerLock の返し方は st.lock で変える。
 * #gl と #resume は、場合が変わっても同じ部品を使い続ける（古い関数と比べる時に、取り出した時の部品を覚える書き方とも同じ結果になるように）
 */
export function fakeScreen() {
  const log = [],
    els = {},
    stored = [],
    st = { lock: 'reject', store: true };
  const classList = (id) => ({ toggle: (c, on) => log.push(['toggle', id, c, on]) });
  const el = (id) => {
    if (id === 'gl')
      return {
        id,
        get requestPointerLock() {
          log.push(['rpl?', st.lock]);
          if (st.lock === 'none') return undefined;
          return () => {
            log.push(['rpl', st.lock]);
            if (st.lock === 'throw') throw new Error('no');
            if (st.lock === 'plain') return undefined;
            if (st.lock === 'ok') return Promise.resolve();
            return Promise.reject(new Error('no'));
          };
        },
      };
    if (id === 'resume')
      return {
        id,
        style: new Proxy({}, { set: (_t, k, v) => (log.push(['style', id, k, v]), true) }),
      };
    return {
      id,
      innerHTML: '',
      dataset: {},
      classList: classList(id),
      querySelectorAll: () => [],
      addEventListener: (t) => log.push(['listen', id, t]),
    };
  };
  return {
    log,
    els,
    stored,
    st,
    reset() {
      log.length = 0;
      stored.length = 0;
      for (const k of Object.keys(els)) if (k !== 'gl' && k !== 'resume') delete els[k];
    },
    document: {
      getElementById: (id) => (els[id] ??= el(id)),
      body: { classList: classList('body') },
      exitPointerLock: () => log.push(['exitPointerLock']),
      // 装備の画面を作る時に、幅に合わせて HTML を切る（clipHtml）。偽の部品は中身を持たないので、切らずにそのまま返る
      createElement: () => ({ innerHTML: '', childNodes: [] }),
    },
    localStorage: {
      setItem: (k, v) => {
        if (!st.store) throw new Error('no storage');
        stored.push([k, v]);
      },
    },
  };
}

/**
 * 頭の上の印・装備の画面の開け閉め・付け替えの詠唱・マウスを捕まえる・視点・音量。page は fakeScreen() の偽の画面（古い関数を取り出す前に
 * document に入れておき、すべての場合で同じ物を使う）。場合ごとに、生き物・両手・袋・石碑と祭壇・画面の開け閉めをシードの乱数で作り、関数を4つ続けて呼ぶ。
 * 呼び終わったら、捨てられた Promise の後始末（マウスを捕まえられなかった時）と、setTimeout で待たせた物を流してから記録する
 */
export async function screenCases(F, seeds, page) {
  const keep = {
    hands: gear.hands,
    bag: gear.bag,
    castSt: gear.castSt,
    swapSt: gear.swapSt,
    runeUid: gear.runeUid,
    runState: adv.runState,
    dead: adv.dead,
    beamSegs: fight.beamSegs,
    D: here.D,
    px: player.x,
    pz: player.z,
    ui: { ...ui },
    snd: { lv: SND.lv, on: SND.on, master: SND.master, ctx: SND.ctx, inp: SND.inp },
    buf: { ...buf },
    now: Object.getOwnPropertyDescriptor(performance, 'now'),
  };
  const timers = [],
    restoreGlobals = swapGlobals({
      document: page.document,
      localStorage: page.localStorage,
      setTimeout: (f, ms) => (timers.push([f, ms]), timers.length),
    }),
    out = [];
  performance.now = () => 5000;
  try {
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 2654435761 + 23),
        pick = (a) => a[Math.floor(r() * a.length)],
        restore = seedRandom(s + 1000);
      try {
        page.reset();
        timers.length = 0;
        gear.runeUid = 100;
        const rune = (cat) => {
          const type = cat ? pick(RUNE_TYPES[cat]) : pick(ALL),
            ru = { uid: gear.runeUid++, type };
          const keys = Object.keys(TRAITS[type] || {});
          if (keys.length && r() < 0.5) ru.traits = keys.filter(() => r() < 0.5).map((k) => ({ k, lv: Math.floor(r() * 6) }));
          return ru;
        };
        const maybe = (cat, p) => (r() < p ? rune(cat) : null);
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
        gear.castSt = r() < 0.4 ? { h: pick(['L', 'R']), t: r() * 2, need: 0.5 + r() } : null;
        gear.swapSt = null;
        fight.beamSegs = r() < 0.5 ? [{ x: 1 }] : [];
        adv.runState = { startChosen: false, altar1: false, taken: new Set(), lordsDone: new Set(), bodyOpen: Math.floor(r() * 3) };
        adv.dead = r() < 0.15;
        // 石碑と祭壇（真ん中の台 slot 1）：プレイヤーのそばか、遠くに置く
        player.x = 20 + r() * 20;
        player.z = 20 + r() * 20;
        const cellNear = (near) => {
          for (let i = 0; i < 200000; i += 37 + Math.floor(r() * 50)) {
            const [x, z] = cpos(i),
              d = Math.hypot(x - player.x, z - player.z);
            if (near ? d < 2.4 : d > 3) return i;
          }
          return 0;
        };
        here.D = {
          steles: r() < 0.5 ? [{ i: cellNear(r() < 0.5) }] : undefined,
          items: r() < 0.3 ? [{ i: cellNear(r() < 0.5), altar: true, slot: pick([0, 1]) }] : [],
        };
        Object.assign(ui, {
          gallery: r() < 0.1 ? { mode: pick(['range', 'beast']) } : null,
          invOpen: r() < 0.4,
          menuOpen: r() < 0.1,
          locked: r() < 0.5,
          plFailed: r() < 0.2,
          started: r() < 0.85,
          camMode: pick(['fps', 'tps']),
          camPos: r() < 0.5 ? [1, 2, 3] : null,
          packSel: r() < 0.3 ? { ru: rune(), from: 'bag' } : null,
          packHover: r() < 0.3 ? rune() : null,
          packSnap: null,
        });
        SND.lv = Math.floor(r() * 4);
        // 音：鳴らせる偽の Web Audio（鈴の音の部品も記録する）か、時刻だけの物か、無い
        if (r() < 0.35) {
          const ctx = fakeAudio(page.log, 'running');
          Object.assign(SND, { on: true, ctx, inp: ctx.createGain(), master: r() < 0.8 ? ctx.createGain() : null });
        } else {
          SND.on = r() < 0.5;
          SND.ctx = r() < 0.7 ? { currentTime: Math.floor(r() * 100) } : null;
          SND.master = SND.ctx && r() < 0.8 ? { gain: { setTargetAtTime: (...a) => page.log.push(['gain', ...a]) } } : null;
          SND.inp = null;
        }
        page.st.lock = pick(['reject', 'reject', 'ok', 'plain', 'throw', 'none']);
        page.st.store = r() < 0.8;
        buf.pN = r() < 0.1 ? P_MAX - 5 : Math.floor(r() * 20);
        const pN0 = buf.pN;
        // 生き物（頭の上の印）
        const mon = () => {
          const key = pick(KINDS),
            m = { key, x: r() * 50, z: r() * 50, ty: { ...MTYPES[key] } };
          if (r() < 0.1) m.ty.peaceful = true;
          if (r() < 0.1) m.ty.invisible = true;
          if (r() < 0.1) m.ty.form = 'nope';
          if (r() < 0.95) m.y = r() * 3;
          m.visible = r() < 0.85;
          if (r() < 0.9) m.mark = pick([0, r(), r() * 3]);
          m.sleep = r() < 0.3;
          m.noticed = r() < 0.4;
          if (r() < 0.8) m.aware = pick([0, 0.35, 0.36, r() * 1.25]);
          return m;
        };
        const calls = [];
        for (let n = 0; n < 4; n++) {
          const k = r();
          if (k < 0.3) {
            const m = mon(),
              t = r() * 100,
              dp = pick([0, 1, 3.9, 8, 22, 22.01, 30]) * (r() < 0.5 ? 1 : r());
            buf.dn = 0;
            F.drawMark(m, t, dp);
            const gs = Array.from({ length: buf.dn }, (_, i) => dPar[i * 4]);
            calls.push({ f: 'drawMark', key: m.key, t, dp, dn: buf.dn, gs, dyn: dynSlice({ dPos, dCol, dPar }, buf.dn), mark: m.mark });
          } else if (k < 0.5) {
            const on = r() < 0.5;
            // 開けている間に両手を変える（閉じた時に付け替えの詠唱になる）
            if (!on && ui.packSnap && r() < 0.6) gear.hands.L.atk = rune('atk');
            const p0 = buf.pN;
            F.setInv(on);
            calls.push({ f: 'setInv', on, swap: !!gear.swapSt, grew: buf.pN - p0 });
          } else if (k < 0.6) {
            const p0 = buf.pN;
            F.startSwap({ snapOf: s });
            calls.push({ f: 'startSwap', swap: !!gear.swapSt, grew: buf.pN - p0 });
          } else if (k < 0.72) {
            F.tryLock();
            calls.push({ f: 'tryLock' });
          } else if (k < 0.78) {
            F.updateResume();
            calls.push({ f: 'updateResume' });
          } else if (k < 0.89) {
            const m = pick(['fps', 'tps']);
            F.setCamMode(m);
            calls.push({ f: 'setCamMode', m });
          } else {
            F.sndToggle();
            calls.push({ f: 'sndToggle' });
          }
        }
        // 捨てられた Promise の後始末と、待たせた物
        await new Promise((res) => setImmediate(res));
        const waited = timers.map(([f, ms]) => (f(), ms));
        out.push(
          text({
            calls,
            log: page.log,
            waited,
            stored: page.stored,
            html: Object.fromEntries(Object.entries(page.els).flatMap(([k, v]) => ('innerHTML' in v ? [[k, v.innerHTML]] : []))),
            ui: {
              invOpen: ui.invOpen,
              plFailed: ui.plFailed,
              camMode: ui.camMode,
              camPos: ui.camPos,
              packSnap: ui.packSnap && ui.packSnap.key,
              packSel: !!ui.packSel,
              packHover: !!ui.packHover,
              hint: ui.hintHTML,
            },
            swapSt: gear.swapSt,
            castSt: gear.castSt,
            beamSegs: fight.beamSegs.length,
            snd: [SND.lv, SND.on],
            pN: [pN0, buf.pN],
            P: Object.values(PP).map((a) => hashArr(a, Math.min(pN0, P_MAX), Math.min(buf.pN, P_MAX))),
          }),
        );
      } finally {
        restore();
      }
    }
  } finally {
    Object.assign(gear, { hands: keep.hands, bag: keep.bag, castSt: keep.castSt, swapSt: keep.swapSt, runeUid: keep.runeUid });
    Object.assign(adv, { runState: keep.runState, dead: keep.dead });
    fight.beamSegs = keep.beamSegs;
    here.D = keep.D;
    player.x = keep.px;
    player.z = keep.pz;
    Object.assign(ui, keep.ui);
    Object.assign(SND, keep.snd);
    Object.assign(buf, keep.buf);
    restoreGlobals();
    if (keep.now) Object.defineProperty(performance, 'now', keep.now);
    else Reflect.deleteProperty(performance, 'now');
  }
  return out.join('\n');
}
