"use client";

import { useState } from "react";
import { X, PenLine, StickyNote, Highlighter, Plus, Trash2 } from "lucide-react";
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

const COLOR_DOT: Record<HighlightColor, string> = {
  yellow: "#eab308",
  green:  "#22c55e",
  blue:   "#3b82f6",
  pink:   "#ec4899",
  purple: "#7c3aed",
  custom: "#6b7280",
};

interface HighlightItem {
  _id: Id<"highlights">;
  color: HighlightColor;
  customColor?: string;
  selectedText?: string;
  note?: string;
  createdAt: number;
}

interface DocNoteItem {
  _id: Id<"notes">;
  title?: string;
  body: string;
  createdAt: number;
}

interface AnnotationPanelProps {
  highlights: HighlightItem[];
  docNotes: DocNoteItem[];
  onClose: () => void;
  onScrollTo: (id: Id<"highlights">) => void;
  onEditHighlightNote: (id: Id<"highlights">) => void;
  onDeleteHighlight: (id: Id<"highlights">) => void;
  onAddDocNote: () => void;
  onEditDocNote: (id: Id<"notes">) => void;
  onDeleteDocNote: (id: Id<"notes">) => void;
}

type Tab = "highlights" | "notes";

export function AnnotationPanel({
  highlights, docNotes, onClose,
  onScrollTo, onEditHighlightNote, onDeleteHighlight,
  onAddDocNote, onEditDocNote, onDeleteDocNote,
}: AnnotationPanelProps) {
  const [tab, setTab] = useState<Tab>("highlights");

  const hlNotesCount = highlights.filter((h) => h.note).length;
  const totalNotesCount = hlNotesCount + docNotes.length;

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
            <Badge count={totalNotesCount} active={tab === "notes"} color="violet" />
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
      <div className="flex flex-1 flex-col overflow-hidden">
        {tab === "highlights" ? (
          <div className="flex-1 overflow-y-auto py-2">
            {highlights.length === 0 ? (
              <Empty icon={<Highlighter className="h-8 w-8 opacity-25" />} text="Chưa có highlight nào" />
            ) : (
              highlights.map((item) => (
                <HighlightRow
                  key={item._id}
                  item={item}
                  onScrollTo={() => onScrollTo(item._id)}
                  onEditNote={() => onEditHighlightNote(item._id)}
                  onDelete={() => onDeleteHighlight(item._id)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Add note button */}
            <div className="shrink-0 border-b px-3 py-2">
              <button
                onClick={onAddDocNote}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-violet-300 py-1.5 text-xs text-violet-600 hover:bg-violet-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm ghi chú mới
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {/* Doc notes (free-form) */}
              {docNotes.map((note) => (
                <DocNoteRow
                  key={note._id}
                  note={note}
                  onEdit={() => onEditDocNote(note._id)}
                  onDelete={() => onDeleteDocNote(note._id)}
                />
              ))}

              {/* Highlight notes */}
              {highlights.filter((h) => h.note).map((item) => (
                <HighlightNoteRow
                  key={item._id}
                  item={item}
                  onScrollTo={() => onScrollTo(item._id)}
                  onEdit={() => onEditHighlightNote(item._id)}
                />
              ))}

              {totalNotesCount === 0 && (
                <Empty icon={<StickyNote className="h-8 w-8 opacity-25" />} text="Chưa có ghi chú nào" />
              )}
            </div>
          </div>
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

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
      {icon}
      <p className="text-xs">{text}</p>
    </div>
  );
}

function HighlightRow({ item, onScrollTo, onEditNote, onDelete }: {
  item: HighlightItem;
  onScrollTo: () => void;
  onEditNote: () => void;
  onDelete: () => void;
}) {
  const dotColor = item.color === "custom" && item.customColor ? item.customColor : COLOR_DOT[item.color];
  const bgColor = item.color === "custom" && item.customColor ? item.customColor + "66" : COLOR_BG[item.color];
  return (
    <div
      className="group mx-2 mb-2 cursor-pointer rounded-lg border border-transparent bg-muted/40 transition-all hover:border-border hover:bg-muted/80 hover:shadow-sm"
      onClick={onScrollTo}
    >
      <div className="flex items-start gap-2 px-2.5 pt-2.5 pb-1.5">
        <span className="mt-0.5 h-3 w-1.5 shrink-0 rounded-full" style={{ background: dotColor }} />
        <div className="min-w-0 flex-1">
          {item.selectedText ? (
            <p
              className="text-[12px] leading-relaxed text-gray-700 line-clamp-3 rounded px-0.5"
              style={{ background: bgColor }}
            >
              {item.selectedText.slice(0, 120)}{item.selectedText.length > 120 ? "…" : ""}
            </p>
          ) : (
            <p className="text-[11px] italic text-muted-foreground">(không có text)</p>
          )}
        </div>
      </div>
      {item.note && (
        <div className="px-5 pb-1.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-1">✏️ {item.note}</p>
        </div>
      )}
      <div className="flex items-center justify-end gap-1 border-t border-transparent px-2 py-1 opacity-0 transition-opacity group-hover:border-border/50 group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onEditNote(); }}
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-violet-600 hover:bg-violet-50"
        >
          <PenLine className="h-3 w-3" />
          {item.note ? "Sửa note" : "Thêm note"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-red-400 hover:bg-red-50"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function DocNoteRow({ note, onEdit, onDelete }: {
  note: DocNoteItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group mx-2 mb-2 cursor-pointer rounded-lg border border-violet-100 bg-violet-50/50 transition-all hover:border-violet-200 hover:shadow-sm"
      onClick={onEdit}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        {note.title && (
          <p className="mb-0.5 text-[12px] font-medium text-gray-800 line-clamp-1">{note.title}</p>
        )}
        <p className="text-[12px] text-gray-600 leading-relaxed line-clamp-4 whitespace-pre-wrap">
          {note.body}
        </p>
      </div>
      <div className="flex items-center justify-end gap-1 border-t border-violet-100 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-violet-600 hover:bg-violet-100"
        >
          <PenLine className="h-3 w-3" />
          Sửa
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-red-400 hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function HighlightNoteRow({ item, onScrollTo, onEdit }: {
  item: HighlightItem;
  onScrollTo: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className="group mx-2 mb-2 cursor-pointer rounded-lg border border-transparent bg-muted/40 transition-all hover:border-border hover:shadow-sm"
      onClick={onScrollTo}
    >
      <div className="flex items-start gap-2 px-2.5 pt-2 pb-1">
        <span className="mt-0.5 h-2.5 w-1.5 shrink-0 rounded-full" style={{ background: COLOR_DOT[item.color] }} />
        <div className="min-w-0 flex-1">
          {item.selectedText && (
            <p className="mb-1 text-[11px] text-muted-foreground line-clamp-1 italic">
              "{item.selectedText.slice(0, 60)}{item.selectedText.length > 60 ? "…" : ""}"
            </p>
          )}
          <p className="text-[12px] text-gray-700 leading-relaxed line-clamp-4 whitespace-pre-wrap">{item.note}</p>
        </div>
      </div>
      <div className="flex justify-end px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-violet-600 hover:bg-violet-50"
        >
          <PenLine className="h-3 w-3" />
          Sửa
        </button>
      </div>
    </div>
  );
}
