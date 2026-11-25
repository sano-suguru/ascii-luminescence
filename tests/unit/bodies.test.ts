// src/lib/bodies/ の単体テスト（生き物の形）
import { nth } from '../../src/lib/array.ts';
import { afterEach, describe, expect, it } from 'vitest';
import * as beasts from '../../src/lib/bodies/beasts.ts';
import * as bosses from '../../src/lib/bodies/bosses.ts';
import { type Body, type BodyType } from '../../src/lib/bodies/kit.ts';
import { hsl2rgb } from '../../src/lib/color.ts';
import { G } from '../../src/lib/glyphs.ts';
import * as lords from '../../src/lib/bodies/lords.ts';
import * as small from '../../src/lib/bodies/small.ts';
import { mulberry32 } from '../../src/lib/rng.ts';

const random = Math.random;
afterEach(() => {
  Math.random = random;
});
// 形は見た目の乱数（Math.random）を引く。テスト用モードと同じく、シードで決まる物に入れ替えて作る
const seeded = <T>(f: () => T): T => {
  Math.random = mulberry32(7);
  return f();
};
const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
};

const TYS: BodyType[] = [
  { scale: 1, col: [0.5, 0.6, 0.7] },
  { scale: 0.6, col: [0.9, 0.3, 0.2] },
  { scale: 2.35, col: [0.2, 0.8, 0.4] },
];
const TY_FORMS: ((ty: BodyType) => Body)[] = [
  small.jellyForm,
  small.bloatForm,
  small.wispForm,
  small.eelForm,
  small.snakeForm,
  small.fishForm,
  small.shroomForm,
  small.crabForm,
  beasts.ratForm,
  beasts.jackalForm,
  beasts.grazerForm,
  beasts.salamanderForm,
  beasts.trollForm2,
  beasts.golemForm2,
  beasts.bogForm2,
  beasts.nagaForm,
  beasts.krakenForm2,
  beasts.caveSpiderForm,
  beasts.batForm,
  beasts.dragonSleepForm,
  beasts.wraithForm2,
  beasts.phantomForm,
  lords.cleanerForm,
  lords.repairerForm,
  lords.watcherForm,
];
const PLAIN_FORMS: (() => Body)[] = [lords.golemForm, small.spiderForm, small.robotForm, small.bogForm, small.krakenForm];
// 引数の無い形（古いトロルと、主）
const BOSS_FORMS: (() => Body)[] = [
  small.trollForm,
  bosses.lichKingForm,
  bosses.spiderQueenForm,
  bosses.nagaQueenForm,
  bosses.oldDragonForm,
  bosses.shadowSerpentForm,
];
const SPECS: lords.BeastSpec[] = [];
for (const plan of ['quad', 'serpent', 'centipede', 'moth'])
  for (const wings of [false, true])
    SPECS.push({ plan, kind: plan === 'quad' ? '竜' : '獣', legs: 6, wings, ...(wings ? { eyes: 5 } : {}), glyphs: ['#', '%', '&'] });

