"use node";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

// Nhận base64 audio chunk, gửi Groq, trả về segments
export const transcribeChunk = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
    fileName: v.string(),
    chunkIndex: v.number(),
    timeOffsetSeconds: v.number(),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("[transcribeChunk] start, chunkIndex:", args.chunkIndex, "base64 length:", args.audioBase64.length);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY not configured");
    console.log("[transcribeChunk] apiKey ok, decoding audio...");

    const binaryStr = atob(args.audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: args.mimeType });

    const formData = new FormData();
    formData.append("file", blob, args.fileName);
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "verbose_json");
    if (args.language) formData.append("language", args.language);

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error: ${err}`);
    }

    const data = await res.json() as {
      segments?: { start: number; end: number; text: string }[];
      language?: string;
    };

    const segments = (data.segments ?? []).map((s) => ({
      start: s.start + args.timeOffsetSeconds,
      end: s.end + args.timeOffsetSeconds,
      text: s.text.trim(),
    }));

    return {
      segments,
      language: data.language ?? "vi",
    };
  },
});

// Split a Buffer at webm Cluster boundaries so each part is a valid webm fragment.
// Each part reuses the EBML+Segment header from the beginning of the file.
function splitWebmAtClusters(buf: Uint8Array, maxBytes: number): Uint8Array[] {
  const CLUSTER_ID = [0x1F, 0x43, 0xB6, 0x75];
  // Find the offset of the first Cluster — everything before is the webm header
  let headerEnd = -1;
  for (let i = 0; i < Math.min(buf.length - 4, 64 * 1024); i++) {
    if (buf[i] === CLUSTER_ID[0] && buf[i+1] === CLUSTER_ID[1] &&
        buf[i+2] === CLUSTER_ID[2] && buf[i+3] === CLUSTER_ID[3]) {
      headerEnd = i;
      break;
    }
  }
  if (headerEnd < 0) return [buf]; // Can't find clusters — return as-is

  const header = buf.slice(0, headerEnd);
  // Collect all cluster start positions
  const clusterOffsets: number[] = [headerEnd];
  for (let i = headerEnd + 4; i < buf.length - 4; i++) {
    if (buf[i] === CLUSTER_ID[0] && buf[i+1] === CLUSTER_ID[1] &&
        buf[i+2] === CLUSTER_ID[2] && buf[i+3] === CLUSTER_ID[3]) {
      clusterOffsets.push(i);
      i += 3;
    }
  }
  clusterOffsets.push(buf.length); // sentinel

  const parts: Uint8Array[] = [];
  let partStart = 0; // index into clusterOffsets

  while (partStart < clusterOffsets.length - 1) {
    let partEnd = partStart + 1;
    // Accumulate clusters until we'd exceed maxBytes (accounting for header prepended)
    while (partEnd < clusterOffsets.length - 1) {
      const size = header.length + (clusterOffsets[partEnd + 1] - clusterOffsets[partStart]);
      if (size > maxBytes) break;
      partEnd++;
    }
    const clusterData = buf.slice(clusterOffsets[partStart], clusterOffsets[partEnd]);
    // Concatenate header + clusterData into a single Uint8Array
    const merged = new Uint8Array(header.length + clusterData.length);
    merged.set(header, 0);
    merged.set(clusterData, header.length);
    parts.push(merged);
    partStart = partEnd;
  }

  return parts.length > 0 ? parts : [buf];
}

// Step 1: Download file, find cluster boundaries, return byte ranges for each chunk.
// Client calls this once, then calls transcribeWebmChunk for each range.
export const getWebmChunks = action({
  args: {
    downloadUrl: v.string(),
    mimeType: v.string(),
    fileSizeBytes: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    // Target ~5 minutes per chunk. If we know duration+size, compute bytes-per-minute.
    // Cap chunk at 5MB to avoid Gemini token limit issues.
    const TARGET_CHUNK_SECS = 5 * 60;
    const MAX_CHUNK_BYTES = 5 * 1024 * 1024;
    let CHUNK_SIZE = MAX_CHUNK_BYTES;
    if (args.fileSizeBytes && args.durationSeconds && args.durationSeconds > 0) {
      const bytesPerSec = args.fileSizeBytes / args.durationSeconds;
      CHUNK_SIZE = Math.min(Math.ceil(bytesPerSec * TARGET_CHUNK_SECS), MAX_CHUNK_BYTES);
    }

    // Get file size — prefer from DB, fallback to Range probe
    let totalBytes = args.fileSizeBytes ?? 0;
    if (!totalBytes) {
      const probeRes = await fetch(args.downloadUrl, { headers: { Range: "bytes=0-0" } });
      const contentRange = probeRes.headers.get("content-range");
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) totalBytes = parseInt(match[1], 10);
      }
      if (!totalBytes) {
        const cl = probeRes.headers.get("content-length");
        if (cl) totalBytes = parseInt(cl, 10);
      }
    }

    if (!totalBytes) {
      return { chunks: [{ byteStart: 0, byteEnd: CHUNK_SIZE }], totalBytes: 0, headerBytes: 0 };
    }

    // Simple even split — no cluster parsing needed.
    // transcribe-chunk route prepends header to each chunk so Groq gets valid webm.
    // First, find where EBML header ends (first Cluster element at 0x1F43B675).
    const headBuf = new Uint8Array(await (await fetch(args.downloadUrl, {
      headers: { Range: "bytes=0-65535" },
    })).arrayBuffer());

    const CLUSTER_ID = [0x1F, 0x43, 0xB6, 0x75];
    let headerBytes = 0;
    for (let i = 0; i < headBuf.length - 4; i++) {
      if (headBuf[i] === CLUSTER_ID[0] && headBuf[i+1] === CLUSTER_ID[1] &&
          headBuf[i+2] === CLUSTER_ID[2] && headBuf[i+3] === CLUSTER_ID[3]) {
        headerBytes = i;
        break;
      }
    }
    // headerBytes=0 means no cluster found — split from byte 0, no header prepend

    // Chunk 0 always starts at byte 0 (includes EBML header naturally).
    // Subsequent chunks start at headerBytes + N*CHUNK_SIZE so each gets cluster data only
    // (transcribe-chunk route will prepend header bytes 0..headerBytes-1 for chunks > 0).
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

    console.log(`[getWebmChunks] totalBytes=${totalBytes} headerBytes=${headerBytes} numChunks=${chunks.length}`);
    return { chunks, totalBytes, headerBytes };
  },
});

// Step 2: Download only the needed byte range + header, send to Groq.
// One action call per chunk — stays well within Convex timeout.
export const transcribeWebmChunk = action({
  args: {
    downloadUrl: v.string(),
    mimeType: v.string(),
    byteStart: v.number(),
    byteEnd: v.number(),
    headerBytes: v.optional(v.number()),
    chunkIndex: v.number(),
    timeOffsetSeconds: v.number(),
    language: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY not configured");

    const isWebm = args.mimeType.includes("webm") || args.mimeType.includes("ogg");
    let part: Uint8Array;

    console.log(`[transcribeWebmChunk] chunk=${args.chunkIndex} bytes=${args.byteStart}-${args.byteEnd} headerBytes=${args.headerBytes}`);

    if (isWebm && args.headerBytes && args.byteStart > 0) {
      const [headerRes, clusterRes] = await Promise.all([
        fetch(args.downloadUrl, { headers: { Range: `bytes=0-${args.headerBytes - 1}` } }),
        fetch(args.downloadUrl, { headers: { Range: `bytes=${args.byteStart}-${args.byteEnd - 1}` } }),
      ]);
      if (!headerRes.ok && headerRes.status !== 206) throw new Error(`Header fetch failed: ${headerRes.status}`);
      if (!clusterRes.ok && clusterRes.status !== 206) throw new Error(`Cluster fetch failed: ${clusterRes.status}`);
      const header = new Uint8Array(await headerRes.arrayBuffer());
      const clusterData = new Uint8Array(await clusterRes.arrayBuffer());
      part = new Uint8Array(header.length + clusterData.length);
      part.set(header, 0);
      part.set(clusterData, header.length);
    } else {
      const rangeRes = await fetch(args.downloadUrl, {
        headers: { Range: `bytes=${args.byteStart}-${args.byteEnd - 1}` },
      });
      if (!rangeRes.ok && rangeRes.status !== 206) throw new Error(`Fetch failed: ${rangeRes.status}`);
      part = new Uint8Array(await rangeRes.arrayBuffer());
    }

    console.log(`[transcribeWebmChunk] chunk=${args.chunkIndex} downloaded ${part.byteLength} bytes, calling Groq...`);

    const ext = isWebm ? "webm" : "audio";
    const partBuf = part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer;
    const blob = new Blob([partBuf], { type: args.mimeType });
    const formData = new FormData();
    formData.append("file", blob, `chunk_${args.chunkIndex}.${ext}`);
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "verbose_json");
    if (args.language) formData.append("language", args.language);

    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    console.log(`[transcribeWebmChunk] chunk=${args.chunkIndex} Groq status=${groqRes.status}`);

    if (!groqRes.ok) {
      const err = await groqRes.text();
      throw new Error(`Groq error: ${err}`);
    }

    const data = await groqRes.json() as {
      segments?: { start: number; end: number; text: string }[];
      language?: string;
    };

    const segments = (data.segments ?? []).map((s) => ({
      start: s.start + args.timeOffsetSeconds,
      end: s.end + args.timeOffsetSeconds,
      text: s.text.trim(),
    }));

    return { segments, language: data.language ?? args.language ?? "vi" };
  },
});

// Dịch segments từ transcript đã lưu trong DB — dùng transcriptId để tránh vượt arg size limit
export const translateSegments = action({
  args: {
    transcriptId: v.id("transcripts"),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY not configured");

    const transcript = await ctx.runQuery(internal.transcripts.queries.getByIdInternal, {
      transcriptId: args.transcriptId,
    });
    if (!transcript?.segments?.length) throw new Error("No segments found");

    const segments = transcript.segments;
    const targetName = args.targetLanguage === "vi" ? "Vietnamese" : "English";

    // Batch 50 segments mỗi lần để tránh vượt token limit
    const BATCH_SIZE = 50;
    const allTranslated: { start: number; end: number; text: string }[] = [];

    for (let b = 0; b < segments.length; b += BATCH_SIZE) {
      const batch = segments.slice(b, b + BATCH_SIZE);
      const inputJson = JSON.stringify(batch.map((s, i) => ({ i: b + i, t: s.text })));

      const prompt = `Translate the following transcript segments to ${targetName}.
Keep the same meaning and tone. Return ONLY a JSON array with the same structure, replacing "t" with the translation.
Do not add explanations. Input: ${inputJson}`;

      const res = await fetch(GROQ_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 8192,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq translate error: ${err}`);
      }

      const data = await res.json() as {
        choices: { message: { content: string } }[];
      };
      const content = data.choices[0]?.message?.content ?? "[]";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Invalid translation response");

      const translated = JSON.parse(jsonMatch[0]) as { i: number; t: string }[];

      for (let i = 0; i < batch.length; i++) {
        const match = translated.find((x) => x.i === b + i);
        allTranslated.push({
          start: batch[i].start,
          end: batch[i].end,
          text: match?.t ?? batch[i].text,
        });
      }
    }

    return allTranslated;
  },
});
