"use client";
// Domain handbooks trên Supabase (phần đọc + CRUD/folder ops thuần DB).
// ZIP ingest (finalizeImport) + getAssetUrls = Phase 4 (server routes).
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

export type HandbookRow = {
  _id: string;
  userId: string;
  domainId: string;
  name: string;
  color: string | null;
  order: number;
  emptyFolders: string[] | null;
  createdAt: number;
  updatedAt: number;
};

export type HandbookFile = {
  docId: string;
  relPath: string;
  format: string;
  title: string;
  progressPct: number | null;
};

// ─── READS ──────────────────────────────────────────────────────────────────
export function useHandbooks(domainId: string | undefined, enabled = true): HandbookRow[] | undefined {
  return useRealtimeQuery<HandbookRow>("handbooks", {
    filter: domainId ? { domainId } : undefined,
    order: { column: "order", ascending: true },
    enabled,
  });
}

type FileJoinRow = {
  _id: string;
  relPath: string | null;
  format: string;
  title: string;
  status: string;
  reading_progress: { progressPct: number | null }[] | null;
};

// Files (documents status=ready) trong 1 handbook + progressPct (join reading_progress).
export function useHandbookFiles(handbookId: string | undefined, enabled = true): HandbookFile[] | undefined {
  const [data, setData] = useState<HandbookFile[] | undefined>(undefined);
  useEffect(() => {
    if (!enabled || !handbookId) { setData(undefined); return; }
    let active = true;
    async function load() {
      const { data: rows } = await supabase
        .from("documents")
        .select("_id, relPath, format, title, status, reading_progress(progressPct)")
        .eq("handbookId", handbookId as string);
      if (!active) return;
      const files = ((rows ?? []) as unknown as FileJoinRow[])
        .filter((d) => d.status === "ready")
        .map((d) => ({
          docId: d._id,
          relPath: d.relPath ?? d.title,
          format: d.format,
          title: d.title,
          progressPct: d.reading_progress?.[0]?.progressPct ?? null,
        }));
      setData(files);
    }
    void load();
    const channel = supabase
      .channel(`rt:handbook_files:${handbookId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reading_progress" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [handbookId, enabled]);
  return data;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) throw new Error("Tên phải từ 1-100 ký tự");
  return trimmed;
}

function normalizeFolderPrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, "").trim();
}

function fileTitle(relPath: string): string {
  const base = relPath.split("/").pop() ?? relPath;
  return base.replace(/\.[^/.]+$/, "") || base;
}

function uniquePath(relPath: string, used: Set<string>): string | null {
  const clean = relPath.replace(/^\/+/, "").trim();
  if (!clean) return null;
  if (!used.has(clean)) return clean;
  const m = clean.match(/^(.*?)(\.[^/.]+)?$/);
  const stem = m?.[1] ?? clean;
  const ext = m?.[2] ?? "";
  for (let i = 1; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

async function getHandbookEmptyFolders(handbookId: string): Promise<string[]> {
  const { data } = await supabase.from("handbooks").select("emptyFolders").eq("_id", handbookId).maybeSingle();
  return (data?.emptyFolders ?? []) as string[];
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
export async function createHandbook(domainId: string, name: string, color?: string): Promise<string> {
  const userId = await currentUserId();
  const n = validateName(name);
  const now = Date.now();
  const { data: existing } = await supabase.from("handbooks").select("order").eq("domainId", domainId);
  const order = (existing ?? []).reduce((m, h) => Math.max(m, (h as { order: number }).order), -1) + 1;
  const { data, error } = await supabase
    .from("handbooks")
    .insert({ userId, domainId, name: n, color: color ?? null, order, createdAt: now, updatedAt: now })
    .select("_id")
    .single();
  if (error || !data) throw error ?? new Error("Tạo handbook thất bại");
  return data._id;
}

export async function renameHandbook(handbookId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("handbooks")
    .update({ name: validateName(name), updatedAt: Date.now() })
    .eq("_id", handbookId);
  if (error) throw error;
}

// Xoá handbook + toàn bộ tài liệu bên trong (cascade children qua FK documents._id).
export async function removeHandbook(handbookId: string): Promise<void> {
  await supabase.from("documents").delete().eq("handbookId", handbookId);
  await supabase.from("handbooks").delete().eq("_id", handbookId);
}

// ─── ZIP IMPORT (ghi document rows; file đã upload R2 từ client) ────────────────
export type ImportFile = {
  relPath: string;
  storageKey: string;
  format: string;
  fileSizeBytes?: number;
  mimeType?: string;
};

export async function finalizeImport(
  handbookId: string,
  files: ImportFile[],
): Promise<{ created: number; skipped: number }> {
  const userId = await currentUserId();
  const now = Date.now();

  const { data: existing } = await supabase
    .from("documents").select("relPath").eq("handbookId", handbookId);
  const usedPaths = new Set(((existing ?? []) as { relPath: string | null }[]).map((d) => d.relPath ?? ""));

  let created = 0;
  let skipped = 0;
  for (const f of files) {
    const relPath = uniquePath(f.relPath, usedPaths);
    if (!relPath) { skipped++; continue; }
    usedPaths.add(relPath);

    const { data, error } = await supabase
      .from("documents")
      .insert({
        userId,
        title: fileTitle(relPath),
        format: f.format,
        fileSizeBytes: f.fileSizeBytes ?? null,
        mimeType: f.mimeType ?? null,
        storageBackend: "r2",
        storageKey: f.storageKey,
        status: "ready",
        handbookId,
        relPath,
        createdAt: now,
        updatedAt: now,
      })
      .select("_id")
      .single();
    if (error || !data) { skipped++; continue; }
    created++;
    // Trích xuất text cho FTS (route Phase 4) — fire-and-forget.
    void fetch("/api/documents/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ docId: data._id }),
    }).catch(() => {});
  }

  return { created, skipped };
}

// ─── FOLDER OPS (emptyFolders) ─────────────────────────────────────────────────
export async function addEmptyFolder(handbookId: string, prefix: string): Promise<void> {
  const p = normalizeFolderPrefix(prefix);
  if (!p) throw new Error("Tên folder không hợp lệ");
  const folders = new Set(await getHandbookEmptyFolders(handbookId));
  folders.add(p);
  await supabase.from("handbooks").update({ emptyFolders: [...folders], updatedAt: Date.now() }).eq("_id", handbookId);
}

export async function removeFolder(handbookId: string, prefix: string): Promise<void> {
  const p = normalizeFolderPrefix(prefix);
  if (!p) throw new Error("Tên folder không hợp lệ");
  // Xoá tài liệu nằm trong folder (relPath bắt đầu bằng prefix/).
  const { data: docs } = await supabase
    .from("documents").select("_id, relPath").eq("handbookId", handbookId);
  const toDelete = ((docs ?? []) as { _id: string; relPath: string | null }[])
    .filter((d) => (d.relPath ?? "").startsWith(p + "/"))
    .map((d) => d._id);
  if (toDelete.length) await supabase.from("documents").delete().in("_id", toDelete);

  const folders = (await getHandbookEmptyFolders(handbookId)).filter(
    (x) => x !== p && !x.startsWith(p + "/"),
  );
  await supabase.from("handbooks").update({ emptyFolders: folders, updatedAt: Date.now() }).eq("_id", handbookId);
}

export async function renameFolder(handbookId: string, oldPrefix: string, newPrefix: string): Promise<void> {
  const oldP = normalizeFolderPrefix(oldPrefix);
  const newP = normalizeFolderPrefix(newPrefix);
  if (!oldP || !newP) throw new Error("Đường dẫn thư mục không hợp lệ");
  if (oldP === newP) return;

  const now = Date.now();
  const { data: docs } = await supabase
    .from("documents").select("_id, relPath").eq("handbookId", handbookId);
  for (const d of (docs ?? []) as { _id: string; relPath: string | null }[]) {
    const path = d.relPath ?? "";
    if (path.startsWith(oldP + "/")) {
      const newPath = `${newP}/${path.slice((oldP + "/").length)}`;
      await supabase.from("documents").update({ relPath: newPath, updatedAt: now }).eq("_id", d._id);
    }
  }

  const folders = (await getHandbookEmptyFolders(handbookId)).map((x) => {
    if (x === oldP) return newP;
    if (x.startsWith(oldP + "/")) return newP + x.slice(oldP.length);
    return x;
  });
  await supabase
    .from("handbooks")
    .update({ emptyFolders: [...new Set(folders)], updatedAt: now })
    .eq("_id", handbookId);
}

export async function renameHandbookFile(docId: string, newName: string): Promise<void> {
  const name = newName.trim();
  if (!name || name.includes("/")) throw new Error("Tên file không hợp lệ");

  const { data: doc } = await supabase
    .from("documents").select("_id, relPath, handbookId").eq("_id", docId).maybeSingle();
  if (!doc || !doc.handbookId) throw new Error("Không tìm thấy tài liệu trong handbook");

  const segs = (doc.relPath ?? "").split("/");
  segs.pop();
  segs.push(name);
  const newPath = segs.join("/");

  const { data: existing } = await supabase
    .from("documents").select("_id").eq("handbookId", doc.handbookId).eq("relPath", newPath).maybeSingle();
  if (existing && existing._id !== docId) throw new Error("File đã tồn tại ở đường dẫn này");

  await supabase
    .from("documents")
    .update({ relPath: newPath, title: fileTitle(name), updatedAt: Date.now() })
    .eq("_id", docId);
}
