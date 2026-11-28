// 地面と小さな生き物（updateCritter・machineWork・splash・ignite・uploadCells・crackIce・tallAt・trample・brimFlare・regrow・brimRecover・
// chillArea・updateFrozen・initFire・stepFire・stepGas）：
// 小さな生き物（魚・草を食べる物・叫ぶ物・化けた巻物・掃除機・修復機）の動き、水しぶき、火をつける、マスの絵を描画に渡す、
// 薄い氷が割れる、背の高い茂みを踏み分ける・元に戻る、硫黄が燃え上がる・元に戻る、冷気で火を消して水を凍らせる・溶ける、階に入った時の燃える物のマス、
// 火とガスを1歩進める。
// 状態の入れ物 here（今の階と生き物）・blaze（火と地面のマス）・player・clock・ui（伝言の時刻と旗）・stealth（忍び足）・vfx（揺れ）・SND（音）と、
// マスの絵 gfx.cellTex・その中身 cellData・薄い氷に乗っていた秒 iceT に頼る。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う動きと見た目になるので、順番を変えないこと。
import { must, nth } from './array.ts';
import { sBubble, sChime, sCrackleBurst, sDist, sHiss, sNoise, sOut, sShriek, sSplash, sSqueak, sTone, sndReady } from './audio.ts';
import { type Color, css } from './color.ts';
import { boom } from './combat.ts';
import { G } from './glyphs.ts';
import { msg } from './log.ts';
import { lerpAngle } from './math.ts';
import { critterStep, jobCells, jobReach, walkSteps } from './monsters.ts';
import { mname } from './names.ts';
import { spawn } from './particles.ts';
import { mpick, mr } from './random.ts';
import { sEnv } from './sound.ts';
import { type Mob, SND, blaze, cellData, clock, gfx, here, iceT, player, stealth, ui, vfx } from './state.ts';
import {
  CELL,
  D4,
  FIRE_TYPES,
  LQ_DEEP,
  LQ_WATER,
  MH,
  MW,
  NCELL,
  SF_BRIM,
  SF_DEAD,
  SF_FOLIAGE,
  SF_FUNGFOR,
  SF_GRASS,
  SF_HAY,
  SF_ICE,
  SF_LUMEN,
  SF_OBSIDIAN,
  TF,
  TW,
  cpos,
} from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/** マスの火・灰・変わり方を、マスの絵（gfx.cellTex）の中身 cellData に書き、描画に渡す */
export function uploadCells(): void {
  for (let i = 0; i < NCELL; i++) {
    const o = i * 4;
    cellData[o] = Math.min(255, (blaze.fireLight[i] ?? NaN) * 150);
    cellData[o + 1] = Math.min(255, (blaze.fire[i] ?? NaN) * 255);
    cellData[o + 2] = blaze.burnt[i] ? 255 : 0;
    cellData[o + 3] = must(blaze.cellFlag[i], 'マスの変わり方');
  }
  gfx.cellTex.needsUpdate = true;
}
/** マス i に火をつける（壁には付かない。強さ strength。燃えているなら強い方にする）。gasBurn ならガスが燃えた火：ガスを消し、少し燃える物を残す */
export function ignite(i: number, strength: number, gasBurn: boolean): void {
  if (i < 0 || i >= NCELL || level().tile[i] === TW) return;
  if ((blaze.fire[i] ?? NaN) <= 0) {
    blaze.fire[i] = strength;
    if (!blaze.burning.includes(i)) blaze.burning.push(i);
  } // put out and lit again before stepFire: it is still in the list
  else blaze.fire[i] = Math.max(blaze.fire[i] ?? NaN, strength);
  if (gasBurn) {
    blaze.fuel[i] = Math.max(blaze.fuel[i] ?? NaN, 0.25);
    level().gas[i] = 0;
  }
}
/**
 * 小さな生き物 m の動き（dt 秒。t はゲームの時刻、dp はプレイヤーまでの距離）。叫ぶ物は近くの灯りに叫んで獣を起こし、掃除機・修復機は仕事をし、
 * 化けた巻物は近づくと正体を現して逃げ、魚と草を食べる物は灯りに驚いて逃げる。草を食べる物は光る苔を食べ、魚はときどき跳ねる
 */
