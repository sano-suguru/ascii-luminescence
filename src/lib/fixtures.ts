// 階に置いてある物を描く（drawFixtures・drawDoors・drawSprings・drawGraves・drawWebs・webTouch・drawTraps・drawRunesWorld）：
// 灯りの備品（火鉢・水晶・たいまつ・階段など）、扉（近づくと開く）、
// 泉、墓、クモの巣（触れると震え、燃えると落ちる）、罠と鉄格子。毎フレーム、世界の中に文字を置き（dyn）、粒子を出す（spawn）。
// 床と台と祭壇のルーン・石碑・宝物庫の兆しと、光線・飛ぶ物・詠唱と付け替えのルーン。
// 状態の入れ物 here（今の階）・player・blaze（火）・clock・ui・gfx（カメラの位置。読むだけ）・fight（光線・飛ぶ物）・gear（溜めと付け替え）に頼る。
// 呼ぶのは描画（src/lib/loop.ts の tick。泉と墓はこのファイルの drawRunesWorld も）と、
// プレイヤーの動き（src/lib/player.ts の updatePlayer が webTouch）。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う見た目になるので、順番を変えないこと。
import { lookup, must, nth } from './array.ts';
import { aimOrigin, viewDir } from './aim.ts';
import { altarFill, guardedNow, vaultArea } from './altars.ts';
import { sChime, sCreak, sHiss, sSqueak } from './audio.ts';
import { G, RUNESET } from './glyphs.ts';
import { drawWave, drawZones } from './fx.ts';
import { allRunes } from './gear.ts';
import { ceilAt, cellLight, litScale } from './lightmap.ts';
import { msg } from './log.ts';
import { dyn, spawn } from './particles.ts';
import { clamp, mulberry32 } from './rng.ts';
import { mpick, mr } from './random.ts';
import { RUNE_DEF, TIER_COL, elemCol, runeCol } from './runes.ts';
import { TRAP_INFO } from './names.ts';
import { blaze, clock, fight, gear, gfx, here, player } from './state.ts';
import { drawStairSeal } from './omens.ts';
import { makeNoise } from './status.ts';
import { CELL, CH_D, LQ_LAVA, MW, NCELL, cpos } from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/** 灯りの備品を描く（46 より遠い物は描かない）。備品の種類ごとの姿と、出す粒子。ブラッドワートは近づくと弾け、噴気孔はときどき噴き出す */
export function drawFixtures(t: number, dt: number): void {
  for (const f of here.fixtures) {
    const ddx = f.x - player.x,
      ddz = f.z - player.z,
      d2 = ddx * ddx + ddz * ddz;
    if (d2 > 46 * 46) continue;
    const near = clamp(Math.sqrt(d2) / 4, 0.35, 1);
    const L = level().lights[f.li],
      fl = L ? L.f : 1,
      c = f.col,
      x = f.x,
      z = f.z,
      ly = L ? L.y : 1.5;
    // 色（型で3つあると決まっている）
    const c0 = c[0],
      c1 = c[1],
      c2 = c[2];
    switch (f.type) {
      case 'brazier': {
        for (let k = 0; k < 3; k++) {
          const a = k * 2.094 + f.ph;
          dyn(
            x + Math.cos(a) * 0.2,
            0.42,
            z + Math.sin(a) * 0.2,
            G('|'),
            0.6,
            c0 * 0.55 * fl + 0.04,
            c1 * 0.55 * fl + 0.04,
            c2 * 0.55 * fl + 0.06,
            2,
            Math.atan2(Math.cos(a), Math.sin(a)),
          );
        }
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2 + f.ph;
          dyn(
            x + Math.cos(a) * 0.34,
            0.86,
            z + Math.sin(a) * 0.34,
            G(k % 2 ? '=' : '-'),
            0.3,
            c0 * 1.3 * fl,
            c1 * 1.3 * fl,
            c2 * 1.3 * fl,
            2,
            Math.atan2(Math.cos(a), Math.sin(a)),
          );
        }
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          dyn(
            x + Math.cos(a) * 0.22,
            0.72,
            z + Math.sin(a) * 0.22,
            G('-'),
            0.22,
            c0 * 0.8 * fl,
            c1 * 0.8 * fl,
            c2 * 0.8 * fl,
            2,
            Math.atan2(Math.cos(a), Math.sin(a)),
          );
        }
        const core = 0.52 + 0.08 * Math.sin(t * 14 + f.ph) + 0.05 * Math.sin(t * 23 + f.ph),
          cb = near;
        dyn(x, 1.16, z, G('*'), core, (c0 * 3.4 * fl + 0.9) * cb, (c1 * 3.4 * fl + 0.6) * cb, (c2 * 3.4 * fl + 0.35) * cb);
        for (let k = 0; k < 7; k++) {
          const q = (t * 1.7 + k / 7 + f.ph) % 1,
            a = k * 1.7 + f.ph + t,
            rr = 0.17 * (1 - q),
            kk = (1 - q) * (1 - q),
            b = 2.8 * cb;
          dyn(
            x + Math.cos(a) * rr,
            0.98 + q * 0.8,
            z + Math.sin(a) * rr,
            G(k % 3 === 0 ? '^' : k % 3 === 1 ? "'" : '*'),
            0.32 * (1 - q * 0.7),
            c0 * b * (1 - q),
            c1 * b * kk,
            c2 * b * kk * (1 - q),
          );
        }
        f.acc += dt * 13;
        while (f.acc >= 1) {
          f.acc--;
          spawn(
            x + (mr() - 0.5) * 0.3,
            1.1,
            z + (mr() - 0.5) * 0.3,
            (mr() - 0.5) * 0.4,
            0.7 + mr() * 0.9,
            (mr() - 0.5) * 0.4,
            1.4 + mr() * 2.2,
            G(mpick(['.', "'", '*', '`', '.'])),
            0.1 + mr() * 0.12,
            c0 * 2.6,
            c1 * 2.1,
            c2 * 1.7,
            0,
          );
        }
        break;
      }
      case 'crystal': {
        const cy = ly + Math.sin(t * 0.9 + f.ph) * 0.1,
          rot = t * 0.45 + f.ph,
          cr = Math.cos(rot),
          sr = Math.sin(rot);
        const V: [number, number, number][] = [
          [0, 0.75, 0],
          [0, -0.75, 0],
          [0.45, 0, 0],
          [-0.45, 0, 0],
          [0, 0, 0.45],
          [0, 0, -0.45],
        ];
        const E: [number, number][] = [
          [0, 2],
          [0, 3],
          [0, 4],
          [0, 5],
          [1, 2],
          [1, 3],
          [1, 4],
          [1, 5],
          [2, 4],
          [4, 3],
          [3, 5],
          [5, 2],
        ];
        for (let ei = 0; ei < E.length; ei++) {
          const [ea, eb] = nth(E, ei),
            a = nth(V, ea),
            b = nth(V, eb);
          for (let s = 1; s <= 3; s++) {
            const u = s / 4,
              lx = a[0] + (b[0] - a[0]) * u,
              lyy = a[1] + (b[1] - a[1]) * u,
              lz = a[2] + (b[2] - a[2]) * u;
            const br = 2.0 * (0.75 + 0.25 * Math.sin(t * 2 + ei + s)) * fl;
            dyn(x + lx * cr + lz * sr, cy + lyy, z - lx * sr + lz * cr, G(s === 2 ? '+' : ':'), 0.2, c0 * br, c1 * br, c2 * br);
          }
        }
        for (const v of V)
          dyn(x + v[0] * cr + v[2] * sr, cy + v[1], z - v[0] * sr + v[2] * cr, G('*'), 0.26, c0 * 2.8 * fl, c1 * 2.8 * fl, c2 * 2.8 * fl);
        const cb = 3.6 * fl * near;
        dyn(x, cy, z, G('*'), 0.7 + 0.06 * Math.sin(t * 1.7 + f.ph), c0 * cb + 0.5 * near, c1 * cb + 0.5 * near, c2 * cb + 0.5 * near);
        for (let k = 0; k < 9; k++) {
          const a = t * 0.7 + (k / 9) * Math.PI * 2;
          dyn(
            x + Math.cos(a) * 1.0,
            cy + Math.sin(t * 1.1 + k * 2) * 0.35,
            z + Math.sin(a) * 1.0,
            G(k % 3 ? '.' : '+'),
            0.2,
            c0 * 1.6,
            c1 * 1.6,
            c2 * 1.6,
          );
        }
        f.acc += dt * (ly > 3 ? 8 : 5);
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * Math.PI * 2,
            r = 0.4 + mr() * (ly > 3 ? 3 : 1.4);
          spawn(
            x + Math.cos(a) * r,
            0.3 + mr() * (ly + 0.5),
            z + Math.sin(a) * r,
            0,
            0.12 + mr() * 0.2,
            0,
            3 + mr() * 4,
            G(mpick(['.', '+', '*', "'"])),
            0.1 + mr() * 0.12,
            c0 * 2,
            c1 * 2,
            c2 * 2,
            1,
          );
        }
        break;
      }
      case 'rune': {
        const sp = t * 0.2 + f.ph,
          br = 1.8 * fl;
        for (let k = 0; k < 20; k++) {
          const a = (k / 20) * Math.PI * 2 + sp;
          const g = nth(RUNESET, (k * 7 + Math.floor(t * 0.8 + k * 0.3)) % RUNESET.length);
          dyn(x + Math.cos(a) * 1.55, 0.05, z + Math.sin(a) * 1.55, G(g), 0.42, c0 * br, c1 * br, c2 * br, 1, a + Math.PI / 2);
        }
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2 - sp * 1.6;
          dyn(
            x + Math.cos(a) * 0.95,
            0.05,
            z + Math.sin(a) * 0.95,
            G(k % 2 ? '*' : '+'),
            0.3,
            c0 * br * 1.2,
            c1 * br * 1.2,
            c2 * br * 1.2,
            1,
            a + Math.PI / 2,
          );
        }
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + sp * 0.5;
          dyn(x + Math.cos(a) * 0.45, 0.05, z + Math.sin(a) * 0.45, G('='), 0.26, c0 * br, c1 * br, c2 * br, 1, a);
        }
        const cb = 3.3 * fl * near;
        dyn(
          x,
          0.95 + Math.sin(t * 1.2 + f.ph) * 0.1,
          z,
          G(nth(RUNESET, Math.floor(t * 0.7) % RUNESET.length)),
          0.55,
          c0 * cb + 0.3,
          c1 * cb + 0.3,
          c2 * cb + 0.3,
        );
        f.acc += dt * 8;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * Math.PI * 2,
            r = mpick([0.95, 1.55]);
          spawn(
            x + Math.cos(a) * r,
            0.1,
            z + Math.sin(a) * r,
            0,
            0.5 + mr() * 0.6,
            0,
            1.8 + mr() * 1.5,
            G(mpick(RUNESET)),
            0.14 + mr() * 0.08,
            c0 * 2.2,
            c1 * 2.2,
            c2 * 2.2,
            2,
          );
        }
        break;
      }
      case 'lamp': {
        const top = (ceilAt(x, z) ?? NaN) - 0.15,
          yy = ly + Math.sin(t * 1.2 + f.ph) * 0.03;
        for (let y = top, k = 0; y > yy + 0.2 && k < 40; y -= 0.22, k++) dyn(x, y, z, G(':'), 0.2, c0 * 0.5, c1 * 0.5, c2 * 0.5);
        dyn(x, yy, z, G('o'), 0.36, c0 * 1.5 * fl, c1 * 1.5 * fl, c2 * 1.5 * fl);
        const cb = 3.2 * fl * near;
        dyn(x, yy, z, G('*'), 0.3, c0 * cb + 0.4 * near, c1 * cb + 0.4 * near, c2 * cb + 0.4 * near);
        f.acc += dt * 1.5;
        while (f.acc >= 1) {
          f.acc--;
          spawn(
            x,
            yy,
            z,
            (mr() - 0.5) * 0.2,
            -0.1 - mr() * 0.2,
            (mr() - 0.5) * 0.2,
            2 + mr() * 2,
            G('.'),
            0.12,
            c0 * 1.8,
            c1 * 1.8,
            c2 * 1.8,
            1,
          );
        }
        break;
      }
      case 'fungus': {
        const GLs = ['T', 'Y', 'f', '?', 't', 'T', 'Y', 'r'];
        for (let k = 0; k < 8; k++) {
          const a = k * 0.9 + f.ph,
            r = 0.12 + (k % 3) * 0.2,
            s = 0.24 + ((k * 37) % 5) * 0.06,
            b = (1.4 + 0.6 * Math.sin(t * 1.3 + k)) * fl;
          dyn(x + Math.cos(a) * r, s * 0.5, z + Math.sin(a) * r, G(nth(GLs, k)), s, c0 * b, c1 * b, c2 * b);
        }
        f.acc += dt * 3;
        while (f.acc >= 1) {
          f.acc--;
          spawn(
            x + (mr() - 0.5) * 0.8,
            0.3,
            z + (mr() - 0.5) * 0.8,
            (mr() - 0.5) * 0.1,
            0.12 + mr() * 0.15,
            (mr() - 0.5) * 0.1,
            4 + mr() * 3,
            G(mpick(['.', "'", '`'])),
            0.1,
            c0 * 1.8,
            c1 * 1.8,
            c2 * 1.8,
            1,
          );
        }
        break;
      }
      case 'abyss': {
        const sp = t * 0.15 + f.ph,
          by = -CH_D + 0.12;
        for (let k = 0; k < 18; k++) {
          const a = (k / 18) * Math.PI * 2 + sp;
          dyn(
            x + Math.cos(a) * 1.7,
            by,
            z + Math.sin(a) * 1.7,
            G(nth(RUNESET, (k * 5 + Math.floor(t * 0.5)) % RUNESET.length)),
            0.62,
            c0 * 1.5 * fl,
            c1 * 1.5 * fl,
            c2 * 1.5 * fl,
            1,
            a + Math.PI / 2,
          );
        }
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - sp * 1.4;
          dyn(x + Math.cos(a) * 0.9, by, z + Math.sin(a) * 0.9, G('*'), 0.4, c0 * 2, c1 * 2, c2 * 2, 1, a);
        }
        dyn(x, ly + Math.sin(t * 0.7 + f.ph) * 0.3, z, G('*'), 1.2, c0 * 3.6 * fl + 0.4, c1 * 3.6 * fl + 0.25, c2 * 3.6 * fl + 0.15);
        for (let k = 0; k < 16; k++) {
          const q = (t * 0.22 + k / 16 + f.ph) % 1,
            y = -CH_D + q * (CH_D + 1.2),
            a = k * 2.4 + t * 0.3,
            r = 0.6 + q * 0.9,
            b = 2.4 * (1 - q) * fl;
          dyn(x + Math.cos(a) * r, y, z + Math.sin(a) * r, G(k % 2 ? '^' : "'"), 0.36, c0 * b, c1 * b * 0.8, c2 * b * 0.7);
        }
        f.acc += dt * 11;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * Math.PI * 2,
            r = mr() * 2.6;
          spawn(
            x + Math.cos(a) * r,
            -CH_D + 0.5 + mr() * 2,
            z + Math.sin(a) * r,
            (mr() - 0.5) * 0.3,
            0.8 + mr() * 0.9,
            (mr() - 0.5) * 0.3,
            7 + mr() * 5,
            G(mpick(['.', "'", '*', '^', '`'])),
            0.12 + mr() * 0.14,
            c0 * 2.6,
            c1 * 2.2,
            c2 * 1.8,
            0,
          );
        }
        break;
      }
      case 'embers': {
        const cb = near * fl;
        dyn(x, 0.22, z, G('*'), 0.32 + 0.05 * Math.sin(t * 11 + f.ph), c0 * 2.6 * cb, c1 * 2.0 * cb, c2 * 1.6 * cb);
        for (let k = 0; k < 4; k++) {
          const q = (t * 1.3 + k / 4 + f.ph) % 1,
            a = k * 1.6 + t;
          dyn(
            x + Math.cos(a) * 0.1 * (1 - q),
            0.15 + q * 0.45,
            z + Math.sin(a) * 0.1 * (1 - q),
            G(k % 2 ? '^' : "'"),
            0.2 * (1 - q * 0.6),
            c0 * 2.2 * (1 - q) * cb,
            c1 * 1.6 * (1 - q) * (1 - q) * cb,
            c2 * (1 - q) * (1 - q) * cb,
          );
        }
        f.acc += dt * 4;
        while (f.acc >= 1) {
          f.acc--;
          spawn(
            x + (mr() - 0.5) * 0.3,
            0.3,
            z + (mr() - 0.5) * 0.3,
            (mr() - 0.5) * 0.2,
            0.4 + mr() * 0.5,
            (mr() - 0.5) * 0.2,
            1.5 + mr() * 1.5,
            G('.'),
            0.08,
            c0 * 2,
            c1 * 1.6,
            c2 * 1.2,
            0,
          );
        }
        break;
      }
      case 'relic': {
        const yy = ly + Math.sin(t * 1.1 + f.ph) * 0.08,
          cb = 3.0 * fl * near;
        dyn(x, yy, z, G('?'), 0.5, c0 * cb + 0.3, c1 * cb + 0.25, c2 * cb + 0.15);
        for (let k = 0; k < 10; k++) {
          const a = t * 0.9 + (k / 10) * Math.PI * 2;
          dyn(
            x + Math.cos(a) * 0.55,
            yy + Math.sin(t * 1.7 + k) * 0.12,
            z + Math.sin(a) * 0.55,
            G(k % 2 ? '.' : '*'),
            0.16,
            c0 * 1.8,
            c1 * 1.8,
            c2 * 1.8,
          );
        }
        f.acc += dt * 3;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * 6.28;
          spawn(
            x + Math.cos(a) * 0.4,
            yy - 0.3,
            z + Math.sin(a) * 0.4,
            0,
            0.25 + mr() * 0.2,
            0,
            2 + mr() * 1.5,
            G(mpick(['.', '*', '+'])),
            0.1,
            c0 * 2,
            c1 * 2,
            c2 * 2,
            2,
          );
        }
        break;
      }
      case 'pages': {
        f.acc += dt * 1.6;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * 6.28,
            r = mr() * 3.5;
          spawn(
            x + Math.cos(a) * r,
            0.4 + mr() * 2.2,
            z + Math.sin(a) * r,
            (mr() - 0.5) * 0.25,
            0.03 + mr() * 0.08,
            (mr() - 0.5) * 0.25,
            6 + mr() * 4,
            G(mpick(['?', '=', '~', '?'])),
            0.22,
            c0 * 1.2,
            c1 * 1.2,
            c2 * 1.2,
            1,
          );
        }
        break;
      }
      case 'mist': {
        f.acc += dt * 7;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * 6.28,
            r = mr() * 4;
          spawn(
            x + Math.cos(a) * r,
            0.1 + mr() * 0.35,
            z + Math.sin(a) * r,
            (mr() - 0.5) * 0.35,
            0.01,
            (mr() - 0.5) * 0.35,
            6 + mr() * 4,
            G(mpick(['~', '~', '-', '.'])),
            0.3 + mr() * 0.15,
            c0 * 0.7,
            c1 * 0.7,
            c2 * 0.7,
            1,
          );
        }
        break;
      }
      case 'fall': {
        // 宝物庫の光る裂け目から落ちる水の柱
        const top = Math.max(4, (ceilAt(x, z) ?? NaN) - 0.15);
        for (let s2 = 0; s2 < 5; s2++) {
          const a = (s2 / 5) * Math.PI * 2 + t * 0.3,
            ox = Math.cos(a) * 0.22,
            oz = Math.sin(a) * 0.22;
          for (let j = 0; j * 0.36 < top; j++) {
            const y = top - ((t * 7 + j * 0.36 + s2 * 0.07) % top),
              b = 1.1 + 0.6 * Math.sin(t * 9 + j + s2);
            dyn(x + ox, y, z + oz, G(j % 3 === 0 ? '|' : j % 3 === 1 ? ':' : '!'), 0.32, c0 * b, c1 * b, c2 * b);
          }
        }
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2 + t * 0.05,
            r2 = 0.55 + 0.15 * Math.sin(t + k);
          dyn(x + Math.cos(a) * r2, top + 0.05, z + Math.sin(a) * r2, G(k % 2 ? '*' : '~'), 0.28, c0 * 2.4, c1 * 2.4, c2 * 2.4, 1, a);
        }
        dyn(x, top + 0.08, z, G('*'), 0.5, c0 * 3.2 * near, c1 * 3.2 * near, c2 * 3.2 * near, 1, 0);
        f.acc += dt * 22;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * 6.28,
            r2 = 0.2 + mr() * 0.6;
          spawn(
            x + Math.cos(a) * r2,
            0.15,
            z + Math.sin(a) * r2,
            Math.cos(a) * 1.2,
            0.8 + mr() * 1.6,
            Math.sin(a) * 1.2,
            0.9 + mr(),
            G(mpick(['~', '.', "'", 'o'])),
            0.14 + mr() * 0.14,
            0.55,
            0.8,
            1.0,
            1,
          );
          if (mr() < 0.3)
            spawn(
              x + (mr() - 0.5) * 2,
              0.4 + mr(),
              z + (mr() - 0.5) * 2,
              (mr() - 0.5) * 0.3,
              0.15,
              (mr() - 0.5) * 0.3,
              3 + mr() * 2,
              G('.'),
              0.6,
              0.12,
              0.16,
              0.22,
              1,
            );
        }
        break;
      }
      case 'veinlight': {
        const wd = f.wd || [1, 0],
          w0 = wd[0] ?? NaN,
          w1 = wd[1] ?? NaN;
        f.acc += dt * 1.4;
        while (f.acc >= 1) {
          f.acc--;
          const tX = -w1,
            tZ = w0,
            u = (mr() - 0.5) * 1.6;
          spawn(
            x + w0 * 0.92 + tX * u,
            0.5 + mr() * 1.8,
            z + w1 * 0.92 + tZ * u,
            0,
            0.02,
            0,
            0.5 + mr() * 0.4,
            G(mpick(['*', '+', '.'])),
            0.14,
            c0 * 2.6,
            c1 * 2.6,
            c2 * 2.6,
            2,
          );
        }
        break;
      }
      case 'crater': {
        const cb = near * (f.active ? 1 : 0.4);
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          dyn(x + Math.cos(a) * 0.55, 0.05, z + Math.sin(a) * 0.55, G(k % 2 ? '^' : '%'), 0.34, 0.5, 0.25, 0.2, 1, a + Math.PI / 2);
        }
        dyn(x, 0.12, z, G('*'), 0.5, c0 * 3 * cb, c1 * 2 * cb, c2 * cb, 1, t * 0.3);
        f.acc += dt * (f.active ? 10 : 2);
        while (f.acc >= 1) {
          f.acc--;
          spawn(
            x + (mr() - 0.5) * 0.6,
            0.2,
            z + (mr() - 0.5) * 0.6,
            (mr() - 0.5) * 0.4,
            0.6 + mr() * 1.2,
            (mr() - 0.5) * 0.4,
            1 + mr() * 1.5,
            G(mpick(['.', '*', "'"])),
            0.1,
            c0 * 2.6,
            c1 * 1.8,
            c2 * 1.2,
            0,
          );
        }
        break;
      }
      case 'spring': {
        const wd = f.wd || [1, 0],
          w0 = wd[0] ?? NaN,
          w1 = wd[1] ?? NaN,
          wx = x + w0 * 0.85,
          wz = z + w1 * 0.85;
        if (f.active) {
          for (let j = 0; j < 12; j++) {
            const q = (t * 1.6 + j / 12) % 1;
            dyn(wx - w0 * q * 1.3, 1.3 - q * q * 1.25, wz - w1 * q * 1.3, G(j % 2 ? '~' : '-'), 0.3, 0.5, 0.8, 1.0);
          }
          f.acc += dt * 12;
          while (f.acc >= 1) {
            f.acc--;
            const a = mr() * 6.28;
            spawn(
              wx - w0 * 1.3,
              0.1,
              wz - w1 * 1.3,
              Math.cos(a) * 0.8,
              0.5 + mr(),
              Math.sin(a) * 0.8,
              0.8 + mr() * 0.6,
              G(mpick(['~', '.', 'o'])),
              0.14,
              0.45,
              0.7,
              0.95,
              1,
            );
          }
        } else {
          f.acc += dt * 1.5;
          while (f.acc >= 1) {
            f.acc--;
            spawn(wx, 1.4, wz, 0, -1.5, 0, 0.9, G('.'), 0.1, 0.35, 0.55, 0.8, 1);
          }
        }
        break;
      }
      case 'firefly': {
        for (let k = 0; k < 16; k++) {
          const a = t * (0.25 + (k % 5) * 0.05) + k * 2.4 + f.ph,
            r2 = 0.6 + (((k * 37) % 11) / 11) * 2.2,
            y = 0.6 + (((k * 53) % 13) / 13) * 2.2 + Math.sin(t * 0.9 + k) * 0.25,
            tw = 0.5 + 0.5 * Math.sin(t * (2 + (k % 3)) + k * 1.7);
          dyn(
            x + Math.cos(a) * r2,
            y,
            z + Math.sin(a * 1.3) * r2,
            G(k % 4 ? '.' : '*'),
            0.14 + 0.06 * tw,
            c0 * 2.2 * tw,
            c1 * 2.2 * tw,
            c2 * 2.2 * tw,
          );
        }
        break;
      }
      case 'marsh': {
        const mx = x + Math.sin(t * 0.4 + f.ph) * 1.1,
          mz = z + Math.cos(t * 0.33 + f.ph * 1.7) * 1.1,
          my = ly + Math.sin(t * 0.9 + f.ph) * 0.25,
          cb = fl * near;
        dyn(mx, my, mz, G('*'), 0.3 + 0.05 * Math.sin(t * 6 + f.ph), c0 * 2.6 * cb, c1 * 2.6 * cb, c2 * 2.6 * cb);
        for (let k = 0; k < 6; k++) {
          const a = t * 1.4 + (k / 6) * Math.PI * 2;
          dyn(
            mx + Math.cos(a) * 0.22,
            my + Math.sin(t * 2 + k) * 0.08,
            mz + Math.sin(a) * 0.22,
            G('.'),
            0.14,
            c0 * 1.5,
            c1 * 1.5,
            c2 * 1.5,
          );
        }
        f.acc += dt * 4;
        while (f.acc >= 1) {
          f.acc--;
          spawn(
            mx,
            my,
            mz,
            (mr() - 0.5) * 0.15,
            0.05 + mr() * 0.1,
            (mr() - 0.5) * 0.15,
            1.5 + mr() * 1.5,
            G(mpick(['.', "'", '`'])),
            0.08,
            c0 * 1.6,
            c1 * 1.6,
            c2 * 1.6,
            1,
          );
        }
        break;
      }
      case 'well':
      case 'sun': {
        const top = (ceilAt(x, z) ?? NaN) - 0.05;
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 + t * 0.05;
          dyn(x + Math.cos(a) * 0.45, top, z + Math.sin(a) * 0.45, G(k % 2 ? '.' : '*'), 0.22, c0 * 2.2, c1 * 2.15, c2 * 2.05);
        }
        dyn(x, top, z, G('*'), 0.45, c0 * 3, c1 * 3, c2 * 2.85);
        f.acc += dt * 9;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * 6.28,
            r = Math.sqrt(mr()) * 0.75;
          spawn(
            x + Math.cos(a) * r,
            0.2 + mr() * (top - 0.4),
            z + Math.sin(a) * r,
            (mr() - 0.5) * 0.05,
            -0.05 - mr() * 0.05,
            (mr() - 0.5) * 0.05,
            4 + mr() * 3,
            G(mpick(['.', '.', "'", '*'])),
            0.1 + mr() * 0.06,
            c0 * 1.4,
            c1 * 1.4,
            c2 * 1.3,
            1,
          );
        }
        if (mr() < dt * 2.5) {
          const r = mr() * 0.6,
            a = mr() * 6.28;
          spawn(x + Math.cos(a) * r, 0.3 + mr() * (top - 0.6), z + Math.sin(a) * r, 0, -0.02, 0, 3, G('|'), 0.9, 0.06, 0.055, 0.04, 1);
        }
        break;
      }
      case 'orb': {
        for (let y = 0.15; y < 1.3; y += 0.24)
          dyn(x, y, z, G(y < 0.3 || y > 1.1 ? '=' : '|'), 0.34, 0.3 + c0 * 0.15, 0.3 + c1 * 0.15, 0.36 + c2 * 0.15);
        const yy = ly + Math.sin(t * 1.3 + f.ph) * 0.06,
          cb = near * fl;
        dyn(x, yy, z, G('o'), 0.5, c0 * 2.4 * cb, c1 * 2.4 * cb, c2 * 2.4 * cb);
        dyn(x, yy, z, G('*'), 0.3, (c0 * 3.4 + 0.4) * cb, (c1 * 3.4 + 0.4) * cb, (c2 * 3.4 + 0.4) * cb);
        for (let k = 0; k < 6; k++) {
          const a = t * 0.8 + (k / 6) * Math.PI * 2;
          dyn(x + Math.cos(a) * 0.42, yy + Math.sin(a * 2) * 0.08, z + Math.sin(a) * 0.42, G('.'), 0.16, c0 * 1.6, c1 * 1.6, c2 * 1.6);
        }
        break;
      }
      case 'bloodwort': {
        if (!f.burst) {
          for (let k = 0; k < 4; k++) {
            const a = k * 1.7 + f.ph,
              h = 0.7 + k * 0.18;
            const pb = (1.2 + 0.5 * Math.sin(t * 2.2 + k)) * near;
            dyn(x + Math.cos(a) * 0.32, h, z + Math.sin(a) * 0.32, G('o'), 0.26, c0 * pb * 1.6, c1 * pb, c2 * pb);
          }
          if (Math.hypot(x - player.x, z - player.z) < 2.3) {
            f.burst = true;
            // 灯りの無いブラッドワートは無い（元も、ここで止まる）
            must(L, 'ブラッドワートの灯り').fade = 1;
            for (let q = 0; q < 40; q++) {
              const a = mr() * 6.28;
              spawn(
                x + Math.cos(a) * 0.3,
                0.8 + mr() * 0.6,
                z + Math.sin(a) * 0.3,
                Math.cos(a) * 0.6,
                0.4 + mr() * 0.9,
                Math.sin(a) * 0.6,
                2.5 + mr() * 2,
                G(mpick(['*', '.', '+', 'o'])),
                0.13,
                2.4,
                0.6,
                0.7,
                2,
              );
            }
            sChime(x, z, 0.5);
            sChime(x, z, 0.35);
            msg('<b style="color:#ff5566">*</b>ブラッドワートの実が弾け、温かな赤い光の粒が舞い上がった。');
          }
        } else if (L && (L.fade ?? NaN) > 0.25) L.fade = (L.fade ?? NaN) - dt * 0.08;
        break;
      }
      case 'vent': {
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2;
          dyn(x + Math.cos(a) * 0.42, 0.05, z + Math.sin(a) * 0.42, G('o'), 0.3, 0.5, 0.52, 0.6, 1, a);
        }
        dyn(x, 0.06, z, G('0'), 0.4, 0.6, 0.62, 0.72, 1, 0);
        f.next = (f.next === undefined ? 2 + mr() * 5 : f.next) - dt;
        if (f.next <= 0) {
          f.next = 4 + mr() * 6;
          f.erupt = 2.2;
          sHiss(x, z, 2.2);
        }
        if ((f.erupt ?? NaN) > 0) {
          f.erupt = (f.erupt ?? NaN) - dt;
          if (L) L.boost = Math.min(1.2, (L.boost || 0) + dt * 3);
          for (let q = 0; q < Math.ceil(dt * 45); q++) {
            const a = mr() * 6.28;
            spawn(
              x + Math.cos(a) * 0.15,
              0.2,
              z + Math.sin(a) * 0.15,
              Math.cos(a) * 0.4,
              3 + mr() * 2,
              Math.sin(a) * 0.4,
              1.4 + mr(),
              G(mpick(['~', '.', ':', "'"])),
              0.3 + mr() * 0.25,
              0.5,
              0.52,
              0.58,
              1,
            );
          }
        } else if (L) L.boost = Math.max(0, (L.boost || 0) - dt * 0.8);
        break;
      }
      case 'pitglow': {
        if (!level().collapsed) break;
        f.acc += dt * 6;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * 6.28,
            r = mr() * 1.6;
          spawn(
            x + Math.cos(a) * r,
            -5.5,
            z + Math.sin(a) * r,
            (mr() - 0.5) * 0.2,
            0.9 + mr() * 0.8,
            (mr() - 0.5) * 0.2,
            4 + mr() * 2,
            G(mpick(['.', '*', "'"])),
            0.12,
            c0 * 2.4,
            c1 * 2,
            c2 * 1.5,
            0,
          );
        }
        break;
      }
      case 'xlight': {
        f.acc += dt * 4;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * 6.28,
            r = mr() * 2;
          spawn(
            x + Math.cos(a) * r,
            0.3 + mr() * 3,
            z + Math.sin(a) * r,
            0,
            0.06 + mr() * 0.08,
            0,
            2 + mr() * 2,
            G(mpick(['+', '*', '.'])),
            0.12,
            c0 * 2.2,
            c1 * 2.2,
            c2 * 2.2,
            1,
          );
        }
        break;
      }
      case 'torch': {
        // たいまつには壁の向き nx・nz と壁の位置 wx・wz がある（無ければ NaN になる）
        const nx = f.nx ?? NaN,
          nz = f.nz ?? NaN,
          yaw = Math.atan2(nx, nz),
          wx = (f.wx ?? NaN) + nx * 0.1,
          wz = (f.wz ?? NaN) + nz * 0.1,
          tX = Math.cos(yaw),
          tZ = -Math.sin(yaw),
          ik = 0.18 + fl * 0.3;
        dyn(wx, 1.72, wz, G('|'), 0.36, 0.7 * ik, 0.55 * ik, 0.5 * ik, 2, yaw);
        dyn(wx - tX * 0.12 + nx * 0.05, 1.98, wz - tZ * 0.12 + nz * 0.05, G('\\'), 0.26, 0.7 * ik, 0.55 * ik, 0.5 * ik, 2, yaw);
        dyn(wx + tX * 0.12 + nx * 0.05, 1.98, wz + tZ * 0.12 + nz * 0.05, G('/'), 0.26, 0.7 * ik, 0.55 * ik, 0.5 * ik, 2, yaw);
        dyn(wx + nx * 0.08, 1.9, wz + nz * 0.08, G('_'), 0.26, 0.7 * ik, 0.55 * ik, 0.5 * ik, 2, yaw);
        const fx = wx + nx * 0.14,
          fz = wz + nz * 0.14,
          cb = near * fl;
        dyn(
          fx,
          2.12,
          fz,
          G('*'),
          0.34 + 0.05 * Math.sin(t * 15 + f.ph),
          (c0 * 3.2 + 0.6) * cb,
          (c1 * 3.2 + 0.4) * cb,
          (c2 * 3.2 + 0.2) * cb,
        );
        for (let k = 0; k < 4; k++) {
          const q = (t * 1.9 + k / 4 + f.ph) % 1,
            a = k * 1.9 + t * 1.3;
          dyn(
            fx + Math.cos(a) * 0.06 * (1 - q),
            2.05 + q * 0.45,
            fz + Math.sin(a) * 0.06 * (1 - q),
            G(k % 2 ? '^' : "'"),
            0.22 * (1 - q * 0.6),
            c0 * 2.6 * (1 - q) * cb,
            c1 * 2.0 * (1 - q) * (1 - q) * cb,
            c2 * 1.4 * (1 - q) * (1 - q) * cb,
          );
        }
        f.acc += dt * 4;
        while (f.acc >= 1) {
          f.acc--;
          spawn(
            fx,
            2.2,
            fz,
            (mr() - 0.5) * 0.2 + nx * 0.1,
            0.5 + mr() * 0.6,
            (mr() - 0.5) * 0.2 + nz * 0.1,
            1 + mr() * 1.5,
            G(mpick(['.', "'", '`'])),
            0.08,
            c0 * 2.4,
            c1 * 1.9,
            c2 * 1.4,
            0,
          );
        }
        break;
      }
      case 'lava': {
        f.acc += dt * 7;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * 6.28,
            r = mr() * 3.2;
          spawn(
            x + Math.cos(a) * r,
            0.15,
            z + Math.sin(a) * r,
            (mr() - 0.5) * 0.3,
            0.5 + mr() * 0.9,
            (mr() - 0.5) * 0.3,
            1.5 + mr() * 2.5,
            G(mpick(['.', "'", '*', '`'])),
            0.09 + mr() * 0.08,
            c0 * 2.8,
            c1 * 2.2,
            c2 * 1.6,
            0,
          );
        }
        // 溶岩の burst は、次の泡までの秒（ブラッドワートの burst は弾けたか）
        f.burst = Number(f.burst || 0) - dt;
        if (f.burst <= 0) {
          f.burst = 0.8 + mr() * 2.2;
          f.bx = x + (mr() - 0.5) * 4;
          f.bz = z + (mr() - 0.5) * 4;
          const ci = Math.floor(f.bz / CELL) * MW + Math.floor(f.bx / CELL);
          f.bt = ci >= 0 && ci < NCELL && level().liquid[ci] === LQ_LAVA ? 0 : 1;
        }
        if ((f.bt ?? NaN) < 1) {
          f.bt = (f.bt ?? NaN) + dt * 1.6;
          const q = Math.min(1, f.bt),
            rr = 0.15 + q * 0.7,
            b = 2.6 * (1 - q),
            // 泡の位置は、泡が弾けていく度合い bt と一緒に入れる
            bx = must(f.bx, '溶岩の泡の位置'),
            bz = must(f.bz, '溶岩の泡の位置');
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            dyn(
              bx + Math.cos(a) * rr,
              0.14 + Math.sin(q * Math.PI) * 0.25,
              bz + Math.sin(a) * rr,
              G(k % 2 ? 'o' : '*'),
              0.2 * (1 - q * 0.5),
              c0 * b,
              c1 * b * 0.7,
              c2 * b * 0.4,
            );
          }
          if (q < 0.2) dyn(bx, 0.22, bz, G('0'), 0.4, c0 * 3, c1 * 2, c2);
        }
        break;
      }
      case 'portal': {
        // 縁で立つ文字の輪（こちらを向く）と、中の渦
        const ddx = player.x - x,
          ddz = player.z - z,
          dl = Math.hypot(ddx, ddz) || 1,
          rx = -ddz / dl,
          rz = ddx / dl,
          cy = 1.5,
          cb = near * fl;
        for (let k = 0; k < 20; k++) {
          const a = (k / 20) * Math.PI * 2 + t * 0.4;
          dyn(
            x + rx * Math.cos(a) * 1.05,
            cy + Math.sin(a) * 1.2,
            z + rz * Math.cos(a) * 1.05,
            G(k % 2 ? '*' : '+'),
            0.3,
            c0 * 2.6 * cb,
            c1 * 2.6 * cb,
            c2 * 2.6 * cb,
          );
        }
        for (let k = 0; k < 26; k++) {
          const q = (t * 0.35 + k / 26) % 1,
            a = k * 2.4 + t * 1.6,
            rr = (1 - q) * 0.95;
          dyn(
            x + rx * Math.cos(a) * rr,
            cy + Math.sin(a) * rr * 1.1,
            z + rz * Math.cos(a) * rr,
            G(k % 3 === 0 ? '~' : k % 3 === 1 ? '.' : '*'),
            0.22,
            c0 * (1 + q * 2) * cb,
            c1 * (1 + q * 2) * cb,
            c2 * (1 + q * 2) * cb,
          );
        }
        dyn(x, cy, z, G('*'), 0.6, c0 * 3.4 * cb + 0.4, c1 * 3.4 * cb + 0.4, c2 * 3.4 * cb + 0.4);
        f.acc += dt * 8;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * 6.28,
            r = 1.4 + mr() * 0.6;
          spawn(
            x + Math.cos(a) * r,
            0.3 + mr() * 2.4,
            z + Math.sin(a) * r,
            -Math.cos(a) * 0.6,
            0,
            -Math.sin(a) * 0.6,
            1.6,
            G(mpick(['.', '*', '+'])),
            0.12,
            c0 * 2,
            c1 * 2,
            c2 * 2,
            1,
          );
        }
        break;
      }
      case 'bstairs':
      case 'upstairs': {
        const n = 24;
        for (let k = 0; k < n; k++) {
          const h = k / n,
            a = -h * Math.PI * 4 - t * 0.5,
            b = (1.1 + 1.6 * h) * fl;
          dyn(x + Math.cos(a) * 0.65, 0.15 + h * 2.4, z + Math.sin(a) * 0.65, G('<'), 0.26, c0 * b, c1 * b, c2 * b);
        }
        dyn(
          x,
          1.2 + Math.sin(t * 1.2) * 0.08,
          z,
          G('<'),
          0.9,
          c0 * 3 * fl * near + 0.3,
          c1 * 3 * fl * near + 0.3,
          c2 * 3 * fl * near + 0.3,
        );
        f.acc += dt * 6;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * 6.28,
            r = mr() * 1.0;
          spawn(
            x + Math.cos(a) * r,
            2.4,
            z + Math.sin(a) * r,
            0,
            -0.6 - mr() * 0.5,
            0,
            2 + mr(),
            G(mpick(['.', '*', "'"])),
            0.11,
            c0 * 2,
            c1 * 2,
            c2 * 2,
            2,
          );
        }
        break;
      }
      case 'tele': {
        // 対になった所へ運ぶ魔法陣
        const cb = near * fl;
        for (let k = 0; k < 18; k++) {
          const a = (k / 18) * Math.PI * 2 + t * 0.6;
          dyn(
            x + Math.cos(a) * 0.85,
            0.05,
            z + Math.sin(a) * 0.85,
            G(k % 3 ? '*' : '+'),
            0.3,
            c0 * 1.8 * cb,
            c1 * 1.8 * cb,
            c2 * 1.8 * cb,
            1,
            a,
          );
        }
        for (let k = 0; k < 12; k++) {
          const a = (-k / 12) * Math.PI * 2 - t * 0.9;
          dyn(
            x + Math.cos(a) * 0.5,
            0.06,
            z + Math.sin(a) * 0.5,
            G(k % 2 ? 'o' : '.'),
            0.24,
            c0 * 2.2 * cb,
            c1 * 2.2 * cb,
            c2 * 2.2 * cb,
            1,
            a,
          );
        }
        dyn(x, 0.07, z, G('*'), 0.5, c0 * 2.8 * cb, c1 * 2.8 * cb, c2 * 2.8 * cb, 1, t);
        f.acc += dt * 4;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * 6.28;
          spawn(
            x + Math.cos(a) * 0.8,
            0.1,
            z + Math.sin(a) * 0.8,
            0,
            0.6 + mr() * 0.6,
            0,
            1.4,
            G(mpick(['.', '*', '+'])),
            0.11,
            c0 * 2,
            c1 * 2,
            c2 * 2,
            1,
          );
        }
        break;
      }
      case 'stairs': {
        const n = 32;
        for (let k = 0; k < n; k++) {
          const h = k / n,
            a = h * Math.PI * 4 + t * 0.5,
            b = (1.1 + 2.0 * h) * fl;
          dyn(x + Math.cos(a) * 0.75, 0.15 + h * 2.7, z + Math.sin(a) * 0.75, G('>'), 0.28, c0 * b, c1 * b, c2 * b);
        }
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2 - t * 0.3;
          dyn(x + Math.cos(a) * 1.25, 0.04, z + Math.sin(a) * 1.25, G('>'), 0.34, c0 * 1.6, c1 * 1.6, c2 * 1.6, 1, a + Math.PI);
        }
        const cb = 3.6 * fl * near;
        dyn(x, 1.3 + Math.sin(t * 1.2) * 0.08, z, G('>'), 1.05, c0 * cb + 0.4, c1 * cb + 0.35, c2 * cb + 0.2);
        f.acc += dt * 9;
        while (f.acc >= 1) {
          f.acc--;
          const a = mr() * Math.PI * 2,
            r = mr() * 1.2;
          spawn(
            x + Math.cos(a) * r,
            0.1,
            z + Math.sin(a) * r,
            0,
            0.5 + mr() * 0.7,
            0,
            2 + mr() * 1.5,
            G(mpick(['.', '*', "'", '+'])),
            0.12,
            c0 * 2.3,
            c1 * 2.3,
            c2 * 2.3,
            2,
          );
        }
        break;
      }
    }
  }
}

