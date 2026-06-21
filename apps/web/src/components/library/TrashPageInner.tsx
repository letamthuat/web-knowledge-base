"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Menu, X, BookOpen, ChevronRight, StickyNote, Settings, Search } from "lucide-react";
import { useTrashedDocuments } from "@/lib/api/documents";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { TrashView } from "@/components/library/TrashView";
import { HandbookSidebarContent } from "@/components/handbook/HandbookSidebar";
import { SearchModal } from "@/components/search/SearchModal";
import { labels } from "@/lib/i18n/labels";
import { AppLogo } from "@/components/AppLogo";

const L = labels.trash;
const N = labels.nav;

export function TrashPageInner() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const trashedDocs = useTrashedDocuments();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [libraryTreeOpen, setLibraryTreeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
      <header className="border-b bg-card sticky top-0 z-10" style={{ paddingTop: 'var(--safe-top)' }}>
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
            <AppLogo size={32} />
            <span className="font-semibold text-foreground">Thùng rác</span>
          </div>
        </div>
      </header>

      {/* Mobile sidebar drawer overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-30 xl:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-72 bg-background border-r shadow-xl overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-sm">Điều hướng</span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded p-1.5 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Mobile nav links */}
            <div className="flex flex-col gap-1 mb-4 border-b pb-4">
              <div className="flex flex-col">
                <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
                  <button
                    onClick={() => { setMobileSidebarOpen(false); router.push("/library"); }}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <BookOpen className="h-4 w-4" /> {N.library}
                  </button>
                  <button
                    onClick={() => setLibraryTreeOpen(!libraryTreeOpen)}
                    className="rounded p-1 hover:bg-muted-foreground/10 transition-colors"
                  >
                    <ChevronRight className={`h-4 w-4 transition-transform ${libraryTreeOpen ? "rotate-90" : ""}`} />
                  </button>
                </div>
                {libraryTreeOpen && (
                  <div className="ml-4 border-l pl-2 max-h-[60dvh] overflow-y-auto mt-1">
                    <HandbookSidebarContent onLinkClick={() => setMobileSidebarOpen(false)} />
                  </div>
                )}
              </div>
              <button
                onClick={() => { setMobileSidebarOpen(false); router.push("/notes"); }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <StickyNote className="h-4 w-4" /> {N.notes}
              </button>
              <button
                onClick={() => { setMobileSidebarOpen(false); setSearchOpen(true); }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <Search className="h-4 w-4" /> Tìm kiếm
              </button>
              <button
                onClick={() => { setMobileSidebarOpen(false); router.push("/settings"); }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <Settings className="h-4 w-4" /> {N.settings}
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 py-4 sm:py-8">
        <TrashView docs={trashedDocs} />
      </main>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
