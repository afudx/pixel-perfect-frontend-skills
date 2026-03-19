# CLAUDE.md — Pixel-Perfect Frontend Generation Guide

---

## PRIME DIRECTIVE

The design image is the absolute source of truth. Every pixel, every shadow, every spacing value is intentional. Your job is replication, not interpretation. If the design shows 12px of padding, you use 12px — not 16px because it looks better. You are a translator from visual to code, not a designer. A 1px deviation is a bug. An approximation is a failure. The design is the contract — honor every pixel.

---

## SKILLS REFERENCE

All pixel-perfect work is driven through skills. Each skill encapsulates tools, scripts, and verification logic. Use them in order.

| Skill | Command | Arguments | Purpose |
|-------|---------|-----------|---------|
| **preflight** | `/preflight` | `[design-image-path]` | Install all deps (sharp, pixelmatch, pngjs, axe-core, playwright, chromium), verify tools ready |
| **analyze-design** | `/analyze-design` | `[design-image-or-url]` | Extract colors, typography, spacing, layout, component inventory, DOM tree |
| **extract-colors** | `/extract-colors` | `<image> <x,y> [x,y]... [--region x,y,w,h]` | Sample exact hex at coordinates or dominant color of a region |
| **sample-palette** | `/sample-palette` | `<image> [--top N]` | Extract dominant color palette from image |
| **setup-project** | `/setup-project` | `[next\|vite]` | Scaffold project with Tailwind, utils, directory structure, verification scripts |
| **pixel-diff** | `/pixel-diff` | `<design> <screenshot-or-url> [--normalize] [--exclude-phone-ui] [--has-notch] [--exclude-regions x,y,w,h]` | Pixel-level comparison, outputs diff image + mismatch % + region breakdown |
| **fix-loop** | `/fix-loop` | `<design-image> <dev-server-url>` | Iterative fix cycle: edit → screenshot → diff → repeat (max 3 iterations) |
| **verify-styles** | `/verify-styles` | `<url> [selectors...]` | Inspect computed CSS properties against design tokens |
| **verify-interactive** | `/verify-interactive` | `<url> [selectors...]` | Test hover, focus-visible, active, disabled states |
| **verify-responsive** | `/verify-responsive` | `<url> [widths...]` | Screenshot at 375/768/1024/1440px, check layout issues |
| **verify-a11y** | `/verify-a11y` | `<url>` | axe-core audit + manual checks (alt text, heading hierarchy, labels, keyboard) |
| **verify-completeness** | `/verify-completeness` | `[url]` | Final audit: missing elements, TODOs, truncated files, console errors, image constraints |

---

## EXECUTION FLOW

Every pixel-perfect task follows this flow. Use skills at each phase — do not manually replicate what skills already do.

```
START
│
├── PHASE 0: PRE-FLIGHT
│   └── /preflight [design-image]
│       ├── Installs ALL dependencies (no manual npm installs later)
│       ├── Verifies Node.js, npm, Playwright, Chromium
│       ├── Reads design image dimensions
│       ├── Takes test screenshot to confirm browser works
│       └── DEVICE MOCKUP DETECTION (critical — determines viewport + diff strategy):
│           ├── Bare screenshot → viewport = design dimensions, no masking needed
│           ├── Phone mockup  → viewport = content area (design minus chrome)
│           │                   use --exclude-phone-ui on ALL pixel-diff + fix-loop runs
│           │                   (masks bezel, status bar, home indicator — see pixel-diff SKILL.md)
│           └── 2× mockup     → viewport = design-width ÷ 2, extract colors from content area only
│
├── PHASE 1: ANALYZE
│   ├── /analyze-design [design-image-or-url]
│   │   ├── Vision: study design image thoroughly
│   │   ├── Extract colors, typography, spacing, borders, shadows, layout, icons
│   │   ├── Read every word of text content verbatim
│   │   ├── Create component inventory
│   │   └── Decompose page into DOM tree
│   │
│   ├── /sample-palette design.png
│   │   └── Get dominant color palette for initial discovery
│   │
│   ├── /extract-colors design.png x1,y1 x2,y2 ...
│   │   └── Sample precise hex values at specific coordinates
│   │
│   └── /extract-colors design.png --region x,y,w,h
│       └── Get dominant+mean color of a background region (e.g., header, card)
│
├── PHASE 2: SETUP
│   └── /setup-project [vite|next]
│       ├── Initialize framework with TypeScript + Tailwind
│       ├── Install UI deps (clsx, tailwind-merge, icons, fonts)
│       ├── Write Tailwind config with ALL design tokens
│       ├── Write globals.css with CSS reset
│       ├── Write lib/utils.ts with cn() helper
│       ├── Create atomic design directory structure (atoms/molecules/organisms/templates/pages)
│       └── Verify dev server loads cleanly
│
├── PHASE 3: BUILD
│   ├── Build components using atomic design (inside-out):
│   │   1. atoms/        — Button, Badge, Input, Avatar, Icon, Divider
│   │   2. molecules/    — Card, FormGroup, NavItem, StatBlock
│   │   3. organisms/    — Header, Footer, Sidebar, HeroSection
│   │   4. Page sections top-to-bottom matching design order
│   │   5. Full page composition
│   │
│   ├── After each major section:
│   │   ├── /pixel-diff design.png <dev-server-url> --normalize
│   │   └── Fix deviations before proceeding to next section
│   │
│   └── If mismatch > 2% on any section:
│       └── /fix-loop design.png <dev-server-url>
│
├── PHASE 4: VERIFY (mandatory — never skip)
│   ├── /pixel-diff design.png <dev-server-url>
│   │   └── Strict mode (no --normalize). Must be < 2%.
│   │
│   ├── If > 2%:
│   │   └── /fix-loop design.png <dev-server-url>
│   │
│   ├── /verify-styles <dev-server-url>
│   │   └── Compare computed CSS against design tokens
│   │
│   ├── /verify-interactive <dev-server-url>
│   │   └── Test hover, focus, active, disabled states
│   │
│   ├── /verify-responsive <dev-server-url>
│   │   └── Test 375, 768, 1024, 1440px viewports
│   │
│   ├── /verify-a11y <dev-server-url>
│   │   └── axe-core + manual accessibility checks
│   │
│   └── /verify-completeness <dev-server-url>
│       └── Final audit: all elements present, zero TODOs, no console errors
│
└── DONE — All checks pass
```

