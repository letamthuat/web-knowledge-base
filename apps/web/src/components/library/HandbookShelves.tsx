"use client";

/**
 * HandbookShelves — mỗi Handbook là một "bộ sách" (bìa xếp chồng), nhóm theo Domain.
 * Ảnh trong Handbook là ảnh đính kèm của bài markdown → không tính là bài.
 */
import { memo, useMemo } from "react";
import { useHandbooks } from "@/lib/api/handbooks";
import { useDomains } from "@/lib/api/domains";
import type { DocumentRow } from "@/lib/api/documents";
import { BookCover } from "./BookCover";

export type HandbookStat = {
  id: string;
  name: string;
  domainId: string;
  /** Các bài đọc được (đã bỏ ảnh đính kèm), sắp theo đường dẫn */
  files: DocumentRow[];
  avgPct: number;
  /** Bài mở gần nhất, chưa mở bài nào thì bài đầu tiên */
  targetDocId: string | null;
};

export const isHandbookAsset = (d: DocumentRow) => !!d.handbookId && d.format === "image";

const byPath = (a: DocumentRow, b: DocumentRow) =>
  (a.relPath ?? a.title).localeCompare(b.relPath ?? b.title, "vi", { numeric: true });

export function useHandbookStats(docs: DocumentRow[], pctByDoc: Map<string, number | null>): HandbookStat[] | undefined {
  const handbooks = useHandbooks(undefined);
  return useMemo(() => {
    if (!handbooks) return undefined;
    const byHb = new Map<string, DocumentRow[]>();
    for (const d of docs) {
      if (!d.handbookId || isHandbookAsset(d)) continue;
      const arr = byHb.get(d.handbookId);
      if (arr) arr.push(d); else byHb.set(d.handbookId, [d]);
    }
    return handbooks
      .map((hb) => {
        const files = (byHb.get(hb._id) ?? []).sort(byPath);
        const avgPct = files.length
          ? Math.round((files.reduce((sum, f) => sum + (pctByDoc.get(f._id) ?? 0), 0) / files.length) * 100)
          : 0;
        const lastOpened = files.filter((f) => f.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0];
        return { id: hb._id, name: hb.name, domainId: hb.domainId, files, avgPct, targetDocId: (lastOpened ?? files[0])?._id ?? null };
      })
      .filter((s) => s.files.length > 0);
  }, [handbooks, docs, pctByDoc]);
}

/** Bìa "bộ sách": 2 bìa lót phía sau + bìa chính */
export function VolumeCover({ name, size = "sm", className = "" }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <div className={`relative pr-2 pt-2 ${className}`}>
      <div className="absolute right-0 top-0 h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-[4px_10px_10px_4px] bg-foreground/10" />
      <div className="absolute right-1 top-1 h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-[4px_10px_10px_4px] bg-foreground/15" />
      <BookCover title={name} format="handbook" size={size} className="relative transition-transform duration-300 ease-spring can-hover:group-hover:-translate-y-1" />
    </div>
  );
}

function VolumeCard({ hb, onOpen, wide }: { hb: HandbookStat; onOpen: (id: string) => void; wide: boolean }) {
  return (
    <button
      onClick={() => onOpen(hb.id)}
      className={`press group shrink-0 snap-start text-left animate-rise-in ${wide ? "w-full" : "w-[112px] sm:w-[128px]"}`}
    >
      <VolumeCover name={hb.name} size={wide ? "md" : "sm"} />
      <p className="mt-2 line-clamp-2 font-display text-[14px] font-semibold leading-snug text-foreground">{hb.name}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary/85" style={{ width: `${hb.avgPct}%` }} />
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">{hb.avgPct}%</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hb.files.length} bài</p>
    </button>
  );
}

/**
 * layout="row": mỗi Domain một kệ cuộn ngang (trang Tất cả).
 * layout="grid": lưới đầy đủ (tab Handbook).
 */
export const HandbookShelves = memo(function HandbookShelves({ stats, onOpen, layout }: {
  stats: HandbookStat[];
  onOpen: (handbookId: string) => void;
  layout: "row" | "grid";
}) {
  const domains = useDomains();
  const groups = useMemo(() => {
    const order = new Map((domains ?? []).map((d, i) => [d._id, i]));
    const names = new Map((domains ?? []).map((d) => [d._id, d.name]));
    const map = new Map<string, HandbookStat[]>();
    for (const s of stats) {
      const arr = map.get(s.domainId);
      if (arr) arr.push(s); else map.set(s.domainId, [s]);
    }
    return [...map.entries()]
      .sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999))
      .map(([id, items]) => ({ id, name: names.get(id) ?? "Handbook", items }));
  }, [stats, domains]);

  if (groups.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Chưa có Handbook nào. Tạo Domain và import ZIP từ sidebar.</p>;
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.id}>
          <div className="mb-3 flex items-baseline gap-3">
            <h3 className="font-display text-lg font-semibold text-foreground">{g.name}</h3>
            <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.items.length} bộ</span>
            <div className="h-px flex-1 bg-border/70" />
          </div>
          {layout === "row" ? (
            <div className="-mx-4 flex items-start snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 scrollbar-none md:-mx-6 md:px-6">
              {g.items.map((hb) => <VolumeCard key={hb.id} hb={hb} onOpen={onOpen} wide={false} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 items-start gap-x-5 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-7">
              {g.items.map((hb) => <VolumeCard key={hb.id} hb={hb} onOpen={onOpen} wide />)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
});
