"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<boolean> | null = null;

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (!loadPromise) {
    const ff = new FFmpeg();
    loadPromise = ff.load({
      coreURL: "/ffmpeg/ffmpeg-core.js",
      wasmURL: "/ffmpeg/ffmpeg-core.wasm",
      workerURL: "/ffmpeg/ffmpeg-core.worker.js",
    });
    ffmpegInstance = ff;
  }
  await loadPromise;
  return ffmpegInstance!;
}

export async function extractAudio(videoBytes: Uint8Array): Promise<Uint8Array> {
  const ff = await loadFFmpeg();
  await ff.writeFile("input", videoBytes);
  await ff.exec(["-i", "input", "-vn", "-acodec", "libopus", "-b:a", "64k", "output.webm"]);
  const data = await ff.readFile("output.webm");
  await ff.deleteFile("input");
  await ff.deleteFile("output.webm");
  return data as Uint8Array;
}

// Suppress unused import warning — fetchFile may be used by callers
export { fetchFile };
