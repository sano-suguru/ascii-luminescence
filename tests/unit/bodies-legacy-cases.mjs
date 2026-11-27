// テストの道具：生き物の形（src/lib/bodies/build.ts の buildForm）・まわりの飾りと王の影の変身（auras.ts）・忘れられた獣の記録（save.ts）を、
// たくさんの場合で呼び、結果を1つの文字列にまとめる。bodies-legacy.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// F は関数をまとめた物。形の場合は、種類ごとに見た目の乱数（Math.random）をシードで決めてから作り、点の並びを数える。
// テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio・偽の localStorage を、本物の型に合わせられないため。
// 書き換えた状態と、document・localStorage・setTimeout・Math.random・音の乱数は、終わったら元に戻す。
import { MTYPES } from '../../src/lib/creatures.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { makeBeastType } from '../../src/lib/bodies/lords.ts';
import { AVATAR_TY } from '../../src/lib/names.ts';
import { P, dCol, dPar, dPos } from '../../src/lib/particles.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { P_MAX } from '../../src/lib/shaders.ts';
import { SND, adv, buf, clock, here, msgs, player, vfx } from '../../src/lib/state.ts';
import { FINAL_DEPTH } from '../../src/lib/world.ts';
import { adder } from '../../src/lib/bodies/kit.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { fakeAudio } from './fake-audio.mjs';
import { swapGlobals } from './ui-cases.mjs';

