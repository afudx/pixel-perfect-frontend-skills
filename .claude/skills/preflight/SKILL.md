---
name: preflight
description: Run pre-flight checklist before starting pixel-perfect frontend work. Use when beginning a new design-to-code task, or when the user provides a design image and wants to start building.
user-invocable: true
allowed-tools: Read, Bash, Glob
argument-hint: [design-image-path]
---

Run the pre-flight checklist for the design image at `$ARGUMENTS`.

## Steps

### 1. Install ALL dependencies (MUST run first)

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/install-deps.sh
```

This installs: sharp, pixelmatch, pngjs, axe-core, playwright, AND chromium browser.
All subsequent skills depend on these — no mid-session installs needed.

### 2. Verify design image

If a design image path was provided:
- Verify the file exists using `ls`
- Read dimensions using `sips -g pixelWidth -g pixelHeight <path>` (macOS) or `node -e "const s=require('sharp'); s('<path>').metadata().then(m=>console.log(m.width+'x'+m.height))"`
- Record width × height

If a URL was provided instead of a local image:
- Use the shared screenshot utility to capture it:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs $ARGUMENTS \
  --output .claude/tmp/design-capture.png --full-page --extract-text --extract-styles --wait 5000
```

### 3. Analyze reference image format

After reading dimensions, determine the image format to guide the entire build:

**Phone mockup detection:**
- Sample the 4 corner pixels (5px in from each corner):
  ```bash
  node ${CLAUDE_SKILL_DIR}/../_shared/scripts/extract-color.mjs <design.png> 5,5 <w-5>,5 5,<h-5> <w-5>,<h-5>
  ```
- If all 4 corners are similar dark/gray colors (within ±30 RGB of each other), the image is a **phone mockup** with a device frame.
- Sample the edge centers to estimate chrome thickness:
  ```bash
  node ${CLAUDE_SKILL_DIR}/../_shared/scripts/extract-color.mjs <design.png> <w/2>,5 <w/2>,<h-5> 5,<h/2> <w-5>,<h/2>
  ```
- Scan inward from each edge using `--region` mode to find where the content starts:
  ```bash
  node ${CLAUDE_SKILL_DIR}/../_shared/scripts/extract-color.mjs <design.png> --region 0,0,<w>,20 --region 0,<h-20>,<w>,20
  ```

**Scale detection:**
- Compare design width to standard viewport widths:
  - 375px or 390px → iPhone standard mobile
  - 414px → iPhone Plus/Max
  - 428px → iPhone 14 Pro Max
  - 768px → iPad portrait
  - 1280–1440px → Desktop
  - > 500px portrait with uniform chrome border → likely a 2× or 3× mockup (e.g., 584px design = ~292px content at 2×)

**Report format:**
```
[INFO] Design image: <path> (<width>x<height>)
[INFO] Format: <bare screenshot | phone mockup | device mockup>
[INFO] Content area: ~<content-width>x<content-height> (starts at <x>,<y>)
[INFO] Scale: <1x | 2x | 3x> — screenshot viewport should be <viewport-width>x<viewport-height>
[INFO] Chrome border: ~<thickness>px on each edge
```

### 4. Verify Node.js & npm

Run `node -v` and `npm -v`. Node must be v18+.

### 5. Verify Playwright browser

```bash
node -e "const { chromium } = require('playwright'); console.log('Chromium:', chromium.executablePath())"
```

If this fails, run `npx playwright install chromium`.

### 6. Test browser screenshot capability

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs https://example.com --output .claude/tmp/preflight-test.png --wait 2000
```

Verify the screenshot file was created and is non-empty.

### 7. Working directory

Check for existing project files (package.json, src/, etc.) and report state.

### 8. Figma MCP (optional)

Only if the user mentioned a Figma file. Otherwise skip.

## Output

Print a checklist:
```
[PASS/FAIL] Dependencies installed (sharp, pixelmatch, pngjs, axe-core, playwright, chromium)
[PASS/FAIL] Design image: <path> (<width>x<height>)
[INFO] Format: <bare screenshot | phone mockup>
[INFO] Content area: ~<w>x<h> starting at <x>,<y>
[INFO] Scale: <1x | 2x> — use viewport <w>x<h> for screenshots
[PASS/FAIL] Node.js: <version>
[PASS/FAIL] npm: <version>
[PASS/FAIL] Playwright browser: <chromium path>
[PASS/FAIL] Test screenshot: <path>
[INFO] Working directory: <state>
[SKIP/PASS/FAIL] Figma MCP
```

Do not proceed with build work. This skill only verifies readiness.
