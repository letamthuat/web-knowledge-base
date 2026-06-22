"use client";
// Domain folders + document_folders trên Supabase.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { subscribeTable } from "@/lib/supabase/realtime";

export type FolderRow = {
  _id: string;
  name: string;
  parentFolderId: string | null;
  trashedAt: number | null;
  createdAt: number;
  updatedAt: number;
};
export type DocFolderRow = { _id: string; docId: string; folderId: string };
type DocLite = { _id: string; title: string; format: string; status: string; createdAt: number; fileSizeBytes: number | null };

// Tất cả folder của user (ẩn folder đã ở thùng rác).
export function useFoldersList(enabled = true): FolderRow[] | undefined {
  const rows = useRealtimeQuery<FolderRow>("folders", { order: { column: "name", ascending: true }, enabled });
  return useMemo(() => rows?.filter((f) => !f.trashedAt), [rows]);
}

// Folder đang ở thùng rác (cho trang Thùng rác).
export function useTrashedFolders(): FolderRow[] | undefined {
  const rows = useRealtimeQuery<FolderRow>("folders", { order: { column: "updatedAt", ascending: false } });
  return useMemo(() => rows?.filter((f) => !!f.trashedAt), [rows]);
}

// Tất cả mapping document_folders (dựng cây sidebar).
export function useAllDocFolders(enabled = true): DocFolderRow[] | undefined {
  return useRealtimeQuery<DocFolderRow>("document_folders", { enabled });
}

// Folder chứa 1 doc (hoặc null).
export function useFolderForDoc(docId: string | undefined): FolderRow | null | undefined {
  const [data, setData] = useState<FolderRow | null | undefined>(undefined);
  useEffect(() => {
    if (!docId) { setData(undefined); return; }
    let active = true;
    async function load() {
      const { data: row } = await supabase
        .from("document_folders")
        .select("folders(*)")
        .eq("docId", docId as string)
        .maybeSingle();
      if (!active) return;
      const folder = (row as unknown as { folders?: FolderRow | null })?.folders ?? null;
      setData(folder);
    }
    void load();
    const unsub = subscribeTable("document_folders", () => void load());
    return () => { active = false; unsub(); };
  }, [docId]);
  return data;
}

// Tài liệu trong 1 folder (status ready).
export function useDocsInFolder(folderId: string | undefined): DocLite[] | undefined {
  const [data, setData] = useState<DocLite[] | undefined>(undefined);
  useEffect(() => {
    if (!folderId) { setData(undefined); return; }
    let active = true;
    async function load() {
      const { data: rows } = await supabase
        .from("document_folders")
        .select("documents(_id, title, format, status, createdAt, fileSizeBytes)")
        .eq("folderId", folderId as string);
      if (!active) return;
      const docs = (rows ?? [])
        .map((r) => (r as unknown as { documents?: DocLite | null }).documents ?? null)
        .filter((d): d is DocLite => !!d && d.status === "ready");
      setData(docs);
    }
    void load();
    const unsub = subscribeTable("document_folders", () => void load());
    return () => { active = false; unsub(); };
  }, [folderId]);
  return data;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

export async function createFolder(name: string, parentFolderId?: string): Promise<string> {
  const userId = await currentUserId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tên folder không được trống");
  const { data, error } = await supabase
    .from("folders")
    .insert({ userId, name: trimmed, parentFolderId: parentFolderId ?? null })
    .select("_id").single();
  if (error || !data) throw error ?? new Error("Tạo folder thất bại");
  return data._id;
}

// 1 doc chỉ thuộc 1 folder — xoá mapping cũ rồi gán mới.
export async function assignDocToFolder(docId: string, folderId: string): Promise<void> {
  const userId = await currentUserId();
  await supabase.from("document_folders").delete().eq("docId", docId);
  await supabase.from("document_folders").insert({ userId, docId, folderId });
}

export async function removeDocFromFolder(docId: string): Promise<void> {
  await supabase.from("document_folders").delete().eq("docId", docId);
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  await supabase.from("folders").update({ name: name.trim(), updatedAt: Date.now() }).eq("_id", folderId);
}

type FolderLite = { _id: string; parentFolderId: string | null };

// Gom subtree (folder + mọi con cháu).
function gatherSubtree(all: FolderLite[], rootId: string): string[] {
  const set = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of all) {
      if (f.parentFolderId && set.has(f.parentFolderId) && !set.has(f._id)) {
        set.add(f._id);
        changed = true;
      }
    }
  }
  return [...set];
}

