#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
mkdir -p "$DIST_DIR"

VERSION="$(
  ruby -rjson -e 'puts JSON.parse(File.read(ARGV[0]))["version"]' \
    "$ROOT_DIR/manifest.json"
)"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/chzzk-badge-moa-chat-chrome-build.XXXXXX")"
TEMP_ZIP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/chzzk-badge-moa-chat-chrome-package.XXXXXX")"
TEMP_ZIP="$TEMP_ZIP_DIR/package.zip"
FINAL_ZIP="$DIST_DIR/chzzk-badge-moa-chat-v${VERSION}.zip"

cleanup() {
  rm -rf "$BUILD_DIR" "$TEMP_ZIP_DIR"
}

trap cleanup EXIT

copy_path() {
  local source="$1"
  local target="$BUILD_DIR/$1"
  mkdir -p "$(dirname "$target")"
  cp -R "$ROOT_DIR/$source" "$target"
}

copy_path "badge-popup"
copy_path "fonts"
copy_path "popup.html"
copy_path "popup.css"
copy_path "popup.js"
copy_path "manifest.json"
copy_path "background.js"
copy_path "badge-popup.css"
copy_path "inject.js"
copy_path "icon_128.png"
copy_path "icon_64.png"
copy_path "icon_48.png"
copy_path "icon_32.png"
copy_path "icon_16.png"

find "$BUILD_DIR" \( -name ".DS_Store" -o -name "._*" \) -delete

(
  cd "$BUILD_DIR"
  zip -qr -X "$TEMP_ZIP" . -x "__MACOSX/*" "*.DS_Store" "._*"
)

cp "$TEMP_ZIP" "$FINAL_ZIP"

echo "Chrome package created:"
echo "  $FINAL_ZIP"
