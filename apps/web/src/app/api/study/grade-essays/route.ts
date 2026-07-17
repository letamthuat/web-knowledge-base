// POST { items:[{q, answer, feedbackGood[], feedbackMissing[]}], geminiApiKey?, geminiModels? }
//   → { grades:[{credit:0..1, good:string[], missing:string[]}] }
// Chấm từng câu tự luận so với ý cần có (SPEC §3.2/§4.1). Mỗi câu 0..1 điểm.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
function textModels(models?: string[]): string[] {
  const list = (models ?? []).filter((m) => !/tts|image|embedding|imagen|veo/i.test(m));
  return list.length > 0 ? list : DEFAULT_MODELS;
}

type Item = { q: string; answer: string; feedbackGood: string[]; feedbackMissing: string[] };
type Grade = { credit: number; good: string[]; missing: string[] };

const PROMPT = (items: Item[]) => `Bạn là giám khảo chấm câu tự luận ngắn tiếng Việt, công tâm và có căn cứ.
Với mỗi câu, chấm câu trả lời của người học so với các Ý CẦN CÓ. Cho "credit" từ 0.0 đến 1.0
(1.0 = nêu đủ ý chính; 0.5 = đúng một phần; 0.0 = sai/bỏ trống). "good" = các ý người học ĐÃ nêu đúng;
"missing" = các ý quan trọng còn THIẾU hoặc hiểu sai. Ngắn gọn, cụ thể.
Dữ liệu (mảng câu):
${JSON.stringify(items.map((it, i) => ({ index: i, question: it.q, studentAnswer: it.answer || "(bỏ trống)", mustHave: it.feedbackGood, commonlyMissed: it.feedbackMissing })))}
CHỈ trả JSON array cùng thứ tự, KHÔNG markdown fence. Định dạng:
[{"credit":1.0,"good":["..."],"missing":["..."]}]`;

function toStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter(Boolean) : [];
}
function parseGrades(raw: string, n: number): Grade[] {
  let cleaned = raw.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").replace(/^json\s*/i, "").trim();
  if (cleaned.startsWith("{")) {
    try { const obj = JSON.parse(cleaned) as Record<string, unknown>; if (typeof obj.text === "string") cleaned = obj.text.trim(); } catch { /* */ }
  }
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) cleaned = m[0];
  const arr = JSON.parse(cleaned) as Record<string, unknown>[];
  const out: Grade[] = [];
  for (let i = 0; i < n; i++) {
    const g = Array.isArray(arr) ? arr[i] : undefined;
    const creditRaw = typeof g?.credit === "number" ? g.credit : 0;
    const credit = Math.max(0, Math.min(1, creditRaw));
    out.push({ credit, good: toStrArr(g?.good), missing: toStrArr(g?.missing) });
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: { items?: Item[]; geminiApiKey?: string; geminiModels?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ grades: [] });
  const apiKey = body.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình Gemini API key (Cài đặt)" }, { status: 400 });
  const models = textModels(body.geminiModels);

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT(items) }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 4096, responseMimeType: "application/json" },
  });

  let rawText = "";
  let lastError = "";
  let ok = false;
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody,
      });
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
    return NextResponse.json({ grades: parseGrades(rawText, items.length) });
  } catch {
    // Chấm lỗi → fallback trung tính 0.5 để không chặn người học
    return NextResponse.json({ grades: items.map(() => ({ credit: 0.5, good: [], missing: ["(AI chấm lỗi — tạm cho 0.5)"] })) });
  }
}
