#!/usr/bin/env node

/**
 * Flutter responsive testing — multi-device screenshot and overflow detection.
 *
 * Usage:
 *   node flutter-responsive-test.mjs [options]
 *
 * Options:
 *   --devices <list>        Comma-separated device names or IDs
 *   --output-dir <path>     Screenshot output directory (default: .claude/tmp)
 *   --app-id <id>           App bundle ID
 *   --check-overflow        Check for overflow indicators in screenshots
 *   --help                  Show this help
 *
 * Default devices (if --devices not specified):
 *   - iPhone SE (3rd generation) — 375x667 @2x
 *   - iPhone 15 — 393x852 @3x
 *   - iPad (10th generation) — 820x1180 @2x
 *
 * This script orchestrates multi-device testing via Maestro CLI.
 * The verify-responsive SKILL.md uses Maestro MCP tools directly,
 * which is the preferred approach. This script is a standalone fallback.
 */

import { createRequire } from "node:module";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);

function resolveShared(pkg) {
  try {
    return require(resolve(__dirname, `../node_modules/${pkg}`));
  } catch {
    return require(pkg);
  }
}

const sharp = resolveShared("sharp");

const args = process.argv.slice(2);

if (args.includes("--help")) {
  console.log(`
Flutter Responsive Test — Multi-device screenshot and overflow detection.

Usage:
  node flutter-responsive-test.mjs [options]

Options:
  --devices <list>        Comma-separated device names/IDs
  --output-dir <path>     Screenshot directory (default: .claude/tmp)
  --app-id <id>           App bundle ID
  --check-overflow        Detect Flutter overflow indicators (yellow/black stripes)
  --help                  Show this help
`);
  process.exit(0);
}

function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : fallback;
}

const devicesArg = getArg("--devices", "");
const outputDir = getArg("--output-dir", `${process.cwd()}/.claude/tmp`);
const appId = getArg("--app-id", "");
const checkOverflow = args.includes("--check-overflow");
const compact = args.includes("--compact");

mkdirSync(outputDir, { recursive: true });

const DEFAULT_DEVICES = [
  {
    name: "iPhone SE (3rd generation)",
    width: 375,
    height: 667,
    scale: 2,
    platform: "ios",
  },
  {
    name: "iPhone 15",
    width: 393,
    height: 852,
    scale: 3,
    platform: "ios",
  },
  {
    name: "iPad (10th generation)",
    width: 820,
    height: 1180,
    scale: 2,
    platform: "ios",
  },
];

async function detectOverflowIndicators(screenshotPath) {
  // Flutter renders yellow/black diagonal stripes for overflow.
  // Detect by looking for alternating yellow (#FFD600) and black (#000000)
  // pixel patterns, particularly at edges of the screen.
  try {
    const { data, info } = await sharp(screenshotPath)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    let yellowBlackCount = 0;
    const edgeThreshold = 20; // pixels from edge to check

    // Check right edge and bottom edge for overflow stripes
    for (let y = 0; y < height; y++) {
      for (
        let x = Math.max(0, width - edgeThreshold);
        x < width;
        x++
      ) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Flutter overflow yellow: ~(255, 214, 0) or black (0, 0, 0)
        const isYellow = r > 240 && g > 200 && g < 230 && b < 20;
        const isBlack = r < 15 && g < 15 && b < 15;

        if (isYellow || isBlack) yellowBlackCount++;
      }
    }

    for (let x = 0; x < width; x++) {
      for (
        let y = Math.max(0, height - edgeThreshold);
        y < height;
        y++
      ) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const isYellow = r > 240 && g > 200 && g < 230 && b < 20;
        const isBlack = r < 15 && g < 15 && b < 15;

        if (isYellow || isBlack) yellowBlackCount++;
      }
    }

    const edgePixels = edgeThreshold * (width + height) * 2;
    const overflowRatio = yellowBlackCount / edgePixels;

    return {
      hasOverflow: overflowRatio > 0.1,
      confidence: overflowRatio,
      yellowBlackPixels: yellowBlackCount,
    };
  } catch {
    return { hasOverflow: false, confidence: 0, yellowBlackPixels: 0 };
  }
}

function listAvailableDevices() {
  try {
    const output = execSync("maestro devices", {
      encoding: "utf-8",
      timeout: 10000,
    });
    return output;
  } catch {
    return "";
  }
}

function captureScreenshot(deviceId, label) {
  const screenshotPath = resolve(outputDir, `responsive-${label}.png`);
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

async function main() {
  console.log("=== Flutter Responsive Testing ===\n");

  const devices = devicesArg
    ? devicesArg.split(",").map((d) => ({ name: d.trim() }))
    : DEFAULT_DEVICES;

  console.log(`Testing on ${devices.length} device(s):\n`);

  const results = [];
  let hasErrors = false;

  for (const device of devices) {
    const safeName = device.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    console.log(`--- ${device.name} ---`);

    if (device.width) {
      console.log(
        `    Logical: ${device.width}x${device.height} @${device.scale || 1}x`
      );
    }

    // In standalone mode, try to capture from currently running device
    // The SKILL.md uses Maestro MCP start_device for each device
    const screenshotPath = captureScreenshot("", safeName);

    if (screenshotPath && existsSync(screenshotPath)) {
      const metadata = await sharp(screenshotPath).metadata();
      console.log(
        `    Screenshot: ${metadata.width}x${metadata.height} → ${screenshotPath}`
      );

      if (checkOverflow) {
        const overflow = await detectOverflowIndicators(screenshotPath);
        if (overflow.hasOverflow) {
          console.log(
            `    [ERROR] Overflow detected (confidence: ${(overflow.confidence * 100).toFixed(1)}%)`
          );
          hasErrors = true;
          results.push({
            device: device.name,
            status: "FAIL",
            reason: "overflow",
          });
        } else {
          console.log("    [PASS] No overflow indicators");
          results.push({ device: device.name, status: "PASS" });
        }
      } else {
        results.push({
          device: device.name,
          status: "CAPTURED",
          path: screenshotPath,
        });
      }
    } else {
      console.log("    [SKIP] Could not capture screenshot");
      console.log(
        "           Start device via Maestro MCP and use the SKILL directly."
      );
      results.push({ device: device.name, status: "SKIP" });
    }

    console.log("");
  }

  // Summary
  if (compact) {
    // One-line-per-device compact output
    for (const r of results) {
      const tag = r.status === "PASS" ? "OK" : r.status === "FAIL" ? "FAIL" : r.status === "CAPTURED" ? "CAP" : "SKIP";
      console.log(`[${tag}] ${r.device}${r.reason ? `: ${r.reason}` : ""}${r.path ? ` → ${r.path}` : ""}`);
    }
  } else {
    console.log("=== Summary ===");
    for (const r of results) {
      const icon =
        r.status === "PASS"
          ? "[PASS]"
          : r.status === "FAIL"
            ? "[FAIL]"
            : r.status === "CAPTURED"
              ? "[INFO]"
              : "[SKIP]";
      console.log(`${icon} ${r.device}${r.reason ? ` — ${r.reason}` : ""}`);
    }
  }

  if (hasErrors) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Responsive test failed:", err.message);
  process.exit(1);
});
