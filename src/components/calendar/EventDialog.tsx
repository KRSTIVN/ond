import { useEffect, useId, useState, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import { isValidPlainDate, isValidTimeRange } from '../../domain/calendar/temporal';
import type { CalendarEvent, EventCategory } from '../../domain/types';
import { useDialogModal } from '../../hooks/useDialogModal';

interface EventDialogProps {
  readonly open: boolean;
  readonly initialEvent: CalendarEvent | null;
  readonly defaultDate: string;
  readonly onClose: () => void;
  readonly onSave: (event: CalendarEvent) => void;
  readonly onDelete: (id: string) => void;
}

const CATEGORIES: readonly { readonly id: EventCategory; readonly label: string }[] = [
  { id: 'focus', label: 'Focus' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'personal', label: 'Personal' },
  { id: 'deadline', label: 'Deadline' },
];

export function EventDialog({
  open,
  initialEvent,
  defaultDate,
  onClose,
  onSave,
  onDelete,
}: EventDialogProps) {
  const titleId = useId();
  const dialogRef = useDialogModal({ open, onClose });

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<EventCategory>('focus');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmingDelete(false);
    if (initialEvent) {
      setTitle(initialEvent.title);
      setDate(initialEvent.date);
      setAllDay(initialEvent.startTime === null);
      setStartTime(initialEvent.startTime ?? '09:00');
      setEndTime(initialEvent.endTime ?? '10:00');
      setCategory(initialEvent.category);
      setNotes(initialEvent.notes);
      return;
    }
    setTitle('');
    setDate(defaultDate);
    setAllDay(false);
    setStartTime('09:00');
    setEndTime('10:00');
    setCategory('focus');
    setNotes('');
  }, [open, initialEvent, defaultDate]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Enter an event title.');
      return;
    }
    if (!isValidPlainDate(date)) {
      setError('Choose a valid calendar date.');
      return;
    }
    if (!allDay && !isValidTimeRange(startTime, endTime)) {
      setError('End time must be after start time.');
      return;
    }

    onSave({
      id: initialEvent?.id ?? `evt-${crypto.randomUUID().slice(0, 8)}`,
      title: cleanTitle,
      date,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      category,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog event-modal"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="modal-header">
        <div>
          <h2 id={titleId} className="modal-title">
            {initialEvent ? 'Edit Event' : 'New Calendar Event'}
          </h2>
          <p className="modal-subtitle">
            Schedule focus blocks, client calls, and deadlines locally.
          </p>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close event dialog"
        >
          <X size={18} />
        </button>
      </div>

      <form className="modal-body scroller" onSubmit={handleSubmit}>
        {error && <div className="banner-error">{error}</div>}

        <div className="form-grid">
          <label className="form-field is-full">
            <span>Title *</span>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Client call, proposal review, deep work..."
            />
          </label>

          <label className="form-field">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <label className="form-field">
            <span>Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as EventCategory)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-row is-full">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            <span>All-day event</span>
          </label>

          {!allDay && (
            <>
              <label className="form-field">
                <span>Start Time</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>

              <label className="form-field">
                <span>End Time</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </label>
            </>
          )}

          <label className="form-field is-full">
            <span>Notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agenda, links, or preparation notes..."
            />
          </label>
        </div>

        <div className="modal-footer">
          <div className="modal-footer-left">
            {initialEvent && !confirmingDelete && (
              <button
                type="button"
                className="btn-danger-ghost"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}
            {initialEvent && confirmingDelete && (
              <div className="inline-confirm">
                <button
                  type="button"
                  className="btn-danger-solid"
                  onClick={() => {
                    onDelete(initialEvent.id);
                    onClose();
                  }}
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep
                </button>
              </div>
            )}
          </div>

          <div className="modal-footer-right">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {initialEvent ? 'Save Event' : 'Create Event'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
