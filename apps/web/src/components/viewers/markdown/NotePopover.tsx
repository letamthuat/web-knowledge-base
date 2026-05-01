"use client";

import { useEffect, useRef, useState } from "react";

interface NotePopoverProps {
  x: number;
  y: number;
  initialNote: string;
  onSave: (note: string) => void;
  onClose: () => void;
}

export function NotePopover({ x, y, initialNote, onSave, onClose }: NotePopoverProps) {
  const [text, setText] = useState(initialNote);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef(initialNote);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        flush();
        onClose();
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        flush();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  function flush() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text !== savedRef.current) {
      savedRef.current = text;
      onSave(text);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      savedRef.current = val;
      onSave(val);
    }, 1000);
  }

  // Keep popover in viewport
  const popW = 240;
  const popH = 140;
  const left = Math.min(x, window.innerWidth - popW - 8);
  const top = y + 8 > window.innerHeight - popH - 8 ? y - popH - 8 : y + 8;

  return (
    <div
      ref={containerRef}
      style={{ position: "fixed", left, top, width: popW, zIndex: 9999 }}
      className="flex flex-col gap-1.5 rounded-xl border bg-white p-2.5 shadow-xl"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Ghi chú</span>
        <span className="text-xs text-gray-400">{text.length}/500</span>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        maxLength={500}
        rows={4}
        placeholder="Gõ ghi chú..."
        className="w-full resize-none rounded-lg border bg-gray-50 px-2.5 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      <p className="text-[10px] text-gray-400">Tự động lưu · Esc để đóng</p>
    </div>
  );
}
