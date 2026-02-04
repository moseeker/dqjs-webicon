/**
 * Dev Server for @dqjs/webicon
 *
 * Features:
 * - HTTP server for static files and API
 * - File upload for SVG files
 * - WebSocket for build status notifications
 * - Auto-build trigger after upload
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';
import { pinyin } from 'pinyin';
import { simpleGit } from 'simple-git';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const PORT = process.env.PORT || 8765;

// Simple-git instance
const git = simpleGit(ROOT_DIR);

// Simple MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

// Store connected WebSocket clients
const clients = new Set();

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
 * Parse multipart/form-data
 * Simple implementation for file upload
 */
async function parseMultipart(req) {
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return null;
  }

  const boundary = contentType.match(/boundary=([^;]+)/)?.[1];
  if (!boundary) return null;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const body = buffer.toString('utf-8');

  const parts = body.split(`--${boundary}`).filter(p => p.trim() && !p.includes('--\r\n'));
  const files = [];
  const fields = {};

  for (const part of parts) {
    const [headerSection, ...contentSections] = part.split('\r\n\r\n');
    const content = contentSections.join('\r\n\r\n').trim();
    const headers = headerSection.trim();

    // Parse Content-Disposition
    const dispositionMatch = headers.match(/Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?/);
    if (!dispositionMatch) continue;

    const fieldName = dispositionMatch[1];
    const filename = dispositionMatch[2];

    if (filename) {
      // It's a file
      const contentTypeMatch = headers.match(/Content-Type: (.+)/);
      files.push({
        fieldName,
        filename,
        contentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
        content: Buffer.from(content, 'binary'),
      });
    } else {
      // It's a form field
      fields[fieldName] = content;
    }
  }

  return { files, fields };
}

/**
 * Send JSON response
 */
function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Serve static file
 */
function serveFile(res, filePath) {
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
}

/**
 * Run build command
 */
function runBuild() {
  return new Promise((resolve, reject) => {
    console.log('🔨 Running build...');
    broadcast({ type: 'build-start' });

    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      shell: true,
    });

    let output = '';
    buildProcess.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });

    buildProcess.stderr.on('data', (data) => {
      output += data.toString();
      process.stderr.write(data);
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Build complete');
        broadcast({ type: 'build-complete', success: true });
        resolve(output);
      } else {
        console.error('❌ Build failed');
        broadcast({ type: 'build-complete', success: false, error: output });
        reject(new Error(`Build failed with code ${code}`));
      }
    });
  });
}

/**
 * Broadcast message to all WebSocket clients
 */
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((ws) => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(data);
    }
  });
}

/**
 * Get git status - returns set of modified/staged/new SVG files
 */
async function getGitStatusFiles() {
  try {
    const status = await git.status(['svg/']);
    const files = new Set();

    // Collect all changed files
    [...status.not_added, ...status.modified, ...status.created, ...status.deleted, ...status.staged]
      .filter(f => f.endsWith('.svg'))
      .forEach(f => {
        const basename = f.split('/').pop();
        files.add(basename);
      });

    // Include renamed files (use the new name)
    status.renamed
      .filter(r => r.to.endsWith('.svg'))
      .forEach(r => {
        const basename = r.to.split('/').pop();
        files.add(basename);
      });

    return files;
  } catch (err) {
    console.error('Git status error:', err.message);
    return new Set();
  }
}

/**
 * Get detailed git status for commit message generation
 * Returns categorized file lists
 */
