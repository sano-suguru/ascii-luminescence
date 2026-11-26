// 詠唱と当たり（もとは src/game/18-level-player.js・20-chant-hits.js・21-altars-heal.js・24-goal.js）：遅れて起きること、魔法の場、雨、連射、
// 剣の波、当たった時の見た目と音、ひるみと吹き飛び、水の中か、稲妻の線、近くの敵、冷気、立ち直り、主が倒れた時の祭壇と伝説の物、経験。
// 状態の入れ物 fight・player・here・adv・clock に頼る。
import { lookup, must, nth } from './array.ts';
import { handPoint, losClear, shotFrame } from './aim.ts';
import { placeAltar } from './altars.ts';
import { sChime, sNoise, sOut, sTone, sWhoosh, sndReady } from './audio.ts';
import { css } from './color.ts';
import { addBolt } from './fx.ts';
import { type Spec, bodyN } from './gear.ts';
import { G } from './glyphs.ts';
import { chillArea } from './ground.ts';
import { getLegend, legendOfBranch } from './legend.ts';
import { msg } from './log.ts';
import { foe, BL } from './monsters.ts';
import { mCenter, turnDir } from './math.ts';
import { LEGEND_KINDS, mname } from './names.ts';
import { spawn } from './particles.ts';
import { expNeed } from './progress.ts';
import { mpick, mr } from './random.ts';
import { RALLY_FROM, RUNE_DEF, TL, TRAIT_V, elemCol, tv } from './runes.ts';
import { sEnv } from './sound.ts';
import { type Mob, SND, adv, clock, fight, here, player } from './state.ts';
import { renderStatus } from './status.ts';
import { LQ_DEEP, LQ_WATER, MW, TF } from './world.ts';

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
  const de = 0,
    n = 8 + 3 * (sp.aff.count || 0),
    r = 1.8 * (tv(sp, 'area') ?? NaN),
    span = 0.6 * (tv(sp, 'span') ?? NaN);
  fight.rains.push({ x, z, r, n, left: n, iv: span / n, tick: again ? 0 : 0.45, sp, follow: false, elemK: 0.25, again: !!again });
  fight.marks.push({ x, z, r, t: (again ? 0 : 0.45) + span, c: must(elemCol(sp.elem)) });
  if (de >= 3 && !again) later(0.45 + span + 0.25, () => startRain(sp, x, z, true));
}
/** 連射（0.07 秒ごとに矢を撃つ。opt.dir があればその向きへ、ほかは照準へ。少しばらつく） */
export function castRapid(h: string, sp: Spec, opt: { dir?: V3 | null | undefined; auto?: boolean | undefined }): void {
  const vo = 0,
    sd = 0,
    hv = 0,
    ac = TL(sp, 'accuracy'),
    n = 3 + (sp.aff.count || 0),
    volleys = 1;
  for (let v = 0; v < volleys; v++)
    for (let k = 0; k < n; k++)
      later(k * 0.07 + v * 0.45, () => {
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
          homing: (sp.aff.homing || 0) + (sd >= 2 ? 20 : sd >= 1 ? 10 : 0),
          hit: new Set(),
          dmg: lookup(RUNE_DEF, 'rapid').dmg,
          dmgK: (sd >= 4 ? 1.3 : 1) * (hv >= 4 ? 1.4 : hv >= 2 ? 1.2 : 1),
          pierce: sd >= 3 ? 1 : 0,
          keep: true,
          heavy: hv,
          steady: sd,
          boom: vo >= 5 && k === n - 1,
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
  // @ts-expect-error -- 古い JS のまま（使っていない。tools/same-code.mjs が同じ文と見るため）
  const strong = (m.maxHp || 0) >= 40 || (m.isLead && (m.g ?? NaN) >= 0),
    lord = m.key === 'lord' || m.ty.lord;
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