/** 扉を描く：プレイヤーか生き物が近いと開く（開き始めにきしむ音と物音）。40 より遠い扉は、開け閉めだけ進めて描かない */
export function drawDoors(_t: number, dt: number): void {
  for (const d of level().doors) {
    if (d.gone) continue;
    const dx = d.bx - player.x,
      dz = d.bz - player.z,
      dd = Math.hypot(dx, dz);
    let tgt = dd < 2.7 ? 1 : 0;
    if (!tgt)
      for (const m of here.monsters) {
        if (Math.hypot(m.x - d.bx, m.z - d.bz) < 1.7) {
          tgt = 1;
          break;
        }
      }
    if (tgt && d.o < 0.05 && !d.creaked) {
      d.creaked = true;
      sCreak(d.bx, d.bz);
      makeNoise(d.bx, d.bz, 7, 0.3);
    }
    if (!tgt && d.o < 0.02) d.creaked = false;
    d.o += (tgt - d.o) * Math.min(1, dt * 4);
    if (dd > 40) continue;
    const yaw = d.yaw + d.o * 1.75,
      tX = Math.cos(yaw),
      tZ = -Math.sin(yaw),
      bX = Math.cos(d.yaw),
      bZ = -Math.sin(d.yaw);
    const hx = d.bx - bX * 0.95,
      hz = d.bz - bZ * 0.95;
    // cellLight は毎回同じ配列を返すので、1つ目は先に読んでおく。どちらのマスの明かりも、強い所で頭打ちにする（src/lib/lightmap.ts の LIT_MAX）
    const l1 = cellLight(((d.i % MW) + 0.5) * CELL, (((d.i / MW) | 0) + 0.5) * CELL),
      k1 = litScale(l1),
      lr = l1[0] * k1,
      lg = l1[1] * k1,
      lb = l1[2] * k1;
    const l2 = cellLight(((d.j % MW) + 0.5) * CELL, (((d.j / MW) | 0) + 0.5) * CELL),
      k2 = litScale(l2);
    const lan = Math.max(0, 1 - dd / 8);
    const la = lan * lan * 0.8;
    const k0 = 0.07 + la,
      wr = 0.62 * (k0 + (lr + l2[0] * k2) * 0.2),
      wg = 0.38 * (k0 + (lg + l2[1] * k2) * 0.2),
      wb = 0.22 * (k0 + (lb + l2[2] * k2) * 0.2);
    for (let row = 0; row < 9; row++)
      for (let col = 0; col < 6; col++) {
        const u = (col + 0.5) * (1.9 / 6),
          y = 0.18 + row * 0.335;
        let ch = row === 8 ? '=' : col === 0 || col === 5 ? '|' : row % 3 === 0 ? '=' : '+',
          r = wr,
          g = wg,
          b = wb;
        if (col === 4 && row === 3) {
          ch = 'o';
          r *= 2.2;
          g *= 2.2;
          b *= 1.4;
        }
        dyn(hx + tX * u, y, hz + tZ * u, G(ch), 0.34, r, g, b, 2, yaw);
        if (col < 5 && row < 8)
          dyn(
            hx + tX * (u + 0.16) - Math.sin(yaw) * 0.07,
            y + 0.17,
            hz + tZ * (u + 0.16) - Math.cos(yaw) * 0.07,
            G('#'),
            0.26,
            r * 0.5,
            g * 0.5,
            b * 0.5,
            2,
            yaw,
          );
      }
  }
}

