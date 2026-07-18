// POST { audioBase64, mimeType, scopeText, unitLabels, isLinked, geminiApiKey?, geminiModels? }
//   → { rubric: FeynmanRubric, transcript }
// 1 call Gemini gộp: nghe audio giảng lại + đối chiếu nội dung gốc → chấm rubric (SPEC §4.1).
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
function textModels(models?: string[]): string[] {
  const list = (models ?? []).filter((m) => !/tts|image|embedding|imagen|veo/i.test(m));
  return list.length > 0 ? list : DEFAULT_MODELS;
}

const PROMPT = (scope: string, labels: string, isLinked: boolean, typed?: string) => `${typed
  ? `Đây là bài người học GÕ để GIẢNG LẠI (phương pháp Feynman) (các) tiểu mục: ${labels}.\nBài giảng của người học:\n"""\n${typed}\n"""`
  : `Đây là bản ghi âm người học GIẢNG LẠI (phương pháp Feynman) (các) tiểu mục: ${labels}.`}
Nội dung GỐC để đối chiếu:
"""
${scope}
"""
${typed ? "Đọc kỹ bài gõ, rồi" : "Hãy nghe kỹ audio, chuyển thành transcript tiếng Việt, rồi"} CHẤM cách hiểu của người học so với nội dung gốc:
- "correct": mảng các ý người học NẮM ĐÚNG (câu ngắn).
- "missing": mảng ý QUAN TRỌNG bị BỎ SÓT.
- "wrong": mảng chỗ HIỂU CHƯA ĐÚNG / nói sai (kèm sửa ngắn).
- "hasExample": true nếu người học tự đưa VÍ DỤ riêng.
- "hasEdgeCase": true nếu có nêu GIỚI HẠN / điều kiện / edge case.
- "followUp": 1 câu hỏi đào sâu giúp hiểu kỹ hơn.
${isLinked ? '- "connection": nhận xét mức độ NỐI KẾT kiến thức giữa các tiểu mục (điểm mạnh/thiếu liên kết).\n' : ""}- "transcript": bản ghi lời giảng.
CHỈ trả JSON object hợp lệ, KHÔNG markdown fence, KHÔNG chữ thừa. Định dạng:
{"transcript":"...","correct":["..."],"missing":["..."],"wrong":["..."],"hasExample":true,"hasEdgeCase":false,"followUp":"..."${isLinked ? ',"connection":"..."' : ""}}`;

function toStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter(Boolean) : [];
}
function parseRubric(raw: string, isLinked: boolean) {
  let cleaned = raw.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").replace(/^json\s*/i, "").trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) cleaned = m[0];
  const o = JSON.parse(cleaned) as Record<string, unknown>;
  const rubric = {
    correct: toStrArr(o.correct),
    missing: toStrArr(o.missing),
    wrong: toStrArr(o.wrong),
    hasExample: o.hasExample === true,
    hasEdgeCase: o.hasEdgeCase === true,
    followUp: typeof o.followUp === "string" ? o.followUp : "",
    ...(isLinked && typeof o.connection === "string" ? { connection: o.connection } : {}),
  };
  const transcript = typeof o.transcript === "string" ? o.transcript : "";
  return { rubric, transcript };
}

export async function POST(req: NextRequest) {
  let body: { audioBase64?: string; mimeType?: string; transcriptText?: string; scopeText?: string; unitLabels?: string; isLinked?: boolean; geminiApiKey?: string; geminiModels?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const typed = (body.transcriptText ?? "").trim();
  if (!body.audioBase64 && typed.length < 10) return NextResponse.json({ error: "Cần audio hoặc bài gõ" }, { status: 400 });
  const scope = (body.scopeText ?? "").trim();
  if (scope.length < 20) return NextResponse.json({ error: "Không có nội dung gốc để đối chiếu" }, { status: 400 });
  const apiKey = body.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình Gemini API key (Cài đặt)" }, { status: 400 });
  const models = textModels(body.geminiModels);
  const isLinked = body.isLinked === true;

  // Text mode (gõ): chỉ 1 part text; audio mode: inline_data + text
  const parts = typed
    ? [{ text: PROMPT(scope.slice(0, 20_000), body.unitLabels ?? "", isLinked, typed.slice(0, 8_000)) }]
    : [{ inline_data: { mime_type: body.mimeType || "audio/webm", data: body.audioBase64 } }, { text: PROMPT(scope.slice(0, 20_000), body.unitLabels ?? "", isLinked) }];
  const requestBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json" },
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
    const { rubric, transcript } = parseRubric(rawText, isLinked);
    return NextResponse.json({ rubric, transcript: transcript || typed });
  } catch {
    return NextResponse.json({ error: "Không parse được kết quả chấm" }, { status: 502 });
  }
}
