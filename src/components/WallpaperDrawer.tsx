import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Check,
  ImagePlus,
  Link2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { UI_THEME_PRESETS } from '../domain/themes';
import {
  sanitizeHttpUrl,
  type BoardPreferences,
  type UiThemeId,
} from '../domain/types';
import {
  CUSTOM_UPLOAD_WALLPAPER_ID,
  CUSTOM_URL_WALLPAPER_ID,
  WALLPAPER_PRESETS,
} from '../domain/wallpapers';
import { useDialogModal } from '../hooks/useDialogModal';

interface WallpaperDrawerProps {
  readonly open: boolean;
  readonly preferences: BoardPreferences;
  readonly customUploadDataUrl: string | null;
  readonly onClose: () => void;
  readonly onSelectUiTheme: (themeId: UiThemeId) => void;
  readonly onSelectDefaultTab: (tab: 'kanban' | 'dashboard') => void;
  readonly onSelectPreset: (wallpaperId: string) => void;
  readonly onUploadWallpaper: (file: File) => Promise<void>;
  readonly onClearCustomUpload: () => Promise<void>;
  readonly onApplyCustomUrl: (url: string) => void;
  readonly onUpdateVisuals: (patch: Pick<BoardPreferences, 'dimOpacity' | 'glassBlur'>) => void;
}

