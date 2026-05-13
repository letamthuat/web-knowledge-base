# Spec: Gemini Flash Transcript cho Audio

## Mục tiêu
Thay thế Groq Whisper bằng Gemini Flash cho tính năng tạo transcript audio, giải quyết vấn đề rate limit 7200s/giờ của Groq.

## Scope
- Chỉ áp dụng cho Audio (WebM/MP3/...). Video implement sau khi verify ổn.
- Test local trước, deploy sau khi xác nhận hoạt động.

---

## Phân tích hiện tại

### Flow hiện tại (Groq)
```
TranscriptButton
  → getWebmChunks (Convex) — trả byte ranges (10MB/chunk)
  → transcribeChunkViaApi (Next.js /api/transcribe-chunk)
      → fetch R2 range bytes
      → prepend EBML header nếu chunk > 0
      → POST FormData đến Groq Whisper API
      → trả { segments: [{start, end, text}], language }
  → saveSegments (Convex mutation)
```

### Vấn đề với Groq
- Limit 7200 giây audio/giờ → file 119 phút gần cạn quota
- Hay bị 429, phải retry chờ 30-75 giây mỗi lần
- Tổng thời gian tạo transcript: 15-30 phút

---

## Thiết kế mới (Gemini)

### Gemini Flash free tier
- Model: `gemini-2.0-flash` (hoặc `gemini-1.5-flash`)
- Limit: 1500 requests/ngày, 15 requests/phút
- Audio: upload inline (base64) hoặc qua File API — tối đa 9.5 giờ/request
- Không có limit giây audio/giờ

### Chiến lược chunk
Gemini nhận được file audio lớn hơn Groq (25MB vs ~100MB qua File API), nhưng để đơn giản và tránh timeout Next.js, **giữ nguyên 10MB/chunk** từ `getWebmChunks`. Không cần thay đổi Convex action.

### Timestamps
Gemini không trả `verbose_json` như Whisper. Phải dùng prompt để yêu cầu timestamps:

```
Transcribe this audio. Return ONLY a JSON array of segments:
[{"start": 0.0, "end": 5.2, "text": "..."}, ...]
Times are in seconds from the start of this audio clip.
No explanation, no markdown, just the JSON array.
```

Fallback: nếu parse JSON fail → chia đều thời gian dựa trên chunk duration.

### API Route mới: `/api/transcribe-chunk-gemini`
Tạo route mới song song với route Groq hiện tại để dễ so sánh và rollback.

**Input** (giống route Groq):
```ts
{
  downloadUrl: string;
  byteStart: number;
  byteEnd: number;
  headerBytes?: number;
  mimeType: string;
  chunkIndex: number;
  timeOffsetSeconds: number;
  language?: string;
}
```

**Output** (giống route Groq):
```ts
{
  segments: { start: number; end: number; text: string }[];
  language: string;
}
```

**Logic**:
1. Fetch byte range từ R2 (giống route hiện tại, kể cả prepend EBML header)
2. Convert bytes → base64
3. POST đến Gemini API với inline audio data
4. Parse JSON từ response text
5. Offset timestamps bằng `timeOffsetSeconds`
6. Fallback nếu parse fail

### Gemini API call
```ts
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: "audio/webm",
              data: base64Audio
            }
          },
          {
            text: `Transcribe this audio. Language is Vietnamese (vi) unless detected otherwise.
Return ONLY a JSON array:
[{"start": 0.0, "end": 5.2, "text": "..."}]
Times in seconds from start of clip. No markdown, no explanation.`
          }
        ]
      }],
      generationConfig: { temperature: 0 }
    })
  }
);
```

### TranscriptButton — UI chọn provider
Thêm dropdown/toggle trong UI để chọn provider (Groq / Gemini) thay vì chỉ dùng env var. Provider được lưu vào `localStorage` để persist giữa sessions.

**UI design:**
- Nút nhỏ bên cạnh nút "Tạo transcript" — hiển thị tên provider hiện tại
- Click mở dropdown: `Groq Whisper` / `Gemini Flash`
- Mặc định: `gemini` (sau khi implement xong)
- Fallback về `groq` nếu `GEMINI_API_KEY` không có

```tsx
// Provider selector UI (compact, inline với TranscriptButton)
const [provider, setProvider] = useState<"groq" | "gemini">(
  () => (localStorage.getItem("transcriptProvider") as "groq" | "gemini") ?? "gemini"
);
```

### Speaker Diarization (nhận dạng người nói)
Gemini Flash hỗ trợ diarization qua prompt engineering. Thêm tùy chọn diarization:

**Khi bật diarization**, prompt thay đổi:
```
Transcribe this audio. Identify different speakers as SPEAKER_1, SPEAKER_2, etc.
Return ONLY a JSON array:
[{"start": 0.0, "end": 5.2, "speaker": "SPEAKER_1", "text": "..."}]
Times in seconds from start of clip. No markdown, no explanation.
```

**Output segment** mở rộng thêm trường `speaker?`:
```ts
{ start: number; end: number; text: string; speaker?: string }
```

**UI:** Checkbox "Nhận dạng người nói" trong dropdown provider selector. Chỉ hiện khi provider = Gemini (Groq không hỗ trợ).

**Lưu ý:** Groq Whisper không hỗ trợ diarization — tính năng này chỉ available khi dùng Gemini provider.

---

## Acceptance Criteria

- [ ] AC1: Tạo transcript thành công cho file WebM 85MB (119 phút) mà không bị rate limit
- [ ] AC2: Segments có timestamps chính xác (±2 giây so với Groq)
- [ ] AC3: Tiếng Việt được nhận dạng đúng
- [ ] AC4: Fallback graceful nếu Gemini trả text thay vì JSON
- [ ] AC5: Không phá vỡ flow Groq hiện tại (route cũ vẫn hoạt động)
- [ ] AC6: Thời gian tổng tạo transcript < 10 phút cho file 119 phút
- [ ] AC7: UI provider selector hoạt động — chọn Groq/Gemini và persist vào localStorage
- [ ] AC8: Diarization bật → segments có trường `speaker` (SPEAKER_1, SPEAKER_2, ...) — chỉ khi provider = Gemini

---

## Tasks

- [ ] T1: Tạo `/api/transcribe-chunk-gemini/route.ts` — fetch R2 + call Gemini + parse timestamps
- [ ] T2: Thêm `GEMINI_API_KEY` vào `.env.local`
- [ ] T3: Thêm UI provider selector trong `TranscriptButton` — dropdown Groq/Gemini, persist localStorage
- [ ] T3b: Thêm checkbox "Nhận dạng người nói" trong dropdown — chỉ visible khi provider = Gemini
- [ ] T3c: Cập nhật `saveSegments` mutation để chấp nhận `speaker?` field trên segments
- [ ] T4: Test với file 85MB — verify segments, timestamps, language detection
- [ ] T5: Nếu ổn → deploy prod + thêm env var Vercel

---

## Rủi ro

| Rủi ro | Mức độ | Xử lý |
|--------|--------|-------|
| Gemini trả text thay vì JSON | Trung bình | Fallback chia đều timestamps |
| Accuracy tiếng Việt kém hơn Whisper | Chưa rõ | Test và so sánh |
| base64 10MB → ~13MB → vượt request size | Thấp | Gemini Flash hỗ trợ đến 20MB inline |
| Gemini 15 req/phút limit | Thấp | 9 chunks × 15s delay = ~2 phút, an toàn |

---

## Không làm trong scope này
- Video transcript (implement sau khi audio ổn)
- Diarization cho Groq (không hỗ trợ API)
