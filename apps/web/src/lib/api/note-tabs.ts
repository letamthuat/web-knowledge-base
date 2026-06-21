"use client";
// Domain note_tabs trên Supabase (tab ghi chú đang mở).
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

export type NoteTabRow = {
  _id: string;
  userId: string;
  noteId: string;
  title: string;
  order: number;
  isActive: boolean;
  updatedAt: number;
};

// ─── READS ──────────────────────────────────────────────────────────────────
// Tất cả tab của user (RLS lọc theo user) — sắp theo order tăng dần.
export function useNoteTabsList(): NoteTabRow[] | undefined {
  return useRealtimeQuery<NoteTabRow>("note_tabs", {
    order: { column: "order", ascending: true },
  });
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────
// Mở (hoặc focus) tab cho note → đảm bảo chỉ 1 tab isActive.
export async function openNoteTab(noteId: string, title: string): Promise<string> {
  const userId = await currentUserId();
  const now = Date.now();

  const { data: existing } = await supabase
    .from("note_tabs")
    .select("_id")
    .eq("noteId", noteId)
    .maybeSingle();

  if (existing) {
    // Tắt mọi tab active khác, bật tab này.
    await supabase
      .from("note_tabs")
      .update({ isActive: false })
      .eq("isActive", true)
      .neq("_id", existing._id);
    await supabase
      .from("note_tabs")
      .update({ isActive: true, title, updatedAt: now })
      .eq("_id", existing._id);
    return existing._id;
  }

  // Tắt mọi tab active.
  await supabase.from("note_tabs").update({ isActive: false }).eq("isActive", true);

  // order = max + 1.
  const { data: last } = await supabase
    .from("note_tabs")
    .select("order")
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.order ?? -1) + 1;

  const { data, error } = await supabase
    .from("note_tabs")
    .insert({ userId, noteId, title, order: nextOrder, isActive: true, updatedAt: now })
    .select("_id")
    .single();
  if (error || !data) throw error ?? new Error("Mở tab thất bại");
  return data._id;
}

// Đóng tab — nếu tab đang active thì chuyển active sang tab gần đây nhất còn lại.
export async function closeNoteTab(noteTabId: string): Promise<void> {
  const { data: tab } = await supabase
    .from("note_tabs")
    .select("_id, isActive")
    .eq("_id", noteTabId)
    .maybeSingle();
  if (!tab) return;

  await supabase.from("note_tabs").delete().eq("_id", noteTabId);

  if (tab.isActive) {
    const { data: remaining } = await supabase
      .from("note_tabs")
      .select("_id, updatedAt")
      .order("updatedAt", { ascending: false })
      .limit(1);
    const next = remaining?.[0];
    if (next) {
      await supabase
        .from("note_tabs")
        .update({ isActive: true, updatedAt: Date.now() })
        .eq("_id", next._id);
    }
  }
}

export async function setNoteTabActive(noteTabId: string): Promise<void> {
  await supabase
    .from("note_tabs")
    .update({ isActive: false })
    .eq("isActive", true)
    .neq("_id", noteTabId);
  await supabase
    .from("note_tabs")
    .update({ isActive: true, updatedAt: Date.now() })
    .eq("_id", noteTabId);
}

export async function updateNoteTabTitle(noteTabId: string, title: string): Promise<void> {
  await supabase.from("note_tabs").update({ title, updatedAt: Date.now() }).eq("_id", noteTabId);
}
