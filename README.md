# Pixel-Perfect Frontend Skills

Claude Code skills for automated design-to-code workflow. Analyze designs, scaffold projects, build components, and verify pixel-level accuracy — all through slash commands.

## Requirements

- [Claude Code](https://claude.com/claude-code) CLI
- Node.js v18+
- npm

## Installation

Copy the `.claude/skills/` directory and `CLAUDE.md` into your project root:

```bash
# Clone this repo
git clone https://github.com/afudx/pixel-perfect-frontend-skills.git

# Copy skills into your project
cp -r pixel-perfect-frontend-skills/.claude/skills/ your-project/.claude/skills/
cp pixel-perfect-frontend-skills/CLAUDE.md your-project/CLAUDE.md
```

Or add as a subtree:

```bash
git subtree add --prefix=.claude/skills https://github.com/afudx/pixel-perfect-frontend-skills.git main --squash
```

## Skills

### Setup

| Skill | Command | Description |
|-------|---------|-------------|
| **preflight** | `/preflight [design-image]` | Install all dependencies and verify tools are ready |
| **setup-project** | `/setup-project [vite\|next]` | Scaffold project with Tailwind, utils, and directory structure |

### Analysis

| Skill | Command | Description |
|-------|---------|-------------|
| **analyze-design** | `/analyze-design [image-or-url]` | Extract colors, typography, spacing, layout, and component inventory |
| **extract-colors** | `/extract-colors <image> <x,y> ...` | Sample exact hex values at specific pixel coordinates |
| **sample-palette** | `/sample-palette <image> [--top N]` | Extract dominant color palette from an image |

### Build

| Skill | Command | Description |
|-------|---------|-------------|
| **pixel-diff** | `/pixel-diff <design> <screenshot> [--normalize]` | Pixel-level comparison with diff image output |
| **fix-loop** | `/fix-loop <design> <url>` | Iterative fix cycle: edit, screenshot, diff, repeat |

### Verification

| Skill | Command | Description |
|-------|---------|-------------|
| **verify-styles** | `/verify-styles <url> [selectors]` | Inspect computed CSS against design tokens |
| **verify-interactive** | `/verify-interactive <url> [selectors]` | Test hover, focus, active, disabled states |
| **verify-responsive** | `/verify-responsive <url> [widths]` | Screenshot at multiple viewports, check layout issues |
| **verify-a11y** | `/verify-a11y <url>` | axe-core audit + manual accessibility checks |
| **verify-completeness** | `/verify-completeness [url]` | Final audit: missing elements, TODOs, console errors |

## Workflow

```
/preflight design.png          # Install deps, verify tools
    |
/analyze-design design.png     # Extract all design tokens
    |
/setup-project vite            # Scaffold project
    |
  Build components              # Write code section by section
    |
/pixel-diff design.png <url>   # Check accuracy (< 2% = pass)
    |
/fix-loop design.png <url>     # Auto-fix deviations if > 2%
    |
/verify-styles <url>           # Inspect computed CSS
/verify-interactive <url>      # Test hover/focus states
/verify-responsive <url>       # Test 375/768/1024/1440px
/verify-a11y <url>             # Accessibility audit
/verify-completeness <url>     # Final checklist
```

## Shared Scripts

All skills use shared Playwright-based CLI scripts in `.claude/skills/_shared/scripts/`:

| Script | Purpose |
|--------|---------|
| `screenshot.mjs` | Capture pages with optional text/style/measurement extraction |
| `compare.mjs` | Pixel-level image comparison via pixelmatch |
| `extract-color.mjs` | Sample hex colors at specific coordinates via sharp |
| `sample-palette.mjs` | Extract dominant colors from an image |
| `inspect-styles.mjs` | Extract computed CSS properties from page elements |
| `interactive-test.mjs` | Test hover, focus, cursor, and transition states |
| `responsive-test.mjs` | Multi-viewport screenshot with layout issue detection |
| `a11y-audit.mjs` | axe-core injection + manual accessibility checks |

Scripts can be used standalone:

```bash
# Screenshot with style extraction
node .claude/skills/_shared/scripts/screenshot.mjs https://example.com \
  --output .claude/tmp/screenshot.png --full-page --extract-styles

# Compare two images
node .claude/skills/_shared/scripts/compare.mjs design.png screenshot.png

# Sample colors
node .claude/skills/_shared/scripts/extract-color.mjs design.png 100,200 300,400

# Inspect computed styles
node .claude/skills/_shared/scripts/inspect-styles.mjs http://localhost:5173 h1 button img
```

## Dependencies

All installed automatically by `/preflight`:

- **sharp** — image manipulation and color sampling
- **pixelmatch** — pixel-by-pixel image comparison
- **pngjs** — PNG encoding/decoding
- **axe-core** — accessibility audit engine
- **playwright** — headless browser automation (Chromium)

## Temp Files

Screenshots and diff images are saved to `.claude/tmp/` (project-relative, gitignored).

## License

MIT
