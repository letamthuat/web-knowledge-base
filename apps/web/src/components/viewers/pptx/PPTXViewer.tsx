"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Id } from "@/_generated/dataModel";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, FileText, AlignJustify } from "lucide-react";

interface PPTXViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

const SLIDE_W = 960;
const SLIDE_H = 540;

export function PPTXViewer({ doc, downloadUrl }: PPTXViewerProps) {
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<{
    renderNextSlide: () => void;
    renderPreSlide: () => void;
    renderSingleSlide: (i: number) => void;
  } | null>(null);

  const [slideIndex, setSlideIndex] = useState(0);
  const [slideInput, setSlideInput] = useState("1");
  const [totalSlides, setTotalSlides] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [userScale, setUserScale] = useState<number | null>(null);
  const [readMode, setReadMode] = useState<"page" | "scroll">("page");

  // Store arrayBuffer so we can re-init when switching modes
  const arrayBufferRef = useRef<ArrayBuffer | null>(null);

  const { savePosition, registerJump } = useReaderProgress();
  const { progress } = useReadingProgress(doc._id);
  const restored = useRef(false);

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "slide_index" && previewerRef.current && totalSlides > 0) {
        const i = Math.max(0, Math.min(totalSlides - 1, (pos as { type: "slide_index"; slide: number }).slide));
        if (readMode === "page") {
          previewerRef.current.renderSingleSlide(i);
          setSlideIndex(i);
          setSlideInput(String(i + 1));
        } else {
          scrollToSlide(i);
        }
      }
    });
  }, [registerJump, totalSlides, readMode]);

  const calcFitScale = useCallback(() => {
    const el = slideAreaRef.current;
    if (!el) return 1;
    const w = isFullscreen ? window.innerWidth : el.clientWidth;
    const h = isFullscreen ? window.innerHeight : el.clientHeight;
    const padding = 32;
    return Math.min((w - padding) / SLIDE_W, (h - padding) / SLIDE_H);
  }, [isFullscreen]);

  useEffect(() => {
    if (userScale !== null) return;
    setScale(calcFitScale());
  }, [calcFitScale, userScale]);

  useEffect(() => {
    if (userScale !== null) return;
    const observer = new ResizeObserver(() => setScale(calcFitScale()));
    if (slideAreaRef.current) observer.observe(slideAreaRef.current);
    return () => observer.disconnect();
  }, [calcFitScale, userScale]);

  const resetToFit = useCallback(() => {
    setUserScale(null);
    setScale(calcFitScale());
  }, [calcFitScale]);

  // Init previewer — called on first load and on mode switch
  const initPreviewer = useCallback(async (buf: ArrayBuffer, mode: "page" | "scroll", startSlide: number) => {
    if (!containerRef.current) return;
    setLoading(true);

    try {
      const { init } = await import("pptx-preview");
      containerRef.current.innerHTML = "";

      const previewer = init(containerRef.current, {
        renderer: "canvas",
        width: SLIDE_W,
        height: SLIDE_H,
        mode: mode === "scroll" ? "list" : "slide",
      });
      previewerRef.current = previewer as typeof previewerRef.current;

      const pptx = await (previewer as {
        load: (b: ArrayBuffer) => Promise<{ slides: unknown[] }>;
      }).load(buf);

      setTotalSlides(pptx.slides?.length ?? 0);
      await (previewer as { preview: (b: ArrayBuffer) => Promise<unknown> }).preview(buf);

      // In page mode, jump to the right slide after preview
      if (mode === "page" && startSlide > 0) {
        previewerRef.current?.renderSingleSlide(startSlide);
      }

      setLoading(false);
    } catch {
      setError("Không thể tải file PPTX.");
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(downloadUrl);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        arrayBufferRef.current = buf;
        await initPreviewer(buf, readMode, 0);
      } catch {
        if (!cancelled) setError("Không thể tải file PPTX.");
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadUrl]);

  // Restore slide position
  useEffect(() => {
    if (restored.current || loading || !previewerRef.current || !progress) return;
    if (progress.positionType === "slide_index") {
      try {
        const pos = JSON.parse(progress.positionValue);
        if (typeof pos.slide === "number" && pos.slide >= 0 && pos.slide < totalSlides) {
          previewerRef.current.renderSingleSlide(pos.slide);
          setSlideIndex(pos.slide);
          setSlideInput(String(pos.slide + 1));
        }
      } catch {}
    }
    restored.current = true;
  }, [loading, progress, totalSlides]);

  const goTo = useCallback((index: number) => {
    if (!previewerRef.current || totalSlides === 0) return;
    const i = Math.max(0, Math.min(totalSlides - 1, index));
    previewerRef.current.renderSingleSlide(i);
    setSlideIndex(i);
    setSlideInput(String(i + 1));
    savePosition({ type: "slide_index", slide: i }, totalSlides || undefined);
  }, [totalSlides, savePosition]);

  // Slide refs for scroll mode
  const slideRefs = useRef<(HTMLElement | null)[]>([]);

  const scrollToSlide = useCallback((index: number) => {
    // In list mode, pptx-preview renders slides as children of containerRef
    const container = containerRef.current;
    if (!container) return;
    const slides = container.querySelectorAll("canvas, .slide-wrapper, [class*='slide']");
    if (slides[index]) {
      (slides[index] as HTMLElement).scrollIntoView({ block: "start" });
    }
  }, []);

  // Switch mode
  const prevReadMode = useRef(readMode);
  useEffect(() => {
    if (prevReadMode.current === readMode) return;
    prevReadMode.current = readMode;
    const buf = arrayBufferRef.current;
    if (!buf) return;
    initPreviewer(buf, readMode, readMode === "page" ? slideIndex : 0).then(() => {
      if (readMode === "scroll") {
        setTimeout(() => scrollToSlide(slideIndex), 200);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readMode]);

  const toggleFullscreen = useCallback(async () => {
    if (!slideAreaRef.current) return;
    if (!document.fullscreenElement) {
      await slideAreaRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (userScale !== null) return;
    const timer = setTimeout(() => setScale(calcFitScale()), 150);
    return () => clearTimeout(timer);
  }, [isFullscreen, calcFitScale, userScale]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (readMode === "page") {
        if (e.key === "ArrowLeft") goTo(slideIndex - 1);
        if (e.key === "ArrowRight") goTo(slideIndex + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goTo, slideIndex, readMode]);

  if (error) {
    return <div className="flex flex-1 items-center justify-center text-destructive text-sm">{error}</div>;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-800" style={{ minHeight: 0 }}>
      {/* Toolbar */}
      <div className="shrink-0 border-b bg-card">
        <div className="flex items-center gap-1 px-2 py-1 overflow-x-auto scrollbar-none">
          {/* Page nav */}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => goTo(slideIndex - 1)}
              disabled={readMode === "scroll" || slideIndex <= 0 || loading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              <input
                type="text" inputMode="numeric" value={slideInput}
                disabled={loading || totalSlides === 0}
                onChange={(e) => setSlideInput(e.target.value)}
                onBlur={() => {
                  const n = parseInt(slideInput, 10);
                  if (!isNaN(n)) readMode === "page" ? goTo(n - 1) : scrollToSlide(n - 1);
                  else setSlideInput(String(slideIndex + 1));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const n = parseInt(slideInput, 10);
                    if (!isNaN(n)) readMode === "page" ? goTo(n - 1) : scrollToSlide(n - 1);
                    else setSlideInput(String(slideIndex + 1));
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-10 rounded border border-input bg-background px-1 py-0.5 text-center text-sm tabular-nums disabled:opacity-50"
              />
              <span className="text-sm text-muted-foreground">/ {totalSlides || "—"}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => goTo(slideIndex + 1)}
              disabled={readMode === "scroll" || slideIndex >= totalSlides - 1 || loading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom + toggle + fullscreen */}
          <div className="flex shrink-0 items-center gap-1 ml-auto">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              const next = Math.max(0.1, +((userScale ?? scale) - 0.1).toFixed(1));
              setUserScale(next); setScale(next);
            }}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="hidden sm:inline w-10 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              const next = Math.min(3, +((userScale ?? scale) + 0.1).toFixed(1));
              setUserScale(next); setScale(next);
            }}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetToFit} title="Khớp màn hình">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <div className="h-4 w-px bg-border mx-0.5" />
            {/* Trang / Cuộn toggle */}
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              <button onClick={() => setReadMode("page")}
                className={["flex items-center justify-center h-7 w-7 transition-colors",
                  readMode === "page" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                ].join(" ")} title="Xem từng trang">
                <FileText className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setReadMode("scroll")}
                className={["flex items-center justify-center h-7 w-7 transition-colors",
                  readMode === "scroll" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                ].join(" ")} title="Cuộn liên tục">
                <AlignJustify className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="h-4 w-px bg-border mx-0.5" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Slide area */}
      <div
        ref={slideAreaRef}
        className="flex flex-1 overflow-auto bg-zinc-800 p-4"
        style={{
          minHeight: 0,
          alignItems: readMode === "scroll" ? "flex-start" : "center",
          justifyContent: "center",
          ...(isFullscreen ? {
            background: "#18181b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100vw",
            height: "100vh",
          } : {}),
        }}
      >
        {loading && (
          <div className="absolute z-10 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        <div
          style={{
            width: SLIDE_W,
            transform: `scale(${scale})`,
            transformOrigin: readMode === "scroll" ? "top center" : "center center",
            flexShrink: 0,
          }}
        >
          <div
            ref={containerRef}
            className="overflow-hidden bg-white [&_.pptx-preview-wrapper-next]:hidden [&_.pptx-preview-wrapper-pagination]:hidden"
            style={{ width: SLIDE_W }}
          />
        </div>
      </div>
    </div>
  );
}
