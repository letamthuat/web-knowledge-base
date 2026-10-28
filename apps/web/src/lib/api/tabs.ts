"use client";
// Domain tabs trên Supabase (tab tài liệu đang mở trong reader).
import { useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { suppressEcho } from "@/lib/supabase/realtime";
import { uuidv7 } from "uuidv7";

const MAX_TABS = 10;

export type TabRow = {
  _id: string;
  userId: string;
  docId: string;
  order: number;
  isActive: boolean;
  scrollState: string | null;
  updatedAt: number;
  clientMutationId: string | null;
};

export type TabWithDoc = TabRow & { docTitle: string; docFormat: string };

// ─── READS ──────────────────────────────────────────────────────────────────
// Tất cả tab của user + docTitle/docFormat (join documents) — order tăng dần.
type TabJoinRow = TabRow & { documents: { title: string; format: string } | null };
export function useTabsWithDoc(): TabWithDoc[] | undefined {
  const rows = useRealtimeQuery<TabJoinRow>("tabs", {
    order: { column: "order", ascending: true },
    select: "*, documents(title, format)",
  });
  return useMemo(() => {
    if (!rows) return undefined;
    const seen = new Set<string>();
    const result: TabWithDoc[] = [];
    for (const r of rows) {
      if (seen.has(r.docId)) continue;
      seen.add(r.docId);
      const { documents, ...rest } = r;
      result.push({
        ...rest,
        docTitle: documents?.title ?? "Untitled",
        docFormat: documents?.format ?? "unknown",
      });
    }
    return result;
  }, [rows]);
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────
const inFlightOpenTab = new Map<string, Promise<string>>();

// Mở (hoặc focus) tab cho document — idempotent, in-flight mutex, tối đa MAX_TABS.
export async function openTab(docId: string, clientMutationId?: string): Promise<string> {
  const existingPromise = inFlightOpenTab.get(docId);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    try {
      const userId = await currentUserId();
      const now = Date.now();

      // Kiểm tra tab đã tồn tại chưa (kèm dọn dẹp duplicate nếu có)
      const { data: existingList } = await supabase
        .from("tabs")
        .select("_id")
        .eq("userId", userId)
        .eq("docId", docId);

      if (existingList && existingList.length > 0) {
        const primaryId = existingList[0]._id;
        if (existingList.length > 1) {
          const duplicateIds = existingList.slice(1).map((t) => t._id);
          await supabase.from("tabs").delete().in("_id", duplicateIds);
        }
        await supabase
          .from("tabs")
          .update({ isActive: false })
          .eq("userId", userId)
          .eq("isActive", true)
          .neq("_id", primaryId);
        await supabase
          .from("tabs")
          .update({ isActive: true, updatedAt: now })
          .eq("_id", primaryId);
        return primaryId;
      }

      const { data: allTabs } = await supabase
        .from("tabs")
        .select("_id, order, isActive")
        .eq("userId", userId);

      if ((allTabs?.length ?? 0) >= MAX_TABS) {
        throw new Error("Tối đa 10 tab cùng lúc");
      }

      await supabase
        .from("tabs")
        .update({ isActive: false })
        .eq("userId", userId)
        .eq("isActive", true);

      const maxOrder = (allTabs ?? []).reduce((max, t) => Math.max(max, (t as { order: number }).order), -1);
      const { data, error } = await supabase
        .from("tabs")
        .insert({
          userId,
          docId,
          order: maxOrder + 1,
          isActive: true,
          updatedAt: now,
          clientMutationId: clientMutationId ?? null,
        })
        .select("_id")
        .single();
      if (error || !data) throw error ?? new Error("Mở tab thất bại");
      return data._id;
    } finally {
      inFlightOpenTab.delete(docId);
    }
  })();

  inFlightOpenTab.set(docId, promise);
  return promise;
}

export async function closeTab(tabId: string): Promise<void> {
  const { data: tab } = await supabase
    .from("tabs")
    .select("_id, isActive")
    .eq("_id", tabId)
    .maybeSingle();
  if (!tab) return;

  await supabase.from("tabs").delete().eq("_id", tabId);

  if (tab.isActive) {
    const { data: remaining } = await supabase
      .from("tabs")
      .select("_id, updatedAt")
      .order("updatedAt", { ascending: false })
      .limit(1);
    const next = remaining?.[0];
    if (next) {
      await supabase
        .from("tabs")
        .update({ isActive: true, updatedAt: Date.now() })
        .eq("_id", next._id);
    }
  }
}

export async function setActive(tabId: string): Promise<void> {
  await supabase.from("tabs").update({ isActive: false }).eq("isActive", true).neq("_id", tabId);
  await supabase.from("tabs").update({ isActive: true, updatedAt: Date.now() }).eq("_id", tabId);
}

export async function reorderTabs(orders: { tabId: string; order: number }[]): Promise<void> {
  const now = Date.now();
  await Promise.all(
    orders.map(({ tabId, order }) =>
      supabase.from("tabs").update({ order, updatedAt: now }).eq("_id", tabId),
    ),
  );
}

export async function closeAll(): Promise<void> {
  const { data: allTabs } = await supabase.from("tabs").select("_id");
  const ids = (allTabs ?? []).map((t) => (t as { _id: string })._id);
  if (ids.length) await supabase.from("tabs").delete().in("_id", ids);
}

export async function updateScrollState(
  tabId: string,
  scrollState: string,
  clientMutationId?: string,
): Promise<void> {
  // Bỏ echo realtime của chính mình: ghi scroll mỗi 10s khi đọc không được kéo
  // mọi useTabSync refetch → AppShell re-render giữa lúc đang cuộn.
  const key = clientMutationId ?? uuidv7();
  suppressEcho(key);
  await supabase
    .from("tabs")
    .update({ scrollState, updatedAt: Date.now(), clientMutationId: key })
    .eq("_id", tabId);
}
