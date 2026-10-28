"use client";
// Store duy nhất cho drawer điều hướng mobile — thay cho 6 instance drawer riêng ở từng trang.
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export const navDrawer = {
  get: () => open,
  set(v: boolean) {
    if (v === open) return;
    open = v;
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

export const openNavDrawer = () => navDrawer.set(true);
export const closeNavDrawer = () => navDrawer.set(false);
export const toggleNavDrawer = () => navDrawer.set(!open);

export function useNavDrawerOpen() {
  return useSyncExternalStore(navDrawer.subscribe, navDrawer.get, () => false);
}
