import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

// POST: { downloadUrl, byteStart, byteEnd, headerBytes?, mimeType, chunkIndex, timeOffsetSeconds, language? }
// Fetches audio range from R2, forwards to Groq Whisper, returns segments + language.
// Groq API key stays server-side.
export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });

  let body: {
    downloadUrl: string;
    byteStart: number;
    byteEnd: number;
    headerBytes?: number;
    mimeType: string;
    chunkIndex: number;
    timeOffsetSeconds: number;
    language?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { downloadUrl, byteStart, byteEnd, headerBytes, mimeType, chunkIndex, timeOffsetSeconds, language } = body;

  // Validate URL is from allowed hosts (same allowlist as proxy-audio)
  let parsed: URL;
  try { parsed = new URL(downloadUrl); } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  const h = parsed.hostname;
  const allowed =
    h.endsWith(".r2.cloudflarestorage.com") ||
    h.endsWith(".cloudflare.com") ||
    h.endsWith(".convex.cloud") ||
    h.endsWith(".convex.site") ||
    h.endsWith(".amazonaws.com");
  if (!allowed) return NextResponse.json({ error: "URL not allowed" }, { status: 403 });

  // headerBytes > 0 means getWebmChunks found a WebM Cluster — treat as WebM regardless of mimeType
  const isWebm = mimeType.includes("webm") || mimeType.includes("ogg") || (headerBytes != null && headerBytes > 0);

  // Fetch audio bytes (range only)
  let part: Uint8Array;
  try {
      if (isWebm && headerBytes && chunkIndex > 0) {
      // Fetch EBML header (bytes 0..headerBytes-1) + cluster data separately, then merge
      const clusterRes = await fetch(downloadUrl, { headers: { Range: `bytes=${byteStart}-${byteEnd - 1}` } });
      if (!clusterRes.ok && clusterRes.status !== 206) throw new Error(`Cluster fetch ${clusterRes.status}`);
      const cluster = new Uint8Array(await clusterRes.arrayBuffer());

      // Fetch full header separately
      const headerRes = await fetch(downloadUrl, { headers: { Range: `bytes=0-${headerBytes - 1}` } });
      if (!headerRes.ok && headerRes.status !== 206) throw new Error(`Header fetch ${headerRes.status}`);
      const headerFull = new Uint8Array(await headerRes.arrayBuffer());
      // Slice to exactly headerBytes in case R2 returns full file (status 200)
      const header = headerFull.slice(0, headerBytes);

      console.log(`[transcribe-chunk] chunk=${chunkIndex} header=${header.byteLength} cluster=${cluster.byteLength} clusterStatus=${clusterRes.status} headerStatus=${headerRes.status}`);
      part = new Uint8Array(header.length + cluster.length);
      part.set(header, 0);
      part.set(cluster, header.length);
    } else {
      // chunk 0: fetch from byte 0 (includes EBML header + first clusters naturally)
      const start = chunkIndex === 0 && isWebm ? 0 : byteStart;
      const rangeRes = await fetch(downloadUrl, { headers: { Range: `bytes=${start}-${byteEnd - 1}` } });
      console.log(`[transcribe-chunk] chunk=${chunkIndex} rangeRes=${rangeRes.status} range=${start}-${byteEnd - 1}`);
      if (!rangeRes.ok && rangeRes.status !== 206) throw new Error(`Fetch ${rangeRes.status}`);
      part = new Uint8Array(await rangeRes.arrayBuffer());
    }
  } catch (e) {
    return NextResponse.json({ error: `Fetch failed: ${e}` }, { status: 502 });
  }

  console.log(`[transcribe-chunk] chunk=${chunkIndex} part size=${part.byteLength} bytes (${(part.byteLength/1024/1024).toFixed(1)}MB)`);

  // Send to Groq Whisper — normalize MIME type (Groq only accepts plain types, no codecs param)
  const groqMime = isWebm ? "audio/webm" : mimeType.split(";")[0].trim();
  const ext = isWebm ? "webm" : (groqMime.split("/")[1] ?? "audio");
  const partBuf = part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer;
  const blob = new Blob([partBuf], { type: groqMime });
  const formData = new FormData();
  formData.append("file", blob, `chunk_${chunkIndex}.${ext}`);
  console.log(`[transcribe-chunk] chunk=${chunkIndex} groqMime=${groqMime} ext=${ext}`);
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "verbose_json");
  if (language) formData.append("language", language);

  let groqRes: Response;
  try {
    groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
  } catch (e) {
    return NextResponse.json({ error: `Groq fetch failed: ${e}` }, { status: 502 });
  }

  if (!groqRes.ok) {
    const err = await groqRes.text();
    return NextResponse.json({ error: `Groq error ${groqRes.status}: ${err}` }, { status: 502 });
  }

  const data = await groqRes.json() as {
    segments?: { start: number; end: number; text: string }[];
    language?: string;
  };

  const segments = (data.segments ?? []).map((s) => ({
    start: s.start + timeOffsetSeconds,
    end: s.end + timeOffsetSeconds,
    text: s.text.trim(),
  }));

  return NextResponse.json({ segments, language: data.language ?? language ?? "vi" });
}
