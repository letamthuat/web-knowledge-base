"use client";

import { AlertTriangle, X, Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, description, confirmLabel = "Xác nhận", danger = false,
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 z-[101] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card shadow-2xl">
        <div className="border-b px-4 py-3 flex items-center gap-2">
          {danger && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" /> Hủy
          </button>
          <button
            onClick={onConfirm}
            className={[
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs",
              danger
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            ].join(" ")}
          >
            {danger && <Trash2 className="h-3.5 w-3.5" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

export function useConfirmDialog() {
  const [state, setState] = import("react").then(() => null) as any;
  // implemented inline in HandbookSidebar using useState directly
  return null;
}
