"use client";
// Domain tags + document_tags trên Supabase.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

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
  useEffect(() => {
    if (!docId) {
      setData(undefined);
      return;
    }
    let active = true;
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
      setData(tags);
    }
    void load();
    const channel = supabase
      .channel(`rt:document_tags:${docId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "document_tags" }, () => void load())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [docId]);
  return data;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
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
