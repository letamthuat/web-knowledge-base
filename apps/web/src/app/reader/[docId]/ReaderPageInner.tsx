"use client";

import { pushUrl } from "@/lib/history";
import { useEffect, useRef, useCallback, useState, useMemo, memo, useSyncExternalStore } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Id } from "@/_generated/dataModel";
import { useDocument, getDownloadUrl } from "@/lib/api/documents";
import { recordOpen } from "@/lib/api/reading-history";
import { useSession } from "@/lib/auth-client";
import { ViewerDispatcher } from "@/components/viewers/ViewerDispatcher";
import { ProgressSaveIndicator } from "@/components/viewers/ProgressSaveIndicator";
import { ReaderProgressContext } from "@/components/viewers/ReaderProgressContext";
import { ReadingHistoryPopover } from "@/components/viewers/ReadingHistoryPopover";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import type { ReadingPosition } from "@/lib/position";
import { toProgressPct } from "@/lib/position";
import { ArrowLeft, StickyNote, Settings, X, LogOut, Menu, Download, MoreHorizontal, Search, PanelLeftClose, PanelLeftOpen, Maximize2, Palette } from "lucide-react";
import { navDrawer, openNavDrawer, closeNavDrawer } from "@/lib/navDrawer";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import { toast } from "sonner";
import { TabBar } from "@/components/tabs/TabBar";
import { TabDropdown } from "@/components/tabs/TabDropdown";
import { useTabSync } from "@/hooks/useTabSync";
import { useNoteTabs } from "@/hooks/useNoteTabs";
import { useAllNotes } from "@/hooks/useNotes";
import { openSearch, isSearchOpen } from "@/components/search/SearchModal";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useAppTypography, openReadingSettings } from "@/components/AppSettingsPanel";
import { useActiveTab } from "@/contexts/ActiveTabContext";
import { useDocExport } from "@/hooks/useDocExport";

/** Store nhỏ cho % đọc: cập nhật mỗi 1% khi cuộn mà KHÔNG re-render cả ReaderShell/viewer. */
type PctStore = { get: () => number | null; set: (v: number) => void; subscribe: (l: () => void) => () => void };
function createPctStore(): PctStore {
  let value: number | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (v) => {
      if (v === value) return;
      value = v;
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}

const ReaderProgressBar = memo(function ReaderProgressBar({ store, savedPct, extractedText, pillVisible, onPillClick }: {
  store: PctStore;
  savedPct: number | null;
  extractedText: string;
  /** Chrome đang ẩn (mobile) → hiện viên tiến độ nổi thay cho footer */
  pillVisible: boolean;
  onPillClick: () => void;
}) {
  const localPct = useSyncExternalStore(store.subscribe, store.get, store.get);
  // Đếm từ 1 lần cho mỗi tài liệu — không split cả văn bản mỗi lần cuộn
  const wordCount = useMemo(() => (extractedText ? extractedText.trim().split(/\s+/).length : 0), [extractedText]);

  const pct = localPct ?? savedPct;
  if (pct == null || pct <= 0) return null;
  const WPM = 200;
  const wordsLeft = wordCount > 0 ? Math.round(wordCount * (1 - pct / 100)) : 0;
  const minsLeft = wordCount > 0 ? Math.round(wordsLeft / WPM) : 0;
  const pctDisplay = Math.round(pct);
  const R = 7;
  const C = 2 * Math.PI * R;
  return (
    <>
    {pillVisible && (
      <button
        onClick={onPillClick}
        aria-label="Hiện thanh công cụ"
        className="reader-pill fixed left-1/2 z-40 flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground tabular-nums shadow-[0_8px_28px_-6px_rgba(0,0,0,0.22)]"
        style={{ bottom: "calc(var(--safe-bottom) + 14px)" }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" className="-rotate-90" aria-hidden>
          <circle cx="9" cy="9" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="2.5" />
          <circle cx="9" cy="9" r={R} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pctDisplay / 100)} className="transition-[stroke-dashoffset] duration-300" />
        </svg>
        <span className="text-foreground">{pctDisplay}%</span>
        {minsLeft > 0 && <span>· còn ~{minsLeft} phút</span>}
      </button>
    )}
    <div className="reader-chrome-bottom relative z-10 shrink-0 border-t border-border/70 bg-card px-4 py-2 flex items-center justify-center">
      <div className="flex items-center gap-3 w-full max-w-lg">
        <div className="flex-1 h-1.5 rounded-full bg-muted/80 overflow-hidden">
          <div className="h-full rounded-full bg-primary/85 transition-[width] duration-300" style={{ width: `${Math.max(3, pctDisplay)}%` }} />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
          {pctDisplay}%{minsLeft > 0 ? ` · Còn ~${minsLeft} phút đọc` : ""}
        </span>
      </div>
    </div>
    </>
  );
});

