"use client";

/**
 * AppShell — keeps Library, Notes, Settings mounted permanently.
 * Switching tabs uses CSS visibility instead of navigation:
 * no unmount/remount, no re-fetch, zero perceived latency.
 *
 * Non-tab routes (reader, login, offline) fall through via {children}.
 */
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { type ReactNode } from "react";

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

function getActiveTab(pathname: string) {
  if (pathname === "/library" || pathname.startsWith("/library/")) return "library";
  if (pathname === "/notes"   || pathname.startsWith("/notes/"))   return "notes";
  if (pathname === "/settings"|| pathname.startsWith("/settings/"))return "settings";
  return null;
}

// Each tab panel: always in the DOM, visible only when active.
// Use visibility+position instead of display:none so React doesn't
// lose internal state (scroll position, editor content, etc.).
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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeTab = getActiveTab(pathname);

  // Non-tab route — render normally (reader, login, offline, etc.)
  if (!activeTab) {
    return <>{children}</>;
  }

  return (
    <>
      <TabPanel active={activeTab === "library"}>
        <LibraryPageInner />
      </TabPanel>
      <TabPanel active={activeTab === "notes"}>
        <NotesPageInner />
      </TabPanel>
      <TabPanel active={activeTab === "settings"}>
        <SettingsPageInner />
      </TabPanel>
    </>
  );
}
