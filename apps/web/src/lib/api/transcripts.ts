"use client";
// Domain transcripts trên Supabase (phần đọc). Phần ghi/transcribe = Phase 4 (server routes).
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
