"use client";

import dynamic from "next/dynamic";

const LibraryPageInner = dynamic(
  () => import("@/components/library/LibraryPageInner").then((m) => m.LibraryPageInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

export default function LibraryPage() {
  return <LibraryPageInner />;
}
