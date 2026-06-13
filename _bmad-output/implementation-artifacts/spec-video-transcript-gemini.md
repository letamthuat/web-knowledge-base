---
title: 'Video Transcript via Gemini (ffmpeg.wasm audio extraction)'
type: 'feature'
created: '2026-05-14'
status: 'done'
baseline_commit: '9705bbb5738e00f53ccec8718185193bf65152c3'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** VideoViewer có TranscriptButton nhưng không thể dùng vì thiếu `fileSizeBytes`/`durationSeconds`, và gửi thẳng video bytes lên Gemini sẽ vượt Vercel 120s timeout do file quá nặng.

**Approach:** Dùng `@ffmpeg/ffmpeg` (WebAssembly) chạy trên browser để tách audio track từ mỗi video chunk → gửi audio nhỏ (~1.5MB/chunk) lên `/api/transcribe-chunk-gemini` vốn đã có sẵn. Reuse toàn bộ TranscriptButton flow hiện tại, chỉ thêm bước pre-process ffmpeg trước khi gọi API.

## Boundaries & Constraints

**Always:**
- Reuse `/api/transcribe-chunk-gemini` route không thay đổi
- ffmpeg.wasm chạy hoàn toàn trên browser — không xử lý video trên server
- COOP/COEP headers bắt buộc để dùng SharedArrayBuffer (ffmpeg.wasm multi-thread)
- Output audio: `audio/webm;codecs=opus` 64kbps — đồng nhất với audio recorder
- Chunk theo thời gian: 3 phút/chunk, byteStart/byteEnd tính theo tỉ lệ `(t/duration) * fileSize`
- Parallel 3 chunks/batch giống audio flow hiện tại
- Diarization support giống audio (pass `diarization` param)

**Ask First:**
- Nếu ffmpeg.wasm load thất bại hoặc browser không hỗ trợ SharedArrayBuffer — hỏi user trước khi fallback sang gửi thẳng video bytes

**Never:**
- Không thay đổi `/api/transcribe-chunk-gemini/route.ts`
- Không xử lý video trên Vercel serverless
- Không upload video lên Convex database

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Video MP4 bình thường | File MP4, có `durationMs` + `fileSizeBytes` | ffmpeg tách audio → Gemini transcribe → TranscriptPanel hiện | Toast lỗi, setProgress error |
| Video không có `durationMs` | `durationMs` undefined | Dùng `video.duration` sau khi loadedmetadata | Nếu vẫn 0 → toast "Không xác định được thời lượng video" |
| ffmpeg.wasm chưa load | User bấm "Tạo transcript" khi wasm chưa sẵn | Hiển thị loading "Đang tải ffmpeg..." trong progress | Timeout 30s → toast lỗi |
| Browser không hỗ trợ SharedArrayBuffer | Môi trường thiếu COOP/COEP | HALT + hỏi user | Không tự fallback |
| Chunk audio rỗng sau ffmpeg | ffmpeg trả file 0 byte | Skip chunk, log warning | Không crash toàn bộ transcript |

</frozen-after-approval>

## Code Map

