// 主と一部の生き物のまわりの飾り（もとは src/game/07-bodies-lords.js・08-bodies-shadow.js・09-bodies-creatures.js）：
// 毎フレーム、世界の中に文字を置き（dyn）、粒子を出し（spawn）、ときどき低い音や息の音を鳴らす。初めに作って覚える物（剣・宝・灯り・残像）は、生き物に持たせる。
// 王の影の変身（transformShadow）と、姿を変える途中の描き方（drawMorph）もここにある。
// 呼ぶのは古い JS の描画（13-creatures.js の drawMonster0）と、最深部の処理（24-goal.js の updateFinal）。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う見た目になるので、順番を変えないこと。
import { must, nth } from '../array.ts';
import { sNoise, sOut, sRumble, sTone, sndReady } from '../audio.ts';
import { MTYPES } from '../creatures.ts';
import { G } from '../glyphs.ts';
import { msg } from '../log.ts';
import { dyn, spawn } from '../particles.ts';
import { clamp } from '../rng.ts';
import { mpick, mr, sndRand } from '../random.ts';
import { sEnv } from '../sound.ts';
import { type Monster, SND, adv, clock, here, player, vfx } from '../state.ts';
import { BASE_H, CELL, MW } from '../world.ts';
import { buildForm } from './build.ts';
import type { Body } from './kit.ts';
import { shadowSerpentScale } from './bosses.ts';
import { KRAKEN_T } from './lords.ts';

/** まわりの飾りを付ける生き物（足もとの高さ y と向き yaw を持つ） */
type Mon = Monster & { y: number; yaw: number };
/** 音の時刻（sndReady の後なので、音の部品はある） */
const now = (): number => must(SND.ctx, '音の部品 SND.ctx').currentTime;
/** 生き物からプレイヤーまでの床の上の距離 */
const toPlayer = (m: Monster): number => Math.hypot(m.x - player.x, m.z - player.z);

/** 不死の王：まわりに立つ倒れた者の剣、霜の輪、冷たい霧、そばで鳴る低い音 */
export function lichAura(m: Mon, t: number): void {
  const sc = m.ty.scale || 1,
    dp = toPlayer(m);
  if (dp > 30) return;
  if (!m.swords) {
    m.swords = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + mr() * 0.4,
        r = (1.7 + mr() * 0.9) * sc;
      m.swords.push({
        x: m.x + Math.cos(a) * r,
        z: m.z + Math.sin(a) * r,
        tx: (mr() - 0.5) * 0.5,
        tz: (mr() - 0.5) * 0.5,
        h: 0.8 + mr() * 0.5,
      });
    }
  }
  for (const s of m.swords) {
    for (let y = 0; y < s.h; y += 0.12) dyn(s.x + s.tx * y, y, s.z + s.tz * y, G('|'), 0.14, 0.42, 0.42, 0.48);
    dyn(s.x + s.tx * s.h, s.h, s.z + s.tz * s.h, G('+'), 0.18, 0.55, 0.48, 0.32);
  }
  const n = 36;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + t * 0.05,
      r = (1.3 + 0.12 * Math.sin(t * 0.7 + k)) * sc;
    dyn(m.x + Math.cos(a) * r, 0.05, m.z + Math.sin(a) * r, G(k % 3 ? '.' : '*'), 0.12, 0.45, 0.65, 0.9);
  }
  if (mr() < 0.25) {
    const a = mr() * 6.28,
      r = mr() * 1.2 * sc;
    spawn(
      m.x + Math.cos(a) * r,
      0.15,
      m.z + Math.sin(a) * r,
      Math.cos(a) * 0.25,
      0.08,
      Math.sin(a) * 0.25,
      2.2,
      G(mpick(['~', '.'])),
      0.22,
      0.3,
      0.4,
      0.55,
      0,
    );
  }
  if (dp < 14 && clock.time > (m.droneT || 0) && sndReady()) {
    m.droneT = clock.time + 3.2;
    const t0 = now(),
      o = sOut(m.x, m.z, 0.16);
    sEnv(sTone(t0, 'sine', 55, 52, 3, o), t0, 0.6, 2.3);
    sEnv(sTone(t0, 'sine', 82.5, 80, 3, o), t0, 0.8, 2.1, 0.5);
  }
}

