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
    expect(all.length).toBe(3403425);
    expect(fnv(all)).toBe('3187aa4f'); // トロル・ゴーレム・クラーケン・吸血コウモリ（trollForm2・golemForm2・krakenForm2・batForm）を除き、移す前の実装で出した値と同じ（この4つは移した後で作り直した。作り直した王の影の一つ目の姿は、下の別のテスト）
  });
  it('主と大きな生き物の形：TypeScript に移す前と、同じ乱数で同じ形になる', () => {
    let all = '';
    for (const ty of TYS) {
      all += JSON.stringify(seeded(() => beasts.dragonForm(ty)));
      all += JSON.stringify(seeded(() => beasts.ogreForm({ ...ty, ch: 'O' })));
    }
    for (const f of BOSS_FORMS) all += JSON.stringify(seeded(f));
    expect(all.length).toBe(1792099);
    expect(fnv(all)).toBe('7a018410'); // 移す前の実装で出した値から、蜘蛛の女王とナーガの女王の明るさ b だけを 0.6 倍（BOSS_DIM）にした値
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
  it('トロル：腕の点（手と棍棒の頭も）はどれも肩を、脚の点は腰を軸に回る（軸がずれると、歩く時に体から離れる）', () => {
    for (const ty of TYS) {
      const b = seeded(() => beasts.trollForm2(ty)),
        axis = (part: string) => new Set(b.filter((p) => p.part === part).map((p) => `${p.piv},${p.pz}`));
      expect([axis('armL'), axis('armR')]).toEqual([new Set(['1.42,0.4']), new Set(['1.42,0.4'])]);
      expect([axis('legL'), axis('legR')]).toEqual([new Set(['0.62,0']), new Set(['0.62,0'])]);
    }
  });
  it('ゴーレム：腕の点（肩の大岩と拳も）はどれも肩を、脚の点（足も）は腰を軸に回る（軸がずれると、歩く時に体から離れる）', () => {
    for (const ty of TYS) {
      const b = seeded(() => beasts.golemForm2(ty)),
        axis = (part: string) => new Set(b.filter((p) => p.part === part).map((p) => `${p.piv},${p.pz}`));
      expect([axis('armL'), axis('armR')]).toEqual([new Set(['1.34,0.06']), new Set(['1.34,0.06'])]);
      expect([axis('legL'), axis('legR')]).toEqual([new Set(['0.62,0']), new Set(['0.62,0'])]);
    }
  });
  it('クラーケン：水面より下に点が無く、目と斑点は頭の表面のすぐ外（埋もれず、浮かない）。明るさ b は 1.8 まで。腕は揺れる触手（tent）だけ', () => {
    const H = beasts.krakenHead,
      K = beasts.KRAKEN;
    for (const ty of TYS) {
      const b = seeded(() => beasts.krakenForm2(ty)),
        W = beasts.KRAKEN_WATER,
        // 頭の表面からの距離（外が正。体を作ったのと同じ式）
        out = (p: { x: number; y: number; z: number }): number => Math.hypot(p.x, (p.z - H.cz(p.y)) / H.kz) - H.r(p.y);
      for (const p of b) {
        expect(p.y).toBeGreaterThanOrEqual(W - 1e-9);
        expect(p.b).toBeLessThanOrEqual(1.8);
        expect(['body', 'head', 'tent']).toContain(p.part);
      }
      const eyes = b.filter((p) => p.col === K.eye),
        spots = b.filter((p) => p.col === K.spot);
      expect(eyes.length).toBe(2);
      expect(spots.length).toBeGreaterThan(10);
      for (const p of eyes) expect(out(p)).toBeGreaterThan(0.03);
      for (const p of eyes) expect(out(p)).toBeLessThan(0.08);
      for (const p of spots) expect(out(p)).toBeGreaterThan(0.01);
      for (const p of spots) expect(out(p)).toBeLessThan(0.05);
      // 目のまわりは体の点を空けている（目の輪が体の点に隠れない）
      for (const e of eyes)
        for (const p of b.filter((q) => q.part === 'body')) expect(Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z)).toBeGreaterThan(0.1);
      // 腕の6本は、根もとから先へ揺れが大きくなる（piv が 0 から増える）
      const tis = new Set(b.filter((p) => p.part === 'tent').map((p) => p.ti));
      expect(tis).toEqual(new Set([0, 1, 2, 3, 4, 5]));
      for (const ti of tis) expect(Math.min(...b.filter((p) => p.ti === ti).map((p) => p.piv))).toBe(0);
    }
  });
  it('吸血コウモリ：目は頭の表面のすぐ外（埋もれず、浮かない）、目のまわりに毛の点が無い。明るさ b は 1.8 まで。腕と脚の部位は無く（翼が羽ばたく）、翼の点はどれも向きと体からの距離を持つ', () => {
    const B = beasts.BAT;
    for (const ty of TYS) {
      const b = seeded(() => beasts.batForm(ty));
      for (const p of b) {
        expect(p.b).toBeLessThanOrEqual(1.8);
        expect(['body', 'head', 'wing']).toContain(p.part);
      }
      const eyes = b.filter((p) => p.col === B.eye),
        fangs = b.filter((p) => p.col === B.fang);
      expect(eyes.length).toBe(2);
      expect(fangs.length).toBe(2);
      for (const p of eyes) expect(beasts.batOut(B.head, p)).toBeGreaterThan(0.01);
      for (const p of eyes) expect(beasts.batOut(B.head, p)).toBeLessThan(0.04);
      for (const e of eyes)
        for (const p of b.filter((q) => q.part === 'head' && q.col !== B.eye && q.col !== B.fang))
          expect(Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z)).toBeGreaterThan(0.04);
      // 翼：左右とも同じ数。根もとは胴の横（胴の半径のあたり）から、先は胴より十分に外。ただし照準が当たる球（aim.ts の aimPoint：0.42 + 0.35 × scale）の中
      const wing = b.filter((p) => p.part === 'wing'),
        rs = wing.map((p) => p.r ?? NaN);
      expect(wing.filter((p) => p.sd === -1).length).toBe(wing.filter((p) => p.sd === 1).length);
      expect(wing.every((p) => p.sd === -1 || p.sd === 1)).toBe(true);
      expect(Math.min(...rs)).toBeCloseTo(B.body.r[0], 1);
      expect(Math.max(...rs)).toBeGreaterThan(0.7);
      expect(Math.max(...rs)).toBeLessThan(0.42 + 0.35);
    }
  });
  it('眠った獣は、脚を体に畳み、低くなる', () => {
    const spec = nth(SPECS, 0),
      b = seeded(() => lords.beastForm(spec)),
      z = lords.beastSleep(b, { spec });
    expect(z.some((p) => p.part === 'legL' || p.part === 'legR')).toBe(false);
    expect(Math.max(...z.map((p) => p.y))).toBeLessThan(Math.max(...b.map((p) => p.y)));
  });
  it('王の影の一つ目の姿：翼は無く、冠の棘5本・目2つ・黒い太陽（縁・点・印の3つの輪）・体より長い剣・心臓・封印のひび7本。高さは SHADOW_KING_H', () => {
    const b = seeded(lords.shadowKingForm);
    const parts = (name: string) => b.filter((p) => p.part === name);
    expect(b.some((p) => p.part.startsWith('wing'))).toBe(false);
    expect(parts('eye').length).toBe(2);
    expect(parts('head').filter((p) => p.g === G('^')).length).toBe(5); // 冠の棘の先
    const halo = parts('halo');
    expect(halo.length).toBe(64);
    expect(new Set(halo.map((p) => p.r)).size).toBe(3);
    // 黒い太陽の点は、輪の上の初めの位置に置いてある（動きを付けずに形を読む所でも、輪に見える）
    for (const p of halo) {
      expect(p.x).toBeCloseTo(Math.cos(p.ph) * (p.r ?? 0), 6);
      expect(p.y).toBeCloseTo((p.cy ?? 0) + Math.sin(p.ph) * (p.r ?? 0), 6);
    }
    const top = Math.max(...b.map((p) => p.y));
    expect(top).toBeCloseTo(lords.SHADOW_KING_H, 2);
    expect(Math.min(...b.map((p) => p.y))).toBeGreaterThanOrEqual(0);
    expect(parts('heart').length).toBe(9);
    expect(new Set(parts('crack').map((p) => p.th)).size).toBe(7);
    // 形（シルエット）：肩は狭く（幅の半分 0.35 以下）、裾は広い（0.9 以上）。黒い太陽は冠から離れて上にある
    expect(lords.shadowCloakHalf(1.96)).toBeLessThanOrEqual(0.35);
    expect(lords.shadowCloakHalf(0)).toBeGreaterThanOrEqual(0.9);
    const crownTop = Math.max(...parts('head').map((p) => p.y));
    expect(Math.min(...halo.map((p) => p.y))).toBeGreaterThan(crownTop);
    // 剣：右手（向き合うと左）に。体より長く、刃の先は冠の先より上、柄の下の棒は床まで
    const sword = b.filter((p) => p.part === 'body' && Math.abs(p.x + 0.55) < 0.05);
    expect(Math.max(...sword.map((p) => p.y))).toBeGreaterThan(crownTop);
    expect(Math.min(...sword.map((p) => p.y))).toBeLessThan(0.1);
    // 横から見た厚み：前後は左右の8割以上あり、後ろには床を引きずる裾が伸びる（前より後ろへ長い）
    // 厚みは外套そのもので測る（床の裾と黒い太陽は除く）。裾は後ろへ、前の端より 0.3 以上長く伸びる
    const cloak = b.filter((p) => p.part !== 'halo' && p.part !== 'train'),
      zs = cloak.map((p) => p.z),
      xs = cloak.map((p) => p.x),
      train = b.filter((p) => p.part === 'train');
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.8 * (Math.max(...xs) - Math.min(...xs)));
    expect(-Math.min(...train.map((p) => p.z))).toBeGreaterThan(Math.max(...zs) + 0.3);
    // 裾は左右に釣り合っている
    expect(Math.abs(Math.min(...train.map((p) => p.x)) + Math.max(...train.map((p) => p.x)))).toBeLessThan(0.02);
    // 幅は翼が無いので、裾の広がりまで（左右に約1.4以内）
    expect(Math.max(...b.map((p) => Math.abs(p.x)))).toBeLessThan(1.45);
  });
  it('王の影の大きさ：ふだんは SHADOW_KING_SC。天井が低い所だけ、二つの姿とも天井の下に収まるように縮める', () => {
    expect(lords.shadowKingScale(16)).toBe(lords.SHADOW_KING_SC);
    expect(bosses.shadowSerpentScale(lords.SHADOW_KING_SC, 16)).toBe(lords.SHADOW_KING_SC);
    for (const ceil of [5, 6, 7, 7.4]) {
      const k = lords.shadowKingScale(ceil),
        s = bosses.shadowSerpentScale(k, ceil);
      expect(k * lords.SHADOW_KING_H).toBeLessThanOrEqual(ceil - 0.3 + 1e-9);
      expect(s * bosses.SHADOW_SERPENT_H).toBeLessThanOrEqual(ceil - 0.3 + 1e-9);
      expect(s).toBeLessThanOrEqual(k);
    }
    // 7.4 の天井：一つ目は 2.0 倍のまま（7.02）だが、背の高い二つ目は縮める
    expect(lords.shadowKingScale(7.4)).toBe(lords.SHADOW_KING_SC);
    expect(bosses.shadowSerpentScale(lords.SHADOW_KING_SC, 7.4)).toBeLessThan(lords.SHADOW_KING_SC);
  });
  it('王の影の二つ目の姿の高さは SHADOW_SERPENT_H 以内（天井が低い所で、これで大きさを縮める）', () => {
    const b = seeded(bosses.shadowSerpentForm);
    const top = Math.max(...b.map((p) => p.y));
    expect(top).toBeLessThanOrEqual(bosses.SHADOW_SERPENT_H);
    expect(top).toBeGreaterThan(bosses.SHADOW_SERPENT_H - 0.05);
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
