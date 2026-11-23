import { defineConfig } from 'vitest/config';

// 単体テスト（ブラウザ不要、すぐ終わる）。ブラウザを使うテストは tests/*.mjs（Playwright）
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.{mjs,ts}'] },
});
