"use client";
// Domain reading_progress trên Supabase. RLS tự lọc theo user.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type ReadingProgressRow = {
  _id: string;
  docId: string;
  positionType: string;
  positionValue: string;
  progressPct: number | null;
  updatedAt: number;
  clientMutationId: string | null;
};

// Upsert vị trí đọc với LWW (giống convex reading_progress/mutations.ts:upsert).
export async function upsertReadingProgress(args: {
  docId: string;
  positionType: string;
  positionValue: string;
  progressPct?: number;
  clientMutationId: string;
  updatedAt: number;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("reading_progress")
    .select("_id, clientMutationId, updatedAt")
    .eq("docId", args.docId)
    .maybeSingle();

  if (existing) {
    // Idempotency + LWW: bỏ qua nếu trùng mutation id hoặc server mới hơn.
    if (existing.clientMutationId === args.clientMutationId) return;
    if (existing.updatedAt >= args.updatedAt) return;
    await supabase
      .from("reading_progress")
      .update({
        positionType: args.positionType,
        positionValue: args.positionValue,
        progressPct: args.progressPct ?? null,
        updatedAt: args.updatedAt,
        clientMutationId: args.clientMutationId,
      })
      .eq("_id", existing._id);
  } else {
    await supabase.from("reading_progress").insert({
      userId,
      docId: args.docId,
      positionType: args.positionType,
      positionValue: args.positionValue,
      progressPct: args.progressPct ?? null,
      updatedAt: args.updatedAt,
      clientMutationId: args.clientMutationId,
    });
  }
}

// Non-hook: tất cả reading_progress của user (cho backup).
export async function getAllReadingProgress(): Promise<ReadingProgressRow[]> {
  const { data } = await supabase.from("reading_progress").select("*");
  return (data ?? []) as ReadingProgressRow[];
}

// Lịch sử đọc gần đây + join document (thay convex recentHistory).
export type RecentHistoryItem = {
  progress: ReadingProgressRow;
  doc: { _id: string; title: string; format: string; status: string };
};

export function useRecentHistory(limit = 10): RecentHistoryItem[] | undefined {
  const [data, setData] = useState<RecentHistoryItem[] | undefined>(undefined);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: rows, error } = await supabase
        .from("reading_progress")
        .select("*, documents(_id, title, format, status)")
        .order("updatedAt", { ascending: false })
        .limit(limit);
      if (!active) return;
      if (error || !rows) {
        setData([]);
        return;
      }
      const items = rows
        .map((r) => {
          const doc = (r as { documents?: RecentHistoryItem["doc"] }).documents;
          return doc ? { progress: r as unknown as ReadingProgressRow, doc } : null;
        })
        .filter((x): x is RecentHistoryItem => x !== null && x.doc.status !== "trashed");
      setData(items);
    }
    void load();
    const channel = supabase
      .channel(`rt:reading_progress:recent:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reading_progress" }, () => void load())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [limit]);

  return data;
}
