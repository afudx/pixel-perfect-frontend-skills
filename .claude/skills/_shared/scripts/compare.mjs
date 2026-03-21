#!/usr/bin/env node

/**
 * Pixel-Perfect Comparison Script
 *
 * Mode A (strict, default): fails if image dimensions differ.
 * Mode B (--normalize): resizes both images to match before comparing.
 * Mode C (--structural): grayscale + threshold comparison — ignores color, reveals layout deviations.
 *
 * Additional flags:
 *   --exclude-regions x,y,w,h   Mask a region before comparing (can be repeated).
 *   --auto-crop-chrome           Detect and crop uniform border (phone chrome/device frame)
 *                                from the DESIGN only. Do NOT use with simulator screenshots.
 *   --design-crop x,y,w,h       Explicitly crop the design image before comparison.
 *                                Use when the design is a phone mockup: pass the content area
 *                                coordinates (left,top,width,height). This replaces --auto-crop-chrome
 *                                and gives you precise control over the design crop region.
 *   --screenshot-crop x,y,w,h   Explicitly crop the screenshot before comparison.
 *                                Use when the screenshot includes OS chrome at known pixel offsets.
 *                                E.g. iPhone 16 at 3× DPR: --screenshot-crop 0,147,1179,2409
 *   --exclude-phone-ui           After crops/resize, mask OS UI strips (status bar + home indicator)
 *                                by auto-detecting their height within the comparison image.
 *   --has-notch                  Additionally mask the notch/Dynamic Island center area (use with
 *                                --exclude-phone-ui when the design has a visible notch).
 *
 * IMPORTANT — Phone mockup vs simulator workflow:
 *   When comparing a phone mockup design against a simulator screenshot, ALWAYS use
 *   --design-crop (not --auto-crop-chrome) because the chrome is at different scales.
 *   The simulator screenshot chrome is separate — use --screenshot-crop for it.
 *   Example:
 *     node compare.mjs design.png screenshot.png \
 *       --design-crop 134,192,625,1232 \
 *       --screenshot-crop 0,147,1179,2409 \
 *       --normalize --exclude-phone-ui
 *
 * Usage:
 *   node compare.mjs <design.png> <screenshot.png> [options]
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

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------
const rawArgs = process.argv.slice(2);

if (rawArgs.includes("--help") || rawArgs.length < 2) {
  console.log(`
Pixel-Perfect Comparison Script

Usage:
  node compare.mjs <design.png> <screenshot.png> [options]

Modes:
  Strict (default)         Fails if image dimensions differ. Use for final verification.
  --normalize              Resizes both images to the smaller dimension before comparing.
  --structural             Grayscale + threshold — ignores color, reveals layout structure.

Flags:
  --exclude-regions x,y,w,h
      Mask a rectangular region before comparing. Can be repeated.
      Example: --exclude-regions 0,0,584,80

  --design-crop x,y,w,h
      Explicitly crop the design to its content area before comparison.
      Use when the design is a phone mockup (pass the content area bounds).
      Preferred over --auto-crop-chrome for phone mockup + simulator workflows.
      Example: --design-crop 134,192,625,1232

  --screenshot-crop x,y,w,h
      Explicitly crop the screenshot before comparison.
      Use when the screenshot has OS chrome at known pixel offsets.
      Example for iPhone 16 @3× with 49px logical status bar:
        --screenshot-crop 0,147,1179,2409

  --auto-crop-chrome
      Auto-detect and strip uniform-color border from the DESIGN only.
      Do NOT use with simulator screenshots — use --screenshot-crop instead.

  --exclude-phone-ui
      After crops and resize, mask OS UI strips (status bar + home indicator)
      by auto-detecting their height within the comparison image.
      Also auto-detects and crops the design bezel (same as --auto-crop-chrome)
      when neither --design-crop nor --screenshot-crop is specified.

  --has-notch
      Additionally mask the notch / Dynamic Island area (top-center cutout).
      Use together with --exclude-phone-ui when the mockup shows a visible notch.

Output:
  - Mismatch percentage
  - 6-quadrant region breakdown (Top/Mid/Bot × Left/Right)
  - Diff image written to <screenshot>-diff.png

Exit codes:
  0  Mismatch < 2%
  1  Mismatch >= 2% or error
`);
  process.exit(0);
}

const normalize        = rawArgs.includes("--normalize");
const structural       = rawArgs.includes("--structural");
const autoCropChrome   = rawArgs.includes("--auto-crop-chrome");
const excludePhoneUI   = rawArgs.includes("--exclude-phone-ui");
const hasNotch         = rawArgs.includes("--has-notch");

// Collect --exclude-regions, --design-crop, --screenshot-crop values (flag+value pairs)
const excludeRegions = [];
const consumedIndices = new Set();
let explicitDesignCrop = null;
let explicitScreenshotCrop = null;

function parseCropArg(val, flagName) {
  const parts = val.split(",").map(Number);
  if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
    return { left: parts[0], top: parts[1], width: parts[2], height: parts[3] };
  }
  console.error(`Invalid ${flagName} value: ${val}. Expected x,y,w,h`);
  process.exit(1);
}

for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === "--exclude-regions" && rawArgs[i + 1]) {
    const parts = rawArgs[i + 1].split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      excludeRegions.push({ x: parts[0], y: parts[1], w: parts[2], h: parts[3] });
      consumedIndices.add(i + 1);
    } else {
      console.error(`Invalid --exclude-regions value: ${rawArgs[i + 1]}. Expected x,y,w,h`);
      process.exit(1);
    }
    i++;
  } else if (rawArgs[i] === "--design-crop" && rawArgs[i + 1]) {
    explicitDesignCrop = parseCropArg(rawArgs[i + 1], "--design-crop");
    consumedIndices.add(i + 1);
    i++;
  } else if (rawArgs[i] === "--screenshot-crop" && rawArgs[i + 1]) {
    explicitScreenshotCrop = parseCropArg(rawArgs[i + 1], "--screenshot-crop");
    consumedIndices.add(i + 1);
    i++;
  }
}

// Positional args: everything that isn't a flag or a consumed flag value
const positional = rawArgs.filter((a, i) => !a.startsWith("--") && !consumedIndices.has(i));
const [rawDesignPath, rawScreenshotPath] = positional;

if (!rawDesignPath || !rawScreenshotPath) {
  console.error("Error: Both design and screenshot paths are required.");
  process.exit(1);
}

const designPath     = resolve(process.cwd(), rawDesignPath);
const screenshotPath = resolve(process.cwd(), rawScreenshotPath);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function checkBlank(filePath, label) {
  try {
    const fileSize = statSync(filePath).size;
    if (fileSize < 2000) {
      console.error(`[ERROR] ${label} appears blank — file too small (${fileSize} bytes).`);
      process.exit(1);
    }
    const stats = await sharp(filePath).stats();
    const avgStdev = stats.channels.reduce((s, ch) => s + ch.stdev, 0) / stats.channels.length;
    if (avgStdev < 3) {
      console.error(`[ERROR] ${label} appears blank — no pixel variation (stdev=${avgStdev.toFixed(1)}).`);
      process.exit(1);
    }
  } catch {
    // sharp failed — proceed, pixelmatch will surface any real issue
  }
}

/**
 * Detect uniform-color border (device bezel) and return crop bounds.
 * Scans each edge inward until pixel variance exceeds threshold.
 */
