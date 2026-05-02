"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Id } from "@/_generated/dataModel";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface PPTXViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

const SLIDE_W = 960;
const SLIDE_H = 540;

export function PPTXViewer({ doc, downloadUrl }: PPTXViewerProps) {
  // slideAreaRef is the element that goes fullscreen — it wraps only the slide, not the toolbar
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

  const { savePosition, registerJump } = useReaderProgress();
  const { progress } = useReadingProgress(doc._id);
  const restored = useRef(false);

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "slide_index" && previewerRef.current && totalSlides > 0) {
        const i = Math.max(0, Math.min(totalSlides - 1, (pos as { type: "slide_index"; slide: number }).slide));
        previewerRef.current.renderSingleSlide(i);
        setSlideIndex(i);
        setSlideInput(String(i + 1));
      }
    });
  }, [registerJump, totalSlides]);

  const calcFitScale = useCallback(() => {
    const el = slideAreaRef.current;
    if (!el) return 1;
    // In fullscreen, use window dimensions; otherwise use element bounds
    const w = isFullscreen ? window.innerWidth : el.clientWidth;
    const h = isFullscreen ? window.innerHeight : el.clientHeight;
    const padding = 32; // p-4 = 16px each side
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

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(downloadUrl);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled || !containerRef.current) return;

        const { init } = await import("pptx-preview");
        containerRef.current.innerHTML = "";

        const previewer = init(containerRef.current, {
          renderer: "canvas",
          width: SLIDE_W,
          height: SLIDE_H,
          mode: "slide",
        });
        previewerRef.current = previewer as typeof previewerRef.current;

        const pptx = await (previewer as {
          load: (b: ArrayBuffer) => Promise<{ slides: unknown[] }>;
        }).load(arrayBuffer);
        if (cancelled) return;

        setTotalSlides(pptx.slides?.length ?? 0);
        await (previewer as { preview: (b: ArrayBuffer) => Promise<unknown> }).preview(arrayBuffer);

        if (!cancelled) {
          setLoading(false);
        }
      } catch {
        if (!cancelled) setError("Không thể tải file PPTX.");
      }
    })();

    return () => { cancelled = true; };
  }, [downloadUrl]);

  // Restore slide position after preview finishes loading
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

  const toggleFullscreen = useCallback(async () => {
    if (!slideAreaRef.current) return;
    if (!document.fullscreenElement) {
      await slideAreaRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const full = !!document.fullscreenElement;
      setIsFullscreen(full);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // After fullscreen changes, recalculate scale
  useEffect(() => {
    if (userScale !== null) return;
    const timer = setTimeout(() => setScale(calcFitScale()), 150);
    return () => clearTimeout(timer);
  }, [isFullscreen, calcFitScale, userScale]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo(slideIndex - 1);
      if (e.key === "ArrowRight") goTo(slideIndex + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goTo, slideIndex]);

  if (error) {
    return <div className="flex flex-1 items-center justify-center text-destructive text-sm">{error}</div>;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-800">
      {/* Toolbar — always visible, outside fullscreen element */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-1.5">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(slideIndex - 1)} disabled={slideIndex <= 0 || loading}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex items-center gap-1 text-sm tabular-nums">
            <input
              type="text"
              inputMode="numeric"
              value={slideInput}
              disabled={loading || totalSlides === 0}
              onChange={(e) => setSlideInput(e.target.value)}
              onBlur={() => {
                const n = parseInt(slideInput, 10);
                if (!isNaN(n)) goTo(n - 1);
                else setSlideInput(String(slideIndex + 1));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = parseInt(slideInput, 10);
                  if (!isNaN(n)) goTo(n - 1);
                  else setSlideInput(String(slideIndex + 1));
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-12 rounded border border-input bg-background px-1 py-0.5 text-center text-sm disabled:opacity-50"
            />
            / {totalSlides || "—"}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(slideIndex + 1)} disabled={slideIndex >= totalSlides - 1 || loading}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
            const next = Math.max(0.1, +((userScale ?? scale) - 0.1).toFixed(1));
            setUserScale(next); setScale(next);
          }}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-14 text-center text-sm tabular-nums">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
            const next = Math.min(3, +((userScale ?? scale) + 0.1).toFixed(1));
            setUserScale(next); setScale(next);
          }}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetToFit} title="Khớp màn hình">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Slide area — THIS element goes fullscreen */}
      <div
        ref={slideAreaRef}
        className="flex flex-1 items-center justify-center overflow-hidden bg-zinc-800 p-4"
        style={isFullscreen ? {
          background: "#18181b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100vw",
          height: "100vh",
        } : undefined}
      >
        {loading && (
          <div className="absolute z-10 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        <div
          style={{
            width: SLIDE_W,
            height: SLIDE_H,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            flexShrink: 0,
          }}
        >
          <div
            ref={containerRef}
            className="overflow-hidden rounded-lg shadow-2xl bg-white [&_.pptx-preview-wrapper-next]:hidden [&_.pptx-preview-wrapper-pagination]:hidden"
            style={{ width: SLIDE_W, height: SLIDE_H }}
          />
        </div>
      </div>
    </div>
  );
}
