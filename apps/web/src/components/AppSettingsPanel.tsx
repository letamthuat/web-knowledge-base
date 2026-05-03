"use client";

import { useState, useEffect, useRef } from "react";
import { Settings } from "lucide-react";
import { useReadingModePrefs, useUpdateReadingModePrefs, type ReadingTheme, type FontFamily, type ColumnWidth } from "@/hooks/useReadingModePrefs";

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

export function AppSettingsPanel() {
  const [open, setOpen] = useState(false);
  const [, rerender] = useState(0);

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

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 right-4 z-50 flex h-8 w-8 items-center justify-center rounded-full border shadow-md transition-all hover:scale-105 ${open ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"}`}
        aria-label="Cài đặt hiển thị"
      >
        <Settings className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed bottom-16 right-4 z-50 rounded-2xl border bg-card shadow-2xl p-4 w-56 max-h-[80vh] overflow-y-auto">
          {/* Theme */}
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Màu nền</p>
          <div className="flex gap-2">
            {([
              { value: "light" as const, bg: "#ffffff", label: "Sáng" },
              { value: "sepia" as const, bg: "#f4ecd8", label: "Sepia" },
              { value: "dark"  as const, bg: "#1a1a1a", label: "Tối" },
            ]).map(({ value, bg, label }) => (
              <button key={value} onClick={() => applyTheme(value)} className="flex flex-col items-center gap-1.5 group">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all group-hover:scale-105 ${_theme === value ? "border-primary ring-2 ring-primary/30 scale-105" : "border-border"}`} style={{ background: bg }}>
                  {_theme === value && (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 5" stroke={value === "dark" ? "#fff" : "#000"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className={`text-[10px] font-medium ${_theme === value ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
              </button>
            ))}
          </div>

          {/* Typography */}
          <div className="border-t pt-3 mt-3 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Chữ</p>

            <div className="flex gap-1.5">
              {(["sans", "serif", "mono"] as const).map((f) => (
                <button key={f} onClick={() => applyFont(f)}
                  className={`flex-1 rounded-lg border py-1 text-xs font-medium transition-all ${_font === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/40"}`}>
                  {f === "sans" ? "Sans" : f === "serif" ? "Serif" : "Mono"}
                </button>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5"><span>Cỡ chữ</span><span>{_fontSize}px</span></div>
              <input type="range" min="12" max="28" step="1" value={_fontSize}
                onChange={(e) => applyFontSize(Number(e.target.value))}
                className="w-full accent-primary h-1.5 rounded-full cursor-pointer" />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5"><span>Dãn dòng</span><span>{_lineHeight.toFixed(1)}</span></div>
              <input type="range" min="1.4" max="2.0" step="0.1" value={_lineHeight}
                onChange={(e) => applyLineHeight(Number(e.target.value))}
                className="w-full accent-primary h-1.5 rounded-full cursor-pointer" />
            </div>

            <div className="flex gap-1.5">
              {([["narrow", "Hẹp"], ["medium", "Vừa"], ["wide", "Rộng"]] as const).map(([v, label]) => (
                <button key={v} onClick={() => applyColWidth(v)}
                  className={`flex-1 rounded-lg border py-1 text-xs font-medium transition-all ${_colWidth === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/40"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