function ReaderShell({ doc, downloadUrl }: {
  doc: { _id: Id<"documents">; format: string; title: string; mimeType?: string; durationMs?: number; fileSizeBytes?: number; handbookId?: Id<"handbooks">; relPath?: string };
  downloadUrl: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightQuery = searchParams.get("q") ?? undefined;
  const { data: session } = useSession();
  const { saveNow, saveStatus, savePosition, progress } = useReadingProgress(doc._id);
  const { tabs: allTabs, isLoading: tabsLoading, openTab, updateScrollState } = useTabSync();
  const { noteTabs, activeNoteId, openNoteTab, closeNoteTab, setActiveNoteId } = useNoteTabs();
  const { addNote } = useAllNotes();

  const [transcribeRunning, setTranscribeRunning] = useState(false);
  const transcribeRunningRef = useRef(false);
  transcribeRunningRef.current = transcribeRunning;

  function confirmLeave(action: () => void) {
    if (transcribeRunningRef.current) {
      if (!window.confirm("Đang tạo transcript, rời trang sẽ mất tiến độ. Bạn có chắc không?")) return;
    }
    action();
  }

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const pctStoreRef = useRef<PctStore | null>(null);
  if (!pctStoreRef.current) pctStoreRef.current = createPctStore();
  const pctStore = pctStoreRef.current;

  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      if (readingMode) {
        setReadingMode(false);
        return;
      }
      try {
        await containerRef.current?.requestFullscreen();
        setReadingMode(true);
      } catch (err) {
        // Fallback for iOS
        setReadingMode(true);
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (err) {}
      setReadingMode(false);
    }
  }, [readingMode]);

  useEffect(() => {
    function handleFullscreenChange() {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setReadingMode(isCurrentlyFullscreen);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const typography = useAppTypography();
  const { activePanel, setActivePanel, navigate, sidebarOpen, setSidebarOpen } = useActiveTab();
  const { exportDoc, isExporting } = useDocExport();

  const handleNewNote = useCallback(async () => {
    try {
      const id = await addNote("[]", "");
      if (id) {
        const noteId = id as Id<"notes">;
        await openNoteTab(noteId, "");
        setActivePanel("notes");
        pushUrl("/notes");
      }
    } catch {
      toast("Không thể tạo ghi chú");
    }
  }, [addNote, openNoteTab, setActivePanel]);
  const TEXT_FORMATS = new Set(["markdown", "epub", "docx", "web_clip"]);
  const READING_MODE_FORMATS = new Set(["pdf", "epub", "docx", "markdown", "web_clip"]);

  // Reading Mode shortcuts (Cmd/Ctrl+K do GlobalSearch lo)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Reader ẩn (keep-alive) không được bắt phím của panel khác
      if (activePanel !== null && activePanel !== `reader:${doc._id}`) return;
      const t = e.target as HTMLElement | null;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t?.isContentEditable) return;
      // Đang gõ IME (Telex/VNI) — không được nuốt phím
      if (e.isComposing || e.key === "Process") return;

      // Shift+F → toggle reading mode (không dùng "f" trần: trùng dấu huyền Telex)
      if (e.shiftKey && e.key === "F" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (!READING_MODE_FORMATS.has(doc.format)) {
          toast("Reading Mode chỉ dành cho định dạng đọc");
          return;
        }
        toggleFullscreen();
        return;
      }

      // Esc → exit reading mode (only when search modal is closed)
      if (e.key === "Escape" && !isSearchOpen()) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          setReadingMode(false);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePanel, doc._id, doc.format, toggleFullscreen]);


  // Find the tab for this doc so we can persist scroll state into it
  const currentTab = allTabs.find((t) => t.docId === doc._id) ?? null;
  const currentTabId = currentTab?._id ?? null;
  const scrollStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wrap savePosition to also update scrollState in the tab + update local progress pct
  // updateScrollState is throttled to once per 10s to avoid flooding Convex on mobile
  const savePositionWithTab = useCallback(
    (pos: ReadingPosition, total?: number) => {
      savePosition(pos, total);
      // Cập nhật thanh % qua store riêng — chỉ ReaderProgressBar re-render
      const pct = toProgressPct(pos, total);
      if (pct !== null) pctStore.set(Math.round(pct * 100));
      if (currentTabId) {
        if (!scrollStateTimerRef.current) {
          scrollStateTimerRef.current = setTimeout(() => {
            scrollStateTimerRef.current = null;
            const scrollState = JSON.stringify(pos);
            updateScrollState(currentTabId, scrollState).catch(() => {});
          }, 10_000);
        }
      }
    },
    [savePosition, updateScrollState, currentTabId, pctStore]
  );
  const FORMAT_EXT: Record<string, string> = {
    pdf: ".pdf", epub: ".epub", docx: ".docx", pptx: ".pptx",
    image: ".jpg", audio: ".mp3", video: ".mp4", markdown: ".md", web_clip: ".html",
  };
  async function handleDownload() {
    try {
      const url = await getDownloadUrl(doc._id);
      const ext = FORMAT_EXT[doc.format] ?? "";
      const fileName = doc.title.endsWith(ext) ? doc.title : doc.title + ext;
      // Fetch về blob để bypass cross-origin download restriction
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Không thể tải xuống tài liệu");
    }
  }

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1280);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const showDropdown = isMobile;

  // ── Reader nhập vai (mobile/tablet): cuộn xuống → ẩn chrome, cuộn lên / chạm trang → hiện ──
  const [chromeHidden, setChromeHidden] = useState(false);
  const chromeHiddenRef = useRef(false);
  const chromeLockRef = useRef(0);
  const setChrome = useCallback((hidden: boolean) => {
    if (chromeHiddenRef.current === hidden) return;
    chromeHiddenRef.current = hidden;
    const root = containerRef.current;
    if (hidden && root) {
      // Đo lúc chrome còn hiện: header + tab (trượt lên), toolbar viewer (trượt theo nội dung), footer (trượt xuống)
      let head = 0;
      let safeTop = 0;
      root.querySelectorAll<HTMLElement>(".reader-chrome-top").forEach((el, i) => {
        head += el.offsetHeight;
        if (i === 0) safeTop = parseFloat(getComputedStyle(el).paddingTop) || 0;
      });
      const toolbar = root.querySelector<HTMLElement>(".reader-body .reader-autohide")?.offsetHeight ?? 0;
      const foot = root.querySelector<HTMLElement>(".reader-chrome-bottom")?.offsetHeight ?? 0;
      root.style.setProperty("--chrome-head", `${head}px`);
      root.style.setProperty("--chrome-shift", `${Math.max(0, head + toolbar - safeTop)}px`);
      root.style.setProperty("--chrome-foot", `${foot}px`);
    }
    // Khung cuộn đổi cao 1 lần lúc bắt đầu ẩn / sau khi hiện xong → bỏ qua scroll trong lúc chuyển
    chromeLockRef.current = performance.now() + 360;
    setChromeHidden(hidden);
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!isMobile || !root) { setChrome(false); return; }
    const lastTop = new WeakMap<EventTarget, number>();

    function onScroll(e: Event) {
      const el = e.target;
      if (!(el instanceof HTMLElement) || el.closest(".reader-sheet, aside")) return;
      const top = el.scrollTop;
      const prev = lastTop.get(el) ?? top;
      lastTop.set(el, top);
      if (performance.now() < chromeLockRef.current) return;
      const dy = top - prev;
      if (top < 48) setChrome(false);
      else if (dy > 6) setChrome(true);
      else if (dy < -12) setChrome(false);
    }

    let down: { x: number; y: number; t: number } | null = null;
    function onPointerDown(e: PointerEvent) {
      down = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY, t: e.timeStamp };
    }
    function onPointerUp(e: PointerEvent) {
      const d = down;
      down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || e.timeStamp - d.t > 300) return;
      const t = e.target as HTMLElement | null;
      if (!t || t.closest("a, button, input, textarea, select, label, mark, [role], [contenteditable='true'], .reader-autohide, .reader-chrome-top, .reader-chrome-bottom, .reader-sheet, aside")) return;
      if (window.getSelection()?.isCollapsed === false) return;
      setChrome(!chromeHiddenRef.current);
    }

    root.addEventListener("scroll", onScroll, { capture: true, passive: true });
    root.addEventListener("pointerdown", onPointerDown, { passive: true });
    root.addEventListener("pointerup", onPointerUp, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll, { capture: true });
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerup", onPointerUp);
    };
  }, [isMobile, setChrome]);
  const showChrome = useCallback(() => setChrome(false), [setChrome]);

  // Mobile swipe drawer
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isEdgeSwipe = useRef(false);
  // Reader ẩn (keep-alive) không được mở drawer khi vuốt ở panel khác
  const isActiveReaderRef = useRef(true);
  isActiveReaderRef.current = activePanel === null || activePanel === `reader:${doc._id}`;

  useEffect(() => {
    if (!isMobile) return;

    // touchmove non-passive chỉ gắn trong lúc vuốt từ mép (40px) — gắn thường trực
    // trên document sẽ bắt trình duyệt chờ JS ở MỌI lần cuộn → giật.
    function onTouchMove(e: TouchEvent) {
      if (!isEdgeSwipe.current) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dy > 30) { isEdgeSwipe.current = false; detachMove(); return; }
      // Prevent browser back/forward navigation when handling edge swipe
      if (Math.abs(dx) > 10) e.preventDefault();
    }

    function detachMove() {
      document.removeEventListener("touchmove", onTouchMove);
    }

    function onTouchStart(e: TouchEvent) {
      if (!isActiveReaderRef.current || window.innerWidth >= 1024) { isEdgeSwipe.current = false; return; }
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isEdgeSwipe.current = touchStartX.current < 40 || navDrawer.get();
      if (isEdgeSwipe.current) {
        document.addEventListener("touchmove", onTouchMove, { passive: false });
      }
    }

    function onTouchEnd(e: TouchEvent) {
      detachMove();
      if (!isEdgeSwipe.current) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (dy > 80) return;
      if (!navDrawer.get() && dx > 50) openNavDrawer();
      if (navDrawer.get() && dx < -50) closeNavDrawer();
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", detachMove, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", detachMove);
      detachMove();
    };
  }, [isMobile]);

  // Auto-register current doc as a tab when entering reader
  const tabOpened = useRef(false);
  useEffect(() => {
    if (tabOpened.current || tabsLoading) return;
    const isAlreadyOpen = allTabs.some((t) => t.docId === doc._id);
    tabOpened.current = true;
    if (!isAlreadyOpen) {
      openTab(doc._id).catch(() => {});
    }
  }, [tabsLoading, doc._id, openTab, allTabs]);

  const jumpHandlerRef = useRef<((pos: ReadingPosition) => void) | null>(null);
  const registerJump = useCallback((fn: (pos: ReadingPosition) => void) => {
    jumpHandlerRef.current = fn;
  }, []);
  const jumpTo = useCallback((pos: ReadingPosition) => {
    jumpHandlerRef.current?.(pos);
  }, []);

  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current || progress === undefined) return;
    recorded.current = true;
    recordOpen(doc._id, progress?.positionType, progress?.positionValue).catch(() => {});
  }, [progress, doc._id]);

  // Context + typography ổn định → viewer (memo) không re-render khi ReaderShell re-render
  const progressCtx = useMemo(
    () => ({ savePosition: savePositionWithTab, jumpTo, registerJump }),
    [savePositionWithTab, jumpTo, registerJump]
  );
  const isTextFormat = TEXT_FORMATS.has(doc.format);
  const viewerTypography = useMemo(
    () => isTextFormat
      ? { fontFamily: typography.fontFamily, fontSize: typography.fontSize, lineHeight: typography.lineHeight, colWidthClass: typography.colWidthClass }
      : undefined,
    [isTextFormat, typography.fontFamily, typography.fontSize, typography.lineHeight, typography.colWidthClass]
  );
  const extractedText = (doc as unknown as { extractedText?: string }).extractedText ?? "";
  const savedPct = progress?.progressPct != null ? Math.round(progress.progressPct * 100) : null;

  return (
    <ReaderProgressContext.Provider value={progressCtx}>
      <div ref={containerRef} data-chrome={chromeHidden ? "hidden" : "shown"} className="relative flex h-full flex-col overflow-hidden bg-background transition-colors">
        <div aria-hidden className="reader-safe-cover pointer-events-none absolute inset-x-0 top-0 z-20 bg-background" style={{ height: "var(--safe-top)" }} />
        {/* Reading Mode exit button */}
        {readingMode && (
          <button
            onClick={toggleFullscreen}
            style={{ top: "calc(var(--safe-top) + 1rem)" }}
            className="fixed right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
            aria-label="Thoát Reading Mode"
          >
            <X className="h-5 w-5" />
          </button>
        )}


        {!readingMode && (
          <header
            className="reader-chrome-top box-content flex h-12 shrink-0 items-center justify-between border-b border-border/70 bg-card px-3 sm:px-4"
            style={{ paddingTop: 'var(--safe-top)' }}
          >
            {/* Left: Sidebar toggle / Logo */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl lg:hidden" onClick={() => openNavDrawer()} aria-label="Mở menu">
                <Menu className="h-4 w-4" />
              </Button>
              <span className="lg:hidden"><AppLogo size={28} /></span>
            </div>

            {/* Center: Prominent Document Title + Format pill (Apple Books centered style) */}
            <div className="flex items-center justify-center gap-2 min-w-0 px-2 flex-1 max-w-[500px]">
              <span className="hidden sm:inline-flex rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase shrink-0">
                {doc.format}
              </span>
              <h1 className="truncate font-display text-sm sm:text-base font-semibold text-foreground/90 text-center" title={doc.title}>
                {doc.title}
              </h1>
            </div>

            {/* Right: Zen reading tools & More dropdown */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <ProgressSaveIndicator status={saveStatus} onSaveNow={saveNow} />
              
              {/* Nút Màu giấy & Cỡ chữ (Craft / Apple Books Theme) */}
              <button
                onClick={openReadingSettings}
                title="Màu giấy & Cỡ chữ"
                aria-label="Màu giấy & Cỡ chữ"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
              >
                <Palette className="h-4 w-4" />
              </button>

              <ReadingHistoryPopover docId={doc._id} onJump={jumpTo} />

              {/* Zen Fullscreen */}
              <button
                onClick={toggleFullscreen}
                title="Toàn màn hình (Zen Mode)"
                aria-label="Toàn màn hình"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              {/* Menu Thao tác (Gom gọn các nút Download, Export, Tìm kiếm, Đăng xuất) */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                  aria-label="Tuỳ chọn"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => openSearch()}>
                    <Search className="mr-2 h-4 w-4" /> Tìm kiếm (Cmd+K)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportDoc(doc._id)} disabled={isExporting}>
                    <Download className="mr-2 h-4 w-4" /> Export ZIP (file + ghi chú)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" /> Tải xuống tài liệu
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => confirmLeave(() => navigate("/library"))}>
                    Về Thư viện
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => confirmLeave(() => navigate("/notes"))}>
                    <StickyNote className="mr-2 h-4 w-4" /> Ghi chú
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => confirmLeave(() => navigate("/settings"))}>
                    <Settings className="mr-2 h-4 w-4" /> Cài đặt
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => { await signOut(); router.push("/login"); }} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
        )}

        {!readingMode && (
          <div className="reader-chrome-top flex flex-col shrink-0 bg-card">
            {showDropdown
              ? <TabDropdown
                  currentDocId={doc._id}
                  noteTabs={noteTabs}
                  activeNoteId={activeNoteId}
                  onSelectNoteTab={(id) => {
                    setActiveNoteId(id as Id<"notes">);
                    setActivePanel("notes");
                    pushUrl("/notes");
                  }}
                  onCloseNoteTab={(id) => closeNoteTab(id as Id<"notes">)}
                />
              : <TabBar
                  currentDocId={doc._id}
                  showAddButton
                  noteTabs={noteTabs}
                  activeNoteId={activeNoteId}
                  onSelectNoteTab={(id) => {
                    setActiveNoteId(id as Id<"notes">);
                    setActivePanel("notes");
                    pushUrl("/notes");
                  }}
                  onCloseNoteTab={(id) => closeNoteTab(id as Id<"notes">)}
                  onAddNote={handleNewNote}
                />}
          </div>
        )}

        <div className="reader-body flex flex-1 flex-col overflow-hidden" style={{ minHeight: 0 }}>
          <ViewerDispatcher
            doc={doc}
            downloadUrl={downloadUrl}
            highlightQuery={highlightQuery}
            typography={viewerTypography}
            onTranscribeRunningChange={setTranscribeRunning}
          />
        </div>

        {/* Progress bar + time estimate */}
        <ReaderProgressBar store={pctStore} savedPct={savedPct} extractedText={extractedText} pillVisible={chromeHidden && !readingMode} onPillClick={showChrome} />
      </div>
      <BottomSheet open={moreMenuOpen} onClose={() => setMoreMenuOpen(false)} title="Thêm">
        <div className="flex flex-col gap-2 py-2">
          <button
            onClick={() => { setMoreMenuOpen(false); toggleFullscreen(); }}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-muted transition-colors"
          >
            <Maximize2 className="h-5 w-5 text-muted-foreground" />
            Xem toàn màn hình (Focus)
          </button>
          <button
            onClick={() => { setMoreMenuOpen(false); exportDoc(doc._id); }}
            disabled={isExporting}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="h-5 w-5 text-muted-foreground" />
            Export ZIP (file + highlights + ghi chú)
          </button>
          <button
            onClick={() => { setMoreMenuOpen(false); handleDownload(); }}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-muted transition-colors"
          >
            <Download className="h-5 w-5 text-muted-foreground" />
            Tải xuống tài liệu
          </button>
          <button
            onClick={() => { setMoreMenuOpen(false); openSearch(); }}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-muted transition-colors"
          >
            <Search className="h-5 w-5 text-muted-foreground" />
            Tìm kiếm
          </button>
          <button
            onClick={async () => { setMoreMenuOpen(false); await signOut(); router.push("/login"); }}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-muted transition-colors text-destructive"
          >
            <LogOut className="h-5 w-5" />
            Đăng xuất
          </button>
        </div>
      </BottomSheet>
    </ReaderProgressContext.Provider>
  );
}

