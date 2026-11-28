// ---------------------------------------------------------------- chanting: hold to chant, release to cast; the world slows while you chant
// ゲームの時間の速さ timeScale は src/lib/chant.ts
// 溜め始める beginCast・溜めが散る fizzle・放つ releaseCast・溜めを進める updateCast は src/lib/chant.ts

// castNow は src/lib/combat.ts
// turnDir は src/lib/math.ts
// dashCast は src/lib/combat.ts
// dashCuts は src/lib/combat.ts
// startRain は src/lib/combat.ts
// 雨を降らせる updateRains は src/lib/projs.ts
// castRapid は src/lib/combat.ts
// castStar は src/lib/combat.ts
// 剣が飛ばす風の刃を描く drawWave は src/lib/fx.ts
// fireWave は src/lib/combat.ts
// meleeCast は src/lib/combat.ts
// beamHold は src/lib/state.ts
// fireBeam は src/lib/combat.ts
// reflectDir は src/lib/aim.ts
// inWater は src/lib/combat.ts

// ---------------------------------------------------------------- hits, elements and reactions (all shown, never written)
// applyHit は src/lib/combat.ts
// hitFeedback は src/lib/combat.ts
// applyElem は src/lib/combat.ts
// nearestFoe は src/lib/combat.ts
// zapLine は src/lib/combat.ts
// chainLightning は src/lib/combat.ts
// react は src/lib/combat.ts
// 状態異常を進める updateStatuses と生き物の時間の速さ monTimeK は src/lib/projs.ts

// ---------------------------------------------------------------- projectiles: arrows fly straight, orbs arc and burst; both can bounce and seek
// 飛ぶ物を進める updateProjs と、光の月が弾ける moonBurst は src/lib/projs.ts
// sp_elem は src/lib/runes.ts

// orbBurst は src/lib/combat.ts
// lingering traces of an element: every half second, what stands in them takes the element
// addZone は src/lib/combat.ts
// later は src/lib/combat.ts
// 遅れて起きることと魔法の場を進める updateZones は src/lib/projs.ts
// 床の目印と魔法の場を描く drawZones は src/lib/fx.ts
// burstFire は src/lib/combat.ts
// 見ている向き viewDir は src/lib/aim.ts
// groundPoint は src/lib/aim.ts

// ---------------------------------------------------------------- triggers
// onKilledBy は src/lib/combat.ts

