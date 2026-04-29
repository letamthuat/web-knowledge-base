"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { useTabSync, TabDoc } from "@/hooks/useTabSync";
import { Id } from "@/_generated/dataModel";
import { X, Plus } from "lucide-react";

function useDocTitle(docId: Id<"documents">) {
  const doc = useQuery(api.documents.queries.getById, { docId });
  return doc?.title ?? "…";
}

interface TabDropdownProps {
  currentDocId: Id<"documents"> | null;
}

export function TabDropdown({ currentDocId }: TabDropdownProps) {
  const router = useRouter();
  const { tabs, isLoading, closeTab } = useTabSync();

  if (isLoading || tabs.length === 0) return null;

  async function handleClose(tab: TabDoc) {
    await closeTab(tab._id);
    if (tab.isActive) {
      const next = tabs.find((t: TabDoc) => t._id !== tab._id);
      if (next) router.push(`/reader/${next.docId}`);
      else router.push("/library");
    }
  }

  return (
    <div className="flex shrink-0 flex-col border-b bg-muted/30">
      {/* Select row */}
      <div className="flex h-10 items-center gap-2 px-3">
        <select
          className="flex-1 bg-transparent text-sm outline-none"
          value={currentDocId ?? ""}
          onChange={(e) => {
            const tab = tabs.find((t: TabDoc) => t.docId === e.target.value);
            if (tab && tab.docId !== currentDocId) router.push(`/reader/${tab.docId}`);
          }}
        >
          {currentDocId === null && <option value="">— Thư viện —</option>}
          {tabs.map((tab: TabDoc) => (
            <TabOption key={tab._id} docId={tab.docId as Id<"documents">} />
          ))}
        </select>
        <button
          onClick={() => router.push("/library")}
          aria-label="Mở tab mới"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-muted"
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Tab chips row — scrollable, each has × */}
      <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 scrollbar-none">
        {tabs.map((tab: TabDoc) => (
          <TabChip
            key={tab._id}
            tab={tab}
            isActive={currentDocId !== null && tab.docId === currentDocId}
            onSelect={() => {
              if (tab.docId !== currentDocId) router.push(`/reader/${tab.docId}`);
            }}
            onClose={() => handleClose(tab)}
          />
        ))}
      </div>
    </div>
  );
}

function TabChip({
  tab, isActive, onSelect, onClose,
}: {
  tab: TabDoc;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const title = useDocTitle(tab.docId as Id<"documents">);
  return (
    <div
      className={[
        "flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs",
        isActive
          ? "border-primary bg-primary/10 text-primary font-medium"
          : "border-border bg-background text-muted-foreground",
      ].join(" ")}
    >
      <button onClick={onSelect} className="max-w-[100px] truncate">
        {title}
      </button>
      <button
        onClick={onClose}
        aria-label="Đóng tab"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-muted-foreground/20"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function TabOption({ docId }: { docId: Id<"documents"> }) {
  const title = useDocTitle(docId);
  return <option value={docId}>{title}</option>;
}
