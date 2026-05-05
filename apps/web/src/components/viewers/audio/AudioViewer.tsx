"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Id } from "@/_generated/dataModel";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { TranscriptPanel } from "@/components/viewers/transcript/TranscriptPanel";
import { SubtitleOverlay } from "@/components/viewers/transcript/SubtitleOverlay";
import { TranscriptButton } from "@/components/viewers/transcript/TranscriptButton";
import { useResizable } from "@/hooks/useResizable";

interface AudioViewerProps {
  doc: { _id: Id<"documents">; title: string; mimeType?: string };
  downloadUrl: string;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function AudioViewer({ doc, downloadUrl }: AudioViewerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(false);
  const { progress } = useReadingProgress(doc._id);
  const { savePosition, registerJump } = useReaderProgress();
  const restored = useRef(false);

  const { containerRef, leftPercent, onMouseDown } = useResizable(50);
  const transcript = useQuery(api.transcripts.queries.getByDoc, { docId: doc._id });
  const segments = transcript?.status === "completed" ? (transcript.segments ?? []) : [];
  const translatedSegments = transcript?.status === "completed" ? transcript.translatedSegments : undefined;
  const translatedLanguage = transcript?.translatedLanguage;

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "time_seconds" && audioRef.current) {
        const secs = (pos as { type: "time_seconds"; seconds: number }).seconds;
        audioRef.current.currentTime = secs;
      }
    });
  }, [registerJump]);

  // HTML5 audio element ref — no WaveSurfer for large file support
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onMeta = () => {
      setDuration(audio.duration);
      setReady(true);
      if (!restored.current && progress?.positionType === "time_seconds") {
        try {
          const pos = JSON.parse(progress.positionValue);
          if (typeof pos.seconds === "number" && pos.seconds < audio.duration) {
            audio.currentTime = pos.seconds;
          }
        } catch {}
        restored.current = true;
      }
    };
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      savePosition({ type: "time_seconds", seconds: audio.currentTime }, audio.duration || undefined);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadUrl]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.paused ? a.play() : a.pause();
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
      {/* Hidden audio element */}
      <audio ref={audioRef} src={downloadUrl} preload="metadata" />

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
        />
      </div>

      {/* Seek bar */}
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
        <input
          type="range" min={0} max={duration || 1} step={0.5}
          value={currentTime} onChange={seek}
          className="flex-1 accent-primary"
        />
        <span className="w-10 tabular-nums">{formatTime(duration)}</span>
      </div>

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

  // Nếu có transcript → split view: player trái, transcript phải
  if (segments.length > 0) {
    return (
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Player */}
        <div className="flex items-center justify-center bg-muted/40 p-8 overflow-hidden" style={{ width: `${leftPercent}%` }}>
          {playerPanel}
        </div>
        {/* Resize handle */}
        <div
          onMouseDown={onMouseDown}
          className="w-1.5 shrink-0 cursor-col-resize bg-border hover:bg-primary/50 active:bg-primary transition-colors"
        />
        {/* Transcript panel */}
        <div className="flex flex-col border-l bg-background overflow-hidden flex-1">
          <TranscriptPanel segments={segments} currentTime={currentTime} translatedSegments={translatedSegments} translatedLanguage={translatedLanguage} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-8">
      {playerPanel}
    </div>
  );
}

