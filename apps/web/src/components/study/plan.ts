// Rule engine Kế hoạch học tập — 100% deterministic, chạy local, KHÔNG gọi Gemini.
// Lý do (user chốt 16/07): API free tier không đảm bảo (quota/lỗi) nên mọi thứ
// suy được từ cấu trúc cây + độ dài extractedText phải là rule. Gemini chỉ dành
// cho sinh nội dung học (quiz/card/chấm Feynman) on-demand như đã chốt.

import type { StudySpace, StudyUnit } from "./mock";

// Định mức (phút) — hằng số rule, chỉnh 1 chỗ
export const READ_CHARS_PER_MIN = 600; // đọc kỹ tài liệu kỹ thuật tiếng Việt
export const ACT_MIN = { quiz: 10, cards: 12, feynman: 8, review: 10, station: 15 } as const;
export const DEFAULT_UNIT_CHARS = 43000; // tiểu mục 4 tầng điển hình của handbook này
const MIN_READ_SPLIT = 15; // phiên đọc tách ra không được ngắn hơn (phút)

export type PlanTaskType = "read" | "quiz" | "cards" | "feynman" | "review" | "station";
// unitKey/docId = ngữ cảnh điều phối: click task trong plan mở đúng nơi tương ứng
// (reader / tab Kiểm tra / Ôn tập / Feynman) giống checklist ở Tổng quan
export type PlanTask = { type: PlanTaskType; label: string; minutes: number; unitKey?: string; docId?: string };
export type PlanDay = { date: Date; tasks: PlanTask[]; totalMin: number };

// Khối lượng CÒN LẠI của 1 mục cấp cao nhất trong cây (module/tài liệu) — hàng chọn của wizard
export type ModuleLoad = {
  id: string;
  title: string;
  unitCount: number; // số tiểu mục còn việc
  minutes: number;
  coarse: boolean; // chưa bung tiểu mục — ước lượng theo dung lượng, plan chi tiết khi nạp
  defaultOn: boolean; // mặc định tick: module đang học dở / có unit cần học lại
  tasks: PlanTask[]; // theo đúng thứ tự cây
};

// Số tiểu mục (vd "2.1.3. Phân loại…" → "2.1.3") làm nhãn ngắn cho task
function shortLabel(title: string): string {
  const m = title.match(/^\d+(\.\d+)+/);
  return m ? m[0] : title.replace(/ ·.*$/, "");
}

// Việc còn lại của 1 tiểu mục lá theo checklist 4 việc (đọc → quiz ≥80 → card → Feynman).
// Unit 🔴 decayed chỉ cần làm lại quiz (đúng rule banner ở SpaceOverview).
function leafTasks(u: StudyUnit): PlanTask[] {
  const label = shortLabel(u.title);
  // "m2-1-2" → "2.1.2" (khóa điều phối ngữ cảnh, giống unitKeyFor ở SpaceOverview)
  const unitKey = /^m\d+(-\d+)+$/.test(u.id) ? u.id.slice(1).split("-").join(".") : undefined;
  const ctx = { unitKey, docId: u.docId };
  const t: PlanTask[] = [];
  const readMin = Math.round(((u.chars ?? DEFAULT_UNIT_CHARS) * (1 - u.readPct / 100)) / READ_CHARS_PER_MIN);
  if (readMin >= 3) t.push({ type: "read", label: `Đọc ${label}${u.readPct > 0 ? " (phần còn lại)" : ""}`, minutes: readMin, ...ctx });
  if ((u.quizBest ?? 0) < 80) {
    // Nhãn tự giải thích vì sao quiz xuất hiện dù không có task Đọc (đã đọc từ trước)
    const quizLabel =
      u.status === "decayed" ? `Quiz lại ${label} (🔴 lâu không ôn)`
      : u.quizBest !== undefined ? `Quiz lại ${label} (mới ${u.quizBest}%, cần ≥80%)`
      : `Quiz ${label}`;
    t.push({ type: "quiz", label: quizLabel, minutes: ACT_MIN.quiz, ...ctx });
  }
  if (u.status !== "decayed") {
    if (!u.cardsMade) t.push({ type: "cards", label: `Tạo flashcard ${label}`, minutes: ACT_MIN.cards, ...ctx });
    if (u.feynmanCount === 0) t.push({ type: "feynman", label: `Giảng lại ${label} (Feynman)`, minutes: ACT_MIN.feynman, ...ctx });
  }
  return t;
}

// Module chưa bung tiểu mục (M3, M4…): ước lượng số tiểu mục theo dung lượng file
// rồi sinh nhịp đọc + quiz/card/giảng cho từng phần — plan thật sẽ thay bằng heading.
function coarseTasks(u: StudyUnit): { tasks: PlanTask[]; unitCount: number } {
  const chars = Math.round((u.chars ?? DEFAULT_UNIT_CHARS) * (1 - u.readPct / 100));
  const est = Math.max(1, Math.round(chars / DEFAULT_UNIT_CHARS));
  const readPerPart = Math.round(chars / est / READ_CHARS_PER_MIN);
  const name = shortLabel(u.title);
  const tasks: PlanTask[] = [];
  for (let i = 1; i <= est; i++) {
    const part = est > 1 ? `${name} · phần ${i}/${est}` : name;
    tasks.push({ type: "read", label: `Đọc ${part}`, minutes: readPerPart });
    if ((u.quizBest ?? 0) < 80) tasks.push({ type: "quiz", label: `Quiz ${part}`, minutes: ACT_MIN.quiz });
    if (!u.cardsMade) tasks.push({ type: "cards", label: `Tạo flashcard ${part}`, minutes: ACT_MIN.cards });
    tasks.push({ type: "feynman", label: `Giảng lại ${part} (Feynman)`, minutes: ACT_MIN.feynman });
  }
  return { tasks, unitCount: est };
}