// Gom chuỗi tổ tiên (lên tới gốc).
function gatherAncestors(all: FolderLite[], id: string): string[] {
  const byId = new Map(all.map((f) => [f._id, f]));
  const out: string[] = [];
  let cur = byId.get(id)?.parentFolderId ?? null;
  while (cur && byId.has(cur)) {
    out.push(cur);
    cur = byId.get(cur)!.parentFolderId;
  }
  return out;
}

async function docIdsInFolders(folderIds: string[]): Promise<string[]> {
  if (!folderIds.length) return [];
  const { data } = await supabase.from("document_folders").select("docId").in("folderId", folderIds);
  return [...new Set((data ?? []).map((d) => (d as { docId: string }).docId))];
}

// Xoá folder → xoá MỀM (đệ quy subtree): trash file + đánh dấu folder.trashedAt, GIỮ mapping để khôi phục.
export async function deleteFolder(folderId: string): Promise<void> {
  const now = Date.now();
  const { data: allFolders } = await supabase.from("folders").select("_id, parentFolderId");
  const subtree = gatherSubtree((allFolders ?? []) as FolderLite[], folderId);
  const docIds = await docIdsInFolders(subtree);
  if (docIds.length) {
    await supabase.from("documents").update({ status: "trashed", trashedAt: now, updatedAt: now }).in("_id", docIds);
  }
  await supabase.from("folders").update({ trashedAt: now, updatedAt: now }).in("_id", subtree);
}

// Khôi phục folder: un-trash folder + subtree + tổ tiên (để có đường về) + các file trong subtree.
export async function restoreFolder(folderId: string): Promise<void> {
  const now = Date.now();
  const { data: allFolders } = await supabase.from("folders").select("_id, parentFolderId");
  const all = (allFolders ?? []) as FolderLite[];
  const subtree = gatherSubtree(all, folderId);
  const ancestors = gatherAncestors(all, folderId);
  const ids = [...new Set([...subtree, ...ancestors])];
  await supabase.from("folders").update({ trashedAt: null, updatedAt: now }).in("_id", ids);
  const docIds = await docIdsInFolders(subtree);
  if (docIds.length) {
    await supabase
      .from("documents")
      .update({ status: "ready", trashedAt: null, restoredAt: now, updatedAt: now })
      .in("_id", docIds)
      .eq("status", "trashed");
  }
}

// Xoá vĩnh viễn folder + subtree + tài liệu bên trong.
export async function deleteFolderPermanent(folderId: string): Promise<void> {
  const { data: allFolders } = await supabase.from("folders").select("_id, parentFolderId");
  const subtree = gatherSubtree((allFolders ?? []) as FolderLite[], folderId);
  const docIds = await docIdsInFolders(subtree);
  if (docIds.length) await supabase.from("documents").delete().in("_id", docIds);
  // Xoá folder gốc → parentFolderId ON DELETE CASCADE tự xoá subfolder + mapping.
  await supabase.from("folders").delete().eq("_id", folderId);
}

// Xoá vĩnh viễn TẤT CẢ folder đang ở thùng rác (dùng cho "Dọn sạch thùng rác").
export async function emptyTrashedFolders(): Promise<void> {
  await supabase.from("folders").delete().not("trashedAt", "is", null);
}
