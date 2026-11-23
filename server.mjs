import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, 'dist');
const DIST_PREFIX = `${DIST_DIR}${path.sep}`;
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT ?? 5173);
const IS_WINDOWS = process.platform === 'win32';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' https: data: blob:",
  "connect-src 'self' https://accounts.google.com https://www.googleapis.com https://docs.google.com https://*.googleusercontent.com https://script.google.com https://script.googleusercontent.com",
  'frame-src https://accounts.google.com',
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
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

let isUpdating = false;

function sendJson(res, status, payload, method = 'GET') {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(method === 'HEAD' ? undefined : JSON.stringify(payload));
}

function isAllowedHostHeader(req) {
  const host = req.headers.host;
  if (typeof host !== 'string') return false;
  const normalized = host.trim().toLowerCase();
  return normalized === `127.0.0.1:${PORT}` || normalized === `localhost:${PORT}`;
}

function isTrustedUpdateRequest(req) {
  const secFetchSite = req.headers['sec-fetch-site'];
  if (typeof secFetchSite === 'string' && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return false;
  }

  const origin = req.headers.origin;
  if (typeof origin === 'string') {
    if (origin === 'null') return false;
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) {
      return false;
    }
    return true;
  }

  // Non-browser local clients must include explicit custom header (browsers cannot forge cross-site without CORS)
  return req.headers['x-ond-action'] === 'update';
}

async function runCmd(command, args, timeoutMs = 60_000) {
  const isWindowsBatch = IS_WINDOWS && /\.(cmd|bat)$/i.test(command);
  const bin = isWindowsBatch ? (process.env.ComSpec || 'cmd.exe') : command;
  const finalArgs = isWindowsBatch ? ['/d', '/s', '/c', command, ...args] : args;

  const { stdout } = await execFileAsync(bin, finalArgs, {
    cwd: __dirname,
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

async function checkUpdateStatus() {
  try {
    await runCmd('git', ['fetch', 'origin', 'main', '--quiet'], 15_000);
    const [localCommit, remoteCommit, behindRaw, porcelain] = await Promise.all([
      runCmd('git', ['rev-parse', '--short', 'HEAD']),
      runCmd('git', ['rev-parse', '--short', 'origin/main']),
      runCmd('git', ['rev-list', '--count', 'HEAD..origin/main']),
      runCmd('git', ['status', '--porcelain']),
    ]);
    const behindCount = Number.parseInt(behindRaw, 10) || 0;
    return {
      ok: true,
      localCommit,
      remoteCommit,
      behindCount,
      updateAvailable: behindCount > 0,
      dirtyWorkingTree: porcelain.length > 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check GitHub updates.';
    return { ok: false, error: message };
  }
}

async function applyUpdate() {
  if (isUpdating) {
    return { ok: false, error: 'An update is already in progress.' };
  }
  isUpdating = true;

  try {
    const porcelain = await runCmd('git', ['status', '--porcelain']);
    if (porcelain.length > 0) {
      return {
        ok: false,
        error: 'Local uncommitted changes detected. Commit or stash them before updating.',
      };
    }

    const beforeLock = await runCmd('git', ['rev-parse', 'HEAD:package-lock.json']).catch(() => '');
    await runCmd('git', ['pull', '--ff-only', 'origin', 'main'], 30_000);
    const afterLock = await runCmd('git', ['rev-parse', 'HEAD:package-lock.json']).catch(() => '');

    const npmBin = IS_WINDOWS ? 'npm.cmd' : 'npm';
    if (beforeLock !== afterLock) {
      await runCmd(npmBin, ['install', '--no-audit', '--no-fund'], 120_000);
    }

    await runCmd(npmBin, ['run', 'build'], 90_000);
    const updatedTo = await runCmd('git', ['rev-parse', '--short', 'HEAD']);
    return { ok: true, updatedTo };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update failed.';
    return { ok: false, error: message };
  } finally {
    isUpdating = false;
  }
}

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
  const rawUrl = req.url ?? '/';
  const pathname = rawUrl.split('?')[0] ?? '/';

  if (!isAllowedHostHeader(req)) {
    res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden Host');
    return;
  }

  if (pathname === '/api/health') {
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }
    sendJson(res, 200, { ok: true, app: 'ond' }, method);
    return;
  }

  if (pathname === '/api/update/status') {
    if (method !== 'GET') {
      res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET' });
      res.end('Method Not Allowed');
      return;
    }
    const status = await checkUpdateStatus();
    sendJson(res, status.ok ? 200 : 500, status);
    return;
  }

  if (pathname === '/api/update/apply') {
    if (method !== 'POST') {
      res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'POST' });
      res.end('Method Not Allowed');
      return;
    }
    if (!isTrustedUpdateRequest(req)) {
      sendJson(res, 403, { ok: false, error: 'Cross-origin update blocked.' });
      return;
    }
    const result = await applyUpdate();
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, {
      ...SECURITY_HEADERS,
      Allow: 'GET, HEAD',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end('Method Not Allowed');
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
    const [realDistDir, realFilePath] = await Promise.all([
      fs.realpath(DIST_DIR),
      fs.realpath(filePath),
    ]);
    const realDistPrefix = `${realDistDir}${path.sep}`;
    if (realFilePath !== realDistDir && !realFilePath.startsWith(realDistPrefix)) {
      res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    const ext = path.extname(realFilePath).toLowerCase();
    const content = await fs.readFile(realFilePath);
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
