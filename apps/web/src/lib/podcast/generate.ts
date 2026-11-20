"use client";
// Podcast — sinh kịch bản 1 tập (on-demand) + đổi kịch bản thành đoạn nghe 2 giọng.
import { getDownloadUrl } from "@/lib/api/documents";
import { getPdfReflow } from "@/lib/pdf/reflow";
import { saveScript, setEpisodeStatus, type PodcastEpisodeRow, type PodcastScript } from "@/lib/api/podcast";
import { sliceMarkdownSection, slicePdfSection, type EpisodeSection } from "./plan";
import type { SpeechSegment } from "@/lib/tts/speechText";

// Giọng do route /api/tts gán theo vai (host = nữ, expert = nam) — ở đây chỉ cần tên hiển thị.
export const HOST = { name: "My" } as const;
export const EXPERT = { name: "Minh" } as const;

const FIRST_CHUNK_CHARS = 900;  // đoạn đầu ngắn → tiếng nói cất lên sau ~8 giây
const CHUNK_CHARS = 2000;       // đoạn sau dài hơn → ít request (quota Free tier)

const mdCache = new Map<string, Promise<string>>();
function fetchMarkdown(docId: string): Promise<string> {
  const hit = mdCache.get(docId);
  if (hit) return hit;
  const p = getDownloadUrl(docId).then(async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Không tải được tài liệu nguồn");
    return res.text();
  });
  p.catch(() => mdCache.delete(docId));
  mdCache.set(docId, p);
  return p;
}

async function sectionText(s: EpisodeSection): Promise<string> {
  if (s.pageFrom != null) {
    const pages = await getPdfReflow(s.docId, await getDownloadUrl(s.docId));
    return slicePdfSection(pages, s);
  }
  return sliceMarkdownSection(await fetchMarkdown(s.docId), s);
}

/** Text nguồn của tập — mỗi mục có tiêu đề để Gemini biết ranh giới. */
export async function episodeSourceText(episode: PodcastEpisodeRow): Promise<string> {
  const parts = await Promise.all(episode.sections.map(async (s) => {
    const body = (await sectionText(s)).trim();
    return body ? `### [${s.title}${s.partLabel ? ` — ${s.partLabel}` : ""}]\n${body}` : "";
  }));
  return parts.filter(Boolean).join("\n\n");
}

const inflight = new Map<string, Promise<PodcastScript>>();

// Route /api/podcast/script chạy tối đa 300s. Quá mốc này mà tập vẫn "generating" thì chắc chắn
// lượt viết đã chết (đóng tab, reload, mất mạng…) — coi như lỗi để user viết lại được.
const CLIENT_TIMEOUT_MS = 320_000;
export const STALE_GENERATING_MS = 6 * 60_000;

/** Tập đang thật sự được viết (trong tab này, hoặc ở nơi khác nhưng chưa quá hạn). */
export function isGenerating(ep: { _id: string; status: string; updatedAt: number }, now = Date.now()): boolean {
  if (ep.status !== "generating") return false;
  return inflight.has(ep._id) || now - ep.updatedAt < STALE_GENERATING_MS;
}

/** Tập kẹt ở "generating" (lượt viết trước bị gián đoạn). */
export function isStuck(ep: { _id: string; status: string; updatedAt: number }, now = Date.now()): boolean {
  return ep.status === "generating" && !isGenerating(ep, now);
}

