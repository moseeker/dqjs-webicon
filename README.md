# @dqjs/webicon

SVG to Lit-based web component icon generator.

## Features

- **Two icon types**: nocolors (CSS colorable) and colors (preserved)
- **SVGO optimization**: Automatic SVG optimization
- **Duplicate detection**: Prevents duplicate icon names
- **ESM + CJS**: Supports both modern and legacy projects

## Usage

### 1. Add SVG files

Place your SVG files in the appropriate directory:

```
svg/
├── nocolors/         # Icons that can be colored via CSS
│   ├── arrow-left.svg
│   └── chevron-right.svg
└── colors/           # Icons that keep their original colors
    └── logo.svg
```

- **nocolors/**: Fill attributes are removed, icon color can be set via CSS
- **colors/**: Original colors are preserved (for complex/multi-color icons)

### 2. Build

```bash
npm install
npm run build
```

This will:
1. Check for duplicate files
2. Optimize SVGs with SVGO
3. Generate Lit web components
4. Compile TypeScript
5. Bundle CJS versions

### 3. Use in your project

#### ESM (Modern projects)

```typescript
// Import all icons
import { QxIconArrowLeft, QxIconChevronRight } from '@dqjs/webicon';

// Or import individual icon (tree-shaking friendly)
import '@dqjs/webicon/icons/arrow-left.js';
```

#### CommonJS (Old Angular projects)

```javascript
// Require all icons
const { QxIconArrowLeft } = require('@dqjs/webicon');

// Or require individual icon
require('@dqjs/webicon/icons/arrow-left');
```

#### Direct browser use (IIFE)

```html
<script src="node_modules/@dqjs/webicon/dist/webicon.min.js"></script>
```

### 4. Use in HTML

```html
<!-- Basic usage -->
<qx-icon-arrow-left></qx-icon-arrow-left>

<!-- With size -->
<qx-icon-arrow-left size="24"></qx-icon-arrow-left>

<!-- With size and color (nocolors icons only) -->
<qx-icon-arrow-left size="32" color="#ff0000"></qx-icon-arrow-left>

<!-- Using CSS custom properties -->
<style>
  qx-icon-arrow-left {
    --icon-size: 32px;
    --icon-color: blue;
  }
</style>
```

## Icon Types

### Nocolors (CSS Colorable)

- Place in `svg/nocolors/`
- Fill attributes are removed by SVGO
- Can be colored via `color` attribute or CSS `--icon-color`
- Use for: simple icons, UI icons

### Colors (Preserved)

- Place in `svg/colors/`
- Original colors are kept
- Cannot be changed via CSS
- Use for: logos, complex multi-color icons

## Naming Convention

| SVG File | Component Name | Tag Name |
|----------|---------------|----------|
| `arrow-left.svg` | `QxIconArrowLeft` | `<qx-icon-arrow-left>` |
| `check-circle.svg` | `QxIconCheckCircle` | `<qx-icon-check-circle>` |

## CSS Custom Properties

| Property | Default | Description |
|----------|---------|-------------|
| `--icon-size` | `1em` | Icon size |
| `--icon-color` | `currentColor` | Icon color (nocolors only) |

## Build Output

```
dist/
├── index.js          # ESM entry
├── index.cjs         # CJS entry (for require)
├── index.d.ts        # TypeScript types
├── webicon.min.js    # IIFE bundle for browsers
├── icons/            # Individual ESM icons
│   ├── arrow-left.js
│   └── ...
└── cjs/icons/        # Individual CJS icons
    ├── arrow-left.cjs
    └── ...
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run lint` | Check for duplicate SVG files |
| `npm run generate` | Generate icon components from SVG files |
| `npm run build` | lint + generate + compile + bundle |
| `npm run dev` | Watch mode for TypeScript |

## Directory Structure

```
dqjs-webicon/
├── svg/
│   ├── nocolors/     # CSS colorable icons
│   │   └── svgo.config.cjs
│   └── colors/       # Preserved color icons
│       └── svgo.config.cjs
├── src/
│   ├── icons/        # Auto-generated icon components
│   └── index.ts      # Auto-generated exports
├── dist/             # Compiled output
├── scripts/
│   ├── check-duplicate.js
│   ├── generate-icons.js
│   └── bundle.js
├── example/
│   └── index.html    # Preview page
├── package.json
└── tsconfig.json
```

## Preview

Start a local server and open `example/index.html`:

```bash
python3 -m http.server 8765
# Open http://localhost:8765/example/
```
