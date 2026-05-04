"use client";

import { useState, memo } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, StickyNote, Search, Settings } from "lucide-react";
import { SearchModal } from "@/components/search/SearchModal";
import { useActiveTab } from "@/contexts/ActiveTabContext";

const NAV_TABS = [
  { label: "Thư viện", icon: BookOpen,   href: "/library",  panel: "library" },
  { label: "Ghi chú",  icon: StickyNote, href: "/notes",    panel: "notes" },
  { label: "Tìm kiếm", icon: Search,     href: null,        panel: null },
  { label: "Cài đặt",  icon: Settings,   href: "/settings", panel: "settings" },
] as const;

export const BottomNav = memo(function BottomNav() {
  const pathname = usePathname();
  const { activePanel, setActivePanel } = useActiveTab();
  const [searchOpen, setSearchOpen] = useState(false);

  if (pathname.startsWith("/reader/")) return null;

  const currentPanel = activePanel ?? pathname.replace(/^\//, "").split("/")[0];

  function isActive(panel: string | null, href: string | null) {
    if (!panel) return searchOpen;
    if (searchOpen) return false;
    return currentPanel === panel || (href !== null && (pathname === href || pathname.startsWith(href + "/")));
  }

  function handleNav(href: string | null, panel: string | null) {
    if (!href || !panel) { setSearchOpen(true); return; }
    setSearchOpen(false);
    setActivePanel(panel);
    window.history.pushState(null, "", href);
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-[55] md:hidden border-t bg-card/90 backdrop-blur-sm"
        style={{ paddingBottom: "var(--safe-bottom)" }}
        aria-label="Navigation chính"
      >
        <div className="flex h-14 items-stretch">
          {NAV_TABS.map(({ label, icon: Icon, href, panel }) => {
            const active = isActive(panel, href);
            return (
              <button
                key={label}
                onClick={() => handleNav(href, panel)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
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
});
