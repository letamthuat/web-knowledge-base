"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Id } from "@/_generated/dataModel";

interface DocNotePopoverProps {
  /** If set, we're editing an existing note */
  noteId?: Id<"notes">;
  initialBody: string;
  initialTitle?: string;
  onSave: (body: string, title?: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function DocNotePopover({ noteId, initialBody, initialTitle, onSave, onDelete, onClose }: DocNotePopoverProps) {
  const [body, setBody] = useState(initialBody);
  const [title, setTitle] = useState(initialTitle ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedBodyRef = useRef(initialBody);
  const savedTitleRef = useRef(initialTitle ?? "");

  useEffect(() => { textareaRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { flush(); onClose(); }
    }
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        flush(); onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
    };
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  function flush() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (body !== savedBodyRef.current || title !== savedTitleRef.current) {
      savedBodyRef.current = body;
      savedTitleRef.current = title;
      if (body.trim()) onSave(body, title.trim() || undefined);
    }
  }

  function handleChange(val: string) {
    setBody(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      savedBodyRef.current = val;
      if (val.trim()) onSave(val, title.trim() || undefined);
    }, 1000);
  }

  function handleTitleChange(val: string) {
    setTitle(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      savedTitleRef.current = val;
      if (body.trim()) onSave(body, val.trim() || undefined);
    }, 1000);
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20"
      onPointerDown={(e) => { if (e.target === e.currentTarget) { flush(); onClose(); } }}
    >
      <div className="flex w-[360px] flex-col gap-2 rounded-xl border bg-white p-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            {noteId ? "Sửa ghi chú" : "Ghi chú mới"}
          </span>
          <button
            onClick={() => { flush(); onClose(); }}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Title (optional) */}
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Tiêu đề (tuỳ chọn)"
          className="rounded-lg border bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />

        {/* Body */}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Gõ ghi chú..."
          rows={6}
          maxLength={2000}
          className="w-full resize-none rounded-lg border bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-400">Tự động lưu · Esc để đóng</p>
          <div className="flex items-center gap-2">
            {noteId && onDelete && (
              <button
                onClick={() => { onDelete(); onClose(); }}
                className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-50"
              >
                Xoá
              </button>
            )}
            <button
              onClick={() => { flush(); onClose(); }}
              className="rounded bg-primary px-3 py-1 text-xs text-white hover:bg-primary/90"
            >
              Xong
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
