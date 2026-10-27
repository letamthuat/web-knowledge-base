"use client";

import { useEffect, useState, useRef } from "react";
import { usePwa } from "@/contexts/PwaContext";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";

export function OnlineOfflineStatus() {
  const { isOnline } = usePwa();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowReconnected(false);
    } else if (wasOffline.current) {
      // Transition from offline to online
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        wasOffline.current = false;
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!isOnline) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed top-2 left-1/2 -translate-x-1/2 z-[75] px-3.5 py-1.5 rounded-full bg-amber-500/95 dark:bg-amber-600/95 text-white shadow-lg backdrop-blur-md flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-3 duration-300"
        style={{ marginTop: "var(--safe-top)" }}
      >
        <WifiOff className="h-3.5 w-3.5 shrink-0 animate-pulse text-amber-100" />
        <span>Chế độ ngoại tuyến (Offline) — Đang xem dữ liệu lưu tạm</span>
      </aside>
    );
  }

  if (showReconnected) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed top-2 left-1/2 -translate-x-1/2 z-[75] px-3.5 py-1.5 rounded-full bg-emerald-600/95 text-white shadow-lg backdrop-blur-md flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-3 duration-300"
        style={{ marginTop: "var(--safe-top)" }}
      >
        <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-200" />
        <span>Đã khôi phục kết nối Internet</span>
      </aside>
    );
  }

  return null;
}
