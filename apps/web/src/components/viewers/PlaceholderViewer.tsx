"use client";

import { FileQuestion } from "lucide-react";

interface PlaceholderViewerProps {
  format: string;
}

export function PlaceholderViewer({ format }: PlaceholderViewerProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-muted-foreground">
      <FileQuestion className="h-16 w-16 opacity-40" aria-hidden />
      <div className="text-center">
        <p className="text-lg font-medium">Viewer đang được phát triển</p>
        <p className="mt-1 text-sm">Định dạng <span className="font-mono font-semibold">{format}</span> chưa được hỗ trợ.</p>
      </div>
    </div>
  );
}
