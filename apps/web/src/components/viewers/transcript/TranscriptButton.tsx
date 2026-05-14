"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Captions, Loader2, RefreshCw, ChevronDown, Check, AlertTriangle } from "lucide-react";
import { TranscriptProgress } from "@/lib/transcriptService";
import { toast } from "sonner";

type Provider = "gemini" | "groq";

interface TranscriptButtonProps {
  docId: Id<"documents">;
  downloadUrl: string;
  mimeType: string;
  hasTranscript: boolean;
  fileSizeBytes?: number;
  durationSeconds?: number;
  onRunningChange?: (running: boolean) => void;
  extractAudioFn?: (bytes: Uint8Array) => Promise<Uint8Array>;
}

function getStoredProvider(): Provider {
  if (typeof window === "undefined") return "gemini";
  return (localStorage.getItem("transcriptProvider") as Provider) ?? "gemini";
}

function getStoredDiarization(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem("transcriptDiarization");
  return stored === null ? true : stored === "true";
}

export function TranscriptButton({ docId, mimeType, hasTranscript, fileSizeBytes, durationSeconds, onRunningChange, extractAudioFn }: TranscriptButtonProps) {
  const [progress, setProgress] = useState<TranscriptProgress | null>(null);
  const [provider, setProvider] = useState<Provider>(getStoredProvider);
  const [diarization, setDiarization] = useState<boolean>(getStoredDiarization);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [quotaDialog, setQuotaDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isRunning = progress !== null && progress.phase !== "done" && progress.phase !== "error";

  const aiSettings = useQuery(api.aiSettings.queries.getAiSettings);

  const initTranscript = useMutation(api.transcripts.mutations.initTranscript);
  const updateStatus = useMutation(api.transcripts.mutations.updateStatus);
  const saveSegments = useMutation(api.transcripts.mutations.saveSegments);
  const getWebmChunks = useAction(api.transcripts.actions.getWebmChunks);
  const getFreshDownloadUrl = useAction(api.documents.actions.getDownloadUrl);

  // Notify parent + block browser navigation when running
  useEffect(() => {
    onRunningChange?.(isRunning);
    if (!isRunning) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Đang tạo transcript, rời trang sẽ mất tiến độ. Bạn có chắc không?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isRunning, onRunningChange]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  function selectProvider(p: Provider) {
    setProvider(p);
    localStorage.setItem("transcriptProvider", p);
    if (p === "groq") {
      setDiarization(false);
      localStorage.setItem("transcriptDiarization", "false");
    }
  }

  function toggleDiarization() {
    const next = !diarization;
    setDiarization(next);
    localStorage.setItem("transcriptDiarization", String(next));
  }

  async function transcribeChunkViaApi(params: {
    downloadUrl: string;
    byteStart: number;
    byteEnd: number;
    headerBytes?: number;
    mimeType: string;
    chunkIndex: number;
    timeOffsetSeconds: number;
    language?: string;
    diarization?: boolean;
    geminiApiKey?: string;
    geminiModels?: string[];
    startModelIndex?: number;
  }): Promise<{ segments: { start: number; end: number; text: string; speaker?: string }[]; language: string; modelIndex?: number; chunkDurationSeconds?: number }> {
    const route = provider === "gemini" ? "/api/transcribe-chunk-gemini" : "/api/transcribe-chunk";
    const MAX_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (res.ok) return res.json();

      const err = await res.json().catch(() => ({ error: res.statusText }));
      const errMsg = typeof err.error === "string" ? err.error : String(err.error ?? res.statusText);

      const is429 = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("All models failed");
      const is503 = errMsg.includes("503") || errMsg.includes("UNAVAILABLE");

      // Nếu hết quota hoàn toàn (all models failed) → báo ngay, không retry
      const isQuotaExhausted = errMsg.includes("All models failed") || (errMsg.includes("429") && errMsg.includes("limit: 0"));
      if (isQuotaExhausted) {
        throw new Error("__QUOTA_EXHAUSTED__");
      }

      if ((is429 || is503) && attempt < MAX_RETRIES - 1) {
        const match = errMsg.match(/try again in (\d+)m(\d+)s/);
        const retryMatch = errMsg.match(/retry in (\d+)s/);
        const waitMs = match
          ? (parseInt(match[1]) * 60 + parseInt(match[2]) + 5) * 1000
          : retryMatch
          ? (parseInt(retryMatch[1]) + 5) * 1000
          : is503
          ? 15000 + attempt * 10000
          : 60000 + attempt * 30000;
        const waitSec = Math.round(waitMs / 1000);
        toast.warning(`Đang chờ ${waitSec}s rồi thử lại (chunk ${params.chunkIndex + 1})...`, { duration: waitMs });
        console.log(`[TranscriptButton] chunk=${params.chunkIndex} ${is503 ? "503 overload" : "rate limited"} (${provider}), retry in ${waitSec}s`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw new Error(errMsg ?? `HTTP ${res.status}`);
    }
    throw new Error("Max retries exceeded");
  }

  const isVideo = mimeType.startsWith("video/");

  async function transcribeVideoChunkViaApi(params: {
    chunkUrl: string;
    byteStart: number;
    byteEnd: number;
    chunkIndex: number;
    timeOffsetSeconds: number;
  }): Promise<{ segments: { start: number; end: number; text: string; speaker?: string }[]; language: string; modelIndex?: number }> {
    // Fetch video chunk bytes
    const res = await fetch(params.chunkUrl, { headers: { Range: `bytes=${params.byteStart}-${params.byteEnd - 1}` } });
    if (!res.ok && res.status !== 206) throw new Error(`Fetch video chunk failed: ${res.status}`);
    const videoBytes = new Uint8Array(await res.arrayBuffer());

    if (videoBytes.byteLength === 0) {
      console.warn(`[TranscriptButton] video chunk=${params.chunkIndex} empty, skipping`);
      return { segments: [], language: "vi" };
    }

    // Extract audio via ffmpeg.wasm
    if (!extractAudioFn) throw new Error("extractAudioFn not provided for video");
    setProgress({ phase: "transcribing", chunkIndex: params.chunkIndex + 1, totalChunks: undefined, message: `Đang tách audio chunk ${params.chunkIndex + 1}...` });
    const audioBytes = await extractAudioFn(videoBytes);

    if (audioBytes.byteLength === 0) {
      console.warn(`[TranscriptButton] video chunk=${params.chunkIndex} audio extraction empty, skipping`);
      return { segments: [], language: "vi" };
    }

    // Encode to base64 and send to route
    const base64Audio = btoa(String.fromCharCode(...audioBytes));
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const apiRes = await fetch("/api/transcribe-audio-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType: "audio/webm",
          chunkIndex: params.chunkIndex,
          timeOffsetSeconds: params.timeOffsetSeconds,
          diarization: diarization,
          ...(aiSettings?.geminiApiKey ? { geminiApiKey: aiSettings.geminiApiKey } : {}),
          ...(aiSettings?.geminiModels?.length ? { geminiModels: aiSettings.geminiModels } : {}),
        }),
      });
      if (apiRes.ok) return apiRes.json();
      const err = await apiRes.json().catch(() => ({ error: apiRes.statusText }));
      const errMsg = typeof err.error === "string" ? err.error : String(err.error ?? apiRes.statusText);
      const isQuotaExhausted = errMsg.includes("All models failed") || (errMsg.includes("429") && errMsg.includes("limit: 0"));
      if (isQuotaExhausted) throw new Error("__QUOTA_EXHAUSTED__");
      const is429 = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED");
      const is503 = errMsg.includes("503") || errMsg.includes("UNAVAILABLE");
      if ((is429 || is503) && attempt < MAX_RETRIES - 1) {
        const waitMs = is503 ? 15000 + attempt * 10000 : 60000 + attempt * 30000;
        toast.warning(`Đang chờ ${Math.round(waitMs / 1000)}s rồi thử lại (chunk ${params.chunkIndex + 1})...`, { duration: waitMs });
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw new Error(errMsg ?? `HTTP ${apiRes.status}`);
    }
    throw new Error("Max retries exceeded");
  }

  async function handleTranscribe() {
    if (isRunning) return;
    setDropdownOpen(false);

    // Check Gemini settings if using Gemini provider
    if (provider === "gemini" && aiSettings !== undefined && !aiSettings?.geminiApiKey) {
      toast.warning("Chưa cấu hình Gemini API key. Vào Cài đặt → Trợ lý AI để setup.");
      return;
    }

    // Video requires ffmpeg.wasm — check SharedArrayBuffer support
    if (isVideo && typeof SharedArrayBuffer === "undefined") {
      toast.error("Trình duyệt không hỗ trợ tính năng này (thiếu SharedArrayBuffer). Thử Chrome/Edge.");
      return;
    }

    let transcriptId: Id<"transcripts"> | null = null;
    try {
      transcriptId = await initTranscript({ docId });
      await updateStatus({ transcriptId, status: "processing" });

      setProgress({ phase: "loading", message: isVideo ? "Đang phân tích file video..." : "Đang phân tích file âm thanh..." });

      // Pre-load ffmpeg.wasm for video before starting chunks
      if (isVideo && extractAudioFn) {
        setProgress({ phase: "loading", message: "Đang tải ffmpeg..." });
        const { loadFFmpeg } = await import("@/hooks/useFFmpeg");
        await loadFFmpeg();
      }

      const freshUrl = await getFreshDownloadUrl({ docId });
      const webmInfo = await getWebmChunks({ downloadUrl: freshUrl, mimeType, fileSizeBytes, durationSeconds });
      const { chunks, headerBytes } = webmInfo;

      const allSegments: { start: number; end: number; text: string; speaker?: string }[] = [];
      let detectedLanguage = "vi";
      let currentModelIndex = 0;
      const BATCH_SIZE = provider === "gemini" ? 3 : 1;
      const segmentsByChunk: (typeof allSegments)[] = new Array(chunks.length).fill(null).map(() => []);
      const durationByChunk: number[] = new Array(chunks.length).fill(0);

      for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
        const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, k) => batchStart + k);

        setProgress({
          phase: "transcribing",
          chunkIndex: batchEnd,
          totalChunks: chunks.length,
          message: `Đang nhận dạng giọng nói... (${batchEnd}/${chunks.length})`,
        });

        if (batchStart > 0) await new Promise((r) => setTimeout(r, provider === "gemini" ? 1000 : 15000));

        // Pre-fetch URLs for all chunks in batch in parallel
        const batchUrls = await Promise.all(batchIndices.map(() => getFreshDownloadUrl({ docId })));

        // Compute timeOffset for each chunk based on byte position
        const batchResults = await Promise.all(batchIndices.map((i, k) => {
          const byteOffset = chunks[i].byteStart;
          const timeOffsetEst = durationSeconds && fileSizeBytes
            ? (byteOffset / fileSizeBytes) * durationSeconds
            : 0;

          if (isVideo) {
            return transcribeVideoChunkViaApi({
              chunkUrl: batchUrls[k],
              byteStart: chunks[i].byteStart,
              byteEnd: chunks[i].byteEnd,
              chunkIndex: i,
              timeOffsetSeconds: timeOffsetEst,
            });
          }

          return transcribeChunkViaApi({
            downloadUrl: batchUrls[k],
            mimeType,
            byteStart: chunks[i].byteStart,
            byteEnd: chunks[i].byteEnd,
            headerBytes,
            chunkIndex: i,
            timeOffsetSeconds: timeOffsetEst,
            language: undefined,
            diarization: provider === "gemini" ? diarization : false,
            ...(provider === "gemini" && aiSettings?.geminiApiKey
              ? { geminiApiKey: aiSettings.geminiApiKey }
              : {}),
            ...(provider === "gemini" && aiSettings?.geminiModels?.length
              ? { geminiModels: aiSettings.geminiModels }
              : {}),
            ...(provider === "gemini" ? { startModelIndex: currentModelIndex } : {}),
          });
        }));

        for (let k = 0; k < batchIndices.length; k++) {
          const i = batchIndices[k];
          const result = batchResults[k];
          if (provider === "gemini" && typeof result.modelIndex === "number") {
            currentModelIndex = result.modelIndex;
          }
          segmentsByChunk[i] = result.segments;
          durationByChunk[i] = (result as { chunkDurationSeconds?: number }).chunkDurationSeconds ?? 0;
          detectedLanguage = result.language;
        }
      }

      // Flatten segments in order
      for (const segs of segmentsByChunk) {
        allSegments.push(...segs);
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

      if (message === "__QUOTA_EXHAUSTED__") {
        setQuotaDialog(true);
      } else {
        toast.error(`Tạo transcript thất bại: ${message}`);
      }
    } finally {
      setTimeout(() => setProgress(null), 2000);
    }
  }

  const providerLabel = provider === "gemini" ? "Gemini" : "Groq";

  return (
    <div className="flex items-center gap-1">
      {/* Quota exhausted dialog */}
      {quotaDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-sm rounded-lg border bg-background p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <h3 className="font-semibold">Hết quota API</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tất cả models đã hết quota.
                  {provider === "gemini"
                    ? " Vào Cài đặt → Trợ lý AI để đổi API key hoặc thêm model khác."
                    : " Quota Groq đã hết, thử lại sau hoặc chuyển sang Gemini."}
                </p>
                <div className="mt-4 flex gap-2">
                  {provider === "gemini" && (
                    <Button size="sm" variant="outline" onClick={() => { setQuotaDialog(false); window.location.href = "/settings"; }}>
                      Mở Cài đặt
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setQuotaDialog(false)}>
                    Đã hiểu
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main transcript button */}
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

      {/* Provider selector dropdown */}
      {!isRunning && (
        <div className="relative" ref={dropdownRef}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDropdownOpen((o) => !o)}
            className="gap-1 px-2 text-xs text-muted-foreground h-8"
          >
            {providerLabel}
            <ChevronDown className="h-3 w-3" />
          </Button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border bg-popover shadow-md">
              <div className="p-1">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Provider</p>

                {(["gemini", "groq"] as Provider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => selectProvider(p)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Check className={`h-3.5 w-3.5 ${provider === p ? "opacity-100" : "opacity-0"}`} />
                    {p === "gemini" ? "Gemini Flash" : "Groq Whisper"}
                  </button>
                ))}

                {provider === "gemini" && (
                  <>
                    <div className="my-1 border-t" />
                    <button
                      onClick={toggleDiarization}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <Check className={`h-3.5 w-3.5 ${diarization ? "opacity-100" : "opacity-0"}`} />
                      Nhận dạng người nói
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
