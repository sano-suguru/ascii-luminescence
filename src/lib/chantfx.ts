// 詠唱の見た目（simPath・drawCastFx・updateCross）：溜めている手の前の円（性質のルーンと点が回り、詠唱の声の音節で光る）、
// 手へ集まる光、術が飛ぶ道（まっすぐか弧。跳ね返りも）と落ちる所、道の先の生き物を挟む括弧、照準の文字（溜めると性質のルーンが寄り、生き物を捉えると ‹·› になる）と、
// 詠唱している間に画面をゆっくりにする見た目。
// 状態の入れ物 gear（溜めている手）・here（今の階と生き物）・player・ui・vfx・gfx（後処理の uniform）・clock に頼る。
// 呼ぶのは src/lib/loop.ts の tick（段 'castfx' で drawCastFx、段 'cross' で updateCross）。照準の文字は #cross（src/lib/boot.ts の boot が ui.crossEl に入れる）に書く。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う見た目になるので、順番を変えないこと。
import { lookup, must, nth } from './array.ts';
import { aimOrigin, aimTarget, beamFrame, castPoint, handUp, reflectDir, shotFrame } from './aim.ts';
import { cssOf } from './color.ts';
import { type Spec, specOf } from './gear.ts';
import { G } from './glyphs.ts';
import { foe } from './monsters.ts';
import { dyn, spawn } from './particles.ts';
import { mpick, mr } from './random.ts';
import { RUNE_DEF, elemCol } from './runes.ts';
import { type Mob, adv, clock, gear, gfx, here, player, ui, vfx } from './state.ts';
import { isPaused } from './status.ts';
import { CELL, MW, NCELL, TC, TW, TX } from './world.ts';

type V3 = [number, number, number];
/** 今の階 */
const level = () => must(here.D, '今の階 here.D');
/** 両手 */
const hands = () => must(gear.hands, '両手 gear.hands');
/** 後処理（画面の明るさなどの uniform） */
const finalPass = () => must(gfx.finalPass, '後処理 gfx.finalPass');

/** 術が飛ぶ道：通る点 pts（玉は弧の3歩ごと、ほかは0.3ごと）、行き着く所 end、道の先の生き物 hitM、玉か orb */
export interface CastPath {
  pts: V3[];
  end: V3;
  hitM: Mob | null;
  orb?: boolean;
}

// where the spell will go: straight (arrows, beams) or an arc (orbs), with bounces; the first creature in the way
/** 術が飛ぶ道を、放つ前に先に辿る（玉は重さのある弧、ほかはまっすぐ。壁・床・天井で跳ね返りの数だけ跳ね返る。見えている敵に当たると止まる） */
export function simPath(sp: Spec): CastPath {
  const fr = sp.atk === 'beam' ? beamFrame(sp.h) : shotFrame(sp.h, true, sp.atk),
    [ox, oy, oz] = fr.o,
    d0 = fr.d,
    pts: V3[] = [];
  let hitM: Mob | null = null;
  if (sp.atk === 'orb') {
    let x = ox,
      y = oy,
      z = oz,
      vx = d0[0] * 12,
      vy = d0[1] * 12 + 2.6,
      vz = d0[2] * 12,
      b = sp.aff.bounce || 0;
    for (let s = 0; s < 160; s++) {
      const dt = 0.025;
      vy -= 9.8 * dt;
      const nx = x + vx * dt,
        ny = y + vy * dt,
        nz = z + vz * dt,
        ci = Math.floor(nz / CELL) * MW + Math.floor(nx / CELL);
      if (ci < 0 || ci >= NCELL) break;
      if (s % 3 === 0) pts.push([x, y, z]);
      for (const m of here.monsters) {
        if (!foe(m) || !m.visible) continue;
        if (Math.hypot(m.x - nx, m.y + 0.6 * m.ty.scale - ny, m.z - nz) < 0.42 + 0.35 * m.ty.scale) {
          hitM = m;
          break;
        }
      }
      if (hitM) {
        x = nx;
        y = ny;
        z = nz;
        break;
      }
      const wall = level().tile[ci] === TW || level().tile[ci] === TX,
        fl = ny < 0.03 && level().tile[ci] !== TC,
        ce = ny > (level().ceil[ci] ?? NaN);
      if (wall || fl || ce) {
        if (b > 0) {
          b--;
          const v = Math.hypot(vx, vy, vz) || 1,
            r = reflectDir(x, y, z, [vx / v, vy / v, vz / v]);
          vx = r[0] * v;
          vy = r[1] * v * 0.7;
          vz = r[2] * v;
          if (fl) vy = Math.abs(vy) + 1;
          continue;
        }
        break;
      }
      x = nx;
      y = ny;
      z = nz;
    }
    return { pts, end: [x, Math.max(0.05, y), z], hitM, orb: true };
  }
  let x = ox,
    y = oy,
    z = oz,
    d: number[] = d0.slice(),
    b = sp.aff.bounce || 0,
    left = sp.atk === 'beam' ? 12 : 26;
  while (left > 0) {
    const nx = x + nth(d, 0) * 0.3,
      ny = y + nth(d, 1) * 0.3,
      nz = z + nth(d, 2) * 0.3,
      ci = Math.floor(nz / CELL) * MW + Math.floor(nx / CELL);
    left -= 0.3;
    if (ci < 0 || ci >= NCELL) break;
    for (const m of here.monsters) {
      if (!foe(m) || !m.visible) continue;
      if (Math.hypot(m.x - nx, m.y + 0.6 * m.ty.scale - ny, m.z - nz) < 0.42 + 0.35 * m.ty.scale) {
        hitM = m;
        break;
      }
    }
    if (hitM) {
      x = nx;
      y = ny;
      z = nz;
      break;
    }
    const wall = level().tile[ci] === TW || level().tile[ci] === TX || ny < 0.02 || ny > (level().ceil[ci] ?? NaN);
    if (wall) {
      if (b > 0) {
        b--;
        d = reflectDir(x, y, z, d);
        pts.push([x, y, z]);
        continue;
      }
      break;
    }
    x = nx;
    y = ny;
    z = nz;
    pts.push([x, y, z]);
  }
  return { pts, end: [x, y, z], hitM };
}

