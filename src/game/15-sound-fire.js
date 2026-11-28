// ---------------------------------------------------------------- ambient sound (procedural, Web Audio)
// SND_NAME・sEnv は src/lib/sound.ts、音を鳴らす処理（sndReady・sndInit・sOut・sNoise・sTone・効果音・まわりの音 sndUpdate）は src/lib/audio.ts
// SND は src/lib/state.ts（丸ごと入れ替えないので、名前はそのまま）
// 音量を次の段にする sndToggle は src/lib/screens.ts

// ---------------------------------------------------------------- swamp gas
// ガスが広がる時の作業の配列 gasTmp は src/lib/state.ts の blaze
// ---------------------------------------------------------------- fire (after Brogue: spreads through flammable terrain, ignites gas)
// FIRE_TYPES は src/lib/world.ts
// initFire は src/lib/ground.ts
// 火をつける ignite は src/lib/ground.ts
// 火を1歩進める stepFire は src/lib/ground.ts
// マスの火・灰・変わり方を描画に渡す uploadCells は src/lib/ground.ts
// 火を描く drawFire は src/lib/fx.ts
// initEvents は src/lib/levels.ts
// cpos は src/lib/world.ts
// 生き物を呼び出す summon は src/lib/monsters.ts
// 部屋の出来事を進める updateEvents は src/lib/events.ts

// 沼のガスを1歩進める stepGas は src/lib/ground.ts
// 沼のガスの粒 updateGasPoints は src/lib/motes.ts

// ---------------------------------------------------------------- particle update
// respawnDust は src/lib/particles.ts
// initDust は src/lib/particles.ts
// 川のさざ波 riverFX と、粒子と塵を動かす updateParticles は src/lib/motes.ts（粒子の配列 ptPos・ptCol・ptSize・ptGly は src/lib/particles.ts、描く形と属性は src/lib/state.ts の gfx）
