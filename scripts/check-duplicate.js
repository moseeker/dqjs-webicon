/**
 * Check for duplicate SVG files between nocolors/ and colors/ directories
 */

import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const NOCOLORS_DIR = join(ROOT_DIR, 'svg', 'nocolors');
const COLORS_DIR = join(ROOT_DIR, 'svg', 'colors');

function main() {
  const fileNames = new Set();
  const duplicates = [];

  // Collect files from nocolors/
  if (existsSync(NOCOLORS_DIR)) {
    readdirSync(NOCOLORS_DIR)
      .filter((f) => f.endsWith('.svg'))
      .forEach((file) => fileNames.add(file));
  }

  // Check for duplicates in colors/
  if (existsSync(COLORS_DIR)) {
    readdirSync(COLORS_DIR)
      .filter((f) => f.endsWith('.svg'))
      .forEach((file) => {
        if (fileNames.has(file)) {
          duplicates.push(file);
        }
      });
  }

  if (duplicates.length > 0) {
    console.error('❌ Duplicate files found:');
    duplicates.forEach((file) => console.error(`   - ${file}`));
    process.exit(1);
  }

  console.log('✅ No duplicate files');
  process.exit(0);
}

main();