export function updateCritter(m: Mob, dt: number, t: number, dp: number): void {
  const ty = m.ty;
  m.aware = 0;
  m.noticed = false;
  m.sleep = false;
  m.alert = 0;
  const lit = !stealth.sneak;
  if (ty.critter === 'shrieker') {
    m.glow = 1.2 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.1 + m.ph), 2);
    if (dp < 3.2 && lit && m.visible && clock.time - (m.shriekT || -99) > 12) {
      m.shriekT = clock.time;
      m.glow = 3;
      sShriek(m.x, m.z);
      vfx.shake = Math.max(vfx.shake, 0.12);
      for (let q = 0; q < 36; q++) {
        const a = (q / 36) * Math.PI * 2;
        spawn(
          m.x,
          0.7,
          m.z,
          Math.cos(a) * 2.2,
          0.2,
          Math.sin(a) * 2.2,
          0.9,
          G(q % 2 ? '!' : '.'),
          0.18,
          ty.col[0] * 2.4,
          ty.col[1] * 2.4,
          ty.col[2] * 2.4,
          1,
        );
      }
      let woke = 0;
      for (const o of here.monsters) {
        if (o === m || o.ty.critter || o.dead) continue;
        if (Math.hypot(o.x - m.x, o.z - m.z) < 15) {
          if (o.sleep || !o.noticed) woke++;
          o.sleep = false;
          o.aware = Math.max(o.aware, 1.05);
        }
      }
      if (clock.time - ui.shriekMsgT > 8) {
        ui.shriekMsgT = clock.time;
        msg(`<b style="color:${css(ty.col)}">p</b>${mname(m)}が甲高い叫び声を上げた！${woke ? ' 周りの獣たちが目を覚ます。' : ''}`);
      }
    }
    return;
  }
  if (ty.critter === 'cleaner' || ty.critter === 'engineer') {
    if (machineWork(m, dt)) {
      m.yaw = lerpAngle(m.yaw, m.dirYaw, 1 - Math.exp(-dt * 4));
      return;
    }
  }
  if (ty.critter === 'mimic' && m.hidden) {
    if (dp < 2.3 || m.revealNow) {
      m.hidden = false;
      m.flee = 8;
      sSqueak(m.x, m.z);
      sChime(m.x, m.z, 0.25);
      vfx.shake = Math.max(vfx.shake, 0.1);
      msg(`<b style="color:${css(ty.col)}">q</b>浮かんでいた巻物が脚を生やし、すばやく走り去った！ ${mname(m)}だ。`);
      for (let q = 0; q < 24; q++) {
        const a = mr() * 6.28;
        spawn(m.x, 1.2, m.z, Math.cos(a) * 1.2, mr(), Math.sin(a) * 1.2, 1, G(mpick(['?', '.', '*'])), 0.14, 1.6, 1.3, 0.6, 1);
      }
    }
    return;
  }
  // startle: a lit lantern close by sends fish and grazers fleeing
  if ((ty.critter === 'fish' && dp < 4.5 && lit) || (ty.critter === 'grazer' && dp < 3.5 && lit)) {
    if (!((m.flee ?? NaN) > 0)) {
      if (ty.critter === 'fish') {
        sSplash(0.15);
        splash(m.x, m.z, ty.col);
      } else if (!ui.grazeMsg && m.visible) {
        ui.grazeMsg = true;
        msg(`<b style="color:${css(ty.col)}">h</b>${mname(m)}が灯りに驚いて、ぱたぱたと逃げ出した。灯りを絞れば、近くで眺められる。`);
      }
    }
    m.flee = ty.critter === 'fish' ? 1.6 : 3;
  }
  if ((m.flee ?? NaN) > 0) m.flee = (m.flee ?? NaN) - dt;
  if (m.wait > 0) {
    m.wait -= dt;
    if ((m.flee ?? NaN) > 0) m.wait = 0;
    // grazing: a moss cell loses its glow
    if (ty.critter === 'grazer' && m.wait <= 0) {
      const i = m.cz * MW + m.cx;
      if (level().surface[i] === SF_LUMEN && blaze.cellFlag[i] !== 30) {
        blaze.cellFlag[i] = 30;
        level().surface[i] = SF_GRASS;
        uploadCells();
      }
    }
    m.moving += (0 - m.moving) * Math.min(1, dt * 5);
  } else {
    const tx = (m.tx + 0.5) * CELL,
      tz = (m.tz + 0.5) * CELL,
      ddx = tx - m.x,
      ddz = tz - m.z,
      d = Math.hypot(ddx, ddz);
    if (d < 0.05) {
      m.x = tx;
      m.z = tz;
      m.cx = m.tx;
      m.cz = m.tz;
      critterStep(m, (m.flee ?? NaN) > 0);
      if (ty.critter === 'grazer' && !((m.flee ?? NaN) > 0) && level().surface[m.cz * MW + m.cx] === SF_LUMEN && mr() < 0.35)
        m.wait = 2 + mr() * 3;
    } else {
      const sp = ty.speed * ((m.flee ?? NaN) > 0 ? (ty.critter === 'fish' ? 2.6 : 3) : 1) * dt,
        st = Math.min(sp, d);
      m.x += (ddx / d) * st;
      m.z += (ddz / d) * st;
      m.dirYaw = Math.atan2(ddx, ddz);
      m.cx = Math.floor(m.x / CELL);
      m.cz = Math.floor(m.z / CELL);
    }
    m.moving += (1 - m.moving) * Math.min(1, dt * 5);
  }
  m.yaw = lerpAngle(m.yaw, m.dirYaw, 1 - Math.exp(-dt * 6));
  m.walk += dt * m.moving * ty.speed * 5.5;
  // fish now and then leap out of the water in a glowing arc
  if (ty.critter === 'fish') {
    m.jumpT = (m.jumpT === undefined ? 3 + mr() * 10 : m.jumpT) - dt;
    if (m.jumpT <= 0 && !m.jump && dp < 26) {
      m.jump = 0.001;
      splash(m.x, m.z, ty.col);
    }
    if (m.jump) {
      m.jump += dt / 0.9;
      if (m.jump >= 1) {
        m.jump = 0;
        m.jumpT = 5 + mr() * 10;
        splash(m.x, m.z, ty.col);
        sSplash(0.08);
      } else if (mr() < 0.6)
        spawn(m.x, m.y + 0.1, m.z, 0, -0.3, 0, 0.6, G(mpick(['.', '*'])), 0.1, ty.col[0] * 2.4, ty.col[1] * 2.4, ty.col[2] * 2.4, 1);
    }
  }
  m.y = ty.critter === 'fish' ? -0.16 + Math.sin(t * 2 + m.ph) * 0.03 + (m.jump ? Math.sin(Math.PI * m.jump) * 1.0 : 0) : 0;
  m.glow =
    ty.critter === 'fish' ? 1.4 + 0.4 * Math.sin(t * 3 + m.ph) : ty.critter === 'grazer' ? 1.5 + 0.3 * Math.sin(t * 1.2 + m.ph) : 1.2;
}
/**
 * 掃除機と修復機の仕事（dt 秒）。掃除機は灰を片付け（燃え残りの火も消す）、修復機は焼け落ちた扉を作り直す。仕事の所にいる間は true（動かない）。
 * 仕事が無ければ、1.5秒ごとに近くの仕事を探す（掃除機は上下左右10マスの枠の中の灰、修復機は直線で40（20マス）以内の焼け落ちた扉。そのうち歩いて行ける
 * （jobReach の歩数以内）、同じ種類のほかの機械が向かっていない、一番歩数の少ない物。修復機は扉の両側のマスのどちらかへ。燃えているマスには入れないので、選ばない）
 */
