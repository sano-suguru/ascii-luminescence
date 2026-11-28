// ---------------------------------------------------------------- 主を倒すと、その場に主の祭壇が立つ（深さ1の台・最初の祭壇・階ごとの祭壇・石碑を置くのは src/lib/altars.ts の placeRunesForLevel）
// dropRune は src/lib/combat.ts
// ---------------------------------------------------------------- 祭壇
// 祭壇の中身 altarFill・番人が生きているか guardedNow・祭壇を置く placeAltar・宝物庫のまわり vaultArea・祭壇の画面の1行 altarLine・
// 階ごとに祭壇とルーンを置く placeRunesForLevel は src/lib/altars.ts。
// 番人を置く・鍛え方・泉を置く・石碑のそばか nearStele など、ほかの祭壇の処理も src/lib/altars.ts にある（古い JS は読まない）
// the treasury's prize: taking it wakes guardians, or brings the ceiling down
// 宝物庫の褒美を取った時 vaultSprung と落石 updateRockfall（落石の状態は src/lib/state.ts の fight.rockfall）は src/lib/pickup.ts

// ---------------------------------------------------------------- healing: no regeneration over time. Part of each wound lingers as recoverable (shown on the bar); strike back before it fades
// and the light of what you strike flows into you; a kill gives more. Altars, a little on going down, healing springs, and the town and the oracle heal.
// RALLY_FROM は src/lib/runes.ts
// rallyOnHit は src/lib/combat.ts
// 立ち直りを進める updateRally は src/lib/combat.ts
// 癒しの泉を描く drawSprings は src/lib/fixtures.ts、泉を置く placeSpring は src/lib/altars.ts

// 足元の物を拾う pickupItems と、物を取る grabItem は src/lib/pickup.ts
// 拾ったルーンを手か袋に入れる（takeRune・placeChosen・mergeMod）・行き先の名前 runeDest・祭壇の画面の説明 altarDetail と選択肢 altarOpts は src/lib/altars.ts
// 祭壇の画面（灯った祭壇の近くで、3つの選択肢を並べる。描く renderAltar・説明 setAltarDetail・開く openAltar・閉じる closeAltar・毎フレーム updateAltarPanel・選ぶ chooseAltar）は src/lib/panels.ts
