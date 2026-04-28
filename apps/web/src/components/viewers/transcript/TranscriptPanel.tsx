"use client";

import { useEffect, useRef } from "react";
import { TranscriptSegment } from "@/lib/transcriptService";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  currentTime: number;
}

export function TranscriptPanel({ segments, currentTime }: TranscriptPanelProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  const activeIndex = segments.findLastIndex(
    (s) => currentTime >= s.start
  );

  // Auto-scroll đến segment đang active
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b shrink-0">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Transcript</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {segments.map((seg, i) => {
          const isActive = i === activeIndex;
          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              className={`rounded-lg px-3 py-2 transition-colors ${
                isActive
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted/50"
              }`}
            >
              <span className="text-xs font-mono text-muted-foreground mr-2 shrink-0">
                {formatTime(seg.start)}
              </span>
              <span className={`text-sm leading-relaxed ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {seg.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
