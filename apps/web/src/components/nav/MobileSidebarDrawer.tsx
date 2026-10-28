"use client";

/**
 * NavDrawer — drawer điều hướng DUY NHẤT cho mobile/tablet (< lg), mount 1 lần ở AppShell.
 * Mở/đóng qua store `navDrawer` (openNavDrawer() từ header các trang, vuốt mép ở Reader).
 * Nội dung (HandbookSidebarContent) chỉ mount từ lần mở đầu tiên → không tốn query lúc khởi động.
 * Vuốt sang trái để đóng: panel bám theo ngón tay.
 */
import { useEffect, useRef, useState } from "react";
import { HandbookSidebarContent } from "@/components/handbook/HandbookSidebar";
import { closeNavDrawer, useNavDrawerOpen } from "@/lib/navDrawer";

const PANEL_TRANSITION = "transform 380ms cubic-bezier(0.16, 1, 0.3, 1)";

export function NavDrawer() {
  const open = useNavDrawerOpen();
  const [everOpened, setEverOpened] = useState(false);
  if (open && !everOpened) setEverOpened(true);

  const panelRef = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; active: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeNavDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function onTouchStart(e: React.TouchEvent) {
    drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, active: false };
  }
  function onTouchMove(e: React.TouchEvent) {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel) return;
    const dx = e.touches[0].clientX - d.x;
    const dy = e.touches[0].clientY - d.y;
    // Chỉ "bắt" khi vuốt ngang sang trái rõ ràng — vuốt dọc vẫn cuộn cây bình thường
    if (!d.active) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      d.active = dx < 0;
      if (!d.active) { drag.current = null; return; }
      panel.style.transition = "none";
    }
    d.dx = Math.min(0, dx);
    panel.style.transform = `translate3d(${d.dx}px,0,0)`;
  }
  function onTouchEnd() {
    const d = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (!d?.active || !panel) return;
    panel.style.transition = PANEL_TRANSITION;
    // Đóng: trượt tiếp từ vị trí ngón tay (không nảy về 0 rồi mới đóng)
    const closing = d.dx < -64;
    panel.style.transform = closing ? "translate3d(-104%,0,0)" : "translate3d(0,0,0)";
    if (closing) closeNavDrawer();
  }

  return (
    <div
      className={`fixed inset-0 z-[60] lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label="Điều hướng"
    >
      {/* Backdrop — không dùng backdrop-blur (giật GPU trên PWA) */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        style={{ touchAction: "none" }}
        onClick={closeNavDrawer}
      />
      <aside
        ref={panelRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className="absolute left-0 top-0 h-full w-[86vw] max-w-[330px] rounded-r-[22px] border-r border-border bg-card shadow-[12px_0_40px_-12px_rgba(0,0,0,0.35)] will-change-transform"
        style={{
          paddingTop: "var(--safe-top)",
          paddingBottom: "var(--safe-bottom)",
          transform: open ? "translate3d(0,0,0)" : "translate3d(-104%,0,0)",
          transition: PANEL_TRANSITION,
          contain: "paint layout",
        }}
      >
        {everOpened && <HandbookSidebarContent onLinkClick={closeNavDrawer} />}
      </aside>
    </div>
  );
}
