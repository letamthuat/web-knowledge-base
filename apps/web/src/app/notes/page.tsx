"use client";

import dynamic from "next/dynamic";

function NotesSkeleton() {
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
      <div className="h-9 shrink-0 border-b bg-card" />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 shrink-0 border-r bg-card hidden md:block animate-pulse">
          <div className="p-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-muted" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    </div>
  );
}

const NotesPageInner = dynamic(
  () => import("@/components/notes/NotesPageInner").then((m) => m.NotesPageInner),
  { ssr: false, loading: () => <NotesSkeleton /> }
);

export default function NotesPage() {
  return <NotesPageInner />;
}
