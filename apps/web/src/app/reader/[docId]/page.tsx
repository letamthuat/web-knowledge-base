"use client";

import dynamic from "next/dynamic";

function ReaderSkeleton() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 h-12 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted hidden md:block" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-20 rounded bg-muted" />
          <div className="h-6 w-6 rounded bg-muted" />
        </div>
      </div>
      {/* Tab bar */}
      <div className="h-10 shrink-0 border-b bg-card" />
      {/* Content */}
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    </div>
  );
}

const ReaderPageInner = dynamic(() => import("./ReaderPageInner"), {
  ssr: false,
  loading: () => <ReaderSkeleton />,
});

export default function ReaderPage() {
  return <ReaderPageInner />;
}
