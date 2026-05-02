"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/_generated/api";
import { toast } from "sonner";

const FORMAT_EXT: Record<string, string> = {
  pdf: ".pdf", epub: ".epub", docx: ".docx", pptx: ".pptx",
  image: ".jpg", audio: ".mp3", video: ".mp4", markdown: ".md", web_clip: ".html",
};

export function useBackupDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const getBackupData = useAction(api.documents.actions.getBackupData);

  async function downloadBackup() {
    if (isDownloading) return;
    setIsDownloading(true);
    const toastId = toast.loading("Đang chuẩn bị backup...");

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const { docs, notes, highlights } = await getBackupData({});

      // --- Tài liệu ---
      const docsFolder = zip.folder("tai-lieu")!;
      let docsDone = 0;
      toast.loading(`Đang tải tài liệu (0/${docs.length})...`, { id: toastId });

      for (const doc of docs) {
        if (!doc.downloadUrl) continue;
        try {
          const res = await fetch(doc.downloadUrl);
          if (!res.ok) continue;
          const buf = await res.arrayBuffer();
          const ext = FORMAT_EXT[doc.format] ?? "";
          const safeName = doc.title.replace(/[/\\?%*:|"<>]/g, "-");
          const fileName = safeName.endsWith(ext) ? safeName : safeName + ext;
          docsFolder.file(fileName, buf);
          docsDone++;
          toast.loading(`Đang tải tài liệu (${docsDone}/${docs.length})...`, { id: toastId });
        } catch {
          // skip file lỗi, tiếp tục
        }
      }

      // --- Ghi chú ---
      const notesFolder = zip.folder("ghi-chu")!;
      for (const note of notes) {
        const safeName = (note.title || "Untitled").replace(/[/\\?%*:|"<>]/g, "-");
        const header = note.docTitle ? `> Gắn với tài liệu: ${note.docTitle}\n\n` : "";
        const content = `# ${note.title || "Untitled"}\n\n${header}${note.body}`;
        notesFolder.file(`${safeName}.md`, content);
      }

      // --- Highlights ---
      if (highlights.length > 0) {
        const hlByDoc = new Map<string, typeof highlights>();
        for (const h of highlights) {
          if (!hlByDoc.has(h.docTitle)) hlByDoc.set(h.docTitle, []);
          hlByDoc.get(h.docTitle)!.push(h);
        }
        const hlLines: string[] = ["# Highlights\n"];
        for (const [docTitle, rows] of hlByDoc) {
          hlLines.push(`## ${docTitle}\n`);
          for (const h of rows) {
            hlLines.push(`> ${h.text}`);
            if (h.note) hlLines.push(`\n*Ghi chú:* ${h.note}`);
            hlLines.push("");
          }
        }
        zip.file("highlights.md", hlLines.join("\n"));
      }

      // --- Metadata ---
      const meta = {
        exportedAt: new Date().toISOString(),
        docCount: docs.length,
        noteCount: notes.length,
        highlightCount: highlights.length,
      };
      zip.file("backup-info.json", JSON.stringify(meta, null, 2));

      toast.loading("Đang nén file...", { id: toastId });
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });

      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `backup-${date}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);

      toast.success(`Backup hoàn tất — ${docs.length} tài liệu, ${notes.length} ghi chú`, { id: toastId });
    } catch (err) {
      console.error("[backup]", err);
      toast.error("Backup thất bại", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  }

  return { downloadBackup, isDownloading };
}
