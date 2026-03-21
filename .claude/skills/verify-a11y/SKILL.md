---
name: verify-a11y
description: Run Flutter accessibility audit using code analysis and Maestro hierarchy inspection. Use as part of final verification before delivery.
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, mcp__maestro__inspect_view_hierarchy
argument-hint: <device-id>
---

# Verify Accessibility — Flutter Semantics Audit

Audit the Flutter app for accessibility compliance using code-level analysis and runtime hierarchy inspection.

## Step 1: Code-level audit

Run the Flutter a11y audit script (use `--compact` for reduced output):
```bash
node .claude/skills/_shared/scripts/flutter-a11y-audit.mjs --project-dir . --compact
```

This checks for:
- `Image` widgets without `semanticLabel`
- `GestureDetector` without `Semantics` wrapper
- `ExcludeSemantics` usage (potential red flag)
- `IconButton` without `tooltip`
- Light gray text colors that may have insufficient contrast

### Manual code checks

#### Image accessibility
```bash
rtk grep -rn "Image.network\|Image.asset\|Image.file" lib/ --include="*.dart"
```
Every `Image` widget must have a `semanticLabel` parameter describing the content for screen readers.

#### Custom tap targets
```bash
rtk grep -rn "GestureDetector(" lib/ --include="*.dart"
```
Each `GestureDetector` should be wrapped in `Semantics(label: '...', button: true, child: ...)` or use `InkWell` which has built-in semantics.

#### Heading semantics
```bash
rtk grep -rn "Semantics(" lib/ --include="*.dart" | grep "header: true"
```
Major heading text should be wrapped in `Semantics(header: true)` for screen reader navigation.

#### Form labels
```bash
rtk grep -rn "TextField\|TextFormField" lib/ --include="*.dart"
```
Every text field must have a `decoration` with `labelText` or `hintText` for accessibility.

## Step 2: Runtime hierarchy audit

```
mcp__maestro__inspect_view_hierarchy(device_id: "<device-id>")
```

From the hierarchy, check:

### Unnamed interactive elements
Find elements with `clickable=true` that have no `text` or `contentDescription`. These are invisible to screen readers.

### Touch target sizes
Find interactive elements with bounds width < 48 or height < 48 (dp). The minimum accessible touch target is 48×48dp per WCAG guidelines.

### Missing labels
Find input fields without associated labels or content descriptions.

## Step 3: Flutter analyze

Run Flutter's built-in analysis (use flutter-cli.sh for compressed output):
```bash
bash .claude/skills/_shared/scripts/flutter-cli.sh analyze
```

Check for accessibility-related lint warnings. Ensure the project has appropriate lint rules enabled in `analysis_options.yaml`.

## Step 4: Semantics tree structure

Verify the semantics tree is logical:
- Heading hierarchy: H1 before H2 before H3
- Reading order follows visual layout (top-to-bottom, left-to-right)
- Interactive elements are reachable via screen reader navigation
- Decorative elements are excluded from semantics tree

## Output

```
ACCESSIBILITY AUDIT
===================
Code Audit:
  [PASS/FAIL] Images have semanticLabel (N missing)
  [PASS/FAIL] GestureDetectors have Semantics (N missing)
  [PASS/FAIL] IconButtons have tooltip (N missing)
  [PASS/WARN] ExcludeSemantics usage (N instances — verify intentional)
  [PASS/WARN] Color contrast (N potential issues)

Runtime Audit:
  [PASS/FAIL] No unnamed interactive elements (N found)
  [PASS/FAIL] Touch targets ≥ 48×48dp (N too small)
  [PASS/FAIL] Input fields have labels

Flutter Analyze:
  [PASS/FAIL] Zero accessibility-related warnings

Summary:
  Critical: N
  Serious: N
  Moderate: N
  Minor: N
```
