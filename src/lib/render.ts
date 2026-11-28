// 描画の土台の処理。
// 文字の絵の表を作る buildAtlas、置いた文字の数を描画に渡す flushDyn、水面を作る makeWater、見える区切りだけを描く cullChunks。
// 描画の部品そのもの（描く画面・描画する部品・場面・カメラ・後処理・置いた文字と粒子の形と属性）を作って gfx に入れる initRenderer。
import { must, nth } from './array.ts';
import { RAMP_CH, RUNE_CHARS } from './glyphs.ts';
import { dCol, dPar, dPos, ptCol, ptGly, ptPos, ptSize } from './particles.ts';
import { RUNE_FONT } from './runes.ts';
import { WATER_FS, WATER_VS } from './shaders.ts';
import { buf, cellData, DLC, DLP, gfx, hudInfo, SL, ui } from './state.ts';
import { fogCol, T } from './three.ts';
import type { Camera } from 'three';
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

/**
 * 描画の部品を作る（描く画面・描画する部品・場面・カメラ・後処理と光のにじみ・マスの絵・分け合う値・置いた文字と粒子の形）。どれも作る時に乱数を引くので、
 * テスト用モードの入れ替えの後に呼ぶ。WebGL を作れなかった時は、わけを出して false を返す（呼ぶ所が、ゲームの用意をそこでやめる）
 */
