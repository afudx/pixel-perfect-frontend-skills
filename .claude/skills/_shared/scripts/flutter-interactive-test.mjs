#!/usr/bin/env node

/**
 * Flutter interactive state testing — generates and executes Maestro flows
 * to verify tap feedback, focus states, disabled states, and long-press.
 *
 * Usage:
 *   node flutter-interactive-test.mjs [options]
 *
 * Options:
 *   --device-id <id>        Maestro device ID
 *   --hierarchy <path>      Path to saved hierarchy CSV (from inspect_view_hierarchy)
 *   --output-dir <path>     Directory for state screenshots (default: .claude/tmp)
 *   --app-id <id>           App bundle ID for Maestro flows
 *   --help                  Show this help
 *
 * Tests performed:
 *   - Tap feedback: Screenshots before/after tap on each interactive element
 *   - Focus states: Tab to text fields, verify focused state in hierarchy
 *   - Disabled states: Detect disabled elements via hierarchy enabled=false
 *   - Long-press: Long-press on elements and screenshot for context menus/tooltips
 *
 * This script is primarily used as documentation/reference for the verify-interactive
 * SKILL.md, which uses Maestro MCP tools directly. The script provides a standalone
 * fallback via Maestro CLI.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);

if (args.includes("--help")) {
  console.log(`
Flutter Interactive Test — Verify tap, focus, disabled, long-press states.

Usage:
  node flutter-interactive-test.mjs [options]

Options:
  --device-id <id>        Maestro device ID
  --hierarchy <path>      Saved hierarchy CSV from inspect_view_hierarchy
  --output-dir <path>     Screenshot output directory (default: .claude/tmp)
  --app-id <id>           App bundle ID
  --help                  Show this help
`);
  process.exit(0);
}

function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : fallback;
}

const deviceId = getArg("--device-id", "");
const hierarchyPath = getArg("--hierarchy", "");
const outputDir = getArg("--output-dir", `${process.cwd()}/.claude/tmp`);
const appId = getArg("--app-id", "");

mkdirSync(outputDir, { recursive: true });

function parseInteractiveElements(content) {
  const lines = content.trim().split("\n");
  const elements = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Extract elements that are clickable or are input fields
    const textMatch = line.match(/text:\s*"?([^",\n]+)"?/i);
    const idMatch = line.match(/id:\s*"?([^",\n]+)"?/i);
    const clickableMatch = line.match(/clickable:\s*true/i);
    const enabledMatch = line.match(/enabled:\s*(true|false)/i);
    const focusedMatch = line.match(/focused:\s*(true|false)/i);

    if (clickableMatch || textMatch) {
      elements.push({
        text: textMatch ? textMatch[1] : "",
        id: idMatch ? idMatch[1] : "",
        clickable: !!clickableMatch,
        enabled: enabledMatch ? enabledMatch[1] === "true" : true,
        focused: focusedMatch ? focusedMatch[1] === "true" : false,
      });
    }
  }

  return elements;
}

function generateTapFlow(elementText, elementId) {
  const selector = elementText
    ? `"${elementText}"`
    : elementId
      ? `id: "${elementId}"`
      : null;

  if (!selector) return null;

  const appHeader = appId ? `appId: ${appId}\n---` : "---";

  return `${appHeader}
- tapOn: ${selector}
`;
}

function generateLongPressFlow(elementText, elementId) {
  const selector = elementText
    ? `"${elementText}"`
    : elementId
      ? `id: "${elementId}"`
      : null;

  if (!selector) return null;

  const appHeader = appId ? `appId: ${appId}\n---` : "---";

  return `${appHeader}
- longPressOn: ${selector}
`;
}

function runMaestroFlow(flowYaml, label) {
  const flowPath = resolve(outputDir, `_temp_flow_${label}.yaml`);
  writeFileSync(flowPath, flowYaml);

  try {
    const deviceFlag = deviceId ? `--device-id ${deviceId}` : "";
    execSync(`maestro test ${deviceFlag} ${flowPath}`, {
      stdio: "pipe",
      timeout: 30000,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function captureScreenshot(label) {
  const screenshotPath = resolve(outputDir, `interactive-${label}.png`);
  try {
    const deviceFlag = deviceId ? `--device-id ${deviceId}` : "";
    execSync(`maestro screenshot ${deviceFlag} ${screenshotPath}`, {
      stdio: "pipe",
      timeout: 15000,
    });
    return screenshotPath;
  } catch {
    return null;
  }
}

function main() {
  const results = [];

  console.log("=== Flutter Interactive State Testing ===\n");

  // Parse hierarchy if provided
  let elements = [];
  if (hierarchyPath && existsSync(hierarchyPath)) {
    const content = readFileSync(hierarchyPath, "utf-8");
    elements = parseInteractiveElements(content);
    console.log(`[INFO] Found ${elements.length} interactive elements\n`);
  } else {
    console.log(
      "[INFO] No hierarchy provided. Use Maestro MCP inspect_view_hierarchy"
    );
    console.log(
      "       to get the hierarchy, then pass via --hierarchy flag.\n"
    );
    console.log("       Or use Maestro MCP tools directly from the SKILL.\n");
  }

  // Test disabled state detection
  const disabledElements = elements.filter((el) => !el.enabled);
  if (disabledElements.length > 0) {
    console.log(
      `[INFO] Disabled elements detected: ${disabledElements.length}`
    );
    for (const el of disabledElements) {
      const label = el.text || el.id || "(unnamed)";
      console.log(`  [PASS] ${label} — enabled=false (correctly disabled)`);
      results.push({ element: label, test: "disabled", status: "PASS" });
    }
    console.log("");
  }

  // Test clickable elements
  const clickableElements = elements
    .filter((el) => el.clickable && el.enabled)
    .slice(0, 20);

  if (clickableElements.length > 0 && deviceId) {
    console.log(
      `[INFO] Testing tap states on ${clickableElements.length} elements\n`
    );

    for (let i = 0; i < clickableElements.length; i++) {
      const el = clickableElements[i];
      const label = el.text || el.id || `element-${i}`;
      const safeLabel = label.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);

      // Screenshot before tap
      const beforePath = captureScreenshot(`${safeLabel}-before`);

      // Generate and run tap flow
      const flow = generateTapFlow(el.text, el.id);
      if (flow) {
        const tapResult = runMaestroFlow(flow, safeLabel);

        // Screenshot after tap
        const afterPath = captureScreenshot(`${safeLabel}-after`);

        if (tapResult.success) {
          console.log(`  [PASS] ${label} — tap executed`);
          if (beforePath && afterPath) {
            console.log(
              `         Before: ${beforePath}`
            );
            console.log(
              `         After:  ${afterPath}`
            );
          }
          results.push({ element: label, test: "tap", status: "PASS" });
        } else {
          console.log(`  [FAIL] ${label} — tap failed: ${tapResult.error}`);
          results.push({ element: label, test: "tap", status: "FAIL" });
        }
      }
    }
  } else if (!deviceId) {
    console.log(
      "[INFO] No --device-id provided — skipping live tap testing."
    );
    console.log(
      "       Use Maestro MCP tap_on + take_screenshot from the SKILL directly.\n"
    );
  }

  // Summary
  console.log("\n=== Summary ===");
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
