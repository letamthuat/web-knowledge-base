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
  const transcribeChunk = useAction(api.transcripts.actions.transcribeChunk);
  const transcribeFromUrl = useAction(api.transcripts.actions.transcribeFromUrl);

  async function handleTranscribe() {
    if (isRunning) return;
    let transcriptId: Id<"transcripts"> | null = null;
    try {
      transcriptId = await initTranscript({ docId });
      await updateStatus({ transcriptId, status: "processing" });

      setProgress({ phase: "loading", message: "Đang xử lý âm thanh..." });

      // Use server-side action — avoids client decodeAudioData which fails for live-recorded webm
      const { segments, language } = await transcribeFromUrl({
        downloadUrl,
        mimeType,
      });

      await saveSegments({ transcriptId, segments, language });
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
