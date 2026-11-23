export interface DesktopUpdateCheckResult {
  readonly ok: boolean;
  readonly currentVersion: string;
  readonly latestVersion?: string;
  readonly updateAvailable: boolean;
  readonly downloaded?: boolean;
  readonly error?: string;
}

export interface DesktopUpdateActionResult {
  readonly ok: boolean;
  readonly mode?: 'installing' | 'manual-download';
  readonly version?: string;
  readonly error?: string;
}

export type DesktopUpdateEvent =
  | { readonly type: 'available'; readonly version: string }
  | { readonly type: 'not-available'; readonly version: string }
  | { readonly type: 'progress'; readonly percent: number }
  | { readonly type: 'downloaded'; readonly version: string }
  | { readonly type: 'error'; readonly message: string };

export interface OndDesktopBridge {
  readonly isDesktop: true;
  readonly platform: 'win32' | 'darwin' | 'linux';
  readonly getVersion: () => Promise<string>;
  readonly checkForUpdates: () => Promise<DesktopUpdateCheckResult>;
  readonly installUpdate: () => Promise<DesktopUpdateActionResult>;
  readonly onUpdateEvent: (listener: (event: DesktopUpdateEvent) => void) => () => void;
  readonly openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    readonly ondDesktop?: OndDesktopBridge;
  }
}

export {};
