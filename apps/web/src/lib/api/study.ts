"use client";
// Data-access layer module "Học tập" (Study) trên Supabase.
// Theo 01-specs/study/SPEC.md §2 + pattern lib/api/domains.ts.
// Rule-first: SRS interval, decay, streak = deterministic ở đây/rule engine — 0 Gemini.
import { useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery, useRealtimeOne } from "@/hooks/useRealtimeQuery";

// ─── ENUMS & SUB-TYPES ────────────────────────────────────────────────────────
export type UnitStatus = "new" | "reading" | "read" | "mastered" | "decayed";
export type CardType = "concept" | "apply" | "link";
export type PlanTaskType = "read" | "quiz" | "cards" | "feynman" | "review" | "station";
export type ScheduleMode = "sequential" | "tracks";

export type QuizQuestion =
  | { kind: "mcq"; q: string; options: string[]; correct: number; explainWrong: string[]; quote: string; quoteAnchor?: string }
  | { kind: "open"; q: string; feedbackGood: string[]; feedbackMissing: string[]; quote: string; quoteAnchor?: string };

export type AttemptAnswer = { mcqPick?: number; openText?: string };

export type FeynmanRubric = {
  correct: string[];
  missing: string[];
  wrong: string[];
  hasExample: boolean;
  hasEdgeCase: boolean;
  followUp: string;
  connection?: string; // chỉ khi isLinked
};

