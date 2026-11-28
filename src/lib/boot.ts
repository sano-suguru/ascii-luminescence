// ゲームを始める：文字の絵の表と文字の部品を作り、最初の階を作ってメインループを回し始める init と、
// それを呼ぶ start（テスト用モードでは、用意ができたら URL の指定を当てて __test.ready に知らせる。そうでなければ、自動で試す用意をし、少し待って URL の指定を当てる）。
import { must } from './array.ts';
import { sndPrep } from './audio.ts';
import { autoGuard, initAuto } from './auto.ts';
import { addLooks } from './bodies/build.ts';
import { MTYPES } from './creatures.ts';
import { dbg, dbgUrl, initDbg } from './debug.ts';
import { initInput, initPointer } from './input.ts';
import { initIntro, redrawIntroLater } from './intro.ts';
import { newLevel } from './levels.ts';
import { renderLog } from './log.ts';
import { applySize, frame } from './loop.ts';
import { sizeMap } from './minimap.ts';
import { summon } from './monsters.ts';
import { DUMMY_KINDS } from './names.ts';
import { buildAtlas, initRenderer, makeWater } from './render.ts';
import { RES } from './runes.ts';
import { loadSet } from './save.ts';
import { loadSndLevel } from './screens.ts';
import { DYN_VS, GLYPH_FS, PT_FS, PT_VS, STATIC_VS } from './shaders.ts';
import { adv, clock, gfx, saved, TEST, ui } from './state.ts';
import { initTestApi } from './testapi.ts';
import { installTestMode } from './testmode.ts';
import { buildLogo } from './title.ts';
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
function start(): void {
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

/** id の要素が canvas なら返す（無ければ null。canvas でない要素なら止まる） */
function canvasById(id: string): HTMLCanvasElement | null {
  const el = document.getElementById(id);
  if (el && !(el instanceof HTMLCanvasElement)) throw new Error(`#${id} が canvas でない`);
  return el;
}

/**
 * ページの用意（src/main.js が呼ぶ）。順番に意味がある：
 * - テスト用モードの時計と乱数の入れ替え（installTestMode）より後で、Math.random を引く物（描画の部品・探索のシード・init の three.js）を作る
 * - 指の土台（initPointer の中の initTouch）は、マウスとキーの処理（initInput）より先に登録する
 * - WebGL を作れなければ（initRenderer が偽）、そこで用意をやめる
 */
export function boot(): void {
  clock.TESTCLK = TEST ? installTestMode() : null;
  ui.errEl = document.getElementById('err');
  // 自動で試す間は、ゲームの保存を書かない（src/lib/auto.ts）
  autoGuard();
  buildLogo();
  if (!initRenderer()) return;
  // 表 MTYPES に見た目を書き足す
  addLooks();
  // ミニマップと伝言（1秒ごとに描き直す）、タイトルの画面、マウスを捕まえた知らせと指の土台
  ui.mapC = canvasById('map');
  ui.mctx = must(ui.mapC, 'ミニマップの #map').getContext('2d');
  sizeMap();
  setInterval(renderLog, 1000);
  ui.introEl = document.getElementById('intro');
  initPointer();
  // タイトルの画面（記録 META と開発用モードを読む）と、マウスとキーの処理
  initIntro();
  initInput();
  // 探索のシードの初めの値
  adv.runSeed = (Math.random() * 1e9) >>> 0;
  // 魔導書（記した反応）
  try {
    saved.BOOK = new Set(JSON.parse(localStorage.getItem('al_book') || '[]'));
  } catch (e) {}
  // 方向の矢印のキャンバスと下の HUD。下の HUD の上の端（ui.hotbarTop）は、HUD か窓の大きさが変わるまで覚えておく
  // （状態の表示や伝言を書いた直後に読むと、ページを組み直させるため）。ResizeObserver が無ければ毎回読む
  ui.arrowCv = canvasById('arrows');
  ui.arrowCtx = ui.arrowCv ? ui.arrowCv.getContext('2d') : null;
  ui.hotbarEl = document.getElementById('hotbar');
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- ResizeObserver の無いブラウザもある
  ui.hotbarWatch = !!(ui.hotbarEl && window.ResizeObserver);
  if (ui.hotbarWatch) {
    new ResizeObserver(() => {
      ui.hotbarTop = null;
    }).observe(must(ui.hotbarEl, '下の HUD の #hotbar'));
    addEventListener('resize', () => {
      ui.hotbarTop = null;
    });
  }
  // 照準の文字を書く所（src/lib/chantfx.ts の updateCross が書く）
  ui.crossEl = document.getElementById('cross');
  // 開発用の命令 window.dbg
  initDbg();
  // 見た生き物と見たルーン（探索をまたいで残る）
  saved.SEEN = loadSet('al_seen');
  saved.RSEEN = loadSet('al_runes');
  // 試しの間の的の種類
  for (const d of DUMMY_KINDS) {
    MTYPES[d.k] = {
      ch: '+',
      name: d.name,
      col: d.col,
      form: 'humanoid',
      scale: 0.95,
      speed: 0,
      fl: 0,
      light: 1.6,
      trail: 0,
      dummy: true,
      verb: '藁と石で組まれた的。何度倒れても、また起き上がる',
    };
  }
  RES['dummyF'] = { fire: 0.2, ice: 2 };
  RES['dummyP'] = { poison: 0.2, fire: 2 };
  RES['dummyT'] = { thunder: 2, fire: 0.5 };
  // 残した音量の段
  loadSndLevel();
  // 見た時の説明を出す所
  ui.lookEl = document.getElementById('look');
  window.addEventListener('resize', () => {
    applySize('resize');
    sizeMap();
  });
  // テスト用の __test と、ゲームを始める
  initTestApi();
  start();
}
