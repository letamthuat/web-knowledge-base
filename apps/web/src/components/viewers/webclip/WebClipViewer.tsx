"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Id } from "@/_generated/dataModel";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { Button } from "@/components/ui/button";
import { FileText, Globe, Highlighter, StickyNote } from "lucide-react";
import { ZoomControls, useZoom } from "@/components/viewers/ZoomControls";
import { useHighlightActions } from "@/hooks/useHighlightActions";
import { AnnotationOverlay, AnnotationSidebar } from "@/components/viewers/AnnotationOverlay";
import { NotesSidePanel } from "@/components/notes/NotesSidePanel";

interface WebClipViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

type ViewMode = "clean" | "raw";

export function WebClipViewer({ doc, downloadUrl }: WebClipViewerProps) {
  const [cleanHtml, setCleanHtml] = useState<string | null>(null);
  const [rawHtml, setRawHtml] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("clean");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { savePosition, registerJump } = useReaderProgress();
  const { progress } = useReadingProgress(doc._id);
  const { scale, zoomIn, zoomOut, reset: resetZoom } = useZoom(1, 0.1, 0.5, 2);
  const restored = useRef(false);
  const actions = useHighlightActions(doc._id, contentRef);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "scroll_pct" && scrollRef.current) {
        const el = scrollRef.current;
        const pct = (pos as { type: "scroll_pct"; pct: number }).pct;
        requestAnimationFrame(() => {
          el.scrollTop = pct * (el.scrollHeight - el.clientHeight);
        });
      }
    });
  }, [registerJump]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(downloadUrl);
        const html = await res.text();
        setRawHtml(html);

        // Parse với Readability client-side
        const { Readability } = await import("@mozilla/readability");
        const parser = new DOMParser();
        const dom = parser.parseFromString(html, "text/html");
        // Fix relative URLs
        const base = dom.querySelector("base") ?? dom.createElement("base");
        if (!dom.querySelector("base")) {
          base.setAttribute("href", downloadUrl);
          dom.head.prepend(base);
        }
        const reader = new Readability(dom, { charThreshold: 0 });
        const article = reader.parse();
        setCleanHtml(article?.content ?? null);
      } catch {
        setError("Không thể tải web clip.");
      }
    })();
  }, [downloadUrl]);

  // Restore scroll position after clean content renders
  useEffect(() => {
    if (restored.current || !cleanHtml || !scrollRef.current || !progress) return;
    if (progress.positionType === "scroll_pct") {
      try {
        const pos = JSON.parse(progress.positionValue);
        if (typeof pos.pct === "number") {
          const el = scrollRef.current;
          requestAnimationFrame(() => {
            el.scrollTop = pos.pct * (el.scrollHeight - el.clientHeight);
          });
        }
      } catch {}
    }
    restored.current = true;
  }, [cleanHtml, progress]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const pct = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
      savePosition({ type: "scroll_pct", pct: Math.min(1, Math.max(0, pct)) });
    },
    [savePosition]
  );

  if (error) {
    return <div className="flex flex-1 items-center justify-center text-destructive text-sm">{error}</div>;
  }
  const hlCount = actions.highlights.length;

  if (cleanHtml === null && rawHtml === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-1.5">
        <div className="flex items-center gap-2">
          <Button variant={mode === "clean" ? "secondary" : "ghost"} size="sm" className="gap-1.5" onClick={() => setMode("clean")} disabled={!cleanHtml}>
            <FileText className="h-3.5 w-3.5" />Bản sạch
          </Button>
          <Button variant={mode === "raw" ? "secondary" : "ghost"} size="sm" className="gap-1.5" onClick={() => setMode("raw")}>
            <Globe className="h-3.5 w-3.5" />HTML gốc
          </Button>
          {!cleanHtml && mode === "clean" && (
            <span className="text-xs text-muted-foreground">Readability không trích xuất được nội dung</span>
          )}
        </div>
        {mode === "clean" && (
          <div className="flex items-center gap-1">
            {cleanHtml && (
              <Button
                variant="ghost" size="sm"
                className="relative gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={() => actions.setNotePanelOpen((v) => !v)}
              >
                <Highlighter className="h-3.5 w-3.5" />
                Highlight
                {hlCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                    {hlCount}
                  </span>
                )}
              </Button>
            )}
            <button
              onClick={() => setNotesPanelOpen((v) => !v)}
              className={[
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                notesPanelOpen ? "bg-violet-100 text-violet-700" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
              title="Ghi chú cá nhân"
            >
              <StickyNote className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ghi chú</span>
            </button>
            <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minScale={0.5} maxScale={2} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
          {mode === "clean" && cleanHtml ? (
            <div
              ref={contentRef}
              className="mx-auto max-w-3xl px-6 py-8"
              style={{ zoom: scale }}
              onMouseUp={actions.handleMouseUp}
            >
              <article
                className="prose prose-neutral dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: cleanHtml }}
              />
            </div>
          ) : (
            <iframe
              srcDoc={rawHtml ?? ""}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
              className="h-full w-full border-none"
              title={doc.title}
            />
          )}
          {mode === "clean" && cleanHtml && (
            <AnnotationOverlay contentRef={contentRef} contentKey={cleanHtml.length} {...actions} />
          )}
        </div>
        {mode === "clean" && cleanHtml && <AnnotationSidebar {...actions} />}
        {notesPanelOpen && <NotesSidePanel onClose={() => setNotesPanelOpen(false)} />}
      </div>
    </div>
  );
}