/** Sinh (hoặc tạo lại) kịch bản 1 tập. missedPoints = ý bị sót lần trước để bù. */
export function generateEpisodeScript(input: {
  episode: PodcastEpisodeRow;
  seriesTitle: string;
  episodeNo: number;
  episodeCount: number;
  prevTitle?: string;
  nextTitle?: string;
  missedPoints?: string[];
  geminiApiKey?: string | null;
  geminiModels?: string[] | null;
}): Promise<PodcastScript> {
  const id = input.episode._id;
  const hit = inflight.get(id);
  if (hit) return hit;
  const p = (async () => {
    await setEpisodeStatus(id, "generating");
    try {
      const sourceText = await episodeSourceText(input.episode);
      if (sourceText.length < 200) throw new Error("Không lấy được nội dung nguồn (tài liệu đã đổi hoặc bị xoá?)");
      const res = await fetch("/api/podcast/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
        body: JSON.stringify({
          sourceText,
          episodeTitle: input.episode.title,
          seriesTitle: input.seriesTitle,
          episodeNo: input.episodeNo,
          episodeCount: input.episodeCount,
          prevTitle: input.prevTitle,
          nextTitle: input.nextTitle,
          missedPoints: input.missedPoints,
          geminiApiKey: input.geminiApiKey ?? undefined,
          geminiModels: input.geminiModels ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { script?: PodcastScript; coveredCount?: number; model?: string; error?: string };
      if (!res.ok || !data.script) {
        throw new Error(data.error ?? (res.status === 504 ? "Máy chủ quá thời gian khi viết kịch bản — thử lại, hoặc gộp/tách tập ngắn hơn" : `Lỗi ${res.status}`));
      }
      await saveScript(id, data.script, data.model ?? "", data.coveredCount ?? 0);
      return data.script;
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      const msg = timeout ? "Quá thời gian chờ viết kịch bản — bấm Viết lại" : e instanceof Error ? e.message : "Sinh kịch bản thất bại";
      await setEpisodeStatus(id, "error", msg.slice(0, 300)).catch(() => {});
      throw new Error(msg);
    }
  })();
  inflight.set(id, p);
  p.finally(() => inflight.delete(id)).catch(() => {});
  return p;
}

/** Ý bắt buộc chưa lượt thoại nào phủ. */
export function missedKeyPoints(script: PodcastScript): string[] {
  const covered = new Set(script.turns.flatMap((t) => t.c));
  return script.keyPoints.filter((_, i) => !covered.has(i));
}

/**
 * Kịch bản → đoạn nghe. Mỗi đoạn = vài lượt thoại liền nhau, đọc 2 giọng trong 1 lần gọi TTS.
 * ref = chỉ số lượt thoại đầu của đoạn (lưu tiến độ theo lượt, không phụ thuộc cách gom).
 */
export function scriptToSegments(script: PodcastScript, title: string): SpeechSegment[] {
  const out: SpeechSegment[] = [];
  let cur: { speaker: "host" | "expert"; text: string }[] = [];
  let curLen = 0;
  let curRef = 0;
  const flush = () => {
    if (!cur.length) return;
    out.push({
      title,
      text: cur.map((d) => `${d.speaker === "host" ? HOST.name : EXPERT.name}: ${d.text}`).join("\n"),
      dialogue: cur,
      speaker: `${HOST.name} & ${EXPERT.name}`,
      ref: curRef,
    });
    cur = [];
    curLen = 0;
  };
  script.turns.forEach((t, i) => {
    const limit = out.length === 0 ? FIRST_CHUNK_CHARS : CHUNK_CHARS;
    // Lượt rất dài (hiếm) → cắt ở ranh giới câu
    const pieces = t.t.length <= CHUNK_CHARS ? [t.t] : (t.t.match(/[^.!?…]+[.!?…]*\s*/g) ?? [t.t]).reduce<string[]>((acc, s) => {
      if (acc.length && (acc[acc.length - 1] + s).length <= CHUNK_CHARS) acc[acc.length - 1] += s;
      else acc.push(s);
      return acc;
    }, []);
    for (const p of pieces) {
      if (cur.length && curLen + p.length > limit) flush();
      if (!cur.length) curRef = i;
      cur.push({ speaker: t.s, text: p.trim() });
      curLen += p.length;
    }
  });
  flush();
  return out;
}

/** Ước lượng phút nghe từ số ký tự kịch bản (Gemini TTS đo được ~1060 ký tự/phút ở 1×). */
export const minutesFromChars = (chars: number) => Math.max(1, Math.round(chars / 1000));
