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
}

export function TranscriptButton({ docId, downloadUrl, mimeType, hasTranscript }: TranscriptButtonProps) {
  const [progress, setProgress] = useState<TranscriptProgress | null>(null);
  const isRunning = progress !== null && progress.phase !== "done" && progress.phase !== "error";

  const initTranscript = useMutation(api.transcripts.mutations.initTranscript);
  const updateStatus = useMutation(api.transcripts.mutations.updateStatus);
  const saveSegments = useMutation(api.transcripts.mutations.saveSegments);
  const getWebmChunks = useAction(api.transcripts.actions.getWebmChunks);
  const transcribeWebmChunk = useAction(api.transcripts.actions.transcribeWebmChunk);

  async function handleTranscribe() {
    if (isRunning) return;
    let transcriptId: Id<"transcripts"> | null = null;
    try {
      transcriptId = await initTranscript({ docId });
      await updateStatus({ transcriptId, status: "processing" });

      setProgress({ phase: "loading", message: "Đang phân tích file âm thanh..." });

      // Step 1: get chunk byte ranges from server
      const { chunks, headerBytes } = await getWebmChunks({ downloadUrl, mimeType });

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

        if (i > 0) await new Promise((r) => setTimeout(r, 3100));

        // Step 2: each chunk is one short-lived action call
        const result = await transcribeWebmChunk({
          downloadUrl,
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
        // Next chunk offset = end time of last segment in this chunk
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
