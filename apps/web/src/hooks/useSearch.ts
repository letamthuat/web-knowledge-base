"use client";

import { useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { api } from "@/_generated/api";

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useSearch(q: string) {
  const debouncedQ = useDebounce(q, 200);
  const enabled = debouncedQ.length >= 2;

  const docs = useQuery(api.documents.queries.search, enabled ? { q: debouncedQ } : "skip") ?? [];
  const notes = useQuery(api.notes.queries.search, enabled ? { q: debouncedQ } : "skip") ?? [];
  const highlights = useQuery(api.highlights.queries.search, enabled ? { q: debouncedQ } : "skip") ?? [];

  const isLoading = enabled && (docs === undefined || notes === undefined || highlights === undefined);
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
