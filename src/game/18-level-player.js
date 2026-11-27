// ---------------------------------------------------------------- level control
let expo=1.1;
adv.runSeed=(Math.random()*1e9)>>>0;
// levelSeed は src/lib/levels.ts（src/game/imports.mjs で読む）
// setFog は src/lib/build.ts（src/game/imports.mjs で読む）
// showStratum は src/lib/levels.ts（src/game/imports.mjs で読む）
// settleSlotPick は src/lib/levels.ts（src/game/imports.mjs で読む）
// newLevel は src/lib/levels.ts（src/game/imports.mjs で読む）
// checkEvents は src/lib/levels.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- player
// 薄い氷に乗っていた秒 iceT は src/lib/state.ts、氷が割れる crackIce・背の高い茂みか tallAt・踏み分ける trample・硫黄が燃え上がる brimFlare は src/lib/ground.ts（src/game/imports.mjs で読む）
// 踏み分けた草が戻る regrow と、燃えた硫黄が戻る brimRecover は src/lib/ground.ts（src/game/imports.mjs で読む）
// TRAP_INFO は src/lib/names.ts（src/game/imports.mjs で読む）
// 罠を踏んだ時 triggerTrap と、罠を進める updateTraps は src/lib/events.ts（src/game/imports.mjs で読む）
// 罠と鉄格子を描く drawTraps は src/lib/fixtures.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- life and death, and plain real-time melee
// 生き物の強さ statOf は src/lib/monsters.ts（src/game/imports.mjs で読む）。強さの表 MSTAT は src/lib/creatures.ts（statOf だけが読む）
// WEAPON・SLEEP_MULT は src/lib/runes.ts（src/game/imports.mjs で読む）
// roll は src/lib/random.ts（src/game/imports.mjs で読む）
// 敵か hostile・攻撃の的にしてよいか foe は src/lib/monsters.ts、攻撃が当たる生き物か hittable は src/lib/aim.ts（src/game/imports.mjs で読む）
// angDiff は src/lib/math.ts（古い JS は使わない。src/lib/ の生成などが使う）
// expNeed・expOf は src/lib/progress.ts（src/game/imports.mjs で読む）
// serRune は src/lib/runes.ts（src/game/imports.mjs で読む）
// 生き物の体力を初めの値にする initMonsterLife は src/lib/monsters.ts（古い JS は読まない。makeMonster が呼ぶ）
// ---------------------------------------------------------------- levelling: defeating creatures gives experience; at each level time stops and you choose one of three
// (two blessings - strengths tied to actions and elements, some with a price - and one rune or charm). Max health does not grow with level: it grows by 4 on entering each new stratum.
// BLESS は src/lib/progress.ts、加護の段 BL は src/lib/monsters.ts（src/game/imports.mjs で読む）
// coldSnap は src/lib/combat.ts（src/game/imports.mjs で読む）
// gainExp は src/lib/combat.ts（src/game/imports.mjs で読む）
// レベルアップの画面（選択肢 levelChoices・1行 lvlLine・描く renderLevelUp・説明 setLevelDetail・開く openLevelUp・選ぶ chooseLevel）は src/lib/panels.ts（src/game/imports.mjs で読む）
// strataGrowth は src/lib/levels.ts（src/game/imports.mjs で読む）
// hurtPlayer は src/lib/combat.ts（src/game/imports.mjs で読む）
// resultPlace は src/lib/results.ts（src/game/imports.mjs で読む）
// runLore は src/lib/results.ts（src/game/imports.mjs で読む）
// awardLore は src/lib/results.ts（src/game/imports.mjs で読む）
// loreRows は src/lib/results.ts（src/game/imports.mjs で読む）
// 墓のルーンを作る graveRune は src/lib/gear.ts（祭壇などを置く src/lib/altars.ts が使う）
// graveCandidates は src/lib/results.ts（src/game/imports.mjs で読む）
// saveGrave は src/lib/results.ts（src/game/imports.mjs で読む）
// graveRows は src/lib/results.ts（src/game/imports.mjs で読む）
// die は src/lib/levels.ts（src/game/imports.mjs で読む）
// newRun は src/lib/levels.ts（src/game/imports.mjs で読む）
// hitReact は src/lib/combat.ts（src/game/imports.mjs で読む）
// damageMonster は src/lib/combat.ts（src/game/imports.mjs で読む）
// 命の一歩 updateLife は src/lib/combat.ts（src/game/imports.mjs で読む）
// monsterStrike は src/lib/combat.ts（src/game/imports.mjs で読む）
// the blade swing in front of the camera
