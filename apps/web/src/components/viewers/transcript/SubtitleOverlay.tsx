"use client";

import { TranscriptSegment } from "@/lib/transcriptService";

interface SubtitleOverlayProps {
  segments: TranscriptSegment[];
  currentTime: number;
}

export function SubtitleOverlay({ segments, currentTime }: SubtitleOverlayProps) {
  const active = segments.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  if (!active) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="max-w-2xl px-4 py-2 rounded-md bg-black/70 text-white text-center text-sm leading-relaxed">
        {active.text}
      </div>
    </div>
  );
}
