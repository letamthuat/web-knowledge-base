"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import { useSession } from "@/lib/auth-client";
import { ViewerDispatcher } from "@/components/viewers/ViewerDispatcher";
import { ProgressSaveIndicator } from "@/components/viewers/ProgressSaveIndicator";
import { ReaderProgressContext } from "@/components/viewers/ReaderProgressContext";
import { ReadingHistoryPopover } from "@/components/viewers/ReadingHistoryPopover";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import type { ReadingPosition } from "@/lib/position";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabBar } from "@/components/tabs/TabBar";
import { TabDropdown } from "@/components/tabs/TabDropdown";
import { useTabSync } from "@/hooks/useTabSync";

function ReaderShell({ doc, downloadUrl }: {
  doc: { _id: Id<"documents">; format: string; title: string };
  downloadUrl: string;
}) {
  const router = useRouter();
  const { saveNow, saveStatus, savePosition, progress } = useReadingProgress(doc._id);
  const { tabs } = useTabSync();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const showDropdown = isMobile && tabs.length >= 4;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordOpen = useMutation((api as any).reading_history.mutations.recordOpen);

  const jumpHandlerRef = useRef<((pos: ReadingPosition) => void) | null>(null);
  const registerJump = useCallback((fn: (pos: ReadingPosition) => void) => {
    jumpHandlerRef.current = fn;
  }, []);
  const jumpTo = useCallback((pos: ReadingPosition) => {
    jumpHandlerRef.current?.(pos);
  }, []);

  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current || progress === undefined) return;
    recorded.current = true;
    recordOpen({
      docId: doc._id,
      positionType: progress?.positionType as ReadingPosition["type"] | undefined,
      positionValue: progress?.positionValue,
    }).catch(() => {});
  }, [progress, doc._id, recordOpen]);

  return (
    <ReaderProgressContext.Provider value={{ saveNow, saveStatus, savePosition, jumpTo, registerJump }}>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/library")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Thư viện
          </Button>
          <span className="flex-1 truncate text-sm font-medium">{doc.title}</span>
          <ReadingHistoryPopover docId={doc._id} onJump={jumpTo} />
          <ProgressSaveIndicator status={saveStatus} onSaveNow={saveNow} />
        </header>

        <div className="flex flex-1 flex-col overflow-hidden">
          {showDropdown
            ? <TabDropdown currentDocId={doc._id} />
            : <TabBar currentDocId={doc._id} />}
          <ViewerDispatcher doc={doc} downloadUrl={downloadUrl} />
        </div>
      </div>
    </ReaderProgressContext.Provider>
  );
}

export default function ReaderPageInner() {
  const router = useRouter();
  const params = useParams();
  const docId = params.docId as Id<"documents">;

  const { data: session, isPending } = useSession();
  const doc = useQuery(api.documents.queries.getById, { docId });
  const getDownloadUrl = useAction(api.documents.actions.getDownloadUrl);

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [session, isPending, router]);

  useEffect(() => {
    if (!doc) return;
    getDownloadUrl({ docId })
      .then(setDownloadUrl)
      .catch((e) => setUrlError(e instanceof Error ? e.message : "Không thể tải file"));
  }, [doc, docId, getDownloadUrl]);

  if (isPending) return <FullPageSpinner />;
  if (!session) return null;
  if (doc === undefined) return <FullPageSpinner />;
  if (doc === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Không tìm thấy tài liệu.</p>
        <Button variant="outline" onClick={() => router.push("/library")}>Về thư viện</Button>
      </div>
    );
  }

  if (urlError) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/library")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Thư viện
          </Button>
          <span className="flex-1 truncate text-sm font-medium">{doc.title}</span>
        </header>
        <div className="flex flex-1 items-center justify-center text-destructive text-sm">{urlError}</div>
      </div>
    );
  }

  if (!downloadUrl) return <FullPageSpinner />;

  return <ReaderShell doc={doc} downloadUrl={downloadUrl} />;
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
