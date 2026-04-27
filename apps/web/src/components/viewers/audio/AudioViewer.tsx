"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Id } from "@convex/_generated/dataModel";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface AudioViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function AudioViewer({ doc, downloadUrl }: AudioViewerProps) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<import("wavesurfer.js").default | null>(null);
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

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "time_seconds" && wsRef.current) {
        const dur = wsRef.current.getDuration();
        const secs = (pos as { type: "time_seconds"; seconds: number }).seconds;
        if (dur > 0) wsRef.current.seekTo(secs / dur);
      }
    });
  }, [registerJump]);

  useEffect(() => {
    if (!waveRef.current) return;
    let cancelled = false;

    (async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      if (cancelled) return;

      const ws = WaveSurfer.create({
        container: waveRef.current!,
        waveColor: "hsl(var(--muted-foreground) / 0.4)",
        progressColor: "hsl(var(--primary))",
        cursorColor: "hsl(var(--primary))",
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 64,
        normalize: true,
        url: downloadUrl,
      });
      wsRef.current = ws;

      ws.on("ready", (dur) => {
        if (cancelled) return;
        setDuration(dur);
        setReady(true);
        // Restore position
        if (!restored.current && progress?.positionType === "time_seconds") {
          try {
            const pos = JSON.parse(progress.positionValue);
            if (typeof pos.seconds === "number" && pos.seconds < dur) {
              ws.seekTo(pos.seconds / dur);
            }
          } catch {}
          restored.current = true;
        }
      });

      ws.on("timeupdate", (t) => {
        setCurrentTime(t);
        savePosition({ type: "time_seconds", seconds: t }, wsRef.current?.getDuration() || undefined);
      });

      ws.on("play", () => setPlaying(true));
      ws.on("pause", () => setPlaying(false));
      ws.on("finish", () => setPlaying(false));
    })();

    return () => {
      cancelled = true;
      wsRef.current?.destroy();
      wsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadUrl]);

  const togglePlay = useCallback(() => wsRef.current?.playPause(), []);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    if (wsRef.current && duration > 0) wsRef.current.seekTo(t / duration);
    setCurrentTime(t);
  }, [duration]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    wsRef.current?.setMuted(next);
    setMuted(next);
  }, [muted]);

  const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    wsRef.current?.setVolume(v);
    setVolume(v);
  }, []);

  const changeSpeed = useCallback((s: number) => {
    wsRef.current?.setPlaybackRate(s);
    setSpeed(s);
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-8">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-lg">
        {/* Waveform */}
        <div className="mb-5 rounded-xl bg-muted/50 px-3 py-4">
          <div ref={waveRef} />
          {!ready && (
            <div className="flex h-16 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>

        <h2 className="mb-5 truncate text-center text-base font-semibold">{doc.title}</h2>

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

        {/* Controls row */}
        <div className="flex items-center justify-between">
          {/* Volume */}
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <input
              type="range" min={0} max={1} step={0.05}
              value={volume} onChange={changeVolume}
              className="w-16 accent-primary"
            />
          </div>

          {/* Play/Pause */}
          <Button size="icon" className="h-12 w-12 rounded-full" onClick={togglePlay} disabled={!ready}>
            {playing
              ? <Pause className="h-5 w-5" />
              : <Play className="h-5 w-5 translate-x-0.5" />
            }
          </Button>

          {/* Speed */}
          <div className="flex items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => changeSpeed(s)}
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                  speed === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
