"use client";
// Tìm kiếm FTS trên Postgres (thay 3 query search của Convex).
// Dùng tsvector cột "searchVector" (GIN) + websearch_to_tsquery; RLS tự lọc theo user.
import { supabase } from "@/lib/supabase/client";

const TS = { type: "websearch" as const, config: "simple" };

export type DocSearchRow = { _id: string; title: string; format: string; status: string };
export type NoteSearchRow = { _id: string; title: string | null; body: string; docId: string | null };
export type HighlightSearchRow = { _id: string; docId: string; selectedText: string | null; note: string | null };

// Tài liệu: FTS trên title + extractedText (cột searchVector). Lọc status ready + format tùy chọn.
export async function searchDocuments(q: string, format?: string): Promise<DocSearchRow[]> {
  let query = supabase
    .from("documents")
    .select("_id,title,format,status")
    .eq("status", "ready")
    .textSearch("searchVector", q, TS)
    .limit(10);
  if (format) query = query.eq("format", format);
  const { data } = await query;
  return (data ?? []) as DocSearchRow[];
}

// Ghi chú: FTS trên body (cột searchVector).
export async function searchNotes(q: string): Promise<NoteSearchRow[]> {
  const { data } = await supabase
    .from("notes")
    .select("_id,title,body,docId")
    .textSearch("searchVector", q, TS)
    .limit(10);
  return (data ?? []) as NoteSearchRow[];
}

// Highlight: không có tsvector → khớp substring trên note (giống Convex cũ).
export async function searchHighlights(q: string): Promise<HighlightSearchRow[]> {
  const { data } = await supabase
    .from("highlights")
    .select("_id,docId,selectedText,note")
    .ilike("note", `%${q}%`)
    .limit(10);
  return (data ?? []) as HighlightSearchRow[];
}
