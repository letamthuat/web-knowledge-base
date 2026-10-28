"use client";

/**
 * LibraryHome — phần "trang chủ" phía trên lưới tài liệu:
 *   Đọc tiếp (hero) · Thẻ cần ôn hôm nay · Kệ gần đây · Kệ Handbook
 */
import { memo, useMemo, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { vi } from "date-fns/locale";
import { ArrowRight, Layers, Library } from "lucide-react";
import { useActiveTab } from "@/contexts/ActiveTabContext";
import { useRecentHistory, type RecentHistoryItem } from "@/lib/api/reading-progress";
import { useHandbooks } from "@/lib/api/handbooks";
import { useDueCountsBySpace } from "@/lib/api/study";
import type { DocumentRow } from "@/lib/api/documents";
import { FORMAT_LABELS } from "@/lib/formats";
import { BookCover } from "./BookCover";

function lastReadLabel(ts: number | string | null | undefined): string {
  const n = typeof ts === "string" ? Number(ts) : ts;
  if (!n || Number.isNaN(n)) return "";
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return `hôm nay, ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `hôm qua, ${format(d, "HH:mm")}`;
  return format(d, "d MMM", { locale: vi });
}

function pctOf(item: RecentHistoryItem) {
  return item.progress.progressPct != null ? Math.round(item.progress.progressPct * 100) : 0;
}

/** Tiêu đề mục: chữ nhỏ in hoa giãn cách — kiểu mục lục tạp chí */
function SectionLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-2xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{children}</h2>
      {aside}
    </div>
  );
}

// ─── Đọc tiếp (hero) ────────────────────────────────────────────────────────
function ContinueHero({ item }: { item: RecentHistoryItem }) {
  const { navigate } = useActiveTab();
  const ref = useRef<HTMLButtonElement>(null);
  const pct = pctOf(item);
  const when = lastReadLabel(item.progress.updatedAt);

  return (
    <button
      ref={ref}
      onClick={() => navigate(`/reader/${item.doc._id}`, { from: ref.current })}
      className="press group relative flex w-full gap-4 overflow-hidden rounded-[26px] border border-border/70 bg-card p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-24px_rgba(0,0,0,0.25)] sm:gap-6 sm:p-5"
    >
      <BookCover title={item.doc.title} format={item.doc.format} size="lg" className="w-[96px] shrink-0 sm:w-[128px]" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {FORMAT_LABELS[item.doc.format] ?? item.doc.format}{when ? ` · đọc ${when}` : ""}
        </p>
        <h3 className="mt-1.5 line-clamp-3 font-display text-xl font-semibold leading-tight text-foreground sm:text-[26px]">
          {item.doc.title}
        </h3>
        <div className="mt-auto pt-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-spring" style={{ width: `${Math.max(3, pct)}%` }} />
            </div>
            <span className="text-xs font-semibold tabular-nums text-foreground">{pct}%</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform duration-300 ease-spring group-hover:translate-x-0.5">
            Đọc tiếp <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Thẻ cần ôn hôm nay ─────────────────────────────────────────────────────
function StudyDueCard() {
  const { navigate } = useActiveTab();
  const dueBySpace = useDueCountsBySpace();
  const total = Object.values(dueBySpace).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <button
      onClick={() => navigate("/study")}
      className="press group relative flex w-full flex-col justify-between overflow-hidden rounded-[26px] border border-border/70 bg-accent p-5 text-left lg:min-h-full"
    >
      {/* Xấp thẻ xếp chồng */}
      <div className="pointer-events-none absolute -right-3 -top-3 h-24 w-20 rotate-12 rounded-xl border border-border/80 bg-card/70" />
      <div className="pointer-events-none absolute right-4 top-2 h-24 w-20 rotate-[4deg] rounded-xl border border-border bg-card shadow-sm" />
      <div className="relative flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Layers className="h-3.5 w-3.5" /> Ôn tập hôm nay
      </div>
      <div className="relative mt-6">
        <p className="font-display text-5xl font-semibold leading-none tabular-nums text-foreground">{total}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">thẻ đến hạn — vài phút là xong</p>
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
          Bắt đầu ôn <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-spring group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

// ─── Kệ gần đây ─────────────────────────────────────────────────────────────
function RecentShelf({ items }: { items: RecentHistoryItem[] }) {
  const { navigate } = useActiveTab();
  return (
    <section className="mt-8">
      <SectionLabel>Gần đây</SectionLabel>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-none md:-mx-6 md:px-6">
        {items.map((item, i) => {
          const pct = pctOf(item);
          return (
            <button
              key={item.doc._id}
              onClick={(e) => navigate(`/reader/${item.doc._id}`, { from: e.currentTarget })}
              className="press group w-[96px] shrink-0 snap-start text-left animate-rise-in sm:w-[112px]"
              style={{ animationDelay: `${60 + i * 45}ms` }}
            >
              <BookCover title={item.doc.title} format={item.doc.format} size="sm" className="transition-transform duration-300 ease-spring can-hover:group-hover:-translate-y-1" />
              <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-snug text-foreground/90">{item.doc.title}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Kệ Handbook ────────────────────────────────────────────────────────────
type HandbookStat = { id: string; name: string; count: number; avgPct: number; targetDocId: string | null };

function HandbookShelf({ docs, pctByDoc }: { docs: DocumentRow[]; pctByDoc: Map<string, number | null> }) {
  const { navigate } = useActiveTab();
  const handbooks = useHandbooks(undefined);

  const stats = useMemo<HandbookStat[]>(() => {
    if (!handbooks?.length) return [];
    const byHb = new Map<string, DocumentRow[]>();
    for (const d of docs) {
      if (!d.handbookId) continue;
      const arr = byHb.get(d.handbookId);
      if (arr) arr.push(d); else byHb.set(d.handbookId, [d]);
    }
    return handbooks
      .map((hb) => {
        const files = byHb.get(hb._id) ?? [];
        const pcts = files.map((f) => pctByDoc.get(f._id) ?? 0);
        const avgPct = files.length ? Math.round((pcts.reduce((a, b) => a + (b ?? 0), 0) / files.length) * 100) : 0;
        // Mở đúng chỗ đang đọc dở: file mở gần nhất, chưa có thì file đầu theo đường dẫn
        const lastOpened = [...files].filter((f) => f.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0];
        const first = [...files].sort((a, b) => (a.relPath ?? a.title).localeCompare(b.relPath ?? b.title, "vi", { numeric: true }))[0];
        return { id: hb._id, name: hb.name, count: files.length, avgPct, targetDocId: (lastOpened ?? first)?._id ?? null };
      })
      .filter((s) => s.count > 0);
  }, [handbooks, docs, pctByDoc]);

  if (stats.length === 0) return null;

  return (
    <section className="mt-8">
      <SectionLabel aside={<span className="text-2xs text-muted-foreground">{stats.length} bộ</span>}>
        <span className="inline-flex items-center gap-1.5"><Library className="h-3.5 w-3.5" /> Kệ Handbook</span>
      </SectionLabel>
      <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 scrollbar-none md:-mx-6 md:px-6">
        {stats.map((hb, i) => (
          <button
            key={hb.id}
            disabled={!hb.targetDocId}
            onClick={(e) => hb.targetDocId && navigate(`/reader/${hb.targetDocId}`, { from: e.currentTarget })}
            className="press group w-[112px] shrink-0 snap-start text-left animate-rise-in sm:w-[128px]"
            style={{ animationDelay: `${80 + i * 50}ms` }}
          >
            {/* Bộ sách nhiều tập: 2 bìa lót phía sau */}
            <div className="relative pr-2 pt-2">
              <div className="absolute right-0 top-0 h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-[4px_10px_10px_4px] bg-foreground/10" />
              <div className="absolute right-1 top-1 h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-[4px_10px_10px_4px] bg-foreground/15" />
              <BookCover title={hb.name} format="markdown" size="sm" className="relative transition-transform duration-300 ease-spring can-hover:group-hover:-translate-y-1" />
            </div>
            <p className="mt-2 line-clamp-2 font-display text-[14px] font-semibold leading-snug text-foreground">{hb.name}</p>
            <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{hb.count} bài · {hb.avgPct}%</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export const LibraryHome = memo(function LibraryHome({ docs, pctByDoc }: {
  docs: DocumentRow[];
  pctByDoc: Map<string, number | null>;
}) {
  const history = useRecentHistory(10);
  const [hero, ...rest] = history ?? [];

  return (
    <div className="mb-10">
      {hero && (
        <section>
          <SectionLabel>Đọc tiếp</SectionLabel>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="animate-rise-in"><ContinueHero item={hero} /></div>
            <div className="animate-rise-in [animation-delay:90ms]"><StudyDueCard /></div>
          </div>
        </section>
      )}
      {!hero && <StudyDueCard />}
      {rest.length > 0 && <RecentShelf items={rest} />}
      <HandbookShelf docs={docs} pctByDoc={pctByDoc} />
    </div>
  );
});
