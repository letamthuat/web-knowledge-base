"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export function PDFViewer({ doc, downloadUrl }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readMode, setReadMode] = useState<ReadMode>("page");
  const { scale, zoomIn, zoomOut, reset: resetZoom } = useZoom(1.2, 0.2, 0.5, 3);

  const { progress } = useReadingProgress(doc._id);
  const { savePosition, registerJump } = useReaderProgress();
  const restored = useRef(false);

  // One scroll container used by both modes
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Restore saved position once numPages is known
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

  // When switching TO scroll mode, jump to current page
  const prevModeRef = useRef<ReadMode>("page");
  useEffect(() => {
    if (readMode === "scroll" && prevModeRef.current !== "scroll") {
      const p = currentPage;
      // Wait for scroll-mode pages to render
      const t = setTimeout(() => {
        pageRefs.current[p - 1]?.scrollIntoView({ block: "start" });
      }, 100);
      prevModeRef.current = "scroll";
      return () => clearTimeout(t);
    }
    if (readMode === "page") {
      prevModeRef.current = "page";
      // Scroll page-mode container back to top
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ top: 0 });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [readMode, currentPage]);

  // Jump to page from history popover
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

  // Track visible page in scroll mode via IntersectionObserver
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
    }, 100);
    return () => { clearTimeout(t); observer.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readMode, numPages, savePosition]);

  const goToPage = useCallback(
    (page: number) => {
      const p = Math.max(1, Math.min(numPages, page));
      setCurrentPage(p);
      setPageInput(String(p));
      savePosition({ type: "pdf_page", page: p, offset: 0 }, numPages);
      if (readMode === "scroll") {
        setTimeout(() => pageRefs.current[p - 1]?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } else {
        // Scroll page-mode container to top for clean display
        scrollRef.current?.scrollTo({ top: 0 });
      }
    },
    [numPages, savePosition, readMode]
  );

  const syncPageInput = useCallback(
    (val: string) => {
      const n = parseInt(val, 10);
      if (!isNaN(n)) goToPage(n);
      else setPageInput(String(currentPage));
    },
    [goToPage, currentPage]
  );

  if (loadError) {
    return <div className="flex flex-1 items-center justify-center text-destructive text-sm">{loadError}</div>;
  }

  const safePad: React.CSSProperties = {
    paddingLeft: "max(12px, var(--safe-left, 0px))",
    paddingRight: "max(12px, var(--safe-right, 0px))",
  };

  return (
    <div className="flex flex-1 flex-col" style={{ minHeight: 0, overflow: "hidden" }}>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-4 py-1.5">
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
              className={[
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                readMode === "page" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Trang</span>
            </button>
            <button
              onClick={() => setReadMode("scroll")}
              className={[
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                readMode === "scroll" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <AlignJustify className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cuộn</span>
            </button>
          </div>
          <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minScale={0.5} maxScale={3} />
        </div>
      </div>

      {/* Unified scroll container — used for both modes */}
      <div
        ref={scrollRef}
        style={{
          flex: "1 1 0",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 24,
          paddingBottom: 24,
          gap: readMode === "scroll" ? 16 : 0,
          WebkitOverflowScrolling: "touch" as never,
          background: "hsl(var(--muted) / 0.4)",
          ...safePad,
        }}
      >
        <Document
          file={downloadUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => setLoadError("Không thể tải PDF. File có thể bị lỗi hoặc không được hỗ trợ.")}
          loading={<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
        >
          {readMode === "page" ? (
            /* Page mode: show only current page */
            numPages > 0 ? (
              <Page
                pageNumber={currentPage}
                scale={scale}
                className="shadow-xl"
                renderTextLayer
                renderAnnotationLayer
                onRenderSuccess={() => {
                  // Save progress on page render in page mode
                  savePosition({ type: "pdf_page", page: currentPage, offset: 0 }, numPages);
                }}
              />
            ) : null
          ) : (
            /* Scroll mode: show all pages */
            numPages > 0
              ? Array.from({ length: numPages }, (_, i) => (
                <div key={i} ref={(el) => { pageRefs.current[i] = el; }}>
                  <Page pageNumber={i + 1} scale={scale} className="shadow-xl" renderTextLayer renderAnnotationLayer />
                </div>
              ))
              : null
          )}
        </Document>
      </div>

    </div>
  );
}