async function detectChromeCrop(filePath) {
  const { data, info } = await sharp(filePath)
    .toColourspace("srgb").ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const ch = 4;
  const VAR_THRESHOLD = 400;
  const MAX_CROP = 0.15;

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
    if (rowVariance(y) > VAR_THRESHOLD) { top = y; break; }
    top = y + 1;
  }
  for (let y = height - 1; y > height * (1 - MAX_CROP); y--) {
    if (rowVariance(y) > VAR_THRESHOLD) { bottom = y + 1; break; }
    bottom = y;
  }
  for (let x = 0; x < width * MAX_CROP; x++) {
    if (colVariance(x) > VAR_THRESHOLD) { left = x; break; }
    left = x + 1;
  }
  for (let x = width - 1; x > width * (1 - MAX_CROP); x--) {
    if (colVariance(x) > VAR_THRESHOLD) { right = x + 1; break; }
    right = x;
  }

  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Detect phone OS UI strip heights within the content area (after chrome crop).
 *
 * Status bar (top): contains clock, battery, signal — detected by scanning for the
 * row where horizontal color-transition density spikes (content starts after OS UI).
 *
 * Home indicator (bottom): thin OS swipe bar on a near-uniform background — detected
 * by scanning from the bottom for low-density rows.
 *
 * Defaults (if auto-detection fails):
 *   Status bar: 6.5% of content height  (~76px for a 1168px image)
 *   Home indicator: 2.5% of content height (~29px for a 1168px image)
 */
