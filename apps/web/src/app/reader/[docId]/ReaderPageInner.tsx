"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabBar } from "@/components/tabs/TabBar";
import { TabDropdown } from "@/components/tabs/TabDropdown";
import { useTabSync } from "@/hooks/useTabSync";
import { useNoteTabs } from "@/hooks/useNoteTabs";

function ReaderShell({ doc, downloadUrl }: {
  doc: { _id: Id<"documents">; format: string; title: string };
  downloadUrl: string;
}) {
  const router = useRouter();
  const { saveNow, saveStatus, savePosition, progress } = useReadingProgress(doc._id);
  const { tabs: allTabs, isLoading: tabsLoading, openTab, updateScrollState } = useTabSync();
  const { noteTabs, activeNoteId, closeNoteTab, setActiveNoteId } = useNoteTabs();

  // Find the tab for this doc so we can persist scroll state into it
  const currentTab = allTabs.find((t) => t.docId === doc._id) ?? null;
  const currentTabId = currentTab?._id ?? null;

  // Wrap savePosition to also update scrollState in the tab (immediate, no throttle)
  const savePositionWithTab = useCallback(
    (pos: ReadingPosition, total?: number) => {
      savePosition(pos, total);
      if (currentTabId) {
        const scrollState = JSON.stringify(pos);
        updateScrollState(currentTabId, scrollState).catch(() => {});
      }
    },
    [savePosition, updateScrollState, currentTabId]
  );
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const showDropdown = isMobile;

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
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/library")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Thư viện
          </Button>
          <span className="flex-1 truncate text-sm font-medium">{doc.title}</span>
          <ReadingHistoryPopover docId={doc._id} onJump={jumpTo} />
          <ProgressSaveIndicator status={saveStatus} onSaveNow={saveNow} />
        </header>

        <div className="flex flex-1 flex-col overflow-hidden">
          {showDropdown
            ? <TabDropdown currentDocId={doc._id} />
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
          <ViewerDispatcher doc={doc} downloadUrl={downloadUrl} />
        </div>
      </div>
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Không tìm thấy tài liệu.</p>
        <Button variant="outline" onClick={() => router.push("/library")}>Về thư viện</Button>
      </div>
    );
  }

  if (urlError) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4">
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
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4">
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
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
