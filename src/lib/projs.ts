// 飛ぶ物と、毎フレーム続く戦いの跡を進める（もとは src/game/20-chant-hits.js・26-spells-hud.js）：矢と玉（まっすぐ飛ぶ矢・弧を描いて弾ける玉。
// 跳ね返る・追う・貫く・壁を抜ける）、状態異常（燃える・毒・冷える・動けない・痺れる）と吹き飛び、毒の霧、遅れて起きること、魔法の場、雨、
// 毒の霧に火がつく、生き物の時間の速さ。状態の入れ物 fight・here・player・clock・vfx・blaze・saved に頼る。呼ぶのは古い JS のメインループ（30-loop-init.js の tick）。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う結果になるので、順番を変えないこと。
import { lookup, must, nth } from './array.ts';
import { doorBlock, hittable, losClear, reflectDir } from './aim.ts';
import { sBoom } from './audio.ts';
import { applyElem, applyHit, burstFire, damageMonster, hurtPlayer, landElem, later, orbBurst } from './combat.ts';
import { G } from './glyphs.ts';
import { mCenter } from './math.ts';
import { foe, BL } from './monsters.ts';
import { spawn } from './particles.ts';
import { mpick, mr, roll } from './random.ts';
import { clamp } from './rng.ts';
import { RES, RUNE_DEF, TL, TRAIT_V, elemCol } from './runes.ts';
import { type Mob, type Proj, TEST, blaze, clock, fight, here, player, saved, vfx } from './state.ts';
import { CELL, LQ_LAVA, MH, MW, NCELL, TC, TW, TX } from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/** 雨を降らせる（敵を追う雨は近くの敵へ寄る。一粒ずつ落とし、少し遅れて当て、ときどき性質を地面に落とす）と、床の目印を進める */
export function updateRains(dt: number): void {
  for (const rn of fight.rains) {
    rn.tick -= dt;
    if (rn.follow) {
      let best: Mob | null = null,
        bd = 4;
      for (const m of here.monsters) {
        if (!foe(m)) continue;
        const dd = Math.hypot(m.x - rn.x, m.z - rn.z);
        if (dd < bd) {
          bd = dd;
          best = m;
        }
      }
      if (best) {
        const k = Math.min(1, (dt * 2) / Math.max(0.1, bd));
        rn.x += (best.x - rn.x) * k;
        rn.z += (best.z - rn.z) * k;
      }
    }
    while (rn.tick <= 0 && rn.left > 0) {
      rn.tick += rn.iv;
      rn.left--;
      const a = mr() * 6.28,
        rr = Math.sqrt(mr()) * rn.r,
        px = rn.x + Math.cos(a) * rr,
        pz = rn.z + Math.sin(a) * rr,
        c = elemCol(rn.sp.elem),
        sp = rn.sp,
        eK = rn.elemK;
      spawn(px, 4.6, pz, 0, -24, 0, 0.19, G('|'), 0.16, nth(must(c), 0) * 2.4, nth(must(c), 1) * 2.4, nth(must(c), 2) * 2.4, 0);
      later(0.18, () => {
        for (let q = 0; q < 3; q++)
          spawn(
            px,
            0.05,
            pz,
            (mr() - 0.5) * 1.2,
            0.4 + mr() * 0.5,
            (mr() - 0.5) * 1.2,
            0.3,
            G('.'),
            0.1,
            nth(must(c), 0) * 2.2,
            nth(must(c), 1) * 2.2,
            nth(must(c), 2) * 2.2,
            0,
          );
        for (const m of here.monsters) {
          if (!hittable(m)) continue;
          if (Math.hypot(m.x - px, m.z - pz) < 0.7 + 0.3 * m.ty.scale) {
            m.playerT = clock.time;
            applyHit(m, roll(nth(must(lookup(RUNE_DEF, 'rain').dmg), 0), nth(must(lookup(RUNE_DEF, 'rain').dmg), 1)), sp, true);
          }
        }
        if (sp.elem && mr() < eK) {
          const ci = Math.floor(pz / CELL) * MW + Math.floor(px / CELL);
          if (ci >= 0 && ci < NCELL) landElem(sp, px, 0.1, pz, ci);
        }
      });
    }
    if (rn.left <= 0 && !rn.done) {
      rn.done = true;
    }
  }
  fight.rains = fight.rains.filter((rn) => !rn.done);
  for (const mk of fight.marks) mk.t -= dt;
  fight.marks = fight.marks.filter((mk) => mk.t > 0);
}
/**
 * 溶岩を歩けない生き物 m（飛ぶ物と溶岩に住む物のほか）の体（半径 0.35×大きさ）が、溶岩のマスにどれだけ入っているか
 * （溶岩のマスごとのめり込みを足した物。めり込みは、体の真ん中がマスの外なら 半径−縁までの距離、中なら 半径＋縁までの距離。かかっていなければ 0）
 */
