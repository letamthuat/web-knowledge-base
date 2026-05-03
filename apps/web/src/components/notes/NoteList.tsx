"use client";

import { useEffect, useRef, useState } from "react";
import { Id } from "@/_generated/dataModel";
import { FilePlus, StickyNote, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecording } from "@/contexts/RecordingContext";

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
  const [, setTick] = useState(0);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const { audioRecorder, screenRecorder } = useRecording();

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!newMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setNewMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [newMenuOpen]);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
      {/* Header */}
      <div className="shrink-0 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold">Ghi chú</span>
          <div ref={newMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-7 text-xs"
              onClick={() => setNewMenuOpen((v) => !v)}
            >
              <FilePlus className="h-3.5 w-3.5" />
              Mới
              <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${newMenuOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Inline new-item menu — no absolute positioning, never clipped */}
        {newMenuOpen && (
          <div className="border-t bg-muted/40 py-1">
            <button
              onClick={() => { setNewMenuOpen(false); onNew(); }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <span>📄</span>
              Ghi chú mới
            </button>
            <button
              onClick={async () => {
                setNewMenuOpen(false);
                if (audioRecorder.state !== "idle") return;
                try { await audioRecorder.start(); } catch { /* user denied */ }
              }}
              disabled={audioRecorder.state !== "idle"}
              title={audioRecorder.state !== "idle" ? "Đang có phiên ghi âm" : undefined}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-rose-500 shrink-0">
                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
              </svg>
              Ghi âm
            </button>
            <button
              onClick={async () => {
                setNewMenuOpen(false);
                if (screenRecorder.state !== "idle") return;
                try { await screenRecorder.start(); } catch { /* user denied */ }
              }}
              disabled={screenRecorder.state !== "idle"}
              title={screenRecorder.state !== "idle" ? "Đang có phiên quay màn hình" : undefined}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-violet-500 shrink-0">
                <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z" />
              </svg>
              Quay màn hình
            </button>
          </div>
        )}
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
