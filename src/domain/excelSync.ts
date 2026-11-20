import { readSheet } from 'read-excel-file/browser';
import writeXlsxFile, { type Row, type SheetData } from 'write-excel-file/browser';
import { STATUS_TITLES } from './columns';
import { parseLeadsFromMatrix, SHEET_HEADERS } from './csvSync';
import type { LeadCard, Result } from './types';

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }
  return String(cell).trim();
}

export async function parseExcelFile(
  file: File,
  existingLeads: readonly LeadCard[],
): Promise<Result<LeadCard[]>> {
  try {
    const rawRows = await readSheet(file);
    const matrix: string[][] = rawRows
      .map((row) => row.map((cell) => cellToString(cell)))
      .filter((row) => row.some((value) => value.length > 0));

    return parseLeadsFromMatrix(matrix, existingLeads);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to parse Excel workbook.';
    return {
      ok: false,
      error: `Excel read failed (${message}). Ensure the file is a valid .xlsx workbook.`,
    };
  }
}

function buildSheetData(leads: readonly LeadCard[]): SheetData {
  const headerRow: Row = SHEET_HEADERS.map((title) => ({
    value: title,
    fontWeight: 'bold' as const,
  }));

  const bodyRows: Row[] = leads.map((lead) => [
    { value: lead.businessName, type: String },
    { value: lead.category, type: String },
    { value: lead.address, type: String },
    { value: lead.phone, type: String },
    { value: lead.email || 'Not available', type: String },
    { value: lead.websiteUrl || 'None', type: String },
    { value: lead.leadType, type: String },
    { value: lead.notes, type: String },
    { value: STATUS_TITLES[lead.status], type: String },
    lead.dealValue !== null
      ? { value: lead.dealValue, type: Number }
      : { value: '', type: String },
    { value: lead.followUpDate, type: String },
  ]);

  return [headerRow, ...bodyRows];
}

const EXCEL_COLUMNS = [
  { width: 28 },
  { width: 24 },
  { width: 32 },
  { width: 16 },
  { width: 22 },
  { width: 28 },
  { width: 18 },
  { width: 36 },
  { width: 18 },
  { width: 14 },
  { width: 16 },
];

export async function buildExcelBlob(leads: readonly LeadCard[]): Promise<Blob> {
  const sheetData = buildSheetData(leads);
  return writeXlsxFile(sheetData, {
    columns: EXCEL_COLUMNS,
    sheet: 'Kanban Leads',
  }).toBlob();
}

export async function downloadExcelFile(
  leads: readonly LeadCard[],
  fileName = 'ond-leads.xlsx',
): Promise<void> {
  const sheetData = buildSheetData(leads);
  await writeXlsxFile(sheetData, {
    columns: EXCEL_COLUMNS,
    sheet: 'Kanban Leads',
  }).toFile(fileName);
}