function lavaDepth(m: Mob): number {
  if (m.ty.flier || m.ty.habitat === 'lava') return 0;
  const r = 0.35 * m.ty.scale,
    cx = Math.floor(m.x / CELL),
    cz = Math.floor(m.z / CELL),
    reach = Math.ceil(r / CELL);
  let deep = 0;
  for (let dz = -reach; dz <= reach; dz++)
    for (let dx = -reach; dx <= reach; dx++) {
      const x = cx + dx,
        z = cz + dz;
      if (x < 0 || z < 0 || x >= MW || z >= MH || level().liquid[z * MW + x] !== LQ_LAVA) continue;
      const x0 = x * CELL,
        z0 = z * CELL,
        inside = m.x >= x0 && m.x <= x0 + CELL && m.z >= z0 && m.z <= z0 + CELL,
        d = inside
          ? r + Math.min(m.x - x0, x0 + CELL - m.x, m.z - z0, z0 + CELL - m.z)
          : r - Math.hypot(m.x - clamp(m.x, x0, x0 + CELL), m.z - clamp(m.z, z0, z0 + CELL));
      if (d > 0) deep += d;
    }
  return deep;
}
/**
 * 状態異常を進める（生き物の速さを数え直し、吹き飛びを進める。吹き飛びは、壁・通れない物と、溶岩を歩けない生き物には溶岩の手前で止まる。燃える・毒は傷を与え、冷える・動けない・痺れるは時間が減る。
 * 見えていれば粒を出す）。毒の霧の中の敵を毒にし、遅れて起きることと魔法の場と雨を進める
 */
