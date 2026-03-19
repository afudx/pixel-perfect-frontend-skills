---
name: verify-styles
description: Inspect computed CSS styles on page elements via Playwright and compare against design tokens. Use when pixel diff shows discrepancies and you need to identify exact property mismatches.
user-invocable: true
allowed-tools: Bash, Read
argument-hint: <dev-server-url> [css-selectors...]
---

Inspect computed styles and compare against design tokens.

URL: `$0`
Selectors (optional): remaining arguments

## Execution

Run the shared style inspection script via Playwright CLI:

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/inspect-styles.mjs $ARGUMENTS
```

This script:
1. Launches a headless Chromium browser via Playwright at 1440px viewport, DPR 1
2. Navigates to the URL
3. For each matching element, extracts:
   - **Typography:** font-family, font-size, font-weight, font-style, line-height, letter-spacing, text-transform, text-align, color
   - **Spacing:** padding (all sides), margin (all sides), gap
   - **Visual:** background-color, border-radius, border-width, border-color, box-shadow
   - **Layout:** display, max-width, width, height
   - **Position:** bounding rect (x, y, width, height)
4. Outputs JSON for all matched elements

## Default Targets

If no selectors given, inspects: h1-h6, p, button, a, img, section, header, footer, main, nav

## Comparing Against Design

After extracting computed styles from your implementation, compare them against the design reference:
1. Extract the same styles from the original design URL (if available)
2. Or compare against the design analysis document

Flag any value that doesn't match. Common mismatches:
- font-weight (500 vs 600)
- letter-spacing (often overlooked)
- padding asymmetry (top differs from bottom)
- border-radius (8px vs 12px)
- box-shadow layers

## Output

Prints JSON with all element styles grouped by selector. Compare visually or pipe through a diff tool.
