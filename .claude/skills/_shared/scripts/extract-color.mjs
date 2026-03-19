#!/usr/bin/env node

import sharp from "sharp";

const args = process.argv.slice(2);

if (args.includes("--help") || args.length < 2) {
  console.log(`
Extract Color — Sample exact hex colors from a design image.

Usage:
  node extract-color.mjs <image.png> <x,y> [x,y] ...

Example:
  node extract-color.mjs design.png 100,200 300,400 50,600

Output:
  (100, 200) → #1a2b3c
  (300, 400) → #ffffff
  (50, 600)  → #0d0d0d
`);
  process.exit(0);
}

const imagePath = args[0];
const coordinates = args.slice(1).map((c) => {
  const [x, y] = c.split(",").map(Number);
  if (isNaN(x) || isNaN(y)) {
    console.error(`Invalid coordinate: ${c}. Use format: x,y`);
    process.exit(1);
  }
  return { x, y };
});

async function sampleColor(filePath, x, y) {
  const { data } = await sharp(filePath)
    .toColourspace("srgb")
    .ensureAlpha()
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const r = data[0];
  const g = data[1];
  const b = data[2];
  const a = data[3];

  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  const alpha = a < 255 ? ` (alpha: ${(a / 255).toFixed(2)})` : "";
  return `${hex}${alpha}`;
}

const metadata = await sharp(imagePath).metadata();
console.log(`Image: ${imagePath} (${metadata.width}x${metadata.height})\n`);

for (const { x, y } of coordinates) {
  if (x >= metadata.width || y >= metadata.height || x < 0 || y < 0) {
    console.log(`(${x}, ${y}) → OUT OF BOUNDS`);
    continue;
  }
  const color = await sampleColor(imagePath, x, y);
  console.log(`(${x}, ${y}) → ${color}`);
}
