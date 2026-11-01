// Gemini TTS (server-only): gọi model (flash → lite khi hết quota) + WAV/PCM → MP3 48kbps.
// Tách khỏi route để test trực tiếp được.
// lamejs: bản "require" (iife) không export gì → luôn nạp bản ESM qua import() động.
type Mp3EncoderCtor = new (channels: number, sampleRate: number, kbps: number) => {
  encodeBuffer(left: Int16Array): Uint8Array;
  flush(): Uint8Array;
};
let encoderCtor: Promise<Mp3EncoderCtor> | null = null;
function loadEncoder(): Promise<Mp3EncoderCtor> {
  encoderCtor ??= import("@breezystack/lamejs").then((m) => {
    const mod = m as unknown as { Mp3Encoder?: Mp3EncoderCtor; default?: { Mp3Encoder?: Mp3EncoderCtor } };
    const ctor = mod.Mp3Encoder ?? mod.default?.Mp3Encoder;
    if (!ctor) throw new Error("Không nạp được bộ mã hoá MP3");
    return ctor;
  });
  return encoderCtor;
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TTS_MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-2.5-flash-preview-tts"];
export const VOICES = new Set(["Kore", "Charon"]);
export const DEFAULT_VOICE = "Kore";
/** Podcast: My (host) giọng nữ, Minh (expert) giọng nam. */
const SPEAKERS = { host: { name: "My", voice: "Kore" }, expert: { name: "Minh", voice: "Charon" } } as const;
export const MAX_CHARS = 3000;

export type DialogueTurn = { speaker: "host" | "expert"; text: string };

/** WAV (RIFF) hoặc PCM L16 thô → mẫu 16-bit + sample rate. */
function toPcm(buf: Buffer, mimeType: string): { samples: Int16Array; rate: number } {
  if (buf.subarray(0, 4).toString() === "RIFF") {
    let rate = 24000;
    let o = 12;
    while (o + 8 <= buf.length) {
      const id = buf.subarray(o, o + 4).toString();
      const size = buf.readUInt32LE(o + 4);
      if (id === "fmt ") rate = buf.readUInt32LE(o + 12);
      if (id === "data") {
        const data = buf.subarray(o + 8, Math.min(buf.length, o + 8 + size));
        return { samples: new Int16Array(data.buffer, data.byteOffset, Math.floor(data.length / 2)), rate };
      }
      o += 8 + size + (size % 2);
    }
    throw new Error("WAV không có dữ liệu");
  }
  const rate = Number(mimeType.match(/rate=(\d+)/)?.[1] ?? 24000);
  const copy = Buffer.from(buf); // căn chỉnh 2 byte cho Int16Array
  return { samples: new Int16Array(copy.buffer, copy.byteOffset, Math.floor(copy.length / 2)), rate };
}

async function encodeMp3(samples: Int16Array, rate: number): Promise<Buffer> {
  const Mp3Encoder = await loadEncoder();
  const enc = new Mp3Encoder(1, rate, 48);
  const out: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += 1152) {
    const chunk = enc.encodeBuffer(samples.subarray(i, i + 1152));
    // Copy từng khối cho chắc — không phụ thuộc cách lamejs quản lý bộ đệm nội bộ
    if (chunk.length) out.push(Buffer.from(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)));
  }
  const tail = enc.flush();
  if (tail.length) out.push(Buffer.from(new Uint8Array(tail.buffer, tail.byteOffset, tail.byteLength)));
  return Buffer.concat(out);
}

export function requestBody(input: { text?: string; voice: string; dialogue?: DialogueTurn[] }) {
  if (input.dialogue) {
    return {
      // Model TTS mới bắt buộc mỗi part ghi rõ người nói
      contents: [{ parts: input.dialogue.map((d) => ({ text: d.text, speechMetadata: { speaker: SPEAKERS[d.speaker].name } })) }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs: Object.values(SPEAKERS).map((s) => ({
          speaker: s.name, voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } },
        })) } },
      },
    };
  }
  return {
    contents: [{ parts: [{ text: input.text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: input.voice } } },
    },
  };
}

export async function synthesize(body: object, apiKey: string): Promise<Buffer> {
  let lastStatus = 0;
  for (const model of TTS_MODELS) {
    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      lastStatus = res.status;
      if ([429, 500, 503, 404].includes(res.status)) continue; // hết quota / quá tải / model không có → model kế
      throw Object.assign(new Error(`Gemini TTS lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`), { status: 502 });
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[] };
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!part) { lastStatus = 502; continue; }
    const { samples, rate } = toPcm(Buffer.from(part.data, "base64"), part.mimeType);
    return await encodeMp3(samples, rate);
  }
  if (lastStatus === 429) throw Object.assign(new Error("Hết lượt đọc miễn phí của Gemini hôm nay — thử lại sau"), { status: 429 });
  throw Object.assign(new Error(`Gemini TTS lỗi ${lastStatus || "không rõ"}`), { status: 502 });
}