export function updateStatuses(dt: number): void {
  if (dt > 0)
    for (const m of here.monsters) {
      if (m.plx !== undefined) {
        const k = Math.min(1, dt * 8);
        m.vlx = (m.vlx || 0) + ((m.x - m.plx) / dt - (m.vlx || 0)) * k;
        m.vlz = (m.vlz || 0) + ((m.z - (m.plz ?? NaN)) / dt - (m.vlz || 0)) * k;
      }
      m.plx = m.x;
      m.plz = m.z;
    }
  for (const m of here.monsters) {
    const st = m.st;
    if (!st || m.dead) continue;
    const vis = m.visible && Math.hypot(m.x - player.x, m.z - player.z) < 26,
      cy = m.y + 0.6 * m.ty.scale;
    if (m.kx || m.kz) {
      const mx = (m.kx ?? NaN) * dt,
        mz = (m.kz ?? NaN) * dt,
        deep0 = lavaDepth(m);
      m.x += mx;
      m.z += mz;
      m.kx = (m.kx ?? NaN) * Math.exp(-dt * 6);
      m.kz = (m.kz ?? NaN) * Math.exp(-dt * 6);
      if (Math.abs(m.kx) + Math.abs(m.kz) < 0.05) {
        m.kx = 0;
        m.kz = 0;
      }
      // 壁・通れない物に入ったか、溶岩を歩けない生き物（飛ぶ物と溶岩に住む物のほか）の体（半径 0.35×大きさ）が、このフレームに動いて溶岩にかかった・
      // 深く入ったら、動いた分を戻して止まる（初めから体がかかっている大きな生き物も、溶岩から離れる向きには動ける）
      const ci = Math.floor(m.z / CELL) * MW + Math.floor(m.x / CELL);
      if (level().tile[ci] === TW || level().tile[ci] === TX || level().solid.has(ci) || lavaDepth(m) > deep0 + 1e-9) {
        m.x -= mx;
        m.z -= mz;
        m.kx = 0;
        m.kz = 0;
      }
      // 止まったら、行き先を今いるマスにする（吹き飛ばされる前の行き先へ、ほかのマスを横切って歩かない）
      if (!m.kx && !m.kz) {
        m.tx = Math.floor(m.x / CELL);
        m.tz = Math.floor(m.z / CELL);
      }
      m.cx = Math.floor(m.x / CELL);
      m.cz = Math.floor(m.z / CELL);
    }
    if ((st.burn ?? NaN) > 0 && (st.burn ?? NaN) - dt <= 0 && st.scorched && !m.dead && BL('scorch')) {
      m.hp = Math.min((m.maxHp || m.hp) ?? NaN, (m.hp ?? NaN) + (m.maxHp || 10) * 0.3);
      st.scorched = false;
    }
    if ((st.burn ?? NaN) > 0) {
      st.burn = (st.burn ?? NaN) - dt;
      st.bt = (st.bt || 0) - dt;
      if (st.bt <= 0) {
        st.bt = 0.5;
        const r = (RES[m.key] || {})['fire'];
        const n = Math.round(roll(1, 2) * (r === undefined ? 1 : r));
        if (n > 0) damageMonster(m, n, 'fire');
      }
      if (vis && mr() < dt * 14)
        spawn(
          m.x + (mr() - 0.5) * 0.5 * m.ty.scale,
          cy + (mr() - 0.3) * 0.5,
          m.z + (mr() - 0.5) * 0.5 * m.ty.scale,
          0,
          0.9 + mr(),
          0,
          0.5,
          G(mpick(['^', "'", '*'])),
          0.14,
          2.6,
          1.2,
          0.3,
          0,
        );
    }
    if ((st.poison ?? NaN) > 0) {
      st.poison = (st.poison ?? NaN) - dt;
      st.pt = (st.pt || 0) - dt;
      if (st.pt <= 0) {
        st.pt = 0.6;
        const r = (RES[m.key] || {})['poison'];
        const n = Math.round(1 * (r === undefined ? 1 : r));
        if (n > 0) damageMonster(m, n, 'poison');
      }
      if (vis && mr() < dt * 8)
        spawn(
          m.x + (mr() - 0.5) * 0.4 * m.ty.scale,
          cy,
          m.z + (mr() - 0.5) * 0.4 * m.ty.scale,
          0,
          -0.6,
          0,
          0.8,
          G(mpick(['.', ','])),
          0.12,
          0.6,
          1.8,
          0.5,
          1,
        );
    }
    if ((st.chill ?? NaN) > 0) {
      st.chill = (st.chill ?? NaN) - dt;
      if (vis && mr() < dt * 6)
        spawn(
          m.x + (mr() - 0.5) * 0.6 * m.ty.scale,
          cy + (mr() - 0.5) * 0.6,
          m.z + (mr() - 0.5) * 0.6 * m.ty.scale,
          0,
          0.05,
          0,
          0.7,
          G('*'),
          0.12,
          1.4,
          2.0,
          2.6,
          0,
        );
    }
    if ((st.pin ?? NaN) > 0) {
      st.pin = (st.pin ?? NaN) - dt;
      if (vis && mr() < dt * 5)
        spawn(m.x + (mr() - 0.5) * 0.4, cy + 0.3, m.z + (mr() - 0.5) * 0.4, 0, 0, 0, 0.3, G('#'), 0.12, 1.4, 1.3, 1.0, 0);
    }
    if ((st.shock ?? NaN) > 0) {
      st.shock = (st.shock ?? NaN) - dt;
      if (vis && mr() < dt * 12)
        spawn(
          m.x + (mr() - 0.5) * 0.5,
          cy + (mr() - 0.5) * 0.6,
          m.z + (mr() - 0.5) * 0.5,
          0,
          0,
          0,
          0.12,
          G(mpick(['/', '\\'])),
          0.14,
          3,
          2.8,
          1.2,
          0,
        );
    }
    if (m.dead && st) m.st = null;
  }
  for (const c of fight.clouds) {
    c.t -= dt;
    c.tick -= dt;
    if (c.tick <= 0) {
      c.tick = 0.5;
      for (const o of here.monsters) {
        if (foe(o) && Math.hypot(o.x - c.x, o.z - c.z) < c.r && losClear(c.x, 0.6, c.z, ...mCenter(o))) {
          const s2 = o.st || (o.st = {});
          s2.poison = Math.max(s2.poison || 0, 2.5);
        }
      }
    }
    if (mr() < dt * 16) {
      const a = mr() * 6.28,
        rr = Math.sqrt(mr()) * c.r;
      spawn(
        c.x + Math.cos(a) * rr,
        0.15 + mr() * 0.5,
        c.z + Math.sin(a) * rr,
        0,
        0.15,
        0,
        1.2,
        G(mpick(['%', '~', '.'])),
        0.2,
        0.5,
        1.4,
        0.45,
        0,
      );
    }
  }
  fight.clouds = fight.clouds.filter((c) => c.t > 0);
  updateZones(dt);
}
/** 生き物の時間の速さ（痺れ・動けない時は止まり、冷えると半分。隠れていない擬態は、跳ねる間だけ速く、ほかはほとんど止まる） */
export const monTimeK = (m: Mob): number => {
  let k = m.st ? ((m.st.shock ?? NaN) > 0 || (m.st.pin ?? NaN) > 0 ? 0 : (m.st.chill ?? NaN) > 0 ? 0.5 : 1) : 1;
  if (m.ty.critter === 'mimic' && !m.hidden) k *= Math.sin(clock.time * 4.5 + m.ph) > -0.3 ? 1.3 : 0.06;
  return k;
};

