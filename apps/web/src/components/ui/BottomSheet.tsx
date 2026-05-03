"use client";

import { useEffect, useRef, useCallback } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const isDragging = useRef(false);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onDragStart = useCallback((clientY: number) => {
    isDragging.current = true;
    dragStartY.current = clientY;
    dragCurrentY.current = 0;
    if (panelRef.current) panelRef.current.style.transition = "none";
  }, []);

  const onDragMove = useCallback((clientY: number) => {
    if (!isDragging.current || !panelRef.current) return;
    const delta = Math.max(0, clientY - dragStartY.current);
    dragCurrentY.current = delta;
    panelRef.current.style.transform = `translateY(${delta}px)`;
  }, []);

  const onDragEnd = useCallback(() => {
    if (!isDragging.current || !panelRef.current) return;
    isDragging.current = false;
    const panelHeight = panelRef.current.offsetHeight;
    if (panelRef.current) {
      panelRef.current.style.transition = "";
      panelRef.current.style.transform = "";
    }
    // Close if dragged more than 40% of panel height
    if (dragCurrentY.current > panelHeight * 0.4) {
      onClose();
    }
  }, [onClose]);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    onDragStart(e.touches[0].clientY);
  }, [onDragStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    onDragMove(e.touches[0].clientY);
  }, [onDragMove]);

  const onTouchEnd = useCallback(() => {
    onDragEnd();
  }, [onDragEnd]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[50] flex items-end md:items-center md:justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full md:max-w-lg rounded-t-2xl md:rounded-2xl border bg-card shadow-2xl"
        style={{
          paddingBottom: "var(--safe-bottom)",
          transform: "translateY(0)",
          transition: "transform 0.25s ease",
          maxHeight: "90dvh",
          display: "flex",
          flexDirection: "column",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Title */}
        {title && (
          <div className="shrink-0 px-4 pb-2 pt-1">
            <h2 className="text-sm font-semibold">{title}</h2>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
