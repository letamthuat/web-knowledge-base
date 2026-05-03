"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { useSession } from "@/lib/auth-client";
import { ViewerDispatcher } from "@/components/viewers/ViewerDispatcher";
import { ProgressSaveIndicator } from "@/components/viewers/ProgressSaveIndicator";
import { ReaderProgressContext } from "@/components/viewers/ReaderProgressContext";
import { ReadingHistoryPopover } from "@/components/viewers/ReadingHistoryPopover";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import type { ReadingPosition } from "@/lib/position";
import { toProgressPct } from "@/lib/position";
import { ArrowLeft, BookOpen, StickyNote, Settings, X, LogOut, Menu, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { toast } from "sonner";
import { TabBar } from "@/components/tabs/TabBar";
import { TabDropdown } from "@/components/tabs/TabDropdown";
import { useTabSync } from "@/hooks/useTabSync";
import { useNoteTabs } from "@/hooks/useNoteTabs";
import { SearchModal } from "@/components/search/SearchModal";
import { Search } from "lucide-react";
import { useAppTypography } from "@/components/AppSettingsPanel";

function ReaderShell({ doc, downloadUrl }: {
  doc: { _id: Id<"documents">; format: string; title: string };
  downloadUrl: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightQuery = searchParams.get("q") ?? undefined;
  const { data: session } = useSession();
  const { saveNow, saveStatus, savePosition, progress } = useReadingProgress(doc._id);
  const { tabs: allTabs, isLoading: tabsLoading, openTab, updateScrollState } = useTabSync();
  const { noteTabs, activeNoteId, closeNoteTab, setActiveNoteId } = useNoteTabs();

  const [searchOpen, setSearchOpen] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [localPct, setLocalPct] = useState<number | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const typography = useAppTypography();
  const TEXT_FORMATS = new Set(["markdown", "epub", "docx", "web_clip"]);
  const READING_MODE_FORMATS = new Set(["pdf", "epub", "docx", "markdown", "web_clip"]);

  // Cmd/Ctrl+K + Reading Mode shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // Cmd/Ctrl+Shift+R or F → toggle reading mode
      if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "r") ||
          (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey)) {
        e.preventDefault();
        if (!READING_MODE_FORMATS.has(doc.format)) {
          toast("Reading Mode chỉ dành cho định dạng đọc");
          return;
        }
        setReadingMode((v) => !v);
        return;
      }

      // Esc → exit reading mode (only when search modal is closed)
      if (e.key === "Escape" && !searchOpen) {
        setReadingMode(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc.format, searchOpen]);

  // Header auto-hide: hide after 3s of no interaction, show on tap/move
  const resetHeaderTimer = useCallback(() => {
    setHeaderVisible(true);
    clearTimeout(headerTimerRef.current);
    headerTimerRef.current = setTimeout(() => setHeaderVisible(false), 3000);
  }, []);

  useEffect(() => {
    resetHeaderTimer();
    document.addEventListener("pointermove", resetHeaderTimer, { passive: true });
    document.addEventListener("touchstart", resetHeaderTimer, { passive: true });
    return () => {
      clearTimeout(headerTimerRef.current);
      document.removeEventListener("pointermove", resetHeaderTimer);
      document.removeEventListener("touchstart", resetHeaderTimer);
    };
  }, [resetHeaderTimer]);

  // Find the tab for this doc so we can persist scroll state into it
  const currentTab = allTabs.find((t) => t.docId === doc._id) ?? null;
  const currentTabId = currentTab?._id ?? null;

  // Wrap savePosition to also update scrollState in the tab + update local progress pct
  const savePositionWithTab = useCallback(
    (pos: ReadingPosition, total?: number) => {
      savePosition(pos, total);
      // Update localPct immediately for realtime progress bar
      const pct = toProgressPct(pos, total);
      if (pct !== null) setLocalPct(Math.round(pct * 100));
      if (currentTabId) {
        const scrollState = JSON.stringify(pos);
        updateScrollState(currentTabId, scrollState).catch(() => {});
      }
    },
    [savePosition, updateScrollState, currentTabId]
  );
  const getDownloadUrl = useAction(api.documents.actions.getDownloadUrl);
  const FORMAT_EXT: Record<string, string> = {
    pdf: ".pdf", epub: ".epub", docx: ".docx", pptx: ".pptx",
    image: ".jpg", audio: ".mp3", video: ".mp4", markdown: ".md", web_clip: ".html",
  };
  async function handleDownload() {
    try {
      const url = await getDownloadUrl({ docId: doc._id });
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
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const showDropdown = isMobile;

  // Mobile swipe drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerOpenRef = useRef(drawerOpen);
  drawerOpenRef.current = drawerOpen;
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isEdgeSwipe = useRef(false);

  useEffect(() => {
    if (!isMobile) return;

    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isEdgeSwipe.current = touchStartX.current < 40 || drawerOpenRef.current;
    }

    function onTouchMove(e: TouchEvent) {
      if (!isEdgeSwipe.current) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dy > 30) { isEdgeSwipe.current = false; return; }
      // Prevent browser back/forward navigation when handling edge swipe
      if (Math.abs(dx) > 10) e.preventDefault();
    }

    function onTouchEnd(e: TouchEvent) {
      if (!isEdgeSwipe.current) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (dy > 80) return;
      if (!drawerOpenRef.current && dx > 50) setDrawerOpen(true);
      if (drawerOpenRef.current && dx < -50) setDrawerOpen(false);
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isMobile]);

  // Auto-register current doc as a tab when entering reader
  const tabOpened = useRef(false);
  useEffect(() => {
    if (tabOpened.current || tabsLoading) return;
    tabOpened.current = true;
    openTab(doc._id).catch(() => {});
  }, [tabsLoading, doc._id, openTab]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordOpen = useMutation((api as any).reading_history.mutations.recordOpen);

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
    recordOpen({
      docId: doc._id,
      positionType: progress?.positionType as ReadingPosition["type"] | undefined,
      positionValue: progress?.positionValue,
    }).catch(() => {});
  }, [progress, doc._id, recordOpen]);

  return (
    <ReaderProgressContext.Provider value={{ saveNow, saveStatus, savePosition: savePositionWithTab, jumpTo, registerJump }}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background transition-colors">
        {/* Reading Mode exit button */}
        {readingMode && (
          <button
            onClick={() => setReadingMode(false)}
            className="fixed top-4 right-4 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
            aria-label="Thoát Reading Mode"
          >
            <X className="h-4 w-4" />
          </button>
        )}


        {/* Mobile swipe drawer */}
        {isMobile && drawerOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 bg-background border-r shadow-xl flex flex-col p-4 gap-1">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm">Menu</span>
                <button onClick={() => setDrawerOpen(false)} className="rounded p-1.5 hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button onClick={() => { setDrawerOpen(false); router.push("/library"); }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
                <BookOpen className="h-4 w-4" /> Thư viện
              </button>
              <button onClick={() => { setDrawerOpen(false); router.push("/notes"); }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
                <StickyNote className="h-4 w-4" /> Ghi chú
              </button>
              <button onClick={() => { setDrawerOpen(false); router.push("/settings"); }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
                <Settings className="h-4 w-4" /> Cài đặt
              </button>
            </aside>
          </div>
        )}
        {!readingMode && <header
          className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-4 transition-opacity duration-300"
          style={{ paddingTop: 'var(--safe-top)', opacity: headerVisible ? 1 : 0, pointerEvents: headerVisible ? undefined : 'none' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" className="p-1.5 shrink-0 md:hidden" onClick={() => setDrawerOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold hidden md:inline">Web Knowledge Base</span>
          </div>

          <nav className="hidden md:flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => router.push("/library")}>Thư viện</Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/notes")}>
              <StickyNote className="mr-1.5 h-3.5 w-3.5" />Ghi chú
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/settings")}>
              <Settings className="mr-1 h-4 w-4" />Cài đặt
            </Button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <ProgressSaveIndicator status={saveStatus} onSaveNow={saveNow} />
            <ReadingHistoryPopover docId={doc._id} onJump={jumpTo} />
            <Button variant="ghost" size="sm" onClick={handleDownload} title="Tải xuống tài liệu" className="gap-1">
              <Download className="h-4 w-4" />
              <span className="hidden md:inline">Tải xuống</span>
            </Button>
            <span className="hidden lg:inline text-sm text-muted-foreground">{session?.user?.email}</span>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex md:hidden items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Tìm kiếm"
            >
              <Search className="h-4 w-4" />
            </button>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); router.push("/login"); }} className="gap-1">
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Đăng xuất</span>
            </Button>
          </div>
        </header>}

        {!readingMode && (
          <div className="flex flex-col shrink-0">
            {showDropdown
              ? <TabDropdown
                  currentDocId={doc._id}
                  noteTabs={noteTabs}
                  activeNoteId={activeNoteId}
                  onSelectNoteTab={(id) => { setActiveNoteId(id as Id<"notes">); router.push("/notes"); }}
                  onCloseNoteTab={(id) => closeNoteTab(id as Id<"notes">)}
                />
              : <TabBar
                  currentDocId={doc._id}
                  showAddButton
                  noteTabs={noteTabs}
                  activeNoteId={activeNoteId}
                  onSelectNoteTab={(id) => {
                    setActiveNoteId(id as Id<"notes">);
                    router.push("/notes");
                  }}
                  onCloseNoteTab={(id) => closeNoteTab(id as Id<"notes">)}
                />}
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <ViewerDispatcher
            doc={doc}
            downloadUrl={downloadUrl}
            highlightQuery={highlightQuery}
            typography={TEXT_FORMATS.has(doc.format) ? { fontFamily: typography.fontFamily, fontSize: typography.fontSize, lineHeight: typography.lineHeight, colWidthClass: typography.colWidthClass } : undefined}
          />
        </div>

        {/* Progress bar + time estimate */}
        {(() => {
          const pct = localPct ?? (progress?.progressPct != null ? Math.round(progress.progressPct * 100) : null);
          if (pct == null || pct <= 0) return null;
          const extractedText = (doc as unknown as { extractedText?: string }).extractedText ?? "";
          const wordCount = extractedText ? extractedText.trim().split(/\s+/).length : 0;
          const WPM = 200;
          const wordsLeft = wordCount > 0 ? Math.round(wordCount * (1 - pct / 100)) : 0;
          const minsLeft = wordCount > 0 ? Math.round(wordsLeft / WPM) : 0;
          const pctDisplay = Math.round(pct);
          return (
            <div className="shrink-0 border-t bg-card/80 backdrop-blur-sm px-4 py-1.5 flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pctDisplay}%` }} />
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                {pctDisplay}%{minsLeft > 0 ? ` · Còn ~${minsLeft} phút` : ""}
              </span>
            </div>
          );
        })()}
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </ReaderProgressContext.Provider>
  );
}

