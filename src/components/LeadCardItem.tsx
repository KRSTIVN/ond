import type { DragEvent, KeyboardEvent } from 'react';
import {
  Calendar,
  ExternalLink,
  Globe,
  GripVertical,
  MapPin,
  Phone,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  extractCity,
  formatShortCategory,
  formatWebsiteHost,
  normalizeWebsiteHref,
  type LeadCard,
} from '../domain/types';

interface LeadCardItemProps {
  readonly lead: LeadCard;
  readonly isDragging: boolean;
  readonly isDropTargetBefore: boolean;
  readonly onSelect: (lead: LeadCard) => void;
  readonly onDragStart: (event: DragEvent<HTMLElement>, lead: LeadCard) => void;
  readonly onDragEnd: () => void;
  readonly onDragOverCard: (event: DragEvent<HTMLElement>, targetLead: LeadCard) => void;
  readonly onDropOnCard: (event: DragEvent<HTMLElement>, targetLead: LeadCard) => void;
}

export function LeadCardItem({
  lead,
  isDragging,
  isDropTargetBefore,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropOnCard,
}: LeadCardItemProps) {
  const city = extractCity(lead.address);
  const shortCategory = formatShortCategory(lead.category);
  const websiteHref = normalizeWebsiteHref(lead.websiteUrl);
  const websiteHost = formatWebsiteHost(lead.websiteUrl);
  const isUpdateCandidate = lead.leadType === 'Update Candidate';

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(lead);
    }
  };

  return (
    <article
      className={`lead-card ${isDragging ? 'is-dragging' : ''} ${isDropTargetBefore ? 'is-drop-before' : ''}`}
      draggable
      tabIndex={0}
      role="button"
      aria-label={`${lead.businessName}, ${lead.leadType}, ${city}. Press Enter to edit.`}
      onClick={() => onSelect(lead)}
      onKeyDown={handleKeyDown}
      onDragStart={(e) => onDragStart(e, lead)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOverCard(e, lead)}
      onDrop={(e) => onDropOnCard(e, lead)}
    >
      <div className="lead-card-header">
        <div className="lead-badges">
          <span className={`lead-type-badge ${isUpdateCandidate ? 'is-update' : 'is-needs'}`}>
            {isUpdateCandidate ? <Wrench size={11} /> : <Sparkles size={11} />}
            <span>{lead.leadType}</span>
          </span>
          <span className="lead-city-badge">
            <MapPin size={11} />
            <span>{city}</span>
          </span>
        </div>
        <span className="lead-drag-handle" aria-hidden="true">
          <GripVertical size={14} />
        </span>
      </div>

      <h3 className="lead-title">{lead.businessName}</h3>
      <p className="lead-category">{shortCategory}</p>

      {lead.notes && <p className="lead-notes">{lead.notes}</p>}

      {(lead.dealValue !== null || lead.followUpDate) && (
        <div className="lead-meta-strip">
          {lead.dealValue !== null && (
            <span className="meta-chip is-money">${lead.dealValue.toLocaleString()}</span>
          )}
          {lead.followUpDate && (
            <span className="meta-chip is-date">
              <Calendar size={11} />
              <span>{lead.followUpDate}</span>
            </span>
          )}
        </div>
      )}

      <div className="lead-card-footer">
        {lead.phone ? (
          <a
            className="card-action-link"
            href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}
            onClick={(e) => e.stopPropagation()}
            title={`Call ${lead.phone}`}
          >
            <Phone size={12} />
            <span>{lead.phone}</span>
          </a>
        ) : (
          <span className="card-muted-text">No phone</span>
        )}

        {websiteHref && websiteHost ? (
          <a
            className="card-action-link is-site"
            href={websiteHref}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={websiteHref}
          >
            <Globe size={12} />
            <span className="site-host">{websiteHost}</span>
            <ExternalLink size={10} />
          </a>
        ) : (
          <span className="card-no-site">No site</span>
        )}
      </div>
    </article>
  );
}
