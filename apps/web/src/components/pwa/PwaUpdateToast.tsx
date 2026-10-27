"use client";

import { usePwa } from "@/contexts/PwaContext";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { useState } from "react";

export function PwaUpdateToast() {
  const { updateAvailable, updateApp } = usePwa();
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      role="alert"
      className="fixed z-[75] bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 rounded-[26px] border border-border/80 bg-card/95 p-4 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_-8px_rgba(0,0,0,0.45)] backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-5 duration-300"
      style={{ marginBottom: "var(--safe-bottom)" }}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/80 text-primary border border-border/40 shadow-xs">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[13.5px] font-semibold tracking-tight text-foreground">
            Bản cập nhật mới sẵn sàng
          </h4>
          <p className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">
            Phiên bản ứng dụng mới đã tải về. Làm mới để áp dụng các cải tiến giao diện và sửa lỗi.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                setUpdating(true);
                updateApp();
              }}
              disabled={updating}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 active:scale-95 transition-all disabled:opacity-70"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${updating ? "animate-spin" : ""}`} />
              {updating ? "Đang làm mới..." : "Cập nhật ngay"}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Để sau
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Đóng thông báo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
