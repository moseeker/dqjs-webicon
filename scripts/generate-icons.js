/**
 * SVG to Lit Web Component Icon Generator
 *
 * This script reads SVG files from `svg/nocolors/` and `svg/colors/` directories,
 * optimizes them with SVGO, and generates Lit-based web component icon files.
 *
 * Directory structure:
 *   - svg/nocolors/ - Icons that can be colored via CSS (fill removed)
 *   - svg/colors/   - Icons that keep their original colors
 *
 * Usage:
 *   1. Place SVG files in the appropriate directory
 *   2. Run `npm run build`
 *   3. Generated components will be in `src/icons/`
 *
 * Naming convention:
 *   - SVG file: `arrow-left.svg` → Component: `QxIconArrowLeft` → Tag: `<qx-icon-arrow-left>`
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize, loadConfig } from 'svgo';
import { pinyin } from 'pinyin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const NOCOLORS_DIR = join(ROOT_DIR, 'svg', 'nocolors');
const COLORS_DIR = join(ROOT_DIR, 'svg', 'colors');
const OUTPUT_DIR = join(ROOT_DIR, 'src', 'icons');

/**
 * Sanitize filename to safe ASCII for module names
 * Converts Chinese characters to pinyin, removes/replaces unsafe chars
 * @param {string} str - Original filename without extension
 * @returns {string} Safe ASCII string
 */
function sanitizeFileName(str) {
  // Convert Chinese characters to pinyin
  let result = pinyin(str, {
    style: 'normal',       // Use normal spelling (no tones)
    segment: false,        // Don't segment, char by char
    group: false,          // Don't group by word
  }).join('');
  
  // Replace unsafe characters with hyphens (underscore is not valid in custom element names)
  result = result.replace(/[^a-zA-Z0-9]+/g, '-');
  
  // Clean up multiple hyphens, remove leading/trailing hyphens
  return result
    .replace(/-+/g, '-')
    .replace(/-+$/, '')
    .replace(/^-+/, '')
    .toLowerCase();
}

/**
 * Convert kebab-case to PascalCase
 * @param {string} str - kebab-case string
 * @returns {string} PascalCase string
 */
