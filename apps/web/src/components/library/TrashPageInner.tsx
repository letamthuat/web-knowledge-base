"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { useTrashedDocuments } from "@/lib/api/documents";
import { useSession } from "@/lib/auth-client";
import { TrashView } from "@/components/library/TrashView";
import { MobileSidebarDrawer } from "@/components/nav/MobileSidebarDrawer";
import { AppLogo } from "@/components/AppLogo";

export function TrashPageInner() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const trashedDocs = useTrashedDocuments();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Đang tải" />
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="min-h-dvh bg-background">
      {/* Header chỉ còn cho mobile — desktop mọi điều hướng đã nằm trong sidebar (user chốt 16/07) */}
      <header className="border-b bg-card sticky top-0 z-10 xl:hidden" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* Mobile: hamburger button to open menu */}
            <button
              onClick={() => setMobileSidebarOpen(v => !v)}
              className="mr-1 rounded p-1.5 hover:bg-muted transition-colors xl:hidden"
              aria-label="Mở menu"
            >
              <Menu className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="xl:hidden"><AppLogo size={32} /></span>
            <span className="font-semibold text-foreground">Thùng rác</span>
          </div>
        </div>
      </header>

      {/* Mobile sidebar drawer — đồng bộ với sidebar desktop */}
      <MobileSidebarDrawer open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

      <main className="mx-auto max-w-4xl px-4 py-4 sm:py-8">
        <TrashView docs={trashedDocs} />
      </main>
    </div>
  );
}
