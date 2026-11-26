// ---------------------------------------------------------------- spells meet the world: doors stop them, sight lines matter, ice freezes water and puts out fire, thunder runs through water, fire lights poison mist
// doorBlock は src/lib/aim.ts（src/game/imports.mjs で読む）
// losClear は src/lib/aim.ts（src/game/imports.mjs で読む）
// mCenter は src/lib/math.ts（src/game/imports.mjs で読む）
// beamFrame は src/lib/aim.ts（src/game/imports.mjs で読む）
// 冷気 chillArea と、凍らせた水が溶ける updateFrozen は src/lib/ground.ts（src/game/imports.mjs で読む）
// 凍らせた水を描く drawFrozen は src/lib/fx.ts（src/game/imports.mjs で読む）
// conductWater は src/lib/combat.ts（src/game/imports.mjs で読む）
// landElem は src/lib/combat.ts（src/game/imports.mjs で読む）
// 毒の霧に火がつく cloudsMeetFire は src/lib/projs.ts（src/game/imports.mjs で読む）
// onDodged は src/lib/combat.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- the chant as a voice: whispered syllables that swell into a choir; each syllable lights one rune of the circle
// VOWELS・CHANT_STEPS は src/lib/sound.ts（src/game/imports.mjs で読む）
// 詠唱の声 chantStart と性質ごとの声の高さ ELEM_ROOT は src/lib/audio.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- HUD at the bottom: what each hand holds, the chant
// 下の HUD を描き直す renderHotbar は src/lib/hotbar.ts（src/game/imports.mjs で読む）

// かわす転がり startRoll は src/lib/chant.ts（src/game/imports.mjs で読む）

// 止まっているか isPaused は src/lib/status.ts（src/game/imports.mjs で読む）
