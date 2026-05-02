"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@mantine/core/styles.css";
import "@blocknote/mantine/style.css";
import { useMutation } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { Download, Upload, ExternalLink } from "lucide-react";

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

interface NoteEditorProps {
  noteId: Id<"notes">;
  initialTitle: string;
  initialBody: string;
  docTitle?: string | null;
  docId?: Id<"documents"> | null;
  onUpdate: (id: Id<"notes">, body: string, title: string) => Promise<void>;
  autoFocusTitle?: boolean;
}

export function NoteEditor({ noteId, initialTitle, initialBody, docTitle, docId, onUpdate, autoFocusTitle }: NoteEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitle = useRef(title);
  const isFirstChange = useRef(true);
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset khi đổi note
  useEffect(() => {
    setTitle(initialTitle);
    latestTitle.current = initialTitle;
    setSaved(true);
    isFirstChange.current = true;
  }, [noteId, initialTitle]);

  // Auto-focus title khi tạo note mới
  useEffect(() => {
    if (autoFocusTitle) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [noteId, autoFocusTitle]);

  const generateUploadUrl = useMutation(api.notes.mutations.generateImageUploadUrl);
  const getImageUrl = useMutation(api.notes.mutations.getImageUrl);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = await res.json() as { storageId: Id<"_storage"> };
    const url = await getImageUrl({ storageId });
    return url ?? "";
  }, [generateUploadUrl, getImageUrl]);

  const editor = useCreateBlockNote({
    initialContent: parseBlocks(initialBody) as never,
    uploadFile,
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

  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportMarkdown = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor) return;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const text = await file.text();
    // Extract title from first H1 if present
    const h1Match = text.match(/^#\s+(.+)/m);
    if (h1Match) {
      const newTitle = h1Match[1].trim();
      setTitle(newTitle);
      latestTitle.current = newTitle;
    }
    const blocks = await editor.tryParseMarkdownToBlocks(text);
    editor.replaceBlocks(editor.document, blocks);
    scheduleSave(JSON.stringify(blocks));
  }, [editor, scheduleSave]);

  const handleExportMarkdown = useCallback(async () => {
    if (!editor) return;
    const md = await editor.blocksToMarkdownLossy(editor.document);
    const titleLine = latestTitle.current ? `# ${latestTitle.current}\n\n` : "";
    const blob = new Blob([titleLine + md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${latestTitle.current || "ghi-chu"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editor]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Title bar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-6 py-3">
        <input
          ref={titleRef}
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
          <button
            onClick={() => importInputRef.current?.click()}
            title="Nhập từ Markdown"
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            .md
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".md,text/markdown,text/plain"
            className="hidden"
            onChange={handleImportMarkdown}
          />
          <button
            onClick={handleExportMarkdown}
            title="Xuất Markdown"
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            .md
          </button>
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
