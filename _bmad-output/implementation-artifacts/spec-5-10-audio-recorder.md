---
title: 'Ghi âm trong Note Workspace với toggle mic/system audio'
type: 'feature'
created: '2026-05-02'
status: 'draft'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Note workspace chưa có công cụ ghi âm — người dùng phải dùng app ngoài rồi import thủ công, mất liên kết với ghi chú đang mở.

**Approach:** Thêm nút ghi âm vào toolbar của NotesPageInner. Dùng Web Audio API để mix mic và system audio thành 1 track duy nhất, cho phép toggle từng nguồn bất kỳ lúc nào trong phiên. Sau khi dừng, file WebM/Opus được upload lên thư viện (format `audio`) và hiện nút tạo transcript ngay.

## Boundaries & Constraints

**Always:**
- Hỗ trợ Pause/Resume: `MediaRecorder.pause()` / `MediaRecorder.resume()` — timer dừng khi pause, tiếp tục khi resume; file output là 1 blob liên tục duy nhất
- Nút điều khiển: ⏸ Tạm dừng (khi đang record) → ▶ Tiếp tục (khi đang pause) → ⏹ Hoàn thành (lưu + upload)
- Toggle mic/system audio hoạt động realtime (mute track, không dừng recording)
- Kết quả upload lên thư viện dưới dạng `audio`
- Sau khi upload thành công: tự động chèn vào cuối note đang mở 1 block paragraph dạng `[🎤 Ghi âm DD/MM/YYYY HH:mm - M:SS](link-reader)` — dùng `editor.insertBlocks` của BlockNote
- Sau upload hiện nút "Tạo transcript" dùng lại `TranscriptButton` + `transcribeMedia`
- Ghi âm bằng `MediaRecorder` + Web Audio API `AudioContext`
- System audio capture qua `getDisplayMedia({ audio: true, video: false })` — Chrome/Edge only; Firefox không hỗ trợ → hiện warning

**Ask First:**
- Nếu browser không support `getDisplayMedia` cho audio-only → hỏi trước khi fallback về mic-only

