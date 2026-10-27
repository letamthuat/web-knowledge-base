"use client";

import { useState } from "react";
import { usePwa } from "@/contexts/PwaContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  MonitorSmartphone,
  Download,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
  Sparkles,
  HelpCircle,
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
    <div className="mb-6 rounded-2xl border bg-card p-6 space-y-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2 text-base text-foreground">
          <MonitorSmartphone className="h-5 w-5 text-primary" />
          Ứng dụng & Trải nghiệm PWA
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isOnline
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
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
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        {isStandalone ? (
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Ứng dụng đang chạy ở chế độ Độc lập (Standalone)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Bạn đã cài đặt Web Knowledge Base lên thiết bị. Toàn bộ thanh công cụ duyệt web đã được ẩn để tối ưu không gian đọc và học tập.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Download className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Cài đặt ứng dụng lên thiết bị
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Cài đặt PWA để mở nhanh từ màn hình chính hoặc Desktop, tối ưu hiển thị tài liệu và đọc ngoại tuyến không cần mở trình duyệt.
                </p>
              </div>
            </div>

            <Button
              onClick={handleInstall}
              disabled={installing}
              className="shrink-0 gap-2 shadow-sm rounded-xl"
            >
              <Download className="h-4 w-4" />
              {isIOS ? "Hướng dẫn trên iOS" : installing ? "Đang xử lý..." : "Cài đặt ngay"}
            </Button>
          </div>
        )}
      </div>

      {/* Offline Storage & Service Worker Cache */}
      <div className="space-y-3 pt-1 border-t border-border/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <HardDriveDownload className="h-4 w-4 text-muted-foreground" />
              Bộ nhớ tạm ngoại tuyến (PWA Shell Cache)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Các trang giao diện, font chữ và tài nguyên tĩnh được lưu trong bộ nhớ máy để mở tức thì. Nếu bạn gặp lỗi hiển thị hoặc muốn tải lại bản mới nhất từ máy chủ:
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            disabled={clearing}
            className="shrink-0 gap-1.5 rounded-xl text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${clearing ? "animate-spin" : ""}`} />
            {clearing ? "Đang xoá..." : "Làm mới bộ nhớ đệm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
