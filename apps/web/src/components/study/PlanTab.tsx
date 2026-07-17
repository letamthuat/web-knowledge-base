"use client";

// Tab Kế hoạch — wizard đánh giá khối lượng → chốt nhịp học → LƯU SNAPSHOT vào DB.
// Rule local (plan.ts), 0 call Gemini. Done-state suy TỪ HÀNH ĐỘNG THẬT (không tick tay).
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Bell, CalendarDays, CheckCircle2, Loader2, Minus, Plus, RefreshCw,
  SlidersHorizontal, Sparkles, X,
} from "lucide-react";
import { toast } from "sonner";
import type { StudySpace, StudyUnit } from "./mock";
import { useOpenDoc, type GoTab } from "./SpaceOverview";
import {
  useActivePlan, usePlanTasks, useNotificationSettings, createPlan, upsertNotificationSettings,
  type StudyPlanTaskRow, type NewPlanTask, type ScheduleMode,
} from "@/lib/api/study";
import { enablePush, disablePush, pushSupported } from "@/lib/push";
import {
  ACT_MIN, buildModuleLoads, buildSchedule, buildScheduleTracks, dailyMinutesFor, fmtDate, fmtHours,
  projectedEndDate, recommendDays, WEEKDAY_LABELS,
  type PlanDay, type PlanTask, type PlanTaskType,
} from "./plan";

const TASK_DOT: Record<PlanTaskType, string> = {
  read: "bg-blue-500", quiz: "bg-amber-500", cards: "bg-violet-500",
  feynman: "bg-emerald-500", review: "bg-muted-foreground/40", station: "bg-primary",
};
const TASK_LEGEND: { type: PlanTaskType; label: string }[] = [
  { type: "read", label: "Đọc" }, { type: "quiz", label: "Quiz" }, { type: "cards", label: "Flashcard" },
  { type: "feynman", label: "Giảng" }, { type: "station", label: "Trạm" },
];

// signals thật per tiểu mục (suy done-state)
type Sig = { readPct: number; quizBest?: number; cardsMade: boolean; feynmanCount: number };
function unitKeyOfId(id: string): string {
  return /^m\d+$/.test(id) ? "M" + id.slice(1) : id.slice(1).split("-").join(".");
}
function buildSignals(units: StudyUnit[]): Map<string, Sig> {
  const map = new Map<string, Sig>();
  const walk = (u: StudyUnit) => {
    if (u.children && u.children.length) u.children.forEach(walk);
    else map.set(unitKeyOfId(u.id), { readPct: u.readPct, quizBest: u.quizBest, cardsMade: !!u.cardsMade, feynmanCount: u.feynmanCount });
  };
  units.forEach(walk);
  return map;
}
function startOfDayMs(d: Date): number { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }

