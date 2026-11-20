import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import {
  Check,
  ClipboardCopy,
  Code2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { STATUS_TITLES } from '../domain/columns';
import {
  buildAppsScriptBridge,
  parseLeadsFromText,
  resolveGoogleSheetCsvUrl,
  serializeLeadsToCsv,
  serializeLeadsToTsv,
} from '../domain/csvSync';
import { downloadExcelFile } from '../domain/excelSync';
import { createSampleLeads } from '../domain/sampleData';
import type { BoardPreferences, LeadCard } from '../domain/types';
import {
  importSpreadsheetFile,
  isFileSystemAccessSupported,
  type ConnectedSpreadsheetFile,
} from '../infra/fileBridge';
import { useDialogModal } from '../hooks/useDialogModal';

interface SheetSyncModalProps {
  readonly open: boolean;
  readonly leads: readonly LeadCard[];
  readonly preferences: BoardPreferences;
  readonly connectedFile: ConnectedSpreadsheetFile | null;
  readonly hasUnsavedFileChanges: boolean;
  readonly onClose: () => void;
  readonly onConnectLocalFile: () => Promise<void>;
  readonly onSaveConnectedFile: () => Promise<void>;
  readonly onDisconnectLocalFile: () => void;
  readonly onReplaceLeads: (leads: LeadCard[], summary: string) => void;
  readonly onClearBoard: () => void;
  readonly onUpdateSettings: (
    patch: Partial<
      Pick<BoardPreferences, 'boardTitle' | 'googleSheetUrl' | 'appsScriptUrl' | 'csvPublishUrl'>
    >,
  ) => void;
}

export function SheetSyncModal({
  open,
  leads,
  preferences,
  connectedFile,
  hasUnsavedFileChanges,
  onClose,
  onConnectLocalFile,
  onSaveConnectedFile,
  onDisconnectLocalFile,
  onReplaceLeads,
  onClearBoard,
  onUpdateSettings,
}: SheetSyncModalProps) {
  const titleId = useId();
  const dialogRef = useDialogModal({ open, onClose });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [boardTitleInput, setBoardTitleInput] = useState(preferences.boardTitle);
  const [sheetUrlInput, setSheetUrlInput] = useState(preferences.googleSheetUrl);
  const [csvUrlInput, setCsvUrlInput] = useState(preferences.csvPublishUrl);
  const [appsScriptUrl, setAppsScriptUrl] = useState(preferences.appsScriptUrl);
  const [pasteText, setPasteText] = useState('');
  const [copiedTsv, setCopiedTsv] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const supportsLiveFilePicker = isFileSystemAccessSupported();

  useEffect(() => {
    if (!open) return;
    setBoardTitleInput(preferences.boardTitle);
    setSheetUrlInput(preferences.googleSheetUrl);
    setCsvUrlInput(preferences.csvPublishUrl);
    setAppsScriptUrl(preferences.appsScriptUrl);
    setConfirmingClear(false);
  }, [open, preferences]);

  const handleSaveIdentity = () => {
    const cleanTitle = boardTitleInput.trim() || 'SheetKanban';
    const cleanUrl = sheetUrlInput.trim();
    onUpdateSettings({ boardTitle: cleanTitle, googleSheetUrl: cleanUrl });
    setErrorMessage(null);
    setStatusMessage('Saved board title and Google Sheet link locally.');
  };

  const handleCopyTsv = async () => {
    try {
      await navigator.clipboard.writeText(serializeLeadsToTsv(leads));
      setCopiedTsv(true);
      setErrorMessage(null);
      setStatusMessage('Copied TSV! Select cell A1 in Google Sheets or Excel and press Ctrl+V.');
      window.setTimeout(() => setCopiedTsv(false), 2400);
    } catch {
      setErrorMessage('Clipboard access was blocked by the browser. Use Download .xlsx or CSV.');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const slug = (preferences.boardTitle || 'sheet-kanban')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      await downloadExcelFile(leads, `${slug || 'sheet-kanban'}.xlsx`);
      setErrorMessage(null);
      setStatusMessage('Downloaded Excel (.xlsx) workbook with Status, Deal Value, and Follow-up.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Excel export failed.';
      setErrorMessage(msg);
    }
  };

  const handleDownloadCsv = () => {
    const csv = serializeLeadsToCsv(leads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sheet-kanban-leads.csv';
    link.click();
    URL.revokeObjectURL(url);
    setErrorMessage(null);
    setStatusMessage('Downloaded CSV with Status, Deal Value, and Follow-up columns.');
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await importSpreadsheetFile(file, leads);
    event.target.value = '';

    if (!result.ok || !result.data) {
      setErrorMessage(result.error ?? 'Unable to import spreadsheet file.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(`Imported ${result.data.length} cards from ${file.name}.`);
    onReplaceLeads(result.data, `Imported ${result.data.length} cards from ${file.name}`);
  };

  const handleImportPaste = () => {
    const result = parseLeadsFromText(pasteText, leads);
    if (!result.ok || !result.data) {
      setErrorMessage(result.error ?? 'Could not parse pasted spreadsheet cells.');
      return;
    }
    setPasteText('');
    setErrorMessage(null);
    setStatusMessage(`Imported ${result.data.length} cards from pasted cells.`);
    onReplaceLeads(result.data, `Imported ${result.data.length} cards`);
  };

  const handlePullCsvUrl = async () => {
    const resolved = resolveGoogleSheetCsvUrl(csvUrlInput || sheetUrlInput);
    if (!resolved) {
      setErrorMessage('Enter a Google Sheet URL (shared as "Anyone with link" or Published to Web as CSV).');
      return;
    }

    onUpdateSettings({ csvPublishUrl: csvUrlInput.trim() || sheetUrlInput.trim() });
    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const response = await fetch(resolved);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const csvText = await response.text();
      const parsed = parseLeadsFromText(csvText, leads);
      if (!parsed.ok || !parsed.data) {
        throw new Error(parsed.error ?? 'Could not parse CSV response.');
      }

      setStatusMessage(`Pulled ${parsed.data.length} cards from Google Sheets CSV.`);
      onReplaceLeads(parsed.data, `Pulled ${parsed.data.length} cards from Google Sheets`);
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
    const endpoint = appsScriptUrl.trim();
    if (!endpoint) {
      setErrorMessage('Paste your deployed Google Apps Script Web App URL first.');
      return;
    }

    onUpdateSettings({ appsScriptUrl: endpoint });
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
        STATUS_TITLES[lead.status],
        lead.dealValue ?? '',
        lead.followUpDate,
      ]);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ rows }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setStatusMessage(`Pushed ${leads.length} cards directly to your Google Sheet!`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error';
      setErrorMessage(`Push failed (${msg}). Verify Apps Script is deployed as "Anyone".`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromAppsScript = async () => {
    const endpoint = appsScriptUrl.trim();
    if (!endpoint) {
      setErrorMessage('Paste your deployed Google Apps Script Web App URL first.');
      return;
    }

    onUpdateSettings({ appsScriptUrl: endpoint });
    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { rows?: unknown[][] };
      if (!Array.isArray(payload.rows)) {
        throw new Error('Unexpected response format (expected { rows: [...] })');
      }

      const tsv = payload.rows
        .map((row) => row.map((cell) => String(cell ?? '').replace(/\t/g, ' ')).join('\t'))
        .join('\n');
      const parsed = parseLeadsFromText(tsv, leads);

      if (!parsed.ok || !parsed.data) {
        throw new Error(parsed.error ?? 'Failed to parse sheet rows');
      }

      setStatusMessage(`Pulled ${parsed.data.length} cards from your Google Sheet.`);
      onReplaceLeads(parsed.data, `Pulled ${parsed.data.length} cards from Google Sheet`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error';
      setErrorMessage(`Pull failed (${msg}).`);
    } finally {
      setIsSyncing(false);
    }
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
            Google Sheets &amp; Excel Connector
          </h2>
          <p className="modal-subtitle">
            All data stays private in your browser and your own spreadsheets ({leads.length} active cards).
          </p>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close connector modal"
        >
          <X size={18} />
        </button>
      </div>

      <div className="modal-body scroller">
        {statusMessage && <div className="banner-success">{statusMessage}</div>}
        {errorMessage && <div className="banner-error">{errorMessage}</div>}

        <section className="sync-card">
          <h3>Board Settings (Saved Locally Only)</h3>
          <div className="form-grid">
            <label className="form-field">
              <span>Board Title</span>
              <input
                type="text"
                value={boardTitleInput}
                onChange={(e) => setBoardTitleInput(e.target.value)}
                placeholder="SheetKanban"
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
            {preferences.googleSheetUrl && (
              <a
                className="btn-ghost is-compact"
                href={preferences.googleSheetUrl}
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

          <div className="sync-action-row">
            {supportsLiveFilePicker && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => void onConnectLocalFile()}
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
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="visually-hidden"
              onChange={(e) => void handleImportFile(e)}
            />
            <button
              type="button"
              className="btn-glass"
              onClick={() => fileInputRef.current?.click()}
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
              onReplaceLeads(createSampleLeads(), 'Loaded 4 sample demo cards');
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
      </div>
    </dialog>
  );
}
