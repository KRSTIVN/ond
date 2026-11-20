import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
} from 'react';
import { FileSpreadsheet, Plus, Sheet, Sparkles } from 'lucide-react';
import { KANBAN_COLUMNS, STATUS_TITLES } from './domain/columns';
import { createSampleLeads } from './domain/sampleData';
import {
  extractCity,
  type BoardPreferences,
  type LeadCard,
  type LeadStatus,
} from './domain/types';
import {
  CUSTOM_UPLOAD_WALLPAPER_ID,
  CUSTOM_URL_WALLPAPER_ID,
  findWallpaperPreset,
  WALLPAPER_PRESETS,
} from './domain/wallpapers';
import {
  connectLocalSpreadsheet,
  writeLeadsToConnectedFile,
  type ConnectedSpreadsheetFile,
} from './infra/fileBridge';
import {
  clearCustomWallpaperDataUrl,
  loadCustomWallpaperDataUrl,
  loadLeads,
  loadPreferences,
  saveCustomWallpaperDataUrl,
  saveLeads,
  savePreferences,
} from './infra/storage';
import { KanbanColumn } from './components/KanbanColumn';
import { LeadModal, type LeadDraft } from './components/LeadModal';
import { SheetSyncModal } from './components/SheetSyncModal';
import { TopBar, type LeadTypeFilter } from './components/TopBar';
import { WallpaperDrawer } from './components/WallpaperDrawer';

function moveLeadCard(
  allLeads: readonly LeadCard[],
  draggedId: string,
  targetStatus: LeadStatus,
  beforeLeadId: string | null,
): LeadCard[] {
  const dragged = allLeads.find((item) => item.id === draggedId);
  if (!dragged) return [...allLeads];

  const remaining = allLeads.filter((item) => item.id !== draggedId);
  const targetColumn = remaining
    .filter((item) => item.status === targetStatus)
    .sort((a, b) => a.order - b.order);

  const updatedDragged: LeadCard = {
    ...dragged,
    status: targetStatus,
    updatedAt: new Date().toISOString(),
  };

  const insertIndex = beforeLeadId
    ? targetColumn.findIndex((item) => item.id === beforeLeadId)
    : -1;

  if (insertIndex === -1) {
    targetColumn.push(updatedDragged);
  } else {
    targetColumn.splice(insertIndex, 0, updatedDragged);
  }

  const reindexedTarget = targetColumn.map((item, idx) => ({ ...item, order: idx }));
  const targetMap = new Map(reindexedTarget.map((item) => [item.id, item]));

  return [
    ...remaining.filter((item) => item.status !== targetStatus),
    ...targetMap.values(),
  ];
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Failed to read image file.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed.'));
    reader.readAsDataURL(file);
  });
}

