import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT ?? 5173);

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);

function resolveSafePath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname.split('?')[0] ?? '/');
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const candidate = path.join(DIST_DIR, normalized === '/' ? 'index.html' : normalized);
  if (!candidate.startsWith(DIST_DIR)) {
    return null;
  }
  return candidate;
}

const server = http.createServer(async (req, res) => {
  const rawUrl = req.url ?? '/';

  if (rawUrl === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, app: 'sheet-kanban' }));
    return;
  }

  const targetPath = resolveSafePath(rawUrl);
  if (!targetPath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(targetPath);
    const filePath = stat.isDirectory() ? path.join(targetPath, 'index.html') : targetPath;
    const ext = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES.get(ext) ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(content);
  } catch {
    try {
      const indexHtml = await fs.readFile(path.join(DIST_DIR, 'index.html'));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(indexHtml);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Build output missing. Run "npm run build" first.');
    }
  }
});

server.on('error', (error) => {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    process.exit(0);
  }
  console.error('SheetKanban server error:', error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`SheetKanban running at http://${HOST}:${PORT}`);
});
