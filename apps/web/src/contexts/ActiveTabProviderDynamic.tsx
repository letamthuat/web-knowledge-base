"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";

const ActiveTabProviderInner = dynamic(
  () => import("./ActiveTabContext").then((m) => m.ActiveTabProvider),
  { ssr: false }
);

export function ActiveTabProviderDynamic({ children }: { children: ReactNode }) {
  return <ActiveTabProviderInner>{children}</ActiveTabProviderInner>;
}
