// 世界の組み立て（もとは src/game/06-world.js・18-level-player.js）：階の霧の色、水面の絵、階の文字の組み立て。
// 状態の入れ物 here（今の階）・gfx（three.js の物）に頼る。three.js は src/lib/three.ts の T。
import { lookup, must, nth } from './array.ts';
import { type FormType, buildForm } from './bodies/build.ts';
import type { Color } from './color.ts';
import type { Engraving, Theme } from './generate.ts';
import { G, RUNESET, WG } from './glyphs.ts';
import { topLights } from './light.ts';
import { levelSeed } from './levels.ts';
import { flowW, sstep } from './math.ts';
import { setNoiseSeed, vnoise } from './noise.ts';
import { R, RI, keyedRand, pick, rand, withVisualRand } from './random.ts';
import { clamp } from './rng.ts';
import { gfx, here, hudInfo } from './state.ts';
import { T, fogCol } from './three.ts';
import { ARTS, VAULTS } from './vaults.ts';
import {
  BASE_H,
  CELL,
  CHUNK,
  CH_D,
  CXN,
  CZN,
  D4,
  FOGS,
  LQ_BOG,
  LQ_DEEP,
  LQ_LAVA,
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
  SF_MUD,
  SF_OBSIDIAN,
  SF_RUBBLE,
  TC,
  TF,
  TP,
  TW,
  TX,
  VAULT_WALL_H,
  VEIN_COL,
} from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/** 階の霧の色と濃さ（層の霧の色、無ければ溶岩の海・深淵の色か、深さごとの色。階の暗さを掛ける。もとは src/game/18-level-player.js） */
export function setFog(): void {
  const k = level().prof.fogDark,
    f = (
      level().stratum.fog
        ? must(level().stratum.fog)
        : level().stratum.k === 'magma'
          ? [0.016, 0.004, 0.003]
          : level().stratum.k === 'abyss'
            ? [0.007, 0.003, 0.014]
            : nth(FOGS, (here.depth - 1) % FOGS.length)
    ).map((v) => v * k);
  fogCol.set(nth(f, 0), nth(f, 1), nth(f, 2));
  must(gfx.renderer).setClearColor(new T.Color(nth(f, 0), nth(f, 1), nth(f, 2)), 1);
  gfx.fogBase = 0.05 + Math.min(here.depth - 1, 6) * 0.002;
  must(gfx.U).uFogDen.value = gfx.fogBase;
}
/** 水面の絵を書き直す（水のマスごとに、深さ・流れ・湖か・藻と、上から届く2つの灯りの番号と重み。もとは src/game/06-world.js） */
export function updateWater(): void {
  const W2 = must(gfx.waterTex).image.data,
    L2 = must(gfx.waterLTex).image.data,
    oI = new Float32Array(3),
    oW = new Float32Array(3);
  for (let i = 0; i < NCELL; i++) {
    const lq = level().liquid[i],
      o = i * 4;
    W2[o] = W2[o + 1] = W2[o + 2] = W2[o + 3] = 0;
    L2[o] = L2[o + 1] = L2[o + 2] = L2[o + 3] = 0;
    if (lq !== LQ_WATER && lq !== LQ_DEEP) continue;
    const r = nth(level().roomOf, i) >= 0 ? nth(level().rooms, nth(level().roomOf, i)) : null,
      lake = (r && r.theme && r.theme.k === 'lake') || level().stratum.k === 'cavern';
    W2[o] = lq === LQ_DEEP ? 1 : 0.5;
    W2[o + 1] = level().flow[i] ? flowW(nth(level().flow, i)) : 0;
    W2[o + 2] = lake ? 1 : 0;
    W2[o + 3] = level().algae && level().algae[i] ? 1 : 0;
    topLights(level().lights, ((i % MW) + 0.5) * CELL, 0.1, (((i / MW) | 0) + 0.5) * CELL, 0, 1, 0, i, oI, oW, 0);
    L2[o] = nth(oI, 0) >= 0 ? nth(oI, 0) + 1 : 0;
    L2[o + 1] = nth(oW, 0);
    L2[o + 2] = nth(oI, 1) >= 0 ? nth(oI, 1) + 1 : 0;
    L2[o + 3] = nth(oW, 1);
  }
  must(gfx.waterTex).needsUpdate = true;
  must(gfx.waterLTex).needsUpdate = true;
}
/**
 * 像の形（石の人。buildForm）。像の種類 kind（'room'・'vault'・'colossus'）と階のシードとマス cell から作った、像ごとの見た目の乱数の並びで作る。
 * 像の点の位置は見た目の乱数によらない（よるのは文字と揺れの位相だけで、像はどちらも使わない。像の文字は迷宮の乱数で選ぶ）が、buildForm は見た目の乱数を引く。
 * こうすると、世界を組み立てる間に見た目の乱数 mr() を引かないので、その後の粒子などが、形の作り方や階の像の数でずれない（tests/determinism.mjs が __test.worldDraws で数える）
 */
const statueForm = (kind: string, cell: number) =>
  // oxlint-disable-next-line typescript/consistent-type-assertions -- 石像の形を選ぶだけの種類（大きさと色の欄は、人型の形を作る時に読まない。元の渡し方のまま）
  withVisualRand(keyedRand('statue ' + kind, levelSeed(), cell), () => buildForm({ ch: '&', form: 'humanoid' } as FormType));

// 文字1つの四角（three.js の PlaneGeometry(1, 1) と同じ頂点の位置・uv・三角形の並び）。
// 区切りの文字は、インスタンス（文字1つを1つのインスタンスにする描き方）にしない。頂点が4つしかないインスタンスを何万も描くと、
// CPU で描く SwiftShader（テストと CI）では文字1つごとに決まった手間がかかり、6倍ほど遅いため
const QUAD_POS = [-0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0],
  QUAD_UV = [0, 1, 1, 1, 0, 0, 1, 0],
  QUAD_IDX = [0, 2, 1, 2, 3, 1];
/** 文字ごとの値 src の from から size 個を、dst の a 番目の文字の4つの頂点に写す */
function toQuad(dst: Float32Array, a: number, size: number, src: Float32Array, from: number): void {
  // 範囲はここで1回だけ確かめ、中では nth を使わない（文字1つに9回呼ぶので、nth だと区切りに分ける時間が2割から3割長い）
  if (from + size > src.length) throw new RangeError(`文字ごとの値の ${from + size - 1} 番目が無い（長さ ${src.length}）`);
  const o = a * 4 * size;
  for (let i = 0; i < size; i++) {
    const v = src[from + i] ?? 0;
    dst[o + i] = v;
    dst[o + size + i] = v;
    dst[o + 2 * size + i] = v;
    dst[o + 3 * size + i] = v;
  }
}
/**
 * cnt 個の文字の四角を三角形にする、頂点の番号。16ビットの 65535 は、WebGL2 では線を切る印として読まれ、頂点の番号にならないので、
 * 一番大きい番号（頂点の数 - 1）が 65535 以上なら32ビットにする
 */
export function quadIndex(cnt: number): Uint16Array | Uint32Array {
  const idx = cnt * 4 > 65535 ? new Uint32Array(cnt * 6) : new Uint16Array(cnt * 6);
  for (let a = 0; a < cnt; a++) for (let v = 0; v < 6; v++) idx[a * 6 + v] = a * 4 + nth(QUAD_IDX, v);
  return idx;
}
/** 1つの階に置ける文字の数の上限 */
const GLYPH_CAP = 360000;
/** 文字を置く間の、文字ごとの値（置き方の行列・文字・色・光り・灯り・区切り・高さ）。cap は入る文字の数 */
interface GlyphWork {
  cap: number;
  M: Float32Array;
  GL: Float32Array;
  CO: Float32Array;
  EM: Float32Array;
  LI: Float32Array;
  LW: Float32Array;
  CK: Int16Array;
  PY: Float32Array;
}
const makeWork = (cap: number): GlyphWork => ({
  cap,
  M: new Float32Array(cap * 16),
  GL: new Float32Array(cap),
  CO: new Float32Array(cap * 3),
  EM: new Float32Array(cap * 4),
  LI: new Float32Array(cap * 3),
  LW: new Float32Array(cap * 3),
  CK: new Int16Array(cap),
  PY: new Float32Array(cap),
});
/** 入りきらなくなった時に、倍の大きさ（上限 GLYPH_CAP）にして、書いた n 個を写す */
function growWork(w: GlyphWork, n: number): GlyphWork {
  const g = makeWork(Math.min(GLYPH_CAP, w.cap * 2));
  g.M.set(w.M.subarray(0, n * 16));
  g.GL.set(w.GL.subarray(0, n));
  g.CO.set(w.CO.subarray(0, n * 3));
  g.EM.set(w.EM.subarray(0, n * 4));
  g.LI.set(w.LI.subarray(0, n * 3));
  g.LW.set(w.LW.subarray(0, n * 3));
  g.CK.set(w.CK.subarray(0, n));
  g.PY.set(w.PY.subarray(0, n));
  return g;
}
/**
 * 文字を置く間の作業用の配列。階を組み立てるたびには作らず、使い回す（上限の大きさで毎回作ると約46MB になり、0 で埋める時間とごみ集めで、
 * 階を移る時に止まる時間が長くなるため）。持ち続けるのは 13万字分（約17MB）の baseWork だけ。それより文字の多い階では、組み立ての間だけ
 * 倍の大きさに伸ばし（growWork）、組み立てが終わったら手放す（スマホのメモリを、大きい階の分まで持ち続けないため）。
 * 文字ごとの値は push が全部書き、読むのは書いた n 個だけなので、前の階の値が残っていても使わない
 */
const baseWork = makeWork(1 << 17);
let glyphWork = baseWork;
/** 次の組み立てだけ、作業用の配列を、入る文字の数 cap の物にする（単体テストで、伸ばす処理を通すため。level-cases.mjs） */
export function resetGlyphWork(cap: number): void {
  glyphWork = makeWork(cap);
}
/** GPU に送った後の、区切りの頂点の値の代わり（中身の無い配列） */
const SENT = new Float32Array(0);
/**
 * 区切りの頂点の値。GPU に送った後は、JS の側の配列を捨てる（頂点4つ分の値は大きいので、JS と GPU の両方に持つとメモリが倍になる。
 * three.js は、送った後は配列を読まない（型と数は送る前に覚える）。ゲームは描画が止まった時に作り直さないので、また送ることもない）
 */
function sentAttr(a: Float32Array | Uint16Array | Uint32Array, size: number) {
  const b = new T.BufferAttribute(a, size);
  b.onUpload(() => {
    b.array = SENT;
  });
  return b;
}
/**
 * 階の文字を組み立てる（壁の面・洞窟の岩肌と天井・床と液体・橋・茂み・結晶・大きな茸・部屋の仕掛け・宝物庫・柱）。文字は区切りごとに1つの
 * three.js の Mesh にまとめて場面に入れ（gfx.chunks）、壁の向こうを隠す板も作る（gfx.occMesh）。前の階の物は捨てる（もとは src/game/06-world.js）
 */