- `apps/web/package.json` -- thêm `@ffmpeg/ffmpeg`, `@ffmpeg/util`
- `apps/web/next.config.ts` -- thêm COOP/COEP headers vào `/(.*)`; thêm `*.r2.cloudflarestorage.com` vào `connect-src` nếu chưa có (đã có)
- `apps/web/src/hooks/useFFmpeg.ts` -- **NEW** hook: load ffmpeg.wasm một lần, expose `extractAudio(videoBytes, mimeType): Promise<Uint8Array>`
- `apps/web/src/components/viewers/video/VideoViewer.tsx` -- thêm `fileSizeBytes`, `durationMs` vào doc type; pass `fileSizeBytes`, `durationSeconds`, `onTranscribeRunningChange` vào TranscriptButton
- `apps/web/src/components/viewers/ViewerDispatcher.tsx` -- thêm `fileSizeBytes`, `durationMs` vào Doc interface; pass xuống VideoViewer; thêm `onTranscribeRunningChange` prop
- `apps/web/src/components/viewers/transcript/TranscriptButton.tsx` -- thêm prop `extractAudioFn?: (bytes: Uint8Array, mimeType: string) => Promise<Uint8Array>`; gọi trước `transcribeChunkViaApi` nếu mimeType là video
- `convex/transcripts/actions.ts` -- `getWebmChunks`: khi `mimeType` video, skip EBML header scan, set `headerBytes=0`, chunk thuần theo byte range

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/package.json` -- cài `@ffmpeg/ffmpeg@^0.12` và `@ffmpeg/util@^0.12` -- ffmpeg.wasm core
- [ ] `apps/web/next.config.ts` -- thêm `Cross-Origin-Opener-Policy: same-origin` và `Cross-Origin-Embedder-Policy: require-corp` vào headers block `/(.*)`; thêm `https://unpkg.com` vào `connect-src` nếu dùng CDN load wasm (prefer local `/ffmpeg/` path) -- bắt buộc cho SharedArrayBuffer
- [ ] `apps/web/public/ffmpeg/` -- copy `ffmpeg-core.js`, `ffmpeg-core.wasm`, `ffmpeg-core.worker.js` từ `node_modules/@ffmpeg/core/dist/umd/` vào `public/ffmpeg/` -- serve local tránh CSP block
- [ ] `apps/web/src/hooks/useFFmpeg.ts` -- **NEW**: singleton load pattern, `FFmpeg` instance tái sử dụng; export `{ ffmpegReady, loadFFmpeg, extractAudio }`. `extractAudio` nhận `Uint8Array` video bytes + mimeType, chạy `-i input -vn -acodec libopus -b:a 64k output.webm`, trả `Uint8Array` audio
- [ ] `convex/transcripts/actions.ts` -- trong `getWebmChunks`, nếu mimeType bắt đầu bằng `video/`, skip EBML scan, return `headerBytes: 0`, chunk đều theo `CHUNK_SIZE = Math.min(ceil(bytesPerSec * TARGET_CHUNK_SECS), MAX_CHUNK_BYTES)` -- video không có EBML header
- [ ] `apps/web/src/components/viewers/video/VideoViewer.tsx` -- mở rộng `doc` type thêm `fileSizeBytes?: number`, `durationMs?: number`; thêm prop `onTranscribeRunningChange?`; pass `fileSizeBytes`, `durationSeconds={doc.durationMs ? doc.durationMs/1000 : duration}`, `onRunningChange` vào TranscriptButton
- [ ] `apps/web/src/components/viewers/ViewerDispatcher.tsx` -- Doc interface đã có `durationMs`, `fileSizeBytes`; thêm pass xuống `<VideoViewer doc={doc} ... />`; thêm `onTranscribeRunningChange` giống AudioViewer
- [ ] `apps/web/src/components/viewers/transcript/TranscriptButton.tsx` -- thêm prop `extractAudioFn?`; trong `handleTranscribe`, nếu `mimeType.startsWith("video/")`, sau khi fetch bytes mỗi chunk, gọi `extractAudioFn(bytes, mimeType)` → dùng audio bytes thay thế; cập nhật progress message "Đang tách audio..." khi ffmpeg đang chạy

**Acceptance Criteria:**
- Given video có `durationMs` và `fileSizeBytes`, when bấm "Tạo transcript", then TranscriptButton hiển thị progress và hoàn tất transcript với segments có timestamps chính xác
- Given ffmpeg.wasm chưa load, when bấm "Tạo transcript", then hiện "Đang tải ffmpeg..." trước khi bắt đầu transcribe
- Given COOP/COEP headers đã set, when load VideoViewer trên Chrome/Edge, then `typeof SharedArrayBuffer !== 'undefined'` là true
- Given video không có audio track, when ffmpeg extract, then chunk đó bị skip và transcript vẫn tiếp tục với các chunk khác
- Given transcript hoàn tất, when video đang phát, then SubtitleOverlay hiển thị đúng text theo currentTime

## Spec Change Log

## Design Notes

**ffmpeg.wasm singleton pattern** — load 1 lần duy nhất cho toàn app session, tránh load 30MB wasm mỗi lần bấm transcript:

```ts
// useFFmpeg.ts
let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

export async function loadFFmpeg() {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (!loadPromise) {
    const ff = new FFmpeg();
    loadPromise = ff.load({ coreURL: "/ffmpeg/ffmpeg-core.js" });
    ffmpegInstance = ff;
  }
  await loadPromise;
  return ffmpegInstance!;
}
```

**extractAudio per chunk** — ffmpeg nhận raw video bytes (không cần full file):
```ts
await ffmpeg.writeFile("input", videoBytes);
await ffmpeg.exec(["-i","input","-vn","-acodec","libopus","-b:a","64k","output.webm"]);
const data = await ffmpeg.readFile("output.webm");
await ffmpeg.deleteFile("input"); await ffmpeg.deleteFile("output.webm");
return data as Uint8Array;
```

**TranscriptButton mimeType check** — không cần tách biệt flow audio/video, chỉ inject bước extract:
```ts
// Trong transcribeChunkViaApi hoặc trước đó
if (mimeType.startsWith("video/") && extractAudioFn) {
  const rawBytes = await fetchChunkBytes(...);
  const audioBytes = await extractAudioFn(rawBytes, mimeType);
  // gửi audioBytes thay rawBytes lên Gemini với mimeType = "audio/webm"
}
```

## Verification

**Commands:**
- `cd apps/web && npm run build` -- expected: build thành công, không có TypeScript error
- `npx convex deploy --yes` -- expected: Deployed successfully

**Manual checks:**
- Mở Chrome DevTools → Application → Headers: kiểm tra `Cross-Origin-Opener-Policy: same-origin` và `Cross-Origin-Embedder-Policy: require-corp` có trong response headers của page
- Mở Console: `typeof SharedArrayBuffer` trả `"function"`
- Upload video MP4 ngắn (~2 phút), bấm "Tạo transcript" → progress hiển thị "Đang tách audio..." rồi "Đang nhận dạng..." → TranscriptPanel hiện segments