async function getDetailedGitStatus() {
  try {
    const status = await git.status();

    const svgFiles = {
      added: [],    // A - new files staged
      modified: [], // M - modified files
      deleted: [],  // D - deleted files
      renamed: [],  // R - renamed files
      untracked: [] // ?? - untracked files
    };

    // Helper to extract basename
    const getBaseName = (path) => path.split('/').pop();

    // New files (staged)
    status.created.forEach(f => {
      if (f.endsWith('.svg')) svgFiles.added.push(getBaseName(f));
    });

    // Modified files
    status.modified.forEach(f => {
      if (f.endsWith('.svg')) svgFiles.modified.push(getBaseName(f));
    });

    // Deleted files
    status.deleted.forEach(f => {
      if (f.endsWith('.svg')) svgFiles.deleted.push(getBaseName(f));
    });

    // Untracked files (new but not staged)
    status.not_added.forEach(f => {
      if (f.endsWith('.svg')) svgFiles.untracked.push(getBaseName(f));
    });

    // Renamed files (R - moved/renamed)
    status.renamed.forEach(r => {
      if (r.to.endsWith('.svg')) {
        svgFiles.renamed.push({
          from: getBaseName(r.from),
          to: getBaseName(r.to),
          fromPath: r.from,
          toPath: r.to,
        });
      }
    });

    return svgFiles;
  } catch (err) {
    console.error('Git status error:', err.message);
    return { added: [], modified: [], deleted: [], renamed: [], untracked: [] };
  }
}

/**
 * Generate commit message based on git status
 * Limits file list to avoid overly long commit messages
 */
async function generateCommitMessage() {
  const status = await getDetailedGitStatus();

  const sections = [];
  const MAX_FILES_TO_LIST = 5; // Maximum files to list by name

  if (status.added.length > 0 || status.untracked.length > 0) {
    const files = [...status.added, ...status.untracked];
    const fileList = formatFileList(files, MAX_FILES_TO_LIST);
    sections.push(`新增 ${files.length} 个图标: ${fileList}`);
  }

  if (status.modified.length > 0) {
    const fileList = formatFileList(status.modified, MAX_FILES_TO_LIST);
    sections.push(`更新 ${status.modified.length} 个图标: ${fileList}`);
  }

  if (status.deleted.length > 0) {
    const fileList = formatFileList(status.deleted, MAX_FILES_TO_LIST);
    sections.push(`删除 ${status.deleted.length} 个图标: ${fileList}`);
  }

  if (status.renamed.length > 0) {
    // Format renamed files - show directory change if filename is same
    const renamedDescriptions = status.renamed.map(r => {
      if (r.from === r.to) {
        // Same filename, show directory change (e.g., "fire.svg (nocolors → colors)")
        const fromDir = r.fromPath.split('/').slice(-2, -1)[0] || '';
        const toDir = r.toPath.split('/').slice(-2, -1)[0] || '';
        return `${r.from} (${fromDir} → ${toDir})`;
      }
      return `${r.from} → ${r.to}`;
    });
    if (status.renamed.length <= 3) {
      sections.push(`移动 ${status.renamed.length} 个图标: ${renamedDescriptions.join(', ')}`);
    } else {
      const shown = renamedDescriptions.slice(0, 2);
      sections.push(`移动 ${status.renamed.length} 个图标: ${shown.join(', ')} 等`);
    }
  }

  if (sections.length === 0) {
    return '[icon]: 更新图标';
  }

  return '[icon]: ' + sections.join('; ');
}

/**
 * Format file list for commit message
 * Shows up to maxFiles names, then "等 N 个" for remaining
 */
function formatFileList(files, maxFiles = 5) {
  if (files.length <= maxFiles) {
    return files.join(', ');
  }
  
  const shown = files.slice(0, maxFiles);
  const remaining = files.length - maxFiles;
  return `${shown.join(', ')} 等 ${remaining} 个`;
}

/**
 * Commit and push changes
 * If remote has updates, will rebase local commits on top
 */
