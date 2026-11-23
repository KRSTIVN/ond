import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  session,
  shell,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import type {
  DesktopUpdateActionResult,
  DesktopUpdateCheckResult,
  DesktopUpdateEvent,
} from '../src/desktop-bridge';

const RELEASES_URL = 'https://github.com/KRSTIVN/ond/releases/latest';
const HOST = '127.0.0.1';
const PREFERRED_PORTS = [5173, 45173, 0] as const;

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

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
};

const MIME_TYPES = new Map<string, string>([
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

interface WindowBoundsState {
  readonly width: number;
  readonly height: number;
  readonly isMaximized: boolean;
}

const DEFAULT_BOUNDS: WindowBoundsState = {
  width: 1440,
  height: 920,
  isMaximized: false,
};

let mainWindow: BrowserWindow | null = null;
let staticServer: http.Server | null = null;
let serverUrl = '';
let updateDownloaded = false;
let latestAvailableVersion: string | undefined;

function getDistDir(): string {
  return path.resolve(app.getAppPath(), 'dist');
}

function getWindowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

async function loadWindowBounds(): Promise<WindowBoundsState> {
  try {
    const raw = await fs.readFile(getWindowStatePath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<WindowBoundsState>;
    const width =
      typeof parsed.width === 'number' && parsed.width >= 900 ? Math.round(parsed.width) : 1440;
    const height =
      typeof parsed.height === 'number' && parsed.height >= 620 ? Math.round(parsed.height) : 920;
    return { width, height, isMaximized: Boolean(parsed.isMaximized) };
  } catch {
    return DEFAULT_BOUNDS;
  }
}

async function saveWindowBounds(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed()) return;
  const isMaximized = win.isMaximized();
  const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
  const payload: WindowBoundsState = {
    width: Math.max(900, bounds.width),
    height: Math.max(620, bounds.height),
    isMaximized,
  };
  try {
    await fs.writeFile(getWindowStatePath(), JSON.stringify(payload, null, 2), 'utf-8');
  } catch {
    // Ignore non-critical window-state persistence failure.
  }
}

function resolveSafeStaticPath(
  distDir: string,
  urlPathname: string,
): { readonly status: number; readonly filePath: string | null } {
  const distPrefix = `${distDir}${path.sep}`;
  let decoded: string;
  try {
    decoded = decodeURIComponent((urlPathname.split('?')[0] ?? '/').replace(/\0/g, ''));
  } catch {
    return { status: 400, filePath: null };
  }

  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const relativePath = normalized === '/' || normalized === path.sep ? 'index.html' : normalized;
  const candidate = path.resolve(distDir, relativePath.replace(/^[/\\]+/, ''));

  if (candidate !== distDir && !candidate.startsWith(distPrefix)) {
    return { status: 403, filePath: null };
  }

  return { status: 200, filePath: candidate };
}

function tryListen(server: http.Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to bind local OND server port'));
        return;
      }
      resolve(addr.port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, HOST);
  });
}

async function startInternalStaticServer(): Promise<string> {
  const distDir = getDistDir();
  const realDistDir = await fs.realpath(distDir).catch(() => distDir);
  const realDistPrefix = `${realDistDir}${path.sep}`;
  let activePort = 0;

  const isAllowedHostHeader = (hostHeader: string | undefined): boolean => {
    if (!hostHeader) return false;
    const normalized = hostHeader.trim().toLowerCase();
    return normalized === `127.0.0.1:${activePort}` || normalized === `localhost:${activePort}`;
  };

  const server = http.createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';
    const pathname = rawUrl.split('?')[0] ?? '/';

    if (!isAllowedHostHeader(req.headers.host)) {
      res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden Host');
      return;
    }

    if (pathname === '/api/health') {
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(method === 'HEAD' ? undefined : JSON.stringify({ ok: true, app: 'ond-desktop' }));
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }

    const resolved = resolveSafeStaticPath(distDir, rawUrl);
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
      const filePath = stat.isDirectory()
        ? path.join(resolved.filePath, 'index.html')
        : resolved.filePath;
      const realFilePath = await fs.realpath(filePath);
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
        const indexHtml = await fs.readFile(path.join(realDistDir, 'index.html'));
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
        res.end('OND build output missing.');
      }
    }
  });

  for (const candidatePort of PREFERRED_PORTS) {
    try {
      const boundPort = await tryListen(server, candidatePort);
      activePort = boundPort;
      staticServer = server;
      return `http://${HOST}:${boundPort}`;
    } catch {
      // Try next port candidate
    }
  }

  throw new Error('Could not bind a local loopback port for OND.');
}

