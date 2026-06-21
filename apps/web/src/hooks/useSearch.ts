"use client";

import { useState, useEffect } from "react";
import {
  searchDocuments, searchNotes, searchHighlights,
  type DocSearchRow, type NoteSearchRow, type HighlightSearchRow,
} from "@/lib/api/search";

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

  const [docs, setDocs] = useState<DocSearchRow[]>([]);
  const [notes, setNotes] = useState<NoteSearchRow[]>([]);
  const [highlights, setHighlights] = useState<HighlightSearchRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDocs([]); setNotes([]); setHighlights([]); setIsLoading(false);
      return;
    }
    let active = true;
    const wantDocs = type === "all" || type === "docs";
    const wantNotes = type === "all" || type === "notes";
    const wantHl = type === "all" || type === "highlights";
    setIsLoading(true);
    Promise.all([
      wantDocs ? searchDocuments(debouncedQ, format) : Promise.resolve<DocSearchRow[]>([]),
      wantNotes ? searchNotes(debouncedQ) : Promise.resolve<NoteSearchRow[]>([]),
      wantHl ? searchHighlights(debouncedQ) : Promise.resolve<HighlightSearchRow[]>([]),
    ])
      .then(([d, n, h]) => {
        if (!active) return;
        setDocs(d); setNotes(n); setHighlights(h); setIsLoading(false);
      })
      .catch(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [debouncedQ, enabled, type, format]);

  const hasResults = docs.length > 0 || notes.length > 0 || highlights.length > 0;

  return {
    docs: docs.slice(0, 5),
    notes: notes.slice(0, 5),
    highlights: highlights.slice(0, 5),
    isLoading,
    hasResults,
    searched: enabled,
  };
}
