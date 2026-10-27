"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppLogo } from "@/components/AppLogo";
import { WifiOff, RefreshCw, BookOpen, NotebookPen, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function OfflinePage() {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [reconnected, setReconnected] = useState(false);

  const checkConnection = useCallback(async () => {
    setRetrying(true);
    try {
      // Ping keep-alive endpoint with cache bust
      const res = await fetch(`/api/keep-alive?t=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
      });
      if (res.ok) {
        setReconnected(true);
        setTimeout(() => {
          window.location.reload();
        }, 800);
        return;
      }
    } catch {
      // Still offline
    } finally {
      setTimeout(() => setRetrying(false), 500);
    }
  }, []);

  // Auto-detect when network comes back online
  useEffect(() => {
    const handleOnline = () => {
      setReconnected(true);
      setTimeout(() => {
        window.location.reload();
      }, 700);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-center">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-primary/10 blur-[100px]" />
        <div className="h-64 w-64 rounded-full bg-amber-500/10 blur-[80px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-md w-full rounded-3xl border border-border/80 bg-card/90 p-8 shadow-2xl backdrop-blur-xl">
        {/* App Logo */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 p-2 shadow-inner border border-primary/20">
            <AppLogo size={44} />
          </div>
        </div>

        {/* Animated Offline Icon */}
        <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping opacity-40 duration-1000" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 shadow-lg">
            {reconnected ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-500 animate-in zoom-in-75 duration-300" />
            ) : (
              <WifiOff className="h-8 w-8 text-amber-500" />
            )}
          </div>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {reconnected ? "Đã có kết nối Internet!" : "Chế độ Ngoại tuyến (Offline)"}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {reconnected
            ? "Đang tự động tải lại dữ liệu mới nhất cho bạn..."
            : "Thiết bị tạm thời mất kết nối mạng. Bạn vẫn có thể tiếp tục xem và đọc các tài liệu đã được lưu tạm trong bộ nhớ máy."}
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={checkConnection}
            disabled={retrying || reconnected}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/95 active:scale-[0.99] transition-all disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            <span>{reconnected ? "Đang làm mới..." : retrying ? "Đang kiểm tra tín hiệu..." : "Thử kết nối lại"}</span>
          </button>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => router.push("/library")}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>Vào Thư viện</span>
            </button>
            <button
              onClick={() => router.push("/notes")}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <NotebookPen className="h-3.5 w-3.5 text-primary" />
              <span>Xem Ghi chú</span>
            </button>
          </div>
        </div>

        {/* Tip footer */}
        <div className="mt-6 rounded-2xl bg-muted/40 border border-border/40 p-3 text-left">
          <p className="text-[11px] font-semibold text-foreground">💡 Mẹo khi ngoại tuyến:</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
            Các ghi chú mới tạo và nội dung bạn đã mở gần đây sẽ được đồng bộ hoá ngay khi có kết nối trở lại.
          </p>
        </div>
      </div>
    </div>
  );
}