---

## RULES

Inviolable. Zero exceptions.

### Colors
1. Extract exact colors via `/extract-colors` or `/sample-palette` before writing any component. Never guess hex values.
2. Never use a default Tailwind color class without confirming its hex matches the design. Two different hex values are two different colors.

### Typography
3. Install and verify the correct font family before writing components. Never substitute with a similar font.
4. Enable antialiased font rendering on the root element.
5. Every text element must have correct font-size, font-weight, line-height, letter-spacing, color, and text-transform. Verify via `/verify-styles`.
6. Never change text content from the design. Reproduce character for character.

### Layout & Spacing
7. Run `/analyze-design` to decompose the design into a component tree before writing code.
8. Build mobile-first if the design includes mobile viewports.
9. Use a CSS reset (handled by `/setup-project`).
10. Handle container and content max-width to match the design's content boundaries.
11. Preserve whitespace. Generous spacing between sections is intentional, not empty space to compress.
12. Never assume two similar-looking elements share the same styles. Measure each independently.

### Visual Fidelity
13. Use exact border-radius from the design per element — 8px looks different from 12px.
14. Replicate box-shadows exactly, including multiple layers.
15. Never omit any visible element — every icon, badge, divider, dot, decorative shape must be present.
16. Never replace a design-specific icon with a generic substitute.

### Interactive States
17. Implement hover, active, focus-visible, disabled states for every interactive element. Verify via `/verify-interactive`.
18. Use proper HTML semantics and ARIA attributes.

### Code Quality
19. Write complete, runnable files. No placeholders, ellipsis, or truncation.
20. Never use inline styles when a Tailwind class exists.
21. Never add functionality not visible in the design.
22. Zero TODO/FIXME/placeholder comments. Verified by `/verify-completeness`.
23. Consistent class order: layout, sizing, spacing, typography, color, effects, states.

### Images
24. Never render images without explicit dimensions or aspect-ratio constraints.

### Verification
25. Run `/pixel-diff` before considering any implementation complete. Must be < 2% strict mode.
26. Run the full Phase 4 verification skill chain. Never skip it.

---

## COMPONENT WRITING RULES

When building each component:

- Reference the design with Vision to get exact values
- Match every visual property: font size, weight, color, padding, margin, radius, shadow
- Include hover, focus-visible, active, disabled states for interactive elements
- Use semantic HTML: `button` for actions, `a` for navigation, `nav`, `main`, `section`, proper heading hierarchy
- Accept a `className` prop for composition
- Use the `cn()` utility for conditional classes
- Write COMPLETE files — every line present
- Copy all text from the design word for word
- For icons: prefer component libraries (lucide-react, @heroicons/react). For custom icons, create inline SVG components with `currentColor`

