"use client";

/**
 * AnnotationOverlay — shared annotation UI for all text-based viewers.
 * Drop this inside a viewer's layout. It renders:
 *   HighlightLayer, HighlightMenu, NotePopover, NoteHoverCard,
 *   AnnotationPanel, DocNotePopover
 *
 * Accepts the return value of useHighlightActions() spread directly.
 */

import { Id } from "@/_generated/dataModel";
import { HighlightLayer } from "@/components/viewers/markdown/HighlightLayer";
import { HighlightMenu } from "@/components/viewers/markdown/HighlightMenu";
import { NotePopover } from "@/components/viewers/markdown/NotePopover";
import { NoteHoverCard } from "@/components/viewers/markdown/NoteHoverCard";
import { AnnotationPanel } from "@/components/viewers/markdown/AnnotationPanel";
import { DocNotePopover } from "@/components/viewers/markdown/DocNotePopover";
import type { HighlightColor } from "@/hooks/useHighlights";
import type {
  HlMenuState, NotePopoverState, NoteCardState, DocNotePopoverState,
} from "@/hooks/useHighlightActions";

interface AnnotationOverlayProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** Pass html/cleanHtml string so HighlightLayer re-applies marks after async DOM render */
  contentKey?: string | number;

  // Data
  highlights: any[];
  docNotes: any[];

  // Mutations
  addHighlight: (color: HighlightColor, pos: any, customColor?: string) => Promise<any>;
  removeHighlight: (id: Id<"highlights">) => Promise<void>;
  updateNote: (id: Id<"highlights">, note: string | undefined) => Promise<void>;
  addNote: (body: string, title?: string) => Promise<any>;
  updateDocNote: (id: Id<"notes">, body: string, title?: string) => Promise<void>;
  removeNote: (id: Id<"notes">) => Promise<void>;

  // UI state
  hlMenu: HlMenuState | null;
  setHlMenu: (v: HlMenuState | null) => void;
  notePopover: NotePopoverState | null;
  setNotePopover: (v: NotePopoverState | null) => void;
  notePanelOpen: boolean;
  setNotePanelOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  noteCard: NoteCardState | null;
  setNoteCard: (v: NoteCardState | null) => void;
  docNotePopover: DocNotePopoverState | null;
  setDocNotePopover: (v: DocNotePopoverState | null) => void;

  // Handlers
  handleClickHighlight: (id: Id<"highlights">, color: HighlightColor, x: number, y: number) => void;
  handleClickNoteHighlight: (id: Id<"highlights">, x: number, y: number) => void;
  openNotePopover: (id: Id<"highlights">, x: number, y: number) => void;
  scrollToHighlight: (id: Id<"highlights">) => void;
}

