"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/../../../convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { TrashView } from "@/components/library/TrashView";
import { labels } from "@/lib/i18n/labels";

const L = labels.trash;

export function TrashPageInner() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const trashedDocs = useQuery(api.documents.queries.listTrashed);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Đang tải" />
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" aria-hidden />
          </div>
          <span className="font-semibold">Web Knowledge Base</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/library")} aria-label="Quay lại thư viện">
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
            {L.backToLibrary}
          </Button>
          <h1 className="text-2xl font-bold">{L.title}</h1>
        </div>

        <TrashView docs={trashedDocs} />
      </main>
    </div>
  );
}
