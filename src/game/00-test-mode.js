// ---------------------------------------------------------------- test mode (?test=1): the same result every time, for automated checks
// Math.random and the sound random (sndRand, its own sequence) are seeded, and the clock (performance.now / setTimeout / setInterval / the audio clock AudioContext.currentTime) only moves when the game steps.
// The game does not step by itself: window.__test.frames(n) draws n frames, __test.advance(sec) steps without drawing.
// テスト用モードか TEST は src/lib/state.ts（src/game/imports.mjs で読む）
// テスト用モードの1歩の秒 TEST_STEP は src/lib/state.ts（src/game/imports.mjs で読む）
// 時計と乱数を入れ替える installTestMode は src/lib/testmode.ts（src/game/imports.mjs で読む）
clock.TESTCLK=TEST?installTestMode():null;
ui.errEl=document.getElementById('err');
// three.js と、光のにじみなどの部品 T は src/lib/three.ts（src/game/imports.mjs で読む）
// 自動で試す（?auto）間は、localStorage に書かない（保存の処理より先に。src/lib/auto.ts）
autoGuard();
