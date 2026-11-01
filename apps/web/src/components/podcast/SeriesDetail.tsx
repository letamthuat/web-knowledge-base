"use client";
// Trang 1 series: "Nghe tiếp" + danh sách tập. Mỗi tập: trạng thái kịch bản, độ phủ ý bắt buộc,
// ghi chú ý chính, đọc kịch bản, mở đoạn gốc, câu hỏi nhớ sau khi nghe, sửa danh sách tập.
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Play, Pause, Loader2, Check, AlertTriangle, ChevronDown, RefreshCw, BookOpenText,
  MoreHorizontal, Trash2, Merge, Pencil, ScrollText, Brain, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePodcastEpisodes, getScript, deleteSeries, deleteEpisode, mergeWithNext, renameEpisode,
  markRecallDone, linkRecallToStudy, type PodcastSeriesRow, type PodcastEpisodeRow, type PodcastScript,
} from "@/lib/api/podcast";
import { useAiSettings } from "@/lib/api/ai-settings";
import { useTts } from "@/lib/tts/player";
import { playEpisode, podcastDocId, episodeContext } from "@/lib/podcast/playback";
import { generateEpisodeScript, missedKeyPoints, minutesFromChars, HOST, EXPERT } from "@/lib/podcast/generate";
import { useOpenDoc } from "@/components/study/SpaceOverview";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { EpisodeSection } from "@/lib/podcast/plan";

const estMinutes = (ep: PodcastEpisodeRow) => (ep.scriptChars ? minutesFromChars(ep.scriptChars) : Math.max(2, Math.round((ep.sourceChars * 1.1) / 1000)));

