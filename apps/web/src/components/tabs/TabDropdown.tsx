"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { useTabSync, TabDoc } from "@/hooks/useTabSync";
import { Id } from "@/_generated/dataModel";
import { LayoutList } from "lucide-react";

function useDocTitle(docId: Id<"documents">) {
  const doc = useQuery(api.documents.queries.getById, { docId });
  return doc?.title ?? "…";
}

interface TabDropdownProps {
  currentDocId: Id<"documents">;
}

export function TabDropdown({ currentDocId }: TabDropdownProps) {
  const router = useRouter();
  const { tabs, isLoading } = useTabSync();

  if (isLoading || tabs.length === 0) return null;

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted/30 px-3">
      <LayoutList className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <select
        className="flex-1 bg-transparent text-xs outline-none"
        value={currentDocId}
        onChange={(e) => {
          const tab = tabs.find((t: TabDoc) => t.docId === e.target.value);
          if (tab && tab.docId !== currentDocId) router.push(`/reader/${tab.docId}`);
        }}
      >
        {tabs.map((tab: TabDoc) => (
          <TabOption key={tab._id} docId={tab.docId as Id<"documents">} />
        ))}
      </select>
    </div>
  );
}

function TabOption({ docId }: { docId: Id<"documents"> }) {
  const title = useDocTitle(docId);
  return <option value={docId}>{title}</option>;
}
