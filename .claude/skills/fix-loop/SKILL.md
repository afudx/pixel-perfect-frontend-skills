---
name: fix-loop
description: Iterative fix-and-reverify cycle — edit code, re-screenshot, re-diff until pixel mismatch drops below 2%. Use after pixel-diff shows deviations.
user-invocable: true
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
argument-hint: <design-image> <dev-server-url>
---

Run the fix-and-reverify loop.

Design: `$0`
Dev server: `$1`

## The Loop (max 3 iterations)

### Step 1 — Identify Deviations
- Read the diff image from last pixel-diff run
- Use Vision to find largest mismatch areas (red regions)
- Use the shared style inspector to compare computed styles:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/inspect-styles.mjs $1
```
- Compare against design tokens

### Step 2 — Fix
Use Edit on each deviation:
- Wrong color → exact hex from design
- Wrong spacing → correct padding/margin/gap
- Wrong typography → correct font-size/weight/line-height
- Wrong radius → correct border-radius
- Missing element → add it
- Layout shift → fix flex/grid properties

### Step 3 — Re-screenshot
Take a new screenshot via Playwright CLI:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs $1 --output .claude/tmp/fix-loop-screenshot.png --full-page --wait 3000
```

### Step 4 — Re-diff
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs $0 .claude/tmp/fix-loop-screenshot.png --normalize
```

### Step 5 — Evaluate
- < 2%: DONE
- Improved but > 2%: Continue loop
- Not improving after 3 iterations: STOP and reassess

## Reassessment Protocol

1. DOM hierarchy may be wrong — rebuild the problem section from scratch
2. Use region-by-region comparison to isolate the problem
3. Font rendering variance ±1px is acceptable (OS-level)
4. Trust sharp/Figma measurements over Vision estimates

## Output

Per iteration:
```
Iteration N:
  Fixed: <list>
  New mismatch: X%
  Status: CONTINUE/PASS/REASSESS
```
