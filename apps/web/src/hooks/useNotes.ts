"use client";

import { useCallback } from "react";
import { Id } from "@/_generated/dataModel";
import {
  useNotesByDoc,
  useAllNotesWithDocTitle,
  createNote,
  updateNote as apiUpdateNote,
  removeNote as apiRemoveNote,
} from "@/lib/api/notes";

// Hình dạng note cho UI (giữ kiểu Id<> để các trang lớn chưa migrate vẫn compile).
type UINote = {
  _id: Id<"notes">;
  docId?: Id<"documents"> | null;
  highlightId?: Id<"highlights"> | null;
  title?: string;
  body: string;
  docTitle?: string | null;
  tagIds?: string[] | null;
  updatedAt: number;
  createdAt: number;
};

export function useNotes(docId: Id<"documents">) {
  const notes = (useNotesByDoc(docId) ?? []) as unknown as UINote[];

  const addNote = useCallback(
    (body: string, title?: string) =>
      createNote({ docId, body, title, clientMutationId: `${Date.now()}-${Math.random()}` }),
    [docId]
  );

  const updateNote = useCallback(
    (noteId: Id<"notes">, body: string, title?: string) => apiUpdateNote(noteId, body, title),
    []
  );

  const removeNote = useCallback((noteId: Id<"notes">) => apiRemoveNote(noteId), []);

  return { notes, addNote, updateNote, removeNote };
}

export function useAllNotes() {
  const notes = (useAllNotesWithDocTitle() ?? []) as unknown as UINote[];

  const addNote = useCallback(
    (body: string, title?: string, docId?: Id<"documents">) =>
      createNote({ body, title, docId, clientMutationId: `${Date.now()}-${Math.random()}` }),
    []
  );

  const updateNote = useCallback(
    (noteId: Id<"notes">, body: string, title?: string) => apiUpdateNote(noteId, body, title),
    []
  );

  const removeNote = useCallback((noteId: Id<"notes">) => apiRemoveNote(noteId), []);

  return { notes, addNote, updateNote, removeNote };
}