/**
 * 飛ぶ物を進める（矢はまっすぐ、玉は弧を描いて弾ける。どちらも跳ね返り、追うことがある）。光の月は引き寄せて焼く。
 * 生き物に当たれば当たり（矢は貫く、玉は弾ける）、壁・床・天井に当たれば、跳ね返るか、壁を抜けるか、消えて性質を地面に落とす
 */
export function updateProjs(dt: number): void {
  for (const b of fight.beamSegs) b.t -= dt;
  fight.beamSegs = fight.beamSegs.filter((b) => b.t > 0 || fight.beamRun);
  for (const p of fight.projs) {
    p.t += dt;
    if (p.kind === 'orb' && !p.noGrav) p.vy -= 9.8 * dt;
    if (p.accel) {
      const v = Math.hypot(p.vx, p.vy, p.vz) || 1,
        nv = Math.min(p.vmax ?? NaN, v + p.accel * dt);
      p.vx *= nv / v;
      p.vy *= nv / v;
      p.vz *= nv / v;
    }
    if (p.moon) {
      const R = (p.tide ? nth(TRAIT_V.pull, p.tide) : 2.6) + p.moon * 0.3;
      if (p.tide)
        for (const m of here.monsters) {
          if (!hittable(m) || m.ty.boss || m.key === 'lord' || m.key === 'final' || m.ty.habitat) continue;
          const ax = p.x - m.x,
            az = p.z - m.z,
            dd = Math.hypot(ax, az);
          if (dd > R || dd < 0.4) continue;
          const v = ((2 + p.tide * 0.6) * dt * 3) / Math.max(0.6, m.ty.scale || 1);
          m.kx = (m.kx || 0) + (ax / dd) * v;
          m.kz = (m.kz || 0) + (az / dd) * v;
          m.st = m.st || {};
          (p.pulled = p.pulled || new Set()).add(m);
        }
      const c2 = elemCol(p.sp.elem);
      for (let q = 0; q < Math.round(p.moon * 2); q++) {
        const a = mr() * 6.28,
          r = 0.25 * p.moon;
        spawn(
          p.x + Math.cos(a) * r,
          p.y + (mr() - 0.5) * r,
          p.z + Math.sin(a) * r,
          0,
          0,
          0,
          0.25,
          G(mpick(['o', 'O', '*', '(', ')'])),
          0.14 + 0.04 * p.moon,
          nth(must(c2), 0) * 2.6,
          nth(must(c2), 1) * 2.6,
          nth(must(c2), 2) * 2.6,
          0,
        );
      }
    }
    if (p.homing) {
      let best: [number, number, number] | null = null,
        bs = 0.5;
      const v = Math.hypot(p.vx, p.vy, p.vz) || 1;
      for (const m of here.monsters) {
        if (!foe(m)) continue;
        const cy = m.y + 0.6 * m.ty.scale,
          ax = m.x - p.x,
          ay = cy - p.y,
          az = m.z - p.z,
          d = Math.hypot(ax, ay, az);
        if (d > 12 || d < 0.1) continue;
        const c = (ax * p.vx + ay * p.vy + az * p.vz) / (d * v);
        if (c > bs && losClear(p.x, p.y, p.z, m.x, cy, m.z)) {
          bs = c;
          best = [ax / d, ay / d, az / d];
        }
      }
      if (best) {
        const k = Math.min(1, ((p.homing * Math.PI) / 180) * dt * 2.2);
        p.vx += (best[0] * v - p.vx) * k;
        p.vz += (best[2] * v - p.vz) * k;
        if (p.kind === 'bolt') p.vy += (best[1] * v - p.vy) * k;
      }
    }
    const nx = p.x + p.vx * dt,
      ny = p.y + p.vy * dt,
      nz = p.z + p.vz * dt,
      cx = Math.floor(nx / CELL),
      cz = Math.floor(nz / CELL);
    const c = elemCol(p.sp.elem),
      bolt = p.kind === 'bolt';
    if (mr() < (p.wave ? 0.35 : 0.85))
      spawn(
        p.x,
        p.y,
        p.z,
        (mr() - 0.5) * 0.3,
        (mr() - 0.5) * 0.3,
        (mr() - 0.5) * 0.3,
        0.35 + mr() * 0.25,
        G(mpick(p.wind ? ['~', ')', '('] : bolt ? ['*', '.', "'"] : ['o', '.', '*'])),
        p.big ? 0.24 : bolt ? 0.11 : 0.13,
        nth(must(c), 0) * 2.2,
        nth(must(c), 1) * 2.2,
        nth(must(c), 2) * 2.2,
        0,
      );
    if (cx < 0 || cz < 0 || cx >= MW || cz >= MH || p.t > (p.maxT || 4)) {
      p.dead = true;
      continue;
    }
    let hm: Mob | null = null;
    for (const m of here.monsters) {
      if (!hittable(m) || p.hit.has(m)) continue;
      if (m.ty.habitat === 'deep' && (m.rise || 0) < 0.3) continue;
      const cy = m.y + (m.ty.flier ? 0 : 0.6 * m.ty.scale);
      if (Math.hypot(m.x - nx, cy - ny, m.z - nz) < 0.42 + 0.35 * m.ty.scale + (p.kind === 'bolt' ? 0.14 : 0) + (p.rad || 0)) {
        hm = m;
        break;
      }
    }
    if (hm) {
      p.hit.add(hm);
      if (bolt) {
        const dmg = p.dmg || lookup(RUNE_DEF, 'bolt').dmg;
        applyHit(hm, Math.max(1, Math.round(roll(nth(must(dmg), 0), nth(must(dmg), 1)) * (p.dmgK || 1))), p.sp);
        if (p.pierce === undefined && !p.wind) {
          const pl = TL(p.sp, 'pierce');
          p.pierce = nth([0, 1, 1, 2, 3, 3], pl);
          p.keep = pl >= 2;
          if (pl >= 5) p.wallPass = 1;
        }
        if ((p.pierce ?? NaN) > 0) {
          // @ts-expect-error -- 上の比べ方で数と分かっている（型では言えない。古い JS のまま）
          p.pierce--;
          if (!p.keep) p.dmgK = (p.dmgK || 1) * 0.7;
          p.x = nx;
          p.y = ny;
          p.z = nz;
        } else p.dead = true;
      } else {
        if (p.moon) moonBurst(p, nx, ny, nz);
        else orbBurst(nx, ny, nz, p.sp);
        p.dead = true;
      }
      continue;
    }
    const i = cz * MW + cx,
      wall = level().tile[i] === TW || level().tile[i] === TX || doorBlock(i),
      floor = ny < 0.03 && level().tile[i] !== TC,
      ceil = ny > (level().ceil[i] ?? NaN);
    if (wall || floor || ceil) {
      if (wall && !floor && !ceil && p.wallPass === undefined && p.kind === 'bolt' && !p.wind && TL(p.sp, 'pierce') >= 5) p.wallPass = 1;
      if (wall && !floor && !ceil && (p.wallPass ?? NaN) > 0 && p.kind === 'bolt') {
        // @ts-expect-error -- 上の比べ方で数と分かっている（型では言えない。古い JS のまま）
        p.wallPass--;
        p.passing = true;
      }
      if (p.passing) {
        if (!wall) p.passing = false;
        p.x = nx;
        p.y = ny;
        p.z = nz;
        continue;
      }
      if (p.bounce > 0) {
        p.bounce--;
        if (p.kind === 'orb') orbBurst(p.x, Math.max(0.1, p.y), p.z, p.sp, { dmg: 0.6, rad: 0.7, cloud: false });
        const r = reflectDir(
          p.x,
          p.y,
          p.z,
          [p.vx * dt, p.vy * dt, p.vz * dt].map((v) => v / Math.max(1e-4, Math.hypot(p.vx, p.vy, p.vz) * dt)),
        );
        const v = Math.hypot(p.vx, p.vy, p.vz);
        p.vx = r[0] * v;
        p.vy = r[1] * v * (p.kind === 'orb' ? 0.7 : 1);
        p.vz = r[2] * v;
        if (floor && p.kind === 'orb') p.vy = Math.abs(p.vy) + 1;
        for (let q = 0; q < 5; q++) {
          const a = mr() * 6.28;
          spawn(
            p.x,
            p.y,
            p.z,
            Math.cos(a) * 1.2,
            mr(),
            Math.sin(a) * 1.2,
            0.35,
            G('.'),
            0.1,
            nth(must(c), 0) * 2.4,
            nth(must(c), 1) * 2.4,
            nth(must(c), 2) * 2.4,
            0,
          );
        }
        continue;
      }
      p.dead = true;
      if (p.moon) {
        moonBurst(p, p.x, Math.max(0.1, p.y), p.z);
        continue;
      }
      if (p.kind === 'orb') orbBurst(p.x, Math.max(0.1, p.y), p.z, p.sp);
      else {
        for (let q = 0; q < 8; q++) {
          const a = mr() * 6.28;
          spawn(
            p.x,
            Math.max(0.05, p.y),
            p.z,
            Math.cos(a) * 1.4,
            0.3 + mr(),
            Math.sin(a) * 1.4,
            0.4,
            G(mpick(['*', '.'])),
            0.12,
            nth(must(c), 0) * 2.4,
            nth(must(c), 1) * 2.4,
            nth(must(c), 2) * 2.4,
            0,
          );
        }
        landElem(p.sp, p.x, p.y, p.z, doorBlock(i) ? i : Math.floor(p.z / CELL) * MW + Math.floor(p.x / CELL));
      }
      continue;
    }
    p.x = nx;
    p.y = ny;
    p.z = nz;
  }
  fight.projs = fight.projs.filter((p) => !p.dead);
}
/** 光の月が弾ける（大きさで強く広く。引き寄せの Lv5 は引き寄せた生き物を動けなくする） */
export function moonBurst(p: Proj, x: number, y: number, z: number): void {
  const f = must(p.moon),
    sp = p.sp;
  orbBurst(x, y, z, sp, { dmg: f * 1.1, rad: 0.8 + 0.45 * f });
  vfx.shake = Math.max(vfx.shake, 0.1 + 0.05 * f);
  if ((p.tide ?? NaN) >= 5 && p.pulled)
    for (const m of p.pulled) {
      if (m.dead || m.ty.boss) continue;
      const st = m.st || (m.st = {});
      if (clock.time >= (st.pinCd || 0)) {
        st.pin = Math.max(st.pin || 0, 0.5);
        st.pinCd = clock.time + 1.6;
      }
    }
}
/**
 * 遅れて起きることを流し（中で止まっても、ゲームは続ける。コンソールに出し、テスト用モードでは外へ投げてページのエラーにする）、
 * 魔法の場を進める（0.5 秒ごとに、中にいる生き物に性質を移す。広がる場は少しずつ広がる）。雨も進める
 */
