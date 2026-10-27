"use client";

import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  FileText, BookOpen, FileType2, Presentation, Image, Music, Video, FileCode, Globe,
  MoreVertical, Pencil, Trash2, Folder, FolderX, ExternalLink, SquarePlus, Download,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Id } from "@/_generated/dataModel";
import type { TagRow } from "@/lib/api/tags";
import { useFoldersList, assignDocToFolder, removeDocFromFolder, type FolderRow } from "@/lib/api/folders";
import { trashDocument, renameDocument, getDownloadUrl } from "@/lib/api/documents";
import { openTab } from "@/lib/api/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TagPopover } from "./TagPopover";
import { labels } from "@/lib/i18n/labels";
import { formatBytes } from "@/lib/storage";
import { toast } from "sonner";
import { useDocExport } from "@/hooks/useDocExport";

const L = labels.document;
const Lf = labels.formats;

const FORMAT_EXT: Record<string, string> = {
  pdf: ".pdf", epub: ".epub", docx: ".docx", pptx: ".pptx",
  image: ".jpg", audio: ".mp3", video: ".mp4", markdown: ".md", web_clip: ".html",
};

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, epub: BookOpen, docx: FileType2, pptx: Presentation,
  image: Image, audio: Music, video: Video, markdown: FileCode, web_clip: Globe,
};

