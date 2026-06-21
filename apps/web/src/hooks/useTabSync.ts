"use client";

import { useCallback } from "react";
import { Id } from "@/_generated/dataModel";
import {
  useTabsWithDoc,
  openTab as apiOpenTab,
  closeTab as apiCloseTab,
  closeAll as apiCloseAll,
  setActive as apiSetActive,
  reorderTabs as apiReorderTabs,
  updateScrollState as apiUpdateScrollState,
} from "@/lib/api/tabs";

// Giữ kiểu Id<> cho các trang lớn (TabBar/TabDropdown/ReaderPageInner) chưa migrate.
export type TabDoc = {
  _id: Id<"tabs">;
  docId: Id<"documents">;
  order: number;
  isActive: boolean;
  scrollState?: string | null;
  updatedAt: number;
  clientMutationId?: string | null;
  docTitle: string;
  docFormat: string;
};

export function useTabSync() {
  const tabsResult = useTabsWithDoc();
  const tabs = (tabsResult ?? []) as unknown as TabDoc[];
  const isLoading = tabsResult === undefined;

  const openTab = useCallback((docId: Id<"documents">) => apiOpenTab(docId), []);
  const closeTab = useCallback((tabId: Id<"tabs">) => apiCloseTab(tabId), []);
  const closeAll = useCallback(() => apiCloseAll(), []);
  const setActive = useCallback((tabId: Id<"tabs">) => apiSetActive(tabId), []);
  const reorderTabs = useCallback(
    (orders: { tabId: Id<"tabs">; order: number }[]) => apiReorderTabs(orders),
    []
  );
  const updateScrollState = useCallback(
    (tabId: Id<"tabs">, scrollState: string, clientMutationId?: string) =>
      apiUpdateScrollState(tabId, scrollState, clientMutationId),
    []
  );

  const activeTab = tabs.find((t) => t.isActive) ?? null;

  return { tabs, activeTab, isLoading, openTab, closeTab, closeAll, setActive, reorderTabs, updateScrollState };
}
