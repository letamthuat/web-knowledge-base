"use client";

/**
 * AppShell — keeps Library, Notes, Settings AND open reader tabs mounted permanently.
 * Switching tabs uses CSS visibility instead of navigation:
 * no unmount/remount, no re-fetch, zero perceived latency.
 *
 * Reader tabs are lazy-mounted: only mount on first activation, then stay mounted.
 * Non-tab routes (login, offline) fall through via {children}.
 */
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef } from "react";
import { useTabSync } from "@/hooks/useTabSync";
import { Id } from "@/_generated/dataModel";
import { ActiveTabProvider, useActiveTab } from "@/contexts/ActiveTabContext";

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
const ReaderDocLoader = dynamic(
  () => import("@/app/reader/[docId]/ReaderPageInner").then((m) => m.ReaderDocLoader),
  { ssr: false }
);

function pathnameToPanel(pathname: string): string | null {
  if (pathname === "/library" || pathname.startsWith("/library/")) return "library";
  if (pathname === "/notes"   || pathname.startsWith("/notes/"))   return "notes";
  if (pathname === "/settings"|| pathname.startsWith("/settings/"))return "settings";
  const m = pathname.match(/^\/reader\/([^/]+)/);
  if (m) return `reader:${m[1]}`;
  return null;
}

// Each tab panel: always in the DOM once mounted, visible only when active.
function TabPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      style={
        active
          ? { position: "relative", width: "100%", height: "100%" }
          : { position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
              visibility: "hidden", pointerEvents: "none", zIndex: -1 }
      }
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activePanel, setActivePanel } = useActiveTab();
  const { tabs } = useTabSync();

  // Track which reader docIds have been activated at least once (lazy mount)
  const mountedReaderIds = useRef<Set<string>>(new Set());

  // Sync active panel from Next.js router (handles initial load + browser back/forward)
  const routerPanel = pathnameToPanel(pathname);
  useEffect(() => {
    if (routerPanel) setActivePanel(routerPanel);
  }, [routerPanel, setActivePanel]);

  // Determine which panel to show: context-driven (instant) with router as fallback
  const current = activePanel ?? routerPanel;

  // Track which reader tabs to mount (lazy: only once activated AND tab exists in Convex)
  if (current?.startsWith("reader:")) {
    const docId = current.slice("reader:".length);
    if (tabs.some((t) => t.docId === docId)) {
      mountedReaderIds.current.add(docId);
    }
  }

  // Non-shell route (login, offline, etc.)
  if (!current) {
    return <>{children}</>;
  }

  // Only render reader tabs that have been activated at least once
  const mountedTabs = tabs.filter((t) => mountedReaderIds.current.has(t.docId as string));

  // If current panel is a reader tab but not yet in mountedTabs (tab not in Convex yet,
  // or first navigation), fall through to {children} which is the page.tsx ReaderPageInner.
  const activeDocId = current?.startsWith("reader:") ? current.slice("reader:".length) : null;
  const activeTabMounted = activeDocId ? mountedTabs.some((t) => t.docId === activeDocId) : true;

  if (!activeTabMounted) {
    // Tab not yet mounted — let Next.js page render normally (children = ReaderPageInner)
    return <>{children}</>;
  }

  return (
    <>
      <TabPanel active={current === "library"}>
        <LibraryPageInner />
      </TabPanel>
      <TabPanel active={current === "notes"}>
        <NotesPageInner />
      </TabPanel>
      <TabPanel active={current === "settings"}>
        <SettingsPageInner />
      </TabPanel>
      {mountedTabs.map((tab) => (
        <TabPanel
          key={tab._id}
          active={current === `reader:${tab.docId}`}
        >
          <ReaderDocLoader docId={tab.docId as Id<"documents">} />
        </TabPanel>
      ))}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ActiveTabProvider>
      <AppShellContent>{children}</AppShellContent>
    </ActiveTabProvider>
  );
}
