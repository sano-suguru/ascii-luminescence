// 描画の土台の処理（もとは src/game/05-renderer.js・06-world.js）。
// 文字の絵の表を作る buildAtlas、置いた文字の数を描画に渡す flushDyn、水面を作る makeWater、見える区切りだけを描く cullChunks。
// 描画の部品そのもの（描画する部品・後処理・置いた文字の形と属性）は、05-renderer.js が作って gfx に入れる。
import { must, nth } from './array.ts';
import { RUNE_CHARS } from './glyphs.ts';
import { RUNE_FONT } from './runes.ts';
import { WATER_FS, WATER_VS } from './shaders.ts';
import { buf, gfx, hudInfo } from './state.ts';
import { T } from './three.ts';
import { CELL, MH, MW, NCELL } from './world.ts';

// ---------------------------------------------------------------- glyph atlas
/** 文字の絵の表（16×7 の枡。1 から 6 段目は ASCII、7 段目はルーンの文字） */
export function buildAtlas(): InstanceType<typeof T.CanvasTexture> {
  const AC = 128,
    c = document.createElement('canvas');
  c.width = 16 * AC;
  c.height = 7 * AC;
  const x = must(c.getContext('2d'), '文字の絵の表の描き手');
  x.fillStyle = '#fff';
  x.strokeStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `800 ${Math.round(AC * 0.74)}px "JetBrains Mono","DejaVu Sans Mono",Menlo,Consolas,monospace`;
  x.lineWidth = AC * 0.03;
  x.lineJoin = 'round';
  for (let i = 1; i < 95; i++) {
    const ch = String.fromCharCode(32 + i),
      cx = ((i % 16) + 0.5) * AC,
      cy = (Math.floor(i / 16) + 0.5) * AC + AC * 0.03;
    x.fillText(ch, cx, cy);
    x.strokeText(ch, cx, cy);
  }
  x.font = `500 ${Math.round(AC * 0.8)}px ${RUNE_FONT}`;
  x.lineWidth = AC * 0.035;
  for (let k = 0; k < RUNE_CHARS.length; k++) {
    const cx = (k + 0.5) * AC,
      cy = 6.5 * AC + AC * 0.02;
    x.fillText(nth(RUNE_CHARS, k), cx, cy);
    x.strokeText(nth(RUNE_CHARS, k), cx, cy);
  }
  const tex = new T.CanvasTexture(c);
  tex.generateMipmaps = true;
  tex.minFilter = T.LinearMipmapLinearFilter;
  tex.magFilter = T.LinearFilter;
  tex.anisotropy = Math.min(8, must(gfx.renderer, '描画する部品').capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- dynamic glyph billboards
/** 置いた文字の数（buf.dn）を、描く形と属性に渡す */
export function flushDyn(): void {
  must(gfx.dynGeo, '置いた文字の形').instanceCount = buf.dn;
  for (const [a, s] of [
    [must(gfx.aPos, '置いた文字の位置'), 3],
    [must(gfx.aCol, '置いた文字の色'), 3],
    [must(gfx.aPar, '置いた文字の大きさなど'), 4],
  ] as const) {
    a.updateRange.offset = 0;
    a.updateRange.count = Math.max(1, buf.dn * s);
    a.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- water
/** 水面を作って場面に足す（水面の絵 gfx.waterTex・gfx.waterLTex も作る） */
export function makeWater(): void {
  gfx.waterTex = new T.DataTexture(new Float32Array(NCELL * 4), MW, MH, T.RGBAFormat, T.FloatType);
  gfx.waterTex.magFilter = gfx.waterTex.minFilter = T.NearestFilter;
  gfx.waterLTex = new T.DataTexture(new Float32Array(NCELL * 4), MW, MH, T.RGBAFormat, T.FloatType);
  gfx.waterLTex.magFilter = gfx.waterLTex.minFilter = T.NearestFilter;
  const mat = new T.ShaderMaterial({
    uniforms: {
      uAtlas: must(gfx.U, '分け合う値').uAtlas,
      uTime: must(gfx.U, '分け合う値').uTime,
      uSL: must(gfx.U, '分け合う値').uSL,
      uDLP: must(gfx.U, '分け合う値').uDLP,
      uDLC: must(gfx.U, '分け合う値').uDLC,
      uFogDen: must(gfx.U, '分け合う値').uFogDen,
      uFogColor: must(gfx.U, '分け合う値').uFogColor,
      uWater: { value: gfx.waterTex },
      uWaterL: { value: gfx.waterLTex },
    },
    vertexShader: WATER_VS,
    fragmentShader: WATER_FS,
    side: T.DoubleSide,
    alphaToCoverage: true,
    extensions: { derivatives: true },
  });
  const geo = new T.PlaneGeometry(MW * CELL, MH * CELL);
  geo.rotateX(-Math.PI / 2);
  gfx.waterMesh = new T.Mesh(geo, mat);
  gfx.waterMesh.position.set((MW * CELL) / 2, 0.06, (MH * CELL) / 2);
  gfx.waterMesh.frustumCulled = false;
  must(gfx.scene, '場面').add(gfx.waterMesh);
}

// ---------------------------------------------------------------- culling
// 視野の錐体と、それを作る行列（作る時に乱数を引かない物なので、ここで作る）
const _frus = new T.Frustum(),
  _pm = new T.Matrix4();
/** 区切りごとの文字を、霧で見えなくなる距離より近く、視野の中にある物だけ描く（描いた文字の数を hudInfo.chunksDrawn に数える） */
export function cullChunks(): void {
  gfx.camera.updateMatrixWorld();
  _pm.multiplyMatrices(gfx.camera.projectionMatrix, gfx.camera.matrixWorldInverse);
  _frus.setFromProjectionMatrix(_pm);
  const maxD = 2.4 / must(gfx.U, '分け合う値').uFogDen.value;
  hudInfo.chunksDrawn = 0;
  for (const c of gfx.chunks) {
    const d = c.sphere.center.distanceTo(gfx.camera.position) - c.sphere.radius;
    c.mesh.visible = d < maxD && _frus.intersectsSphere(c.sphere);
    if (c.mesh.visible) hudInfo.chunksDrawn += c.count;
  }
}
