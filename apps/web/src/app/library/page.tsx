"use client";

import dynamic from "next/dynamic";

function LibrarySkeleton() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 h-[52px] animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="h-4 w-36 rounded bg-muted hidden md:block" />
        </div>
        <div className="hidden md:flex items-center gap-2">
          <div className="h-7 w-16 rounded bg-muted" />
          <div className="h-7 w-16 rounded bg-muted" />
          <div className="h-7 w-24 rounded bg-muted" />
        </div>
      </div>
      <div className="h-10 shrink-0 border-b bg-card" />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 shrink-0 border-r bg-card hidden md:block" />
        <div className="flex-1 p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const LibraryPageInner = dynamic(
  () => import("@/components/library/LibraryPageInner").then((m) => m.LibraryPageInner),
  { ssr: false, loading: () => <LibrarySkeleton /> }
);

export default function LibraryPage() {
  return <LibraryPageInner />;
}
