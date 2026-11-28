// ---------------------------------------------------------------- renderer & post
// 描画の部品を作る initRenderer は src/lib/render.ts。どれも作る時に乱数を引くので、テスト用モードの入れ替えの後にここで呼ぶ。
// WebGL を作れなかった時は false を返すので、ゲームの用意をここでやめる
if(!initRenderer())return;
