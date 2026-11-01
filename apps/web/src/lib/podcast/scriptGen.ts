// Sinh kịch bản podcast (server-only): prompt giữ chiều sâu + parse + đếm độ phủ ý bắt buộc.
// Tách khỏi route để test trực tiếp được.
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
function textModels(models?: string[]): string[] {
  const list = (models ?? []).filter((m) => !/tts|image|embedding|imagen|veo|live|audio/i.test(m));
  return list.length > 0 ? list : DEFAULT_MODELS;
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
  let lastError = "";
  for (const model of textModels(models)) {
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody,
      });
    } catch (e) { lastError = `Network ${model}: ${e}`; continue; }
    if (!res.ok) {
      lastError = `Gemini ${res.status} on ${model}`;
      if (![429, 503, 500].includes(res.status)) throw new Error(`${lastError}: ${(await res.text()).slice(0, 300)}`);
      continue;
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    try {
      const script = parseScript(raw);
      if (script.turns.length < 4 || script.keyPoints.length === 0) { lastError = `Kịch bản quá ngắn từ ${model}`; continue; }
      const covered = new Set(script.turns.flatMap((t) => t.c));
      return { script, coveredCount: covered.size, model };
    } catch {
      lastError = `Không parse được JSON từ ${model}`;
    }
  }
  throw new Error(`Gemini lỗi. ${lastError}`);
}
