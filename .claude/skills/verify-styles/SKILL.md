---
name: verify-styles
description: Verify Flutter widget styles match design tokens by inspecting code and Maestro view hierarchy. Use when pixel diff shows discrepancies and you need to identify exact property mismatches.
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, mcp__maestro__inspect_view_hierarchy
argument-hint: <device-id> [widget-keys...]
---

# Verify Styles — Flutter Widget Property Inspection

Unlike web CSS where `getComputedStyle()` returns exact values, Flutter widget properties are not directly inspectable at runtime without custom test harnesses. This skill uses a three-pronged approach:

1. **Code-level inspection** — grep for hardcoded values that should use theme tokens
2. **Maestro view hierarchy** — verify element bounds, sizes, and positions
3. **Pixel-diff as authority** — visual comparison is the ultimate truth

## Step 1: Code-level style audit

Use `rtk grep` for all searches (75% token reduction). For semantic analysis of symbol usage patterns, use Serena MCP `find_symbol` and `find_referencing_symbols` as a complement.

### Check for hardcoded colors (should use AppColors)

```bash
rtk grep -rn "Color(0x" lib/ --include="*.dart" | grep -v "app_colors.dart" | grep -v "app_theme.dart" | grep -v "app_shadows.dart"
```

```bash
rtk grep -rn "Colors\." lib/ --include="*.dart" | grep -v "app_colors.dart" | grep -v "app_theme.dart"
```

Every color in widget code should reference `AppColors.<token>` or `Theme.of(context).colorScheme.<property>`. Hardcoded `Color(0xFF...)` or `Colors.blue` in widget files is a violation.

### Check for hardcoded font sizes (should use AppTypography)

```bash
rtk grep -rn "fontSize:" lib/ --include="*.dart" | grep -v "app_typography.dart"
```

Font sizes should come from `AppTypography.<style>` or `Theme.of(context).textTheme.<style>`.

### Check for hardcoded padding/margin (should use AppSpacing)

```bash
rtk grep -rn "EdgeInsets\." lib/ --include="*.dart" | grep -v "app_spacing.dart"
```

Review each match. Small, isolated padding (e.g., `EdgeInsets.all(2)` for icon alignment) is acceptable. Section-level spacing should use `AppSpacing.<token>`.

### Check for hardcoded border radius (should use AppRadii)

```bash
rtk grep -rn "BorderRadius\." lib/ --include="*.dart" | grep -v "app_radii.dart"
```

### Check for hardcoded shadows (should use AppShadows)

```bash
rtk grep -rn "BoxShadow(" lib/ --include="*.dart" | grep -v "app_shadows.dart"
```

## Step 2: Maestro view hierarchy inspection

Use Maestro MCP to inspect the widget tree:

```
mcp__maestro__inspect_view_hierarchy(device_id: "<device-id>")
```

From the hierarchy, verify:
- **Element bounds** match expected positions from the design
- **Element sizes** match expected dimensions
- **Text content** matches design verbatim
- **Interactive states** (clickable, enabled) are correct
- **Element hierarchy** matches expected widget nesting

For specific widgets, compare their bounds against the design analysis:
- Header height
- Card dimensions
- Button sizes
- Image aspect ratios
- Section spacing (gap between elements = element2.y - element1.y - element1.height)

## Step 3: Cross-reference with design tokens

Compare findings against the theme files:

1. Read `lib/shared/theme/app_colors.dart` — all colors match design?
2. Read `lib/shared/theme/app_typography.dart` — all text styles match?
3. Read `lib/shared/theme/app_spacing.dart` — all spacing values match?
4. Read `lib/shared/theme/app_shadows.dart` — all shadows match?
5. Read `lib/shared/theme/app_radii.dart` — all radii match?

Flag any token that doesn't match the design analysis values.

## Output

```
STYLE VERIFICATION
==================
Code Audit:
  [PASS/FAIL] No hardcoded colors (N violations)
  [PASS/FAIL] No hardcoded font sizes (N violations)
  [PASS/FAIL] No hardcoded spacing (N violations)
  [PASS/FAIL] No hardcoded radii (N violations)
  [PASS/FAIL] No hardcoded shadows (N violations)

Hierarchy Check:
  [PASS/FAIL] Element bounds match design
  [PASS/FAIL] Text content matches verbatim
  [PASS/FAIL] Interactive states correct

Token Accuracy:
  [PASS/FAIL] Colors match design analysis
  [PASS/FAIL] Typography matches design analysis
  [PASS/FAIL] Spacing matches design analysis
```
