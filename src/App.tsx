import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
} from 'react';
import {
  Calculator,
  Calendar,
  Columns3,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  Palette,
  Plus,
  Search,
  Sheet,
  Sparkles,
  X,
} from 'lucide-react';
import {
  getColumnTitle,
  isDoneColumn,
  isLostColumn,
} from './domain/columns';
import type { ParsedSheetResult } from './domain/csvSync';
import { createSampleLeads } from './domain/sampleData';
import { findUiThemePreset } from './domain/themes';
import {
  extractCity,
  sanitizeHttpUrl,
  type BoardPreferences,
  type CalcHistoryEntry,
  type CalendarEvent,
  type KanbanColumnConfig,
  type LeadCard,
  type LeadStatus,
  type NoteItem,
  type UiThemeId,
  type WorkspaceTab,
} from './domain/types';
import {
  CUSTOM_UPLOAD_WALLPAPER_ID,
  CUSTOM_URL_WALLPAPER_ID,
  findWallpaperPreset,
  WALLPAPER_PRESETS,
} from './domain/wallpapers';
import type { WorkspaceSyncPayload } from './domain/workspaceSync';
import {
  connectLocalSpreadsheet,
  writeLeadsToConnectedFile,
  type ConnectedBackupFile,
  type ConnectedSpreadsheetFile,
} from './infra/fileBridge';
import type { GoogleSession } from './infra/googleSync';
import {
  clearCustomWallpaperDataUrl,
  loadCalcHistory,
  loadCalendarEvents,
  loadColumns,
  loadCustomWallpaperDataUrl,
  loadLeads,
  loadNotes,
  loadPreferences,
  saveCalcHistory,
  saveCalendarEvents,
  saveColumns,
  saveCustomWallpaperDataUrl,
  saveLeads,
  saveNotes,
  savePreferences,
} from './infra/storage';
import { BoardTemplatesModal } from './components/BoardTemplatesModal';
import { CalculatorView } from './components/calculator/CalculatorView';
import { CalendarView } from './components/calendar/CalendarView';
import { DashboardView } from './components/dashboard/DashboardView';
import { KanbanColumn } from './components/KanbanColumn';
import { LeadModal, type LeadDraft } from './components/LeadModal';
import { NotesView } from './components/notes/NotesView';
import { SheetSyncModal } from './components/SheetSyncModal';
import { TopBar, type LeadTypeFilter } from './components/TopBar';
import { WallpaperDrawer } from './components/WallpaperDrawer';

const LEAD_TYPE_OPTIONS: readonly { readonly value: LeadTypeFilter; readonly label: string }[] = [
  { value: 'ALL', label: 'All Types' },
  { value: 'Needs Website', label: 'Needs Website' },
  { value: 'Update Candidate', label: 'Update Candidate' },
];

