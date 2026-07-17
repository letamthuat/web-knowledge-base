"use client";

// Tab Tổng quan — thực đơn hôm nay, lộ trình cây trạng thái, chỗ yếu, heatmap.
import { createContext, useCallback, useContext, useState } from "react";
import {
  AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronRight,
  HelpCircle, Layers, Mic, RotateCcw, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useTabSync } from "@/hooks/useTabSync";
import { useActiveTab } from "@/contexts/ActiveTabContext";
import { Id } from "@/_generated/dataModel";
import { markUnitRead, logStudySession } from "@/lib/api/study";
import { HEATMAP, type StudySpace, type StudyUnit, type TodayItem, type UnitStatus } from "./mock";

// spaceId cho các hành động ghi (đánh dấu đọc…) — tránh thread qua nhiều lớp
const SpaceIdCtx = createContext<string>("");

// Điều phối sang tab khác kèm ngữ cảnh (highlight đúng nội dung của tiểu mục)
export type GoTab = (tab: string, ctx?: { sectionId?: string; unitKey?: string }) => void;

// unit "m2-1-3" ↔ quiz section "q-2-1-3"
// unit "m2-1-3" → quiz section id "q-2-1-3" (QuizTab tự resolve về unitKey thật)
function quizSectionIdFor(unit: StudyUnit): string | undefined {
  if (!/^m\d+(-\d+)+$/.test(unit.id)) return undefined;
  return "q-" + unit.id.slice(1);
}

// unit "m2-1-3" → số tiểu mục "2.1.3" (khóa lọc card/phiên Feynman)
function unitKeyFor(unit: StudyUnit): string | undefined {
  if (!/^m\d+(-\d+)+$/.test(unit.id)) return undefined;
  return unit.id.slice(1).split("-").join(".");
}

// Click tiểu mục → mở tài liệu trong reader (bản thật sẽ scroll đúng heading x.y.z qua rehype-slug)
export function useOpenDoc() {
  const { openTab } = useTabSync();
  const { setActivePanel } = useActiveTab();
  return useCallback(
    (docId: string) => {
      openTab(docId as Id<"documents">).catch(() => {});
      setActivePanel(`reader:${docId}`);
      window.history.pushState(null, "", `/reader/${docId}`);
    },
    [openTab, setActivePanel]
  );
}

const STATUS: Record<UnitStatus, { label: string; dot: string; text: string }> = {
  new:      { label: "Chưa học",           dot: "bg-muted-foreground/30", text: "text-muted-foreground" },
  reading:  { label: "Đang học",           dot: "bg-blue-500",            text: "text-blue-500" },
  read:     { label: "Đã đọc — chưa vững", dot: "bg-amber-500",           text: "text-amber-500" },
  mastered: { label: "Vững",               dot: "bg-emerald-500",         text: "text-emerald-500" },
  decayed:  { label: "Cần học lại",        dot: "bg-red-500",             text: "text-red-500" },
};

// Từ 2xl các khối HÔM NAY / CẦN HỌC LẠI / heatmap chuyển sang side rail
// (StudyRail trong StudyPageInner) — cột chính chỉ còn lộ trình.
export function SpaceOverview({ space, onGoTab }: { space: StudySpace; onGoTab: GoTab }) {
  return (
    <SpaceIdCtx.Provider value={space.id}>
    <div className="space-y-5">
      <div className="2xl:hidden">
        <TodayMenu items={space.todayMenu} onGoTab={onGoTab} />
      </div>
      <Syllabus units={space.units} onGoTab={onGoTab} />
      {space.weakSpots.length > 0 && (
        <div className="2xl:hidden">
          <WeakSpots space={space} onGoTab={onGoTab} />
        </div>
      )}
      <div className="2xl:hidden">
        <Heatmap streak={space.streak} />
      </div>
    </div>
    </SpaceIdCtx.Provider>
  );
}

// ─── Thực đơn hôm nay ────────────────────────────────────────────────────────

const TODAY_ICON: Record<TodayItem["type"], typeof BookOpen> = {
  read: BookOpen,
  review: RotateCcw,
  quiz: CheckCircle2,
  fix: AlertTriangle,
};

const TODAY_TAB: Record<TodayItem["type"], string | null> = {
  read: null, // sẽ mở reader thật sau
  review: "review",
  quiz: "quiz",
  fix: "quiz",
};

