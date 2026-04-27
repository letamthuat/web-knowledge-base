"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Id } from "@/../../../convex/_generated/dataModel";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ZoomControls, useZoom } from "@/components/viewers/ZoomControls";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PDFViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

export function PDFViewer({ doc, downloadUrl }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [loadError, setLoadError] = useState<string | null>(null);
  const { scale, zoomIn, zoomOut, reset: resetZoom } = useZoom(1.2, 0.2, 0.5, 3);

  const { progress } = useReadingProgress(doc._id);
  const { savePosition, registerJump } = useReaderProgress();
  const restored = useRef(false);

  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "pdf_page" && typeof (pos as { page: number }).page === "number") {
        const p = (pos as { type: "pdf_page"; page: number; offset: number }).page;
        setCurrentPage(p);
        setPageInput(String(p));
      }
    });
  }, [registerJump]);

  // Restore position once both progress data and numPages are available
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

  const goToPage = useCallback(
    (page: number) => {
      const p = Math.max(1, Math.min(numPages, page));
      setCurrentPage(p);
      setPageInput(String(p));
      savePosition({ type: "pdf_page", page: p, offset: 0 }, numPages);
    },
    [numPages, savePosition]
  );

  if (loadError) {
    return <div className="flex flex-1 items-center justify-center text-destructive text-sm">{loadError}</div>;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/40">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-4 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const n = parseInt(pageInput, 10);
                if (!isNaN(n)) goToPage(n);
                else setPageInput(String(currentPage));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = parseInt(pageInput, 10);
                  if (!isNaN(n)) goToPage(n);
                  else setPageInput(String(currentPage));
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-12 rounded border border-input bg-background px-1 py-0.5 text-center text-sm"
            />
            / {numPages || "—"}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minScale={0.5} maxScale={3} />
      </div>

      {/* PDF content */}
      <div className="flex flex-1 items-start justify-center overflow-auto py-6">
        <Document
          file={downloadUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => setLoadError("Không thể tải PDF. File có thể bị lỗi hoặc không được hỗ trợ.")}
          loading={<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            className="shadow-xl"
            renderTextLayer
            renderAnnotationLayer
          />
        </Document>
      </div>
    </div>
  );
}
