"use client";

import { useRouter } from "next/navigation";
import { X, Plus, FileText, BookOpen, FileType2, Presentation, Image, Music, Video, FileCode, Globe, PanelLeftClose, StickyNote } from "lucide-react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/_generated/api";
import { getCachedUrl, setCachedUrl } from "@/app/reader/[docId]/ReaderPageInner";
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
import { useState, useEffect, useRef, useCallback } from "react";
import { NoteTab } from "@/hooks/useNoteTabs";
import { useRecording } from "@/contexts/RecordingContext";
import { useActiveTab } from "@/contexts/ActiveTabContext";
import { AudioRecordingPill } from "@/components/recording/AudioRecordingPill";
import { ScreenRecordingPill } from "@/components/recording/ScreenRecordingPill";

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
  const router = useRouter();
  const doc = useQuery(api.documents.queries.getById, { docId: tab.docId as Id<"documents"> });
  const Icon = FORMAT_ICONS[doc?.format ?? ""] ?? FileText;
  const getDownloadUrl = useAction(api.documents.actions.getDownloadUrl);

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

  const handleMouseEnter = () => {
    // Prefetch the reader route bundle
    router.prefetch(`/reader/${tab.docId}`);
    // Also warm the download URL cache
    if (!isActive && !getCachedUrl(tab.docId as string)) {
      getDownloadUrl({ docId: tab.docId as Id<"documents"> })
        .then((url) => setCachedUrl(tab.docId as string, url))
        .catch(() => {});
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
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
  notesActive?: boolean;
  noteTabs?: NoteTab[];
  activeNoteId?: string | null;
  onCloseNoteTab?: (noteId: string) => void;
  onSelectNoteTab?: (noteId: string) => void;
}

// Session-local stack of recently closed tab docIds for Ctrl+Shift+T
const closedTabStack: string[] = [];

export function TabBar({ currentDocId, showAddButton = false, notesActive = false, noteTabs = [], activeNoteId, onCloseNoteTab, onSelectNoteTab }: TabBarProps) {
  const router = useRouter();
  const { audioRecorder, screenRecorder } = useRecording();
  const { tabs, isLoading, closeTab, closeAll, reorderTabs, openTab, setActive } = useTabSync();
  const { setActivePanel } = useActiveTab();
  const [optimisticTabs, setOptimisticTabs] = useState<TabDoc[] | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // Close dropdown on outside click
  useEffect(() => {
    if (!addMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [addMenuOpen]);

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

  if ((isLoading && noteTabs.length === 0) || (tabs.length === 0 && !notesActive && noteTabs.length === 0 && !showAddButton)) return null;

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
    // Close all note tabs too
    noteTabs.forEach((nt) => onCloseNoteTab?.(nt.noteId));
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
      {/* + dropdown — mở tài liệu hoặc ghi chú */}
      {showAddButton && (
        <div ref={addMenuRef} className="relative shrink-0">
          <button
            onClick={() => setAddMenuOpen((v) => !v)}
            aria-label="Mở tab mới"
            title="Mở tab mới"
            className={[
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              addMenuOpen
                ? "bg-background text-foreground ring-1 ring-border/60"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            ].join(" ")}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {addMenuOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-md border bg-popover shadow-md">
              <button
                onClick={() => { setAddMenuOpen(false); router.push("/library"); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                Mở tài liệu
              </button>
              <button
                onClick={() => { setAddMenuOpen(false); router.push("/notes"); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                Ghi chú
              </button>
              <div className="my-1 h-px bg-border/60" />
              <button
                onClick={async () => {
                  setAddMenuOpen(false);
                  if (audioRecorder.state !== "idle") return;
                  try { await audioRecorder.start(); } catch { /* user denied */ }
                }}
                disabled={audioRecorder.state !== "idle"}
                title={audioRecorder.state !== "idle" ? "Đang có phiên ghi âm" : undefined}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-rose-500 shrink-0">
                  <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                  <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
                </svg>
                Ghi âm
              </button>
              <button
                onClick={async () => {
                  setAddMenuOpen(false);
                  if (screenRecorder.state !== "idle") return;
                  try { await screenRecorder.start(); } catch { /* user denied */ }
                }}
                disabled={screenRecorder.state !== "idle"}
                title={screenRecorder.state !== "idle" ? "Đang có phiên quay màn hình" : undefined}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-violet-500 shrink-0">
                  <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z" />
                </svg>
                Quay màn hình
              </button>
            </div>
          )}
        </div>
      )}

      {showAddButton && <div className="h-4 w-px shrink-0 bg-border/60" />}

      {/* Tab list — scrollable */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayTabs.map((t) => t._id)} strategy={horizontalListSortingStrategy}>
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none py-1">
            {/* Persistent Notes tab */}
            <div
              onClick={() => {
                setActivePanel("notes");
                window.history.pushState(null, "", "/notes");
              }}
              className={[
                "flex h-8 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md px-2.5 transition-all duration-150",
                notesActive && noteTabs.length === 0
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              ].join(" ")}
              title="Ghi chú"
            >
              <StickyNote className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              <span className="text-xs font-medium">Ghi chú</span>
            </div>
            {<div className="h-4 w-px shrink-0 bg-border/40" />}

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
                      ? "bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-200"
                      : "text-violet-500/70 hover:bg-violet-50/60 hover:text-violet-600",
                  ].join(" ")}
                >
                  <StickyNote className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="flex-1 truncate text-xs font-medium">{nt.title || "(Không có tiêu đề)"}</span>
                  <span
                    role="button"
                    aria-label="Đóng tab ghi chú"
                    onClick={(e) => { e.stopPropagation(); onCloseNoteTab?.(nt.noteId); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={[
                      "ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all",
                      isNoteActive
                        ? "opacity-60 hover:opacity-100 hover:bg-violet-100"
                        : "opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100 hover:bg-violet-100",
                    ].join(" ")}
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                </div>
              );
            })}
            {noteTabs.length > 0 && displayTabs.length > 0 && <div className="h-4 w-px shrink-0 bg-border/40" />}
            {displayTabs.map((tab) => (
              <SortableTabItem
                key={tab._id}
                tab={tab}
                isActive={currentDocId !== null && tab.docId === currentDocId}
                onClick={() => {
                  if (tab.docId !== currentDocId) {
                    // Instant visibility switch — no navigation, no unmount/remount
                    setActivePanel(`reader:${tab.docId}`);
                    setActive(tab._id).catch(() => {});
                    window.history.pushState(null, "", `/reader/${tab.docId}`);
                  }
                }}
                onClose={(e) => handleClose(e, tab)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Recording pills */}
      <AudioRecordingPill />
      <ScreenRecordingPill />

      {/* Divider + Đóng tất cả — luôn ở cuối */}
      {(displayTabs.length > 1 || (displayTabs.length >= 1 && noteTabs.length >= 1) || noteTabs.length > 1) && (
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
