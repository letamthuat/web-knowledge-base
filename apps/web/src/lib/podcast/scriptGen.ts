// Sinh kịch bản podcast (server-only): prompt giữ chiều sâu + parse + đếm độ phủ ý bắt buộc.
// Tách khỏi route để test trực tiếp được.
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Model text hiện hành (Google tự gợi ý gemini-3.8-flash khi 2.0-flash bị khai tử) — luôn được thử,
// kể cả khi danh sách trong Cài đặt của user đã cũ. Bổ sung thêm model tự phát hiện qua ListModels.
const PREFERRED = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-3.8-flash-lite"];
const NON_TEXT = /tts|image|embedding|imagen|veo|live|audio|native|preview-\d{2}-\d{2}|exp/i;
const MAX_MODELS = 8;
/** Model đã trả 404 (bị khai tử) — bỏ qua ở các lượt sau trong cùng instance server. */
const deadModels = new Set<string>();

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

/**
 * Thứ tự thử: model user chọn còn sống (tối đa 3) → model hiện hành → model tự phát hiện.
 * Danh sách trong Cài đặt có thể toàn model đã khai tử, nên không để nó chiếm hết lượt thử.
 */
async function textModels(apiKey: string, models?: string[]): Promise<string[]> {
  const alive = (m: string) => !NON_TEXT.test(m) && !deadModels.has(m) && !/gemini-(1\.|2\.0)/.test(m);
  const user = (models ?? []).filter(alive).slice(0, 3);
  const auto = (await discoverModels(apiKey)).filter(alive);
  return [...new Set([...user, ...PREFERRED.filter(alive), ...auto])].slice(0, MAX_MODELS);
}