/** 癒しの泉を描く（1つで1回、全回復。26 より遠い物は描かない。使った泉は暗い波だけ） */
export function drawSprings(t: number): void {
  for (const it of level().items || []) {
    if (it.kind !== 'spring') continue;
    const [x, z] = cpos(it.i);
    if (Math.hypot(x - player.x, z - player.z) > 26) continue;
    const used = it.taken;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + t * 0.25,
        rr = 0.55 + 0.05 * Math.sin(t * 2 + k),
        b = used ? 0.25 : 0.7 + 0.3 * Math.sin(t * 1.8 + k);
      dyn(x + Math.cos(a) * rr, 0.05, z + Math.sin(a) * rr, G('~'), 0.15, 0.35 * b, 0.85 * b, 1.0 * b, 0, 0);
    }
    if (!used) {
      dyn(x, 0.06, z, G('o'), 0.3, 0.8, 1.6, 2.0, 0, 0);
      if (mr() < 0.2)
        spawn(x + (mr() - 0.5) * 0.6, 0.1, z + (mr() - 0.5) * 0.6, 0, 0.6, 0, 1.4, G(mpick(['.', "'"])), 0.1, 0.6, 1.5, 1.8, 0);
    }
  }
}

/** 墓を描く（26 より遠い物と、取った物は描かない）：十字の墓標と、上に浮かぶ墓のルーン */
export function drawGraves(t: number): void {
  for (const it of level().items || []) {
    if (it.kind !== 'grave' || it.taken) continue;
    const [x, z] = cpos(it.i);
    if (Math.hypot(x - player.x, z - player.z) > 26) continue;
    for (let y = 0; y < 3; y++) dyn(x, 0.2 + y * 0.3, z, G(y === 2 ? '+' : '|'), 0.34, 0.55, 0.55, 0.62, 0, 0);
    dyn(x - 0.18, 0.62, z, G('-'), 0.3, 0.5, 0.5, 0.58, 0, 0);
    dyn(x + 0.18, 0.62, z, G('-'), 0.3, 0.5, 0.5, 0.58, 0, 0);
    // 墓には必ずルーンがある（無ければここで止まる）
    const rune = must(it.rune, '墓のルーン'),
      c = must(runeCol(rune), '墓のルーンの色'),
      b = 0.9 + 0.4 * Math.sin(t * 1.8 + it.i);
    dyn(
      x,
      1.35 + 0.06 * Math.sin(t * 1.3),
      z,
      G(must(lookup(RUNE_DEF, rune.type).ch, 'ルーンの文字')),
      0.26,
      (c[0] ?? NaN) * b,
      (c[1] ?? NaN) * b,
      (c[2] ?? NaN) * b,
      0,
      0,
    );
  }
}

