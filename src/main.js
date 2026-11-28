// ページの入口（Vite が src/index.html から読む）。
// ゲームは src/lib の TypeScript のモジュール。用意の順番は src/lib/boot.ts の boot。
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
import { boot } from './lib/boot.ts';

// 開発用サーバーだけ：テスト用モード（?test=1）は時計（setTimeout）を止めるので、Vite の読み直し（setTimeout で少し待ってから読み直す）が動かない。
// 読み直しの合図を受けたら、すぐ読み直す（組み立てた物では import.meta.hot が無いので何もしない）。boot が止まっても読み直せるように、先に登録する
if (import.meta.hot && new URLSearchParams(location.search).get('test') === '1')
  import.meta.hot.on('vite:beforeFullReload', () => location.reload());

boot();
