"use client";
// Nút 🎧 trên header reader (markdown + pdf). Bắt đầu nghe từ mục đang hiện trên màn hình;
// nếu lần trước nghe dở trong cùng mục → nghe tiếp đúng giây đó.
import { useState, type RefObject } from "react";
import { Headphones, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markdownToSpeechSegments, pagesToSpeechSegments, type SpeechSegment } from "@/lib/tts/speechText";
import { useTts, getTtsState, unlockAudio, togglePlay, startListening, getSavedPos } from "@/lib/tts/player";
import { getPdfReflow } from "@/lib/pdf/reflow";

export const LISTENABLE_FORMATS = new Set(["markdown", "pdf"]);

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Đoạn ứng với vị trí đang đọc trên màn hình; -1 nếu không xác định được. */
function visibleSegmentIndex(segments: SpeechSegment[], container: HTMLElement | null, format: string): number {
  if (!container) return -1;
  const box = container.getBoundingClientRect();
  if (format === "pdf") {
    const pages = Array.from(container.querySelectorAll<HTMLElement>("[data-page]"));
    const first = pages.find((el) => el.getBoundingClientRect().bottom > box.top + 120);
    const page = first ? Number(first.dataset.page) : NaN;
    if (!page) return -1;
    return segments.findIndex((s) => (s.page ?? 0) >= page);
  }
  const limit = box.top + box.height * 0.35;
  let current: HTMLElement | null = null;
  for (const h of Array.from(container.querySelectorAll<HTMLElement>("article h1, article h2, article h3"))) {
    if (h.getBoundingClientRect().top <= limit) current = h;
    else break;
  }
  if (!current) return -1;
  const target = norm(current.textContent ?? "");
  return segments.findIndex((s) => s.headingText != null && norm(s.headingText) === target);
}

async function buildSegments(doc: { _id: string; title: string; format: string }, downloadUrl: string): Promise<SpeechSegment[]> {
  if (doc.format === "pdf") {
    const pages = await getPdfReflow(doc._id, downloadUrl);
    return pagesToSpeechSegments(pages.map((p) => ({ page: p.page, paragraphs: p.blocks.map((b) => b.text) })));
  }
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error("Không tải được tài liệu");
  return markdownToSpeechSegments(await res.text(), doc.title);
}

export function ListenButton({ doc, downloadUrl, containerRef }: {
  doc: { _id: string; title: string; format: string };
  downloadUrl: string;
  containerRef: RefObject<HTMLElement | null>;
}) {
  const tts = useTts();
  const [busy, setBusy] = useState(false);
  const mine = tts.docId === doc._id;

  async function onClick() {
    unlockAudio(); // PHẢI đồng bộ trong cú chạm (iOS)
    if (getTtsState().docId === doc._id) { togglePlay(); return; }
    setBusy(true);
    try {
      const segments = await buildSegments(doc, downloadUrl);
      if (segments.length === 0) {
        toast.error(doc.format === "pdf" ? "PDF này là ảnh scan, không có chữ để đọc" : "Tài liệu không có chữ để đọc");
        return;
      }
      const visible = visibleSegmentIndex(segments, containerRef.current, doc.format);
      const saved = getSavedPos(doc._id);
      let start = visible >= 0 ? visible : 0;
      let time = 0;
      if (saved && saved.index < segments.length) {
        const sameSection = visible < 0 || segments[saved.index].title === segments[visible].title;
        if (sameSection) { start = saved.index; time = saved.time; }
      }
      startListening({ docId: doc._id, docTitle: doc.title, segments, startIndex: start, startTime: time });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không mở được chế độ nghe");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      title={mine && tts.playing ? "Tạm dừng nghe" : "Nghe bài"}
      aria-label="Nghe bài"
      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
        mine ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      }`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className={`h-4 w-4 ${mine && tts.playing ? "animate-pulse" : ""}`} />}
    </button>
  );
}
