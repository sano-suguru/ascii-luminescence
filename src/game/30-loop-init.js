// ---------------------------------------------------------------- sizing and the main loop
// 大きさに合わせる applySize・毎フレームの frame・テスト用モードの1歩 testTick・ゲームの一歩 stepTick・tick・tick の段ごとの見た目の乱数 inPhase・inMobPhase・
// テスト用モードの __test.cam で置いたカメラ withTestCam・画質を変える setQuality は src/lib/loop.ts。
// 描く細かさ gfx.pixelRatio・後処理 gfx.composer・光のにじみ gfx.bloom・画質を下げる途中の状態 gfx.qRun・置いたカメラ gfx.testCam は src/lib/state.ts の gfx、
// 前のフレームの時刻と溜め（clock.last・fovT・mapT と、画質を決めるために数える perfT・perfAcc・perfN・warm）は clock、__test が使う TESTQ・tickNoise・skipPhases も src/lib/state.ts
window.addEventListener('resize',()=>{ applySize('resize'); sizeMap(); });

// ---------------------------------------------------------------- test hooks (only with ?test=1; see the test mode block at the top)
// テスト用モードの道具 window.__test を置く initTestApi は src/lib/testapi.ts
initTestApi();

// ---------------------------------------------------------------- init
// 文字の絵の表と文字の部品を作り、最初の階を作ってメインループを回し始める init と、それを呼ぶ start は src/lib/boot.ts
start();
