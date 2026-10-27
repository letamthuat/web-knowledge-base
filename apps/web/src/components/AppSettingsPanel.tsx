"use client";

import { useState, useEffect, useRef } from "react";
import { Palette, X } from "lucide-react";
import { useReadingModePrefs, useUpdateReadingModePrefs, type ReadingTheme, type FontFamily, type ColumnWidth } from "@/hooks/useReadingModePrefs";
import { BottomSheet } from "@/components/ui/BottomSheet";

// Global singleton state — shared across all pages via module-level store
type Listener = () => void;
const listeners = new Set<Listener>();
let _font: FontFamily = "sans";
let _fontSize = 16;
let _lineHeight = 1.6;
let _colWidth: ColumnWidth = "medium";
let _theme: ReadingTheme = "light";

function notify() { listeners.forEach((l) => l()); }

export function getAppTypography() {
  return {
    fontFamily: _font === "serif" ? "ui-serif, Georgia, serif" : _font === "mono" ? "ui-monospace, monospace" : "ui-sans-serif, system-ui, sans-serif",
    fontSize: _fontSize,
    lineHeight: _lineHeight,
    colWidthClass: _colWidth === "narrow" ? "max-w-xl" : _colWidth === "wide" ? "max-w-full" : "max-w-3xl",
    theme: _theme,
    colorScheme: (_theme === "dark" ? "dark" : "light") as "light" | "dark",
  };
}

export function useAppTypography() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((v) => v + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return getAppTypography();
}

/** Gọi hàm này từ bất kỳ đâu (Sidebar, Menu, Header) để mở bảng cài đặt màu giấy & cỡ chữ */
export function openReadingSettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-reading-settings"));
  }
}

