---
name: analyze-design
description: Perform thorough design analysis of a provided image — extract colors, typography, spacing, layout, component inventory, and widget tree decomposition. Use BEFORE writing any component code.
user-invocable: true
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [design-image-path-or-url]
---

Analyze the design image at `$ARGUMENTS`. This must complete BEFORE any component code is written.

If the argument is a URL instead of a local file path, take a screenshot using Maestro on a running device (`mcp__maestro__take_screenshot`) or use the Playwright MCP tools as a fallback for web URLs.

## Pre-Analysis: Device Frame Detection

Before extracting design tokens, determine if the image is a phone mockup or a bare screenshot.

Sample the 4 corners to detect device chrome:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/extract-color.mjs <design.png> 5,5 <w-5>,5 5,<h-5> <w-5>,<h-5>
```

If corners are similar dark/gray colors → **phone mockup**. The actual app content is inset.

To find the content boundary, sample the edge centers:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/extract-color.mjs <design.png> --region 0,0,<w>,30 --region 0,<h-30>,<w>,30
```

**If phone mockup detected:**
- Report the content inset (chrome thickness on each edge)
- Use `--region` mode to sample colors only from the content area, not the chrome
- Note the actual content dimensions for viewport configuration in `/setup-project`
- When running `/pixel-diff`, use `--exclude-phone-ui` or `--exclude-regions` for the chrome area

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
- Active/pressed state colors if visible

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
- Library mapping: Lucide → Flutter Icons / Material Icons / Cupertino Icons / custom SVG
- Sizes and stroke weight

### Text Content
Read every word verbatim: headings, paragraphs, buttons, nav items, placeholders. Do not paraphrase.

### Component Inventory
List every unique UI component: nav, buttons (with variants), inputs, cards, badges, avatars, tables, lists, dividers, alerts, dropdowns, modals, progress indicators, tooltips, decorative elements.

For repeating patterns (e.g., 3 feature cards), note exact count and content of each instance.

### Widget Tree Decomposition
Break into a hierarchical Flutter widget tree:
```
Scaffold → AppBar → Body (Column/ListView) → Sections (top-to-bottom) → BottomNavigationBar
Within each section: Container/Padding → Row/Column/Wrap/GridView → Widgets
```

### FSD Layer Assignment
For each component in the inventory, assign it to an FSD layer:
- `shared/ui/` — Design system atoms: buttons, inputs, cards, badges, avatars, dividers
- `entities/*/ui/` — Business object displays: UserCard, ProductTile, etc.
- `features/*/ui/` — Interactive features: SearchBar, AuthForm, etc. (only if reused)
- `widgets/*/ui/` — Composed reusable blocks: AppHeader, Sidebar (only if reused cross-page)
- `pages/*/ui/` — Full screen compositions

**FSD v2.1 rule:** Start by keeping everything in pages. Only extract to lower layers when genuinely reused across pages.

## Color Verification

After visual analysis, verify colors with precise sampling:

Sample specific coordinates (use content area coordinates, not mockup coordinates):
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/extract-color.mjs <design-image> <x,y coordinates of key regions>
```

Sample dominant color from a region (e.g., header background, button area):
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/extract-color.mjs <design-image> --region x,y,w,h
```

Extract full palette:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/sample-palette.mjs <design-image> --top 30
```

## Flutter Token Mapping

After extracting all design tokens, map them to Flutter constructs:

```
## Flutter Token Mapping

### ColorScheme
primary: #hex → Color(0xFF...)
onPrimary: #hex → Color(0xFF...)
surface: #hex → Color(0xFF...)
...

### TextTheme
headlineLarge: <font> <size>/<line-height> w<weight> → GoogleFonts.<font>(fontSize: ..., fontWeight: ..., height: ...)
bodyLarge: ...
...

### Spacing Constants
containerPadding: <n>px → EdgeInsets.symmetric(horizontal: <n>)
sectionGap: <n>px → SizedBox(height: <n>)
...

### BoxShadow
card: → BoxShadow(color: Color(0x...), blurRadius: <n>, offset: Offset(<x>, <y>))
...

### BorderRadius
button: <n>px → BorderRadius.circular(<n>)
card: <n>px → BorderRadius.circular(<n>)
...
```

## Output

Write the complete analysis as a structured document with these sections:

```
## Device Frame
- Format: <bare screenshot | phone mockup>
- Content area: <width>x<height> (inset from edges by top:<n>px right:<n>px bottom:<n>px left:<n>px)
- Viewport to use: <width>x<height>
- pixel-diff flags: <--exclude-phone-ui | --exclude-regions x,y,w,h | none>

## Colors
<token name>: #hex  ← semantic names for every distinct color

## Typography
<style name>: <font-family> <size>/<line-height> weight:<n> tracking:<n>

## Spacing
<location>: <value>

## Components
<name>: <description, variants, states>

## Widget Tree
<hierarchical Flutter widget breakdown>

## FSD Layer Assignment
shared/ui/: [list of atoms]
entities/: [list if any]
features/: [list if any]
widgets/: [list if any]
pages/: [list of screens]

## Flutter Token Mapping
<ColorScheme, TextTheme, Spacing, Shadows, Radii mappings>
```

This becomes the reference for all subsequent build work.
