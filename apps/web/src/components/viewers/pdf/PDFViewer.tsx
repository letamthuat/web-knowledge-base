"use client";
// PDF reader — tối ưu cho PWA iOS:
// • Vừa khung (zoom 1 = khớp bề ngang), không kéo ngang trừ khi tự phóng to.
// • Cuộn ảo theo chiều cao THẬT của từng trang → không nhảy, chỉ giữ ~3 canvas.
// • Canvas giới hạn DPR (≤2 & ≤16MP) → hết trắng trang / văng app do giới hạn canvas iOS.
// • Pinch-zoom (2 ngón / ctrl+wheel) bằng transform, buông tay mới vẽ lại; chạm đúp = 1×↔2×.
// • 3 chế độ: Trang (vuốt trái/phải), Cuộn, Dạng chữ (reflow theo cỡ chữ & màu giấy).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Id } from "@/_generated/dataModel";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useReaderProgress } from "@/components/viewers/ReaderProgressContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlignJustify, FileText, ZoomIn, ZoomOut, Type, CaseSensitive, Loader2 } from "lucide-react";
import { useAppTypography, openReadingSettings } from "@/components/AppSettingsPanel";
import { getPdfReflow, registerPdfProxy, unregisterPdfProxy, type ReflowPage } from "@/lib/pdf/reflow";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PDFViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

type Mode = "page" | "scroll" | "text";
const LS_MODE = "pdf-read-mode";
const PAD_Y = 16;
const GAP = 12;
const MAX_FIT_W = 880;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 4;
const MAX_CANVAS_PIXELS = 16_000_000; // giới hạn canvas iOS ~16.7MP

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function pickDpr(w: number, h: number): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.max(1, Math.min(dpr, 2, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, w * h))));
}

function readMode(): Mode {
  try {
    const m = localStorage.getItem(LS_MODE);
    if (m === "page" || m === "scroll" || m === "text") return m;
  } catch { /* */ }
  return "scroll";
}

/** Tìm trang chứa toạ độ y (offsets tăng dần). */
function pageAt(offsets: number[], heights: number[], y: number): number {
  let lo = 0, hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= y) lo = mid; else hi = mid - 1;
  }
  return y > offsets[lo] + heights[lo] + GAP && lo < offsets.length - 1 ? lo + 1 : lo;
}

