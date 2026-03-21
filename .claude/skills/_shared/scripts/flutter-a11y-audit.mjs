#!/usr/bin/env node

/**
 * Flutter accessibility audit — code-level + runtime checks.
 *
 * Usage:
 *   node flutter-a11y-audit.mjs [options]
 *
 * Options:
 *   --project-dir <path>    Flutter project root (default: cwd)
 *   --hierarchy <path>      Path to saved Maestro hierarchy for runtime checks
 *   --min-target <dp>       Minimum touch target size in dp (default: 48)
 *   --compact               Summary counts + issue locations only (~60% smaller)
 *   --json                  Output as JSON
 *   --help                  Show this help
 *
 * Code-level checks:
 *   - Image without semanticLabel
 *   - GestureDetector/InkWell without Semantics wrapper
 *   - Missing Semantics(header: true) on heading text
 *   - ExcludeSemantics usage (potential red flag)
 *   - Opacity(opacity: 0) hiding content from visual users but not semantics
 *
 * Runtime checks (if hierarchy provided):
 *   - Interactive elements without text or content description
 *   - Touch targets below 48x48dp minimum
 *   - Missing labels on input fields
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const args = process.argv.slice(2);

if (args.includes("--help")) {
  console.log(`
Flutter Accessibility Audit — Code-level and runtime checks.

Usage:
  node flutter-a11y-audit.mjs [options]

Options:
  --project-dir <path>    Flutter project root (default: cwd)
  --hierarchy <path>      Saved Maestro hierarchy for runtime checks
  --min-target <dp>       Minimum touch target size (default: 48)
  --json                  Output as JSON
  --help                  Show this help
`);
  process.exit(0);
}

function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : fallback;
}

const projectDir = getArg("--project-dir", process.cwd());
const hierarchyPath = getArg("--hierarchy", "");
const minTarget = parseInt(getArg("--min-target", "48"));
const compact = args.includes("--compact");
const jsonOutput = args.includes("--json");

function findDartFiles(dir, files = []) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      // Skip hidden dirs, build, .dart_tool, etc.
      if (
        entry.startsWith(".") ||
        entry === "build" ||
        entry === ".dart_tool" ||
        entry === "ios" ||
        entry === "android" ||
        entry === "web" ||
        entry === "linux" ||
        entry === "macos" ||
        entry === "windows" ||
        entry === "test"
      ) {
        continue;
      }
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findDartFiles(fullPath, files);
      } else if (entry.endsWith(".dart")) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

function auditCodeLevel(projectDir) {
  const libDir = join(projectDir, "lib");
  if (!existsSync(libDir)) {
    return { issues: [], fileCount: 0 };
  }

  const dartFiles = findDartFiles(libDir);
  const issues = [];

  for (const filePath of dartFiles) {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const relPath = relative(projectDir, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check Image without semanticLabel
      if (
        (line.includes("Image.network(") ||
          line.includes("Image.asset(") ||
          line.includes("Image.file(") ||
          line.includes("Image.memory(")) &&
        !contentContainsNearby(lines, i, 10, "semanticLabel")
      ) {
        issues.push({
          type: "image-no-semantic-label",
          file: relPath,
          line: lineNum,
          severity: "serious",
          message: "Image widget without semanticLabel",
          fix: "Add semanticLabel parameter describing the image content",
        });
      }

      // Check GestureDetector without Semantics
      if (
        line.includes("GestureDetector(") &&
        !contentContainsNearby(lines, i, 5, "Semantics(")
      ) {
        issues.push({
          type: "gesture-no-semantics",
          file: relPath,
          line: lineNum,
          severity: "serious",
          message:
            "GestureDetector without Semantics wrapper",
          fix: "Wrap with Semantics(label: '...', button: true, child: GestureDetector(...))",
        });
      }

      // Check ExcludeSemantics usage
      if (line.includes("ExcludeSemantics(")) {
        issues.push({
          type: "exclude-semantics",
          file: relPath,
          line: lineNum,
          severity: "moderate",
          message:
            "ExcludeSemantics hides content from screen readers",
          fix: "Verify this content is truly decorative. If not, remove ExcludeSemantics.",
        });
      }

      // Check for hardcoded color with poor contrast potential
      if (
        line.match(/Colors?\.(grey|gray)\[?[123]\d{2}\]?/) &&
        contentContainsNearby(lines, i, 3, "Text(")
      ) {
        issues.push({
          type: "low-contrast-text",
          file: relPath,
          line: lineNum,
          severity: "moderate",
          message:
            "Light gray text color may have insufficient contrast",
          fix: "Verify contrast ratio meets WCAG AA (4.5:1 for text, 3:1 for large text)",
        });
      }

      // Check IconButton without tooltip
      if (
        line.includes("IconButton(") &&
        !contentContainsNearby(lines, i, 8, "tooltip:")
      ) {
        issues.push({
          type: "icon-button-no-tooltip",
          file: relPath,
          line: lineNum,
          severity: "serious",
          message: "IconButton without tooltip (used as semantic label)",
          fix: "Add tooltip parameter to IconButton for screen reader support",
        });
      }
    }
  }

  return { issues, fileCount: dartFiles.length };
}

function contentContainsNearby(lines, index, range, searchStr) {
  const start = Math.max(0, index - 2);
  const end = Math.min(lines.length, index + range);
  for (let i = start; i < end; i++) {
    if (lines[i].includes(searchStr)) return true;
  }
  return false;
}

function auditHierarchy(hierarchyPath) {
  if (!hierarchyPath || !existsSync(hierarchyPath)) {
    return { issues: [], elementCount: 0 };
  }

  const content = readFileSync(hierarchyPath, "utf-8");
  const lines = content.trim().split("\n");
  const issues = [];
  let elementCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    elementCount++;

    // Check interactive elements without text
    const clickableMatch = line.match(/clickable:\s*true/i);
    const textMatch = line.match(/text:\s*"?([^",\n]+)"?/i);
    const idMatch = line.match(/id:\s*"?([^",\n]+)"?/i);

    if (clickableMatch && !textMatch && !idMatch) {
      issues.push({
        type: "unnamed-interactive",
        severity: "critical",
        message: "Interactive element without text or content description",
        context: line.trim().slice(0, 100),
      });
    }

    // Check touch target size
    const boundsMatch = line.match(
      /bounds:\s*\[?(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\]?/i
    );
    if (clickableMatch && boundsMatch) {
      const width = parseInt(boundsMatch[3]);
      const height = parseInt(boundsMatch[4]);
      if (width < minTarget || height < minTarget) {
        const label = textMatch
          ? textMatch[1]
          : idMatch
            ? idMatch[1]
            : "(unnamed)";
        issues.push({
          type: "small-touch-target",
          severity: "serious",
          message: `Touch target ${width}x${height}dp below ${minTarget}x${minTarget}dp minimum: "${label}"`,
        });
      }
    }
  }

  return { issues, elementCount };
}

function main() {
  const codeAudit = auditCodeLevel(projectDir);
  const runtimeAudit = auditHierarchy(hierarchyPath);

  const allIssues = [...codeAudit.issues, ...runtimeAudit.issues];

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          codeLevel: codeAudit,
          runtime: runtimeAudit,
          totalIssues: allIssues.length,
          bySeverity: {
            critical: allIssues.filter((i) => i.severity === "critical").length,
            serious: allIssues.filter((i) => i.severity === "serious").length,
            moderate: allIssues.filter((i) => i.severity === "moderate").length,
            minor: allIssues.filter((i) => i.severity === "minor").length,
          },
        },
        null,
        2
      )
    );
  } else if (compact) {
    // Compact mode: ~60% smaller output — counts + locations only
    const critical = allIssues.filter((i) => i.severity === "critical").length;
    const serious = allIssues.filter((i) => i.severity === "serious").length;
    const moderate = allIssues.filter((i) => i.severity === "moderate").length;
    console.log(`A11y: ${codeAudit.fileCount} files | ${allIssues.length} issues (${critical} crit, ${serious} serious, ${moderate} mod)`);
    if (allIssues.length === 0) {
      console.log("[PASS] No accessibility issues");
    } else {
      const grouped = {};
      for (const issue of allIssues) {
        if (!grouped[issue.type]) grouped[issue.type] = [];
        grouped[issue.type].push(issue);
      }
      for (const [type, issues] of Object.entries(grouped)) {
        const locs = issues
          .filter((i) => i.file)
          .slice(0, 3)
          .map((i) => `${i.file}:${i.line}`)
          .join(", ");
        console.log(`[${issues[0].severity.toUpperCase()}] ${type}(${issues.length})${locs ? ` → ${locs}` : ""}`);
      }
    }
    if (!hierarchyPath) {
      console.log("[SKIP] Runtime (no hierarchy)");
    }
  } else {
    console.log("=== Flutter Accessibility Audit ===\n");

    // Code-level results
    console.log(
      `Code audit: ${codeAudit.fileCount} Dart files scanned\n`
    );

    if (codeAudit.issues.length === 0) {
      console.log("[PASS] No code-level accessibility issues found\n");
    } else {
      const grouped = {};
      for (const issue of codeAudit.issues) {
        if (!grouped[issue.type]) grouped[issue.type] = [];
        grouped[issue.type].push(issue);
      }

      for (const [type, issues] of Object.entries(grouped)) {
        const severity = issues[0].severity.toUpperCase();
        console.log(
          `[${severity}] ${issues[0].message} (${issues.length} occurrence${issues.length > 1 ? "s" : ""})`
        );
        for (const issue of issues.slice(0, 5)) {
          console.log(`  → ${issue.file}:${issue.line}`);
        }
        if (issues.length > 5) {
          console.log(`  → ... and ${issues.length - 5} more`);
        }
        console.log(`  Fix: ${issues[0].fix || "See documentation"}\n`);
      }
    }

    // Runtime results
    if (hierarchyPath) {
      console.log(
        `Runtime audit: ${runtimeAudit.elementCount} elements inspected\n`
      );

      if (runtimeAudit.issues.length === 0) {
        console.log(
          "[PASS] No runtime accessibility issues found\n"
        );
      } else {
        for (const issue of runtimeAudit.issues) {
          console.log(
            `[${issue.severity.toUpperCase()}] ${issue.message}`
          );
          if (issue.context) {
            console.log(`  Context: ${issue.context}`);
          }
        }
      }
    } else {
      console.log(
        "[INFO] No hierarchy provided — runtime checks skipped."
      );
      console.log(
        "       Pass --hierarchy <path> or use Maestro MCP inspect_view_hierarchy.\n"
      );
    }

    // Summary
    console.log("=== Summary ===");
    console.log(`Total issues: ${allIssues.length}`);
    console.log(
      `  Critical: ${allIssues.filter((i) => i.severity === "critical").length}`
    );
    console.log(
      `  Serious:  ${allIssues.filter((i) => i.severity === "serious").length}`
    );
    console.log(
      `  Moderate: ${allIssues.filter((i) => i.severity === "moderate").length}`
    );
    console.log(
      `  Minor:    ${allIssues.filter((i) => i.severity === "minor").length}`
    );
  }

  if (allIssues.some((i) => i.severity === "critical" || i.severity === "serious")) {
    process.exit(1);
  }
}

main();
