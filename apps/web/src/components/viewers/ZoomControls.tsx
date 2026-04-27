"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  minScale?: number;
  maxScale?: number;
}

export function ZoomControls({ scale, onZoomIn, onZoomOut, onReset, minScale = 0.2, maxScale = 3 }: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomOut} disabled={scale <= minScale} title="Thu nhỏ">
        <ZoomOut className="h-4 w-4" />
      </Button>
      <button
        onClick={onReset}
        className="w-14 text-center text-sm tabular-nums hover:bg-muted rounded px-1 py-0.5 transition-colors"
        title="Nhấn để về kích thước mặc định"
      >
        {Math.round(scale * 100)}%
      </button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomIn} disabled={scale >= maxScale} title="Phóng to">
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReset} title="Về kích thước mặc định">
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function useZoom(defaultScale = 1, step = 0.1, min = 0.2, max = 3) {
  const [scale, setScale] = useState(defaultScale);
  const zoomIn = () => setScale((s) => Math.min(max, +(s + step).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(min, +(s - step).toFixed(2)));
  const reset = () => setScale(defaultScale);
  return { scale, setScale, zoomIn, zoomOut, reset, min, max };
}
