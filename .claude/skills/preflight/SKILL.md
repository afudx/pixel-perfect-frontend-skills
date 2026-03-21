---
name: preflight
description: Run pre-flight checklist before starting pixel-perfect Flutter work. Use when beginning a new design-to-code task, or when the user provides a design image and wants to start building.
user-invocable: true
allowed-tools: Read, Bash, Glob, mcp__maestro__list_devices, mcp__maestro__start_device, mcp__maestro__take_screenshot, mcp__maestro__inspect_view_hierarchy, mcp__maestro__launch_app, mcp__maestro__tap_on, mcp__maestro__run_flow, mcp__maestro__input_text, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__plugin_serena_serena__find_symbol, mcp__plugin_serena_serena__search_for_pattern
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

### 3. Verify Maestro MCP — all tools

All 8 Maestro MCP tools are required across the skills. Verify the server is reachable:

1. Call `mcp__maestro__list_devices` → confirms server is up and returns devices
2. Report device names, platforms, and IDs
3. Recommend the best device for the design dimensions:
   - iPhone SE (375x667) for small phone designs
   - iPhone 15 (393x852) for standard phone designs
   - iPad (820x1180) for tablet designs

Complete Maestro tool requirements by skill:

| Tool | Used by |
|------|---------|
| `list_devices` | preflight, verify-responsive |
| `start_device` | preflight, verify-responsive |
| `launch_app` | setup-project, verify-responsive |
| `take_screenshot` | pixel-diff, fix-loop, verify-interactive, verify-responsive, verify-completeness |
| `inspect_view_hierarchy` | fix-loop, verify-styles, verify-a11y, verify-interactive, verify-responsive, verify-completeness |
| `tap_on` | verify-interactive |
| `run_flow` | verify-interactive |
| `input_text` | verify-interactive |

If `list_devices` succeeds, all other tools are available on the same server — no individual probing needed.

### 4. Start a test device

1. Call `mcp__maestro__start_device` with `platform: "ios"` (default) or `platform: "android"`
2. Wait for device to boot
3. Call `mcp__maestro__take_screenshot` to verify screenshot capability
4. Report: device ID, platform, screen dimensions

### 5. Verify optional MCPs

These MCPs are used as helpers in specific skills. Report availability but do not fail if absent.

#### Playwright MCP (optional — fallback for web URLs in analyze-design)

Attempt a lightweight check by calling `mcp__playwright__browser_navigate` with a simple URL, or simply note if the tool is available in the current session. Playwright MCP is used in `/analyze-design` when the design is a live web URL rather than a local image.

#### Serena MCP (optional — semantic code analysis in verify-styles)

Attempt `mcp__plugin_serena_serena__find_symbol` with a dummy query to confirm the server is responsive. Serena MCP is used in `/verify-styles` for tracing widget symbol references beyond what grep provides.

### 6. Check working directory

- If `pubspec.yaml` exists: report project name, Flutter SDK version constraint, existing dependencies
- If not: note that `/setup-project` will scaffold a new Flutter project
- Check for existing `lib/` structure (FSD layers present?)
- Check for existing `.claude/tmp/` directory

### 7. Report summary

Output a checklist:

```
PRE-FLIGHT CHECKLIST
====================
Runtime:
  [PASS/FAIL] Node.js (vX.X — requires v18+)
  [PASS/WARN] RTK (token optimization — optional)

Flutter Toolchain:
  [PASS/FAIL] Flutter SDK (version)
  [PASS/FAIL] Dart SDK (version)
  [PASS/WARN] CocoaPods (required for iOS builds)
  [PASS/WARN] Maestro CLI (optional — MCP is primary)
  [INFO]      flutter doctor summary

Node.js Dependencies:
  [PASS/FAIL] sharp
  [PASS/FAIL] pixelmatch
  [PASS/FAIL] pngjs

Devices:
  [INFO]      iOS simulators: N available
  [INFO]      Android emulators: N available

MCP Servers — Required:
  [PASS/FAIL] Maestro MCP (list_devices)
  [PASS/FAIL] Device available (name, platform, ID)
  [PASS/FAIL] Screenshot test (take_screenshot)

MCP Servers — Optional:
  [PASS/WARN] Playwright MCP (analyze-design web URL fallback)
  [PASS/WARN] Serena MCP (verify-styles semantic analysis)

Design:
  [INFO]      Design: WxH (bare/mockup @Nx scale)
  [INFO]      Viewport: WxH (logical)
  [INFO]      Project: (new / existing name)
```

All PASS required before proceeding. WARN items are acceptable — skills will work without them but with reduced capability or higher token usage.