### Build Order (Atomic Design — always)
1. `atoms/` — Button, Badge, Input, Avatar, Icon, Divider (smallest, no dependencies)
2. `molecules/` — Card, FormGroup, NavItem, StatBlock (composed from atoms)
3. `organisms/` — Header, Footer, Sidebar, HeroSection (composed from molecules)
4. `templates/` — Page-level layout shells with slot areas
4. Page sections top-to-bottom matching design order
5. Full page composition

---

## GUIDELINES

- Flexbox for 1D alignment, CSS Grid for 2D layouts
- Implement text truncation and line clamping where the design shows it
- Match exact icon sizes and stroke widths
- Handle images with correct aspect ratios and object-fit
- Include dividers and separators when present — they are intentional
- Match opacity, gradient directions, color stops exactly
- Enforce max-width on text blocks where the design limits line length
- Use semantic HTML, not `div` for everything
- Do not hardcode widths/heights on flexible containers
- Do not ignore line-height — it controls vertical rhythm
- Do not reorder or collapse visual sections
- Do not add spacing, padding, or margins not in the design
- Do not skip small details: thin borders, subtle shadows, background tints, status dots
- Do not add creative flourishes or animations not in the design
- Run `/pixel-diff` after each major section, not only at the end

---

## EDGE CASES

### Ambiguous Value
Use the value fitting the design's grid system. Add `/* VERIFY: estimated value */` comment. Verify via `/verify-styles` after implementation.

### Missing Image/Asset
Use `/extract-colors` to sample the dominant color from the design region. Create a placeholder div with matching dimensions, aspect ratio, and sampled background color.

### Single Viewport Provided
Build pixel-perfect for the provided viewport first (verify via `/pixel-diff`). Then add responsive behavior: stack horizontal layouts, reduce padding, collapse grid columns. Verify via `/verify-responsive`.

### Dark Mode
Extract both palettes. Configure Tailwind `darkMode: 'class'`. Build light first to pixel-perfect. Layer dark overrides. Run `/pixel-diff` for each mode separately.

### Scrollable Areas
Screenshot at default scroll position. Apply `overflow-x-auto` with `scrollbar-hide`. Do not screenshot scrolled states unless the design shows them.

### Unidentifiable Font
Use Vision to study letterforms. Install candidate via npm. Take screenshot and compare. If no match, try next candidate. Ensure line-height and letter-spacing match regardless.

---

## PITFALLS

- **Device Mockup Trap**: If the reference is a phone mockup, sampling corner colors gives you chrome gray, not app colors. Always sample from the content area. Use `--auto-crop-chrome` on pixel-diff. Set the screenshot viewport to the content area, not the mockup size.
- **Inflated Mismatch Score**: A mockup's chrome border or real photos in the design vs color placeholders in implementation can inflate mismatch to 30-50%. Classify the mismatch first (device chrome / missing assets / fixable code issues) before running fix-loop.
- **Close Enough Trap**: Tailwind's `gray-500` might not match the design's gray. Always verify via `/extract-colors`.
- **Font Rendering Mismatch**: Wrong font weight or missing antialiasing. Verify via `/verify-styles`.
- **Collapsed Spacing**: Missed padding on one side. Verify via `/verify-styles` on all four sides independently.
- **Missing Subtle Elements**: Thin borders, faint tints, small dots skipped. Use Vision + `/verify-completeness`.
- **Icon Mismatch**: Wrong library, wrong size, wrong stroke width. Study carefully with Vision.
- **Uncontrolled Text Width**: No max-width on paragraphs. Check via `/verify-styles`.
- **Missing Backgrounds**: Gradients, patterns, frosted glass treatments overlooked. Inspect every section background with Vision.

---

## OUTPUT REQUIREMENTS

Every implementation must include:

1. **Complete Tailwind Configuration** — all design tokens, no placeholders
2. **Complete Global Styles** — reset, font imports, base styles
3. **Complete Utility File** — `lib/utils.ts` with `cn()` helper
4. **Complete Component Files** — every line present, no truncation
5. **Complete Page File** — all sections in correct design order
6. **Verification Results** — pixel-diff %, accessibility audit, responsive test results

Every file must be complete and immediately runnable. Never truncate. Never use "..." or "rest of component."

---

## FINAL MANDATE

You are building the design in code. Every pixel matters. Use the skills:

- `/preflight` to prepare
- `/analyze-design` to understand
- `/setup-project` to scaffold
- `/pixel-diff` to measure
- `/fix-loop` to correct
- `/verify-styles` to inspect
- `/verify-interactive` to test states
- `/verify-responsive` to test viewports
- `/verify-a11y` to audit accessibility
- `/verify-completeness` to confirm delivery

The design is the contract. The skills are your instruments. Honor every pixel.
