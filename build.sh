#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="LearnIT"
MAC_ARCH="${MAC_ARCH:-arm64}"
WIN_ARCH="${WIN_ARCH:-x64}"
MAC_TARGET='@electron-forge/maker-dmg'
WIN_TARGET='@electron-forge/maker-squirrel'

log() {
  printf "%s\n" "$1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "❌ Missing dependency: $1. Please install it and re-run this script."
    exit 1
  fi
}

log "🛠️ Preparing ${APP_NAME} build environment..."
require_cmd "node"
require_cmd "npm"
require_cmd "python3"

if [ "${ALLOW_INSECURE_SSL:-0}" = "1" ]; then
  log "⚠️ ALLOW_INSECURE_SSL=1 detected — disabling Node TLS verification for downloads."
  export NODE_TLS_REJECT_UNAUTHORIZED=0
fi

if [ ! -d "node_modules" ]; then
  log "📦 Installing Node.js dependencies..."
  npm install
fi

PYTHON_BIN="python3"
if [ -n "${VIRTUAL_ENV:-}" ] && [ -x "${VIRTUAL_ENV}/bin/python3" ]; then
  log "🐍 Using active virtual environment at ${VIRTUAL_ENV}..."
  PYTHON_BIN="${VIRTUAL_ENV}/bin/python3"
elif [ -d "$SCRIPT_DIR/.venv" ] && [ -x "$SCRIPT_DIR/.venv/bin/python3" ]; then
  log "🐍 Using Python virtual environment at $SCRIPT_DIR/.venv..."
  PYTHON_BIN="$SCRIPT_DIR/.venv/bin/python3"
elif [ -d "$SCRIPT_DIR/../.venv" ] && [ -x "$SCRIPT_DIR/../.venv/bin/python3" ]; then
  log "🐍 Using Python virtual environment at $SCRIPT_DIR/../.venv..."
  PYTHON_BIN="$SCRIPT_DIR/../.venv/bin/python3"
fi

log "🔍 Ensuring Python backend dependencies (including PyInstaller)..."
pushd backend >/dev/null
$PYTHON_BIN -m pip install -r requirements.txt >/dev/null
popd >/dev/null

# Ensure PyInstaller executable is discoverable when invoked via npm scripts
PYTHON_BIN_DIR="$(dirname "$PYTHON_BIN")"
export PATH="$PYTHON_BIN_DIR:$PATH"

OUT_DIR="$SCRIPT_DIR/out"
mkdir -p "$OUT_DIR"

log "🍏 Building macOS DMG (arch: ${MAC_ARCH})..."
npm run make -- --platform=darwin --arch="${MAC_ARCH}" --targets="${MAC_TARGET}" || {
  log "⚠️ macOS build failed. See logs above for details." && exit 1
}

if command -v wine >/dev/null 2>&1; then
  log "🍷 Found Wine; Windows packaging will use it for Squirrel installer."
else
  log "⚠️ Wine not detected. Cross-compiling Windows installers on macOS may fail without it."
fi

log "🪟 Building Windows installer (arch: ${WIN_ARCH})..."
npm run make -- --platform=win32 --arch="${WIN_ARCH}" --targets="${WIN_TARGET}" || {
  log "⚠️ Windows build failed. See logs above for details." && exit 1
}

log "✅ Build complete!"
log "📦 Packages are available in: $OUT_DIR"
log "   macOS DMG:   $(find "$OUT_DIR" -name "*.dmg" -print0 | tr '\0' '\n')"
log "   Windows EXE: $(find "$OUT_DIR" -name "*.exe" -print0 | tr '\0' '\n')"
