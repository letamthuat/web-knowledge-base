"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  useCreateBlockNote,
  FormattingToolbar,
  FormattingToolbarController,
  FileReplaceButton,
  FileRenameButton,
  FileCaptionButton,
  FileDeleteButton,
  FileDownloadButton,
  FilePreviewButton,
  useBlockNoteEditor,
  useEditorState,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { offset, shift } from "@floating-ui/react";
import "@mantine/core/styles.css";
import "@blocknote/mantine/style.css";
import { useAction, useMutation } from "convex/react";
import { api } from "@/_generated/api";
import type { SaveStatus } from "@/hooks/useReadingProgress";
import { Id } from "@/_generated/dataModel";
import { Download, Upload, ExternalLink, LibraryBig } from "lucide-react";
import { toast } from "sonner";
import { detectFormat, SUPPORTED_FORMATS, SUPPORTED_EXTENSIONS } from "@/lib/storage";

const LIBRARY_MIME_SET = new Set(Object.keys(SUPPORTED_FORMATS));
const LIBRARY_EXT_SET = new Set(Object.keys(SUPPORTED_EXTENSIONS));

function isLibraryFormat(url: string): boolean {
  // Check by extension from URL/filename
  const ext = "." + url.split("?")[0].split(".").pop()?.toLowerCase();
  return LIBRARY_EXT_SET.has(ext);
}

function mimeFromUrl(url: string): string {
  const ext = "." + url.split("?")[0].split(".").pop()?.toLowerCase();
  const entry = Object.entries(SUPPORTED_EXTENSIONS).find(([e]) => e === ext);
  return entry ? entry[1] : "";
}

interface AddToLibraryButtonProps {
  onAdd: (url: string, name: string) => void;
}

function AddToLibraryButton({ onAdd }: AddToLibraryButtonProps) {
  const editor = useBlockNoteEditor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blockInfo = useEditorState({
    editor,
    selector: (state: any) => {
      const sel = state.editor.getSelection();
      const blocks = sel?.blocks ?? [state.editor.getTextCursorPosition().block];
      const block = blocks.length === 1 ? blocks[0] : null;
      return { url: block?.props?.url as string | undefined, name: block?.props?.name as string | undefined };
    },
  });

  const { url, name } = blockInfo ?? {};

  if (!url) return null;

  return (
    <button
      onClick={() => onAdd(url, name || url.split("/").pop() || "file")}
      title="Thêm vào thư viện"
      className="flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium text-violet-600 hover:bg-violet-50 hover:text-violet-700 transition-colors border border-violet-200"
    >
      <LibraryBig className="h-3.5 w-3.5" />
      Thêm vào thư viện
    </button>
  );
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
  /** Called whenever saved state changes */
  onSaveStateChange?: (status: SaveStatus) => void;
  /** Ref to trigger import/export from parent toolbar */
  importRef?: React.RefObject<HTMLInputElement | null>;
  onExport?: React.MutableRefObject<(() => void) | null>;
  /** Ref to trigger immediate save from parent toolbar */
  saveNowRef?: React.MutableRefObject<(() => void) | null>;
}

