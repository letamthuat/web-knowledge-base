"use client";

/**
 * Module Học tập — UI PROTOTYPE chạy trên seed data (mock.ts).
 * Sau khi chốt giao diện sẽ viết spec chi tiết rồi mới nối Supabase.
 */
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Flame, GraduationCap, Layers3, Loader2, Menu, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLogo } from "@/components/AppLogo";
import { MobileSidebarDrawer } from "@/components/nav/MobileSidebarDrawer";
import type { StudySpace } from "./mock";
import { useStudyData, buildAllSpaceModels } from "@/lib/study/spaceModel";
import { removeStudySpace } from "@/lib/api/study";
import { Heatmap, SpaceOverview, TodayMenu, WeakSpots, type GoTab } from "./SpaceOverview";
import { ReviewTab } from "./ReviewTab";
import { QuizTab } from "./QuizTab";
import { FeynmanTab } from "./FeynmanTab";
import { PlanTab } from "./PlanTab";
import { CreateSpaceModal } from "./CreateSpaceModal";

type TabKey = "overview" | "plan" | "review" | "quiz" | "feynman";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Tổng quan" },
  { key: "plan", label: "Kế hoạch" },
  { key: "review", label: "Ôn tập" },
  { key: "quiz", label: "Kiểm tra" },
  { key: "feynman", label: "Feynman" },
];

// URL ↔ state: /study · /study/:spaceId (Tổng quan) · /study/:spaceId/:tab
// spaceId nhận thô từ URL; tính hợp lệ resolve ở component (khớp model đã load).
function parseStudyPath(path: string): { spaceId: string | null; tab: TabKey } {
  const m = path.match(/^\/study(?:\/([^/]+))?(?:\/([^/]+))?/);
  const sid = m?.[1] ?? null;
  const raw = m?.[2] ?? "overview";
  const tab = TABS.some((t) => t.key === raw) ? (raw as TabKey) : "overview";
  return { spaceId: sid, tab };
}

function studyPath(spaceId: string | null, tab: TabKey): string {
  if (!spaceId) return "/study";
  return tab === "overview" ? `/study/${spaceId}` : `/study/${spaceId}/${tab}`;
}