const text = (v) =>
  JSON.stringify(v, (_k, x) =>
    x === undefined ? 'undefined' : typeof x === 'number' && !Number.isFinite(x) ? String(x) : x instanceof Set ? { set: [...x] } : x,
  );
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** 配列の中身の指紋（Float32Array・Uint8Array のバイト列の from から to まで） */
const hashArr = (a, from, to) => {
  const b = new Uint8Array(a.buffer, a.byteOffset + from * a.BYTES_PER_ELEMENT, Math.max(0, to - from) * a.BYTES_PER_ELEMENT);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ (b[i] ?? 0), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** Math.random と音の乱数（別の並び）をシードの乱数に入れ替えて f を呼ぶ */
function seeded(seed, f) {
  const keep = Math.random,
    keepSound = setSoundRand(mulberry32(seed + 0x5bd1e995));
  Math.random = mulberry32(seed);
  try {
    return f();
  } finally {
    Math.random = keep;
    setSoundRand(keepSound);
  }
}

// 作り直していない主の形（古い形と、見た目の特徴）と、主の見た目
const BOSS_FORMS = ['lichking', 'spiderqueen', 'nagaqueen', 'olddragon', 'shadowking', 'shadowserpent', 'deepkraken'];
const OLD_FORMS = [
  'snake',
  'troll',
  'golem',
  'bog',
  'kraken',
  'dragon',
  'naga',
  'spider',
  'robot',
  'cleaner',
  'repairer',
  'watcher',
  'fish',
  'shroom',
  'crab',
  'humanoid',
  'quad',
  'bat',
  'bloat',
  'orb',
  'wraith',
  'eel',
  'jelly',
  'nope',
];
const EXTRA_LOOKS = ['lichking', 'lich', 'wraith', 'shadowking', 'spiderqueen', 'nagaqueen', 'olddragon'];

/**
 * 形を作る種類の一覧：表 MTYPES の全部（見た目を書き足した後）と、その主（boss）、作り直していない主の形と古い形（見た目ありとなし）、
 * 年代記の忘れられた獣（hist 個のシード）と図鑑の見本（samples）、プレイヤーの姿、壁の像（ch と form だけ）、王の影（look が null）
 */
export function formTypes(samples, hist) {
  const out = [];
  for (const [k, ty] of Object.entries(MTYPES)) {
    out.push([k, ty]);
    out.push([k + ':boss', { ...ty, boss: true }]);
  }
  const base = MTYPES['L'];
  for (const form of [...BOSS_FORMS, ...OLD_FORMS])
    for (const look of [undefined, null, ...EXTRA_LOOKS, 'kobold', 'rat'])
      out.push([`${form}/${look}`, { ...base, form, look, boss: true }]);
  for (let s = 1; s <= hist; s++) out.push([`beast${s}`, makeBeastType(makeHistory(s * 7919), s * 104729)]);
  samples.forEach((b, i) => out.push([`sample${i}`, { ch: 'X', form: 'beast', ...b }]));
  out.push(['avatar', AVATAR_TY]);
  out.push(['statue', { ch: '&', form: 'humanoid' }]);
  out.push(['final', { ...base, ch: '&', look: null, form: 'shadowking', sk: 'final', scale: 3, col: [0.62, 0.48, 1.0], boss: true }]);
  out.push(['sw', { ...MTYPES['s'], sk: 'sw', name: '蛇顎' }]);
  out.push(['watch', { ...MTYPES['s'], name: '蛇顎の見張り' }]);
  return out;
}
/** 形：種類ごとに、見た目の乱数のシードを変えて reps 回作り、点の並びの指紋と点の数を1行にする */
export function formCases(F, types, reps) {
  return types
    .map(([name, ty], n) => {
      const got = [];
      for (let r = 0; r < reps; r++) {
        const pts = seeded(n * 1000 + r + 1, () => F.buildForm(ty));
        got.push(`${fnv(text(pts))}:${pts.length}:${pts.noExtra ? 1 : 0}`);
      }
      return `${name} ${got.join(' ')}`;
    })
    .join('\n');
}

/**
 * 見た目の特徴を直接足す：古い人型（見た目なし）の形に lookHumanoid と shapeHumanoid を、古い四つ足の形に lookQuad を、見た目ごとに呼ぶ
 * （人型の7つの見た目は、buildForm からは humanoid2・goblinForm・ogreForm・conjurerForm・snapjawForm へ行くので、ここで直接確かめる）
 */
export function lookCases(F) {
  const LOOKS = [
    'kobold',
    'goblin',
    'snapjaw',
    'monkey',
    'conjurer',
    'ogre',
    'gnome',
    'rat',
    'jackal',
    'grazer',
    'salamander',
    'nope',
    undefined,
    null,
  ];
  return LOOKS.map((look, n) => {
    const hum = seeded(n + 1, () => F.buildForm0({ ch: 'k', form: 'humanoid' })),
      quad = seeded(n + 101, () => F.buildForm0({ ch: 'r', form: 'quad' }));
    seeded(n + 201, () => {
      F.lookHumanoid(look, hum, adder(hum), 'k');
      F.shapeHumanoid(hum, look);
      F.lookQuad(look, quad, adder(quad), 'r');
    });
    return `${look} ${fnv(text(hum))}:${hum.length} ${fnv(text(quad))}:${quad.length}`;
  }).join('\n');
}

/** 偽の画面（伝言の欄）と、待たせた物を覚える setTimeout */
function fakeWorld() {
  const log = { innerHTML: '' },
    timers = [];
  return {
    log,
    timers,
    globals: {
      document: { getElementById: (id) => (id === 'log' ? log : null) },
      setTimeout: (f, ms) => (timers.push([f, ms]), timers.length),
    },
  };
}

/**
 * まわりの飾り・王の影の変身・姿を変える途中：場合ごとに、種類と生き物（位置・向き・歩き・体力・覚えた物の有無）・プレイヤーとの距離・時刻・
 * 最深部の状態・鳴らせる偽の Web Audio をシードの乱数で作り、関数を1つ選んで、何フレームか続けて呼ぶ（変身は1回）。置いた文字と出した粒子の配列・音の記録・生き物と状態の変わり方を記録する
 */
export function auraCases(F, seeds) {
  const keep = {
    buf: { ...buf },
    time: clock.time,
    px: player.x,
    pz: player.z,
    snd: { ctx: SND.ctx, on: SND.on, inp: SND.inp },
    here: { depth: here.depth, branch: here.branch, realm: here.realm, inter: here.inter, finalSt: here.finalSt },
    hist: adv.HIST,
    vfx: { ...vfx },
    final2: MTYPES['final2'],
    msgs: msgs.slice(),
  };
  const W = fakeWorld(),
    restoreGlobals = swapGlobals(W.globals),
    out = [];
  const NAMES = [
    'lichAura',
    'spiderAura',
    'nagaAura',
    'dragonAura',
    'shadowAura',
    'krakenAura',
    'houndAura',
    'salamanderAura',
    'bogAura',
    'drawMorph',
    'transformShadow',
  ];
  try {
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 2654435761 + 31),
        pick = (a) => a[Math.floor(r() * a.length)];
      seeded(s, () => {
        const name = NAMES[(s - 1) % NAMES.length],
          // 王の影の変身と姿を変える途中は、ほとんど王の影（一つ目の姿は心臓の点を持つ）で
          shadow = (name === 'transformShadow' || name === 'drawMorph') && r() < 0.8,
          kind = name === 'houndAura' ? pick(['Zf', 'Zi', 'Zl']) : pick(['L', 'D', 'S', 'N', 'K', 'B', 'l']),
          base = shadow ? { ...MTYPES['L'], ch: '&', look: null, form: 'shadowking', sk: 'final', boss: true } : MTYPES[kind],
          ty = { ...base, scale: pick([1, 2.4, 3.6, 0]) };
        if (name === 'houndAura' && r() < 0.15) ty.hound = 'nope';
        const form = seeded(s + 7, () => F.buildForm({ ...base }));
        const m = {
          key: kind,
          ty,
          x: 10 + r() * 20,
          z: 10 + r() * 20,
          y: r() < 0.5 ? 0 : r() * 2,
          yaw: r() * 6.28,
          moving: pick([0, 0.2, 0.25, 0.35, 0.5, 1, undefined]),
          form,
        };
        if (r() < 0.7) {
          m.maxHp = 200;
          m.hp = pick([200, 190, 100, 10, 0]);
        }
        if (r() < 0.2) m.phase2 = true;
        if (r() < 0.3) m.droneT = r() * 10;
        if (r() < 0.3) m.hissT = r() * 10;
        if (r() < 0.3) m.ghosts = [{ x: m.x, y: 0, z: m.z, yaw: 1, t: r() * 10 }];
        if (r() < 0.3) m.ghostT = r() * 10;
        if (name === 'drawMorph') m.morph = { from: form.slice(0, Math.max(1, Math.floor(r() * form.length))), t0: r() * 10, dur: 2.5 };
        clock.time = r() * 12;
        const dist = pick([0, 5, 11, 12.5, 13.5, 14.5, 20, 23.5, 24.5, 25.5, 26.5, 29.5, 30.5, 35.5, 36.5, 39.5, 40.5, 45]);
        player.x = m.x + dist;
        player.z = m.z;
        const audio = [];
        if (r() < 0.5) {
          const ctx = fakeAudio(audio, 'running');
          Object.assign(SND, { ctx, on: true, inp: ctx.createGain() });
        } else Object.assign(SND, { ctx: null, on: false, inp: null });
        here.depth = r() < 0.5 ? FINAL_DEPTH : 5;
        Object.assign(here, { branch: null, realm: null, inter: r() < 0.1 ? { key: 'town' } : null });
        here.finalSt =
          r() < 0.6
            ? {
                c0: 0,
                ...[0, 1, 2].reduce((o) => (r(), o), {}), // 乱数を引く数を前と同じに保つ
                boss: null,
                bossT: -1,
                summonT: 12,
                said: false,
              }
            : r() < 0.5
              ? { c0: 0 }
              : null;
        adv.HIST = {
          rulers: [
            { title: '第一の王', name: 'アル' },
            { title: '第二の王', name: 'ベル' },
          ],
        };
        Object.assign(vfx, { shake: r() * 0.5, flash: r() * 0.5 });
        delete MTYPES['final2'];
        msgs.length = 0;
        W.timers.length = 0;
        buf.dn = 0;
        buf.pN = r() < 0.1 ? P_MAX - 3 : Math.floor(r() * 10);
        const pN0 = buf.pN,
          frames = name === 'transformShadow' ? 1 : 1 + Math.floor(r() * (name === 'houndAura' ? 24 : 6));
        let t = r() * 20,
          ret;
        // 続けて何フレームか呼ぶ（覚えた物を使い回す所と、確率で出る粒子を通す）
        for (let k = 0; k < frames; k++) {
          // 描画は、姿を変える途中の時だけ drawMorph を呼ぶ
          if (name === 'drawMorph' && !m.morph) break;
          ret = F[name](m, t);
          t += 1 / 30;
          clock.time += 1 / 30;
        }
        const waited = W.timers.map(([f, ms]) => (f(), ms));
        const { form: f2, ty: ty2, morph, ...rest } = m;
        out.push(
          text({
            s,
            name,
            kind,
            frames,
            ret,
            dn: buf.dn,
            dyn: [hashArr(dPos, 0, buf.dn * 3), hashArr(dCol, 0, buf.dn * 3), hashArr(dPar, 0, buf.dn * 4)],
            pN: [pN0, buf.pN],
            P: Object.values(P).map((a) => hashArr(a, Math.min(pN0, P_MAX), Math.min(buf.pN, P_MAX))),
            audio: fnv(text(audio)) + ':' + audio.length,
            m: rest,
            form: f2 === form ? 'same' : fnv(text(f2)),
            ty: ty2 === ty ? 'same' : text(ty2),
            morph: morph && { from: fnv(text(morph.from)), t0: morph.t0, dur: morph.dur },
            final2: MTYPES['final2'] ? text(MTYPES['final2']) : null,
            msgs: msgs.map((x) => x.html ?? x),
            waited,
            vfx: [vfx.shake, vfx.flash],
          }),
        );
      });
    }
  } finally {
    Object.assign(buf, keep.buf);
    clock.time = keep.time;
    player.x = keep.px;
    player.z = keep.pz;
    Object.assign(SND, keep.snd);
    Object.assign(here, keep.here);
    adv.HIST = keep.hist;
    Object.assign(vfx, keep.vfx);
    if (keep.final2) MTYPES['final2'] = keep.final2;
    else delete MTYPES['final2'];
    msgs.splice(0, msgs.length, ...keep.msgs);
    restoreGlobals();
  }
  return out.join('\n');
}

