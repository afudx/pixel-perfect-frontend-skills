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
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs <url> --output .claude/tmp/design-capture.png --full-page --extract-text --extract-styles --wait 5000
```

### 3. Verify Node.js & npm

Run `node -v` and `npm -v`. Node must be v18+.

### 4. Verify Playwright browser

```bash
node -e "const { chromium } = require('playwright'); console.log('Chromium:', chromium.executablePath())"
```

If this fails, run `npx playwright install chromium`.

### 5. Test browser screenshot capability

```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs https://example.com --output .claude/tmp/preflight-test.png --wait 2000
```

Verify the screenshot file was created and is non-empty.

### 6. Working directory

Check for existing project files (package.json, src/, etc.) and report state.

### 7. Figma MCP (optional)

Only if the user mentioned a Figma file. Otherwise skip.

## Output

Print a checklist:
```
[PASS/FAIL] Dependencies installed (sharp, pixelmatch, pngjs, axe-core, playwright, chromium)
[PASS/FAIL] Design image: <path> (<width>x<height>)
[PASS/FAIL] Node.js: <version>
[PASS/FAIL] npm: <version>
[PASS/FAIL] Playwright browser: <chromium path>
[PASS/FAIL] Test screenshot: <path>
[INFO] Working directory: <state>
[SKIP/PASS/FAIL] Figma MCP
```

Do not proceed with build work. This skill only verifies readiness.
