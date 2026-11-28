// 凍る見た目の決まり：凍えた生き物の足元の氷の輪（src/lib/bodies/draw.ts の drawChillRing）と体の霜の色（frostK・frostCol）、
// 冷えを付ける処理（src/lib/ground.ts の chillMob）、凍らせた水の氷の文字とひび（src/lib/fx.ts の drawFrozen・iceCrackKey）。
// 置いた文字は、置いた文字の配列（src/lib/particles.ts の dPar）から読む。
// テストを .mjs で書くのは、描く処理に渡す生き物を、要る欄だけの小さな物にするため（型に合わせると as が要る）。
import { beforeEach, describe, expect, it } from 'vitest';
import { CHILL_RING, FROST_COL, FROST_FADE, FROST_TINT, drawChillRing, frostCol, frostK } from '../../src/lib/bodies/draw.ts';
import { ICE_CRACK, ICE_N, drawFrozen, iceCrackKey } from '../../src/lib/fx.ts';
import { G } from '../../src/lib/glyphs.ts';
import { chillMob } from '../../src/lib/ground.ts';
import { dPar, dPos } from '../../src/lib/particles.ts';
import { blaze, buf, here, player } from '../../src/lib/state.ts';
import { MW, NCELL, SF_FOLIAGE } from '../../src/lib/world.ts';

/** 今までに置いた文字の番号の並び */
const placed = () => Array.from({ length: buf.dn }, (_, k) => dPar[k * 4]);
const count = (g) => placed().filter((v) => v === G(g)).length;
const mob = (st, more = {}) => ({ x: 10, z: 10, y: 0, cx: 5, cz: 5, ty: { scale: 1 }, st, ...more });

beforeEach(() => {
  buf.dn = 0;
  player.x = 12;
  player.z = 10;
  // 茂みかを読む小さな階（床だけ。茂みのテストで1マスを茂みにする）
  here.D = { surface: new Uint8Array(NCELL), liquid: new Uint8Array(NCELL) };
  blaze.cellFlag = new Uint8Array(NCELL);
  blaze.burnt = new Uint8Array(NCELL);
});

describe('冷えを付ける（chillMob）', () => {
  it('今の残りより長い時だけ、残りと輪の分母を書き直す', () => {
    const st = {};
    chillMob(st, 2.5);
    expect(st).toEqual({ chill: 2.5, chillFull: 2.5 });
    st.chill = 1;
    chillMob(st, 0.8); // 短い：変えない
    expect(st).toEqual({ chill: 1, chillFull: 2.5 });
    chillMob(st, 4);
    expect(st).toEqual({ chill: 4, chillFull: 4 });
  });
});

describe('凍えた生き物の足元の氷の輪（drawChillRing）', () => {
  it('明るい * の数は、残りの割合の分だけ（切り上げ）。残りは暗い . で、輪の文字は全部で CHILL_RING', () => {
    for (const [ch, full, lit] of [
      [2.5, 2.5, 12],
      [1.25, 2.5, 6],
      [1.26, 2.5, 7],
      [0.01, 2.5, 1],
      [3, 4, 9],
    ]) {
      buf.dn = 0;
      expect(drawChillRing(mob({ chill: ch, chillFull: full }), 0)).toBe(lit);
      expect(count('*')).toBe(lit);
      expect(count('.')).toBe(CHILL_RING - lit);
    }
  });
  it('時間がたつと、明るい * は1つずつ減り、増えない', () => {
    const st = { chill: 2.5, chillFull: 2.5 };
    let prev = CHILL_RING;
    for (let t = 0; st.chill > 0; t += 0.1, st.chill -= 0.1) {
      const lit = drawChillRing(mob(st), t);
      expect(lit).toBeLessThanOrEqual(prev);
      expect(prev - lit).toBeLessThanOrEqual(1);
      prev = lit;
    }
    expect(prev).toBe(1);
  });
  it('凍えていない・倒れた・化けている・見えない生き物には、何も置かない', () => {
    for (const m of [
      mob({}),
      mob({ chill: 0, chillFull: 2 }),
      mob({ chill: -0.03, chillFull: 2 }),
      mob(null),
      mob({ chill: 2, chillFull: 2 }, { dead: true }),
      mob({ chill: 2, chillFull: 2 }, { hidden: true }),
      mob({ chill: 2, chillFull: 2 }, { ty: { scale: 1, invisible: true } }),
    ]) {
      expect(drawChillRing(m, 0)).toBe(0);
      expect(buf.dn).toBe(0);
    }
  });
  it('体が描かれない所（遠い・潜ったうなぎ・沈んだ沼の物・遠い茂みの中）では置かず、姿を見せれば置く', () => {
    const st = () => ({ chill: 2, chillFull: 2 });
    expect(drawChillRing(mob(st(), { x: 60 }), 0)).toBe(0);
    expect(drawChillRing(mob(st(), { ty: { scale: 1, form: 'eel' }, surf: 0 }), 0)).toBe(0);
    expect(drawChillRing(mob(st(), { ty: { scale: 1, habitat: 'bog' }, rise: 0.1 }), 0)).toBe(0);
    here.D.surface[5 * MW + 5] = SF_FOLIAGE;
    player.x = 15; // 茂みから 5
    expect(drawChillRing(mob(st()), 0)).toBe(0);
    expect(buf.dn).toBe(0);
    player.x = 12; // 茂みから 2：見える
    expect(drawChillRing(mob(st()), 0)).toBe(CHILL_RING);
    here.D.surface[5 * MW + 5] = 0;
    expect(drawChillRing(mob(st(), { ty: { scale: 1, form: 'eel' }, surf: 0.5 }), 0)).toBe(CHILL_RING);
    expect(drawChillRing(mob(st(), { ty: { scale: 1, habitat: 'bog' }, rise: 0.5 }), 0)).toBe(CHILL_RING);
  });
  it('輪は床に寝かせ、体の大きさに合わせて広がる', () => {
    const r = (scale) => {
      buf.dn = 0;
      drawChillRing(mob({ chill: 1, chillFull: 1 }, { ty: { scale } }), 0);
      expect(placed().every((_, k) => dPar[k * 4 + 2] === 1)).toBe(true);
      return Math.hypot(dPos[0] - 10, dPos[2] - 10);
    };
    expect(r(2)).toBeGreaterThan(r(0.8) + 0.5);
  });
});

