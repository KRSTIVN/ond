import { contextBridge, ipcRenderer } from 'electron';
import type {
  DesktopUpdateActionResult,
  DesktopUpdateCheckResult,
  DesktopUpdateEvent,
  OndDesktopBridge,
} from '../src/desktop-bridge';

const platform =
  process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux';

const desktopApi: OndDesktopBridge = {
  isDesktop: true,
  platform,
  getVersion: (): Promise<string> => ipcRenderer.invoke('ond:get-version'),
  checkForUpdates: (): Promise<DesktopUpdateCheckResult> =>
    ipcRenderer.invoke('ond:check-for-updates'),
  installUpdate: (): Promise<DesktopUpdateActionResult> =>
    ipcRenderer.invoke('ond:install-update'),
  onUpdateEvent: (listener: (event: DesktopUpdateEvent) => void): (() => void) => {
    const wrapped = (_ipcEvent: Electron.IpcRendererEvent, payload: DesktopUpdateEvent) => {
      listener(payload);
    };
    ipcRenderer.on('ond:update-event', wrapped);
    return () => {
      ipcRenderer.removeListener('ond:update-event', wrapped);
    };
  },
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('ond:open-external', url),
};

contextBridge.exposeInMainWorld('ondDesktop', desktopApi);
