#!/bin/bash
set -e

echo "=== Installing pixel-perfect Flutter dependencies ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../../_shared" && pwd)"

echo "[INFO] Installing to $SHARED_DIR (isolated from project)"
mkdir -p "$SHARED_DIR"

if [ ! -f "$SHARED_DIR/package.json" ]; then
  echo '{"name":"pixel-perfect-flutter-skills-deps","private":true}' > "$SHARED_DIR/package.json"
fi

echo "[1/2] Installing image processing tools (sharp, pixelmatch, pngjs)..."
if command -v rtk &>/dev/null; then
  rtk npm install --prefix "$SHARED_DIR" --save sharp pixelmatch pngjs
else
  npm install --prefix "$SHARED_DIR" --save sharp pixelmatch pngjs 2>&1 | tail -3
fi

echo "[2/2] Verifying Flutter toolchain..."

echo ""
echo "=== Verifying Node.js dependencies ==="

node -e "require('$SHARED_DIR/node_modules/sharp'); console.log('[OK] sharp')" 2>/dev/null || echo "[FAIL] sharp"
node -e "require('$SHARED_DIR/node_modules/pixelmatch'); console.log('[OK] pixelmatch')" 2>/dev/null || echo "[FAIL] pixelmatch"
node -e "require('$SHARED_DIR/node_modules/pngjs'); console.log('[OK] pngjs')" 2>/dev/null || echo "[FAIL] pngjs"

echo ""
echo "=== Verifying Flutter SDK ==="

if command -v flutter &>/dev/null; then
  FLUTTER_VERSION=$(flutter --version 2>&1 | head -1)
  echo "[OK] $FLUTTER_VERSION"
else
  echo "[FAIL] Flutter SDK not found. Install from https://docs.flutter.dev/get-started/install"
  exit 1
fi

if command -v dart &>/dev/null; then
  DART_VERSION=$(dart --version 2>&1)
  echo "[OK] $DART_VERSION"
else
  echo "[FAIL] Dart SDK not found (should be bundled with Flutter)"
  exit 1
fi

echo ""
echo "=== Verifying Maestro ==="

if command -v maestro &>/dev/null; then
  MAESTRO_VERSION=$(maestro --version 2>&1 | head -1)
  echo "[OK] Maestro CLI: $MAESTRO_VERSION"
else
  echo "[WARN] Maestro CLI not found. Install: curl -fsSL https://get.maestro.mobile.dev | bash"
  echo "       Maestro MCP tools are still available — CLI is optional for standalone script usage."
fi

echo ""
echo "=== Checking available devices ==="

if command -v xcrun &>/dev/null; then
  IOS_COUNT=$(xcrun simctl list devices available 2>/dev/null | grep -c "iPhone\|iPad" || true)
  echo "[INFO] iOS simulators available: $IOS_COUNT"
  if [ "$IOS_COUNT" -eq 0 ]; then
    echo "[WARN] No iOS simulators found. Open Xcode > Settings > Platforms to install."
  fi
else
  echo "[INFO] Xcode not found — iOS simulators unavailable."
fi

if command -v emulator &>/dev/null; then
  ANDROID_COUNT=$(emulator -list-avds 2>/dev/null | grep -c "." || true)
  echo "[INFO] Android emulators available: $ANDROID_COUNT"
  if [ "$ANDROID_COUNT" -eq 0 ]; then
    echo "[WARN] No Android emulators found. Create one via Android Studio > Device Manager."
  fi
elif [ -d "$ANDROID_HOME/emulator" ] || [ -d "$HOME/Library/Android/sdk/emulator" ]; then
  echo "[INFO] Android SDK found but emulator not in PATH."
else
  echo "[INFO] Android SDK not found — Android emulators unavailable."
fi

echo ""
echo "=== Detecting existing Flutter project ==="

if [ -f "pubspec.yaml" ]; then
  echo "[INFO] Existing Flutter project detected (pubspec.yaml found)."
  PROJ_NAME=$(grep -m1 '^name:' pubspec.yaml | awk '{print $2}' || echo "unknown")
  echo "       Project: $PROJ_NAME"
else
  echo "[INFO] No pubspec.yaml found — setup-project will scaffold a new Flutter project."
fi

echo ""
echo "=== All dependencies installed ==="