export function PDFViewer({ doc, downloadUrl }: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [aspects, setAspects] = useState<number[]>([]);
  const [defaultAspect, setDefaultAspect] = useState(1.414);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setModeState] = useState<Mode>(readMode);
  const [zoom, setZoom] = useState(1);
  const [containerW, setContainerW] = useState(0);
  const [scrollNonce, setScrollNonce] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 2]);
  const [reflow, setReflow] = useState<ReflowPage[] | null>(null);
  const [reflowError, setReflowError] = useState<string | null>(null);
  const typo = useAppTypography();

  const { progress } = useReadingProgress(doc._id);
  const { savePosition, registerJump } = useReaderProgress();

  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const pendingScrollPage = useRef<number | null>(null);
  const currentPageRef = useRef(1);
  /** Cuộn tới trang p ngay khi layout của chế độ hiện tại sẵn sàng. */
  const requestScroll = useCallback((p: number) => {
    pendingScrollPage.current = p;
    setScrollNonce((n) => n + 1);
  }, []);
  const zoomAnchor = useRef<{ cx: number; cy: number; mx: number; my: number; f: number } | null>(null);

  // ── Kích thước khung ────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth));
    ro.observe(el);
    setContainerW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const fitW = Math.max(200, Math.min(containerW - 16, MAX_FIT_W));
  const pageW = Math.round(fitW * zoom);
  const innerW = Math.max(containerW, pageW + 16);

  const { heights, offsets, totalH } = useMemo(() => {
    const hs: number[] = [];
    const os: number[] = [];
    let y = PAD_Y;
    for (let i = 0; i < numPages; i++) {
      const h = Math.round(pageW * (aspects[i] ?? defaultAspect));
      os.push(y);
      hs.push(h);
      y += h + GAP;
    }
    return { heights: hs, offsets: os, totalH: y + PAD_Y };
  }, [numPages, aspects, defaultAspect, pageW]);

  // ── Nạp tài liệu: tỉ lệ từng trang (không render) ───────────────────────
  const onLoadSuccess = useCallback(async (pdf: PDFDocumentProxy) => {
    registerPdfProxy(doc._id, pdf);
    setNumPages(pdf.numPages);
    try {
      const p1 = await pdf.getPage(1);
      const v = p1.getViewport({ scale: 1 });
      setDefaultAspect(v.height / v.width);
      const out: number[] = new Array(pdf.numPages).fill(v.height / v.width);
      for (let i = 2; i <= pdf.numPages; i++) {
        const vp = (await pdf.getPage(i)).getViewport({ scale: 1 });
        out[i - 1] = vp.height / vp.width;
        if (i % 50 === 0 || i === pdf.numPages) setAspects([...out]);
      }
      if (pdf.numPages === 1) setAspects(out);
    } catch { /* tài liệu bị huỷ giữa chừng */ }
  }, [doc._id]);

  useEffect(() => () => unregisterPdfProxy(doc._id), [doc._id]);

  // ── Điều hướng ──────────────────────────────────────────────────────────
  const markPage = useCallback((p: number) => {
    if (currentPageRef.current === p) return;
    currentPageRef.current = p;
    setCurrentPage(p);
    setPageInput(String(p));
    if (numPages > 0) savePosition({ type: "pdf_page", page: p, offset: 0 }, numPages);
  }, [numPages, savePosition]);

  const goToPage = useCallback((page: number) => {
    if (!numPages) return;
    const p = clamp(page, 1, numPages);
    markPage(p);
    setPageInput(String(p));
    requestScroll(p);
  }, [numPages, markPage, requestScroll]);

  const setMode = useCallback((m: Mode) => {
    try { localStorage.setItem(LS_MODE, m); } catch { /* */ }
    setModeState(m);
    requestScroll(currentPageRef.current);
  }, [requestScroll]);

  // Khôi phục vị trí đã lưu
  useEffect(() => {
    if (restored.current || !numPages || !progress) return;
    restored.current = true;
    if (progress.positionType !== "pdf_page") return;
    try {
      const pos = JSON.parse(progress.positionValue) as { page?: number };
      if (typeof pos.page === "number" && pos.page >= 1 && pos.page <= numPages) {
        currentPageRef.current = pos.page;
        setCurrentPage(pos.page);
        setPageInput(String(pos.page));
        requestScroll(pos.page);
      }
    } catch { /* */ }
  }, [progress, numPages, requestScroll]);

  // Cuộn tới trang đang chờ khi layout sẵn sàng
  useLayoutEffect(() => {
    const p = pendingScrollPage.current;
    if (p == null || !containerW) return;
    if (mode === "scroll" && offsets.length >= p) {
      scrollRef.current?.scrollTo({ top: offsets[p - 1] - 8 });
      pendingScrollPage.current = null;
    } else if (mode === "text" && reflow) {
      const t = scrollRef.current?.querySelector<HTMLElement>(`[data-page="${p}"]`);
      if (t) scrollRef.current!.scrollTo({ top: t.offsetTop - 8 });
      pendingScrollPage.current = null;
    } else if (mode === "page") {
      scrollRef.current?.scrollTo({ top: 0 });
      pendingScrollPage.current = null;
    }
  }, [mode, offsets, reflow, containerW, scrollNonce]);

  // Nhảy từ Lịch sử đọc
  useEffect(() => {
    registerJump((pos) => {
      if (pos.type === "pdf_page" && typeof (pos as { page: number }).page === "number") goToPage((pos as { page: number }).page);
    });
  }, [registerJump, goToPage]);

  // Nghe bài: "Tới chỗ đang nghe"
  useEffect(() => {
    const onSeg = (e: Event) => {
      const d = (e as CustomEvent<{ docId: string; force?: boolean; segment?: { page?: number } }>).detail;
      if (d?.force && d.docId === doc._id && d.segment?.page) goToPage(d.segment.page);
    };
    window.addEventListener("kb:tts-segment", onSeg);
    return () => window.removeEventListener("kb:tts-segment", onSeg);
  }, [doc._id, goToPage]);

  // ── Theo dõi cuộn (scroll + text) ───────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || mode === "page") return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const top = el.scrollTop;
      if (mode === "scroll") {
        if (!offsets.length) return;
        const first = pageAt(offsets, heights, top);
        const last = pageAt(offsets, heights, top + el.clientHeight);
        setRange((r) => {
          const next: [number, number] = [Math.max(0, first - 1), Math.min(offsets.length - 1, last + 1)];
          return r[0] === next[0] && r[1] === next[1] ? r : next;
        });
        markPage(pageAt(offsets, heights, top + el.clientHeight * 0.3) + 1);
      } else {
        const secs = el.querySelectorAll<HTMLElement>("[data-page]");
        for (const s of Array.from(secs)) {
          if (s.offsetTop + s.offsetHeight > top + 80) { markPage(Number(s.dataset.page)); break; }
        }
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [mode, offsets, heights, markPage, reflow]);

  // ── Dạng chữ ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "text" || reflow || !numPages) return;
    let alive = true;
    setReflowError(null);
    getPdfReflow(doc._id, downloadUrl)
      .then((pages) => { if (alive) setReflow(pages); })
      .catch(() => { if (alive) setReflowError("Không trích được chữ từ PDF này"); });
    return () => { alive = false; };
  }, [mode, reflow, numPages, doc._id, downloadUrl]);

  // ── Pinch-zoom / chạm đúp / vuốt trang ─────────────────────────────────
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const navRef = useRef({ currentPage, numPages, goToPage });
  navRef.current = { currentPage, numPages, goToPage };

  /** Đặt zoom mới, giữ điểm (mx,my trong khung nhìn) đứng yên. */
  const commitZoom = useCallback((next: number, mx: number, my: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const z = clamp(next, ZOOM_MIN, ZOOM_MAX);
    const f = z / zoomRef.current;
    if (Math.abs(f - 1) < 0.01) return;
    zoomAnchor.current = { cx: el.scrollLeft + mx, cy: el.scrollTop + my, mx, my, f };
    setZoom(z);
  }, []);

  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const el = scrollRef.current;
    if (!a || !el) return;
    zoomAnchor.current = null;
    if (innerRef.current) innerRef.current.style.transform = "";
    el.scrollLeft = Math.max(0, a.cx * a.f - a.mx);
    el.scrollTop = Math.max(0, a.cy * a.f - a.my);
  }, [zoom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pinch: { d0: number; mx: number; my: number; cx: number; cy: number; ratio: number } | null = null;
    let swipe: { x: number; y: number; t: number } | null = null;
    let lastTap = { t: 0, x: 0, y: 0 };
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;
    let wheel: { ratio: number; mx: number; my: number; cx: number; cy: number } | null = null;

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const local = (x: number, y: number) => { const r = el.getBoundingClientRect(); return { mx: x - r.left, my: y - r.top }; };
    const applyTransform = (ratio: number, cx: number, cy: number) => {
      const inner = innerRef.current;
      if (!inner) return;
      inner.style.transformOrigin = `${cx}px ${cy}px`;
      inner.style.transform = `scale(${ratio})`;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (modeRef.current === "text") return;
      if (e.touches.length === 2) {
        const mid = local((e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
        pinch = { d0: dist(e.touches), ...mid, cx: el.scrollLeft + mid.mx, cy: el.scrollTop + mid.my, ratio: 1 };
        swipe = null;
      } else if (e.touches.length === 1) {
        swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const z = zoomRef.current;
      pinch.ratio = clamp(dist(e.touches) / pinch.d0, ZOOM_MIN / z, ZOOM_MAX / z);
      applyTransform(pinch.ratio, pinch.cx, pinch.cy);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (pinch && e.touches.length < 2) {
        const p = pinch;
        pinch = null;
        if (Math.abs(p.ratio - 1) < 0.02) { if (innerRef.current) innerRef.current.style.transform = ""; return; }
        commitZoom(zoomRef.current * p.ratio, p.mx, p.my);
        return;
      }
      if (!swipe || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - swipe.x;
      const dy = t.clientY - swipe.y;
      const dt = Date.now() - swipe.t;
      swipe = null;
      // Vuốt ngang ở chế độ Trang (khi chưa phóng to)
      if (modeRef.current === "page" && zoomRef.current <= 1.05 && Math.abs(dx) > 60 && Math.abs(dy) < 50 && dt < 600) {
        const { currentPage: cp, goToPage: go } = navRef.current;
        go(cp + (dx < 0 ? 1 : -1));
        return;
      }
      // Chạm đúp: 1× ↔ 2×
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 250) {
        const now = Date.now();
        if (now - lastTap.t < 300 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 30) {
          const { mx, my } = local(t.clientX, t.clientY);
          commitZoom(zoomRef.current > 1.4 ? 1 : 2, mx, my);
          lastTap = { t: 0, x: 0, y: 0 };
        } else {
          lastTap = { t: now, x: t.clientX, y: t.clientY };
        }
      }
    };
    // iOS Safari: chặn zoom cả trang khi pinch trong vùng PDF
    const onGesture = (e: Event) => { if (modeRef.current !== "text") e.preventDefault(); };
    // Desktop: pinch trackpad / ctrl+wheel
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || modeRef.current === "text") return;
      e.preventDefault();
      if (!wheel) {
        const { mx, my } = local(e.clientX, e.clientY);
        wheel = { ratio: 1, mx, my, cx: el.scrollLeft + mx, cy: el.scrollTop + my };
      }
      const z = zoomRef.current;
      wheel.ratio = clamp(wheel.ratio * Math.exp(-e.deltaY * 0.01), ZOOM_MIN / z, ZOOM_MAX / z);
      applyTransform(wheel.ratio, wheel.cx, wheel.cy);
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        const w = wheel;
        wheel = null;
        if (w) commitZoom(zoomRef.current * w.ratio, w.mx, w.my);
      }, 160);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("gesturestart", onGesture as EventListener, { passive: false } as AddEventListenerOptions);
    el.addEventListener("gesturechange", onGesture as EventListener, { passive: false } as AddEventListenerOptions);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("gesturestart", onGesture as EventListener);
      el.removeEventListener("gesturechange", onGesture as EventListener);
      el.removeEventListener("wheel", onWheel);
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [commitZoom]);

  const zoomBy = (factor: number) => {
    const el = scrollRef.current;
    if (!el) return;
    commitZoom(zoomRef.current * factor, el.clientWidth / 2, el.clientHeight / 3);
  };

  if (loadError) {
    return <div className="flex flex-1 items-center justify-center text-destructive text-sm">{loadError}</div>;
  }

  const submitPageInput = () => {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n)) goToPage(n);
    else setPageInput(String(currentPage));
  };

  const modeBtn = (m: Mode, Icon: typeof FileText, label: string) => (
    <button
      onClick={() => setMode(m)}
      className={["flex h-8 items-center justify-center gap-1 px-2 text-xs transition-colors",
        mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
      ].join(" ")}
      title={label}
      aria-pressed={mode === m}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  const pageDpr = pickDpr(pageW, pageW * defaultAspect);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/40" style={{ minHeight: 0 }}>
      {/* Toolbar */}
      <div className="shrink-0 border-b bg-card">
        <div className="flex items-center gap-1 px-2 py-1 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Trang trước">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              <input
                type="text" inputMode="numeric" value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={submitPageInput}
                onKeyDown={(e) => { if (e.key === "Enter") { submitPageInput(); (e.target as HTMLInputElement).blur(); } }}
                className="w-11 rounded border border-input bg-background px-1 py-0.5 text-center text-base sm:text-sm tabular-nums"
                aria-label="Số trang"
              />
              <span className="text-sm text-muted-foreground tabular-nums">/ {numPages || "—"}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages} aria-label="Trang sau">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex shrink-0 items-center gap-1 ml-auto">
            {mode === "text" ? (
              <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={openReadingSettings} title="Cỡ chữ & màu giấy">
                <CaseSensitive className="h-4 w-4" /> Cỡ chữ
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(1 / 1.25)} disabled={zoom <= ZOOM_MIN} aria-label="Thu nhỏ">
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <button
                  onClick={() => { const el = scrollRef.current; if (el) commitZoom(1, el.clientWidth / 2, el.clientHeight / 3); }}
                  className="w-12 rounded px-1 py-1 text-center text-xs tabular-nums hover:bg-muted"
                  title="Vừa khung"
                >
                  {Math.abs(zoom - 1) < 0.01 ? "Vừa" : `${Math.round(zoom * 100)}%`}
                </button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(1.25)} disabled={zoom >= ZOOM_MAX} aria-label="Phóng to">
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <div className="h-4 w-px bg-border mx-0.5" />
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              {modeBtn("page", FileText, "Trang")}
              {modeBtn("scroll", AlignJustify, "Cuộn")}
              {modeBtn("text", Type, "Dạng chữ")}
            </div>
          </div>
        </div>
      </div>

      {/* Khung cuộn duy nhất */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto"
        style={{ minHeight: 0, overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", touchAction: mode === "text" ? "auto" : "pan-x pan-y" } as React.CSSProperties}
      >
        <Document
          file={downloadUrl}
          onLoadSuccess={onLoadSuccess}
          onLoadError={() => setLoadError("Không thể tải PDF. File có thể bị lỗi hoặc không được hỗ trợ.")}
          loading={<div className="flex justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}
          className={mode === "text" ? "hidden" : undefined}
        >
          {mode === "scroll" && numPages > 0 && (
            <div ref={innerRef} style={{ position: "relative", width: innerW, height: totalH, willChange: "transform" }}>
              {Array.from({ length: Math.max(0, range[1] - range[0] + 1) }, (_, k) => range[0] + k)
                .filter((i) => i < numPages)
                .map((i) => (
                  <div
                    key={i}
                    data-page={i + 1}
                    className="absolute bg-white shadow-md"
                    style={{ top: offsets[i], left: (innerW - pageW) / 2, width: pageW, height: heights[i] }}
                  >
                    <Page
                      pageNumber={i + 1}
                      width={pageW}
                      devicePixelRatio={pickDpr(pageW, heights[i])}
                      renderTextLayer
                      renderAnnotationLayer
                      loading={null}
                    />
                  </div>
                ))}
            </div>
          )}
          {mode === "page" && numPages > 0 && (
            <div ref={innerRef} style={{ width: innerW, padding: `${PAD_Y}px 0`, willChange: "transform" }}>
              <div
                data-page={currentPage}
                className="bg-white shadow-md"
                style={{ marginLeft: (innerW - pageW) / 2, width: pageW, minHeight: Math.round(pageW * (aspects[currentPage - 1] ?? defaultAspect)) }}
              >
                <Page pageNumber={currentPage} width={pageW} devicePixelRatio={pageDpr} renderTextLayer renderAnnotationLayer loading={null} />
              </div>
            </div>
          )}
        </Document>

        {mode === "text" && (
          reflowError ? (
            <div className="px-6 py-24 text-center text-sm text-destructive">{reflowError}</div>
          ) : !reflow ? (
            <div className="flex flex-col items-center gap-3 py-24 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" /> Đang chuyển sang dạng chữ…
            </div>
          ) : reflow.every((p) => p.blocks.length === 0) ? (
            <div className="px-6 py-24 text-center text-sm text-muted-foreground">PDF này là ảnh scan — không có chữ để hiển thị dạng chữ.</div>
          ) : (
            <article
              className={`mx-auto px-5 pb-24 pt-4 sm:px-8 ${typo.colWidthClass} text-foreground`}
              style={{ fontFamily: typo.fontFamily, fontSize: typo.fontSize, lineHeight: typo.lineHeight }}
            >
              {reflow.map((p) => (
                <section key={p.page} data-page={p.page} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 900px" } as React.CSSProperties}>
                  <div className="my-5 flex items-center gap-3 text-[11px] font-medium text-muted-foreground" style={{ fontFamily: "var(--font-sans), system-ui" }}>
                    <span className="h-px flex-1 bg-border" />Trang {p.page}<span className="h-px flex-1 bg-border" />
                  </div>
                  {p.blocks.map((b, k) =>
                    b.heading
                      ? <h3 key={k} className="mb-[0.5em] mt-[1.2em] font-display font-semibold" style={{ fontSize: "1.15em", lineHeight: 1.35 }}>{b.text}</h3>
                      : <p key={k} className="mb-[0.85em]">{b.text}</p>,
                  )}
                </section>
              ))}
            </article>
          )
        )}
      </div>
    </div>
  );
}
