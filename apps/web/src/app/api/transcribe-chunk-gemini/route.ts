import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Fallback chain: non-thinking models only — thinking models return box_2d garbage for audio
const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-3.1-flash-lite",
];

interface Segment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

// POST: { downloadUrl, byteStart, byteEnd, headerBytes?, mimeType, chunkIndex, timeOffsetSeconds, language?, diarization?, geminiApiKey?, geminiModels? }
// Fetches audio range from R2, sends to Gemini Flash as base64 inline, returns segments + language.
export async function POST(req: NextRequest) {
  let body: {
    downloadUrl: string;
    byteStart: number;
    byteEnd: number;
    headerBytes?: number;
    mimeType: string;
    chunkIndex: number;
    timeOffsetSeconds: number;
    language?: string;
    diarization?: boolean;
    geminiApiKey?: string;
    geminiModels?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { downloadUrl, byteStart, byteEnd, headerBytes, mimeType, chunkIndex, timeOffsetSeconds, language, diarization, geminiApiKey: userApiKey, geminiModels: userModels } = body;

  // Use user's key/models if provided, else fall back to env vars
  const apiKey = (userApiKey && userApiKey.trim()) ? userApiKey.trim() : process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  const GEMINI_MODELS_ACTIVE = (userModels && userModels.length > 0) ? userModels : GEMINI_MODELS;

  // Validate URL
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

  const isWebm = mimeType.includes("webm") || mimeType.includes("ogg") || (headerBytes != null && headerBytes > 0);

  // Fetch audio bytes (same logic as Groq route — prepend EBML header for chunks > 0)
  let part: Uint8Array;
  try {
    if (isWebm && headerBytes && chunkIndex > 0) {
      const clusterRes = await fetch(downloadUrl, { headers: { Range: `bytes=${byteStart}-${byteEnd - 1}` } });
      if (!clusterRes.ok && clusterRes.status !== 206) throw new Error(`Cluster fetch ${clusterRes.status}`);
      const cluster = new Uint8Array(await clusterRes.arrayBuffer());

      const headerRes = await fetch(downloadUrl, { headers: { Range: `bytes=0-${headerBytes - 1}` } });
      if (!headerRes.ok && headerRes.status !== 206) throw new Error(`Header fetch ${headerRes.status}`);
      const headerFull = new Uint8Array(await headerRes.arrayBuffer());
      const header = headerFull.slice(0, headerBytes);

      console.log(`[transcribe-gemini] chunk=${chunkIndex} header=${header.byteLength} cluster=${cluster.byteLength}`);
      part = new Uint8Array(header.length + cluster.length);
      part.set(header, 0);
      part.set(cluster, header.length);
    } else {
      const start = chunkIndex === 0 && isWebm ? 0 : byteStart;
      const rangeRes = await fetch(downloadUrl, { headers: { Range: `bytes=${start}-${byteEnd - 1}` } });
      console.log(`[transcribe-gemini] chunk=${chunkIndex} rangeRes=${rangeRes.status} range=${start}-${byteEnd - 1}`);
      if (!rangeRes.ok && rangeRes.status !== 206) throw new Error(`Fetch ${rangeRes.status}`);
      part = new Uint8Array(await rangeRes.arrayBuffer());
    }
  } catch (e) {
    return NextResponse.json({ error: `Fetch failed: ${e}` }, { status: 502 });
  }

  console.log(`[transcribe-gemini] chunk=${chunkIndex} size=${part.byteLength} bytes (${(part.byteLength / 1024 / 1024).toFixed(1)}MB)`);

  // Convert to base64
  let base64Audio: string;
  try {
    const partBuf = part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer;
    base64Audio = Buffer.from(partBuf).toString("base64");
  } catch (e) {
    return NextResponse.json({ error: `Base64 encode failed: ${e}` }, { status: 500 });
  }

  const geminiMime = isWebm ? "audio/webm" : mimeType.split(";")[0].trim();
  const lang = language ?? "vi";

  const prompt = diarization
    ? `Transcribe this audio. Language is ${lang} unless detected otherwise.
Identify different speakers as SPEAKER_1, SPEAKER_2, etc.
Return ONLY a JSON array (no markdown, no explanation):
[{"start": 0.0, "end": 5.2, "speaker": "SPEAKER_1", "text": "..."}]
Times in seconds from start of this audio clip.`
    : `Transcribe this audio. Language is ${lang} unless detected otherwise.
Return ONLY a JSON array (no markdown, no explanation):
[{"start": 0.0, "end": 5.2, "text": "..."}]
Times in seconds from start of this audio clip.`;

  const requestBody = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: geminiMime, data: base64Audio } },
        { text: prompt },
      ],
    }],
    generationConfig: { temperature: 0 },
  });

  // Try each model in fallback chain, with retries — skip to next on 429/503
  let rawText = "";
  let lastError = "";
  let succeeded = false;
  const MAX_CHAIN_ATTEMPTS = 3; // retry the whole chain up to 3 times if all 503

  outer: for (let attempt = 0; attempt < MAX_CHAIN_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const waitMs = 20000 * attempt;
      console.log(`[transcribe-gemini] chunk=${chunkIndex} all models failed, retry chain in ${waitMs / 1000}s (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, waitMs));
    }

    for (const model of GEMINI_MODELS_ACTIVE) {
      let geminiRes: Response;
      try {
        geminiRes = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });
      } catch (e) {
        lastError = `Network error on ${model}: ${e}`;
        console.warn(`[transcribe-gemini] chunk=${chunkIndex} ${lastError}`);
        continue;
      }

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json() as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        console.log(`[transcribe-gemini] chunk=${chunkIndex} model=${model} OK (attempt ${attempt + 1})`);
        succeeded = true;
        break outer;
      }

      const errText = await geminiRes.text();
      lastError = `Gemini error ${geminiRes.status} on ${model}: ${errText}`;
      const shouldFallback = geminiRes.status === 429 || geminiRes.status === 503;
      console.warn(`[transcribe-gemini] chunk=${chunkIndex} model=${model} status=${geminiRes.status}`);

      if (!shouldFallback) {
        return NextResponse.json({ error: lastError }, { status: 502 });
      }
    }
  }

  if (!succeeded) {
    return NextResponse.json({ error: `All models failed after retries. Last: ${lastError}` }, { status: 502 });
  }
  console.log(`[transcribe-gemini] chunk=${chunkIndex} rawText preview: ${rawText.slice(0, 200)}`);

  // Parse JSON from Gemini response
  let segments: Segment[] = [];
  const detectedLanguage = lang;
  try {
    // Strip markdown fences and thinking-model artifacts (box_2d, label fields)
    let cleaned = rawText
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/m, "")
      .trim();

    // Extract first JSON array if response has extra text before/after
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) cleaned = arrayMatch[0];

    const parsed = JSON.parse(cleaned) as Record<string, unknown>[];
    if (Array.isArray(parsed)) {
      segments = parsed
        .filter((s) => typeof s.start === "number" && typeof s.end === "number" && typeof s.text === "string")
        .map((s) => ({
          start: (s.start as number) + timeOffsetSeconds,
          end: (s.end as number) + timeOffsetSeconds,
          text: (s.text as string).trim(),
          ...(typeof s.speaker === "string" ? { speaker: s.speaker as string } : {}),
        }))
        .filter((s) => {
          if (s.text.length === 0) return false;
          // Drop hallucinated filler-only segments (e.g. repeated "Ừm." every 0.2s)
          const isFillerLoop = (s.end - s.start) <= 0.3 && /^[ừưừm\.…\s]+$/i.test(s.text);
          return !isFillerLoop;
        });
    }
  } catch {
    console.warn(`[transcribe-gemini] chunk=${chunkIndex} JSON parse failed. rawText: ${rawText.slice(0, 300)}`);
    // Fallback: one segment spanning estimated chunk duration
    const estimatedDurationSec = part.byteLength / (128 * 1024 / 8);
    const plainText = rawText.replace(/```/g, "").replace(/box_2d[\s\S]*$/m, "").trim();
    segments = plainText ? [{
      start: timeOffsetSeconds,
      end: timeOffsetSeconds + estimatedDurationSec,
      text: plainText,
    }] : [];
  }

  // Try to detect language from Gemini (not explicit in response — keep passed lang)
  return NextResponse.json({ segments, language: detectedLanguage });
}
