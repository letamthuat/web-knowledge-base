// POST { downloadUrl, mimeType, fileSizeBytes?, durationSeconds? }
// → { chunks:[{byteStart,byteEnd}], totalBytes, headerBytes }
// Tính ranh giới chunk audio/video (EBML Cluster cho webm) bằng Range request.
// Chạy server-side để tránh CORS Range trên R2. Thay convex transcripts.actions.getWebmChunks.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { downloadUrl, mimeType, fileSizeBytes, durationSeconds } = (await request.json()) as {
    downloadUrl: string; mimeType: string; fileSizeBytes?: number; durationSeconds?: number;
  };

  const TARGET_CHUNK_SECS = 3 * 60;
  const MAX_CHUNK_BYTES = 3 * 1024 * 1024;
  let CHUNK_SIZE = MAX_CHUNK_BYTES;
  if (fileSizeBytes && durationSeconds && durationSeconds > 0) {
    CHUNK_SIZE = Math.min(Math.ceil((fileSizeBytes / durationSeconds) * TARGET_CHUNK_SECS), MAX_CHUNK_BYTES);
  }

  // Tổng bytes: ưu tiên DB, fallback probe Range.
  let totalBytes = fileSizeBytes ?? 0;
  if (!totalBytes) {
    const probe = await fetch(downloadUrl, { headers: { Range: "bytes=0-0" } });
    const cr = probe.headers.get("content-range");
    const m = cr?.match(/\/(\d+)$/);
    if (m) totalBytes = parseInt(m[1], 10);
    if (!totalBytes) {
      const cl = probe.headers.get("content-length");
      if (cl) totalBytes = parseInt(cl, 10);
    }
  }

  if (!totalBytes) {
    return NextResponse.json({ chunks: [{ byteStart: 0, byteEnd: CHUNK_SIZE }], totalBytes: 0, headerBytes: 0 });
  }

  // Video: chia byte phẳng (không có EBML).
  if (mimeType.startsWith("video/")) {
    const numChunks = Math.ceil(totalBytes / CHUNK_SIZE);
    const chunks = Array.from({ length: numChunks }, (_, c) => ({
      byteStart: c * CHUNK_SIZE,
      byteEnd: Math.min((c + 1) * CHUNK_SIZE, totalBytes),
    }));
    return NextResponse.json({ chunks, totalBytes, headerBytes: 0 });
  }

  // WebM/audio: tìm Cluster đầu tiên (0x1F43B675) = ranh giới header.
  const headBuf = new Uint8Array(
    await (await fetch(downloadUrl, { headers: { Range: "bytes=0-65535" } })).arrayBuffer(),
  );
  const C = [0x1f, 0x43, 0xb6, 0x75];
  let headerBytes = 0;
  for (let i = 0; i < headBuf.length - 4; i++) {
    if (headBuf[i] === C[0] && headBuf[i + 1] === C[1] && headBuf[i + 2] === C[2] && headBuf[i + 3] === C[3]) {
      headerBytes = i;
      break;
    }
  }

  const dataStart = headerBytes > 0 ? headerBytes : 0;
  const numChunks = Math.ceil((totalBytes - dataStart) / CHUNK_SIZE);
  const chunks: { byteStart: number; byteEnd: number }[] = [];
  for (let c = 0; c < numChunks; c++) {
    const byteStart = c === 0 ? 0 : dataStart + c * CHUNK_SIZE;
    const byteEnd = c === 0
      ? Math.min(dataStart + CHUNK_SIZE, totalBytes)
      : Math.min(dataStart + (c + 1) * CHUNK_SIZE, totalBytes);
    chunks.push({ byteStart, byteEnd });
  }

  return NextResponse.json({ chunks, totalBytes, headerBytes });
}
