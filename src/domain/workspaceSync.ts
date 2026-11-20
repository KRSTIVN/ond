import { isValidPlainDate, isValidPlainTime } from './calendar/temporal';
import {
  isEventCategory,
  type CalendarEvent,
  type KanbanColumnConfig,
  type NoteItem,
  type Result,
} from './types';

export interface WorkspaceSyncPayload {
  readonly version: 1;
  readonly exportedAt: string;
  readonly calendarEvents: readonly CalendarEvent[];
  readonly notes: readonly NoteItem[];
  readonly columns?: readonly KanbanColumnConfig[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function serializeWorkspacePayload(
  calendarEvents: readonly CalendarEvent[],
  notes: readonly NoteItem[],
  columns?: readonly KanbanColumnConfig[],
): string {
  const payload: WorkspaceSyncPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    calendarEvents,
    notes,
    ...(columns ? { columns } : {}),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseWorkspacePayload(rawJson: string): Result<WorkspaceSyncPayload> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'Invalid JSON file.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'Unexpected backup structure.' };
  }

  const rawEvents = Array.isArray(parsed.calendarEvents) ? parsed.calendarEvents : [];
  const rawNotes = Array.isArray(parsed.notes) ? parsed.notes : [];
  const rawColumns = Array.isArray(parsed.columns) ? parsed.columns : undefined;

  const calendarEvents: CalendarEvent[] = [];
  for (const item of rawEvents) {
    if (!isRecord(item)) continue;
    if (typeof item.title !== 'string' || typeof item.date !== 'string') continue;
    if (!isValidPlainDate(item.date)) continue;

    const startTime =
      typeof item.startTime === 'string' && isValidPlainTime(item.startTime)
        ? item.startTime
        : null;
    const endTime =
      typeof item.endTime === 'string' && isValidPlainTime(item.endTime) ? item.endTime : null;

    calendarEvents.push({
      id: typeof item.id === 'string' && item.id ? item.id : `evt-${crypto.randomUUID().slice(0, 8)}`,
      title: item.title.trim() || 'Untitled Event',
      date: item.date,
      startTime,
      endTime,
      category: isEventCategory(item.category) ? item.category : 'focus',
      notes: typeof item.notes === 'string' ? item.notes : '',
    });
  }

  const notes: NoteItem[] = [];
  for (const item of rawNotes) {
    if (!isRecord(item)) continue;
    const tags = Array.isArray(item.tags)
      ? item.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      : [];
    notes.push({
      id: typeof item.id === 'string' && item.id ? item.id : `note-${crypto.randomUUID().slice(0, 8)}`,
      title: typeof item.title === 'string' ? item.title : 'Untitled Note',
      content: typeof item.content === 'string' ? item.content : '',
      tags,
      pinned: Boolean(item.pinned),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
    });
  }

  let columns: KanbanColumnConfig[] | undefined;
  if (rawColumns) {
    const validCols: KanbanColumnConfig[] = [];
    for (const col of rawColumns) {
      if (!isRecord(col)) continue;
      if (typeof col.id !== 'string' || typeof col.title !== 'string') continue;
      validCols.push({
        id: col.id,
        title: col.title,
        shortLabel: typeof col.shortLabel === 'string' ? col.shortLabel : col.title.slice(0, 12),
        accent: typeof col.accent === 'string' ? col.accent : '#818cf8',
        isDone: Boolean(col.isDone),
      });
    }
    if (validCols.length > 0) columns = validCols;
  }

  return {
    ok: true,
    data: {
      version: 1,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      calendarEvents,
      notes,
      columns,
    },
  };
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Export OND Calendar events to standard RFC-5545 .ics (compatible with Apple Calendar, Google Calendar, Outlook). */
export function serializeEventsToIcs(events: readonly CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OND Workspace//Calendar//EN',
    'CALSCALE:GREGORIAN',
  ];

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  for (const evt of events) {
    const compactDate = evt.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${evt.id}@ond.local`);
    lines.push(`DTSTAMP:${stamp}`);
    if (evt.startTime) {
      const startCompact = `${compactDate}T${evt.startTime.replace(':', '')}00`;
      const endTime = evt.endTime ?? evt.startTime;
      const endCompact = `${compactDate}T${endTime.replace(':', '')}00`;
      lines.push(`DTSTART:${startCompact}`);
      lines.push(`DTEND:${endCompact}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDate}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(evt.title)}`);
    lines.push(`CATEGORIES:${evt.category.toUpperCase()}`);
    if (evt.notes) {
      lines.push(`DESCRIPTION:${escapeIcsText(evt.notes)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function parseIcsDateTime(rawValue: string): { date: string; time: string | null } | null {
  const value = rawValue.trim();
  const dtMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (dtMatch) {
    const date = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`;
    const time = `${dtMatch[4]}:${dtMatch[5]}`;
    if (!isValidPlainDate(date) || !isValidPlainTime(time)) return null;
    return { date, time };
  }
  const dateMatch = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (dateMatch) {
    const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    if (!isValidPlainDate(date)) return null;
    return { date, time: null };
  }
  return null;
}

export function parseEventsFromIcs(icsText: string): Result<CalendarEvent[]> {
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.split('BEGIN:VEVENT').slice(1);
  if (blocks.length === 0) {
    return { ok: false, error: 'No calendar events found in this .ics file.' };
  }

  const events: CalendarEvent[] = [];

  for (const block of blocks) {
    const body = block.split('END:VEVENT')[0] ?? '';
    const lines = body.split(/\r?\n/);

    let uid = '';
    let summary = '';
    let description = '';
    let category = 'focus';
    let startRaw = '';
    let endRaw = '';

    for (const line of lines) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const key = line.slice(0, colon).toUpperCase();
      const val = line.slice(colon + 1);
      if (key.startsWith('UID')) uid = val.trim();
      else if (key.startsWith('SUMMARY')) summary = unescapeIcsText(val.trim());
      else if (key.startsWith('DESCRIPTION')) description = unescapeIcsText(val.trim());
      else if (key.startsWith('CATEGORIES')) category = val.trim().toLowerCase();
      else if (key.startsWith('DTSTART')) startRaw = val.trim();
      else if (key.startsWith('DTEND')) endRaw = val.trim();
    }

    const startParsed = parseIcsDateTime(startRaw);
    if (!startParsed || !summary) continue;
    const endParsed = endRaw ? parseIcsDateTime(endRaw) : null;

    events.push({
      id: uid ? `ics-${uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)}` : `evt-${crypto.randomUUID().slice(0, 8)}`,
      title: summary,
      date: startParsed.date,
      startTime: startParsed.time,
      endTime: startParsed.time ? (endParsed?.time ?? null) : null,
      category: isEventCategory(category) ? category : 'focus',
      notes: description,
    });
  }

  if (events.length === 0) {
    return { ok: false, error: 'Could not parse any valid events from the .ics file.' };
  }

  return { ok: true, data: events };
}
