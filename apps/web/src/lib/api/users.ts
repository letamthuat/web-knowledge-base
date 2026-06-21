"use client";
// Domain users → bảng profiles trên Supabase (hồ sơ + preferences).
import { supabase } from "@/lib/supabase/client";
import { useRealtimeOne } from "@/hooks/useRealtimeQuery";

export type ReadingModePref = {
  fontFamily?: "serif" | "sans" | "mono";
  fontSize?: number;
  lineHeight?: number;
  columnWidth?: "narrow" | "medium" | "wide";
  themeByFormat?: Record<string, "light" | "sepia" | "dark">;
};

export type UserPreferences = {
  readingMode?: ReadingModePref;
  [key: string]: unknown;
};

export type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  preferences: UserPreferences | null;
  createdAt: number;
  updatedAt: number;
};

// ─── READS ──────────────────────────────────────────────────────────────────
// Hồ sơ của user hiện tại (RLS chỉ trả về hàng của chính mình).
export function useMe(): ProfileRow | null | undefined {
  return useRealtimeOne<ProfileRow>("profiles");
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────
export async function updateReadingModePreferences(args: ReadingModePref): Promise<void> {
  const userId = await currentUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();

  const prefs = (profile?.preferences ?? {}) as UserPreferences;
  const existing = prefs.readingMode ?? {};
  const newThemeByFormat = args.themeByFormat
    ? { ...(existing.themeByFormat ?? {}), ...args.themeByFormat }
    : existing.themeByFormat;

  const readingMode: ReadingModePref = {
    ...existing,
    ...(args.fontFamily !== undefined ? { fontFamily: args.fontFamily } : {}),
    ...(args.fontSize !== undefined ? { fontSize: Math.min(28, Math.max(12, args.fontSize)) } : {}),
    ...(args.lineHeight !== undefined ? { lineHeight: Math.min(2.0, Math.max(1.4, args.lineHeight)) } : {}),
    ...(args.columnWidth !== undefined ? { columnWidth: args.columnWidth } : {}),
    ...(newThemeByFormat !== undefined ? { themeByFormat: newThemeByFormat } : {}),
  };

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: { ...prefs, readingMode }, updatedAt: Date.now() })
    .eq("id", userId);
  if (error) throw error;
}
