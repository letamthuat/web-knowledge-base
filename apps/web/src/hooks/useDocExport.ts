"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { toast } from "sonner";

const FORMAT_EXT: Record<string, string> = {
  pdf: ".pdf", epub: ".epub", docx: ".docx", pptx: ".pptx",
  image: ".jpg", audio: ".mp3", video: ".mp4", markdown: ".md", web_clip: ".html",
};

const COLOR_LABEL: Record<string, string> = {
  yellow: "vàng", green: "xanh lá", blue: "xanh dương",
  pink: "hồng", purple: "tím", custom: "tuỳ chỉnh",
};

function sanitizeName(name: string) {
  return name.replace(/[/\\?%*:|"<>]/g, "-");
}

export function useDocExport() {
  const [isExporting, setIsExporting] = useState(false);
  const getSingleDocExportData = useAction(api.documents.actions.getSingleDocExportData);

  async function exportDoc(docId: Id<"documents">) {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading("Đang chuẩn bị export...");

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const { doc, downloadUrl, highlights, notes, voiceUrls } = await getSingleDocExportData({ docId });
      const safeTitle = sanitizeName(doc.title);

      // --- File gốc hoặc web_clip content ---
      if (doc.format === "web_clip" && doc.clippedContent) {
        zip.file("clipped-content.html", doc.clippedContent);
      } else if (downloadUrl) {
        toast.loading("Đang tải file gốc...", { id: toastId });
        try {
          const res = await fetch(downloadUrl);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            const ext = FORMAT_EXT[doc.format] ?? "";
            const fileName = safeTitle.endsWith(ext) ? safeTitle : safeTitle + ext;
            zip.file(fileName, buf);
          }
        } catch {
          toast.error("Không thể tải file gốc", { id: toastId });
          return;
        }
      }

      // --- highlights.md ---
      if (highlights.length > 0) {
        const lines: string[] = [
          `# Highlights — [[${doc.title}]]`,
          "",
          "| # | Đoạn highlight | Ghi chú | Màu |",
          "|---|---|---|---|",
        ];
        highlights.forEach((h, i) => {
          const text = h.selectedText.replace(/\|/g, "\\|").replace(/\n/g, " ");
          const note = (h.note ?? "").replace(/\|/g, "\\|");
          const color = COLOR_LABEL[h.color] ?? h.color;
          lines.push(`| ${i + 1} | ${text} | ${note} | ${color} |`);
        });
        zip.file("highlights.md", lines.join("\n"));
      }

      // --- notes/<noteId>.md ---
      if (notes.length > 0) {
        const notesFolder = zip.folder("notes")!;
        for (const note of notes) {
          const noteName = sanitizeName(note.title || note.id);
          const tagList = note.tagIds.length > 0 ? note.tagIds.join(", ") : "";
          const frontmatter = [
            "---",
            `parentDoc: "[[${doc.title}]]"`,
            tagList ? `tags: [${tagList}]` : "tags: []",
            "---",
            "",
          ].join("\n");
          notesFolder.file(`${noteName}.md`, frontmatter + note.body);
        }
      }

      // --- voice/<highlightId>.mp3 ---
      const voiceEntries = Object.entries(voiceUrls);
      if (voiceEntries.length > 0) {
        const voiceFolder = zip.folder("voice")!;
        for (const [highlightId, url] of voiceEntries) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              voiceFolder.file(`${highlightId}.mp3`, buf);
            }
          } catch {
            // bỏ qua voice note lỗi, tiếp tục
          }
        }
      }

      toast.loading("Đang nén...", { id: toastId });
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${safeTitle}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);

      toast.success("Export hoàn tất", { id: toastId });
    } catch (err) {
      console.error("[exportDoc]", err);
      toast.error("Export thất bại", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }

  return { exportDoc, isExporting };
}
