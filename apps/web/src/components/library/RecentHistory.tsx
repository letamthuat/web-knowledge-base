"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/_generated/api";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  FileText, BookOpen, FileType2, Presentation, Image,
  Music, Video, FileCode, Globe, Clock,
} from "lucide-react";

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, epub: BookOpen, docx: FileType2, pptx: Presentation,
  image: Image, audio: Music, video: Video, markdown: FileCode, web_clip: Globe,
};
const FORMAT_COLORS: Record<string, string> = {
  pdf: "text-red-500", epub: "text-blue-500", docx: "text-blue-700",
  pptx: "text-orange-500", image: "text-green-500", audio: "text-purple-500",
  video: "text-pink-500", markdown: "text-gray-500", web_clip: "text-cyan-500",
};

export function RecentHistory() {
  const router = useRouter();
  const history = useQuery(api.reading_progress.queries.recentHistory, { limit: 10 });

  if (!history || history.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Đọc gần đây</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {history.map(({ doc, progress }) => {
          const Icon = FORMAT_ICONS[doc.format] ?? FileText;
          const iconColor = FORMAT_COLORS[doc.format] ?? "text-gray-400";
          const pct = progress.progressPct != null ? Math.round(progress.progressPct * 100) : null;

          return (
            <button
              key={doc._id}
              onClick={() => router.push(`/reader/${doc._id}`)}
              className="group flex w-44 shrink-0 flex-col rounded-xl border bg-card p-3 text-left hover:shadow-md transition-all hover:border-primary/30"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden />
              </div>
              <p className="line-clamp-2 text-xs font-medium leading-snug mb-2">{doc.title}</p>
              <div className="mt-auto space-y-1.5">
                {pct !== null && (
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {pct !== null ? `${pct}% · ` : ""}
                  {format(progress.updatedAt, "dd/MM/yyyy", { locale: vi })}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
