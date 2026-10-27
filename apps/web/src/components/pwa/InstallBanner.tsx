"use client";

import { usePwa } from "@/contexts/PwaContext";
import { AppLogo } from "@/components/AppLogo";
import {
  Download,
  X,
  Share,
  PlusSquare,
  Sparkles,
  Zap,
  BookOpen,
  ArrowRight,
  MonitorSmartphone,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

export function InstallBanner() {
  const {
    isStandalone,
    bannerVisible,
    isInstallable,
    isIOS,
    showIOSGuide,
    promptInstall,
    openIOSGuide,
    closeIOSGuide,
    dismissBanner,
  } = usePwa();

  const [installing, setInstalling] = useState(false);

  // If already standalone (installed and opened as app), or banner dismissed, don't show
  if (isStandalone || (!bannerVisible && !showIOSGuide)) {
    return showIOSGuide ? <IOSInstallModal onClose={closeIOSGuide} /> : null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      openIOSGuide();
      return;
    }
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <>
      {bannerVisible && (
        <aside
          role="region"
          aria-label="Cài đặt ứng dụng"
          className="fixed left-3 right-3 bottom-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[55] animate-in fade-in slide-in-from-bottom-6 duration-300"
          style={{ marginBottom: "var(--safe-bottom)" }}
        >
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:p-5 dark:border-border/60">
            {/* Top decorative accent glow */}
            <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />

            <div className="flex items-start gap-3.5">
              <div className="relative shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-1.5 shadow-inner border border-primary/20">
                  <AppLogo size={36} />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow">
                  <Sparkles className="h-2.5 w-2.5" />
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm font-bold tracking-tight text-foreground">
                    Cài đặt Web Knowledge Base
                  </h3>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    PWA App
                  </span>
                </div>

                <p className="mt-1 text-xs text-muted-foreground leading-snug">
                  Trải nghiệm mượt mà như app bản địa, đọc tài liệu ngoại tuyến và mở nhanh không cần trình duyệt.
                </p>

                {/* Benefits tags */}
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium text-foreground">
                    <Zap className="h-3 w-3 text-amber-500" /> Nhanh hơn
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium text-foreground">
                    <BookOpen className="h-3 w-3 text-sky-500" /> Đọc Offline
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium text-foreground">
                    <MonitorSmartphone className="h-3 w-3 text-emerald-500" /> Toàn màn hình
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-3.5 flex items-center gap-2">
                  <button
                    onClick={handleInstallClick}
                    disabled={installing}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/95 active:scale-[0.98] transition-all disabled:opacity-70"
                  >
                    {isIOS ? (
                      <>
                        <span>Xem cách thêm vào MH</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        <span>{installing ? "Đang xử lý..." : "Cài đặt ngay"}</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => dismissBanner(7)}
                    className="rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    Để sau
                  </button>
                </div>
              </div>

              <button
                onClick={() => dismissBanner(7)}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
                title="Đóng (sẽ nhắc lại sau 7 ngày)"
                aria-label="Đóng banner cài đặt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {showIOSGuide && <IOSInstallModal onClose={closeIOSGuide} />}
    </>
  );
}

// ─── Modal hướng dẫn cài đặt trên iOS (Safari) ──────────────────────────────

function IOSInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200"
        style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <AppLogo size={28} />
            <h3 id="ios-install-title" className="font-bold text-base text-foreground">
              Cài đặt trên iPhone / iPad
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Đóng modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          Apple iOS yêu cầu thêm ứng dụng PWA thủ công thông qua trình duyệt <strong>Safari</strong> bằng 3 bước đơn giản:
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3 border border-border/40">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm">
              1
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                Nhấn vào nút Chia sẻ
                <span className="inline-flex items-center justify-center rounded-md bg-background px-1.5 py-0.5 border text-primary">
                  <Share className="h-3.5 w-3.5" />
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Nằm ở thanh công cụ phía dưới cùng của Safari (hoặc trên cùng với iPad).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3 border border-border/40">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm">
              2
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                Chọn &quot;Thêm vào MH chính&quot;
                <span className="inline-flex items-center justify-center rounded-md bg-background px-1.5 py-0.5 border text-foreground">
                  <PlusSquare className="h-3.5 w-3.5" />
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cuộn danh sách menu hành động xuống và chọn &quot;Add to Home Screen&quot;.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3 border border-border/40">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm">
              3
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">
                Xác nhận &quot;Thêm&quot; (Add)
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Nhấn nút &quot;Thêm&quot; ở góc trên bên phải màn hình để hoàn tất.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/95 transition-all"
        >
          Đã hiểu, đóng hướng dẫn
        </button>
      </div>
    </div>
  );
}
