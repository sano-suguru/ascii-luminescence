// ---------------------------------------------------------------- the goal: three legendary things held by lords, a sealed descent, the deepest place, the last king's shadow
// FINAL_DEPTH は src/lib/world.ts（src/game/imports.mjs で読む）
// LEGEND_KINDS・LEGEND_ORDER・BRANCH_HINT は src/lib/names.ts（src/game/imports.mjs で読む）
// 伝説の物 getLegend は src/lib/legend.ts（src/game/imports.mjs で読む）。状態の表示の1行 legendLine も src/lib/legend.ts（状態の表示が使う）
// 伝説の物の読み方（legendOfBranch・legendAll・descentSealed）は src/lib/legend.ts（src/game/imports.mjs で読む）
// 最深部か isFinal は src/lib/levels.ts、最深部の状態 here.finalSt は src/lib/state.ts（src/game/imports.mjs で読む）

// lordFell は src/lib/combat.ts（src/game/imports.mjs で読む）
// applyOpen は src/lib/gear.ts（src/game/imports.mjs で読む）
// 空の枠を拾った時 openSlot は src/lib/pickup.ts（src/game/imports.mjs で読む）

// 伝説の物を手にした時 pickLegend は src/lib/pickup.ts
// 神託所が伝説の物の在りかを告げる oracleLegendHints は src/lib/legend.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- the deepest place: with the three legendary things in hand, the king's shadow rises there
// setupFinal は src/lib/levels.ts（src/game/imports.mjs で読む）
// 最深部を進める updateFinal は src/lib/levels.ts（src/game/imports.mjs で読む）
// SHADOW_KING_SC・shadowKingScale は src/lib/bodies/lords.ts（src/game/imports.mjs で読む）。二つ目の姿の大きさ shadowSerpentScale は src/lib/bodies/bosses.ts
// 王の影を立ち上がらせる spawnFinalBoss は src/lib/levels.ts
// 伝説の物を世界の中に描く drawLegendWorld は src/lib/legend.ts（src/game/imports.mjs で読む）
// victory は src/lib/results.ts（src/game/imports.mjs で読む）

// 稲妻の見た目 addBolt・sparkCrown・drawBoltFx は src/lib/fx.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- back to the title (the run ends)
// タイトルへ戻る returnToTitle は src/lib/menu.ts（src/game/imports.mjs で読む）

