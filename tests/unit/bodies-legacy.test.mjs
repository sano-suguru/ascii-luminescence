// 生き物の形（src/lib/bodies/build.ts）・まわりの飾りと王の影の変身（auras.ts）・図鑑の見本の獣（lords.ts の beastSamples）・
// 忘れられた獣の記録（save.ts）の単体テスト。
// 指紋は、形・見た目の特徴・まわりの飾り・獣の記録が、思わず変わっていないかを見る。
// テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio・偽の localStorage を、本物の型に合わせられないため。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as AURAS from '../../src/lib/bodies/auras.ts';
import * as BUILD from '../../src/lib/bodies/build.ts';
import { beastSamples } from '../../src/lib/bodies/lords.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { markHeight } from '../../src/lib/hud.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import * as SAVE from '../../src/lib/save.ts';
import { auraCases, beastRecordCases, formCases, formTypes, lookCases } from './bodies-legacy-cases.mjs';
import { caseOut } from './case-out.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const fp = (s) => [fnv(s), s.length];

// ゲームと同じく、形を作る前に表へ見た目を書き足す。書き足す欄は、終わったら元に戻す（addLooks は2回呼ぶと灯りの色が変わる）
const FIELDS = ['look', 'form', 'trail', 'col', 'lcol'];
let kept = [];
beforeAll(() => {
  kept = Object.entries(MTYPES).map(([k, t]) => [k, FIELDS.map((f) => [f, Object.getOwnPropertyDescriptor(t, f)])]);
  BUILD.addLooks();
});
afterAll(() => {
  for (const [k, fields] of kept)
    for (const [f, d] of fields) {
      const t = MTYPES[k];
      if (!t) continue;
      if (d) Object.defineProperty(t, f, d);
      else Reflect.deleteProperty(t, f);
    }
});

describe('指紋（思わず変わっていないか）', () => {
  it('表に書き足した見た目（全部の種類の look と、機械の形・猟犬の尾と色）', () => {
    const touched = Object.entries(MTYPES).map(([k, t]) => [k, t.look]),
      robots = ['Rc', 'Re', 'Rw'].map((k) => MTYPES[k]?.form),
      hounds = ['Zf', 'Zi', 'Zl'].map((k) => [MTYPES[k]?.trail, MTYPES[k]?.col, MTYPES[k]?.lcol]);
    expect(robots).toEqual(['cleaner', 'repairer', 'watcher']);
    expect(fp(JSON.stringify([touched, robots, hounds]))).toEqual(['1df0d2b2', 612]);
  });
  it('見た目の特徴を直接足す（人型の7つの見た目の枝は、buildForm からは通らない）', () => {
    const all = lookCases(BUILD);
    // 場合が中身を通っているか：人型の見た目ごとに、点の数が違う
    expect(
      new Set(
        all
          .split('\n')
          .slice(0, 7)
          .map((l) => l.split(' ')[1]?.split(':')[1]),
      ).size,
    ).toBe(7);
    caseOut('bodies-legacy-1', all);
    expect(fp(all)).toEqual(['54e8436c', 189]);
  });
  it('図鑑の見本の獣', () => {
    expect(fp(JSON.stringify(beastSamples()))).toEqual(['1039558f', 1402]);
  });
  it('形（表の全部の種類と主、作り直していない主の形と古い形、年代記の獣20と見本、壁の像、王の影。413種類×3つのシード）の指紋', () => {
    const types = formTypes(beastSamples(), 20),
      all = formCases(BUILD, types, 3),
      lines = all.split('\n');
    // 場合が中身を通っているか：ほとんどの種類が違う形になり、飾りを断る形（noExtra）もある
    expect(lines.length).toBe(413);
    expect(new Set(lines.map((l) => l.split(' ')[1]?.split(':')[0])).size).toBeGreaterThan(400);
    expect(lines.some((l) => l.includes(':1 '))).toBe(true);
    caseOut('bodies-legacy-2', all);
    expect(fp(all)).toEqual(['ceadb771', 23527]);
  }, 60000);
  it('まわりの飾り・姿を変える途中・王の影の変身（880の場合）の指紋', () => {
    const all = auraCases({ ...AURAS, buildForm: BUILD.buildForm }, 880),
      cases = all.split('\n').map((l) => JSON.parse(l));
    // 場合が中身を通っているか：どの関数も文字を置くか粒子を出し、覚える物を作る。音も鳴らし、変身は伝言を出す
    const of = (name) => cases.filter((c) => c.name === name);
    const drew = (name) => of(name).some((c) => c.dn > 0),
      spawned = (name) => of(name).some((c) => c.pN[1] > c.pN[0]),
      sounded = (name) => of(name).some((c) => !c.audio.endsWith(':0'));
    expect(
      ['lichAura', 'spiderAura', 'nagaAura', 'dragonAura', 'shadowAura', 'krakenAura', 'houndAura', 'bogAura', 'drawMorph'].filter(
        (n) => !drew(n),
      ),
    ).toEqual([]);
    expect(
      [
        'lichAura',
        'spiderAura',
        'dragonAura',
        'shadowAura',
        'krakenAura',
        'houndAura',
        'salamanderAura',
        'bogAura',
        'transformShadow',
      ].filter((n) => !spawned(n)),
    ).toEqual([]);
    expect(['lichAura', 'nagaAura', 'transformShadow'].filter((n) => !sounded(n))).toEqual([]);
    expect([of('drawMorph').some((c) => c.ret === false), of('transformShadow').every((c) => c.msgs.length === 2 && c.final2)]).toEqual([
      true,
      true,
    ]);
    caseOut('bodies-legacy-3', all);
    expect(fp(all)).toEqual(['6c955afa', 999077]);
  }, 60000);
  it('忘れられた獣の記録（保存の中身10通り×今の探索の記録3通り×保存が使えるか）の指紋', () => {
    const all = beastRecordCases(SAVE),
      cases = all.split('\n').map((l) => JSON.parse(l));
    // 場合が中身を通っているか：書く場合と、書かない場合（同じ獣・配列でない・null が混じる・保存が使えない）がある
    expect([cases.length, cases.some((c) => c.writes.length), cases.some((c) => c.ok && !c.writes.length)]).toEqual([60, true, true]);
    caseOut('bodies-legacy-4', all);
    expect(fp(all)).toEqual(['2f2e58ba', 41342]);
  });
});

