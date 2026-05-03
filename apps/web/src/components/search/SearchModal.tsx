"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, StickyNote, Highlighter, X, BookOpen, FileType2, Presentation, Image, Music, Video, FileCode, Globe } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, epub: BookOpen, docx: FileType2, pptx: Presentation,
  image: Image, audio: Music, video: Video, markdown: FileCode, web_clip: Globe,
};

function bodyPreview(body: string): string {
  try {
    const blocks = JSON.parse(body) as Array<{ content?: Array<{ text?: string }> }>;
    const text = blocks
      .flatMap((b) => b.content ?? [])
      .map((c) => c.text ?? "")
      .join(" ")
      .trim();
    return text.slice(0, 120) || "(Chưa có nội dung)";
  } catch {
    return body.slice(0, 120) || "(Chưa có nội dung)";
  }
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { docs, notes, highlights, isLoading, hasResults, searched } = useSearch(q);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function goToDoc(docId: string) {
    onClose();
    router.push(`/reader/${docId}`);
  }

  function goToNote(noteId: string) {
    onClose();
    router.push(`/notes?note=${noteId}`);
  }

  const totalResults = docs.length + notes.length + highlights.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-xl border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm kiếm tài liệu, ghi chú..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Đang tìm kiếm...
            </div>
          )}

          {/* No results */}
          {!isLoading && searched && !hasResults && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Không có kết quả cho &ldquo;{q}&rdquo;
            </div>
          )}

          {/* Placeholder */}
          {!searched && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Gõ ít nhất 2 ký tự để tìm kiếm
            </div>
          )}

          {/* Docs */}
          {docs.length > 0 && (
            <Section label={`Tài liệu (${docs.length})`} icon={<FileText className="h-3.5 w-3.5" />}>
              {(docs as any[]).map((doc) => {
                const Icon = FORMAT_ICONS[doc.format ?? ""] ?? FileText;
                return (
                  <ResultItem key={doc._id} onClick={() => goToDoc(doc._id)}>
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{doc.title}</p>
                      {doc.extractedText && (
                        <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                          {doc.extractedText.slice(0, 100)}
                        </p>
                      )}
                    </div>
                  </ResultItem>
                );
              })}
            </Section>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <Section label={`Ghi chú (${notes.length})`} icon={<StickyNote className="h-3.5 w-3.5" />}>
              {(notes as any[]).map((note) => (
                <ResultItem key={note._id} onClick={() => goToNote(note._id)}>
                  <StickyNote className="h-4 w-4 shrink-0 text-violet-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {note.title || "(Không có tiêu đề)"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                      {bodyPreview(note.body)}
                    </p>
                  </div>
                </ResultItem>
              ))}
            </Section>
          )}

          {/* Highlights */}
          {highlights.length > 0 && (
            <Section label={`Highlight notes (${highlights.length})`} icon={<Highlighter className="h-3.5 w-3.5" />}>
              {(highlights as any[]).map((hl) => (
                <ResultItem key={hl._id} onClick={() => goToDoc(hl.docId)}>
                  <Highlighter className="h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-muted-foreground italic">
                      &ldquo;{(hl.selectedText ?? "").slice(0, 80)}&rdquo;
                    </p>
                    <p className="truncate text-[12px] text-foreground mt-0.5">{hl.note}</p>
                  </div>
                </ResultItem>
              ))}
            </Section>
          )}

          {/* Total count */}
          {!isLoading && hasResults && (
            <p className="px-4 pt-1 pb-2 text-[11px] text-muted-foreground/60 text-right">
              {totalResults} kết quả
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-4 py-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</span>
      </div>
      {children}
    </div>
  );
}

function ResultItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/60"
    >
      {children}
    </button>
  );
}
