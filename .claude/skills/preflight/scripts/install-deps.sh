#!/bin/bash
set -e

echo "=== Installing pixel-perfect dependencies ==="

# Resolve the _shared directory relative to this script — always install there,
# never into the project root, so existing package.json / node_modules are untouched.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../../_shared" && pwd)"

echo "[INFO] Installing to $SHARED_DIR (isolated from project)"
mkdir -p "$SHARED_DIR"

# Initialise a package.json in _shared if one doesn't exist yet
if [ ! -f "$SHARED_DIR/package.json" ]; then
  echo '{"name":"pixel-perfect-skills-deps","private":true}' > "$SHARED_DIR/package.json"
fi

echo "[1/3] Installing core pixel tools (sharp, pixelmatch, pngjs, axe-core)..."
npm install --prefix "$SHARED_DIR" --save sharp pixelmatch pngjs axe-core 2>&1 | tail -3

echo "[2/3] Installing Playwright..."
npm install --prefix "$SHARED_DIR" --save playwright 2>&1 | tail -3

echo "[3/3] Installing Playwright Chromium browser..."
"$SHARED_DIR/node_modules/.bin/playwright" install chromium 2>&1 | tail -3

echo ""
echo "=== Verifying installations ==="

node -e "require('$SHARED_DIR/node_modules/sharp'); console.log('[OK] sharp')" 2>/dev/null || echo "[FAIL] sharp"
node -e "require('$SHARED_DIR/node_modules/pixelmatch'); console.log('[OK] pixelmatch')" 2>/dev/null || echo "[FAIL] pixelmatch"
node -e "require('$SHARED_DIR/node_modules/pngjs'); console.log('[OK] pngjs')" 2>/dev/null || echo "[FAIL] pngjs"
node -e "require('$SHARED_DIR/node_modules/axe-core'); console.log('[OK] axe-core')" 2>/dev/null || echo "[FAIL] axe-core"
node -e "require('$SHARED_DIR/node_modules/playwright'); console.log('[OK] playwright')" 2>/dev/null || echo "[FAIL] playwright"

BROWSER_PATH=$(node -e "const { chromium } = require('$SHARED_DIR/node_modules/playwright'); console.log(chromium.executablePath())" 2>/dev/null)
if [ -f "$BROWSER_PATH" ]; then
  echo "[OK] chromium browser at $BROWSER_PATH"
else
  echo "[WARN] chromium browser binary not found — rerun this script"
fi

echo ""
echo "=== Detecting project framework conflicts ==="

if [ -f "vite.config.js" ] || [ -f "vite.config.ts" ]; then
  # Distinguish React SPA (has src/App.tsx or src/main.tsx) from plain static Vite
  if [ -f "src/App.tsx" ] || [ -f "src/App.jsx" ] || [ -f "src/main.tsx" ] || [ -f "src/main.jsx" ]; then
    echo "[INFO] React SPA (Vite) detected — verify implementation via dev server URL, not index.html."
    echo "       Use screenshot.mjs against the running dev server for all comparisons."
  else
    echo "[WARN] Vite project detected — index.html belongs to Vite."
    echo "       Write clones to a standalone file (e.g. claude-2x.html), not index.html."
  fi
fi

if [ -f "next.config.js" ] || [ -f "next.config.ts" ] || [ -f "next.config.mjs" ]; then
  echo "[WARN] Next.js project detected — do not write to pages/ or app/ unless intended."
  echo "       Write clones to public/clone.html for static serving."
fi

if [ -f "angular.json" ]; then
  echo "[WARN] Angular project detected — write clones to src/assets/ or a standalone directory."
fi

echo ""
echo "=== All dependencies installed ==="
