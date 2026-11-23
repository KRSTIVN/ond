import {
  ArrowDownToLine,
  Calculator,
  Calendar,
  Columns3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Sheet,
} from 'lucide-react';
import { MATH_FORMULAS } from '../domain/calculator/formulas';
import { sanitizeHttpUrl, type WorkspaceTab } from '../domain/types';
import { OndLogo } from './OndLogo';

export type LeadTypeFilter = 'ALL' | 'Needs Website' | 'Update Candidate' | 'Other';

interface TopBarProps {
  readonly activeTab: WorkspaceTab;
  readonly onChangeTab: (tab: WorkspaceTab) => void;
  readonly boardTitle: string;
  readonly googleSheetUrl: string;
  readonly connectedFileName: string | null;
  readonly hasUnsavedFileChanges: boolean;
  readonly isSavingFile: boolean;
  readonly onSaveConnectedFile: () => void;
  readonly totalCount: number;
  readonly doneCount: number;
  readonly totalPipelineValue: number;
  readonly eventsCount: number;
  readonly notesCount: number;
  readonly activeWallpaperThumb: string;
  readonly updateAvailable: boolean;
  readonly isCheckingUpdate: boolean;
  readonly isApplyingUpdate: boolean;
  readonly onUpdateAction: () => void;
  readonly onOpenNewLead: () => void;
  readonly onOpenWallpapers: () => void;
  readonly onOpenSheetSync: () => void;
}

const WORKSPACE_TABS: readonly {
  readonly id: WorkspaceTab;
  readonly label: string;
  readonly icon: typeof Columns3;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'kanban', label: 'Kanban', icon: Columns3 },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'calculator', label: 'Calculator', icon: Calculator },
];

export function TopBar({
  activeTab,
  onChangeTab,
  boardTitle,
  googleSheetUrl,
  connectedFileName,
  hasUnsavedFileChanges,
  isSavingFile,
  onSaveConnectedFile,
  totalCount,
  doneCount,
  totalPipelineValue,
  eventsCount,
  notesCount,
  activeWallpaperThumb,
  updateAvailable,
  isCheckingUpdate,
  isApplyingUpdate,
  onUpdateAction,
  onOpenNewLead,
  onOpenWallpapers,
  onOpenSheetSync,
}: TopBarProps) {
  const safeGoogleSheetUrl = sanitizeHttpUrl(googleSheetUrl);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <OndLogo size={36} className="brand-logo" />
        <div className="brand-copy">
          <div className="brand-title-row">
            <h1 className="brand-title">{boardTitle}</h1>
            {safeGoogleSheetUrl && (
              <a
                className="sheet-origin-link"
                href={safeGoogleSheetUrl}
                target="_blank"
                rel="noreferrer"
                title="Open connected Google Sheet"
              >
                <span>Sheet</span>
                <ExternalLink size={11} />
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
            {(activeTab === 'kanban' || activeTab === 'dashboard') && (
              <>
                <span>{totalCount} cards</span>
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
              </>
            )}
            {activeTab === 'calendar' && (
              <span>
                {eventsCount} scheduled {eventsCount === 1 ? 'event' : 'events'}
              </span>
            )}
            {activeTab === 'notes' && (
              <span>
                {notesCount} markdown {notesCount === 1 ? 'note' : 'notes'}
              </span>
            )}
            {activeTab === 'calculator' && (
              <span>Scientific &amp; {MATH_FORMULAS.length} industry formulas</span>
            )}
          </div>
        </div>
      </div>

      <nav className="workspace-nav" aria-label="Workspace tools">
        {WORKSPACE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`workspace-tab-btn ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onChangeTab(tab.id)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="topbar-right">
        <button
          type="button"
          className={`btn-glass ${updateAvailable ? 'is-update-ready' : 'is-icon-only'}`}
          disabled={isCheckingUpdate || isApplyingUpdate}
          onClick={onUpdateAction}
          title={
            isApplyingUpdate
              ? 'Updating OND from GitHub...'
              : updateAvailable
                ? 'New OND update available — click to install & reload'
                : 'Check for OND updates on GitHub'
          }
          aria-label={updateAvailable ? 'Install OND update' : 'Check for updates'}
        >
          {isCheckingUpdate || isApplyingUpdate ? (
            <RefreshCw size={15} className="is-spinning" />
          ) : updateAvailable ? (
            <ArrowDownToLine size={15} />
          ) : (
            <RefreshCw size={15} />
          )}
          {updateAvailable && <span>{isApplyingUpdate ? 'Updating...' : 'Update'}</span>}
        </button>

        <button
          type="button"
          className="btn-glass"
          onClick={onOpenWallpapers}
          title="Switch UI theme variations, wallpapers, and glass blur"
        >
          <span
            className="wallpaper-mini-swatch"
            style={{ background: activeWallpaperThumb }}
            aria-hidden="true"
          />
          <Palette size={15} />
          <span>Themes</span>
        </button>

        <button
          type="button"
          className="btn-glass"
          onClick={onOpenSheetSync}
          title="Sync Google Sheets, Excel, Calendar, and Notes (Local & Google Sign-In)"
        >
          <Sheet size={15} />
          <span>Sync &amp; Backup</span>
        </button>

        {(activeTab === 'kanban' || activeTab === 'dashboard') && (
          <button type="button" className="btn-primary" onClick={onOpenNewLead}>
            <Plus size={16} />
            <span>Add Card</span>
          </button>
        )}
      </div>
    </header>
  );
}
