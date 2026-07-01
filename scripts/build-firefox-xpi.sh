#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FIREFOX_DIR="$ROOT_DIR/Chzzk-Badge-Moa-Chat-Firefox"

if [[ ! -d "$FIREFOX_DIR" ]]; then
  FIREFOX_DIR="$ROOT_DIR/chzzk-badge-moa-chat-firefox"
fi

if [[ ! -d "$FIREFOX_DIR" ]]; then
  echo "Firefox source directory not found." >&2
  exit 1
fi

DIST_DIR="$ROOT_DIR/dist"
mkdir -p "$DIST_DIR"

VERSION="$(
  ruby -rjson -e 'puts JSON.parse(File.read(ARGV[0]))["version"]' \
    "$FIREFOX_DIR/manifest.json"
)"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/chzzk-badge-moa-chat-firefox-build.XXXXXX")"
TEMP_XPI_DIR="$(mktemp -d "${TMPDIR:-/tmp}/chzzk-badge-moa-chat-firefox-package.XXXXXX")"
TEMP_XPI="$TEMP_XPI_DIR/package.xpi"
FINAL_XPI="$DIST_DIR/chzzk-badge-moa-chat-firefox-v${VERSION}.xpi"

cleanup() {
  rm -rf "$BUILD_DIR" "$TEMP_XPI_DIR"
}

trap cleanup EXIT

rsync -a \
  --exclude ".git" \
  --exclude ".claude" \
  --exclude ".DS_Store" \
  --exclude "._*" \
  --exclude "__MACOSX" \
  --exclude "*.xpi" \
  "$FIREFOX_DIR"/ "$BUILD_DIR"/

find "$BUILD_DIR" \( -name ".DS_Store" -o -name "._*" -o -name "*.xpi" \) -delete

(
  cd "$BUILD_DIR"
  zip -qr -X "$TEMP_XPI" . \
    -x "__MACOSX/*" "*.DS_Store" "._*" ".git/*" ".claude/*" "*.xpi"
)

cp "$TEMP_XPI" "$FINAL_XPI"

echo "Firefox XPI package created:"
echo "  $FINAL_XPI"