// Module-level URL cache — persists across tab navigations within the session
const urlCache = new Map<string, { url: string; fetchedAt: number }>();
const URL_TTL_MS = 4 * 60 * 1000; // 4 min — conservative (Convex presigned URLs can expire)

export function getCachedUrl(docId: string) {
  const entry = urlCache.get(docId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > URL_TTL_MS) { urlCache.delete(docId); return null; }
  return entry.url;
}

export function setCachedUrl(docId: string, url: string) {
  urlCache.set(docId, { url, fetchedAt: Date.now() });
}

export function evictCachedUrl(docId: string) {
  urlCache.delete(docId);
}

// ReaderDocLoader — used by AppShell keep-alive: receives docId as prop instead of useParams
export function ReaderDocLoader({ docId }: { docId: Id<"documents"> }) {
  const { navigate } = useActiveTab();
  const doc = useDocument(docId);

  const [downloadUrl, setDownloadUrl] = useState<string | null>(() => getCachedUrl(docId));
  const [urlError, setUrlError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);

  useEffect(() => {
    if (!doc) return;
    if (getCachedUrl(docId)) return;

    setUrlError(null);
    setSlowLoad(false);

    // Show "retry" hint after 8s if still loading
    const slowTimer = setTimeout(() => setSlowLoad(true), 8_000);

    // Wrap action with 15s timeout to avoid infinite spinner on mobile
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tải file quá chậm, vui lòng thử lại")), 15_000)
    );

    Promise.race([getDownloadUrl(docId), timeoutPromise])
      .then((url) => { setCachedUrl(docId, url); setDownloadUrl(url); })
      .catch((e) => setUrlError(e instanceof Error ? e.message : "Không thể tải file"))
      .finally(() => clearTimeout(slowTimer));

    return () => clearTimeout(slowTimer);
  }, [doc, docId, getDownloadUrl, retryCount]);

  if (doc === undefined) return <FullPageSpinner />;
  if (doc === null) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Không tìm thấy tài liệu.</p>
        <Button variant="outline" onClick={() => navigate("/library")}>Về thư viện</Button>
      </div>
    );
  }

  if (urlError) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4" style={{ paddingTop: 'var(--safe-top)' }}>
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Thư viện
          </Button>
          <span className="flex-1 truncate text-sm font-medium">{doc.title}</span>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-destructive text-sm">{urlError}</p>
          <Button variant="outline" size="sm" onClick={() => { setRetryCount((c) => c + 1); setUrlError(null); }}>
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  if (!downloadUrl) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4" style={{ paddingTop: 'var(--safe-top)' }}>
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Thư viện
          </Button>
          <span className="flex-1 truncate text-sm font-medium">{doc.title}</span>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {slowLoad && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground">Mạng chậm, đang chờ kết nối…</p>
              <Button variant="outline" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
                Thử lại
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <ReaderShell doc={doc as unknown as React.ComponentProps<typeof ReaderShell>["doc"]} downloadUrl={downloadUrl} />;
}

export default function ReaderPageInner() {
  const router = useRouter();
  const params = useParams();
  const docId = params.docId as Id<"documents">;

  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [session, isPending, router]);

  if (isPending) return <FullPageSpinner />;
  if (!session) return null;

  return <ReaderDocLoader docId={docId} />;
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
