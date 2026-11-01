"use client";
// Podcast — chia tập THEO LƯỢNG KIẾN THỨC (giữ chiều sâu, không nén cho vừa thời lượng).
// Đơn vị = tiểu mục ### (không có ### thì ##). Tiểu mục dài hơn ~1.4× mục tiêu → tách nhiều
// phần theo #### (4 tầng handbook), tầng vẫn quá dài → tách theo đoạn văn.
// Tiểu mục ngắn liền nhau (cùng mục cha) được gom thành 1 tập. PDF: gom theo trang.
// Anchor tính y hệt materialize (slug MỌI heading theo thứ tự) để nối study_units.
import GithubSlugger from "github-slugger";
import { collectHeadings, extractDottedKey, type Heading } from "@/lib/study/materialize";
import type { ReflowPage } from "@/lib/pdf/reflow";

export const DEFAULT_TARGET_CHARS = 9000;

export type EpisodeSection = {
  docId: string;
  title: string;
  headingText?: string;     // heading gốc (raw) — tìm lại khi sinh kịch bản / cuộn reader
  anchor?: string;          // slug khớp study_units.headingAnchor
  unitKey?: string | null;  // "2.1.3" nếu heading có số
  partLabel?: string;       // "Phần 2/3 · Lý thuyết"
  range?: [number, number]; // đoạn con trong text của tiểu mục (khi tách phần)
  unitLen?: number;         // độ dài text tiểu mục lúc chia (phát hiện tài liệu đã đổi)
  lastPart?: boolean;       // phần cuối của tiểu mục → nghe xong mới tính "đã đọc"
  pageFrom?: number;
  pageTo?: number;
  chars: number;
};

export type PlannedEpisode = { title: string; sections: EpisodeSection[]; sourceChars: number };

type Block = EpisodeSection & { parentKey: string };

/** Heading markdown → chữ hiển thị. */
export function cleanHeading(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const contentLen = (s: string) => s.replace(/^#+\s.*$/gm, "").replace(/\s+/g, " ").trim().length;

/** Chia text theo đoạn văn (ngoài code fence) thành các khúc ~target. Trả offset tương đối. */
function splitByParagraphs(text: string, target: number): [number, number][] {
  const cuts: number[] = [];
  let inFence = false;
  let offset = 0;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence && line.trim() === "") cuts.push(offset + line.length + 1);
    offset += line.length + 1;
  }
  const out: [number, number][] = [];
  let start = 0;
  for (const c of cuts) {
    if (c - start >= target) { out.push([start, c]); start = c; }
  }
  if (start < text.length) {
    if (out.length && text.length - start < target * 0.35) out[out.length - 1][1] = text.length;
    else out.push([start, text.length]);
  }
  return out;
}

/** Tách 1 tiểu mục dài thành nhiều phần (theo ####, rồi theo đoạn). Offset tương đối với unitText. */
function splitUnit(unitText: string, unitStart: number, subHeadings: Heading[], target: number): { range: [number, number]; label: string | null }[] {
  // Vùng: phần mở đầu trước #### đầu tiên + từng ####
  const regions: { a: number; b: number; label: string | null }[] = [];
  const subs = subHeadings.map((h) => ({ rel: h.offset - unitStart, text: cleanHeading(h.text) }));
  let a = 0;
  let label: string | null = null;
  for (const s of subs) {
    if (s.rel > a) regions.push({ a, b: s.rel, label });
    a = s.rel;
    label = s.text;
  }
  regions.push({ a, b: unitText.length, label });

  // Vùng quá dài → cắt theo đoạn văn
  const pieces: { a: number; b: number; label: string | null }[] = [];
  for (const r of regions) {
    if (r.b - r.a > target * 1.6) {
      for (const [x, y] of splitByParagraphs(unitText.slice(r.a, r.b), target)) pieces.push({ a: r.a + x, b: r.a + y, label: r.label });
    } else pieces.push(r);
  }

  // Gom các mảnh liền nhau thành phần ≤ ~1.15× target
  const parts: { range: [number, number]; label: string | null }[] = [];
  let cur: { a: number; b: number; label: string | null } | null = null;
  for (const p of pieces) {
    if (cur && p.b - cur.a <= target * 1.15) { cur.b = p.b; continue; }
    if (cur) parts.push({ range: [cur.a, cur.b], label: cur.label });
    cur = { ...p };
  }
  if (cur) parts.push({ range: [cur.a, cur.b], label: cur.label });
  // Mảnh cuối quá nhỏ → nhập vào phần trước
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (last.range[1] - last.range[0] < target * 0.3) {
      parts[parts.length - 2].range[1] = last.range[1];
      parts.pop();
    }
  }
  return parts;
}