export function updateZones(dt: number): void {
  updateRains(dt);
  for (const L of fight.laters)
    if (clock.time >= L.t) {
      L.done = true;
      try {
        L.fn();
      } catch (e) {
        /* play goes on, but the error is shown in the console; in test mode, throw it outside so the page reports it */ console.error(e);
        if (TEST)
          setTimeout(() => {
            throw e;
          }, 0);
      }
    }
  fight.laters = fight.laters.filter((L) => !L.done);
  for (const zn of fight.zones) {
    zn.t -= dt;
    zn.tick -= dt;
    if (zn.grow) zn.r = Math.min(zn.r0 * 1.7, zn.r + dt * 0.18);
    if (zn.tick <= 0 && zn.el) {
      zn.tick = 0.5;
      for (const m of here.monsters) {
        if (!hittable(m) || m.ty.critter) continue;
        if (Math.hypot(m.x - zn.x, m.z - zn.z) < zn.r + 0.3 * m.ty.scale) {
          m.playerT = clock.time;
          applyElem(m, zn.el, zn.sp, 1);
        }
      }
    }
  }
  fight.zones = fight.zones.filter((zn) => zn.t > 0);
}
/** 毒の霧に火がつく（霧のマスのどこかが燃えていれば、霧ごと燃え上がる。まわりの見通せる敵とプレイヤーに傷、火を広げる。魔導書に記す） */
export function cloudsMeetFire(): void {
  for (const c of fight.clouds) {
    if (c.t <= 0) continue;
    const cx = Math.floor(c.x / CELL),
      cz = Math.floor(c.z / CELL),
      rr = Math.ceil(c.r / CELL);
    let lit = false;
    for (let dz = -rr; dz <= rr && !lit; dz++)
      for (let dx = -rr; dx <= rr; dx++) {
        if (cx + dx < 0 || cx + dx >= MW || cz + dz < 0 || cz + dz >= MH) continue;
        const i = (cz + dz) * MW + cx + dx;
        if ((blaze.fire[i] ?? NaN) > 0.1) {
          lit = true;
          break;
        }
      }
    if (!lit) continue;
    c.t = 0;
    const R = c.r + 0.6;
    for (let q = 0; q < 46; q++) {
      const a = mr() * 6.28,
        e = mr();
      spawn(
        c.x + Math.cos(a) * e * R,
        0.4 + mr() * 1.2,
        c.z + Math.sin(a) * e * R,
        Math.cos(a) * 2.4,
        0.8 + mr() * 2,
        Math.sin(a) * 2.4,
        0.9 + mr() * 0.5,
        G(mpick(['*', '#', '%', "'"])),
        0.22,
        3.2,
        1.8,
        0.6,
        0,
      );
    }
    for (const o of here.monsters) {
      if (!foe(o) || Math.hypot(o.x - c.x, o.z - c.z) > R) continue;
      if (!losClear(c.x, 0.6, c.z, ...mCenter(o))) continue;
      damageMonster(o, roll(5, 9), 'fire');
    }
    if (Math.hypot(player.x - c.x, player.z - c.z) < R * 0.8) hurtPlayer(roll(1, 3), '爆炎');
    burstFire(cz * MW + cx, c.r / CELL + 0.5, 1.0);
    sBoom(0.4);
    vfx.shake = Math.max(vfx.shake, 0.25);
    vfx.flash = Math.max(vfx.flash, 0.3);
    if (!saved.BOOK.has('blast')) {
      saved.BOOK.add('blast');
      try {
        localStorage.setItem('al_book', JSON.stringify([...saved.BOOK]));
      } catch {
        // 保存できない所（サンドボックスの iframe など）では、記録だけ残す
      }
    }
  }
}
