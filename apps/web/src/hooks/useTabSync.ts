"use client";

import { useQuery, useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { Doc } from "@/_generated/dataModel";

export type TabDoc = Doc<"tabs"> & { docTitle: string | null; docFormat: string | null };

export function useTabSync() {
  const tabsResult = useQuery(api.tabs.queries.listByUser);
  const tabs: TabDoc[] = tabsResult ?? [];
  const isLoading = tabsResult === undefined;

  const openTabMutation = useMutation(api.tabs.mutations.openTab);
  const closeTabMutation = useMutation(api.tabs.mutations.closeTab);
  const closeAllMutation = useMutation(api.tabs.mutations.closeAll);
  const setActiveMutation = useMutation(api.tabs.mutations.setActive);
  const reorderTabsMutation = useMutation(api.tabs.mutations.reorderTabs);
  const updateScrollStateMutation = useMutation(api.tabs.mutations.updateScrollState);

  const openTab = useCallback(
    (docId: Id<"documents">) => openTabMutation({ docId }),
    [openTabMutation]
  );

  const closeTab = useCallback(
    (tabId: Id<"tabs">) => closeTabMutation({ tabId }),
    [closeTabMutation]
  );

  const closeAll = useCallback(
    () => closeAllMutation({}),
    [closeAllMutation]
  );

  const setActive = useCallback(
    (tabId: Id<"tabs">) => setActiveMutation({ tabId }),
    [setActiveMutation]
  );

  const reorderTabs = useCallback(
    (orders: { tabId: Id<"tabs">; order: number }[]) => reorderTabsMutation({ orders }),
    [reorderTabsMutation]
  );

  const updateScrollState = useCallback(
    (tabId: Id<"tabs">, scrollState: string, clientMutationId?: string) =>
      updateScrollStateMutation({ tabId, scrollState, clientMutationId }),
    [updateScrollStateMutation]
  );

  const activeTab = tabs.find((t: TabDoc) => t.isActive) ?? null;

  return { tabs, activeTab, isLoading, openTab, closeTab, closeAll, setActive, reorderTabs, updateScrollState };
}
