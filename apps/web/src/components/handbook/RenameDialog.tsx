"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

interface RenameDialogProps {
  open: boolean;
  title: string;
  label: string;
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function RenameDialog({ open, title, label, initialValue, onConfirm, onCancel }: RenameDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      // Focus after render
      setTimeout(() => inputRef.current?.select(), 10);
    }
  }, [open, initialValue]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleConfirm(); }
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-[101] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card shadow-2xl">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="px-4 py-4">
          <label className="mb-1.5 block text-xs text-muted-foreground">{label}</label>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" /> Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={!value.trim() || value.trim() === initialValue}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" /> Xác nhận
          </button>
        </div>
      </div>
    </>
  );
}

/** Hook để dùng RenameDialog dễ hơn */
export function useRenameDialog() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    label: string;
    initialValue: string;
    resolve: ((v: string | null) => void) | null;
  }>({ open: false, title: "", label: "", initialValue: "", resolve: null });

  const prompt = (title: string, label: string, initialValue: string): Promise<string | null> =>
    new Promise((resolve) => {
      setState({ open: true, title, label, initialValue, resolve });
    });

  const handleConfirm = (value: string) => {
    state.resolve?.(value);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const handleCancel = () => {
    state.resolve?.(null);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const dialog = (
    <RenameDialog
      open={state.open}
      title={state.title}
      label={state.label}
      initialValue={state.initialValue}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { prompt, dialog };
}
