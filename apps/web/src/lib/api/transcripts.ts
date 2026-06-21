"use client";
// Domain transcripts trên Supabase (phần đọc). Phần ghi/transcribe = Phase 4 (server routes).
import { supabase } from "@/lib/supabase/client";
import { useRealtimeOne } from "@/hooks/useRealtimeQuery";
import type { TranscriptSegment } from "@/lib/transcriptService";

export type TranscriptStatus = "pending" | "processing" | "completed" | "error";

export type TranscriptRow = {
  _id: string;
  docId: string;
  userId: string;
  status: TranscriptStatus;
  segments: TranscriptSegment[] | null;
  translatedSegments: TranscriptSegment[] | null;
  language: string | null;
  translatedLanguage: string | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
};

// ─── READS ──────────────────────────────────────────────────────────────────
// Transcript của 1 document (hoặc null).
export function useTranscriptByDoc(docId: string | undefined): TranscriptRow | null | undefined {
  return useRealtimeOne<TranscriptRow>("transcripts", {
    filter: { docId: docId ?? "" },
    enabled: !!docId,
  });
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

// ─── MUTATIONS (DB thuần; getWebmChunks vẫn là action Phase 4) ──────────────────
// Tạo (hoặc reset) transcript về trạng thái pending.
export async function initTranscript(docId: string): Promise<string> {
  const userId = await currentUserId();
  const now = Date.now();
  await supabase.from("transcripts").delete().eq("docId", docId);
  const { data, error } = await supabase
    .from("transcripts")
    .insert({ docId, userId, status: "pending", createdAt: now, updatedAt: now })
    .select("_id")
    .single();
  if (error || !data) throw error ?? new Error("Tạo transcript thất bại");
  return data._id;
}

export async function updateTranscriptStatus(
  transcriptId: string,
  status: "processing" | "error",
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabase
    .from("transcripts")
    .update({ status, ...(errorMessage ? { errorMessage } : {}), updatedAt: Date.now() })
    .eq("_id", transcriptId);
  if (error) throw error;
}

export async function saveTranscriptSegments(args: {
  transcriptId: string;
  segments: TranscriptSegment[];
  language?: string;
  translatedSegments?: TranscriptSegment[];
  translatedLanguage?: string;
}): Promise<void> {
  const { error } = await supabase
    .from("transcripts")
    .update({
      status: "completed",
      segments: args.segments,
      language: args.language ?? null,
      ...(args.translatedSegments
        ? { translatedSegments: args.translatedSegments, translatedLanguage: args.translatedLanguage ?? null }
        : {}),
      updatedAt: Date.now(),
    })
    .eq("_id", args.transcriptId);
  if (error) throw error;
}
