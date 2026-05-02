"use client";

import { useState, useCallback, useEffect } from "react";
import { Id } from "@/_generated/dataModel";

export interface NoteTab {
  noteId: Id<"notes">;
  title: string;
}

const STORAGE_KEY = "wkb_note_tabs";
const ACTIVE_KEY = "wkb_note_tab_active";

function load(): NoteTab[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(tabs: NoteTab[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
}

export function useNoteTabs() {
  const [tabs, setTabs] = useState<NoteTab[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<Id<"notes"> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setTabs(load());
    const active = localStorage.getItem(ACTIVE_KEY);
    if (active) setActiveNoteId(active as Id<"notes">);
  }, []);

  const openNoteTab = useCallback((noteId: Id<"notes">, title: string) => {
    setTabs((prev) => {
      const exists = prev.find((t) => t.noteId === noteId);
      const next = exists
        ? prev.map((t) => t.noteId === noteId ? { ...t, title } : t)
        : [...prev, { noteId, title }];
      save(next);
      return next;
    });
    setActiveNoteId(noteId);
    localStorage.setItem(ACTIVE_KEY, noteId);
  }, []);

  const closeNoteTab = useCallback((noteId: Id<"notes">, onEmpty?: () => void) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.noteId !== noteId);
      save(next);
      return next;
    });
    setActiveNoteId((prev) => {
      if (prev !== noteId) return prev;
      const remaining = load().filter((t) => t.noteId !== noteId);
      const nextActive = remaining[remaining.length - 1]?.noteId ?? null;
      if (nextActive) localStorage.setItem(ACTIVE_KEY, nextActive);
      else { localStorage.removeItem(ACTIVE_KEY); onEmpty?.(); }
      return nextActive;
    });
  }, []);

  const updateNoteTabTitle = useCallback((noteId: Id<"notes">, title: string) => {
    setTabs((prev) => {
      const next = prev.map((t) => t.noteId === noteId ? { ...t, title } : t);
      save(next);
      return next;
    });
  }, []);

  return { noteTabs: tabs, activeNoteId, openNoteTab, closeNoteTab, updateNoteTabTitle, setActiveNoteId };
}
