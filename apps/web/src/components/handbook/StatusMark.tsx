"use client";

/** Trạng thái đọc của 1 file trong cây: vòng rỗng (chưa đọc) · vòng tiến độ · dấu xong. */
export function StatusMark({ format, pct }: { format: string; pct: number | null }) {
  if (format === "image" || format === "audio" || format === "video") return null;
  const R = 4.5;
  const C = 2 * Math.PI * R;
  if (pct != null && pct >= 0.95) {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" aria-label="Đã đọc xong" className="shrink-0">
        <circle cx="6.5" cy="6.5" r="6" fill="hsl(var(--primary))" opacity="0.9" />
        <path d="M4 6.6l1.7 1.7L9 5" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const p = pct != null && pct > 0 ? pct : 0;
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-label={p > 0 ? `Đã đọc ${Math.round(p * 100)}%` : "Chưa đọc"} className="shrink-0 -rotate-90">
      <circle cx="6.5" cy="6.5" r={R} fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.28" strokeWidth="1.6" />
      {p > 0 && (
        <circle cx="6.5" cy="6.5" r={R} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0.08, p))} />
      )}
    </svg>
  );
}
