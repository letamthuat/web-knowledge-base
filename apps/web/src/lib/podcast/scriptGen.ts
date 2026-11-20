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
- Trình bày keyPoints THEO ĐÚNG THỨ TỰ đã liệt kê (0, 1, 2, …) — không nhảy cóc, không gộp nhiều ý vào 1 câu lướt qua.
- Mỗi lượt thoại có "c" = mảng chỉ số (0-based) các keyPoints mà lượt đó trình bày. Ý nào cũng phải xuất hiện trong "c" của ít nhất 1 lượt.
- TỰ KIỂM TRA trước khi trả JSON: duyệt từ ý 0 tới ý cuối, ý nào chưa có trong "c" của lượt nào thì VIẾT THÊM lượt thoại cho ý đó ngay tại vị trí của nó.
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
  const o = JSON.parse(stripFence(raw)) as Partial<Script>;
  const keyPoints = (o.keyPoints ?? []).map((k) => String(k ?? "").trim()).filter(Boolean);
  const turns: Turn[] = (o.turns ?? [])
    .map((t) => ({
      s: (t?.s === "host" ? "host" : "expert") as Turn["s"],
      t: cleanTurnText(t?.t),
      c: Array.isArray(t?.c) ? t.c.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < keyPoints.length) : [],
    }))
    .filter((t) => t.t);
  const recall = (o.recall ?? [])
    .map((r) => ({ q: String(r?.q ?? "").trim(), a: String(r?.a ?? "").trim() }))
    .filter((r) => r.q);
  return { keyPoints, turns, recall };
}



