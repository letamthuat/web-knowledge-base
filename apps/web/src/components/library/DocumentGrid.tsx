"use client";

import { LayoutGrid, List, Upload } from "lucide-react";
import { Id } from "@/_generated/dataModel";
import { DocumentCard } from "./DocumentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";

const L = labels.library;

interface Doc {
  _id: Id<"documents">;
  title: string;
  format: string;
  fileSizeBytes?: number;
  createdAt: number;
  status: string;
}

interface DocumentGridProps {
  docs: Doc[] | undefined;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onUploadClick: () => void;
  isFiltered?: boolean;
}

export function DocumentGrid({ docs, viewMode, onViewModeChange, onUploadClick, isFiltered }: DocumentGridProps) {
  if (docs === undefined) {
    return <DocumentGridSkeleton viewMode={viewMode} />;
  }

  if (docs.length === 0) {
    return (
      <div className="space-y-4">
        <ViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} count={0} />
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
          {isFiltered ? (
            <>
              <p className="mb-1 text-base font-semibold">{L.noResults}</p>
              <p className="text-sm text-muted-foreground">{L.noResultsDesc}</p>
            </>
          ) : (
            <>
              <Upload className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
              <h2 className="mb-1 text-lg font-semibold">{L.empty}</h2>
              <p className="mb-4 max-w-xs text-sm text-muted-foreground">{L.emptyDescription}</p>
              <Button onClick={onUploadClick}>
                <Upload className="mr-2 h-4 w-4" aria-hidden /> {L.uploadButton}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} count={docs.length} />
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {docs.map((doc) => (
            <DocumentCard key={doc._id} doc={doc} viewMode="grid" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <DocumentCard key={doc._id} doc={doc} viewMode="list" />
          ))}
        </div>
      )}
    </div>
  );
}

function ViewToggle({ viewMode, onViewModeChange, count }: {
  viewMode: "grid" | "list"; onViewModeChange: (m: "grid" | "list") => void; count: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">{count} tài liệu</p>
      <div className="flex items-center rounded-md border p-0.5">
        <Button
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => onViewModeChange("grid")}
          aria-label={L.gridView}
          aria-pressed={viewMode === "grid"}
        >
          <LayoutGrid className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => onViewModeChange("list")}
          aria-label={L.listView}
          aria-pressed={viewMode === "list"}
        >
          <List className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function DocumentGridSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
  const items = Array.from({ length: 8 });
  if (viewMode === "list") {
    return (
      <div className="space-y-2">
        {items.map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {items.map((_, i) => (
        <div key={i} className="rounded-xl border p-3 space-y-2">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