export function App() {
  const [leads, setLeads] = useState<LeadCard[]>(() => loadLeads());
  const [preferences, setPreferences] = useState<BoardPreferences>(() => loadPreferences());
  const [customUploadDataUrl, setCustomUploadDataUrl] = useState<string | null>(null);

  const [connectedFile, setConnectedFile] = useState<ConnectedSpreadsheetFile | null>(null);
  const [hasUnsavedFileChanges, setHasUnsavedFileChanges] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [leadTypeFilter, setLeadTypeFilter] = useState<LeadTypeFilter>('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');

  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dropOverColumn, setDropOverColumn] = useState<LeadStatus | null>(null);
  const [dropTargetCardId, setDropTargetCardId] = useState<string | null>(null);

  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadCard | null>(null);
  const [newLeadDefaultStatus, setNewLeadDefaultStatus] = useState<LeadStatus>('leads');
  const [wallpaperDrawerOpen, setWallpaperDrawerOpen] = useState(false);
  const [sheetSyncOpen, setSheetSyncOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    saveLeads(leads);
  }, [leads]);

  useEffect(() => {
    savePreferences(preferences);
    document.title = `${preferences.boardTitle} — Kanban Pipeline`;
  }, [preferences]);

  useEffect(() => {
    let active = true;
    void loadCustomWallpaperDataUrl().then((dataUrl) => {
      if (active && dataUrl) {
        setCustomUploadDataUrl(dataUrl);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const mutateLeads = (updater: (prev: LeadCard[]) => LeadCard[]) => {
    setLeads(updater);
    if (connectedFile) {
      setHasUnsavedFileChanges(true);
    }
  };

  const cities = useMemo(() => {
    const unique = new Set(leads.map((lead) => extractCity(lead.address)));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (leadTypeFilter !== 'ALL' && lead.leadType !== leadTypeFilter) return false;
      if (cityFilter !== 'ALL' && extractCity(lead.address) !== cityFilter) return false;
      if (!query) return true;

      const haystack = [
        lead.businessName,
        lead.category,
        lead.address,
        lead.phone,
        lead.email,
        lead.websiteUrl,
        lead.notes,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [leads, searchQuery, leadTypeFilter, cityFilter]);

  const leadsByColumn = useMemo(() => {
    const map: Record<LeadStatus, LeadCard[]> = {
      leads: [],
      contacted: [],
      in_process: [],
      waiting_approval: [],
      done: [],
      lost: [],
    };
    for (const lead of filteredLeads) {
      map[lead.status].push(lead);
    }
    for (const col of KANBAN_COLUMNS) {
      map[col.id].sort((a, b) => a.order - b.order);
    }
    return map;
  }, [filteredLeads]);

  const doneCount = useMemo(
    () => leads.filter((lead) => lead.status === 'done').length,
    [leads],
  );

  const totalPipelineValue = useMemo(
    () =>
      leads
        .filter((lead) => lead.status !== 'lost')
        .reduce((sum, lead) => sum + (lead.dealValue ?? 0), 0),
    [leads],
  );

  const wallpaperSurface = useMemo(() => {
    if (preferences.wallpaperId === CUSTOM_UPLOAD_WALLPAPER_ID && customUploadDataUrl) {
      return {
        backdropStyle: { backgroundImage: `url(${customUploadDataUrl})` } as CSSProperties,
        thumb: `url(${customUploadDataUrl}) center/cover`,
      };
    }

    if (preferences.wallpaperId === CUSTOM_URL_WALLPAPER_ID && preferences.customWallpaperUrl) {
      const safeUrl = preferences.customWallpaperUrl.replace(/["'()]/g, '');
      return {
        backdropStyle: { backgroundImage: `url("${safeUrl}")` } as CSSProperties,
        thumb: `url("${safeUrl}") center/cover`,
      };
    }

    const preset = findWallpaperPreset(preferences.wallpaperId) ?? WALLPAPER_PRESETS[0];
    if (preset.kind === 'image') {
      return {
        backdropStyle: { backgroundImage: `url(${preset.src})` } as CSSProperties,
        thumb: `url(${preset.src}) center/cover`,
      };
    }

    return {
      backdropStyle: { background: preset.css } as CSSProperties,
      thumb: preset.css,
    };
  }, [preferences.wallpaperId, preferences.customWallpaperUrl, customUploadDataUrl]);

  const handleConnectLocalFile = async () => {
    const result = await connectLocalSpreadsheet(leads);
    if (!result.ok || !result.data) {
      if (result.error && result.error !== 'CANCELLED') {
        showToast(result.error);
      }
      return;
    }

    setConnectedFile(result.data.file);
    setLeads(result.data.leads);
    setHasUnsavedFileChanges(false);
    const derivedTitle = result.data.file.name.replace(/\.(xlsx|csv|tsv)$/i, '');
    if (preferences.boardTitle === 'OND' && derivedTitle) {
      setPreferences((prev) => ({ ...prev, boardTitle: derivedTitle }));
    }
    showToast(`Connected ${result.data.file.name} (${result.data.leads.length} cards)`);
  };

  const handleSaveConnectedFile = async () => {
    if (!connectedFile || isSavingFile) return;
    setIsSavingFile(true);
    const result = await writeLeadsToConnectedFile(connectedFile, leads);
    setIsSavingFile(false);

    if (!result.ok) {
      showToast(result.error ?? 'Failed to save spreadsheet.');
      return;
    }

    setHasUnsavedFileChanges(false);
    showToast(`Saved ${result.data ?? leads.length} cards to ${connectedFile.name}`);
  };

  const handleOpenNewLead = (status: LeadStatus = 'leads') => {
    setEditingLead(null);
    setNewLeadDefaultStatus(status);
    setLeadModalOpen(true);
  };

  const handleSelectLead = (lead: LeadCard) => {
    setEditingLead(lead);
    setNewLeadDefaultStatus(lead.status);
    setLeadModalOpen(true);
  };

  const handleSaveLead = (draft: LeadDraft) => {
    const now = new Date().toISOString();
    if (draft.id) {
      mutateLeads((prev) =>
        prev.map((item) =>
          item.id === draft.id
            ? {
                ...item,
                businessName: draft.businessName,
                category: draft.category,
                address: draft.address,
                phone: draft.phone,
                email: draft.email,
                websiteUrl: draft.websiteUrl,
                leadType: draft.leadType,
                notes: draft.notes,
                status: draft.status,
                dealValue: draft.dealValue,
                followUpDate: draft.followUpDate,
                updatedAt: now,
              }
            : item,
        ),
      );
      showToast(`Saved "${draft.businessName}"`);
      return;
    }

    mutateLeads((prev) => {
      const columnCount = prev.filter((item) => item.status === draft.status).length;
      const newCard: LeadCard = {
        id: `lead-${crypto.randomUUID().slice(0, 8)}`,
        businessName: draft.businessName,
        category: draft.category,
        address: draft.address,
        phone: draft.phone,
        email: draft.email,
        websiteUrl: draft.websiteUrl,
        leadType: draft.leadType,
        notes: draft.notes,
        status: draft.status,
        dealValue: draft.dealValue,
        followUpDate: draft.followUpDate,
        order: columnCount,
        createdAt: now,
        updatedAt: now,
      };
      return [...prev, newCard];
    });
    showToast(`Added "${draft.businessName}" to ${STATUS_TITLES[draft.status]}`);
  };

  const handleDeleteLead = (leadId: string) => {
    const target = leads.find((item) => item.id === leadId);
    mutateLeads((prev) => prev.filter((item) => item.id !== leadId));
    if (target) {
      showToast(`Removed "${target.businessName}"`);
    }
  };

  const handleCardDragStart = (event: DragEvent<HTMLElement>, lead: LeadCard) => {
    setDraggingLeadId(lead.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', lead.id);
  };

  const handleCardDragEnd = () => {
    setDraggingLeadId(null);
    setDropOverColumn(null);
    setDropTargetCardId(null);
  };

  const handleCardDragOver = (event: DragEvent<HTMLElement>, targetLead: LeadCard) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDropOverColumn(targetLead.status);
    setDropTargetCardId(targetLead.id);
  };

  const handleCardDrop = (event: DragEvent<HTMLElement>, targetLead: LeadCard) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = draggingLeadId ?? event.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetLead.id) {
      handleCardDragEnd();
      return;
    }

    const dragged = leads.find((item) => item.id === draggedId);
    mutateLeads((prev) => moveLeadCard(prev, draggedId, targetLead.status, targetLead.id));
    if (dragged && dragged.status !== targetLead.status) {
      showToast(`Moved "${dragged.businessName}" → ${STATUS_TITLES[targetLead.status]}`);
    }
    handleCardDragEnd();
  };

  const handleColumnDragOver = (event: DragEvent<HTMLElement>, status: LeadStatus) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dropOverColumn !== status) {
      setDropOverColumn(status);
    }
    setDropTargetCardId(null);
  };

  const handleColumnDragLeave = (event: DragEvent<HTMLElement>, status: LeadStatus) => {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    if (dropOverColumn === status) {
      setDropOverColumn(null);
    }
  };

  const handleColumnDrop = (event: DragEvent<HTMLElement>, status: LeadStatus) => {
    event.preventDefault();
    const draggedId = draggingLeadId ?? event.dataTransfer.getData('text/plain');
    if (!draggedId) {
      handleCardDragEnd();
      return;
    }

    const dragged = leads.find((item) => item.id === draggedId);
    mutateLeads((prev) => moveLeadCard(prev, draggedId, status, null));
    if (dragged && dragged.status !== status) {
      showToast(`Moved "${dragged.businessName}" → ${STATUS_TITLES[status]}`);
    }
    handleCardDragEnd();
  };

  const handleUploadWallpaper = async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    await saveCustomWallpaperDataUrl(dataUrl);
    setCustomUploadDataUrl(dataUrl);
    setPreferences((prev) => ({
      ...prev,
      wallpaperId: CUSTOM_UPLOAD_WALLPAPER_ID,
      hasCustomUpload: true,
    }));
    showToast('Custom wallpaper applied');
  };

  const handleClearCustomUpload = async () => {
    await clearCustomWallpaperDataUrl();
    setCustomUploadDataUrl(null);
    setPreferences((prev) => ({
      ...prev,
      hasCustomUpload: false,
      wallpaperId:
        prev.wallpaperId === CUSTOM_UPLOAD_WALLPAPER_ID ? 'coastal-twilight' : prev.wallpaperId,
    }));
    showToast('Custom wallpaper removed');
  };

  const handleApplyCustomUrl = (url: string) => {
    setPreferences((prev) => ({
      ...prev,
      customWallpaperUrl: url,
      wallpaperId: CUSTOM_URL_WALLPAPER_ID,
    }));
    showToast('Wallpaper URL applied');
  };

  const rootVars = {
    '--dim-opacity': preferences.dimOpacity,
    '--glass-blur': `${preferences.glassBlur}px`,
  } as CSSProperties;

  return (
    <div className="app-shell" style={rootVars}>
      <div className="wallpaper-layer" style={wallpaperSurface.backdropStyle} aria-hidden="true" />
      <div className="wallpaper-scrim" aria-hidden="true" />

      <TopBar
        boardTitle={preferences.boardTitle}
        googleSheetUrl={preferences.googleSheetUrl}
        connectedFileName={connectedFile?.name ?? null}
        hasUnsavedFileChanges={hasUnsavedFileChanges}
        isSavingFile={isSavingFile}
        onSaveConnectedFile={() => void handleSaveConnectedFile()}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        leadTypeFilter={leadTypeFilter}
        onLeadTypeFilterChange={setLeadTypeFilter}
        cityFilter={cityFilter}
        cities={cities}
        onCityFilterChange={setCityFilter}
        totalCount={leads.length}
        filteredCount={filteredLeads.length}
        doneCount={doneCount}
        totalPipelineValue={totalPipelineValue}
        activeWallpaperThumb={wallpaperSurface.thumb}
        onOpenNewLead={() => handleOpenNewLead('leads')}
        onOpenWallpapers={() => setWallpaperDrawerOpen(true)}
        onOpenSheetSync={() => setSheetSyncOpen(true)}
      />

      {leads.length === 0 && (
        <section className="empty-connect-bar" aria-label="Connect spreadsheet">
          <div className="empty-connect-copy">
            <strong>Connect your Google Sheet or Excel (.xlsx / .csv)</strong>
            <span>
              Your board starts completely private and empty. Link a spreadsheet to turn rows into draggable cards.
            </span>
          </div>
          <div className="empty-connect-actions">
            <button
              type="button"
              className="btn-primary is-compact"
              onClick={() => void handleConnectLocalFile()}
            >
              <FileSpreadsheet size={14} />
              <span>Open Excel / CSV</span>
            </button>
            <button
              type="button"
              className="btn-glass is-compact"
              onClick={() => setSheetSyncOpen(true)}
            >
              <Sheet size={14} />
              <span>Connect Google Sheet</span>
            </button>
            <button
              type="button"
              className="btn-glass is-compact"
              onClick={() => handleOpenNewLead('leads')}
            >
              <Plus size={14} />
              <span>Add Card</span>
            </button>
            <button
              type="button"
              className="btn-ghost is-compact"
              onClick={() => {
                setLeads(createSampleLeads());
                showToast('Loaded 4 fictional sample cards');
              }}
            >
              <Sparkles size={14} />
              <span>Try Sample</span>
            </button>
          </div>
        </section>
      )}

      <main className="board-stage scroller" aria-label="Kanban pipeline board">
        <div className="board-columns">
          {KANBAN_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              leads={leadsByColumn[column.id]}
              draggingLeadId={draggingLeadId}
              isDropOver={dropOverColumn === column.id}
              dropTargetCardId={dropTargetCardId}
              onSelectLead={handleSelectLead}
              onAddLeadInColumn={handleOpenNewLead}
              onCardDragStart={handleCardDragStart}
              onCardDragEnd={handleCardDragEnd}
              onCardDragOver={handleCardDragOver}
              onCardDrop={handleCardDrop}
              onColumnDragOver={handleColumnDragOver}
              onColumnDragLeave={handleColumnDragLeave}
              onColumnDrop={handleColumnDrop}
            />
          ))}
        </div>
      </main>

      <LeadModal
        open={leadModalOpen}
        lead={editingLead}
        defaultStatus={newLeadDefaultStatus}
        onClose={() => setLeadModalOpen(false)}
        onSave={handleSaveLead}
        onDelete={handleDeleteLead}
      />

      <WallpaperDrawer
        open={wallpaperDrawerOpen}
        preferences={preferences}
        customUploadDataUrl={customUploadDataUrl}
        onClose={() => setWallpaperDrawerOpen(false)}
        onSelectPreset={(wallpaperId) => {
          setPreferences((prev) => ({ ...prev, wallpaperId }));
          const preset = findWallpaperPreset(wallpaperId);
          if (preset) showToast(`Wallpaper: ${preset.name}`);
        }}
        onUploadWallpaper={handleUploadWallpaper}
        onClearCustomUpload={handleClearCustomUpload}
        onApplyCustomUrl={handleApplyCustomUrl}
        onUpdateVisuals={(patch) => setPreferences((prev) => ({ ...prev, ...patch }))}
      />

      <SheetSyncModal
        open={sheetSyncOpen}
        leads={leads}
        preferences={preferences}
        connectedFile={connectedFile}
        hasUnsavedFileChanges={hasUnsavedFileChanges}
        onClose={() => setSheetSyncOpen(false)}
        onConnectLocalFile={handleConnectLocalFile}
        onSaveConnectedFile={handleSaveConnectedFile}
        onDisconnectLocalFile={() => {
          setConnectedFile(null);
          setHasUnsavedFileChanges(false);
          showToast('Disconnected local file');
        }}
        onReplaceLeads={(nextLeads, summary) => {
          setLeads(nextLeads);
          if (connectedFile) setHasUnsavedFileChanges(true);
          showToast(summary);
        }}
        onClearBoard={() => {
          setLeads([]);
          if (connectedFile) setHasUnsavedFileChanges(true);
          showToast('Board cleared');
        }}
        onUpdateSettings={(patch) => setPreferences((prev) => ({ ...prev, ...patch }))}
      />

      {toastMessage && (
        <div className="toast-pill" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
