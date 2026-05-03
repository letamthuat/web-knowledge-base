---
title: 'Story 5.5 — Bookmark / Timestamp Marker'
type: 'feature'
created: '2026-05-03'
status: 'done'
baseline_commit: 'c1f5b95'
---

## Intent

Người dùng có thể đánh dấu bookmark tại vị trí bất kỳ trong tài liệu markdown (không cần chọn text). Bookmark hiển thị trong AnnotationPanel tab Bookmarks. Click → scroll đến vị trí đó.

## Approach

Thêm nút bookmark vào toolbar MarkdownViewer. Khi click → lưu scroll position hiện tại. Schema `highlights` đã có `type: "bookmark"`.

## Code Map

- `convex/highlights/mutations.ts` — `createBookmark(docId, positionValue, label?)` mutation mới
- `apps/web/src/hooks/useHighlights.ts` — thêm `addBookmark` callback
- `apps/web/src/components/viewers/markdown/MarkdownViewer.tsx` — nút Bookmark trong toolbar
- `apps/web/src/components/viewers/markdown/AnnotationPanel.tsx` — tab "Bookmarks" hoặc hiển thị bookmark trong tab Highlight

## Tasks & Acceptance

- [x] `convex/highlights/mutations.ts` — `createBookmark`: type="bookmark", positionType="scroll_pct", positionValue=JSON scroll info
- [x] `apps/web/src/hooks/useHighlights.ts` — `addBookmark(label?)` 
- [x] `MarkdownViewer.tsx` — nút Bookmark icon trong toolbar, click → `addBookmark`
- [x] `AnnotationPanel.tsx` — hiển thị bookmarks trong tab Highlight với icon bookmark khác biệt
- [x] Click bookmark item → scroll đến vị trí

## Verification

- `cd apps/web && npx tsc --noEmit` — 0 errors
