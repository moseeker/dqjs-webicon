/**
 * Bundle script for generating CJS versions
 *
 * Generates:
 * - dist/index.cjs (main CJS bundle with all icons)
 * - dist/cjs/icons/*.cjs (individual CJS files for each icon)
 */

import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const DIST_DIR = join(ROOT_DIR, 'dist');
const ICONS_DIR = join(DIST_DIR, 'icons');
const CJS_ICONS_DIR = join(DIST_DIR, 'cjs', 'icons');

async function main() {
  console.log('📦 Bundling CJS versions...\n');

  // 1. Bundle main index.js to index.cjs
  console.log('  Building dist/index.cjs...');
  await build({
    entryPoints: [join(DIST_DIR, 'index.js')],
    bundle: true,
    outfile: join(DIST_DIR, 'index.cjs'),
    format: 'cjs',
    platform: 'browser',
    external: [], // Bundle everything including lit
    minify: false,
    sourcemap: true,
  });
  console.log('  ✅ dist/index.cjs');

  // 2. Bundle individual icon files to CJS
  if (existsSync(ICONS_DIR)) {
    const iconFiles = readdirSync(ICONS_DIR).filter((f) => f.endsWith('.js'));

    if (iconFiles.length > 0) {
      // Ensure CJS icons directory exists
      mkdirSync(CJS_ICONS_DIR, { recursive: true });

      console.log(`\n  Building ${iconFiles.length} individual CJS icon(s)...`);

      for (const file of iconFiles) {
        const inputPath = join(ICONS_DIR, file);
        const outputPath = join(CJS_ICONS_DIR, basename(file, '.js') + '.cjs');

        await build({
          entryPoints: [inputPath],
          bundle: true,
          outfile: outputPath,
          format: 'cjs',
          platform: 'browser',
          external: [], // Bundle everything including lit
          minify: false,
          sourcemap: true,
        });

        console.log(`  ✅ dist/cjs/icons/${basename(file, '.js')}.cjs`);
      }
    }
  }

  // 3. Build minified IIFE bundle for direct browser use
  console.log('\n  Building dist/webicon.min.js (IIFE)...');
  await build({
    entryPoints: [join(DIST_DIR, 'index.js')],
    bundle: true,
    outfile: join(DIST_DIR, 'webicon.min.js'),
    format: 'iife',
    globalName: 'DqjsWebicon',
    platform: 'browser',
    minify: true,
    sourcemap: true,
  });
  console.log('  ✅ dist/webicon.min.js');

  console.log('\n🎉 Bundle complete!');
}

main().catch((err) => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
