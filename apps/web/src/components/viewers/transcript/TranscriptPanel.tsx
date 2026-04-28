"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { TranscriptSegment } from "@/lib/transcriptService";
import { Copy, Check, Search, X } from "lucide-react";

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
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const activeIndex = segments.findLastIndex((s) => currentTime >= s.start);

  useEffect(() => {
    if (!query) activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex, query]);

  const filtered = useMemo(() => {
    if (!query.trim()) return segments.map((s, i) => ({ ...s, i }));
    const q = query.toLowerCase();
    return segments
      .map((s, i) => ({ ...s, i }))
      .filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, query]);

  const copyAll = async () => {
    const text = segments.map((s) => `[${formatTime(s.start)}] ${s.text}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Transcript</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSearch((v) => !v)}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              title="Tìm kiếm"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={copyAll}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              title="Copy toàn bộ transcript"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        {showSearch && (
          <div className="mt-2 flex items-center gap-1 rounded-md border bg-background px-2">
            <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm trong transcript..."
              className="flex-1 bg-transparent py-1.5 text-xs outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center pt-4">Không tìm thấy kết quả</p>
        )}
        {filtered.map((seg) => {
          const isActive = seg.i === activeIndex && !query;
          const text = seg.text;
          const highlighted = query.trim()
            ? text.replace(
                new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
                '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded-sm">$1</mark>'
              )
            : null;

          return (
            <div
              key={seg.i}
              ref={isActive ? activeRef : undefined}
              className={`rounded-lg px-3 py-2 transition-colors ${
                isActive ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
              }`}
            >
              <span className="text-xs font-mono text-muted-foreground mr-2 shrink-0">
                {formatTime(seg.start)}
              </span>
              {highlighted ? (
                <span
                  className="text-sm leading-relaxed text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              ) : (
                <span className={`text-sm leading-relaxed ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {text}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
