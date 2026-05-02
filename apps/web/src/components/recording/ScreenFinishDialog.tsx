"use client";

import { useState, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/_generated/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Id } from "@/_generated/dataModel";

interface Props {
  blob: Blob;
  durationMs: number;
  onClose: () => void;
  onCancel: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ScreenFinishDialog({ blob, durationMs, onClose, onCancel }: Props) {
  const router = useRouter();
  const [fileName, setFileName] = useState(`Quay màn hình ${new Date().toLocaleDateString("vi-VN")}`);
  const [uploading, setUploading] = useState(false);
  const videoUrl = useRef(URL.createObjectURL(blob)).current;

  const requestUploadUrl = useAction(api.documents.actions.requestUploadUrl);
  const finalizeUpload = useMutation(api.documents.mutations.finalizeUpload);

  async function handleUpload() {
    if (uploading) return;
    setUploading(true);
    try {
      const mimeType = blob.type || "video/webm";
      const { uploadUrl, storageKey } = await requestUploadUrl({
        fileSizeBytes: blob.size,
        format: "video",
        fileName: `${fileName}.webm`,
        mimeType,
      });

      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": mimeType },
      });
      if (!res.ok) throw new Error("Upload thất bại");

      const docId = await finalizeUpload({
        title: fileName,
        format: "video",
        storageBackend: "r2",
        storageKey,
        fileSizeBytes: blob.size,
      });

      toast.success("Đã lưu vào thư viện", {
        action: {
          label: "Mở",
          onClick: () => router.push(`/reader/${docId as Id<"documents">}`),
        },
      });
      URL.revokeObjectURL(videoUrl);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi tải lên");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-xl shadow-xl p-6 w-full max-w-lg flex flex-col gap-4">
        <h2 className="text-base font-semibold">Lưu bản quay màn hình</h2>

        <video
          controls
          src={videoUrl}
          className="w-full rounded-lg max-h-48 bg-black"
        />

        <p className="text-xs text-muted-foreground">Thời lượng: {formatDuration(durationMs)}</p>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Tên file</label>
          <input
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="Tên bản quay màn hình"
            disabled={uploading}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={uploading}
            className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || !fileName.trim()}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {uploading ? "Đang tải lên..." : "Upload lên thư viện"}
          </button>
        </div>
      </div>
    </div>
  );
}
