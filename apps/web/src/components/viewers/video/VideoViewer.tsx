"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Id } from "@/_generated/dataModel";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";

interface VideoViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

export function VideoViewer({ doc, downloadUrl }: VideoViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const { progress } = useReadingProgress(doc._id);
  const { savePosition, registerJump } = useReaderProgress();
  const restored = useRef(false);

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "time_seconds" && videoRef.current) {
        videoRef.current.currentTime = (pos as { type: "time_seconds"; seconds: number }).seconds;
      }
    });
  }, [registerJump]);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    if (!restored.current && progress?.positionType === "time_seconds") {
      try {
        const pos = JSON.parse(progress.positionValue);
        if (typeof pos.seconds === "number" && pos.seconds < v.duration) {
          v.currentTime = pos.seconds;
        }
      } catch {}
      restored.current = true;
    }
  }, [progress]);

  const lastSaveRef = useRef(0);
  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    // Throttle to once per 10s to avoid flooding
    const now = Date.now();
    if (now - lastSaveRef.current < 10000) return;
    lastSaveRef.current = now;
    savePosition({ type: "time_seconds", seconds: v.currentTime }, v.duration || undefined);
  }, [savePosition]);

  return (
    <div className="flex flex-1 items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={downloadUrl}
        controls
        className="max-h-full max-w-full"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        preload="metadata"
      >
        Trình duyệt không hỗ trợ video.
      </video>
    </div>
  );
}
