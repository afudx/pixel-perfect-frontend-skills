---
name: verify-a11y
description: Run accessibility audit using axe-core injection and manual checks. Use as part of final verification before delivery.
user-invocable: true
allowed-tools: Bash, Read
argument-hint: <dev-server-url>
---

Run accessibility audit on `$ARGUMENTS`.

## Execution

Run the shared accessibility audit script via Playwright CLI:

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/a11y-audit.mjs $ARGUMENTS
```

This script:
1. Launches a headless Chromium browser via Playwright
2. Navigates to the URL
3. Injects axe-core from node_modules and runs it
4. Reports all violations with impact level, element, and fix suggestion
5. Runs manual checks: alt text, heading hierarchy, form labels, keyboard nav

## After Running

Review the output for:
- **Critical/Serious** violations — must fix before delivery
- **Moderate** violations — fix if possible
- **Minor** violations — note for future improvement

If violations are found, fix the code and re-run this skill.

## Output

```
Automated (axe-core):
  Violations: <count>
  <per violation: element, impact, fix>

Manual:
  [PASS/FAIL] Image alt text
  [PASS/FAIL] Keyboard navigation
  [PASS/FAIL] Heading hierarchy
  [PASS/FAIL] Form labels
  [PASS/FAIL] Color contrast
```