// Duyệt cây module có children: mục x.y → tiểu mục x.y.z; cuối mỗi mục còn việc
// thì chèn Trạm tổng kết (quiz xuyên tiểu mục + giảng cả mục).
function treeTasks(u: StudyUnit): { tasks: PlanTask[]; unitCount: number } {
  const tasks: PlanTask[] = [];
  let unitCount = 0;
  for (const sec of u.children ?? []) {
    if (!sec.children) {
      const t = leafTasks(sec);
      if (t.length) { tasks.push(...t); unitCount++; }
      continue;
    }
    let secHasWork = false;
    for (const leaf of sec.children) {
      const t = leafTasks(leaf);
      if (t.length) { tasks.push(...t); unitCount++; secHasWork = true; }
    }
    if (secHasWork) {
      tasks.push({ type: "station", label: `Trạm tổng kết ${shortLabel(sec.title)}`, minutes: ACT_MIN.station });
    }
  }
  return { tasks, unitCount };
}

// Đánh giá khối lượng còn lại theo từng mục cấp cao nhất — đầu vào bước 1 của wizard
export function buildModuleLoads(space: StudySpace): ModuleLoad[] {
  const loads: ModuleLoad[] = [];
  for (const u of space.units) {
    if (u.status === "mastered") continue; // đã vững toàn bộ — không còn việc
    const { tasks, unitCount } = u.children ? treeTasks(u) : coarseTasks(u);
    if (!tasks.length) continue;
    loads.push({
      id: u.id,
      title: u.title,
      unitCount,
      minutes: tasks.reduce((s, t) => s + t.minutes, 0),
      coarse: !u.children,
      defaultOn: u.status !== "new",
      tasks,
    });
  }
  return loads;
}

// ─── Khuyến nghị ngày ↔ giờ (2 chiều, user kéo bên nào bên kia tính lại) ─────

export function recommendDays(totalMin: number, targetDailyMin = 60): number {
  // targetDaily trừ slot ôn card đến hạn mỗi ngày
  return Math.max(1, Math.ceil(totalMin / (targetDailyMin - ACT_MIN.review)));
}

export function dailyMinutesFor(totalMin: number, days: number): number {
  return Math.ceil(totalMin / Math.max(1, days)) + ACT_MIN.review;
}

// ─── Xếp lịch ────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
// getDay(): 0=CN → quy về 0=T2 … 6=CN cho khớp mảng weekdays của UI
export const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

// Ngày kết thúc dự kiến: đếm đủ `days` ngày-học trên các thứ được chọn, từ ngày mai
export function projectedEndDate(days: number, weekdays: boolean[], from = new Date()): Date | null {
  if (!weekdays.some(Boolean)) return null;
  let d = addDays(from, 1);
  let left = days;
  while (true) {
    if (weekdays[mondayIndex(d)] && --left === 0) return d;
    d = addDays(d, 1);
  }
}

// Bin-packing giữ nguyên thứ tự cây: đổ task vào từng ngày-học theo sức chứa
// dailyMinutes; phiên đọc dài được tách đôi, task khác giữ nguyên khối.
export function buildSchedule(tasks: PlanTask[], dailyMinutes: number, weekdays: boolean[], from = new Date()): PlanDay[] {
  if (!weekdays.some(Boolean) || !tasks.length) return [];
  const queue = tasks.map((t) => ({ ...t }));
  const days: PlanDay[] = [];
  let d = addDays(from, 1);
  let guard = 0;
  while (queue.length && guard++ < 1500) {
    while (!weekdays[mondayIndex(d)]) d = addDays(d, 1);
    const day: PlanDay = { date: new Date(d), tasks: [], totalMin: 0 };
    let cap = dailyMinutes;
    if (days.length > 0) {
      // từ ngày 2: mở đầu bằng ôn flashcard đến hạn (vòng lặp giãn cách chạy song song plan)
      const review: PlanTask = { type: "review", label: "Ôn flashcard đến hạn", minutes: ACT_MIN.review };
      day.tasks.push(review); day.totalMin += review.minutes; cap -= review.minutes;
    }
    while (queue.length && cap >= 5) {
      const next = queue[0];
      if (next.minutes <= cap) {
        queue.shift(); day.tasks.push(next); day.totalMin += next.minutes; cap -= next.minutes;
      } else if (next.type === "read" && cap >= MIN_READ_SPLIT && next.minutes - cap >= MIN_READ_SPLIT) {
        day.tasks.push({ ...next, minutes: cap }); day.totalMin += cap;
        queue[0] = { ...next, label: next.label.replace(/ \(tiếp\)$/, "") + " (tiếp)", minutes: next.minutes - cap };
        cap = 0;
      } else if (!day.tasks.some((t) => t.type !== "review")) {
        // task nguyên khối lớn hơn sức chứa nhưng ngày còn trống → vẫn xếp, ngày đó hơi lố
        queue.shift(); day.tasks.push(next); day.totalMin += next.minutes; cap = 0;
      } else break;
    }
    days.push(day);
    d = addDays(d, 1);
  }
  return days;
}

// ─── Format ──────────────────────────────────────────────────────────────────

export function fmtHours(min: number): string {
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}g${String(m).padStart(2, "0")}` : `${h} giờ`;
}

export const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function fmtDate(d: Date): string {
  return `${WEEKDAY_LABELS[mondayIndex(d)]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
