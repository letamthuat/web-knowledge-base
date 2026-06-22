"use client";

import { useState } from "react";
import { format, differenceInDays } from "date-fns";
import { vi } from "date-fns/locale";
import { FileText, BookOpen, FileType2, Presentation, Image, Music, Video, FileCode, Globe, RotateCcw, Trash2, Layers, Folder } from "lucide-react";
import { restoreDocument, deletePermanent, deleteAllTrashed } from "@/lib/api/documents";
import { useTrashedHandbooks, restoreHandbook, removeHandbookPermanent, emptyTrashedHandbooks } from "@/lib/api/handbooks";
import { useTrashedFolders, restoreFolder, deleteFolderPermanent, emptyTrashedFolders } from "@/lib/api/folders";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { labels } from "@/lib/i18n/labels";
import { formatBytes } from "@/lib/storage";

const L = labels.trash;
const Lf = labels.formats;

const FORMAT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  pdf: { icon: FileText, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20" },
  epub: { icon: BookOpen, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
  docx: { icon: FileType2, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/20" },
  pptx: { icon: Presentation, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/20" },
  image: { icon: Image, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20" },
  audio: { icon: Music, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/20" },
  video: { icon: Video, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/20" },
  markdown: { icon: FileCode, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-950/20" },
  web_clip: { icon: Globe, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/20" },
};

const FALLBACK_CONFIG = { icon: FileText, color: "text-muted-foreground", bg: "bg-muted/40" };

interface Doc {
  _id: string;
  title: string;
  format: string;
  fileSizeBytes?: number | null;
  trashedAt?: number | null;
  createdAt: number;
}

interface TrashViewProps {
  docs: Doc[] | null | undefined;
}

type ContainerTarget = { kind: "handbook" | "folder"; id: string; name: string };

export function TrashView({ docs }: TrashViewProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [containerDeleteTarget, setContainerDeleteTarget] = useState<ContainerTarget | null>(null);

  const trashedHandbooks = useTrashedHandbooks();
  const trashedFolders = useTrashedFolders();

  async function handleRestore(docId: string) {
    await restoreDocument(docId);
    toast.success(L.restoreSuccess);
  }

  async function handleRestoreContainer(c: ContainerTarget) {
    if (c.kind === "handbook") await restoreHandbook(c.id);
    else await restoreFolder(c.id);
    toast.success(`Đã khôi phục ${c.kind === "handbook" ? "handbook" : "folder"} "${c.name}"`);
  }

  async function handleDeleteContainerPermanent() {
    if (!containerDeleteTarget) return;
    const c = containerDeleteTarget;
    if (c.kind === "handbook") await removeHandbookPermanent(c.id);
    else await deleteFolderPermanent(c.id);
    setContainerDeleteTarget(null);
    toast.success(L.deletePermanentSuccess);
  }

  // Đếm số file trong handbook (từ danh sách doc đã trash).
  const handbookFileCount = (hbId: string) =>
    (docs ?? []).filter((d) => (d as { handbookId?: string | null }).handbookId === hbId).length;

  const containers: ContainerTarget[] = [
    ...(trashedHandbooks ?? []).map((h) => ({ kind: "handbook" as const, id: h._id, name: h.name })),
    ...(trashedFolders ?? []).map((f) => ({ kind: "folder" as const, id: f._id, name: f.name })),
  ];

  async function handleDeletePermanent() {
    if (!deleteTarget) return;
    await deletePermanent(deleteTarget);
    setDeleteTarget(null);
    toast.success(L.deletePermanentSuccess);
  }

  async function handleClearAll() {
    // Dọn sạch: file + handbook + folder đang ở thùng rác.
    await deleteAllTrashed();
    await Promise.all([emptyTrashedHandbooks(), emptyTrashedFolders()]);
    setClearAllOpen(false);
    toast.success("Đã dọn sạch thùng rác");
  }

  if (!docs) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Đang tải" />
      </div>
    );
  }

  if (docs.length === 0 && containers.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center p-8">
        <Trash2 className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
        <h2 className="mb-1 text-lg font-semibold">{L.empty}</h2>
        <p className="text-sm text-muted-foreground">{L.emptyDesc}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">{L.autoDeleteNote}</p>
        {(docs.length > 0 || containers.length > 0) && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setClearAllOpen(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Xoá tất cả
          </Button>
        )}
      </div>

      {/* Folder & Handbook đã xoá — khôi phục/xoá vĩnh viễn cả container */}
      {containers.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Folder &amp; Handbook đã xoá</p>
          {containers.map((c) => (
            <div
              key={`${c.kind}:${c.id}`}
              className="group relative flex items-center gap-3 rounded-xl border bg-card p-4 transition-all hover:bg-muted/5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400">
                {c.kind === "handbook" ? <Layers className="h-5 w-5" /> : <Folder className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground" title={c.name}>{c.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.kind === "handbook" ? `Handbook · ${handbookFileCount(c.id)} file` : "Folder"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline" size="sm"
                  className="h-8 gap-1.5 rounded-lg border-muted-foreground/20 text-xs hover:bg-muted"
                  onClick={() => handleRestoreContainer(c)}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" /> {L.restore}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setContainerDeleteTarget(c)}
                  aria-label={`Xoá vĩnh viễn ${c.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {docs.length > 0 && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tài liệu đã xoá</p>
      )}
      <div className="space-y-2">
        {docs.map((doc) => {
          const config = FORMAT_CONFIG[doc.format] ?? FALLBACK_CONFIG;
          const Icon = config.icon;
          const daysLeft = doc.trashedAt
            ? 30 - differenceInDays(Date.now(), doc.trashedAt)
            : 30;

          return (
            <div
              key={doc._id}
              className="group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-all hover:bg-muted/5 hover:shadow-xs sm:pr-[180px]"
            >
              <div className="flex items-start gap-3">
                {/* Format Icon Container */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.bg} ${config.color} group-hover:scale-105 transition-transform`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </div>

                {/* Title & Metadata */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                    <p className="truncate text-sm font-semibold text-foreground" title={doc.title}>
                      {doc.title}
                    </p>
                    <Badge
                      variant="outline"
                      className={`w-fit h-4.5 px-1.5 text-[10px] font-medium shrink-0 ${
                        daysLeft <= 7
                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                          : "border-muted-foreground/20 bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {daysLeft > 0 ? labels.document.daysLeft(daysLeft) : "Sắp xoá"}
                    </Badge>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">
                      {Lf[doc.format as keyof typeof Lf] ?? doc.format}
                    </span>
                    {doc.fileSizeBytes && (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <span>{formatBytes(doc.fileSizeBytes)}</span>
                      </>
                    )}
                    {doc.trashedAt && (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <span>
                          {L.trashedAt} {format(doc.trashedAt, "dd/MM/yyyy", { locale: vi })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center gap-1.5 justify-end border-t border-border/40 pt-3 mt-1 sm:absolute sm:right-4 sm:top-1/2 sm:-translate-y-1/2 sm:border-t-0 sm:pt-0 sm:mt-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 rounded-lg border-muted-foreground/20 hover:bg-muted"
                  onClick={() => handleRestore(doc._id)}
                  aria-label={`Khôi phục ${doc.title}`}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {L.restore}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={() => setDeleteTarget(doc._id)}
                  aria-label={`Xoá vĩnh viễn ${doc.title}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L.deletePermanentConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{L.deletePermanentConfirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L.deletePermanentCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePermanent}
              className="bg-destructive hover:bg-destructive/90"
            >
              {L.deletePermanentConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!containerDeleteTarget} onOpenChange={(v) => !v && setContainerDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá vĩnh viễn {containerDeleteTarget?.kind === "handbook" ? "handbook" : "folder"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Sẽ xoá vĩnh viễn &ldquo;{containerDeleteTarget?.name}&rdquo; và TOÀN BỘ file bên trong. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L.deletePermanentCancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContainerPermanent} className="bg-destructive hover:bg-destructive/90">
              {L.deletePermanentConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dọn sạch thùng rác?</AlertDialogTitle>
            <AlertDialogDescription>
              Sẽ xoá vĩnh viễn TOÀN BỘ tài liệu, folder và handbook trong thùng rác. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive hover:bg-destructive/90"
            >
              Xoá tất cả
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