/** クモの巣を描く（30 より遠い物は描かない）。火のマスにある巣は燃え落ちる（そばなら、その階で一度だけ伝言）。触れた巣は震える */
export function drawWebs(t: number): void {
  const D = level();
  if (!D.webs) return;
  for (const w of D.webs) {
    if (w.gone) continue;
    const [x, z] = cpos(w.i),
      dd = Math.hypot(x - player.x, z - player.z);
    if (dd > 30) continue;
    if ((blaze.fire[w.i] ?? NaN) > 0.1) {
      w.gone = true;
      for (let q = 0; q < 30; q++) {
        const a = mr() * 6.28;
        spawn(
          x,
          0.6 + mr() * 1.6,
          z,
          Math.cos(a) * 0.6,
          0.4 + mr(),
          Math.sin(a) * 0.6,
          1 + mr(),
          G(mpick(['*', '.', "'"])),
          0.14,
          2.4,
          1.2,
          0.4,
          0,
        );
      }
      if (!here.webBurnMsg && dd < 20) {
        here.webBurnMsg = true;
        msg('<b style="color:#ff9a4a">%</b>クモの巣が、ぱちぱちと音を立てて燃え落ちた。');
      }
      continue;
    }
    const yaw = w.ax === 0 ? Math.PI / 2 : 0,
      tX = Math.cos(yaw),
      tZ = -Math.sin(yaw),
      sh = 0.85 + 0.15 * Math.sin(t * 1.3 + w.i),
      k = ((w.shake ?? NaN) > 0 ? 1.8 : 1) * sh;
    if ((w.shake ?? NaN) > 0) w.shake = (w.shake ?? NaN) - 1 / 60;
    const jit = (w.shake ?? NaN) > 0 ? Math.sin(t * 40) * 0.04 : 0;
    for (let s2 = 0; s2 < 8; s2++) {
      const a = (s2 / 8) * Math.PI * 2,
        ch = Math.abs(Math.cos(a)) > 0.92 ? '-' : Math.abs(Math.sin(a)) > 0.92 ? '|' : Math.cos(a) * Math.sin(a) > 0 ? '/' : '\\';
      for (let r = 1; r <= 4; r++) {
        const u = Math.cos(a) * r * 0.24 + jit,
          v = Math.sin(a) * r * 0.24;
        dyn(x + tX * u, 1.3 + v, z + tZ * u, G(ch), 0.2, 0.8 * k, 0.75 * k, 1.0 * k, 2, yaw);
      }
    }
    for (const rr of [0.42, 0.84])
      for (let s2 = 0; s2 < 12; s2++) {
        const a = (s2 / 12) * Math.PI * 2 + 0.26;
        dyn(
          x + tX * (Math.cos(a) * rr + jit),
          1.3 + Math.sin(a) * rr,
          z + tZ * (Math.cos(a) * rr + jit),
          G(s2 % 3 ? '.' : '*'),
          0.14,
          1.1 * k,
          1.0 * k,
          1.4 * k,
          2,
          yaw,
        );
      }
  }
}

