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
    fontFamily: _font === "serif" ? "var(--font-serif), Georgia, serif" : _font === "mono" ? "ui-monospace, monospace" : "var(--font-sans), system-ui, sans-serif",
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
    const mq = window.matchMedia("(max-width: 767px)");
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

  const typo = getAppTypography();
  const panelContent = (
    <div className="space-y-6 px-5 pb-6 pt-1">
      {/* Xem trước — đổi ngay theo lựa chọn */}
      <div className="rounded-2xl border border-border/60 bg-background px-4 py-3.5 shadow-2xs">
        <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Xem trước</p>
        <p
          className="text-foreground transition-[font-size,line-height] duration-200"
          style={{ fontFamily: typo.fontFamily, fontSize: _fontSize, lineHeight: _lineHeight }}
        >
          Đọc chậm lại một chút — tri thức chỉ thấm sâu khi ta cho nó thời gian.
        </p>
      </div>

      {/* Màu giấy */}
      <section>
        <SectionTitle>Màu giấy</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {PAPERS.map(({ value, bg, border, ink, label }) => {
            const active = _theme === value;
            return (
              <button key={value} onClick={() => applyTheme(value)} className="group flex flex-col items-center gap-1.5" aria-pressed={active}>
                <span
                  className={`flex aspect-[4/3] w-full items-center justify-center rounded-xl border transition-[transform,box-shadow] duration-300 ease-spring group-active:scale-95 ${
                    active ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                  }`}
                  style={{ background: bg, borderColor: border, color: ink }}
                >
                  <span className="font-display text-xl font-semibold">Aa</span>
                </span>
                <span className={`text-[12px] ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Kiểu chữ — mỗi nút hiển thị bằng chính font đó */}
      <section>
        <SectionTitle>Kiểu chữ</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {FONTS.map(({ value, label, css }) => {
            const active = _font === value;
            return (
              <button
                key={value}
                onClick={() => applyFont(value)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-0.5 rounded-xl border py-2.5 transition-colors ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <span className="text-xl leading-tight" style={{ fontFamily: css }}>Aa</span>
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Cỡ chữ: A− [thanh trượt] A+ */}
      <section>
        <SectionTitle aside={`${_fontSize}px`}>Cỡ chữ</SectionTitle>
        <div className="flex items-center gap-3">
          <button
            onClick={() => applyFontSize(Math.max(12, _fontSize - 1))}
            aria-label="Giảm cỡ chữ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground active:scale-95"
          >
            A−
          </button>
          <input
            type="range" min="12" max="28" step="1" value={_fontSize}
            onChange={(e) => applyFontSize(Number(e.target.value))}
            aria-label="Cỡ chữ"
            className="h-1.5 flex-1 cursor-pointer accent-primary"
          />
          <button
            onClick={() => applyFontSize(Math.min(28, _fontSize + 1))}
            aria-label="Tăng cỡ chữ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 text-[17px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground active:scale-95"
          >
            A+
          </button>
        </div>
      </section>

      {/* Giãn dòng */}
      <section>
        <SectionTitle>Giãn dòng</SectionTitle>
        <Segmented
          value={String(_lineHeight.toFixed(1))}
          onChange={(v) => applyLineHeight(Number(v))}
          options={LINE_HEIGHTS.map(({ value, label, gap }) => ({
            value: value.toFixed(1),
            label,
            art: (
              <span className="flex w-5 flex-col" style={{ gap }}>
                <span className="h-[2px] rounded-full bg-current" />
                <span className="h-[2px] rounded-full bg-current" />
                <span className="h-[2px] w-3/4 rounded-full bg-current" />
              </span>
            ),
          }))}
        />
      </section>

      {/* Khung đọc */}
      <section>
        <SectionTitle>Khung đọc</SectionTitle>
        <Segmented
          value={_colWidth}
          onChange={(v) => applyColWidth(v as ColumnWidth)}
          options={COL_WIDTHS.map(({ value, label, w }) => ({
            value,
            label,
            art: (
              <span className="flex h-4 w-6 items-center justify-center rounded-[3px] border border-current opacity-80">
                <span className="h-2 rounded-[1px] bg-current" style={{ width: w }} />
              </span>
            ),
          }))}
        />
      </section>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Màu giấy & Cỡ chữ">
          {panelContent}
        </BottomSheet>
      ) : (
        open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Màu giấy & Cỡ chữ"
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/40 animate-in fade-in duration-200" onClick={() => setOpen(false)} />
            <div className="relative max-h-[88vh] w-[400px] max-w-full overflow-y-auto rounded-[28px] border border-border/80 bg-card shadow-2xl animate-rise-in">
              <div className="flex items-center justify-between px-5 pb-2 pt-5">
                <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                  <Palette className="h-4 w-4 text-primary" /> Màu giấy & Cỡ chữ
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {panelContent}
            </div>
          </div>
        )
      )}
    </>
  );
}

// ─── Hằng số + khối dùng chung ───────────────────────────────────────────────

const PAPERS = [
  { value: "light" as const, bg: "#FBFAF8", border: "#E6E3DC", ink: "#221F1D", label: "Giấy ngà" },
  { value: "sepia" as const, bg: "#F4ECD8", border: "#DFD5C2", ink: "#3E2718", label: "Cổ điển" },
  { value: "dark" as const, bg: "#161619", border: "#303038", ink: "#ECEAE4", label: "Đêm" },
];

const FONTS = [
  { value: "sans" as const, label: "Không chân", css: "var(--font-sans), system-ui, sans-serif" },
  { value: "serif" as const, label: "Có chân", css: "var(--font-serif), Georgia, serif" },
  { value: "mono" as const, label: "Đơn cách", css: "ui-monospace, monospace" },
];

const LINE_HEIGHTS = [
  { value: 1.4, label: "Sát", gap: 2 },
  { value: 1.6, label: "Vừa", gap: 3 },
  { value: 1.8, label: "Thoáng", gap: 4 },
  { value: 2.0, label: "Rộng", gap: 5 },
];

const COL_WIDTHS = [
  { value: "narrow" as const, label: "Gọn", w: "40%" },
  { value: "medium" as const, label: "Vừa", w: "65%" },
  { value: "wide" as const, label: "Rộng", w: "90%" },
];

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: string }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
      {aside && <span className="text-[12px] font-semibold tabular-nums text-foreground">{aside}</span>}
    </div>
  );
}

function Segmented({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; art: React.ReactNode }[];
}) {
  return (
    <div className="flex gap-1 rounded-2xl bg-secondary/70 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-[background-color,color,box-shadow] duration-200 ${
              active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {/* Cố định cao vùng hình để nhãn thẳng hàng */}
            <span className="flex h-5 items-center">{o.art}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