/** 詠唱の見た目（毎フレーム）：手の前の円・手へ集まる光と、玉・光線・矢なら、飛ぶ道・落ちる所の輪・行き着く所の印・道の先の生き物を挟む括弧 */
export function drawCastFx(t: number): void {
  if (!gear.hands) return;
  if (!gear.castSt) {
    if (ui.crossMon && ui.crossMon.dead) ui.crossMon = null;
    return;
  }
  const sp = specOf(gear.castSt.h),
    c = must(elemCol(sp.elem), '性質の色'),
    k = Math.min(1, gear.castSt.t / Math.max(0.01, gear.castSt.need)),
    full = gear.castSt.full;
  // the circle at the hand
  const P = castPoint(gear.castSt.h, k),
    [, r, u] = handUp(),
    H = gear.hands[gear.castSt.h],
    rs = [H.elem].filter(Boolean).map((ru) => must(lookup(RUNE_DEF, must(ru, '手の性質のルーン').type).ch, 'ルーンの文字')),
    n = 12,
    rr = 0.05 + 0.03 * k,
    spin = t * (full ? 5 : 2);
  for (let j = 0; j < n; j++) {
    const a = spin + (j / n) * Math.PI * 2,
      ch = j % 3 === 0 && rs.length ? nth(rs, ((j / 3) | 0) % rs.length) : '.',
      lit =
        j % 3 === 0 &&
        gear.castSt.sylT !== undefined &&
        clock.time - gear.castSt.sylT < 0.16 &&
        ((j / 3) | 0) === (gear.castSt.syl ?? NaN) % 4,
      br = (0.8 + 2.4 * k) * (full ? 1.25 + 0.25 * Math.sin(t * 12) : 1) * (lit ? 2.2 : 1);
    dyn(
      P[0] + (r[0] * Math.cos(a) + u[0] * Math.sin(a)) * rr,
      P[1] + u[1] * Math.sin(a) * rr,
      P[2] + (r[2] * Math.cos(a) + u[2] * Math.sin(a)) * rr,
      G(ch),
      ch === '.' ? 0.02 : 0.032 + 0.014 * k,
      nth(c, 0) * br,
      nth(c, 1) * br,
      nth(c, 2) * br,
    );
  }
  // light gathers toward the hand
  if (mr() < 0.5 + 0.4 * k) {
    const a = mr() * 6.28,
      e = (mr() - 0.3) * 1.2,
      d = 1.4 + mr() * 0.8,
      sx = player.x + Math.cos(a) * d,
      sz = player.z + Math.sin(a) * d,
      sy = P[1] + e;
    spawn(
      sx,
      sy,
      sz,
      (P[0] - sx) / 0.45,
      (P[1] - sy) / 0.45,
      (P[2] - sz) / 0.45,
      0.42,
      G(mpick(['.', "'", '*'])),
      0.06,
      nth(c, 0) * 2,
      nth(c, 1) * 2,
      nth(c, 2) * 2,
      0,
    );
  }
  // the path, the landing, the target
  if (sp.atk === 'blade' || sp.atk === 'bare') return;
  const path = simPath(sp),
    dim = 0.35 + 0.65 * k;
  const [aox, aoy, aoz] = aimOrigin();
  path.pts.forEach((p, j) => {
    if (j % 2 || Math.hypot(p[0] - aox, p[1] - aoy, p[2] - aoz) < 1.6) return;
    const fade = dim * (1 - (j / Math.max(1, path.pts.length)) * 0.5);
    dyn(
      p[0],
      p[1],
      p[2],
      G(path.orb ? 'o' : '-'),
      path.orb ? 0.11 : 0.12,
      nth(c, 0) * 2.4 * fade,
      nth(c, 1) * 2.4 * fade,
      nth(c, 2) * 2.4 * fade,
    );
  });
  const e = path.end;
  if (path.orb) {
    const R = 1.7 * (1 + (sp.aff.area || 0) / 100);
    for (let j = 0; j < 18; j++) {
      const a = (j / 18) * Math.PI * 2 + t * 0.6;
      dyn(
        e[0] + Math.cos(a) * R,
        0.12,
        e[2] + Math.sin(a) * R,
        G(j % 3 ? '.' : '+'),
        0.24,
        nth(c, 0) * 2.6 * dim,
        nth(c, 1) * 2.6 * dim,
        nth(c, 2) * 2.6 * dim,
      );
    }
  }
  dyn(e[0], e[1], e[2], G('x'), 0.26, nth(c, 0) * 3 * dim, nth(c, 1) * 3 * dim, nth(c, 2) * 3 * dim);
  const m = path.hitM;
  if (m) {
    const cy = m.y + 0.6 * m.ty.scale,
      w = 0.35 * m.ty.scale + 0.25;
    dyn(m.x - r[0] * w, cy, m.z - r[2] * w, G('['), 0.42 * Math.max(0.8, m.ty.scale), nth(c, 0) * 3, nth(c, 1) * 3, nth(c, 2) * 3);
    dyn(m.x + r[0] * w, cy, m.z + r[2] * w, G(']'), 0.42 * Math.max(0.8, m.ty.scale), nth(c, 0) * 3, nth(c, 1) * 3, nth(c, 2) * 3);
  }
}