export function machineWork(m: Mob, dt: number): boolean {
  const ty = m.ty;
  if (m.job !== undefined && m.job >= 0) {
    const [jx, jz] = ty.critter === 'engineer' ? [nth(level().doors, m.job).bx, nth(level().doors, m.job).bz] : cpos(m.job);
    if (Math.hypot(jx - m.x, jz - m.z) < (ty.critter === 'engineer' ? 1.6 : 0.4)) {
      m.work = (m.work || 0) + dt;
      m.moving = 0;
      if (mr() < dt * 10)
        spawn(
          jx + (mr() - 0.5) * 0.4,
          0.3 + mr() * 0.6,
          jz + (mr() - 0.5) * 0.4,
          (mr() - 0.5) * 0.8,
          0.6 + mr(),
          (mr() - 0.5) * 0.8,
          0.5,
          G(mpick(['*', '.', '+'])),
          0.1,
          ty.col[0] * 2,
          ty.col[1] * 2,
          ty.col[2] * 2,
          0,
        );
      if (m.work > (ty.critter === 'engineer' ? 3 : 1.8)) {
        if (ty.critter === 'engineer') {
          const d = nth(level().doors, m.job);
          if (!d.gone) {
            m.job = -1;
            m.work = 0;
            return true;
          }
          d.gone = false;
          d.o = 0;
          blaze.fuel[d.i] = 1.4;
          blaze.burnt[d.i] = 0;
          uploadCells();
          if (!here.repairMsg && m.visible) {
            here.repairMsg = true;
            msg(`<b style="color:${css(ty.col)}">R</b>${mname(m)}が、焼け落ちた扉を黙々と作り直した。`);
          }
        } else {
          blaze.burnt[m.job] = 0;
          blaze.fire[m.job] = 0;
          uploadCells();
        }
        m.job = -1;
        m.work = 0;
      }
      return true;
    }
    return false;
  }
  if (clock.time - (m.scanT || -9) < 1.5) return false;
  m.scanT = clock.time;
  // 歩いて行ける仕事だけを、歩数の少ない順に（同じなら扉の番号・マスの順）
  const steps = walkSteps(m, [m.cz * MW + m.cx], jobReach(m));
  // 同じ種類のほかの機械が向かっている仕事は選ばない（2台が同じ灰や扉へ向かわないように）
  const taken = new Set<number>();
  for (const o of here.monsters)
    if (o !== m && !o.dead && o.ty.critter === ty.critter && o.job !== undefined && o.job >= 0) taken.add(o.job);
  let bi = -1,
    bd = 1e9;
  const take = (k: number, s: number): void => {
    if (s >= 0 && s < bd && !taken.has(k)) {
      bd = s;
      bi = k;
    }
  };
  if (ty.critter === 'engineer') {
    level().doors.forEach((d, k) => {
      if (!d.gone || Math.hypot(d.bx - m.x, d.bz - m.z) >= 40) return;
      for (const i of jobCells(m, k)) take(k, steps[i] ?? -1);
    });
  } else {
    for (let dz = -10; dz <= 10; dz++)
      for (let dx = -10; dx <= 10; dx++) {
        const x = m.cx + dx,
          z = m.cz + dz;
        if (x < 0 || z < 0 || x >= MW || z >= MH) continue;
        const i = z * MW + x;
        if (blaze.burnt[i] && level().tile[i] === TF) take(i, steps[i] ?? -1);
      }
  }
  m.job = bi;
  return false;
}
/** 水しぶき（x・z。24 より近ければ音も、26 より遠ければ粒子を出さない）。色 c は使わない（しぶきはいつも水の色） */
export function splash(x: number, z: number, _c: Color): void {
  if (Math.hypot(x - player.x, z - player.z) < 24) sSplash(0.25 * sDist(x, z));
  if (Math.hypot(x - player.x, z - player.z) > 26) return;
  for (let q = 0; q < 14; q++) {
    const a = mr() * 6.28;
    spawn(
      x + Math.cos(a) * 0.3,
      0.1,
      z + Math.sin(a) * 0.3,
      Math.cos(a) * 0.8,
      0.8 + mr() * 1.2,
      Math.sin(a) * 0.8,
      0.9 + mr() * 0.5,
      G(mpick(['~', '.', "'", 'o'])),
      0.13,
      0.25,
      0.55,
      0.9,
      1,
    );
  }
}
/** プレイヤーが薄い氷のマス i に dt 秒乗った（初めはきしみ、0.85秒を越えると割れて水になる。乗っていた秒は iceT に覚える） */
export function crackIce(i: number, dt: number): void {
  const t0 = (iceT.get(i) || 0) + dt;
  iceT.set(i, t0);
  if (t0 < dt * 1.5) {
    sSqueak(player.x, player.z);
    if (!level().crackMsg) {
      level().crackMsg = true;
      msg('<b style="color:#b8e4ff">/</b>足元の氷が、ぴしりと音を立ててきしんだ。');
    }
  }
  if (t0 > 0.85) {
    level().liquid[i] = LQ_WATER;
    level().thin[i] = 0;
    blaze.cellFlag[i] = 50;
    uploadCells();
    sSplash(0.45);
    vfx.shake = Math.max(vfx.shake, 0.15);
    msg('<b style="color:#6ab4ff">~</b>氷が割れ、冷たい水に足が沈んだ。');
    const [x, z] = cpos(i);
    for (let q = 0; q < 26; q++) {
      const a = mr() * 6.28;
      spawn(
        x + Math.cos(a) * 0.5,
        0.1,
        z + Math.sin(a) * 0.5,
        Math.cos(a) * 1.2,
        0.6 + mr(),
        Math.sin(a) * 1.2,
        1 + mr(),
        G(mpick(['/', '\\', '~', '*'])),
        0.16,
        0.6,
        0.85,
        1.0,
        1,
      );
    }
  }
}
/** マス i が、踏み分けていない背の高い草や茸の茂みか（燃えた所・水の上は違う） */
export const tallAt = (i: number): boolean =>
  i >= 0 &&
  i < NCELL &&
  (level().surface[i] === SF_FOLIAGE || level().surface[i] === SF_FUNGFOR) &&
  blaze.cellFlag[i] !== 20 &&
  !blaze.burnt[i] &&
  !level().liquid[i];
