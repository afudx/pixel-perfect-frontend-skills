---
name: analyze-design
description: Perform thorough design analysis of a provided image — extract colors, typography, spacing, layout, component inventory, and DOM decomposition. Use BEFORE writing any component code.
user-invocable: true
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [design-image-path-or-url]
---

Analyze the design image at `$ARGUMENTS`. This must complete BEFORE any component code is written.

If the argument is a URL instead of a local file path, first capture it:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs $ARGUMENTS \
  --output .claude/tmp/design-full.png --full-page \
  --extract-text --extract-styles --extract-measurements \
  --wait 5000
```

This gives you: a full-page screenshot, all text content, all computed styles (colors, fonts, sizes), all element measurements, all images, and all links.

## Analysis Checklist

Study the design image using Vision AND the extracted data. Document every item below.

### Colors
- Page background, section backgrounds, card backgrounds
- Heading text, body text, muted/secondary text, link color
- Border colors, divider colors
- Button backgrounds for every variant (primary, secondary, outline, ghost)
- Badge/tag background and text colors
- Gradient directions and color stops with positions
- Overlay opacity values
- Hover state colors if visible

### Typography
- Font family — study letterforms carefully (Inter ≠ Roboto, DM Sans ≠ Plus Jakarta Sans)
- Every distinct font size in pixels
- Font weights (400, 500, 600, 700, etc.)
- Line heights per text style
- Letter spacing (tight, normal, wide)
- Text transforms (uppercase, capitalize, none)

### Spacing
- Page container max-width and horizontal padding
- Vertical space between major sections
- Card internal padding (all four sides independently)
- Gap between grid/list items
- Space between heading and paragraph
- Grid base unit (4px or 8px)

### Borders & Radius
- Border widths and colors per element
- Border radius per element type (buttons, cards, inputs, avatars, badges)

### Shadows
- Per-element shadows: offset-x, offset-y, blur, spread, color with opacity
- Multi-layer shadows

### Layout
- Total page width and visible viewport height
- Grid columns and gutter width
- Header height and position (fixed/sticky/static)
- Content area width constraints
- Above-the-fold boundary

### Icons
- Style: outline, filled, or duotone
- Library: Lucide, Heroicons, Phosphor, Feather
- Sizes and stroke weight

### Text Content
Read every word verbatim: headings, paragraphs, buttons, nav items, placeholders. Do not paraphrase.

### Component Inventory
List every unique UI component: nav, buttons (with variants), inputs, cards, badges, avatars, tables, lists, dividers, alerts, dropdowns, modals, progress indicators, tooltips, decorative elements.

For repeating patterns (e.g., 3 feature cards), note exact count and content of each instance.

### Layout Decomposition
Break into a hierarchical DOM tree:
```
Page wrapper → Header → Sections (top-to-bottom) → Footer
Within each section: Container → Grid/Flex → Components
```

## Color Verification

After visual analysis, verify colors with precise sampling:

Sample specific coordinates:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/extract-color.mjs <design-image> <x,y coordinates of key regions>
```

Extract full palette:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/sample-palette.mjs <design-image> --top 30
```

## Precise Measurements (for URL-based designs)

If the source is a live website, extract exact computed measurements:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/inspect-styles.mjs <url> h1 h2 h3 button img footer header
```

This gives you font-family, font-size, font-weight, line-height, letter-spacing, padding, margin, gap, border-radius, box-shadow, background-color, and element rects for every matched element.

## Output

Write the complete analysis as a structured document. This becomes the reference for all subsequent build work.