// ─── ROW TYPES (khớp cột 0005_study.sql) ──────────────────────────────────────
export type StudySpaceRow = {
  _id: string;
  userId: string;
  name: string;
  emoji: string | null;
  sourceType: "handbook" | "docs";
  handbookId: string | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type StudySpaceSourceRow = {
  _id: string;
  spaceId: string;
  docId: string;
  order: number;
};

export type StudyUnitRow = {
  _id: string;
  spaceId: string;
  parentUnitId: string | null;
  docId: string | null;
  unitKey: string;
  moduleKey: string;
  title: string;
  headingAnchor: string | null;
  orderIndex: number;
  depth: number;
  isLeaf: boolean;
  chars: number | null;
  contentHash: string | null;
  coarse: boolean;
  orphaned: boolean;
  contentChanged: boolean;
  status: UnitStatus;
  readPct: number;
  masteredAt: number | null;
  lastActiveAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type StudyCheckpointRow = {
  _id: string;
  spaceId: string;
  lastReviewedUnitKey: string | null;
  lastReadUnitKey: string | null;
  updatedAt: number;
};

export type FlashcardRow = {
  _id: string;
  spaceId: string;
  unitKey: string;
  moduleKey: string;
  type: CardType;
  front: string;
  back: string;
  quote: string | null;
  quoteAnchor: string | null;
  intervalDays: number;
  dueAt: number;
  lastReviewedAt: number | null;
  forgetCount30d: number;
  aiGenerated: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ReviewLogRow = {
  _id: string;
  cardId: string;
  spaceId: string;
  rating: "forgot" | "remembered";
  intervalBefore: number;
  intervalAfter: number;
  reviewedAt: number;
};

export type SectionQuestionRow = {
  _id: string;
  spaceId: string;
  unitKey: string;
  kind: "quiz" | "pre";
  questions: QuizQuestion[] | string[];
  generatedAt: number;
};

export type QuizAttemptRow = {
  _id: string;
  spaceId: string;
  unitKey: string;
  score: number;
  mcqCorrect: number;
  essayScore: number | null;
  answers: AttemptAnswer[];
  aiFeedback: unknown;
  attemptedAt: number;
};

export type FeynmanSessionRow = {
  _id: string;
  spaceId: string;
  scopeKeys: string[];
  isLinked: boolean;
  durationSec: number;
  transcript: string | null;
  rubric: FeynmanRubric;
  attemptedAt: number;
};

export type StudySessionRow = {
  _id: string;
  spaceId: string;
  activityType: PlanTaskType;
  unitKey: string | null;
  activeMinutes: number;
  isActiveRecall: boolean;
  occurredAt: number;
};

export type StudyPlanRow = {
  _id: string;
  spaceId: string;
  status: "active" | "archived";
  scheduleMode: ScheduleMode;
  selectedModuleKeys: string[];
  moduleOrder: string[];
  weekdays: boolean[];
  trackAssignments: Record<string, boolean[]> | null;
  targetDailyMin: number;
  totalMin: number;
  startDate: number;
  projectedEndDate: number;
  createdAt: number;
  archivedAt: number | null;
};

export type StudyPlanTaskRow = {
  _id: string;
  planId: string;
  spaceId: string;
  dayDate: number;
  seq: number;
  type: PlanTaskType;
  unitKey: string | null;
  docId: string | null;
  minutes: number;
  label: string;
};

export type NotificationSettingsRow = {
  _id: string;
  userId: string;
  enabled: boolean;
  times: string[];
  timezone: string;
  types: { morning: boolean; evening: boolean };
  updatedAt: number;
};

export type PushSubscriptionRow = {
  _id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: number;
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

/** Card đến hạn hôm nay (dueAt <= cuối ngày hiện tại). Dùng cho queue "Ôn hôm nay". */
export function isDue(card: Pick<FlashcardRow, "dueAt">, now = Date.now()): boolean {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return card.dueAt <= endOfToday.getTime();
}

// ══════════════════════════════════════════════════════════════════════════════
// READS (hooks) — RLS tự lọc theo user; đa số scope theo spaceId
// ══════════════════════════════════════════════════════════════════════════════
/** Tất cả space của user (gồm cả archived — consumer tự lọc archivedAt). */
export function useStudySpaces(): StudySpaceRow[] | undefined {
  return useRealtimeQuery<StudySpaceRow>("study_spaces", { order: { column: "updatedAt", ascending: false } });
}

export function useStudySpace(spaceId: string | null): StudySpaceRow | null | undefined {
  return useRealtimeOne<StudySpaceRow>("study_spaces", { filter: spaceId ? { _id: spaceId } : undefined, enabled: !!spaceId });
}

/** Số thẻ đến hạn hôm nay theo từng spaceId (1 query gộp toàn bộ card của user). Dùng cho badge sidebar. */
export function useDueCountsBySpace(): Record<string, number> {
  const cards = useRealtimeQuery<FlashcardRow>("flashcards", { order: { column: "dueAt", ascending: true } });
  return useMemo(() => {
    const out: Record<string, number> = {};
    if (!cards) return out;
    const now = Date.now();
    for (const c of cards) if (isDue(c, now)) out[c.spaceId] = (out[c.spaceId] ?? 0) + 1;
    return out;
  }, [cards]);
}

/** Cây lộ trình 1 space, theo orderIndex (thứ tự học mặc định). */
export function useStudyUnits(spaceId: string | null): StudyUnitRow[] | undefined {
  return useRealtimeQuery<StudyUnitRow>("study_units", {
    filter: spaceId ? { spaceId } : undefined,
    order: { column: "orderIndex", ascending: true },
    enabled: !!spaceId,
  });
}

export function useStudyCheckpoint(spaceId: string | null): StudyCheckpointRow | null | undefined {
  return useRealtimeOne<StudyCheckpointRow>("study_checkpoints", { filter: spaceId ? { spaceId } : undefined, enabled: !!spaceId });
}

export function useFlashcards(spaceId: string | null): FlashcardRow[] | undefined {
  return useRealtimeQuery<FlashcardRow>("flashcards", {
    filter: spaceId ? { spaceId } : undefined,
    order: { column: "dueAt", ascending: true },
    enabled: !!spaceId,
  });
}

export function useQuizAttempts(spaceId: string | null): QuizAttemptRow[] | undefined {
  return useRealtimeQuery<QuizAttemptRow>("quiz_attempts", {
    filter: spaceId ? { spaceId } : undefined,
    order: { column: "attemptedAt", ascending: false },
    enabled: !!spaceId,
  });
}

export function useFeynmanSessions(spaceId: string | null): FeynmanSessionRow[] | undefined {
  return useRealtimeQuery<FeynmanSessionRow>("feynman_sessions", {
    filter: spaceId ? { spaceId } : undefined,
    order: { column: "attemptedAt", ascending: false },
    enabled: !!spaceId,
  });
}

export function useStudySessions(spaceId: string | null): StudySessionRow[] | undefined {
  return useRealtimeQuery<StudySessionRow>("study_sessions", {
    filter: spaceId ? { spaceId } : undefined,
    order: { column: "occurredAt", ascending: false },
    enabled: !!spaceId,
  });
}

/** Plan đang active của space (1 dòng). */
export function useActivePlan(spaceId: string | null): StudyPlanRow | null | undefined {
  return useRealtimeOne<StudyPlanRow>("study_plans", {
    filter: spaceId ? { spaceId, status: "active" } : undefined,
    enabled: !!spaceId,
  });
}

export function usePlanTasks(planId: string | null): StudyPlanTaskRow[] | undefined {
  return useRealtimeQuery<StudyPlanTaskRow>("study_plan_tasks", {
    filter: planId ? { planId } : undefined,
    order: { column: "dayDate", ascending: true },
    enabled: !!planId,
  });
}

export function useNotificationSettings(): NotificationSettingsRow | null | undefined {
  return useRealtimeOne<NotificationSettingsRow>("notification_settings");
}

// ─── ASYNC READS (cache đề — không cần realtime) ──────────────────────────────
export async function getSectionQuestions(spaceId: string, unitKey: string, kind: "quiz" | "pre"): Promise<SectionQuestionRow | null> {
  const { data, error } = await supabase
    .from("section_questions")
    .select("*")
    .eq("spaceId", spaceId)
    .eq("unitKey", unitKey)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  return (data as SectionQuestionRow | null) ?? null;
}

export async function getReviewLogs(cardId: string): Promise<ReviewLogRow[]> {
  const { data, error } = await supabase.from("review_logs").select("*").eq("cardId", cardId).order("reviewedAt", { ascending: false });
  if (error) throw error;
  return (data as ReviewLogRow[]) ?? [];
}

// ══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ══════════════════════════════════════════════════════════════════════════════
// ─── SPACES ───────────────────────────────────────────────────────────────────
export async function createStudySpace(input: {
  name: string;
  emoji?: string;
  sourceType: "handbook" | "docs";
  handbookId?: string;
}): Promise<string> {
  const userId = await currentUserId();
  const name = input.name.trim();
  if (!name || name.length > 120) throw new Error("Tên space phải 1-120 ký tự");
  const now = Date.now();
  const { data, error } = await supabase
    .from("study_spaces")
    .insert({
      userId,
      name,
      emoji: input.emoji ?? null,
      sourceType: input.sourceType,
      handbookId: input.handbookId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .select("_id")
    .single();
  if (error || !data) throw error ?? new Error("Tạo space thất bại");
  return data._id;
}

export async function renameStudySpace(spaceId: string, name: string): Promise<void> {
  const n = name.trim();
  if (!n || n.length > 120) throw new Error("Tên space phải 1-120 ký tự");
  const { error } = await supabase.from("study_spaces").update({ name: n, updatedAt: Date.now() }).eq("_id", spaceId);
  if (error) throw error;
}

export async function archiveStudySpace(spaceId: string): Promise<void> {
  const { error } = await supabase.from("study_spaces").update({ archivedAt: Date.now(), updatedAt: Date.now() }).eq("_id", spaceId);
  if (error) throw error;
}

export async function removeStudySpace(spaceId: string): Promise<void> {
  // FK cascade xoá units/cards/attempts/... theo spaceId.
  const { error } = await supabase.from("study_spaces").delete().eq("_id", spaceId);
  if (error) throw error;
}

/** Gắn các doc được chọn học vào space (dùng cho reconcile + sourceType='docs'). */
export async function setSpaceSources(spaceId: string, docIds: string[]): Promise<void> {
  const userId = await currentUserId();
  await supabase.from("study_space_sources").delete().eq("spaceId", spaceId);
  if (!docIds.length) return;
  const rows = docIds.map((docId, i) => ({ userId, spaceId, docId, order: i }));
  const { error } = await supabase.from("study_space_sources").insert(rows);
  if (error) throw error;
}

// ─── UNITS (materialize B2 dùng insert bulk) ──────────────────────────────────
// _id client-gen (crypto.randomUUID) để link parentUnitId trong 1 lần bulk insert.
export type NewStudyUnit = Omit<StudyUnitRow, "createdAt" | "updatedAt" | "userId" | "spaceId"> & { _id: string };

export async function insertStudyUnits(spaceId: string, units: NewStudyUnit[]): Promise<void> {
  const userId = await currentUserId();
  const now = Date.now();
  const rows = units.map((u) => ({ ...u, userId, spaceId, createdAt: now, updatedAt: now }));
  const { error } = await supabase.from("study_units").insert(rows);
  if (error) throw error;
}

export async function updateStudyUnit(unitId: string, patch: Partial<Pick<StudyUnitRow,
  "status" | "readPct" | "masteredAt" | "lastActiveAt" | "orphaned" | "contentChanged" | "contentHash" | "orderIndex">>): Promise<void> {
  const { error } = await supabase.from("study_units").update({ ...patch, updatedAt: Date.now() }).eq("_id", unitId);
  if (error) throw error;
}

/** Đánh dấu đã đọc 1 tiểu mục (mở reader từ checklist) — set readPct=100. Rule "không khóa": mở ra = coi như đã đọc. */
export async function markUnitRead(spaceId: string, unitKey: string): Promise<void> {
  const { error } = await supabase
    .from("study_units")
    .update({ readPct: 100, updatedAt: Date.now() })
    .eq("spaceId", spaceId)
    .eq("unitKey", unitKey)
    .lt("readPct", 100);
  if (error) throw error;
}

// ─── CHECKPOINT ────────────────────────────────────────────────────────────────
export async function upsertCheckpoint(spaceId: string, patch: { lastReviewedUnitKey?: string; lastReadUnitKey?: string }): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("study_checkpoints")
    .upsert({ userId, spaceId, ...patch, updatedAt: Date.now() }, { onConflict: "spaceId" });
  if (error) throw error;
}

// ─── FLASHCARDS + SRS ──────────────────────────────────────────────────────────
export type NewFlashcard = Pick<FlashcardRow, "unitKey" | "moduleKey" | "type" | "front" | "back"> &
  Partial<Pick<FlashcardRow, "quote" | "quoteAnchor" | "aiGenerated">>;

/** Lưu bộ card user đã duyệt cho 1 tiểu mục. dueAt = now (đến hạn ngay để vào vòng ôn). */
export async function insertFlashcards(spaceId: string, cards: NewFlashcard[]): Promise<void> {
  const userId = await currentUserId();
  const now = Date.now();
  const rows = cards.map((c) => ({
    userId,
    spaceId,
    unitKey: c.unitKey,
    moduleKey: c.moduleKey,
    type: c.type,
    front: c.front,
    back: c.back,
    quote: c.quote ?? null,
    quoteAnchor: c.quoteAnchor ?? null,
    intervalDays: 1,
    dueAt: now,
    forgetCount30d: 0,
    aiGenerated: c.aiGenerated ?? true,
    createdAt: now,
    updatedAt: now,
  }));
  const { error } = await supabase.from("flashcards").insert(rows);
  if (error) throw error;
}

/**
 * Chấm 1 card (SRS interval nhân đôi / reset về mai) + ghi review_log append-only.
 * "Nhớ" → interval*2; "Quên" → interval=1 (mai). forgetCount30d là cache;
 * số chính xác 30 ngày lấy từ review_logs khi cần (rule CẦN HỌC LẠI).
 */
export async function reviewFlashcard(card: FlashcardRow, rating: "forgot" | "remembered"): Promise<void> {
  const userId = await currentUserId();
  const now = Date.now();
  const intervalAfter = rating === "remembered" ? card.intervalDays * 2 : 1;
  const dueAt = now + intervalAfter * DAY_MS;
  const { error: logErr } = await supabase.from("review_logs").insert({
    userId,
    cardId: card._id,
    spaceId: card.spaceId,
    rating,
    intervalBefore: card.intervalDays,
    intervalAfter,
    reviewedAt: now,
  });
  if (logErr) throw logErr;
  const { error } = await supabase
    .from("flashcards")
    .update({
      intervalDays: intervalAfter,
      dueAt,
      lastReviewedAt: now,
      forgetCount30d: rating === "forgot" ? card.forgetCount30d + 1 : card.forgetCount30d,
      updatedAt: now,
    })
    .eq("_id", card._id);
  if (error) throw error;
}

// ─── SECTION QUESTIONS (cache đề — sinh 1 lần/tiểu mục) ────────────────────────
export async function saveSectionQuestions(spaceId: string, unitKey: string, kind: "quiz" | "pre", questions: QuizQuestion[] | string[]): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("section_questions")
    .upsert({ userId, spaceId, unitKey, kind, questions, generatedAt: Date.now() }, { onConflict: "spaceId,unitKey,kind" });
  if (error) throw error;
}

// ─── QUIZ ATTEMPTS (append-only) ──────────────────────────────────────────────
export async function recordQuizAttempt(input: {
  spaceId: string;
  unitKey: string;
  score: number;
  mcqCorrect: number;
  essayScore?: number;
  answers: AttemptAnswer[];
  aiFeedback?: unknown;
}): Promise<string> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert({
      userId,
      spaceId: input.spaceId,
      unitKey: input.unitKey,
      score: input.score,
      mcqCorrect: input.mcqCorrect,
      essayScore: input.essayScore ?? null,
      answers: input.answers,
      aiFeedback: input.aiFeedback ?? null,
      attemptedAt: Date.now(),
    })
    .select("_id")
    .single();
  if (error || !data) throw error ?? new Error("Lưu quiz thất bại");
  return data._id;
}

// ─── FEYNMAN (append-only) ────────────────────────────────────────────────────
export async function recordFeynmanSession(input: {
  spaceId: string;
  scopeKeys: string[];
  isLinked: boolean;
  durationSec: number;
  transcript?: string;
  rubric: FeynmanRubric;
}): Promise<string> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("feynman_sessions")
    .insert({
      userId,
      spaceId: input.spaceId,
      scopeKeys: input.scopeKeys,
      isLinked: input.isLinked,
      durationSec: input.durationSec,
      transcript: input.transcript ?? null,
      rubric: input.rubric,
      attemptedAt: Date.now(),
    })
    .select("_id")
    .single();
  if (error || !data) throw error ?? new Error("Lưu phiên Feynman thất bại");
  return data._id;
}

// ─── STUDY SESSIONS (heatmap/streak) ──────────────────────────────────────────
/** Ghi 1 hoạt động học; nếu active-recall + có unitKey → cập nhật lastActiveAt (rule decay). */
export async function logStudySession(input: {
  spaceId: string;
  activityType: PlanTaskType;
  unitKey?: string;
  activeMinutes: number;
}): Promise<void> {
  const userId = await currentUserId();
  const now = Date.now();
  const isActiveRecall = input.activityType !== "read";
  const { error } = await supabase.from("study_sessions").insert({
    userId,
    spaceId: input.spaceId,
    activityType: input.activityType,
    unitKey: input.unitKey ?? null,
    activeMinutes: input.activeMinutes,
    isActiveRecall,
    occurredAt: now,
  });
  if (error) throw error;
  if (isActiveRecall && input.unitKey) {
    await supabase
      .from("study_units")
      .update({ lastActiveAt: now, updatedAt: now })
      .eq("spaceId", input.spaceId)
      .eq("unitKey", input.unitKey);
  }
}

// ─── PLANS (snapshot; tạo mới = archive plan cũ) ──────────────────────────────
export type NewPlanTask = Pick<StudyPlanTaskRow, "dayDate" | "seq" | "type" | "minutes" | "label"> &
  Partial<Pick<StudyPlanTaskRow, "unitKey" | "docId">>;

/** Tạo plan mới active + snapshot tasks; archive plan active cũ (append-only). 0 Gemini. */
export async function createPlan(input: {
  spaceId: string;
  scheduleMode: ScheduleMode;
  selectedModuleKeys: string[];
  moduleOrder: string[];
  weekdays: boolean[];
  trackAssignments?: Record<string, boolean[]>;
  targetDailyMin: number;
  totalMin: number;
  startDate: number;
  projectedEndDate: number;
  tasks: NewPlanTask[];
}): Promise<string> {
  const userId = await currentUserId();
  const now = Date.now();
  // Archive plan active hiện tại
  await supabase.from("study_plans").update({ status: "archived", archivedAt: now }).eq("spaceId", input.spaceId).eq("status", "active");
  const { data, error } = await supabase
    .from("study_plans")
    .insert({
      userId,
      spaceId: input.spaceId,
      status: "active",
      scheduleMode: input.scheduleMode,
      selectedModuleKeys: input.selectedModuleKeys,
      moduleOrder: input.moduleOrder,
      weekdays: input.weekdays,
      trackAssignments: input.trackAssignments ?? null,
      targetDailyMin: input.targetDailyMin,
      totalMin: input.totalMin,
      startDate: input.startDate,
      projectedEndDate: input.projectedEndDate,
      createdAt: now,
    })
    .select("_id")
    .single();
  if (error || !data) throw error ?? new Error("Tạo plan thất bại");
  const planId = data._id as string;
  if (input.tasks.length) {
    const rows = input.tasks.map((t) => ({
      userId,
      planId,
      spaceId: input.spaceId,
      dayDate: t.dayDate,
      seq: t.seq,
      type: t.type,
      unitKey: t.unitKey ?? null,
      docId: t.docId ?? null,
      minutes: t.minutes,
      label: t.label,
    }));
    const { error: tErr } = await supabase.from("study_plan_tasks").insert(rows);
    if (tErr) throw tErr;
  }
  return planId;
}

export async function archivePlan(planId: string): Promise<void> {
  const { error } = await supabase.from("study_plans").update({ status: "archived", archivedAt: Date.now() }).eq("_id", planId);
  if (error) throw error;
}

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────
export async function upsertNotificationSettings(patch: Partial<Pick<NotificationSettingsRow, "enabled" | "times" | "timezone" | "types">>): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("notification_settings")
    .upsert({ userId, ...patch, updatedAt: Date.now() }, { onConflict: "userId" });
  if (error) throw error;
}

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string; userAgent?: string }): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, userAgent: sub.userAgent ?? null, createdAt: Date.now() }, { onConflict: "endpoint" });
  if (error) throw error;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw error;
}
