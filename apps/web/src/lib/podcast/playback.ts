"use client";
// Podcast — phát 1 tập qua player chung + theo dõi tiến độ (không phụ thuộc component,
// vẫn ghi nhận khi user rời trang Podcast / khoá máy).
import { toast } from "sonner";
import { unlockAudio, startListening, getTtsState, togglePlay } from "@/lib/tts/player";
import {
  getScript, updateEpisodeProgress, markEpisodeCompleted, linkEpisodeCompletedToStudy, touchSeries,
  type PodcastEpisodeRow, type PodcastScript,
} from "@/lib/api/podcast";
import { generateEpisodeScript, scriptToSegments, minutesFromChars } from "./generate";

export const podcastDocId = (episodeId: string) => `podcast:${episodeId}`;

type Ctx = {
  episodes: PodcastEpisodeRow[];      // cả series theo thứ tự (để biết số tập, tập trước/sau)
  seriesId: string;
  seriesTitle: string;
  ai: { geminiApiKey?: string | null; geminiModels?: string[] | null } | null | undefined;
};

/** Thông tin cần cho prompt (vị trí trong series). */
export function episodeContext(ep: PodcastEpisodeRow, episodes: PodcastEpisodeRow[]) {
  const i = episodes.findIndex((e) => e._id === ep._id);
  return {
    episodeNo: i + 1,
    episodeCount: episodes.length,
    prevTitle: i > 0 ? episodes[i - 1].title : undefined,
    nextTitle: i >= 0 && i < episodes.length - 1 ? episodes[i + 1].title : undefined,
  };
}

export async function ensureScript(ep: PodcastEpisodeRow, ctx: Ctx): Promise<PodcastScript> {
  if (ep.status === "ready") {
    const s = await getScript(ep._id);
    if (s) return s;
  }
  return generateEpisodeScript({
    episode: ep, seriesTitle: ctx.seriesTitle, ...episodeContext(ep, ctx.episodes),
    geminiApiKey: ctx.ai?.geminiApiKey, geminiModels: ctx.ai?.geminiModels,
  });
}

// ── Theo dõi tiến độ tập đang phát (1 listener toàn cục) ─────────────────────
let tracked: { ep: PodcastEpisodeRow; lastSaved: number } | null = null;
let listening = false;

function installListeners() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("kb:tts-segment", (e) => {
    const d = (e as CustomEvent<{ docId: string; segment?: { ref?: number } }>).detail;
    if (!tracked || d?.docId !== podcastDocId(tracked.ep._id)) return;
    // Mỗi đoạn ~2 phút → ghi tiến độ (theo lượt thoại đầu đoạn) mỗi lần chuyển đoạn
    const turn = d.segment?.ref ?? 0;
    if (turn !== tracked.lastSaved) {
      tracked.lastSaved = turn;
      void updateEpisodeProgress(tracked.ep._id, turn);
    }
  });
  window.addEventListener("kb:tts-finished", (e) => {
    const d = (e as CustomEvent<{ docId: string }>).detail;
    if (!tracked || d?.docId !== podcastDocId(tracked.ep._id)) return;
    const ep = tracked.ep;
    void (async () => {
      await updateEpisodeProgress(ep._id, 0);
      await markEpisodeCompleted(ep._id);
      const n = await linkEpisodeCompletedToStudy(ep, minutesFromChars(ep.scriptChars ?? ep.sourceChars)).catch(() => 0);
      toast.success(`Xong tập "${ep.title}"${n ? ` · ${n} mục Học tập đã tính là đã đọc` : ""}`, {
        description: "Mở trang tập để trả lời 3 câu nhớ nhanh.",
      });
    })();
  });
}

/** Phát 1 tập. GỌI TRONG onClick (unlock audio đồng bộ cho iOS) — sinh kịch bản nếu chưa có. */
export async function playEpisode(ep: PodcastEpisodeRow, ctx: Ctx): Promise<void> {
  unlockAudio();
  const st = getTtsState();
  if (st.docId === podcastDocId(ep._id)) { togglePlay(); return; }
  installListeners();
  const script = await ensureScript(ep, ctx);
  const segments = scriptToSegments(script, ep.title);
  // Nghe tiếp: đoạn cuối cùng có lượt đầu ≤ lượt đã lưu
  let resumeAt = 0;
  if (!ep.completedAt) segments.forEach((s, i) => { if ((s.ref ?? 0) <= ep.progressIndex) resumeAt = i; });
  tracked = { ep, lastSaved: segments[resumeAt]?.ref ?? 0 };
  startListening({
    docId: podcastDocId(ep._id),
    docTitle: ctx.seriesTitle,
    segments,
    startIndex: resumeAt,
    href: `/podcast/${ctx.seriesId}`,
  });
  void touchSeries(ctx.seriesId);

  // Viết sẵn kịch bản tập kế trong lúc đang nghe (chỉ 1 lần gọi Gemini, chưa tốn Azure)
  const i = ctx.episodes.findIndex((e) => e._id === ep._id);
  const next = ctx.episodes[i + 1];
  if (next && next.status === "draft" && ctx.ai?.geminiApiKey) {
    ensureScript(next, ctx).catch(() => {});
  }
}
