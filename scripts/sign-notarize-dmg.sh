#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${DEVELOPER_ID_APPLICATION:-}" ]]; then
  echo "Missing DEVELOPER_ID_APPLICATION." >&2
  echo "Example: export DEVELOPER_ID_APPLICATION='Developer ID Application: Example, Inc. (TEAMID)'" >&2
  exit 2
fi

if [[ -z "${NOTARY_KEYCHAIN_PROFILE:-}" ]]; then
  echo "Missing NOTARY_KEYCHAIN_PROFILE." >&2
  echo "Create one with: xcrun notarytool store-credentials <profile-name>" >&2
  exit 2
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun is required for notarization." >&2
  exit 2
fi

if ! command -v security >/dev/null 2>&1; then
  echo "security is required to inspect signing identities." >&2
  exit 2
fi

if ! security find-identity -v -p codesigning | grep -F "$DEVELOPER_ID_APPLICATION" >/dev/null; then
  echo "Developer ID signing identity not found in keychain:" >&2
  echo "  $DEVELOPER_ID_APPLICATION" >&2
  security find-identity -v -p codesigning >&2 || true
  exit 2
fi

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
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/markdown-html-notarize.XXXXXX")"
NOTARY_TIMEOUT="${NOTARY_TIMEOUT:-30m}"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

pnpm run tauri:build

if [[ ! -d "$APP_PATH" ]]; then
  echo "Expected app bundle not found: $APP_PATH" >&2
  exit 1
fi

codesign --force --deep --options runtime --timestamp --sign "$DEVELOPER_ID_APPLICATION" "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

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

codesign --force --timestamp --sign "$DEVELOPER_ID_APPLICATION" "$DMG_PATH"
codesign --verify --verbose=2 "$DMG_PATH"

xcrun notarytool submit "$DMG_PATH" \
  --keychain-profile "$NOTARY_KEYCHAIN_PROFILE" \
  --wait \
  --timeout "$NOTARY_TIMEOUT"

xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG_PATH"

echo "Signed, notarized, and stapled $DMG_PATH"
