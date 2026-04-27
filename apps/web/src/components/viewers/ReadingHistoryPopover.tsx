"use client";

import { useQuery } from "convex/react";
import { api } from "@/_generated/api";
import { Id } from "@/_generated/dataModel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { History } from "lucide-react";
import type { ReadingPosition } from "@/lib/position";

interface Props {
  docId: Id<"documents">;
  onJump: (pos: ReadingPosition) => void;
}

function formatOpenedAt(ts: number): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function summarizePosition(posType: string, posValue: string): string {
  try {
    const pos = JSON.parse(posValue);
    if (posType === "pdf_page") return `Trang ${pos.page}`;
    if (posType === "slide_index") return `Slide ${pos.slide + 1}`;
    if (posType === "scroll_pct") return `${Math.round(pos.pct * 100)}%`;
    if (posType === "time_seconds") {
      const s = Math.round(pos.seconds);
      const m = Math.floor(s / 60);
      return `${m}:${String(s % 60).padStart(2, "0")}`;
    }
  } catch {}
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readingHistoryApi = (api as any).reading_history?.queries ?? (api as any)["reading_history/queries"];

export function ReadingHistoryPopover({ docId, onJump }: Props) {
  const entries = useQuery(readingHistoryApi?.getByDoc, { docId, limit: 10 });

  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm hover:bg-accent hover:text-accent-foreground" title="Lịch sử đọc">
        <History className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-72 p-2">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Lịch sử mở tài liệu</p>
        {!entries || entries.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">Chưa có lịch sử</p>
        ) : (
          <ul className="space-y-0.5">
            {(entries as Array<{
              _id: string;
              openedAt: number;
              positionType?: string;
              positionValue?: string;
            }>).map((entry) => (
              <li key={entry._id}>
                <button
                  onClick={() => {
                    if (entry.positionType && entry.positionValue) {
                      try {
                        const raw = JSON.parse(entry.positionValue);
                        const pos = { type: entry.positionType, ...raw } as ReadingPosition;
                        onJump(pos);
                      } catch {}
                    }
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="text-muted-foreground text-xs">{formatOpenedAt(entry.openedAt)}</span>
                  {entry.positionType && entry.positionValue && (
                    <span className="text-xs font-medium text-foreground">
                      {summarizePosition(entry.positionType, entry.positionValue)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
