---
name: pixel-diff
description: Run pixel-level comparison between a design image and a browser screenshot using pixelmatch. Use to verify implementation accuracy.
user-invocable: true
allowed-tools: Bash, Read
argument-hint: <design.png> <screenshot-or-url> [--normalize] [--structural] [--exclude-regions x,y,w,h] [--auto-crop-chrome]
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

## Region Masking

### `--exclude-regions x,y,w,h`
Mask a rectangular region before comparing. Repeat for multiple regions.

**Use when:**
- The design includes a phone chrome/device frame that the implementation doesn't have
- A known area differs by design (e.g., dynamic timestamp in status bar)
- Real photos in design vs color placeholders in implementation

```bash
# Mask top status bar and bottom chrome
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs \
  $(pwd)/reference/home.png \
  $(pwd)/.claude/tmp/screenshot.png \
  --normalize \
  --exclude-regions 0,0,584,60 \
  --exclude-regions 0,1108,584,60
```

### `--auto-crop-chrome`
Automatically detect and crop uniform-color borders (device frame / phone chrome) from both images before comparing. Scans each edge inward until pixel variance increases, cropping up to 15% from each side.

**Use when:**
- The design image is a phone mockup with a visible device frame
- You want accurate mismatch % without manually calculating crop coordinates

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs \
  $(pwd)/reference/home.png \
  $(pwd)/.claude/tmp/screenshot.png \
  --normalize --auto-crop-chrome
```

> **Note:** `--auto-crop-chrome` crops the screenshot too. Make sure the screenshot uses the same viewport as the design's content area (not the full mockup size).

---

## Interpreting Results

- **< 2%** — PASS. Review diff image for any structural issues.
- **2–5%** — REVIEW. Open diff image, identify red areas, fix them.
- **> 5%** — FAIL. Re-examine layout, spacing, colors, typography.

For `--structural` mode, apply stricter expectations: layout mismatches above 5% indicate real structural problems since color is already stripped.

The script also outputs a **6-quadrant region breakdown** (Top/Mid/Bot × Left/Right). Use this to locate which part of the page has the highest mismatch before looking at the diff image.

---

## Device Mockup vs App Screenshot

When the reference design is a **phone mockup** (design inside a device frame):

1. **Preferred**: Use `--auto-crop-chrome` to strip the frame automatically.
2. **Alternative**: Use `--exclude-regions` to mask the frame areas precisely.
3. **Manual**: Measure the content area bounds with `sips` + Vision and set `--width`/`--height` accordingly for the screenshot.

When the reference is a **bare app screenshot** (no device frame): no special handling needed.

---

## After Running

1. Read the diff image to identify problem areas (red pixels = mismatches)
2. Use the region breakdown to focus on highest-mismatch quadrants first
3. If mismatch > 2%, use `/fix-loop` to iteratively fix deviations
4. If dimensions don't match in strict mode, fix the viewport/layout — don't fall back to normalize

---

## Region Comparison

For section-level analysis:
1. Take element-level screenshots via the shared screenshot script
2. Crop corresponding region from design:
```javascript
await sharp('design.png').extract({ left: x, top: y, width: w, height: h }).toFile('region.png')
```
3. Run compare on each region pair
