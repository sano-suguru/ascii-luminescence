// 生き物を描く（もとは src/game/13-creatures.js の drawMonster・drawMonster1・drawMonster0・drawTentacles）：
// 形の点を、体の部位ごとの動き（歩く・揺れる・羽ばたく・回るなど）で動かし、向きと大きさを掛けて、世界の中に文字を置く（dyn）。
// まわりの飾り（auras.ts）・頭の上の印（status.ts の drawMark）・姿を変える途中（drawMorph）・照準の先の輪・強い個体の輪・剣を操る者の剣・深みの主の触手・クラーケンの立ち上がる腕も、ここから描く。
// 状態の入れ物 player・clock・ui（照準の先の生き物 aimMon）・gfx（カメラの位置。読むだけ。体だけを描くか drawBodyOnly）に頼る。
// 呼ぶのは古い JS の描画（30-loop-init.js の tick）と、テストの道具（__test.monsterView）。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う見た目になるので、順番を変えないこと。
import { lookup, must, nth } from '../array.ts';
import { G, SWAPSET } from '../glyphs.ts';
import { MARK_H, markHeight } from '../hud.ts';
import { cellLight } from '../lightmap.ts';
import { dyn, spawn } from '../particles.ts';
import { clamp } from '../rng.ts';
import { mr, withMobRand } from '../random.ts';
import { type Monster, clock, gfx, player, ui } from '../state.ts';
import { drawMark } from '../status.ts';
import {
  bogAura,
  dragonAura,
  drawMorph,
  houndAura,
  krakenAura,
  lichAura,
  nagaAura,
  salamanderAura,
  shadowAura,
  spiderAura,
} from './auras.ts';
import { KRAKEN, KRAKEN_SINK, KRAKEN_WATER, dragonSleepForm, krakenHead } from './beasts.ts';
import type { Body } from './kit.ts';
import { beastSleep } from './lords.ts';

/** 描く生き物（src/lib/monsters.ts の makeMonster が、足もとの高さ・向き・揺れと歩きの位相・歩いている度合い・明るさ・形を必ず入れる） */
type Mon = Monster & { y: number; yaw: number; ph: number; walk: number; moving: number; glow: number; form: Body };

// the deep lord's tentacles: columns of glyphs rising out of the water around the body, swaying
/** 深みの主の触手：体のまわりの水から立ち上がり、揺れる文字の柱（水から出ている度合い rise が小さい時は描かない） */
export function drawTentacles(m: Mon, t: number): void {
  const ty = m.ty,
    sc = ty.scale,
    c = ty.col,
    rise = m.rise || 0;
  if (rise < 0.05) return;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + m.ph,
      r0 = 1.2 * sc * 0.55,
      bx = m.x + Math.cos(a) * r0,
      bz = m.z + Math.sin(a) * r0,
      h = (1.4 + 0.8 * Math.sin(k * 1.7)) * sc * 0.5 * rise;
    for (let j = 0; j * 0.22 < h; j++) {
      const q = j * 0.22,
        sw = (Math.sin(t * 1.6 + k + q * 1.8) * 0.35 * q) / Math.max(h, 0.1);
      dyn(
        bx + Math.cos(a) * sw,
        0.05 + q,
        bz + Math.sin(a) * sw,
        G(j % 2 ? 'S' : 's'),
        0.26 * (1 - (q / h) * 0.5),
        c[0] * 1.4,
        c[1] * 1.4,
        c[2] * 1.4,
      );
    }
  }
}

/**
 * クラーケンの立ち上がる腕：頭の横と後ろの水から4本。水から出ている度合い rise で伸び、先は外へ鉤のように巻いて揺れる。
 * 背は藍から青緑へ、巻く内側に薄紅の吸盤（rise が小さい時は描かない）
 */
