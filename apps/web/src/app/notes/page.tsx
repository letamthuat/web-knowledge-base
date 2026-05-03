"use client";

import dynamic from "next/dynamic";

const NotesPageInner = dynamic(
  () => import("@/components/notes/NotesPageInner").then((m) => m.NotesPageInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  }
);

export default function NotesPage() {
  return <NotesPageInner />;
}
