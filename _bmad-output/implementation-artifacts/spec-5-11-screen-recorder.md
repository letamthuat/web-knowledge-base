---
title: 'Quay màn hình trong Note Workspace với toggle mic/system audio'
type: 'feature'
created: '2026-05-02'
status: 'draft'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Note workspace chưa có công cụ quay màn hình — người dùng không thể capture session làm việc gắn với ghi chú đang soạn.

**Approach:** Thêm nút Quay màn hình vào toolbar NotesPageInner. Dùng `getDisplayMedia` để chọn nguồn (toàn màn hình / ứng dụng / tab Chrome), mix thêm mic qua Web Audio API, toggle từng nguồn realtime. Sau khi dừng, file WebM được upload lên thư viện (format `video`) với nút tạo transcript.

## Boundaries & Constraints

**Always:**
- Hỗ trợ Pause/Resume: `MediaRecorder.pause()` / `MediaRecorder.resume()` — timer dừng khi pause, khoảng pause không xuất hiện trong video output; file output là 1 blob liên tục duy nhất
- Nút điều khiển: ⏸ Tạm dừng → ▶ Tiếp tục → ⏹ Hoàn thành (lưu + upload)
- User chọn nguồn qua browser native picker (`getDisplayMedia`) — không tự build picker
- System audio từ `getDisplayMedia({ audio: true })` — chỉ có khi user chọn "Share tab audio" hoặc "Share system audio" trong picker
- Mic từ `getUserMedia({ audio: true })` — toggle độc lập
- Mix audio bằng `AudioContext` tương tự spec-5-10
- Upload lên thư viện format `video` (WebM/VP8 + Opus)
- Sau khi upload thành công: tự động chèn vào cuối note đang mở 1 block paragraph dạng `[🖥️ Quay màn hình DD/MM/YYYY HH:mm - M:SS](link-reader)`
- Sau upload hiện `TranscriptButton` (transcript từ audio track của video)

**Ask First:**
- Nếu `getDisplayMedia` trả về stream không có audio track → hỏi user có muốn thêm mic không

**Never:**
- Không tự implement screen picker — dùng browser native
- Không record video server-side
- Không thay đổi schema Convex

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Start quay màn hình | Click Quay màn hình, chọn nguồn trong picker | Recording bắt đầu, preview thumbnail nhỏ, timer chạy | Từ chối picker → không start |
| Pause/Resume | Click ⏸ rồi ▶ | Timer dừng, màn hình không được capture trong khoảng pause | — |
| Hoàn thành sau pause | Click ⏹ Hoàn thành | 1 file video liền mạch, không có frame đen hay khoảng dừng | — |
| Chọn tab Chrome cụ thể | Chọn "Chrome Tab" trong picker | Chỉ tab đó được capture, kể cả audio nếu tick "Share tab audio" | — |
| Toggle tắt mic ở phút 3 | Click nút mic trong lúc quay | Mic muted, video tiếp tục + system audio nếu có | — |
| User đóng picker | Dismiss browser dialog | Recording không bắt đầu, UI reset | — |
| Stream bị ngắt đột ngột | User đóng tab đang share | Recording tự dừng, hiện panel lưu/hủy | Nếu không có dữ liệu → thông báo |
| Recording > 2 giờ | Timer đạt 2:00:00 | Tự động dừng, toast thông báo | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/components/notes/NotesPageInner.tsx` -- toolbar chứa nút quay màn hình; truyền `editorRef` xuống ScreenRecorder
- `apps/web/src/components/notes/NoteEditor.tsx` -- expose `editor` instance qua `editorRef` (đã làm ở spec-5-10)
- `apps/web/src/components/notes/ScreenRecorder.tsx` -- component mới: UI + logic quay màn hình + chèn link vào note
- `apps/web/src/hooks/useScreenRecorder.ts` -- hook mới: `getDisplayMedia` + audio mixing
- `apps/web/src/components/viewers/transcript/TranscriptButton.tsx` -- tái dùng sau upload
- `convex/documents/actions.ts` -- `requestUploadUrl` tái dùng
- `convex/documents/mutations.ts` -- `finalizeUpload` tái dùng

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/hooks/useScreenRecorder.ts` -- TẠO MỚI -- Hook: `start()` gọi `getDisplayMedia` + `getUserMedia`. Mix audio bằng `AudioContext`. States: `idle | recording | paused`. Export: `start`, `pause`, `resume`, `finish`, `toggleMic`. `finish()` trả về `Blob` + tổng duration không tính thời gian pause.
- [ ] `apps/web/src/components/notes/ScreenRecorder.tsx` -- TẠO MỚI -- Nhận prop `editorRef`. UI: floating bar (timer + toggle Mic + nút ⏸/▶ + nút ⏹ Hoàn thành). Sau finish: preview `<video>` + input tên + nút Upload + nút Hủy. Upload → `finalizeUpload` format `video` → chèn block link `🖥️ Quay màn hình ...` vào note qua `editorRef` → hiện `TranscriptButton`
- [ ] `apps/web/src/components/notes/NotesPageInner.tsx` -- THÊM nút Quay màn hình vào toolbar bên phải, truyền `editorRef` vào `ScreenRecorder`

## Acceptance Criteria

- Given đang mở note, when click Quay màn hình và chọn nguồn, then browser native picker xuất hiện và recording bắt đầu sau khi chọn
- Given đang quay, when toggle tắt mic ở phút 3 rồi dừng ở phút 5, then video có mic audio 0-3p và system audio 0-5p (nếu có)
- Given user chọn "Chrome Tab" trong picker, then chỉ tab đó được record
- Given user dismiss picker, then recording không bắt đầu và UI trở về bình thường
- Given stream bị ngắt (user dừng share), then recording tự dừng và hiện panel lưu
- Given upload xong, then file xuất hiện trong thư viện với format video, có nút tạo transcript, VÀ note đang mở có thêm dòng link `🖥️ Quay màn hình DD/MM/YYYY HH:mm - M:SS` ở cuối

## Design Notes

**Reuse audio mixing từ spec-5-10:**
```typescript
// useScreenRecorder tái dùng cùng pattern AudioContext
const ctx = new AudioContext();
const dest = ctx.createMediaStreamDestination();
if (displayStream.getAudioTracks().length > 0) {
  const sysSource = ctx.createMediaStreamSource(displayStream);
  sysSource.connect(sysGain).connect(dest);
}
const micSource = ctx.createMediaStreamSource(micStream);
micSource.connect(micGain).connect(dest);
// Combine video track + mixed audio
const combined = new MediaStream([
  ...displayStream.getVideoTracks(),
  ...dest.stream.getAudioTracks(),
]);
const recorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp8,opus' });
```

**Stream ended event** (user stops share):
```typescript
displayStream.getVideoTracks()[0].addEventListener('ended', () => stop());
```

## Verification

**Commands:**
- `cd apps/web && npm run build` -- expected: no TypeScript errors

**Manual checks:**
- Quay màn hình 10s, chọn "Chrome Tab" → chỉ tab đó xuất hiện trong video
- Toggle mic ở giây 5, xem transcript → mic chỉ có 0-5s
- Upload → xuất hiện trong /library với icon video
- Tạo transcript → hoạt động bình thường
