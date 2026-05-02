"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { X, FilePlus, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useAllNotes } from "@/hooks/useNotes";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { Id } from "@/_generated/dataModel";

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
    const text = blocks.flatMap((b) => b.content ?? []).map((c) => c.text ?? "").join(" ").trim();
    return text.slice(0, 80) || "(Chưa có nội dung)";
  } catch {
    return body.slice(0, 80) || "(Chưa có nội dung)";
  }
}

const MIN_WIDTH = 240;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

interface NotesSidePanelProps {
  onClose: () => void;
}

export function NotesSidePanel({ onClose }: NotesSidePanelProps) {
  const { notes, addNote, updateNote, removeNote } = useAllNotes();
  const [selectedId, setSelectedId] = useState<Id<"notes"> | null>(null);
  const [newNoteId, setNewNoteId] = useState<Id<"notes"> | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const handleNew = useCallback(async () => {
    try {
      const id = await addNote("[]", "");
      if (id) {
        setSelectedId(id as Id<"notes">);
        setNewNoteId(id as Id<"notes">);
      }
    } catch {
      toast.error("Không thể tạo ghi chú");
    }
  }, [addNote]);

  const handleDelete = useCallback(async (id: Id<"notes">) => {
    try {
      await removeNote(id);
      if (selectedId === id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const remaining = (notes as any[]).filter((n) => n._id !== id);
        setSelectedId(remaining[0]?._id ?? null);
      }
    } catch {
      toast.error("Không thể xoá ghi chú");
    }
  }, [removeNote, selectedId, notes]);

  const handleUpdate = useCallback(async (id: Id<"notes">, body: string, title: string) => {
    await updateNote(id, body, title);
  }, [updateNote]);

  // Resize drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
  }, [width]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      // Panel is on right side — drag left increases width
      const delta = startX.current - e.clientX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(next);
    }
    function onMouseUp() {
      dragging.current = false;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedNote = (notes as any[]).find((n) => n._id === selectedId) ?? null;

  return (
    <aside className="relative flex shrink-0 flex-col border-l bg-card" style={{ width }}>
      {/* Resize handle — left edge */}
      <div
        onMouseDown={onMouseDown}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
        title="Kéo để thay đổi kích thước"
      />

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-sm font-semibold">Ghi chú</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNew}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Ghi chú mới"
          >
            <FilePlus className="h-3.5 w-3.5" />
            Mới
          </button>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {selectedNote ? (
        // Editor mode — full panel
        <div className="flex flex-1 flex-col overflow-hidden">
          <button
            onClick={() => setSelectedId(null)}
            className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted transition-colors text-left"
          >
            ← Danh sách ghi chú
          </button>
          <div className="flex-1 overflow-hidden">
            <NoteEditor
              key={selectedNote._id}
              noteId={selectedNote._id}
              initialTitle={selectedNote.title ?? ""}
              initialBody={selectedNote.body}
              docTitle={selectedNote.docTitle}
              docId={selectedNote.docId ?? null}
              onUpdate={handleUpdate}
              autoFocusTitle={newNoteId === selectedNote._id}
              compact
            />
          </div>
        </div>
      ) : (
        // List mode
        <div className="flex-1 overflow-y-auto py-1">
          {(notes as any[]).length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-muted-foreground">
              <StickyNote className="h-8 w-8 opacity-20" />
              <p className="text-xs">Chưa có ghi chú nào</p>
              <button
                onClick={handleNew}
                className="rounded border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
              >
                Tạo ghi chú đầu tiên
              </button>
            </div>
          ) : (
            (notes as any[]).map((note) => (
              <div
                key={note._id}
                onClick={() => setSelectedId(note._id)}
                className="group mx-2 my-0.5 cursor-pointer rounded-lg border border-transparent px-3 py-2 hover:bg-muted/60 hover:border-border transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <p className="truncate text-[12px] font-medium text-foreground">
                        {note.title || "(Không có tiêu đề)"}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground/60">{timeAgo(note.updatedAt)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
                      {bodyPreview(note.body)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("Xoá ghi chú này?")) handleDelete(note._id);
                    }}
                    className="mt-0.5 shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
