"use client";

// Tab Kế hoạch — wizard đánh giá khối lượng → chốt nhịp học → lịch chi tiết theo ngày.
// Toàn bộ tính toán là rule local (plan.ts), 0 call Gemini.
import { useMemo, useState } from "react";
import {
  AlertTriangle, Bell, CalendarDays, CheckCircle2, Minus, Plus, RefreshCw,
  SlidersHorizontal, Sparkles, X,
} from "lucide-react";
import { toast } from "sonner";
import { QUIZ_SECTIONS, type StudySpace } from "./mock";
import { useOpenDoc, type GoTab } from "./SpaceOverview";
import {
  ACT_MIN, buildModuleLoads, buildSchedule, dailyMinutesFor, fmtDate, fmtHours,
  projectedEndDate, recommendDays, WEEKDAY_LABELS,
  type PlanDay, type PlanTask, type PlanTaskType,
} from "./plan";

// Chấm màu theo loại việc (kiểu bullet của Prep — gọn hơn ô icon)
const TASK_DOT: Record<PlanTaskType, string> = {
  read: "bg-blue-500",
  quiz: "bg-amber-500",
  cards: "bg-violet-500",
  feynman: "bg-emerald-500",
  review: "bg-muted-foreground/40",
  station: "bg-primary",
};

const TASK_LEGEND: { type: PlanTaskType; label: string }[] = [
  { type: "read", label: "Đọc" },
  { type: "quiz", label: "Quiz" },
  { type: "cards", label: "Flashcard" },
  { type: "feynman", label: "Giảng" },
  { type: "station", label: "Trạm" },
  { type: "review", label: "Ôn card" },
];