function detectPhoneUIStrips(data, width, height, ch) {
  function rowEdgeDensity(y) {
    let edges = 0;
    for (let x = 1; x < width; x++) {
      const i1 = (y * width + (x - 1)) * ch;
      const i2 = (y * width + x) * ch;
      const delta = Math.abs(data[i1] - data[i2])
                  + Math.abs(data[i1 + 1] - data[i2 + 1])
                  + Math.abs(data[i1 + 2] - data[i2 + 2]);
      if (delta > 60) edges++;
    }
    return edges / width;
  }

  // --- Status bar: scan top 12%, find where edge density spikes ---
  const topScan = Math.floor(height * 0.12);
  const topDensities = Array.from({ length: topScan }, (_, y) => rowEdgeDensity(y));

  let statusBarHeight = Math.floor(height * 0.065); // default
  const WIN = 3;
  for (let y = WIN; y < topScan - WIN; y++) {
    const before = topDensities.slice(y - WIN, y).reduce((s, v) => s + v, 0) / WIN;
    const after  = topDensities.slice(y, y + WIN).reduce((s, v) => s + v, 0) / WIN;
    if (after > before * 2.5 && after > 0.04) {
      statusBarHeight = y;
      break;
    }
  }

  // --- Home indicator: scan bottom 8%, find low-density rows from the bottom ---
  const botScan = Math.floor(height * 0.08);
  const botStart = height - botScan;
  const botDensities = Array.from({ length: botScan }, (_, i) => rowEdgeDensity(botStart + i));

  let homeIndicatorHeight = Math.floor(height * 0.025); // default
  for (let i = botDensities.length - 1; i >= 0; i--) {
    if (botDensities[i] > 0.03) {
      homeIndicatorHeight = botDensities.length - 1 - i;
      break;
    }
  }
  // Enforce a minimum — even if detection fails, always mask the very bottom strip
  homeIndicatorHeight = Math.max(homeIndicatorHeight, Math.floor(height * 0.02));

  return { statusBarHeight, homeIndicatorHeight };
}

async function loadImage(filePath, targetW, targetH, cropRect) {
  let pipeline = sharp(filePath).toColourspace("srgb");
  if (cropRect) pipeline = pipeline.extract(cropRect);
  if (targetW && targetH) pipeline = pipeline.resize(targetW, targetH, { fit: "fill" });
  if (structural) pipeline = pipeline.grayscale().threshold(128).toColourspace("srgb");
  const buffer = await pipeline.png().toBuffer();
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}

