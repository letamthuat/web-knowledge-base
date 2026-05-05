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
  },
  handler: async (_ctx, args) => {
    const res = await fetch(args.downloadUrl);
    if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buf = new Uint8Array(arrayBuffer);
    const totalBytes = buf.length;

    const GROQ_MAX = 24 * 1024 * 1024;
    const isWebm = args.mimeType.includes("webm") || args.mimeType.includes("ogg");

    if (!isWebm) {
      // Non-webm: single chunk covering whole file
      return { chunks: [{ byteStart: 0, byteEnd: totalBytes }], totalBytes };
    }

    // Find cluster offsets
    const CLUSTER_ID = [0x1F, 0x43, 0xB6, 0x75];
    let headerEnd = -1;
    for (let i = 0; i < Math.min(buf.length - 4, 64 * 1024); i++) {
      if (buf[i] === CLUSTER_ID[0] && buf[i+1] === CLUSTER_ID[1] &&
          buf[i+2] === CLUSTER_ID[2] && buf[i+3] === CLUSTER_ID[3]) {
        headerEnd = i; break;
      }
    }
    if (headerEnd < 0) return { chunks: [{ byteStart: 0, byteEnd: totalBytes }], totalBytes };

    const headerBytes = headerEnd;
    const clusterOffsets: number[] = [headerEnd];
    for (let i = headerEnd + 4; i < buf.length - 4; i++) {
      if (buf[i] === CLUSTER_ID[0] && buf[i+1] === CLUSTER_ID[1] &&
          buf[i+2] === CLUSTER_ID[2] && buf[i+3] === CLUSTER_ID[3]) {
        clusterOffsets.push(i); i += 3;
      }
    }
    clusterOffsets.push(buf.length);

    // Group clusters into chunks ≤ GROQ_MAX, return as byte ranges
    const chunks: { byteStart: number; byteEnd: number }[] = [];
    let partStart = 0;
    while (partStart < clusterOffsets.length - 1) {
      let partEnd = partStart + 1;
      while (partEnd < clusterOffsets.length - 1) {
        const size = headerBytes + (clusterOffsets[partEnd + 1] - clusterOffsets[partStart]);
        if (size > GROQ_MAX) break;
        partEnd++;
      }
      chunks.push({ byteStart: clusterOffsets[partStart], byteEnd: clusterOffsets[partEnd] });
      partStart = partEnd;
    }

    return { chunks: chunks.length > 0 ? chunks : [{ byteStart: 0, byteEnd: totalBytes }], totalBytes, headerBytes };
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

    const res = await fetch(args.downloadUrl);
    if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
    const full = new Uint8Array(await res.arrayBuffer());

    const isWebm = args.mimeType.includes("webm") || args.mimeType.includes("ogg");
    let part: Uint8Array;

    if (isWebm && args.headerBytes && args.byteStart > 0) {
      // Prepend EBML+Segment header so this chunk is a valid webm file
      const header = full.slice(0, args.headerBytes);
      const clusterData = full.slice(args.byteStart, args.byteEnd);
      part = new Uint8Array(header.length + clusterData.length);
      part.set(header, 0);
      part.set(clusterData, header.length);
    } else {
      part = full.slice(args.byteStart, args.byteEnd);
    }

    const ext = isWebm ? "webm" : "audio";
    // Copy to a plain ArrayBuffer to satisfy TypeScript's strict BlobPart type
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
