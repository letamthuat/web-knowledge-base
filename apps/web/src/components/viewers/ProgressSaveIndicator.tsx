"use client";

import { CheckCircle, Clock, Loader2, Save, AlertCircle } from "lucide-react";
import type { SaveStatus } from "@/hooks/useReadingProgress";
import { Button } from "@/components/ui/button";

interface ProgressSaveIndicatorProps {
  status: SaveStatus;
  onSaveNow: () => void;
}

export function ProgressSaveIndicator({ status, onSaveNow }: ProgressSaveIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {status === "idle" && null}

      {status === "pending" && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Chưa lưu</span>
        </span>
      )}

      {status === "saving" && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="hidden sm:inline">Đang lưu...</span>
        </span>
      )}

      {status === "saved" && (
        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <CheckCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Đã lưu</span>
        </span>
      )}

      {status === "error" && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Lưu thất bại</span>
        </span>
      )}

      {/* Manual save button — show when pending or error */}
      {(status === "pending" || status === "error") && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onSaveNow}
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Lưu ngay</span>
        </Button>
      )}
    </div>
  );
}
