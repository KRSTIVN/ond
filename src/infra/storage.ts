import { DEFAULT_KANBAN_COLUMNS, makeShortLabel } from '../domain/columns';
import {
  isEventCategory,
  isUiThemeId,
  normalizeLeadType,
  sanitizeHttpUrl,
  type BoardPreferences,
  type CalcHistoryEntry,
  type CalendarEvent,
  type KanbanColumnConfig,
  type LeadCard,
  type NoteItem,
} from '../domain/types';
import { normalizeWallpaperId } from '../domain/wallpapers';

const LEADS_STORAGE_KEY = 'ond_kanban_cards_v1';
const LEGACY_LEADS_KEYS = ['sheet_kanban_cards_v1', 'pr_leads_kanban_cards_v1'] as const;
const COLUMNS_STORAGE_KEY = 'ond_kanban_columns_v1';
const PREFS_STORAGE_KEY = 'ond_kanban_prefs_v1';
const LEGACY_PREFS_KEYS = ['sheet_kanban_prefs_v1', 'pr_leads_kanban_prefs_v1'] as const;
const EVENTS_STORAGE_KEY = 'ond_calendar_events_v1';
const NOTES_STORAGE_KEY = 'ond_notes_v1';
const CALC_HISTORY_STORAGE_KEY = 'ond_calc_history_v1';
const IDB_NAME = 'ond_kanban_media_v1';
const LEGACY_IDB_NAMES = ['sheet_kanban_media_v1', 'pr_leads_kanban_media_v1'] as const;
const IDB_STORE = 'wallpapers';
const CUSTOM_WALLPAPER_KEY = 'active_custom_wallpaper';
const MAX_CALC_HISTORY = 50;

export const DEFAULT_PREFERENCES: BoardPreferences = {
  boardTitle: 'OND',
  googleSheetUrl: '',
  uiTheme: 'liquid-glass',
  defaultTab: 'kanban',
  wallpaperId: 'coastal-twilight',
  customWallpaperUrl: '',
  hasCustomUpload: false,
  dimOpacity: 0.42,
  glassBlur: 18,
  appsScriptUrl: '',
  appsScriptToken: '',
  csvPublishUrl: '',
  googleClientId: '',
  weekStartsOn: 1,
  calcAngleUnit: 'deg',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseStoredLead(raw: unknown, fallbackOrder: number): LeadCard | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.businessName !== 'string') return null;

  const now = new Date().toISOString();
  const status = typeof raw.status === 'string' && raw.status.trim() ? raw.status.trim() : 'leads';
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
    status,
    dealValue:
      typeof raw.dealValue === 'number' && Number.isFinite(raw.dealValue) ? raw.dealValue : null,
    followUpDate: typeof raw.followUpDate === 'string' ? raw.followUpDate : '',
    order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : fallbackOrder,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  };
}

function parseStoredColumn(raw: unknown): KanbanColumnConfig | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id.trim() || typeof raw.title !== 'string' || !raw.title.trim()) {
    return null;
  }
  const title = raw.title.trim();
  return {
    id: raw.id.trim(),
    title,
    shortLabel:
      typeof raw.shortLabel === 'string' && raw.shortLabel.trim()
        ? raw.shortLabel.trim()
        : makeShortLabel(title),
    accent:
      typeof raw.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.accent)
        ? raw.accent
        : '#818cf8',
    isDone: Boolean(raw.isDone),
  };
}

function parseStoredEvent(raw: unknown): CalendarEvent | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.id !== 'string' ||
    typeof raw.title !== 'string' ||
    typeof raw.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)
  ) {
    return null;
  }

  return {
    id: raw.id,
    title: raw.title,
    date: raw.date,
    startTime:
      typeof raw.startTime === 'string' && /^\d{2}:\d{2}$/.test(raw.startTime)
        ? raw.startTime
        : null,
    endTime:
      typeof raw.endTime === 'string' && /^\d{2}:\d{2}$/.test(raw.endTime) ? raw.endTime : null,
    category: isEventCategory(raw.category) ? raw.category : 'focus',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
  };
}

function parseStoredNote(raw: unknown): NoteItem | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string') return null;

  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : [];

  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    tags,
    pinned: Boolean(raw.pinned),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

