#!/usr/bin/env node

/**
 * Inspect computed styles — extract and compare CSS values via Playwright.
 *
 * Usage:
 *   node inspect-styles.mjs <url> [selectors...]
 *
 * Default: inspects h1-h6, p, button, a, img, section, header, footer, main, nav
 */

import { createRequire } from "node:module";
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
Inspect Styles — Extract computed CSS styles via Playwright.

Usage:
  node inspect-styles.mjs <url> [selectors...]

Default selectors: h1,h2,h3,h4,h5,h6,p,button,a,img,section,header,footer,main,nav
`);
  process.exit(0);
}

const url = args[0];
const selectors =
  args.length > 1
    ? args.slice(1)
    : ["h1", "h2", "h3", "h4", "h5", "h6", "p", "button", "a", "img", "section", "header", "footer", "main", "nav"];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const results = await page.evaluate((sels) => {
    const output = {};
    for (const sel of sels) {
      const els = document.querySelectorAll(sel);
      if (els.length === 0) continue;
      output[sel] = Array.from(els)
        .slice(0, 10)
        .map((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return {
            text: el.textContent?.trim().slice(0, 50) || "",
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            typography: {
              fontFamily: s.fontFamily,
              fontSize: s.fontSize,
              fontWeight: s.fontWeight,
              fontStyle: s.fontStyle,
              lineHeight: s.lineHeight,
              letterSpacing: s.letterSpacing,
              textTransform: s.textTransform,
              textAlign: s.textAlign,
              color: s.color,
            },
            spacing: {
              padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
              margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
              gap: s.gap !== "normal" ? s.gap : undefined,
            },
            visual: {
              backgroundColor: s.backgroundColor !== "rgba(0, 0, 0, 0)" ? s.backgroundColor : undefined,
              borderRadius: s.borderRadius !== "0px" ? s.borderRadius : undefined,
              borderWidth: s.borderWidth !== "0px" ? s.borderWidth : undefined,
              borderColor: s.borderWidth !== "0px" ? s.borderColor : undefined,
              boxShadow: s.boxShadow !== "none" ? s.boxShadow : undefined,
            },
            layout: {
              display: s.display,
              maxWidth: s.maxWidth !== "none" ? s.maxWidth : undefined,
              width: s.width,
              height: s.height,
            },
          };
        });
    }
    return output;
  }, selectors);

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error("Style inspection failed:", err.message);
  process.exit(1);
});