export function WallpaperDrawer({
  open,
  preferences,
  customUploadDataUrl,
  onClose,
  onSelectUiTheme,
  onSelectDefaultTab,
  onSelectPreset,
  onUploadWallpaper,
  onClearCustomUpload,
  onApplyCustomUrl,
  onUpdateVisuals,
}: WallpaperDrawerProps) {
  const titleId = useId();
  const dialogRef = useDialogModal({ open, onClose });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [urlInput, setUrlInput] = useState(preferences.customWallpaperUrl);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUrlInput(preferences.customWallpaperUrl);
    setUploadError(null);
  }, [open, preferences.customWallpaperUrl]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a PNG, JPG, or WebP image file.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError('Image exceeds 15 MB limit. Try a smaller wallpaper file.');
      return;
    }

    setUploadError(null);
    try {
      await onUploadWallpaper(file);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to save wallpaper locally.';
      setUploadError(msg);
    } finally {
      event.target.value = '';
    }
  };

  const handleUrlSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const safeUrl = sanitizeHttpUrl(urlInput);
    if (!safeUrl) {
      setUploadError('Enter a valid http:// or https:// image URL.');
      return;
    }
    setUploadError(null);
    onApplyCustomUrl(safeUrl);
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog wallpaper-drawer"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="modal-header">
        <div>
          <h2 id={titleId} className="modal-title">
            Themes &amp; Wallpapers
          </h2>
          <p className="modal-subtitle">
            Switch UI style variations, startup view, backdrops, and glass optics.
          </p>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close appearance studio"
        >
          <X size={18} />
        </button>
      </div>

      <div className="modal-body scroller">
        <section className="drawer-section">
          <h3 className="drawer-section-title">
            <Sparkles size={13} />
            <span>UI Style Variations</span>
          </h3>

          <div className="ui-theme-grid">
            {UI_THEME_PRESETS.map((theme) => {
              const active = preferences.uiTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`ui-theme-tile ${active ? 'is-active' : ''}`}
                  onClick={() => onSelectUiTheme(theme.id)}
                >
                  <span
                    className="ui-theme-swatch"
                    style={{
                      background: theme.previewGradient,
                      borderColor: theme.accentBorder,
                    }}
                  >
                    <span className="ui-theme-demo-pill" />
                    <span className="wallpaper-tag">{theme.tag}</span>
                    {active && (
                      <span className="wallpaper-check" aria-hidden="true">
                        <Check size={13} />
                      </span>
                    )}
                  </span>
                  <span className="wallpaper-name">{theme.name}</span>
                  <span className="ui-theme-desc">{theme.description}</span>
                </button>
              );
            })}
          </div>

          <div className="startup-view-row">
            <span className="startup-view-label">Startup View</span>
            <div className="filter-group" role="group" aria-label="Default startup view">
              <button
                type="button"
                className={`filter-pill ${preferences.defaultTab === 'kanban' ? 'is-active' : ''}`}
                onClick={() => onSelectDefaultTab('kanban')}
              >
                Kanban Board
              </button>
              <button
                type="button"
                className={`filter-pill ${preferences.defaultTab === 'dashboard' ? 'is-active' : ''}`}
                onClick={() => onSelectDefaultTab('dashboard')}
              >
                Spatial Dashboard
              </button>
            </div>
          </div>
        </section>

        <section className="drawer-section">
          <h3 className="drawer-section-title">Curated Backdrops</h3>
          <div className="wallpaper-grid">
            {WALLPAPER_PRESETS.map((preset) => {
              const active = preferences.wallpaperId === preset.id;
              const previewStyle =
                preset.kind === 'image'
                  ? { backgroundImage: `url(${preset.src})` }
                  : { background: preset.css };

              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`wallpaper-tile ${active ? 'is-active' : ''}`}
                  onClick={() => onSelectPreset(preset.id)}
                >
                  <span className="wallpaper-preview" style={previewStyle}>
                    <span className="wallpaper-tag">{preset.tag}</span>
                    {active && (
                      <span className="wallpaper-check" aria-hidden="true">
                        <Check size={14} />
                      </span>
                    )}
                  </span>
                  <span className="wallpaper-name">{preset.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="drawer-section">
          <h3 className="drawer-section-title">Custom Wallpaper</h3>

          <div className="upload-zone">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="visually-hidden"
            />
            <button
              type="button"
              className="btn-glass is-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={16} />
              <span>Upload Wallpaper Image (PNG / JPG / WebP)</span>
            </button>

            {customUploadDataUrl && (
              <div className="custom-upload-card">
                <button
                  type="button"
                  className={`wallpaper-tile is-wide ${
                    preferences.wallpaperId === CUSTOM_UPLOAD_WALLPAPER_ID ? 'is-active' : ''
                  }`}
                  onClick={() => onSelectPreset(CUSTOM_UPLOAD_WALLPAPER_ID)}
                >
                  <span
                    className="wallpaper-preview"
                    style={{ backgroundImage: `url(${customUploadDataUrl})` }}
                  >
                    <span className="wallpaper-tag">Uploaded</span>
                    {preferences.wallpaperId === CUSTOM_UPLOAD_WALLPAPER_ID && (
                      <span className="wallpaper-check" aria-hidden="true">
                        <Check size={14} />
                      </span>
                    )}
                  </span>
                  <span className="wallpaper-name">Your Uploaded Wallpaper</span>
                </button>
                <button
                  type="button"
                  className="btn-danger-ghost is-compact"
                  onClick={() => void onClearCustomUpload()}
                  title="Remove uploaded wallpaper"
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              </div>
            )}

            {uploadError && <p className="inline-error">{uploadError}</p>}
          </div>

          <form className="url-wallpaper-form" onSubmit={handleUrlSubmit}>
            <label className="form-field is-full">
              <span>Or paste an image URL</span>
              <div className="url-input-row">
                <Link2 size={14} className="url-icon" aria-hidden="true" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                />
                <button type="submit" className="btn-glass">
                  Apply
                </button>
              </div>
            </label>
            {preferences.wallpaperId === CUSTOM_URL_WALLPAPER_ID && preferences.customWallpaperUrl && (
              <span className="hint-badge">Custom URL active</span>
            )}
          </form>
        </section>

        <section className="drawer-section">
          <h3 className="drawer-section-title">
            <SlidersHorizontal size={14} />
            <span>Glass &amp; Readability</span>
          </h3>

          <div className="slider-group">
            <label className="slider-field">
              <div className="slider-label-row">
                <span>Backdrop Dimming</span>
                <strong>{Math.round(preferences.dimOpacity * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0"
                max="0.85"
                step="0.02"
                value={preferences.dimOpacity}
                onChange={(e) =>
                  onUpdateVisuals({
                    dimOpacity: Number(e.target.value),
                    glassBlur: preferences.glassBlur,
                  })
                }
              />
            </label>

            <label className="slider-field">
              <div className="slider-label-row">
                <span>Glass Blur</span>
                <strong>{preferences.glassBlur}px</strong>
              </div>
              <input
                type="range"
                min="4"
                max="32"
                step="1"
                value={preferences.glassBlur}
                onChange={(e) =>
                  onUpdateVisuals({
                    dimOpacity: preferences.dimOpacity,
                    glassBlur: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
        </section>
      </div>
    </dialog>
  );
}
