// 詠唱と当たり（もとは src/game/18-level-player.js・20-chant-hits.js・21-altars-heal.js・24-goal.js）：遅れて起きること、魔法の場、雨、連射、
// 剣の波、当たった時の見た目と音、ひるみと吹き飛び、水の中か、稲妻の線、近くの敵、冷気、立ち直り、主が倒れた時の祭壇と伝説の物、経験。
// 状態の入れ物 fight・player・here・adv・clock に頼る。
import { lookup, must, nth } from './array.ts';
import { handPoint, losClear, shotFrame, aimOrigin, beamFrame, doorBlock, groundPoint, hittable, reflectDir, viewDir } from './aim.ts';
import { placeAltar } from './altars.ts';
import { sChime, sNoise, sOut, sTone, sWhoosh, sndReady, castSound, sBoom, sCrackleBurst } from './audio.ts';
import { css } from './color.ts';
import { addBolt, sparkCrown } from './fx.ts';
import { type Spec, bodyN, type Side, atkType, isTwo, specOf, turnElem } from './gear.ts';
import { G } from './glyphs.ts';
import { chillArea, ignite } from './ground.ts';
import { getLegend, legendOfBranch } from './legend.ts';
import { msg } from './log.ts';
import { foe, BL, hostile, statOf } from './monsters.ts';
import { mCenter, turnDir } from './math.ts';
import { LEGEND_KINDS, mname } from './names.ts';
import { spawn } from './particles.ts';
import { expNeed, expOf } from './progress.ts';
import { mpick, mr, roll } from './random.ts';
import { RALLY_FROM, RUNE_DEF, TL, TRAIT_V, elemCol, tv, RES, SLEEP_MULT } from './runes.ts';
import { sEnv } from './sound.ts';
import { type Mob, SND, adv, clock, fight, here, player, beamHold, blaze, gear, saved, ui, vfx, vmKick } from './state.ts';
import { renderStatus, makeNoise, onNoticed } from './status.ts';
import { LQ_DEEP, LQ_WATER, MW, TF, CELL, MH, NCELL, TC, TW, TX } from './world.ts';
import { clamp } from './rng.ts';
import { die } from './levels.ts';
import { victory } from './results.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');
type V3 = readonly [number, number, number];

/** dt 秒後に fn を呼ぶ（ゲームの時刻で数える。fight.laters） */
export function later(dt: number, fn: () => void): void {
  fight.laters.push({ t: clock.time + dt, fn });
}
/** 魔法の場を置く（同じ性質の場が近くにあれば、その場の残りの秒を延ばして中身を入れ替える。多くても14。古い物から消す） */
export function addZone(x: number, z: number, r: number, sp: Spec, dur: number, grow: boolean): void {
  const near = fight.zones.find((zn) => zn.el === sp.elem && Math.hypot(zn.x - x, zn.z - z) < Math.max(0.7, zn.r * 0.6));
  if (near) {
    near.t = Math.max(near.t, dur);
    near.sp = sp;
    return;
  }
  fight.zones.push({ x, z, r, r0: r, sp, el: sp.elem, t: dur, tick: 0, grow });
  if (fight.zones.length > 14) fight.zones.shift();
}
/** 性質の雨を降らせる（範囲と長さは特性で変わる。床に目印を出す） */
export function startRain(sp: Spec, x: number, z: number, again?: boolean): void {
  const n = 8 + 3 * (sp.aff.count || 0),
    r = 1.8 * (tv(sp, 'area') ?? NaN),
    span = 0.6 * (tv(sp, 'span') ?? NaN);
  fight.rains.push({ x, z, r, n, left: n, iv: span / n, tick: again ? 0 : 0.45, sp, follow: false, elemK: 0.25, again: !!again });
  fight.marks.push({ x, z, r, t: (again ? 0 : 0.45) + span, c: must(elemCol(sp.elem)) });
}
/** 連射（0.07 秒ごとに矢を撃つ。opt.dir があればその向きへ、ほかは照準へ。少しばらつく） */
export function castRapid(h: string, sp: Spec, opt: { dir?: V3 | null | undefined; auto?: boolean | undefined }): void {
  const ac = TL(sp, 'accuracy'),
    n = 3 + (sp.aff.count || 0);
  for (let k = 0; k < n; k++)
    later(k * 0.07, () => {
      if (adv.dead) return;
      const fr = shotFrame(h, false, 'bolt'),
        base = opt.dir || fr.d,
        HP = opt.dir ? handPoint(h) : fr.o,
        spread = 0.045 * (1 - 0.16 * ac),
        d = turnDir(base, (mr() - 0.5) * spread * 2);
      fight.projs.push({
        kind: 'bolt',
        auto: !!opt.auto,
        x: HP[0],
        y: HP[1],
        z: HP[2],
        vx: d[0] * 22,
        vy: d[1] * 22,
        vz: d[2] * 22,
        t: 0,
        sp,
        bounce: sp.aff.bounce || 0,
        homing: sp.aff.homing || 0,
        hit: new Set(),
        dmg: lookup(RUNE_DEF, 'rapid').dmg,
        pierce: 0,
        keep: true,
      });
      if (k % 2 === 0) sWhoosh();
    });
}
/** 剣の波（武器を振った向きに、飛ぶ刃を撃つ。大剣の払いは広く短い。素手は撃たない。cut はもう当たった生き物） */
export function fireWave(sp: Spec, dir: V3, cut?: Iterable<Mob> | null): void {
  if (sp.atk === 'bare') return;
  player.swingWave = true;
  const wide = sp.atk === 'gsweep',
    W = (wide ? 2.0 : 1.2) + 2 * nth(TRAIT_V.width, TL(sp, 'width')),
    n = 1 + (sp.aff.count || 0),
    HP = handPoint(sp.h || 'R'),
    dm = must(lookup(RUNE_DEF, wide ? 'gsweep' : 'blade').dmg),
    k = wide ? 0.55 : 0.65,
    v = wide ? 14 : 16;
  for (let i = 0; i < n; i++) {
    const d = turnDir(dir, (i - (n - 1) / 2) * 0.13);
    fight.projs.push({
      kind: 'bolt',
      wind: true,
      big: wide,
      wave: true,
      x: HP[0],
      y: HP[1],
      z: HP[2],
      vx: d[0] * v,
      vy: d[1] * v,
      vz: d[2] * v,
      t: 0,
      maxT: (wide ? 0.28 : 0.32) * (tv(sp, 'range') ?? NaN),
      sp,
      bounce: sp.aff.bounce || 0,
      homing: sp.aff.homing || 0,
      hit: new Set(cut || []),
      dmg: [Math.max(1, Math.round(nth(dm, 0) * k)), Math.max(1, Math.round(nth(dm, 1) * k))],
      pierce: wide ? 6 : 4,
      keep: true,
      cw: W,
      rad: Math.max(0, W / 2 - 0.56),
    });
  }
}
/** 当たった時の見た目と音（効きが弱い 0.25 以下は灰色の火花と鈍い音、強い 1.5 以上は性質の色の火花と鋭い音、間は性質があれば小さな火花。quiet なら音を出さず火花を減らす） */
export function hitFeedback(m: Mob, mult: number, el: string | null | undefined, quiet?: boolean): void {
  const cy = m.y + 0.6 * m.ty.scale,
    c = elemCol(el);
  if (mult <= 0.25) {
    for (let q = 0; q < 9; q++) {
      const a = mr() * 6.28;
      spawn(m.x, cy, m.z, Math.cos(a) * 2.2, 0.6 + mr(), Math.sin(a) * 2.2, 0.45, G(mpick(['x', '.', "'"])), 0.12, 0.45, 0.45, 0.5, 0);
    }
    if (sndReady() && !quiet) {
      const t = must(SND.ctx).currentTime;
      sEnv(sTone(t, 'sine', 120, 80, 0.12, sOut(m.x, m.z, 0.25)), t, 0.005, 0.12);
    }
    return;
  }
  if (mult >= 1.5) {
    for (let q = 0; q < (quiet ? 6 : 18); q++) {
      const a = mr() * 6.28;
      spawn(
        m.x,
        cy,
        m.z,
        Math.cos(a) * 3,
        0.8 + mr() * 2,
        Math.sin(a) * 3,
        0.6 + mr() * 0.4,
        G(mpick(['*', '+', '#', '%'])),
        0.2,
        nth(must(c), 0) * 3,
        nth(must(c), 1) * 3,
        nth(must(c), 2) * 3,
        0,
      );
    }
    m.hitT = 0.35;
    if (sndReady() && !quiet) {
      const t = must(SND.ctx).currentTime;
      sEnv(sNoise(t, 0.25, 'highpass', 2400, 0.8, sOut(m.x, m.z, 0.35)), t, 0.003, 0.22);
    }
  } else if (el) {
    for (let q = 0; q < 6; q++) {
      const a = mr() * 6.28;
      spawn(
        m.x,
        cy,
        m.z,
        Math.cos(a) * 1.4,
        0.5 + mr(),
        Math.sin(a) * 1.4,
        0.5,
        G(mpick(['*', '.'])),
        0.14,
        nth(must(c), 0) * 2.2,
        nth(must(c), 1) * 2.2,
        nth(must(c), 2) * 2.2,
        0,
      );
    }
  }
}
/** 当たった生き物のひるみと吹き飛び（主・住む所のある物・きのこ・深みの主は吹き飛ばない）。溜めを崩し、強い当たりならヒットストップ */
export function hitReact(m: Mob, n: number): void {
  const ty = m.ty,
    boss = ty.boss || m.key === 'lord' || m.key === 'final',
    now = performance.now();
  m.flinchUntil = clock.time + Math.min(0.26, 0.08 + n * 0.015);
  if (!boss && !ty.habitat && !['shroom', 'kraken', 'deepkraken'].includes(ty.form)) {
    const heavy = ['O', 'T', 'Y', 'B', 'D', 'X'].includes(m.key) || ty.beast ? 2.5 : 1,
      w = Math.max(0.3, (ty.scale || 1) * (ty.scale || 1) * heavy),
      v = Math.min(6, (n * 0.9) / w);
    const ak =
        // oxlint-disable-next-line typescript/consistent-type-assertions -- 表に無い攻撃（undefined も）は 0.6 にする、元の読み方のまま（表を文字の鍵で引くための型だけ）
        ({ blade: 1.0, bolt: 0.45, orb: 0.75, beam: 0.12, bare: 0.6 } as Partial<Record<string, number>>)[m.lastAtk as string] || 0.6,
      vv = v * 0.5 * ak * (m.lastKnock || 1),
      src = m.lastAtk === 'orb' && fight.hitSrcPoint ? fight.hitSrcPoint : [player.x, player.z];
    if (vv > 0.3) {
      const dx = m.x - nth(src, 0),
        dz = m.z - nth(src, 1),
        d = Math.hypot(dx, dz) || 1;
      m.kx = (m.kx || 0) + (dx / d) * vv;
      m.kz = (m.kz || 0) + (dz / d) * vv;
      m.st = m.st || {};
    }
  }
  if ((m.wind ?? NaN) > 0 && !boss && (n >= 6 || n >= (m.maxHp || 99) * 0.2)) {
    m.wind = 0;
    m.atkCd = Math.max(m.atkCd || 0, 0.8);
    const cy = m.y + 1.2 * (ty.scale || 1);
    for (let q = 0; q < 8; q++) {
      const a = mr() * 6.28;
      spawn(m.x, cy, m.z, Math.cos(a) * 1.6, 0.4 + mr(), Math.sin(a) * 1.6, 0.35, G(mpick(['!', "'", '.'])), 0.14, 2.4, 1.4, 0.6, 0);
    }
  }
  const strong = (m.hp ?? NaN) <= 0 || n >= 8 || n >= (m.maxHp || 99) * 0.25;
  if (strong && now > fight.hitStopUntil + 90) fight.hitStopUntil = now + ((m.hp ?? NaN) <= 0 ? 65 : 45);
}
/** 生き物が水（浅い・深い）の中にいるか */
export const inWater = (m: Mob): boolean => {
  const l = level().liquid[m.cz * MW + m.cx];
  return l === LQ_WATER || l === LQ_DEEP;
};
/** 2つの生き物の体の間に、稲妻の線を引く（style の既定は雷） */
export function zapLine(a: Mob, b: Mob, c: readonly number[], style?: string): void {
  addBolt([a.x, a.y + 0.6 * a.ty.scale, a.z], [b.x, b.y + 0.6 * b.ty.scale, b.z], c, style || 'thunder');
}
/** 一番近い敵（r より近く、skip に無い物。fy を渡せば、その高さから体の真ん中を見通せる物だけ） */
export function nearestFoe(x: number, z: number, r: number, skip: Set<Mob>, fy?: number): Mob | null {
  let b = null,
    bd = r;
  for (const o of here.monsters) {
    if (!foe(o) || skip.has(o)) continue;
    const d = Math.hypot(o.x - x, o.z - z);
    if (d < bd && (fy === undefined || losClear(x, fy, z, ...mCenter(o)))) {
      bd = d;
      b = o;
    }
  }
  return b;
}
/** 冷気が弾ける（まわりを冷やし、中の生き物を4秒冷えさせる。輪の形の粒） */
export function coldSnap(x: number, z: number, r: number): void {
  chillArea(x, z, r);
  for (const m of here.monsters) {
    if (m.dead || m.ty.critter) continue;
    if (Math.hypot(m.x - x, m.z - z) < r + 0.3 * m.ty.scale) {
      const st = m.st || (m.st = {});
      st.chill = Math.max(st.chill || 0, 4);
    }
  }
  for (let q = 0; q < 28; q++) {
    const a = (q / 28) * Math.PI * 2;
    spawn(
      x + Math.cos(a) * r * 0.9,
      0.15,
      z + Math.sin(a) * r * 0.9,
      Math.cos(a) * 0.6,
      0.4,
      Math.sin(a) * 0.6,
      0.6,
      G(mpick(['*', '.', '+'])),
      0.14,
      1.2,
      1.7,
      2.2,
      0,
    );
  }
}
/**
 * 立ち直り：受けた傷の取り戻せる分（player.rally）を、当てた傷の半分だけ取り戻す（倒せば多く）。少し前に自分が当てた生き物だけ。
 * 取り戻した分は、生き物の体から手元へ飛ぶ光の粒（fight.rallyMotes）になる
 */
