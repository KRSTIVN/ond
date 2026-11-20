import { useMemo, useRef, useState } from 'react';
import {
  Bold,
  CheckSquare,
  Code,
  Download,
  Heading1,
  Heading2,
  Italic,
  List,
  Pin,
  Plus,
  Quote,
  Trash2,
} from 'lucide-react';
import { countWords, toggleChecklistAtLine } from '../../domain/notes/markdown';
import type { NoteItem } from '../../domain/types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface NotesViewProps {
  readonly notes: readonly NoteItem[];
  readonly activeNoteId: string | null;
  readonly onSelectNote: (id: string) => void;
  readonly onCreateNote: () => void;
  readonly onUpdateNote: (note: NoteItem) => void;
  readonly onDeleteNote: (id: string) => void;
}

type EditorMode = 'edit' | 'split' | 'preview';

export function NotesView({
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
}: NotesViewProps) {
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [editorMode, setEditorMode] = useState<EditorMode>('split');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const note of notes) {
      for (const tag of note.tags) tagSet.add(tag);
    }
    return Array.from(tagSet).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((note) => {
        if (selectedTag !== 'all' && !note.tags.includes(selectedTag)) return false;
        if (!q) return true;
        return (
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q) ||
          note.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .slice()
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [notes, query, selectedTag]);

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? filteredNotes[0] ?? null;

  const insertSnippet = (prefix: string, suffix = '', placeholder = 'text') => {
    if (!activeNote) return;
    const el = textareaRef.current;
    if (!el) {
      onUpdateNote({
        ...activeNote,
        content: `${activeNote.content}\n${prefix}${placeholder}${suffix}`,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = activeNote.content.slice(start, end) || placeholder;
    const nextContent =
      activeNote.content.slice(0, start) +
      prefix +
      selected +
      suffix +
      activeNote.content.slice(end);

    onUpdateNote({
      ...activeNote,
      content: nextContent,
      updatedAt: new Date().toISOString(),
    });

    window.requestAnimationFrame(() => {
      el.focus();
      const cursorPos = start + prefix.length + selected.length;
      el.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleExportMarkdown = () => {
    if (!activeNote) return;
    const safeName =
      activeNote.title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'note';
    const blob = new Blob([`# ${activeNote.title || 'Untitled Note'}\n\n${activeNote.content}`], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddTag = () => {
    if (!activeNote) return;
    const clean = tagDraft.trim().toLowerCase().replace(/^#/, '');
    if (!clean || activeNote.tags.includes(clean)) {
      setTagDraft('');
      return;
    }
    onUpdateNote({
      ...activeNote,
      tags: [...activeNote.tags, clean],
      updatedAt: new Date().toISOString(),
    });
    setTagDraft('');
  };

  return (
    <section className="workspace-panel-stage notes-shell" aria-label="Notes Workspace">
      <aside className="glass-surface notes-sidebar">
        <div className="notes-sidebar-top">
          <h2 className="panel-heading">Notes</h2>
          <button
            type="button"
            className="btn-primary is-compact"
            onClick={() => {
              onCreateNote();
              setConfirmDelete(false);
            }}
          >
            <Plus size={14} />
            <span>New Note</span>
          </button>
        </div>

        <input
          type="search"
          className="glass-input"
          aria-label="Search notes"
          placeholder="Search notes or tags..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {allTags.length > 0 && (
          <div className="tag-filter-row">
            <button
              type="button"
              className={`filter-pill ${selectedTag === 'all' ? 'is-active' : ''}`}
              onClick={() => setSelectedTag('all')}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`filter-pill ${selectedTag === tag ? 'is-active' : ''}`}
                onClick={() => setSelectedTag(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        <div className="notes-list scroller">
          {filteredNotes.length === 0 ? (
            <p className="notes-empty-hint">
              No notes yet. Click <strong>New Note</strong> to start a Markdown page.
            </p>
          ) : (
            filteredNotes.map((note) => {
              const isCurrent = activeNote?.id === note.id;
              return (
                <button
                  key={note.id}
                  type="button"
                  className={`note-list-item ${isCurrent ? 'is-active' : ''}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => {
                    onSelectNote(note.id);
                    setConfirmDelete(false);
                  }}
                >
                  <div className="note-item-head">
                    <strong className="note-item-title">{note.title || 'Untitled note'}</strong>
                    {note.pinned && <Pin size={12} className="text-indigo" />}
                  </div>
                  <span className="note-item-excerpt">
                    {note.content.replace(/[#*`>-]/g, '').trim() || 'Empty note'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <div className="glass-surface notes-editor-panel">
        {!activeNote ? (
          <div className="notes-blank-state">
            <p>Select a note or create a fresh Markdown page with live preview and checklists.</p>
            <button type="button" className="btn-primary" onClick={onCreateNote}>
              <Plus size={15} />
              <span>Create First Note</span>
            </button>
          </div>
        ) : (
          <>
            <div className="notes-header-row">
              <input
                type="text"
                className="note-title-input"
                aria-label="Note title"
                placeholder="Note title..."
                value={activeNote.title}
                onChange={(e) =>
                  onUpdateNote({
                    ...activeNote,
                    title: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
              />

              <div className="notes-header-actions">
                <button
                  type="button"
                  className={`btn-glass is-compact ${activeNote.pinned ? 'is-pinned' : ''}`}
                  onClick={() =>
                    onUpdateNote({
                      ...activeNote,
                      pinned: !activeNote.pinned,
                      updatedAt: new Date().toISOString(),
                    })
                  }
                >
                  <Pin size={13} />
                  <span>{activeNote.pinned ? 'Pinned' : 'Pin'}</span>
                </button>

                <div className="filter-group" role="group" aria-label="Editor view mode">
                  {(['edit', 'split', 'preview'] as readonly EditorMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`filter-pill ${editorMode === mode ? 'is-active' : ''}`}
                      onClick={() => setEditorMode(mode)}
                    >
                      {mode[0]!.toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-glass is-compact"
                  onClick={handleExportMarkdown}
                >
                  <Download size={13} />
                  <span>.md</span>
                </button>

                {!confirmDelete ? (
                  <button
                    type="button"
                    className="btn-danger-ghost is-compact"
                    aria-label="Delete note"
                    title="Delete note"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={13} />
                  </button>
                ) : (
                  <div className="inline-confirm">
                    <button
                      type="button"
                      className="btn-danger-solid is-compact"
                      onClick={() => {
                        onDeleteNote(activeNote.id);
                        setConfirmDelete(false);
                      }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="btn-ghost is-compact"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="notes-format-bar">
              <button
                type="button"
                className="btn-glass is-compact"
                title="Heading 1"
                aria-label="Insert Heading 1"
                onClick={() => insertSnippet('# ', '', 'Heading')}
              >
                <Heading1 size={13} />
              </button>
              <button
                type="button"
                className="btn-glass is-compact"
                title="Heading 2"
                aria-label="Insert Heading 2"
                onClick={() => insertSnippet('## ', '', 'Section')}
              >
                <Heading2 size={13} />
              </button>
              <button
                type="button"
                className="btn-glass is-compact"
                title="Bold"
                aria-label="Insert Bold"
                onClick={() => insertSnippet('**', '**', 'bold')}
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                className="btn-glass is-compact"
                title="Italic"
                aria-label="Insert Italic"
                onClick={() => insertSnippet('*', '*', 'italic')}
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                className="btn-glass is-compact"
                title="Bullet List"
                aria-label="Insert Bullet List"
                onClick={() => insertSnippet('\n- ', '', 'List item')}
              >
                <List size={13} />
              </button>
              <button
                type="button"
                className="btn-glass is-compact"
                title="Checklist"
                aria-label="Insert Checklist Item"
                onClick={() => insertSnippet('\n- [ ] ', '', 'Action item')}
              >
                <CheckSquare size={13} />
              </button>
              <button
                type="button"
                className="btn-glass is-compact"
                title="Quote"
                aria-label="Insert Blockquote"
                onClick={() => insertSnippet('\n> ', '', 'Quote')}
              >
                <Quote size={13} />
              </button>
              <button
                type="button"
                className="btn-glass is-compact"
                title="Inline Code"
                aria-label="Insert Inline Code"
                onClick={() => insertSnippet('`', '`', 'code')}
              >
                <Code size={13} />
              </button>

              <div className="note-tags-inline">
                {activeNote.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="note-tag-chip"
                    title="Click to remove tag"
                    onClick={() =>
                      onUpdateNote({
                        ...activeNote,
                        tags: activeNote.tags.filter((t) => t !== tag),
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  >
                    #{tag} ×
                  </button>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddTag();
                  }}
                >
                  <input
                    type="text"
                    className="note-tag-input"
                    aria-label="Add tag"
                    placeholder="+ tag"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                  />
                </form>
              </div>
            </div>

            <div className={`notes-panes is-mode-${editorMode}`}>
              {editorMode !== 'preview' && (
                <textarea
                  ref={textareaRef}
                  className="note-textarea scroller"
                  aria-label="Markdown editor"
                  placeholder="Write your note in Markdown..."
                  value={activeNote.content}
                  onChange={(e) =>
                    onUpdateNote({
                      ...activeNote,
                      content: e.target.value,
                      updatedAt: new Date().toISOString(),
                    })
                  }
                />
              )}

              {editorMode !== 'edit' && (
                <MarkdownRenderer
                  content={activeNote.content}
                  onToggleChecklistLine={(lineIndex) =>
                    onUpdateNote({
                      ...activeNote,
                      content: toggleChecklistAtLine(activeNote.content, lineIndex),
                      updatedAt: new Date().toISOString(),
                    })
                  }
                />
              )}
            </div>

            <div className="notes-status-bar">
              <span className="mono-num">
                {countWords(activeNote.content)} words · {activeNote.content.length} chars
              </span>
              <span>Saved locally</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
