---
title: 'Quay màn hình toàn cục với floating pill trong TabBar'
type: 'feature'
created: '2026-05-02'
updated: '2026-05-02'
status: 'draft'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Quay màn hình cần chạy liên tục khi user chuyển giữa ghi chú, reader, thư viện — không bị dừng khi navigate.

**Approach:** Tái dùng `RecordingContext` từ spec-5-10. Nút khởi động nằm trong dropdown `[+ Mới]` của TabBar. Khi đang quay, hiện **floating pill** màu tím trong TabBar — pill tồn tại trên mọi trang. Sau khi dừng, upload lên thư viện (format `video`) và toast "Đã lưu vào thư viện".

## Boundaries & Constraints

**Always:**
- Tái dùng `RecordingContext` đã tạo ở spec-5-10
- Floating pill nằm trong TabBar (cùng hàng tabs), không phải overlay tự do
- Pill quay màn hình: màu violet/tím, icon 🖥️, hiển thị timer M:SS
- Pill controls inline: ⏸ Tạm dừng / ▶ Tiếp tục / ⏹ Dừng
- Khi pause: pill chuyển màu xám, timer đứng yên
- Hỗ trợ Pause/Resume: `MediaRecorder.pause()` / `.resume()` — file output 1 blob liên tục
- User chọn nguồn qua browser native picker (`getDisplayMedia`) — không tự build picker
- System audio từ `getDisplayMedia({ audio: true })` — chỉ có khi user tick "Share tab audio" / "Share system audio"
- Mic từ `getUserMedia({ audio: true })` — toggle độc lập, mặc định OFF
- Mix audio bằng `AudioContext` tương tự spec-5-10
- Upload lên thư viện format `video` (WebM/VP8 + Opus)
- Sau upload: toast "Đã lưu vào thư viện" với action "Mở" → `/reader/{docId}`
- Recording > 2 giờ → tự dừng + toast
- Có thể chạy đồng thời với ghi âm (spec-5-10) — 2 pill cùng hiển thị trong TabBar
- Chỉ 1 phiên quay màn hình tại 1 thời điểm

**Ask First:**
- Nếu `getDisplayMedia` trả về stream không có audio track → hỏi user có muốn thêm mic không

**Never:**
- Không chèn link vào note (upload xong chỉ toast)
- Không record video server-side
- Không tự implement screen picker — dùng browser native
- Không thay đổi schema Convex

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Start quay màn hình | Click [+ Mới] → Quay màn hình, chọn nguồn | Pill tím xuất hiện trong TabBar, timer chạy | Từ chối picker → không start |
| Navigate sang notes | Đang quay, click tab ghi chú | Pill vẫn hiển thị, recording tiếp tục | — |
| Chạy đồng thời ghi âm | Đang có pill đỏ 🎤, start quay | Cả 2 pill hiển thị cùng lúc trong TabBar | — |
| Pause/Resume | Click ⏸ trong pill | Timer dừng, pill xám; click ▶ → tiếp tục | — |
| Dừng | Click ⏹ trong pill | Hiện dialog preview: `<video>` + input tên + Upload + Hủy | — |
| Upload | Click Upload | Upload lên thư viện, toast "Đã lưu vào thư viện" + action "Mở" | Upload fail → toast error, giữ blob retry |
| Stream bị ngắt | User đóng tab đang share | Recording tự dừng, hiện dialog lưu/hủy | Không có data → toast warning |
| User đóng picker | Dismiss browser dialog | Recording không bắt đầu, không có pill | — |
| Recording > 2 giờ | Timer = 2:00:00 | Tự động dừng, toast thông báo | — |
| Start khi đã có session | Click Quay lần 2 | Disabled — tooltip "Đang có phiên quay màn hình" | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/contexts/RecordingContext.tsx` -- SỬA (từ spec-5-10) -- Thêm `screenRecorder` từ `useScreenRecorder`
- `apps/web/src/hooks/useScreenRecorder.ts` -- TẠO MỚI -- Hook: `start()`, `pause()`, `resume()`, `finish()`, `toggleMic()`. Dùng `getDisplayMedia` + `AudioContext`.
- `apps/web/src/components/recording/ScreenRecordingPill.tsx` -- TẠO MỚI -- Pill tím: icon 🖥️ + timer + toggle mic + ⏸/▶ + ⏹
- `apps/web/src/components/recording/ScreenFinishDialog.tsx` -- TẠO MỚI -- Dialog preview `<video>` + upload
- `apps/web/src/components/tabs/TabBar.tsx` -- đã sửa ở spec-5-10, chỉ thêm `<ScreenRecordingPill>`
- `convex/documents/actions.ts` -- `requestUploadUrl` tái dùng
- `convex/documents/mutations.ts` -- `finalizeUpload` tái dùng

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/hooks/useScreenRecorder.ts` -- TẠO MỚI -- States: `idle | recording | paused`. Export: `start()` gọi `getDisplayMedia` + optional `getUserMedia`. Mix audio bằng `AudioContext`. `finish()` → `{blob, durationMs}`. `toggleMic()`. Lắng nghe `videoTrack.addEventListener('ended', stop)` khi user dừng share.
- [x] `apps/web/src/contexts/RecordingContext.tsx` -- SỬA -- Thêm `screenRecorder: ReturnType<typeof useScreenRecorder>` vào context value.
- [x] `apps/web/src/components/recording/ScreenRecordingPill.tsx` -- TẠO MỚI -- Pill màu violet: `🖥️ M:SS` + icon toggle mic (xanh/xám) + ⏸/▶ + ⏹. Khi pause: pill màu xám.
- [x] `apps/web/src/components/recording/ScreenFinishDialog.tsx` -- TẠO MỚI -- Dialog: `<video>` preview (controls, max-h-48) + input tên file + nút Upload + nút Hủy. Upload → `requestUploadUrl` + PUT R2 + `finalizeUpload` format `video` → toast.
- [x] `apps/web/src/components/tabs/TabBar.tsx` -- THÊM `<ScreenRecordingPill>` vào cuối tabs (sau AudioRecordingPill nếu có). Option "Quay màn hình" được bật với disabled check.

