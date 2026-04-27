"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronDown } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/../../../convex/_generated/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { labels } from "@/lib/i18n/labels";

const L = labels.library;
const Lf = labels.formats;

const FORMATS = ["pdf", "epub", "docx", "pptx", "image", "audio", "video", "markdown", "web_clip"] as const;

const TRIGGER_CLS =
  "inline-flex h-8 items-center gap-1 rounded-lg border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted transition-colors";

export interface FilterState {
  tags: string[];
  folderId: string | null;
  formats: string[];
  from: string | null;
  to: string | null;
}

export function parseFilters(searchParams: URLSearchParams): FilterState {
  return {
    tags: searchParams.getAll("tag"),
    folderId: searchParams.get("folder"),
    formats: searchParams.getAll("format"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  };
}

export function hasActiveFilters(f: FilterState) {
  return f.tags.length > 0 || !!f.folderId || f.formats.length > 0 || !!f.from || !!f.to;
}

interface FilterBarProps {
  filters: FilterState;
}

export function FilterBar({ filters }: FilterBarProps) {
  const router = useRouter();
  const allTags = useQuery(api.tags.queries.listByUser);
  const allFolders = useQuery(api.folders.queries.listByUser);

  const updateUrl = useCallback(
    (newFilters: Partial<FilterState>) => {
      const merged = { ...filters, ...newFilters };
      const params = new URLSearchParams();
      merged.tags.forEach((t) => params.append("tag", t));
      if (merged.folderId) params.set("folder", merged.folderId);
      merged.formats.forEach((f) => params.append("format", f));
      if (merged.from) params.set("from", merged.from);
      if (merged.to) params.set("to", merged.to);
      router.push(`/library?${params.toString()}`, { scroll: false });
    },
    [filters, router],
  );

  const toggleTag = (tagId: string) => {
    const tags = filters.tags.includes(tagId)
      ? filters.tags.filter((t) => t !== tagId)
      : [...filters.tags, tagId];
    updateUrl({ tags });
  };

  const toggleFormat = (fmt: string) => {
    const formats = filters.formats.includes(fmt)
      ? filters.formats.filter((f) => f !== fmt)
      : [...filters.formats, fmt];
    updateUrl({ formats });
  };

  const clearAll = () => router.push("/library", { scroll: false });
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Tag filter */}
      <Popover>
        <PopoverTrigger className={TRIGGER_CLS} aria-label="Lọc theo tag">
          Tag
          {filters.tags.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-xs">{filters.tags.length}</Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <p className="mb-1.5 px-1 text-xs font-semibold text-muted-foreground">{L.filterByTag}</p>
          {(allTags ?? []).length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">Chưa có tag nào</p>
          )}
          {(allTags ?? []).map((tag) => {
            const isActive = filters.tags.includes(tag._id);
            return (
              <button
                key={tag._id}
                onClick={() => toggleTag(tag._id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${isActive ? "bg-muted" : ""}`}
                aria-pressed={isActive}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tag.color ?? "#6b7280" }} aria-hidden />
                <span className="flex-1 truncate text-left">{tag.name}</span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* Folder filter */}
      <Popover>
        <PopoverTrigger className={TRIGGER_CLS} aria-label="Lọc theo folder">
          Folder
          {filters.folderId && <Badge variant="secondary" className="h-4 px-1 text-xs">1</Badge>}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <p className="mb-1.5 px-1 text-xs font-semibold text-muted-foreground">{L.filterByFolder}</p>
          <button
            onClick={() => updateUrl({ folderId: null })}
            className={`flex w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted ${!filters.folderId ? "bg-muted font-medium" : ""}`}
          >
            Tất cả
          </button>
          {(allFolders ?? []).length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">Chưa có folder nào</p>
          )}
          {(allFolders ?? []).map((folder) => (
            <button
              key={folder._id}
              onClick={() => updateUrl({ folderId: folder._id })}
              className={`flex w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted ${filters.folderId === folder._id ? "bg-muted font-medium" : ""}`}
              aria-pressed={filters.folderId === folder._id}
            >
              {folder.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Format filter */}
      <Popover>
        <PopoverTrigger className={TRIGGER_CLS} aria-label="Lọc theo định dạng">
          Định dạng
          {filters.formats.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-xs">{filters.formats.length}</Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <p className="mb-1.5 px-1 text-xs font-semibold text-muted-foreground">{L.filterByFormat}</p>
          {FORMATS.map((fmt) => {
            const isActive = filters.formats.includes(fmt);
            return (
              <button
                key={fmt}
                onClick={() => toggleFormat(fmt)}
                className={`flex w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted ${isActive ? "bg-muted" : ""}`}
                aria-pressed={isActive}
              >
                {Lf[fmt as keyof typeof Lf]}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* Date range */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => updateUrl({ from: e.target.value || null })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Từ ngày"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => updateUrl({ to: e.target.value || null })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Đến ngày"
        />
      </div>

      {/* Clear all */}
      {active && (
        <Button variant="ghost" size="sm" onClick={clearAll} aria-label="Xoá bộ lọc">
          <X className="h-3.5 w-3.5" aria-hidden />
          {L.clearFilter}
        </Button>
      )}
    </div>
  );
}
