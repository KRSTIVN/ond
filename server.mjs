import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, 'dist');
const DIST_PREFIX = `${DIST_DIR}${path.sep}`;
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT ?? 5173);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

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
  let decoded;
  try {
    decoded = decodeURIComponent((urlPathname.split('?')[0] ?? '/').replace(/\0/g, ''));
  } catch {
    return { status: 400, filePath: null };
  }

  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const relativePath = normalized === '/' || normalized === path.sep ? 'index.html' : normalized;
  const candidate = path.resolve(DIST_DIR, relativePath.replace(/^[/\\]+/, ''));

  if (candidate !== DIST_DIR && !candidate.startsWith(DIST_PREFIX)) {
    return { status: 403, filePath: null };
  }

  return { status: 200, filePath: candidate };
}

const server = http.createServer(async (req, res) => {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, {
      ...SECURITY_HEADERS,
      Allow: 'GET, HEAD',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end('Method Not Allowed');
    return;
  }

  const rawUrl = req.url ?? '/';
  if (rawUrl === '/api/health') {
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(method === 'HEAD' ? undefined : JSON.stringify({ ok: true, app: 'ond' }));
    return;
  }

  const resolved = resolveSafePath(rawUrl);
  if (!resolved.filePath) {
    res.writeHead(resolved.status, {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end(resolved.status === 400 ? 'Bad Request' : 'Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(resolved.filePath);
    const filePath = stat.isDirectory() ? path.join(resolved.filePath, 'index.html') : resolved.filePath;
    const ext = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': MIME_TYPES.get(ext) ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(method === 'HEAD' ? undefined : content);
  } catch {
    try {
      const indexHtml = await fs.readFile(path.join(DIST_DIR, 'index.html'));
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(method === 'HEAD' ? undefined : indexHtml);
    } catch {
      res.writeHead(500, {
        ...SECURITY_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
      });
      res.end('Build output missing. Run "npm run build" first.');
    }
  }
});

server.on('error', (error) => {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    process.exit(0);
  }
  console.error('OND server error:', error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`OND running at http://${HOST}:${PORT}`);
});
