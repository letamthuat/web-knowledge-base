"use client";
// B2 — Materialize cây study_units từ markdown handbook.
// Theo 01-specs/study/SPEC.md §1.1, §2.3, §2.3.1.
// Parse heading ## (mục x.y) / ### (tiểu mục x.y.z = đơn vị scope). Bỏ #### (4-tier) và #.
// Deterministic, 0 Gemini. Anchor khớp reader (rehype-slug → github-slugger).
import GithubSlugger from "github-slugger";
import { insertStudyUnits, setSpaceSources, type NewStudyUnit, type UnitStatus } from "@/lib/api/study";
import { getAssetUrls } from "@/lib/api/handbooks";

const DEFAULT_UNIT_CHARS = 43_000; // khớp rule engine (SPEC §3.1)

// File phụ trợ — tự loại khỏi materialize (SPEC §2.1).
const META_FILE_RE = /(^|\/)(_|00[-_])|(muc[-_]?luc|ke[-_]?hoach|glossary|index|toc)\b/i;
export function isMetaFile(relPath: string): boolean {
  const base = (relPath.split("/").pop() ?? relPath).toLowerCase();
  return META_FILE_RE.test(base) || base.startsWith("_");
}

/** "02-demand-planning.md" → "M2"; không có số → M{fallbackIndex}. */
export function moduleKeyFromRelPath(relPath: string, fallbackIndex: number): string {
  const base = relPath.split("/").pop() ?? relPath;
  const m = base.match(/^(\d+)/);
  return "M" + (m ? String(parseInt(m[1], 10)) : String(fallbackIndex));
}

/** Trích số mục dạng "2.1.3" ở đầu tiêu đề heading. */
function extractDottedKey(headingText: string): string | null {
  const m = headingText.match(/^\s*(\d+(?:\.\d+)+)\.?(?:\s|$)/);
  return m ? m[1] : null;
}

/** Hash nhẹ (FNV-1a 32-bit) để phát hiện nội dung đổi khi reconcile. */
function hashContent(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

type Heading = { level: number; text: string; offset: number };

/** Thu mọi heading (mọi cấp) kèm char-offset — offset để tính chars scope, mọi cấp để slugger dedup khớp reader. */
function collectHeadings(markdown: string): Heading[] {
  const out: Heading[] = [];
  const lines = markdown.split(/\r?\n/);
  let offset = 0;
  let inFence = false;
  for (const line of lines) {
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) inFence = !inFence;
    if (!inFence) {
      const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m) out.push({ level: m[1].length, text: m[2].trim(), offset });
    }
    offset += line.length + 1; // +1 cho ký tự newline
  }
  return out;
}

export type ParsedUnit = NewStudyUnit;

/**
 * Parse 1 file markdown thành cây unit (module root + mục x.y + tiểu mục x.y.z).
 * startOrder = orderIndex bắt đầu (dùng chung liên tục cho cả space theo thứ tự file).
 * Trả { units, nextOrder }.
 */
