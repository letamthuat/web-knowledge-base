"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Id } from "@/_generated/dataModel";
import {
  ChevronRight, Folder, FolderOpen, FileText, FileType2, Image as ImageIcon,
  FileAudio, FileVideo, Presentation, BookOpen, CheckCircle2, Circle, CircleDot,
  SplitSquareHorizontal, Trash2, FolderPlus, FilePlus2, Pencil,
} from "lucide-react";
import { buildTree, ancestorPaths, type TreeNode, type HandbookFile } from "@/lib/handbook/buildTree";
import { RowMenu } from "./RowMenu";

interface HandbookTreeProps {
  handbookId: Id<"handbooks">;
  files: HandbookFile[];
  emptyFolders: string[];
  activeDocId: string | null;
  /** Lowercase name filter; when set, matching nodes show and folders auto-expand. */
  filter?: string;
  onOpenFile: (docId: Id<"documents">) => void;
  onOpenSecondary?: (docId: Id<"documents">) => void;
  onDeleteFile?: (docId: Id<"documents">, title: string) => void;
  onDeleteFolder?: (prefix: string) => void;
  onAddFile?: (prefix: string) => void;
  onAddFolder?: (prefix: string) => void;
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

/** Keep files whose name matches, folders whose name matches (with all children)
 *  or that contain a matching descendant. */
function filterNodes(nodes: TreeNode[], q: string): TreeNode[] {
  if (!q) return nodes;
  const out: TreeNode[] = [];
  for (const n of nodes) {
    if (n.type === "folder") {
      if (n.name.toLowerCase().includes(q)) {
        out.push(n);
      } else {
        const kids = filterNodes(n.children, q);
        if (kids.length > 0) out.push({ ...n, children: kids });
      }
    } else if (n.name.toLowerCase().includes(q)) {
      out.push(n);
    }
  }
  return out;
}

export function HandbookTree({
  handbookId, files, emptyFolders, activeDocId, filter = "",
  onOpenFile, onOpenSecondary, onDeleteFile, onDeleteFolder, onAddFile, onAddFolder, onAddEmptyFolder,
  onRenameFile, onRenameFolder,
}: HandbookTreeProps) {
  const fullTree = useMemo(() => buildTree(files, emptyFolders), [files, emptyFolders]);
  const q = filter.trim().toLowerCase();
  const tree = useMemo(() => filterNodes(fullTree, q), [fullTree, q]);
  const filtering = q.length > 0;

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
        const pad = 10 + depth * 14;
        if (node.type === "folder") {
          const open = filtering || expanded.has(node.path);
          const folderItems = [
            ...(onAddFile ? [{ label: "Thêm file", icon: <FilePlus2 className="h-3.5 w-3.5" />, onClick: () => onAddFile(node.path) }] : []),
            ...(onAddFolder ? [{ label: "Import Thư mục", icon: <FolderPlus className="h-3.5 w-3.5" />, onClick: () => onAddFolder(node.path) }] : []),
            ...(onAddEmptyFolder ? [{ label: "Tạo folder con", icon: <FolderPlus className="h-3.5 w-3.5" />, onClick: () => onAddEmptyFolder(node.path) }] : []),
            ...(onRenameFolder ? [{ label: "Đổi tên folder", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => onRenameFolder(node.path, node.name) }] : []),
            ...(onDeleteFolder ? [{ label: "Xóa folder", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onClick: () => onDeleteFolder(node.path) }] : []),
          ];
          return (
            <li key={`f:${node.path}`}>
              <RowMenu items={folderItems}>
                {(m) => (
                  <div className="group flex min-w-0 items-center pr-1" onContextMenu={m.onContextMenu}>
                    <button
                      onClick={() => toggle(node.path)}
                      style={{ paddingLeft: pad }}
                      title={node.name}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-1.5 text-left text-[13px] text-foreground/90 transition-colors hover:bg-muted"
                    >
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
                      {open ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                      <span className="truncate">{node.name}</span>
                    </button>
                    {m.trigger}
                  </div>
                )}
              </RowMenu>

              {open && renderNodes(node.children, depth + 1)}
            </li>
          );
        }
        const isActive = node.docId === activeDocId;
        const fileItems = [
          ...(onOpenSecondary ? [{ label: "Mở sang phải", icon: <SplitSquareHorizontal className="h-3.5 w-3.5" />, onClick: () => onOpenSecondary(node.docId) }] : []),
          ...(onRenameFile ? [{ label: "Đổi tên file", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => onRenameFile(node.docId, node.name) }] : []),
          ...(onDeleteFile ? [{ label: "Xóa file", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onClick: () => onDeleteFile(node.docId, node.name) }] : []),
        ];
        return (
          <li key={`d:${node.docId}`}>
            <RowMenu items={fileItems}>
              {(m) => (
                <div className="group flex min-w-0 items-center pr-1" onContextMenu={m.onContextMenu}>
                  <button
                    onClick={() => onOpenFile(node.docId)}
                    style={{ paddingLeft: pad + 16 }}
                    title={node.name}
                    className={[
                      "flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-1.5 text-left text-[13px] transition-colors",
                      isActive ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-muted",
                    ].join(" ")}
                  >
                    {formatIcon(node.format)}
                    <span className="truncate">{node.name}</span>
                    <span className="ml-auto shrink-0">{statusIcon(node.format, node.progressPct)}</span>
                  </button>
                  {m.trigger}
                </div>
              )}
            </RowMenu>
          </li>
        );
      })}
    </ul>
  );

  if (fullTree.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">Handbook trống — import ZIP để thêm nội dung.</p>;
  }
  if (tree.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">Không có mục khớp bộ lọc.</p>;
  }
  return renderNodes(tree, 0);
}
