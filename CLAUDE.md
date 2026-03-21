# CLAUDE.md — Pixel-Perfect Flutter Generation Guide

---

## PRIME DIRECTIVE

The design image is the absolute source of truth. Every pixel, every shadow, every spacing value is intentional. Your job is replication, not interpretation. If the design shows 12px of padding, you use 12px — not 16px because it looks better. You are a translator from visual to code, not a designer. A 1px deviation is a bug. An approximation is a failure. The design is the contract — honor every pixel.

---

## SKILLS REFERENCE

All pixel-perfect work is driven through skills. Each skill encapsulates tools, scripts, and verification logic. Use them in order.

| Skill | Command | Arguments | Purpose |
|-------|---------|-----------|---------|
| **preflight** | `/preflight` | `[design-image-path]` | Install deps, verify Flutter/Maestro, list devices, test screenshot |
| **analyze-design** | `/analyze-design` | `[design-image-or-url]` | Extract colors, typography, spacing, layout, widget tree, FSD layer assignment |
| **extract-colors** | `/extract-colors` | `<image> <x,y> [x,y]... [--region x,y,w,h]` | Sample exact hex at coordinates or dominant color of a region |
| **sample-palette** | `/sample-palette` | `<image> [--top N]` | Extract dominant color palette from image |
| **setup-project** | `/setup-project` | `[flutter]` | Scaffold Flutter project with FSD structure, theme, Riverpod, GoRouter |
| **pixel-diff** | `/pixel-diff` | `<design> <device-id-or-screenshot> [flags]` | Pixel-level comparison, outputs diff image + mismatch % |
| **fix-loop** | `/fix-loop` | `<design-image> <device-id>` | Iterative fix cycle: edit Dart → hot reload → Maestro screenshot → diff |
| **verify-styles** | `/verify-styles` | `<device-id>` | Code grep for hardcoded values + Maestro hierarchy bounds check |
| **verify-interactive** | `/verify-interactive` | `<device-id>` | Test tap feedback, focus, disabled, long-press states via Maestro |
| **verify-responsive** | `/verify-responsive` | `[device-names...]` | Screenshot on multiple device sizes (iPhone SE/15/iPad/Pixel) |
| **verify-a11y** | `/verify-a11y` | `<device-id>` | Semantics audit (code + Maestro hierarchy) |
| **verify-completeness** | `/verify-completeness` | `[device-id]` | Final audit: flutter analyze, zero TODOs, FSD structure, build check |

---

## EXECUTION FLOW

Every pixel-perfect task follows this flow. Use skills at each phase — do not manually replicate what skills already do.

