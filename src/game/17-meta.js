// ---------------------------------------------------------------- lore (points kept between runs), unlocks, the last run's grave, trials
// META_DEF・UNLOCKS は src/lib/progress.ts
// タイトルの画面（記録を読む loadMeta・解放の画面 buildUnlockPanel・タイトルの枠 buildIntroPanel・後から描き直す redrawIntroLater・初めて指で入った時の一言 touchTip）と、
// それを用意する initIntro は src/lib/intro.ts
initIntro();
// 次のビルドに持ち替える nextBuild・キーの処理 onKeyDown・装備の画面とメニューの開け閉め togglePack・toggleMenu と、マウスとキーの処理を用意する initInput は src/lib/input.ts
initInput();
