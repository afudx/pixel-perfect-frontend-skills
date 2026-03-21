---
name: pixel-diff
description: Run pixel-level comparison between a design image and a Flutter app screenshot using pixelmatch. Use to verify implementation accuracy.
user-invocable: true
allowed-tools: Bash, Read, mcp__maestro__take_screenshot
argument-hint: <design-image> <device-id-or-screenshot> [--normalize] [--exclude-phone-ui] [--has-notch] [--design-crop x,y,w,h] [--screenshot-crop x,y,w,h] [--exclude-regions x,y,w,h]
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

## Step 2: Determine the correct comparison strategy

Before running the comparison, identify which scenario applies:

### Scenario A — Bare design screenshot (no phone frame)
Design is already at app content resolution (no device chrome).

```bash
node .claude/skills/_shared/scripts/compare.mjs <design> .claude/tmp/screenshot.png --normalize --exclude-phone-ui
```

### Scenario B — Phone mockup design + simulator screenshot (most common)

**CRITICAL**: The design mockup and the simulator screenshot have different resolutions AND different chrome sizes. You MUST use `--design-crop` and `--screenshot-crop` separately — do NOT use `--auto-crop-chrome` alone as it applies the same crop rect to both images, causing systematic layout shift.

1. Find the design content area (use `/extract-colors` or Vision to measure phone frame insets):
   ```bash
   node .claude/skills/_shared/scripts/extract-color.mjs <design> 5,5 <W-5>,5 5,<H-5> <W-5>,<H-5>
   ```
   Sample the content boundary: e.g., `left=134, top=192, width=625, height=1232`

2. Find the simulator status bar height (in physical pixels):
   - iPhone 16 @3×: status bar ≈ 147px physical, home indicator ≈ 147px physical at bottom
   - iPhone 15 @3×: status bar ≈ 141px physical
   - iPhone SE @2×: status bar ≈ 40px physical

3. Run with explicit separate crops:
   ```bash
   node .claude/skills/_shared/scripts/compare.mjs <design> .claude/tmp/screenshot.png \
     --design-crop 134,192,625,1232 \
     --screenshot-crop 0,147,1179,2262 \
     --normalize --exclude-phone-ui
   ```

### Scenario C — Same-resolution bare screenshots (strict mode)
Design and screenshot are at identical logical resolution:

```bash
node .claude/skills/_shared/scripts/compare.mjs <design> .claude/tmp/screenshot.png --exclude-phone-ui
```

## Step 3: Run comparison — all available flags

```bash
node .claude/skills/_shared/scripts/compare.mjs <design-image> .claude/tmp/screenshot.png [flags]
```

| Flag | Description |
|------|-------------|
| `--normalize` | Resize both to smaller dimensions before comparing (use when resolutions differ) |
| `--structural` | Grayscale + threshold — layout structure only, ignores colors |
| `--design-crop x,y,w,h` | Crop design to content area (for phone mockups). Replaces `--auto-crop-chrome` |
| `--screenshot-crop x,y,w,h` | Crop screenshot to app content area (excludes simulator OS chrome) |
| `--exclude-phone-ui` | After resize, mask status bar and home indicator by edge-density detection |
| `--has-notch` | Also mask notch/Dynamic Island center strip |
| `--auto-crop-chrome` | Auto-detect design bezel (design only). Use only when design == screenshot resolution |
| `--exclude-regions x,y,w,h` | Mask specific regions (repeatable) |

## Step 4: Read the diff

The script outputs:
- **Mismatch %**: Overall pixel mismatch percentage
- **6-quadrant breakdown**: Top-Left, Top-Right, Mid-Left, Mid-Right, Bot-Left, Bot-Right pixel counts
- **Diff image**: `.claude/tmp/screenshot-diff.png` — red pixels indicate mismatches

Read the diff image with Vision to identify specific problem areas.

## Pass criteria

- **< 2%**: PASS — Implementation matches design
- **2-5%**: REVIEW — Minor deviations, inspect diff image
- **> 5%**: FAIL — Significant deviations, run `/fix-loop`

## Diagnosing uniform high mismatch (>10% across all quadrants)

If ALL 6 quadrants show similar high mismatch (e.g., 10-15% everywhere), the cause is almost always one of:

1. **Aspect ratio mismatch** — design is taller/shorter than device. The comparison will show two overlapping copies of text/elements. `compare.mjs --normalize` will emit a `[WARN] Aspect ratio mismatch` message. Fix: use `--screenshot-crop` to trim the screenshot to match the design's AR.

2. **Wrong crop parameters** — using `--auto-crop-chrome` without explicit `--screenshot-crop` means the design's phone frame inset is applied to the screenshot too. Fix: use `--design-crop` and `--screenshot-crop` separately.

3. **App not running** — screenshot is blank or shows error screen. Check `mcp__maestro__take_screenshot` result.

## DPR reference table

| Device | DPR | Physical | Logical | Status bar (physical) |
|--------|-----|----------|---------|----------------------|
| iPhone SE | 2× | 750×1334 | 375×667 | ~80px |
| iPhone 15 | 3× | 1179×2556 | 393×852 | ~141px |
| iPhone 16 | 3× | 1179×2556 | 393×852 | ~147px |
| iPad Air | 2× | 1640×2360 | 820×1180 | ~96px |

Always use `--normalize` when design logical resolution ≠ simulator physical resolution.
