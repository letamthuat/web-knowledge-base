"use client";

/**
 * Fires Convex subscriptions at layout level so data is already in the
 * reactive cache when the user navigates to /library or /notes.
 * Convex returns null/[] for unauthenticated calls, so no auth guard needed.
 * Renders nothing — purely a cache warming component.
 */
import { useQuery } from "convex/react";
import { api } from "@/_generated/api";

export function DataPrefetcher() {
  // Library data
  useQuery(api.documents.queries.listByUser);
  useQuery(api.folders.queries.listByUser);
  useQuery(api.folders.queries.listAllDocFolders);

  // Notes data
  useQuery(api.notes.queries.listAllByUser, {});
  useQuery(api.note_tabs.queries.listByUser);

  return null;
}
