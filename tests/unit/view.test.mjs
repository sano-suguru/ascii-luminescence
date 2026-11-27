// カメラから見て描く・調べる処理の単体テスト：生き物を描く処理（src/lib/bodies/draw.ts）・罠と鉄格子を描く処理（fixtures.ts の drawTraps）・
// 見た時の説明（look.ts）・灯りの揺らぎと灯りを描画に渡す配列（lightmap.ts の flicker・updateLights）・照準（aim.ts）。
// まわりの明かりの頭打ち（lightmap.ts の LIT_MAX・litScale。生き物の体・倒れて崩れた文字・扉が使う）は、倍率そのものと、体の文字1つだけの生き物を火の明かりの強さを変えたマスで描いた色で確かめる。
// 指紋は、view-cases.mjs の場合の結果。動きを意図して変えた時や、場合の入力を変えた時は、変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の画面の部品・偽のカメラ・偽の Web Audio を、本物の型に合わせられないため。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as AIM from '../../src/lib/aim.ts';
import * as DRAW from '../../src/lib/bodies/draw.ts';
import * as FIX from '../../src/lib/fixtures.ts';
import * as LM from '../../src/lib/lightmap.ts';
import * as LOOK from '../../src/lib/look.ts';
import { LIGHT_TYPES, PARTS, lookName, viewCases, viewText } from './view-cases.mjs';
import { caseOut } from './case-out.mjs';
import { G } from '../../src/lib/glyphs.ts';
import { dCol } from '../../src/lib/particles.ts';
import { blaze, buf, gfx, here, player } from '../../src/lib/state.ts';
import { MW, NCELL } from '../../src/lib/world.ts';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const NAMES = [
  'drawMonster',
  'drawMonster1',
  'drawMonster0',
  'drawTentacles',
  'drawTraps',
  'look',
  'flicker',
  'updateLights',
  'aimOrigin',
  'viewDir',
  'hittable',
  'handUp',
  'aimPoint',
  'centerPoint',
  'castPoint',
  'handPoint',
  'drawSwing',
];

describe('まわりの明かりの頭打ち（LIT_MAX）', () => {
  it('litScale は、一番強い色が LIT_MAX 以下なら 1、越えたら一番強い色をちょうど LIT_MAX にする', () => {
    expect(LM.litScale([0, 0, 0])).toBe(1);
    expect(LM.litScale([2, 0.5, 0.1])).toBe(1);
    expect(LM.litScale([-1, 0, 0])).toBe(1);
    for (const l of [
      [10, 4.5, 1.2],
      [0.3, 8, 0.2],
      [3, 3, 3],
    ]) {
      const k = LM.litScale(l);
      expect(Math.max(...l.map((v) => v * k))).toBeCloseTo(LM.LIT_MAX, 10);
    }
  });
  // 体の文字1つだけの生き物を、灯りの無い階のマス (5,5) に置き、そのマスの火の明かり fireLight を変えて描く。体の文字の色（dCol）を返す
  const colorAt = (fl) => {
    const keep = { D: here.D, fireLight: blaze.fireLight, dn: buf.dn, px: player.x, pz: player.z, body: gfx.drawBodyOnly },
      i = 5 * MW + 5;
    try {
      here.D = { cellLI: new Float32Array(NCELL * 3).fill(-1), cellLW: new Float32Array(NCELL * 3), lights: [] };
      blaze.fireLight = new Float32Array(NCELL);
      blaze.fireLight[i] = fl;
      Object.assign(player, { x: 11, z: 6 });
      gfx.drawBodyOnly = true;
      buf.dn = 0;
      const m = {
        ty: { col: [0.5, 0.6, 0.4], scale: 1, form: 'test' },
        form: [{ x: 0, y: 1, z: 0, g: G('%'), s: 0.2, b: 1, part: 'body', ph: 0 }],
        x: 11,
        z: 11,
        y: 0,
        yaw: 0,
        ph: 0,
        walk: 0,
        moving: 0,
        glow: 1,
      };
      DRAW.drawMonster0(m, 0);
      expect(buf.dn).toBe(1);
      return Array.from(dCol.subarray(0, 3));
    } finally {
      here.D = keep.D;
      blaze.fireLight = keep.fireLight;
      buf.dn = keep.dn;
      Object.assign(player, { x: keep.px, z: keep.pz });
      gfx.drawBodyOnly = keep.body;
    }
  };
  it('火の明かりが強さ LIT_MAX を越えても、体の文字はそれより明るくならず、色の比は保つ', () => {
    expect(LM.LIT_MAX).toBe(2);
    // cellLight の火の明かりは、一番強い赤が fireLight の 2.2 倍。赤が LIT_MAX になる fireLight と、その5倍（燃えているマスが固まった所）
    const flCap = LM.LIT_MAX / 2.2,
      none = colorAt(0),
      cap = colorAt(flCap),
      hot = colorAt(flCap * 5),
      below = colorAt(flCap / 2);
    for (let k = 0; k < 3; k++) expect(hot[k]).toBeCloseTo(cap[k], 5);
    // 頭打ちより弱い明かりは、そのまま 0.12 倍を足す（赤は 2.2 倍、緑は 0.99 倍、青は 0.26 倍）
    const add = [2.2, 0.99, 0.26].map((c) => c * (flCap / 2) * 0.12);
    for (let k = 0; k < 3; k++) expect(below[k] - none[k]).toBeCloseTo(add[k], 5);
    // 火の中では、体は橙色に染まる（赤が一番多く足される）
    expect(hot[0] - none[0]).toBeGreaterThan(hot[1] - none[1]);
  });
});

