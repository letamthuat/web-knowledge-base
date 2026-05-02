"use client";

import { Id } from "@/_generated/dataModel";
import { FilePlus, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NoteItem {
  _id: Id<"notes">;
  title?: string;
  body: string;
  docTitle?: string | null;
  updatedAt: number;
}

interface NoteListProps {
  notes: NoteItem[];
  selectedId: Id<"notes"> | null;
  onSelect: (id: Id<"notes">) => void;
  onNew: () => void;
  onDelete: (id: Id<"notes">) => void;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

function bodyPreview(body: string): string {
  try {
    const blocks = JSON.parse(body) as Array<{ content?: Array<{ text?: string }> }>;
    const text = blocks
      .flatMap((b) => b.content ?? [])
      .map((c) => c.text ?? "")
      .join(" ")
      .trim();
    return text.slice(0, 100) || "(Chưa có nội dung)";
  } catch {
    return body.slice(0, 100) || "(Chưa có nội dung)";
  }
}

export function NoteList({ notes, selectedId, onSelect, onNew, onDelete }: NoteListProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Ghi chú</span>
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={onNew}>
          <FilePlus className="h-3.5 w-3.5" />
          Mới
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-muted-foreground">
            <StickyNote className="h-10 w-10 opacity-20" />
            <p className="text-sm">Chưa có ghi chú nào</p>
            <Button variant="outline" size="sm" onClick={onNew}>
              Tạo ghi chú đầu tiên
            </Button>
          </div>
        ) : (
          notes.map((note) => (
            <NoteRow
              key={note._id}
              note={note}
              selected={selectedId === note._id}
              onSelect={() => onSelect(note._id)}
              onDelete={() => onDelete(note._id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function NoteRow({ note, selected, onSelect, onDelete }: {
  note: NoteItem;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={[
        "group relative mx-2 my-0.5 cursor-pointer rounded-lg px-3 py-2.5 transition-colors",
        selected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/60 border border-transparent",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] font-medium leading-snug text-foreground">
              {note.title || "(Không có tiêu đề)"}
            </p>
            <span className="shrink-0 text-[11px] text-muted-foreground/60">{timeAgo(note.updatedAt)}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {bodyPreview(note.body)}
          </p>
          {note.docTitle && (
            <div className="mt-1">
              <span className="truncate text-[11px] text-violet-600 max-w-[140px]">
                📎 {note.docTitle}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm("Xoá ghi chú này?")) onDelete();
          }}
          className="mt-0.5 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 text-red-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
