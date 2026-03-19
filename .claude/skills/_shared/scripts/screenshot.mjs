#!/usr/bin/env node

/**
 * Shared screenshot utility for pixel-perfect skills.
 *
 * Usage:
 *   node screenshot.mjs <url> [options]
 *
 * Options:
 *   --output <path>       Output file path (default: .claude/tmp/screenshot.png)
 *   --width <px>          Viewport width (default: 1440)
 *   --height <px>         Viewport height (default: 900)
 *   --full-page           Capture full page, not just viewport
 *   --wait <ms>           Extra wait time after load (default: 3000)
 *   --extract-text        Extract all visible text content
 *   --extract-styles      Extract computed styles (colors, fonts, sizes)
 *   --extract-measurements Extract element positions and dimensions
 *   --selector <css>      Measure specific CSS selector(s), comma-separated
 *   --wait-for <event>    domcontentloaded (default) | networkidle | load
 *   --help                Show this help
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);

if (args.includes("--help") || args.length < 1) {
  console.log(`
Screenshot Utility — Capture pages and extract data via Playwright.

Usage:
  node screenshot.mjs <url> [options]

Options:
  --output <path>            Output file (default: .claude/tmp/screenshot.png)
  --width <px>               Viewport width (default: 1440)
  --height <px>              Viewport height (default: 900)
  --full-page                Capture full scrollable page
  --wait <ms>                Extra wait after load (default: 3000)
  --extract-text             Print all visible text content
  --extract-styles           Print computed colors, fonts, sizes
  --extract-measurements     Print element positions and dimensions
  --selector <css>           Target selector(s) for measurements (comma-separated)
  --wait-for <event>         domcontentloaded | networkidle | load (default: domcontentloaded)
  --help                     Show this help
`);
  process.exit(0);
}

function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : fallback;
}

const url = args[0];
const defaultOutput = `${process.cwd()}/.claude/tmp/screenshot.png`;
const output = getArg("--output", defaultOutput);
const width = parseInt(getArg("--width", "1440"));
const height = parseInt(getArg("--height", "900"));
const fullPage = args.includes("--full-page");
const waitMs = parseInt(getArg("--wait", "3000"));
const extractText = args.includes("--extract-text");
const extractStyles = args.includes("--extract-styles");
const extractMeasurements = args.includes("--extract-measurements");
const selectors = getArg("--selector", "");
const waitFor = getArg("--wait-for", "domcontentloaded");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width, height, deviceScaleFactor: 1 },
  });

  await page.goto(url, { waitUntil: waitFor, timeout: 60000 });
  await page.waitForTimeout(waitMs);

  // Take screenshot
  mkdirSync(dirname(output), { recursive: true });
  await page.screenshot({ path: output, fullPage });
  console.log(`Screenshot: ${output}`);

  // Get page dimensions
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
  }));
  console.log(`Page: ${dims.scrollWidth}x${dims.scrollHeight} (viewport: ${dims.clientWidth}x${dims.clientHeight})`);

  // Extract text
  if (extractText) {
    const texts = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT
      );
      const result = [];
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim();
        if (t && t.length > 1) result.push(t);
      }
      return result;
    });
    console.log("\n=== TEXT CONTENT ===");
    texts.forEach((t) => console.log(t));
  }

  // Extract styles
  if (extractStyles) {
    const styles = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const bgColors = new Set();
      const textColors = new Set();
      const fontSizes = new Set();
      const fontFamilies = new Set();
      document.querySelectorAll("*").forEach((el) => {
        const s = getComputedStyle(el);
        if (s.backgroundColor !== "rgba(0, 0, 0, 0)")
          bgColors.add(s.backgroundColor);
        textColors.add(s.color);
        fontSizes.add(s.fontSize);
        fontFamilies.add(s.fontFamily);
      });
      return {
        bodyBg: body.backgroundColor,
        bodyFont: body.fontFamily,
        bodyColor: body.color,
        bgColors: [...bgColors],
        textColors: [...textColors],
        fontSizes: [...fontSizes].sort(
          (a, b) => parseInt(a) - parseInt(b)
        ),
        fontFamilies: [...fontFamilies],
      };
    });
    console.log("\n=== STYLES ===");
    console.log(JSON.stringify(styles, null, 2));
  }

  // Extract measurements
  if (extractMeasurements) {
    const targetSelectors = selectors
      ? selectors.split(",").map((s) => s.trim())
      : ["h1", "h2", "h3", "h4", "h5", "h6", "header", "footer", "main", "nav", "section", "img", "button", "a"];

    const measurements = await page.evaluate((sels) => {
      const results = {};
      for (const sel of sels) {
        const els = document.querySelectorAll(sel);
        if (els.length === 0) continue;
        results[sel] = Array.from(els).map((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return {
            text: el.textContent?.trim().slice(0, 60) || "",
            rect: {
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.width),
              h: Math.round(r.height),
            },
            padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
            margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            fontFamily: s.fontFamily,
            color: s.color,
            bg: s.backgroundColor !== "rgba(0, 0, 0, 0)" ? s.backgroundColor : undefined,
            borderRadius: s.borderRadius !== "0px" ? s.borderRadius : undefined,
            boxShadow: s.boxShadow !== "none" ? s.boxShadow : undefined,
            gap: s.gap !== "normal" ? s.gap : undefined,
          };
        });
      }
      return results;
    }, targetSelectors);
    console.log("\n=== MEASUREMENTS ===");
    console.log(JSON.stringify(measurements, null, 2));
  }

  // Extract images
  if (extractText || extractStyles) {
    const images = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img")).map((img) => ({
        src: img.src,
        alt: img.alt,
        w: Math.round(img.getBoundingClientRect().width),
        h: Math.round(img.getBoundingClientRect().height),
      }))
    );
    console.log("\n=== IMAGES ===");
    images.forEach((i) => console.log(JSON.stringify(i)));
  }

  // Extract links
  if (extractText) {
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a")).map((a) => ({
        href: a.href,
        text: a.textContent.trim().slice(0, 80),
      }))
    );
    console.log("\n=== LINKS ===");
    links.forEach((l) => console.log(JSON.stringify(l)));
  }

  await browser.close();
}

main().catch((err) => {
  console.error("Screenshot failed:", err.message);
  process.exit(1);
});
