"use client";

/**
 * MobileSidebarDrawer — drawer trượt cho mobile/PWA, render Y HỆT sidebar desktop.
 * Nguồn sự thật duy nhất là HandbookSidebarContent (dùng chung với desktop),
 * nên mọi module/cây Handbook/Tài liệu lẻ/Ghi chú/Thùng rác/tài khoản luôn đồng bộ.
 * onLinkClick đóng drawer sau khi điều hướng.
 */
import { useEffect } from "react";
import { HandbookSidebarContent } from "@/components/handbook/HandbookSidebar";

export function MobileSidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Khoá cuộn nền khi drawer mở
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Đóng bằng phím Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] xl:hidden" role="dialog" aria-modal="true" aria-label="Điều hướng">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      {/* Panel — full-height, giống hệt sidebar desktop */}
      <aside
        className="absolute left-0 top-0 h-full w-[85vw] max-w-[320px] border-r border-border bg-card shadow-xl"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <HandbookSidebarContent onLinkClick={onClose} />
      </aside>
    </div>
  );
}