export function parseUnitsFromMarkdown(input: {
  markdown: string;
  moduleKey: string;
  moduleTitle: string;
  docId: string | null;
  startOrder: number;
}): { units: ParsedUnit[]; nextOrder: number } {
  const { markdown, moduleKey, moduleTitle, docId, startOrder } = input;
  const moduleNum = moduleKey.replace(/^M/, "");
  const slugger = new GithubSlugger(); // reset per doc (rehype-slug tạo mới mỗi file)
  const headings = collectHeadings(markdown);

  const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const mk = (partial: Omit<ParsedUnit, "_id" | "moduleKey" | "docId" | "status" | "readPct" | "masteredAt" | "lastActiveAt" | "contentChanged" | "orphaned">): ParsedUnit => ({
    _id: uid(),
    moduleKey,
    docId,
    status: "new" as UnitStatus,
    readPct: 0,
    masteredAt: null,
    lastActiveAt: null,
    orphaned: false,
    contentChanged: false,
    ...partial,
  });

  let order = startOrder;
  const moduleRoot = mk({
    parentUnitId: null,
    unitKey: moduleKey,
    title: moduleTitle,
    headingAnchor: null,
    orderIndex: order++,
    depth: 0,
    isLeaf: false, // tạm; set lại nếu không có heading con
    chars: null,
    contentHash: null,
    coarse: false,
  });
  const units: ParsedUnit[] = [moduleRoot];

  // Slug MỌI heading theo thứ tự (kể cả h1/h4-h6) để dedup counter khớp reader; chỉ tạo unit cho h2/h3.
  const structural: { level: 2 | 3; text: string; offset: number; anchor: string }[] = [];
  for (const h of headings) {
    const anchor = slugger.slug(h.text);
    if (h.level === 2 || h.level === 3) structural.push({ level: h.level as 2 | 3, text: h.text, offset: h.offset, anchor });
  }

  let curH2: ParsedUnit | null = null;
  let curH2Key: string | null = null;
  let h2idx = 0;
  let h3idx = 0;
  const h2HasChild = new Map<string, boolean>();

  for (let i = 0; i < structural.length; i++) {
    const node = structural[i];
    const end = i + 1 < structural.length ? structural[i + 1].offset : markdown.length;
    const chars = Math.max(0, end - node.offset);
    if (node.level === 2) {
      h2idx++;
      h3idx = 0;
      const key = extractDottedKey(node.text) ?? `${moduleNum}.${h2idx}`;
      curH2Key = key;
      curH2 = mk({
        parentUnitId: moduleRoot._id,
        unitKey: key,
        title: node.text,
        headingAnchor: node.anchor,
        orderIndex: order++,
        depth: 1,
        isLeaf: false, // set lại ở post-process nếu không có tiểu mục con
        chars,
        contentHash: hashContent(markdown.slice(node.offset, end)),
        coarse: false,
      });
      h2HasChild.set(curH2._id, false);
      units.push(curH2);
    } else {
      h3idx++;
      const key = extractDottedKey(node.text) ?? `${curH2Key ?? moduleNum}.${h3idx}`;
      const parent = curH2 ?? moduleRoot;
      if (curH2) h2HasChild.set(curH2._id, true);
      units.push(
        mk({
          parentUnitId: parent._id,
          unitKey: key,
          title: node.text,
          headingAnchor: node.anchor,
          orderIndex: order++,
          depth: curH2 ? 2 : 1,
          isLeaf: true,
          chars,
          contentHash: hashContent(markdown.slice(node.offset, end)),
          coarse: false,
        }),
      );
    }
  }

  // Post-process: h2 không có tiểu mục con → chính nó là đơn vị scope (leaf).
  for (const u of units) {
    if (u.depth === 1 && !u.isLeaf && h2HasChild.get(u._id) === false) u.isLeaf = true;
  }
  // Module không có heading con nào → coi module là leaf coarse (flat doc).
  if (structural.length === 0) {
    moduleRoot.isLeaf = true;
    moduleRoot.coarse = true;
    moduleRoot.chars = markdown.length || DEFAULT_UNIT_CHARS;
    moduleRoot.contentHash = hashContent(markdown);
  }

  return { units, nextOrder: order };
}

/**
 * Materialize toàn bộ space từ handbook: fetch raw markdown mỗi file được chọn → parse → insert.
 * selectedDocs theo thứ tự học (file 01,02,… hoặc thứ tự user xếp). handbookId để lấy signed url.
 */
export async function materializeHandbookSpace(input: {
  spaceId: string;
  handbookId: string;
  selectedDocs: { docId: string; relPath: string; title: string }[];
}): Promise<{ unitCount: number; moduleCount: number }> {
  const { spaceId, handbookId, selectedDocs } = input;
  const urls = await getAssetUrls(handbookId);
  let order = 0;
  const allUnits: ParsedUnit[] = [];
  let moduleCount = 0;

  for (let i = 0; i < selectedDocs.length; i++) {
    const d = selectedDocs[i];
    const moduleKey = moduleKeyFromRelPath(d.relPath, i + 1);
    const url = urls[d.relPath];
    let markdown = "";
    if (url) {
      try {
        const res = await fetch(url);
        if (res.ok) markdown = await res.text();
      } catch {
        markdown = "";
      }
    }
    const { units, nextOrder } = parseUnitsFromMarkdown({
      markdown,
      moduleKey,
      moduleTitle: d.title,
      docId: d.docId,
      startOrder: order,
    });
    order = nextOrder;
    allUnits.push(...units);
    moduleCount++;
  }

  if (allUnits.length) await insertStudyUnits(spaceId, allUnits);
  await setSpaceSources(
    spaceId,
    selectedDocs.map((d) => d.docId),
  );
  return { unitCount: allUnits.length, moduleCount };
}