describe('凍えた体の霜の色（frostK・frostCol）', () => {
  it('凍えていなければ 0、残りが FROST_FADE 秒より長ければ FROST_TINT、短くなると 0 へ下がる', () => {
    expect(frostK(mob({}))).toBe(0);
    expect(frostK(mob({ chill: 0 }))).toBe(0);
    expect(frostK(mob({ chill: 2 }, { dead: true }))).toBe(0);
    expect(frostK(mob({ chill: FROST_FADE * 2 }))).toBe(FROST_TINT);
    expect(frostK(mob({ chill: FROST_FADE / 2 }))).toBeCloseTo(FROST_TINT / 2);
  });
  it('寄せても明るさ（3つの平均）は変わらず、青が一番強くなっていく', () => {
    for (const c of [
      [0.4, 0.9, 0.3],
      [1.2, 0.5, 0.3],
      [0.7, 0.7, 0.7],
    ]) {
      const avg = (v) => (v[0] + v[1] + v[2]) / 3;
      expect(avg(frostCol(c, FROST_TINT))).toBeCloseTo(avg(c));
      const full = frostCol(c, 1);
      expect(full[2] / full[0]).toBeCloseTo(FROST_COL[2] / FROST_COL[0]);
      expect(frostCol(c, 0)).toEqual(c);
    }
  });
});

describe('凍らせた水（drawFrozen・iceCrackKey）', () => {
  // 2×2 マスの凍らせた水（左上のマスの番号 i0）
  const i0 = 20 * MW + 20,
    block = [i0, i0 + 1, i0 + MW, i0 + MW + 1];
  const freeze = (t) => {
    blaze.frozen = new Map(block.map((i) => [i, { t, liq: 1, surf: 0 }]));
    player.x = 41;
    player.z = 41;
  };
  const cracks = () => count('/') + count('\\');
  it('1マスに ICE_N×ICE_N の文字を床に寝かせて置き、水と同じ = は使わない', () => {
    freeze(25);
    drawFrozen(0);
    expect(buf.dn).toBe(block.length * ICE_N * ICE_N);
    expect(count('=')).toBe(0);
    expect(count('#') + count('+')).toBe(buf.dn);
    expect(placed().every((_, k) => dPar[k * 4 + 2] === 1)).toBe(true);
  });
  it('残りが ICE_CRACK 秒より長い間は、ひびが無い', () => {
    for (const t of [25, 15, ICE_CRACK]) {
      buf.dn = 0;
      freeze(t);
      drawFrozen(0);
      expect(cracks()).toBe(0);
    }
  });
  it('ひびの割合は 1 から 残り/ICE_CRACK を引いた物ほどで、残りが減るほど増え、縁の側から入る', () => {
    const N = 2 * ICE_N,
      edge = 4 * N - 4; // 2×2 マスの外周の文字
    let prev = 0;
    for (const t of [9, 7.5, 6, 5, 4, 2, 1, 0.01]) {
      buf.dn = 0;
      freeze(t);
      drawFrozen(0);
      const n = cracks(),
        want = (1 - t / ICE_CRACK) * N * N;
      expect(n).toBeGreaterThanOrEqual(prev);
      expect(Math.abs(n - want)).toBeLessThanOrEqual(N * N * 0.2);
      // 半分より前は外周の文字だけ、半分ちょうどで外周の文字が全部ひびになる
      if (t >= 5) expect(n).toBeLessThanOrEqual(edge);
      if (t === 5) expect(n).toBe(edge);
      prev = n;
    }
    expect(prev).toBe(N * N);
  });
  it('ひびの順番の鍵：凍っていないマスに接する辺の文字は 0.5 より小さく、内の文字は 0.5 以上', () => {
    freeze(25);
    for (const i of block)
      for (let a = 0; a < ICE_N; a++)
        for (let b = 0; b < ICE_N; b++) {
          const x = (i % MW) - 20,
            z = Math.floor(i / MW) - 20,
            outer = (x === 0 && a === 0) || (x === 1 && a === ICE_N - 1) || (z === 0 && b === 0) || (z === 1 && b === ICE_N - 1),
            k = iceCrackKey(i, a, b);
          expect(k).toBeGreaterThanOrEqual(0);
          expect(k).toBeLessThan(1);
          expect(k < 0.5).toBe(outer);
        }
  });
  it('行の端のマスの横は、隣の行に凍ったマスがあっても、縁と見る', () => {
    const left = 21 * MW,
      prevEnd = left - 1; // 前の行の右の端
    blaze.frozen = new Map([left, prevEnd].map((i) => [i, { t: 25, liq: 1, surf: 0 }]));
    expect(iceCrackKey(left, 0, 1)).toBeLessThan(0.5);
    expect(iceCrackKey(prevEnd, ICE_N - 1, 1)).toBeLessThan(0.5);
  });
  it('30 より遠いマスは描かない', () => {
    freeze(25);
    player.x = 41 + 40;
    drawFrozen(0);
    expect(buf.dn).toBe(0);
  });
});
