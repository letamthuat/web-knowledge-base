"use client";

import { memo } from "react";
import { FORMAT_ICONS, FORMAT_LABELS, coverInk } from "@/lib/formats";
import { FileText } from "lucide-react";

/** Bỏ đuôi file khỏi tiêu đề hiển thị trên bìa. */
function coverTitle(title: string) {
  return title.replace(/\.(pdf|epub|docx?|pptx?|md|markdown|html?|mp3|m4a|wav|webm|mp4|jpe?g|png)$/i, "");
}

const SIZES = {
  xs: { title: "text-[9px] leading-[1.15]", pad: "p-1.5 pl-2.5", label: "hidden", icon: "h-2.5 w-2.5" },
  sm: { title: "text-[12px] leading-[1.2]", pad: "p-2.5 pl-3.5", label: "text-[8px]", icon: "h-3 w-3" },
  md: { title: "text-[15px] leading-[1.18]", pad: "p-3.5 pl-5", label: "text-[9px]", icon: "h-3.5 w-3.5" },
  lg: { title: "text-[21px] leading-[1.12]", pad: "p-5 pl-7", label: "text-[10px]", icon: "h-4 w-4" },
} as const;

/**
 * Bìa sách tự sinh: nền vải màu mực (ổn định theo tiêu đề), gáy đổ bóng bên trái,
 * tiêu đề serif, nhãn định dạng dưới đáy. Thuần CSS — không ảnh, không tải mạng.
 */
export const BookCover = memo(function BookCover({
  title, format, size = "md", className = "",
}: {
  title: string;
  format: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { base, deep, ink, tilt } = coverInk(title);
  const s = SIZES[size];
  const Icon = FORMAT_ICONS[format] ?? FileText;

  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-[4px_10px_10px_4px] shadow-[0_1px_2px_rgba(0,0,0,0.12),0_10px_24px_-10px_rgba(0,0,0,0.45)] ${className}`}
      style={{ background: `linear-gradient(${tilt}deg, ${base} 0%, ${deep} 100%)`, color: ink }}
      aria-hidden
    >
      {/* Gáy sách: dải tối + vệt sáng mảnh */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/35 via-black/10 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-[7%] w-px bg-white/15" />
      {/* Ánh sáng chéo mờ — cảm giác vải/giấy bìa */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_85%_0%,rgba(255,255,255,0.16),transparent_60%)]" />

      <div className={`relative flex h-full flex-col ${s.pad}`}>
        <div className="h-px w-6 shrink-0 opacity-50" style={{ background: ink }} />
        <p className={`mt-2 line-clamp-5 font-display font-semibold ${s.title}`} style={{ textWrap: "balance" } as React.CSSProperties}>
          {coverTitle(title)}
        </p>
        <div className={`mt-auto flex items-center gap-1 font-medium uppercase tracking-[0.14em] opacity-75 ${s.label}`}>
          <Icon className={s.icon} />
          <span>{FORMAT_LABELS[format] ?? format}</span>
        </div>
      </div>
    </div>
  );
});
