import { parseLeadsFromText, serializeLeadsToCsv } from '../domain/csvSync';
import { buildExcelBlob, parseExcelFile } from '../domain/excelSync';
import type { LeadCard, Result } from '../domain/types';

export type ConnectedFileFormat = 'xlsx' | 'csv';

export interface ConnectedSpreadsheetFile {
  readonly name: string;
  readonly format: ConnectedFileFormat;
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
): Promise<Result<LeadCard[]>> {
  const format = detectSpreadsheetFormat(file.name);
  if (format === 'xlsx') {
    return parseExcelFile(file, existingLeads);
  }
  const text = await file.text();
  return parseLeadsFromText(text, existingLeads);
}

export async function connectLocalSpreadsheet(
  existingLeads: readonly LeadCard[],
): Promise<Result<{ file: ConnectedSpreadsheetFile; leads: LeadCard[] }>> {
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
    const parsed = await importSpreadsheetFile(file, existingLeads);
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
        leads: parsed.data,
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
): Promise<Result<number>> {
  try {
    const writable = await connected.handle.createWritable();
    if (connected.format === 'xlsx') {
      const blob = await buildExcelBlob(leads);
      await writable.write(blob);
    } else {
      const csv = serializeLeadsToCsv(leads);
      await writable.write(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    }
    await writable.close();
    return { ok: true, data: leads.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Write failed.';
    return { ok: false, error: `Could not write to ${connected.name} (${msg}).` };
  }
}
