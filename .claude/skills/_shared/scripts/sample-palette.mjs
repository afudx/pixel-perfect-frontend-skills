#!/usr/bin/env node

import sharp from "sharp";

const args = process.argv.slice(2);

if (args.includes("--help") || args.length < 1) {
  console.log(`
Sample Palette — Extract dominant colors from a design image.

Usage:
  node sample-palette.mjs <image.png> [--top N] [--quantize N]

Options:
  --top N       Show top N colors (default: 20)
  --quantize N  Quantization step size (default: 8, lower = more precise)

Example:
  node sample-palette.mjs design.png --top 30
`);
  process.exit(0);
}

const imagePath = args[0];
const topN = args.includes("--top")
  ? parseInt(args[args.indexOf("--top") + 1]) || 20
  : 20;
const quantStep = args.includes("--quantize")
  ? parseInt(args[args.indexOf("--quantize") + 1]) || 8
  : 8;

async function extractPalette(filePath) {
  const { data, info } = await sharp(filePath)
    .toColourspace("srgb")
    .removeAlpha()
    .resize(200, 200, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const colorCounts = {};
  const totalPixels = info.width * info.height;

  for (let i = 0; i < data.length; i += 3) {
    const r = Math.round(data[i] / quantStep) * quantStep;
    const g = Math.round(data[i + 1] / quantStep) * quantStep;
    const b = Math.round(data[i + 2] / quantStep) * quantStep;
    const hex = `#${Math.min(r, 255).toString(16).padStart(2, "0")}${Math.min(g, 255).toString(16).padStart(2, "0")}${Math.min(b, 255).toString(16).padStart(2, "0")}`;
    colorCounts[hex] = (colorCounts[hex] || 0) + 1;
  }

  return Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([hex, count]) => ({
      hex,
      frequency: ((count / totalPixels) * 100).toFixed(1),
    }));
}

const metadata = await sharp(imagePath).metadata();
console.log(`Image: ${imagePath} (${metadata.width}x${metadata.height})`);
console.log(`Quantization: ${quantStep}px step\n`);

const palette = await extractPalette(imagePath);
console.log("Dominant colors:");
palette.forEach(({ hex, frequency }) => {
  console.log(`  ${hex}  ${frequency}%`);
});
