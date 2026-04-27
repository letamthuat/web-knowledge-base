"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Id } from "@/../../../convex/_generated/dataModel";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";

interface EPUBViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

type Theme = "light" | "sepia" | "dark";

const THEMES: Record<Theme, { bg: string; fg: string; label: string }> = {
  light: { bg: "#ffffff", fg: "#1a1a1a", label: "Sáng" },
  sepia: { bg: "#f4ecd8", fg: "#3b2f1e", label: "Sepia" },
  dark:  { bg: "#1a1a1a", fg: "#e8e8e8", label: "Tối" },
};

export function EPUBViewer({ doc, downloadUrl }: EPUBViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<ReturnType<ReturnType<typeof import("epubjs")["default"]>["renderTo"]> | null>(null);
  const bookRef = useRef<ReturnType<typeof import("epubjs")["default"]> | null>(null);

  const [chapterLabel, setChapterLabel] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.7);
  const [theme, setTheme] = useState<Theme>("light");

  const { progress } = useReadingProgress(doc._id);
  const { savePosition, registerJump } = useReaderProgress();

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "epub_cfi" && renditionRef.current) {
        renditionRef.current.display((pos as { type: "epub_cfi"; cfi: string }).cfi).catch(() => {});
      }
    });
  }, [registerJump]);

  // Apply theme + typography to rendition
  const applyTheme = useCallback((
    rendition: NonNullable<typeof renditionRef.current>,
    t: Theme,
    fs: number,
    lh: number,
  ) => {
    const { bg, fg } = THEMES[t];
    rendition.themes.default({
      body: {
        background: bg,
        color: fg,
        "font-size": `${fs}px`,
        "line-height": String(lh),
        "max-width": "680px",
        margin: "0 auto",
        padding: "2rem 1.5rem",
      },
    });
  }, []);

  useEffect(() => {
    if (!viewerRef.current) return;
    let cancelled = false;

    (async () => {
      const ePub = (await import("epubjs")).default;
      if (cancelled) return;

      const book = ePub(downloadUrl);
      bookRef.current = book;

      const rendition = book.renderTo(viewerRef.current!, {
        width: "100%",
        height: "100%",
        spread: "none",
        flow: "scrolled-doc",
      });
      renditionRef.current = rendition;

      applyTheme(rendition, theme, fontSize, lineHeight);

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
  }, [downloadUrl]);

  // Re-apply theme when settings change (without reloading book)
  useEffect(() => {
    if (renditionRef.current) applyTheme(renditionRef.current, theme, fontSize, lineHeight);
  }, [theme, fontSize, lineHeight, applyTheme]);

  const prev = useCallback(() => renditionRef.current?.prev(), []);
  const next = useCallback(() => renditionRef.current?.next(), []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prev, next]);

  const { bg } = THEMES[theme];

  if (loadError) {
    return <div className="flex flex-1 items-center justify-center text-destructive text-sm">{loadError}</div>;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: bg }}>
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 truncate text-center text-sm text-muted-foreground">{chapterLabel}</span>
        <div className="flex items-center gap-1">
          <Button
            variant={showSettings ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSettings((v) => !v)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="shrink-0 border-b bg-card px-4 py-3 flex flex-wrap items-center gap-6">
          {/* Theme */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Theme</span>
            {(Object.keys(THEMES) as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{ background: THEMES[t].bg, color: THEMES[t].fg, border: theme === t ? "2px solid hsl(var(--primary))" : "1px solid hsl(var(--border))" }}
                className="rounded px-2.5 py-1 text-xs font-medium transition-all"
              >
                {THEMES[t].label}
              </button>
            ))}
          </div>

          {/* Font size */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Cỡ chữ</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFontSize((s) => Math.max(12, s - 1))}>
              <span className="text-xs">A-</span>
            </Button>
            <span className="w-8 text-center text-xs tabular-nums">{fontSize}px</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFontSize((s) => Math.min(28, s + 1))}>
              <span className="text-xs">A+</span>
            </Button>
          </div>

          {/* Line height */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Dòng</span>
            {[1.4, 1.7, 2.0].map((lh) => (
              <button
                key={lh}
                onClick={() => setLineHeight(lh)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${lineHeight === lh ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {lh}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* EPUB render target */}
      <div ref={viewerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
