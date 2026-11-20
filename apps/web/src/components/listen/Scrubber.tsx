"use client";
// Thanh tiến độ kéo được cho Nghe bài / Podcast — tính trên CẢ bài/tập (xem getTimeline trong player).
// Kéo chỉ xem trước vị trí; thả tay mới nhảy (tránh tải audio liên tục khi rê).
import { useEffect, useRef, useState } from "react";
import { getTimeline, seekTo, type Timeline } from "@/lib/tts/player";

export function fmtTime(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "0:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** Dòng thời gian cập nhật định kỳ (chỉ component dùng nó re-render). */
export function useTimeline(intervalMs = 500): Timeline {
  const [t, setT] = useState(getTimeline);
  useEffect(() => {
    setT(getTimeline());
    const id = setInterval(() => setT(getTimeline()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}

type Props = {
  variant: "mini" | "full";
  /** Mốc (giây) vẽ vạch chia — vd đầu mỗi mục. */
  markers?: number[];
};

export function Scrubber({ variant, markers }: Props) {
  const t = useTimeline(variant === "full" ? 250 : 500);
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null); // giây đang rê tới
  const dragRef = useRef<number | null>(null);
  const total = t.total;
  const shown = drag ?? t.current;
  const pct = total > 0 ? Math.min(100, (shown / total) * 100) : 0;

  const secAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * total;
  };
  const setD = (v: number | null) => { dragRef.current = v; setDrag(v); };

  const onPointerDown = (e: React.PointerEvent) => {
    if (total <= 0 || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setD(secAt(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current == null) return;
    setD(secAt(e.clientX));
  };
  const finish = (commit: boolean) => {
    const v = dragRef.current;
    setD(null);
    if (commit && v != null) seekTo(v);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: -5, ArrowRight: 5, ArrowDown: -5, ArrowUp: 5, PageDown: -30, PageUp: 30 }[e.key];
    if (step != null) { e.preventDefault(); seekTo(t.current + step); }
    else if (e.key === "Home") { e.preventDefault(); seekTo(0); }
    else if (e.key === "End") { e.preventDefault(); seekTo(total - 1); }
  };

  const dragging = drag != null;
  const approx = t.exact ? "" : "~";
  const slider = {
    role: "slider" as const,
    tabIndex: 0,
    "aria-label": "Tiến độ nghe",
    "aria-valuemin": 0,
    "aria-valuemax": Math.round(total),
    "aria-valuenow": Math.round(shown),
    "aria-valuetext": `${fmtTime(shown)} / ${approx}${fmtTime(total)}`,
    onPointerDown,
    onPointerMove,
    onPointerUp: () => finish(true),
    onPointerCancel: () => finish(false),
    onLostPointerCapture: () => { if (dragRef.current != null) finish(true); },
    onKeyDown,
  };

  const ticks = (markers ?? []).filter((m) => m > 0 && m < total).map((m) => (m / total) * 100);

  if (variant === "mini") {
    // Vùng chạm cao 18px nằm đè mép trên thẻ; vạch hiển thị chỉ 3px, dày lên khi rê / kéo.
    return (
      <div {...slider}
        className="group absolute inset-x-3 -top-[8px] z-10 h-[18px] cursor-pointer touch-none select-none outline-none">
        <div ref={trackRef}
          className={`absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-primary/15 transition-[height] duration-150 ${dragging ? "h-[6px]" : "h-[3px] group-hover:h-[5px] group-focus-visible:h-[5px]"}`}>
          <div className={`h-full rounded-full bg-primary ${dragging ? "" : "transition-[width] duration-500 ease-linear"}`} style={{ width: `${pct}%` }} />
        </div>
        <div
          className={`pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow transition-opacity ${dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}
          style={{ left: `${pct}%` }}
        />
        {dragging && (
          <div className="pointer-events-none absolute bottom-full mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-background shadow"
            style={{ left: `clamp(2.25rem, ${pct}%, calc(100% - 2.25rem))` }}>
            {fmtTime(shown)} / {approx}{fmtTime(total)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div {...slider} className="group relative -mx-1 cursor-pointer touch-none select-none rounded-full px-1 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <div ref={trackRef} className="relative h-1.5 rounded-full bg-muted">
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
          {ticks.map((p, i) => (
            <span key={i} className="absolute top-0 h-full w-[3px] -translate-x-1/2 bg-card" style={{ left: `${p}%` }} />
          ))}
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-md ring-4 ring-primary/15 transition-[width,height] duration-150 ${dragging ? "h-5 w-5" : "h-3.5 w-3.5 group-hover:h-4 group-hover:w-4"}`}
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
      <div className="mt-0.5 flex justify-between text-[11.5px] font-medium tabular-nums text-muted-foreground">
        <span className={dragging ? "text-primary" : ""}>{fmtTime(shown)}</span>
        <span title={t.exact ? undefined : "Ước lượng — chính xác dần khi nghe"}>−{approx}{fmtTime(Math.max(0, total - shown))}</span>
      </div>
    </div>
  );
}
