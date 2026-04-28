export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptProgress {
  phase: "loading" | "extracting" | "transcribing" | "done" | "error";
  chunkIndex?: number;
  totalChunks?: number;
  message: string;
}

// 16kHz mono 16-bit = 32KB/s → 90s ≈ 2.8MB WAV → base64 ≈ 3.7MB < 5MB Convex limit
const CHUNK_DURATION_SECS = 90;
const GROQ_MAX_BYTES = 24 * 1024 * 1024;

// Dùng Web Audio API để decode audio rồi encode thành WAV chunks
// Không cần ffmpeg wasm — hoạt động trên mọi browser
async function decodeAudio(url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  return audioCtx.decodeAudioData(arrayBuffer);
}

// Encode AudioBuffer slice thành WAV Blob
function encodeWav(buffer: AudioBuffer, startSample: number, endSample: number): Blob {
  const sampleRate = buffer.sampleRate;
  const numChannels = 1; // mono
  const numSamples = endSample - startSample;
  const byteCount = numSamples * 2; // 16-bit PCM

  const arrayBuf = new ArrayBuffer(44 + byteCount);
  const view = new DataView(arrayBuf);

  // WAV header
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + byteCount, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, byteCount, true);

  // Mix down to mono và write PCM samples
  const channelData = buffer.getChannelData(0);
  let offset = 44;
  for (let i = startSample; i < endSample; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuf], { type: "audio/wav" });
}

// Convert Blob → base64
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
  }) => Promise<{ segments: TranscriptSegment[]; language: string }>,
  onProgress?: (p: TranscriptProgress) => void,
): Promise<{ segments: TranscriptSegment[]; language: string }> {
  onProgress?.({ phase: "loading", message: "Đang tải âm thanh..." });

  const audioBuffer = await decodeAudio(sourceUrl);
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;
  const samplesPerChunk = CHUNK_DURATION_SECS * sampleRate;
  const numChunks = Math.ceil(totalSamples / samplesPerChunk);

  onProgress?.({ phase: "extracting", message: "Đang chuẩn bị chunks..." });

  const allSegments: TranscriptSegment[] = [];
  let language = "vi";

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

    // Nếu chunk quá lớn, bỏ qua (không nên xảy ra với 5 phút @ 16kHz mono)
    if (wavBlob.size > GROQ_MAX_BYTES) {
      console.warn(`Chunk ${i} quá lớn (${wavBlob.size} bytes), bỏ qua`);
      continue;
    }

    const audioBase64 = await blobToBase64(wavBlob);
    const result = await transcribeChunkFn({
      audioBase64,
      mimeType: "audio/wav",
      fileName: `chunk_${i}.wav`,
      chunkIndex: i,
      timeOffsetSeconds: timeOffset,
    });

    allSegments.push(...result.segments);
    if (result.language) language = result.language;
  }

  onProgress?.({ phase: "done", message: "Hoàn tất!" });
  return { segments: deduplicateSegments(allSegments), language };
}

// Lọc bỏ các đoạn lặp lại liên tiếp (watermark/quảng cáo nhúng trong audio)
function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function deduplicateSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length === 0) return segments;

  const result: TranscriptSegment[] = [];
  // Track số lần xuất hiện liên tiếp của mỗi text
  let streak = 1;
  const MAX_STREAK = 2; // cho phép tối đa 2 lần (lần đầu + 1 lần nhắc lại)

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
