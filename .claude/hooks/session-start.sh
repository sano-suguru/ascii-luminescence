#!/bin/bash
# SessionStart：クラウドのセッションで、決めた版の Node と pnpm を用意し、依存を入れる（lint とテストがすぐ動くように）。
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Node：.node-version の版。無ければ nodejs.org から入れる（SHASUMS256 で中身を確かめる）
NODE_V="$(tr -d '[:space:]' < .node-version)"
NODE_DIR="$HOME/.cache/node-v$NODE_V"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  tmp="$(mktemp -d)"
  curl -sSfL "https://nodejs.org/dist/v$NODE_V/node-v$NODE_V-linux-x64.tar.xz" -o "$tmp/node.tar.xz"
  curl -sSfL "https://nodejs.org/dist/v$NODE_V/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
  (cd "$tmp" && grep " node-v$NODE_V-linux-x64.tar.xz\$" SHASUMS256.txt | sed "s/node-v$NODE_V-linux-x64.tar.xz/node.tar.xz/" | sha256sum -c - >/dev/null)
  tar -xJf "$tmp/node.tar.xz" -C "$tmp"
  mkdir -p "$HOME/.cache" && mv "$tmp/node-v$NODE_V-linux-x64" "$NODE_DIR" && rm -rf "$tmp"
fi
export PATH="$NODE_DIR/bin:$PATH"

# pnpm：package.json の packageManager の版
PNPM_V="$(node -p "require('./package.json').packageManager.split('@')[1]")"
if [ "$(pnpm --version 2>/dev/null || true)" != "$PNPM_V" ]; then
  npm install -g --prefix "$NODE_DIR" "pnpm@$PNPM_V" >/dev/null
fi

# このセッションのコマンドでも、この Node と pnpm を使う
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$NODE_DIR/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# 依存は、決めるファイルが前回から変わった時だけ入れ直す
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  # Playwright は、この環境に入っている Chromium（/opt/pw-browsers）を使う。ブラウザはダウンロードしない
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --frozen-lockfile
  sha256sum .claude/hooks/session-start.sh .node-version package.json pnpm-lock.yaml pnpm-workspace.yaml > "$hashes" || rm -f "$hashes"
fi
