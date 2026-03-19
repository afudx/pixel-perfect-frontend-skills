---
name: setup-project
description: Scaffold a pixel-perfect frontend project with framework, Tailwind config, global styles, utils, directory structure, and verification scripts. Use after design analysis is complete.
user-invocable: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
argument-hint: [framework: next|vite]
---

Scaffold the project. Design analysis must be complete — you need the extracted tokens.

Framework preference: `$ARGUMENTS` (default: vite)

## Prerequisites

All dependencies must already be installed via `/preflight`. If not yet run:
```bash
bash ${CLAUDE_SKILL_DIR}/../preflight/scripts/install-deps.sh
```

## Steps

### 1. Determine Viewport from Design

Before scaffolding, set the correct viewport based on what `/preflight` detected:

- **Bare screenshot**: use the exact design image dimensions as the viewport
- **Phone mockup (device frame detected)**: use the content area dimensions (design minus chrome inset)
- **Scale factor**: if the design is 2×, the viewport is design-width ÷ 2

```
Design 584×1168, phone mockup, 2× → viewport 292×584
Design 390×844, bare screenshot → viewport 390×844
Design 1440×900, desktop → viewport 1440×900
```

Set the viewport in the root CSS (e.g., `#root { width: <viewport-width>px; ... }`).
Use the viewport dimensions when running all screenshot commands.

### 2. Initialize Framework
- **Next.js**: `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias`
- **Vite + React**: `npx --yes create-vite@latest temp-scaffold --template react-ts` then copy files and clean up, then add Tailwind:
  ```bash
  npm install tailwindcss @tailwindcss/vite
  ```

### 3. Install UI Dependencies
```bash
npm install clsx tailwind-merge
npm install -D prettier-plugin-tailwindcss
```
Plus the icon library and font package from design analysis (e.g., `lucide-react`, `@fontsource/inter`).

Note: sharp, pixelmatch, pngjs, axe-core, and playwright are already installed by preflight.

### 4. Detect Tailwind Version and Configure

First, check the installed Tailwind version:
```bash
node -e "console.log(require('./node_modules/tailwindcss/package.json').version)"
```

**Tailwind v4 (version >= 4.0.0):**
- No `tailwind.config.js/ts` — configuration lives entirely in CSS via `@theme {}`
- In `src/index.css` (or `globals.css`):
```css
@import "tailwindcss";

@theme {
  --color-primary: #hex;
  --color-secondary: #hex;
  --font-sans: "Inter", sans-serif;
  /* ... all design tokens as CSS custom properties */
}
```
- Use the `@tailwindcss/vite` plugin (Vite) or `@tailwindcss/postcss` (Next.js/PostCSS)
- Do NOT create `tailwind.config.js` — it is ignored in v4

**Tailwind v3 (version < 4.0.0):**
- Write `tailwind.config.ts` with ALL tokens from analysis:
  - `theme.extend.colors` — every extracted color with semantic names
  - `theme.extend.fontFamily` — identified fonts
  - `theme.extend.fontSize` — every size with line-heights
  - `theme.extend.spacing` — custom values not in Tailwind defaults
  - `theme.extend.borderRadius` — per-element values
  - `theme.extend.boxShadow` — every shadow with all layers
  - `theme.extend.zIndex` — base:0, dropdown:10, sticky:20, fixed:30, modal-backdrop:40, modal:50, popover:60, tooltip:70

Do NOT use default Tailwind colors without verifying hex match.

### 5. Global Styles
Create `globals.css`:
- Tailwind directives
- `@layer base` reset: box-sizing border-box, zero margins/padding, antialiased rendering, images display block max-width 100%, removed list/link/button defaults, scrollbar-gutter stable

### 6. Utility Helper
Create `lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

### 7. Directory Structure
Use atomic design structure — always:
```
src/
  components/
    atoms/        # Smallest UI units: Button, Badge, Input, Avatar, Icon, Divider
    molecules/    # Composed from atoms: Card, FormGroup, NavItem, StatBlock
    organisms/    # Composed from molecules: Header, Footer, Sidebar, HeroSection
    templates/    # Page-level layout shells with slot areas
  pages/          # Full page compositions using templates + organisms
  lib/            # Utils, helpers, constants
  assets/         # Images, fonts, SVGs
```

### 8. Verify
Start dev server, confirm it loads using the correct viewport dimensions:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs <dev-server-url> \
  --output .claude/tmp/setup-verify.png \
  --width <viewport-width> --height <viewport-height> \
  --wait 3000
```
Check CSS reset is working by inspecting computed styles.
