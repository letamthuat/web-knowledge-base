"use client";

import { useEffect, useRef, useState } from "react";
import { PenLine } from "lucide-react";
import type { HighlightColor } from "@/hooks/useHighlights";

const COLOR_BG: Record<HighlightColor, string> = {
  yellow: "#fef08a",
  green:  "#bbf7d0",
  blue:   "#bfdbfe",
  pink:   "#fbcfe8",
};

interface NoteHoverCardProps {
  x: number;
  y: number;
  selectedText: string;
  note: string;
  color: HighlightColor;
  onEdit: () => void;
  onClose: () => void;
}

export function NoteHoverCard({ x, y, selectedText, note, color, onEdit, onClose }: NoteHoverCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y + 12 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth || 240;
    const h = el.offsetHeight || 100;
    const left = Math.min(x, window.innerWidth - w - 8);
    const top = y + 12 + h > window.innerHeight - 8 ? y - h - 8 : y + 12;
    setPos({ left, top });
  }, [x, y]);

  // Click outside closes the card
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: pos.left, top: pos.top, width: 240, zIndex: 9998 }}
      className="rounded-xl border bg-white shadow-xl"
    >
      {/* Highlighted text snippet */}
      <div
        className="rounded-t-xl px-3 py-2 text-xs text-gray-600 line-clamp-2 leading-relaxed"
        style={{ background: COLOR_BG[color] }}
      >
        "{selectedText}"
      </div>
      {/* Note content */}
      <div className="px-3 py-2.5">
        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{note}</p>
      </div>
      {/* Edit button */}
      <div className="flex justify-end border-t px-2 py-1.5">
        <button
          onClick={onEdit}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-violet-600 hover:bg-violet-50"
        >
          <PenLine className="h-3 w-3" />
          Sửa ghi chú
        </button>
      </div>
    </div>
  );
}
