import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

function parseTimestamp(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const m = val.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (m) return parseInt(m[1]) * 60 + parseFloat(m[2]);
    const n = parseFloat(val);
    if (!isNaN(n)) return n;
  }
  return null;
}

// POST: { audioBase64, mimeType, chunkIndex, timeOffsetSeconds, language?, diarization?, geminiApiKey?, geminiModels?, startModelIndex? }
// Receives pre-extracted audio as base64, sends directly to Gemini. Used by VideoViewer after ffmpeg extraction.
export async function POST(req: NextRequest) {
  let body: {
    audioBase64: string;
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

  const { audioBase64, mimeType, chunkIndex, timeOffsetSeconds, language, diarization, geminiApiKey: userApiKey, geminiModels: userModels, startModelIndex } = body;

  if (!audioBase64) return NextResponse.json({ error: "audioBase64 required" }, { status: 400 });

  const apiKey = (userApiKey && userApiKey.trim()) ? userApiKey.trim() : process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  const GEMINI_MODELS_ACTIVE = (userModels && userModels.length > 0) ? userModels : GEMINI_MODELS;

  const geminiMime = "audio/webm"; // ffmpeg always outputs webm/opus
  const lang = language ?? "vi";

  console.log(`[transcribe-audio-gemini] chunk=${chunkIndex} base64 length=${audioBase64.length} (~${(audioBase64.length * 3 / 4 / 1024 / 1024).toFixed(1)}MB)`);

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
    contents: [{ parts: [
      { inline_data: { mime_type: geminiMime, data: audioBase64 } },
      { text: prompt },
    ]}],
    generationConfig: { temperature: 0, maxOutputTokens: 65536 },
  });

  let rawText = "";
  let lastError = "";
  let succeededModelIndex = -1;
  const startIdx = Math.min(startModelIndex ?? 0, GEMINI_MODELS_ACTIVE.length - 1);

  outer: for (let attempt = 0; attempt < 1; attempt++) {
    for (let mi = startIdx; mi < GEMINI_MODELS_ACTIVE.length; mi++) {
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
        console.warn(`[transcribe-audio-gemini] chunk=${chunkIndex} ${lastError}`);
        continue;
      }

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json() as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        console.log(`[transcribe-audio-gemini] chunk=${chunkIndex} model=${model} (index=${mi}) OK`);
        succeededModelIndex = mi;
        break outer;
      }

      const errText = await geminiRes.text();
      lastError = `Gemini error ${geminiRes.status} on ${model}: ${errText}`;
      const shouldFallback = geminiRes.status === 429 || geminiRes.status === 503 || geminiRes.status === 500;
      console.warn(`[transcribe-audio-gemini] chunk=${chunkIndex} model=${model} status=${geminiRes.status}`);
      if (!shouldFallback) {
        return NextResponse.json({ error: lastError }, { status: 502 });
      }
    }
  }

  if (succeededModelIndex === -1) {
    return NextResponse.json({ error: `All models failed after retries. Last: ${lastError}` }, { status: 502 });
  }

  let segments: Segment[] = [];
  const detectedLanguage = lang;

  try {
    let cleaned = rawText
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/m, "")
      .replace(/^json\s*/i, "")
      .trim();

    if (cleaned.startsWith("{")) {
      try {
        const obj = JSON.parse(cleaned) as Record<string, unknown>;
        if (typeof obj.text === "string") cleaned = obj.text;
      } catch { /* not a single object */ }
    }

    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) cleaned = arrayMatch[0];

    let parsed = JSON.parse(cleaned) as Record<string, unknown>[];

    if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0].text === "string") {
      const inner = (parsed[0].text as string).trim();
      const innerArrayMatch = inner.match(/^\[[\s\S]*\]$/);
      if (innerArrayMatch) {
        try {
          const innerParsed = JSON.parse(innerArrayMatch[0]) as Record<string, unknown>[];
          if (Array.isArray(innerParsed) && innerParsed.length > 0) parsed = innerParsed;
        } catch { /* not a nested array */ }
      }
    }

    if (Array.isArray(parsed)) {
      segments = parsed
        .filter((s) => {
          const st = parseTimestamp(s.start);
          const en = parseTimestamp(s.end);
          return st !== null && en !== null && typeof s.text === "string";
        })
        .map((s) => ({
          start: parseTimestamp(s.start)! + timeOffsetSeconds,
          end: parseTimestamp(s.end)! + timeOffsetSeconds,
          text: (s.text as string).trim(),
          ...(typeof s.speaker === "string" ? { speaker: s.speaker as string } : {}),
        }))
        .filter((s) => {
          if (s.text.length === 0) return false;
          const dur = s.end - s.start;
          return !(dur <= 0.5 && /^[ừưm\.…,\s]+$/i.test(s.text));
        });
      segments = deduplicateHallucinations(segments);
    }
  } catch {
    console.warn(`[transcribe-audio-gemini] chunk=${chunkIndex} JSON parse failed`);
  }

  return NextResponse.json({ segments, language: detectedLanguage, modelIndex: succeededModelIndex });
}
