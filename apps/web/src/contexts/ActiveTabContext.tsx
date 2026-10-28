"use client";

/**
 * ActiveTabContext — tracks which tab/panel is visible in AppShell.
 * Updated by TabBar clicks without triggering Next.js navigation.
 * Format: "library" | "notes" | "settings" | "reader:<docId>"
 *
 * secondaryDocId (13.1) — khi set, AppShell hiển thị split-screen 2 pane:
 * pane trái = panel hiện tại, pane phải = secondaryDocId.
 */
import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { runViewTransition } from "@/lib/viewTransition";
import { pathnameToPanel } from "@/lib/panels";

interface ActiveTabContextValue {
  activePanel: string | null;
  setActivePanel: (panel: string) => void;
  /**
   * Điều hướng trong app shell không qua server (pushState + đổi panel) có hiệu ứng chuyển màn.
   * `from`: card nguồn để morph sang panel đích. URL ngoài shell → fallback location.assign.
   */
  navigate: (url: string, opts?: { from?: HTMLElement | null; replace?: boolean }) => void;
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

  // Ref để callback ổn định mà vẫn biết panel hiện tại / panel đang chờ transition
  const activeRef = useRef<string | null>(null);
  activeRef.current = activePanel;
  const pendingRef = useRef<string | null>(null);

  const switchPanel = useCallback((panel: string, extra?: () => void, from?: HTMLElement | null) => {
    if (panel === pendingRef.current) { extra?.(); return; }
    // Lần set đầu (khởi động) hoặc cùng panel → không cần hiệu ứng
    if (activeRef.current === null || panel === activeRef.current) {
      setActivePanelState(panel);
      extra?.();
      return;
    }
    pendingRef.current = panel;
    runViewTransition(
      () => {
        pendingRef.current = null;
        setActivePanelState(panel);
        extra?.();
      },
      { from, toSelector: `[data-panel="${CSS.escape(panel)}"]` }
    );
  }, []);

  const setActivePanel = useCallback((panel: string) => switchPanel(panel), [switchPanel]);

  const navigate = useCallback((url: string, opts?: { from?: HTMLElement | null; replace?: boolean }) => {
    const target = new URL(url, window.location.href);
    const panel = pathnameToPanel(target.pathname);
    if (!panel) { window.location.assign(url); return; }
    const writeUrl = () => {
      const next = target.pathname + target.search + target.hash;
      if (window.location.pathname + window.location.search + window.location.hash === next) return;
      if (opts?.replace) window.history.replaceState(null, "", next);
      else window.history.pushState(null, "", next);
    };
    switchPanel(panel, writeUrl, opts?.from);
  }, [switchPanel]);

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
    () => ({ activePanel, setActivePanel, navigate, secondaryDocId, openSecondary, closeSecondary, sidebarOpen, setSidebarOpen }),
    [activePanel, setActivePanel, navigate, secondaryDocId, openSecondary, closeSecondary, sidebarOpen, setSidebarOpen]
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
      navigate: ((url: string) => { window.location.assign(url); }) as ActiveTabContextValue["navigate"],
      secondaryDocId: null,
      openSecondary: noop as (docId: string) => void,
      closeSecondary: noop,
      sidebarOpen: true,
      setSidebarOpen: noop as (open: boolean) => void,
    };
  }
  return ctx;
}
