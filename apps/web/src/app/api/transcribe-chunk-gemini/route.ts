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

function deduplicateHallucinations(segs: Segment[]): Segment[] {
  if (segs.length === 0) return segs;
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
  const result: Segment[] = [];
  let streak = 0;
  for (let i = 0; i < segs.length; i++) {
    const cur = norm(segs[i].text);
    const prev = i > 0 ? norm(segs[i - 1].text) : null;
    streak = cur === prev ? streak + 1 : 1;
    if (streak <= 2) result.push(segs[i]);
  }
  return result;
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
    startModelIndex?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { downloadUrl, byteStart, byteEnd, headerBytes, mimeType, chunkIndex, timeOffsetSeconds, language, diarization, geminiApiKey: userApiKey, geminiModels: userModels, startModelIndex } = body;

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
    ? `Transcribe this audio clip. Detected language: ${lang}.
Identify different speakers. Try to infer each speaker's real name and organization from the conversation context (e.g. if someone is addressed as "anh Dũng", "chị Mai", or a company name is mentioned). Use the format "Organization | Name" if organization is known (e.g. "SmartLog | Anh Dũng"), or just the name if no organization is mentioned (e.g. "Anh Sủng"). If the name cannot be determined at all, fall back to SPEAKER_1, SPEAKER_2, etc. Keep speaker labels consistent throughout.
Output MUST be a valid JSON array only — no markdown fences, no explanation, no extra text before or after.
Use decimal seconds (not MM:SS format) for start and end.
Example format:
[{"start":0.0,"end":5.2,"speaker":"SmartLog | Người nói 1","text":"..."},{"start":5.5,"end":9.1,"speaker":"QPL | Anh Sủng","text":"..."},{"start":9.2,"end":12.0,"speaker":"SPEAKER_3","text":"..."}]`
    : `Transcribe this audio clip. Detected language: ${lang}.
Output MUST be a valid JSON array only — no markdown fences, no explanation, no extra text before or after.
Use decimal seconds (not MM:SS format) for start and end.
Example format:
[{"start":0.0,"end":5.2,"text":"..."},{"start":5.5,"end":9.1,"text":"..."}]`;

  const requestBody = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: geminiMime, data: base64Audio } },
        { text: prompt },
      ],
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 65536 },
  });

  // Try each model in fallback chain starting from startModelIndex, with retries
  let rawText = "";
  let lastError = "";
  let succeededModelIndex = -1;
  const MAX_CHAIN_ATTEMPTS = 3;
  const startIdx = Math.min(startModelIndex ?? 0, GEMINI_MODELS_ACTIVE.length - 1);

  outer: for (let attempt = 0; attempt < MAX_CHAIN_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const waitMs = 20000 * attempt;
      console.log(`[transcribe-gemini] chunk=${chunkIndex} all models failed, retry chain in ${waitMs / 1000}s (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, waitMs));
    }

    for (let mi = (attempt === 0 ? startIdx : 0); mi < GEMINI_MODELS_ACTIVE.length; mi++) {
      const model = GEMINI_MODELS_ACTIVE[mi];
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
        console.log(`[transcribe-gemini] chunk=${chunkIndex} model=${model} (index=${mi}) OK (attempt ${attempt + 1})`);
        succeededModelIndex = mi;
        break outer;
      }

      const errText = await geminiRes.text();
      lastError = `Gemini error ${geminiRes.status} on ${model}: ${errText}`;
      const shouldFallback = geminiRes.status === 429 || geminiRes.status === 503 || geminiRes.status === 500;
      console.warn(`[transcribe-gemini] chunk=${chunkIndex} model=${model} status=${geminiRes.status}`);

      if (!shouldFallback) {
        return NextResponse.json({ error: lastError }, { status: 502 });
      }
    }
  }

  if (succeededModelIndex === -1) {
    return NextResponse.json({ error: `All models failed after retries. Last: ${lastError}` }, { status: 502 });
  }
  console.log(`[transcribe-gemini] chunk=${chunkIndex} rawText length=${rawText.length} first300: ${JSON.stringify(rawText.slice(0, 300))}`);

  // Parse JSON from Gemini response
  let segments: Segment[] = [];
  const detectedLanguage = lang;

  // Convert Gemini timestamp that may be "M:SS.ss" or "MM:SS.ss" → seconds
  function parseTimestamp(val: unknown): number | null {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      // "5:48.66" → 5*60 + 48.66
      const m = val.match(/^(\d+):(\d+(?:\.\d+)?)$/);
      if (m) return parseInt(m[1]) * 60 + parseFloat(m[2]);
      const n = parseFloat(val);
      if (!isNaN(n)) return n;
    }
    return null;
  }

  try {
    // Strip markdown fences and leading "json\n" word
    let cleaned = rawText
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/m, "")
      .replace(/^json\s*/i, "")
      .trim();

    console.log(`[transcribe-gemini] chunk=${chunkIndex} cleaned[0]=${JSON.stringify(cleaned.slice(0, 100))}`);

    // If Gemini wrapped everything in a single {"text":"...json..."} object, unwrap it
    if (cleaned.startsWith("{")) {
      try {
        const obj = JSON.parse(cleaned) as Record<string, unknown>;
        if (typeof obj.text === "string") { cleaned = obj.text; console.log(`[transcribe-gemini] chunk=${chunkIndex} unwrapped single-object`); }
      } catch { /* not a single object, continue */ }
    }

    // Extract first JSON array if response has extra text before/after
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) cleaned = arrayMatch[0];

    let parsed = JSON.parse(cleaned) as Record<string, unknown>[];
    console.log(`[transcribe-gemini] chunk=${chunkIndex} parsed array length=${Array.isArray(parsed) ? parsed.length : "NOT_ARRAY"} first_text_preview=${JSON.stringify(String(parsed?.[0]?.text ?? "").slice(0, 80))}`);

    // If Gemini returned array with 1 element whose text is itself a JSON array, unwrap it
    if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0].text === "string") {
      const inner = (parsed[0].text as string).trim();
      console.log(`[transcribe-gemini] chunk=${chunkIndex} single-element array, inner starts with: ${JSON.stringify(inner.slice(0, 50))}`);
      const innerArrayMatch = inner.match(/^\[[\s\S]*\]$/);
      if (innerArrayMatch) {
        try {
          const innerParsed = JSON.parse(innerArrayMatch[0]) as Record<string, unknown>[];
          if (Array.isArray(innerParsed) && innerParsed.length > 0) {
            parsed = innerParsed;
            console.log(`[transcribe-gemini] chunk=${chunkIndex} unwrapped inner array, length=${innerParsed.length}`);
          }
        } catch { /* not a nested array, keep original */ }
      }
    }

    if (Array.isArray(parsed)) {
      segments = parsed
        .filter((s) => {
          const st = parseTimestamp(s.start);
          const en = parseTimestamp(s.end);
          return st !== null && en !== null && typeof s.text === "string";
        })
        .map((s) => {
          const st = parseTimestamp(s.start)!;
          const en = parseTimestamp(s.end)!;
          return {
            start: st + timeOffsetSeconds,
            end: en + timeOffsetSeconds,
            text: (s.text as string).trim(),
            ...(typeof s.speaker === "string" ? { speaker: s.speaker as string } : {}),
          };
        })
        .filter((s) => {
          if (s.text.length === 0) return false;
          // Drop hallucinated filler-only segments (e.g. repeated "Ừm." every 0.2s)
          const dur = s.end - s.start;
          const isFillerLoop = dur <= 0.5 && /^[ừưm\.…,\s]+$/i.test(s.text);
          return !isFillerLoop;
        });

      // Drop hallucination runs: if any phrase repeats ≥5 times consecutively, drop all but 2
      segments = deduplicateHallucinations(segments);
    }
  } catch {
    console.warn(`[transcribe-gemini] chunk=${chunkIndex} JSON parse failed. rawText: ${rawText.slice(0, 300)}`);
    // Fallback: try to salvage complete objects from truncated JSON
    console.warn(`[transcribe-gemini] chunk=${chunkIndex} JSON parse failed, attempting partial recovery. rawText length=${rawText.length}`);
    try {
      const partialMatches = rawText.matchAll(/\{\s*"start"\s*:\s*([\d.]+)\s*,\s*"end"\s*:\s*([\d.]+)[^}]*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*(?:,\s*"speaker"\s*:\s*"([^"]*)")?\s*\}/g);
      for (const m of partialMatches) {
        const st = parseFloat(m[1]);
        const en = parseFloat(m[2]);
        const txt = m[3].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
        if (!isNaN(st) && !isNaN(en) && txt) {
          segments.push({ start: st + timeOffsetSeconds, end: en + timeOffsetSeconds, text: txt, ...(m[4] ? { speaker: m[4] } : {}) });
        }
      }
    } catch { /* partial recovery failed, return empty */ }
    console.warn(`[transcribe-gemini] chunk=${chunkIndex} partial recovery got ${segments.length} segments`);
  }

  // Estimate chunk duration from byte size (128kbps opus)
  const chunkDurationSeconds = part.byteLength / (128 * 1024 / 8);
  return NextResponse.json({ segments, language: detectedLanguage, modelIndex: succeededModelIndex, chunkDurationSeconds });
}
