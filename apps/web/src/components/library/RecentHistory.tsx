"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRecentHistory } from "@/lib/api/reading-progress";
import { format, isToday, isYesterday } from "date-fns";
import { vi } from "date-fns/locale";
import {
  FileText, BookOpen, FileType2, Presentation, Image,
  Music, Video, FileCode, Globe, Sparkles, ArrowRight,
} from "lucide-react";

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, epub: BookOpen, docx: FileType2, pptx: Presentation,
  image: Image, audio: Music, video: Video, markdown: FileCode, web_clip: Globe,
};

const FORMAT_SPINES: Record<string, { border: string; bg: string; text: string }> = {
  pdf: { border: "border-l-rose-500", bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
  epub: { border: "border-l-amber-500", bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400" },
  docx: { border: "border-l-sky-500", bg: "bg-sky-500/10", text: "text-sky-700 dark:text-sky-400" },
  pptx: { border: "border-l-orange-500", bg: "bg-orange-500/10", text: "text-orange-700 dark:text-orange-400" },
  image: { border: "border-l-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400" },
  audio: { border: "border-l-purple-500", bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-400" },
  video: { border: "border-l-pink-500", bg: "bg-pink-500/10", text: "text-pink-700 dark:text-pink-400" },
  markdown: { border: "border-l-stone-500", bg: "bg-stone-500/10", text: "text-stone-700 dark:text-stone-300" },
  web_clip: { border: "border-l-teal-500", bg: "bg-teal-500/10", text: "text-teal-700 dark:text-teal-400" },
};

function formatProgressTime(timestamp: number | string | null | undefined): string {
  if (!timestamp) return "";
  const num = typeof timestamp === "string" ? Number(timestamp) : timestamp;
  if (!num || isNaN(num)) return "";
  const date = new Date(num);
  if (isNaN(date.getTime())) return "";
  try {
    if (isToday(date)) return `Hôm nay, ${format(date, "HH:mm")}`;
    if (isYesterday(date)) return `Hôm qua, ${format(date, "HH:mm")}`;
    return format(date, "dd/MM/yyyy", { locale: vi });
  } catch {
    return "";
  }
}

export function RecentHistory() {
  const router = useRouter();
  const history = useRecentHistory(8);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Chào buổi sáng";
    if (hour >= 12 && hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }, []);

  if (!history || history.length === 0) return null;

  return (
    <section className="mb-8">
      {/* Craft Sanctuary Header */}
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              <span>{greeting}</span>
              <span className="text-muted-foreground font-normal text-xs">· Tiếp tục đọc dở</span>
            </h2>
          </div>
        </div>
        <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
          {history.length} tài liệu gần nhất
        </span>
      </div>

      {/* Craft Shelf Books Container */}
      <div className="relative -mx-1 px-1">
        <div className="flex gap-3.5 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory">
          {history.map(({ doc, progress }) => {
            const Icon = FORMAT_ICONS[doc.format] ?? FileText;
            const spine = FORMAT_SPINES[doc.format] ?? {
              border: "border-l-primary",
              bg: "bg-primary/10",
              text: "text-primary",
            };
            const pct = progress.progressPct != null ? Math.round(progress.progressPct * 100) : null;

            return (
              <button
                key={doc._id}
                onClick={() => router.push(`/reader/${doc._id}`)}
                onMouseEnter={() => router.prefetch(`/reader/${doc._id}`)}
                className={`group relative flex w-48 shrink-0 flex-col rounded-[20px] border border-border/80 bg-card/95 p-4 text-left shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-200 ease-out border-l-[4px] ${spine.border} snap-start`}
              >
                {/* Header: Format icon + format label */}
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${spine.bg} ${spine.text} transition-transform duration-200 group-hover:scale-105`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  {pct !== null ? (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {pct}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                      {doc.format}
                    </span>
                  )}
                </div>

                {/* Document Title */}
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground/90 group-hover:text-primary transition-colors mb-3">
                  {doc.title}
                </p>

                {/* Progress bar + timestamp */}
                <div className="mt-auto space-y-2">
                  {pct !== null && (
                    <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/85 transition-all duration-300"
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{formatProgressTime(progress.updatedAt)}</span>
                    <span className="can-hover:opacity-0 group-hover:opacity-100 flex items-center text-primary font-medium text-[11px] transition-opacity shrink-0">
                      Đọc <ArrowRight className="ml-0.5 h-3 w-3" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
