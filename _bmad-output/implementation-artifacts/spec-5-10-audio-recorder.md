---
title: 'Ghi âm toàn cục với floating pill trong TabBar'
type: 'feature'
created: '2026-05-02'
updated: '2026-05-02'
status: 'draft'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ghi âm cần chạy liên tục khi user chuyển giữa ghi chú, reader, thư viện — không bị dừng khi navigate.

**Approach:** Đưa recording state lên `RecordingContext` (React context toàn cục ở root layout). Nút khởi động nằm trong dropdown `[+ Mới]` của TabBar. Khi đang ghi, hiện **floating pill** màu đỏ trong TabBar — pill tồn tại trên mọi trang. Sau khi dừng, upload lên thư viện (format `audio`) và toast "Đã lưu vào thư viện".

## Boundaries & Constraints

**Always:**
- `RecordingContext` mount ở root layout — persist khi navigate giữa các route
- Floating pill nằm trong TabBar (cùng hàng tabs), không phải overlay tự do
- Pill ghi âm: màu rose/đỏ, icon 🎤, hiển thị timer M:SS
- Pill controls inline: ⏸ Tạm dừng / ▶ Tiếp tục / ⏹ Dừng
- Khi pause: pill chuyển màu xám, timer đứng yên
- Hỗ trợ Pause/Resume: `MediaRecorder.pause()` / `.resume()` — file output là 1 blob liên tục, không có khoảng lặng
- Mic từ `getUserMedia({ audio: true })`
- System audio từ `getDisplayMedia({ audio: true, video: false })` — Chrome/Edge only; Firefox → warning, fallback mic-only
- Mix audio bằng `AudioContext` + `GainNode` — toggle realtime bằng `gain.value = 0 | 1`
- Upload lên thư viện format `audio` (WebM/Opus)
- Sau upload: toast "Đã lưu vào thư viện" với action "Mở" → `/reader/{docId}`
- Recording > 2 giờ → tự dừng + toast thông báo
- Chỉ 1 phiên ghi âm tại 1 thời điểm (không cho start nếu đang có session)

**Ask First:**
- Nếu browser không support `getDisplayMedia` audio-only → hỏi trước khi fallback mic-only

**Never:**
- Không chèn link vào note (upload xong chỉ toast)
- Không lưu blob tự động — user quyết định sau khi preview
- Không xử lý audio server-side trong lúc recording
- Không thay đổi schema Convex

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Start ghi âm | Click [+ Mới] → Ghi âm, cấp quyền | Pill đỏ xuất hiện trong TabBar, timer chạy | Từ chối quyền → toast error, không start |
| Navigate sang reader | Đang ghi, click tab tài liệu | Pill vẫn hiển thị trong TabBar, recording tiếp tục | — |
| Navigate sang library | Đang ghi, vào /library | Pill vẫn hiển thị, recording tiếp tục | — |
| Pause/Resume | Click ⏸ trong pill | Timer dừng, pill xám; click ▶ → tiếp tục | — |
| Dừng | Click ⏹ trong pill | Hiện dialog preview: `<audio>` + input tên + Upload + Hủy | — |
| Upload | Click Upload | Upload lên thư viện, toast "Đã lưu vào thư viện" + action "Mở" | Upload fail → toast error, giữ blob retry |
| Hủy sau dừng | Click Hủy | Blob bị discard, pill biến mất | — |
| System audio không support | Firefox | Warning "Browser không hỗ trợ system audio", mic-only | — |
| Recording > 2 giờ | Timer = 2:00:00 | Tự động dừng, toast thông báo | — |
| Start khi đã có session | Click Ghi âm lần 2 | Disabled — tooltip "Đang có phiên ghi âm" | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/contexts/RecordingContext.tsx` -- TẠO MỚI -- React context toàn cục: audio state + screen state. Mount ở root layout.
- `apps/web/src/hooks/useAudioRecorder.ts` -- TẠO MỚI -- Hook: `start()`, `pause()`, `resume()`, `finish()`, `toggleMic()`, `toggleSystem()`. Dùng `AudioContext` + `MediaRecorder`.
- `apps/web/src/components/tabs/TabBar.tsx` -- THÊM 2 option "Ghi âm" + "Quay màn hình" vào dropdown `[+]` hiện có (đang có "Mở tài liệu / Ghi chú"); THÊM AudioRecordingPill + ScreenRecordingPill
- `apps/web/src/components/notes/NotesPageInner.tsx` -- SỬA nút `[Mới]` trong sidebar trái thành dropdown 3 option (Ghi chú mới / Ghi âm / Quay màn hình)
- `apps/web/src/components/recording/AudioRecordingPill.tsx` -- TẠO MỚI -- Pill đỏ: icon 🎤 + timer + toggle mic/sys + ⏸/▶ + ⏹
- `apps/web/src/components/recording/AudioFinishDialog.tsx` -- TẠO MỚI -- Dialog preview + upload sau khi dừng
- `apps/web/src/app/layout.tsx` -- WRAP với `RecordingContext.Provider`
- `convex/documents/actions.ts` -- `requestUploadUrl` tái dùng
- `convex/documents/mutations.ts` -- `finalizeUpload` tái dùng

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/hooks/useAudioRecorder.ts` -- TẠO MỚI -- States: `idle | recording | paused`. Export: `start()`, `pause()`, `resume()`, `finish()` → `{blob, durationMs}`, `toggleMic()`, `toggleSystem()`, `micActive`, `systemActive`. Dùng `AudioContext` + `createMediaStreamDestination()` để merge streams. `finish()` stop recorder, trả blob + tổng duration (không tính thời gian pause).
- [x] `apps/web/src/contexts/RecordingContext.tsx` -- TẠO MỚI -- Context expose: `audioRecorder` (từ useAudioRecorder), `screenRecorder` (từ useScreenRecorder spec-5-11). Provider wrap root layout.
- [x] `apps/web/src/components/recording/AudioRecordingPill.tsx` -- TẠO MỚI -- Pill màu rose: `🎤 M:SS` + icon toggle mic (xanh/xám) + icon toggle sys (xanh/xám) + ⏸/▶ + ⏹. Khi pause: pill màu xám.
- [x] `apps/web/src/components/recording/AudioFinishDialog.tsx` -- TẠO MỚI -- Dialog: `<audio>` preview + input tên file + nút Upload + nút Hủy. Upload → `requestUploadUrl` + PUT R2 + `finalizeUpload` format `audio` → toast.
- [x] `apps/web/src/components/tabs/TabBar.tsx` -- THÊM vào dropdown `[+]` hiện có 2 option mới: "🎤 Ghi âm" + "🖥️ Quay màn hình" (sau separator, phía dưới "Mở tài liệu / Ghi chú"). THÊM `<AudioRecordingPill>` vào cuối tab list (chỉ render khi có session active). Option "🎤 Ghi âm" disabled nếu đang có session.
- [x] `apps/web/src/components/notes/NoteList.tsx` -- SỬA nút `[Mới]` thành dropdown: "📄 Ghi chú mới" / "🎤 Ghi âm" / "🖥️ Quay màn hình". Dùng `RecordingContext` để trigger recording.
- [x] `apps/web/src/app/layout.tsx` -- WRAP children với `<RecordingProvider>`

