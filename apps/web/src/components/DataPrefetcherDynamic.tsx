"use client";

import dynamic from "next/dynamic";

export const DataPrefetcherDynamic = dynamic(
  () => import("./DataPrefetcher").then((m) => m.DataPrefetcher),
  { ssr: false }
);
