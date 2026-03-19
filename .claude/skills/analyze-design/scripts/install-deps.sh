#!/bin/bash
# Delegate to shared preflight installer
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PREFLIGHT_INSTALLER="$SCRIPT_DIR/../../preflight/scripts/install-deps.sh"
if [ -f "$PREFLIGHT_INSTALLER" ]; then
  bash "$PREFLIGHT_INSTALLER"
else
  echo "Preflight installer not found. Run /preflight first."
  exit 1
fi
