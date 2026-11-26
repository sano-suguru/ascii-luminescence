// ---------------------------------------------------------------- chanting: hold to chant, release to cast; the world slows while you chant
// ゲームの時間の速さ timeScale は src/lib/chant.ts（src/game/imports.mjs で読む）
// 溜め始める beginCast・溜めが散る fizzle・放つ releaseCast・溜めを進める updateCast は src/lib/chant.ts（src/game/imports.mjs で読む）

// castNow は src/lib/combat.ts（src/game/imports.mjs で読む）
// turnDir は src/lib/math.ts（src/game/imports.mjs で読む）
// dashCast は src/lib/combat.ts（src/game/imports.mjs で読む）
// dashCuts は src/lib/combat.ts（src/game/imports.mjs で読む）
// startRain は src/lib/combat.ts（src/game/imports.mjs で読む）
// 雨を降らせる updateRains は src/lib/projs.ts（src/game/imports.mjs で読む）
// castRapid は src/lib/combat.ts（src/game/imports.mjs で読む）
// castStar は src/lib/combat.ts（src/game/imports.mjs で読む）
// 剣が飛ばす風の刃を描く drawWave は src/lib/fx.ts（src/game/imports.mjs で読む）
// fireWave は src/lib/combat.ts（src/game/imports.mjs で読む）
// meleeCast は src/lib/combat.ts（src/game/imports.mjs で読む）
// beamHold は src/lib/state.ts（src/game/imports.mjs で読む）
// fireBeam は src/lib/combat.ts（src/game/imports.mjs で読む）
// reflectDir は src/lib/aim.ts（src/game/imports.mjs で読む）
// inWater は src/lib/combat.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- hits, elements and reactions (all shown, never written)
// applyHit は src/lib/combat.ts（src/game/imports.mjs で読む）
// hitFeedback は src/lib/combat.ts（src/game/imports.mjs で読む）
// applyElem は src/lib/combat.ts（src/game/imports.mjs で読む）
// nearestFoe は src/lib/combat.ts（src/game/imports.mjs で読む）
// zapLine は src/lib/combat.ts（src/game/imports.mjs で読む）
// chainLightning は src/lib/combat.ts（src/game/imports.mjs で読む）
// react は src/lib/combat.ts（src/game/imports.mjs で読む）
// 状態異常を進める updateStatuses と生き物の時間の速さ monTimeK は src/lib/projs.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- projectiles: arrows fly straight, orbs arc and burst; both can bounce and seek
// 飛ぶ物を進める updateProjs と、光の月が弾ける moonBurst は src/lib/projs.ts（src/game/imports.mjs で読む）
// sp_elem は src/lib/runes.ts（src/game/imports.mjs で読む）

// orbBurst は src/lib/combat.ts（src/game/imports.mjs で読む）
// lingering traces of an element: every half second, what stands in them takes the element
// addZone は src/lib/combat.ts（src/game/imports.mjs で読む）
// later は src/lib/combat.ts（src/game/imports.mjs で読む）
// 遅れて起きることと魔法の場を進める updateZones は src/lib/projs.ts（src/game/imports.mjs で読む）
// 床の目印と魔法の場を描く drawZones は src/lib/fx.ts（src/game/imports.mjs で読む）
// burstFire は src/lib/combat.ts（src/game/imports.mjs で読む）
// 見ている向き viewDir は src/lib/aim.ts（src/game/imports.mjs で読む）
// groundPoint は src/lib/aim.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- triggers
// 転がった時 onRolled は src/lib/chant.ts（src/game/imports.mjs で読む。今はどこからも呼ばれていない）
// onKilledBy は src/lib/combat.ts（src/game/imports.mjs で読む）