/**
 * Mask excluded regions by making pixels identical in design and screenshot.
 * pixelmatch will see zero mismatch in these areas.
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

function regionMismatch(diffData, width, x, y, w, h) {
  let count = 0;
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const idx = (py * width + px) * 4;
      if (diffData[idx] > 200 && diffData[idx + 1] < 50 && diffData[idx + 2] < 50) count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await checkBlank(designPath, "Design image");
  await checkBlank(screenshotPath, "Screenshot");

  // --- Step 1: Determine crop for design and screenshot independently ---
  let designCrop = explicitDesignCrop || null;
  let screenshotCrop = explicitScreenshotCrop || null;

  // --auto-crop-chrome: auto-detect bezel crop for design only
  if (autoCropChrome || (excludePhoneUI && !explicitDesignCrop && !explicitScreenshotCrop)) {
    const detected = await detectChromeCrop(designPath);
    const original = await sharp(designPath).metadata();
    if (detected.width < original.width || detected.height < original.height) {
      designCrop = detected;
      console.log(`Design bezel detected and cropped:`);
      console.log(`  Original:   ${original.width} x ${original.height}`);
      console.log(`  Content:    ${detected.width} x ${detected.height} (inset ${detected.left},${detected.top})`);
    } else {
      console.log(`Design bezel: no border detected, using full image.`);
    }
  }

  if (explicitDesignCrop) {
    console.log(`Design crop (explicit): left=${explicitDesignCrop.left} top=${explicitDesignCrop.top} w=${explicitDesignCrop.width} h=${explicitDesignCrop.height}`);
  }
  if (explicitScreenshotCrop) {
    console.log(`Screenshot crop (explicit): left=${explicitScreenshotCrop.left} top=${explicitScreenshotCrop.top} w=${explicitScreenshotCrop.width} h=${explicitScreenshotCrop.height}`);
  }

  let design     = await loadImage(designPath,     null, null, designCrop);
  let screenshot = await loadImage(screenshotPath, null, null, screenshotCrop);

  if (design.width !== screenshot.width || design.height !== screenshot.height) {
    if (!normalize) {
      console.error(
        `\nDimension mismatch (strict mode):\n` +
        `  Design:     ${design.width} x ${design.height}\n` +
        `  Screenshot: ${screenshot.width} x ${screenshot.height}\n\n` +
        `Fix the viewport/layout dimensions, or use --normalize for rough checks.\n`
      );
      process.exit(1);
    }
    const designAR     = design.width / design.height;
    const screenshotAR = screenshot.width / screenshot.height;
    const arDiff       = Math.abs(designAR - screenshotAR) / Math.max(designAR, screenshotAR);
    if (arDiff > 0.05) {
      console.warn(
        `\n[WARN] Aspect ratio mismatch (${(arDiff * 100).toFixed(1)}% difference):\n` +
        `  Design AR:     ${designAR.toFixed(3)} (${design.width}x${design.height})\n` +
        `  Screenshot AR: ${screenshotAR.toFixed(3)} (${screenshot.width}x${screenshot.height})\n` +
        `  This will cause systematic layout shift in the diff — every element will\n` +
        `  appear at a different vertical position. Fix before trusting the mismatch %.\n` +
        `  Solutions:\n` +
        `    1. Use --design-crop to trim design to match device aspect ratio\n` +
        `    2. Use --screenshot-crop to trim screenshot to match design AR\n` +
        `    3. Build the Flutter app to match the design's exact logical dimensions\n`
      );
    }
    const targetWidth  = Math.min(design.width, screenshot.width);
    const targetHeight = Math.min(design.height, screenshot.height);
    console.log(`Normalizing: resizing both images to ${targetWidth}x${targetHeight}`);
    design     = await loadImage(designPath,     targetWidth, targetHeight, designCrop);
    screenshot = await loadImage(screenshotPath, targetWidth, targetHeight, screenshotCrop);
  }

  const { width, height } = design;
  const allExcluded = [...excludeRegions];

  // --- Step 2: Detect and add phone OS UI strips ---
  if (excludePhoneUI) {
    // Load cropped design pixels for detection
    let detPipeline = sharp(designPath).toColourspace("srgb");
    if (designCrop) detPipeline = detPipeline.extract(designCrop);
    const { data: detData, info: detInfo } = await detPipeline
      .resize(width, height, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { statusBarHeight, homeIndicatorHeight } = detectPhoneUIStrips(detData, width, height, detInfo.channels);

    // Status bar — full width, top of content
    allExcluded.push({ x: 0, y: 0, w: width, h: statusBarHeight });

    // Home indicator — full width, bottom of content
    allExcluded.push({ x: 0, y: height - homeIndicatorHeight, w: width, h: homeIndicatorHeight });

    // Notch / Dynamic Island — centered at top, after status bar
    if (hasNotch) {
      const notchW = Math.floor(width * 0.28);  // ~28% of width centered
      const notchH = Math.floor(height * 0.03); // ~3% of height
      const notchX = Math.floor((width - notchW) / 2);
      allExcluded.push({ x: notchX, y: 0, w: notchW, h: notchH });
    }

    console.log(`Phone OS UI excluded:`);
    console.log(`  Status bar:     top 0–${statusBarHeight}px (${((statusBarHeight / height) * 100).toFixed(1)}%)`);
    console.log(`  Home indicator: bottom ${height - homeIndicatorHeight}–${height}px (${((homeIndicatorHeight / height) * 100).toFixed(1)}%)`);
    if (hasNotch) console.log(`  Notch/DI:       top-center strip`);
  }

  // --- Step 3: Apply all excluded regions ---
  if (allExcluded.length > 0) {
    applyExcludeRegions(design, screenshot, allExcluded);
    if (!excludePhoneUI) {
      console.log(`Excluded ${allExcluded.length} region(s) from comparison.`);
    }
  }

  // --- Step 4: Compare ---
  const diff = new PNG({ width, height });
  const mismatchedPixels = pixelmatch(design.data, screenshot.data, diff.data, width, height, { threshold: 0.1 });

  const totalPixels   = width * height;
  const mismatchPercent = ((mismatchedPixels / totalPixels) * 100).toFixed(2);

  const suffix   = structural ? "-structural-diff" : "-diff";
  const diffPath = join(dirname(screenshotPath), `${basename(screenshotPath, ".png")}${suffix}.png`);
  writeFileSync(diffPath, PNG.sync.write(diff));

  // --- Step 5: Region breakdown ---
  const third = Math.floor(height / 3);
  const half  = Math.floor(width / 2);

  const quadrants = [
    { label: "Top-Left",  x: 0,    y: 0,        w: half,         h: third },
    { label: "Top-Right", x: half, y: 0,         w: width - half, h: third },
    { label: "Mid-Left",  x: 0,    y: third,     w: half,         h: third },
    { label: "Mid-Right", x: half, y: third,     w: width - half, h: third },
    { label: "Bot-Left",  x: 0,    y: third * 2, w: half,         h: height - third * 2 },
    { label: "Bot-Right", x: half, y: third * 2, w: width - half, h: height - third * 2 },
  ];

  const breakdown = quadrants.map(({ label, x, y, w, h }) => {
    const count = regionMismatch(diff.data, width, x, y, w, h);
    return { label, pct: ((count / (w * h)) * 100).toFixed(1) };
  });

  const modeLabel = structural ? " [structural]" : normalize ? " [normalized]" : "";
  const status =
    parseFloat(mismatchPercent) < 2 ? "PASS" :
    parseFloat(mismatchPercent) < 5 ? "REVIEW" : "FAIL";

  console.log(`
Comparison Results${modeLabel}:
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
    const hot = breakdown.filter((r) => parseFloat(r.pct) > 10).map((r) => r.label);
    if (hot.length) console.log("High-mismatch regions (>10%):", hot.join(", "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Comparison failed:", err.message);
  process.exit(1);
});
