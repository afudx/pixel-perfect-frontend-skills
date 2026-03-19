---
name: verify-responsive
description: Test responsive behavior at multiple viewport widths by taking screenshots and checking for layout issues. Use after the desktop implementation passes pixel diff.
user-invocable: true
allowed-tools: Bash, Read
argument-hint: <dev-server-url> [viewport-widths...]
---

Test responsive behavior at multiple viewports.

URL: `$0`
Custom widths (optional): `$1` `$2` `$3` `$4`

## Execution

Run the shared responsive test script via Playwright CLI:

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/responsive-test.mjs $ARGUMENTS
```

Default viewports: 375px, 768px, 1024px, 1440px.

The script automatically checks for:
- Horizontal scrollbar overflow
- Elements overflowing viewport
- Text smaller than 10px
- Overlapping interactive elements

Screenshots are saved to `.claude/tmp/responsive-<width>.png`.

## After Running

1. Read each screenshot image to visually verify:
   - Horizontal layouts stack vertically on mobile
   - Text remains readable
   - All content is accessible
   - No container overflow or broken layouts
   - Navigation is usable

2. If responsive design mockups exist for specific widths, run `/pixel-diff` against them.

## Output

```
375px  — [PASS/FAIL] <issues>
768px  — [PASS/FAIL] <issues>
1024px — [PASS/FAIL] <issues>
1440px — [PASS/FAIL] <issues>
```
