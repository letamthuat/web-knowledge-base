"use client";

// Phản hồi & động lực cho module Học tập — 100% client, 0 thư viện, 0 Gemini.
// Triết lý: thưởng khoảnh khắc đáng thưởng (🟢 Vững, mốc chuỗi, xong mục tiêu ngày),
// KHÔNG phạt khi đứt chuỗi / bỏ bài.
import { useEffect, useRef } from "react";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import type { StudySpace } from "./mock";

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Rung nhẹ (Android/Chrome; iOS Safari bỏ qua êm). */
export function haptic(pattern: number | number[] = 12) {
  try { navigator.vibrate?.(pattern); } catch { /* không hỗ trợ */ }
}

const CONFETTI_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#f97316"];

/** Pháo giấy bắn từ (x,y) — mặc định giữa màn hình. Tự dọn sau ~1.4s. */
export function celebrate(origin?: { x: number; y: number }) {
  if (typeof document === "undefined" || reducedMotion()) return;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(host);
  const ox = origin?.x ?? window.innerWidth / 2;
  const oy = origin?.y ?? window.innerHeight / 2.5;
  for (let i = 0; i < 46; i++) {
    const p = document.createElement("span");
    const size = 5 + Math.random() * 5;
    p.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;width:${size}px;height:${size * 0.45}px;border-radius:1px;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`;
    host.appendChild(p);
    const angle = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 170;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 80;
    p.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx * 1.1}px,${dy + 220}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 300, easing: "cubic-bezier(0.2,0.7,0.3,1)", fill: "forwards" },
    );
  }
  window.setTimeout(() => host.remove(), 1500);
}

const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

/**
 * Theo dõi model các space giữa các lần render: tiểu mục vừa chuyển 🟢, chuỗi vừa chạm mốc,
 * vừa đạt mục tiêu phút hôm nay → toast + pháo giấy. Lần load đầu chỉ ghi nhận, không bắn.
 */
export function useStudyMilestones(models: StudySpace[], loading: boolean) {
  const prev = useRef<Map<string, { mastered: Set<string>; streak: number; goalMet: boolean }> | null>(null);
  useEffect(() => {
    if (loading) return;
    const next = new Map<string, { mastered: Set<string>; streak: number; goalMet: boolean }>();
    for (const s of models) {
      const goalMet = !!s.dailyGoalMin && s.minutesToday >= s.dailyGoalMin;
      next.set(s.id, { mastered: new Set(s.masteredKeys ?? []), streak: s.streak, goalMet });
    }
    const before = prev.current;
    prev.current = next;
    if (!before) return; // lần đầu: baseline

    let fired = false;
    for (const s of models) {
      const b = before.get(s.id);
      const n = next.get(s.id)!;
      if (!b) continue; // space mới tạo
      const newly = [...n.mastered].filter((k) => !b.mastered.has(k));
      if (newly.length > 0) {
        const title = findTitle(s, newly[0]) ?? newly[0];
        toast.success(newly.length === 1 ? `🟢 “${title}” đã Vững!` : `🟢 ${newly.length} tiểu mục vừa Vững!`, {
          description: `Đọc · Quiz ≥80% · Flashcard · Feynman — đủ cả 4. ${n.mastered.size}/${s.unitsTotal} tiểu mục vững.`,
        });
        fired = true;
      }
      const milestone = STREAK_MILESTONES.find((m) => b.streak < m && n.streak >= m);
      if (milestone) {
        toast.success(`🔥 Chuỗi ${milestone} ngày học chủ động!`, { description: "Giữ nhịp này — mỗi ngày một chút là đủ." });
        fired = true;
      }
      if (!b.goalMet && n.goalMet) {
        toast.success(`🎯 Xong mục tiêu ${s.dailyGoalMin} phút hôm nay`, { description: `${s.name} — học thêm là “điểm thưởng”, nghỉ cũng không sao.` });
        fired = true;
      }
    }
    if (fired) { celebrate(); haptic([10, 40, 10]); }
  }, [models, loading]);
}

function findTitle(space: StudySpace, unitKey: string): string | undefined {
  const id = "m" + unitKey.replace(/\./g, "-");
  const walk = (us: StudySpace["units"]): string | undefined => {
    for (const u of us) {
      if (u.id === id) return u.title;
      const t = u.children ? walk(u.children) : undefined;
      if (t) return t;
    }
    return undefined;
  };
  return walk(space.units);
}

/** Lửa chuỗi: xám = hôm nay chưa giữ chuỗi, cam = đã giữ. Không bao giờ đỏ/phạt. */
export function StreakFlame({ streak, activeToday, compact }: { streak: number; activeToday?: boolean; compact?: boolean }) {
  const lit = activeToday ?? true;
  return (
    <div
      title={lit ? "Hôm nay đã giữ chuỗi" : "Hôm nay chưa ôn chủ động — ôn card, làm quiz hoặc Feynman để giữ chuỗi"}
      className={`flex items-center gap-1 rounded-full font-semibold transition-colors ${compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} ${
        lit ? "bg-orange-500/10 text-orange-500" : "bg-muted text-muted-foreground"
      }`}
    >
      <Flame className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} ${lit ? "" : "opacity-60"}`} fill={lit ? "currentColor" : "none"} />
      {compact ? streak : `${streak} ngày`}
    </div>
  );
}

/** Vòng mục tiêu phút/ngày — đầy vòng là xong ngày. */
export function GoalRing({ minutes, goal, size = 44 }: { minutes: number; goal: number; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, minutes / goal) : 0;
  const done = pct >= 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        className={done ? "stroke-emerald-500" : "stroke-primary"}
        style={{ transition: "stroke-dashoffset 700ms var(--ease-spring, ease-out)" }}
      />
    </svg>
  );
}

/** Thẻ mục tiêu hôm nay (vòng + số). Không có plan → gợi ý lập kế hoạch. */
export function DailyGoal({ space, onPlan }: { space: StudySpace; onPlan?: () => void }) {
  if (!space.dailyGoalMin) {
    return onPlan ? (
      <button onClick={onPlan} className="flex w-full items-center gap-3 rounded-xl border border-dashed bg-card p-3 text-left text-[12px] text-muted-foreground transition-colors hover:border-primary/40">
        <GoalRing minutes={0} goal={1} size={36} />
        <span>Chưa có mục tiêu ngày — <b className="text-primary">lập kế hoạch</b> để có vòng mục tiêu.</span>
      </button>
    ) : null;
  }
  const done = space.minutesToday >= space.dailyGoalMin;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <GoalRing minutes={space.minutesToday} goal={space.dailyGoalMin} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold tabular-nums">
          {space.minutesToday}<span className="text-muted-foreground">/{space.dailyGoalMin} phút</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          {done ? "🎯 Xong mục tiêu hôm nay" : `Còn ${space.dailyGoalMin - space.minutesToday} phút để đầy vòng`}
        </p>
      </div>
      <StreakFlame streak={space.streak} activeToday={space.activeToday} compact />
    </div>
  );
}
