"use client";
// Thanh Nghe bài — nổi ở đáy, sống ở AppShell nên vẫn còn khi rời reader.
// Kéo vạch tiến độ ở mép trên để tua; chạm tiêu đề → sheet: tua, tốc độ, giọng, nhảy tới mục.
import { useState } from "react";
import { Pause, Play, SkipBack, SkipForward, X, Loader2, LocateFixed, RotateCcw, RotateCw, Mic, Headphones, AlertTriangle } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useActiveTab } from "@/contexts/ActiveTabContext";
import {
  useTts, togglePlay, skipSegment, seekBy, setRate, setVoice, stopListening, jumpToSegment,
  TTS_RATES, type TtsVoice,
} from "@/lib/tts/player";
import { Scrubber, useTimeline, fmtTime } from "./Scrubber";

const VOICE_LABEL: Record<TtsVoice, string> = {
  Kore: "Giọng nữ",
  Charon: "Giọng nam",
};

/** 3 vạch nhún khi đang phát, đứng yên khi tạm dừng. */
function Equalizer({ playing, className = "" }: { playing: boolean; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex h-3 items-end gap-[2px] ${playing ? "" : "eq-paused"} ${className}`}>
      <span className="eq-bar h-full w-[3px] rounded-full bg-current" />
      <span className="eq-bar h-full w-[3px] rounded-full bg-current" />
      <span className="eq-bar h-full w-[3px] rounded-full bg-current" />
    </span>
  );
}

/** Nút tua có số giây in trong icon. */
function JumpButton({ sec, onClick }: { sec: number; onClick: () => void }) {
  const Icon = sec < 0 ? RotateCcw : RotateCw;
  return (
    <button onClick={onClick} aria-label={sec < 0 ? `Lùi ${-sec} giây` : `Tới ${sec} giây`}
      className="relative flex h-12 w-12 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-muted active:scale-95">
      <Icon className="h-[26px] w-[26px]" strokeWidth={1.75} />
      <span className="absolute pt-[2px] text-[9px] font-bold tabular-nums">{Math.abs(sec)}</span>
    </button>
  );
}

function Segmented<T extends string | number>({ options, value, onChange, label }: {
  options: readonly T[]; value: T; onChange: (v: T) => void; label: (v: T) => string;
}) {
  return (
    <div className="flex gap-0.5 rounded-xl bg-muted/70 p-1">
      {options.map((o) => {
        const on = o === value;
        return (
          <button key={String(o)} onClick={() => onChange(o)} aria-pressed={on}
            className={`min-w-0 flex-1 rounded-lg px-1 py-1.5 text-[12.5px] tabular-nums transition-all ${on ? "bg-card font-semibold text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {label(o)}
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}

/** Nội dung sheet "Đang nghe" — tách riêng để dòng thời gian chỉ re-render khi sheet mở. */
function NowPlaying({ onGoTo }: { onGoTo: () => void }) {
  const tts = useTts();
  const tl = useTimeline(1000);
  const seg = tts.segments[tts.index];
  const isPodcast = !!tts.href;
  const ownVoices = tts.segments.some((s) => s.dialogue);
  // Mục = các đoạn liền nhau cùng tiêu đề
  const sections = tts.segments
    .map((s, i) => ({ title: s.title, i }))
    .filter((s, k, arr) => k === 0 || arr[k - 1].title !== s.title);
  const activeSection = sections.reduce((acc, s, k) => (s.i <= tts.index ? k : acc), 0);
  const markers = sections.length > 1 ? sections.slice(1).map((s) => tl.starts[s.i] ?? 0) : undefined;

  return (
    <div className="flex flex-col gap-6 px-5 pb-6 pt-1">
      {/* Đang phát */}
      <div className="flex items-center gap-4">
        <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25">
          {isPodcast ? <Mic className="h-8 w-8" strokeWidth={1.75} /> : <Headphones className="h-8 w-8" strokeWidth={1.75} />}
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/20 px-1 py-0.5 text-primary-foreground backdrop-blur-sm">
            <Equalizer playing={tts.playing} className="h-2.5" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 font-display text-[17px] font-semibold leading-snug">{seg?.title ?? tts.docTitle}</div>
          <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{tts.docTitle}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            {seg?.speaker && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{seg.speaker}</span>
            )}
            <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums text-muted-foreground">Đoạn {tts.index + 1}/{tts.segments.length}</span>
          </div>
        </div>
      </div>

      {tts.error && (
        <div className="-mt-2 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{tts.error} — bấm phát để thử lại.</span>
        </div>
      )}

      {/* Tiến độ + điều khiển */}
      <div>
        <Scrubber variant="full" markers={markers} />
        <div className="mt-2 flex items-center justify-between px-1">
          <button onClick={() => skipSegment(-1)} disabled={tts.index === 0} aria-label="Đoạn trước"
            className="flex h-11 w-11 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted disabled:opacity-30">
            <SkipBack className="h-5 w-5" fill="currentColor" />
          </button>
          <JumpButton sec={-15} onClick={() => seekBy(-15)} />
          <button onClick={togglePlay} aria-label={tts.playing ? "Tạm dừng" : "Phát"}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95">
            {tts.loading ? <Loader2 className="h-7 w-7 animate-spin" />
              : tts.playing ? <Pause className="h-7 w-7" fill="currentColor" />
              : <Play className="h-7 w-7 translate-x-[2px]" fill="currentColor" />}
          </button>
          <JumpButton sec={15} onClick={() => seekBy(15)} />
          <button onClick={() => skipSegment(1)} disabled={tts.index >= tts.segments.length - 1} aria-label="Đoạn sau"
            className="flex h-11 w-11 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted disabled:opacity-30">
            <SkipForward className="h-5 w-5" fill="currentColor" />
          </button>
        </div>
      </div>

      {/* Tốc độ + giọng */}
      <div className="space-y-4">
        <div>
          <SectionLabel>Tốc độ</SectionLabel>
          <Segmented options={TTS_RATES} value={tts.rate as (typeof TTS_RATES)[number]} onChange={setRate} label={(r) => `${r}×`} />
        </div>
        {!ownVoices && (
          <div>
            <SectionLabel>Giọng đọc</SectionLabel>
            <Segmented options={Object.keys(VOICE_LABEL) as TtsVoice[]} value={tts.voice} onChange={setVoice} label={(v) => VOICE_LABEL[v]} />
          </div>
        )}
      </div>

      <button onClick={onGoTo}
        className="flex items-center justify-center gap-2 rounded-xl border border-border/80 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-muted">
        <LocateFixed className="h-4 w-4 text-primary" /> {isPodcast ? "Mở trang tập podcast" : "Tới chỗ đang nghe trong tài liệu"}
      </button>

      {sections.length > 1 && (
        <div>
          <SectionLabel>Mục ({sections.length})</SectionLabel>
          <div className="-mx-2 flex flex-col">
            {sections.map((s, k) => {
              const active = k === activeSection;
              const done = k < activeSection;
              return (
                <button key={s.i} onClick={() => jumpToSegment(s.i)}
                  className={`flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${active ? "bg-primary/10" : "hover:bg-muted"}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold tabular-nums ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {active ? <Equalizer playing={tts.playing} className="h-2.5 [&>span]:w-[2px]" /> : k + 1}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[13.5px] ${active ? "font-semibold text-primary" : done ? "text-muted-foreground" : ""}`}>{s.title}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmtTime(tl.starts[s.i] ?? 0)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ListenBar() {
  const tts = useTts();
  const { navigate } = useActiveTab();
  const [sheet, setSheet] = useState(false);

  if (!tts.docId) return null;
  const seg = tts.segments[tts.index];

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
        <div className="pointer-events-auto relative flex w-full max-w-md items-center gap-1 rounded-2xl border border-border/70 bg-card/95 py-2 pl-2 pr-1 shadow-lg backdrop-blur-sm sm:backdrop-blur">
          <Scrubber variant="mini" />
          <button
            onClick={togglePlay}
            aria-label={tts.playing ? "Tạm dừng" : "Phát"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform active:scale-95"
          >
            {tts.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : tts.playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />}
          </button>

          <button onClick={() => setSheet(true)} className="min-w-0 flex-1 px-2 text-left">
            <div className="truncate text-[13px] font-semibold leading-tight text-foreground">{seg?.title ?? tts.docTitle}</div>
            <div className={`mt-0.5 flex items-center gap-1.5 truncate text-[11px] leading-tight ${tts.error ? "text-destructive" : "text-muted-foreground"}`}>
              {!tts.error && tts.playing && <Equalizer playing className="h-2.5 shrink-0 text-primary [&>span]:w-[2px]" />}
              <span className="truncate">{tts.error ?? `${seg?.speaker ? `${seg.speaker} · ` : ""}${tts.index + 1}/${tts.segments.length} · ${tts.docTitle}`}</span>
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

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Đang nghe" maxHeight="85dvh">
        <NowPlaying onGoTo={goToReading} />
      </BottomSheet>
    </>
  );
}
