// 地面と小さな生き物（もとは src/game/13-creatures.js の updateCritter・machineWork・splash、15-sound-fire.js の ignite・uploadCells、
// 18-level-player.js の crackIce・tallAt・trample・brimFlare、26-spells-hud.js の chillArea・updateFrozen）：
// 小さな生き物（魚・草を食べる物・叫ぶ物・化けた巻物・掃除機・修復機）の動き、水しぶき、火をつける、マスの絵を描画に渡す、
// 薄い氷が割れる、背の高い茂みを踏み分ける、硫黄が燃え上がる、冷気で火を消して水を凍らせる・溶ける。
// 状態の入れ物 here（今の階と生き物）・blaze（火と地面のマス）・player・clock・ui（伝言の時刻と旗）・stealth（忍び足）・vfx（揺れ）・SND（音）と、
// マスの絵 gfx.cellTex・その中身 cellData・薄い氷に乗っていた秒 iceT に頼る。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う動きと見た目になるので、順番を変えないこと。
import { must, nth } from './array.ts';
import { sChime, sCrackleBurst, sDist, sHiss, sNoise, sOut, sShriek, sSplash, sSqueak, sTone, sndReady } from './audio.ts';
import { type Color, css } from './color.ts';
import { G } from './glyphs.ts';
import { msg } from './log.ts';
import { lerpAngle } from './math.ts';
import { critterStep } from './monsters.ts';
import { mname } from './names.ts';
import { spawn } from './particles.ts';
import { mpick, mr } from './random.ts';
import { sEnv } from './sound.ts';
import { type Mob, SND, blaze, cellData, clock, gfx, here, iceT, player, stealth, ui, vfx } from './state.ts';
import {
  CELL,
  D4,
  LQ_DEEP,
  LQ_WATER,
  MH,
  MW,
  NCELL,
  SF_BRIM,
  SF_FOLIAGE,
  SF_FUNGFOR,
  SF_GRASS,
  SF_ICE,
  SF_LUMEN,
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
 * 掃除機と修復機の仕事（dt 秒）。掃除機は灰と火を消し、修復機は焼け落ちた扉を作り直す。仕事の所にいる間は true（動かない）。
 * 仕事が無ければ、1.5秒ごとに近くの仕事を探す（掃除機は10マス以内の一番近い灰か火、修復機は40以内の一番近い焼け落ちた扉）
 */
export function machineWork(m: Mob, dt: number): boolean {
  // cleaners clear ash and put out fires; engineers rebuild burnt doors
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
  if (ty.critter === 'engineer') {
    let bi = -1,
      bd = 1e9;
    level().doors.forEach((d, k) => {
      if (!d.gone) return;
      const dd = Math.hypot(d.bx - m.x, d.bz - m.z);
      if (dd < bd && dd < 40) {
        bd = dd;
        bi = k;
      }
    });
    m.job = bi;
  } else {
    let bi = -1,
      bd = 1e9;
    for (let dz = -10; dz <= 10; dz++)
      for (let dx = -10; dx <= 10; dx++) {
        const x = m.cx + dx,
          z = m.cz + dz;
        if (x < 0 || z < 0 || x >= MW || z >= MH) continue;
        const i = z * MW + x;
        if (!blaze.burnt[i] && !((blaze.fire[i] ?? NaN) > 0.1)) continue;
        if (level().tile[i] !== TF) continue;
        const dd = Math.abs(dx) + Math.abs(dz);
        if (dd < bd) {
          bd = dd;
          bi = i;
        }
      }
    m.job = bi;
  }
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
/** マス i の茂みを踏み分ける（踏んだ時刻を blaze.trampled に覚える。18-level-player.js の regrow が、しばらくして元に戻す） */
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
  // oxlint-disable-next-line no-unused-expressions -- 古い JS の文のまま（tools/same-code.mjs が同じ文と見るため。sCrackleBurst はいつもある）
  sCrackleBurst && sCrackleBurst(((i % MW) + 0.5) * CELL, (((i / MW) | 0) + 0.5) * CELL);
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
