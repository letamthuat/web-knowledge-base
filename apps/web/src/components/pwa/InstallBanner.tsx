"use client";

import { usePwa } from "@/contexts/PwaContext";
import { AppLogo } from "@/components/AppLogo";
import {
  Download,
  X,
  Share,
  PlusSquare,
  BookOpen,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Compass,
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
          {/* Apple Books & Craft Style Island */}
          <div className="relative overflow-hidden rounded-[26px] border border-border/70 bg-card/90 p-4 sm:p-5 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_-8px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-all">
            {/* Soft Warm Paper Glow Accent */}
            <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/8 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-amber-500/5 blur-2xl" />

            <div className="flex items-start gap-3.5 relative z-10">
              <div className="relative shrink-0 pt-0.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 p-1.5 shadow-sm border border-border/40">
                  <AppLogo size={36} />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
                    Web Knowledge Base
                  </h3>
                  <span className="rounded-full bg-secondary/80 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground border border-border/40">
                    Ứng dụng
                  </span>
                </div>

                <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
                  Cài đặt để đọc tài liệu toàn màn hình, mở trang tức thì và lưu trữ ngoại tuyến như một cuốn sách thực thụ.
                </p>

                {/* Craft-style minimal feature chips */}
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground font-medium">
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2.5 py-0.5 text-foreground/80 border border-border/30">
                    <BookOpen className="h-3 w-3 text-primary/80" /> Đọc không phân tâm
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2.5 py-0.5 text-foreground/80 border border-border/30">
                    <Compass className="h-3 w-3 text-primary/80" /> Truy cập ngoại tuyến
                  </span>
                </div>

                {/* Action buttons */}
                <div className="mt-3.5 flex items-center gap-2 pt-0.5">
                  <button
                    onClick={handleInstallClick}
                    disabled={installing}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-70"
                  >
                    {isIOS ? (
                      <>
                        <span>Xem cách cài đặt</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        <span>{installing ? "Đang xử lý..." : "Cài ứng dụng"}</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => dismissBanner(7)}
                    className="rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                  >
                    Để sau
                  </button>
                </div>
              </div>

              <button
                onClick={() => dismissBanner(7)}
                className="shrink-0 rounded-full p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
                title="Đóng"
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

// ─── Modal hướng dẫn Apple Safari (Apple Style Sheet) ──────────────────────────

function IOSInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md rounded-[32px] border border-border/80 bg-card p-6 shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200"
        style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted/60 p-1 border border-border/40">
              <AppLogo size={24} />
            </div>
            <div>
              <h3 id="ios-install-title" className="font-semibold text-sm text-foreground">
                Thêm vào màn hình chính
              </h3>
              <p className="text-[11px] text-muted-foreground">Dành cho iPhone & iPad</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3.5 text-[12px] text-muted-foreground leading-relaxed">
          Trải nghiệm đọc mượt mà như ứng dụng Apple Books bản địa với 3 thao tác đơn giản trong trình duyệt Safari:
        </p>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-start gap-3 rounded-2xl bg-muted/35 p-3.5 border border-border/30">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
              1
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                Nhấn vào nút Chia sẻ
                <span className="inline-flex items-center justify-center rounded-lg bg-background px-1.5 py-0.5 border border-border/50 text-primary shadow-xs">
                  <Share className="h-3.5 w-3.5" />
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Nằm ở thanh công cụ dưới đáy màn hình Safari.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-muted/35 p-3.5 border border-border/30">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
              2
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                Chọn &quot;Thêm vào MH chính&quot;
                <span className="inline-flex items-center justify-center rounded-lg bg-background px-1.5 py-0.5 border border-border/50 text-foreground shadow-xs">
                  <PlusSquare className="h-3.5 w-3.5" />
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cuộn nhẹ danh sách menu và chọn &quot;Add to Home Screen&quot;.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-muted/35 p-3.5 border border-border/30">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
              3
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">
                Xác nhận &quot;Thêm&quot;
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Nhấn nút &quot;Thêm&quot; ở góc trên bên phải màn hình.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.99] transition-all"
        >
          Đã hiểu, đóng hướng dẫn
        </button>
      </div>
    </div>
  );
}
