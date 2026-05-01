"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { HighlightColor } from "@/hooks/useHighlights";
import { Id } from "@/_generated/dataModel";

const COLORS: { value: HighlightColor; bg: string; label: string }[] = [
  { value: "yellow", bg: "#fef08a", label: "Vàng" },
  { value: "green",  bg: "#bbf7d0", label: "Xanh lá" },
  { value: "blue",   bg: "#bfdbfe", label: "Xanh dương" },
  { value: "pink",   bg: "#fbcfe8", label: "Hồng" },
];

interface HighlightMenuProps {
  x: number;
  y: number;
  /** If set, we're clicking an existing highlight → show delete */
  existingId?: Id<"highlights">;
  existingColor?: HighlightColor;
  onSelectColor: (color: HighlightColor) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function HighlightMenu({
  x, y, existingId, onSelectColor, onDelete, onClose,
}: HighlightMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  // Keep menu in viewport
  const menuW = 180;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = y - 44; // above selection

  return (
    <div
      ref={menuRef}
      style={{ position: "fixed", left, top, zIndex: 9999 }}
      className="flex items-center gap-1 rounded-lg border bg-white px-2 py-1.5 shadow-lg"
    >
      {COLORS.map((c) => (
        <button
          key={c.value}
          title={c.label}
          onClick={() => { onSelectColor(c.value); onClose(); }}
          style={{ background: c.bg }}
          className="h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110"
        />
      ))}
      {existingId && onDelete && (
        <>
          <div className="mx-1 h-4 w-px bg-gray-200" />
          <button
            title="Xoá highlight"
            onClick={() => { onDelete(); onClose(); }}
            className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
