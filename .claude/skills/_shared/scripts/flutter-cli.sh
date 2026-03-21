#!/bin/bash
# flutter-cli.sh — Token-optimized wrapper for Flutter/Dart CLI commands.
# Filters verbose output to essential information only.
#
# Usage:
#   bash flutter-cli.sh analyze          # Filtered flutter analyze
#   bash flutter-cli.sh build-ios        # Filtered flutter build ios --debug --simulator
#   bash flutter-cli.sh build-apk        # Filtered flutter build apk --debug
#   bash flutter-cli.sh pub-get          # Filtered flutter pub get
#   bash flutter-cli.sh format-check     # Filtered dart format --set-exit-if-changed
#   bash flutter-cli.sh run <device-id>  # Filtered flutter run
#   bash flutter-cli.sh doctor           # Filtered flutter doctor
#   bash flutter-cli.sh version          # Compact version info

set -euo pipefail

CMD="${1:-help}"
shift 2>/dev/null || true

case "$CMD" in
  analyze)
    # flutter analyze: extract only errors and warnings, skip info lines
    OUTPUT=$(flutter analyze 2>&1) || true
    ERRORS=$(echo "$OUTPUT" | grep -c "error •" 2>/dev/null || echo "0")
    WARNINGS=$(echo "$OUTPUT" | grep -c "warning •" 2>/dev/null || echo "0")

    if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
      echo "[PASS] flutter analyze: 0 errors, 0 warnings"
    else
      echo "[RESULT] flutter analyze: $ERRORS errors, $WARNINGS warnings"
      # Show only errors (not info/context lines)
      echo "$OUTPUT" | grep "error •" | head -20
      if [ "$WARNINGS" -gt 0 ]; then
        echo "---"
        echo "$OUTPUT" | grep "warning •" | head -10
      fi
      if [ "$ERRORS" -gt 0 ]; then
        exit 1
      fi
    fi
    ;;

  build-ios)
    # flutter build ios: show only result line
    OUTPUT=$(flutter build ios --debug --simulator --no-codesign "$@" 2>&1) || EXIT=$?
    if [ "${EXIT:-0}" -eq 0 ]; then
      echo "[PASS] iOS build succeeded"
      echo "$OUTPUT" | grep -i "built\|success" | tail -2
    else
      echo "[FAIL] iOS build failed"
      echo "$OUTPUT" | grep -i "error\|failed\|exception" | head -10
      exit 1
    fi
    ;;

  build-apk)
    OUTPUT=$(flutter build apk --debug "$@" 2>&1) || EXIT=$?
    if [ "${EXIT:-0}" -eq 0 ]; then
      echo "[PASS] APK build succeeded"
      echo "$OUTPUT" | grep -i "built\|success\|\.apk" | tail -2
    else
      echo "[FAIL] APK build failed"
      echo "$OUTPUT" | grep -i "error\|failed\|exception" | head -10
      exit 1
    fi
    ;;

  pub-get)
    OUTPUT=$(flutter pub get 2>&1) || EXIT=$?
    CHANGED=$(echo "$OUTPUT" | grep -c "Changed\|Resolving\|Got" 2>/dev/null || echo "0")
    if [ "${EXIT:-0}" -eq 0 ]; then
      echo "[PASS] flutter pub get ($CHANGED packages resolved)"
    else
      echo "[FAIL] flutter pub get failed"
      echo "$OUTPUT" | grep -i "error\|could not\|conflict" | head -5
      exit 1
    fi
    ;;

  format-check)
    OUTPUT=$(dart format --set-exit-if-changed lib/ 2>&1) || EXIT=$?
    CHANGED=$(echo "$OUTPUT" | grep -c "Changed" 2>/dev/null || echo "0")
    if [ "${EXIT:-0}" -eq 0 ]; then
      echo "[PASS] dart format: all files formatted"
    else
      echo "[FAIL] dart format: $CHANGED files need formatting"
      echo "$OUTPUT" | grep "Changed" | head -10
      exit 1
    fi
    ;;

  run)
    DEVICE_ID="${1:-}"
    DEVICE_FLAG=""
    if [ -n "$DEVICE_ID" ]; then
      DEVICE_FLAG="-d $DEVICE_ID"
    fi
    echo "[INFO] Starting flutter run $DEVICE_FLAG (background)..."
    flutter run $DEVICE_FLAG 2>&1 &
    FLUTTER_PID=$!
    # Wait for compilation, then return
    sleep 10
    if kill -0 $FLUTTER_PID 2>/dev/null; then
      echo "[PASS] Flutter app running (PID: $FLUTTER_PID)"
    else
      echo "[FAIL] Flutter app crashed during startup"
      exit 1
    fi
    ;;

  doctor)
    OUTPUT=$(flutter doctor 2>&1)
    echo "$OUTPUT" | grep -E "^\[|Doctor summary" | head -15
    ;;

  version)
    FLUTTER_V=$(flutter --version 2>&1 | head -1)
    DART_V=$(dart --version 2>&1 | head -1)
    echo "Flutter: $FLUTTER_V"
    echo "Dart: $DART_V"
    ;;

  help|*)
    echo "flutter-cli.sh — Token-optimized Flutter CLI wrapper"
    echo ""
    echo "Commands:"
    echo "  analyze        Filtered flutter analyze (errors/warnings only)"
    echo "  build-ios      Filtered flutter build ios --debug --simulator"
    echo "  build-apk      Filtered flutter build apk --debug"
    echo "  pub-get        Filtered flutter pub get"
    echo "  format-check   Filtered dart format --set-exit-if-changed"
    echo "  run [device]   Start flutter run in background"
    echo "  doctor         Compact flutter doctor"
    echo "  version        Compact version info"
    ;;
esac
