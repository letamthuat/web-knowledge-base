"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Captions, Loader2, RefreshCw } from "lucide-react";
import { TranscriptProgress } from "@/lib/transcriptService";
import { toast } from "sonner";

interface TranscriptButtonProps {
  docId: Id<"documents">;
  downloadUrl: string;
  mimeType: string;
  hasTranscript: boolean;
  fileSizeBytes?: number;
}

export function TranscriptButton({ docId, mimeType, hasTranscript, fileSizeBytes }: TranscriptButtonProps) {
  const [progress, setProgress] = useState<TranscriptProgress | null>(null);
  const isRunning = progress !== null && progress.phase !== "done" && progress.phase !== "error";

  const initTranscript = useMutation(api.transcripts.mutations.initTranscript);
  const updateStatus = useMutation(api.transcripts.mutations.updateStatus);
  const saveSegments = useMutation(api.transcripts.mutations.saveSegments);
  const getWebmChunks = useAction(api.transcripts.actions.getWebmChunks);
  const getFreshDownloadUrl = useAction(api.documents.actions.getDownloadUrl);

  async function transcribeChunkViaApi(params: {
    downloadUrl: string;
    byteStart: number;
    byteEnd: number;
    headerBytes?: number;
    mimeType: string;
    chunkIndex: number;
    timeOffsetSeconds: number;
    language?: string;
  }): Promise<{ segments: { start: number; end: number; text: string }[]; language: string }> {
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await fetch("/api/transcribe-chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (res.ok) return res.json();
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const is429 = typeof err.error === "string" && err.error.includes("429");
      if (is429 && attempt < MAX_RETRIES - 1) {
        // Parse "Please try again in Xm Ys" from Groq message
        const match = typeof err.error === "string" && err.error.match(/try again in (\d+)m(\d+)s/);
        const groqWait = match ? (parseInt(match[1]) * 60 + parseInt(match[2]) + 5) * 1000 : 60000 + attempt * 30000;
        console.log(`[TranscriptButton] chunk=${params.chunkIndex} rate limited, retrying in ${groqWait/1000}s...`);
        await new Promise((r) => setTimeout(r, groqWait));
        continue;
      }
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    throw new Error("Max retries exceeded");
  }

  async function handleTranscribe() {
    if (isRunning) return;
    let transcriptId: Id<"transcripts"> | null = null;
    try {
      transcriptId = await initTranscript({ docId });
      await updateStatus({ transcriptId, status: "processing" });

      setProgress({ phase: "loading", message: "Đang phân tích file âm thanh..." });

      // Get fresh presigned URL (cached URL may have expired after 15 min)
      const freshUrl = await getFreshDownloadUrl({ docId });

      // Step 1: get chunk byte ranges from Convex (lightweight — no binary data)
      const webmInfo = await getWebmChunks({ downloadUrl: freshUrl, mimeType, fileSizeBytes });
      const { chunks, headerBytes } = webmInfo;

      const allSegments: { start: number; end: number; text: string }[] = [];
      let detectedLanguage = "vi";
      let timeOffsetSeconds = 0;

      for (let i = 0; i < chunks.length; i++) {
        setProgress({
          phase: "transcribing",
          chunkIndex: i + 1,
          totalChunks: chunks.length,
          message: `Đang nhận dạng giọng nói... (${i + 1}/${chunks.length})`,
        });

        if (i > 0) await new Promise((r) => setTimeout(r, 15000));

        // Refresh URL before each chunk — presigned URL expires in 15 min
        const chunkUrl = await getFreshDownloadUrl({ docId });

        // Step 2: transcribe via Next.js API route (not Convex — avoids memory/timeout limits)
        const result = await transcribeChunkViaApi({
          downloadUrl: chunkUrl,
          mimeType,
          byteStart: chunks[i].byteStart,
          byteEnd: chunks[i].byteEnd,
          headerBytes,
          chunkIndex: i,
          timeOffsetSeconds,
          language: undefined,
        });

        allSegments.push(...result.segments);
        detectedLanguage = result.language;
        if (result.segments.length > 0) {
          timeOffsetSeconds = result.segments[result.segments.length - 1].end;
        }
      }

      await saveSegments({ transcriptId, segments: allSegments, language: detectedLanguage });
      setProgress({ phase: "done", message: "Hoàn tất!" });
      toast.success("Đã tạo transcript thành công");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Lỗi không xác định";
      console.error("[TranscriptButton] error:", err);
      if (transcriptId) {
        await updateStatus({ transcriptId, status: "error", errorMessage: message });
      }
      setProgress({ phase: "error", message });
      toast.error(`Tạo transcript thất bại: ${message}`);
    } finally {
      setTimeout(() => setProgress(null), 2000);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleTranscribe}
      disabled={isRunning}
      className="gap-2"
    >
      {isRunning ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : hasTranscript ? (
        <RefreshCw className="h-4 w-4" />
      ) : (
        <Captions className="h-4 w-4" />
      )}
      {isRunning
        ? progress?.totalChunks
          ? `${progress.chunkIndex}/${progress.totalChunks}`
          : "Đang xử lý..."
        : hasTranscript
        ? "Tạo lại"
        : "Tạo transcript"}
    </Button>
  );
}
