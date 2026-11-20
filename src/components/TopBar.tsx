import {
  ExternalLink,
  FileSpreadsheet,
  Image as ImageIcon,
  Plus,
  Save,
  Search,
  Sheet,
  X,
} from 'lucide-react';
import type { LeadType } from '../domain/types';
import { OndLogo } from './OndLogo';

export type LeadTypeFilter = 'ALL' | LeadType;

interface TopBarProps {
  readonly boardTitle: string;
  readonly googleSheetUrl: string;
  readonly connectedFileName: string | null;
  readonly hasUnsavedFileChanges: boolean;
  readonly isSavingFile: boolean;
  readonly onSaveConnectedFile: () => void;
  readonly searchQuery: string;
  readonly onSearchChange: (value: string) => void;
  readonly leadTypeFilter: LeadTypeFilter;
  readonly onLeadTypeFilterChange: (value: LeadTypeFilter) => void;
  readonly cityFilter: string;
  readonly cities: readonly string[];
  readonly onCityFilterChange: (value: string) => void;
  readonly totalCount: number;
  readonly filteredCount: number;
  readonly doneCount: number;
  readonly totalPipelineValue: number;
  readonly activeWallpaperThumb: string;
  readonly onOpenNewLead: () => void;
  readonly onOpenWallpapers: () => void;
  readonly onOpenSheetSync: () => void;
}

const LEAD_TYPE_OPTIONS: readonly { readonly value: LeadTypeFilter; readonly label: string }[] = [
  { value: 'ALL', label: 'All Types' },
  { value: 'Needs Website', label: 'Needs Website' },
  { value: 'Update Candidate', label: 'Update Candidate' },
];

export function TopBar({
  boardTitle,
  googleSheetUrl,
  connectedFileName,
  hasUnsavedFileChanges,
  isSavingFile,
  onSaveConnectedFile,
  searchQuery,
  onSearchChange,
  leadTypeFilter,
  onLeadTypeFilterChange,
  cityFilter,
  cities,
  onCityFilterChange,
  totalCount,
  filteredCount,
  doneCount,
  totalPipelineValue,
  activeWallpaperThumb,
  onOpenNewLead,
  onOpenWallpapers,
  onOpenSheetSync,
}: TopBarProps) {
  const hasFilters =
    searchQuery.trim().length > 0 || leadTypeFilter !== 'ALL' || cityFilter !== 'ALL';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <OndLogo size={38} className="brand-logo" />
        <div className="brand-copy">
          <div className="brand-title-row">
            <h1 className="brand-title">{boardTitle}</h1>
            {googleSheetUrl && (
              <a
                className="sheet-origin-link"
                href={googleSheetUrl}
                target="_blank"
                rel="noreferrer"
                title="Open connected Google Sheet"
              >
                <span>Google Sheet</span>
                <ExternalLink size={12} />
              </a>
            )}
            {connectedFileName && (
              <button
                type="button"
                className={`file-sync-pill ${hasUnsavedFileChanges ? 'is-dirty' : ''}`}
                disabled={isSavingFile}
                onClick={onSaveConnectedFile}
                title={`Click to save changes back to ${connectedFileName}`}
              >
                <FileSpreadsheet size={12} />
                <span className="file-sync-name">{connectedFileName}</span>
                <Save size={11} />
              </button>
            )}
          </div>
          <div className="brand-stats">
            <span>
              {hasFilters ? `${filteredCount} of ${totalCount}` : `${totalCount}`} cards
            </span>
            <span className="stat-dot" aria-hidden="true">•</span>
            <span>{doneCount} done</span>
            {totalPipelineValue > 0 && (
              <>
                <span className="stat-dot" aria-hidden="true">•</span>
                <span className="stat-value">
                  ${totalPipelineValue.toLocaleString()} pipeline
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="topbar-center">
        <label className="search-field">
          <Search size={15} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search cards, phone, city..."
            aria-label="Search cards"
          />
          {searchQuery && (
            <button
              type="button"
              className="icon-clear-btn"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </label>

        <div className="filter-group" role="group" aria-label="Filter by lead type">
          {LEAD_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`filter-pill ${leadTypeFilter === option.value ? 'is-active' : ''}`}
              onClick={() => onLeadTypeFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <select
          className="city-select"
          value={cityFilter}
          onChange={(e) => onCityFilterChange(e.target.value)}
          aria-label="Filter by city"
        >
          <option value="ALL">All Cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="btn-glass"
          onClick={onOpenWallpapers}
          title="Change board wallpaper and glass blur"
        >
          <span
            className="wallpaper-mini-swatch"
            style={{ background: activeWallpaperThumb }}
            aria-hidden="true"
          />
          <ImageIcon size={15} />
          <span>Wallpapers</span>
        </button>

        <button
          type="button"
          className="btn-glass"
          onClick={onOpenSheetSync}
          title="Connect Google Sheets or Excel (.xlsx / .csv)"
        >
          <Sheet size={15} />
          <span>Sheets / Excel</span>
        </button>

        <button type="button" className="btn-primary" onClick={onOpenNewLead}>
          <Plus size={16} />
          <span>Add Card</span>
        </button>
      </div>
    </header>
  );
}
