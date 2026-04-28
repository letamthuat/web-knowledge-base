import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

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

const CHUNK_SIZE_BYTES = 20 * 1024 * 1024; // 20MB per chunk (Groq limit 25MB)
const CHUNK_DURATION_SECS = 5 * 60; // 5 phút mỗi chunk

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(onProgress?: (p: TranscriptProgress) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;

  onProgress?.({ phase: "loading", message: "Đang tải bộ xử lý âm thanh..." });

  const ffmpeg = new FFmpeg();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

// Extract audio từ video/audio file, split thành chunks ~5 phút
export async function extractAudioChunks(
  sourceUrl: string,
  mimeType: string,
  onProgress?: (p: TranscriptProgress) => void,
): Promise<{ blob: Blob; timeOffset: number }[]> {
  const ffmpeg = await getFFmpeg(onProgress);

  onProgress?.({ phase: "extracting", message: "Đang trích xuất âm thanh..." });

  // Download source file
  const inputData = await fetchFile(sourceUrl);
  const ext = mimeType.includes("mp4") ? "mp4"
    : mimeType.includes("webm") ? "webm"
    : mimeType.includes("ogg") ? "ogg"
    : mimeType.includes("mpeg") || mimeType.includes("mp3") ? "mp3"
    : mimeType.includes("wav") ? "wav"
    : "mp4";

  await ffmpeg.writeFile(`input.${ext}`, inputData);

  // Lấy duration
  let duration = 0;
  ffmpeg.on("log", ({ message }) => {
    const m = message.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
    if (m) {
      duration = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
    }
  });

  // Probe duration
  await ffmpeg.exec(["-i", `input.${ext}`, "-f", "null", "-"]).catch(() => {});

  if (!duration) duration = 3600; // fallback 1 giờ nếu không detect được

  const chunks: { blob: Blob; timeOffset: number }[] = [];
  const numChunks = Math.ceil(duration / CHUNK_DURATION_SECS);

  for (let i = 0; i < numChunks; i++) {
    const startTime = i * CHUNK_DURATION_SECS;
    const chunkFile = `chunk_${i}.mp3`;

    await ffmpeg.exec([
      "-i", `input.${ext}`,
      "-ss", String(startTime),
      "-t", String(CHUNK_DURATION_SECS),
      "-vn",              // no video
      "-ar", "16000",     // 16kHz — đủ cho speech recognition, file nhỏ hơn
      "-ac", "1",         // mono
      "-b:a", "32k",      // bitrate thấp để giảm size
      "-f", "mp3",
      chunkFile,
    ]);

    const data = await ffmpeg.readFile(chunkFile) as Uint8Array;
    const blob = new Blob([data], { type: "audio/mp3" });
    chunks.push({ blob, timeOffset: startTime });

    await ffmpeg.deleteFile(chunkFile);
  }

  await ffmpeg.deleteFile(`input.${ext}`);
  return chunks;
}

// Convert Blob → base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // remove data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Full transcribe pipeline
export async function transcribeMedia(
  sourceUrl: string,
  mimeType: string,
  transcribeChunkFn: (args: {
    audioBase64: string;
    mimeType: string;
    fileName: string;
    chunkIndex: number;
    timeOffsetSeconds: number;
  }) => Promise<{ segments: TranscriptSegment[]; language: string }>,
  onProgress?: (p: TranscriptProgress) => void,
): Promise<{ segments: TranscriptSegment[]; language: string }> {
  const chunks = await extractAudioChunks(sourceUrl, mimeType, onProgress);

  const allSegments: TranscriptSegment[] = [];
  let language = "vi";

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.({
      phase: "transcribing",
      chunkIndex: i + 1,
      totalChunks: chunks.length,
      message: `Đang nhận dạng giọng nói... (${i + 1}/${chunks.length})`,
    });

    const { blob, timeOffset } = chunks[i];
    const audioBase64 = await blobToBase64(blob);

    const result = await transcribeChunkFn({
      audioBase64,
      mimeType: "audio/mp3",
      fileName: `chunk_${i}.mp3`,
      chunkIndex: i,
      timeOffsetSeconds: timeOffset,
    });

    allSegments.push(...result.segments);
    if (result.language) language = result.language;
  }

  onProgress?.({ phase: "done", message: "Hoàn tất!" });

  return { segments: allSegments, language };
}
