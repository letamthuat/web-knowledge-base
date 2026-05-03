"use client";

import { useEffect, useState } from "react";
import { X, Share, Plus } from "lucide-react";

const DISMISSED_KEY = "pwa-install-dismissed";

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;

    if (isIOS && !isStandalone) {
      setShowIOSHint(true);
      setVisible(true);
      return;
    }

    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    try {
      (deferredPrompt as any).prompt();
      const { outcome } = await (deferredPrompt as any).userChoice;
      if (outcome === "accepted") dismiss();
      else setVisible(false); // declined — hide banner, don't persist dismissed
    } catch {
      setDeferredPrompt(null);
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-[72px] left-0 right-0 z-[45] mx-4 md:hidden">
      <div className="rounded-xl bg-card border shadow-lg px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Cài ứng dụng</p>
          {showIOSHint ? (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
              Nhấn
              <Share className="h-3.5 w-3.5 inline shrink-0" />
              rồi chọn <strong>"Thêm vào màn hình chính"</strong>
              <Plus className="h-3.5 w-3.5 inline shrink-0" />
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Thêm vào màn hình chính để dùng như ứng dụng
            </p>
          )}
        </div>
        {!showIOSHint && deferredPrompt && (
          <button
            onClick={install}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Cài đặt
          </button>
        )}
        <button
          onClick={dismiss}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
