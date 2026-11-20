import {
  isLeadStatus,
  normalizeLeadType,
  type BoardPreferences,
  type LeadCard,
} from '../domain/types';
import { normalizeWallpaperId } from '../domain/wallpapers';

const LEADS_STORAGE_KEY = 'ond_kanban_cards_v1';
const LEGACY_LEADS_KEYS = ['sheet_kanban_cards_v1', 'pr_leads_kanban_cards_v1'] as const;
const PREFS_STORAGE_KEY = 'ond_kanban_prefs_v1';
const LEGACY_PREFS_KEYS = ['sheet_kanban_prefs_v1', 'pr_leads_kanban_prefs_v1'] as const;
const IDB_NAME = 'ond_kanban_media_v1';
const LEGACY_IDB_NAMES = ['sheet_kanban_media_v1', 'pr_leads_kanban_media_v1'] as const;
const IDB_STORE = 'wallpapers';
const CUSTOM_WALLPAPER_KEY = 'active_custom_wallpaper';

export const DEFAULT_PREFERENCES: BoardPreferences = {
  boardTitle: 'OND',
  googleSheetUrl: '',
  wallpaperId: 'coastal-twilight',
  customWallpaperUrl: '',
  hasCustomUpload: false,
  dimOpacity: 0.42,
  glassBlur: 18,
  appsScriptUrl: '',
  csvPublishUrl: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseStoredLead(raw: unknown, fallbackOrder: number): LeadCard | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.businessName !== 'string') return null;

  const now = new Date().toISOString();
  return {
    id: raw.id,
    businessName: raw.businessName,
    category: typeof raw.category === 'string' ? raw.category : '',
    address: typeof raw.address === 'string' ? raw.address : '',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    email: typeof raw.email === 'string' ? raw.email : '',
    websiteUrl: typeof raw.websiteUrl === 'string' ? raw.websiteUrl : '',
    leadType: typeof raw.leadType === 'string' ? normalizeLeadType(raw.leadType) : 'Needs Website',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    status: isLeadStatus(raw.status) ? raw.status : 'leads',
    dealValue:
      typeof raw.dealValue === 'number' && Number.isFinite(raw.dealValue) ? raw.dealValue : null,
    followUpDate: typeof raw.followUpDate === 'string' ? raw.followUpDate : '',
    order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : fallbackOrder,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  };
}

function readFirstStoredKey(primary: string, fallbacks: readonly string[]): string | null {
  const direct = window.localStorage.getItem(primary);
  if (direct) return direct;
  for (const key of fallbacks) {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

export function loadLeads(): LeadCard[] {
  try {
    const raw = readFirstStoredKey(LEADS_STORAGE_KEY, LEGACY_LEADS_KEYS);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => parseStoredLead(item, index))
      .filter((item): item is LeadCard => item !== null);
  } catch {
    return [];
  }
}

export function saveLeads(leads: readonly LeadCard[]): void {
  try {
    window.localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
  } catch (error) {
    console.error('Failed to persist leads to localStorage:', error);
  }
}

export function loadPreferences(): BoardPreferences {
  try {
    const raw = readFirstStoredKey(PREFS_STORAGE_KEY, LEGACY_PREFS_KEYS);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { ...DEFAULT_PREFERENCES };

    const rawTitle = typeof parsed.boardTitle === 'string' ? parsed.boardTitle.trim() : '';
    const migratedTitle = !rawTitle || rawTitle === 'SheetKanban' ? 'OND' : rawTitle;

    return {
      boardTitle: migratedTitle,
      googleSheetUrl: typeof parsed.googleSheetUrl === 'string' ? parsed.googleSheetUrl : '',
      wallpaperId:
        typeof parsed.wallpaperId === 'string'
          ? normalizeWallpaperId(parsed.wallpaperId)
          : DEFAULT_PREFERENCES.wallpaperId,
      customWallpaperUrl:
        typeof parsed.customWallpaperUrl === 'string' ? parsed.customWallpaperUrl : '',
      hasCustomUpload: Boolean(parsed.hasCustomUpload),
      dimOpacity:
        typeof parsed.dimOpacity === 'number' && parsed.dimOpacity >= 0 && parsed.dimOpacity <= 0.85
          ? parsed.dimOpacity
          : DEFAULT_PREFERENCES.dimOpacity,
      glassBlur:
        typeof parsed.glassBlur === 'number' && parsed.glassBlur >= 4 && parsed.glassBlur <= 32
          ? parsed.glassBlur
          : DEFAULT_PREFERENCES.glassBlur,
      appsScriptUrl: typeof parsed.appsScriptUrl === 'string' ? parsed.appsScriptUrl : '',
      csvPublishUrl: typeof parsed.csvPublishUrl === 'string' ? parsed.csvPublishUrl : '',
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: BoardPreferences): void {
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.error('Failed to persist preferences to localStorage:', error);
  }
}

function openWallpaperDb(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

async function readFromDb(dbName: string): Promise<string | null> {
  try {
    const db = await openWallpaperDb(dbName);
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const request = tx.objectStore(IDB_STORE).get(CUSTOM_WALLPAPER_KEY);
      request.onsuccess = () => {
        db.close();
        resolve(typeof request.result === 'string' ? request.result : null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error ?? new Error('Failed to read custom wallpaper'));
      };
    });
  } catch {
    return null;
  }
}

export async function saveCustomWallpaperDataUrl(dataUrl: string): Promise<void> {
  const db = await openWallpaperDb(IDB_NAME);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(dataUrl, CUSTOM_WALLPAPER_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to store custom wallpaper'));
    };
  });
}

export async function loadCustomWallpaperDataUrl(): Promise<string | null> {
  const current = await readFromDb(IDB_NAME);
  if (current) return current;
  for (const legacyDb of LEGACY_IDB_NAMES) {
    const found = await readFromDb(legacyDb);
    if (found) return found;
  }
  return null;
}

export async function clearCustomWallpaperDataUrl(): Promise<void> {
  try {
    const db = await openWallpaperDb(IDB_NAME);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(CUSTOM_WALLPAPER_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Failed to delete custom wallpaper'));
      };
    });
  } catch (error) {
    console.error('Failed to clear custom wallpaper:', error);
  }
}