async function commitAndPush(customMessage = null) {
  try {
    // Check if there are changes to commit
    const status = await git.status();
    const hasChanges = status.files.length > 0;

    if (!hasChanges) {
      return { success: false, message: 'No changes to commit' };
    }

    // Generate or use custom commit message
    const message = customMessage || await generateCommitMessage();

    // Add all svg changes
    await git.add('svg/');

    // Commit
    const commitResult = await git.commit(message);

    if (!commitResult.commit) {
      return { success: false, message: 'Commit failed' };
    }

    // Fetch latest from remote
    await git.fetch();

    // Check if we're behind remote
    const syncStatus = await getSyncStatus();
    
    if (syncStatus.behind > 0) {
      console.log(`📥 Behind remote by ${syncStatus.behind} commit(s), rebasing...`);
      try {
        // Pull with rebase to put our commits on top
        await git.pull(['--rebase']);
        console.log('✅ Rebase successful');
      } catch (rebaseErr) {
        // Rebase conflict - abort and return error
        console.error('❌ Rebase failed:', rebaseErr.message);
        try {
          await git.rebase(['--abort']);
        } catch (abortErr) {
          // Ignore abort errors
        }
        return { 
          success: false, 
          message: 'Rebase 冲突，请手动解决后重试',
          error: rebaseErr.message
        };
      }
    }

    // Push
    await git.push();

    return {
      success: true,
      message: 'Committed and pushed successfully',
      commit: commitResult.commit,
      summary: message.split('\n')[0]
    };
  } catch (err) {
    console.error('Commit/push error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Run git fetch to update remote refs
 */
async function runGitFetch() {
  try {
    console.log('🔄 Running git fetch...');
    await git.fetch();
    console.log('✅ Git fetch complete');
    return { success: true };
  } catch (err) {
    console.error('❌ Git fetch failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check if local branch is synced with remote
 * Returns sync status and ahead/behind counts
 */
async function getSyncStatus() {
  try {
    // Get current branch
    const status = await git.status();
    const currentBranch = status.current;

    if (!currentBranch) {
      return { synced: true, error: 'Not on any branch' };
    }

    // Check if tracking branch exists
    if (!status.tracking) {
      return { synced: true, error: 'No upstream configured' };
    }

    // Get ahead/behind counts from status
    const ahead = status.ahead || 0;
    const behind = status.behind || 0;

    return {
      synced: ahead === 0 && behind === 0,
      ahead,
      behind,
      branch: currentBranch,
      tracking: status.tracking
    };
  } catch (err) {
    console.error('Sync status error:', err.message);
    return { synced: true, error: err.message };
  }
}

/**
 * Get list of current icons
 * @param {boolean} onlyGitChanged - Only return icons that have git changes (default: true)
 */
async function getIconsList(onlyGitChanged = true) {
  const icons = [];
  const nocolorsDir = join(ROOT_DIR, 'svg', 'nocolors');
  const colorsDir = join(ROOT_DIR, 'svg', 'colors');

  // Get git changed files if needed
  let changedFiles = null;
  if (onlyGitChanged) {
    changedFiles = await getGitStatusFiles();
    // No fallback - if no git changes, return empty list
  }

  if (existsSync(nocolorsDir)) {
    readdirSync(nocolorsDir)
      .filter(f => f.endsWith('.svg'))
      .filter(f => !changedFiles || changedFiles.has(f))
      .forEach(f => icons.push({ name: f, type: 'nocolors' }));
  }

  if (existsSync(colorsDir)) {
    readdirSync(colorsDir)
      .filter(f => f.endsWith('.svg'))
      .filter(f => !changedFiles || changedFiles.has(f))
      .forEach(f => icons.push({ name: f, type: 'colors' }));
  }

  return icons;
}

// Create HTTP server
const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API: Upload files
  if (pathname === '/api/upload' && req.method === 'POST') {
    try {
      const result = await parseMultipart(req);
      if (!result) {
        sendJSON(res, 400, { error: 'Invalid multipart data' });
        return;
      }

      const { files, fields } = result;
      const targetDir = fields.targetDir === 'colors' ? 'colors' : 'nocolors';
      const uploadDir = join(ROOT_DIR, 'svg', targetDir);

      // Ensure directory exists
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }

      // Save files (convert Chinese filename to pinyin)
      const savedFiles = [];
      for (const file of files) {
        if (!file.filename.endsWith('.svg')) {
          continue;
        }
        // Convert Chinese characters to pinyin for safe filename
        const originalName = file.filename;
        const baseName = originalName.slice(0, -4); // Remove .svg extension
        const safeName = sanitizeFileName(baseName) + '.svg';
        const filePath = join(uploadDir, safeName);
        writeFileSync(filePath, file.content);
        savedFiles.push(safeName);
        console.log(`📁 Uploaded: ${targetDir}/${safeName}` + (safeName !== originalName ? ` (original: ${originalName})` : ''));
      }

      // Run build
      runBuild().catch(err => console.error('Build error:', err.message));

      sendJSON(res, 200, { 
        success: true, 
        files: savedFiles,
        targetDir,
        message: 'Files uploaded and build started' 
      });
    } catch (err) {
      console.error('Upload error:', err);
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // API: Get icons list (default: only git changed)
  if (pathname === '/api/icons' && req.method === 'GET') {
    const showAll = url.searchParams.get('all') === '1';
    const icons = await getIconsList(!showAll);  // default: onlyGitChanged=true
    sendJSON(res, 200, { icons, filter: showAll ? 'all' : 'git-changed' });
    return;
  }

  // API: Delete icon file (only allowed for git changed files)
  if (pathname === '/api/icons/delete' && req.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const { filename, type } = body;

      if (!filename || !type) {
        sendJSON(res, 400, { error: 'Missing filename or type' });
        return;
      }

      // Check if file is in git changed list
      const changedFiles = await getGitStatusFiles();
      if (!changedFiles.has(filename)) {
        sendJSON(res, 403, { error: 'Can only delete git changed files' });
        return;
      }

      // Delete the file
      const filePath = join(ROOT_DIR, 'svg', type, filename);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log(`🗑️ Deleted: ${type}/${filename}`);
        
        // Trigger build
        runBuild().catch(err => console.error('Build error:', err.message));
        
        sendJSON(res, 200, { success: true, message: 'File deleted' });
      } else {
        sendJSON(res, 404, { error: 'File not found' });
      }
    } catch (err) {
      console.error('Delete error:', err);
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // API: Commit and push changes
  if (pathname === '/api/git/commit-push' && req.method === 'POST') {
    try {
      // Set CORS headers for this endpoint
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      broadcast({ type: 'build-start' });
      const result = await commitAndPush();

      if (result.success) {
        broadcast({ type: 'build-complete', success: true });
        sendJSON(res, 200, result);
      } else {
        broadcast({ type: 'build-complete', success: false, error: result.message });
        sendJSON(res, 400, result);
      }
    } catch (err) {
      console.error('Commit/push API error:', err);
      broadcast({ type: 'build-complete', success: false, error: err.message });
      sendJSON(res, 500, { success: false, message: err.message });
    }
    return;
  }

  // API: Get commit preview (status summary)
  if (pathname === '/api/git/status' && req.method === 'GET') {
    try {
      const status = await getDetailedGitStatus();
      const message = await generateCommitMessage();
      const syncStatus = await getSyncStatus();
      sendJSON(res, 200, { status, message, sync: syncStatus });
    } catch (err) {
      console.error('Git status API error:', err);
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // API: Get sync status (remote sync check)
  if (pathname === '/api/git/sync' && req.method === 'GET') {
    try {
      const syncStatus = await getSyncStatus();
      sendJSON(res, 200, syncStatus);
    } catch (err) {
      console.error('Sync status API error:', err);
      sendJSON(res, 500, { synced: true, error: err.message });
    }
    return;
  }

  // API: Trigger build
  if (pathname === '/api/build' && req.method === 'POST') {
    try {
      await runBuild();
      sendJSON(res, 200, { success: true });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // Static files
  if (pathname.startsWith('/dist/')) {
    const filePath = join(ROOT_DIR, pathname);
    serveFile(res, filePath);
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    serveFile(res, join(ROOT_DIR, 'example', 'dev.html'));
    return;
  }

  // Try to serve from example directory
  const examplePath = join(ROOT_DIR, 'example', pathname);
  if (existsSync(examplePath)) {
    serveFile(res, examplePath);
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');
  clients.add(ws);

  ws.on('close', () => {
    clients.delete(ws);
    console.log('🔌 WebSocket client disconnected');
  });

  // Send initial message
  ws.send(JSON.stringify({ type: 'connected' }));
});

// Start server
server.listen(PORT, async () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  @dqjs/webicon Dev Server                                ║
╠══════════════════════════════════════════════════════════╣
║  Local:    http://localhost:${PORT}                       ║
╚══════════════════════════════════════════════════════════╝
  `);

  // Run git fetch on startup to check sync status
  await runGitFetch();
});
