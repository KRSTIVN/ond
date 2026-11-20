import { useMemo } from 'react';
import {
  ArrowRight,
  Calculator,
  Calendar,
  Clock,
  Columns3,
  FileText,
  LayoutTemplate,
  MapPin,
  Pin,
  Play,
  Plus,
  Sheet,
  Sparkles,
} from 'lucide-react';
import { compareCalendarEvents, formatDayHeading, getTodayIsoDate } from '../../domain/calendar/temporal';
import { getColumnTitle, isDoneColumn, isLostColumn } from '../../domain/columns';
import {
  extractCity,
  formatShortCategory,
  type CalcHistoryEntry,
  type CalendarEvent,
  type KanbanColumnConfig,
  type LeadCard,
  type NoteItem,
  type WorkspaceTab,
} from '../../domain/types';

interface DashboardViewProps {
  readonly boardTitle: string;
  readonly leads: readonly LeadCard[];
  readonly columns: readonly KanbanColumnConfig[];
  readonly calendarEvents: readonly CalendarEvent[];
  readonly notes: readonly NoteItem[];
  readonly calcHistory: readonly CalcHistoryEntry[];
  readonly onNavigateTab: (tab: WorkspaceTab) => void;
  readonly onSelectLead: (lead: LeadCard) => void;
  readonly onOpenNewLead: () => void;
  readonly onOpenSync: () => void;
  readonly onOpenTemplates: () => void;
  readonly onSelectNote: (noteId: string) => void;
  readonly onCreateNote: () => void;
  readonly onLoadSampleData: () => void;
}

