import JSZip from "jszip";
import { SUPPORTED_EXTENSIONS } from "@/lib/storage";
import { parseTar, gunzipBrowser } from "./tarImport";

export interface ZipEntry {
  relPath: string;
  blob: Blob;
  format: string;
  mimeType: string;
  size: number;
}

const MIME_BY_FORMAT: Record<string, string> = {
  markdown: "text/markdown",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  epub: "application/epub+zip",
  web_clip: "text/html",
};

const IMAGE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
};

export function extToFormat(name: string): string | null {
  const ext = "." + (name.split(".").pop()?.toLowerCase() ?? "");
  return SUPPORTED_EXTENSIONS[ext] ?? null;
}

function mimeFor(relPath: string, format: string): string {
  const ext = relPath.split(".").pop()?.toLowerCase() ?? "";
  if (format === "image") return IMAGE_MIME[ext] ?? "application/octet-stream";
  return MIME_BY_FORMAT[format] ?? "application/octet-stream";
}

/** Nếu mọi file nằm dưới 1 thư mục gốc duy nhất → trả prefix đó để strip. */
export function detectCommonPrefix(paths: string[]): string {
  if (paths.length === 0) return "";
  const firstSeg = paths[0].split("/")[0];
  if (!firstSeg) return "";
  const allShareRoot = paths.every((p) => p.split("/")[0] === firstSeg && p.includes("/"));
  return allShareRoot ? firstSeg + "/" : "";
}

function isJunk(path: string): boolean {
  const base = path.split("/").pop() ?? "";
  return (
    path.startsWith("__MACOSX/") ||
    base === ".DS_Store" ||
    base === "Thumbs.db" ||
    base.startsWith("._")
  );
}

// ─── Internal: convert raw file list to ZipEntry[] ────────────────────────────

function buildEntries(rawFiles: { path: string; data: Uint8Array }[]): {
  entries: ZipEntry[];
  skipped: number;
} {
  const cleanPaths = rawFiles.map((f) => f.path).filter((p) => !isJunk(p));
  const prefix = detectCommonPrefix(cleanPaths);

  const entries: ZipEntry[] = [];
  let skipped = 0;

  for (const { path, data } of rawFiles) {
    if (isJunk(path)) { skipped++; continue; }
    const relPath = (prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path)
      .replace(/^\/+/, "");
    if (!relPath) { skipped++; continue; }
    const format = extToFormat(relPath);
    if (!format) { skipped++; continue; }
    if (data.length === 0) { skipped++; continue; }
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    const blob = new Blob([ab]);
    entries.push({ relPath, blob, format, mimeType: mimeFor(relPath, format), size: data.length });
  }

  return { entries, skipped };
}

// ─── Format parsers ───────────────────────────────────────────────────────────

export async function parseZip(file: File): Promise<{ entries: ZipEntry[]; skipped: number }> {
  const zip = await JSZip.loadAsync(file);
  const rawFiles: { path: string; data: Uint8Array }[] = [];
  const fileObjs: { path: string; obj: JSZip.JSZipObject }[] = [];
  zip.forEach((path, obj) => { if (!obj.dir) fileObjs.push({ path, obj }); });
  for (const { path, obj } of fileObjs) {
    const ab = await obj.async("arraybuffer");
    rawFiles.push({ path, data: new Uint8Array(ab) });
  }
  return buildEntries(rawFiles);
}

async function parseTarFile(file: File): Promise<{ entries: ZipEntry[]; skipped: number }> {
  const buf = await file.arrayBuffer();
  const rawFiles = parseTar(buf);
  return buildEntries(rawFiles);
}

async function parseTarGz(file: File): Promise<{ entries: ZipEntry[]; skipped: number }> {
  const compressed = await file.arrayBuffer();
  const decompressed = await gunzipBrowser(compressed);
  const rawFiles = parseTar(decompressed);
  return buildEntries(rawFiles);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Unified archive parser — detects format from file name automatically. */
export async function parseArchive(file: File): Promise<{ entries: ZipEntry[]; skipped: number }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) return parseTarGz(file);
  if (name.endsWith(".tar")) return parseTarFile(file);
  return parseZip(file); // default: .zip
}

/** File input accept string */
export const ARCHIVE_ACCEPT = ".zip,.tar,.tar.gz,.tgz,application/zip,application/x-tar,application/gzip";

/** Human-readable list of supported formats */
export const ARCHIVE_FORMATS = ["ZIP", "TAR", "TAR.GZ", "TGZ"];