/** Làm sạch 1 lượt thoại: bỏ markdown/ký hiệu mà TTS sẽ đọc to. */
function cleanTurnText(t: unknown): string {
  return String(t ?? "").replace(/[*#`]/g, "").replace(/\s*(→|⇒|->)\s*/g, ", ").trim();
}

function stripFence(raw: string): string {
  let cleaned = raw.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) cleaned = m[0];
  return cleaned;
}

/**
 * Gọi Gemini, lần lượt qua danh sách model tới khi `accept` nhận kết quả (trả string = lý do loại → thử model kế).
 * Throw Error(message) khi mọi model đều thất bại hoặc hết hạn giờ.
 */
async function callGemini<T>(opts: {
  prompt: string; apiKey: string; models?: string[]; deadline: number; maxOutputTokens: number; temperature: number;
  accept: (raw: string) => T | string;
}): Promise<{ value: T; model: string }> {
  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: opts.prompt }] }],
    generationConfig: { temperature: opts.temperature, maxOutputTokens: opts.maxOutputTokens, responseMimeType: "application/json" },
  });
  const errors: string[] = [];
  for (const model of await textModels(opts.apiKey, opts.models)) {
    const left = opts.deadline - Date.now();
    if (left < 15_000) { errors.push("hết thời gian chờ"); break; }
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${opts.apiKey}`, {
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
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      raw = (data.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      errors.push(`${model}: ${timeout ? "quá thời gian" : "phản hồi lỗi"}`);
      continue;
    }
    let out: T | string;
    try { out = opts.accept(raw); } catch { out = "JSON lỗi"; }
    if (typeof out === "string") { errors.push(`${model}: ${out}`); continue; }
    return { value: out, model };
  }
  throw new Error(errors.join("; ") || "không có model Gemini nào khả dụng");
}

// ─── Bổ sung ý bị sót ───────────────────────────────────────────────────────

const PATCH_PROMPT = (b: { episodeTitle: string; sourceText: string; missed: { k: number; text: string }[] }) =>
`Bạn đang BỔ SUNG cho kịch bản podcast giáo dục 2 người bằng tiếng Việt, tập "${b.episodeTitle}".
"host" = My (người học tò mò, hỏi đúng chỗ khó), "expert" = Minh (chuyên gia, giải thích cơ chế và lý do).

Kịch bản hiện có đã BỎ SÓT các ý kiến thức bắt buộc sau (số trong ngoặc = mã ý):
${b.missed.map((m) => `[${m.k}] ${m.text}`).join("\n")}

Với MỖI ý, viết 2–6 lượt thoại trình bày KỸ ý đó dựa trên NGUỒN: nội dung cốt lõi, cơ chế/lý do, số liệu, điều kiện, giới hạn, ví dụ có trong nguồn.
- Đoạn này sẽ được CHÈN VÀO GIỮA kịch bản, ngay sau phần nói về ý liền trước, nên lượt đầu mở bằng câu nối tự nhiên (vd My: "À khoan, còn chuyện… thì sao anh?"). KHÔNG chào hỏi, KHÔNG tổng kết tập, KHÔNG nhắc "lúc nãy bỏ sót".
- Văn nói tự nhiên, KHÔNG markdown, KHÔNG emoji, KHÔNG ký hiệu như →, *, #. Mỗi lượt ≤ 700 ký tự. Code: nói nó làm gì và vì sao, không đọc cú pháp. Công thức: nói bằng lời.
- TUYỆT ĐỐI không bịa số liệu, tên nghiên cứu, trích dẫn không có trong nguồn.

CHỈ trả JSON (không markdown fence) đúng dạng — mỗi ý bị sót đúng 1 phần tử, "k" là mã ý:
{"patches":[{"k":0,"turns":[{"s":"host","t":"..."},{"s":"expert","t":"..."}]}]}

NGUỒN:
"""
${b.sourceText}
"""`;

type Patch = { k: number; turns: Turn[] };

/**
 * Chèn đoạn bổ sung vào đúng chỗ: ngay sau lượt cuối nói về ý có mã nhỏ hơn gần nhất (ý xếp theo
 * thứ tự nguồn), không chèn trước lời mở đầu và không chèn sau phần tổng kết (2 lượt cuối).
 */
export function mergePatches(script: Script, patches: Patch[]): Script {
  const turns = script.turns;
  const lastTurnOf = new Map<number, number>();
  const firstTurnOf = new Map<number, number>();
  turns.forEach((t, i) => t.c.forEach((k) => { lastTurnOf.set(k, i); if (!firstTurnOf.has(k)) firstTurnOf.set(k, i); }));
  const covered = [...lastTurnOf.keys()].sort((a, b) => a - b);
  const minPos = turns.length > 2 ? 1 : 0;
  const maxPos = turns.length > 4 ? turns.length - 2 : turns.length;
  const placed = patches.map((p) => {
    const prev = covered.filter((k) => k < p.k).pop();
    const next = covered.find((k) => k > p.k);
    let pos = prev != null ? lastTurnOf.get(prev)! + 1 : next != null ? firstTurnOf.get(next)! : maxPos;
    pos = Math.max(minPos, Math.min(maxPos, pos));
    return { ...p, pos };
  });
  // Chèn từ cuối lên để vị trí chưa xử lý không bị lệch; cùng vị trí thì ý nhỏ đứng trước.
  placed.sort((a, b) => b.pos - a.pos || b.k - a.k);
  const out = [...turns];
  for (const p of placed) out.splice(p.pos, 0, ...p.turns);
  return { ...script, turns: out };
}

export function missedIndexes(script: Script): number[] {
  const covered = new Set(script.turns.flatMap((t) => t.c));
  return script.keyPoints.map((_, i) => i).filter((i) => !covered.has(i));
}

/** Viết thêm lượt thoại cho các ý bị sót rồi chèn vào kịch bản (không viết lại cả tập). */
export async function patchScript(
  script: Script, input: Pick<ScriptInput, "sourceText" | "episodeTitle">, apiKey: string, models?: string[],
  deadline = Date.now() + SCRIPT_DEADLINE_MS,
): Promise<{ script: Script; coveredCount: number; model: string }> {
  const missed = missedIndexes(script).slice(0, 15);
  const coverage = (s: Script) => new Set(s.turns.flatMap((t) => t.c)).size;
  if (!missed.length) return { script, coveredCount: coverage(script), model: "" };
  const want = new Set(missed);
  let value: Patch[], model: string;
  try {
    ({ value, model } = await callGemini<Patch[]>({
      prompt: PATCH_PROMPT({
        episodeTitle: input.episodeTitle,
        sourceText: input.sourceText.slice(0, 40_000),
        missed: missed.map((k) => ({ k, text: script.keyPoints[k] })),
      }),
      apiKey, models, deadline, maxOutputTokens: 12288, temperature: 0.6,
      accept: (raw) => {
        const o = JSON.parse(stripFence(raw)) as { patches?: { k?: unknown; turns?: { s?: unknown; t?: unknown }[] }[] };
        const seen = new Set<number>();
        const patches = (o.patches ?? []).flatMap((p) => {
          const k = Number(p?.k);
          if (!want.has(k) || seen.has(k)) return [];
          const turns: Turn[] = (p.turns ?? [])
            .map((t) => ({ s: (t?.s === "host" ? "host" : "expert") as Turn["s"], t: cleanTurnText(t?.t), c: [k] }))
            .filter((t) => t.t);
          if (!turns.length) return [];
          seen.add(k);
          return [{ k, turns }];
        });
        return patches.length ? patches : "không bổ sung được ý nào";
      },
    }));
  } catch (e) {
    throw new Error(`Không bổ sung được ý sót — ${e instanceof Error ? e.message : e}`);
  }
  const merged = mergePatches(script, value);
  return { script: merged, coveredCount: coverage(merged), model };
}

// ─── Viết kịch bản ──────────────────────────────────────────────────────────

/** Viết kịch bản; còn ý sót thì tự gọi thêm 1 lượt bổ sung (nếu còn thời gian). */
export async function generateScript(input: ScriptInput, apiKey: string, models?: string[]): Promise<{ script: Script; coveredCount: number; model: string }> {
  const deadline = Date.now() + SCRIPT_DEADLINE_MS;
  const sourceText = input.sourceText.slice(0, 40_000);
  let result: { value: Script; model: string };
  try {
    result = await callGemini<Script>({
      prompt: PROMPT({ ...input, sourceText, missedPoints: input.missedPoints?.slice(0, 30) }),
      apiKey, models, deadline, maxOutputTokens: 32768, temperature: 0.7,
      accept: (raw) => {
        const script = parseScript(raw);
        return script.turns.length < 4 || script.keyPoints.length === 0 ? "kịch bản quá ngắn" : script;
      },
    });
  } catch (e) {
    throw new Error(`Không viết được kịch bản — ${e instanceof Error ? e.message : e}`);
  }
  let script = result.value;
  // Bổ sung ý sót: chỉ khi còn đủ thời gian; thất bại thì giữ bản đã có (user vẫn bấm "Bổ sung" được sau).
  if (missedIndexes(script).length > 0 && deadline - Date.now() > 45_000) {
    try {
      script = (await patchScript(script, { sourceText, episodeTitle: input.episodeTitle }, apiKey, [result.model, ...(models ?? [])], deadline)).script;
    } catch { /* giữ bản gốc */ }
  }
  const covered = new Set(script.turns.flatMap((t) => t.c));
  return { script, coveredCount: covered.size, model: result.model };
}