/**
 * 照準の文字（#cross。毎フレーム。中身が変わった時だけ書く）：ふだんは小さな点、生き物を捉えると ‹·›、溜めている間は性質のルーンが点を挟み、溜まるほど寄る。
 * 詠唱している間に画面をゆっくりにする見た目 uSlow と、画面の色 uTint（性質の色）も合わせる。dt は実時間の秒
 */
export function updateCross(dt: number): void {
  const el = ui.crossEl;
  if (!el) return;
  vfx.slowFx += ((gear.castSt ? 1 : 0) - vfx.slowFx) * Math.min(1, (dt || 0.016) * 8);
  must(finalPass().uniforms['uSlow']).value = vfx.slowFx;
  if (gear.castSt) {
    const c = must(elemCol(hands()[gear.castSt.h].elem ? must(hands()[gear.castSt.h].elem, '手の性質のルーン').type : null), '性質の色');
    must(finalPass().uniforms['uTint']).value.set(nth(c, 0), nth(c, 1), nth(c, 2));
  }
  const tg = ui.started && !adv.dead && !isPaused() ? aimTarget() : null;
  // the sight: a small dot; it is flanked when it holds a creature; while chanting, the runes of that hand close in on it and, when the chant is full, rest beside it and pulse
  let txt = '·',
    col = 'rgba(225,215,255,.55)',
    cls = '';
  if (gear.castSt) {
    const H = hands()[gear.castSt.h],
      k = Math.min(1, gear.castSt.t / Math.max(0.01, gear.castSt.need)),
      c0 = must(elemCol(H.elem ? H.elem.type : null), '性質の色'),
      c = c0.map((v) => v * 0.72 + 0.25),
      gap = gear.castSt.full ? 0 : Math.max(0, 3 - Math.round(k * 3));
    const E = H.elem ? must(lookup(RUNE_DEF, H.elem.type).ch, 'ルーンの文字') : '·';
    txt = `${E}${' '.repeat(gap + 1)}·${' '.repeat(gap + 1)}${E}`;
    col = cssOf(c);
    cls = gear.castSt.full ? 'full' : 'chant';
  } else if (tg) {
    txt = '‹·›';
    col = 'rgba(255,190,140,.85)';
  }
  const key = txt + col + cls;
  if (key === ui.crossKey) return;
  ui.crossKey = key;
  el.textContent = txt;
  el.style.color = col;
  el.className = cls;
}
