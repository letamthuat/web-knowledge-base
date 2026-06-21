"use client";

import { useCallback, useMemo } from "react";
import { Id } from "@/_generated/dataModel";
import {
  useNoteTabsList,
  openNoteTab as apiOpenTab,
  closeNoteTab as apiCloseTab,
  setNoteTabActive as apiSetActive,
  updateNoteTabTitle as apiUpdateTitle,
} from "@/lib/api/note-tabs";

export interface NoteTab {
  noteId: Id<"notes">;
  title: string;
  noteTabId: Id<"note_tabs">;
}

export function useNoteTabs() {
  const rawTabs = useNoteTabsList();

  const noteTabs: NoteTab[] = useMemo(
    () =>
      (rawTabs ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((t) => ({
          noteId: t.noteId as Id<"notes">,
          title: t.title,
          noteTabId: t._id as Id<"note_tabs">,
        })),
    [rawTabs]
  );

  const activeNoteId = useMemo(
    () => (rawTabs?.find((t) => t.isActive)?.noteId as Id<"notes"> | undefined) ?? null,
    [rawTabs]
  );

  const openNoteTab = useCallback(
    (noteId: Id<"notes">, title: string) => apiOpenTab(noteId, title),
    []
  );

  const closeNoteTab = useCallback(
    (noteId: Id<"notes">) => {
      const tab = rawTabs?.find((t) => t.noteId === noteId);
      if (tab) return apiCloseTab(tab._id);
    },
    [rawTabs]
  );

  const setActiveNoteId = useCallback(
    (noteId: Id<"notes"> | null) => {
      if (!noteId) return;
      const tab = rawTabs?.find((t) => t.noteId === noteId);
      if (tab) return apiSetActive(tab._id);
    },
    [rawTabs]
  );

  const updateNoteTabTitle = useCallback(
    (noteId: Id<"notes">, title: string) => {
      const tab = rawTabs?.find((t) => t.noteId === noteId);
      if (tab) return apiUpdateTitle(tab._id, title);
    },
    [rawTabs]
  );

  return { noteTabs, activeNoteId, openNoteTab, closeNoteTab, setActiveNoteId, updateNoteTabTitle };
}
