"use client";

import { useRouter } from "next/navigation";
import { X, Plus, FileText, BookOpen, FileType2, Presentation, Image, Music, Video, FileCode, Globe } from "lucide-react";
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
import { useState } from "react";

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
    opacity: isDragging ? 0.5 : 1,
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
        "group flex h-9 min-w-0 max-w-[180px] shrink-0 cursor-pointer select-none items-center gap-1.5 border-r px-3 text-left transition-colors",
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
        onPointerDown={(e) => e.stopPropagation()}
        className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-muted-foreground/20"
      >
        <X className="h-3 w-3" />
      </span>
    </div>
  );
}

interface TabBarProps {
  currentDocId: Id<"documents"> | null;
  showAddButton?: boolean;
}

export function TabBar({ currentDocId, showAddButton = false }: TabBarProps) {
  const router = useRouter();
  const { tabs, isLoading, closeTab, reorderTabs } = useTabSync();
  const [optimisticTabs, setOptimisticTabs] = useState<TabDoc[] | null>(null);

  const displayTabs = optimisticTabs ?? tabs;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (isLoading || tabs.length === 0) return null;

  async function handleClose(e: React.MouseEvent, tab: TabDoc) {
    e.stopPropagation();
    await closeTab(tab._id);
    if (tab.isActive) {
      const next = tabs.find((t: TabDoc) => t._id !== tab._id);
      if (next) router.push(`/reader/${next.docId}`);
      else router.push("/library");
    }
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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={displayTabs.map((t) => t._id)} strategy={horizontalListSortingStrategy}>
        <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b bg-muted/30 scrollbar-none">
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
          {showAddButton && (
            <button
              onClick={() => router.push("/library")}
              aria-label="Mở tab mới từ thư viện"
              className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