describe('移す前と同じ', () => {
  it('描く・調べる処理（240の場合、17の関数）の指紋', { timeout: 60000 }, async () => {
    const all = await viewCases({ ...AIM, ...DRAW, ...FIX, ...LM, ...LOOK }, 240),
      body = viewText(all),
      calls = all.flatMap((c) => c.calls);
    caseOut('view', body);
    expect([fnv(body), body.length]).toEqual(['5da634c1', 83640607]);
    // 場合が中身を通っているか：17の関数が全部呼ばれ、文字を置き、粒子を出し、どれも止まらない
    expect(new Set(calls.map((c) => c.name))).toEqual(new Set(NAMES));
    expect(calls.filter((c) => c.dn > 0).length).toBeGreaterThan(2000);
    expect(calls.filter((c) => c.pN > 0).length).toBeGreaterThan(50);
    expect(calls.filter((c) => c.threw).length).toBe(0);
    // 見た時の説明：look.ts に書いてある、決まった名前の説明（73 の lookLine のうち、名前が決まった文字の 53）が全部出る（見続けて画面に出た物も、たくさんある）
    const src = readFileSync(join(import.meta.dirname, '../../src/lib/look.ts'), 'utf8'),
      want = [...src.matchAll(/lookLine\(\s*'[^']*',\s*(?:\[[^\]]*\]|[\w.()]+),\s*'([^']+)'/g)].map((m) => m[1]),
      seen = new Set(calls.filter((c) => c.look).map((c) => lookName(c.look[2])));
    expect(want.length).toBe(53);
    expect(want.filter((w) => !seen.has(w))).toEqual([]);
    expect(calls.filter((c) => c.look && c.look[1] && c.look[1] !== 'old').length).toBeGreaterThan(500);
    // 生き物の形の部位：drawMonster0 が動かし方を分ける部位が全部描かれる（'parm' は、どの形も作らない）
    const parts = new Set(calls.flatMap((c) => c.parts));
    expect(PARTS.filter((p) => !parts.has(p))).toEqual(['parm']);
    // 灯りの揺らぎ：全部の種類
    expect(LIGHT_TYPES.filter((t) => !calls.some((c) => c.light === t))).toEqual([]);
  });
});
