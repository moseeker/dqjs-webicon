/**
 * Generate Preview Page Script
 *
 * Generates a static HTML preview page for all icons.
 * The page includes:
 * - Fuzzy search/filter
 * - Color demo (for nocolors icons)
 * - Size demo slider
 *
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
const NOCOLORS_DIR = join(ROOT_DIR, 'svg', 'nocolors');
const COLORS_DIR = join(ROOT_DIR, 'svg', 'colors');

/**
 * Get icon metadata from SVG directories
 * @returns {Array<{name: string, tagName: string, type: 'nocolors' | 'colors'}>}
 */
function getIconMetadata() {
  const icons = [];

  // Process nocolors directory
  if (existsSync(NOCOLORS_DIR)) {
    const files = readdirSync(NOCOLORS_DIR).filter((f) => f.endsWith('.svg'));
    for (const file of files) {
      const name = basename(file, '.svg');
      // Convert to tag name (same logic as generate-icons.js)
      const safeName = name
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-+$/, '')
        .replace(/^-+/, '')
        .toLowerCase();
      // Note: Chinese chars will be converted to pinyin in actual build
      // For preview, we use the original name for display
      icons.push({
        name,
        safeName,
        tagName: `qx-icon-${safeName}`,
        type: 'nocolors',
      });
    }
  }

  // Process colors directory
  if (existsSync(COLORS_DIR)) {
    const files = readdirSync(COLORS_DIR).filter((f) => f.endsWith('.svg'));
    for (const file of files) {
      const name = basename(file, '.svg');
      const safeName = name
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-+$/, '')
        .replace(/^-+/, '')
        .toLowerCase();
      icons.push({
        name,
        safeName,
        tagName: `qx-icon-${safeName}`,
        type: 'colors',
      });
    }
  }

  return icons;
}

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
 * Generate the preview HTML page
 */
