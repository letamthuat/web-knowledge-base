"use client";
// Thay cơ chế reactive useQuery của Convex bằng: fetch ban đầu + Supabase Realtime.
// Trả về: undefined = đang load, [] = rỗng, [...] = dữ liệu (giống convex useQuery).
// RLS tự lọc theo user nên đa số query không cần truyền userId.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type RealtimeQueryOptions = {
  filter?: Record<string, string | number | boolean | null>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  enabled?: boolean; // false = "skip" (giống convex "skip")
};

export function useRealtimeQuery<T = Record<string, unknown>>(
  table: string,
  options: RealtimeQueryOptions = {},
): T[] | undefined {
  const { filter, order, limit, enabled = true } = options;
  const [data, setData] = useState<T[] | undefined>(undefined);

  // Khóa ổn định cho deps (tránh re-subscribe vô hạn)
  const filterKey = JSON.stringify(filter ?? {});
  const orderKey = order ? `${order.column}:${order.ascending ?? true}` : "";

  useEffect(() => {
    if (!enabled) {
      setData(undefined);
      return;
    }
    let active = true;

    async function load() {
      let q = supabase.from(table).select("*");
      if (filter) {
        for (const [k, v] of Object.entries(filter)) q = q.eq(k, v as never);
      }
      if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
      if (limit) q = q.limit(limit);
      const { data: rows, error } = await q;
      if (!active) return;
      if (error) {
        console.error(`[useRealtimeQuery] ${table}:`, error.message);
        setData([]);
        return;
      }
      setData((rows ?? []) as T[]);
    }

    void load();

    // Realtime: có thay đổi nào trên bảng (RLS đã lọc theo user) → refetch.
    const channel = supabase
      .channel(`rt:${table}:${filterKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => void load(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filterKey, orderKey, limit, enabled]);

  return data;
}

// Biến thể trả về 1 record (hoặc null) — thay các query .first()/getById.
export function useRealtimeOne<T = Record<string, unknown>>(
  table: string,
  options: RealtimeQueryOptions = {},
): T | null | undefined {
  const rows = useRealtimeQuery<T>(table, { ...options, limit: 1 });
  if (rows === undefined) return undefined;
  return rows[0] ?? null;
}