export function krakenArms(m: Mon, t: number): void {
  const rise = m.rise || 0;
  if (rise < 0.05) return;
  const sc = m.ty.scale,
    W = KRAKEN_WATER,
    K = KRAKEN,
    cy = Math.cos(m.yaw),
    sy = Math.sin(m.yaw),
    at = (lx: number, ly: number, lz: number, g: string, s: number, col: readonly [number, number, number], b: number): void =>
      dyn(m.x + (lx * cy + lz * sy) * sc, m.y + ly * sc, m.z + (-lx * sy + lz * cy) * sc, G(g), s * sc, col[0] * b, col[1] * b, col[2] * b);
  [1.6, -1.6, 2.5, -2.5].forEach((a0, k) => {
    const h = (0.62 + 0.18 * Math.sin(k * 1.7 + 0.6)) * rise,
      ds = 0.055,
      N = Math.max(2, Math.round(h / ds)),
      ox = Math.sin(a0),
      oz = Math.cos(a0),
      r0 = krakenHead.r(W) + 0.18;
    let r = r0,
      y = W;
    for (let i = 0; i <= N; i++) {
      const f = i / N,
        // 縦からの傾き：根もとはまっすぐ、先の4割で外へ巻き下がる。揺れは先ほど大きい
        al = 0.15 + 2.5 * Math.max(0, (f - 0.6) / 0.4) ** 1.5 + Math.sin(t * 1.4 + k * 1.9 + f * 2.2) * 0.3 * f,
        w = 0.085 * (1 - 0.75 * f),
        px = ox * r,
        pz = oz * r,
        // 巻く内側（腕の進む向きを、外の側から見て内へ90度）
        ix = -Math.cos(al),
        iy = Math.sin(al),
        tcol = f > 0.55 ? K.skin : K.top;
      // 明るさは体と同じく m.glow を掛ける（当たって光る・照準の先で明るくなる）
      at(px, y, pz, i % 2 ? '%' : '#', 0.09, tcol, 0.95 * m.glow);
      at(px + oz * w, y, pz - ox * w, ':', 0.07, tcol, 0.7 * m.glow);
      at(px - oz * w, y, pz + ox * w, ':', 0.07, tcol, 0.7 * m.glow);
      if (i % 2 === 0) at(px + ox * ix * w, y + iy * w, pz + oz * ix * w, 'o', 0.06 + 0.03 * (1 - f), K.sucker, 0.95 * m.glow);
      r += Math.sin(al) * ds;
      y += Math.cos(al) * ds;
    }
  });
}

/** 生き物を描く：近接の攻撃を溜めている間は頭の上に !、当たって光っている間は HIT_GLOW 倍の明るさで描く（__test.hideMonster で隠した物は描かない） */
export function drawMonster(m: Mon, t: number): void {
  if (m.drawHide) return; // __test.hideMonster: not drawn for a moment (its light stays)
  if ((m.wind ?? NaN) > 0) {
    const sc = m.ty.scale,
      // クラーケンは外套の上（2.2 だと体の中に埋もれる）。主と忘れられた獣のほかは、頭の上の印と同じ高さ（markHeight）
      h =
        m.y +
        (m.ty.habitat === 'deep'
          ? m.ty.form === 'kraken'
            ? (krakenHead.top + 0.12) * sc
            : 2.2
          : m.key === 'final'
            ? lookup(MARK_H, m.ty.form) * sc
            : m.ty.boss || m.ty.beast
              ? 1.9 * sc
              : markHeight(m.ty));
    dyn(m.x, h, m.z, G('!'), 0.5, 3.2, 0.6, 0.4);
  }
  if ((m.hitT ?? NaN) > 0) {
    const g0 = m.glow;
    m.glow *= HIT_GLOW;
    drawMonster1(m, t, true);
    m.glow = g0;
    return;
  }
  drawMonster1(m, t);
}
/** 当たって光っている間の明るさの倍率。照準の先の倍率 AIM_GLOW とは掛け合わせない（掛け合わせると、光のにじみで体が白く飛ぶ。pnpm glare で数える） */
const HIT_GLOW = 2.4;
/** 照準の先の明るさの倍率 */
const AIM_GLOW = 1.9;
/**
 * 生き物を描く（続き）：深みの主の触手とクラーケンの立ち上がる腕、遠い小さな生き物は描かない、照準の先の生き物は明るく描いて足もとに輪を足す
 * （hit が真なら、当たって光っている間なので、照準の先でも明るさは重ねず、輪だけを足す）
 */
