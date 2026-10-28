"use client";

/**
 * DocCover — bìa theo loại tài liệu:
 *   ảnh  → tấm ảnh polaroid · âm thanh → bìa đĩa than · video → khung phim
 *   còn lại (pdf, epub, docx, markdown…) → BookCover (bìa sách)
 * Thuần CSS, khung 3:4 giống bìa sách để lưới thư viện thẳng hàng.
 */
import { memo } from "react";
import { Play, Music } from "lucide-react";
import { coverInk } from "@/lib/formats";
import { BookCover } from "./BookCover";

type Size = "xs" | "sm" | "md" | "lg";

const TEXT: Record<Size, { title: string; meta: string }> = {
  xs: { title: "text-[8px]", meta: "hidden" },
  sm: { title: "text-[10.5px]", meta: "text-[8px]" },
  md: { title: "text-[12.5px]", meta: "text-[9px]" },
  lg: { title: "text-[16px]", meta: "text-[10px]" },
};

function stripExt(title: string) {
  return title.replace(/\.[a-z0-9]{2,5}$/i, "");
}

function formatDuration(ms: number | null | undefined) {
  if (!ms || ms <= 0) return null;
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Ảnh: polaroid ──────────────────────────────────────────────────────────
function PhotoCover({ title, size, className }: { title: string; size: Size; className: string }) {
  const { base, deep, tilt } = coverInk(title);
  const t = TEXT[size];
  return (
    <div
      className={`relative flex aspect-[3/4] flex-col rounded-[6px] bg-[#FBF8F2] p-[7%] pb-0 shadow-[0_1px_2px_rgba(0,0,0,0.12),0_10px_24px_-10px_rgba(0,0,0,0.4)] ${className}`}
      aria-hidden
    >
      {/* "Ảnh": trời + đồi + mặt trời, màu theo tiêu đề */}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-[2px]"
        style={{ background: `linear-gradient(${tilt + 70}deg, ${base}55 0%, #F3E3C3 100%)` }}
      >
        <div className="absolute right-[18%] top-[16%] h-[18%] w-[18%] rounded-full bg-[#FFF4DC] shadow-[0_0_24px_8px_rgba(255,236,190,0.6)]" />
        <div className="absolute -left-[10%] bottom-[-38%] h-[80%] w-[85%] rounded-[50%]" style={{ background: base }} />
        <div className="absolute -right-[20%] bottom-[-46%] h-[85%] w-[90%] rounded-[50%]" style={{ background: deep }} />
      </div>
      <div className="flex flex-1 items-center justify-center px-1">
        <p className={`line-clamp-2 text-center font-display italic leading-tight text-[#3A3128] ${t.title}`}>
          {stripExt(title)}
        </p>
      </div>
    </div>
  );
}

// ─── Âm thanh: bìa đĩa than ─────────────────────────────────────────────────
function VinylCover({ title, size, durationMs, className }: { title: string; size: Size; durationMs?: number | null; className: string }) {
  const { base, deep, ink, tilt } = coverInk(title);
  const t = TEXT[size];
  const dur = formatDuration(durationMs);
  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-[8px] ${className}`} aria-hidden
      style={{ background: `linear-gradient(${tilt}deg, ${deep} 0%, #15131A 100%)`, color: ink }}
    >
      {/* Đĩa than trượt ra khỏi bìa */}
      <div
        className="absolute left-[36%] top-[10%] aspect-square w-[92%] rounded-full shadow-[0_6px_18px_rgba(0,0,0,0.5)]"
        style={{
          background:
            "repeating-radial-gradient(circle at center, #121114 0 1.5px, #1E1C22 1.5px 3px), #141216",
        }}
      >
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,transparent_0deg,rgba(255,255,255,0.12)_40deg,transparent_90deg,transparent_180deg,rgba(255,255,255,0.08)_220deg,transparent_270deg)]" />
        <div className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: base }}>
          <div className="absolute left-1/2 top-1/2 h-[14%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0E0D10]" />
        </div>
      </div>
      {/* Bìa đĩa (sleeve) phủ nửa trái */}
      <div className="absolute inset-y-0 left-0 w-[64%] shadow-[6px_0_14px_rgba(0,0,0,0.35)]"
        style={{ background: `linear-gradient(${tilt}deg, ${base} 0%, ${deep} 100%)` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(100%_70%_at_20%_0%,rgba(255,255,255,0.14),transparent_60%)]" />
      </div>
      <div className="relative flex h-full w-[64%] flex-col p-[9%]">
        <Music className="h-[14%] w-[14%] min-h-2.5 min-w-2.5 opacity-80" />
        <p className={`mt-auto line-clamp-3 font-display font-semibold leading-[1.15] ${t.title}`}>{stripExt(title)}</p>
        {dur && <p className={`mt-1 font-medium tabular-nums opacity-70 ${t.meta}`}>{dur}</p>}
      </div>
    </div>
  );
}

// ─── Video: khung phim ──────────────────────────────────────────────────────
function FilmCover({ title, size, durationMs, className }: { title: string; size: Size; durationMs?: number | null; className: string }) {
  const { base, deep, tilt } = coverInk(title);
  const t = TEXT[size];
  const dur = formatDuration(durationMs);
  // Dải lỗ phim hai bên
  const sprockets = "repeating-linear-gradient(to bottom, transparent 0 5px, rgba(255,255,255,0.55) 5px 10px, transparent 10px 14px)";
  return (
    <div className={`relative flex aspect-[3/4] flex-col overflow-hidden rounded-[8px] bg-[#141316] text-[#F2EEE8] shadow-[0_1px_2px_rgba(0,0,0,0.15),0_10px_24px_-10px_rgba(0,0,0,0.5)] ${className}`} aria-hidden>
      <div className="absolute inset-y-0 left-[3%] w-[5%] opacity-60" style={{ background: sprockets }} />
      <div className="absolute inset-y-0 right-[3%] w-[5%] opacity-60" style={{ background: sprockets }} />

      {/* Khung hình 16:9 */}
      <div className="relative mx-[12%] mt-[16%] aspect-video overflow-hidden rounded-[3px]"
        style={{ background: `linear-gradient(${tilt}deg, ${base} 0%, ${deep} 100%)` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(90%_90%_at_30%_20%,rgba(255,255,255,0.22),transparent_60%)]" />
        <div className="absolute left-1/2 top-1/2 flex h-[42%] aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 ring-1 ring-white/40">
          <Play className="h-1/2 w-1/2 translate-x-[6%] fill-current" />
        </div>
        {dur && (
          <span className={`absolute bottom-[6%] right-[5%] rounded-[3px] bg-black/60 px-1 font-medium tabular-nums ${t.meta}`}>{dur}</span>
        )}
      </div>

      <div className="relative mx-[12%] mt-auto mb-[12%]">
        <p className={`line-clamp-3 font-display font-semibold leading-[1.15] ${t.title}`}>{stripExt(title)}</p>
      </div>
    </div>
  );
}

export const DocCover = memo(function DocCover({
  title, format, size = "md", durationMs, className = "",
}: {
  title: string;
  format: string;
  size?: Size;
  durationMs?: number | null;
  className?: string;
}) {
  if (format === "image") return <PhotoCover title={title} size={size} className={className} />;
  if (format === "audio") return <VinylCover title={title} size={size} durationMs={durationMs} className={className} />;
  if (format === "video") return <FilmCover title={title} size={size} durationMs={durationMs} className={className} />;
  return <BookCover title={title} format={format} size={size} className={className} />;
});