/** 蜘蛛の女王：床に放射状の巣と、その上を走る子蜘蛛。口から垂れる糸 */
export function spiderAura(m: Mon, t: number): void {
  const sc = m.ty.scale || 1,
    dp = toPlayer(m);
  if (dp > 30) return;
  if (mr() < 0.12) {
    const cy = Math.cos(m.yaw),
      sy = Math.sin(m.yaw),
      lx = (mr() < 0.5 ? 1 : -1) * 0.03 * sc,
      lz = 0.62 * sc;
    spawn(m.x + lx * cy + lz * sy, m.y + 0.82 * sc, m.z - lx * sy + lz * cy, 0, -0.2, 0, 1.2, G('.'), 0.12, 0.5, 1.0, 0.45, 1);
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.2;
    const dark = k % 3 === 0;
    for (let r = 0.5; r < 2.6; r += 0.28)
      dyn(
        m.x + Math.cos(a) * r * sc,
        0.04,
        m.z + Math.sin(a) * r * sc,
        G(k % 2 ? '/' : '\\'),
        0.12,
        dark ? 0.14 : 0.38,
        dark ? 0.1 : 0.4,
        dark ? 0.18 : 0.48,
      );
  }
  for (let r = 0.9; r < 2.6; r += 0.55) {
    const n = Math.round(r * 14);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      dyn(m.x + Math.cos(a) * r * sc, 0.04, m.z + Math.sin(a) * r * sc, G('.'), 0.1, 0.32, 0.34, 0.42);
    }
  }
  for (let k = 0; k < 5; k++) {
    const a = t * (0.5 + k * 0.13) + k * 1.3,
      r = (1.2 + 0.6 * Math.sin(t * 0.7 + k)) * sc;
    dyn(m.x + Math.cos(a) * r, 0.08, m.z + Math.sin(a) * r, G('s'), 0.16, 0.75, 0.65, 0.95);
  }
}

/** ナーガの女王：床の水の輪、小さな蛇、そばで聞こえる息の音 */
export function nagaAura(m: Mon, t: number): void {
  const sc = m.ty.scale || 1,
    dp = toPlayer(m);
  if (dp > 30) return;
  for (let r = 1.1; r < 2.4; r += 0.45) {
    const n = Math.round(r * 16);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + t * 0.1 * (r > 1.6 ? -1 : 1);
      dyn(m.x + Math.cos(a) * r * sc, 0.04 + 0.02 * Math.sin(t * 2 + k), m.z + Math.sin(a) * r * sc, G('~'), 0.12, 0.2, 0.5, 0.55);
    }
  }
  for (let k = 0; k < 4; k++) {
    const a = t * (0.4 + k * 0.11) + k * 1.6,
      r = (1.3 + 0.5 * Math.sin(t * 0.6 + k)) * sc;
    for (let q = 0; q < 4; q++) {
      const aa = a - q * 0.06;
      dyn(m.x + Math.cos(aa) * r, 0.08, m.z + Math.sin(aa) * r, G(q ? '~' : 'n'), 0.15, 0.4, 0.85, 0.45);
    }
  }
  if (dp < 12 && clock.time > (m.hissT || 0) && sndReady()) {
    m.hissT = clock.time + 4 + sndRand() * 3;
    const t0 = now();
    sEnv(sNoise(t0, 0.9, 'highpass', 3000, 0.7, sOut(m.x, m.z, 0.18)), t0, 0.15, 0.7);
  }
}

