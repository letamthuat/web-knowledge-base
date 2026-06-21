"use client";
// Domain tabs trên Supabase (tab tài liệu đang mở trong reader).
import { useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

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
  return useMemo(
    () =>
      rows?.map((r) => {
        const { documents, ...rest } = r;
        return {
          ...rest,
          docTitle: documents?.title ?? "Untitled",
          docFormat: documents?.format ?? "unknown",
        };
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
// Mở (hoặc focus) tab cho document — idempotent, tối đa MAX_TABS.
export async function openTab(docId: string, clientMutationId?: string): Promise<string> {
  const userId = await currentUserId();
  const now = Date.now();

  const { data: existing } = await supabase
    .from("tabs")
    .select("_id")
    .eq("docId", docId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("tabs")
      .update({ isActive: false })
      .eq("isActive", true)
      .neq("_id", existing._id);
    await supabase.from("tabs").update({ isActive: true, updatedAt: now }).eq("_id", existing._id);
    return existing._id;
  }

  const { data: allTabs } = await supabase.from("tabs").select("_id, order, isActive");
  if ((allTabs?.length ?? 0) >= MAX_TABS) {
    throw new Error("Tối đa 10 tab cùng lúc");
  }

  await supabase.from("tabs").update({ isActive: false }).eq("isActive", true);

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
  await supabase
    .from("tabs")
    .update({ scrollState, updatedAt: Date.now(), clientMutationId: clientMutationId ?? null })
    .eq("_id", tabId);
}