export function TodayMenu({ items, onGoTab }: { items: TodayItem[]; onGoTab: GoTab }) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> HÔM NAY
      </h2>
      <div className="mt-2 space-y-2">
        {items.map((it, i) => {
          const Icon = TODAY_ICON[it.type];
          const target = TODAY_TAB[it.type];
          return (
            <button
              key={i}
              onClick={() => target && onGoTab(target, { sectionId: it.quizSectionId })}
              className={`flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm ${
                it.type === "fix" ? "border-red-500/30" : ""
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  it.type === "fix" ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{it.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{it.detail}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Lộ trình (syllabus cây) ─────────────────────────────────────────────────

function Syllabus({ units, onGoTab }: { units: StudyUnit[]; onGoTab: GoTab }) {
  return (
    <section>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <Layers className="h-3.5 w-3.5 text-primary" /> LỘ TRÌNH
        </h2>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {(Object.keys(STATUS) as UnitStatus[]).map((k) => (
            <span key={k} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${STATUS[k].dot}`} /> {STATUS[k].label}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        {units.map((u) =>
          u.children ? <ModuleNode key={u.id} unit={u} depth={0} onGoTab={onGoTab} /> : <UnitRow key={u.id} unit={u} depth={0} onGoTab={onGoTab} />
        )}
      </div>
    </section>
  );
}

// Đếm đệ quy: tiểu mục lá đã Vững / tổng số lá
function countLeaves(unit: StudyUnit): { total: number; mastered: number } {
  if (!unit.children) return { total: 1, mastered: unit.status === "mastered" ? 1 : 0 };
  return unit.children.reduce(
    (acc, c) => {
      const r = countLeaves(c);
      return { total: acc.total + r.total, mastered: acc.mastered + r.mastered };
    },
    { total: 0, mastered: 0 }
  );
}

function hasDecayedDeep(unit: StudyUnit): boolean {
  if (unit.status === "decayed") return true;
  return unit.children?.some(hasDecayedDeep) ?? false;
}

// Node đệ quy: file handbook → mục (x.y) → tiểu mục (x.y.z = đơn vị ôn 1 lần)
function ModuleNode({ unit, depth, onGoTab }: { unit: StudyUnit; depth: number; onGoTab: GoTab }) {
  const [open, setOpen] = useState(unit.status === "reading" || hasDecayedDeep(unit));
  const { total, mastered } = countLeaves(unit);
  // Trạm tổng kết chỉ đặt ở node mà con là tiểu mục lá (cuối một mục x.y)
  const leafParent = unit.children!.every((c) => !c.children);
  return (
    <div className={depth === 0 ? "rounded-xl border bg-card" : "rounded-lg border border-border/50"}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 p-3 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS[unit.status].dot}`} />
        <span className={`min-w-0 flex-1 truncate ${depth === 0 ? "text-[13.5px] font-semibold" : "text-[13px] font-medium"}`}>
          {unit.title}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{mastered}/{total} vững</span>
      </button>
      {open && (
        <div className="space-y-1 border-t px-2 py-1.5">
          {unit.children!.map((c) =>
            c.children ? <ModuleNode key={c.id} unit={c} depth={depth + 1} onGoTab={onGoTab} /> : <UnitRow key={c.id} unit={c} depth={depth + 1} onGoTab={onGoTab} />
          )}
          {leafParent && (
            <div className="mx-1 mt-1 flex items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-2.5 py-2">
              <Mic className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="flex-1 text-[12px] text-muted-foreground">
                Trạm tổng kết: quiz xuyên tiểu mục + giảng cả mục 5 phút
              </span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                mở khi đủ 🟢
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Checklist 4 việc của một tiểu mục ───────────────────────────────────────
// Đọc bài → Quiz ≥ 80% → Tạo flashcard → Giảng lại (Feynman). Đủ 4 = Vững 🟢.

type ChecklistItem = {
  key: string;
  icon: typeof BookOpen;
  label: string;
  detail: string;
  done: boolean;
  actionLabel: string;
  action: () => void;
};

function UnitRow({ unit, depth, onGoTab }: { unit: StudyUnit; depth: number; onGoTab: GoTab }) {
  const st = STATUS[unit.status];
  const openDoc = useOpenDoc();
  const spaceId = useContext(SpaceIdCtx);
  const [open, setOpen] = useState(false);

  const goRead = () => {
    if (!unit.docId) { toast.info("Tiểu mục này chưa gắn tài liệu"); return; }
    openDoc(unit.docId);
    // Mở ra = coi như đã đọc (rule "không khóa"); ghi tiến độ + phiên đọc (không tính streak)
    const uk = unitKeyFor(unit);
    if (spaceId && uk) {
      void markUnitRead(spaceId, uk).catch(() => {});
      void logStudySession({ spaceId, activityType: "read", unitKey: uk, activeMinutes: 3 }).catch(() => {});
    }
  };

  const items: ChecklistItem[] = [
    {
      key: "read",
      icon: BookOpen,
      label: "Đọc bài",
      detail: unit.readPct >= 100 ? "đã đọc xong" : unit.readPct > 0 ? `đang ở ${unit.readPct}%` : "chưa bắt đầu",
      done: unit.readPct >= 100,
      actionLabel: unit.readPct >= 100 ? "Đọc lại" : unit.readPct > 0 ? "Đọc tiếp" : "Đọc",
      action: goRead,
    },
    {
      key: "quiz",
      icon: HelpCircle,
      label: "Quiz ≥ 80%",
      detail: unit.quizBest !== undefined ? `tốt nhất ${unit.quizBest}%` : "chưa làm lần nào",
      done: (unit.quizBest ?? 0) >= 80,
      actionLabel: unit.quizBest !== undefined ? "Làm lại" : "Làm quiz",
      action: () => onGoTab("quiz", { sectionId: quizSectionIdFor(unit) }),
    },
    {
      key: "cards",
      icon: Layers,
      label: "Tạo flashcard",
      detail: unit.cardsMade ? "đã có bộ card (ôn theo lịch riêng)" : "chưa tạo",
      done: !!unit.cardsMade,
      actionLabel: unit.cardsMade ? "Xem card" : "Tạo card",
      action: () => onGoTab("review", { unitKey: unitKeyFor(unit) }),
    },
    {
      key: "feynman",
      icon: Mic,
      label: "Giảng lại (Feynman)",
      detail: unit.feynmanCount > 0 ? `${unit.feynmanCount} phiên đã giảng` : "chưa giảng lần nào",
      done: unit.feynmanCount > 0,
      actionLabel: unit.feynmanCount > 0 ? "Giảng thêm" : "Giảng",
      action: () => onGoTab("feynman", { unitKey: unitKeyFor(unit) }),
    },
  ];
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className={`rounded-lg transition-colors ${depth === 0 ? "border bg-card" : ""} ${open ? "bg-muted/40" : ""}`}>
      <button
        onClick={() => setOpen(!open)}
        title="Xem checklist của tiểu mục"
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
        <span className="min-w-0 flex-1 truncate text-[13px]">{unit.title}</span>

        {/* 4 icon mini = trạng thái checklist nhìn nhanh; mobile hẹp chỉ giữ đếm 0/4 */}
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          {items.map(({ key, icon: Icon, done }) => (
            <Icon key={key} className={`h-3.5 w-3.5 ${done ? "text-emerald-500" : "text-muted-foreground/30"}`} />
          ))}
        </span>
        <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">{doneCount}/4</span>
        <span className={`hidden shrink-0 text-[10.5px] sm:inline ${st.text}`}>{st.label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-1 px-2.5 pb-2.5 pt-0.5">
          {unit.status === "decayed" && (
            <p className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1.5 text-[11.5px] text-red-500">
              <AlertTriangle className="h-3 w-3 shrink-0" /> Từng hoàn thành nhưng đã lâu không ôn — làm lại quiz để xanh trở lại
            </p>
          )}
          {items.map(({ key, icon: Icon, label, detail, done, actionLabel, action }) => (
            <button
              key={key}
              type="button"
              onClick={action}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-background"
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
              )}
              <Icon className={`h-3.5 w-3.5 shrink-0 ${done ? "text-emerald-600" : "text-muted-foreground"}`} />
              <span className={`min-w-0 flex-1 truncate text-[12.5px] ${done ? "text-muted-foreground line-through decoration-muted-foreground/40" : ""}`}>
                {label} <span className="text-[11px] text-muted-foreground/80">· {detail}</span>
              </span>
              <span className="shrink-0 rounded-md border bg-background px-2 py-1 text-[11px] font-medium text-primary">
                {actionLabel} →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chỗ yếu ─────────────────────────────────────────────────────────────────

export function WeakSpots({ space, onGoTab }: { space: StudySpace; onGoTab: GoTab }) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> CẦN HỌC LẠI
      </h2>
      <div className="mt-2 space-y-2">
        {space.weakSpots.map((w) => {
          // "2.1.3 Phân loại…" → quiz section "q-2-1-3" (học lại = làm lại quiz theo rule 🔴)
          const key = w.label.match(/^\d+(\.\d+)+/)?.[0];
          const sid = key ? "q-" + key.split(".").join("-") : undefined;
          return (
            <div key={w.id} className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/5 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{w.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{w.reason}</p>
              </div>
              <button
                onClick={() => onGoTab("quiz", { sectionId: sid ?? undefined })}
                className="shrink-0 rounded-lg border bg-background px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted"
              >
                Học lại
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Heatmap + streak ────────────────────────────────────────────────────────

const HEAT_COLORS = [
  "bg-muted",
  "bg-emerald-500/25",
  "bg-emerald-500/45",
  "bg-emerald-500/70",
  "bg-emerald-500",
];

export function Heatmap({ streak }: { streak: number }) {
  return (
    <section>
      <h2 className="text-[13px] font-semibold text-muted-foreground">HOẠT ĐỘNG 12 TUẦN</h2>
      <div className="mt-2 rounded-xl border bg-card p-3">
        <div className="grid grid-flow-col grid-rows-7 gap-[3px] overflow-x-auto">
          {HEATMAP.map((v, i) => (
            <div key={i} className={`h-3 w-3 rounded-[3px] ${HEAT_COLORS[v]}`} />
          ))}
        </div>
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          🔥 Chuỗi <b className="text-foreground">{streak} ngày</b> học chủ động — chỉ tính khi ôn card, làm quiz hoặc
          Feynman (mở ra đọc không tính).
        </p>
      </div>
    </section>
  );
}
