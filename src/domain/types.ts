export type WorkspaceTab = 'dashboard' | 'kanban' | 'calendar' | 'notes' | 'calculator';

export type UiThemeId = 'liquid-glass' | 'vision-spatial' | 'obsidian-minimal' | 'aurora-prism';

export interface UiThemePreset {
  readonly id: UiThemeId;
  readonly name: string;
  readonly tag: string;
  readonly description: string;
  readonly previewGradient: string;
  readonly accentBorder: string;
}

export type AngleUnit = 'deg' | 'rad';

export interface CalcHistoryEntry {
  readonly id: string;
  readonly expression: string;
  readonly result: string;
  readonly angleUnit: AngleUnit;
  readonly createdAt: string;
}

export type EventCategory = 'focus' | 'meeting' | 'personal' | 'deadline';

export interface CalendarEvent {
  readonly id: string;
  readonly title: string;
  readonly date: string; // YYYY-MM-DD
  readonly startTime: string | null; // HH:mm or null for all-day
  readonly endTime: string | null; // HH:mm
  readonly category: EventCategory;
  readonly notes: string;
}

export interface NoteItem {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly pinned: boolean;
  readonly updatedAt: string;
}

export type LeadStatus = string;

export type LeadType = 'Needs Website' | 'Update Candidate' | 'Other';

export interface LeadCard {
  readonly id: string;
  businessName: string;
  category: string;
  address: string;
  phone: string;
  email: string;
  websiteUrl: string;
  leadType: LeadType;
  notes: string;
  status: LeadStatus;
  dealValue: number | null;
  followUpDate: string;
  order: number;
  readonly createdAt: string;
  updatedAt: string;
}

export interface KanbanColumnConfig {
  readonly id: string;
  readonly title: string;
  readonly shortLabel: string;
  readonly accent: string;
  readonly isDone?: boolean;
}

export interface KanbanTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly columns: readonly KanbanColumnConfig[];
}

export type WallpaperPreset =
  | {
      readonly id: string;
      readonly name: string;
      readonly tag: string;
      readonly kind: 'image';
      readonly src: string;
    }
  | {
      readonly id: string;
      readonly name: string;
      readonly tag: string;
      readonly kind: 'gradient';
      readonly css: string;
    };

export interface BoardPreferences {
  boardTitle: string;
  googleSheetUrl: string;
  uiTheme: UiThemeId;
  defaultTab: 'kanban' | 'dashboard';
  wallpaperId: string;
  customWallpaperUrl: string;
  hasCustomUpload: boolean;
  dimOpacity: number;
  glassBlur: number;
  appsScriptUrl: string;
  appsScriptToken: string;
  csvPublishUrl: string;
  googleClientId: string;
  weekStartsOn: 1 | 7;
  calcAngleUnit: AngleUnit;
}

export interface Result<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: string;
}

const VALID_EVENT_CATEGORIES: ReadonlySet<string> = new Set<EventCategory>([
  'focus',
  'meeting',
  'personal',
  'deadline',
]);

const VALID_UI_THEMES: ReadonlySet<string> = new Set<UiThemeId>([
  'liquid-glass',
  'vision-spatial',
  'obsidian-minimal',
  'aurora-prism',
]);

export function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === 'string' && VALID_EVENT_CATEGORIES.has(value);
}

export function isUiThemeId(value: unknown): value is UiThemeId {
  return typeof value === 'string' && VALID_UI_THEMES.has(value);
}

export function normalizeLeadType(raw: string): LeadType {
  const cleaned = raw.trim().toLowerCase();
  if (cleaned.includes('update')) return 'Update Candidate';
  if (cleaned.includes('need')) return 'Needs Website';
  return 'Other';
}

export function extractCity(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return 'Location TBD';
  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2].replace(/\b\d{5}(?:-\d{4})?\b/g, '').trim();
    if (candidate) return candidate;
  }
  const fallback = parts[parts.length - 1]?.replace(/\b\d{5}(?:-\d{4})?\b/g, '').trim();
  return fallback || 'Location TBD';
}

export function sanitizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function normalizeWebsiteHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /^none$/i.test(trimmed) || /^n\/a$/i.test(trimmed)) {
    return null;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return sanitizeHttpUrl(trimmed);
  }
  if (trimmed.includes('.')) {
    return sanitizeHttpUrl(`https://${trimmed}`);
  }
  return null;
}

export function formatWebsiteHost(raw: string): string | null {
  const href = normalizeWebsiteHref(raw);
  if (!href) return null;
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return raw.trim();
  }
}

export function formatShortCategory(raw: string): string {
  const match = raw.match(/\(([^)]+)\)/);
  if (match && match[1]) return match[1].trim();
  return raw.trim() || 'Business';
}
