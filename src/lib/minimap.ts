// ミニマップ（もとは src/game/16-view-input.js の sizeMap・drawMap）：右上のキャンバス（#map）に、プレイヤーのまわりの見たマスを文字で描く。
// 今見えているマスは、灯りと手元の灯りで照らした色で描き、その色を here.mem に覚える。見えていないマスは、覚えた色を暗く、青みに寄せて描く。
// 燃えているマスは、地面（氷・瓦礫・枯れ草）や飾りより火を描き、燃え尽きた草は灰の印で描く。
// 床の物（ルーン）・見つけた罠・鉄格子とレバー・クモの巣・見えている生き物（透明な物は近い時だけ薄く）・プレイヤーと向きの矢印を、上に重ねる。
// 状態の入れ物 ui（キャンバスと描き手。16-view-input.js が document から入れる）・here（今の階と見たマス）・player・blaze（火と灰）・lantern に頼る。
// 呼ぶのは、16-view-input.js が読み込んだ時と、30-loop-init.js が画面の大きさが変わった時に sizeMap、src/lib/loop.ts の tick の段 'map' で drawMap。
import { lookup, must, nth } from './array.ts';
import { css } from './color.ts';
import { MCH, MCW, MMC, MMR, MPAD, tone } from './hud.ts';
import { LANTERN } from './light.ts';
import { cellLight } from './lightmap.ts';
import { TRAP_INFO } from './names.ts';
import { clamp } from './rng.ts';
import { TIER_COL } from './runes.ts';
import { blaze, here, lantern, player, ui } from './state.ts';
import {
  CELL,
  LQ_BOG,
  LQ_DEEP,
  LQ_LAVA,
  LQ_WATER,
  MH,
  MW,
  SF_BRIM,
  SF_DEAD,
  SF_FOLIAGE,
  SF_FUNGFOR,
  SF_GRASS,
  SF_HAY,
  SF_ICE,
  SF_LUMEN,
  SF_MUD,
  SF_OBSIDIAN,
  SF_RUBBLE,
  TC,
  TF,
  TP,
  TW,
  TX,
  VEIN_COL,
} from './world.ts';

