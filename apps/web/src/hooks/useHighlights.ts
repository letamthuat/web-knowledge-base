"use client";

import { useCallback } from "react";
import { Id } from "@/_generated/dataModel";
import {
  useHighlightsByDoc,
  createHighlight,
  removeHighlight as apiRemoveHighlight,
  updateHighlightNote,
  createBookmark,
  type HighlightColor,
} from "@/lib/api/highlights";

export type { HighlightColor } from "@/lib/api/highlights";

export interface HighlightPosition {
  xpath: string;
  startOffset: number;
  endOffset: number;
  text: string;
}

// Hình dạng highlight cho UI (giữ Id<> cho trang lớn chưa migrate).
type UIHighlight = {
  _id: Id<"highlights">;
  docId: Id<"documents">;
  color: HighlightColor;
  type: "text" | "bookmark" | "timestamp";
  positionType: string;
  positionValue: string;
  selectedText?: string | null;
  note?: string | null;
  customColor?: string | null;
  updatedAt: number;
  createdAt: number;
};

export function useHighlights(docId: Id<"documents">) {
  const highlights = (useHighlightsByDoc(docId) ?? []) as unknown as UIHighlight[];

  const addHighlight = useCallback(
    (color: HighlightColor, position: HighlightPosition, customColor?: string) =>
      createHighlight({
        docId,
        color,
        customColor,
        positionType: "scroll_pct",
        positionValue: JSON.stringify(position),
        selectedText: position.text,
        clientMutationId: `${Date.now()}-${Math.random()}`,
      }),
    [docId]
  );

  const removeHighlight = useCallback(
    (highlightId: Id<"highlights">) => apiRemoveHighlight(highlightId),
    []
  );

  const updateNote = useCallback(
    (highlightId: Id<"highlights">, note?: string) => updateHighlightNote(highlightId, note),
    []
  );

  const addBookmark = useCallback(
    (scrollPct: number, headingId?: string, label?: string) =>
      createBookmark({
        docId,
        scrollPct,
        headingId,
        label,
        clientMutationId: `${Date.now()}-${Math.random()}`,
      }),
    [docId]
  );

  return { highlights, addHighlight, removeHighlight, updateNote, addBookmark };
}
