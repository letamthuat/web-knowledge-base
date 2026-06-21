"use client";
// Domain documents trên Supabase.
import { useEffect, useState } from "react";
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

export type LooseDocRow = DocumentRow & { progressPct: number | null };
type LooseJoinRow = DocumentRow & { reading_progress: { progressPct: number | null }[] | null };

// Tài liệu lẻ (status ready, không thuộc handbook) + progressPct — cho sidebar thư viện.
export function useLooseDocsWithProgress(enabled = true): LooseDocRow[] | undefined {
  const [data, setData] = useState<LooseDocRow[] | undefined>(undefined);
  useEffect(() => {
    if (!enabled) { setData(undefined); return; }
    let active = true;
    async function load() {
      const { data: rows } = await supabase
        .from("documents")
        .select(`${DOC_LIST_COLUMNS},reading_progress(progressPct)`)
        .eq("status", "ready")
        .is("handbookId", null);
      if (!active) return;
      const docs = ((rows ?? []) as unknown as LooseJoinRow[]).map((d) => {
        const { reading_progress, ...rest } = d;
        return { ...rest, progressPct: reading_progress?.[0]?.progressPct ?? null };
      });
      setData(docs);
    }
    void load();
    const channel = supabase
      .channel(`rt:loose_docs:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reading_progress" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [enabled]);
  return data;
}

export type StorageStats = {
  docCount: number;
  trashedCount: number;
  noteCount: number;
  r2Bytes: number;
  convexFileBytes: number;
  convexDbBytes: number;
};

// Thống kê dung lượng cho trang Settings.
export function useStorageStats(): StorageStats | undefined {
  const [data, setData] = useState<StorageStats | undefined>(undefined);
  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: docs }, { data: notes }] = await Promise.all([
        supabase.from("documents").select("fileSizeBytes, storageBackend, status"),
        supabase.from("notes").select("body"),
      ]);
      if (!active) return;
      const allDocs = (docs ?? []) as { fileSizeBytes: number | null; storageBackend: string; status: string }[];
      const ready = allDocs.filter((d) => d.status === "ready");
      const trashed = allDocs.filter((d) => d.status === "trashed");
      const sumBy = (backend: string) =>
        allDocs.filter((d) => d.storageBackend === backend).reduce((s, d) => s + (d.fileSizeBytes ?? 0), 0);
      const noteBodyBytes = (notes ?? []).reduce(
        (s, n) => s + ((n as { body: string | null }).body?.length ?? 0) * 2,
        0,
      );
      setData({
        docCount: ready.length,
        trashedCount: trashed.length,
        noteCount: (notes ?? []).length,
        r2Bytes: sumBy("r2"),
        convexFileBytes: sumBy("convex"),
        convexDbBytes: noteBodyBytes,
      });
    }
    void load();
    return () => { active = false; };
  }, []);
  return data;
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

// Trích xuất text cho mọi doc còn thiếu extractedText (gọi route extract cho từng doc).
export async function backfillExtractText(): Promise<{ total: number; scheduled: number }> {
  const { data: missing } = await supabase
    .from("documents").select("_id").eq("status", "ready").is("extractedText", null);
  const { count } = await supabase
    .from("documents").select("_id", { count: "exact", head: true }).eq("status", "ready");
  const ids = (missing ?? []).map((d) => (d as { _id: string })._id);
  await Promise.all(
    ids.map((docId) =>
      fetch("/api/documents/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docId }),
      }).catch(() => {}),
    ),
  );
  return { total: count ?? ids.length, scheduled: ids.length };
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
