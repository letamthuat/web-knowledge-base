"use client";

import dynamic from "next/dynamic";

const TrashPageInner = dynamic(
  () => import("@/components/library/TrashPageInner").then((m) => m.TrashPageInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

export default function TrashPage() {
  return <TrashPageInner />;
}