/**
 * 忘れられた獣の記録：保存の中身（無い・空・同じ獣がいる・違う獣・配列でない・壊れた JSON・null が混じる・61より多い）と、
 * 今の探索の記録（beastsNew の有無）と、保存が使えるかを変えて、recordBeast と loadBeasts を呼ぶ
 */
export function beastRecordCases(F) {
  const keep = { seed: adv.runSeed, stats: adv.runStats },
    out = [];
  const beast = {
    name: '千の眼を持つ大蛇',
    col: [0.5, 0.6, 0.7],
    spec: { plan: 'serpent', kind: '大蛇' },
    lore: '言い伝え',
    scale: 3.6,
    fl: 0,
    flier: false,
    extra: 1,
  };
  const many = JSON.stringify(Array.from({ length: 65 }, (_, i) => ({ seed: i, name: `獣${i}` })));
  const STORE = [
    null,
    '[]',
    JSON.stringify([{ seed: 77, name: beast.name }]),
    JSON.stringify([{ seed: 76, name: beast.name }, 'x', 3]),
    '{"seed":77}',
    '"text"',
    '{broken',
    JSON.stringify([null]),
    JSON.stringify([{ seed: 1, name: 'a' }, null]),
    many,
  ];
  try {
    for (const stored of STORE)
      for (const stats of [null, { kills: 0, t0: 0 }, { kills: 0, t0: 0, beastsNew: 2 }])
        for (const ok of [true, false]) {
          const box = new Map(stored === null ? [] : [['al_beasts', stored]]),
            writes = [];
          const restore = swapGlobals({
            localStorage: {
              getItem: (k) => {
                if (!ok) throw new Error('保存が使えない');
                return box.has(k) ? box.get(k) : null;
              },
              setItem: (k, v) => {
                if (!ok) throw new Error('保存が使えない');
                writes.push([k, v]);
                box.set(k, v);
              },
            },
          });
          try {
            adv.runSeed = 77;
            adv.runStats = stats && { ...stats };
            const before = F.loadBeasts();
            const ret = F.recordBeast(beast);
            out.push(text({ stored, stats, ok, before, ret, writes, after: F.loadBeasts(), runStats: adv.runStats }));
          } finally {
            restore();
          }
        }
  } finally {
    adv.runSeed = keep.seed;
    adv.runStats = keep.stats;
  }
  return out.join('\n');
}
