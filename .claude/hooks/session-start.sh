#!/bin/bash
# SessionStart：クラウドのセッションで、決めた版の Node と pnpm を用意し、依存を入れる（lint とテストがすぐ動くように）。
# Node を用意できなくても（nodejs.org に届かない、など）止めずに、環境の Node で依存のインストールまで進める。
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
warn() { echo "session-start: $*" >&2; }
BINS=()

# Node：.node-version の版。無ければ nodejs.org から入れる（マシンの種類に合わせ、SHASUMS256 で中身を確かめる）
NODE_V="$(tr -d '[:space:]' < .node-version)"
NODE_DIR="$HOME/.cache/node-v$NODE_V"
case "$(uname -m)" in
  x86_64 | amd64) ARCH=x64 ;;
  aarch64 | arm64) ARCH=arm64 ;;
  *) ARCH="" ;;
esac
install_node() {
  [ -n "$ARCH" ] || return 1
  local tmp name="node-v$NODE_V-linux-$ARCH"
  tmp="$(mktemp -d)"
  curl -sSfL --max-time 300 "https://nodejs.org/dist/v$NODE_V/$name.tar.xz" -o "$tmp/node.tar.xz" &&
    curl -sSfL --max-time 60 "https://nodejs.org/dist/v$NODE_V/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt" &&
    (cd "$tmp" && grep " $name.tar.xz\$" SHASUMS256.txt | sed "s/$name.tar.xz/node.tar.xz/" | sha256sum -c - >/dev/null) &&
    tar -xJf "$tmp/node.tar.xz" -C "$tmp" &&
    mkdir -p "$HOME/.cache" && mv "$tmp/$name" "$NODE_DIR"
  local ok=$?
  rm -rf "$tmp"
  return $ok
}
if [ -x "$NODE_DIR/bin/node" ] || install_node; then
  export PATH="$NODE_DIR/bin:$PATH"
  BINS+=("$NODE_DIR/bin")
else
  warn "Node $NODE_V を用意できなかった（$(uname -m)）。環境の Node（$(node --version 2>/dev/null || echo 無し)）で続ける"
fi

# pnpm：package.json の packageManager の版。pnpm は packageManager の版に自分で切り替えるので、入っていれば使う
PNPM_V="$(node -p "require('./package.json').packageManager.split('@')[1]")"
if ! command -v pnpm >/dev/null; then
  PNPM_DIR="$HOME/.cache/pnpm-$PNPM_V"
  npm install -g --prefix "$PNPM_DIR" "pnpm@$PNPM_V" >/dev/null
  export PATH="$PNPM_DIR/bin:$PATH"
  BINS+=("$PNPM_DIR/bin")
fi

# このセッションのコマンドでも、この Node と pnpm を使う
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  for b in "${BINS[@]}"; do echo "export PATH=\"$b:\$PATH\"" >> "$CLAUDE_ENV_FILE"; done
fi

# 依存は、決めるファイルが前回から変わった時だけ入れ直す
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  # Playwright は、この環境に入っている Chromium（/opt/pw-browsers）を使う。ブラウザはダウンロードしない
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --frozen-lockfile
  sha256sum .claude/hooks/session-start.sh .node-version package.json pnpm-lock.yaml pnpm-workspace.yaml > "$hashes" || rm -f "$hashes"
fi
