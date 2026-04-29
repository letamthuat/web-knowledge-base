"use client";

import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  FileText, BookOpen, FileType2, Presentation, Image, Music, Video, FileCode, Globe,
  MoreVertical, Pencil, Trash2, Folder, FolderX, ExternalLink,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TagPopover } from "./TagPopover";
import { labels } from "@/lib/i18n/labels";
import { formatBytes } from "@/lib/storage";
import { toast } from "sonner";

const L = labels.document;
const Lf = labels.formats;

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, epub: BookOpen, docx: FileType2, pptx: Presentation,
  image: Image, audio: Music, video: Video, markdown: FileCode, web_clip: Globe,
};

const FORMAT_COLORS: Record<string, string> = {
  pdf: "text-red-500", epub: "text-blue-500", docx: "text-blue-700",
  pptx: "text-orange-500", image: "text-green-500", audio: "text-purple-500",
  video: "text-pink-500", markdown: "text-gray-500", web_clip: "text-cyan-500",
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
}

export function DocumentCard({ doc, viewMode }: DocumentCardProps) {
  const router = useRouter();
  const [showTrashDialog, setShowTrashDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newTitle, setNewTitle] = useState(doc.title);

  const docTags = useQuery(api.tags.queries.listForDoc, { docId: doc._id });
  const currentFolder = useQuery(api.folders.queries.getFolderForDoc, { docId: doc._id });
  const readingProgress = useQuery(api.reading_progress.queries.getByDoc, { docId: doc._id });
  const trashMutation = useMutation(api.documents.mutations.trash);
  const renameMutation = useMutation(api.documents.mutations.rename);

  const Icon = FORMAT_ICONS[doc.format] ?? FileText;
  const iconColor = FORMAT_COLORS[doc.format] ?? "text-gray-400";

  async function handleRename() {
    const title = newTitle.trim();
    if (!title || title === doc.title) { setShowRenameDialog(false); return; }
    try {
      await renameMutation({ docId: doc._id, newTitle: title });
      toast.success("Đã đổi tên tài liệu");
    } catch {}
    setShowRenameDialog(false);
  }

  async function handleTrash() {
    await trashMutation({ docId: doc._id });
    setShowTrashDialog(false);
  }

  const menu = (
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => router.push(`/reader/${doc._id}`)}>
        <ExternalLink className="mr-2 h-4 w-4" aria-hidden /> Mở tài liệu
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => { setNewTitle(doc.title); setShowRenameDialog(true); }}>
        <Pencil className="mr-2 h-4 w-4" aria-hidden /> {L.rename}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setShowFolderDialog(true)}>
        <Folder className="mr-2 h-4 w-4" aria-hidden />
        {currentFolder ? "Đổi folder" : L.assignFolder}
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
      <FolderDialog open={showFolderDialog} onOpenChange={setShowFolderDialog} docId={doc._id} currentFolderId={currentFolder?._id ?? null} />
    </>
  );

  if (viewMode === "list") {
    return (
      <>
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
          <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} aria-hidden />
          <div className="flex-1 min-w-0">
            <button
              onClick={() => router.push(`/reader/${doc._id}`)}
              onDoubleClick={() => { setNewTitle(doc.title); setShowRenameDialog(true); }}
              className="block truncate text-sm font-medium text-left hover:underline"
            >
              {doc.title}
            </button>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">{Lf[doc.format as keyof typeof Lf] ?? doc.format}</span>
              {doc.fileSizeBytes && <span className="text-xs text-muted-foreground">· {formatBytes(doc.fileSizeBytes)}</span>}
              <span className="text-xs text-muted-foreground">· {format(doc.createdAt, "dd/MM/yyyy", { locale: vi })}</span>
              {readingProgress?.progressPct != null && readingProgress.progressPct > 0 && (
                <span className="text-xs text-primary font-medium">· {Math.round(readingProgress.progressPct * 100)}%</span>
              )}
              {currentFolder && (
                <Badge variant="outline" className="h-4 px-1.5 text-xs gap-1">
                  <Folder className="h-2.5 w-2.5" />{currentFolder.name}
                </Badge>
              )}
              {docTags?.map((tag: { _id: string; name: string; color?: string }) => (
                <Badge key={tag._id} variant="secondary" className="h-4 px-1.5 text-xs" style={{ borderColor: tag.color ?? undefined }}>
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <TagPopover docId={doc._id} />
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors" aria-label="Tuỳ chọn">
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
      <div className="group relative flex flex-col rounded-xl border bg-card p-4 hover:shadow-md transition-all">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all" aria-label="Tuỳ chọn">
              <MoreVertical className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            {menu}
          </DropdownMenu>
        </div>

        <button
          onClick={() => router.push(`/reader/${doc._id}`)}
          onDoubleClick={() => { setNewTitle(doc.title); setShowRenameDialog(true); }}
          className="mb-1 line-clamp-2 text-sm font-medium text-left leading-snug hover:underline"
        >
          {doc.title}
        </button>

        <div className="mt-auto pt-2 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{Lf[doc.format as keyof typeof Lf] ?? doc.format}</span>
            {doc.fileSizeBytes && <span>· {formatBytes(doc.fileSizeBytes)}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{format(doc.createdAt, "dd/MM/yyyy", { locale: vi })}</p>

          {currentFolder && (
            <Badge variant="outline" className="text-xs gap-1 px-1.5">
              <Folder className="h-2.5 w-2.5" />{currentFolder.name}
            </Badge>
          )}

          {docTags && docTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {docTags.slice(0, 3).map((tag) => (
                <Badge key={tag._id} variant="secondary" className="h-4 px-1.5 text-xs" style={{ borderColor: tag.color ?? undefined }}>
                  {tag.name}
                </Badge>
              ))}
              {docTags.length > 3 && <Badge variant="secondary" className="h-4 px-1.5 text-xs">+{docTags.length - 3}</Badge>}
            </div>
          )}

          {readingProgress?.progressPct != null && readingProgress.progressPct > 0 && (
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.round(readingProgress.progressPct * 100)}%</span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round(readingProgress.progressPct * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 -ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <TagPopover docId={doc._id} />
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
  docId: Id<"documents">;
  currentFolderId: Id<"folders"> | null;
}) {
  const allFolders = useQuery(api.folders.queries.listByUser);
  const assignDoc = useMutation(api.folders.mutations.assignDoc);
  const removeDoc = useMutation(api.folders.mutations.removeDoc);

  async function handleSelect(folderId: Id<"folders">) {
    try {
      await assignDoc({ folderId, docId });
      toast.success("Đã chuyển tài liệu vào folder");
      onOpenChange(false);
    } catch {
      toast.error("Thao tác thất bại");
    }
  }

  async function handleRemove() {
    try {
      await removeDoc({ docId });
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
