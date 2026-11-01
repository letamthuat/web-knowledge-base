// Thuật toán reflow PDF thuần (không DOM) — dựng dòng từ toạ độ text item rồi gộp thành đoạn.
export type ReflowBlock = { text: string; heading: boolean };
export type PdfTextItem = { str: string; x: number; y: number; h: number; w: number; eol: boolean };

type Line = { text: string; y: number; h: number; x: number; right: number };

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function buildLines(items: PdfTextItem[]): Line[] {
  const lines: Line[] = [];
  let cur: Line | null = null;
  let prevEol = false;
  for (const it of items) {
    const sameLine = cur && !prevEol && Math.abs(it.y - cur.y) <= Math.max(2, it.h * 0.5);
    if (!cur || !sameLine) {
      if (cur && cur.text.trim()) lines.push(cur);
      cur = { text: it.str, y: it.y, h: it.h, x: it.x, right: it.x + it.w };
    } else {
      // chèn space nếu 2 item cách nhau mà chưa có khoảng trắng
      const gap = it.x - cur.right;
      const needSpace = gap > it.h * 0.15 && !cur.text.endsWith(" ") && !it.str.startsWith(" ");
      cur.text += (needSpace ? " " : "") + it.str;
      cur.right = Math.max(cur.right, it.x + it.w);
      cur.h = Math.max(cur.h, it.h);
    }
    prevEol = it.eol;
  }
  if (cur && cur.text.trim()) lines.push(cur);
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() }));
}

function buildBlocks(lines: Line[]): ReflowBlock[] {
  const body = lines.filter((l) => !/^\d{1,4}$/.test(l.text)); // số trang
  if (!body.length) return [];
  const gaps: number[] = [];
  for (let i = 1; i < body.length; i++) {
    const g = body[i - 1].y - body[i].y; // PDF: y tăng lên trên
    if (g > 0) gaps.push(g);
  }
  const lineGap = median(gaps) || median(body.map((l) => l.h)) * 1.2;
  const bodyH = median(body.map((l) => l.h));
  const maxRight = Math.max(...body.map((l) => l.right));
  const minX = Math.min(...body.map((l) => l.x));
  const fullWidth = maxRight - minX;

  const blocks: ReflowBlock[] = [];
  let cur: { text: string; heading: boolean } | null = null;
  let prev: Line | null = null;
  for (const l of body) {
    const heading = l.h > bodyH * 1.25 && l.text.length < 120;
    let newBlock = !cur || !prev;
    if (cur && prev) {
      const gap = prev.y - l.y;
      const prevShort = prev.right - minX < fullWidth * 0.8 && /[.!?:;…”"»)]$/.test(prev.text);
      newBlock = gap > lineGap * 1.45 || gap < 0 || heading !== cur.heading || prevShort;
    }
    if (newBlock) {
      if (cur) blocks.push(cur);
      cur = { text: l.text, heading };
    } else if (cur) {
      if (/[A-Za-zÀ-ỹ]-$/.test(cur.text) && /^[a-zà-ỹ]/.test(l.text)) cur.text = cur.text.slice(0, -1) + l.text;
      else cur.text += " " + l.text;
    }
    prev = l;
  }
  if (cur) blocks.push(cur);
  return blocks;
}

/** Text items của 1 trang → các đoạn văn. */
export function blocksFromTextItems(items: PdfTextItem[]): ReflowBlock[] {
  return buildBlocks(buildLines(items));
}
