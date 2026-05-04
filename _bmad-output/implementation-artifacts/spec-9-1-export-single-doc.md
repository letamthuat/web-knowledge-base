---
title: 'Story 9.1 — Export 1 tài liệu đơn lẻ ra ZIP'
type: 'feature'
created: '2026-05-04'
status: 'in-progress'
baseline_commit: '11bc8aee8a75c007f83b1a3c02703e03732a6476'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** User chỉ có thể tải file gốc đơn lẻ, không thể export một tài liệu kèm highlights và notes liên quan để backup riêng hoặc mở trong Obsidian.

**Approach:** Thêm "Export ZIP" vào dropdown 3-chấm của DocumentCard và vào More menu trong reader; một Convex action fetch metadata cho 1 doc; client dùng JSZip (đã có trong `useBackupDownload`) build ZIP và trigger download ngay — không cần API route, không cần job queue.

## Boundaries & Constraints

**Always:**
- ZIP build client-side bằng JSZip — tái dùng pattern từ `useBackupDownload.ts`.
- ZIP structure: `<title>.<ext>` (file gốc), `highlights.md` (bảng Markdown + wikilink), `notes/<noteId>.md` (frontmatter `parentDoc`, `tags`), `voice/<highlightId>.mp3` nếu highlight có `voiceNoteStorageId`.
- `highlights.md` dùng wikilink `[[<doc-title>]]` để tương thích Obsidian (NFR32).
- Convex action chỉ trả metadata + presigned URLs — không stream binary qua Convex.
- Auth check bắt buộc: chỉ export doc thuộc `userId` hiện tại.
- Không phát sinh chi phí mới — dùng R2 presigned URL đã có.

**Ask First:**
- Nếu file gốc > 100 MB: bỏ file gốc khỏi ZIP hay vẫn include?

**Never:**
- Không thêm zip dependency mới (jszip đã có).
- Không build ZIP server-side hay stream qua API route.
- Không export notes không có `docId` khớp với doc này.
- Không thay đổi nút "Tải xuống" hiện có — thêm item mới bên cạnh.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | Doc có highlights và notes | ZIP: file gốc + highlights.md + notes/*.md | — |
| Không có highlights | Doc không có highlights | ZIP: chỉ file gốc, không có highlights.md | — |
| Không có notes | Doc không có notes liên kết | ZIP: không có thư mục notes/ | — |
| Voice note | Highlight có `voiceNoteStorageId` | ZIP thêm `voice/<highlightId>.mp3` | Bỏ qua nếu fetch lỗi |
| Web clip | `format === "web_clip"`, `clippedContent` có | ZIP: `clipped-content.html` thay file gốc + highlights + notes | — |
| Fetch file gốc lỗi | R2 URL hết hạn / network error | Toast "Không thể tải file gốc"; dừng export | Toast error |

</frozen-after-approval>

## Code Map

- `convex/documents/actions.ts` — thêm `getSingleDocExportData({ docId })`: auth, fetch doc + highlights + notes có `docId` khớp + presigned URLs
- `convex/highlights/queries.ts` — kiểm tra có query `listByDocInternal` chưa (đã dùng trong `getBackupData`); tái dùng
- `apps/web/src/hooks/useDocExport.ts` — hook mới: gọi `getSingleDocExportData`, build ZIP, trigger download; expose `{ exportDoc, isExporting }`
- `apps/web/src/components/library/DocumentCard.tsx` — thêm item "Export ZIP" vào dropdown 3-chấm (đã có DropdownMenu)
- `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — thêm item "Export ZIP" vào BottomSheet more menu + desktop dropdown

## Tasks & Acceptance

**Execution:**
- [ ] `convex/documents/actions.ts` — thêm action `getSingleDocExportData({ docId: v.id("documents") })`: verify doc belongs to user; fetch highlights via `listByDocInternal`; fetch notes where `docId` matches; generate presigned download URL cho file gốc + từng `voiceNoteStorageId`; return `{ doc, downloadUrl, highlights, notes, voiceUrls: Record<highlightId, url> }`
- [ ] `apps/web/src/hooks/useDocExport.ts` — tạo hook `useDocExport()` dùng `useAction(api.documents.actions.getSingleDocExportData)`; build ZIP: thêm file gốc (fetch blob từ downloadUrl), `highlights.md` (nếu có), `notes/<id>.md` cho mỗi note (nếu có), `voice/<id>.mp3` cho mỗi voice URL; trigger download `<title>.zip`; return `{ exportDoc: (docId) => Promise<void>, isExporting: boolean }`
- [ ] `apps/web/src/components/library/DocumentCard.tsx` — trong DropdownMenuItem list, thêm item "Export ZIP" với icon `Download`; gọi `exportDoc(doc._id)`; disable khi `isExporting`
- [ ] `apps/web/src/app/reader/[docId]/ReaderPageInner.tsx` — thêm button "Export ZIP" vào BottomSheet more menu (mobile) và vào header more dropdown (desktop); tái dùng `useDocExport`

**Acceptance Criteria:**
- Given DocumentCard có dropdown 3-chấm, when click "Export ZIP", then file `<title>.zip` được download
- Given ZIP tải về, when giải nén, then chứa file gốc, `highlights.md` (nếu có highlight), thư mục `notes/` (nếu có note liên kết)
- Given `highlights.md`, when mở trong Obsidian, then wikilink `[[<doc-title>]]` resolve đúng
- Given highlight có `voiceNoteStorageId`, when export, then ZIP có `voice/<highlightId>.mp3`
- Given đang build ZIP, when nhìn vào nút "Export ZIP", then nút disabled (tránh double-click)
- Given user không phải chủ doc, when gọi `getSingleDocExportData`, then Convex throw error Unauthorized

## Design Notes

**highlights.md format:**
```markdown
# Highlights — [[Tên tài liệu]]

| # | Đoạn highlight | Ghi chú | Màu | Vị trí |
|---|---|---|---|---|
| 1 | "nội dung..." | ghi chú nếu có | yellow | trang 3 |
```

**notes/\<noteId\>.md format:**
```markdown
---
parentDoc: "[[Tên tài liệu]]"
tags: [tag1, tag2]
---

Nội dung ghi chú...
```

**Tái dùng pattern từ `useBackupDownload`:** fetch blob → `zip.file(name, blob)` → `zip.generateAsync({type:"blob", compression:"DEFLATE"})` → `URL.createObjectURL` → click.

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: no new type errors

**Manual checks:**
- Click Export ZIP trên card → ZIP tải về đúng tên
- Giải nén → đúng cấu trúc file
- Mở highlights.md trong Obsidian → wikilink hoạt động
- Export doc không có highlight/note → ZIP chỉ có file gốc, không có file thừa
