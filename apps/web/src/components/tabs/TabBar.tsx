"use client";

import { useRouter } from "next/navigation";
import { X, Plus, FileText, BookOpen, FileType2, Presentation, Image, Music, Video, FileCode, Globe, PanelLeftClose, StickyNote } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { useTabSync, TabDoc } from "@/hooks/useTabSync";
import { Id } from "@/_generated/dataModel";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect, useRef } from "react";
import { NoteTab } from "@/hooks/useNoteTabs";

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, epub: BookOpen, docx: FileType2, pptx: Presentation,
  image: Image, audio: Music, video: Video, markdown: FileCode, web_clip: Globe,
};

interface SortableTabItemProps {
  tab: TabDoc;
  isActive: boolean;
  onClose: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function SortableTabItem({ tab, isActive, onClose, onClick }: SortableTabItemProps) {
  const doc = useQuery(api.documents.queries.getById, { docId: tab.docId as Id<"documents"> });
  const Icon = FORMAT_ICONS[doc?.format ?? ""] ?? FileText;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={[
        "group relative flex h-8 min-w-0 max-w-[160px] shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md px-2.5 text-left transition-all duration-150",
        isActive
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      <span className="flex-1 truncate text-xs font-medium">{doc?.title ?? "…"}</span>
      <span
        role="button"
        aria-label="Đóng tab"
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
        className={[
          "ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all",
          isActive
            ? "opacity-60 hover:opacity-100 hover:bg-muted"
            : "opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100 hover:bg-muted",
        ].join(" ")}
      >
        <X className="h-2.5 w-2.5" />
      </span>
    </div>
  );
}

interface TabBarProps {
  currentDocId: Id<"documents"> | null;
  showAddButton?: boolean;
  /** Pass true when rendered on the /notes page so the Notes tab appears active */
  notesActive?: boolean;
  /** Open note tabs to display in the tab bar */
  noteTabs?: NoteTab[];
  /** Currently active note id */
  activeNoteId?: string | null;
  /** Called when user clicks X on a note tab */
  onCloseNoteTab?: (noteId: string) => void;
  /** Called when user clicks a note tab to navigate to it */
  onSelectNoteTab?: (noteId: string) => void;
}

// Session-local stack of recently closed tab docIds for Ctrl+Shift+T
const closedTabStack: string[] = [];

export function TabBar({ currentDocId, showAddButton = false, notesActive = false, noteTabs = [], activeNoteId, onCloseNoteTab, onSelectNoteTab }: TabBarProps) {
  const router = useRouter();
  const { tabs, isLoading, closeTab, closeAll, reorderTabs, openTab } = useTabSync();
  const [optimisticTabs, setOptimisticTabs] = useState<TabDoc[] | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const displayTabs = optimisticTabs ?? tabs;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Ctrl+Shift+T to reopen last closed tab
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
        e.preventDefault();
        const docId = closedTabStack.pop();
        if (!docId) return;
        openTab(docId as never).then(() => {
          router.push(`/reader/${docId}`);
        }).catch(() => {});
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openTab, router]);

  if (isLoading || (tabs.length === 0 && !notesActive && noteTabs.length === 0)) return null;

  async function handleClose(e: React.MouseEvent, tab: TabDoc) {
    e.stopPropagation();
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = displayTabs.findIndex((t) => t._id === active.id);
    const newIndex = displayTabs.findIndex((t) => t._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(displayTabs, oldIndex, newIndex);
    setOptimisticTabs(reordered);

    const orders = reordered.map((t, i) => ({ tabId: t._id, order: i }));
    reorderTabs(orders)
      .catch(() => setOptimisticTabs(null))
      .then(() => setOptimisticTabs(null));
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-muted/40 px-2">
      {/* Nút thêm tab — luôn ở đầu */}
      {showAddButton && (
        <button
          onClick={() => router.push("/library")}
          aria-label="Mở tab mới từ thư viện"
          title="Mở tài liệu mới"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Divider nếu có nút thêm */}
      {showAddButton && <div className="h-4 w-px shrink-0 bg-border/60" />}

      {/* Tab list — scrollable */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayTabs.map((t) => t._id)} strategy={horizontalListSortingStrategy}>
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none py-1">
            {/* Notes hub tab — navigates to /notes list */}
            {(notesActive || noteTabs.length > 0) && (
              <button
                onClick={() => router.push("/notes")}
                className={[
                  "group relative flex h-8 min-w-0 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all duration-150",
                  notesActive && !activeNoteId
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                ].join(" ")}
              >
                <StickyNote className="h-3 w-3 shrink-0 opacity-70" />
                Ghi chú
              </button>
            )}
            {/* Individual note tabs */}
            {noteTabs.map((nt) => {
              const isNoteActive = notesActive && activeNoteId === nt.noteId;
              return (
                <div
                  key={nt.noteId}
                  onClick={() => onSelectNoteTab?.(nt.noteId)}
                  className={[
                    "group relative flex h-8 min-w-0 max-w-[160px] shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md px-2.5 text-left transition-all duration-150",
                    isNoteActive
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                  ].join(" ")}
                >
                  <StickyNote className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  <span className="flex-1 truncate text-xs font-medium">{nt.title || "(Không có tiêu đề)"}</span>
                  <span
                    role="button"
                    aria-label="Đóng tab ghi chú"
                    onClick={(e) => { e.stopPropagation(); onCloseNoteTab?.(nt.noteId); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={[
                      "ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all",
                      isNoteActive
                        ? "opacity-60 hover:opacity-100 hover:bg-muted"
                        : "opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100 hover:bg-muted",
                    ].join(" ")}
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                </div>
              );
            })}
            {(noteTabs.length > 0 || notesActive) && displayTabs.length > 0 && <div className="h-4 w-px shrink-0 bg-border/40" />}
            {displayTabs.map((tab) => (
              <SortableTabItem
                key={tab._id}
                tab={tab}
                isActive={currentDocId !== null && tab.docId === currentDocId}
                onClick={() => {
                  if (tab.docId !== currentDocId) router.push(`/reader/${tab.docId}`);
                }}
                onClose={(e) => handleClose(e, tab)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Divider + Đóng tất cả — luôn ở cuối */}
      {displayTabs.length > 1 && (
        <>
          <div className="h-4 w-px shrink-0 bg-border/60" />
          <button
            onClick={handleCloseAll}
            aria-label="Đóng tất cả tab"
            title="Đóng tất cả (Ctrl+Shift+T để mở lại)"
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Đóng tất cả</span>
          </button>
        </>
      )}
    </div>
  );
}
