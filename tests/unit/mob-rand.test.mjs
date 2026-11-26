// 生き物ごとの見た目の乱数（m.rnd）の単体テスト：初めて描く時に作って覚える物（眠った姿・不死の王の剣・古竜の宝・深みの主の灯り）と、
// 王の影の二つ目の姿が、それまでに見た目の乱数（Math.random）を何回引いたかで変わらないか。m.rnd が無い時は変わること（テストが違いを見つけられること）も確かめる。
// 生き物を作る makeMonster の形と初めの値は、tests/determinism.mjs がブラウザで確かめる
import { afterEach, describe, expect, it } from 'vitest';
import { lichAura, dragonAura, krakenAura, transformShadow } from '../../src/lib/bodies/auras.ts';
import { buildForm } from '../../src/lib/bodies/build.ts';
import { drawMonster0 } from '../../src/lib/bodies/draw.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { keyedRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { SND, adv, buf, here, player } from '../../src/lib/state.ts';
import { swapGlobals } from './ui-cases.mjs';

const realRandom = Math.random;
afterEach(() => {
  Math.random = realRandom;
});

// 見た目の乱数を、シード seed の並びにして、burn 回進めてから、生き物を作って f で覚える物を取り出す
function look(make, f, { seed, burn, own }) {
  Math.random = mulberry32(seed);
  const m = make();
  if (own) m.rnd = keyedRand('mob test', 7);
  for (let i = 0; i < burn; i++) Math.random();
  buf.dn = 0;
  buf.pN = 0;
  return JSON.stringify(f(m));
}

// f を呼び、止まったら（今の階が無いので）そこまでにする
const stopsAfter = (f) => {
  try {
    f();
  } catch (e) {
    if (!String(e).includes('今の階')) throw e;
  }
};

const base = (ty) => ({ key: 'x', ty, x: 20, z: 20, y: 0, yaw: 0.5, ph: 1, walk: 0, moving: 0, glow: 1, form: buildForm(ty), dead: false });

const CASES = [
  ['不死の王の剣', () => base({ ...MTYPES['D'], form: 'lichking', boss: true, scale: 1 }), (m) => (lichAura(m, 1), m.swords)],
  ['古竜の宝', () => base({ ...MTYPES['D'], boss: true, scale: 1 }), (m) => (dragonAura(m, 1), m.hoard)],
  ['深みの主の灯り', () => base({ ...MTYPES['K'], boss: true, scale: 1 }), (m) => (krakenAura(m, 1), m.lamps)],
  // 眠った姿は、描く処理の頭で作る。その先（マスの明るさ）は階が要るので、Node では止まる。作った姿だけを見る
  ['眠った竜', () => ({ ...base(MTYPES['D']), sleep: true }), (m) => (stopsAfter(() => drawMonster0(m, 1)), m.formSleep)],
];

describe('生き物ごとの見た目の乱数', () => {
  player.x = 21;
  player.z = 20;
  for (const [name, make, f] of CASES) {
    it(String(name) + 'は、見た目の乱数をほかで引いた回数によらない', () => {
      const a = look(make, f, { seed: 1, burn: 0, own: true }),
        b = look(make, f, { seed: 2, burn: 13, own: true });
      expect(a).toBe(b);
      // m.rnd が無ければ（直す前と同じ）、違う物になる
      expect(look(make, f, { seed: 1, burn: 0, own: false })).not.toBe(look(make, f, { seed: 2, burn: 13, own: false }));
    });
  }
  it('王の影の二つ目の姿は、見た目の乱数をほかで引いた回数によらない', () => {
    const keep = { hist: adv.HIST, ctx: SND.ctx, on: SND.on, final2: MTYPES['final2'], D: here.D },
      restore = swapGlobals({ document: { getElementById: (id) => (id === 'log' ? { innerHTML: '' } : null) }, setTimeout: () => 0 });
    adv.HIST = { rulers: [{ title: '第一の王', name: 'アル' }] };
    Object.assign(SND, { ctx: null, on: false });
    here.D = null;
    try {
      const make = () => base({ ...MTYPES['D'], ch: '&', look: null, form: 'shadowking', sk: 'final', boss: true, scale: 3 }),
        f = (m) => (transformShadow(m), m.form);
      expect(look(make, f, { seed: 1, burn: 0, own: true })).toBe(look(make, f, { seed: 2, burn: 13, own: true }));
      expect(look(make, f, { seed: 1, burn: 0, own: false })).not.toBe(look(make, f, { seed: 2, burn: 13, own: false }));
    } finally {
      adv.HIST = keep.hist;
      Object.assign(SND, { ctx: keep.ctx, on: keep.on });
      here.D = keep.D;
      if (keep.final2) MTYPES['final2'] = keep.final2;
      else delete MTYPES['final2'];
      restore();
    }
  });
});