const FORMAT_SPINES: Record<string, { border: string; bg: string; text: string }> = {
  pdf: { border: "border-l-rose-500", bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
  epub: { border: "border-l-amber-500", bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400" },
  docx: { border: "border-l-sky-500", bg: "bg-sky-500/10", text: "text-sky-700 dark:text-sky-400" },
  pptx: { border: "border-l-orange-500", bg: "bg-orange-500/10", text: "text-orange-700 dark:text-orange-400" },
  image: { border: "border-l-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400" },
  audio: { border: "border-l-purple-500", bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-400" },
  video: { border: "border-l-pink-500", bg: "bg-pink-500/10", text: "text-pink-700 dark:text-pink-400" },
  markdown: { border: "border-l-stone-500", bg: "bg-stone-500/10", text: "text-stone-700 dark:text-stone-300" },
  web_clip: { border: "border-l-teal-500", bg: "bg-teal-500/10", text: "text-teal-700 dark:text-teal-400" },
};

interface Doc {
  _id: Id<"documents">;
  title: string;
  format: string;
  fileSizeBytes?: number;
  createdAt: number;
  status: string;
}

interface DocumentCardProps {
  doc: Doc;
  viewMode: "grid" | "list";
  isSelected?: boolean;
  onToggleSelect?: () => void;
  tags?: TagRow[];
  folder?: FolderRow | null;
  progressPct?: number | null;
}

export function DocumentCard({ doc, viewMode, isSelected = false, onToggleSelect, tags, folder, progressPct }: DocumentCardProps) {
  const router = useRouter();
  const [showTrashDialog, setShowTrashDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newTitle, setNewTitle] = useState(doc.title);

  const docTags = tags;
  const currentFolder = folder;
  const { exportDoc, isExporting } = useDocExport();

  const spine = FORMAT_SPINES[doc.format] ?? {
    border: "border-l-primary",
    bg: "bg-primary/10",
    text: "text-primary",
  };

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const url = await getDownloadUrl(doc._id);
      const ext = FORMAT_EXT[doc.format] ?? "";
      const fileName = doc.title.endsWith(ext) ? doc.title : doc.title + ext;
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Không thể tải xuống tài liệu");
    }
  }

  async function handleOpenInTab(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await openTab(doc._id);
      router.push(`/reader/${doc._id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không thể mở tab");
    }
  }

  const Icon = FORMAT_ICONS[doc.format] ?? FileText;

  async function handleRename() {
    const title = newTitle.trim();
    if (!title || title === doc.title) { setShowRenameDialog(false); return; }
    try {
      await renameDocument(doc._id, title);
      toast.success("Đã đổi tên tài liệu");
    } catch {}
    setShowRenameDialog(false);
  }

  async function handleTrash() {
    try {
      await trashDocument(doc._id);
      toast.success("Đã chuyển vào thùng rác");
    } catch {
      toast.error("Không thể xoá tài liệu");
    }
    setShowTrashDialog(false);
  }

  const menu = (
    <DropdownMenuContent align="end" className="w-52">
      <DropdownMenuItem onClick={handleOpenInTab}>
        <SquarePlus className="mr-2 h-4 w-4" aria-hidden /> Mở trong tab mới
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => router.push(`/reader/${doc._id}`)}>
        <ExternalLink className="mr-2 h-4 w-4" aria-hidden /> Mở tài liệu
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => exportDoc(doc._id)} disabled={isExporting}>
        <Download className="mr-2 h-4 w-4" aria-hidden /> Export ZIP (file + ghi chú)
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleDownload}>
        <Download className="mr-2 h-4 w-4" aria-hidden /> Tải xuống
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => { setNewTitle(doc.title); setShowRenameDialog(true); }}>
        <Pencil className="mr-2 h-4 w-4" aria-hidden /> {L.rename}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setShowFolderDialog(true)}>
        <Folder className="mr-2 h-4 w-4" aria-hidden /> {currentFolder ? "Chuyển folder" : "Thêm vào folder"}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => setShowTrashDialog(true)} className="text-destructive focus:text-destructive">
        <Trash2 className="mr-2 h-4 w-4" aria-hidden /> {L.delete}
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  const dialogs = (
    <>
      <TrashDialog open={showTrashDialog} onOpenChange={setShowTrashDialog} onConfirm={handleTrash} />
      <RenameDialog open={showRenameDialog} onOpenChange={setShowRenameDialog} value={newTitle} onChange={setNewTitle} onSave={handleRename} />
      {showFolderDialog && (
        <FolderDialog open={showFolderDialog} onOpenChange={setShowFolderDialog} docId={doc._id} currentFolderId={currentFolder?._id ?? null} />
      )}
    </>
  );

  if (viewMode === "list") {
    return (
      <>
        <div className={`group flex items-center gap-3 rounded-2xl border border-border/80 bg-card/95 px-4 py-3 hover:bg-card hover:shadow-md transition-all duration-150 border-l-[4px] ${spine.border} ${isSelected ? "ring-2 ring-primary border-primary bg-primary/[0.04]" : ""}`}>
          {/* Checkbox */}
          {onToggleSelect && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
              className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all
                ${isSelected
                  ? "bg-primary border-primary"
                  : "bg-background border-muted-foreground/30 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                }`}
              aria-label={isSelected ? "Bỏ chọn" : "Chọn tài liệu"}
              aria-pressed={isSelected}
            >
              {isSelected && (
                <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          )}
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${spine.bg} ${spine.text} shrink-0`}>
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <button
              onClick={() => router.push(`/reader/${doc._id}`)}
              onMouseEnter={() => router.prefetch(`/reader/${doc._id}`)}
              onDoubleClick={() => { setNewTitle(doc.title); setShowRenameDialog(true); }}
              className="block truncate text-sm font-semibold text-foreground/90 hover:text-primary transition-colors text-left"
            >
              {doc.title}
            </button>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground font-medium uppercase">{Lf[doc.format as keyof typeof Lf] ?? doc.format}</span>
              {doc.fileSizeBytes && <span className="text-[11px] text-muted-foreground">· {formatBytes(doc.fileSizeBytes)}</span>}
              <span className="text-[11px] text-muted-foreground">· {format(doc.createdAt, "dd/MM/yyyy", { locale: vi })}</span>
              {progressPct != null && progressPct > 0 && (
                <span className="text-[11px] text-primary font-semibold">· {Math.round(progressPct * 100)}%</span>
              )}
              {currentFolder && (
                <Badge variant="outline" className="h-4 px-1.5 text-[10px] gap-1 rounded-md">
                  <Folder className="h-2.5 w-2.5" />{currentFolder.name}
                </Badge>
              )}
              {docTags?.map((tag) => (
                <Badge key={tag._id} variant="secondary" className="h-4 px-1.5 text-[10px] rounded-md" style={{ borderColor: tag.color ?? undefined }}>
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <TagPopover docId={doc._id} docTags={docTags} />
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground" aria-label="Tuỳ chọn">
                <MoreVertical className="h-4 w-4" aria-hidden />
              </DropdownMenuTrigger>
              {menu}
            </DropdownMenu>
          </div>
        </div>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <div className={`group relative flex flex-col rounded-[22px] border border-border/80 bg-card/95 p-4 hover:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-200 ease-out border-l-[4px] ${spine.border} select-none ${isSelected ? "ring-2 ring-primary border-primary bg-primary/[0.04]" : ""}`}>
        {/* Checkbox — top-left */}
        {onToggleSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            className={`absolute top-2.5 left-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all
              ${isSelected
                ? "bg-primary border-primary"
                : "bg-background border-muted-foreground/30 opacity-100 md:opacity-0 md:group-hover:opacity-100"
              }`}
            aria-label={isSelected ? "Bỏ chọn" : "Chọn tài liệu"}
            aria-pressed={isSelected}
          >
            {isSelected && (
              <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        )}

        {/* Header: icon + 3-dot */}
        <div className="mb-2.5 flex items-center justify-between gap-1">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${spine.bg} ${spine.text} shrink-0 transition-transform duration-200 group-hover:scale-105 ${onToggleSelect ? "ml-5" : ""}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Tuỳ chọn"
            >
              <MoreVertical className="h-3.5 w-3.5" aria-hidden />
            </DropdownMenuTrigger>
            {menu}
          </DropdownMenu>
        </div>

        {/* Document Title */}
        <button
          onClick={() => router.push(`/reader/${doc._id}`)}
          onMouseEnter={() => router.prefetch(`/reader/${doc._id}`)}
          onDoubleClick={() => { setNewTitle(doc.title); setShowRenameDialog(true); }}
          className="mb-2.5 line-clamp-2 text-xs font-semibold leading-snug text-left text-foreground/90 group-hover:text-primary transition-colors"
        >
          {doc.title}
        </button>

        {/* Metadata + Progress + Tags */}
        <div className="mt-auto space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
            <span className="font-medium uppercase tracking-wider text-[10px]">{Lf[doc.format as keyof typeof Lf] ?? doc.format}</span>
            {doc.fileSizeBytes && <span>· {formatBytes(doc.fileSizeBytes)}</span>}
          </div>

          {currentFolder && (
            <Badge variant="outline" className="text-[10px] gap-1 px-1.5 h-4 rounded-md">
              <Folder className="h-2.5 w-2.5" />{currentFolder.name}
            </Badge>
          )}

          {docTags && docTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {docTags.slice(0, 2).map((tag) => (
                <Badge key={tag._id} variant="secondary" className="h-4 px-1.5 text-[10px] rounded-md" style={{ borderColor: tag.color ?? undefined }}>
                  {tag.name}
                </Badge>
              ))}
              {docTags.length > 2 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px] rounded-md">+{docTags.length - 2}</Badge>}
            </div>
          )}

          {progressPct != null && progressPct > 0 && (
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground text-[10px]">Tiến độ</span>
                <span className="text-primary font-semibold text-[10px]">{Math.round(progressPct * 100)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/85 transition-all duration-300"
                  style={{ width: `${Math.round(progressPct * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 -ml-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pt-0.5">
            <TagPopover docId={doc._id} docTags={docTags} />
          </div>
        </div>
      </div>
      {dialogs}
    </>
  );
}

function FolderDialog({ open, onOpenChange, docId, currentFolderId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  docId: string;
  currentFolderId: string | null;
}) {
  const allFolders = useFoldersList();

  async function handleSelect(folderId: string) {
    try {
      await assignDocToFolder(docId, folderId);
      toast.success("Đã chuyển tài liệu vào folder");
      onOpenChange(false);
    } catch {
      toast.error("Thao tác thất bại");
    }
  }

  async function handleRemove() {
    try {
      await removeDocFromFolder(docId);
      toast.success("Đã xoá khỏi folder");
      onOpenChange(false);
    } catch {
      toast.error("Thao tác thất bại");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Chuyển vào folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {(!allFolders || allFolders.length === 0) && (
            <p className="py-4 text-center text-sm text-muted-foreground">Chưa có folder nào. Tạo folder trong "Thêm tài liệu".</p>
          )}
          {currentFolderId && (
            <button
              onClick={handleRemove}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <FolderX className="h-4 w-4" /> Xoá khỏi folder hiện tại
            </button>
          )}
          {allFolders?.map((folder) => (
            <button
              key={folder._id}
              onClick={() => handleSelect(folder._id)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors ${
                currentFolderId === folder._id ? "bg-muted font-medium" : ""
              }`}
            >
              <Folder className="h-4 w-4 text-amber-500" />
              {folder.name}
              {currentFolderId === folder._id && <span className="ml-auto text-xs text-muted-foreground">Hiện tại</span>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TrashDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{L.deleteConfirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{L.deleteConfirmDesc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{L.deleteCancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">
            {L.deleteConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RenameDialog({ open, onOpenChange, value, onChange, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  value: string; onChange: (v: string) => void; onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{L.renameTitle}</DialogTitle></DialogHeader>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onOpenChange(false); }}
          placeholder={L.renamePlaceholder}
          maxLength={200}
          autoFocus
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{L.renameCancel}</Button>
          <Button onClick={onSave}>{L.renameSave}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
