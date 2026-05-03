"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Id } from "@/_generated/dataModel";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppTypography } from "@/components/AppSettingsPanel";

interface EPUBViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

type FlowMode = "scrolled-doc" | "paginated";

const THEME_COLORS: Record<string, { bg: string; fg: string }> = {
  light: { bg: "#ffffff", fg: "#1a1a1a" },
  sepia: { bg: "#f4ecd8", fg: "#3b2f1e" },
  dark:  { bg: "#1a1a1a", fg: "#e8e8e8" },
};

export function EPUBViewer({ doc, downloadUrl }: EPUBViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<ReturnType<ReturnType<typeof import("epubjs")["default"]>["renderTo"]> | null>(null);
  const bookRef = useRef<ReturnType<typeof import("epubjs")["default"]> | null>(null);

  const [chapterLabel, setChapterLabel] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flow, setFlow] = useState<FlowMode>(() =>
    typeof window !== "undefined" && localStorage.getItem("epub-flow") === "paginated"
      ? "paginated"
      : "scrolled-doc"
  );

  const typography = useAppTypography();
  const { progress } = useReadingProgress(doc._id);
  const { savePosition, registerJump } = useReaderProgress();

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "epub_cfi" && renditionRef.current) {
        renditionRef.current.display((pos as { type: "epub_cfi"; cfi: string }).cfi).catch(() => {});
      }
    });
  }, [registerJump]);

  const applyStyles = useCallback((
    rendition: NonNullable<typeof renditionRef.current>,
    theme: string,
    fs: number,
    lh: number,
  ) => {
    const colors = THEME_COLORS[theme] ?? THEME_COLORS.light;
    rendition.themes.default({
      body: {
        background: colors.bg,
        color: colors.fg,
        "font-size": `${fs}px`,
        "line-height": String(lh),
        "max-width": "680px",
        margin: "0 auto",
        padding: "2rem 1.5rem",
      },
    });
  }, []);

  // Re-init when flow changes (epubjs requires full re-render for flow change)
  useEffect(() => {
    if (!viewerRef.current) return;
    let cancelled = false;

    (async () => {
      // Destroy existing
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current = null;

      const ePub = (await import("epubjs")).default;
      if (cancelled) return;

      const book = ePub(downloadUrl);
      bookRef.current = book;

      const renditionOptions: Record<string, unknown> = {
        width: "100%",
        height: "100%",
        spread: "none",
        flow,
      };

      const rendition = book.renderTo(viewerRef.current!, renditionOptions);
      renditionRef.current = rendition;

      applyStyles(rendition, typography.theme, typography.fontSize, typography.lineHeight);

      const startCfi =
        progress?.positionType === "epub_cfi"
          ? (() => { try { return JSON.parse(progress.positionValue).cfi; } catch { return undefined; } })()
          : undefined;

      await rendition.display(startCfi);

      rendition.on("relocated", (location: { start: { cfi: string } }) => {
        const cfi = location.start.cfi;
        savePosition({ type: "epub_cfi", cfi });
        book.loaded.navigation.then((nav) => {
          const match = nav.toc.find((item) =>
            book.canonical(item.href) === book.canonical(location.start.cfi)
          );
          setChapterLabel(match?.label?.trim() ?? "");
        });
      });

      book.ready.catch(() => {
        if (!cancelled) setLoadError("Không thể tải EPUB.");
      });
    })();

    return () => {
      cancelled = true;
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadUrl, flow]);

  // Re-apply styles when global typography changes (without reloading book)
  useEffect(() => {
    if (renditionRef.current) {
      applyStyles(renditionRef.current, typography.theme, typography.fontSize, typography.lineHeight);
    }
  }, [typography.theme, typography.fontSize, typography.lineHeight, applyStyles]);

  const prev = useCallback(() => renditionRef.current?.prev(), []);
  const next = useCallback(() => renditionRef.current?.next(), []);

  // Keyboard ←/→
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prev, next]);

  // Touch swipe
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (dy > 30) return;
    if (dx < -50) next();
    else if (dx > 50) prev();
  }, [prev, next]);

  function toggleFlow() {
    const next: FlowMode = flow === "scrolled-doc" ? "paginated" : "scrolled-doc";
    localStorage.setItem("epub-flow", next);
    setFlow(next);
  }

  const bgColor = (THEME_COLORS[typography.theme] ?? THEME_COLORS.light).bg;

  if (loadError) {
    return <div className="flex flex-1 items-center justify-center text-destructive text-sm">{loadError}</div>;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: bgColor }}>
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-1.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 truncate text-center text-sm text-muted-foreground">{chapterLabel}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleFlow}
            className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${flow === "paginated" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            {flow === "paginated" ? "Trang" : "Cuộn"}
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={next}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* EPUB render target */}
      <div
        ref={viewerRef}
        className="flex-1 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
    </div>
  );
}