describe('頭の上の印', () => {
  // 水から出入りする物（魚・ウナギ・クラーケン）は、描く高さが水の上と下で変わるので除く。主と忘れられた獣は、点の高さの式が違うので除く
  const WATER = new Set(['fish', 'eel', 'kraken']);
  it('表のどの種類も、印（眠っている z・気づいた !・攻撃の溜めの !）が、体の一番上より 0.1 から 0.7 上に出る（体に埋もれず、浮かない）', () => {
    const random = Math.random,
      bad = [];
    let n = 0;
    try {
      for (const [k, ty] of Object.entries(MTYPES)) {
        if (!ty.col || ty.dummy || ty.boss || ty.beast || ty.peaceful || ty.invisible || WATER.has(ty.form)) continue;
        Math.random = mulberry32(1);
        const top = Math.max(...BUILD.buildForm(ty).map((p) => p.y)) * ty.scale,
          gap = markHeight(ty) - top;
        n++;
        if (!(gap >= 0.1 && gap <= 0.7)) bad.push(`${k}（${ty.name}）：体の一番上 ${top.toFixed(2)}、印 ${markHeight(ty).toFixed(2)}`);
      }
    } finally {
      Math.random = random;
    }
    expect(n).toBeGreaterThan(25);
    // MARK_H は見た目（look）と形（form）の行を1つの表に持つので、同じ名前の見た目と形があると、見た目の行が形の行を隠す
    const forms = new Set(Object.values(MTYPES).map((t) => t.form));
    expect(
      Object.values(MTYPES)
        .filter((t) => t.look && t.look !== t.form && forms.has(t.look))
        .map((t) => t.look),
    ).toEqual([]);
    // 外れた種類は、src/lib/hud.ts の MARK_H に、その形（form）か見た目（look）の行を足すか直す
    expect(bad).toEqual([]);
  });
});
