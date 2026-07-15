"use client";
// Thay cơ chế reactive useQuery của Convex bằng: fetch ban đầu + Supabase Realtime.
// Trả về: undefined = đang load, [] = rỗng, [...] = dữ liệu (giống convex useQuery).
// RLS tự lọc theo user nên đa số query không cần truyền userId.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { subscribeTable } from "@/lib/supabase/realtime";

export type RealtimeQueryOptions = {
  filter?: Record<string, string | number | boolean | null>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  enabled?: boolean; // false = "skip" (giống convex "skip")
  select?: string;   // cột cần lấy; mặc định "*". Dùng để loại field nặng (extractedText).
};

export function useRealtimeQuery<T = Record<string, unknown>>(
  table: string,
  options: RealtimeQueryOptions = {},
): T[] | undefined {
  const { filter, order, limit, enabled = true, select = "*" } = options;
  const [data, setData] = useState<T[] | undefined>(undefined);
  // Fix C: giữ JSON của lần trước — refetch ra dữ liệu y hệt thì bỏ qua setData
  // (không tạo reference mới → không re-render consumer).
  const lastJsonRef = useRef<string | null>(null);

  // Khóa ổn định cho deps (tránh re-subscribe vô hạn)
  const filterKey = JSON.stringify(filter ?? {});
  const orderKey = order ? `${order.column}:${order.ascending ?? true}` : "";

  useEffect(() => {
    if (!enabled) {
      lastJsonRef.current = null;
      setData(undefined);
      return;
    }
    let active = true;
    lastJsonRef.current = null; // query đổi → so sánh lại từ đầu

    async function load() {
      let q = supabase.from(table).select(select);
      if (filter) {
        for (const [k, v] of Object.entries(filter)) q = q.eq(k, v as never);
      }
      if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
      if (limit) q = q.limit(limit);
      const { data: rows, error } = await q;
      if (!active) return;
      if (error) {
        console.error(`[useRealtimeQuery] ${table}:`, error.message);
        lastJsonRef.current = null;
        setData([]);
        return;
      }
      const json = JSON.stringify(rows ?? []);
      if (json === lastJsonRef.current) return; // dữ liệu không đổi — bỏ qua
      lastJsonRef.current = json;
      setData((rows ?? []) as T[]);
    }

    void load();

    // Realtime: nghe thay đổi bảng qua channel DÙNG CHUNG (RLS đã lọc theo user) → refetch.
    const unsub = subscribeTable(table, () => void load());

    return () => {
      active = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filterKey, orderKey, limit, enabled, select]);

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