/** プレイヤーがマス i の巣に触れたか（燃え落ちた巣は触れない）。触れると巣が震え、そばのクモが目を覚ましてそこへ向かう（3秒に1回まで）。その階で初めてなら伝言 */
export function webTouch(i: number): boolean {
  const D = level();
  const w = D.webAt && D.webAt.get(i);
  if (!w || w.gone) return false;
  if (clock.time - (w.touchT || -99) > 3) {
    w.touchT = clock.time;
    w.shake = 1.2;
    sSqueak(player.x, player.z);
    for (const m of here.monsters) {
      if (!m.ty.spider || Math.hypot(m.x - player.x, m.z - player.z) > 24) continue;
      m.sleep = false;
      m.aware = Math.max(m.aware ?? NaN, 1.05);
      m.goal = [((i % MW) + 0.5) * CELL, (((i / MW) | 0) + 0.5) * CELL];
      m.goalT = clock.time + 12;
    }
    if (!here.webMsg) {
      here.webMsg = true;
      msg('<b style="color:#d8c8ff">%</b>光る糸に絡まった！ 巣全体が震えている……。炎なら、糸を焼き払える。');
    }
  }
  return true;
}

/**
 * 罠と鉄格子を描く：見つかった罠（30 より遠い物は描かない。作動した物は暗い）、
 * 鉄格子の宝物庫の格子（開くほど上がる）と壁のレバー、網に掛かっている間の目の前の網
 */
