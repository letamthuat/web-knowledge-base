"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { useTabSync, TabDoc } from "@/hooks/useTabSync";
import { Id } from "@/_generated/dataModel";
import { X, Plus, PanelLeftClose, FileText, BookOpen, FileType2, Presentation, Image, Music, Video, FileCode, Globe, StickyNote } from "lucide-react";
import { useRef } from "react";
import { NoteTab } from "@/hooks/useNoteTabs";

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, epub: BookOpen, docx: FileType2, pptx: Presentation,
  image: Image, audio: Music, video: Video, markdown: FileCode, web_clip: Globe,
};

function useDoc(docId: Id<"documents">) {
  return useQuery(api.documents.queries.getById, { docId });
}

interface TabDropdownProps {
  currentDocId: Id<"documents"> | null;
  noteTabs?: NoteTab[];
  activeNoteId?: string | null;
  onSelectNoteTab?: (noteId: string) => void;
  onCloseNoteTab?: (noteId: string) => void;
}

const closedTabStack: string[] = [];

export function TabDropdown({ currentDocId, noteTabs = [], activeNoteId, onSelectNoteTab, onCloseNoteTab }: TabDropdownProps) {
  const router = useRouter();
  const { tabs, isLoading, closeTab, closeAll } = useTabSync();
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  if ((isLoading && noteTabs.length === 0) || (tabs.length === 0 && noteTabs.length === 0)) return null;

  async function handleClose(tab: TabDoc) {
    closedTabStack.push(tab.docId as string);
    if (closedTabStack.length > 20) closedTabStack.shift();
    await closeTab(tab._id);
    if (tab.isActive) {
      const next = tabsRef.current.find((t: TabDoc) => t._id !== tab._id);
      if (next) router.push(`/reader/${next.docId}`);
      else router.push("/library");
    }
  }

  async function handleCloseAll() {
    tabsRef.current.forEach((t) => closedTabStack.push(t.docId as string));
    if (closedTabStack.length > 20) closedTabStack.splice(0, closedTabStack.length - 20);
    await closeAll();
    router.push("/library");
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-muted/40 px-2">
      {/* Nút thêm tab */}
      <button
        onClick={() => router.push("/library")}
        aria-label="Mở tài liệu mới"
        title="Mở tài liệu mới"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <div className="h-4 w-px shrink-0 bg-border/60" />

      {/* Scrollable tab chips */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none py-1">
        {/* Note tabs — violet */}
        {noteTabs.map((nt) => {
          const isNoteActive = activeNoteId === nt.noteId;
          return (
            <div
              key={nt.noteId}
              className={[
                "flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs transition-all",
                isNoteActive
                  ? "bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-200 font-medium"
                  : "text-violet-500/70 hover:bg-violet-50/60 hover:text-violet-600",
              ].join(" ")}
            >
              <button
                onClick={() => onSelectNoteTab?.(nt.noteId)}
                className="flex min-w-0 items-center gap-1"
              >
                <StickyNote className="h-3 w-3 shrink-0" aria-hidden />
                <span className="max-w-[80px] truncate">{nt.title || "(Không có tiêu đề)"}</span>
              </button>
              <button
                onClick={() => onCloseNoteTab?.(nt.noteId)}
                aria-label="Đóng tab ghi chú"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-50 hover:opacity-100 hover:bg-violet-100"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}

        {noteTabs.length > 0 && tabs.length > 0 && <div className="h-4 w-px shrink-0 bg-border/40" />}

        {/* Doc tabs */}
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

      {/* Đóng tất cả */}
      {tabs.length > 1 && (
        <>
          <div className="h-4 w-px shrink-0 bg-border/60" />
          <button
            onClick={handleCloseAll}
            aria-label="Đóng tất cả tab"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </>
      )}
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
  const doc = useDoc(tab.docId as Id<"documents">);
  const Icon = FORMAT_ICONS[doc?.format ?? ""] ?? FileText;

  return (
    <div
      className={[
        "flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs transition-all",
        isActive
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60 font-medium"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
      ].join(" ")}
    >
      <button
        onClick={onSelect}
        className="flex min-w-0 items-center gap-1"
      >
        <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        <span className="max-w-[80px] truncate">{doc?.title ?? "…"}</span>
      </button>
      <button
        onClick={onClose}
        aria-label="Đóng tab"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-50 hover:opacity-100 hover:bg-muted-foreground/20"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
