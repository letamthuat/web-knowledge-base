"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload, X, CheckCircle, AlertCircle, FileUp,
  FolderPlus, Folder, FileText, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { labels } from "@/lib/i18n/labels";
import { detectFormat, formatBytes } from "@/lib/storage";

const L = labels.upload;
const Lf = labels.folder;

interface FileUploadState {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface UploadDropzoneProps {
  onUploadComplete?: () => void;
}

type Tab = "upload" | "folder";

export function UploadDropzone({ onUploadComplete }: UploadDropzoneProps) {
  const [tab, setTab] = useState<Tab>("upload");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const [folderName, setFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestUploadUrl = useAction(api.documents.actions.requestUploadUrl);
  const finalizeUpload = useMutation(api.documents.mutations.finalizeUpload);
  const createFolder = useMutation(api.folders.mutations.create);
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
                  else reject(new Error(`HTTP ${xhr.status}`));
                });
                xhr.addEventListener("error", () => reject(new Error("Network error")));
                xhr.open("PUT", uploadUrl);
                xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
                xhr.send(file);
              });
            }

            const title = file.name.replace(/\.[^.]+$/, "");
            await finalizeUpload({
              title,
              format: format as "pdf" | "epub" | "docx" | "pptx" | "image" | "audio" | "video" | "markdown" | "web_clip",
              fileSizeBytes: file.size,
              storageBackend,
              storageKey: finalStorageKey,
            });

            updateUpload(absoluteIndex, { status: "done", progress: 100 });
            onUploadComplete?.();
          } catch {
            updateUpload(absoluteIndex, { status: "error", error: L.uploadError });
            toast.error(`${file.name}: ${L.uploadError}`);
          }
        }),
      );
    },
    [uploads.length, requestUploadUrl, finalizeUpload, updateUpload, onUploadComplete],
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

  async function handleCreateFolder() {
    const name = folderName.trim();
    if (!name) return;
    setIsCreatingFolder(true);
    try {
      await createFolder({ name });
      toast.success(`Đã tạo folder "${name}"`);
      setFolderName("");
    } catch {
      toast.error("Tạo folder thất bại");
    } finally {
      setIsCreatingFolder(false);
    }
  }

  const doneUploads = uploads.filter((u) => u.status === "done" || u.status === "error");

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex rounded-lg border border-input bg-muted/40 p-1 gap-1">
        <button
          onClick={() => setTab("upload")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            tab === "upload"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileUp className="h-4 w-4" aria-hidden />
          Tải lên tài liệu
        </button>
        <button
          onClick={() => setTab("folder")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            tab === "folder"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FolderPlus className="h-4 w-4" aria-hidden />
          Quản lý folder
        </button>
      </div>

      {tab === "upload" && (
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

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.epub,.docx,.pptx,.jpg,.jpeg,.png,.webp,.gif,.mp3,.m4a,.wav,.mp4,.webm,.md,.markdown"
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
      )}

      {tab === "folder" && (
        <div className="space-y-4">
          {/* Create folder */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="mb-3 text-sm font-semibold">Tạo folder mới</p>
            <div className="flex gap-2">
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
                placeholder={Lf.folderNamePlaceholder}
                maxLength={100}
                className="flex-1"
                aria-label="Tên folder"
              />
              <Button
                onClick={handleCreateFolder}
                disabled={!folderName.trim() || isCreatingFolder}
                size="sm"
              >
                <FolderPlus className="mr-1.5 h-4 w-4" aria-hidden />
                Tạo
              </Button>
            </div>
          </div>

          {/* Folder list */}
          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">Danh sách folder</p>
            {!allFolders || allFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                <Folder className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">{Lf.noFolders}</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {allFolders.map((folder) => (
                  <div
                    key={folder._id}
                    className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5"
                  >
                    <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                    <span className="flex-1 truncate text-sm">{folder.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
