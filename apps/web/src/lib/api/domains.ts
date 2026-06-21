"use client";
// Domain "domains" (nhóm handbook) trên Supabase.
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

export type DomainRow = {
  _id: string;
  userId: string;
  name: string;
  color: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
};

// ─── READS ──────────────────────────────────────────────────────────────────
export function useDomains(): DomainRow[] | undefined {
  return useRealtimeQuery<DomainRow>("domains", { order: { column: "order", ascending: true } });
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) throw new Error("Tên phải từ 1-100 ký tự");
  return trimmed;
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────
export async function createDomain(name: string, color?: string): Promise<string> {
  const userId = await currentUserId();
  const n = validateName(name);
  const now = Date.now();
  const { data: existing } = await supabase.from("domains").select("order");
  const order = (existing ?? []).reduce((m, d) => Math.max(m, (d as { order: number }).order), -1) + 1;
  const { data, error } = await supabase
    .from("domains")
    .insert({ userId, name: n, color: color ?? null, order, createdAt: now, updatedAt: now })
    .select("_id")
    .single();
  if (error || !data) throw error ?? new Error("Tạo domain thất bại");
  return data._id;
}

export async function renameDomain(domainId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("domains")
    .update({ name: validateName(name), updatedAt: Date.now() })
    .eq("_id", domainId);
  if (error) throw error;
}

// Xoá domain + toàn bộ handbook + tài liệu bên trong.
// documents.handbookId là ON DELETE SET NULL nên phải xoá tài liệu thủ công trước
// (cascade highlights/notes/... qua FK documents._id), rồi xoá domain (cascade handbooks qua domainId).
export async function removeDomain(domainId: string): Promise<void> {
  const { data: hbs } = await supabase.from("handbooks").select("_id").eq("domainId", domainId);
  const hbIds = (hbs ?? []).map((h) => (h as { _id: string })._id);
  if (hbIds.length) await supabase.from("documents").delete().in("handbookId", hbIds);
  await supabase.from("domains").delete().eq("_id", domainId);
}
