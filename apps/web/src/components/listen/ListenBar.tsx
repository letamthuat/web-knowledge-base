"use client";
// Thanh Nghe bài — nổi ở đáy, sống ở AppShell nên vẫn còn khi rời reader.
// Chạm tiêu đề → sheet: chọn giọng, tốc độ, nhảy tới mục.
import { useEffect, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, X, Loader2, LocateFixed, RotateCcw, RotateCw } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useActiveTab } from "@/contexts/ActiveTabContext";
import {
  useTts, togglePlay, skipSegment, seekBy, setRate, setVoice, stopListening, jumpToSegment,
  getAudioTime, TTS_RATES, type TtsVoice,
} from "@/lib/tts/player";

const VOICE_LABEL: Record<TtsVoice, string> = {
  Kore: "Giọng nữ",
  Charon: "Giọng nam",
};

function fmt(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Thanh tiến độ đoạn hiện tại — tự re-render mỗi 500ms, không kéo cả thanh. */
function SegmentProgress() {
  const [t, setT] = useState(getAudioTime);
  useEffect(() => {
    const id = setInterval(() => setT(getAudioTime()), 500);
    return () => clearInterval(id);
  }, []);
  const pct = t.duration > 0 ? (t.current / t.duration) * 100 : 0;
  return (
    <div className="absolute inset-x-3 top-0 h-[2px] overflow-hidden rounded-full bg-primary/10">
      <div className="h-full bg-primary transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
    </div>
  );
}

function SheetTime() {
  const [t, setT] = useState(getAudioTime);
  useEffect(() => {
    const id = setInterval(() => setT(getAudioTime()), 500);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{fmt(t.current)} / {fmt(t.duration)}</span>;
}

export function ListenBar() {
  const tts = useTts();
  const { navigate } = useActiveTab();
  const [sheet, setSheet] = useState(false);

  if (!tts.docId) return null;
  const seg = tts.segments[tts.index];
  const ownVoices = tts.segments.some((s) => s.dialogue);
  // Danh sách mục (gộp các đoạn liền nhau cùng tiêu đề)
  const sections = tts.segments
    .map((s, i) => ({ title: s.title, i }))
    .filter((s, k, arr) => k === 0 || arr[k - 1].title !== s.title);

  const goToReading = () => {
    setSheet(false);
    if (tts.href) { navigate(tts.href); return; }
    navigate(`/reader/${tts.docId}`);
    // Reader (markdown/pdf) nghe event này để cuộn tới đoạn đang đọc
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("kb:tts-segment", { detail: { docId: tts.docId, segment: seg, index: tts.index, force: true } }));
    }, 250);
  };

  const nextRate = () => {
    const i = (TTS_RATES as readonly number[]).indexOf(tts.rate);
    setRate(TTS_RATES[(i + 1) % TTS_RATES.length]);
  };

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3"
        style={{ bottom: "calc(var(--safe-bottom, 0px) + 44px)" }}
      >
        <div className="pointer-events-auto relative flex w-full max-w-md items-center gap-1 rounded-2xl border border-border/70 bg-card/95 py-1.5 pl-1.5 pr-1 shadow-lg backdrop-blur-sm sm:backdrop-blur">
          <SegmentProgress />
          <button
            onClick={togglePlay}
            aria-label={tts.playing ? "Tạm dừng" : "Phát"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-95 transition-transform"
          >
            {tts.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : tts.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
          </button>

          <button onClick={() => setSheet(true)} className="min-w-0 flex-1 px-2 text-left">
            <div className="truncate text-[13px] font-semibold leading-tight text-foreground">{seg?.title ?? tts.docTitle}</div>
            <div className={`truncate text-[11px] leading-tight ${tts.error ? "text-destructive" : "text-muted-foreground"}`}>
              {tts.error ?? `${seg?.speaker ? `${seg.speaker} · ` : ""}${tts.index + 1}/${tts.segments.length} · ${tts.docTitle}`}
            </div>
          </button>

          <button onClick={() => skipSegment(-1)} disabled={tts.index === 0} aria-label="Đoạn trước"
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-30 min-[380px]:flex">
            <SkipBack className="h-4 w-4" />
          </button>
          <button onClick={() => skipSegment(1)} disabled={tts.index >= tts.segments.length - 1} aria-label="Đoạn sau"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-30">
            <SkipForward className="h-4 w-4" />
          </button>
          <button onClick={nextRate} aria-label="Tốc độ"
            className="flex h-9 min-w-[2.6rem] shrink-0 items-center justify-center rounded-xl px-1 text-[12px] font-semibold tabular-nums text-muted-foreground hover:bg-muted">
            {tts.rate}×
          </button>
          <button onClick={stopListening} aria-label="Tắt nghe"
            className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Đang nghe" maxHeight="80dvh">
        <div className="flex flex-col gap-5 pb-4">
          <div className="text-center">
            <div className="font-display text-base font-semibold">{seg?.title}</div>
            {seg?.speaker && <div className="mt-0.5 text-xs font-medium text-primary">{seg.speaker} đang nói</div>}
            <div className="mt-0.5 text-xs text-muted-foreground">{tts.docTitle}</div>
            <div className="mt-1 text-xs text-muted-foreground"><SheetTime /></div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button onClick={() => seekBy(-15)} aria-label="Lùi 15 giây" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><RotateCcw className="h-5 w-5" /></button>
            <button onClick={() => skipSegment(-1)} aria-label="Đoạn trước" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><SkipBack className="h-5 w-5" /></button>
            <button onClick={togglePlay} aria-label="Phát/Dừng" className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {tts.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : tts.playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 translate-x-[1px]" />}
            </button>
            <button onClick={() => skipSegment(1)} aria-label="Đoạn sau" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><SkipForward className="h-5 w-5" /></button>
            <button onClick={() => seekBy(15)} aria-label="Tới 15 giây" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><RotateCw className="h-5 w-5" /></button>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tốc độ</div>
            <div className="flex flex-wrap gap-1.5">
              {TTS_RATES.map((r) => (
                <button key={r} onClick={() => setRate(r)}
                  className={`rounded-lg border px-3 py-1.5 text-sm tabular-nums ${tts.rate === r ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border hover:bg-muted"}`}>
                  {r}×
                </button>
              ))}
            </div>
          </div>

          {!ownVoices && <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Giọng đọc</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(VOICE_LABEL) as TtsVoice[]).map((v) => (
                <button key={v} onClick={() => setVoice(v)}
                  className={`rounded-lg border px-3 py-2 text-sm ${tts.voice === v ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border hover:bg-muted"}`}>
                  {VOICE_LABEL[v]}
                </button>
              ))}
            </div>
          </div>}

          <button onClick={goToReading} className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">
            <LocateFixed className="h-4 w-4" /> {tts.href ? "Mở trang tập podcast" : "Tới chỗ đang nghe trong tài liệu"}
          </button>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mục ({sections.length})</div>
            <div className="flex flex-col">
              {sections.map((s) => {
                const active = tts.segments[tts.index]?.title === s.title;
                return (
                  <button key={s.i} onClick={() => jumpToSegment(s.i)}
                    className={`truncate rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}>
                    {s.title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
