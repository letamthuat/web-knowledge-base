"use client";

/**
 * ActiveTabContext — tracks which tab/panel is visible in AppShell.
 * Updated by TabBar clicks without triggering Next.js navigation.
 * Format: "library" | "notes" | "settings" | "reader:<docId>"
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ActiveTabContextValue {
  activePanel: string | null;
  setActivePanel: (panel: string) => void;
}

const ActiveTabContext = createContext<ActiveTabContextValue | null>(null);

export function ActiveTabProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanelState] = useState<string | null>(null);

  const setActivePanel = useCallback((panel: string) => {
    setActivePanelState(panel);
  }, []);

  return (
    <ActiveTabContext.Provider value={{ activePanel, setActivePanel }}>
      {children}
    </ActiveTabContext.Provider>
  );
}

const noop = () => {};

export function useActiveTab() {
  const ctx = useContext(ActiveTabContext);
  if (!ctx) return { activePanel: null, setActivePanel: noop as (panel: string) => void };
  return ctx;
}
