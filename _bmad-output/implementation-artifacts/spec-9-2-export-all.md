---
title: 'Story 9.2 — Export toàn bộ library ra ZIP'
type: 'feature'
created: '2026-05-04'
status: 'ready-for-dev'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nút "Tải xuống toàn bộ" hiện tại trong Settings dùng cấu trúc ZIP không chuẩn (`tai-lieu/`, `ghi-chu/`, `backup-info.json`) và thiếu `data.json`, `README.md`, frontmatter Obsidian — không thể import vào Obsidian vault hay dùng cho data portability thực sự.

**Approach:** Nâng cấp `useBackupDownload` + `getBackupData` để xuất đúng cấu trúc Epic 9 (`documents/<docId>/`, `notes/`, `data.json`, `README.md`); bổ sung query tags + reading_progress + preferences; giữ nguyên UX button trong SettingsPageInner (không tạo trang mới `/settings/export`).

## Boundaries & Constraints

**Always:**
- ZIP build client-side bằng JSZip — giữ nguyên pattern `useBackupDownload`.
- Cấu trúc ZIP mới: `documents/<docId>/<title>.<ext>`, `documents/<docId>/highlights.md`, `notes/<noteId>.md` (frontmatter `tags`, `parentDocId`), `data.json`, `README.md`.
- `data.json` chứa: `{ tags, reading_progress, preferences, exportedAt }` — ISO string timestamps.
- `README.md` là hướng dẫn ngắn mở vault trong Obsidian (tiếng Việt).
- Wikilink `[[<doc-title>]]` trong highlights.md và notes/*.md — tương thích Obsidian (NFR32).
- Hoàn thành ≤ 2 phút với ≤ 1.000 tài liệu (NFR19) — không dùng scheduled job; nếu user có >1000 doc thì hiển thị warning.
- Không thêm dependency mới.
- Giữ nút hiện tại trong SettingsPageInner — chỉ đổi label thành "Export ZIP (Obsidian)" và nâng cấp logic.

**Ask First:**
- Nếu tổng file size ước tính > 500 MB: thông báo user trước khi bắt đầu hay proceed luôn?

**Never:**
- Không dùng Convex scheduled action / job queue (scope 9.3+).
- Không tạo trang `/settings/export` riêng — UX đủ đơn giản để để trong Settings hiện tại.
- Không xoá/thay nút "Tải xuống toàn bộ" cũ — upgrade in-place.
- Không include `sync_conflicts` nếu bảng chưa tồn tại trong schema.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | User có docs + notes + highlights | ZIP đúng cấu trúc tải về | — |
| Doc không có highlights | Doc thiếu highlights | `documents/<docId>/highlights.md` vắng mặt cho doc đó | — |
| Note không liên kết doc | `note.docId` null | `notes/<noteId>.md` không có frontmatter `parentDocId` | — |
| Không có tags | Tags rỗng | `data.json` có `tags: []` | — |
| Fetch 1 file lỗi | R2 URL hết hạn | Bỏ qua file đó, tiếp tục; note trong `data.json` → `skippedDocs: [docId]` | Log warning |
| User > 1000 docs | docCount > 1000 | Toast warning "Export có thể mất vài phút", vẫn proceed | — |

</frozen-after-approval>

## Code Map

- `convex/documents/actions.ts` — nâng cấp `getBackupData`: thêm query tags + reading_progress + preferences; trả thêm `{ tags, readingProgress, preferences }`
- `apps/web/src/hooks/useBackupDownload.ts` — nâng cấp: đổi ZIP structure sang `documents/<docId>/`, `notes/`, `data.json`, `README.md`; cập nhật label + filename
- `apps/web/src/components/settings/SettingsPageInner.tsx` — đổi label nút thành "Export ZIP (Obsidian)"; giữ loading state hiện có

## Tasks & Acceptance

**Execution:**
- [ ] `convex/documents/actions.ts` — trong `getBackupData`, thêm query: (1) `tags` của user, (2) `reading_progress` của user (tất cả docs), (3) `users` preferences field; trả thêm `tags: [{id, name, color}]`, `readingProgress: [{docId, progressPct, updatedAt}]`, `preferences: object | null`
- [ ] `apps/web/src/hooks/useBackupDownload.ts` — đổi ZIP structure: `documents/<docId>/<title>.<ext>` thay vì `tai-lieu/<title>.<ext>`; `documents/<docId>/highlights.md` thay vì root `highlights.md`; `notes/<noteId>.md` với frontmatter `parentDocId` + `tags` thay vì header comment; thêm `data.json`; thêm `README.md`; đổi filename thành `web-kb-export-{YYYY-MM-DD}.zip`
- [ ] `apps/web/src/hooks/useBackupDownload.ts` — `data.json` structure: `{ exportedAt: ISO, docCount, noteCount, highlightCount, tags: [...], readingProgress: [...], preferences: {...}, skippedDocs: [] }`
- [ ] `apps/web/src/hooks/useBackupDownload.ts` — `README.md` content: hướng dẫn ngắn mở thư mục `documents/` + `notes/` làm Obsidian vault, wikilink hoạt động tự động
- [ ] `apps/web/src/components/settings/SettingsPageInner.tsx` — đổi label nút từ "Tải xuống toàn bộ" → "Export ZIP (Obsidian)"; giữ nguyên loading/disabled state

**Acceptance Criteria:**
- Given Settings page, when click "Export ZIP (Obsidian)", then file `web-kb-export-<date>.zip` được download
- Given ZIP tải về, when giải nén, then thấy thư mục `documents/`, `notes/`, file `data.json`, `README.md`
- Given `documents/<docId>/`, when mở, then chứa file gốc và `highlights.md` (nếu có)
- Given `notes/<noteId>.md`, when mở, then có frontmatter `parentDocId` (nếu note liên kết doc) và `tags`
- Given mở `documents/` + `notes/` làm Obsidian vault, when click wikilink `[[<doc-title>]]`, then resolve đúng
- Given `data.json`, when parse, then có `tags`, `readingProgress`, `exportedAt` là ISO string
- Given 1 file gốc không fetch được, when export, then ZIP vẫn hoàn thành; `data.json.skippedDocs` ghi docId bị bỏ qua

## Design Notes

**ZIP cấu trúc mẫu:**
```
web-kb-export-2026-05-04.zip
├── documents/
│   ├── <docId1>/
│   │   ├── Tên tài liệu.pdf
│   │   └── highlights.md
│   └── <docId2>/
│       └── Tên khác.epub
├── notes/
│   ├── <noteId1>.md   ← frontmatter: parentDocId, tags
│   └── <noteId2>.md
├── data.json
└── README.md
```

**README.md mẫu (tiếng Việt):**
```markdown
# Web Knowledge Base Export

Mở thư mục này làm Obsidian vault để dùng wikilink và tag.

- `documents/` — tài liệu gốc kèm highlights
- `notes/` — ghi chú (frontmatter chứa tag và liên kết tài liệu)
- `data.json` — dữ liệu thô: tag, tiến độ đọc, preferences

Wikilink dạng `[[Tên tài liệu]]` sẽ tự hoạt động khi mở vault.
```

## Verification

**Commands:**
- `cd apps/web && npx tsc --noEmit` -- expected: no new type errors

**Manual checks:**
- Click Export → ZIP tải về đúng tên `web-kb-export-*.zip`
- Giải nén → đúng cấu trúc `documents/`, `notes/`, `data.json`, `README.md`
- Parse `data.json` → có `tags`, `readingProgress`, `exportedAt` ISO
- Mở vault Obsidian → wikilink trong highlights.md và notes hoạt động
- 1 doc không có highlight → không có `highlights.md` trong thư mục đó
