---
name: setup-project
description: Scaffold a pixel-perfect Flutter project with FSD structure, theme, Riverpod, GoRouter, and verification. Use after design analysis is complete.
user-invocable: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, mcp__maestro__launch_app, mcp__maestro__take_screenshot
arguments:
  - name: framework
    description: "Always 'flutter' (default)"
    required: false
---

# Setup Flutter Project with Feature-Sliced Design

Scaffold a complete Flutter project configured for pixel-perfect implementation using FSD architecture, Riverpod state management, and GoRouter navigation.

## Prerequisites

- `/preflight` must have passed
- `/analyze-design` must have been run (design tokens available)
- Design viewport dimensions determined

## Steps

### 1. Determine viewport and device target

From preflight results:
- **Bare screenshot**: viewport = design dimensions
- **Device mockup**: viewport = content area (design minus chrome)
- **2× mockup**: viewport = design-width ÷ 2

### 2. Create Flutter project (if needed)

If no `pubspec.yaml` exists:

```bash
flutter create --org com.example --project-name <name> --platforms ios,android .
```

If `pubspec.yaml` already exists, skip creation.

### 3. Add dependencies to pubspec.yaml

Add these to `dependencies:`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_riverpod: ^2.5.0
  riverpod_annotation: ^2.3.0
  go_router: ^14.0.0
  google_fonts: ^6.2.0
  flutter_svg: ^2.0.0
```

Add to `dev_dependencies:`:

```yaml
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0
  riverpod_generator: ^2.4.0
  build_runner: ^2.4.0
```

Run:
```bash
bash .claude/skills/_shared/scripts/flutter-cli.sh pub-get
```

### 4. Generate theme files from design tokens

Create the following files using **exact values** from `/analyze-design` output. NEVER approximate — use exact hex colors, exact font sizes, exact spacing values extracted from the design.

#### `lib/shared/theme/app_colors.dart`

All design colors as `static const Color` fields, grouped by semantic purpose (primary, background, text, border, status, etc.).

#### `lib/shared/theme/app_typography.dart`

All text styles using `GoogleFonts.<font>()` with exact fontSize, fontWeight, height (line-height/font-size), letterSpacing, and color.

#### `lib/shared/theme/app_spacing.dart`

All spacing values as `static const double` fields — padding, margin, gap, section spacing, container padding.

#### `lib/shared/theme/app_shadows.dart`

All box shadows as `static const List<BoxShadow>` — exact color with opacity, blurRadius, offset, spreadRadius.

#### `lib/shared/theme/app_radii.dart`

All border radii as `static const BorderRadius` fields — exact pixel values per element type.

#### `lib/shared/theme/app_theme.dart`

Composed `ThemeData` using the above constants:
- `ColorScheme` mapped from `AppColors`
- `TextTheme` mapped from `AppTypography`
- Component themes (AppBarTheme, ButtonTheme, InputDecorationTheme, CardTheme, etc.) configured to match design
- `scaffoldBackgroundColor` set to design background
- `useMaterial3: true`

### 5. Scaffold FSD directory structure

```
lib/
├── app/
│   ├── router/
│   │   └── app_router.dart       # GoRouter configuration
│   └── app.dart                  # MaterialApp.router + ProviderScope
├── pages/
│   └── home/
│       └── ui/
│           └── home_screen.dart  # Initial page placeholder
├── widgets/                      # (empty — add when widgets reused cross-page)
├── features/                     # (empty — add when features reused cross-page)
├── entities/                     # (empty — add when business objects needed)
└── shared/
    ├── ui/                       # Design system atoms (buttons, inputs, cards)
    │   └── .gitkeep
    ├── api/                      # HTTP client
    │   └── .gitkeep
    ├── lib/                      # Extensions, utilities
    │   └── extensions.dart
    ├── config/                   # Constants, environment
    │   └── .gitkeep
    └── theme/                    # Generated theme files
        ├── app_colors.dart
        ├── app_typography.dart
        ├── app_spacing.dart
        ├── app_shadows.dart
        ├── app_radii.dart
        └── app_theme.dart
```

**FSD Import Rule:** A module can only import from layers strictly below:
- `app/` can import from pages, widgets, features, entities, shared
- `pages/` can import from widgets, features, entities, shared
- `widgets/` can import from features, entities, shared
- `features/` can import from entities, shared
- `entities/` can import from shared only
- `shared/` imports nothing from above

**No same-layer cross-slice imports.** If page A needs something from page B, push it down to widgets/features/entities/shared.

### Key files to generate:

#### `lib/app/app.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'router/app_router.dart';
import '../shared/theme/app_theme.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: '<project-name>',
      theme: AppTheme.light,
      routerConfig: appRouter,
      debugShowCheckedModeBanner: false,
    );
  }
}
```

#### `lib/app/router/app_router.dart`

```dart
import 'package:go_router/go_router.dart';
import '../../pages/home/ui/home_screen.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomeScreen(),
    ),
  ],
);
```

#### `lib/main.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/app.dart';

void main() {
  runApp(
    const ProviderScope(
      child: App(),
    ),
  );
}
```

#### `lib/shared/lib/extensions.dart`

```dart
import 'package:flutter/material.dart';

extension ContextExtensions on BuildContext {
  ThemeData get theme => Theme.of(this);
  TextTheme get textTheme => Theme.of(this).textTheme;
  ColorScheme get colorScheme => Theme.of(this).colorScheme;
  double get screenWidth => MediaQuery.sizeOf(this).width;
  double get screenHeight => MediaQuery.sizeOf(this).height;
}
```

### 6. Verify project builds and launches

1. Run `bash .claude/skills/_shared/scripts/flutter-cli.sh analyze` — must be clean (zero errors)
2. Run `flutter run` on the test device from preflight (or use `mcp__maestro__launch_app`)
3. Take a Maestro screenshot (`mcp__maestro__take_screenshot`) to confirm the app renders
4. Screenshot should show the default scaffold (not blank/error)

### 7. External CDN images

When the design contains real photographs:
- Use Unsplash CDN with **numeric IDs only**: `https://images.unsplash.com/photo-1576045057995-568f588f82fb`
- **Never** use slug-based IDs (they don't resolve as direct CDN URLs)
- Verify each URL loads before using it in code

### Output

```
PROJECT SETUP
=============
[PASS] Flutter project created/verified
[PASS] Dependencies installed (riverpod, go_router, google_fonts, flutter_svg)
[PASS] Theme files generated (colors, typography, spacing, shadows, radii, theme)
[PASS] FSD structure scaffolded (app, pages, widgets, features, entities, shared)
[PASS] Main entry point configured (MaterialApp + Riverpod + GoRouter)
[PASS] flutter analyze clean
[PASS] App launches on device
[INFO] Device: <name> (<platform>)
[INFO] Bundle ID: <app-id>
```