export function initRenderer(): boolean {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- 描く画面 #gl は index.html の canvas
  gfx.canvas = document.getElementById('gl') as HTMLCanvasElement | null;
  try {
    gfx.renderer = new T.WebGLRenderer({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- 上で入れた #gl（元の読み方のまま）
      canvas: gfx.canvas as HTMLCanvasElement,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
  } catch (e) {
    must(ui.errEl, 'エラーを出す所 #err').textContent =
      'WebG Lを初期化できませんでした。ハードウェアアクセラレーションを有効にしてください。'.replace('WebG L', 'WebGL');
    return false;
  }
  const isGL2 = gfx.renderer.capabilities.isWebGL2;
  gfx.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  gfx.renderer.setPixelRatio(gfx.pixelRatio);
  gfx.renderer.setSize(window.innerWidth, window.innerHeight, false);
  gfx.scene = new T.Scene();
  gfx.camera = new T.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 110);
  gfx.camera.rotation.order = 'YXZ';
  gfx.renderer.setClearColor(new T.Color(fogCol.x, fogCol.y, fogCol.z), 1);

  const rt = new T.WebGLRenderTarget(window.innerWidth * gfx.pixelRatio, window.innerHeight * gfx.pixelRatio, {
    type: T.HalfFloatType,
    samples: isGL2 ? 4 : 0,
  });
  gfx.composer = new T.EffectComposer(gfx.renderer, rt);
  gfx.composer.setPixelRatio(gfx.pixelRatio);
  gfx.composer.setSize(window.innerWidth, window.innerHeight);
  // oxlint-disable-next-line typescript/consistent-type-assertions -- gfx.camera の TS の側の型は、TS が使う欄だけ（上で three.js のカメラを入れた）
  gfx.composer.addPass(new T.RenderPass(gfx.scene, gfx.camera as unknown as Camera));
  gfx.bloom = new T.UnrealBloomPass(new T.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.55, 0.76);
  [gfx.bloom.renderTargetBright, ...gfx.bloom.renderTargetsHorizontal, ...gfx.bloom.renderTargetsVertical].forEach((t) => {
    if (t) t.texture.type = T.HalfFloatType;
  });
  gfx.composer.addPass(gfx.bloom);
  const FinalShader = {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uRes: { value: new T.Vector2(1, 1) },
      uExposure: { value: 1.1 },
      uFade: { value: 1 },
      uHeat: { value: 0 },
      uSwim: { value: 0 },
      uHurt: { value: 0 },
      uSlow: { value: 0 },
      uTint: { value: new T.Vector3(1, 1, 1) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uExposure; uniform float uFade; uniform float uHeat; uniform float uSwim; uniform float uHurt; uniform float uSlow; uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
    void main(){
      vec2 uv0=vUv+vec2((sin(vUv.y*90.0+uTime*5.0)+sin(vUv.y*53.0-uTime*3.7))*0.0011*uHeat*(1.0-vUv.y),0.0);
      uv0.x+=sin(vUv.y*38.0+uTime*2.2)*0.0016*uSwim;
      vec2 c=uv0-0.5; float r2=dot(c,c);
      vec2 off=c*(0.0008+r2*0.0045);
      vec3 col=vec3(texture2D(tDiffuse,uv0+off).r,texture2D(tDiffuse,uv0).g,texture2D(tDiffuse,uv0-off).b);
      col*=uExposure;
      col=aces(col);
      col=mix(col,col*vec3(0.5,0.75,1.0)+vec3(0.0,0.015,0.04),uSwim*(0.25+0.6*smoothstep(0.6,0.3,vUv.y)));
      col=pow(col,vec3(0.4545));
      col+=vec3(0.010,0.005,0.026)*(1.0-col);
      float lum=dot(col,vec3(0.299,0.587,0.114)); col=mix(col,vec3(lum)*vec3(0.9,0.94,1.06),0.32*uSlow);
      col+=uTint*0.09*uSlow*smoothstep(0.08,0.5,r2);
      float vig=1.0-smoothstep(0.16,0.75,r2*1.3);
      col*=mix(0.32-0.12*uSlow,1.0,vig);
      col+=(hash(vUv*uRes+fract(uTime*7.31)*91.7)-0.5)*0.022;
      col=mix(col,col*vec3(1.0,0.35,0.3)+vec3(0.18,0.0,0.0),clamp(uHurt,0.0,1.0)*(0.25+0.75*smoothstep(0.05,0.45,r2)));
      gl_FragColor=vec4(col*uFade,1.0);
    }`,
  };
  gfx.finalPass = new T.ShaderPass(FinalShader);
  gfx.composer.addPass(gfx.finalPass);

  // ---------------------------------------------------------------- shared uniforms
  gfx.cellTex = new T.DataTexture(cellData, MW, MH, T.RGBAFormat, T.UnsignedByteType);
  // oxlint-disable-next-line typescript/consistent-type-assertions -- gfx.cellTex の TS の側の型は、TS が使う欄だけ（上で three.js の絵を入れた）
  (gfx.cellTex as InstanceType<typeof T.DataTexture>).magFilter = T.LinearFilter;
  // oxlint-disable-next-line typescript/consistent-type-assertions -- gfx.cellTex の TS の側の型は、TS が使う欄だけ（上で three.js の絵を入れた）
  (gfx.cellTex as InstanceType<typeof T.DataTexture>).minFilter = T.LinearFilter;
  gfx.cellTex.needsUpdate = true;
  gfx.U = {
    uCell: { value: gfx.cellTex },
    uCollT: { value: -100 },
    uAtlas: { value: null },
    uTime: { value: 0 },
    uSL: { value: SL },
    uDLP: { value: DLP },
    uDLC: { value: DLC },
    uCamP: { value: new T.Vector3() },
    uCutP: { value: new T.Vector3() },
    uCut: { value: 0 },
    uFogDen: { value: 0.05 },
    uFogColor: { value: fogCol },
    uScale: { value: 600 },
    // oxlint-disable-next-line typescript/no-misused-spread -- 明るさの文字は ASCII（元の書き方のまま）
    uRamp: { value: new Float32Array([...RAMP_CH].map((c) => c.charCodeAt(0) - 32)) },
    uAmb: { value: 1 },
  };

  // ---------------------------------------------------------------- dynamic glyph billboards
  gfx.dynGeo = new T.InstancedBufferGeometry();
  {
    const pg = new T.PlaneGeometry(1, 1);
    gfx.dynGeo.index = pg.index;
    gfx.dynGeo.setAttribute('position', must(pg.attributes['position'], '板の形'));
    gfx.dynGeo.setAttribute('uv', must(pg.attributes['uv'], '板の形'));
  }
  gfx.aPos = new T.InstancedBufferAttribute(dPos, 3).setUsage(T.DynamicDrawUsage);
  gfx.aCol = new T.InstancedBufferAttribute(dCol, 3).setUsage(T.DynamicDrawUsage);
  gfx.aPar = new T.InstancedBufferAttribute(dPar, 4).setUsage(T.DynamicDrawUsage);
  gfx.dynGeo.setAttribute('iPos', gfx.aPos);
  gfx.dynGeo.setAttribute('iCol', gfx.aCol);
  gfx.dynGeo.setAttribute('iP', gfx.aPar);
  gfx.dynGeo.instanceCount = 0;

  // ---------------------------------------------------------------- particles
  gfx.ptGeo = new T.BufferGeometry();
  gfx.bpPos = new T.BufferAttribute(ptPos, 3).setUsage(T.DynamicDrawUsage);
  gfx.bpCol = new T.BufferAttribute(ptCol, 3).setUsage(T.DynamicDrawUsage);
  gfx.bpSize = new T.BufferAttribute(ptSize, 1).setUsage(T.DynamicDrawUsage);
  gfx.bpGly = new T.BufferAttribute(ptGly, 1).setUsage(T.DynamicDrawUsage);
  gfx.ptGeo.setAttribute('position', gfx.bpPos);
  gfx.ptGeo.setAttribute('aCol', gfx.bpCol);
  gfx.ptGeo.setAttribute('aSize', gfx.bpSize);
  gfx.ptGeo.setAttribute('aGlyph', gfx.bpGly);

  return true;
}
