---
name: pixel-diff
description: Run pixel-level comparison between a design image and a browser screenshot using pixelmatch. Use to verify implementation accuracy.
user-invocable: true
allowed-tools: Bash, Read
argument-hint: <design.png> <screenshot-or-url> [--normalize]
---

Run pixel comparison between two images, or capture a URL and compare.

## Usage

### Compare two local images:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs <design.png> <screenshot.png> [--normalize]
```

### Compare design against a live URL:
First capture the URL:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs <url> --output .claude/tmp/pixel-diff-screenshot.png --full-page --wait 3000
```
Then compare:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs <design.png> .claude/tmp/pixel-diff-screenshot.png [--normalize]
```

### Strict Mode (default)
Fails if dimensions differ. Correct mode for final verification.

### Normalized Mode (`--normalize`)
Resizes both to smaller dimension. Use only for rough checks during development.

## Interpreting Results

- **< 2%** — PASS. Review diff image for structural issues.
- **2–5%** — REVIEW. Open diff image, identify red areas, fix them.
- **> 5%** — FAIL. Re-examine layout, spacing, colors, typography.

## After Running

1. Read the diff image to identify problem areas (red pixels = mismatches)
2. If mismatch > 2%, use `/fix-loop` to iteratively fix deviations
3. If dimensions don't match in strict mode, fix the viewport/layout — don't fall back to normalize

## Region Comparison

For section-level analysis:
1. Take element-level screenshots via the shared screenshot script
2. Crop corresponding region from design:
```javascript
await sharp('design.png').extract({ left: x, top: y, width: w, height: h }).toFile('region.png')
```
3. Run compare on each region pair
