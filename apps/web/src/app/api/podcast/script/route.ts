// POST { sourceText, episodeTitle, seriesTitle, episodeNo, episodeCount, prevTitle?, nextTitle?,
//        missedPoints?, geminiApiKey?, geminiModels? }
//   → { script: { keyPoints, turns: [{ s, t, c }], recall: [{ q, a }] }, coveredCount, model }
// Kịch bản podcast 2 giọng GIỮ CHIỀU SÂU — xem lib/podcast/scriptGen.ts.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateScript } from "@/lib/podcast/scriptGen";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  // Bắt buộc đăng nhập — route có thể dùng GEMINI_API_KEY của server làm dự phòng
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    sourceText?: string; episodeTitle?: string; seriesTitle?: string; episodeNo?: number; episodeCount?: number;
    prevTitle?: string; nextTitle?: string; missedPoints?: string[]; geminiApiKey?: string; geminiModels?: string[];
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const sourceText = (body.sourceText ?? "").trim();
  if (sourceText.length < 200) return NextResponse.json({ error: "Nội dung tập quá ngắn" }, { status: 400 });
  const apiKey = body.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Chưa cấu hình Gemini API key (Cài đặt)" }, { status: 400 });

  try {
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
