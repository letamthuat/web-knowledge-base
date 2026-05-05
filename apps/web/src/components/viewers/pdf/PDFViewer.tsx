"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Id } from "@/_generated/dataModel";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlignJustify, FileText, ZoomIn, ZoomOut } from "lucide-react";
import { useZoom } from "@/components/viewers/ZoomControls";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const safePad = {
  paddingRight: "max(12px, var(--safe-right, 0px))",
  paddingLeft: "max(12px, var(--safe-left, 0px))",
};

interface PDFViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

// VirtualPage: renders <Page> only when near viewport
function VirtualPage({
  pageNum,
  scale,
  pageRef,
  onPageSize,
}: {
  pageNum: number;
  scale: number;
  pageRef: (el: HTMLDivElement | null) => void;
  onPageSize?: (height: number) => void;
}) {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "300px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={(el) => {
        wrapperRef.current = el;
        pageRef(el);
      }}
      style={{ minHeight: 820, display: "flex", justifyContent: "center", marginBottom: 16 }}
    >
      {visible && (
        <Page
          pageNumber={pageNum}
          scale={scale}
          className="shadow-xl"
          renderTextLayer
          renderAnnotationLayer
          onRenderSuccess={(page) => {
            if (onPageSize) onPageSize(page.height * scale + 16);
          }}
        />
      )}
    </div>
  );
}

export function PDFViewer({ doc, downloadUrl }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readMode, setReadMode] = useState<"page" | "scroll">("page");
  const { scale, zoomIn, zoomOut, reset: resetZoom } = useZoom(1.2, 0.2, 0.5, 3);

  const { progress } = useReadingProgress(doc._id);
  const { savePosition, registerJump } = useReaderProgress();
  const restored = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // registerJump
  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "pdf_page" && typeof (pos as { page: number }).page === "number") {
        const p = (pos as { type: "pdf_page"; page: number }).page;
        setCurrentPage(p);
        setPageInput(String(p));
        if (readMode === "scroll") {
          setTimeout(() => {
            pageRefs.current[p - 1]?.scrollIntoView({ block: "start" });
          }, 50);
        } else {
          scrollRef.current?.scrollTo({ top: 0 });
        }
      }
    });
  }, [registerJump, readMode]);

  // Restore position
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

  // Page mode: go to page
  const goToPage = useCallback(
    (page: number) => {
      const p = Math.max(1, Math.min(numPages, page));
      setCurrentPage(p);
      setPageInput(String(p));
      savePosition({ type: "pdf_page", page: p, offset: 0 }, numPages);
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [numPages, savePosition]
  );

  // Scroll mode: jump to page
  const scrollToPage = useCallback((page: number) => {
    const p = Math.max(1, Math.min(numPages, page));
    setPageInput(String(p));
    setTimeout(() => {
      pageRefs.current[p - 1]?.scrollIntoView({ block: "start" });
    }, 50);
  }, [numPages]);

  // Scroll mode: IntersectionObserver to track current page
  const scrollObserverRef = useRef<IntersectionObserver | null>(null);
  const visibleRatios = useRef<Map<number, number>>(new Map());

  const setupScrollObserver = useCallback(() => {
    if (scrollObserverRef.current) scrollObserverRef.current.disconnect();
    if (!numPages) return;

    scrollObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = parseInt((e.target as HTMLElement).dataset.page ?? "0", 10);
          visibleRatios.current.set(idx, e.intersectionRatio);
        });
        // Find most visible page
        let bestPage = 1;
        let bestRatio = -1;
        visibleRatios.current.forEach((ratio, idx) => {
          if (ratio > bestRatio) { bestRatio = ratio; bestPage = idx; }
        });
        if (bestRatio > 0 && numPages > 0) {
          setCurrentPage(bestPage);
          setPageInput(String(bestPage));
          savePosition({ type: "pdf_page", page: bestPage, offset: 0 }, numPages);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    pageRefs.current.forEach((el, i) => {
      if (el) {
        el.dataset.page = String(i + 1);
        scrollObserverRef.current!.observe(el);
      }
    });
  }, [numPages, savePosition]);

  useEffect(() => {
    if (readMode === "scroll" && numPages > 0) {
      // Small delay to let VirtualPages mount
      const t = setTimeout(setupScrollObserver, 200);
      return () => clearTimeout(t);
    } else {
      scrollObserverRef.current?.disconnect();
    }
  }, [readMode, numPages, setupScrollObserver]);

  // Switch page → scroll: scroll to current page
  const prevReadMode = useRef(readMode);
  useEffect(() => {
    if (prevReadMode.current === "page" && readMode === "scroll") {
      const targetPage = currentPage;
      setTimeout(() => {
        pageRefs.current[targetPage - 1]?.scrollIntoView({ block: "start" });
      }, 100);
    }
    if (prevReadMode.current === "scroll" && readMode === "page") {
      scrollRef.current?.scrollTo({ top: 0 });
    }
    prevReadMode.current = readMode;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readMode]);

  if (loadError) {
    return <div className="flex flex-1 items-center justify-center text-destructive text-sm">{loadError}</div>;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/40" style={{ minHeight: 0 }}>
      {/* Toolbar — single row */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-2 py-1">
        {/* Left: page nav */}
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => goToPage(currentPage - 1)}
            disabled={readMode === "scroll" || currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-xs tabular-nums">
            <input
              type="text" inputMode="numeric" value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const n = parseInt(pageInput, 10);
                if (!isNaN(n)) readMode === "page" ? goToPage(n) : scrollToPage(n);
                else setPageInput(String(currentPage));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = parseInt(pageInput, 10);
                  if (!isNaN(n)) readMode === "page" ? goToPage(n) : scrollToPage(n);
                  else setPageInput(String(currentPage));
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-9 rounded border border-input bg-background px-1 py-0.5 text-center text-xs tabular-nums"
              style={{ fontSize: '12px' }}
            />
            <span className="text-xs text-muted-foreground">/{numPages || "—"}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => goToPage(currentPage + 1)}
            disabled={readMode === "scroll" || currentPage >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Right: zoom + toggle */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="hidden sm:inline w-10 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} disabled={scale >= 3}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-0.5 h-4 w-px bg-border" />
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
        </div>
      </div>

      {/* Single scroll container — one Document, mode switches children */}
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
          WebkitOverflowScrolling: "touch",
          willChange: "scroll-position",
          ...safePad,
        } as React.CSSProperties}
      >
        <Document
          file={downloadUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          onLoadError={() => setLoadError("Không thể tải PDF. File có thể bị lỗi hoặc không được hỗ trợ.")}
          loading={<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
        >
          {readMode === "page" ? (
            <Page
              pageNumber={currentPage}
              scale={scale}
              className="shadow-xl"
              renderTextLayer
              renderAnnotationLayer
            />
          ) : (
            numPages > 0 && Array.from({ length: numPages }, (_, i) => (
              <VirtualPage
                key={i}
                pageNum={i + 1}
                scale={scale}
                pageRef={(el) => { pageRefs.current[i] = el; }}
              />
            ))
          )}
        </Document>
      </div>
    </div>
  );
}

