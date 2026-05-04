"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, StickyNote, Search, Settings } from "lucide-react";
import { SearchModal } from "@/components/search/SearchModal";
import { useActiveTab } from "@/contexts/ActiveTabContext";

const tabs = [
  { label: "Thư viện", icon: BookOpen, href: "/library" },
  { label: "Ghi chú",  icon: StickyNote, href: "/notes" },
  { label: "Tìm kiếm", icon: Search,    href: null },
  { label: "Cài đặt",  icon: Settings,  href: "/settings" },
] as const;

const hrefToPanel: Record<string, string> = {
  "/library": "library",
  "/notes": "notes",
  "/settings": "settings",
};

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { setActivePanel } = useActiveTab();
  const [searchOpen, setSearchOpen] = useState(false);

  // Prefetch all navigable routes on first render so they're warm on tap
  const prefetch = useCallback((href: string) => {
    router.prefetch(href);
  }, [router]);

  if (pathname.startsWith("/reader/")) return null;

  function isActive(href: string | null) {
    if (!href) return searchOpen;
    if (searchOpen) return false;
    if (href === "/library") return pathname === "/library" || pathname.startsWith("/library/");
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-[55] md:hidden border-t bg-card/90 backdrop-blur-sm"
        style={{ paddingBottom: "var(--safe-bottom)" }}
        aria-label="Navigation chính"
      >
        <div className="flex h-14 items-stretch">
          {tabs.map(({ label, icon: Icon, href }) => {
            const active = isActive(href);
            return (
              <button
                key={label}
                onMouseEnter={() => href && prefetch(href)}
                onTouchStart={() => href && prefetch(href)}
                onClick={() => {
                  if (href) {
                    setSearchOpen(false);
                    const panel = hrefToPanel[href];
                    if (panel) {
                      setActivePanel(panel);
                      window.history.pushState(null, "", href);
                    } else {
                      router.push(href);
                    }
                  } else {
                    setSearchOpen(true);
                  }
                }}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={label}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-2"}`} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
