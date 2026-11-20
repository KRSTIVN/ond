import { STATUS_TITLES } from './columns';
import {
  normalizeLeadType,
  normalizeStatusLabel,
  type LeadCard,
  type LeadStatus,
  type Result,
} from './types';

export const SHEET_HEADERS = [
  'Business Name',
  'Category',
  'Address',
  'Phone Number',
  'Email',
  'Website URL',
  'Lead Type',
  'Notes',
  'Status',
  'Deal Value',
  'Follow-up Date',
] as const;

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeTsvCell(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

export function leadToRowValues(lead: LeadCard): readonly string[] {
  return [
    lead.businessName,
    lead.category,
    lead.address,
    lead.phone,
    lead.email || 'Not available',
    lead.websiteUrl || 'None',
    lead.leadType,
    lead.notes,
    STATUS_TITLES[lead.status],
    lead.dealValue !== null ? String(lead.dealValue) : '',
    lead.followUpDate,
  ];
}

export function serializeLeadsToCsv(leads: readonly LeadCard[]): string {
  const headerLine = SHEET_HEADERS.map(escapeCsvCell).join(',');
  const dataLines = leads.map((lead) => leadToRowValues(lead).map(escapeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

export function serializeLeadsToTsv(leads: readonly LeadCard[]): string {
  const headerLine = SHEET_HEADERS.join('\t');
  const dataLines = leads.map((lead) => leadToRowValues(lead).map(escapeTsvCell).join('\t'));
  return [headerLine, ...dataLines].join('\n');
}

function parseDelimitedText(input: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      cell += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }

    if (ch === '\r' && next === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }

    if (ch === '\n' || ch === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((value) => value.trim().length > 0));
}

function findColumnIndex(headers: readonly string[], candidates: readonly string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = normalized.findIndex((header) => header === candidate || header.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

function cleanPlaceholder(value: string): string {
  const trimmed = value.trim();
  if (/^(not available|none|n\/a|-)$/i.test(trimmed)) return '';
  return trimmed;
}

function parseNumberOrNull(raw: string): number | null {
  const numeric = raw.replace(/[^0-9.-]/g, '');
  if (!numeric) return null;
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseLeadsFromMatrix(
  matrix: readonly (readonly string[])[],
  existingLeads: readonly LeadCard[],
): Result<LeadCard[]> {
  if (matrix.length < 2) {
    return { ok: false, error: 'Expected a header row plus at least one data row.' };
  }

  const [headers, ...bodyRows] = matrix;
  const idxName = findColumnIndex(headers, [
    'business name',
    'business',
    'company',
    'client',
    'title',
    'name',
  ]);
  if (idxName === -1) {
    return {
      ok: false,
      error: 'Missing a recognizable title column (e.g. "Business Name", "Name", or "Company").',
    };
  }

  const idxCategory = findColumnIndex(headers, ['category', 'industry', 'niche', 'service']);
  const idxAddress = findColumnIndex(headers, ['address', 'location', 'city']);
  const idxPhone = findColumnIndex(headers, ['phone number', 'phone', 'tel', 'mobile']);
  const idxEmail = findColumnIndex(headers, ['email', 'mail']);
  const idxWebsite = findColumnIndex(headers, ['website url', 'website', 'url', 'site']);
  const idxLeadType = findColumnIndex(headers, ['lead type', 'type', 'tag', 'priority']);
  const idxNotes = findColumnIndex(headers, ['notes', 'note', 'comments', 'description']);
  const idxStatus = findColumnIndex(headers, ['status', 'stage', 'column', 'phase']);
  const idxDealValue = findColumnIndex(headers, ['deal value', 'value', 'budget', 'price', 'amount']);
  const idxFollowUp = findColumnIndex(headers, ['follow-up date', 'follow up', 'followup', 'due']);

  const existingByName = new Map<string, LeadCard>(
    existingLeads.map((lead) => [lead.businessName.trim().toLowerCase(), lead]),
  );

  const now = new Date().toISOString();
  const statusOrderCounters: Record<LeadStatus, number> = {
    leads: 0,
    contacted: 0,
    in_process: 0,
    waiting_approval: 0,
    done: 0,
    lost: 0,
  };

  const parsedLeads: LeadCard[] = [];

  for (const row of bodyRows) {
    const businessName = (row[idxName] ?? '').trim();
    if (!businessName) continue;

    const existing = existingByName.get(businessName.toLowerCase());
    const rawStatus = idxStatus !== -1 ? (row[idxStatus] ?? '') : '';
    const status: LeadStatus = rawStatus.trim()
      ? normalizeStatusLabel(rawStatus)
      : (existing?.status ?? 'leads');

    const order = statusOrderCounters[status];
    statusOrderCounters[status] += 1;

    parsedLeads.push({
      id: existing?.id ?? `lead-${crypto.randomUUID().slice(0, 8)}`,
      businessName,
      category: idxCategory !== -1 ? (row[idxCategory] ?? '').trim() : (existing?.category ?? ''),
      address: idxAddress !== -1 ? (row[idxAddress] ?? '').trim() : (existing?.address ?? ''),
      phone: idxPhone !== -1 ? (row[idxPhone] ?? '').trim() : (existing?.phone ?? ''),
      email: idxEmail !== -1 ? cleanPlaceholder(row[idxEmail] ?? '') : (existing?.email ?? ''),
      websiteUrl:
        idxWebsite !== -1 ? cleanPlaceholder(row[idxWebsite] ?? '') : (existing?.websiteUrl ?? ''),
      leadType:
        idxLeadType !== -1
          ? normalizeLeadType(row[idxLeadType] ?? '')
          : (existing?.leadType ?? 'Needs Website'),
      notes: idxNotes !== -1 ? (row[idxNotes] ?? '').trim() : (existing?.notes ?? ''),
      status,
      dealValue:
        idxDealValue !== -1
          ? parseNumberOrNull(row[idxDealValue] ?? '')
          : (existing?.dealValue ?? null),
      followUpDate:
        idxFollowUp !== -1 ? (row[idxFollowUp] ?? '').trim() : (existing?.followUpDate ?? ''),
      order,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  if (parsedLeads.length === 0) {
    return { ok: false, error: 'No valid data rows were found.' };
  }

  return { ok: true, data: parsedLeads };
}

export function parseLeadsFromText(
  text: string,
  existingLeads: readonly LeadCard[],
): Result<LeadCard[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'Input is empty. Provide CSV or TSV data from Google Sheets or Excel.' };
  }

  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? '';
  const delimiter: ',' | '\t' = firstLine.includes('\t') ? '\t' : ',';
  const matrix = parseDelimitedText(trimmed, delimiter);
  return parseLeadsFromMatrix(matrix, existingLeads);
}

export function resolveGoogleSheetCsvUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/[?&](output|format)=csv/i.test(trimmed)) return trimmed;

  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch || !idMatch[1]) return trimmed;

  const gidMatch = trimmed.match(/[?&#]gid=(\d+)/);
  const gidParam = gidMatch && gidMatch[1] ? `&gid=${gidMatch[1]}` : '';
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv${gidParam}`;
}

export function buildAppsScriptBridge(): string {
  return `// Paste into Extensions -> Apps Script in your Google Sheet
// Deploy -> New deployment -> Web app -> Execute as: Me -> Who has access: Anyone
const SHEET_NAME = 'Sheet1';
const HEADERS = [
  'Business Name', 'Category', 'Address', 'Phone Number', 'Email',
  'Website URL', 'Lead Type', 'Notes', 'Status', 'Deal Value', 'Follow-up Date'
];

function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  return ContentService
    .createTextOutput(JSON.stringify({ rows: values }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rows = [HEADERS, ...(payload.rows || [])];
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, HEADERS.length).setValues(rows);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, updated: rows.length - 1 }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
}