export function PlanTab({ space, onGoTab }: { space: StudySpace; onGoTab: GoTab }) {
  const loads = useMemo(() => buildModuleLoads(space), [space]);
  const openDoc = useOpenDoc();

  // Click tên việc = điều phối có ngữ cảnh, giống checklist ở Tổng quan
  const openTask = (t: PlanTask) => {
    switch (t.type) {
      case "read":
        if (t.docId) openDoc(t.docId);
        else toast.info("Module chưa nạp chi tiết — tài liệu demo chưa gắn cho phần này");
        return;
      case "quiz": {
        const sid = t.unitKey ? "q-" + t.unitKey.split(".").join("-") : undefined;
        onGoTab("quiz", { sectionId: sid && QUIZ_SECTIONS.some((s) => s.id === sid) ? sid : undefined });
        return;
      }
      case "cards":
        onGoTab("review", { unitKey: t.unitKey });
        return;
      case "feynman":
        onGoTab("feynman", { unitKey: t.unitKey });
        return;
      case "review":
        onGoTab("review");
        return;
      case "station":
        toast.info("Trạm tổng kết mở khi các tiểu mục trong mục đủ 🟢 — quiz xuyên tiểu mục + giảng cả mục");
        return;
    }
  };
  const [sel, setSel] = useState<Set<string>>(() => new Set(loads.filter((l) => l.defaultOn).map((l) => l.id)));
  const [daysOverride, setDaysOverride] = useState<number | null>(null); // null = theo khuyến nghị
  const [weekdays, setWeekdays] = useState<boolean[]>(() => Array(7).fill(true));
  const [plan, setPlan] = useState<PlanDay[] | null>(null);
  const [planKey, setPlanKey] = useState(0); // đổi khi tạo/xếp lại lịch → reset tick hoàn thành
  // Nhắc học qua push PWA (mock — gửi thật khi có backend). User chốt 2 mốc: 08:45 & 21:15
  const [notifOn, setNotifOn] = useState(true);
  const [notifTimes, setNotifTimes] = useState<string[]>(["08:45", "21:15"]);

  const active = loads.filter((l) => sel.has(l.id));
  const totalMin = active.reduce((s, l) => s + l.minutes, 0);
  const unitCount = active.reduce((s, l) => s + l.unitCount, 0);
  const recDays = recommendDays(totalMin);
  const days = Math.max(1, daysOverride ?? recDays);
  const perDay = totalMin ? dailyMinutesFor(totalMin, days) : 0;
  const endDate = totalMin ? projectedEndDate(days, weekdays) : null;

  const toggleModule = (id: string) =>
    setSel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleWeekday = (i: number) =>
    setWeekdays((prev) => prev.map((v, j) => (j === i ? !v : v)));

  const generate = () => { setPlan(buildSchedule(active.flatMap((l) => l.tasks), perDay, weekdays)); setPlanKey((k) => k + 1); };
  // Xếp lại lịch kiểu Prep: dồn toàn bộ việc CHƯA xong, xếp lại từ ngày mai — vẫn rule, 0 call AI
  const reschedule = (remaining: PlanTask[]) => { setPlan(buildSchedule(remaining, perDay, weekdays)); setPlanKey((k) => k + 1); };

  if (plan) {
    return (
      <ScheduleView
        key={planKey}
        plan={plan} perDay={perDay} endDate={endDate}
        onAdjust={() => setPlan(null)}
        onReschedule={reschedule}
        onOpenTask={openTask}
        notifLabel={notifOn && notifTimes.length ? notifTimes.join(" · ") : null}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Bước 1 — đánh giá khối lượng */}
      <section>
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> ĐÁNH GIÁ KHỐI LƯỢNG CÒN LẠI
        </h2>
        <div className="mt-2 divide-y rounded-xl border bg-card">
          {loads.map((l) => (
            <button
              key={l.id}
              onClick={() => toggleModule(l.id)}
              className="flex w-full items-center gap-2.5 p-3 text-left transition-colors hover:bg-muted/40"
            >
              {sel.has(l.id) ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{l.title}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {l.unitCount} tiểu mục{l.coarse ? " (ước lượng — bung chi tiết khi nạp module)" : ""}
                </span>
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
          Tính local bằng rule (độ dài nội dung ÷ {600} ký tự/phút + định mức quiz {ACT_MIN.quiz}′ · card {ACT_MIN.cards}′ · Feynman {ACT_MIN.feynman}′ · trạm {ACT_MIN.station}′) — không tốn call AI.
        </p>
      </section>

      {/* Bước 2 — nhịp học: ngày ↔ giờ tính lại 2 chiều + chọn thứ trong tuần */}
      <section>
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 text-primary" /> NHỊP HỌC
        </h2>
        <div className="mt-2 space-y-4 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium">Học trong</p>
              <p className="text-[11px] text-muted-foreground">
                Khuyến nghị {recDays} ngày (~60′/ngày){daysOverride !== null && daysOverride !== recDays ? " · đang chỉnh tay" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDaysOverride(Math.max(1, days - (days > 30 ? 5 : 1)))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
                aria-label="Giảm số ngày"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-20 text-center text-[15px] font-semibold tabular-nums">{days} ngày</span>
              <button
                onClick={() => setDaysOverride(days + (days >= 30 ? 5 : 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
                aria-label="Tăng số ngày"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-[22px] font-bold tabular-nums text-primary">≈ {fmtHours(perDay)}/ngày</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              gồm {ACT_MIN.review}′ ôn flashcard đến hạn mỗi ngày
              {endDate ? ` · dự kiến xong ${fmtDate(endDate)}` : ""}
            </p>
            {perDay > 150 && (
              <p className="mt-1.5 flex items-center justify-center gap-1 text-[11.5px] text-amber-600">
                <AlertTriangle className="h-3 w-3" /> Nặng — tăng số ngày hoặc bỏ bớt module để plan bền hơn
              </p>
            )}
            {perDay > 0 && perDay < 25 && (
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">Nhẹ — có thể giảm số ngày để giữ đà học</p>
            )}
          </div>

          <div>
            <p className="text-[13px] font-medium">Tuần học được những thứ nào?</p>
            <div className="mt-2 flex gap-1.5">
              {WEEKDAY_LABELS.map((lb, i) => (
                <button
                  key={lb}
                  onClick={() => toggleWeekday(i)}
                  className={`h-9 flex-1 rounded-lg text-[12px] font-semibold transition-colors ${
                    weekdays[i] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lb}
                </button>
              ))}
            </div>
            {!weekdays.some(Boolean) && (
              <p className="mt-1.5 text-[11.5px] text-red-500">Chọn ít nhất 1 thứ trong tuần</p>
            )}
          </div>
        </div>
      </section>

      {/* Nhắc học qua push PWA — mock UX, gửi thật ở Phase backend (VAPID + Edge Function) */}
      <section>
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <Bell className="h-3.5 w-3.5 text-primary" /> NHẮC HỌC
        </h2>
        <div className="mt-2 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium">Thông báo đẩy tới thiết bị</p>
              <p className="text-[11px] text-muted-foreground">
                Sáng: tóm tắt việc hôm nay · Tối: nhắc vào học / việc còn dở — nội dung tự chọn theo giờ
              </p>
            </div>
            <button
              onClick={() => setNotifOn(!notifOn)}
              role="switch"
              aria-checked={notifOn}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${notifOn ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${notifOn ? "left-[22px]" : "left-0.5"}`}
              />
            </button>
          </div>

          {notifOn && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {notifTimes.map((t, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-lg border bg-background px-1.5 py-1">
                    <input
                      type="time"
                      value={t}
                      onChange={(e) =>
                        setNotifTimes((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                      }
                      className="bg-transparent text-[12.5px] font-medium tabular-nums outline-none"
                    />
                    {notifTimes.length > 1 && (
                      <button
                        onClick={() => setNotifTimes((prev) => prev.filter((_, j) => j !== i))}
                        className="text-muted-foreground transition-colors hover:text-red-500"
                        aria-label="Xóa giờ nhắc"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                ))}
                {notifTimes.length < 4 && (
                  <button
                    onClick={() => setNotifTimes((prev) => [...prev, "20:00"])}
                    className="flex items-center gap-1 rounded-lg border border-dashed px-2 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Plus className="h-3 w-3" /> Thêm giờ
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Chỉ nhắc vào ngày-học-theo-lịch đã chọn ở trên. iPhone/iPad cần "Thêm vào MH chính" (iOS ≥ 16.4) mới nhận được.
                Prototype — gửi thật khi nối backend.
              </p>
            </div>
          )}
        </div>
      </section>

      <button
        onClick={generate}
        disabled={!totalMin || !weekdays.some(Boolean)}
        className="w-full rounded-xl bg-primary py-2.5 text-[13.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Tạo kế hoạch chi tiết →
      </button>
    </div>
  );
}

// ─── Lịch chi tiết: grid card "Buổi N" theo tháng (học từ Prep) ──────────────
// Tick từng việc để đánh dấu xong (mock — bản thật đồng bộ với hành động học thật);
// buổi đã qua mà còn việc dở = "chưa hoàn thành" → gợi ý Xếp lại lịch.

function ScheduleView({ plan, perDay, endDate, onAdjust, onReschedule, onOpenTask, notifLabel }: {
  plan: PlanDay[]; perDay: number; endDate: Date | null;
  onAdjust: () => void; onReschedule: (remaining: PlanTask[]) => void;
  onOpenTask: (t: PlanTask) => void;
  notifLabel: string | null;
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggleTask = (id: string) =>
    setDone((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Gom buổi theo tháng — separator "Tháng 7 · 2026" như Prep
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
  const doneTasks = done.size;
  const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  // Buổi đã qua nhưng còn việc chưa tick — tín hiệu "đang chậm hơn kế hoạch"
  const behindDays = plan.filter((d, di) => d.date.getTime() < today.getTime() && d.tasks.some((_, ti) => !done.has(`${di}-${ti}`))).length;

  const remaining = () =>
    plan.flatMap((d, di) => d.tasks.filter((t, ti) => t.type !== "review" && !done.has(`${di}-${ti}`)));

  return (
    <div className="space-y-4">
      {/* Tiến độ kế hoạch — panel kiểu Prep */}
      <div className="rounded-xl border bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11.5px] font-semibold text-primary">
            {plan.length} buổi · ≈ {fmtHours(perDay)}/buổi
          </span>
          {endDate && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] text-muted-foreground">
              dự kiến xong {fmtDate(endDate)}
            </span>
          )}
          {notifLabel && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11.5px] text-muted-foreground">
              <Bell className="h-3 w-3" /> {notifLabel}
            </span>
          )}
          <div className="ml-auto flex gap-1.5">
            <button
              onClick={() => onReschedule(remaining())}
              className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted"
              title="Dồn các việc chưa xong, xếp lại từ ngày mai — tính bằng rule, không tốn call AI"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Xếp lại lịch
            </button>
            <button
              onClick={onAdjust}
              className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Điều chỉnh
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-muted-foreground">
            {doneTasks}/{totalTasks} việc · {pct}%
          </span>
        </div>

        {behindDays > 0 && (
          <p className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11.5px] text-amber-600">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Bạn có {behindDays} buổi chưa hoàn thành — bấm "Xếp lại lịch" để dồn việc còn lại từ ngày mai
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
          {TASK_LEGEND.map(({ type, label }) => (
            <span key={type} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${TASK_DOT[type]}`} /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* Grid buổi học theo tháng */}
      {months.map((m) => (
        <div key={m.label}>
          <p className="py-1 text-center text-[12px] font-semibold text-muted-foreground">{m.label}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {m.days.map(({ day, index }) => (
              <SessionCard
                key={index}
                day={day} index={index} today={today}
                done={done} onToggle={toggleTask} onOpenTask={onOpenTask}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionCard({ day, index, today, done, onToggle, onOpenTask }: {
  day: PlanDay; index: number; today: Date;
  done: Set<string>; onToggle: (id: string) => void; onOpenTask: (t: PlanTask) => void;
}) {
  const doneCount = day.tasks.filter((_, ti) => done.has(`${index}-${ti}`)).length;
  const allDone = doneCount === day.tasks.length;
  const isToday = day.date.getTime() === today.getTime();
  const isPast = day.date.getTime() < today.getTime();
  const late = isPast && !allDone;

  return (
    <div
      className={`flex flex-col rounded-xl border bg-card p-3 transition-colors ${
        allDone ? "border-emerald-500/40" : isToday ? "border-primary/50 ring-1 ring-primary/30" : late ? "border-amber-500/40" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
            allDone ? "bg-emerald-500 text-white" : isToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          Buổi {index + 1}
          {allDone && <CheckCircle2 className="h-3 w-3" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
          {fmtDate(day.date)}
          {isToday && <span className="ml-1.5 text-[10.5px] font-semibold text-primary">Hôm nay</span>}
        </span>
        <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${allDone ? "text-emerald-600" : "text-muted-foreground"}`}>
          {doneCount}/{day.tasks.length}
        </span>
      </div>

      <div className="mt-2 flex-1 space-y-0.5">
        {day.tasks.map((t, ti) => {
          const id = `${index}-${ti}`;
          const isDone = done.has(id);
          return (
            // 2 vùng bấm: chấm tròn = tick xong · tên việc = mở đúng nơi tương ứng (như Tổng quan)
            <div key={ti} className="flex items-center rounded-md transition-colors hover:bg-muted/50">
              <button
                onClick={() => onToggle(id)}
                title={isDone ? "Bỏ đánh dấu xong" : "Đánh dấu xong"}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-muted"
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <span className={`h-2 w-2 rounded-full ring-2 ring-transparent transition-shadow hover:ring-muted-foreground/30 ${TASK_DOT[t.type]}`} />
                )}
              </button>
              <button
                onClick={() => onOpenTask(t)}
                title="Mở phần tương ứng"
                className="flex min-w-0 flex-1 items-center gap-2 py-1 pr-1 text-left"
              >
                <span className={`min-w-0 flex-1 truncate text-[12px] ${isDone ? "text-muted-foreground line-through decoration-muted-foreground/40" : ""}`}>
                  {t.label}
                </span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">{t.minutes}′</span>
              </button>
            </div>
          );
        })}
      </div>

      {late && (
        <p className="mt-1.5 text-[10.5px] text-amber-600">Buổi đã qua — còn {day.tasks.length - doneCount} việc dở</p>
      )}
    </div>
  );
}
