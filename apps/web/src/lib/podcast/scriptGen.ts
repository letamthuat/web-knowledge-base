// Sinh kịch bản podcast (server-only): prompt giữ chiều sâu + parse + đếm độ phủ ý bắt buộc.
// Tách khỏi route để test trực tiếp được.
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Chỉ dùng khi không liệt kê được model từ API. Google khai tử model theo thời gian (vd 2.0-flash → 404),
// nên danh sách thật được lấy động qua ListModels (discoverModels).
const STATIC_FALLBACK = ["gemini-flash-latest", "gemini-2.5-flash"];
const NON_TEXT = /tts|image|embedding|imagen|veo|live|audio|native|preview-\d{2}-\d{2}|exp/i;

/** Tổng thời gian cho cả vòng thử model — phải < maxDuration của route (300s). */
export const SCRIPT_DEADLINE_MS = 270_000;

let discovered: { at: number; models: string[] } | null = null;

/** Model flash text còn sống với key này (cache 1 giờ). Bản "lite" xếp sau, phiên bản mới xếp trước. */
async function discoverModels(apiKey: string): Promise<string[]> {
  if (discovered && Date.now() - discovered.at < 3_600_000) return discovered.models;
  try {
    const res = await fetch(`${GEMINI_BASE}?key=${apiKey}&pageSize=1000`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const ver = (m: string) => Number(m.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
    const models = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .filter((m) => /^gemini-.*flash/i.test(m) && !NON_TEXT.test(m))
      .sort((a, b) => Number(/lite/.test(a)) - Number(/lite/.test(b)) || ver(b) - ver(a));
    discovered = { at: Date.now(), models };
    return models;
  } catch {
    return [];
  }
}

/** Model user chọn trước, sau đó model tự phát hiện — để model bị khai tử không làm hỏng cả lượt. */
async function textModels(apiKey: string, models?: string[]): Promise<string[]> {
  const user = (models ?? []).filter((m) => !NON_TEXT.test(m));
  const auto = await discoverModels(apiKey);
  const list = [...new Set([...user, ...(auto.length ? auto : STATIC_FALLBACK)])];
  return list.slice(0, 6);
}

/** Lỗi do key (sai/hết hạn/không có quyền) → thử model khác cũng vô ích. */
function isKeyError(status: number, body: string): boolean {
  return status === 401 || /API_KEY_INVALID|API key not valid|API key expired|PERMISSION_DENIED/i.test(body);
}

export type Turn = { s: "host" | "expert"; t: string; c: number[] };
export type Script = { keyPoints: string[]; turns: Turn[]; recall: { q: string; a: string }[] };

export type ScriptInput = {
  sourceText: string; episodeTitle: string; seriesTitle: string; episodeNo: number; episodeCount: number;
  prevTitle?: string; nextTitle?: string; missedPoints?: string[];
};

const PROMPT = (b: {
  sourceText: string; episodeTitle: string; seriesTitle: string; episodeNo: number; episodeCount: number;
  prevTitle?: string; nextTitle?: string; missedPoints?: string[];
}) => `Bạn là biên kịch podcast giáo dục chuyên sâu bằng tiếng Việt. Chuyển NGUỒN dưới đây thành kịch bản hội thoại 2 người để người nghe HỌC ĐƯỢC THẬT — không phải tóm tắt lướt.

SERIES: "${b.seriesTitle}" — Tập ${b.episodeNo}/${b.episodeCount}: "${b.episodeTitle}"
${b.prevTitle ? `Tập trước: "${b.prevTitle}".` : "Đây là tập mở đầu series."}${b.nextTitle ? ` Tập sau: "${b.nextTitle}".` : ""}

NHÂN VẬT
- "host" = My: người học thông minh, tò mò. Hỏi đúng chỗ người mới sẽ vướng: "vì sao", "khác gì với…", "cho ví dụ thực tế", "nếu … thì sao", phản biện, và thỉnh thoảng tự diễn đạt lại bằng lời mình để Minh xác nhận/sửa.
- "expert" = Minh: chuyên gia, giải thích CƠ CHẾ và lý do, không chỉ định nghĩa.

BƯỚC 1 — keyPoints: liệt kê MỌI ý kiến thức bắt buộc trong nguồn (thường 8–25 ý). Mỗi ý phải CỤ THỂ: tên khái niệm + nội dung cốt lõi, kèm số liệu/công thức/điều kiện/giới hạn nếu nguồn có. Không viết ý chung chung kiểu "hiểu tầm quan trọng của X".

BƯỚC 2 — turns: kịch bản phủ TẤT CẢ keyPoints.
- Độ sâu ưu tiên hơn độ ngắn: KHÔNG lược bỏ chi tiết, ví dụ, số liệu, ngoại lệ, giới hạn có trong nguồn. Độ dài tổng xấp xỉ bằng độ dài phần văn xuôi của nguồn (có thể dài hơn khi cần giải thích).
- Mỗi lượt thoại có "c" = mảng chỉ số (0-based) các keyPoints mà lượt đó trình bày. Ý nào cũng phải xuất hiện trong "c" của ít nhất 1 lượt.
- Code: giải thích từng bước nó làm gì và vì sao viết vậy — KHÔNG đọc cú pháp, ký hiệu. Công thức: nói bằng lời từng thành phần nghĩa là gì và trực giác của nó. Bảng: nói ra các so sánh/điểm khác biệt chính.
- Giữ thuật ngữ gốc (thường tiếng Anh) và giải nghĩa tiếng Việt ở lần đầu.
- Ví dụ minh hoạ thêm ngoài nguồn được phép nhưng phải nói rõ là "ví dụ"; TUYỆT ĐỐI không bịa số liệu, tên nghiên cứu, trích dẫn không có trong nguồn.
- Văn nói tự nhiên, câu không quá dài, KHÔNG markdown, KHÔNG emoji, KHÔNG ký hiệu như →, *, #. Mỗi lượt ≤ 700 ký tự; luân phiên tự nhiên (có thể 2 lượt liền của Minh khi giải thích dài).
- Mở đầu: My chào, giới thiệu tập ${b.episodeNo}${b.prevTitle ? " (nối 1 câu với tập trước)" : ""} và nêu 1 câu hỏi gợi tò mò. Kết: My tóm lại 3–5 ý cốt lõi bằng lời mình, Minh chốt điều dễ hiểu sai nhất.
${b.missedPoints?.length ? `\nLƯU Ý: lần trước kịch bản BỎ SÓT các ý sau — lần này phải trình bày kỹ:\n${b.missedPoints.map((p) => `- ${p}`).join("\n")}\n` : ""}
BƯỚC 3 — recall: 3 câu hỏi tự luận ngắn kiểm tra hiểu (không hỏi vụn vặt), mỗi câu kèm đáp án ngắn dựa trên nguồn.

CHỈ trả JSON (không markdown fence) đúng dạng:
{"keyPoints":["..."],"turns":[{"s":"host","t":"...","c":[0]}],"recall":[{"q":"...","a":"..."}]}

NGUỒN:
"""
${b.sourceText}
"""`;

function parseScript(raw: string): Script {
  let cleaned = raw.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) cleaned = m[0];
  const o = JSON.parse(cleaned) as Partial<Script>;
  const keyPoints = (o.keyPoints ?? []).map((k) => String(k ?? "").trim()).filter(Boolean);
  const turns: Turn[] = (o.turns ?? [])
    .map((t) => ({
      s: (t?.s === "host" ? "host" : "expert") as Turn["s"],
      t: String(t?.t ?? "").replace(/[*#`]/g, "").replace(/\s*(→|⇒|->)\s*/g, ", ").trim(),
      c: Array.isArray(t?.c) ? t.c.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < keyPoints.length) : [],
    }))
    .filter((t) => t.t);
  const recall = (o.recall ?? [])
    .map((r) => ({ q: String(r?.q ?? "").trim(), a: String(r?.a ?? "").trim() }))
    .filter((r) => r.q);
  return { keyPoints, turns, recall };
}


/** Gọi Gemini (fallback qua danh sách model). Throw Error(message) khi thất bại. */
export async function generateScript(input: ScriptInput, apiKey: string, models?: string[]): Promise<{ script: Script; coveredCount: number; model: string }> {
  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT({ ...input, sourceText: input.sourceText.slice(0, 40_000), missedPoints: input.missedPoints?.slice(0, 30) }) }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 32768, responseMimeType: "application/json" },
  });
  const deadline = Date.now() + SCRIPT_DEADLINE_MS;
  const errors: string[] = [];
  for (const model of await textModels(apiKey, models)) {
    const left = deadline - Date.now();
    if (left < 15_000) { errors.push("hết thời gian chờ"); break; }
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody,
        signal: AbortSignal.timeout(left),
      });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      errors.push(timeout ? `${model}: quá thời gian` : `${model}: lỗi mạng`);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (isKeyError(res.status, body)) throw new Error(`Gemini API key không hợp lệ hoặc không có quyền (${res.status}). Kiểm tra lại trong Cài đặt → AI.`);
      // 404 = model đã bị khai tử / không tồn tại; 429/5xx = quá tải → thử model kế tiếp
      errors.push(`${model}: ${res.status === 404 ? "model không còn" : res.status === 429 ? "hết quota" : `lỗi ${res.status}`}`);
      continue;
    }
    let raw = "";
    try {
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[] };
      raw = (data.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      errors.push(`${model}: ${timeout ? "quá thời gian" : "phản hồi lỗi"}`);
      continue;
    }
    try {
      const script = parseScript(raw);
      if (script.turns.length < 4 || script.keyPoints.length === 0) { errors.push(`${model}: kịch bản quá ngắn`); continue; }
      const covered = new Set(script.turns.flatMap((t) => t.c));
      return { script, coveredCount: covered.size, model };
    } catch {
      errors.push(`${model}: JSON lỗi`);
    }
  }
  throw new Error(`Không viết được kịch bản — ${errors.join("; ") || "không có model Gemini nào khả dụng"}`);
}
