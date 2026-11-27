// 組み立て（Vite 8）。入口は src/index.html。ゲーム本体は tools/vite-plugins.mjs の legacyGame が1つのモジュールにする。
//   vite build              -> dist/（公開用）
//   vite build --mode test  -> .build/test/（テスト用。JetBrains Mono を指定した所の日本語も、同梱のフォントで描く。tools/vite-plugins.mjs の testPage）
//   three.js（src/game/imports.mjs）とフォント（src/main.js）は、どちらも npm から組み立てに入れる。外の CDN は読まない
//   vite build --mode artifact -> .build/artifact/index.html（claude.ai の Artifact 用。JS・CSS・フォントを全部入れた HTML 1つ。tools/vite-plugins.mjs の inlineAll）
//   ほかの mode             -> .build/<mode>/（単体テストで、公開用と同じ組み立てを試す時など）
// ソースマップは、どの mode でも .build/maps/<mode>/ に置き、出力には残さない（公開しない）。
import { join } from 'node:path';
import { defineConfig } from 'vite';
import { fontCss, homeScreen, inlineAll, legacyGame, noCssStub, privateMaps, testPage } from './tools/vite-plugins.mjs';

const root = import.meta.dirname;

export default defineConfig(({ mode }) => ({
  root: join(root, 'src'),
  base: './',
  publicDir: false,
  clearScreen: false,
  // 依存を探す下調べはしない（仮のモジュールを読めずに警告が出る）。開発用サーバーは three.js（ES モジュール）を node_modules からそのまま読む
  optimizeDeps: { noDiscovery: true },
  build: {
    outDir: mode === 'production' ? join(root, 'dist') : join(root, '.build', mode),
    emptyOutDir: true,
    // ゲームのコードは、なるべくそのまま出す（古い書き方の変換も、縮めることも、使っていないコードを消すこともしない）。
    // ただし Rolldown は JS を書き直して出す（字下げ・引用符・undefined→void 0 など。意味は同じ）。場所はソースマップで戻す
    target: 'esnext',
    minify: false,
    // 使っていない関数を消さない。消すかどうかは人が決める（図鑑や dbg から文字列で呼ばれていないか確かめてから。CLAUDE.md）。
    // Vite は minify: false の時も Rolldown に minify: 'dce-only'（使っていないコードだけ消す）を渡すので、出力の側で止める
    rolldownOptions: { treeshake: false, output: { minify: false } },
    modulePreload: false,
    sourcemap: 'hidden',
    reportCompressedSize: false,
    // フォントは CSS に埋め込まない（埋め込むと、小さな面がページを開くたびに読む CSS に入る。ファイルにしておけば、要る範囲だけ読む）。
    // Artifact 版だけは、HTML 1つにするので、全部を埋め込む
    assetsInlineLimit: mode === 'artifact' ? () => true : (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  plugins: [
    legacyGame(),
    noCssStub(),
    fontCss(),
    mode === 'test' && testPage(),
    // 公開用（と、単体テストが公開用と同じ設定で試す mode）だけ。テスト版と Artifact 版には入れない
    mode !== 'test' && mode !== 'artifact' && homeScreen(),
    mode === 'artifact' && inlineAll(),
    privateMaps(join(root, '.build/maps', mode)),
  ],
}));
