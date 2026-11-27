// ---------------------------------------------------------------- ambient sound (procedural, Web Audio)
// SND_NAME・sEnv は src/lib/sound.ts、音を鳴らす処理（sndReady・sndInit・sOut・sNoise・sTone・効果音・まわりの音 sndUpdate）は src/lib/audio.ts（どれも src/game/imports.mjs で読む）
// SND は src/lib/state.ts（src/game/imports.mjs で読む。丸ごと入れ替えないので、名前はそのまま）
// 音量を次の段にする sndToggle は src/lib/screens.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- swamp gas
// ガスが広がる時の作業の配列 gasTmp は src/lib/state.ts の blaze（src/game/imports.mjs で読む）
// ---------------------------------------------------------------- fire (after Brogue: spreads through flammable terrain, ignites gas)
// FIRE_TYPES は src/lib/world.ts（src/game/imports.mjs で読む）
// initFire は src/lib/ground.ts（src/game/imports.mjs で読む）
// 火をつける ignite は src/lib/ground.ts（src/game/imports.mjs で読む）
// 火を1歩進める stepFire は src/lib/ground.ts（src/game/imports.mjs で読む）
// マスの火・灰・変わり方を描画に渡す uploadCells は src/lib/ground.ts（src/game/imports.mjs で読む）
// 火を描く drawFire は src/lib/fx.ts（src/game/imports.mjs で読む）
// initEvents は src/lib/levels.ts（src/game/imports.mjs で読む）
// cpos は src/lib/world.ts（src/game/imports.mjs で読む）
// 生き物を呼び出す summon は src/lib/monsters.ts（src/game/imports.mjs で読む）
// 部屋の出来事を進める updateEvents は src/lib/events.ts（src/game/imports.mjs で読む）

// 沼のガスを1歩進める stepGas は src/lib/ground.ts（src/game/imports.mjs で読む）
// 沼のガスの粒 updateGasPoints は src/lib/motes.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- particle update
// respawnDust は src/lib/particles.ts（src/game/imports.mjs で読む）
// initDust は src/lib/particles.ts（src/game/imports.mjs で読む）
// 川のさざ波 riverFX と、粒子と塵を動かす updateParticles は src/lib/motes.ts（src/game/imports.mjs で読む。粒子の配列 ptPos・ptCol・ptSize・ptGly は src/lib/particles.ts、描く形と属性は src/lib/state.ts の gfx）
