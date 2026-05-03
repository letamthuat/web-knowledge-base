"use client";

import { useQuery, useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple" | "custom";

export interface HighlightPosition {
  xpath: string;
  startOffset: number;
  endOffset: number;
  text: string;
}

export function useHighlights(docId: Id<"documents">) {
  const highlights = useQuery(api.highlights.queries.listByDoc, { docId }) ?? [];

  const createMutation = useMutation(api.highlights.mutations.create);
  const removeMutation = useMutation(api.highlights.mutations.remove);
  const updateNoteMutation = useMutation(api.highlights.mutations.updateNote);
  const createBookmarkMutation = useMutation(api.highlights.mutations.createBookmark);

  const addHighlight = useCallback(
    (color: HighlightColor, position: HighlightPosition, customColor?: string) =>
      createMutation({
        docId,
        color,
        customColor,
        positionType: "scroll_pct",
        positionValue: JSON.stringify(position),
        selectedText: position.text,
        clientMutationId: `${Date.now()}-${Math.random()}`,
      }),
    [docId, createMutation]
  );

  const removeHighlight = useCallback(
    (highlightId: Id<"highlights">) => removeMutation({ highlightId }),
    [removeMutation]
  );

  const updateNote = useCallback(
    (highlightId: Id<"highlights">, note?: string) =>
      updateNoteMutation({ highlightId, note }),
    [updateNoteMutation]
  );

  const addBookmark = useCallback(
    (scrollPct: number, headingId?: string, label?: string) =>
      createBookmarkMutation({
        docId,
        scrollPct,
        headingId,
        label,
        clientMutationId: `${Date.now()}-${Math.random()}`,
      }),
    [docId, createBookmarkMutation]
  );

  return { highlights, addHighlight, removeHighlight, updateNote, addBookmark };
}
