"use client";

/**
 * AppShell — keeps Library, Notes, Settings AND open reader tabs mounted permanently.
 * Switching tabs uses CSS visibility instead of navigation:
 * no unmount/remount, no re-fetch, zero perceived latency.
 *
 * Reader tabs are lazy-mounted on first activation using docId directly.
 * Non-tab routes (login, offline) fall through via {children}.
 */
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef, memo } from "react";
import { ActiveTabProvider, useActiveTab } from "@/contexts/ActiveTabContext";
import { useTabSync } from "@/hooks/useTabSync";
import { useResizable } from "@/hooks/useResizable";
import { Id } from "@/_generated/dataModel";
import { X } from "lucide-react";
// Direct import so the chunk is always bundled with AppShell — no lazy load delay on first switch
import { ReaderDocLoader } from "@/app/reader/[docId]/ReaderPageInner";
import { HandbookSidebar } from "@/components/handbook/HandbookSidebar";
import { GlobalSearch } from "@/components/search/SearchModal";
import { pathnameToPanel } from "@/lib/panels";

const LibraryPageInner = dynamic(
  () => import("@/components/library/LibraryPageInner").then((m) => m.LibraryPageInner),
  { ssr: false }
);
const NotesPageInner = dynamic(
  () => import("@/components/notes/NotesPageInner").then((m) => m.NotesPageInner),
  { ssr: false }
);
const SettingsPageInner = dynamic(
  () => import("@/components/settings/SettingsPageInner").then((m) => m.SettingsPageInner),
  { ssr: false }
);
const TrashPageInner = dynamic(
  () => import("@/components/library/TrashPageInner").then((m) => m.TrashPageInner),
  { ssr: false }
);
const StudyPageInner = dynamic(
  () => import("@/components/study/StudyPageInner").then((m) => m.StudyPageInner),
  { ssr: false }
);

// Preload all dynamic chunks immediately so they're ready before user taps a tab
if (typeof window !== "undefined") {
  import("@/components/library/LibraryPageInner");
  import("@/components/notes/NotesPageInner");
  import("@/components/settings/SettingsPageInner");
  import("@/components/library/TrashPageInner");
  import("@/components/study/StudyPageInner");
}


const TabPanel = memo(function TabPanel({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  return (
    <div
      data-panel={id}
      style={
        active
          ? { position: "absolute", inset: 0, visibility: "visible", pointerEvents: "auto", overflowY: "auto", overflowX: "hidden" }
          : { position: "absolute", inset: 0, visibility: "hidden", pointerEvents: "none", overflowY: "auto", overflowX: "hidden" }
      }
      aria-hidden={!active}
    >
      {children}
    </div>
  );
});

function AppShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activePanel, setActivePanel, secondaryDocId, closeSecondary } = useActiveTab();
  const { tabs } = useTabSync();
  const split = useResizable(60, 25, 80);

  // Ordered list of docIds that have been mounted (append-only, never shrinks)
  // Using ref so mutations during render don't cause extra re-renders
  const mountedDocIds = useRef<string[]>([]);

  // Pre-mount the currently active tab from Convex on initial load
  const activeConvexTab = tabs.find((t) => t.isActive);
  if (activeConvexTab) {
    const docId = activeConvexTab.docId as string;
    if (!mountedDocIds.current.includes(docId)) {
      mountedDocIds.current = [...mountedDocIds.current, docId];
    }
  }

  // Sync active panel from Next.js router (handles initial load + browser back/forward)
  const routerPanel = pathnameToPanel(pathname);
  useEffect(() => {
    if (routerPanel) setActivePanel(routerPanel);
  }, [routerPanel, setActivePanel]);

  const current = activePanel ?? routerPanel;

  // Inline: when a reader panel becomes active, immediately add to mountedDocIds
  // Cap at 1 on mobile and 3 on desktop to keep DOM lean and 60fps smooth
  if (current?.startsWith("reader:")) {
    const docId = current.slice("reader:".length);
    const isMobileScreen = typeof window !== "undefined" && window.innerWidth < 1024;
    if (isMobileScreen) {
      if (mountedDocIds.current.length !== 1 || mountedDocIds.current[0] !== docId) {
        mountedDocIds.current = [docId];
      }
    } else if (!mountedDocIds.current.includes(docId)) {
      const updated = [...mountedDocIds.current, docId];
      mountedDocIds.current = updated.length > 3 ? updated.slice(updated.length - 3) : updated;
    }
  }

  // Non-shell route (login, offline, etc.)
  if (!current) {
    return <>{children}</>;
  }

  const splitActive = secondaryDocId !== null;

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", display: "flex" }}>
      {/* Sidebar chung — Domain/Handbook + Tài liệu lẻ (ẩn trên mobile) */}
      <HandbookSidebar />

      {/* Ô tìm kiếm duy nhất (Cmd/Ctrl+K + openSearch()), portal ra body */}
      <GlobalSearch />

      {/* Vùng nội dung (có thể split 2 pane) */}
      <div ref={split.containerRef} style={{ position: "relative", flex: 1, minWidth: 0, display: "flex" }}>
        {/* Pane trái = các panel chính */}
        <div style={{ position: "relative", minWidth: 0, width: splitActive ? `${split.leftPercent}%` : "100%", height: "100%" }}>
          <TabPanel id="library" active={current === "library"}>
            <LibraryPageInner />
          </TabPanel>
          <TabPanel id="notes" active={current === "notes"}>
            <NotesPageInner />
          </TabPanel>
          <TabPanel id="settings" active={current === "settings"}>
            <SettingsPageInner />
          </TabPanel>
          <TabPanel id="trash" active={current === "trash"}>
            <TrashPageInner />
          </TabPanel>
          <TabPanel id="study" active={current === "study"}>
            <StudyPageInner />
          </TabPanel>
          {mountedDocIds.current.map((docId) => (
            <TabPanel
              key={docId}
              id={`reader:${docId}`}
              active={current === `reader:${docId}`}
            >
              <ReaderDocLoader docId={docId as Id<"documents">} />
            </TabPanel>
          ))}
        </div>

        {/* Divider + pane phải (split-screen 13.1) */}
        {splitActive && (
          <>
            <div
              onMouseDown={split.onMouseDown}
              className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/40"
            />
            <div style={{ position: "relative", flex: 1, minWidth: 0, height: "100%" }}>
              <button
                onClick={closeSecondary}
                title="Đóng cửa sổ phải"
                className="absolute right-2 top-2 z-50 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
              <ReaderDocLoader docId={secondaryDocId as Id<"documents">} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ActiveTabProvider>
      <AppShellContent>{children}</AppShellContent>
    </ActiveTabProvider>
  );
}