export function AnnotationOverlay({
  contentRef, highlights, docNotes, contentKey,
  addHighlight, removeHighlight, updateNote, addNote, updateDocNote, removeNote,
  hlMenu, setHlMenu, notePopover, setNotePopover,
  notePanelOpen, setNotePanelOpen, noteCard, setNoteCard,
  docNotePopover, setDocNotePopover,
  handleClickHighlight, handleClickNoteHighlight, openNotePopover, scrollToHighlight,
}: AnnotationOverlayProps) {
  return (
    <>
      {/* Highlight layer */}
      <HighlightLayer
        contentRef={contentRef}
        highlights={highlights.map((h) => ({ ...h, customColor: h.customColor }))}
        onClickHighlight={handleClickHighlight}
        onClickNoteHighlight={handleClickNoteHighlight}
        contentKey={contentKey}
      />

      {/* Floating highlight menu */}
      {hlMenu && (
        <HighlightMenu
          x={hlMenu.x}
          y={hlMenu.y}
          existingId={hlMenu.existingId}
          existingColor={hlMenu.existingColor}
          onSelectColor={(color, customColor) => {
            if (hlMenu.pendingPos) addHighlight(color, hlMenu.pendingPos, customColor).catch(() => {});
          }}
          onNoteAction={hlMenu.pendingPos ? () => {
            if (hlMenu.pendingPos) {
              addHighlight("purple", hlMenu.pendingPos)
                .then((id) => {
                  if (id) setNotePopover({ x: hlMenu.x, y: hlMenu.y, highlightId: id, initialNote: "" });
                })
                .catch(() => {});
            }
          } : undefined}
          onOpenNote={hlMenu.existingId
            ? () => openNotePopover(hlMenu.existingId!, hlMenu.x, hlMenu.y)
            : undefined}
          onDelete={hlMenu.existingId
            ? () => removeHighlight(hlMenu.existingId!).catch(() => {})
            : undefined}
          onClose={() => setHlMenu(null)}
        />
      )}

      {/* Note popover (highlight note) */}
      {notePopover && (
        <NotePopover
          x={notePopover.x}
          y={notePopover.y}
          initialNote={notePopover.initialNote}
          onSave={(note) => updateNote(notePopover.highlightId, note || undefined).catch(() => {})}
          onClose={() => setNotePopover(null)}
        />
      )}

      {/* Note card — click-to-show */}
      {noteCard && (() => {
        const h = highlights.find((hl) => hl._id === noteCard.highlightId);
        if (!h?.note) return null;
        return (
          <NoteHoverCard
            x={noteCard.x}
            y={noteCard.y}
            selectedText={h.selectedText ?? ""}
            note={h.note}
            color={h.color}
            onEdit={() => {
              setNoteCard(null);
              openNotePopover(noteCard.highlightId, noteCard.x, noteCard.y);
            }}
            onClose={() => setNoteCard(null)}
          />
        );
      })()}

      {/* Doc note popover */}
      {docNotePopover && (
        <DocNotePopover
          noteId={docNotePopover.noteId}
          initialBody={docNotePopover.initialBody}
          initialTitle={docNotePopover.initialTitle}
          onSave={(body, title) => {
            if (docNotePopover.noteId) {
              updateDocNote(docNotePopover.noteId, body, title).catch(() => {});
            } else {
              addNote(body, title).catch(() => {});
            }
          }}
          onDelete={docNotePopover.noteId
            ? () => removeNote(docNotePopover.noteId!).catch(() => {})
            : undefined}
          onClose={() => setDocNotePopover(null)}
        />
      )}
    </>
  );
}

/** The annotation panel sidebar — render at the flex row level (sibling of main content) */
export function AnnotationSidebar({
  highlights, docNotes, notePanelOpen, setNotePanelOpen,
  scrollToHighlight, openNotePopover, removeHighlight, updateNote, removeNote,
  setDocNotePopover, docNotes: _dn, ...rest
}: {
  highlights: any[];
  docNotes: any[];
  notePanelOpen: boolean;
  setNotePanelOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  scrollToHighlight: (id: Id<"highlights">) => void;
  openNotePopover: (id: Id<"highlights">, x: number, y: number) => void;
  removeHighlight: (id: Id<"highlights">) => Promise<void>;
  updateNote: (id: Id<"highlights">, note: string | undefined) => Promise<void>;
  removeNote: (id: Id<"notes">) => Promise<void>;
  setDocNotePopover: (v: DocNotePopoverState | null) => void;
}) {
  if (!notePanelOpen) return null;
  return (
    <AnnotationPanel
      highlights={highlights.map((h) => ({
        _id: h._id, color: h.color, customColor: h.customColor,
        selectedText: h.selectedText, note: h.note, createdAt: h.createdAt ?? 0,
      }))}
      docNotes={docNotes.map((n) => ({
        _id: n._id, title: n.title, body: n.body, createdAt: n.createdAt ?? 0,
      }))}
      onClose={() => setNotePanelOpen(false)}
      onScrollTo={scrollToHighlight}
      onEditHighlightNote={(id) => openNotePopover(id, window.innerWidth / 2, window.innerHeight / 2)}
      onDeleteHighlight={(id) => removeHighlight(id).catch(() => {})}
      onDeleteHighlightNote={(id) => updateNote(id, undefined).catch(() => {})}
      onDeleteHighlightRecord={(id) => removeHighlight(id).catch(() => {})}
      onAddDocNote={() => setDocNotePopover({ initialBody: "", initialTitle: "" })}
      onEditDocNote={(id) => {
        const n = docNotes.find((n) => n._id === id);
        if (n) setDocNotePopover({ noteId: id, initialBody: n.body, initialTitle: n.title });
      }}
      onDeleteDocNote={(id) => removeNote(id).catch(() => {})}
    />
  );
}
