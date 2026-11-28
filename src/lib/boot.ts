// ゲームを始める（もとは src/game/30-loop-init.js）：文字の絵の表と文字の部品を作り、最初の階を作ってメインループを回し始める init と、
// それを呼ぶ start（テスト用モードでは、用意ができたら URL の指定を当てて __test.ready に知らせる。そうでなければ、自動で試す用意をし、少し待って URL の指定を当てる）。
import { must } from './array.ts';
import { sndPrep } from './audio.ts';
import { initAuto } from './auto.ts';
import { dbg, dbgUrl } from './debug.ts';
import { redrawIntroLater } from './intro.ts';
import { newLevel } from './levels.ts';
import { applySize, frame } from './loop.ts';
import { summon } from './monsters.ts';
import { buildAtlas, makeWater } from './render.ts';
import { DYN_VS, GLYPH_FS, PT_FS, PT_VS, STATIC_VS } from './shaders.ts';
import { clock, gfx, TEST } from './state.ts';
import { T } from './three.ts';

/** 分け合う値（無ければ止まる） */
const U = () => must(gfx.U, '分け合う値 gfx.U');

/** 文字の絵の表と文字の部品を作り、最初の階を作って、メインループを回し始める */
async function init(): Promise<void> {
  try {
    if (document.fonts && document.fonts.load)
      await Promise.race([
        Promise.all([
          document.fonts.load('800 96px "JetBrains Mono"'),
          document.fonts.load('500 96px "Noto Sans Runic"', 'ᚦᛏᛜᛞᚲᛁᛊᚾᚱᚺ'),
          document.fonts.load('400 14px "BIZ UDGothic"', '←→！：？［］'),
        ]),
        new Promise<void>((r) => (TEST ? must(clock.TESTCLK, 'テスト用モードの時計').realTimeout : setTimeout)(r, 2500)),
      ]);
  } catch (e) {}
  U().uAtlas.value = buildAtlas();
  gfx.staticMat = new T.ShaderMaterial({
    uniforms: {
      uAtlas: U().uAtlas,
      uTime: U().uTime,
      uSL: U().uSL,
      uDLP: U().uDLP,
      uDLC: U().uDLC,
      uFogDen: U().uFogDen,
      uFogColor: U().uFogColor,
      uRamp: U().uRamp,
      uAmb: U().uAmb,
      uCell: U().uCell,
      uCollT: U().uCollT,
      uCamP: U().uCamP,
      uCutP: U().uCutP,
      uCut: U().uCut,
    },
    vertexShader: STATIC_VS,
    fragmentShader: GLYPH_FS,
    side: T.DoubleSide,
    alphaToCoverage: true,
  });
  gfx.dynMat = new T.ShaderMaterial({
    uniforms: { uAtlas: U().uAtlas, uFogDen: U().uFogDen, uFogColor: U().uFogColor },
    vertexShader: DYN_VS,
    fragmentShader: GLYPH_FS,
    side: T.DoubleSide,
    alphaToCoverage: true,
  });
  gfx.ptMat = new T.ShaderMaterial({
    uniforms: { uAtlas: U().uAtlas, uScale: U().uScale, uFogDen: U().uFogDen },
    vertexShader: PT_VS,
    fragmentShader: PT_FS,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  gfx.occMat = new T.ShaderMaterial({
    uniforms: { uCamP: U().uCamP, uCutP: U().uCutP, uCut: U().uCut },
    colorWrite: false,
    side: T.DoubleSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCamP; uniform vec3 uCutP; uniform float uCut; varying vec3 vW;
      void main(){ if(uCut>0.5){ vec3 seg=uCutP-uCamP; float L2=max(dot(seg,seg),1e-4); float tc=clamp(dot(vW-uCamP,seg)/L2,0.0,1.0); if(tc<0.97&&length(vW-(uCamP+seg*tc))<mix(2.6,0.9,tc)+0.15) discard; } gl_FragColor=vec4(0.0); }`,
  });
  makeWater();
  const dynMesh = new T.Mesh(must(gfx.dynGeo, '置いた文字の形 gfx.dynGeo'), gfx.dynMat);
  dynMesh.frustumCulled = false;
  dynMesh.renderOrder = 1;
  must(gfx.scene, '場面 gfx.scene').add(dynMesh);
  const pts = new T.Points(must(gfx.ptGeo, '粒子の形 gfx.ptGeo'), gfx.ptMat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  must(gfx.scene, '場面 gfx.scene').add(pts);
  applySize('init');
  newLevel();
  // 音の部品を先に作っておく（迷宮に入る時に止まらないように。鳴らし始めるのは、押した時の sndInit。src/lib/audio.ts）
  sndPrep();
  requestAnimationFrame(frame);
}
/** ゲームを始める（テスト用モードでは、用意ができたら URL の指定を当てて、__test.ready に知らせる） */
export function start(): void {
  if (TEST)
    init()
      .then(() => {
        dbgUrl();
        clock.testBoot = true;
      })
      .catch((e) => {
        console.error(e);
        clock.testBoot = 'error: ' + e;
      });
  else {
    init()
      .then(() =>
        initAuto({
          toStairs: () => dbg.to('stairs'),
          clear: () => {
            dbg.clear();
          },
          hurt: (n) => {
            dbg.hurt(n);
          },
          summon: (k, i) => {
            summon(k, i);
          },
          title: () => redrawIntroLater(),
        }),
      )
      .catch((e) => console.error(e));
    setTimeout(() => {
      try {
        dbgUrl();
      } catch (e) {
        console.error(e);
      }
    }, 400);
  }
}
