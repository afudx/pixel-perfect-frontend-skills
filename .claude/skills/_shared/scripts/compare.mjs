#!/usr/bin/env node

/**
 * Pixel-Perfect Comparison Script
 *
 * Mode A (strict, default): fails if image dimensions differ.
 * Mode B (--normalize): resizes both images to match before comparing.
 * Mode C (--structural): grayscale + threshold comparison — ignores color, reveals layout deviations.
 *
 * Additional flags:
 *   --exclude-regions x,y,w,h  Mask a region before comparing (repeat for multiple regions).
 *   --auto-crop-chrome          Detect and crop uniform border (phone chrome/device frame).
 *
 * Usage:
 *   node compare.mjs <design.png> <screenshot.png> [--normalize] [--structural]
 *     [--exclude-regions x,y,w,h] [--auto-crop-chrome]
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
const _pixelmatchMod = resolveShared("pixelmatch");
const pixelmatch = typeof _pixelmatchMod === "function" ? _pixelmatchMod : _pixelmatchMod.default;

const args = process.argv.slice(2);

if (args.includes("--help") || args.length < 2) {
  console.log(`
Pixel-Perfect Comparison Script

Usage:
  node compare.mjs <design.png> <screenshot.png> [options]

Modes:
  Strict (default)         Fails if image dimensions differ. Use for final verification.
  --normalize              Resizes both images to the smaller dimension before comparing.
                           Use only for rough initial checks during development.
  --structural             Converts both images to grayscale + threshold before comparing.
                           Ignores all color differences — reveals layout structure deviations only.

Additional flags:
  --exclude-regions x,y,w,h   Mask a rectangular region before comparing. Can be repeated.
                               Example: --exclude-regions 0,0,584,80 --exclude-regions 0,1088,584,80
                               Useful for masking phone chrome, status bars, or known-different areas.
  --auto-crop-chrome           Detect and remove uniform-color border (device frame/phone chrome).
                               Scans edges inward and crops when pixel variance increases.

Output:
  - Prints mismatch percentage to console
  - Prints per-region breakdown (top / middle / bottom thirds)
  - Writes diff image to <screenshot>-diff.png

Exit codes:
  0  Mismatch < 2%
  1  Mismatch >= 2% or error
`);
  process.exit(0);
}

const normalize = args.includes("--normalize");
const structural = args.includes("--structural");
const autoCropChrome = args.includes("--auto-crop-chrome");

// Parse --exclude-regions flags (can be repeated)
const excludeRegions = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--exclude-regions" && args[i + 1]) {
    const parts = args[i + 1].split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      excludeRegions.push({ x: parts[0], y: parts[1], w: parts[2], h: parts[3] });
    } else {
      console.error(`Invalid --exclude-regions value: ${args[i + 1]}. Expected x,y,w,h`);
      process.exit(1);
    }
    i++; // skip next arg
  }
}

// Resolve input paths relative to the calling shell's CWD, not the script location
const [rawDesignPath, rawScreenshotPath] = args.filter((a) => !a.startsWith("--") && a !== args[args.indexOf("--exclude-regions") + 1]).filter(Boolean);
const designPath = resolve(process.cwd(), rawDesignPath);
const screenshotPath = resolve(process.cwd(), rawScreenshotPath);

if (!rawDesignPath || !rawScreenshotPath) {
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
  } catch {
    // sharp failed — proceed anyway, pixelmatch will surface any real issue
  }
}

/**
 * Detect uniform-color border (phone chrome) and return crop bounds.
 * Scans each edge inward until pixel variance exceeds threshold.
 */
async function detectChromeCrop(filePath) {
  const { data, info } = await sharp(filePath)
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const ch = 4; // RGBA after ensureAlpha
  const VARIANCE_THRESHOLD = 400;
  const MAX_CROP = 0.15; // crop at most 15% from each edge

  function rowVariance(y) {
    const vals = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * ch;
      vals.push(data[i], data[i + 1], data[i + 2]);
    }
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    return vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  }

  function colVariance(x) {
    const vals = [];
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * ch;
      vals.push(data[i], data[i + 1], data[i + 2]);
    }
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    return vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  }

  let top = 0, bottom = height, left = 0, right = width;

  for (let y = 0; y < height * MAX_CROP; y++) {
    if (rowVariance(y) > VARIANCE_THRESHOLD) { top = y; break; }
    top = y + 1;
  }
  for (let y = height - 1; y > height * (1 - MAX_CROP); y--) {
    if (rowVariance(y) > VARIANCE_THRESHOLD) { bottom = y + 1; break; }
    bottom = y;
  }
  for (let x = 0; x < width * MAX_CROP; x++) {
    if (colVariance(x) > VARIANCE_THRESHOLD) { left = x; break; }
    left = x + 1;
  }
  for (let x = width - 1; x > width * (1 - MAX_CROP); x--) {
    if (colVariance(x) > VARIANCE_THRESHOLD) { right = x + 1; break; }
    right = x;
  }

  return { left, top, width: right - left, height: bottom - top };
}

async function loadImage(filePath, targetW, targetH, cropRect) {
  let pipeline = sharp(filePath).toColourspace("srgb");
  if (cropRect) {
    pipeline = pipeline.extract(cropRect);
  }
  if (targetW && targetH) pipeline = pipeline.resize(targetW, targetH, { fit: "fill" });
  if (structural) {
    pipeline = pipeline.grayscale().threshold(128).toColourspace("srgb");
  }
  const buffer = await pipeline.png().toBuffer();
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}

