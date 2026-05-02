"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Id } from "@/_generated/dataModel";
import { useHighlights, type HighlightColor, type HighlightPosition } from "@/hooks/useHighlights";
import { useNotes } from "@/hooks/useNotes";

export interface HlMenuState {
  x: number; y: number;
  existingId?: Id<"highlights">; existingColor?: HighlightColor;
  pendingPos?: HighlightPosition;
}

export interface NotePopoverState {
  x: number; y: number;
  highlightId: Id<"highlights">;
  initialNote: string;
}

export interface NoteCardState {
  x: number; y: number;
  highlightId: Id<"highlights">;
}

export interface DocNotePopoverState {
  noteId?: Id<"notes">;
  initialBody: string;
  initialTitle?: string;
}

/** Extracts XPath of node relative to root */
export function getXPath(node: Node, root: Node): string {
  if (node === root) return ".";
  const parts: string[] = [];
  let cur: Node | null = node;
  while (cur && cur !== root) {
    if (cur.nodeType === Node.ELEMENT_NODE) {
      const el = cur as Element;
      const tag = el.tagName.toLowerCase();
      let idx = 1;
      let sib = el.previousElementSibling;
      while (sib) { if (sib.tagName === el.tagName) idx++; sib = sib.previousElementSibling; }
      parts.unshift(`${tag}[${idx}]`);
    }
    cur = cur.parentNode;
  }
  return parts.length ? parts.join("/") : ".";
}

export function useHighlightActions(
  docId: Id<"documents">,
  contentRef: React.RefObject<HTMLDivElement | null>,
) {
  const { highlights, addHighlight, removeHighlight, updateNote } = useHighlights(docId);
  const { notes: docNotes, addNote, updateNote: updateDocNote, removeNote } = useNotes(docId);

  const [hlMenu, setHlMenu] = useState<HlMenuState | null>(null);
  const [notePopover, setNotePopover] = useState<NotePopoverState | null>(null);
  const [notePanelOpen, setNotePanelOpen] = useState(false);
  const [noteCard, setNoteCard] = useState<NoteCardState | null>(null);
  const [docNotePopover, setDocNotePopover] = useState<DocNotePopoverState | null>(null);

  // ── Mouse up: capture selection ──
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const text = range.toString().trim();
    if (!text) return;
    const el = contentRef.current;
    if (!el || !el.contains(range.commonAncestorContainer)) return;

    const ancestor = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentNode!
      : range.commonAncestorContainer;
    const xpath = getXPath(ancestor, el);
    const startOffset = range.startOffset + (range.startContainer !== ancestor
      ? (ancestor.textContent ?? "").indexOf(range.startContainer.textContent ?? "")
      : 0);

    const pos: HighlightPosition = {
      xpath,
      startOffset: Math.max(0, startOffset),
      endOffset: Math.max(0, startOffset + text.length),
      text,
    };
    setHlMenu({ x: e.clientX, y: e.clientY, pendingPos: pos });
    sel.removeAllRanges();
  }, [contentRef]);

  // ── Click existing highlight ──
  const handleClickHighlight = useCallback(
    (id: Id<"highlights">, color: HighlightColor, x: number, y: number) => {
      setHlMenu({ x, y, existingId: id, existingColor: color });
    }, []
  );

  // ── Click highlight with note → show note card ──
  const handleClickNoteHighlight = useCallback(
    (id: Id<"highlights">, x: number, y: number) => {
      setNoteCard({ x, y, highlightId: id });
    }, []
  );

  // ── Open note popover for a highlight ──
  const openNotePopover = useCallback(
    (highlightId: Id<"highlights">, x: number, y: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const h = (highlights as any[]).find((hl) => hl._id === highlightId);
      setNotePopover({ x, y, highlightId, initialNote: (h?.note as string | undefined) ?? "" });
    }, [highlights]
  );

  // ── Scroll to highlight in content ──
  const scrollToHighlight = useCallback((highlightId: Id<"highlights">) => {
    const el = contentRef.current;
    if (!el) return;
    const mark = el.querySelector(`mark[data-highlight-id="${highlightId}"]`) as HTMLElement | null;
    if (mark) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      mark.style.outline = "2px solid #7c3aed";
      mark.style.outlineOffset = "2px";
      setTimeout(() => { mark.style.outline = ""; mark.style.outlineOffset = ""; }, 1200);
    }
  }, [contentRef]);

  // ── Ctrl/Cmd+N shortcut ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "n" && hlMenu?.existingId) {
        e.preventDefault();
        openNotePopover(hlMenu.existingId, hlMenu.x, hlMenu.y);
        setHlMenu(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hlMenu, openNotePopover]);

  return {
    // Data
    highlights,
    docNotes,
    // Mutations
    addHighlight,
    removeHighlight,
    updateNote,
    addNote,
    updateDocNote,
    removeNote,
    // UI state
    hlMenu, setHlMenu,
    notePopover, setNotePopover,
    notePanelOpen, setNotePanelOpen,
    noteCard, setNoteCard,
    docNotePopover, setDocNotePopover,
    // Handlers
    handleMouseUp,
    handleClickHighlight,
    handleClickNoteHighlight,
    openNotePopover,
    scrollToHighlight,
  };
}
