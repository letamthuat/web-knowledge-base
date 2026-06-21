"use client";
// Domain reading_history trên Supabase (lịch sử mở tài liệu).
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

export type ReadingHistoryRow = {
  _id: string;
  userId: string;
  docId: string;
  openedAt: number;
  positionType: string | null;
  positionValue: string | null;
};

// ─── READS ──────────────────────────────────────────────────────────────────
// Lịch sử mở của 1 document — mới nhất trước.
export function useHistoryByDoc(docId: string | undefined, limit = 10): ReadingHistoryRow[] | undefined {
  return useRealtimeQuery<ReadingHistoryRow>("reading_history", {
    filter: { docId: docId ?? "" },
    order: { column: "openedAt", ascending: false },
    limit,
    enabled: !!docId,
  });
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────
// Ghi nhận lần mở — rate-limit: bỏ qua nếu đã có entry trong 1 giờ qua cho doc này.
export async function recordOpen(
  docId: string,
  positionType?: string,
  positionValue?: string,
): Promise<void> {
  const userId = await currentUserId();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  const { data: recent } = await supabase
    .from("reading_history")
    .select("openedAt")
    .eq("docId", docId)
    .order("openedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent && now - recent.openedAt < oneHour) return;

  await supabase.from("reading_history").insert({
    userId,
    docId,
    openedAt: now,
    positionType: positionType ?? null,
    positionValue: positionValue ?? null,
  });
}
