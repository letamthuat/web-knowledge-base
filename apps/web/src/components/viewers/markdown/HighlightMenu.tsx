"use client";

import { useEffect, useRef } from "react";
import { X, PenLine, MessageSquarePlus, Plus } from "lucide-react";
import type { HighlightColor } from "@/hooks/useHighlights";
import { Id } from "@/_generated/dataModel";

const PRESET_COLORS: { value: HighlightColor; bg: string; label: string }[] = [
  { value: "yellow", bg: "#fef08a", label: "Vàng" },
  { value: "green",  bg: "#bbf7d0", label: "Xanh lá" },
  { value: "blue",   bg: "#bfdbfe", label: "Xanh dương" },
  { value: "pink",   bg: "#fbcfe8", label: "Hồng" },
  { value: "purple", bg: "#e9d5ff", label: "Tím" },
];

interface HighlightMenuProps {
  x: number;
  y: number;
  existingId?: Id<"highlights">;
  existingColor?: HighlightColor;
  existingCustomColor?: string;
  onSelectColor: (color: HighlightColor, customColor?: string) => void;
  onOpenNote?: () => void;
  /** Create highlight with purple color + immediately open note */
  onNoteAction?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function HighlightMenu({
  x, y, existingId, onSelectColor, onOpenNote, onNoteAction, onDelete, onClose,
}: HighlightMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

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

  const menuW = 260;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = y - 48;

  return (
    <div
      ref={menuRef}
      style={{ position: "fixed", left, top, zIndex: 9999 }}
      className="flex items-center gap-1 rounded-lg border bg-white px-2 py-1.5 shadow-lg"
    >
      {/* Preset color swatches */}
      {PRESET_COLORS.map((c) => (
        <button
          key={c.value}
          title={c.label}
          onClick={() => { onSelectColor(c.value); onClose(); }}
          style={{ background: c.bg }}
          className="h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110"
        />
      ))}

      {/* Custom color picker */}
      <div className="relative" title="Màu tùy chọn">
        <button
          onClick={() => colorInputRef.current?.click()}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <input
          ref={colorInputRef}
          type="color"
          defaultValue="#a78bfa"
          className="absolute inset-0 h-0 w-0 opacity-0"
          onChange={(e) => {
            onSelectColor("custom", e.target.value);
            onClose();
          }}
        />
      </div>

      <div className="mx-1 h-4 w-px bg-gray-200" />

      {/* Ghi chú action — highlight purple + open note immediately */}
      {!existingId && onNoteAction && (
        <button
          title="Tạo ghi chú"
          onClick={() => { onNoteAction(); onClose(); }}
          className="flex h-6 items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 text-[11px] font-medium text-violet-700 hover:bg-violet-100"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Ghi chú
        </button>
      )}

      {/* Actions for existing highlight */}
      {existingId && (
        <>
          {onOpenNote && (
            <button
              title="Thêm / sửa ghi chú"
              onClick={() => { onOpenNote(); onClose(); }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-violet-50 hover:text-violet-600"
            >
              <PenLine className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              title="Xoá highlight"
              onClick={() => { onDelete(); onClose(); }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
