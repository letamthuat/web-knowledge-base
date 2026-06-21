"use client";

/**
 * Mở sẵn các Supabase Realtime subscription ở tầng layout để dữ liệu được nạp
 * trước khi user vào /library hoặc /notes. RLS tự lọc theo user nên không cần
 * guard auth. Render null — chỉ để "làm ấm" dữ liệu/subscription.
 */
import { useDocumentsList } from "@/lib/api/documents";
import { useFoldersList, useAllDocFolders } from "@/lib/api/folders";
import { useAllNotesWithDocTitle } from "@/lib/api/notes";
import { useNoteTabsList } from "@/lib/api/note-tabs";

export function DataPrefetcher() {
  // Library data
  useDocumentsList();
  useFoldersList();
  useAllDocFolders();

  // Notes data
  useAllNotesWithDocTitle();
  useNoteTabsList();

  return null;
}