const DOCK_ITEMS: readonly {
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
  const [preferences, setPreferences] = useState<BoardPreferences>(() => loadPreferences());
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => loadPreferences().defaultTab);
  const [columns, setColumns] = useState<KanbanColumnConfig[]>(() => loadColumns());
  const [leads, setLeads] = useState<LeadCard[]>(() => loadLeads());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => loadCalendarEvents());
  const [notes, setNotes] = useState<NoteItem[]>(() => loadNotes());
  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => loadNotes()[0]?.id ?? null);
  const [calcHistory, setCalcHistory] = useState<CalcHistoryEntry[]>(() => loadCalcHistory());
  const [customUploadDataUrl, setCustomUploadDataUrl] = useState<string | null>(null);

  const [connectedFile, setConnectedFile] = useState<ConnectedSpreadsheetFile | null>(null);
  const [connectedBackupFile, setConnectedBackupFile] = useState<ConnectedBackupFile | null>(null);
  const [hasUnsavedFileChanges, setHasUnsavedFileChanges] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [googleSession, setGoogleSession] = useState<GoogleSession | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [leadTypeFilter, setLeadTypeFilter] = useState<LeadTypeFilter>('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');

  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dropOverColumn, setDropOverColumn] = useState<LeadStatus | null>(null);
  const [dropTargetCardId, setDropTargetCardId] = useState<string | null>(null);

  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadCard | null>(null);
  const [newLeadDefaultStatus, setNewLeadDefaultStatus] = useState<LeadStatus>(
    () => loadColumns()[0]?.id ?? 'leads',
  );
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [wallpaperDrawerOpen, setWallpaperDrawerOpen] = useState(false);
  const [sheetSyncOpen, setSheetSyncOpen] = useState(false);
  const [syncInitialSection, setSyncInitialSection] = useState<'kanban' | 'workspace'>('kanban');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);

  useEffect(() => {
    saveColumns(columns);
  }, [columns]);

  useEffect(() => {
    saveLeads(leads);
  }, [leads]);

  useEffect(() => {
    saveCalendarEvents(calendarEvents);
  }, [calendarEvents]);

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  useEffect(() => {
    saveCalcHistory(calcHistory);
  }, [calcHistory]);

  useEffect(() => {
    savePreferences(preferences);
    document.title = `${preferences.boardTitle} — Workspace`;
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

  useEffect(() => {
    let active = true;
    const desktop = window.ondDesktop;

    if (desktop) {
      const unsubscribe = desktop.onUpdateEvent((event) => {
        if (!active) return;
        if (event.type === 'available') {
          setUpdateAvailable(true);
        } else if (event.type === 'progress') {
          showToast(`Downloading OND update (${event.percent}%)...`);
        } else if (event.type === 'downloaded') {
          setUpdateAvailable(true);
          showToast(`OND v${event.version} downloaded — restarting to install...`);
        } else if (event.type === 'error') {
          setIsApplyingUpdate(false);
          showToast(event.message);
        }
      });

      void desktop
        .checkForUpdates()
        .then((res) => {
          if (active && res.ok && res.updateAvailable) {
            setUpdateAvailable(true);
          }
        })
        .catch(() => {
          // Offline or packaged without release feed
        });

      return () => {
        active = false;
        unsubscribe();
      };
    }

    void fetch('/api/update/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; updateAvailable?: boolean } | null) => {
        if (active && data?.ok && data.updateAvailable) {
          setUpdateAvailable(true);
        }
      })
      .catch(() => {
        // Offline or running outside local OND server
      });
    return () => {
      active = false;
    };
  }, []);

  const handleUpdateAction = async () => {
    if (isCheckingUpdate || isApplyingUpdate) return;
    const desktop = window.ondDesktop;

    if (desktop) {
      if (updateAvailable) {
        setIsApplyingUpdate(true);
        showToast('Downloading OND desktop update...');
        try {
          const res = await desktop.installUpdate();
          if (!res.ok) {
            throw new Error(res.error ?? 'Update failed.');
          }
          if (res.mode === 'manual-download') {
            showToast('Opened latest macOS installer on GitHub Releases.');
            setIsApplyingUpdate(false);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Update failed.';
          showToast(msg);
          setIsApplyingUpdate(false);
        }
        return;
      }

      setIsCheckingUpdate(true);
      try {
        const res = await desktop.checkForUpdates();
        if (!res.ok) {
          throw new Error(res.error ?? 'Unable to reach GitHub Releases.');
        }
        if (res.updateAvailable) {
          setUpdateAvailable(true);
          showToast(`OND v${res.latestVersion ?? 'new'} ready — click Update to install`);
        } else {
          showToast(`OND v${res.currentVersion} is up to date`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Could not check for updates.';
        showToast(msg);
      } finally {
        setIsCheckingUpdate(false);
      }
      return;
    }

    if (updateAvailable) {
      setIsApplyingUpdate(true);
      showToast('Pulling latest OND update & rebuilding...');
      try {
        const res = await fetch('/api/update/apply', { method: 'POST' });
        const data = (await res.json()) as { ok?: boolean; updatedTo?: string; error?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        showToast(`Updated to ${data.updatedTo ?? 'latest'} — reloading...`);
        window.setTimeout(() => window.location.reload(), 700);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Update failed.';
        showToast(msg);
        setIsApplyingUpdate(false);
      }
      return;
    }

    setIsCheckingUpdate(true);
    try {
      const res = await fetch('/api/update/status');
      const data = (await res.json()) as {
        ok?: boolean;
        localCommit?: string;
        behindCount?: number;
        updateAvailable?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Unable to reach GitHub.');
      }
      if (data.updateAvailable) {
        setUpdateAvailable(true);
        showToast(`${data.behindCount ?? 1} update(s) ready — click Update to install`);
      } else {
        showToast(`OND is up to date (${data.localCommit ?? 'latest'})`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not check for updates.';
      showToast(msg);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const mutateLeads = (updater: (prev: LeadCard[]) => LeadCard[]) => {
    setLeads(updater);
    if (connectedFile) {
      setHasUnsavedFileChanges(true);
    }
  };

  const handleApplyColumns = (nextColumns: KanbanColumnConfig[], message: string) => {
    if (nextColumns.length === 0) return;
    const validIds = new Set(nextColumns.map((c) => c.id));
    const fallbackId = nextColumns[0]!.id;
    setColumns(nextColumns);
    setLeads((prev) =>
      prev.map((lead) => (validIds.has(lead.status) ? lead : { ...lead, status: fallbackId })),
    );
    showToast(message);
  };

  const handleApplySheetImport = (parsed: ParsedSheetResult, summary: string) => {
    setColumns(parsed.columns);
    setLeads(parsed.leads);
    if (connectedFile) setHasUnsavedFileChanges(true);
    showToast(summary);
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
    const map = new Map<string, LeadCard[]>();
    for (const col of columns) {
      map.set(col.id, []);
    }
    const fallbackId = columns[0]?.id ?? 'leads';
    for (const lead of filteredLeads) {
      const target = map.has(lead.status) ? lead.status : fallbackId;
      const list = map.get(target);
      if (list) list.push(lead);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.order - b.order);
    }
    return map;
  }, [filteredLeads, columns]);

  const doneCount = useMemo(
    () => leads.filter((lead) => isDoneColumn(columns, lead.status)).length,
    [leads, columns],
  );

  const totalPipelineValue = useMemo(
    () =>
      leads
        .filter((lead) => !isLostColumn(columns, lead.status))
        .reduce((sum, lead) => sum + (lead.dealValue ?? 0), 0),
    [leads, columns],
  );

  const wallpaperSurface = useMemo(() => {
    if (preferences.wallpaperId === CUSTOM_UPLOAD_WALLPAPER_ID && customUploadDataUrl) {
      return {
        backdropStyle: { backgroundImage: `url(${customUploadDataUrl})` } as CSSProperties,
        thumb: `url(${customUploadDataUrl}) center/cover`,
      };
    }

    if (preferences.wallpaperId === CUSTOM_URL_WALLPAPER_ID && preferences.customWallpaperUrl) {
      const validated = sanitizeHttpUrl(preferences.customWallpaperUrl);
      if (validated) {
        const safeUrl = validated.replace(/["'()]/g, '');
        return {
          backdropStyle: { backgroundImage: `url("${safeUrl}")` } as CSSProperties,
          thumb: `url("${safeUrl}") center/cover`,
        };
      }
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

  const handleConnectLocalFile = async (autoCreateColumns = true) => {
    const result = await connectLocalSpreadsheet(leads, columns, autoCreateColumns);
    if (!result.ok || !result.data) {
      if (result.error && result.error !== 'CANCELLED') {
        showToast(result.error);
      }
      return;
    }

    setConnectedFile(result.data.file);
    setColumns(result.data.parsed.columns);
    setLeads(result.data.parsed.leads);
    setHasUnsavedFileChanges(false);
    const derivedTitle = result.data.file.name.replace(/\.(xlsx|csv|tsv)$/i, '');
    if (preferences.boardTitle === 'OND' && derivedTitle) {
      setPreferences((prev) => ({ ...prev, boardTitle: derivedTitle }));
    }
    const colNote =
      result.data.parsed.addedColumnCount > 0
        ? ` + ${result.data.parsed.addedColumnCount} custom col(s)`
        : '';
    showToast(
      `Connected ${result.data.file.name} (${result.data.parsed.leads.length} cards${colNote})`,
    );
  };

  const handleSaveConnectedFile = async () => {
    if (!connectedFile || isSavingFile) return;
    setIsSavingFile(true);
    const result = await writeLeadsToConnectedFile(connectedFile, leads, columns);
    setIsSavingFile(false);

    if (!result.ok) {
      showToast(result.error ?? 'Failed to save spreadsheet.');
      return;
    }

    setHasUnsavedFileChanges(false);
    showToast(`Saved ${result.data ?? leads.length} cards to ${connectedFile.name}`);
  };

  const handleOpenNewLead = (status?: LeadStatus) => {
    setEditingLead(null);
    setNewLeadDefaultStatus(status ?? columns[0]?.id ?? 'leads');
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
      const targetId = draft.id;
      mutateLeads((prev) => {
        const existing = prev.find((item) => item.id === targetId);
        const statusChanged = existing ? existing.status !== draft.status : false;
        const updated = prev.map((item) =>
          item.id === targetId
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
        );
        return statusChanged ? moveLeadCard(updated, targetId, draft.status, null) : updated;
      });
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
    showToast(`Added "${draft.businessName}" to ${getColumnTitle(columns, draft.status)}`);
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
      showToast(`Moved "${dragged.businessName}" → ${getColumnTitle(columns, targetLead.status)}`);
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
      showToast(`Moved "${dragged.businessName}" → ${getColumnTitle(columns, status)}`);
    }
    handleCardDragEnd();
  };

  const handleSaveCalendarEvent = (evt: CalendarEvent) => {
    setCalendarEvents((prev) => {
      const exists = prev.some((item) => item.id === evt.id);
      return exists ? prev.map((item) => (item.id === evt.id ? evt : item)) : [...prev, evt];
    });
    showToast(`Saved event "${evt.title}"`);
  };

  const handleDeleteCalendarEvent = (eventId: string) => {
    setCalendarEvents((prev) => prev.filter((item) => item.id !== eventId));
    showToast('Removed event');
  };

  const handleMergeCalendarEvents = (incoming: CalendarEvent[], summary: string) => {
    setCalendarEvents((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]));
      for (const evt of incoming) {
        byId.set(evt.id, evt);
      }
      return Array.from(byId.values());
    });
    showToast(summary);
  };

  const handleApplyWorkspaceBackup = (payload: WorkspaceSyncPayload, summary: string) => {
    setCalendarEvents([...payload.calendarEvents]);
    setNotes([...payload.notes]);
    setActiveNoteId(payload.notes[0]?.id ?? null);
    if (payload.columns && payload.columns.length > 0) {
      setColumns([...payload.columns]);
    }
    showToast(summary);
  };

  const handleCreateNote = () => {
    const newNote: NoteItem = {
      id: `note-${crypto.randomUUID().slice(0, 8)}`,
      title: 'Untitled Note',
      content: '## Notes\n\n- [ ] Action item\n',
      tags: [],
      pinned: false,
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
  };

  const handleUpdateNote = (updated: NoteItem) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== noteId);
      if (activeNoteId === noteId) {
        setActiveNoteId(next[0]?.id ?? null);
      }
      return next;
    });
    showToast('Deleted note');
  };

  const handleImportMarkdownNotes = (importedNotes: NoteItem[], summary: string) => {
    setNotes((prev) => [...importedNotes, ...prev]);
    if (importedNotes[0]) {
      setActiveNoteId(importedNotes[0].id);
    }
    showToast(summary);
  };

  const handleUploadWallpaper = async (file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await saveCustomWallpaperDataUrl(dataUrl);
      setCustomUploadDataUrl(dataUrl);
      setPreferences((prev) => ({
        ...prev,
        wallpaperId: CUSTOM_UPLOAD_WALLPAPER_ID,
        hasCustomUpload: true,
      }));
      showToast('Custom wallpaper applied');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to save custom wallpaper.';
      showToast(msg);
      throw error;
    }
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

  const handleSelectUiTheme = (uiTheme: UiThemeId) => {
    setPreferences((prev) => ({ ...prev, uiTheme }));
    const preset = findUiThemePreset(uiTheme);
    showToast(`UI Theme: ${preset.name}`);
  };

  const openSyncHub = () => {
    setSyncInitialSection(
      activeTab === 'calendar' || activeTab === 'notes' ? 'workspace' : 'kanban',
    );
    setSheetSyncOpen(true);
  };

  const hasFilters =
    searchQuery.trim().length > 0 || leadTypeFilter !== 'ALL' || cityFilter !== 'ALL';

  const rootVars = {
    '--dim-opacity': preferences.dimOpacity,
    '--glass-blur': `${preferences.glassBlur}px`,
  } as CSSProperties;

  return (
    <div className="app-shell" data-ui-theme={preferences.uiTheme} style={rootVars}>
      <div className="wallpaper-layer" style={wallpaperSurface.backdropStyle} aria-hidden="true" />
      <div className="wallpaper-scrim" aria-hidden="true" />

      <div className="spatial-stage-wrapper">
        {preferences.uiTheme === 'vision-spatial' && (
          <aside className="spatial-side-dock" aria-label="Quick spatial dock">
            {DOCK_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`dock-icon-btn ${active ? 'is-active' : ''}`}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={17} />
                </button>
              );
            })}
            <span className="dock-divider" aria-hidden="true" />
            <button
              type="button"
              className="dock-icon-btn"
              title="Themes & Wallpapers"
              aria-label="Themes & Wallpapers"
              onClick={() => setWallpaperDrawerOpen(true)}
            >
              <Palette size={17} />
            </button>
            <button
              type="button"
              className="dock-icon-btn"
              title="Sync & Backup"
              aria-label="Sync & Backup"
              onClick={openSyncHub}
            >
              <Sheet size={17} />
            </button>
          </aside>
        )}

        <div className="spatial-window-frame">
          <TopBar
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            boardTitle={preferences.boardTitle}
            googleSheetUrl={preferences.googleSheetUrl}
            connectedFileName={connectedFile?.name ?? null}
            hasUnsavedFileChanges={hasUnsavedFileChanges}
            isSavingFile={isSavingFile}
            onSaveConnectedFile={() => void handleSaveConnectedFile()}
            totalCount={leads.length}
            doneCount={doneCount}
            totalPipelineValue={totalPipelineValue}
            eventsCount={calendarEvents.length}
            notesCount={notes.length}
            activeWallpaperThumb={wallpaperSurface.thumb}
            updateAvailable={updateAvailable}
            isCheckingUpdate={isCheckingUpdate}
            isApplyingUpdate={isApplyingUpdate}
            onUpdateAction={() => void handleUpdateAction()}
            onOpenNewLead={() => handleOpenNewLead()}
            onOpenWallpapers={() => setWallpaperDrawerOpen(true)}
            onOpenSheetSync={openSyncHub}
          />

          {activeTab === 'dashboard' && (
            <main className="workspace-main">
              <DashboardView
                boardTitle={preferences.boardTitle}
                leads={leads}
                columns={columns}
                calendarEvents={calendarEvents}
                notes={notes}
                calcHistory={calcHistory}
                onNavigateTab={setActiveTab}
                onSelectLead={handleSelectLead}
                onOpenNewLead={() => handleOpenNewLead()}
                onOpenSync={openSyncHub}
                onOpenTemplates={() => setTemplatesModalOpen(true)}
                onSelectNote={setActiveNoteId}
                onCreateNote={() => {
                  handleCreateNote();
                  setActiveTab('notes');
                }}
                onLoadSampleData={() => {
                  setLeads(createSampleLeads());
                  showToast('Loaded 4 fictional sample cards');
                }}
              />
            </main>
          )}

          {activeTab === 'kanban' && (
            <>
              <div className="kanban-filter-bar" role="region" aria-label="Kanban filters">
                <label className="search-field">
                  <Search size={14} className="search-icon" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cards, phone, city, notes..."
                    aria-label="Search cards"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="icon-clear-btn"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </label>

                <div className="filter-group" role="group" aria-label="Filter by lead type">
                  {LEAD_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`filter-pill ${leadTypeFilter === option.value ? 'is-active' : ''}`}
                      onClick={() => setLeadTypeFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <select
                  className="city-select"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  aria-label="Filter by city"
                >
                  <option value="ALL">All Cities</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn-glass is-compact"
                  onClick={() => setTemplatesModalOpen(true)}
                  title="Switch Kanban template or customize columns"
                >
                  <LayoutTemplate size={14} />
                  <span>Templates &amp; Columns</span>
                </button>

                {hasFilters && (
                  <span className="filter-match-count">
                    Showing {filteredLeads.length} of {leads.length}
                  </span>
                )}
              </div>

              {leads.length === 0 && (
                <section className="empty-connect-bar" aria-label="Connect spreadsheet">
                  <div className="empty-connect-copy">
                    <strong>Connect your Google Sheet or Excel (.xlsx / .csv)</strong>
                    <span>
                      Your board starts completely private and empty. Link a spreadsheet to turn rows into draggable cards, or customize templates.
                    </span>
                  </div>
                  <div className="empty-connect-actions">
                    <button
                      type="button"
                      className="btn-primary is-compact"
                      onClick={() => void handleConnectLocalFile(true)}
                    >
                      <FileSpreadsheet size={14} />
                      <span>Open Excel / CSV</span>
                    </button>
                    <button
                      type="button"
                      className="btn-glass is-compact"
                      onClick={() => {
                        setSyncInitialSection('kanban');
                        setSheetSyncOpen(true);
                      }}
                    >
                      <Sheet size={14} />
                      <span>Connect Google Sheet</span>
                    </button>
                    <button
                      type="button"
                      className="btn-glass is-compact"
                      onClick={() => setTemplatesModalOpen(true)}
                    >
                      <LayoutTemplate size={14} />
                      <span>Templates</span>
                    </button>
                    <button
                      type="button"
                      className="btn-glass is-compact"
                      onClick={() => handleOpenNewLead()}
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
                  {columns.map((column) => (
                    <KanbanColumn
                      key={column.id}
                      column={column}
                      leads={leadsByColumn.get(column.id) ?? []}
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
            </>
          )}

          {activeTab === 'calendar' && (
            <main className="workspace-main">
              <CalendarView
                events={calendarEvents}
                leads={leads}
                columns={columns}
                weekStartsOn={preferences.weekStartsOn}
                onChangeWeekStartsOn={(weekStartsOn) =>
                  setPreferences((prev) => ({ ...prev, weekStartsOn }))
                }
                onSaveEvent={handleSaveCalendarEvent}
                onDeleteEvent={handleDeleteCalendarEvent}
                onOpenLeadCard={handleSelectLead}
              />
            </main>
          )}

          {activeTab === 'notes' && (
            <main className="workspace-main">
              <NotesView
                notes={notes}
                activeNoteId={activeNoteId}
                onSelectNote={setActiveNoteId}
                onCreateNote={handleCreateNote}
                onUpdateNote={handleUpdateNote}
                onDeleteNote={handleDeleteNote}
              />
            </main>
          )}

          {activeTab === 'calculator' && (
            <main className="workspace-main">
              <CalculatorView
                angleUnit={preferences.calcAngleUnit}
                history={calcHistory}
                onChangeAngleUnit={(calcAngleUnit) =>
                  setPreferences((prev) => ({ ...prev, calcAngleUnit }))
                }
                onPushHistory={(entry) => setCalcHistory((prev) => [entry, ...prev].slice(0, 50))}
                onClearHistory={() => {
                  setCalcHistory([]);
                  showToast('Cleared calculator history');
                }}
              />
            </main>
          )}
        </div>
      </div>

      <LeadModal
        open={leadModalOpen}
        lead={editingLead}
        columns={columns}
        defaultStatus={newLeadDefaultStatus}
        onClose={() => setLeadModalOpen(false)}
        onSave={handleSaveLead}
        onDelete={handleDeleteLead}
      />

      <BoardTemplatesModal
        open={templatesModalOpen}
        columns={columns}
        onClose={() => setTemplatesModalOpen(false)}
        onApplyColumns={handleApplyColumns}
      />

      <WallpaperDrawer
        open={wallpaperDrawerOpen}
        preferences={preferences}
        customUploadDataUrl={customUploadDataUrl}
        onClose={() => setWallpaperDrawerOpen(false)}
        onSelectUiTheme={handleSelectUiTheme}
        onSelectDefaultTab={(defaultTab) => {
          setPreferences((prev) => ({ ...prev, defaultTab }));
          showToast(`Startup view: ${defaultTab === 'dashboard' ? 'Spatial Dashboard' : 'Kanban Board'}`);
        }}
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
        initialSection={syncInitialSection}
        leads={leads}
        columns={columns}
        calendarEvents={calendarEvents}
        notes={notes}
        preferences={preferences}
        connectedFile={connectedFile}
        connectedBackupFile={connectedBackupFile}
        hasUnsavedFileChanges={hasUnsavedFileChanges}
        googleSession={googleSession}
        onClose={() => setSheetSyncOpen(false)}
        onConnectLocalFile={handleConnectLocalFile}
        onSaveConnectedFile={handleSaveConnectedFile}
        onDisconnectLocalFile={() => {
          setConnectedFile(null);
          setHasUnsavedFileChanges(false);
          showToast('Disconnected local file');
        }}
        onApplySheetImport={handleApplySheetImport}
        onClearBoard={() => {
          setLeads([]);
          if (connectedFile) setHasUnsavedFileChanges(true);
          showToast('Board cleared');
        }}
        onSetConnectedBackupFile={setConnectedBackupFile}
        onApplyWorkspaceBackup={handleApplyWorkspaceBackup}
        onMergeCalendarEvents={handleMergeCalendarEvents}
        onImportMarkdownNotes={handleImportMarkdownNotes}
        onSetGoogleSession={setGoogleSession}
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
