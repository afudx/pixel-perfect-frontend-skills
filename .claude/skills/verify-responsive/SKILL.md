---
name: verify-responsive
description: Test responsive behavior across multiple device sizes by taking screenshots on different simulators/emulators. Use after the primary device implementation passes pixel diff.
user-invocable: true
allowed-tools: Bash, Read, mcp__maestro__list_devices, mcp__maestro__start_device, mcp__maestro__launch_app, mcp__maestro__take_screenshot, mcp__maestro__inspect_view_hierarchy
argument-hint: [device-names...]
---

# Verify Responsive — Multi-Device Flutter Testing

Test the Flutter app across multiple device sizes to verify responsive behavior.

## Default test devices

If no specific devices requested, test on these:

| Device | Logical Size | Scale | Platform |
|--------|-------------|-------|----------|
| iPhone SE (3rd generation) | 375×667 | 2× | iOS |
| iPhone 15 | 393×852 | 3× | iOS |
| iPhone 15 Pro Max | 430×932 | 3× | iOS |
| iPad (10th generation) | 820×1180 | 2× | iOS |

For Android (if available):
| Pixel 7 | 412×915 | 2.625× | Android |

## Step 1: List available devices

```
mcp__maestro__list_devices()
```

Match available devices to the target list. Skip devices that aren't available.

## Step 2: For each target device

### 2a. Start the device

```
mcp__maestro__start_device(device_id: "<device-id>")
```

Or by platform:
```
mcp__maestro__start_device(platform: "ios")
```

Wait for the device to fully boot.

### 2b. Launch the app

```
mcp__maestro__launch_app(device_id: "<device-id>", appId: "<bundle-id>")
```

Wait 3-5 seconds for the app to render.

### 2c. Take screenshot

```
mcp__maestro__take_screenshot(device_id: "<device-id>")
```

Save to `.claude/tmp/responsive-<device-name>.png`.

### 2d. Inspect view hierarchy

```
mcp__maestro__inspect_view_hierarchy(device_id: "<device-id>")
```

## Step 3: Check for issues

For each device, verify:

### Hard errors (FAIL)
- **Overflow**: Flutter renders yellow/black diagonal stripes when content overflows its container. Look for these in the screenshot (bright yellow + black pattern at edges).
- **Elements outside viewport**: Check hierarchy bounds — if any element has x+width > screen_width or y+height > screen_height, it overflows.
- **Overlapping interactives**: Check if clickable elements overlap (bounds intersection > 100px²). This creates tap target conflicts.
- **Blank screen**: App crashes or doesn't render on this device size.

### Warnings (acceptable but note)
- **Tiny text**: Text smaller than 10dp may be hard to read on small devices.
- **Single-column stretch**: Content designed for phone looks too wide on tablet. May need adaptive layout.
- **Cut-off content**: Text truncation that hides important information.

### Visual checks (read screenshots)
- Layout stacks properly on smaller screens (Column instead of Row)
- Images maintain aspect ratio
- Spacing adjusts proportionally
- Navigation remains usable
- Touch targets remain at least 48×48dp
- Text remains readable

## Step 4: Overflow detection via screenshot analysis

Run the overflow detector on each screenshot:
```bash
node .claude/skills/_shared/scripts/flutter-responsive-test.mjs --check-overflow
```

This analyzes edge pixels for Flutter's yellow/black overflow pattern.

## Output

```
RESPONSIVE VERIFICATION
=======================
iPhone SE (375×667):
  [PASS/FAIL] No overflow
  [PASS/FAIL] No element clipping
  [PASS/WARN] Text sizes acceptable
  Screenshot: .claude/tmp/responsive-iphone-se.png

iPhone 15 (393×852):
  [PASS/FAIL] No overflow
  [PASS/FAIL] No element clipping
  Screenshot: .claude/tmp/responsive-iphone-15.png

iPad (820×1180):
  [PASS/FAIL] No overflow
  [PASS/WARN] Layout adapts to tablet width
  Screenshot: .claude/tmp/responsive-ipad.png

Summary: N devices tested, N passed, N failed
```
