// ---------------------------------------------------------------- spells meet the world: doors stop them, sight lines matter, ice freezes water and puts out fire, thunder runs through water, fire lights poison mist
// doorBlock は src/lib/aim.ts
// losClear は src/lib/aim.ts
// mCenter は src/lib/math.ts
// beamFrame は src/lib/aim.ts
// 冷気 chillArea と、凍らせた水が溶ける updateFrozen は src/lib/ground.ts
// 凍らせた水を描く drawFrozen は src/lib/fx.ts
// conductWater は src/lib/combat.ts
// landElem は src/lib/combat.ts
// 毒の霧に火がつく cloudsMeetFire は src/lib/projs.ts
// onDodged は src/lib/combat.ts

// ---------------------------------------------------------------- the chant as a voice: whispered syllables that swell into a choir; each syllable lights one rune of the circle
// VOWELS・CHANT_STEPS は src/lib/sound.ts
// 詠唱の声 chantStart と性質ごとの声の高さ ELEM_ROOT は src/lib/audio.ts

// ---------------------------------------------------------------- HUD at the bottom: what each hand holds, the chant
// 下の HUD を描き直す renderHotbar は src/lib/hotbar.ts

// かわす転がり startRoll は src/lib/chant.ts

// 止まっているか isPaused は src/lib/status.ts