/** Parse JSON trong phản hồi model: bỏ ``` fence, nhận cả object lẫn mảng ở cấp ngoài cùng. */
function parseJsonLoose(raw: string): unknown {
  const s = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { return JSON.parse(s); } catch { /* thử cắt phần JSON bên trong */ }
  const start = s.search(/[[{]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(s.slice(start, end + 1));
}

/** Lỗi do key (sai/hết hạn/không có quyền) → thử model khác cũng vô ích. */
function isKeyError(status: number, body: string): boolean {
  return status === 401 || /API_KEY_INVALID|API key not valid|API key expired|PERMISSION_DENIED/i.test(body);
}

/** e = chỉ dẫn diễn đạt ngắn cho giọng đọc (Gemini TTS `style`), vd "curious, playful". */
export type Turn = { s: "host" | "expert"; t: string; c: number[]; e?: string };

/** Thẻ âm thanh Gemini TTS hỗ trợ (tài liệu speech-generation) — chỉ giữ những thẻ hợp với podcast học. */
const AUDIO_TAGS = ["short pause", "long pause", "breath", "chuckle", "laugh", "sigh", "exhales", "gasp"];
const AUDIO_TAG_RE = new RegExp(`[<\\[](${AUDIO_TAGS.join("|")})s?[>\\]]`, "gi");

/** Phần dặn cách viết lời thoại để giọng đọc có nhấn nhá — dùng chung cho viết mới và bổ sung. */
const DELIVERY_RULES = `NHẤN NHÁ (kịch bản được đọc bằng giọng AI — viết để nghe hay, có cảm xúc):
- Mỗi lượt có "e" = chỉ dẫn diễn đạt TIẾNG ANH 2–6 từ cho giọng đọc, đổi theo nội dung lượt đó, vd: "curious, leaning in", "surprised, then thoughtful", "warm, explaining patiently", "calm, emphasizing the key point", "playful, light laugh", "slowing down for a tricky part", "confident, unhurried wrap-up". Không lặp một chỉ dẫn cho mọi lượt; không ghi giới tính/tuổi/tên.
- NHỊP: đây là podcast HỌC — người nghe cần kịp hiểu. Nhịp mặc định thong thả, rõ ràng; KHÔNG dùng chỉ dẫn kiểu "fast", "rapid", "excited rush", "energetic". Hào hứng thì thể hiện bằng ngữ điệu, không bằng tốc độ.
- Ngắt nghỉ tự nhiên bằng dấu phẩy, "..." (ngập ngừng, suy nghĩ) và " -- " (đổi ý, chen ngang). Khi giải thích chuỗi ý (số liệu, các bước, so sánh), tách thành câu ngắn, mỗi ý một câu, để giọng có chỗ nghỉ.
- Nhấn mạnh: VIẾT HOA 1 từ khoá quan trọng nhất trong câu cần nhấn (tối đa 1–2 chỗ mỗi lượt, không viết hoa cả câu).
- Có thể chèn thẻ âm thanh (viết đúng dạng ngoặc nhọn tiếng Anh): <short pause> trước ý quan trọng, <chuckle> khi có chút hài hước, <breath> trước câu giải thích dài, <sigh> khi nói về cái khó. Dùng TIẾT CHẾ: trung bình 1 thẻ mỗi 2–3 lượt.
- Có câu cảm thán, phản ứng ngắn tự nhiên của người nghe ("À, ra vậy!", "Khoan đã...", "Hay đấy!") để hội thoại có nhịp.`;
export type Script = { keyPoints: string[]; turns: Turn[]; recall: { q: string; a: string }[] };

export type ScriptInput = {
  sourceText: string; episodeTitle: string; seriesTitle: string; episodeNo: number; episodeCount: number;
  prevTitle?: string; nextTitle?: string; missedPoints?: string[];
};

/**
 * Số ký tự "văn xuôi" của nguồn — phần thật sự được nói ra: bỏ code, bảng, ảnh, URL, ký hiệu markdown.
 * Code/bảng vẫn được giải thích nhưng bằng lời ngắn hơn nhiều so với độ dài thô.
 */
export function proseChars(text: string): number {
  return text
    .replace(/(```|~~~)[\s\S]*?\1/g, " ")         // code fence
    .replace(/^\s*\|.*\|\s*$/gm, " ")               // dòng bảng
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")          // ảnh
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")        // link → chữ
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^#+\s.*$/gm, " ")                     // heading
    .replace(/^### \[.*\]$/gm, " ")
    .replace(/[*_`>#|~-]{2,}|[*_`>#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** Độ dài kịch bản mục tiêu (ký tự lời thoại) ≈ độ dài văn xuôi của nguồn — podcast học không nén. */
export function targetChars(sourceText: string): number {
  return Math.max(2500, Math.min(30_000, Math.round(proseChars(sourceText) * 1.05)));
}

export const scriptChars = (s: Script) => s.turns.reduce((n, t) => n + t.t.length, 0);

const PROMPT = (b: {
  sourceText: string; episodeTitle: string; seriesTitle: string; episodeNo: number; episodeCount: number;
  prevTitle?: string; nextTitle?: string; missedPoints?: string[]; target: number;
}) => `Bạn là biên kịch podcast giáo dục chuyên sâu bằng tiếng Việt. Chuyển NGUỒN dưới đây thành kịch bản hội thoại 2 người để người nghe HỌC ĐƯỢC THẬT — không phải tóm tắt lướt.

SERIES: "${b.seriesTitle}" — Tập ${b.episodeNo}/${b.episodeCount}: "${b.episodeTitle}"
${b.prevTitle ? `Tập trước: "${b.prevTitle}".` : "Đây là tập mở đầu series."}${b.nextTitle ? ` Tập sau: "${b.nextTitle}".` : ""}

NHÂN VẬT
- "host" = My: người học thông minh, tò mò. Hỏi đúng chỗ người mới sẽ vướng: "vì sao", "khác gì với…", "cho ví dụ thực tế", "nếu … thì sao", phản biện, và thỉnh thoảng tự diễn đạt lại bằng lời mình để Minh xác nhận/sửa.
- "expert" = Minh: chuyên gia, giải thích CƠ CHẾ và lý do, không chỉ định nghĩa.

BƯỚC 1 — keyPoints: liệt kê MỌI ý kiến thức bắt buộc trong nguồn (thường 8–25 ý). Mỗi ý phải CỤ THỂ: tên khái niệm + nội dung cốt lõi, kèm số liệu/công thức/điều kiện/giới hạn nếu nguồn có. Không viết ý chung chung kiểu "hiểu tầm quan trọng của X".

BƯỚC 2 — turns: kịch bản phủ TẤT CẢ keyPoints.
- Độ sâu ưu tiên hơn độ ngắn: KHÔNG lược bỏ chi tiết, ví dụ, số liệu, ngoại lệ, giới hạn có trong nguồn.
- ĐỘ DÀI BẮT BUỘC: tổng số ký tự của mọi "t" khoảng ${b.target.toLocaleString("vi-VN")} ký tự (TỐI THIỂU ${Math.round(b.target * 0.85).toLocaleString("vi-VN")}), tức khoảng ${Math.round(b.target / 330)} lượt thoại. Đây là podcast HỌC — người nghe thay việc đọc nguồn bằng nghe, nên kịch bản ngắn hơn nguồn nghĩa là đã bỏ mất kiến thức. Mỗi ý chính cần vài lượt hỏi–đáp: nêu ý, giải thích cơ chế/lý do, ví dụ hoặc số liệu từ nguồn, rồi My tự diễn đạt lại hoặc hỏi "nếu… thì sao".
- Trình bày keyPoints THEO ĐÚNG THỨ TỰ đã liệt kê (0, 1, 2, …) — không nhảy cóc, không gộp nhiều ý vào 1 câu lướt qua.
- Mỗi lượt thoại có "c" = mảng chỉ số (0-based) các keyPoints mà lượt đó trình bày. Ý nào cũng phải xuất hiện trong "c" của ít nhất 1 lượt.
- TỰ KIỂM TRA trước khi trả JSON: duyệt từ ý 0 tới ý cuối, ý nào chưa có trong "c" của lượt nào thì VIẾT THÊM lượt thoại cho ý đó ngay tại vị trí của nó.
- Code: giải thích từng bước nó làm gì và vì sao viết vậy — KHÔNG đọc cú pháp, ký hiệu. Công thức: nói bằng lời từng thành phần nghĩa là gì và trực giác của nó. Bảng: nói ra các so sánh/điểm khác biệt chính.
- Giữ thuật ngữ gốc (thường tiếng Anh) và giải nghĩa tiếng Việt ở lần đầu.
- Ví dụ minh hoạ thêm ngoài nguồn được phép nhưng phải nói rõ là "ví dụ"; TUYỆT ĐỐI không bịa số liệu, tên nghiên cứu, trích dẫn không có trong nguồn.
- Văn nói tự nhiên, câu không quá dài, KHÔNG markdown, KHÔNG emoji, KHÔNG ký hiệu như →, *, #. Mỗi lượt ≤ 700 ký tự; luân phiên tự nhiên (có thể 2 lượt liền của Minh khi giải thích dài).
- Mở đầu: My chào, giới thiệu tập ${b.episodeNo}${b.prevTitle ? " (nối 1 câu với tập trước)" : ""} và nêu 1 câu hỏi gợi tò mò. Kết: My tóm lại 3–5 ý cốt lõi bằng lời mình, Minh chốt điều dễ hiểu sai nhất.

${DELIVERY_RULES}
${b.missedPoints?.length ? `\nLƯU Ý: lần trước kịch bản BỎ SÓT các ý sau — lần này phải trình bày kỹ:\n${b.missedPoints.map((p) => `- ${p}`).join("\n")}\n` : ""}
BƯỚC 3 — recall: 3 câu hỏi tự luận ngắn kiểm tra hiểu (không hỏi vụn vặt), mỗi câu kèm đáp án ngắn dựa trên nguồn.

CHỈ trả JSON (không markdown fence) đúng dạng:
{"keyPoints":["..."],"turns":[{"s":"host","e":"curious, upbeat","t":"...","c":[0]}],"recall":[{"q":"...","a":"..."}]}

NGUỒN:
"""
${b.sourceText}
"""`;

function parseScript(raw: string): Script {
  const o = parseJsonLoose(raw) as Partial<Script>;
  const keyPoints = (o.keyPoints ?? []).map((k) => String(k ?? "").trim()).filter(Boolean);
  const turns: Turn[] = (o.turns ?? [])
    .map((t) => ({
      s: (t?.s === "host" ? "host" : "expert") as Turn["s"],
      t: cleanTurnText(t?.t),
      e: cleanStyle(t?.e),
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
  const tags: string[] = [];
  return String(t ?? "")
    // Giữ thẻ âm thanh hợp lệ (chuẩn hoá về <...>), bỏ mọi thẻ/ngoặc nhọn khác để TTS không đọc to
    .replace(AUDIO_TAG_RE, (_, name: string) => { tags.push(`<${name.toLowerCase()}>`); return `\u0000${tags.length - 1}\u0000`; })
    .replace(/<[^>]*>/g, "")
    .replace(/[*#`]/g, "")
    .replace(/\s*(→|⇒|->)\s*/g, ", ")
    .replace(/\u0000(\d+)\u0000/g, (_, i: string) => tags[Number(i)])
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Chỉ dẫn diễn đạt: chữ thường gọn, ≤ 80 ký tự, không ký tự lạ. */
function cleanStyle(e: unknown): string | undefined {
  const s = String(e ?? "").replace(/[^\p{L}\p{N} ,.'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return s.length >= 3 ? s : undefined;
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
      if (res.status === 404) deadModels.add(model);
      errors.push(`${model}: ${res.status === 404 ? "model không còn" : res.status === 429 ? "hết quota" : res.status === 503 ? "đang quá tải" : `lỗi ${res.status}`}`);
      continue;
    }
    let raw = "";
    let finish = "";
    try {
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[] };
      raw = (data.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
      finish = data.candidates?.[0]?.finishReason ?? "";
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      errors.push(`${model}: ${timeout ? "quá thời gian" : "phản hồi lỗi"}`);
      continue;
    }
    let out: T | string;
    try { out = opts.accept(raw); } catch { out = finish === "MAX_TOKENS" ? "trả lời bị cắt (quá dài)" : "JSON lỗi"; }
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

${DELIVERY_RULES}

CHỈ trả JSON (không markdown fence) đúng dạng — mỗi ý bị sót đúng 1 phần tử, "k" là mã ý:
{"patches":[{"k":0,"turns":[{"s":"host","e":"curious, leaning in","t":"..."},{"s":"expert","e":"warm, explaining patiently","t":"..."}]}]}

NGUỒN:
"""
${b.sourceText}
"""`;

type Patch = { k: number; turns: Turn[] };

/**
 * Chèn đoạn bổ sung vào đúng chỗ, không chèn trước lời mở đầu và không sau phần tổng kết (2 lượt cuối).
 * - "missing": ý chưa được nói → ngay sau lượt cuối nói về ý có mã nhỏ hơn gần nhất (ý xếp theo thứ tự nguồn).
 * - "deepen": ý đã nói nhưng mỏng → ngay sau lượt cuối nói về CHÍNH ý đó.
 */
export function mergePatches(script: Script, patches: Patch[], mode: "missing" | "deepen" = "missing"): Script {
  const turns = script.turns;
  const lastTurnOf = new Map<number, number>();
  const firstTurnOf = new Map<number, number>();
  turns.forEach((t, i) => t.c.forEach((k) => { lastTurnOf.set(k, i); if (!firstTurnOf.has(k)) firstTurnOf.set(k, i); }));
  const covered = [...lastTurnOf.keys()].sort((a, b) => a - b);
  const minPos = turns.length > 2 ? 1 : 0;
  const maxPos = turns.length > 4 ? turns.length - 2 : turns.length;
  const placed = patches.map((p) => {
    const own = lastTurnOf.get(p.k);
    if (mode === "deepen" && own != null) return { ...p, pos: Math.max(minPos, Math.min(maxPos, own + 1)) };
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

/** Đọc {"patches":[{k, turns}]} (hoặc mảng trần) → chỉ giữ ý thuộc `want`, mỗi ý 1 lần. */
function parsePatches(raw: string, want: Set<number>): Patch[] {
  type RawPatch = { k?: unknown; turns?: { s?: unknown; t?: unknown; e?: unknown }[] };
  const parsed = parseJsonLoose(raw) as { patches?: RawPatch[] } | RawPatch[];
  // Model đôi khi trả thẳng mảng thay vì {"patches": [...]}
  const list = Array.isArray(parsed) ? parsed : parsed?.patches ?? [];
  const seen = new Set<number>();
  return list.flatMap((p) => {
    const k = Number(p?.k);
    if (!want.has(k) || seen.has(k)) return [];
    const turns: Turn[] = (p.turns ?? [])
      .map((t) => ({ s: (t?.s === "host" ? "host" : "expert") as Turn["s"], t: cleanTurnText(t?.t), e: cleanStyle(t?.e), c: [k] }))
      .filter((t) => t.t);
    if (!turns.length) return [];
    seen.add(k);
    return [{ k, turns }];
  });
}

const coverage = (s: Script) => new Set(s.turns.flatMap((t) => t.c)).size;

/** Viết thêm lượt thoại cho các ý bị sót rồi chèn vào kịch bản (không viết lại cả tập). */
export async function patchScript(
  script: Script, input: Pick<ScriptInput, "sourceText" | "episodeTitle">, apiKey: string, models?: string[],
  deadline = Date.now() + SCRIPT_DEADLINE_MS,
): Promise<{ script: Script; coveredCount: number; model: string }> {
  const missed = missedIndexes(script).slice(0, 15);
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
      // Rộng tay: model "thinking" (2.5+) tính cả token suy nghĩ vào giới hạn → 12k dễ bị cắt cụt JSON
      apiKey, models, deadline, maxOutputTokens: 32768, temperature: 0.6,
      accept: (raw) => {
        const patches = parsePatches(raw, want);
        return patches.length ? patches : "không bổ sung được ý nào";
      },
    }));
  } catch (e) {
    throw new Error(`Không bổ sung được ý sót — ${e instanceof Error ? e.message : e}`);
  }
  const merged = mergePatches(script, value, "missing");
  return { script: merged, coveredCount: coverage(merged), model };
}

// ─── Đào sâu khi kịch bản quá ngắn ──────────────────────────────────────────

const DEEPEN_PROMPT = (b: {
  episodeTitle: string; sourceText: string; current: number; target: number;
  points: { k: number; text: string; said: string; add: number }[];
}) =>
`Kịch bản podcast HỌC tập "${b.episodeTitle}" (2 người: "host" = My, người học tò mò; "expert" = Minh, chuyên gia) đang QUÁ NGẮN so với nguồn: hiện ${b.current.toLocaleString("vi-VN")} ký tự, cần khoảng ${b.target.toLocaleString("vi-VN")}. Người nghe dùng podcast THAY cho việc đọc nguồn, nên phần bị nói lướt là kiến thức bị mất.

Hãy ĐÀO SÂU từng ý dưới đây: viết THÊM lượt thoại mới, nối tiếp ngay sau phần đã nói về ý đó, đưa vào những gì NGUỒN có mà kịch bản CHƯA nói — cơ chế/lý do, số liệu, ví dụ, ngoại lệ, giới hạn, so sánh, hệ quả thực tế. My hỏi sâu hơn ("vì sao vậy?", "cho ví dụ thực tế?", "nếu… thì sao?") hoặc tự diễn đạt lại để Minh xác nhận/sửa.
- KHÔNG lặp lại điều đã nói (xem "ĐÃ NÓI"), KHÔNG chào hỏi, KHÔNG tổng kết tập. Lượt đầu nối tự nhiên với câu trước đó.
- Nguồn không còn gì thêm cho một ý thì bỏ qua ý đó (đừng bịa, đừng nói vòng vo cho dài).
- Văn nói, KHÔNG markdown/emoji/ký hiệu →, *, #. Mỗi lượt ≤ 700 ký tự. TUYỆT ĐỐI không bịa số liệu, tên nghiên cứu, trích dẫn ngoài nguồn.

${DELIVERY_RULES}

CÁC Ý CẦN ĐÀO SÂU (số trong ngoặc = mã ý; "thêm ~N ký tự" là lượng nên viết thêm):
${b.points.map((p) => `[${p.k}] ${p.text} — thêm ~${p.add} ký tự\n    ĐÃ NÓI: "${p.said}"`).join("\n")}

CHỈ trả JSON (không markdown fence) đúng dạng, "k" là mã ý:
{"patches":[{"k":0,"turns":[{"s":"host","e":"curious, leaning in","t":"..."},{"s":"expert","e":"warm, explaining patiently","t":"..."}]}]}

NGUỒN:
"""
${b.sourceText}
"""`;

/**
 * Kịch bản ngắn hơn mục tiêu → viết thêm cho các ý đang "mỏng" nhất (ít ký tự nhất), chèn ngay sau
 * phần đã nói về ý đó. Không viết lại cả tập nên giữ nguyên phần đã có.
 */
export async function deepenScript(
  script: Script, input: Pick<ScriptInput, "sourceText" | "episodeTitle">, apiKey: string, models?: string[],
  deadline = Date.now() + SCRIPT_DEADLINE_MS,
): Promise<{ script: Script; coveredCount: number; model: string }> {
  const sourceText = input.sourceText.slice(0, 40_000);
  const target = targetChars(sourceText);
  const current = scriptChars(script);
  const deficit = target - current;
  if (deficit < target * 0.1) throw new Error("Kịch bản đã đủ dài so với nguồn");

  // Ký tự mỗi ý nhận được (lượt nói nhiều ý thì chia đều) + lời đã nói để model khỏi lặp
  const chars = script.keyPoints.map(() => 0);
  const said = script.keyPoints.map(() => [] as string[]);
  for (const t of script.turns) {
    for (const k of t.c) { chars[k] += t.t.length / t.c.length; said[k].push(t.t); }
  }
  const avg = target / Math.max(1, script.keyPoints.length);
  const thin = script.keyPoints
    .map((text, k) => ({ k, text, have: chars[k] }))
    .filter((p) => p.have < avg * 0.9)
    .sort((a, b) => a.have - b.have)
    .slice(0, 12);
  const pick = thin.length ? thin : script.keyPoints.map((text, k) => ({ k, text, have: chars[k] })).slice(0, 12);
  const totalGap = pick.reduce((s, p) => s + Math.max(0, avg - p.have), 0) || 1;
  const points = pick.map((p) => ({
    k: p.k, text: p.text,
    said: said[p.k].join(" ").replace(/<[^>]*>/g, "").slice(0, 900) || "(chưa nói gì cụ thể)",
    add: Math.round(Math.max(300, Math.min(2500, (deficit * Math.max(0, avg - p.have)) / totalGap)) / 50) * 50,
  }));

  const want = new Set(points.map((p) => p.k));
  let value: Patch[], model: string;
  try {
    ({ value, model } = await callGemini<Patch[]>({
      prompt: DEEPEN_PROMPT({ episodeTitle: input.episodeTitle, sourceText, current, target, points }),
      apiKey, models, deadline, maxOutputTokens: 32768, temperature: 0.6,
      accept: (raw) => {
        const patches = parsePatches(raw, want);
        return patches.length ? patches : "không đào sâu được ý nào";
      },
    }));
  } catch (e) {
    throw new Error(`Không đào sâu được — ${e instanceof Error ? e.message : e}`);
  }
  const merged = mergePatches(script, value, "deepen");
  return { script: merged, coveredCount: coverage(merged), model };
}

// ─── Viết kịch bản ──────────────────────────────────────────────────────────

/**
 * Viết kịch bản theo độ dài mục tiêu; sau đó (nếu còn thời gian) tự bổ sung ý sót và
 * tự đào sâu khi kịch bản vẫn ngắn hơn 75% mục tiêu. Bước phụ thất bại thì giữ bản đã có.
 */
export async function generateScript(input: ScriptInput, apiKey: string, models?: string[]): Promise<{ script: Script; coveredCount: number; model: string }> {
  const deadline = Date.now() + SCRIPT_DEADLINE_MS;
  const sourceText = input.sourceText.slice(0, 40_000);
  const target = targetChars(sourceText);
  let result: { value: Script; model: string };
  try {
    result = await callGemini<Script>({
      prompt: PROMPT({ ...input, sourceText, missedPoints: input.missedPoints?.slice(0, 30), target }),
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
  const sub = { sourceText, episodeTitle: input.episodeTitle };
  const subModels = [result.model, ...(models ?? [])];
  if (missedIndexes(script).length > 0 && deadline - Date.now() > 45_000) {
    try { script = (await patchScript(script, sub, apiKey, subModels, deadline)).script; } catch { /* giữ bản gốc */ }
  }
  if (scriptChars(script) < target * 0.75 && deadline - Date.now() > 60_000) {
    try { script = (await deepenScript(script, sub, apiKey, subModels, deadline)).script; } catch { /* giữ bản đã có */ }
  }
  return { script, coveredCount: coverage(script), model: result.model };
}
