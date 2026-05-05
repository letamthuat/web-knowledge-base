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

// Server-side transcription: download audio from URL, split at webm cluster boundaries,
// send each part to Groq. Avoids client-side decodeAudioData which fails for live-recorded webm.
export const transcribeFromUrl = action({
  args: {
    downloadUrl: v.string(),
    mimeType: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY not configured");

    const res = await fetch(args.downloadUrl);
    if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buf = new Uint8Array(arrayBuffer);

    const GROQ_MAX = 24 * 1024 * 1024; // 24MB
    const isWebm = args.mimeType.includes("webm") || args.mimeType.includes("ogg");
    const parts: Uint8Array[] = isWebm ? splitWebmAtClusters(buf, GROQ_MAX) : [buf];

    const allSegments: { start: number; end: number; text: string }[] = [];
    let detectedLanguage = args.language ?? "vi";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const blob = new Blob([new Uint8Array(part)], { type: args.mimeType });
      const ext = isWebm ? "webm" : "audio";
      const formData = new FormData();
      formData.append("file", blob, `chunk_${i}.${ext}`);
      formData.append("model", "whisper-large-v3");
      formData.append("response_format", "verbose_json");
      if (args.language) formData.append("language", args.language);

      if (i > 0) await new Promise((r) => setTimeout(r, 3100));

      const groqRes = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!groqRes.ok) {
        const err = await groqRes.text();
        console.error(`[transcribeFromUrl] chunk ${i} Groq error:`, err);
        continue; // skip bad chunk, keep going
      }

      const data = await groqRes.json() as {
        segments?: { start: number; end: number; text: string }[];
        language?: string;
      };

      // Estimate time offset for this part based on accumulated segment end times
      const timeOffset = allSegments.length > 0
        ? allSegments[allSegments.length - 1].end
        : 0;

      const segs = (data.segments ?? []).map((s) => ({
        start: s.start + timeOffset,
        end: s.end + timeOffset,
        text: s.text.trim(),
      }));
      allSegments.push(...segs);
      if (data.language) detectedLanguage = data.language;
    }

    return { segments: allSegments, language: detectedLanguage };
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
