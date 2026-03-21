---
name: verify-interactive
description: Test tap feedback, focus, disabled, and long-press states on all interactive elements via Maestro. Use to verify interactive styling matches the design.
user-invocable: true
allowed-tools: Bash, Read, mcp__maestro__take_screenshot, mcp__maestro__tap_on, mcp__maestro__inspect_view_hierarchy, mcp__maestro__run_flow, mcp__maestro__input_text
argument-hint: <device-id> [element-text...]
---

# Verify Interactive States — Flutter via Maestro

Test interactive element states on the running Flutter app. Flutter mobile has **no hover states** — focus on tap feedback, focus states, disabled states, and long-press.

## Step 1: Get interactive elements

```
mcp__maestro__inspect_view_hierarchy(device_id: "<device-id>")
```

From the hierarchy, identify all interactive elements:
- Buttons (clickable=true)
- Text fields (input elements)
- Switches/checkboxes (checkable elements)
- Navigation items
- Cards with tap handlers
- Custom gesture detectors

## Step 2: Test tap feedback

For each interactive element:

1. **Screenshot before tap**:
   ```
   mcp__maestro__take_screenshot(device_id: "<device-id>")
   ```
   Save as `.claude/tmp/interactive-<name>-before.png`

2. **Tap the element**:
   ```
   mcp__maestro__tap_on(device_id: "<device-id>", text: "<element-text>")
   ```

3. **Screenshot during/after tap** (quickly, to catch ink splash):
   ```
   mcp__maestro__take_screenshot(device_id: "<device-id>")
   ```
   Save as `.claude/tmp/interactive-<name>-after.png`

4. **Compare** the before/after screenshots visually — look for:
   - InkWell/InkResponse splash animation
   - Color change on press
   - Elevation change (Material button press effect)
   - Scale animation

If no visible feedback: **[FAIL]** — the element needs InkWell, InkResponse, or a custom feedback mechanism.

## Step 3: Test focus states

For text input fields:

1. **Tap the text field**:
   ```
   mcp__maestro__tap_on(device_id: "<device-id>", text: "<placeholder-text>")
   ```

2. **Inspect hierarchy** to verify `focused=true`:
   ```
   mcp__maestro__inspect_view_hierarchy(device_id: "<device-id>")
   ```

3. **Screenshot** to verify visual focus indicator (underline color change, border highlight, label animation):
   ```
   mcp__maestro__take_screenshot(device_id: "<device-id>")
   ```

4. **Type text** to verify input works:
   ```
   mcp__maestro__input_text(device_id: "<device-id>", text: "Test input")
   ```

## Step 4: Test disabled states

From the hierarchy, find elements with `enabled=false`.

For each disabled element:
1. **Screenshot** to verify disabled appearance (reduced opacity, grayed out)
2. **Attempt tap** — verify it does NOT trigger navigation or action
3. Check that the element is visually distinct from enabled state

## Step 5: Test long-press (if applicable)

For elements that should have context menus, tooltips, or long-press actions:

```
mcp__maestro__run_flow(device_id: "<device-id>", flow_yaml: "---\n- longPressOn: \"<element-text>\"")
```

Screenshot after to verify the long-press response (tooltip, context menu, etc.).

## Step 6: Code verification

Check that interactive widgets use proper Flutter patterns:

```bash
rtk grep -rn "GestureDetector(" lib/ --include="*.dart"
```

GestureDetector should have `Semantics` wrapper. Prefer `InkWell` or `InkResponse` for Material tap feedback.

```bash
rtk grep -rn "InkWell\|InkResponse\|ElevatedButton\|TextButton\|IconButton\|OutlinedButton" lib/ --include="*.dart"
```

Verify interactive elements use Material widgets that provide built-in feedback.

## Output

```
INTERACTIVE VERIFICATION
========================
Tap Feedback:
  [PASS/FAIL] <element> — ink splash visible
  [PASS/FAIL] <element> — color change on press

Focus States:
  [PASS/FAIL] <input> — focus indicator visible
  [PASS/FAIL] <input> — keyboard appears

Disabled States:
  [PASS/FAIL] <element> — visually disabled
  [PASS/FAIL] <element> — tap does not trigger action

Long Press:
  [PASS/FAIL] <element> — tooltip/menu appears

Code Audit:
  [PASS/FAIL] No bare GestureDetector without Semantics
  [PASS/FAIL] Interactive widgets use Material feedback
```
