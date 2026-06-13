"use client";

import { useCallback, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, X, FileArchive } from "lucide-react";
import { parseArchive, ARCHIVE_ACCEPT, ARCHIVE_FORMATS } from "@/lib/handbook/zipImport";

interface ImportZipDialogProps {
  handbookId: Id<"handbooks">;
  handbookName?: string;
  onClose: () => void;
  onComplete?: () => void;
}

type Phase = "idle" | "reading" | "uploading" | "finalizing" | "done";

export function ImportZipDialog({ handbookId, handbookName, onClose, onComplete }: ImportZipDialogProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestUploadUrl = useAction(api.documents.actions.requestUploadUrl);
  const finalizeImport = useMutation(api.handbooks.mutations.finalizeImport);

  const handleFile = useCallback(async (file: File) => {
    try {
      setPhase("reading");
      setStatusText("Đang giải nén…");
      const { entries, skipped } = await parseArchive(file);
      if (entries.length === 0) {
        toast.error("Không tìm thấy file hỗ trợ trong ZIP");
        setPhase("idle");
        return;
      }

      setPhase("uploading");
      const manifest: {
        relPath: string; storageKey: string; format: string;
        fileSizeBytes?: number; mimeType?: string;
      }[] = [];
      let failed = 0;

      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        setStatusText(`Đang tải lên ${i + 1}/${entries.length}: ${e.relPath}`);
        setProgress(Math.round((i / entries.length) * 100));
        try {
          const { uploadUrl, storageKey } = await requestUploadUrl({
            fileSizeBytes: e.size,
            format: e.format,
            fileName: e.relPath.split("/").pop() ?? e.relPath,
            mimeType: e.mimeType,
          });
          await putToR2(uploadUrl, e.blob);
          manifest.push({
            relPath: e.relPath,
            storageKey,
            format: e.format,
            fileSizeBytes: e.size,
            mimeType: e.mimeType,
          });
        } catch (err) {
          console.error("[ImportZip] upload failed:", e.relPath, err);
          failed++;
        }
      }

      if (manifest.length === 0) {
        toast.error("Tải lên thất bại toàn bộ");
        setPhase("idle");
        return;
      }

      setPhase("finalizing");
      setStatusText("Đang hoàn tất…");
      setProgress(100);
      const res = await finalizeImport({
        handbookId,
        files: manifest as never,
      });

      setPhase("done");
      const msgs = [`Đã thêm ${res.created} file`];
      if (skipped) msgs.push(`bỏ qua ${skipped} (định dạng không hỗ trợ)`);
      if (failed) msgs.push(`lỗi ${failed}`);
      toast.success(msgs.join(", "));
      onComplete?.();
      onClose();
    } catch (err) {
      console.error("[ImportZip] error:", err);
      toast.error(err instanceof Error ? err.message : "Lỗi import file nén");
      setPhase("idle");
    }
  }, [requestUploadUrl, finalizeImport, handbookId, onComplete, onClose]);

  const busy = phase !== "idle" && phase !== "done";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Import Handbook</h2>
          </div>
          {!busy && (
            <button onClick={onClose} className="rounded p-1 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {handbookName && (
          <p className="mb-3 text-sm text-muted-foreground">
            Thêm vào: <span className="font-medium text-foreground">{handbookName}</span>
          </p>
        )}

        {phase === "idle" ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center hover:border-primary/50 hover:bg-muted/30"
          >
            <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Chọn file nén của Handbook</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Hỗ trợ: {ARCHIVE_FORMATS.join(" · ")} — giữ nguyên cây thư mục
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3">Chọn file</Button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <Progress value={progress} className="h-2" />
            <p className="truncate text-xs text-muted-foreground">{statusText}</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ARCHIVE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function putToR2(uploadUrl: string, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 HTTP ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Network/CORS error uploading to R2")));
    xhr.open("PUT", uploadUrl);
    // Không set Content-Type — presigned URL không ký header này
    xhr.send(blob);
  });
}