```
START
│
├── PHASE 0: PRE-FLIGHT
│   └── /preflight [design-image]
│       ├── Installs image processing deps (sharp, pixelmatch, pngjs)
│       ├── Verifies Flutter SDK, Dart SDK, Maestro MCP
│       ├── Lists available iOS simulators + Android emulators
│       ├── Starts preferred device
│       ├── Reads design image dimensions
│       ├── Tests Maestro screenshot
│       └── DEVICE MOCKUP DETECTION:
│           ├── Bare screenshot → viewport = design dimensions
│           ├── Phone mockup  → viewport = content area
│           │                   use --exclude-phone-ui on ALL pixel-diff runs
│           └── 2× mockup     → viewport = design-width ÷ 2
│
├── PHASE 1: ANALYZE
│   ├── /analyze-design [design-image]
│   │   ├── Vision: study design image thoroughly
│   │   ├── Extract colors, typography, spacing, borders, shadows, layout, icons
│   │   ├── Read every word of text content verbatim
│   │   ├── Create widget tree decomposition (Flutter widgets)
│   │   ├── Assign components to FSD layers
│   │   └── Map tokens to Flutter: ColorScheme, TextTheme, ThemeData
│   │
│   ├── /sample-palette design.png
│   │
│   ├── /extract-colors design.png x1,y1 x2,y2 ...
│   │
│   └── /extract-colors design.png --region x,y,w,h
│
├── PHASE 2: SETUP
│   └── /setup-project flutter
│       ├── flutter create (or verify existing project)
│       ├── Add deps: riverpod, go_router, google_fonts, flutter_svg
│       ├── Generate shared/theme/ files:
│       │   ├── app_colors.dart (ALL design colors)
│       │   ├── app_typography.dart (ALL text styles)
│       │   ├── app_spacing.dart (ALL spacing values)
│       │   ├── app_shadows.dart (ALL box shadows)
│       │   ├── app_radii.dart (ALL border radii)
│       │   └── app_theme.dart (ThemeData composition)
│       ├── Scaffold FSD directory structure
│       ├── Write main.dart with MaterialApp + Riverpod + GoRouter
│       └── Verify: flutter analyze + app launches on device
│
├── PHASE 3: BUILD (FSD bottom-up)
│   ├── Build widgets using Feature-Sliced Design:
│   │   1. shared/theme/    — Design tokens (from setup)
│   │   2. shared/ui/       — Atoms: Button, Input, Card, Badge, Avatar, Divider
│   │   3. entities/*/ui/   — Business object widgets (if needed)
│   │   4. features/*/ui/   — Feature widgets (if reused cross-page)
│   │   5. widgets/*/ui/    — Composed reusable widgets
│   │   6. pages/*/ui/      — Full screen compositions (top-to-bottom)
│   │   7. app/             — MaterialApp + GoRouter + providers
│   │
│   ├── After each major section:
│   │   ├── Hot reload (2-3s wait)
│   │   ├── Maestro take_screenshot
│   │   └── /pixel-diff design.png screenshot.png --normalize
│   │
│   └── If mismatch > 2% on any section:
│       └── /fix-loop design.png <device-id>
│
├── PHASE 3.5: ASSET INTEGRATION (if design uses real photos)
│   ├── For Image.network: verify URL loads before coding
│   │   Unsplash CDN — numeric IDs only:
│   │   ✅ https://images.unsplash.com/photo-1576045057995-568f588f82fb
│   │   ❌ https://images.unsplash.com/photo-BkuUOofPGkE (slug IDs don't work)
│   ├── For Image.asset: add to pubspec.yaml assets section
│   └── After all images: verify no error placeholders visible on device
│
├── PHASE 4: VERIFY (mandatory — never skip)
│   ├── /pixel-diff design.png <device-id>
│   │   └── Strict mode (no --normalize). Must be < 2%.
│   │
│   ├── If > 2%:
│   │   └── /fix-loop design.png <device-id>
│   │
│   ├── /verify-styles <device-id>
│   │   └── No hardcoded colors/fonts/spacing + hierarchy bounds match
│   │
│   ├── /verify-interactive <device-id>
│   │   └── Tap feedback, focus, disabled states working
│   │
│   ├── /verify-responsive
│   │   └── iPhone SE, iPhone 15, iPad screenshots — no overflow
│   │
│   ├── /verify-a11y <device-id>
│   │   └── Semantics audit — code + runtime
│   │
│   └── /verify-completeness <device-id>
│       └── flutter analyze clean, zero TODOs, FSD structure, build succeeds
│
└── DONE — All checks pass
```

---

## RULES

Inviolable. Zero exceptions.

### Colors
1. Extract exact colors via `/extract-colors` or `/sample-palette` before writing any widget. Never guess hex values.
2. Never use `Colors.blue` or any Material color constant without confirming its hex matches the design. Two different hex values are two different colors.
3. All colors must be defined in `AppColors` and referenced via `AppColors.<token>` or `Theme.of(context).colorScheme`.

### Typography
4. Install and verify the correct font family (via `google_fonts`) before writing widgets. Never substitute with a similar font.
5. Every text widget must use a style from `AppTypography` or `Theme.of(context).textTheme` with correct fontSize, fontWeight, height, letterSpacing, and color.
6. Never change text content from the design. Reproduce character for character.

### Layout & Spacing
7. Run `/analyze-design` to decompose the design into a widget tree before writing code.
8. All spacing values must be defined in `AppSpacing` and used consistently.
9. Use `SizedBox` for fixed gaps, `Padding` for container padding, `EdgeInsets` for widget padding.
10. Handle container and content max-width to match the design's content boundaries.
11. Preserve whitespace. Generous spacing between sections is intentional, not empty space to compress.
12. Never assume two similar-looking elements share the same styles. Measure each independently.

### Visual Fidelity
13. Use exact border-radius from the design per element — 8px looks different from 12px. Define in `AppRadii`.
14. Replicate box-shadows exactly, including multiple layers. Define in `AppShadows`.
15. Never omit any visible element — every icon, badge, divider, dot, decorative shape must be present.
16. Never replace a design-specific icon with a generic substitute.

### Interactive States
17. Implement tap feedback (InkWell/InkResponse), focus, and disabled states for every interactive element. Verify via `/verify-interactive`.
18. Use `Semantics` widgets for accessibility. Every interactive element needs a semantic label.

### Code Quality
19. Write complete, runnable Dart files. No placeholders, ellipsis, or truncation.
20. Never hardcode colors, fonts, spacing, shadows, or radii in widget files when theme tokens exist.
21. Never add functionality not visible in the design.
22. Zero TODO/FIXME/placeholder comments. Verified by `/verify-completeness`.
23. Use `const` constructors wherever possible for performance.

