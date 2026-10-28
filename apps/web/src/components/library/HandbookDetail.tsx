"use client";

/**
 * HandbookDetail — trang riêng của 1 Handbook trong Thư viện:
 * bìa bộ sách · % hoàn thành · nút đọc tiếp · mục lục theo chương (folder cấp 1).
 */
import { useMemo } from "react";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { useActiveTab } from "@/contexts/ActiveTabContext";
import { useDomains } from "@/lib/api/domains";
import type { DocumentRow } from "@/lib/api/documents";
import { StatusMark } from "@/components/handbook/StatusMark";
import { VolumeCover, type HandbookStat } from "./HandbookShelves";

const stripExt = (s: string) => s.replace(/\.(md|markdown|pdf|epub|docx?|pptx?|html?)$/i, "");

/** "02-supply/03-mrp/bai-1.md" → chương "02-supply", phần "03-mrp", tên "bai-1" */
function splitPath(d: DocumentRow) {
  const parts = (d.relPath ?? d.title).split("/");
  const name = stripExt(parts.pop() ?? d.title);
  const chapter = parts[0] ?? "";
  const sub = parts.slice(1).join(" / ");
  return { chapter, sub, name };
}

export function HandbookDetail({ hb, pctByDoc, onBack }: {
  hb: HandbookStat;
  pctByDoc: Map<string, number | null>;
  onBack: () => void;
}) {
  const { navigate } = useActiveTab();
  const domains = useDomains();
  const domainName = domains?.find((d) => d._id === hb.domainId)?.name;

  const chapters = useMemo(() => {
    const map = new Map<string, { file: DocumentRow; sub: string; name: string }[]>();
    for (const f of hb.files) {
      const { chapter, sub, name } = splitPath(f);
      const arr = map.get(chapter);
      const item = { file: f, sub, name };
      if (arr) arr.push(item); else map.set(chapter, [item]);
    }
    // File ở thư mục gốc (README…) là phần "Mở đầu" → luôn đứng đầu mục lục
    return [...map.entries()].sort((a, b) => (a[0] === "" ? -1 : b[0] === "" ? 1 : 0));
  }, [hb.files]);

  const target = hb.files.find((f) => f._id === hb.targetDocId);
  const started = hb.files.some((f) => (pctByDoc.get(f._id) ?? 0) > 0);
  const done = hb.files.filter((f) => (pctByDoc.get(f._id) ?? 0) >= 0.95).length;
  const open = (id: string, from?: HTMLElement | null) => navigate(`/reader/${id}`, { from });

  return (
    <div className="animate-rise-in">
      <button
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 -ml-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Thư viện
      </button>

      {/* Đầu trang: bìa bộ sách + thông tin + đọc tiếp */}
      <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end">
        <VolumeCover name={hb.name} size="lg" className="w-[150px] shrink-0 sm:w-[176px]" />
        <div className="min-w-0 flex-1">
          {domainName && <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{domainName}</p>}
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">{hb.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {hb.files.length} bài · {chapters.length} chương · đã xong {done}/{hb.files.length}
          </p>
          <div className="mt-4 flex max-w-md items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(2, hb.avgPct)}%` }} />
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground">{hb.avgPct}%</span>
          </div>
          {target && (
            <button
              onClick={(e) => open(target._id, e.currentTarget)}
              className="press mt-5 inline-flex max-w-full items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm"
            >
              <span className="truncate">{started ? "Đọc tiếp" : "Bắt đầu đọc"}: {splitPath(target).name}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
          )}
        </div>
      </header>

      {/* Mục lục theo chương */}
      <div className="space-y-8">
        {chapters.map(([chapter, items], ci) => {
          const chDone = items.filter((i) => (pctByDoc.get(i.file._id) ?? 0) >= 0.95).length;
          return (
            <section key={chapter || "_root"} className="animate-rise-in" style={{ animationDelay: `${Math.min(ci, 8) * 40}ms` }}>
              <div className="mb-2 flex items-baseline gap-3 border-b border-border/70 pb-2">
                <span className="font-display text-sm font-semibold tabular-nums text-muted-foreground">{String(ci + 1).padStart(2, "0")}</span>
                <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-foreground">{chapter || "Mở đầu"}</h2>
                <span className="text-[11px] tabular-nums text-muted-foreground">{chDone}/{items.length}</span>
              </div>
              <ul>
                {items.map(({ file, sub, name }) => {
                  const pct = pctByDoc.get(file._id) ?? null;
                  return (
                    <li key={file._id}>
                      <button
                        onClick={(e) => open(file._id, e.currentTarget)}
                        className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/60"
                      >
                        <StatusMark format={file.format} pct={pct} />
                        <span className="min-w-0 flex-1">
                          {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
                          <span className="block truncate text-[14px] text-foreground/90 group-hover:text-foreground">{name}</span>
                        </span>
                        {pct != null && pct > 0 && pct < 0.95 && (
                          <span className="text-[11px] font-medium tabular-nums text-primary">{Math.round(pct * 100)}%</span>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-300 ease-spring group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
