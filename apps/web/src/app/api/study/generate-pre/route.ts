// POST { scopeText, unitLabel, geminiApiKey?, geminiModels? } → { questions: string[] }
// Pre-questions: 3-5 câu hỏi định hướng tầng khái niệm, kích hoạt tò mò TRƯỚC khi đọc (SPEC §5).
// Không chấm — chỉ gợi mở. Cache section_questions(kind='pre').
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
function textModels(models?: string[]): string[] {
  const list = (models ?? []).filter((m) => !/tts|image|embedding|imagen|veo/i.test(m));
  return list.length > 0 ? list : DEFAULT_MODELS;
}

const PROMPT = (scope: string, label: string) => `Người học SẮP đọc tiểu mục "${label}" (chưa đọc). Nội dung:
"""
${scope}
"""
Viết 3-5 CÂU HỎI ĐỊNH HƯỚNG ngắn để kích hoạt tò mò TRƯỚC khi đọc (pre-testing / advance organizer):
- Hỏi ở tầng khái niệm/trực giác, buộc người học tự dự đoán, KHÔNG hỏi chi tiết vụn vặt.
- KHÔNG kèm đáp án. Mỗi câu 1 dòng, tiếng Việt, tự nhiên.
CHỈ trả JSON array chuỗi, KHÔNG markdown fence. Ví dụ: ["Vì sao ...?","Điều gì xảy ra nếu ...?"]`;

function parsePre(raw: string): string[] {
  let cleaned = raw.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").replace(/^json\s*/i, "").trim();
  if (cleaned.startsWith("{")) {
    try { const o = JSON.parse(cleaned) as Record<string, unknown>; if (typeof o.text === "string") cleaned = o.text.trim(); } catch { /* */ }
  }
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) cleaned = m[0];
  const arr = JSON.parse(cleaned) as unknown[];
  return (Array.isArray(arr) ? arr : []).map((x) => (typeof x === "string" ? x.trim() : String(x ?? ""))).filter(Boolean).slice(0, 5);
}

export async function POST(req: NextRequest) {
  let body: { scopeText?: string; unitLabel?: string; geminiApiKey?: string; geminiModels?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const scope = (body.scopeText ?? "").trim();
  if (scope.length < 40) return NextResponse.json({ error: "Nội dung tiểu mục quá ngắn" }, { status: 400 });
  const apiKey = body.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình Gemini API key (Cài đặt)" }, { status: 400 });
  const models = textModels(body.geminiModels);

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT(scope.slice(0, 16_000), body.unitLabel ?? "") }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 2048, responseMimeType: "application/json" },
  });

  let rawText = "";
  let lastError = "";
  let ok = false;
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody });
    } catch (e) { lastError = `Network ${model}: ${e}`; continue; }
    if (res.ok) {
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      ok = true; break;
    }
    lastError = `Gemini ${res.status} on ${model}: ${await res.text()}`;
    if (![429, 503, 500].includes(res.status)) return NextResponse.json({ error: lastError }, { status: 502 });
  }
  if (!ok) return NextResponse.json({ error: `Gemini lỗi. ${lastError}` }, { status: 502 });

  try {
    const questions = parsePre(rawText);
    if (questions.length === 0) return NextResponse.json({ error: "AI không sinh được câu hỏi" }, { status: 502 });
    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ error: "Không parse được kết quả AI" }, { status: 502 });
  }
}
