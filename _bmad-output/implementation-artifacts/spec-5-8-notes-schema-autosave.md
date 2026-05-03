---
title: 'Story 5.8 — Schema notes + Auto-save ≤1s'
type: 'feature'
created: '2026-05-03'
status: 'done'
baseline_commit: 'c1f5b95'
---

## Intent

Tạo bảng `notes` trong Convex schema cho ghi chú tự do gắn với tài liệu. Auto-save ≤1s debounce. Notes hiển thị trong AnnotationPanel tab Ghi chú.

## Code Map

- `convex/schema.ts` — bảng `notes` với userId, docId, title?, body, highlightId?, updatedAt, createdAt
- `convex/notes/mutations.ts` — `create`, `update`, `remove`
- `convex/notes/queries.ts` — `listByDoc`, `listAllByUser`
- `apps/web/src/hooks/useNotes.ts` — `useNotes(docId)`, `useAllNotes()`
- `apps/web/src/components/viewers/markdown/DocNotePopover.tsx` — Free-form note modal với auto-save 1s

## Tasks & Acceptance

- [x] Schema `notes` bảng đầy đủ fields
- [x] `create`, `update`, `remove` mutations với auth check
- [x] `listByDoc` query
- [x] `DocNotePopover.tsx` — title + body textarea, auto-save 1s debounce, badge "Đã lưu"
- [x] `AnnotationPanel.tsx` — Tab "Ghi chú" hiển thị doc notes + highlight notes

## Verification

- `cd apps/web && npx tsc --noEmit` — 0 errors
