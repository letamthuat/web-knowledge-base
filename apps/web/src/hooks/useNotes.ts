"use client";

import { useQuery, useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";

export function useNotes(docId: Id<"documents">) {
  const notes = useQuery(api.notes.queries.listByDoc, { docId }) ?? [];

  const createMutation = useMutation(api.notes.mutations.create);
  const updateMutation = useMutation(api.notes.mutations.update);
  const removeMutation = useMutation(api.notes.mutations.remove);

  const addNote = useCallback(
    (body: string, title?: string) =>
      createMutation({ docId, body, title, clientMutationId: `${Date.now()}-${Math.random()}` }),
    [docId, createMutation]
  );

  const updateNote = useCallback(
    (noteId: Id<"notes">, body: string, title?: string) =>
      updateMutation({ noteId, body, title }),
    [updateMutation]
  );

  const removeNote = useCallback(
    (noteId: Id<"notes">) => removeMutation({ noteId }),
    [removeMutation]
  );

  return { notes, addNote, updateNote, removeNote };
}
