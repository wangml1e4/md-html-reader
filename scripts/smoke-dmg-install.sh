#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PRODUCT_NAME="$(node -e 'const fs = require("fs"); const c = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8")); process.stdout.write(c.productName)')"
VERSION="$(node -e 'const fs = require("fs"); const c = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8")); process.stdout.write(c.version)')"
MACHINE="$(uname -m)"

case "$MACHINE" in
  arm64) TAURI_ARCH="aarch64" ;;
  x86_64) TAURI_ARCH="x64" ;;
  *) TAURI_ARCH="$MACHINE" ;;
esac

DMG_PATH="src-tauri/target/release/bundle/dmg/${PRODUCT_NAME}_${VERSION}_${TAURI_ARCH}.dmg"
MOUNT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/markdown-html-dmg-mount.XXXXXX")"
INSTALL_DIR="$(mktemp -d "${TMPDIR:-/tmp}/markdown-html-dmg-install.XXXXXX")"
APP_PID=""
APP_BINARY=""
APP_LOG=""
MOUNTED=0

cleanup() {
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null || true
    for _ in {1..10}; do
      if ! kill -0 "$APP_PID" 2>/dev/null; then
        break
      fi
      sleep 0.2
    done
    wait "$APP_PID" 2>/dev/null || true
    kill -9 "$APP_PID" 2>/dev/null || true
  fi
  if [[ "$MOUNTED" -eq 1 ]]; then
    hdiutil detach "$MOUNT_DIR" >/dev/null 2>&1 || true
  fi
  rm -rf "$MOUNT_DIR" "$INSTALL_DIR" "$APP_LOG"
}
trap cleanup EXIT

if [[ ! -f "$DMG_PATH" ]]; then
  echo "Expected DMG not found: $DMG_PATH" >&2
  echo "Run pnpm run tauri:build:dmg first." >&2
  exit 1
fi

hdiutil attach -readonly -nobrowse -mountpoint "$MOUNT_DIR" "$DMG_PATH" >/dev/null
MOUNTED=1

if [[ ! -d "$MOUNT_DIR/${PRODUCT_NAME}.app" ]]; then
  echo "App bundle missing inside DMG: $MOUNT_DIR/${PRODUCT_NAME}.app" >&2
  exit 1
fi

if [[ ! -L "$MOUNT_DIR/Applications" ]]; then
  echo "Applications link missing inside DMG" >&2
  exit 1
fi

ditto "$MOUNT_DIR/${PRODUCT_NAME}.app" "$INSTALL_DIR/${PRODUCT_NAME}.app"
codesign --verify --deep --strict --verbose=2 "$INSTALL_DIR/${PRODUCT_NAME}.app"

APP_BINARY="$INSTALL_DIR/${PRODUCT_NAME}.app/Contents/MacOS/md-html-reader"
APP_LOG="$(mktemp "${TMPDIR:-/tmp}/markdown-html-dmg-app.XXXXXX.log")"
"$APP_BINARY" >"$APP_LOG" 2>&1 &
APP_PID=$!

for _ in {1..20}; do
  if kill -0 "$APP_PID" 2>/dev/null; then
    echo "Launched $PRODUCT_NAME from copied DMG app with PID $APP_PID"
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
    APP_PID=""
    exit 0
  fi
  sleep 0.5
done

echo "App did not start from copied DMG app: $APP_BINARY" >&2
cat "$APP_LOG" >&2 || true
exit 1
