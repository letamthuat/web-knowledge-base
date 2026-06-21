"use client";
// Domain notes trên Supabase.
import { useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

export type NoteRow = {
  _id: string;
  userId: string;
  docId: string | null;
  highlightId: string | null;
  title: string | null;
  body: string;
  tagIds: string[] | null;
  updatedAt: number;
  createdAt: number;
  clientMutationId: string | null;
};

export type NoteWithDocTitle = NoteRow & { docTitle: string | null };

// ─── READS ──────────────────────────────────────────────────────────────────
// Ghi chú của 1 document — mới nhất trước.
export function useNotesByDoc(docId: string | undefined): NoteRow[] | undefined {
  return useRealtimeQuery<NoteRow>("notes", {
    filter: { docId: docId ?? "" },
    order: { column: "createdAt", ascending: false },
    enabled: !!docId,
  });
}

// Tất cả ghi chú của user + docTitle (join documents) — updatedAt desc.
type NoteJoinRow = NoteRow & { documents: { title: string } | null };
export function useAllNotesWithDocTitle(): NoteWithDocTitle[] | undefined {
  const rows = useRealtimeQuery<NoteJoinRow>("notes", {
    order: { column: "updatedAt", ascending: false },
    select: "*, documents(title)",
  });
  return useMemo(
    () =>
      rows?.map((r) => {
        const { documents, ...rest } = r;
        return { ...rest, docTitle: documents?.title ?? null };
      }),
    [rows],
  );
}

// Non-hook: note của 1 doc (cho export).
export async function getNotesByDoc(docId: string): Promise<NoteRow[]> {
  const { data } = await supabase.from("notes").select("*").eq("docId", docId);
  return (data ?? []) as NoteRow[];
}

// Non-hook: tất cả note của user + docTitle (cho backup).
export async function getAllNotesWithDocTitle(): Promise<NoteWithDocTitle[]> {
  const { data } = await supabase.from("notes").select("*, documents(title)");
  return (data ?? []).map((r) => {
    const { documents, ...rest } = r as NoteJoinRow;
    return { ...rest, docTitle: documents?.title ?? null };
  });
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────
export async function createNote(args: {
  docId?: string | null;
  title?: string;
  body: string;
  clientMutationId?: string;
}): Promise<string> {
  const userId = await currentUserId();
  const now = Date.now();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      userId,
      docId: args.docId ?? null,
      title: args.title ?? null,
      body: args.body,
      updatedAt: now,
      createdAt: now,
      clientMutationId: args.clientMutationId ?? null,
    })
    .select("_id")
    .single();
  if (error || !data) throw error ?? new Error("Tạo ghi chú thất bại");
  return data._id;
}

export async function updateNote(noteId: string, body: string, title?: string): Promise<void> {
  const { error } = await supabase
    .from("notes")
    .update({ body, title: title ?? null, updatedAt: Date.now() })
    .eq("_id", noteId);
  if (error) throw error;
}

export async function removeNote(noteId: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("_id", noteId);
  if (error) throw error;
}

// ─── NOTE MEDIA (R2 qua route) ──────────────────────────────────────────────
// Presigned PUT cho media chèn vào note (key dưới prefix notes/).
export async function requestNoteMediaUploadUrl(
  fileName: string,
): Promise<{ uploadUrl: string; storageKey: string }> {
  const res = await fetch("/api/storage/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileName, prefix: "notes" }),
  });
  if (!res.ok) throw new Error("Không lấy được link upload");
  const { uploadUrl, storageKey } = (await res.json()) as { uploadUrl: string; storageKey: string };
  return { uploadUrl, storageKey };
}

// Presigned GET cho media của note (tái dùng route download-url theo storageKey).
export async function getNoteMediaUrl(storageKey: string): Promise<string> {
  const res = await fetch("/api/storage/download-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storageKey }),
  });
  if (!res.ok) throw new Error("Không lấy được link media");
  const { url } = (await res.json()) as { url: string };
  return url;
}

// Copy media của note vào thư viện (tạo document mới).
export async function copyNoteFileToLibrary(args: {
  sourceStorageKey: string;
  fileName: string;
  format: string;
  mimeType?: string;
  title?: string;
}): Promise<string> {
  const res = await fetch("/api/notes/copy-to-library", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error("Không thể thêm vào thư viện");
  const { docId } = (await res.json()) as { docId: string };
  return docId;
}
