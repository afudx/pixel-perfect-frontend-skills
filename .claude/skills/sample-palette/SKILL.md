---
name: sample-palette
description: Extract the dominant color palette from a design image. Use for initial color discovery before targeted sampling with extract-colors.
user-invocable: true
allowed-tools: Bash, Read
argument-hint: <image-path> [--top N] [--quantize N]
---

Extract dominant colors from the design image.

## Dependencies

Install if not already present:
```bash
bash ${CLAUDE_SKILL_DIR}/scripts/install-deps.sh
```

## Execution

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/sample-palette.mjs $ARGUMENTS
```

Defaults: top 20 colors, quantization step 8. Use `--quantize 4` for more precision.

## Follow-up

After reviewing the palette:
1. Use Vision to map each color to its semantic purpose (background, text, border, brand, status)
2. Identify colors Vision sees that the palette missed — small-area accents. Use `/extract-colors` with specific coordinates for those.
3. Prepare the color map for `AppColors` in `shared/theme/app_colors.dart`.

## Output

Print colors grouped by frequency, then provide a semantic mapping recommendation.
