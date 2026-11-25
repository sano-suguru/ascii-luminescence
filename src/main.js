// ページの入口（Vite が src/index.html から読む）。
// ゲーム本体は、src/game/*.js を名前の順につないで1つの関数で包んだもの（tools/vite-plugins.mjs の legacyGame が作る）。
// フォントは npm の @fontsource から読み、組み立てに入れる（Google Fonts からは読まない）。並びは @font-face の並びになる。
//   JetBrains Mono：画面の英数字。M PLUS 1 Code：パネル（半角1マス・全角2マス。枠の縦線はこの幅で揃える）。
//   BIZ UDGothic：M PLUS 1 Code に無い文字の補い（使ってよい文字は src/lib/text.ts の BIZ_CHARS）。Noto Sans Runic：ルーン文字
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/jetbrains-mono/800.css';
import '@fontsource/m-plus-1-code/400.css';
import '@fontsource/m-plus-1-code/600.css';
import '@fontsource/m-plus-1-code/700.css';
import '@fontsource/noto-sans-runic/400.css';
import '@fontsource/biz-udgothic/400.css';
import '@fontsource/biz-udgothic/700.css';
import 'virtual:legacy-game';
