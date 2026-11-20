import type { KanbanColumnConfig, KanbanTemplate } from './types';

export const COLUMN_ACCENT_PALETTE: readonly string[] = [
  '#818cf8', // indigo
  '#38bdf8', // sky
  '#fbbf24', // amber
  '#c084fc', // violet
  '#34d399', // emerald
  '#fb7185', // rose
  '#2dd4bf', // teal
  '#f97316', // orange
];

/** Default 6-stage Sales / Leads pipeline — preserved by default for all existing boards. */
export const DEFAULT_KANBAN_COLUMNS: readonly KanbanColumnConfig[] = [
  { id: 'leads', title: 'Leads', shortLabel: 'Leads', accent: '#818cf8' },
  { id: 'contacted', title: 'Contacted', shortLabel: 'Contacted', accent: '#38bdf8' },
  { id: 'in_process', title: 'In Process', shortLabel: 'In Process', accent: '#fbbf24' },
  { id: 'waiting_approval', title: 'Waiting Approval', shortLabel: 'Approval', accent: '#c084fc' },
  { id: 'done', title: 'Done', shortLabel: 'Done', accent: '#34d399', isDone: true },
  { id: 'lost', title: 'Lost', shortLabel: 'Lost', accent: '#fb7185' },
];

export const KANBAN_TEMPLATES: readonly KanbanTemplate[] = [
  {
    id: 'sales-pipeline',
    name: 'Sales & Leads Pipeline (Default)',
    description: 'Your default 6-stage CRM board for tracking outreach, proposals, and closed deals.',
    columns: DEFAULT_KANBAN_COLUMNS,
  },
  {
    id: 'product-sprint',
    name: 'Product & Engineering Sprint',
    description: 'Software delivery flow from backlog and spec through review, QA, and release.',
    columns: [
      { id: 'backlog', title: 'Backlog', shortLabel: 'Backlog', accent: '#818cf8' },
      { id: 'todo', title: 'To Do', shortLabel: 'To Do', accent: '#38bdf8' },
      { id: 'in_progress', title: 'In Progress', shortLabel: 'In Progress', accent: '#fbbf24' },
      { id: 'review', title: 'Code Review', shortLabel: 'Review', accent: '#c084fc' },
      { id: 'qa', title: 'QA / Staging', shortLabel: 'QA', accent: '#2dd4bf' },
      { id: 'shipped', title: 'Shipped', shortLabel: 'Shipped', accent: '#34d399', isDone: true },
    ],
  },
  {
    id: 'creator-studio',
    name: 'Content & Creator Studio',
    description: 'Plan ideas, write scripts, film or design, edit, schedule, and publish.',
    columns: [
      { id: 'ideas', title: 'Ideas', shortLabel: 'Ideas', accent: '#818cf8' },
      { id: 'scripting', title: 'Scripting', shortLabel: 'Scripting', accent: '#38bdf8' },
      { id: 'production', title: 'Filming / Design', shortLabel: 'Production', accent: '#fbbf24' },
      { id: 'editing', title: 'Editing', shortLabel: 'Editing', accent: '#c084fc' },
      { id: 'scheduled', title: 'Scheduled', shortLabel: 'Scheduled', accent: '#2dd4bf' },
      { id: 'published', title: 'Published', shortLabel: 'Published', accent: '#34d399', isDone: true },
    ],
  },
  {
    id: 'personal-notion',
    name: 'Personal & Notion Flow',
    description: 'Minimal 5-column personal execution system for focus, delegation, and completion.',
    columns: [
      { id: 'inbox', title: 'Inbox', shortLabel: 'Inbox', accent: '#818cf8' },
      { id: 'next_up', title: 'Next Up', shortLabel: 'Next Up', accent: '#38bdf8' },
      { id: 'focus_today', title: 'Focus Today', shortLabel: 'Today', accent: '#fbbf24' },
      { id: 'waiting', title: 'Waiting On', shortLabel: 'Waiting', accent: '#c084fc' },
      { id: 'done', title: 'Done', shortLabel: 'Done', accent: '#34d399', isDone: true },
    ],
  },
];

export function slugifyColumnId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || `col_${crypto.randomUUID().slice(0, 6)}`;
}

export function makeShortLabel(title: string): string {
  const clean = title.trim();
  if (clean.length <= 12) return clean;
  const words = clean.split(/\s+/);
  return words[words.length - 1]?.slice(0, 12) || clean.slice(0, 12);
}

export function pickColumnAccent(index: number): string {
  return COLUMN_ACCENT_PALETTE[index % COLUMN_ACCENT_PALETTE.length] ?? '#818cf8';
}

export function getColumnTitle(columns: readonly KanbanColumnConfig[], statusId: string): string {
  const found = columns.find((col) => col.id === statusId);
  return found ? found.title : statusId;
}

export function isDoneColumn(columns: readonly KanbanColumnConfig[], statusId: string): boolean {
  const col = columns.find((c) => c.id === statusId);
  if (!col) return statusId === 'done';
  return Boolean(col.isDone) || /^(done|won|shipped|published|completed)$/i.test(col.id);
}

export function isLostColumn(columns: readonly KanbanColumnConfig[], statusId: string): boolean {
  const col = columns.find((c) => c.id === statusId);
  if (!col) return statusId === 'lost';
  return /^(lost|archived|cancelled|declined)$/i.test(col.id);
}

/** Match a raw spreadsheet status string against existing columns (exact id/title or fuzzy alias). */
export function matchColumnForLabel(
  raw: string,
  columns: readonly KanbanColumnConfig[],
): KanbanColumnConfig | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const slug = slugifyColumnId(trimmed);
  const lower = trimmed.toLowerCase();

  const exact = columns.find(
    (col) => col.id.toLowerCase() === slug || col.title.toLowerCase() === lower,
  );
  if (exact) return exact;

  // Preserve friendly fuzzy matching for default Sales Pipeline terms
  if (slug.includes('contact')) return columns.find((c) => c.id === 'contacted') ?? null;
  if (slug.includes('process') || slug.includes('progress')) {
    return columns.find((c) => c.id === 'in_process' || c.id === 'in_progress') ?? null;
  }
  if (slug.includes('wait') || slug.includes('approv')) {
    return columns.find((c) => c.id === 'waiting_approval' || c.id === 'waiting') ?? null;
  }
  if (slug.includes('done') || slug.includes('won') || slug.includes('closed')) {
    return columns.find((c) => c.isDone || c.id === 'done') ?? null;
  }
  if (slug.includes('lost') || slug.includes('declin')) {
    return columns.find((c) => c.id === 'lost') ?? null;
  }
  return null;
}
