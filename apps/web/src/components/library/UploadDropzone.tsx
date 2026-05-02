"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload, X, CheckCircle, AlertCircle, FileUp,
  Folder, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { labels } from "@/lib/i18n/labels";
import { detectFormat, formatBytes } from "@/lib/storage";

const L = labels.upload;

interface FileUploadState {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface UploadDropzoneProps {
  onUploadComplete?: () => void;
  defaultFolderId?: string;
}

export function UploadDropzone({ onUploadComplete, defaultFolderId }: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(defaultFolderId ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestUploadUrl = useAction(api.documents.actions.requestUploadUrl);
  const finalizeUpload = useMutation(api.documents.mutations.finalizeUpload);
  const assignDoc = useMutation(api.folders.mutations.assignDoc);
  const allFolders = useQuery(api.folders.queries.listByUser);

  const updateUpload = useCallback((index: number, patch: Partial<FileUploadState>) => {
    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  }, []);

  const processFiles = useCallback(
    async (files: File[]) => {
      const newUploads: FileUploadState[] = files.map((f) => ({
        file: f,
        progress: 0,
        status: "pending",
      }));

      const valid: { file: File; format: string; index: number }[] = [];
      newUploads.forEach((u, i) => {
        const format = detectFormat(u.file);
        if (!format) {
          newUploads[i] = { ...u, status: "error", error: L.unsupportedFormat };
          toast.error(`${u.file.name}: ${L.unsupportedFormat}`);
        } else {
          valid.push({ file: u.file, format, index: i });
        }
      });

      setUploads((prev) => [...prev, ...newUploads]);

      const baseIndex = uploads.length;
      await Promise.all(
        valid.map(async ({ file, format, index }) => {
          const absoluteIndex = baseIndex + index;
          updateUpload(absoluteIndex, { status: "uploading" });

          try {
            const { storageBackend, uploadUrl, storageKey } = await requestUploadUrl({
              fileSizeBytes: file.size,
              format,
              fileName: file.name,
              mimeType: file.type || undefined,
            });

            let finalStorageKey = storageKey;

            if (storageBackend === "convex") {
              const convexStorageId = await new Promise<string>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener("progress", (e) => {
                  if (e.lengthComputable)
                    updateUpload(absoluteIndex, { progress: Math.round((e.loaded / e.total) * 100) });
                });
                xhr.addEventListener("load", () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    try { resolve(JSON.parse(xhr.responseText).storageId ?? ""); }
                    catch { reject(new Error("Parse error")); }
                  } else reject(new Error(`HTTP ${xhr.status}`));
                });
                xhr.addEventListener("error", () => reject(new Error("Network error")));
                xhr.open("POST", uploadUrl);
                xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
                xhr.send(file);
              });
              finalStorageKey = convexStorageId;
            } else {
              await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener("progress", (e) => {
                  if (e.lengthComputable)
                    updateUpload(absoluteIndex, { progress: Math.round((e.loaded / e.total) * 100) });
                });
                xhr.addEventListener("load", () => {
                  if (xhr.status >= 200 && xhr.status < 300) resolve();
                  else reject(new Error(`R2 HTTP ${xhr.status}: ${xhr.responseText?.slice(0, 200)}`));
                });
                xhr.addEventListener("error", () => reject(new Error("Network/CORS error uploading to R2")));
                xhr.open("PUT", uploadUrl);
                // Do NOT set Content-Type — presigned URL doesn't sign it so R2 rejects signed mismatches
                xhr.send(file);
              });
            }

            const title = file.name.replace(/\.[^.]+$/, "");
            const docId = await finalizeUpload({
              title,
              format: format as "pdf" | "epub" | "docx" | "pptx" | "image" | "audio" | "video" | "markdown" | "web_clip",
              fileSizeBytes: file.size,
              storageBackend,
              storageKey: finalStorageKey,
            });

            if (selectedFolderId && docId) {
              try {
                await assignDoc({ folderId: selectedFolderId as any, docId: docId as any });
              } catch {}
            }

            updateUpload(absoluteIndex, { status: "done", progress: 100 });
            onUploadComplete?.();
          } catch (err) {
            const msg = err instanceof Error ? err.message : L.uploadError;
            console.error("[Upload] error:", msg);
            updateUpload(absoluteIndex, { status: "error", error: msg });
            toast.error(`${file.name}: ${msg}`);
          }
        }),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploads.length, requestUploadUrl, finalizeUpload, assignDoc, updateUpload, onUploadComplete, selectedFolderId],
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) processFiles(files);
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) processFiles(files);
    e.target.value = "";
  }, [processFiles]);

  const doneUploads = uploads.filter((u) => u.status === "done" || u.status === "error");

  return (
    <div className="space-y-4">
      <div className="space-y-3">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Vùng kéo thả file"
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              isDragOver
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <div className={`mb-3 rounded-full p-3 ${isDragOver ? "bg-primary/10" : "bg-muted"}`}>
              <Upload className={`h-6 w-6 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
            </div>
            <p className="mb-1 font-semibold">{L.dropzoneText}</p>
            <p className="mb-4 text-sm text-muted-foreground">hoặc nhấn để chọn file</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              <FileUp className="mr-2 h-4 w-4" aria-hidden />
              {L.browseButton}
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">{L.supportedFormats}</p>
          </div>

          {/* Folder selector */}
          {allFolders && allFolders.length > 0 && (
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 shrink-0 text-amber-500" />
              <select
                value={selectedFolderId ?? ""}
                onChange={(e) => setSelectedFolderId(e.target.value || null)}
                className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Không có folder</option>
                {allFolders.map((f) => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.epub,.docx,.pptx,.jpg,.jpeg,.png,.webp,.gif,.mp3,.m4a,.wav,.mp4,.webm,.md,.markdown,.html,.htm,.xhtml"
            className="hidden"
            onChange={handleFileInput}
            aria-hidden
          />

          {/* Upload list */}
          {uploads.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {uploads.map((u, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{u.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(u.file.size)}</p>
                    {u.status === "uploading" && (
                      <Progress value={u.progress} className="mt-1.5 h-1" />
                    )}
                    {u.status === "error" && (
                      <p className="mt-1 text-xs text-destructive">{u.error}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {u.status === "uploading" && (
                      <span className="text-xs tabular-nums text-muted-foreground">{u.progress}%</span>
                    )}
                    {u.status === "done" && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {u.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
              ))}
              {doneUploads.length > 0 && (
                <button
                  onClick={() => setUploads((p) => p.filter((u) => u.status !== "done" && u.status !== "error"))}
                  className="flex w-full items-center justify-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" /> Xoá thông báo
                </button>
              )}
            </div>
          )}
        </div>
    </div>
  );
}
