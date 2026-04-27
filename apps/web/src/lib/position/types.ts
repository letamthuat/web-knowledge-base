export type ReadingPosition =
  | { type: "pdf_page"; page: number; offset: number }
  | { type: "epub_cfi"; cfi: string }
  | { type: "time_seconds"; seconds: number }
  | { type: "scroll_pct"; pct: number }
  | { type: "slide_index"; slide: number };

export type PositionType = ReadingPosition["type"];

/** Returns a 0–1 progress fraction for UI display. Returns null if not computable. */
export function toProgressPct(pos: ReadingPosition, total?: number): number | null {
  switch (pos.type) {
    case "pdf_page":
      if (!total) return null;
      // Last page = 100%, otherwise proportional by page reached
      return pos.page >= total ? 1 : pos.page / total;
    case "scroll_pct":
      return pos.pct;
    case "slide_index":
      if (!total) return null;
      return pos.slide >= total - 1 ? 1 : (pos.slide + 1) / total;
    case "time_seconds":
      return total ? pos.seconds / total : null;
    case "epub_cfi":
      return null;
  }
}
