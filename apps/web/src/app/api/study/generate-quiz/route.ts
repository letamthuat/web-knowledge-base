// POST { scopeText, unitLabel, geminiApiKey?, geminiModels? } → { questions: QuizQuestion[] }
// Sinh 3 MCQ (vận dụng) + 2 tự luận ngắn cho 1 tiểu mục (SPEC §4.2), mỗi câu kèm quote.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
function textModels(models?: string[]): string[] {
  const list = (models ?? []).filter((m) => !/tts|image|embedding|imagen|veo/i.test(m));
  return list.length > 0 ? list : DEFAULT_MODELS;
}

const PROMPT = (scope: string, label: string) => `Bạn là giáo viên ra đề kiểm tra active-recall tiếng Việt cho tiểu mục "${label}".
Nội dung tiểu mục:
"""
${scope}
"""
Ra ĐÚNG 5 câu theo thứ tự: 3 câu trắc nghiệm (mcq) tầng VẬN DỤNG rồi 2 câu tự luận ngắn (open).
- mcq: "q" (câu hỏi vận dụng, không hỏi định nghĩa suông), "options" (4 phương án), "correct" (chỉ số 0-3 của đáp án đúng), "explainWrong" (mảng 4 phần tử — giải thích vì sao mỗi phương án sai; phần tử của đáp án ĐÚNG để chuỗi rỗng ""), "quote" (trích đoạn gốc làm căn cứ).
- open: "q" (câu hỏi ngắn buộc giải thích), "feedbackGood" (mảng 2-3 ý ĐÚNG cần có trong câu trả lời tốt), "feedbackMissing" (mảng 1-2 ý người học HAY THIẾU), "quote" (trích đoạn gốc).
Mọi "quote" phải lấy nguyên văn từ nội dung trên (chống bịa).
CHỈ trả JSON array 5 phần tử, KHÔNG markdown fence, KHÔNG giải thích. Định dạng:
[{"kind":"mcq","q":"...","options":["..","..","..",".."],"correct":0,"explainWrong":["","..","..",".."],"quote":".."},{"kind":"open","q":"..","feedbackGood":[".."],"feedbackMissing":[".."],"quote":".."}]`;

type MCQ = { kind: "mcq"; q: string; options: string[]; correct: number; explainWrong: string[]; quote: string };
type Open = { kind: "open"; q: string; feedbackGood: string[]; feedbackMissing: string[]; quote: string };
type QQ = MCQ | Open;

function toStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String(x ?? ""))) : [];
}
function parseQuiz(raw: string): QQ[] {
  let cleaned = raw.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").replace(/^json\s*/i, "").trim();
  if (cleaned.startsWith("{")) {
    try {
      const obj = JSON.parse(cleaned) as Record<string, unknown>;
      if (typeof obj.text === "string") cleaned = obj.text.trim();
    } catch { /* */ }
  }
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) cleaned = m[0];
  const arr = JSON.parse(cleaned) as Record<string, unknown>[];
  const out: QQ[] = [];
  for (const q of Array.isArray(arr) ? arr : []) {
    const quote = typeof q.quote === "string" ? q.quote : "";
    if (q.kind === "open") {
      const text = typeof q.q === "string" ? q.q.trim() : "";
      if (text) out.push({ kind: "open", q: text, feedbackGood: toStrArr(q.feedbackGood), feedbackMissing: toStrArr(q.feedbackMissing), quote });
    } else {
      const text = typeof q.q === "string" ? q.q.trim() : "";
      const options = toStrArr(q.options);
      if (text && options.length >= 2) {
        const correct = typeof q.correct === "number" && q.correct >= 0 && q.correct < options.length ? q.correct : 0;
        let ew = toStrArr(q.explainWrong);
        while (ew.length < options.length) ew.push("");
        out.push({ kind: "mcq", q: text, options, correct, explainWrong: ew.slice(0, options.length), quote });
      }
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: { scopeText?: string; unitLabel?: string; geminiApiKey?: string; geminiModels?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const scope = (body.scopeText ?? "").trim();
  if (scope.length < 40) return NextResponse.json({ error: "Nội dung tiểu mục quá ngắn để ra đề" }, { status: 400 });
  const apiKey = body.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình Gemini API key (Cài đặt)" }, { status: 400 });
  const models = textModels(body.geminiModels);

  const promptText = PROMPT(scope.slice(0, 24_000), body.unitLabel ?? "");
  // Tắt "thinking" của gemini-2.5-*: nếu bật, phần suy nghĩ đốt hết maxOutputTokens
  // → JSON đầu ra bị cắt cụt (finishReason MAX_TOKENS) → parse vỡ → 502.
  // gemini-2.0-* KHÔNG hỗ trợ thinkingConfig (gửi vào sẽ 400) nên chỉ gắn cho model 2.5.
  const bodyFor = (model: string) =>
    JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        ...(/2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

  let rawText = "";
  let lastError = "";
  let ok = false;
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: bodyFor(model),
      });
    } catch (e) { lastError = `Network ${model}: ${e}`; continue; }
    if (res.ok) {
      let data: { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
      try {
        data = await res.json();
      } catch (e) { lastError = `Bad JSON từ ${model}: ${e}`; continue; }
      const cand = data.candidates?.[0];
      rawText = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      // Gemini 200 nhưng không có nội dung: bị chặn an toàn hoặc cắt cụt token → thử model kế.
      if (!rawText.trim()) {
        const reason = cand?.finishReason ?? data.promptFeedback?.blockReason ?? "empty";
        lastError = `Gemini ${model} không trả nội dung (${reason})`;
        continue;
      }
      ok = true; break;
    }
    lastError = `Gemini ${res.status} on ${model}: ${await res.text()}`;
    if (![429, 503, 500].includes(res.status)) return NextResponse.json({ error: lastError }, { status: 502 });
  }
  if (!ok) return NextResponse.json({ error: `Gemini lỗi. ${lastError}` }, { status: 502 });

  try {
    const questions = parseQuiz(rawText);
    const mcq = questions.filter((q) => q.kind === "mcq").length;
    if (questions.length < 3 || mcq === 0) {
      return NextResponse.json({ error: `AI ra đề không hợp lệ (được ${questions.length} câu, ${mcq} trắc nghiệm)` }, { status: 502 });
    }
    return NextResponse.json({ questions });
  } catch (e) {
    return NextResponse.json({ error: `Không parse được đề AI: ${e instanceof Error ? e.message : e}. Đầu ra: ${rawText.slice(0, 200)}` }, { status: 502 });
  }
}
