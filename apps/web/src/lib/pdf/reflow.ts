"use client";
// PDF → đoạn văn theo trang (chế độ "Dạng chữ" + Nghe bài).
// Dựng lại dòng từ toạ độ text item, gộp dòng thành đoạn theo khoảng cách dòng,
// nối chữ bị gạch nối cuối dòng, bỏ dòng chỉ có số trang. Không có chữ → PDF scan.
import { pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { blocksFromTextItems, type ReflowBlock, type PdfTextItem } from "./reflowCore";

export type { ReflowBlock };
export type ReflowPage = { page: number; blocks: ReflowBlock[] };

if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

/** PDFViewer đăng ký proxy đã mở để khỏi tải/parse lại file. */
const proxies = new Map<string, PDFDocumentProxy>();
export function registerPdfProxy(docId: string, pdf: PDFDocumentProxy) {
  proxies.set(docId, pdf);
}
/** Gọi khi viewer unmount — react-pdf huỷ proxy, dùng lại sẽ lỗi. */
export function unregisterPdfProxy(docId: string) {
  proxies.delete(docId);
}

async function extractPage(pdf: PDFDocumentProxy, n: number): Promise<ReflowPage> {
  const page = await pdf.getPage(n);
  const content = await page.getTextContent();
  const items: PdfTextItem[] = [];
  for (const raw of content.items) {
    if (!("str" in raw)) continue;
    const t = raw.transform as number[];
    items.push({ str: raw.str, x: t[4], y: t[5], h: Math.abs(raw.height || t[3]), w: raw.width, eol: !!raw.hasEOL });
  }
  page.cleanup();
  return { page: n, blocks: blocksFromTextItems(items) };
}

const cache = new Map<string, Promise<ReflowPage[]>>();

/** Trích toàn bộ PDF thành đoạn theo trang. Cache theo docId trong phiên. */
export function getPdfReflow(docId: string, url: string): Promise<ReflowPage[]> {
  const hit = cache.get(docId);
  if (hit) return hit;
  const p = (async () => {
    const pdf = proxies.get(docId) ?? (await pdfjs.getDocument(url).promise);
    const pages: ReflowPage[] = [];
    for (let i = 1; i <= pdf.numPages; i++) pages.push(await extractPage(pdf, i));
    return pages;
  })();
  p.catch(() => cache.delete(docId));
  cache.set(docId, p);
  return p;
}
