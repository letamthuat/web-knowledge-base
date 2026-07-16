// POST { scopeText, unitLabel, geminiApiKey?, geminiModels? } → { cards: GenCard[] }
// Sinh 8-12 flashcard cho 1 tiểu mục (SPEC §4.2): 3 loại concept/apply/link, phủ 4 tầng,
// mỗi card kèm quote trích đoạn gốc. On-demand, cache ở client sau khi user duyệt.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

// Loại model KHÔNG sinh text/JSON được (tts=audio, image=ảnh, embedding, vision-only).
function textModels(models?: string[]): string[] {
  const list = (models ?? []).filter((m) => !/tts|image|embedding|imagen|veo/i.test(m));
  return list.length > 0 ? list : GEMINI_MODELS;
}

type GenCard = { type: "concept" | "apply" | "link"; front: string; back: string; quote: string };

const PROMPT = (scope: string, label: string) => `Bạn là trợ giảng tạo flashcard active-recall cho người học tiếng Việt.
Tiểu mục: "${label}".
Dưới đây là TOÀN BỘ nội dung tiểu mục (có thể gồm 4 tầng: trực giác → công thức → giải số → giới hạn/nhân quả):

"""
${scope}
"""

Sinh 8-12 flashcard phủ ĐỦ các tầng nội dung trên, gồm 3 loại:
- "concept" (khái niệm cốt lõi, định nghĩa, trực giác),
- "apply" (vận dụng công thức/quy trình, ví dụ số),
- "link" (liên kết với khái niệm khác, khi nào dùng / giới hạn / nhân quả).
Yêu cầu mỗi card:
- "front": câu hỏi/ nhắc gợi nhớ NGẮN, buộc phải nhớ chủ động (không hỏi yes/no).
- "back": câu trả lời súc tích, chính xác theo nội dung; có con số/công thức nếu có.
- "quote": TRÍCH ĐOẠN NGẮN nguyên văn từ nội dung trên làm bằng chứng (chống bịa). Bắt buộc lấy từ text, không tự chế.
CHỈ trả về JSON array hợp lệ, KHÔNG markdown fence, KHÔNG giải thích. Định dạng:
[{"type":"concept","front":"...","back":"...","quote":"..."}]`;

function parseCards(raw: string): GenCard[] {
  let cleaned = raw.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").replace(/^json\s*/i, "").trim();
  // Gemini đôi khi bọc JSON trong { "text": "[...]" }
  if (cleaned.startsWith("{")) {
    try {
      const obj = JSON.parse(cleaned) as Record<string, unknown>;
      if (typeof obj.text === "string") cleaned = obj.text.trim();
    } catch { /* not single object */ }
  }
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) cleaned = m[0];
  const arr = JSON.parse(cleaned) as Record<string, unknown>[];
  const valid: GenCard[] = [];
  for (const c of Array.isArray(arr) ? arr : []) {
    const type = c.type === "apply" || c.type === "link" ? c.type : "concept";
    const front = typeof c.front === "string" ? c.front.trim() : "";
    const back = typeof c.back === "string" ? c.back.trim() : "";
    const quote = typeof c.quote === "string" ? c.quote.trim() : "";
    if (front && back) valid.push({ type, front, back, quote });
  }
  return valid;
}

export async function POST(req: NextRequest) {
  let body: { scopeText?: string; unitLabel?: string; geminiApiKey?: string; geminiModels?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const scope = (body.scopeText ?? "").trim();
  if (!scope) return NextResponse.json({ error: "scopeText required" }, { status: 400 });
  if (scope.length < 40) return NextResponse.json({ error: "Nội dung tiểu mục quá ngắn để sinh card" }, { status: 400 });

  const apiKey = body.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình Gemini API key (Cài đặt)" }, { status: 400 });
  const models = textModels(body.geminiModels);

  // Cắt scope quá dài để an toàn TPM (~ giữ 24k ký tự đầu).
  const scopeClipped = scope.length > 24_000 ? scope.slice(0, 24_000) : scope;
  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT(scopeClipped, body.unitLabel ?? "") }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: "application/json" },
  });

  let rawText = "";
  let lastError = "";
  let ok = false;
  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
    } catch (e) {
      lastError = `Network error ${model}: ${e}`;
      continue;
    }
    if (res.ok) {
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      ok = true;
      break;
    }
    const errText = await res.text();
    lastError = `Gemini ${res.status} on ${model}: ${errText}`;
    const fallback = res.status === 429 || res.status === 503 || res.status === 500;
    if (!fallback) return NextResponse.json({ error: lastError }, { status: 502 });
  }
  if (!ok) return NextResponse.json({ error: `Gemini lỗi. ${lastError}` }, { status: 502 });

  try {
    const cards = parseCards(rawText);
    if (cards.length === 0) return NextResponse.json({ error: "AI không sinh được card hợp lệ" }, { status: 502 });
    return NextResponse.json({ cards });
  } catch {
    return NextResponse.json({ error: "Không parse được kết quả AI" }, { status: 502 });
  }
}