### Images
24. Never render Image widgets without explicit dimensions (width/height, SizedBox, or AspectRatio).

### Architecture
25. Follow FSD import rules: only import from layers strictly below. No same-layer cross-slice imports.
26. Use Riverpod for state management, GoRouter for routing.

### Verification
27. Run `/pixel-diff` before considering any implementation complete. Must be < 2% strict mode.
28. Run the full Phase 4 verification skill chain. Never skip it.

---

## WIDGET WRITING RULES

When building each widget:

- Reference the design with Vision to get exact values
- Match every visual property: font size, weight, color, padding, margin, radius, shadow
- Include tap feedback and disabled states for interactive elements
- Use semantic widgets: `ElevatedButton` for actions, `InkWell` for tap regions, `Scaffold` for pages
- Use `Theme.of(context)` and `AppColors`/`AppTypography`/`AppSpacing` for all style values
- Use `const` constructors wherever possible
- Write COMPLETE files — every line present
- Copy all text from the design word for word
- For icons: prefer `Icons.*` (Material), `CupertinoIcons.*`, or `flutter_svg` for custom SVGs

### Build Order (Feature-Sliced Design — always)
1. `shared/theme/` — AppColors, AppTypography, AppSpacing, AppShadows, AppRadii, AppTheme
2. `shared/ui/` — Atoms: Button, Input, Card, Badge, Avatar, Divider (smallest, no dependencies)
3. `entities/*/ui/` — Business object displays (UserCard, ProductTile)
4. `features/*/ui/` — Interactive features (if reused cross-page)
5. `widgets/*/ui/` — Composed reusable blocks (if reused cross-page)
6. `pages/*/ui/` — Full screen compositions (top-to-bottom matching design)
7. `app/` — MaterialApp, GoRouter, ProviderScope

