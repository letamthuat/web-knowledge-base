"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

// Nhận 1 chunk audio (base64) từ client, gửi lên Groq, trả về segments
export const transcribeChunk = action({
  args: {
    audioBase64: v.string(),   // base64 encoded audio chunk
    mimeType: v.string(),      // "audio/mp4", "audio/webm", etc.
    fileName: v.string(),
    chunkIndex: v.number(),
    timeOffsetSeconds: v.number(), // offset của chunk này so với đầu file
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY not configured");

    // Decode base64 → binary
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
    formData.append("language", "vi"); // ưu tiên tiếng Việt, Groq tự detect nếu sai

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error: ${err}`);
    }

    const data = await res.json();

    // Shift timestamps bằng timeOffset
    const segments = (data.segments ?? []).map((s: {
      start: number; end: number; text: string;
    }) => ({
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
