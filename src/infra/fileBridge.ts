import {
  parseLeadsFromText,
  serializeLeadsToCsv,
  type ParsedSheetResult,
} from '../domain/csvSync';
import { buildExcelBlob, parseExcelFile } from '../domain/excelSync';
import {
  parseWorkspacePayload,
  serializeWorkspacePayload,
  type WorkspaceSyncPayload,
} from '../domain/workspaceSync';
import type {
  CalendarEvent,
  KanbanColumnConfig,
  LeadCard,
  NoteItem,
  Result,
} from '../domain/types';

export type ConnectedFileFormat = 'xlsx' | 'csv';

export interface ConnectedSpreadsheetFile {
  readonly name: string;
  readonly format: ConnectedFileFormat;
  readonly handle: FileSystemFileHandle;
}

export interface ConnectedBackupFile {
  readonly name: string;
  readonly handle: FileSystemFileHandle;
}

interface PickerWindow extends Window {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showOpenFilePicker === 'function';
}

export function detectSpreadsheetFormat(fileName: string): ConnectedFileFormat {
  return fileName.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv';
}

export async function importSpreadsheetFile(
  file: File,
  existingLeads: readonly LeadCard[],
  currentColumns: readonly KanbanColumnConfig[],
  autoCreateColumns = true,
): Promise<Result<ParsedSheetResult>> {
  const format = detectSpreadsheetFormat(file.name);
  if (format === 'xlsx') {
    return parseExcelFile(file, existingLeads, currentColumns, autoCreateColumns);
  }
  const text = await file.text();
  return parseLeadsFromText(text, existingLeads, currentColumns, autoCreateColumns);
}

export async function connectLocalSpreadsheet(
  existingLeads: readonly LeadCard[],
  currentColumns: readonly KanbanColumnConfig[],
  autoCreateColumns = true,
): Promise<Result<{ file: ConnectedSpreadsheetFile; parsed: ParsedSheetResult }>> {
  const pickerWindow = window as PickerWindow;
  if (!pickerWindow.showOpenFilePicker) {
    return {
      ok: false,
      error: 'Direct file write-back requires Chrome or Edge. Use Import File instead.',
    };
  }

  try {
    const handles = await pickerWindow.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'Excel or CSV Spreadsheets',
          accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'text/csv': ['.csv'],
            'text/tab-separated-values': ['.tsv'],
          },
        },
      ],
    });

    const handle = handles[0];
    if (!handle) {
      return { ok: false, error: 'No file selected.' };
    }

    const file = await handle.getFile();
    const parsed = await importSpreadsheetFile(file, existingLeads, currentColumns, autoCreateColumns);
    if (!parsed.ok || !parsed.data) {
      return { ok: false, error: parsed.error ?? 'Failed to read spreadsheet.' };
    }

    return {
      ok: true,
      data: {
        file: {
          name: file.name,
          format: detectSpreadsheetFormat(file.name),
          handle,
        },
        parsed: parsed.data,
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'CANCELLED' };
    }
    const msg = error instanceof Error ? error.message : 'Unable to open file.';
    return { ok: false, error: msg };
  }
}

export async function writeLeadsToConnectedFile(
  connected: ConnectedSpreadsheetFile,
  leads: readonly LeadCard[],
  columns: readonly KanbanColumnConfig[],
): Promise<Result<number>> {
  try {
    const writable = await connected.handle.createWritable();
    if (connected.format === 'xlsx') {
      const blob = await buildExcelBlob(leads, columns);
      await writable.write(blob);
    } else {
      const csv = serializeLeadsToCsv(leads, columns);
      await writable.write(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    }
    await writable.close();
    return { ok: true, data: leads.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Write failed.';
    return { ok: false, error: `Could not write to ${connected.name} (${msg}).` };
  }
}

export async function connectLocalBackupJson(): Promise<
  Result<{ file: ConnectedBackupFile; payload: WorkspaceSyncPayload }>
> {
  const pickerWindow = window as PickerWindow;
  if (!pickerWindow.showOpenFilePicker) {
    return { ok: false, error: 'Direct file sync requires Chrome or Edge. Use Export/Import JSON instead.' };
  }

  try {
    const handles = await pickerWindow.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'OND Workspace Backup (JSON)',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });
    const handle = handles[0];
    if (!handle) return { ok: false, error: 'No file selected.' };

    const file = await handle.getFile();
    const raw = await file.text();
    const parsed = parseWorkspacePayload(raw);
    if (!parsed.ok || !parsed.data) {
      return { ok: false, error: parsed.error ?? 'Invalid workspace JSON.' };
    }
    return {
      ok: true,
      data: {
        file: { name: file.name, handle },
        payload: parsed.data,
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'CANCELLED' };
    }
    const msg = error instanceof Error ? error.message : 'Unable to open backup file.';
    return { ok: false, error: msg };
  }
}

export async function saveWorkspaceToLocalFile(
  existingFile: ConnectedBackupFile | null,
  calendarEvents: readonly CalendarEvent[],
  notes: readonly NoteItem[],
  columns: readonly KanbanColumnConfig[],
): Promise<Result<ConnectedBackupFile>> {
  const pickerWindow = window as PickerWindow;
  try {
    let target = existingFile;
    if (!target) {
      if (!pickerWindow.showSaveFilePicker) {
        return { ok: false, error: 'Direct file save requires Chrome or Edge. Use Download JSON instead.' };
      }
      const handle = await pickerWindow.showSaveFilePicker({
        suggestedName: 'ond-calendar-notes.json',
        types: [
          {
            description: 'OND Workspace Backup (JSON)',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      target = { name: handle.name, handle };
    }

    const writable = await target.handle.createWritable();
    const json = serializeWorkspacePayload(calendarEvents, notes, columns);
    await writable.write(new Blob([json], { type: 'application/json;charset=utf-8' }));
    await writable.close();
    return { ok: true, data: target };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'CANCELLED' };
    }
    const msg = error instanceof Error ? error.message : 'Failed to save backup file.';
    return { ok: false, error: msg };
  }
}
