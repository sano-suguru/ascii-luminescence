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
  },
  plugins: [legacyGame(), mode === 'test' && testPage(), privateMaps(join(root, '.build/maps', mode))],
}));
