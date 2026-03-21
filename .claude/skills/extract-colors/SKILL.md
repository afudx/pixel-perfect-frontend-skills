---
name: extract-colors
description: Extract exact hex color values from a design image at specific pixel coordinates using sharp. Use when you need precise color values from a design, not visual estimates.
user-invocable: true
allowed-tools: Bash, Read
argument-hint: <image-path> <x,y> [x,y] ...
---

Extract exact hex colors from the design image.

## Dependencies

Install if not already present:
```bash
bash ${CLAUDE_SKILL_DIR}/scripts/install-deps.sh
```

## Execution

Parse `$ARGUMENTS` for an image path followed by coordinate pairs.

### With coordinates
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/extract-color.mjs $ARGUMENTS
```

### Without coordinates (targeted sampling)
If the user describes regions (e.g., "header background", "primary button") instead of coordinates:
1. Use Vision to identify approximate pixel coordinates of those regions
2. Run the script with those coordinates

## Color Space

All extraction normalizes to sRGB. When comparing against browser screenshots, allow ±2 per RGB channel tolerance.

## Output

Print each color with its coordinate. Group by semantic purpose:
- Backgrounds
- Text colors
- Border colors
- Brand/accent colors

These values go directly into `AppColors` in `shared/theme/app_colors.dart`.
