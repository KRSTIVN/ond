import type { CSSProperties, DragEvent } from 'react';
import { Plus } from 'lucide-react';
import type { KanbanColumnConfig, LeadCard, LeadStatus } from '../domain/types';
import { LeadCardItem } from './LeadCardItem';

interface KanbanColumnProps {
  readonly column: KanbanColumnConfig;
  readonly leads: readonly LeadCard[];
  readonly draggingLeadId: string | null;
  readonly isDropOver: boolean;
  readonly dropTargetCardId: string | null;
  readonly onSelectLead: (lead: LeadCard) => void;
  readonly onAddLeadInColumn: (status: LeadStatus) => void;
  readonly onCardDragStart: (event: DragEvent<HTMLElement>, lead: LeadCard) => void;
  readonly onCardDragEnd: () => void;
  readonly onCardDragOver: (event: DragEvent<HTMLElement>, targetLead: LeadCard) => void;
  readonly onCardDrop: (event: DragEvent<HTMLElement>, targetLead: LeadCard) => void;
  readonly onColumnDragOver: (event: DragEvent<HTMLElement>, status: LeadStatus) => void;
  readonly onColumnDragLeave: (event: DragEvent<HTMLElement>, status: LeadStatus) => void;
  readonly onColumnDrop: (event: DragEvent<HTMLElement>, status: LeadStatus) => void;
}

export function KanbanColumn({
  column,
  leads,
  draggingLeadId,
  isDropOver,
  dropTargetCardId,
  onSelectLead,
  onAddLeadInColumn,
  onCardDragStart,
  onCardDragEnd,
  onCardDragOver,
  onCardDrop,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
}: KanbanColumnProps) {
  const columnTotalValue = leads.reduce((sum, item) => sum + (item.dealValue ?? 0), 0);
  const accentStyle = { '--col-accent': column.accent } as CSSProperties;

  return (
    <section
      className={`kanban-column ${isDropOver ? 'is-drop-over' : ''}`}
      style={accentStyle}
      aria-label={`${column.title} column (${leads.length} leads)`}
      onDragOver={(e) => onColumnDragOver(e, column.id)}
      onDragLeave={(e) => onColumnDragLeave(e, column.id)}
      onDrop={(e) => onColumnDrop(e, column.id)}
    >
      <div className="column-accent-bar" aria-hidden="true" />

      <header className="column-header">
        <div className="column-title-group">
          <span className="column-dot" aria-hidden="true" />
          <h2 className="column-title">{column.title}</h2>
          <span className="column-count">{leads.length}</span>
        </div>
        {columnTotalValue > 0 && (
          <span className="column-value-pill">${columnTotalValue.toLocaleString()}</span>
        )}
      </header>

      <div className="column-cards scroller">
        {leads.length === 0 ? (
          <div className="column-empty">
            <span>Drop a lead here</span>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCardItem
              key={lead.id}
              lead={lead}
              isDragging={draggingLeadId === lead.id}
              isDropTargetBefore={dropTargetCardId === lead.id && draggingLeadId !== lead.id}
              onSelect={onSelectLead}
              onDragStart={onCardDragStart}
              onDragEnd={onCardDragEnd}
              onDragOverCard={onCardDragOver}
              onDropOnCard={onCardDrop}
            />
          ))
        )}
      </div>

      <footer className="column-footer">
        <button
          type="button"
          className="column-add-btn"
          onClick={() => onAddLeadInColumn(column.id)}
        >
          <Plus size={14} />
          <span>Add card</span>
        </button>
      </footer>
    </section>
  );
}