describe('生き物の形', () => {
  it('TypeScript に移す前と、同じ乱数で同じ形になる（見た目の乱数を引く順番が変わっていない）', () => {
    let all = '';
    for (const f of TY_FORMS)
      for (const ty of TYS) {
        const b = seeded(() => f(ty));
        all += JSON.stringify(b) + (b.noExtra ? '!' : '');
      }
    for (const f of PLAIN_FORMS) all += JSON.stringify(seeded(f));
    for (const form of ['fish', 'shroom', 'bug']) all += JSON.stringify(seeded(() => small.critterForm({ form })));
    for (const spec of SPECS) {
      const b = seeded(() => lords.beastForm(spec));
      all += JSON.stringify(b) + JSON.stringify(lords.beastSleep(b, { spec }));
    }
    expect(all.length).toBe(2816831);
    expect(fnv(all)).toBe('3a9acc70'); // 移す前の実装で出した値（王の影の一つ目の姿は、作り直したので下の別のテスト）
  });
  it('主と大きな生き物の形：TypeScript に移す前と、同じ乱数で同じ形になる', () => {
    let all = '';
    for (const ty of TYS) {
      all += JSON.stringify(seeded(() => beasts.dragonForm(ty)));
      all += JSON.stringify(seeded(() => beasts.ogreForm({ ...ty, ch: 'O' })));
    }
    for (const f of BOSS_FORMS) all += JSON.stringify(seeded(f));
    expect(all.length).toBe(1790379);
    expect(fnv(all)).toBe('a5fb116c'); // 移す前の実装で出した値
  });
  it('どの点も、座標が有限で、文字の番号が文字の絵の表の中にあり、体のどこかが決まっている', () => {
    const bodies = [
      ...TY_FORMS.flatMap((f) => TYS.map((ty) => seeded(() => f(ty)))),
      ...PLAIN_FORMS.map((f) => seeded(f)),
      seeded(lords.shadowKingForm),
      ...BOSS_FORMS.map((f) => seeded(f)),
      ...TYS.flatMap((ty) => [seeded(() => beasts.dragonForm(ty)), seeded(() => beasts.ogreForm({ ...ty, ch: 'O' }))]),
      ...SPECS.map((s) => seeded(() => lords.beastForm(s))),
    ];
    for (const b of bodies) {
      expect(b.length).toBeGreaterThan(5);
      for (const p of b) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
        expect(p.g).toBeGreaterThanOrEqual(0);
        expect(p.g).toBeLessThan(106);
        expect(p.part.length).toBeGreaterThan(0);
      }
    }
  });
  it('死者（亡霊・幻影）だけが、飾りの点を足さない印を持つ', () => {
    const marked = TY_FORMS.filter((f) => seeded(() => f(nth(TYS, 0))).noExtra).map((f) => f.name);
    expect(marked).toEqual(['wraithForm2', 'phantomForm']);
  });
  it('眠った獣は、脚を体に畳み、低くなる', () => {
    const spec = nth(SPECS, 0),
      b = seeded(() => lords.beastForm(spec)),
      z = lords.beastSleep(b, { spec });
    expect(z.some((p) => p.part === 'legL' || p.part === 'legR')).toBe(false);
    expect(Math.max(...z.map((p) => p.y))).toBeLessThan(Math.max(...b.map((p) => p.y)));
  });
  it('王の影の一つ目の姿：翼は無く、冠の棘5本・目2つ・黒い太陽（点の輪と印の輪）・剣・心臓・封印のひび7本。高さは SHADOW_KING_H', () => {
    const b = seeded(lords.shadowKingForm);
    const parts = (name: string) => b.filter((p) => p.part === name);
    expect(b.some((p) => p.part.startsWith('wing'))).toBe(false);
    expect(parts('eye').length).toBe(2);
    expect(parts('head').filter((p) => p.g === G('^')).length).toBe(5); // 冠の棘の先
    const halo = parts('halo');
    expect(halo.length).toBe(36);
    expect(new Set(halo.map((p) => p.r)).size).toBe(2);
    const top = Math.max(...b.map((p) => (p.part === 'halo' ? (p.cy ?? 0) + (p.r ?? 0) : p.y)));
    expect(top).toBeCloseTo(lords.SHADOW_KING_H, 2);
    expect(Math.min(...b.map((p) => p.y))).toBeGreaterThanOrEqual(0);
    expect(parts('heart').length).toBe(9);
    expect(new Set(parts('crack').map((p) => p.th)).size).toBe(7);
    // 剣：右手（向き合うと左）に、縦に長い刃
    const blade = b.filter((p) => p.part === 'body' && Math.abs(p.x + 0.58) < 0.05 && p.y > 1.1);
    expect(Math.max(...blade.map((p) => p.y)) - Math.min(...blade.map((p) => p.y))).toBeGreaterThan(1.3);
    // 幅は翼が無いので、裾の広がりまで（左右に約1.3以内）
    expect(Math.max(...b.map((p) => Math.abs(p.x)))).toBeLessThan(1.35);
  });
  it('深みの主の触手：体のそばの4本と、水面から出る10本。移す前と同じ値', () => {
    expect(lords.KRAKEN_T.length).toBe(14);
    expect(lords.KRAKEN_W.length).toBe(14);
    expect(fnv(JSON.stringify([lords.KRAKEN_T, lords.KRAKEN_W]))).toBe('1128adb5'); // 移す前の実装で出した値
  });
  it('hsl2rgb：色相 0 は赤、1/3 は緑、2/3 は青', () => {
    expect(hsl2rgb(0, 1, 0.5)).toEqual([1, 0, 0]);
    expect(hsl2rgb(1 / 3, 1, 0.5).map((v) => Math.round(v * 1000) / 1000)).toEqual([0, 1, 0]);
    expect(hsl2rgb(2 / 3, 1, 0.5).map((v) => Math.round(v * 1000) / 1000)).toEqual([0, 0, 1]);
  });
});
