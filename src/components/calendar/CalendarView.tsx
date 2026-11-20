import { useMemo, useState } from 'react';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Square,
} from 'lucide-react';
import { getColumnTitle, isDoneColumn } from '../../domain/columns';
import {
  buildMonthGrid,
  compareCalendarEvents,
  formatDayHeading,
  formatMonthHeading,
  getTodayIsoDate,
  getWeekdayLabels,
  isValidPlainDate,
} from '../../domain/calendar/temporal';
import type { CalendarEvent, KanbanColumnConfig, LeadCard } from '../../domain/types';
import { EventDialog } from './EventDialog';

interface CalendarViewProps {
  readonly events: readonly CalendarEvent[];
  readonly leads: readonly LeadCard[];
  readonly columns: readonly KanbanColumnConfig[];
  readonly weekStartsOn: 1 | 7;
  readonly onChangeWeekStartsOn: (start: 1 | 7) => void;
  readonly onSaveEvent: (event: CalendarEvent) => void;
  readonly onDeleteEvent: (id: string) => void;
  readonly onOpenLeadCard: (lead: LeadCard) => void;
}

export function CalendarView({
  events,
  leads,
  columns,
  weekStartsOn,
  onChangeWeekStartsOn,
  onSaveEvent,
  onDeleteEvent,
  onOpenLeadCard,
}: CalendarViewProps) {
  const todayIso = getTodayIsoDate();
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [monthYm, setMonthYm] = useState(() =>
    Temporal.PlainDate.from(todayIso).toPlainYearMonth(),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const cells = useMemo(
    () => buildMonthGrid(monthYm, weekStartsOn, todayIso),
    [monthYm, weekStartsOn, todayIso],
  );
  const weekdayLabels = useMemo(() => getWeekdayLabels(weekStartsOn), [weekStartsOn]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const evt of events) {
      const list = map.get(evt.date) ?? [];
      list.push(evt);
      map.set(evt.date, list);
    }
    for (const list of map.values()) {
      list.sort(compareCalendarEvents);
    }
    return map;
  }, [events]);

  const followUpsByDate = useMemo(() => {
    const map = new Map<string, LeadCard[]>();
    for (const lead of leads) {
      if (!lead.followUpDate || !isValidPlainDate(lead.followUpDate)) continue;
      const list = map.get(lead.followUpDate) ?? [];
      list.push(lead);
      map.set(lead.followUpDate, list);
    }
    return map;
  }, [leads]);

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const selectedFollowUps = followUpsByDate.get(selectedDate) ?? [];

  const jumpToToday = () => {
    const current = getTodayIsoDate();
    setSelectedDate(current);
    setMonthYm(Temporal.PlainDate.from(current).toPlainYearMonth());
  };

  return (
    <section className="workspace-panel-stage calendar-shell" aria-label="Calendar Workspace">
      <div className="glass-surface calendar-grid-panel">
        <div className="calendar-header">
          <h2 className="calendar-title">{formatMonthHeading(monthYm)}</h2>

          <div className="calendar-nav-group">
            <button
              type="button"
              className="btn-glass is-icon-only"
              aria-label="Previous month"
              onClick={() => setMonthYm((prev) => prev.subtract({ months: 1 }))}
            >
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="btn-glass is-compact" onClick={jumpToToday}>
              Today
            </button>
            <button
              type="button"
              className="btn-glass is-icon-only"
              aria-label="Next month"
              onClick={() => setMonthYm((prev) => prev.add({ months: 1 }))}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="btn-glass is-compact"
              onClick={() => onChangeWeekStartsOn(weekStartsOn === 1 ? 7 : 1)}
              title="Toggle first day of week"
            >
              {weekStartsOn === 1 ? 'Start: Mon' : 'Start: Sun'}
            </button>
          </div>
        </div>

        <div className="calendar-weekdays" role="row">
          {weekdayLabels.map((label) => (
            <div key={label} role="columnheader">
              {label}
            </div>
          ))}
        </div>

        <div className="calendar-cells" role="grid" aria-label={formatMonthHeading(monthYm)}>
          {cells.map((cell) => {
            const dayEvents = eventsByDate.get(cell.isoDate) ?? [];
            const dayFollowUps = followUpsByDate.get(cell.isoDate) ?? [];
            const totalItems = dayEvents.length + dayFollowUps.length;

            return (
              <button
                key={cell.isoDate}
                type="button"
                className="calendar-cell"
                data-outside={!cell.inCurrentMonth}
                data-today={cell.isToday}
                data-selected={cell.isoDate === selectedDate}
                aria-label={`${formatDayHeading(cell.isoDate)}, ${totalItems} items`}
                aria-pressed={cell.isoDate === selectedDate}
                onClick={() => setSelectedDate(cell.isoDate)}
              >
                <div className="cell-day-row">
                  <span className="cell-day-num mono-num">{cell.day}</span>
                  {totalItems > 0 && <span className="cell-count mono-num">{totalItems}</span>}
                </div>

                <div className="cell-items">
                  {dayEvents.slice(0, 2).map((evt) => (
                    <div key={evt.id} className={`cell-chip is-cat-${evt.category}`}>
                      {evt.startTime && <span className="mono-num">{evt.startTime}</span>}
                      <span className="cell-chip-label">{evt.title}</span>
                    </div>
                  ))}
                  {dayFollowUps
                    .slice(0, Math.max(0, 3 - Math.min(2, dayEvents.length)))
                    .map((lead) => (
                      <div key={lead.id} className="cell-chip is-followup">
                        {isDoneColumn(columns, lead.status) ? (
                          <CheckSquare size={10} />
                        ) : (
                          <Square size={10} />
                        )}
                        <span className="cell-chip-label">{lead.businessName}</span>
                      </div>
                    ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="glass-surface calendar-agenda-panel" aria-label="Selected day agenda">
        <div className="agenda-header">
          <div>
            <h3 className="agenda-title">{formatDayHeading(selectedDate)}</h3>
            <span className="agenda-iso mono-num">{selectedDate}</span>
          </div>
          <button
            type="button"
            className="btn-primary is-compact"
            onClick={() => {
              setEditingEvent(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={14} />
            <span>New Event</span>
          </button>
        </div>

        <div className="agenda-list scroller">
          {selectedEvents.length === 0 && selectedFollowUps.length === 0 && (
            <div className="agenda-empty">
              No events or Kanban follow-ups scheduled for this day.
            </div>
          )}

          {selectedEvents.map((evt) => (
            <div key={evt.id} className="agenda-item">
              <div className="agenda-item-top">
                <div>
                  <strong className="agenda-item-title">{evt.title}</strong>
                  <div className="agenda-item-meta">
                    <Clock size={12} />
                    <span className="mono-num">
                      {evt.startTime
                        ? `${evt.startTime}${evt.endTime ? ` – ${evt.endTime}` : ''}`
                        : 'All day'}
                    </span>
                    <span className={`event-cat-pill is-cat-${evt.category}`}>{evt.category}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-glass is-compact"
                  aria-label={`Edit ${evt.title}`}
                  onClick={() => {
                    setEditingEvent(evt);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil size={12} />
                </button>
              </div>
              {evt.notes && <p className="agenda-item-notes">{evt.notes}</p>}
            </div>
          ))}

          {selectedFollowUps.length > 0 && (
            <div className="agenda-followup-group">
              <span className="drawer-section-title">Kanban Follow-ups</span>
              {selectedFollowUps.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className="agenda-item is-clickable"
                  onClick={() => onOpenLeadCard(lead)}
                >
                  <div className="agenda-followup-row">
                    {isDoneColumn(columns, lead.status) ? (
                      <CheckSquare size={14} className="text-emerald" />
                    ) : (
                      <Square size={14} className="text-indigo" />
                    )}
                    <strong className="agenda-item-title">{lead.businessName}</strong>
                  </div>
                  <span className="agenda-followup-sub">
                    Stage: {getColumnTitle(columns, lead.status)} · Click to edit card
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <EventDialog
        open={dialogOpen}
        initialEvent={editingEvent}
        defaultDate={selectedDate}
        onClose={() => setDialogOpen(false)}
        onSave={onSaveEvent}
        onDelete={onDeleteEvent}
      />
    </section>
  );
}