export function drawMonster1(m: Mon, t: number, hit = false): void {
  const aimK = hit ? 1 : AIM_GLOW;
  if (m.ty.habitat === 'deep' && Math.hypot(m.x - player.x, m.z - player.z) < 44) {
    // 照準の先なら、体と同じく明るく（クラーケンの立ち上がる腕は m.glow を読む）
    const g0 = m.glow;
    if (m === ui.aimMon && !m.hidden) m.glow *= aimK;
    (m.ty.form === 'kraken' ? krakenArms : drawTentacles)(m, t);
    m.glow = g0;
  }
  if (m.ty.critter && Math.hypot(m.x - player.x, m.z - player.z) > 30) return;
  if (m === ui.aimMon && !m.hidden) {
    const g0 = m.glow;
    m.glow *= aimK;
    drawMonster0(m, t);
    m.glow = g0;
    const sc = m.ty.scale,
      c = m.ty.col;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + t * 0.8;
      dyn(m.x + Math.cos(a) * 0.75 * sc, m.y + 0.5 * sc, m.z + Math.sin(a) * 0.75 * sc, G('.'), 0.12, c[0] * 2.4, c[1] * 2.4, c[2] * 2.4);
    }
    return;
  }
  drawMonster0(m, t);
}
/**
 * 生き物の体を描く：眠っている姿と目覚める変身（竜と忘れられた獣）、まわりの飾りと強い個体の輪（体だけを描く時は描かない）、化けた巻物、
 * 形の点ごとの部位の動き（クラーケンは水から出ている度合いで沈む）、見えない生き物の揺らぎ、ひるんだ時の震え、頭の上の印、剣を操る者の剣（44 より遠い物は体を描かない）
 */
