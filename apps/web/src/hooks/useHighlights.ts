"use client";

import { useQuery, useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";

export type HighlightColor = "yellow" | "green" | "blue" | "pink";

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

  const addHighlight = useCallback(
    (color: HighlightColor, position: HighlightPosition) =>
      createMutation({
        docId,
        color,
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

  return { highlights, addHighlight, removeHighlight };
}