/** キャンバスの大きさを、画面の倍率（2 まで）に合わせる（描き手の座標は、倍率によらずミニマップの大きさのまま） */
export function sizeMap(): void {
  const mapC = must(ui.mapC, 'ミニマップ #map'),
    mctx = must(ui.mctx, 'ミニマップの描き手');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  mapC.width = Math.round((MMC * MCW + MPAD * 2) * dpr);
  mapC.height = Math.round((MMR * MCH + MPAD * 2) * dpr);
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** ミニマップを描く（プレイヤーを真ん中に、マップの端では寄せる） */
export function drawMap(): void {
  const mctx = must(ui.mctx, 'ミニマップの描き手'),
    D = must(here.D, '今の階 here.D');
  const Wd = MMC * MCW + MPAD * 2,
    Hd = MMR * MCH + MPAD * 2;
  mctx.clearRect(0, 0, Wd, Hd);
  mctx.fillStyle = 'rgba(3,2,10,0.6)';
  mctx.fillRect(4, 5, Wd - 8, Hd - 10);
  mctx.font = '400 10px "JetBrains Mono",Menlo,Consolas,monospace';
  mctx.textAlign = 'center';
  mctx.textBaseline = 'middle';
  mctx.fillStyle = 'rgba(120,108,200,0.6)';
  for (let x = 11; x < Wd - 8; x += 7) {
    mctx.fillText('-', x, 5);
    mctx.fillText('-', x, Hd - 5);
  }
  for (let y = 14; y < Hd - 9; y += 9) {
    mctx.fillText('|', 4, y);
    mctx.fillText('|', Wd - 4, y);
  }
  for (const [x, y] of [
    [4, 5],
    [Wd - 4, 5],
    [4, Hd - 5],
    [Wd - 4, Hd - 5],
  ] as const)
    mctx.fillText('+', x, y);
  const pcx = player.x / CELL,
    pcz = player.z / CELL;
  const ox = clamp(Math.floor(pcx) - (MMC >> 1), 0, MW - MMC),
    oy = clamp(Math.floor(pcz) - (MMR >> 1), 0, MH - MMR);
  const px = MPAD + (pcx - ox) * MCW,
    py = MPAD + (pcz - oy) * MCH;
  const fx = -Math.sin(player.yaw),
    fz = -Math.cos(player.yaw),
    ang = Math.atan2(fz * MCH, fx * MCW);
  const grad = mctx.createRadialGradient(px, py, 3, px, py, 120);
  grad.addColorStop(0, 'rgba(150,205,255,0.22)');
  grad.addColorStop(1, 'rgba(150,205,255,0)');
  mctx.fillStyle = grad;
  mctx.beginPath();
  mctx.moveTo(px, py);
  mctx.arc(px, py, 120, ang - 0.62, ang + 0.62);
  mctx.closePath();
  mctx.fill();
  mctx.font = '700 12px "JetBrains Mono",Menlo,Consolas,monospace';
  mctx.textAlign = 'center';
  mctx.textBaseline = 'middle';
  for (let r = 0; r < MMR; r++)
    for (let c = 0; c < MMC; c++) {
      const x = ox + c,
        y = oy + r,
        i = y * MW + x;
      if (!here.explored[i]) continue;
      const tt = D.tile[i];
      let ch: string, b0: number, b1: number, b2: number;
      // 燃えているマスは、飾り（血・骨・絨毯など）より火を描く。備品の文字は残す
      const burning = (blaze.fire[i] ?? NaN) > 0.05,
        fxc = D.fixCell.get(i),
        dc = fxc || burning ? null : D.decoCell.get(i);
      if (fxc) {
        ch = fxc.ch;
        b0 = (fxc.col[0] ?? NaN) * 1.4 + 0.3;
        b1 = (fxc.col[1] ?? NaN) * 1.4 + 0.3;
        b2 = (fxc.col[2] ?? NaN) * 1.4 + 0.3;
      } else if (dc) {
        ch = dc.ch;
        b0 = nth(dc.col, 0);
        b1 = nth(dc.col, 1);
        b2 = nth(dc.col, 2);
      } else if (tt === TW && D.vein[i]) {
        ch = D.vein[i] === 1 ? '$' : '*';
        const vc = lookup(VEIN_COL, nth(D.vein, i));
        b0 = vc[0];
        b1 = vc[1];
        b2 = vc[2];
      } else if (tt === TW) {
        ch = '#';
        b0 = 0.72;
        b1 = 0.7;
        b2 = 1.0;
      } else if (tt === TP) {
        ch = '0';
        b0 = 0.8;
        b1 = 0.78;
        b2 = 1.0;
      } else if (tt === TC) {
        ch = ':';
        b0 = 0.42;
        b1 = 0.26;
        b2 = 0.7;
      } else if (tt === TX) {
        ch = '#';
        const xc = D.xtalCol.get(i) || [0.6, 0.85, 1.0];
        b0 = (xc[0] ?? NaN) * 1.2;
        b1 = (xc[1] ?? NaN) * 1.2;
        b2 = (xc[2] ?? NaN) * 1.2;
      } else if (D.bridge[i]) {
        ch = '=';
        b0 = 0.85;
        b1 = 0.62;
        b2 = 0.4;
      } else if (D.liquid[i] === LQ_DEEP) {
        ch = '~';
        b0 = 0.2;
        b1 = 0.34;
        b2 = 0.85;
      } else if (D.liquid[i] === LQ_BOG) {
        ch = '~';
        b0 = 0.55;
        b1 = 0.6;
        b2 = 0.28;
      } else if (burning) {
        // 火は、地面（氷・瓦礫・枯れ草）より先に描く
        ch = '^';
        b0 = 2.2;
        b1 = 1.0;
        b2 = 0.3;
      } else if (D.surface[i] === SF_ICE) {
        ch = '=';
        b0 = 0.7;
        b1 = 0.9;
        b2 = 1.1;
      } else if (D.surface[i] === SF_RUBBLE && !D.liquid[i]) {
        ch = ',';
        b0 = 0.7;
        b1 = 0.58;
        b2 = 0.48;
      } else if (D.surface[i] === SF_DEAD && !blaze.burnt[i]) {
        // 燃え尽きた枯れ草は、下の灰の印で描く
        ch = '"';
        b0 = 0.65;
        b1 = 0.52;
        b2 = 0.32;
      } else if (D.pit && D.pit[i]) {
        ch = ':';
        b0 = 1.0;
        b1 = 0.5;
        b2 = 0.25;
      } else if ((D.doorAt[i] ?? NaN) >= 0 && nth(D.doors, nth(D.doorAt, i)).gone) {
        ch = ',';
        b0 = 0.35;
        b1 = 0.32;
        b2 = 0.32;
      } else if (blaze.burnt[i] && tt === TF && !D.liquid[i]) {
        ch = ',';
        b0 = 0.38;
        b1 = 0.35;
        b2 = 0.36;
      } else if ((D.doorAt[i] ?? NaN) >= 0) {
        ch = nth(D.doors, nth(D.doorAt, i)).o > 0.5 ? "'" : '+';
        b0 = 0.95;
        b1 = 0.66;
        b2 = 0.38;
      } else if (D.liquid[i] === LQ_LAVA) {
        ch = '~';
        b0 = 1.3;
        b1 = 0.45;
        b2 = 0.12;
      } else if (D.liquid[i] === LQ_WATER) {
        ch = '~';
        b0 = 0.35;
        b1 = 0.68;
        b2 = 1.0;
      } else if (D.surface[i] === SF_OBSIDIAN) {
        ch = ',';
        b0 = 0.6;
        b1 = 0.35;
        b2 = 0.35;
      } else if (D.surface[i] === SF_FOLIAGE || D.surface[i] === SF_FUNGFOR) {
        const t2 = blaze.cellFlag[i] === 20;
        ch = t2 ? ',' : '"';
        if (D.surface[i] === SF_FUNGFOR) {
          b0 = 0.5;
          b1 = 0.9;
          b2 = 1.0;
        } else {
          b0 = 0.3;
          b1 = t2 ? 0.6 : 0.85;
          b2 = 0.3;
        }
      } else if (D.surface[i] === SF_BRIM) {
        ch = '*';
        b0 = 1.0;
        b1 = 0.82;
        b2 = 0.3;
      } else if (D.surface[i] === SF_MUD) {
        ch = '~';
        b0 = 0.55;
        b1 = 0.4;
        b2 = 0.25;
      } else if (D.surface[i] === SF_HAY) {
        ch = '"';
        b0 = 0.95;
        b1 = 0.8;
        b2 = 0.4;
      } else if (D.surface[i] === SF_GRASS || D.surface[i] === SF_LUMEN) {
        ch = '"';
        b0 = 0.35;
        b1 = 0.95;
        b2 = D.surface[i] === SF_LUMEN ? 0.85 : 0.55;
      } else {
        ch = '.';
        b0 = 0.68;
        b1 = 0.68;
        b2 = 0.9;
      }
      let r0: number, g0: number, bl: number;
      if (here.fovVis[i] === here.fovStamp) {
        const l = cellLight((x + 0.5) * CELL, (y + 0.5) * CELL);
        const d = Math.hypot(x + 0.5 - pcx, y + 0.5 - pcz) * CELL,
          lan = Math.max(0, 1 - d / lantern.r);
        const lw = lan * lan * 0.75 * lantern.k;
        const e = fxc || D.liquid[i] === LQ_LAVA ? 1.0 : tt === TX ? 0.7 : dc ? 0.32 : 0.16;
        r0 = b0 * (e + l[0] * 0.85 + lw * (LANTERN[0] ?? NaN));
        g0 = b1 * (e + l[1] * 0.85 + lw * (LANTERN[1] ?? NaN));
        bl = b2 * (e + l[2] * 0.85 + lw * (LANTERN[2] ?? NaN));
        here.mem[i * 3] = r0;
        here.mem[i * 3 + 1] = g0;
        here.mem[i * 3 + 2] = bl;
      } else {
        const m0 = nth(here.mem, i * 3),
          m1 = nth(here.mem, i * 3 + 1),
          m2 = nth(here.mem, i * 3 + 2),
          avg = (m0 + m1 + m2) / 3;
        r0 = (m0 * 0.4 + avg * 0.6) * 0.32 + 0.035;
        g0 = (m1 * 0.4 + avg * 0.6) * 0.32 + 0.035;
        bl = (m2 * 0.4 + avg * 0.6) * 0.36 + 0.085;
      }
      const gv = nth(D.gas, i);
      if (gv > 0.08 && here.fovVis[i] === here.fovStamp) {
        mctx.fillStyle = `rgba(120,190,60,${Math.min(0.4, gv * 0.45).toFixed(2)})`;
        mctx.fillRect(MPAD + c * MCW, MPAD + r * MCH, MCW, MCH);
      }
      mctx.fillStyle = `rgb(${tone(r0)},${tone(g0)},${tone(bl)})`;
      mctx.fillText(ch, MPAD + (c + 0.5) * MCW, MPAD + (r + 0.5) * MCH);
    }
  mctx.shadowBlur = 8;
  for (const it of D.items || []) {
    if (it.taken || !here.explored[it.i]) continue;
    if (!it.rune) continue;
    const tc = nth(TIER_COL, 0),
      c = (it.i % MW) - ox,
      r = ((it.i / MW) | 0) - oy;
    if (c < 0 || r < 0 || c >= MMC || r >= MMR) continue;
    mctx.shadowColor = css(tc);
    mctx.fillStyle = css(tc);
    mctx.fillText('*', MPAD + (c + 0.5) * MCW, MPAD + (r + 0.5) * MCH);
  }
  for (const tr of D.traps || []) {
    if (tr.hidden || !here.explored[tr.i]) continue;
    const c = (tr.i % MW) - ox,
      r = ((tr.i / MW) | 0) - oy;
    if (c < 0 || r < 0 || c >= MMC || r >= MMR) continue;
    mctx.shadowColor = lookup(TRAP_INFO, tr.type)[1];
    mctx.fillStyle = lookup(TRAP_INFO, tr.type)[1];
    mctx.fillText('^', MPAD + (c + 0.5) * MCW, MPAD + (r + 0.5) * MCH);
  }
  if (D.gate) {
    for (const [ci, chr] of [
      [D.gate.cell, D.gate.open ? '.' : '#'],
      [D.gate.lever, '/'],
    ] as const) {
      if (!here.explored[ci]) continue;
      const c = (ci % MW) - ox,
        r = ((ci / MW) | 0) - oy;
      if (c < 0 || r < 0 || c >= MMC || r >= MMR) continue;
      mctx.shadowColor = '#ffd48a';
      mctx.fillStyle = '#ffd48a';
      mctx.fillText(chr, MPAD + (c + 0.5) * MCW, MPAD + (r + 0.5) * MCH);
    }
  }
  for (const w of D.webs || []) {
    if (w.gone || !here.explored[w.i]) continue;
    const c = (w.i % MW) - ox,
      r = ((w.i / MW) | 0) - oy;
    if (c < 0 || r < 0 || c >= MMC || r >= MMR) continue;
    mctx.shadowColor = '#d8c8ff';
    mctx.fillStyle = 'rgba(216,200,255,0.8)';
    mctx.fillText('%', MPAD + (c + 0.5) * MCW, MPAD + (r + 0.5) * MCH);
  }
  for (const m of here.monsters) {
    const ghost = m.ty.invisible && Math.hypot(m.x - player.x, m.z - player.z) < 6;
    if (!m.visible && !ghost) continue;
    const c = m.cx - ox,
      r = m.cz - oy;
    if (c < 0 || r < 0 || c >= MMC || r >= MMR) continue;
    const col: readonly [number, number, number] = ghost ? [0.25, 0.3, 0.4] : m.hidden ? [1.0, 0.82, 0.42] : m.ty.col;
    mctx.shadowColor = css(col);
    mctx.fillStyle = css(col);
    mctx.fillText(m.hidden ? '?' : m.ty.ch, MPAD + (m.x / CELL - ox) * MCW, MPAD + (m.z / CELL - oy) * MCH);
  }
  mctx.shadowColor = 'rgba(255,255,255,0.9)';
  mctx.fillStyle = '#ffffff';
  mctx.shadowBlur = 10;
  mctx.font = '800 13px "JetBrains Mono",Menlo,Consolas,monospace';
  mctx.fillText('@', px, py);
  mctx.shadowBlur = 0;
  mctx.fillStyle = 'rgba(170,220,255,0.95)';
  const tx = px + Math.cos(ang) * 11,
    ty = py + Math.sin(ang) * 11;
  mctx.beginPath();
  mctx.moveTo(tx + Math.cos(ang) * 4, ty + Math.sin(ang) * 4);
  mctx.lineTo(tx + Math.cos(ang + 2.4) * 3.5, ty + Math.sin(ang + 2.4) * 3.5);
  mctx.lineTo(tx + Math.cos(ang - 2.4) * 3.5, ty + Math.sin(ang - 2.4) * 3.5);
  mctx.closePath();
  mctx.fill();
}
