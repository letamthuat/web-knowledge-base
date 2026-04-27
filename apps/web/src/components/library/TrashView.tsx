"use client";

import { useState } from "react";
import { format, differenceInDays } from "date-fns";
import { vi } from "date-fns/locale";
import { FileText, BookOpen, FileType2, Presentation, Image, Music, Video, FileCode, Globe, RotateCcw, Trash2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/../../../convex/_generated/api";
import { Id } from "@/../../../convex/_generated/dataModel";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { labels } from "@/lib/i18n/labels";
import { formatBytes } from "@/lib/storage";

const L = labels.trash;
const Lf = labels.formats;

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, epub: BookOpen, docx: FileType2, pptx: Presentation,
  image: Image, audio: Music, video: Video, markdown: FileCode, web_clip: Globe,
};

interface Doc {
  _id: Id<"documents">;
  title: string;
  format: string;
  fileSizeBytes?: number;
  trashedAt?: number;
  createdAt: number;
}

interface TrashViewProps {
  docs: Doc[] | null | undefined;
}

export function TrashView({ docs }: TrashViewProps) {
  const [deleteTarget, setDeleteTarget] = useState<Id<"documents"> | null>(null);

  const restoreMutation = useMutation(api.documents.mutations.restore);
  const deleteMutation = useMutation(api.documents.mutations.deletePermanent);

  async function handleRestore(docId: Id<"documents">) {
    await restoreMutation({ docId });
    toast.success(L.restoreSuccess);
  }

  async function handleDeletePermanent() {
    if (!deleteTarget) return;
    await deleteMutation({ docId: deleteTarget });
    setDeleteTarget(null);
    toast.success(L.deletePermanentSuccess);
  }

  if (!docs) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Đang tải" />
      </div>
    );
  }

  if (docs.length === 0) {
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
      <p className="mb-4 text-xs text-muted-foreground">{L.autoDeleteNote}</p>
      <div className="space-y-2">
        {docs.map((doc) => {
          const Icon = FORMAT_ICONS[doc.format] ?? FileText;
          const daysLeft = doc.trashedAt
            ? 30 - differenceInDays(Date.now(), doc.trashedAt)
            : 30;

          return (
            <div key={doc._id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {Lf[doc.format as keyof typeof Lf] ?? doc.format}
                  </span>
                  {doc.fileSizeBytes && (
                    <span className="text-xs text-muted-foreground">· {formatBytes(doc.fileSizeBytes)}</span>
                  )}
                  {doc.trashedAt && (
                    <span className="text-xs text-muted-foreground">
                      · {L.trashedAt} {format(doc.trashedAt, "dd/MM/yyyy", { locale: vi })}
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={`h-4 px-1.5 text-xs ${daysLeft <= 7 ? "border-destructive text-destructive" : "text-muted-foreground"}`}
                  >
                    {daysLeft > 0 ? labels.document.daysLeft(daysLeft) : "Sắp xoá"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(doc._id)}
                  aria-label={`Khôi phục ${doc.title}`}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {L.restore}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(doc._id)}
                  className="text-destructive hover:text-destructive"
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
    </>
  );
}
