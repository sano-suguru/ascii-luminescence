// 手元の武器を描く（もとは src/game/19-hands-runes.js の drawViewWeapons）。形と色の表は src/lib/hands.ts。
// src/lib/loop.ts の tick の 'hands' の段から、毎フレーム呼ばれる（性質の火花は、その段の見た目の乱数 mr を引く）。
import { must, nth } from './array.ts';
import { aimOrigin, doorBlock, handUp } from './aim.ts';
import type { Color } from './color.ts';
import { type Side, isTwo } from './gear.ts';
import { G } from './glyphs.ts';
import {
  type V3,
  VM_BRIGHT,
  VM_FIST,
  VM_MIRROR,
  VM_MODELS,
  VM_PART,
  VM_REST,
  VM_REST_HOT,
  VM_ST,
  VM_TINT,
  vmGlyphS,
  type Pt,
} from './hands.ts';
import { dyn, spawn } from './particles.ts';
import { mr } from './random.ts';
import { clamp } from './rng.ts';
import { elemCol } from './runes.ts';
import { adv, clock, gear, gfx, here, player, ui, vmKick } from './state.ts';
import { CELL, MW, NCELL, TW, TX } from './world.ts';

/** 手元の武器を描く（1人称で、探索中だけ。t はゲームの時刻） */
export function drawViewWeapons(t: number): void {
  if (!ui.started || adv.dead || !gear.hands || !here.D) return;
  if (ui.gallery && ui.gallery.mode === 'beast') return;
  const [f, r, u] = handUp(),
    [ex, ey, ez] = aimOrigin();
  let dw = 0.62;
  for (const side of [-0.3, 0, 0.3])
    for (let st = 0.05; st <= 0.62; st += 0.04) {
      const x = ex + f[0] * st + r[0] * side,
        z = ez + f[2] * st + r[2] * side,
        ci = Math.floor(z / CELL) * MW + Math.floor(x / CELL);
      if (ci < 0 || ci >= NCELL || here.D.tile[ci] === TW || here.D.tile[ci] === TX || doorBlock(ci)) {
        dw = Math.min(dw, st - 0.07);
        break;
      }
    }
  const q = clamp(dw / 0.62, 0.3, 1),
    spd = Math.hypot(player.vx || 0, player.vz || 0),
    bob = Math.sin(clock.time * 9) * 0.007 * Math.min(1, spd / 4),
    sway = Math.cos(clock.time * 4.5) * 0.004 * Math.min(1, spd / 4),
    two = isTwo();
  const kx = Math.min(1, (gfx.camera.aspect || 1.78) / (16 / 9)),
    W = (x: number, y: number, z: number): V3 => {
      x *= kx;
      return [ex + (f[0] * z + r[0] * x + u[0] * y) * q, ey + (f[1] * z + u[1] * y) * q, ez + (f[2] * z + r[2] * x + u[2] * y) * q];
    };
  const one = (h: Side, type: string, mirror: boolean): void => {
    const M = must(VM_MODELS[type] || VM_MODELS['bare'], '手元の武器の形');
    const H = must(gear.hands, '両手')[h],
      el = H.elem ? H.elem.type : null,
      ec = must(elemCol(el), '性質の色');
    const chant = gear.castSt && (gear.castSt.h === h || two) ? Math.min(1, gear.castSt.t / Math.max(0.01, gear.castSt.need)) : 0,
      hold = gear.castSt && (gear.castSt.h === h || two) && gear.castSt.full ? Math.min(1, gear.castSt.hold / 2) : 0;
    const swingP = (player.swing ?? NaN) > 0 && (player.swingH === h || two) ? 1 - (player.swing ?? NaN) / 0.22 : -1,
      kick = Math.max(0, 1 - (clock.time - (vmKick[h] || -9)) / 0.16);
    let th = 0,
      dx = sway,
      dy = bob,
      dz = 0,
      glow = 1;
    const act = Math.max(chant, hold, swingP >= 0 ? 1 : 0, kick),
      calm = VM_REST + (1 - VM_REST) * act,
      calmHot = VM_REST_HOT + (1 - VM_REST_HOT) * act;
    if (M.kind === 'sword') {
      if (swingP >= 0) {
        th = M.thrust ? 0.15 - 0.3 * swingP : 0.9 - 2.2 * swingP;
        dz = Math.sin(swingP * Math.PI) * (M.thrust ? 0.2 : 0.08);
        dy += Math.sin(swingP * Math.PI) * 0.04;
      }
      if (two && gear.castSt && gear.castSt.h === 'R') {
        th = 0.55 * chant;
        dy += 0.06 * chant;
      }
      dz += kick * 0.04;
    } else if (M.kind === 'bow') {
      dz -= kick * 0.03;
    } else if (M.kind === 'xbow') {
      dx -= 0.05 * chant;
      dy += 0.03 * chant;
      dz -= kick * 0.04;
    } else if (M.kind === 'staff') {
      dy += 0.05 * chant + 0.03 * hold;
      dz += kick * 0.04;
      glow = 1 + 2 * chant + kick + 1.5 * hold;
    } else {
      dy += 0.04 * chant;
      dz += 0.05 * chant + kick * 0.04;
      glow = 1 + chant;
    }
    const pv = M.pivot,
      cs = Math.cos(th),
      sn = Math.sin(th);
    // 形の点を、振る・突く時の回り（軸 pv のまわりに th）・揺れと動き（dx dy dz）・左右の入れ替えを通して、世界の中の点にする
    const place = (x: number, y: number, z: number): V3 => {
      const lx = x - nth(pv, 0),
        ly = y - nth(pv, 1);
      const rx = lx * cs - ly * sn + nth(pv, 0),
        ry = lx * sn + ly * cs + nth(pv, 1);
      return W(mirror ? -(rx + dx) : rx + dx, ry + dy, z + dz);
    };
    const put = (x: number, y: number, z: number, g: string, part: string, sz: number, bri?: number): V3 => {
      if (mirror) g = VM_MIRROR[g] || g;
      const base: Color = VM_PART[part] || [0.8, 0.8, 0.8],
        tk = el ? VM_TINT[part] || 0 : 0,
        bb =
          (VM_BRIGHT[part] || 1) *
          (bri || 1) *
          (part === 'head' || part === 'glow' ? glow : 1) *
          (part === 'edge' && swingP >= 0 ? 1.7 : 1) *
          (part === 'head' || part === 'glow' || part === 'edge' ? calmHot : calm);
      const p = place(x, y, z);
      dyn(
        p[0],
        p[1],
        p[2],
        G(g),
        sz * q,
        (base[0] * (1 - tk) + nth(ec, 0) * tk) * bb,
        (base[1] * (1 - tk) + nth(ec, 1) * tk) * bb,
        (base[2] * (1 - tk) + nth(ec, 2) * tk) * bb,
      );
      return p;
    };
    for (const p of M.pts) put(p[0], p[1], p[2], p[3], p[4], p[5]);
    if (M.kind === 'bow') {
      const pull = chant,
        mid: V3 = [
          M.rest[0] + (M.draw[0] - M.rest[0]) * pull,
          M.rest[1] + (M.draw[1] - M.rest[1]) * pull,
          M.rest[2] + (M.draw[2] - M.rest[2]) * pull,
        ];
      for (const end of [M.top, M.bot]) {
        const n = Math.max(5, Math.round(Math.hypot(end[0] - mid[0], end[1] - mid[1], end[2] - mid[2]) / 0.05));
        for (let i = 1; i < n; i++) {
          const k = i / n;
          put(
            end[0] + (mid[0] - end[0]) * k,
            end[1] + (mid[1] - end[1]) * k,
            end[2] + (mid[2] - end[2]) * k,
            vmGlyphS(end, mid),
            'string',
            0.035,
          );
        }
      }
      if (pull > 0.05) {
        const o: Pt[] = [];
        VM_FIST(o, mid);
        for (const p of o) put(p[0], p[1], p[2], p[3], p[4], p[5], 0.9);
        const TV = Math.tan((37 * Math.PI) / 180),
          tz = 1.0,
          tip: V3 = [-0.06 * TV * (16 / 9) * tz, -0.08 * TV * tz, tz],
          n = Math.round(Math.hypot(tip[0] - mid[0], tip[1] - mid[1], tip[2] - mid[2]) / 0.05);
        for (let i = 1; i <= n; i++) {
          const k = i / n;
          put(
            mid[0] + (tip[0] - mid[0]) * k,
            mid[1] + (tip[1] - mid[1]) * k,
            mid[2] + (tip[2] - mid[2]) * k,
            i === n ? '^' : vmGlyphS(mid, tip),
            'glow',
            0.05,
            0.8,
          );
        }
      }
    }
    if (M.orbit)
      for (let i = 0; i < 3; i++) {
        const a = t * 2.5 + i * 2.09;
        put(
          nth(must(M.head, '杖の頭'), 0) + Math.cos(a) * 0.07,
          nth(must(M.head, '杖の頭'), 1) + Math.sin(a) * 0.07,
          nth(must(M.head, '杖の頭'), 2),
          '+',
          'glow',
          VM_ST * 1.4,
        );
      }
    if (el && mr() < 0.08 * (1 + chant * 3)) {
      // 火花は、武器の先（剣の刃先・弓の握り・弩の矢の先・杖の頭・素手の指先）から、文字と同じ回りと動きで出す
      const p = place(nth(M.tip, 0), nth(M.tip, 1), nth(M.tip, 2)),
        g2 = el === 'fire' ? '^' : el === 'ice' ? '*' : el === 'thunder' ? '/' : '%';
      spawn(
        p[0],
        p[1],
        p[2],
        (mr() - 0.5) * 0.15,
        0.15 + mr() * 0.2,
        (mr() - 0.5) * 0.15,
        0.35,
        G(g2),
        0.03 * q,
        nth(ec, 0) * 2.2,
        nth(ec, 1) * 2.2,
        nth(ec, 2) * 2.2,
        0,
      );
    }
  };
  if (two) {
    const w = gear.hands.R.atk;
    if (w) one('R', w.type, false);
    return;
  }
  for (const h of ['L', 'R'] as const) {
    const w = gear.hands[h].atk;
    one(h, w ? w.type : 'bare', h === 'L');
  }
}
