# Project Instructions

## Build & Test
- Before adding dependencies: use `pnpm` (not npm or yarn)
- Run `pnpm build` to compile TypeScript
- Run `pnpm test` before commits

## Code Style
- Files use kebab-case (e.g., `my-file.ts`)
- Variables use camelCase
- Types/Interfaces use PascalCase

## Project Structure
- Source code in `src/`
- Compiled output in `dist/`
- Scripts in `scripts/`
- Examples in `example/`

## Developer Tools
- `example/dev.html` - Browser-based tool for uploading and processing SVG files (for manual testing)
  - Upload SVG files (Chinese filenames auto-converted to pinyin)
  - Preview icons with color demo for nocolors type
  - Delete git-changed icons
  - **Git integration**: Commit & Push with auto-generated messages (categorized: added/modified/deleted)
  - **Git sync status**: Shows if local is synced with remote (ahead/behind/diverged)
  - Server runs `git fetch` on startup to check sync status
  - Uses `simple-git` npm package for git operations
