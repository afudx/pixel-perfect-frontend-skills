#!/bin/bash
set -e

echo "=== Installing pixel-perfect dependencies ==="

if [ ! -f package.json ]; then
  npm init -y --silent
fi

echo "[1/3] Installing core pixel tools (sharp, pixelmatch, pngjs, axe-core)..."
npm install --save-dev sharp pixelmatch pngjs axe-core 2>&1 | tail -3

echo "[2/3] Installing Playwright..."
npm install --save-dev playwright 2>&1 | tail -3

echo "[3/3] Installing Playwright Chromium browser..."
npx playwright install chromium 2>&1 | tail -3

echo ""
echo "=== Verifying installations ==="

node -e "require('sharp'); console.log('[OK] sharp')" 2>/dev/null || echo "[FAIL] sharp"
node -e "require('pixelmatch'); console.log('[OK] pixelmatch')" 2>/dev/null || echo "[FAIL] pixelmatch"
node -e "require('pngjs'); console.log('[OK] pngjs')" 2>/dev/null || echo "[FAIL] pngjs"
node -e "require('axe-core'); console.log('[OK] axe-core')" 2>/dev/null || echo "[FAIL] axe-core"
node -e "require('playwright'); console.log('[OK] playwright')" 2>/dev/null || echo "[FAIL] playwright"

# Verify browser binary exists
BROWSER_PATH=$(node -e "const { chromium } = require('playwright'); console.log(chromium.executablePath())" 2>/dev/null)
if [ -f "$BROWSER_PATH" ]; then
  echo "[OK] chromium browser at $BROWSER_PATH"
else
  echo "[WARN] chromium browser binary not found — run 'npx playwright install chromium'"
fi

echo ""
echo "=== All dependencies installed ==="
