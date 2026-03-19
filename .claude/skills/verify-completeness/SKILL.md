---
name: verify-completeness
description: Final completeness audit — check for missing elements, TODOs, truncated files, console errors, and image constraints. Use as the last verification step before delivery.
user-invocable: true
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [dev-server-url]
---

Perform the final completeness audit.

Dev server URL (optional): `$ARGUMENTS`

## Checks

### 1. Visual Completeness
If a dev server URL is provided, capture a screenshot:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs $ARGUMENTS --output .claude/tmp/completeness-check.png --full-page --wait 3000
```
Then use Vision to compare against the design. Scan element-by-element:
- Every icon, badge, divider, dot, decorative shape present
- All text content matches character-by-character
- No extra elements added beyond the design

### 2. Code Completeness
Grep ALL source files (excluding node_modules) for:
```
TODO|FIXME|placeholder|"\.\.\."|HACK|XXX|VERIFY
```
Zero matches required.

### 3. File Completeness
Glob to verify all expected component files exist:
- `src/components/ui/*`
- `src/components/sections/*`
- `src/components/layout/*`
- `src/lib/utils.ts`
- Root page file

### 4. File Integrity
Read 3–5 key component files. Verify:
- Not truncated
- No `// ...rest` or `{/* more items */}` placeholders
- All imports resolve
- Complete JSX

### 5. Console Errors
If dev server URL provided, capture with extract flags:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs $ARGUMENTS --output .claude/tmp/console-check.png --wait 3000
```
Check for any error output.

### 6. Image Constraints
Grep for all `<img` or `Image` usage. Each must have explicit width/height or aspect-ratio.

## Output — Final Checklist

```
[ ] All component files exist and are complete
[ ] Dev server runs without errors
[ ] Full-page pixel diff < 2% (strict mode)
[ ] Zero TODO/FIXME/placeholder in code
[ ] Responsive behavior verified
[ ] Hover and focus-visible states verified
[ ] Accessibility audit passed
[ ] All design text matches exactly
[ ] All images have dimension constraints
[ ] No console errors
```

Mark each PASS or FAIL with details.
