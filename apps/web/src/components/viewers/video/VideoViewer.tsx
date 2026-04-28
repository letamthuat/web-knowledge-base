"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Id } from "@/_generated/dataModel";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { TranscriptPanel } from "@/components/viewers/transcript/TranscriptPanel";
import { SubtitleOverlay } from "@/components/viewers/transcript/SubtitleOverlay";
import { TranscriptButton } from "@/components/viewers/transcript/TranscriptButton";

interface VideoViewerProps {
  doc: { _id: Id<"documents">; title: string; mimeType?: string };
  downloadUrl: string;
}

export function VideoViewer({ doc, downloadUrl }: VideoViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const { progress } = useReadingProgress(doc._id);
  const { savePosition, registerJump } = useReaderProgress();
  const restored = useRef(false);
  const lastSaveRef = useRef(0);

  const transcript = useQuery(api.transcripts.queries.getByDoc, { docId: doc._id });
  const segments = transcript?.status === "completed" ? (transcript.segments ?? []) : [];

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

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    const now = Date.now();
    if (now - lastSaveRef.current < 10000) return;
    lastSaveRef.current = now;
    savePosition({ type: "time_seconds", seconds: v.currentTime }, v.duration || undefined);
  }, [savePosition]);

  const videoEl = (
    <div className="relative flex flex-1 items-center justify-center bg-black min-h-0">
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
      {/* Subtitle overlay */}
      {segments.length > 0 && (
        <SubtitleOverlay segments={segments} currentTime={currentTime} />
      )}
    </div>
  );

  // Nếu có transcript → split view: video trên/trái, transcript phải
  if (segments.length > 0) {
    return (
      <div className="flex flex-1 overflow-hidden">
        {/* Video + subtitle */}
        <div className="flex flex-[3] flex-col overflow-hidden">
          {videoEl}
          {/* Transcript button dưới video */}
          <div className="flex justify-center py-2 border-t bg-background">
            <TranscriptButton
              docId={doc._id}
              downloadUrl={downloadUrl}
              mimeType={doc.mimeType ?? "video/mp4"}
              hasTranscript={true}
            />
          </div>
        </div>
        {/* Transcript panel */}
        <div className="flex flex-[2] flex-col border-l bg-background overflow-hidden">
          <TranscriptPanel segments={segments} currentTime={currentTime} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {videoEl}
      <div className="flex justify-center py-2 border-t bg-background">
        <TranscriptButton
          docId={doc._id}
          downloadUrl={downloadUrl}
          mimeType={doc.mimeType ?? "video/mp4"}
          hasTranscript={false}
        />
      </div>
    </div>
  );
}