/** 古竜：まわりと下の宝（金貨・杯・箱）と、ときどき鼻から出る煙 */
export function dragonAura(m: Mon, _t: number): void {
  const sc = m.ty.scale || 1,
    dp = toPlayer(m);
  if (dp > 36) return;
  if (!m.hoard) {
    m.hoard = [];
    for (let k = 0; k < 70; k++) {
      const a = mr() * 6.28,
        r = (0.4 + mr() * 0.9) * sc;
      m.hoard.push({
        x: m.x + Math.cos(a) * r,
        z: m.z + Math.sin(a) * r,
        y: 0.05 + mr() * 0.15,
        ch: mpick(['$', 'o', '$', 'o', 'U', '#', '*']),
      });
    }
  }
  for (const h of m.hoard) dyn(h.x, h.y, h.z, G(h.ch), 0.2, h.ch === '*' ? 1.6 : 1.1, h.ch === '*' ? 1.4 : 0.85, h.ch === '*' ? 0.9 : 0.3);
  if (mr() < 0.05) {
    const cy = Math.cos(m.yaw),
      sy = Math.sin(m.yaw),
      lx = 0.36 * sc,
      lz = 2.0 * sc;
    spawn(
      m.x + lx * cy + lz * sy,
      m.y + 0.25 * sc,
      m.z - lx * sy + lz * cy,
      (mr() - 0.5) * 0.2,
      0.5,
      (mr() - 0.5) * 0.2,
      2.4,
      G('~'),
      0.3,
      0.35,
      0.32,
      0.3,
      0,
    );
  }
}

/**
 * 王の影：裾から床を渡って、まわりの3方向へ流れる影の筋と暗い霧。
 * 一つ目の姿は、傷つくほど体から光のかけらがこぼれる
 */
export function shadowAura(m: Mon, t: number): void {
  const sc = m.ty.scale || 1,
    dp = toPlayer(m);
  if (dp > 40) return;
  if (!m.phase2 && m.maxHp && (m.hp ?? NaN) / m.maxHp < 0.95 && mr() < (1 - (m.hp ?? NaN) / m.maxHp) * 0.6) {
    const a = mr() * 6.28,
      y = (0.4 + mr() * 1.4) * sc;
    spawn(
      m.x + Math.cos(a) * 0.55 * sc,
      y,
      m.z + Math.sin(a) * 0.45 * sc,
      Math.cos(a) * 0.4,
      0.3,
      Math.sin(a) * 0.4,
      1.4,
      G(mpick(['.', '+', '*'])),
      0.14,
      1.4,
      1.5,
      2.2,
      0,
    );
  }
  const targets: (readonly [number, number])[] = [0, 1, 2].map((k) => {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    return [m.x + Math.cos(a) * 4.5 * sc, m.z + Math.sin(a) * 4.5 * sc] as const;
  });
  for (const [tx, tz] of targets) {
    const dx = tx - m.x,
      dz = tz - m.z,
      L = Math.hypot(dx, dz) || 1,
      ux = dx / L,
      uz = dz / L,
      n = Math.round(L / 0.35);
    for (let k = 2; k < n; k++) {
      const f = k / n,
        w = Math.sin(f * 9 - t * 2.2) * 0.22,
        x = m.x + dx * f - uz * w,
        z = m.z + dz * f + ux * w,
        edge = (k + Math.floor(t * 6)) % 5 === 0;
      dyn(x, 0.05, z, G(edge ? '.' : '~'), 0.2, edge ? 0.75 : 0.24, edge ? 0.72 : 0.16, edge ? 0.95 : 0.4);
    }
  }
  if (mr() < 0.2) {
    const a = mr() * 6.28,
      r = mr() * 0.9 * sc;
    spawn(
      m.x + Math.cos(a) * r,
      0.2,
      m.z + Math.sin(a) * r,
      Math.cos(a) * 0.2,
      0.25,
      Math.sin(a) * 0.2,
      2.6,
      G(mpick(['~', '%'])),
      0.26,
      0.16,
      0.1,
      0.26,
      0,
    );
  }
}

/**
 * 王の影の変身：封印が破れ、一つ目の姿の文字が、2.5秒かけて二つ目の姿（MTYPES.final2）へ流れ込む。
 * その間は攻撃が効かない。地鳴りと揺れと光、飛び散るかけらと落ちる闇、低い和音。伝言は2つ（2つ目は1.5秒後）
 */
