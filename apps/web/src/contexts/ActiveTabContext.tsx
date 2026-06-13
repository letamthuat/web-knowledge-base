"use client";

/**
 * ActiveTabContext — tracks which tab/panel is visible in AppShell.
 * Updated by TabBar clicks without triggering Next.js navigation.
 * Format: "library" | "notes" | "settings" | "reader:<docId>"
 *
 * secondaryDocId (13.1) — khi set, AppShell hiển thị split-screen 2 pane:
 * pane trái = panel hiện tại, pane phải = secondaryDocId.
 */
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

interface ActiveTabContextValue {
  activePanel: string | null;
  setActivePanel: (panel: string) => void;
  secondaryDocId: string | null;
  openSecondary: (docId: string) => void;
  closeSecondary: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const ActiveTabContext = createContext<ActiveTabContextValue | null>(null);

export function ActiveTabProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanelState] = useState<string | null>(null);
  const [secondaryDocId, setSecondaryDocId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpenState] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar_open");
      return saved !== "false";
    }
    return true;
  });

  const setActivePanel = useCallback((panel: string) => {
    setActivePanelState(panel);
  }, []);

  const openSecondary = useCallback((docId: string) => {
    // Bỏ qua trên màn hình nhỏ — split chỉ cho desktop
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setActivePanelState(`reader:${docId}`);
      return;
    }
    setSecondaryDocId(docId);
  }, []);

  const closeSecondary = useCallback(() => setSecondaryDocId(null), []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar_open", String(open));
    }
  }, []);

  const value = useMemo(
    () => ({ activePanel, setActivePanel, secondaryDocId, openSecondary, closeSecondary, sidebarOpen, setSidebarOpen }),
    [activePanel, setActivePanel, secondaryDocId, openSecondary, closeSecondary, sidebarOpen, setSidebarOpen]
  );

  return (
    <ActiveTabContext.Provider value={value}>
      {children}
    </ActiveTabContext.Provider>
  );
}

const noop = () => {};

export function useActiveTab() {
  const ctx = useContext(ActiveTabContext);
  if (!ctx) {
    return {
      activePanel: null,
      setActivePanel: noop as (panel: string) => void,
      secondaryDocId: null,
      openSecondary: noop as (docId: string) => void,
      closeSecondary: noop,
      sidebarOpen: true,
      setSidebarOpen: noop as (open: boolean) => void,
    };
  }
  return ctx;
}
