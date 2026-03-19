#!/usr/bin/env node

import sharp from "sharp";

const args = process.argv.slice(2);

if (args.includes("--help") || args.length < 2) {
  console.log(`
Extract Color — Sample exact hex colors from a design image.

Usage (point sampling):
  node extract-color.mjs <image.png> <x,y> [x,y] ...

Usage (region dominant color):
  node extract-color.mjs <image.png> --region x,y,w,h [--region x,y,w,h] ...

Modes can be combined:
  node extract-color.mjs design.png 100,200 --region 0,0,200,80

Point examples:
  node extract-color.mjs design.png 100,200 300,400 50,600

Region examples:
  node extract-color.mjs design.png --region 0,0,584,80
  node extract-color.mjs design.png --region 0,0,200,60 --region 200,0,200,60

Output:
  (100, 200) → #1a2b3c
  region(0,0,584,80) → mean:#e2d9c4  dominant:#fefce6  (variance: low)
`);
  process.exit(0);
}

const imagePath = args[0];

// Parse point coordinates (non-flag args after image path)
const pointArgs = [];
const regionArgs = [];

for (let i = 1; i < args.length; i++) {
  if (args[i] === "--region" && args[i + 1]) {
    const parts = args[i + 1].split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      regionArgs.push({ x: parts[0], y: parts[1], w: parts[2], h: parts[3] });
    } else {
      console.error(`Invalid --region value: ${args[i + 1]}. Expected x,y,w,h`);
      process.exit(1);
    }
    i++;
  } else if (!args[i].startsWith("--")) {
    const [x, y] = args[i].split(",").map(Number);
    if (isNaN(x) || isNaN(y)) {
      console.error(`Invalid coordinate: ${args[i]}. Use format: x,y`);
      process.exit(1);
    }
    pointArgs.push({ x, y });
  }
}

async function samplePoint(filePath, x, y) {
  const { data } = await sharp(filePath)
    .toColourspace("srgb")
    .ensureAlpha()
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const r = data[0], g = data[1], b = data[2], a = data[3];
  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  const alpha = a < 255 ? ` (alpha: ${(a / 255).toFixed(2)})` : "";
  return `${hex}${alpha}`;
}

/**
 * Extract dominant and mean color from a rectangular region.
 * Uses quantization (step=8) to find the most frequent color bucket.
 */
async function sampleRegion(filePath, x, y, w, h) {
  const { data, info } = await sharp(filePath)
    .toColourspace("srgb")
    .extract({ left: x, top: y, width: w, height: h })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const pixelCount = w * h;

  let sumR = 0, sumG = 0, sumB = 0;
  const buckets = {};

  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];

    sumR += r; sumG += g; sumB += b;

    // Quantize to nearest 8 for frequency counting
    const qr = Math.round(r / 8) * 8;
    const qg = Math.round(g / 8) * 8;
    const qb = Math.round(b / 8) * 8;
    const key = `${qr},${qg},${qb}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }

  const meanR = Math.round(sumR / pixelCount);
  const meanG = Math.round(sumG / pixelCount);
  const meanB = Math.round(sumB / pixelCount);
  const meanHex = `#${meanR.toString(16).padStart(2, "0")}${meanG.toString(16).padStart(2, "0")}${meanB.toString(16).padStart(2, "0")}`;

  // Find most frequent bucket
  const [dominantKey] = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
  const [dr, dg, db] = dominantKey.split(",").map(Number);
  const dominantHex = `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;

  // Variance to indicate uniformity
  let sumSq = 0;
  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * channels] - meanR;
    const g = data[i * channels + 1] - meanG;
    const b = data[i * channels + 2] - meanB;
    sumSq += r * r + g * g + b * b;
  }
  const variance = sumSq / pixelCount;
  const varianceLabel = variance < 100 ? "very low" : variance < 500 ? "low" : variance < 2000 ? "medium" : "high";

  // Top 3 most frequent colors
  const top3 = Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => {
      const [r, g, b] = key.split(",").map(Number);
      const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      const pct = ((count / pixelCount) * 100).toFixed(1);
      return `${hex}(${pct}%)`;
    });

  return { meanHex, dominantHex, varianceLabel, top3 };
}

const metadata = await sharp(imagePath).metadata();
console.log(`Image: ${imagePath} (${metadata.width}x${metadata.height})\n`);

for (const { x, y } of pointArgs) {
  if (x >= metadata.width || y >= metadata.height || x < 0 || y < 0) {
    console.log(`(${x}, ${y}) → OUT OF BOUNDS`);
    continue;
  }
  const color = await samplePoint(imagePath, x, y);
  console.log(`(${x}, ${y}) → ${color}`);
}

for (const { x, y, w, h } of regionArgs) {
  if (x < 0 || y < 0 || x + w > metadata.width || y + h > metadata.height) {
    console.log(`region(${x},${y},${w},${h}) → OUT OF BOUNDS`);
    continue;
  }
  const { meanHex, dominantHex, varianceLabel, top3 } = await sampleRegion(imagePath, x, y, w, h);
  console.log(`region(${x},${y},${w},${h}) → mean:${meanHex}  dominant:${dominantHex}  (variance: ${varianceLabel})`);
  console.log(`  top colors: ${top3.join("  ")}`);
}
