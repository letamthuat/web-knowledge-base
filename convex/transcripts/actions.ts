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
