#!/bin/bash
# SessionStart：クラウドのセッションで、lint とテストがすぐ動くように依存を入れる。
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# 依存の一覧が前回から変わった時だけ入れ直す
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  # Playwright は、この環境に入っている Chromium（/opt/pw-browsers）を使う。ブラウザはダウンロードしない
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund
  sha256sum .claude/hooks/session-start.sh package.json package-lock.json > "$hashes" || rm -f "$hashes"
fi