export function rallyOnHit(m: Mob, n: number, how: string): void {
  if (!((player.rally ?? NaN) > 0) || !RALLY_FROM.has(how) || m.ty.critter || !(clock.time - (m.playerT || -99) < 1.2)) return;
  const mn = bodyN('mend');
  let gain = Math.min(must(player.rally), n * 0.5 * (1 + 0.5 * mn));
  const kill = (m.hp ?? NaN) <= 0;
  if (kill) gain = Math.min(must(player.rally), gain + 3 + 2 * mn + 3 * BL('devour'));
  if (gain <= 0.05) return;
  player.rally = must(player.rally) - gain;
  const sc = m.ty.scale || 1,
    k = kill ? Math.min(16, 6 + Math.round(gain * 2)) : Math.min(5, 1 + Math.round(gain)),
    per = gain / k,
    src = kill && m.form ? m.form : null;
  for (let q = 0; q < k; q++) {
    let x = m.x,
      y = m.y + 0.6 * sc,
      z = m.z;
    if (src) {
      const p = nth(src, Math.floor(mr() * src.length)),
        cy = Math.cos(m.yaw),
        sy = Math.sin(m.yaw);
      x = m.x + (p.x * cy + p.z * sy) * sc;
      y = m.y + p.y * sc;
      z = m.z + (-p.x * sy + p.z * cy) * sc;
    }
    fight.rallyMotes.push({
      x0: x,
      y0: y,
      z0: z,
      t: -q * 0.03,
      dur: 0.38 + mr() * 0.12,
      amt: per,
      c: m.ty.col || [1, 0.9, 0.7],
      wob: mr() * 6.28,
    });
  }
}
/** 主が倒れた所に、主の祭壇を置く（主だけ。王の影・小さな生き物・穏やかな物・的は置かない。近くの空いた床へずらす） */
export function dropRune(m: Mob): void {
  if (m.ty.critter || m.ty.peaceful || m.ty.dummy) return;
  const lord = m.key === 'lord' || m.ty.lord;
  if (m.key === 'final') return;
  if (!lord) return;
  let at = m.cz * MW + m.cx;
  for (const d of [-1, MW, -MW, 1, MW + 1, -MW - 1])
    if (level().tile[at + d] === TF && !level().liquid[at + d] && !level().items.some((o) => o.i === at + d && !o.taken)) {
      at += d;
      break;
    }
  placeAltar(at, 'lordaltar' + clock.time, { lord: true, born: clock.time });
  for (let q = 0; q < 14; q++) {
    const a = mr() * 6.28;
    spawn(m.x, 0.6, m.z, Math.cos(a) * 1.2, 0.6 + mr(), Math.sin(a) * 1.2, 0.8, G('.'), 0.12, 1.6, 1.4, 2.2, 0);
  }
}
/** 支道の主が倒れた時：主を倒した記録、枠を開ける台、まだ持っていない伝説の物（光の粒と音と伝言） */
export function lordFell(m: Mob): void {
  if (m.key !== 'lord' || !here.branch) return;
  adv.runState.lordsDone.add(here.branch.key);
  {
    let si = m.cz * MW + m.cx;
    for (const d of [1, -1, MW, -MW])
      if (level().tile[si + d] === TF && !level().liquid[si + d]) {
        si += d;
        break;
      }
    level().items.push({ i: si, kind: 'slot', taken: false, born: clock.time });
  }
  const k = legendOfBranch(here.branch.key),
    L = getLegend();
  if (k && L && !L.have.has(k)) {
    level().items.push({ i: m.cz * MW + m.cx, kind: 'legend', legend: k, taken: false, born: clock.time });
    const c = lookup(LEGEND_KINDS, k).col;
    for (let q = 0; q < 60; q++) {
      const a = mr() * 6.28;
      spawn(
        m.x,
        0.8 + mr() * 1.5,
        m.z,
        Math.cos(a) * 2.2,
        0.5 + mr() * 2.4,
        Math.sin(a) * 2.2,
        1.2 + mr(),
        G(mpick(['*', '+', '.', "'"])),
        0.2,
        c[0] * 3,
        c[1] * 3,
        c[2] * 3,
        0,
      );
    }
    sChime(m.x, m.z, 0.6);
    setTimeout(() => sChime(m.x, m.z, 0.5), 300);
    msg(`<b style="color:${css(c)}">${lookup(LEGEND_KINDS, k).ch}</b>${mname(m)}が崩れ落ちた。その胸の奥から、ひとつの光がこぼれ落ちた。`);
  }
}
/** 経験を得る（溜まればレベルが上がり、上がった数だけ選ぶ機会が増える。上がった時は音と光の輪） */
export function gainExp(e: number): void {
  if (!(e > 0) || adv.dead) return;
  adv.lvl.exp += e;
  let up = 0;
  while (adv.lvl.exp >= expNeed(adv.lvl.n)) {
    adv.lvl.exp -= expNeed(adv.lvl.n);
    adv.lvl.n++;
    adv.lvl.pending++;
    up++;
  }
  renderStatus();
  if (up) {
    sChime(player.x, player.z, 0.6);
    setTimeout(() => sChime(player.x, player.z, 0.45), 180);
    for (let q = 0; q < 40; q++) {
      const a = mr() * 6.28,
        r = 1.6 + mr();
      spawn(
        player.x + Math.cos(a) * r,
        0.4 + mr() * 1.6,
        player.z + Math.sin(a) * r,
        -Math.cos(a) * r * 2.2,
        0.2,
        -Math.sin(a) * r * 2.2,
        0.45,
        G(mpick(['*', '+', '.'])),
        0.14,
        2.6,
        2.3,
        1.5,
        0,
      );
    }
  }
}
/** 術を放つ時の指定（溜めた秒 hold・詠唱したか chanted・向き dir（無ければ照準へ）・発動のルーンで勝手に放ったか auto） */
export interface CastOpt {
  hold?: number;
  chanted?: boolean;
  dir?: V3 | null | undefined;
  auto?: boolean;
}
/** 色の3つの数に k を掛けた物（粒子の色に広げて渡す） */
type Col3 = [number, number, number];
/**
 * 手 h の術を放つ（武器の種類ごと：剣・素手・大剣の払いは近くを切る、突進、大剣の波、矢、星屑の矢、月、雨と星、連射、ほかは矢・玉・光線）。
 * 立ち直りの秒を付け、次に放つ性質を回す（もとは src/game/20-chant-hits.js）
 */