/**
 * Mask excluded regions by copying design pixels into screenshot pixels.
 * This makes those areas identical, so pixelmatch won't count them as mismatches.
 */
function applyExcludeRegions(design, screenshot, regions) {
  const { width, height } = design;
  for (const { x, y, w, h } of regions) {
    const x2 = Math.min(x + w, width);
    const y2 = Math.min(y + h, height);
    for (let py = Math.max(0, y); py < y2; py++) {
      for (let px = Math.max(0, x); px < x2; px++) {
        const idx = (py * width + px) * 4;
        screenshot.data[idx]     = design.data[idx];
        screenshot.data[idx + 1] = design.data[idx + 1];
        screenshot.data[idx + 2] = design.data[idx + 2];
        screenshot.data[idx + 3] = design.data[idx + 3];
      }
    }
  }
}

/**
 * Compute mismatch count within a rectangular region of the diff buffer.
 */
function regionMismatch(diffData, width, x, y, w, h) {
  let count = 0;
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const idx = (py * width + px) * 4;
      // pixelmatch marks mismatches in red: R high, G/B low
      if (diffData[idx] > 200 && diffData[idx + 1] < 50 && diffData[idx + 2] < 50) {
        count++;
      }
    }
  }
  return count;
}

async function main() {
  await checkBlank(designPath, "Design image");
  await checkBlank(screenshotPath, "Screenshot");

  // Auto-detect phone chrome crop if requested
  let cropRect = undefined;
  if (autoCropChrome) {
    cropRect = await detectChromeCrop(designPath);
    const original = await sharp(designPath).metadata();
    if (cropRect.width < original.width || cropRect.height < original.height) {
      console.log(`Auto-crop chrome detected:`);
      console.log(`  Original:    ${original.width} x ${original.height}`);
      console.log(`  Cropped to:  ${cropRect.width} x ${cropRect.height} (offset ${cropRect.left},${cropRect.top})`);
    } else {
      console.log(`Auto-crop chrome: no border detected, using full image.`);
      cropRect = undefined;
    }
  }

  let design = await loadImage(designPath, null, null, cropRect);
  let screenshot = await loadImage(screenshotPath, null, null, cropRect);

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

    design = await loadImage(designPath, targetWidth, targetHeight, cropRect);
    screenshot = await loadImage(screenshotPath, targetWidth, targetHeight, cropRect);
  }

  // Apply excluded regions by making those pixels identical in both images
  if (excludeRegions.length > 0) {
    applyExcludeRegions(design, screenshot, excludeRegions);
    console.log(`Excluded ${excludeRegions.length} region(s) from comparison.`);
  }

  const { width, height } = design;
  const diff = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(design.data, screenshot.data, diff.data, width, height, { threshold: 0.1 });

  const totalPixels = width * height;
  const mismatchPercent = ((mismatchedPixels / totalPixels) * 100).toFixed(2);

  const suffix = structural ? "-structural-diff" : "-diff";
  const diffPath = join(dirname(screenshotPath), `${basename(screenshotPath, ".png")}${suffix}.png`);
  writeFileSync(diffPath, PNG.sync.write(diff));

  // Region breakdown (vertical thirds: top / middle / bottom)
  const third = Math.floor(height / 3);
  const half = Math.floor(width / 2);

  const regions = [
    { label: "Top-Left",    x: 0,    y: 0,          w: half,        h: third },
    { label: "Top-Right",   x: half, y: 0,          w: width - half, h: third },
    { label: "Mid-Left",    x: 0,    y: third,       w: half,        h: third },
    { label: "Mid-Right",   x: half, y: third,       w: width - half, h: third },
    { label: "Bot-Left",    x: 0,    y: third * 2,   w: half,        h: height - third * 2 },
    { label: "Bot-Right",   x: half, y: third * 2,   w: width - half, h: height - third * 2 },
  ];

  const breakdown = regions.map(({ label, x, y, w, h }) => {
    const count = regionMismatch(diff.data, width, x, y, w, h);
    const pct = ((count / (w * h)) * 100).toFixed(1);
    return { label, pct };
  });

  const mode = structural ? " [structural mode — color ignored]" : normalize ? " [normalized]" : "";
  const status =
    parseFloat(mismatchPercent) < 2 ? "PASS" :
    parseFloat(mismatchPercent) < 5 ? "REVIEW" : "FAIL";

  console.log(`
Comparison Results${mode}:
  Design:       ${designPath}
  Screenshot:   ${screenshotPath}
  Dimensions:   ${width} x ${height}
  Mismatched:   ${mismatchedPixels.toLocaleString()} / ${totalPixels.toLocaleString()} pixels
  Mismatch:     ${mismatchPercent}%
  Status:       ${status}
  Diff image:   ${diffPath}

Region Breakdown (6 quadrants):
  ${breakdown.map((r) => `${r.label.padEnd(12)} ${r.pct.padStart(5)}%`).join("\n  ")}
`);

  if (status === "PASS") {
    console.log("Under 2% mismatch — acceptable.");
    process.exit(0);
  } else if (status === "REVIEW") {
    console.log("2-5% mismatch — review the diff image and fix deviations.");
    process.exit(1);
  } else {
    console.log("Over 5% mismatch — significant rework required.");
    console.log("High-mismatch regions (>10%):", breakdown.filter((r) => parseFloat(r.pct) > 10).map((r) => r.label).join(", ") || "none");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Comparison failed:", err.message);
  process.exit(1);
});