// Module-level URL cache — persists across tab navigations within the session
const urlCache = new Map<string, { url: string; fetchedAt: number }>();
const URL_TTL_MS = 10 * 60 * 1000; // 10 min (R2 presigned = 15 min)

export function getCachedUrl(docId: string) {
  const entry = urlCache.get(docId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > URL_TTL_MS) { urlCache.delete(docId); return null; }
  return entry.url;
}

export function setCachedUrl(docId: string, url: string) {
  urlCache.set(docId, { url, fetchedAt: Date.now() });
}

export default function ReaderPageInner() {
  const router = useRouter();
  const params = useParams();
  const docId = params.docId as Id<"documents">;

  const { data: session, isPending } = useSession();
  const doc = useQuery(api.documents.queries.getById, { docId });
  const getDownloadUrl = useAction(api.documents.actions.getDownloadUrl);

  const [downloadUrl, setDownloadUrl] = useState<string | null>(() => getCachedUrl(docId));
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [session, isPending, router]);

  useEffect(() => {
    if (!doc) return;
    // Already have a fresh cached URL — no fetch needed
    if (getCachedUrl(docId)) return;
    getDownloadUrl({ docId })
      .then((url) => { setCachedUrl(docId, url); setDownloadUrl(url); })
      .catch((e) => setUrlError(e instanceof Error ? e.message : "Không thể tải file"));
  }, [doc, docId, getDownloadUrl]);

  if (isPending) return <FullPageSpinner />;
  if (!session) return null;
  if (doc === undefined) return <FullPageSpinner />;
  if (doc === null) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Không tìm thấy tài liệu.</p>
        <Button variant="outline" onClick={() => router.push("/library")}>Về thư viện</Button>
      </div>
    );
  }

  if (urlError) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4" style={{ paddingTop: 'var(--safe-top)' }}>
          <Button variant="ghost" size="sm" onClick={() => router.push("/library")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Thư viện
          </Button>
          <span className="flex-1 truncate text-sm font-medium">{doc.title}</span>
        </header>
        <div className="flex flex-1 items-center justify-center text-destructive text-sm">{urlError}</div>
      </div>
    );
  }

  // Show layout immediately with doc data; viewer shows its own loading if URL not yet ready
  if (!downloadUrl) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4" style={{ paddingTop: 'var(--safe-top)' }}>
          <Button variant="ghost" size="sm" onClick={() => router.push("/library")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Thư viện
          </Button>
          <span className="flex-1 truncate text-sm font-medium">{doc.title}</span>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return <ReaderShell doc={doc} downloadUrl={downloadUrl} />;
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
