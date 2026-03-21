---
name: fix-loop
description: Iterative fix-and-reverify cycle — edit Dart code, hot reload, re-screenshot via Maestro, re-diff until pixel mismatch drops below 2%. Use after pixel-diff shows deviations.
user-invocable: true
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, mcp__maestro__take_screenshot, mcp__maestro__inspect_view_hierarchy
argument-hint: <design-image> <device-id>
---

# Fix Loop — Iterative Pixel-Perfect Correction for Flutter

Maximum 5 iterations. Edit Dart → hot reload → Maestro screenshot → pixel-diff → repeat.
If mismatch is not decreasing after 2 iterations, check Step 0 for comparison setup issues before continuing.

## Arguments

- `<design-image>`: Path to the reference design image
- `<device-id>`: Maestro device ID (from preflight)

## Step 0: Classify Mismatch

Before fixing, classify what's causing the mismatch. Read the diff image (`.claude/tmp/diff.png`) with Vision.

### Check for comparison setup issues first (uniform high mismatch >10%)

If ALL 6 quadrants show similar high mismatch (e.g., 10-15% everywhere), **stop** — this is a comparison setup problem, not a code problem. No amount of Dart edits will fix it.

**Symptom: diff shows two overlapping copies of every element (ghosting)**
→ Aspect ratio mismatch between design and screenshot. The `compare.mjs` output will show `[WARN] Aspect ratio mismatch`.
→ Fix: check that `--design-crop` and `--screenshot-crop` are correctly set. The screenshot must cover the same logical height as the design's content area.
→ Example for iPhone 16 @3× vs 390×940 design: `--screenshot-crop 0,147,1179,<height>` where height = 940×3 = 2820px. If the device is only 852pt tall, the design is taller than the device — you must either crop the design to 852pt or accept that the bottom section won't be compared.

**Symptom: diff is a solid red rectangle**
→ Wrong crop: `--auto-crop-chrome` applied design chrome bounds to screenshot too. Fix: use `--design-crop` and `--screenshot-crop` separately (see `/pixel-diff` for the phone mockup workflow).

**Symptom: app shows black/error screen in screenshot**
→ Impeller shader error (iOS 18+ simulator). Restart with `--no-enable-impeller`:
```bash
FLUTTER_EXTRA_FLAGS="--no-enable-impeller" bash .claude/skills/_shared/scripts/flutter-cli.sh run <device-id>
```

### Check for broken images

```bash
rtk grep -rn "Image.network" lib/ --include="*.dart"
```

Broken images show Flutter's gray broken-image icon. Verify via `mcp__maestro__inspect_view_hierarchy`.

### Classify each mismatched region

For each region with mismatch in the 6-quadrant breakdown, categorize:

| Category | Description | Fixable? |
|----------|-------------|----------|
| **Comparison setup** | AR mismatch, wrong crop, wrong flags | Fix comparison command, not code |
| **Device chrome** | Status bar, home indicator, notch | No — use `--exclude-phone-ui` |
| **Missing assets** | Placeholder vs real photo | No — requires correct image URL |
| **Layout shift** | Wrong padding, margin, alignment | Yes |
| **Color mismatch** | Wrong color in theme or widget | Yes |
| **Typography** | Wrong font, size, weight, spacing | Yes |
| **Border/radius** | Wrong border-radius or border | Yes |
| **Shadow** | Missing or wrong box-shadow | Yes |
| **Missing element** | Widget not implemented | Yes |

Calculate:
- **Non-fixable %** = device chrome + missing assets → subtract from total
- **Fixable %** = total mismatch - non-fixable
- If fixable < 2%, already within tolerance → PASS

## The Fix Loop (max 3 iterations)

### Step 1: Identify deviations

Read the diff image with Vision. For each red region:
1. Identify which widget is mismatched
2. Read the corresponding Dart file
3. Compare against design analysis tokens

Use `mcp__maestro__inspect_view_hierarchy` to get element bounds and verify positioning.

### Step 2: Fix the code

Edit the Dart files to correct deviations. Common fixes:

- **Wrong color**: Change hardcoded color to `AppColors.<token>` or fix the token value
- **Wrong padding**: Adjust `EdgeInsets` values to match design spacing
- **Wrong font**: Fix `GoogleFonts.<font>()` call, fontSize, fontWeight, height
- **Wrong radius**: Fix `BorderRadius.circular(<n>)` value
- **Wrong shadow**: Fix `BoxShadow` parameters (color, blur, offset, spread)
- **Missing widget**: Add the missing element from the design
- **Wrong alignment**: Fix `MainAxisAlignment`, `CrossAxisAlignment`, or `Alignment`

### Step 3: Hot reload

Flutter hot reloads automatically on file save when `flutter run` is active. Wait 2-3 seconds for the rebuild to complete.

If hot reload fails (structural change), hot restart:
```bash
# Press 'R' in the flutter run terminal, or:
# The running app will show a red error screen — restart is needed
```

### Step 4: Re-screenshot

```
mcp__maestro__take_screenshot(device_id: "<device-id>")
```

Save to `.claude/tmp/screenshot.png`.

### Step 5: Re-diff

Run the same comparison command from `/pixel-diff`, with the **same flags** used in the initial comparison:

```bash
node .claude/skills/_shared/scripts/compare.mjs <design-image> .claude/tmp/screenshot.png --normalize --exclude-phone-ui
```

### Step 6: Evaluate

- If < 2%: **PASS** — exit loop
- If improved but > 2%: Continue to next iteration
- If not improving: Reassess (see below)

## Reassessment Protocol

If mismatch is not decreasing after 3 iterations:

1. **Re-read the diff image** — are the remaining mismatches fixable?
2. **Check if the mismatch is from device chrome**: Use `--exclude-phone-ui` flag
3. **Check if the mismatch is from photos**: Design shows real photos but implementation uses placeholders. This is expected — classify as non-fixable.
4. **Rebuild the section**: If a section is consistently mismatched, consider rewriting it from scratch using the design analysis.

## Output per iteration

```
ITERATION N
===========
[CLASSIFY] Fixable: X.X% | Non-fixable: X.X% (chrome/assets)
[FIX]      Changed: file1.dart (color), file2.dart (padding)
[RELOAD]   Hot reload successful
[DIFF]     Mismatch: X.XX% (was X.XX%)
[STATUS]   PASS / CONTINUE / REASSESS
```
