export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptProgress {
  phase: "loading" | "extracting" | "transcribing" | "translating" | "done" | "error";
  chunkIndex?: number;
  totalChunks?: number;
  message: string;
}

export type OutputMode = "source" | "vi" | "en" | "bilingual";

// 16kHz mono 16-bit = 32KB/s → 25s ≈ 800KB WAV → base64 ≈ 1.07MB
// Convex string limit ~1MB — giữ 25s để vừa đủ
const CHUNK_DURATION_SECS = 25;
const GROQ_MAX_BYTES = 24 * 1024 * 1024;

async function decodeAudio(url: string): Promise<AudioBuffer> {
  const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  return audioCtx.decodeAudioData(arrayBuffer);
}

function encodeWav(buffer: AudioBuffer, startSample: number, endSample: number): Blob {
  const sampleRate = buffer.sampleRate;
  const numChannels = 1;
  const numSamples = endSample - startSample;
  const byteCount = numSamples * 2;

  const arrayBuf = new ArrayBuffer(44 + byteCount);
  const view = new DataView(arrayBuf);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + byteCount, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, byteCount, true);

  const channelData = buffer.getChannelData(0);
  let offset = 44;
  for (let i = startSample; i < endSample; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuf], { type: "audio/wav" });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeMedia(
  sourceUrl: string,
  _mimeType: string,
  transcribeChunkFn: (args: {
    audioBase64: string;
    mimeType: string;
    fileName: string;
    chunkIndex: number;
    timeOffsetSeconds: number;
    language?: string;
  }) => Promise<{ segments: TranscriptSegment[]; language: string }>,
  onProgress?: (p: TranscriptProgress) => void,
  audioLanguage?: string,
  outputMode: OutputMode = "source",
  translateFn?: (args: {
    transcriptId: string;
    targetLanguage: string;
  }) => Promise<TranscriptSegment[]>,
  transcriptId?: string,
): Promise<{
  segments: TranscriptSegment[];
  language: string;
  translatedSegments?: TranscriptSegment[];
  translatedLanguage?: string;
}> {
  onProgress?.({ phase: "loading", message: "Đang tải âm thanh..." });

  const audioBuffer = await decodeAudio(sourceUrl);
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;
  const samplesPerChunk = CHUNK_DURATION_SECS * sampleRate;
  const numChunks = Math.ceil(totalSamples / samplesPerChunk);

  onProgress?.({ phase: "extracting", message: "Đang chuẩn bị chunks..." });

  const allSegments: TranscriptSegment[] = [];
  let detectedLanguage = audioLanguage ?? "vi";

  for (let i = 0; i < numChunks; i++) {
    const startSample = i * samplesPerChunk;
    const endSample = Math.min(startSample + samplesPerChunk, totalSamples);
    const timeOffset = i * CHUNK_DURATION_SECS;

    onProgress?.({
      phase: "transcribing",
      chunkIndex: i + 1,
      totalChunks: numChunks,
      message: `Đang nhận dạng giọng nói... (${i + 1}/${numChunks})`,
    });

    const wavBlob = encodeWav(audioBuffer, startSample, endSample);

    if (wavBlob.size > GROQ_MAX_BYTES) {
      console.warn(`Chunk ${i} quá lớn (${wavBlob.size} bytes), bỏ qua`);
      continue;
    }

    const audioBase64 = await blobToBase64(wavBlob);

    // Groq free tier: 20 RPM → đợi 3s giữa mỗi chunk để không bị rate limit
    if (i > 0) await new Promise((r) => setTimeout(r, 3100));

    const result = await transcribeChunkFn({
      audioBase64,
      mimeType: "audio/wav",
      fileName: `chunk_${i}.wav`,
      chunkIndex: i,
      timeOffsetSeconds: timeOffset,
      language: audioLanguage,
    });

    allSegments.push(...result.segments);
    if (result.language) detectedLanguage = result.language;
  }

  const deduped = deduplicateSegments(allSegments);

  if (outputMode === "source") {
    onProgress?.({ phase: "done", message: "Hoàn tất!" });
    return { segments: deduped, language: detectedLanguage };
  }

  const targetLang = outputMode === "bilingual"
    ? (detectedLanguage === "vi" ? "en" : "vi")
    : outputMode;

  const needTranslate = targetLang !== detectedLanguage;

  if (!needTranslate) {
    onProgress?.({ phase: "done", message: "Hoàn tất!" });
    return { segments: deduped, language: detectedLanguage };
  }

  if (!translateFn || !transcriptId) throw new Error("translateFn and transcriptId required");

  onProgress?.({ phase: "translating", message: "Đang dịch..." });
  const translated = await translateFn({ transcriptId, targetLanguage: targetLang });

  if (outputMode === "bilingual") {
    onProgress?.({ phase: "done", message: "Hoàn tất!" });
    return {
      segments: deduped,
      language: detectedLanguage,
      translatedSegments: translated,
      translatedLanguage: targetLang,
    };
  }

  onProgress?.({ phase: "done", message: "Hoàn tất!" });
  return { segments: translated, language: targetLang };
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function deduplicateSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length === 0) return segments;

  const result: TranscriptSegment[] = [];
  let streak = 1;
  const MAX_STREAK = 2;

  for (let i = 0; i < segments.length; i++) {
    const cur = normalize(segments[i].text);
    const prev = i > 0 ? normalize(segments[i - 1].text) : null;

    if (cur === prev) {
      streak++;
    } else {
      streak = 1;
    }

    if (streak <= MAX_STREAK) {
      result.push(segments[i]);
    }
  }

  return result;
}
