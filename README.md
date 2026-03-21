# Pixel-Perfect Flutter Skills

Claude Code skills for automated design-to-Flutter workflow. Analyze designs, scaffold projects with Feature-Sliced Design architecture, build widgets, and verify pixel-level accuracy — all through slash commands.

## Requirements

- [Claude Code](https://claude.com/claude-code) CLI
- Node.js v18+
- Flutter SDK 3.x+
- Dart SDK (bundled with Flutter)
- Maestro MCP (for device screenshots and interaction testing)
- Xcode (for iOS simulators) or Android Studio (for emulators)

## Installation

Copy the `.claude/skills/` directory and `CLAUDE.md` into your Flutter project root:

```bash
# Clone this repo
git clone https://github.com/afudx/pixel-perfect-frontend-skills.git

# Copy skills into your Flutter project
cp -r pixel-perfect-frontend-skills/.claude/skills/ your-flutter-project/.claude/skills/
cp pixel-perfect-frontend-skills/CLAUDE.md your-flutter-project/CLAUDE.md
```

## Skills

### Setup

| Skill | Command | Description |
|-------|---------|-------------|
| **preflight** | `/preflight [design-image]` | Install deps, verify Flutter/Maestro, list devices |
| **setup-project** | `/setup-project [flutter]` | Scaffold project with FSD structure, ThemeData, Riverpod, GoRouter |

### Analysis

| Skill | Command | Description |
|-------|---------|-------------|
| **analyze-design** | `/analyze-design [image-or-url]` | Extract colors, typography, spacing, layout, widget tree, FSD layer assignment |
| **extract-colors** | `/extract-colors <image> <x,y> ...` | Sample exact hex values at specific pixel coordinates |
| **sample-palette** | `/sample-palette <image> [--top N]` | Extract dominant color palette from an image |

### Build

| Skill | Command | Description |
|-------|---------|-------------|
| **pixel-diff** | `/pixel-diff <design> <device-id>` | Pixel-level comparison with diff image output |
| **fix-loop** | `/fix-loop <design> <device-id>` | Iterative fix cycle: edit Dart, hot reload, screenshot, diff |

### Verification

| Skill | Command | Description |
|-------|---------|-------------|
| **verify-styles** | `/verify-styles <device-id>` | Code grep + Maestro hierarchy bounds check |
| **verify-interactive** | `/verify-interactive <device-id>` | Test tap, focus, disabled, long-press states |
| **verify-responsive** | `/verify-responsive [devices]` | Screenshot on multiple device sizes |
| **verify-a11y** | `/verify-a11y <device-id>` | Semantics audit (code + runtime) |
| **verify-completeness** | `/verify-completeness [device-id]` | Final audit: build, TODOs, FSD structure |

## Architecture: Feature-Sliced Design

Projects are scaffolded with FSD architecture:

```
lib/
├── app/            # MaterialApp, GoRouter, Riverpod providers
├── pages/          # One slice per screen
├── widgets/        # Reusable composed widgets (cross-page only)
├── features/       # Business features (cross-page only)
├── entities/       # Business objects (model + UI)
└── shared/         # Design system, API, utils, theme
    ├── ui/         # Atoms: buttons, inputs, cards
    ├── theme/      # AppColors, AppTypography, AppSpacing, etc.
    ├── api/        # HTTP client
    ├── lib/        # Extensions, utilities
    └── config/     # Constants, environment
```

**Import Rule:** Only import from layers strictly below. No same-layer cross-slice imports.

## Workflow

```
/preflight design.png            # Install deps, verify Flutter/Maestro
    |
/analyze-design design.png       # Extract all design tokens
    |
/setup-project flutter           # Scaffold FSD project + theme
    |
  Build widgets (FSD bottom-up)   # shared/ui → entities → pages
    |
/pixel-diff design.png <device>  # Check accuracy (< 2% = pass)
    |
/fix-loop design.png <device>    # Auto-fix deviations if > 2%
    |
/verify-styles <device>          # Check code uses theme tokens
/verify-interactive <device>     # Test tap/focus states
/verify-responsive               # Test iPhone SE/15/iPad
/verify-a11y <device>            # Semantics audit
/verify-completeness <device>    # Final checklist
```

## Shared Scripts

All skills use shared Node.js scripts in `.claude/skills/_shared/scripts/`:

| Script | Purpose |
|--------|---------|
| `flutter-screenshot.mjs` | Capture device screen via Maestro CLI |
| `compare.mjs` | Pixel-level image comparison via pixelmatch |
| `extract-color.mjs` | Sample hex colors at specific coordinates via sharp |
| `sample-palette.mjs` | Extract dominant colors from an image |
| `flutter-inspect-widgets.mjs` | Parse Maestro view hierarchy → JSON |
| `flutter-interactive-test.mjs` | Test tap, focus, disabled states via Maestro flows |
| `flutter-responsive-test.mjs` | Multi-device screenshot with overflow detection |
| `flutter-a11y-audit.mjs` | Code-level + runtime accessibility checks |

## Dependencies

Installed automatically by `/preflight`:

- **sharp** — image manipulation and color sampling
- **pixelmatch** — pixel-by-pixel image comparison
- **pngjs** — PNG encoding/decoding

External requirements (install separately):
- **Flutter SDK** — `flutter` and `dart` CLI tools
- **Maestro** — `curl -fsSL https://get.maestro.mobile.dev | bash`
- **Xcode** — for iOS simulators (macOS only)

## Temp Files

Screenshots and diff images are saved to `.claude/tmp/` (project-relative, gitignored).

## License

MIT