## Acceptance Criteria

- Given mọi trang, when click [+ Mới] → Quay màn hình và chọn nguồn, then pill tím 🖥️ xuất hiện trong TabBar và timer đếm
- Given đang quay ở /reader, when click sang /notes, then pill vẫn hiển thị và timer tiếp tục
- Given đang có pill ghi âm đỏ, when start quay màn hình, then cả 2 pill hiển thị đồng thời
- Given user dismiss picker, then không có pill, UI bình thường
- Given stream bị ngắt (user dừng share từ browser), then recording tự dừng và hiện dialog lưu/hủy
- Given click ⏹ và upload xong, then file xuất hiện trong /library với format video và toast "Đã lưu vào thư viện"
- Given đang có session quay, when click Quay lần 2, then bị disabled

## Design Notes

**TabBar với cả 2 pills:**
```
[ + Mới ▾ ]  [ 📄 Apply job × ]  [ 📄 README × ]  [ 🎤 03:42 ⏸ ⏹ ]  [ 🖥️ 01:15 ⏸ ⏹ ]  [ Đóng tất cả ]
                                                      ↑ rose              ↑ violet
                                                      (hoặc xám khi pause)
```

**Dropdown [+ Mới]:**
```
┌─────────────────────────┐
│ 📄 Ghi chú mới          │
│ 🎤 Bắt đầu ghi âm       │  ← disabled nếu đang có session
│ 🖥️ Bắt đầu quay màn hình │  ← disabled nếu đang có session
└─────────────────────────┘
```

**Audio mixing cho screen recorder:**
```typescript
const ctx = new AudioContext();
const dest = ctx.createMediaStreamDestination();
if (displayStream.getAudioTracks().length > 0) {
  ctx.createMediaStreamSource(displayStream).connect(sysGain).connect(dest);
}
if (micStream) {
  ctx.createMediaStreamSource(micStream).connect(micGain).connect(dest);
}
const combined = new MediaStream([
  ...displayStream.getVideoTracks(),
  ...dest.stream.getAudioTracks(),
]);
const recorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp8,opus' });
```

## Verification

- `cd apps/web && npm run build` — no TypeScript errors
- Quay 10s, navigate sang /library → pill vẫn hiển thị
- Chọn "Chrome Tab" → chỉ tab đó trong video
- Chạy đồng thời ghi âm + quay màn hình → 2 pills, 2 timers độc lập
- Upload → xuất hiện trong /library với icon video
