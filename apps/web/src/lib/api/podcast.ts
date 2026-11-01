"use client";
// Module Podcast — bảng podcast_series / podcast_episodes (realtime) / podcast_scripts (không realtime).
// Xem supabase/migrations/0006_podcast.sql.
import { supabase } from "@/lib/supabase/client";
import { useRealtimeQuery, useRealtimeOne } from "@/hooks/useRealtimeQuery";
import type { EpisodeSection, PlannedEpisode } from "@/lib/podcast/plan";

// ─── ROW TYPES ────────────────────────────────────────────────────────────────
export type PodcastSeriesRow = {
  _id: string;
  userId: string;
  title: string;
  emoji: string | null;
  sourceType: "handbook" | "doc";
  handbookId: string | null;
  docIds: string[];
  targetChars: number;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type EpisodeStatus = "draft" | "generating" | "ready" | "error";

export type PodcastEpisodeRow = {
  _id: string;
  userId: string;
  seriesId: string;
  orderIndex: number;
  title: string;
  sections: EpisodeSection[];
  sourceChars: number;
  status: EpisodeStatus;
  keyPointCount: number | null;
  coveredCount: number | null;
  turnCount: number | null;
  scriptChars: number | null;
  progressIndex: number;
  completedAt: number | null;
  recallDoneAt: number | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ScriptTurn = { s: "host" | "expert"; t: string; c: number[] };
export type PodcastScript = { keyPoints: string[]; turns: ScriptTurn[]; recall: { q: string; a: string }[] };

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

// ─── READS ────────────────────────────────────────────────────────────────────
export function usePodcastSeries(): PodcastSeriesRow[] | undefined {
  return useRealtimeQuery<PodcastSeriesRow>("podcast_series", { order: { column: "updatedAt", ascending: false } });
}

export function usePodcastSeriesOne(seriesId: string | null): PodcastSeriesRow | null | undefined {
  return useRealtimeOne<PodcastSeriesRow>("podcast_series", { filter: seriesId ? { _id: seriesId } : undefined, enabled: !!seriesId });
}

/** seriesId = null → mọi tập của user (dùng cho thống kê màn danh sách). */
export function usePodcastEpisodes(seriesId: string | null): PodcastEpisodeRow[] | undefined {
  return useRealtimeQuery<PodcastEpisodeRow>("podcast_episodes", {
    filter: seriesId ? { seriesId } : undefined,
    order: { column: "orderIndex", ascending: true },
  });
}

const scriptCache = new Map<string, PodcastScript>();

/** Kịch bản 1 tập (fetch 1 lần, cache trong phiên — bảng không realtime). */
export async function getScript(episodeId: string): Promise<PodcastScript | null> {
  const hit = scriptCache.get(episodeId);
  if (hit) return hit;
  const { data, error } = await supabase.from("podcast_scripts").select("script").eq("episodeId", episodeId).maybeSingle();
  if (error) throw error;
  const script = (data?.script as PodcastScript | undefined) ?? null;
  if (script) scriptCache.set(episodeId, script);
  return script;
}

// ─── MUTATIONS ────────────────────────────────────────────────────────────────
export async function createSeries(input: {
  title: string;
  emoji?: string;
  sourceType: "handbook" | "doc";
  handbookId?: string | null;
  docIds: string[];
  targetChars: number;
  episodes: PlannedEpisode[];
}): Promise<string> {
  const userId = await currentUserId();
  const now = Date.now();
  const { data, error } = await supabase
    .from("podcast_series")
    .insert({
      userId,
      title: input.title.trim().slice(0, 160),
      emoji: input.emoji ?? null,
      sourceType: input.sourceType,
      handbookId: input.handbookId ?? null,
      docIds: input.docIds,
      targetChars: input.targetChars,
      createdAt: now,
      updatedAt: now,
    })
    .select("_id")
    .single();
  if (error) throw error;
  const seriesId = (data as { _id: string })._id;

  const rows = input.episodes.map((e, i) => ({
    userId,
    seriesId,
    orderIndex: i,
    title: e.title.slice(0, 300),
    sections: e.sections,
    sourceChars: e.sourceChars,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error: e2 } = await supabase.from("podcast_episodes").insert(rows.slice(i, i + 200));
    if (e2) throw e2;
  }
  return seriesId;
}

export async function deleteSeries(seriesId: string): Promise<void> {
  const { error } = await supabase.from("podcast_series").delete().eq("_id", seriesId);
  if (error) throw error;
}

export async function renameEpisode(episodeId: string, title: string): Promise<void> {
  const { error } = await supabase.from("podcast_episodes").update({ title: title.trim().slice(0, 300), updatedAt: Date.now() }).eq("_id", episodeId);
  if (error) throw error;
}

export async function setEpisodeStatus(episodeId: string, status: EpisodeStatus, errorMsg?: string | null): Promise<void> {
  const { error } = await supabase
    .from("podcast_episodes")
    .update({ status, error: errorMsg ?? null, updatedAt: Date.now() })
    .eq("_id", episodeId);
  if (error) throw error;
}

/** Lưu kịch bản (ghi đè khi tạo lại) + cập nhật số liệu nhẹ trên tập. */
export async function saveScript(episodeId: string, script: PodcastScript, model: string, coveredCount: number): Promise<void> {
  const userId = await currentUserId();
  const now = Date.now();
  const { error } = await supabase
    .from("podcast_scripts")
    .upsert({ userId, episodeId, script, model, createdAt: now }, { onConflict: "episodeId" });
  if (error) throw error;
  scriptCache.set(episodeId, script);
  const { error: e2 } = await supabase
    .from("podcast_episodes")
    .update({
      status: "ready",
      error: null,
      keyPointCount: script.keyPoints.length,
      coveredCount,
      turnCount: script.turns.length,
      scriptChars: script.turns.reduce((s, t) => s + t.t.length, 0),
      progressIndex: 0,
      updatedAt: now,
    })
    .eq("_id", episodeId);
  if (e2) throw e2;
}

export async function updateEpisodeProgress(episodeId: string, progressIndex: number): Promise<void> {
  await supabase.from("podcast_episodes").update({ progressIndex, updatedAt: Date.now() }).eq("_id", episodeId);
}

export async function markEpisodeCompleted(episodeId: string): Promise<void> {
  const now = Date.now();
  await supabase.from("podcast_episodes").update({ completedAt: now, updatedAt: now }).eq("_id", episodeId).is("completedAt", null);
}

export async function markRecallDone(episodeId: string): Promise<void> {
  const now = Date.now();
  await supabase.from("podcast_episodes").update({ recallDoneAt: now, updatedAt: now }).eq("_id", episodeId);
}

export async function touchSeries(seriesId: string): Promise<void> {
  await supabase.from("podcast_series").update({ updatedAt: Date.now() }).eq("_id", seriesId);
}

// ─── NỐI NHẸ MODULE HỌC TẬP ───────────────────────────────────────────────────
type UnitMatch = { spaceId: string; unitKey: string };

/** Unit học (mọi không gian học) trùng với các mục của tập — khớp docId + headingAnchor. */
async function matchStudyUnits(sections: EpisodeSection[], onlyFinished: boolean): Promise<UnitMatch[]> {
  const secs = sections.filter((s) => s.anchor && (!onlyFinished || s.lastPart !== false));
  if (!secs.length) return [];
  const docIds = [...new Set(secs.map((s) => s.docId))];
  const { data } = await supabase
    .from("study_units")
    .select("spaceId,unitKey,docId,headingAnchor")
    .in("docId", docIds);
  const want = new Set(secs.map((s) => `${s.docId}#${s.anchor}`));
  return ((data ?? []) as { spaceId: string; unitKey: string; docId: string; headingAnchor: string | null }[])
    .filter((u) => u.headingAnchor && want.has(`${u.docId}#${u.headingAnchor}`))
    .map((u) => ({ spaceId: u.spaceId, unitKey: u.unitKey }));
}

/** Nghe xong tập → mục đã nghe trọn tính "đã đọc" + ghi phiên đọc (heatmap). */
export async function linkEpisodeCompletedToStudy(episode: PodcastEpisodeRow, minutes: number): Promise<number> {
  const matches = await matchStudyUnits(episode.sections, true);
  if (!matches.length) return 0;
  const userId = await currentUserId();
  const now = Date.now();
  const bySpace = new Map<string, string[]>();
  for (const m of matches) bySpace.set(m.spaceId, [...(bySpace.get(m.spaceId) ?? []), m.unitKey]);
  for (const [spaceId, unitKeys] of bySpace) {
    await supabase.from("study_units").update({ readPct: 100, updatedAt: now }).eq("spaceId", spaceId).in("unitKey", unitKeys).lt("readPct", 100);
    await supabase.from("study_sessions").insert({
      userId, spaceId, activityType: "read", unitKey: unitKeys[0], activeMinutes: Math.max(1, Math.round(minutes)),
      isActiveRecall: false, occurredAt: now,
    });
  }
  return matches.length;
}

/** Trả lời câu hỏi nhớ cuối tập → 1 phiên ôn chủ động (tính streak) + lastActiveAt cho unit. */
export async function linkRecallToStudy(episode: PodcastEpisodeRow, minutes: number): Promise<void> {
  const matches = await matchStudyUnits(episode.sections, false);
  if (!matches.length) return;
  const userId = await currentUserId();
  const now = Date.now();
  const spaces = new Map<string, string[]>();
  for (const m of matches) spaces.set(m.spaceId, [...(spaces.get(m.spaceId) ?? []), m.unitKey]);
  for (const [spaceId, unitKeys] of spaces) {
    await supabase.from("study_sessions").insert({
      userId, spaceId, activityType: "review", unitKey: unitKeys[0], activeMinutes: Math.max(1, Math.round(minutes)),
      isActiveRecall: true, occurredAt: now,
    });
    await supabase.from("study_units").update({ lastActiveAt: now, updatedAt: now }).eq("spaceId", spaceId).in("unitKey", unitKeys);
  }
}

// ─── SỬA DANH SÁCH TẬP ────────────────────────────────────────────────────────
export async function deleteEpisode(episodeId: string): Promise<void> {
  const { error } = await supabase.from("podcast_episodes").delete().eq("_id", episodeId);
  if (error) throw error;
}

/** Gộp tập với tập ngay sau: nối mục, xoá tập sau, tập gộp về "Chưa tạo" (kịch bản cũ bỏ). */
export async function mergeWithNext(episode: PodcastEpisodeRow, next: PodcastEpisodeRow): Promise<void> {
  const now = Date.now();
  await supabase.from("podcast_scripts").delete().eq("episodeId", episode._id);
  scriptCache.delete(episode._id);
  const { error } = await supabase
    .from("podcast_episodes")
    .update({
      sections: [...episode.sections, ...next.sections],
      sourceChars: episode.sourceChars + next.sourceChars,
      status: "draft", keyPointCount: null, coveredCount: null, turnCount: null, scriptChars: null,
      progressIndex: 0, completedAt: null, recallDoneAt: null, error: null, updatedAt: now,
    })
    .eq("_id", episode._id);
  if (error) throw error;
  await deleteEpisode(next._id);
}