### FSD Layer Decision (v2.1 mental model)
- **Start with Pages**: Keep everything in the page initially
- **Extract to shared/ui/**: When the same atom/molecule is used on 2+ pages
- **Extract to entities/**: When a business object (User, Product) has its own display + model
- **Extract to features/**: When an interactive feature (Search, Auth) is reused cross-page
- **Extract to widgets/**: When a composed block (AppHeader, Sidebar) is reused cross-page
- **Never extract prematurely**: If it's used on only one page, keep it in that page's `ui/` directory

---

## GUIDELINES

- `Column`/`Row` for 1D layouts, `GridView`/`Wrap` for 2D layouts
- Implement text truncation via `maxLines` + `overflow: TextOverflow.ellipsis` where the design shows it
- Match exact icon sizes via `size` parameter
- Handle images with `fit: BoxFit.cover` and explicit aspect ratios
- Include `Divider` widgets when separators are present — they are intentional
- Match opacity, gradient directions (`LinearGradient`), color stops exactly
- Use `ConstrainedBox`/`SizedBox` for max-width on text blocks where design limits line length
- Use proper Flutter widgets, not `Container` for everything
- Do not hardcode widths/heights on flexible containers — use `Expanded`/`Flexible`
- Do not ignore line-height (`height` parameter in TextStyle) — it controls vertical rhythm
- Do not reorder or collapse visual sections
- Do not add spacing not in the design
- Do not skip small details: thin borders, subtle shadows, background tints, status dots
- Do not add animations not in the design
- Run `/pixel-diff` after each major section, not only at the end

---

## EDGE CASES

### Ambiguous Value
Use the value fitting the design's grid system. Add `/* VERIFY: estimated value */` comment. Verify via `/verify-styles` after implementation.

### Missing Image/Asset
Use `/extract-colors` to sample the dominant color from the design region. Create a placeholder `Container` with matching dimensions, aspect ratio, and sampled background color.

### Single Device Provided
Build pixel-perfect for the provided device first (verify via `/pixel-diff`). Then add responsive behavior: use `LayoutBuilder`/`MediaQuery` for adaptive layouts. Verify via `/verify-responsive`.

### Dark Mode
Extract both palettes. Build light first to pixel-perfect. Add dark theme in `AppTheme.dark`. Run `/pixel-diff` for each mode separately.

### Scrollable Areas
Screenshot at default scroll position. Apply `SingleChildScrollView` or `ListView`. Do not screenshot scrolled states unless the design shows them.

### Unidentifiable Font
Use Vision to study letterforms. Install candidate via `google_fonts`. Take screenshot and compare. If no match, try next candidate. Ensure line-height and letter-spacing match regardless.

---

## TOKEN OPTIMIZATION

These skills use Maestro MCP, Flutter CLI, and many grep operations — all verbose. Use these strategies to reduce token consumption:

### RTK (Rust Token Killer)
Prefix all shell commands with `rtk` for automatic output compression:
- `rtk grep` — 75% savings on code search output
- `rtk npm install` — 90% savings on package install
- `rtk git` — 59-80% savings on git operations
- `rtk ls` / `rtk find` — 65-70% savings on file listing

### flutter-cli.sh Wrapper
For Flutter/Dart CLI (not supported by RTK), use the custom wrapper:
```bash
bash .claude/skills/_shared/scripts/flutter-cli.sh analyze      # Errors/warnings only
bash .claude/skills/_shared/scripts/flutter-cli.sh build-ios     # Pass/fail + error lines
bash .claude/skills/_shared/scripts/flutter-cli.sh pub-get       # One-line result
bash .claude/skills/_shared/scripts/flutter-cli.sh format-check  # Changed files only
```

### Compact Script Modes
Scripts accept `--compact` or `--summary` flags for reduced output:
- `flutter-inspect-widgets.mjs --compact` — ~70% smaller (one line per element)
- `flutter-inspect-widgets.mjs --summary` — ~90% smaller (counts + issues only)
- `flutter-inspect-widgets.mjs --interactive-only` — clickable elements only
- `flutter-inspect-widgets.mjs --top 20` — limit to first 20 elements
- `flutter-a11y-audit.mjs --compact` — ~60% smaller (counts + locations)
- `flutter-responsive-test.mjs --compact` — one line per device

### Serena MCP for Semantic Analysis
For code audits (verify-styles, verify-a11y), use Serena's semantic tools instead of grep when you need to understand symbol usage patterns:
- `find_symbol` — locate widgets, classes, methods by name
- `find_referencing_symbols` — trace who uses a symbol
- `get_symbols_overview` — file structure without reading bodies

### When to Use What
| Task | Tool | Savings |
|------|------|---------|
| Search for hardcoded values | `rtk grep` | 75% |
| Flutter analyze/build | `flutter-cli.sh` | 80-90% |
| Maestro hierarchy analysis | `--compact` / `--summary` | 70-90% |
| npm install | `rtk npm` | 90% |
| Symbol relationships | Serena MCP | variable |
| Git operations | `rtk git` | 59-80% |

---

## PITFALLS

- **Device Mockup Trap**: If the reference is a phone mockup, sampling corner colors gives you chrome gray, not app colors. Always sample from the content area. Use `--exclude-phone-ui` on pixel-diff.
- **Simulator DPR Trap**: iPhone 15 screenshots are 3× resolution. Use `--normalize` when comparing against 1× design images.
- **Close Enough Trap**: `Colors.grey[500]` might not match the design's gray. Always verify via `/extract-colors`.
- **Material Defaults Trap**: Flutter's Material widgets have default padding, elevation, and styling. Override everything in `ThemeData` to match the design exactly.
- **Font Rendering**: Flutter uses Skia/Impeller, not browser rendering. Text may look slightly different — focus on correct font, size, weight, and spacing.
- **Missing Subtle Elements**: Thin borders, faint tints, small dots skipped. Use Vision + `/verify-completeness`.
- **Icon Mismatch**: Wrong icon from `Icons.*`. Study carefully with Vision — Material icons have multiple variants (outlined, rounded, sharp).
- **Hot Reload Limitations**: Structural changes (new class, changed constructor) need hot restart, not hot reload.

---

## OUTPUT REQUIREMENTS

Every implementation must include:

1. **Complete Theme Files** — `shared/theme/` with all design tokens, no placeholders
2. **Complete Widget Files** — every line present, no truncation
3. **Complete Page Files** — all sections in correct design order
4. **FSD Structure** — correct layer boundaries, proper imports
5. **Verification Results** — pixel-diff %, accessibility audit, responsive test results

Every file must be complete and immediately runnable. Never truncate. Never use "..." or "rest of widget."

---

## FINAL MANDATE

You are building the design in Flutter. Every pixel matters. Use the skills:

- `/preflight` to prepare
- `/analyze-design` to understand
- `/setup-project` to scaffold
- `/pixel-diff` to measure
- `/fix-loop` to correct
- `/verify-styles` to inspect
- `/verify-interactive` to test states
- `/verify-responsive` to test devices
- `/verify-a11y` to audit accessibility
- `/verify-completeness` to confirm delivery

The design is the contract. The skills are your instruments. Honor every pixel.
