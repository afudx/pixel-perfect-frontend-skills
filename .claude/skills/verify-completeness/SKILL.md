---
name: verify-completeness
description: Final completeness audit — check for missing elements, TODOs, truncated files, build errors, and image constraints. Use as the last verification step before delivery.
user-invocable: true
allowed-tools: Read, Bash, Grep, Glob, mcp__maestro__take_screenshot, mcp__maestro__inspect_view_hierarchy
argument-hint: [device-id]
---

# Verify Completeness — Final Flutter Audit

This is the LAST verification step before delivery. It checks that everything is present, complete, and working.

## 1. Visual completeness

Take a final screenshot and compare against the design:

```
mcp__maestro__take_screenshot(device_id: "<device-id>")
```

Read the screenshot with Vision. Check:
- Every element from the design is present in the implementation
- Text content matches the design **verbatim** — character for character
- No missing icons, badges, dividers, or decorative elements
- Layout order matches design (top-to-bottom, left-to-right)

If the design has multiple sections, scroll down and screenshot each section.

## 2. Code completeness — zero TODOs

```bash
rtk grep -rn "TODO\|FIXME\|HACK\|XXX\|VERIFY\|placeholder\|lorem" lib/ --include="*.dart" -i
```

Must return **zero matches**. Every file must be complete, no placeholders.

Also check for truncation patterns:
```bash
rtk grep -rn "\.\.\." lib/ --include="*.dart" | grep -v "\.\.\.," | grep -v "required"
```

No `// ...rest of code` or similar truncation markers.

## 3. File completeness — FSD structure

Verify all expected files exist:

```bash
ls lib/app/app.dart
ls lib/app/router/app_router.dart
ls lib/shared/theme/app_colors.dart
ls lib/shared/theme/app_typography.dart
ls lib/shared/theme/app_spacing.dart
ls lib/shared/theme/app_shadows.dart
ls lib/shared/theme/app_radii.dart
ls lib/shared/theme/app_theme.dart
ls lib/shared/lib/extensions.dart
ls lib/main.dart
```

Verify page files exist for each screen in the design:
```bash
find lib/pages -name "*.dart" -type f
```

Verify shared UI components exist:
```bash
find lib/shared/ui -name "*.dart" -type f
```

## 4. Build verification

### Flutter analyze (zero errors)
```bash
bash .claude/skills/_shared/scripts/flutter-cli.sh analyze
```

Must complete with zero errors. Warnings are acceptable but should be reviewed.

### Dart format check
```bash
bash .claude/skills/_shared/scripts/flutter-cli.sh format-check
```

All code must be properly formatted.

### Build check
```bash
bash .claude/skills/_shared/scripts/flutter-cli.sh build-ios
```

Or for Android:
```bash
bash .claude/skills/_shared/scripts/flutter-cli.sh build-apk
```

Must succeed without errors.

## 5. Image constraints

Every `Image` widget must have explicit sizing:

```bash
rtk grep -rn "Image.network\|Image.asset\|Image.file\|Image.memory" lib/ --include="*.dart"
```

For each Image widget, verify it has one of:
- Explicit `width` and `height` parameters
- Wrapped in `SizedBox` with dimensions
- Wrapped in `AspectRatio`
- Inside a `BoxConstraints`/`ConstrainedBox`

Images without explicit dimensions cause layout shifts.

## 6. Broken images

If the app uses `Image.network`, check that images load:

Use `mcp__maestro__inspect_view_hierarchy` and look for error widgets or missing image indicators.

Take a screenshot and visually inspect for Flutter's broken image placeholder (gray icon).

## 7. FSD import rule check

Verify no upward or same-layer cross-imports:

```bash
rtk grep -rn "import.*pages/\|import.*features/\|import.*widgets/\|import.*entities/" lib/shared/ --include="*.dart"
```

All should return zero matches (shared cannot import from layers above).

```bash
rtk grep -rn "import.*pages/\|import.*features/\|import.*widgets/" lib/entities/ --include="*.dart"
```

Entities cannot import from pages, features, or widgets.

## 8. Previous verification results

Confirm all prior verifications passed:
- `/pixel-diff` < 2% strict mode
- `/verify-styles` — no hardcoded values
- `/verify-interactive` — all states working
- `/verify-responsive` — all device sizes pass
- `/verify-a11y` — no critical/serious issues

## Output

```
COMPLETENESS AUDIT
==================
Visual:
  [PASS/FAIL] All design elements present
  [PASS/FAIL] Text matches verbatim

Code:
  [PASS/FAIL] Zero TODOs/FIXMEs/placeholders
  [PASS/FAIL] No truncated files
  [PASS/FAIL] FSD structure complete

Build:
  [PASS/FAIL] flutter analyze clean
  [PASS/FAIL] dart format clean
  [PASS/FAIL] Build succeeds

Assets:
  [PASS/FAIL] All images have explicit dimensions
  [PASS/FAIL] No broken images

Architecture:
  [PASS/FAIL] FSD import rules respected

Prior Verifications:
  [PASS/FAIL] Pixel diff < 2%
  [PASS/FAIL] Styles verified
  [PASS/FAIL] Interactive states verified
  [PASS/FAIL] Responsive verified
  [PASS/FAIL] Accessibility verified

RESULT: PASS / FAIL (N issues remaining)
```
