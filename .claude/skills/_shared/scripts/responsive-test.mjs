#!/usr/bin/env node

/**
 * Responsive test — screenshots at multiple viewports and checks for layout issues.
 *
 * Usage:
 *   node responsive-test.mjs <url> [widths...]
 *
 * Default widths: 375 768 1024 1440
 * Screenshots saved to .claude/tmp/responsive-<width>.png
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);

if (args.includes("--help") || args.length < 1) {
  console.log(`
Responsive Test — Screenshot at multiple viewports.

Usage:
  node responsive-test.mjs <url> [widths...]

Default widths: 375 768 1024 1440
Output: .claude/tmp/responsive-<width>.png
`);
  process.exit(0);
}

const url = args[0];
const widths =
  args.length > 1
    ? args.slice(1).map(Number).filter((n) => !isNaN(n))
    : [375, 768, 1024, 1440];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const width of widths) {
    const page = await browser.newPage({
      viewport: { width, height: 900, deviceScaleFactor: 1 },
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    const tmpDir = `${process.cwd()}/.claude/tmp`;
    mkdirSync(tmpDir, { recursive: true });
    const outPath = `${tmpDir}/responsive-${width}.png`;
    await page.screenshot({ path: outPath, fullPage: true });

    const checks = await page.evaluate(() => {
      const issues = [];
      const docWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;

      if (scrollWidth > docWidth + 1) {
        issues.push(`Horizontal scroll: content ${scrollWidth}px > viewport ${docWidth}px`);
      }

      const allEls = document.querySelectorAll("*");
      let overflowCount = 0;
      allEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > docWidth + 2 && r.width > 0 && r.height > 0) {
          overflowCount++;
        }
      });
      if (overflowCount > 0) {
        issues.push(`${overflowCount} elements overflow viewport`);
      }

      const textEls = document.querySelectorAll("p, span, li, td, th, a, button, label, h1, h2, h3, h4, h5, h6");
      let tinyTextCount = 0;
      textEls.forEach((el) => {
        const s = getComputedStyle(el);
        if (parseInt(s.fontSize) < 10 && el.textContent.trim().length > 0) {
          tinyTextCount++;
        }
      });
      if (tinyTextCount > 0) {
        issues.push(`${tinyTextCount} elements with font-size < 10px`);
      }

      const overlaps = [];
      const interactiveEls = document.querySelectorAll("button, a, input, select, textarea");
      const rects = Array.from(interactiveEls).map((el) => ({
        tag: el.tagName,
        rect: el.getBoundingClientRect(),
      }));
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i].rect;
          const b = rects[j].rect;
          if (
            a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 &&
            a.left < b.right && a.right > b.left &&
            a.top < b.bottom && a.bottom > b.top
          ) {
            const overlapArea =
              Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
              Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            if (overlapArea > 100) {
              overlaps.push(`${rects[i].tag} overlaps ${rects[j].tag}`);
            }
          }
        }
      }
      if (overlaps.length > 0) {
        issues.push(`Overlapping interactives: ${overlaps.slice(0, 3).join(", ")}`);
      }

      return issues;
    });

    const status = checks.length === 0 ? "PASS" : "FAIL";
    const detail = checks.length === 0 ? "No issues" : checks.join("; ");
    results.push({ width, status, detail, path: outPath });

    console.log(`${width}px — [${status}] ${detail}`);
    await page.close();
  }

  await browser.close();

  const allPass = results.every((r) => r.status === "PASS");
  console.log(`\nOverall: ${allPass ? "PASS" : "FAIL"}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Responsive test failed:", err.message);
  process.exit(1);
});
