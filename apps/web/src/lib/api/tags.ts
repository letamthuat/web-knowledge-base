"use client";
// Domain tags + document_tags trên Supabase.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { subscribeTable } from "@/lib/supabase/realtime";

export type TagRow = { _id: string; name: string; color: string | null; createdAt: number };

const TAG_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
function randomColor() {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

// Tất cả tag của user (RLS lọc theo user).
export function useTagsList(): TagRow[] | undefined {
  return useRealtimeQuery<TagRow>("tags", { order: { column: "name", ascending: true } });
}

// Tag gắn với 1 document (join document_tags → tags).
export function useTagsForDoc(docId: string | undefined): TagRow[] | undefined {
  const [data, setData] = useState<TagRow[] | undefined>(undefined);
  const lastJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!docId) {
      lastJsonRef.current = null;
      setData(undefined);
      return;
    }
    let active = true;
    lastJsonRef.current = null;
    async function load() {
      const { data: rows, error } = await supabase
        .from("document_tags")
        .select("tags(*)")
        .eq("docId", docId as string);
      if (!active) return;
      if (error || !rows) {
        setData([]);
        return;
      }
      const tags = rows
        .map((r) => (r as unknown as { tags?: TagRow | null }).tags ?? null)
        .filter((t): t is TagRow => !!t);
      const json = JSON.stringify(tags);
      if (json === lastJsonRef.current) return; // Fix C: không đổi → bỏ qua
      lastJsonRef.current = json;
      setData(tags);
    }
    void load();
    const unsub = subscribeTable("document_tags", () => void load());
    return () => {
      active = false;
      unsub();
    };
  }, [docId]);
  return data;
}

// Fix A: TẤT CẢ mapping doc→tags trong 1 query (thay vì 1 query/card).
// Nghe cả document_tags lẫn tags (đổi tên/màu tag cũng cập nhật).
export type DocTagsEntry = { docId: string; tag: TagRow };
export function useAllDocTags(enabled = true): DocTagsEntry[] | undefined {
  const [data, setData] = useState<DocTagsEntry[] | undefined>(undefined);
  const lastJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      lastJsonRef.current = null;
      setData(undefined);
      return;
    }
    let active = true;
    lastJsonRef.current = null;
    async function load() {
      const { data: rows, error } = await supabase
        .from("document_tags")
        .select("docId, tags(*)");
      if (!active) return;
      if (error || !rows) {
        setData([]);
        return;
      }
      const entries = rows
        .map((r) => {
          const rec = r as unknown as { docId: string; tags?: TagRow | null };
          return rec.tags ? { docId: rec.docId, tag: rec.tags } : null;
        })
        .filter((e): e is DocTagsEntry => !!e);
      const json = JSON.stringify(entries);
      if (json === lastJsonRef.current) return;
      lastJsonRef.current = json;
      setData(entries);
    }
    void load();
    const unsubMap = subscribeTable("document_tags", () => void load());
    const unsubTags = subscribeTable("tags", () => void load());
    return () => {
      active = false;
      unsubMap();
      unsubTags();
    };
  }, [enabled]);
  return data;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

// Non-hook: tất cả tag của user (cho backup).
export async function getAllTags(): Promise<TagRow[]> {
  const { data } = await supabase.from("tags").select("*");
  return (data ?? []) as TagRow[];
}

// Tìm hoặc tạo tag theo tên (unique theo user+name).
async function findOrCreateTag(userId: string, name: string): Promise<string> {
  const { data: existing } = await supabase
    .from("tags")
    .select("_id")
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing._id;
  const { data: created, error } = await supabase
    .from("tags")
    .insert({ userId, name, color: randomColor() })
    .select("_id")
    .single();
  if (error || !created) throw error ?? new Error("Tạo tag thất bại");
  return created._id;
}

export async function createTag(name: string, color?: string): Promise<string> {
  const userId = await currentUserId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tên tag không được trống");
  const { data: existing } = await supabase
    .from("tags").select("_id").eq("name", trimmed).maybeSingle();
  if (existing) return existing._id;
  const { data, error } = await supabase
    .from("tags")
    .insert({ userId, name: trimmed, color: color ?? randomColor() })
    .select("_id").single();
  if (error || !data) throw error ?? new Error("Tạo tag thất bại");
  return data._id;
}

export async function addTagToDoc(docId: string, tagId: string): Promise<void> {
  const userId = await currentUserId();
  const { data: existing } = await supabase
    .from("document_tags").select("_id").eq("docId", docId).eq("tagId", tagId).maybeSingle();
  if (existing) return; // idempotent
  await supabase.from("document_tags").insert({ userId, docId, tagId });
}

export async function removeTagFromDoc(docId: string, tagId: string): Promise<void> {
  await supabase.from("document_tags").delete().eq("docId", docId).eq("tagId", tagId);
}

export async function createAndAddTagToDoc(docId: string, name: string): Promise<string> {
  const userId = await currentUserId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tên tag không được trống");
  const tagId = await findOrCreateTag(userId, trimmed);
  await addTagToDoc(docId, tagId);
  return tagId;
}
