---
name: pixel-diff
description: Run pixel-level comparison between a design image and a browser screenshot using pixelmatch. Use to verify implementation accuracy.
user-invocable: true
allowed-tools: Bash, Read
argument-hint: <design.png> <screenshot-or-url> [--normalize] [--structural] [--exclude-phone-ui] [--has-notch] [--exclude-regions x,y,w,h] [--auto-crop-chrome]
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

## Excluding Non-Design Phone OS Elements

### `--exclude-phone-ui` ← **use this for all phone mockup designs**

Automatically detects and masks **all OS-level, non-design phone elements** in both the final and interim validation. Apply to every `/pixel-diff` and `/fix-loop` run when the reference is a phone mockup.

**What it masks:**

| Area | Elements ignored |
|------|-----------------|
| **Device bezel** | Physical frame, rounded corners, hardware buttons, speaker grilles |
| **Status bar** (top) | Clock / time, cellular signal bars, carrier name, 5G/LTE indicator, WiFi icon, battery icon + %, Bluetooth icon, GPS/location arrow, airplane mode, Do Not Disturb crescent, screen recording dot, personal hotspot, alarm icon, NFC indicator, VPN badge, rotation lock |
| **Home indicator** (bottom) | Home swipe bar, gesture safe-area padding |

Detection is automatic — the script scans row edge-density to find where OS chrome ends and app content begins.

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs \
  $(pwd)/reference/home.png \
  $(pwd)/.claude/tmp/screenshot.png \
  --normalize --exclude-phone-ui
```

### `--has-notch`

Additionally masks the notch or Dynamic Island (top-center cutout area). Use together with `--exclude-phone-ui` when the mockup shows a visible notch.

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs \
  $(pwd)/reference/home.png \
  $(pwd)/.claude/tmp/screenshot.png \
  --normalize --exclude-phone-ui --has-notch
```

### `--auto-crop-chrome`

Crop uniform-color borders (device bezel) only — does not mask status bar or home indicator. Already included when using `--exclude-phone-ui`, so use this separately only when you want bezel cropping without the full phone UI masking.

### `--exclude-regions x,y,w,h`

Mask a specific rectangular area manually. Repeat for multiple regions. Use for custom masking beyond what `--exclude-phone-ui` covers (e.g., real photo vs placeholder, dynamic ad banners).

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs \
  $(pwd)/reference/home.png \
  $(pwd)/.claude/tmp/screenshot.png \
  --normalize --exclude-phone-ui \
  --exclude-regions 10,200,280,280
```

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
