// ---------------------------------------------------------------- small creatures (the living layer of the world; they never hunt you)
// 小さな生き物の形（critterForm など）は src/lib/bodies/small.ts（形は src/lib/bodies/build.ts の buildForm が選んで作る。古い JS は読まない）
// 小さな生き物の動き updateCritter は src/lib/ground.ts（src/game/imports.mjs で読む）。次に向かうマス critterStep は src/lib/monsters.ts、叫び声の音 sShriek は src/lib/audio.ts（古い JS は読まない）

// ---------------------------------------------------------------- packs and hunters: spiders and their webs, hounds on your scent, snapjaw camps, ancient machines
// クモの巣を描く drawWebs と触れた時の webTouch は src/lib/fixtures.ts（src/game/imports.mjs で読む）。その階で一度だけの伝言の旗は src/lib/state.ts の here
// 猟犬が追う匂い houndScent は src/lib/monsters.ts、掃除機と修復機の仕事 machineWork は src/lib/ground.ts（古い JS は読まない）
// 遠吠え sHowl・警報 sAlarm の音は src/lib/audio.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- large creatures of the terrain, mighty ones of the deep, and the lords of the branches
// 深みの主の触手 drawTentacles は src/lib/bodies/draw.ts（src/game/imports.mjs で読む）

// updateMonster は src/lib/monsters.ts（src/game/imports.mjs で読む）
// 水しぶき splash は src/lib/ground.ts（src/game/imports.mjs で読む）
// 生き物を描く drawMonster・drawMonster1・drawMonster0 は src/lib/bodies/draw.ts（src/game/imports.mjs で読む）