export function transformShadow(b: Monster & { form: Body }): void {
  const R = must(adv.HIST, '年代記 adv.HIST').rulers,
    last = nth(R, R.length - 1);
  b.phase2 = true;
  b.invulnT = 2.5;
  sRumble(1.0, 3.2);
  vfx.shake = Math.max(vfx.shake, 0.8);
  vfx.flash = Math.max(vfx.flash, 0.5);
  const sc = b.ty.scale || 3;
  for (let q = 0; q < 60; q++) {
    const a = mr() * 6.28;
    spawn(
      b.x + Math.cos(a) * 0.3,
      2.8 * sc,
      b.z + Math.sin(a) * 0.3,
      Math.cos(a) * 3,
      2 + mr() * 3,
      Math.sin(a) * 3,
      1.6 + mr(),
      G(mpick(['/', '\\', '<', '>', '^'])),
      0.28,
      2.6,
      2.5,
      3.0,
      0,
    );
  }
  for (let q = 0; q < 70; q++) {
    const a = mr() * 6.28,
      r = mr() * 0.9 * sc;
    spawn(
      b.x + Math.cos(a) * r,
      0.5 + mr() * 1.8 * sc,
      b.z + Math.sin(a) * r,
      Math.cos(a) * 0.6,
      -0.4 - mr(),
      Math.sin(a) * 0.6,
      2.2,
      G(mpick(['%', '#', '~'])),
      0.3,
      0.3,
      0.22,
      0.5,
      1,
    );
  }
  if (sndReady()) {
    const t0 = now(),
      o = sOut(b.x, b.z, 0.3);
    for (const f of [55, 82.5, 110, 164.8]) sEnv(sTone(t0, 'sawtooth', f, f * 0.97, 3.5, o), t0, 0.4, 3, 0.25);
  }
  const from = b.form.filter((p) => p.part !== 'crack' && p.part !== 'heart');
  // 二つ目の姿は一つ目の大きさのまま。背が高いので、天井に収まらない所だけ縮める（階が無い時は縮めない）
  const ceilH = here.D ? (here.D.ceil[Math.floor(b.z / CELL) * MW + Math.floor(b.x / CELL)] ?? BASE_H) : Infinity;
  const final2 = {
    ...b.ty,
    form: 'shadowserpent',
    sk: 'final2',
    scale: shadowSerpentScale(b.ty.scale, ceilH),
    speed: (b.ty.speed || 0.8) * 1.35,
    verb: '封印が破れ、底の闇から長い体をもたげた影',
  };
  MTYPES['final2'] = final2;
  b.ty = final2;
  b.form = buildForm(b.ty);
  b.morph = { from, t0: clock.time, dur: 2.5 };
  msg(`<b style="color:#a98cff">&amp;</b>王の姿が砕け、封じられていた闇があふれ出した。`);
  setTimeout(() => msg(`<b style="color:#a98cff">&amp;</b>${last.title}${last.name}の影が、底の闇から長い体をもたげた。`), 1500);
}

/** 姿を変える途中を描く：二つ目の姿の文字が、一つ目の姿の文字から飛んでくる。終わったら morph を消して false を返す（描いたら true） */
export function drawMorph(m: Mon & { form: Body }, _t: number): boolean {
  const M = must(m.morph, '姿を変える途中 morph'),
    f = clamp((clock.time - M.t0) / M.dur, 0, 1);
  if (f >= 1) {
    m.morph = null;
    return false;
  }
  const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2,
    sc = m.ty.scale,
    cy = Math.cos(m.yaw),
    sy = Math.sin(m.yaw),
    F = M.from,
    n = F.length;
  for (let i = 0; i < m.form.length; i++) {
    const p = nth(m.form, i);
    if (p.part === 'heart') continue;
    const q = nth(F, (i * 7) % n);
    const lx = (q.x + (p.x - q.x) * e) * sc,
      ly = (q.y + (p.y - q.y) * e) * sc + Math.sin(f * Math.PI) * 0.3 * sc * Math.sin(i),
      lz = (q.z + (p.z - q.z) * e) * sc,
      col = p.col || m.ty.col,
      k = (f < 0.5 ? q.b : p.b) * 0.62 * (0.8 + 0.6 * Math.sin(f * Math.PI));
    dyn(
      m.x + lx * cy + lz * sy,
      m.y + ly,
      m.z - lx * sy + lz * cy,
      f < 0.5 ? q.g : p.g,
      (f < 0.5 ? q.s : p.s) * sc,
      col[0] * k,
      col[1] * k,
      col[2] * k,
      0,
      0,
    );
  }
  return true;
}

