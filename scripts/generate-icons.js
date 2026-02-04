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
 *   Full build (default):
 *     npm run generate
 *
 *   Incremental build (for dev server):
 *     node scripts/generate-icons.js --incremental --add nocolors/file1.svg,colors/file2.svg
 *     node scripts/generate-icons.js --incremental --delete nocolors/file.svg
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
const INDEX_PATH = join(ROOT_DIR, 'src', 'index.ts');

// Cache for SVGO configs to avoid reloading
const svgoConfigCache = new Map();

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
 * Extract viewBox dimensions from SVG
 * @param {string} svg - SVG content
 * @returns {{width: number, height: number} | null}
 */
function getSvgDimensions(svg) {
  const viewBoxMatch = svg.match(/viewBox=["']\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (viewBoxMatch) {
    return {
      width: parseFloat(viewBoxMatch[3]),
      height: parseFloat(viewBoxMatch[4])
    };
  }
  // Fallback to width/height attributes
  const widthMatch = svg.match(/width=["']([\d.]+)/i);
  const heightMatch = svg.match(/height=["']([\d.]+)/i);
  if (widthMatch && heightMatch) {
    return {
      width: parseFloat(widthMatch[1]),
      height: parseFloat(heightMatch[1])
    };
  }
  return null;
}

/**
 * Generate Lit component code for a nocolors icon (CSS colorable)
 * @param {string} componentName - Component class name
 * @param {string} tagName - Custom element tag name
 * @param {string} svgContent - Cleaned SVG content
 * @returns {string} TypeScript component code
 */
function generateNocolorsComponent(componentName, tagName, svgContent) {
  return `import { LitElement, html, css, type PropertyValues } from 'lit';
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
      flex: 0 0 auto;
      width: var(--icon-width, var(--icon-size, 1em));
      height: var(--icon-size, 1em);
      color: var(--icon-color, currentColor);
    }
    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
      display: block;
    }
  \`;

  private originalViewBox?: string;
  private aspectRatio?: number;

  @property({ type: Number })
  size?: number;

  @property({ type: String })
  color?: string;

  @property({ type: Boolean, attribute: 'auto-crop' })
  autoCrop = true;

  private updateCrop() {
    const svg = this.renderRoot.querySelector('svg');
    if (!svg) return;

    if (!this.originalViewBox) {
      this.originalViewBox = svg.getAttribute('viewBox') ?? undefined;
    }

    if (!this.autoCrop) {
      if (this.originalViewBox) {
        svg.setAttribute('viewBox', this.originalViewBox);
      }
      this.style.removeProperty('--icon-width');
      return;
    }

    const box = svg.getBBox();
    if (!box.width || !box.height) return;

    this.aspectRatio = box.width / box.height;
    svg.setAttribute('viewBox', box.x + ' ' + box.y + ' ' + box.width + ' ' + box.height);

    const size = this.size ?? parseFloat(getComputedStyle(this).fontSize);
    if (size && this.aspectRatio) {
      this.style.setProperty('--icon-width', (size * this.aspectRatio).toFixed(2) + 'px');
    }
  }

  firstUpdated() {
    this.updateCrop();
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('size') || changedProperties.has('autoCrop')) {
      this.updateCrop();
    }
  }

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
 * @param {{width: number, height: number} | null} dimensions - SVG dimensions
 * @returns {string} TypeScript component code
 */
function generateColorsComponent(componentName, tagName, svgContent, dimensions) {
  const aspectRatio = dimensions ? dimensions.width / dimensions.height : 1;
  return `import { LitElement, html, css, type PropertyValues } from 'lit';
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
      flex: 0 0 auto;
      width: var(--icon-width, auto);
      height: var(--icon-size, 1em);
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  \`;

  private originalViewBox?: string;
  private aspectRatio?: number;

  @property({ type: Number })
  size?: number;

  @property({ type: Boolean, attribute: 'auto-crop' })
  autoCrop = true;

  private updateCrop() {
    const svg = this.renderRoot.querySelector('svg');
    if (!svg) return;

    if (!this.originalViewBox) {
      this.originalViewBox = svg.getAttribute('viewBox') ?? undefined;
    }

    if (!this.autoCrop) {
      if (this.originalViewBox) {
        svg.setAttribute('viewBox', this.originalViewBox);
      }
      this.style.removeProperty('--icon-width');
      return;
    }

    const box = svg.getBBox();
    if (!box.width || !box.height) return;

    this.aspectRatio = box.width / box.height;
    svg.setAttribute('viewBox', box.x + ' ' + box.y + ' ' + box.width + ' ' + box.height);

    const size = this.size ?? parseFloat(getComputedStyle(this).fontSize);
    if (size && this.aspectRatio) {
      this.style.setProperty('--icon-width', (size * this.aspectRatio).toFixed(2) + 'px');
    }
  }

  firstUpdated() {
    this.updateCrop();
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('size') || changedProperties.has('autoCrop')) {
      this.updateCrop();
    }
  }

  render() {
    const style = this.size
      ? '--icon-size: ' + this.size + 'px; --icon-width: ' + (this.size * ${aspectRatio}).toFixed(2) + 'px'
      : '';

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
 * @param {Array<{componentName: string, safeFileName: string}>} icons - List of icons
 * @returns {string} Index file content
 */
function generateIndex(icons) {
  if (icons.length === 0) {
    return `// No icons generated yet. Add SVG files to svg/nocolors/ or svg/colors/ directory.\nexport {};\n`;
  }

  const exports = icons
    .sort((a, b) => a.safeFileName.localeCompare(b.safeFileName))
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
 * Parse existing index.ts to get current exports
 * @returns {Map<string, {componentName: string, safeFileName: string}>} Map of safeFileName -> icon info
 */
function parseExistingIndex() {
  const icons = new Map();
  
  if (!existsSync(INDEX_PATH)) {
    return icons;
  }
  
  const content = readFileSync(INDEX_PATH, 'utf-8');
  // Match: export { ComponentName } from './icons/safe-file-name.js';
  const exportRegex = /export\s*\{\s*(\w+)\s*\}\s*from\s*['"]\.\/icons\/([^'"]+)\.js['"]/g;
  
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    const componentName = match[1];
    const safeFileName = match[2];
    icons.set(safeFileName, { componentName, safeFileName });
  }
  
  return icons;
}

/**
 * Load SVGO config for a directory (with caching)
 * @param {string} dir - Directory path
 * @returns {Promise<object>} SVGO config
 */
async function loadSvgoConfig(dir) {
  if (svgoConfigCache.has(dir)) {
    return svgoConfigCache.get(dir);
  }
  
  const configPath = join(dir, 'svgo.config.cjs');
  let config = {};
  
  if (existsSync(configPath)) {
    const configModule = await import(`file://${configPath}`);
    config = configModule.default || configModule;
  }
  
  svgoConfigCache.set(dir, config);
  return config;
}

/**
 * Process a single SVG file
 * @param {string} filePath - Full path to SVG file (e.g., "type/filename.svg")
 * @param {'nocolors' | 'colors'} type - Icon type
 * @returns {Promise<{componentName: string, safeFileName: string, type: string} | null>}
 */
async function processSingleFile(filePath, type) {
  const dir = type === 'nocolors' ? NOCOLORS_DIR : COLORS_DIR;
  const filename = basename(filePath);
  const fullPath = join(dir, filename);
  
  if (!existsSync(fullPath)) {
    console.log(`    ⚠️  File not found: ${type}/${filename}`);
    return null;
  }
  
  const svgoConfig = await loadSvgoConfig(dir);
  
  let svgContent = readFileSync(fullPath, 'utf-8');
  const dimensions = getSvgDimensions(svgContent);
  
  // Optimize with SVGO
  svgContent = optimizeSvg(svgContent, svgoConfig);
  svgContent = cleanSvg(svgContent);
  
  if (type === 'colors') {
    // Keep viewBox, remove explicit width/height to allow CSS sizing
    svgContent = svgContent.replace(/\s(width|height)=["'][^"']*["']/gi, '');
  }
  
  const componentName = toComponentName(filename);
  const tagName = toTagName(filename);
  const safeFileName = toSafeFileName(filename);
  const outputFile = join(OUTPUT_DIR, safeFileName + '.ts');
  
  const generateFn = type === 'nocolors' ? generateNocolorsComponent : generateColorsComponent;
  const componentCode = type === 'nocolors'
    ? generateFn(componentName, tagName, svgContent)
    : generateFn(componentName, tagName, svgContent, dimensions);
  
  writeFileSync(outputFile, componentCode);
  
  console.log(`    ✅ ${filename} → ${componentName} (${tagName}) [${type}]`);
  
  return { componentName, safeFileName, type };
}

/**
 * Delete a generated icon file
 * @param {string} filePath - File path (e.g., "type/filename.svg")
 * @returns {{safeFileName: string} | null}
 */
function deleteSingleFile(filePath) {
  const filename = basename(filePath);
  const safeFileName = toSafeFileName(filename);
  const outputFile = join(OUTPUT_DIR, safeFileName + '.ts');
  
  if (existsSync(outputFile)) {
    rmSync(outputFile);
    console.log(`    🗑️  Deleted: ${safeFileName}.ts`);
    return { safeFileName };
  } else {
    console.log(`    ⚠️  File not found: ${safeFileName}.ts`);
    return null;
  }
}

/**
 * Parse CLI arguments
 * @returns {{incremental: boolean, add: string[], delete: string[]}}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    incremental: false,
    add: [],
    delete: [],
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--incremental') {
      result.incremental = true;
    } else if (arg === '--add' && args[i + 1]) {
      result.add = args[i + 1].split(',').filter(Boolean);
      i++;
    } else if (arg === '--delete' && args[i + 1]) {
      result.delete = args[i + 1].split(',').filter(Boolean);
      i++;
    }
  }
  
  return result;
}

/**
 * Process SVG files from a directory (full build)
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
  const svgoConfig = await loadSvgoConfig(dir);

  console.log(`\n  Processing ${type}/ (${svgFiles.length} files)...`);

  const generateFn = type === 'nocolors' ? generateNocolorsComponent : generateColorsComponent;

  for (const file of svgFiles) {
    const svgPath = join(dir, file);
    let svgContent = readFileSync(svgPath, 'utf-8');

    // Get dimensions before optimization
    const dimensions = getSvgDimensions(svgContent);

    // Optimize with SVGO
    svgContent = optimizeSvg(svgContent, svgoConfig);
    svgContent = cleanSvg(svgContent);

    if (type === 'colors') {
      // Keep viewBox, remove explicit width/height to allow CSS sizing
      svgContent = svgContent.replace(/\s(width|height)=["'][^"']*["']/gi, '');
    }

    const componentName = toComponentName(file);
    const tagName = toTagName(file);
    const safeFileName = toSafeFileName(file);
    const outputFile = join(OUTPUT_DIR, safeFileName + '.ts');

    const componentCode = type === 'nocolors'
      ? generateFn(componentName, tagName, svgContent)
      : generateFn(componentName, tagName, svgContent, dimensions);
    writeFileSync(outputFile, componentCode);

    icons.push({ componentName, filename: file, safeFileName, type });
    console.log(`    ✅ ${file} → ${componentName} (${tagName}) [${type}]`);
  }
}

/**
 * Incremental build mode
 * @param {{add: string[], delete: string[]}} options
 */
async function incrementalBuild({ add, delete: del }) {
  console.log('🔄 Incremental build...');
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Parse existing index to get current exports
  const existingIcons = parseExistingIndex();
  
  // Process deletions first
  if (del.length > 0) {
    console.log(`\n  Deleting ${del.length} file(s)...`);
    for (const filePath of del) {
      const result = deleteSingleFile(filePath);
      if (result) {
        existingIcons.delete(result.safeFileName);
      }
    }
  }
  
  // Process additions/modifications
  if (add.length > 0) {
    console.log(`\n  Processing ${add.length} file(s)...`);
    for (const filePath of add) {
      // Parse type from path (e.g., "nocolors/file.svg" or "colors/file.svg")
      const parts = filePath.split('/');
      const type = parts[0] === 'colors' ? 'colors' : 'nocolors';
      const filename = parts[parts.length - 1];
      
      const result = await processSingleFile(filename, type);
      if (result) {
        existingIcons.set(result.safeFileName, {
          componentName: result.componentName,
          safeFileName: result.safeFileName,
        });
      }
    }
  }
  
  // Regenerate index.ts
  const icons = Array.from(existingIcons.values());
  const indexContent = generateIndex(icons);
  writeFileSync(INDEX_PATH, indexContent);
  
  console.log(`\n✅ Incremental build complete (${icons.length} total icons)`);
}

/**
 * Full build mode (default)
 */
async function fullBuild() {
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
  writeFileSync(INDEX_PATH, indexContent);

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

async function main() {
  const args = parseArgs();
  
  if (args.incremental) {
    await incrementalBuild({ add: args.add, delete: args.delete });
  } else {
    await fullBuild();
  }
}

main().catch((err) => {
  console.error('Generate failed:', err);
  process.exit(1);
});
