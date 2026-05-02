"use client";

import { useQuery, useMutation } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";

export interface NoteTab {
  noteId: Id<"notes">;
  title: string;
  noteTabId: Id<"note_tabs">;
}

export function useNoteTabs() {
  const rawTabs = useQuery(api.note_tabs.queries.listByUser);
  const openTabMutation = useMutation(api.note_tabs.mutations.openTab);
  const closeTabMutation = useMutation(api.note_tabs.mutations.closeTab);
  const setActiveMutation = useMutation(api.note_tabs.mutations.setActive);
  const updateTitleMutation = useMutation(api.note_tabs.mutations.updateTitle);

  const noteTabs: NoteTab[] = useMemo(() =>
    (rawTabs ?? [])
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ noteId: t.noteId, title: t.title, noteTabId: t._id })),
    [rawTabs]
  );

  const activeNoteId = useMemo(() =>
    rawTabs?.find((t) => t.isActive)?.noteId ?? null,
    [rawTabs]
  );

  const openNoteTab = useCallback(
    (noteId: Id<"notes">, title: string) => openTabMutation({ noteId, title }),
    [openTabMutation]
  );

  const closeNoteTab = useCallback(
    (noteId: Id<"notes">) => {
      const tab = rawTabs?.find((t) => t.noteId === noteId);
      if (tab) closeTabMutation({ noteTabId: tab._id });
    },
    [rawTabs, closeTabMutation]
  );

  const setActiveNoteId = useCallback(
    (noteId: Id<"notes"> | null) => {
      if (!noteId) return;
      const tab = rawTabs?.find((t) => t.noteId === noteId);
      if (tab) setActiveMutation({ noteTabId: tab._id });
    },
    [rawTabs, setActiveMutation]
  );

  const updateNoteTabTitle = useCallback(
    (noteId: Id<"notes">, title: string) => {
      const tab = rawTabs?.find((t) => t.noteId === noteId);
      if (tab) updateTitleMutation({ noteTabId: tab._id, title });
    },
    [rawTabs, updateTitleMutation]
  );

  return { noteTabs, activeNoteId, openNoteTab, closeNoteTab, setActiveNoteId, updateNoteTabTitle };
}
