import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LayoutTemplate,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  COLUMN_ACCENT_PALETTE,
  DEFAULT_KANBAN_COLUMNS,
  KANBAN_TEMPLATES,
  makeShortLabel,
  pickColumnAccent,
  slugifyColumnId,
} from '../domain/columns';
import type { KanbanColumnConfig, KanbanTemplate } from '../domain/types';
import { useDialogModal } from '../hooks/useDialogModal';

interface BoardTemplatesModalProps {
  readonly open: boolean;
  readonly columns: readonly KanbanColumnConfig[];
  readonly onClose: () => void;
  readonly onApplyColumns: (nextColumns: KanbanColumnConfig[], message: string) => void;
}

export function BoardTemplatesModal({
  open,
  columns,
  onClose,
  onApplyColumns,
}: BoardTemplatesModalProps) {
  const titleId = useId();
  const dialogRef = useDialogModal({ open, onClose });

  const [draftColumns, setDraftColumns] = useState<KanbanColumnConfig[]>(() => [...columns]);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColAccent, setNewColAccent] = useState<string>(COLUMN_ACCENT_PALETTE[0]!);

  useEffect(() => {
    if (!open) return;
    setDraftColumns([...columns]);
    setNewColTitle('');
    setNewColAccent(pickColumnAccent(columns.length));
  }, [open, columns]);

  const handleApplyTemplate = (template: KanbanTemplate) => {
    const next = template.columns.map((c) => ({ ...c }));
    setDraftColumns(next);
    onApplyColumns(next, `Switched board template to "${template.name}"`);
  };

  const handleAddColumn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = newColTitle.trim();
    if (!clean) return;

    let id = slugifyColumnId(clean);
    if (draftColumns.some((c) => c.id === id)) {
      id = `${id}_${crypto.randomUUID().slice(0, 4)}`;
    }

    const next: KanbanColumnConfig[] = [
      ...draftColumns,
      {
        id,
        title: clean,
        shortLabel: makeShortLabel(clean),
        accent: newColAccent,
      },
    ];
    setDraftColumns(next);
    setNewColTitle('');
    setNewColAccent(pickColumnAccent(next.length));
  };

  const handleRenameColumn = (id: string, title: string) => {
    setDraftColumns((prev) =>
      prev.map((col) =>
        col.id === id
          ? { ...col, title, shortLabel: makeShortLabel(title || col.title) }
          : col,
      ),
    );
  };

  const handleChangeAccent = (id: string, accent: string) => {
    setDraftColumns((prev) => prev.map((col) => (col.id === id ? { ...col, accent } : col)));
  };

  const handleMoveColumn = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draftColumns.length) return;
    const copy = [...draftColumns];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item!);
    setDraftColumns(copy);
  };

  const handleDeleteColumn = (id: string) => {
    if (draftColumns.length <= 1) return;
    setDraftColumns((prev) => prev.filter((col) => col.id !== id));
  };

  const handleSaveCustom = () => {
    const cleaned = draftColumns
      .map((col) => ({
        ...col,
        title: col.title.trim() || 'Stage',
        shortLabel: makeShortLabel(col.title.trim() || 'Stage'),
      }))
      .filter((col) => col.id.length > 0);
    if (cleaned.length === 0) return;
    onApplyColumns(cleaned, `Updated Kanban columns (${cleaned.length} stages)`);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog templates-modal"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="modal-header">
        <div>
          <h2 id={titleId} className="modal-title">
            Kanban Templates &amp; Custom Columns
          </h2>
          <p className="modal-subtitle">
            Switch to a preset workflow, customize columns manually, or auto-generate columns from any spreadsheet.
          </p>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close board templates"
        >
          <X size={18} />
        </button>
      </div>

      <div className="modal-body scroller">
        <section className="sync-card">
          <div className="sync-card-head">
            <div>
              <h3>Ready-to-Use Templates</h3>
              <p>Your existing cards are preserved — any stage not in the new template moves safely to the first column.</p>
            </div>
            <LayoutTemplate size={16} className="text-indigo" aria-hidden="true" />
          </div>

          <div className="template-grid">
            {KANBAN_TEMPLATES.map((template) => {
              const isCurrent =
                template.columns.length === draftColumns.length &&
                template.columns.every((col, idx) => draftColumns[idx]?.id === col.id);

              return (
                <button
                  key={template.id}
                  type="button"
                  className={`template-card ${isCurrent ? 'is-active' : ''}`}
                  onClick={() => handleApplyTemplate(template)}
                >
                  <div className="template-card-head">
                    <strong>{template.name}</strong>
                    {isCurrent && (
                      <span className="hint-badge">
                        <Check size={11} /> Active
                      </span>
                    )}
                  </div>
                  <p>{template.description}</p>
                  <div className="template-pill-row">
                    {template.columns.map((col) => (
                      <span
                        key={col.id}
                        className="template-stage-pill"
                        style={{ borderColor: col.accent }}
                      >
                        <span
                          className="stage-chip-dot"
                          style={{ background: col.accent }}
                          aria-hidden="true"
                        />
                        <span>{col.shortLabel}</span>
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="sync-card">
          <div className="sync-card-head">
            <div>
              <h3>Customize Columns Manually</h3>
              <p>Rename, recolor, reorder, add, or remove stages for your board.</p>
            </div>
            <button
              type="button"
              className="btn-ghost is-compact"
              onClick={() => setDraftColumns([...DEFAULT_KANBAN_COLUMNS])}
            >
              <RotateCcw size={13} />
              <span>Default 6 Stages</span>
            </button>
          </div>

          <div className="custom-columns-list">
            {draftColumns.map((col, idx) => (
              <div key={col.id} className="custom-col-row">
                <input
                  type="color"
                  className="col-color-picker"
                  aria-label={`${col.title} accent color`}
                  value={col.accent}
                  onChange={(e) => handleChangeAccent(col.id, e.target.value)}
                />
                <input
                  type="text"
                  className="glass-input"
                  aria-label="Column title"
                  value={col.title}
                  onChange={(e) => handleRenameColumn(col.id, e.target.value)}
                />
                <button
                  type="button"
                  className="btn-glass is-compact"
                  disabled={idx === 0}
                  aria-label="Move column left"
                  onClick={() => handleMoveColumn(idx, -1)}
                >
                  <ArrowLeft size={13} />
                </button>
                <button
                  type="button"
                  className="btn-glass is-compact"
                  disabled={idx === draftColumns.length - 1}
                  aria-label="Move column right"
                  onClick={() => handleMoveColumn(idx, 1)}
                >
                  <ArrowRight size={13} />
                </button>
                <button
                  type="button"
                  className="btn-danger-ghost is-compact"
                  disabled={draftColumns.length <= 1}
                  aria-label={`Remove ${col.title} column`}
                  onClick={() => handleDeleteColumn(col.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <form className="add-col-form" onSubmit={handleAddColumn}>
            <input
              type="color"
              className="col-color-picker"
              aria-label="New column accent color"
              value={newColAccent}
              onChange={(e) => setNewColAccent(e.target.value)}
            />
            <input
              type="text"
              className="glass-input"
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              placeholder="New column name (e.g. Proposal Sent, Review)..."
            />
            <button type="submit" className="btn-glass" disabled={!newColTitle.trim()}>
              <Plus size={14} />
              <span>Add</span>
            </button>
          </form>
        </section>

        <div className="modal-footer">
          <span className="modal-subtitle">
            Tip: Uploading a spreadsheet with custom Status values can also auto-build columns in Sync &amp; Export.
          </span>
          <div className="modal-footer-right">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSaveCustom}>
              Save Columns
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
