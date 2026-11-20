import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Trash2,
  X,
} from 'lucide-react';
import {
  normalizeWebsiteHref,
  type KanbanColumnConfig,
  type LeadCard,
  type LeadStatus,
  type LeadType,
} from '../domain/types';
import { useDialogModal } from '../hooks/useDialogModal';

export interface LeadDraft {
  readonly id?: string;
  businessName: string;
  category: string;
  address: string;
  phone: string;
  email: string;
  websiteUrl: string;
  leadType: LeadType;
  notes: string;
  status: LeadStatus;
  dealValue: number | null;
  followUpDate: string;
}

interface LeadModalProps {
  readonly open: boolean;
  readonly lead: LeadCard | null;
  readonly columns: readonly KanbanColumnConfig[];
  readonly defaultStatus: LeadStatus;
  readonly onClose: () => void;
  readonly onSave: (draft: LeadDraft) => void;
  readonly onDelete: (leadId: string) => void;
}

function createInitialDraft(lead: LeadCard | null, defaultStatus: LeadStatus): LeadDraft {
  if (!lead) {
    return {
      businessName: '',
      category: '',
      address: '',
      phone: '',
      email: '',
      websiteUrl: '',
      leadType: 'Needs Website',
      notes: '',
      status: defaultStatus,
      dealValue: null,
      followUpDate: '',
    };
  }

  return {
    id: lead.id,
    businessName: lead.businessName,
    category: lead.category,
    address: lead.address,
    phone: lead.phone,
    email: lead.email,
    websiteUrl: lead.websiteUrl,
    leadType: lead.leadType,
    notes: lead.notes,
    status: lead.status,
    dealValue: lead.dealValue,
    followUpDate: lead.followUpDate,
  };
}

export function LeadModal({
  open,
  lead,
  columns,
  defaultStatus,
  onClose,
  onSave,
  onDelete,
}: LeadModalProps) {
  const titleId = useId();
  const dialogRef = useDialogModal({ open, onClose });
  const [draft, setDraft] = useState<LeadDraft>(() => createInitialDraft(lead, defaultStatus));
  const [dealValueInput, setDealValueInput] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = createInitialDraft(lead, defaultStatus);
    setDraft(next);
    setDealValueInput(next.dealValue !== null ? String(next.dealValue) : '');
    setConfirmingDelete(false);
  }, [open, lead, defaultStatus]);

  const websiteHref = normalizeWebsiteHref(draft.websiteUrl);
  const mapsSearchUrl = draft.businessName.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${draft.businessName} ${draft.address}`.trim(),
      )}`
    : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.businessName.trim()) return;

    const numericDeal = dealValueInput.trim()
      ? Number(dealValueInput.replace(/[^0-9.]/g, ''))
      : null;
    onSave({
      ...draft,
      businessName: draft.businessName.trim(),
      category: draft.category.trim(),
      address: draft.address.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      websiteUrl: draft.websiteUrl.trim(),
      notes: draft.notes.trim(),
      dealValue: numericDeal !== null && Number.isFinite(numericDeal) ? numericDeal : null,
    });
    onClose();
  };

  const handleConfirmDelete = () => {
    if (!lead) return;
    onDelete(lead.id);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog lead-modal"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="modal-header">
        <div>
          <h2 id={titleId} className="modal-title">
            {lead ? lead.businessName : 'Add New Card'}
          </h2>
          <p className="modal-subtitle">
            {lead
              ? 'Update pipeline stage, contact details, and deal notes.'
              : 'Create a card on your interactive Kanban board.'}
          </p>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close card modal"
        >
          <X size={18} />
        </button>
      </div>

      <form className="modal-body scroller" onSubmit={handleSubmit}>
        <div className="stage-stepper" role="radiogroup" aria-label="Pipeline stage">
          {columns.map((col) => {
            const active = draft.status === col.id;
            return (
              <button
                key={col.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`stage-chip ${active ? 'is-active' : ''}`}
                style={{ '--chip-accent': col.accent } as React.CSSProperties}
                onClick={() => setDraft((prev) => ({ ...prev, status: col.id }))}
              >
                <span className="stage-chip-dot" aria-hidden="true" />
                <span>{col.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {lead && (
          <div className="quick-links-bar">
            {draft.phone && (
              <a
                className="quick-link-pill"
                href={`tel:${draft.phone.replace(/[^+\d]/g, '')}`}
              >
                <Phone size={13} />
                <span>Call {draft.phone}</span>
              </a>
            )}
            {websiteHref && (
              <a
                className="quick-link-pill"
                href={websiteHref}
                target="_blank"
                rel="noreferrer"
              >
                <Globe size={13} />
                <span>Open Website</span>
                <ExternalLink size={11} />
              </a>
            )}
            {mapsSearchUrl && (
              <a
                className="quick-link-pill"
                href={mapsSearchUrl}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={13} />
                <span>Google Maps</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        <div className="form-grid">
          <label className="form-field is-full">
            <span>Business / Card Name *</span>
            <input
              type="text"
              required
              autoFocus
              value={draft.businessName}
              onChange={(e) => setDraft((prev) => ({ ...prev, businessName: e.target.value }))}
              placeholder="e.g. Acme Auto Works"
            />
          </label>

          <label className="form-field">
            <span>Lead Type</span>
            <select
              value={draft.leadType}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, leadType: e.target.value as LeadType }))
              }
            >
              <option value="Needs Website">Needs Website</option>
              <option value="Update Candidate">Update Candidate</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label className="form-field">
            <span>Category</span>
            <input
              type="text"
              value={draft.category}
              onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="e.g. Auto Repair, Restaurant"
            />
          </label>

          <label className="form-field">
            <span>Phone Number</span>
            <input
              type="tel"
              value={draft.phone}
              onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="(555) 010-2040"
            />
          </label>

          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="owner@example.com"
            />
          </label>

          <label className="form-field is-full">
            <span>Address</span>
            <input
              type="text"
              value={draft.address}
              onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="123 Main St, City, ZIP"
            />
          </label>

          <label className="form-field is-full">
            <span>Website URL</span>
            <input
              type="text"
              value={draft.websiteUrl}
              onChange={(e) => setDraft((prev) => ({ ...prev, websiteUrl: e.target.value }))}
              placeholder="https://... (leave empty if none)"
            />
          </label>

          <label className="form-field">
            <span>Est. Deal Value (USD)</span>
            <input
              type="number"
              min="0"
              step="50"
              value={dealValueInput}
              onChange={(e) => setDealValueInput(e.target.value)}
              placeholder="1500"
            />
          </label>

          <label className="form-field">
            <span>Follow-up Date</span>
            <input
              type="date"
              value={draft.followUpDate}
              onChange={(e) => setDraft((prev) => ({ ...prev, followUpDate: e.target.value }))}
            />
          </label>

          <label className="form-field is-full">
            <span>Notes</span>
            <textarea
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Call summary, proposal details, design preferences..."
            />
          </label>
        </div>

        <div className="modal-footer">
          <div className="modal-footer-left">
            {lead && !confirmingDelete && (
              <button
                type="button"
                className="btn-danger-ghost"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}
            {lead && confirmingDelete && (
              <div className="inline-confirm">
                <button
                  type="button"
                  className="btn-danger-solid"
                  onClick={handleConfirmDelete}
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
              {lead ? 'Save Changes' : 'Create Card'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
