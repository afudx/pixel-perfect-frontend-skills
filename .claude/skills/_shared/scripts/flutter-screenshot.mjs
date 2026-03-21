#!/usr/bin/env node

/**
 * Flutter screenshot utility — captures device screen via Maestro CLI.
 *
 * Usage:
 *   node flutter-screenshot.mjs [options]
 *
 * Options:
 *   --device-id <id>    Maestro device ID (default: auto-detect running device)
 *   --output <path>     Output file path (default: .claude/tmp/screenshot.png)
 *   --wait <ms>         Wait before capturing (default: 2000)
 *   --input <path>      Skip capture, use existing screenshot for validation
 *   --help              Show this help
 *
 * Notes:
 *   - Requires Maestro CLI installed: curl -fsSL https://get.maestro.mobile.dev | bash
 *   - Alternatively, use Maestro MCP take_screenshot directly from Claude Code
 *   - This script is a standalone fallback for use in fix-loop and other scripts
 */

import { createRequire } from "node:module";
import { mkdirSync, statSync, existsSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

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
Flutter Screenshot Utility — Capture device screen via Maestro CLI.

Usage:
  node flutter-screenshot.mjs [options]

Options:
  --device-id <id>    Maestro device ID (optional, auto-detects running device)
  --output <path>     Output file (default: .claude/tmp/screenshot.png)
  --wait <ms>         Wait before capturing (default: 2000)
  --input <path>      Skip capture, validate existing screenshot
  --help              Show this help
`);
  process.exit(0);
}

function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : fallback;
}

const deviceId = getArg("--device-id", "");
const defaultOutput = `${process.cwd()}/.claude/tmp/screenshot.png`;
const output = getArg("--output", defaultOutput);
const waitMs = parseInt(getArg("--wait", "2000"));
const inputPath = getArg("--input", "");

async function isBlankScreenshot(filePath) {
  try {
    const fileSize = statSync(filePath).size;
    if (fileSize < 2000)
      return { blank: true, reason: `file too small (${fileSize} bytes)` };

    const stats = await sharp(filePath).stats();
    const avgStdev =
      stats.channels.reduce((s, ch) => s + ch.stdev, 0) /
      stats.channels.length;
    if (avgStdev < 3)
      return {
        blank: true,
        reason: `no pixel variation (stdev=${avgStdev.toFixed(1)})`,
      };

    return { blank: false };
  } catch {
    return { blank: false };
  }
}

async function captureViaMaestro() {
  mkdirSync(dirname(output), { recursive: true });

  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }

  const deviceFlag = deviceId ? `--device-id ${deviceId}` : "";
  const tmpOutput = output.replace(".png", "-maestro-raw.png");

  try {
    execSync(`maestro screenshot ${deviceFlag} ${tmpOutput}`, {
      stdio: "pipe",
      timeout: 30000,
    });

    if (existsSync(tmpOutput)) {
      copyFileSync(tmpOutput, output);
      try {
        const { unlinkSync } = await import("node:fs");
        unlinkSync(tmpOutput);
      } catch {}
    } else {
      throw new Error("Maestro did not produce a screenshot file");
    }
  } catch (err) {
    console.error(
      `[FAIL] Maestro screenshot failed: ${err.message}`
    );
    console.error(
      "       Ensure a device is running and an app is launched."
    );
    console.error(
      "       Alternatively, use Maestro MCP take_screenshot directly."
    );
    process.exit(1);
  }
}

async function main() {
  if (inputPath) {
    if (!existsSync(inputPath)) {
      console.error(`[FAIL] Input file not found: ${inputPath}`);
      process.exit(1);
    }
    copyFileSync(inputPath, output);
    console.log(`Screenshot (from input): ${output}`);
  } else {
    await captureViaMaestro();
    console.log(`Screenshot: ${output}`);
  }

  const blankCheck = await isBlankScreenshot(output);
  if (blankCheck.blank) {
    console.error(
      `[WARN] Screenshot appears blank (${blankCheck.reason}).`
    );
    if (!inputPath) {
      console.error("[WARN] Retrying with +3s extra wait...");
      await new Promise((r) => setTimeout(r, 3000));
      await captureViaMaestro();
      const retry = await isBlankScreenshot(output);
      if (retry.blank) {
        console.error(
          `[WARN] Screenshot still blank after retry (${retry.reason}). Check that the app is visible on device.`
        );
      } else {
        console.log("Screenshot (retry): OK");
      }
    }
  }

  const metadata = await sharp(output).metadata();
  console.log(`Dimensions: ${metadata.width}x${metadata.height}`);
}

main().catch((err) => {
  console.error("Flutter screenshot failed:", err.message);
  process.exit(1);
});
