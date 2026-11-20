import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import {
  Calendar,
  Check,
  ClipboardCopy,
  Cloud,
  CloudDownload,
  CloudUpload,
  Code2,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { getColumnTitle } from '../domain/columns';
import {
  buildAppsScriptBridge,
  parseLeadsFromMatrix,
  parseLeadsFromText,
  resolveGoogleSheetCsvUrl,
  serializeLeadsToCsv,
  serializeLeadsToTsv,
  type ParsedSheetResult,
} from '../domain/csvSync';
import { downloadExcelFile } from '../domain/excelSync';
import { createSampleLeads } from '../domain/sampleData';
import {
  sanitizeHttpUrl,
  type BoardPreferences,
  type CalendarEvent,
  type KanbanColumnConfig,
  type LeadCard,
  type NoteItem,
} from '../domain/types';
import {
  parseEventsFromIcs,
  parseWorkspacePayload,
  serializeEventsToIcs,
  serializeWorkspacePayload,
  type WorkspaceSyncPayload,
} from '../domain/workspaceSync';
import {
  connectLocalBackupJson,
  importSpreadsheetFile,
  isFileSystemAccessSupported,
  saveWorkspaceToLocalFile,
  type ConnectedBackupFile,
  type ConnectedSpreadsheetFile,
} from '../infra/fileBridge';
import {
  loadNotesAndCalendarFromGoogleDrive,
  pullGoogleCalendarEvents,
  pushGoogleCalendarEvents,
  saveNotesAndCalendarToGoogleDrive,
  signInWithGoogle,
  type GoogleSession,
} from '../infra/googleSync';
import { useDialogModal } from '../hooks/useDialogModal';

interface SheetSyncModalProps {
  readonly open: boolean;
  readonly initialSection?: 'kanban' | 'workspace';
  readonly leads: readonly LeadCard[];
  readonly columns: readonly KanbanColumnConfig[];
  readonly calendarEvents: readonly CalendarEvent[];
  readonly notes: readonly NoteItem[];
  readonly preferences: BoardPreferences;
  readonly connectedFile: ConnectedSpreadsheetFile | null;
  readonly connectedBackupFile: ConnectedBackupFile | null;
  readonly hasUnsavedFileChanges: boolean;
  readonly googleSession: GoogleSession | null;
  readonly onClose: () => void;
  readonly onConnectLocalFile: (autoCreateColumns: boolean) => Promise<void>;
  readonly onSaveConnectedFile: () => Promise<void>;
  readonly onDisconnectLocalFile: () => void;
  readonly onApplySheetImport: (parsed: ParsedSheetResult, summary: string) => void;
  readonly onClearBoard: () => void;
  readonly onSetConnectedBackupFile: (file: ConnectedBackupFile | null) => void;
  readonly onApplyWorkspaceBackup: (payload: WorkspaceSyncPayload, summary: string) => void;
  readonly onMergeCalendarEvents: (events: CalendarEvent[], summary: string) => void;
  readonly onImportMarkdownNotes: (importedNotes: NoteItem[], summary: string) => void;
  readonly onSetGoogleSession: (session: GoogleSession | null) => void;
  readonly onUpdateSettings: (
    patch: Partial<
      Pick<
        BoardPreferences,
        | 'boardTitle'
        | 'googleSheetUrl'
        | 'appsScriptUrl'
        | 'appsScriptToken'
        | 'csvPublishUrl'
        | 'googleClientId'
      >
    >,
  ) => void;
}

function triggerDownload(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SheetSyncModal({
  open,
  initialSection = 'kanban',
  leads,
  columns,
  calendarEvents,
  notes,
  preferences,
  connectedFile,
  connectedBackupFile,
  hasUnsavedFileChanges,
  googleSession,
  onClose,
  onConnectLocalFile,
  onSaveConnectedFile,
  onDisconnectLocalFile,
  onApplySheetImport,
  onClearBoard,
  onSetConnectedBackupFile,
  onApplyWorkspaceBackup,
  onMergeCalendarEvents,
  onImportMarkdownNotes,
  onSetGoogleSession,
  onUpdateSettings,
}: SheetSyncModalProps) {
  const titleId = useId();
  const dialogRef = useDialogModal({ open, onClose });
  const sheetFileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonBackupInputRef = useRef<HTMLInputElement | null>(null);
  const icsInputRef = useRef<HTMLInputElement | null>(null);
  const mdInputRef = useRef<HTMLInputElement | null>(null);

  const [activeSection, setActiveSection] = useState<'kanban' | 'workspace'>(initialSection);
  const [autoCreateColumns, setAutoCreateColumns] = useState(true);
  const [boardTitleInput, setBoardTitleInput] = useState(preferences.boardTitle);
  const [sheetUrlInput, setSheetUrlInput] = useState(preferences.googleSheetUrl);
  const [csvUrlInput, setCsvUrlInput] = useState(preferences.csvPublishUrl);
  const [appsScriptUrl, setAppsScriptUrl] = useState(preferences.appsScriptUrl);
  const [appsScriptToken, setAppsScriptToken] = useState(preferences.appsScriptToken);
  const [googleClientIdInput, setGoogleClientIdInput] = useState(preferences.googleClientId);
  const [pasteText, setPasteText] = useState('');
  const [copiedTsv, setCopiedTsv] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const supportsLiveFilePicker = isFileSystemAccessSupported();
  const safeLinkedSheetUrl = sanitizeHttpUrl(preferences.googleSheetUrl);

  useEffect(() => {
    if (!open) return;
    setActiveSection(initialSection);
    setBoardTitleInput(preferences.boardTitle);
    setSheetUrlInput(preferences.googleSheetUrl);
    setCsvUrlInput(preferences.csvPublishUrl);
    setAppsScriptUrl(preferences.appsScriptUrl);
    setAppsScriptToken(preferences.appsScriptToken);
    setGoogleClientIdInput(preferences.googleClientId);
    setConfirmingClear(false);
  }, [open, initialSection, preferences]);

  const handleSaveIdentity = () => {
    const cleanTitle = boardTitleInput.trim() || 'OND';
    const rawUrl = sheetUrlInput.trim();
    if (rawUrl && !sanitizeHttpUrl(rawUrl)) {
      setErrorMessage('Google Sheet URL must start with https:// or http://.');
      return;
    }
    const safeUrl = rawUrl ? (sanitizeHttpUrl(rawUrl) ?? '') : '';
    onUpdateSettings({ boardTitle: cleanTitle, googleSheetUrl: safeUrl });
    setErrorMessage(null);
    setStatusMessage('Saved board title and Google Sheet link locally.');
  };

  const handleCopyTsv = async () => {
    try {
      await navigator.clipboard.writeText(serializeLeadsToTsv(leads, columns));
      setCopiedTsv(true);
      setErrorMessage(null);
      setStatusMessage('Copied TSV! Select cell A1 in Google Sheets or Excel and press Ctrl+V.');
      window.setTimeout(() => setCopiedTsv(false), 2400);
    } catch {
      setErrorMessage('Clipboard access was blocked by the browser. Use Export .xlsx or CSV.');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const slug = (preferences.boardTitle || 'ond')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      await downloadExcelFile(leads, `${slug || 'ond'}.xlsx`, columns);
      setErrorMessage(null);
      setStatusMessage('Downloaded Excel (.xlsx) workbook with your Kanban stages.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Excel export failed.';
      setErrorMessage(msg);
    }
  };

  const handleDownloadCsv = () => {
    triggerDownload(serializeLeadsToCsv(leads, columns), 'text/csv;charset=utf-8;', 'ond-leads.csv');
    setErrorMessage(null);
    setStatusMessage('Downloaded CSV with your Kanban stages.');
  };

  const handleImportSpreadsheetFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await importSpreadsheetFile(file, leads, columns, autoCreateColumns);
    event.target.value = '';

    if (!result.ok || !result.data) {
      setErrorMessage(result.error ?? 'Unable to import spreadsheet file.');
      return;
    }

    const colNote =
      result.data.addedColumnCount > 0
        ? ` + created ${result.data.addedColumnCount} custom column(s)`
        : '';
    setErrorMessage(null);
    setStatusMessage(`Imported ${result.data.leads.length} cards from ${file.name}${colNote}.`);
    onApplySheetImport(result.data, `Imported ${result.data.leads.length} cards${colNote}`);
  };

  const handleImportPaste = () => {
    const result = parseLeadsFromText(pasteText, leads, columns, autoCreateColumns);
    if (!result.ok || !result.data) {
      setErrorMessage(result.error ?? 'Could not parse pasted spreadsheet cells.');
      return;
    }
    const colNote =
      result.data.addedColumnCount > 0
        ? ` + created ${result.data.addedColumnCount} custom column(s)`
        : '';
    setPasteText('');
    setErrorMessage(null);
    setStatusMessage(`Imported ${result.data.leads.length} cards from pasted cells${colNote}.`);
    onApplySheetImport(result.data, `Imported ${result.data.leads.length} cards${colNote}`);
  };

  const handlePullCsvUrl = async () => {
    const resolved = resolveGoogleSheetCsvUrl(csvUrlInput || sheetUrlInput);
    if (!resolved) {
      setErrorMessage(
        'Enter a valid Google Sheet URL (shared as "Anyone with link" or Published to Web as CSV).',
      );
      return;
    }

    onUpdateSettings({ csvPublishUrl: csvUrlInput.trim() || sheetUrlInput.trim() });
    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const response = await fetch(resolved);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const csvText = await response.text();
      const parsed = parseLeadsFromText(csvText, leads, columns, autoCreateColumns);
      if (!parsed.ok || !parsed.data) {
        throw new Error(parsed.error ?? 'Could not parse CSV response.');
      }

      setStatusMessage(`Pulled ${parsed.data.leads.length} cards from Google Sheets CSV.`);
      onApplySheetImport(parsed.data, `Pulled ${parsed.data.leads.length} cards from Sheets`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error';
      setErrorMessage(
        `CSV pull failed (${msg}). For private sheets, use the Apps Script bridge below or paste cells directly.`,
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyAppsScript = async () => {
    try {
      await navigator.clipboard.writeText(buildAppsScriptBridge());
      setCopiedScript(true);
      window.setTimeout(() => setCopiedScript(false), 2400);
    } catch {
      setErrorMessage('Unable to copy script to clipboard.');
    }
  };

  const handlePushToAppsScript = async () => {
    const endpoint = sanitizeHttpUrl(appsScriptUrl);
    if (!endpoint) {
      setErrorMessage('Paste a valid https:// Google Apps Script Web App URL first.');
      return;
    }

    const token = appsScriptToken.trim();
    onUpdateSettings({ appsScriptUrl: endpoint, appsScriptToken: token });
    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const rows = leads.map((lead) => [
        lead.businessName,
        lead.category,
        lead.address,
        lead.phone,
        lead.email || 'Not available',
        lead.websiteUrl || 'None',
        lead.leadType,
        lead.notes,
        getColumnTitle(columns, lead.status),
        lead.dealValue ?? '',
        lead.followUpDate,
      ]);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token, rows }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (result.ok === false) {
        throw new Error(result.error ?? 'Apps Script rejected the request.');
      }

      setStatusMessage(`Pushed ${leads.length} cards directly to your Google Sheet!`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error';
      setErrorMessage(`Push failed (${msg}). Verify Apps Script deployment and API token.`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromAppsScript = async () => {
    const endpoint = sanitizeHttpUrl(appsScriptUrl);
    if (!endpoint) {
      setErrorMessage('Paste a valid https:// Google Apps Script Web App URL first.');
      return;
    }

    const token = appsScriptToken.trim();
    onUpdateSettings({ appsScriptUrl: endpoint, appsScriptToken: token });
    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const fetchUrl = new URL(endpoint);
      if (token) fetchUrl.searchParams.set('token', token);

      const response = await fetch(fetchUrl.href);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        rows?: unknown[][];
      };
      if (payload.ok === false) throw new Error(payload.error ?? 'Unauthorized');
      if (!Array.isArray(payload.rows)) {
        throw new Error('Unexpected response format (expected { rows: [...] })');
      }

      const matrix = payload.rows.map((row) =>
        Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : [],
      );
      const parsed = parseLeadsFromMatrix(matrix, leads, columns, autoCreateColumns);
      if (!parsed.ok || !parsed.data) {
        throw new Error(parsed.error ?? 'Failed to parse sheet rows');
      }

      setStatusMessage(`Pulled ${parsed.data.leads.length} cards from your Google Sheet.`);
      onApplySheetImport(parsed.data, `Pulled ${parsed.data.leads.length} cards from Google Sheet`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error';
      setErrorMessage(`Pull failed (${msg}).`);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Calendar & Notes Local Backup Handlers ---
  const handleDownloadWorkspaceJson = () => {
    const json = serializeWorkspacePayload(calendarEvents, notes, columns);
    triggerDownload(json, 'application/json;charset=utf-8', 'ond-calendar-notes-backup.json');
    setErrorMessage(null);
    setStatusMessage(`Saved ${calendarEvents.length} events & ${notes.length} notes to local JSON.`);
  };

  const handleImportWorkspaceJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    event.target.value = '';
    const parsed = parseWorkspacePayload(text);
    if (!parsed.ok || !parsed.data) {
      setErrorMessage(parsed.error ?? 'Invalid workspace JSON file.');
      return;
    }
    setErrorMessage(null);
    setStatusMessage(
      `Restored ${parsed.data.calendarEvents.length} events and ${parsed.data.notes.length} notes.`,
    );
    onApplyWorkspaceBackup(
      parsed.data,
      `Restored ${parsed.data.calendarEvents.length} events & ${parsed.data.notes.length} notes`,
    );
  };

  const handleSaveLocalBackupFile = async () => {
    const res = await saveWorkspaceToLocalFile(connectedBackupFile, calendarEvents, notes, columns);
    if (!res.ok || !res.data) {
      if (res.error && res.error !== 'CANCELLED') setErrorMessage(res.error);
      return;
    }
    onSetConnectedBackupFile(res.data);
    setErrorMessage(null);
    setStatusMessage(`Saved Calendar & Notes directly to ${res.data.name}.`);
  };

  const handleOpenLocalBackupFile = async () => {
    const res = await connectLocalBackupJson();
    if (!res.ok || !res.data) {
      if (res.error && res.error !== 'CANCELLED') setErrorMessage(res.error);
      return;
    }
    onSetConnectedBackupFile(res.data.file);
    setErrorMessage(null);
    setStatusMessage(`Connected & loaded ${res.data.file.name}.`);
    onApplyWorkspaceBackup(res.data.payload, `Loaded ${res.data.file.name}`);
  };

  const handleExportIcs = () => {
    const ics = serializeEventsToIcs(calendarEvents);
    triggerDownload(ics, 'text/calendar;charset=utf-8', 'ond-calendar.ics');
    setErrorMessage(null);
    setStatusMessage(
      `Exported ${calendarEvents.length} calendar events (.ics) — ready for Apple Calendar, Google Calendar, or Outlook.`,
    );
  };

  const handleImportIcs = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    event.target.value = '';
    const parsed = parseEventsFromIcs(text);
    if (!parsed.ok || !parsed.data) {
      setErrorMessage(parsed.error ?? 'Failed to parse .ics file.');
      return;
    }
    setErrorMessage(null);
    setStatusMessage(`Imported ${parsed.data.length} calendar events from ${file.name}.`);
    onMergeCalendarEvents(parsed.data, `Imported ${parsed.data.length} events from .ics`);
  };

  const handleImportMarkdownFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const now = new Date().toISOString();
    const imported: NoteItem[] = [];

    for (const file of files) {
      const content = await file.text();
      const title = file.name.replace(/\.(md|markdown|txt)$/i, '').trim() || 'Imported Note';
      imported.push({
        id: `note-${crypto.randomUUID().slice(0, 8)}`,
        title,
        content,
        tags: ['imported'],
        pinned: false,
        updatedAt: now,
      });
    }

    event.target.value = '';
    setErrorMessage(null);
    setStatusMessage(`Imported ${imported.length} Markdown note(s).`);
    onImportMarkdownNotes(imported, `Imported ${imported.length} Markdown note(s)`);
  };

  // --- Google Sign-In Sync Handlers ---
  const handleGoogleSignIn = async () => {
    const cleanId = googleClientIdInput.trim();
    if (!cleanId) {
      setErrorMessage('Paste your Google Cloud Web OAuth Client ID first.');
      return;
    }
    onUpdateSettings({ googleClientId: cleanId });
    setIsSyncing(true);
    setErrorMessage(null);

    const res = await signInWithGoogle(cleanId);
    setIsSyncing(false);

    if (!res.ok || !res.data) {
      setErrorMessage(res.error ?? 'Google Sign-In failed.');
      return;
    }

    onSetGoogleSession(res.data);
    setStatusMessage(`Signed in to Google as ${res.data.email}.`);
  };

  const handlePullGoogleCalendar = async () => {
    if (!googleSession) return;
    setIsSyncing(true);
    setErrorMessage(null);
    const res = await pullGoogleCalendarEvents(googleSession.accessToken);
    setIsSyncing(false);
    if (!res.ok || !res.data) {
      setErrorMessage(res.error ?? 'Google Calendar pull failed.');
      return;
    }
    setStatusMessage(`Pulled ${res.data.length} events from Google Calendar.`);
    onMergeCalendarEvents(res.data, `Synced ${res.data.length} Google Calendar events`);
  };

  const handlePushGoogleCalendar = async () => {
    if (!googleSession) return;
    setIsSyncing(true);
    setErrorMessage(null);
    const res = await pushGoogleCalendarEvents(googleSession.accessToken, calendarEvents);
    setIsSyncing(false);
    if (!res.ok) {
      setErrorMessage(res.error ?? 'Google Calendar push failed.');
      return;
    }
    setStatusMessage(`Synced ${res.data ?? 0} OND event(s) to your Google Calendar.`);
  };

  const handleSaveToGoogleDrive = async () => {
    if (!googleSession) return;
    setIsSyncing(true);
    setErrorMessage(null);
    const res = await saveNotesAndCalendarToGoogleDrive(
      googleSession.accessToken,
      calendarEvents,
      notes,
      columns,
    );
    setIsSyncing(false);
    if (!res.ok) {
      setErrorMessage(res.error ?? 'Google Drive save failed.');
      return;
    }
    setStatusMessage(`Saved Notes & Calendar to Google Drive (${res.data}).`);
  };

  const handleLoadFromGoogleDrive = async () => {
    if (!googleSession) return;
    setIsSyncing(true);
    setErrorMessage(null);
    const res = await loadNotesAndCalendarFromGoogleDrive(googleSession.accessToken);
    setIsSyncing(false);
    if (!res.ok || !res.data) {
      setErrorMessage(res.error ?? 'Google Drive restore failed.');
      return;
    }
    setStatusMessage(
      `Restored ${res.data.calendarEvents.length} events & ${res.data.notes.length} notes from Google Drive.`,
    );
    onApplyWorkspaceBackup(res.data, 'Restored Calendar & Notes from Google Drive');
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog sync-modal"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="modal-header">
        <div>
          <h2 id={titleId} className="modal-title">
            Sync &amp; Backup Hub
          </h2>
          <p className="modal-subtitle">
            {leads.length} cards · {calendarEvents.length} events · {notes.length} notes — stored privately on your machine or your own Google account.
          </p>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close sync modal"
        >
          <X size={18} />
        </button>
      </div>

      <div className="sync-tabs-bar" role="tablist" aria-label="Sync sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'kanban'}
          className={`sync-tab-btn ${activeSection === 'kanban' ? 'is-active' : ''}`}
          onClick={() => setActiveSection('kanban')}
        >
          <FileSpreadsheet size={14} />
          <span>Kanban (Sheets &amp; Excel)</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'workspace'}
          className={`sync-tab-btn ${activeSection === 'workspace' ? 'is-active' : ''}`}
          onClick={() => setActiveSection('workspace')}
        >
          <Cloud size={14} />
          <span>Calendar &amp; Notes (Local &amp; Google)</span>
        </button>
      </div>

      <div className="modal-body scroller">
        {statusMessage && <div className="banner-success">{statusMessage}</div>}
        {errorMessage && <div className="banner-error">{errorMessage}</div>}

        {activeSection === 'kanban' ? (
          <>
            <section className="sync-card">
              <h3>Board Settings (Saved Locally Only)</h3>
              <div className="form-grid">
                <label className="form-field">
                  <span>Board Title</span>
                  <input
                    type="text"
                    value={boardTitleInput}
                    onChange={(e) => setBoardTitleInput(e.target.value)}
                    placeholder="OND"
                  />
                </label>
                <label className="form-field">
                  <span>Linked Google Sheet URL (Optional)</span>
                  <input
                    type="url"
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                </label>
              </div>
              <div className="sync-action-row">
                <button type="button" className="btn-glass is-compact" onClick={handleSaveIdentity}>
                  <Check size={13} />
                  <span>Save Board Info</span>
                </button>
                {safeLinkedSheetUrl && (
                  <a
                    className="btn-ghost is-compact"
                    href={safeLinkedSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>Open Linked Sheet</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </section>

            <section className="sync-card">
              <div className="sync-card-head">
                <div>
                  <h3>Excel (.xlsx) &amp; CSV Live File Sync</h3>
                  <p>
                    Connect a local Excel or CSV file to edit on the board and write updates directly back to disk.
                  </p>
                </div>
                {connectedFile && (
                  <span className="hint-badge">
                    {connectedFile.name} {hasUnsavedFileChanges ? '• Unsaved' : '• Synced'}
                  </span>
                )}
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={autoCreateColumns}
                  onChange={(e) => setAutoCreateColumns(e.target.checked)}
                />
                <span>Auto-create custom Kanban columns from uploaded sheet Status values</span>
              </label>

              <div className="sync-action-row">
                {supportsLiveFilePicker && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void onConnectLocalFile(autoCreateColumns)}
                  >
                    <FolderOpen size={15} />
                    <span>{connectedFile ? 'Switch Connected File' : 'Connect Excel / CSV File'}</span>
                  </button>
                )}

                {connectedFile && (
                  <>
                    <button
                      type="button"
                      className="btn-glass"
                      onClick={() => void onSaveConnectedFile()}
                    >
                      <Save size={15} />
                      <span>Save Back to {connectedFile.name}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-ghost is-compact"
                      onClick={onDisconnectLocalFile}
                    >
                      Disconnect
                    </button>
                  </>
                )}

                <input
                  ref={sheetFileInputRef}
                  type="file"
                  accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="visually-hidden"
                  onChange={(e) => void handleImportSpreadsheetFile(e)}
                />
                <button
                  type="button"
                  className="btn-glass"
                  onClick={() => sheetFileInputRef.current?.click()}
                >
                  <Upload size={15} />
                  <span>Import .xlsx / .csv</span>
                </button>

                <button
                  type="button"
                  className="btn-glass"
                  disabled={leads.length === 0}
                  onClick={() => void handleDownloadExcel()}
                >
                  <FileSpreadsheet size={15} />
                  <span>Export .xlsx</span>
                </button>

                <button
                  type="button"
                  className="btn-glass"
                  disabled={leads.length === 0}
                  onClick={handleDownloadCsv}
                >
                  <Download size={15} />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  className="btn-glass"
                  disabled={leads.length === 0}
                  onClick={() => void handleCopyTsv()}
                >
                  {copiedTsv ? <Check size={15} /> : <ClipboardCopy size={15} />}
                  <span>{copiedTsv ? 'Copied!' : 'Copy TSV (A1)'}</span>
                </button>
              </div>
            </section>

            <section className="sync-card">
              <h3>Google Sheets Live Sync</h3>
              <p>
                Pull from a Published-to-Web CSV link, or paste a deployed Apps Script Web App URL for live 2-way Pull &amp; Push.
              </p>

              <div className="url-input-row">
                <input
                  type="url"
                  value={csvUrlInput}
                  onChange={(e) => setCsvUrlInput(e.target.value)}
                  placeholder="Google Sheet URL or Published CSV link..."
                />
                <button
                  type="button"
                  className="btn-glass"
                  disabled={isSyncing}
                  onClick={() => void handlePullCsvUrl()}
                >
                  <RefreshCw size={14} className={isSyncing ? 'is-spinning' : ''} />
                  <span>Pull CSV</span>
                </button>
              </div>

              <div className="sync-card-head" style={{ marginTop: 6 }}>
                <span className="sub-label">2-Way Apps Script Webhook (Private Sheets)</span>
                <button
                  type="button"
                  className="btn-ghost is-compact"
                  onClick={() => setShowScriptCode((prev) => !prev)}
                >
                  <Code2 size={14} />
                  <span>{showScriptCode ? 'Hide Script' : 'View Apps Script'}</span>
                </button>
              </div>

              {showScriptCode && (
                <div className="script-box">
                  <div className="script-box-bar">
                    <span>Extensions → Apps Script → Deploy as Web App</span>
                    <button
                      type="button"
                      className="btn-glass is-compact"
                      onClick={() => void handleCopyAppsScript()}
                    >
                      {copiedScript ? <Check size={13} /> : <ClipboardCopy size={13} />}
                      <span>{copiedScript ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <pre className="script-pre scroller">
                    <code>{buildAppsScriptBridge()}</code>
                  </pre>
                </div>
              )}

              <div className="url-input-row">
                <input
                  type="url"
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                />
                <button
                  type="button"
                  className="btn-glass"
                  disabled={isSyncing}
                  onClick={() => void handlePullFromAppsScript()}
                >
                  <RefreshCw size={14} className={isSyncing ? 'is-spinning' : ''} />
                  <span>Pull</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isSyncing}
                  onClick={() => void handlePushToAppsScript()}
                >
                  <span>Push</span>
                </button>
              </div>

              <div className="url-input-row">
                <input
                  type="password"
                  value={appsScriptToken}
                  onChange={(e) => setAppsScriptToken(e.target.value)}
                  placeholder="Optional shared API_TOKEN (recommended for private sheets)"
                  autoComplete="off"
                />
              </div>
            </section>

            <section className="sync-card">
              <h3>Quick Paste from Google Sheets or Excel</h3>
              <textarea
                className="sync-textarea"
                rows={3}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Copy cells (including header row) from Google Sheets or Excel and paste here..."
              />
              <div className="sync-action-row">
                <button
                  type="button"
                  className="btn-glass"
                  disabled={!pasteText.trim()}
                  onClick={handleImportPaste}
                >
                  <Upload size={14} />
                  <span>Import Pasted Rows</span>
                </button>
              </div>
            </section>

            <div className="sync-reset-row">
              <button
                type="button"
                className="btn-glass is-compact"
                onClick={() => {
                  onApplySheetImport(
                    {
                      leads: createSampleLeads(),
                      columns: [...columns],
                      addedColumnCount: 0,
                    },
                    'Loaded 4 sample demo cards',
                  );
                  setStatusMessage('Loaded 4 fictional sample cards.');
                }}
              >
                <Sparkles size={13} />
                <span>Load Sample Demo Data</span>
              </button>

              {!confirmingClear ? (
                <button
                  type="button"
                  className="btn-danger-ghost is-compact"
                  disabled={leads.length === 0}
                  onClick={() => setConfirmingClear(true)}
                >
                  <Trash2 size={13} />
                  <span>Clear Board</span>
                </button>
              ) : (
                <div className="inline-confirm">
                  <span className="confirm-text">Clear all {leads.length} cards?</span>
                  <button
                    type="button"
                    className="btn-danger-solid is-compact"
                    onClick={() => {
                      onClearBoard();
                      setConfirmingClear(false);
                      setStatusMessage('Board cleared.');
                    }}
                  >
                    Confirm Clear
                  </button>
                  <button
                    type="button"
                    className="btn-ghost is-compact"
                    onClick={() => setConfirmingClear(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <section className="sync-card">
              <div className="sync-card-head">
                <div>
                  <h3>Local Backup &amp; Native File Export</h3>
                  <p>
                    Save Calendar events and Markdown Notes locally as JSON, Apple/Google/Outlook `.ics`, or import `.md` files.
                  </p>
                </div>
                {connectedBackupFile && (
                  <span className="hint-badge">Linked: {connectedBackupFile.name}</span>
                )}
              </div>

              <div className="sync-action-row">
                {supportsLiveFilePicker && (
                  <>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => void handleSaveLocalBackupFile()}
                    >
                      <Save size={15} />
                      <span>
                        {connectedBackupFile
                          ? `Save to ${connectedBackupFile.name}`
                          : 'Save to Local JSON File'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn-glass"
                      onClick={() => void handleOpenLocalBackupFile()}
                    >
                      <FolderOpen size={15} />
                      <span>Open Local JSON</span>
                    </button>
                  </>
                )}

                <button type="button" className="btn-glass" onClick={handleDownloadWorkspaceJson}>
                  <FileJson size={15} />
                  <span>Download Backup (.json)</span>
                </button>

                <input
                  ref={jsonBackupInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="visually-hidden"
                  onChange={(e) => void handleImportWorkspaceJson(e)}
                />
                <button
                  type="button"
                  className="btn-glass"
                  onClick={() => jsonBackupInputRef.current?.click()}
                >
                  <Upload size={15} />
                  <span>Restore Backup (.json)</span>
                </button>
              </div>

              <div className="sync-action-row" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  className="btn-glass"
                  disabled={calendarEvents.length === 0}
                  onClick={handleExportIcs}
                >
                  <Calendar size={15} />
                  <span>Export Calendar (.ics)</span>
                </button>

                <input
                  ref={icsInputRef}
                  type="file"
                  accept=".ics,text/calendar"
                  className="visually-hidden"
                  onChange={(e) => void handleImportIcs(e)}
                />
                <button
                  type="button"
                  className="btn-glass"
                  onClick={() => icsInputRef.current?.click()}
                >
                  <Upload size={15} />
                  <span>Import Calendar (.ics)</span>
                </button>

                <input
                  ref={mdInputRef}
                  type="file"
                  accept=".md,.markdown,.txt,text/markdown,text/plain"
                  multiple
                  className="visually-hidden"
                  onChange={(e) => void handleImportMarkdownFiles(e)}
                />
                <button
                  type="button"
                  className="btn-glass"
                  onClick={() => mdInputRef.current?.click()}
                >
                  <FileText size={15} />
                  <span>Import Notes (.md)</span>
                </button>
              </div>
            </section>

            <section className="sync-card">
              <div className="sync-card-head">
                <div>
                  <h3>Google Sign-In Sync (Google Calendar &amp; Google Drive)</h3>
                  <p>
                    Sign in with your Google account to sync Calendar events directly with Google Calendar and back up Notes &amp; Calendar to Google Drive (`OND-Workspace-Sync.json`). Access tokens stay in memory only.
                  </p>
                </div>
                {googleSession && <span className="hint-badge">{googleSession.email}</span>}
              </div>

              <label className="form-field is-full">
                <span>Google Cloud Web OAuth Client ID (Saved locally — never committed)</span>
                <div className="url-input-row">
                  <input
                    type="text"
                    value={googleClientIdInput}
                    onChange={(e) => setGoogleClientIdInput(e.target.value)}
                    placeholder="1234567890-xxxx.apps.googleusercontent.com"
                  />
                  {!googleSession ? (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={isSyncing}
                      onClick={() => void handleGoogleSignIn()}
                    >
                      <LogIn size={15} />
                      <span>Sign in with Google</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        onSetGoogleSession(null);
                        setStatusMessage('Signed out of Google.');
                      }}
                    >
                      <LogOut size={14} />
                      <span>Sign out</span>
                    </button>
                  )}
                </div>
              </label>

              <p className="sync-hint-small">
                Setup (1-time): In Google Cloud Console → APIs &amp; Services → Credentials → Create OAuth Client ID (Web application) → add <code>http://127.0.0.1:5173</code> under Authorized JavaScript origins, and enable the Google Calendar &amp; Google Drive APIs.
              </p>

              {googleSession && (
                <div className="sync-action-row" style={{ marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn-glass"
                    disabled={isSyncing}
                    onClick={() => void handlePullGoogleCalendar()}
                  >
                    <CloudDownload size={15} />
                    <span>Pull Google Calendar</span>
                  </button>
                  <button
                    type="button"
                    className="btn-glass"
                    disabled={isSyncing || calendarEvents.length === 0}
                    onClick={() => void handlePushGoogleCalendar()}
                  >
                    <CloudUpload size={15} />
                    <span>Push to Google Calendar</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isSyncing}
                    onClick={() => void handleSaveToGoogleDrive()}
                  >
                    <CloudUpload size={15} />
                    <span>Save Notes &amp; Calendar to Drive</span>
                  </button>
                  <button
                    type="button"
                    className="btn-glass"
                    disabled={isSyncing}
                    onClick={() => void handleLoadFromGoogleDrive()}
                  >
                    <CloudDownload size={15} />
                    <span>Restore from Drive</span>
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </dialog>
  );
}