/** マス i の茂みを踏み分ける（踏んだ時刻を blaze.trampled に覚える。regrow が、しばらくして元に戻す） */
export function trample(i: number): void {
  if (!tallAt(i)) return;
  blaze.cellFlag[i] = 20;
  uploadCells();
  blaze.trampled.push([i, clock.time]);
  sHiss(player.x, player.z, 0.22);
}
/** マス i の硫黄が燃え上がる（燃える物が残っていて、燃えていない時。隣の硫黄にも火が移る。初めての時は、その階で一度だけ伝言を出す） */
export function brimFlare(i: number): void {
  if (level().surface[i] !== SF_BRIM || (blaze.fire[i] ?? NaN) > 0.1 || (blaze.fuel[i] ?? NaN) <= 0) return;
  ignite(i, 1.0, false);
  for (const d of D4) {
    const j = i + d[0] + d[1] * MW;
    if (level().surface[j] === SF_BRIM && (blaze.fuel[j] ?? NaN) > 0) ignite(j, 0.6, false);
  }
  sCrackleBurst(((i % MW) + 0.5) * CELL, (((i / MW) | 0) + 0.5) * CELL);
  if (!here.brimMsg) {
    here.brimMsg = true;
    msg('<b style="color:#ffd04a">*</b>足元の硫黄が、ぼっと燃え上がった！ しばらくすると、また燃えるようになる。');
  }
}
/** 冷気（x・z のまわり r）：火を消し、水を25秒凍らせる（凍らせた水の上の生き物は冷える。凍っている所は25秒に戻す）。凍らせた時は音を鳴らす */
export function chillArea(x: number, z: number, r: number): void {
  const cx = Math.floor(x / CELL),
    cz = Math.floor(z / CELL),
    rr = Math.ceil(r / CELL) + 1;
  let ch = false,
    froze = false;
  for (let dz = -rr; dz <= rr; dz++)
    for (let dx = -rr; dx <= rr; dx++) {
      if (cx + dx < 0 || cx + dx >= MW || cz + dz < 0 || cz + dz >= MH) continue;
      const i = (cz + dz) * MW + cx + dx;
      const px = (cx + dx + 0.5) * CELL,
        pz = (cz + dz + 0.5) * CELL;
      if (Math.hypot(px - x, pz - z) > r + 0.7) continue;
      if ((blaze.fire[i] ?? NaN) > 0) {
        blaze.fire[i] = 0;
        ch = true;
        for (let q = 0; q < 5; q++)
          spawn(px + (mr() - 0.5) * 1.4, 0.3, pz + (mr() - 0.5) * 1.4, 0, 0.9 + mr(), 0, 0.9, G(mpick(['~', '.'])), 0.16, 1.6, 1.7, 1.8, 0);
      }
      const lq = level().liquid[i];
      if ((lq === LQ_WATER || lq === LQ_DEEP) && !blaze.frozen.has(i)) {
        blaze.frozen.set(i, { t: 25, liq: lq, surf: must(level().surface[i], '床') });
        level().liquid[i] = 0;
        level().surface[i] = SF_ICE;
        ch = true;
        froze = true;
        for (const m of here.monsters) {
          if (m.dead || m.cx !== cx + dx || m.cz !== cz + dz) continue;
          const s2 = m.st || (m.st = {});
          s2.chill = Math.max(s2.chill || 0, 4);
        }
      } else if (blaze.frozen.has(i)) must(blaze.frozen.get(i), '凍らせた水').t = 25;
    }
  if (ch) uploadCells();
  if (froze && sndReady()) {
    const t = must(SND.ctx, '音の部品 SND.ctx').currentTime,
      o = sOut(x, z, 0.3);
    sEnv(sTone(t, 'sine', 2093, 3136, 0.4, o), t, 0.004, 0.35);
    sEnv(sNoise(t, 0.3, 'highpass', 5000, 0.6, o), t, 0.003, 0.25, 0.4);
  }
}
/** 凍らせた水を溶かす（dt 秒。時間が来たか、火が付いたら、元の液体と床に戻す） */
export function updateFrozen(dt: number): void {
  if (!blaze.frozen.size) return;
  let ch = false;
  for (const [i, f] of blaze.frozen) {
    f.t -= dt;
    if (f.t <= 0 || (blaze.fire[i] ?? NaN) > 0.1) {
      level().liquid[i] = f.liq;
      level().surface[i] = f.surf;
      blaze.fire[i] = 0;
      blaze.fuel[i] = 0;
      blaze.frozen.delete(i);
      ch = true;
      const [x, z] = cpos(i);
      for (let q = 0; q < 8; q++) {
        const a = mr() * 6.28;
        spawn(
          x + Math.cos(a) * 0.6,
          0.1,
          z + Math.sin(a) * 0.6,
          Math.cos(a),
          0.6 + mr(),
          Math.sin(a),
          0.6,
          G(mpick(['/', '\\', '~'])),
          0.14,
          0.7,
          0.95,
          1.2,
          1,
        );
      }
    }
  }
  if (ch) uploadCells();
}
/**
 * 階に入った時の、火と燃える物のマス（燃える床・扉・クモの巣・絨毯と書架、灰の野と仕掛けの灰と焦げ跡）と、火の備品のマス（blaze.fireSrc）を作る
 */
