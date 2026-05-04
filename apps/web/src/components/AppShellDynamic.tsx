"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";

const AppShellInner = dynamic(
  () => import("./AppShell").then((m) => m.AppShell),
  { ssr: false }
);

export function AppShellDynamic({ children }: { children: ReactNode }) {
  return <AppShellInner>{children}</AppShellInner>;
}
