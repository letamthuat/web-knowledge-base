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
  // Đóng bằng phím Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[60] xl:hidden transition-opacity duration-200 ${
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label="Điều hướng"
    >
      {/* Backdrop — mượt mà, không dùng backdrop-blur gây giật GPU trên PWA mobile */}
      <div
        className="absolute inset-0 bg-black/45"
        style={{ touchAction: "none" }}
        onClick={onClose}
      />
      {/* Panel — hardware-accelerated slide-in bằng pure GPU transform (không unmount component) */}
      <aside
        className="absolute left-0 top-0 h-full w-[85vw] max-w-[320px] border-r border-border bg-card shadow-2xl transition-transform duration-200 ease-out will-change-transform"
        style={{
          paddingTop: "var(--safe-top)",
          paddingBottom: "var(--safe-bottom)",
          transform: open ? "translate3d(0, 0, 0)" : "translate3d(-100%, 0, 0)",
          contain: "paint layout",
        }}
      >
        <HandbookSidebarContent onLinkClick={onClose} />
      </aside>
    </div>
  );
}
