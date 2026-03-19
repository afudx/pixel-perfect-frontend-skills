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

### 1. Initialize Framework
- **Next.js**: `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias`
- **Vite + React**: `npx --yes create-vite@latest temp-scaffold --template react-ts` then copy files and clean up, then add Tailwind:
  ```bash
  npm install tailwindcss @tailwindcss/vite
  ```

### 2. Install UI Dependencies
```bash
npm install clsx tailwind-merge
npm install -D prettier-plugin-tailwindcss
```
Plus the icon library and font package from design analysis (e.g., `lucide-react`, `@fontsource/inter`).

Note: sharp, pixelmatch, pngjs, axe-core, and playwright are already installed by preflight.

### 3. Configure Tailwind
Write `tailwind.config.ts` (or Tailwind v4 `@theme` in CSS) with ALL tokens from analysis:
- `theme.extend.colors` — every extracted color with semantic names
- `theme.extend.fontFamily` — identified fonts
- `theme.extend.fontSize` — every size with line-heights
- `theme.extend.spacing` — custom values not in Tailwind defaults
- `theme.extend.borderRadius` — per-element values
- `theme.extend.boxShadow` — every shadow with all layers
- `theme.extend.zIndex` — base:0, dropdown:10, sticky:20, fixed:30, modal-backdrop:40, modal:50, popover:60, tooltip:70

Do NOT use default Tailwind colors without verifying hex match.

### 4. Global Styles
Create `globals.css`:
- Tailwind directives
- `@layer base` reset: box-sizing border-box, zero margins/padding, antialiased rendering, images display block max-width 100%, removed list/link/button defaults, scrollbar-gutter stable

### 5. Utility Helper
Create `lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

### 6. Directory Structure
```
src/components/ui/
src/components/sections/
src/components/layout/
src/lib/
src/assets/
```

### 7. Verify
Start dev server, confirm it loads:
```bash
node ${CLAUDE_SKILL_DIR}/../_shared/scripts/screenshot.mjs <dev-server-url> --output .claude/tmp/setup-verify.png --wait 3000
```
Check CSS reset is working by inspecting computed styles.
