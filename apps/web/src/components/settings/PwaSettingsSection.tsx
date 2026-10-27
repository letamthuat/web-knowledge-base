"use client";

import { useState } from "react";
import { usePwa } from "@/contexts/PwaContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BookOpen,
  Download,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
  Compass,
  HardDriveDownload,
} from "lucide-react";

export function PwaSettingsSection() {
  const {
    isStandalone,
    isInstallable,
    isIOS,
    isOnline,
    promptInstall,
    openIOSGuide,
    clearCacheAndReload,
  } = usePwa();

  const [installing, setInstalling] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleInstall = async () => {
    if (isIOS) {
      openIOSGuide();
      return;
    }
    setInstalling(true);
    try {
      const accepted = await promptInstall();
      if (accepted) {
        toast.success("Đã cài đặt ứng dụng thành công!");
      }
    } catch {
      toast.error("Không thể kích hoạt cài đặt lúc này");
    } finally {
      setInstalling(false);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    toast.loading("Đang làm mới bộ nhớ đệm và service worker...", { id: "pwa-cache" });
    try {
      await clearCacheAndReload();
    } catch {
      toast.error("Lỗi khi làm mới bộ nhớ đệm", { id: "pwa-cache" });
      setClearing(false);
    }
  };

  return (
    <div className="mb-6 rounded-[24px] border border-border/80 bg-card p-6 space-y-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2.5 text-base text-foreground">
          <BookOpen className="h-4.5 w-4.5 text-primary" />
          Ứng dụng & Trải nghiệm Đọc PWA
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium border ${
            isOnline
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="h-3 w-3" /> Trực tuyến
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" /> Ngoại tuyến
            </>
          )}
        </span>
      </div>

      {/* Installation State Box */}
      <div className="rounded-[20px] border border-border/60 bg-secondary/35 p-4 sm:p-5">
        {isStandalone ? (
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-foreground">
                Đang chạy chế độ Độc lập (PWA Standalone)
              </p>
              <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                Ứng dụng đang hoạt động toàn màn hình không có thanh URL trình duyệt, tối ưu hoàn hảo cho việc đọc và ghi chú chuyên sâu.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Compass className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-foreground">
                  Cài đặt ứng dụng về thiết bị
                </p>
                <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                  Đưa Web Knowledge Base ra màn hình chính để mở nhanh, đọc tài liệu mượt mà như Apple Books ngay cả khi ngắt kết nối mạng.
                </p>
              </div>
            </div>

            <button
              onClick={handleInstall}
              disabled={installing}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isIOS ? "Hướng dẫn trên iOS" : installing ? "Đang xử lý..." : "Cài đặt ngay"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Offline Storage & Service Worker Cache */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
              <HardDriveDownload className="h-3.5 w-3.5 text-muted-foreground" />
              Bộ nhớ đệm giao diện (PWA Shell Cache)
            </h3>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
              Lưu trữ bản sao giao diện và phông chữ trong máy để tăng tốc khởi chạy tức thì.
            </p>
          </div>
          <button
            onClick={handleClearCache}
            disabled={clearing}
            className="shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary active:scale-[0.98] transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${clearing ? "animate-spin" : ""}`} />
            <span>{clearing ? "Đang làm mới..." : "Làm mới bộ nhớ đệm"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
