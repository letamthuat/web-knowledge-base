"use client";
// Module Podcast — /podcast (danh sách series) · /podcast/:seriesId (các tập).
// Keep-alive trong AppShell như Học tập; URL ↔ màn hình đồng bộ qua usePathname.
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Plus, Loader2, Podcast, Headphones } from "lucide-react";
import { openNavDrawer } from "@/lib/navDrawer";
import { AppLogo } from "@/components/AppLogo";
import { useActiveTab } from "@/contexts/ActiveTabContext";
import { usePodcastSeries, usePodcastSeriesOne, usePodcastEpisodes, type PodcastSeriesRow, type PodcastEpisodeRow } from "@/lib/api/podcast";
import { CreateSeriesModal } from "./CreateSeriesModal";
import { SeriesDetail } from "./SeriesDetail";

export function PodcastPageInner() {
  const pathname = usePathname() ?? "/podcast";
  const seriesId = pathname.match(/^\/podcast\/([^/]+)/)?.[1] ?? null;
  const { navigate } = useActiveTab();
  const [creating, setCreating] = useState(false);
  const series = usePodcastSeriesOne(seriesId);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 pb-[calc(1rem+var(--safe-bottom))] pt-4">
      <header className="mb-2 flex shrink-0 items-center gap-2 lg:hidden" style={{ paddingTop: "var(--safe-top)" }}>
        <button onClick={() => openNavDrawer()} aria-label="Mở menu"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Menu className="h-5 w-5" />
        </button>
        <AppLogo size={28} />
        <span className="font-semibold">Podcast</span>
      </header>

      {creating && (
        <CreateSeriesModal
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); navigate(`/podcast/${id}`); }}
        />
      )}

      {seriesId ? (
        series === undefined ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang mở series…</div>
        ) : series === null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            Không tìm thấy series.
            <button onClick={() => navigate("/podcast")} className="rounded-lg border px-3 py-1.5 hover:bg-muted">Về danh sách</button>
          </div>
        ) : (
          <SeriesDetail series={series} onBack={() => navigate("/podcast")} />
        )
      ) : (
        <SeriesList onOpen={(id) => navigate(`/podcast/${id}`)} onCreate={() => setCreating(true)} />
      )}
    </div>
  );
}

function SeriesList({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) {
  const series = usePodcastSeries();
  const episodes = usePodcastEpisodes(null);
  const bySeries = useMemo(() => {
    const m = new Map<string, PodcastEpisodeRow[]>();
    for (const e of episodes ?? []) m.set(e.seriesId, [...(m.get(e.seriesId) ?? []), e]);
    return m;
  }, [episodes]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><Podcast className="h-6 w-6 text-primary" /> Podcast</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Biến handbook thành chuỗi tập nghe 2 giọng — đủ sâu để học, không chỉ tóm tắt.</p>
        </div>
        <button onClick={onCreate} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Series mới
        </button>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-28">
        {series === undefined ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải…</div>
        ) : series.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {series.map((s) => <SeriesCard key={s._id} s={s} eps={bySeries.get(s._id) ?? []} onOpen={() => onOpen(s._id)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function SeriesCard({ s, eps, onOpen }: { s: PodcastSeriesRow; eps: PodcastEpisodeRow[]; onOpen: () => void }) {
  const done = eps.filter((e) => e.completedAt).length;
  const pct = eps.length ? Math.round((done / eps.length) * 100) : 0;
  const next = eps.find((e) => !e.completedAt);
  return (
    <button onClick={onOpen} className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left transition-colors hover:border-primary/40">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-2xl">{s.emoji ?? "🎙️"}</span>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug group-hover:text-primary">{s.title}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{eps.length} tập · {s.sourceType === "handbook" ? "Handbook" : "Tài liệu lẻ"}</p>
        </div>
      </div>
      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.max(pct, done ? 3 : 0)}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Đã nghe {done}/{eps.length}</span>
          {next && <span className="flex min-w-0 items-center gap-1 truncate text-primary"><Headphones className="h-3 w-3 shrink-0" /> <span className="truncate">Tiếp: {next.title}</span></span>}
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">🎧</span>
      <div className="font-display text-lg font-semibold">Lười đọc? Nghe thôi.</div>
      <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        Chọn một handbook hoặc tài liệu — app chia thành các tập theo từng mục, My và Minh trò chuyện giải thích kỹ từng ý, có câu hỏi nhớ sau mỗi tập.
      </p>
      <button onClick={onCreate} className="mt-1 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90">
        <Plus className="h-4 w-4" /> Tạo series đầu tiên
      </button>
    </div>
  );
}
