"use client";
// Domain folders + document_folders trên Supabase.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

export type FolderRow = {
  _id: string;
  name: string;
  parentFolderId: string | null;
  createdAt: number;
  updatedAt: number;
};
export type DocFolderRow = { _id: string; docId: string; folderId: string };
type DocLite = { _id: string; title: string; format: string; status: string; createdAt: number; fileSizeBytes: number | null };

// Tất cả folder của user.
export function useFoldersList(): FolderRow[] | undefined {
  return useRealtimeQuery<FolderRow>("folders", { order: { column: "name", ascending: true } });
}

// Tất cả mapping document_folders (dựng cây sidebar).
export function useAllDocFolders(): DocFolderRow[] | undefined {
  return useRealtimeQuery<DocFolderRow>("document_folders");
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
    const channel = supabase
      .channel(`rt:doc_folder:${docId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "document_folders" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
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
    const channel = supabase
      .channel(`rt:docs_in_folder:${folderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "document_folders" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
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

// Xoá folder + TOÀN BỘ tài liệu bên trong + subfolder (đệ quy) — giống Convex.
// Document bị xoá sẽ cascade related data qua FK ON DELETE CASCADE.
// (File R2 mồ côi sẽ dọn ở Phase 4.)
export async function deleteFolder(folderId: string): Promise<void> {
  const { data: allFolders } = await supabase.from("folders").select("_id, parentFolderId");
  // Gom toàn bộ folder trong subtree
  const subtree = new Set<string>([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of allFolders ?? []) {
      const row = f as { _id: string; parentFolderId: string | null };
      if (row.parentFolderId && subtree.has(row.parentFolderId) && !subtree.has(row._id)) {
        subtree.add(row._id);
        changed = true;
      }
    }
  }
  const folderIds = Array.from(subtree);
  // Xoá tài liệu trong các folder đó
  const { data: dfs } = await supabase
    .from("document_folders").select("docId").in("folderId", folderIds);
  const docIds = Array.from(new Set((dfs ?? []).map((d) => (d as { docId: string }).docId)));
  if (docIds.length) await supabase.from("documents").delete().in("_id", docIds);
  // Xoá folder gốc → parentFolderId ON DELETE CASCADE tự xoá subfolder + mapping
  await supabase.from("folders").delete().eq("_id", folderId);
}