export function NoteEditor({ noteId, initialTitle, initialBody, docTitle, docId, onUpdate, autoFocusTitle, compact, onSaveStateChange, importRef, onExport, saveNowRef }: NoteEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [saved, setSaved] = useState(true);
  const setSavedWithNotify = useCallback((v: boolean) => {
    setSaved(v);
    onSaveStateChange?.(v ? "saved" : "pending");
  }, [onSaveStateChange]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitle = useRef(title);
  const isFirstChange = useRef(true);
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset khi đổi note
  useEffect(() => {
    setTitle(initialTitle);
    latestTitle.current = initialTitle;
    setSaved(true);
    onSaveStateChange?.("saved");
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

  // Called from AddToLibraryButton with the file's R2 presigned URL + name
  const handleAddFileToLibrary = useCallback(async (fileUrl: string, fileName: string) => {
    if (addingToLib) return;

    // Detect format from filename/URL extension
    const ext = "." + fileName.split(".").pop()?.toLowerCase();
    const format = SUPPORTED_EXTENSIONS[ext] ?? null;
    if (!format) {
      toast.warning(`Định dạng "${ext}" không được hỗ trợ trong thư viện`, {
        description: "Thư viện hỗ trợ: PDF, EPUB, DOCX, PPTX, ảnh, audio, video, markdown",
      });
      return;
    }

    setAddingToLib(true);
    try {
      // Fetch the file from R2 presigned URL
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Không thể tải file");
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type });

      const { uploadUrl, storageKey } = await requestDocUpload({
        fileSizeBytes: file.size,
        format,
        fileName,
        mimeType: file.type || "application/octet-stream",
      });
      await fetch(uploadUrl, { method: "PUT", body: file });
      const docId = await finalizeUpload({
        title: fileName.replace(/\.[^/.]+$/, ""),
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
  }, [addingToLib, requestDocUpload, finalizeUpload]);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const { uploadUrl, storageKey } = await requestUpload({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
    });
    // No Content-Type header — presigned URL doesn't sign it, adding it causes R2 signature mismatch
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
    onSaveStateChange?.("pending");
    saveTimer.current = setTimeout(async () => {
      onSaveStateChange?.("saving");
      await onUpdate(noteId, bodyJson, latestTitle.current);
      setSavedWithNotify(true);
    }, 1000);
  }, [noteId, onUpdate, onSaveStateChange]);

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

  // Expose export handler to parent toolbar
  useEffect(() => {
    if (onExport) onExport.current = handleExportMarkdown;
  }, [onExport, handleExportMarkdown]);

  // Expose save-now handler to parent toolbar
  useEffect(() => {
    if (!saveNowRef) return;
    saveNowRef.current = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const blocks = editor?.document;
      if (blocks) {
        onSaveStateChange?.("saving");
        onUpdate(noteId, JSON.stringify(blocks), latestTitle.current)
          .then(() => { setSaved(true); onSaveStateChange?.("saved"); })
          .catch(() => { onSaveStateChange?.("error"); });
      }
    };
  }, [saveNowRef, editor, noteId, onUpdate, onSaveStateChange]);

  // Wire external importRef to internal input
  useEffect(() => {
    if (importRef && importRef.current === null) {
      (importRef as React.MutableRefObject<HTMLInputElement | null>).current = importInputRef.current;
    }
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Hidden import input — always present */}
      <input
        ref={importInputRef}
        type="file"
        accept=".md,text/markdown,text/plain"
        className="hidden"
        onChange={handleImportMarkdown}
      />

      {/* BlockNote editor — title inline at top */}
      <div className="flex-1 overflow-y-auto px-0 md:px-2 py-2">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Tiêu đề"
          className="w-full bg-transparent px-3 md:px-[54px] pt-4 pb-2 text-2xl font-bold outline-none placeholder:text-muted-foreground/40"
        />
        <BlockNoteView
          editor={editor}
          theme="light"
          className="min-h-full"
          formattingToolbar={false}
        >
          <FormattingToolbarController
            floatingUIOptions={{
              useFloatingOptions: {
                placement: "top-start",
                middleware: [offset(10), shift()],
              },
            }}
            formattingToolbar={() => (
              <FormattingToolbar>
                <FileReplaceButton key="fileReplace" />
                <FileRenameButton key="fileRename" />
                <FileCaptionButton key="fileCaption" />
                <FilePreviewButton key="filePreview" />
                <FileDownloadButton key="fileDownload" />
                <AddToLibraryButton key="addToLibrary" onAdd={handleAddFileToLibrary} />
                <FileDeleteButton key="fileDelete" />
              </FormattingToolbar>
            )}
          />
        </BlockNoteView>
      </div>
    </div>
  );
}