export function drawTraps(t: number): void {
  for (const tr of level().traps || []) {
    if (tr.hidden) continue;
    const [x, z] = cpos(tr.i);
    if (Math.hypot(x - player.x, z - player.z) > 30) continue;
    const col = nth(lookup(TRAP_INFO, tr.type), 1),
      c = [parseInt(col.slice(1, 3), 16) / 255, parseInt(col.slice(3, 5), 16) / 255, parseInt(col.slice(5, 7), 16) / 255],
      k = tr.used ? 0.35 : 1.2 + 0.5 * Math.sin(t * 2.5 + tr.i);
    dyn(x, 0.05, z, G('^'), 0.7, nth(c, 0) * k, nth(c, 1) * k, nth(c, 2) * k, 1, 0);
    for (let q = 0; q < 8; q++) {
      const a = (q / 8) * Math.PI * 2 + t * 0.4;
      dyn(
        x + Math.cos(a) * 0.55,
        0.04,
        z + Math.sin(a) * 0.55,
        G('.'),
        0.18,
        nth(c, 0) * k * 0.7,
        nth(c, 1) * k * 0.7,
        nth(c, 2) * k * 0.7,
        1,
        a,
      );
    }
  }
  const G2 = level().gate;
  if (G2) {
    const [gx, gz] = cpos(G2.cell);
    if (Math.hypot(gx - player.x, gz - player.z) < 36) {
      const lift = G2.o * 2.7;
      for (let k = 0; k < 7; k++) {
        const u = ((k + 0.5) / 7) * CELL - CELL / 2,
          bx = G2.axis === 0 ? gx : gx + u,
          bz = G2.axis === 0 ? gz + u : gz;
        for (let y = 0.15 + lift; y < 3.0; y += 0.3) dyn(bx, y, bz, G('|'), 0.3, 0.75, 0.72, 0.8);
      }
      for (const yy of [0.9 + lift, 1.9 + lift])
        if (yy < 3.0)
          for (let k = 0; k < 7; k++) {
            const u = ((k + 0.5) / 7) * CELL - CELL / 2;
            dyn(G2.axis === 0 ? gx : gx + u, yy, G2.axis === 0 ? gz + u : gz, G('='), 0.28, 0.75, 0.72, 0.8);
          }
    }
    const [lx, lz] = cpos(G2.lever),
      wx = lx + G2.ld[0] * 0.93,
      wz = lz + G2.ld[1] * 0.93;
    dyn(wx, 1.3, wz, G('#'), 0.4, 0.6, 0.55, 0.5);
    dyn(wx - G2.ld[0] * 0.08, 1.45, wz - G2.ld[1] * 0.08, G(G2.open ? '\\' : '/'), 0.42, 1.4, 1.1, 0.5);
  }
  if ((player.netT ?? NaN) > 0) {
    const fx = -Math.sin(player.yaw),
      fz = -Math.cos(player.yaw),
      rx = Math.cos(player.yaw),
      rz = -Math.sin(player.yaw),
      cy = gfx.camera.position.y;
    for (let a = -3; a <= 3; a++)
      for (let b = -2; b <= 2; b++)
        dyn(
          gfx.camera.position.x + fx * 0.7 + rx * a * 0.16,
          cy + b * 0.16,
          gfx.camera.position.z + fz * 0.7 + rz * a * 0.16,
          G('+'),
          0.1,
          0.55,
          0.5,
          0.6,
        );
  }
}