/** 1 file markdown → các block (tiểu mục hoặc phần của tiểu mục). */
function planMarkdownBlocks(doc: { docId: string; title: string; markdown: string }, target: number): Block[] {
  const md = doc.markdown;
  const headings = collectHeadings(md);
  const slugger = new GithubSlugger();
  const anchors = headings.map((h) => slugger.slug(h.text));

  const hasH3 = headings.some((h) => h.level === 3);
  const hasH2 = headings.some((h) => h.level === 2);
  const unitLevel = hasH3 ? 3 : hasH2 ? 2 : 0;
  const blocks: Block[] = [];

  if (unitLevel === 0) {
    // Không có heading cấu trúc → cả tài liệu, tách theo đoạn
    const ranges = contentLen(md) > target * 1.4 ? splitByParagraphs(md, target) : [[0, md.length] as [number, number]];
    ranges.forEach((range, k) => blocks.push({
      docId: doc.docId, parentKey: doc.docId, title: doc.title,
      partLabel: ranges.length > 1 ? `Phần ${k + 1}/${ranges.length}` : undefined,
      range: ranges.length > 1 ? range : undefined, unitLen: md.length, lastPart: k === ranges.length - 1,
      chars: contentLen(md.slice(range[0], range[1])),
    }));
    return blocks;
  }

  const endOf = (i: number, level: number) => {
    for (let j = i + 1; j < headings.length; j++) if (headings[j].level <= level) return headings[j].offset;
    return md.length;
  };

  // Lời mở đầu trước heading cấu trúc đầu tiên
  const firstStruct = headings.find((h) => h.level <= unitLevel && h.level >= 2);
  if (firstStruct && contentLen(md.slice(0, firstStruct.offset)) > 600) {
    blocks.push({ docId: doc.docId, parentKey: doc.docId, title: doc.title, range: [0, firstStruct.offset], unitLen: md.length, lastPart: true, chars: contentLen(md.slice(0, firstStruct.offset)) });
  }

  let parentKey = doc.docId;
  headings.forEach((h, i) => {
    if (h.level < 2 || h.level > unitLevel) return;
    const start = h.offset;
    if (h.level < unitLevel) {
      // Mục cha: chỉ thành block nếu phần dẫn nhập (trước tiểu mục đầu) đủ dày
      parentKey = `${doc.docId}#${anchors[i]}`;
      const introEnd = endOf(i, unitLevel);
      const intro = md.slice(start, introEnd);
      if (contentLen(intro) > 600) {
        blocks.push({
          docId: doc.docId, parentKey, title: cleanHeading(h.text), headingText: h.text, anchor: anchors[i],
          unitKey: extractDottedKey(h.text), range: [0, intro.length], unitLen: endOf(i, h.level) - start, lastPart: false,
          chars: contentLen(intro),
        });
      }
      return;
    }
    const end = endOf(i, unitLevel);
    const unitText = md.slice(start, end);
    const base = {
      docId: doc.docId, parentKey, title: cleanHeading(h.text), headingText: h.text, anchor: anchors[i],
      unitKey: extractDottedKey(h.text), unitLen: unitText.length,
    };
    const len = contentLen(unitText);
    if (len <= target * 1.4) {
      blocks.push({ ...base, lastPart: true, chars: len });
      return;
    }
    const subs = headings.filter((s, k) => k > i && s.offset < end && s.level > unitLevel);
    const parts = splitUnit(unitText, start, subs, target);
    parts.forEach((p, k) => blocks.push({
      ...base,
      range: p.range,
      partLabel: `Phần ${k + 1}/${parts.length}${p.label ? ` · ${p.label}` : ""}`,
      lastPart: k === parts.length - 1,
      chars: contentLen(unitText.slice(p.range[0], p.range[1])),
    }));
  });
  return blocks;
}

function episodeTitle(secs: Block[]): string {
  if (secs.length === 1) return secs[0].partLabel ? `${secs[0].title} — ${secs[0].partLabel}` : secs[0].title;
  const k1 = secs[0].unitKey, k2 = secs[secs.length - 1].unitKey;
  if (k1 && k2) {
    const strip = (t: string) => t.replace(/^\s*\d+(?:\.\d+)+\.?\s*/, "");
    return `${k1}–${k2} · ${strip(secs[0].title)} (+${secs.length - 1} mục)`;
  }
  return `${secs[0].title} (+${secs.length - 1} mục)`;
}

