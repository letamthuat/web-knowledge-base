"use client";

import { useCallback, useEffect, useRef, useState, memo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Id } from "@/_generated/dataModel";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, BookOpen, AlignJustify } from "lucide-react";
import { ZoomControls, useZoom } from "@/components/viewers/ZoomControls";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PDFViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

type ReadMode = "page" | "scroll";

// Lazily renders <Page> only when within 500px of the scroll viewport.
const VirtualPage = memo(function VirtualPage({
  pageNum,
  scale,
  pageRef,
  scrollRoot,
}: {
  pageNum: number;
  scale: number;
  pageRef: (el: HTMLDivElement | null) => void;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
}) {
  const [mounted, setMounted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setMounted(true); },
      { root: scrollRoot.current, rootMargin: "500px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [scrollRoot]);

  return (
    <div
      ref={(el) => { wrapperRef.current = el; pageRef(el); }}
      className="flex justify-center mb-4"
      style={{ minHeight: 1100 /* px, approx A4 at 96dpi */ }}
    >
      {mounted && (
        <Page pageNumber={pageNum} scale={scale} className="shadow-xl" renderTextLayer renderAnnotationLayer />
      )}
    </div>
  );
});

export function PDFViewer({ doc, downloadUrl }: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readMode, setReadMode] = useState<ReadMode>("page");
  const { scale, zoomIn, zoomOut, reset: resetZoom } = useZoom(1.2, 0.2, 0.5, 3);

  const { progress } = useReadingProgress(doc._id);
  const { savePosition, registerJump } = useReaderProgress();
  const restored = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Measure toolbar height to compute scroll container height
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarH, setToolbarH] = useState(48);
  useEffect(() => {
    if (!toolbarRef.current) return;
    const ro = new ResizeObserver(([e]) => setToolbarH(e.contentRect.height));
    ro.observe(toolbarRef.current);
    return () => ro.disconnect();
  }, []);

  // Restore saved position
  useEffect(() => {
    if (restored.current || !numPages || !progress) return;
    if (progress.positionType === "pdf_page") {
      try {
        const pos = JSON.parse(progress.positionValue);
        if (typeof pos.page === "number" && pos.page >= 1 && pos.page <= numPages) {
          setCurrentPage(pos.page);
          setPageInput(String(pos.page));
        }
      } catch {}
    }
    restored.current = true;
  }, [progress, numPages]);

  // When switching to scroll mode, scroll to current page
  const prevModeRef = useRef<ReadMode>("page");
  useEffect(() => {
    if (readMode === "scroll" && prevModeRef.current !== "scroll") {
      const p = currentPage;
      const t = setTimeout(() => {
        pageRefs.current[p - 1]?.scrollIntoView({ block: "start" });
      }, 150);
      prevModeRef.current = "scroll";
      return () => clearTimeout(t);
    }
    if (readMode === "page") prevModeRef.current = "page";
  }, [readMode, currentPage]);

  // Jump from history popover
  useEffect(() => {
    registerJump((pos) => {
      if (pos.type !== "pdf_page") return;
      const p = (pos as { type: "pdf_page"; page: number }).page;
      setCurrentPage(p);
      setPageInput(String(p));
      if (readMode === "scroll") {
        setTimeout(() => pageRefs.current[p - 1]?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    });
  }, [registerJump, readMode]);

  // Track visible page in scroll mode
  useEffect(() => {
    if (readMode !== "scroll" || !numPages) return;
    const container = scrollRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let visiblePage = -1;
        for (const entry of entries) {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const idx = pageRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) visiblePage = idx + 1;
          }
        }
        if (visiblePage > 0 && visiblePage !== currentPage) {
          setCurrentPage(visiblePage);
          setPageInput(String(visiblePage));
          savePosition({ type: "pdf_page", page: visiblePage, offset: 0 }, numPages);
        }
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    const t = setTimeout(() => {
      pageRefs.current.slice(0, numPages).forEach((el) => el && observer.observe(el));
    }, 200);
    return () => { clearTimeout(t); observer.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readMode, numPages, savePosition]);

  const goToPage = useCallback((page: number) => {
    const p = Math.max(1, Math.min(numPages, page));
    setCurrentPage(p);
    setPageInput(String(p));
    savePosition({ type: "pdf_page", page: p, offset: 0 }, numPages);
    if (readMode === "scroll") {
      setTimeout(() => pageRefs.current[p - 1]?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }, [numPages, savePosition, readMode]);

  const syncPageInput = useCallback((val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n)) goToPage(n);
    else setPageInput(String(currentPage));
  }, [goToPage, currentPage]);

  if (loadError) {
    return <div className="flex flex-1 items-center justify-center text-destructive text-sm px-4 text-center">{loadError}</div>;
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>

      {/* Toolbar — fixed at top of this container */}
      <div ref={toolbarRef} className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 border-b bg-card px-4 py-1.5">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-10 w-10"
            onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums flex items-center gap-1">
            <input
              type="text" inputMode="numeric" value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => syncPageInput(pageInput)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { syncPageInput(pageInput); (e.target as HTMLInputElement).blur(); }
              }}
              className="w-12 rounded border border-input bg-background px-1 py-0.5 text-center text-sm"
            />
            <span>/ {numPages || "—"}</span>
          </span>
          <Button variant="ghost" size="icon" className="h-10 w-10"
            onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
            <button
              onClick={() => setReadMode("page")}
              className={["flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                readMode === "page" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"].join(" ")}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Trang</span>
            </button>
            <button
              onClick={() => setReadMode("scroll")}
              className={["flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                readMode === "scroll" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"].join(" ")}
            >
              <AlignJustify className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cuộn</span>
            </button>
          </div>
          <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minScale={0.5} maxScale={3} />
        </div>
      </div>

      {/* Scroll container — fills space below toolbar */}
      <div
        ref={scrollRef}
        className="absolute inset-x-0 bottom-0 overflow-y-auto overflow-x-auto bg-muted/40"
        style={{
          top: toolbarH,
          WebkitOverflowScrolling: "touch" as never,
          willChange: "scroll-position",
        } as React.CSSProperties}
      >
        <div className="py-6 px-3">
          <Document
            file={downloadUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setLoadError("Không thể tải PDF. File có thể bị lỗi hoặc không được hỗ trợ.")}
            loading={
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            }
          >
            {readMode === "page" && numPages > 0 && (
              <div className="flex justify-center">
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  className="shadow-xl"
                  renderTextLayer
                  renderAnnotationLayer
                  onRenderSuccess={() => savePosition({ type: "pdf_page", page: currentPage, offset: 0 }, numPages)}
                />
              </div>
            )}

            {readMode === "scroll" && numPages > 0 && (
              <>
                {Array.from({ length: numPages }, (_, i) => (
                  <VirtualPage
                    key={i}
                    pageNum={i + 1}
                    scale={scale}
                    pageRef={(el) => { pageRefs.current[i] = el; }}
                    scrollRoot={scrollRef}
                  />
                ))}
              </>
            )}
          </Document>
        </div>
      </div>

    </div>
  );
}
