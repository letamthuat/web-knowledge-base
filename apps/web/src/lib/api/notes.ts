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
