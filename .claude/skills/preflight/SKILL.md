---
name: preflight
description: Run pre-flight checklist before starting pixel-perfect Flutter work. Use when beginning a new design-to-code task, or when the user provides a design image and wants to start building.
user-invocable: true
allowed-tools: Read, Bash, Glob, mcp__maestro__list_devices, mcp__maestro__start_device, mcp__maestro__take_screenshot
arguments:
  - name: design-image
    description: Path to the design image file (optional)
    required: false
---

# Pre-flight Checklist for Pixel-Perfect Flutter

Run this checklist BEFORE starting any design-to-code Flutter work.

## Checklist

### 1. Install dependencies

Run the install script:

```bash
bash .claude/skills/preflight/scripts/install-deps.sh
```

This installs image processing tools (sharp, pixelmatch, pngjs) to `.claude/skills/_shared/node_modules` and verifies the Flutter toolchain (Flutter SDK, Dart SDK, Maestro, devices).

### 2. Verify design image

If a design image was provided:

1. Read the image to confirm it loads
2. Report dimensions (width × height)
3. Detect if it's a **device mockup** or **bare screenshot**:

**Device mockup detection** — Sample the four corner pixels:
```bash
node .claude/skills/_shared/scripts/extract-color.mjs <design-image> 0,0 <W-1>,0 0,<H-1> <W-1>,<H-1>
```

- If all 4 corners are the same neutral color (gray/black/white) → **device mockup**
  - Sample edge centers to estimate content inset (chrome thickness)
  - Set viewport to content area dimensions
  - Use `--exclude-phone-ui` on ALL pixel-diff and fix-loop runs
- If corners differ → **bare screenshot**
  - Viewport = design dimensions
  - No masking needed

**Scale detection** — Check if dimensions suggest 2× or 3× rendering:
- Width > 800 and common device ratio → likely 2× or 3× mockup
- Divide by scale factor for logical viewport dimensions

### 3. Verify Maestro MCP availability

Use Maestro MCP tools to verify device access:

1. Call `mcp__maestro__list_devices` to list available simulators/emulators
2. Report device names, platforms, and IDs
3. Recommend the best device for the design dimensions:
   - iPhone SE (375x667) for small phone designs
   - iPhone 15 (393x852) for standard phone designs
   - iPad (820x1180) for tablet designs

### 4. Start a test device

1. Call `mcp__maestro__start_device` with `platform: "ios"` (default) or `platform: "android"`
2. Wait for device to boot
3. Call `mcp__maestro__take_screenshot` to verify screenshot capability
4. Report: device ID, platform, screen dimensions

### 5. Check working directory

- If `pubspec.yaml` exists: report project name, Flutter SDK version constraint, existing dependencies
- If not: note that `/setup-project` will scaffold a new Flutter project
- Check for existing `lib/` structure (FSD layers present?)
- Check for existing `.claude/tmp/` directory

### 6. Report summary

Output a checklist:

```
PRE-FLIGHT CHECKLIST
====================
[PASS/FAIL] Node.js dependencies (sharp, pixelmatch, pngjs)
[PASS/FAIL] Flutter SDK (version)
[PASS/FAIL] Dart SDK (version)
[PASS/WARN] Maestro CLI (optional if MCP available)
[PASS/FAIL] Maestro MCP (list_devices works)
[PASS/FAIL] Device available (name, platform, ID)
[PASS/FAIL] Screenshot test
[INFO]      Design: WxH (bare/mockup @Nx scale)
[INFO]      Viewport: WxH (logical)
[INFO]      Project: (new / existing name)
```

All PASS required before proceeding. WARN items are acceptable.
