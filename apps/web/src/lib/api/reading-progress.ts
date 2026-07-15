"use client";
// Domain reading_progress trên Supabase. RLS tự lọc theo user.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { subscribeTable, suppressEcho } from "@/lib/supabase/realtime";

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
    // Ghi của chính mình — không cần refetch khi event echo về (Fix D)
    suppressEcho(args.clientMutationId);
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
    suppressEcho(args.clientMutationId);
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
  const lastJsonRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    lastJsonRef.current = null;
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
      const json = JSON.stringify(items);
      if (json === lastJsonRef.current) return; // Fix C
      lastJsonRef.current = json;
      setData(items);
    }
    void load();
    const unsubProg = subscribeTable("reading_progress", () => void load());
    // Cũng nghe documents: trash/xoá/đổi tên doc → cập nhật "Đọc gần đây" (lọc trashed, đổi title).
    const unsubDocs = subscribeTable("documents", () => void load());
    return () => {
      active = false;
      unsubProg();
      unsubDocs();
    };
  }, [limit]);

  return data;
}

// Fix A: progress của TẤT CẢ doc trong 1 query (thay vì 1 sub/card).
// Select nhẹ — chỉ cột cần cho card thư viện.
export type ProgressLite = { _id: string; docId: string; progressPct: number | null };
export function useAllProgress(enabled = true): ProgressLite[] | undefined {
  const [data, setData] = useState<ProgressLite[] | undefined>(undefined);
  const lastJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) { lastJsonRef.current = null; setData(undefined); return; }
    let active = true;
    lastJsonRef.current = null;
    async function load() {
      const { data: rows, error } = await supabase
        .from("reading_progress")
        .select("_id, docId, progressPct");
      if (!active) return;
      if (error || !rows) {
        setData([]);
        return;
      }
      const json = JSON.stringify(rows);
      if (json === lastJsonRef.current) return;
      lastJsonRef.current = json;
      setData(rows as ProgressLite[]);
    }
    void load();
    const unsub = subscribeTable("reading_progress", () => void load());
    return () => { active = false; unsub(); };
  }, [enabled]);
  return data;
}
