"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@mantine/core/styles.css";
import "@blocknote/mantine/style.css";
import { Id } from "@/_generated/dataModel";
import { ExternalLink } from "lucide-react";

interface NoteEditorProps {
  noteId: Id<"notes">;
  initialTitle: string;
  initialBody: string;
  docTitle?: string | null;
  docId?: Id<"documents"> | null;
  onUpdate: (id: Id<"notes">, body: string, title: string) => Promise<void>;
}

function parseBlocks(body: string) {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  // fallback: plain text → paragraph block
  if (body.trim()) {
    return [{ type: "paragraph", content: [{ type: "text", text: body, styles: {} }] }];
  }
  return [];
}

export function NoteEditor({ noteId, initialTitle, initialBody, docTitle, docId, onUpdate }: NoteEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitle = useRef(title);
  const isFirstChange = useRef(true);

  // Reset khi đổi note
  useEffect(() => {
    setTitle(initialTitle);
    latestTitle.current = initialTitle;
    setSaved(true);
    isFirstChange.current = true;
  }, [noteId, initialTitle]);

  const editor = useCreateBlockNote({
    initialContent: parseBlocks(initialBody) as never,
  }, [noteId]);

  const scheduleSave = useCallback((bodyJson: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(async () => {
      await onUpdate(noteId, bodyJson, latestTitle.current);
      setSaved(true);
    }, 1000);
  }, [noteId, onUpdate]);

  // Lắng nghe thay đổi editor
  useEffect(() => {
    if (!editor) return;
    const unsub = editor.onChange(() => {
      if (isFirstChange.current) { isFirstChange.current = false; return; }
      const blocks = editor.document;
      scheduleSave(JSON.stringify(blocks));
    });
    return () => unsub?.();
  }, [editor, scheduleSave]);

  // Flush khi unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        const blocks = editor?.document;
        if (blocks) onUpdate(noteId, JSON.stringify(blocks), latestTitle.current).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTitle(v);
    latestTitle.current = v;
    scheduleSave(JSON.stringify(editor?.document ?? []));
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Title bar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-6 py-3">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Tiêu đề ghi chú..."
          className="flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground/50"
        />
        <div className="flex items-center gap-3">
          {saved ? (
            <span className="text-[11px] text-muted-foreground/60">✓ Đã lưu</span>
          ) : (
            <span className="text-[11px] text-amber-500">Đang lưu...</span>
          )}
          {docTitle && docId && (
            <a
              href={`/reader/${docId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-700 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {docTitle}
            </a>
          )}
        </div>
      </div>

      {/* BlockNote editor */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <BlockNoteView
          editor={editor}
          theme="light"
          className="min-h-full"
        />
      </div>
    </div>
  );
}
