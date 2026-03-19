#!/usr/bin/env node

/**
 * Pixel-Perfect Comparison Script
 *
 * Mode A (strict, default): fails if image dimensions differ.
 * Mode B (--normalize): resizes both images to match before comparing.
 *
 * Usage:
 *   node compare.mjs <design.png> <screenshot.png> [--normalize]
 *   node compare.mjs --help
 */

import { createRequire } from "node:module";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { basename, join, dirname, resolve } from "node:path";
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
const { PNG } = resolveShared("pngjs");
const pixelmatch = resolveShared("pixelmatch");

const args = process.argv.slice(2);

if (args.includes("--help") || args.length < 2) {
  console.log(`
Pixel-Perfect Comparison Script

Usage:
  node compare.mjs <design.png> <screenshot.png> [--normalize]

Modes:
  Strict (default)    Fails if image dimensions differ. Use for final verification.
  --normalize         Resizes both images to the smaller dimension before comparing.
                      Use only for rough initial checks during development.

Output:
  - Prints mismatch percentage to console
  - Writes diff image to <screenshot>-diff.png

Exit codes:
  0  Mismatch < 2%
  1  Mismatch >= 2% or error
`);
  process.exit(0);
}

const normalize = args.includes("--normalize");
const [designPath, screenshotPath] = args.filter((a) => !a.startsWith("--"));

if (!designPath || !screenshotPath) {
  console.error("Error: Both design and screenshot paths are required.");
  process.exit(1);
}

async function checkBlank(filePath, label) {
  try {
    const fileSize = statSync(filePath).size;
    if (fileSize < 2000) {
      console.error(`[ERROR] ${label} appears blank — file too small (${fileSize} bytes).`);
      console.error(`        Check that the page rendered before screenshotting.`);
      process.exit(1);
    }
    const stats = await sharp(filePath).stats();
    const avgStdev = stats.channels.reduce((s, ch) => s + ch.stdev, 0) / stats.channels.length;
    if (avgStdev < 3) {
      console.error(`[ERROR] ${label} appears blank — no pixel variation (stdev=${avgStdev.toFixed(1)}).`);
      console.error(`        The screenshot tool may have captured a blank page. Re-run with --wait 5000.`);
      process.exit(1);
    }
  } catch (err) {
    // sharp failed — proceed anyway, pixelmatch will surface any real issue
  }
}

async function loadImage(filePath) {
  const buffer = await sharp(filePath).toColourspace("srgb").png().toBuffer();
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}

async function main() {
  // Guard: reject blank inputs before running the expensive comparison
  await checkBlank(designPath, "Design image");
  await checkBlank(screenshotPath, "Screenshot");

  let design = await loadImage(designPath);
  let screenshot = await loadImage(screenshotPath);

  if (design.width !== screenshot.width || design.height !== screenshot.height) {
    if (!normalize) {
      console.error(
        `\nDimension mismatch (strict mode):\n` +
        `  Design:     ${design.width} x ${design.height}\n` +
        `  Screenshot: ${screenshot.width} x ${screenshot.height}\n\n` +
        `This indicates a layout size error. Fix the viewport/layout dimensions.\n` +
        `Use --normalize flag only for rough initial checks.\n`
      );
      process.exit(1);
    }

    const targetWidth = Math.min(design.width, screenshot.width);
    const targetHeight = Math.min(design.height, screenshot.height);
    console.log(`Normalizing: resizing both images to ${targetWidth}x${targetHeight}`);

    const resizeAndLoad = async (path, w, h) => {
      const buf = await sharp(path).toColourspace("srgb").resize(w, h, { fit: "fill" }).png().toBuffer();
      const png = PNG.sync.read(buf);
      return { width: png.width, height: png.height, data: png.data };
    };

    design = await resizeAndLoad(designPath, targetWidth, targetHeight);
    screenshot = await resizeAndLoad(screenshotPath, targetWidth, targetHeight);
  }

  const { width, height } = design;
  const diff = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(design.data, screenshot.data, diff.data, width, height, { threshold: 0.1 });

  const totalPixels = width * height;
  const mismatchPercent = ((mismatchedPixels / totalPixels) * 100).toFixed(2);

  const diffPath = join(dirname(screenshotPath), `${basename(screenshotPath, ".png")}-diff.png`);
  writeFileSync(diffPath, PNG.sync.write(diff));

  const status =
    parseFloat(mismatchPercent) < 2 ? "PASS" :
    parseFloat(mismatchPercent) < 5 ? "REVIEW" : "FAIL";

  console.log(`
Comparison Results:
  Design:       ${designPath}
  Screenshot:   ${screenshotPath}
  Dimensions:   ${width} x ${height}
  Mismatched:   ${mismatchedPixels.toLocaleString()} / ${totalPixels.toLocaleString()} pixels
  Mismatch:     ${mismatchPercent}%
  Status:       ${status}
  Diff image:   ${diffPath}
`);

  if (status === "PASS") {
    console.log("Under 2% mismatch — acceptable.");
    process.exit(0);
  } else if (status === "REVIEW") {
    console.log("2-5% mismatch — review the diff image and fix deviations.");
    process.exit(1);
  } else {
    console.log("Over 5% mismatch — significant rework required.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Comparison failed:", err.message);
  process.exit(1);
});
