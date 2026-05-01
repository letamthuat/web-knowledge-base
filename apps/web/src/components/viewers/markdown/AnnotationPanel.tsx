"use client";

import { useState } from "react";
import { X, PenLine, StickyNote, Highlighter } from "lucide-react";
import { Id } from "@/_generated/dataModel";
import type { HighlightColor } from "@/hooks/useHighlights";

const COLOR_BG: Record<HighlightColor, string> = {
  yellow: "#fef08a",
  green:  "#bbf7d0",
  blue:   "#bfdbfe",
  pink:   "#fbcfe8",
};

const COLOR_DOT: Record<HighlightColor, string> = {
  yellow: "#eab308",
  green:  "#22c55e",
  blue:   "#3b82f6",
  pink:   "#ec4899",
};

interface HighlightItem {
  _id: Id<"highlights">;
  color: HighlightColor;
  selectedText?: string;
  note?: string;
  createdAt: number;
}

interface AnnotationPanelProps {
  highlights: HighlightItem[];
  onClose: () => void;
  onScrollTo: (id: Id<"highlights">) => void;
  onEditNote: (id: Id<"highlights">) => void;
  onDelete: (id: Id<"highlights">) => void;
}

type Tab = "highlights" | "notes";

export function AnnotationPanel({ highlights, onClose, onScrollTo, onEditNote, onDelete }: AnnotationPanelProps) {
  const [tab, setTab] = useState<Tab>("highlights");

  const notes = highlights.filter((h) => h.note);
  const items = tab === "highlights" ? highlights : notes;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex gap-1">
          <TabButton active={tab === "highlights"} onClick={() => setTab("highlights")}>
            <Highlighter className="h-3.5 w-3.5" />
            Highlight
            <Badge count={highlights.length} active={tab === "highlights"} color="amber" />
          </TabButton>
          <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>
            <StickyNote className="h-3.5 w-3.5" />
            Ghi chú
            <Badge count={notes.length} active={tab === "notes"} color="violet" />
          </TabButton>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
            {tab === "highlights"
              ? <Highlighter className="h-8 w-8 opacity-25" />
              : <StickyNote className="h-8 w-8 opacity-25" />}
            <p className="text-xs">
              {tab === "highlights" ? "Chưa có highlight nào" : "Chưa có ghi chú nào"}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <AnnotationItem
              key={item._id}
              item={item}
              showNote={tab === "notes"}
              onScrollTo={() => onScrollTo(item._id)}
              onEditNote={() => onEditNote(item._id)}
              onDelete={() => onDelete(item._id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Badge({ count, active, color }: { count: number; active: boolean; color: "amber" | "violet" }) {
  if (count === 0) return null;
  const cls = color === "violet"
    ? active ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-700"
    : active ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700";
  return (
    <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${cls}`}>
      {count}
    </span>
  );
}

function AnnotationItem({
  item, showNote, onScrollTo, onEditNote, onDelete,
}: {
  item: HighlightItem;
  showNote: boolean;
  onScrollTo: () => void;
  onEditNote: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group mx-2 mb-2 cursor-pointer rounded-lg border border-transparent bg-muted/40 transition-all hover:border-border hover:bg-muted/80 hover:shadow-sm"
      onClick={onScrollTo}
    >
      {/* Color bar + text snippet */}
      <div className="flex items-start gap-2 px-2.5 pt-2.5 pb-1.5">
        <span
          className="mt-0.5 h-3 w-1.5 shrink-0 rounded-full"
          style={{ background: COLOR_DOT[item.color] }}
        />
        <div className="min-w-0 flex-1">
          {item.selectedText ? (
            <p
              className="text-[12px] leading-relaxed text-gray-700 line-clamp-3"
              style={{ background: COLOR_BG[item.color], borderRadius: 3, padding: "1px 3px" }}
            >
              {item.selectedText.slice(0, 120)}{item.selectedText.length > 120 ? "…" : ""}
            </p>
          ) : (
            <p className="text-[11px] italic text-muted-foreground">(không có text)</p>
          )}
        </div>
      </div>

      {/* Note preview — always in highlights tab (if has note), full in notes tab */}
      {item.note && (
        <div className="px-5 pb-1.5">
          <p className={`text-[11px] text-muted-foreground leading-relaxed ${showNote ? "line-clamp-6" : "line-clamp-1"}`}>
            ✏️ {item.note}
          </p>
        </div>
      )}

      {/* Action row — visible on hover */}
      <div className="flex items-center justify-end gap-1 border-t border-transparent px-2 py-1 opacity-0 transition-opacity group-hover:border-border/50 group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onEditNote(); }}
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-violet-600 hover:bg-violet-50"
          title="Sửa ghi chú"
        >
          <PenLine className="h-3 w-3" />
          {item.note ? "Sửa note" : "Thêm note"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-red-400 hover:bg-red-50"
          title="Xoá highlight"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