function sendUpdateEvent(event: DesktopUpdateEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('ond:update-event', event);
}

function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function isGoogleAuthPopup(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'accounts.google.com' || parsed.hostname.endsWith('.accounts.google.com'))
    );
  } catch {
    return false;
  }
}

function configureAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    latestAvailableVersion = info.version;
    sendUpdateEvent({ type: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', (info) => {
    latestAvailableVersion = undefined;
    sendUpdateEvent({ type: 'not-available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateEvent({ type: 'progress', percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    latestAvailableVersion = info.version;
    sendUpdateEvent({ type: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (error) => {
    sendUpdateEvent({
      type: 'error',
      message: error instanceof Error ? error.message : 'Auto-updater error.',
    });
  });
}

function isSameAppOrigin(rawUrl: string): boolean {
  if (!serverUrl) return false;
  try {
    return new URL(rawUrl).origin === new URL(serverUrl).origin;
  } catch {
    return false;
  }
}

function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url ?? '';
  if (!isSameAppOrigin(senderUrl)) {
    throw new Error('Blocked IPC call from untrusted origin.');
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('ond:get-version', (event) => {
    assertTrustedIpcSender(event);
    return app.getVersion();
  });

  ipcMain.handle('ond:open-external', async (event, url: unknown) => {
    assertTrustedIpcSender(event);
    if (typeof url !== 'string' || !isAllowedExternalUrl(url)) return;
    await shell.openExternal(url);
  });

  ipcMain.handle('ond:check-for-updates', async (event): Promise<DesktopUpdateCheckResult> => {
    assertTrustedIpcSender(event);
    const currentVersion = app.getVersion();
    if (!app.isPackaged) {
      return {
        ok: true,
        currentVersion,
        updateAvailable: false,
      };
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      const latestVersion = result?.updateInfo?.version;
      const hasUpdate = Boolean(latestVersion && latestVersion !== currentVersion);
      if (hasUpdate) {
        latestAvailableVersion = latestVersion;
      }
      return {
        ok: true,
        currentVersion,
        latestVersion,
        updateAvailable: hasUpdate || updateDownloaded,
        downloaded: updateDownloaded,
      };
    } catch (error) {
      return {
        ok: false,
        currentVersion,
        updateAvailable: false,
        error: error instanceof Error ? error.message : 'Unable to reach GitHub Releases.',
      };
    }
  });

  ipcMain.handle('ond:install-update', async (event): Promise<DesktopUpdateActionResult> => {
    assertTrustedIpcSender(event);
    if (!app.isPackaged) {
      return { ok: false, error: 'Updates are only available in installed desktop builds.' };
    }

    if (updateDownloaded) {
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
      return { ok: true, mode: 'installing', version: latestAvailableVersion };
    }

    try {
      await autoUpdater.downloadUpdate();
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
      return { ok: true, mode: 'installing', version: latestAvailableVersion };
    } catch (error) {
      // On unsigned macOS builds, Squirrel.Mac rejects silent self-updates — open the latest release DMG.
      if (process.platform === 'darwin') {
        await shell.openExternal(RELEASES_URL);
        return { ok: true, mode: 'manual-download', version: latestAvailableVersion };
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to download update.',
      };
    }
  });
}

function configureApplicationMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createMainWindow(): Promise<void> {
  const bounds = await loadWindowBounds();
  const isMac = process.platform === 'darwin';
  const iconPath = path.resolve(app.getAppPath(), 'build', isMac ? 'icon.png' : 'icon.ico');

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: 'OND — Workspace',
    backgroundColor: '#070a12',
    autoHideMenuBar: !isMac,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (bounds.isMaximized) {
    win.maximize();
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('close', () => {
    void saveWindowBounds(win);
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isGoogleAuthPopup(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 660,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }

    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (isSameAppOrigin(targetUrl)) return;
    if (isGoogleAuthPopup(targetUrl)) return;
    event.preventDefault();
    if (isAllowedExternalUrl(targetUrl)) {
      void shell.openExternal(targetUrl);
    }
  });

  mainWindow = win;
  const targetUrl = process.env.OND_DEV_URL || serverUrl;
  await win.loadURL(targetUrl);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.ond.workspace');
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowed = permission === 'clipboard-read' || permission === 'clipboard-sanitized-write';
      callback(allowed);
    });
    configureApplicationMenu();
    configureAutoUpdater();
    registerIpcHandlers();

    if (!process.env.OND_DEV_URL) {
      serverUrl = await startInternalStaticServer();
    } else {
      serverUrl = process.env.OND_DEV_URL;
    }

    await createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    if (staticServer) {
      staticServer.close();
      staticServer = null;
    }
  });
}
