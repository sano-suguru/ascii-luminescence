// 手元の武器（src/lib/hands.ts の形と色の表と VM_FIST、src/lib/held.ts の drawViewWeapons）の単体テスト。
// 指紋は、hands-cases.mjs の場合の結果。動きを意図して変えた時や、場合の入力を変えた時は、
// 変わり方を node tools/case-diff.mjs で確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽のカメラと偽の階を本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import { P, dPos } from '../../src/lib/particles.ts';
import { withVisualRand } from '../../src/lib/random.ts';
import { adv, buf, clock, gear, gfx, here, player, ui, vmKick } from '../../src/lib/state.ts';
import { NCELL, TF } from '../../src/lib/world.ts';
import { drawViewWeapons } from '../../src/lib/held.ts';
import * as H from '../../src/lib/hands.ts';
import * as W from '../../src/lib/held.ts';
import { caseOut } from './case-out.mjs';
import { handsCases } from './hands-cases.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('指紋', () => {
  it('手元の武器の表と描く処理（400の場合）の指紋', { timeout: 60000 }, async () => {
    const body = await handsCases({ ...H, ...W }, 400);
    caseOut('hands', body);
    expect([fnv(body), body.length]).toEqual(['cf4152a3', 4039042]);
    // 場合が中身を通っているか：描かずに戻る・描く・性質の火花が出る
    expect(body).toMatch(/ dn=0 pN=0 /);
    expect(body).toMatch(/ dn=[1-9]\d* pN=0 /);
    expect(body).toMatch(/ dn=[1-9]\d* pN=[1-9]/);
  });
});

describe('性質の火花', () => {
  // 火花が出る所と、描いた文字の一番近い物との距離（世界の中の長さ。目から 0.5 から 1 ほどの所に描く。文字の間は 0.03 ほど）。
  // 武器の種類ごとに、右手・左手（左右を入れ替えた絵）・両手持ち、剣は振っている途中も測る
  const sparkGap = (L, R, opt = {}) => {
    const keep = {
      D: here.D,
      hands: gear.hands,
      castSt: gear.castSt,
      player: { ...player },
      ui: { camMode: ui.camMode, started: ui.started, gallery: ui.gallery },
      dead: adv.dead,
      cam: gfx.camera,
      time: clock.time,
      kick: { ...vmKick },
      buf: { ...buf },
    };
    try {
      here.D = { tile: new Uint8Array(NCELL).fill(TF), doorAt: new Int16Array(NCELL).fill(-1), doors: [] };
      Object.assign(player, { x: 50, z: 50, yaw: 0, pitch: 0, eye: 1.6, vx: 0, vz: 0, swing: opt.swing ?? 0, swingH: opt.swingH });
      gfx.camera = { position: { x: 50, y: 1.6, z: 50, set: () => undefined }, rotation: { set: () => undefined }, aspect: 16 / 9 };
      Object.assign(ui, { camMode: 'fps', started: true, gallery: null });
      adv.dead = false;
      clock.time = 10;
      vmKick.L = vmKick.R = -9;
      const hand = (w) => ({ atk: w, slots: [null, null], slotN: 2, turn: 0, elem: { uid: 0, type: 'fire' }, trig: null });
      gear.hands = { L: hand(L), R: hand(R), B: { b0: null, b1: null } };
      gear.castSt = null;
      buf.dn = 0;
      buf.pN = 0;
      // 見た目の乱数が 0 なら、火花は必ず出る（手ごとに1つ）
      withVisualRand(
        () => 0,
        () => drawViewWeapons(10),
      );
      const glyphs = Array.from({ length: buf.dn }, (_, i) => [dPos[i * 3], dPos[i * 3 + 1], dPos[i * 3 + 2]]);
      return Array.from({ length: buf.pN }, (_, k) =>
        Math.min(...glyphs.map((g) => Math.hypot(g[0] - P.x[k], g[1] - P.y[k], g[2] - P.z[k]))),
      );
    } finally {
      Object.assign(here, { D: keep.D });
      Object.assign(gear, { hands: keep.hands, castSt: keep.castSt });
      Object.assign(player, keep.player);
      Object.assign(ui, keep.ui);
      adv.dead = keep.dead;
      gfx.camera = keep.cam;
      clock.time = keep.time;
      Object.assign(vmKick, keep.kick);
      Object.assign(buf, keep.buf);
    }
  };
  // 近いと言える距離：0.04（直す前は、剣・弓・弩・素手の火花が 0.23 から 0.44 離れていた）。大杖は、三日月の形の頭の真ん中（文字の無い所。文字から 0.1）から出す
  const near = (l, r) => (l === 'mstaff' || r === 'mstaff' ? 0.11 : 0.04);
  const PAIRS = Object.keys(H.VM_MODELS).flatMap((w) =>
    H.VM_MODELS[w].two
      ? [[w, w]]
      : [
          [w, 'blade'],
          ['blade', w],
        ],
  );
  it.each(PAIRS)('%s と %s を持つと、どちらの手の火花も武器の先の文字のそばから出る', (l, r) => {
    const L = { uid: 1, type: l },
      R = l === r ? L : { uid: 2, type: r };
    const gaps = sparkGap(L, R);
    expect(gaps.length).toBe(H.VM_MODELS[l].two ? 1 : 2);
    for (const g of gaps) expect(g).toBeLessThan(near(l, r));
  });
  it.each([0.2, 0.11, 0.01])('剣を振っている途中（swing %s）も、火花は刃先から出る', (swing) => {
    for (const w of ['blade', 'dash', 'gsword']) {
      const L = { uid: 1, type: w === 'gsword' ? w : 'bolt' },
        R = w === 'gsword' ? L : { uid: 2, type: w };
      if (w !== 'gsword') L.type = 'orb';
      for (const g of sparkGap(L, R, { swing, swingH: 'R' })) expect(g).toBeLessThan(0.04);
    }
  });
});
