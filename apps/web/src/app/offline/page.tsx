"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppLogo } from "@/components/AppLogo";
import { BookOpen, NotebookPen, RefreshCw, CheckCircle2, Feather, Sparkles } from "lucide-react";

export default function OfflinePage() {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [reconnected, setReconnected] = useState(false);

  const checkConnection = useCallback(async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/keep-alive?t=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
      });
      if (res.ok) {
        setReconnected(true);
        setTimeout(() => {
          window.location.reload();
        }, 700);
        return;
      }
    } catch {
      // Still offline
    } finally {
      setTimeout(() => setRetrying(false), 500);
    }
  }, []);

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
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-center selection:bg-primary/20">
      {/* Warm Ambient Craft Glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-primary/5 blur-[120px]" />
        <div className="h-72 w-72 rounded-full bg-amber-500/5 blur-[90px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-md w-full rounded-[32px] border border-border/80 bg-card/95 p-8 sm:p-9 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {/* Logo and Craft Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-secondary/80 p-2 border border-border/50 shadow-xs">
              <AppLogo size={42} />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary border border-background">
              <Feather className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1 text-[11px] font-medium text-muted-foreground border border-border/40 mb-3">
          {reconnected ? "Đã kết nối lại" : "Thư phòng tĩnh"}
        </span>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
          {reconnected ? "Đã có tín hiệu Internet" : "Không gian Đọc Ngoại tuyến"}
        </h1>

        <p className="mt-2.5 text-[13px] text-muted-foreground leading-relaxed">
          {reconnected
            ? "Đang đồng bộ và làm mới trang tài liệu cho bạn..."
            : "Thiết bị tạm ngắt mạng. Đây là không gian yên tĩnh để bạn tiếp tục đọc các tài liệu và ghi chú đã lưu trong bộ nhớ máy."}
        </p>

        {/* Action Buttons */}
        <div className="mt-7 flex flex-col gap-2.5">
          <button
            onClick={checkConnection}
            disabled={retrying || reconnected}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-xs sm:text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            <span>{reconnected ? "Đang tải lại..." : retrying ? "Đang kiểm tra kết nối..." : "Kiểm tra kết nối lại"}</span>
          </button>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => router.push("/library")}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-secondary/50 px-3 py-2.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>Thư viện đã lưu</span>
            </button>
            <button
              onClick={() => router.push("/notes")}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-secondary/50 px-3 py-2.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <NotebookPen className="h-3.5 w-3.5 text-primary" />
              <span>Mở Ghi chú</span>
            </button>
          </div>
        </div>

        {/* Subtle Reading Tip */}
        <div className="mt-6 rounded-2xl bg-secondary/40 border border-border/30 p-3.5 text-left">
          <p className="text-[11.5px] font-medium text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-500" />
            Trải nghiệm tập trung:
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
            Bạn vẫn có thể gạch chân highlight và viết ghi chép mới. Mọi thay đổi sẽ tự động đồng bộ lên đám mây khi có Internet.
          </p>
        </div>
      </div>
    </div>
  );
}
