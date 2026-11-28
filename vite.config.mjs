// 組み立て（Vite 8）。入口は src/index.html（src/main.js が src/lib/boot.ts を読む）。
//   vite build              -> dist/（公開用）
//   vite build --mode test  -> .build/test/（テスト用。JetBrains Mono を指定した所の日本語も、同梱のフォントで描く。tools/vite-plugins.mjs の testPage）
//   three.js（src/lib/three.ts）とフォント（src/main.js）は、どちらも npm から組み立てに入れる。外の CDN は読まない
//   vite build --mode artifact -> .build/artifact/index.html（claude.ai の Artifact 用。JS・CSS・フォントを全部入れた HTML 1つ。tools/vite-plugins.mjs の inlineAll）
//   ほかの mode             -> .build/<mode>/（単体テストで、公開用と同じ組み立てを試す時など）
// ソースマップは、どの mode でも .build/maps/<mode>/ に置き、出力には残さない（公開しない）。
import { join } from 'node:path';
import { defineConfig } from 'vite';
import { fontCss, homeScreen, inlineAll, privateMaps, testPage } from './tools/vite-plugins.mjs';

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
    // 古い書き方の変換も、縮めることもしない。使っていないコードは消す（Rolldown の既定）。
    // Rolldown は JS を書き直して出す（字下げ・引用符・undefined→void 0 など。意味は同じ）。場所はソースマップで戻す
    target: 'esnext',
    minify: false,
    modulePreload: false,
    sourcemap: 'hidden',
    reportCompressedSize: false,
    // フォントは CSS に埋め込まない（埋め込むと、小さな面がページを開くたびに読む CSS に入る。ファイルにしておけば、要る範囲だけ読む）。
    // Artifact 版だけは、HTML 1つにするので、全部を埋め込む
    assetsInlineLimit: mode === 'artifact' ? () => true : (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  plugins: [
    fontCss(),
    mode === 'test' && testPage(),
    // 公開用（と、単体テストが公開用と同じ設定で試す mode）だけ。テスト版と Artifact 版には入れない
    mode !== 'test' && mode !== 'artifact' && homeScreen(),
    mode === 'artifact' && inlineAll(),
    privateMaps(join(root, '.build/maps', mode)),
  ],
}));
