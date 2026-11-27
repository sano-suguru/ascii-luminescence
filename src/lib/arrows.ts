// 方向の矢印（もとは src/game/22-world-hints.js の arrowTargets・inPlainSight・drawArrows・ARROW_TILT・ARROW_TILT0）：手元の少し上の床に寝かせた文字盤から、
// 行き先へ向けて矢印を広げる（まっすぐの向きだけで、道は教えない）。近い物は短く太く、遠い物は長く細く。階段はいつも分かる。支道の階段と門は見てから。
// 祭壇・泉・宝物庫・番人のいる褒美・墓は 20m から（分かれ道では 1.5 倍）、後の4つは見るまで '?'。見通せる所にある物には矢印を出さない。
// 描くのは、ゲームの画面に重ねた 2D のキャンバス（#arrows）。キャンバスと描き手と下の HUD は、22-world-hints.js が document から ui に入れる
// （下の HUD の大きさの変わり目を見る ResizeObserver も、そこで作る）。
// 状態の入れ物 ui・here・player・adv に頼る。呼ぶのは古い JS（30-loop-init.js の tick の段 'runes'）。
import { must, nth } from './array.ts';
import { aimOrigin, losClear, viewDir } from './aim.ts';
import { clamp } from './rng.ts';
import { adv, here, player, ui } from './state.ts';
import { isPaused } from './status.ts';
import { CELL, MW, cpos } from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');
/** 矢印を描くキャンバス（描き手があれば、ある） */
const arrowCanvas = () => must(ui.arrowCv, '矢印のキャンバス ui.arrowCv');

/** 矢印の行き先：場所・プレイヤーからの距離・先の印の文字と色 */
export interface ArrowTarget {
  x: number;
  z: number;
  d: number;
  ch: string;
  col: number[];
}

/** 矢印を出す行き先の一覧（探索中だけ。階段・支道の階段・門・祭壇・泉・墓・宝物庫・番人のいる褒美） */
export function arrowTargets(): ArrowTarget[] {
  const out: ArrowTarget[] = [];
  if (!here.D || !ui.started || adv.dead) return out;
  const pc = ((player.z / CELL) | 0) * MW + ((player.x / CELL) | 0),
    atHub = level().hub && level().roomOf[pc] === must(level().hub, '分かれ道 here.D.hub').ri,
    far = atHub ? 1.5 : 1;
  // standing at the crossroads, presences around are felt from farther off
  const P = (cell: number | null | undefined, ch: string, col: number[], range: number, seenOnly: boolean, vague?: boolean): void => {
    if (cell == null || cell < 0) return;
    if (seenOnly && !here.explored[cell]) return;
    const [x, z] = cpos(cell),
      d = Math.hypot(x - player.x, z - player.z);
    if (range && d > range * far) return;
    // a thing not yet seen is only a presence: a '?' in the colour of its light
    if (vague && !here.explored[cell]) ch = '?';
    out.push({ x, z, d, ch, col });
  };
  if (!level().finalVault && level().stairs >= 0) P(level().stairs, '>', [1.0, 0.85, 0.45], 0, false);
  if (level().bstairs) P(must(level().bstairs, '支道の階段 here.D.bstairs').cell, '>', [0.75, 0.6, 1.0], 0, true);
  if (level().portal) P(must(level().portal, '異界の門 here.D.portal').cell, '0', [1.0, 0.55, 0.9], 0, true);
  const seenAltar = new Set();
  for (const it of level().items || []) {
    if (it.taken) continue;
    if (it.altar && !seenAltar.has(it.grp)) {
      seenAltar.add(it.grp);
      if (it.forge) P(it.i, 'T', [0.7, 0.85, 1.0], 20, false);
      else P(it.i, '_', [1.0, 0.8, 0.45], 20, false);
    } else if (it.kind === 'spring') P(it.i, '~', [0.5, 0.88, 1.0], 20, false, true);
    else if (it.kind === 'grave') P(it.i, '+', [0.78, 0.78, 0.9], 20, false, true);
    else if (it.vault) P(level().gate ? must(level().gate, '宝物庫の門 here.D.gate').cell : it.i, '#', [1.0, 0.82, 0.3], 20, false, true);
    else if (it.elitePrize) P(it.i, '*', [1.0, 0.42, 0.32], 20, false, true);
  }
  return out;
}

