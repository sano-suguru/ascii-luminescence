// ---------------------------------------------------------------- monsters
// 生き物の形を作る buildForm は src/lib/bodies/build.ts、主などのまわりの飾り（lichAura など）・王の影の変身 transformShadow・姿を変える途中 drawMorph は
// src/lib/bodies/auras.ts、忘れられた獣の記録 loadBeasts・recordBeast は src/lib/save.ts、図鑑の見本の獣 beastSamples は src/lib/bodies/lords.ts
// 表 MTYPES に見た目（look など）を書き足す（src/lib/bodies/build.ts。ここで呼ぶので、書き足すのは前のファイルを読んだ後）
addLooks();
