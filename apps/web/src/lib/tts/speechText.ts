// Nghe bài — chuyển nội dung tài liệu thành danh sách đoạn đọc to (thuần, không I/O).
// Mỗi đoạn ≤ MAX_SEGMENT_CHARS để 1 lần gọi Azure ra 1 file MP3 (cache R2 theo hash text).
// Đoạn gắn với "mục" (heading ≤ ###) hoặc "trang" (PDF) để thanh nghe hiện đang ở đâu + cuộn theo.

export const MAX_SEGMENT_CHARS = 2400;

export type SpeechSegment = {
  /** Tiêu đề mục/trang chứa đoạn — hiện trên thanh nghe + màn hình khoá. */
  title: string;
  /** Heading gốc (đã làm sạch) để reader cuộn tới; PDF dùng page. */
  headingText?: string;
  page?: number;
  text: string;
  /** Podcast: nhiều lượt thoại 2 giọng đọc trong 1 lần gọi TTS (text chỉ để hiển thị). */
  dialogue?: { speaker: "host" | "expert"; text: string }[];
  /** Tên người nói hiện trên thanh nghe (podcast). */
  speaker?: string;
  /** Số tham chiếu của nơi dùng (podcast: chỉ số lượt thoại đầu của đoạn). */
  ref?: number;
};

const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

const CALLOUT_LABEL: Record<string, string> = {
  note: "Ghi chú", tip: "Mẹo", important: "Quan trọng", warning: "Cảnh báo", caution: "Thận trọng",
  info: "Thông tin", example: "Ví dụ", quote: "Trích dẫn", insight: "Insight", summary: "Tóm tắt",
};

/** Làm sạch 1 dòng inline markdown → text đọc được. */
function cleanInline(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")             // ảnh
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a) // wikilink
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")           // link → chữ
    .replace(/\[\^[^\]]+\]/g, "")                       // chú thích
    .replace(/<[^>]+>/g, " ")                           // html
    .replace(/\$([^$\n]+)\$/g, (_, m: string) => m.replace(/\\[a-zA-Z]+/g, " ").replace(/[{}^_\\]/g, " "))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__|\*|~~)(?=\S)([\s\S]*?\S)\1/g, "$2") // không gỡ "_" đơn — phá snake_case
    .replace(/\*+/g, "")                                // dấu * lạc (in đậm vắt dòng)
    .replace(/\s*(→|⇒|->)\s*/g, ", ")
    .replace(EMOJI_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bảo đảm câu có dấu kết để giọng đọc ngắt nghỉ. */
function endSentence(s: string): string {
  return /[.!?…:;,]$/.test(s) ? s : s + ".";
}

/** Chia 1 khối text dài thành mẩu ≤ max tại ranh giới câu. */
function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (s.length > max) {
      if (cur) { out.push(cur.trim()); cur = ""; }
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max).trim());
      continue;
    }
    if ((cur + s).length > max) { out.push(cur.trim()); cur = ""; }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Gom các đoạn văn của 1 mục thành segment ≤ max. */
function packSection(title: string, paragraphs: string[], extra: Omit<SpeechSegment, "title" | "text">): SpeechSegment[] {
  const out: SpeechSegment[] = [];
  let cur = "";
  const flush = () => { if (cur.trim()) out.push({ title, ...extra, text: cur.trim() }); cur = ""; };
  for (const p of paragraphs) {
    for (const piece of splitLong(p, MAX_SEGMENT_CHARS)) {
      if (cur && cur.length + piece.length + 1 > MAX_SEGMENT_CHARS) flush();
      cur += (cur ? "\n" : "") + piece;
    }
  }
  flush();
  return out;
}

/** Markdown → segments. Tách mục ở heading #..###; #### (4-tier) đọc như câu dẫn trong mục. */
export function markdownToSpeechSegments(markdown: string, docTitle: string): SpeechSegment[] {
  const md = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
  const lines = md.split(/\r?\n/);
  const segments: SpeechSegment[] = [];

  let title = docTitle;
  let headingText: string | undefined;
  let paras: string[] = [];
  let buf: string[] = [];
  let fence: string | null = null;
  let mathBlock = false;

  const flushPara = () => {
    const t = cleanInline(buf.join(" "));
    if (t) paras.push(endSentence(t));
    buf = [];
  };
  const flushSection = () => {
    flushPara();
    segments.push(...packSection(title, paras, { headingText }));
    paras = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const fenceM = line.match(/^\s*(```+|~~~+)\s*(\w*)/);
    if (fence) {
      if (fenceM && line.trim().startsWith(fence)) fence = null;
      continue;
    }
    if (fenceM) {
      flushPara();
      fence = fenceM[1];
      paras.push(fenceM[2] === "mermaid" ? "Có một sơ đồ, xem trên màn hình." : "Có một đoạn code, xem trên màn hình.");
      continue;
    }
    if (line.trim() === "$$") {
      if (!mathBlock) { flushPara(); paras.push("Có một công thức, xem trên màn hình."); }
      mathBlock = !mathBlock;
      continue;
    }
    if (mathBlock) continue;

    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (h) {
      const text = cleanInline(h[2]);
      if (h[1].length <= 3) {
        flushSection();
        title = text || title;
        headingText = text;
        if (text) paras.push(endSentence(text));
      } else {
        flushPara();
        if (text) paras.push(endSentence(text));
      }
      continue;
    }

    if (!line.trim()) { flushPara(); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); continue; } // ---

    // Bảng: đọc từng hàng "ô, ô, ô."; bỏ hàng phân cách
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara();
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
      const cells = line.split("|").slice(1, -1).map(cleanInline).filter(Boolean);
      if (cells.length) paras.push(endSentence(cells.join(", ")));
      continue;
    }

    // Callout "> [!NOTE] Tiêu đề" → "Ghi chú: Tiêu đề."
    const callout = line.match(/^\s*>\s*\[!(\w+)\][+-]?\s*(.*)$/);
    if (callout) {
      flushPara();
      const label = CALLOUT_LABEL[callout[1].toLowerCase()] ?? "";
      const rest = cleanInline(callout[2]);
      const t = [label, rest].filter(Boolean).join(": ");
      if (t) paras.push(endSentence(t));
      continue;
    }

    // Mục danh sách → mỗi mục 1 câu
    const li = line.match(/^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/);
    if (li) {
      flushPara();
      buf.push(li[1]);
      flushPara();
      continue;
    }

    buf.push(line.replace(/^\s*(?:>\s*)+/, ""));
  }
  flushSection();
  return segments;
}

/** PDF (đã reflow thành đoạn theo trang) → segments, mỗi trang là 1 "mục". */
export function pagesToSpeechSegments(pages: { page: number; paragraphs: string[] }[]): SpeechSegment[] {
  const out: SpeechSegment[] = [];
  for (const p of pages) {
    const paras = p.paragraphs.map((t) => cleanInline(t)).filter(Boolean).map(endSentence);
    out.push(...packSection(`Trang ${p.page}`, paras, { page: p.page }));
  }
  return out;
}
