// POST { text, voice? } | { dialogue: [{ speaker: "host"|"expert", text }] } → { url } — MP3 đọc to.
// Engine: Gemini TTS bằng key của user (Free tier → hết quota chỉ 429, không bao giờ tính tiền).
// flash hết quota → tự lùi sang lite (quota riêng). Gemini trả WAV 24kHz → encode MP3 48kbps
// → cache R2 theo hash nội dung; đoạn đã sinh không gọi Gemini lần 2.
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, R2_BUCKET } from "@/lib/r2";
import { VOICES, DEFAULT_VOICE, MAX_CHARS, requestBody, synthesize, type DialogueTurn } from "@/lib/tts/geminiTts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { text?: string; voice?: string; dialogue?: DialogueTurn[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const dialogue = Array.isArray(body.dialogue)
    ? body.dialogue
        .map((d) => ({ speaker: (d?.speaker === "host" ? "host" : "expert") as DialogueTurn["speaker"], text: String(d?.text ?? "").trim() }))
        .filter((d) => d.text)
    : undefined;
  const text = (body.text ?? "").trim();
  const voice = body.voice && VOICES.has(body.voice) ? body.voice : DEFAULT_VOICE;
  const total = dialogue ? dialogue.reduce((s, d) => s + d.text.length, 0) : text.length;
  if (!total) return NextResponse.json({ error: "Thiếu nội dung" }, { status: 400 });
  if (total > MAX_CHARS) return NextResponse.json({ error: "Đoạn quá dài" }, { status: 400 });

  const content = dialogue ? `dialogue\n${dialogue.map((d) => `${d.speaker}:${d.text}`).join("\n")}` : `single:${voice}\n${text}`;
  const key = `tts/v2/${createHash("sha256").update(content).digest("hex")}.mp3`;
  const r2 = getR2Client();

  let cached = true;
  try { await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); } catch { cached = false; }

  if (!cached) {
    const { data: ai } = await supabase.from("userAiSettings").select("geminiApiKey").maybeSingle();
    const apiKey = (ai as { geminiApiKey?: string | null } | null)?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Chưa có Gemini API key (Cài đặt → AI)" }, { status: 400 });
    try {
      const mp3 = await synthesize(requestBody({ text, voice, dialogue }), apiKey);
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET, Key: key, Body: mp3, ContentType: "audio/mpeg",
        CacheControl: "public, max-age=31536000, immutable",
      }));
    } catch (e) {
      const status = (e as { status?: number }).status ?? 502;
      return NextResponse.json({ error: e instanceof Error ? e.message : "Không sinh được giọng đọc" }, { status });
    }
  }

  const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 6 * 3600 });
  return NextResponse.json({ url });
}