export function initFire(): void {
  blaze.fire = new Float32Array(NCELL);
  blaze.fuel = new Float32Array(NCELL);
  blaze.burnt = new Uint8Array(NCELL);
  blaze.cellFlag = new Uint8Array(NCELL);
  blaze.fireLight = new Float32Array(NCELL);
  blaze.burning = [];
  for (let i = 0; i < NCELL; i++) {
    const sf = level().surface[i];
    blaze.fuel[i] =
      sf === SF_DEAD
        ? 1.0
        : sf === SF_GRASS
          ? 0.7
          : sf === SF_LUMEN
            ? 0.6
            : sf === SF_FOLIAGE
              ? 1.0
              : sf === SF_HAY
                ? 1.2
                : sf === SF_BRIM
                  ? 0.8
                  : 0;
  }
  for (const d of level().doors) blaze.fuel[d.i] = Math.max(nth(blaze.fuel, d.i), 1.4);
  level().webAt = new Map();
  for (const w of level().webs || []) {
    blaze.fuel[w.i] = Math.max(nth(blaze.fuel, w.i), 0.9);
    must(level().webAt).set(w.i, w);
  }
  for (const r of level().rooms) {
    if (r.theme && r.theme.k === 'ashfield') for (const i of r.cells) if (!level().liquid[i]) blaze.burnt[i] = 1;
  }
  for (const r of level().rooms) {
    const md = r.mdata;
    if (!md) continue;
    for (const i of md.ash || []) blaze.burnt[i] = 1;
    for (const i of md.char || []) blaze.burnt[i] = 1;
  }
  for (const [i, dc] of level().decoCell)
    if (dc.ch === '[' || dc.ch === '=' || dc.k === 'carpet') blaze.fuel[i] = Math.max(nth(blaze.fuel, i), 1.5);
  blaze.fireSrc = level()
    .fixtures.filter((f) => FIRE_TYPES.has(f.type))
    .map((f) => Math.floor(f.z / CELL) * MW + Math.floor(f.x / CELL));
  uploadCells();
}
/** 火を1歩進める（火の備品に触れたガスが燃え上がる・燃える物を燃やして広がる・水のそばで湯気・燃え尽きると灰に・扉が焼け落ちる。火の明かりをぼかす） */
export function stepFire(): void {
  const g = level().gas;
  // open flames (braziers, torches, lava) ignite gas that drifts into them
  for (const s0 of blaze.fireSrc) {
    for (const j of [s0, s0 + 1, s0 - 1, s0 + MW, s0 - MW]) {
      if (j >= 0 && j < NCELL && nth(g, j) > 0.15) {
        ignite(j, 1, true);
        boom(j);
      }
    }
  }
  const next: number[] = [];
  for (const i of blaze.burning) {
    if (nth(blaze.fire, i) <= 0) continue;
    if (nth(blaze.fuel, i) > 0) {
      blaze.fuel[i] = nth(blaze.fuel, i) - 0.05 * nth(blaze.fire, i);
      blaze.fire[i] = Math.min(1, nth(blaze.fire, i) + 0.15);
    } else blaze.fire[i] = nth(blaze.fire, i) * 0.6;
    const x = i % MW;
    for (const j of [i + 1, i - 1, i + MW, i - MW]) {
      if (j < 0 || j >= NCELL || (j === i + 1 && x === MW - 1) || (j === i - 1 && x === 0)) continue;
      if (nth(g, j) > 0.1) {
        ignite(j, 1, true);
        boom(j);
        continue;
      }
      if (
        nth(blaze.fire, j) <= 0 &&
        nth(blaze.fuel, j) > 0 &&
        mr() < 0.22 * nth(blaze.fire, i) * (level().surface[j] === SF_DEAD ? 1.4 : 1)
      )
        ignite(j, 0.25, false);
      const lq = level().liquid[j];
      if ((lq === LQ_WATER || lq === LQ_DEEP) && nth(blaze.fire, i) > 0.5 && mr() < 0.15) {
        const sx = ((j % MW) + 0.5) * CELL,
          sz = (((j / MW) | 0) + 0.5) * CELL;
        for (let q = 0; q < 3; q++)
          spawn(
            sx + (mr() - 0.5),
            0.2,
            sz + (mr() - 0.5),
            (mr() - 0.5) * 0.3,
            0.6 + mr() * 0.6,
            (mr() - 0.5) * 0.3,
            2.5,
            G(mpick(['~', '.', "'"])),
            0.35,
            0.35,
            0.36,
            0.4,
            1,
          );
      }
    }
    if (nth(blaze.fire, i) < 0.04) {
      blaze.fire[i] = 0;
      blaze.burnt[i] = 1;
      blaze.fuel[i] = 0;
      if (level().surface[i] !== SF_OBSIDIAN && level().surface[i] !== SF_BRIM) level().surface[i] = 0;
      const di = nth(level().doorAt, i);
      if (di >= 0) nth(level().doors, di).gone = true;
    } else next.push(i);
  }
  for (const i of blaze.burning) if (nth(blaze.fire, i) > 0 && !next.includes(i)) next.push(i);
  blaze.burning = next;
  // blurred firelight for the shader and for CPU-side lighting
  blaze.fireLight.fill(0);
  for (const i of blaze.burning) {
    const f = nth(blaze.fire, i),
      x = i % MW;
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        if (x + dx < 0 || x + dx >= MW) continue;
        const j = i + dx + dz * MW;
        if (j < 0 || j >= NCELL) continue;
        const w = f * Math.max(0, 1 - Math.hypot(dx, dz) / 2.6);
        blaze.fireLight[j] = nth(blaze.fireLight, j) + w;
      }
  }
  uploadCells();
}
/** 沼のガスを1歩進める（となりへ広がって薄れる・沼から泡と一緒に湧く） */
export function stepGas(): void {
  const g = level().gas,
    nb = blaze.gasTmp,
    tile = level().tile;
  let any = false;
  for (let i = 0; i < NCELL; i++) {
    if (tile[i] === TW) {
      nb[i] = 0;
      continue;
    }
    const v = nth(g, i),
      x = i % MW;
    let s = 0,
      c = 0;
    if (x > 0 && tile[i - 1] !== TW) {
      s = s + nth(g, i - 1);
      c++;
    }
    if (x < MW - 1 && tile[i + 1] !== TW) {
      s = s + nth(g, i + 1);
      c++;
    }
    if (i >= MW && tile[i - MW] !== TW) {
      s = s + nth(g, i - MW);
      c++;
    }
    if (i < NCELL - MW && tile[i + MW] !== TW) {
      s = s + nth(g, i + MW);
      c++;
    }
    let nv = (c ? v * 0.6 + (s / c) * 0.4 : v) * 0.993;
    if (nv < 0.005) nv = 0;
    nb[i] = nv;
    if (nv > 0) any = true;
  }
  g.set(nb);
  for (const i of level().bogList) {
    if (mr() > 0.012) continue;
    g[i] = Math.min(1, nth(g, i) + 0.8);
    any = true;
    const x = ((i % MW) + 0.3 + mr() * 0.4) * CELL,
      z = (((i / MW) | 0) + 0.3 + mr() * 0.4) * CELL;
    if (Math.hypot(x - player.x, z - player.z) < 26) {
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        spawn(
          x + Math.cos(a) * 0.08,
          0.08,
          z + Math.sin(a) * 0.08,
          Math.cos(a) * 0.4,
          0.02,
          Math.sin(a) * 0.4,
          0.9,
          G('o'),
          0.13,
          0.4,
          0.48,
          0.16,
          1,
        );
      }
      spawn(x, 0.15, z, 0, 0.35, 0, 2.2, G('~'), 0.3, 0.35, 0.6, 0.12, 1);
      sBubble(x, z, 0.3, false);
    }
  }
  blaze.gasAny = any;
}
/** 踏み分けた背の高い草や茸を、45秒たったら元に戻す（プレイヤーの立つマスは戻さない） */
export function regrow(): void {
  if (!blaze.trampled.length) return;
  const pc = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL);
  let ch = false;
  blaze.trampled = blaze.trampled.filter(([i, t0]) => {
    if (clock.time - t0 > 45 && i !== pc && blaze.cellFlag[i] === 20) {
      blaze.cellFlag[i] = 0;
      ch = true;
      return false;
    }
    return blaze.cellFlag[i] === 20;
  });
  if (ch) uploadCells();
}
/** 燃えた硫黄（掃除機が掃いた物も）を、2秒ごとに少しずつ元に戻す */
export function brimRecover(dt: number): void {
  blaze.brimT = blaze.brimT + dt;
  if (blaze.brimT < 2) return;
  blaze.brimT = 0;
  let ch = false;
  for (let i = 0; i < NCELL; i++) {
    if (level().surface[i] === SF_BRIM && (blaze.burnt[i] || nth(blaze.fuel, i) <= 0) && nth(blaze.fire, i) <= 0 && mr() < 0.08) {
      /* burnt, or swept by a cleaner (no ash, no fuel) */ blaze.burnt[i] = 0;
      blaze.fuel[i] = 0.8;
      ch = true;
    }
  }
  if (ch) uploadCells();
}
