---
name: pixel-diff
description: Run pixel-level comparison between a design image and a Flutter app screenshot using pixelmatch. Use to verify implementation accuracy.
user-invocable: true
allowed-tools: Bash, Read, mcp__maestro__take_screenshot
argument-hint: <design-image> <device-id-or-screenshot> [--normalize] [--exclude-phone-ui] [--has-notch] [--exclude-regions x,y,w,h]
---

# Pixel Diff — Flutter Screenshot Comparison

Compare a design image against a Flutter app screenshot captured from a simulator/emulator via Maestro.

## Step 1: Capture screenshot from device

Use Maestro MCP to capture the current app state:

```
mcp__maestro__take_screenshot(device_id: "<device-id>")
```

Save the resulting screenshot to `.claude/tmp/screenshot.png`.

Alternatively, if a screenshot path was provided as the second argument, use that directly.

Or use the standalone script:
```bash
node .claude/skills/_shared/scripts/flutter-screenshot.mjs --device-id <id> --output .claude/tmp/screenshot.png --wait 2000
```

## Step 2: Run comparison

```bash
node .claude/skills/_shared/scripts/compare.mjs <design-image> .claude/tmp/screenshot.png [flags]
```

### Comparison modes

- **Strict** (default): Fails if image dimensions differ. Use when design and screenshot are at identical resolution.
- `--normalize`: Resize both images to the smaller dimensions before comparing. **Use this when device screenshot resolution differs from design image** (e.g., 3× Retina screenshot vs 1× design).
- `--structural`: Convert to grayscale + binary threshold. Compares layout structure only, ignores colors.

### Phone UI masking (for simulator screenshots)

Simulator screenshots include the iOS status bar and home indicator. Use these flags to mask them:

- `--exclude-phone-ui`: Auto-detect and mask status bar + home indicator + bezel
- `--has-notch`: Additionally mask the notch/Dynamic Island area
- `--exclude-regions x,y,w,h`: Custom rectangular mask (repeatable)

**Always use `--exclude-phone-ui` when comparing against simulator screenshots** unless the design itself includes the status bar.

## Step 3: Read the diff

The script outputs:
- **Mismatch %**: Overall pixel mismatch percentage
- **6-quadrant breakdown**: Top-Left, Top-Right, Mid-Left, Mid-Right, Bot-Left, Bot-Right pixel counts
- **Diff image**: `.claude/tmp/diff.png` — red pixels indicate mismatches

Read the diff image with Vision to identify specific problem areas.

## Pass criteria

- **< 2%**: PASS — Implementation matches design
- **2-5%**: REVIEW — Minor deviations, inspect diff image
- **> 5%**: FAIL — Significant deviations, run `/fix-loop`

## DPR considerations

Flutter simulators render at device pixel ratio:
- iPhone SE: 2× (750×1334 physical for 375×667 logical)
- iPhone 15: 3× (1179×2556 physical for 393×852 logical)
- iPad: 2× (1640×2360 physical for 820×1180 logical)

If your design image is at logical (1×) resolution, always use `--normalize` to match dimensions.

## Output

```
Mismatch: X.XX%
Region breakdown:
  Top-Left: N px    Top-Right: N px
  Mid-Left: N px    Mid-Right: N px
  Bot-Left: N px    Bot-Right: N px
Diff image: .claude/tmp/diff.png
Result: PASS / REVIEW / FAIL
```