/**
 * 床のルーンと、置いてある物の光：床の目印と魔法の場・階段の封・泉・墓を描き、
 * 宝物庫の褒美の部屋の兆し（番人が目を覚ます部屋は、床に立つ影と赤い目。天井が崩れる部屋は、床のひびと落ちる砂）、空の枠、床と台と祭壇のルーン（番人が生きている間は暗く）、
 * 石碑を描く。術の跡（光線・飛ぶ物）と、詠唱している手の前を回るルーン、付け替えの間に体のまわりを回るルーンも、ここで描く
 */
export function drawRunesWorld(t: number): void {
  drawZones(t);
  drawStairSeal(t);
  drawSprings(t);
  drawGraves(t);
  {
    const pr = (level().items || []).find((o) => o.vault && !o.taken && o.ev);
    if (pr) {
      const ri = nth(level().roomOf, pr.i),
        room =
          ri >= 0 && level().rooms[ri] && must(level().rooms[ri], '部屋').cells.length > 6
            ? must(level().rooms[ri], '部屋')
            : pr.area || (pr.area = { cells: vaultArea(pr, 2) });
      const [px, pz] = cpos(pr.i);
      if (room && Math.hypot(px - player.x, pz - player.z) < 20) {
        const rr = mulberry32((pr.i * 31 + 7) >>> 0);
        if (pr.ev === 'guard') {
          for (let k = 0; k < 2; k++) {
            const c = nth(room.cells, Math.floor(rr() * room.cells.length)),
              [x, z] = cpos(c),
              b = 0.6 + 0.5 * Math.max(0, Math.sin(t * 0.9 + k * 2));
            dyn(x - 0.06, 1.35, z, G('.'), 0.12, 1.6 * b, 0.3 * b, 0.25 * b, 0, 0);
            dyn(x + 0.06, 1.35, z, G('.'), 0.12, 1.6 * b, 0.3 * b, 0.25 * b, 0, 0);
            for (let y = 0; y < 4; y++) dyn(x, 0.2 + y * 0.32, z, G(y === 3 ? '@' : '#'), 0.3, 0.32, 0.3, 0.34, 0, 0);
          }
        } else {
          if (mr() < 0.12) {
            const c = nth(room.cells, Math.floor(mr() * room.cells.length)),
              [x, z] = cpos(c);
            spawn(x + (mr() - 0.5), 2.8, z + (mr() - 0.5), 0, -0.4, 0, 2.2, G(mpick(['.', ','])), 0.1, 0.6, 0.56, 0.5, 1);
          }
          for (let k = 0; k < 6; k++) {
            const c = nth(room.cells, Math.floor(rr() * room.cells.length)),
              [x, z] = cpos(c);
            dyn(x, 0.03, z, G(rr() < 0.5 ? '/' : '\\'), 0.18, 0.4, 0.36, 0.32, 0, 0);
          }
        }
      }
    }
  }
  for (const it of level().items || []) {
    if (it.taken || it.kind !== 'slot') continue;
    const [x, z] = cpos(it.i);
    if (Math.hypot(x - player.x, z - player.z) > 28) continue;
    const b = 1.8 + 0.6 * Math.sin(t * 2.2 + it.i),
      hy = 0.75 + 0.08 * Math.sin(t * 1.6);
    dyn(x - 0.16, hy, z, G('{'), 0.34, (2.6 * b) / 2, (2.2 * b) / 2, (1.3 * b) / 2, 0, 0);
    dyn(x + 0.16, hy, z, G('}'), 0.34, (2.6 * b) / 2, (2.2 * b) / 2, (1.3 * b) / 2, 0, 0);
    dyn(x, hy, z, G('.'), 0.2, 1.6, 1.5, 1.2, 0, 0);
    if (mr() < 0.15) spawn(x + (mr() - 0.5) * 0.4, hy, z + (mr() - 0.5) * 0.4, 0, 0.5, 0, 0.8, G('.'), 0.1, 2.2, 1.9, 1.2, 0);
  }
  for (const it of level().items || []) {
    if (it.taken || it.kind !== 'rune') continue;
    let [x, z] = cpos(it.i);
    const dd = Math.hypot(x - player.x, z - player.z);
    if (dd > 28) continue;
    const guarded = it.guardG !== undefined && guardedNow(it);
    if (guarded && it.elitePrize) {
      const b = 0.5;
      dyn(x, 0.75, z, G(must(lookup(RUNE_DEF, must(it.rune, '床のルーン').type).ch, 'ルーンの文字')), 0.42, 0.5 * b, 0.45 * b, 0.5 * b);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + t * 0.3;
        dyn(x + Math.cos(a) * 0.4, 0.75 + Math.sin(a * 2) * 0.08, z + Math.sin(a) * 0.4, G('#'), 0.14, 0.55, 0.25, 0.2);
      }
      continue;
    }
    if (!it.rune || guarded) {
      if (dd < 12 && it.altar && !guarded) altarFill(must(it.grp, '祭壇の組'));
      if (!it.rune || guarded) {
        if (it.altar && it.slot === 1 && it.opt !== 'open')
          for (let k = -1; k <= 1; k++) {
            dyn(x + k * 0.55, 0.55, z, G('='), 0.42, 0.4, 0.38, 0.45);
            dyn(x + k * 0.55, 0.25, z, G('#'), 0.36, 0.3, 0.28, 0.34);
          }
        continue;
      }
    }
    if (it.altar) x += ((it.slot ?? NaN) - 1) * 0.55;
    const c = must(runeCol(it.rune), 'ルーンの色'),
      tc = nth(TIER_COL, 0),
      b = 1.7 + 0.5 * Math.sin(t * 2 + it.i + (it.slot || 0)),
      hy = it.pedestal ? 1.05 : it.altar ? 1.05 : 0.6;
    if (it.pedestal) {
      dyn(x, 0.25, z, G('|'), 0.36, 0.5, 0.48, 0.55);
      dyn(x, 0.6, z, G('|'), 0.36, 0.5, 0.48, 0.55);
      dyn(x, 0.85, z, G('='), 0.34, 0.6, 0.58, 0.65);
    }
    if (it.altar && it.slot === 1 && it.opt !== 'open') {
      for (let k = -1; k <= 1; k++) {
        dyn(x + k * 0.55, 0.55, z, G('='), 0.42, 0.55, 0.52, 0.6);
        dyn(x + k * 0.55, 0.25, z, G('#'), 0.36, 0.4, 0.38, 0.45);
      }
    }
    if (it.opt === 'heal') {
      dyn(x, hy + Math.sin(t * 1.5 + it.i + (it.slot || 0)) * 0.06, z, G('+'), 0.5, 1.0 * b, 0.5 * b, 0.58 * b);
    } else {
      dyn(
        x,
        hy + Math.sin(t * 1.5 + it.i + (it.slot || 0)) * 0.06,
        z,
        G(must(lookup(RUNE_DEF, it.rune.type).ch, 'ルーンの文字')),
        0.5,
        nth(c, 0) * b,
        nth(c, 1) * b,
        nth(c, 2) * b,
      );
    }
    for (let k = 0; k < 6; k++) {
      const a = t * 0.8 + (k / 6) * Math.PI * 2 + (it.slot || 0);
      dyn(x + Math.cos(a) * 0.3, hy - 0.45, z + Math.sin(a) * 0.3, G('.'), 0.1, tc[0] * 1.4, tc[1] * 1.4, tc[2] * 1.4);
    }
  }
  for (const s of level().steles || []) {
    const [x, z] = cpos(s.i),
      d = Math.hypot(x - player.x, z - player.z);
    if (d > 30) continue;
    const near = d < 2.6,
      g = near ? 2.2 : 0.9;
    for (let y = 0; y < 4; y++) dyn(x, 0.25 + y * 0.42, z, G(y === 3 ? '^' : '#'), 0.4, 0.42, 0.4, 0.48);
    dyn(x, 1.0 + Math.sin(t * 1.3 + s.i) * 0.04, z + 0.01, G(s.g), 0.32, 0.55 * g, 0.75 * g, 1.0 * g);
  }
  for (const b of fight.beamSegs) {
    let run = 0;
    for (let k = 0; k + 1 < b.pts.length; k++) {
      const a = nth(b.pts, k),
        e = nth(b.pts, k + 1),
        L = Math.hypot(e[0] - a[0], e[1] - a[1], e[2] - a[2]),
        n = Math.max(1, Math.round(L / 0.22));
      for (let j = 0; j < n; j++) {
        const f = j / n,
          fl = 0.75 + 0.5 * mr(),
          dd = run + L * f,
          near = Math.max(0, 1 - dd / 7),
          sz = 0.1 + 0.1 * near,
          br = 1.3 + 1.2 * near;
        dyn(
          a[0] + (e[0] - a[0]) * f,
          a[1] + (e[1] - a[1]) * f,
          a[2] + (e[2] - a[2]) * f,
          G(mpick(['-', '=', '*'])),
          sz,
          nth(b.col, 0) * br * fl,
          nth(b.col, 1) * br * fl,
          nth(b.col, 2) * br * fl,
        );
      }
      run += L;
    }
    const e = nth(b.pts, b.pts.length - 1);
    dyn(e[0], e[1], e[2], G('*'), 0.3, nth(b.col, 0) * 3, nth(b.col, 1) * 3, nth(b.col, 2) * 3);
  }
  for (const p of fight.projs) {
    if (p.wave || p.thrust) {
      drawWave(p);
      continue;
    }
    const c = must(elemCol(p.sp.elem), '性質の色');
    dyn(
      p.x,
      p.y,
      p.z,
      G(p.kind === 'bolt' ? '*' : 'o'),
      p.kind === 'bolt' ? 0.26 : 0.32,
      nth(c, 0) * 2.2,
      nth(c, 1) * 2.2,
      nth(c, 2) * 2.2,
    );
    if (p.auto) dyn(p.x, p.y, p.z, G('o'), 0.46, 0.9, 0.9, 1.0);
  }
  // the chant gathers at the hand: the hand's runes circle in front of you, brighter as the chant fills
  if (gear.castSt || gear.swapSt) {
    const [ox, oy, oz] = aimOrigin(),
      [fx, fy, fz] = viewDir(),
      rx = Math.cos(player.yaw),
      rz = -Math.sin(player.yaw);
    if (gear.castSt) {
      const H = must(gear.hands, '両手 gear.hands')[gear.castSt.h],
        side = gear.castSt.h === 'L' ? -0.35 : 0.35,
        k = Math.min(1, gear.castSt.t / Math.max(0.01, gear.castSt.need)),
        c = must(elemCol(H.elem ? H.elem.type : null), '性質の色'),
        list = [H.elem].filter(Boolean);
      list.forEach((ru, j) => {
        const a = t * 3 + j * Math.PI,
          r = 0.12 + 0.06 * k;
        dyn(
          ox + fx * 0.8 + rx * (side + Math.cos(a) * r),
          oy - 0.3 + fy * 0.8 + Math.sin(a) * r,
          oz + fz * 0.8 + rz * (side + Math.cos(a) * r),
          G(must(lookup(RUNE_DEF, must(ru, '手の性質のルーン').type).ch, 'ルーンの文字')),
          0.1 + 0.05 * k,
          nth(c, 0) * (1 + 2 * k),
          nth(c, 1) * (1 + 2 * k),
          nth(c, 2) * (1 + 2 * k),
        );
      });
    }
    if (gear.swapSt) {
      const rs = allRunes()
          .filter((r) => ['elem', 'trig', 'mod'].includes(lookup(RUNE_DEF, r.type).cat))
          .slice(0, 8),
        k = gear.swapSt.t / gear.swapSt.dur;
      rs.forEach((ru, j) => {
        const a = t * 2 + (j / rs.length) * Math.PI * 2;
        dyn(
          player.x + Math.cos(a) * 0.9,
          player.eye - 0.5 + Math.sin(t * 3 + j) * 0.08,
          player.z + Math.sin(a) * 0.9,
          G(must(lookup(RUNE_DEF, ru.type).ch, 'ルーンの文字')),
          0.2,
          0.6 + k,
          0.6 + k,
          0.9 + k,
        );
      });
    }
  }
}
