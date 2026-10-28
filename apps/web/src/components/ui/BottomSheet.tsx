"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  minHeight?: string;
}

const SNAP_BACK = "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)";
const EXIT_MS = 240;

/**
 * Bottom sheet trượt lên bằng lò xo, trượt xuống khi đóng.
 * Chỉ kéo được ở tay nắm + tiêu đề — kéo slider/cuộn nội dung không làm sheet trượt theo.
 */
export function BottomSheet({ open, onClose, children, title, minHeight }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const isDragging = useRef(false);

  // Giữ sheet trong DOM thêm một nhịp để chạy hiệu ứng đóng
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const t = setTimeout(() => { setRendered(false); setClosing(false); }, EXIT_MS);
    return () => clearTimeout(t);
  }, [open, rendered]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
    if (panelRef.current) panelRef.current.style.transition = "none";
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !panelRef.current) return;
    const delta = Math.max(0, e.touches[0].clientY - dragStartY.current);
    dragCurrentY.current = delta;
    panelRef.current.style.transform = `translateY(${delta}px)`;
  }, []);

  const onTouchEnd = useCallback(() => {
    const panel = panelRef.current;
    if (!isDragging.current || !panel) return;
    isDragging.current = false;
    panel.style.transition = SNAP_BACK;
    // Kéo quá 30% chiều cao (hoặc > 120px) → đóng, trượt tiếp từ vị trí ngón tay
    if (dragCurrentY.current > Math.min(120, panel.offsetHeight * 0.3)) {
      onClose();
    } else {
      panel.style.transform = "translateY(0)";
    }
  }, [onClose]);

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center md:justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/45"
        style={{ animation: closing ? `sheet-fade-out ${EXIT_MS}ms ease-in forwards` : "sheet-fade-in 220ms ease-out both" }}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex w-full flex-col rounded-t-[26px] border border-b-0 bg-card shadow-[0_-16px_48px_rgba(0,0,0,0.18)] md:max-w-lg md:rounded-[26px] md:border-b"
        style={{
          paddingBottom: "var(--safe-bottom)",
          maxHeight: "90dvh",
          minHeight,
          transition: SNAP_BACK,
          // backwards: sau khi vào xong trả quyền transform cho thao tác kéo
          animation: closing
            ? `sheet-down ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1) forwards`
            : "sheet-up 460ms var(--ease-spring) backwards",
        }}
      >
        {/* Vùng kéo: tay nắm + tiêu đề */}
        <div
          className="shrink-0 touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div className="flex justify-center pb-1 pt-3">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          {title && (
            <div className="px-5 pb-2 pt-1">
              <h2 className="font-display text-lg font-semibold">{title}</h2>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
