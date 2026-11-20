import type { KanbanColumnConfig, LeadStatus } from './types';

export const KANBAN_COLUMNS: readonly KanbanColumnConfig[] = [
  {
    id: 'leads',
    title: 'Leads',
    shortLabel: 'Leads',
    accent: '#818cf8',
  },
  {
    id: 'contacted',
    title: 'Contacted',
    shortLabel: 'Contacted',
    accent: '#38bdf8',
  },
  {
    id: 'in_process',
    title: 'In Process',
    shortLabel: 'In Process',
    accent: '#fbbf24',
  },
  {
    id: 'waiting_approval',
    title: 'Waiting Approval',
    shortLabel: 'Approval',
    accent: '#c084fc',
  },
  {
    id: 'done',
    title: 'Done',
    shortLabel: 'Done',
    accent: '#34d399',
  },
  {
    id: 'lost',
    title: 'Lost',
    shortLabel: 'Lost',
    accent: '#fb7185',
  },
];

export const STATUS_TITLES: Record<LeadStatus, string> = {
  leads: 'Leads',
  contacted: 'Contacted',
  in_process: 'In Process',
  waiting_approval: 'Waiting Approval',
  done: 'Done',
  lost: 'Lost',
};
