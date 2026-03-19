---
name: verify-interactive
description: Test hover, focus-visible, active, and disabled states on all interactive elements via Playwright. Use to verify interactive styling matches the design.
user-invocable: true
allowed-tools: Bash, Read
argument-hint: <dev-server-url> [selectors...]
---

Test interactive states on all interactive elements.

URL: `$0`
Specific selectors (optional): remaining arguments

## Execution

Run the shared interactive test script via Playwright CLI:

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/interactive-test.mjs $ARGUMENTS
```

This script:
1. Launches a headless Chromium browser via Playwright
2. Finds all interactive elements (buttons, links, inputs, etc.)
3. Checks cursor style, transition properties
4. Tests hover states by simulating mouse hover
5. Tests focus states by simulating Tab key presses
6. Reports focus-visible CSS rule presence

## After Running

Review the output for:
- Elements missing cursor: pointer
- Elements without transition animations
- Elements that can't be hovered or focused

## Transition Defaults

If the design shows hover states but doesn't specify timing:
- Color/opacity transitions: `200ms ease-out`
- Layout/transform transitions: `300ms ease-out`

## Output

Per element:
```
<selector>:
  [PASS/FAIL] Cursor
  [PASS/FAIL] Transition
  [PASS/FAIL] Hover state
  [PASS/FAIL] Focus state
```
