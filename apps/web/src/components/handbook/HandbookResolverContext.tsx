"use client";

import { pushUrl } from "@/lib/history";
import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { Id } from "@/_generated/dataModel";
import { useHandbookFiles, getAssetUrls } from "@/lib/api/handbooks";
import { useTabSync } from "@/hooks/useTabSync";
import { useActiveTab } from "@/contexts/ActiveTabContext";

interface ResolverValue {
  filesByPath: Map<string, { docId: Id<"documents">; format: string }>;
  getImageUrl: (relPath: string) => string | undefined;
  openInternal: (docId: Id<"documents">, anchor?: string) => void;
}

const HandbookResolverContext = createContext<ResolverValue | null>(null);

export function useHandbookResolver(): ResolverValue | null {
  return useContext(HandbookResolverContext);
}

export function HandbookResolverProvider({
  handbookId,
  children,
}: {
  handbookId: Id<"handbooks">;
  children: ReactNode;
}) {
  const files = useHandbookFiles(handbookId);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const { openTab } = useTabSync();
  const { setActivePanel } = useActiveTab();

  // Fetch presigned URL cho ảnh khi đổi handbook
  useEffect(() => {
    let cancelled = false;
    getAssetUrls(handbookId)
      .then((urls) => { if (!cancelled) setAssetUrls(urls); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [handbookId]);

  // Khóa chỉ gồm path/docId/format — progressPct đổi mỗi 5s khi đọc không được làm
  // resolver đổi (sẽ dựng lại mdComponents → re-parse markdown + tải lại ảnh).
  const filesKey = JSON.stringify((files ?? []).map((f) => [f.relPath, f.docId, f.format]));
  const filesByPath = useMemo(() => {
    const m = new Map<string, { docId: Id<"documents">; format: string }>();
    for (const [relPath, docId, format] of JSON.parse(filesKey) as [string, string, string][]) {
      m.set(relPath, { docId: docId as Id<"documents">, format });
    }
    return m;
  }, [filesKey]);

  const getImageUrl = useCallback((relPath: string) => assetUrls[relPath], [assetUrls]);

  const openInternal = useCallback((docId: Id<"documents">, anchor?: string) => {
    openTab(docId).catch(() => {});
    setActivePanel(`reader:${docId}`);
    const url = `/reader/${docId}${anchor ? `#${anchor}` : ""}`;
    pushUrl(url);
  }, [openTab, setActivePanel]);

  const value = useMemo<ResolverValue>(
    () => ({ filesByPath, getImageUrl, openInternal }),
    [filesByPath, getImageUrl, openInternal]
  );

  return (
    <HandbookResolverContext.Provider value={value}>
      {children}
    </HandbookResolverContext.Provider>
  );
}
