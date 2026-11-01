"use client";

// "Buổi học" — chạy liền mạch các việc HÔM NAY (đọc → card → quiz → Feynman) thay vì tự
// nhảy tab. Thanh tiến trình ghim trên tabs; việc tự tick ✓ khi biến khỏi HÔM NAY
// (signals thật). Không khóa: "Bỏ qua" luôn bấm được.
import { useEffect, useRef } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import type { StudySpace, TodayItem } from "./mock";
import { celebrate, GoalRing, StreakFlame } from "./celebrate";

export type SessionRun = {
  items: TodayItem[];
  idx: number;
  startedMin: number;      // minutesToday lúc bắt đầu → "+N phút" cuối buổi
  startedMastered: number;
  finished: boolean;
};

const itemKey = (it: TodayItem) => `${it.type}:${it.unitKey ?? ""}`;

/** Việc coi là xong khi không còn trong HÔM NAY (todayMenu loại việc đã đạt từ signals thật). */
export function isItemDone(it: TodayItem, space: StudySpace): boolean {
  return !space.todayMenu.some((x) => itemKey(x) === itemKey(it));
}

export function startSessionRun(space: StudySpace): SessionRun | null {
  const items = space.todayMenu.filter((it) => it.type !== "station");
  if (items.length === 0) return null;
  return { items, idx: 0, startedMin: space.minutesToday, startedMastered: space.unitsMastered, finished: false };
}

export function SessionBar({ run, space, onNext, onReopen, onEnd }: {
  run: SessionRun; space: StudySpace; onNext: () => void; onReopen: () => void; onEnd: () => void;
}) {
  if (run.finished) return <SessionSummary run={run} space={space} onClose={onEnd} />;
  const cur = run.items[run.idx];
  const curDone = isItemDone(cur, space);
  const last = run.idx + 1 >= run.items.length;
  return (
    <div className="mb-3 shrink-0 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] font-semibold tracking-wide text-primary">BUỔI HỌC · VIỆC {run.idx + 1}/{run.items.length}</span>
        <div className="flex flex-1 items-center gap-1">
          {run.items.map((it, i) => {
            const done = isItemDone(it, space);
            return (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${done ? "bg-emerald-500" : i === run.idx ? "bg-primary" : "bg-muted"}`}
              />
            );
          })}
        </div>
        <button onClick={onEnd} aria-label="Kết thúc buổi học" className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${curDone ? "study-pop bg-emerald-500 text-white" : "border-2 border-primary/40"}`}>
          {curDone && <Check className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{cur.label}</p>
          <p className="truncate text-[11px] text-muted-foreground">{curDone ? "Xong việc này ✓" : cur.detail}</p>
        </div>
        <button onClick={onReopen} title="Mở lại việc này" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:text-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onNext}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-opacity hover:opacity-90 ${curDone ? "bg-primary text-primary-foreground" : "border bg-background text-muted-foreground"}`}
        >
          {last ? (curDone ? "Hoàn tất" : "Kết thúc") : curDone ? "Tiếp →" : "Bỏ qua →"}
        </button>
      </div>
    </div>
  );
}

function SessionSummary({ run, space, onClose }: { run: SessionRun; space: StudySpace; onClose: () => void }) {
  const done = run.items.filter((it) => isItemDone(it, space)).length;
  const gained = Math.max(0, space.minutesToday - run.startedMin);
  const newlyMastered = Math.max(0, space.unitsMastered - run.startedMastered);
  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current && done > 0) { fired.current = true; celebrate(); }
  }, [done]);
  return (
    <div className="study-card-in mb-3 shrink-0 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="text-3xl">{done === run.items.length ? "🎉" : "👏"}</div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] font-semibold">{done === run.items.length ? "Xong buổi học!" : "Kết thúc buổi học"}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Hoàn thành <b className="text-foreground">{done}/{run.items.length}</b> việc · +{gained} phút
            {newlyMastered > 0 && <> · <b className="text-emerald-600">+{newlyMastered} tiểu mục 🟢</b></>}
          </p>
        </div>
        <button onClick={onClose} aria-label="Đóng" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {space.dailyGoalMin ? (
          <div className="flex items-center gap-2">
            <GoalRing minutes={space.minutesToday} goal={space.dailyGoalMin} size={36} />
            <span className="text-[12px] tabular-nums text-muted-foreground">{space.minutesToday}/{space.dailyGoalMin} phút hôm nay</span>
          </div>
        ) : null}
        <StreakFlame streak={space.streak} activeToday={space.activeToday} compact />
        <span className="text-[12px] text-muted-foreground">{space.activeToday ? "đã giữ chuỗi hôm nay" : "ôn card/quiz/Feynman để giữ chuỗi"}</span>
      </div>
    </div>
  );
}