export function StudyPageInner() {
  const pathname = usePathname() ?? "/study";
  const data = useStudyData();
  const models = useMemo(
    () => buildAllSpaceModels(data),
    [data.spaces, data.units, data.cards, data.attempts, data.feyn, data.sessions, data.plans, data.planTasks],
  );
  const initial = parseStudyPath(pathname);
  const [spaceId, setSpaceId] = useState<string | null>(initial.spaceId);
  const [tab, setTab] = useState<TabKey>(initial.tab);
  // Điều phối có ngữ cảnh: sang tab nào thì biết highlight nội dung của tiểu mục nào
  const [focusCtx, setFocusCtx] = useState<{ sectionId?: string; unitKey?: string } | null>(null);
  const [navOpen, setNavOpen] = useState(false); // drawer điều hướng mobile
  const [wizardOpen, setWizardOpen] = useState(false);

  // Điều hướng nội bộ = đổi state + đẩy URL tương ứng (share/bookmark/back được)
  const navigate = (sid: string | null, t: TabKey, ctx?: { sectionId?: string; unitKey?: string }) => {
    setSpaceId(sid);
    setTab(t);
    setFocusCtx(ctx ?? null);
    const url = studyPath(sid, t);
    if (window.location.pathname !== url) window.history.pushState(null, "", url);
  };

  // URL đổi từ bên ngoài (back/forward, sidebar bấm "Học tập", deep-link) → state theo URL.
  // Sau navigate() của chính mình thì parse ra đúng giá trị hiện tại → no-op.
  useEffect(() => {
    if (!pathname.startsWith("/study")) return; // panel giữ mounted khi sang reader — không reset
    const p = parseStudyPath(pathname);
    setSpaceId(p.spaceId);
    setTab(p.tab);
  }, [pathname]);

  const goTab = (k: string, ctx?: { sectionId?: string; unitKey?: string }) => {
    navigate(spaceId, k as TabKey, ctx);
  };

  const space = models.find((s) => s.id === spaceId) ?? null;
  const loadingSpace = spaceId !== null && space === null && data.loading;

  return (
    // 1 cột (mobile PWA + laptop); từ 2xl nới container — cả danh sách lẫn màn trong cùng độ rộng
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-4 pb-20 pt-4 xl:pb-6 2xl:max-w-[1400px]">
      {/* Thanh trên cùng chỉ cho mobile — nút ☰ mở sidebar (đồng bộ desktop) */}
      <header className="mb-2 flex shrink-0 items-center gap-2 xl:hidden" style={{ paddingTop: "var(--safe-top)" }}>
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Mở menu"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <AppLogo size={28} />
        <span className="font-semibold">Học tập</span>
      </header>
      <MobileSidebarDrawer open={navOpen} onClose={() => setNavOpen(false)} />
      {wizardOpen && (
        <CreateSpaceModal
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => {
            setWizardOpen(false);
            navigate(id, "overview");
          }}
        />
      )}

      {space === null ? (
        loadingSpace ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang mở không gian học…
          </div>
        ) : (
          <SpaceList models={models} loading={data.loading} onOpen={(id) => navigate(id, "overview")} onCreate={() => setWizardOpen(true)} />
        )
      ) : (
        <>
          {/* Header space */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => navigate(null, "overview")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Về danh sách không gian học"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-xl">{space.emoji}</span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold leading-tight">{space.name}</h1>
              <p className="truncate text-[11px] text-muted-foreground">{space.sourceLabel}</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-500">
              <Flame className="h-3.5 w-3.5" /> {space.streak} ngày
            </div>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 flex-col 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-rows-[minmax(0,1fr)] 2xl:gap-6">
            {/* Cột chính: tabs + nội dung */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 gap-1 rounded-xl bg-muted/60 p-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => navigate(spaceId, t.key)}
                    className={`flex-1 truncate rounded-lg px-0.5 py-1.5 text-[12px] font-medium transition-colors sm:text-[13px] ${
                      tab === t.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                    {t.key === "review" && space.dueCards > 0 && (
                      <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {space.dueCards}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex-1 overflow-y-auto">
                {tab === "overview" && <SpaceOverview space={space} onGoTab={goTab} />}
                {tab === "plan" && <PlanTab key={space.id} spaceId={space.id} space={space} onGoTab={goTab} />}
                {tab === "review" && <ReviewTab spaceId={space.id} space={space} focusUnitKey={focusCtx?.unitKey} />}
                {tab === "quiz" && <QuizTab spaceId={space.id} space={space} focusSectionId={focusCtx?.sectionId} onGoTab={goTab} />}
                {tab === "feynman" && <FeynmanTab spaceId={space.id} space={space} focusUnitKey={focusCtx?.unitKey} />}
              </div>
            </div>

            <StudyRail space={space} onGoTab={goTab} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Side rail (≥2xl) ─────────────────────────────────────────────────────────
// Việc-cần-làm + chỗ yếu + streak luôn trong tầm mắt ở mọi tab; dưới 2xl các
// khối này nằm trong tab Tổng quan (SpaceOverview tự hiện lại).

function StudyRail({ space, onGoTab }: { space: StudySpace; onGoTab: GoTab }) {
  return (
    <aside className="hidden min-h-0 flex-col gap-5 overflow-y-auto pb-2 2xl:flex">
      <TodayMenu items={space.todayMenu} onGoTab={onGoTab} spaceId={space.id} />
      {space.weakSpots.length > 0 && <WeakSpots space={space} onGoTab={onGoTab} />}
      <Heatmap streak={space.streak} data={space.heatmap} />
    </aside>
  );
}

// ─── Danh sách Space ──────────────────────────────────────────────────────────

function SpaceList({ models, loading, onOpen, onCreate }: {
  models: StudySpace[]; loading: boolean; onOpen: (id: string) => void; onCreate: () => void;
}) {
  // Chỉ số gộp toàn bộ không gian học — cho cảm giác "bàn làm việc" ngay khi vào
  const totalDue = models.reduce((s, x) => s + x.dueCards, 0);
  const minutesToday = models.reduce((s, x) => s + x.minutesToday, 0);
  const bestStreak = models.length ? Math.max(...models.map((s) => s.streak)) : 0;
  const mastered = models.reduce((s, x) => s + x.unitsMastered, 0);
  const totalUnits = models.reduce((s, x) => s + x.unitsTotal, 0);

  return (
    <div className="overflow-y-auto">
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <GraduationCap className="h-6 w-6 text-primary" /> Học tập
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
            Mỗi không gian học gắn với một handbook hoặc vài tài liệu lẻ — kế hoạch, quiz, flashcard, Feynman và tiến độ gom về một chỗ.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Không gian học
        </button>
      </div>

      {/* Stat tiles — số dùng token chữ, icon mang màu ngữ nghĩa */}
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile icon={Flame} iconCls="bg-orange-500/10 text-orange-500" value={`${bestStreak} ngày`} label="Chuỗi học chủ động" />
        <StatTile icon={RotateCcw} iconCls="bg-primary/10 text-primary" value={`${totalDue} card`} label="Đến hạn ôn hôm nay" />
        <StatTile icon={Clock} iconCls="bg-blue-500/10 text-blue-500" value={`${minutesToday} phút`} label="Đã học hôm nay" />
        <StatTile icon={CheckCircle2} iconCls="bg-emerald-500/10 text-emerald-600" value={`${mastered}/${totalUnits}`} label="Tiểu mục đã vững" />
      </div>

      {/* Grid không gian học */}
      {loading ? (
        <div className="mt-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải…
        </div>
      ) : models.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-[14px] font-medium">Chưa có không gian học nào</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Tạo không gian học đầu tiên từ một handbook để bắt đầu lộ trình.</p>
          <button onClick={onCreate} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Không gian học
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {models.map((s) => (
            <SpaceCard key={s.id} space={s} onOpen={() => onOpen(s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, iconCls, value, label }: {
  icon: typeof Flame; iconCls: string; value: string; label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconCls}`}>
        <Icon style={{ width: 18, height: 18 }} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[16px] font-bold leading-tight tabular-nums">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SpaceCard({ space, onOpen }: { space: StudySpace; onOpen: () => void }) {
  const pct = space.unitsTotal > 0 ? Math.round((space.unitsMastered / space.unitsTotal) * 100) : 0;
  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Xoá không gian học "${space.name}"?\n\nTiến độ học (quiz, card, Feynman) sẽ mất. Handbook/tài liệu gốc KHÔNG bị xoá.`)) return;
    try {
      await removeStudySpace(space.id);
      toast.success("Đã xoá không gian học");
    } catch {
      toast.error("Xoá thất bại — thử lại");
    }
  }
  return (
    <div className="group relative">
      <button
        onClick={handleDelete}
        aria-label="Xoá không gian học"
        className="absolute right-2 top-2 z-10 hidden h-7 w-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:flex"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onOpen}
        className="flex w-full flex-col rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
          {space.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold group-hover:text-primary">{space.name}</h2>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <Layers3 className="h-3 w-3 shrink-0" /> {space.sourceLabel}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-500">
          <Flame className="h-3 w-3" /> {space.streak}
        </div>
      </div>

      <div className="mt-3.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{space.unitsMastered}/{space.unitsTotal} tiểu mục vững</span>
          <span className="font-semibold tabular-nums text-foreground">{pct}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px]">
        {space.dueCards > 0 ? (
          <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">
            {space.dueCards} card đến hạn
          </span>
        ) : (
          <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">Đã ôn hết hôm nay</span>
        )}
        {space.minutesToday > 0 && (
          <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
            Hôm nay {space.minutesToday} phút
          </span>
        )}
        <span className="ml-auto font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Vào học →
        </span>
      </div>
      </button>
    </div>
  );
}
