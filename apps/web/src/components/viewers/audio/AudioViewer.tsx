"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Id } from "@/_generated/dataModel";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { useTranscriptByDoc } from "@/lib/api/transcripts";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react";
import { TranscriptPanel } from "@/components/viewers/transcript/TranscriptPanel";
import { TranscriptButton } from "@/components/viewers/transcript/TranscriptButton";
import { useResizable } from "@/hooks/useResizable";

interface AudioViewerProps {
  doc: { _id: Id<"documents">; title: string; mimeType?: string; durationMs?: number; fileSizeBytes?: number };
  downloadUrl: string;
  onTranscribeRunningChange?: (running: boolean) => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function AudioViewer({ doc, downloadUrl, onTranscribeRunningChange }: AudioViewerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => doc.durationMs ? doc.durationMs / 1000 : 0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(() => !!doc.durationMs);
  const { progress } = useReadingProgress(doc._id);
  const { savePosition, registerJump } = useReaderProgress();
  const restored = useRef(false);

  const { containerRef, leftPercent, onMouseDown } = useResizable(50);
  const transcript = useTranscriptByDoc(doc._id);
  const segments = transcript?.status === "completed" ? (transcript.segments ?? []) : [];
  const translatedSegments = transcript?.status === "completed" ? (transcript.translatedSegments ?? undefined) : undefined;
  const translatedLanguage = transcript?.translatedLanguage ?? undefined;

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "time_seconds" && audioRef.current) {
        const secs = (pos as { type: "time_seconds"; seconds: number }).seconds;
        audioRef.current.currentTime = secs;
      }
    });
  }, [registerJump]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onMeta = () => {
      const dur = audio.duration;
      if (isFinite(dur)) setDuration(dur);
      setReady(true);
      if (!restored.current && progress?.positionType === "time_seconds") {
        try {
          const pos = JSON.parse(progress.positionValue);
          if (typeof pos.seconds === "number" && (isFinite(dur) ? pos.seconds < dur : true)) {
            audio.currentTime = pos.seconds;
          }
        } catch {}
        restored.current = true;
      }
    };
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      if (!isFinite(audio.duration)) {
        setDuration((prev) => Math.max(prev, audio.currentTime));
      } else {
        setDuration(audio.duration);
      }
      savePosition({ type: "time_seconds", seconds: audio.currentTime }, isFinite(audio.duration) ? audio.duration : undefined);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onDurationChange = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onError = () => setReady(true);

    const readyTimer = setTimeout(() => setReady(true), 5000);

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      clearTimeout(readyTimer);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch((e) => {
        if (e?.name !== "AbortError") console.error("[AudioViewer] play error:", e);
      });
    } else {
      a.pause();
    }
  }, []);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    if (audioRef.current) audioRef.current.muted = next;
    setMuted(next);
  }, [muted]);

  const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (audioRef.current) audioRef.current.volume = v;
    setVolume(v);
  }, []);

  const changeSpeed = useCallback((s: number) => {
    if (audioRef.current) audioRef.current.playbackRate = s;
    setSpeed(s);
  }, []);

  const playerPanel = (
    <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-lg">
      {/* Visual placeholder where waveform was */}
      <div className="mb-5 rounded-xl bg-muted/50 px-3 py-4 flex h-20 items-center justify-center">
        {!ready ? (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <div className="flex w-full items-end justify-center gap-0.5 h-12">
            {Array.from({ length: 40 }, (_, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-colors ${
                  duration > 0 && (i / 40) < (currentTime / duration)
                    ? "bg-primary"
                    : "bg-muted-foreground/30"
                }`}
                style={{ height: `${20 + Math.sin(i * 0.8) * 15 + Math.cos(i * 0.4) * 10}%` }}
              />
            ))}
          </div>
        )}
      </div>

      <h2 className="mb-3 truncate text-center text-base font-semibold">{doc.title}</h2>

      {/* Transcript button */}
      <div className="mb-4 flex justify-center">
        <TranscriptButton
          docId={doc._id}
          downloadUrl={downloadUrl}
          mimeType={doc.mimeType ?? "audio/mpeg"}
          hasTranscript={segments.length > 0}
          fileSizeBytes={doc.fileSizeBytes}
          durationSeconds={doc.durationMs ? doc.durationMs / 1000 : (duration > 0 ? duration : undefined)}
          onRunningChange={onTranscribeRunningChange}
        />
      </div>

      {/* Seek bar */}
      {isFinite(duration) && duration > 0 ? (
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
          <input
            type="range" min={0} max={duration} step={0.5}
            value={currentTime} onChange={seek}
            className="flex-1 accent-primary"
          />
          <span className="w-10 tabular-nums">{formatTime(duration)}</span>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatTime(currentTime)}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10);
            }} title="Tua lùi 10s">
              <SkipBack className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] text-muted-foreground/60">±10s</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = currentTime + 10;
            }} title="Tua tới 10s">
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
          </div>
          <span className="text-[11px] text-muted-foreground/60">Không có thông tin tổng thời gian</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={toggleMute}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <input
            type="range" min={0} max={1} step={0.05}
            value={volume} onChange={changeVolume}
            className="w-16 accent-primary"
          />
        </div>
        <Button size="icon" className="h-12 w-12 rounded-full" onClick={togglePlay} disabled={!ready}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
        </Button>
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Audio element rendered outside playerPanel so ref is always populated before useEffect runs
  const audioEl = <audio ref={audioRef} src={downloadUrl} preload="metadata" className="hidden" />;

  if (segments.length > 0) {
    return (
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {audioEl}
        <div className="flex items-center justify-center bg-muted/40 p-8 overflow-hidden" style={{ width: `${leftPercent}%` }}>
          {playerPanel}
        </div>
        <div
          onMouseDown={onMouseDown}
          className="w-1.5 shrink-0 cursor-col-resize bg-border hover:bg-primary/50 active:bg-primary transition-colors"
        />
        <div className="flex flex-col border-l bg-background overflow-hidden flex-1">
          <TranscriptPanel segments={segments} currentTime={currentTime} translatedSegments={translatedSegments} translatedLanguage={translatedLanguage} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-8">
      {audioEl}
      {playerPanel}
    </div>
  );
}
