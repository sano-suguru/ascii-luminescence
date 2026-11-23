// ページの入口（Vite が src/index.html から読む）。
// ゲーム本体は、src/game/*.js を名前の順につないで1つの関数で包んだもの（tools/vite-plugins.mjs の legacyGame が作る）。
import 'virtual:legacy-game';
