#!/usr/bin/env node

/**
 * Responsive test — screenshots at multiple viewports and checks for layout issues.
 *
 * Usage:
 *   node responsive-test.mjs <url> [widths...]
 *
 * Default widths: 375 768 1024 1440
 * Screenshots saved to .claude/tmp/responsive-<width>.png
 *
 * Exit codes:
 *   0  No errors at any viewport (warnings are allowed)
 *   1  At least one hard layout error (overflow, overlapping interactives)
 */

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
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

const { chromium } = resolveShared("playwright");

const args = process.argv.slice(2);

if (args.includes("--help") || args.length < 1) {
  console.log(`
Responsive Test — Screenshot at multiple viewports.

Usage:
  node responsive-test.mjs <url> [widths...]

Default widths: 375 768 1024 1440
Output: .claude/tmp/responsive-<width>.png

Exit codes:
  0  No hard errors (warnings like small fonts are noted but do not fail)
  1  Hard layout error: horizontal overflow or overlapping interactive elements
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
      const errors = [];
      const warnings = [];
      const docWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;

      // Hard error: horizontal scrollbar
      if (scrollWidth > docWidth + 1) {
        errors.push(`Horizontal scroll: content ${scrollWidth}px > viewport ${docWidth}px`);
      }

      // Hard error: elements clipped outside viewport
      let overflowCount = 0;
      document.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > docWidth + 2 && r.width > 0 && r.height > 0) overflowCount++;
      });
      if (overflowCount > 0) errors.push(`${overflowCount} elements overflow viewport`);

      // Warning only: intentionally small text (e.g. timeline labels, badges)
      let tinyTextCount = 0;
      document.querySelectorAll("p, span, li, td, th, a, button, label, h1, h2, h3, h4, h5, h6").forEach((el) => {
        if (parseInt(getComputedStyle(el).fontSize) < 10 && el.textContent.trim().length > 0) tinyTextCount++;
      });
      if (tinyTextCount > 0) {
        warnings.push(`${tinyTextCount} element(s) with font-size < 10px — verify these are intentional (e.g. labels, badges)`);
      }

      // Hard error: overlapping interactive elements (tap-target collision)
      const interactiveEls = document.querySelectorAll("button, a, input, select, textarea");
      const rects = Array.from(interactiveEls).map((el) => ({
        tag: el.tagName,
        rect: el.getBoundingClientRect(),
      }));
      const overlaps = [];
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
            if (overlapArea > 100) overlaps.push(`${rects[i].tag} overlaps ${rects[j].tag}`);
          }
        }
      }
      if (overlaps.length > 0) errors.push(`Overlapping interactives: ${overlaps.slice(0, 3).join(", ")}`);

      return { errors, warnings };
    });

    const hasError = checks.errors.length > 0;
    const status = hasError ? "FAIL" : "PASS";

    let line = `${width}px — [${status}]`;
    if (checks.errors.length > 0) line += ` ${checks.errors.join("; ")}`;
    else line += " No layout errors";
    if (checks.warnings.length > 0) line += `\n         [WARN] ${checks.warnings.join("; ")}`;

    console.log(line);
    results.push({ width, status, errors: checks.errors, warnings: checks.warnings, path: outPath });
    await page.close();
  }

  await browser.close();

  const anyErrors = results.some((r) => r.status === "FAIL");
  const anyWarnings = results.some((r) => r.warnings.length > 0);

  console.log(`\nOverall: ${anyErrors ? "FAIL" : "PASS"}${anyWarnings ? " (with warnings — review manually)" : ""}`);
  process.exit(anyErrors ? 1 : 0);
}

main().catch((err) => {
  console.error("Responsive test failed:", err.message);
  process.exit(1);
});
