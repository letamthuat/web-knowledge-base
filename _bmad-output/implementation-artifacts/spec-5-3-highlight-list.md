---
title: 'Story 5.3 — Highlight List + Jump To'
type: 'feature'
created: '2026-05-03'
status: 'done'
baseline_commit: 'c1f5b95'
---

## Intent

Hiển thị danh sách tất cả highlight của tài liệu hiện tại trong panel bên phải; click vào item → scroll đến vị trí highlight trong văn bản.

## Code Map

- `apps/web/src/components/viewers/markdown/AnnotationPanel.tsx` — Tab "Highlight" với list + onScrollTo callback
- `apps/web/src/components/viewers/markdown/HighlightLayer.tsx` — Re-anchor và render `<mark>` tags
- `apps/web/src/hooks/useHighlights.ts` — `useHighlights(docId)` query
- `convex/highlights/queries.ts` — `listByDoc` query

## Tasks & Acceptance

- [x] `AnnotationPanel.tsx` — Tab "Highlight" hiển thị list highlight với màu indicator và selectedText preview
- [x] `AnnotationPanel.tsx` — Click item gọi `onScrollTo(id)` → scroll đến `<mark>` tương ứng
- [x] `MarkdownViewer.tsx` — Nút mở AnnotationPanel, wire `onScrollTo`
- [x] Highlights sắp xếp theo `createdAt` desc

## Verification

- `cd apps/web && npx tsc --noEmit` — 0 errors