export function castNow(h: Side, opt?: CastOpt): void {
  opt = opt || {};
  const sp = specOf(h);
  if (BL('charge') && (opt.hold || 0) > 0.35) sp.powK = BL('charge') >= 2 ? 1.5 : 1.3;
  vmKick[h] = clock.time;
  if (isTwo()) vmKick.R = clock.time;
  if (sp.atk !== 'beam') turnElem(h);
  const fr = shotFrame(h, !!opt.chanted, specOf(h).atk),
    dir = opt.dir || fr.d,
    HP = opt.dir ? handPoint(h) : fr.o;
  if (!opt.auto) player.recover = Math.max(player.recover || 0, (sp.atk === 'bare' ? 0.5 : lookup(RUNE_DEF, must(sp.atk)).rec) ?? NaN);
  if (sp.atk === 'blade' || sp.atk === 'bare') {
    meleeCast(sp, opt.dir || viewDir());
    return;
  }
  if (sp.atk === 'dash') {
    dashCast(sp, opt.dir || viewDir(), !!opt.auto);
    return;
  }
  if (sp.atk === 'gsweep') {
    meleeCast(sp, opt.dir || viewDir());
    return;
  }
  if (sp.atk === 'gwave') {
    castSound(sp);
    makeNoise(player.x, player.z, 6, 0.4);
    const n = 1 + (sp.aff.count || 0),
      dmg = lookup(RUNE_DEF, 'gwave').dmg;
    for (let k = 0; k < n; k++) {
      const d = turnDir(dir, (k - (n - 1) / 2) * 0.14);
      fight.projs.push({
        kind: 'bolt',
        wind: true,
        big: true,
        wave: true,
        cw: 2.6,
        rad: 0.74,
        x: HP[0],
        y: HP[1],
        z: HP[2],
        vx: d[0] * 10,
        vy: d[1] * 10,
        vz: d[2] * 10,
        accel: 30,
        vmax: 26,
        t: 0,
        maxT: 1.0,
        sp,
        bounce: 0,
        homing: 0,
        hit: new Set(),
        dmg,
        dmgK: 1,
        pierce: 6,
        keep: true,
      });
    }
    sWhoosh();
    return;
  }
  if (sp.atk === 'bpower' || sp.atk === 'rshot') {
    castSound(sp);
    makeNoise(player.x, player.z, 5, 0.3);
    const n = 1 + (sp.aff.count || 0),
      pw = sp.atk === 'bpower',
      v = (pw ? 28 : 24) * (tv(sp, 'speed') ?? NaN);
    for (let k = 0; k < n; k++) {
      const d = turnDir(dir, (k - (n - 1) / 2) * 0.1);
      fight.projs.push({
        kind: 'bolt',
        auto: !!opt.auto,
        x: HP[0],
        y: HP[1],
        z: HP[2],
        vx: d[0] * v,
        vy: d[1] * v,
        vz: d[2] * v,
        t: 0,
        sp,
        bounce: sp.aff.bounce || 0,
        homing: sp.aff.homing || 0,
        hit: new Set(),
        dmg: lookup(RUNE_DEF, sp.atk).dmg,
        ...(pw ? { pierce: 2 + nth([0, 1, 1, 2, 3, 3], TL(sp, 'pierce')), keep: true } : {}),
      });
    }
    return;
  }
  if (sp.atk === 'mshot') {
    castSound(sp);
    const n = 1 + (sp.aff.count || 0);
    for (let k = 0; k < n; k++) {
      const d = turnDir(dir, (k - (n - 1) / 2) * 0.1);
      fight.projs.push({
        kind: 'bolt',
        x: HP[0],
        y: HP[1],
        z: HP[2],
        vx: d[0] * 18,
        vy: d[1] * 18,
        vz: d[2] * 18,
        t: 0,
        sp,
        bounce: sp.aff.bounce || 0,
        homing: sp.aff.homing || 0,
        hit: new Set(),
        dmg: lookup(RUNE_DEF, 'mshot').dmg,
        pierce: 0,
      });
    }
    return;
  }
  if (sp.atk === 'mmoon') {
    castSound(sp);
    makeNoise(player.x, player.z, 6, 0.4);
    const k = clamp((opt.hold || 0) / (2 * (tv(sp, 'charge') ?? NaN)), 0, 1),
      f = 1 + k * 2 * (tv(sp, 'size') ?? NaN),
      n = 1 + (sp.aff.count || 0);
    for (let i = 0; i < n; i++) {
      const d = turnDir(dir, (i - (n - 1) / 2) * 0.2);
      fight.projs.push({
        kind: 'orb',
        noGrav: true,
        moon: f,
        x: HP[0],
        y: HP[1],
        z: HP[2],
        vx: d[0] * 9,
        vy: d[1] * 9,
        vz: d[2] * 9,
        t: 0,
        sp,
        bounce: 0,
        homing: 0,
        hit: new Set(),
        tide: TL(sp, 'pull'),
      });
    }
    return;
  }
  if (sp.atk === 'rain' || sp.atk === 'star') {
    castSound(sp);
    makeNoise(player.x, player.z, 5, 0.3);
    const tp = opt.dir ? groundPoint(handPoint(h), opt.dir, 16) : groundPoint(aimOrigin(), viewDir(), 22);
    if (sp.atk === 'rain') startRain(sp, tp[0], tp[1]);
    else castStar(sp, tp[0], tp[1]);
    return;
  }
  if (sp.atk === 'rapid') {
    castSound(sp);
    makeNoise(player.x, player.z, 5, 0.3);
    castRapid(h, sp, opt);
    return;
  }
  castSound(sp);
  makeNoise(player.x, player.z, 5, 0.3);
  if (sp.atk === 'bolt') {
    const n = 1 + (sp.aff.count || 0);
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 0.11,
        d = turnDir(dir, off);
      const v = 20 * (tv(sp, 'speed') ?? NaN);
      fight.projs.push({
        kind: 'bolt',
        auto: !!opt.auto,
        x: HP[0],
        y: HP[1],
        z: HP[2],
        vx: d[0] * v,
        vy: d[1] * v,
        vz: d[2] * v,
        t: 0,
        sp,
        bounce: sp.aff.bounce || 0,
        homing: sp.aff.homing || 0,
        hit: new Set(),
      });
    }
  } else if (sp.atk === 'orb') {
    const n = 1 + (sp.aff.count || 0);
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 0.16,
        d = turnDir(dir, off);
      const v = 12 * (tv(sp, 'speed') ?? NaN);
      fight.projs.push({
        kind: 'orb',
        auto: !!opt.auto,
        x: HP[0],
        y: HP[1],
        z: HP[2],
        vx: d[0] * v,
        vy: d[1] * v + 2.6,
        vz: d[2] * v,
        t: 0,
        sp,
        bounce: sp.aff.bounce || 0,
        homing: sp.aff.homing || 0,
        hit: new Set(),
      });
    }
  } else if (sp.atk === 'beam') {
    fireBeam(h, opt.dir || null, opt.dir ? HP : null, !!opt.auto);
    fight.beamRun = { h, t: opt.auto ? 0.5 : 1.5, tick: 0.15, auto: !!opt.auto, dir: opt.dir || null };
    if (!opt.auto) player.recover = Math.max(player.recover || 0, 1.6);
  }
}
/** 突進（向き dir に素早く進み、触れた物を切る。止まった所から突きを撃つ。特性で残像が後から切る） */
export function dashCast(sp: Spec, dir: V3, auto: boolean): void {
  const hx = dir[0],
    hz = dir[2],
    l = Math.hypot(hx, hz) || 1,
    dist = 3 + nth(TRAIT_V.stride, TL(sp, 'stride')),
    dur = 0.2,
    x0 = player.x,
    z0 = player.z,
    af = nth(TRAIT_V.after, TL(sp, 'after'));
  player.swingH = sp.h;
  player.swing = 0.22;
  player.swingCol = elemCol(sp.elem);
  sWhoosh();
  player.lunge = { t: 0, dur, dx: hx / l, dz: hz / l, sp: dist / dur, cut: { sp, hit: new Set(), w: 1.0, dK: 1, link: false } };
  if (!auto) player.recover = (lookup(RUNE_DEF, 'dash').rec ?? NaN) * nth(TRAIT_V.link, TL(sp, 'link'));
  later(dur, () => {
    const HP = handPoint(sp.h || 'R'),
      d = viewDir(),
      dm = must(lookup(RUNE_DEF, 'dash').dmg),
      n = 1 + (sp.aff.count || 0);
    for (let i = 0; i < n; i++) {
      const dd = turnDir(d, (i - (n - 1) / 2) * 0.1);
      fight.projs.push({
        kind: 'bolt',
        wind: true,
        x: HP[0],
        y: HP[1],
        z: HP[2],
        vx: dd[0] * 22,
        vy: dd[1] * 22,
        vz: dd[2] * 22,
        t: 0,
        maxT: 0.36 * (tv(sp, 'range') ?? NaN),
        sp,
        bounce: 0,
        homing: 0,
        hit: new Set(player.lunge ? player.lunge.cut.hit : []),
        dmg: [Math.max(1, Math.round(nth(dm, 0) * 0.7)), Math.max(1, Math.round(nth(dm, 1) * 0.7))],
        pierce: 2,
        keep: true,
        rad: 0.05,
        thrust: true,
      });
    }
  });
  if (af) {
    later(dur, () => {
      const x1 = player.x,
        z1 = player.z;
      for (let i = 0; i < af; i++) {
        const f = (i + 1) / (af + 1),
          ax = x0 + (x1 - x0) * f,
          az = z0 + (z1 - z0) * f;
        for (let q = 0; q < 8; q++)
          spawn(
            ax + (mr() - 0.5) * 0.4,
            0.6 + mr() * 1.0,
            az + (mr() - 0.5) * 0.4,
            0,
            0.1,
            0,
            0.5,
            G(mpick([')', '(', '|'])),
            0.16,
            // oxlint-disable-next-line typescript/consistent-type-assertions -- 性質の色は3つの数（元のまま広げて渡す）
            ...(must(elemCol(sp.elem)).map((v) => v * 1.6) as Col3),
            0,
          );
        later(0.35, () => {
          for (const m of here.monsters) {
            if (!hittable(m)) continue;
            if (Math.hypot(m.x - ax, m.z - az) < 1.0 + 0.3 * m.ty.scale) {
              m.playerT = clock.time;
              applyHit(
                m,
                Math.max(
                  1,
                  Math.round(roll(nth(must(lookup(RUNE_DEF, 'dash').dmg), 0), nth(must(lookup(RUNE_DEF, 'dash').dmg), 1)) * 0.55),
                ),
                sp,
                true,
              );
            }
          }
        });
      }
    });
  }
}
/** 突進の間、触れた生き物を切る（一度ずつ） */
export function dashCuts(): void {
  const L = player.lunge;
  if (!L) return;
  const c = L.cut;
  const dm = must(lookup(RUNE_DEF, 'dash').dmg);
  for (const m of here.monsters) {
    if (!hittable(m) || c.hit.has(m)) continue;
    if (Math.hypot(m.x - player.x, m.z - player.z) < c.w + 0.35 * m.ty.scale) {
      c.hit.add(m);
      m.playerT = clock.time;
      applyHit(m, Math.max(1, Math.round(roll(nth(dm, 0), nth(dm, 1)) * c.dK)), c.sp);
      if (c.link) player.recover = Math.min(player.recover || 0, 0.05);
    }
  }
}
/** 星を落とす（床に目印を出し、少し遅れて落ちて弾ける。数の分だけまわりにも。引き寄せの特性で、落ちる前に生き物を寄せる） */
export function castStar(sp: Spec, x: number, z: number): void {
  const pl = TL(sp, 'pull'),
    sz = tv(sp, 'size'),
    delay = 0.6 * (tv(sp, 'fall') ?? NaN),
    pts: [number, number][] = [[x, z]];
  const extra = sp.aff.count || 0;
  for (let i = 0; i < extra; i++) {
    const a = mr() * 6.28;
    pts.push([x + Math.cos(a) * 1.6, z + Math.sin(a) * 1.6]);
  }
  pts.forEach(([px, pz], i) => {
    const dl = delay + i * 0.18;
    fight.marks.push({ x: px, z: pz, r: must(sz), t: dl, c: must(elemCol(sp.elem)), star: true });
    if (pl && i === 0)
      later(dl * 0.35, () => {
        const R = nth(TRAIT_V.pull, pl);
        for (const m of here.monsters) {
          if (!hittable(m) || m.ty.boss || m.key === 'lord' || m.key === 'final' || m.ty.habitat) continue;
          const ax = px - m.x,
            az = pz - m.z,
            dd = Math.hypot(ax, az);
          if (dd > R || dd < 0.3) continue;
          const v = (2 + pl * 0.8) / Math.max(0.6, m.ty.scale || 1);
          m.kx = (m.kx || 0) + (ax / dd) * v;
          m.kz = (m.kz || 0) + (az / dd) * v;
          m.st = m.st || {};
        }
      });
    later(dl, () => {
      const c = elemCol(sp.elem);
      for (let y = 0; y < 7; y += 0.35)
        spawn(
          px + (mr() - 0.5) * 0.2,
          y,
          pz + (mr() - 0.5) * 0.2,
          0,
          -6,
          0,
          0.25,
          G(mpick(['|', '*', '+'])),
          0.2,
          nth(must(c), 0) * 3,
          nth(must(c), 1) * 3,
          nth(must(c), 2) * 3,
          0,
        );
      orbBurst(px, 0.2, pz, sp, { dmg: 1.25 * Math.sqrt(sz ?? NaN), rad: sz });
      vfx.shake = Math.max(vfx.shake, 0.1);
    });
  });
}
/**
 * 近くを切る（剣・素手・大剣の払い）：手の届く所で、照準からの角度の小さい順に、数の分だけ切る。剣の波を撃ち、
 * 性質を足もとに落とす（もとは src/game/20-chant-hits.js）
 */