## Acceptance Criteria

- Given mọi trang, when click [+ Mới] trong TabBar → Ghi âm và cấp quyền, then pill đỏ 🎤 xuất hiện trong TabBar và timer đếm
- Given ở /notes, when click [+ Mới] trong sidebar trái → Ghi âm, then hành vi giống trên (cùng RecordingContext)
- Given đang ghi âm ở /notes, when click tab tài liệu sang /reader, then pill vẫn hiển thị và timer tiếp tục
- Given đang ghi âm, when click ⏸ rồi ▶ rồi ⏹, then file audio = tổng thời gian ghi (không tính khoảng pause)
- Given click ⏹, when upload xong, then file xuất hiện trong /library với format audio và toast "Đã lưu vào thư viện"
- Given Firefox, when click Ghi âm, then chỉ mic hoạt động và có warning system audio
- Given đang có session ghi âm, when click Ghi âm lần 2, then bị disabled

## Design Notes

**Audio mixing:**
```typescript
const ctx = new AudioContext();
const dest = ctx.createMediaStreamDestination();
const micGain = ctx.createGain(); // gain.value = 0 để mute
const sysGain = ctx.createGain();
micSource.connect(micGain).connect(dest);
sysSource.connect(sysGain).connect(dest);
const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
```

**Entry point 1 — Dropdown `[+]` trong TabBar** (thêm vào dropdown hiện có):
```
┌──────────────────────────┐
│ ＋  Mở tài liệu          │
│ 📄  Ghi chú              │
│ ──────────────────────── │  ← separator
│ 🎤  Ghi âm               │  ← disabled nếu đang có session ghi âm
│ 🖥️  Quay màn hình         │  ← disabled nếu đang có session quay
└──────────────────────────┘
```

**Entry point 2 — Nút `[Mới]` trong sidebar /notes** (đổi thành dropdown):
```
┌──────────────────────────┐
│ 📄  Ghi chú mới          │
│ 🎤  Ghi âm               │  ← disabled nếu đang có session
│ 🖥️  Quay màn hình         │  ← disabled nếu đang có session
└──────────────────────────┘
```

**Pill UI (trong TabBar, sau các tabs):**
```
[ + ]  [ 📄 Apply job × ]  [ 📄 README × ]  [ 🎤 03:42  ⏸  ⏹ ]  [ 🖥️ 01:15  ⏸  ⏹ ]
                                               ↑ rose                ↑ violet
                                               (xám khi pause)
```

## Verification

- `cd apps/web && npm run build` — no TypeScript errors
- Ghi âm 10s, navigate sang /library → pill vẫn hiển thị
- Toggle mic ở giây 5 → upload → tạo transcript → mic chỉ có 0-5s
- Upload → xuất hiện trong /library với icon audio
