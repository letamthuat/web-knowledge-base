"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Id } from "@/_generated/dataModel";
import {
  ChevronRight, Folder, FolderOpen, FileText, FileType2, Image as ImageIcon,
  FileAudio, FileVideo, Presentation, BookOpen, CheckCircle2, Circle, CircleDot,
  MoreHorizontal, SplitSquareHorizontal, Trash2, FolderPlus, FilePlus2, Pencil,
} from "lucide-react";
import { buildTree, ancestorPaths, type TreeNode, type HandbookFile } from "@/lib/handbook/buildTree";

interface HandbookTreeProps {
  handbookId: Id<"handbooks">;
  files: HandbookFile[];
  emptyFolders: string[];
  activeDocId: string | null;
  onOpenFile: (docId: Id<"documents">) => void;
  onOpenSecondary?: (docId: Id<"documents">) => void;
  onDeleteFile?: (docId: Id<"documents">, title: string) => void;
  onDeleteFolder?: (prefix: string) => void;
  onAddFile?: (prefix: string) => void;
  onAddEmptyFolder?: (prefix: string) => void;
  onRenameFile?: (docId: Id<"documents">, currentName: string) => void;
  onRenameFolder?: (prefix: string, currentName: string) => void;
}

const STORE_KEY = (id: string) => `hb-tree-expanded:${id}`;

function formatIcon(format: string) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (format) {
    case "pdf": return <FileType2 className={`${cls} text-red-500`} />;
    case "image": return <ImageIcon className={`${cls} text-emerald-500`} />;
    case "audio": return <FileAudio className={`${cls} text-violet-500`} />;
    case "video": return <FileVideo className={`${cls} text-blue-500`} />;
    case "pptx": return <Presentation className={`${cls} text-orange-500`} />;
    case "epub": return <BookOpen className={`${cls} text-amber-600`} />;
    default: return <FileText className={`${cls} text-muted-foreground`} />;
  }
}

// 13.2 — icon trạng thái đọc từ progressPct
function statusIcon(format: string, pct: number | null) {
  if (format === "image" || format === "audio" || format === "video") return null;
  if (pct == null || pct <= 0) return <Circle className="h-3 w-3 shrink-0 text-muted-foreground/40" aria-label="Chưa đọc" />;
  if (pct >= 0.95) return <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" aria-label="Đã đọc xong" />;
  return <CircleDot className="h-3 w-3 shrink-0 text-amber-500" aria-label="Đang đọc dở" />;
}

export function HandbookTree({
  handbookId, files, emptyFolders, activeDocId,
  onOpenFile, onOpenSecondary, onDeleteFile, onDeleteFolder, onAddFile, onAddEmptyFolder,
  onRenameFile, onRenameFolder,
}: HandbookTreeProps) {
  const tree = useMemo(() => buildTree(files, emptyFolders), [files, emptyFolders]);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(STORE_KEY(handbookId));
      return raw ? new Set<string>(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  const persist = useCallback((next: Set<string>) => {
    try { localStorage.setItem(STORE_KEY(handbookId), JSON.stringify([...next])); } catch {}
  }, [handbookId]);

  // Auto-expand tổ tiên của file đang mở
  useEffect(() => {
    if (!activeDocId) return;
    const active = files.find((f) => f.docId === activeDocId);
    if (!active) return;
    const ancestors = ancestorPaths(active.relPath);
    if (ancestors.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const p of ancestors) if (!next.has(p)) { next.add(p); changed = true; }
      if (changed) persist(next);
      return changed ? next : prev;
    });
  }, [activeDocId, files, persist]);

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      persist(next);
      return next;
    });
  }, [persist]);

  const renderNodes = (nodes: TreeNode[], depth: number) => (
    <ul>
      {nodes.map((node) => {
        const pad = 8 + depth * 12;
        if (node.type === "folder") {
          const open = expanded.has(node.path);
          return (
            <li key={`f:${node.path}`}>
              <div className="group flex min-w-0 items-center">
                <button
                  onClick={() => toggle(node.path)}
                  style={{ paddingLeft: pad }}
                  className="flex min-w-0 flex-1 items-center gap-1 py-1 pr-2 text-left text-[13px] text-foreground/90 hover:bg-muted/60"
                >
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
                  {open ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                  <span className="truncate">{node.name}</span>
                </button>
                <NodeMenu items={[
                  ...(onAddFile ? [{ label: "Thêm file", icon: <FilePlus2 className="h-3.5 w-3.5" />, onClick: () => onAddFile(node.path) }] : []),
                  ...(onAddEmptyFolder ? [{ label: "Tạo folder con", icon: <FolderPlus className="h-3.5 w-3.5" />, onClick: () => onAddEmptyFolder(node.path) }] : []),
                  ...(onRenameFolder ? [{ label: "Đổi tên folder", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => onRenameFolder(node.path, node.name) }] : []),
                  ...(onDeleteFolder ? [{ label: "Xóa folder", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onClick: () => onDeleteFolder(node.path) }] : []),
                ]} />
              </div>
              {open && renderNodes(node.children, depth + 1)}
            </li>
          );
        }
        const isActive = node.docId === activeDocId;
        return (
          <li key={`d:${node.docId}`}>
            <div className="group flex min-w-0 items-center">
              <button
                onClick={() => onOpenFile(node.docId)}
                style={{ paddingLeft: pad + 14 }}
                className={[
                  "flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 text-left text-[13px]",
                  isActive ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-muted/60",
                ].join(" ")}
              >
                {formatIcon(node.format)}
                <span className="truncate">{node.name}</span>
                <span className="ml-auto shrink-0">{statusIcon(node.format, node.progressPct)}</span>
              </button>
              <NodeMenu items={[
                ...(onOpenSecondary ? [{ label: "Mở sang phải", icon: <SplitSquareHorizontal className="h-3.5 w-3.5" />, onClick: () => onOpenSecondary(node.docId) }] : []),
                ...(onRenameFile ? [{ label: "Đổi tên file", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => onRenameFile(node.docId, node.name) }] : []),
                ...(onDeleteFile ? [{ label: "Xóa file", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onClick: () => onDeleteFile(node.docId, node.name) }] : []),
              ]} />
            </div>
          </li>
        );
      })}
    </ul>
  );

  if (tree.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">Handbook trống — import ZIP để thêm nội dung.</p>;
  }
  return renderNodes(tree, 0);
}

function NodeMenu({ items }: { items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="mr-1 rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 min-w-[140px] rounded-md border bg-popover p-1 shadow-md">
            {items.map((it, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}
                className={[
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
                  it.danger ? "text-destructive" : "text-foreground",
                ].join(" ")}
              >
                {it.icon}{it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
