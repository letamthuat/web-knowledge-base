"use client";

import { useEffect, useState, useRef } from "react";
import { usePwa } from "@/contexts/PwaContext";
import { WifiOff, Wifi } from "lucide-react";

export function OnlineOfflineStatus() {
  const { isOnline } = usePwa();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowReconnected(false);
    } else if (wasOffline.current) {
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
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[75] px-4 py-1.5 rounded-full bg-card/90 text-foreground border border-amber-500/40 shadow-[0_8px_25px_rgba(0,0,0,0.1)] backdrop-blur-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-3 duration-300"
        style={{ marginTop: "var(--safe-top)" }}
      >
        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[12px] text-foreground/90 font-medium">
          Chế độ đọc ngoại tuyến (Offline)
        </span>
      </aside>
    );
  }

  if (showReconnected) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[75] px-4 py-1.5 rounded-full bg-card/90 text-foreground border border-emerald-500/40 shadow-[0_8px_25px_rgba(0,0,0,0.1)] backdrop-blur-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-3 duration-300"
        style={{ marginTop: "var(--safe-top)" }}
      >
        <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-[12px] text-foreground/90 font-medium">
          Đã khôi phục kết nối Internet
        </span>
      </aside>
    );
  }

  return null;
}
