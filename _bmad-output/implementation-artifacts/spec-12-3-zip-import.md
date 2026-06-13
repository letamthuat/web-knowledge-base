---
title: 'Story 12.3 — ZIP import pipeline (handbook)'
type: 'feature'
created: '2026-06-11'
status: 'draft'
baseline_commit: '2463397'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** User cần upload nguyên một Handbook (cây thư mục .md + assets/img + pdf/pptx... với relative link) bằng 1 file ZIP, giữ nguyên cấu trúc và `relPath` của từng file, không gãy liên kết.

**Approach:** Giải nén ZIP **phía client** bằng `jszip` (đã là dependency), với mỗi entry: xác định format theo đuôi, xin presigned PUT (`requestUploadUrl`), upload bytes lên R2; gom manifest rồi gọi 1 mutation `handbooks.finalizeImport(handbookId, files[])` để batch-insert documents (kèm `handbookId`+`relPath`) và schedule extract text. Tránh giới hạn memory/time của Convex action; tái dùng hạ tầng upload sẵn có.

## Boundaries & Constraints

**Always:**
- Giải nén + upload phía client; server chỉ batch-finalize metadata.
- `relPath` = path trong ZIP, chuẩn hóa: bỏ thư mục gốc dư thừa nếu ZIP bọc 1 folder cha (detect common prefix), forward-slash, không `/` đầu.
- Format theo đuôi: `.md/.markdown`→markdown, `.pdf`→pdf, `.docx`→docx, `.pptx`→pptx, `.png/.jpg/.jpeg/.gif/.webp/.svg`→image, `.epub`→epub, `.mp3/.wav/.m4a`→audio, `.mp4/.webm`→video, `.html/.htm`→web_clip. Đuôi khác → bỏ qua + đếm skipped.
- `title` của doc = tên file (bỏ đuôi).
- Schedule `extractText` cho mọi doc đọc được (để full-text search cover handbook ngay).
- Bỏ qua entry là thư mục, file rỗng (0 byte), file ẩn macOS (`__MACOSX/`, `.DS_Store`).

**Ask First:**
- Nếu manifest quá lớn (>~1000 file hoặc payload mutation vượt giới hạn) → hỏi trước về chia batch nhiều mutation.

**Never:**
- Không giải nén ZIP trong Convex action (tránh OOM/timeout).
- Không resolve relative link ở đây (12.4).
- Không tạo Domain/Handbook ở đây — import vào handbook đã tồn tại (tạo handbook qua 12.2 trước, hoặc UI tạo nhanh rồi import).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| ZIP chuẩn | folder Handbook nén | mọi file → doc với relPath đúng; ảnh & md & pdf đều vào | — |
| ZIP bọc folder cha | `Handbook/06-warehouse.md` | strip prefix `Handbook/` → relPath `06-warehouse.md` | nhiều folder gốc → giữ nguyên (không strip) |
| File đuôi lạ | `.xlsx` | bỏ qua, tăng `skipped` | — |
| File rỗng | 0 byte | bỏ qua | — |
| Upload 1 file lỗi R2 | network fail | đánh dấu file lỗi, tiếp tục file khác, báo cuối | hiển thị số lỗi |
| finalizeImport | manifest hợp lệ | insert N docs + schedule extract; trả `{created, skipped}` | handbook không sở hữu → NOT_FOUND |

</frozen-after-approval>

## Code Map

- `apps/web/src/components/handbook/ImportZipDialog.tsx` (mới) — chọn ZIP, giải nén `jszip`, progress bar, gọi upload + finalize.
- `apps/web/src/lib/handbook/zipImport.ts` (mới) — `parseZip(file)` → entries; `detectCommonPrefix`; `extToFormat`.
- `convex/handbooks/mutations.ts` — thêm `finalizeImport({handbookId, files: [{relPath, storageKey, format, fileSizeBytes, mimeType}]})`: batch `ctx.db.insert("documents", {... handbookId, relPath, storageBackend:"r2", status:"ready"})` + `scheduler.runAfter(0, internal.documents.actions.extractText, {docId})`.
- Tái dùng: `api.documents.actions.requestUploadUrl` (presigned PUT), `internal.documents.actions.extractText`, `finalizeUpload` pattern (insert doc) làm tham chiếu.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/lib/handbook/zipImport.ts` — `extToFormat(name)`, `parseZip(file)` trả `[{relPath, bytes, mimeType, format}]`, `detectCommonPrefix(paths)`.
- [ ] `convex/handbooks/mutations.ts` — `finalizeImport`: validate handbook sở hữu; loop insert doc + schedule extract; trả `{created, skipped}`.
- [ ] `apps/web/src/components/handbook/ImportZipDialog.tsx` — UI: chọn file, parse, loop `requestUploadUrl`+`fetch PUT`, progress %, gọi `finalizeImport`, toast kết quả.
- [ ] `npm run typecheck` + `npm run build` xanh.

**Acceptance Criteria:**
- Given ZIP của Handbook thật (xem screenshot), when import vào 1 handbook, then mọi `.md` + ảnh `assets/img/m06/*.png` + pdf xuất hiện đúng `relPath`.
- Given import xong, when chờ ~30s, then search full-text tìm được nội dung các file md (extractedText đã populate).
- Given ZIP bọc folder cha `Handbook/`, when import, then relPath không chứa prefix `Handbook/`.
