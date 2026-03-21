#!/usr/bin/env node

/**
 * Flutter widget inspection utility — parses Maestro view hierarchy output.
 *
 * Usage:
 *   node flutter-inspect-widgets.mjs [options]
 *
 * Options:
 *   --input <path>          Path to Maestro hierarchy CSV file (saved from inspect_view_hierarchy)
 *   --device-id <id>        Capture hierarchy live via Maestro CLI (alternative to --input)
 *   --filter-text <text>    Filter elements containing this text
 *   --filter-clickable       Show only clickable elements
 *   --filter-bounds <WxH>   Show only elements smaller than WxH
 *   --compact                Compact output: one line per element, essential fields only (~70% smaller)
 *   --interactive-only       Show only clickable/input elements (alias for --filter-clickable + a11y)
 *   --top <N>               Limit output to first N elements
 *   --summary                Summary only: counts + a11y issues, no element list (~90% smaller)
 *   --json                  Output as JSON (default: table)
 *   --help                  Show this help
 *
 * The primary use of this script is to parse and analyze the CSV output from
 * Maestro's inspect_view_hierarchy MCP tool. In most cases, you'll use the
 * MCP tool directly and this script for post-processing.
 *
 * Output includes:
 *   - Element bounds (x, y, width, height)
 *   - Text content
 *   - Resource IDs
 *   - Interaction states (clickable, enabled, focused, checked, selected)
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);

if (args.includes("--help")) {
  console.log(`
Flutter Widget Inspector — Parse Maestro view hierarchy.

Usage:
  node flutter-inspect-widgets.mjs [options]

Options:
  --input <path>          Path to saved hierarchy CSV
  --device-id <id>        Capture live via Maestro CLI
  --filter-text <text>    Filter by text content
  --filter-clickable      Show only clickable elements
  --filter-bounds <WxH>   Show elements smaller than WxH
  --compact               One-line-per-element, essential fields only
  --interactive-only      Show only clickable/input elements + a11y
  --top <N>               Limit to first N elements
  --summary               Counts + a11y issues only (no element list)
  --json                  Output as JSON
  --help                  Show this help
`);
  process.exit(0);
}

function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : fallback;
}

const inputPath = getArg("--input", "");
const deviceId = getArg("--device-id", "");
const filterText = getArg("--filter-text", "");
const filterClickable = args.includes("--filter-clickable") || args.includes("--interactive-only");
const filterBounds = getArg("--filter-bounds", "");
const compact = args.includes("--compact");
const interactiveOnly = args.includes("--interactive-only");
const topN = parseInt(getArg("--top", "0"));
const summaryOnly = args.includes("--summary");
const jsonOutput = args.includes("--json");

function parseHierarchyCsv(csvContent) {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const elements = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const el = {};
    header.forEach((h, idx) => {
      el[h] = values[idx] || "";
    });

    // Parse bounds if present (format: x,y,width,height or [x,y][x2,y2])
    const bounds = {};
    if (el.bounds) {
      const boundsMatch = el.bounds.match(
        /(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
      );
      if (boundsMatch) {
        bounds.x = parseInt(boundsMatch[1]);
        bounds.y = parseInt(boundsMatch[2]);
        bounds.width = parseInt(boundsMatch[3]);
        bounds.height = parseInt(boundsMatch[4]);
      }
    }

    // Normalize field names
    elements.push({
      id: el.id || el["resource-id"] || el.resourceid || "",
      text: el.text || el.label || el.content || "",
      type: el.type || el.class || el.classname || "",
      bounds,
      clickable: el.clickable === "true",
      enabled: el.enabled === "true" || el.enabled === "",
      focused: el.focused === "true",
      checked: el.checked === "true",
      selected: el.selected === "true",
      depth: parseInt(el.depth || el.level || "0"),
      raw: el,
    });
  }

  return elements;
}

function parseHierarchyText(textContent) {
  // Maestro outputs hierarchy in various formats — handle non-CSV too
  const elements = [];
  const lines = textContent.trim().split("\n");

  for (const line of lines) {
    // Try to extract structured data from text output
    const idMatch = line.match(/id:\s*"?([^",\n]+)"?/i);
    const textMatch = line.match(/text:\s*"?([^",\n]+)"?/i);
    const boundsMatch = line.match(
      /bounds:\s*\[?(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\]?/i
    );
    const clickableMatch = line.match(/clickable:\s*(true|false)/i);
    const enabledMatch = line.match(/enabled:\s*(true|false)/i);

    if (textMatch || boundsMatch || idMatch) {
      elements.push({
        id: idMatch ? idMatch[1] : "",
        text: textMatch ? textMatch[1] : "",
        type: "",
        bounds: boundsMatch
          ? {
              x: parseInt(boundsMatch[1]),
              y: parseInt(boundsMatch[2]),
              width: parseInt(boundsMatch[3]),
              height: parseInt(boundsMatch[4]),
            }
          : {},
        clickable: clickableMatch ? clickableMatch[1] === "true" : false,
        enabled: enabledMatch ? enabledMatch[1] === "true" : true,
        focused: false,
        checked: false,
        selected: false,
        depth: 0,
        raw: line.trim(),
      });
    }
  }

  return elements;
}

function applyFilters(elements) {
  let filtered = elements;

  if (filterText) {
    const lower = filterText.toLowerCase();
    filtered = filtered.filter(
      (el) =>
        el.text.toLowerCase().includes(lower) ||
        el.id.toLowerCase().includes(lower)
    );
  }

  if (filterClickable) {
    filtered = filtered.filter((el) => el.clickable);
  }

  if (filterBounds) {
    const [maxW, maxH] = filterBounds.split("x").map(Number);
    filtered = filtered.filter(
      (el) =>
        el.bounds.width &&
        el.bounds.height &&
        el.bounds.width <= maxW &&
        el.bounds.height <= maxH
    );
  }

  return filtered;
}

function analyzeAccessibility(elements) {
  const issues = [];

  // Check clickable elements without text (unnamed interactives)
  const clickableNoText = elements.filter(
    (el) => el.clickable && !el.text && !el.id
  );
  if (clickableNoText.length > 0) {
    issues.push({
      type: "unnamed-interactive",
      count: clickableNoText.length,
      message: `${clickableNoText.length} clickable element(s) without text or ID`,
    });
  }

  // Check touch target sizes (minimum 48x48dp)
  const smallTargets = elements.filter(
    (el) =>
      el.clickable &&
      el.bounds.width &&
      el.bounds.height &&
      (el.bounds.width < 48 || el.bounds.height < 48)
  );
  if (smallTargets.length > 0) {
    issues.push({
      type: "small-touch-target",
      count: smallTargets.length,
      elements: smallTargets.map((el) => ({
        text: el.text || el.id || "(unnamed)",
        size: `${el.bounds.width}x${el.bounds.height}`,
      })),
      message: `${smallTargets.length} interactive element(s) below 48x48dp minimum`,
    });
  }

  return issues;
}

function main() {
  let content = "";

  if (inputPath) {
    if (!existsSync(inputPath)) {
      console.error(`[FAIL] Input file not found: ${inputPath}`);
      process.exit(1);
    }
    content = readFileSync(inputPath, "utf-8");
  } else if (deviceId) {
    try {
      content = execSync(`maestro hierarchy --device-id ${deviceId}`, {
        encoding: "utf-8",
        timeout: 15000,
      });
    } catch (err) {
      console.error(`[FAIL] Maestro hierarchy capture failed: ${err.message}`);
      console.error(
        "       Use Maestro MCP inspect_view_hierarchy instead."
      );
      process.exit(1);
    }
  } else {
    console.error(
      "[FAIL] Provide --input <path> or --device-id <id>"
    );
    console.error(
      "       Or use Maestro MCP inspect_view_hierarchy directly."
    );
    process.exit(1);
  }

  // Try CSV parsing first, fall back to text parsing
  let elements;
  if (content.includes(",") && content.split("\n")[0].includes("id")) {
    elements = parseHierarchyCsv(content);
  } else {
    elements = parseHierarchyText(content);
  }

  let filtered = applyFilters(elements);
  const a11yIssues = analyzeAccessibility(elements);

  // Apply --top limit
  if (topN > 0) {
    filtered = filtered.slice(0, topN);
  }

  if (jsonOutput) {
    const output = summaryOnly
      ? {
          total: elements.length,
          clickable: elements.filter((e) => e.clickable).length,
          withText: elements.filter((e) => e.text).length,
          accessibility: a11yIssues,
        }
      : {
          total: elements.length,
          filtered: filtered.length,
          elements: compact
            ? filtered.map((e) => {
                const o = {};
                if (e.text) o.t = e.text;
                if (e.id) o.id = e.id;
                if (e.bounds.width) o.b = `${e.bounds.x},${e.bounds.y},${e.bounds.width}x${e.bounds.height}`;
                if (e.clickable) o.c = 1;
                if (!e.enabled) o.d = 1;
                return o;
              })
            : filtered,
          accessibility: a11yIssues,
        };
    console.log(JSON.stringify(output, null, compact ? 0 : 2));
  } else if (summaryOnly) {
    // ~90% token reduction: just counts and issues
    const clickable = elements.filter((e) => e.clickable).length;
    const withText = elements.filter((e) => e.text).length;
    const disabled = elements.filter((e) => !e.enabled).length;
    console.log(`Hierarchy: ${elements.length} elements | ${clickable} clickable | ${withText} with text | ${disabled} disabled`);
    if (a11yIssues.length > 0) {
      for (const issue of a11yIssues) {
        console.log(`[WARN] ${issue.message}`);
      }
    } else {
      console.log("[PASS] No accessibility issues");
    }
  } else if (compact) {
    // ~70% token reduction: one line per element, essential fields only
    console.log(`=== ${elements.length} elements (${filtered.length} shown) ===`);
    for (const el of filtered) {
      const parts = [];
      if (el.text) parts.push(el.text);
      else if (el.id) parts.push(`#${el.id}`);
      else parts.push(el.type || "?");
      if (el.bounds.width) parts.push(`${el.bounds.width}x${el.bounds.height}`);
      const flags = [];
      if (el.clickable) flags.push("tap");
      if (!el.enabled) flags.push("off");
      if (el.focused) flags.push("foc");
      if (el.checked) flags.push("chk");
      if (flags.length) parts.push(`[${flags.join(",")}]`);
      console.log(parts.join(" | "));
    }
    if (a11yIssues.length > 0) {
      for (const issue of a11yIssues) {
        console.log(`[WARN] ${issue.message}`);
      }
    }
  } else {
    console.log(`=== Widget Hierarchy: ${elements.length} elements ===\n`);

    for (const el of filtered) {
      const parts = [];
      if (el.text) parts.push(`text="${el.text}"`);
      if (el.id) parts.push(`id="${el.id}"`);
      if (el.type) parts.push(`type=${el.type}`);
      if (el.bounds.width)
        parts.push(
          `bounds=(${el.bounds.x},${el.bounds.y} ${el.bounds.width}x${el.bounds.height})`
        );
      if (el.clickable) parts.push("clickable");
      if (!el.enabled) parts.push("DISABLED");
      if (el.focused) parts.push("FOCUSED");
      if (el.checked) parts.push("CHECKED");

      const indent = "  ".repeat(el.depth);
      console.log(`${indent}${parts.join(" | ")}`);
    }

    if (a11yIssues.length > 0) {
      console.log("\n=== Accessibility Issues ===");
      for (const issue of a11yIssues) {
        console.log(`[WARN] ${issue.message}`);
        if (issue.elements) {
          issue.elements.forEach((el) =>
            console.log(`       - ${el.text} (${el.size})`)
          );
        }
      }
    }
  }
}

main();
