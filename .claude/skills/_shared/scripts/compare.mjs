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

import { readFileSync, writeFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import sharp from "sharp";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

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

async function loadImage(filePath) {
  const buffer = await sharp(filePath)
    .toColourspace("srgb")
    .png()
    .toBuffer();
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}

async function main() {
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

    console.log(
      `Normalizing: resizing both images to ${targetWidth}x${targetHeight}`
    );

    const resizeAndLoad = async (path, w, h) => {
      const buf = await sharp(path)
        .toColourspace("srgb")
        .resize(w, h, { fit: "fill" })
        .png()
        .toBuffer();
      const png = PNG.sync.read(buf);
      return { width: png.width, height: png.height, data: png.data };
    };

    design = await resizeAndLoad(designPath, targetWidth, targetHeight);
    screenshot = await resizeAndLoad(screenshotPath, targetWidth, targetHeight);
  }

  const { width, height } = design;
  const diff = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(
    design.data,
    screenshot.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  const totalPixels = width * height;
  const mismatchPercent = ((mismatchedPixels / totalPixels) * 100).toFixed(2);

  const diffPath = join(
    dirname(screenshotPath),
    `${basename(screenshotPath, ".png")}-diff.png`
  );
  writeFileSync(diffPath, PNG.sync.write(diff));

  const status =
    parseFloat(mismatchPercent) < 2
      ? "PASS"
      : parseFloat(mismatchPercent) < 5
        ? "REVIEW"
        : "FAIL";

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
