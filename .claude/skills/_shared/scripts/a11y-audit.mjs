#!/usr/bin/env node

/**
 * Accessibility audit — injects axe-core via Playwright and runs checks.
 *
 * Usage:
 *   node a11y-audit.mjs <url>
 */

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);

if (args.includes("--help") || args.length < 1) {
  console.log(`
Accessibility Audit — Run axe-core checks via Playwright.

Usage:
  node a11y-audit.mjs <url>
`);
  process.exit(0);
}

const url = args[0];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Find axe-core
  let axePath;
  const candidates = [
    resolve("node_modules/axe-core/axe.min.js"),
    resolve("node_modules/axe-core/axe.js"),
  ];
  for (const c of candidates) {
    try {
      readFileSync(c, "utf8");
      axePath = c;
      break;
    } catch {}
  }

  if (!axePath) {
    console.error("axe-core not found. Run: npm install --save-dev axe-core");
    process.exit(1);
  }

  // Inject axe-core and run
  const axeSource = readFileSync(axePath, "utf8");
  const results = await page.evaluate((src) => {
    eval(src);
    return window.axe.run();
  }, axeSource);

  // Report violations
  console.log("=== AXE-CORE AUDIT ===\n");

  if (results.violations.length === 0) {
    console.log("[PASS] No accessibility violations found.\n");
  } else {
    console.log(`[FAIL] ${results.violations.length} violation(s) found:\n`);
    for (const v of results.violations) {
      console.log(`  ${v.impact?.toUpperCase()} — ${v.id}: ${v.help}`);
      console.log(`    ${v.helpUrl}`);
      for (const node of v.nodes.slice(0, 3)) {
        console.log(`    → ${node.target.join(", ")}`);
        if (node.failureSummary) {
          console.log(`      ${node.failureSummary.split("\n")[0]}`);
        }
      }
      if (v.nodes.length > 3) {
        console.log(`    ... and ${v.nodes.length - 3} more`);
      }
      console.log();
    }
  }

  // Manual checks
  console.log("=== MANUAL CHECKS ===\n");

  const manualResults = await page.evaluate(() => {
    const checks = {};

    // Alt text
    const imgs = document.querySelectorAll("img");
    const missingAlt = Array.from(imgs).filter(
      (img) => !img.alt && !img.getAttribute("role")?.includes("presentation")
    );
    checks.altText = {
      total: imgs.length,
      missing: missingAlt.length,
      pass: missingAlt.length === 0,
    };

    // Heading hierarchy
    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, h5, h6")
    ).map((h) => parseInt(h.tagName[1]));
    let skipped = false;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] > headings[i - 1] + 1) {
        skipped = true;
        break;
      }
    }
    checks.headingHierarchy = {
      levels: headings,
      skipped,
      pass: !skipped,
    };

    // Form labels
    const inputs = document.querySelectorAll(
      "input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea"
    );
    const unlabeled = Array.from(inputs).filter((input) => {
      const id = input.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.getAttribute("aria-label");
      const hasAriaLabelledBy = input.getAttribute("aria-labelledby");
      const wrappedInLabel = input.closest("label");
      return !hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !wrappedInLabel;
    });
    checks.formLabels = {
      total: inputs.length,
      unlabeled: unlabeled.length,
      pass: unlabeled.length === 0,
    };

    // Keyboard-focusable interactive elements
    const interactives = document.querySelectorAll(
      "button, a[href], input, select, textarea, [tabindex]"
    );
    checks.keyboardNav = {
      total: interactives.length,
      pass: interactives.length > 0,
    };

    return checks;
  });

  for (const [check, result] of Object.entries(manualResults)) {
    const status = result.pass ? "PASS" : "FAIL";
    const details = JSON.stringify(result);
    console.log(`[${status}] ${check}: ${details}`);
  }

  console.log(
    `\nTotal violations: ${results.violations.length}`
  );

  await browser.close();
  process.exit(results.violations.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Accessibility audit failed:", err.message);
  process.exit(1);
});