export function AppSettingsPanel() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [, rerender] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);

    // Lắng nghe sự kiện mở từ sidebar hoặc các nút khác
    const openHandler = () => setOpen(true);
    window.addEventListener("open-reading-settings", openHandler);

    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("open-reading-settings", openHandler);
    };
  }, []);

  const prefs = useReadingModePrefs();
  const updatePrefs = useUpdateReadingModePrefs();
  const prefsSynced = useRef(false);

  // Init from localStorage immediately
  useEffect(() => {
    const t = localStorage.getItem("rm-theme");
    if (t === "sepia" || t === "dark" || t === "light") { _theme = t; }
    const f = localStorage.getItem("rm-font") as FontFamily | null;
    if (f === "sans" || f === "serif" || f === "mono") { _font = f; }
    const fs = Number(localStorage.getItem("rm-fontSize"));
    if (fs >= 12 && fs <= 28) { _fontSize = fs; }
    const lh = Number(localStorage.getItem("rm-lineHeight"));
    if (lh >= 1.4 && lh <= 2.0) { _lineHeight = lh; }
    const cw = localStorage.getItem("rm-colWidth") as ColumnWidth | null;
    if (cw === "narrow" || cw === "medium" || cw === "wide") { _colWidth = cw; }
    notify();
    rerender((v) => v + 1);
  }, []);

  // Sync from DB once
  useEffect(() => {
    if (prefsSynced.current) return;
    prefsSynced.current = true;
    const stored = localStorage.getItem("rm-theme");
    if (!stored) { _theme = prefs.theme; }
    if (!localStorage.getItem("rm-font")) { _font = prefs.fontFamily; }
    if (!localStorage.getItem("rm-fontSize")) { _fontSize = prefs.fontSize; }
    if (!localStorage.getItem("rm-lineHeight")) { _lineHeight = prefs.lineHeight; }
    if (!localStorage.getItem("rm-colWidth")) { _colWidth = prefs.columnWidth; }
    // Apply theme class on html
    applyThemeClass(_theme);
    notify();
    rerender((v) => v + 1);
  }, [prefs]);

  function applyThemeClass(t: ReadingTheme) {
    const html = document.documentElement;
    html.classList.remove("rm-light", "rm-sepia", "rm-dark");
    html.classList.add(`rm-${t}`);
  }

  function applyTheme(t: ReadingTheme) {
    _theme = t;
    localStorage.setItem("rm-theme", t);
    applyThemeClass(t);
    notify();
    rerender((v) => v + 1);
    updatePrefs({ themeByFormat: { global: t } }).catch(() => {});
  }

  function applyFont(f: FontFamily) {
    _font = f;
    localStorage.setItem("rm-font", f);
    notify();
    rerender((v) => v + 1);
    updatePrefs({ fontFamily: f }).catch(() => {});
  }

  function applyFontSize(s: number) {
    _fontSize = s;
    localStorage.setItem("rm-fontSize", String(s));
    notify();
    rerender((v) => v + 1);
    updatePrefs({ fontSize: s }).catch(() => {});
  }

  function applyLineHeight(lh: number) {
    _lineHeight = lh;
    localStorage.setItem("rm-lineHeight", String(lh));
    notify();
    rerender((v) => v + 1);
    updatePrefs({ lineHeight: lh }).catch(() => {});
  }

  function applyColWidth(w: ColumnWidth) {
    _colWidth = w;
    localStorage.setItem("rm-colWidth", w);
    notify();
    rerender((v) => v + 1);
    updatePrefs({ columnWidth: w }).catch(() => {});
  }

  const panelContent = (
    <div className={isMobile ? "px-1 py-2" : "w-full max-h-[80vh] overflow-y-auto space-y-4"}>
      {/* Theme selection with Apple Books paper preview */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
          Màu nền giấy
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          {([
            { value: "light" as const, bg: "#FAF9F6", border: "#E6E3DC", label: "Giấy ngà", textColor: "#221F1D" },
            { value: "sepia" as const, bg: "#F4EEDF", border: "#DFD5C2", label: "Cổ điển", textColor: "#3E2718" },
            { value: "dark"  as const, bg: "#161619", border: "#303038", label: "Đêm nhung", textColor: "#ECEAE4" },
          ]).map(({ value, bg, border, label, textColor }) => (
            <button
              key={value}
              onClick={() => applyTheme(value)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all ${
                _theme === value
                  ? "border-primary bg-primary/5 shadow-xs ring-2 ring-primary/20 scale-[1.02]"
                  : "border-border/60 hover:border-border hover:bg-secondary/40"
              }`}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full border shadow-2xs transition-transform"
                style={{ background: bg, borderColor: border }}
              >
                {_theme === value && (
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3.5 8.5L6.5 11.5L12.5 5"
                      stroke={textColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className={`text-[11px] font-medium ${_theme === value ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Typography settings */}
      <div className="border-t border-border/50 pt-3 space-y-3.5">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Kiểu chữ
          </p>
          <div className="flex gap-2">
            {(["sans", "serif", "mono"] as const).map((f) => (
              <button
                key={f}
                onClick={() => applyFont(f)}
                className={`flex-1 rounded-xl border py-2 text-xs font-medium transition-all ${
                  _font === f
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                    : "border-border/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                {f === "sans" ? "Không chân" : f === "serif" ? "Có chân" : "Đơn dòng"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
            <span>Cỡ chữ đọc</span>
            <span className="font-semibold text-foreground">{_fontSize}px</span>
          </div>
          <input
            type="range"
            min="12"
            max="28"
            step="1"
            value={_fontSize}
            onChange={(e) => applyFontSize(Number(e.target.value))}
            className="w-full accent-primary h-1.5 rounded-full cursor-pointer bg-secondary"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
            <span>Khoảng cách dòng</span>
            <span className="font-semibold text-foreground">{_lineHeight.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="1.4"
            max="2.0"
            step="0.1"
            value={_lineHeight}
            onChange={(e) => applyLineHeight(Number(e.target.value))}
            className="w-full accent-primary h-1.5 rounded-full cursor-pointer bg-secondary"
          />
        </div>

        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Độ rộng khung đọc
          </p>
          <div className="flex gap-2">
            {([["narrow", "Gọn gàng"], ["medium", "Vừa phải"], ["wide", "Toàn màn hình"]] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => applyColWidth(v)}
                className={`flex-1 rounded-xl border py-2 text-[11px] font-medium transition-all ${
                  _colWidth === v
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                    : "border-border/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: BottomSheet */}
      {isMobile ? (
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Màu giấy & Cỡ chữ">
          {panelContent}
        </BottomSheet>
      ) : (
        /* Desktop: Apple Books styled dialog modal */
        open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cài đặt hiển thị"
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          >
            <div
              className="relative w-84 max-w-sm rounded-[28px] border border-border/80 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-border/40 mb-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm text-foreground">
                    Màu giấy & Cỡ chữ
                  </h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {panelContent}
            </div>
            {/* Backdrop click to close */}
            <div className="absolute inset-0 -z-10" onClick={() => setOpen(false)} />
          </div>
        )
      )}
    </>
  );
}
