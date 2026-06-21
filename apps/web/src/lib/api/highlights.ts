"use client";
// Domain highlights trên Supabase (highlight văn bản + bookmark).
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple" | "custom";
export type HighlightType = "text" | "bookmark" | "timestamp";

export type HighlightRow = {
  _id: string;
  userId: string;
  docId: string;
  color: HighlightColor;
  type: HighlightType;
  positionType: string;
  positionValue: string;
  selectedText: string | null;
  note: string | null;
  customColor: string | null;
  voiceNoteStorageId: string | null;
  updatedAt: number;
  createdAt: number;
  clientMutationId: string | null;
};

// ─── READS ──────────────────────────────────────────────────────────────────
// Highlight của 1 document.
export function useHighlightsByDoc(docId: string | undefined): HighlightRow[] | undefined {
  return useRealtimeQuery<HighlightRow>("highlights", {
    filter: { docId: docId ?? "" },
    enabled: !!docId,
  });
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

// Non-hook: highlight của 1 doc (cho export).
export async function getHighlightsByDoc(docId: string): Promise<HighlightRow[]> {
  const { data } = await supabase.from("highlights").select("*").eq("docId", docId);
  return (data ?? []) as HighlightRow[];
}

// Non-hook: tất cả highlight của user (cho backup).
export async function getAllHighlights(): Promise<HighlightRow[]> {
  const { data } = await supabase.from("highlights").select("*");
  return (data ?? []) as HighlightRow[];
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────
export async function createHighlight(args: {
  docId: string;
  color: HighlightColor;
  customColor?: string;
  positionType: string;
  positionValue: string;
  selectedText?: string;
  clientMutationId?: string;
}): Promise<string> {
  const userId = await currentUserId();
  const now = Date.now();
  const { data, error } = await supabase
    .from("highlights")
    .insert({
      userId,
      docId: args.docId,
      color: args.color,
      customColor: args.customColor ?? null,
      type: "text",
      positionType: args.positionType,
      positionValue: args.positionValue,
      selectedText: args.selectedText ?? null,
      updatedAt: now,
      createdAt: now,
      clientMutationId: args.clientMutationId ?? null,
    })
    .select("_id")
    .single();
  if (error || !data) throw error ?? new Error("Tạo highlight thất bại");
  return data._id;
}

export async function updateHighlightNote(highlightId: string, note?: string): Promise<void> {
  const { error } = await supabase
    .from("highlights")
    .update({ note: note ?? null, updatedAt: Date.now() })
    .eq("_id", highlightId);
  if (error) throw error;
}

export async function removeHighlight(highlightId: string): Promise<void> {
  const { error } = await supabase.from("highlights").delete().eq("_id", highlightId);
  if (error) throw error;
}

export async function createBookmark(args: {
  docId: string;
  scrollPct: number;
  headingId?: string;
  label?: string;
  clientMutationId?: string;
}): Promise<string> {
  const userId = await currentUserId();
  const now = Date.now();
  const positionValue = JSON.stringify({ pct: args.scrollPct, headingId: args.headingId });
  const { data, error } = await supabase
    .from("highlights")
    .insert({
      userId,
      docId: args.docId,
      color: "yellow",
      type: "bookmark",
      positionType: "scroll_pct",
      positionValue,
      note: args.label ?? null,
      updatedAt: now,
      createdAt: now,
      clientMutationId: args.clientMutationId ?? null,
    })
    .select("_id")
    .single();
  if (error || !data) throw error ?? new Error("Tạo bookmark thất bại");
  return data._id;
}
