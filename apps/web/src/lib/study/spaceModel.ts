"use client";
// Adapter: dựng shape StudySpace (mock) từ DB rows để component (SpaceOverview/Plan/
// danh sách) chạy data thật mà KHÔNG phải sửa. Cây lồng + stats + todayMenu/weakSpots
// (rule cơ bản, 0 AI). Xem 01-specs/study/SPEC.md §1.1-1.3.
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import {
  isDue,
  type StudySpaceRow,
  type StudyUnitRow,
  type FlashcardRow,
  type QuizAttemptRow,
  type FeynmanSessionRow,
  type StudySessionRow,
} from "@/lib/api/study";
import type { StudySpace, StudyUnit, TodayItem, WeakSpot, UnitStatus } from "@/components/study/mock";

const DAY_MS = 86_400_000;
const MASTERY_QUIZ = 80;
const DECAY_DAYS = 21; // 🟢 quá 21 ngày không active-recall → 🔴 (SPEC §3.3)

/** unitKey "2.1.3" → id component "m2-1-3"; "M2" → "m2". Khớp unitKeyFor/quizSectionIdFor. */
function unitIdFromKey(unitKey: string): string {
  return "m" + unitKey.replace(/^[Mm]/, "").replace(/\./g, "-");
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ─── Data load (toàn user; RLS scope; group theo spaceId ở JS) ────────────────
export type StudyData = {
  spaces: StudySpaceRow[] | undefined;
  units: StudyUnitRow[] | undefined;
  cards: FlashcardRow[] | undefined;
  attempts: QuizAttemptRow[] | undefined;
  feyn: FeynmanSessionRow[] | undefined;
  sessions: StudySessionRow[] | undefined;
  loading: boolean;
};

export function useStudyData(): StudyData {
  const spaces = useRealtimeQuery<StudySpaceRow>("study_spaces", { order: { column: "updatedAt", ascending: false } });
  const units = useRealtimeQuery<StudyUnitRow>("study_units", { order: { column: "orderIndex", ascending: true } });
  const cards = useRealtimeQuery<FlashcardRow>("flashcards");
  const attempts = useRealtimeQuery<QuizAttemptRow>("quiz_attempts");
  const feyn = useRealtimeQuery<FeynmanSessionRow>("feynman_sessions");
  const sessions = useRealtimeQuery<StudySessionRow>("study_sessions");
  return { spaces, units, cards, attempts, feyn, sessions, loading: spaces === undefined || units === undefined };
}

// ─── Streak (chỉ ngày có active-recall; chưa xét plan-weekday, SPEC §2.9) ──────
function computeStreak(sessions: StudySessionRow[]): number {
  const days = new Set(sessions.filter((s) => s.isActiveRecall).map((s) => startOfDay(s.occurredAt)));
  if (days.size === 0) return 0;
  let d = startOfDay(Date.now());
  if (!days.has(d)) d -= DAY_MS; // chưa học hôm nay → tính từ hôm qua (chuỗi chưa đứt)
  let streak = 0;
  while (days.has(d)) {
    streak++;
    d -= DAY_MS;
  }
  return streak;
}

// ─── Dựng 1 StudySpace từ rows ─────────────────────────────────────────────────
export function buildSpaceModel(
  space: StudySpaceRow,
  allUnits: StudyUnitRow[],
  allCards: FlashcardRow[],
  allAttempts: QuizAttemptRow[],
  allFeyn: FeynmanSessionRow[],
  allSessions: StudySessionRow[],
): StudySpace {
  const rows = allUnits.filter((u) => u.spaceId === space._id && !u.orphaned);
  const cards = allCards.filter((c) => c.spaceId === space._id);
  const attempts = allAttempts.filter((a) => a.spaceId === space._id);
  const feyn = allFeyn.filter((f) => f.spaceId === space._id);
  const sessions = allSessions.filter((s) => s.spaceId === space._id);

  // Dẫn xuất per-unitKey
  const quizBestBy = new Map<string, number>();
  for (const a of attempts) quizBestBy.set(a.unitKey, Math.max(quizBestBy.get(a.unitKey) ?? 0, a.score));
  const cardsBy = new Set(cards.map((c) => c.unitKey));
  const feynCountBy = new Map<string, number>();
  for (const f of feyn) for (const k of f.scopeKeys) feynCountBy.set(k, (feynCountBy.get(k) ?? 0) + 1);

  // Trạng thái leaf tính TỪ SIGNALS THẬT (không dựa status lưu, vì mastery/decay là dẫn xuất).
  const now = Date.now();
  const statusByKey = new Map<string, UnitStatus>();
  function leafStatus(readPct: number, quizBest: number | undefined, cardsMade: boolean, feyn: number, lastActiveAt: number | null): UnitStatus {
    const read = readPct >= 100;
    const quiz80 = (quizBest ?? 0) >= MASTERY_QUIZ;
    if (read && quiz80 && cardsMade && feyn > 0) {
      if (lastActiveAt && now - lastActiveAt > DECAY_DAYS * DAY_MS) return "decayed";
      return "mastered";
    }
    if (read) return "read"; // đọc xong nhưng chưa đủ 4
    if (readPct > 0 || quiz80 || cardsMade || feyn > 0) return "reading";
    return "new";
  }
  function parentStatus(kids: UnitStatus[]): UnitStatus {
    if (kids.some((s) => s === "decayed")) return "decayed";
    if (kids.length > 0 && kids.every((s) => s === "mastered")) return "mastered";
    if (kids.some((s) => s !== "new")) return "reading";
    return "new";
  }

  // Build cây lồng theo parentUnitId (rows đã sort orderIndex)
  const rowById = new Map(rows.map((r) => [r._id, r]));
  const childrenOf = new Map<string, string[]>();
  for (const r of rows) {
    const pid = r.parentUnitId ?? "__root__";
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid)!.push(r._id);
  }
  const attach = (rowId: string): StudyUnit => {
    const r = rowById.get(rowId)!;
    const kids = childrenOf.get(rowId);
    const children = kids && kids.length ? kids.map(attach) : undefined;
    const feyn = feynCountBy.get(r.unitKey) ?? 0;
    const quizBest = quizBestBy.get(r.unitKey);
    const cardsMade = cardsBy.has(r.unitKey);
    const status: UnitStatus = children ? parentStatus(children.map((c) => c.status)) : leafStatus(r.readPct, quizBest, cardsMade, feyn, r.lastActiveAt);
    if (r.isLeaf) statusByKey.set(r.unitKey, status);
    return {
      id: unitIdFromKey(r.unitKey),
      title: r.title,
      status,
      readPct: r.readPct,
      feynmanCount: r.isLeaf ? feyn : 0,
      quizBest: r.isLeaf ? quizBest : undefined,
      cardsMade: r.isLeaf ? cardsMade : undefined,
      chars: r.chars ?? undefined,
      docId: r.docId ?? undefined,
      headingAnchor: r.headingAnchor ?? undefined,
      children,
    };
  };
  const units: StudyUnit[] = (childrenOf.get("__root__") ?? []).map(attach);

  // Stats từ leaves (dùng status dẫn xuất)
  const leaves = rows.filter((r) => r.isLeaf);
  const unitsTotal = leaves.length;
  const unitsMastered = leaves.filter((r) => statusByKey.get(r.unitKey) === "mastered").length;
  const dueCards = cards.filter((c) => isDue(c)).length;
  const today = startOfDay(Date.now());
  const minutesToday = Math.round(
    sessions.filter((s) => startOfDay(s.occurredAt) === today).reduce((m, s) => m + s.activeMinutes, 0),
  );
  const streak = computeStreak(sessions);

  // todayMenu (rule cơ bản — SPEC §1.2; chưa gồm carry-over/plan): due card + unit đang/đầu chưa học
  const todayMenu: TodayItem[] = [];
  if (dueCards > 0) todayMenu.push({ type: "review", label: `Ôn ${dueCards} card đến hạn`, detail: "Trộn các tiểu mục theo lịch giãn cách" });
  const st = (r: StudyUnitRow) => statusByKey.get(r.unitKey) ?? "new";
  const nextLeaf = leaves.find((r) => st(r) === "reading") ?? leaves.find((r) => st(r) === "new");
  if (nextLeaf) todayMenu.push({ type: "read", label: `Đọc ${nextLeaf.title}`, detail: st(nextLeaf) === "reading" ? `đang ở ${nextLeaf.readPct}%` : "chưa bắt đầu" });
  const decayed = leaves.find((r) => st(r) === "decayed");
  if (decayed) todayMenu.push({ type: "fix", label: `Quiz lại ${decayed.title}`, detail: "🔴 lâu không ôn — làm lại để xanh", quizSectionId: "q-" + unitIdFromKey(decayed.unitKey).slice(1) });

  // weakSpots (SPEC §1.3): decayed HOẶC quizBest<80
  const weakSpots: WeakSpot[] = leaves
    .filter((r) => st(r) === "decayed" || ((quizBestBy.get(r.unitKey) ?? 100) < MASTERY_QUIZ && quizBestBy.has(r.unitKey)))
    .slice(0, 3)
    .map((r) => ({
      id: unitIdFromKey(r.unitKey),
      label: r.title,
      reason: st(r) === "decayed" ? "Lâu không ôn — kiến thức đang phai" : `Quiz mới đạt ${quizBestBy.get(r.unitKey)}% (cần ≥${MASTERY_QUIZ}%)`,
    }));

  const moduleCount = rows.filter((r) => r.depth === 0).length;
  const sourceLabel = space.sourceType === "handbook" ? `Handbook · ${moduleCount} module` : `${moduleCount} tài liệu lẻ`;

  return {
    id: space._id,
    name: space.name,
    emoji: space.emoji ?? "📘",
    sourceLabel,
    sourceType: space.sourceType,
    streak,
    dueCards,
    unitsTotal,
    unitsMastered,
    minutesToday,
    todayMenu,
    units,
    weakSpots,
  };
}

/** Dựng model cho mọi space chưa archived. */
export function buildAllSpaceModels(data: StudyData): StudySpace[] {
  if (!data.spaces || !data.units) return [];
  const cards = data.cards ?? [];
  const attempts = data.attempts ?? [];
  const feyn = data.feyn ?? [];
  const sessions = data.sessions ?? [];
  return data.spaces
    .filter((s) => !s.archivedAt)
    .map((s) => buildSpaceModel(s, data.units!, cards, attempts, feyn, sessions));
}
