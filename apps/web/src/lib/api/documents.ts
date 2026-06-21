"use client";
// Domain documents trên Supabase.
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery, useRealtimeOne } from "@/hooks/useRealtimeQuery";

// Cột cho danh sách — KHÔNG lấy extractedText/searchVector/clippedContent (chống đốt băng thông).
export const DOC_LIST_COLUMNS =
  "_id,_creationTime,userId,title,format,fileSizeBytes,durationMs,mimeType,storageBackend,storageKey,handbookId,relPath,sourceUrl,status,trashedAt,restoredAt,createdAt,updatedAt,lastOpenedAt";
// Cột đầy đủ cho 1 doc (reader/export) — thêm text nội dung, vẫn bỏ searchVector.
const DOC_FULL_COLUMNS = `${DOC_LIST_COLUMNS},extractedText,clippedContent`;

export type DocumentRow = {
  _id: string;
  title: string;
  format: string;
  status: string;
  fileSizeBytes: number | null;
  durationMs: number | null;
  mimeType: string | null;
  storageBackend: string;
  storageKey: string;
  handbookId: string | null;
  relPath: string | null;
  sourceUrl: string | null;
  trashedAt: number | null;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
  extractedText?: string | null;
  clippedContent?: string | null;
};

// ─── READS ──────────────────────────────────────────────────────────────────
export function useDocumentsList(): DocumentRow[] | undefined {
  return useRealtimeQuery<DocumentRow>("documents", {
    filter: { status: "ready" },
    order: { column: "createdAt", ascending: false },
    select: DOC_LIST_COLUMNS,
  });
}

export function useTrashedDocuments(): DocumentRow[] | undefined {
  return useRealtimeQuery<DocumentRow>("documents", {
    filter: { status: "trashed" },
    order: { column: "createdAt", ascending: false },
    select: DOC_LIST_COLUMNS,
  });
}

export function useDocument(docId: string | undefined): DocumentRow | null | undefined {
  return useRealtimeOne<DocumentRow>("documents", {
    filter: { _id: docId ?? "" },
    enabled: !!docId,
    select: DOC_FULL_COLUMNS,
  });
}

// Non-hook: lấy 1 doc (cho action/export).
export async function getDocumentById(docId: string): Promise<DocumentRow | null> {
  const { data } = await supabase
    .from("documents").select(DOC_FULL_COLUMNS).eq("_id", docId).maybeSingle();
  return (data as unknown as DocumentRow) ?? null;
}

// Non-hook: tất cả tài liệu của user (kèm clippedContent) — cho backup.
export async function getAllDocumentsFull(): Promise<DocumentRow[]> {
  const { data } = await supabase.from("documents").select(DOC_FULL_COLUMNS);
  return (data ?? []) as unknown as DocumentRow[];
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────
export async function trashDocument(docId: string): Promise<void> {
  const now = Date.now();
  await supabase.from("documents").update({ status: "trashed", trashedAt: now, updatedAt: now }).eq("_id", docId);
}

export async function restoreDocument(docId: string): Promise<void> {
  const now = Date.now();
  await supabase.from("documents").update({ status: "ready", trashedAt: null, restoredAt: now, updatedAt: now }).eq("_id", docId);
}

export async function renameDocument(docId: string, newTitle: string): Promise<void> {
  const title = newTitle.trim();
  if (!title || title.length > 200) throw new Error("Tiêu đề phải từ 1-200 ký tự");
  await supabase.from("documents").update({ title, updatedAt: Date.now() }).eq("_id", docId);
}

// Xoá vĩnh viễn — cascade related data qua FK. (File R2 dọn ở Phase 4.)
export async function deletePermanent(docId: string): Promise<void> {
  await supabase.from("documents").delete().eq("_id", docId);
}

export async function deleteAllTrashed(): Promise<number> {
  const { data } = await supabase.from("documents").select("_id").eq("status", "trashed");
  const ids = (data ?? []).map((d) => (d as { _id: string })._id);
  if (ids.length) await supabase.from("documents").delete().in("_id", ids);
  return ids.length;
}

export async function finalizeUpload(args: {
  title: string;
  format: string;
  fileSizeBytes?: number;
  durationMs?: number;
  storageBackend: "convex" | "r2" | "b2";
  storageKey: string;
  sourceUrl?: string;
}): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const now = Date.now();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      userId: auth.user.id,
      title: args.title,
      format: args.format,
      fileSizeBytes: args.fileSizeBytes ?? null,
      durationMs: args.durationMs ?? null,
      storageBackend: args.storageBackend,
      storageKey: args.storageKey,
      sourceUrl: args.sourceUrl ?? null,
      status: "ready",
      createdAt: now,
      updatedAt: now,
    })
    .select("_id").single();
  if (error || !data) throw error ?? new Error("Lưu tài liệu thất bại");

  // Lên lịch trích xuất text cho FTS (route Phase 4) — fire-and-forget.
  void fetch("/api/documents/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ docId: data._id }),
  }).catch(() => {});

  return data._id;
}

// ─── ACTIONS (wrapper gọi Vercel route) ──────────────────────────────────────
export async function getDownloadUrl(docId: string): Promise<string> {
  const res = await fetch("/api/storage/download-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ docId }),
  });
  if (!res.ok) throw new Error("Không lấy được link tải");
  const { url } = (await res.json()) as { url: string };
  return url;
}

export async function requestUploadUrl(fileName: string): Promise<{
  storageBackend: "r2";
  uploadUrl: string;
  storageKey: string;
}> {
  const res = await fetch("/api/storage/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileName }),
  });
  if (!res.ok) throw new Error("Không lấy được link upload");
  return (await res.json()) as { storageBackend: "r2"; uploadUrl: string; storageKey: string };
}
