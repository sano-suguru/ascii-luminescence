// 組み立て（Vite 8）。入口は src/index.html。ゲーム本体は tools/vite-plugins.mjs の legacyGame が1つのモジュールにする。
//   vite build              -> dist/（公開用。three.js とフォントは CDN と Google Fonts から）
//   vite build --mode test  -> .build/test/（テスト用。three.js とフォントは node_modules から。オフラインで動く）
//   ほかの mode             -> .build/<mode>/（単体テストで、公開用と同じ組み立てを試す時など）
// ソースマップは、どの mode でも .build/maps/<mode>/ に置き、出力には残さない（公開しない）。
import { join } from 'node:path';
import { defineConfig } from 'vite';
import { legacyGame, privateMaps, testPage } from './tools/vite-plugins.mjs';

const root = import.meta.dirname;

export default defineConfig(({ mode }) => ({
  root: join(root, 'src'),
  base: './',
  publicDir: false,
  clearScreen: false,
  // ブラウザで読む npm の依存は無い（three.js は CDN の <script>）。依存を探す下調べは要らない（仮のモジュールを読めずに警告が出る）
  optimizeDeps: { noDiscovery: true },
  build: {
    outDir: mode === 'production' ? join(root, 'dist') : join(root, '.build', mode),
    emptyOutDir: true,
    // ゲームのコードは、そのまま出す（古い書き方の変換も、縮めることもしない。見た目と動きを今までと同じにするため）
    target: 'esnext',
    minify: false,
    modulePreload: false,
    sourcemap: 'hidden',
    reportCompressedSize: false,
  },
  plugins: [legacyGame(), mode === 'test' && testPage(), privateMaps(join(root, '.build/maps', mode))],
}));
