/**
 * Generate Preview Page Script
 *
 * Generates a static HTML preview page for all icons.
 * The page includes:
 * - Fuzzy search/filter
 * - Color demo (for nocolors icons)
 * - Size demo slider
 *
 * Template: scripts/preview-template.html
 * Output: preview/index.html
 */

import { readdirSync, mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const DIST_DIR = join(ROOT_DIR, 'dist');
const PREVIEW_DIR = join(ROOT_DIR, 'preview');
const TEMPLATE_PATH = join(__dirname, 'preview-template.html');

/**
 * Read actual tag names from dist/icons directory
 * @returns {Map<string, string>} Map of safe filename to actual tag name
 */
function getActualTagNames() {
  const tagMap = new Map();
  const iconsDir = join(DIST_DIR, 'icons');

  if (existsSync(iconsDir)) {
    const files = readdirSync(iconsDir).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      const content = readFileSync(join(iconsDir, file), 'utf-8');
      // Extract tag name from customElement decorator
      const match = content.match(/customElement\(["']([^"']+)["']\)/);
      if (match) {
        const safeName = basename(file, '.js');
        tagMap.set(safeName, match[1]);
      }
    }
  }

  return tagMap;
}

/**
 * Get icon type from src/icons directory
 * @returns {Map<string, 'nocolors' | 'colors'>}
 */
function getIconTypes() {
  const typeMap = new Map();
  const srcIconsDir = join(ROOT_DIR, 'src', 'icons');

  if (existsSync(srcIconsDir)) {
    const files = readdirSync(srcIconsDir).filter((f) => f.endsWith('.ts'));
    for (const file of files) {
      const content = readFileSync(join(srcIconsDir, file), 'utf-8');
      const safeName = basename(file, '.ts');
      // Check if it's colorable (has color property and fill: currentColor)
      if (content.includes('fill: currentColor') && content.includes('color?: string')) {
        typeMap.set(safeName, 'nocolors');
      } else {
        typeMap.set(safeName, 'colors');
      }
    }
  }

  return typeMap;
}

/**
 * Generate the preview HTML page by reading template and injecting data
 * @returns {string} Generated HTML
 */
function generatePreviewPage() {
  // Read template
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`❌ Template not found: ${TEMPLATE_PATH}`);
    process.exit(1);
  }
  const template = readFileSync(TEMPLATE_PATH, 'utf-8');

  // Get actual tag names from built files
  const tagMap = getActualTagNames();
  const typeMap = getIconTypes();

  // Build icons array from dist
  const icons = [];
  for (const [safeName, tagName] of tagMap) {
    icons.push({
      safeName,
      tagName,
      type: typeMap.get(safeName) || 'nocolors',
    });
  }

  // Sort icons by name
  icons.sort((a, b) => a.safeName.localeCompare(b.safeName));

  const iconsJson = JSON.stringify(icons, null, 2);

  // Replace placeholder with actual data
  const html = template.replace('__ICONS_DATA__', iconsJson);

  return html;
}

async function main() {
  console.log('📄 Generating preview page...\n');

  // Ensure preview directory exists
  if (!existsSync(PREVIEW_DIR)) {
    mkdirSync(PREVIEW_DIR, { recursive: true });
  }

  // Generate HTML
  const html = generatePreviewPage();
  writeFileSync(join(PREVIEW_DIR, 'index.html'), html);
  console.log('  ✅ preview/index.html');

  // Copy webicon.min.js to preview directory
  const bundleSrc = join(DIST_DIR, 'webicon.min.js');
  const bundleDest = join(PREVIEW_DIR, 'webicon.min.js');
  if (existsSync(bundleSrc)) {
    copyFileSync(bundleSrc, bundleDest);
    console.log('  ✅ preview/webicon.min.js');
  } else {
    console.error('  ❌ dist/webicon.min.js not found. Run pnpm build first.');
    process.exit(1);
  }

  // Copy sourcemap if exists
  const mapSrc = join(DIST_DIR, 'webicon.min.js.map');
  if (existsSync(mapSrc)) {
    copyFileSync(mapSrc, join(PREVIEW_DIR, 'webicon.min.js.map'));
    console.log('  ✅ preview/webicon.min.js.map');
  }

  console.log('\n🎉 Preview page generated!');
  console.log('   Open preview/index.html in browser to view');
}

main().catch((err) => {
  console.error('Generate preview failed:', err);
  process.exit(1);
});
