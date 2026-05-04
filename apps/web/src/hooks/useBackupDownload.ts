"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/_generated/api";
import { toast } from "sonner";

const FORMAT_EXT: Record<string, string> = {
  pdf: ".pdf", epub: ".epub", docx: ".docx", pptx: ".pptx",
  image: ".jpg", audio: ".mp3", video: ".mp4", markdown: ".md", web_clip: ".html",
};

function sanitize(name: string) {
  return name.replace(/[/\\?%*:|"<>]/g, "-");
}

export function useBackupDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const getBackupData = useAction(api.documents.actions.getBackupData);

  async function downloadBackup() {
    if (isDownloading) return;
    setIsDownloading(true);
    const toastId = toast.loading("Đang chuẩn bị export...");

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const { docs, notes, highlights, tags, readingProgress, preferences } = await getBackupData({});

      // --- Build tag lookup ---
      const tagMap = new Map<string, string>(tags.map((t) => [t.id, t.name]));

      // --- Documents: documents/<docId>/<title>.<ext> + highlights.md ---
      let docsDone = 0;
      toast.loading(`Đang tải tài liệu (0/${docs.length})...`, { id: toastId });

      for (const doc of docs) {
        const docFolder = zip.folder(`documents/${doc.id}`)!;
        const ext = FORMAT_EXT[doc.format] ?? "";
        const safeName = sanitize(doc.title);
        const fileName = safeName.endsWith(ext) ? safeName : safeName + ext;

        if (doc.format === "web_clip" && doc.clippedContent) {
          docFolder.file(fileName, doc.clippedContent);
        } else if (doc.downloadUrl) {
          try {
            const res = await fetch(doc.downloadUrl);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              docFolder.file(fileName, buf);
            }
          } catch {
            // skip lỗi, tiếp tục
          }
        }

        // highlights.md per-doc (Obsidian wikilink)
        const docHighlights = highlights.filter((h) => h.docId === doc.id);
        if (docHighlights.length > 0) {
          const lines = [`# Highlights — [[${doc.title}]]\n`];
          lines.push("| # | Text | Note | Color |");
          lines.push("|---|------|------|-------|");
          docHighlights.forEach((h, i) => {
            const note = h.note?.replace(/\|/g, "\\|") ?? "";
            const text = h.text.replace(/\|/g, "\\|");
            lines.push(`| ${i + 1} | ${text} | ${note} | ${h.color} |`);
          });
          docFolder.file("highlights.md", lines.join("\n"));
        }

        docsDone++;
        toast.loading(`Đang tải tài liệu (${docsDone}/${docs.length})...`, { id: toastId });
      }

      // --- Notes: notes/<noteId>.md with frontmatter ---
      const notesFolder = zip.folder("notes")!;
      for (const note of notes) {
        const safeName = sanitize(note.title || "Untitled");
        const noteTagNames = (note.tagIds ?? []).map((id) => tagMap.get(id) ?? id);
        const parentDocTitle = note.docTitle ? `[[${note.docTitle}]]` : "";
        const frontmatter = [
          "---",
          `title: "${(note.title || "Untitled").replace(/"/g, '\\"')}"`,
          parentDocTitle ? `parentDoc: ${parentDocTitle}` : null,
          noteTagNames.length > 0 ? `tags: [${noteTagNames.map((t) => `"${t}"`).join(", ")}]` : null,
          `updatedAt: ${new Date(note.updatedAt).toISOString()}`,
          "---",
        ].filter(Boolean).join("\n");
        const content = `${frontmatter}\n\n${note.body}`;
        notesFolder.file(`${safeName}-${note.id.slice(-6)}.md`, content);
      }

      // --- data.json ---
      const dataJson = {
        exportedAt: new Date().toISOString(),
        docs: docs.map((d) => ({
          id: d.id,
          title: d.title,
          format: d.format,
          createdAt: d.createdAt,
        })),
        notes: notes.map((n) => ({
          id: n.id,
          title: n.title,
          docId: n.docId,
          tagIds: n.tagIds,
          updatedAt: n.updatedAt,
        })),
        highlights: highlights.map((h) => ({
          docId: h.docId,
          docTitle: h.docTitle,
          text: h.text,
          note: h.note,
          color: h.color,
          createdAt: h.createdAt,
        })),
        tags,
        readingProgress,
        preferences,
      };
      zip.file("data.json", JSON.stringify(dataJson, null, 2));

      // --- README.md ---
      const readme = [
        "# Web Knowledge Base — Export",
        "",
        `Exported: ${new Date().toISOString()}`,
        `Documents: ${docs.length}`,
        `Notes: ${notes.length}`,
        `Highlights: ${highlights.length}`,
        "",
        "## Structure",
        "",
        "```",
        "documents/<docId>/          # Original file + highlights.md per document",
        "notes/                      # All notes as Markdown with frontmatter",
        "data.json                   # Full structured export (import-compatible)",
        "README.md                   # This file",
        "```",
        "",
        "## Obsidian",
        "",
        "Open this folder as an Obsidian vault. Notes and highlights use `[[wikilinks]]` to reference documents.",
      ].join("\n");
      zip.file("README.md", readme);

      toast.loading("Đang nén file...", { id: toastId });
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });

      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `web-kb-export-${date}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);

      toast.success(`Export hoàn tất — ${docs.length} tài liệu, ${notes.length} ghi chú`, { id: toastId });
    } catch (err) {
      console.error("[backup]", err);
      toast.error("Export thất bại", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  }

  return { downloadBackup, isDownloading };
}
