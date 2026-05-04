"use client";

import dynamic from "next/dynamic";

export const BottomNavDynamic = dynamic(
  () => import("./BottomNav").then((m) => m.BottomNav),
  { ssr: false }
);