/** 深みの主の水：頭のまわりと、触手が水面を破る所の泡、波の輪、沈んだ神殿の灯り */
export function krakenAura(m: Mon, t: number): void {
  const sc = m.ty.scale || 1,
    dp = toPlayer(m);
  if (dp > 36) return;
  const cy = Math.cos(m.yaw),
    sy = Math.sin(m.yaw);
  const at = (lx: number, lz: number): [number, number] => [m.x + (lx * cy + lz * sy) * sc, m.z + (-lx * sy + lz * cy) * sc];
  for (let q = 0; q < 26; q++) {
    const a = (q / 26) * Math.PI * 2 + t * 0.2,
      r = 0.62 + 0.06 * Math.sin(t * 3 + q),
      p = at(Math.cos(a) * r, Math.sin(a) * r);
    dyn(p[0], 0.08 + 0.05 * Math.abs(Math.sin(t * 2.4 + q)), p[1], G(q % 3 ? '~' : '^'), 0.15, 0.75, 0.85, 0.95);
  }
  KRAKEN_T.forEach((c, k) => {
    const b = nth(c, 0),
      rr = 0.18 + 0.06 * Math.sin(t * 1.5 + k);
    for (let q = 0; q < 9; q++) {
      const a = (q / 9) * Math.PI * 2,
        p = at(b[0] + Math.cos(a) * rr, b[2] + Math.sin(a) * rr);
      dyn(p[0], 0.07, p[1], G(q % 2 ? '~' : '^'), 0.13, 0.6, 0.75, 0.85);
    }
  });
  for (let k = 0; k < 3; k++) {
    const rr = (1.0 + k * 0.45 + 0.1 * Math.sin(t + k)) * sc,
      n = Math.round(rr * 10);
    for (let q = 0; q < n; q++) {
      const b = (q / n) * Math.PI * 2 + t * 0.05 * (k % 2 ? 1 : -1);
      dyn(m.x + Math.cos(b) * rr, 0.05, m.z + Math.sin(b) * rr, G('~'), 0.13, 0.18, 0.38, 0.5);
    }
  }
  if (!m.lamps) {
    m.lamps = [];
    for (let k = 0; k < 6; k++) {
      const a = mr() * 6.28,
        r = (2.4 + mr() * 1.2) * sc;
      m.lamps.push([m.x + Math.cos(a) * r, m.z + Math.sin(a) * r, mr() * 6]);
    }
  }
  for (const L of m.lamps) {
    const b = 0.6 + 0.4 * Math.sin(t * 0.9 + L[2]);
    dyn(L[0], 0.12 + 0.04 * Math.sin(t + L[2]), L[1], G('*'), 0.2, 1.2 * b, 0.95 * b, 0.5 * b);
  }
  if (mr() < 0.12) {
    const c = nth(nth(KRAKEN_T, Math.floor(mr() * KRAKEN_T.length)), 0),
      p = at(c[0], c[2]);
    for (let q = 0; q < 6; q++)
      spawn(
        p[0],
        0.1,
        p[1],
        (mr() - 0.5) * 1.2,
        1 + mr() * 1.5,
        (mr() - 0.5) * 1.2,
        0.8,
        G(mpick(["'", '.', ','])),
        0.14,
        0.7,
        0.85,
        0.95,
        1,
      );
  }
}

