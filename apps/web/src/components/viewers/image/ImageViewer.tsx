"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Id } from "@/../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageViewerProps {
  doc: { _id: Id<"documents">; title: string };
  downloadUrl: string;
}

export function ImageViewer({ doc, downloadUrl }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const [loadError, setLoadError] = useState(false);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(0.1, Math.min(10, s * (e.deltaY < 0 ? 1.1 : 0.9))));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  }, [offset]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return;
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.mx,
      y: dragStart.current.oy + e.clientY - dragStart.current.my,
    });
  }, [dragging]);

  const onMouseUp = useCallback(() => setDragging(false), []);

  const reset = useCallback(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, []);

  if (loadError) {
    return <div className="flex flex-1 items-center justify-center text-destructive text-sm">Không thể tải hình ảnh.</div>;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/60">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b bg-card px-4 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.min(10, s * 1.2))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <span className="w-14 text-center text-sm">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.max(0.1, s / 1.2))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Canvas */}
      <div
        className="flex flex-1 cursor-grab items-center justify-center overflow-hidden select-none active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={downloadUrl}
          alt={doc.title}
          draggable={false}
          onError={() => setLoadError(true)}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: dragging ? "none" : "transform 0.1s ease",
            maxWidth: "none",
          }}
        />
      </div>
    </div>
  );
}