/** Gom block liền nhau (cùng mục cha) thành tập ~target ký tự. */
function groupBlocks(blocks: Block[], target: number): PlannedEpisode[] {
  const eps: PlannedEpisode[] = [];
  let cur: Block[] = [];
  let sum = 0;
  const flush = () => {
    if (!cur.length) return;
    eps.push({ title: episodeTitle(cur), sections: cur.map(({ parentKey: _p, ...s }) => s), sourceChars: sum });
    cur = [];
    sum = 0;
  };
  for (const b of blocks) {
    const isPart = !!b.partLabel;
    // Cùng mục cha thì gom tới ~target; khác mục cha chỉ gom khi tập còn quá mỏng
    const fits = cur.length > 0 && !isPart && !cur[0].partLabel
      && (cur[cur.length - 1].parentKey === b.parentKey || sum < target * 0.45)
      && sum + b.chars <= target * 1.25 && cur.length < 6 && sum < target * 0.75;
    if (!fits) flush();
    cur.push(b);
    sum += b.chars;
    if (isPart) flush();
  }
  flush();
  return eps;
}

/** Handbook / tài liệu markdown → danh sách tập. Docs theo thứ tự truyền vào. */
export function planMarkdownEpisodes(docs: { docId: string; title: string; markdown: string }[], target = DEFAULT_TARGET_CHARS): PlannedEpisode[] {
  return docs.flatMap((d) => groupBlocks(planMarkdownBlocks(d, target), target));
}

/** PDF (đã reflow) → tập theo dải trang. */
export function planPdfEpisodes(docId: string, pages: ReflowPage[], target = DEFAULT_TARGET_CHARS): PlannedEpisode[] {
  const eps: PlannedEpisode[] = [];
  let from = 0, to = 0, sum = 0;
  const flush = () => {
    if (!sum) return;
    const title = from === to ? `Trang ${from}` : `Trang ${from}–${to}`;
    eps.push({ title, sections: [{ docId, title, pageFrom: from, pageTo: to, chars: sum }], sourceChars: sum });
    sum = 0;
  };
  for (const p of pages) {
    const len = p.blocks.reduce((s, b) => s + b.text.length, 0);
    if (!len) continue;
    if (sum && sum + len > target * 1.15) flush();
    if (!sum) from = p.page;
    to = p.page;
    sum += len;
  }
  flush();
  return eps;
}

// ─── Lấy lại text nguồn của 1 tập (lúc sinh kịch bản) ─────────────────────────

/** Text của 1 section trong markdown hiện tại (tìm heading theo anchor/headingText). */
export function sliceMarkdownSection(md: string, s: EpisodeSection): string {
  if (!s.headingText) {
    if (!s.range) return md;
    return md.slice(...scaleRange(s.range, s.unitLen ?? md.length, md.length));
  }
  const headings = collectHeadings(md);
  const slugger = new GithubSlugger();
  const anchors = headings.map((h) => slugger.slug(h.text));
  let i = s.anchor ? anchors.indexOf(s.anchor) : -1;
  if (i < 0) i = headings.findIndex((h) => h.text === s.headingText);
  if (i < 0) return "";
  const level = headings[i].level;
  let end = md.length;
  for (let j = i + 1; j < headings.length; j++) if (headings[j].level <= level) { end = headings[j].offset; break; }
  const unitText = md.slice(headings[i].offset, end);
  if (!s.range) return unitText;
  return unitText.slice(...scaleRange(s.range, s.unitLen ?? unitText.length, unitText.length));
}

/** Tài liệu đổi độ dài sau khi chia → co giãn range theo tỉ lệ (gần đúng). */
function scaleRange(range: [number, number], oldLen: number, newLen: number): [number, number] {
  if (Math.abs(oldLen - newLen) < 2) return range;
  const f = newLen / Math.max(1, oldLen);
  return [Math.round(range[0] * f), Math.round(range[1] * f)];
}

export function slicePdfSection(pages: ReflowPage[], s: EpisodeSection): string {
  return pages
    .filter((p) => p.page >= (s.pageFrom ?? 0) && p.page <= (s.pageTo ?? Infinity))
    .map((p) => p.blocks.map((b) => (b.heading ? `## ${b.text}` : b.text)).join("\n\n"))
    .join("\n\n");
}
