import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'dist/', '.build/', 'tests/out/', '.wrangler/'] },
  js.configs.recommended,
  {
    // ゲーム本体：ブラウザの普通の <script>（モジュールではない）。THREE は CDN の <script> から来る。
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser, THREE: 'readonly' },
    },
    rules: {
      // 同じスコープで、宣言より前に let/const を使う（TDZ）のを見つける。関数の中から外の変数を読むのは許す。
      'no-use-before-define': ['error', { functions: false, classes: true, variables: false }],
      // 日本語の文中の全角スペースは意図したもの。
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true, skipComments: true }],
      // catch(e){} で失敗を無視する書き方は、localStorage などで意図して使っている。
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // 以下は不具合ではなく、整理の候補（警告）。エラーだけが hook や CI を止める。
      'no-unused-vars': ['warn', { caughtErrors: 'none', args: 'none' }],
      'no-useless-assignment': 'warn',
      'no-constant-condition': 'warn',
    },
  },
  {
    files: ['tools/**/*.mjs', 'tests/**/*.mjs', '.claude/hooks/**/*.mjs', '*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
  },
  {
    // スモークテストの page.evaluate の中はブラウザで動く。
    files: ['tests/**/*.mjs'],
    languageOptions: { globals: { ...globals.browser, dbg: 'readonly', __test: 'readonly' } },
  },
];
