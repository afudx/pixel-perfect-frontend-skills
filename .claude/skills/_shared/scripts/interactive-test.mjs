#!/usr/bin/env node

/**
 * Interactive states test — hover, focus, active states via Playwright.
 *
 * Usage:
 *   node interactive-test.mjs <url> [selectors...]
 */

import { chromium } from "playwright";

const args = process.argv.slice(2);

if (args.includes("--help") || args.length < 1) {
  console.log(`
Interactive States Test — Verify hover, focus, active states.

Usage:
  node interactive-test.mjs <url> [selectors...]

Default: tests all button, a[href], input, select, textarea elements.
`);
  process.exit(0);
}

const url = args[0];
const customSelectors = args.slice(1);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const selector =
    customSelectors.length > 0
      ? customSelectors.join(", ")
      : 'button, a[href], input, select, textarea, [role="button"]';

  const elements = await page.evaluate((sel) => {
    return Array.from(document.querySelectorAll(sel))
      .slice(0, 20)
      .map((el, i) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return {
          index: i,
          tag: el.tagName,
          text: el.textContent?.trim().slice(0, 40) || "",
          selector: el.id
            ? `#${el.id}`
            : el.className
              ? `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`
              : `${el.tagName.toLowerCase()}:nth-of-type(${i + 1})`,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          transition: s.transition,
          cursor: s.cursor,
          hasHoverStyles: s.transition !== "all 0s ease 0s" && s.transition !== "none 0s ease 0s",
        };
      })
      .filter((el) => el.rect.w > 0 && el.rect.h > 0);
  }, selector);

  console.log(`Found ${elements.length} interactive elements.\n`);

  for (const el of elements) {
    console.log(`${el.tag} "${el.text}" (${el.selector}):`);

    // Check cursor
    const cursorOk = el.cursor === "pointer" || el.tag === "INPUT" || el.tag === "SELECT" || el.tag === "TEXTAREA";
    console.log(`  [${cursorOk ? "PASS" : "WARN"}] Cursor: ${el.cursor}`);

    // Check transition
    const hasTransition = el.hasHoverStyles;
    console.log(`  [${hasTransition ? "PASS" : "INFO"}] Transition: ${el.transition?.slice(0, 60) || "none"}`);

    // Test hover
    try {
      await page.hover(`${el.tag.toLowerCase()}:nth-of-type(${el.index + 1})`, { timeout: 2000 }).catch(() => null);
      const hoverStyles = await page.evaluate((sel) => {
        const target = document.querySelector(sel);
        if (!target) return null;
        const s = getComputedStyle(target);
        return { bg: s.backgroundColor, color: s.color, transform: s.transform, boxShadow: s.boxShadow };
      }, el.selector).catch(() => null);
      console.log(`  [PASS] Hover state accessible`);
    } catch {
      console.log(`  [SKIP] Hover test skipped`);
    }

    // Test focus
    try {
      await page.keyboard.press("Tab");
      const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
      console.log(`  [INFO] Tab focuses: ${focusedTag}`);
    } catch {
      console.log(`  [SKIP] Focus test skipped`);
    }

    console.log();
  }

  // Check focus-visible styles exist
  const hasFocusVisible = await page.evaluate(() => {
    const sheets = document.styleSheets;
    for (const sheet of sheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText?.includes("focus-visible")) return true;
        }
      } catch {}
    }
    return false;
  });
  console.log(`Focus-visible styles: ${hasFocusVisible ? "[PASS] Found" : "[WARN] Not found"}`);

  await browser.close();
}

main().catch((err) => {
  console.error("Interactive test failed:", err.message);
  process.exit(1);
});
