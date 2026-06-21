"use client";
// Domain aiSettings → bảng userAiSettings trên Supabase (Gemini API key + models).
import { supabase } from "@/lib/supabase/client";
import { useRealtimeOne } from "@/hooks/useRealtimeQuery";

export type AiSettingsRow = {
  _id: string;
  userId: string;
  geminiApiKey: string | null;
  geminiModels: string[] | null;
  updatedAt: number;
};

// ─── READS ──────────────────────────────────────────────────────────────────
// AI settings của user hiện tại (RLS chỉ trả về hàng của chính mình).
export function useAiSettings(): AiSettingsRow | null | undefined {
  return useRealtimeOne<AiSettingsRow>("userAiSettings");
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────
// Upsert (1 hàng / user nhờ unique userId).
export async function saveAiSettings(args: {
  geminiApiKey?: string;
  geminiModels?: string[];
}): Promise<void> {
  const userId = await currentUserId();
  const { data: existing } = await supabase
    .from("userAiSettings")
    .select("_id")
    .eq("userId", userId)
    .maybeSingle();

  const patch = {
    ...(args.geminiApiKey !== undefined ? { geminiApiKey: args.geminiApiKey } : {}),
    ...(args.geminiModels !== undefined ? { geminiModels: args.geminiModels } : {}),
    updatedAt: Date.now(),
  };

  if (existing) {
    const { error } = await supabase.from("userAiSettings").update(patch).eq("_id", existing._id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("userAiSettings").insert({ userId, ...patch });
    if (error) throw error;
  }
}