**Never:**
- Không lưu blob xuống disk tự động (user quyết định sau khi preview)
- Không xử lý audio server-side trong lúc recording
- Không thay đổi schema Convex — dùng lại `documents` + `audio` format

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Start với cả 2 nguồn | Click Ghi âm, cấp quyền mic + system | Recording bắt đầu, hiện timer, cả 2 indicator sáng | Nếu từ chối quyền → toast error |
| Pause/Resume | Click ⏸ rồi sau đó ▶ | Timer dừng lại khi pause, tiếp tục đếm khi resume; audio trong khoảng pause không được ghi | — |
| Hoàn thành sau pause | Click ⏹ Hoàn thành | 1 file blob duy nhất gộp tất cả đoạn đã ghi, không có khoảng lặng | — |
| Toggle tắt mic ở phút 3 | Click nút mic trong lúc recording | Mic track muted, indicator mờ, audio tiếp tục từ system | — |
| Toggle bật lại mic | Click nút mic lần 2 | Mic unmuted, cả 2 nguồn active lại | — |
| Dừng và upload | Click Dừng | Hiện preview player + tên file + nút Upload | Upload fail → toast error, giữ blob để retry |
| Upload thành công | Upload hoàn tất | Chèn link vào cuối note, hiện TranscriptButton | Nếu chèn link lỗi → toast warning, không block |
| System audio không support | Firefox hoặc browser cũ | Warning "Browser không hỗ trợ system audio", chỉ có mic | — |
| Recording > 2 giờ | Timer vượt 2:00:00 | Tự động dừng, toast thông báo | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/components/notes/NotesPageInner.tsx` -- toolbar chứa nút ghi âm; truyền `editorRef` xuống AudioRecorder
- `apps/web/src/components/notes/NoteEditor.tsx` -- expose `editor` instance qua ref để AudioRecorder chèn block
- `apps/web/src/components/notes/AudioRecorder.tsx` -- component mới: UI + logic ghi âm + chèn link vào note
- `apps/web/src/hooks/useAudioRecorder.ts` -- hook mới: MediaRecorder + Web Audio API mixing
- `apps/web/src/components/viewers/transcript/TranscriptButton.tsx` -- tái dùng sau upload
- `convex/documents/actions.ts` -- `requestUploadUrl` + `getDownloadUrl` tái dùng
- `convex/documents/mutations.ts` -- `finalizeUpload` tái dùng
- `apps/web/src/lib/storage/index.ts` -- `SUPPORTED_FORMATS`, `detectFormat` tái dùng

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/hooks/useAudioRecorder.ts` -- TẠO MỚI -- Hook quản lý state: `start()`, `pause()`, `resume()`, `finish()`, `toggleMic()`, `toggleSystem()`. States: `idle | recording | paused`. Dùng `AudioContext` + `createMediaStreamDestination()` để merge streams. `MediaRecorder.pause()` / `.resume()` cho pause/resume. Khi `finish()`: trả về `Blob` (audio/webm) + tổng duration (không tính thời gian pause).
- [ ] `apps/web/src/components/notes/NoteEditor.tsx` -- THÊM prop `editorRef?: React.MutableRefObject<BlockNoteEditor | null>` và gán `editorRef.current = editor` trong useEffect
- [ ] `apps/web/src/components/notes/AudioRecorder.tsx` -- TẠO MỚI -- Nhận prop `editorRef`. UI: panel ghi âm với timer + 2 toggle (Mic/Máy tính) + nút ⏸/▶ (Tạm dừng/Tiếp tục) + nút ⏹ Hoàn thành. Sau finish: preview `<audio>` + input tên + nút Upload + nút Hủy. Upload → `finalizeUpload` → chèn block link vào note → hiện `TranscriptButton`
- [ ] `apps/web/src/components/notes/NotesPageInner.tsx` -- THÊM nút Ghi âm vào toolbar bên phải (sau nút .md), tạo `editorRef`, truyền vào cả `NoteEditor` và `AudioRecorder`

## Acceptance Criteria

- Given đang mở note, when click Ghi âm và cấp quyền, then timer đếm và cả 2 nguồn audio đang active
- Given đang ghi âm, when click ⏸ ở phút 3, wait 1 phút, click ▶ rồi click ⏹ ở phút 5, then file audio dài 5 phút (không có khoảng lặng 1 phút), timer hiện 5:00
- Given đang ghi âm, when toggle tắt mic ở phút 3 rồi dừng ở phút 5, then file audio có mic từ 0-3p và system từ 0-5p
- Given dừng ghi âm, when click Upload, then file xuất hiện trong thư viện với format audio, có thể tạo transcript, VÀ note đang mở có thêm 1 dòng link `🎤 Ghi âm DD/MM/YYYY HH:mm - M:SS` ở cuối
- Given Firefox, when click Ghi âm, then chỉ có mic hoạt động và hiện warning về system audio
- Given recording > 2 giờ, when timer đạt 2:00:00, then tự động dừng và thông báo

## Design Notes

**Audio mixing với Web Audio API:**
```typescript
const ctx = new AudioContext();
const dest = ctx.createMediaStreamDestination();
const micSource = ctx.createMediaStreamSource(micStream);
const sysSource = ctx.createMediaStreamSource(systemStream);
// Mỗi source có GainNode riêng để toggle
micGain.gain.value = 1; // 0 để mute
sysGain.gain.value = 1;
micSource.connect(micGain).connect(dest);
sysSource.connect(sysGain).connect(dest);
const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
```

Toggle realtime = `gainNode.gain.value = 0 | 1` — không stop/restart MediaRecorder.

## Verification

**Commands:**
- `cd apps/web && npm run build` -- expected: no TypeScript errors

**Manual checks:**
- Ghi âm 10 giây, toggle mic ở giây 5, nghe lại file — mic chỉ có ở 0-5s
- Upload file → xuất hiện trong /library với icon audio
- Bấm Tạo transcript → transcript được tạo bình thường