function toPascalCase(str) {
  // First sanitize to ensure ASCII
  const safeStr = sanitizeFileName(str);
  return safeStr
    .split('-')
    .filter(part => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert filename to safe filename (for output files)
 * @param {string} filename - Original filename
 * @returns {string} Safe filename
 */
function toSafeFileName(filename) {
  const name = basename(filename, '.svg');
  return sanitizeFileName(name);
}

/**
 * Convert filename to component name
 * @param {string} filename - SVG filename (e.g., "arrow-left.svg")
 * @returns {string} Component name (e.g., "QxIconArrowLeft")
 */
function toComponentName(filename) {
  const safeName = toSafeFileName(filename);
  return 'QxIcon' + toPascalCase(safeName);
}

/**
 * Convert filename to tag name
 * @param {string} filename - SVG filename (e.g., "arrow-left.svg")
 * @returns {string} Tag name (e.g., "qx-icon-arrow-left")
 */
function toTagName(filename) {
  const safeName = toSafeFileName(filename);
  return 'qx-icon-' + safeName.toLowerCase();
}

/**
 * Clean SVG content for embedding in template literal
 * @param {string} svg - Raw SVG content
 * @returns {string} Cleaned SVG content
 */
function cleanSvg(svg) {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/\n\s*/g, ' ') // Remove newlines and extra spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/>\s+</g, '><') // Remove spaces between tags
    .trim();
}

/**
 * Optimize SVG using SVGO
 * @param {string} svgContent - Raw SVG content
 * @param {object} config - SVGO config
 * @returns {string} Optimized SVG content
 */
function optimizeSvg(svgContent, config) {
  const result = optimize(svgContent, config);
  return result.data;
}

/**
 * Generate Lit component code for a nocolors icon (CSS colorable)
 * @param {string} componentName - Component class name
 * @param {string} tagName - Custom element tag name
 * @param {string} svgContent - Cleaned SVG content
 * @returns {string} TypeScript component code
 */
function generateNocolorsComponent(componentName, tagName, svgContent) {
  return `import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * ${componentName} - Auto-generated icon component (colorable via CSS)
 * @element ${tagName}
 */
@customElement('${tagName}')
export class ${componentName} extends LitElement {
  static styles = css\`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--icon-size, 1em);
      height: var(--icon-size, 1em);
      color: var(--icon-color, currentColor);
    }
    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  \`;

  @property({ type: Number })
  size?: number;

  @property({ type: String })
  color?: string;

  render() {
    const style = [
      this.size ? \`--icon-size: \${this.size}px\` : '',
      this.color ? \`--icon-color: \${this.color}\` : '',
    ].filter(Boolean).join(';');

    return html\`
      <style>\${style ? \`:host { \${style} }\` : ''}</style>
      ${svgContent}
    \`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    '${tagName}': ${componentName};
  }
}
`;
}

/**
 * Generate Lit component code for a colors icon (preserves original colors)
 * @param {string} componentName - Component class name
 * @param {string} tagName - Custom element tag name
 * @param {string} svgContent - Cleaned SVG content
 * @returns {string} TypeScript component code
 */
function generateColorsComponent(componentName, tagName, svgContent) {
  return `import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * ${componentName} - Auto-generated icon component (preserves original colors)
 * @element ${tagName}
 */
@customElement('${tagName}')
export class ${componentName} extends LitElement {
  static styles = css\`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--icon-size, 1em);
      height: var(--icon-size, 1em);
    }
    svg {
      width: 100%;
      height: 100%;
    }
  \`;

  @property({ type: Number })
  size?: number;

  render() {
    const style = this.size ? \`--icon-size: \${this.size}px\` : '';

    return html\`
      <style>\${style ? \`:host { \${style} }\` : ''}</style>
      ${svgContent}
    \`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    '${tagName}': ${componentName};
  }
}
`;
}

/**
 * Generate index.ts that exports all icons
 * @param {Array<{componentName: string, filename: string}>} icons - List of icons
 * @returns {string} Index file content
 */
function generateIndex(icons) {
  if (icons.length === 0) {
    return `// No icons generated yet. Add SVG files to svg/nocolors/ or svg/colors/ directory.\nexport {};\n`;
  }

  const exports = icons
    .map(({ componentName, safeFileName }) => {
      return `export { ${componentName} } from './icons/${safeFileName}.js';`;
    })
    .join('\n');

  return `/**
 * @dqjs/webicon - Auto-generated icon components
 *
 * Usage:
 *   import { QxIconArrowLeft } from '@dqjs/webicon';
 *   // or
 *   import '@dqjs/webicon/icons/arrow-left.js';
 *   // then use <qx-icon-arrow-left></qx-icon-arrow-left>
 */

${exports}
`;
}

/**
 * Process SVG files from a directory
 * @param {string} dir - Directory path
 * @param {'nocolors' | 'colors'} type - Icon type
 * @param {Array} icons - Array to collect icon info
 */
async function processDirectory(dir, type, icons) {
  if (!existsSync(dir)) {
    console.log(`  ⚠️  ${type}/ directory not found, skipping...`);
    return;
  }

  const svgFiles = readdirSync(dir).filter((f) => f.endsWith('.svg'));
  if (svgFiles.length === 0) {
    console.log(`  ⚠️  No SVG files in ${type}/`);
    return;
  }

  // Load SVGO config
  const configPath = join(dir, 'svgo.config.cjs');
  let svgoConfig = {};
  if (existsSync(configPath)) {
    // Dynamic import for CJS config
    const configModule = await import(`file://${configPath}`);
    svgoConfig = configModule.default || configModule;
  }

  console.log(`\n  Processing ${type}/ (${svgFiles.length} files)...`);

  const generateFn = type === 'nocolors' ? generateNocolorsComponent : generateColorsComponent;

  for (const file of svgFiles) {
    const svgPath = join(dir, file);
    let svgContent = readFileSync(svgPath, 'utf-8');

    // Optimize with SVGO
    svgContent = optimizeSvg(svgContent, svgoConfig);
    svgContent = cleanSvg(svgContent);

    const componentName = toComponentName(file);
    const tagName = toTagName(file);
    const safeFileName = toSafeFileName(file);
    const outputFile = join(OUTPUT_DIR, safeFileName + '.ts');

    const componentCode = generateFn(componentName, tagName, svgContent);
    writeFileSync(outputFile, componentCode);

    icons.push({ componentName, filename: file, safeFileName, type });
    console.log(`    ✅ ${file} → ${componentName} (${tagName}) [${type}]`);
  }
}

async function main() {
  console.log('🔍 Generating icon components...');

  // Clean and recreate output directory
  if (existsSync(OUTPUT_DIR)) {
    // Remove all .ts files to clean up stale icons
    const existingFiles = readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.ts'));
    for (const file of existingFiles) {
      rmSync(join(OUTPUT_DIR, file));
    }
    console.log(`  🧹 Cleaned ${existingFiles.length} existing icon file(s)`);
  } else {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Ensure SVG directories exist
  if (!existsSync(NOCOLORS_DIR)) {
    mkdirSync(NOCOLORS_DIR, { recursive: true });
  }
  if (!existsSync(COLORS_DIR)) {
    mkdirSync(COLORS_DIR, { recursive: true });
  }

  const icons = [];

  // Process both directories
  await processDirectory(NOCOLORS_DIR, 'nocolors', icons);
  await processDirectory(COLORS_DIR, 'colors', icons);

  // Generate index.ts
  const indexContent = generateIndex(icons);
  writeFileSync(join(ROOT_DIR, 'src', 'index.ts'), indexContent);

  if (icons.length === 0) {
    console.log('\n⚠️  No icons generated. Add SVG files to svg/nocolors/ or svg/colors/');
  } else {
    console.log(`\n🎉 Generated ${icons.length} icon component(s)`);
    const nocolorsCount = icons.filter((i) => i.type === 'nocolors').length;
    const colorsCount = icons.filter((i) => i.type === 'colors').length;
    console.log(`   - nocolors (CSS colorable): ${nocolorsCount}`);
    console.log(`   - colors (preserved): ${colorsCount}`);
  }
}

main().catch((err) => {
  console.error('Generate failed:', err);
  process.exit(1);
});