export function SeriesDetail({ series, onBack }: { series: PodcastSeriesRow; onBack: () => void }) {
  const episodes = usePodcastEpisodes(series._id);
  const ai = useAiSettings();
  const tts = useTts();
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => episodes ?? [], [episodes]);
  const ctx = { episodes: list, seriesId: series._id, seriesTitle: series.title, ai };
  const done = list.filter((e) => e.completedAt).length;
  const next = list.find((e) => !e.completedAt) ?? null;
  const totalMin = list.reduce((s, e) => s + estMinutes(e), 0);

  const play = (ep: PodcastEpisodeRow) => {
    playEpisode(ep, ctx).catch((e) => toast.error(e instanceof Error ? e.message : "Không phát được tập này"));
  };

  async function handleDeleteSeries() {
    if (!window.confirm(`Xoá series "${series.title}"? Tài liệu gốc không bị ảnh hưởng.`)) return;
    await deleteSeries(series._id);
    onBack();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={onBack} aria-label="Về danh sách series"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-xl">{series.emoji ?? "🎙️"}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold leading-tight">{series.title}</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {list.length} tập · ~{totalMin >= 60 ? `${Math.floor(totalMin / 60)}g${String(totalMin % 60).padStart(2, "0")}` : `${totalMin} phút`} · đã nghe {done}/{list.length}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Tuỳ chọn series">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={handleDeleteSeries} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Xoá series
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pb-28">
        {episodes === undefined ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải tập…</div>
        ) : (
          <>
            {next && (
              <NextUp ep={next} no={list.indexOf(next) + 1} playing={tts.docId === podcastDocId(next._id) && tts.playing} onPlay={() => play(next)} />
            )}
            {!ai?.geminiApiKey && (
              <p className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Cần Gemini API key (Cài đặt → AI) để viết kịch bản. Tập đã viết sẵn vẫn nghe được.
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              {list.map((ep, i) => (
                <EpisodeRow
                  key={ep._id}
                  ep={ep}
                  no={i + 1}
                  next={list[i + 1] ?? null}
                  open={openId === ep._id}
                  onToggle={() => setOpenId(openId === ep._id ? null : ep._id)}
                  active={tts.docId === podcastDocId(ep._id)}
                  playing={tts.docId === podcastDocId(ep._id) && tts.playing}
                  onPlay={() => play(ep)}
                  ctx={ctx}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NextUp({ ep, no, playing, onPlay }: { ep: PodcastEpisodeRow; no: number; playing: boolean; onPlay: () => void }) {
  const generating = ep.status === "generating";
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-4">
      <button onClick={onPlay} disabled={generating} aria-label="Nghe tiếp"
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95 disabled:opacity-60">
        {generating ? <Loader2 className="h-6 w-6 animate-spin" /> : playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 translate-x-[2px]" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          {ep.progressIndex > 0 ? "Nghe tiếp" : "Tập kế tiếp"} · Tập {no}
        </div>
        <div className="line-clamp-2 font-display text-[15px] font-semibold leading-snug">{ep.title}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {generating ? "Đang viết kịch bản… (30–60 giây)" : ep.status === "ready" ? `~${estMinutes(ep)} phút` : `~${estMinutes(ep)} phút · bấm để viết kịch bản & nghe`}
        </div>
      </div>
    </div>
  );
}

function CoverageChip({ ep }: { ep: PodcastEpisodeRow }) {
  if (ep.keyPointCount == null || ep.coveredCount == null) return null;
  const full = ep.coveredCount >= ep.keyPointCount;
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${full ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}
      title="Số ý kiến thức bắt buộc được kịch bản trình bày">
      Phủ {ep.coveredCount}/{ep.keyPointCount} ý
    </span>
  );
}

type Ctx = Parameters<typeof playEpisode>[1];

function EpisodeRow({ ep, no, next, open, onToggle, active, playing, onPlay, ctx }: {
  ep: PodcastEpisodeRow; no: number; next: PodcastEpisodeRow | null; open: boolean; onToggle: () => void;
  active: boolean; playing: boolean; onPlay: () => void; ctx: Ctx;
}) {
  const generating = ep.status === "generating";
  const pct = ep.turnCount && ep.progressIndex > 0 && !ep.completedAt ? Math.round((ep.progressIndex / ep.turnCount) * 100) : 0;

  async function regenerate(missed?: string[]) {
    try {
      await generateEpisodeScript({
        episode: ep, seriesTitle: ctx.seriesTitle, ...episodeContext(ep, ctx.episodes), missedPoints: missed,
        geminiApiKey: ctx.ai?.geminiApiKey, geminiModels: ctx.ai?.geminiModels,
      });
      toast.success("Đã viết lại kịch bản");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Viết kịch bản thất bại");
    }
  }

  async function rename() {
    const t = window.prompt("Tên tập", ep.title);
    if (t && t.trim()) await renameEpisode(ep._id, t);
  }
  async function merge() {
    if (!next) return;
    if (!window.confirm(`Gộp với tập ${no + 1} "${next.title}"? Kịch bản sẽ được viết lại.`)) return;
    await mergeWithNext(ep, next);
  }
  async function remove() {
    if (!window.confirm(`Xoá tập "${ep.title}" khỏi series?`)) return;
    await deleteEpisode(ep._id);
  }

  return (
    <div className={`rounded-xl border transition-colors ${active ? "border-primary/40 bg-primary/5" : "border-border/70 bg-card"}`}>
      <div className="flex items-center gap-2.5 p-2.5">
        <button onClick={onPlay} disabled={generating} aria-label={`Nghe tập ${no}`}
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
            ep.completedAt ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-foreground hover:bg-primary hover:text-primary-foreground"
          } ${active ? "!bg-primary !text-primary-foreground" : ""}`}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" />
            : playing ? <Pause className="h-4 w-4" />
            : active ? <Play className="h-4 w-4 translate-x-[1px]" />
            : ep.completedAt ? <Check className="h-4 w-4" />
            : <span className="text-[13px] font-semibold tabular-nums">{no}</span>}
        </button>
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="line-clamp-2 text-[13.5px] font-medium leading-snug">{ep.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>~{estMinutes(ep)} phút</span>
            <span>· {ep.sections.length} mục</span>
            {ep.status === "draft" && <span>· chưa viết kịch bản</span>}
            {generating && <span className="text-primary">· đang viết kịch bản…</span>}
            {ep.status === "error" && <span className="text-destructive">· lỗi — mở để thử lại</span>}
            {pct > 0 && <span className="text-primary">· đang nghe {pct}%</span>}
            <CoverageChip ep={ep} />
            {ep.completedAt && !ep.recallDoneAt && ep.status === "ready" && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">3 câu nhớ</span>}
          </div>
        </button>
        <button onClick={onToggle} aria-label="Chi tiết tập" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <EpisodeDetail ep={ep} onRegenerate={regenerate} onRename={rename} onMerge={next ? merge : undefined} onRemove={remove} />
      )}
    </div>
  );
}

function EpisodeDetail({ ep, onRegenerate, onRename, onMerge, onRemove }: {
  ep: PodcastEpisodeRow;
  onRegenerate: (missed?: string[]) => Promise<void>;
  onRename: () => void;
  onMerge?: () => void;
  onRemove: () => void;
}) {
  const [script, setScript] = useState<PodcastScript | null>(null);
  const [showScript, setShowScript] = useState(false);
  const [busy, setBusy] = useState(false);
  const openDoc = useOpenDoc();

  useEffect(() => {
    let alive = true;
    if (ep.status !== "ready") { setScript(null); return; }
    getScript(ep._id).then((s) => { if (alive) setScript(s); }).catch(() => {});
    return () => { alive = false; };
  }, [ep._id, ep.status, ep.coveredCount, ep.turnCount]);

  const missed = script ? missedKeyPoints(script) : [];
  const covered = useMemo(() => new Set(script?.turns.flatMap((t) => t.c) ?? []), [script]);

  const run = async (missedPts?: string[]) => {
    setBusy(true);
    await onRegenerate(missedPts);
    setBusy(false);
  };

  const openSection = (s: EpisodeSection) => {
    openDoc(s.docId);
    // Reader nghe event này để cuộn tới heading / trang
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("kb:tts-segment", {
        detail: { docId: s.docId, force: true, segment: { headingText: s.headingText ? s.headingText.replace(/[*_`~]/g, "") : undefined, page: s.pageFrom } },
      }));
    }, 900);
  };

  return (
    <div className="space-y-4 border-t border-border/60 px-3 pb-3 pt-3">
      {/* Mục nguồn */}
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nội dung gốc</div>
        <div className="flex flex-col gap-0.5">
          {ep.sections.map((s, i) => (
            <button key={i} onClick={() => openSection(s)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-muted">
              <BookOpenText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{s.title}{s.partLabel ? <span className="text-muted-foreground"> — {s.partLabel}</span> : null}</span>
            </button>
          ))}
        </div>
      </div>

      {ep.status === "error" && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{ep.error ?? "Viết kịch bản thất bại"}</div>
      )}

      {/* Ý chính (show notes) */}
      {script && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ý chính ({script.keyPoints.length})</span>
            <CoverageChip ep={ep} />
          </div>
          <ol className="space-y-1">
            {script.keyPoints.map((k, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed">
                <span className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${covered.has(i) ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/20 text-amber-700 dark:text-amber-300"}`}>
                  {covered.has(i) ? "✓" : "!"}
                </span>
                <span className={covered.has(i) ? "" : "text-amber-700 dark:text-amber-300"}>{k}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {ep.completedAt && script && script.recall.length > 0 && <RecallCard ep={ep} script={script} />}

      {/* Kịch bản */}
      {script && showScript && (
        <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl bg-muted/40 p-3">
          {script.turns.map((t, i) => (
            <p key={i} className="text-[12.5px] leading-relaxed">
              <span className={`font-semibold ${t.s === "host" ? "text-rose-600 dark:text-rose-400" : "text-sky-600 dark:text-sky-400"}`}>
                {t.s === "host" ? HOST.name : EXPERT.name}:
              </span>{" "}{t.t}
            </p>
          ))}
        </div>
      )}

      {/* Hành động */}
      <div className="flex flex-wrap items-center gap-1.5">
        {script && (
          <button onClick={() => setShowScript((v) => !v)} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] hover:bg-muted">
            <ScrollText className="h-3.5 w-3.5" /> {showScript ? "Ẩn kịch bản" : "Đọc kịch bản"}
          </button>
        )}
        {missed.length > 0 && (
          <button onClick={() => run(missed)} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-2.5 py-1.5 text-[12px] text-amber-700 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-300">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Viết lại, bù {missed.length} ý sót
          </button>
        )}
        {(ep.status === "ready" || ep.status === "error" || ep.status === "draft") && (
          <button onClick={() => run()} disabled={busy} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] hover:bg-muted disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {ep.status === "draft" ? "Viết kịch bản" : "Viết lại"}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Sửa tập">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onRename}><Pencil className="mr-2 h-4 w-4" /> Đổi tên</DropdownMenuItem>
            {onMerge && <DropdownMenuItem onClick={onMerge}><Merge className="mr-2 h-4 w-4" /> Gộp với tập sau</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Xoá tập</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** 3 câu nhớ nhanh sau khi nghe — tự chấm Nhớ/Chưa nhớ; xong → phiên ôn chủ động bên Học tập. */
function RecallCard({ ep, script }: { ep: PodcastEpisodeRow; script: PodcastScript }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [grades, setGrades] = useState<Record<number, boolean>>({});
  const [started] = useState(() => Date.now());
  const total = script.recall.length;
  const graded = Object.keys(grades).length;
  const remembered = Object.values(grades).filter(Boolean).length;

  useEffect(() => {
    if (graded !== total || total === 0 || ep.recallDoneAt) return;
    const minutes = (Date.now() - started) / 60000;
    void markRecallDone(ep._id);
    void linkRecallToStudy(ep, minutes).catch(() => {});
    toast.success(`Nhớ ${remembered}/${total} ý`);
  }, [graded, total, remembered, ep, started]);

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-primary">
        <Brain className="h-4 w-4" /> Câu hỏi nhớ nhanh {graded > 0 && <span className="font-normal text-muted-foreground">· nhớ {remembered}/{graded}</span>}
        {ep.recallDoneAt && graded === 0 && <span className="font-normal text-muted-foreground">· đã làm — có thể ôn lại</span>}
      </div>
      <div className="space-y-2.5">
        {script.recall.map((r, i) => (
          <div key={i} className="rounded-lg bg-background/70 p-2.5">
            <div className="text-[13px] font-medium leading-snug">{i + 1}. {r.q}</div>
            {revealed.has(i) ? (
              <>
                <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{r.a}</div>
                {grades[i] === undefined ? (
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={() => setGrades({ ...grades, [i]: true })} className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">Nhớ ✓</button>
                    <button onClick={() => setGrades({ ...grades, [i]: false })} className="rounded-lg bg-muted px-2.5 py-1 text-[12px] font-medium">Chưa nhớ</button>
                  </div>
                ) : (
                  <div className={`mt-1.5 text-[11px] font-semibold ${grades[i] ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{grades[i] ? "Nhớ ✓" : "Chưa nhớ — nghe lại đoạn này"}</div>
                )}
              </>
            ) : (
              <button onClick={() => setRevealed(new Set(revealed).add(i))} className="mt-1.5 text-[12px] font-medium text-primary">Tự trả lời trong đầu rồi xem đáp án →</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
