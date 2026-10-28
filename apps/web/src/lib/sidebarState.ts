"use client";
// Nhớ trạng thái bung/thu của sidebar (localStorage). Mặc định vẫn THU (user chốt) —
// chỉ mục nào user đã chủ động bung mới được nhớ là mở.
import { useCallback, useSyncExternalStore } from "react";

const KEY = "sb-open-v1";
let state: Record<string, boolean> | null = null;
const listeners = new Set<() => void>();

function load(): Record<string, boolean> {
  if (state) return state;
  try { state = JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {}; } catch { state = {}; }
  return state!;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export function setSidebarOpenKeys(patch: Record<string, boolean>) {
  state = { ...load(), ...patch };
  save();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** [open, setOpen] được nhớ theo `key` (vd "lib", "dom:<id>", "hb:<id>"). */
export function usePersistedOpen(key: string, fallback = false): [boolean, (v: boolean | ((p: boolean) => boolean)) => void] {
  const open = useSyncExternalStore(
    subscribe,
    () => load()[key] ?? fallback,
    () => fallback
  );
  const setOpen = useCallback((v: boolean | ((p: boolean) => boolean)) => {
    const cur = load()[key] ?? fallback;
    setSidebarOpenKeys({ [key]: typeof v === "function" ? v(cur) : v });
  }, [key, fallback]);
  return [open, setOpen];
}
