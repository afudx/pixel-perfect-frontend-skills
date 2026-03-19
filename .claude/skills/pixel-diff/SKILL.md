---
name: pixel-diff
description: Run pixel-level comparison between a design image and a browser screenshot using pixelmatch. Use to verify implementation accuracy.
user-invocable: true
allowed-tools: Bash, Read
argument-hint: <design.png> <screenshot-or-url> [--normalize] [--structural]
---

Run pixel comparison between two images, or capture a URL and compare.

## Usage

### Compare two local images:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs <design.png> <screenshot.png> [--normalize] [--structural]
```

### Compare design against a live URL:

**Step 1 — Determine viewport size from design image.**

If the design is portrait (height > width × 1.2), it is a mobile design.
Read its exact dimensions and use them for the screenshot capture:
```bash
sips -g pixelWidth -g pixelHeight <design.png>
```
Then capture at those exact dimensions:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs <url> \
  --output .claude/tmp/pixel-diff-screenshot.png \
  --width <design-width> --height <design-height> \
  --full-page --wait 3000
```

For desktop designs (landscape/square), omit `--width`/`--height` to use the default 1440px viewport.

**Step 2 — Compare:**
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs \
  $(pwd)/<design.png> \
  $(pwd)/.claude/tmp/pixel-diff-screenshot.png \
  [--normalize] [--structural]
```

> **Always pass absolute paths** using `$(pwd)/` prefix. The script resolves paths
> from the calling shell's CWD, so relative paths work too — but absolute is safer.

---

## Modes

### Strict (default)
Fails if dimensions differ. Required for final delivery verification.

### `--normalize`
Resizes both to the smaller dimension before comparing. Use only for rough checks during development when dimensions aren't aligned yet.

### `--structural`
Converts both images to grayscale + binary threshold before comparing. This strips all color information and reduces each image to its layout skeleton (element boundaries and positioning).

**Use `--structural` when:**
- The implementation intentionally uses a different color theme than the design
- You want to verify layout/spacing/structure without color interfering
- A straight pixel-diff returns > 80% mismatch due to color differences alone

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs \
  $(pwd)/reference/design.png \
  $(pwd)/.claude/tmp/screenshot.png \
  --normalize --structural
```

---

## Interpreting Results

- **< 2%** — PASS. Review diff image for any structural issues.
- **2–5%** — REVIEW. Open diff image, identify red areas, fix them.
- **> 5%** — FAIL. Re-examine layout, spacing, colors, typography.

For `--structural` mode, apply stricter expectations: layout mismatches above 5% indicate real structural problems since color is already stripped.

---

## After Running

1. Read the diff image to identify problem areas (red pixels = mismatches)
2. If mismatch > 2%, use `/fix-loop` to iteratively fix deviations
3. If dimensions don't match in strict mode, fix the viewport/layout — don't fall back to normalize

---

## Region Comparison

For section-level analysis:
1. Take element-level screenshots via the shared screenshot script
2. Crop corresponding region from design:
```javascript
await sharp('design.png').extract({ left: x, top: y, width: w, height: h }).toFile('region.png')
```
3. Run compare on each region pair
