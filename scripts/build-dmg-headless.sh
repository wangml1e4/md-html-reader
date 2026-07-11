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

APP_PATH="src-tauri/target/release/bundle/macos/${PRODUCT_NAME}.app"
DMG_DIR="src-tauri/target/release/bundle/dmg"
DMG_PATH="${DMG_DIR}/${PRODUCT_NAME}_${VERSION}_${TAURI_ARCH}.dmg"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/markdown-html-dmg.XXXXXX")"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

pnpm run tauri:build

if [[ ! -d "$APP_PATH" ]]; then
  echo "Expected app bundle not found: $APP_PATH" >&2
  exit 1
fi

codesign --force --deep --sign - "$APP_PATH"

mkdir -p "$DMG_DIR"
ditto "$APP_PATH" "$STAGING_DIR/${PRODUCT_NAME}.app"
ln -s /Applications "$STAGING_DIR/Applications"
rm -f "$DMG_PATH"

hdiutil create \
  -volname "$PRODUCT_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

hdiutil imageinfo "$DMG_PATH" >/dev/null
echo "Created $DMG_PATH"
