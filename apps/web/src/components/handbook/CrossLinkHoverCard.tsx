"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { FileText } from "lucide-react";

interface CrossLinkHoverCardProps {
  docId: Id<"documents">;
  x: number;
  y: number;
}

// Bỏ ký tự markdown thừa để hiện snippet sạch
function cleanSnippet(text: string, max = 280): string {
  const t = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

export function CrossLinkHoverCard({ docId, x, y }: CrossLinkHoverCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y + 14 });
  const doc = useQuery(api.documents.queries.getById, { docId }) as
    | { title: string; extractedText?: string }
    | null
    | undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth || 300;
    const h = el.offsetHeight || 120;
    const left = Math.min(x, window.innerWidth - w - 8);
    const top = y + 14 + h > window.innerHeight - 8 ? y - h - 8 : y + 14;
    setPos({ left, top });
  }, [x, y, doc]);

  const snippet = doc?.extractedText ? cleanSnippet(doc.extractedText) : "";

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: pos.left, top: pos.top, width: 300, zIndex: 9998 }}
      className="pointer-events-none rounded-xl border bg-white shadow-xl"
    >
      <div className="flex items-center gap-1.5 rounded-t-xl border-b bg-muted/40 px-3 py-2">
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-semibold text-foreground">
          {doc === undefined ? "Đang tải…" : doc?.title ?? "Không tìm thấy"}
        </span>
      </div>
      {snippet && (
        <div className="px-3 py-2.5">
          <p className="line-clamp-5 text-xs leading-relaxed text-gray-600">{snippet}</p>
        </div>
      )}
    </div>
  );
}
