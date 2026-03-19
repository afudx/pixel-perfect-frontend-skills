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

## Step 0 — Classify Mismatch Before Fixing

Before making any code changes, classify what's causing the mismatch. This prevents wasted iterations.

Run the comparison with region breakdown:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs $0 .claude/tmp/fix-loop-screenshot.png --normalize
```

Then read the diff image and cross-reference the 6-quadrant breakdown to answer:

**Classification checklist:**

| Type | How to identify | Action |
|------|----------------|--------|
| **Device chrome** | Uniform mismatch around all 4 edges | Use `--auto-crop-chrome` or `--exclude-regions`, not code changes |
| **Missing asset** | Large solid-color block in diff (where design has a photo) | Note as known limitation, don't fix in code |
| **Layout shift** | Entire section offset by N pixels | Fix flex/grid alignment or container padding |
| **Wrong color** | Diffuse red throughout a region | Extract exact hex from design, update token |
| **Wrong spacing** | Thin red lines between elements | Fix padding/margin/gap values |
| **Wrong typography** | Text region mismatched | Fix font-size, weight, line-height |
| **Missing element** | Solid red block matching a known element | Add the missing component |
| **Wrong radius** | Curved-edge mismatch | Fix border-radius value |
| **Dynamic content** | Status bar, timestamps, live counters | Mask with `--exclude-regions` |

**Report classification before proceeding:**
```
Mismatch breakdown:
  Top section (0–33%):    X% — [layout shift / wrong color / device chrome / ...]
  Mid section (33–66%):   X% — [missing element / wrong spacing / ...]
  Bot section (66–100%):  X% — [...]

Fixable by code:       X% estimated
Not fixable (assets/chrome): X% estimated
Proceeding to fix:     <list of actionable items>
```

Only proceed to fix actionable items. Do not attempt to fix device chrome or missing photo assets in code.

---

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

If the design is a **phone mockup** (detected in `/preflight`), always add `--exclude-phone-ui`:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs $0 .claude/tmp/fix-loop-screenshot.png --normalize --exclude-phone-ui
```

For bare app screenshots (no device frame):
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/compare.mjs $0 .claude/tmp/fix-loop-screenshot.png --normalize
```

> The same masking flags used in the final `/pixel-diff` **must** be used in every fix-loop iteration. Mixing masked and unmasked runs makes mismatch % incomparable across iterations.

### Step 5 — Evaluate
- < 2%: DONE
- Improved but > 2%: Continue loop
- Not improving after 3 iterations: STOP and reassess

## Reassessment Protocol

1. DOM hierarchy may be wrong — rebuild the problem section from scratch
2. Use region-by-region comparison to isolate the problem
3. Font rendering variance ±1px is acceptable (OS-level)
4. Trust sharp/Figma measurements over Vision estimates
5. If remaining mismatch is entirely due to device chrome or missing photos — it is not fixable by code. Document it and consider the implementation complete.

## Output

Per iteration:
```
Classification:
  Device chrome:  X%
  Missing assets: X%
  Fixable in code: X%

Iteration N:
  Fixed: <list>
  New mismatch: X%
  Status: CONTINUE/PASS/REASSESS
```