export function PlanTab({ spaceId, space, onGoTab }: { spaceId: string; space: StudySpace; onGoTab: GoTab }) {
  const activePlan = useActivePlan(spaceId);
  const planTasks = usePlanTasks(activePlan?._id ?? null);
  const notifSettings = useNotificationSettings();
  const loads = useMemo(() => buildModuleLoads(space), [space]);
  const signals = useMemo(() => buildSignals(space.units), [space.units]);
  const openDoc = useOpenDoc();

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Set<string>>(() => new Set(loads.filter((l) => l.defaultOn).map((l) => l.id)));
  const [mode, setMode] = useState<ScheduleMode>("sequential");
  const [daysOverride, setDaysOverride] = useState<number | null>(null);
  const [weekdays, setWeekdays] = useState<boolean[]>(() => Array(7).fill(true));
  const [assign, setAssign] = useState<Record<string, boolean[]>>({}); // mode tracks: moduleId → [T2..CN]
  const [trackDaily, setTrackDaily] = useState(60);
  const [notifOn, setNotifOn] = useState(true);
  const [notifTimes, setNotifTimes] = useState<string[]>(["08:45", "21:15"]);

  useEffect(() => {
    if (notifSettings) { setNotifOn(notifSettings.enabled); if (notifSettings.times?.length) setNotifTimes(notifSettings.times); }
  }, [notifSettings]);

  // Seed wizard theo plan đang active (để "Điều chỉnh" hiện đúng cấu hình cũ)
  useEffect(() => {
    if (!activePlan) return;
    setMode(activePlan.scheduleMode);
    setSel(new Set(activePlan.selectedModuleKeys));
    if (activePlan.scheduleMode === "tracks") {
      if (activePlan.trackAssignments) setAssign(activePlan.trackAssignments);
      if (activePlan.targetDailyMin) setTrackDaily(activePlan.targetDailyMin);
    } else if (activePlan.weekdays?.length === 7) {
      setWeekdays(activePlan.weekdays);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlan?._id]);

  async function toggleNotif() {
    if (!notifOn) {
      try {
        await enablePush();
        setNotifOn(true);
        await upsertNotificationSettings({ enabled: true, times: notifTimes });
        toast.success("Đã bật nhắc học trên thiết bị này");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không bật được thông báo");
      }
    } else {
      await disablePush().catch(() => {});
      setNotifOn(false);
      await upsertNotificationSettings({ enabled: false }).catch(() => {});
    }
  }

  const active = loads.filter((l) => sel.has(l.id));
  const totalMin = active.reduce((s, l) => s + l.minutes, 0);
  const unitCount = active.reduce((s, l) => s + l.unitCount, 0);
  const recDays = recommendDays(totalMin);
  const days = Math.max(1, daysOverride ?? recDays);
  const perDay = totalMin ? dailyMinutesFor(totalMin, days) : 0;
  const endDate = totalMin ? projectedEndDate(days, weekdays) : null;
  const moduleTasksMap = useMemo(() => Object.fromEntries(active.map((l) => [l.id, l.tasks])), [active]);

  // Đảm bảo module đã chọn có dòng gán thứ (mặc định cả tuần) khi vào mode Theo luồng
  useEffect(() => {
    if (mode !== "tracks") return;
    setAssign((prev) => {
      const n = { ...prev };
      for (const l of active) if (!n[l.id]) n[l.id] = Array(7).fill(true);
      return n;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sel]);

  const toggleModule = (id: string) => setSel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleWeekday = (i: number) => setWeekdays((prev) => prev.map((v, j) => (j === i ? !v : v)));
  const toggleAssign = (id: string, i: number) => setAssign((prev) => ({ ...prev, [id]: (prev[id] ?? Array(7).fill(false)).map((v, j) => (j === i ? !v : v)) }));

  // Preview mode Theo luồng (mô phỏng bằng rule) → số buổi + ngày xong
  const tracksPreview = useMemo(
    () => (mode === "tracks" ? buildScheduleTracks(moduleTasksMap, assign, active.map((l) => l.id), trackDaily) : []),
    [mode, moduleTasksMap, assign, active, trackDaily],
  );
  const tracksUnassigned = mode === "tracks" && active.some((l) => !(assign[l.id] ?? []).some(Boolean));

  // done-state suy từ signals thật
  const isTaskDone = (t: PlanTask): boolean => {
    if (!t.unitKey) return false;
    const s = signals.get(t.unitKey);
    if (!s) return false;
    switch (t.type) {
      case "read": return s.readPct >= 100;
      case "quiz": return (s.quizBest ?? 0) >= 80;
      case "cards": return s.cardsMade;
      case "feynman": return s.feynmanCount > 0;
      default: return false;
    }
  };

  const openTask = (t: PlanTask) => {
    switch (t.type) {
      case "read": if (t.docId) openDoc(t.docId); else toast.info("Tiểu mục chưa gắn tài liệu"); return;
      case "quiz": onGoTab("quiz", { sectionId: t.unitKey ? "q-" + t.unitKey.split(".").join("-") : undefined }); return;
      case "cards": onGoTab("review", { unitKey: t.unitKey }); return;
      case "feynman": onGoTab("feynman", { unitKey: t.unitKey }); return;
      case "review": onGoTab("review"); return;
      case "station": toast.info("Trạm tổng kết mở khi các tiểu mục trong mục đủ 🟢"); return;
    }
  };

  async function savePlan(cfg: {
    scheduleMode: ScheduleMode; selectedModuleKeys: string[]; moduleOrder: string[];
    weekdays: boolean[]; trackAssignments?: Record<string, boolean[]>; targetDailyMin: number; totalMin: number; localDays: PlanDay[];
  }) {
    const tasks: NewPlanTask[] = [];
    cfg.localDays.forEach((day) => {
      const dayDate = startOfDayMs(day.date);
      day.tasks.filter((t) => t.type !== "review").forEach((t, seq) =>
        tasks.push({ dayDate, seq, type: t.type, unitKey: t.unitKey, docId: t.docId, minutes: t.minutes, label: t.label }),
      );
    });
    const startDate = cfg.localDays.length ? startOfDayMs(cfg.localDays[0].date) : startOfDayMs(new Date());
    const endTs = cfg.localDays.length ? startOfDayMs(cfg.localDays[cfg.localDays.length - 1].date) : startDate;
    await createPlan({
      spaceId, scheduleMode: cfg.scheduleMode,
      selectedModuleKeys: cfg.selectedModuleKeys, moduleOrder: cfg.moduleOrder,
      weekdays: cfg.weekdays, trackAssignments: cfg.trackAssignments,
      targetDailyMin: cfg.targetDailyMin, totalMin: cfg.totalMin,
      startDate, projectedEndDate: endTs, tasks,
    });
    await upsertNotificationSettings({ enabled: notifOn, times: notifTimes }).catch(() => {});
  }

  async function generate() {
    setBusy(true);
    try {
      if (mode === "tracks") {
        const unionWd = Array.from({ length: 7 }, (_, i) => active.some((l) => assign[l.id]?.[i]));
        await savePlan({
          scheduleMode: "tracks", selectedModuleKeys: active.map((l) => l.id), moduleOrder: active.map((l) => l.id),
          weekdays: unionWd, trackAssignments: Object.fromEntries(active.map((l) => [l.id, assign[l.id] ?? Array(7).fill(false)])),
          targetDailyMin: trackDaily, totalMin, localDays: buildScheduleTracks(moduleTasksMap, assign, active.map((l) => l.id), trackDaily),
        });
      } else {
        await savePlan({
          scheduleMode: "sequential", selectedModuleKeys: active.map((l) => l.id), moduleOrder: active.map((l) => l.id),
          weekdays, targetDailyMin: perDay, totalMin, localDays: buildSchedule(active.flatMap((l) => l.tasks), perDay, weekdays),
        });
      }
      toast.success("Đã lưu kế hoạch chi tiết");
      setEditing(false);
    } catch { toast.error("Tạo kế hoạch thất bại"); }
    setBusy(false);
  }

  // Gom task còn lại theo module (mode tracks) — dùng unitKey prefix; task không có unitKey theo module trước đó
  function groupRemaining(remaining: PlanTask[], order: string[]): Record<string, PlanTask[]> {
    const map: Record<string, PlanTask[]> = Object.fromEntries(order.map((m) => [m, [] as PlanTask[]]));
    let lastMod = order[0];
    for (const t of remaining) {
      const mod = t.unitKey ? "m" + t.unitKey.split(".")[0] : lastMod;
      const key = map[mod] ? mod : lastMod;
      lastMod = key;
      (map[key] ?? (map[key] = [])).push(t);
    }
    return map;
  }

  async function reschedule(remaining: PlanTask[]) {
    setBusy(true);
    try {
      const ap = activePlan;
      if (ap?.scheduleMode === "tracks") {
        const order = ap.moduleOrder;
        await savePlan({
          scheduleMode: "tracks", selectedModuleKeys: ap.selectedModuleKeys, moduleOrder: order,
          weekdays: ap.weekdays, trackAssignments: ap.trackAssignments ?? undefined,
          targetDailyMin: ap.targetDailyMin, totalMin: ap.totalMin,
          localDays: buildScheduleTracks(groupRemaining(remaining, order), ap.trackAssignments ?? {}, order, ap.targetDailyMin),
        });
      } else {
        await savePlan({
          scheduleMode: "sequential", selectedModuleKeys: ap?.selectedModuleKeys ?? active.map((l) => l.id), moduleOrder: ap?.moduleOrder ?? active.map((l) => l.id),
          weekdays: ap?.weekdays ?? weekdays, targetDailyMin: ap?.targetDailyMin || perDay || 60, totalMin: ap?.totalMin ?? totalMin,
          localDays: buildSchedule(remaining, ap?.targetDailyMin || perDay || 60, ap?.weekdays ?? weekdays),
        });
      }
      toast.success("Đã xếp lại lịch từ ngày mai");
    } catch { toast.error("Xếp lại lịch thất bại"); }
    setBusy(false);
  }

  // Đang tải plan
  if (activePlan === undefined) {
    return <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải kế hoạch…</div>;
  }

  // Có plan active + không đang chỉnh → hiện lịch từ DB
  if (activePlan && !editing) {
    const days = tasksToDays(planTasks ?? []);
    return (
      <ScheduleView
        plan={days}
        perDay={activePlan.targetDailyMin}
        endDate={new Date(activePlan.projectedEndDate)}
        loading={planTasks === undefined}
        isTaskDone={isTaskDone}
        onAdjust={() => setEditing(true)}
        onReschedule={reschedule}
        onOpenTask={openTask}
        notifLabel={notifOn && notifTimes.length ? notifTimes.join(" · ") : null}
        busy={busy}
      />
    );
  }

  // Wizard (chưa có plan hoặc đang chỉnh)
  return (
    <div className="space-y-5">
      {editing && (
        <button onClick={() => setEditing(false)} className="text-[12px] text-primary hover:underline">← Về lịch hiện tại</button>
      )}
      <section>
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> ĐÁNH GIÁ KHỐI LƯỢNG CÒN LẠI
        </h2>
        <div className="mt-2 divide-y rounded-xl border bg-card">
          {loads.map((l) => (
            <button key={l.id} onClick={() => toggleModule(l.id)} className="flex w-full items-center gap-2.5 p-3 text-left transition-colors hover:bg-muted/40">
              {sel.has(l.id) ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{l.title}</span>
                <span className="block text-[11px] text-muted-foreground">{l.unitCount} tiểu mục{l.coarse ? " (ước lượng — bung chi tiết khi nạp module)" : ""}</span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted-foreground">{fmtHours(l.minutes)}</span>
            </button>
          ))}
          <div className="flex items-center justify-between p-3 text-[12.5px]">
            <span className="font-medium">Đã chọn: {unitCount} tiểu mục</span>
            <span className="font-semibold text-primary">{fmtHours(totalMin)}</span>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Tính local bằng rule (độ dài ÷ 600 ký tự/phút + quiz {ACT_MIN.quiz}′ · card {ACT_MIN.cards}′ · Feynman {ACT_MIN.feynman}′ · trạm {ACT_MIN.station}′) — không tốn call AI.
        </p>
      </section>

      <section>
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 text-primary" /> NHỊP HỌC
        </h2>
        <div className="mt-2 flex gap-1 rounded-lg bg-muted/60 p-1">
          <button onClick={() => setMode("sequential")} className={`flex-1 rounded-md py-1.5 text-[12.5px] font-medium transition-colors ${mode === "sequential" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Tuần tự</button>
          <button onClick={() => setMode("tracks")} className={`flex-1 rounded-md py-1.5 text-[12.5px] font-medium transition-colors ${mode === "tracks" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Theo luồng</button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {mode === "sequential" ? "Học hết module này sang module kế, dùng chung các thứ đã chọn." : "Mỗi module gán riêng các thứ trong tuần — học song song. 1 thứ nhiều module → học tuần tự theo thứ tự chọn."}
        </p>

        {mode === "sequential" && (
        <div className="mt-2 space-y-4 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium">Học trong</p>
              <p className="text-[11px] text-muted-foreground">Khuyến nghị {recDays} ngày (~60′/ngày){daysOverride !== null && daysOverride !== recDays ? " · đang chỉnh tay" : ""}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setDaysOverride(Math.max(1, days - (days > 30 ? 5 : 1)))} className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-muted" aria-label="Giảm số ngày"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-20 text-center text-[15px] font-semibold tabular-nums">{days} ngày</span>
              <button onClick={() => setDaysOverride(days + (days >= 30 ? 5 : 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-muted" aria-label="Tăng số ngày"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-[22px] font-bold tabular-nums text-primary">≈ {fmtHours(perDay)}/ngày</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">gồm {ACT_MIN.review}′ ôn flashcard đến hạn mỗi ngày{endDate ? ` · dự kiến xong ${fmtDate(endDate)}` : ""}</p>
            {perDay > 150 && <p className="mt-1.5 flex items-center justify-center gap-1 text-[11.5px] text-amber-600"><AlertTriangle className="h-3 w-3" /> Nặng — tăng số ngày hoặc bỏ bớt module</p>}
            {perDay > 0 && perDay < 25 && <p className="mt-1.5 text-[11.5px] text-muted-foreground">Nhẹ — có thể giảm số ngày để giữ đà học</p>}
          </div>
          <div>
            <p className="text-[13px] font-medium">Tuần học được những thứ nào?</p>
            <div className="mt-2 flex gap-1.5">
              {WEEKDAY_LABELS.map((lb, i) => (
                <button key={lb} onClick={() => toggleWeekday(i)} className={`h-9 flex-1 rounded-lg text-[12px] font-semibold transition-colors ${weekdays[i] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{lb}</button>
              ))}
            </div>
            {!weekdays.some(Boolean) && <p className="mt-1.5 text-[11.5px] text-red-500">Chọn ít nhất 1 thứ trong tuần</p>}
          </div>
        </div>
        )}

        {mode === "tracks" && (
        <div className="mt-2 space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium">Mục tiêu phút/buổi</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setTrackDaily(Math.max(20, trackDaily - 10))} className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-muted" aria-label="Giảm"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-16 text-center text-[15px] font-semibold tabular-nums">{trackDaily}′</span>
              <button onClick={() => setTrackDaily(trackDaily + 10)} className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-muted" aria-label="Tăng"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          {/* Bảng gán module × thứ */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-1 text-left font-medium">Module</th>
                  {WEEKDAY_LABELS.map((lb) => <th key={lb} className="px-0.5 py-1 text-center font-medium">{lb}</th>)}
                </tr>
              </thead>
              <tbody>
                {active.length === 0 ? (
                  <tr><td colSpan={8} className="py-3 text-center text-muted-foreground">Chọn module ở trên trước</td></tr>
                ) : active.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="max-w-[140px] truncate py-1.5 pr-2 font-medium" title={l.title}>{l.title}</td>
                    {WEEKDAY_LABELS.map((_, i) => {
                      const on = assign[l.id]?.[i] ?? false;
                      return (
                        <td key={i} className="px-0.5 py-1 text-center">
                          <button onClick={() => toggleAssign(l.id, i)} className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{on ? "✓" : ""}</button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tracksUnassigned && <p className="text-[11.5px] text-red-500">Mỗi module cần gán ít nhất 1 thứ (hoặc bỏ chọn module đó).</p>}
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-[15px] font-bold tabular-nums text-primary">{tracksPreview.length} buổi</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              ~{trackDaily}′/buổi{tracksPreview.length ? ` · dự kiến xong ${fmtDate(tracksPreview[tracksPreview.length - 1].date)}` : ""}
            </p>
          </div>
        </div>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground"><Bell className="h-3.5 w-3.5 text-primary" /> NHẮC HỌC</h2>
        <div className="mt-2 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium">Thông báo đẩy tới thiết bị</p>
              <p className="text-[11px] text-muted-foreground">Sáng: tóm tắt việc hôm nay · Tối: nhắc vào học / việc còn dở</p>
            </div>
            <button onClick={toggleNotif} disabled={!pushSupported()} role="switch" aria-checked={notifOn} title={pushSupported() ? "" : "Thiết bị chưa hỗ trợ thông báo đẩy"} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${notifOn ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${notifOn ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          {notifOn && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {notifTimes.map((t, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-lg border bg-background px-1.5 py-1">
                    <input type="time" value={t} onChange={(e) => setNotifTimes((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} className="bg-transparent text-[12.5px] font-medium tabular-nums outline-none" />
                    {notifTimes.length > 1 && <button onClick={() => setNotifTimes((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground transition-colors hover:text-red-500" aria-label="Xóa giờ nhắc"><X className="h-3.5 w-3.5" /></button>}
                  </span>
                ))}
                {notifTimes.length < 4 && <button onClick={() => setNotifTimes((prev) => [...prev, "20:00"])} className="flex items-center gap-1 rounded-lg border border-dashed px-2 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"><Plus className="h-3 w-3" /> Thêm giờ</button>}
              </div>
              <p className="text-[11px] text-muted-foreground">Chỉ nhắc vào ngày-học-theo-lịch. iPhone/iPad cần “Thêm vào MH chính” (iOS ≥ 16.4). Gửi thật khi bật Push (đang thiết lập).</p>
            </div>
          )}
        </div>
      </section>

      <button onClick={generate} disabled={!totalMin || busy || (mode === "sequential" ? !weekdays.some(Boolean) : tracksUnassigned || tracksPreview.length === 0)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu…</> : "Tạo & lưu kế hoạch chi tiết →"}
      </button>
    </div>
  );
}

// study_plan_tasks (đã sort dayDate,seq) → PlanDay[]
function tasksToDays(rows: StudyPlanTaskRow[]): PlanDay[] {
  const byDay = new Map<number, StudyPlanTaskRow[]>();
  for (const r of rows) byDay.set(r.dayDate, [...(byDay.get(r.dayDate) ?? []), r]);
  return [...byDay.keys()].sort((a, b) => a - b).map((d) => {
    const ts = byDay.get(d)!.sort((a, b) => a.seq - b.seq);
    const tasks: PlanTask[] = ts.map((t) => ({ type: t.type, label: t.label, minutes: t.minutes, unitKey: t.unitKey ?? undefined, docId: t.docId ?? undefined }));
    return { date: new Date(d), tasks, totalMin: tasks.reduce((s, t) => s + t.minutes, 0) };
  });
}

// ─── Lịch chi tiết ────────────────────────────────────────────────────────────
function ScheduleView({ plan, perDay, endDate, loading, isTaskDone, onAdjust, onReschedule, onOpenTask, notifLabel, busy }: {
  plan: PlanDay[]; perDay: number; endDate: Date | null; loading: boolean;
  isTaskDone: (t: PlanTask) => boolean;
  onAdjust: () => void; onReschedule: (remaining: PlanTask[]) => void; onOpenTask: (t: PlanTask) => void;
  notifLabel: string | null; busy: boolean;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const months = useMemo(() => {
    const map = new Map<string, { label: string; days: { day: PlanDay; index: number }[] }>();
    plan.forEach((day, index) => {
      const k = `${day.date.getFullYear()}-${day.date.getMonth()}`;
      if (!map.has(k)) map.set(k, { label: `Tháng ${day.date.getMonth() + 1} · ${day.date.getFullYear()}`, days: [] });
      map.get(k)!.days.push({ day, index });
    });
    return [...map.values()];
  }, [plan]);

  const totalTasks = plan.reduce((s, d) => s + d.tasks.length, 0);
  const doneTasks = plan.reduce((s, d) => s + d.tasks.filter(isTaskDone).length, 0);
  const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const behindDays = plan.filter((d) => d.date.getTime() < today.getTime() && d.tasks.some((t) => !isTaskDone(t))).length;
  const remaining = () => plan.flatMap((d) => d.tasks.filter((t) => !isTaskDone(t)));

  if (loading) return <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải buổi học…</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11.5px] font-semibold text-primary">{plan.length} buổi · ≈ {fmtHours(perDay)}/buổi</span>
          {endDate && <span className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] text-muted-foreground">dự kiến xong {fmtDate(endDate)}</span>}
          {notifLabel && <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11.5px] text-muted-foreground"><Bell className="h-3 w-3" /> {notifLabel}</span>}
          <div className="ml-auto flex gap-1.5">
            <button onClick={() => onReschedule(remaining())} disabled={busy} className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted disabled:opacity-40" title="Dồn việc chưa xong, xếp lại từ ngày mai (rule, 0 call AI)">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Xếp lại lịch
            </button>
            <button onClick={onAdjust} className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted"><SlidersHorizontal className="h-3.5 w-3.5" /> Điều chỉnh</button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
          <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-muted-foreground">{doneTasks}/{totalTasks} việc · {pct}%</span>
        </div>
        {behindDays > 0 && (
          <p className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11.5px] text-amber-600">
            <AlertTriangle className="h-3 w-3 shrink-0" /> Bạn có {behindDays} buổi chưa hoàn thành — bấm “Xếp lại lịch” để dồn việc còn lại từ ngày mai
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
          {TASK_LEGEND.map(({ type, label }) => <span key={type} className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className={`h-2 w-2 rounded-full ${TASK_DOT[type]}`} /> {label}</span>)}
        </div>
      </div>

      {plan.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-[13px] text-muted-foreground">Kế hoạch chưa có buổi nào.</div>
      ) : months.map((m) => (
        <div key={m.label}>
          <p className="py-1 text-center text-[12px] font-semibold text-muted-foreground">{m.label}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {m.days.map(({ day, index }) => <SessionCard key={index} day={day} index={index} today={today} isTaskDone={isTaskDone} onOpenTask={onOpenTask} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionCard({ day, index, today, isTaskDone, onOpenTask }: {
  day: PlanDay; index: number; today: Date; isTaskDone: (t: PlanTask) => boolean; onOpenTask: (t: PlanTask) => void;
}) {
  const doneCount = day.tasks.filter(isTaskDone).length;
  const allDone = day.tasks.length > 0 && doneCount === day.tasks.length;
  const isToday = day.date.getTime() === today.getTime();
  const late = day.date.getTime() < today.getTime() && !allDone;

  return (
    <div className={`flex flex-col rounded-xl border bg-card p-3 transition-colors ${allDone ? "border-emerald-500/40" : isToday ? "border-primary/50 ring-1 ring-primary/30" : late ? "border-amber-500/40" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${allDone ? "bg-emerald-500 text-white" : isToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          Buổi {index + 1}{allDone && <CheckCircle2 className="h-3 w-3" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
          {fmtDate(day.date)}{isToday && <span className="ml-1.5 text-[10.5px] font-semibold text-primary">Hôm nay</span>}
        </span>
        <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${allDone ? "text-emerald-600" : "text-muted-foreground"}`}>{doneCount}/{day.tasks.length}</span>
      </div>
      <div className="mt-2 flex-1 space-y-0.5">
        {day.tasks.map((t, ti) => {
          const done = isTaskDone(t);
          return (
            <button key={ti} onClick={() => onOpenTask(t)} title="Mở phần tương ứng" className="flex w-full items-center gap-2 rounded-md py-1 pl-1 pr-1 text-left transition-colors hover:bg-muted/50">
              {done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <span className={`h-2 w-2 shrink-0 rounded-full ${TASK_DOT[t.type]}`} />}
              <span className={`min-w-0 flex-1 truncate text-[12px] ${done ? "text-muted-foreground line-through decoration-muted-foreground/40" : ""}`}>{t.label}</span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">{t.minutes}′</span>
            </button>
          );
        })}
      </div>
      {late && <p className="mt-1.5 text-[10.5px] text-amber-600">Buổi đã qua — còn {day.tasks.length - doneCount} việc dở</p>}
    </div>
  );
}