export function meleeCast(sp: Spec, dir: V3): void {
  player.swingWave = false;
  player.swingH = sp.h;
  player.swing = 0.22;
  player.swingCol = elemCol(sp.elem);
  sWhoosh();
  const MD = lookup(RUNE_DEF, sp.atk === 'bare' ? 'blade' : must(sp.atk)),
    [vx, vy, vz] = dir,
    [ox, oy, oz] = aimOrigin(),
    reach = MD.reach || 2.2,
    maxT = 1 + (sp.aff.count || 0) + (sp.atk === 'gsweep' ? 2 : 0),
    cands: [number, Mob][] = [];
  for (const m of here.monsters) {
    if (!hittable(m)) continue;
    if (m.ty.habitat === 'deep' && (m.rise || 0) < 0.3) continue;
    if (m.ty.habitat === 'bog' && (m.rise || 0) < 0.3) continue;
    const sc = m.ty.scale,
      cy = m.hidden ? m.y + 1.3 : m.y + (m.ty.flier ? 0 : 0.6 * sc),
      ax = m.x - ox,
      ay = cy - oy,
      az = m.z - oz,
      d = Math.hypot(ax, ay, az);
    if (Math.hypot(m.x - player.x, m.z - player.z) > reach + 0.35 * sc) continue;
    const ang = Math.acos(clamp((ax * vx + ay * vy + az * vz) / Math.max(d, 1e-3), -1, 1)),
      tol = (MD.arc || 0.42) + (maxT > 1 ? 0.25 : 0) + Math.atan2(0.5 * sc, Math.max(d, 0.5));
    if (ang <= tol) cands.push([ang, m]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  const dm = sp.atk === 'bare' ? [1, 2] : MD.dmg;
  for (const [, m] of cands.slice(0, maxT)) applyHit(m, Math.round(roll(nth(must(dm), 0), nth(must(dm), 1))), sp);
  fireWave(sp, dir, new Set(cands.slice(0, maxT).map((c) => c[1])));
  if (sp.elem) {
    const fx = player.x + vx * 1.5,
      fz = player.z + vz * 1.5,
      ci = Math.floor(fz / CELL) * MW + Math.floor(fx / CELL);
    if (sp.elem !== 'fire' || doorBlock(ci) || (blaze.fuel[ci] ?? NaN) > 0) landElem(sp, fx, 0.3, fz, ci);
  }
}
/**
 * 光線を撃つ（手 h から。数の分だけ少しずつずらす）：当たった生き物を焼く。壁に当たると性質を落とし、
 * 跳ね返りの数だけ跳ね返る。撃ち続けるほど強くなる（集中）（もとは src/game/20-chant-hits.js）
 */
export function fireBeam(h: Side, dirIn: V3 | null, orgIn: readonly number[] | null, auto: boolean): void {
  const sp = specOf(h),
    fr = dirIn ? null : beamFrame(h),
    base = dirIn || must(fr).d,
    n = 1 + (sp.aff.count || 0),
    [ox, oy, oz] = orgIn || must(fr).o;
  fight.beamSegs = [];
  const fb = beamHold[h] || beamHold.R,
    gap = clock.time - fb.last;
  fb.hold = gap > 0.4 ? 0 : fb.hold + gap;
  fb.last = clock.time;
  const fL = TL(sp, 'focus'),
    fMax = nth(TRAIT_V.focus, fL),
    fK = 1 + Math.min(fMax, fb.hold * 0.35);
  for (let k = 0; k < n; k++) {
    let d: V3 = turnDir(base, (k - (n - 1) / 2) * 0.12),
      x = must(ox),
      y = must(oy),
      z = must(oz),
      left = 12 * (tv(sp, 'length') ?? NaN),
      bounces = sp.aff.bounce || 0;
    const seg = [[x, y, z]],
      hitSet = new Set<Mob>();
    while (left > 0) {
      const nx = x + d[0] * 0.25,
        ny = y + d[1] * 0.25,
        nz = z + d[2] * 0.25;
      left -= 0.25;
      let hitM = null;
      for (const m of here.monsters) {
        if (!hittable(m) || hitSet.has(m)) continue;
        if (m.ty.habitat === 'deep' && (m.rise || 0) < 0.3) continue;
        const cy = m.y + (m.ty.flier ? 0 : 0.6 * m.ty.scale);
        if (Math.hypot(m.x - nx, cy - ny, m.z - nz) < 0.57 + 0.35 * m.ty.scale) {
          hitM = m;
          break;
        }
      }
      if (hitM) {
        seg.push([nx, ny, nz]);
        hitSet.add(hitM);
        applyHit(
          hitM,
          Math.max(1, Math.round(roll(nth(must(lookup(RUNE_DEF, 'beam').dmg), 0), nth(must(lookup(RUNE_DEF, 'beam').dmg), 1)) * fK)),
          sp,
          true,
        );
        break;
      }
      const ci = Math.floor(nz / CELL) * MW + Math.floor(nx / CELL),
        wall =
          nx < 0 ||
          nz < 0 ||
          nx >= MW * CELL ||
          nz >= MH * CELL ||
          level().tile[ci] === TW ||
          level().tile[ci] === TX ||
          doorBlock(ci) ||
          ny < 0.02 ||
          ny > (level().ceil[ci] ?? NaN);
      if (wall) {
        seg.push([x, y, z]);
        if (clock.time - fight.beamIgT >= 0.5) {
          fight.beamIgT = clock.time;
          landElem(sp, x, y, z, doorBlock(ci) ? ci : Math.floor(z / CELL) * MW + Math.floor(x / CELL));
        }
        if (bounces <= 0) break;
        bounces--;
        const r = reflectDir(x, y, z, d);
        d = r;
        continue;
      }
      x = nx;
      y = ny;
      z = nz;
    }
    if (seg.length < 2) seg.push([x, y, z]);
    const e = nth(seg, seg.length - 1);
    for (let q = 0; q < 3; q++) {
      const a = mr() * 6.28;
      spawn(
        nth(e, 0),
        nth(e, 1),
        nth(e, 2),
        Math.cos(a) * 1.2,
        0.4 + mr(),
        Math.sin(a) * 1.2,
        0.3,
        G(mpick(['*', '+'])),
        0.12,
        nth(must(elemCol(sp.elem)), 0) * 2.8,
        nth(must(elemCol(sp.elem)), 1) * 2.8,
        nth(must(elemCol(sp.elem)), 2) * 2.8,
        0,
      );
    }
    fight.beamSegs.push({ pts: seg, col: auto ? must(elemCol(sp.elem)).map((v) => v * 0.6 + 0.4) : must(elemCol(sp.elem)), t: 0.16 });
  }
}
/** 玉が弾ける（まわりの見通せる生き物に当て、性質ごとに火・冷気・稲妻・毒の霧を残す。もとは src/game/20-chant-hits.js） */
export function orbBurst(
  x: number,
  y: number,
  z: number,
  sp: Spec,
  opt?: { dmg?: number | undefined; rad?: number | undefined; cloud?: boolean },
): void {
  opt = opt || {};
  const dK = opt.dmg || 1,
    areaK = 1 + (sp.aff.area || 0) / 100,
    R = 1.7 * areaK * (opt.rad || 1),
    c = elemCol(sp.elem),
    ci = Math.floor(z / CELL) * MW + Math.floor(x / CELL);
  for (let q = 0; q < 28; q++) {
    const a = mr() * 6.28,
      e = mr();
    spawn(
      x,
      y,
      z,
      Math.cos(a) * R * 1.6 * (0.4 + e),
      0.5 + mr() * 1.8,
      Math.sin(a) * R * 1.6 * (0.4 + e),
      0.6 + mr() * 0.4,
      G(mpick(['*', 'o', '.', '+'])),
      0.18,
      nth(must(c), 0) * 2.6,
      nth(must(c), 1) * 2.6,
      nth(must(c), 2) * 2.6,
      0,
    );
  }
  sCrackleBurst(x, z);
  makeNoise(x, z, 9, 0.6);
  vfx.shake = Math.max(vfx.shake, 0.08);
  for (const m of here.monsters) {
    if (!hittable(m)) continue;
    if (Math.hypot(m.x - x, m.z - z) < R + 0.3 * m.ty.scale && losClear(x, Math.max(0.4, y), z, ...mCenter(m))) {
      fight.hitSrcPoint = [x, z];
      applyHit(
        m,
        Math.max(1, Math.round(roll(nth(must(lookup(RUNE_DEF, 'orb').dmg), 0), nth(must(lookup(RUNE_DEF, 'orb').dmg), 1)) * dK)),
        sp,
        true,
      );
      fight.hitSrcPoint = null;
    }
  }
  if (sp.elem === 'fire' && ci >= 0 && ci < NCELL && !level().liquid[ci]) burstFire(ci, R / CELL + 0.6, 0.9);
  if (sp.elem === 'ice') chillArea(x, z, R);
  if (sp.elem === 'thunder') landElem(sp, x, y, z, ci);
  if (sp.elem === 'poison' && opt.cloud !== false) fight.clouds.push({ x, z, r: R * 1.1, t: 3 * (1 + (sp.aff.dur || 0) / 100), tick: 0 });
}
/** マス i のまわり（半径 r マス）に火をつける（壁・裂け目・水は除く。燃える物を少し足す。燃えるガスがあれば爆ぜる） */
export function burstFire(i: number, r: number, str: number): void {
  const cx = i % MW,
    cz = (i / MW) | 0,
    rr = Math.ceil(r);
  for (let dz = -rr; dz <= rr; dz++)
    for (let dx = -rr; dx <= rr; dx++) {
      if (Math.hypot(dx, dz) > r) continue;
      const x = cx + dx,
        z = cz + dz;
      if (x < 0 || z < 0 || x >= MW || z >= MH) continue;
      const j = z * MW + x;
      const tt = level().tile[j];
      if (tt === TW || tt === TC || level().liquid[j] === LQ_WATER || level().liquid[j] === LQ_DEEP) continue;
      blaze.fuel[j] = Math.max(nth(blaze.fuel, j), 0.5);
      ignite(j, str, false);
      if ((level().gas[j] ?? NaN) > 0.1) boom(j);
    }
}
/** 燃えるガスがマス i で爆ぜる（音と光と揺れ、近くのプレイヤーと生き物に火のダメージ。伝言は3秒あける） */
export function boom(i: number): void {
  const x = ((i % MW) + 0.5) * CELL,
    z = (((i / MW) | 0) + 0.5) * CELL,
    dd = Math.hypot(x - player.x, z - player.z);
  if (clock.time - (boom.last || -9) > 0.35) {
    boom.last = clock.time;
    sBoom(clamp(1 - dd / 34, 0.05, 1));
    makeNoise(x, z, 20, 1.3);
  }
  if (dd < 30) {
    for (let q = 0; q < 10; q++) {
      const a = mr() * 6.28,
        e2 = mr();
      spawn(
        x,
        0.6 + mr(),
        z,
        Math.cos(a) * 3 * e2,
        0.5 + mr() * 2.5,
        Math.sin(a) * 3 * e2,
        0.6 + mr() * 0.6,
        G(mpick(['*', '#', '^', '%'])),
        0.3 + mr() * 0.2,
        3.2,
        1.6,
        0.5,
        0,
      );
    }
  }
  vfx.flash = Math.max(vfx.flash, clamp(1 - dd / 26, 0, 1));
  vfx.shake = Math.max(vfx.shake, clamp(1 - dd / 22, 0, 1) * 0.6);
  if (dd < 3.6) hurtPlayer(Math.round(12 * (1 - dd / 3.6)) + 2, '爆発');
  for (const m of here.monsters) {
    if (m.dead || m.ty.critter) continue;
    const dm = Math.hypot(m.x - x, m.z - z);
    if (dm < 3.6) damageMonster(m, Math.round(16 * (1 - dm / 3.6)) + 3, 'fire');
  }
  if (clock.time - blaze.lastBoom > 3 && dd < 34) {
    blaze.lastBoom = clock.time;
    msg('<b style="color:#ffb347">*</b>沼のガスに火が回り、轟音とともに爆ぜた！');
  }
}
// 型だけの declare namespace で、関数の欄の型を付ける（組み立てで消える。古い JS の文をそのまま残すため）
export declare namespace boom {
  /** 爆ぜる音を最後に鳴らしたゲームの時刻（0.35 秒あける） */
  let last: number | undefined;
}
/**
 * 攻撃が生き物に当たる（性質の効き目・水の中の雷・加護の倍率を掛けて傷を与える。効かない時も気づかせる。効いたら性質を移す。
 * もとは src/game/20-chant-hits.js）
 */
export function applyHit(m: Mob, dmg: number, sp: Spec, quiet?: boolean): void {
  if (m.dead) return;
  m.playerT = clock.time;
  m.lastAtk = sp.atk;
  m.lastKnock = tv(sp, 'knock');
  {
    const sg = TL(sp, 'stagger');
    if (sg && (m.wind ?? NaN) > 0 && !m.ty.boss && mr() < nth(TRAIT_V.stagger, sg)) {
      m.wind = 0;
      m.atkCd = Math.max(m.atkCd || 0, 0.8);
    }
  }
  const el = sp.elem;
  let mult = 1;
  if (el) {
    const r = (RES[m.key] || {})[el];
    if (r !== undefined) mult = r;
    if (el === 'thunder' && inWater(m)) mult *= 1.5;
  }
  hitFeedback(m, mult, el, quiet);
  if (clock.time < (player.ctrUntil || 0)) mult *= BL('counter') >= 2 ? 1.8 : 1.5;
  if (clock.time < (player.swapEdgeUntil || 0)) mult *= BL('swapedge') >= 2 ? 1.9 : 1.6;
  if (BL('reckless')) mult *= BL('reckless') >= 2 ? 1.4 : 1.25;
  if (sp.powK) mult *= sp.powK;
  if (el && clock.time < (player.momUntil || 0)) mult *= BL('momentum') >= 2 ? 1.4 : 1.25;
  if (m.st && (m.st.burn ?? NaN) > 0) {
    if (BL('kindle')) mult *= BL('kindle') >= 2 ? 1.4 : 1.25;
    if (BL('scorch')) {
      mult *= BL('scorch') >= 2 ? 1.7 : 1.5;
      m.st.scorched = true;
    }
  }
  const n = Math.round(dmg * mult);
  if (n > 0) damageMonster(m, n, el === 'fire' ? 'fire' : el || 'magic');
  else if (!m.noticed && hostile(m)) {
    m.sleep = false;
    m.aware = 1.25;
    onNoticed(m);
  }
  if (el && mult > 0.25 && !m.dead) applyElem(m, el, sp, dmg);
}
/**
 * 性質を生き物に移す（燃える・冷える・痺れる・毒。前の性質と出会えば反応が起きる。連鎖の効き方で、近くの敵へも移る。
 * もとは src/game/20-chant-hits.js）
 */
export function applyElem(m: Mob, el: string, sp: Spec, base: number): void {
  const st = m.st || (m.st = {}),
    durK = (1 + (sp.aff.dur || 0) / 100) * sp.pow * (1 + 0.5 * bodyN('linger')),
    areaK = 1 + (sp.aff.area || 0) / 100;
  if (el === 'fire') {
    if ((st.chill ?? NaN) > 0) react('steam', m, sp, base);
    else if ((st.poison ?? NaN) > 0) react('blast', m, sp, base);
    else if ((st.shock ?? NaN) > 0) react('overload', m, sp, base);
    if (!m.dead) {
      st.burn = Math.max(st.burn || 0, 3 * durK);
      const ci = m.cz * MW + m.cx;
      if (!level().liquid[ci] && clock.time - (m.fireT2 || -9) >= 0.5) {
        m.fireT2 = clock.time;
        burstFire(ci, 0.6 * areaK, 0.7);
      }
    }
  } else if (el === 'ice') {
    if ((st.burn ?? NaN) > 0) react('steam', m, sp, base);
    else if ((st.poison ?? NaN) > 0) react('frostbite', m, sp, base);
    if (!m.dead) st.chill = Math.max(st.chill || 0, 2.5 * durK);
    if (clock.time - (m.iceT || -9) >= 0.5) {
      m.iceT = clock.time;
      chillArea(m.x, m.z, 0.9 * areaK);
    }
  } else if (el === 'thunder') {
    if ((st.chill ?? NaN) > 0) react('shatter', m, sp, base);
    else if ((st.poison ?? NaN) > 0) react('contagion', m, sp, base);
    else if ((st.burn ?? NaN) > 0) react('overload', m, sp, base);
    if (!m.dead) {
      st.shock = Math.max(st.shock || 0, 0.4 * sp.pow);
      m.wind = 0;
    }
    if (clock.time - (m.chainT || -9) >= 0.5) {
      m.chainT = clock.time;
      chainLightning(m, 1 + (sp.aff.chain || 0), Math.max(1, Math.round(base * 0.5)), areaK);
      conductWater(m, base);
    }
  } else if (el === 'poison') {
    if ((st.burn ?? NaN) > 0) react('blast', m, sp, base);
    else if ((st.chill ?? NaN) > 0) react('frostbite', m, sp, base);
    else if ((st.shock ?? NaN) > 0) react('contagion', m, sp, base);
    if (!m.dead) st.poison = Math.max(st.poison || 0, 5 * durK);
  }
  if (el !== 'thunder' && sp.aff.chain && clock.time - (m.chainT2 || -9) >= 0.5) {
    m.chainT2 = clock.time;
    let from = m;
    const seen = new Set([m]);
    for (let k = 0; k < sp.aff.chain; k++) {
      const nx = nearestFoe(from.x, from.z, 4 * areaK, seen, from.y + 0.6 * from.ty.scale);
      if (!nx) break;
      seen.add(nx);
      zapLine(from, nx, must(elemCol(el)), el);
      const s2 = nx.st || (nx.st = {});
      if (el === 'fire') s2.burn = Math.max(s2.burn || 0, 2 * durK);
      else if (el === 'ice') s2.chill = Math.max(s2.chill || 0, 1.8 * durK);
      else if (el === 'poison') s2.poison = Math.max(s2.poison || 0, 3.5 * durK);
      from = nx;
    }
  }
}
/**
 * 性質の反応（kind：蒸気・爆炎・過負荷・砕け・凍傷・伝染）。まわりの敵を巻き込む。初めて起きた反応は魔導書に記す（もとは src/game/20-chant-hits.js）
 */
export function react(kind: string, m: Mob, sp: Spec, base: number): void {
  const st = must(m.st),
    areaK = 1 + (sp.aff.area || 0) / 100,
    cx = m.x,
    cz = m.z,
    cy = m.y + 0.6 * m.ty.scale;
  const around = (r: number, f: (o: Mob) => void) => {
    for (const o of here.monsters) {
      if (!foe(o)) continue;
      if (Math.hypot(o.x - cx, o.z - cz) < r && (o === m || losClear(cx, cy, cz, ...mCenter(o)))) f(o);
    }
  };
  const burst = (chars: string[], col: readonly number[], n: number, sp2: number) => {
    for (let q = 0; q < n; q++) {
      const a = mr() * 6.28,
        e = mr();
      spawn(
        cx,
        cy,
        cz,
        Math.cos(a) * sp2 * (0.5 + e),
        0.6 + mr() * 2.2,
        Math.sin(a) * sp2 * (0.5 + e),
        0.8 + mr() * 0.7,
        G(mpick(chars)),
        0.22,
        nth(col, 0),
        nth(col, 1),
        nth(col, 2),
        0,
      );
    }
  };
  if (kind === 'steam') {
    st.burn = 0;
    st.chill = 0;
    burst(['~', 'o', '.'], [2.4, 2.5, 2.6], 40, 2.6);
    around(2.4 * areaK, (o) => damageMonster(o, roll(4, 7), 'magic'));
    if (sndReady()) {
      const t = must(SND.ctx).currentTime;
      sEnv(sNoise(t, 1.0, 'highpass', 1800, 0.5, sOut(cx, cz, 0.4)), t, 0.02, 0.9);
    }
  } else if (kind === 'blast') {
    st.burn = 0;
    st.poison = 0;
    burst(['*', '#', '%', "'"], [3.4, 1.8, 0.5], 50, 3.4);
    burstFire(m.cz * MW + m.cx, 1.3 * areaK, 1.0);
    around(2.6 * areaK, (o) => damageMonster(o, roll(5, 9), 'fire'));
    if (Math.hypot(player.x - cx, player.z - cz) < 2.0 * areaK) hurtPlayer(roll(1, 3), '爆炎');
    sBoom(0.4);
    vfx.flash = Math.max(vfx.flash, 0.35);
    vfx.shake = Math.max(vfx.shake, 0.25);
  } else if (kind === 'overload') {
    st.burn = 0;
    st.shock = 0;
    burst(['*', '+', '/'], [3.2, 2.4, 1.2], 30, 3.0);
    around(2.2 * areaK, (o) => {
      damageMonster(o, roll(3, 5), 'thunder');
      const d = Math.hypot(o.x - cx, o.z - cz) || 1;
      o.kx = ((o.x - cx) / d) * 5;
      o.kz = ((o.z - cz) / d) * 5;
    });
    sBoom(0.25);
  } else if (kind === 'shatter') {
    st.chill = 0;
    burst(['*', '/', '\\', '+'], [1.6, 2.4, 3.2], 36, 3.2);
    damageMonster(m, Math.round(base * 2), 'magic');
    if (sndReady()) {
      const t = must(SND.ctx).currentTime;
      sEnv(sNoise(t, 0.4, 'highpass', 4200, 1.2, sOut(cx, cz, 0.45)), t, 0.002, 0.35);
    }
  } else if (kind === 'frostbite') {
    st.poison = (st.poison || 0) * 2 + 3;
    st.chill = Math.max(st.chill || 0, 2);
    burst(['*', '.'], [1.2, 2.6, 1.8], 24, 1.6);
  } else if (kind === 'contagion') {
    around(4 * areaK, (o) => {
      if (o === m) return;
      const s2 = o.st || (o.st = {});
      s2.poison = Math.max(s2.poison || 0, st.poison || 4);
      zapLine(m, o, must(lookup(RUNE_DEF, 'poison').col), 'poison');
    });
    burst(['%', '.'], [1.2, 3.0, 1.0], 20, 1.8);
  }
  if (!saved.BOOK.has(kind)) {
    saved.BOOK.add(kind);
    try {
      localStorage.setItem('al_book', JSON.stringify([...saved.BOOK]));
    } catch {}
    setTimeout(() => sChime(player.x, player.z, 0.35), 120);
  }
}
/** 稲妻が近くの敵へ跳ぶ（jumps 回まで。少しずつ遅れて、雷の効き目と水の中の倍率で傷を与え、痺れさせる。もとは src/game/20-chant-hits.js） */
export function chainLightning(m: Mob, jumps: number, dmg: number, areaK: number): void {
  let from = m;
  const seen = new Set([m]),
    order: [Mob, Mob][] = [];
  sparkCrown(m, must(lookup(RUNE_DEF, 'thunder').col));
  vfx.zapFlash = { x: m.x, y: m.y + 0.6 * m.ty.scale, z: m.z, col: must(lookup(RUNE_DEF, 'thunder').col), t: 0.16, r: 6 };
  for (let k = 0; k < jumps; k++) {
    const nx = nearestFoe(from.x, from.z, 4 * areaK, seen, from.y + 0.6 * from.ty.scale);
    if (!nx) break;
    seen.add(nx);
    order.push([from, nx]);
    from = nx;
  }
  order.forEach(([a, b], k) =>
    fight.zapQueue.push({
      t: 0.08 * (k + 1),
      fn: () => {
        if (b.dead) return;
        const ay = a.y + 0.6 * a.ty.scale,
          by = b.y + 0.6 * b.ty.scale;
        addBolt([a.x, ay, a.z], [b.x, by, b.z], must(lookup(RUNE_DEF, 'thunder').col), 'thunder');
        let mult = (RES[b.key] || {})['thunder'];
        if (mult === undefined) mult = 1;
        if (inWater(b)) mult *= 1.5;
        const n = Math.round(dmg * mult);
        if (n > 0) damageMonster(b, n, 'thunder');
        if (!b.dead) {
          const s2 = b.st || (b.st = {});
          s2.shock = Math.max(s2.shock || 0, 0.3);
          b.wind = 0;
        }
        sparkCrown(b, must(lookup(RUNE_DEF, 'thunder').col));
        vfx.zapFlash = { x: b.x, y: by, z: b.z, col: must(lookup(RUNE_DEF, 'thunder').col), t: 0.16, r: 6 };
        if (sndReady()) {
          const t = must(SND.ctx).currentTime,
            o = sOut(b.x, b.z, 0.3);
          sEnv(sNoise(t, 0.16, 'highpass', 3200, 0.6, o), t, 0.002, 0.14);
          sEnv(sTone(t, 'square', 700 + k * 180, 300, 0.08, o), t, 0.002, 0.07, 0.5);
        }
      },
    }),
  );
  if (sndReady()) {
    const t = must(SND.ctx).currentTime;
    sEnv(sNoise(t, 0.18, 'highpass', 3200, 0.6, sOut(m.x, m.z, 0.25)), t, 0.002, 0.16);
  }
}
/** 水の中の生き物に雷が当たると、同じ水の中の近くの敵（6 以内、多くても7）へ伝わる（もとは src/game/26-spells-hud.js） */
export function conductWater(m: Mob, base: number): void {
  if (!inWater(m)) return;
  let n = 0;
  for (const o of here.monsters) {
    if (o === m || !foe(o) || !inWater(o)) continue;
    if (Math.hypot(o.x - m.x, o.z - m.z) > 6) continue;
    if (n++ > 5) break;
    addBolt([m.x, 0.15, m.z], [o.x, 0.15, o.z], must(lookup(RUNE_DEF, 'thunder').col), 'thunder');
    const r = (RES[o.key] || {})['thunder'],
      k = r === undefined ? 1 : r,
      d2 = Math.round(Math.max(1, base * 0.5) * k * 1.5);
    if (d2 > 0) damageMonster(o, d2, 'thunder');
    if (!o.dead) {
      const s2 = o.st || (o.st = {});
      s2.shock = Math.max(s2.shock || 0, 0.3);
      o.wind = 0;
    }
    sparkCrown(o, must(lookup(RUNE_DEF, 'thunder').col));
  }
}
/** 性質を地面のマス ci に落とす（火は燃える所に火を、氷は冷気を、雷は水の中の敵へ。もとは src/game/26-spells-hud.js） */
export function landElem(sp: Spec, x: number, _y: number, z: number, ci: number): void {
  if (!sp.elem || ci < 0 || ci >= NCELL) return;
  const areaK = 1 + (sp.aff.area || 0) / 100;
  if (sp.elem === 'fire') {
    if (doorBlock(ci) || (level().tile[ci] !== TW && level().tile[ci] !== TX && !level().liquid[ci])) burstFire(ci, 0.5 * areaK, 0.9);
  } else if (sp.elem === 'ice') chillArea(x, z, 1.2 * areaK);
  else if (sp.elem === 'thunder') {
    const lq = level().liquid[ci];
    if (lq === LQ_WATER || lq === LQ_DEEP) {
      for (const o of here.monsters) {
        if (!foe(o) || !inWater(o) || Math.hypot(o.x - x, o.z - z) > 5) continue;
        addBolt([x, 0.15, z], [o.x, 0.15, o.z], must(lookup(RUNE_DEF, 'thunder').col), 'thunder');
        damageMonster(o, 2, 'thunder');
      }
    }
  }
}
/** 倒した時に放つ発動のルーン：手ごとに、一番近い見通せる敵へ術を放つ（剣は近くだけ。もとは src/game/20-chant-hits.js） */
export function onKilledBy(m: Mob): void {
  for (const h of ['L', 'R'] as const) {
    if (h === 'R' && isTwo()) continue;
    const H = must(gear.hands)[h];
    if (!(H.trig && H.trig.type === 'kill') || !H.atk || fight.trigCd[h] > 0 || gear.swapSt) continue;
    const [ox, oy, oz] = handPoint(h);
    let t = null,
      bd = 15;
    for (const o of here.monsters) {
      if (o === m || !foe(o)) continue;
      const dd = Math.hypot(o.x - player.x, o.z - player.z);
      if (dd >= bd) continue;
      if (!losClear(ox, oy, oz, ...mCenter(o))) continue;
      bd = dd;
      t = o;
    }
    if (!t) continue;
    const cy = t.y + 0.6 * t.ty.scale,
      d = Math.hypot(t.x - ox, cy - oy, t.z - oz) || 1;
    fight.trigCd[h] = 0.5;
    if (
      ((atkType(h) === 'blade' || atkType(h) === 'gsweep') && Math.hypot(t.x - player.x, t.z - player.z) > 2.9) ||
      (atkType(h) === 'dash' && Math.hypot(t.x - player.x, t.z - player.z) > 4.5)
    )
      continue;
    castNow(h, { dir: [(t.x - ox) / d, (cy - oy) / d, (t.z - oz) / d], auto: true });
  }
}
/**
 * 生き物に傷を与える（how：攻撃の種類。'env' は罠や火などまわりの物）。眠っている物は3倍。倒れたら、主・伝説の物・祭壇・発動のルーン・経験・
 * 加護（勢い・砕け）・体の粒・音・伝言（もとは src/game/18-level-player.js）
 */
export function damageMonster(m: Mob, n: number, how: string): void {
  if (m.dead || n <= 0) return;
  if (m.key === 'final' && (m.invulnT ?? NaN) > 0) {
    if (how !== 'env') hitFeedback(m, 0, null, false);
    return;
  }
  if (m.sleep && how !== 'env') {
    n *= SLEEP_MULT;
    // a hit on a sleeper: a bright gold burst and a deep strike sound instead of words
    for (let q = 0; q < 22; q++) {
      const a = mr() * 6.28,
        e = mr() * 1.2;
      spawn(
        m.x,
        m.y + 0.6 * m.ty.scale,
        m.z,
        Math.cos(a) * 2.4,
        0.8 + e * 1.6,
        Math.sin(a) * 2.4,
        0.6 + mr() * 0.5,
        G(mpick(['*', '+', "'"])),
        0.2,
        3.4,
        2.6,
        1.0,
        0,
      );
    }
    vfx.shake = Math.max(vfx.shake, 0.18);
    if (sndReady()) {
      const t = must(SND.ctx).currentTime;
      sEnv(sTone(t, 'square', 180, 60, 0.18, sOut(m.x, m.z, 0.35)), t, 0.005, 0.25);
    }
  }
  if (m.ty.dummy) {
    m.dsum = (m.dsum || 0) + n;
    m.dT = 2;
  }
  m.hp = (m.hp ?? NaN) - n;
  m.hitT = 0.22;
  m.sleep = false;
  if (m.hidden) m.revealNow = true;
  rallyOnHit(m, n, how);
  if (how !== 'env' && clock.time - (m.playerT || -99) < 0.05) hitReact(m, n);
  if (!m.noticed && hostile(m)) {
    m.aware = 1.25;
    onNoticed(m);
  }
  for (let q = 0; q < 10; q++) {
    const a = mr() * 6.28;
    spawn(
      m.x,
      m.y + 0.6 * m.ty.scale + mr() * 0.4,
      m.z,
      Math.cos(a) * 1.4,
      0.6 + mr() * 1.2,
      Math.sin(a) * 1.4,
      0.5 + mr() * 0.3,
      G(mpick(['*', '+', '.'])),
      0.14,
      2.2,
      1.9,
      1.6,
      0,
    );
  }
  if (m.hp <= 0) {
    m.dead = true;
    adv.runStats.kills++;
    lordFell(m);
    if (m.key === 'final') setTimeout(victory, 1800);
    if (how !== 'env') {
      dropRune(m);
      onKilledBy(m);
    }
    if (clock.time - (m.playerT || -99) < 6) gainExp(expOf(m));
    if (BL('momentum') && clock.time - (m.playerT || -99) < 1) player.momUntil = clock.time + 3;
    if (BL('shatter') && m.st && (m.st.chill ?? NaN) > 0 && clock.time - (m.playerT || -99) < 0.1)
      coldSnap(m.x, m.z, BL('shatter') >= 2 ? 3.5 : 2.5);
    for (const p of m.form) {
      if (mr() < 0.6) continue;
      const a = mr() * 6.28;
      spawn(
        m.x + p.x * m.ty.scale,
        m.y + p.y * m.ty.scale,
        m.z + p.z * m.ty.scale,
        Math.cos(a) * 1.2,
        0.3 + mr() * 1.5,
        Math.sin(a) * 1.2,
        0.8 + mr() * 0.8,
        p.g,
        0.18,
        m.ty.col[0] * 1.6,
        m.ty.col[1] * 1.6,
        m.ty.col[2] * 1.6,
        0,
      );
    }
    if (sndReady()) {
      const t = must(SND.ctx).currentTime;
      sEnv(sTone(t, 'triangle', 300, 90, 0.4, sOut(m.x, m.z, 0.3)), t, 0.01, 0.35);
    }
    msg(`<b style="color:${css(m.ty.col)}">${m.ty.ch}</b>${mname(m)}を倒した。${how === 'fire' ? '炎に巻かれて崩れ落ちた。' : ''}`);
  }
}
/**
 * プレイヤーが傷を受ける（加護と護符で増減。受けた分の一部は取り戻せる。体が赤く光って揺れ、音と伝言（同じ原因は 0.8 秒あける）。
 * 体力が尽きたら死ぬ。もとは src/game/18-level-player.js）
 */
export function hurtPlayer(n: number, cause: string): void {
  if (ui.godMode) return;
  if (BL('reckless')) n *= BL('reckless') >= 2 ? 1.35 : 1.25;
  n *= Math.max(0.4, 1 - 0.15 * bodyN('ward'));
  if (adv.dead || !ui.started || ui.gallery || n <= 0) return;
  player.hp -= n;
  player.lastHurt = clock.time;
  {
    const mn = bodyN('mend');
    player.rally = Math.min(Math.max(0, adv.PLAYER_MAX - player.hp), (player.rally || 0) + n * 0.6);
    player.rallyRate = player.rally / Math.max(1, 4 * (1 + 0.5 * mn) - 0.6);
  }
  vfx.hurtFlash = Math.min(1.2, vfx.hurtFlash + 0.35 + n * 0.05);
  vfx.shake = Math.max(vfx.shake, Math.min(0.5, 0.12 + n * 0.03));
  if (sndReady()) {
    const t = must(SND.ctx).currentTime;
    sEnv(sTone(t, 'sine', 140, 60, 0.25, sOut(undefined, undefined, 0.35)), t, 0.01, 0.22);
  }
  if (clock.time - (hurtPlayer.mt || -9) > 0.8 || hurtPlayer.mc !== cause) {
    hurtPlayer.mt = clock.time;
    hurtPlayer.mc = cause;
    msg(`<b style="color:#ff5a4a">-</b>${cause}で ${n} のダメージを受けた。`);
  }
  if (player.hp <= 0) player.hp = 0;
  renderStatus();
  if (player.hp <= 0) die(cause);
}
// 型だけの declare namespace で、関数の欄の型を付ける（組み立てで消える。古い JS の文をそのまま残すため）
export declare namespace hurtPlayer {
  /** 傷の伝言を最後に出したゲームの時刻と、その原因 */
  let mt: number | undefined;
  let mc: string | undefined;
}
/**
 * 転がって攻撃をかわした時：加護の身軽な詠唱（quickdodge）と返しの一撃（counter）の効く間を始め、かわした時に放つ発動のルーンで、手ごとに、
 * かわした相手へ術を放つ（剣は近くだけ）。粒と音（もとは src/game/26-spells-hud.js）。生き物の攻撃1回ごとに呼ばれる（何体も同時なら、効く間を入れ直すだけ）
 */
export function onDodged(m: Mob): void {
  if (BL('quickdodge')) player.qcUntil = clock.time + (BL('quickdodge') >= 2 ? 2.5 : 1.5);
  if (BL('counter')) player.ctrUntil = clock.time + 1.5;
  if (!gear.hands) return;
  let any = false;
  for (const h of ['L', 'R'] as const) {
    const H = gear.hands[h];
    if (!(H.trig && H.trig.type === 'dodge' && H.atk) || fight.trigCd[h] > 0 || gear.swapSt) continue;
    if (
      ((atkType(h) === 'blade' || atkType(h) === 'gsweep') && Math.hypot(m.x - player.x, m.z - player.z) > 2.9) ||
      (atkType(h) === 'dash' && Math.hypot(m.x - player.x, m.z - player.z) > 4.5)
    )
      continue;
    const [ox, oy, oz] = handPoint(h),
      c = mCenter(m),
      d = Math.hypot(c[0] - ox, c[1] - oy, c[2] - oz) || 1;
    fight.trigCd[h] = 0.6;
    any = true;
    castNow(h, { dir: [(c[0] - ox) / d, (c[1] - oy) / d, (c[2] - oz) / d], auto: true });
  }
  for (let q = 0; q < 16; q++) {
    const a = mr() * 6.28;
    spawn(
      player.x + Math.cos(a) * 0.6,
      1.0 + mr(),
      player.z + Math.sin(a) * 0.6,
      Math.cos(a) * 1.5,
      0.3,
      Math.sin(a) * 1.5,
      0.4,
      G(mpick(['~', "'", '.'])),
      0.12,
      1.6,
      2.2,
      2.6,
      0,
    );
  }
  if (any && sndReady()) {
    const t = must(SND.ctx).currentTime;
    sEnv(sTone(t, 'sine', 1320, 1980, 0.18, sOut(undefined, undefined, 0.12)), t, 0.003, 0.16);
  }
}
/** 生き物の近接の攻撃：届く所で溜め（0.55 秒）、溜め終わりに届けば当てる（転がっていればかわす。もとは src/game/18-level-player.js） */
export function monsterStrike(m: Mob, dt: number, dp: number): void {
  if (!hostile(m) || !m.noticed || m.sleep || adv.dead) return;
  if (m.ty.form === 'eel' && !(m.surf > 0)) return;
  if ((m.ty.habitat === 'deep' || m.ty.habitat === 'bog') && (m.rise || 0) < 0.5) return;
  const st = statOf(m),
    reach = m.ty.habitat === 'deep' ? 3.2 : 0.95 + 0.45 * m.ty.scale;
  m.atkCd = (m.atkCd ?? NaN) - dt;
  if ((m.wind ?? NaN) > 0) {
    m.wind = (m.wind ?? NaN) - dt;
    if (m.wind <= 0) {
      m.atkCd = nth(st, 3);
      if (dp < reach + 0.35) {
        if (player.roll) {
          onDodged(m);
          if (clock.time - (monsterStrike.mt || -9) > 2) {
            monsterStrike.mt = clock.time;
            msg(`<b style="color:#9fe0ff">~</b>転がって${mname(m)}の攻撃をかわした！`);
          }
        } else hurtPlayer(roll(nth(st, 1), nth(st, 2)), m.ty.name);
      }
    }
  } else if (dp < reach && m.atkCd <= 0 && nth(st, 2) > 0) {
    m.wind = 0.55;
  }
}
// 型だけの declare namespace で、関数の欄の型を付ける（組み立てで消える。古い JS の文をそのまま残すため）
export declare namespace monsterStrike {
  /** かわした伝言を最後に出したゲームの時刻（2秒あける） */
  let mt: number | undefined;
}