/** 猟犬の跡：火の猟犬の後ろの火花、氷の猟犬の凍った息、光の猟犬の残像 */
export function houndAura(m: Mon & { form: Body }, _t: number): void {
  const sc = m.ty.scale || 1,
    mv = m.moving || 0,
    h = m.ty.hound,
    cy = Math.cos(m.yaw),
    sy = Math.sin(m.yaw);
  if (toPlayer(m) > 26) return;
  if (h === 'fire' && mv > 0.3 && mr() < 0.12) {
    const lz = -0.35 * sc;
    spawn(
      m.x + lz * sy + (mr() - 0.5) * 0.2,
      0.06,
      m.z + lz * cy + (mr() - 0.5) * 0.2,
      (mr() - 0.5) * 0.2,
      0.4 + mr() * 0.5,
      (mr() - 0.5) * 0.2,
      0.4,
      G(mpick(["'", '.'])),
      0.09,
      2.6,
      1.2,
      0.35,
      0,
    );
  }
  if (h === 'ice' && mr() < 0.12) {
    const lz = 0.68 * sc;
    const ice = mr() < 0.15;
    spawn(
      m.x + lz * sy + (mr() - 0.5) * 0.1,
      m.y + 0.58 * sc,
      m.z + lz * cy + (mr() - 0.5) * 0.1,
      sy * 0.18,
      -0.12,
      cy * 0.18,
      1.6,
      G(ice ? '*' : mpick(['~', '.'])),
      ice ? 0.08 : 0.18,
      ice ? 1.5 : 0.62,
      ice ? 1.8 : 0.86,
      ice ? 2.1 : 1.2,
      0,
    );
  }
  if (h === 'light') {
    m.ghosts = m.ghosts || [];
    if (mv > 0.3 && clock.time - (m.ghostT || 0) > 0.12) {
      m.ghostT = clock.time;
      m.ghosts.push({ x: m.x, y: m.y, z: m.z, yaw: m.yaw, t: clock.time });
      if (m.ghosts.length > 3) m.ghosts.shift();
    }
    for (const gh of m.ghosts) {
      const age = clock.time - gh.t;
      if (age > 0.5) continue;
      const k = (1 - age / 0.5) * 0.5,
        c2 = Math.cos(gh.yaw),
        s2 = Math.sin(gh.yaw);
      for (let i = 0; i < m.form.length; i += 2) {
        const p = nth(m.form, i);
        if (p.part === 'orbit') continue;
        const lx = p.x * sc,
          ly = p.y * sc,
          lz = p.z * sc;
        dyn(gh.x + lx * c2 + lz * s2, gh.y + ly, gh.z - lx * s2 + lz * c2, p.g, p.s * sc, 1.0 * k, 0.95 * k, 0.75 * k, 0, 0);
      }
    }
  }
}

/** サラマンダー：尾の先から、ときどき火の粉 */
export function salamanderAura(m: Mon, _t: number): void {
  if (toPlayer(m) > 24 || mr() > 0.08) return;
  const sc = m.ty.scale || 1,
    cy = Math.cos(m.yaw),
    sy = Math.sin(m.yaw),
    lz = -1.3 * sc;
  spawn(
    m.x + lz * sy,
    0.12,
    m.z + lz * cy,
    (mr() - 0.5) * 0.2,
    -0.1,
    (mr() - 0.5) * 0.2,
    0.5,
    G(mpick(["'", '.'])),
    0.09,
    2.6,
    1.2,
    0.35,
    1,
  );
}

/** 沼の生き物：足もとの泥の輪、浮かぶ泡、体から垂れる滴 */
export function bogAura(m: Mon, t: number): void {
  const sc = m.ty.scale || 1;
  if (toPlayer(m) > 26) return;
  for (let r = 0.95; r < 1.6; r += 0.3) {
    const n = Math.round(r * 16);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + t * 0.08 * (r > 1.2 ? -1 : 1);
      dyn(m.x + Math.cos(a) * r * sc, 0.04, m.z + Math.sin(a) * r * sc, G('~'), 0.13, 0.28, 0.24, 0.16);
    }
  }
  if (mr() < 0.06) {
    const a = mr() * 6.28,
      r = mr() * 0.7 * sc;
    spawn(m.x + Math.cos(a) * r, 0.15, m.z + Math.sin(a) * r, 0, 0.25, 0, 1.6, G(mpick(['o', '.'])), 0.14, 0.7, 0.95, 0.45, 0);
  }
  if (mr() < 0.1) {
    const a = mr() * 6.28,
      r = 0.5 * sc;
    spawn(m.x + Math.cos(a) * r, 0.9 * sc, m.z + Math.sin(a) * r, 0, -0.2, 0, 1.2, G(mpick([',', '.'])), 0.12, 0.5, 0.38, 0.24, 1);
  }
}
