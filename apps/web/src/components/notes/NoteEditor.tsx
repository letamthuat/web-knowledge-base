"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@mantine/core/styles.css";
import "@blocknote/mantine/style.css";
import { useAction, useMutation } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { Download, Upload, ExternalLink, LibraryBig } from "lucide-react";
import { toast } from "sonner";
import { detectFormat } from "@/lib/storage";

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
  /** Compact mode for side panel — smaller padding, no export buttons */
  compact?: boolean;
}

export function NoteEditor({ noteId, initialTitle, initialBody, docTitle, docId, onUpdate, autoFocusTitle, compact }: NoteEditorProps) {
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

  const requestUpload = useAction(api.notes.actions.requestNoteMediaUploadUrl);
  const getMediaUrl = useAction(api.notes.actions.getNoteMediaUrl);
  const requestDocUpload = useAction(api.documents.actions.requestUploadUrl);
  const finalizeUpload = useMutation(api.documents.mutations.finalizeUpload);
  const [addingToLib, setAddingToLib] = useState(false);
  const addToLibInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const { uploadUrl, storageKey } = await requestUpload({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
    });
    await fetch(uploadUrl, { method: "PUT", body: file });
    return await getMediaUrl({ storageKey });
  }, [requestUpload, getMediaUrl]);

  const editor = useCreateBlockNote({
    initialContent: parseBlocks(initialBody) as never,
    uploadFile,
    domAttributes: {
      editor: { spellcheck: "false" },
    },
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

  const handleAddToLibrary = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const format = detectFormat(file);
    if (!format) {
      toast.error("Định dạng file không được hỗ trợ");
      return;
    }
    setAddingToLib(true);
    try {
      const { uploadUrl, storageKey } = await requestDocUpload({
        fileSizeBytes: file.size,
        format,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      });
      await fetch(uploadUrl, { method: "PUT", body: file });
      const docId = await finalizeUpload({
        title: file.name.replace(/\.[^/.]+$/, ""),
        format: format as never,
        fileSizeBytes: file.size,
        storageBackend: "r2",
        storageKey,
      });
      toast.success("Đã thêm vào thư viện", {
        action: { label: "Mở", onClick: () => window.open(`/reader/${docId}`, "_blank") },
      });
    } catch {
      toast.error("Không thể thêm vào thư viện");
    } finally {
      setAddingToLib(false);
    }
  }, [requestDocUpload, finalizeUpload]);

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
      <div className={[
        "flex shrink-0 items-center justify-between border-b bg-card",
        compact ? "px-3 py-2" : "px-6 py-3",
      ].join(" ")}>
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Tiêu đề ghi chú..."
          className={[
            "flex-1 bg-transparent font-semibold outline-none placeholder:text-muted-foreground/50",
            compact ? "text-sm" : "text-lg",
          ].join(" ")}
        />
        <div className="flex items-center gap-2">
          {saved ? (
            <span className="text-[11px] text-muted-foreground/60">✓ Đã lưu</span>
          ) : (
            <span className="text-[11px] text-amber-500">Đang lưu...</span>
          )}
          {!compact && (
            <>
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
              <div className="h-3 w-px bg-border/60" />
              <button
                onClick={() => addToLibInputRef.current?.click()}
                disabled={addingToLib}
                title="Thêm file vào thư viện"
                className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                <LibraryBig className="h-3.5 w-3.5" />
                {addingToLib ? "Đang thêm..." : "Thêm vào thư viện"}
              </button>
              <input
                ref={addToLibInputRef}
                type="file"
                accept=".pdf,.epub,.docx,.pptx,.md,.mp3,.m4a,.wav,.mp4,.webm,.jpg,.jpeg,.png,.webp,.gif"
                className="hidden"
                onChange={handleAddToLibrary}
              />
            </>
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