/** 行き先が見通せる所にあるか（22 より近く、見ている向きから 0.5 ラジアンの内で、間に壁が無い） */
export function inPlainSight(t: ArrowTarget): boolean {
  if (t.d > 22) return false;
  const [ox, oy, oz] = aimOrigin(),
    [vx, vy, vz] = viewDir(),
    dx = t.x - ox,
    dz = t.z - oz,
    dy = 0.9 - oy,
    L = Math.hypot(dx, dy, dz) || 1;
  if ((dx * vx + dy * vy + dz * vz) / L < Math.cos(0.5)) return false;
  return losClear(ox, oy, oz, t.x, 0.9, t.z);
}

// the dial lies on a floor in front of you, seen from above at a slant: what is ahead points away into the dial, what is behind comes toward you.
// The slant follows the look up and down, but only between ARROW_TILT (radians above the floor), so the dial never leaves the screen or turns into a flat circle
export const ARROW_TILT = [0.55, 1.15],
  ARROW_TILT0 = 0.8;

/** 方向の矢印を描く（毎フレーム。前のフレームに描いた物は消してから。止まっている間・図鑑・死んだ後は描かない） */
export function drawArrows(): void {
  if (!ui.arrowCtx) return;
  const W = Math.round(arrowCanvas().clientWidth * devicePixelRatio),
    H = Math.round(arrowCanvas().clientHeight * devicePixelRatio),
    c = ui.arrowCtx;
  if (arrowCanvas().width !== W || arrowCanvas().height !== H) {
    arrowCanvas().width = W;
    arrowCanvas().height = H;
  }
  if (ui.arrowsDrawn) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    ui.arrowsDrawn = false;
  }
  if (!ui.started || adv.dead || isPaused() || ui.gallery) return;
  const ts = arrowTargets().filter((t) => !inPlainSight(t));
  if (!ts.length) return;
  ui.arrowsDrawn = true;
  // on a short screen the whole dial is smaller, so what is behind you still fits above the bottom edge
  const k = devicePixelRatio * clamp(arrowCanvas().clientHeight / 450, 0.6, 1),
    ox = W / 2,
    oy = H * 0.6,
    r0 = 60 * k,
    a0 = 34 * k,
    ps = player.yaw,
    fx = -Math.sin(ps),
    fz = -Math.cos(ps),
    rx = Math.cos(ps),
    rz = -Math.sin(ps),
    FONT = '"M PLUS 1 Code","BIZ UDGothic",monospace';
  // a point (u to the right, v ahead) on the dial's floor, seen from Dv away at the slant e: its place on the screen
  const e = clamp(ARROW_TILT0 - player.pitch, nth(ARROW_TILT, 0), nth(ARROW_TILT, 1)),
    ce = Math.cos(e),
    se = Math.sin(e),
    Dv = 800 * k;
  // the lowest a tip mark may reach: just above the line at the bottom (#hotbar), wherever it is now; the bottom of the screen when it is hidden
  let top = ui.hotbarTop;
  if (top === null) {
    const hb = ui.hotbarEl ? ui.hotbarEl.getBoundingClientRect() : null;
    top = hb && hb.height > 0 ? hb.top : -1;
    if (ui.hotbarWatch) ui.hotbarTop = top;
  }
  const floorY = top < 0 ? H : top * devicePixelRatio - 6 * k;
  const proj = (u: number, v: number): [number, number] => {
    const dp = Dv / (Dv + v * ce);
    return [ox + u * dp, oy - v * se * dp];
  };
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  // a glyph lying on the dial at (u,v), its line of writing along (du,dv)
  const glyph = (
    ch: string,
    u: number,
    v: number,
    du: number,
    dv: number,
    size: number,
    rgb: string,
    alpha: number,
    bold: boolean,
  ): void => {
    const [x, y] = proj(u, v),
      [ax, ay] = proj(u + du, v + dv),
      [bx, by] = proj(u + dv, v - du);
    c.save();
    c.setTransform(ax - x, ay - y, bx - x, by - y, x, y);
    c.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    c.lineWidth = Math.max(2, size * 0.28);
    c.strokeStyle = 'rgba(4,3,10,0.85)';
    c.strokeText(ch, 0, 0);
    c.shadowColor = `rgba(${rgb},${(alpha * 0.9).toFixed(2)})`;
    c.shadowBlur = size * 0.6;
    c.fillStyle = `rgba(${rgb},${alpha.toFixed(2)})`;
    c.fillText(ch, 0, 0);
    c.restore();
  };
  // a faint shadow on the floor under the dial. No ring is drawn where the arrows start: a ring of dots just below the sight read as part of it, and as the ring where an orb will land
  {
    const [cx] = proj(0, 0),
      [, ty] = proj(0, r0 * 2.2),
      [, by] = proj(0, -r0 * 2.2),
      [lx] = proj(-r0 * 2.2, 0);
    c.save();
    c.translate(cx, (ty + by) / 2);
    c.scale(1, (by - ty) / 2 / (cx - lx));
    const g = c.createRadialGradient(0, 0, 0, 0, 0, cx - lx);
    g.addColorStop(0, 'rgba(4,3,10,0.6)');
    g.addColorStop(1, 'rgba(4,3,10,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, cx - lx, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  for (const t of ts) {
    const dx = t.x - player.x,
      dz = t.z - player.z,
      th = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz),
      su = Math.sin(th),
      sv = Math.cos(th);
    const near = clamp(1 - (t.d - 3) / 37, 0, 1),
      len = (30 + 120 * (1 - near)) * k,
      size = (18 + 10 * near) * k,
      alpha = 0.62 + 0.35 * near,
      rgb = t.col.map((v) => Math.round(v * 255)).join(',');
    const step = size * 0.42,
      thick = near > 0.5,
      body = thick ? '=' : '-',
      ms = (17 + 5 * near) * k,
      tipR = (n: number): number => a0 + n * step + size * 0.85;
    // what is behind comes toward you: an arrow too long for the room above the line at the bottom is cut shorter
    // what is ahead goes up the screen, past the sight (the middle of the screen): the line leaves a gap around it, and the tip mark never sits on it
    const nearSight = (r: number, pad: number): boolean => {
      const [x, y] = proj(su * r, sv * r);
      return Math.hypot(x - W / 2, y - H / 2) < pad + 14 * k;
    };
    let n = Math.max(1, Math.round(len / step));
    while (n > 1 && (proj(su * tipR(n), sv * tipR(n))[1] > floorY - ms || nearSight(tipR(n), ms * 0.7))) n--;
    for (let i = 0; i < n; i++) {
      const r = a0 + i * step;
      if (!nearSight(r, size * 0.5)) glyph(i === n - 1 ? '>' : body, su * r, sv * r, su, sv, size, rgb, alpha, thick);
    }
    // the mark at the tip: larger, standing up on a faint dark disc, the same size however far into the dial it is, to be read at a glance
    const [mx, my] = proj(su * tipR(n), sv * tipR(n));
    c.beginPath();
    c.arc(mx, my, ms * 0.7, 0, Math.PI * 2);
    c.fillStyle = 'rgba(6,4,14,0.55)';
    c.fill();
    c.lineWidth = 1.2 * k;
    c.strokeStyle = `rgba(${rgb},${(alpha * 0.6).toFixed(2)})`;
    c.stroke();
    c.save();
    c.translate(mx, my + ms * 0.02);
    c.font = `bold ${ms}px ${FONT}`;
    c.lineWidth = Math.max(2, ms * 0.28);
    c.strokeStyle = 'rgba(4,3,10,0.85)';
    c.strokeText(t.ch, 0, 0);
    c.shadowColor = `rgba(${rgb},${(Math.min(1, alpha + 0.1) * 0.9).toFixed(2)})`;
    c.shadowBlur = ms * 0.6;
    c.fillStyle = `rgba(${rgb},${Math.min(1, alpha + 0.1).toFixed(2)})`;
    c.fillText(t.ch, 0, 0);
    c.restore();
  }
}
