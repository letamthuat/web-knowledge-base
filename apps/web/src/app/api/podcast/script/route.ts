// POST { sourceText, episodeTitle, seriesTitle, episodeNo, episodeCount, prevTitle?, nextTitle?,
//        missedPoints?, geminiApiKey?, geminiModels?, script? }
//   script có mặt → chế độ "bổ sung": chỉ viết thêm lượt cho ý bị sót và chèn vào kịch bản đó.
//   → { script: { keyPoints, turns: [{ s, t, c }], recall: [{ q, a }] }, coveredCount, model }
// Kịch bản podcast 2 giọng GIỮ CHIỀU SÂU — xem lib/podcast/scriptGen.ts.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateScript, patchScript, type Script } from "@/lib/podcast/scriptGen";

export const dynamic = "force-dynamic";
// Kịch bản dài (~16k ký tự) có thể mất 1–3 phút; scriptGen tự dừng trước hạn này (SCRIPT_DEADLINE_MS).
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Bắt buộc đăng nhập — route có thể dùng GEMINI_API_KEY của server làm dự phòng
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    sourceText?: string; episodeTitle?: string; seriesTitle?: string; episodeNo?: number; episodeCount?: number;
    prevTitle?: string; nextTitle?: string; missedPoints?: string[]; geminiApiKey?: string; geminiModels?: string[];
    script?: Script;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const sourceText = (body.sourceText ?? "").trim();
  if (sourceText.length < 200) return NextResponse.json({ error: "Nội dung tập quá ngắn" }, { status: 400 });
  const apiKey = body.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình Gemini API key (Cài đặt)" }, { status: 400 });

  try {
    // Chế độ bổ sung: gửi kèm kịch bản hiện có → chỉ viết thêm lượt cho ý sót rồi chèn vào.
    if (body.script) {
      const script = body.script;
      if (!Array.isArray(script.keyPoints) || !Array.isArray(script.turns)) {
        return NextResponse.json({ error: "Kịch bản không hợp lệ" }, { status: 400 });
      }
      const result = await patchScript(script, { sourceText, episodeTitle: body.episodeTitle ?? "" }, apiKey, body.geminiModels);
      return NextResponse.json(result);
    }
    const result = await generateScript({
      sourceText,
      episodeTitle: body.episodeTitle ?? "",
      seriesTitle: body.seriesTitle ?? "",
      episodeNo: body.episodeNo ?? 1,
      episodeCount: body.episodeCount ?? 1,
      prevTitle: body.prevTitle,
      nextTitle: body.nextTitle,
      missedPoints: body.missedPoints,
    }, apiKey, body.geminiModels);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sinh kịch bản thất bại" }, { status: 502 });
  }
}