export function buildWorld(): void {
  for (const c of gfx.chunks) {
    must(gfx.scene).remove(c.mesh);
    c.mesh.geometry.dispose();
  }
  gfx.chunks = [];
  if (gfx.occMesh) {
    must(gfx.scene).remove(gfx.occMesh);
    gfx.occMesh.geometry.dispose();
  }
  const { tile, liquid, surface, roomOf, rooms, lights, ceil } = level();
  setNoiseSeed(level().noiseSeed);
  let { cap, M, GL, CO, EM, LI, LW, CK, PY } = glyphWork;
  let n = 0;
  const occ: number[] = [];
  const m4 = new T.Matrix4(),
    q = new T.Quaternion(),
    e = new T.Euler(0, 0, 0, 'YXZ'),
    p = new T.Vector3(),
    s = new T.Vector3();
  const push = (
    x: number,
    y: number,
    z: number,
    ex: number,
    ey: number,
    size: number,
    g: number,
    r: number,
    gg: number,
    b: number,
    emis: number,
    kind: number,
    ref: number,
    nx: number | null,
    ny: number,
    nz: number,
  ) => {
    if (n >= cap) {
      if (cap >= GLYPH_CAP) return;
      glyphWork = growWork(glyphWork, n);
      ({ cap, M, GL, CO, EM, LI, LW, CK, PY } = glyphWork);
    }
    e.set(ex, ey, 0, 'YXZ');
    q.setFromEuler(e);
    p.set(x, y, z);
    s.set(size, size, size);
    m4.compose(p, q, s);
    m4.toArray(M, n * 16);
    GL[n] = g;
    CO[n * 3] = r;
    CO[n * 3 + 1] = gg;
    CO[n * 3 + 2] = b;
    EM[n * 4] = emis;
    EM[n * 4 + 1] = rand();
    EM[n * 4 + 2] = kind;
    EM[n * 4 + 3] = 0;
    topLights(lights, x, y, z, nx, ny, nz, ref, LI, LW, n * 3);
    {
      const ci = cellOf(x, z),
        dm = ci >= 0 ? nth(level().darkMul, ci) : 1;
      if (dm < 1) {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- この要素はすぐ上の push で書いたので、いつもある（元の書き方のまま）
        (LW[n * 3] as number) *= dm;
        // oxlint-disable-next-line typescript/consistent-type-assertions -- この要素はすぐ上の push で書いたので、いつもある（元の書き方のまま）
        (LW[n * 3 + 1] as number) *= dm;
        // oxlint-disable-next-line typescript/consistent-type-assertions -- この要素はすぐ上の push で書いたので、いつもある（元の書き方のまま）
        (LW[n * 3 + 2] as number) *= dm;
        // oxlint-disable-next-line typescript/consistent-type-assertions -- この要素はすぐ上の push で書いたので、いつもある（元の書き方のまま）
        (EM[n * 4] as number) *= 0.3 + 0.7 * dm;
      }
    }
    CK[n] = clamp(Math.floor(x / (CELL * CHUNK)), 0, CXN - 1) + clamp(Math.floor(z / (CELL * CHUNK)), 0, CZN - 1) * CXN;
    PY[n] = y;
    n++;
  };
  const pushX = (
    x: number,
    y: number,
    z: number,
    size: number,
    g: number,
    c: readonly number[],
    emis: number,
    kind: number,
    ref: number,
  ) => {
    const yaw = rand() * Math.PI;
    push(x, y, z, 0, yaw, size, g, nth(c, 0), nth(c, 1), nth(c, 2), emis, kind, ref, null, 0, 0);
    push(x, y, z, 0, yaw + Math.PI / 2, size, g, nth(c, 0), nth(c, 1), nth(c, 2), emis, kind, ref, null, 0, 0);
  };
  const cellOf = (x: number, z: number): number => {
    const cx = Math.floor(x / CELL),
      cz = Math.floor(z / CELL);
    return cx < 0 || cz < 0 || cx >= MW || cz >= MH ? -1 : cz * MW + cx;
  };

  // masonry wall face for ordinary rooms and corridors (layered glyphs receding into the stone)
  const RG = '##==||[]HH#:=#|][',
    FGL = '##H=+#|#=#';
  let faceStyle: { wall: string; wcol: readonly number[] } | null = null,
    faceSkip: ((u: number, yc: number) => boolean) | null = null,
    faceVein = 0;
  const face = (
    pcx: number,
    pcz: number,
    yaw: number,
    nX: number,
    nZ: number,
    y0: number,
    y1: number,
    ref: number,
    tint: readonly number[],
    layers: number,
    occl: boolean,
    th: Theme | null,
  ) => {
    const ruinW = level().stratum.k === 'ruins',
      fortW = level().stratum.k === 'fortress',
      rmF = nth(roomOf, ref) >= 0 ? nth(rooms, nth(roomOf, ref)) : null;
    const tX = Math.cos(yaw),
      tZ = -Math.sin(yaw);
    const segs: [number, number, number, number, number][] = [];
    if (y0 < 0) segs.push([y0, Math.min(y1, 0), 0.62, 3, 0.66]);
    if (y1 > 0 && y0 < BASE_H) segs.push([Math.max(y0, 0), Math.min(y1, BASE_H), 0.4, 5, 0.44]);
    if (y1 > BASE_H) segs.push([Math.max(y0, BASE_H), y1, 0.66, 3, 0.7]);
    for (const [a, b, target, cols, size] of segs) {
      const len = b - a;
      if (len < 0.1) continue;
      const rows = Math.max(1, Math.round(len / target)),
        sp = len / rows;
      for (let row = 0; row < rows; row++) {
        const yc = a + (row + 0.5) * sp;
        const lyr = (ruinW || fortW) && (a >= BASE_H - 0.01 || !rmF) ? 1 : layers;
        for (let L = 0; L < lyr; L++) {
          const off = L % 2 ? (CELL / cols) * 0.5 : 0,
            sz = size * (1 - 0.15 * L),
            dim = 1 - 0.36 * L;
          for (let col = 0; col < cols; col++) {
            let u = (col + 0.5) * (CELL / cols) - CELL / 2 + off;
            if (u > CELL / 2) u -= CELL;
            if (faceSkip && faceSkip(u, yc)) continue;
            const dp = L === 0 ? rand() * 0.035 : -(L * 0.24 + rand() * 0.04),
              v = (0.75 + rand() * 0.45) * dim;
            let r = nth(tint, 0) * v,
              g = nth(tint, 1) * v,
              bb = nth(tint, 2) * v,
              emis = (0.03 + rand() * 0.035) * dim,
              kind = 0,
              ch = faceStyle
                ? nth(faceStyle.wall, Math.floor(rand() * faceStyle.wall.length))
                : ruinW
                  ? nth(RG, Math.floor(rand() * RG.length))
                  : fortW
                    ? nth(FGL, Math.floor(rand() * FGL.length))
                    : nth(WG, Math.floor(rand() * WG.length));
            if (yc < 0) {
              const kd = clamp(1 + yc / CH_D, 0.15, 1);
              r *= kd;
              g *= kd;
              bb *= kd;
            }
            if (L === 0 && rand() < (faceStyle ? 0.05 : ruinW ? 0.035 : 0.012)) {
              kind = 4;
              const c: Color = th ? th.col : [0.6, 0.45, 1.0];
              r = c[0];
              g = c[1];
              bb = c[2];
              emis = 0.5 + rand() * 0.6;
              ch = pick(RUNESET);
            }
            if (L === 0 && faceVein && kind !== 4 && rand() < 0.24) {
              const vc = lookup(VEIN_COL, faceVein);
              ch = faceVein === 1 ? '$' : '*';
              r = vc[0];
              g = vc[1];
              bb = vc[2];
              emis = 0.35 + rand() * 0.25;
              kind = 7;
            }
            push(pcx + tX * u + nX * dp, yc, pcz + tZ * u + nZ * dp, 0, yaw, sz, G(ch), r, g, bb, emis, kind, ref, nX, 0, nZ);
          }
        }
      }
    }
    if (ruinW && y1 > 2 && rand() < (rmF && rmF.rkind === 'garden' ? 0.55 : 0.16)) {
      const tX = Math.cos(yaw),
        tZ = -Math.sin(yaw),
        u = R(-0.8, 0.8),
        len = R(1.2, Math.min(4.2, y1 - 0.6)),
        glow = rmF && rmF.rkind === 'garden' && rand() < 0.5;
      for (let y = y1 - 0.2; y > y1 - len; y -= 0.3)
        push(
          pcx + tX * (u + Math.sin(y * 2) * 0.08) + nX * 0.07,
          y,
          pcz + tZ * (u + Math.sin(y * 2) * 0.08) + nZ * 0.07,
          0,
          yaw,
          0.34,
          G(pick([';', '{', '}', '(', ')', '~'])),
          glow ? 0.35 : 0.3,
          glow ? 1.0 : 0.8,
          glow ? 0.85 : 0.4,
          glow ? 0.28 : 0.05,
          5,
          ref,
          nX,
          0,
          nZ,
        );
    }
    if (occl) {
      const od = layers * 0.24 + 0.1,
        ocx = pcx - nX * od,
        ocz = pcz - nZ * od,
        hw = (CELL + 0.1) / 2;
      occ.push(
        ocx - tX * hw,
        y0,
        ocz - tZ * hw,
        ocx + tX * hw,
        y0,
        ocz + tZ * hw,
        ocx + tX * hw,
        y1,
        ocz + tZ * hw,
        ocx - tX * hw,
        y0,
        ocz - tZ * hw,
        ocx + tX * hw,
        y1,
        ocz + tZ * hw,
        ocx - tX * hw,
        y1,
        ocz - tZ * hw,
      );
    }
  };

  // ---- organic cavern surfaces: a smoothed distance field + 3D noise, sliced into contour lines
  const FR = 0.5,
    Y0 = 2.2;
  const rockN = (x: number, y: number, z: number): number => {
    const nn = 0.65 * vnoise(x * 0.5, y * 0.5, z * 0.5) + 0.35 * vnoise(x * 1.25 + 31.7, y * 1.25, z * 1.25);
    const t = sstep(1.4, 3.0, y);
    return (1 - t) * nn * 0.6 + t * (nn - 0.42) * 1.7;
  };
  rooms.forEach((r, ri) => {
    if (!r.cave) return;
    const tintOf = (t2: Theme): Color =>
      t2.k === 'magma' || t2.k === 'basalt' || t2.k === 'ashfield'
        ? [0.46, 0.3, 0.32]
        : [0.5 + t2.col[0] * 0.22, 0.47 + t2.col[1] * 0.22, 0.66 + t2.col[2] * 0.22];
    const th = must(r.theme),
      tint = tintOf(th),
      thR = th,
      tintR = tint;
    const gx0 = r.x - 2,
      gz0 = r.y - 2,
      ox = gx0 * CELL,
      oz = gz0 * CELL,
      fw = (r.w + 4) * 4,
      fh = (r.h + 4) * 4,
      NF = fw * fh;
    const sdf = (pred: (c: number) => boolean): { sd: Float32Array; mx: number } => {
      const open = new Uint8Array(NF),
        dO = new Float32Array(NF),
        dC = new Float32Array(NF);
      for (let j = 0; j < fh; j++)
        for (let i = 0; i < fw; i++) {
          const c = cellOf(ox + (i + 0.5) * FR, oz + (j + 0.5) * FR);
          const o = c >= 0 && pred(c) ? 1 : 0;
          const k = j * fw + i;
          open[k] = o;
          dO[k] = o ? 1e9 : 0;
          dC[k] = o ? 0 : 1e9;
        }
      const a = FR,
        b = FR * 1.4142;
      for (const arr of [dO, dC]) {
        for (let j = 0; j < fh; j++)
          for (let i = 0; i < fw; i++) {
            const k = j * fw + i;
            let v = nth(arr, k);
            if (i > 0) v = Math.min(v, nth(arr, k - 1) + a);
            if (j > 0) {
              v = Math.min(v, nth(arr, k - fw) + a);
              if (i > 0) v = Math.min(v, nth(arr, k - fw - 1) + b);
              if (i < fw - 1) v = Math.min(v, nth(arr, k - fw + 1) + b);
            }
            arr[k] = v;
          }
        for (let j = fh - 1; j >= 0; j--)
          for (let i = fw - 1; i >= 0; i--) {
            const k = j * fw + i;
            let v = nth(arr, k);
            if (i < fw - 1) v = Math.min(v, nth(arr, k + 1) + a);
            if (j < fh - 1) {
              v = Math.min(v, nth(arr, k + fw) + a);
              if (i < fw - 1) v = Math.min(v, nth(arr, k + fw + 1) + b);
              if (i > 0) v = Math.min(v, nth(arr, k + fw - 1) + b);
            }
            arr[k] = v;
          }
      }
      const sd0 = new Float32Array(NF);
      for (let k = 0; k < NF; k++) sd0[k] = open[k] ? nth(dO, k) - FR * 0.5 : -(nth(dC, k) - FR * 0.5);
      const sd = new Float32Array(NF);
      let mx = 0;
      for (let j = 0; j < fh; j++)
        for (let i = 0; i < fw; i++) {
          let acc = 0,
            c = 0;
          for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
              const ii = i + di,
                jj = j + dj;
              if (ii < 0 || jj < 0 || ii >= fw || jj >= fh) continue;
              acc += nth(sd0, jj * fw + ii);
              c++;
            }
          const v = acc / c;
          sd[j * fw + i] = v;
          if (v > mx) mx = v;
        }
      return { sd, mx };
    };
    const samp = (sd: Float32Array, x: number, z: number): number => {
      let fx = clamp((x - ox) / FR - 0.5, 0, fw - 1.001),
        fz = clamp((z - oz) / FR - 0.5, 0, fh - 1.001);
      const i = Math.floor(fx),
        j = Math.floor(fz),
        u = fx - i,
        v = fz - j,
        k = j * fw + i;
      return (nth(sd, k) * (1 - u) + nth(sd, k + 1) * u) * (1 - v) + (nth(sd, k + fw) * (1 - u) + nth(sd, k + fw + 1) * u) * v;
    };
    // contour slicing: emits glyphs along the iso-line of vf at each height
    const slice = (
      sd: Float32Array,
      vf: (sv: number, x: number, y: number, z: number) => number,
      ys: [number, number, number, number][],
      accept: (c: number) => unknown,
      style: (px: number, y: number, pz: number, nx: number, ny: number, nz: number, ref: number, size: number, layers: number) => void,
      qb?: (y: number) => number,
    ) => {
      const vals = new Float32Array(NF),
        h = 0.12;
      const V = (x: number, y: number, z: number): number => vf(samp(sd, x, z), x, y, z);
      for (const [y, sp, size, layers] of ys) {
        const gq = qb ? qb(y) : 0;
        for (let j = 0; j < fh; j++)
          for (let i = 0; i < fw; i++) {
            const k = j * fw + i;
            if (qb) {
              const b0 = nth(sd, k) - gq;
              if (b0 > 1.4 || b0 < -1.4) {
                vals[k] = b0;
                continue;
              }
            }
            const x = ox + (i + 0.5) * FR,
              z = oz + (j + 0.5) * FR;
            vals[k] = vf(nth(sd, k), x, y, z);
          }
        let acc = rand() * sp;
        for (let j = 0; j < fh - 1; j++)
          for (let i = 0; i < fw - 1; i++) {
            const k = j * fw + i,
              va = nth(vals, k),
              vb = nth(vals, k + 1),
              vc = nth(vals, k + fw + 1),
              vd = nth(vals, k + fw);
            const pts: number[] = [],
              x0 = ox + (i + 0.5) * FR,
              z0 = oz + (j + 0.5) * FR;
            const ed = (v1: number, v2: number, x1: number, z1: number, x2: number, z2: number) => {
              if (v1 > 0 !== v2 > 0) {
                const t = v1 / (v1 - v2);
                pts.push(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t);
              }
            };
            ed(va, vb, x0, z0, x0 + FR, z0);
            ed(vb, vc, x0 + FR, z0, x0 + FR, z0 + FR);
            ed(vd, vc, x0, z0 + FR, x0 + FR, z0 + FR);
            ed(va, vd, x0, z0, x0, z0 + FR);
            for (let s2 = 0; s2 + 3 < pts.length; s2 += 4) {
              const ax = nth(pts, s2),
                az = nth(pts, s2 + 1),
                bx = nth(pts, s2 + 2),
                bz = nth(pts, s2 + 3),
                len = Math.hypot(bx - ax, bz - az);
              acc += len;
              while (acc >= sp) {
                acc -= sp;
                const t = rand(),
                  px = ax + (bx - ax) * t,
                  pz = az + (bz - az) * t;
                let gx = V(px + h, y, pz) - V(px - h, y, pz),
                  gy = V(px, y + h, pz) - V(px, y - h, pz),
                  gz = V(px, y, pz + h) - V(px, y, pz - h);
                const gl = Math.hypot(gx, gy, gz);
                if (gl < 1e-5) continue;
                gx /= gl;
                gy /= gl;
                gz /= gl;
                const hl = Math.hypot(gx, gz) || 1;
                let ref = -1;
                for (const k2 of [0.6, 1.2, 2.0, 3.0]) {
                  const c = cellOf(px + (gx / hl) * k2, pz + (gz / hl) * k2);
                  if (c < 0) break;
                  if (accept(c)) {
                    ref = c;
                    break;
                  }
                  if (tile[c] !== TW) break;
                }
                if (ref < 0) continue;
                style(px, y, pz, gx, gy, gz, ref, size, layers);
              }
            }
          }
      }
    };
    const rockGlyph = (
      px: number,
      y: number,
      pz: number,
      nx: number,
      ny: number,
      nz: number,
      ref: number,
      size: number,
      layers: number,
      deep: boolean,
    ) => {
      const th = r.shell ? must(nth(rooms, nth(roomOf, ref)).theme) : thR,
        tint = r.shell ? tintOf(th) : tintR;
      const yaw = Math.atan2(nx, nz),
        pitch = -Math.asin(clamp(ny, -1, 1));
      for (let L = 0; L < layers; L++) {
        const d = L * 0.27,
          sz = size * (1 - 0.14 * L),
          dim = 1 - 0.33 * L;
        let v = (0.8 + rand() * 0.4) * dim;
        const rk = must(level().rock),
          bnd = 0.5 + 0.5 * Math.sin(y * 1.35 + vnoise(px * 0.15, y * 0.3, pz * 0.15) * 5);
        let c: readonly number[] = [
            (rk.a[0] * (1 - bnd) + rk.b[0] * bnd) * 0.55 + tint[0] * 0.45,
            (rk.a[1] * (1 - bnd) + rk.b[1] * bnd) * 0.55 + tint[1] * 0.45,
            (rk.a[2] * (1 - bnd) + rk.b[2] * bnd) * 0.55 + tint[2] * 0.45,
          ],
          emis = (0.025 + rand() * 0.03) * dim,
          kind = 8,
          g = G('#');
        const wcI = cellOf(px - nx * 0.6, pz - nz * 0.6),
          ve = wcI >= 0 ? nth(level().vein, wcI) : 0;
        if (L === 0) {
          const rr = rand();
          if (ve && rr < 0.32 && ny > -0.4) {
            kind = 7;
            c = lookup(VEIN_COL, ve);
            emis = R(0.35, 0.6);
            g = G(ve === 1 ? '$' : '*');
          } else if (ny < -0.5 && rr < (r.shell ? 0.17 : 0.07)) {
            kind = 2;
            c = r.shell
              ? pick([
                  [0.6, 0.55, 1.0],
                  [0.5, 0.9, 1.0],
                  [1.0, 0.82, 0.6],
                  [0.7, 1.0, 0.8],
                ])
              : [0.6, 0.55, 1.0];
            emis = R(0.4, 0.8);
            g = G(pick(['*', '+', '*']));
          } else if (th.k === 'fungal' && y < 1.6 && rr < 0.09) {
            kind = 7;
            c = th.col;
            emis = R(0.3, 0.6);
            g = G(pick(['"', ',', 'v']));
          } else if ((th.k === 'magma' || th.k === 'basalt' || th.k === 'ashfield') && y < 2.8 && rr < 0.09) {
            kind = 7;
            c = [1.0, 0.38, 0.08];
            emis = R(0.5, 1.1);
            g = G(pick(['~', '=', '-']));
          } else if (th.k === 'chasm' && deep && y < -2.5 && rr < 0.07) {
            kind = 7;
            c = [1.0, 0.42, 0.12];
            emis = R(0.5, 1.0);
            g = G(pick(['~', '=', '-']));
          } else if (rr < 0.012) {
            kind = 4;
            c = th.col;
            emis = R(0.4, 0.9);
            g = G(pick(RUNESET));
          }
        }
        if (deep) {
          const k = clamp(1 + y / CH_D, 0.15, 1);
          v *= k;
        }
        push(
          px - nx * d,
          y - ny * d,
          pz - nz * d,
          pitch,
          yaw,
          sz,
          g,
          nth(c, 0) * v,
          nth(c, 1) * v,
          nth(c, 2) * v,
          emis,
          kind,
          ref,
          nx,
          ny,
          nz,
        );
      }
    };
    // cavern walls and vault
    if (!r.noShell) {
      const C = sdf((c) => tile[c] !== TW),
        top =
          level().finalVault &&
          (level().rooms[nth(level().roomOf, level().stairs)] === r ||
            r.cells.includes(level().stairs) ||
            (r.cells0 && r.cells0.includes(level().stairs)))
            ? Math.max(th.base ?? NaN, 13)
            : th.base,
        dmx = Math.max(1.5, C.mx);
      const gD = (y: number): number => (y < Y0 ? 0 : dmx * Math.pow((y - Y0) / ((top ?? NaN) - Y0), 1.6));
      for (const i of r.shell ? must(r.cells0).filter((i) => tile[i] !== TW) : r.cells.concat(r.chasm)) {
        const sdc = samp(C.sd, ((i % MW) + 0.5) * CELL, (((i / MW) | 0) + 0.5) * CELL);
        ceil[i] = Y0 + ((top ?? NaN) - Y0) * Math.pow(clamp(sdc / dmx, 0, 1), 1 / 1.6);
      }
      const ys: [number, number, number, number][] = [];
      if (r.shell) {
        for (let y = 0.25; y < BASE_H; y += 0.5) ys.push([y, 0.5, 0.52, 2]);
        for (let y = 3.7; y < (top ?? NaN) + 0.4; y += 0.8) ys.push([y, 0.8, 0.82, 2]);
      } else {
        for (let y = 0.21; y < BASE_H; y += 0.42) ys.push([y, 0.42, 0.47, 3]);
        for (let y = 3.6; y < (top ?? NaN) + 0.4; y += 0.62) ys.push([y, 0.62, 0.68, 2]);
      }
      const acc = r.shell
        ? (c: number) => nth(roomOf, c) >= 0 && nth(rooms, nth(roomOf, c)).cave && tile[c] !== TW
        : (c: number) => roomOf[c] === ri && tile[c] !== TW;
      slice(
        C.sd,
        (sv, x, y, z) => sv + rockN(x, y, z) - gD(y),
        ys,
        acc,
        (px, y, pz, nx, ny, nz, ref, size, layers) => rockGlyph(px, y, pz, nx, ny, nz, ref, size, layers, false),
        gD,
      );
    }
    // chasm throat narrowing into the dark
    if (r.chasm.length && level().stratum.k !== 'abyss') {
      const Cc = sdf((c) => tile[c] === TC || level().bridge[c] === 1),
        dmc = Math.max(1, Cc.mx);
      const ysc: [number, number, number, number][] = [];
      for (let y = -0.3; y > -CH_D + 0.3; y -= 0.55) ysc.push([y, 0.52, 0.58, 2]);
      slice(
        Cc.sd,
        (sv, x, y, z) => {
          const nn = 0.65 * vnoise(x * 0.5, y * 0.5, z * 0.5) + 0.35 * vnoise(x * 1.25, y * 1.25 + 11, z * 1.25);
          const t = clamp(-y / 2, 0, 1);
          return sv - ((1 - t) * nn * 0.4 + t * (nn - 0.5) * 1.3) - dmc * 0.55 * Math.pow(-y / CH_D, 1.3);
        },
        ysc,
        (c) => (tile[c] === TC || level().bridge[c] === 1) && roomOf[c] === ri,
        (px, y, pz, nx, ny, nz, ref, size, layers) => rockGlyph(px, y, pz, nx, ny, nz, ref, size, layers, true),
      );
    }
  });

  // ---- per-cell content
  const FACES: [number, number, number][] = [
    [1, 0, -Math.PI / 2],
    [-1, 0, Math.PI / 2],
    [0, 1, Math.PI],
    [0, -1, 0],
  ];
  for (let cz = 0; cz < MH; cz++)
    for (let cx = 0; cx < MW; cx++) {
      const i = cz * MW + cx,
        ti = tile[i];
      if (ti !== TF && ti !== TC) continue;
      const ri = nth(roomOf, i),
        room = ri >= 0 ? nth(rooms, ri) : null,
        th = room
          ? room.theme
          : ti === TC
            ? // oxlint-disable-next-line typescript/consistent-type-assertions -- 部屋が見つからない時の空の物（元の読み方のまま。欄を読むための型だけ）
              (rooms.find((r) => r.theme) || ({} as { theme?: Theme | null })).theme || null
            : null,
        cave = !!(room && room.cave);
      const tint: Color =
        cave && (must(th).k === 'magma' || must(th).k === 'basalt' || must(th).k === 'ashfield')
          ? [0.46, 0.3, 0.32]
          : cave
            ? [0.5 + must(th).col[0] * 0.2, 0.48 + must(th).col[1] * 0.2, 0.66 + must(th).col[2] * 0.2]
            : th
              ? [0.6 + th.col[0] * 0.14, 0.6 + th.col[1] * 0.14, 0.78 + th.col[2] * 0.14]
              : [0.5, 0.53, 0.8];
      const c0 = nth(ceil, i);
      if (!cave) {
        for (let fi = 0; fi < 4; fi++) {
          const f = nth(FACES, fi);
          const ax = cx + f[0],
            az = cz + f[1],
            j = az * MW + ax;
          const nt = ax < 0 || az < 0 || ax >= MW || az >= MH ? TW : tile[j];
          const yaw = f[2],
            nX = -f[0],
            nZ = -f[1],
            pcx = (cx + 0.5 + f[0] * 0.5) * CELL,
            pcz = (cz + 0.5 + f[1] * 0.5) * CELL;
          if (nt === TW) {
            const vj = ax < 0 || az < 0 || ax >= MW || az >= MH ? 0 : nth(level().vaultCell, j);
            faceStyle = vj ? nth(VAULTS, vj - 1) : null;
            const top = vj && c0 >= 5 ? VAULT_WALL_H : c0,
              vt: readonly number[] = vj
                ? [nth(must(faceStyle).wcol, 0) * 0.85, nth(must(faceStyle).wcol, 1) * 0.85, nth(must(faceStyle).wcol, 2) * 0.85]
                : tint;
            let eg: Engraving | null | undefined = level().engr.get(i * 4 + fi);
            faceVein = level().vein[j] || 0;
            const tX = Math.cos(yaw),
              tZ = -Math.sin(yaw);
            if (eg && eg.skip) {
              const sa = lookup(ARTS, eg.art),
                sh = sa.length * 0.42,
                pOff = ((-(((eg.mi % MW) - cx) * tX + (((eg.mi / MW) | 0) - cz) * tZ) * CELL) / 2) * -1;
              faceSkip = (u, yc) => Math.abs(u - pOff) < 2.0 && yc > 1.95 - sh / 2 - 0.35 && yc < 1.95 + sh / 2 + 0.35;
              eg = null;
            }
            const art = eg && lookup(ARTS, eg.art),
              wide = !!(eg && eg.wide),
              sx = wide ? 0.5 : 0.27,
              sy = wide ? 0.42 : 0.3,
              gs = wide ? 0.48 : 0.33;
            const aH = art ? art.length * sy : 0,
              aY = wide ? 1.95 : 1.7,
              y0 = aY + aH / 2,
              cOff = wide ? (((((must(eg).pi ?? NaN) % MW) - cx) * tX + ((((must(eg).pi ?? NaN) / MW) | 0) - cz) * tZ) * CELL) / 2 : 0;
            if (art) faceSkip = (u, yc) => Math.abs(u - cOff) < (wide ? 2.0 : 1.1) && yc > aY - aH / 2 - 0.35 && yc < aY + aH / 2 + 0.35;
            face(pcx, pcz, yaw, nX, nZ, ti === TC ? -CH_D : 0, top, i, vt, 2, true, th);
            faceStyle = null;
            faceSkip = null;
            faceVein = 0;
            if (art) {
              for (let r2 = 0; r2 < art.length; r2++)
                for (let c2 = 0; c2 < 7; c2++) {
                  const ch = nth(nth(art, r2), c2);
                  if (ch === ' ') continue;
                  const u = cOff + (c2 - 3) * sx,
                    y = y0 - (r2 + 0.5) * sy;
                  push(pcx + tX * u + nX * 0.05, y, pcz + tZ * u + nZ * 0.05, 0, yaw, gs, G(ch), 1.0, 0.86, 0.6, 0.3, 7, i, nX, 0, nZ);
                }
              const fz = gs * 0.85;
              for (let c2 = -1; c2 <= 7; c2++)
                for (const y of [y0 + sy * 0.5, y0 - aH - sy * 0.5]) {
                  const u = cOff + (c2 - 3) * sx;
                  push(
                    pcx + tX * u + nX * 0.04,
                    y,
                    pcz + tZ * u + nZ * 0.04,
                    0,
                    yaw,
                    fz,
                    G(c2 === -1 || c2 === 7 ? '+' : '-'),
                    0.66,
                    0.55,
                    0.44,
                    0.06,
                    1,
                    i,
                    nX,
                    0,
                    nZ,
                  );
                }
              for (let r2 = 0; r2 < art.length; r2++)
                for (const c2 of [-1, 7]) {
                  const u = cOff + (c2 - 3) * sx;
                  push(
                    pcx + tX * u + nX * 0.04,
                    y0 - (r2 + 0.5) * sy,
                    pcz + tZ * u + nZ * 0.04,
                    0,
                    yaw,
                    fz,
                    G('|'),
                    0.66,
                    0.55,
                    0.44,
                    0.06,
                    1,
                    i,
                    nX,
                    0,
                    nZ,
                  );
                }
            }
            continue;
          }
          if (ti === TC && nt !== TC) {
            face(pcx, pcz, yaw, nX, nZ, -CH_D, 0, i, tint, 1, false, th);
            continue;
          }
          const nr = nth(roomOf, j);
          if (nr >= 0 && nth(rooms, nr).cave) continue;
          const c1 = nth(ceil, j);
          if (c1 < c0 - 0.01) face(pcx, pcz, yaw, nX, nZ, c1, c0, i, tint, 1, false, th);
        }
        const per = 2;
        for (let a = 0; a < per; a++)
          for (let bb = 0; bb < per; bb++) {
            if (rand() > 0.55) continue;
            const star = rand() < 0.08;
            push(
              (cx + (a + 0.5) / per) * CELL + R(-0.25, 0.25),
              c0 - 0.03,
              (cz + (bb + 0.5) / per) * CELL + R(-0.25, 0.25),
              Math.PI / 2,
              R(0, 6.28),
              star ? 0.42 : 0.5,
              G(star ? pick(['*', '+', '*', 'x']) : pick(['.', '.', '`', "'", '-', ':'])),
              0.55,
              0.5,
              0.95,
              star ? R(0.45, 0.85) : R(0.02, 0.07),
              2,
              i,
              0,
              -1,
              0,
            );
          }
      }
      const deepWater = () => {
        for (let a = 0; a < 2; a++)
          for (let bb = 0; bb < 2; bb++)
            push(
              (cx + (a + 0.5) / 2) * CELL + R(-0.3, 0.3),
              -0.7,
              (cz + (bb + 0.5) / 2) * CELL + R(-0.3, 0.3),
              -Math.PI / 2,
              R(0, 6.28),
              0.5,
              G(pick(['.', ':', '~'])),
              0.08,
              0.18,
              0.45,
              0.07,
              2,
              i,
              0,
              1,
              0,
            );
      };
      if (level().stratum.k === 'abyss' && ti === TF && !level().bridge[i]) {
        for (const f of FACES) {
          const ax = cx + f[0],
            az = cz + f[1];
          if (ax < 0 || az < 0 || ax >= MW || az >= MH || tile[az * MW + ax] !== TC || level().bridge[az * MW + ax]) continue;
          const dep = 1.6 + vnoise(ax * 0.7, 5.5, az * 0.7) * 4.2,
            pcx = (cx + 0.5 + f[0] * 0.5) * CELL,
            pcz = (cz + 0.5 + f[1] * 0.5) * CELL;
          faceStyle = { wall: '%&8#:o', wcol: tint };
          face(pcx, pcz, Math.atan2(f[0], f[1]), f[0], f[1], -dep, 0, i, tint, 1, false, th);
          faceStyle = null;
        }
      }
      if (ti === TC || level().bridge[i] === 1) {
        for (let a = 0; a < 2; a++)
          for (let bb = 0; bb < 2; bb++) {
            if (rand() < 0.35) continue;
            const c = must(th).col;
            push(
              (cx + (a + 0.5) / 2) * CELL + R(-0.3, 0.3),
              -CH_D + 0.05,
              (cz + (bb + 0.5) / 2) * CELL + R(-0.3, 0.3),
              -Math.PI / 2,
              R(0, 6.28),
              0.7,
              G(pick(['.', '*', ':', '~', "'"])),
              c[0],
              c[1] * 0.7,
              c[2] * 0.7,
              R(0.12, 0.3),
              2,
              i,
              0,
              1,
              0,
            );
          }
      }
      if (ti === TC) {
      } else if (level().bridge[i]) {
        const dir = level().bridgeDir[i],
          ax: [number, number] = dir === 0 ? [1, 0] : [0, 1],
          pr: [number, number] = dir === 0 ? [0, 1] : [1, 0],
          x0 = (cx + 0.5) * CELL,
          z0 = (cz + 0.5) * CELL,
          rope = level().bridge[i] === 1;
        const deckY = rope ? 0.02 : 0.22,
          wood: Color = [0.62, 0.42, 0.25],
          stoneC: Color = [0.6, 0.6, 0.76],
          dc2 = rope ? wood : stoneC;
        const nbW = (dx: number, dz: number): boolean => {
          const x = cx + dx,
            z = cz + dz;
          if (x < 0 || z < 0 || x >= MW || z >= MH) return false;
          const j = z * MW + x;
          return tile[j] === TF && (nth(level().bridge, j) > 0 || (liquid[j] !== LQ_DEEP && liquid[j] !== LQ_LAVA));
        };
        const sideOpen = (sd: number) => nbW(pr[0] * sd, pr[1] * sd),
          endOpen = (e: number) => nbW(ax[0] * e, ax[1] * e),
          junction = sideOpen(-1) || sideOpen(1);
        for (let k = 0; k < 6; k++)
          for (let w = -1; w <= 1; w++) {
            const u = ((k + 0.5) / 6) * CELL - CELL / 2,
              px = x0 + ax[0] * u + pr[0] * w * 0.42,
              pz = z0 + ax[1] * u + pr[1] * w * 0.42;
            push(
              px,
              deckY,
              pz,
              -Math.PI / 2,
              dir === 0 ? Math.PI / 2 : 0,
              0.46,
              G(rope ? '=' : pick(['#', '=', '#'])),
              dc2[0],
              dc2[1],
              dc2[2],
              0.04,
              rope ? 1 : 8,
              i,
              0,
              1,
              0,
            );
          }
        if (junction)
          for (let k = 0; k < 6; k++)
            for (const w of [-1, 1]) {
              if (!sideOpen(w)) continue;
              const u = ((k + 0.5) / 6) * CELL - CELL / 2;
              for (const q of [0.62, 0.9]) {
                const px = x0 + pr[0] * w * q + ax[0] * u * 0.5,
                  pz = z0 + pr[1] * w * q + ax[1] * u * 0.5;
                push(
                  px,
                  deckY,
                  pz,
                  -Math.PI / 2,
                  dir === 0 ? 0 : Math.PI / 2,
                  0.46,
                  G(rope ? '=' : '#'),
                  dc2[0],
                  dc2[1],
                  dc2[2],
                  0.04,
                  rope ? 1 : 8,
                  i,
                  0,
                  1,
                  0,
                );
              }
            }
        if (junction && rope)
          for (const e of [-1, 1]) {
            if (endOpen(e)) continue;
            const yawE = Math.atan2(ax[0] * e, ax[1] * e);
            for (let k = 0; k < 8; k++) {
              const f = (k + 0.5) / 8,
                v = f * CELL - CELL / 2,
                px = x0 + ax[0] * e * 0.8 + pr[0] * v,
                pz = z0 + ax[1] * e * 0.8 + pr[1] * v;
              push(
                px,
                0.95 - 0.12 * Math.sin(Math.PI * f),
                pz,
                0,
                yawE,
                0.24,
                G('~'),
                0.7,
                0.55,
                0.35,
                0.05,
                1,
                i,
                ax[0] * e,
                0,
                ax[1] * e,
              );
            }
          }
        for (const sd of [-1, 1]) {
          if (sideOpen(sd)) continue;
          const yawP = Math.atan2(pr[0] * sd, pr[1] * sd);
          if (rope) {
            for (let k = 0; k <= 2; k++) {
              const u = (k / 2) * CELL - CELL / 2,
                px = x0 + ax[0] * u + pr[0] * sd * 0.8,
                pz = z0 + ax[1] * u + pr[1] * sd * 0.8;
              for (let y = 0.15; y < 0.95; y += 0.25) pushX(px, y, pz, 0.24, G('|'), wood, 0.04, 1, i);
            }
            for (let k = 0; k < 8; k++) {
              const f = (k + 0.5) / 8,
                u = f * CELL - CELL / 2,
                px = x0 + ax[0] * u + pr[0] * sd * 0.8,
                pz = z0 + ax[1] * u + pr[1] * sd * 0.8;
              push(
                px,
                0.95 - 0.12 * Math.sin(Math.PI * f),
                pz,
                0,
                yawP,
                0.24,
                G('~'),
                0.7,
                0.55,
                0.35,
                0.05,
                1,
                i,
                pr[0] * sd,
                0,
                pr[1] * sd,
              );
            }
          } else {
            for (let k = 0; k < 5; k++) {
              const u = ((k + 0.5) / 5) * CELL - CELL / 2,
                px = x0 + ax[0] * u + pr[0] * sd * 0.85,
                pz = z0 + ax[1] * u + pr[1] * sd * 0.85;
              push(px, 0.12, pz, 0, yawP, 0.3, G('='), stoneC[0], stoneC[1], stoneC[2], 0.04, 8, i, pr[0] * sd, 0, pr[1] * sd);
            }
          }
        }
        if (!rope) deepWater();
      } else if (liquid[i] === LQ_DEEP) {
        deepWater();
      } else if (liquid[i] === LQ_BOG) {
        for (let a = 0; a < 3; a++)
          for (let bb = 0; bb < 3; bb++) {
            const v = 0.7 + rand() * 0.6;
            push(
              (cx + (a + 0.5) / 3) * CELL + R(-0.12, 0.12),
              0.04,
              (cz + (bb + 0.5) / 3) * CELL + R(-0.12, 0.12),
              -Math.PI / 2,
              R(0, 6.28),
              0.52,
              G(pick(['~', '~', ',', '.', '"'])),
              0.32 * v,
              0.36 * v,
              0.14 * v,
              0.035,
              3,
              i,
              0,
              1,
              0,
            );
          }
        if (rand() < 0.3)
          for (let k = 0; k < RI(2, 3); k++) {
            const sz = R(0.4, 0.65);
            push(
              (cx + R(0.1, 0.9)) * CELL,
              sz * 0.5,
              (cz + R(0.1, 0.9)) * CELL,
              0,
              R(0, 6.28),
              sz,
              G(pick(['|', '/', '\\', 'Y'])),
              0.45,
              0.38,
              0.22,
              0.03,
              5,
              i,
              null,
              0,
              0,
            );
          }
      } else if (liquid[i] === LQ_LAVA) {
        for (let a = 0; a < 5; a++)
          for (let bb = 0; bb < 5; bb++) {
            const crust = rand() < 0.1;
            push(
              (cx + (a + 0.5) / 5) * CELL + R(-0.06, 0.06),
              0.1,
              (cz + (bb + 0.5) / 5) * CELL + R(-0.06, 0.06),
              -Math.PI / 2,
              R(0, 6.28),
              crust ? 0.44 : 0.56,
              G(crust ? pick(['#', '%', 'o']) : '~'),
              1.0,
              0.32,
              0.06,
              1.0,
              10,
              i,
              0,
              1,
              0,
            );
            if (crust) EM[(n - 1) * 4 + 3] = 1;
          }
      } else if (surface[i] === SF_OBSIDIAN) {
        for (let a = 0; a < 3; a++)
          for (let bb = 0; bb < 3; bb++) {
            const crack = rand() < 0.28;
            push(
              (cx + (a + 0.5) / 3) * CELL + R(-0.15, 0.15),
              0.03,
              (cz + (bb + 0.5) / 3) * CELL + R(-0.15, 0.15),
              -Math.PI / 2,
              R(0, 6.28),
              0.5,
              G(crack ? pick(['~', '-', '=']) : pick(['#', '%', '=', ':'])),
              crack ? 1.0 : 0.3,
              crack ? 0.34 : 0.22,
              crack ? 0.08 : 0.26,
              crack ? R(0.35, 0.8) : 0.03,
              crack ? 7 : 9,
              i,
              0,
              1,
              0,
            );
          }
      } else if (liquid[i] === LQ_WATER) {
        const lake = th && (th.k === 'lake' || level().stratum.k === 'cavern'),
          // @ts-expect-error -- 古い JS のまま（使っていない。tools/same-code.mjs が同じ文と見るため）
          wc = lake ? [0.22, 0.72, 1.0] : [0.28, 0.62, 1.0];
        // @ts-expect-error -- 古い JS のまま（使っていない。tools/same-code.mjs が同じ文と見るため）
        const wn = level().stratum.flood ? 3 : 4,
          ws = level().stratum.flood ? 0.6 : 0.5;
        // the surface itself is drawn by the water plane
      } else if (surface[i] === SF_ICE) {
        const tn = level().thin[i];
        for (let a = 0; a < 3; a++)
          for (let bb = 0; bb < 3; bb++) {
            const v = (tn ? 0.6 : 0.8) + rand() * 0.4;
            push(
              (cx + (a + 0.5) / 3) * CELL + R(-0.08, 0.08),
              0.04,
              (cz + (bb + 0.5) / 3) * CELL + R(-0.08, 0.08),
              -Math.PI / 2,
              (Math.floor(rand() * 2) * Math.PI) / 2,
              0.56,
              G(tn ? pick(['/', '\\', '-', '=']) : pick(['=', '#', '-', '='])),
              0.62 * v,
              0.85 * v,
              1.0 * v,
              (tn ? 0.08 : 0.12) + rand() * 0.08,
              tn ? 1 : 11,
              i,
              0,
              1,
              0,
            );
          }
      } else if (cave) {
        // uneven rubble floor, shaded by the same density ramp
        for (let a = 0; a < 3; a++)
          for (let bb = 0; bb < 3; bb++) {
            const v = 0.7 + rand() * 0.5;
            push(
              (cx + (a + 0.5) / 3) * CELL + R(-0.18, 0.18),
              0.02 + rand() * 0.05,
              (cz + (bb + 0.5) / 3) * CELL + R(-0.18, 0.18),
              -Math.PI / 2 + R(-0.25, 0.25),
              R(0, 6.28),
              0.52,
              G('.'),
              tint[0] * 0.6 * v,
              tint[1] * 0.6 * v,
              tint[2] * 0.6 * v,
              0.03,
              9,
              i,
              0,
              1,
              0,
            );
          }
        if (level().dfield[i] === 1 && rand() < 0.35) {
          const x0 = (cx + R(0.2, 0.8)) * CELL,
            z0 = (cz + R(0.2, 0.8)) * CELL;
          for (let k = 0; k < RI(3, 6); k++)
            pushX(
              x0 + R(-0.3, 0.3),
              0.12 + k * 0.12,
              z0 + R(-0.3, 0.3),
              0.34 - k * 0.03,
              G(pick(['o', '0', 'O', '.'])),
              [tint[0] * 0.7, tint[1] * 0.7, tint[2] * 0.7],
              0.03,
              8,
              i,
            );
        }
      } else if (surface[i] === SF_RUBBLE && !liquid[i]) {
        for (let a = 0; a < 3; a++)
          for (let bb = 0; bb < 3; bb++) {
            const v = 0.7 + rand() * 0.5;
            push(
              (cx + (a + 0.5) / 3) * CELL + R(-0.15, 0.15),
              0.03,
              (cz + (bb + 0.5) / 3) * CELL + R(-0.15, 0.15),
              -Math.PI / 2,
              R(0, 6.28),
              0.5,
              G(pick([':', '.', ',', '%'])),
              tint[0] * 0.55 * v,
              tint[1] * 0.5 * v,
              tint[2] * 0.5 * v,
              0.03,
              9,
              i,
              0,
              1,
              0,
            );
          }
        for (let k = 0; k < RI(2, 4); k++) {
          const x0 = (cx + R(0.2, 0.8)) * CELL,
            z0 = (cz + R(0.2, 0.8)) * CELL;
          for (let h2 = 0; h2 < RI(1, 3); h2++)
            pushX(
              x0 + R(-0.15, 0.15),
              0.14 + h2 * 0.2,
              z0 + R(-0.15, 0.15),
              0.36 - h2 * 0.06,
              G(pick(['#', '%', 'o', '='])),
              [tint[0] * 0.75, tint[1] * 0.7, tint[2] * 0.72],
              0.03,
              8,
              i,
            );
        }
      } else if (level().decoCell.get(i) && must(level().decoCell.get(i)).k === 'carpet') {
      } else if (level().vaultCell[i] && !cave) {
        // mosaic floor: a fixed pattern marks vault ground as built, not natural
        const vs = nth(VAULTS, nth(level().vaultCell, i) - 1);
        for (let a = 0; a < 3; a++)
          for (let bb = 0; bb < 3; bb++) {
            const gx = cx * 3 + a,
              gz = cz * 3 + bb,
              ch = (gx + gz) % 2 ? '.' : gx % 3 === 1 && gz % 3 === 1 ? '*' : '+';
            push(
              (cx + (a + 0.5) / 3) * CELL,
              0.02,
              (cz + (bb + 0.5) / 3) * CELL,
              -Math.PI / 2,
              0,
              0.5,
              G(ch),
              nth(vs.wcol, 0) * 0.5,
              nth(vs.wcol, 1) * 0.5,
              nth(vs.wcol, 2) * 0.5,
              ch === '*' ? 0.14 : 0.05,
              1,
              i,
              0,
              1,
              0,
            );
          }
      } else {
        for (let a = 0; a < 3; a++)
          for (let bb = 0; bb < 3; bb++) {
            const r0 = rand(),
              ch = r0 < 0.62 ? '.' : r0 < 0.72 ? ',' : r0 < 0.8 ? '`' : r0 < 0.87 ? "'" : r0 < 0.94 ? ':' : '-',
              v = 0.7 + rand() * 0.5;
            push(
              (cx + (a + 0.5) / 3) * CELL + R(-0.12, 0.12),
              0.02,
              (cz + (bb + 0.5) / 3) * CELL + R(-0.12, 0.12),
              -Math.PI / 2,
              (Math.floor(rand() * 4) * Math.PI) / 2,
              0.5,
              G(ch),
              0.34 * v,
              0.35 * v,
              0.56 * v,
              0.025 + rand() * 0.035,
              1,
              i,
              0,
              1,
              0,
            );
          }
      }
      if (surface[i] === SF_DEAD) {
        for (let j = 0; j < RI(3, 5); j++) {
          const sz = R(0.3, 0.6);
          push(
            (cx + R(0.1, 0.9)) * CELL,
            sz * 0.5,
            (cz + R(0.1, 0.9)) * CELL,
            0,
            R(0, Math.PI * 2),
            sz,
            G(pick(['|', '/', '\\', ',', '"', 'Y'])),
            0.55,
            0.44,
            0.26,
            0.03,
            5,
            i,
            null,
            0,
            0,
          );
        }
      }
      if (surface[i] === SF_FOLIAGE || surface[i] === SF_FUNGFOR) {
        const fung = surface[i] === SF_FUNGFOR,
          gc: readonly number[] | null = fung
            ? pick([
                [0.45, 0.95, 1.0],
                [0.7, 0.55, 1.0],
                [0.5, 1.0, 0.7],
              ])
            : null;
        for (let k = 0; k < 4; k++) {
          const x0 = (cx + 0.15 + rand() * 0.7) * CELL,
            z0 = (cz + 0.15 + rand() * 0.7) * CELL,
            hgt = fung ? R(1.5, 2.4) : R(1.3, 2.0);
          for (let y = 0.2; y < hgt; y += 0.42) {
            const top = y + 0.42 >= hgt;
            const ch = fung ? (top ? pick(['^', 'n', '*']) : '|') : top ? pick(['"', 'Y', '*']) : pick(['|', '(', ')', '/', '\\']);
            const c = fung ? (top ? must(gc) : [0.55, 0.6, 0.62]) : top ? [0.55, 0.95, 0.45] : [0.35, 0.7, 0.3];
            pushX(x0, y, z0, top ? 0.32 : 0.28, G(ch), c, fung ? (top ? 0.45 : 0.05) : 0.03, 13, i);
          }
        }
      }
      if (level().glyph[i]) {
        for (let a = 0; a < 3; a++)
          for (let bb = 0; bb < 3; bb++) {
            const ch = (a + bb) % 2 ? 'o' : a === 1 && bb === 1 ? '*' : '+';
            push(
              (cx + (a + 0.5) / 3) * CELL,
              0.05,
              (cz + (bb + 0.5) / 3) * CELL,
              -Math.PI / 2,
              0,
              0.5,
              G(ch),
              1.0,
              0.9,
              0.6,
              0.32,
              7,
              i,
              0,
              1,
              0,
            );
          }
      }
      if (surface[i] === SF_BRIM) {
        for (let a = 0; a < 3; a++)
          for (let bb = 0; bb < 3; bb++) {
            const v = 0.8 + rand() * 0.4;
            push(
              (cx + (a + 0.5) / 3) * CELL + R(-0.1, 0.1),
              0.04,
              (cz + (bb + 0.5) / 3) * CELL + R(-0.1, 0.1),
              -Math.PI / 2,
              R(0, 6.28),
              0.5,
              G(pick(['*', '%', ':', '*'])),
              1.0 * v,
              0.82 * v,
              0.3 * v,
              0.1,
              1,
              i,
              0,
              1,
              0,
            );
          }
      }
      if (surface[i] === SF_MUD) {
        for (let a = 0; a < 3; a++)
          for (let bb = 0; bb < 3; bb++) {
            const v = 0.7 + rand() * 0.4;
            push(
              (cx + (a + 0.5) / 3) * CELL + R(-0.1, 0.1),
              0.03,
              (cz + (bb + 0.5) / 3) * CELL + R(-0.1, 0.1),
              -Math.PI / 2,
              0,
              0.55,
              G(pick(['~', '=', '.', '~'])),
              0.5 * v,
              0.36 * v,
              0.2 * v,
              0.02,
              1,
              i,
              0,
              1,
              0,
            );
          }
      }
      if (surface[i] === SF_HAY) {
        for (let k = 0; k < 7; k++) {
          const x0 = (cx + 0.1 + rand() * 0.8) * CELL,
            z0 = (cz + 0.1 + rand() * 0.8) * CELL;
          pushX(x0, 0.18, z0, 0.3, G(pick(['"', '/', '\\', ','])), [0.95, 0.8, 0.4], 0.04, 5, i);
        }
      }
      if (surface[i] === SF_GRASS || surface[i] === SF_LUMEN) {
        const glow = surface[i] === SF_LUMEN,
          c: Color = glow
            ? th && (th.k === 'emerald' || th.k === 'fungal' || th.k === 'lake')
              ? th.col
              : [0.4, 0.95, 0.85]
            : [0.35, 0.85, 0.5],
          k = RI(3, 6);
        for (let j = 0; j < k; j++) {
          const sz = R(0.28, 0.55);
          push(
            (cx + R(0.1, 0.9)) * CELL,
            sz * 0.5,
            (cz + R(0.1, 0.9)) * CELL,
            0,
            R(0, Math.PI * 2),
            sz,
            G(pick(['"', '"', ',', "'", ';', 'v', 'Y'])),
            c[0],
            c[1],
            c[2],
            glow ? R(0.2, 0.5) : R(0.03, 0.08),
            5,
            i,
            null,
            0,
            0,
          );
        }
      }
      if (cave && must(th).k !== 'cathedral' && c0 > 4.5 && rand() < 0.08) {
        const x0 = (cx + R(0.25, 0.75)) * CELL,
          z0 = (cz + R(0.25, 0.75)) * CELL,
          len = R(1.0, Math.min(4.2, c0 - 2.4)),
          rock: Color = [tint[0] * 0.9, tint[1] * 0.9, tint[2] * 0.9];
        for (let y = c0 + 0.2; y > c0 - len; y -= 0.3) {
          const f = (c0 - y) / len;
          pushX(x0, y, z0, 0.44 * (1 - f * 0.5), G('|'), rock, 0.03, 8, i);
        }
        pushX(x0, c0 - len - 0.1, z0, 0.24, G("'"), must(th).col, 0.7, 7, i);
      }
      if (cave && ti === TF && !liquid[i] && rand() < 0.03) {
        const x0 = (cx + R(0.25, 0.75)) * CELL,
          z0 = (cz + R(0.25, 0.75)) * CELL,
          len = R(0.6, 2.2),
          rock: Color = [tint[0] * 0.85, tint[1] * 0.85, tint[2] * 0.85];
        for (let y = 0.15; y < len; y += 0.28) {
          const f = y / len;
          pushX(x0, y, z0, 0.44 * (1 - f * 0.55), G('^'), rock, 0.03, 8, i);
        }
      }
    }
  // crystal formations: leaning prisms of glyphs that glow and refract
  for (let i = 0; i < NCELL; i++) {
    if (tile[i] !== TX) continue;
    const cx = i % MW,
      cz = (i / MW) | 0,
      ri = nth(roomOf, i),
      th = ri >= 0 ? nth(rooms, ri).theme : null;
    const col = level().xtalCol.get(i) || [0.6, 0.85, 1.0],
      top = Math.max(1.3, Math.min(nth(ceil, i) - 0.8, th && th.k === 'crystal' ? 6 : 3.2));
    for (let a = 0; a < 2; a++)
      for (let bb = 0; bb < 2; bb++)
        push(
          (cx + (a + 0.5) / 2) * CELL,
          0.03,
          (cz + (bb + 0.5) / 2) * CELL,
          -Math.PI / 2,
          R(0, 6.28),
          0.5,
          G(pick(['.', ':', '*'])),
          nth(col, 0) * 0.5,
          nth(col, 1) * 0.5,
          nth(col, 2) * 0.5,
          0.15,
          11,
          i,
          0,
          1,
          0,
        );
    for (let sN = RI(3, 5), sh = 0; sh < sN; sh++) {
      const bx = (cx + R(0.15, 0.85)) * CELL,
        bz = (cz + R(0.15, 0.85)) * CELL,
        H = R(1.0, top),
        lx = R(-0.4, 0.4),
        lz = R(-0.4, 0.4);
      for (let y = 0.12; y < H; y += 0.26) {
        const f = y / H,
          tip = y + 0.26 >= H;
        pushX(
          bx + lx * f,
          y,
          bz + lz * f,
          tip ? 0.3 : 0.38 * (1 - f * 0.4),
          G(tip ? '^' : pick(['|', '|', '!', ':', 'I'])),
          col,
          tip ? R(0.9, 1.4) : R(0.25, 0.55),
          11,
          i,
        );
      }
      pushX(bx - 0.14, 0.15, bz, 0.3, G('/'), col, 0.3, 11, i);
      pushX(bx + 0.14, 0.15, bz, 0.3, G('\\'), col, 0.3, 11, i);
    }
  }
  // giant mushrooms in the fungal forest
  rooms.forEach((r) => {
    for (const i of r.mush || []) {
      const gi = !!r.giant,
        S = gi ? R(1.8, 2.6) : 1;
      const x0 = ((i % MW) + 0.5) * CELL,
        z0 = (((i / MW) | 0) + 0.5) * CELL,
        H = gi ? R(4.5, Math.max(5, Math.min(11, nth(ceil, i) - 1.5))) : R(2.2, Math.max(2.4, Math.min(5, nth(ceil, i) - 1.2))),
        c = gi
          ? pick<readonly number[]>([must(r.theme).col, [0.45, 0.8, 1.0], [0.9, 0.6, 1.0]])
          : pick<readonly number[]>([must(r.theme).col, [0.3, 0.9, 1.0], [0.7, 1.0, 0.35]]);
      const stems: [number, number][] = gi
        ? [
            [0, 0],
            [0.22, 0],
            [-0.11, 0.19],
            [-0.11, -0.19],
          ]
        : [[0, 0]];
      for (const [sx, sz] of stems)
        for (let y = 0.2; y < H; y += 0.3)
          pushX(x0 + sx, y, z0 + sz, gi ? 0.42 : 0.36, G(pick(['|', 'I', '|', '!'])), [0.62, 0.78, 0.72], 0.05, 0, i);
      const ring = (rad: number, y: number, n: number, set: string[], em: [number, number]) => {
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + y,
            nx = Math.cos(a),
            nz = Math.sin(a);
          push(
            x0 + nx * rad,
            y,
            z0 + nz * rad,
            0,
            Math.atan2(nx, nz),
            0.42 * (gi ? 1.3 : 1),
            G(pick(set)),
            nth(c, 0),
            nth(c, 1),
            nth(c, 2),
            R(em[0], em[1]),
            7,
            i,
            nx,
            0,
            nz,
          );
        }
      };
      ring(0.95 * S, H - 0.05, Math.round(14 * S), ['^', 'n', '~', '*', 'n'], [0.45, 0.8]);
      ring(0.6 * S, H + 0.25 * S, Math.round(9 * S), ['^', 'n', '*'], [0.5, 0.9]);
      if (gi) ring(0.3 * S, H + 0.45 * S, 7, ['^', '*'], [0.6, 1.0]);
      for (let k = 0; k < Math.round(10 * S * S); k++) {
        const a = k * 2.399,
          rr = Math.sqrt((k + 0.5) / (10 * S * S)) * 0.9 * S;
        push(
          x0 + Math.cos(a) * rr,
          H - 0.12,
          z0 + Math.sin(a) * rr,
          Math.PI / 2,
          R(0, 6.28),
          0.32 * (gi ? 1.2 : 1),
          G(pick(['.', "'", '|', ':'])),
          nth(c, 0),
          nth(c, 1),
          nth(c, 2),
          R(0.3, 0.6),
          7,
          i,
          0,
          -1,
          0,
        );
      }
    }
  });
  // ---- Brogue-style "machines": small set pieces that tell a story
  rooms.forEach((r) => {
    const md = r.mdata;
    if (!md) return;
    const cxy = (i: number): [number, number] => [((i % MW) + 0.5) * CELL, (((i / MW) | 0) + 0.5) * CELL];
    const stone: Color = [0.62, 0.6, 0.78];
    if (md.type === 'camp') {
      const [fx, fz] = cxy(must(md.fire));
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        pushX(fx + Math.cos(a) * 0.45, 0.12, fz + Math.sin(a) * 0.45, 0.26, G(pick(['o', '0', 'o'])), stone, 0.03, 8, must(md.fire));
      }
      for (let k = 0; k < 6; k++)
        push(
          fx + R(-0.3, 0.3),
          0.03,
          fz + R(-0.3, 0.3),
          -Math.PI / 2,
          R(0, 6.28),
          0.3,
          G(pick(['.', ',', '`'])),
          0.5,
          0.32,
          0.2,
          0.15,
          7,
          must(md.fire),
          0,
          1,
          0,
        );
      for (const b of must(md.beds)) {
        const [bx, bz] = cxy(b),
          yaw = rand() < 0.5 ? 0 : Math.PI / 2,
          ca = Math.cos(yaw),
          sa = Math.sin(yaw);
        for (let u = 0; u < 4; u++)
          for (let v = 0; v < 2; v++) {
            const lx = (u - 1.5) * 0.32,
              lz = (v - 0.5) * 0.32;
            push(
              bx + lx * ca + lz * sa,
              0.05,
              bz - lx * sa + lz * ca,
              -Math.PI / 2,
              yaw,
              0.36,
              G(u === 0 ? '0' : pick(['=', '~', '='])),
              0.55,
              0.28,
              0.24,
              0.03,
              1,
              b,
              0,
              1,
              0,
            );
          }
      }
      for (const b of must(md.bones)) {
        const [bx, bz] = cxy(b);
        for (let k = 0; k < 5; k++)
          push(
            bx + R(-0.6, 0.6),
            0.04,
            bz + R(-0.6, 0.6),
            -Math.PI / 2,
            R(0, 6.28),
            0.34,
            G(pick(['%', ',', "'", '%', '-'])),
            0.85,
            0.82,
            0.7,
            0.05,
            1,
            b,
            0,
            1,
            0,
          );
        pushX(bx + R(-0.3, 0.3), 0.16, bz + R(-0.3, 0.3), 0.3, G('0'), [0.85, 0.82, 0.7], 0.06, 1, b);
      }
    } else if (md.type === 'altar') {
      const [ax, az] = cxy(must(md.altar));
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        push(
          ax + Math.cos(a) * 1.5,
          0.03,
          az + Math.sin(a) * 1.5,
          -Math.PI / 2,
          -a,
          0.36,
          G(pick(RUNESET)),
          1.0,
          0.8,
          0.4,
          0.6,
          4,
          must(md.altar),
          0,
          1,
          0,
        );
      }
      const W2 = 0.6,
        D2 = 0.38,
        H2 = 0.9;
      for (const [nx, nz, hw] of [
        [0, 1, W2],
        [0, -1, W2],
        [1, 0, D2],
        [-1, 0, D2],
      ] as const) {
        const yaw = Math.atan2(nx, nz),
          tX = Math.cos(yaw),
          tZ = -Math.sin(yaw),
          px = ax + nx * (nz ? D2 : W2),
          pz = az + nz * (nz ? D2 : W2);
        const cols = Math.max(2, Math.round((hw * 2) / 0.3));
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < cols; col++) {
            const u = (col + 0.5) * ((hw * 2) / cols) - hw;
            push(
              px + tX * u,
              0.15 + row * 0.3,
              pz + tZ * u,
              0,
              yaw,
              0.32,
              G(row === 2 ? '=' : '#'),
              stone[0],
              stone[1],
              stone[2],
              0.04,
              8,
              must(md.altar),
              nx,
              0,
              nz,
            );
          }
      }
      for (let u = 0; u < 4; u++)
        for (let v = 0; v < 3; v++)
          push(
            ax + (u - 1.5) * 0.3,
            H2,
            az + (v - 1) * 0.24,
            -Math.PI / 2,
            0,
            0.3,
            G('='),
            stone[0],
            stone[1],
            stone[2],
            0.05,
            8,
            must(md.altar),
            0,
            1,
            0,
          );
    } else if (md.type === 'library') {
      for (const sh of must(md.shelves)) {
        const [sx, sz] = cxy(sh.i),
          nx = -sh.dx,
          nz = -sh.dz,
          yaw = Math.atan2(nx, nz),
          tX = Math.cos(yaw),
          tZ = -Math.sin(yaw);
        const bx = sx + sh.dx * 0.62,
          bz = sz + sh.dz * 0.62;
        for (let row = 0; row < 8; row++)
          for (let col = 0; col < 6; col++) {
            const u = (col + 0.5) * (1.9 / 6) - 0.95,
              y = 0.18 + row * 0.34,
              shelf = row % 3 === 0;
            let ch = shelf ? '=' : pick(['[', ']', '|', 'I', '!', '[', ']']),
              c: readonly number[] = shelf
                ? [0.55, 0.38, 0.25]
                : pick([
                    [0.75, 0.3, 0.25],
                    [0.3, 0.45, 0.8],
                    [0.35, 0.65, 0.4],
                    [0.7, 0.55, 0.3],
                    [0.55, 0.35, 0.65],
                  ]),
              em = 0.035,
              kind = 1;
            if (!shelf && rand() < 0.05) {
              ch = '?';
              c = [0.75, 0.6, 1.0];
              em = 0.7;
              kind = 7;
            }
            push(bx + tX * u, y, bz + tZ * u, 0, yaw, 0.34, G(ch), nth(c, 0), nth(c, 1), nth(c, 2), em, kind, sh.i, nx, 0, nz);
          }
      }
      for (const i of must(md.pages)) {
        const [px, pz] = cxy(i);
        push(
          px + R(-0.7, 0.7),
          0.03,
          pz + R(-0.7, 0.7),
          -Math.PI / 2,
          R(0, 6.28),
          0.3,
          G(pick(['?', '=', '~'])),
          0.8,
          0.75,
          0.95,
          0.12,
          1,
          i,
          0,
          1,
          0,
        );
      }
    } else if (md.type === 'crypt') {
      for (const tb of must(md.tombs)) {
        const [tx, tz] = cxy(tb.i),
          yaw = tb.yaw,
          tX = Math.cos(yaw),
          tZ = -Math.sin(yaw),
          nx = Math.sin(yaw),
          nz = Math.cos(yaw);
        const rows = [
          ['.', '-', '.'],
          ['|', 'R', '|'],
          ['|', 'I', '|'],
          ['|', 'P', '|'],
        ];
        rows.forEach((rw, ri2) =>
          rw.forEach((ch, ci) => {
            const u = (ci - 1) * 0.28,
              y = 1.25 - ri2 * 0.3;
            push(
              tx + tX * u,
              y,
              tz + tZ * u,
              0,
              yaw,
              0.34,
              G(ch),
              0.7,
              0.74,
              0.95,
              ci === 1 && ri2 > 0 ? 0.32 : 0.09,
              ci === 1 && ri2 > 0 ? 7 : 1,
              tb.i,
              nx,
              0,
              nz,
            );
          }),
        );
        for (let k = 0; k < 6; k++)
          push(
            tx + nx * R(0.3, 0.8) + tX * R(-0.3, 0.3),
            0.04,
            tz + nz * R(0.3, 0.8) + tZ * R(-0.3, 0.3),
            -Math.PI / 2,
            R(0, 6.28),
            0.3,
            G(pick(['~', '.', ',', 'o'])),
            0.45,
            0.48,
            0.62,
            0.04,
            1,
            tb.i,
            0,
            1,
            0,
          );
      }
    } else if (md.type === 'statues') {
      const form = statueForm('room', r.cells[0] ?? 0);
      for (const si of must(md.statues)) {
        const [sx, sz] = cxy(si),
          sc = 1.35;
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2,
            nx = Math.cos(a),
            nz = Math.sin(a);
          push(
            sx + nx * 0.5,
            0.12,
            sz + nz * 0.5,
            0,
            Math.atan2(nx, nz),
            0.3,
            G('='),
            stone[0],
            stone[1],
            stone[2],
            0.04,
            8,
            si,
            nx,
            0,
            nz,
          );
          push(
            sx + nx * 0.45,
            0.36,
            sz + nz * 0.45,
            0,
            Math.atan2(nx, nz),
            0.3,
            G('#'),
            stone[0],
            stone[1],
            stone[2],
            0.04,
            8,
            si,
            nx,
            0,
            nz,
          );
        }
        for (const pnt of form) {
          if (pnt.part === 'core') continue;
          pushX(sx + pnt.x * sc, 0.45 + pnt.y * sc, sz + pnt.z * sc, pnt.s * sc * 1.25, G(pick(['&', '#', '%', '&'])), stone, 0.07, 8, si);
        }
        pushX(sx, 0.45 + 1.52 * sc, sz, 0.5, G('&'), [0.7, 0.68, 0.9], 0.05, 8, si);
      }
    }
  });
  // roofs over houses in tall halls (the town): a ceiling inside, a roof outside
  for (let i = 0; i < NCELL; i++) {
    if (!level().vaultCell[i] || tile[i] === TW || (ceil[i] ?? NaN) < 5) continue;
    const vs = nth(VAULTS, nth(level().vaultCell, i) - 1);
    if (!vs.roof) continue;
    const cx = i % MW,
      cz = (i / MW) | 0;
    for (let a = 0; a < 2; a++)
      for (let bb = 0; bb < 2; bb++) {
        const x = (cx + (a + 0.5) / 2) * CELL,
          z = (cz + (bb + 0.5) / 2) * CELL;
        push(x, VAULT_WALL_H - 0.02, z, Math.PI / 2, 0, 0.6, G(pick(['.', ':', '='])), 0.5, 0.45, 0.42, 0.03, 8, i, 0, -1, 0);
        push(
          x,
          VAULT_WALL_H + 0.04,
          z,
          -Math.PI / 2,
          (a + bb) % 2 ? 0 : Math.PI / 2,
          0.62,
          G(pick(['=', '#', '='])),
          nth(vs.wcol, 0) * 0.6,
          nth(vs.wcol, 1) * 0.55,
          nth(vs.wcol, 2) * 0.5,
          0.04,
          8,
          i,
          0,
          1,
          0,
        );
      }
  }
  // fortress furniture: stone tables and anvils
  rooms.forEach((r) => {
    for (const i of r.tables || []) {
      const x0 = ((i % MW) + 0.5) * CELL,
        z0 = (((i / MW) | 0) + 0.5) * CELL,
        st: Color = [0.72, 0.6, 0.48];
      for (const [lx, lz] of [
        [-0.6, -0.6],
        [0.6, -0.6],
        [-0.6, 0.6],
        [0.6, 0.6],
      ] as const)
        for (let y = 0.15; y < 0.8; y += 0.25) pushX(x0 + lx, y, z0 + lz, 0.24, G('|'), st, 0.03, 8, i);
      for (let a = 0; a < 3; a++)
        for (let bb = 0; bb < 3; bb++)
          push(
            x0 + (a - 1) * 0.5,
            0.86,
            z0 + (bb - 1) * 0.5,
            -Math.PI / 2,
            0,
            0.52,
            G(a === 1 && bb === 1 ? 'o' : '='),
            st[0],
            st[1],
            st[2],
            0.04,
            8,
            i,
            0,
            1,
            0,
          );
    }
    for (const i of r.anvils || []) {
      const x0 = ((i % MW) + 0.5) * CELL,
        z0 = (((i / MW) | 0) + 0.5) * CELL,
        ir: Color = [0.55, 0.55, 0.62];
      pushX(x0, 0.2, z0, 0.4, G('#'), ir, 0.03, 8, i);
      pushX(x0, 0.48, z0, 0.34, G('I'), ir, 0.03, 8, i);
      pushX(x0, 0.74, z0, 0.5, G('T'), ir, 0.05, 8, i);
    }
  });
  // caps on low vault walls standing in tall halls, and vault carpets
  for (let i = 0; i < NCELL; i++) {
    if (tile[i] !== TW || !level().vaultCell[i]) continue;
    let ref = -1,
      hi = 0;
    for (const d of D4) {
      const j = i + nth(d, 0) + nth(d, 1) * MW;
      if (j >= 0 && j < NCELL && tile[j] !== TW) {
        if (nth(ceil, j) > hi) {
          hi = nth(ceil, j);
          ref = j;
        }
      }
    }
    if (ref < 0 || hi < 5) continue;
    const vs = nth(VAULTS, nth(level().vaultCell, i) - 1),
      cx = i % MW,
      cz = (i / MW) | 0;
    for (let a = 0; a < 3; a++)
      for (let bb = 0; bb < 3; bb++)
        push(
          (cx + (a + 0.5) / 3) * CELL,
          VAULT_WALL_H + 0.02,
          (cz + (bb + 0.5) / 3) * CELL,
          -Math.PI / 2,
          0,
          0.6,
          G(nth(vs.wall, (a + bb) % vs.wall.length)),
          nth(vs.wcol, 0) * 0.7,
          nth(vs.wcol, 1) * 0.7,
          nth(vs.wcol, 2) * 0.7,
          0.06,
          8,
          ref,
          0,
          1,
          0,
        );
  }
  rooms.forEach((r) => {
    const set = new Set(r.vcarpet || []);
    for (const i of r.vcarpet || []) {
      const x0 = ((i % MW) + 0.5) * CELL,
        z0 = (((i / MW) | 0) + 0.5) * CELL;
      for (let a = 0; a < 4; a++)
        for (let bb = 0; bb < 4; bb++) {
          const lx = ((a + 0.5) / 4) * CELL - CELL / 2,
            lz = ((bb + 0.5) / 4) * CELL - CELL / 2;
          const ex = (a === 0 && !set.has(i - 1)) || (a === 3 && !set.has(i + 1)),
            ez = (bb === 0 && !set.has(i - MW)) || (bb === 3 && !set.has(i + MW)),
            border = ex || ez;
          const ch = border ? '=' : (a + bb) % 2 ? '+' : '*',
            c: Color = border ? [1.0, 0.78, 0.35] : (a + bb) % 2 ? [0.85, 0.22, 0.3] : [0.55, 0.3, 0.85];
          push(x0 + lx, 0.03, z0 + lz, -Math.PI / 2, border && ez ? 0 : Math.PI / 2, 0.48, G(ch), c[0], c[1], c[2], 0.06, 1, i, 0, 1, 0);
        }
    }
  });
  // statues and altars drawn into vaults
  rooms.forEach((r) => {
    const stone: Color = [0.62, 0.6, 0.78];
    for (const si of r.vstat || []) {
      const sx = ((si % MW) + 0.5) * CELL,
        sz = (((si / MW) | 0) + 0.5) * CELL,
        sc = 1.35;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2,
          nx = Math.cos(a),
          nz = Math.sin(a);
        push(sx + nx * 0.5, 0.12, sz + nz * 0.5, 0, Math.atan2(nx, nz), 0.3, G('='), stone[0], stone[1], stone[2], 0.04, 8, si, nx, 0, nz);
        push(
          sx + nx * 0.45,
          0.36,
          sz + nz * 0.45,
          0,
          Math.atan2(nx, nz),
          0.3,
          G('#'),
          stone[0],
          stone[1],
          stone[2],
          0.04,
          8,
          si,
          nx,
          0,
          nz,
        );
      }
      for (const pnt of statueForm('vault', si)) {
        if (pnt.part === 'core') continue;
        pushX(sx + pnt.x * sc, 0.45 + pnt.y * sc, sz + pnt.z * sc, pnt.s * sc * 1.25, G(pick(['&', '#', '%', '&'])), stone, 0.07, 8, si);
      }
      pushX(sx, 0.45 + 1.52 * sc, sz, 0.5, G('&'), [0.7, 0.68, 0.9], 0.06, 8, si);
    }
    for (const ai of r.valtar || []) {
      const ax = ((ai % MW) + 0.5) * CELL,
        az = (((ai / MW) | 0) + 0.5) * CELL;
      for (let y = 0.15; y < 0.95; y += 0.28)
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2,
            nx = Math.cos(a),
            nz = Math.sin(a);
          push(
            ax + nx * 0.5,
            y,
            az + nz * 0.5,
            0,
            Math.atan2(nx, nz),
            0.32,
            G(y > 0.7 ? '=' : '#'),
            stone[0],
            stone[1],
            stone[2],
            0.05,
            8,
            ai,
            nx,
            0,
            nz,
          );
        }
      for (let u = 0; u < 3; u++)
        for (let w = 0; w < 3; w++)
          push(
            ax + (u - 1) * 0.3,
            0.95,
            az + (w - 1) * 0.3,
            -Math.PI / 2,
            0,
            0.3,
            G('='),
            stone[0],
            stone[1],
            stone[2],
            0.05,
            8,
            ai,
            0,
            1,
            0,
          );
    }
  });
  // the beast's lair: bones and old remains scattered around
  rooms.forEach((r) => {
    if (!r.lair) return;
    for (const i of r.cells.filter(() => rand() < 0.12)) {
      if (liquid[i]) continue;
      const x0 = ((i % MW) + 0.5) * CELL,
        z0 = (((i / MW) | 0) + 0.5) * CELL;
      for (let k = 0; k < 4; k++)
        push(
          x0 + R(-0.7, 0.7),
          0.04,
          z0 + R(-0.7, 0.7),
          -Math.PI / 2,
          R(0, 6.28),
          0.36,
          G(pick(['%', ',', "'", '-', '%'])),
          0.85,
          0.8,
          0.68,
          0.05,
          1,
          i,
          0,
          1,
          0,
        );
      if (rand() < 0.4) pushX(x0 + R(-0.4, 0.4), 0.18, z0 + R(-0.4, 0.4), 0.34, G('0'), [0.85, 0.8, 0.68], 0.05, 1, i);
    }
  });
  // colossi in ruined plazas
  rooms.forEach((r) => {
    if (r.colossus === undefined) return;
    const c = r.colossus,
      sx = ((c % MW) + 0.5) * CELL,
      sz = (((c / MW) | 0) + 0.5) * CELL,
      sc = Math.min(3.4, (nth(ceil, c) - 1.4) / 2.1),
      stone: Color = [0.66, 0.64, 0.8],
      col = must(r.theme).col;
    for (const [rad, y, ch] of [
      [1.5, 0.15, '#'],
      [1.35, 0.45, '='],
      [1.2, 0.75, '#'],
    ] as const)
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2,
          nx = Math.cos(a),
          nz = Math.sin(a);
        push(sx + nx * rad, y, sz + nz * rad, 0, Math.atan2(nx, nz), 0.36, G(ch), stone[0], stone[1], stone[2], 0.05, 8, c, nx, 0, nz);
      }
    for (const pnt of statueForm('colossus', c)) {
      if (pnt.part === 'core') continue;
      pushX(sx + pnt.x * sc, 0.9 + pnt.y * sc, sz + pnt.z * sc, pnt.s * sc * 1.25, G(pick(['&', '#', '%', '&', '='])), stone, 0.05, 8, c);
    }
    for (const ex of [-0.07, 0.07])
      push(sx + ex * sc, 0.9 + 1.56 * sc, sz + 0.17 * sc, 0, 0, 0.22 * sc, G('*'), col[0], col[1], col[2], 1.1, 7, c, 0, 0, 1);
  });
  // remnant carpets, dismal rooms, idyll ferns, bloodwort stalks, steam vents
  rooms.forEach((r) => {
    const md = r.mdata;
    if (!md) return;
    const cxy = (i: number): [number, number] => [((i % MW) + 0.5) * CELL, (((i / MW) | 0) + 0.5) * CELL];
    if (md.type === 'remnant') {
      const set = new Set(md.carpet);
      for (const i of must(md.carpet)) {
        const [x0, z0] = cxy(i);
        for (let a = 0; a < 4; a++)
          for (let bb = 0; bb < 4; bb++) {
            const lx = ((a + 0.5) / 4) * CELL - CELL / 2,
              lz = ((bb + 0.5) / 4) * CELL - CELL / 2;
            const edgeX = (a === 0 && !set.has(i - 1)) || (a === 3 && !set.has(i + 1)),
              edgeZ = (bb === 0 && !set.has(i - MW)) || (bb === 3 && !set.has(i + MW));
            const border = edgeX || edgeZ,
              ch = border ? '=' : (a + bb) % 2 ? '+' : '*',
              c: Color = border ? [1.0, 0.78, 0.35] : (a + bb) % 2 ? [0.85, 0.22, 0.3] : [0.55, 0.3, 0.85];
            push(
              x0 + lx,
              0.03,
              z0 + lz,
              -Math.PI / 2,
              border && edgeZ ? 0 : Math.PI / 2,
              0.48,
              G(ch),
              c[0],
              c[1],
              c[2],
              0.06,
              1,
              i,
              0,
              1,
              0,
            );
          }
      }
      const form = statueForm('room', r.cells[0] ?? 0),
        stone: Color = [0.62, 0.6, 0.78];
      for (const si of must(md.inert)) {
        const [sx, sz] = cxy(si);
        for (const pnt of form) {
          if (pnt.part === 'core') continue;
          pushX(sx + pnt.x * 1.3, 0.3 + pnt.y * 1.3, sz + pnt.z * 1.3, pnt.s * 1.6, G(pick(['&', '#', '%'])), stone, 0.06, 8, si);
        }
      }
    } else if (md.type === 'dismal') {
      for (const i of must(md.blood)) {
        const [x0, z0] = cxy(i);
        for (let k = 0; k < 7; k++)
          push(
            x0 + R(-0.6, 0.6),
            0.035,
            z0 + R(-0.6, 0.6),
            -Math.PI / 2,
            R(0, 6.28),
            R(0.35, 0.6),
            G(pick(['~', ',', '.', '~'])),
            0.55,
            0.05,
            0.07,
            0.04,
            1,
            i,
            0,
            1,
            0,
          );
      }
      for (const i of must(md.bones2)) {
        const [x0, z0] = cxy(i);
        for (let k = 0; k < 5; k++)
          push(
            x0 + R(-0.6, 0.6),
            0.04,
            z0 + R(-0.6, 0.6),
            -Math.PI / 2,
            R(0, 6.28),
            0.34,
            G(pick(['%', ',', "'", '-'])),
            0.85,
            0.82,
            0.7,
            0.05,
            1,
            i,
            0,
            1,
            0,
          );
        pushX(x0 + R(-0.3, 0.3), 0.16, z0 + R(-0.3, 0.3), 0.3, G('0'), [0.85, 0.82, 0.7], 0.06, 1, i);
      }
      for (const i of must(md.char)) {
        const [x0, z0] = cxy(i);
        for (let k = 0; k < 3; k++)
          pushX(x0 + R(-0.5, 0.5), 0.14 + k * 0.1, z0 + R(-0.5, 0.5), 0.3, G(pick(['o', '0', '.'])), [0.3, 0.28, 0.3], 0.02, 8, i);
      }
    } else if (md.type === 'bloodwort') {
      const [x0, z0] = cxy(must(md.plant));
      for (let y = 0.15; y < 1.4; y += 0.25)
        pushX(x0 + Math.sin(y * 3) * 0.06, y, z0, 0.3, G('|'), [0.35, 0.6, 0.3], 0.05, 1, must(md.plant));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2,
          h = 0.4 + k * 0.14;
        pushX(
          x0 + Math.cos(a) * 0.25,
          h,
          z0 + Math.sin(a) * 0.25,
          0.28,
          G(pick(['"', 'v', '~'])),
          [0.3, 0.65, 0.3],
          0.06,
          5,
          must(md.plant),
        );
      }
    }
  });
  // collapsing floors: cracks now, a hidden shaft (kind 12) revealed when the floor gives way
  rooms.forEach((r) => {
    const md = r.mdata;
    if (!md || md.type !== 'collapse') return;
    const pit = new Set(md.pit);
    for (const i of must(md.pit)) {
      const cx = i % MW,
        cz = (i / MW) | 0;
      for (let k = 0; k < 4; k++)
        push(
          (cx + R(0.15, 0.85)) * CELL,
          0.03,
          (cz + R(0.15, 0.85)) * CELL,
          -Math.PI / 2,
          R(0, 6.28),
          0.42,
          G(pick(['/', '\\', 'x', '-'])),
          1.0,
          0.55,
          0.25,
          R(0.12, 0.3),
          1,
          i,
          0,
          1,
          0,
        );
      for (const f of [
        [1, 0, -Math.PI / 2],
        [-1, 0, Math.PI / 2],
        [0, 1, Math.PI],
        [0, -1, 0],
      ] as const) {
        const j = (cz + f[1]) * MW + cx + f[0];
        if (pit.has(j)) continue;
        const yaw = f[2],
          nX = -f[0],
          nZ = -f[1],
          tX = Math.cos(yaw),
          tZ = -Math.sin(yaw),
          pcx = (cx + 0.5 + f[0] * 0.5) * CELL,
          pcz = (cz + 0.5 + f[1] * 0.5) * CELL;
        for (let y = -0.2; y > -6.2; y -= 0.42)
          for (let col = 0; col < 5; col++) {
            const u = (col + 0.5) * 0.4 - CELL / 2,
              k2 = clamp(1 + y / 7, 0.2, 1);
            push(
              pcx + tX * u,
              y,
              pcz + tZ * u,
              0,
              yaw,
              0.44,
              G(pick(['#', '%', '&', '8', ':'])),
              0.55 * k2,
              0.5 * k2,
              0.62 * k2,
              0.03,
              12,
              i,
              nX,
              0,
              nZ,
            );
          }
      }
      for (let a = 0; a < 2; a++)
        for (let bb = 0; bb < 2; bb++)
          push(
            (cx + (a + 0.5) / 2) * CELL,
            -6.2,
            (cz + (bb + 0.5) / 2) * CELL,
            -Math.PI / 2,
            R(0, 6.28),
            0.7,
            G(pick(['*', '.', '~'])),
            1.0,
            0.55,
            0.25,
            0.9,
            12,
            i,
            0,
            1,
            0,
          );
    }
  });
  // pillars (ordinary rooms)
  for (let i = 0; i < NCELL; i++) {
    if (tile[i] !== TP) continue;
    const x0 = ((i % MW) + 0.5) * CELL,
      z0 = (((i / MW) | 0) + 0.5) * CELL,
      SEG = 12,
      rr = 0.38,
      ph = level().vaultCell[i] && nth(ceil, i) >= 5 ? 4.4 : nth(ceil, i);
    for (let k = 0; k < SEG; k++) {
      const a0 = (k / SEG) * Math.PI * 2,
        a1 = ((k + 1) / SEG) * Math.PI * 2;
      const ax = x0 + Math.cos(a0) * rr,
        az = z0 + Math.sin(a0) * rr,
        bx = x0 + Math.cos(a1) * rr,
        bz = z0 + Math.sin(a1) * rr;
      occ.push(ax, 0, az, bx, 0, bz, bx, ph, bz, ax, 0, az, bx, ph, bz, ax, ph, az);
    }
    const ys2: [number, number][] = [];
    for (let y = 0.22; y < Math.min(ph, BASE_H); y += 0.31) ys2.push([y, 11]);
    for (let y = BASE_H + 0.1; y < ph - 0.2; y += 0.5) ys2.push([y, 8]);
    for (let row = 0; row < ys2.length; row++) {
      const [y, nk] = nth(ys2, row);
      for (let k = 0; k < nk; k++) {
        const a = (k / nk) * Math.PI * 2 + row * 0.29,
          nx = Math.cos(a),
          nz = Math.sin(a),
          v = 0.75 + rand() * 0.4;
        push(
          x0 + nx * 0.48,
          y,
          z0 + nz * 0.48,
          0,
          Math.atan2(nx, nz),
          0.36,
          G(pick(['|', '|', 'I', '!', 'l', '1', ':', '|'])),
          0.66 * v,
          0.64 * v,
          0.92 * v,
          0.035 + rand() * 0.03,
          6,
          i,
          nx,
          0,
          nz,
        );
      }
    }
    for (const yy of [0.1, ph - 0.12])
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2,
          nx = Math.cos(a),
          nz = Math.sin(a);
        push(x0 + nx * 0.62, yy, z0 + nz * 0.62, 0, Math.atan2(nx, nz), 0.34, G('='), 0.7, 0.66, 0.95, 0.06, 6, i, nx, 0, nz);
      }
  }
  // ---- split into spatial chunks so whole regions can be culled each frame
  const count = new Int32Array(CXN * CZN);
  // oxlint-disable-next-line typescript/consistent-type-assertions -- 区切りの番号は 0 から CXN*CZN-1 なので、要素はいつもある（元の数え方のまま）
  for (let k = 0; k < n; k++) (count[nth(CK, k)] as number)++;
  const order = new Int32Array(n),
    start = new Int32Array(CXN * CZN + 1);
  for (let c = 0; c < CXN * CZN; c++) start[c + 1] = nth(start, c) + nth(count, c);
  const fill = start.slice(0, CXN * CZN);
  // oxlint-disable-next-line typescript/consistent-type-assertions -- 区切りの番号は 0 から CXN*CZN-1 なので、要素はいつもある（元の数え方のまま）
  for (let k = 0; k < n; k++) order[(fill[nth(CK, k)] as number)++] = k;
  for (let c = 0; c < CXN * CZN; c++) {
    const cnt = count[c];
    if (!cnt) continue;
    // 文字1つは四角1枚（頂点4つ）。文字ごとの値（置き方の行列の列・文字・色など）は、4つの頂点に同じ値を写す
    const nv = cnt * 4,
      pos = new Float32Array(nv * 3),
      uv = new Float32Array(nv * 2),
      gl = new Float32Array(nv),
      co = new Float32Array(nv * 3),
      em = new Float32Array(nv * 4),
      li = new Float32Array(nv * 3),
      lw = new Float32Array(nv * 3),
      m0 = new Float32Array(nv * 3),
      m1 = new Float32Array(nv * 3),
      m2 = new Float32Array(nv * 3),
      m3 = new Float32Array(nv * 3),
      idx = quadIndex(cnt);
    let ymin = 1e9,
      ymax = -1e9;
    for (let a = 0; a < cnt; a++) {
      const k = nth(order, nth(start, c) + a);
      pos.set(QUAD_POS, a * 12);
      uv.set(QUAD_UV, a * 8);
      toQuad(gl, a, 1, GL, k);
      toQuad(co, a, 3, CO, k * 3);
      toQuad(em, a, 4, EM, k * 4);
      toQuad(li, a, 3, LI, k * 3);
      toQuad(lw, a, 3, LW, k * 3);
      toQuad(m0, a, 3, M, k * 16);
      toQuad(m1, a, 3, M, k * 16 + 4);
      toQuad(m2, a, 3, M, k * 16 + 8);
      toQuad(m3, a, 3, M, k * 16 + 12);
      if (nth(PY, k) < ymin) ymin = nth(PY, k);
      if (nth(PY, k) > ymax) ymax = nth(PY, k);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', sentAttr(pos, 3));
    geo.setAttribute('uv', sentAttr(uv, 2));
    geo.setAttribute('iGlyph', sentAttr(gl, 1));
    geo.setAttribute('iColor', sentAttr(co, 3));
    geo.setAttribute('iEmit', sentAttr(em, 4));
    geo.setAttribute('iLI', sentAttr(li, 3));
    geo.setAttribute('iLW', sentAttr(lw, 3));
    geo.setAttribute('iM0', sentAttr(m0, 3));
    geo.setAttribute('iM1', sentAttr(m1, 3));
    geo.setAttribute('iM2', sentAttr(m2, 3));
    geo.setAttribute('iM3', sentAttr(m3, 3));
    geo.setIndex(sentAttr(idx, 1));
    const mesh = new T.Mesh(geo, gfx.staticMat);
    mesh.frustumCulled = false;
    must(gfx.scene).add(mesh);
    const cxw = ((c % CXN) + 0.5) * CHUNK * CELL,
      czw = (((c / CXN) | 0) + 0.5) * CHUNK * CELL,
      cyw = (ymin + ymax) / 2;
    const rad = Math.hypot(CHUNK * CELL * 0.5 + 0.6, CHUNK * CELL * 0.5 + 0.6, (ymax - ymin) / 2 + 0.6);
    gfx.chunks.push({ mesh, count: cnt, sphere: new T.Sphere(new T.Vector3(cxw, cyw, czw), rad) });
  }
  const og = new T.BufferGeometry();
  og.setAttribute('position', new T.Float32BufferAttribute(occ, 3));
  gfx.occMesh = new T.Mesh(og, gfx.occMat);
  gfx.occMesh.renderOrder = -10;
  gfx.occMesh.frustumCulled = false;
  must(gfx.scene).add(gfx.occMesh);
  hudInfo.glyphCount = n;
  glyphWork = baseWork;
}
