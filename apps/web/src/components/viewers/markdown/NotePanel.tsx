"use client";

import { X, PenLine, StickyNote } from "lucide-react";
import { Id } from "@/_generated/dataModel";
import type { HighlightColor } from "@/hooks/useHighlights";

const COLOR_BG: Record<HighlightColor, string> = {
  yellow: "#fef08a",
  green:  "#bbf7d0",
  blue:   "#bfdbfe",
  pink:   "#fbcfe8",
  purple: "#e9d5ff",
  custom: "#f3f4f6",
};

const COLOR_BORDER: Record<HighlightColor, string> = {
  yellow: "#fde047",
  green:  "#86efac",
  blue:   "#93c5fd",
  pink:   "#f9a8d4",
  purple: "#c4b5fd",
  custom: "#d1d5db",
};

interface NoteItem {
  _id: Id<"highlights">;
  color: HighlightColor;
  selectedText?: string;
  note: string;
}

interface NotePanelProps {
  notes: NoteItem[];
  onClose: () => void;
  onScrollTo: (highlightId: Id<"highlights">) => void;
  onEdit: (highlightId: Id<"highlights">) => void;
}

export function NotePanel({ notes, onClose, onScrollTo, onEdit }: NotePanelProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-l bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold">Ghi chú</span>
          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
            {notes.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
            <StickyNote className="h-8 w-8 opacity-30" />
            <p className="text-xs">Chưa có ghi chú nào</p>
          </div>
        ) : (
          notes.map((item) => (
            <div
              key={item._id}
              className="group mx-2 mb-2 cursor-pointer rounded-lg border transition-shadow hover:shadow-md"
              style={{ borderColor: COLOR_BORDER[item.color] }}
              onClick={() => onScrollTo(item._id)}
            >
              {/* Highlighted text */}
              {item.selectedText && (
                <div
                  className="rounded-t-lg px-3 py-1.5 text-[11px] text-gray-600 line-clamp-2 leading-relaxed"
                  style={{ background: COLOR_BG[item.color] }}
                >
                  "{item.selectedText}"
                </div>
              )}
              {/* Note text */}
              <div className="px-3 py-2">
                <p className="text-xs text-gray-700 whitespace-pre-wrap break-words line-clamp-4 leading-relaxed">
                  {item.note}
                </p>
              </div>
              {/* Edit button — show on hover */}
              <div className="flex justify-end border-t px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(item._id); }}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-violet-600 hover:bg-violet-50"
                >
                  <PenLine className="h-3 w-3" />
                  Sửa
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