function generatePreviewPage() {
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

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>@dqjs/webicon - Icon Preview</title>
  <style>
    * {
      box-sizing: border-box;
    }

    :root {
      --bg-color: #f5f5f5;
      --card-bg: #ffffff;
      --text-color: #333333;
      --border-color: #e0e0e0;
      --primary-color: #1976d2;
      --hover-bg: #f0f7ff;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      margin: 0;
      padding: 20px;
      min-height: 100vh;
    }

    .header {
      max-width: 1400px;
      margin: 0 auto 24px;
      text-align: center;
    }

    .header h1 {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 600;
    }

    .header p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .controls {
      max-width: 1400px;
      margin: 0 auto 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      background: var(--card-bg);
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .search-box {
      flex: 1;
      min-width: 200px;
    }

    .search-box input {
      width: 100%;
      padding: 10px 16px;
      font-size: 14px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .search-box input:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
    }

    .control-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .control-group label {
      font-size: 13px;
      color: #666;
      white-space: nowrap;
    }

    .control-group input[type="color"] {
      width: 36px;
      height: 36px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      cursor: pointer;
      padding: 2px;
    }

    .control-group input[type="range"] {
      width: 120px;
      cursor: pointer;
    }

    .control-group .size-value {
      min-width: 45px;
      text-align: center;
      font-size: 13px;
      font-weight: 500;
    }

    .type-filter {
      display: flex;
      gap: 8px;
    }

    .type-filter button {
      padding: 8px 16px;
      font-size: 13px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--card-bg);
      cursor: pointer;
      transition: all 0.2s;
    }

    .type-filter button:hover {
      background: var(--hover-bg);
    }

    .type-filter button.active {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }

    .stats {
      font-size: 13px;
      color: #666;
      padding: 4px 12px;
      background: var(--bg-color);
      border-radius: 20px;
    }

    .icon-grid {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
    }

    .icon-card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 20px 12px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
    }

    .icon-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: var(--primary-color);
    }

    .icon-card.copied {
      background: #e8f5e9;
      border-color: #4caf50;
    }

    .icon-display {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
    }

    .icon-name {
      font-size: 11px;
      color: #666;
      text-align: center;
      word-break: break-all;
      line-height: 1.3;
    }

    .icon-type {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: #e3f2fd;
      color: #1976d2;
    }

    .icon-type.colors {
      background: #fff3e0;
      color: #e65100;
    }

    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #333;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      opacity: 0;
      transition: all 0.3s;
      z-index: 1000;
    }

    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
      color: #999;
    }

    .empty-state svg {
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    @media (max-width: 768px) {
      .controls {
        flex-direction: column;
        align-items: stretch;
      }

      .search-box {
        width: 100%;
      }

      .control-group {
        justify-content: space-between;
      }

      .icon-grid {
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 12px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎨 @dqjs/webicon</h1>
    <p>Icon Preview - Click to copy tag name</p>
  </div>

  <div class="controls">
    <div class="search-box">
      <input type="text" id="search" placeholder="🔍 Search icons... (fuzzy match supported)">
    </div>

    <div class="control-group">
      <label>Color:</label>
      <input type="color" id="color" value="#333333">
    </div>

    <div class="control-group">
      <label>Size:</label>
      <input type="range" id="size" min="16" max="96" value="32">
      <span class="size-value" id="sizeValue">32px</span>
    </div>

    <div class="type-filter">
      <button class="active" data-type="all">All</button>
      <button data-type="nocolors">Colorable</button>
      <button data-type="colors">Original</button>
    </div>

    <div class="stats" id="stats">0 icons</div>
  </div>

  <div class="icon-grid" id="iconGrid"></div>

  <div class="toast" id="toast">Copied!</div>

  <!-- Load the icon bundle -->
  <script src="webicon.min.js"></script>

  <script>
    // Icon data from build
    const icons = ${iconsJson};

    // State
    let currentFilter = 'all';
    let currentSearch = '';
    let currentColor = '#333333';
    let currentSize = 32;

    // DOM elements
    const searchInput = document.getElementById('search');
    const colorInput = document.getElementById('color');
    const sizeInput = document.getElementById('size');
    const sizeValue = document.getElementById('sizeValue');
    const iconGrid = document.getElementById('iconGrid');
    const stats = document.getElementById('stats');
    const toast = document.getElementById('toast');
    const typeButtons = document.querySelectorAll('.type-filter button');

    /**
     * Simple fuzzy match
     * @param {string} pattern - Search pattern
     * @param {string} str - String to match
     * @returns {boolean}
     */
    function fuzzyMatch(pattern, str) {
      pattern = pattern.toLowerCase();
      str = str.toLowerCase();

      // Direct substring match
      if (str.includes(pattern)) return true;

      // Fuzzy match: all chars in pattern appear in order
      let patternIdx = 0;
      for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
        if (str[i] === pattern[patternIdx]) {
          patternIdx++;
        }
      }
      return patternIdx === pattern.length;
    }

    /**
     * Filter icons based on current state
     * @returns {Array}
     */
    function filterIcons() {
      return icons.filter(icon => {
        // Type filter
        if (currentFilter !== 'all' && icon.type !== currentFilter) {
          return false;
        }

        // Search filter
        if (currentSearch) {
          const searchStr = icon.safeName + ' ' + icon.tagName;
          if (!fuzzyMatch(currentSearch, searchStr)) {
            return false;
          }
        }

        return true;
      });
    }

    /**
     * Render icon grid
     */
    function renderIcons() {
      const filtered = filterIcons();

      if (filtered.length === 0) {
        iconGrid.innerHTML = \`
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <p>No icons found matching your search</p>
          </div>
        \`;
        stats.textContent = '0 icons';
        return;
      }

      iconGrid.innerHTML = filtered.map(icon => {
        const colorAttr = icon.type === 'nocolors' ? \`color="\${currentColor}"\` : '';
        return \`
          <div class="icon-card" data-tag="\${icon.tagName}">
            <div class="icon-display">
              <\${icon.tagName} size="\${currentSize}" \${colorAttr}></\${icon.tagName}>
            </div>
            <div class="icon-name">\${icon.safeName}</div>
            <div class="icon-type \${icon.type}">\${icon.type === 'nocolors' ? 'colorable' : 'original'}</div>
          </div>
        \`;
      }).join('');

      stats.textContent = \`\${filtered.length} icon\${filtered.length !== 1 ? 's' : ''}\`;

      // Add click handlers
      document.querySelectorAll('.icon-card').forEach(card => {
        card.addEventListener('click', () => {
          const tagName = card.dataset.tag;
          copyToClipboard(\`<\${tagName}></\${tagName}>\`);
          card.classList.add('copied');
          setTimeout(() => card.classList.remove('copied'), 500);
        });
      });
    }

    /**
     * Update icon colors (for nocolors type only)
     */
    function updateColors() {
      document.querySelectorAll('.icon-card').forEach(card => {
        const tagName = card.dataset.tag;
        const icon = icons.find(i => i.tagName === tagName);
        if (icon && icon.type === 'nocolors') {
          const iconEl = card.querySelector(tagName);
          if (iconEl) {
            iconEl.setAttribute('color', currentColor);
          }
        }
      });
    }

    /**
     * Update icon sizes
     */
    function updateSizes() {
      document.querySelectorAll('.icon-card').forEach(card => {
        const tagName = card.dataset.tag;
        const iconEl = card.querySelector(tagName);
        if (iconEl) {
          iconEl.setAttribute('size', currentSize);
        }
      });
    }

    /**
     * Copy text to clipboard
     * @param {string} text
     */
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(\`Copied: \${text}\`);
      }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast(\`Copied: \${text}\`);
      });
    }

    /**
     * Show toast notification
     * @param {string} message
     */
    function showToast(message) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }

    // Event listeners
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      renderIcons();
    });

    colorInput.addEventListener('input', (e) => {
      currentColor = e.target.value;
      updateColors();
    });

    sizeInput.addEventListener('input', (e) => {
      currentSize = parseInt(e.target.value);
      sizeValue.textContent = currentSize + 'px';
      updateSizes();
    });

    typeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        typeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.type;
        renderIcons();
      });
    });

    // Initial render
    renderIcons();
  </script>
</body>
</html>`;

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
