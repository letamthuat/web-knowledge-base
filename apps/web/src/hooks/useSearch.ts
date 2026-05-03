"use client";

import { useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { api } from "@/_generated/api";

export type FilterType = "all" | "docs" | "notes" | "highlights";

export interface SearchFilter {
  type?: FilterType;
  format?: string;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useSearch(q: string, filter?: SearchFilter) {
  const debouncedQ = useDebounce(q, 200);
  const enabled = debouncedQ.length >= 2;
  const type = filter?.type ?? "all";
  const format = filter?.format;

  const skipDocs = !enabled || type === "notes" || type === "highlights";
  const skipNotes = !enabled || type === "docs" || type === "highlights";
  const skipHighlights = !enabled || type === "docs" || type === "notes";

  const docs = useQuery(
    api.documents.queries.search,
    skipDocs ? "skip" : { q: debouncedQ, ...(format ? { format } : {}) }
  ) ?? [];
  const notes = useQuery(api.notes.queries.search, skipNotes ? "skip" : { q: debouncedQ }) ?? [];
  const highlights = useQuery(api.highlights.queries.search, skipHighlights ? "skip" : { q: debouncedQ }) ?? [];

  const isLoading = enabled && (
    (!skipDocs && docs === undefined) ||
    (!skipNotes && notes === undefined) ||
    (!skipHighlights && highlights === undefined)
  );
  const hasResults = docs.length > 0 || notes.length > 0 || highlights.length > 0;

  return {
    docs: (docs ?? []).slice(0, 5),
    notes: (notes ?? []).slice(0, 5),
    highlights: (highlights ?? []).slice(0, 5),
    isLoading,
    hasResults,
    searched: enabled,
  };
}
