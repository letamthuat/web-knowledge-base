"use client";

import { useRouter } from "next/navigation";
import { X, Plus, FileText, BookOpen, FileType2, Presentation, Image, Music, Video, FileCode, Globe } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { useTabSync, TabDoc } from "@/hooks/useTabSync";
import { Id } from "@/_generated/dataModel";

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, epub: BookOpen, docx: FileType2, pptx: Presentation,
  image: Image, audio: Music, video: Video, markdown: FileCode, web_clip: Globe,
};

interface TabItemProps {
  tabId: Id<"tabs">;
  docId: Id<"documents">;
  isActive: boolean;
  onClose: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function TabItem({ tabId: _tabId, docId, isActive, onClose, onClick }: TabItemProps) {
  const doc = useQuery(api.documents.queries.getById, { docId });
  const Icon = FORMAT_ICONS[doc?.format ?? ""] ?? FileText;

  return (
    <button
      onClick={onClick}
      className={[
        "group flex h-9 min-w-0 max-w-[180px] shrink-0 items-center gap-1.5 border-r px-3 text-left transition-colors",
        isActive
          ? "border-b-2 border-b-primary bg-background text-foreground"
          : "border-b-2 border-b-transparent bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate text-xs">{doc?.title ?? "…"}</span>
      <span
        role="button"
        aria-label="Đóng tab"
        onClick={onClose}
        className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-muted-foreground/20"
      >
        <X className="h-3 w-3" />
      </span>
    </button>
  );
}

interface TabBarProps {
  currentDocId: Id<"documents">;
}

export function TabBar({ currentDocId }: TabBarProps) {
  const router = useRouter();
  const { tabs, isLoading, closeTab } = useTabSync();

  if (isLoading) return null;

  async function handleClose(e: React.MouseEvent, tab: TabDoc) {
    e.stopPropagation();
    await closeTab(tab._id);
    if (tab.isActive) {
      const next = tabs.find((t: TabDoc) => t._id !== tab._id);
      if (next) router.push(`/reader/${next.docId}`);
      else router.push("/library");
    }
  }

  return (
    <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b bg-muted/30 scrollbar-none">
      {tabs.map((tab) => (
        <TabItem
          key={tab._id}
          tabId={tab._id}
          docId={tab.docId as Id<"documents">}
          isActive={tab.docId === currentDocId}
          onClick={() => {
            if (tab.docId !== currentDocId) router.push(`/reader/${tab.docId}`);
          }}
          onClose={(e) => handleClose(e, tab)}
        />
      ))}
      <button
        onClick={() => router.push("/library")}
        aria-label="Mở tab mới từ thư viện"
        className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