export function DashboardView({
  boardTitle,
  leads,
  columns,
  calendarEvents,
  notes,
  calcHistory,
  onNavigateTab,
  onSelectLead,
  onOpenNewLead,
  onOpenSync,
  onOpenTemplates,
  onSelectNote,
  onCreateNote,
  onLoadSampleData,
}: DashboardViewProps) {
  const todayIso = getTodayIsoDate();

  const stats = useMemo(() => {
    const done = leads.filter((l) => isDoneColumn(columns, l.status)).length;
    const pipeline = leads
      .filter((l) => !isLostColumn(columns, l.status))
      .reduce((sum, l) => sum + (l.dealValue ?? 0), 0);
    const active = leads.filter(
      (l) => !isDoneColumn(columns, l.status) && !isLostColumn(columns, l.status),
    ).length;
    return { total: leads.length, active, done, pipeline };
  }, [leads, columns]);

  const columnCounts = useMemo(
    () =>
      columns.map((col) => ({
        column: col,
        count: leads.filter((l) => l.status === col.id).length,
      })),
    [columns, leads],
  );

  const upcomingEvents = useMemo(
    () =>
      calendarEvents
        .filter((e) => e.date >= todayIso)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date) || compareCalendarEvents(a, b))
        .slice(0, 4),
    [calendarEvents, todayIso],
  );

  const recentNotes = useMemo(
    () =>
      notes
        .slice()
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt.localeCompare(a.updatedAt);
        })
        .slice(0, 4),
    [notes],
  );

  const featuredLeads = useMemo(
    () =>
      leads
        .filter((l) => !isLostColumn(columns, l.status))
        .slice()
        .sort((a, b) => (b.dealValue ?? 0) - (a.dealValue ?? 0))
        .slice(0, 3),
    [leads, columns],
  );

  return (
    <section className="workspace-panel-stage dashboard-shell" aria-label="Spatial Dashboard">
      <aside className="dashboard-left-rail">
        <div className="glass-surface dash-rail-card">
          <div className="dash-card-head">
            <div className="dash-card-title-row">
              <Calendar size={15} className="text-indigo" />
              <h3>Upcoming Schedule</h3>
            </div>
            <button
              type="button"
              className="dash-link-pill"
              onClick={() => onNavigateTab('calendar')}
            >
              <span>Open</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="dash-rail-list scroller">
            {upcomingEvents.length === 0 ? (
              <p className="dash-empty-text">
                No upcoming events yet. Open Calendar to schedule focus blocks or sync Google Calendar.
              </p>
            ) : (
              upcomingEvents.map((evt) => (
                <button
                  key={evt.id}
                  type="button"
                  className="dash-mini-tile"
                  onClick={() => onNavigateTab('calendar')}
                >
                  <div className="dash-mini-tile-copy">
                    <strong>{evt.title}</strong>
                    <span className="mono-num">
                      <Clock size={11} /> {formatDayHeading(evt.date)}
                      {evt.startTime ? ` · ${evt.startTime}` : ' · All day'}
                    </span>
                  </div>
                  <span className="dash-circle-go" aria-hidden="true">
                    <Play size={11} />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="glass-surface dash-rail-card">
          <div className="dash-card-head">
            <div className="dash-card-title-row">
              <FileText size={15} className="text-emerald" />
              <h3>Pinned &amp; Recent Notes</h3>
            </div>
            <button type="button" className="dash-link-pill" onClick={onCreateNote}>
              <Plus size={12} />
              <span>New</span>
            </button>
          </div>

          <div className="dash-rail-list scroller">
            {recentNotes.length === 0 ? (
              <p className="dash-empty-text">
                Start a Markdown note with live checklists or import `.md` files.
              </p>
            ) : (
              recentNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className="dash-mini-tile"
                  onClick={() => {
                    onSelectNote(note.id);
                    onNavigateTab('notes');
                  }}
                >
                  <div className="dash-mini-tile-copy">
                    <strong>
                      {note.pinned && <Pin size={11} className="text-indigo" />}{' '}
                      {note.title || 'Untitled Note'}
                    </strong>
                    <span>{note.content.replace(/[#*`>-]/g, '').trim() || 'Empty note'}</span>
                  </div>
                  <span className="dash-circle-go" aria-hidden="true">
                    <ArrowRight size={11} />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <div className="dashboard-main-column">
        <div className="glass-surface dash-hero-card">
          <div className="dash-hero-glow" aria-hidden="true" />
          <div className="dash-hero-top">
            <span className="dash-hero-badge">
              <Sparkles size={12} />
              <span>Workspace Command</span>
            </span>
            <div className="dash-hero-kpis">
              <div className="dash-kpi-pill">
                <strong className="mono-num">{stats.total}</strong>
                <span>Cards</span>
              </div>
              <div className="dash-kpi-pill">
                <strong className="mono-num">{stats.active}</strong>
                <span>Active</span>
              </div>
              <div className="dash-kpi-pill is-money">
                <strong className="mono-num">${stats.pipeline.toLocaleString()}</strong>
                <span>Pipeline</span>
              </div>
            </div>
          </div>

          <div className="dash-hero-body">
            <h2 className="dash-hero-title">{boardTitle}</h2>
            <p className="dash-hero-subtitle">
              Your local-first spatial command center — drag leads across customizable stages, sync live with Google Sheets &amp; Excel, schedule in Temporal Calendar, and write in Markdown.
            </p>

            <div className="dash-stage-strip" aria-label="Pipeline stage distribution">
              {columnCounts.map(({ column, count }) => (
                <button
                  key={column.id}
                  type="button"
                  className="dash-stage-pill"
                  style={{ '--stage-accent': column.accent } as React.CSSProperties}
                  onClick={() => onNavigateTab('kanban')}
                >
                  <span className="stage-chip-dot" style={{ background: column.accent }} />
                  <span>{column.shortLabel}</span>
                  <strong className="mono-num">{count}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="dash-hero-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigateTab('kanban')}
            >
              <Columns3 size={15} />
              <span>Open Kanban Board</span>
            </button>
            <button type="button" className="btn-glass" onClick={onOpenSync}>
              <Sheet size={15} />
              <span>Sync Sheets / Google</span>
            </button>
            <button type="button" className="btn-glass" onClick={onOpenNewLead}>
              <Plus size={15} />
              <span>Add Card</span>
            </button>
            <button
              type="button"
              className="btn-glass is-icon-only"
              title="Board Templates & Columns"
              aria-label="Board Templates & Columns"
              onClick={onOpenTemplates}
            >
              <LayoutTemplate size={15} />
            </button>
          </div>
        </div>

        <div className="dash-bottom-section">
          <div className="dash-bottom-head">
            <h3>Active Highlights &amp; Quick Instruments</h3>
            <button
              type="button"
              className="dash-link-pill"
              onClick={() => onNavigateTab('kanban')}
            >
              <span>See all cards</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="dash-bento-grid">
            {featuredLeads.length === 0 ? (
              <div className="glass-surface dash-bento-card is-span-3">
                <span className="dash-bento-tag">Ready to Connect</span>
                <h4>Connect Google Sheets, Excel, or preview sample cards</h4>
                <p>
                  Your workspace starts clean and private. Import an `.xlsx` / `.csv` workbook or load 4 fictional sample cards to test the dashboard.
                </p>
                <div className="dash-bento-actions">
                  <button type="button" className="btn-primary is-compact" onClick={onOpenSync}>
                    Connect Spreadsheet
                  </button>
                  <button type="button" className="btn-glass is-compact" onClick={onLoadSampleData}>
                    Load Sample Cards
                  </button>
                </div>
              </div>
            ) : (
              featuredLeads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className="glass-surface dash-bento-card"
                  onClick={() => onSelectLead(lead)}
                >
                  <div className="dash-bento-top">
                    <span className="dash-bento-tag">{getColumnTitle(columns, lead.status)}</span>
                    {lead.dealValue !== null && (
                      <span className="meta-chip is-money mono-num">
                        ${lead.dealValue.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <h4>{lead.businessName}</h4>
                  <p>{formatShortCategory(lead.category)}</p>
                  <div className="dash-bento-footer">
                    <span className="dash-bento-loc">
                      <MapPin size={11} /> {extractCity(lead.address)}
                    </span>
                    <span className="dash-bento-circle-btn" aria-hidden="true">
                      <Play size={12} />
                    </span>
                  </div>
                </button>
              ))
            )}

            <button
              type="button"
              className="glass-surface dash-bento-card is-calc-card"
              onClick={() => onNavigateTab('calculator')}
            >
              <div className="dash-bento-top">
                <span className="dash-bento-tag">Calculator &amp; Formulas</span>
                <Calculator size={15} className="text-indigo" />
              </div>
              <h4>
                {calcHistory[0] ? `= ${calcHistory[0].result}` : '24 Pro Formulas'}
              </h4>
              <p>
                {calcHistory[0]
                  ? `Last: ${calcHistory[0].expression}`
                  : 'Finance, Architecture, Engineering, Healthcare, Data & Cloud.'}
              </p>
              <div className="dash-bento-footer">
                <span className="dash-bento-loc">Open Formula Box</span>
                <span className="dash-bento-circle-btn" aria-hidden="true">
                  <ArrowRight size={12} />
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