function parseStoredCalcEntry(raw: unknown): CalcHistoryEntry | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.id !== 'string' ||
    typeof raw.expression !== 'string' ||
    typeof raw.result !== 'string'
  ) {
    return null;
  }

  return {
    id: raw.id,
    expression: raw.expression,
    result: raw.result,
    angleUnit: raw.angleUnit === 'rad' ? 'rad' : 'deg',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
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

export function loadColumns(): KanbanColumnConfig[] {
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_KANBAN_COLUMNS];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_KANBAN_COLUMNS];
    const valid = parsed
      .map((item) => parseStoredColumn(item))
      .filter((item): item is KanbanColumnConfig => item !== null);
    return valid.length > 0 ? valid : [...DEFAULT_KANBAN_COLUMNS];
  } catch {
    return [...DEFAULT_KANBAN_COLUMNS];
  }
}

export function saveColumns(columns: readonly KanbanColumnConfig[]): void {
  try {
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  } catch (error) {
    console.error('Failed to persist columns to localStorage:', error);
  }
}

export function loadCalendarEvents(): CalendarEvent[] {
  try {
    const raw = window.localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => parseStoredEvent(item))
      .filter((item): item is CalendarEvent => item !== null);
  } catch {
    return [];
  }
}

export function saveCalendarEvents(events: readonly CalendarEvent[]): void {
  try {
    window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    console.error('Failed to persist calendar events:', error);
  }
}

export function loadNotes(): NoteItem[] {
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => parseStoredNote(item))
      .filter((item): item is NoteItem => item !== null);
  } catch {
    return [];
  }
}

export function saveNotes(notes: readonly NoteItem[]): void {
  try {
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error('Failed to persist notes:', error);
  }
}

export function loadCalcHistory(): CalcHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(CALC_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => parseStoredCalcEntry(item))
      .filter((item): item is CalcHistoryEntry => item !== null)
      .slice(0, MAX_CALC_HISTORY);
  } catch {
    return [];
  }
}

export function saveCalcHistory(history: readonly CalcHistoryEntry[]): void {
  try {
    window.localStorage.setItem(
      CALC_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, MAX_CALC_HISTORY)),
    );
  } catch (error) {
    console.error('Failed to persist calculator history:', error);
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
      googleSheetUrl:
        typeof parsed.googleSheetUrl === 'string'
          ? (sanitizeHttpUrl(parsed.googleSheetUrl) ?? '')
          : '',
      uiTheme: isUiThemeId(parsed.uiTheme) ? parsed.uiTheme : DEFAULT_PREFERENCES.uiTheme,
      defaultTab: parsed.defaultTab === 'dashboard' ? 'dashboard' : 'kanban',
      wallpaperId:
        typeof parsed.wallpaperId === 'string'
          ? normalizeWallpaperId(parsed.wallpaperId)
          : DEFAULT_PREFERENCES.wallpaperId,
      customWallpaperUrl:
        typeof parsed.customWallpaperUrl === 'string'
          ? (sanitizeHttpUrl(parsed.customWallpaperUrl) ?? '')
          : '',
      hasCustomUpload: Boolean(parsed.hasCustomUpload),
      dimOpacity:
        typeof parsed.dimOpacity === 'number' && parsed.dimOpacity >= 0 && parsed.dimOpacity <= 0.85
          ? parsed.dimOpacity
          : DEFAULT_PREFERENCES.dimOpacity,
      glassBlur:
        typeof parsed.glassBlur === 'number' && parsed.glassBlur >= 4 && parsed.glassBlur <= 32
          ? parsed.glassBlur
          : DEFAULT_PREFERENCES.glassBlur,
      appsScriptUrl:
        typeof parsed.appsScriptUrl === 'string'
          ? (sanitizeHttpUrl(parsed.appsScriptUrl) ?? '')
          : '',
      appsScriptToken: typeof parsed.appsScriptToken === 'string' ? parsed.appsScriptToken : '',
      csvPublishUrl:
        typeof parsed.csvPublishUrl === 'string'
          ? (sanitizeHttpUrl(parsed.csvPublishUrl) ?? '')
          : '',
      googleClientId: typeof parsed.googleClientId === 'string' ? parsed.googleClientId : '',
      weekStartsOn: parsed.weekStartsOn === 7 ? 7 : 1,
      calcAngleUnit: parsed.calcAngleUnit === 'rad' ? 'rad' : 'deg',
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