export function drawMonster0(m: Mon, t: number): void {
  const fj = (m.flinchUntil || 0) > clock.time ? ((m.flinchUntil ?? NaN) - clock.time) * 0.9 * (m.ty.scale || 1) : 0;
  if ((m.ty.form === 'dragon' && !m.ty.boss) || m.ty.beast) {
    if (!m.formSleep) m.formSleep = withMobRand(m, () => (m.ty.beast ? beastSleep(m.form, m.ty) : dragonSleepForm(m.ty)));
    if (m.wasSleep && !m.sleep && !m.morph) m.morph = { from: m.formSleep, t0: clock.time, dur: 1.0 };
    m.wasSleep = !!m.sleep;
    m.drawForm = m.sleep && !m.morph ? m.formSleep : null;
  }
  if (!gfx.drawBodyOnly) {
    if (m.ty.form === 'lichking' && !m.dead) lichAura(m, t);
    if (m.ty.form === 'spiderqueen' && !m.dead) spiderAura(m, t);
    if (m.ty.form === 'nagaqueen' && !m.dead) nagaAura(m, t);
    if (m.ty.form === 'olddragon' && !m.dead) dragonAura(m, t);
    if ((m.ty.form === 'shadowking' || m.ty.form === 'shadowserpent') && !m.dead) shadowAura(m, t);
    if (m.ty.form === 'deepkraken' && !m.dead) krakenAura(m, t);
    if (m.ty.hound && !m.dead) houndAura(m, t);
    if (m.elite && !m.dead && Math.hypot(m.x - player.x, m.z - player.z) < 26) {
      const r = 0.75 * (m.ty.scale || 1);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + t * 0.6;
        dyn(m.x + Math.cos(a) * r, m.y + 0.04, m.z + Math.sin(a) * r, G('.'), 0.15, 1.4, 0.45, 0.25, 0, 0);
      }
    }
    if (m.ty.look === 'salamander' && !m.dead) salamanderAura(m, t);
    if (m.ty.form === 'bog' && !m.ty.boss && !m.dead) bogAura(m, t);
  }
  if (m.morph && drawMorph(m, t)) return;
  const dx = m.x - player.x,
    dz = m.z - player.z,
    d2 = dx * dx + dz * dz;
  if (d2 > 44 * 44) return;
  if (m.hidden) {
    const y = 1.3 + Math.sin(t * 1.1 + m.ph) * 0.06,
      sh = Math.sin(t * 23 + m.ph) * 0.012;
    dyn(m.x + sh, y, m.z, G('?'), 0.5, 2.2, 1.75, 0.85);
    for (let k = 0; k < 6; k++) {
      const a = t * 0.7 + (k / 6) * Math.PI * 2;
      dyn(m.x + Math.cos(a) * 0.35, y - 0.25, m.z + Math.sin(a) * 0.35, G('.'), 0.12, 1.4, 1.1, 0.5);
    }
    return;
  }
  const ty = m.ty,
    c = ty.col,
    sc = ty.scale * (ty.form === 'shadowking' ? 1 + 0.025 * Math.sin(t * 0.8 + m.ph) : 1),
    cy = Math.cos(m.yaw),
    sy = Math.sin(m.yaw),
    dp = Math.sqrt(d2);
  const near = clamp(dp / 3.5, 0.45, 1);
  const swing = Math.sin(m.walk) * 0.55 * m.moving,
    bob = Math.abs(Math.sin(m.walk)) * 0.04 * m.moving;
  const lit = cellLight(m.x, m.z);
  const eelArc = ty.form === 'eel' ? Math.sin(Math.PI * (m.surf ?? NaN)) : 0;
  // クラーケンは、水から出ている度合い rise に合わせて沈み、水面より下になる点は描かない（沈んでいる間は外套の上だけ）
  const sink = ty.form === 'kraken' ? KRAKEN_SINK * (1 - clamp(m.rise || 0, 0, 1)) : 0;
  for (const p of m.drawForm || m.form) {
    if (p.part === 'heart' && !m.heartOn) continue;
    if (p.part === 'crack' && !(m.maxHp && (m.hp ?? NaN) / m.maxHp < (p.th ?? NaN))) continue;
    if (p.part === 'tongue' && Math.sin(t * 2.3 + m.ph) < 0.6) continue;
    if (sink > 0 && p.y - sink < KRAKEN_WATER) continue;
    let lx = p.x,
      ly = p.y - sink,
      lz = p.z;
    if ((p.part === 'heart' || p.part === 'eye') && ty.form === 'shadowserpent') {
      const k = Math.max(0, p.y - 0.4);
      lx += Math.sin(t * 0.9 - p.y * 1.3 + m.ph) * 0.035 * k;
      lz += Math.cos(t * 0.7 - p.y * 1.1) * 0.025 * k;
    }
    switch (p.part) {
      case 'tent': {
        const q = p.piv || 0;
        lx += Math.sin(t * 0.8 + q * 0.45 + (p.ti || 0) * 1.7) * 0.012 * q;
        // クラーケンの水の上の腕は、上下には少しだけ（水面より下に沈まないように）
        ly += Math.cos(t * 0.7 + q * 0.5 + (p.ti || 0)) * 0.008 * q * (ty.form === 'kraken' ? 0.2 : 1);
        break;
      }
      case 'ap': {
        const k = 1 + 0.18 * Math.sin(t * 0.9 + m.ph);
        lx = (p.cx ?? NaN) + (p.x - (p.cx ?? NaN)) * k;
        ly = (p.cy ?? NaN) + (p.y - (p.cy ?? NaN)) * k;
        break;
      }
      case 'flame': {
        const f = p.fh || 0;
        ly += (Math.sin(t * 9 + p.ph) * 0.03 + 0.02) * f;
        lz -= (m.moving || 0) * 0.1 * f;
        lx += Math.sin(t * 6 + p.ph * 2) * 0.015 * f;
        break;
      }
      case 'jel': {
        const k = 1 + 0.07 * Math.sin(t * 3.2 + p.y * 5 + m.ph);
        lx *= k;
        lz *= k;
        ly *= 1 - 0.05 * Math.sin(t * 3.2 + m.ph);
        break;
      }
      case 'bloat': {
        const k = 1 + 0.06 * Math.sin(t * 1.6 + m.ph);
        lx *= k;
        ly *= k;
        lz *= k;
        break;
      }
      case 'wisp': {
        lx += Math.sin(t * 5 + p.ph) * 0.03;
        ly += Math.sin(t * 4.3 + p.ph * 1.3) * 0.04;
        lz += Math.cos(t * 5.4 + p.ph) * 0.03;
        break;
      }
      case 'eelw':
        lx += Math.sin(t * 4 - p.z * 3.5 + m.ph) * 0.09 * (0.4 + Math.max(0, 0.8 - p.z));
        break;
      case 'slither':
        lx += Math.sin(t * 5 - p.z * 5 + m.ph) * 0.05 * (0.3 + Math.max(0, 0.6 - p.z));
        break;
      case 'tongue':
        lx += Math.sin(t * 5 - p.z * 5 + m.ph) * 0.02;
        break;
      case 'cap':
        if (m.noticed || (m.alert ?? NaN) > 0.5) {
          lx += Math.sin(t * 40 + p.ph) * 0.012;
          lz += Math.cos(t * 37 + p.ph) * 0.012;
        }
        break;
      case 'snout':
        if (!(m.moving > 0.3)) {
          lz += Math.sin(t * 14 + m.ph) * 0.012;
        }
        break;
      case 'graze': {
        const g2 = Math.max(0, Math.sin(t * 0.9 + m.ph));
        ly -= g2 * 0.08;
        lz += g2 * 0.03;
        break;
      }
      case 'sway':
        lx += Math.sin(t * 2.2 + p.ph) * 0.015;
        break;
      case 'bog': {
        const k = 1 + 0.05 * Math.sin(t * 1.4 + m.ph + p.y * 2);
        lx *= k;
        lz *= k;
        break;
      }
      case 'bogarm': {
        const k = 1 + 0.05 * Math.sin(t * 1.4 + m.ph + p.y * 2);
        lx *= k;
        lz *= k;
        lz += Math.sin(t * 0.9 + m.ph) * 0.05 * Math.max(0, p.z);
        ly += Math.cos(t * 0.8 + m.ph) * 0.03 * Math.max(0, p.z);
        break;
      }
      case 'breathe': {
        const k = 1 + 0.025 * Math.sin(t * 1.1 + m.ph);
        lx *= k;
        ly *= k;
        lz *= k;
        break;
      }
      case 'claw': {
        const k = Math.max(0, p.y - 0.4);
        lx += Math.sin(t * 0.9 - p.y * 1.3 + m.ph) * 0.035 * k;
        lz += Math.cos(t * 0.7 - p.y * 1.1) * 0.025 * k;
        const cl = Math.pow(Math.max(0, Math.sin(t * 0.8 + m.ph + must(p.hx, '爪の手首 hx'))), 6) * 0.35 * (p.cf || 0);
        lx += ((p.hx ?? NaN) - p.x) * cl;
        ly += ((p.hy ?? NaN) - p.y) * cl;
        lz += ((p.hz ?? NaN) - p.z) * cl;
        break;
      }
      case 'parm': {
        const k = Math.max(0, p.y - 0.4);
        lx += Math.sin(t * 0.9 - p.y * 1.3 + m.ph) * 0.035 * k;
        lz += Math.cos(t * 0.7 - p.y * 1.1) * 0.025 * k + Math.sin(t * 1.1 + m.ph) * 0.08 * Math.min(1, Math.abs(p.x) / 1.2);
        ly += Math.sin(t * 1.1 + m.ph) * 0.04 * Math.min(1, Math.abs(p.x) / 1.2);
        break;
      }
      case 'serp': {
        const k = Math.max(0, p.y - 0.4);
        lx += Math.sin(t * 0.9 - p.y * 1.3 + m.ph) * 0.035 * k;
        lz += Math.cos(t * 0.7 - p.y * 1.1) * 0.025 * k;
        break;
      }
      case 'tendril': {
        const q = p.piv || 0;
        lx += Math.sin(t * 1.6 + q * 0.8 + p.ph * 0.1) * 0.012 * q;
        ly += Math.cos(t * 1.3 + q * 0.7) * 0.01 * q;
        break;
      }
      case 'armL':
      case 'legR':
      case 'armR':
      case 'legL': {
        const ang = p.part === 'armL' || p.part === 'legR' ? swing : -swing,
          dy = ly - p.piv,
          dz2 = lz - p.pz;
        ly = p.piv + dy * Math.cos(ang) - dz2 * Math.sin(ang);
        lz = p.pz + dy * Math.sin(ang) + dz2 * Math.cos(ang);
        ly += bob;
        break;
      }
      case 'head':
      case 'core':
      case 'body':
        // クラーケンは揺らさない（水際の輪が水に沈まないように）
        ly += bob + (ty.form === 'humanoid' || ty.form === 'quad' || ty.form === 'kraken' ? 0 : Math.sin(t * 1.6 + m.ph) * 0.03);
        break;
      case 'shell': {
        const a = t * 0.9 + m.ph,
          ca = Math.cos(a),
          sa = Math.sin(a);
        const nx = lx * ca - lz * sa,
          nz = lx * sa + lz * ca;
        const b = 0.35 * Math.sin(t * 0.6 + m.ph);
        lx = nx;
        lz = nz * Math.cos(b) - ly * Math.sin(b);
        ly = nz * Math.sin(b) + ly * Math.cos(b);
        break;
      }
      case 'puff': {
        const k = 1 + 0.07 * Math.sin(t * 2.2 + m.ph),
          a = t * 0.25,
          ca = Math.cos(a),
          sa = Math.sin(a);
        const nx = lx * ca - lz * sa,
          nz = lx * sa + lz * ca;
        lx = nx * k;
        ly *= k;
        lz = nz * k;
        break;
      }
      case 'wing': {
        const dr = ty.form === 'dragon' || (ty.beast && ty.spec && ty.spec.plan !== 'moth'),
          mo = ty.beast && ty.spec && ty.spec.plan === 'moth',
          fa = dr
            ? 0.8 + Math.sin(t * 1.3 + m.ph) * (m.sleep ? 0.06 : 0.3)
            : mo
              ? Math.sin(t * 4 + m.ph) * 0.55
              : Math.sin(t * 16 + m.ph) * 0.9;
        lx = (p.sd ?? NaN) * (p.r ?? NaN) * Math.cos(fa);
        ly = p.y + (p.r ?? NaN) * Math.sin(fa) * 0.9;
        break;
      }
      case 'tail':
        lx += Math.sin(t * 7 + m.ph) * 0.05 * (p.piv + 1);
        break;
      case 'spin': {
        const a = t * (p.sp || 1) + p.ph;
        lx = (p.cx ?? NaN) + Math.cos(a) * (p.r ?? NaN);
        lz = (p.cz ?? NaN) + Math.sin(a) * (p.r ?? NaN);
        ly = p.y;
        break;
      }
      // a ring standing upright (the king's shadow's black sun), turning in its own plane and always turned to face the camera, so it reads as a round sun from any side
      case 'halo': {
        const a = t * (p.sp || 0.2) + p.ph,
          ex = gfx.camera.position.x - m.x,
          ez = gfx.camera.position.z - m.z,
          el = Math.hypot(ex, ez),
          cm = Math.cos(m.yaw),
          sm = Math.sin(m.yaw),
          ux = el > 1e-3 ? ez / el : cm,
          uz = el > 1e-3 ? -ex / el : -sm,
          w = Math.cos(a) * (p.r ?? NaN); // straight overhead: keep it in the body's front plane
        lx = w * (ux * cm - uz * sm);
        lz = p.z + w * (ux * sm + uz * cm);
        ly = (p.cy ?? NaN) + Math.sin(a) * (p.r ?? NaN);
        break;
      }
      case 'orbit': {
        const a = t * (p.sp || 0.8) + p.ph + (p.da || 0);
        lx = Math.cos(a) * (p.r ?? NaN);
        lz = Math.sin(a) * (p.r ?? NaN);
        ly = p.y + Math.sin(t * 2 + p.ph) * 0.06;
        break;
      }
      case 'robe': {
        const k = 1.95 - p.y;
        lx += Math.sin(t * 2.2 + p.y * 3 + p.ph) * 0.05 * k;
        lz += Math.cos(t * 1.7 + p.y * 2.5 + p.ph) * 0.05 * k;
        break;
      }
      case 'seg': {
        lx += Math.sin(t * 2.6 * Math.max(0.4, m.moving) + m.walk * 0.5 - p.piv * 0.65) * 0.26 * (0.35 + p.piv / 11);
        ly += Math.sin(t * 3 + p.piv) * 0.01;
        break;
      }
      case 'shead': {
        lx += Math.sin(t * 2.6 * Math.max(0.4, m.moving) + m.walk * 0.5) * 0.26 * 0.35;
        ly += Math.sin(t * 1.7 + m.ph) * 0.05;
        break;
      }
      case 'jelly': {
        const k = Math.sin(t * 3 + m.ph);
        ly *= 1 + 0.12 * k;
        lx *= 1 - 0.06 * k;
        lz *= 1 - 0.06 * k;
        break;
      }
    }
    if (ty.form === 'eel') {
      const seg = p.part === 'shead' ? 0 : p.piv;
      ly += 1.3 * Math.max(0, Math.sin(Math.PI * clamp((m.surf ?? NaN) * 1.35 - seg * 0.03, 0, 1))) - 0.1 * seg * eelArc;
    }
    lx *= sc;
    ly *= sc;
    lz *= sc;
    const wx = m.x + lx * cy + lz * sy,
      wz = m.z - lx * sy + lz * cy,
      wy = m.y + ly;
    if (ty.invisible) {
      // phantoms are only a shimmer: brief, faint glyphs scattered over the silhouette; now and then the whole shape shows for a moment
      const rv = Math.max(0, (Math.sin(t * 1.1 + m.ph) - 0.88) / 0.12);
      if (rv > 0) {
        const kk = p.b * 0.55 * rv;
        dyn(wx, wy, wz, p.g, p.s * sc, 0.6 * kk, 0.72 * kk, 1.0 * kk, 0, 0);
      }
      if (dp < 16 && mr() < 0.5) {
        const fk = dp < 4 ? 0.22 : 0.07;
        spawn(
          wx + (mr() - 0.5) * 0.08,
          wy,
          wz + (mr() - 0.5) * 0.08,
          0,
          0,
          0,
          0.08,
          G(nth(SWAPSET, Math.floor(mr() * SWAPSET.length))),
          p.s * sc * 1.2,
          0.6 * fk,
          0.7 * fk,
          1.0 * fk,
          1,
        );
      }
      continue;
    }
    const isCore = p.part === 'core' || p.part === 'shead';
    const shim = isCore ? 0.85 + 0.15 * Math.sin(t * 2.3 + m.ph) : 0.62 + 0.38 * Math.sin(t * 3.1 + p.ph * 7);
    let g = p.g;
    if (!isCore && Math.sin(t * 0.8 + p.ph * 11.3) > 0.986) g = G(nth(SWAPSET, Math.floor(t * 3 + p.ph * 7) % SWAPSET.length));
    let k = p.b * shim * m.glow * 0.62 * (isCore ? near : 1) * (sc < 0.9 ? 1.4 : 1);
    if (p.part === 'pulse') k *= 0.5 + 0.9 * Math.max(0, Math.sin(t * 2.5 + p.ph * 0.3));
    if (p.part === 'eye')
      k *= (1 + (2 * Math.max(0, Math.sin(t * 0.7 + m.ph) - 0.85)) / 0.15) * (ty.form === 'watcher' && m.noticed ? 1.8 : 1);
    else if (p.part === 'heart') k *= 0.7 + 0.6 * Math.max(0, Math.sin(t * 4));
    const sb = sc < 0.9 ? 1 + clamp((dp - 4) / 10, 0, 0.6) : 1;
    if (ty.form === 'eel' && wy < 0) {
      if (dp > 14) continue;
      k *= 0.12;
    }
    const cc = p.col || c;
    if (p.part === 'flame') g = G(nth(['^', "'", '^', '*'], ((t * 12 + p.ph * 3) | 0) % 4));
    const jx = fj ? (mr() - 0.5) * fj : 0,
      jy = fj ? (mr() - 0.5) * fj : 0,
      jz = fj ? (mr() - 0.5) * fj : 0;
    dyn(wx + jx, wy + jy, wz + jz, g, p.s * sc * sb, cc[0] * k + lit[0] * 0.12, cc[1] * k + lit[1] * 0.12, cc[2] * k + lit[2] * 0.12, 0, 0);
  }
  if (!gfx.drawBodyOnly) drawMark(m, t, dp);
  // 霊剣：切っ先を上にした小さな剣（刃・鍔・柄・柄頭）。鍔は、剣が回る向きに張る
  if (ty.conj)
    for (const b of must(m.blades, '剣を操る者の剣 blades')) {
      const bn = clamp(Math.hypot(b.x - gfx.camera.position.x, b.y - gfx.camera.position.y, b.z - gfx.camera.position.z) / 3, 0.25, 1),
        tx = -Math.sin(b.a),
        tz = Math.cos(b.a);
      dyn(b.x, b.y + 0.26, b.z, G('^'), 0.14, 0.7 * bn, 0.8 * bn, 1.0 * bn, 0, 0);
      for (let k = 0; k < 4; k++) dyn(b.x, b.y + 0.18 - k * 0.07, b.z, G('|'), 0.15, 0.6 * bn, 0.7 * bn, 0.95 * bn, 0, 0);
      for (const q of [-1, 0, 1])
        dyn(b.x + tx * q * 0.07, b.y - 0.1, b.z + tz * q * 0.07, G(q ? '-' : '+'), 0.14, 0.75 * bn, 0.55 * bn, 0.95 * bn, 0, 0);
      dyn(b.x, b.y - 0.17, b.z, G('|'), 0.12, 0.6 * bn, 0.45 * bn, 0.8 * bn, 0, 0);
      dyn(b.x, b.y - 0.23, b.z, G('o'), 0.1, 0.75 * bn, 0.55 * bn, 0.95 * bn, 0, 0);
    }
}
